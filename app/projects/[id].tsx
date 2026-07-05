// app/projects/[id].tsx
import dayjs from "dayjs";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useIsWide } from "../../src/ui/useBreakpoint";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../src/auth/AuthContext";
import { syncProjectToCloud } from "../../src/sync/syncService";
import { useTranslation } from "react-i18next";
import i18n from "../../src/i18n/i18n";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CURRENCY, calcAll, calcTotals, minutesToHM } from "../../src/calc/engine";
import { Dia } from "../../src/calc/types";
import { getPreset } from "../../src/constants/countryPresets";
import { buildPdfHtml } from "../../src/export/buildPdfHtml";
import { exportPDF } from "../../src/export/pdf";
import { useLivePreview } from "../../src/contexts/LivePreviewContext";
import { ProjectState } from "../../src/models/project";
import { getSettings } from "../../src/storage/appSettings";
import { canExportPdf, incrementPdfExportCount } from "../../src/storage/freeTier";
import { getActiveProfile } from "../../src/storage/profile";
import { getProject, saveProject } from "../../src/storage/projects";
import EditableSheet, { SHEET_W } from "../../src/ui/EditableSheet";

/* ---------- Paleta (manual, neutra) ---------- */
const COLORS = {
  bg: "#F6F7F9",
  card: "#FFFFFF",
  cardAlt: "#F2F3F5",
  border: "#E5E6EA",
  text: "#1C1C1E",
  sub: "#8E8E93",
  danger: "#FF3B30",
  shadow: "rgba(0,0,0,0.08)",
};

const PAGE_X = 16;

/* ---------- Helpers ---------- */
function parseTimeToMinutes(str: string): number | null {
  if (!str) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (m < 0 || m > 59) return null;
  if (h < 0 || h > 23) return null;
  return h * 60 + m;
}

function isValidTimeStr(v: string): boolean {
  return parseTimeToMinutes(v) !== null;
}

/** Formata dígitos em HH:MM à medida que o utilizador escreve. "0800" -> "08:00". */
function maskTime(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ":" + digits.slice(2);
}

/** dayjs a partir de uma string ISO (YYYY-MM-DD); null se inválida. */
function parseISO(v?: string) {
  if (!v) return null;
  const d = dayjs(v);
  return d.isValid() ? d : null;
}

/** Mostra a data de forma amigável e localizada (ex: "qua, 02/07/2026"). */
function formatDateDisplay(v: string | undefined, lang: string): string {
  const d = parseISO(v);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat(lang, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d.toDate());
  } catch {
    return d.format("DD/MM/YYYY");
  }
}

function monthTitle(d: dayjs.Dayjs, lang: string): string {
  try {
    const s = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" }).format(d.toDate());
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return d.format("MM/YYYY");
  }
}

/** Cabeçalhos dos dias da semana, começando à segunda-feira e localizados. */
function weekdayHeaders(lang: string): string[] {
  try {
    const fmt = new Intl.DateTimeFormat(lang, { weekday: "narrow" });
    const base = new Date(2021, 7, 2); // 2 Ago 2021 é uma segunda-feira
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return fmt.format(d);
    });
  } catch {
    return ["S", "T", "Q", "Q", "S", "S", "D"];
  }
}

export default function ProjectEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isWide = useIsWide();
  const { width: winW } = useWindowDimensions();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectState | null>(null);
  const projectRef = useRef<ProjectState | null>(null);
  const [regionCode, setRegionCode] = useState<string>("pt");

  // "Guardado ✓" indicator
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<any>(null);

  // menu opções (⋯)
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fsPreview, setFsPreview] = useState(false);
  const [sheetZoom, setSheetZoom] = useState(() =>
    isWide ? 1 : Math.max(0.25, Math.min(1, (winW - 2 * PAGE_X) / SHEET_W))
  );
  const fsIframeRef = useRef<any>(null);
  const { setPreviewHtml, clearPreview, zoom, setZoom, actualZoom } = useLivePreview();
  const [livePreviewEnabled, setLivePreviewEnabled] = useState(false);
  const livePreview = isWide && Platform.OS === "web" && livePreviewEnabled;

  // Clear preview when leaving this screen
  useEffect(() => { return () => clearPreview(); }, []);


  useEffect(() => {
    getSettings().then((s) => setRegionCode(s.region ?? "pt"));
  }, []);

  const loadProject = useCallback(async () => {
    const p = await getProject(id!);
    if (!p) return;

    const aj = p.tabela.ajudas ?? { refeicao: 0, viatura: 0, material: 0, telefone: 0, perDiem: 0 };
    const dias = p.dias.map((d) => ({ jantarTrabalho: "00:00", tempoTransporteMin: 0, ...d })) as Dia[];
    const fiscalRaw = (p.fiscal as any) ?? {};
    const fiscal = {
      IRS_percent: Number(fiscalRaw.IRS_percent ?? fiscalRaw.irs ?? fiscalRaw.IRS ?? 0) || 0,
      IVA_percent: Number(fiscalRaw.IVA_percent ?? fiscalRaw.iva ?? fiscalRaw.IVA ?? 0) || 0,
      nota: fiscalRaw.nota ?? "",
    };
    const normalized: ProjectState = {
      ...p,
      tabela: { multHEA: 1.5, multHEB: 2.0, multHR: 3.0, limiar_A: 11, limiar_B: 18, ...p.tabela, ajudas: aj },
      dias,
      fiscal: fiscal as any,
    };
    setProject(normalized);
    projectRef.current = normalized;
  }, [id]);

  useEffect(() => {
    loadProject().catch(() => {
      Alert.alert(t("oops"), t("proj_not_found"));
      router.replace("/projects");
    });
  }, [loadProject]);

  // Reload from storage when returning from the table editor page
  useFocusEffect(useCallback(() => { loadProject(); }, [loadProject]));

  // Telemóvel: abre a folha em ecrã inteiro automaticamente (uma vez)
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!isWide && project && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setFsPreview(true);
    }
  }, [isWide, project]);

  // Ajusta o zoom para caber tudo em ecrã inteiro (e ao rodar o telemóvel)
  useEffect(() => {
    if (fsPreview && !isWide) {
      const fit = Math.max(0.2, Math.min(1, (winW - 24) / SHEET_W));
      setSheetZoom(fit);
    }
  }, [fsPreview, winW, isWide]);

  async function persist(next: ProjectState) {
    setProject(next);
    projectRef.current = next;
    setSaveStatus("saving");
    try {
      await saveProject(next);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
    if (user) syncProjectToCloud(user.id, next as any);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("idle"), 1500);
  }

  function setP<K extends keyof ProjectState>(key: K, value: ProjectState[K]) {
    if (!projectRef.current) return;
    const next = { ...projectRef.current, [key]: value };
    persist(next);
  }

  const calculos = useMemo(
    () => (project ? calcAll(project.dias, project.tabela) : []),
    [project]
  );

  const totais = useMemo(() => {
    if (!project)
      return { ValorBruto: 0, IRS_valor: 0, IVA_valor: 0, ValorFinal: 0 };
    return calcTotals(calculos, project.fiscal as any);
  }, [calculos, project?.fiscal]);

  const totalDias = useMemo(
    () =>
      project
        ? project.dias.reduce(
            (s, d) => s + (d.diaSemTrabalho ? 0 : d.meioDia ? 0.5 : 1),
            0
          )
        : 0,
    [project?.dias]
  );

  const taxLabels = getPreset(regionCode).taxLabels;

  const anyPreview = livePreview || showPreview;

  const previewHtml = useMemo(() => {
    if (!project || !anyPreview) return "";
    const rPreset = getPreset(regionCode);
    const html = buildPdfHtml(
      project.perfil,
      project.projeto,
      project.dias,
      calculos,
      totais,
      project.tabela as any,
      project.notas,
      i18n.language,
      regionCode,
      rPreset.currency,
      t("tax_disclaimer"),
      project.condicoes
    );
    return html.replace(
      "</body>",
      `<script>
(function(){
  function fit(){
    var w = document.documentElement.scrollWidth;
    var z = w > 0 ? Math.min(1, window.innerWidth / w) : 1;
    document.documentElement.style.zoom = String(z);
    try { window.parent.postMessage({ type: 'wrapsheet:zoom-actual', zoom: z }, '*'); } catch(e){}
  }
  window.addEventListener('message', function(e){
    if(e.data && e.data.type === 'wrapsheet:zoom'){
      if(e.data.zoom === 'auto'){ fit(); }
      else { document.documentElement.style.zoom = String(e.data.zoom); }
    }
  });
  document.addEventListener('DOMContentLoaded', function(){ fit(); window.addEventListener('resize', fit); });
  fit();
})();
</script></body>`
    );
  }, [project, calculos, totais, regionCode, anyPreview]);

  // Sync to context whenever previewHtml changes
  useEffect(() => {
    if (livePreview && previewHtml) setPreviewHtml(previewHtml);
    else if (!livePreview) clearPreview();
  }, [previewHtml, livePreview]);

  // Send zoom to fullscreen iframe when zoom changes
  useEffect(() => {
    if (!fsPreview) return;
    const win = fsIframeRef.current?.contentWindow;
    if (!win) return;
    if (zoom === null) {
      win.postMessage({ type: "wrapsheet:zoom", zoom: "auto" }, "*");
    } else {
      win.postMessage({ type: "wrapsheet:zoom", zoom }, "*");
    }
  }, [zoom, fsPreview]);

  if (!project) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>{t("loading")}</Text>
      </View>
    );
  }

  const paddingTop =
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 8 : 8;

  function handleBack() {
    router.back();
  }

  // Ecrã inteiro + tentativa de bloquear em horizontal (best-effort na web).
  // No iOS Safari o browser não permite forçar a orientação — aí o utilizador
  // roda o telemóvel e a folha reajusta-se sozinha para caber tudo.
  function enterLandscape() {
    if (Platform.OS !== "web") return;
    try {
      const el: any = document.documentElement;
      const so: any = (window.screen as any)?.orientation;
      const lock = () => { try { so?.lock?.("landscape"); } catch {} };
      const p = el?.requestFullscreen?.();
      if (p && typeof p.then === "function") p.then(lock).catch(lock);
      else lock();
    } catch {}
  }
  function exitLandscape() {
    if (Platform.OS !== "web") return;
    try {
      (window.screen as any)?.orientation?.unlock?.();
      if ((document as any).fullscreenElement) (document as any).exitFullscreen?.();
    } catch {}
  }
  function openFullscreenSheet() {
    setFsPreview(true);
    enterLandscape();
  }
  function closeFullscreenSheet() {
    exitLandscape();
    setFsPreview(false);
  }

  // ✅ Export robusto: usa SEMPRE o estado atual em memória (ref)
  async function handleExportPDF() {
    const p = projectRef.current;

    if (!p) {
      Alert.alert(t("error"), t("proj_not_ready"));
      return;
    }

    const allowed = await canExportPdf();
    if (!allowed) {
      Alert.alert(
        t("pro_gate_title", { defaultValue: "WrapSheet Pro" }),
        t("pro_gate_pdf_body", { defaultValue: "You've used your 3 free PDF exports. Unlimited exports are part of WrapSheet Pro — coming soon." }),
        [
          { text: t("cancel", { defaultValue: "Cancelar" }), style: "cancel" },
          { text: t("pro_gate_see_plans", { defaultValue: "See plans" }), onPress: () => router.push("/settings/plan") },
        ]
      );
      return;
    }

    const calculosLocal = calcAll(p.dias, p.tabela);
    const totaisLocal = calcTotals(calculosLocal, p.fiscal as any);

    // valida horas
    const erros: string[] = [];
    p.dias.forEach((d, idx) => {
      const labelDia = `Dia ${idx + 1} (${d.data || "sem data"})`;
      if (d.diaSemTrabalho) return;

      const inicioMin = parseTimeToMinutes(d.inicio);
      const fimMin = parseTimeToMinutes(d.fim);
      const refMin = parseTimeToMinutes(d.refeicaoTrabalho);
      const jantarMin = parseTimeToMinutes(d.jantarTrabalho);

      if (inicioMin === null)
        erros.push(`${labelDia}: hora de início inválida (${d.inicio})`);
      if (fimMin === null)
        erros.push(`${labelDia}: hora de fim inválida (${d.fim})`);
      if (refMin === null)
        erros.push(`${labelDia}: refeição inválida (${d.refeicaoTrabalho})`);
      if (jantarMin === null)
        erros.push(`${labelDia}: jantar inválido (${d.jantarTrabalho})`);

      // Fix #4: allow overnight shifts (fim < inicio) — engine handles them correctly.
      // Only reject a zero-duration day (fim === inicio).
      if (inicioMin !== null && fimMin !== null && fimMin === inicioMin) {
        erros.push(
          `${labelDia}: a hora de início e fim são iguais (duração zero)`
        );
      }
    });

    if (erros.length > 0) {
      Alert.alert(t("check_data"), erros.join("\n"));
      return;
    }

    try {
      const rPreset = getPreset(regionCode);
      await exportPDF(
        p.perfil,
        p.projeto,
        p.dias,
        calculosLocal,
        totaisLocal,
        p.tabela,
        undefined,
        p.notas,
        i18n.language,
        regionCode,
        rPreset.currency,
        t("tax_disclaimer"),
        p.condicoes
      );
      await incrementPdfExportCount();
    } catch (e) {
      console.error(e);
      Alert.alert(t("error"), t("pdf_error"));
    }
  }

  async function handleApplyActiveProfile() {
    const act = await getActiveProfile();
    if (!act) {
      Alert.alert(t("profile"), t("no_active_profile"));
      return;
    }
    setP("perfil", {
      nome: act.nome,
      email: act.email,
      telefone: act.telefone,
      departamento: act.departamento,
      funcao: act.funcao,
      empresa: act.empresa ?? "",
      nif: act.nif ?? "",
      iban: act.iban ?? "",
      swift: act.swift ?? "",
    });

    // Condições de trabalho (texto)
    if ((act as any).condicoes) setP("condicoes", (act as any).condicoes);

    // Condições fixas (linha de taxas): salário, taxas HE €/h e ajudas
    const fx = (act as any).fixas || {};
    const cur = projectRef.current!.tabela;
    const patch: any = { ...cur, ajudas: { ...cur.ajudas } };
    if (fx.salarioDia != null) patch.salarioDia = fx.salarioDia;
    if (fx.rateHEA != null) patch.rateHEA = fx.rateHEA;
    if (fx.rateHEB != null) patch.rateHEB = fx.rateHEB;
    if (fx.rateHR != null) patch.rateHR = fx.rateHR;
    if (fx.refeicao != null) patch.ajudas.refeicao = fx.refeicao;
    if (fx.telefone != null) patch.ajudas.telefone = fx.telefone;
    if (fx.viatura != null) patch.ajudas.viatura = fx.viatura;
    if (fx.material != null) patch.ajudas.material = fx.material;
    if (fx.perDiem != null) patch.ajudas.perDiem = fx.perDiem;
    setP("tabela", patch);
  }

  // Write-through: editar um multiplicador recalcula a taxa €/h a partir do salário atual
  function applyMult(
    multKey: "multHEA" | "multHEB" | "multHR",
    rateKey: "rateHEA" | "rateHEB" | "rateHR",
    m: number
  ) {
    const cur = projectRef.current!.tabela;
    const base = (cur.salarioDia || 0) / (cur.H_dia || 11);
    setP("tabela", { ...cur, [multKey]: m, [rateKey]: Math.round(base * m * 100) / 100 });
  }

  function addDia() {
    const p = projectRef.current!;
    const last = p.dias[p.dias.length - 1];
    const nextDate = last
      ? dayjs(last.data).add(1, "day").format("YYYY-MM-DD")
      : dayjs().format("YYYY-MM-DD");

    const novo: Dia = {
      descricao: t("day_description_default"),
      data: nextDate,
      continuo: false,
      inicio: "08:00",
      refeicaoTrabalho: "00:30",
      jantarTrabalho: "00:00",
      fim: "20:00",
      meioDia: false,
      tempoTransporteMin: 0,
      diaSemTrabalho: false,
    };
    setP("dias", [...p.dias, novo]);
  }

  function updateDia(i: number, patch: Partial<Dia>) {
    const p = projectRef.current!;
    const dias = p.dias.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    setP("dias", dias);
  }

  // Duplica um dia logo a seguir, com a data avançada +1 dia (estilo "arrastar" do Excel)
  function duplicateDia(i: number) {
    const p = projectRef.current!;
    const src = p.dias[i];
    const copy: Dia = {
      ...src,
      data: dayjs(src.data).add(1, "day").format("YYYY-MM-DD"),
    };
    const dias = [...p.dias.slice(0, i + 1), copy, ...p.dias.slice(i + 1)];
    setP("dias", dias);
  }

  function removeDia(i: number) {
    const p = projectRef.current!;
    if (p.dias.length <= 1) {
      if (Platform.OS === "web") {
        window.alert(t("min_one_day"));
      } else {
        Alert.alert(t("days"), t("min_one_day"));
      }
      return;
    }

    if (Platform.OS === "web") {
      if (window.confirm(t("remove_day_confirm"))) {
        const next = p.dias.filter((_, idx) => idx !== i);
        setP("dias", next);
      }
    } else {
      Alert.alert(t("remove_day"), t("remove_day_confirm"), [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () => {
            const next = p.dias.filter((_, idx) => idx !== i);
            setP("dias", next);
          },
        },
      ]);
    }
  }

  async function handleClearAll() {
    const p = projectRef.current!;
    Alert.alert(t("clear_all"), t("are_you_sure"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          const today = dayjs().format("YYYY-MM-DD");
          const empty: ProjectState = {
            ...p,
            perfil: {
              nome: "",
              email: "",
              telefone: "",
              departamento: "",
              funcao: "",
              empresa: "",
              nif: "",
              iban: "",
              swift: "",
            },
            projeto: {
              filme: "",
              produtora: "",
              nifProdutora: "",
              semana: "",
              mes: dayjs().month() + 1,
              ano: dayjs().year(),
            },
            notas: "",
            condicoes: "",
            fiscal: { IRS_percent: 0, IVA_percent: 0, nota: "" },
            dias: [
              {
                descricao: t("day_description_default"),
                data: today,
                continuo: false,
                inicio: "08:00",
                refeicaoTrabalho: "00:30",
                jantarTrabalho: "00:00",
                fim: "20:00",
                meioDia: false,
                tempoTransporteMin: 0,
                diaSemTrabalho: false,
              },
            ],
          };
          await persist(empty);
        },
      },
    ]);
  }


  const renderSheet = () => (
    <EditableSheet
      perfil={project!.perfil as any}
      projeto={project!.projeto as any}
      tabela={project!.tabela as any}
      dias={project!.dias}
      calculos={calculos as any}
      totais={totais as any}
      notas={project!.notas || ""}
      condicoes={project!.condicoes || ""}
      locale={i18n.language}
      region={regionCode}
      currency={getPreset(regionCode).currency}
      taxDisclaimer={t("tax_disclaimer")}
      applyLabel={t("apply_profile")}
      addLabel={t("add_day")}
      duplicateLabel={t("duplicate_day")}
      titlePlaceholder={t("title_placeholder", { defaultValue: "Título" })}
      onPerfil={(patch) => setP("perfil", { ...project!.perfil, ...patch })}
      onProjeto={(patch) => setP("projeto", { ...project!.projeto, ...patch })}
      onTabela={(patch) => setP("tabela", { ...project!.tabela, ...patch })}
      onDia={updateDia}
      onAddDia={addDia}
      onDuplicateDia={duplicateDia}
      onRemoveDia={removeDia}
      onNotas={(v) => setP("notas", v)}
      onCondicoes={(v) => setP("condicoes", v)}
      onApplyProfile={handleApplyActiveProfile}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 70 }}>
        {/* Header */}
        <View style={{ paddingTop: paddingTop, paddingHorizontal: PAGE_X }}>
          <View style={ss.topbar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
              <Pressable onPress={handleBack} hitSlop={10}>
                <Text style={ss.backLink}>‹ {t("projects")}</Text>
              </Pressable>
              {saveStatus !== "idle" && (
                <Text
                  style={[
                    ss.saveStatus,
                    saveStatus === "saved" && { color: "#1a9c4e" },
                  ]}
                  numberOfLines={1}
                >
                  {saveStatus === "saving" ? t("saving") : `✓ ${t("saved")}`}
                </Text>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {/* Zoom da folha (só quando a folha está visível inline) */}
              {isWide && (
                <View style={ss.zoomRow}>
                  <Pressable
                    onPress={() => setSheetZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}
                    style={({ pressed }) => [ss.zoomBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={ss.zoomBtnText}>−</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSheetZoom(1)}
                    style={({ pressed }) => [ss.zoomBtnMid, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={ss.zoomBtnText}>{Math.round(sheetZoom * 100)}%</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSheetZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                    style={({ pressed }) => [ss.zoomBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={ss.zoomBtnText}>+</Text>
                  </Pressable>
                </View>
              )}

              <Pressable
                onPress={() => setFsPreview(true)}
                style={({ pressed }) => [ss.exportBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={ss.exportBtnText}>⛶</Text>
              </Pressable>

              <Pressable
                onPress={handleExportPDF}
                style={({ pressed }) => [
                  ss.exportBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={ss.exportBtnText}>{t("export_pdf")}</Text>
              </Pressable>

              <Pressable
                onPress={() => setMenuOpen(true)}
                hitSlop={10}
                style={({ pressed }) => [ss.moreBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={ss.moreBtnText}>⋯</Text>
              </Pressable>
            </View>
          </View>

        </View>

        <View style={{ paddingHorizontal: PAGE_X }}>
          {isWide ? (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <ZoomWrap zoom={sheetZoom}>{renderSheet()}</ZoomWrap>
            </ScrollView>
          ) : (
            <>
              <Pressable
                onPress={openFullscreenSheet}
                style={({ pressed }) => [ss.fsCta, pressed && { opacity: 0.9 }]}
              >
                <Text style={ss.fsCtaText}>
                  ⛶ {t("open_fullscreen", { defaultValue: "Abrir folha em ecrã inteiro" })}
                </Text>
                <Text style={ss.fsCtaHint}>
                  {t("open_fullscreen_hint", { defaultValue: "Roda o telemóvel para veres a folha na horizontal." })}
                </Text>
              </Pressable>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <ZoomWrap zoom={sheetZoom}>{renderSheet()}</ZoomWrap>
              </ScrollView>
            </>
          )}

          <View style={{ marginTop: 12 }}>
            <Section title={t("table_params")} collapsible defaultCollapsed>
              <Grid2>
                <Num label={t("hours_day")} value={project.tabela.H_dia} onChange={(n) => setP("tabela", { ...project.tabela, H_dia: n })} />
                <Num label={t("min_rest")} value={project.tabela.descanso_min} onChange={(n) => setP("tabela", { ...project.tabela, descanso_min: n })} />
              </Grid2>
              <Text style={ss.helperTitle}>{t("base_hour_mult")}</Text>
              <Text style={ss.fieldHint}>{t("mult_writethrough_hint", { defaultValue: "Ao alterar um multiplicador, a taxa €/h correspondente é recalculada a partir do salário atual." })}</Text>
              <Grid3>
                <Num label={t("mult_hea")} value={project.tabela.multHEA ?? 1.5} onChange={(n) => applyMult("multHEA", "rateHEA", n || 1.5)} />
                <Num label={t("mult_heb")} value={project.tabela.multHEB ?? 2.0} onChange={(n) => applyMult("multHEB", "rateHEB", n || 2.0)} />
                <Num label={t("mult_hr")} value={project.tabela.multHR ?? 3.0} onChange={(n) => applyMult("multHR", "rateHR", n || 3.0)} />
              </Grid3>
              <Text style={ss.helperTitle}>{t("threshold_ab")}</Text>
              <Grid3>
                <Num label={t("threshold_a")} value={project.tabela.limiar_A ?? 11} onChange={(n) => setP("tabela", { ...project.tabela, limiar_A: n || 11 })} />
                <Num label={t("threshold_b")} value={project.tabela.limiar_B ?? 18} onChange={(n) => setP("tabela", { ...project.tabela, limiar_B: n || 18 })} />
                <Num label={t("threshold_hr")} value={(project.tabela as any).limiar_HR ?? project.tabela.descanso_min ?? 11} onChange={(n) => setP("tabela", { ...project.tabela, limiar_HR: n || 11 } as any)} />
              </Grid3>
            </Section>

            <Section title={t("fiscal_section")} collapsible defaultCollapsed>
              <Grid3>
                <Num label={taxLabels.incomeTax} value={project.fiscal.IRS_percent} onChange={(n) => setP("fiscal", { ...project.fiscal, IRS_percent: n })} />
                <Num label={taxLabels.vat} value={project.fiscal.IVA_percent} onChange={(n) => setP("fiscal", { ...project.fiscal, IVA_percent: n })} />
              </Grid3>
              <View style={{ marginTop: 4 }}>
                <Text style={ss.label}>{t("observation")}</Text>
                <TextInput style={ss.input} placeholder={t("fiscal_note_placeholder")} placeholderTextColor={COLORS.sub} value={project.fiscal.nota ?? ""} onChangeText={(v) => setP("fiscal", { ...project.fiscal, nota: v })} />
              </View>
              <View style={ss.disclaimerBox}><Text style={ss.disclaimerText}>{t("tax_disclaimer")}</Text></View>
            </Section>
          </View>
        </View>
      </ScrollView>

      {/* Menu ⋯ */}
      <Modal
        transparent
        animationType="fade"
        visible={menuOpen}
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          style={[ss.menuBackdrop, isWide && { justifyContent: "center", alignItems: "center", padding: 24 }]}
          onPress={() => setMenuOpen(false)}
        >
          <Pressable
            style={[ss.menuCard, isWide && { width: 360, alignSelf: "auto" }]}
            onPress={() => {}}
          >
            <Text style={ss.menuTitle}>{t("options")}</Text>

            <MenuItem
              label={t("apply_active_profile")}
              onPress={() => {
                setMenuOpen(false);
                handleApplyActiveProfile();
              }}
            />

            <MenuItem
              label={t("clear_project")}
              tone="danger"
              onPress={() => {
                setMenuOpen(false);
                handleClearAll();
              }}
            />

            <Pressable
              onPress={() => setMenuOpen(false)}
              style={({ pressed }) => [ss.menuClose, pressed && { opacity: 0.85 }]}
            >
              <Text style={ss.menuCloseText}>{t("close")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Fullscreen editable sheet */}
      <Modal
        animationType="fade"
        visible={fsPreview}
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={closeFullscreenSheet}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <View style={ss.previewHeader}>
            <Text style={ss.previewTitle} numberOfLines={1}>
              {project.projeto.titulo || project.projeto.filme || t("unnamed_project")}
            </Text>
            <View style={ss.zoomRow}>
              <Pressable
                onPress={() => setSheetZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}
                style={({ pressed }) => [ss.zoomBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={ss.zoomBtnText}>−</Text>
              </Pressable>
              <Pressable
                onPress={() => setSheetZoom(1)}
                style={({ pressed }) => [ss.zoomBtnMid, pressed && { opacity: 0.7 }]}
              >
                <Text style={ss.zoomBtnText}>{Math.round(sheetZoom * 100)}%</Text>
              </Pressable>
              <Pressable
                onPress={() => setSheetZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                style={({ pressed }) => [ss.zoomBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={ss.zoomBtnText}>+</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={closeFullscreenSheet}
              hitSlop={12}
              style={({ pressed }) => [ss.previewCloseBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={ss.previewCloseText}>✕ {t("close", { defaultValue: "Fechar" })}</Text>
            </Pressable>
          </View>
          {!isWide && (
            <Text style={ss.rotateHint}>
              {t("rotate_hint", { defaultValue: "Roda o telemóvel para a horizontal para veres a folha maior." })}
            </Text>
          )}
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            <ScrollView horizontal>
              <ZoomWrap zoom={sheetZoom}>{renderSheet()}</ZoomWrap>
            </ScrollView>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Preview overlay */}
      <Modal
        transparent
        animationType="slide"
        visible={showPreview}
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={ss.previewOverlay}>
          <View style={ss.previewHeader}>
            <Text style={ss.previewTitle} numberOfLines={1}>
              {project.projeto.titulo || project.projeto.filme || t("unnamed_project")}
            </Text>
            <Pressable
              onPress={() => setShowPreview(false)}
              hitSlop={12}
              style={({ pressed }) => [ss.previewCloseBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={ss.previewCloseText}>✕ {t("close", { defaultValue: "Fechar" })}</Text>
            </Pressable>
          </View>

          {Platform.OS === "web" ? (
            // @ts-ignore — iframe is web-only
            <iframe
              srcDoc={previewHtml}
              style={{ flex: 1, border: "none", width: "100%", height: "100%" } as any}
              title="PDF Preview"
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
              <Text style={{ color: COLORS.sub, textAlign: "center", fontSize: 16, lineHeight: 24 }}>
                {t("preview_web_only", { defaultValue: "O preview está disponível na versão web da aplicação." })}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- UI helpers ---------- */
function ZoomWrap({ zoom, children }: { zoom: number; children: React.ReactNode }) {
  if (Platform.OS === "web") {
    // @ts-ignore — raw div + CSS zoom is web-only and reflows the layout correctly
    return <div style={{ zoom: String(zoom) }}>{children}</div>;
  }
  return <View style={{ transform: [{ scale: zoom }] }}>{children}</View>;
}

function MenuItem({
  label,
  onPress,
  tone = "neutral",
}: {
  label: string;
  onPress: () => void;
  tone?: "neutral" | "danger";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [ss.menuItem, pressed && { opacity: 0.85 }]}
    >
      <Text style={[ss.menuItemText, tone === "danger" && { color: COLORS.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------- Grids ---------- */
function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <View style={ss.gridRow}>
      {React.Children.map(children, (child, i) => (
        <View key={i} style={ss.col2}>
          {child}
        </View>
      ))}
    </View>
  );
}
function Grid3({ children }: { children: React.ReactNode }) {
  return (
    <View style={ss.gridRow}>
      {React.Children.map(children, (child, i) => (
        <View key={i} style={ss.col3}>
          {child}
        </View>
      ))}
    </View>
  );
}
function Grid4({ children }: { children: React.ReactNode }) {
  return (
    <View style={ss.gridRow}>
      {React.Children.map(children, (child, i) => (
        <View key={i} style={ss.col4}>
          {child}
        </View>
      ))}
    </View>
  );
}

/* ---------- Primitivos ---------- */
function Section({
  title,
  children,
  right,
  collapsible,
  defaultCollapsed,
  summary,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  summary?: string;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const showBody = collapsible ? open : true;
  return (
    <View style={ss.section}>
      <View style={ss.sectionHeader}>
        {collapsible ? (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginRight: 8 }}
          >
            <Text style={ss.sectionChevron}>{open ? "▾" : "▸"}</Text>
            <Text style={ss.sectionTitle} numberOfLines={1}>{title}</Text>
            {!open && summary ? (
              <Text style={ss.sectionSummary} numberOfLines={1}>{summary}</Text>
            ) : null}
          </Pressable>
        ) : (
          <Text style={ss.sectionTitle}>{title}</Text>
        )}
        {right}
      </View>
      {showBody && children}
    </View>
  );
}

function Input({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
  placeholder,
  compact,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <View style={{ marginBottom: compact ? 0 : 8, flex: 1 }}>
      {label ? <Text style={ss.label}>{label}</Text> : null}
      <TextInput
        style={[
          ss.input,
          { width: "100%" },
          multiline && { minHeight: 90, textAlignVertical: "top" },
        ]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={COLORS.sub}
      />
    </View>
  );
}

function Num({
  label,
  value,
  onChange,
  compact,
}: {
  label?: string;
  value: number;
  onChange: (n: number) => void;
  compact?: boolean;
}) {
  return (
    <View style={{ marginBottom: compact ? 0 : 8, flex: 1 }}>
      {label ? <Text style={ss.label}>{label}</Text> : null}
      <TextInput
        style={[ss.input, { width: "100%" }]}
        keyboardType="numeric"
        value={String(value)}
        onChangeText={(v) => onChange(Number(v) || 0)}
        placeholderTextColor={COLORS.sub}
      />
    </View>
  );
}

/** Campo de hora com máscara HH:MM (teclado numérico) + validação inline. */
function TimeField({
  label,
  value,
  onChangeText,
  invalid,
  compact,
  placeholder,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  invalid?: boolean;
  compact?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => {
    setText(value ?? "");
  }, [value]);
  const showError = invalid ?? (text.trim().length > 0 && !isValidTimeStr(text));
  return (
    <View style={{ marginBottom: compact ? 0 : 8, flex: 1 }}>
      {label ? <Text style={ss.label}>{label}</Text> : null}
      <TextInput
        style={[ss.input, { width: "100%" }, showError && ss.inputError]}
        value={text}
        onChangeText={(v) => {
          const m = maskTime(v);
          setText(m);
          onChangeText(m);
        }}
        keyboardType="numeric"
        placeholder={placeholder ?? "00:00"}
        placeholderTextColor={COLORS.sub}
        maxLength={5}
      />
    </View>
  );
}

/** Campo de data com calendário (funciona igual na web/iOS/Android, sem dependências). */
function DateField({
  label,
  value,
  onChangeText,
  invalid,
  compact,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  invalid?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const display = formatDateDisplay(value, i18n.language) || value || "";
  const showError = invalid ?? (!!value && parseISO(value) === null);
  return (
    <View style={{ marginBottom: compact ? 0 : 8, flex: 1 }}>
      {label ? <Text style={ss.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [ss.input, ss.dateField, showError && ss.inputError, pressed && { opacity: 0.85 }]}
      >
        <Text style={[ss.dateFieldText, !display && { color: COLORS.sub }]} numberOfLines={1}>
          {display || t("pick_date")}
        </Text>
        <Text style={ss.dateFieldIcon}>▾</Text>
      </Pressable>
      <CalendarModal
        visible={open}
        value={value}
        onClose={() => setOpen(false)}
        onPick={(iso) => {
          onChangeText(iso);
          setOpen(false);
        }}
      />
    </View>
  );
}

function CalendarModal({
  visible,
  value,
  onClose,
  onPick,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onPick: (iso: string) => void;
}) {
  const { t } = useTranslation();
  const lang = i18n.language;
  const [view, setView] = useState(() => (parseISO(value) ?? dayjs()).startOf("month"));
  useEffect(() => {
    if (visible) setView((parseISO(value) ?? dayjs()).startOf("month"));
  }, [visible]);

  const daysInMonth = view.daysInMonth();
  const firstWeekday = (view.startOf("month").day() + 6) % 7; // segunda-feira primeiro
  const selected = parseISO(value);
  const selectedIso = selected ? selected.format("YYYY-MM-DD") : "";
  const todayStr = dayjs().format("YYYY-MM-DD");
  const headers = weekdayHeaders(lang);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={ss.calBackdrop} onPress={onClose}>
        <Pressable style={ss.calCard} onPress={() => {}}>
          <View style={ss.calHeader}>
            <Pressable onPress={() => setView(view.subtract(1, "month"))} hitSlop={10} style={ss.calNav}>
              <Text style={ss.calNavText}>‹</Text>
            </Pressable>
            <Text style={ss.calTitle}>{monthTitle(view, lang)}</Text>
            <Pressable onPress={() => setView(view.add(1, "month"))} hitSlop={10} style={ss.calNav}>
              <Text style={ss.calNavText}>›</Text>
            </Pressable>
          </View>
          <View style={ss.calWeekRow}>
            {headers.map((h, i) => (
              <Text key={i} style={ss.calWeekday}>{h}</Text>
            ))}
          </View>
          <View style={ss.calGrid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={i} style={ss.calCell} />;
              const iso = view.date(d).format("YYYY-MM-DD");
              const isSel = iso === selectedIso;
              const isToday = iso === todayStr;
              return (
                <Pressable
                  key={i}
                  onPress={() => onPick(iso)}
                  style={({ pressed }) => [
                    ss.calCell,
                    ss.calCellDay,
                    isSel && ss.calCellSel,
                    !isSel && isToday && ss.calCellToday,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[ss.calCellText, isSel && ss.calCellTextSel]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={ss.calActions}>
            <Pressable onPress={() => onPick(todayStr)} style={({ pressed }) => [ss.calTodayBtn, pressed && { opacity: 0.85 }]}>
              <Text style={ss.calTodayText}>{t("today")}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={({ pressed }) => [ss.calCloseBtn, pressed && { opacity: 0.85 }]}>
              <Text style={ss.calCloseText}>{t("close")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ss.pill, pressed && { opacity: 0.85 }]}>
      <Text style={ss.pillText}>{label}</Text>
    </Pressable>
  );
}

function CardStat({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <View style={[ss.card, big && { borderColor: COLORS.text }]}>
      <Text style={ss.cardK}>{k}</Text>
      <Text style={[ss.cardV, big && { fontSize: 22 }]}>{v}</Text>
    </View>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={[ss.metric, highlight && { borderColor: COLORS.text }]}>
      <Text style={ss.metricK}>{label}</Text>
      <Text style={ss.metricV}>{value}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */
const ss = StyleSheet.create({
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  backLink: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 15,
  },

  exportBtn: {
    borderWidth: 1,
    borderColor: COLORS.text,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.text,
  },
  exportBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
  },
  moreBtnText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 22,
    marginTop: -8,
  },

  titleInput: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 2,
    paddingVertical: 6,
  },
  subtitle: { color: COLORS.sub, fontSize: 12, marginBottom: 2 },
  producerSubtitle: { color: COLORS.sub, fontSize: 13, fontWeight: "600", marginBottom: 12 },

  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    width: "48%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardK: { color: COLORS.sub, fontSize: 12, marginBottom: 6 },
  cardV: { color: COLORS.text, fontSize: 18, fontWeight: "900" },

  section: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },

  helperTitle: {
    width: "100%",
    marginTop: 14,
    marginBottom: 6,
    color: COLORS.sub,
    fontSize: 13,
    fontWeight: "700",
  },
  blockTitle: {
    width: "100%",
    marginTop: 18,
    marginBottom: 10,
    fontWeight: "900",
    color: COLORS.text,
    fontSize: 14,
  },

  gridRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  col2: { flexBasis: "48%", minWidth: "48%", flexGrow: 1 },
  col3: { flexBasis: "31%", minWidth: "31%", flexGrow: 1 },
  col4: { flexBasis: "23%", minWidth: "23%", flexGrow: 1 },

  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 15,
  },
  label: { color: COLORS.sub, fontSize: 12, marginBottom: 6, fontWeight: "800" },

  pill: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  pillText: { color: COLORS.text, fontWeight: "900", fontSize: 13 },

  pillDanger: {
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  pillDangerText: { color: COLORS.danger, fontWeight: "900", fontSize: 13 },

  dayCard: {
    backgroundColor: COLORS.cardAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },

  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dayHeaderTitle: {
    fontWeight: "900",
    color: COLORS.text,
    fontSize: 14,
  },

  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  metric: {
    flexGrow: 1,
    minWidth: "31%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  metricK: { color: COLORS.sub, fontSize: 11, fontWeight: "700" },
  metricV: { color: COLORS.text, fontSize: 15, fontWeight: "900", marginTop: 2 },

  viewToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "transparent",
  },
  viewToggleBtnActive: {
    backgroundColor: COLORS.text,
  },
  viewToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.sub,
  },
  viewToggleTextActive: {
    color: COLORS.bg,
  },
  expandBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  expandBtnText: {
    fontSize: 14,
    color: COLORS.text,
  },

  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
    padding: 14,
  },
  menuCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
  },
  menuTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  menuItem: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "transparent",
  },
  menuItemText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14,
    textAlign: "center",
  },
  menuClose: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.cardAlt,
  },
  menuCloseText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14,
    textAlign: "center",
  },
  disclaimerBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.cardAlt,
  },
  disclaimerText: {
    fontSize: 11,
    color: COLORS.sub,
    lineHeight: 16,
  },

  splitRow: {
    flex: 1,
    flexDirection: "row",
  },
  formPane: {
    flex: 6,
    minWidth: 0,
    overflow: "hidden" as const,
  },
  previewPanel: {
    flex: 5,
    borderLeftWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },

  previewOverlay: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  previewTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
    marginRight: 12,
  },
  previewCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewCloseText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  zoomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: COLORS.card,
  },
  zoomBtn: {
    width: 30,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBtnMid: {
    height: 34,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 48,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
  },
  zoomBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },

  /* ---- Save status ---- */
  saveStatus: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.sub,
  },

  /* ---- Inline validation ---- */
  inputError: {
    borderColor: COLORS.danger,
    borderWidth: 1.5,
    backgroundColor: "#FFF5F5",
  },

  /* ---- Field hint (meal/dinner clarification) ---- */
  fieldHint: {
    fontSize: 11,
    color: COLORS.sub,
    marginTop: -2,
    marginBottom: 4,
    fontStyle: "italic",
  },

  /* ---- Date field (opens calendar) ---- */
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateFieldText: { color: COLORS.text, fontSize: 15, flex: 1 },
  dateFieldIcon: { color: COLORS.sub, fontSize: 11, marginLeft: 6 },

  /* ---- Calendar modal ---- */
  calBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calNav: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.cardAlt,
  },
  calNavText: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  calTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  calWeekRow: { flexDirection: "row", marginBottom: 6 },
  calWeekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.sub,
    textTransform: "uppercase",
  },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  calCellDay: { borderRadius: 10 },
  calCellSel: { backgroundColor: COLORS.text, borderRadius: 10 },
  calCellToday: {
    borderWidth: 1.5,
    borderColor: COLORS.text,
    borderRadius: 10,
  },
  calCellText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  calCellTextSel: { color: "#fff", fontWeight: "900" },
  calActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  calTodayBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    backgroundColor: COLORS.cardAlt,
  },
  calTodayText: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  calCloseBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: COLORS.text,
  },
  calCloseText: { fontSize: 14, fontWeight: "900", color: "#fff" },

  /* ---- Day card: chevron + summary ---- */
  dayChevron: { fontSize: 13, color: COLORS.sub, fontWeight: "900", width: 14 },
  daySummary: { fontSize: 12, color: COLORS.sub, fontWeight: "600", flexShrink: 1 },

  /* ---- Ghost pill (Duplicate day) ---- */
  pillGhost: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: COLORS.card,
  },
  pillGhostText: { color: COLORS.text, fontWeight: "800", fontSize: 12 },

  /* ---- Desktop table view ---- */
  tRowHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderColor: COLORS.border,
  },
  tCellHead: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.sub,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  tRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  tRowAlt: { backgroundColor: COLORS.cardAlt },
  tCellNum: { fontSize: 13, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  tCellVal: { fontSize: 13, fontWeight: "700", color: COLORS.text, paddingHorizontal: 4 },
  tIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
  },
  tIconText: { fontSize: 13, fontWeight: "900", color: COLORS.text },
  tcNum: { width: 34 },
  tcDate: { width: 150, paddingHorizontal: 4 },
  tcDesc: { width: 170, paddingHorizontal: 4 },
  tcTime: { width: 82, paddingHorizontal: 4 },
  tcTransp: { width: 78, paddingHorizontal: 4 },
  tcHt: { width: 72 },
  tcTotal: { width: 104 },
  tcAct: { width: 76 },
  tcExtra: { width: 60 },

  /* ---- Section collapse ---- */
  sectionChevron: { fontSize: 13, color: COLORS.sub, fontWeight: "900", width: 14 },
  sectionSummary: { fontSize: 13, color: COLORS.sub, fontWeight: "600", flexShrink: 1 },

  /* ---- Mobile fullscreen CTA ---- */
  fsCta: {
    borderWidth: 1.5,
    borderColor: COLORS.text,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.card,
    marginBottom: 10,
    alignItems: "center",
  },
  fsCtaText: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  fsCtaHint: { color: COLORS.sub, fontSize: 12, marginTop: 3, textAlign: "center" },
  rotateHint: { color: COLORS.sub, fontSize: 12, textAlign: "center", paddingHorizontal: 16, paddingBottom: 6 },

  /* ---- Add day (grid footer) ---- */
  addRowBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.text,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
  },
  addRowText: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
});
