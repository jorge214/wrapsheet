// src/lib/webCheckout.ts
// Compra pelo COMPUTADOR (Stripe). A Apple não deixa vender fora da app no
// iOS, por isso isto só corre na web — no iPhone/iPad a compra é sempre pelo
// IAP (ver src/lib/purchases.ts).
//
// O direito acaba na MESMA tabela `entitlements`, com source='stripe'. Para o
// resto da app é indiferente por onde foi pago: quem tem direito tem 10 perfis
// em todos os dispositivos.
import { Platform } from "react-native";
import { supabase } from "./supabase";

export type WebPlan = "monthly" | "yearly";

/** Dá para comprar aqui? (só na web — no iOS a compra é pelo IAP da Apple) */
export function isWebCheckoutAvailable(): boolean {
  return Platform.OS === "web";
}

/**
 * Abre o pagamento do Stripe. Redireciona a página atual (não abre separador
 * novo: os browsers bloqueiam pop-ups abertos depois de um await, e o
 * utilizador ficava sem perceber porque nada aconteceu).
 *
 * Devolve mensagem de erro, ou null se o redirecionamento arrancou.
 */
export async function startWebCheckout(plan: WebPlan): Promise<string | null> {
  if (Platform.OS !== "web") return "unavailable";
  try {
    const { data, error } = await supabase.functions.invoke("stripe-checkout", {
      body: { plan },
    });
    if (error) return error.message ?? "checkout_failed";
    const url = (data as any)?.url;
    if (!url) return "checkout_failed";
    (window as any).location.href = url;
    return null;
  } catch (e: any) {
    return String(e?.message ?? e);
  }
}
