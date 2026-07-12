import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import it from "./it.json";
import nl from "./nl.json";
import pl from "./pl.json";
import ptBR from "./pt-BR.json";
import pt from "./pt.json";

export const LANG_KEY = "app:language";

export const SUPPORTED_LANGS = ["pt", "en", "es", "pt-BR", "fr", "de", "it", "nl", "pl"] as const;
export type LangCode = (typeof SUPPORTED_LANGS)[number];

const resources = {
  pt:    { translation: pt },
  en:    { translation: en },
  es:    { translation: es },
  "pt-BR": { translation: ptBR },
  fr:    { translation: fr },
  de:    { translation: de },
  it:    { translation: it },
  nl:    { translation: nl },
  pl:    { translation: pl },
};

function normalizeLang(tag: string): LangCode {
  const t = (tag || "").replace("_", "-").toLowerCase();
  if (t.startsWith("pt-br")) return "pt-BR";
  if (t.startsWith("pt"))    return "pt";
  if (t.startsWith("en"))    return "en";
  if (t.startsWith("es"))    return "es";
  if (t.startsWith("fr"))    return "fr";
  if (t.startsWith("de"))    return "de";
  if (t.startsWith("it"))    return "it";
  if (t.startsWith("nl"))    return "nl";
  if (t.startsWith("pl"))    return "pl";
  return "en";
}

// During SSR/static build window is undefined — always start with "en" so the
// generated HTML matches what the browser will hydrate with.
const isSSR = typeof window === "undefined";
const locales = isSSR ? [] : Localization.getLocales();
const deviceLocale = isSSR ? "en" : normalizeLang(locales?.[0]?.languageTag || "en");

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLocale,
  fallbackLng: ["en", "pt"],
  compatibilityJSON: "v4",
  interpolation: { escapeValue: false },
});

export async function setAppLanguage(code: LangCode) {
  await AsyncStorage.setItem(LANG_KEY, code);
  await i18n.changeLanguage(code);
}

// Aplica a língua vinda de um parâmetro ?lang= no URL (web).
// Usado nas páginas de aterragem dos emails (confirmação de registo e
// recuperação de palavra-passe) para abrirem na língua escolhida no registo,
// independentemente da língua do browser onde o link foi aberto.
export async function applyLangFromUrl(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const lang = new URLSearchParams(window.location.search).get("lang");
    if (lang && (SUPPORTED_LANGS as readonly string[]).includes(lang) && i18n.language !== lang) {
      await setAppLanguage(lang as LangCode);
    }
  } catch {}
}

export async function loadStoredLanguage() {
  const saved = await AsyncStorage.getItem(LANG_KEY);
  if (saved && (SUPPORTED_LANGS as readonly string[]).includes(saved)) {
    if (i18n.language !== saved) {
      await i18n.changeLanguage(saved);
    }
  }
}

loadStoredLanguage().catch(() => {});

export default i18n;
