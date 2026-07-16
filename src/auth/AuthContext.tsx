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

// Erro típico quando o refresh token guardado já não é aceite pelo servidor
// (sessão rotacionada noutro dispositivo, projeto reiniciado, etc.).
function isInvalidRefreshToken(err: any): boolean {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return msg.includes("refresh token") || err?.code === "refresh_token_not_found";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000);

    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        // Token de refresh inválido/inexistente (sessão antiga presa no
        // armazenamento): purga a sessão local e cai no login, em vez de
        // rebentar. Um signOut 'local' não chama o servidor (o token já morreu).
        if (error && isInvalidRefreshToken(error)) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          setSession(null);
        } else {
          setSession(session ?? null);
        }
      } catch (e: any) {
        if (isInvalidRefreshToken(e)) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        }
        setSession(null);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // A renovação automática falhou → o Supabase emite SIGNED_OUT; limpamos.
      if (event === "SIGNED_OUT") { setSession(null); return; }
      // Atualizações de metadados (ex.: gravar a língua na conta ao mudá-la
      // nas Definições) não mudam a sessão — trocar o objeto aqui fazia a app
      // inteira re-renderizar e saltar para a página inicial.
      if (event === "USER_UPDATED") return;
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
