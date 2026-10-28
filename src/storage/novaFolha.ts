// Datas com que uma folha NOVA nasce. Módulo puro (sem AsyncStorage), para se
// testar; `hoje` entra como argumento pela mesma razão.
//
// A lista de projetos cria a folha no mês que está a ser visto. Até à 1.2.2 a
// folha de publicidade nascia SEMPRE com a data de hoje: em outubro, criar a
// folha de novembro (ou a de maio, atrasada) dava um projeto de novembro com o
// 1.º dia em outubro. E a de cinema só sabia "esta semana": quem começa na
// segunda seguinte tinha de mudar as 7 datas uma a uma.
import dayjs from "dayjs";

function eMesCorrente(hoje: dayjs.Dayjs, mes?: number, ano?: number): boolean {
  return mes == null || ano == null || (mes === hoje.month() + 1 && ano === hoje.year());
}

/** Publicidade: no mês corrente, hoje; noutro mês, o dia 1 desse mês. */
export function primeiroDiaPublicidade(mes?: number, ano?: number, hoje: dayjs.Dayjs = dayjs()): string {
  if (eMesCorrente(hoje, mes, ano)) return hoje.format("YYYY-MM-DD");
  return dayjs(new Date(ano!, mes! - 1, 1)).format("YYYY-MM-DD");
}

/**
 * Cinema: a segunda-feira da semana da folha. No mês corrente, a desta semana;
 * noutro mês, a 1.ª segunda desse mês. `semanas` avança semanas inteiras
 * (1 = a semana seguinte).
 */
export function segundaDaSemana(mes?: number, ano?: number, semanas = 0, hoje: dayjs.Dayjs = dayjs()): dayjs.Dayjs {
  let base: dayjs.Dayjs;
  if (eMesCorrente(hoje, mes, ano)) {
    base = hoje.subtract((hoje.day() + 6) % 7, "day").startOf("day");
  } else {
    const first = dayjs(new Date(ano!, mes! - 1, 1));
    base = first.add((8 - first.day()) % 7, "day").startOf("day");
  }
  return base.add(7 * semanas, "day");
}

/**
 * Mês a que pertence uma folha de cinema nova. Normalmente o mês em foco; mas a
 * semana SEGUINTE escolhida no fim do mês corrente cai no mês a seguir (quarta
 * 28/10 → semana de 02/11) e aí fica no mês da segunda-feira — como faz o
 * "Semana seguinte" de uma folha existente (duplicateProjectNextWeek). Senão
 * aparecia em outubro, contava nos totais de outubro e o PDF dizia "Outubro"
 * por cima de datas de novembro.
 */
export function mesDaFolhaCinema(mes?: number, ano?: number, semanas = 0, hoje: dayjs.Dayjs = dayjs()): { mes: number; ano: number } {
  if (semanas > 0) {
    const seg = segundaDaSemana(mes, ano, semanas, hoje);
    return { mes: seg.month() + 1, ano: seg.year() };
  }
  return { mes: mes ?? hoje.month() + 1, ano: ano ?? hoje.year() };
}
