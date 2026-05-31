// app/profiles/[id].tsx
import { router, useLocalSearchParams } from "expo-router";
import { useIsWide } from "../../src/ui/useBreakpoint";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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

import {
  Profile,
  deleteProfile,
  getProfileById,
  setActiveProfileId,
  upsertProfile,
} from "../../src/storage/profile";
import { useTheme } from "../../src/theme/ThemeProvider";

/** ✅ FORA do screen (não remonta a cada render) */
function ProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  COLORS,
  styles,
}: {
  label: string;
  value?: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  COLORS: any;
  styles: any;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value ?? ""}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.sub}
        style={styles.fieldInput}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

export default function ProfileEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { COLORS, mode } = useTheme();
  const isWide = useIsWide();
  const s = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);

  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const loaded = id ? await getProfileById(id) : null;
      if (!loaded) {
        Alert.alert(
          t("oops", { defaultValue: "Ops" }),
          t("profile_not_found", { defaultValue: "Perfil não encontrado" })
        );
        router.replace("/profiles");
        return;
      }
      setP(loaded);
    })();
  }, [id, t]);

  async function handleSave() {
    if (!p || saving) return;

    const nome = (p.nome || "").trim();
    if (!nome) {
      Alert.alert(
        t("invalid_name", { defaultValue: "Nome inválido" }),
        t("invalid_name_msg", { defaultValue: "O nome não pode estar vazio." })
      );
      return;
    }

    setSaving(true);
    try {
      await upsertProfile({ ...p, nome });
      await setActiveProfileId(p.id);
      router.back();
    } catch (e) {
      console.error("Erro ao guardar perfil", e);
      Alert.alert(
        t("error", { defaultValue: "Erro" }),
        t("save_error", {
          defaultValue: "Não foi possível guardar. Tenta novamente.",
        })
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!p) return;

    if (Platform.OS === "web") {
      const ok = (window as any).confirm(
        `${t("delete", { defaultValue: "Apagar" })}\n${t("delete_profile_confirm", { defaultValue: "Queres mesmo apagar este perfil?" })}`
      );
      if (ok) {
        await deleteProfile(p.id);
        router.replace("/profiles");
      }
      return;
    }

    Alert.alert(
      t("delete", { defaultValue: "Apagar" }),
      t("delete_profile_confirm", { defaultValue: "Queres mesmo apagar este perfil?" }),
      [
        { text: t("cancel", { defaultValue: "Cancelar" }), style: "cancel" },
        {
          text: t("delete", { defaultValue: "Apagar" }),
          style: "destructive",
          onPress: async () => {
            await deleteProfile(p.id);
            router.replace("/profiles");
          },
        },
      ]
    );
  }

  if (!p) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        {!isWide && (
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.backLink}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
          </Pressable>
        )}

        <Text style={s.headerTitle}>
          {t("profile", { defaultValue: "Perfil" })}
        </Text>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            s.saveBtn,
            pressed && !saving && { opacity: 0.85 },
            saving && { opacity: 0.5 },
          ]}
          hitSlop={8}
        >
          <Text style={s.saveBtnText}>
            {saving
              ? t("saving", { defaultValue: "A guardar…" })
              : t("save", { defaultValue: "Guardar" })}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <ProfileField
            label={t("name", { defaultValue: "Nome" })}
            value={p.nome}
            onChangeText={(v) => setP({ ...p, nome: v })}
            placeholder={t("name_placeholder", { defaultValue: "Ex: João Costa" })}
            autoCapitalize="words"
            COLORS={COLORS}
            styles={s}
          />

          <ProfileField
            label={t("email", { defaultValue: "Email" })}
            value={p.email}
            onChangeText={(v) => setP({ ...p, email: v })}
            placeholder={t("email_placeholder")}
            keyboardType="email-address"
            autoCapitalize="none"
            COLORS={COLORS}
            styles={s}
          />

          <ProfileField
            label={t("phone", { defaultValue: "Telefone" })}
            value={p.telefone}
            onChangeText={(v) => setP({ ...p, telefone: v })}
            placeholder={t("phone_placeholder", { defaultValue: "Ex: 912345678" })}
            keyboardType="phone-pad"
            autoCapitalize="none"
            COLORS={COLORS}
            styles={s}
          />

          <ProfileField
            label={t("department", { defaultValue: "Departamento" })}
            value={p.departamento}
            onChangeText={(v) => setP({ ...p, departamento: v })}
            placeholder={t("department_placeholder", { defaultValue: "Ex: Suporte" })}
            autoCapitalize="words"
            COLORS={COLORS}
            styles={s}
          />

          <ProfileField
            label={t("role", { defaultValue: "Função" })}
            value={p.funcao}
            onChangeText={(v) => setP({ ...p, funcao: v })}
            placeholder={t("role_placeholder", { defaultValue: "Ex: Técnico" })}
            autoCapitalize="words"
            COLORS={COLORS}
            styles={s}
          />

          <ProfileField
            label={t("company", { defaultValue: "Empresa" })}
            value={p.empresa}
            onChangeText={(v) => setP({ ...p, empresa: v })}
            placeholder={t("company_placeholder", { defaultValue: "Ex: ItsAWrap" })}
            autoCapitalize="words"
            COLORS={COLORS}
            styles={s}
          />

          <ProfileField
            label={t("nif", { defaultValue: "NIF" })}
            value={p.nif}
            onChangeText={(v) => setP({ ...p, nif: v })}
            placeholder={t("nif_placeholder")}
            keyboardType="number-pad"
            autoCapitalize="none"
            COLORS={COLORS}
            styles={s}
          />

          <ProfileField
            label={t("iban", { defaultValue: "IBAN" })}
            value={p.iban}
            onChangeText={(v) => setP({ ...p, iban: v })}
            placeholder={t("iban_placeholder")}
            autoCapitalize="characters"
            COLORS={COLORS}
            styles={s}
          />

          <ProfileField
            label={t("swift", { defaultValue: "SWIFT" })}
            value={p.swift}
            onChangeText={(v) => setP({ ...p, swift: v })}
            placeholder={t("swift_placeholder")}
            autoCapitalize="characters"
            COLORS={COLORS}
            styles={s}
          />
        </View>

        <Pressable onPress={handleDelete} style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.85 }]}>
          <Text style={s.deleteBtnText}>
            {t("delete_profile", { defaultValue: "Apagar perfil" })}
          </Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backLink: { color: COLORS.text, fontSize: 15, fontWeight: "800", width: 80 },
    headerTitle: { color: COLORS.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.2 },

    saveBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: "transparent",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      minWidth: 96,
      alignItems: "center",
    },
    saveBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 13 },

    scrollContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 280, gap: 12 },
    card: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 16,
      padding: 14,
      shadowColor: COLORS.shadow,
      shadowOpacity: mode === "dark" ? 0.28 : 0.12,
      shadowRadius: 6,
    },

    fieldWrapper: { marginBottom: 10 },
    fieldLabel: { color: COLORS.sub, fontSize: 12, fontWeight: "900", marginBottom: 6 },
    fieldInput: {
      backgroundColor: mode === "dark" ? COLORS.bg : "#E8EBF0",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: COLORS.text,
    },

    deleteBtn: {
      alignSelf: "flex-start",
      borderWidth: 1.5,
      borderColor: COLORS.danger,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: "transparent",
    },
    deleteBtnText: { color: COLORS.danger, fontWeight: "900", fontSize: 13 },
  });
