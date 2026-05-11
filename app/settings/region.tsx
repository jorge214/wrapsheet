import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { REGION_LIST, RegionCode } from "../../src/constants/countryPresets";
import { getSettings, setRegion } from "../../src/storage/appSettings";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useIsWide } from "../../src/ui/useBreakpoint";

export default function RegionScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const isWide = useIsWide();

  const [active, setActive] = React.useState<RegionCode | undefined>(undefined);

  React.useEffect(() => {
    getSettings().then((s) => setActive((s.region as RegionCode) ?? "pt"));
  }, []);

  async function select(code: RegionCode) {
    await setRegion(code);
    setActive(code);
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={[ss.header, { borderColor: COLORS.border }]}>
          {!isWide && (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color={COLORS.text} />
            </Pressable>
          )}
          <Text style={[ss.headerTitle, { color: COLORS.text }]}>
            {t("settings_section_region")}
          </Text>
          {!isWide && <View style={{ width: 26 }} />}
        </View>

        <Text style={[ss.hint, { color: COLORS.sub }]}>
          {t("tax_disclaimer")}
        </Text>

        {REGION_LIST.map((r) => (
          <Pressable
            key={r.code}
            onPress={() => select(r.code)}
            style={({ pressed }: any) => [
              ss.row,
              { borderColor: COLORS.border, backgroundColor: COLORS.card },
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={ss.rowLeft}>
              <Text style={ss.flag}>{r.flag}</Text>
              <View>
                <Text style={[ss.rowLabel, { color: COLORS.text }]}>
                  {t(r.nameKey)}
                </Text>
                <Text style={[ss.rowSub, { color: COLORS.sub }]}>
                  {r.taxLabels.incomeTax} {r.fiscal.IRS_percent}% · {r.taxLabels.vat} {r.fiscal.IVA_percent}%
                </Text>
              </View>
            </View>
            {active === r.code ? (
              <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} />
            ) : (
              <Ionicons name="ellipse-outline" size={22} color={COLORS.sub} />
            )}
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
  hint: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 18,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  flag: { fontSize: 28 },
  rowLabel: { fontSize: 16, fontWeight: "600" },
  rowSub: { fontSize: 12, marginTop: 2 },
});
