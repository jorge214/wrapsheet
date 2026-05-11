import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppSettings = {
  language?: string;
  onboardingComplete?: boolean;
  region?: string;
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
  return patchSettings({ region });
}

export async function completeOnboarding() {
  await patchSettings({ onboardingComplete: true });
}
