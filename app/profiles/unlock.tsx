import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/auth/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/theme/ThemeProvider";

// Ecrã de contacto para quem quer folhas para mais do que uma pessoa. NÃO é um
// paywall: grava o pedido em profile_unlock_requests (RPC request_profile_unlock)
// e envia-me email. O desbloqueio é manual (app_metadata.profiles_unlocked=true).
export default function ProfileUnlockScreen() {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const s = styles(COLORS, mode);

  const [email, setEmail] = useState(user?.email ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    const { error: err } = await supabase.rpc("request_profile_unlock", {
      p_email: email.trim(),
      p_message: message.trim(),
    });
    setSending(false);
    if (err) {
      setError(t("profile_limit_error"));
      return;
    }
    setSent(true);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={s.backLink}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
        </Pressable>
        <Text style={s.headerTitle}>{t("profiles_title", { defaultValue: "Perfis" })}</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {sent ? (
          <View style={s.section}>
            <View style={s.okIcon}>
              <Ionicons name="checkmark" size={30} color={COLORS.accent} />
            </View>
            <Text style={s.title}>{t("profile_limit_sent_title")}</Text>
            <Text style={s.body}>{t("profile_limit_sent_msg")}</Text>
            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
              onPress={() => router.back()}
            >
              <Text style={s.btnText}>{t("back", { defaultValue: "Voltar" })}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.section}>
              <Text style={s.title}>{t("profile_limit_title")}</Text>
              <Text style={s.body}>{t("profile_limit_text")}</Text>
            </View>

            <View style={s.section}>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>{t("email", { defaultValue: "Email" })}</Text>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="nome@email.com"
                  placeholderTextColor={COLORS.sub}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>{t("profile_limit_message_ph")}</Text>
                <TextInput
                  style={[s.input, s.inputMultiline]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t("profile_limit_message_ph")}
                  placeholderTextColor={COLORS.sub}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {error && <Text style={s.errorText}>{error}</Text>}

              <Pressable
                style={({ pressed }) => [
                  s.btn,
                  pressed && { opacity: 0.85 },
                  sending && { opacity: 0.6 },
                ]}
                onPress={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnText}>{t("profile_limit_send")}</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
    },
    backLink: { color: COLORS.text, fontSize: 15, fontWeight: "800", width: 70, opacity: 0.9 },
    headerTitle: { fontSize: 22, fontWeight: "700", color: COLORS.text },
    scroll: { padding: 16, gap: 16, paddingBottom: 40, width: "100%", maxWidth: 560, alignSelf: "center" },

    section: {
      backgroundColor: COLORS.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      gap: 12,
    },
    title: { fontSize: 19, fontWeight: "900", color: COLORS.text, lineHeight: 25 },
    body: { fontSize: 14.5, color: COLORS.sub, lineHeight: 21 },

    inputWrap: { gap: 6 },
    inputLabel: { fontSize: 12, fontWeight: "700", color: COLORS.sub },
    input: {
      backgroundColor: mode === "dark" ? COLORS.bg : "#E8EBF0",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
      color: COLORS.text,
    },
    inputMultiline: { minHeight: 110 },
    errorText: { fontSize: 13, color: COLORS.danger, fontWeight: "700" },

    btn: {
      backgroundColor: COLORS.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    btnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

    okIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: COLORS.accent,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
    },
  });
