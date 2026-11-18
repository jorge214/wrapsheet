import { beforeEach, describe, expect, it, vi } from "vitest";

// A folha de exemplo (exemplo: true no blob) fica fora dos totais da app — o
// cartão da página inicial mostrava "A receber 750 €" a quem nunca trabalhou.
// Mas só enquanto está INTACTA (título igual ao filme e os três dias com as
// horas do modelo): copiada, limpa, renomeada ou mexida, é trabalho a sério e
// conta. Senão o trabalho real feito por cima dela sumia dos totais.

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
const { eExemplo, HORAS_EXEMPLO, semExemplo, temMarcaExemplo } = await import("../storage/exemploMarca");
const { calcProject } = await import("../calc/project");

const INDEX = "projects:index:v1";
const ITEM = "projects:item:";

function guarda(p: any) {
  mem.set(ITEM + p.id, JSON.stringify(p));
  const idx = JSON.parse(mem.get(INDEX) ?? "[]");
  idx.push({ id: p.id, nome: p.projeto.titulo, cliente: "", mes: `${String(p.projeto.mes).padStart(2, "0")}/${p.projeto.ano}`, pago: !!p.pago, updatedAt: p.updatedAt });
  mem.set(INDEX, JSON.stringify(idx));
}

const tabela = { salarioDia: 200, H_dia: 11, descanso_min: 11 };
const fiscal = { IRS_percent: 0, IVA_percent: 0 };

// A folha a sério: 1 dia de 08:00 a 18:00 a 200 €/dia, sem impostos — 200 €
// certos (10 h, abaixo das 11 h do dia base: sem horas extra).
function folhaReal(id: string) {
  return {
    id, perfil: {}, projeto: { titulo: "Spot X", filme: "Spot X", produtora: "", mes: 11, ano: 2026 },
    tabela, fiscal, notas: "", condicoes: "", condTitulo: "", pago: false,
    dias: [{ descricao: "Filmagem", data: "2026-11-10", inicio: "08:00", fim: "18:00" }],
    updatedAt: "2026-11-12T10:00:00.000Z",
  };
}

// A folha de exemplo tal como a montarExemplo a deixa: título = filme e os
// três dias com as horas do modelo.
function folhaExemplo(id: string) {
  const titulo = "Exemplo — Spot publicitário";
  return {
    id, exemplo: true, perfil: {}, projeto: { titulo, filme: titulo, produtora: "Produtora de exemplo", mes: 11, ano: 2026 },
    tabela, fiscal, notas: "", condicoes: "", condTitulo: "", pago: false,
    dias: HORAS_EXEMPLO.map(([inicio, fim], i) => ({ descricao: "Filmagem", data: `2026-11-0${i + 5}`, inicio, fim })),
    updatedAt: "2026-11-12T10:00:00.000Z",
  };
}

const valor = (p: any) => calcProject(p).totais.ValorBruto;

beforeEach(() => {
  mem.clear();
  guarda(folhaReal("real"));
  guarda(folhaExemplo("exemplo"));
});

describe("folha de exemplo nos totais", () => {
  it("o mês e o ano contam só a folha a sério (200 €)", async () => {
    const m = await getMonthSummary(11, 2026);
    expect(m.totalValorBruto).toBe(200);
    expect(m.totalReceberLiquido).toBe(200);
    expect(m.totalProjects).toBe(1);
    expect(m.activeProjects).toBe(1);
    expect((await getYearSummary(2026)).totalValorBruto).toBe(200);
  });

  it("uma cópia da folha de exemplo já é trabalho a sério e conta", async () => {
    const id = await duplicateProject("exemplo");
    const copia = await getProject(id);
    expect(temMarcaExemplo(copia)).toBe(false);
    expect(eExemplo(await getProject("exemplo"))).toBe(true); // o original continua exemplo
    expect((await getMonthSummary(11, 2026)).totalValorBruto).toBe(200 + valor(copia));
  });

  it("dar nome à folha de exemplo tira-lhe a marca e passa a contar", async () => {
    await renameProject("exemplo", "Spot da Vodafone");
    const p = await getProject("exemplo");
    expect(temMarcaExemplo(p)).toBe(false);
    expect((await getMonthSummary(11, 2026)).totalValorBruto).toBe(200 + valor(p));
  });

  it("limpar a folha de exemplo tira-lhe a marca", async () => {
    const limpa = await clearProjectData("exemplo", "Filmagem");
    expect(temMarcaExemplo(limpa)).toBe(false);
    expect(temMarcaExemplo(await getProject("exemplo"))).toBe(false);
  });
});

describe("só conta como exemplo a folha intacta", () => {
  // O que uma versão antiga da app (sem a atualização) pode ter feito à folha
  // de exemplo SEM lhe tirar a marca: tem de voltar a contar.
  it("intacta → exemplo", () => {
    expect(eExemplo(folhaExemplo("e"))).toBe(true);
  });
  it("sem a marca → nunca é exemplo", () => {
    const { exemplo: _x, ...semMarca } = folhaExemplo("e");
    expect(eExemplo(semMarca)).toBe(false);
  });
  it("renomeada, copiada (\" (cópia)\") ou limpa → conta", () => {
    const e = folhaExemplo("e");
    expect(eExemplo({ ...e, projeto: { ...e.projeto, titulo: "Spot da Vodafone" } })).toBe(false);
    expect(eExemplo({ ...e, projeto: { ...e.projeto, titulo: e.projeto.titulo + " (cópia)" } })).toBe(false);
    expect(eExemplo({ ...e, projeto: { ...e.projeto, titulo: "", filme: "" } })).toBe(false);
  });
  it("com horas mudadas ou com mais dias → conta", () => {
    const e = folhaExemplo("e");
    expect(eExemplo({ ...e, dias: e.dias.map((d, i) => (i === 1 ? { ...d, fim: "23:00" } : d)) })).toBe(false);
    expect(eExemplo({ ...e, dias: [...e.dias, { ...e.dias[0], data: "2026-11-20" }] })).toBe(false);
  });
  it("uma folha de exemplo mexida conta nos totais", async () => {
    mem.clear();
    const e = folhaExemplo("exemplo");
    const mexida = { ...e, dias: e.dias.map((d, i) => (i === 0 ? { ...d, inicio: "08:00" } : d)) };
    guarda(mexida);
    expect((await getMonthSummary(11, 2026)).totalValorBruto).toBe(valor(mexida));
  });
  it("semExemplo devolve a própria folha quando não tem marca, e nunca muda o original", () => {
    const real = folhaReal("x");
    expect(semExemplo(real)).toBe(real);
    const ex = folhaExemplo("y");
    const sem = semExemplo(ex);
    expect(temMarcaExemplo(sem)).toBe(false);
    expect(temMarcaExemplo(ex)).toBe(true);
    expect((sem as any).projeto).toBe(ex.projeto);
  });
});
