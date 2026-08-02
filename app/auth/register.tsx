import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import { useTheme } from "../../src/theme/ThemeProvider";
import { WrapSheetLogo } from "../../src/ui/WrapSheetLogo";

export default function RegisterScreen() {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const { signUp, session } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    if (session) router.replace("/");
  }, [session]);

  async function handleRegister() {
    if (!email.trim() || !password) return;
    if (password !== confirm) { setError(t("auth_password_mismatch")); return; }
    if (password.length < 6) { setError(t("auth_password_too_short")); return; }
    setLoading(true);
    setError(null);
    const res = await signUp(email.trim(), password);
    if (res.error) { setError(res.error); setLoading(false); return; }
    if (res.needsConfirmation) {
      // Conta criada mas o Supabase exige confirmação por email antes do login
      setConfirmSent(true);
      setLoading(false);
    }
    // com sessão, o useEffect acima redireciona
  }

  function openLegal(path: string) {
    const url = "https://wrapsheet-app.com" + path;
    if (Platform.OS === "web") window.open(url, "_blank", "noopener");
    else Linking.openURL(url).catch(() => {});
  }

  if (confirmSent) {
    return (
      <SafeAreaView style={styles(COLORS, mode).root}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 26, fontWeight: "900", color: COLORS.text, marginBottom: 12, textAlign: "center" }}>
            ✉️ {t("auth_confirm_email_title", { defaultValue: "Confirma o teu email" })}
          </Text>
          <Text style={{ fontSize: 15, color: COLORS.sub, textAlign: "center", lineHeight: 22 }}>
            {t("auth_confirm_email_body", { defaultValue: "Enviámos-te um email de confirmação. Clica no link para ativares a conta e depois inicia sessão." })}
          </Text>
          <Pressable
            onPress={() => router.replace("/auth/login")}
            style={{ marginTop: 24, alignSelf: "center", borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 }}
          >
            <Text style={{ color: COLORS.text, fontWeight: "900" }}>{t("auth_login_title")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const s = styles(COLORS, mode);

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/auth/login"))}
            style={s.back}
          >
            <Text style={s.backText}>‹ {t("auth_login_title")}</Text>
          </Pressable>

          <View style={s.logoWrap}>
            <WrapSheetLogo variant="lockup" size="lg" />
          </View>

          <Text style={s.title}>{t("auth_register_title")}</Text>

          {error && <Text style={s.errorText}>{error}</Text>}

          <View style={s.card}>
            <Text style={s.label}>{t("email")}</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t("email_placeholder")}
              placeholderTextColor={COLORS.sub}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Text style={s.label}>{t("auth_password")}</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth_password_placeholder")}
              placeholderTextColor={COLORS.sub}
              secureTextEntry
              autoComplete="new-password"
            />
            <Text style={s.label}>{t("auth_confirm_password")}</Text>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t("auth_password_confirm_placeholder")}
              placeholderTextColor={COLORS.sub}
              secureTextEntry
            />
          </View>

          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t("auth_register_title")}</Text>}
          </Pressable>

          <Text style={s.accept}>
            {t("auth_accept_pre", { defaultValue: "Ao criar conta aceitas os " })}
            <Text style={s.acceptLink} onPress={() => openLegal("/terms")}>
              {t("auth_accept_terms", { defaultValue: "Termos" })}
            </Text>
            {t("auth_accept_mid", { defaultValue: " e a " })}
            <Text style={s.acceptLink} onPress={() => openLegal("/privacy")}>
              {t("auth_accept_privacy", { defaultValue: "Política de Privacidade" })}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { padding: 24, paddingTop: 24 },
    back: { marginBottom: 24 },
    backText: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
    logoWrap: { alignItems: "center", marginBottom: 24 },
    title: { fontSize: 28, fontWeight: "900", color: COLORS.text, marginBottom: 20 },
    errorText: { color: COLORS.danger, fontSize: 14, marginBottom: 12, fontWeight: "600" },
    card: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 16 },
    label: { color: COLORS.sub, fontSize: 12, fontWeight: "900", marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: mode === "dark" ? COLORS.bg : "#E8EBF0", borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: COLORS.text },
    btn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
    btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
    accept: { marginTop: 14, fontSize: 12, color: COLORS.sub, textAlign: "center", lineHeight: 18 },
    acceptLink: { color: COLORS.accent, fontWeight: "800", textDecorationLine: "underline" },
  });
