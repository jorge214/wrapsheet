// src/export/buildPdfHtml.ts
// Pure HTML-building logic — no platform dependencies.
// Imported by pdf.ts (native) and pdf.web.ts (web).

import { minutesToHM } from "../calc/engine";
import { CalcDia, Dia } from "../calc/types";
import { getPreset } from "../constants/countryPresets";

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
    week: "Semana",
    addDay: "Adicionar dia",
    removeDayConfirm: "Remover este dia?",
    dupDay: "Duplicar dia",
    removeDay: "Remover dia",
    year: "Ano",
    vb: "Valor Bruto",
    vf: "Valor Líquido",
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
    week: "Week",
    addDay: "Add day",
    removeDayConfirm: "Remove this day?",
    dupDay: "Duplicate day",
    removeDay: "Remove day",
    year: "Year",
    vb: "Gross",
    vf: "Invoice total",
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
    week: "Semana",
    addDay: "Añadir día",
    removeDayConfirm: "¿Eliminar este día?",
    dupDay: "Duplicar día",
    removeDay: "Eliminar día",
    year: "Año",
    vb: "Valor Bruto",
    vf: "Total factura",
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
    week: "Semaine",
    addDay: "Ajouter un jour",
    removeDayConfirm: "Supprimer ce jour ?",
    dupDay: "Dupliquer le jour",
    removeDay: "Supprimer le jour",
    year: "Année",
    vb: "Brut",
    vf: "Total TTC",
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
    week: "Woche",
    addDay: "Tag hinzufügen",
    removeDayConfirm: "Diesen Tag entfernen?",
    dupDay: "Tag duplizieren",
    removeDay: "Tag entfernen",
    year: "Jahr",
    vb: "Brutto",
    vf: "Rechnungsbetrag",
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
  it: {
    title: "PUBBLICITÀ",
    subtitle: "Foglio paga",
    personalData: "DATI PERSONALI",
    film: "FILM:",
    name: "NOME:",
    role: "RUOLO:",
    phone: "TELEFONO:",
    email: "E-MAIL:",
    companySection: "AZIENDA",
    companyLabel: "AZIENDA:",
    nif: "P. IVA:",
    iban: "IBAN:",
    swift: "SWIFT:",
    productionSection: "PRODUZIONE",
    productionLabel: "PRODUZIONE:",
    productionNif: "P. IVA:",
    totalDays: "Totale giorni",
    issuedOn: "Emesso il",
    month: "Mese",
    week: "Settimana",
    addDay: "Aggiungi giorno",
    removeDayConfirm: "Rimuovere questo giorno?",
    dupDay: "Duplica giorno",
    removeDay: "Rimuovi giorno",
    year: "Anno",
    vb: "Lordo",
    vf: "Totale fattura",
    salary: "SALARIO",
    overtimeA: "STRAORDINARIO A",
    overtimeB: "STRAORDINARIO B",
    recoveryHours: "ORE DI RECUPERO",
    meal: "PASTO",
    perDiem: "PER DIEM",
    telephone: "TELEFONO",
    vehicle: "VEICOLO",
    material: "MATERIALE",
    day: "GIORNO",
    date: "DATA",
    schedule: "ORARIO",
    totalHours: "TOTALE ORE",
    description: "DESCRIZIONE",
    start: "INIZIO",
    mealBreak: "PASTO",
    end: "FINE",
    workHours: "ORE LAVORO",
    restHours: "ORE RIPOSO",
    perDay: "Al giorno",
    total: "TOTALE",
    value: "VALORE",
    notes: "Note",
    perHour: "/ora",
    perDayUnit: "/giorno",
    overtimeAFull: "STRAORDINARIO A",
    overtimeBFull: "STRAORDINARIO B",
    recoveryFull: "ORE DI RECUPERO",
    gross: "TOTALE",
    irs: "IRPEF",
    iva: "IVA",
    net: "VALORE",
    workConditions: "CONDIZIONI DI LAVORO",
  },
  nl: {
    title: "RECLAME",
    subtitle: "Urenstaat",
    personalData: "PERSOONLIJKE GEGEVENS",
    film: "FILM:",
    name: "NAAM:",
    role: "FUNCTIE:",
    phone: "TELEFOON:",
    email: "E-MAIL:",
    companySection: "BEDRIJF",
    companyLabel: "BEDRIJF:",
    nif: "BTW-NR:",
    iban: "IBAN:",
    swift: "SWIFT:",
    productionSection: "PRODUCTIE",
    productionLabel: "PRODUCTIE:",
    productionNif: "BTW-NR:",
    totalDays: "Totaal dagen",
    issuedOn: "Uitgegeven op",
    month: "Maand",
    week: "Week",
    addDay: "Dag toevoegen",
    removeDayConfirm: "Deze dag verwijderen?",
    dupDay: "Dag dupliceren",
    removeDay: "Dag verwijderen",
    year: "Jaar",
    vb: "Bruto",
    vf: "Factuurtotaal",
    salary: "GAGE",
    overtimeA: "OVERUREN A",
    overtimeB: "OVERUREN B",
    recoveryHours: "HERSTELUREN",
    meal: "MAALTIJD",
    perDiem: "PER DIEMS",
    telephone: "TELEFOON",
    vehicle: "VOERTUIG",
    material: "MATERIAAL",
    day: "DAG",
    date: "DATUM",
    schedule: "ROOSTER",
    totalHours: "TOTAAL UREN",
    description: "OMSCHRIJVING",
    start: "START",
    mealBreak: "MAALTIJD",
    end: "EINDE",
    workHours: "WERKUREN",
    restHours: "RUSTUREN",
    perDay: "Per dag",
    total: "TOTAAL",
    value: "BEDRAG",
    notes: "Notities",
    perHour: "/uur",
    perDayUnit: "/dag",
    overtimeAFull: "OVERUREN A",
    overtimeBFull: "OVERUREN B",
    recoveryFull: "HERSTELUREN",
    gross: "TOTAAL",
    irs: "IB",
    iva: "BTW",
    net: "BEDRAG",
    workConditions: "ARBEIDSVOORWAARDEN",
  },
  pl: {
    title: "REKLAMA",
    subtitle: "Karta godzin",
    personalData: "DANE OSOBOWE",
    film: "FILM:",
    name: "IMIĘ I NAZWISKO:",
    role: "FUNKCJA:",
    phone: "TELEFON:",
    email: "E-MAIL:",
    companySection: "FIRMA",
    companyLabel: "FIRMA:",
    nif: "NIP:",
    iban: "IBAN:",
    swift: "SWIFT:",
    productionSection: "PRODUCENT",
    productionLabel: "PRODUCENT:",
    productionNif: "NIP:",
    totalDays: "Łącznie dni",
    issuedOn: "Wystawiono",
    month: "Miesiąc",
    week: "Tydzień",
    addDay: "Dodaj dzień",
    removeDayConfirm: "Usunąć ten dzień?",
    dupDay: "Duplikuj dzień",
    removeDay: "Usuń dzień",
    year: "Rok",
    vb: "Brutto",
    vf: "Kwota faktury",
    salary: "GAŻA",
    overtimeA: "NADGODZINY A",
    overtimeB: "NADGODZINY B",
    recoveryHours: "GODZ. ODPOCZYNKU",
    meal: "POSIŁEK",
    perDiem: "DIETY",
    telephone: "TELEFON",
    vehicle: "POJAZD",
    material: "SPRZĘT",
    day: "DZIEŃ",
    date: "DATA",
    schedule: "GRAFIK",
    totalHours: "SUMA GODZIN",
    description: "OPIS",
    start: "START",
    mealBreak: "POSIŁEK",
    end: "KONIEC",
    workHours: "GODZINY PRACY",
    restHours: "GODZINY ODPOCZ.",
    perDay: "Dziennie",
    total: "SUMA",
    value: "KWOTA",
    notes: "Notatki",
    perHour: "/godz.",
    perDayUnit: "/dzień",
    overtimeAFull: "NADGODZINY A",
    overtimeBFull: "NADGODZINY B",
    recoveryFull: "GODZINY ODPOCZYNKU",
    gross: "SUMA",
    irs: "PIT",
    iva: "VAT",
    net: "KWOTA",
    workConditions: "WARUNKI PRACY",
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
    week: "Week",
    addDay: "Add day",
    removeDayConfirm: "Remove this day?",
    dupDay: "Duplicate day",
    removeDay: "Remove day",
    year: "Year",
    vb: "Gross",
    vf: "Invoice total",
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

function pickLangStrings(locale: string, region?: string) {
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
  if (lang.startsWith("it")) return STRINGS.it;
  if (lang.startsWith("nl")) return STRINGS.nl;
  if (lang.startsWith("pl")) return STRINGS.pl;
  // Fallback to region
  const r = (region ?? "").toLowerCase();
  if (r === "uk") return STRINGS.uk;
  if (r === "de" || r === "at" || r === "ch") return STRINGS.de;
  if (r === "fr" || r === "be") return STRINGS.fr;
  if (r === "es") return STRINGS.es;
  if (r === "nl") return STRINGS.nl;
  if (r === "pl") return STRINGS.pl;
  if (r === "se" || r === "no" || r === "fi" || r === "cz" || r === "hu") return STRINGS.en;
  return STRINGS.pt;
}

export function getStrings(locale: string, region?: string) {
  const base = pickLangStrings(locale, region);
  // Os NOMES DOS IMPOSTOS seguem a REGIÃO FISCAL, não a língua da app:
  // app em francês com região Portugal mostra IRS/IVA (não IR/TVA).
  if (region) {
    const tax = getPreset(region).taxLabels;
    return { ...base, irs: tax.incomeTax, iva: tax.vat };
  }
  return base;
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

// Símbolo da moeda para mostrar junto aos campos (todas as regiões)
export function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    EUR: "€", GBP: "£", USD: "$",
    SEK: "kr", NOK: "kr", CHF: "CHF", CZK: "Kč", PLN: "zł", HUF: "Ft", DKK: "kr.",
  };
  return map[code] || code;
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

// Extras opcionais da folha (percentagens fiscais + condições em caixas)
export type PdfExtra = {
  fiscal?: { IRS_percent?: number; IVA_percent?: number };
  condTitulo?: string;
  condBoxes?: { titulo: string; texto: string; img?: string }[];
  // Opções de exportação/impressão
  fontScale?: number; // 1 = normal; >1 = letras/números maiores (legibilidade)
  orientation?: "landscape" | "portrait"; // orientação da página impressa
};

// Aplica o multiplicador de tamanho a todos os font-size px do CSS gerado
// (letras e números da folha e do PDF ficam maiores/menores).
function applyFontScale(html: string, scale?: number): string {
  const sc = Number(scale);
  if (!sc || sc === 1 || !isFinite(sc)) return html;
  return html.replace(/font-size:\s*([\d.]+)px/g, (_m, n) => `font-size: ${Math.round(Number(n) * sc * 10) / 10}px`);
}

// Secção de condições de trabalho: caixas (título | texto + imagem) como na
// folha de referência; cai para o texto corrido antigo se não houver caixas.
function conditionsHtml(
  s: any,
  perfilNome: string,
  condicoes?: string,
  extra?: PdfExtra,
  editableAttr?: string
): string {
  const boxes = (extra?.condBoxes ?? []).filter((b) => b && (b.titulo || b.texto || b.img));
  const mainTitle =
    (extra?.condTitulo || "").trim() ||
    `${s.workConditions}${perfilNome ? " - " + perfilNome.toUpperCase() : ""}`;

  // No editor tudo é editável — mesmo quando as condições vieram de um perfil.
  const titleHtml = editableAttr
    ? `<span class="ei" ${editableAttr} data-k="condTitulo" data-f="condTitulo">${escapeHtml(mainTitle)}</span>`
    : escapeHtml(mainTitle);

  if (boxes.length === 0) {
    if (!condicoes || !condicoes.trim()) return "";
    const body = editableAttr
      ? `<div class="ei notes" ${editableAttr} data-k="condicoes" data-f="condicoes">${escapeHtml(condicoes)}</div>`
      : escapeHtml(condicoes);
    return `<div class="condWrap conditions">
      <div class="condMain">${titleHtml}</div>
      <div class="conditionsBody">${body}</div>
    </div>`;
  }

  const rows = boxes
    .map((b, i) => {
      const tit = editableAttr
        ? `<span class="ei" ${editableAttr} data-k="condBox" data-f="titulo" data-i="${i}">${escapeHtml(b.titulo || "")}</span>`
        : escapeHtml(b.titulo || "");
      const txt = editableAttr
        ? `<div class="ei notes" ${editableAttr} data-k="condBox" data-f="texto" data-i="${i}">${escapeHtml(b.texto || "")}</div>`
        : escapeHtml(b.texto || "");
      return `<div class="condRow">
        <div class="condT">${tit}</div>
        <div class="condB">${txt}${b.img ? `<div><img class="condImg" src="${b.img}" /></div>` : ""}</div>
      </div>`;
    })
    .join("");

  return `<div class="condWrap conditions">
    <div class="condMain">${titleHtml}</div>
    ${rows}
  </div>`;
}

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
  condicoes?: string,
  extra?: PdfExtra
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

  const pct = (v?: number) => (v == null ? "—" : `${fmtNum(Number(v), 2)}%`);
  const irsPct = extra?.fiscal?.IRS_percent;
  const ivaPct = extra?.fiscal?.IVA_percent;

  // Orientação da impressão. Horizontal = A3 landscape (como sempre foi: a
  // tabela dos dias precisa desta largura para caber sem cortar nem espremer);
  // vertical = A4 portrait com a folha encolhida uniformemente (zoom no print).
  const pageCss = extra?.orientation === "portrait" ? "A4 portrait" : "A3 landscape";
  const pageMargin = extra?.orientation === "portrait" ? "8mm" : "10mm";

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

  return applyFontScale(`
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
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
          /* Alinhado às colunas da tabela (10 × 10%): as linhas acabam onde a
             HORA RECUPERAÇÃO começa (40%); a caixa "Emitido a" começa na
             coluna do MATERIAL (80%); o meio fica em branco. */
          grid-template-columns: 40% 20%;
          justify-content: space-between;
          gap: 0;
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
        th, td { border: 2px solid #2b2b2b; padding: 6px; font-size: 12px; text-align: center; vertical-align: middle; }
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
        .days th { font-size: 11px; }
        .days td { font-size: 11px; }
        .days .mini { font-size: 10px; font-weight: 700; }
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
        /* Dados pessoais/produtora: sem caixas — só uma linha por baixo (clean) */
        .secTitle { font-weight: 900; font-size: 12px; margin: 8px 0 2px; text-transform: uppercase; }
        .uRow { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px; align-items: end; }
        .uk { font-size: 11px; font-weight: 800; padding: 5px 0 3px; }
        .uv { font-size: 13.5px; font-weight: 700; border-bottom: 1px solid #2b2b2b; padding: 5px 2px 3px; min-height: 1.25em; }
        /* Caixa lateral (Emitido a / IRS / IVA / Valor Final) — tamanhos uniformes */
        .sideBox .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .sideBox .k { font-weight: 800; }
        .sideBox .v { text-align: right; font-weight: 700; }
        .sideBox .vfRow .v { background: #fff3bf; font-weight: 900; }
        /* Tabela de valores (rates): colunas uniformes */
        table.rates { table-layout: fixed; margin-top: 18px; }
        table.rates td { word-break: break-word; }
        td.tdias { background: #fff3bf; font-weight: 900; }
        /* Condições de trabalho em caixas (como na folha de referência) */
        .condWrap { margin-top: 10px; border: 2px solid #2b2b2b; }
        .condMain {
          background: #ffd400; color: #7a0000; font-weight: 900; text-align: center;
          padding: 6px 8px; font-size: 12px; border-bottom: 2px solid #2b2b2b; text-transform: uppercase;
        }
        .condRow { display: grid; grid-template-columns: 190px minmax(0, 1fr); border-top: 1px solid #2b2b2b; }
        .condRow:first-of-type { border-top: 0; }
        .condT {
          background: #e8e8e8; font-weight: 900; font-size: 10px; text-transform: uppercase;
          display: flex; align-items: center; justify-content: center; text-align: center;
          padding: 6px; border-right: 1px solid #2b2b2b;
        }
        .condB { padding: 6px 8px; font-size: 11.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        .condImg { max-width: 240px; max-height: 170px; margin-top: 6px; border: 1px solid #999; }
        .condRow { break-inside: avoid; page-break-inside: avoid; }
        /* Keep table rows and the closing blocks from being split across pages.
           NOTA: as condições NÃO levam break-inside:avoid no bloco inteiro —
           senão saltavam por inteiro para a página seguinte; cada .condRow
           individual é que se mantém inteira. */
        tr { break-inside: avoid; page-break-inside: avoid; }
        .bottomGrid, .bottomGrid .box {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        @media print {
          @page { size: ${pageCss}; margin: ${pageMargin}; }
          /* No vertical, encolhe a folha inteira uniformemente (proporcional e
             legível) em vez de esmagar colunas umas contra as outras. */
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; ${extra?.orientation === "portrait" ? "zoom: 0.62;" : ""} }
          /* Horizontal: as condições vão inteiras para a página seguinte se não
             couberem (como sempre foi em A3); partidas ao meio ficavam com
             bordas soltas. No vertical fluem logo abaixo do último dia. */
          ${extra?.orientation === "portrait" ? "" : ".conditions { break-inside: avoid; page-break-inside: avoid; }"}
        }
      </style>
    </head>
    <body>
      <div class="titleBox">
        ${escapeHtml(projeto.titulo || projeto.filme || s.title)}
      </div>

      <div class="headgrid">
        <div class="stack">
          <div class="secTitle">${escapeHtml(s.personalData)}</div>
          <div>
            <div class="uRow"><div class="uk">${escapeHtml(s.name)}</div><div class="uv">${escapeHtml(safeStr(perfil.nome))}</div></div>
            <div class="uRow"><div class="uk">${escapeHtml(s.role)}</div><div class="uv">${escapeHtml(safeStr(perfil.funcao))}</div></div>
            <div class="uRow"><div class="uk">${escapeHtml(s.companyLabel)}</div><div class="uv">${escapeHtml(safeStr(perfil.empresa ?? ""))}</div></div>
            <div class="uRow"><div class="uk">${escapeHtml(s.phone)}</div><div class="uv">${escapeHtml(safeStr(perfil.telefone))}</div></div>
            <div class="uRow"><div class="uk">${escapeHtml(s.email)}</div><div class="uv">${escapeHtml(safeStr(perfil.email))}</div></div>
            <div class="uRow"><div class="uk">${escapeHtml(s.nif)}</div><div class="uv">${escapeHtml(safeStr(perfil.nif ?? ""))}</div></div>
            <div class="uRow"><div class="uk">${escapeHtml(s.iban)}</div><div class="uv">${escapeHtml(safeStr(perfil.iban ?? ""))}</div></div>
            <div class="uRow"><div class="uk">${escapeHtml(s.swift)}</div><div class="uv">${escapeHtml(safeStr(perfil.swift ?? ""))}</div></div>
          </div>
          <div class="secTitle">${escapeHtml(s.productionSection)}</div>
          <div>
            <div class="uRow"><div class="uk">${escapeHtml(s.film)}</div><div class="uv">${escapeHtml(safeStr(projeto.filme))}</div></div>
            <div class="uRow"><div class="uk">${escapeHtml(s.productionLabel)}</div><div class="uv">${escapeHtml(safeStr(projeto.produtora))}</div></div>
            <div class="uRow"><div class="uk">${escapeHtml(s.productionNif)}</div><div class="uv">${escapeHtml(safeStr(projeto.nifProdutora ?? ""))}</div></div>
          </div>
        </div>

        <div class="stack">
          <div class="box sideBox">
            <div class="row"><div class="k">${escapeHtml(s.issuedOn)}</div><div class="v">${escapeHtml(emitidoA)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.irs)} %</div><div class="v">${pct(irsPct)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.iva)} %</div><div class="v">${pct(ivaPct)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.vb)}</div><div class="v">${fmt(totais.ValorBruto)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.irs)}</div><div class="v">${fmt(totais.IRS_valor)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.iva)}</div><div class="v">${fmt(totais.IVA_valor)}</div></div>
            <div class="row vfRow"><div class="k">${escapeHtml(s.vf)}</div><div class="v">${fmt(totais.ValorFinal)}</div></div>
          </div>
          <div class="box sideBox">
            <div class="row"><div class="k">${escapeHtml(s.week)}</div><div class="v">${escapeHtml(safeStr(projeto.semana ?? ""))}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.month)}</div><div class="v">${escapeHtml(mesNome)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.year)}</div><div class="v">${escapeHtml(String(projeto.ano))}</div></div>
          </div>
        </div>
      </div>

      <table class="rates">
        <tr>
          <th class="h-total">${escapeHtml(s.totalDays)}</th>
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
          <td class="tdias">${fmtNum(totalDias, 1)}</td>
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

      ${conditionsHtml(s, safeStr(perfil.nome), condicoes, extra)}

      ${taxDisclaimer ? `<div style="margin-top:8px;font-size:9px;color:#999;">${escapeHtml(taxDisclaimer)}</div>` : ""}
    </body>
  </html>
  `, extra?.fontScale);
}

// ── Editable mirror of the sheet (same format, but with <input> fields) ─────────
// Renders inside an iframe. Editable cells post messages to the parent app;
// the parent recomputes and posts back the calculated cells (data-c markers).

function padTime(v?: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v ?? "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

// ── Helpers dos campos editáveis (contenteditable) — nível de módulo para a
// tabela de dias poder ser regenerada sozinha (adicionar/duplicar/remover dia
// sem recarregar a folha inteira) ──
const CE = 'contenteditable="true" autocapitalize="off" autocorrect="off" spellcheck="false"';
const edTi = (k: string, f: string, val: string, extra = "") =>
  `<span class="ei" ${CE} data-k="${k}" data-f="${f}" ${extra}>${escapeHtml(val)}</span>`;
const edDi = (i: number, f: string, val: string, cls = "", extra = "") =>
  `<span class="ei ${cls}" ${CE} data-k="dia" data-i="${i}" data-f="${f}" ${extra}>${escapeHtml(val)}</span>`;
const edMi = (k: string, f: string, val: number) =>
  `<span class="ei money" ${CE} inputmode="decimal" data-k="${k}" data-f="${f}">${escapeHtml(String(val ?? 0))}</span>`;

// Só as linhas <tr> da tabela de dias (editáveis). Usado pelo builder e pela
// app para atualizar a tabela no sítio via window.__wsSetRows(html).
export function buildEditableDayRowsHtml(
  dias: Dia[],
  calculos: CalcDia[],
  tabela: PdfTabela,
  currency: string = "EUR"
): string {
  const fmt = (n: number) => fmtMoney(n, currency);
  const salarioDia = Number(tabela.salarioDia || 0);
  const aj = tabela.ajudas ?? {};
  const valRef = Number(aj.refeicao ?? 0);
  const valPer = Number(aj.perDiem ?? 0);
  const valTel = Number(aj.telefone ?? 0);
  const valViat = Number(aj.viatura ?? 0);
  const valMat = Number(aj.material ?? 0);

  return dias
    .map((d, i) => {
      const c = calculos[i] ?? ({} as CalcDia);
      const eff = (d as any).salarioDia ?? salarioDia;
      return `
        <tr>
          <td class="left">${edDi(i, "descricao", d.descricao || "", "left")}<span class="rowBtns"><span class="rbtn" data-act="dup" data-i="${i}">⧉</span><span class="rbtn rdel" data-act="del" data-i="${i}">✕</span></span></td>
          <td>${edDi(i, "data", formatDatePT(d.data), "date", 'inputmode="numeric"')}</td>
          <td class="calc" data-c="sal" data-i="${i}">${fmt(eff)}</td>
          <td>${edDi(i, "inicio", d.inicio || "", "time", 'inputmode="numeric"')}</td>
          <td>${edDi(i, "refeicaoTrabalho", d.refeicaoTrabalho || "", "time", 'inputmode="numeric"')}</td>
          <td>${edDi(i, "fim", d.fim || "", "time", 'inputmode="numeric"')}</td>
          <td class="calc" data-c="ht" data-i="${i}">${escapeHtml(minutesToHM(c?.HT_min ?? 0))}</td>
          <td class="blue calc" data-c="hd" data-i="${i}">${escapeHtml(minutesToHM(c?.HD_min ?? 0))}</td>
          <td class="calc" data-c="d_ref" data-i="${i}">${fmt(valRef)}</td>
          <td class="calc" data-c="d_per" data-i="${i}">${fmt(valPer)}</td>
          <td class="calc" data-c="d_tel" data-i="${i}">${fmt(valTel)}</td>
          <td class="calc" data-c="d_viat" data-i="${i}">${fmt(valViat)}</td>
          <td class="calc" data-c="d_mat" data-i="${i}">${fmt(valMat)}</td>
          <td class="calc" data-c="hea_h" data-i="${i}">${fmtNum((c?.HEA_min ?? 0) / 60, 1)}</td>
          <td class="calc" data-c="hea_v" data-i="${i}">${fmt(c?.HEA_valor ?? 0)}</td>
          <td class="calc" data-c="heb_h" data-i="${i}">${fmtNum((c?.HEB_min ?? 0) / 60, 1)}</td>
          <td class="calc" data-c="heb_v" data-i="${i}">${fmt(c?.HEB_valor ?? 0)}</td>
          <td class="calc" data-c="hr_h" data-i="${i}">${fmtNum((c?.HR_min ?? 0) / 60, 1)}</td>
          <td class="calc" data-c="hr_v" data-i="${i}">${fmt(c?.HR_valor ?? 0)}</td>
          <td class="strong calc" data-c="tot" data-i="${i}">${fmt(c?.totalDia ?? 0)}</td>
        </tr>`;
    })
    .join("");
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
  condicoes?: string,
  extra?: PdfExtra
): string {
  const s = getStrings(locale, region);
  const fmt = (n: number) => fmtMoney(n, currency);
  const curSym = currencySymbol(currency);

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

  // Campos editáveis: helpers de módulo (edTi/edMi) + linhas geradas por
  // buildEditableDayRowsHtml (a mesma função que a app usa para atualizar a
  // tabela no sítio ao adicionar/duplicar/remover dias).
  const ti = edTi;
  const mi = edMi;
  const kvEdit = (label: string, k: string, f: string, val: string) =>
    `<div class="row"><div class="k">${escapeHtml(label)}</div><div class="v">${ti(k, f, val)}</div></div>`;
  // Linha "clean" (só sublinhado) com valor editável — como na folha de referência
  const kvU = (label: string, k: string, f: string, val: string) =>
    `<div class="uRow"><div class="uk">${escapeHtml(label)}</div><div class="uv">${ti(k, f, val)}</div></div>`;

  const irsPct = extra?.fiscal?.IRS_percent;
  const ivaPct = extra?.fiscal?.IVA_percent;
  const pctEdit = (f: string, v?: number) =>
    `<span class="ei money" ${CE} inputmode="decimal" data-k="fiscal" data-f="${f}">${escapeHtml(String(v ?? 0))}</span>%`;

  const dayRows = buildEditableDayRowsHtml(dias, calculos, tabela, currency);

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
        .titleBox .ei { display: block; width: 100%; min-height: 1.2em; color: #fff; background: transparent; text-align: center; font-weight: 800; letter-spacing: .5px; }
        .titleBox .ei:focus { background: rgba(255,255,255,.18); box-shadow: none; }
        .headgrid { margin-top: 10px; display: grid; grid-template-columns: 40% 20%; justify-content: space-between; gap: 0; align-items: start; }
        .stack { display: flex; flex-direction: column; gap: 10px; }
        .box { border: 2px solid #2b2b2b; background: #fff; }
        .boxTitle { padding: 6px 8px; font-weight: 800; font-size: 12px; border-bottom: 2px solid #2b2b2b; background: #f2f2f2; text-transform: uppercase; }
        .row { display: grid; grid-template-columns: 140px minmax(0, 1fr); border-top: 1px solid #2b2b2b; }
        .row:first-of-type { border-top: 0; }
        .k, .v { padding: 6px 8px; font-size: 12px; border-right: 1px solid #2b2b2b; min-width: 0; overflow: hidden; }
        .v { border-right: 0; }
        .totalsRight .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .totalsRight .k { font-weight: 700; color: #1f7a37; }
        .totalsRight .v { text-align: right; font-weight: 700; }
        .miniRow .k { border-right: 0; }
        .miniRow .v { text-align: left; font-weight: 600; }
        .mini { font-size: 11px; }
        .muted { opacity: .8; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 2px solid #2b2b2b; padding: 6px; font-size: 12px; text-align: center; vertical-align: middle; }
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
        .days th { font-size: 11px; }
        .days td { font-size: 11px; }
        .days .mini { font-size: 10px; font-weight: 700; }
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
        .ei { background: transparent; color: #111; cursor: text; outline: none; min-width: 10px; display: inline-block; }
        .ei:focus { background: #eef4ff; box-shadow: inset 0 0 0 1px #1b5fbf; }
        .ei:empty { min-width: 24px; min-height: 1em; }
        .row .v .ei { display: block; width: 100%; min-height: 1.1em; }
        .notes { display: block; width: 100%; min-height: 48px; white-space: pre-wrap; text-align: left; }
        .pago { cursor: pointer; user-select: none; -webkit-user-select: none; font-size: 12px; color: #888; }
        tr.paid .pago { color: #137a3a; }
        .days tr.paid td:first-child, .days tr.paid td:last-child { background: #e4f6ea; }
        /* Dados pessoais/produtora: sem caixas — só uma linha por baixo (clean) */
        .secTitle { font-weight: 900; font-size: 12px; margin: 8px 0 2px; text-transform: uppercase; }
        .uRow { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px; align-items: end; }
        .uk { font-size: 11px; font-weight: 800; padding: 5px 0 3px; }
        .uv { font-size: 13.5px; font-weight: 700; border-bottom: 1px solid #2b2b2b; padding: 5px 2px 3px; min-height: 1.25em; min-width: 0; overflow: hidden; }
        .uv .ei { display: block; width: 100%; min-height: 1.1em; }
        .sideBox .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .sideBox .k { font-weight: 800; }
        .sideBox .v { text-align: right; font-weight: 700; }
        .sideBox .vfRow .v { background: #fff3bf; font-weight: 900; }
        table.rates { table-layout: fixed; margin-top: 18px; }
        table.rates td { word-break: break-word; }
        td.tdias { background: #fff3bf; font-weight: 900; }
        .condWrap { margin-top: 10px; border: 2px solid #2b2b2b; }
        .condMain { background: #ffd400; color: #7a0000; font-weight: 900; text-align: center; padding: 6px 8px; font-size: 12px; border-bottom: 2px solid #2b2b2b; text-transform: uppercase; }
        .condRow { display: grid; grid-template-columns: 190px minmax(0, 1fr); border-top: 1px solid #2b2b2b; }
        .condRow:first-of-type { border-top: 0; }
        .condT { background: #e8e8e8; font-weight: 900; font-size: 10px; text-transform: uppercase; display: flex; align-items: center; justify-content: center; text-align: center; padding: 6px; border-right: 1px solid #2b2b2b; }
        .condB { padding: 6px 8px; font-size: 11.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        .condImg { max-width: 240px; max-height: 170px; margin-top: 6px; border: 1px solid #999; }
        .conditionsBody { padding: 8px 10px; font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        .addDayBar { margin-top: 10px; text-align: left; }
        .addDayBar button {
          font: inherit; font-weight: 800; font-size: 13px; padding: 8px 14px;
          border: 2px solid #2b2b2b; border-radius: 999px; background: #f2f2f2; color: #111; cursor: pointer;
          margin-right: 8px;
        }
        .addDayBar .delBtn { border-color: #c05050; color: #c05050; background: #fff; }
        /* Botões por linha: duplicar (⧉) e remover (✕) o dia — não saem no print */
        .rowBtns { float: right; white-space: nowrap; margin-left: 6px; }
        .rbtn { cursor: pointer; user-select: none; -webkit-user-select: none; color: #9a9a9a; font-size: 12px; padding: 0 4px; }
        .rbtn.rdel { color: #c05050; }
        @media print { .addDayBar, .rowBtns { display: none; } }
      </style>
    </head>
    <body>
      <div class="titleBox">${ti("projeto", "titulo", projeto.titulo || "", `placeholder="${escapeHtml(s.title)}"`)}</div>

      <div class="headgrid">
        <div class="stack">
          <div class="secTitle">${escapeHtml(s.personalData)}</div>
          <div>
            ${kvU(s.name, "perfil", "nome", safeStr(perfil.nome))}
            ${kvU(s.role, "perfil", "funcao", safeStr(perfil.funcao))}
            ${kvU(s.companyLabel, "perfil", "empresa", safeStr(perfil.empresa ?? ""))}
            ${kvU(s.phone, "perfil", "telefone", safeStr(perfil.telefone))}
            ${kvU(s.email, "perfil", "email", safeStr(perfil.email))}
            ${kvU(s.nif, "perfil", "nif", safeStr(perfil.nif ?? ""))}
            ${kvU(s.iban, "perfil", "iban", safeStr(perfil.iban ?? ""))}
            ${kvU(s.swift, "perfil", "swift", safeStr(perfil.swift ?? ""))}
          </div>
          <div class="secTitle">${escapeHtml(s.productionSection)}</div>
          <div>
            ${kvU(s.film, "projeto", "filme", safeStr(projeto.filme))}
            ${kvU(s.productionLabel, "projeto", "produtora", safeStr(projeto.produtora))}
            ${kvU(s.productionNif, "projeto", "nifProdutora", safeStr(projeto.nifProdutora ?? ""))}
          </div>
        </div>
        <div class="stack">
          <div class="box sideBox">
            <div class="row"><div class="k">${escapeHtml(s.issuedOn)}</div><div class="v">${escapeHtml(emitidoA)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.irs)} %</div><div class="v">${pctEdit("IRS_percent", irsPct)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.iva)} %</div><div class="v">${pctEdit("IVA_percent", ivaPct)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.vb)}</div><div class="v" data-c="vb">${fmt(totais.ValorBruto)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.irs)}</div><div class="v" data-c="irs">${fmt(totais.IRS_valor)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.iva)}</div><div class="v" data-c="iva">${fmt(totais.IVA_valor)}</div></div>
            <div class="row vfRow"><div class="k">${escapeHtml(s.vf)}</div><div class="v" data-c="vf">${fmt(totais.ValorFinal)}</div></div>
          </div>
          <div class="box sideBox">
            <div class="row"><div class="k">${escapeHtml(s.week)}</div><div class="v">${ti("projeto", "semana", safeStr(projeto.semana ?? ""))}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.month)}</div><div class="v">${escapeHtml(mesNome)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.year)}</div><div class="v">${escapeHtml(String(projeto.ano))}</div></div>
            <div class="row miniRow"><div class="k"></div><div class="v mini muted">${escapeHtml(mesAnoLabel)}</div></div>
          </div>
        </div>
      </div>

      <table class="rates">
        <tr>
          <th class="h-total">${escapeHtml(s.totalDays)}</th>
          <th>${escapeHtml(s.salary)}</th><th>${escapeHtml(s.overtimeA)}</th><th>${escapeHtml(s.overtimeB)}</th>
          <th class="h-blue">${escapeHtml(s.recoveryHours)}</th><th>${escapeHtml(s.meal)}</th><th>${escapeHtml(s.telephone)}</th>
          <th class="h-olive">${escapeHtml(s.vehicle)}</th><th class="h-purple">${escapeHtml(s.material)}</th><th>${escapeHtml(s.perDiem)}</th>
        </tr>
        <tr>
          <td class="tdias" data-c="totalDias">${fmtNum(totalDias, 1)}</td>
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

      <div class="addDayBar">
        <button type="button" id="wsAddDay">＋ ${escapeHtml(s.addDay)}</button>
        <button type="button" id="wsDupDay">⧉ ${escapeHtml((s as any).dupDay || "Duplicar dia")}</button>
        <button type="button" id="wsDelDay" class="delBtn">✕ ${escapeHtml((s as any).removeDay || "Remover dia")}</button>
      </div>

      ${conditionsHtml(s, safeStr(perfil.nome), condicoes, extra, CE)}

      <script>
      (function(){
        function post(m){ try{
          if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
          else if(window.parent && window.parent!==window){ window.parent.postMessage(m,'*'); }
        }catch(e){} }
        function di(el){ var i = el.getAttribute('data-i'); return i===null? null : parseInt(i,10); }
        document.addEventListener('input', function(e){
          var el = e.target;
          if(!el.classList || !el.classList.contains('ei')) return;
          post({ type:'ws:edit', k: el.getAttribute('data-k'), f: el.getAttribute('data-f'), i: di(el), value: el.textContent });
        }, true);
        // Barra de dias: adicionar / duplicar último / remover último
        function lastDayIndex(){
          var t = document.querySelector('table.days');
          return t ? Math.max(0, t.querySelectorAll('tr').length - 3) : 0;
        }
        var addBtn = document.getElementById('wsAddDay');
        if(addBtn){ addBtn.addEventListener('click', function(){ post({ type:'ws:addDay' }); }); }
        var dupBtn = document.getElementById('wsDupDay');
        if(dupBtn){ dupBtn.addEventListener('click', function(){ post({ type:'ws:dupDay', i: lastDayIndex() }); }); }
        var delBtn = document.getElementById('wsDelDay');
        if(delBtn){ delBtn.addEventListener('click', function(){
          if(window.confirm(${JSON.stringify((s as any).removeDayConfirm || "Remover este dia?")})){ post({ type:'ws:removeDay', i: lastDayIndex() }); }
        }); }
        // Duplicar (⧉) / remover (✕) um dia
        document.addEventListener('click', function(e){
          var el = e.target;
          if(!el.classList || !el.classList.contains('rbtn')) return;
          var i = parseInt(el.getAttribute('data-i'), 10);
          if(el.getAttribute('data-act') === 'del'){
            if(window.confirm(${JSON.stringify((s as any).removeDayConfirm || "Remover este dia?")})){ post({ type:'ws:removeDay', i:i }); }
          } else {
            post({ type:'ws:dupDay', i:i });
          }
        }, true);
        // Substitui só as linhas da tabela de dias (mantém scroll e estado da página)
        window.__wsSetRows = function(html){
          var t = document.querySelector('table.days');
          if(!t) return;
          var rows = t.querySelectorAll('tr');
          for(var k = rows.length - 1; k >= 2; k--){ rows[k].parentNode.removeChild(rows[k]); }
          var tb = (t.tBodies && t.tBodies[0]) ? t.tBodies[0] : t;
          tb.insertAdjacentHTML('beforeend', html);
          align();
        };
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
        function applyCalc(d){
          function set(sel,val){ var n=document.querySelector(sel); if(n!=null && val!=null) n.textContent = val; }
          set('[data-c="totalDias"]', d.totalDias);
          set('[data-c="vb"]', d.vb); set('[data-c="gross"]', d.vb);
          set('[data-c="irs"]', d.irs); set('[data-c="birs"]', d.irs);
          set('[data-c="iva"]', d.iva); set('[data-c="biva"]', d.iva);
          set('[data-c="vf"]', d.vf); set('[data-c="net"]', d.vf);
          (d.days||[]).forEach(function(row,i){
            for(var key in row){ set('[data-c="'+key+'"][data-i="'+i+'"]', row[key]); }
          });
        }
        // RN (WebView) chama isto diretamente; a web usa postMessage
        window.__wsApply = applyCalc;
        window.addEventListener('message', function(e){
          var d = e.data; if(!d) return;
          if(d.type === 'ws:calc'){ applyCalc(d); }
          else if(d.type === 'ws:setRows'){ window.__wsSetRows(d.html); }
          else if(d.type === 'ws:zoom'){
            if(d.zoom === 'auto'){ fit(); }
            else { document.documentElement.style.zoom = String(d.zoom); }
          }
        });
        // Alinha o corpo com a tabela dos dias (o elemento mais largo): quando
        // a tabela transborda em ecrãs estreitos, o cabeçalho e as condições
        // esticam até à largura dela e fica tudo unânime.
        function align(){
          var t = document.querySelector('table.days');
          if(!t || !document.body) return;
          document.body.style.width = '';
          var w = t.offsetWidth + 36; /* padding 18px de cada lado */
          if(w > window.innerWidth + 1){ document.body.style.width = w + 'px'; }
        }
        function fit(){
          // No nativo (iPhone/iPad) NÃO há auto-zoom por CSS: o ajuste inicial
          // faz-se pelo viewport (nativeFit) e o pinch nativo faz o resto.
          if(window.ReactNativeWebView) return;
          // Repõe zoom a 1 antes de medir (senão media-se no espaço já ampliado
          // e a folha larga fica cortada na vertical).
          document.documentElement.style.zoom = '1';
          var w = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
          var z = w>0 ? Math.min(1, window.innerWidth / w) : 1;
          document.documentElement.style.zoom = String(z);
        }
        // Nativo: declara a largura real da folha no viewport — o iOS abre com
        // a folha inteira a caber no ecrã e o pinch continua livre (sem JS a
        // lutar contra o zoom do utilizador).
        function nativeFit(){
          if(!window.ReactNativeWebView) return;
          var t = document.querySelector('table.days');
          var w = t ? (t.offsetWidth + 36) : 0;
          if(!w) return;
          var m = document.querySelector('meta[name="viewport"]');
          if(m && m.getAttribute('data-w') !== String(w)){
            m.setAttribute('data-w', String(w));
            m.setAttribute('content', 'width=' + w);
          }
        }
        function layout(){ align(); nativeFit(); fit(); }
        // Só reajusta ao carregar e ao rodar o ecrã — NÃO a cada 'resize'
        // (o pinch-zoom dispara resize e andava a lutar contra o teu zoom).
        window.addEventListener('orientationchange', function(){ setTimeout(layout, 250); });
        document.addEventListener('DOMContentLoaded', function(){ layout(); setTimeout(layout, 60); setTimeout(layout, 300); });
        layout(); setTimeout(layout, 60); post({ type:'ws:ready' });
      })();
      </script>
    </body>
  </html>`;
}
