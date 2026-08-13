// supabase/functions/stripe-webhook/index.ts
// Recebe os eventos do Stripe (pagamentos feitos no COMPUTADOR) e escreve o
// direito na tabela `entitlements`, tal como o webhook do RevenueCat faz para
// o iOS. O cliente não sabe nem precisa de saber por onde foi pago: lê sempre
// a mesma tabela, e a coluna `source` diz de onde veio ('stripe' ou 'revenuecat').
//
// SEGURANÇA: a assinatura é verificada à mão (HMAC-SHA256 sobre "timestamp.corpo",
// como o Stripe manda). Sem isto, qualquer pessoa que descobrisse o URL podia
// oferecer-se 10 perfis com um simples pedido HTTP.
//
// Segredos (supabase secrets set):
//   STRIPE_WEBHOOK_SECRET  whsec_… (dado pelo Stripe ao criar o endpoint)
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
//   (quem autentica é a assinatura do Stripe, não um JWT de utilizador)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROFILES_WHEN_ACTIVE = 10;
// Estados em que a subscrição dá direito. 'past_due' entra de propósito: é o
// período em que o Stripe ainda está a tentar cobrar — cortar já os perfis a
// quem só teve um problema no cartão seria hostil e provavelmente temporário.
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Verifica a assinatura do Stripe (esquema v1). */
async function verify(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  ) as Record<string, string>;
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  // Janela de 5 minutos: impede reenviar um pedido antigo capturado antes.
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // Comparação de tempo constante — não revela o segredo byte a byte.
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const sigHeader = req.headers.get("stripe-signature");
  if (!secret || !sigHeader) return json({ error: "unauthorized" }, 401);

  const raw = await req.text();
  if (!(await verify(raw, sigHeader, secret))) {
    return json({ error: "bad signature" }, 401);
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const type: string = event?.type ?? "";
  const obj: any = event?.data?.object ?? {};

  // O user_id do Supabase vem em sítios diferentes conforme o evento
  const userId: string =
    obj?.client_reference_id ??
    obj?.metadata?.supabase_user_id ??
    obj?.subscription_details?.metadata?.supabase_user_id ??
    "";

  let grant: boolean | null = null;
  let expiresAt: string | null = null;

  if (type === "checkout.session.completed") {
    grant = obj?.payment_status === "paid" || obj?.status === "complete";
  } else if (type === "customer.subscription.updated" || type === "customer.subscription.created") {
    grant = ACTIVE_STATUSES.has(String(obj?.status));
    const end = Number(obj?.current_period_end);
    if (Number.isFinite(end) && end > 0) expiresAt = new Date(end * 1000).toISOString();
  } else if (type === "customer.subscription.deleted") {
    grant = false;
  } else {
    return json({ ok: true, ignored: type }); // faturas, cartões, etc.
  }

  if (!userId) {
    console.error("evento sem supabase_user_id:", type);
    return json({ ok: true, ignored: `${type} (sem user)` });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { error } = await supabase.from("entitlements").upsert(
    {
      user_id: userId,
      max_profiles: grant ? PROFILES_WHEN_ACTIVE : 1,
      active: !!grant,
      source: "stripe",
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("entitlements upsert falhou:", error.message, { type, userId });
    return json({ ok: false, error: error.message }, 500);
  }

  console.log(`stripe ${grant ? "GRANT" : "REVOKE"} ${userId} (${type})`);
  return json({ ok: true, type, user: userId, active: !!grant });
});
