import { describe, it, expect } from "vitest";
import { calcDay, calcAll, calcTotals } from "./engine";
import type { Dia, Tabela } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Testes ao motor de cálculo. TODOS os valores esperados são calculados À MÃO
// e justificados em comentário — nunca gerados a partir do próprio motor.
//
// Tabela base propositada: salário/dia = 220 €, H_dia = 11h.
//   → hora-base = 220 / 11 = 20 €/h
//   → taxa OT-A = 20 × 1,5 = 30 €/h
//   → taxa OT-B = 20 × 2,0 = 40 €/h
//   → taxa Recuperação = 20 × 3,0 = 60 €/h
// Limiares: H_dia = 11h, OT-A começa às 11h, OT-B às 18h, descanso mínimo 11h.
// (As HORAS de trabalho = tempo de relógio + refeição/jantar trabalhados + transporte.)
// ─────────────────────────────────────────────────────────────────────────────

function dia(o: Partial<Dia> = {}): Dia {
  return {
    descricao: "Test",
    data: "2026-07-01",
    continuo: false,
    inicio: "08:00",
    refeicaoTrabalho: "00:00",
    jantarTrabalho: "00:00",
    fim: "18:00",
    meioDia: false,
    tempoTransporteMin: 0,
    diaSemTrabalho: false,
    ...o,
  };
}

function tabela(o: Partial<Tabela> = {}): Tabela {
  return {
    salarioDia: 220,
    H_dia: 11,
    descanso_min: 11,
    multHEA: 1.5,
    multHEB: 2.0,
    multHR: 3.0,
    limiar_A: 11,
    limiar_B: 18,
    ajudas: { refeicao: 0, viatura: 0, material: 0, telefone: 0, perDiem: 0 },
    ...o,
  };
}

describe("dia normal, sem horas extra", () => {
  it("um dia de 10h de relógio + 30min de refeição = 10,5h < 11h → 0 OT, total = salário", () => {
    // HT = (18:00 − 08:00) + refeição 30 = 600 + 30 = 630 min (10,5h). 630 < 660 (11h) → sem OT.
    const c = calcDay(dia({ fim: "18:00", refeicaoTrabalho: "00:30" }), undefined, tabela());
    expect(c.HT_min).toBe(630);
    expect(c.HEA_min).toBe(0);
    expect(c.HEB_min).toBe(0);
    expect(c.HR_min).toBe(0);
    // total = salário 220 + 0 OT + 0 ajudas = 220
    expect(c.totalDia).toBe(220);
  });
});

describe("fronteira do OT-A", () => {
  it("exatamente 11h (660 min) → 0 minutos de OT-A (o OT-A é a 12.ª hora em diante)", () => {
    // inicio 08:00, fim 19:00 = 660 min = 11h exatas. Janela OT-A = min(660,1080) − max(660,660) = 0.
    const c = calcDay(dia({ fim: "19:00" }), undefined, tabela());
    expect(c.HT_min).toBe(660);
    expect(c.HEA_min).toBe(0);
  });

  it("12h (720 min) → 60 min de OT-A a 30 €/h = 30,00 €", () => {
    // inicio 08:00, fim 20:00 = 720 min = 12h. Janela OT-A = min(720,1080) − 660 = 60 min (1h).
    // € = 1h × 30 €/h = 30,00. OT-B = max(0, 720 − 1080) = 0.
    const c = calcDay(dia({ fim: "20:00" }), undefined, tabela());
    expect(c.HT_min).toBe(720);
    expect(c.HEA_min).toBe(60);
    expect(c.HEA_valor).toBe(30);
    expect(c.HEB_min).toBe(0);
    // total = 220 + 30 = 250
    expect(c.totalDia).toBe(250);
  });
});

describe("OT-B sem dupla contagem", () => {
  it("dia de 20h: OT-A pára às 18h e o OT-B começa às 18h, sem sobreposição", () => {
    // inicio 02:00, fim 22:00 = 1200 min = 20h (sem passar da meia-noite).
    // OT-A = janela [11h, 18h] = 18h−11h = 7h = 420 min. € = 7 × 30 = 210,00.
    // OT-B = acima de 18h = 20h−18h = 2h = 120 min. € = 2 × 40 = 80,00.
    // Verificação anti-dupla-contagem: base 660 + OT-A 420 + OT-B 120 = 1200 = HT.
    const c = calcDay(dia({ inicio: "02:00", fim: "22:00" }), undefined, tabela());
    expect(c.HT_min).toBe(1200);
    expect(c.HEA_min).toBe(420);
    expect(c.HEB_min).toBe(120);
    expect(c.HEA_valor).toBe(210);
    expect(c.HEB_valor).toBe(80);
    // as horas base (660) + OT-A + OT-B têm de somar exatamente HT (sem gap nem overlap)
    expect(660 + c.HEA_min + c.HEB_min).toBe(c.HT_min);
    // total = 220 + 210 + 80 = 510
    expect(c.totalDia).toBe(510);
  });
});

describe("turno que passa da meia-noite", () => {
  it("16:00 → 06:00 = 14h; o motor soma 24h ao fim (não dá negativo) e calcula 3h de OT-A", () => {
    // fim 06:00 (360) < inicio 16:00 (960) → fim corrigido = 360 + 1440 = 1800.
    // HT = 1800 − 960 = 840 min = 14h. OT-A = min(840,1080) − 660 = 180 min (3h). € = 3 × 30 = 90,00.
    const c = calcDay(dia({ inicio: "16:00", fim: "06:00" }), undefined, tabela());
    expect(c.HT_min).toBe(840);
    expect(c.HEA_min).toBe(180);
    expect(c.HEB_min).toBe(0);
    expect(c.HEA_valor).toBe(90);
  });
});

describe("turnaround / recuperação", () => {
  it("dois dias consecutivos com 8h de descanso (< 11h) → 3h de recuperação no 1.º dia", () => {
    // Dia 1: 14:00 → 22:00 = 8h (< 11h → sem OT). Dia 2 (dia seguinte): começa às 06:00.
    // Descanso = das 22:00 às 06:00 = 8h = 480 min.
    // Recuperação = max(0, 11h − 8h) = 3h = 180 min. € = 3 × 60 = 180,00.
    // A recuperação fica no DIA 1 (é o descanso curto depois desse dia).
    const dias = [
      dia({ data: "2026-07-01", inicio: "14:00", fim: "22:00" }),
      dia({ data: "2026-07-02", inicio: "06:00", fim: "14:00" }),
    ];
    const c = calcAll(dias, tabela());
    expect(c[0].HR_min).toBe(180);
    expect(c[0].HR_valor).toBe(180);
    // total do dia 1 = salário 220 + 0 OT + 180 recuperação = 400
    expect(c[0].totalDia).toBe(400);
  });

  it("dois dias NÃO consecutivos (gap de fim de semana) → 0 recuperação", () => {
    // Mesmos horários, mas dia 1 = 01/07 e dia 2 = 05/07 (não é o dia de calendário seguinte).
    // O motor não passa o 'próximo dia' ao cálculo → 0 recuperação.
    const dias = [
      dia({ data: "2026-07-01", inicio: "14:00", fim: "22:00" }),
      dia({ data: "2026-07-05", inicio: "06:00", fim: "14:00" }),
    ];
    const c = calcAll(dias, tabela());
    expect(c[0].HR_min).toBe(0);
    expect(c[0].HR_valor).toBe(0);
  });
});

describe("cap de 59 min na refeição e jantar", () => {
  it("refeição de 1h30 e jantar de 1h são cada um limitados a 59 min", () => {
    // Relógio = 08:00 → 18:00 = 600 min. Refeição 90 → 59. Jantar 60 → 59.
    // HT = 600 + 59 + 59 = 718 min. (Sem cap seria 600+90+60 = 750.)
    const c = calcDay(
      dia({ fim: "18:00", refeicaoTrabalho: "01:30", jantarTrabalho: "01:00" }),
      undefined,
      tabela()
    );
    expect(c.HT_min).toBe(718);
  });
});

describe("arredondamento a meias-horas", () => {
  it("desligado: 610 min ficam 610; ligado: 610 min arredondam a 600", () => {
    // inicio 08:00, fim 18:10 = 610 min.
    const off = calcDay(dia({ fim: "18:10" }), undefined, tabela({ arredondarMeiasHoras: false }));
    expect(off.HT_min).toBe(610);
    // 610 / 30 = 20,33 → arredonda a 20 → 20 × 30 = 600
    const on = calcDay(dia({ fim: "18:10" }), undefined, tabela({ arredondarMeiasHoras: true }));
    expect(on.HT_min).toBe(600);
  });
});

describe("meio-dia (salário × 0,5)", () => {
  it("meio-dia paga metade do salário do dia", () => {
    // salário 220 × 0,5 = 110. Dia curto (4h) → sem OT. total = 110.
    const c = calcDay(dia({ fim: "12:00", meioDia: true }), undefined, tabela());
    expect(c.salarioDia).toBe(110);
    expect(c.totalDia).toBe(110);
  });
});

describe("total do dia forçado à mão", () => {
  it("total forçado sobrepõe a soma automática; apagar volta ao automático", () => {
    // Dia normal → soma automática = salário 220 (sem OT, sem ajudas).
    const auto = calcDay(dia({ fim: "18:00" }), undefined, tabela());
    expect(auto.totalDia).toBe(220);
    // Com total forçado a 500 → total = 500 (ignora a soma).
    const forced = calcDay(dia({ fim: "18:00", totalDia: 500 }), undefined, tabela());
    expect(forced.totalDia).toBe(500);
  });
});

describe("ajudas com override por dia", () => {
  it("override do dia ganha ao global; um 0 explícito NÃO cai para o global", () => {
    // Globais: refeição 5, viatura 6, telefone 7, material 8, per diem 9.
    // Dia: refeição forçada a 15; per diem forçado a 0; os outros usam o global.
    // → ref 15, viat 6, tel 7, mat 8, per 0. Total ajudas = 15+6+7+8+0 = 36.
    const t = tabela({ ajudas: { refeicao: 5, viatura: 6, telefone: 7, material: 8, perDiem: 9 } });
    const c = calcDay(dia({ fim: "18:00", ajRefeicao: 15, ajPerDiem: 0 }), undefined, t);
    expect(c.ajRef).toBe(15);
    expect(c.ajViat).toBe(6);
    expect(c.ajTel).toBe(7);
    expect(c.ajMat).toBe(8);
    expect(c.ajPer).toBe(0);
    expect(c.ajudasTotal).toBe(36);
    // total = salário 220 + 0 OT + 36 ajudas = 256
    expect(c.totalDia).toBe(256);
  });
});

describe("cálculo fiscal (calcTotals)", () => {
  it("Valor Final = Bruto − IRS + IVA (23% / 23%)", () => {
    // Bruto = 1000. IRS = 1000 × 23% = 230. IVA = 1000 × 23% = 230.
    // Final = 1000 − 230 + 230 = 1000.
    const r = calcTotals([{ totalDia: 1000 } as any], { IRS_percent: 23, IVA_percent: 23 });
    expect(r.ValorBruto).toBe(1000);
    expect(r.IRS_valor).toBe(230);
    expect(r.IVA_valor).toBe(230);
    expect(r.ValorFinal).toBe(1000);
  });

  it("IRS 11,5% e IVA 23% sobre 1000 → Final 1115", () => {
    // IRS = 115, IVA = 230, Final = 1000 − 115 + 230 = 1115.
    const r = calcTotals([{ totalDia: 1000 } as any], { IRS_percent: 11.5, IVA_percent: 23 });
    expect(r.IRS_valor).toBe(115);
    expect(r.IVA_valor).toBe(230);
    expect(r.ValorFinal).toBe(1115);
  });

  it("região com IRS = 0 (ex.: Alemanha, IVA 19%) → sem retenção, só IVA", () => {
    // Bruto = 1000. IRS = 0. IVA = 190. Final = 1000 − 0 + 190 = 1190.
    const r = calcTotals([{ totalDia: 1000 } as any], { IRS_percent: 0, IVA_percent: 19 });
    expect(r.IRS_valor).toBe(0);
    expect(r.IVA_valor).toBe(190);
    expect(r.ValorFinal).toBe(1190);
  });
});
