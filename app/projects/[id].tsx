// app/projects/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useIsWide } from "../../src/ui/useBreakpoint";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../src/auth/AuthContext";
import { deleteProjectFromCloud, syncProjectToCloud } from "../../src/sync/syncService";
import { useTranslation } from "react-i18next";
import i18n from "../../src/i18n/i18n";
import {
  Alert,
  Dimensions,
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
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { CURRENCY, calcAll, calcTotals, minutesToHM } from "../../src/calc/engine";
import { Dia } from "../../src/calc/types";
import { getPreset } from "../../src/constants/countryPresets";
import { buildPdfHtml, buildEditableSheetHtml, buildEditableDayRowsHtml, fmtMoney, getStrings } from "../../src/export/buildPdfHtml";
import * as ScreenOrientation from "expo-screen-orientation";

// WebView só no nativo (na web usamos <iframe>); evita puxá-lo para o bundle web.
// Protegido: se o módulo não estiver disponível, a app não rebenta.
let WebView: any = null;
if (Platform.OS !== "web") {
  try { WebView = require("react-native-webview").WebView; } catch { WebView = null; }
}
import { exportPDF } from "../../src/export/pdf";
import { useLivePreview } from "../../src/contexts/LivePreviewContext";
import { ProjectState } from "../../src/models/project";
import { getSettings } from "../../src/storage/appSettings";
import { defaultCondBoxes, getActiveProfile } from "../../src/storage/profile";
import {
  deleteArchivedProject,
  deleteProject,
  duplicateProject,
  getProject,
  markProjectPaidAndArchive,
  markProjectToReceive,
  saveProject,
} from "../../src/storage/projects";
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
  const { width: winW, height: winH } = useWindowDimensions();
  // "Telemóvel" = menor dimensão < 600px (distingue telemóvel de tablet/desktop
  // independentemente da orientação; um telemóvel na horizontal continua telemóvel).
  // Nativo (iPhone E iPad) usa sempre o fluxo touch: página de stats + folha
  // em WebView com pinch-zoom. A grelha de desktop (zoom −/+) fica só na web.
  const isPhone = Platform.OS !== "web" || Math.min(winW, winH) < 600;
  const isPortrait = winH >= winW;
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

  // Título editável inline: tocar no nome transforma-o num campo de texto
  // no próprio sítio (sem diálogo); Enter/sair grava.
  const [editingTitle, setEditingTitle] = useState(false);
  const [renameVal, setRenameVal] = useState("");
  function openRenameTitle() {
    const p = projectRef.current;
    if (!p) return;
    setRenameVal(p.projeto.titulo || p.projeto.filme || "");
    setEditingTitle(true);
  }
  function saveTitleInline() {
    const p = projectRef.current;
    setEditingTitle(false);
    if (!p) return;
    const nome = renameVal.trim();
    if (!nome || nome === (p.projeto.titulo || p.projeto.filme || "")) return;
    // titulo é o que aparece na lista e na barra vermelha da folha
    setP("projeto", { ...p.projeto, titulo: nome });
  }

  // Toast de confirmação (ex.: "✓ Perfil aplicado")
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<any>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const [fsPreview, setFsPreview] = useState(false);
  const [editForm, setEditForm] = useState(false);
  // Opções de exportação/impressão (orientação + tamanho da letra).
  // ATENÇÃO: hooks têm de ficar ANTES do early return de loading (regras dos
  // hooks) — declará-los mais abaixo deixava o ecrã branco ao carregar.
  const [exportOpen, setExportOpen] = useState(false);
  // Export pendente: só corre depois de o diálogo fechar DE FACTO (onDismiss).
  // Apresentar o share sheet durante o fecho de um modal crashava a app no iOS.
  // No nativo o export só existe na página do projeto (sem modais empilhados).
  const pendingExportRef = useRef<null | { orientation: "landscape" | "portrait" }>(null);
  const [expOrientation, setExpOrientation] = useState<"landscape" | "portrait">("landscape");
  const [editHtml, setEditHtml] = useState(false);
  const [editHtmlContent, setEditHtmlContent] = useState("");
  const editIframeRef = useRef<any>(null);
  const editWebViewRef = useRef<any>(null);

  // Desktop (web largo): a folha editável no formato do PDF vive INLINE na
  // página — a mesma do telemóvel (contenteditable), com condições incluídas.
  const inlineSheet = Platform.OS === "web" && !isPhone;
  const inlineSheetRef = useRef<any>(null);
  const [inlineHtml, setInlineHtml] = useState("");
  // Edições vindas da própria folha não devem recarregar o iframe (perdia o foco)
  const sheetSelfEdit = useRef(false);
  const inlineRebuildTimer = useRef<any>(null);
  const [sheetZoom, setSheetZoom] = useState(() =>
    isPhone ? Math.max(0.25, Math.min(1, (winW - 2 * PAGE_X) / SHEET_W)) : 1
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
    // Projetos sem condições próprias (sem perfil aplicado) mostram as
    // predefinidas da app, já editáveis e incluídas no PDF.
    const condBoxes =
      Array.isArray(p.condBoxes) && p.condBoxes.length
        ? p.condBoxes
        : (p.condicoes || "").trim()
          ? p.condBoxes
          : defaultCondBoxes();
    const normalized: ProjectState = {
      ...p,
      tabela: { multHEA: 1.5, multHEB: 2.0, multHR: 3.0, limiar_A: 11, limiar_B: 18, ...p.tabela, ajudas: aj },
      dias,
      fiscal: fiscal as any,
      condBoxes,
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

  // Ajusta o zoom para caber a tabela toda em ecrã inteiro — em qualquer
  // orientação (ao rodar para horizontal, o telemóvel fica >= 768px e passava
  // a "wide", deixando de reajustar; por isso NÃO dependemos de isWide aqui).
  useEffect(() => {
    if (fsPreview) {
      const fit = Math.max(0.2, Math.min(1, (winW - 24) / SHEET_W));
      setSheetZoom(fit);
    }
  }, [fsPreview, winW]);

  // Editor HTML (formato PDF, editável): ouve as edições vindas do iframe
  // (modal do telemóvel/web E folha inline do desktop)
  useEffect(() => {
    if (Platform.OS !== "web" || (!editHtml && !inlineSheet)) return;
    const handler = (e: any) => handleEditMessage(e);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [editHtml, inlineSheet]);

  // Folha inline do desktop: constrói ao carregar e reconstrói (com atraso,
  // para não recarregar a cada tecla) quando o projeto muda FORA da folha
  // (parâmetros avançados, fiscal, aplicar perfil…). Edições feitas na própria
  // folha não recarregam — o iframe atualiza-se a si próprio.
  useEffect(() => {
    if (!inlineSheet || !project) return;
    if (sheetSelfEdit.current) { sheetSelfEdit.current = false; return; }
    if (!inlineHtml) {
      setInlineHtml(buildEditSheet(project));
      return;
    }
    if (inlineRebuildTimer.current) clearTimeout(inlineRebuildTimer.current);
    inlineRebuildTimer.current = setTimeout(() => {
      const p = projectRef.current;
      if (p) setInlineHtml(buildEditSheet(p));
    }, 600);
    return () => { if (inlineRebuildTimer.current) clearTimeout(inlineRebuildTimer.current); };
  }, [inlineSheet, project]);

  // Web: o "voltar" do telemóvel/browser fecha o editor em vez de sair da
  // página (senão o gesto de recuar levava-te para a lista de projetos).
  useEffect(() => {
    if (Platform.OS !== "web" || !editHtml) return;
    window.history.pushState({ wsEditor: true }, "");
    const onPop = () => setEditHtml(false);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if ((window.history.state as any)?.wsEditor) window.history.back();
    };
  }, [editHtml]);

  // Ao fechar o editor em ecrã inteiro (desktop), ressincroniza a folha inline
  // (os campos de texto editados no modal não chegam por mensagens)
  useEffect(() => {
    if (!inlineSheet || editHtml) return;
    const p = projectRef.current;
    if (p) setInlineHtml(buildEditSheet(p));
  }, [editHtml]);

  // Ao sair do editor: iPhone volta ao vertical (a app é portrait-only no
  // telemóvel); iPad volta a rodar livremente.
  const restoreOrientation = () => {
    const scr = Dimensions.get("screen");
    if (Math.min(scr.width, scr.height) < 600) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    } else {
      ScreenOrientation.unlockAsync().catch(() => {});
    }
  };

  // Nativo (app): bloqueia o editor em horizontal; volta ao normal ao fechar
  useEffect(() => {
    if (Platform.OS === "web" || !editHtml) return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => { restoreOrientation(); };
  }, [editHtml]);

  // "Ver" (preview) no nativo também abre em horizontal — a folha é larga
  useEffect(() => {
    if (Platform.OS === "web" || !showPreview) return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => { restoreOrientation(); };
  }, [showPreview]);

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
      project.condicoes,
      { fiscal: project.fiscal as any, condTitulo: project.condTitulo, condBoxes: project.condBoxes }
    );
    return html.replace(
      "</body>",
      `<script>
(function(){
  function fit(){
    // Repõe zoom a 1 antes de medir — senão mede no espaço já ampliado e corta.
    document.documentElement.style.zoom = '1';
    var w = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
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
  document.addEventListener('DOMContentLoaded', function(){ fit(); setTimeout(fit, 60); setTimeout(fit, 300); });
  if(!window.ReactNativeWebView){ window.addEventListener('resize', fit); }
  window.addEventListener('orientationchange', function(){ setTimeout(fit, 250); });
  fit(); setTimeout(fit, 60);
})();
</script></body>`
    );
  }, [project, calculos, totais, regionCode, anyPreview]);

  // Pré-visualização do diálogo de exportação (a forma vertical/horizontal
  // vem do rácio A4 do contentor; table-layout fixed faz refluir como no print)
  const exportPreviewHtml = useMemo(() => {
    if (!exportOpen || !project) return "";
    const rPreset = getPreset(regionCode);
    const html = buildPdfHtml(
      project.perfil, project.projeto, project.dias, calculos, totais, project.tabela as any,
      project.notas, i18n.language, regionCode, rPreset.currency, t("tax_disclaimer"), project.condicoes,
      { fiscal: project.fiscal as any, condTitulo: project.condTitulo, condBoxes: project.condBoxes }
    );
    // Mesmo auto-ajuste do preview real: encolhe a folha para caber na largura
    // da miniatura (representa o print, que também encolhe uniformemente)
    // transform:scale funciona igual na web e no WKWebView (o zoom por CSS e o
    // viewport dinâmico não — o iOS trava a escala mínima em 0,25).
    return html.replace(
      "</body>",
      `<style>html{overflow:hidden} body{padding:6px}</style><script>
(function(){
  function fit(){
    var b = document.body, d = document.documentElement;
    if(!b) return;
    b.style.transform = ''; b.style.width = '';
    var w = Math.max(d.scrollWidth, b.scrollWidth);
    if(w <= 0) return;
    // 0.9 = folga à volta; translateX centra a folha no cartão
    var z = Math.min(1, window.innerWidth / w) * 0.9;
    var tx = Math.max(0, (window.innerWidth - w * z) / 2);
    b.style.width = w + 'px';
    b.style.transformOrigin = '0 0';
    b.style.transform = 'translate(' + tx + 'px, 4px) scale(' + z + ')';
  }
  document.addEventListener('DOMContentLoaded', function(){ fit(); setTimeout(fit, 60); setTimeout(fit, 300); });
  fit();
})();
</script></body>`
    );
  }, [exportOpen, project, calculos, totais, regionCode]);

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

  // ── Editor HTML (formato do PDF, editável): web = <iframe>, nativo = WebView ──
  function postEditCalc(p: ProjectState) {
    const calc = calcAll(p.dias, p.tabela);
    const tot = calcTotals(calc, p.fiscal as any);
    const cur = getPreset(regionCode).currency;
    const fmt = (n: number) => fmtMoney(Number(n) || 0, cur);
    const salG = Number(p.tabela.salarioDia || 0);
    // Total de dias: o valor editado à mão tem prioridade sobre a contagem
    const totalDias = (p.projeto as any).totalDias ??
      p.dias.reduce((a, x) => a + (x.diaSemTrabalho ? 0 : x.meioDia ? 0.5 : 1), 0);
    const dec = (min: number) => (Math.max(0, min) / 60).toFixed(1).replace(".", ",");
    const days = p.dias.map((x: any, i) => {
      const c: any = calc[i] || {};
      return {
        sal: fmt(x.salarioDia ?? salG),
        ht: minutesToHM(c.HT_min || 0), hd: minutesToHM(c.HD_min || 0),
        // Ajudas efetivas do dia (override do dia ?? global) vêm do motor
        d_ref: fmt(c.ajRef || 0), d_per: fmt(c.ajPer || 0), d_tel: fmt(c.ajTel || 0), d_viat: fmt(c.ajViat || 0), d_mat: fmt(c.ajMat || 0),
        hea_h: dec(c.HEA_min || 0), hea_v: fmt(c.HEA_valor || 0),
        heb_h: dec(c.HEB_min || 0), heb_v: fmt(c.HEB_valor || 0),
        hr_h: dec(c.HR_min || 0), hr_v: fmt(c.HR_valor || 0),
        tot: fmt(c.totalDia || 0),
      };
    });
    const payload = { type: "ws:calc", totalDias: String(totalDias).replace(".", ","), vb: fmt(tot.ValorBruto), irs: fmt(tot.IRS_valor), iva: fmt(tot.IVA_valor), vf: fmt(tot.ValorFinal), days };
    if (Platform.OS === "web") {
      editIframeRef.current?.contentWindow?.postMessage(payload, "*");
      inlineSheetRef.current?.contentWindow?.postMessage(payload, "*");
    } else {
      editWebViewRef.current?.injectJavaScript(`window.__wsApply(${JSON.stringify(payload)}); true;`);
    }
  }

  function buildEditSheet(p: ProjectState) {
    const rPreset = getPreset(regionCode);
    const calc = calcAll(p.dias, p.tabela as any);
    const tot = calcTotals(calc, p.fiscal as any);
    return buildEditableSheetHtml(
      p.perfil as any, p.projeto as any, p.dias, calc as any, tot as any, p.tabela as any,
      p.notas, i18n.language, regionCode, rPreset.currency, t("tax_disclaimer"), p.condicoes,
      { fiscal: p.fiscal as any, condTitulo: p.condTitulo, condBoxes: p.condBoxes }
    );
  }

  function openEditHtml() {
    const p0 = projectRef.current;
    if (!p0) return;
    // Semeia as taxas HE se ainda não existirem, para o input e o cálculo
    // coincidirem (e mudar o salário depois já não as altera).
    const base = Number(p0.tabela.salarioDia || 0) / (p0.tabela.H_dia || 11);
    const patch: any = {};
    if (p0.tabela.rateHEA == null) patch.rateHEA = Math.round(base * Number(p0.tabela.multHEA ?? 1.5) * 100) / 100;
    if (p0.tabela.rateHEB == null) patch.rateHEB = Math.round(base * Number(p0.tabela.multHEB ?? 2.0) * 100) / 100;
    if (p0.tabela.rateHR == null) patch.rateHR = Math.round(base * Number(p0.tabela.multHR ?? 3.0) * 100) / 100;
    let p = p0;
    if (Object.keys(patch).length) { p = { ...p0, tabela: { ...p0.tabela, ...patch } }; persist(p); }

    setEditHtmlContent(buildEditSheet(p));
    setEditHtml(true);
  }

  function handleEditMessage(ev: MessageEvent) {
    const d: any = ev.data;
    if (!d || !d.type) return;
    const p = projectRef.current;
    if (!p) return;
    if (d.type === "ws:ready") { postEditCalc(p); return; }

    // Tudo o que segue vem da própria folha e persiste o projeto — marca para
    // o efeito da folha inline NÃO a recarregar (perdia o foco/scroll)
    sheetSelfEdit.current = true;

    // Atualiza SÓ as linhas da tabela de dias (sem recarregar a folha — mantém
    // scroll, zoom e foco). A folha troca as <tr> via window.__wsSetRows.
    const pushRows = (next: ProjectState) => {
      const calc = calcAll(next.dias, next.tabela as any);
      const rowsHtml = buildEditableDayRowsHtml(next.dias, calc as any, next.tabela as any, getPreset(regionCode).currency);
      if (Platform.OS === "web") {
        const msg = { type: "ws:setRows", html: rowsHtml };
        editIframeRef.current?.contentWindow?.postMessage(msg, "*");
        inlineSheetRef.current?.contentWindow?.postMessage(msg, "*");
      } else {
        editWebViewRef.current?.injectJavaScript(`window.__wsSetRows(${JSON.stringify(rowsHtml)}); true;`);
      }
      postEditCalc(next);
    };

    if (d.type === "ws:addDay") {
      // Novo dia DO ZERO (duplicar é o outro botão): data +1 e tudo a zeros —
      // as ajudas e horas extra só entram quando forem cobradas/negociadas.
      // Para voltar ao automático numa célula, basta apagá-la.
      const last = p.dias[p.dias.length - 1];
      const nextDate =
        last?.data && dayjs(last.data).isValid()
          ? dayjs(last.data).add(1, "day").format("YYYY-MM-DD")
          : dayjs().format("YYYY-MM-DD");
      const novo: Dia = {
        descricao: t("day_description_default", { defaultValue: "Filmagem" }),
        data: nextDate, continuo: false, inicio: "08:00", refeicaoTrabalho: "00:30",
        jantarTrabalho: "00:00", fim: "20:00", meioDia: false,
        tempoTransporteMin: 0, diaSemTrabalho: false,
        // Ajudas a 0 (só entram quando negociadas); horas extra SEM override —
        // calculam automaticamente pelas condições do perfil (o utilizador
        // pode depois forçar 0 ou outro valor na própria folha).
        ajRefeicao: 0, ajViatura: 0, ajTelefone: 0, ajMaterial: 0, ajPerDiem: 0,
      } as Dia;
      const next = { ...p, dias: [...p.dias, novo] };
      persist(next);
      pushRows(next);
      return;
    }
    if (d.type === "ws:dupDay") {
      const i = Number(d.i);
      const src = p.dias[i];
      if (!src) return;
      const clone: Dia = { ...src, pago: false } as Dia;
      const dias = [...p.dias.slice(0, i + 1), clone, ...p.dias.slice(i + 1)];
      const next = { ...p, dias };
      persist(next);
      pushRows(next);
      return;
    }
    if (d.type === "ws:removeDay") {
      const i = Number(d.i);
      if (p.dias.length <= 1 || !p.dias[i]) return; // um projeto precisa de ≥1 dia
      const next = { ...p, dias: p.dias.filter((_, ix) => ix !== i) };
      persist(next);
      pushRows(next);
      return;
    }
    if (d.type !== "ws:edit") return;
    const num = (v: any) => Number(String(v).replace(",", ".")) || 0;
    // Números escritos na folha podem vir formatados ("250,00 €"). Vazio =
    // volta ao automático (override removido).
    const numOpt = (v: any): number | undefined => {
      const raw = String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, (m, off, str) =>
        // último separador é o decimal; pontos de milhar caem
        str.lastIndexOf(",") > str.lastIndexOf(".") ? "" : m
      ).replace(",", ".");
      if (raw === "" || raw === "-" || raw === ".") return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };
    // Campos numéricos por-dia editáveis diretamente na folha
    const DIA_NUM = new Set([
      "salarioDia", "ajRefeicao", "ajViatura", "ajTelefone", "ajMaterial", "ajPerDiem",
      "heaHoras", "hebHoras", "hrHoras", "heaValor", "hebValor", "hrValor", "totalDia",
    ]);
    let next: ProjectState = p;
    switch (d.k) {
      case "perfil": next = { ...p, perfil: { ...p.perfil, [d.f]: d.value } }; break;
      case "projeto": {
        const val = d.f === "totalDias" ? numOpt(d.value) : d.value;
        next = { ...p, projeto: { ...p.projeto, [d.f]: val } };
        break;
      }
      case "fiscal": next = { ...p, fiscal: { ...p.fiscal, [d.f]: num(d.value) } }; break;
      case "tabela": next = { ...p, tabela: { ...p.tabela, [d.f]: num(d.value) } }; break;
      case "ajudas": next = { ...p, tabela: { ...p.tabela, ajudas: { ...(p.tabela.ajudas as any), [d.f]: num(d.value) } } }; break;
      case "dia": {
        let val: any = d.value;
        if (d.f === "data") {
          const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(d.value).trim());
          if (!m) return; // data incompleta/ inválida — não guarda parcial
          val = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        } else if (d.f === "pago") {
          val = !!d.value;
        } else if (DIA_NUM.has(d.f)) {
          val = numOpt(d.value); // undefined = volta ao automático
        }
        next = { ...p, dias: p.dias.map((x, ix) => (ix === d.i ? { ...x, [d.f]: val } : x)) };
        break;
      }
      case "notas": next = { ...p, notas: d.value }; break;
      case "condicoes": next = { ...p, condicoes: d.value }; break;
      case "condTitulo": next = { ...p, condTitulo: d.value }; break;
      case "condBox": {
        const boxes = Array.isArray(p.condBoxes) ? [...p.condBoxes] : [];
        if (!boxes[d.i]) return;
        boxes[d.i] = { ...boxes[d.i], [d.f]: d.value };
        next = { ...p, condBoxes: boxes };
        break;
      }
      default: return;
    }
    persist(next);
    postEditCalc(next);
  }

  // ✅ Export robusto: usa SEMPRE o estado atual em memória (ref)
  async function handleExportPDF(opts?: { orientation: "landscape" | "portrait"; fontScale?: number }) {
    const p = projectRef.current;

    if (!p) {
      Alert.alert(t("error"), t("proj_not_ready"));
      return;
    }

    // Exports de PDF são ilimitados no plano gratuito (o PDF é o recibo com
    // que o técnico é pago — nunca se bloqueia).
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
        p.condicoes,
        {
          fiscal: p.fiscal as any,
          condTitulo: p.condTitulo,
          condBoxes: p.condBoxes,
          orientation: opts?.orientation ?? "landscape",
          fontScale: opts?.fontScale ?? 1,
        }
      );
    } catch (e) {
      console.error(e);
      Alert.alert(t("error"), t("pdf_error"));
    }
  }

  async function handleApplyActiveProfile() {
    const act = await getActiveProfile();
    if (!act) {
      // Toast além do Alert: no iOS um Alert disparado enquanto um modal fecha
      // pode ser engolido — o toast é nosso e aparece sempre.
      showToast(t("no_active_profile", { defaultValue: "Sem perfil ativo. Define um em Perfis." }));
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

    // Condições de trabalho (texto + caixas + título anual). Se o perfil ainda
    // não tiver caixas nem texto, aplica o modelo predefinido — assim as
    // condições saem SEMPRE no fim do PDF depois de aplicar o perfil.
    if ((act as any).condicoes) setP("condicoes", (act as any).condicoes);
    const profBoxes = Array.isArray((act as any).condBoxes) && (act as any).condBoxes.length
      ? (act as any).condBoxes
      : (!(act as any).condicoes ? defaultCondBoxes() : undefined);
    if (profBoxes) setP("condBoxes", profBoxes);
    if ((act as any).condTitulo) setP("condTitulo", (act as any).condTitulo);

    // (Impostos NÃO vêm do perfil: a fonte global é Definições › Região
    // Fiscal; exceções editam-se diretamente na folha do projeto.)

    // Condições fixas (linha de taxas): salário, taxas HE €/h e ajudas
    const fx = (act as any).fixas || {};
    const cur = projectRef.current!.tabela;
    const patch: any = { ...cur, ajudas: { ...cur.ajudas } };
    if (fx.salarioDia != null) patch.salarioDia = fx.salarioDia;
    if (fx.rateHEA != null) patch.rateHEA = fx.rateHEA;
    if (fx.rateHEB != null) patch.rateHEB = fx.rateHEB;
    if (fx.rateHR != null) patch.rateHR = fx.rateHR;
    if (fx.hDia != null) patch.H_dia = fx.hDia;
    if (fx.heaFromHour != null) patch.limiar_A = fx.heaFromHour - 1;
    if (fx.hebFromHour != null) patch.limiar_B = fx.hebFromHour - 1;
    if (fx.hrRestBelow != null) patch.limiar_HR = fx.hrRestBelow;
    if (fx.refeicao != null) patch.ajudas.refeicao = fx.refeicao;
    if (fx.telefone != null) patch.ajudas.telefone = fx.telefone;
    if (fx.viatura != null) patch.ajudas.viatura = fx.viatura;
    if (fx.material != null) patch.ajudas.material = fx.material;
    if (fx.perDiem != null) patch.ajudas.perDiem = fx.perDiem;
    setP("tabela", patch);

    // Reconstrói já a folha visível (inline no desktop / editor no telemóvel)
    // com os valores aplicados, sem esperar pelo rebuild com atraso
    const p2 = projectRef.current;
    if (p2 && Platform.OS === "web") {
      const html = buildEditSheet(p2);
      if (inlineSheet) setInlineHtml(html);
      if (editHtml) setEditHtmlContent(html);
    }

    showToast(t("toast_profile_applied", { defaultValue: "✓ Perfil aplicado — condições incluídas no PDF" }));
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

  // ------- Menu ⋯ (itens IDÊNTICOS ao menu da lista de projetos) -------

  function askConfirm(title: string, msg: string, onYes: () => void, yesLabel: string, destructive = false) {
    if (Platform.OS === "web") {
      if ((window as any).confirm(`${title}\n\n${msg}`)) onYes();
      return;
    }
    Alert.alert(title, msg, [
      { text: t("cancel"), style: "cancel" },
      { text: yesLabel, style: destructive ? "destructive" : "default", onPress: onYes },
    ]);
  }

  // pago ⟺ arquivado: marcar como pago arquiva; "a receber" desarquiva
  function handleTogglePaid() {
    const p = projectRef.current!;
    if (p.pago) {
      askConfirm(
        t("mark_to_receive", { defaultValue: "Marcar como a receber" }),
        t("unarchive_msg", { defaultValue: "Volta para 'A Receber' como não pago. Podes voltar a marcar como pago depois." }),
        async () => {
          await markProjectToReceive(p.id);
          await loadProject();
          showToast(t("toast_unarchived", { defaultValue: "✓ Projeto de volta a 'A Receber'" }));
        },
        t("mark_to_receive", { defaultValue: "Marcar como a receber" })
      );
    } else {
      askConfirm(
        t("mark_paid_title", { defaultValue: "Marcar como pago" }),
        t("mark_paid_archive_msg", { defaultValue: "O projeto passa a Pago e vai para Arquivados. Podes reverter em Arquivados › Desarquivar." }),
        async () => {
          await markProjectPaidAndArchive(p.id);
          await loadProject();
          showToast(t("toast_paid_archived", { defaultValue: "✓ Projeto marcado como pago e arquivado" }));
        },
        t("mark_paid", { defaultValue: "Marcar como pago" })
      );
    }
  }

  async function handleDuplicate() {
    try {
      const newId = await duplicateProject(projectRef.current!.id);
      router.push(`/projects/${newId}`);
    } catch (e) {
      console.error("Erro ao duplicar projeto", e);
    }
  }

  function handleDeleteProject() {
    const p = projectRef.current!;
    askConfirm(
      t("delete_project_title"),
      t("delete_project_msg"),
      async () => {
        // idempotentes: cobre o projeto esteja onde estiver (ativo/arquivado)
        await deleteProject(p.id).catch(() => {});
        await deleteArchivedProject(p.id).catch(() => {});
        if (user) await deleteProjectFromCloud(user.id, p.id);
        router.replace("/projects");
      },
      t("delete"),
      true
    );
  }

  async function handleClearAll() {
    const p = projectRef.current!;
    askConfirm(
      t("clear_project", { defaultValue: "Limpar projeto" }),
      t("are_you_sure"),
      async () => {
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
      t("delete"),
      true
    );
  }


  // (As secções "Parâmetros da tabela" e "Fiscal" saíram daqui: todos os
  // valores editam-se diretamente na folha; os parâmetros de base vêm do
  // perfil aplicado.)

  // Diálogo de exportação (orientação + previews). É renderizado DENTRO do
  // modal que estiver aberto (editor/preview): no iOS, um Modal irmão de outro
  // Modal apresentado nunca chega a aparecer — tem de ser filho.
  const runPendingExport = () => {
    const job = pendingExportRef.current;
    if (!job) return;
    pendingExportRef.current = null;
    handleExportPDF(job);
  };

  const renderExportDialog = () => (
    <Modal
      transparent
      animationType="fade"
      visible={exportOpen}
      onRequestClose={() => setExportOpen(false)}
      onDismiss={() => {
        // iOS: dispara quando o diálogo terminou mesmo de fechar — só aqui é
        // seguro apresentar o share sheet.
        if (Platform.OS === "ios" && pendingExportRef.current) setTimeout(runPendingExport, 300);
      }}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}
        onPress={() => setExportOpen(false)}
      >
        <Pressable
          style={{ width: "100%", maxWidth: 460, backgroundColor: COLORS.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: COLORS.border }}
          onPress={() => {}}
        >
          <Text style={{ fontSize: 17, fontWeight: "900", color: COLORS.text, textAlign: "center", marginBottom: 14 }}>
            {t("export_pdf", { defaultValue: "Exportar PDF" })}
          </Text>

          {/* Orientação com pré-visualização real de ambas */}
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
            {([
              { k: "landscape", label: t("print_landscape", { defaultValue: "Horizontal" }), ratio: 297 / 210 },
              { k: "portrait", label: t("print_portrait", { defaultValue: "Vertical" }), ratio: 210 / 297 },
            ] as const).map((o) => {
              const on = expOrientation === o.k;
              return (
                <Pressable key={o.k} onPress={() => setExpOrientation(o.k)} style={{ flex: 1 }}>
                  <View
                    style={{
                      width: "100%",
                      aspectRatio: o.ratio,
                      borderWidth: 2,
                      borderColor: on ? COLORS.text : COLORS.border,
                      borderRadius: 10,
                      overflow: "hidden",
                      backgroundColor: "#fff",
                    }}
                  >
                    {Platform.OS === "web" ? (
                      // @ts-ignore — iframe web-only
                      <iframe
                        srcDoc={exportPreviewHtml}
                        scrolling="no"
                        style={{ width: "100%", height: "100%", border: "none", pointerEvents: "none", overflow: "hidden" } as any}
                        title={o.label}
                      />
                    ) : WebView ? (
                      <View pointerEvents="none" style={{ flex: 1 }}>
                        <WebView source={{ html: exportPreviewHtml }} scrollEnabled={false} javaScriptEnabled style={{ flex: 1, backgroundColor: "#fff" }} />
                      </View>
                    ) : null}
                    {/* overlay: o clique seleciona o cartão (o iframe engolia-o) */}
                    <Pressable
                      onPress={() => setExpOrientation(o.k)}
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                  </View>
                  <Text style={{ textAlign: "center", marginTop: 6, fontWeight: "900", fontSize: 13, color: on ? COLORS.text : COLORS.sub }}>
                    {on ? "● " : "○ "}{o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => {
              if (Platform.OS === "web") {
                setExportOpen(false);
                handleExportPDF({ orientation: expOrientation });
                return;
              }
              // Nativo: agenda; o onDismiss do diálogo (iOS) dispara quando o
              // fecho termina. Timer = rede de segurança / Android.
              pendingExportRef.current = { orientation: expOrientation };
              setExportOpen(false);
              setTimeout(runPendingExport, Platform.OS === "ios" ? 2500 : 1200);
            }}
            style={({ pressed }) => [{ alignItems: "center", paddingVertical: 13, borderRadius: 999, backgroundColor: COLORS.text }, pressed && { opacity: 0.85 }]}
          >
            <Text style={{ color: COLORS.bg, fontWeight: "900", fontSize: 15 }}>{t("export_pdf", { defaultValue: "Exportar PDF" })}</Text>
          </Pressable>
          <Pressable onPress={() => setExportOpen(false)} style={({ pressed }) => [{ alignItems: "center", paddingVertical: 10, marginTop: 4 }, pressed && { opacity: 0.7 }]}>
            <Text style={{ color: COLORS.sub, fontWeight: "800", fontSize: 13 }}>{t("cancel", { defaultValue: "Cancelar" })}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Página do projeto no telemóvel: só os stats + botão para abrir a folha
  const renderMobileStats = () => {
    const gs = getStrings(i18n.language, regionCode);
    const currency = getPreset(regionCode).currency;
    const money = (n: number) => fmtMoney(Number(n) || 0, currency);
    const mName = new Intl.DateTimeFormat(i18n.language, { month: "long" }).format(new Date(2000, (project!.projeto.mes || 1) - 1, 1));
    const monthCap = mName.charAt(0).toUpperCase() + mName.slice(1);
    return (
      <View>
        {/* Título editável no próprio sítio: tocar → escrever → Enter/sair grava */}
        {editingTitle ? (
          <TextInput
            value={renameVal}
            onChangeText={setRenameVal}
            style={[ss.mStatsTitle, { borderBottomWidth: 2, borderColor: COLORS.border, paddingVertical: 2 }]}
            placeholder={t("project_name", { defaultValue: "Nome do projeto" })}
            placeholderTextColor={COLORS.sub}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveTitleInline}
            onBlur={saveTitleInline}
          />
        ) : (
          <Pressable onPress={openRenameTitle} hitSlop={6}>
            <Text style={ss.mStatsTitle} numberOfLines={2}>
              {project!.projeto.titulo || project!.projeto.filme || t("unnamed_project")}
              {"  "}<Ionicons name="pencil-outline" size={16} color={COLORS.sub} />
            </Text>
          </Pressable>
        )}
        <Text style={ss.mStatsSub}>{monthCap} {project!.projeto.ano}</Text>

        {/* Só "Editar folha" — o export vive dentro do editor (botão Export PDF) */}
        <Pressable onPress={openEditHtml} style={({ pressed }) => [ss.mOpenBtn, pressed && { opacity: 0.9 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="create-outline" size={17} color="#fff" />
            <Text style={ss.mOpenBtnText}>{t("edit_sheet", { defaultValue: "Editar folha" })}</Text>
          </View>
        </Pressable>

        {/* Botão direto (fora do menu ⋯): no iOS a ação disparada durante o
            fecho do menu podia ser engolida sem feedback nenhum */}
        <Pressable onPress={handleApplyActiveProfile} style={({ pressed }) => [ss.mOpenBtnGhost, pressed && { opacity: 0.9 }]}>
          <Text style={ss.mOpenBtnGhostText}>⤓ {t("apply_active_profile", { defaultValue: "Aplicar perfil ativo" })}</Text>
        </Pressable>

        <View style={ss.mStatsPanel}>
          <StatLine label={gs.totalDays} value={String(totalDias)} />
          <StatLine label={gs.vb} value={money(totais.ValorBruto)} />
          <StatLine label={gs.irs} value={money(totais.IRS_valor)} />
          <StatLine label={gs.iva} value={money(totais.IVA_valor)} />
          <StatLine label={gs.vf} value={money(totais.ValorFinal)} strong last />
        </View>

      </View>
    );
  };

  // Formulário de edição para telemóvel (tátil, sem tabela/zoom).
  const renderMobileForm = () => {
    const p = project!;
    const gs = getStrings(i18n.language, regionCode);
    const L = (x: string) => x.replace(/\s*:$/, "");
    const currency = getPreset(regionCode).currency;
    const money = (n: number) => fmtMoney(Number(n) || 0, currency);
    const curSym = getPreset(regionCode).currencySymbol;
    const aj = p.tabela.ajudas ?? {};
    const setTabela = (patch: any) => setP("tabela", { ...p.tabela, ...patch });
    const setAj = (patch: any) => setP("tabela", { ...p.tabela, ajudas: { ...aj, ...patch } });
    const salaryGlobal = Number(p.tabela.salarioDia || 0);
    const hDia = p.tabela.H_dia || 11;
    const vHEA = p.tabela.rateHEA ?? (salaryGlobal ? (salaryGlobal / hDia) * Number(p.tabela.multHEA ?? 1.5) : 0);
    const vHEB = p.tabela.rateHEB ?? (salaryGlobal ? (salaryGlobal / hDia) * Number(p.tabela.multHEB ?? 2.0) : 0);
    const vHR = p.tabela.rateHR ?? (salaryGlobal ? (salaryGlobal / hDia) * Number(p.tabela.multHR ?? 3.0) : 0);

    return (
      <View>
        <Section title={t("title_placeholder", { defaultValue: "Título" })}>
          <Input value={p.projeto.titulo ?? ""} onChangeText={(v) => setP("projeto", { ...p.projeto, titulo: v })} placeholder={t("title_placeholder", { defaultValue: "Título" })} compact />
        </Section>

        <Section
          title={L(gs.personalData)}
          collapsible
          defaultCollapsed
          right={
            <Pressable onPress={handleApplyActiveProfile} style={({ pressed }) => [ss.pill, pressed && { opacity: 0.85 }]}>
              <Text style={ss.pillText}>{t("apply_profile")} ⤓</Text>
            </Pressable>
          }
        >
          <Input label={L(gs.name)} value={p.perfil.nome} onChangeText={(v) => setP("perfil", { ...p.perfil, nome: v })} />
          <Input label={L(gs.role)} value={p.perfil.funcao} onChangeText={(v) => setP("perfil", { ...p.perfil, funcao: v })} />
          <Input label={L(gs.phone)} value={p.perfil.telefone} onChangeText={(v) => setP("perfil", { ...p.perfil, telefone: v })} />
          <Input label={L(gs.email)} value={p.perfil.email} onChangeText={(v) => setP("perfil", { ...p.perfil, email: v })} />
          <Input label={L(gs.nif)} value={p.perfil.nif ?? ""} onChangeText={(v) => setP("perfil", { ...p.perfil, nif: v })} />
          <Input label={L(gs.iban)} value={p.perfil.iban ?? ""} onChangeText={(v) => setP("perfil", { ...p.perfil, iban: v })} />
          <Input label={L(gs.swift)} value={p.perfil.swift ?? ""} onChangeText={(v) => setP("perfil", { ...p.perfil, swift: v })} />
          <Input label={L(gs.companyLabel)} value={p.perfil.empresa ?? ""} onChangeText={(v) => setP("perfil", { ...p.perfil, empresa: v })} />
        </Section>

        <Section title={L(gs.productionSection)} collapsible defaultCollapsed>
          <Input label={L(gs.film)} value={p.projeto.filme} onChangeText={(v) => setP("projeto", { ...p.projeto, filme: v })} />
          <Input label={L(gs.productionLabel)} value={p.projeto.produtora} onChangeText={(v) => setP("projeto", { ...p.projeto, produtora: v })} />
          <Input label={L(gs.productionNif)} value={p.projeto.nifProdutora ?? ""} onChangeText={(v) => setP("projeto", { ...p.projeto, nifProdutora: v })} />
        </Section>

        <Section title={t("fixed_conditions", { defaultValue: "Condições fixas (taxas)" })} collapsible defaultCollapsed>
          <Grid2>
            <Num label={`${L(gs.salary)} (${curSym})`} value={salaryGlobal} onChange={(n) => setTabela({ salarioDia: n })} />
            <Num label={`${L(gs.overtimeA)} (${curSym}/h)`} value={vHEA} onChange={(n) => setTabela({ rateHEA: n })} />
            <Num label={`${L(gs.overtimeB)} (${curSym}/h)`} value={vHEB} onChange={(n) => setTabela({ rateHEB: n })} />
            <Num label={`${L(gs.recoveryHours)} (${curSym}/h)`} value={vHR} onChange={(n) => setTabela({ rateHR: n })} />
            <Num label={`${L(gs.meal)} (${curSym})`} value={Number(aj.refeicao ?? 0)} onChange={(n) => setAj({ refeicao: n })} />
            <Num label={`${L(gs.telephone)} (${curSym})`} value={Number(aj.telefone ?? 0)} onChange={(n) => setAj({ telefone: n })} />
            <Num label={`${L(gs.vehicle)} (${curSym})`} value={Number(aj.viatura ?? 0)} onChange={(n) => setAj({ viatura: n })} />
            <Num label={`${L(gs.material)} (${curSym})`} value={Number(aj.material ?? 0)} onChange={(n) => setAj({ material: n })} />
            <Num label={`${L(gs.perDiem)} (${curSym})`} value={Number(aj.perDiem ?? 0)} onChange={(n) => setAj({ perDiem: n })} />
          </Grid2>
        </Section>

        <Section title={t("days", { defaultValue: "Dias" })}>
          {p.dias.map((d, i) => {
            const c = calculos[i] ?? ({} as any);
            return (
              <View key={i} style={[ss.dayCard, d.pago && ss.dayCardPaid]}>
                <View style={ss.dayHeader}>
                  <Text style={ss.dayHeaderTitle}>
                    {t("day", { defaultValue: "Dia" })} {i + 1}
                    {d.data ? `  ·  ${formatDateDisplay(d.data, i18n.language)}` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Pressable onPress={() => updateDia(i, { pago: !d.pago } as any)} style={[ss.pagoChip, d.pago && ss.pagoChipOn]}>
                      <Text style={[ss.pagoChipText, d.pago && ss.pagoChipTextOn]}>{d.pago ? "✓ " : ""}{t("paid", { defaultValue: "Pago" })}</Text>
                    </Pressable>
                    <Pressable onPress={() => duplicateDia(i)} style={({ pressed }) => [ss.pillGhost, pressed && { opacity: 0.85 }]}>
                      <Text style={ss.pillGhostText}>⧉</Text>
                    </Pressable>
                    {p.dias.length > 1 && (
                      <Pressable onPress={() => removeDia(i)} style={({ pressed }) => [ss.pillGhost, { borderColor: COLORS.danger }, pressed && { opacity: 0.85 }]}>
                        <Text style={[ss.pillGhostText, { color: COLORS.danger }]}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                <DateField label={L(gs.date)} value={d.data} onChangeText={(v) => updateDia(i, { data: v })} />
                <Input label={L(gs.description)} value={d.descricao ?? ""} onChangeText={(v) => updateDia(i, { descricao: v })} />
                <Grid3>
                  <TimeField label={L(gs.start)} value={d.inicio} onChangeText={(v) => updateDia(i, { inicio: v })} />
                  <TimeField label={L(gs.mealBreak)} value={d.refeicaoTrabalho} onChangeText={(v) => updateDia(i, { refeicaoTrabalho: v })} />
                  <TimeField label={L(gs.end)} value={d.fim} onChangeText={(v) => updateDia(i, { fim: v })} />
                </Grid3>
                <Grid2>
                  <Num label={t("transport_min", { defaultValue: "Transporte (min)" })} value={d.tempoTransporteMin ?? 0} onChange={(n) => updateDia(i, { tempoTransporteMin: Math.max(0, Math.round(n)) })} />
                  <Input
                    label={`${L(gs.salary)}/${t("day", { defaultValue: "dia" }).toLowerCase()} (${curSym})`}
                    keyboardType="numeric"
                    value={d.salarioDia != null ? String(d.salarioDia) : ""}
                    placeholder={money(salaryGlobal)}
                    onChangeText={(v) => updateDia(i, { salarioDia: v.trim() === "" ? undefined : Number(v.replace(",", ".")) || 0 } as any)}
                  />
                </Grid2>

                <View style={ss.metricsRow}>
                  <Metric label={L(gs.workHours)} value={minutesToHM(c.HT_min ?? 0)} />
                  <Metric label={L(gs.restHours)} value={minutesToHM(c.HD_min ?? 0)} />
                  <Metric label={L(gs.overtimeA)} value={`${((c.HEA_min ?? 0) / 60).toFixed(1)}h · ${money(c.HEA_valor ?? 0)}`} />
                  <Metric label={L(gs.overtimeB)} value={`${((c.HEB_min ?? 0) / 60).toFixed(1)}h · ${money(c.HEB_valor ?? 0)}`} />
                  <Metric label={L(gs.recoveryHours)} value={`${((c.HR_min ?? 0) / 60).toFixed(1)}h · ${money(c.HR_valor ?? 0)}`} />
                  <Metric label={L(gs.total)} value={money(c.totalDia ?? 0)} highlight />
                </View>
              </View>
            );
          })}

          <Pressable onPress={addDia} style={({ pressed }) => [ss.addRowBtn, pressed && { opacity: 0.85 }]}>
            <Text style={ss.addRowText}>+ {t("add_day")}</Text>
          </Pressable>
        </Section>

        <Section title={L(gs.notes)}>
          <Input value={p.notas || ""} onChangeText={(v) => setP("notas", v)} multiline placeholder="…" compact />
        </Section>

        <Section title={L(gs.workConditions)}>
          <Input value={p.condicoes || ""} onChangeText={(v) => setP("condicoes", v)} multiline placeholder="…" compact />
        </Section>

        <Section title={t("totals", { defaultValue: "Totais" })}>
          <View style={ss.metricsRow}>
            <Metric label={L(gs.gross)} value={money(totais.ValorBruto)} />
            <Metric label={gs.irs} value={money(totais.IRS_valor)} />
            <Metric label={gs.iva} value={money(totais.IVA_valor)} />
            <Metric label={L(gs.net)} value={money(totais.ValorFinal)} highlight />
          </View>
        </Section>
      </View>
    );
  };

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
      removeLabel={t("remove_day")}
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
      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      >
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
              {/* Zoom da folha inline (envia para o iframe) */}
              {!isPhone && (
                <View style={ss.zoomRow}>
                  <Pressable
                    onPress={() => {
                      const z = Math.max(0.25, Math.round((sheetZoom - 0.1) * 10) / 10);
                      setSheetZoom(z);
                      inlineSheetRef.current?.contentWindow?.postMessage({ type: "ws:zoom", zoom: z }, "*");
                    }}
                    style={({ pressed }) => [ss.zoomBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={ss.zoomBtnText}>−</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setSheetZoom(1);
                      inlineSheetRef.current?.contentWindow?.postMessage({ type: "ws:zoom", zoom: "auto" }, "*");
                    }}
                    style={({ pressed }) => [ss.zoomBtnMid, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={ss.zoomBtnText}>{Math.round(sheetZoom * 100)}%</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const z = Math.min(2, Math.round((sheetZoom + 0.1) * 10) / 10);
                      setSheetZoom(z);
                      inlineSheetRef.current?.contentWindow?.postMessage({ type: "ws:zoom", zoom: z }, "*");
                    }}
                    style={({ pressed }) => [ss.zoomBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={ss.zoomBtnText}>+</Text>
                  </Pressable>
                </View>
              )}

              {!isPhone && (
                <Pressable
                  onPress={openEditHtml}
                  style={({ pressed }) => [ss.exportBtn, pressed && { opacity: 0.85 }]}
                >
                  {/* Fullscreen: abre a MESMA folha em ecrã inteiro (modal).
                      Ícone do pacote — o carácter ⛶ não existia nas fontes do macOS */}
                  <Ionicons name="expand-outline" size={15} color="#fff" />
                </Pressable>
              )}

              {/* Aplicar perfil ativo — botão visível no desktop (vivia na
                  grelha antiga que foi substituída pela folha) */}
              {!isPhone && (
                <Pressable
                  onPress={handleApplyActiveProfile}
                  style={({ pressed }) => [ss.applyBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={ss.applyBtnText}>⤓ {t("apply_profile", { defaultValue: "Aplicar perfil" })}</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => setExportOpen(true)}
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
          {isPhone ? (
            renderMobileStats()
          ) : (
            <>
              {/* Folha editável no formato do PDF — exatamente a mesma do
                  telemóvel (contenteditable, com condições), inline na página */}
              {/* @ts-ignore — iframe é web-only (desktop implica web aqui) */}
              <iframe
                ref={inlineSheetRef}
                srcDoc={inlineHtml}
                style={{
                  width: "100%",
                  height: Math.max(560, winH - 230),
                  border: "1px solid #E5E6EA",
                  borderRadius: 10,
                  backgroundColor: "#fff",
                } as any}
                title="Folha editável"
              />
            </>
          )}
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

            {/* Itens idênticos ao menu ⋯ da lista de projetos. "Aplicar perfil
                ativo" saiu daqui: já existe como botão na própria página.
                Nota iOS: Alerts durante o fecho de um modal são engolidos —
                daí o setTimeout de 450ms em tudo o que confirma. */}
            <MenuItem
              label={project.pago
                ? t("mark_to_receive", { defaultValue: "Marcar como a receber" })
                : t("mark_paid", { defaultValue: "Marcar como pago" })}
              onPress={() => {
                setMenuOpen(false);
                setTimeout(() => handleTogglePaid(), 450);
              }}
            />

            <MenuItem
              label={t("rename")}
              onPress={() => {
                setMenuOpen(false);
                setTimeout(() => openRenameTitle(), 450);
              }}
            />

            <MenuItem
              label={t("duplicate")}
              onPress={() => {
                setMenuOpen(false);
                setTimeout(() => handleDuplicate(), 450);
              }}
            />

            <MenuItem
              label={t("clear_project")}
              tone="danger"
              onPress={() => {
                setMenuOpen(false);
                setTimeout(() => handleClearAll(), 450);
              }}
            />

            <MenuItem
              label={t("delete")}
              tone="danger"
              onPress={() => {
                setMenuOpen(false);
                setTimeout(() => handleDeleteProject(), 450);
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
          {isPhone && isPortrait && (
            <Text style={ss.rotateHint}>
              {t("rotate_hint", { defaultValue: "Roda o telemóvel para a horizontal para veres a folha maior." })}
            </Text>
          )}
          <ScrollView
            contentContainerStyle={{ padding: 12, paddingBottom: 160 }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            <ScrollView horizontal>
              <ZoomWrap zoom={sheetZoom}>{renderSheet()}</ZoomWrap>
            </ScrollView>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Editar (formulário tátil) — telemóvel */}
      <Modal
        animationType="slide"
        visible={editForm}
        onRequestClose={() => setEditForm(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <View style={ss.previewHeader}>
            <Text style={ss.previewTitle} numberOfLines={1}>
              {project.projeto.titulo || project.projeto.filme || t("unnamed_project")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => setShowPreview(true)}
                hitSlop={10}
                style={({ pressed }) => [ss.previewCloseBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={ss.previewCloseText}>👁 {t("view_sheet_short", { defaultValue: "Ver" })}</Text>
              </Pressable>
              <Pressable
                onPress={() => setEditForm(false)}
                hitSlop={12}
                style={({ pressed }) => [ss.previewCloseBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={ss.previewCloseText}>✕ {t("close", { defaultValue: "Fechar" })}</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}>
            {renderMobileForm()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Editar no formato do PDF (iframe editável) — web */}
      <Modal
        animationType="slide"
        visible={editHtml}
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={() => setEditHtml(false)}
      >
        {/* SafeAreaProvider PRÓPRIO dentro do modal: mede a janela do modal e
            acompanha a rotação (os insets do ecrã por trás ficam em portrait
            quando forçamos landscape — era isso que cortava a folha à esquerda,
            debaixo do notch) */}
        <SafeAreaProvider>
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <View style={ss.previewHeader}>
            <Text style={ss.previewTitle} numberOfLines={1}>
              {project.projeto.titulo || project.projeto.filme || t("unnamed_project")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {saveStatus !== "idle" && (
                <Text style={[ss.saveStatus, saveStatus === "saved" && { color: "#1a9c4e" }]} numberOfLines={1}>
                  {saveStatus === "saving" ? t("saving") : `✓ ${t("saved")}`}
                </Text>
              )}
              {/* Exportar vive na página do projeto: no nativo, abrir o share
                  sheet por cima deste modal crashava o iOS (web mantém) */}
              {Platform.OS === "web" && (
                <Pressable onPress={() => setExportOpen(true)} hitSlop={8} style={({ pressed }) => [ss.exportBtn, pressed && { opacity: 0.85 }]}>
                  <Text style={ss.exportBtnText}>{t("export_pdf")}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setEditHtml(false)} hitSlop={12} style={({ pressed }) => [ss.previewCloseBtn, pressed && { opacity: 0.7 }]}>
                <Text style={ss.previewCloseText}>✕ {t("close", { defaultValue: "Fechar" })}</Text>
              </Pressable>
            </View>
          </View>
          {isPhone && isPortrait && (
            <Text style={ss.rotateHint}>
              {t("rotate_hint", { defaultValue: "Roda o telemóvel para a horizontal para veres a folha maior." })}
            </Text>
          )}
          {Platform.OS === "web" ? (
            // @ts-ignore — iframe é web-only
            <iframe
              ref={editIframeRef}
              srcDoc={editHtmlContent}
              style={{ flex: 1, border: "none", width: "100%", height: "100%" } as any}
              title="Editar folha"
            />
          ) : WebView ? (
            <WebView
              ref={editWebViewRef}
              originWhitelist={["*"]}
              source={{ html: editHtmlContent }}
              onMessage={(e: any) => {
                try { handleEditMessage({ data: JSON.parse(e.nativeEvent.data) } as any); } catch {}
              }}
              javaScriptEnabled
              domStorageEnabled
              keyboardDisplayRequiresUserAction={false}
              // Barra nativa do teclado com "OK" — é o botão para o baixar
              style={{ flex: 1, backgroundColor: "#fff" }}
            />
          ) : (
            // Fallback (WebView indisponível): formulário tátil
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}>
              {renderMobileForm()}
            </ScrollView>
          )}
          {Platform.OS === "web" && renderExportDialog()}
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

      {/* Preview overlay */}
      <Modal
        transparent
        animationType="slide"
        visible={showPreview}
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={() => setShowPreview(false)}
      >
        <SafeAreaProvider>
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={ss.previewOverlay}>
          <View style={ss.previewHeader}>
            <Text style={ss.previewTitle} numberOfLines={1}>
              {project.projeto.titulo || project.projeto.filme || t("unnamed_project")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {Platform.OS === "web" && (
                <Pressable
                  onPress={() => setExportOpen(true)}
                  hitSlop={8}
                  style={({ pressed }) => [ss.exportBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={ss.exportBtnText}>{t("export_pdf")}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setShowPreview(false)}
                hitSlop={12}
                style={({ pressed }) => [ss.previewCloseBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={ss.previewCloseText}>✕ {t("close", { defaultValue: "Fechar" })}</Text>
              </Pressable>
            </View>
          </View>

          {Platform.OS === "web" ? (
            // @ts-ignore — iframe is web-only
            <iframe
              srcDoc={previewHtml}
              style={{ flex: 1, border: "none", width: "100%", height: "100%" } as any}
              title="PDF Preview"
            />
          ) : WebView ? (
            <WebView
              originWhitelist={["*"]}
              source={{ html: previewHtml }}
              javaScriptEnabled
              style={{ flex: 1, backgroundColor: "#fff" }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
              <Text style={{ color: COLORS.sub, textAlign: "center", fontSize: 16, lineHeight: 24 }}>
                {t("preview_web_only", { defaultValue: "O preview está disponível na versão web da aplicação." })}
              </Text>
            </View>
          )}
          {Platform.OS === "web" && renderExportDialog()}
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

      {/* Opções de exportação/impressão do PDF — na página do projeto (sem
          outro modal aberto); dentro do editor/preview vai a instância nested */}
      {!editHtml && !showPreview && renderExportDialog()}

      {/* Toast de confirmação */}
      {toast && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute", bottom: 30, left: 16, right: 16,
            backgroundColor: "#137a3a", borderRadius: 12, paddingVertical: 12,
            paddingHorizontal: 16, alignItems: "center",
            shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>{toast}</Text>
        </View>
      )}
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

function StatLine({
  label,
  value,
  strong,
  last,
}: {
  label: string;
  value: string;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[ss.mStatRow, last && { borderBottomWidth: 0 }]}>
      <Text style={ss.mStatLabel}>{label}</Text>
      <Text style={[ss.mStatValue, strong && ss.mStatValueStrong]}>{value}</Text>
    </View>
  );
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
  // Estado local + tracking de foco → mantém o cursor estável e não fica em branco
  const [text, setText] = useState(value ?? "");
  const focused = useRef(false);
  useEffect(() => { if (!focused.current && (value ?? "") !== text) setText(value ?? ""); }, [value]);
  return (
    <View style={{ marginBottom: compact ? 0 : 8, flex: 1 }}>
      {label ? <Text style={ss.label}>{label}</Text> : null}
      <TextInput
        style={[
          ss.input,
          { width: "100%" },
          multiline && { minHeight: 90, textAlignVertical: "top" },
        ]}
        value={text}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setText(value ?? ""); }}
        onChangeText={(v) => { setText(v); onChangeText(v); }}
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
  // Estado local: dá para apagar o "0" e escrever à vontade; normaliza ao sair
  const [text, setText] = useState(String(value ?? 0));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current && Number(text.replace(",", ".")) !== Number(value)) setText(String(value ?? 0));
  }, [value]);
  return (
    <View style={{ marginBottom: compact ? 0 : 8, flex: 1 }}>
      {label ? <Text style={ss.label}>{label}</Text> : null}
      <TextInput
        style={[ss.input, { width: "100%" }]}
        keyboardType="numeric"
        value={text}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setText(String(Number(text.replace(",", ".")) || 0)); }}
        onChangeText={(v) => { setText(v); onChange(Number(v.replace(",", ".")) || 0); }}
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
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value ?? ""); }, [value]);
  const showError = invalid ?? (text.trim().length > 0 && !isValidTimeStr(text));
  // Campo de texto (00:00, sem relógio). Edição dígito a dígito; formata ao sair.
  const norm = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : maskTime(t);
  };
  return (
    <View style={{ marginBottom: compact ? 0 : 8, flex: 1 }}>
      {label ? <Text style={ss.label}>{label}</Text> : null}
      <TextInput
        style={[ss.input, { width: "100%" }, showError && ss.inputError]}
        value={text}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; const n = norm(text); setText(n); onChangeText(n); }}
        onChangeText={(v) => { setText(v); onChangeText(v); }}
        keyboardType="numbers-and-punctuation"
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
  applyBtn: {
    borderWidth: 1,
    borderColor: COLORS.text,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  applyBtnText: {
    color: COLORS.text,
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

  /* ---- Pago (dia) ---- */
  dayCardPaid: { borderLeftWidth: 4, borderLeftColor: "#1a9c4e" },
  pagoChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: COLORS.card },
  pagoChipOn: { borderColor: "#1a9c4e", backgroundColor: "#e4f6ea" },
  pagoChipText: { fontSize: 12, fontWeight: "900", color: COLORS.sub },
  pagoChipTextOn: { color: "#137a3a" },

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

  /* ---- Mobile project stats ---- */
  mStatsTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: 4 },
  mStatsSub: { color: COLORS.sub, fontSize: 14, fontWeight: "700", marginBottom: 14 },
  mOpenBtn: { backgroundColor: COLORS.text, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16, alignItems: "center", marginBottom: 10 },
  mOpenBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  mOpenBtnHint: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 3 },
  mOpenBtnGhost: { borderWidth: 1.5, borderColor: COLORS.text, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", marginBottom: 16, backgroundColor: COLORS.card },
  mOpenBtnGhostText: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  mStatsPanel: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, backgroundColor: COLORS.card, paddingHorizontal: 14 },
  mStatRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderColor: COLORS.border },
  mStatLabel: { color: COLORS.sub, fontSize: 14, fontWeight: "700" },
  mStatValue: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  mStatValueStrong: { fontSize: 18, fontWeight: "900" },

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
