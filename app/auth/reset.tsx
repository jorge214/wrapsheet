// app/auth/reset.tsx
// Destino do link "Esqueci-me da palavra-passe" (web).
// O Supabase redireciona para cá com #access_token…type=recovery; o cliente
// (detectSessionInUrl) apanha o token e cria a sessão de recuperação — aqui
// o utilizador define a nova palavra-passe.
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function ResetPasswordScreen() {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();

  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Link expirado/inválido chega com #error=… em vez de token
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const h = window.location.hash || "";
      if (h.includes("error=")) { setReady("invalid"); return; }
    }
    let cancelled = false;
    // O detectSessionInUrl processa o hash de forma assíncrona — espera pela sessão
    const check = async () => {
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) { setReady("ok"); return; }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!cancelled) setReady("invalid");
    };
    check();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    if (password !== confirm) { setError(t("auth_password_mismatch")); return; }
    if (password.length < 6) { setError(t("auth_password_too_short")); return; }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => router.replace("/projects"), 1800);
  }

  const s = styles(COLORS, mode);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>{t("auth_forgot_title", { defaultValue: "Repor palavra-passe" })}</Text>

        {ready === "checking" && (
          <View style={{ paddingTop: 30, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.text} />
          </View>
        )}

        {ready === "invalid" && (
          <View style={s.card}>
            <Text style={[s.label, { fontSize: 15, color: COLORS.text }]}>
              {t("auth_reset_invalid", { defaultValue: "Link inválido ou expirado. Pede um novo email de recuperação." })}
            </Text>
            <Pressable style={[s.btn, { marginTop: 16 }]} onPress={() => router.replace("/auth/forgot")}>
              <Text style={s.btnText}>{t("auth_send_email", { defaultValue: "Enviar email" })}</Text>
            </Pressable>
          </View>
        )}

        {ready === "ok" && done && (
          <View style={s.card}>
            <Text style={[s.label, { fontSize: 15, color: "#137a3a" }]}>
              ✓ {t("auth_password_changed", { defaultValue: "Palavra-passe alterada com sucesso." })}
            </Text>
          </View>
        )}

        {ready === "ok" && !done && (
          <>
            {error && <Text style={s.errorText}>{error}</Text>}
            <View style={s.card}>
              <Text style={s.label}>{t("auth_new_password", { defaultValue: "Nova palavra-passe" })}</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t("auth_password_placeholder", { defaultValue: "Mínimo 6 caracteres" })}
                placeholderTextColor={COLORS.sub}
                secureTextEntry
                autoCapitalize="none"
              />
              <View style={{ height: 12 }} />
              <Text style={s.label}>{t("auth_confirm_new_password", { defaultValue: "Confirmar nova palavra-passe" })}</Text>
              <TextInput
                style={s.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder={t("auth_password_confirm_placeholder", { defaultValue: "Repetir palavra-passe" })}
                placeholderTextColor={COLORS.sub}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t("auth_save_password", { defaultValue: "Guardar nova palavra-passe" })}</Text>}
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
    content: { flex: 1, padding: 24, paddingTop: 40, maxWidth: 480, width: "100%", alignSelf: "center" },
    title: { fontSize: 28, fontWeight: "900", color: COLORS.text, marginBottom: 20 },
    errorText: { color: COLORS.danger, fontSize: 14, marginBottom: 12, fontWeight: "600" },
    card: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 16 },
    label: { color: COLORS.sub, fontSize: 12, fontWeight: "900", marginBottom: 6 },
    input: { backgroundColor: mode === "dark" ? COLORS.bg : "#E8EBF0", borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: COLORS.text },
    btn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
    btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  });
