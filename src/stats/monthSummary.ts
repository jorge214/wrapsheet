// src/stats/monthSummary.ts
import { calcAll, calcTotals } from "../calc/engine";
import { effectiveFiscalOf, getSettings } from "../storage/appSettings";
import { Dia, listAllProjectsFull } from "../storage/projects";

/**
 * Converte "HH:MM" em minutos (ex: "08:30" -> 510).
 */
function parseTimeToMinutes(hhmm: string): number {
  if (!hhmm) return 0;
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Fix #11: mirrors engine.ts HT_min calculation exactly.
 * Meals worked during a break (<1h) and transport are ADDED to the wall-clock span,
 * matching what the project editor shows per day.
 */
function computeDayMinutes(dia: Dia): number {
  if (dia.diaSemTrabalho) return 0;

  const inicio = parseTimeToMinutes(dia.inicio);
  const fim = parseTimeToMinutes(dia.fim);
  let total = fim - inicio;
  if (total < 0) total += 24 * 60; // overnight shift
  if (total <= 0) return 0;

  // Cap meals at 59 min each (matching engine behaviour)
  const refeicao  = Math.min(parseTimeToMinutes(dia.refeicaoTrabalho), 59);
  const jantar    = Math.min(parseTimeToMinutes(dia.jantarTrabalho),   59);
  const transporte = Math.max(0, Math.round(dia.tempoTransporteMin || 0));

  return total + refeicao + jantar + transporte;
}

function normalizePercent(v: any): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  // Fix #7: use >= 1 so that 1% input (n=1) is treated as percent, not as decimal 1.0 = 100%
  return n >= 1 ? n / 100 : n;
}

/**
 * Valor final (líquido / a receber) de UM projeto, com a MESMA regra fiscal do
 * Dashboard: o fiscal da própria folha e, se não houver, o efetivo da Região
 * Fiscal (eff). Usado na lista de projetos para mostrar o valor por linha.
 */
export function projectFinalValue(
  p: any,
  eff: { IRS_percent: number; IVA_percent: number }
): number {
  const diasCalc = calcAll(p.dias, p.tabela);
  const rawFiscal: any = p.fiscal ?? {};
  const irsPct = normalizePercent(rawFiscal.IRS_percent ?? rawFiscal.irs ?? eff.IRS_percent) * 100;
  const ivaPct = normalizePercent(rawFiscal.IVA_percent ?? rawFiscal.iva ?? eff.IVA_percent) * 100;
  const totals = calcTotals(diasCalc, { irs: irsPct, iva: ivaPct } as any);
  return Math.round((totals.ValorFinal || 0) * 100) / 100;
}

/**
 * Resumo de horas + valores de um mês.
 */
export type MonthSummary = {
  mes: number;
  ano: number;
  totalProjects: number;
  activeProjects: number; // projetos não pagos (ativos / a receber) no mês
  totalDiasTrabalho: number;
  totalHoras: number;
  totalMinutos: number;

  // horas extra (A + B + recuperação)
  totalHorasExtra: number;

  // ✅ NOVO: totais € do mês
  totalValorBruto: number;
  totalIRS: number;
  totalIVA: number;
  totalValorFinal: number;

  // Split por estado de pagamento (valor final)
  totalReceber: number; // projetos por pagar
  totalPago: number;    // projetos já pagos
};

/**
 * Devolve o resumo de um mês específico (mes = 1..12, ano = 2025, etc).
 */
export async function getMonthSummary(mes: number, ano: number): Promise<MonthSummary> {
  const all = await listAllProjectsFull();

  // Cada projeto é taxado com o fiscal DA SUA FOLHA (podem coexistir 5
  // regimes no mesmo mês — trabalhos em países diferentes). As taxas da
  // Região Fiscal servem só de fallback para projetos sem fiscal gravado.
  const eff = effectiveFiscalOf(await getSettings());

  const inMonth = all.filter((p: any) => p?.projeto?.mes === mes && p?.projeto?.ano === ano);

  let totalMinutos = 0;
  let totalMinutosExtra = 0;
  let totalDiasTrabalho = 0;

  let totalValorBruto = 0;
  let totalIRS = 0;
  let totalIVA = 0;
  let totalValorFinal = 0;
  let totalReceber = 0;
  let totalPago = 0;

  for (const p of inMonth) {
    // horas/dias
    for (const d of p.dias) {
      const mins = computeDayMinutes(d);
      if (!d.diaSemTrabalho && mins > 0) totalDiasTrabalho += 1;
      totalMinutos += mins;
    }

    // ✅ valores €
    const diasCalc = calcAll(p.dias, p.tabela);

    // horas extra (A + B + recuperação)
    for (const dc of diasCalc as any[]) {
      totalMinutosExtra +=
        (dc?.HEA_min ?? 0) + (dc?.HEB_min ?? 0) + (dc?.HR_min ?? 0);
    }

    const rawFiscal: any = p.fiscal ?? {};
    const irsPct = normalizePercent(rawFiscal.IRS_percent ?? rawFiscal.irs ?? eff.IRS_percent) * 100;
    const ivaPct = normalizePercent(rawFiscal.IVA_percent ?? rawFiscal.iva ?? eff.IVA_percent) * 100;
    const totals = calcTotals(diasCalc, { irs: irsPct, iva: ivaPct } as any);

    totalValorBruto += totals.ValorBruto;
    totalIRS += totals.IRS_valor;
    totalIVA += totals.IVA_valor;
    totalValorFinal += totals.ValorFinal;
    if (p.pago) totalPago += totals.ValorFinal;
    else totalReceber += totals.ValorBruto;
  }

  const totalHoras = totalMinutos / 60;

  // arredondar a 2 casas (para não acumular floats)
  const r2 = (n: number) => Math.round(n * 100) / 100;

  return {
    mes,
    ano,
    totalProjects: inMonth.length,
    activeProjects: inMonth.filter((p: any) => !p.pago).length,
    totalDiasTrabalho,
    totalHoras,
    totalMinutos,
    totalHorasExtra: r2(totalMinutosExtra / 60),

    totalValorBruto: r2(totalValorBruto),
    totalIRS: r2(totalIRS),
    totalIVA: r2(totalIVA),
    totalValorFinal: r2(totalValorFinal),
    totalReceber: r2(totalReceber),
    totalPago: r2(totalPago),
  };
}

/**
 * Resumo acumulado de um ano inteiro (todos os meses).
 */
export type YearSummary = {
  ano: number;
  totalDiasTrabalho: number;
  totalHoras: number;
  totalValorBruto: number;
  totalValorFinal: number;
  totalReceber: number;
  totalPago: number;
};

export async function getYearSummary(ano: number): Promise<YearSummary> {
  const all = await listAllProjectsFull();
  const inYear = all.filter((p: any) => p?.projeto?.ano === ano);

  // Mesmo critério do resumo mensal: cada projeto com o fiscal da sua folha
  const eff = effectiveFiscalOf(await getSettings());

  let totalMinutos = 0;
  let totalDiasTrabalho = 0;
  let totalValorBruto = 0;
  let totalValorFinal = 0;
  let totalReceber = 0;
  let totalPago = 0;

  for (const p of inYear) {
    for (const d of p.dias) {
      const mins = computeDayMinutes(d);
      if (!d.diaSemTrabalho && mins > 0) totalDiasTrabalho += 1;
      totalMinutos += mins;
    }

    const diasCalc = calcAll(p.dias, p.tabela);
    const rawFiscal: any = p.fiscal ?? {};
    const irsPct = normalizePercent(rawFiscal.IRS_percent ?? rawFiscal.irs ?? eff.IRS_percent) * 100;
    const ivaPct = normalizePercent(rawFiscal.IVA_percent ?? rawFiscal.iva ?? eff.IVA_percent) * 100;
    const totals = calcTotals(diasCalc, { irs: irsPct, iva: ivaPct } as any);

    totalValorBruto += totals.ValorBruto;
    totalValorFinal += totals.ValorFinal;
    if (p.pago) totalPago += totals.ValorFinal;
    else totalReceber += totals.ValorBruto;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return {
    ano,
    totalDiasTrabalho,
    totalHoras: r2(totalMinutos / 60),
    totalValorBruto: r2(totalValorBruto),
    totalValorFinal: r2(totalValorFinal),
    totalReceber: r2(totalReceber),
    totalPago: r2(totalPago),
  };
}

/**
 * Helper: resumo do mês atual.
 */
export async function getCurrentMonthSummary(): Promise<MonthSummary> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  return getMonthSummary(mes, ano);
}
