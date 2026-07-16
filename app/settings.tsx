import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useIsWide } from "../src/ui/useBreakpoint";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../src/theme/ThemeProvider";
import { getPreset } from "../src/constants/countryPresets";
import { getSettings } from "../src/storage/appSettings";

export default function SettingsScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const isWide = useIsWide();

  const [regionCode, setRegionCode] = React.useState<string>("pt");

  useFocusEffect(
    React.useCallback(() => {
      getSettings().then((s) => setRegionCode(s.region ?? "pt"));
    }, [])
  );

  const preset = getPreset(regionCode);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={[ss.header, { borderColor: COLORS.border }]}>
          {!isWide && (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color={COLORS.text} />
            </Pressable>
          )}

          <Text style={[ss.headerTitle, { color: COLORS.text }]}>
            {t("settings_title", { defaultValue: "Definições" })}
          </Text>

          {!isWide && <View style={{ width: 26 }} />}
        </View>

        {/* Conta */}
        <Section title={t("account_title").toUpperCase()} COLORS={COLORS}>
          <Pressable
            onPress={() => router.push("/settings/account")}
            style={[ss.row, { borderColor: COLORS.border }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="person-circle-outline" size={22} color={COLORS.sub} />
              <Text style={[ss.rowLabel, { color: COLORS.text }]}>{t("account_session")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.sub} />
          </Pressable>
        </Section>

        {/* Região */}
        <Section title={t("settings_section_region")} COLORS={COLORS}>
          <Pressable
            onPress={() => router.push("/settings/region")}
            style={[ss.row, { borderColor: COLORS.border }]}
          >
            <Text style={[ss.rowLabel, { color: COLORS.text }]}>
              {t("settings_region")}
            </Text>
            <View style={ss.rowRight}>
              <Text style={[ss.rowValue, { color: COLORS.sub }]}>
                {preset.flag} {t(preset.nameKey)}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.sub} style={{ marginLeft: 4 }} />
            </View>
          </Pressable>
        </Section>

        {/* Idioma */}
        <Section title={t("settings_section_language", { defaultValue: "Idioma" })} COLORS={COLORS}>
          <Pressable
            onPress={() => router.push("/settings/language")}
            style={[ss.row, { borderColor: COLORS.border }]}
          >
            <Text style={[ss.rowLabel, { color: COLORS.text }]}>
              {t("settings_language_app", { defaultValue: "Idioma da aplicação" })}
            </Text>

            <View style={ss.rowRight}>
              <Text style={[ss.rowValue, { color: COLORS.sub }]}>
                {t("manage", { defaultValue: "Gerir" })}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.sub}
                style={{ marginLeft: 4 }}
              />
            </View>
          </Pressable>
        </Section>

        {/* Subscrição */}
        <Section title={t("settings_section_subscription", { defaultValue: "Subscrição" })} COLORS={COLORS}>
          <Pressable
            onPress={() => router.push("/settings/plan")}
            style={[ss.row, { borderColor: COLORS.border }]}
          >
            <View>
              <Text style={[ss.rowLabel, { color: COLORS.text }]}>
                {t("settings_current_plan", { defaultValue: "Plano atual" })}
              </Text>
              <Text style={[ss.rowSub, { color: COLORS.sub }]}>
                {t("settings_plan_free", { defaultValue: "Experimental gratuito" })}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color={COLORS.sub} />
          </Pressable>
        </Section>

        {/* Ajuda e Legal */}
        <Section title={t("settings_section_help", { defaultValue: "Ajuda e Informações" })} COLORS={COLORS}>
          <Pressable
            onPress={() => router.push("/settings/about")}
            style={[ss.row, { borderColor: COLORS.border }]}
          >
            <Text style={[ss.rowLabel, { color: COLORS.text }]}>
              {t("settings_contact", { defaultValue: "Contactar" })}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.sub} />
          </Pressable>

          <Pressable
            onPress={() => router.push("/settings/legal")}
            style={[ss.row, { borderColor: COLORS.border }]}
          >
            <Text style={[ss.rowLabel, { color: COLORS.text }]}>
              {t("settings_terms_privacy", { defaultValue: "Termos e Política de Privacidade" })}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.sub} />
          </Pressable>
        </Section>

        <Text style={[ss.version, { color: COLORS.sub }]}>
          {t("settings_version", { defaultValue: "Versão 1.0.0" })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  COLORS,
}: {
  title: string;
  children: React.ReactNode;
  COLORS: any;
}) {
  return (
    <View
      style={[
        ss.section,
        {
          backgroundColor: COLORS.card,
          borderColor: COLORS.border,
          shadowColor: COLORS.shadow,
        },
      ]}
    >
      <Text style={[ss.sectionTitle, { color: COLORS.sub }]}>{title}</Text>
      <View style={[ss.sectionBody, { borderColor: COLORS.border }]}>{children}</View>
    </View>
  );
}

const ss = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: "800" },

  section: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: "800", marginLeft: 16, marginBottom: 6 },
  sectionBody: { borderTopWidth: 1 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 16, fontWeight: "700" },
  rowRight: { flexDirection: "row", alignItems: "center" },
  rowValue: { fontSize: 15 },
  rowSub: { fontSize: 13 },
  version: { textAlign: "center", marginTop: 16, fontSize: 13 },
});