// app/dashboard/index.tsx
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { useIsWide } from "../../src/ui/useBreakpoint";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CURRENCY } from "../../src/calc/engine";
import i18n from "../../src/i18n/i18n";
import { getMonthSummary, MonthSummary } from "../../src/stats/monthSummary";
import {
  listArchivedProjects,
  listProjects,
  ProjectListItem,
} from "../../src/storage/projects";
import { useTheme } from "../../src/theme/ThemeProvider";

type RecentItem = ProjectListItem & { status: "active" | "archived" };

function fmtMonthLabel(m: number, y: number, locale: string) {
  const date = new Date(y, m - 1, 1);
  const name = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

function toMMYYYY(m: number, y: number) {
  const mm = String(m).padStart(2, "0");
  return `${mm}/${y}`;
}

// tenta formatar números PT (11,5 / 0,00 etc)
function formatNumberPT(n: number, digits = 0) {
  try {
    return new Intl.NumberFormat("pt-PT", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return String(Number(n ?? 0).toFixed(digits)).replace(".", ",");
  }
}

function formatMoneyPT(n: number) {
  return `${CURRENCY} ${formatNumberPT(n ?? 0, 2)}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { COLORS, mode } = useTheme();
  const isWide = useIsWide();
  const s = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);

  const [mes, setMes] = useState(() => new Date().getMonth() + 1); // 1..12
  const [ano, setAno] = useState(() => new Date().getFullYear());

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [archived, setArchived] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);

  const [pickerVisible, setPickerVisible] = useState(false);

  const locale = i18n.language;
  const labelMes = useMemo(() => fmtMonthLabel(mes, ano, locale), [mes, ano, locale]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [activeList, archivedList, summary] = await Promise.all([
        listProjects(),
        listArchivedProjects(),
        getMonthSummary(mes, ano),
      ]);

      const sortByUpdated = (arr: ProjectListItem[]) =>
        [...arr].sort((a, b) => {
          const ta = a.updatedAt ? dayjs(a.updatedAt).valueOf() : 0;
          const tb = b.updatedAt ? dayjs(b.updatedAt).valueOf() : 0;
          return tb - ta;
        });

      setProjects(sortByUpdated(activeList));
      setArchived(sortByUpdated(archivedList));
      setMonthSummary(summary);
    } finally {
      setLoading(false);
    }
  }, [mes, ano]);

  useEffect(() => {
    load();
  }, [load]);

  // meses disponíveis (a partir do que existe nos projetos)
  const monthOptions = useMemo(() => {
    const all = [...projects, ...archived];
    const set = new Set<string>();

    for (const p of all) {
      const m = (p.mes || "").trim(); // ex: "12/2025"
      if (m) set.add(m);
    }

    if (set.size === 0) set.add(toMMYYYY(mes, ano));

    const sorted = Array.from(set).sort((a, b) => {
      const [am, ay] = a.split("/").map(Number);
      const [bm, by] = b.split("/").map(Number);
      const va = (ay || 0) * 100 + (am || 0);
      const vb = (by || 0) * 100 + (bm || 0);
      return vb - va;
    });

    return sorted
      .map((mmYYYY) => {
        const [mm, yy] = mmYYYY.split("/").map(Number);
        if (!mm || !yy) return null;
        return { label: fmtMonthLabel(mm, yy, locale), mes: mm, ano: yy };
      })
      .filter(Boolean) as { label: string; mes: number; ano: number }[];
  }, [projects, archived, mes, ano, locale]);

  const monthKey = toMMYYYY(mes, ano);

  const recentItems = useMemo(() => {
    const map = (arr: ProjectListItem[], status: "active" | "archived") =>
      arr
        .filter((p) => (p.mes || "") === monthKey)
        .map((p) => ({ ...p, status }));

    const merged: RecentItem[] = [
      ...map(projects, "active"),
      ...map(archived, "archived"),
    ];

    merged.sort((a, b) => {
      const ta = a.updatedAt ? dayjs(a.updatedAt).valueOf() : 0;
      const tb = b.updatedAt ? dayjs(b.updatedAt).valueOf() : 0;
      return tb - ta;
    });

    return merged.slice(0, 3);
  }, [projects, archived, monthKey]);

  const stats = useMemo(() => {
  const totalProjetosMes = projects.filter((p) => (p.mes || "") === monthKey).length;
  const totalArquivados = archived.length;

  return {
    totalProjetosMes,
    totalAtualizadosMes: monthSummary?.totalProjects ?? totalProjetosMes,
    totalArquivados,
    horasMes: monthSummary?.totalHoras ?? 0,
    diasTrabalhoMes: monthSummary?.totalDiasTrabalho ?? 0,
    valorBrutoMes: monthSummary?.totalValorBruto ?? 0,
  };
}, [projects, archived, monthSummary, monthKey]);


  function openProject(id: string) {
    router.push(`/projects/${id}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* HEADER (igual a Projects/Archived) */}
      <View style={s.header}>
        {!isWide && (
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.backLink}>
              ‹ {t("back", { defaultValue: "Voltar" })}
            </Text>
          </Pressable>
        )}

        <Text style={s.headerTitle}>
          {t("dashboard_title", { defaultValue: "Dashboard" })}
        </Text>

        {!isWide && <View style={{ width: 70 }} />}
      </View>

      {/* MÊS (igual a Projects) */}
      <Pressable
        style={({ pressed }) => [s.monthDisplay, pressed && { opacity: 0.88 }]}
        onPress={() => setPickerVisible(true)}
      >
        <Text style={s.monthLabel}>{labelMes}</Text>
        <Text style={s.monthHint}>
          {Platform.OS === "web"
            ? t("click_to_select_month", { defaultValue: "Clique para selecionar o mês" })
            : t("tap_to_select_month", { defaultValue: "Toque para selecionar o mês" })}
        </Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ paddingTop: 6, paddingBottom: 10 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {/* STATS GRID */}
        <View style={s.statsGrid}>
          <StatCard
            s={s}
            value={formatNumberPT(stats.totalProjetosMes, 0)}
            label={t("dash_projects_month", { defaultValue: "Projetos (mês)" })}
          />
          <StatCard
            s={s}
            value={formatNumberPT(stats.totalAtualizadosMes, 0)}
            label={t("dash_updated_month", { defaultValue: "Atualizados (mês)" })}
          />
          <StatCard
            s={s}
            value={formatNumberPT(stats.totalArquivados, 0)}
            label={t("dash_archived_total", { defaultValue: "Arquivados (total)" })}
          />
          <StatCard
            s={s}
            value={formatNumberPT(stats.horasMes, 1)}
            label={t("dash_hours_month", { defaultValue: "Horas (mês)" })}
          />
          <StatCard
            s={s}
            value={formatNumberPT(stats.diasTrabalhoMes, 0)}
            label={t("dash_workdays_month", { defaultValue: "Dias trabalho (mês)" })}
          />
          <StatCard
            s={s}
            value={formatMoneyPT(stats.valorBrutoMes)}
            label={t("dash_gross_month", { defaultValue: "Valor bruto (mês)" })}
            isMoney
          />
        </View>

        {/* RECENTES */}
        <Text style={s.sectionTitle}>
          {t("dash_recent_month", { defaultValue: "Recentes no mês" })}
        </Text>

        {recentItems.length === 0 ? (
          <Text style={s.emptyText}>
            {t("dash_no_recent", { defaultValue: "Sem projetos recentes neste mês." })}
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {recentItems.map((p) => {
              const updated =
                p.updatedAt && dayjs(p.updatedAt).isValid()
                  ? dayjs(p.updatedAt).format("DD/MM/YYYY HH:mm")
                  : "--/--/---- --:--";

              return (
                <Pressable
                  key={p.id}
                  onPress={() => openProject(p.id)}
                  style={({ pressed, hovered }: any) => [
                    pressed && { opacity: 0.92 },
                    Platform.OS === "web" && hovered && { opacity: 0.88 },
                  ]}
                >
                  <View style={s.recentCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.recentTitle} numberOfLines={1}>
                          {p.nome || t("project_unnamed", { defaultValue: "Projeto sem nome" })}
                        </Text>
                        <Text style={s.recentSub} numberOfLines={1}>
                          {(p.cliente || "—") + " · " + (p.mes || "--/----")}
                        </Text>
                        <Text style={s.recentSub} numberOfLines={1}>
                          {t("updated_at", { defaultValue: "Atualizado:" })}{" "}
                          <Text style={s.recentSubStrong}>{updated}</Text>
                        </Text>
                      </View>

                      <View
                        style={[
                          s.badge,
                          p.status === "active" ? s.badgeActive : s.badgeArchived,
                        ]}
                      >
                        <Text style={s.badgeText}>
                          {p.status === "active"
                            ? t("status_active", { defaultValue: "Ativo" })
                            : t("status_archived", { defaultValue: "Arquivado" })}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal selecionar mês (estilo Projects) */}
      <Modal transparent animationType="fade" visible={pickerVisible}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {t("select_month", { defaultValue: "Selecionar mês" })}
            </Text>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {monthOptions.map((opt) => {
                const selected = opt.mes === mes && opt.ano === ano;
                return (
                  <Pressable
                    key={`${opt.mes}-${opt.ano}`}
                    style={({ pressed }) => [
                      s.monthOption,
                      selected && s.monthOptionSelected,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => {
                      setMes(opt.mes);
                      setAno(opt.ano);
                      setPickerVisible(false);
                    }}
                  >
                    <Text style={[s.monthOptionText, selected && s.monthOptionTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [s.modalCloseBtn, pressed && { opacity: 0.88 }]}
              onPress={() => setPickerVisible(false)}
            >
              <Text style={s.modalCloseText}>
                {t("close", { defaultValue: "Fechar" })}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({
  s,
  value,
  label,
  isMoney,
}: {
  s: any;
  value: string;
  label: string;
  isMoney?: boolean;
}) {
  return (
    <View style={s.statCard}>
      <Text style={[s.statValue, isMoney && s.statValueMoney]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={s.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const createStyles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backLink: {
      color: COLORS.text, // ✅ neutro (igual aos projetos)
      fontSize: 15,
      fontWeight: "800",
      width: 70,
    },
    headerTitle: {
      color: COLORS.text,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.2,
    },

    monthDisplay: { alignItems: "center", marginTop: 2, marginBottom: 10 },
    monthLabel: { fontSize: 18, fontWeight: "900", color: COLORS.text },
    monthHint: { marginTop: 2, color: COLORS.sub, fontSize: 12 },

    content: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 30,
    },

    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    statCard: {
      width: "48%",
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 16,
      padding: 13,
      shadowColor: COLORS.shadow,
      shadowOpacity: mode === "dark" ? 0.28 : 0.12,
      shadowRadius: 6,
    },
    statValue: {
      fontSize: 22,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: -0.3,
    },
    statValueMoney: {
      fontSize: 22,
    },
    statLabel: {
      marginTop: 6,
      fontSize: 13,
      color: COLORS.sub,
      fontWeight: "700",
    },

    sectionTitle: {
      marginTop: 18,
      marginBottom: 10,
      fontSize: 20,
      fontWeight: "900",
      color: COLORS.text,
    },
    emptyText: {
      color: COLORS.sub,
      fontSize: 14,
      marginBottom: 8,
    },

    recentCard: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 16,
      padding: 14,
      shadowColor: COLORS.shadow,
      shadowOpacity: mode === "dark" ? 0.28 : 0.12,
      shadowRadius: 6,
    },
    recentTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: COLORS.text,
    },
    recentSub: {
      marginTop: 4,
      fontSize: 13,
      color: COLORS.sub,
    },
    recentSubStrong: { color: COLORS.text, fontWeight: "900" },

    badge: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: "transparent",
    },
    badgeActive: {},
    badgeArchived: {},
    badgeText: {
      fontSize: 13,
      fontWeight: "900",
      color: COLORS.sub,
    },

    /* Modal (igual aos projetos) */
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
      borderColor: COLORS.border,
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
