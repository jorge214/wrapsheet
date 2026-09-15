// src/calc/cinema.ts
// Folha de CINEMA (semanal): o que muda em relação à publicidade.
//
//  • A semana define o dia (salarioSemana / diasSemana) e a hora vale
//    salário-dia / 10 (10h de trabalho + 1h de refeição = 11h de horário).
//    Isso vive em ratesFor() no motor; aqui trata-se do DESCANSO.
//  • Cada linha tem "horas de descanso":
//      dia trabalhado  → do fim ao início do dia seguinte, se este for
//                        trabalhado;
//      ÚLTIMO dia trabalhado da semana → do fim até ao início da semana
//                        seguinte, INCLUINDO as folgas sem horas que se lhe
//                        seguem (24h cada). É aqui que a folha mostra o
//                        descanso do fim de semana; as folgas ficam em branco.
//      folga sem horas → 0 depois do último dia trabalhado (já contada nele);
//                        24h se ficar a meio da semana.
//  • Entre semanas: soma-se o descanso desde o ÚLTIMO dia normal (não-folga)
//    até ao início da semana seguinte. Se ficar abaixo de 60h (36h em semanas
//    de 6 dias), a diferença cobra-se como Horas de Recuperação à taxa a
//    DOBRAR (a mesma dos dias de folga).
//      ex.: sex 19:00 → 24:00 (5h) + sáb 24h + dom 24h + (dom 24:00 → seg 07:00)
//           = 60:00, tudo mostrado na sexta-feira.
//  • Se se trabalhar num dia de folga, o descanso volta a contar dia a dia,
//    como durante a semana (o sábado trabalhado passa a ser o "último dia").
//  • Sem hora de início da semana seguinte (ou 00:00 = última semana de
//    rodagem), o défice mostra-se mas NÃO se cobra — é o que o guia manda.
import {
  calcDay, dayGapMinutes, diaComHoras, hmToMinutes, isNextCalendarDay, ratesFor, round2,
} from "./engine";
import type { CalcDia, Dia, Tabela } from "./types";

export type ProximaSemana = { data?: string; inicio?: string; numero?: string };
export type CinemaOverrides = { hrSemanaHoras?: number; hrSemanaValor?: number };

export type CalcSemana = {
  /** Soma das horas de descanso desde o último dia normal até ao início da semana seguinte */
  descanso_min: number;
  /** Parte "meia-noite do último dia → início da semana seguinte" (já incluída no descanso) */
  segmento_min: number;
  /** 60h (5 dias) ou 36h (6 dias) */
  alvo_min: number;
  /** descanso − alvo (negativo = défice) */
  saldo_min: number;
  /** Há hora de início da semana seguinte (≠ 00:00)? Só então se cobra. */
  cobravel: boolean;
  /** Horas de recuperação (arredondadas à hora; override se existir) */
  HR_h: number;
  /** Taxa €/h da recuperação a dobrar */
  rateHR_folga: number;
  /** € (override se existir) */
  HR_valor: number;
};

/** Divisor do valor-hora no cinema (10h de trabalho por dia). */
export const HORAS_BASE_CINEMA = 10;
/** Descanso mínimo entre semanas, por nº de dias de trabalho. */
export const DESCANSO_SEMANAL_H: Record<number, number> = { 5: 60, 6: 36 };

/** Linha "normal" da semana (não é folga). */
const isRegular = (d: Dia) => !d.folga && !d.diaSemTrabalho;
/** Dia trabalhado: tem horário (uma folga COM horas é trabalhada). */
const worked = (d: Dia) => !d.diaSemTrabalho && diaComHoras(d);

function fimCorrDe(d: Dia): number {
  const ini = hmToMinutes(d.inicio);
  const fim = hmToMinutes(d.fim);
  return fim < ini ? fim + 1440 : fim;
}

/** Minutos da meia-noite do último dia da folha até ao início da semana
 *  seguinte (linha B). 0 sem data/hora válidas. */
function segmentoSemanaSeguinte(dias: Dia[], prox?: ProximaSemana): number {
  const ultimo = dias[dias.length - 1];
  const temInicio = !!(prox?.data && prox?.inicio && /^\d{1,2}:\d{2}$/.test(prox.inicio));
  if (!temInicio || !ultimo?.data) return 0;
  // dayGapMinutes conta de meia-noite a meia-noite; a linha B começa na
  // meia-noite do fim do último dia, daí o −1440.
  return Math.max(0, dayGapMinutes(ultimo.data, prox!.data!) - 1440 + hmToMinutes(prox!.inicio!));
}

/** Descanso de cada linha (minutos) — ver regras no cabeçalho do ficheiro. */
export function restPerRow(dias: Dia[], prox?: ProximaSemana): number[] {
  let lastWorked = -1;
  dias.forEach((d, i) => { if (worked(d)) lastWorked = i; });
  const segmento = segmentoSemanaSeguinte(dias, prox);

  return dias.map((d, i) => {
    if (d.diaSemTrabalho) return 0;

    if (i === lastWorked) {
      // Do fim até à meia-noite, mais 24h por cada folga sem horas que se
      // segue em dias consecutivos, mais o troço até à semana seguinte.
      let rest = Math.max(0, 1440 - fimCorrDe(d));
      let prev = d;
      for (let j = i + 1; j < dias.length; j++) {
        const f = dias[j];
        if (f.diaSemTrabalho) continue;
        if (!isNextCalendarDay(prev.data, f.data)) break; // salto de datas: pára
        rest += 1440;
        prev = f;
      }
      return rest + segmento;
    }
    // Folga sem horas depois do último dia trabalhado: já está contada nele.
    if (i > lastWorked) return 0;

    const next = dias[i + 1];
    const consecutive = !!next && !next.diaSemTrabalho && isNextCalendarDay(d.data, next.data);
    const start = worked(d) ? fimCorrDe(d) : 0;
    const end = consecutive && worked(next) ? 1440 + hmToMinutes(next.inicio) : 1440;
    return Math.max(0, end - start);
  });
}

/** Como calcAll, mas com o descanso por linha do cinema. A recuperação
 *  DIÁRIA (< 10h entre dois dias trabalhados consecutivos) mantém-se. */
export function calcAllCinema(dias: Dia[], tabela: Tabela, prox?: ProximaSemana): CalcDia[] {
  const rest = restPerRow(dias, prox);
  return dias.map((d, i) => {
    const next = dias[i + 1];
    const proxParaHR =
      next && isNextCalendarDay(d.data, next.data) && worked(d) && worked(next) ? next : undefined;
    return calcDay(d, proxParaHR, tabela, { restMin: rest[i] });
  });
}

/** "A meia hora é arredondada à hora seguinte": 4h30 → 5h; 4h15 → 4h. */
export function roundHalfUpHours(min: number): number {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  return m % 60 >= 30 ? h + 1 : h;
}

export function calcSemanaCinema(
  dias: Dia[],
  calc: CalcDia[],
  tabela: Tabela,
  prox?: ProximaSemana,
  ov?: CinemaOverrides
): CalcSemana {
  const nDias = Number(tabela.diasSemana) || 5;
  const alvo_min = Math.round((tabela.descansoSemanal_h ?? DESCANSO_SEMANAL_H[nDias] ?? 60) * 60);

  // Soma desde o ÚLTIMO dia normal (não-folga). O troço até à semana seguinte
  // já vem dentro do último dia trabalhado (restPerRow), por isso não se soma
  // outra vez.
  let lastRegular = -1;
  dias.forEach((d, i) => { if (isRegular(d)) lastRegular = i; });
  let descanso_min = 0;
  for (let i = Math.max(0, lastRegular); i < dias.length; i++) descanso_min += calc[i]?.HD_min ?? 0;

  const segmento_min = segmentoSemanaSeguinte(dias, prox);
  const temInicio = !!(prox?.data && prox?.inicio && /^\d{1,2}:\d{2}$/.test(prox.inicio));
  const cobravel = temInicio && hmToMinutes(prox!.inicio!) > 0;

  const saldo_min = descanso_min - alvo_min;
  const R = ratesFor(tabela);
  const rateHR_folga = round2(R.rateHR * R.multFolga);
  const deficit = cobravel ? Math.max(0, -saldo_min) : 0;
  const HR_h = ov?.hrSemanaHoras != null ? ov.hrSemanaHoras : roundHalfUpHours(deficit);
  const HR_valor = ov?.hrSemanaValor != null ? round2(ov.hrSemanaValor) : round2(HR_h * rateHR_folga);

  return { descanso_min, segmento_min, alvo_min, saldo_min, cobravel, HR_h, rateHR_folga, HR_valor };
}
