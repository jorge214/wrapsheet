import { beforeEach, describe, expect, it, vi } from "vitest";

// A folha de exemplo (exemplo: true no blob) fica fora dos totais da app — o
// cartão da página inicial mostrava "A receber 750 €" a quem nunca trabalhou.
// Mas deixa de ser exemplo quando é usada a sério: copiada, limpa ou renomeada.
// Senão o trabalho real feito por cima dela sumia dos totais.

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

const { getMonthSummary, getYearSummary } = await import("./monthSummary");
const { clearProjectData, duplicateProject, getProject, renameProject } = await import("../storage/projects");
const { eExemplo, semExemplo } = await import("../storage/exemploMarca");

const INDEX = "projects:index:v1";
const ITEM = "projects:item:";

function guarda(p: any) {
  mem.set(ITEM + p.id, JSON.stringify(p));
  const idx = JSON.parse(mem.get(INDEX) ?? "[]");
  idx.push({ id: p.id, nome: p.projeto.titulo, cliente: "", mes: `${String(p.projeto.mes).padStart(2, "0")}/${p.projeto.ano}`, pago: !!p.pago, updatedAt: p.updatedAt });
  mem.set(INDEX, JSON.stringify(idx));
}

// 1 dia de 08:00 a 18:00 a 200 €/dia, sem impostos: 200 € certos, sem horas extra.
function folha(id: string, extra: Record<string, unknown> = {}) {
  return {
    id, perfil: {}, projeto: { titulo: id, filme: "", produtora: "", mes: 11, ano: 2026 },
    tabela: { salarioDia: 200, H_dia: 11, descanso_min: 11 },
    fiscal: { IRS_percent: 0, IVA_percent: 0 }, notas: "", condicoes: "", condTitulo: "", pago: false,
    dias: [{ descricao: "Filmagem", data: "2026-11-10", inicio: "08:00", fim: "18:00" }],
    updatedAt: "2026-11-12T10:00:00.000Z",
    ...extra,
  };
}

beforeEach(() => {
  mem.clear();
  guarda(folha("real"));
  guarda(folha("exemplo", { exemplo: true }));
});

describe("folha de exemplo nos totais", () => {
  it("o mês e o ano contam só a folha a sério (200 €, não 400 €)", async () => {
    const m = await getMonthSummary(11, 2026);
    expect(m.totalValorBruto).toBe(200);
    expect(m.totalReceberLiquido).toBe(200);
    expect(m.totalProjects).toBe(1);
    expect(m.activeProjects).toBe(1);
    const y = await getYearSummary(2026);
    expect(y.totalValorBruto).toBe(200);
  });

  it("uma cópia da folha de exemplo já é trabalho a sério e conta", async () => {
    const id = await duplicateProject("exemplo");
    expect(eExemplo(await getProject(id))).toBe(false);
    expect(eExemplo(await getProject("exemplo"))).toBe(true); // o original continua exemplo
    expect((await getMonthSummary(11, 2026)).totalValorBruto).toBe(400);
  });

  it("dar nome à folha de exemplo tira-lhe a marca", async () => {
    await renameProject("exemplo", "Spot da Vodafone");
    expect(eExemplo(await getProject("exemplo"))).toBe(false);
    expect((await getMonthSummary(11, 2026)).totalValorBruto).toBe(400);
  });

  it("limpar a folha de exemplo tira-lhe a marca", async () => {
    const limpa = await clearProjectData("exemplo", "Filmagem");
    expect(eExemplo(limpa)).toBe(false);
    expect(eExemplo(await getProject("exemplo"))).toBe(false);
  });

  it("semExemplo devolve a própria folha quando não é exemplo, e nunca muda o original", () => {
    const real = folha("x");
    expect(semExemplo(real)).toBe(real);
    const ex = folha("y", { exemplo: true });
    const sem = semExemplo(ex);
    expect(eExemplo(sem)).toBe(false);
    expect(eExemplo(ex)).toBe(true);
    expect((sem as any).projeto).toBe(ex.projeto);
  });
});
