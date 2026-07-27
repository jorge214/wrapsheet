import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// Chaves via variáveis de ambiente (EXPO_PUBLIC_*), com FALLBACK aos valores de
// produção atuais — assim a web/produção continuam iguais (usam o fallback) e o
// ambiente de DEV aponta para o projeto Supabase separado só definindo as env:
//   EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
// (a anon key é pública por natureza; o fallback aqui não é um segredo exposto).
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://joymgpqtbkobjmznqyzi.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpveW1ncHF0YmtvYmptem5xeXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjc3NTYsImV4cCI6MjA5NTgwMzc1Nn0.wkClDRRUXINktGHApzuXaE_iHKRAxFfHQDeYgKvKev8";

// SSR-safe storage:
// - Native: AsyncStorage
// - Web browser: localStorage
// - During SSR build (window undefined): no-op (returns null, doesn't throw)
function buildStorage() {
  if (Platform.OS !== "web") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-async-storage/async-storage").default;
  }
  return {
    getItem: (key: string) => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
    },
  };
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: buildStorage(),
    autoRefreshToken: true,
    persistSession: true,
    // Na web tem de estar ativo: é o que apanha o token do link de
    // recuperação de palavra-passe (#access_token…type=recovery) no /auth/reset.
    detectSessionInUrl: Platform.OS === "web" && typeof window !== "undefined",
  },
});
