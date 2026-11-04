// src/lib/storeRules.ts
// Regras por loja/plataforma das compras do multi-perfil: que texto legal, que
// nota de gestão, que link, que mensagem depois de pagar. Tudo puro — a
// plataforma (Platform.OS) entra como parâmetro, por isso os testes correm em
// node sem React Native (storeRules.test.ts).
//
// Duas regras que não se quebram:
//   • Dentro da app nativa a compra é SEMPRE a da loja do aparelho (IAP da
//     Apple no iOS, faturação do Google Play no Android) e nunca há link nem
//     menção à Stripe/site como forma de pagar — regra 3.1.2 da Apple e
//     política de pagamentos da Google Play. A Stripe é só na web.
//   • O iOS e a web ficam como estavam. O que é novo aqui só muda o Android —
//     e, no Android SEM a chave `goog_…`, só os textos que falavam do
//     iPhone/App Store: a compra continua desligada ("paywall_android_soon").

/** Plataforma, tal como Platform.OS ("ios" | "android" | "web" | …). */
export type Os = string;

/** O direito ativo segundo o RevenueCat no próprio aparelho (ver purchases.ts). */
export type RcEntitlement = {
  /** Loja onde foi comprado: "APP_STORE" | "PLAY_STORE" | "STRIPE" | "PROMOTIONAL" | … */
  store: string;
  /** Produto; no Google Play pode vir como "subscrição:plano-base". */
  productId: string;
  /** Compra de teste (TestFlight, testadores de licenças da Play): o evento vai
   *  para o webhook de teste e nunca chega à BD de produção. */
  sandbox: boolean;
};

/** A linha do utilizador em `entitlements` (só os campos que interessam aqui). */
export type EntitlementRow = {
  max_profiles?: number | null;
  active?: boolean | null;
  expires_at?: string | null;
};

export const ANDROID_PACKAGE = "com.wrapsheet";

// ── Que loja vende aqui ─────────────────────────────────────────────────────

/** Loja nativa desta plataforma (null na web: lá não há SDK de compras). */
export function nativeStore(os: Os): "app_store" | "play_store" | null {
  if (os === "ios") return "app_store";
  if (os === "android") return "play_store";
  return null;
}

/**
 * Chave PÚBLICA do RevenueCat desta plataforma. "" desliga as compras aqui — é
 * o Android de hoje, enquanto não houver a `goog_…`: o paywall diz "ainda não
 * disponível" e não há nada para comprar.
 */
export function rcKeyFor(os: Os, keys: { ios: string; android: string }): string {
  if (os === "ios") return keys.ios;
  if (os === "android") return keys.android;
  return ""; // web: a compra é pela Stripe (ver webCheckout.ts)
}

/** A compra aqui é pela Google Play? (Android com SDK e chave) */
export function isPlayBilling(os: Os, canBuy: boolean): boolean {
  return os === "android" && canBuy;
}

/** Os textos da subscrição dependem da loja onde o plano foi comprado? Só no
 *  Android — no iOS e na web ficam os de sempre. */
export function storeAware(os: Os): boolean {
  return os === "android";
}

// ── Textos ───────────────────────────────────────────────────────────────────

/**
 * Texto legal por baixo do botão Subscrever. Só aparece quando há compra
 * (nativa ou web) — canBuy=false aqui quer dizer a compra da web.
 *   apple  -> paywall_legal (Definições da App Store) — iOS, como sempre
 *   google -> paywall_legal_android: preço, renovação automática e onde
 *             cancelar na Play Store (política de subscrições da Google)
 *   stripe -> paywall_legal_web — web, como sempre
 */
export function paywallLegal(os: Os, canBuy: boolean): "apple" | "google" | "stripe" {
  if (!canBuy) return "stripe";
  return isPlayBilling(os, canBuy) ? "google" : "apple";
}

/**
 * Texto legal do cartão "Fazer upgrade" do ecrã Plano. No Android sem compras
 * não há nada para subscrever ali (o paywall diz "ainda não disponível"), por
 * isso não há texto — antes aparecia o da App Store. iOS e web: como sempre.
 */
export function planLegal(os: Os, canBuy: boolean): "apple" | "google" | null {
  if (os !== "android") return "apple";
  return canBuy ? "google" : null;
}

/** "Sincroniza no iPhone, iPad e computador" não serve a quem está no Android. */
export function syncBullet(os: Os): "apple" | "android" {
  return os === "android" ? "android" : "apple";
}

/** Conta e Definições mostram o plano real ("Equipa") em vez de "Plano
 *  gratuito"? Só no Android; no iOS e na web fica o texto de sempre. */
export function showsTeamPlan(os: Os, maxProfiles: number): boolean {
  return storeAware(os) && maxProfiles > 1;
}

// ── Gerir / cancelar ────────────────────────────────────────────────────────

/** "wrapsheet_profiles10:monthly" -> "wrapsheet_profiles10": o
 *  link da Play quer o id da subscrição, sem o plano base. */
export function playSubscriptionId(productId?: string | null): string {
  return String(productId ?? "").split(":")[0].trim();
}

/** Centro de subscrições da Google Play (link oficial): com o sku abre logo a
 *  subscrição do WrapSheet; sem ele, a lista de todas. */
export function playManageUrl(productId?: string | null): string {
  const base = "https://play.google.com/store/account/subscriptions";
  const sku = playSubscriptionId(productId);
  return sku ? `${base}?sku=${encodeURIComponent(sku)}&package=${ANDROID_PACKAGE}` : base;
}

export type ManageNote = "apple" | "google" | "apple_device" | "elsewhere";

/**
 * Onde se gere/cancela o plano (ecrã Plano, com o plano ativo):
 *   apple        -> plan_manage_note (Definições da App Store): iOS e web como
 *                   sempre
 *   google       -> plan_manage_note_play + botão para o centro de subscrições
 *   apple_device -> Android, comprado no iPhone/iPad: só texto. Nunca o
 *                   managementURL do RevenueCat, que aí aponta para a Apple.
 *   elsewhere    -> Stripe, desbloqueio manual ou loja desconhecida: texto
 *                   neutro, SEM link e sem nomear o site — no Android nunca se
 *                   aponta para pagar fora da Google Play.
 * O único link possível é o da Google Play, e só no Android.
 */
export function manageInfo(
  os: Os,
  canBuy: boolean,
  ent: RcEntitlement | null
): { note: ManageNote; url: string | null } {
  // No Android decide a loja ONDE FOI COMPRADO, não haver compras aqui: uma OTA
  // publicada sem a chave goog_ desliga o paywall, mas quem já subscreveu na
  // Play tem de continuar a ver como cancelar lá (e nunca "App Store").
  void canBuy;
  if (os !== "android") return { note: "apple", url: null };
  const store = ent?.store ?? "";
  if (store === "PLAY_STORE") return { note: "google", url: playManageUrl(ent?.productId) };
  if (store === "APP_STORE" || store === "MAC_APP_STORE") return { note: "apple_device", url: null };
  return { note: "elsewhere", url: null };
}

/**
 * Aviso a juntar à confirmação de "Apagar conta" (Android): apagar a conta não
 * cancela a subscrição na loja, e a Google continuava a cobrar a quem já não
 * tem conta. iOS e web: a confirmação de sempre.
 */
export function deleteAccountNote(
  os: Os,
  maxProfiles: number,
  ent: RcEntitlement | null
): "google" | "elsewhere" | null {
  if (os !== "android") return null;
  if (ent?.store === "PLAY_STORE") return "google";
  return maxProfiles > 1 ? "elsewhere" : null;
}

// ── Depois de pagar ─────────────────────────────────────────────────────────

/**
 * O que dizer depois de uma compra (ou restauro) com o direito já ativo no
 * aparelho. onServer = o webhook já escreveu a linha em `entitlements`.
 *   active         -> "✓ Plano ativo!" (no iOS sempre, como dantes)
 *   pending_server -> Android, a BD ainda não confirmou: o plano já funciona
 *                     neste aparelho (ponte do RevenueCat) e os perfis novos
 *                     sobem quando a linha chegar
 *   sandbox        -> Android, compra de teste (testador de licenças) na app de
 *                     produção: o evento vai para o webhook de TESTE e a BD de
 *                     produção nunca o recebe — o plano fica só neste aparelho
 */
export type PurchaseOutcome = "active" | "pending_server" | "sandbox";
export function purchaseOutcome(os: Os, onServer: boolean, sandbox: boolean): PurchaseOutcome {
  if (os !== "android" || onServer) return "active";
  return sandbox ? "sandbox" : "pending_server";
}

/**
 * Erro da compra/restauro -> mensagem. Códigos do RevenueCat
 * (Purchases.PURCHASES_ERROR_CODE, em texto). No iOS fica a mensagem genérica
 * de sempre; no Android os pagamentos pendentes são comuns, e ler "erro" levava
 * a tentar pagar outra vez.
 */
export type PurchaseErrorKind = "pending" | "already_owned" | "in_use" | "generic";
export function purchaseErrorKind(os: Os, code?: string | null): PurchaseErrorKind {
  if (os !== "android") return "generic";
  switch (String(code ?? "")) {
    case "20": // PAYMENT_PENDING_ERROR
      return "pending";
    case "6": // PRODUCT_ALREADY_PURCHASED_ERROR
      return "already_owned";
    case "7": // RECEIPT_ALREADY_IN_USE_ERROR
    case "13": // RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR
      return "in_use";
    default:
      return "generic";
  }
}

/** Tolerância para uma renovação a caminho: a linha diz ativa, mas o
 *  expires_at acabou de passar porque o webhook da renovação ainda não chegou. */
export const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Já tem o plano — ou uma renovação a caminho? Então o paywall do Android não
 * vende outra vez: nem a Google nem o RevenueCat impedem uma subscrição da
 * Play por cima de uma da App Store ou da Stripe, e isso era cobrar duas vezes.
 */
export function hasPlanOrRenewal(
  maxProfiles: number,
  row: EntitlementRow | null,
  now = Date.now()
): boolean {
  if (maxProfiles > 1) return true;
  if (!row || row.active === false || !(Number(row.max_profiles) > 1)) return false;
  if (!row.expires_at) return true; // sem expiração: o plano é dele
  const exp = Date.parse(String(row.expires_at));
  return Number.isFinite(exp) && now - exp < RENEWAL_GRACE_MS;
}

/**
 * Aviso do ecrã de Perfis quando o servidor recusou um perfil (acima do plano).
 *   subscribe      -> o aviso de sempre ("Subscreve para o guardar")
 *   pending_server -> Android, já pagou: a BD ainda não confirmou; sobe sozinho
 *   sandbox        -> Android, compra de teste: o perfil fica só neste aparelho
 * A quem já pagou, o aviso de sempre mandava subscrever outra vez — e voltava a
 * cada sincronização. Os dois novos mostram-se uma vez por sessão (quem chama).
 */
export type RejectedNotice = "subscribe" | "pending_server" | "sandbox";
export function rejectedProfileNotice(os: Os, ent: RcEntitlement | null): RejectedNotice {
  if (os !== "android" || !ent) return "subscribe";
  return ent.sandbox ? "sandbox" : "pending_server";
}
