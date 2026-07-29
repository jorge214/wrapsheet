// src/lib/entitlements.ts
// PASSO 5 (multi-perfil): limite de perfis lido da tabela `entitlements` na BD
// (RLS: cada utilizador só lê a sua linha). Substitui o booleano
// app_metadata.profiles_unlocked do JWT — que só atualizava ao renovar o token
// (~1h) — por um valor imediato e com limite numérico (ex.: 9,99€ -> 10 perfis).
//
// Ordem de decisão:
//   1) linha em `entitlements` válida (active e não expirada) -> max_profiles
//   2) compatibilidade: app_metadata.profiles_unlocked === true -> 10
//   3) caso contrário -> 1 (plano gratuito)
// Se a tabela ainda não existir (ex.: produção antes da migração 0002) ou a
// rede falhar, cai nos passos 2/3 — nunca rebenta nem bloqueia o utilizador.
import { supabase } from "./supabase";

export const FREE_MAX_PROFILES = 1;
export const UNLOCKED_MAX_PROFILES = 10;
// Teto ABSOLUTO do produto: nunca é possível ter mais de 10 perfis, venha o
// valor de onde vier (BD, metadata). Espelhado no check constraint da tabela.
export const HARD_MAX_PROFILES = 10;

type UserLike = { id: string; app_metadata?: Record<string, any> } | null | undefined;

export async function getMaxProfiles(user: UserLike): Promise<number> {
  if (!user?.id) return FREE_MAX_PROFILES;

  try {
    const { data, error } = await supabase
      .from("entitlements")
      .select("max_profiles, active, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data && data.active !== false) {
      const notExpired =
        !data.expires_at || Date.parse(String(data.expires_at)) > Date.now();
      const max = Number(data.max_profiles);
      if (notExpired && Number.isFinite(max) && max >= 1) {
        return Math.min(max, HARD_MAX_PROFILES);
      }
    }
  } catch {
    // offline / tabela inexistente -> fallbacks abaixo
  }

  // Compatibilidade com o desbloqueio manual antigo (app_metadata no JWT)
  if ((user.app_metadata as any)?.profiles_unlocked === true) {
    return UNLOCKED_MAX_PROFILES;
  }
  return FREE_MAX_PROFILES;
}
