import { router } from "expo-router";
import React, { useState } from "react";
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
import { WrapSheetLogo } from "../../src/ui/WrapSheetLogo";

export default function RegisterScreen() {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!email.trim() || !password) return;
    if (password !== confirm) {
      setError("As passwords não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A password deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    const err = await signUp(email.trim(), password);
    if (err) {
      setError(err);
      setLoading(false);
    }
    // on success, session is set → _layout redirects automatically
  }

  const s = styles(COLORS, mode);

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={s.back}>
            <Text style={s.backText}>‹ Entrar</Text>
          </Pressable>

          <View style={s.logoWrap}>
            <WrapSheetLogo variant="lockup" size="lg" />
          </View>

          <Text style={s.title}>Criar conta</Text>

          {error && <Text style={s.errorText}>{error}</Text>}

          <View style={s.card}>
            <Text style={s.label}>{t("email")}</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="exemplo@email.com"
              placeholderTextColor={COLORS.sub}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={s.label}>{t("password", { defaultValue: "Password" })}</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={COLORS.sub}
              secureTextEntry
              autoComplete="new-password"
            />

            <Text style={s.label}>Confirmar password</Text>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repetir password"
              placeholderTextColor={COLORS.sub}
              secureTextEntry
            />
          </View>

          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Criar conta</Text>
            }
          </Pressable>
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
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      marginBottom: 16,
    },
    label: { color: COLORS.sub, fontSize: 12, fontWeight: "900", marginBottom: 6, marginTop: 10 },
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
    btn: {
      backgroundColor: COLORS.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  });
