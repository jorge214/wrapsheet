// app/projects/index.tsx
import dayjs from "dayjs";
import { useFocusEffect, useRouter } from "expo-router";
import { useIsWide } from "../../src/ui/useBreakpoint";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../src/i18n/i18n";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProjectListItem as Project } from "../../src/storage/projects";
import {
  backfillProfileIds,
  belongsToProfile,
  clearProjectData,
  createProject,
  getProject,
  deleteProject,
  deleteArchivedProject,
  duplicateProjectToMonth,
  duplicateProjectToProfile,
  listProjects,
  listArchivedProjects,
  listAllProjectsFull,
  markProjectPaidAndArchive,
  markProjectToReceive,
  moveProjectToMonth,
  renameProject,
} from "../../src/storage/projects";
import { MonthYearModal } from "../../src/ui/MonthYearModal";
import {
  getActiveProfileId,
  listProfiles,
  Profile as UserProfile,
} from "../../src/storage/profile";
import { effectiveFiscalOf, getSettings } from "../../src/storage/appSettings";
import { projectFinalValue } from "../../src/stats/monthSummary";
import { formatMoneyApp } from "../../src/format/money";

type Row = Project & { archived?: boolean };
import { useAuth } from "../../src/auth/AuthContext";
import { deleteProjectFromCloud, syncProjectToCloud } from "../../src/sync/syncService";
import { FREE_PROJECT_LIMIT } from "../../src/storage/freeTier";
import { useTheme } from "../../src/theme/ThemeProvider";
import { MonthYearPicker } from "../../src/ui/MonthYearPicker";

function fmtMonthLabel(m: number, y: number, locale: string = "pt") {
  const date = new Date(y, m - 1, 1);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${y}`;
}
function toMMYYYY(m: number, y: number) {
  const mm = String(m).padStart(2, "0");
  return `${mm}/${y}`;
}
function parseMMYYYY(s: string): { m: number; y: number } | null {
  const [mmStr, yyStr] = (s || "").split("/");
  const m = Number(mmStr);
  const y = Number(yyStr);
  if (!m || !y || m < 1 || m > 12) return null;
  return { m, y };
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = i18n.language;
  const { COLORS, mode } = useTheme();
  const isWide = useIsWide();
  const s = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);

  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [archived, setArchived] = useState<Project[]>([]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Mensagem (toast) após uma ação — verde para sucesso, vermelho para apagar
  const [toast, setToast] = useState<{ msg: string; kind: "success" | "danger" } | null>(null);
  const toastTimer = useRef<any>(null);
  function showToast(msg: string, kind: "success" | "danger" = "success") {
    setToast({ msg, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // pasta ativa: todos / a receber / arquivados (pagos)
  const [tab, setTab] = useState<"todos" | "areceber" | "arquivados">("todos");
  // Pesquisa por nome (procura em TODOS os meses/pastas quando preenchida)
  const [search, setSearch] = useState("");

  // filtro mês
  const now = new Date();
  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [ano, setAno] = useState<number>(now.getFullYear());
  const [showAll, setShowAll] = useState<boolean>(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Multi-perfil: perfil ativo (para filtrar) + lista de perfis (para o
  // "duplicar para outro perfil"). O ativo é escolhido no ecrã de Perfis.
  const [activeProfileId, setActiveProfileId] = useState("");
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  // modal "duplicar para perfil"
  const [dupToProfileId, setDupToProfileId] = useState<string | null>(null);
  // Guarda anti-duplo-toque nas duplicações (evita duplicar 2x).
  const dupBusyRef = useRef(false);

  // modal opções (web)
  const [optsProject, setOptsProject] = useState<Row | null>(null);
  // Projeto a mover para outro mês (menu ⋯ → "Mover para outro mês")
  const [moveProject, setMoveProject] = useState<Row | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // modal renomear
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // modal duplicar
  const [dupId, setDupId] = useState<string | null>(null);
  const [dupMes, setDupMes] = useState("");
  const [dupAno, setDupAno] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      // Carimba já os projetos legados (sem profileId) com o perfil ativo, ANTES
      // de ler a lista — senão apareciam em todos os perfis (fallback do filtro).
      await backfillProfileIds();
      const [list, arch, full, settings, activeId, profs] = await Promise.all([
        listProjects(),
        listArchivedProjects(),
        listAllProjectsFull(),
        getSettings(),
        getActiveProfileId(),
        listProfiles(),
      ]);
      // Multi-perfil: mostra só os projetos do perfil ativo (legados sem
      // profileId contam como do ativo). Sem perfil ativo → mostra tudo.
      const forActive = (arr: Project[]) =>
        activeId ? arr.filter((p) => belongsToProfile(p, activeId)) : arr;
      const byDate = (a: Project, b: Project) =>
        (b.updatedAt || "").localeCompare(a.updatedAt || "");
      setActiveProfileId(activeId);
      setProfiles(profs);
      setProjects([...forActive(list)].sort(byDate));
      setArchived([...forActive(arch)].sort(byDate));
      // Valor final (a receber) por projeto — mesma regra fiscal do Dashboard,
      // para o número por linha bater certo com o resumo.
      const eff = effectiveFiscalOf(settings);
      const vmap: Record<string, number> = {};
      for (const p of full) vmap[p.id] = projectFinalValue(p, eff);
      setValores(vmap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  function openProject(id: string) {
    router.push(`/projects/${id}`);
  }

  // Confirmação genérica (web confirm / Alert nativo), sempre reversível
  function askConfirm(
    title: string,
    msg: string,
    onYes: () => void,
    yesLabel?: string,
    destructive?: boolean
  ) {
    const yes = yesLabel || t("confirm", { defaultValue: "Confirmar" });
    if (Platform.OS === "web") {
      if ((window as any).confirm(`${title}\n\n${msg}`)) onYes();
      return;
    }
    Alert.alert(title, msg, [
      { text: t("cancel", { defaultValue: "Cancelar" }), style: "cancel" },
      { text: yes, style: destructive ? "destructive" : "default", onPress: onYes },
    ]);
  }

  // Marcar como pago → arquiva automaticamente (reversível via "Desarquivar")
  function markPaidArchive(row: Row) {
    askConfirm(
      t("mark_paid_title", { defaultValue: "Marcar como pago" }),
      t("mark_paid_archive_msg", {
        defaultValue:
          "O projeto passa a Pago e vai para Arquivados. Podes reverter em Arquivados › Desarquivar.",
      }),
      async () => {
        await markProjectPaidAndArchive(row.id);
        // Empurra já para a cloud — sem isto o outro aparelho só sabia do
        // estado novo no sync de arranque/foreground seguinte
        const p = await getProject(row.id);
        if (p && user) syncProjectToCloud(user.id, p as any);
        setTab("arquivados");
        await loadProjects();
        showToast(t("toast_paid_archived", { defaultValue: "✓ Projeto marcado como pago e arquivado" }));
      },
      t("mark_paid", { defaultValue: "Marcar como pago" })
    );
  }

  // Voltar a "A Receber" (não pago)
  function unarchiveRow(row: Row) {
    askConfirm(
      t("mark_to_receive", { defaultValue: "Marcar como a receber" }),
      t("unarchive_msg", {
        defaultValue: "Volta para 'A Receber' como não pago. Podes voltar a marcar como pago depois.",
      }),
      async () => {
        await markProjectToReceive(row.id);
        const p = await getProject(row.id);
        if (p && user) syncProjectToCloud(user.id, p as any);
        setTab("areceber");
        await loadProjects();
        showToast(t("toast_unarchived", { defaultValue: "✓ Projeto de volta a 'A Receber'" }));
      },
      t("mark_to_receive", { defaultValue: "Marcar como a receber" })
    );
  }

  // Limpar projeto (zera a folha; mantém o projeto na lista)
  function clearRow(row: Row) {
    askConfirm(
      t("clear_project", { defaultValue: "Limpar projeto" }),
      t("are_you_sure", { defaultValue: "Tens a certeza?" }),
      async () => {
        const cleared = await clearProjectData(
          row.id,
          t("day_description_default", { defaultValue: "Dia 1" })
        );
        if (cleared && user) syncProjectToCloud(user.id, cleared as any);
        await loadProjects();
      },
      t("clear_project", { defaultValue: "Limpar projeto" }),
      true
    );
  }

  async function doDelete(row: Row) {
    if (row.archived) {
      await deleteArchivedProject(row.id);
    } else {
      await deleteProject(row.id);
    }
    if (user) await deleteProjectFromCloud(user.id, row.id);
    await loadProjects();
    showToast(t("toast_deleted", { defaultValue: "Projeto apagado" }), "danger");
  }

  async function handleNewProject() {
    if (projects.length >= FREE_PROJECT_LIMIT) {
      router.push("/settings/plan");
      return;
    }
    try {
      // O projeto nasce no mês que está a ser visto na lista — assim, fazer em
      // agosto a folha de maio é só navegar para maio e criar. A ver "todos",
      // não há mês em foco: fica o corrente (comportamento de sempre).
      const id = await createProject(showAll ? undefined : { mes, ano });
      router.push(`/projects/${id}`);
    } catch (e) {
      console.error("Erro ao criar projeto", e);
    }
  }

  // ------- MOVER PARA OUTRO MÊS -------
  // Muda o mês a que o projeto pertence (não duplica). A lista salta para o mês
  // de destino, senão o projeto "desaparecia" à frente de quem o moveu.
  async function handleMoveMonth(m: number, y: number) {
    const proj = moveProject;
    setMoveProject(null);
    if (!proj) return;
    try {
      const moved = await moveProjectToMonth(proj.id, m, y);
      if (user) syncProjectToCloud(user.id, moved as any);
      if (!showAll) {
        setMes(m);
        setAno(y);
      }
      await loadProjects();
      showToast(t("toast_moved_month", { defaultValue: "✓ Projeto movido de mês" }));
    } catch (e) {
      console.error("Erro ao mover projeto de mês", e);
    }
  }

  // ------- RENOMEAR INLINE (web): clicar no título edita-o ali mesmo -------
  const [titleEditId, setTitleEditId] = useState<string | null>(null);
  const [titleEditVal, setTitleEditVal] = useState("");
  async function commitTitleEdit() {
    const id = titleEditId;
    if (!id) return;
    const name = titleEditVal.trim();
    setTitleEditId(null);
    const row = [...projects, ...archived].find((r) => r.id === id);
    if (!name || name === (row?.nome || "")) return; // vazio/igual = não mexe
    try {
      await renameProject(id, name);
      const p = await getProject(id);
      if (p && user) syncProjectToCloud(user.id, p as any);
      await loadProjects();
      showToast(t("toast_renamed", { defaultValue: "✓ Projeto renomeado" }));
    } catch (e) {
      console.error("Erro ao renomear projeto", e);
    }
  }

  // ------- RENOMEAR -------
  function openRenameDialog(project: Project) {
    setRenameId(project.id);
    setRenameValue(project.nome || "");
  }
  function closeRenameDialog() {
    setRenameId(null);
    setRenameValue("");
  }
  async function handleConfirmRename() {
    if (!renameId) return;
    const name = renameValue.trim();
    if (!name) {
      Alert.alert(
        t("invalid_name", { defaultValue: "Nome inválido" }),
        t("invalid_name_msg", { defaultValue: "O nome não pode estar vazio." })
      );
      return;
    }
    try {
      await renameProject(renameId, name);
      await loadProjects();
      showToast(t("toast_renamed", { defaultValue: "✓ Projeto renomeado" }));
    } catch (e) {
      console.error("Erro ao renomear projeto", e);
      Alert.alert(
        t("error", { defaultValue: "Erro" }),
        t("rename_error", {
          defaultValue: "Não foi possível renomear o projeto. Tenta novamente.",
        })
      );
    } finally {
      closeRenameDialog();
    }
  }

  // ------- DUPLICAR -------
  function openDuplicateDialog(project: Project) {
    setDupId(project.id);
    const parsed = parseMMYYYY(project.mes || "");
    setDupMes(String(parsed?.m ?? ""));
    setDupAno(String(parsed?.y ?? ""));
  }
  function closeDuplicateDialog() {
    setDupId(null);
    setDupMes("");
    setDupAno("");
  }
  async function handleConfirmDuplicate() {
    if (!dupId) return;
    if (dupBusyRef.current) return;

    if (projects.length >= FREE_PROJECT_LIMIT) {
      closeDuplicateDialog();
      Alert.alert(
        t("pro_gate_title", { defaultValue: "WrapSheet Pro" }),
        t("pro_gate_duplicate_body", { defaultValue: "Duplicating creates a new active project. Unlimited projects are part of WrapSheet Pro — coming soon." }),
        [
          { text: t("cancel", { defaultValue: "Cancelar" }), style: "cancel" },
          { text: t("pro_gate_see_plans", { defaultValue: "See plans" }), onPress: () => router.push("/settings/plan") },
        ]
      );
      return;
    }

    const mesNum = parseInt(dupMes, 10);
    const anoNum = parseInt(dupAno, 10);

    if (
      isNaN(mesNum) ||
      isNaN(anoNum) ||
      mesNum < 1 ||
      mesNum > 12 ||
      anoNum < 1900
    ) {
      Alert.alert(
        t("invalid_data", { defaultValue: "Dados inválidos" }),
        t("invalid_data_msg", {
          defaultValue: "Indica um mês/ano válidos (ex: 11 / 2025).",
        })
      );
      return;
    }

    dupBusyRef.current = true;
    try {
      await duplicateProjectToMonth(dupId, mesNum, anoNum);
      await loadProjects();
      showToast(t("toast_duplicated", { defaultValue: "✓ Projeto duplicado" }));
    } catch (e) {
      console.error("Erro ao duplicar projeto", e);
      Alert.alert(
        t("error", { defaultValue: "Erro" }),
        t("duplicate_error", {
          defaultValue: "Não foi possível duplicar o projeto. Tenta novamente.",
        })
      );
    } finally {
      dupBusyRef.current = false;
      closeDuplicateDialog();
    }
  }

  // Duplicar para OUTRO perfil (multi-perfil). O clone fica no perfil de destino
  // (não aparece nesta lista, que é do perfil ativo) e herda as tarifas dele.
  async function handleDupToProfile(targetProfileId: string) {
    const srcId = dupToProfileId;
    if (!srcId) return;
    if (dupBusyRef.current) return;
    dupBusyRef.current = true;
    setDupToProfileId(null);
    try {
      await duplicateProjectToProfile(srcId, targetProfileId);
      await loadProjects();
      showToast(t("toast_duplicated_to_profile", { defaultValue: "✓ Duplicado para o outro perfil" }));
    } catch (e) {
      console.error("Erro ao duplicar para perfil", e);
      Alert.alert(
        t("error", { defaultValue: "Erro" }),
        t("duplicate_error", { defaultValue: "Não foi possível duplicar o projeto. Tenta novamente." })
      );
    } finally {
      dupBusyRef.current = false;
    }
  }

  // ------- FILTRO -------
  const selectedLabel = useMemo(() => {
    if (showAll) return t("all_months", { defaultValue: "Todos" });
    return fmtMonthLabel(mes, ano, locale);
  }, [showAll, mes, ano, t]);

  // Todos os itens: ativos (A Receber) + arquivados (Pagos)
  const allItems = useMemo<Row[]>(() => {
    const merged: Row[] = [
      ...projects.map((p) => ({ ...p, archived: false })),
      ...archived.map((p) => ({ ...p, archived: true })),
    ];
    return merged.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [projects, archived]);

  // Recorte pelo mês selecionado (ou todos)
  const monthScope = useMemo(() => {
    if (showAll) return allItems;
    const mmYYYY = toMMYYYY(mes, ano);
    return allItems.filter((p) => (p.mes || "") === mmYYYY);
  }, [allItems, showAll, mes, ano]);

  const counts = useMemo(
    () => ({
      todos: monthScope.length,
      areceber: monthScope.filter((p) => !p.archived && !p.pago).length,
      arquivados: monthScope.filter((p) => p.archived).length,
    }),
    [monthScope]
  );

  const filteredProjects = useMemo(() => {
    if (tab === "areceber") return monthScope.filter((p) => !p.archived && !p.pago);
    if (tab === "arquivados") return monthScope.filter((p) => p.archived);
    return monthScope;
  }, [monthScope, tab]);

  // Lista a mostrar: com pesquisa preenchida, procura pelo NOME do projeto E
  // pelo nome da PRODUTORA (cliente), em TODOS os meses e pastas (ignora o
  // mês/pasta selecionados); senão, a lista normal.
  const searchQuery = search.trim().toLowerCase();
  const displayList = useMemo(() => {
    if (!searchQuery) return filteredProjects;
    return allItems.filter(
      (p) =>
        (p.nome || "").toLowerCase().includes(searchQuery) ||
        (p.cliente || "").toLowerCase().includes(searchQuery)
    );
  }, [searchQuery, allItems, filteredProjects]);

  // Limite do range de meses: do ano mais antigo com dados até ao ano seguinte
  const yearBounds = useMemo(() => {
    const nowY = new Date().getFullYear();
    const years = allItems
      .map((p) => parseMMYYYY(p.mes || "")?.y)
      .filter((y): y is number => !!y);
    const minY = years.length ? Math.min(...years, nowY) : nowY;
    // Projetos podem ser planeados com muita antecedência — deixa ir até 2050
    return { minY, maxY: 2050 };
  }, [allItems]);

  function selectMonth(m: number, y: number) {
    setShowAll(false);
    setMes(m);
    setAno(y);
    setPickerVisible(false);
  }

  function stepMonth(delta: number) {
    setShowAll(false);
    let m = mes + delta;
    let y = ano;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    if (y < yearBounds.minY || y > yearBounds.maxY) return; // não passa dos limites
    setMes(m);
    setAno(y);
  }

  // ------- OPÇÕES DO CARD -------
  // Menu ÚNICO do projeto — a página do projeto usa exatamente os mesmos
  // itens, pela mesma ordem. Mudanças aqui devem refletir-se lá.
  function openProjectOptions(project: Row) {
    // Modal customizado (cartão branco) em TODAS as plataformas — o mesmo
    // estilo do menu da página do projeto. (O ActionSheet nativo do iOS
    // destoava: escuro, letras azuis.)
    setOptsProject(project);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* HEADER */}
      <View style={s.header}>
        {!isWide && (
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={s.backLink}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
          </Pressable>
        )}

        <Text style={s.headerTitle}>
          {t("projects", { defaultValue: "Projetos" })}
        </Text>

        {!isWide && <View style={{ width: 70 }} />}
      </View>

      {/* PESQUISA por nome — procura em todos os meses/pastas */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t("search_by_name", { defaultValue: "Search by name or production company" })}
          placeholderTextColor={COLORS.sub}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={10} style={s.searchClear}>
            <Text style={s.searchClearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* MÊS com setas de navegação */}
      <View style={s.monthNav}>
        <Pressable
          hitSlop={12}
          onPress={() => stepMonth(-1)}
          style={({ pressed }) => [s.navArrow, pressed && { opacity: 0.5 }]}
        >
          <Text style={s.navArrowText}>‹</Text>
        </Pressable>

        <Pressable onPress={() => setPickerVisible(true)} style={s.monthCenter}>
          <Text style={s.monthLabel}>{selectedLabel}</Text>
          <Text style={s.monthHint}>
            {Platform.OS === "web"
              ? t("click_to_select_month", { defaultValue: "Clique para selecionar o mês" })
              : t("tap_to_select_month", { defaultValue: "Toque para selecionar o mês" })}
          </Text>
        </Pressable>

        <Pressable
          hitSlop={12}
          onPress={() => stepMonth(1)}
          style={({ pressed }) => [s.navArrow, pressed && { opacity: 0.5 }]}
        >
          <Text style={s.navArrowText}>›</Text>
        </Pressable>
      </View>

      {/* Pastas: Todos / A Receber / Arquivados (Pagos) */}
      <View style={s.folderRow}>
        {([
          { key: "todos", label: t("all_months", { defaultValue: "Todos" }), n: counts.todos },
          { key: "areceber", label: t("to_receive", { defaultValue: "A Receber" }), n: counts.areceber },
          { key: "arquivados", label: t("paid_plural", { defaultValue: "Pagos" }), n: counts.arquivados },
        ] as const).map((f) => {
          const on = tab === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setTab(f.key)}
              style={({ pressed }) => [s.folderTab, on && s.folderTabOn, pressed && { opacity: 0.85 }]}
            >
              {/* Encolhe a letra em vez de cortar ("Arquivados…") — os três
                  separadores têm a mesma largura e este rótulo é o maior */}
              <Text
                style={[s.folderTabText, on && s.folderTabTextOn]}
                numberOfLines={1}
                adjustsFontSizeToFit={Platform.OS !== "web"}
                minimumFontScale={0.7}
              >
                {f.label} ({f.n})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      >
        {displayList.map((p) => {
          const updatedLabel = p.updatedAt
            ? dayjs(p.updatedAt).isValid()
              ? dayjs(p.updatedAt).format("DD/MM/YYYY HH:mm")
              : String(p.updatedAt)
            : "--/--/---- --:--";

          return (
            <Pressable
              key={p.id}
              onPress={() => openProject(p.id)}
              style={({ pressed, hovered }: any) => [
                s.card,
                p.archived && s.cardPaid,
                Platform.OS === "web" && hovered && { borderColor: COLORS.text, opacity: 1 },
                pressed && { opacity: 0.96 },
              ]}
            >
              <View style={s.cardTopRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  {/* O estado pago/a receber mostra-se APENAS no chip à direita
                      — sem badge duplicado junto ao nome.
                      Na web, clicar no TÍTULO edita-o ali mesmo (Enter/clicar
                      fora grava, Esc cancela); o resto do cartão abre o projeto. */}
                  {titleEditId === p.id ? (
                    <Pressable onPress={(e: any) => e?.stopPropagation?.()}>
                      <TextInput
                        value={titleEditVal}
                        onChangeText={setTitleEditVal}
                        autoFocus
                        placeholder={t("unnamed_project", { defaultValue: "Projeto sem nome" })}
                        placeholderTextColor={COLORS.sub}
                        onSubmitEditing={commitTitleEdit}
                        onBlur={commitTitleEdit}
                        onKeyPress={(e: any) => {
                          if (e?.nativeEvent?.key === "Escape") setTitleEditId(null);
                        }}
                        style={[s.title, s.titleInput]}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      disabled={Platform.OS !== "web"}
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        setTitleEditVal(p.nome || "");
                        setTitleEditId(p.id);
                      }}
                      style={Platform.OS === "web" ? ({ cursor: "text", alignSelf: "flex-start" } as any) : undefined}
                    >
                      <Text style={[s.title, { flexShrink: 1 }]} numberOfLines={2}>
                        {p.nome ||
                          t("unnamed_project", {
                            defaultValue: "Projeto sem nome",
                          })}
                      </Text>
                    </Pressable>
                  )}

                  <Text style={s.subtitle} numberOfLines={1}>
                    {(p.cliente || "—") + " · " + (p.mes || "--/----")}
                  </Text>
                </View>

                <Pressable
                  hitSlop={12}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    openProjectOptions(p);
                  }}
                  style={({ pressed, hovered }: any) => [
                    s.moreBtn,
                    Platform.OS === "web" && hovered && { borderColor: COLORS.text },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={s.moreText}>⋯</Text>
                </Pressable>
              </View>

              {/* Estado (pago / a receber — alterna ao tocar) + VALOR do trabalho
                  na mesma linha. O valor é a informação mais útil desta lista. */}
              <View style={s.statusRow}>
                {p.archived ? (
                  <Pressable
                    hitSlop={8}
                    onPress={(e: any) => { e?.stopPropagation?.(); unarchiveRow(p); }}
                    style={({ pressed }) => [s.payBtn, s.payBtnOn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={[s.payBtnText, s.payBtnTextOn]}>✓ {t("paid", { defaultValue: "Pago" })}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    hitSlop={8}
                    onPress={(e: any) => { e?.stopPropagation?.(); markPaidArchive(p); }}
                    style={({ pressed }) => [s.payBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={s.payBtnText}>{t("to_receive", { defaultValue: "A Receber" })}</Text>
                  </Pressable>
                )}
                <Text style={s.cardValue} numberOfLines={1}>
                  {formatMoneyApp(valores[p.id] ?? 0)}
                </Text>
              </View>

              {/* Data de atualização a toda a largura, por baixo */}
              <Text style={[s.subtitle, { marginTop: 8 }]} numberOfLines={1}>
                {t("updated_at", { defaultValue: "Atualizado:" })}{" "}
                <Text style={s.subtitleStrong}>{updatedLabel}</Text>
              </Text>
            </Pressable>
          );
        })}

        {displayList.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>
              {searchQuery
                ? t("no_search_results", { defaultValue: "No projects found" })
                : t("no_projects_in_month", { defaultValue: "Sem projetos neste mês" })}
            </Text>
            {!searchQuery && (
              <Text style={s.emptySub}>
                {t("no_projects_in_month_sub", {
                  defaultValue: "Cria um novo projeto para começar.",
                })}
              </Text>
            )}
          </View>
        ) : null}

        {loading ? (
          <Text style={s.loadingText}>
            {t("loading", { defaultValue: "A carregar…" })}
          </Text>
        ) : null}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Toast (verde = sucesso, vermelho = apagado) */}
      {toast && (
        <View style={[s.toast, toast.kind === "danger" && { backgroundColor: "#c62828" }]} pointerEvents="none">
          <Text style={s.toastText}>{toast.msg}</Text>
        </View>
      )}

      {/* FAB (neutro) */}
      <TouchableOpacity
        style={s.fab}
        onPress={handleNewProject}
        activeOpacity={0.9}
      >
        <Text style={s.fabText}>
          {t("new_project", { defaultValue: "Novo Projeto" })}
        </Text>
      </TouchableOpacity>

      {/* Mover projeto para outro mês (menu ⋯). O mês do projeto vem do índice
          no formato "MM/AAAA"; se faltar, abre no mês em foco na lista. */}
      <MonthYearModal
        visible={!!moveProject}
        mes={Number((moveProject?.mes || "").split("/")[0]) || mes}
        ano={Number((moveProject?.mes || "").split("/")[1]) || ano}
        title={t("move_to_month", { defaultValue: "Mover para outro mês" })}
        onClose={() => setMoveProject(null)}
        onPick={handleMoveMonth}
      />

      {/* Modal opções do projeto (Android + Web) */}
      <Modal transparent animationType="fade" visible={!!optsProject}>
        <Pressable style={s.modalBackdrop} onPress={() => { setOptsProject(null); setDeleteConfirm(false); }}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>
              {optsProject?.nome || t("unnamed_project")}
            </Text>
            {!deleteConfirm ? (
              <>
                {[
                  optsProject?.archived
                    ? {
                        label: t("mark_to_receive", { defaultValue: "Marcar como a receber" }),
                        onPress: () => { const proj = optsProject!; setOptsProject(null); unarchiveRow(proj); },
                      }
                    : {
                        label: t("mark_paid", { defaultValue: "Marcar como pago" }),
                        onPress: () => { const proj = optsProject!; setOptsProject(null); markPaidArchive(proj); },
                      },
                  { label: t("rename"), onPress: () => { setOptsProject(null); openRenameDialog(optsProject!); } },
                  {
                    label: t("move_to_month", { defaultValue: "Mover para outro mês" }),
                    onPress: () => { const proj = optsProject!; setOptsProject(null); setMoveProject(proj); },
                  },
                  { label: t("duplicate"), onPress: () => { setOptsProject(null); openDuplicateDialog(optsProject!); } },
                  ...(profiles.length >= 2
                    ? [{
                        label: t("duplicate_to_profile", { defaultValue: "Duplicar para outro perfil" }),
                        onPress: () => { const proj = optsProject!; setOptsProject(null); setDupToProfileId(proj.id); },
                      }]
                    : []),
                ].map((opt) => (
                  <Pressable key={opt.label} style={({ pressed }) => [s.optRow, pressed && { opacity: 0.85 }]} onPress={opt.onPress}>
                    <Text style={s.optText}>{opt.label}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={({ pressed }) => [s.optRow, pressed && { opacity: 0.85 }]}
                  onPress={() => { const proj = optsProject!; setOptsProject(null); clearRow(proj); }}
                >
                  <Text style={[s.optText, { color: COLORS.danger }]}>{t("clear_project", { defaultValue: "Limpar projeto" })}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.optRow, pressed && { opacity: 0.85 }]}
                  onPress={() => setDeleteConfirm(true)}
                >
                  <Text style={[s.optText, { color: COLORS.danger }]}>{t("delete")}</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.85 }]} onPress={() => { setOptsProject(null); setDeleteConfirm(false); }}>
                  <Text style={s.closeBtnText}>{t("close")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[s.modalTitle, { color: COLORS.danger, marginTop: 8 }]}>
                  {t("delete_project_msg")}
                </Text>
                <Pressable
                  style={({ pressed }) => [s.optRow, { backgroundColor: COLORS.danger }, pressed && { opacity: 0.85 }]}
                  onPress={async () => {
                    const row = optsProject!;
                    setOptsProject(null);
                    setDeleteConfirm(false);
                    await doDelete(row);
                  }}
                >
                  <Text style={[s.optText, { color: "#fff" }]}>{t("delete")}</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.85 }]} onPress={() => setDeleteConfirm(false)}>
                  <Text style={s.closeBtnText}>{t("cancel")}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Duplicar para outro perfil: escolher o perfil de destino */}
      <Modal transparent animationType="fade" visible={!!dupToProfileId}>
        <Pressable style={s.modalBackdrop} onPress={() => setDupToProfileId(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>
              {t("duplicate_to_profile", { defaultValue: "Duplicar para outro perfil" })}
            </Text>
            {profiles
              .filter((p) => p.id !== activeProfileId)
              .map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [s.optRow, pressed && { opacity: 0.85 }]}
                  onPress={() => handleDupToProfile(p.id)}
                >
                  <Text style={s.optText}>{p.nome || t("no_name", { defaultValue: "Sem nome" })}</Text>
                </Pressable>
              ))}
            <Pressable
              style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setDupToProfileId(null)}
            >
              <Text style={s.closeBtnText}>{t("close", { defaultValue: "Fechar" })}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Seletor de Mês + Ano */}
      <MonthYearPicker
        visible={pickerVisible}
        locale={locale}
        year={ano}
        month={mes}
        showAll={showAll}
        minYear={yearBounds.minY}
        maxYear={yearBounds.maxY}
        onClose={() => setPickerVisible(false)}
        onSelect={(m, y) => selectMonth(m, y)}
        onSelectAll={() => { setShowAll(true); setPickerVisible(false); }}
      />

      {/* Modal renomear */}
      {renameId && (
        <Modal transparent animationType="fade">
          <View style={s.modalBackdrop}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>
                {t("rename_project", { defaultValue: "Renomear projeto" })}
              </Text>

              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder={t("project_name", {
                  defaultValue: "Nome do projeto",
                })}
                placeholderTextColor={COLORS.sub}
                style={s.input}
                autoFocus
              />

              <View style={s.modalButtonsRow}>
                <TouchableOpacity
                  style={s.modalBtnSecondary}
                  onPress={closeRenameDialog}
                >
                  <Text style={s.modalBtnSecondaryText}>
                    {t("cancel", { defaultValue: "Cancelar" })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.modalBtnPrimary}
                  onPress={handleConfirmRename}
                >
                  <Text style={s.modalBtnPrimaryText}>
                    {t("save", { defaultValue: "Guardar" })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal duplicar */}
      {dupId && (
        <Modal transparent animationType="fade">
          <View style={s.modalBackdrop}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>
                {t("duplicate_project", { defaultValue: "Duplicar projeto" })}
              </Text>

              <View style={s.dupInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>
                    {t("month", { defaultValue: "Mês" })}
                  </Text>
                  <TextInput
                    value={dupMes}
                    onChangeText={setDupMes}
                    keyboardType="number-pad"
                    placeholder="12"
                    placeholderTextColor={COLORS.sub}
                    style={s.input}
                  />
                </View>

                <View style={{ width: 10 }} />

                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>
                    {t("year", { defaultValue: "Ano" })}
                  </Text>
                  <TextInput
                    value={dupAno}
                    onChangeText={setDupAno}
                    keyboardType="number-pad"
                    placeholder="2025"
                    placeholderTextColor={COLORS.sub}
                    style={s.input}
                  />
                </View>
              </View>

              <Text style={s.dupHint}>
                {t("duplicate_target", {
                  defaultValue: "Destino: {{m}} / {{y}}",
                  m: dupMes || "—",
                  y: dupAno || "—",
                })}
              </Text>

              <View style={[s.modalButtonsRow, { marginTop: 10 }]}>
                <TouchableOpacity
                  style={s.modalBtnSecondary}
                  onPress={closeDuplicateDialog}
                >
                  <Text style={s.modalBtnSecondaryText}>
                    {t("cancel", { defaultValue: "Cancelar" })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.modalBtnPrimary}
                  onPress={handleConfirmDuplicate}
                >
                  <Text style={s.modalBtnPrimaryText}>
                    {t("confirm", { defaultValue: "Confirmar" })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backLink: {
      color: COLORS.text, // ✅ neutro (sem azul)
      fontSize: 15,
      fontWeight: "800",
      width: 70,
      opacity: 0.9,
    },
    headerTitle: {
      color: COLORS.text,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.2,
    },

    monthDisplay: { alignItems: "center", marginTop: 10, marginBottom: 6 },
    monthLabel: { fontSize: 18, fontWeight: "900", color: COLORS.text },
    monthHint: { marginTop: 2, color: COLORS.sub, fontSize: 12 },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 2,
      paddingHorizontal: 12,
      height: 40,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 10,
    },
    searchIcon: { fontSize: 14, opacity: 0.55 },
    searchInput: { flex: 1, fontSize: 15, color: COLORS.text, paddingVertical: 0 },
    searchClear: { padding: 4 },
    searchClearText: { fontSize: 14, color: COLORS.sub, fontWeight: "800" },
    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      marginTop: 8,
      marginBottom: 8,
    },
    navArrow: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      ...(Platform.OS === "web" ? ({ cursor: "pointer", userSelect: "none" } as any) : {}),
    },
    navArrowText: { fontSize: 28, fontWeight: "900", color: COLORS.text, lineHeight: 32 },
    monthCenter: { alignItems: "center", flex: 1 },

    folderRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    folderTab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      alignItems: "center",
      ...(Platform.OS === "web" ? ({ cursor: "pointer", userSelect: "none" } as any) : {}),
    },
    folderTabOn: { backgroundColor: COLORS.text, borderColor: COLORS.text },
    folderTabText: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
    folderTabTextOn: { color: COLORS.bg },

    payBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      ...(Platform.OS === "web" ? ({ cursor: "pointer", userSelect: "none" } as any) : {}),
    },
    payBtnOn: { borderColor: "#1a9c4e", backgroundColor: "#e4f6ea" },
    payBtnText: { color: COLORS.sub, fontWeight: "900", fontSize: 12 },
    payBtnTextOn: { color: "#137a3a" },

    list: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 140,
      gap: 10,
    },

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

    cardTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },

    // Estado + valor na mesma linha (chip à esquerda, valor à direita)
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
      gap: 10,
    },
    cardValue: { color: COLORS.text, fontWeight: "900", fontSize: 17 },

    cardPaid: { borderLeftWidth: 5, borderLeftColor: "#1a9c4e" },
    paidBadge: {
      backgroundColor: "#e4f6ea",
      borderColor: "#1a9c4e",
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    paidBadgeText: { color: "#137a3a", fontSize: 11, fontWeight: "900" },

    title: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
    // Edição inline do título no cartão (web): mesmo tipo de letra, com um
    // sublinhado discreto a marcar o modo de edição
    titleInput: {
      paddingVertical: 0,
      paddingHorizontal: 0,
      borderBottomWidth: 2,
      borderColor: COLORS.text,
      minWidth: 220,
      ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
    },
    subtitle: { color: COLORS.sub, fontSize: 13, marginTop: 4 },
    subtitleStrong: { color: COLORS.text, fontWeight: "900" },

    moreBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: mode === "dark" ? COLORS.bg : "#F1F3F6",
    },
    moreText: {
      color: COLORS.text,
      fontWeight: "900",
      fontSize: 18,
      marginTop: -2,
    },

    fab: {
      position: "absolute",
      right: 16,
      bottom: 30,
      backgroundColor: COLORS.card, // ✅ neutro
      borderRadius: 999,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 8,
    },
    fabText: { color: COLORS.text, fontWeight: "900", fontSize: 14 },

    toast: {
      position: "absolute",
      bottom: 92,
      left: 16,
      right: 16,
      backgroundColor: "#137a3a",
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    toastText: { color: "#fff", fontWeight: "900", fontSize: 14 },

    emptyBox: { paddingTop: 20, alignItems: "center" },
    emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
    emptySub: {
      marginTop: 6,
      color: COLORS.sub,
      fontSize: 13,
      textAlign: "center",
    },
    loadingText: { textAlign: "center", color: COLORS.sub, paddingTop: 8 },

    /* Modal */
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: COLORS.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: COLORS.text,
      marginBottom: 10,
      textAlign: "center",
    },

    monthOption: {
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    monthOptionSelected: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.text,
    },
    monthOptionText: {
      fontSize: 15,
      color: COLORS.text,
      textTransform: "capitalize",
      textAlign: "center",
    },
    monthOptionTextSelected: {
      fontWeight: "900",
      color: COLORS.text,
    },
    modalCloseBtn: {
      marginTop: 10,
      alignSelf: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
    },
    modalCloseText: {
      color: COLORS.text,
      fontWeight: "900",
      fontSize: 13,
    },

    modalButtonsRow: {
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      marginTop: 10,
    },
    modalBtnSecondary: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      flex: 1,
      alignItems: "center",
    },
    modalBtnSecondaryText: { color: COLORS.text, fontWeight: "900" },

    modalBtnPrimary: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: COLORS.text, // ✅ neutro
      flex: 1,
      alignItems: "center",
    },
    modalBtnPrimaryText: { color: COLORS.bg, fontWeight: "900" },

    inputLabel: {
      color: COLORS.sub,
      fontSize: 12,
      fontWeight: "900",
      marginBottom: 6,
    },
    input: {
      backgroundColor: mode === "dark" ? COLORS.bg : "#E8EBF0",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: COLORS.text,
    },

    dupInputsRow: { flexDirection: "row", marginTop: 4 },
    dupHint: {
      color: COLORS.sub,
      textAlign: "center",
      marginTop: 10,
      fontWeight: "900",
    },
    optRow: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginTop: 10,
      backgroundColor: COLORS.bg,
      alignItems: "center",
    },
    optText: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
    closeBtn: {
      marginTop: 12,
      alignSelf: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: "transparent",
    },
    closeBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
  });
