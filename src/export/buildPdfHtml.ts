// src/export/buildPdfHtml.ts
// Pure HTML-building logic — no platform dependencies.
// Imported by pdf.ts (native) and pdf.web.ts (web).

import { minutesToHM } from "../calc/engine";
import { CalcDia, Dia } from "../calc/types";

export type PdfPerfil = {
  nome: string;
  email: string;
  telefone: string;
  departamento: string;
  funcao: string;
  empresa?: string;
  nif?: string;
  iban?: string;
  swift?: string;
};

export type PdfProjeto = {
  titulo?: string;
  filme: string;
  produtora: string;
  nifProdutora?: string;
  semana?: string;
  mes: number;
  ano: number;
};

export type PdfTabela = {
  salarioDia: number;
  H_dia: number;
  descanso_min: number;
  multHEA?: number;
  multHEB?: number;
  multHR?: number;
  rateHEA?: number;
  rateHEB?: number;
  rateHR?: number;
  limiar_A?: number;
  limiar_B?: number;
  ajudas?: {
    refeicao?: number;
    viatura?: number;
    material?: number;
    telefone?: number;
    perDiem?: number;
  };
};

export type PdfTotais = {
  ValorBruto: number;
  IRS_valor: number;
  IVA_valor: number;
  ValorFinal: number;
};

// ── Locale strings ─────────────────────────────────────────────────────────────

const STRINGS = {
  pt: {
    title: "PUBLICIDADE",
    subtitle: "Folha de Pagamentos",
    personalData: "DADOS PESSOAIS",
    film: "FILME:",
    name: "NOME:",
    role: "FUNÇÃO:",
    phone: "TELEFONE:",
    email: "EMAIL:",
    companySection: "EMPRESA",
    companyLabel: "EMPRESA:",
    nif: "NIF:",
    iban: "IBAN:",
    swift: "SWIFT:",
    productionSection: "PRODUTORA",
    productionLabel: "PRODUTORA:",
    productionNif: "NIF:",
    totalDays: "Total Dias",
    issuedOn: "Emitido a",
    month: "Mês",
    year: "Ano",
    vb: "Valor Bruto",
    vf: "Valor Final",
    salary: "SALÁRIO",
    overtimeA: "HORA EXTRA A",
    overtimeB: "HORA EXTRA B",
    recoveryHours: "HORA RECUPERAÇÃO",
    meal: "REFEIÇÃO",
    perDiem: "PER DIEMS",
    telephone: "TELEFONE",
    vehicle: "VIATURA",
    material: "MATERIAL",
    day: "DIA",
    date: "DATA",
    schedule: "HORÁRIO",
    totalHours: "TOTAL HORAS",
    description: "DESCRIÇÃO",
    start: "INÍCIO",
    mealBreak: "REFEIÇÃO",
    end: "FIM",
    workHours: "HORAS TRABALHO",
    restHours: "HORAS DESCANSO",
    perDay: "Por dia",
    total: "TOTAL",
    value: "VALOR",
    notes: "Notas",
    perHour: "/hora",
    perDayUnit: "/dia",
    overtimeAFull: "HORAS EXTRA A",
    overtimeBFull: "HORAS EXTRA B",
    recoveryFull: "HORAS RECUPERAÇÃO",
    gross: "TOTAL",
    irs: "IRS",
    iva: "IVA",
    net: "VALOR",
    workConditions: "CONDIÇÕES DE TRABALHO",
  },
  en: {
    title: "ADVERTISING",
    subtitle: "Timesheet",
    personalData: "PERSONAL DATA",
    film: "FILM:",
    name: "NAME:",
    role: "ROLE:",
    phone: "PHONE:",
    email: "EMAIL:",
    companySection: "COMPANY",
    companyLabel: "COMPANY:",
    nif: "TAX ID:",
    iban: "IBAN:",
    swift: "SWIFT:",
    productionSection: "PRODUCTION COMPANY",
    productionLabel: "COMPANY:",
    productionNif: "TAX ID:",
    totalDays: "Total Days",
    issuedOn: "Issued on",
    month: "Month",
    year: "Year",
    vb: "Gross",
    vf: "Net",
    salary: "SALARY",
    overtimeA: "OVERTIME A",
    overtimeB: "OVERTIME B",
    recoveryHours: "RECOVERY HOURS",
    meal: "MEAL",
    perDiem: "PER DIEMS",
    telephone: "PHONE",
    vehicle: "VEHICLE",
    material: "MATERIAL",
    day: "DAY",
    date: "DATE",
    schedule: "SCHEDULE",
    totalHours: "TOTAL HOURS",
    description: "DESCRIPTION",
    start: "START",
    mealBreak: "MEAL",
    end: "END",
    workHours: "WORK HOURS",
    restHours: "REST HOURS",
    perDay: "Per day",
    total: "TOTAL",
    value: "VALUE",
    notes: "Notes",
    perHour: "/hour",
    perDayUnit: "/day",
    overtimeAFull: "OVERTIME A",
    overtimeBFull: "OVERTIME B",
    recoveryFull: "RECOVERY HOURS",
    gross: "TOTAL",
    irs: "IRS",
    iva: "VAT",
    net: "VALUE",
    workConditions: "WORKING CONDITIONS",
  },
  es: {
    title: "PUBLICIDAD",
    subtitle: "Hoja de Pagos",
    personalData: "DATOS PERSONALES",
    film: "PELÍCULA:",
    name: "NOMBRE:",
    role: "FUNCIÓN:",
    phone: "TELÉFONO:",
    email: "EMAIL:",
    companySection: "EMPRESA",
    companyLabel: "EMPRESA:",
    nif: "NIF:",
    iban: "IBAN:",
    swift: "SWIFT:",
    productionSection: "PRODUCTORA",
    productionLabel: "PRODUCTORA:",
    productionNif: "NIF:",
    totalDays: "Total Días",
    issuedOn: "Emitido el",
    month: "Mes",
    year: "Año",
    vb: "Valor Bruto",
    vf: "Valor Final",
    salary: "SALARIO",
    overtimeA: "HORA EXTRA A",
    overtimeB: "HORA EXTRA B",
    recoveryHours: "HORA RECUPERACIÓN",
    meal: "COMIDA",
    perDiem: "PER DIEMS",
    telephone: "TELÉFONO",
    vehicle: "VEHÍCULO",
    material: "MATERIAL",
    day: "DÍA",
    date: "FECHA",
    schedule: "HORARIO",
    totalHours: "TOTAL HORAS",
    description: "DESCRIPCIÓN",
    start: "INICIO",
    mealBreak: "COMIDA",
    end: "FIN",
    workHours: "HORAS TRABAJO",
    restHours: "HORAS DESCANSO",
    perDay: "Por día",
    total: "TOTAL",
    value: "VALOR",
    notes: "Notas",
    perHour: "/hora",
    perDayUnit: "/día",
    overtimeAFull: "HORAS EXTRA A",
    overtimeBFull: "HORAS EXTRA B",
    recoveryFull: "HORAS RECUPERACIÓN",
    gross: "TOTAL",
    irs: "IRPF",
    iva: "IVA",
    net: "VALOR",
    workConditions: "CONDICIONES DE TRABAJO",
  },
  fr: {
    title: "PUBLICITÉ",
    subtitle: "Feuille de Paie",
    personalData: "DONNÉES PERSONNELLES",
    film: "FILM :",
    name: "NOM :",
    role: "FONCTION :",
    phone: "TÉLÉPHONE :",
    email: "EMAIL :",
    companySection: "SOCIÉTÉ",
    companyLabel: "SOCIÉTÉ :",
    nif: "SIRET :",
    iban: "IBAN :",
    swift: "SWIFT :",
    productionSection: "SOCIÉTÉ DE PRODUCTION",
    productionLabel: "SOCIÉTÉ :",
    productionNif: "SIRET :",
    totalDays: "Total Jours",
    issuedOn: "Émis le",
    month: "Mois",
    year: "Année",
    vb: "Brut",
    vf: "Net",
    salary: "SALAIRE",
    overtimeA: "HEURE SUP A",
    overtimeB: "HEURE SUP B",
    recoveryHours: "HEURE RÉCUPÉRATION",
    meal: "REPAS",
    perDiem: "PER DIEMS",
    telephone: "TÉLÉPHONE",
    vehicle: "VÉHICULE",
    material: "MATÉRIEL",
    day: "JOUR",
    date: "DATE",
    schedule: "HORAIRE",
    totalHours: "TOTAL HEURES",
    description: "DESCRIPTION",
    start: "DÉBUT",
    mealBreak: "REPAS",
    end: "FIN",
    workHours: "HEURES TRAVAIL",
    restHours: "HEURES REPOS",
    perDay: "Par jour",
    total: "TOTAL",
    value: "VALEUR",
    notes: "Notes",
    perHour: "/heure",
    perDayUnit: "/jour",
    overtimeAFull: "HEURES SUP A",
    overtimeBFull: "HEURES SUP B",
    recoveryFull: "HEURES RÉCUPÉRATION",
    gross: "TOTAL",
    irs: "IR",
    iva: "TVA",
    net: "VALEUR",
    workConditions: "CONDITIONS DE TRAVAIL",
  },
  de: {
    title: "WERBUNG",
    subtitle: "Gehaltsabrechnung",
    personalData: "PERSÖNLICHE DATEN",
    film: "FILM:",
    name: "NAME:",
    role: "FUNKTION:",
    phone: "TELEFON:",
    email: "E-MAIL:",
    companySection: "UNTERNEHMEN",
    companyLabel: "UNTERNEHMEN:",
    nif: "STEUERNR.:",
    iban: "IBAN:",
    swift: "SWIFT:",
    productionSection: "PRODUKTIONSFIRMA",
    productionLabel: "FIRMA:",
    productionNif: "STEUERNR.:",
    totalDays: "Gesamttage",
    issuedOn: "Ausgestellt am",
    month: "Monat",
    year: "Jahr",
    vb: "Brutto",
    vf: "Netto",
    salary: "GEHALT",
    overtimeA: "ÜBERSTUNDEN A",
    overtimeB: "ÜBERSTUNDEN B",
    recoveryHours: "ERHOLUNGSZEIT",
    meal: "VERPFLEGUNG",
    perDiem: "TAGEGELD",
    telephone: "TELEFON",
    vehicle: "FAHRZEUG",
    material: "MATERIAL",
    day: "TAG",
    date: "DATUM",
    schedule: "ZEITPLAN",
    totalHours: "GESAMTSTUNDEN",
    description: "BESCHREIBUNG",
    start: "BEGINN",
    mealBreak: "PAUSE",
    end: "ENDE",
    workHours: "ARBEITSSTUNDEN",
    restHours: "RUHEZEIT",
    perDay: "Pro Tag",
    total: "GESAMT",
    value: "WERT",
    notes: "Notizen",
    perHour: "/Std.",
    perDayUnit: "/Tag",
    overtimeAFull: "ÜBERSTUNDEN A",
    overtimeBFull: "ÜBERSTUNDEN B",
    recoveryFull: "ERHOLUNGSZEIT",
    gross: "GESAMT",
    irs: "ESt",
    iva: "MwSt",
    net: "WERT",
    workConditions: "ARBEITSBEDINGUNGEN",
  },
  uk: {
    title: "ADVERTISING",
    subtitle: "Timesheet",
    personalData: "PERSONAL DATA",
    film: "FILM:",
    name: "NAME:",
    role: "ROLE:",
    phone: "PHONE:",
    email: "EMAIL:",
    companySection: "COMPANY",
    companyLabel: "COMPANY:",
    nif: "UTR / VAT No.:",
    iban: "IBAN:",
    swift: "SWIFT:",
    productionSection: "PRODUCTION COMPANY",
    productionLabel: "COMPANY:",
    productionNif: "VAT No.:",
    totalDays: "Total Days",
    issuedOn: "Issued on",
    month: "Month",
    year: "Year",
    vb: "Gross",
    vf: "Net",
    salary: "SALARY",
    overtimeA: "OVERTIME A",
    overtimeB: "OVERTIME B",
    recoveryHours: "RECOVERY HOURS",
    meal: "MEAL",
    perDiem: "PER DIEMS",
    telephone: "PHONE",
    vehicle: "VEHICLE",
    material: "MATERIAL",
    day: "DAY",
    date: "DATE",
    schedule: "SCHEDULE",
    totalHours: "TOTAL HOURS",
    description: "DESCRIPTION",
    start: "START",
    mealBreak: "MEAL",
    end: "END",
    workHours: "WORK HOURS",
    restHours: "REST HOURS",
    perDay: "Per day",
    total: "TOTAL",
    value: "VALUE",
    notes: "Notes",
    perHour: "/hour",
    perDayUnit: "/day",
    overtimeAFull: "OVERTIME A",
    overtimeBFull: "OVERTIME B",
    recoveryFull: "RECOVERY HOURS",
    gross: "TOTAL",
    irs: "Income Tax",
    iva: "VAT",
    net: "VALUE",
    workConditions: "WORKING CONDITIONS",
  },
};

export function getStrings(locale: string, region?: string) {
  // UI language takes priority; region is only used as fallback
  const lang = locale.toLowerCase();
  if (lang.startsWith("pt")) return STRINGS.pt;
  if (lang.startsWith("en")) {
    // UK region gets UK-specific English labels (UTR, VAT No., etc.)
    return (region ?? "").toLowerCase() === "uk" ? STRINGS.uk : STRINGS.en;
  }
  if (lang.startsWith("es")) return STRINGS.es;
  if (lang.startsWith("fr")) return STRINGS.fr;
  if (lang.startsWith("de")) return STRINGS.de;
  // Fallback to region
  const r = (region ?? "").toLowerCase();
  if (r === "uk") return STRINGS.uk;
  if (r === "de") return STRINGS.de;
  if (r === "fr") return STRINGS.fr;
  if (r === "es") return STRINGS.es;
  return STRINGS.pt;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeStr(v: any) {
  return v == null ? "" : String(v);
}

export function fmtMoney(n: number, currency = "EUR") {
  const locale = currency === "GBP" ? "en-GB" : "pt-PT";
  return Number(n || 0).toLocaleString(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
}

function fmtNum(n: number, digits = 1) {
  return Number(n || 0).toFixed(digits).replace(".", ",");
}

function getMonthName(m: number, locale: string) {
  const date = new Date(2000, (m ?? 1) - 1, 1);
  const name = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatDatePT(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function headerRow(label: string, value: string) {
  return `
    <div class="row">
      <div class="k">${escapeHtml(label)}</div>
      <div class="v">${escapeHtml(value)}</div>
    </div>
  `;
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildPdfHtml(
  perfil: PdfPerfil,
  projeto: PdfProjeto,
  dias: Dia[],
  calculos: CalcDia[],
  totais: PdfTotais,
  tabela: PdfTabela,
  notas?: string,
  locale: string = "pt",
  region?: string,
  currency: string = "EUR",
  taxDisclaimer?: string,
  condicoes?: string
): string {
  const s = getStrings(locale, region);
  const fmt = (n: number) => fmtMoney(n, currency);

  const salarioDia = Number(tabela.salarioDia || 0);
  const multHEA = Number(tabela.multHEA ?? 1.5);
  const multHEB = Number(tabela.multHEB ?? 2.0);
  const multHR  = Number(tabela.multHR  ?? 3.0);

  const vHEA = tabela.rateHEA ?? (salarioDia ? (salarioDia / (tabela.H_dia || 8)) * multHEA : 0);
  const vHEB = tabela.rateHEB ?? (salarioDia ? (salarioDia / (tabela.H_dia || 8)) * multHEB : 0);
  const vHR  = tabela.rateHR  ?? (salarioDia ? (salarioDia / (tabela.H_dia || 8)) * multHR  : 0);

  const aj = tabela.ajudas ?? {};
  const valRef  = Number(aj.refeicao  ?? 0);
  const valPer  = Number(aj.perDiem   ?? 0);
  const valTel  = Number(aj.telefone  ?? 0);
  const valViat = Number(aj.viatura   ?? 0);
  const valMat  = Number(aj.material  ?? 0);

  const totalDias = dias.reduce(
    (acc, d) => acc + (d.diaSemTrabalho ? 0 : d.meioDia ? 0.5 : 1),
    0
  );

  const today = new Date();
  const emitidoA = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;

  const mesNome     = getMonthName(projeto.mes, locale);
  const mesAnoLabel = `${mesNome} ${projeto.ano}`;

  const dayRows = dias
    .map((d, i) => {
      const c = calculos[i];
      return `
        <tr>
          <td class="left">${escapeHtml(d.descricao || "")}</td>
          <td>${escapeHtml(formatDatePT(d.data))}</td>
          <td class="right">${fmt((d as any).salarioDia ?? salarioDia)}</td>
          <td>${escapeHtml(d.inicio || "")}</td>
          <td>${escapeHtml(d.refeicaoTrabalho || "")}</td>
          <td>${escapeHtml(d.fim || "")}</td>
          <td>${escapeHtml(minutesToHM(c?.HT_min ?? 0))}</td>
          <td class="blue">${escapeHtml(minutesToHM(c?.HD_min ?? 0))}</td>
          <td class="right">${fmt(valRef)}</td>
          <td class="right">${fmt(valPer)}</td>
          <td class="right">${fmt(valTel)}</td>
          <td class="right">${fmt(valViat)}</td>
          <td class="right">${fmt(valMat)}</td>
          <td class="right">${fmtNum((c?.HEA_min ?? 0) / 60, 1)}</td>
          <td class="right">${fmt(c?.HEA_valor ?? 0)}</td>
          <td class="right">${fmtNum((c?.HEB_min ?? 0) / 60, 1)}</td>
          <td class="right">${fmt(c?.HEB_valor ?? 0)}</td>
          <td class="right">${fmtNum((c?.HR_min ?? 0) / 60, 1)}</td>
          <td class="right">${fmt(c?.HR_valor ?? 0)}</td>
          <td class="right strong">${fmt(c?.totalDia ?? 0)}</td>
        </tr>
      `;
    })
    .join("");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          padding: 18px;
          color: #111;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .titleBox {
          border: 2px solid #2b2b2b;
          padding: 10px 12px;
          text-align: center;
          font-weight: 800;
          letter-spacing: 0.5px;
          background: #c00000;
          color: #fff;
        }
        .subTitle { margin-top: 2px; font-weight: 600; font-size: 12px; opacity: .95; }
        .headgrid {
          margin-top: 10px;
          display: grid;
          grid-template-columns: 1.55fr 1fr;
          gap: 10px;
          align-items: start;
        }
        .stack { display: flex; flex-direction: column; gap: 10px; }
        .box { border: 2px solid #2b2b2b; background: #fff; }
        .boxTitle {
          padding: 6px 8px;
          font-weight: 800;
          font-size: 12px;
          border-bottom: 2px solid #2b2b2b;
          background: #f2f2f2;
          text-transform: uppercase;
        }
        .row { display: grid; grid-template-columns: 140px 1fr; border-top: 1px solid #2b2b2b; }
        .row:first-of-type { border-top: 0; }
        .k, .v { padding: 6px 8px; font-size: 12px; border-right: 1px solid #2b2b2b; }
        .v { border-right: 0; }
        .totalsRight .row { grid-template-columns: 1fr 1fr; }
        .totalsRight .k { font-weight: 700; color: #1f7a37; }
        .totalsRight .v { text-align: right; font-weight: 700; }
        .miniRow .k { border-right: 0; }
        .miniRow .v { text-align: left; font-weight: 600; }
        .mini { font-size: 11px; }
        .muted { opacity: .8; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 2px solid #2b2b2b; padding: 6px; font-size: 11px; text-align: center; vertical-align: middle; }
        th { background: #7f7f7f; color: #fff; font-weight: 800; }
        /* Column colours matching the original sheet */
        th.h-blue   { background: #2e75b6; color: #fff; }
        th.h-olive  { background: #7f7f2e; color: #fff; }
        th.h-purple { background: #7030a0; color: #fff; }
        th.h-total  { background: #bf9000; color: #fff; }
        .days .subhead th { background: #d9d9d9; color: #111; }
        .days .subhead th.h-blue   { background: #cfe0f2; color: #1b5fbf; }
        .days .subhead th.h-olive  { background: #e6e6c8; color: #111; }
        .days .subhead th.h-purple { background: #e4d6f0; color: #111; }
        .days .subhead th.h-total  { background: #f2e2b3; color: #111; }
        .days th { font-size: 10px; }
        .days td { font-size: 10px; }
        .days .mini { font-size: 9px; font-weight: 700; }
        .left { text-align: left; }
        .right { text-align: right; }
        .strong { font-weight: 900; }
        .blue { color: #1b5fbf; font-weight: 800; }
        .bottomGrid { margin-top: 10px; display: grid; grid-template-columns: 2.2fr 1fr; gap: 10px; align-items: start; }
        .notesBody { padding: 10px; font-size: 12px; min-height: 62px; }
        .totalsMini table { margin-top: 0; }
        .totalsMini td, .totalsMini th { font-size: 11px; }
        .totalsMini th { background: #f2f2f2; color: #1f7a37; text-align: left; }
        .totalsMini .val { text-align: right; font-weight: 800; }
        .conditions { margin-top: 10px; }
        .conditionsBody {
          padding: 10px 12px;
          font-size: 11px;
          line-height: 1.45;
          white-space: pre-wrap;
          word-break: break-word;
        }
        /* Keep table rows and the closing blocks from being split across pages */
        tr { break-inside: avoid; page-break-inside: avoid; }
        .bottomGrid, .bottomGrid .box, .conditions {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        @media print {
          @page { size: A3 landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="titleBox">
        ${escapeHtml(projeto.titulo || projeto.filme || s.title)}
      </div>

      <div class="headgrid">
        <div class="stack">
          <div class="box">
            <div class="boxTitle">${escapeHtml(s.personalData)}</div>
            ${headerRow(s.name, safeStr(perfil.nome))}
            ${headerRow(s.role, safeStr(perfil.funcao))}
            ${headerRow(s.phone, safeStr(perfil.telefone))}
            ${headerRow(s.email, safeStr(perfil.email))}
            ${headerRow(s.nif, safeStr(perfil.nif ?? ""))}
            ${headerRow(s.iban, safeStr(perfil.iban ?? ""))}
            ${headerRow(s.swift, safeStr(perfil.swift ?? ""))}
            ${perfil.empresa ? headerRow(s.companyLabel, safeStr(perfil.empresa)) : ""}
          </div>
        </div>

        <div class="stack">
          <div class="box">
            <div class="boxTitle">${escapeHtml(s.productionSection)}</div>
            ${headerRow(s.film, safeStr(projeto.filme))}
            ${headerRow(s.productionLabel, safeStr(projeto.produtora))}
            ${headerRow(s.productionNif, safeStr(projeto.nifProdutora ?? ""))}
          </div>
          <div class="box totalsRight">
            <div class="row"><div class="k">${escapeHtml(s.totalDays)}</div><div class="v">${fmtNum(totalDias, 0)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.issuedOn)}</div><div class="v">${escapeHtml(emitidoA)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.month)}</div><div class="v">${escapeHtml(mesNome)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.year)}</div><div class="v">${escapeHtml(String(projeto.ano))}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.vb)}</div><div class="v">${fmt(totais.ValorBruto)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.irs)}</div><div class="v">${fmt(totais.IRS_valor)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.iva)}</div><div class="v">${fmt(totais.IVA_valor)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.vf)}</div><div class="v">${fmt(totais.ValorFinal)}</div></div>
            <div class="row miniRow"><div class="k"></div><div class="v mini muted">${escapeHtml(mesAnoLabel)}</div></div>
          </div>
        </div>
      </div>

      <table class="rates">
        <tr>
          <th>${escapeHtml(s.salary)}</th>
          <th>${escapeHtml(s.overtimeA)}</th>
          <th>${escapeHtml(s.overtimeB)}</th>
          <th class="h-blue">${escapeHtml(s.recoveryHours)}</th>
          <th>${escapeHtml(s.meal)}</th>
          <th>${escapeHtml(s.telephone)}</th>
          <th class="h-olive">${escapeHtml(s.vehicle)}</th>
          <th class="h-purple">${escapeHtml(s.material)}</th>
          <th>${escapeHtml(s.perDiem)}</th>
        </tr>
        <tr>
          <td>${fmt(salarioDia)}</td>
          <td>${fmt(vHEA)} <span class="mini">${escapeHtml(s.perHour)}</span></td>
          <td>${fmt(vHEB)} <span class="mini">${escapeHtml(s.perHour)}</span></td>
          <td>${fmt(vHR)} <span class="mini">${escapeHtml(s.perHour)}</span></td>
          <td>${fmt(valRef)} <span class="mini">${escapeHtml(s.perDayUnit)}</span></td>
          <td>${fmt(valTel)} <span class="mini">${escapeHtml(s.perDayUnit)}</span></td>
          <td>${fmt(valViat)} <span class="mini">${escapeHtml(s.perDayUnit)}</span></td>
          <td>${fmt(valMat)} <span class="mini">${escapeHtml(s.perDayUnit)}</span></td>
          <td>${fmt(valPer)} <span class="mini">${escapeHtml(s.perDayUnit)}</span></td>
        </tr>
      </table>

      <table class="days">
        <tr>
          <th>${escapeHtml(s.day)}</th>
          <th>${escapeHtml(s.date)}</th>
          <th>${escapeHtml(s.salary)}</th>
          <th colspan="3">${escapeHtml(s.schedule)}</th>
          <th colspan="2">${escapeHtml(s.totalHours)}</th>
          <th>${escapeHtml(s.meal)}</th>
          <th>${escapeHtml(s.perDiem)}</th>
          <th>${escapeHtml(s.telephone)}</th>
          <th class="h-olive">${escapeHtml(s.vehicle)}</th>
          <th class="h-purple">${escapeHtml(s.material)}</th>
          <th colspan="2">${escapeHtml(s.overtimeAFull)}</th>
          <th colspan="2">${escapeHtml(s.overtimeBFull)}</th>
          <th colspan="2" class="h-blue">${escapeHtml(s.recoveryFull)}</th>
          <th class="h-total">${escapeHtml(s.total)}</th>
        </tr>
        <tr class="subhead">
          <th class="mini">${escapeHtml(s.description)}</th>
          <th class="mini"></th>
          <th class="mini">${escapeHtml(s.day)}</th>
          <th class="mini">${escapeHtml(s.start)}</th>
          <th class="mini">${escapeHtml(s.mealBreak)}</th>
          <th class="mini">${escapeHtml(s.end)}</th>
          <th class="mini">${escapeHtml(s.workHours)}</th>
          <th class="mini blue">${escapeHtml(s.restHours)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-olive">${escapeHtml(s.perDay)}</th>
          <th class="mini h-purple">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.total)}</th>
          <th class="mini">${escapeHtml(s.value)}</th>
          <th class="mini">${escapeHtml(s.total)}</th>
          <th class="mini">${escapeHtml(s.value)}</th>
          <th class="mini h-blue">${escapeHtml(s.total)}</th>
          <th class="mini h-blue">${escapeHtml(s.value)}</th>
          <th class="mini h-total">${escapeHtml(s.day)}</th>
        </tr>
        ${dayRows}
      </table>

      <div class="bottomGrid">
        <div class="box">
          <div class="boxTitle">${escapeHtml(s.notes)}</div>
          <div class="notesBody">${escapeHtml(notas || "")}</div>
          ${taxDisclaimer ? `<div style="padding:6px 10px;font-size:10px;color:#888;border-top:1px solid #ddd;">${escapeHtml(taxDisclaimer)}</div>` : ""}
        </div>
        <div class="box totalsMini">
          <table>
            <tr><th>${escapeHtml(s.gross)}</th><td class="val">${fmt(totais.ValorBruto)}</td></tr>
            <tr><th>${escapeHtml(s.irs)}</th><td class="val">${fmt(totais.IRS_valor)}</td></tr>
            <tr><th>${escapeHtml(s.iva)}</th><td class="val">${fmt(totais.IVA_valor)}</td></tr>
            <tr><th>${escapeHtml(s.net)}</th><td class="val">${fmt(totais.ValorFinal)}</td></tr>
          </table>
        </div>
      </div>

      ${condicoes && condicoes.trim()
        ? `<div class="box conditions">
          <div class="boxTitle">${escapeHtml(s.workConditions)}</div>
          <div class="conditionsBody">${escapeHtml(condicoes)}</div>
        </div>`
        : ""}
    </body>
  </html>
  `;
}

// ── Editable mirror of the sheet (same format, but with <input> fields) ─────────
// Renders inside an iframe. Editable cells post messages to the parent app;
// the parent recomputes and posts back the calculated cells (data-c markers).

function padTime(v?: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v ?? "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

export function buildEditableSheetHtml(
  perfil: PdfPerfil,
  projeto: PdfProjeto,
  dias: Dia[],
  calculos: CalcDia[],
  totais: PdfTotais,
  tabela: PdfTabela,
  notas?: string,
  locale: string = "pt",
  region?: string,
  currency: string = "EUR",
  taxDisclaimer?: string,
  condicoes?: string
): string {
  const s = getStrings(locale, region);
  const fmt = (n: number) => fmtMoney(n, currency);
  const curSym = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";

  const salarioDia = Number(tabela.salarioDia || 0);
  const multHEA = Number(tabela.multHEA ?? 1.5);
  const multHEB = Number(tabela.multHEB ?? 2.0);
  const multHR = Number(tabela.multHR ?? 3.0);
  const vHEA = tabela.rateHEA ?? (salarioDia ? (salarioDia / (tabela.H_dia || 8)) * multHEA : 0);
  const vHEB = tabela.rateHEB ?? (salarioDia ? (salarioDia / (tabela.H_dia || 8)) * multHEB : 0);
  const vHR = tabela.rateHR ?? (salarioDia ? (salarioDia / (tabela.H_dia || 8)) * multHR : 0);

  const aj = tabela.ajudas ?? {};
  const valRef = Number(aj.refeicao ?? 0);
  const valPer = Number(aj.perDiem ?? 0);
  const valTel = Number(aj.telefone ?? 0);
  const valViat = Number(aj.viatura ?? 0);
  const valMat = Number(aj.material ?? 0);

  const totalDias = dias.reduce((acc, d) => acc + (d.diaSemTrabalho ? 0 : d.meioDia ? 0.5 : 1), 0);
  const today = new Date();
  const emitidoA = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
  const mesNome = getMonthName(projeto.mes, locale);
  const mesAnoLabel = `${mesNome} ${projeto.ano}`;

  // Campos editáveis: contenteditable (texto que se edita no sítio, dimensiona-se
  // exatamente como no "Ver" — sem larguras fixas que cortam/quebram).
  const CE = 'contenteditable="true" autocapitalize="off" autocorrect="off" spellcheck="false"';
  const ti = (k: string, f: string, val: string, extra = "") =>
    `<span class="ei" ${CE} data-k="${k}" data-f="${f}" ${extra}>${escapeHtml(val)}</span>`;
  const di = (i: number, f: string, val: string, cls = "", extra = "") =>
    `<span class="ei ${cls}" ${CE} data-k="dia" data-i="${i}" data-f="${f}" ${extra}>${escapeHtml(val)}</span>`;
  const mi = (k: string, f: string, val: number) =>
    `<span class="ei money" ${CE} inputmode="decimal" data-k="${k}" data-f="${f}">${escapeHtml(String(val ?? 0))}</span>`;
  const kvEdit = (label: string, k: string, f: string, val: string) =>
    `<div class="row"><div class="k">${escapeHtml(label)}</div><div class="v">${ti(k, f, val)}</div></div>`;

  const dayRows = dias
    .map((d, i) => {
      const c = calculos[i] ?? ({} as CalcDia);
      const eff = (d as any).salarioDia ?? salarioDia;
      return `
        <tr>
          <td class="left">${di(i, "descricao", d.descricao || "", "left")}</td>
          <td>${di(i, "data", formatDatePT(d.data), "date", 'inputmode="numeric"')}</td>
          <td class="right calc" data-c="sal" data-i="${i}">${fmt(eff)}</td>
          <td>${di(i, "inicio", d.inicio || "", "time", 'inputmode="numeric"')}</td>
          <td>${di(i, "refeicaoTrabalho", d.refeicaoTrabalho || "", "time", 'inputmode="numeric"')}</td>
          <td>${di(i, "fim", d.fim || "", "time", 'inputmode="numeric"')}</td>
          <td class="calc" data-c="ht" data-i="${i}">${escapeHtml(minutesToHM(c?.HT_min ?? 0))}</td>
          <td class="blue calc" data-c="hd" data-i="${i}">${escapeHtml(minutesToHM(c?.HD_min ?? 0))}</td>
          <td class="right calc" data-c="d_ref" data-i="${i}">${fmt(valRef)}</td>
          <td class="right calc" data-c="d_per" data-i="${i}">${fmt(valPer)}</td>
          <td class="right calc" data-c="d_tel" data-i="${i}">${fmt(valTel)}</td>
          <td class="right calc" data-c="d_viat" data-i="${i}">${fmt(valViat)}</td>
          <td class="right calc" data-c="d_mat" data-i="${i}">${fmt(valMat)}</td>
          <td class="right calc" data-c="hea_h" data-i="${i}">${fmtNum((c?.HEA_min ?? 0) / 60, 1)}</td>
          <td class="right calc" data-c="hea_v" data-i="${i}">${fmt(c?.HEA_valor ?? 0)}</td>
          <td class="right calc" data-c="heb_h" data-i="${i}">${fmtNum((c?.HEB_min ?? 0) / 60, 1)}</td>
          <td class="right calc" data-c="heb_v" data-i="${i}">${fmt(c?.HEB_valor ?? 0)}</td>
          <td class="right calc" data-c="hr_h" data-i="${i}">${fmtNum((c?.HR_min ?? 0) / 60, 1)}</td>
          <td class="right calc" data-c="hr_v" data-i="${i}">${fmt(c?.HR_valor ?? 0)}</td>
          <td class="right strong calc" data-c="tot" data-i="${i}">${fmt(c?.totalDia ?? 0)}</td>
        </tr>`;
    })
    .join("");

  const unitH = `<span class="mini">${curSym} ${escapeHtml(s.perHour)}</span>`;
  const unitD = `<span class="mini">${curSym} ${escapeHtml(s.perDayUnit)}</span>`;

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 18px; color: #111; background: #fff; }
        .titleBox { border: 2px solid #2b2b2b; padding: 8px 10px; text-align: center; font-weight: 800; letter-spacing: .5px; background: #c00000; color: #fff; }
        .titleBox .ei { color: #fff; text-align: center; font-weight: 800; letter-spacing: .5px; }
        .titleBox .ei::placeholder { color: rgba(255,255,255,.85); }
        .headgrid { margin-top: 10px; display: grid; grid-template-columns: 1.55fr 1fr; gap: 10px; align-items: start; }
        .stack { display: flex; flex-direction: column; gap: 10px; }
        .box { border: 2px solid #2b2b2b; background: #fff; }
        .boxTitle { padding: 6px 8px; font-weight: 800; font-size: 12px; border-bottom: 2px solid #2b2b2b; background: #f2f2f2; text-transform: uppercase; }
        .row { display: grid; grid-template-columns: 140px 1fr; border-top: 1px solid #2b2b2b; }
        .row:first-of-type { border-top: 0; }
        .k, .v { padding: 6px 8px; font-size: 12px; border-right: 1px solid #2b2b2b; }
        .v { border-right: 0; }
        .totalsRight .row { grid-template-columns: 1fr 1fr; }
        .totalsRight .k { font-weight: 700; color: #1f7a37; }
        .totalsRight .v { text-align: right; font-weight: 700; }
        .miniRow .k { border-right: 0; }
        .miniRow .v { text-align: left; font-weight: 600; }
        .mini { font-size: 11px; }
        .muted { opacity: .8; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 2px solid #2b2b2b; padding: 6px; font-size: 11px; text-align: center; vertical-align: middle; }
        th { background: #7f7f7f; color: #fff; font-weight: 800; }
        th.h-blue { background: #2e75b6; color: #fff; }
        th.h-olive { background: #7f7f2e; color: #fff; }
        th.h-purple { background: #7030a0; color: #fff; }
        th.h-total { background: #bf9000; color: #fff; }
        .days .subhead th { background: #d9d9d9; color: #111; }
        .days .subhead th.h-blue { background: #cfe0f2; color: #1b5fbf; }
        .days .subhead th.h-olive { background: #e6e6c8; color: #111; }
        .days .subhead th.h-purple { background: #e4d6f0; color: #111; }
        .days .subhead th.h-total { background: #f2e2b3; color: #111; }
        .days th { font-size: 10px; }
        .days td { font-size: 10px; }
        .days .mini { font-size: 9px; font-weight: 700; }
        .left { text-align: left; }
        .right { text-align: right; }
        .strong { font-weight: 900; }
        .blue { color: #1b5fbf; font-weight: 800; }
        .calc { background: #f7f7f7; color: #333; }
        .bottomGrid { margin-top: 10px; display: grid; grid-template-columns: 2.2fr 1fr; gap: 10px; align-items: start; }
        .notesBody { padding: 6px; }
        .totalsMini table { margin-top: 0; }
        .totalsMini td, .totalsMini th { font-size: 11px; }
        .totalsMini th { background: #f2f2f2; color: #1f7a37; text-align: left; }
        .totalsMini .val { text-align: right; font-weight: 800; }
        .conditions { margin-top: 10px; }
        /* Campos editáveis (contenteditable): texto que se edita no sítio e
           dimensiona-se como no "Ver" — nada de larguras fixas que cortam. */
        .ei { background: #fffdf2; color: #111; cursor: text; outline: none; min-width: 10px; display: inline-block; }
        .ei:focus { background: #eef4ff; box-shadow: inset 0 0 0 1px #1b5fbf; }
        .ei:empty { min-width: 24px; min-height: 1em; }
        .row .v .ei { display: block; width: 100%; min-height: 1.1em; }
        .notes { display: block; width: 100%; min-height: 48px; white-space: pre-wrap; text-align: left; }
      </style>
    </head>
    <body>
      <div class="titleBox">${ti("projeto", "titulo", projeto.titulo || "", `placeholder="${escapeHtml(s.title)}"`)}</div>

      <div class="headgrid">
        <div class="stack">
          <div class="box">
            <div class="boxTitle">${escapeHtml(s.personalData)}</div>
            ${kvEdit(s.name, "perfil", "nome", safeStr(perfil.nome))}
            ${kvEdit(s.role, "perfil", "funcao", safeStr(perfil.funcao))}
            ${kvEdit(s.phone, "perfil", "telefone", safeStr(perfil.telefone))}
            ${kvEdit(s.email, "perfil", "email", safeStr(perfil.email))}
            ${kvEdit(s.nif, "perfil", "nif", safeStr(perfil.nif ?? ""))}
            ${kvEdit(s.iban, "perfil", "iban", safeStr(perfil.iban ?? ""))}
            ${kvEdit(s.swift, "perfil", "swift", safeStr(perfil.swift ?? ""))}
            ${kvEdit(s.companyLabel, "perfil", "empresa", safeStr(perfil.empresa ?? ""))}
          </div>
        </div>
        <div class="stack">
          <div class="box">
            <div class="boxTitle">${escapeHtml(s.productionSection)}</div>
            ${kvEdit(s.film, "projeto", "filme", safeStr(projeto.filme))}
            ${kvEdit(s.productionLabel, "projeto", "produtora", safeStr(projeto.produtora))}
            ${kvEdit(s.productionNif, "projeto", "nifProdutora", safeStr(projeto.nifProdutora ?? ""))}
          </div>
          <div class="box totalsRight">
            <div class="row"><div class="k">${escapeHtml(s.totalDays)}</div><div class="v" data-c="totalDias">${fmtNum(totalDias, 0)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.issuedOn)}</div><div class="v">${escapeHtml(emitidoA)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.month)}</div><div class="v">${escapeHtml(mesNome)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.year)}</div><div class="v">${escapeHtml(String(projeto.ano))}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.vb)}</div><div class="v" data-c="vb">${fmt(totais.ValorBruto)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.irs)}</div><div class="v" data-c="irs">${fmt(totais.IRS_valor)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.iva)}</div><div class="v" data-c="iva">${fmt(totais.IVA_valor)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.vf)}</div><div class="v" data-c="vf">${fmt(totais.ValorFinal)}</div></div>
            <div class="row miniRow"><div class="k"></div><div class="v mini muted">${escapeHtml(mesAnoLabel)}</div></div>
          </div>
        </div>
      </div>

      <table class="rates">
        <tr>
          <th>${escapeHtml(s.salary)}</th><th>${escapeHtml(s.overtimeA)}</th><th>${escapeHtml(s.overtimeB)}</th>
          <th class="h-blue">${escapeHtml(s.recoveryHours)}</th><th>${escapeHtml(s.meal)}</th><th>${escapeHtml(s.telephone)}</th>
          <th class="h-olive">${escapeHtml(s.vehicle)}</th><th class="h-purple">${escapeHtml(s.material)}</th><th>${escapeHtml(s.perDiem)}</th>
        </tr>
        <tr>
          <td>${mi("tabela", "salarioDia", salarioDia)} <span class="mini">${curSym}</span></td>
          <td>${mi("tabela", "rateHEA", Math.round(vHEA * 100) / 100)} ${unitH}</td>
          <td>${mi("tabela", "rateHEB", Math.round(vHEB * 100) / 100)} ${unitH}</td>
          <td>${mi("tabela", "rateHR", Math.round(vHR * 100) / 100)} ${unitH}</td>
          <td>${mi("ajudas", "refeicao", valRef)} ${unitD}</td>
          <td>${mi("ajudas", "telefone", valTel)} ${unitD}</td>
          <td>${mi("ajudas", "viatura", valViat)} ${unitD}</td>
          <td>${mi("ajudas", "material", valMat)} ${unitD}</td>
          <td>${mi("ajudas", "perDiem", valPer)} ${unitD}</td>
        </tr>
      </table>

      <table class="days">
        <tr>
          <th>${escapeHtml(s.day)}</th><th>${escapeHtml(s.date)}</th><th>${escapeHtml(s.salary)}</th>
          <th colspan="3">${escapeHtml(s.schedule)}</th><th colspan="2">${escapeHtml(s.totalHours)}</th>
          <th>${escapeHtml(s.meal)}</th><th>${escapeHtml(s.perDiem)}</th><th>${escapeHtml(s.telephone)}</th>
          <th class="h-olive">${escapeHtml(s.vehicle)}</th><th class="h-purple">${escapeHtml(s.material)}</th>
          <th colspan="2">${escapeHtml(s.overtimeAFull)}</th><th colspan="2">${escapeHtml(s.overtimeBFull)}</th>
          <th colspan="2" class="h-blue">${escapeHtml(s.recoveryFull)}</th><th class="h-total">${escapeHtml(s.total)}</th>
        </tr>
        <tr class="subhead">
          <th class="mini">${escapeHtml(s.description)}</th><th class="mini"></th><th class="mini">${escapeHtml(s.day)}</th>
          <th class="mini">${escapeHtml(s.start)}</th><th class="mini">${escapeHtml(s.mealBreak)}</th><th class="mini">${escapeHtml(s.end)}</th>
          <th class="mini">${escapeHtml(s.workHours)}</th><th class="mini blue">${escapeHtml(s.restHours)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th><th class="mini">${escapeHtml(s.perDay)}</th><th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-olive">${escapeHtml(s.perDay)}</th><th class="mini h-purple">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.total)}</th><th class="mini">${escapeHtml(s.value)}</th>
          <th class="mini">${escapeHtml(s.total)}</th><th class="mini">${escapeHtml(s.value)}</th>
          <th class="mini h-blue">${escapeHtml(s.total)}</th><th class="mini h-blue">${escapeHtml(s.value)}</th>
          <th class="mini h-total">${escapeHtml(s.day)}</th>
        </tr>
        ${dayRows}
      </table>

      <div class="bottomGrid">
        <div class="box">
          <div class="boxTitle">${escapeHtml(s.notes)}</div>
          <div class="notesBody"><div class="ei notes" ${CE} data-k="notas" data-f="notas">${escapeHtml(notas || "")}</div></div>
          ${taxDisclaimer ? `<div style="padding:6px 10px;font-size:10px;color:#888;border-top:1px solid #ddd;">${escapeHtml(taxDisclaimer)}</div>` : ""}
        </div>
        <div class="box totalsMini">
          <table>
            <tr><th>${escapeHtml(s.gross)}</th><td class="val" data-c="gross">${fmt(totais.ValorBruto)}</td></tr>
            <tr><th>${escapeHtml(s.irs)}</th><td class="val" data-c="birs">${fmt(totais.IRS_valor)}</td></tr>
            <tr><th>${escapeHtml(s.iva)}</th><td class="val" data-c="biva">${fmt(totais.IVA_valor)}</td></tr>
            <tr><th>${escapeHtml(s.net)}</th><td class="val" data-c="net">${fmt(totais.ValorFinal)}</td></tr>
          </table>
        </div>
      </div>

      <div class="box conditions">
        <div class="boxTitle">${escapeHtml(s.workConditions)}</div>
        <div class="notesBody"><div class="ei notes" ${CE} data-k="condicoes" data-f="condicoes">${escapeHtml(condicoes || "")}</div></div>
      </div>

      <script>
      (function(){
        function post(m){ try{ if(window.parent && window.parent!==window) window.parent.postMessage(m,'*'); }catch(e){} }
        function di(el){ var i = el.getAttribute('data-i'); return i===null? null : parseInt(i,10); }
        document.addEventListener('input', function(e){
          var el = e.target;
          if(!el.classList || !el.classList.contains('ei')) return;
          post({ type:'ws:edit', k: el.getAttribute('data-k'), f: el.getAttribute('data-f'), i: di(el), value: el.textContent });
        }, true);
        // Enter não cria nova linha em campos de uma linha
        document.addEventListener('keydown', function(e){
          var el = e.target;
          if(e.key==='Enter' && el.classList && el.classList.contains('ei') && !el.classList.contains('notes')){ e.preventDefault(); el.blur(); }
        }, true);
        // Normaliza as horas para HH:MM ao sair do campo (edição livre dígito a dígito)
        document.addEventListener('blur', function(e){
          var el = e.target;
          if(!el.classList || !el.classList.contains('time')) return;
          var v = (el.textContent||'').replace(/[.;,hH\\s]/g, ':').trim();
          var m = /^(\\d{1,2}):(\\d{2})$/.exec(v);
          var out;
          if(m){ out = ('0'+m[1]).slice(-2)+':'+m[2]; }
          else { var d = (el.textContent||'').replace(/\\D/g,'').slice(0,4); out = d.length<=2 ? d : d.slice(0,2)+':'+d.slice(2); }
          if(out !== el.textContent){ el.textContent = out; }
          post({ type:'ws:edit', k:'dia', f: el.getAttribute('data-f'), i: di(el), value: out });
        }, true);
        window.addEventListener('message', function(e){
          var d = e.data; if(!d) return;
          if(d.type === 'ws:calc'){
            function set(sel,val){ var n=document.querySelector(sel); if(n!=null && val!=null) n.textContent = val; }
            set('[data-c="totalDias"]', d.totalDias);
            set('[data-c="vb"]', d.vb); set('[data-c="gross"]', d.vb);
            set('[data-c="irs"]', d.irs); set('[data-c="birs"]', d.irs);
            set('[data-c="iva"]', d.iva); set('[data-c="biva"]', d.iva);
            set('[data-c="vf"]', d.vf); set('[data-c="net"]', d.vf);
            (d.days||[]).forEach(function(row,i){
              for(var key in row){ set('[data-c="'+key+'"][data-i="'+i+'"]', row[key]); }
            });
          } else if(d.type === 'ws:zoom'){
            document.documentElement.style.zoom = String(d.zoom);
          }
        });
        function fit(){ var w = document.documentElement.scrollWidth; var z = w>0 ? Math.min(1, window.innerWidth / w) : 1; document.documentElement.style.zoom = String(z); }
        window.addEventListener('resize', fit);
        document.addEventListener('DOMContentLoaded', function(){ fit(); setTimeout(fit, 60); setTimeout(fit, 300); });
        fit(); setTimeout(fit, 60); post({ type:'ws:ready' });
      })();
      </script>
    </body>
  </html>`;
}
