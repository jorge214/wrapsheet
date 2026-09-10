// src/calc/cinema.ts
// Folha de CINEMA (semanal): o que muda em relação à publicidade.
//
//  • A semana define o dia (salarioSemana / diasSemana) e a hora vale
//    salário-dia / 10 (10h de trabalho + 1h de refeição = 11h de horário).
//    Isso vive em ratesFor() no motor; aqui trata-se do DESCANSO.
//  • Cada linha tem "horas de descanso", como no guia da folha:
//      dia trabalhado  → do fim ao início do dia seguinte (se trabalhado) ou
//                        até à meia-noite;
//      folga sem horas → 24h (ou até ao início do dia seguinte, se trabalhado).
//  • Entre semanas: soma-se o descanso desde o ÚLTIMO dia normal (não-folga)
//    até ao início da semana seguinte (linha "B": data + hora). Se ficar
//    abaixo de 60h (36h em semanas de 6 dias), a diferença cobra-se como
//    Horas de Recuperação à taxa a DOBRAR (a mesma dos dias de folga).
//      ex.: sex 05:00 + sáb 24:00 + dom 24:00 + (dom 24:00 → seg 07:00) = 60:00
//  • Sem hora de início da semana seguinte (ou 00:00 = última semana de
//    rodagem), o défice mostra-se mas NÃO se cobra — é o que o guia manda.
import {
  calcDay, dayGapMinutes, diaComHoras, hmToMinutes, isNextCalendarDay, ratesFor, round2,
} from "./engine";
import type { CalcDia, Dia, Tabela } from "./types";

export type ProximaSemana = { data?: string; inicio?: string };
export type CinemaOverrides = { hrSemanaHoras?: number; hrSemanaValor?: number };

export type CalcSemana = {
  /** Soma das horas de descanso desde o último dia normal até ao início da semana seguinte */
  descanso_min: number;
  /** Parte "meia-noite do último dia → início da semana seguinte" (linha B) */
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

/** Descanso de cada linha (minutos), como no guia da folha. */
export function restPerRow(dias: Dia[]): number[] {
  return dias.map((d, i) => {
    if (d.diaSemTrabalho) return 0;
    const next = dias[i + 1];
    const consecutive = !!next && !next.diaSemTrabalho && isNextCalendarDay(d.data, next.data);
    const start = worked(d) ? fimCorrDe(d) : 0;
    // Até ao início do dia seguinte se este for trabalhado; senão até à
    // meia-noite (a folga seguinte conta as suas 24h; a última linha deixa o
    // resto para a linha B — início da semana seguinte).
    const end = consecutive && worked(next) ? 1440 + hmToMinutes(next.inicio) : 1440;
    return Math.max(0, end - start);
  });
}

/** Como calcAll, mas com o descanso por linha do cinema. A recuperação
 *  DIÁRIA (< 10h entre dois dias trabalhados consecutivos) mantém-se. */
export function calcAllCinema(dias: Dia[], tabela: Tabela): CalcDia[] {
  const rest = restPerRow(dias);
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

  // Soma desde o ÚLTIMO dia normal (não-folga) — é assim que o guia conta:
  // sex 05:00 + sáb 24:00 + dom 24:00 + (dom 24:00 → seg 07:00) = 60:00.
  let lastRegular = -1;
  dias.forEach((d, i) => { if (isRegular(d)) lastRegular = i; });
  let descansoLinhas = 0;
  for (let i = Math.max(0, lastRegular); i < dias.length; i++) descansoLinhas += calc[i]?.HD_min ?? 0;

  const ultimo = dias[dias.length - 1];
  const temInicio = !!(prox?.data && prox?.inicio && /^\d{1,2}:\d{2}$/.test(prox.inicio));
  const inicioProx = temInicio ? hmToMinutes(prox!.inicio!) : 0;
  const cobravel = temInicio && inicioProx > 0;

  let segmento_min = 0;
  if (temInicio && ultimo?.data) {
    // dayGapMinutes conta de meia-noite a meia-noite; a linha B começa na
    // meia-noite do fim do último dia, daí o −1440.
    const gap = dayGapMinutes(ultimo.data, prox!.data!);
    segmento_min = Math.max(0, gap - 1440 + inicioProx);
  }

  const descanso_min = descansoLinhas + segmento_min;
  const saldo_min = descanso_min - alvo_min;
  const R = ratesFor(tabela);
  const rateHR_folga = round2(R.rateHR * R.multFolga);
  const deficit = cobravel ? Math.max(0, -saldo_min) : 0;
  const HR_h = ov?.hrSemanaHoras != null ? ov.hrSemanaHoras : roundHalfUpHours(deficit);
  const HR_valor = ov?.hrSemanaValor != null ? round2(ov.hrSemanaValor) : round2(HR_h * rateHR_folga);

  return { descanso_min, segmento_min, alvo_min, saldo_min, cobravel, HR_h, rateHR_folga, HR_valor };
}
