// app/settings/plan.tsx
// Ecrã do plano. Antes era informativo ("não há pagamentos"); com o multi-perfil
// passou a haver subscrição, e um ecrã a dizer o contrário do paywall é motivo
// de rejeição na revisão da Apple. Agora mostra o direito REAL do utilizador
// (getMaxProfiles) e, a quem não o tem, o plano Equipa com o preço vindo da loja.
import { router, useFocusEffect } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import { getMaxProfiles, UNLOCKED_MAX_PROFILES } from "../../src/lib/entitlements";
import {
  configurePurchases,
  getPlanPackages,
  isPurchasesAvailable,
  type PlanPkg,
} from "../../src/lib/purchases";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function PlanScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const s = React.useMemo(() => createStyles(COLORS), [COLORS]);

  const [maxProfiles, setMaxProfiles] = React.useState(1);
  const [pkgs, setPkgs] = React.useState<PlanPkg[]>([]);

  // Recarrega ao voltar (ex.: acabou de subscrever no paywall)
  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      (async () => {
        const max = await getMaxProfiles(user as any);
        if (alive) setMaxProfiles(max);
        if (isPurchasesAvailable() && user?.id) {
          await configurePurchases(user.id);
          const p = await getPlanPackages();
          if (alive) setPkgs(p);
        }
      })();
      return () => {
        alive = false;
      };
    }, [user?.id])
  );

  const hasTeam = maxProfiles > 1;

  // Preço real da loja (localizado). Sem SDK/loja, não inventamos valores: o
  // cartão mostra só o que o plano dá e o paywall trata do preço.
  const monthly = pkgs.find((p) => p.periodMonths === 1)?.priceString;
  const yearly = pkgs.find((p) => p.periodMonths === 12)?.priceString;
  const priceLine = [
    monthly && `${monthly} ${t("paywall_per_month_short", { defaultValue: "/mês" })}`,
    yearly && `${yearly} ${t("paywall_per_year_short", { defaultValue: "/ano" })}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={s.backLink}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
        </Pressable>
        <Text style={s.headerTitle}>{t("plan_title", { defaultValue: "Plano atual" })}</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* ── Plano atual ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.badge}>{t("plan_current", { defaultValue: "Plano atual" }).toUpperCase()}</Text>

          {hasTeam ? (
            <>
              <Text style={s.cardTitle}>{t("plan_team_name", { defaultValue: "Equipa" })}</Text>
              <Text style={s.cardSub}>
                {t("plan_team_active_desc", {
                  n: Math.min(maxProfiles, UNLOCKED_MAX_PROFILES),
                  defaultValue: "Podes ter até {{n}} perfis nesta conta.",
                })}
              </Text>
              <View style={s.bulletList}>
                <Bullet text={t("paywall_b1", { defaultValue: "Até 10 perfis numa só conta" })} />
                <Bullet text={t("paywall_b3", { defaultValue: "Duplica a mesma folha para toda a equipa, só mudam as tarifas" })} />
                <Bullet text={t("plan_free_item1", { defaultValue: "Projetos ilimitados" })} />
                <Bullet text={t("plan_free_item2", { defaultValue: "Exports de PDF ilimitados" })} />
              </View>
              <Text style={s.highlight}>
                {t("plan_manage_note", {
                  defaultValue: "Gere ou cancela a subscrição nas Definições da App Store.",
                })}
              </Text>
            </>
          ) : (
            <>
              <Text style={s.cardTitle}>{t("plan_free_name", { defaultValue: "Grátis" })}</Text>
              <Text style={s.priceText}>{t("plan_free_price", { defaultValue: "0 €" })}</Text>
              <Text style={s.cardSub}>
                {t("plan_free_desc", { defaultValue: "Para quem faz as folhas só para si." })}
              </Text>
              <View style={s.bulletList}>
                <Bullet text={t("plan_free_item1", { defaultValue: "Projetos ilimitados" })} />
                <Bullet text={t("plan_free_item2", { defaultValue: "Exports de PDF ilimitados" })} />
                <Bullet text={t("plan_free_item3", { defaultValue: "Backups locais e sincronização entre dispositivos" })} />
                <Bullet text={t("plan_free_item4", { defaultValue: "1 perfil de técnico" })} />
              </View>
            </>
          )}
        </View>

        {/* ── Plano Equipa (só a quem ainda não o tem) ─────────────────── */}
        {!hasTeam && (
          <View style={s.card}>
            <Text style={s.badge}>{t("plan_upgrade", { defaultValue: "Fazer upgrade" }).toUpperCase()}</Text>
            <Text style={s.cardTitle}>{t("plan_team_name", { defaultValue: "Equipa" })}</Text>
            {!!priceLine && <Text style={s.priceText}>{priceLine}</Text>}
            <Text style={s.cardSub}>
              {t("plan_team_desc", {
                defaultValue: "Para quem faz folhas para mais do que uma pessoa.",
              })}
            </Text>

            <View style={s.bulletList}>
              <Bullet text={t("paywall_b1", { defaultValue: "Até 10 perfis numa só conta" })} />
              <Bullet text={t("paywall_b2", { defaultValue: "Uma folha por técnico — o dinheiro de cada um não se mistura" })} />
              <Bullet text={t("paywall_b3", { defaultValue: "Duplica a mesma folha para toda a equipa, só mudam as tarifas" })} />
              <Bullet text={t("paywall_b4", { defaultValue: "Sincroniza no iPhone, iPad e computador" })} />
            </View>

            <Pressable
              style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push("/profiles/unlock")}
            >
              <Text style={s.ctaText}>{t("plan_team_cta", { defaultValue: "Ver planos" })}</Text>
            </Pressable>

            <Text style={s.mutedInfo}>
              {t("paywall_legal", {
                defaultValue:
                  "Subscrição que renova automaticamente. Cancela quando quiseres nas Definições da App Store.",
              })}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ text, muted }: { text: string; muted?: boolean }) {
  const { COLORS } = useTheme();
  const s = React.useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <View style={s.bulletRow}>
      <Text style={[s.bulletDot, muted && { opacity: 0.5 }]}>•</Text>
      <Text style={[s.bulletText, muted && { color: COLORS.sub }]}>{text}</Text>
    </View>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
    },
    backLink: {
      color: COLORS.text,
      fontWeight: "800",
      fontSize: 15,
      width: 70,
      opacity: 0.9,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: COLORS.text,
      textAlign: "center",
    },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 16,
      width: "100%",
      maxWidth: 560,
      alignSelf: "center",
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      shadowColor: COLORS.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 4,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: COLORS.text,
      marginBottom: 4,
    },
    cardSub: {
      fontSize: 13,
      color: COLORS.sub,
      marginBottom: 10,
    },
    // Identidade preto/cinza — nada de azul neste ecrã
    priceText: {
      fontSize: 16,
      fontWeight: "800",
      color: COLORS.text,
      marginBottom: 6,
    },
    badge: {
      alignSelf: "flex-start",
      fontSize: 11,
      fontWeight: "800",
      color: COLORS.sub,
      marginBottom: 4,
    },
    bulletList: {
      marginTop: 6,
      marginBottom: 10,
      gap: 4,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
    },
    bulletDot: {
      color: COLORS.text,
      fontSize: 14,
      lineHeight: 18,
    },
    bulletText: {
      flex: 1,
      fontSize: 13,
      color: COLORS.text,
      lineHeight: 18,
    },
    highlight: {
      marginTop: 4,
      fontSize: 12,
      color: COLORS.sub,
    },
    cta: {
      backgroundColor: COLORS.text,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    ctaText: { color: COLORS.card, fontWeight: "900", fontSize: 15 },
    mutedInfo: {
      marginTop: 10,
      fontSize: 11.5,
      color: COLORS.sub,
      textAlign: "center",
      lineHeight: 16,
    },
  });
