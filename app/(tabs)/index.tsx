// app/(tabs)/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import { formatMoneyApp } from "../../src/format/money";
import i18n from "../../src/i18n/i18n";
import { getCurrentMonthSummary, MonthSummary } from "../../src/stats/monthSummary";
import { getProject, listProjects } from "../../src/storage/projects";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useIsWide } from "../../src/ui/useBreakpoint";
import { WrapSheetLogo } from "../../src/ui/WrapSheetLogo";

export default function HomeHub() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const isWide = useIsWide();

  // Resumo do mês atual (mesma fonte do Dashboard) + projeto ativo mais recente
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [latest, setLatest] = useState<{ nome: string; dias: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let alive = true;
      (async () => {
        try {
          const [sum, active] = await Promise.all([
            getCurrentMonthSummary(),
            listProjects(),
          ]);
          if (!alive) return;
          setSummary(sum);
          const top = [...active].sort((a, b) =>
            (b.updatedAt || "").localeCompare(a.updatedAt || "")
          )[0];
          if (top) {
            const full = await getProject(top.id);
            if (!alive) return;
            setLatest({
              nome: top.nome || t("unnamed_project", { defaultValue: "Projeto sem nome" }),
              dias: full?.dias?.length ?? 0,
            });
          } else {
            setLatest(null);
          }
        } catch {
          /* mantém o que estava */
        }
      })();
      return () => {
        alive = false;
      };
    }, [session])
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={COLORS.accent} />
      </SafeAreaView>
    );
  }

  if (!session) return <Redirect href="/auth/login" />;

  // On tablet/desktop the sidebar already provides all navigation
  if (isWide) return <Redirect href="/projects" />;

  // Rótulo do mês atual (ex.: "Julho 2026")
  const now = new Date();
  let monthLabel = `${now.getMonth() + 1}/${now.getFullYear()}`;
  try {
    const lbl = new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(now);
    monthLabel = lbl.charAt(0).toUpperCase() + lbl.slice(1);
  } catch {
    /* fallback numérico */
  }

  const hasData = !!summary && summary.totalProjects > 0;
  const nActive = summary?.activeProjects ?? 0;
  const activeLabel = t(
    nActive === 1 ? "home_active_projects_one" : "home_active_projects_other",
    { n: nActive, defaultValue: nActive === 1 ? "{{n}} active project" : "{{n}} active projects" }
  );

  // Subtítulo dinâmico dos Projetos: projeto ativo mais recente + nº de dias.
  // "dias" em minúscula (é a meio de frase, não um título).
  const projectsSubtitle = latest
    ? `${latest.nome} · ${latest.dias} ${t(latest.dias === 1 ? "home_days_one" : "home_days_other", { defaultValue: latest.dias === 1 ? "day" : "days" })}`
    : t("home_projects_sub", { defaultValue: "Gerir e editar relatórios" });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <WrapSheetLogo variant="lockup" size="md" />
        </View>

        <Pressable onPress={() => router.push("/settings")} hitSlop={10}>
          <Ionicons name="settings-outline" size={22} color={COLORS.text} />
        </Pressable>
      </View>

      {/* Menu */}
      <View style={s.list}>
        {/* Cartão-resumo do mês — o valor a receber é a informação que a pessoa
            mais quer ver ao abrir a app. Toca para abrir o Dashboard. */}
        <Pressable
          onPress={() => router.push("/dashboard")}
          style={({ pressed }) => [s.summaryCard, pressed && { opacity: 0.92 }]}
        >
          <Text style={s.summaryMonth}>{monthLabel}</Text>
          {summary === null ? (
            <Text style={s.summaryFigure}> </Text>
          ) : hasData ? (
            <>
              <Text style={s.summaryFigure}>{formatMoneyApp(summary.totalReceberLiquido)}</Text>
              <Text style={s.summarySub}>
                {t("to_receive", { defaultValue: "A Receber" })} · {activeLabel}
              </Text>
            </>
          ) : (
            <Text style={s.summaryEmpty}>
              {t("no_projects_in_month", { defaultValue: "Sem projetos neste mês" })}
            </Text>
          )}
        </Pressable>

        <Row
          icon="videocam-outline"
          title={t("home_projects", { defaultValue: "Projetos" })}
          subtitle={projectsSubtitle}
          onPress={() => router.push("/projects")}
        />
        <Row
          icon="stats-chart-outline"
          title={t("home_dashboard", { defaultValue: "Dashboard" })}
          subtitle={t("home_dashboard_sub", {
            defaultValue: "Resumo de horas e valores",
          })}
          onPress={() => router.push("/dashboard")}
        />
        <Row
          icon="person-outline"
          title={t("home_profile", { defaultValue: "Perfil" })}
          subtitle={t("home_profile_sub", {
            defaultValue: "Gerir perfis de técnico",
          })}
          onPress={() => router.push("/profile")}
        />
      </View>
    </SafeAreaView>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { COLORS } = useTheme();
  return (
    <Pressable onPress={onPress} style={[s.card, { borderColor: COLORS.border }]}>
      <Ionicons name={icon} size={22} color={COLORS.sub} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, { color: COLORS.text }]}>{title}</Text>
        <Text style={[s.rowSub, { color: COLORS.sub }]} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.sub} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  list: { paddingHorizontal: 16, paddingTop: 16 },

  // Cartão-resumo: fundo preto sólido (como o ícone da app) para ser o foco
  // visual — o valor a receber lê-se primeiro. Mesmos cantos/padding/espaço dos
  // botões; só muda o preenchimento e as cores do texto.
  summaryCard: {
    padding: 22,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#000",
    marginBottom: 12,
    backgroundColor: "#000",
  },
  summaryMonth: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.55)" },
  summaryFigure: { fontSize: 34, fontWeight: "900", marginTop: 6, color: "#ffffff" },
  summarySub: { fontSize: 13, marginTop: 6, color: "rgba(255,255,255,0.6)" },
  summaryEmpty: { fontSize: 16, fontWeight: "700", marginTop: 8, color: "rgba(255,255,255,0.7)" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 22,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  rowTitle: { fontSize: 18, fontWeight: "700" },
  rowSub: { fontSize: 13, marginTop: 2 },
});
