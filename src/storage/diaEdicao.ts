// Uma edição numa linha de dia da folha (o "ws:edit" de um dia no editor).
// Módulo puro, para se testar.
//
// No cinema (região PT), mudar a DATA de um dia volta a ver se é feriado
// obrigatório. Só quando a data muda de facto: o editor manda a data sempre
// que se sai da célula, mesmo sem mudança (para escolher a linha antes de
// "Duplicar", ou ao fechar o editor) — e um feriado marcado à mão (o 13 de
// junho em Lisboa, por exemplo, que não é nacional) desligava-se sozinho: o
// dia passava de dobrado a singelo, um dia de salário a menos no PDF. O mesmo
// ao contrário: um feriado nacional desligado à mão voltava a ligar-se.
import { isFeriadoPT } from "../calc/feriadosPT";

export function editarCampoDia<T extends { data?: string; folga?: boolean; feriado?: boolean }>(
  dia: T,
  campo: string,
  valor: unknown,
  cinemaPT: boolean
): T & { feriado?: boolean } {
  const y: any = { ...dia, [campo]: valor };
  if (campo === "data" && valor !== dia.data && cinemaPT && !y.folga) {
    y.feriado = isFeriadoPT(String(valor)) ? true : undefined;
  }
  return y;
}
