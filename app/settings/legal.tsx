// app/settings/legal.tsx
import { router } from "expo-router";
import React from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeProvider";

const PRIVACY_URL = "https://wrapsheet-app.com/privacy";
const TERMS_URL = "https://wrapsheet-app.com/terms";
const IS_WEB = Platform.OS === "web";

// Documentos legais são páginas web normais (https), por isso abrir num separador
// funciona em qualquer lado (PC e nativo).
function openUrl(url: string) {
  if (IS_WEB && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
    return;
  }
  Linking.openURL(url).catch(() => {});
}

export default function LegalScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const s = React.useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={s.backLink}>‹ {t("back")}</Text>
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {t("legal_title_short", { defaultValue: "Termos e Privacidade" })}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={s.card}>
        <Text style={s.intro}>
          {t("legal_intro", {
            defaultValue: "Consulta os documentos legais da WrapSheet. Abrem no browser.",
          })}
        </Text>

        <Pressable onPress={() => openUrl(PRIVACY_URL)} style={s.linkRow}>
          <Text style={s.linkTitle}>
            {t("legal_privacy_title", { defaultValue: "Política de Privacidade" })}
          </Text>
          <Text style={s.linkUrl}>wrapsheet-app.com/privacy</Text>
        </Pressable>

        <Pressable onPress={() => openUrl(TERMS_URL)} style={s.linkRow}>
          <Text style={s.linkTitle}>
            {t("legal_terms_title", { defaultValue: "Termos de Utilização" })}
          </Text>
          <Text style={s.linkUrl}>wrapsheet-app.com/terms</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
      flex: 1,
      fontSize: 22,
      fontWeight: "800",
      color: COLORS.text,
      textAlign: "center",
      paddingHorizontal: 6,
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
      marginHorizontal: 16,
      marginTop: 16,
    },
    intro: {
      fontSize: 14,
      color: COLORS.sub,
      marginBottom: 6,
    },
    linkRow: {
      paddingVertical: 14,
      borderTopWidth: 1,
      borderColor: COLORS.border,
      marginTop: 8,
    },
    linkTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: COLORS.text,
    },
    linkUrl: {
      fontSize: 13,
      color: COLORS.sub,
      marginTop: 2,
      textDecorationLine: "underline",
    },
  });
