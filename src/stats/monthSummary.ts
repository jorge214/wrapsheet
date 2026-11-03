// src/stats/monthSummary.ts
import { calcProject } from "../calc/project";
import { effectiveFiscalOf, getSettings } from "../storage/appSettings";
import { belongsToProfile, Dia, listAllProjectsFull } from "../storage/projects";

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

type FiscalRegiao = { IRS_percent: number; IVA_percent: number };

/**
 * Cálculo de UM projeto com a regra fiscal do Dashboard: o fiscal da própria
 * folha e, se não houver, o efetivo da Região Fiscal (eff). Ponto único do
 * valor por linha, do resumo do mês e do do ano: o IRS/IVA do ano tem de bater
 * com a soma dos 12 meses (é a referência para conferir com as faturas do ano), e isso
 * só fica garantido se os três taxarem cada projeto pela mesma função.
 */
function calcComFiscal(p: any, eff: FiscalRegiao) {
  const rawFiscal: any = p.fiscal ?? {};
  const irsPct = normalizePercent(rawFiscal.IRS_percent ?? rawFiscal.irs ?? eff.IRS_percent) * 100;
  const ivaPct = normalizePercent(rawFiscal.IVA_percent ?? rawFiscal.iva ?? eff.IVA_percent) * 100;
  // O motor (publicidade/cinema) é escolhido pelo próprio projeto; a Segurança
  // Social só existe no cinema e vem da folha (sem fallback regional).
  return calcProject(p, { irs: irsPct, iva: ivaPct, SS_percent: rawFiscal.SS_percent } as any);
}

/** Minutos de horas extra de um projeto calculado (A + B + recuperação). */
function minutosExtra(pc: ReturnType<typeof calcProject>): number {
  let total = 0;
  for (const dc of pc.calc as any[]) {
    total += (dc?.HEA_min ?? 0) + (dc?.HEB_min ?? 0) + (dc?.HR_min ?? 0);
  }
  return total;
}

/**
 * Valor final (líquido / a receber) de UM projeto, com a MESMA regra fiscal do
 * Dashboard (ver calcComFiscal). Usado na lista de projetos para mostrar o
 * valor por linha.
 */
export function projectFinalValue(p: any, eff: FiscalRegiao): number {
  const totals = calcComFiscal(p, eff).totais;
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
  totalReceber: number; // projetos por pagar (BRUTO — dashboard)
  totalReceberLiquido: number; // projetos por pagar (LÍQUIDO — cartão da home)
  totalPago: number;    // projetos já pagos
};

/**
 * Devolve o resumo de um mês específico (mes = 1..12, ano = 2025, etc).
 */
export async function getMonthSummary(mes: number, ano: number, profileId?: string): Promise<MonthSummary> {
  const allRaw = await listAllProjectsFull();
  // Multi-perfil: se vier um profileId, conta só os projetos desse perfil
  // (legados sem profileId contam como do perfil ativo — ver belongsToProfile).
  const all = profileId ? allRaw.filter((p) => belongsToProfile(p, profileId)) : allRaw;

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
  let totalReceberLiquido = 0;
  let totalPago = 0;

  for (const p of inMonth) {
    // horas/dias
    for (const d of p.dias) {
      const mins = computeDayMinutes(d);
      if (!d.diaSemTrabalho && mins > 0) totalDiasTrabalho += 1;
      totalMinutos += mins;
    }

    // ✅ valores € (motor escolhido pelo formato do projeto; SS só no cinema)
    const pc = calcComFiscal(p, eff);

    // horas extra (A + B + recuperação)
    totalMinutosExtra += minutosExtra(pc);

    const totals = pc.totais;

    totalValorBruto += totals.ValorBruto;
    totalIRS += totals.IRS_valor;
    totalIVA += totals.IVA_valor;
    totalValorFinal += totals.ValorFinal;
    if (p.pago) {
      totalPago += totals.ValorFinal;
    } else {
      // "A Receber" em bruto (dashboard) e em líquido (cartão da home)
      totalReceber += totals.ValorBruto;
      totalReceberLiquido += totals.ValorFinal;
    }
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
    totalReceberLiquido: r2(totalReceberLiquido),
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
  /** Por receber LÍQUIDO (depois de impostos) — o que o dashboard e a página inicial mostram. */
  totalReceberLiquido: number;
  totalPago: number;

  // Impostos e horas extra do ano, com os mesmos nomes e a mesma regra do
  // resumo do mês. São uma referência para conferir com as faturas do ano —
  // não substituem o que está no Portal das Finanças.
  totalIRS: number;
  totalIVA: number;
  /** Horas extra (A + B + recuperação) */
  totalHorasExtra: number;
};

export async function getYearSummary(ano: number, profileId?: string): Promise<YearSummary> {
  const all = await listAllProjectsFull();
  const inYear = all.filter(
    (p: any) => p?.projeto?.ano === ano && (!profileId || belongsToProfile(p, profileId))
  );

  // Mesmo critério do resumo mensal: cada projeto com o fiscal da sua folha
  const eff = effectiveFiscalOf(await getSettings());

  let totalMinutos = 0;
  let totalMinutosExtra = 0;
  let totalDiasTrabalho = 0;
  let totalValorBruto = 0;
  let totalIRS = 0;
  let totalIVA = 0;
  let totalValorFinal = 0;
  let totalReceber = 0;
  let totalReceberLiquido = 0;
  let totalPago = 0;

  for (const p of inYear) {
    for (const d of p.dias) {
      const mins = computeDayMinutes(d);
      if (!d.diaSemTrabalho && mins > 0) totalDiasTrabalho += 1;
      totalMinutos += mins;
    }

    const pc = calcComFiscal(p, eff);
    totalMinutosExtra += minutosExtra(pc);
    const totals = pc.totais;

    // Cada projeto já vem arredondado ao cêntimo pelo motor, por isso somar o
    // ano projeto a projeto dá o mesmo que somar os 12 meses.
    totalValorBruto += totals.ValorBruto;
    totalIRS += totals.IRS_valor;
    totalIVA += totals.IVA_valor;
    totalValorFinal += totals.ValorFinal;
    if (p.pago) totalPago += totals.ValorFinal;
    else { totalReceber += totals.ValorBruto; totalReceberLiquido += totals.ValorFinal; }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return {
    ano,
    totalDiasTrabalho,
    totalHoras: r2(totalMinutos / 60),
    totalValorBruto: r2(totalValorBruto),
    totalValorFinal: r2(totalValorFinal),
    totalReceber: r2(totalReceber),
    totalReceberLiquido: r2(totalReceberLiquido),
    totalPago: r2(totalPago),
    totalIRS: r2(totalIRS),
    totalIVA: r2(totalIVA),
    // Das horas somadas em MINUTOS, não dos meses já arredondados às
    // centésimas: 20 min em março + 20 min em junho dá 0,67 h, não 0,66.
    totalHorasExtra: r2(totalMinutosExtra / 60),
  };
}

/**
 * Helper: resumo do mês atual.
 */
export async function getCurrentMonthSummary(profileId?: string): Promise<MonthSummary> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  return getMonthSummary(mes, ano, profileId);
}
