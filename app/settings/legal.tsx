// app/settings/legal.tsx
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeProvider";

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
        <Text style={s.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
          {t("settings_terms_privacy")}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Terms of Use */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("legal_terms_title")}</Text>
          <Text style={s.cardSub}>{t("legal_terms_sub")}</Text>

          <Text style={s.sectionTitle}>{t("legal_terms_1_title")}</Text>
          <Text style={s.paragraph}>{t("legal_terms_1_body")}</Text>

          <Text style={s.sectionTitle}>{t("legal_terms_2_title")}</Text>
          <Text style={s.paragraph}>{t("legal_terms_2_body")}</Text>

          <Text style={s.sectionTitle}>{t("legal_terms_3_title")}</Text>
          <Text style={s.paragraph}>{t("legal_terms_3_body")}</Text>
        </View>

        {/* Privacy Policy */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("legal_privacy_title")}</Text>
          <Text style={s.cardSub}>{t("legal_privacy_sub")}</Text>

          <Text style={s.sectionTitle}>{t("legal_privacy_1_title")}</Text>
          <Text style={s.paragraph}>{t("legal_privacy_1_body")}</Text>

          <Text style={s.sectionTitle}>{t("legal_privacy_2_title")}</Text>
          <Text style={s.paragraph}>{t("legal_privacy_2_body")}</Text>

          <Text style={s.sectionTitle}>{t("legal_privacy_3_title")}</Text>
          <Text style={s.paragraph}>{t("legal_privacy_3_body")}</Text>

          <Text style={s.sectionTitle}>{t("legal_privacy_4_title")}</Text>
          <Text style={s.paragraph}>{t("legal_privacy_4_body")}</Text>
        </View>

        <Text style={s.footerNote}>{t("legal_last_updated")}</Text>
      </ScrollView>
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
      // flex + encolher para caber: em ecrãs estreitos o título completo
      // ("Termos & Política de Privacidade") não cabe a tamanho fixo
      flex: 1,
      fontSize: 17,
      fontWeight: "800",
      color: COLORS.text,
      textAlign: "center",
      paddingHorizontal: 6,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 16,
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
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
    sectionTitle: {
      marginTop: 8,
      marginBottom: 4,
      fontSize: 14,
      fontWeight: "600",
      color: COLORS.text,
    },
    paragraph: {
      fontSize: 13,
      color: COLORS.sub,
      lineHeight: 18,
    },
    footerNote: {
      fontSize: 11,
      color: COLORS.sub,
      textAlign: "center",
      marginTop: 8,
    },
  });
