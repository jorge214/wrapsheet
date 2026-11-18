import { describe, expect, it } from "vitest";
import { calcProject } from "../calc/project";
import type { Dia, Tabela } from "../calc/types";
import { avisoTaxasZero, confirmarZeros, editarSalario, escreverTaxa, sementeTaxas, zerosConfirmados, zerosSemeados, type ChaveTaxa } from "./taxasZero";

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

// ─────────────────────────────────────────────────────────────────────────────
// O salário escrito na folha. O editor manda o texto da célula a CADA tecla
// (buildPdfHtml.ts, ouvinte 'input'), e o ecrã grava cada uma (num("") = 0).
// Estas sequências são as que a revisão de 18/11 apanhou com teclas reais no
// editor: tocar na célula seleciona "220"; ⌫ e depois 2, 5, 0 manda
// "", "2", "25", "250"; escrever por cima da seleção manda "2", "25", "250".
// `teclas` faz o mesmo que o case "tabela" de app/projects/[id].tsx: fotografa
// os zeros ao abrir (zerosSemeados) e passa cada tecla por editarSalario.
// ─────────────────────────────────────────────────────────────────────────────
const num = (v: string) => Number(String(v).replace(",", ".")) || 0;
function teclas(t0: Tabela, sequencia: string[], semeados0?: ChaveTaxa[]) {
  let t = t0;
  let semeados = semeados0 ?? zerosSemeados(t0);
  for (const v of sequencia) ({ tabela: t, semeados } = editarSalario(t, num(v), semeados));
  return { tabela: t, semeados };
}
// 01/07 das 08:00 às 22:00 (14 h → 3 h de HE-A) e 02/07 das 06:00 às 16:00:
// descanso 22:00→06:00 = 8 h; faltam 3 h para as 11 → 3 h de HR.
const DOIS_DIAS = [dia({ fim: "22:00" }), dia({ data: "2026-07-02", inicio: "06:00", fim: "16:00" })];

describe("o salário escrito na folha", () => {
  it("folha que ABRIU sem salário: escrever 220 tira os zeros que a semente antiga lá deixou", () => {
    const { tabela: t, semeados } = teclas(tabela({ salarioDia: 0, ...ZEROS }), ["2", "22", "220"]);
    expect(t.salarioDia).toBe(220);
    expect("rateHEA" in t).toBe(false);
    expect("rateHEB" in t).toBe(false);
    expect("rateHR" in t).toBe(false);
    expect(semeados).toEqual([]); // não há mais nada a tirar
    // e a folha passa a pagar as horas extra: 12 h → 220 + 1 h × 30 = 250 €
    expect(bruto(t, [dia({ fim: "20:00" })])).toBe(250);
  });

  it("uma taxa com valor fica (só saem os zeros)", () => {
    const { tabela: t } = teclas(tabela({ salarioDia: 0, rateHEA: 25, rateHEB: 0, rateHR: 0 }), ["2", "22", "220"]);
    expect(t.rateHEA).toBe(25);
    expect("rateHEB" in t).toBe(false);
    expect("rateHR" in t).toBe(false);
  });

  it("folha COM salário e a HR a 0 por confirmar: apagar e reescrever (\"\", \"2\", \"25\", \"250\") não tira o 0 — 590 € e o aviso continua a perguntar", () => {
    // HE-A e HE-B já semeadas (30 e 40, do salário de 220); a HR a 0, sem resposta.
    const t0 = tabela({ rateHEA: 30, rateHEB: 40, rateHR: 0 });
    expect(zerosSemeados(t0)).toEqual([]); // abriu com salário: nada a tirar
    const { tabela: t } = teclas(t0, ["", "2", "25", "250"]);
    expect(t.salarioDia).toBe(250);
    expect(t.rateHR).toBe(0);
    expect(t.rateHEA).toBe(30); // gravada: não segue o salário
    // Dia 1: 250 + 3 h × 30 = 340 €; dia 2: 250 €; HR 3 h × 0 = 0 → 590 €
    expect(bruto(t, DOIS_DIAS)).toBe(590);
    // O aviso pergunta: HR automática = 250 ÷ 11 × 3 = 68,1818… → 68,18 €/h; 3 h × 68,18 = 204,54 €
    const a = avisoTaxasZero(folha(t, DOIS_DIAS))!;
    expect(a.chaves).toEqual(["rateHR"]);
    expect(a.diferenca).toBe(204.54);
  });

  it("escrever por cima da seleção dá o MESMO resultado que apagar primeiro", () => {
    const t0 = tabela({ rateHEA: 30, rateHEB: 40, rateHR: 0 });
    expect(teclas(t0, ["2", "25", "250"]).tabela).toEqual(teclas(t0, ["", "2", "25", "250"]).tabela);
  });

  it("apagar dígito a dígito e reescrever (\"22\", \"2\", \"\", \"2\", \"25\", \"250\") também não tira o 0", () => {
    const { tabela: t } = teclas(tabela({ rateHEA: 30, rateHEB: 40, rateHR: 0 }), ["22", "2", "", "2", "25", "250"]);
    expect(t.rateHR).toBe(0);
    expect(bruto(t, DOIS_DIAS)).toBe(590);
  });

  it("reescrever o MESMO salário (220 → \"\" → 220) não mexe num 0 de propósito", () => {
    const t0 = tabela({ rateHEA: 0 });
    const { tabela: t } = teclas(t0, ["", "2", "22", "220"]);
    // igual, mais a marca de que esta folha já teve salário (semSemente)
    expect(t).toEqual({ ...t0, semSemente: true });
  });

  it("apagar o salário, SAIR e voltar (fotografia nova), reescrever 250: o 0 fica — 590 € e o aviso pergunta", () => {
    // Sessão 1: a folha tinha 220 e a HR a 0 de propósito; apaga-se a célula (fica 0) e sai-se.
    const r1 = teclas(tabela({ rateHEA: 30, rateHEB: 40, rateHR: 0 }), [""]);
    expect(r1.tabela.salarioDia).toBe(0);
    // Sessão 2: a folha reabre sem salário — mas já teve, por isso o 0 não é semente
    expect(zerosSemeados(r1.tabela)).toEqual([]);
    const r2 = teclas(r1.tabela, ["2", "25", "250"]);
    expect(r2.tabela.rateHR).toBe(0);
    // (contas em "folha COM salário e a HR a 0 por confirmar": 340 + 250 + 0)
    expect(bruto(r2.tabela, DOIS_DIAS)).toBe(590);
    expect(avisoTaxasZero(folha(r2.tabela, DOIS_DIAS))!.diferenca).toBe(204.54);
  });

  it("uma tecla que não muda o salário (\"250,0\" = 250) não grava nada — nem a marca", () => {
    const t0 = tabela({ salarioDia: 250 });
    expect(editarSalario(t0, 250, []).tabela).toEqual(t0);
  });

  it("uma taxa escrita numa folha antiga com zeros da semente: marca-se e os OUTROS zeros saem já — reabrir e escrever 220 dá 710 €", () => {
    const t0 = tabela({ salarioDia: 0, ...ZEROS });
    const r = escreverTaxa(t0, "rateHR", 60, zerosSemeados(t0));
    expect(r.tabela.rateHR).toBe(60);
    expect("rateHEA" in r.tabela).toBe(false);
    expect("rateHEB" in r.tabela).toBe(false);
    expect(r.semeados).toEqual([]);
    expect(zerosSemeados(r.tabela)).toEqual([]); // reabrir: nada a separar
    const { tabela: t } = teclas(r.tabela, ["2", "22", "220"]);
    // Dia 1 (14 h): 220 + 3 h × 30 = 310 €; dia 2: 220 €; HR escrita: 3 h × 60 = 180 € → 710 €
    expect(bruto(t, DOIS_DIAS)).toBe(710);
  });

  it("um 0 escrito numa taxa é escolha: fica, mesmo depois de reabrir e escrever o salário", () => {
    const t0 = tabela({ salarioDia: 0 });
    const r = escreverTaxa(t0, "rateHR", 0, zerosSemeados(t0));
    expect(r.tabela.rateHR).toBe(0);
    expect(zerosSemeados(r.tabela)).toEqual([]);
    expect(teclas(r.tabela, ["2", "22", "220"]).tabela.rateHR).toBe(0);
  });

  it("escrever numa taxa o valor que ela já tinha não muda nada (nem marca)", () => {
    const t0 = tabela({ rateHEA: 30 });
    expect(escreverTaxa(t0, "rateHEA", 30, []).tabela).toEqual(t0);
  });

  it("uma folha com a marca semSemente (nova desta versão) não tem zeros a tirar", () => {
    const t0 = { ...tabela({ salarioDia: 0, rateHR: 0 }), semSemente: true } as Tabela;
    expect(zerosSemeados(t0)).toEqual([]);
    expect(teclas(t0, ["2", "22", "220"]).tabela.rateHR).toBe(0);
  });

  it("depois da 1.ª vez, um 0 posto à mão sobrevive a apagar e reescrever o salário", () => {
    // Abriu sem salário (zeros da semente antiga); escreveu 220 → saem.
    let r = teclas(tabela({ salarioDia: 0, ...ZEROS }), ["2", "22", "220"]);
    // Depois pôs a HR a 0 de propósito, e mais tarde mudou o salário para 300.
    r = teclas({ ...r.tabela, rateHR: 0 }, ["", "3", "30", "300"], r.semeados);
    expect(r.tabela.salarioDia).toBe(300);
    expect(r.tabela.rateHR).toBe(0);
  });

  it("um 0 posto ANTES de escrever o salário, numa folha que abriu sem zeros, fica", () => {
    const t0 = tabela({ salarioDia: 0 });
    const semeados = zerosSemeados(t0); // [] — não havia zeros ao abrir
    const { tabela: t } = teclas({ ...t0, rateHR: 0 }, ["2", "22", "220"], semeados);
    expect(t.rateHR).toBe(0);
  });

  it("um 0 confirmado (\"Está certo assim\") fica; os outros saem", () => {
    const t0 = confirmarZeros(tabela({ salarioDia: 0, ...ZEROS }), ["rateHR"]);
    expect(zerosSemeados(t0)).toEqual(["rateHEA", "rateHEB"]);
    const { tabela: t } = teclas(t0, ["2", "22", "220"]);
    expect(t.rateHR).toBe(0);
    expect("rateHEA" in t).toBe(false);
    expect("rateHEB" in t).toBe(false);
  });

  it("apagar o salário (fica a 0) não mexe em nada", () => {
    const { tabela: t } = teclas(tabela(ZEROS), [""]);
    expect(t.salarioDia).toBe(0);
    expect(t).toMatchObject(ZEROS);
  });

  it("cinema: nada a tirar (o motor já ignora o 0)", () => {
    const cinema = tabela({ salarioDia: undefined, salarioSemana: 0, diasSemana: 5, ...ZEROS });
    expect(zerosSemeados(cinema)).toEqual([]);
    expect(zerosSemeados(null)).toEqual([]);
  });
});
