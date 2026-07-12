import { Session, User } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useState } from "react";
import i18n from "../i18n/i18n";
import { supabase } from "../lib/supabase";

// Domínio de produção da web app — para onde apontam os links dos emails
// (recuperação de palavra-passe e confirmação de registo).
export const SITE_URL = "https://wrapsheet-app.com";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Devolve { error } ou { needsConfirmation: true } quando o Supabase exige confirmação por email */
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000);
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      setLoading(false);
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }> {
    const lang = i18n.language || "en";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // A língua vai no link (a página de aterragem aplica-a) e nos
        // metadados do utilizador (os templates de email usam {{ .Data.lang }})
        emailRedirectTo: `${SITE_URL}/auth/login?confirmed=1&lang=${encodeURIComponent(lang)}`,
        data: { lang },
      },
    });
    if (error) return { error: error.message, needsConfirmation: false };
    // Com "Confirm email" ativo no Supabase, não há sessão até o utilizador
    // clicar no link do email — a UI deve mostrar "verifica o teu email".
    return { error: null, needsConfirmation: !data.session };
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async function resetPassword(email: string): Promise<string | null> {
    // Sem redirectTo, o link do email caía no Site URL predefinido do Supabase
    // (localhost) → "server not found". Aponta para o ecrã de reposição na web,
    // levando a língua atual para a página abrir na língua certa.
    const lang = i18n.language || "en";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/auth/reset?lang=${encodeURIComponent(lang)}`,
    });
    return error ? error.message : null;
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
