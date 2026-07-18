import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPreset } from "../constants/countryPresets";

export type AppSettings = {
  language?: string;
  onboardingComplete?: boolean;
  region?: string;
  // Taxas personalizadas na página da Região Fiscal (vazio = standard do país).
  // São a ÚNICA fonte global de impostos: projetos novos e Painel usam-nas;
  // cada folha pode depois sobrepor caso um trabalho fuja à regra.
  fiscalIRS?: number;
  fiscalIVA?: number;
};

const KEY = "app-settings";

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}

async function patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const merged = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

export async function setLanguage(lang: string) {
  return patchSettings({ language: lang });
}

export async function setRegion(region: string) {
  // Escolher um país adota o standard dele — limpa os valores personalizados
  return patchSettings({ region, fiscalIRS: undefined, fiscalIVA: undefined });
}

export async function setCustomFiscal(
  irs: number | undefined,
  iva: number | undefined
) {
  return patchSettings({ fiscalIRS: irs, fiscalIVA: iva });
}

/** Taxas em vigor na app: personalizadas se existirem, senão o standard do país. */
export function effectiveFiscalOf(s: AppSettings): { IRS_percent: number; IVA_percent: number } {
  const p: any = getPreset((s.region as any) ?? "pt")?.fiscal ?? {};
  return {
    IRS_percent: s.fiscalIRS ?? Number(p.IRS_percent ?? 0),
    IVA_percent: s.fiscalIVA ?? Number(p.IVA_percent ?? 0),
  };
}

export async function getEffectiveFiscal() {
  return effectiveFiscalOf(await getSettings());
}

export async function completeOnboarding() {
  await patchSettings({ onboardingComplete: true });
}
