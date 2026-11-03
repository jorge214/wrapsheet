import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dia } from "../calc/types";
import type { FixasHE } from "./horasExtraPerfil";

// AsyncStorage em memória: o mesmo que o telemóvel/browser guarda, sem aparelho.
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
// O i18n puxa o expo-localization (react-native), que o vitest não lê.
vi.mock("../i18n/i18n", () => ({
  default: { t: (k: string, o?: any) => o?.defaultValue ?? k, language: "pt" },
}));

const { createProject, duplicateProjectToProfile, getProject, saveProject } = await import("./projects");
const { calcProject } = await import("../calc/project");
const { ratesFor } = await import("../calc/engine");
const { buildEditableSheetHtml, buildPdfHtml, fmtMoney } = await import("../export/buildPdfHtml");
const { getPreset } = await import("../constants/countryPresets");
const { condBoxesFor } = await import("./condDefaults");
const H = await import("./horasExtraPerfil");

// ─────────────────────────────────────────────────────────────────────────────
// Horas extra "ao valor da hora normal" (publicidade). Contas à mão, região
// Portugal (H_dia 11, HE-A × 1,5, HE-B × 2, HR × 3), regras por omissão do
// perfil (HE-A a partir da 12.ª hora → limiar 11 h; HE-B a partir da 19.ª →
// limiar 18 h; HR se o descanso for inferior a 10 h). O motor arredonda cada
// parcela a 2 casas (round2) e soma; a taxa €/h NÃO é arredondada.
//
//   salário 300 €/dia ÷ 11 h = hora normal 27,272727… €/h
//
//   COM a escolha "hora normal": HE-A e HE-B = a hora normal × 1, sem
//   arredondar a taxa (a folha e o PDF mostram-na a 2 casas, 27,27).
//     dia de 13 h (08:00–21:00): HE-A = min(13, 18) − max(11, 11) = 2 h
//       2 × 27,2727… = 54,5454… → 54,55 €  → total do dia 300 + 54,55 = 354,55 €
//       (a × 1,5 seriam 81,82 €)
//     dia de 19 h (08:00–03:00): HE-A = 18 − 11 = 7 h, HE-B = 19 − 18 = 1 h
//       7 × 27,2727… = 190,9090… → 190,91 € · 1 × 27,2727… → 27,27 €
//       total 300 + 190,91 + 27,27 = 518,18 €
//     dia de 22 h (08:00–06:00): HE-A 7 h, HE-B 4 h — 11 h de hora extra
//       7 × 27,2727… → 190,91 € · 4 × 27,2727… = 109,0909… → 109,09 €
//       190,91 + 109,09 = 300,00 € = exatamente um dia de salário (com a taxa
//       arredondada a 27,27 davam 299,97 €: era por isso que não se arredonda)
//       total 600,00 €
//
//   SEM a escolha (como sempre): taxas vazias, o motor deriva-as
//     HE-A 27,2727… × 1,5 = 40,9090… €/h → 2 h = 81,8181… → 81,82 €
//       (a linha de valores mostra 40,91 €) → total 381,82 €
//     dia de 19 h: HE-A 7 × 40,9090… = 286,3636… → 286,36 €
//                  HE-B 1 × 27,2727… × 2 = 54,5454… → 54,55 € → total 640,91 €
//
//   HR (recuperação) NÃO são horas extra e não mudam com a escolha:
//     acabar às 21:00 e voltar às 05:00 = 8 h de descanso → 10 − 8 = 2 h de HR
//     2 × 27,2727… × 3 = 163,6363… → 163,64 €
// ─────────────────────────────────────────────────────────────────────────────

const PT = H.baseRegiaoHE(getPreset("pt"));
const IT = H.baseRegiaoHE(getPreset("it"));
const HORA_PT = 300 / 11; // 27,272727…

function dia(data: string, inicio: string, fim: string): Dia {
  return {
    descricao: "Filmagem", data, continuo: false, inicio, fim, refeicaoTrabalho: "00:00",
    jantarTrabalho: "00:00", meioDia: false, tempoTransporteMin: 0, diaSemTrabalho: false,
  };
}

/** Perfil ativo como fica GRAVADO pelo ecrã do perfil (forma "para gravar"),
 *  folha nova pelo createProject de sempre, e os dias de teste por cima. */
async function folhaNova(fixasDoEcra: FixasHE, dias: Dia[], opts?: { regiaoPerfil?: typeof PT; regiaoFolha?: string }) {
  const perfil = {
    id: "p1", nome: "Ana", email: "", telefone: "", departamento: "", funcao: "",
    fixas: H.fixasParaGravar(fixasDoEcra, opts?.regiaoPerfil ?? PT),
  };
  mem.set("profiles:list:v1", JSON.stringify([perfil]));
  mem.set("profiles:activeId:v1", "p1");
  if (opts?.regiaoFolha) mem.set("app-settings", JSON.stringify({ region: opts.regiaoFolha }));
  const id = await createProject({ mes: 11, ano: 2026 });
  const p = (await getProject(id))!;
  return { ...p, dias };
}

const NORMAL: FixasHE = { salarioDia: 300, multHEA: 1, multHEB: 1 };
const ACRESCIMO: FixasHE = { salarioDia: 300 };

beforeEach(() => mem.clear());

describe("perfil → folha nova → motor: horas extra ao valor da hora normal", () => {
  it("2 h de HE-A ao valor da hora normal = 54,55 € (e não 81,82 € a × 1,5); dia 354,55 €", async () => {
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "21:00")]);
    // A taxa que a folha usa é a hora normal, sem arredondar (300 ÷ 11 × 1)
    expect(ratesFor(p.tabela as any).rateHEA).toBe(HORA_PT);
    expect(ratesFor(p.tabela as any).rateHEB).toBe(HORA_PT);
    const pc = calcProject(p as any);
    expect(pc.calc[0].HEA_min).toBe(120);
    expect(pc.calc[0].HEA_valor).toBe(54.55);
    expect(pc.calc[0].totalDia).toBe(354.55);
  });

  it("HE-B também à hora normal: 7 h → 190,91 € + 1 h → 27,27 €; dia 518,18 €", async () => {
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "03:00")]);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_min).toBe(7 * 60);
    expect(c.HEB_min).toBe(60);
    expect(c.HEA_valor).toBe(190.91);
    expect(c.HEB_valor).toBe(27.27);
    expect(c.totalDia).toBe(518.18);
  });

  it("11 h de hora extra pagam exatamente um dia: 190,91 + 109,09 = 300,00 €; dia 600,00 €", async () => {
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "06:00")]);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_min).toBe(7 * 60);
    expect(c.HEB_min).toBe(4 * 60);
    expect(c.HEA_valor).toBe(190.91);
    expect(c.HEB_valor).toBe(109.09);
    expect(c.totalDia).toBe(600);
  });

  it("as HR não mudam: 2 h de recuperação continuam a 27,2727… × 3 → 163,64 €", async () => {
    const dias = [dia("2026-11-02", "08:00", "21:00"), dia("2026-11-03", "05:00", "12:00")];
    const comEscolha = calcProject((await folhaNova(NORMAL, dias)) as any).calc[0];
    const semEscolha = calcProject((await folhaNova(ACRESCIMO, dias)) as any).calc[0];
    expect(comEscolha.HR_min).toBe(120);
    expect(comEscolha.HR_valor).toBe(163.64);
    expect(semEscolha.HR_valor).toBe(163.64);
  });

  it("a linha de valores (editor e PDF) mostra 27,27 € em HE-A e HE-B e 81,82 € em HR", async () => {
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "21:00")]);
    const pc = calcProject(p as any);
    // PDF: salário · HE-A · HE-B · HR, por esta ordem, na linha de valores
    const pdf = buildPdfHtml(p.perfil as any, p.projeto as any, p.dias, pc.calc, pc.totais as any, p.tabela as any);
    const linha = [300, 27.27, 27.27, 81.82].map((v) => `<td>${fmtMoney(v)}</td>`).join("\\s*");
    expect(pdf).toMatch(new RegExp(linha));
    expect(pdf).toContain(fmtMoney(54.55));
    // Editor HTML: as células editáveis das taxas, a 2 casas
    const ed = buildEditableSheetHtml(p.perfil as any, p.projeto as any, p.dias, pc.calc, pc.totais as any, p.tabela as any);
    expect(ed).toMatch(/data-f="rateHEA" data-c="g_hea">27\.27</);
    expect(ed).toMatch(/data-f="rateHEB" data-c="g_heb">27\.27</);
  });

  it("uma taxa escrita à mão manda sobre a escolha: HE-A a 40 €/h → 2 h = 80 €", async () => {
    const p = await folhaNova({ ...NORMAL, rateHEA: 40 }, [dia("2026-11-02", "08:00", "21:00")]);
    expect(p.tabela.rateHEA).toBe(40);
    expect(ratesFor(p.tabela as any).rateHEB).toBe(HORA_PT);
    expect(calcProject(p as any).calc[0].HEA_valor).toBe(80);
  });

  it("região Itália (H_dia 10): perfil gravado com a região certa → 300 ÷ 10 = 30 €/h; 2 h = 60,00 €", async () => {
    expect(IT.H_dia).toBe(10);
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "21:00")], { regiaoPerfil: IT, regiaoFolha: "it" });
    expect(p.tabela.H_dia).toBe(10);
    expect(ratesFor(p.tabela as any).rateHEA).toBe(30);
    expect(calcProject(p as any).calc[0].HEA_valor).toBe(60);
  });
});

describe("sem a escolha, tudo como antes", () => {
  it("perfil só com salário: taxas vazias, 2 h de HE-A a × 1,5 = 81,82 €; dia 381,82 €", async () => {
    const p = await folhaNova(ACRESCIMO, [dia("2026-11-02", "08:00", "21:00")]);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(p.tabela.rateHEB).toBeUndefined();
    expect(p.tabela.multHEA).toBe(1.5);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_valor).toBe(81.82);
    expect(c.totalDia).toBe(381.82);
  });

  it("dia de 19 h: HE-A 286,36 € + HE-B 54,55 €; dia 640,91 €", async () => {
    const p = await folhaNova(ACRESCIMO, [dia("2026-11-02", "08:00", "03:00")]);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_valor).toBe(286.36);
    expect(c.HEB_valor).toBe(54.55);
    expect(c.totalDia).toBe(640.91);
  });

  it("um perfil antigo (sem os campos novos) grava e abre exatamente igual", () => {
    const antigo: FixasHE = { salarioDia: 300, rateHEA: 45, hDia: 10, refeicao: 12 };
    expect(H.fixasParaGravar(antigo, PT)).toEqual(antigo);
    expect(H.fixasParaEditar(antigo)).toBe(antigo);
    expect(H.modoHE(antigo)).toBe("acrescimo");
    expect(H.fixasParaGravar(undefined, PT)).toBeUndefined();
    expect(H.heDesatualizado(antigo, PT)).toBeNull();
    expect(H.heDesatualizado(antigo, IT)).toBeNull();
  });
});

describe("a escolha no perfil (gravar / abrir)", () => {
  it("gravar escreve a hora normal (sem arredondar) e marca-a; abrir volta a deixá-la automática", () => {
    const gravado = H.fixasParaGravar(NORMAL, PT);
    expect(gravado).toEqual({
      salarioDia: 300, multHEA: 1, multHEB: 1,
      rateHEA: HORA_PT, rateHEB: HORA_PT,
      heAuto: { rateHEA: HORA_PT, rateHEB: HORA_PT },
    });
    expect(H.fixasParaEditar(gravado)).toEqual(NORMAL);
    // gravar duas vezes dá o mesmo — e passar pela nuvem (JSON) não estraga a marca
    expect(H.fixasParaGravar(gravado, PT)).toEqual(gravado);
    expect(H.fixasParaEditar(JSON.parse(JSON.stringify(gravado)))).toEqual(NORMAL);
  });

  it("a taxa acompanha o salário do perfil: 330 € ÷ 11 h = 30 €/h", () => {
    const aberto = H.fixasParaEditar(H.fixasParaGravar(NORMAL, PT));
    const gravado = H.fixasParaGravar({ ...aberto, salarioDia: 330 }, PT);
    expect(gravado.rateHEA).toBe(30);
    expect(gravado.rateHEB).toBe(30);
  });

  it("e o horário base: 300 € ÷ 10 h = 30 €/h; sem horário no perfil vale o da região (ES: 300 ÷ 8 = 37,50)", () => {
    expect(H.fixasParaGravar({ ...NORMAL, hDia: 10 }, PT).rateHEA).toBe(30);
    const ES = H.baseRegiaoHE(getPreset("es"));
    expect(H.fixasParaGravar(NORMAL, ES).rateHEA).toBe(37.5);
  });

  it("um valor à mão nunca leva marca, nem quando é igual à hora normal", () => {
    const gravado = H.fixasParaGravar({ ...NORMAL, rateHEA: 27.27 }, PT);
    expect(gravado.heAuto).toEqual({ rateHEB: HORA_PT });
    expect(H.fixasParaEditar(gravado).rateHEA).toBe(27.27);
    expect(H.fixasParaEditar(gravado).rateHEB).toBeUndefined();
  });

  it("sem salário não há hora normal: nada é escrito (a escolha fica guardada)", () => {
    const gravado = H.fixasParaGravar({ multHEA: 1, multHEB: 1 }, PT);
    expect(gravado).toEqual({ multHEA: 1, multHEB: 1 });
  });

  it("voltar a 'com acréscimo' apaga a escolha e as taxas automáticas", () => {
    const aberto = H.fixasParaEditar(H.fixasParaGravar(NORMAL, PT));
    const volta = H.comModoHE(aberto, "acrescimo");
    expect(volta).toEqual({ salarioDia: 300 });
    expect(H.fixasParaGravar(volta, PT)).toEqual({ salarioDia: 300 });
    expect(H.modoHE(H.comModoHE(volta, "normal"))).toBe("normal");
  });

  it("placeholders: hora normal 27,27 em HE-A/HE-B; com acréscimo 40,91 / 54,55; HR sempre 81,82", () => {
    expect(H.taxaAutoPerfil(NORMAL, PT, "HEA")).toBe(27.27);
    expect(H.taxaAutoPerfil(NORMAL, PT, "HEB")).toBe(27.27);
    expect(H.taxaAutoPerfil(NORMAL, PT, "HR")).toBe(81.82);
    expect(H.taxaAutoPerfil(ACRESCIMO, PT, "HEA")).toBe(40.91);
    expect(H.taxaAutoPerfil(ACRESCIMO, PT, "HEB")).toBe(54.55);
    expect(H.taxaAutoPerfil(ACRESCIMO, PT, "HR")).toBe(81.82);
    expect(H.taxaAutoPerfil({}, PT, "HEA")).toBeUndefined();
  });
});

describe("taxa gravada desatualizada (região mudada, versão antiga da app)", () => {
  it("gravado em Portugal (300 ÷ 11) e aberto com a região Itália: a nova é 300 ÷ 10 = 30 €/h", () => {
    const gravadoPT = H.fixasParaGravar(NORMAL, PT);
    expect(H.heDesatualizado(gravadoPT, PT)).toBeNull();
    expect(H.heDesatualizado(gravadoPT, IT)).toEqual({ qual: "HEA", guardada: HORA_PT, nova: 30 });
    // Gravar outra vez (o Guardar do ecrã) põe-no em dia
    const regravado = H.fixasParaGravar(H.fixasParaEditar(gravadoPT), IT);
    expect(regravado.rateHEA).toBe(30);
    expect(H.heDesatualizado(regravado, IT)).toBeNull();
  });

  it("uma versão antiga mudou o salário para 330 e deixou a taxa: a nova é 330 ÷ 11 = 30 €/h", () => {
    const antigaMexeu = { ...H.fixasParaGravar(NORMAL, PT), salarioDia: 330 };
    expect(H.heDesatualizado(antigaMexeu, PT)).toEqual({ qual: "HEA", guardada: HORA_PT, nova: 30 });
  });

  it("uma taxa gravada a 2 casas (27,27, a versão anterior desta escolha) também conta como desatualizada", () => {
    const r2: FixasHE = { ...NORMAL, rateHEA: 27.27, rateHEB: 27.27, heAuto: { rateHEA: 27.27, rateHEB: 27.27 } };
    expect(H.heDesatualizado(r2, PT)).toEqual({ qual: "HEA", guardada: 27.27, nova: HORA_PT });
  });

  it("valores à mão e perfis sem escolha nunca estão desatualizados", () => {
    expect(H.heDesatualizado({ ...NORMAL, rateHEA: 40, rateHEB: 41 }, IT)).toBeNull();
    expect(H.heDesatualizado({ salarioDia: 300, rateHEA: 27.27, rateHEB: 27.27 }, IT)).toBeNull();
    expect(H.heDesatualizado(undefined, PT)).toBeNull();
  });
});

describe("quem já escrevia a hora normal à mão", () => {
  it("HE-A = HE-B = 27,27 escritas à mão (300 ÷ 11 a um cêntimo) → sugere a escolha", () => {
    const legado: FixasHE = { salarioDia: 300, rateHEA: 27.27, rateHEB: 27.27 };
    expect(H.modoHE(legado)).toBe("acrescimo");
    expect(H.pareceHoraNormal(legado, PT)).toBe(true);
    // 27,30 está a 2,7 cêntimos da hora normal: é outro valor, não se sugere
    expect(H.pareceHoraNormal({ ...legado, rateHEB: 27.3 }, PT)).toBe(false);
    expect(H.pareceHoraNormal({ salarioDia: 300, rateHEA: 27.27 }, PT)).toBe(false);
    expect(H.pareceHoraNormal({ ...legado, multHEA: 1, multHEB: 1 }, PT)).toBe(false);
  });

  it("passar para a escolha apaga os valores à mão; gravado dá a hora normal exata", () => {
    const legado: FixasHE = { salarioDia: 300, rateHEA: 27.27, rateHEB: 27.27, refeicao: 12 };
    const passou = H.paraHoraNormal(legado);
    expect(passou).toEqual({ salarioDia: 300, refeicao: 12, multHEA: 1, multHEB: 1 });
    expect(H.fixasParaGravar(passou, PT).rateHEA).toBe(HORA_PT);
  });
});

describe("heParaTabela — a peça que o createProject usa (ligada em projects.ts)", () => {
  // A tabela da folha nova com o que heParaTabela devolve por cima (anterior =
  // a região). Desde a ligação o createProject já o faz; aplicar outra vez dá
  // o mesmo. A prova pelo createProject sozinho está mais abaixo.
  async function folhaLigada(fixasDoEcra: FixasHE, dias: Dia[], regiao = "pt") {
    const p = await folhaNova(fixasDoEcra, dias, { regiaoFolha: regiao });
    const base = H.baseRegiaoHE(getPreset(regiao));
    const gravadas = H.fixasParaGravar(fixasDoEcra, PT); // gravado em Portugal
    return { ...p, tabela: { ...p.tabela, ...H.heParaTabela(gravadas, { multHEA: base.multHEA, multHEB: base.multHEB }) } };
  }

  it("com a escolha: multiplicador × 1 e SEM a taxa materializada; 2 h = 54,55 €", async () => {
    const p = await folhaLigada(NORMAL, [dia("2026-11-02", "08:00", "21:00")]);
    expect(p.tabela.multHEA).toBe(1);
    expect(p.tabela.multHEB).toBe(1);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(p.tabela.rateHEB).toBeUndefined();
    expect(calcProject(p as any).calc[0].HEA_valor).toBe(54.55);
  });

  it("acompanha o salário mudado NA FOLHA: 400 ÷ 11 = 36,3636… → 2 h = 72,73 €; dia 472,73 €", async () => {
    const p = await folhaLigada(NORMAL, [dia("2026-11-02", "08:00", "21:00")]);
    const c = calcProject({ ...p, tabela: { ...p.tabela, salarioDia: 400 } } as any).calc[0];
    expect(c.HEA_valor).toBe(72.73);
    expect(c.totalDia).toBe(472.73);
  });

  it("e o salário de UM dia (override): 400 nesse dia → 72,73 €; dia 472,73 €", async () => {
    const p = await folhaLigada(NORMAL, [{ ...dia("2026-11-02", "08:00", "21:00"), salarioDia: 400 }]);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_valor).toBe(72.73);
    expect(c.totalDia).toBe(472.73);
  });

  it("e a região de quem cria a folha: perfil gravado em Portugal, folha em Itália → 30 €/h, 2 h = 60,00 €", async () => {
    const p = await folhaLigada(NORMAL, [dia("2026-11-02", "08:00", "21:00")], "it");
    expect(p.tabela.H_dia).toBe(10);
    expect(calcProject(p as any).calc[0].HEA_valor).toBe(60);
  });

  it("sem a escolha devolve o que o createProject já faz (taxa do perfil, multiplicador da região)", async () => {
    expect(H.heParaTabela({ salarioDia: 300 }, { multHEA: 1.5, multHEB: 2 })).toEqual({
      multHEA: 1.5, multHEB: 2, rateHEA: undefined, rateHEB: undefined,
    });
    expect(H.heParaTabela({ salarioDia: 300, rateHEA: 45 }, { multHEA: 1.5, multHEB: 2 })).toEqual({
      multHEA: 1.5, multHEB: 2, rateHEA: 45, rateHEB: undefined,
    });
    const p = await folhaLigada(ACRESCIMO, [dia("2026-11-02", "08:00", "21:00")]);
    expect(calcProject(p as any).calc[0].HEA_valor).toBe(81.82);
  });

  it("duplicar para outro perfil: com a escolha não herda a taxa × 1,5 do original; sem ela, como hoje", () => {
    const original = { multHEA: 1.5, multHEB: 2, rateHEA: 40.91, rateHEB: 54.55 };
    expect(H.heParaTabela(H.fixasParaGravar(NORMAL, PT), original)).toEqual({
      multHEA: 1, multHEB: 1, rateHEA: undefined, rateHEB: undefined,
    });
    // escrito à mão no perfil de destino: vai e manda
    expect(H.heParaTabela(H.fixasParaGravar({ ...NORMAL, rateHEA: 30 }, PT), original)).toEqual({
      multHEA: 1, multHEB: 1, rateHEA: 30, rateHEB: undefined,
    });
    // sem escolha: `fixas.rateHEA ?? original.tabela.rateHEA`, como sempre
    expect(H.heParaTabela({ salarioDia: 300 }, original)).toEqual(original);
  });
});

describe("condições de trabalho (saem no PDF)", () => {
  const LINGUAS = ["pt", "en", "es", "fr", "de", "it", "nl", "pl"];

  it("em cada uma das 8 línguas do modelo só as caixas HE-A e HE-B falam em × 1,5 / × 2", () => {
    for (const l of LINGUAS) {
      const modelo = condBoxesFor(l);
      const comMult = H.condComAcrescimo(modelo);
      expect(comMult.map((b) => modelo.indexOf(b)), l).toEqual([0, 1]);
    }
  });

  it("'hora normal' troca (x1,5) e (x2) por (x1) só nessas frases; as HR (x3) ficam; e desfaz-se", () => {
    for (const l of LINGUAS) {
      const modelo = condBoxesFor(l);
      const trocado = H.condParaModo(modelo, "normal")!;
      expect(trocado, l).not.toBeNull();
      expect(trocado[0].texto, l).toContain("(x1)");
      expect(trocado[1].texto, l).toContain("(x1)");
      expect(trocado[0].texto, l).not.toMatch(/x1[,.]5/);
      expect(trocado[1].texto, l).not.toContain("(x2)");
      expect(trocado.slice(2), l).toEqual(modelo.slice(2));
      expect(H.condComAcrescimo(trocado), l).toEqual([]);
      // voltar a "com acréscimo" repõe o modelo tal e qual
      expect(H.condParaModo(trocado, "acrescimo"), l).toEqual(modelo);
    }
    expect(H.condParaModo(condBoxesFor("pt"), "normal")![0].texto).toBe(
      "* São cobradas Horas Extra A (x1), a partir do início da 12ª hora de trabalho."
    );
  });

  it("texto escrito pela pessoa só se assinala, não se troca (pode ser outro × 2)", () => {
    const proprio = [{ titulo: "FERIADOS", texto: "* Domingos e feriados x2." }];
    expect(H.condComAcrescimo(proprio)).toHaveLength(1);
    expect(H.condParaModo(proprio, "normal")).toBeNull();
    // nem x3 (HR), nem x2,5, nem x25 contam
    expect(H.condComAcrescimo([{ titulo: "", texto: "HR (x3), cinema x2,5, lote x25" }])).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A LIGAÇÃO (1.2.3): o createProject e o "Duplicar para outro perfil" leem a
// escolha do perfil (heParaTabela). Tudo pelo createProject de verdade, sem
// montar a tabela à mão. Região Portugal (H_dia 11, × 1,5 / × 2 / × 3), regras
// por omissão (HE-A depois da 11.ª hora, HE-B depois da 18.ª).
//
//   Perfil "hora normal", salário 300 → a folha leva multHEA = multHEB = 1 e
//   NENHUMA taxa €/h; o motor faz salário DA FOLHA ÷ H_dia DA FOLHA × 1.
//     2 h de HE-A (08:00–21:00 = 13 h − 11): 300 ÷ 11 × 2 = 54,5454… → 54,55 €
//       (a × 1,5 seriam 81,82 €) → dia 354,55 €
//     salário da folha mudado para 400: 400 ÷ 11 × 2 = 72,7272… → 72,73 €
//       → dia 472,73 € (com a taxa materializada do perfil ficavam 54,55 €)
//     dia de 19 h com a folha a 400: HE-A 7 × 400 ÷ 11 = 254,5454… → 254,55 €
//       HE-B 1 × 400 ÷ 11 = 36,3636… → 36,36 € → dia 400 + 254,55 + 36,36 = 690,91 €
//     folha criada num aparelho na região Itália (H_dia 10), perfil gravado em
//       Portugal: 300 ÷ 10 × 2 = 60,00 € → dia 360,00 € (com a taxa gravada,
//       300 ÷ 11, ficavam 54,55 €)
// ─────────────────────────────────────────────────────────────────────────────

/** O que o openEditHtml (app/projects/[id].tsx) faz na 1.ª abertura do editor
 *  no telemóvel: grava as taxas em falta, arredondadas, com a mesma regra. */
function abreEditor<P extends { tabela: any }>(p: P): P {
  const R0 = ratesFor(p.tabela);
  const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const patch: any = {};
  if (H.semeiaTaxaHE(p.tabela, "HEA")) patch.rateHEA = round2(R0.rateHEA);
  if (H.semeiaTaxaHE(p.tabela, "HEB")) patch.rateHEB = round2(R0.rateHEB);
  if (p.tabela.rateHR == null) patch.rateHR = round2(R0.rateHR);
  return { ...p, tabela: { ...p.tabela, ...patch } };
}

describe("createProject com a escolha: a folha leva o × 1, não a taxa", () => {
  it("× 1 e nenhuma taxa de HE na folha (as HR ficam a × 3); 2 h de HE-A = 54,55 €; dia 354,55 €", async () => {
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "21:00")]);
    expect(p.tabela.multHEA).toBe(1);
    expect(p.tabela.multHEB).toBe(1);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(p.tabela.rateHEB).toBeUndefined();
    expect(p.tabela.multHR).toBe(3);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_min).toBe(120);
    expect(c.HEA_valor).toBe(54.55);
    expect(c.totalDia).toBe(354.55);
  });

  it("salário mudado NA FOLHA para 400: 2 h = 400 ÷ 11 × 2 = 72,73 €; dia 472,73 €", async () => {
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "21:00")]);
    const c = calcProject({ ...p, tabela: { ...p.tabela, salarioDia: 400 } } as any).calc[0];
    expect(c.HEA_valor).toBe(72.73);
    expect(c.totalDia).toBe(472.73);
  });

  it("dia de 19 h com a folha a 400: HE-A 254,55 € + HE-B 36,36 €; dia 690,91 €", async () => {
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "03:00")]);
    const c = calcProject({ ...p, tabela: { ...p.tabela, salarioDia: 400 } } as any).calc[0];
    expect(c.HEA_valor).toBe(254.55);
    expect(c.HEB_valor).toBe(36.36);
    expect(c.totalDia).toBe(690.91);
  });

  it("salário de UM dia (override a 400): 2 h = 72,73 €; dia 472,73 €", async () => {
    const p = await folhaNova(NORMAL, [{ ...dia("2026-11-02", "08:00", "21:00"), salarioDia: 400 }]);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_valor).toBe(72.73);
    expect(c.totalDia).toBe(472.73);
  });

  it("região de quem cria: perfil gravado em Portugal, folha criada em Itália → 300 ÷ 10 × 2 = 60,00 €; dia 360,00 €", async () => {
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "21:00")], { regiaoFolha: "it" });
    expect(p.tabela.H_dia).toBe(10);
    expect(p.tabela.multHEA).toBe(1);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_valor).toBe(60);
    expect(c.totalDia).toBe(360);
  });

  it("uma taxa à mão no perfil continua a mandar: HE-B 50 €/h, HE-A a × 1 → dia de 19 h 300 + 190,91 + 50,00 = 540,91 €", async () => {
    // HE-A 7 × 300 ÷ 11 = 190,9090… → 190,91 · HE-B 1 × 50 = 50,00
    const p = await folhaNova({ ...NORMAL, rateHEB: 50 }, [dia("2026-11-02", "08:00", "03:00")]);
    expect(p.tabela.multHEA).toBe(1);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(p.tabela.rateHEB).toBe(50);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_valor).toBe(190.91);
    expect(c.HEB_valor).toBe(50);
    expect(c.totalDia).toBe(540.91);
  });

  it("a folha de CINEMA não muda com a escolha da publicidade: × 1,5 / × 2 / × 2,5, sem taxas", async () => {
    mem.set("profiles:list:v1", JSON.stringify([{ id: "p1", nome: "Ana", fixas: H.fixasParaGravar(NORMAL, PT) }]));
    mem.set("profiles:activeId:v1", "p1");
    const p = (await getProject(await createProject({ mes: 11, ano: 2026, formato: "cinema" })))!;
    expect(p.formato).toBe("cinema");
    expect(p.tabela.multHEA).toBe(1.5);
    expect(p.tabela.multHEB).toBe(2);
    expect(p.tabela.multHR).toBe(2.5);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(p.tabela.rateHEB).toBeUndefined();
  });
});

describe("sem a escolha, a folha nova é exatamente a de antes", () => {
  it("só salário: a tabela inteira é a de sempre (região PT, regras por omissão, nenhuma taxa)", async () => {
    const p = await folhaNova(ACRESCIMO, []);
    expect(p.tabela).toEqual({
      salarioDia: 300, H_dia: 11, descanso_min: 11, multHEA: 1.5, multHEB: 2, multHR: 3,
      limiar_A: 11, limiar_B: 18, limiar_HR: 10,
      ajudas: { refeicao: 0, viatura: 0, material: 0, telefone: 0, perDiem: 0 },
    });
  });

  it("taxas à mão no perfil (45 / 60) vão para a folha e mandam: dia de 19 h = 300 + 315 + 60 = 675,00 €", async () => {
    // HE-A 7 × 45 = 315,00 · HE-B 1 × 60 = 60,00
    const p = await folhaNova({ salarioDia: 300, rateHEA: 45, rateHEB: 60 }, [dia("2026-11-02", "08:00", "03:00")]);
    expect(p.tabela.rateHEA).toBe(45);
    expect(p.tabela.rateHEB).toBe(60);
    expect(p.tabela.multHEA).toBe(1.5);
    expect(p.tabela.multHEB).toBe(2);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_valor).toBe(315);
    expect(c.HEB_valor).toBe(60);
    expect(c.totalDia).toBe(675);
  });

  it("perfil sem nada: × 1,5 / × 2 da região e nenhuma taxa", async () => {
    const p = await folhaNova({}, []);
    expect(p.tabela.multHEA).toBe(1.5);
    expect(p.tabela.multHEB).toBe(2);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(p.tabela.rateHEB).toBeUndefined();
  });
});

describe("versões antigas da app (bundle em cache antes da OTA)", () => {
  it("o perfil continua a guardar a taxa materializada (300 ÷ 11, sem arredondar): a folha que uma versão antiga cria com ela paga os mesmos 54,55 €", async () => {
    const gravadas = H.fixasParaGravar(NORMAL, PT);
    expect(gravadas.rateHEA).toBe(HORA_PT);
    expect(gravadas.rateHEB).toBe(HORA_PT);
    // O createProject antigo: `rateHEA: fixas.rateHEA, rateHEB: fixas.rateHEB`
    // e os multiplicadores da região (não conhecia a escolha)
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "21:00")]);
    const antiga = { ...p, tabela: { ...p.tabela, multHEA: 1.5, multHEB: 2, rateHEA: gravadas.rateHEA, rateHEB: gravadas.rateHEB } };
    const c = calcProject(antiga as any).calc[0];
    expect(c.HEA_valor).toBe(54.55);
    expect(c.totalDia).toBe(354.55);
  });

  it("uma versão antiga a abrir a folha nova lê o × 1 da tabela: a semente dela (sempre a 2 casas) dá 27,27, não 40,91", async () => {
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "21:00")]);
    // round2(300 ÷ 11 × 1 = 27,2727…) = 27,27 — a × 1,5 seria 40,91
    expect(Math.round(ratesFor(p.tabela as any).rateHEA * 100) / 100).toBe(27.27);
    expect(Math.round(ratesFor(p.tabela as any).rateHEB * 100) / 100).toBe(27.27);
  });
});

describe("a semente do editor (1.ª abertura no telemóvel)", () => {
  it("com × 1 não semeia HE-A/HE-B: aberto o editor, mudar o salário para 400 continua a dar 72,73 €; dia 472,73 €", async () => {
    const p = await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "21:00")]);
    expect(H.semeiaTaxaHE(p.tabela, "HEA")).toBe(false);
    expect(H.semeiaTaxaHE(p.tabela, "HEB")).toBe(false);
    const aberta = abreEditor(p);
    expect(aberta.tabela.rateHEA).toBeUndefined();
    expect(aberta.tabela.rateHEB).toBeUndefined();
    // as HR semeiam-se como sempre: round2(300 ÷ 11 × 3 = 81,8181…) = 81,82
    expect(aberta.tabela.rateHR).toBe(81.82);
    const c = calcProject({ ...aberta, tabela: { ...aberta.tabela, salarioDia: 400 } } as any).calc[0];
    expect(c.HEA_valor).toBe(72.73);
    expect(c.totalDia).toBe(472.73);
  });

  it("e sem a taxa arredondada, 11 h de hora extra continuam a dar um dia: 190,91 + 109,09 = 300,00 €; dia 600,00 €", async () => {
    // Semeada a 27,27 seriam 7 × 27,27 = 190,89 + 4 × 27,27 = 109,08 → 299,97 €
    const aberta = abreEditor(await folhaNova(NORMAL, [dia("2026-11-02", "08:00", "06:00")]));
    const c = calcProject(aberta as any).calc[0];
    expect(c.HEA_valor).toBe(190.91);
    expect(c.HEB_valor).toBe(109.09);
    expect(c.totalDia).toBe(600);
  });

  it("com acréscimo semeia como sempre: 40,91 / 54,55 / 81,82; 2 h = 2 × 40,91 = 81,82 €", async () => {
    // round2(300 ÷ 11 × 1,5 = 40,9090…) = 40,91 · round2(× 2 = 54,5454…) = 54,55 · round2(× 3) = 81,82
    const aberta = abreEditor(await folhaNova(ACRESCIMO, [dia("2026-11-02", "08:00", "21:00")]));
    expect(aberta.tabela.rateHEA).toBe(40.91);
    expect(aberta.tabela.rateHEB).toBe(54.55);
    expect(aberta.tabela.rateHR).toBe(81.82);
    expect(calcProject(aberta as any).calc[0].HEA_valor).toBe(81.82);
  });

  it("uma taxa já escrita nunca se semeia; folhas antigas sem multiplicador semeiam como sempre", () => {
    expect(H.semeiaTaxaHE({ multHEA: 1, rateHEA: 40 }, "HEA")).toBe(false);
    expect(H.semeiaTaxaHE({ multHEA: 1.5, rateHEA: 40 }, "HEA")).toBe(false);
    expect(H.semeiaTaxaHE({ multHEA: 1.5 }, "HEA")).toBe(true);
    expect(H.semeiaTaxaHE({}, "HEA")).toBe(true);
    expect(H.semeiaTaxaHE({}, "HEB")).toBe(true);
  });
});

describe("duplicar para outro perfil, com a escolha ligada", () => {
  // Ana: hora normal, 300 €/dia · Rui: com acréscimo, 250 €/dia · Marta: com
  // acréscimo, 300 €/dia. Gravados como o ecrã do perfil os grava.
  function gravaPerfis() {
    const perfil = (id: string, nome: string, fixas: FixasHE) => ({
      id, nome, email: "", telefone: "", departamento: "", funcao: "", fixas: H.fixasParaGravar(fixas, PT),
    });
    mem.set("profiles:list:v1", JSON.stringify([
      perfil("ana", "Ana", NORMAL),
      perfil("rui", "Rui", { salarioDia: 250 }),
      perfil("marta", "Marta", ACRESCIMO),
    ]));
  }

  /** Folha criada pelo perfil `de` (createProject), gravada como ficou
   *  (`mexe`: aberta no editor, uma taxa escrita…) e duplicada para `para`. */
  async function duplicada(de: string, para: string, dias: Dia[], mexe: (p: any) => any = (p) => p) {
    gravaPerfis();
    mem.set("profiles:activeId:v1", de);
    const id = await createProject({ mes: 11, ano: 2026 });
    await saveProject(mexe((await getProject(id))!));
    // Os ids são Date.now(): a cópia não pode nascer no mesmo milissegundo
    await new Promise((r) => setTimeout(r, 3));
    const novo = await duplicateProjectToProfile(id, para);
    expect(novo).not.toBe(id);
    return { ...(await getProject(novo))!, dias };
  }

  it("Rui → Ana: a folha do Rui aberta no editor (34,09 / 45,45 do salário dele) passa à Ana a × 1, sem as herdar; 2 h = 54,55 €; dia 354,55 €", async () => {
    // Semente do Rui: round2(250 ÷ 11 × 1,5 = 34,0909…) = 34,09 · round2(250 ÷ 11 × 2 = 45,4545…) = 45,45
    const p = await duplicada("rui", "ana", [dia("2026-11-02", "08:00", "21:00")], (o) => {
      const a = abreEditor(o);
      expect(a.tabela.rateHEA).toBe(34.09);
      expect(a.tabela.rateHEB).toBe(45.45);
      return a;
    });
    expect(p.tabela.salarioDia).toBe(300);
    expect(p.tabela.multHEA).toBe(1);
    expect(p.tabela.multHEB).toBe(1);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(p.tabela.rateHEB).toBeUndefined();
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_valor).toBe(54.55);
    expect(c.totalDia).toBe(354.55);
  });

  it("Ana → Rui: o × 1 da Ana não passa a quem cobra acréscimo; volta a × 1,5 / × 2: 2 h = 68,18 €; dia 318,18 €", async () => {
    // 250 ÷ 11 × 1,5 = 34,0909… €/h × 2 h = 68,1818… → 68,18 (a × 1 seriam 45,45 €)
    const p = await duplicada("ana", "rui", [dia("2026-11-02", "08:00", "21:00")], abreEditor);
    expect(p.tabela.salarioDia).toBe(250);
    expect(p.tabela.multHEA).toBe(1.5);
    expect(p.tabela.multHEB).toBe(2);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(p.tabela.rateHEB).toBeUndefined();
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_valor).toBe(68.18);
    expect(c.totalDia).toBe(318.18);
  });

  it("Ana → Rui, dia de 19 h: HE-A 7 × 34,0909… = 238,64 € + HE-B 1 × 45,4545… = 45,45 €; dia 534,09 €", async () => {
    // 7 × 250 × 1,5 ÷ 11 = 238,6363… → 238,64 · 250 × 2 ÷ 11 = 45,4545… → 45,45
    const c = calcProject((await duplicada("ana", "rui", [dia("2026-11-02", "08:00", "03:00")])) as any).calc[0];
    expect(c.HEA_valor).toBe(238.64);
    expect(c.HEB_valor).toBe(45.45);
    expect(c.totalDia).toBe(534.09);
  });

  it("o '?? original' fica: HE-A escrita na folha do Rui (50 €/h, negociada) passa à Marta, que não tem a sua; dia de 19 h = 300 + 350 + 54,55 = 704,55 €", async () => {
    // HE-A 7 × 50 = 350,00 · HE-B 1 × 300 ÷ 11 × 2 = 54,5454… → 54,55
    const p = await duplicada("rui", "marta", [dia("2026-11-02", "08:00", "03:00")], (o) => ({
      ...o, tabela: { ...o.tabela, rateHEA: 50 },
    }));
    expect(p.tabela.rateHEA).toBe(50);
    expect(p.tabela.rateHEB).toBeUndefined();
    expect(p.tabela.multHEA).toBe(1.5);
    const c = calcProject(p as any).calc[0];
    expect(c.HEA_valor).toBe(350);
    expect(c.HEB_valor).toBe(54.55);
    expect(c.totalDia).toBe(704.55);
  });

  it("à Ana, essa taxa não passa: a escolha dela manda, como mandava uma taxa escrita no perfil; 2 h = 54,55 €", async () => {
    const p = await duplicada("rui", "ana", [dia("2026-11-02", "08:00", "21:00")], (o) => ({
      ...o, tabela: { ...o.tabela, rateHEA: 50 },
    }));
    expect(p.tabela.multHEA).toBe(1);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(calcProject(p as any).calc[0].HEA_valor).toBe(54.55);
  });

  it("Marta → Rui, nenhum com a escolha: como antes — × 1,5 / × 2 do original, salário do Rui; 2 h = 68,18 €", async () => {
    const p = await duplicada("marta", "rui", [dia("2026-11-02", "08:00", "21:00")]);
    expect(p.tabela.multHEA).toBe(1.5);
    expect(p.tabela.multHEB).toBe(2);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(p.tabela.salarioDia).toBe(250);
    expect(calcProject(p as any).calc[0].HEA_valor).toBe(68.18);
  });

  it("folha de CINEMA duplicada para a Ana: não muda (× 1,5 / × 2 / × 2,5, sem taxas)", async () => {
    gravaPerfis();
    mem.set("profiles:activeId:v1", "rui");
    const id = await createProject({ mes: 11, ano: 2026, formato: "cinema" });
    await new Promise((r) => setTimeout(r, 3));
    const p = (await getProject(await duplicateProjectToProfile(id, "ana")))!;
    expect(p.formato).toBe("cinema");
    expect(p.tabela.multHEA).toBe(1.5);
    expect(p.tabela.multHEB).toBe(2);
    expect(p.tabela.multHR).toBe(2.5);
    expect(p.tabela.rateHEA).toBeUndefined();
    expect(p.tabela.rateHEB).toBeUndefined();
  });
});
