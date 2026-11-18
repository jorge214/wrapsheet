// src/ui/AvisoTaxasZero.tsx
// O aviso das "horas pagas a 0 €" (storage/taxasZero.ts): esta folha tem horas
// extra ou de recuperação registadas e a taxa delas está gravada a 0. A app
// não adivinha se é de propósito — pergunta. Aparece na página da folha e no
// diálogo de exportar o PDF (o último sítio antes de a folha seguir).
import React from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import type { AvisoTaxasZero as Aviso, ChaveTaxa } from "../storage/taxasZero";

const NOME: Record<ChaveTaxa, string> = {
  rateHEA: "label_hea",
  rateHEB: "label_heb",
  rateHR: "label_hr",
};

export function AvisoTaxasZero({
  aviso,
  valor,
  onCorrigir,
  onManter,
  style,
}: {
  aviso: Aviso;
  /** A diferença já formatada na moeda da folha ("964,50 €") */
  valor: string;
  onCorrigir: () => void;
  onManter: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const horas = aviso.chaves.map((k) => t(NOME[k])).join(", ");
  return (
    <View
      accessibilityRole="alert"
      style={[{ backgroundColor: "#FFF4E0", borderWidth: 1, borderColor: "#E8A33D", borderRadius: 14, padding: 12 }, style]}
    >
      <Text style={{ color: "#6B3D00", fontWeight: "900", fontSize: 14 }}>
        {t("zero_rate_title", { defaultValue: "Horas pagas a zero" })}
      </Text>
      <Text style={{ color: "#5A3A0C", fontSize: 13, lineHeight: 18, marginTop: 4 }}>
        {t("zero_rate_body", {
          horas,
          valor,
          defaultValue: "{{horas}}: nesta folha a taxa está a 0 por hora. Com a taxa automática, o valor bruto sobe {{valor}}.",
        })}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        <Pressable
          onPress={onCorrigir}
          accessibilityRole="button"
          style={({ pressed }) => [
            { backgroundColor: "#1C1C1E", borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
            {t("zero_rate_fix", { defaultValue: "Usar a taxa automática" })}
          </Text>
        </Pressable>
        <Pressable
          onPress={onManter}
          accessibilityRole="button"
          style={({ pressed }) => [
            { borderWidth: 1, borderColor: "#B77A1F", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={{ color: "#6B3D00", fontWeight: "800", fontSize: 13 }}>
            {t("zero_rate_keep", { defaultValue: "Está certo assim" })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
