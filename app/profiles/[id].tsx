// app/profiles/[id].tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../src/auth/AuthContext";
import { syncProfileToCloud } from "../../src/sync/syncService";
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
import { getSettings } from "../../src/storage/appSettings";
import { getPreset } from "../../src/constants/countryPresets";
import { getStrings } from "../../src/export/buildPdfHtml";
import i18n from "../../src/i18n/i18n";
import { useTheme } from "../../src/theme/ThemeProvider";

function ProfileField({
  label,
  value,
  editing,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
  hint,
  COLORS,
  styles,
}: {
  label: string;
  value?: string;
  editing: boolean;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  hint?: string;
  COLORS: any;
  styles: any;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {editing ? (
        <TextInput
          value={value ?? ""}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.sub}
          style={[styles.fieldInput, multiline && { minHeight: 90, textAlignVertical: "top" }]}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
        />
      ) : (
        <Text style={styles.fieldValue}>{value || "—"}</Text>
      )}
    </View>
  );
}

function NumField({
  label,
  value,
  editing,
  onChange,
  unit,
  COLORS,
  styles,
}: {
  label: string;
  value?: number;
  editing: boolean;
  onChange: (n: number | undefined) => void;
  unit?: string;
  COLORS: any;
  styles: any;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <TextInput
          value={value != null ? String(value) : ""}
          onChangeText={(v) => onChange(v.trim() === "" ? undefined : Number(v.replace(",", ".")) || 0)}
          placeholder="0"
          placeholderTextColor={COLORS.sub}
          style={styles.fieldInput}
          keyboardType="numeric"
        />
      ) : (
        <Text style={styles.fieldValue}>{value != null ? `${value}${unit ? " " + unit : ""}` : "—"}</Text>
      )}
    </View>
  );
}

export default function ProfileEditScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { t } = useTranslation();
  const { COLORS, mode } = useTheme();
  const { user } = useAuth();
  const s = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);

  const [p, setP] = useState<Profile | null>(null);
  const [original, setOriginal] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(edit === "1");
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState<{ IRS_percent: number; IVA_percent: number }>({ IRS_percent: 0, IVA_percent: 0 });

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        const pr: any = getPreset((s as any).region);
        setPreset({
          IRS_percent: Number(pr?.fiscal?.IRS_percent ?? 0),
          IVA_percent: Number(pr?.fiscal?.IVA_percent ?? 0),
        });
      } catch {}
    })();
  }, []);

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
      setOriginal(loaded);
    })();
  }, [id, t]);

  function handleEdit() {
    setEditing(true);
  }

  function handleCancel() {
    const isDirty = JSON.stringify(p) !== JSON.stringify(original);
    if (!isDirty) {
      setP(original);
      setEditing(false);
      return;
    }
    if (Platform.OS === "web") {
      const ok = (window as any).confirm(
        t("discard_changes_confirm", { defaultValue: "Descartar alterações? As tuas alterações não serão guardadas." })
      );
      if (ok) { setP(original); setEditing(false); }
    } else {
      Alert.alert(
        t("discard_changes", { defaultValue: "Descartar alterações?" }),
        t("discard_changes_confirm", { defaultValue: "As tuas alterações não serão guardadas." }),
        [
          { text: t("cancel", { defaultValue: "Cancelar" }), style: "cancel" },
          { text: t("discard", { defaultValue: "Descartar" }), style: "destructive", onPress: () => { setP(original); setEditing(false); } },
        ]
      );
    }
  }

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
      const updated = { ...p, nome };
      await upsertProfile(updated);
      await setActiveProfileId(p.id);
      if (user) syncProfileToCloud(user.id, updated);
      setOriginal(updated);
      setEditing(false);
    } catch (e) {
      console.error("Erro ao guardar perfil", e);
      Alert.alert(
        t("error", { defaultValue: "Erro" }),
        t("save_error", { defaultValue: "Não foi possível guardar. Tenta novamente." })
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

  const gs = getStrings(i18n.language);
  const fixas = p.fixas ?? {};
  const setFixas = (patch: Partial<NonNullable<Profile["fixas"]>>) =>
    setP({ ...p, fixas: { ...fixas, ...patch } });
  const fiscalV = p.fiscal ?? {};
  const setFiscal = (patch: Partial<NonNullable<Profile["fiscal"]>>) =>
    setP({ ...p, fiscal: { ...fiscalV, ...patch } });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        <Pressable onPress={editing ? handleCancel : () => router.back()} hitSlop={8}>
          <Text style={s.backLink}>
            ‹ {editing ? t("cancel", { defaultValue: "Cancelar" }) : t("back", { defaultValue: "Voltar" })}
          </Text>
        </Pressable>

        <Text style={s.headerTitle}>
          {t("profile", { defaultValue: "Perfil" })}
        </Text>

        {editing ? (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [s.actionBtn, pressed && !saving && { opacity: 0.85 }, saving && { opacity: 0.5 }]}
            hitSlop={8}
          >
            <Text style={s.actionBtnText}>
              {saving ? t("saving", { defaultValue: "A guardar…" }) : t("save", { defaultValue: "Guardar" })}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.85 }]}
            hitSlop={8}
          >
            <Text style={s.actionBtnText}>
              {t("edit", { defaultValue: "Editar" })}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <ProfileField label={t("name", { defaultValue: "Nome" })} value={p.nome} editing={editing} onChangeText={(v) => setP({ ...p, nome: v })} placeholder={t("name_placeholder", { defaultValue: "Ex: João Costa" })} autoCapitalize="words" COLORS={COLORS} styles={s} />
          <ProfileField label={t("email", { defaultValue: "Email" })} value={p.email} editing={editing} onChangeText={(v) => setP({ ...p, email: v })} placeholder={t("email_placeholder")} keyboardType="email-address" autoCapitalize="none" COLORS={COLORS} styles={s} />
          <ProfileField label={t("phone", { defaultValue: "Telefone" })} value={p.telefone} editing={editing} onChangeText={(v) => setP({ ...p, telefone: v })} placeholder={t("phone_placeholder", { defaultValue: "Ex: 912345678" })} keyboardType="phone-pad" autoCapitalize="none" COLORS={COLORS} styles={s} />
          <ProfileField label={t("department", { defaultValue: "Departamento" })} value={p.departamento} editing={editing} onChangeText={(v) => setP({ ...p, departamento: v })} placeholder={t("department_placeholder", { defaultValue: "Ex: Suporte" })} autoCapitalize="words" COLORS={COLORS} styles={s} />
          <ProfileField label={t("role", { defaultValue: "Função" })} value={p.funcao} editing={editing} onChangeText={(v) => setP({ ...p, funcao: v })} placeholder={t("role_placeholder", { defaultValue: "Ex: Técnico" })} autoCapitalize="words" COLORS={COLORS} styles={s} />
          <ProfileField label={t("company", { defaultValue: "Empresa" })} value={p.empresa} editing={editing} onChangeText={(v) => setP({ ...p, empresa: v })} placeholder={t("company_placeholder", { defaultValue: "Ex: ItsAWrap" })} autoCapitalize="words" COLORS={COLORS} styles={s} />
          <ProfileField label={t("nif", { defaultValue: "NIF" })} value={p.nif} editing={editing} onChangeText={(v) => setP({ ...p, nif: v })} placeholder={t("nif_placeholder")} keyboardType="number-pad" autoCapitalize="none" COLORS={COLORS} styles={s} />
          <ProfileField label={t("iban", { defaultValue: "IBAN" })} value={p.iban} editing={editing} onChangeText={(v) => setP({ ...p, iban: v })} placeholder={t("iban_placeholder")} autoCapitalize="characters" COLORS={COLORS} styles={s} />
          <ProfileField label={t("swift", { defaultValue: "SWIFT / BIC" })} value={p.swift} editing={editing} onChangeText={(v) => setP({ ...p, swift: v })} placeholder={t("swift_placeholder")} autoCapitalize="characters" COLORS={COLORS} styles={s} />
        </View>

        {/* Condições fixas (a linha de taxas): aplicadas a projetos novos */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>
            {t("fixed_conditions", { defaultValue: "Condições fixas (taxas)" })}
          </Text>
          <Text style={s.fieldHint}>
            {t("fixed_conditions_hint", { defaultValue: "Aplicam-se automaticamente a projetos novos. Podes editá-las por projeto." })}
          </Text>
          <NumField label={gs.salary} unit="€" value={fixas.salarioDia} editing={editing} onChange={(n) => setFixas({ salarioDia: n })} COLORS={COLORS} styles={s} />
          <NumField label={`HEA · ${gs.overtimeA} (€/h)`} value={fixas.rateHEA} editing={editing} onChange={(n) => setFixas({ rateHEA: n })} COLORS={COLORS} styles={s} />
          <NumField label={`HEB · ${gs.overtimeB} (€/h)`} value={fixas.rateHEB} editing={editing} onChange={(n) => setFixas({ rateHEB: n })} COLORS={COLORS} styles={s} />
          <NumField label={`HR · ${gs.recoveryHours} (€/h)`} value={fixas.rateHR} editing={editing} onChange={(n) => setFixas({ rateHR: n })} COLORS={COLORS} styles={s} />
          <NumField label={`${gs.meal} (€)`} value={fixas.refeicao} editing={editing} onChange={(n) => setFixas({ refeicao: n })} COLORS={COLORS} styles={s} />
          <NumField label={`${gs.telephone} (€)`} value={fixas.telefone} editing={editing} onChange={(n) => setFixas({ telefone: n })} COLORS={COLORS} styles={s} />
          <NumField label={`${gs.vehicle} (€)`} value={fixas.viatura} editing={editing} onChange={(n) => setFixas({ viatura: n })} COLORS={COLORS} styles={s} />
          <NumField label={`${gs.material} (€)`} value={fixas.material} editing={editing} onChange={(n) => setFixas({ material: n })} COLORS={COLORS} styles={s} />
          <NumField label={`${gs.perDiem} (€)`} value={fixas.perDiem} editing={editing} onChange={(n) => setFixas({ perDiem: n })} COLORS={COLORS} styles={s} />
        </View>

        {/* Regime Fiscal (movido de Definições) — percentagens editáveis, incl. 0% */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>
            {t("tax_regime", { defaultValue: "Regime Fiscal" })}
          </Text>
          <Text style={s.fieldHint}>
            {t("tax_regime_hint", { defaultValue: "Percentagens aplicadas aos valores. Deixa a 0% se não aplicável (ex.: empresa unipessoal). Predefinição pelo país em Definições › Região." })}
          </Text>
          <NumField label={t("irs", { defaultValue: "IRS" })} unit="%" value={fiscalV.IRS_percent ?? preset.IRS_percent} editing={editing} onChange={(n) => setFiscal({ IRS_percent: n ?? 0 })} COLORS={COLORS} styles={s} />
          <NumField label={t("iva", { defaultValue: "IVA" })} unit="%" value={fiscalV.IVA_percent ?? preset.IVA_percent} editing={editing} onChange={(n) => setFiscal({ IVA_percent: n ?? 0 })} COLORS={COLORS} styles={s} />
        </View>

        {/* Regras de horas extra + Condições de trabalho (última secção) */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>
            {t("overtime_rules_title", { defaultValue: "Regras de horas extra" })}
          </Text>
          <Text style={s.fieldHint}>
            {t("overtime_rules_hint", { defaultValue: "A partir de que hora se cobra cada coisa. Predefinição igual ao PDF." })}
          </Text>
          <NumField label={t("cond_base_hours", { defaultValue: "Horário Base" })} value={fixas.hDia} editing={editing} onChange={(n) => setFixas({ hDia: n })} COLORS={COLORS} styles={s} />
          <NumField label={t("cond_hea_from_hour", { defaultValue: "HE-A a partir do início da hora" })} value={fixas.heaFromHour} editing={editing} onChange={(n) => setFixas({ heaFromHour: n })} COLORS={COLORS} styles={s} />
          <NumField label={t("cond_heb_from_hour", { defaultValue: "HE-B a partir do início da hora" })} value={fixas.hebFromHour} editing={editing} onChange={(n) => setFixas({ hebFromHour: n })} COLORS={COLORS} styles={s} />
          <NumField label={t("cond_hr_rest_below", { defaultValue: "HR — se descanso inferior a (h)" })} value={fixas.hrRestBelow} editing={editing} onChange={(n) => setFixas({ hrRestBelow: n })} COLORS={COLORS} styles={s} />

          <View style={{ height: 8 }} />
          <ProfileField
            label={t("conditions_profile", { defaultValue: "Condições de trabalho (predefinição)" })}
            hint={t("conditions_profile_hint", { defaultValue: "Aplicam-se automaticamente a cada projeto novo. Podes editá-las por projeto." })}
            value={p.condicoes}
            editing={editing}
            onChangeText={(v) => setP({ ...p, condicoes: v })}
            placeholder={t("conditions_pdf_placeholder")}
            autoCapitalize="sentences"
            multiline
            COLORS={COLORS}
            styles={s}
          />
        </View>

        {!editing && (
          <Pressable onPress={handleDelete} style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.85 }]}>
            <Text style={s.deleteBtnText}>
              {t("delete_profile", { defaultValue: "Apagar perfil" })}
            </Text>
          </Pressable>
        )}

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

    actionBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: "transparent",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      minWidth: 80,
      alignItems: "center",
    },
    actionBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 13 },

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
    fieldHint: { color: COLORS.sub, fontSize: 11, marginBottom: 6, fontStyle: "italic" },
    fieldValue: {
      fontSize: 16,
      color: COLORS.text,
      paddingVertical: 4,
    },
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
