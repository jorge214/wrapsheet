// app/archived/index.tsx
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  deleteArchivedProject,
  listArchivedProjects,
  ProjectListItem,
} from "../../src/storage/projects";
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

export default function ArchivedScreen() {
  const router = useRouter();
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const locale = i18n.language;
  const isWide = useIsWide();
  const s = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [filterClient, setFilterClient] = useState("");

  // filtro mês (IGUAL ao Projects)
  const now = new Date();
  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [ano, setAno] = useState<number>(now.getFullYear());
  const [showAll, setShowAll] = useState<boolean>(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [optionsFor, setOptionsFor] = useState<ProjectListItem | null>(null);

  async function loadArchived() {
    const list = await listArchivedProjects();
    const sorted = [...list].sort((a, b) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );
    setProjects(sorted);
  }

  useEffect(() => {
    loadArchived();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadArchived();
    }, [])
  );

  function handleOpen(id: string) {
    router.push(`/projects/${id}`);
  }

  async function doDelete(id: string) {
    await deleteArchivedProject(id);
    await loadArchived();
  }

  function confirmDelete(p: ProjectListItem) {
    const title = t("archived_delete_title", { defaultValue: "Apagar arquivado" });
    const msg = t("archived_delete_msg", {
      defaultValue: "Esta ação é definitiva. Queres mesmo apagar este projeto arquivado?",
    });
    if (Platform.OS === "web") {
      if ((window as any).confirm(`${title}\n\n${msg}`)) doDelete(p.id);
    } else {
      Alert.alert(title, msg, [
        { text: t("cancel", { defaultValue: "Cancelar" }), style: "cancel" },
        {
          text: t("delete", { defaultValue: "Apagar" }),
          style: "destructive",
          onPress: () => doDelete(p.id),
        },
      ]);
    }
  }

  const selectedLabel = useMemo(() => {
    if (showAll) return t("all_months", { defaultValue: "Todos" });
    return fmtMonthLabel(mes, ano, locale);
  }, [showAll, mes, ano, t]);

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

  // filtro combinado: mês + pesquisa
  const filteredProjects = useMemo(() => {
    const q = filterClient.trim().toLowerCase();
    const mmYYYY = toMMYYYY(mes, ano);

    return projects.filter((p) => {
      const monthOk = showAll ? true : (p.mes || "") === mmYYYY;

      if (!q) return monthOk;

      const text = `${p.cliente || ""} ${p.nome || ""}`.toLowerCase();
      return monthOk && text.includes(q);
    });
  }, [projects, filterClient, showAll, mes, ano]);

  function openOptions(p: ProjectListItem) {
    const optOpen = t("open", { defaultValue: "Abrir" });
    const optDelete = t("delete", { defaultValue: "Apagar" });
    const optCancel = t("cancel", { defaultValue: "Cancelar" });

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: p.nome || t("unnamed_project", { defaultValue: "Projeto sem nome" }),
          options: [optOpen, optDelete, optCancel],
          cancelButtonIndex: 2,
          destructiveButtonIndex: 1,
        },
        (index) => {
          if (index === 0) handleOpen(p.id);
          if (index === 1) confirmDelete(p);
        }
      );
      return;
    }

    // Web + Android: menu de opções (Abrir / Apagar), não apaga logo
    setOptionsFor(p);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* HEADER */}
      <View style={s.header}>
        {!isWide && (
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={s.backLink}>
              ‹ {t("back", { defaultValue: "Voltar" })}
            </Text>
          </Pressable>
        )}

        <Text style={s.headerTitle}>
          {t("archived_title", { defaultValue: "Arquivados" })}
        </Text>

        {!isWide && <View style={{ width: 70 }} />}
      </View>

      {/* MÊS com setas de navegação */}
      <View style={s.monthNav}>
        <Pressable
          hitSlop={12}
          onPress={() => {
            setShowAll(false);
            if (mes === 1) { setMes(12); setAno(ano - 1); }
            else setMes(mes - 1);
          }}
          style={({ pressed }) => [s.navArrow, pressed && { opacity: 0.5 }]}
        >
          <Text style={s.navArrowText}>‹</Text>
        </Pressable>

        <Pressable onPress={() => setPickerVisible(true)} style={s.monthCenter}>
          <Text style={s.monthLabel}>{selectedLabel}</Text>
          <Text style={s.monthHint}>{t("tap_to_select_month", { defaultValue: "Toque para selecionar o mês" })}</Text>
        </Pressable>

        <Pressable
          hitSlop={12}
          onPress={() => {
            setShowAll(false);
            if (mes === 12) { setMes(1); setAno(ano + 1); }
            else setMes(mes + 1);
          }}
          style={({ pressed }) => [s.navArrow, pressed && { opacity: 0.5 }]}
        >
          <Text style={s.navArrowText}>›</Text>
        </Pressable>
      </View>

      {/* Filtro por cliente/nome */}
      <View style={s.filters}>
        <TextInput
          style={s.input}
          placeholder={t("archived_filter_client", {
            defaultValue: "Filtrar por cliente ou nome",
          })}
          placeholderTextColor={COLORS.sub}
          value={filterClient}
          onChangeText={setFilterClient}
        />
      </View>

      {filteredProjects.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>
            {t("archived_empty_title", {
              defaultValue: "Sem projetos arquivados",
            })}
          </Text>
          <Text style={s.emptySub}>
            {t("archived_empty_sub", {
              defaultValue:
                "Arquiva projetos a partir da lista principal para os veres aqui.",
            })}
          </Text>
        </View>
      ) : (
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
                onPress={() => handleOpen(p.id)}
                style={({ pressed, hovered }: any) => [
                  s.card,
                  Platform.OS === "web" && hovered && { borderColor: COLORS.text, opacity: 1 },
                  pressed && { opacity: 0.96 },
                ]}
              >
                <View style={s.cardTopRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={s.title} numberOfLines={1}>
                      {p.nome ||
                        t("unnamed_project", {
                          defaultValue: "Projeto sem nome",
                        })}
                    </Text>

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
                      openOptions(p);
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

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Modal selecionar mês (igual ao Projects) */}
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

            <Pressable
              style={({ pressed }) => [
                s.modalCloseBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setPickerVisible(false)}
            >
              <Text style={s.modalCloseText}>
                {t("close", { defaultValue: "Fechar" })}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal de opções do projeto arquivado (Web + Android) */}
      <Modal
        transparent
        animationType="fade"
        visible={!!optionsFor}
        onRequestClose={() => setOptionsFor(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setOptionsFor(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle} numberOfLines={1}>
              {optionsFor?.nome || t("unnamed_project", { defaultValue: "Projeto sem nome" })}
            </Text>

            <Pressable
              style={({ pressed }) => [s.optionRow, pressed && { opacity: 0.85 }]}
              onPress={() => {
                const p = optionsFor;
                setOptionsFor(null);
                if (p) handleOpen(p.id);
              }}
            >
              <Text style={s.optionText}>{t("open", { defaultValue: "Abrir" })}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.optionRow, pressed && { opacity: 0.85 }]}
              onPress={() => {
                const p = optionsFor;
                setOptionsFor(null);
                if (p) confirmDelete(p);
              }}
            >
              <Text style={[s.optionText, { color: COLORS.danger }]}>
                {t("delete", { defaultValue: "Apagar" })}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.modalCloseBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setOptionsFor(null)}
            >
              <Text style={s.modalCloseText}>{t("cancel", { defaultValue: "Cancelar" })}</Text>
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
      paddingTop: 10,
      paddingBottom: 20,
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

    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      marginTop: 2,
      marginBottom: 10,
    },
    navArrow: { paddingHorizontal: 12, paddingVertical: 4 },
    navArrowText: { fontSize: 28, fontWeight: "900", color: COLORS.text, lineHeight: 32 },
    monthCenter: { alignItems: "center", flex: 1 },
    monthDisplay: { alignItems: "center", marginTop: 2, marginBottom: 10 },
    monthLabel: { fontSize: 18, fontWeight: "900", color: COLORS.text },
    monthHint: { marginTop: 2, color: COLORS.sub, fontSize: 12 },

    filters: {
      paddingHorizontal: 16,
      marginTop: 0,
      marginBottom: 10,
    },
    input: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: COLORS.text,
    },

    list: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 30,
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

    emptyBox: { paddingHorizontal: 16, paddingTop: 30 },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "900",
      textAlign: "center",
      color: COLORS.text,
      marginBottom: 6,
    },
    emptySub: { fontSize: 13, textAlign: "center", color: COLORS.sub },

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

    optionRow: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 8,
      alignItems: "center",
    },
    optionText: { fontSize: 15, fontWeight: "900", color: COLORS.text },

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

  });