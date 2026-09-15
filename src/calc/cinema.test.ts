import { describe, expect, it } from "vitest";
import { calcAllCinema, calcSemanaCinema, restPerRow, roundHalfUpHours } from "./cinema";
import { calcAll, calcTotals, ratesFor } from "./engine";
import { feriadosPT, isFeriadoPT } from "./feriadosPT";
import { calcProject } from "./project";
import type { Dia, Tabela } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Folha de CINEMA — valores calculados À MÃO a partir dos exemplos do guia
// ("informações folha cinema.pdf", imagens 10, 11, 13 e 14).
//
// Tabela base: SEMANA 5 DIAS = 900 € → dia = 900/5 = 180 €; hora = 180/10 = 18 €
//   HE-A ×1,5 = 27 €/h · HE-B ×2 = 36 €/h · Recuperação ×2,5 = 45 €/h
//   Dia de folga / feriado (×2): 360 € · 54 · 72 · 90
// Horário: 11h (10h + 1h refeição) → HE-A a partir da 12.ª hora (limiar 11).
//
// Regra de APRESENTAÇÃO do descanso (nota do Jorge, 15/09/2026): o descanso
// do fim de semana — até ao início da semana seguinte — mostra-se TODO no
// último dia trabalhado; as folgas sem horas ficam em branco (0). Os totais
// em € não mudam com isto; só muda em que linha o descanso aparece.
// ─────────────────────────────────────────────────────────────────────────────

function tabela(o: Partial<Tabela> = {}): Tabela {
  return {
    salarioSemana: 900, diasSemana: 5, horasBase: 10, descansoSemanal_h: 60, multFolga: 2,
    H_dia: 11, descanso_min: 10, limiar_HR: 10, limiar_A: 11, limiar_B: 18,
    multHEA: 1.5, multHEB: 2.0, multHR: 2.5,
    ajudas: { refeicao: 0, viatura: 0, material: 0, telefone: 0, perDiem: 0 },
    ...o,
  };
}

function dia(data: string, inicio: string, fim: string, o: Partial<Dia> = {}): Dia {
  return {
    descricao: "Filmagem", data, continuo: false, inicio, fim,
    refeicaoTrabalho: "00:00", jantarTrabalho: "00:00", meioDia: false,
    tempoTransporteMin: 0, diaSemTrabalho: false, ...o,
  };
}
const folga = (data: string) => dia(data, "", "", { descricao: "FOLGA", folga: true });

// Imagem 10: semana de 17 a 23 jul 2023; seg-qua preparação, qui-sex filmagem
const SEMANA_10 = [
  dia("2023-07-17", "09:00", "19:00"), // 10h
  dia("2023-07-18", "09:00", "19:00"), // 10h
  dia("2023-07-19", "09:00", "20:00"), // 11h exatas → 0 HE
  dia("2023-07-20", "07:00", "19:00"), // 12h → 1h HE-A
  dia("2023-07-21", "07:00", "19:00"), // 12h → 1h HE-A
  folga("2023-07-22"),
  folga("2023-07-23"),
];
const SEG_07 = { data: "2023-07-24", inicio: "07:00" };

describe("taxas do cinema (ratesFor)", () => {
  it("900 €/semana de 5 dias → 180 €/dia, 18 €/h, 27 / 36 / 45 €/h", () => {
    const R = ratesFor(tabela());
    expect(R.salarioDia).toBe(180);
    expect(R.horaBase).toBe(18);
    expect(R.rateHEA).toBe(27);
    expect(R.rateHEB).toBe(36);
    expect(R.rateHR).toBe(45);
    expect(R.multFolga).toBe(2);
  });

  it("publicidade não muda: 220 €/dia de 11h → 20 €/h, 30 / 40 / 60", () => {
    const R = ratesFor({ salarioDia: 220, H_dia: 11, descanso_min: 11 });
    expect(R.salarioDia).toBe(220);
    expect(R.horaBase).toBe(20);
    expect(R.rateHEA).toBe(30);
    expect(R.rateHEB).toBe(40);
    expect(R.rateHR).toBe(60);
  });
});

describe("descanso por linha (imagem 10) — o fim de semana mostra-se na sexta", () => {
  it("sem linha B: sex = 19:00→24:00 (5h) + sáb 24h + dom 24h = 53:00; folgas em branco", () => {
    const r = restPerRow(SEMANA_10);
    // seg 19:00 → ter 09:00 = 14h; ter idem; qua 20:00 → qui 07:00 = 11h; qui 19:00 → sex 07:00 = 12h
    expect(r[0]).toBe(14 * 60);
    expect(r[1]).toBe(14 * 60);
    expect(r[2]).toBe(11 * 60);
    expect(r[3]).toBe(12 * 60);
    expect(r[4]).toBe(53 * 60);  // sex: 5h + 24h + 24h (sem semana seguinte)
    expect(r[5]).toBe(0);        // sáb (folga): já contada na sexta
    expect(r[6]).toBe(0);        // dom (folga): idem
  });

  it("com linha B seg 07:00: sex = 5 + 24 + 24 + 7 = 60:00", () => {
    const r = restPerRow(SEMANA_10, SEG_07);
    expect(r[4]).toBe(60 * 60);
    expect(r[5]).toBe(0);
    expect(r[6]).toBe(0);
  });
});

describe("semana completa (imagem 10): 05 + 24 + 24 + 07 = 60h → nada a cobrar", () => {
  const calc = calcAllCinema(SEMANA_10, tabela(), SEG_07);
  const sem = calcSemanaCinema(SEMANA_10, calc, tabela(), SEG_07);

  it("dias normais: 180 € (10h/11h) e 207 € (12h = 180 + 1h HE-A a 27 €)", () => {
    expect(calc[0].totalDia).toBe(180);
    expect(calc[2].totalDia).toBe(180);   // 11h exatas → sem HE
    expect(calc[3].HEA_min).toBe(60);
    expect(calc[3].HEA_valor).toBe(27);
    expect(calc[3].totalDia).toBe(207);
    // sem recuperação diária: todos os intervalos ≥ 10h
    expect(calc.every((c) => c.HR_min === 0)).toBe(true);
  });

  it("folgas sem horas: 0 €, marcadas como descanso, e em branco (o descanso está na sexta)", () => {
    expect(calc[5].totalDia).toBe(0);
    expect(calc[5].descanso).toBe(true);
    expect(calc[5].HD_min).toBe(0);
    expect(calc[4].HD_min).toBe(60 * 60); // a sexta mostra as 60h
  });

  it("segmento 07:00 (já dentro da sexta); total 60:00; saldo 0; HR 0", () => {
    expect(sem.segmento_min).toBe(7 * 60);
    expect(sem.descanso_min).toBe(60 * 60);
    expect(sem.saldo_min).toBe(0);
    expect(sem.cobravel).toBe(true);
    expect(sem.HR_h).toBe(0);
    expect(sem.HR_valor).toBe(0);
    expect(sem.rateHR_folga).toBe(90);
  });

  it("bruto da semana = 180×3 + 207×2 = 954 €", () => {
    const t = calcTotals(calc, { IRS_percent: 0, IVA_percent: 0 }, { extraBruto: sem.HR_valor });
    expect(t.ValorBruto).toBe(954);
  });
});

describe("exemplo 1 (imagem 11): sábado de folga TRABALHADO → 48h → 12h a cobrar", () => {
  const dias = [
    dia("2023-07-20", "07:00", "19:00"),
    dia("2023-07-21", "07:00", "20:00"),                                   // 13h → 2h HE-A
    dia("2023-07-22", "07:00", "18:00", { descricao: "FOLGA", folga: true }), // folga trabalhada, 11h
    folga("2023-07-23"),
  ];
  const t = tabela();
  const calc = calcAllCinema(dias, t, SEG_07);
  const sem = calcSemanaCinema(dias, calc, t, SEG_07);

  it("descanso volta a contar dia a dia: sex 20:00→sáb 07:00 = 11h; sáb (último trabalhado) = 6 + 24 + 7 = 37h; dom em branco → 48h", () => {
    expect(calc[1].HD_min).toBe(11 * 60);
    expect(calc[2].HD_min).toBe(37 * 60);
    expect(calc[3].HD_min).toBe(0);
    expect(sem.descanso_min).toBe(48 * 60);
    expect(sem.saldo_min).toBe(-12 * 60);
  });

  it("recuperação entre semanas: 12h × 90 €/h = 1 080 €", () => {
    expect(sem.HR_h).toBe(12);
    expect(sem.HR_valor).toBe(1080);
  });

  it("o sábado trabalhado paga o dia a dobrar: 360 € (11h → sem HE)", () => {
    expect(calc[2].dobra).toBe(2);
    expect(calc[2].salarioDia).toBe(360);
    expect(calc[2].totalDia).toBe(360);
  });

  it("sexta de 13h: 2h de HE-A a 27 € = 54 € → 234 €", () => {
    expect(calc[1].HEA_min).toBe(120);
    expect(calc[1].totalDia).toBe(234);
  });
});

describe("exemplo 3 (imagem 13): última semana, início seguinte a 00:00 → défice mostra-se mas não se cobra", () => {
  const prox = { data: "2023-07-24", inicio: "00:00" };
  const calc = calcAllCinema(SEMANA_10, tabela(), prox);
  const sem = calcSemanaCinema(SEMANA_10, calc, tabela(), prox);
  it("53h na sexta: saldo −7h, não cobrável, HR 0", () => {
    expect(calc[4].HD_min).toBe(53 * 60);
    expect(sem.descanso_min).toBe(53 * 60);
    expect(sem.saldo_min).toBe(-7 * 60);
    expect(sem.cobravel).toBe(false);
    expect(sem.HR_h).toBe(0);
    expect(sem.HR_valor).toBe(0);
  });
  it("sem linha B de todo: também não se cobra", () => {
    const c2 = calcAllCinema(SEMANA_10, tabela());
    const s2 = calcSemanaCinema(SEMANA_10, c2, tabela(), undefined);
    expect(s2.segmento_min).toBe(0);
    expect(s2.descanso_min).toBe(53 * 60);
    expect(s2.cobravel).toBe(false);
    expect(s2.HR_valor).toBe(0);
  });
});

describe("exemplo 4 (imagem 14): descanso acima das 60h → +02:00, nada a cobrar", () => {
  const dias = [
    dia("2023-07-21", "05:00", "17:00"),                                   // 12h
    dia("2023-07-22", "05:00", "17:00", { descricao: "FOLGA", folga: true }), // folga trabalhada
    folga("2023-07-23"),
  ];
  const prox = { data: "2023-07-24", inicio: "19:00" };
  const calc = calcAllCinema(dias, tabela(), prox);
  const sem = calcSemanaCinema(dias, calc, tabela(), prox);
  it("sex 12h (→ sáb 05:00) + sáb 7 + 24 + 19 = 50h → 62h → saldo +2h", () => {
    expect(calc[0].HD_min).toBe(12 * 60);
    expect(calc[1].HD_min).toBe(50 * 60);
    expect(sem.descanso_min).toBe(62 * 60);
    expect(sem.saldo_min).toBe(2 * 60);
    expect(sem.HR_valor).toBe(0);
  });
});

describe("arredondamento: a meia hora sobe para a hora seguinte", () => {
  it("4h30 → 5; 4h15 → 4; 0h29 → 0", () => {
    expect(roundHalfUpHours(270)).toBe(5);
    expect(roundHalfUpHours(255)).toBe(4);
    expect(roundHalfUpHours(29)).toBe(0);
  });
  it("semana com défice de 30 min (início seguinte 06:30) → 1h × 90 = 90 €", () => {
    const prox = { data: "2023-07-24", inicio: "06:30" };
    const calc = calcAllCinema(SEMANA_10, tabela(), prox);
    const sem = calcSemanaCinema(SEMANA_10, calc, tabela(), prox);
    expect(sem.saldo_min).toBe(-30);
    expect(sem.HR_h).toBe(1);
    expect(sem.HR_valor).toBe(90);
  });
  it("overrides escritos na folha ganham ao automático", () => {
    const calc = calcAllCinema(SEMANA_10, tabela(), SEG_07);
    const sem = calcSemanaCinema(SEMANA_10, calc, tabela(), SEG_07, { hrSemanaHoras: 3 });
    expect(sem.HR_h).toBe(3);
    expect(sem.HR_valor).toBe(270);
    const sem2 = calcSemanaCinema(SEMANA_10, calc, tabela(), SEG_07, { hrSemanaValor: 123.45 });
    expect(sem2.HR_valor).toBe(123.45);
  });
});

describe("feriado: dia normal a dobrar", () => {
  it("quinta de 12h marcada feriado: 360 € + 1h HE-A a 54 € = 414 €", () => {
    const d = [dia("2023-07-20", "07:00", "19:00", { feriado: true })];
    const c = calcAllCinema(d, tabela());
    expect(c[0].dobra).toBe(2);
    expect(c[0].salarioDia).toBe(360);
    expect(c[0].HEA_valor).toBe(54);
    expect(c[0].totalDia).toBe(414);
  });
  it("salário escrito à mão no dia é o valor final (não se dobra)", () => {
    const d = [dia("2023-07-20", "07:00", "18:00", { feriado: true, salarioDia: 250 })];
    const c = calcAllCinema(d, tabela());
    expect(c[0].salarioDia).toBe(250);
  });
});

describe("totais com Segurança Social (folha de exemplo)", () => {
  it("2 327 € · IRS 25% · IVA 23% · SS 5% → 581,75 / 535,21 / 116,35 → 2 164,11 €", () => {
    const t = calcTotals([{ totalDia: 2327 } as any], { IRS_percent: 25, IVA_percent: 23, SS_percent: 5 });
    expect(t.ValorBruto).toBe(2327);
    expect(t.IRS_valor).toBe(581.75);
    expect(t.IVA_valor).toBe(535.21);
    expect(t.SS_valor).toBe(116.35);
    expect(t.ValorFinal).toBe(2164.11);
  });
  it("sem SS nada muda (publicidade): 1000 − 230 + 230 = 1000", () => {
    const t = calcTotals([{ totalDia: 1000 } as any], { IRS_percent: 23, IVA_percent: 23 });
    expect(t.SS_valor).toBe(0);
    expect(t.ValorFinal).toBe(1000);
  });
  it("extraBruto entra no bruto (recuperação entre semanas)", () => {
    const t = calcTotals([{ totalDia: 100 } as any], { IRS_percent: 0, IVA_percent: 0 }, { extraBruto: 50 });
    expect(t.ValorBruto).toBe(150);
  });
});

describe("calcProject: escolhe o motor pelo formato", () => {
  it("cinema: bruto = dias + recuperação entre semanas (exemplo 1: 207+234+360+0 + 1 080)", () => {
    const dias = [
      dia("2023-07-20", "07:00", "19:00"),                                   // 207
      dia("2023-07-21", "07:00", "20:00"),                                   // 234
      dia("2023-07-22", "07:00", "18:00", { descricao: "FOLGA", folga: true }), // 360
      folga("2023-07-23"),
    ];
    const r = calcProject({
      formato: "cinema", dias, tabela: tabela(),
      fiscal: { IRS_percent: 0, IVA_percent: 0 },
      cinema: { proximaSemana: { data: "2023-07-24", inicio: "07:00" } },
    });
    expect(r.formato).toBe("cinema");
    expect(r.semana?.HR_valor).toBe(1080);
    expect(r.totais.ValorBruto).toBe(207 + 234 + 360 + 1080);
  });
  it("sem formato = publicidade, igual a calcAll + calcTotals", () => {
    const t: Tabela = { salarioDia: 220, H_dia: 11, descanso_min: 11, multHEA: 1.5, multHEB: 2, multHR: 3, limiar_A: 11, limiar_B: 18 };
    const dias = [dia("2026-07-01", "08:00", "20:00")];
    const r = calcProject({ dias, tabela: t, fiscal: { IRS_percent: 23, IVA_percent: 23 } });
    const ref = calcTotals(calcAll(dias, t), { IRS_percent: 23, IVA_percent: 23 });
    expect(r.formato).toBe("publicidade");
    expect(r.semana).toBeUndefined();
    expect(r.totais).toEqual(ref);
    expect(r.calc[0].dobra).toBe(1);
  });
});

describe("feriados obrigatórios em Portugal", () => {
  it("2026: Páscoa a 5 de abril → Sexta-feira Santa 3/4, Corpo de Deus 4/6", () => {
    const f = feriadosPT(2026);
    expect(f).toContain("2026-04-03");
    expect(f).toContain("2026-04-05");
    expect(f).toContain("2026-06-04");
    expect(f).toHaveLength(13);
  });
  it("fixos e não-feriados", () => {
    expect(isFeriadoPT("2026-06-10")).toBe(true);
    expect(isFeriadoPT("2026-12-25")).toBe(true);
    expect(isFeriadoPT("2026-06-11")).toBe(false);
    expect(isFeriadoPT("")).toBe(false);
    expect(isFeriadoPT(undefined)).toBe(false);
  });
  it("2024: Páscoa a 31 de março → Sexta-feira Santa 29/3, Corpo de Deus 30/5", () => {
    expect(isFeriadoPT("2024-03-29")).toBe(true);
    expect(isFeriadoPT("2024-05-30")).toBe(true);
  });
});
