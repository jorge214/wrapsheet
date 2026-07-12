// app/profiles/[id].tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../src/auth/AuthContext";
import { deleteProfileFromCloud, syncProfileToCloud } from "../../src/sync/syncService";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import {
  CondBox,
  Profile,
  defaultCondBoxes,
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
  const [savedToast, setSavedToast] = useState(false);
  const [preset, setPreset] = useState<{ IRS_percent: number; IVA_percent: number; taxIncome: string; taxVat: string; sym: string }>({
    IRS_percent: 0, IVA_percent: 0, taxIncome: "IRS", taxVat: "IVA", sym: "€",
  });

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        const pr: any = getPreset((s as any).region);
        setPreset({
          IRS_percent: Number(pr?.fiscal?.IRS_percent ?? 0),
          IVA_percent: Number(pr?.fiscal?.IVA_percent ?? 0),
          // Nomes dos impostos e moeda seguem a REGIÃO FISCAL, não a língua
          taxIncome: pr?.taxLabels?.incomeTax ?? "IRS",
          taxVat: pr?.taxLabels?.vat ?? "IVA",
          sym: pr?.currencySymbol ?? "€",
        });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      let loaded = id ? await getProfileById(id) : null;
      if (!loaded) {
        Alert.alert(
          t("oops", { defaultValue: "Ops" }),
          t("profile_not_found", { defaultValue: "Perfil não encontrado" })
        );
        router.replace("/profiles");
        return;
      }
      // Migração suave: texto corrido antigo → uma caixa (editável a partir daí)
      if (!Array.isArray(loaded.condBoxes) && (loaded.condicoes || "").trim()) {
        loaded = { ...loaded, condBoxes: [{ titulo: "", texto: loaded.condicoes || "" }] };
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
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2400);
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
        if (user) await deleteProfileFromCloud(user.id, p.id);
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
            if (user) await deleteProfileFromCloud(user.id, p.id);
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

  // ── Condições de trabalho em caixas ──
  const boxes: CondBox[] = p.condBoxes ?? [];
  const setBoxes = (next: CondBox[]) => setP({ ...p, condBoxes: next });
  const setBox = (i: number, patch: Partial<CondBox>) =>
    setBoxes(boxes.map((b, ix) => (ix === i ? { ...b, ...patch } : b)));
  const addBox = () => setBoxes([...boxes, { titulo: "", texto: "" }]);
  const removeBox = (i: number) => setBoxes(boxes.filter((_, ix) => ix !== i));
  const moveBox = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= boxes.length) return;
    const next = [...boxes];
    [next[i], next[j]] = [next[j], next[i]];
    setBoxes(next);
  };

  function resetCondDefaults() {
    const doReset = () => setBoxes(defaultCondBoxes());
    const title = t("reset_cond_default", { defaultValue: "Repor modelo (PDF)" });
    const msg = t("reset_cond_confirm", { defaultValue: "Substituir as caixas atuais pelas condições do modelo de referência?" });
    if (Platform.OS === "web") {
      if ((window as any).confirm(`${title}\n\n${msg}`)) doReset();
      return;
    }
    Alert.alert(title, msg, [
      { text: t("cancel", { defaultValue: "Cancelar" }), style: "cancel" },
      { text: t("confirm", { defaultValue: "Confirmar" }), onPress: doReset },
    ]);
  }

  async function pickBoxImage(i: number) {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.5,
        allowsMultipleSelection: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      let uri = a.base64
        ? `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`
        : a.uri;
      // Na web pode vir um blob: — converte para data URI para persistir
      if (uri.startsWith("blob:")) {
        const blob = await (await fetch(uri)).blob();
        uri = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
      }
      if (uri.length > 1_800_000) {
        Alert.alert(
          t("image_too_big", { defaultValue: "Imagem demasiado grande" }),
          t("image_too_big_msg", { defaultValue: "Escolhe uma imagem mais pequena (máx. ~1,3 MB)." })
        );
        if (Platform.OS === "web") (window as any).alert(t("image_too_big_msg", { defaultValue: "Escolhe uma imagem mais pequena (máx. ~1,3 MB)." }));
        return;
      }
      setBox(i, { img: uri });
    } catch (e) {
      console.error("Erro ao escolher imagem", e);
    }
  }

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
          <NumField label={gs.salary} unit={preset.sym} value={fixas.salarioDia} editing={editing} onChange={(n) => setFixas({ salarioDia: n })} COLORS={COLORS} styles={s} />
          <NumField label={`HEA · ${gs.overtimeA} (${preset.sym}/h)`} value={fixas.rateHEA} editing={editing} onChange={(n) => setFixas({ rateHEA: n })} COLORS={COLORS} styles={s} />
          <NumField label={`HEB · ${gs.overtimeB} (${preset.sym}/h)`} value={fixas.rateHEB} editing={editing} onChange={(n) => setFixas({ rateHEB: n })} COLORS={COLORS} styles={s} />
          <NumField label={`HR · ${gs.recoveryHours} (${preset.sym}/h)`} value={fixas.rateHR} editing={editing} onChange={(n) => setFixas({ rateHR: n })} COLORS={COLORS} styles={s} />
          <NumField label={`${gs.meal} (${preset.sym})`} value={fixas.refeicao} editing={editing} onChange={(n) => setFixas({ refeicao: n })} COLORS={COLORS} styles={s} />
          <NumField label={`${gs.telephone} (${preset.sym})`} value={fixas.telefone} editing={editing} onChange={(n) => setFixas({ telefone: n })} COLORS={COLORS} styles={s} />
          <NumField label={`${gs.vehicle} (${preset.sym})`} value={fixas.viatura} editing={editing} onChange={(n) => setFixas({ viatura: n })} COLORS={COLORS} styles={s} />
          <NumField label={`${gs.material} (${preset.sym})`} value={fixas.material} editing={editing} onChange={(n) => setFixas({ material: n })} COLORS={COLORS} styles={s} />
          <NumField label={`${gs.perDiem} (${preset.sym})`} value={fixas.perDiem} editing={editing} onChange={(n) => setFixas({ perDiem: n })} COLORS={COLORS} styles={s} />
        </View>

        {/* Regime Fiscal (movido de Definições) — percentagens editáveis, incl. 0% */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>
            {t("tax_regime", { defaultValue: "Regime Fiscal" })}
          </Text>
          <Text style={s.fieldHint}>
            {t("tax_regime_hint", { defaultValue: "Percentagens aplicadas aos valores. Deixa a 0% se não aplicável (ex.: empresa unipessoal). Predefinição pelo país em Definições › Região." })}
          </Text>
          <NumField label={preset.taxIncome} unit="%" value={fiscalV.IRS_percent ?? preset.IRS_percent} editing={editing} onChange={(n) => setFiscal({ IRS_percent: n ?? 0 })} COLORS={COLORS} styles={s} />
          <NumField label={preset.taxVat} unit="%" value={fiscalV.IVA_percent ?? preset.IVA_percent} editing={editing} onChange={(n) => setFiscal({ IVA_percent: n ?? 0 })} COLORS={COLORS} styles={s} />
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
          <Text style={s.fieldLabel}>
            {t("conditions_profile", { defaultValue: "Condições de trabalho (predefinição)" })}
          </Text>
          <Text style={s.fieldHint}>
            {t("cond_boxes_hint", { defaultValue: "Caixas com título e texto (e imagem opcional) que saem na folha/PDF. Aplicam-se a projetos novos." })}
          </Text>

          <ProfileField
            label={t("cond_annual_title", { defaultValue: "Título da secção (anual)" })}
            hint={t("cond_annual_title_hint", { defaultValue: "Ex.: CONDIÇÕES DE TRABALHO - NOME - A partir de 1 de Janeiro de 2026" })}
            value={p.condTitulo}
            editing={editing}
            onChangeText={(v) => setP({ ...p, condTitulo: v })}
            placeholder={t("cond_annual_title_ph", { defaultValue: "CONDIÇÕES DE TRABALHO …" })}
            autoCapitalize="characters"
            COLORS={COLORS}
            styles={s}
          />

          {boxes.map((b, i) => (
            <View key={i} style={s.condBox}>
              {editing ? (
                <>
                  <View style={s.condBoxHeader}>
                    <TextInput
                      value={b.titulo}
                      onChangeText={(v) => setBox(i, { titulo: v })}
                      placeholder={t("box_title_ph", { defaultValue: "TÍTULO (ex.: HORA EXTRA A)" })}
                      placeholderTextColor={COLORS.sub}
                      style={[s.fieldInput, { flex: 1, fontWeight: "800" }]}
                      autoCapitalize="characters"
                    />
                    <Pressable onPress={() => moveBox(i, -1)} hitSlop={6} style={s.condMiniBtn}>
                      <Text style={s.condMiniBtnText}>↑</Text>
                    </Pressable>
                    <Pressable onPress={() => moveBox(i, 1)} hitSlop={6} style={s.condMiniBtn}>
                      <Text style={s.condMiniBtnText}>↓</Text>
                    </Pressable>
                    <Pressable onPress={() => removeBox(i)} hitSlop={6} style={[s.condMiniBtn, { borderColor: COLORS.danger }]}>
                      <Text style={[s.condMiniBtnText, { color: COLORS.danger }]}>✕</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={b.texto}
                    onChangeText={(v) => setBox(i, { texto: v })}
                    placeholder={t("box_text_ph", { defaultValue: "Texto da condição…" })}
                    placeholderTextColor={COLORS.sub}
                    style={[s.fieldInput, { minHeight: 80, textAlignVertical: "top", marginTop: 8 }]}
                    multiline
                  />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                    {b.img ? (
                      <>
                        <Image source={{ uri: b.img }} style={s.condImg} resizeMode="cover" />
                        <Pressable onPress={() => setBox(i, { img: undefined })} style={s.condImgBtn}>
                          <Text style={s.condImgBtnText}>
                            ✕ {t("remove_image", { defaultValue: "Remover imagem" })}
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable onPress={() => pickBoxImage(i)} style={s.condImgBtn}>
                        <Text style={s.condImgBtnText}>
                          🖼 {t("add_image", { defaultValue: "Adicionar imagem" })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              ) : (
                <>
                  {b.titulo ? <Text style={s.condBoxTitle}>{b.titulo}</Text> : null}
                  {b.texto ? <Text style={s.condBoxText}>{b.texto}</Text> : null}
                  {b.img ? <Image source={{ uri: b.img }} style={[s.condImg, { marginTop: 6 }]} resizeMode="contain" /> : null}
                </>
              )}
            </View>
          ))}

          {editing && (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <Pressable onPress={addBox} style={s.condAddBtn}>
                <Text style={s.condAddBtnText}>＋ {t("add_box", { defaultValue: "Adicionar caixa" })}</Text>
              </Pressable>
              <Pressable onPress={resetCondDefaults} style={s.condAddBtn}>
                <Text style={s.condAddBtnText}>↺ {t("reset_cond_default", { defaultValue: "Repor modelo (PDF)" })}</Text>
              </Pressable>
            </View>
          )}
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

      {savedToast && (
        <View style={s.savedToast} pointerEvents="none">
          <Text style={s.savedToastText}>✓ {t("saved", { defaultValue: "Guardado" })}</Text>
        </View>
      )}
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

    /* Caixas de condições de trabalho */
    condBox: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 12,
      padding: 10,
      marginTop: 10,
      backgroundColor: mode === "dark" ? COLORS.bg : "#FAFBFC",
    },
    condBoxHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    condBoxTitle: { color: COLORS.text, fontWeight: "900", fontSize: 13, textTransform: "uppercase" },
    condBoxText: { color: COLORS.text, fontSize: 13, marginTop: 4, lineHeight: 19 },
    condMiniBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.card,
      ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
    },
    condMiniBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
    condImg: { width: 120, height: 84, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
    condImgBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: COLORS.card,
      ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
    },
    condImgBtnText: { color: COLORS.text, fontWeight: "800", fontSize: 12 },
    condAddBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: COLORS.card,
      ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
    },
    condAddBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 13 },

    savedToast: {
      position: "absolute",
      bottom: 28,
      left: 16,
      right: 16,
      backgroundColor: "#137a3a",
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    savedToastText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  });
