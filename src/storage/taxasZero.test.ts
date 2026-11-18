import { describe, expect, it } from "vitest";
import { calcProject } from "../calc/project";
import type { Dia, Tabela } from "../calc/types";
import { aoEscreverSalario, avisoTaxasZero, confirmarZeros, sementeTaxas, zerosConfirmados, zerosDoPerfil } from "./taxasZero";

// ─────────────────────────────────────────────────────────────────────────────
// Taxas €/h gravadas a 0 numa folha de publicidade (storage/taxasZero.ts).
// TODOS os valores esperados são calculados À MÃO, com a tabela de referência
// dos testes do motor (calc/engine.test.ts):
//   salário/dia 220 €, horário base 11 h  → hora normal = 220 ÷ 11 = 20 €/h
//   HE-A = 20 × 1,5 = 30 €/h   (da 12.ª à 18.ª hora)
//   HE-B = 20 × 2   = 40 €/h   (da 19.ª hora em diante)
//   HR   = 20 × 3   = 60 €/h   (por cada hora de descanso em falta até às 11 h)
// ─────────────────────────────────────────────────────────────────────────────

function dia(o: Partial<Dia> = {}): Dia {
  return {
    descricao: "Rodagem",
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

function tabela(o: Partial<Tabela> & { zeroOk?: string[] } = {}): Tabela {
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
  } as Tabela;
}

const ZEROS = { rateHEA: 0, rateHEB: 0, rateHR: 0 };
const folha = (t: Tabela, dias: Dia[]) => ({ dias, tabela: t, fiscal: {} });
const bruto = (t: Tabela, dias: Dia[]) => calcProject(folha(t, dias)).totais.ValorBruto;

describe("a semente do editor", () => {
  it("SEM salário não semeia nada (era aqui que as taxas ficavam gravadas a 0,00 €)", () => {
    expect(sementeTaxas(tabela({ salarioDia: 0 }))).toEqual({});
    expect(sementeTaxas(tabela({ salarioDia: undefined }))).toEqual({});
  });

  it("com salário semeia as três: 220 ÷ 11 = 20 €/h → 30 / 40 / 60", () => {
    expect(sementeTaxas(tabela())).toEqual({ rateHEA: 30, rateHEB: 40, rateHR: 60 });
  });

  it("arredonda a 2 casas: 250 ÷ 11 × 1,5 = 34,0909… → 34,09", () => {
    // 250 ÷ 11 = 22,7272…; × 1,5 = 34,0909… → 34,09; × 2 = 45,4545… → 45,45; × 3 = 68,1818… → 68,18
    expect(sementeTaxas(tabela({ salarioDia: 250 }))).toEqual({ rateHEA: 34.09, rateHEB: 45.45, rateHR: 68.18 });
  });

  it("não toca numa taxa que já lá está (nem num 0 gravado)", () => {
    expect(sementeTaxas(tabela({ rateHEA: 25, rateHR: 0 }))).toEqual({ rateHEB: 40 });
  });

  it("HE a × 1 (hora normal) não se semeia; a HR sim", () => {
    expect(sementeTaxas(tabela({ multHEA: 1, multHEB: 1 }))).toEqual({ rateHR: 60 });
  });

  it("`so` limita a semente a essas taxas", () => {
    expect(sementeTaxas(tabela(), ["rateHEB"])).toEqual({ rateHEB: 40 });
  });

  it("cinema: 1250 €/semana ÷ 5 dias ÷ 10 h = 25 €/h → 37,50 / 50 / 62,50", () => {
    // dia = 1250 ÷ 5 = 250; hora = 250 ÷ 10 = 25; × 1,5 = 37,5; × 2 = 50; × 2,5 = 62,5
    const cinema = tabela({ salarioDia: undefined, salarioSemana: 1250, diasSemana: 5, horasBase: 10, multHR: 2.5 });
    expect(sementeTaxas(cinema)).toEqual({ rateHEA: 37.5, rateHEB: 50, rateHR: 62.5 });
  });
});

describe("o aviso das horas pagas a 0 €", () => {
  it("HE-A a 0: um dia de 12 h perde 1 h × 30 € = 30 €", () => {
    // 08:00–20:00 = 12 h → 1 h de HE-A. Com a taxa a 0: 220 €. Automática: 220 + 30 = 250 €.
    const dias = [dia({ fim: "20:00" })];
    const t = tabela(ZEROS);
    expect(bruto(t, dias)).toBe(220);
    const a = avisoTaxasZero(folha(t, dias))!;
    // só a HE-A custa dinheiro: não há HE-B nem HR neste dia
    expect(a.chaves).toEqual(["rateHEA"]);
    expect(a.diferenca).toBe(30);
    expect(a.tabela.rateHEA).toBe(30);
    // as outras duas ficam como estavam — ninguém perguntou por elas
    expect(a.tabela.rateHEB).toBe(0);
    expect(a.tabela.rateHR).toBe(0);
    expect(bruto(a.tabela, dias)).toBe(250);
  });

  it("HE-B a 0: um dia de 19 h perde 1 h × 40 € = 40 €", () => {
    // 08:00–03:00 = 19 h → HE-A da 12.ª à 18.ª = 7 h × 30 = 210 €; HE-B 1 h × 40 = 40 €.
    // Com a HE-B a 0: 220 + 210 = 430 €. Automática: 470 €.
    const dias = [dia({ fim: "03:00" })];
    const t = tabela({ rateHEB: 0 });
    expect(bruto(t, dias)).toBe(430);
    const a = avisoTaxasZero(folha(t, dias))!;
    expect(a.chaves).toEqual(["rateHEB"]);
    expect(a.diferenca).toBe(40);
    expect(a.tabela.rateHEB).toBe(40);
    expect(bruto(a.tabela, dias)).toBe(470);
  });

  it("HR a 0: 8 h de descanso entre dois dias perdem 3 h × 60 € = 180 €", () => {
    // Dia 1: 08:00–22:00 = 14 h → 3 h de HE-A = 90 €. Dia 2 começa às 06:00:
    // descanso 22:00→06:00 = 8 h; faltam 3 h para as 11 → HR 3 h × 60 = 180 €.
    // Com a HR a 0: (220 + 90) + 220 = 530 €. Automática: 530 + 180 = 710 €.
    const dias = [dia({ fim: "22:00" }), dia({ data: "2026-07-02", inicio: "06:00", fim: "16:00" })];
    const t = tabela({ rateHR: 0 });
    expect(bruto(t, dias)).toBe(530);
    const a = avisoTaxasZero(folha(t, dias))!;
    expect(a.chaves).toEqual(["rateHR"]);
    expect(a.diferenca).toBe(180);
    expect(a.tabela.rateHR).toBe(60);
    expect(bruto(a.tabela, dias)).toBe(710);
  });

  it("as três a 0 (a folha típica do erro): 210 + 60 + 270 = 540 € a menos", () => {
    // Dia 1: 08:00–03:30 = 19,5 h → HE-A 7 h × 30 = 210 €; HE-B 1,5 h × 40 = 60 €.
    // Dia 2 começa às 10:00: descanso 03:30→10:00 = 6,5 h; faltam 4,5 h → HR 4,5 × 60 = 270 €.
    // Dia 2: 10:00–20:00 = 10 h, sem extras.
    // Com as taxas a 0: 220 + 220 = 440 €. Automáticas: 440 + 540 = 980 €.
    const dias = [dia({ fim: "03:30" }), dia({ data: "2026-07-02", inicio: "10:00", fim: "20:00" })];
    const t = tabela(ZEROS);
    expect(bruto(t, dias)).toBe(440);
    const a = avisoTaxasZero(folha(t, dias))!;
    expect(a.chaves).toEqual(["rateHEA", "rateHEB", "rateHR"]);
    expect(a.diferenca).toBe(540);
    expect(a.tabela).toMatchObject({ rateHEA: 30, rateHEB: 40, rateHR: 60 });
    expect(bruto(a.tabela, dias)).toBe(980);
  });

  it("a taxa corrigida é a que o editor semearia: 250 €/dia → HE-A 34,09 €/h", () => {
    // 250 ÷ 11 × 1,5 = 34,0909… → gravada 34,09. Dia de 12 h: 250 + 1 h × 34,09 = 284,09 €.
    const dias = [dia({ fim: "20:00" })];
    const a = avisoTaxasZero(folha(tabela({ salarioDia: 250, ...ZEROS }), dias))!;
    expect(a.tabela.rateHEA).toBe(34.09);
    expect(a.diferenca).toBe(34.09);
    expect(bruto(a.tabela, dias)).toBe(284.09);
  });

  it("HE a × 1 (hora normal): a taxa volta a vazia e segue o salário — 1 h × 20 € = 20 €", () => {
    // multHEA = 1 → a hora extra vale a hora normal, 20 €. Não se grava taxa (semeiaTaxaHE).
    const dias = [dia({ fim: "20:00" })];
    const a = avisoTaxasZero(folha(tabela({ multHEA: 1, rateHEA: 0 }), dias))!;
    expect(a.chaves).toEqual(["rateHEA"]);
    expect(a.diferenca).toBe(20);
    expect("rateHEA" in a.tabela).toBe(false);
    expect(bruto(a.tabela, dias)).toBe(240);
  });

  it("sem salário global mas com salário NO DIA: as horas extra desse dia também estavam a 0", () => {
    // Salário da folha 0; o dia tem 220 € escritos à mão → hora do dia = 20 €, HE-A 30 €/h.
    // 12 h → 1 h de HE-A. Com a taxa a 0: 220 €. Automática: 250 €.
    const dias = [dia({ fim: "20:00", salarioDia: 220 })];
    const t = tabela({ salarioDia: 0, ...ZEROS });
    expect(bruto(t, dias)).toBe(220);
    const a = avisoTaxasZero(folha(t, dias))!;
    expect(a.chaves).toEqual(["rateHEA"]);
    expect(a.diferenca).toBe(30);
    // sem salário global não há o que semear: fica vazia e o motor faz a conta pelo dia
    expect("rateHEA" in a.tabela).toBe(false);
    expect(bruto(a.tabela, dias)).toBe(250);
  });
});

describe("quando NÃO há nada a perguntar", () => {
  it("taxas a 0 mas sem horas extra (dia de 10 h)", () => {
    expect(avisoTaxasZero(folha(tabela(ZEROS), [dia()]))).toBeNull();
  });

  it("nenhuma taxa a 0", () => {
    expect(avisoTaxasZero(folha(tabela(), [dia({ fim: "20:00" })]))).toBeNull();
    expect(avisoTaxasZero(folha(tabela({ rateHEA: 12 }), [dia({ fim: "20:00" })]))).toBeNull();
  });

  it("sem salário nenhum: a automática também dava 0", () => {
    expect(avisoTaxasZero(folha(tabela({ salarioDia: 0, ...ZEROS }), [dia({ fim: "20:00" })]))).toBeNull();
  });

  it("o valor das horas extra do dia foi escrito à mão (50 €): a taxa não entra", () => {
    const dias = [dia({ fim: "20:00", heaValor: 50 })];
    expect(bruto(tabela(ZEROS), dias)).toBe(270); // 220 + 50
    expect(avisoTaxasZero(folha(tabela(ZEROS), dias))).toBeNull();
  });

  it("o total do dia foi negociado à mão (300 €)", () => {
    expect(avisoTaxasZero(folha(tabela(ZEROS), [dia({ fim: "20:00", totalDia: 300 })]))).toBeNull();
  });

  it("folha de cinema: o motor já ignora o 0 (cai no multiplicador)", () => {
    const cinema = tabela({ salarioDia: undefined, salarioSemana: 1250, diasSemana: 5, horasBase: 10, multHR: 2.5, ...ZEROS });
    const p = { formato: "cinema", dias: [dia({ fim: "21:00" })], tabela: cinema, fiscal: {} };
    expect(avisoTaxasZero(p)).toBeNull();
    // e também quando a folha perdeu a etiqueta `formato` num aparelho antigo
    expect(avisoTaxasZero({ ...p, formato: undefined })).toBeNull();
  });

  it("folha vazia ou por carregar", () => {
    expect(avisoTaxasZero(null)).toBeNull();
    expect(avisoTaxasZero(undefined)).toBeNull();
  });
});

describe("\"Está certo assim\"", () => {
  const dias = [dia({ fim: "03:30" }), dia({ data: "2026-07-02", inicio: "10:00", fim: "20:00" })];

  it("a taxa confirmada deixa de ser perguntada; as outras continuam", () => {
    // (as contas deste par de dias estão em "as três a 0": HE-A 210, HE-B 60, HR 270)
    const t = confirmarZeros(tabela(ZEROS), ["rateHR"]);
    expect(zerosConfirmados(t)).toEqual(["rateHR"]);
    const a = avisoTaxasZero(folha(t, dias))!;
    expect(a.chaves).toEqual(["rateHEA", "rateHEB"]);
    expect(a.diferenca).toBe(270); // 210 + 60: a HR fica a 0, como a pessoa disse
    expect(a.tabela.rateHR).toBe(0);
  });

  it("confirmadas todas, o aviso não volta — e a folha paga o mesmo que pagava", () => {
    const t = confirmarZeros(tabela(ZEROS), ["rateHEA", "rateHEB", "rateHR"]);
    expect(avisoTaxasZero(folha(t, dias))).toBeNull();
    expect(bruto(t, dias)).toBe(440);
  });

  it("confirmar não mexe em mais nada da tabela, nem duplica chaves", () => {
    const t0 = tabela(ZEROS);
    const t1 = confirmarZeros(confirmarZeros(t0, ["rateHEB"]), ["rateHEB", "rateHEA"]);
    expect(t1).toEqual({ ...t0, zeroOk: ["rateHEA", "rateHEB"] });
  });

  it("lixo no campo não parte nada", () => {
    expect(zerosConfirmados(tabela({ zeroOk: "rateHR" as any }))).toEqual([]);
    expect(zerosConfirmados(tabela({ zeroOk: ["rateHR", "outra", 3] as any }))).toEqual(["rateHR"]);
    expect(zerosConfirmados(null)).toEqual([]);
  });

  it("depois de \"Usar a taxa automática\" também não há mais nada a perguntar", () => {
    const a = avisoTaxasZero(folha(tabela(ZEROS), dias))!;
    expect(avisoTaxasZero(folha(a.tabela, dias))).toBeNull();
  });
});

describe("o salário escrito pela primeira vez", () => {
  it("tira as taxas que a semente antiga deixou a 0", () => {
    const antes = tabela({ salarioDia: 0, ...ZEROS });
    const depois = aoEscreverSalario(antes, { ...antes, salarioDia: 220 });
    expect(depois.salarioDia).toBe(220);
    expect("rateHEA" in depois).toBe(false);
    expect("rateHEB" in depois).toBe(false);
    expect("rateHR" in depois).toBe(false);
    // e a folha passa a pagar as horas extra: 12 h → 220 + 30 = 250 €
    expect(bruto(depois, [dia({ fim: "20:00" })])).toBe(250);
  });

  it("uma taxa com valor fica", () => {
    const antes = tabela({ salarioDia: 0, rateHEA: 25, rateHEB: 0, rateHR: 0 });
    const depois = aoEscreverSalario(antes, { ...antes, salarioDia: 220 });
    expect(depois.rateHEA).toBe(25);
    expect("rateHEB" in depois).toBe(false);
  });

  it("se a folha JÁ tinha salário, mudar o valor não tira nada (aí pergunta o aviso)", () => {
    const antes = tabela({ salarioDia: 200, ...ZEROS });
    const depois = { ...antes, salarioDia: 220 };
    expect(aoEscreverSalario(antes, depois)).toBe(depois);
  });

  it("um 0 confirmado (\"Está certo assim\") fica", () => {
    const antes = confirmarZeros(tabela({ salarioDia: 0, ...ZEROS }), ["rateHR"]);
    const depois = aoEscreverSalario(antes, { ...antes, salarioDia: 220 });
    expect(depois.rateHR).toBe(0);
    expect("rateHEA" in depois).toBe(false);
  });

  it("apagar o salário (volta a 0) não mexe em nada", () => {
    const antes = tabela(ZEROS);
    const depois = { ...antes, salarioDia: 0 };
    expect(aoEscreverSalario(antes, depois)).toBe(depois);
  });

  it("cinema não é mexido", () => {
    const antes = tabela({ salarioDia: undefined, salarioSemana: 0, diasSemana: 5, ...ZEROS });
    const depois = { ...antes, salarioSemana: 1250, salarioDia: 250 };
    expect(aoEscreverSalario(antes, depois)).toBe(depois);
  });
});

describe("folha nova a partir do perfil", () => {
  it("um 0 que vem do perfil nasce confirmado (só lá está se alguém o escreveu)", () => {
    const t = zerosDoPerfil(tabela({ rateHR: 0 }));
    expect(zerosConfirmados(t)).toEqual(["rateHR"]);
    // 8 h de descanso: a HR fica a 0 e ninguém pergunta
    const dias = [dia({ fim: "22:00" }), dia({ data: "2026-07-02", inicio: "06:00", fim: "16:00" })];
    expect(avisoTaxasZero(folha(t, dias))).toBeNull();
  });

  it("sem zeros, a tabela fica igual (sem campo novo)", () => {
    const t = tabela();
    expect(zerosDoPerfil(t)).toBe(t);
  });
});
