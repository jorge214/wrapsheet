// app/settings/plan.tsx
import { router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function PlanScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const s = React.useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={s.backLink}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
        </Pressable>
        <Text style={s.headerTitle}>
          {t("plan_title", { defaultValue: "Plano atual" })}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Plano atual */}
        <View style={s.card}>
          <Text style={s.badge}>
            {t("plan_current", { defaultValue: "Plano atual" }).toUpperCase()}
          </Text>
          <Text style={s.cardTitle}>
            {t("plan_free_name", { defaultValue: "Grátis durante o lançamento" })}
          </Text>
          <Text style={s.priceText}>
            {t("plan_free_price", { defaultValue: "0 €" })}
          </Text>
          <Text style={s.cardSub}>
            {t("plan_free_desc", { defaultValue: "Começa já, sem limites." })}
          </Text>

          <View style={s.bulletList}>
            <Bullet text={t("plan_free_item1", { defaultValue: "Projetos ilimitados" })} />
            <Bullet text={t("plan_free_item2", { defaultValue: "Exports de PDF ilimitados" })} />
            <Bullet text={t("plan_free_item3", { defaultValue: "Backups locais e sincronização entre dispositivos" })} />
            <Bullet text={t("plan_free_item4", { defaultValue: "1 perfil de técnico" })} />
          </View>

          <Text style={s.highlight}>
            {t("plan_free_note", {
              defaultValue:
                "Quando houver alterações ao modelo de preços, serás informado antes de qualquer mudança.",
            })}
          </Text>
        </View>

        {/* Futuro plano Pro (placeholder informativo) */}
        <View style={s.cardMuted}>
          <Text style={s.badgeMuted}>
            {t("plan_future", { defaultValue: "Em desenvolvimento" }).toUpperCase()}
          </Text>
          <Text style={s.cardTitle}>
            {t("plan_pro_name", { defaultValue: "Plano Pro (futuro)" })}
          </Text>
          <Text style={s.cardSub}>
            {t("plan_pro_desc", {
              defaultValue: "Funcionalidades adicionais em preparação.",
            })}
          </Text>

          <View style={s.bulletList}>
            <Bullet muted text={t("plan_pro_item1", { defaultValue: "Vários perfis" })} />
            <Bullet muted text={t("plan_pro_item2", { defaultValue: "Todos os regimes fiscais" })} />
            <Bullet muted text={t("plan_pro_item3", { defaultValue: "Arquivo de projetos" })} />
            <Bullet muted text={t("plan_pro_item4", { defaultValue: "Relatórios agregados por produção" })} />
          </View>

          <Text style={s.mutedInfo}>
            {t("plan_pro_note", {
              defaultValue:
                "Esta secção é apenas informativa. Não há subscrição ativa nem pagamentos dentro da aplicação.",
            })}
          </Text>
        </View>
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
    cardMuted: {
      backgroundColor: COLORS.bg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
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
    badgeMuted: {
      alignSelf: "flex-start",
      fontSize: 11,
      fontWeight: "700",
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
    mutedInfo: {
      marginTop: 8,
      fontSize: 12,
      color: COLORS.sub,
      fontStyle: "italic",
    },
  });
