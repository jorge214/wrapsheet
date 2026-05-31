import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function ForgotScreen() {
  const { COLORS, mode } = useTheme();
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const err = await resetPassword(email.trim());
    setLoading(false);
    if (err) setError(err);
    else setSent(true);
  }

  const s = styles(COLORS, mode);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.content}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>‹ Entrar</Text>
        </Pressable>

        <Text style={s.title}>Recuperar password</Text>

        {sent ? (
          <View style={s.card}>
            <Text style={[s.label, { color: COLORS.text, fontSize: 15 }]}>
              Email enviado! Verifica a tua caixa de entrada para redefinir a password.
            </Text>
          </View>
        ) : (
          <>
            {error && <Text style={s.errorText}>{error}</Text>}
            <View style={s.card}>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="exemplo@email.com"
                placeholderTextColor={COLORS.sub}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Enviar email</Text>
              }
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    content: { flex: 1, padding: 24, paddingTop: 24 },
    back: { marginBottom: 32 },
    backText: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
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
    label: { color: COLORS.sub, fontSize: 12, fontWeight: "900", marginBottom: 6 },
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
