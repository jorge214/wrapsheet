// app/profiles/[id].tsx
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../src/auth/AuthContext";
import { deleteProfileFromCloud, syncProfileToCloud } from "../../src/sync/syncService";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  Keyboard,
  Modal,
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
import { clearNavGuard, setNavGuard } from "../../src/ui/navGuard";

import {
  CondBox,
  Profile,
  defaultCondBoxes,
  defaultCondBoxesCinema,
  deleteProfile,
  getProfileById,
  setActiveProfileId,
  upsertProfile,
} from "../../src/storage/profile";
import {
  backfillProfileIds,
  listArchivedProjects,
  listProjects,
} from "../../src/storage/projects";
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

// Campo multi-linha que CRESCE com o conteúdo, sem scroll interno.
// No telemóvel/iPad o input nativo já se ajusta sozinho; na web o <textarea>
// tinha altura fixa e obrigava a fazer scroll enquanto se escrevia.
function AutoGrowTextInput({ style, minHeight = 80, ...props }: any) {
  const [h, setH] = React.useState(0);
  return (
    <TextInput
      {...props}
      multiline
      // scrollEnabled fica LIGADO (default): com ele desligado + altura fixa,
      // o contentSize.height passava a reportar a moldura e não o texto, e a
      // altura crescia sem parar (gigante no telemóvel, +altura a cada letra
      // no PC). Agora a altura = altura real do conteúdo, sem somar padding.
      onContentSizeChange={(e: any) => setH(e?.nativeEvent?.contentSize?.height ?? 0)}
      style={[style, { textAlignVertical: "top", minHeight, height: Math.max(minHeight, h) }]}
    />
  );
}

function NumField({
  label,
  value,
  editing,
  onChange,
  unit,
  placeholder,
  COLORS,
  styles,
}: {
  label: string;
  value?: number;
  editing: boolean;
  onChange: (n: number | undefined) => void;
  unit?: string;
  placeholder?: string;
  COLORS: any;
  styles: any;
}) {
  // Buffer de texto enquanto se escreve: sem ele, "23," era normalizado para
  // "23" a cada tecla e nunca dava para escrever decimais (ex.: IVA 23,2).
  const [txt, setTxt] = React.useState<string | null>(null);
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <TextInput
          value={txt ?? (value != null ? String(value).replace(".", ",") : "")}
          onChangeText={(v) => {
            setTxt(v);
            onChange(v.trim() === "" ? undefined : Number(v.replace(",", ".")) || 0);
          }}
          onBlur={() => setTxt(null)}
          placeholder={placeholder ?? "0"}
          placeholderTextColor={COLORS.sub}
          style={styles.fieldInput}
          keyboardType="decimal-pad"
        />
      ) : (
        <Text style={styles.fieldValue}>{value != null ? `${value}${unit ? " " + unit : ""}` : "—"}</Text>
      )}
    </View>
  );
}

/**
 * Editor das condições de trabalho (caixas com título, texto e imagem) que
 * saem na folha/PDF. Existe DUAS vezes no perfil — uma para publicidade e
 * outra para cinema — porque as regras da semana não são as do dia; cada
 * projeto novo leva as do seu formato. Era código inline; passou a componente
 * para não haver duas cópias a divergir.
 */
function CondSection({
  mainTitle, hint, tituloValue, onTituloChange, boxes, setBoxes, editing, resetModel, COLORS, styles: s,
}: {
  /** Título principal da secção, numa barra cinzenta (ex.: CONDIÇÕES DE TRABALHO DE CINEMA) */
  mainTitle: string;
  hint: string;
  tituloValue?: string;
  onTituloChange: (v: string) => void;
  boxes: CondBox[];
  setBoxes: (next: CondBox[]) => void;
  editing: boolean;
  /** Modelo de referência do formato, para "Repor modelo (PDF)"; sem isto o botão não aparece */
  resetModel?: () => CondBox[];
  COLORS: any;
  styles: any;
}) {
  const { t } = useTranslation();

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
    const doReset = () => setBoxes(resetModel ? resetModel() : []);
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
    <>
      <View style={{ height: 8 }} />
      {/* Título principal numa barra cinzenta; por baixo, o título anual com o
          exemplo e as notas (pedidos do Jorge de 15/09 e do pai de 16/09) */}
      <View style={s.condMain}>
        <Text style={s.condMainText}>{mainTitle}</Text>
      </View>

      <ProfileField
        label={t("cond_annual_title", { defaultValue: "Título da secção (anual)" })}
        hint={t("cond_annual_title_hint", { defaultValue: "Ex.: CONDIÇÕES DE TRABALHO - NOME - A partir de 1 de Janeiro de 2026" })}
        value={tituloValue}
        editing={editing}
        onChangeText={onTituloChange}
        autoCapitalize="characters"
        COLORS={COLORS}
        styles={s}
      />
      <Text style={s.fieldHint}>{hint}</Text>

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
              <AutoGrowTextInput
                value={b.texto}
                onChangeText={(v: string) => setBox(i, { texto: v })}
                placeholder={t("box_text_ph", { defaultValue: "Texto da condição…" })}
                placeholderTextColor={COLORS.sub}
                style={[s.fieldInput, { marginTop: 8 }]}
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
          {resetModel && (
            <Pressable onPress={resetCondDefaults} style={s.condAddBtn}>
              <Text style={s.condAddBtnText}>↺ {t("reset_cond_default", { defaultValue: "Repor modelo (PDF)" })}</Text>
            </Pressable>
          )}
        </View>
      )}
    </>
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
  // O perfil abre SEMPRE em modo de edição (mexe-se e carrega-se em Guardar;
  // não há passo "Editar" intermédio).
  const [editing] = useState(true);
  // Secção aberta: Publicidade (vermelho) ou Cinema (azul) — cada uma junta
  // valores, regras de horas extra e condições do seu formato.
  const [secao, setSecao] = useState<"publicidade" | "cinema">("publicidade");
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

  // Popup Guardar/Ignorar em QUALQUER saída com alterações por gravar:
  // botão Voltar E navegação pela barra lateral (Projetos/Painel/Definições…),
  // via navGuard. O destino escolhido fica em pendingNavRef e é executado
  // depois da decisão no popup.
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const pRef = React.useRef<Profile | null>(null);
  const originalRef = React.useRef<Profile | null>(null);
  const userRef = React.useRef(user);
  const skipAutosaveRef = React.useRef(false);
  const pendingNavRef = React.useRef<() => void>(() => router.back());
  useEffect(() => { pRef.current = p; }, [p]);
  useEffect(() => { originalRef.current = original; }, [original]);
  useEffect(() => { userRef.current = user; }, [user]);

  const isDirtyNow = () => {
    const cur = pRef.current;
    return !!cur && JSON.stringify(cur) !== JSON.stringify(originalRef.current);
  };

  function handleCancel() {
    if (!isDirtyNow()) {
      router.back();
      return;
    }
    pendingNavRef.current = () => router.back();
    setLeaveConfirm(true);
  }
  async function leaveSaving() {
    setLeaveConfirm(false);
    const ok = await handleSave();
    if (ok) {
      skipAutosaveRef.current = true;
      pendingNavRef.current();
    }
  }
  function leaveIgnoring() {
    setLeaveConfirm(false);
    // Escolha explícita de NÃO guardar — o autosave de saída tem de a respeitar
    skipAutosaveRef.current = true;
    pendingNavRef.current();
  }

  useFocusEffect(
    React.useCallback(() => {
      // Regista o guard: a barra lateral pergunta-nos antes de navegar
      setNavGuard((navigate) => {
        if (!isDirtyNow()) return false; // nada por gravar → segue
        pendingNavRef.current = navigate;
        setLeaveConfirm(true);
        return true; // navegamos nós, depois da escolha no popup
      });
      return () => {
        clearNavGuard();
        // Rede de segurança para caminhos não intercetáveis (gesto/atalhos do
        // browser): guarda silenciosamente em vez de perder as alterações.
        if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return; }
        const cur = pRef.current;
        if (!cur) return;
        if (JSON.stringify(cur) === JSON.stringify(originalRef.current)) return;
        const nome = (cur.nome || "").trim();
        if (!nome) return; // sem nome válido não há gravação silenciosa
        upsertProfile({ ...cur, nome })
          .then((saved) => {
            setActiveProfileId(saved.id).catch(() => {});
            if (userRef.current) syncProfileToCloud(userRef.current.id, saved);
          })
          .catch(() => {});
      };
    }, [])
  );

  async function handleSave(): Promise<boolean> {
    if (!p || saving) return false;
    // Fecha o teclado: senão o toast "Guardado ✓" ficava tapado por ele e
    // parecia que o botão não tinha feito nada.
    Keyboard.dismiss();

    const nome = (p.nome || "").trim();
    if (!nome) {
      Alert.alert(
        t("invalid_name", { defaultValue: "Nome inválido" }),
        t("invalid_name_msg", { defaultValue: "O nome não pode estar vazio." })
      );
      return false;
    }

    setSaving(true);
    try {
      const updated = { ...p, nome };
      await upsertProfile(updated);
      await setActiveProfileId(p.id);
      if (user) syncProfileToCloud(user.id, updated);
      setOriginal(updated);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2400);
      return true;
    } catch (e) {
      console.error("Erro ao guardar perfil", e);
      Alert.alert(
        t("error", { defaultValue: "Erro" }),
        t("save_error", { defaultValue: "Não foi possível guardar. Tenta novamente." })
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!p) return;

    // Multi-perfil: apagar um perfil que ainda tem folhas deixá-las-ia órfãs
    // (invisíveis em todas as vistas). Bloqueia com aviso explícito.
    await backfillProfileIds().catch(() => {});
    const [projs, arch] = await Promise.all([listProjects(), listArchivedProjects()]);
    const nOwned = [...projs, ...arch].filter((i) => i.profileId === p.id).length;
    if (nOwned > 0) {
      const title = t("profile_has_sheets_title", { defaultValue: "Perfil com folhas" });
      const msg = t("profile_has_sheets_msg", {
        n: nOwned,
        defaultValue:
          "Este perfil tem {{n}} folha(s). Apaga-as ou duplica-as para outro perfil antes de apagares o perfil.",
      });
      if (Platform.OS === "web") (window as any).alert(`${title}\n${msg}`);
      else Alert.alert(title, msg);
      return;
    }

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
  // Tarifas da folha de cinema (semanal)
  const fxC = p.fixasCinema ?? {};
  const setFxC = (patch: Partial<NonNullable<Profile["fixasCinema"]>>) =>
    setP({ ...p, fixasCinema: { ...fxC, ...patch } });
  // Semana de 6 dias: os mesmos valores; vazio herda da semana de 5
  const fxC6 = p.fixasCinema6 ?? {};
  const setFxC6 = (patch: Partial<NonNullable<Profile["fixasCinema"]>>) =>
    setP({ ...p, fixasCinema6: { ...fxC6, ...patch } });
  // Regras de horas extra do cinema (podem não ser as da publicidade)
  const regrasC = p.regrasCinema ?? {};
  const setRegrasC = (patch: Partial<NonNullable<Profile["regrasCinema"]>>) =>
    setP({ ...p, regrasCinema: { ...regrasC, ...patch } });

  // Os mesmos nove campos para a semana de 5 e a de 6 dias. Na de 6, o
  // placeholder mostra o valor da de 5 — é o que se usa se ficar vazio.
  type FxC = NonNullable<Profile["fixasCinema"]>;
  const ph = (n?: number, fallback?: string) => (n != null ? String(n).replace(".", ",") : fallback);
  const cinemaFields = (v: FxC, set: (patch: Partial<FxC>) => void, fb: FxC = {}) => (
    <>
      <NumField label={gs.salary} unit={preset.sym} value={v.salarioSemana} editing={editing} placeholder={ph(fb.salarioSemana)} onChange={(n) => set({ salarioSemana: n })} COLORS={COLORS} styles={s} />
      <NumField label={`${gs.overtimeA} (×)`} value={v.multHEA} editing={editing} placeholder={ph(fb.multHEA, "1,5")} onChange={(n) => set({ multHEA: n })} COLORS={COLORS} styles={s} />
      <NumField label={`${gs.overtimeB} (×)`} value={v.multHEB} editing={editing} placeholder={ph(fb.multHEB, "2")} onChange={(n) => set({ multHEB: n })} COLORS={COLORS} styles={s} />
      <NumField label={`${gs.recoveryHours} (×)`} value={v.multHR} editing={editing} placeholder={ph(fb.multHR, "2,5")} onChange={(n) => set({ multHR: n })} COLORS={COLORS} styles={s} />
      <NumField label={`${gs.meal} (${preset.sym})`} value={v.refeicao} editing={editing} placeholder={ph(fb.refeicao)} onChange={(n) => set({ refeicao: n })} COLORS={COLORS} styles={s} />
      <NumField label={`${gs.telephone} (${preset.sym})`} value={v.telefone} editing={editing} placeholder={ph(fb.telefone)} onChange={(n) => set({ telefone: n })} COLORS={COLORS} styles={s} />
      <NumField label={`${gs.vehicle} (${preset.sym})`} value={v.viatura} editing={editing} placeholder={ph(fb.viatura)} onChange={(n) => set({ viatura: n })} COLORS={COLORS} styles={s} />
      <NumField label={`${gs.material} (${preset.sym})`} value={v.material} editing={editing} placeholder={ph(fb.material)} onChange={(n) => set({ material: n })} COLORS={COLORS} styles={s} />
      <NumField label={`${t("cinema_ss", { defaultValue: "Segurança Social" })} (%)`} value={v.ssPercent} editing={editing} placeholder={ph(fb.ssPercent)} onChange={(n) => set({ ssPercent: n })} COLORS={COLORS} styles={s} />
    </>
  );
  // ── Condições de trabalho: uma secção por FORMATO (ver CondSection) ──

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        {/* Sempre em edição: Voltar (com aviso se houver alterações) + Guardar */}
        <Pressable onPress={handleCancel} hitSlop={8}>
          <Text style={s.backLink}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
        </Pressable>

        <Text style={s.headerTitle}>
          {t("profile", { defaultValue: "Perfil" })}
        </Text>

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

        {/* Publicidade (vermelho) / Cinema (azul): cada secção junta TUDO do
            seu formato — valores, regras de horas extra e condições de
            trabalho — num bloco único (notas do pai do Jorge, 16/09). */}
        <View style={s.secRow}>
          <Pressable
            onPress={() => setSecao("publicidade")}
            style={({ pressed }) => [s.secBtn, { backgroundColor: "#c00000" }, secao !== "publicidade" && s.secBtnOff, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.secBtnText}>{t("format_publicidade", { defaultValue: "Publicidade" })}</Text>
          </Pressable>
          <Pressable
            onPress={() => setSecao("cinema")}
            style={({ pressed }) => [s.secBtn, { backgroundColor: "#2e75b6" }, secao !== "cinema" && s.secBtnOff, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.secBtnText}>{t("format_cinema", { defaultValue: "Cinema" })}</Text>
          </Pressable>
        </View>

        {secao === "publicidade" ? (
          <>
            {/* Valores da folha diária: aplicados a projetos novos */}
            <View style={s.card}>
              <Text style={s.fieldLabel}>
                {t("fixed_conditions", { defaultValue: "Publicidade · Folha diária" })}
              </Text>
              <Text style={s.fieldHint}>
                {t("fixed_conditions_hint", { defaultValue: "Salários e valores de horas extra. Aplicam-se automaticamente a projetos novos. Tudo editável por projeto." })}
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

            {/* Regras de horas extra + condições de trabalho: um bloco único */}
            <View style={s.card}>
              <Text style={s.fieldLabel}>
                {t("overtime_rules_title", { defaultValue: "Publicidade · Regras de horas extra" })}
              </Text>
              <Text style={s.fieldHint}>
                {t("overtime_rules_hint", { defaultValue: "A partir de que hora se cobra horas extra e/ou de recuperação. A predefinição é igual ao PDF." })}
              </Text>
              <NumField label={t("cond_base_hours", { defaultValue: "Horário Base" })} value={fixas.hDia} editing={editing} placeholder="11" onChange={(n) => setFixas({ hDia: n })} COLORS={COLORS} styles={s} />
              <NumField label={t("cond_hea_from_hour", { defaultValue: "HE-A a partir do início da hora" })} value={fixas.heaFromHour} editing={editing} placeholder="12" onChange={(n) => setFixas({ heaFromHour: n })} COLORS={COLORS} styles={s} />
              <NumField label={t("cond_heb_from_hour", { defaultValue: "HE-B a partir do início da hora" })} value={fixas.hebFromHour} editing={editing} placeholder="19" onChange={(n) => setFixas({ hebFromHour: n })} COLORS={COLORS} styles={s} />
              <NumField label={t("cond_hr_rest_below", { defaultValue: "HR — se descanso inferior a (h)" })} value={fixas.hrRestBelow} editing={editing} placeholder="10" onChange={(n) => setFixas({ hrRestBelow: n })} COLORS={COLORS} styles={s} />

              <CondSection
                mainTitle={t("cond_annual_title_ph_ads", { defaultValue: "CONDIÇÕES DE TRABALHO DE PUBLICIDADE" })}
                hint={t("cond_boxes_hint", { defaultValue: "Caixas com título e texto (e imagem opcional) que saem na folha/PDF. Aplicam-se a projetos novos." })}
                tituloValue={p.condTitulo}
                onTituloChange={(v) => setP({ ...p, condTitulo: v })}
                boxes={p.condBoxes ?? []}
                setBoxes={(next) => setP({ ...p, condBoxes: next })}
                editing={editing}
                resetModel={defaultCondBoxes}
                COLORS={COLORS}
                styles={s}
              />
            </View>
          </>
        ) : (
          <>
            {/* Valores da folha semanal: semana de 5 dias e semana de 6 dias */}
            <View style={s.card}>
              <Text style={s.fieldLabel}>
                {t("cinema_rates_title", { defaultValue: "Cinema · Folha semanal" })}
              </Text>
              <Text style={s.fieldHint}>
                {t("cinema_rates_hint", { defaultValue: "Salários e valores de horas extra. Aplicam-se automaticamente a projetos novos. O valor dia é o salário da semana a dividir pelos dias de trabalho; a hora é o valor dia a dividir pelas horas de trabalho diárias (sem a de refeição). As horas extra e de recuperação multiplicam a hora normal pelo número aqui inserido. Tudo editável por projeto." })}
              </Text>
              <Text style={s.subTitle}>{gs.salary} · {t("cinema_week", { defaultValue: "Semana de 5 dias" })}</Text>
              {cinemaFields(fxC, setFxC)}
              <Text style={s.subTitle}>{gs.salary} · {t("cinema_week6", { defaultValue: "Semana de 6 dias" })}</Text>
              <Text style={s.fieldHint}>
                {t("cinema_week6_hint", { defaultValue: "Campos vazios usam os valores da semana de 5 dias." })}
              </Text>
              {cinemaFields(fxC6, setFxC6, fxC)}
            </View>

            {/* Regras de horas extra do cinema + condições de trabalho: um bloco único */}
            <View style={s.card}>
              <Text style={s.fieldLabel}>
                {t("cinema_rules_title", { defaultValue: "Cinema · Regras de horas extra" })}
              </Text>
              <Text style={s.fieldHint}>
                {t("cinema_rules_hint", { defaultValue: "A partir de que hora se cobra horas extra e/ou de recuperação. A predefinição é igual ao PDF. As regras podem não ser as mesmas da publicidade." })}
              </Text>
              <NumField label={t("cond_base_hours", { defaultValue: "Horário Base" })} value={regrasC.hDia} editing={editing} placeholder="11" onChange={(n) => setRegrasC({ hDia: n })} COLORS={COLORS} styles={s} />
              <NumField label={t("cond_hea_from_hour", { defaultValue: "HE-A a partir do início da hora" })} value={regrasC.heaFromHour} editing={editing} placeholder="12" onChange={(n) => setRegrasC({ heaFromHour: n })} COLORS={COLORS} styles={s} />
              <NumField label={t("cond_heb_from_hour", { defaultValue: "HE-B a partir do início da hora" })} value={regrasC.hebFromHour} editing={editing} placeholder="19" onChange={(n) => setRegrasC({ hebFromHour: n })} COLORS={COLORS} styles={s} />
              <NumField label={t("cond_hr_rest_below", { defaultValue: "HR — se descanso inferior a (h)" })} value={regrasC.hrRestBelow} editing={editing} placeholder="10" onChange={(n) => setRegrasC({ hrRestBelow: n })} COLORS={COLORS} styles={s} />

              {/* Cinema: condições próprias. As regras da semana (descanso entre
                  semanas, folgas e feriados a dobrar) não são as da publicidade,
                  e cada projeto novo leva as do seu formato. */}
              <CondSection
                mainTitle={t("cond_annual_title_ph_cinema", { defaultValue: "CONDIÇÕES DE TRABALHO DE CINEMA" })}
                hint={t("cond_boxes_hint_cinema", { defaultValue: "Usadas só nas folhas de cinema (à semana). Se ficarem vazias, essas folhas saem sem condições." })}
                tituloValue={p.condTituloCinema}
                onTituloChange={(v) => setP({ ...p, condTituloCinema: v })}
                boxes={p.condBoxesCinema ?? []}
                setBoxes={(next) => setP({ ...p, condBoxesCinema: next })}
                editing={editing}
                resetModel={defaultCondBoxesCinema}
                COLORS={COLORS}
                styles={s}
              />
            </View>
          </>
        )}
        <Pressable onPress={handleDelete} style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.85 }]}>
          <Text style={s.deleteBtnText}>
            {t("delete_profile", { defaultValue: "Apagar perfil" })}
          </Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>

      {savedToast && (
        <View style={s.savedToast} pointerEvents="none">
          <Text style={s.savedToastText}>✓ {t("saved", { defaultValue: "Guardado" })}</Text>
        </View>
      )}

      {/* Sair com alterações por gravar: Guardar / Ignorar / Cancelar */}
      <Modal transparent animationType="fade" visible={leaveConfirm} onRequestClose={() => setLeaveConfirm(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}
          onPress={() => setLeaveConfirm(false)}
        >
          <Pressable
            style={{ width: "100%", maxWidth: 420, backgroundColor: COLORS.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: COLORS.border }}
            onPress={() => {}}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: COLORS.text, textAlign: "center" }}>
              {t("unsaved_changes", { defaultValue: "Alterações por guardar" })}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.sub, textAlign: "center", marginTop: 6, marginBottom: 14 }}>
              {t("unsaved_changes_msg", { defaultValue: "Queres guardar as alterações antes de sair?" })}
            </Text>
            <Pressable
              onPress={leaveSaving}
              style={({ pressed }) => [{ alignItems: "center", paddingVertical: 12, borderRadius: 999, backgroundColor: COLORS.text }, pressed && { opacity: 0.85 }]}
            >
              <Text style={{ color: COLORS.bg, fontWeight: "900" }}>{t("save", { defaultValue: "Guardar" })}</Text>
            </Pressable>
            <Pressable
              onPress={leaveIgnoring}
              style={({ pressed }) => [{ alignItems: "center", paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, marginTop: 8 }, pressed && { opacity: 0.85 }]}
            >
              <Text style={{ color: COLORS.danger, fontWeight: "900" }}>{t("ignore", { defaultValue: "Ignorar" })}</Text>
            </Pressable>
            <Pressable
              onPress={() => setLeaveConfirm(false)}
              style={({ pressed }) => [{ alignItems: "center", paddingVertical: 10, marginTop: 4 }, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: COLORS.sub, fontWeight: "800", fontSize: 13 }}>{t("cancel", { defaultValue: "Cancelar" })}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    // Subtítulo de uma tabela de valores (ex.: SALÁRIO · Semana de 6 dias)
    subTitle: { color: COLORS.text, fontSize: 12.5, fontWeight: "900", marginTop: 12, marginBottom: 6, letterSpacing: 0.3 },
    // Botões Publicidade (vermelho) / Cinema (azul) que abrem cada secção
    secRow: { flexDirection: "row", gap: 10 },
    secBtn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
    secBtnOff: { opacity: 0.4 },
    secBtnText: { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 0.3 },
    // Título principal das condições de trabalho, em barra cinzenta
    condMain: { backgroundColor: mode === "dark" ? COLORS.bg : "#E8EBF0", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 10 },
    condMainText: { color: COLORS.text, fontWeight: "900", fontSize: 13, letterSpacing: 0.4 },
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
