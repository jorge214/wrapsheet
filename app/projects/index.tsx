// app/projects/index.tsx
import dayjs from "dayjs";
import { useFocusEffect, useRouter } from "expo-router";
import { useIsWide } from "../../src/ui/useBreakpoint";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../src/i18n/i18n";
import {
  ActionSheetIOS,
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
  archiveProject,
  createProject,
  deleteProject,
  duplicateProjectToMonth,
  listProjects,
  renameProject,
  setProjectPaid,
} from "../../src/storage/projects";
import { useAuth } from "../../src/auth/AuthContext";
import { deleteProjectFromCloud } from "../../src/sync/syncService";
import { FREE_PROJECT_LIMIT } from "../../src/storage/freeTier";
import { useTheme } from "../../src/theme/ThemeProvider";

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
  const [loading, setLoading] = useState(false);

  // filtro mês
  const now = new Date();
  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [ano, setAno] = useState<number>(now.getFullYear());
  const [showAll, setShowAll] = useState<boolean>(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // modal opções (web)
  const [optsProject, setOptsProject] = useState<Project | null>(null);
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
      const list = await listProjects();
      const sorted = [...list].sort((a, b) =>
        (b.updatedAt || "").localeCompare(a.updatedAt || "")
      );
      setProjects(sorted);
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

  async function confirmArchive(id: string) {
    await archiveProject(id);
    await loadProjects();
  }

  async function togglePaid(project: Project) {
    await setProjectPaid(project.id, !project.pago);
    await loadProjects();
  }

  async function confirmDelete(id: string) {
    if (Platform.OS === "web") {
      const ok = (window as any).confirm(
        `${t("delete_project_title")}\n${t("delete_project_msg")}`
      );
      if (ok) {
        await deleteProject(id);
        if (user) await deleteProjectFromCloud(user.id, id);
        loadProjects();
      }
      return;
    }
    Alert.alert(
      t("delete_project_title"),
      t("delete_project_msg"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            await deleteProject(id);
            if (user) await deleteProjectFromCloud(user.id, id);
            loadProjects();
          },
        },
      ]
    );
  }

  async function handleNewProject() {
    if (projects.length >= FREE_PROJECT_LIMIT) {
      router.push("/settings/plan");
      return;
    }
    try {
      const id = await createProject();
      router.push(`/projects/${id}`);
    } catch (e) {
      console.error("Erro ao criar projeto", e);
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

    try {
      await duplicateProjectToMonth(dupId, mesNum, anoNum);
      await loadProjects();
    } catch (e) {
      console.error("Erro ao duplicar projeto", e);
      Alert.alert(
        t("error", { defaultValue: "Erro" }),
        t("duplicate_error", {
          defaultValue: "Não foi possível duplicar o projeto. Tenta novamente.",
        })
      );
    } finally {
      closeDuplicateDialog();
    }
  }

  // ------- FILTRO -------
  const selectedLabel = useMemo(() => {
    if (showAll) return t("all_months", { defaultValue: "Todos" });
    return fmtMonthLabel(mes, ano, locale);
  }, [showAll, mes, ano, t]);

  const filteredProjects = useMemo(() => {
    if (showAll) return projects;
    const mmYYYY = toMMYYYY(mes, ano);
    return projects.filter((p) => (p.mes || "") === mmYYYY);
  }, [projects, showAll, mes, ano]);

  // opções (jan 3 anos atrás até 1 ano à frente)
  const monthOptions = useMemo(() => {
    const options: { m: number; y: number }[] = [];
    const startYear = ano - 3;
    const endYear = ano + 1;

    for (let y = endYear; y >= startYear; y--) {
      for (let m = 12; m >= 1; m--) options.push({ m, y });
    }
    return options;
  }, [ano]);

  function selectMonth(m: number, y: number) {
    setShowAll(false);
    setMes(m);
    setAno(y);
    setPickerVisible(false);
  }

  // ------- OPÇÕES DO CARD -------
  function openProjectOptions(project: Project) {
    const paidLabel = project.pago
      ? t("mark_unpaid", { defaultValue: "Marcar como não pago" })
      : t("mark_paid", { defaultValue: "Marcar como pago" });
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: project.nome || t("unnamed_project"),
          options: [paidLabel, t("rename"), t("duplicate"), t("archive"), t("delete"), t("cancel")],
          cancelButtonIndex: 5,
          destructiveButtonIndex: 4,
        },
        (index) => {
          if (index === 0) togglePaid(project);
          if (index === 1) openRenameDialog(project);
          if (index === 2) openDuplicateDialog(project);
          if (index === 3) confirmArchive(project.id);
          if (index === 4) confirmDelete(project.id);
        }
      );
      return;
    }
    // Android e web: modal customizado
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

      {/* MÊS */}
      <Pressable
        style={({ pressed }) => [s.monthDisplay, pressed && { opacity: 0.88 }]}
        onPress={() => setPickerVisible(true)}
      >
        <Text style={s.monthLabel}>{selectedLabel}</Text>
        <Text style={s.monthHint}>
          {Platform.OS === "web"
            ? t("click_to_select_month", { defaultValue: "Clique para selecionar o mês" })
            : t("tap_to_select_month", { defaultValue: "Toque para selecionar o mês" })}
        </Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      >
        {filteredProjects.map((p) => {
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
                p.pago && s.cardPaid,
                Platform.OS === "web" && hovered && { borderColor: COLORS.text, opacity: 1 },
                pressed && { opacity: 0.96 },
              ]}
            >
              <View style={s.cardTopRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[s.title, { flexShrink: 1 }]} numberOfLines={1}>
                      {p.nome ||
                        t("unnamed_project", {
                          defaultValue: "Projeto sem nome",
                        })}
                    </Text>
                    {p.pago && (
                      <View style={s.paidBadge}>
                        <Text style={s.paidBadgeText}>✓ {t("paid", { defaultValue: "Pago" })}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={s.subtitle} numberOfLines={1}>
                    {(p.cliente || "—") + " · " + (p.mes || "--/----")}
                  </Text>

                  <Text style={s.subtitle} numberOfLines={1}>
                    {t("updated_at", { defaultValue: "Atualizado:" })}{" "}
                    <Text style={s.subtitleStrong}>{updatedLabel}</Text>
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
            </Pressable>
          );
        })}

        {filteredProjects.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>
              {t("no_projects_in_month", {
                defaultValue: "Sem projetos neste mês",
              })}
            </Text>
            <Text style={s.emptySub}>
              {t("no_projects_in_month_sub", {
                defaultValue: "Cria um novo projeto para começar.",
              })}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <Text style={s.loadingText}>
            {t("loading", { defaultValue: "A carregar…" })}
          </Text>
        ) : null}

        <View style={{ height: 110 }} />
      </ScrollView>

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
                  {
                    label: optsProject?.pago
                      ? t("mark_unpaid", { defaultValue: "Marcar como não pago" })
                      : t("mark_paid", { defaultValue: "Marcar como pago" }),
                    onPress: () => { const proj = optsProject!; setOptsProject(null); togglePaid(proj); },
                  },
                  { label: t("rename"), onPress: () => { setOptsProject(null); openRenameDialog(optsProject!); } },
                  { label: t("duplicate"), onPress: () => { setOptsProject(null); openDuplicateDialog(optsProject!); } },
                  { label: t("archive"), onPress: () => { const id = optsProject!.id; setOptsProject(null); confirmArchive(id); } },
                ].map((opt) => (
                  <Pressable key={opt.label} style={({ pressed }) => [s.optRow, pressed && { opacity: 0.85 }]} onPress={opt.onPress}>
                    <Text style={s.optText}>{opt.label}</Text>
                  </Pressable>
                ))}
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
                    const id = optsProject!.id;
                    setOptsProject(null);
                    setDeleteConfirm(false);
                    await deleteProject(id);
                    if (user) await deleteProjectFromCloud(user.id, id);
                    loadProjects();
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

      {/* Modal selecionar mês */}
      <Modal transparent animationType="fade" visible={pickerVisible}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {t("select_month", { defaultValue: "Selecionar mês" })}
            </Text>

            <ScrollView
              style={{ maxHeight: 360 }}
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                style={({ pressed }) => [
                  s.monthOption,
                  showAll && s.monthOptionSelected,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => {
                  setShowAll(true);
                  setPickerVisible(false);
                }}
              >
                <Text
                  style={[
                    s.monthOptionText,
                    showAll && s.monthOptionTextSelected,
                  ]}
                >
                  {t("all_months", { defaultValue: "Todos" })}
                </Text>
              </Pressable>

              {monthOptions.map((opt) => {
                const selected = !showAll && opt.m === mes && opt.y === ano;
                return (
                  <Pressable
                    key={`${opt.m}-${opt.y}`}
                    style={({ pressed }) => [
                      s.monthOption,
                      selected && s.monthOptionSelected,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => selectMonth(opt.m, opt.y)}
                  >
                    <Text
                      style={[
                        s.monthOptionText,
                        selected && s.monthOptionTextSelected,
                      ]}
                    >
                      {fmtMonthLabel(opt.m, opt.y, locale)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={s.modalCloseBtn}
              onPress={() => setPickerVisible(false)}
            >
              <Text style={s.modalCloseText}>
                {t("close", { defaultValue: "Fechar" })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
