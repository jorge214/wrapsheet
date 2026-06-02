import { router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import i18n, { setAppLanguage } from "../../src/i18n/i18n";
import { useTheme } from "../../src/theme/ThemeProvider";

const LANGS = [
  { code: "pt",    label: "Português" },
  { code: "en",    label: "English" },
  { code: "es",    label: "Español" },
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "fr",    label: "Français" },
  { code: "de",    label: "Deutsch" },
  { code: "it",    label: "Italiano" },
] as const;

type LangCode = (typeof LANGS)[number]["code"];

function normalizeLang(tag: string): LangCode {
  const t = (tag || "").replace("_", "-").toLowerCase();
  if (t.startsWith("pt-br")) return "pt-BR";
  if (t.startsWith("pt"))    return "pt";
  if (t.startsWith("en"))    return "en";
  if (t.startsWith("es"))    return "es";
  if (t.startsWith("fr"))    return "fr";
  if (t.startsWith("de"))    return "de";
  if (t.startsWith("it"))    return "it";
  return "en";
}

export default function LanguageScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();

  const [active, setActive] = React.useState<LangCode>(() =>
    normalizeLang(i18n.resolvedLanguage || i18n.language)
  );

  React.useEffect(() => {
    const onChange = (lng: string) => setActive(normalizeLang(lng));
    i18n.on("languageChanged", onChange);
    return () => { i18n.off("languageChanged", onChange); };
  }, []);

  async function select(code: LangCode) {
    await setAppLanguage(code);
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={[ss.header, { borderColor: COLORS.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[ss.backLink, { color: COLORS.text }]}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
          </Pressable>
          <Text style={[ss.headerTitle, { color: COLORS.text }]}>
            {t("settings_section_language", { defaultValue: "Language" })}
          </Text>
          <View style={{ width: 70 }} />
        </View>

        {LANGS.map((l) => (
          <Pressable
            key={l.code}
            onPress={() => select(l.code)}
            style={({ pressed }: any) => [
              ss.row,
              { borderColor: COLORS.border, backgroundColor: COLORS.card },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ color: COLORS.text, fontSize: 16 }}>{l.label}</Text>
            <Text style={{ color: active === l.code ? COLORS.text : COLORS.sub, fontSize: 18, fontWeight: "900" }}>
              {active === l.code ? "●" : "○"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
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
  headerTitle: { fontSize: 22, fontWeight: "700" },
  backLink: { fontSize: 15, fontWeight: "800", width: 70, opacity: 0.9 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
