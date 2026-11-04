import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/auth/AuthContext";
import { getMaxProfiles, readServerEntitlement, waitForServerEntitlement } from "../../src/lib/entitlements";
import {
  hasPlanOrRenewal,
  isPlayBilling,
  paywallLegal,
  purchaseErrorKind,
  purchaseOutcome,
  syncBullet,
  type PurchaseErrorKind,
  type PurchaseOutcome,
} from "../../src/lib/storeRules";
import { isWebCheckoutAvailable, startWebCheckout, type WebPlan } from "../../src/lib/webCheckout";
import { useTheme } from "../../src/theme/ThemeProvider";
import {
  buyPackageById,
  configurePurchases,
  getPlanPackages,
  isPurchasesAvailable,
  restorePurchases,
  type PlanPkg,
} from "../../src/lib/purchases";

const APP_STORE_URL = "https://apps.apple.com/pt/app/id6774636607";
const SITE = "https://wrapsheet-app.com";

// A Apple exige (Guideline 3.1.2) que o ecrã de compra tenha links funcionais
// para os Termos de Utilização e a Política de Privacidade. É das causas mais
// comuns de rejeição de subscrições.
function openLegal(path: string) {
  const url = SITE + path;
  if (Platform.OS === "web") (window as any).open(url, "_blank", "noopener");
  else Linking.openURL(url).catch(() => {});
}

// Paywall dos perfis de equipa: até 10 perfis. Nas apps (build EAS) compra pela
// loja do aparelho via RevenueCat — IAP da Apple no iOS, Google Play no Android
// (só com a chave `goog_…`) —, mensal ou anual, à escolha; na web pela Stripe.
// Ambos os planos dão o mesmo entitlement (profiles_10).
export default function ProfilePaywallScreen() {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const s = styles(COLORS, mode);

  // Formas de comprar, mutuamente exclusivas:
  //   • iOS     -> IAP da Apple (obrigatório dentro da app; ver purchases.ts)
  //   • Android -> faturação do Google Play (idem), só com a chave `goog_…`
  //   • web     -> Stripe (nenhuma das lojas deixa vender fora da app)
  // Todas acabam na mesma tabela `entitlements`, por isso o resto da app não
  // precisa de saber por onde foi pago. O que muda de loja para loja está em
  // storeRules.ts; o iOS e a web seguem exatamente como dantes.
  const canBuy = isPurchasesAvailable();
  const webBuy = !canBuy && isWebCheckoutAvailable();
  const play = isPlayBilling(Platform.OS, canBuy);
  const legal = paywallLegal(Platform.OS, canBuy);
  // Android: já tem o plano (ou uma renovação a caminho)? Então não se vende
  // outra vez — uma subscrição da Play por cima de uma da App Store ou da
  // Stripe era cobrar duas vezes. null = ainda a verificar.
  const [hasPlan, setHasPlan] = useState<boolean | null>(play ? null : false);
  // Android: depois de pagar, a parte de comprar some — tocar no outro plano
  // durante a espera pelo servidor comprava uma 2.ª subscrição.
  const [done, setDone] = useState(false);
  const [packages, setPackages] = useState<PlanPkg[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingPkgs, setLoadingPkgs] = useState(false);
  const [busy, setBusy] = useState<null | "buy" | "restore">(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadPackages = useCallback(async () => {
    // Na web os preços são os do Stripe, definidos por nós em euros — não há
    // loja a consultar, por isso descrevem-se aqui.
    if (webBuy) {
      const pk: PlanPkg[] = [
        { id: "monthly", type: "MONTHLY", priceString: "9,99 €", price: 9.99, currencyCode: "EUR", periodMonths: 1 },
        { id: "yearly", type: "ANNUAL", priceString: "99,99 €", price: 99.99, currencyCode: "EUR", periodMonths: 12 },
      ];
      setPackages(pk);
      setSelectedId("yearly");
      return;
    }
    if (!canBuy || !user?.id) return;
    setLoadingPkgs(true);
    await configurePurchases(user.id);
    const pk = await getPlanPackages();
    pk.sort((a, b) => a.periodMonths - b.periodMonths); // Mensal primeiro, Anual depois
    setPackages(pk);
    // Pré-seleciona o de maior período (melhor valor)
    const best = pk.reduce<PlanPkg | null>((m, p) => (p.periodMonths > (m?.periodMonths ?? 0) ? p : m), null);
    setSelectedId(best?.id ?? pk[0]?.id ?? null);
    setLoadingPkgs(false);
  }, [canBuy, webBuy, user?.id]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    if (!play) return;
    if (!user?.id) {
      setHasPlan(false);
      return;
    }
    let alive = true;
    (async () => {
      await configurePurchases(user.id);
      const [max, row] = await Promise.all([getMaxProfiles(user as any), readServerEntitlement(user.id)]);
      if (alive) setHasPlan(hasPlanOrRenewal(max, row));
    })();
    return () => {
      alive = false;
    };
  }, [play, user?.id]);

  const bullets: string[] = [
    t("paywall_b1", { defaultValue: "Até 10 perfis numa só conta" }),
    t("paywall_b2", { defaultValue: "Uma folha por técnico — o dinheiro de cada um não se mistura" }),
    t("paywall_b3", { defaultValue: "Duplica a mesma folha para toda a equipa, só mudam as tarifas" }),
    syncBullet(Platform.OS) === "android"
      ? t("paywall_b4_android", { defaultValue: "Sincroniza no telemóvel, tablet e computador" })
      : t("paywall_b4", { defaultValue: "Sincroniza no iPhone, iPad e computador" }),
  ];

  const monthly = packages.find((p) => p.periodMonths === 1);
  const bestId = packages.reduce<PlanPkg | null>((m, p) => (p.periodMonths > (m?.periodMonths ?? 0) ? p : m), null)?.id;

  function planLabel(p: PlanPkg): string {
    if (p.type === "ANNUAL") return t("paywall_plan_yearly", { defaultValue: "Anual" });
    if (p.type === "MONTHLY") return t("paywall_plan_monthly", { defaultValue: "Mensal" });
    return p.priceString;
  }
  function periodSuffix(p: PlanPkg): string {
    if (p.periodMonths === 12) return t("paywall_per_year_short", { defaultValue: "/ano" });
    if (p.periodMonths === 1) return t("paywall_per_month_short", { defaultValue: "/mês" });
    return "";
  }
  function savingsPct(p: PlanPkg): number {
    if (!monthly || monthly.price <= 0 || p.periodMonths <= 1) return 0;
    const perMonth = p.price / p.periodMonths;
    return Math.round((1 - perMonth / monthly.price) * 100);
  }
  function perMonthStr(p: PlanPkg): string | null {
    if (p.periodMonths <= 1 || p.price <= 0) return null;
    const perMonth = p.price / p.periodMonths;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: p.currencyCode }).format(perMonth);
    } catch {
      return `${perMonth.toFixed(2)} ${p.currencyCode}`;
    }
  }

  // Google Play: preço e período do plano escolhido, renovação automática e
  // onde se cancela — à vista, por baixo do botão.
  function playLegalText(): string {
    const sel = packages.find((p) => p.id === selectedId);
    if (!sel) {
      return t("plan_legal_android", {
        defaultValue:
          "Subscrição com renovação automática, cobrada na tua conta do Google Play até a cancelares. Cancela quando quiseres na app Play Store, em Pagamentos e subscrições › Subscrições.",
      });
    }
    return t("paywall_legal_android", {
      price: `${sel.priceString}${periodSuffix(sel)}`,
      defaultValue:
        "Subscrição com renovação automática: {{price}}, cobrada na tua conta do Google Play até a cancelares. Cancela quando quiseres na app Play Store, em Pagamentos e subscrições › Subscrições.",
    });
  }

  // Depois de pagar/restaurar, com o direito já ativo no aparelho
  function outcomeMsg(o: PurchaseOutcome, restored: boolean): string {
    if (o === "sandbox") {
      return t("paywall_active_sandbox", {
        defaultValue:
          "✓ Compra de teste: o plano fica ativo só neste dispositivo. As compras de teste não chegam à tua conta, por isso os perfis novos não sincronizam.",
      });
    }
    if (o === "pending_server") {
      return t("paywall_active_pending", {
        defaultValue:
          "✓ Plano ativo neste dispositivo. A confirmação na tua conta está a demorar: os perfis novos sincronizam assim que chegar.",
      });
    }
    return restored
      ? t("paywall_restored", { defaultValue: "✓ Compra restaurada." })
      : t("paywall_active", { defaultValue: "✓ Plano ativo! Já podes criar mais perfis." });
  }

  function errorMsg(k: PurchaseErrorKind, restoring: boolean): string {
    if (k === "pending") {
      return t("paywall_payment_pending", {
        defaultValue: "Pagamento pendente. O plano ativa-se sozinho assim que o Google Play confirmar o pagamento.",
      });
    }
    if (k === "already_owned") {
      return t("paywall_already_owned", {
        defaultValue: "Esta conta Google já tem a subscrição. Toca em «Restaurar compra» para a recuperar.",
      });
    }
    if (k === "in_use") {
      return t("paywall_in_use_other_account", {
        defaultValue:
          "Esta subscrição do Google Play está associada a outra conta WrapSheet. Entra com essa conta para a usares.",
      });
    }
    return restoring
      ? t("paywall_nothing_restore", { defaultValue: "Não encontrámos nenhuma compra para restaurar." })
      : t("paywall_error", { defaultValue: "Não foi possível concluir a compra. Tenta novamente." });
  }

  async function onBuy() {
    if (!selectedId) return;

    // Web: sai da app para o pagamento do Stripe e volta pelo success_url.
    if (webBuy) {
      setBusy("buy");
      setMsg(null);
      const err = await startWebCheckout(selectedId as WebPlan);
      if (err) {
        setBusy(null);
        setMsg(t("paywall_error", { defaultValue: "Não foi possível concluir a compra. Tenta novamente." }));
      }
      return; // se correu bem, a página está a ser redirecionada
    }

    setBusy("buy");
    setMsg(null);
    const r = await buyPackageById(selectedId);
    // iOS: o botão volta logo, como sempre. Android: fica ocupado até ao fim.
    if (!play) setBusy(null);
    if (r.ok) {
      if (play) setDone(true);
      // A compra passou, mas o direito só é utilizável quando o webhook do
      // RevenueCat escrever na BD — é o que o trigger do servidor verifica.
      // Esperar aqui evita criar perfis nesse intervalo, que ficariam presos
      // no dispositivo sem nunca sincronizar.
      setMsg(t("paywall_activating", { defaultValue: "A ativar o plano…" }));
      const onServer = user?.id ? await waitForServerEntitlement(user.id) : false;
      setBusy(null);
      // Android: se a BD não confirmou (webhook atrasado, ou compra de teste
      // que nunca lá chega) diz-se a verdade — o plano já funciona neste
      // aparelho na mesma (ponte do RevenueCat), e fica-se aqui a ler.
      const o = purchaseOutcome(Platform.OS, onServer, !!r.sandbox);
      setMsg(outcomeMsg(o, false));
      if (o === "active") setTimeout(() => router.back(), 1400);
    } else {
      setBusy(null);
      if (r.cancelled) return; // silêncio: o utilizador cancelou
      const k = purchaseErrorKind(Platform.OS, r.code);
      // Pagamento pendente: a Google ainda o pode cobrar — não se vende outra vez
      if (k === "pending") setDone(true);
      setMsg(errorMsg(k, false));
    }
  }

  async function onRestore() {
    setBusy("restore");
    setMsg(null);
    const r = await restorePurchases();
    // Tal como na compra: o direito só serve depois de chegar à BD.
    const onServer = r.ok && user?.id ? await waitForServerEntitlement(user.id) : false;
    setBusy(null);
    if (!r.ok) {
      setMsg(errorMsg(purchaseErrorKind(Platform.OS, r.code), true));
      return;
    }
    if (play) setDone(true);
    const o = purchaseOutcome(Platform.OS, onServer, !!r.sandbox);
    setMsg(outcomeMsg(o, true));
    if (o === "active") setTimeout(() => router.back(), 1400);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={s.backLink} numberOfLines={1}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
        </Pressable>
        <Text style={[s.headerTitle, { flexShrink: 1, textAlign: "center" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t("profiles_title", { defaultValue: "Perfis" })}</Text>
        <View style={{ width: 84 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.section}>
          <View style={s.icon}>
            <Ionicons name="people" size={30} color={COLORS.text} />
          </View>
          <Text style={s.title}>{t("paywall_title", { defaultValue: "Folhas para toda a equipa" })}</Text>
          <Text style={s.body}>
            {t("paywall_subtitle", {
              defaultValue: "A app é gratuita para 1 perfil. Para gerires uma equipa, desbloqueia até 10 perfis.",
            })}
          </Text>

          <View style={{ marginTop: 14, gap: 10 }}>
            {bullets.map((b, i) => (
              <View key={i} style={s.bulletRow}>
                <Ionicons name="checkmark-circle" size={19} color={COLORS.text} />
                <Text style={s.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {(canBuy || webBuy) ? (
          <View style={s.section}>
            {loadingPkgs || hasPlan === null ? (
              <ActivityIndicator color={COLORS.text} style={{ paddingVertical: 20 }} />
            ) : hasPlan ? (
              <Text style={s.body}>
                {t("paywall_already_team", {
                  defaultValue: "Já tens o plano Equipa nesta conta. Gere a subscrição em Definições › Subscrição.",
                })}
              </Text>
            ) : done ? (
              <>
                {!!busy && <ActivityIndicator color={COLORS.text} style={{ paddingTop: 6 }} />}
                {msg && <Text style={s.msg}>{msg}</Text>}
              </>
            ) : packages.length === 0 ? (
              <>
                <Text style={s.body}>
                  {t("paywall_load_error", {
                    defaultValue: "Não foi possível carregar os planos. Verifica a ligação e tenta de novo.",
                  })}
                </Text>
                <Pressable style={({ pressed }) => [s.btnOutline, pressed && { opacity: 0.85 }]} onPress={loadPackages}>
                  <Text style={s.btnOutlineText}>{t("retry", { defaultValue: "Tentar de novo" })}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={{ gap: 10 }}>
                  {packages.map((p) => {
                    const sel = p.id === selectedId;
                    const pct = savingsPct(p);
                    const pm = perMonthStr(p);
                    const isBest = p.id === bestId && packages.length > 1;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setSelectedId(p.id)}
                        style={[s.plan, sel && s.planSel]}
                      >
                        <View style={s.radio}>{sel && <View style={s.radioDot} />}</View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <Text style={s.planLabel}>{planLabel(p)}</Text>
                            {isBest && (
                              <View style={s.badge}>
                                <Text style={s.badgeText}>{t("paywall_best_value", { defaultValue: "Melhor valor" })}</Text>
                              </View>
                            )}
                            {pct > 0 && (
                              <View style={s.badgeSave}>
                                <Text style={s.badgeSaveText}>
                                  {t("paywall_save_pct", { pct, defaultValue: "Poupa {{pct}}%" })}
                                </Text>
                              </View>
                            )}
                          </View>
                          {pm && (
                            <Text style={s.planSub}>
                              {t("paywall_month_equiv", { price: pm, defaultValue: "≈ {{price}}/mês" })}
                            </Text>
                          )}
                        </View>
                        <Text style={s.planPrice}>
                          {p.priceString}
                          <Text style={s.planPeriod}>{periodSuffix(p)}</Text>
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {msg && <Text style={s.msg}>{msg}</Text>}
                <Pressable
                  style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
                  onPress={onBuy}
                  disabled={!!busy || !selectedId}
                >
                  {busy === "buy" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.btnText}>{t("paywall_cta", { defaultValue: "Subscrever" })}</Text>
                  )}
                </Pressable>
                {/* Restaurar é próprio das lojas: recupera uma compra feita
                    noutro dispositivo com o mesmo Apple ID ou conta Google. No
                    Stripe não existe nem faz falta — o direito está preso à conta. */}
                {canBuy && (
                  <Pressable onPress={onRestore} disabled={!!busy} style={{ marginTop: 12, alignSelf: "center", padding: 6 }}>
                    <Text style={s.restore}>
                      {busy === "restore"
                        ? t("paywall_restoring", { defaultValue: "A restaurar…" })
                        : t("paywall_restore", { defaultValue: "Restaurar compra" })}
                    </Text>
                  </Pressable>
                )}
                <Text style={s.legal}>
                  {legal === "google"
                    ? playLegalText()
                    : legal === "apple"
                    ? t("paywall_legal", {
                        defaultValue:
                          "Subscrição que renova automaticamente. Cancela quando quiseres nas Definições da App Store.",
                      })
                    : t("paywall_legal_web", {
                        defaultValue:
                          "Subscrição que renova automaticamente. Cancela quando quiseres — o pagamento é processado em segurança pela Stripe.",
                      })}
                </Text>
              </>
            )}
          </View>
        ) : Platform.OS === "android" ? (
          // Android: ainda sem faturação do Google Play. Mensagem honesta e SEM
          // link para pagar fora — mandar o utilizador pagar noutro sítio a
          // partir de dentro da app é terreno minado nas regras da Play Store.
          // Mandá-lo para a App Store, como fazíamos aqui, era pior ainda.
          <View style={s.section}>
            <Text style={s.body}>
              {t("paywall_android_soon", {
                defaultValue:
                  "A subscrição de equipa ainda não está disponível no Android. Continuas com um perfil, e avisamos-te assim que abrir.",
              })}
            </Text>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.body}>
              {t("paywall_ios_only", {
                defaultValue: "A subscrição de equipa está disponível na app para iPhone e iPad.",
              })}
            </Text>
            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
              onPress={() =>
                Platform.OS === "web"
                  ? (window as any).open(APP_STORE_URL, "_blank")
                  : Linking.openURL(APP_STORE_URL).catch(() => {})
              }
            >
              <Text style={s.btnText}>{t("install_ios_cta", { defaultValue: "Descarregar na App Store" })}</Text>
            </Pressable>
          </View>
        )}

        {/* Termos + Privacidade — exigidos pela Apple no ecrã de compra */}
        <View style={s.legalLinks}>
          <Pressable onPress={() => openLegal("/terms")} hitSlop={8}>
            <Text style={s.legalLink}>{t("auth_accept_terms", { defaultValue: "Termos" })}</Text>
          </Pressable>
          <Text style={s.legalSep}>·</Text>
          <Pressable onPress={() => openLegal("/privacy")} hitSlop={8}>
            <Text style={s.legalLink}>
              {t("auth_accept_privacy", { defaultValue: "Política de Privacidade" })}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
    },
    backLink: { color: COLORS.text, fontSize: 15, fontWeight: "800", width: 84, opacity: 0.9 },
    headerTitle: { fontSize: 22, fontWeight: "700", color: COLORS.text },
    scroll: { padding: 16, gap: 16, paddingBottom: 40, width: "100%", maxWidth: 560, alignSelf: "center" },
    section: {
      backgroundColor: COLORS.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
    },
    icon: {
      width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: COLORS.text,
      alignItems: "center", justifyContent: "center", marginBottom: 12,
    },
    title: { fontSize: 20, fontWeight: "900", color: COLORS.text, lineHeight: 26 },
    body: { fontSize: 14.5, color: COLORS.sub, lineHeight: 21, marginTop: 6 },
    bulletRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    bulletText: { flex: 1, fontSize: 14.5, color: COLORS.text, lineHeight: 20 },

    plan: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      borderRadius: 12,
      padding: 14,
    },
    planSel: { borderColor: COLORS.text, backgroundColor: mode === "dark" ? "#1c1f24" : "#F2F3F5" },
    radio: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.text,
      alignItems: "center", justifyContent: "center",
    },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.text },
    planLabel: { fontSize: 16, fontWeight: "800", color: COLORS.text },
    planSub: { fontSize: 12.5, color: COLORS.sub, marginTop: 3 },
    planPrice: { fontSize: 17, fontWeight: "900", color: COLORS.text },
    planPeriod: { fontSize: 12.5, fontWeight: "700", color: COLORS.sub },
    badge: { backgroundColor: COLORS.text, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    badgeText: { color: COLORS.card, fontSize: 10.5, fontWeight: "900" },
    badgeSave: { backgroundColor: mode === "dark" ? "#123d1f" : "#e3f7e8", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    badgeSaveText: { color: mode === "dark" ? "#5fd67f" : "#1a7f37", fontSize: 10.5, fontWeight: "900" },

    msg: { fontSize: 13.5, color: COLORS.text, textAlign: "center", marginTop: 14, fontWeight: "700" },
    btn: { backgroundColor: COLORS.text, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 16 },
    btnText: { color: COLORS.card, fontWeight: "900", fontSize: 16 },
    btnOutline: { borderWidth: 1.5, borderColor: COLORS.text, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 14 },
    btnOutlineText: { color: COLORS.text, fontWeight: "800", fontSize: 15 },
    restore: { color: COLORS.text, fontWeight: "800", fontSize: 13.5, textDecorationLine: "underline" },
    legal: { fontSize: 11.5, color: COLORS.sub, lineHeight: 16, marginTop: 14, textAlign: "center" },
    legalLinks: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, paddingVertical: 4 },
    legalLink: { fontSize: 12.5, color: COLORS.sub, fontWeight: "700", textDecorationLine: "underline" },
    legalSep: { fontSize: 12.5, color: COLORS.sub },
  });
