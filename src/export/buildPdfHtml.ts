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
  /** Título da barra vermelha da folha — independente do nome do projeto na app */
  folhaTitulo?: string;
  filme: string;
  produtora: string;
  nifProdutora?: string;
  semana?: string;
  mes: number;
  ano: number;
  /** Total de dias editado à mão (5,5 / 4,3…); vazio = contagem automática */
  totalDias?: number;
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
    titlePh: "TÍTULO",
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
    mealBreak: "HORA REFEIÇÃO",
    end: "FIM",
    workHours: "HORAS TRABALHO",
    restHours: "HORAS DESCANSO",
    perDay: "Por dia",
    total: "TOTAL",
    value: "VALOR",
    notes: "Notas",
    perHour: "/hora",
    perHourLabel: "Por hora",
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
    titlePh: "TITLE",
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
    mealBreak: "MEAL TIME",
    end: "END",
    workHours: "WORK HOURS",
    restHours: "REST HOURS",
    perDay: "Per day",
    total: "TOTAL",
    value: "VALUE",
    notes: "Notes",
    perHour: "/hour",
    perHourLabel: "Per hour",
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
    titlePh: "TÍTULO",
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
    mealBreak: "HORA COMIDA",
    end: "FIN",
    workHours: "HORAS TRABAJO",
    restHours: "HORAS DESCANSO",
    perDay: "Por día",
    total: "TOTAL",
    value: "VALOR",
    notes: "Notas",
    perHour: "/hora",
    perHourLabel: "Por hora",
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
    titlePh: "TITRE",
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
    mealBreak: "HEURE REPAS",
    end: "FIN",
    workHours: "HEURES TRAVAIL",
    restHours: "HEURES REPOS",
    perDay: "Par jour",
    total: "TOTAL",
    value: "VALEUR",
    notes: "Notes",
    perHour: "/heure",
    perHourLabel: "Par heure",
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
    titlePh: "TITEL",
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
    mealBreak: "ESSENSZEIT",
    end: "ENDE",
    workHours: "ARBEITSSTUNDEN",
    restHours: "RUHEZEIT",
    perDay: "Pro Tag",
    total: "GESAMT",
    value: "WERT",
    notes: "Notizen",
    perHour: "/Std.",
    perHourLabel: "Pro Stunde",
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
    titlePh: "TITOLO",
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
    mealBreak: "ORA PASTO",
    end: "FINE",
    workHours: "ORE LAVORO",
    restHours: "ORE RIPOSO",
    perDay: "Al giorno",
    total: "TOTALE",
    value: "VALORE",
    notes: "Note",
    perHour: "/ora",
    perHourLabel: "All'ora",
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
    titlePh: "TITEL",
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
    mealBreak: "ETENSTIJD",
    end: "EINDE",
    workHours: "WERKUREN",
    restHours: "RUSTUREN",
    perDay: "Per dag",
    total: "TOTAAL",
    value: "BEDRAG",
    notes: "Notities",
    perHour: "/uur",
    perHourLabel: "Per uur",
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
    titlePh: "TYTUŁ",
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
    mealBreak: "GODZ. POSIŁKU",
    end: "KONIEC",
    workHours: "GODZINY PRACY",
    restHours: "GODZINY ODPOCZ.",
    perDay: "Dziennie",
    total: "SUMA",
    value: "KWOTA",
    notes: "Notatki",
    perHour: "/godz.",
    perHourLabel: "Za godz.",
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
    titlePh: "TITLE",
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
    mealBreak: "MEAL TIME",
    end: "END",
    workHours: "WORK HOURS",
    restHours: "REST HOURS",
    perDay: "Per day",
    total: "TOTAL",
    value: "VALUE",
    notes: "Notes",
    perHour: "/hour",
    perHourLabel: "Per hour",
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
  // Campos de UMA linha do cabeçalho: além de \r\n, o iOS insere separadores
  // de linha invisíveis (U+2028/U+2029/NEL) via teclado/autofill — em
  // contenteditable (pre-wrap) rendem linhas fantasma que desalinhavam o
  // cabeçalho. Achatar aqui protege a folha venha o valor de onde vier.
  return v == null
    ? ""
    : String(v)
        .replace(/[\r\n\u2028\u2029\u0085]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

export function fmtMoney(n: number, currency = "EUR") {
  // Agrupamento manual dos milhares (o Hermes do RN nao agrupa com
  // toLocaleString -> saia "4342,00" no telemovel). Resultado: "4.342,00 EUR".
  const NBSP = String.fromCharCode(0xa0);
  const sym = currencySymbol(currency);
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  const neg = safe < 0;
  const parts = Math.abs(safe).toFixed(2).split(".");
  const intPart = parts[0];
  const dec = parts[1];
  if (currency === "GBP") {
    // GBP 1,234.00 -> simbolo a frente, milhares "," decimais "."
    const g = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + sym + g + "." + dec;
  }
  // 1.234,00 EUR -> milhares ".", decimais ",", simbolo a direita, com
  // espaco inquebravel (em celulas estreitas o simbolo caia para baixo).
  const g = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + g + "," + dec + NBSP + sym;
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
  // Motor de render: true = expo-print no iOS/iPad (WebKit); ausente = web (Blink).
  // O WebKit e o Blink paginam de forma diferente (nº de dias que cabe, margens no
  // topo das folhas seguintes, break-inside), por isso a calibração muda conforme.
  nativePrint?: boolean;
  // iPad: o WKWebView do expo-print usa desktop-class browsing -> margens finas.
  // A tabela dos dias é ~4pt mais larga que o resto (box-model slop) e no iPad,
  // com a margem fina, a borda encosta ao papel. SÓ no iPad: box-sizing:border-box
  // (dobra o padding p/ dentro, tira a folga) + margens laterais maiores. NÃO
  // mexe na largura do CONTEÚDO -> não altera a escala -> não empurra p/ pág.2.
  ipadPdf?: boolean;
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

  // Total de dias: valor editado à mão (5,5 / 4,3…) tem prioridade
  const totalDias = projeto.totalDias ?? dias.reduce(
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

  // Orientação da impressão. Horizontal = A3 landscape (a tabela dos dias
  // precisa desta largura para caber sem cortar nem espremer); vertical = A4
  // portrait com a tabela encolhida por font-size (sem zoom, que parte a
  // paginação no WebKit).
  const pageCss = extra?.orientation === "portrait" ? "A4 portrait" : "A3 landscape";
  // Largura do viewport = largura REAL da folha em px (A4=794, A3=1587), NÃO
  // "device-width". Com device-width, o WebKit do expo-print desenhava a folha à
  // largura do aparelho (iPhone ~390, iPad ~1024) → o MESMO HTML saía com
  // tamanhos/paginação diferentes no iPhone e no iPad. Fixando à folha, o PDF
  // fica igual em qualquer device (e igual ao PC).
  const pageWidthPx = extra?.orientation === "portrait" ? 794 : 1587;
  // Horizontal: 14mm — ao encaixar a folha A3 em papel A4 a margem encolhe
  // ~0.7x, portanto isto dá ~10mm reais (10mm davam ~7mm, quase sem margem).
  // Vertical: cima 7mm (não colar ao topo), lados 5mm (a tabela dos dias não
  // fica colada à direita), fundo 3mm. Horizontal: 14mm.
  // Vertical: margens laterais 8mm (era 5→6, ainda encostava à direita no WebKit).
  // A folha encolhe-se para caber (shrink-to-fit), por isso a margem maior dá
  // folga real. Top 7 / bottom 3 mantêm-se.
  // Vertical: margem esquerda menor (4mm) que a direita (8mm) — puxa a tabela um
  // pouco para a esquerda e dá espaço p/ alargar DATA/SALÁRIO SEM empurrar a
  // tabela para a direita (não transborda -> não encolhe -> condições intactas).
  // Sem margem negativa (isso cortava no WebKit).
  const pageMargin = extra?.orientation === "portrait" ? "7mm 6mm 3mm 6mm" : "14mm";

  // Condições substanciais começam numa PÁGINA NOVA (a folha de baixo),
  // inteiras, em vez de partirem a meio a seguir à tabela. Vai no HTML
  // partilhado, por isso aplica-se ao nativo (expo-print, App Store) E à web.
  // page-break-before: always é a quebra forçada mais básica (a melhor
  // suportada pelo WebKit do expo-print). Só quando há condições a sério.
  const condCharCount =
    (condicoes ?? "").length +
    (extra?.condBoxes ?? []).reduce(
      (n, b) => n + (b?.titulo ?? "").length + (b?.texto ?? "").length,
      0
    );
  // Condições: SEMPRE por TAMANHO REAL — nunca por nº de dias nem nº de caixas
  // (variam de pessoa para pessoa). O `break-inside: avoid` faz o próprio motor
  // MEDIR o bloco das condições na folha:
  //   • cabe na página → fica (enche a folha ao máximo);
  //   • não cabe → salta INTEIRO para a folha seguinte;
  //   • se alguém tiver condições > 1 página inteira → parte só ENTRE caixas
  //     (cada caixa fecha a moldura, via box-decoration-break: clone) — nunca
  //     corta uma caixa a meio.
  // Igual em tudo: vertical/horizontal e WebKit (iPhone/iPad)/Blink (web). As
  // condições estão compactas (< 1 página), por isso o WebKit já não corta.
  // O break-inside: avoid vai no GRUPO (espaçador + condições) para o espaçador
  // VIAJAR com o bloco: assim a margem no topo aparece tanto na pág. 1 (a seguir
  // aos totais) como quando o bloco salta para a folha seguinte (o WebKit ignora
  // a margem @page nas páginas seguintes; a ALTURA do espaçador não é truncada).
  const condBreakCss =
    condCharCount > 1200
      ? ".condGroup { break-inside: avoid; page-break-inside: avoid; } .condTopSpacer { display: block; height: 6mm; } .condWrap { margin-top: 0; }"
      : "";

  const dayRows = dias
    .map((d, i) => {
      const c = calculos[i];
      return `
        <tr>
          <td class="left">${escapeHtml(d.descricao || "")}</td>
          <td class="cData">${escapeHtml(formatDatePT(d.data))}</td>
          <td class="right cSal">${fmt((d as any).salarioDia ?? salarioDia)}</td>
          <td class="cCont">${escapeHtml((d as any).cont || "")}</td>
          <td class="cIni">${escapeHtml(d.inicio || "")}</td>
          <td>${escapeHtml(d.refeicaoTrabalho || "")}</td>
          <td class="cFim">${escapeHtml(d.fim || "")}</td>
          <td>${escapeHtml(minutesToHM(c?.HT_min ?? 0))}</td>
          <td class="blue">${escapeHtml(minutesToHM(c?.HD_min ?? 0))}</td>
          <td class="right cPd">${fmt(c?.ajRef ?? valRef)}</td>
          <td class="right cPd">${fmt(c?.ajViat ?? valViat)}</td>
          <td class="right cPd">${fmt(c?.ajTel ?? valTel)}</td>
          <td class="right cPd">${fmt(c?.ajMat ?? valMat)}</td>
          <td class="right cPd">${fmt(c?.ajPer ?? valPer)}</td>
          <td class="right">${fmtNum((c?.HEA_min ?? 0) / 60, 1)}</td>
          <td class="right cOtv">${fmt(c?.HEA_valor ?? 0)}</td>
          <td class="right">${fmtNum((c?.HEB_min ?? 0) / 60, 1)}</td>
          <td class="right cOtv">${fmt(c?.HEB_valor ?? 0)}</td>
          <td class="right">${fmtNum((c?.HR_min ?? 0) / 60, 1)}</td>
          <td class="right cOtv">${fmt(c?.HR_valor ?? 0)}</td>
          <td class="right strong tday cTot">${fmt(c?.totalDia ?? 0)}</td>
        </tr>
      `;
    })
    .join("");

  return applyFontScale(`
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=${pageWidthPx}, initial-scale=1" />
      <style>
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        html { -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
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
        .days .subhead th, .rates .subhead th { background: #d9d9d9; color: #111; }
        .days .subhead th.h-blue, .rates .subhead th.h-blue { background: #cfe0f2; color: #1b5fbf; }
        .days .subhead th.h-olive, .rates .subhead th.h-olive { background: #e6e6c8; color: #111; }
        .days .subhead th.h-purple, .rates .subhead th.h-purple { background: #e4d6f0; color: #111; }
        .days .subhead th.h-total, .rates .subhead th.h-total { background: #f2e2b3; color: #111; }
        .days th { font-size: 11px; }
        .days td { font-size: 11px; }
        .days .mini { font-size: 10px; font-weight: 700; }
        /* Coluna "C" (horario continuo): marca manual, centrada e a laranja. */
        .days th.cmark, .days td.cCont { text-align: center; padding-left: 3px; padding-right: 3px; }
        .days td.cCont { color: #c65a00; font-weight: 800; text-transform: uppercase; }
        .days th.cmark { color: #c65a00; }
        /* Tudo centrado na tabela dos dias (como a tabela das taxas): descrição
           deixa de ser à esquerda e os valores/€ deixam de ser à direita. Só na
           .days — os totais (Valor Bruto/IRS/IVA) e outras tabelas ficam como estão. */
        .days td.left, .days td.right { text-align: center; }
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
        .sideBox .v { text-align: right; font-weight: 700; white-space: nowrap; }
        .sideBox .vfRow .v { background: #fff3bf; font-weight: 900; }
        /* Tabela de valores (rates): colunas uniformes */
        table.rates { table-layout: fixed; margin-top: 18px; }
        table.rates td { word-break: break-word; }
        /* Total Dias (quantidade) ≠ Total Dia (valor): sem amarelo, valor a
           vermelho escuro como na folha de referência */
        td.tdias { background: #fff; font-weight: 900; color: #7a0000; }
        /* Coluna TOTAL/DIA (valor de cada dia) a amarelo, como na referência */
        td.tday { background: #fff3bf; white-space: nowrap; }
        /* Valores monetários nunca partem linha (o € caía para baixo) */
        .days td.right { white-space: nowrap; }
        /* Larguras mínimas (só mordem no vertical, onde a tabela é mais larga
           que o A4 e as colunas apertam; no horizontal A3 há folga e não têm
           efeito): FIM e PER DIEMS um pouco maiores, e as colunas de VALOR das
           horas extra/recuperação uniformes e largas o suficiente para o
           cabeçalho ("HORAS RECUPERAÇÃO", "ERHOLUNGSZEIT"…) caber a 8px sem
           sair da caixa. O deficit vai para as colunas de texto, que refluem. */
        /* Larguras uniformes por grupo de colunas (só mordem no vertical, onde
           a tabela aperta): horário (início/fim) igual; "Por dia" (refeição,
           viatura, telefone, material, per diems) igual; VALOR das horas
           extra/recuperação igual (largo o suficiente p/ o cabeçalho "HORAS
           RECUPERAÇÃO"/"ERHOLUNGSZEIT" caber); TOTAL do dia um pouco maior. */
        .days td.cIni, .days td.cFim { min-width: 44px; }
        .days td.cPd { min-width: 48px; }
        .days td.cOtv { min-width: 48px; }
        .days td.cTot { min-width: 58px; }
        /* Bloco final: Valor Bruto / IRS / IVA / Valor Líquido, alinhado à direita */
        table.endTotals { width: auto; margin-left: auto; margin-top: 8px; }
        table.endTotals th { background: #f2f2f2; color: #111; text-align: left; font-size: 11px; padding: 5px 10px; min-width: 130px; }
        table.endTotals td { font-weight: 900; text-align: right; font-size: 11px; min-width: 120px; }
        table.endTotals tr.net th { font-weight: 900; }
        table.endTotals tr.net td { background: #fff3bf; }
        /* Espaçador que só aparece quando as condições saltam de página (dá a
           margem em cima na folha nova). Fora desse caso não ocupa nada. */
        .condTopSpacer, .totalsTopSpacer { display: none; }
        /* Condições de trabalho em caixas (como na folha de referência) */
        .condWrap { margin-top: 10px; border: 2px solid #2b2b2b; }
        .condMain {
          background: #ffd400; color: #7a0000; font-weight: 900; text-align: center;
          padding: 6px 8px; font-size: 12px; border-bottom: 2px solid #2b2b2b; text-transform: uppercase;
        }
        /* Notas (opcional): mesma caixa das condições; só sai no PDF se preenchida */
        .notesWrap { margin-top: 10px; border: 2px solid #2b2b2b; }
        .notesTitle { background: #ffd400; color: #7a0000; font-weight: 900; text-align: center;
          padding: 6px 8px; font-size: 12px; border-bottom: 2px solid #2b2b2b; text-transform: uppercase; }
        .notesArea { padding: 8px 10px; font-size: 11.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        .condRow { display: grid; grid-template-columns: 190px minmax(0, 1fr); border-top: 1px solid #2b2b2b; }
        .condRow:first-of-type { border-top: 0; }
        .condT {
          background: #e8e8e8; font-weight: 900; font-size: 10px; text-transform: uppercase;
          display: flex; align-items: center; justify-content: center; text-align: center;
          padding: 6px; border-right: 1px solid #2b2b2b;
        }
        .condB { padding: 6px 8px; font-size: 11.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        /* Imagem da condição: centrada na caixa, proporções mantidas,
           limitada à largura da caixa (antes ficava encostada e com um teto
           fixo de 240px que desalinhava no PDF) */
        .condImg { display: block; margin: 8px auto 2px; max-width: 70%; max-height: 240px; border: 1px solid #999; }
        .condRow { break-inside: avoid; page-break-inside: avoid; }
        /* Se a caixa das condições/notas partir entre páginas, cada fragmento
           fecha a própria moldura (borda em cima e em baixo) — sem os traços
           laterais abertos até ao fundo da página. O salto do bloco inteiro
           para a página seguinte é injetado só no print de desktop (pdf.web.ts):
           no WebKit do iOS, break-inside:avoid num bloco maior que a página
           CORTA o fim (o bug antigo do expo-print). */
        .condWrap, .notesWrap { -webkit-box-decoration-break: clone; box-decoration-break: clone; }
        ${condBreakCss}
        .condMain, .notesTitle { break-after: avoid; page-break-after: avoid; }
        /* Os totais finais (Bruto/IRS/IVA/Líquido) saltam inteiros de página —
           partiam a meio (Bruto numa página, o resto na seguinte). Bloco
           pequeno: o avoid é seguro em todos os motores, incl. WebKit. */
        table.endTotals { break-inside: avoid; page-break-inside: avoid; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        .bottomGrid, .bottomGrid .box {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        @media print {
          @page { size: ${pageCss}; margin: ${pageMargin}; }
          /* IMPORTANTE: NADA de "zoom" aqui. O zoom no @media print parte a
             paginação no WebKit (motor do expo-print no iOS) — a partir de um
             certo nº de dias a folha passa para uma 2.ª página e o excesso era
             CORTADO. Encolhe-se via font-size (abaixo), que pagina a sério. */
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
          /* Vertical: se a folha for mais larga que o papel, o motor encolhe-a
             TODA para caber (shrink-to-fit) — o que manda é o rácio
             letra/largura. Os TÍTULOS das colunas eram o gargalo da largura:
             th a 8px + valores (td) a 10px + margem 5mm => a tabela cabe
             exatamente nos 756px úteis do A4 e a folha imprime à ESCALA 1.0
             (números ~10px efetivos vs 6.8px originais; campos e cabeçalho
             sem qualquer encolhimento). Medido com sonda de largura no Blink. */
          ${extra?.orientation === "portrait"
            ? "body { font-size: 9px; } .titleBox { font-size: 13px; } .k, .v, .uv { font-size: 10px; } .days th { font-size: 8px; } .days td { font-size: 10px; } .days th, .days td { padding: 4px 1.45px; } .secTitle { font-size: 10px; } table.rates { table-layout: auto; } .condMain { font-size: 10px; padding: 3px 8px; } .condT { font-size: 8.5px; padding: 3px 4px; } .condB, .conditionsBody { font-size: 9.5px; line-height: 1.28; padding: 3px 6px; } .condRow { grid-template-columns: 150px minmax(0, 1fr); } .days td.cData { min-width: 60px; } .days td.cSal { min-width: 54px; }" + (extra?.ipadPdf ? " table.days, table.days th, table.days td { min-width: 0 !important; }" : "")
            : "table.days { table-layout: fixed; } .days th, .days td { word-break: break-word; padding: 3px 4px; } .days th { font-size: 9px; padding-left: 2px; padding-right: 2px; letter-spacing: -0.2px; } .days col.col-desc { width: 5.5%; } .days col.col-data { width: 7%; } .days col.col-sal { width: 5.5%; } .days col.col-cont { width: 2%; } .days col.col-ini { width: 4%; } .days col.col-ref { width: 4.6%; } .days col.col-fim { width: 4%; } .days col.col-ht { width: 5.3%; } .days col.col-hd { width: 5.3%; } .days col.col-pd { width: 4.4%; } .days col.col-ott { width: 3.6%; } .days col.col-otv { width: 5.4%; } .days col.col-tot { width: 6%; } .condMain { font-size: 11px; padding: 4px 8px; } .condT { font-size: 9px; padding: 4px 5px; } .condB { font-size: 10px; line-height: 1.3; padding: 4px 7px; } .conditionsBody { font-size: 10px; line-height: 1.3; padding: 6px 8px; } .condRow { grid-template-columns: 220px minmax(0, 1fr); }"}
        }
      </style>
    </head>
    <body>
      <div class="titleBox">
        ${escapeHtml(projeto.folhaTitulo || projeto.filme || s.title)}
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
            <div class="row"><div class="k">${escapeHtml(s.irs)}</div><div class="v">${pct(irsPct)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.iva)}</div><div class="v">${pct(ivaPct)}</div></div>
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
          <th rowspan="2">${escapeHtml(s.totalDays)}</th>
          <th>${escapeHtml(s.salary)}</th>
          <th>${escapeHtml(s.overtimeA)}</th>
          <th>${escapeHtml(s.overtimeB)}</th>
          <th class="h-blue">${escapeHtml(s.recoveryHours)}</th>
          <th>${escapeHtml(s.meal)}</th>
          <th class="h-olive">${escapeHtml(s.vehicle)}</th>
          <th>${escapeHtml(s.telephone)}</th>
          <th class="h-purple">${escapeHtml(s.material)}</th>
          <th>${escapeHtml(s.perDiem)}</th>
        </tr>
        <tr class="subhead">
          <th class="mini">${escapeHtml(s.day)}</th>
          <th class="mini">${escapeHtml((s as any).perHourLabel || s.perHour)}</th>
          <th class="mini">${escapeHtml((s as any).perHourLabel || s.perHour)}</th>
          <th class="mini h-blue">${escapeHtml((s as any).perHourLabel || s.perHour)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-olive">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-purple">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
        </tr>
        <tr>
          <td class="tdias">${fmtNum(totalDias, 1)}</td>
          <td>${fmt(salarioDia)}</td>
          <td>${fmt(vHEA)}</td>
          <td>${fmt(vHEB)}</td>
          <td>${fmt(vHR)}</td>
          <td>${fmt(valRef)}</td>
          <td>${fmt(valViat)}</td>
          <td>${fmt(valTel)}</td>
          <td>${fmt(valMat)}</td>
          <td>${fmt(valPer)}</td>
        </tr>
      </table>

      <table class="days">
        <colgroup>
          <col class="col-desc" /><col class="col-data" /><col class="col-sal" /><col class="col-cont" />
          <col class="col-ini" /><col class="col-ref" /><col class="col-fim" />
          <col class="col-ht" /><col class="col-hd" />
          <col class="col-pd" /><col class="col-pd" /><col class="col-pd" /><col class="col-pd" /><col class="col-pd" />
          <col class="col-ott" /><col class="col-otv" />
          <col class="col-ott" /><col class="col-otv" />
          <col class="col-ott" /><col class="col-otv" />
          <col class="col-tot" />
        </colgroup>
        <tr>
          <th colspan="2">${escapeHtml(s.day)}</th>
          <th>${escapeHtml(s.salary)}</th>
          <th colspan="4">${escapeHtml(s.schedule)}</th>
          <th colspan="2">${escapeHtml(s.totalHours)}</th>
          <th>${escapeHtml(s.meal)}</th>
          <th class="h-olive">${escapeHtml(s.vehicle)}</th>
          <th>${escapeHtml(s.telephone)}</th>
          <th class="h-purple">${escapeHtml(s.material)}</th>
          <th>${escapeHtml(s.perDiem)}</th>
          <th colspan="2">${escapeHtml(s.overtimeAFull)}</th>
          <th colspan="2">${escapeHtml(s.overtimeBFull)}</th>
          <th colspan="2" class="h-blue">${escapeHtml(s.recoveryFull)}</th>
          <th class="h-total">${escapeHtml(s.total)}</th>
        </tr>
        <tr class="subhead">
          <th class="mini">${escapeHtml(s.description)}</th>
          <th class="mini">${escapeHtml(s.date)}</th>
          <th class="mini">${escapeHtml(s.day)}</th>
          <th class="mini cmark">C</th>
          <th class="mini">${escapeHtml(s.start)}</th>
          <th class="mini">${escapeHtml(s.mealBreak)}</th>
          <th class="mini">${escapeHtml(s.end)}</th>
          <th class="mini">${escapeHtml(s.workHours)}</th>
          <th class="mini blue">${escapeHtml(s.restHours)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-olive">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-purple">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
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

      <div class="totalsTopSpacer"></div>
      <table class="endTotals">
        <tr><th>${escapeHtml(s.vb)}</th><td>${fmt(totais.ValorBruto)}</td></tr>
        <tr><th>${escapeHtml(s.irs)}</th><td>${fmt(totais.IRS_valor)}</td></tr>
        <tr><th>${escapeHtml(s.iva)}</th><td>${fmt(totais.IVA_valor)}</td></tr>
        <tr class="net"><th>${escapeHtml(s.vf)}</th><td>${fmt(totais.ValorFinal)}</td></tr>
      </table>

      <div class="condGroup"><div class="condTopSpacer"></div>${conditionsHtml(s, safeStr(perfil.nome), condicoes, extra)}</div>

      ${notas && notas.trim() ? `<div class="notesWrap"><div class="notesTitle">${escapeHtml(s.notes)}</div><div class="notesArea">${escapeHtml(notas)}</div></div>` : ""}

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
const edMi = (k: string, f: string, val: number, cKey = "") =>
  `<span class="ei money" ${CE} inputmode="decimal" data-k="${k}" data-f="${f}"${cKey ? ` data-c="${cKey}"` : ""}>${escapeHtml(String(val ?? 0))}</span>`;
// Célula numérica de um DIA, editável E recalculável: o próprio span leva o
// data-c, para o ws:calc atualizar no sítio (saltando a célula em foco).
const edNum = (i: number, f: string, cKey: string, val: string) =>
  `<span class="ei money" ${CE} inputmode="decimal" data-k="dia" data-i="${i}" data-f="${f}" data-c="${cKey}">${escapeHtml(val)}</span>`;
// Horas: <input> REAL (não contenteditable). O contenteditable obrigava a
// reescrever o textContent a cada tecla e o cursor descontrolava-se — dava
// "08::0" e comia dígitos, em qualquer motor. Um input tem setSelectionRange
// exato e mudar .value nunca redispara 'input', por isso a máscara é estável.
const edTime = (i: number, f: string, val: string) =>
  `<input class="ei time" type="text" inputmode="numeric" autocomplete="off" data-k="dia" data-i="${i}" data-f="${f}" value="${escapeHtml(val || "")}">`;
// Data: <input> com máscara DD/MM/YYYY — as "/" são postas pela máscara e
// nunca se apagam (só se editam os números); apagar uma "/" repõe-na. (Antes
// era contenteditable e, apagada uma "/", ficava-se sem forma de a repor.)
const edDate = (i: number, val: string) =>
  `<input class="ei date" type="text" inputmode="numeric" autocomplete="off" size="10" data-k="dia" data-i="${i}" data-f="data" value="${escapeHtml(val || "")}">`;

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
          <td class="dateCell">${edDate(i, formatDatePT(d.data))}</td>
          <td>${edNum(i, "salarioDia", "sal", fmt(eff))}</td>
          <td class="contCell">${edDi(i, "cont", (d as any).cont || "", "cmark")}</td>
          <td class="timeCell">${edTime(i, "inicio", d.inicio || "")}</td>
          <td class="timeCell">${edTime(i, "refeicaoTrabalho", d.refeicaoTrabalho || "")}</td>
          <td class="timeCell">${edTime(i, "fim", d.fim || "")}</td>
          <td class="calc" data-c="ht" data-i="${i}">${escapeHtml(minutesToHM(c?.HT_min ?? 0))}</td>
          <td class="blue calc" data-c="hd" data-i="${i}">${escapeHtml(minutesToHM(c?.HD_min ?? 0))}</td>
          <td class="mealDay">${edNum(i, "ajRefeicao", "d_ref", fmt(c?.ajRef ?? valRef))}</td>
          <td>${edNum(i, "ajViatura", "d_viat", fmt(c?.ajViat ?? valViat))}</td>
          <td>${edNum(i, "ajTelefone", "d_tel", fmt(c?.ajTel ?? valTel))}</td>
          <td>${edNum(i, "ajMaterial", "d_mat", fmt(c?.ajMat ?? valMat))}</td>
          <td class="perDiemDay">${edNum(i, "ajPerDiem", "d_per", fmt(c?.ajPer ?? valPer))}</td>
          <td>${edNum(i, "heaHoras", "hea_h", fmtNum((c?.HEA_min ?? 0) / 60, 1))}</td>
          <td class="otVal">${edNum(i, "heaValor", "hea_v", fmt(c?.HEA_valor ?? 0))}</td>
          <td>${edNum(i, "hebHoras", "heb_h", fmtNum((c?.HEB_min ?? 0) / 60, 1))}</td>
          <td class="otVal">${edNum(i, "hebValor", "heb_v", fmt(c?.HEB_valor ?? 0))}</td>
          <td>${edNum(i, "hrHoras", "hr_h", fmtNum((c?.HR_min ?? 0) / 60, 1))}</td>
          <td class="otVal">${edNum(i, "hrValor", "hr_v", fmt(c?.HR_valor ?? 0))}</td>
          <td class="strong tday">${edNum(i, "totalDia", "tot", fmt(c?.totalDia ?? 0))}</td>
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

  const totalDias = projeto.totalDias ?? dias.reduce((acc, d) => acc + (d.diaSemTrabalho ? 0 : d.meioDia ? 0.5 : 1), 0);
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
    `<span class="ei money pctv" ${CE} inputmode="decimal" data-k="fiscal" data-f="${f}">${escapeHtml(String(v ?? 0))}</span>%`;

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
        /* Sem "text autosizing" do iPad: o WebKit inflava o texto normal mas
           não os campos editáveis — os valores ficavam mais pequenos que o % */
        html, body { margin: 0; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 18px; color: #111; background: #fff; }
        .titleBox { border: 2px solid #2b2b2b; padding: 8px 10px; text-align: center; font-weight: 800; letter-spacing: .5px; background: #c00000; color: #fff; }
        .titleBox .ei { display: block; width: 100%; min-height: 1.2em; color: #fff; background: transparent; text-align: center; font-weight: 800; letter-spacing: .5px; }
        /* Placeholder em campos vazios — contenteditable não mostra o
           atributo placeholder sozinho, é preciso desenhá-lo */
        .ei:empty::before { content: attr(placeholder); color: #b3b3b3; }
        .titleBox .ei:empty::before { color: rgba(255,255,255,0.85); }
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
        .days .subhead th, .rates .subhead th { background: #d9d9d9; color: #111; }
        .days .subhead th.h-blue, .rates .subhead th.h-blue { background: #cfe0f2; color: #1b5fbf; }
        .days .subhead th.h-olive, .rates .subhead th.h-olive { background: #e6e6c8; color: #111; }
        .days .subhead th.h-purple, .rates .subhead th.h-purple { background: #e4d6f0; color: #111; }
        .days .subhead th.h-total, .rates .subhead th.h-total { background: #f2e2b3; color: #111; }
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
        /* Percentagens: o campo é inline para o "%" ficar ao lado (o block
           de cima empurrava-o para a linha de baixo) */
        .row .v .ei.pctv { display: inline-block; width: auto; min-width: 24px; text-align: right; }
        .notes { display: block; width: 100%; min-height: 48px; white-space: pre-wrap; text-align: left; }
        .pago { cursor: pointer; user-select: none; -webkit-user-select: none; font-size: 12px; color: #888; }
        tr.paid .pago { color: #137a3a; }
        .days tr.paid td:first-child, .days tr.paid td:last-child { background: #e4f6ea; }
        /* Dados pessoais/produtora: sem caixas — só uma linha por baixo (clean) */
        .secTitle { font-weight: 900; font-size: 12px; margin: 8px 0 2px; text-transform: uppercase; }
        .uRow { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px; align-items: end; }
        .uk { font-size: 11px; font-weight: 800; padding: 5px 0 3px; }
        .uv { font-size: 13.5px; font-weight: 700; border-bottom: 1px solid #2b2b2b; padding: 5px 2px 3px; min-height: 1.25em; min-width: 0; overflow: hidden; }
        /* nowrap: no iOS o contenteditable ganha pre-wrap do próprio WebKit e
           rendia uma linha fantasma alternada no cabeçalho mesmo com dados
           limpos — proibir quebras aqui torna o layout imune em qualquer motor */
        .uv .ei { display: block; width: 100%; min-height: 1.1em; white-space: nowrap; overflow: hidden; }
        .sideBox .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .sideBox .k { font-weight: 800; }
        /* nowrap: o "%" ficava a cair para a linha de baixo do valor */
        .sideBox .v { text-align: right; font-weight: 700; white-space: nowrap; }
        .sideBox .vfRow .v { background: #fff3bf; font-weight: 900; }
        table.rates { table-layout: fixed; margin-top: 18px; }
        table.rates td { word-break: break-word; }
        /* Total Dias (quantidade) ≠ Total Dia (valor): valor a vermelho escuro */
        td.tdias { background: #fff; font-weight: 900; color: #7a0000; }
        td.tdias .ei { color: #7a0000; }
        td.tday { background: #fff3bf; white-space: nowrap; }
        /* Valores monetários nunca partem linha: a coluna alarga em vez de o
           "€" cair para baixo (acontecia no iPhone a partir de 4 dígitos) */
        .ei.money { white-space: nowrap; }
        /* Horas são <input> reais — sem moldura, iguais às outras células */
        input.ei { border: 0; margin: 0; padding: 0; font: inherit; color: #111;
          text-align: center; width: 100%; box-sizing: border-box; background: transparent;
          -webkit-appearance: none; appearance: none; border-radius: 0; }
        input.ei::placeholder { color: #b3b3b3; }
        input.ei:focus { background: #eef4ff; outline: none; box-shadow: inset 0 0 0 1px #1b5fbf; }
        /* Células de hora com largura própria e folgada: as colunas encolhiam
           ao tamanho do cabeçalho curto ("FIM"/"END") e o "20:00"/"00:30" ficava
           encavalitado. Uma largura fixa dá espaço em toda a coluna (cabeçalho
           incluído) no PC e no telemóvel. */
        .days td.timeCell { width: 56px; min-width: 56px; padding-left: 4px; padding-right: 4px; }
        input.ei.time { letter-spacing: normal; }
        /* Coluna "C" (horário contínuo): estreita, marca manual centrada. */
        .days td.contCell, .days th.cmark { width: 26px; min-width: 26px; padding-left: 2px; padding-right: 2px; text-align: center; }
        .days td.contCell .ei.cmark { display: block; text-align: center; text-transform: uppercase; color: #c65a00; font-weight: 800; }
        .days th.cmark { color: #c65a00; }
        /* DATA é <input> (não transborda como o contenteditable) — coluna com
           largura para "06/07/2026" inteiro, senão ficava cortada. */
        .days td.dateCell { width: 82px; min-width: 82px; padding-left: 4px; padding-right: 4px; }
        /* Valor das horas extra (A/B/Recuperação) um pouco mais largo — "30,00 €"
           ficava apertado. O espaço vem da folga das colunas mais largas (a
           tabela reparte a 100%). */
        .days td.otVal { min-width: 64px; }
        /* MEAL e PER DIEMS "Por dia" um nadinha mais largos (o espaço vem da
           coluna DESCRIÇÃO, que ficou um pouco mais estreita). */
        .days td.mealDay { min-width: 54px; }
        .days td.perDiemDay { min-width: 54px; }
        .days td.calc { white-space: nowrap; }
        table.endTotals { width: auto; margin-left: auto; margin-top: 8px; }
        table.endTotals th { background: #f2f2f2; color: #111; text-align: left; font-size: 11px; padding: 5px 10px; min-width: 130px; }
        table.endTotals td { font-weight: 900; text-align: right; font-size: 11px; min-width: 120px; }
        table.endTotals tr.net th { font-weight: 900; }
        table.endTotals tr.net td { background: #fff3bf; }
        .condWrap { margin-top: 10px; border: 2px solid #2b2b2b; }
        .condMain { background: #ffd400; color: #7a0000; font-weight: 900; text-align: center; padding: 6px 8px; font-size: 12px; border-bottom: 2px solid #2b2b2b; text-transform: uppercase; }
        /* Notas (opcional): cresce sozinha com o texto; só sai no PDF se preenchida */
        .notesWrap { margin-top: 10px; border: 2px solid #2b2b2b; }
        .notesTitle { background: #ffd400; color: #7a0000; font-weight: 900; text-align: center; padding: 6px 8px; font-size: 12px; border-bottom: 2px solid #2b2b2b; text-transform: uppercase; }
        .notesArea { padding: 8px 10px; font-size: 11.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; min-height: 44px; }
        .condRow { display: grid; grid-template-columns: 190px minmax(0, 1fr); border-top: 1px solid #2b2b2b; }
        .condRow:first-of-type { border-top: 0; }
        .condT { background: #e8e8e8; font-weight: 900; font-size: 10px; text-transform: uppercase; display: flex; align-items: center; justify-content: center; text-align: center; padding: 6px; border-right: 1px solid #2b2b2b; }
        .condB { padding: 6px 8px; font-size: 11.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        /* Imagem da condição: centrada na caixa, proporções mantidas,
           limitada à largura da caixa (antes ficava encostada e com um teto
           fixo de 240px que desalinhava no PDF) */
        .condImg { display: block; margin: 8px auto 2px; max-width: 70%; max-height: 240px; border: 1px solid #999; }
        .conditionsBody { padding: 8px 10px; font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        /* Faixa logo abaixo do último dia: botões à esquerda, totais à direita */
        .afterDays { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .afterDays .endTotals { margin-top: 8px; }
        .addDayBar { margin-top: 10px; text-align: left; }
        .addDayBar button {
          font: inherit; font-weight: 800; font-size: 13px; padding: 8px 14px;
          border: 2px solid #2b2b2b; border-radius: 999px; background: #f2f2f2; color: #111; cursor: pointer;
          margin-right: 8px;
        }
        .addDayBar .delBtn { border-color: #c05050; color: #c05050; background: #fff; }
        /* Botões por linha: duplicar (⧉) e remover (✕) o dia — não saem no print.
           SEMPRE por baixo da descrição, e a coluna com largura FIXA (a célula
           não estica/encolhe com o texto — texto longo quebra dentro dela). */
        table.days .ei.left { display: block; width: 72px; white-space: normal; }
        .rowBtns { display: block; white-space: nowrap; margin-top: 2px; }
        .rbtn { cursor: pointer; user-select: none; -webkit-user-select: none; color: #9a9a9a; font-size: 12px; padding: 0 4px; }
        .rbtn.rdel { color: #c05050; }
        @media print { .addDayBar, .rowBtns { display: none; } }
      </style>
    </head>
    <body>
      <!-- Barra vermelha: título PRÓPRIO da folha (editar aqui NÃO mexe no
           nome do projeto na app, e renomear o projeto não mexe aqui) -->
      <div class="titleBox">${ti("projeto", "folhaTitulo", projeto.folhaTitulo || "", `placeholder="${escapeHtml((s as any).titlePh || s.title)}"`)}</div>

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
            <div class="row"><div class="k">${escapeHtml(s.irs)}</div><div class="v">${pctEdit("IRS_percent", irsPct)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.iva)}</div><div class="v">${pctEdit("IVA_percent", ivaPct)}</div></div>
            <div class="row vfRow"><div class="k">${escapeHtml(s.vf)}</div><div class="v" data-c="vf">${fmt(totais.ValorFinal)}</div></div>
          </div>
          <div class="box sideBox">
            <div class="row"><div class="k">${escapeHtml(s.week)}</div><div class="v">${ti("projeto", "semana", safeStr(projeto.semana ?? ""))}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.month)}</div><div class="v">${escapeHtml(mesNome)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.year)}</div><div class="v">${escapeHtml(String(projeto.ano))}</div></div>
          </div>
        </div>
      </div>

      <table class="rates">
        <tr>
          <th rowspan="2">${escapeHtml(s.totalDays)}</th>
          <th>${escapeHtml(s.salary)}</th><th>${escapeHtml(s.overtimeA)}</th><th>${escapeHtml(s.overtimeB)}</th>
          <th class="h-blue">${escapeHtml(s.recoveryHours)}</th><th>${escapeHtml(s.meal)}</th>
          <th class="h-olive">${escapeHtml(s.vehicle)}</th><th>${escapeHtml(s.telephone)}</th>
          <th class="h-purple">${escapeHtml(s.material)}</th><th>${escapeHtml(s.perDiem)}</th>
        </tr>
        <tr class="subhead">
          <th class="mini">${escapeHtml(s.day)}</th>
          <th class="mini">${escapeHtml((s as any).perHourLabel || s.perHour)}</th>
          <th class="mini">${escapeHtml((s as any).perHourLabel || s.perHour)}</th>
          <th class="mini h-blue">${escapeHtml((s as any).perHourLabel || s.perHour)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-olive">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-purple">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
        </tr>
        <tr>
          <td class="tdias"><span class="ei money" ${CE} inputmode="decimal" data-k="projeto" data-f="totalDias" data-c="totalDias">${fmtNum(totalDias, 1)}</span></td>
          <td>${mi("tabela", "salarioDia", salarioDia, "g_sal")} <span class="mini">${curSym}</span></td>
          <td>${mi("tabela", "rateHEA", Math.round(vHEA * 100) / 100, "g_hea")} <span class="mini">${curSym}</span></td>
          <td>${mi("tabela", "rateHEB", Math.round(vHEB * 100) / 100, "g_heb")} <span class="mini">${curSym}</span></td>
          <td>${mi("tabela", "rateHR", Math.round(vHR * 100) / 100, "g_hr")} <span class="mini">${curSym}</span></td>
          <td>${mi("ajudas", "refeicao", valRef, "g_ref")} <span class="mini">${curSym}</span></td>
          <td>${mi("ajudas", "viatura", valViat, "g_viat")} <span class="mini">${curSym}</span></td>
          <td>${mi("ajudas", "telefone", valTel, "g_tel")} <span class="mini">${curSym}</span></td>
          <td>${mi("ajudas", "material", valMat, "g_mat")} <span class="mini">${curSym}</span></td>
          <td>${mi("ajudas", "perDiem", valPer, "g_per")} <span class="mini">${curSym}</span></td>
        </tr>
      </table>

      <table class="days">
        <tr>
          <th colspan="2">${escapeHtml(s.day)}</th><th>${escapeHtml(s.salary)}</th>
          <th colspan="4">${escapeHtml(s.schedule)}</th><th colspan="2">${escapeHtml(s.totalHours)}</th>
          <th>${escapeHtml(s.meal)}</th><th class="h-olive">${escapeHtml(s.vehicle)}</th><th>${escapeHtml(s.telephone)}</th>
          <th class="h-purple">${escapeHtml(s.material)}</th><th>${escapeHtml(s.perDiem)}</th>
          <th colspan="2">${escapeHtml(s.overtimeAFull)}</th><th colspan="2">${escapeHtml(s.overtimeBFull)}</th>
          <th colspan="2" class="h-blue">${escapeHtml(s.recoveryFull)}</th><th class="h-total">${escapeHtml(s.total)}</th>
        </tr>
        <tr class="subhead">
          <th class="mini">${escapeHtml(s.description)}</th><th class="mini">${escapeHtml(s.date)}</th><th class="mini">${escapeHtml(s.day)}</th>
          <th class="mini cmark">C</th><th class="mini">${escapeHtml(s.start)}</th><th class="mini">${escapeHtml(s.mealBreak)}</th><th class="mini">${escapeHtml(s.end)}</th>
          <th class="mini">${escapeHtml(s.workHours)}</th><th class="mini blue">${escapeHtml(s.restHours)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th><th class="mini h-olive">${escapeHtml(s.perDay)}</th><th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-purple">${escapeHtml(s.perDay)}</th><th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.total)}</th><th class="mini">${escapeHtml(s.value)}</th>
          <th class="mini">${escapeHtml(s.total)}</th><th class="mini">${escapeHtml(s.value)}</th>
          <th class="mini h-blue">${escapeHtml(s.total)}</th><th class="mini h-blue">${escapeHtml(s.value)}</th>
          <th class="mini h-total">${escapeHtml(s.day)}</th>
        </tr>
        ${dayRows}
      </table>

      <div class="afterDays">
        <div class="addDayBar">
          <button type="button" id="wsAddDay">＋ ${escapeHtml(s.addDay)}</button>
          <button type="button" id="wsDupDay">⧉ ${escapeHtml((s as any).dupDay || "Duplicar dia")}</button>
          <button type="button" id="wsDelDay" class="delBtn">✕ ${escapeHtml((s as any).removeDay || "Remover dia")}</button>
        </div>
        <table class="endTotals">
          <tr><th>${escapeHtml(s.vb)}</th><td data-c="gross">${fmt(totais.ValorBruto)}</td></tr>
          <tr><th>${escapeHtml(s.irs)}</th><td data-c="birs">${fmt(totais.IRS_valor)}</td></tr>
          <tr><th>${escapeHtml(s.iva)}</th><td data-c="biva">${fmt(totais.IVA_valor)}</td></tr>
          <tr class="net"><th>${escapeHtml(s.vf)}</th><td data-c="net">${fmt(totais.ValorFinal)}</td></tr>
        </table>
      </div>

      ${conditionsHtml(s, safeStr(perfil.nome), condicoes, extra, CE)}

      <div class="notesWrap">
        <div class="notesTitle">${escapeHtml(s.notes)}</div>
        <div class="ei notes notesArea" ${CE} data-k="notas" data-f="notas" placeholder="…">${escapeHtml(notas || "")}</div>
      </div>

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
          // As HORAS e a DATA são <input> com máscara e post próprios (só no
          // blur). Postar aqui também mandava, a cada tecla, texto por formatar
          // que ia parar diretamente ao campo — era isto que corrompia o valor.
          if(el.tagName === 'INPUT') return;
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
        // Células numéricas: tocar seleciona o VALOR TODO — escrever substitui
        // ("12" → 12,00). Sem isto, no telemóvel o cursor caía onde o dedo
        // acertava (ex.: a seguir à vírgula: "0,aqui00").
        function selectAll(el){
          try{
            var r = document.createRange();
            r.selectNodeContents(el);
            var s = window.getSelection();
            s.removeAllRanges();
            s.addRange(r);
          }catch(err){}
        }
        // Só dinheiro aqui — as horas selecionam-se já mais abaixo, no MESMO
        // focusin síncrono que converte para dígitos (um setTimeout(0) para
        // as duas coisas dava tempo a um utilizador rápido escrever 1-2
        // teclas ANTES da seleção acontecer, e essa seleção tardia comia-as).
        document.addEventListener('focusin', function(e){
          var el = e.target;
          if(!el.classList || !el.classList.contains('ei')) return;
          if(!el.classList.contains('money')) return;
          setTimeout(function(){
            if(document.activeElement !== el) return;
            selectAll(el);
          }, 0);
        }, true);
        // Ao SAIR de qualquer célula editável, pede à app um re-push dos
        // valores calculados/formatados: a célula já não está focada e o
        // ws:calc pode reescrevê-la ("12" volta a "12,00 €"; vazio volta ao
        // automático). Sem isto, depois da seleção-total o € não voltava.
        document.addEventListener('focusout', function(e){
          var el = e.target;
          if(!el.classList || !el.classList.contains('ei')) return;
          setTimeout(function(){ post({ type:'ws:blur' }); }, 50);
        }, true);
        // Horas — UM formatador canónico (os dois antigos andavam à bulha e
        // saíam ":::"). Regra: 2 dígitos = hora certa ("08"→08:00, "12"→12:00);
        // 3-4 dígitos = HH:MM ("845"→08:45, "0845"→08:45). Ao escrever, os
        // dois pontos aparecem a partir do 3º dígito.
        function fmtTime(text, final, deleting){
          // \\D (não \D): este script vai dentro de um template literal e o \D
          // era comido como escape de string (virava "D").
          var d = String(text||'').replace(/\\D/g,'').slice(0,4);
          if(d.length===0) return '';
          // A hora tem 2 dígitos SE os 2 primeiros formarem hora válida (<=23);
          // senão só 1 ("83" não é hora -> hora=8). O resto são os minutos.
          var hourLen = (d.length>=2 && parseInt(d.slice(0,2),10)<=23) ? 2 : 1;
          if(!final){
            // Ao vivo, sem nunca mostrar uma hora inválida (nada de "83:").
            if(d.length===1) return d;                 // "8"
            var hL = d.slice(0,hourLen), mL = d.slice(hourLen);
            // ainda sem minutos: "13"->"13:"; ao apagar deixa descer ("13")
            if(mL.length===0) return deleting ? hL : hL+':';
            return hL+':'+mL;                          // "134"->"13:4", "835"->"8:35", "24"->"2:4"
          }
          // Ao sair: completa e limita a 23:59. Um único dígito de minutos vale
          // as DEZENAS ("4"->"40"): "134"->13:40, "24"->02:40, "835"->08:35,
          // "085"->08:50. Escrito por extenso ("0835") mantém-se 08:35.
          var hh = d.slice(0,hourLen);
          var rest = d.slice(hourLen);
          var mm = rest.length===0 ? '00' : (rest.length===1 ? rest+'0' : rest.slice(0,2));
          var h = Math.min(23, parseInt(hh,10)||0);
          var m = Math.min(59, parseInt(mm,10)||0);
          return (h<10?'0'+h:''+h)+':'+(m<10?'0'+m:''+m);
        }
        // Horas = <input> real. Aqui manda-se em .value (não textContent) e o
        // cursor põe-se com setSelectionRange — exato em qualquer motor,
        // incluindo o WebKit do iPhone. Mudar .value NÃO redispara 'input',
        // por isso não é preciso guarda de reentrância nem há ":::".
        function isTimeInput(el){
          return el && el.tagName === 'INPUT' && el.classList && el.classList.contains('time');
        }
        // Ao ENTRAR: valor vira dígitos simples ("08:00"→"0800"), tudo
        // selecionado — a primeira tecla substitui.
        document.addEventListener('focusin', function(e){
          var el = e.target;
          if(!isTimeInput(el)) return;
          el.value = String(el.value||'').replace(/\\D/g,'').slice(0,4);
          setTimeout(function(){ if(document.activeElement===el){ try{ el.select(); }catch(err){} } }, 0);
        }, true);
        // Ao ESCREVER: máscara ao vivo ("08"→"08:", "0845"→"08:45"), cursor no fim.
        document.addEventListener('input', function(e){
          var el = e.target;
          if(!isTimeInput(el)) return;
          var deleting = !!(e.inputType && e.inputType.indexOf('delete') === 0);
          var out = fmtTime(el.value, false, deleting);
          // Só mexer no cursor quando REESCREVEMOS de facto — ao apagar sem
          // alteração, deixar o cursor onde o browser o pôs.
          if(out !== el.value){
            el.value = out;
            try{ el.setSelectionRange(out.length, out.length); }catch(err){}
          }
        }, true);
        // Ao SAIR: completa ("08:"→"08:00", "08:5"→"08:05") e grava.
        document.addEventListener('blur', function(e){
          var el = e.target;
          if(!isTimeInput(el)) return;
          var out = fmtTime(el.value, true);
          el.value = out;
          post({ type:'ws:edit', k:'dia', f: el.getAttribute('data-f'), i: di(el), value: out });
        }, true);
        // DATA — <input> com máscara DD/MM/YYYY. As "/" são geradas pela máscara
        // (aparecem ao 3º e 5º dígito) e não se apagam: apagar dígitos repõe-nas.
        // O cursor é reposto pela CONTAGEM de dígitos à esquerda (dá para editar
        // no meio, não só no fim).
        function isDateInput(el){
          return el && el.tagName === 'INPUT' && el.classList && el.classList.contains('date');
        }
        function fmtDate(text){
          var d = String(text||'').replace(/\\D/g,'').slice(0,8);
          var out = d.slice(0,2);
          if(d.length > 2) out += '/' + d.slice(2,4);
          if(d.length > 4) out += '/' + d.slice(4,8);
          return out;
        }
        function isDigit(ch){ var c = ch.charCodeAt(0); return c >= 48 && c <= 57; }
        // Ao ENTRAR na data: selecionar tudo — escrever substitui a data
        // inteira. Apagar só uma parte fazia o resto "deslizar" (apagar o dia
        // em "06/07/2026" dava "07/20/26"); retypar de fresco evita isso.
        document.addEventListener('focusin', function(e){
          var el = e.target;
          if(!isDateInput(el)) return;
          setTimeout(function(){ if(document.activeElement===el){ try{ el.select(); }catch(err){} } }, 0);
        }, true);
        document.addEventListener('input', function(e){
          var el = e.target;
          if(!isDateInput(el)) return;
          var caret = el.selectionStart || 0;
          // quantos dígitos ficam à esquerda do cursor (as "/" não contam)
          var before = 0, k;
          for(k = 0; k < caret && k < el.value.length; k++){ if(isDigit(el.value.charAt(k))) before++; }
          var out = fmtDate(el.value);
          if(out !== el.value){ el.value = out; }
          // repõe o cursor depois do mesmo nº de dígitos (salta a "/" que venha a seguir)
          var pos = 0, seen = 0;
          while(pos < out.length && seen < before){ if(isDigit(out.charAt(pos))) seen++; pos++; }
          if(out.charAt(pos) === '/') pos++;
          try{ el.setSelectionRange(pos, pos); }catch(err){}
        }, true);
        document.addEventListener('blur', function(e){
          var el = e.target;
          if(!isDateInput(el)) return;
          var out = fmtDate(el.value);
          el.value = out;
          post({ type:'ws:edit', k:'dia', f:'data', i: di(el), value: out });
        }, true);
        function applyCalc(d){
          // Nunca reescrever a célula que está a ser editada (perdia-se o cursor
          // e o que o utilizador estava a escrever)
          function set(sel,val){
            var n=document.querySelector(sel);
            if(n==null || val==null) return;
            if(n === document.activeElement || n.contains(document.activeElement)) return;
            n.textContent = val;
          }
          set('[data-c="totalDias"]', d.totalDias);
          // Linha das taxas globais (salário, HE €/h, ajudas): "7" → "7,00"
          if(d.g){ for(var gk in d.g){ set('[data-c="'+gk+'"]', d.g[gk]); } }
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
            // Pinch livre até 4× e o zoom FICA onde o deixares (com o limite
            // a 1 o iOS ressaltava para trás ao largar os dedos).
            m.setAttribute('content', 'width=' + w + ', maximum-scale=4');
          }
        }
        // iOS faz zoom automático ao focar texto <16px. Para o impedir SEM
        // limitar o pinch: ao focar uma célula trava-se a escala máxima na
        // escala ATUAL (não há para onde saltar); ao sair, liberta-se até 4×.
        function vpClamp(max){
          var m = document.querySelector('meta[name="viewport"]');
          var w = m && m.getAttribute('data-w');
          if(m && w){ m.setAttribute('content', 'width=' + w + ', maximum-scale=' + max); }
        }
        document.addEventListener('focusin', function(e){
          if(!window.ReactNativeWebView) return;
          var el = e.target;
          if(!el.classList || !el.classList.contains('ei')) return;
          var sc = (window.visualViewport && window.visualViewport.scale) || 1;
          vpClamp(sc + 0.001);
        }, true);
        document.addEventListener('focusout', function(e){
          if(!window.ReactNativeWebView) return;
          vpClamp(4);
        }, true);
        function layout(){ align(); nativeFit(); fit(); }
        // SÓ NO IPAD (ecrã >= 600px no menor lado; nenhum iPhone chega lá): as
        // linhas do 1.º render saem com os <input> (horário/data) maiores que os
        // spans e a data cortada. Re-injetar as linhas uma vez, num DOM já
        // assente, corrige — é o que "adicionar um dia" faz. O iPhone (já
        // perfeito) NÃO executa isto. Preserva edições: passa o .value dos inputs
        // ao atributo antes de capturar o HTML.
        var __isIpad = window.ReactNativeWebView && Math.min(screen.width, screen.height) >= 600;
        // LARGURA da tabela = sinal universal do glitch: qualquer manifestação
        // (coluna larga tipo HORAS TRABALHO/DESCANSO, OU <input> com fonte
        // inflada) torna a tabela mais LARGA. Guardamos a menor largura vista.
        var __goodW = 0;
        function tblW(){
          var t = document.querySelector('table.days');
          return t ? t.offsetWidth : 0;
        }
        function reflowRows(){
          if(!__isIpad) return;
          // NÃO reflowa enquanto editas um campo (senão perdias foco/teclado).
          var ae = document.activeElement;
          if(ae && ae.classList && ae.classList.contains('ei')) return;
          var t = document.querySelector('table.days'); if(!t) return;
          var rows = t.querySelectorAll('tr'); if(rows.length < 3) return;
          var ins = t.querySelectorAll('input.ei');
          for(var j=0;j<ins.length;j++){ ins[j].setAttribute('value', ins[j].value); }
          var tb = (t.tBodies && t.tBodies[0]) ? t.tBodies[0] : t;
          var html = '';
          for(var k=2;k<rows.length;k++){ html += rows[k].outerHTML; }
          for(var k=rows.length-1;k>=2;k--){ rows[k].parentNode.removeChild(rows[k]); }
          tb.insertAdjacentHTML('beforeend', html);
          align();
          // baseline = a MENOR largura vista (o glitch só alarga), para um reflow
          // num estado ainda glitchado não estragar a referência.
          var w = tblW();
          if(w){ __goodW = __goodW ? Math.min(__goodW, w) : w; }
        }
        // Reflow tardio só se o glitch AINDA lá estiver (tabela ~4% mais larga que
        // o baseline) — evita flash desnecessário quando já está bom.
        function reflowIfGlitched(){
          if(!__isIpad || !__goodW) return;
          if(tblW() > __goodW * 1.04){ reflowRows(); }
        }
        // Só reajusta ao carregar e ao rodar o ecrã — NÃO a cada 'resize'
        // (o pinch-zoom dispara resize e andava a lutar contra o teu zoom).
        // No iPad, ao rodar limpa-se o data-w do viewport (para o nativeFit
        // re-aplicar largura+escala) e re-injetam-se as linhas (corrige o glitch
        // que volta ao rodar). SÓ no iPad; o iPhone não passa por aqui.
        // 1 reflow logo + verificações ao longo de ~3s (só re-injeta se ainda
        // glitchado) — apanha o glitch que assenta tarde: cold start e rodar com
        // zoom aplicado, casos em que um único reflow cedo não chegava.
        function reflowSoonAndCheck(){
          if(!__isIpad) return;
          setTimeout(reflowRows, 350);
          setTimeout(reflowIfGlitched, 900);
          setTimeout(reflowIfGlitched, 1800);
          setTimeout(reflowIfGlitched, 3000);
          setTimeout(reflowIfGlitched, 4500);
        }
        window.addEventListener('orientationchange', function(){
          if(__isIpad){
            var m = document.querySelector('meta[name="viewport"]');
            if(m){
              // Repor o zoom ao rodar: rodar-COM-zoom-aplicado glitchava (data
              // cortada, fontes desiguais) e o reflow não resolvia enquanto o
              // zoom estava ativo. Forçar maximum-scale=1 encaixa a escala em 1
              // (equivale a "tirar o zoom e rodar"); o nativeFit volta a pôr
              // maximum-scale=4 logo a seguir, para o pinch continuar livre.
              var w = m.getAttribute('data-w');
              if(w){ m.setAttribute('content', 'width=' + w + ', maximum-scale=1'); }
              m.removeAttribute('data-w');
            }
          }
          setTimeout(layout, 250);
          reflowSoonAndCheck();
        });
        document.addEventListener('DOMContentLoaded', function(){ layout(); setTimeout(layout, 60); setTimeout(layout, 300); reflowSoonAndCheck(); });
        // Zoom (iPad): o pinch pode re-disparar o glitch. Quando o zoom assenta,
        // re-injetam-se as linhas — SÓ se o glitch estiver mesmo lá (via
        // reflowIfGlitched, para não piscar a cada gesto) e nunca a editar um
        // campo (guard no reflowRows). NÃO mexe no viewport -> não luta com o pinch.
        if(window.visualViewport && __isIpad){
          var __zt, __zt2;
          window.visualViewport.addEventListener('resize', function(){
            clearTimeout(__zt); clearTimeout(__zt2);
            __zt = setTimeout(reflowIfGlitched, 300);
            __zt2 = setTimeout(reflowIfGlitched, 900);
          });
        }
        layout(); setTimeout(layout, 60); post({ type:'ws:ready' });
      })();
      </script>
    </body>
  </html>`;
}
