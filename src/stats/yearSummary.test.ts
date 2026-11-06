import { beforeEach, describe, expect, it, vi } from "vitest";

// Totais fiscais da vista ANO do Dashboard. O IRS retido e o IVA do ano são o
// que um freelancer confere com o Portal das Finanças / e-fatura na declaração
// anual — por isso o ano tem de dar EXATAMENTE a soma dos 12 meses que o mesmo
// ecrã mostra, com a mesma regra fiscal (fiscal da folha, perfil ativo, pagos e
// arquivados incluídos, Segurança Social só no cinema).

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

const { getMonthSummary, getYearSummary } = await import("./monthSummary");

const INDEX = "projects:index:v1";
const ITEM = "projects:item:";
const ARCH_INDEX = "projects:archived:index:v1";
const ARCH_ITEM = "projects:archived:item:";

const r2 = (n: number) => Math.round(n * 100) / 100;

function dia(data: string, inicio: string, fim: string) {
  return { descricao: "Filmagem", data, inicio, fim };
}

// Grava uma folha como a app a grava: blob em projects:item:<id> (ou no
// arquivo) e o resumo no índice correspondente.
function guarda(p: any, arquivado = false) {
  mem.set((arquivado ? ARCH_ITEM : ITEM) + p.id, JSON.stringify(p));
  const key = arquivado ? ARCH_INDEX : INDEX;
  const idx = JSON.parse(mem.get(key) ?? "[]");
  idx.push({
    id: p.id, nome: p.projeto.titulo, cliente: "",
    mes: `${String(p.projeto.mes).padStart(2, "0")}/${p.projeto.ano}`,
    pago: !!p.pago, profileId: p.profileId, updatedAt: "2026-11-01T10:00:00.000Z",
  });
  mem.set(key, JSON.stringify(idx));
}

function publicidade(id: string, o: { profileId?: string; mes: number; ano: number; salarioDia: number; fiscal: any; dias: any[]; pago?: boolean }) {
  return {
    id, profileId: o.profileId, perfil: {}, projeto: { titulo: id, mes: o.mes, ano: o.ano },
    tabela: { salarioDia: o.salarioDia, H_dia: 11, descanso_min: 11 },
    fiscal: o.fiscal, notas: "", condicoes: "", condTitulo: "", pago: !!o.pago,
    dias: o.dias, updatedAt: "2026-11-01T10:00:00.000Z",
  };
}

// ── Projetos de exemplo (perfil ativo "A", ano de 2026) ──────────────────────
//
// Regras do motor (tabela de referência do setor, publicidade): o salário-dia
// cobre 11h; hora-base = salário ÷ 11; HE-A (11h–18h) a ×1,5; recuperação (HR)
// a ×3 por cada hora de descanso abaixo das 11h entre dois dias seguidos.
// Impostos sobre o bruto do projeto, cada um arredondado ao cêntimo:
// líquido = bruto − IRS − SS + IVA.

// P1 — março, por receber, fiscal 25% IRS / 23% IVA.
//   Salário 220 € → hora-base 20 € → HE-A 30 €/h.
//   02/03 08:00–21:00 = 13h → 2h de HE-A = 60 € → dia 280 €
//   04/03 08:00–18:00 = 10h → 220 € (não é o dia seguinte: sem recuperação)
//   Bruto 500 € · IRS 125,00 · IVA 115,00 · líquido 490,00 · extra 2h
const P1 = publicidade("p1", {
  profileId: "A", mes: 3, ano: 2026, salarioDia: 220,
  fiscal: { IRS_percent: 25, IVA_percent: 23 },
  dias: [dia("2026-03-02", "08:00", "21:00"), dia("2026-03-04", "08:00", "18:00")],
});

// P2 — março, PAGO e ARQUIVADO, fiscal antigo em decimais { irs: 0.2, iva: 0.23 }
// (normalizePercent: 0,2 → 20%, 0,23 → 23%).
//   Salário 330 € → hora-base 30 € → HE-A 45 €/h, HR 90 €/h.
//   10/03 08:00–23:00 = 15h → 4h de HE-A = 180 €; descanso até 11/03 08:00 = 9h
//         → faltam 2h para as 11h → HR 2h = 180 € → dia 330+180+180 = 690 €
//   11/03 08:00–19:00 = 11h → 330 €
//   Bruto 1020 € · IRS 20% 204,00 · IVA 23% 234,60 · líquido 1050,60 · extra 4h+2h = 6h
const P2 = publicidade("p2", {
  profileId: "A", mes: 3, ano: 2026, salarioDia: 330, pago: true,
  fiscal: { irs: 0.2, iva: 0.23 },
  dias: [dia("2026-03-10", "08:00", "23:00"), dia("2026-03-11", "08:00", "19:00")],
});

// P3 — junho, CINEMA, por receber, 25% IRS / 23% IVA / 11% Segurança Social.
//   Semana 1000 € ÷ 5 dias = 200 €/dia; ÷ 10h = 20 €/h → HE-A ×1,5 = 30 €/h.
//   01/06 08:00–20:00 = 12h → 1h de HE-A (acima das 11h) = 30 € → dia 230 €
//   02/06 08:00–18:00 = 10h → 200 €; descanso 01→02 = 12h ≥ 11h → sem HR
//   Sem início da semana seguinte → recuperação entre semanas não se cobra.
//   Bruto 430 € · IRS 107,50 · IVA 98,90 · SS 47,30
//   líquido 430 − 107,50 − 47,30 + 98,90 = 374,10 · extra 1h
//   (a SS entra no líquido mas não no IRS nem no IVA: os dois são sobre o bruto)
const P3 = {
  id: "p3", profileId: "A", formato: "cinema", perfil: {},
  projeto: { titulo: "Semana 23", mes: 6, ano: 2026 },
  tabela: { salarioDia: 0, salarioSemana: 1000, diasSemana: 5, horasBase: 10, H_dia: 11, descanso_min: 11, multFolga: 2 },
  fiscal: { IRS_percent: 25, IVA_percent: 23, SS_percent: 11 },
  notas: "", condicoes: "", condTitulo: "", pago: false,
  dias: [dia("2026-06-01", "08:00", "20:00"), dia("2026-06-02", "08:00", "18:00")],
  updatedAt: "2026-11-01T10:00:00.000Z",
};

// P6 — novembro, folha LEGADA sem profileId (conta para qualquer perfil, ver
// belongsToProfile), fiscal com as chaves antigas { irs: 25, iva: 0 } — isento
// de IVA (art. 53.º do CIVA).
//   Salário 150 €, 03/11 08:00–18:00 = 10h → 150 €
//   Bruto 150 € · IRS 37,50 · IVA 0,00 · líquido 112,50 · extra 0h
const P6 = publicidade("p6", {
  mes: 11, ano: 2026, salarioDia: 150,
  fiscal: { irs: 25, iva: 0 },
  dias: [dia("2026-11-03", "08:00", "18:00")],
});

// P4 — setembro, OUTRO perfil ("B"): fora das contas do perfil A.
//   1000 € · IRS 25% 250,00 · IVA 23% 230,00 · líquido 980,00
const P4 = publicidade("p4", {
  profileId: "B", mes: 9, ano: 2026, salarioDia: 1000,
  fiscal: { IRS_percent: 25, IVA_percent: 23 },
  dias: [dia("2026-09-15", "08:00", "18:00")],
});

// P5 — dezembro de 2025, perfil A: fora do ano de 2026.
//   400 € · IRS 100,00 · IVA 92,00
const P5 = publicidade("p5", {
  profileId: "A", mes: 12, ano: 2025, salarioDia: 400,
  fiscal: { IRS_percent: 25, IVA_percent: 23 },
  dias: [dia("2025-12-10", "08:00", "18:00")],
});

beforeEach(() => {
  mem.clear();
  mem.set("app-settings", JSON.stringify({ region: "pt" }));
  guarda(P1);
  guarda(P2, true);
  guarda(P3);
  guarda(P4);
  guarda(P5);
  guarda(P6);
});

async function somaDosMeses(ano: number, profileId?: string) {
  const s = { irs: 0, iva: 0, extra: 0, bruto: 0, final: 0, pago: 0, receber: 0 };
  for (let m = 1; m <= 12; m++) {
    const ms = await getMonthSummary(m, ano, profileId);
    s.irs += ms.totalIRS;
    s.iva += ms.totalIVA;
    s.extra += ms.totalHorasExtra;
    s.bruto += ms.totalValorBruto;
    s.final += ms.totalValorFinal;
    s.pago += ms.totalPago;
    s.receber += ms.totalReceberLiquido;
  }
  return {
    irs: r2(s.irs), iva: r2(s.iva), extra: r2(s.extra), bruto: r2(s.bruto),
    final: r2(s.final), pago: r2(s.pago), receber: r2(s.receber),
  };
}

describe("resumo do ano: impostos e horas extra", () => {
  it("perfil A em 2026: valores à mão (P1 + P2 arquivado/pago + P3 cinema + P6 legado)", async () => {
    const y = await getYearSummary(2026, "A");
    // IRS: 125 + 204 + 107,50 + 37,50 = 474,00
    expect(y.totalIRS).toBe(474);
    // IVA: 115 + 234,60 + 98,90 + 0 = 448,50
    expect(y.totalIVA).toBe(448.5);
    // Horas extra: 2 + 6 + 1 + 0 = 9h
    expect(y.totalHorasExtra).toBe(9);
    // Bruto: 500 + 1020 + 430 + 150 = 2100
    expect(y.totalValorBruto).toBe(2100);
    // Líquido: 490 + 1050,60 + 374,10 + 112,50 = 2027,20
    // (= 2100 − 474 − 47,30 de SS + 448,50)
    expect(y.totalValorFinal).toBe(2027.2);
    // Pago só o P2; por receber (líquido) o resto: 490 + 374,10 + 112,50
    expect(y.totalPago).toBe(1050.6);
    expect(y.totalReceberLiquido).toBe(976.6);
  });

  it("cada mês tem os seus impostos (março junta o ativo e o arquivado)", async () => {
    const mar = await getMonthSummary(3, 2026, "A");
    expect(mar.totalIRS).toBe(329); // 125 + 204
    expect(mar.totalIVA).toBe(349.6); // 115 + 234,60
    expect(mar.totalHorasExtra).toBe(8); // 2 + 6
    const jun = await getMonthSummary(6, 2026, "A");
    expect(jun.totalIRS).toBe(107.5);
    expect(jun.totalIVA).toBe(98.9);
    expect(jun.totalHorasExtra).toBe(1);
    const nov = await getMonthSummary(11, 2026, "A");
    expect(nov.totalIRS).toBe(37.5);
    expect(nov.totalIVA).toBe(0);
  });

  it("o ano é a soma dos 12 meses — perfil A, perfil B e conta inteira", async () => {
    for (const perfil of ["A", "B", undefined]) {
      const y = await getYearSummary(2026, perfil);
      const m = await somaDosMeses(2026, perfil);
      expect(y.totalIRS).toBe(m.irs);
      expect(y.totalIVA).toBe(m.iva);
      expect(y.totalHorasExtra).toBe(m.extra);
      expect(y.totalValorBruto).toBe(m.bruto);
      expect(y.totalValorFinal).toBe(m.final);
      expect(y.totalPago).toBe(m.pago);
      expect(y.totalReceberLiquido).toBe(m.receber);
    }
  });

  it("perfil B: só o seu projeto e o legado sem dono", async () => {
    const y = await getYearSummary(2026, "B");
    expect(y.totalIRS).toBe(287.5); // P4 250 + P6 37,50
    expect(y.totalIVA).toBe(230); // P4 230 + P6 0
    expect(y.totalHorasExtra).toBe(0);
  });

  it("sem perfil: a conta inteira do ano (fica de fora só 2025)", async () => {
    const y = await getYearSummary(2026);
    expect(y.totalIRS).toBe(724); // 474 + P4 250
    expect(y.totalIVA).toBe(678.5); // 448,50 + P4 230
    expect(y.totalValorBruto).toBe(3100); // 2100 + P4 1000
  });

  it("2025 tem só o P5", async () => {
    const y = await getYearSummary(2025, "A");
    expect(y.totalIRS).toBe(100); // 400 × 25%
    expect(y.totalIVA).toBe(92); // 400 × 23%
  });

  it("horas extra do ano somam MINUTOS (20 min + 20 min = 0,67 h, não 0,33 + 0,33)", async () => {
    mem.clear();
    // Salário 220 € → 08:00–19:20 = 11h20 → 20 min de HE-A em cada folha.
    guarda(publicidade("x1", {
      profileId: "A", mes: 3, ano: 2026, salarioDia: 220, fiscal: { IRS_percent: 25, IVA_percent: 23 },
      dias: [dia("2026-03-02", "08:00", "19:20")],
    }));
    guarda(publicidade("x2", {
      profileId: "A", mes: 6, ano: 2026, salarioDia: 220, fiscal: { IRS_percent: 25, IVA_percent: 23 },
      dias: [dia("2026-06-02", "08:00", "19:20")],
    }));
    // Cada mês: 20/60 = 0,333… → 0,33 h
    expect((await getMonthSummary(3, 2026, "A")).totalHorasExtra).toBe(0.33);
    expect((await getMonthSummary(6, 2026, "A")).totalHorasExtra).toBe(0.33);
    // Ano: 40/60 = 0,666… → 0,67 h (o cartão mostra 0,7 nos dois casos)
    const y = await getYearSummary(2026, "A");
    expect(y.totalHorasExtra).toBe(0.67);
    // Dinheiro, esse, bate ao cêntimo: cada folha 220 + 20 min × 30 €/h = 230 €
    // → IRS 57,50 cada → 115,00 no ano
    expect(y.totalIRS).toBe(115);
  });
// Decisão do Jorge (06/11/2026): a recuperação ENTRE SEMANAS do cinema é
  // dinheiro a receber (entra no bruto), mas NÃO são horas extra — nem no mês
  // nem no ano. Só a recuperação diária (< 11h entre dois dias seguidos) conta.
  it("cinema: a recuperação entre semanas entra nos euros, não nas horas extra", async () => {
    mem.clear();
    // Semana 1000 € ÷ 5 dias = 200 €/dia; ÷ 10h = 20 €/h (hora-base).
    // Recuperação: hora-base × 3 (multHR por omissão) = 60 €/h, a DOBRAR (×2,
    // como as folgas) = 120 €/h — a regra de cinema.test.ts (rateHR_folga).
    // Sex 05/06 13:00–23:00 = 10h → 200 €, sem HE.
    // Descanso até seg 08/06 07:00: 1h + 24h + 24h + 7h = 56h < 60h
    //   → défice 4h de recuperação a 120 €/h = 480 €. Bruto 200 + 480 = 680 €.
    guarda({
      id: "c1", profileId: "A", formato: "cinema", perfil: {},
      projeto: { titulo: "Semana 23", mes: 6, ano: 2026 },
      tabela: { salarioDia: 0, salarioSemana: 1000, diasSemana: 5, horasBase: 10, H_dia: 11, descanso_min: 11, multFolga: 2 },
      fiscal: { IRS_percent: 25, IVA_percent: 23, SS_percent: 11 },
      cinema: { proximaSemana: { data: "2026-06-08", inicio: "07:00" } },
      notas: "", condicoes: "", condTitulo: "", pago: false,
      dias: [dia("2026-06-05", "13:00", "23:00")],
      updatedAt: "2026-11-01T10:00:00.000Z",
    });
    const m = await getMonthSummary(6, 2026, "A");
    expect(m.totalValorBruto).toBe(680);
    expect(m.totalHorasExtra).toBe(0);
    const y = await getYearSummary(2026, "A");
    expect(y.totalHorasExtra).toBe(0);
    // IRS 25% sobre os 680 € (a recuperação é rendimento): 170 €
    expect(y.totalIRS).toBe(170);
  });
});
