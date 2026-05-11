export type RegionCode = "pt" | "es" | "fr" | "uk" | "de";

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
    fiscal: { IRS_percent: 18, IVA_percent: 20 },
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
    fiscal: { IRS_percent: 25, IVA_percent: 19 },
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
};

export const REGION_LIST = Object.values(REGION_PRESETS);

export function getPreset(code: string | undefined): RegionPreset {
  return REGION_PRESETS[(code as RegionCode) ?? "pt"] ?? REGION_PRESETS.pt;
}
