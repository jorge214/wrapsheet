import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { LanguagePicker } from "../../src/ui/LanguagePicker";
import { WrapSheetLogo } from "../../src/ui/WrapSheetLogo";

export default function LoginScreen() {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const { signIn, session } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/");
  }, [session]);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    if (err) {
      setError(err);
      setLoading(false);
    }
  }

  const s = styles(COLORS, mode);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.topBar}>
        <LanguagePicker />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.logoWrap}>
            <WrapSheetLogo variant="lockup" size="lg" />
          </View>

          <Text style={s.title}>{t("auth_login_title")}</Text>

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
              placeholder="••••••••"
              placeholderTextColor={COLORS.sub}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t("auth_login_title")}</Text>}
          </Pressable>

          <Pressable onPress={() => router.push("/auth/forgot")} style={s.link}>
            <Text style={s.linkText}>{t("auth_forgot_link")}</Text>
          </Pressable>

          <View style={s.divider} />

          <Pressable onPress={() => router.push("/auth/register")} style={s.link}>
            <Text style={s.linkText}>
              {t("auth_no_account")} <Text style={{ fontWeight: "900" }}>{t("auth_register_link")}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    topBar: { alignItems: "flex-end", paddingHorizontal: 20, paddingTop: 8 },
    scroll: { padding: 24, paddingTop: 16 },
    logoWrap: { alignItems: "center", marginBottom: 32 },
    title: { fontSize: 28, fontWeight: "900", color: COLORS.text, marginBottom: 20 },
    errorText: { color: COLORS.danger, fontSize: 14, marginBottom: 12, fontWeight: "600" },
    card: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 16 },
    label: { color: COLORS.sub, fontSize: 12, fontWeight: "900", marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: mode === "dark" ? COLORS.bg : "#E8EBF0", borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: COLORS.text },
    btn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
    btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
    link: { alignItems: "center", paddingVertical: 8 },
    linkText: { color: COLORS.sub, fontSize: 14 },
  });
