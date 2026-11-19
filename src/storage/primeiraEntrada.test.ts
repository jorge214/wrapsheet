import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Primeira entrada e dados do diálogo de exportação (storage/primeiraEntrada.ts),
// com o Supabase simulado:
//   • sem rede, os dados escritos no diálogo ficam PENDENTES e chegam ao perfil
//     na sincronização seguinte (antes perdiam-se, e a folha seguinte nascia
//     sem NIF/IBAN sem ninguém perguntar);
//   • sem perfil nenhum, o primeiro perfil nasce com eles — só se a nuvem
//     confirmar que não há perfil (nunca um 2.º perfil);
//   • se a pessoa criou uma folha com o "+" antes de as perguntas aparecerem,
//     as respostas não se perdem.

const mem = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: async (k: string, v: string) => { mem.set(k, v); },
    removeItem: async (k: string) => { mem.delete(k); },
    multiGet: async (ks: string[]) => ks.map((k) => [k, mem.has(k) ? mem.get(k)! : null]),
    multiRemove: async (ks: string[]) => { for (const k of ks) mem.delete(k); },
    getAllKeys: async () => [...mem.keys()],
  },
}));
vi.mock("../i18n/i18n", () => ({ default: { t: (k: string, o?: any) => o?.defaultValue ?? k, language: "pt" } }));
vi.mock("../sync/syncService", () => ({ syncProfileToCloud: async () => {}, syncProjectToCloud: async () => {} }));
vi.mock("./exemplo", () => ({ criarExemploSePreciso: async () => {} }));

// O "servidor": rede ligada/desligada e o que está na nuvem; a conta com
// sessão (null = sessão morta); a rede "presa" (o pedido nunca responde)
let online = true;
let pendurar = false;
let pendurarUpdate = false;
let sessaoUid: string | null = "U";
let pendurarSessao = false;
let pedidosSessao = 0;
const updates: any[] = [];
let nuvem = { perfis: [] as any[], folhas: [] as any[] };
const ERRO = { message: "Failed to fetch", code: "" };
function consulta(tabela: string) {
  const q: any = {
    _maybe: false,
    select: () => q,
    eq: () => q,
    limit: () => q,
    maybeSingle: () => { q._maybe = true; return q; },
    then: (ok: any, ko: any) => {
      if (pendurar) return new Promise(() => {});
      let r: any;
      if (!online) r = { data: null, error: ERRO };
      else if (tabela === "profiles") r = q._maybe ? { data: nuvem.perfis[0] ?? null, error: null } : { data: nuvem.perfis, error: null };
      else r = { data: nuvem.folhas, error: null };
      return Promise.resolve(r).then(ok, ko);
    },
  };
  return q;
}
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => {
        pedidosSessao++;
        if (pendurarSessao) await new Promise(() => {}); // sem rede, token expirado: a renovação não acaba
        return { data: { session: sessaoUid ? { user: { id: sessaoUid, user_metadata: {} } } : null } };
      },
      getUser: async () =>
        sessaoUid ? { data: { user: { id: sessaoUid, user_metadata: {} } }, error: null } : { data: { user: null }, error: { message: "sem sessão" } },
      updateUser: async (x: any) => {
        updates.push({ sessao: sessaoUid, ...x });
        if (pendurarUpdate) await new Promise(() => {});
        return { data: {}, error: null };
      },
    },
    from: (t: string) => consulta(t),
  },
}));

const { aplicarDadosPendentes, concluirPrimeiraEntrada, guardarDadosOuAdiar } = await import("./primeiraEntrada");
const { getActiveProfile, listProfiles, setActiveProfileId, upsertProfile } = await import("./profile");
const { createProject, getProject, listAllProjectsFull } = await import("./projects");
const { confirmacaoDeDados, fecharPassos, marcarConta, marcarDadosConfirmados, marcarPasso } = await import("./primeirosPassos");
const { clearLocalUserData } = await import("./clearLocal");

const dados = { nome: "Ana Ribeiro", email: "ana@x.pt", telefone: "", nif: "245678910", iban: "PT50000000001234567890135" };
const PENDENTE = "passos:dados-pendentes:v1:U";

beforeEach(() => {
  mem.clear();
  online = true;
  pendurar = false;
  pendurarUpdate = false;
  sessaoUid = "U";
  pendurarSessao = false;
  pedidosSessao = 0;
  updates.length = 0;
  nuvem = { perfis: [], folhas: [] };
});
afterEach(() => vi.useRealTimers());

describe("dados do diálogo de exportação", () => {
  it("sem rede ficam pendentes e chegam ao perfil na sincronização seguinte", async () => {
    const p = await upsertProfile({ id: "P1", nome: "", email: "", telefone: "", departamento: "", funcao: "Grip", fixas: {} } as any);
    await setActiveProfileId(p.id);
    online = false;
    await guardarDadosOuAdiar("U", "P1", dados, null, { formato: "publicidade", perfil: { funcao: "Grip" } });
    expect((await getActiveProfile())!.nome).toBe(""); // ainda não
    expect(mem.has(PENDENTE)).toBe(true);
    online = true;
    await aplicarDadosPendentes("U");
    const perfil = (await getActiveProfile())!;
    expect(perfil).toMatchObject({ nome: "Ana Ribeiro", nif: "245678910", iban: "PT50000000001234567890135", funcao: "Grip" });
    expect(mem.has(PENDENTE)).toBe(false);
  });

  it("o pendente fica gravado ANTES de tentar a rede (a app pode ser fechada a meio)", async () => {
    const p = await upsertProfile({ id: "P1", nome: "", email: "", telefone: "", departamento: "", funcao: "", fixas: {} } as any);
    await setActiveProfileId(p.id);
    online = false;
    const promessa = guardarDadosOuAdiar("U", "P1", dados, null, { formato: "publicidade" });
    // logo a seguir a chamar, antes de a rede responder
    expect(mem.has(PENDENTE)).toBe(true);
    await promessa;
    expect(mem.has(PENDENTE)).toBe(true); // sem rede, continua lá
  });

  it("reposição tardia: uma correção feita no perfil DEPOIS do diálogo não é desfeita", async () => {
    await upsertProfile({ id: "P1", nome: "", email: "", telefone: "", departamento: "", funcao: "", fixas: {} } as any);
    await setActiveProfileId("P1");
    online = false;
    // no décor, sem rede: escreve um IBAN com uma gralha
    await guardarDadosOuAdiar("U", "P1", { ...dados, iban: "PT50 GRALHA" }, { nome: "", email: "", telefone: "", nif: "", iban: "" }, { formato: "publicidade" });
    // depois, corrige o IBAN no perfil (noutro aparelho ou aqui)
    await new Promise((r) => setTimeout(r, 5));
    const atual = (await getActiveProfile())!;
    await upsertProfile({ ...atual, iban: "PT50 CERTO" });
    online = true;
    await aplicarDadosPendentes("U");
    const perfil = (await getActiveProfile())!;
    expect(perfil.iban).toBe("PT50 CERTO"); // a correção ganha
    expect(perfil.nome).toBe("Ana Ribeiro"); // os campos vazios preenchem-se na mesma
  });

  it("sem perfil nenhum: o primeiro nasce com os dados (e a função), sem o valor da folha", async () => {
    await guardarDadosOuAdiar("U", undefined, dados, null, { formato: "publicidade", perfil: { funcao: "Anotadora" } });
    const perfis = await listProfiles();
    expect(perfis).toHaveLength(1);
    expect(perfis[0]).toMatchObject({ nome: "Ana Ribeiro", nif: "245678910", funcao: "Anotadora" });
    expect(perfis[0].fixas).toEqual({}); // o valor não se inventa
    expect(mem.has(PENDENTE)).toBe(false);
  });

  it("sem perfil e com um perfil na NUVEM (ainda não chegou): não cria um 2.º — fica pendente", async () => {
    nuvem.perfis = [{ id: "P9", apagado: null }];
    await guardarDadosOuAdiar("U", undefined, dados, null, { formato: "publicidade" });
    expect(await listProfiles()).toHaveLength(0);
    expect(mem.has(PENDENTE)).toBe(true);
  });
});

describe("primeira entrada com uma folha já criada pelo \"+\"", () => {
  it("cria o perfil e a folha que já existe ganha a função e o valor (sem criar outra)", async () => {
    const id = await createProject(); // publicidade, sem perfil: salário 0
    nuvem.folhas = [{ id, apagado: null, exemplo: null }];
    const devolvida = await concluirPrimeiraEntrada("U", { formato: "publicidade", funcao: "1.º Assistente de Câmara", valor: 250 });
    expect(devolvida).toBe(id);
    expect(await listAllProjectsFull()).toHaveLength(1);
    const f = (await getProject(id))!;
    expect(f.tabela.salarioDia).toBe(250);
    expect(f.perfil.funcao).toBe("1.º Assistente de Câmara");
    expect(await listProfiles()).toHaveLength(1);
  });

  it("ao preencher o salário de uma folha a 0, as taxas de horas extra semeadas a 0 saem (seguem o salário)", async () => {
    const id = await createProject();
    const f0 = (await getProject(id))!;
    const { saveProject } = await import("./projects");
    // o que o editor do telemóvel semeava numa folha sem salário — numa folha
    // feita por uma versão ANTERIOR (sem a marca semSemente das folhas novas)
    const { semSemente: _nova, ...tabelaAntiga } = f0.tabela as any;
    await saveProject({ ...f0, tabela: { ...tabelaAntiga, salarioDia: 0, rateHEA: 0, rateHEB: 0, rateHR: 0 } });
    await concluirPrimeiraEntrada("U", { formato: "publicidade", funcao: "", valor: 250 });
    const t = (await getProject(id))!.tabela;
    expect(t.salarioDia).toBe(250);
    expect(t.rateHEA).toBeUndefined();
    expect(t.rateHEB).toBeUndefined();
    expect(t.rateHR).toBeUndefined();
  });

  it("sem folha nenhuma: a folha nova NÃO grava um nome (mostra-se pela data), e o índice leva o 1.º dia", async () => {
    const id = (await concluirPrimeiraEntrada("U", { formato: "publicidade", funcao: "Grip", valor: 250 }))!;
    const f = (await getProject(id))!;
    expect(f.projeto.titulo).toBe("");
    expect(f.tabela.salarioDia).toBe(250);
    const { listProjects } = await import("./projects");
    expect((await listProjects()).find((i) => i.id === id)!.inicio).toBe(f.dias[0].data);
  });

  it("uma folha que já tem valor não é mexida", async () => {
    const id = await createProject();
    const f0 = (await getProject(id))!;
    const { saveProject } = await import("./projects");
    await saveProject({ ...f0, tabela: { ...f0.tabela, salarioDia: 300 } });
    await concluirPrimeiraEntrada("U", { formato: "publicidade", funcao: "", valor: 250 });
    expect((await getProject(id))!.tabela.salarioDia).toBe(300);
  });

  it("com um perfil na nuvem não cria nada", async () => {
    nuvem.perfis = [{ id: "P9", apagado: null }];
    expect(await concluirPrimeiraEntrada("U", { formato: "publicidade", funcao: "x", valor: 250 })).toBeNull();
    expect(await listProfiles()).toHaveLength(0);
  });

  it("sem rede não cria nada e avisa (lança)", async () => {
    online = false;
    await expect(concluirPrimeiraEntrada("U", { formato: "publicidade", funcao: "x", valor: 250 })).rejects.toThrow();
    expect(await listProfiles()).toHaveLength(0);
  });
});

describe("só com a sessão DESTA conta (revisão de 18/11)", () => {
  it("sessão morta: os dados pendentes NÃO vão para o perfil (a cópia local velha não pisa uma correção) — ficam para depois", async () => {
    await upsertProfile({ id: "P1", nome: "", email: "", telefone: "", departamento: "", funcao: "", fixas: {} } as any);
    await setActiveProfileId("P1");
    online = false;
    await guardarDadosOuAdiar("U", "P1", dados, null, { formato: "publicidade" });
    // Volta a rede, mas a sessão morreu (terminou sessão noutro aparelho)
    online = true;
    sessaoUid = null;
    await aplicarDadosPendentes("U");
    expect((await getActiveProfile())!.nome).toBe("");
    expect(mem.has(PENDENTE)).toBe(true);
    // Com a sessão de volta, aplicam-se
    sessaoUid = "U";
    await aplicarDadosPendentes("U");
    expect((await getActiveProfile())!.nif).toBe("245678910");
    expect(mem.has(PENDENTE)).toBe(false);
  });

  it("sessão de OUTRA conta: os dados de U não vão para o perfil da outra", async () => {
    await upsertProfile({ id: "PB", nome: "Bruno", email: "b@x.pt", telefone: "", departamento: "", funcao: "", fixas: {} } as any);
    await setActiveProfileId("PB");
    sessaoUid = "B";
    await guardarDadosOuAdiar("U", undefined, dados, null, { formato: "publicidade" });
    const pb = (await getActiveProfile())!;
    expect(pb).toMatchObject({ nome: "Bruno", email: "b@x.pt" });
    expect(pb.nif ?? "").toBe(""); // o NIF de U não chegou ao perfil de B
    expect(mem.has(PENDENTE)).toBe(true);
  });

  it("as marcas de U nunca sobem com a sessão de outra conta (ficam locais)", async () => {
    sessaoUid = "B";
    await marcarConta("U", { passo_pdf_v1: true });
    expect(updates).toHaveLength(0);
    expect(JSON.parse(mem.get("passos:v1:U")!)).toMatchObject({ passo_pdf_v1: true });
    sessaoUid = "U";
    await marcarConta("U", { passo_dia_v1: true });
    // Sobem a de agora e a que tinha ficado local
    expect(updates).toEqual([{ sessao: "U", data: { passo_dia_v1: true, passo_pdf_v1: true } }]);
  });
});

describe("as marcas dos passos ficam no aparelho JÁ, antes de qualquer pedido (revisão de 18/11)", () => {
  it("sem rede e com o token expirado: o passo fica feito logo, e as teclas seguintes não voltam a pedir a sessão", async () => {
    pendurarSessao = true;
    marcarPasso("U", "dia"); // não se espera: o getSession fica preso
    fecharPassos("U");
    await new Promise((r) => setTimeout(r, 20));
    expect(JSON.parse(mem.get("passos:v1:U")!)).toMatchObject({ passo_dia_v1: true, passos_fechados_v1: true });
    const antes = pedidosSessao;
    await marcarPasso("U", "dia"); // a tecla seguinte do mesmo dia
    expect(pedidosSessao).toBe(antes);
  });
});

describe("\"Criar\" nunca fica preso (revisão de 18/11)", () => {
  it("com a rede presa, desiste ao fim de 10 s sem criar nada", async () => {
    vi.useFakeTimers();
    pendurar = true;
    const r = concluirPrimeiraEntrada("U", { formato: "publicidade", funcao: "x", valor: 250 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await r).toBeInstanceOf(Error);
    expect(await listProfiles()).toHaveLength(0);
    expect(await listAllProjectsFull()).toHaveLength(0);
  });

  it("não espera pela subida das marcas: com o updateUser preso, a folha abre na mesma (marca local \"feita\")", async () => {
    pendurarUpdate = true;
    const id = await concluirPrimeiraEntrada("U", { formato: "publicidade", funcao: "Grip", valor: 250 });
    expect(id).toBeTruthy();
    expect(JSON.parse(mem.get("passos:v1:U")!)).toMatchObject({ primeira_entrada_v1: "feita", exemplo_v1: true });
  });
});

describe("dados pessoais no aparelho (revisão de 18/11)", () => {
  it("a confirmação por folha guarda só os 5 campos do diálogo, nunca o perfil inteiro", async () => {
    const perfil = { id: "P1", nome: "Ana", email: "ana@x.pt", telefone: "", nif: "245678910", iban: "PT50 1", swift: "BCOMPTPL", fixas: { salarioDia: 250 } };
    await marcarDadosConfirmados("U", "F1", perfil as any);
    expect((await confirmacaoDeDados("U")).get("F1")).toEqual({ nome: "Ana", email: "ana@x.pt", telefone: "", nif: "245678910", iban: "PT50 1" });
  });

  it("terminar sessão / eliminar a conta apaga os dados do diálogo (confirmados e pendentes); as marcas dos passos ficam", async () => {
    mem.set("passos:dados-confirmados:v1:U", JSON.stringify({ F1: { nif: "245678910" } }));
    mem.set(PENDENTE, JSON.stringify({ dados }));
    mem.set("passos:v1:U", JSON.stringify({ primeira_entrada_v1: "feita" }));
    mem.set("app-settings", "{}");
    await clearLocalUserData();
    expect([...mem.keys()].sort()).toEqual(["app-settings", "passos:v1:U"]);
  });
});
