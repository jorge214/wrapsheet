import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { REGION_LIST, RegionCode, getPreset } from "../../src/constants/countryPresets";
import { getSettings, setCustomFiscal, setRegion } from "../../src/storage/appSettings";
import { Flag } from "../../src/ui/Flag";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function RegionScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();

  const [active, setActive] = React.useState<RegionCode | undefined>(undefined);
  // Taxas personalizadas (undefined = standard do país). São a fonte global
  // de impostos da app: projetos novos e Painel usam-nas.
  const [customIRS, setCustomIRS] = React.useState<number | undefined>(undefined);
  const [customIVA, setCustomIVA] = React.useState<number | undefined>(undefined);
  // Buffers de texto para dar para escrever decimais ("23,")
  const [irsTxt, setIrsTxt] = React.useState<string | null>(null);
  const [ivaTxt, setIvaTxt] = React.useState<string | null>(null);

  React.useEffect(() => {
    getSettings().then((s) => {
      setActive((s.region as RegionCode) ?? "pt");
      setCustomIRS(s.fiscalIRS);
      setCustomIVA(s.fiscalIVA);
    });
  }, []);

  const preset = getPreset(active ?? "pt");
  const effIRS = customIRS ?? preset.fiscal.IRS_percent;
  const effIVA = customIVA ?? preset.fiscal.IVA_percent;

  async function select(code: RegionCode) {
    // Escolher o país adota o standard dele (limpa personalizações);
    // fica na página para se poder ajustar os valores à mão.
    await setRegion(code);
    setActive(code);
    setCustomIRS(undefined);
    setCustomIVA(undefined);
    setIrsTxt(null);
    setIvaTxt(null);
    // Regiões sem regras de HE trabalhadas: avisar que os limiares/multiplicadores
    // são genéricos e têm de ser ajustados ao acordo/contrato local. (Alert só
    // aparece no nativo; na web fica o banner persistente por baixo do disclaimer.)
    if (!getPreset(code).otVerified) {
      Alert.alert(
        t("region_ot_unverified_title", { defaultValue: "Horas extra por confirmar" }),
        t("region_ot_unverified_warning", {
          defaultValue:
            "Os limiares e multiplicadores de horas extra desta região são genéricos e têm de ser ajustados ao acordo coletivo ou contrato local antes de usar.",
        })
      );
    }
  }

  function parseNum(v: string): number | undefined {
    const raw = v.trim().replace(",", ".");
    if (raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  async function changeIRS(v: string) {
    setIrsTxt(v);
    const n = parseNum(v);
    setCustomIRS(n);
    await setCustomFiscal(n, customIVA);
  }

  async function changeIVA(v: string) {
    setIvaTxt(v);
    const n = parseNum(v);
    setCustomIVA(n);
    await setCustomFiscal(customIRS, n);
  }

  const fmtPct = (n: number) => String(n).replace(".", ",");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={ss.column}>
        <View style={[ss.header, { borderColor: COLORS.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[ss.backLink, { color: COLORS.text }]}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
          </Pressable>
          <Text style={[ss.headerTitle, { color: COLORS.text }]}>
            {t("settings_section_region")}
          </Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Taxas em vigor na app (standard do país, editáveis à mão) */}
        <View style={[ss.taxCard, { borderColor: COLORS.border, backgroundColor: COLORS.card }]}>
          <Text style={[ss.taxTitle, { color: COLORS.text }]}>
            {t("region_taxes_title", { defaultValue: "Taxas aplicadas na app" })}
          </Text>
          <Text style={[ss.taxHint, { color: COLORS.sub }]}>
            {t("region_taxes_hint", {
              defaultValue:
                "Escolhe um país para usares o standard dele; podes ajustar os valores à mão. Aplicam-se aos projetos novos e ao Painel — em cada folha podes sempre alterar se um trabalho fugir à regra.",
            })}
          </Text>
          <View style={ss.taxRow}>
            <Text style={[ss.taxLabel, { color: COLORS.text }]}>{preset.taxLabels.incomeTax}</Text>
            <View style={ss.taxInputWrap}>
              <TextInput
                value={irsTxt ?? (customIRS != null ? fmtPct(customIRS) : "")}
                onChangeText={changeIRS}
                onBlur={() => setIrsTxt(null)}
                placeholder={fmtPct(preset.fiscal.IRS_percent)}
                placeholderTextColor={COLORS.sub}
                keyboardType="decimal-pad"
                style={[ss.taxInput, { color: COLORS.text, borderColor: COLORS.border, backgroundColor: COLORS.bg }]}
              />
              <Text style={[ss.taxUnit, { color: COLORS.sub }]}>%</Text>
            </View>
          </View>
          <View style={ss.taxRow}>
            <Text style={[ss.taxLabel, { color: COLORS.text }]}>{preset.taxLabels.vat}</Text>
            <View style={ss.taxInputWrap}>
              <TextInput
                value={ivaTxt ?? (customIVA != null ? fmtPct(customIVA) : "")}
                onChangeText={changeIVA}
                onBlur={() => setIvaTxt(null)}
                placeholder={fmtPct(preset.fiscal.IVA_percent)}
                placeholderTextColor={COLORS.sub}
                keyboardType="decimal-pad"
                style={[ss.taxInput, { color: COLORS.text, borderColor: COLORS.border, backgroundColor: COLORS.bg }]}
              />
              <Text style={[ss.taxUnit, { color: COLORS.sub }]}>%</Text>
            </View>
          </View>
          <Text style={[ss.taxNow, { color: COLORS.sub }]}>
            {preset.taxLabels.incomeTax} {fmtPct(effIRS)}% · {preset.taxLabels.vat} {fmtPct(effIVA)}%
          </Text>
        </View>

        <Text style={[ss.hint, { color: COLORS.sub }]}>
          {t("tax_disclaimer")}
        </Text>

        {/* Banner persistente: a região ATIVA não tem regras de HE verificadas */}
        {!preset.otVerified && (
          <View style={[ss.warnBox, { borderColor: COLORS.border, backgroundColor: COLORS.card }]}>
            <Text style={[ss.warnText, { color: COLORS.text }]}>
              ⚠ {t("region_ot_unverified_warning", {
                defaultValue:
                  "Os limiares e multiplicadores de horas extra desta região são genéricos e têm de ser ajustados ao acordo coletivo ou contrato local antes de usar.",
              })}
            </Text>
          </View>
        )}

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
              <Flag code={r.code} />
              <View>
                <Text style={[ss.rowLabel, { color: COLORS.text }]}>
                  {t(r.nameKey)}
                </Text>
                <Text style={[ss.rowSub, { color: COLORS.sub }]}>
                  {r.taxLabels.incomeTax} {r.fiscal.IRS_percent}% · {r.taxLabels.vat} {r.fiscal.IVA_percent}%
                </Text>
                {!r.otVerified && (
                  <Text style={[ss.rowBadge, { color: COLORS.sub }]} numberOfLines={1}>
                    ⚠ {t("region_ot_generic_badge", { defaultValue: "Horas extra genéricas" })}
                  </Text>
                )}
              </View>
            </View>
            {active === r.code ? (
              <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} />
            ) : (
              <Ionicons name="ellipse-outline" size={22} color={COLORS.sub} />
            )}
          </Pressable>
        ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  column: { width: "100%", maxWidth: 720, alignSelf: "center" },
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
  headerTitle: { fontSize: 22, fontWeight: "800" },
  backLink: { fontSize: 15, fontWeight: "800", width: 70, opacity: 0.9 },
  taxCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  taxTitle: { fontSize: 14, fontWeight: "800" },
  taxHint: { fontSize: 12, lineHeight: 17 },
  taxRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  taxLabel: { fontSize: 15, fontWeight: "700" },
  taxInputWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  taxInput: {
    minWidth: 90,
    textAlign: "right",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: "700",
  },
  taxUnit: { fontSize: 14, fontWeight: "700" },
  taxNow: { fontSize: 12, textAlign: "right" },
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
  rowLabel: { fontSize: 16, fontWeight: "700" },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowBadge: { fontSize: 11, fontWeight: "700", marginTop: 3, opacity: 0.9 },
  warnBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  warnText: { fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
});
