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
};

/**
 * Returns true when dateB is exactly one calendar day after dateA (YYYY-MM-DD).
 * Used by calcAll to decide whether to compute rest/HR between consecutive days.
 */
function isNextCalendarDay(dateA: string, dateB: string): boolean {
  if (!dateA || !dateB) return false;
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return false;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) === 1;
}

/** Minutos entre a meia-noite de duas datas ISO — para o descanso contar os DIAS
 *  reais, não só o relógio (acabar às 20:00 e começar às 21:00 do dia seguinte
 *  são 25h, não 1h). Fallback de 1 dia se alguma data for inválida. */
function dayGapMinutes(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 24 * 60;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) * 24 * 60;
}

export function calcDay(dia: Dia, prox: Dia | undefined, tabela: Tabela): CalcDia {
  // Fix #5: non-work days produce no salary, no overtime, no rest penalty
  if (dia.diaSemTrabalho) return { ...ZERO_DAY };

  // Fix #6/#10: defaults — H_dia=11 matches industry standard (salarioDia is the day rate
  // for an 11-hour day); descanso_min is in HOURS (field name is misleading), default 11h
  const H_dia_h      = tabela.H_dia      ?? 11;
  const limiarA_h    = tabela.limiar_A   ?? 11;
  const limiarB_h    = tabela.limiar_B   ?? 18;
  const descansoMin_h = tabela.limiar_HR ?? tabela.descanso_min ?? 11; // HR threshold in hours

  const multHEA = tabela.multHEA ?? 1.5;
  const multHEB = tabela.multHEB ?? 2.0;
  const multHR  = tabela.multHR  ?? 3.0;

  // Salário do dia: usa o override por-dia se existir, senão o global da tabela
  const salarioDiaEfetivo = (dia.salarioDia ?? tabela.salarioDia) ?? 0;
  const horaBase = H_dia_h > 0 ? salarioDiaEfetivo / H_dia_h : 0;

  // Se a taxa €/hora foi editada diretamente na folha, usa-a; senão deriva de salário/H × multiplicador
  const rateHEA = tabela.rateHEA ?? (horaBase * multHEA);
  const rateHEB = tabela.rateHEB ?? (horaBase * multHEB);
  const rateHR  = tabela.rateHR  ?? (horaBase * multHR);

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
export function calcTotals(diasCalc: CalcDia[], fiscal: Fiscal | any) {
  const ValorBruto = round2(diasCalc.reduce((s, c) => s + c.totalDia, 0));

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

  const IRS_valor  = round2(ValorBruto * (irsPct / 100));
  const IVA_valor  = round2(ValorBruto * (ivaPct / 100));
  const ValorFinal = round2(ValorBruto - IRS_valor + IVA_valor);

  return { ValorBruto, IRS_valor, IVA_valor, ValorFinal };
}
