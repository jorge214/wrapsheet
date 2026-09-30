import { describe, expect, it } from "vitest";
import { calcAllCinema } from "./cinema";
import { ratesFor } from "./engine";
import type { Dia, Tabela } from "./types";

// Cinema: as horas extra e de recuperação são VALORES por hora, como na
// publicidade — é o técnico que faz as contas e o valor define o multiplicador
// (pai do Jorge, 30/09/2026). Os multiplicadores ficam só como predefinição
// quando não há valor. Contas à mão a partir do guia:
//   900 €/semana de 5 dias → 180 €/dia → hora normal 18 €
//   sem valor: HE-A 18×1,5 = 27 · HE-B 18×2 = 36 · HR 18×2,5 = 45
//   folga/feriado (×2): 54 · 72 · 90
function tabela(o: Partial<Tabela> = {}): Tabela {
  return {
    salarioSemana: 900, diasSemana: 5, horasBase: 10, descansoSemanal_h: 60, multFolga: 2,
    H_dia: 11, descanso_min: 10, limiar_HR: 10, limiar_A: 11, limiar_B: 18,
    multHEA: 1.5, multHEB: 2.0, multHR: 2.5,
    ajudas: { refeicao: 0, viatura: 0, material: 0, telefone: 0, perDiem: 0 },
    ...o,
  };
}

describe("cinema: valores por hora do perfil mandam; multiplicadores só como predefinição", () => {
  it("sem valores: hora normal 18 € × 1,5 / 2 / 2,5 = 27 / 36 / 45", () => {
    const R = ratesFor(tabela());
    expect(R.horaBase).toBe(18);
    expect(R.rateHEA).toBe(27);
    expect(R.rateHEB).toBe(36);
    expect(R.rateHR).toBe(45);
  });

  it("com HE-A a 30 €/h no perfil, é 30 que vale (não 27); as outras continuam pela predefinição", () => {
    const R = ratesFor(tabela({ rateHEA: 30 }));
    expect(R.rateHEA).toBe(30);
    expect(R.rateHEB).toBe(36);
    expect(R.rateHR).toBe(45);
  });

  it("os três valores definidos: 30 / 40 / 60 — o multiplicador passa a ser implícito (30/18 = 1,67)", () => {
    const R = ratesFor(tabela({ rateHEA: 30, rateHEB: 40, rateHR: 60 }));
    expect(R.rateHEA).toBe(30);
    expect(R.rateHEB).toBe(40);
    expect(R.rateHR).toBe(60);
    // folga/feriado a dobrar parte do VALOR, não do multiplicador
    expect(R.rateHEA * R.multFolga).toBe(60);
    expect(R.rateHR * R.multFolga).toBe(120);
  });

  it("no cinema, uma taxa gravada a 0 € é lixo da semente antiga, não um valor: cai no multiplicador (27)", () => {
    // A semente do editor usava a base da publicidade (salarioDia), que no
    // cinema não existe → gravava rateHEA = 0 e a folha mostrava 0,00 €.
    const R = ratesFor(tabela({ rateHEA: 0, rateHEB: 0, rateHR: 0 }));
    expect(R.rateHEA).toBe(27);
    expect(R.rateHEB).toBe(36);
    expect(R.rateHR).toBe(45);
  });

  it("o que se PAGA concorda com o cabeçalho: taxa a 0 no cinema, dia de 13h → 2h de HE-A a 27 € = 54 €, dia 234 €", () => {
    // O cabeçalho vem do ratesFor e o pagamento do calcDay; os dois têm de usar
    // a mesma guarda, senão a folha anuncia 27 €/h e paga 0 (revisão de 30/09).
    // 07:00–20:00 = 13h; horário base 11h → 2h de HE-A; 180 + 2×27 = 234.
    const dia: Dia = {
      descricao: "Filmagem", data: "2023-07-21", continuo: false, inicio: "07:00", fim: "20:00",
      refeicaoTrabalho: "00:00", jantarTrabalho: "00:00", meioDia: false, tempoTransporteMin: 0, diaSemTrabalho: false,
    };
    const [c] = calcAllCinema([dia], tabela({ rateHEA: 0, rateHEB: 0, rateHR: 0 }));
    expect(c.HEA_min).toBe(120);
    expect(c.HEA_valor).toBe(54);
    expect(c.totalDia).toBe(234);
  });

  it("na publicidade um 0 €/h é respeitado tal qual (quem o põe, quer 0)", () => {
    const R = ratesFor({ salarioDia: 220, H_dia: 11, descanso_min: 11, rateHEA: 0 } as any);
    expect(R.horaBase).toBe(20);
    expect(R.rateHEA).toBe(0);
    expect(R.rateHEB).toBe(40);
  });

  it("semana de 6 dias: 900 ÷ 6 = 150 €/dia → 15 €/h; valor de 25 €/h para HE-A vale tal e qual", () => {
    const R = ratesFor(tabela({ diasSemana: 6, rateHEA: 25 }));
    expect(R.horaBase).toBe(15);
    expect(R.rateHEA).toBe(25);
    expect(R.rateHEB).toBe(30);
  });
});
