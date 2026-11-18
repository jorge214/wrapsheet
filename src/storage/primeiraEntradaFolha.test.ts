import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A folha que a primeira entrada cria tem de pagar EXATAMENTE o que a pessoa
// escreveu: o valor vai para o perfil (perfilInicial) e é o createProject de
// sempre que o leva para a folha. Valores à mão:
//   • publicidade, 250 €/dia, 1 dia das 08:00 às 18:00 (10 h, abaixo das 11 h
//     do dia base) → 250 € brutos, sem horas extra;
//   • cinema, 1250 €/semana de 5 dias, 5 dias das 08:00 às 19:00 (11 h = o dia
//     base) e 2 folgas sem horas → 1250/5 × 5 = 1250 € brutos, sem extras.
//     A folha de cinema nasce na semana CORRENTE e um feriado obrigatório nessa
//     semana nasce marcado a dobrar: por isso fixa-se o dia de hoje — uma
//     semana sem feriado (16 a 20/11/2026) e uma com (30/11 a 4/12/2026, com
//     o 1.º de Dezembro numa terça): 4 × 250 + 1 × 250 × 2 = 1500 €.
//     (Sem isto o teste ficava vermelho nas semanas com feriado — revisão de
//     18/11 — e a "correção" fácil era a errada: tirar o feriado a dobrar.)

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
vi.mock("../i18n/i18n", () => ({
  default: { t: (k: string, o?: any) => o?.defaultValue ?? k, language: "pt" },
}));

const { createProject, getProject } = await import("./projects");
const { setActiveProfileId, upsertProfile } = await import("./profile");
const { perfilInicial } = await import("./passosRegras");
const { calcProject } = await import("../calc/project");

beforeEach(() => mem.clear());
afterEach(() => vi.useRealTimers());

/** Hoje é `iso` (só a data: os temporizadores continuam reais). */
function hojeE(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso + "T12:00:00Z"));
}

async function primeiraFolha(formato: "publicidade" | "cinema", valor: number) {
  const perfil = await upsertProfile(perfilInicial("perfil-1", { formato, funcao: "Assistente de Câmara", valor }));
  await setActiveProfileId(perfil.id);
  const id = await createProject(formato === "cinema" ? { formato: "cinema", diasSemana: 5 } : {});
  return (await getProject(id))!;
}

describe("a folha criada pela primeira entrada", () => {
  it("publicidade: 250 €/dia → um dia de 10 h vale 250 €", async () => {
    const p = await primeiraFolha("publicidade", 250);
    expect(p.tabela.salarioDia).toBe(250);
    expect(p.perfil.funcao).toBe("Assistente de Câmara");
    expect(p.profileId).toBe("perfil-1");
    expect(p.dias).toHaveLength(1);
    expect(p.dias[0]).toMatchObject({ inicio: "08:00", fim: "18:00" });
    expect(calcProject(p as any).totais.ValorBruto).toBe(250);
  });

  it("cinema: 1250 €/semana → 5 dias de 11 h valem 1250 €", async () => {
    hojeE("2026-11-18"); // quarta-feira; semana de 16 a 20/11, sem feriados
    const p = await primeiraFolha("cinema", 1250);
    expect(p.formato).toBe("cinema");
    expect(p.tabela.salarioSemana).toBe(1250);
    expect(p.tabela.diasSemana).toBe(5);
    // sem salário ao dia (a leitura da folha guarda-o como 0): quem manda é a semana
    expect(Number(p.tabela.salarioDia) || 0).toBe(0);
    expect(p.dias.filter((d) => !d.folga)).toHaveLength(5);
    expect(calcProject(p as any).totais.ValorBruto).toBe(1250);
  });

  it("cinema numa semana com feriado: o 1.º de Dezembro (terça) nasce a dobrar → 4 × 250 + 2 × 250 = 1500 €", async () => {
    hojeE("2026-12-01");
    const p = await primeiraFolha("cinema", 1250);
    const feriados = p.dias.filter((d: any) => d.feriado).map((d) => d.data);
    expect(feriados).toEqual(["2026-12-01"]);
    // dia = 1250 ÷ 5 = 250 €; o feriado paga 250 × 2 (multFolga) = 500 €
    expect(calcProject(p as any).totais.ValorBruto).toBe(1500);
  });
});
