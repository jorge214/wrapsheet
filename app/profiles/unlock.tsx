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
import { waitForServerEntitlement } from "../../src/lib/entitlements";
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

// Paywall dos perfis de equipa: até 10 perfis. No iOS (build EAS) compra via
// IAP/RevenueCat (mensal ou anual, à escolha); noutras plataformas encaminha
// para a app iOS. Ambos os planos dão o mesmo entitlement (profiles_10).
export default function ProfilePaywallScreen() {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const s = styles(COLORS, mode);

  const canBuy = isPurchasesAvailable();
  const [packages, setPackages] = useState<PlanPkg[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingPkgs, setLoadingPkgs] = useState(false);
  const [busy, setBusy] = useState<null | "buy" | "restore">(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadPackages = useCallback(async () => {
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
  }, [canBuy, user?.id]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const bullets: string[] = [
    t("paywall_b1", { defaultValue: "Até 10 perfis numa só conta" }),
    t("paywall_b2", { defaultValue: "Uma folha por técnico — o dinheiro de cada um não se mistura" }),
    t("paywall_b3", { defaultValue: "Duplica a mesma folha para toda a equipa, só mudam as tarifas" }),
    t("paywall_b4", { defaultValue: "Sincroniza no iPhone, iPad e computador" }),
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

  async function onBuy() {
    if (!selectedId) return;
    setBusy("buy");
    setMsg(null);
    const r = await buyPackageById(selectedId);
    setBusy(null);
    if (r.ok) {
      // A compra passou, mas o direito só é utilizável quando o webhook do
      // RevenueCat escrever na BD — é o que o trigger do servidor verifica.
      // Esperar aqui evita criar perfis nesse intervalo, que ficariam presos
      // no dispositivo sem nunca sincronizar.
      setMsg(t("paywall_activating", { defaultValue: "A ativar o plano…" }));
      if (user?.id) await waitForServerEntitlement(user.id);
      setMsg(t("paywall_active", { defaultValue: "✓ Plano ativo! Já podes criar mais perfis." }));
      setTimeout(() => router.back(), 1400);
    } else if (r.cancelled) {
      // silêncio: o utilizador cancelou
    } else {
      setMsg(t("paywall_error", { defaultValue: "Não foi possível concluir a compra. Tenta novamente." }));
    }
  }

  async function onRestore() {
    setBusy("restore");
    setMsg(null);
    const r = await restorePurchases();
    // Tal como na compra: o direito só serve depois de chegar à BD.
    if (r.ok && user?.id) await waitForServerEntitlement(user.id);
    setBusy(null);
    setMsg(
      r.ok
        ? t("paywall_restored", { defaultValue: "✓ Compra restaurada." })
        : t("paywall_nothing_restore", { defaultValue: "Não encontrámos nenhuma compra para restaurar." })
    );
    if (r.ok) setTimeout(() => router.back(), 1400);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={s.backLink}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
        </Pressable>
        <Text style={s.headerTitle}>{t("profiles_title", { defaultValue: "Perfis" })}</Text>
        <View style={{ width: 70 }} />
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

        {canBuy ? (
          <View style={s.section}>
            {loadingPkgs ? (
              <ActivityIndicator color={COLORS.text} style={{ paddingVertical: 20 }} />
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
                <Pressable onPress={onRestore} disabled={!!busy} style={{ marginTop: 12, alignSelf: "center", padding: 6 }}>
                  <Text style={s.restore}>
                    {busy === "restore"
                      ? t("paywall_restoring", { defaultValue: "A restaurar…" })
                      : t("paywall_restore", { defaultValue: "Restaurar compra" })}
                  </Text>
                </Pressable>
                <Text style={s.legal}>
                  {t("paywall_legal", {
                    defaultValue:
                      "Subscrição que renova automaticamente. Cancela quando quiseres nas Definições da App Store.",
                  })}
                </Text>
              </>
            )}
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
    backLink: { color: COLORS.text, fontSize: 15, fontWeight: "800", width: 70, opacity: 0.9 },
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
