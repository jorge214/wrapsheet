// src/calc/engine.ts
import { CalcDia, Dia, Fiscal, Tabela } from "./types";

export const CURRENCY = "€";

export function hmToMinutes(hm: string): number {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minutesToHM(mins: number): string {
  const sign = mins < 0 ? "-" : "";
  const v = Math.abs(mins);
  const h = Math.floor(v / 60);
  const m = v % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

// For display only — rounds to 2 decimal places
export const minutesToHoursDec = (mins: number) => round2(mins / 60);

// For monetary calculations — no intermediate rounding to avoid systematic bias
const minutesToHoursRaw = (mins: number) => mins / 60;

const ZERO_DAY: CalcDia = {
  HT_min: 0, HD_min: 0,
  HEA_min: 0, HEB_min: 0, HR_min: 0,
  HEA_h: 0, HEB_h: 0, HR_h: 0,
  HEA_valor: 0, HEB_valor: 0, HR_valor: 0,
  salarioDia: 0, ajudasTotal: 0, totalDia: 0,
  ajRef: 0, ajViat: 0, ajTel: 0, ajMat: 0, ajPer: 0,
  dobra: 1, descanso: false,
};

/**
 * Returns true when dateB is exactly one calendar day after dateA (YYYY-MM-DD).
 * Used by calcAll to decide whether to compute rest/HR between consecutive days.
 */
export function isNextCalendarDay(dateA: string, dateB: string): boolean {
  if (!dateA || !dateB) return false;
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return false;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) === 1;
}

/** Minutos entre a meia-noite de duas datas ISO — para o descanso contar os DIAS
 *  reais, não só o relógio (acabar às 20:00 e começar às 21:00 do dia seguinte
 *  são 25h, não 1h). Fallback de 1 dia se alguma data for inválida. */
export function dayGapMinutes(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 24 * 60;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) * 24 * 60;
}

/** Taxas efetivas da tabela — o que a folha mostra na linha de valores e o
 *  que o motor usa por omissão. Cinema: a SEMANA define o dia (salarioSemana /
 *  diasSemana) e a hora vale salário/horasBase (10h). Publicidade: salarioDia
 *  e salário/H_dia — exatamente como sempre. */
export function ratesFor(tabela: Tabela) {
  const nDias = Number(tabela.diasSemana) || 0;
  const semana = Number(tabela.salarioSemana);
  const salarioDia =
    tabela.salarioSemana != null && Number.isFinite(semana) && nDias > 0
      ? semana / nDias
      : Number(tabela.salarioDia ?? 0) || 0;
  const H_dia_h = tabela.H_dia ?? 11;
  const divisor = tabela.horasBase ?? H_dia_h;
  const horaBase = divisor > 0 ? salarioDia / divisor : 0;
  const multHEA = tabela.multHEA ?? 1.5;
  const multHEB = tabela.multHEB ?? 2.0;
  const multHR = tabela.multHR ?? 3.0;
  return {
    salarioDia,
    horaBase,
    rateHEA: tabela.rateHEA ?? horaBase * multHEA,
    rateHEB: tabela.rateHEB ?? horaBase * multHEB,
    rateHR: tabela.rateHR ?? horaBase * multHR,
    multFolga: tabela.multFolga ?? 2,
  };
}

/** Dia com horário preenchido (início e fim válidos e diferentes). */
export function diaComHoras(dia: Dia): boolean {
  if (!dia.inicio || !dia.fim) return false;
  return hmToMinutes(dia.inicio) !== hmToMinutes(dia.fim);
}

export type CalcDayOpts = {
  /** Descanso do dia calculado fora (cinema: fim → meia-noite, 24h nas
   *  folgas…). Substitui o HD_min interno; a recuperação DIÁRIA continua a
   *  depender de `prox` (só há HR entre dois dias trabalhados consecutivos). */
  restMin?: number;
};

export function calcDay(dia: Dia, prox: Dia | undefined, tabela: Tabela, opts?: CalcDayOpts): CalcDia {
  // Fix #5: non-work days produce no salary, no overtime, no rest penalty
  if (dia.diaSemTrabalho) return { ...ZERO_DAY };

  // Cinema: linha de FOLGA sem horas = descanso. 0 € (sem salário, sem HE,
  // ajudas só se forçadas no dia), mas conta horas de descanso para o
  // intervalo entre semanas (opts.restMin).
  if (dia.folga && !diaComHoras(dia)) {
    const ajR = dia.ajRefeicao ?? 0, ajV = dia.ajViatura ?? 0, ajT = dia.ajTelefone ?? 0;
    const ajM = dia.ajMaterial ?? 0, ajP = dia.ajPerDiem ?? 0;
    const ajudasTotal = round2(ajR + ajV + ajT + ajM + ajP);
    return {
      ...ZERO_DAY,
      HD_min: Math.max(0, Math.round(opts?.restMin ?? 0)),
      ajRef: round2(ajR), ajViat: round2(ajV), ajTel: round2(ajT), ajMat: round2(ajM), ajPer: round2(ajP),
      ajudasTotal,
      totalDia: dia.totalDia != null ? round2(dia.totalDia) : ajudasTotal,
      descanso: true,
    };
  }

  // Fix #6/#10: defaults — H_dia=11 matches industry standard (salarioDia is the day rate
  // for an 11-hour day); descanso_min is in HOURS (field name is misleading), default 11h
  const H_dia_h      = tabela.H_dia      ?? 11;
  const limiarA_h    = tabela.limiar_A   ?? 11;
  const limiarB_h    = tabela.limiar_B   ?? 18;
  const descansoMin_h = tabela.limiar_HR ?? tabela.descanso_min ?? 11; // HR threshold in hours

  const multHEA = tabela.multHEA ?? 1.5;
  const multHEB = tabela.multHEB ?? 2.0;
  const multHR  = tabela.multHR  ?? 3.0;
  const R = ratesFor(tabela);

  // Dia de folga TRABALHADO ou feriado (cinema): salário e taxas a dobrar.
  // Publicidade nunca marca folga/feriado → dobra = 1, tudo como antes.
  const dobra = (dia.feriado || (dia.folga && diaComHoras(dia))) ? R.multFolga : 1;

  // Salário do dia: o override por-dia (escrito na folha) é o valor FINAL desse
  // dia — não se dobra; sem override, o global da tabela × dobra.
  const salarioDiaEfetivo = dia.salarioDia ?? (R.salarioDia * dobra);
  // Valor-hora: base do dia (override ou global) ÷ divisor (cinema: 10h;
  // publicidade: H_dia). A dobra entra depois, nas taxas.
  const baseHora = dia.salarioDia ?? R.salarioDia;
  const divisor = tabela.horasBase ?? H_dia_h;
  const horaBase = divisor > 0 ? baseHora / divisor : 0;

  // Se a taxa €/hora foi editada diretamente na folha, usa-a; senão deriva de salário/H × multiplicador
  const rateHEA = (tabela.rateHEA ?? (horaBase * multHEA)) * dobra;
  const rateHEB = (tabela.rateHEB ?? (horaBase * multHEB)) * dobra;
  const rateHR  = (tabela.rateHR  ?? (horaBase * multHR)) * dobra;

  const ini = hmToMinutes(dia.inicio);
  const fim = hmToMinutes(dia.fim);
  const refeicaoMin   = Math.min(hmToMinutes(dia.refeicaoTrabalho), 59);
  const jantarMin     = Math.min(hmToMinutes(dia.jantarTrabalho), 59);
  const transporteMin = Math.max(0, Math.round(dia.tempoTransporteMin || 0));

  // Overnight shift support: if fim < ini, add 24h
  const fimCorr = fim < ini ? fim + 24 * 60 : fim;
  let HT_min = Math.max(0, fimCorr - ini) + refeicaoMin + jantarMin + transporteMin;

  // Fix #9: optional half-hour rounding
  if (tabela.arredondarMeiasHoras) {
    HT_min = Math.round(HT_min / 30) * 30;
  }

  const limA_min  = limiarA_h * 60;
  const limB_min  = limiarB_h * 60;
  const H_dia_min = H_dia_h   * 60;

  const heA_window_min = Math.max(0, Math.min(HT_min, limB_min) - Math.max(H_dia_min, limA_min));
  const heB_min        = Math.max(0, HT_min - limB_min);
  const heA_min        = Math.max(0, heA_window_min);

  let HD_min = 0;
  let HR_min = 0;

  if (prox) {
    // Descanso entre dias = do FIM deste dia ao INÍCIO do seguinte, contando as
    // DATAS reais (não só o relógio). fimCorr já inclui a passagem da meia-noite
    // (turnos que acabam de madrugada); somamos os dias de calendário entre as
    // duas datas. Assim, acabar às 20:00 e começar às 21:00 do dia seguinte dá
    // 25h — antes dava 1h (só subtraía as horas do relógio).
    const inicioAmanha = hmToMinutes(prox.inicio);
    const gapMin       = dayGapMinutes(dia.data, prox.data);
    HD_min = Math.max(0, gapMin + inicioAmanha - fimCorr);
    HR_min = Math.max(0, Math.round((descansoMin_h * 60) - HD_min));
  }
  // Descanso vindo de fora (cinema): é o que a folha mostra e o que entra no
  // intervalo entre semanas. A recuperação diária (acima) fica como está.
  if (opts?.restMin != null) HD_min = Math.max(0, Math.round(opts.restMin));

  const salarioDia = round2(salarioDiaEfetivo * (dia.meioDia ? 0.5 : 1));

  // Ajudas: override do dia ?? valor global (cada dia é negociado com o produtor)
  const aj = tabela.ajudas || { refeicao: 0, viatura: 0, material: 0, telefone: 0, perDiem: 0 };
  const ajRef  = dia.ajRefeicao ?? aj.refeicao ?? 0;
  const ajViat = dia.ajViatura  ?? aj.viatura  ?? 0;
  const ajTel  = dia.ajTelefone ?? aj.telefone ?? 0;
  const ajMat  = dia.ajMaterial ?? aj.material ?? 0;
  const ajPer  = dia.ajPerDiem  ?? aj.perDiem  ?? 0;
  const ajudasTotal = round2(ajRef + ajViat + ajTel + ajMat + ajPer);

  // Horas extra: contagem forçada no dia (se editada) sobrepõe-se à calculada
  const heA_minEff = dia.heaHoras != null ? Math.round(dia.heaHoras * 60) : heA_min;
  const heB_minEff = dia.hebHoras != null ? Math.round(dia.hebHoras * 60) : heB_min;
  const HR_minEff  = dia.hrHoras  != null ? Math.round(dia.hrHoras  * 60) : HR_min;

  // Fix #12: use raw (unrounded) hours for monetary calc to avoid intermediate rounding bias
  const eurHEA = dia.heaValor != null ? round2(dia.heaValor) : round2(minutesToHoursRaw(heA_minEff) * rateHEA);
  const eurHEB = dia.hebValor != null ? round2(dia.hebValor) : round2(minutesToHoursRaw(heB_minEff) * rateHEB);
  const eurHR  = dia.hrValor  != null ? round2(dia.hrValor)  : round2(minutesToHoursRaw(HR_minEff)  * rateHR);

  // Total do dia negociado à mão ganha à soma automática (ex.: dia de
  // preparação em que as 15h são pagas como normais — o utilizador zera as
  // HE e escreve o total acordado). Vazio na folha = volta a esta soma.
  const totalDia = dia.totalDia != null
    ? round2(dia.totalDia)
    : round2(salarioDia + eurHEA + eurHEB + eurHR + ajudasTotal);

  return {
    HT_min,
    HD_min,
    HEA_min: heA_minEff,
    HEB_min: heB_minEff,
    HR_min: HR_minEff,
    HEA_h: minutesToHoursDec(heA_minEff),
    HEB_h: minutesToHoursDec(heB_minEff),
    HR_h:  minutesToHoursDec(HR_minEff),
    HEA_valor: eurHEA, // Fix #1: expose per-component euro values
    HEB_valor: eurHEB,
    HR_valor:  eurHR,
    salarioDia,
    ajudasTotal,
    totalDia,
    ajRef: round2(ajRef), ajViat: round2(ajViat), ajTel: round2(ajTel), ajMat: round2(ajMat), ajPer: round2(ajPer),
    dobra,
    descanso: false,
  };
}

export function calcAll(dias: Dia[], tabela: Tabela): CalcDia[] {
  return dias.map((d, i) => {
    const prox = dias[i + 1];
    // Fix #8: only pass prox for rest calc when it is literally the next calendar day.
    // Non-consecutive days (gaps, weekends between shoots) must not trigger HR penalties.
    const consecutive = prox && isNextCalendarDay(d.data, prox.data);
    return calcDay(d, consecutive ? prox : undefined, tabela);
  });
}

/**
 * Calculates gross, IRS, IVA and net totals.
 *
 * Fix #13: reads IRS_percent / IVA_percent first (canonical field names).
 * Legacy keys (irs / iva) are accepted as fallback for old stored projects.
 * Fix #7: decimal detection uses strict < 1 (not <= 1) so that 1% is never
 * misread as 100%.
 */
export function calcTotals(
  diasCalc: CalcDia[],
  fiscal: Fiscal | any,
  opts?: { /** € a somar ao bruto fora dos dias (cinema: recuperação entre semanas) */ extraBruto?: number }
) {
  const ValorBruto = round2(diasCalc.reduce((s, c) => s + c.totalDia, 0) + (Number(opts?.extraBruto) || 0));

  const irsRaw = Number(
    fiscal?.IRS_percent ??
    fiscal?.irs         ??
    fiscal?.IRS         ??
    fiscal?.irsPercent  ??
    fiscal?.irs_percent ??
    0
  );

  const ivaRaw = Number(
    fiscal?.IVA_percent ??
    fiscal?.iva         ??
    fiscal?.IVA         ??
    fiscal?.ivaPercent  ??
    fiscal?.iva_percent ??
    0
  );

  // Strictly-less-than-1 guard: 0.25 → 25%, but 1 stays as 1% (not 100%)
  const irsPct = irsRaw > 0 && irsRaw < 1 ? irsRaw * 100 : irsRaw;
  const ivaPct = ivaRaw > 0 && ivaRaw < 1 ? ivaRaw * 100 : ivaRaw;

  // Segurança Social (cinema): retida como o IRS. Ausente = 0 → nada muda.
  const ssRaw = Number(fiscal?.SS_percent ?? fiscal?.ss ?? fiscal?.SS ?? 0);
  const ssPct = ssRaw > 0 && ssRaw < 1 ? ssRaw * 100 : ssRaw;

  const IRS_valor  = round2(ValorBruto * (irsPct / 100));
  const IVA_valor  = round2(ValorBruto * (ivaPct / 100));
  const SS_valor   = round2(ValorBruto * (ssPct / 100));
  const ValorFinal = round2(ValorBruto - IRS_valor - SS_valor + IVA_valor);

  return { ValorBruto, IRS_valor, IVA_valor, SS_valor, ValorFinal };
}
