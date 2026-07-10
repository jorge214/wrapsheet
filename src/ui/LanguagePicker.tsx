import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { LangCode, SUPPORTED_LANGS, setAppLanguage } from "../i18n/i18n";
import { useTheme } from "../theme/ThemeProvider";

const LANG_LABELS: Record<LangCode, string> = {
  en: "English",
  pt: "Português",
  "pt-BR": "Português (BR)",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
};

const LANG_SHORT: Record<LangCode, string> = {
  en: "EN",
  pt: "PT",
  "pt-BR": "BR",
  es: "ES",
  fr: "FR",
  de: "DE",
  it: "IT",
  nl: "NL",
  pl: "PL",
};

export function LanguagePicker() {
  const { COLORS } = useTheme();
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const current = (i18n.language || "en") as LangCode;

  async function select(code: LangCode) {
    setVisible(false);
    await setAppLanguage(code);
  }

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          { borderColor: COLORS.border, backgroundColor: COLORS.card },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Text style={[styles.triggerText, { color: COLORS.text }]}>
          {LANG_SHORT[current] ?? "EN"} ▾
        </Text>
      </Pressable>

      <Modal transparent animationType="fade" visible={visible}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable
            style={[styles.modal, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
            onPress={() => {}}
          >
            {SUPPORTED_LANGS.map((code) => (
              <Pressable
                key={code}
                onPress={() => select(code)}
                style={({ pressed }) => [
                  styles.option,
                  { borderColor: COLORS.border },
                  code === current && { backgroundColor: COLORS.bg },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.optLabel, { color: COLORS.text }]}>
                  {LANG_LABELS[code]}
                </Text>
                {code === current && (
                  <Text style={{ color: COLORS.text, fontWeight: "900" }}>✓</Text>
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  triggerText: { fontSize: 13, fontWeight: "700" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modal: {
    width: "100%",
    maxWidth: 300,
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  optLabel: { fontSize: 15, fontWeight: "600" },
});
