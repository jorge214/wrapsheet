import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useIsWide } from "../../src/ui/useBreakpoint";

export default function AccountScreen() {
  const { COLORS, mode } = useTheme();
  const { user, signOut } = useAuth();
  const isWide = useIsWide();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const s = styles(COLORS, mode);

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ text: "A password deve ter pelo menos 6 caracteres.", ok: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "As passwords não coincidem.", ok: false });
      return;
    }
    setChangingPassword(true);
    setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      setPasswordMsg({ text: error.message, ok: false });
    } else {
      setPasswordMsg({ text: "Password alterada com sucesso.", ok: true });
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/auth/login");
  }

  function handleDeleteAccount() {
    if (Platform.OS === "web") {
      const ok = (window as any).confirm(
        "Apagar conta\nEsta ação é permanente. Todos os teus dados serão eliminados. Continuar?"
      );
      if (ok) doDeleteAccount();
      return;
    }
    Alert.alert(
      "Apagar conta",
      "Esta ação é permanente. Todos os teus dados serão eliminados. Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Apagar", style: "destructive", onPress: doDeleteAccount },
      ]
    );
  }

  async function doDeleteAccount() {
    const { error } = await supabase.rpc("delete_user");
    if (error) {
      Alert.alert("Erro", "Não foi possível apagar a conta. Contacta o suporte.");
      return;
    }
    await signOut();
    router.replace("/auth/login");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        {!isWide && (
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </Pressable>
        )}
        <Text style={s.headerTitle}>Conta</Text>
        {!isWide && <View style={{ width: 26 }} />}
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {/* Email */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>EMAIL</Text>
          <View style={s.row}>
            <Ionicons name="mail-outline" size={20} color={COLORS.sub} style={{ marginRight: 10 }} />
            <Text style={s.emailText}>{user?.email ?? "—"}</Text>
          </View>
        </View>

        {/* Subscrição */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>SUBSCRIÇÃO</Text>
          <View style={s.row}>
            <Ionicons name="star-outline" size={20} color={COLORS.sub} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Plano gratuito</Text>
              <Text style={s.rowSub}>WrapSheet Pro em breve</Text>
            </View>
            <Pressable
              onPress={() => router.push("/settings/plan")}
              style={({ pressed }) => [s.planBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={s.planBtnText}>Ver planos</Text>
            </Pressable>
          </View>
        </View>

        {/* Alterar password */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ALTERAR PASSWORD</Text>
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Nova password</Text>
            <TextInput
              style={s.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={COLORS.sub}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Confirmar nova password</Text>
            <TextInput
              style={s.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repetir password"
              placeholderTextColor={COLORS.sub}
              secureTextEntry
            />
          </View>
          {passwordMsg && (
            <Text style={[s.msg, { color: passwordMsg.ok ? COLORS.accent : COLORS.danger }]}>
              {passwordMsg.text}
            </Text>
          )}
          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }, changingPassword && { opacity: 0.6 }]}
            onPress={handleChangePassword}
            disabled={changingPassword}
          >
            {changingPassword
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Guardar nova password</Text>
            }
          </Pressable>
        </View>

        {/* Sair */}
        <Pressable
          style={({ pressed }) => [s.outlineBtn, { borderColor: COLORS.border }, pressed && { opacity: 0.8 }]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.text} style={{ marginRight: 8 }} />
          <Text style={[s.outlineBtnText, { color: COLORS.text }]}>
            {signingOut ? "A sair…" : "Terminar sessão"}
          </Text>
        </Pressable>

        {/* Zona de perigo */}
        <View style={[s.section, { borderColor: COLORS.danger + "40" }]}>
          <Text style={[s.sectionLabel, { color: COLORS.danger }]}>ZONA DE PERIGO</Text>
          <Pressable
            style={({ pressed }) => [s.dangerBtn, pressed && { opacity: 0.8 }]}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
            <Text style={[s.dangerBtnText, { color: COLORS.danger }]}>Apagar conta</Text>
          </Pressable>
        </View>

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
    headerTitle: { fontSize: 22, fontWeight: "700", color: COLORS.text },
    scroll: { padding: 16, gap: 16, paddingBottom: 40 },

    section: {
      backgroundColor: COLORS.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      gap: 12,
    },
    sectionLabel: { fontSize: 11, fontWeight: "700", color: COLORS.sub, letterSpacing: 0.8 },

    row: { flexDirection: "row", alignItems: "center" },
    emailText: { fontSize: 16, color: COLORS.text, flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
    rowSub: { fontSize: 13, color: COLORS.sub, marginTop: 2 },

    planBtn: {
      borderWidth: 1,
      borderColor: COLORS.accent,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    planBtnText: { color: COLORS.accent, fontWeight: "700", fontSize: 13 },

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
    msg: { fontSize: 13, fontWeight: "600" },
    btn: {
      backgroundColor: COLORS.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    btnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

    outlineBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 14,
      backgroundColor: "transparent",
    },
    outlineBtnText: { fontWeight: "700", fontSize: 15 },

    dangerBtn: { flexDirection: "row", alignItems: "center" },
    dangerBtnText: { fontWeight: "700", fontSize: 15 },
  });
