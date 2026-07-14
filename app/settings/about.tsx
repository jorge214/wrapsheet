import { router } from "expo-router";
import React from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeProvider";

const SUPPORT_EMAIL = "getwrapsheet@gmail.com";

function openSupportEmail() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Na web o Linking.openURL abria o mailto num separador novo que ficava
    // em branco — navegar diretamente dispara o cliente de email sem isso.
    window.location.href = `mailto:${SUPPORT_EMAIL}`;
    return;
  }
  Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
}

export default function AboutScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={[ss.header, { borderColor: COLORS.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={[ss.backLink, { color: COLORS.text }]}>
            ‹ {t("back", { defaultValue: "Voltar" })}
          </Text>
        </Pressable>
        <Text style={[ss.headerTitle, { color: COLORS.text }]}>
          {t("settings_contact", { defaultValue: "Contactar" })}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={[ss.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
        <Text style={[ss.title, { color: COLORS.text }]}>WrapSheet</Text>
        <Text style={{ color: COLORS.sub, marginTop: 6 }}>
          {t("contact_support_body", { defaultValue: "Encontraste um problema, tens uma dúvida ou uma sugestão? Envia-nos uma mensagem — respondemos o mais depressa possível." })}
        </Text>
        <Pressable
          onPress={openSupportEmail}
          style={[ss.btn, { backgroundColor: COLORS.text }]}
        >
          <Text style={[ss.btnText, { color: COLORS.bg }]}>
            {t("about_contact_support", { defaultValue: "Contactar suporte" })}
          </Text>
        </Pressable>
        {/* Email visível e copiável — no PC nem toda a gente tem cliente de email */}
        <Text selectable style={{ color: COLORS.sub, marginTop: 10, textAlign: "center", fontWeight: "700" }}>
          {SUPPORT_EMAIL}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  backLink: { fontSize: 15, fontWeight: "800", width: 70, opacity: 0.9 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  card: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  title: { fontSize: 18, fontWeight: "800" },
  btn: { marginTop: 12, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  btnText: { fontWeight: "700" },
});
