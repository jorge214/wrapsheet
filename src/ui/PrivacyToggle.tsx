// Botão do olho: liga/desliga o modo privacidade (src/ui/privacy.ts).
// O ícone mostra o ESTADO (olho aberto = valores à vista, riscado = escondidos);
// o rótulo de acessibilidade diz o que o toque FAZ.
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleProp, ViewStyle } from "react-native";
import { usePrivacy } from "./privacy";

export function PrivacyToggle({
  color,
  size = 22,
  style,
}: {
  color: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const { hidden, ready, toggle } = usePrivacy();
  const label = hidden
    ? t("privacy_show_values", { defaultValue: "Mostrar valores" })
    : t("privacy_hide_values", { defaultValue: "Ocultar valores" });

  return (
    <Pressable
      // Nunca DENTRO de outro botão: no iOS um Pressable é um elemento de
      // acessibilidade e esconde do VoiceOver os botões que tem dentro. No
      // cartão-resumo da página inicial o olho é irmão do cartão, não filho.
      onPress={() => toggle()}
      disabled={!ready}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        // 22 + 2×10 de padding + hitSlop 8 = 58 pt de área de toque
        { padding: 10, alignItems: "center", justifyContent: "center" },
        Platform.OS === "web" && ({ cursor: "pointer", userSelect: "none" } as any),
        pressed && { opacity: 0.6 },
        style,
      ]}
    >
      {/* Enquanto o estado guardado não foi lido (milissegundos, ao abrir), o
          ícone ocupa o lugar mas não se vê — nem olho aberto a trocar para
          riscado, nem o contrário. */}
      <Ionicons
        name={hidden ? "eye-off-outline" : "eye-outline"}
        size={size}
        color={color}
        style={{ opacity: ready ? 1 : 0 }}
      />
    </Pressable>
  );
}
