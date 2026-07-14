export type RegionCode =
  | "pt" | "es" | "fr" | "uk" | "de"
  | "se" | "ch" | "cz" | "no" | "fi"
  | "nl" | "be" | "at" | "pl" | "hu" | "dk";

export type RegionPreset = {
  code: RegionCode;
  nameKey: string;       // i18n key
  flag: string;
  currency: string;      // ISO 4217
  currencySymbol: string;
  taxLabels: {
    incomeTax: string;   // label shown in PDF (e.g. "IRS", "IRPF", "IR", "Income Tax", "ESt")
    vat: string;         // label shown in PDF (e.g. "IVA", "TVA", "VAT", "MwSt")
  };
  fiscal: {
    IRS_percent: number;
    IVA_percent: number;
  };
  tabela: {
    H_dia: number;
    descanso_min: number;
    multHEA: number;
    multHEB: number;
    multHR: number;
    limiar_A: number;
    limiar_B: number;
  };
};

export const REGION_PRESETS: Record<RegionCode, RegionPreset> = {
  pt: {
    code: "pt",
    nameKey: "region_pt",
    flag: "🇵🇹",
    currency: "EUR",
    currencySymbol: "€",
    taxLabels: { incomeTax: "IRS", vat: "IVA" },
    fiscal: { IRS_percent: 23, IVA_percent: 23 },
    tabela: {
      H_dia: 11,
      descanso_min: 11,
      multHEA: 1.5,
      multHEB: 2.0,
      multHR: 3.0,
      limiar_A: 11,
      limiar_B: 18,
    },
  },

  es: {
    code: "es",
    nameKey: "region_es",
    flag: "🇪🇸",
    currency: "EUR",
    currencySymbol: "€",
    taxLabels: { incomeTax: "IRPF", vat: "IVA" },
    fiscal: { IRS_percent: 15, IVA_percent: 21 },
    tabela: {
      H_dia: 8,
      descanso_min: 12,
      multHEA: 1.75,
      multHEB: 2.0,
      multHR: 2.0,
      limiar_A: 8,
      limiar_B: 12,
    },
  },

  fr: {
    code: "fr",
    nameKey: "region_fr",
    flag: "🇫🇷",
    currency: "EUR",
    currencySymbol: "€",
    taxLabels: { incomeTax: "IR", vat: "TVA" },
    // FR: não há retenção na fonte nas faturas de independentes (o IR paga-se
    // por acomptes) — a linha de imposto da folha modela retenção na fatura.
    fiscal: { IRS_percent: 0, IVA_percent: 20 },
    tabela: {
      H_dia: 10,
      descanso_min: 11,
      multHEA: 1.25,
      multHEB: 1.5,
      multHR: 2.0,
      limiar_A: 10,
      limiar_B: 18,
    },
  },

  uk: {
    code: "uk",
    nameKey: "region_uk",
    flag: "🇬🇧",
    currency: "GBP",
    currencySymbol: "£",
    taxLabels: { incomeTax: "Income Tax", vat: "VAT" },
    fiscal: { IRS_percent: 20, IVA_percent: 20 },
    tabela: {
      H_dia: 10,
      descanso_min: 11,
      multHEA: 1.5,
      multHEB: 2.0,
      multHR: 2.0,
      limiar_A: 10,
      limiar_B: 14,
    },
  },

  de: {
    code: "de",
    nameKey: "region_de",
    flag: "🇩🇪",
    currency: "EUR",
    currencySymbol: "€",
    taxLabels: { incomeTax: "ESt", vat: "MwSt" },
    // DE: sem retenção na fonte nas faturas de freelancers domésticos (a ESt
    // paga-se por Vorauszahlungen) — 25% era a Abgeltungsteuer, não se aplica.
    fiscal: { IRS_percent: 0, IVA_percent: 19 },
    tabela: {
      H_dia: 8,
      descanso_min: 11,
      multHEA: 1.25,
      multHEB: 1.5,
      multHR: 2.0,
      limiar_A: 8,
      limiar_B: 10,
    },
  },

  // Tabela base comum (10h/dia, descanso 11h) para as regiões novas — o
  // utilizador ajusta no Perfil; as taxas fiscais são indicativas (disclaimer).
  nl: {
    code: "nl",
    nameKey: "region_nl",
    flag: "🇳🇱",
    currency: "EUR",
    currencySymbol: "€",
    taxLabels: { incomeTax: "IB", vat: "BTW" },
    fiscal: { IRS_percent: 0, IVA_percent: 21 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.5, multHEB: 2.0, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
  be: {
    code: "be",
    nameKey: "region_be",
    flag: "🇧🇪",
    currency: "EUR",
    currencySymbol: "€",
    taxLabels: { incomeTax: "Précompte", vat: "TVA" },
    fiscal: { IRS_percent: 0, IVA_percent: 21 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.5, multHEB: 2.0, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
  at: {
    code: "at",
    nameKey: "region_at",
    flag: "🇦🇹",
    currency: "EUR",
    currencySymbol: "€",
    taxLabels: { incomeTax: "ESt", vat: "USt" },
    fiscal: { IRS_percent: 0, IVA_percent: 20 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.5, multHEB: 2.0, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
  ch: {
    code: "ch",
    nameKey: "region_ch",
    flag: "🇨🇭",
    currency: "CHF",
    currencySymbol: "CHF",
    taxLabels: { incomeTax: "Quellensteuer", vat: "MwSt" },
    fiscal: { IRS_percent: 0, IVA_percent: 8.1 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.25, multHEB: 1.5, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
  se: {
    code: "se",
    nameKey: "region_se",
    flag: "🇸🇪",
    currency: "SEK",
    currencySymbol: "kr",
    taxLabels: { incomeTax: "Inkomstskatt", vat: "Moms" },
    fiscal: { IRS_percent: 30, IVA_percent: 25 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.5, multHEB: 2.0, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
  no: {
    code: "no",
    nameKey: "region_no",
    flag: "🇳🇴",
    currency: "NOK",
    currencySymbol: "kr",
    taxLabels: { incomeTax: "Inntektsskatt", vat: "MVA" },
    fiscal: { IRS_percent: 0, IVA_percent: 25 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.5, multHEB: 2.0, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
  fi: {
    code: "fi",
    nameKey: "region_fi",
    flag: "🇫🇮",
    currency: "EUR",
    currencySymbol: "€",
    taxLabels: { incomeTax: "Tulovero", vat: "ALV" },
    fiscal: { IRS_percent: 0, IVA_percent: 25.5 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.5, multHEB: 2.0, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
  cz: {
    code: "cz",
    nameKey: "region_cz",
    flag: "🇨🇿",
    currency: "CZK",
    currencySymbol: "Kč",
    taxLabels: { incomeTax: "Daň z příjmů", vat: "DPH" },
    fiscal: { IRS_percent: 15, IVA_percent: 21 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.25, multHEB: 1.5, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
  pl: {
    code: "pl",
    nameKey: "region_pl",
    flag: "🇵🇱",
    currency: "PLN",
    currencySymbol: "zł",
    taxLabels: { incomeTax: "PIT", vat: "VAT" },
    fiscal: { IRS_percent: 12, IVA_percent: 23 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.5, multHEB: 2.0, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
  hu: {
    code: "hu",
    nameKey: "region_hu",
    flag: "🇭🇺",
    currency: "HUF",
    currencySymbol: "Ft",
    taxLabels: { incomeTax: "SZJA", vat: "ÁFA" },
    fiscal: { IRS_percent: 15, IVA_percent: 27 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.5, multHEB: 2.0, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
  dk: {
    code: "dk",
    nameKey: "region_dk",
    flag: "🇩🇰",
    currency: "DKK",
    currencySymbol: "kr.",
    taxLabels: { incomeTax: "Indkomstskat", vat: "Moms" },
    fiscal: { IRS_percent: 0, IVA_percent: 25 },
    tabela: { H_dia: 10, descanso_min: 11, multHEA: 1.5, multHEB: 2.0, multHR: 2.0, limiar_A: 10, limiar_B: 14 },
  },
};

export const REGION_LIST = Object.values(REGION_PRESETS);

export function getPreset(code: string | undefined): RegionPreset {
  return REGION_PRESETS[(code as RegionCode) ?? "pt"] ?? REGION_PRESETS.pt;
}
