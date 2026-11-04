// src/lib/purchases.ts
// PASSO 7 — camada de compras (RevenueCat): IAP da Apple no iOS e, assim que
// existir a chave `goog_…`, faturação do Google Play no Android.
//
// TUDO é lazy: o SDK nativo `react-native-purchases` NÃO existe no Expo Go nem
// na web. Por isso nunca se importa no topo — carrega-se com require() dentro de
// try, e qualquer chamada degrada em silêncio se não estiver disponível. Assim o
// Expo Go/web continuam a correr; o paywall real só funciona numa build EAS (iOS,
// e Android assim que a chave `goog_…` entrar no bundle).
//
// Há DOIS produtos (mensal e anual) mas UM só entitlement (`profiles_10` -> 10
// perfis). O paywall lê os pacotes da offering "current" e deixa o utilizador
// escolher; ambos concedem o mesmo direito.
//
// Fluxo: compra -> a loja (Apple / Google Play) confirma -> RevenueCat -> webhook
// (Edge Function) escreve max_profiles=10 no `entitlements` do Supabase -> o
// cliente (getMaxProfiles) lê de lá em todas as plataformas. O entitlement do
// RevenueCat é a fonte imediata no próprio aparelho (iOS e Android); o Supabase
// é a fonte partilhada. O que muda de loja para loja (textos, links, mensagens)
// vive em storeRules.ts.
import { Platform } from "react-native";
import { nativeStore, rcKeyFor, type RcEntitlement } from "./storeRules";

// Chaves PÚBLICAS do RevenueCat — seguras no cliente, vêm de env. Enquanto a
// do Android não existir (produtos ainda por criar na Play Console), as compras
// ficam desligadas nessa plataforma sem partir nada: isPurchasesAvailable()
// devolve falso e o paywall mostra a alternativa, tal como já fazia. Num `eas
// update` nenhuma das duas vem do eas.json: exportam-se no comando (CLAUDE.md).
const RC_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "";
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "";
// Entitlement do RevenueCat (o mesmo nas duas lojas) e IDs dos produtos na App
// Store Connect. Os da Google Play ("subscrição:plano-base") não precisam de
// estar aqui: a app compra pelos pacotes da offering.
export const RC_ENTITLEMENT_ID = "profiles_10";
export const IAP_MONTHLY_ID = "wrapsheet_profiles10_monthly";
export const IAP_YEARLY_ID = "wrapsheet_profiles10_yearly";

let configuredFor: string | null = null;

/** Chave da loja desta plataforma ("" desliga as compras aqui). */
function storeKey(): string {
  return rcKeyFor(Platform.OS, { ios: RC_IOS_KEY, android: RC_ANDROID_KEY });
}

function getSDK(): any | null {
  if (!nativeStore(Platform.OS)) return null; // web: a compra é pela Stripe
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-purchases").default;
  } catch {
    return null; // Expo Go / módulo nativo ausente
  }
}

/** Há SDK de compras disponível nesta plataforma/build? (falso no Expo Go/web) */
export function isPurchasesAvailable(): boolean {
  return !!storeKey() && !!getSDK();
}

/** Configura o SDK uma vez, ligando a compra ao user_id do Supabase. */
export async function configurePurchases(supabaseUserId: string): Promise<boolean> {
  const P = getSDK();
  const key = storeKey();
  if (!P || !key || !supabaseUserId) return false;
  if (configuredFor === supabaseUserId) return true;
  try {
    P.configure({ apiKey: key, appUserID: supabaseUserId });
    configuredFor = supabaseUserId;
    return true;
  } catch {
    return false;
  }
}

/** Já tem o direito ativo (segundo o RevenueCat, no próprio device)? */
export async function hasActiveEntitlement(): Promise<boolean> {
  const P = getSDK();
  if (!P) return false;
  try {
    const info = await P.getCustomerInfo();
    return !!info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

/**
 * O direito ativo segundo o RevenueCat: em que loja foi comprado, que produto e
 * se é compra de teste (sandbox). null se não houver, ou sem SDK/chave. Serve
 * para os textos e o link de gestão dependerem da loja (ver storeRules.ts).
 */
export async function getActiveEntitlement(): Promise<RcEntitlement | null> {
  const P = getSDK();
  if (!P) return null;
  try {
    const info = await P.getCustomerInfo();
    const e = info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    if (!e) return null;
    return { store: String(e.store ?? ""), productId: String(e.productIdentifier ?? ""), sandbox: !!e.isSandbox };
  } catch {
    return null;
  }
}

// ── Pacotes do paywall ───────────────────────────────────────────────────────
export type PlanPkg = {
  id: string; // identificador do package (ex.: "$rc_monthly") — usado para comprar
  type: string; // MONTHLY | ANNUAL | ...
  priceString: string; // preço localizado (ex.: "9,99 €")
  price: number; // valor numérico
  currencyCode: string;
  periodMonths: number; // 1 (mensal) | 12 (anual) — para calcular equivalente/mês
};

function monthsForType(t: string): number {
  switch (t) {
    case "ANNUAL":
      return 12;
    case "SIX_MONTH":
      return 6;
    case "THREE_MONTH":
      return 3;
    case "TWO_MONTH":
      return 2;
    case "MONTHLY":
      return 1;
    case "WEEKLY":
      return 0.25;
    default:
      return 1;
  }
}

function normalizePkg(pkg: any): PlanPkg | null {
  const prod = pkg?.product;
  if (!pkg?.identifier || !prod?.priceString) return null;
  return {
    id: pkg.identifier,
    type: pkg.packageType ?? "MONTHLY",
    priceString: prod.priceString,
    price: Number(prod.price) || 0,
    currencyCode: prod.currencyCode ?? "",
    periodMonths: monthsForType(pkg.packageType ?? "MONTHLY"),
  };
}

// A offering "current" (marcada no RevenueCat) é a fonte normal; se por algum
// motivo não estiver marcada, cai na offering de lookup_key "default".
function pickOffering(offerings: any): any {
  return offerings?.current ?? offerings?.all?.default ?? null;
}

/** Pacotes disponíveis na offering (mensal, anual, …). Vazio se sem SDK. */
export async function getPlanPackages(): Promise<PlanPkg[]> {
  const P = getSDK();
  if (!P) return [];
  try {
    const offerings = await P.getOfferings();
    const pkgs: any[] = pickOffering(offerings)?.availablePackages ?? [];
    return pkgs.map(normalizePkg).filter((p): p is PlanPkg => !!p);
  } catch {
    return [];
  }
}

// code = código do erro do RevenueCat (Purchases.PURCHASES_ERROR_CODE, em
// texto: "20" = pagamento pendente…); sandbox = compra de teste.
type BuyResult = { ok: boolean; cancelled?: boolean; error?: string; code?: string; sandbox?: boolean };

function errorResult(e: any): BuyResult {
  return { ok: false, error: String(e?.message ?? e), code: e?.code != null ? String(e.code) : undefined };
}

/** Compra o package escolhido (por identificador). ok=true se ficou com o direito. */
export async function buyPackageById(id: string): Promise<BuyResult> {
  const P = getSDK();
  if (!P) return { ok: false, error: "unavailable" };
  try {
    const offerings = await P.getOfferings();
    const pkgs: any[] = pickOffering(offerings)?.availablePackages ?? [];
    const pkg = pkgs.find((p) => p.identifier === id) ?? pkgs[0];
    if (!pkg) return { ok: false, error: "no_offering" };
    const { customerInfo } = await P.purchasePackage(pkg);
    const ent = customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    return { ok: !!ent, sandbox: !!ent?.isSandbox };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return errorResult(e);
  }
}

/** Restaurar compras (obrigatório pela Apple; no Android recupera a compra
 *  feita com a mesma conta Google). */
export async function restorePurchases(): Promise<BuyResult> {
  const P = getSDK();
  if (!P) return { ok: false, error: "unavailable" };
  try {
    const info = await P.restorePurchases();
    const ent = info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    return { ok: !!ent, sandbox: !!ent?.isSandbox };
  } catch (e: any) {
    return errorResult(e);
  }
}
