import { router } from "expo-router";
import React, { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeProvider";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

// Versão + build + atualização OTA a correr. Serve para saber, sem adivinhar,
// que código está instalado (as OTA chegam em silêncio e só se aplicam ao
// arranque seguinte). Na web e no Expo Go não há OTA: mostra só a versão.
function versionLine(): string {
  const v = Constants.expoConfig?.version ?? "";
  const build = (Constants as any).nativeBuildVersion ?? "";
  let ota = "";
  try {
    const id = (Updates as any).updateId as string | null | undefined;
    if (!IS_WEB && (Updates as any).isEnabled) ota = id ? id.slice(0, 8) : "embutida";
  } catch {}
  return [v && `v${v}`, build && `(${build})`, ota && `· OTA ${ota}`].filter(Boolean).join(" ");
}

const SUPPORT_EMAIL = "getwrapsheet@gmail.com";
const SUPPORT_URL = "https://wrapsheet-app.com/support";
const IS_WEB = Platform.OS === "web";

// Página de suporte (útil sobretudo no PC): é uma página web normal (https),
// por isso abrir num separador funciona em qualquer lado — ao contrário do
// mailto, que partia o PWA de desktop.
function openSupportPage() {
  if (IS_WEB && typeof window !== "undefined") {
    window.open(SUPPORT_URL, "_blank", "noopener");
    return;
  }
  Linking.openURL(SUPPORT_URL).catch(() => {});
}

export default function AboutScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      if (
        IS_WEB &&
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(SUPPORT_EMAIL);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sem clipboard (browser antigo/contexto inseguro): o email está visível
      // e selecionável logo abaixo, por isso não é preciso mais nada.
    }
  }

  async function handleSupport() {
    // PWA de desktop: navegar para "mailto:" abria um separador em branco e
    // "saía" da app (nem toda a gente tem cliente de email no PC). Copiar o
    // endereço é fiável em qualquer browser. No nativo (iPhone/iPad) o mailto
    // abre o compositor de email — que é o que se quer.
    if (IS_WEB) {
      await copyEmail();
      return;
    }
    const url = `mailto:${SUPPORT_EMAIL}`;
    const ok = await Linking.canOpenURL(url).catch(() => false);
    if (ok) Linking.openURL(url).catch(() => {});
  }

  const actionLabel = copied
    ? t("about_email_copied", { defaultValue: "Email copiado ✓" })
    : IS_WEB
    ? t("about_copy_email", { defaultValue: "Copiar email" })
    : t("about_contact_support", { defaultValue: "Contactar suporte" });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={[ss.header, { borderColor: COLORS.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={[ss.backLink, { color: COLORS.text }]}>
            ‹ {t("back", { defaultValue: "Voltar" })}
          </Text>
        </Pressable>
        <Text style={[ss.headerTitle, { color: COLORS.text }]}>
          {t("settings_contact", { defaultValue: "Suporte" })}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={[ss.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
        <Text style={[ss.title, { color: COLORS.text }]}>WrapSheet</Text>
        <Text style={{ color: COLORS.sub, marginTop: 6 }}>
          {t("contact_support_body", { defaultValue: "Encontraste um problema, tens uma dúvida ou uma sugestão? Envia-nos uma mensagem — respondemos o mais depressa possível." })}
        </Text>
        <Pressable
          onPress={handleSupport}
          style={[ss.btn, { backgroundColor: COLORS.text }]}
        >
          <Text style={[ss.btnText, { color: COLORS.bg }]}>
            {actionLabel}
          </Text>
        </Pressable>
        {/* Email visível e copiável — no PC nem toda a gente tem cliente de email */}
        <Text selectable style={{ color: COLORS.sub, marginTop: 10, textAlign: "center", fontWeight: "700" }}>
          {SUPPORT_EMAIL}
        </Text>

        {/* Página de suporte (FAQ + contacto) — sobretudo para o PC */}
        <View style={[ss.supportLinkWrap, { borderColor: COLORS.border }]}>
          <Text style={{ color: COLORS.sub, fontSize: 12, marginBottom: 4 }}>
            {t("about_support_page", { defaultValue: "Página de suporte" })}
          </Text>
          <Pressable onPress={openSupportPage} hitSlop={8}>
            <Text style={[ss.supportLink, { color: COLORS.text }]}>
              wrapsheet-app.com/support
            </Text>
          </Pressable>
        </View>

        <Text selectable style={{ color: COLORS.sub, fontSize: 11, marginTop: 12, textAlign: "center" }}>
          {versionLine()}
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
  supportLinkWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    alignItems: "center",
  },
  supportLink: {
    fontSize: 15,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
});
