// supabase/functions/stripe-checkout/index.ts
// Cria a sessão de pagamento do Stripe para quem subscreve pelo COMPUTADOR.
//
// Porquê uma função no servidor: a chave secreta do Stripe nunca pode ir para o
// browser. O cliente pede aqui, nós criamos a sessão e devolvemos o URL para
// onde o redirecionar.
//
// O utilizador é identificado pelo JWT do Supabase (não confiamos em nenhum id
// vindo do cliente): daí extraímos o user_id, que viaja na sessão e volta no
// webhook para sabermos a quem dar o direito.
//
// Segredos (supabase secrets set):
//   STRIPE_SECRET_KEY     sk_test_… ou sk_live_…
//   STRIPE_PRICE_MONTHLY  price_… (9,99 €/mês)
//   STRIPE_PRICE_YEARLY   price_… (99,99 €/ano)
//   SITE_URL              https://wrapsheet-app.com
//
// Deploy: supabase functions deploy stripe-checkout

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const SITE = Deno.env.get("SITE_URL") ?? "https://wrapsheet-app.com";
  if (!STRIPE_KEY) return json({ error: "stripe not configured" }, 500);

  // 1) Quem está a pedir? O JWT é a única fonte de verdade sobre a identidade.
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "not authenticated" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } }
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json({ error: "not authenticated" }, 401);

  // 2) Qual plano?
  let plan = "monthly";
  try {
    const body = await req.json();
    if (body?.plan === "yearly") plan = "yearly";
  } catch {
    // sem corpo -> mensal
  }
  const price =
    plan === "yearly"
      ? Deno.env.get("STRIPE_PRICE_YEARLY")
      : Deno.env.get("STRIPE_PRICE_MONTHLY");
  if (!price) return json({ error: "price not configured" }, 500);

  // 3) Sessão de pagamento. O user_id vai em dois sítios de propósito:
  //    - client_reference_id: chega no checkout.session.completed
  //    - metadata da subscrição: chega nos eventos de renovação/cancelamento,
  //      que já não trazem a sessão.
  const form = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    customer_email: user.email ?? "",
    "subscription_data[metadata][supabase_user_id]": user.id,
    "metadata[supabase_user_id]": user.id,
    success_url: `${SITE}/profiles?checkout=success`,
    cancel_url: `${SITE}/profiles/unlock?checkout=cancelled`,
    allow_promotion_codes: "true",
    locale: "auto",
  });

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const session = await r.json();
  if (!r.ok) {
    console.error("stripe checkout failed:", JSON.stringify(session).slice(0, 400));
    return json({ error: session?.error?.message ?? "stripe error" }, 500);
  }

  return json({ url: session.url });
});
