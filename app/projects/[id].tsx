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

export default function ProjectEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isWide = useIsWide();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectState | null>(null);
  const projectRef = useRef<ProjectState | null>(null);
  const [regionCode, setRegionCode] = useState<string>("pt");

  // menu opções (⋯)
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fsPreview, setFsPreview] = useState(false);
  const fsIframeRef = useRef<any>(null);
  const { setPreviewHtml, clearPreview, zoom, setZoom, actualZoom } = useLivePreview();
  const [livePreviewEnabled, setLivePreviewEnabled] = useState(false);
  const livePreview = isWide && Platform.OS === "web" && livePreviewEnabled;

  // On desktop, two-column form only when live preview is NOT open
  const twoColForm = isWide && !livePreview;

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

  async function persist(next: ProjectState) {
    setProject(next);
    projectRef.current = next;
    await saveProject(next);
    if (user) syncProjectToCloud(user.id, next as any);
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

  const anyPreview = livePreview || showPreview || fsPreview;

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 70 }}>
        {/* Header */}
        <View style={{ paddingTop: paddingTop, paddingHorizontal: PAGE_X }}>
          <View style={ss.topbar}>
            <Pressable onPress={handleBack} hitSlop={10}>
              <Text style={ss.backLink}>‹ {t("projects")}</Text>
            </Pressable>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => {
                  if (isWide && Platform.OS === "web") {
                    setLivePreviewEnabled((v) => !v);
                  } else {
                    setShowPreview(true);
                  }
                }}
                style={({ pressed }) => [
                  ss.exportBtn,
                  livePreview && { backgroundColor: COLORS.text, borderColor: COLORS.text },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[ss.exportBtnText, livePreview && { color: COLORS.bg }]}>
                  {livePreview ? t("close") : t("preview", { defaultValue: "Preview" })}
                </Text>
              </Pressable>

              {isWide && Platform.OS === "web" && (
                <Pressable
                  onPress={() => setFsPreview(true)}
                  style={({ pressed }) => [ss.exportBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={ss.exportBtnText}>⛶</Text>
                </Pressable>
              )}

              {livePreview && (
                <View style={ss.zoomRow}>
                  <Pressable
                    onPress={() => {
                      const base = zoom === null ? actualZoom : zoom;
                      setZoom(Math.max(0.25, Math.round((base - 0.25) * 100) / 100));
                    }}
                    style={({ pressed }) => [ss.zoomBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={ss.zoomBtnText}>−</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setZoom(null)}
                    style={({ pressed }) => [ss.zoomBtnMid, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={ss.zoomBtnText}>{zoom === null ? "auto" : `${Math.round(zoom * 100)}%`}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const base = zoom === null ? actualZoom : zoom;
                      setZoom(Math.min(3, Math.round((base + 0.25) * 100) / 100));
                    }}
                    style={({ pressed }) => [ss.zoomBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={ss.zoomBtnText}>+</Text>
                  </Pressable>
                </View>
              )}

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

          {/* Título */}
          <TextInput
            style={ss.titleInput}
            placeholder={t("unnamed_project")}
            placeholderTextColor={COLORS.sub}
            value={project.projeto.filme}
            onChangeText={(v) =>
              setP("projeto", { ...project.projeto, filme: v })
            }
          />
          <Text style={ss.subtitle}>{t("report_subtitle")}</Text>
          {project.projeto.produtora ? (
            <Text style={ss.producerSubtitle}>{project.projeto.produtora}</Text>
          ) : null}
        </View>

        {/* Cards Totais */}
        <View style={[ss.cardsRow, { paddingHorizontal: PAGE_X }]}>
          <CardStat k={t("total_days")} v={`${totalDias}`} />
          <CardStat
            k={t("gross_value")}
            v={`${CURRENCY} ${Number(totais.ValorBruto).toFixed(2)}`}
          />
          <CardStat
            k={taxLabels.incomeTax}
            v={`${CURRENCY} ${Number(totais.IRS_valor).toFixed(2)}`}
          />
          <CardStat
            k={taxLabels.vat}
            v={`${CURRENCY} ${Number(totais.IVA_valor).toFixed(2)}`}
          />
          <CardStat
            k={t("final_value")}
            v={`${CURRENCY} ${Number(totais.ValorFinal).toFixed(2)}`}
            big
          />
        </View>

        <View style={{ paddingHorizontal: PAGE_X }}>
          {/* ── Two-column on wide screens ─────────────────────────────── */}
          <View style={twoColForm ? { flexDirection: "row", gap: 20, alignItems: "flex-start" } : {}}>

          {/* LEFT column: settings sections */}
          <View style={twoColForm ? { flex: 2 } : {}}>
          <Section
            title={t("technician_profile")}
            right={<Pill label={t("apply_profile")} onPress={handleApplyActiveProfile} />}
          >
            <Input
              label={t("name")}
              value={project.perfil.nome}
              onChangeText={(v) => setP("perfil", { ...project.perfil, nome: v })}
            />
            <Input
              label={t("email")}
              value={project.perfil.email}
              onChangeText={(v) => setP("perfil", { ...project.perfil, email: v })}
            />
            <Grid2>
              <Input
                label={t("phone")}
                value={project.perfil.telefone}
                onChangeText={(v) =>
                  setP("perfil", { ...project.perfil, telefone: v })
                }
              />
              <Input
                label={t("nif")}
                value={project.perfil.nif ?? ""}
                onChangeText={(v) => setP("perfil", { ...project.perfil, nif: v })}
              />
            </Grid2>
            <Input
              label={t("department")}
              value={project.perfil.departamento}
              onChangeText={(v) =>
                setP("perfil", { ...project.perfil, departamento: v })
              }
            />
            <Input
              label={t("role")}
              value={project.perfil.funcao}
              onChangeText={(v) => setP("perfil", { ...project.perfil, funcao: v })}
            />
            <Input
              label={t("company")}
              value={project.perfil.empresa ?? ""}
              onChangeText={(v) =>
                setP("perfil", { ...project.perfil, empresa: v })
              }
            />
            <Input
              label={t("iban")}
              value={project.perfil.iban ?? ""}
              onChangeText={(v) =>
                setP("perfil", { ...project.perfil, iban: v })
              }
            />
            <Input
              label={t("swift")}
              value={project.perfil.swift ?? ""}
              onChangeText={(v) =>
                setP("perfil", { ...project.perfil, swift: v })
              }
            />
          </Section>

          <Section title={t("project_section")}>
            <Grid2>
              <Input
                label={t("film_project")}
                value={project.projeto.filme}
                onChangeText={(v) =>
                  setP("projeto", { ...project.projeto, filme: v })
                }
              />
              <Input
                label={t("production_company")}
                value={project.projeto.produtora}
                onChangeText={(v) =>
                  setP("projeto", { ...project.projeto, produtora: v })
                }
              />
              <Input
                label={t("production_nif")}
                value={project.projeto.nifProdutora ?? ""}
                onChangeText={(v) =>
                  setP("projeto", { ...project.projeto, nifProdutora: v })
                }
              />
              <Input
                label={t("week")}
                value={project.projeto.semana ?? ""}
                onChangeText={(v) =>
                  setP("projeto", { ...project.projeto, semana: v })
                }
              />
              <Input
                label={t("month")}
                value={String(project.projeto.mes)}
                onChangeText={(v) =>
                  setP("projeto", { ...project.projeto, mes: Number(v) || 1 })
                }
                keyboardType="numeric"
              />
              <Input
                label={t("year")}
                value={String(project.projeto.ano)}
                onChangeText={(v) =>
                  setP("projeto", {
                    ...project.projeto,
                    ano: Number(v) || dayjs().year(),
                  })
                }
                keyboardType="numeric"
              />
            </Grid2>

            <Input
              label={t("notes_pdf")}
              value={project.notas || ""}
              onChangeText={(v) => setP("notas", v)}
              multiline
            />

            <Input
              label={t("conditions_pdf")}
              placeholder={t("conditions_pdf_placeholder")}
              value={project.condicoes || ""}
              onChangeText={(v) => setP("condicoes", v)}
              multiline
            />
          </Section>

          <Section title={t("table_params")}>
            <Grid3>
              <Num
                label={t("salary_day")}
                value={project.tabela.salarioDia ?? 0}
                onChange={(n) => setP("tabela", { ...project.tabela, salarioDia: n })}
              />
              <Num
                label={t("hours_day")}
                value={project.tabela.H_dia}
                onChange={(n) => setP("tabela", { ...project.tabela, H_dia: n })}
              />
              <Num
                label={t("min_rest")}
                value={project.tabela.descanso_min}
                onChange={(n) =>
                  setP("tabela", { ...project.tabela, descanso_min: n })
                }
              />
            </Grid3>

            <Text style={ss.blockTitle}>{t("allowances_day")}</Text>
            <Grid3>
              <Num
                label={t("allowance_meal")}
                value={project.tabela.ajudas?.refeicao ?? 0}
                onChange={(n) =>
                  setP("tabela", {
                    ...project.tabela,
                    ajudas: { ...project.tabela.ajudas, refeicao: n },
                  })
                }
              />
              <Num
                label={t("allowance_vehicle")}
                value={project.tabela.ajudas?.viatura ?? 0}
                onChange={(n) =>
                  setP("tabela", {
                    ...project.tabela,
                    ajudas: { ...project.tabela.ajudas, viatura: n },
                  })
                }
              />
              <Num
                label={t("allowance_material")}
                value={project.tabela.ajudas?.material ?? 0}
                onChange={(n) =>
                  setP("tabela", {
                    ...project.tabela,
                    ajudas: { ...project.tabela.ajudas, material: n },
                  })
                }
              />
            </Grid3>
            <Grid2>
              <Num
                label={t("allowance_phone")}
                value={project.tabela.ajudas?.telefone ?? 0}
                onChange={(n) =>
                  setP("tabela", {
                    ...project.tabela,
                    ajudas: { ...project.tabela.ajudas, telefone: n },
                  })
                }
              />
              <Num
                label={t("allowance_perdiem")}
                value={project.tabela.ajudas?.perDiem ?? 0}
                onChange={(n) =>
                  setP("tabela", {
                    ...project.tabela,
                    ajudas: { ...project.tabela.ajudas, perDiem: n },
                  })
                }
              />
            </Grid2>

            <Text style={ss.helperTitle}>{t("base_hour_mult")}</Text>
            <Grid3>
              <Num
                label={t("mult_hea")}
                value={project.tabela.multHEA ?? 1.5}
                onChange={(n) =>
                  setP("tabela", { ...project.tabela, multHEA: n || 1.5 })
                }
              />
              <Num
                label={t("mult_heb")}
                value={project.tabela.multHEB ?? 2.0}
                onChange={(n) =>
                  setP("tabela", { ...project.tabela, multHEB: n || 2.0 })
                }
              />
              <Num
                label={t("mult_hr")}
                value={project.tabela.multHR ?? 3.0}
                onChange={(n) =>
                  setP("tabela", { ...project.tabela, multHR: n || 3.0 })
                }
              />
            </Grid3>

            <Text style={ss.helperTitle}>{t("threshold_ab")}</Text>
            <Grid3>
              <Num
                label={t("threshold_a")}
                value={project.tabela.limiar_A ?? 11}
                onChange={(n) =>
                  setP("tabela", { ...project.tabela, limiar_A: n || 11 })
                }
              />
              <Num
                label={t("threshold_b")}
                value={project.tabela.limiar_B ?? 18}
                onChange={(n) =>
                  setP("tabela", { ...project.tabela, limiar_B: n || 18 })
                }
              />
              <Num
                label={t("threshold_hr")}
                value={project.tabela.limiar_HR ?? project.tabela.descanso_min ?? 11}
                onChange={(n) =>
                  setP("tabela", { ...project.tabela, limiar_HR: n || 11 })
                }
              />
            </Grid3>
          </Section>

          <Section title={t("fiscal_section")}>
            <Grid3>
              <Num
                label={taxLabels.incomeTax}
                value={project.fiscal.IRS_percent}
                onChange={(n) =>
                  setP("fiscal", { ...project.fiscal, IRS_percent: n })
                }
              />
              <Num
                label={taxLabels.vat}
                value={project.fiscal.IVA_percent}
                onChange={(n) =>
                  setP("fiscal", { ...project.fiscal, IVA_percent: n })
                }
              />
            </Grid3>

            <View style={{ marginTop: 4 }}>
              <Text style={ss.label}>{t("observation")}</Text>
              <TextInput
                style={ss.input}
                placeholder={t("fiscal_note_placeholder")}
                placeholderTextColor={COLORS.sub}
                value={project.fiscal.nota ?? ""}
                onChangeText={(v) =>
                  setP("fiscal", { ...project.fiscal, nota: v })
                }
              />
            </View>

            <View style={ss.disclaimerBox}>
              <Text style={ss.disclaimerText}>{t("tax_disclaimer")}</Text>
            </View>
          </Section>

          </View>
          {/* RIGHT column: days */}
          <View style={twoColForm ? { flex: 3 } : {}}>

          <Section title={t("days")} right={<Pill label={t("add_day")} onPress={addDia} />}>
            {project.dias.map((d, i) => {
              const c = calculos[i];
              return (
                <View key={i} style={ss.dayCard}>
                  <View style={ss.dayHeader}>
                    <Text style={ss.dayHeaderTitle}>{t("day_n", { n: i + 1 })}</Text>
                    {i > 0 ? (
                      <Pressable
                        onPress={() => removeDia(i)}
                        style={({ pressed }) => [ss.pillDanger, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={ss.pillDangerText}>{t("remove")}</Text>
                      </Pressable>
                    ) : (
                      <View />
                    )}
                  </View>
                  <Grid2>
                    <Input label={t("date_format")} value={d.data} onChangeText={(v) => updateDia(i, { data: v })} />
                    <Input label={t("description")} value={d.descricao || ""} onChangeText={(v) => updateDia(i, { descricao: v })} />
                  </Grid2>
                  <Grid2>
                    <Input label={t("start_time")} value={d.inicio} onChangeText={(v) => updateDia(i, { inicio: v })} />
                    <Input label={t("end_time")} value={d.fim} onChangeText={(v) => updateDia(i, { fim: v })} />
                  </Grid2>
                  <Grid2>
                    <Input label={t("meal_break")} value={d.refeicaoTrabalho} onChangeText={(v) => updateDia(i, { refeicaoTrabalho: v })} />
                    <Input label={t("dinner_break")} value={d.jantarTrabalho} onChangeText={(v) => updateDia(i, { jantarTrabalho: v })} />
                  </Grid2>
                  <Grid4>
                    <Num
                      label={t("transport_time")}
                      value={d.tempoTransporteMin ?? 0}
                      onChange={(n) => updateDia(i, { tempoTransporteMin: Math.max(0, Math.round(n)) })}
                    />
                  </Grid4>
                  <View style={ss.metricsRow}>
                    <Metric label={t("label_ht")} value={minutesToHM(c?.HT_min ?? 0)} />
                    <Metric label={t("label_hea")} value={minutesToHM(c?.HEA_min ?? 0)} />
                    <Metric label={t("label_heb")} value={minutesToHM(c?.HEB_min ?? 0)} />
                    <Metric label={t("label_hr")} value={minutesToHM(c?.HR_min ?? 0)} />
                    <Metric label={t("day_total")} value={`${CURRENCY} ${(c?.totalDia ?? 0).toFixed(2)}`} highlight />
                  </View>
                </View>
              );
            })}
          </Section>

          </View>
          {/* end right column */}
          </View>
          {/* end two-column row */}

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

      {/* Fullscreen preview (desktop) */}
      <Modal
        animationType="fade"
        visible={fsPreview}
        onRequestClose={() => setFsPreview(false)}
      >
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <View style={ss.previewHeader}>
            <Text style={ss.previewTitle} numberOfLines={1}>
              {project.projeto.filme || t("unnamed_project")}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Pressable
                onPress={() => setZoom(zoom === null ? 0.75 : Math.max(0.25, zoom - 0.25))}
                style={({ pressed }) => [ss.zoomBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={ss.zoomBtnText}>−</Text>
              </Pressable>
              <Pressable
                onPress={() => setZoom(null)}
                style={({ pressed }) => [ss.zoomBtnMid, pressed && { opacity: 0.7 }]}
              >
                <Text style={ss.zoomBtnText}>{zoom === null ? "auto" : `${Math.round(zoom * 100)}%`}</Text>
              </Pressable>
              <Pressable
                onPress={() => setZoom(zoom === null ? 1.25 : Math.min(3, zoom + 0.25))}
                style={({ pressed }) => [ss.zoomBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={ss.zoomBtnText}>+</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setFsPreview(false)}
              hitSlop={12}
              style={({ pressed }) => [ss.previewCloseBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={ss.previewCloseText}>✕ {t("close", { defaultValue: "Fechar" })}</Text>
            </Pressable>
          </View>
          {Platform.OS === "web" ? (
            // @ts-ignore — iframe is web-only
            <iframe
              ref={fsIframeRef}
              srcDoc={previewHtml}
              onLoad={() => {
                const win = fsIframeRef.current?.contentWindow;
                if (win && zoom !== null) {
                  win.postMessage({ type: "wrapsheet:zoom", zoom }, "*");
                }
              }}
              style={{ flex: 1, border: "none", width: "100%", height: "100%" } as any}
              title="PDF Preview Fullscreen"
            />
          ) : null}
        </View>
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
              {project.projeto.filme || t("unnamed_project")}
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
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={ss.section}>
      <View style={ss.sectionHeader}>
        <Text style={ss.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
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
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: 8, flex: 1 }}>
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
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={{ marginBottom: 8, flex: 1 }}>
      <Text style={ss.label}>{label}</Text>
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
});
