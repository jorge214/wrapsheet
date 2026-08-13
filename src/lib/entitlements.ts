// src/lib/entitlements.ts
// PASSO 5 (multi-perfil): limite de perfis lido da tabela `entitlements` na BD
// (RLS: cada utilizador só lê a sua linha). Substitui o booleano
// app_metadata.profiles_unlocked do JWT — que só atualizava ao renovar o token
// (~1h) — por um valor imediato e com limite numérico (ex.: 9,99€ -> 10 perfis).
//
// Ordem de decisão (fica com o valor MAIS ALTO de qualquer sinal, teto 10):
//   1) linha em `entitlements` válida (active e não expirada) -> max_profiles
//   2) iOS: direito ativo no RevenueCat no próprio device -> 10 (imediato pós-compra)
//   3) compatibilidade: app_metadata.profiles_unlocked === true -> 10
//   4) caso contrário -> 1 (plano gratuito)
// O passo 2 é a ponte imediata: a seguir a comprar, o RevenueCat no device já
// dá o direito antes de o webhook escrever no `entitlements` (fonte partilhada).
// Se a tabela ainda não existir (ex.: produção antes da migração 0002) ou a
// rede falhar, cai nos outros passos — nunca rebenta nem bloqueia o utilizador.
import { supabase } from "./supabase";
import { hasActiveEntitlement } from "./purchases";

export const FREE_MAX_PROFILES = 1;
export const UNLOCKED_MAX_PROFILES = 10;
// Teto ABSOLUTO do produto: nunca é possível ter mais de 10 perfis, venha o
// valor de onde vier (BD, metadata). Espelhado no check constraint da tabela.
export const HARD_MAX_PROFILES = 10;

type UserLike = { id: string; app_metadata?: Record<string, any> } | null | undefined;

/**
 * Espera que o webhook do RevenueCat escreva a linha em `entitlements`.
 *
 * Sem isto há uma janela real de falha: a seguir à compra o cliente já conta 10
 * perfis (a ponte do RevenueCat no próprio dispositivo), mas o TRIGGER na base
 * de dados só deixa criar quando a linha existir. Criar um perfil nesse
 * intervalo dava um perfil que funciona no telemóvel mas nunca sobe para a
 * cloud — e o utilizador não via nada.
 *
 * Devolve true assim que o direito estiver na BD; false se esgotar o tempo (aí
 * o utilizador segue na mesma — a ponte local deixa-o usar a app, e o próximo
 * sync trata do resto quando o webhook chegar).
 */
export async function waitForServerEntitlement(
  userId: string,
  timeoutMs = 20000
): Promise<boolean> {
  if (!userId) return false;
  const deadline = Date.now() + timeoutMs;
  let delay = 1000;
  while (Date.now() < deadline) {
    try {
      const { data } = await supabase
        .from("entitlements")
        .select("max_profiles, active")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.active && Number(data.max_profiles) > 1) return true;
    } catch {
      // rede a falhar — volta a tentar até esgotar o tempo
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 4000); // recuo progressivo
  }
  return false;
}

export async function getMaxProfiles(user: UserLike): Promise<number> {
  if (!user?.id) return FREE_MAX_PROFILES;

  let best = FREE_MAX_PROFILES;

  // 1) Fonte partilhada: tabela entitlements (escrita pelo webhook do RevenueCat)
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
        best = Math.max(best, Math.min(max, HARD_MAX_PROFILES));
      }
    }
  } catch {
    // offline / tabela inexistente -> segue para os outros sinais
  }

  // 2) Ponte imediata no iOS: direito ativo no RevenueCat no próprio device.
  //    Cobre o intervalo entre a compra e o webhook escrever no entitlements.
  if (best < UNLOCKED_MAX_PROFILES) {
    try {
      if (await hasActiveEntitlement()) best = UNLOCKED_MAX_PROFILES;
    } catch {
      // SDK ausente (Expo Go/web) -> ignora
    }
  }

  // 3) Compatibilidade com o desbloqueio manual antigo (app_metadata no JWT)
  if (best < UNLOCKED_MAX_PROFILES && (user.app_metadata as any)?.profiles_unlocked === true) {
    best = UNLOCKED_MAX_PROFILES;
  }

  return best;
}
