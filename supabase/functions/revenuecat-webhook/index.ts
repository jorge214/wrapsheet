// supabase/functions/revenuecat-webhook/index.ts
// PASSO 7 — Webhook do RevenueCat. É a ÚNICA coisa que escreve na tabela
// `entitlements` (RLS: escrita só service_role). O RevenueCat chama este URL a
// cada evento de subscrição; nós traduzimos para uma linha em entitlements que
// o cliente (getMaxProfiles) lê em todas as plataformas.
//
// Configurar no painel do RevenueCat (Integrations -> Webhooks):
//   * URL:   https://<PROJECT>.supabase.co/functions/v1/revenuecat-webhook
//   * Header Authorization: o MESMO valor que puseres no segredo
//     REVENUECAT_WEBHOOK_SECRET (abaixo). Sem match -> 401.
//
// Segredos a definir na função (supabase secrets set):
//   REVENUECAT_WEBHOOK_SECRET = <string aleatória, igual à do painel>
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados pelo Supabase)
//
// Deploy:  supabase functions deploy revenuecat-webhook --no-verify-jwt
//   (--no-verify-jwt porque quem autentica é o header do RevenueCat, não um JWT
//    de utilizador; a verificação é o nosso REVENUECAT_WEBHOOK_SECRET.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROFILES_WHEN_ACTIVE = 10; // qualquer plano (mensal/anual): até 10 perfis
const OUR_ENTITLEMENT_ID = "profiles_10";
const OUR_PRODUCT_IDS = new Set([
  "wrapsheet_profiles10_monthly",
  "wrapsheet_profiles10_yearly",
]);

// Eventos que CONCEDEM/mantêm o direito ativo
const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);
// Eventos que REVOGAM o direito (perde o acesso a >1 perfil)
const REVOKE_EVENTS = new Set(["EXPIRATION", "REFUND"]);
// CANCELLATION (auto-renovação desligada mas ainda válido até expirar) e
// BILLING_ISSUE (período de graça) NÃO revogam — só a EXPIRATION revoga.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // 1) Autenticação: header partilhado com o painel do RevenueCat
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const event = body?.event ?? body; // RevenueCat envia { event: {...} }
  const type: string = event?.type ?? "";
  // appUserID que definimos = user_id do Supabase
  const appUserId: string = event?.app_user_id ?? "";

  // Eventos sem utilizador válido (TEST, aliases, etc.) -> 200 e ignora
  if (!UUID_RE.test(appUserId)) {
    return json({ ok: true, ignored: `no-uuid-user (${type})` });
  }

  const isGrant = GRANT_EVENTS.has(type);
  const isRevoke = REVOKE_EVENTS.has(type);
  if (!isGrant && !isRevoke) {
    return json({ ok: true, ignored: type }); // CANCELLATION, BILLING_ISSUE, TEST, ...
  }

  // Confirma que é o NOSSO produto/entitlement. As concessões só valem para o
  // nosso produto; as revogações aplicam-se sempre (defensivo: se algo expira,
  // baixa para 1 perfil de qualquer forma).
  const entIds: string[] = Array.isArray(event?.entitlement_ids) ? event.entitlement_ids : [];
  const productId: string = event?.product_id ?? "";
  const isOurs =
    entIds.includes(OUR_ENTITLEMENT_ID) ||
    OUR_PRODUCT_IDS.has(productId) ||
    entIds.length === 0; // alguns eventos não trazem entitlement_ids
  if (isGrant && !isOurs) {
    return json({ ok: true, ignored: `other-product (${type})` });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const expMs = Number(event?.expiration_at_ms);
  const expiresAt = Number.isFinite(expMs) && expMs > 0 ? new Date(expMs).toISOString() : null;

  const row = {
    user_id: appUserId,
    // Concessão -> 10 perfis ativos; revogação -> volta ao gratuito (1 perfil).
    // Não apagamos a linha: fica o histórico e a source.
    max_profiles: isGrant ? PROFILES_WHEN_ACTIVE : 1,
    active: isGrant,
    source: "revenuecat",
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("entitlements").upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("entitlements upsert failed:", error.message, { type, appUserId });
    return json({ ok: false, error: error.message }, 500);
  }

  console.log(`entitlements ${isGrant ? "GRANT" : "REVOKE"} ${appUserId} (${type})`);
  return json({ ok: true, type, user: appUserId, active: isGrant });
});
