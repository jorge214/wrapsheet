import { beforeEach, describe, expect, it, vi } from "vitest";

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
    getAllKeys: async () => [...mem.keys()],
  },
}));
vi.mock("../i18n/i18n", () => ({ default: { t: (k: string, o?: any) => o?.defaultValue ?? k, language: "pt" } }));
vi.mock("../sync/syncService", () => ({ syncProfileToCloud: async () => {}, syncProjectToCloud: async () => {} }));
vi.mock("./exemplo", () => ({ criarExemploSePreciso: async () => {} }));

// O "servidor": rede ligada/desligada e o que está na nuvem
let online = true;
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
      getSession: async () => ({ data: { session: { user: { id: "U", user_metadata: {} } } } }),
      getUser: async () => ({ data: { user: { id: "U", user_metadata: {} } }, error: null }),
      updateUser: async () => ({ data: {}, error: null }),
    },
    from: (t: string) => consulta(t),
  },
}));

const { aplicarDadosPendentes, concluirPrimeiraEntrada, guardarDadosOuAdiar } = await import("./primeiraEntrada");
const { getActiveProfile, listProfiles, setActiveProfileId, upsertProfile } = await import("./profile");
const { createProject, getProject, listAllProjectsFull } = await import("./projects");

const dados = { nome: "Ana Ribeiro", email: "ana@x.pt", telefone: "", nif: "245678910", iban: "PT50000000001234567890135" };
const PENDENTE = "passos:dados-pendentes:v1:U";

beforeEach(() => {
  mem.clear();
  online = true;
  nuvem = { perfis: [], folhas: [] };
});

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
