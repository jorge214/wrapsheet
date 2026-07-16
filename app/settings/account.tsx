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
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/auth/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function AccountScreen() {
  const { COLORS, mode } = useTheme();
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const s = styles(COLORS, mode);

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ text: t("auth_password_too_short"), ok: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: t("auth_password_mismatch"), ok: false });
      return;
    }
    setChangingPassword(true);
    setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      setPasswordMsg({ text: error.message, ok: false });
    } else {
      setPasswordMsg({ text: t("auth_password_changed"), ok: true });
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
      const ok = (window as any).confirm(`${t("auth_delete_account")}\n${t("auth_delete_account_confirm")}`);
      if (ok) doDeleteAccount();
      return;
    }
    Alert.alert(t("auth_delete_account"), t("auth_delete_account_confirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: doDeleteAccount },
    ]);
  }

  async function doDeleteAccount() {
    // A língua atual da app segue no pedido — o email de confirmação da
    // eliminação sai nessa língua (binários antigos sem este campo caem
    // na língua guardada nos metadados da conta).
    const { error } = await supabase.rpc("delete_user", { p_lang: i18n.language });
    if (error) {
      Alert.alert(t("error"), t("auth_delete_account_error"));
      return;
    }
    await signOut();
    router.replace("/auth/login");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={s.backLink}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
        </Pressable>
        <Text style={s.headerTitle}>{t("account_title")}</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {/* Email */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t("account_section_email")}</Text>
          <View style={s.row}>
            <Ionicons name="mail-outline" size={20} color={COLORS.sub} style={{ marginRight: 10 }} />
            <Text style={s.emailText}>{user?.email ?? "—"}</Text>
          </View>
        </View>

        {/* Subscrição */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t("account_section_subscription")}</Text>
          <View style={s.row}>
            <Ionicons name="star-outline" size={20} color={COLORS.sub} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{t("account_free_plan")}</Text>
              <Text style={s.rowSub}>{t("account_pro_soon")}</Text>
            </View>
            <Pressable
              onPress={() => router.push("/settings/plan")}
              style={({ pressed }) => [s.planBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={s.planBtnText}>{t("account_see_plans")}</Text>
            </Pressable>
          </View>
        </View>

        {/* Alterar password */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t("account_section_password")}</Text>
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>{t("auth_new_password")}</Text>
            <TextInput
              style={s.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={t("auth_password_placeholder")}
              placeholderTextColor={COLORS.sub}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>{t("auth_confirm_new_password")}</Text>
            <TextInput
              style={s.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t("auth_password_confirm_placeholder")}
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
              : <Text style={s.btnText}>{t("auth_save_password")}</Text>
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
            {signingOut ? t("auth_signing_out") : t("auth_sign_out")}
          </Text>
        </Pressable>

        {/* Zona de perigo */}
        <View style={[s.section, { borderColor: COLORS.danger + "40" }]}>
          <Text style={[s.sectionLabel, { color: COLORS.danger }]}>{t("account_section_danger")}</Text>
          <Pressable
            style={({ pressed }) => [s.dangerBtn, pressed && { opacity: 0.8 }]}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
            <Text style={[s.dangerBtnText, { color: COLORS.danger }]}>{t("auth_delete_account")}</Text>
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
    backLink: { color: COLORS.text, fontSize: 15, fontWeight: "800", width: 70, opacity: 0.9 },
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
