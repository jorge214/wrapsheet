// app/(tabs)/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useIsWide } from "../../src/ui/useBreakpoint";
import { WrapSheetLogo } from "../../src/ui/WrapSheetLogo";

export default function HomeHub() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const isWide = useIsWide();

  // On tablet/desktop the sidebar already provides all navigation
  if (isWide) return <Redirect href="/projects" />;

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
        <Row
          icon="videocam-outline"
          title={t("home_projects", { defaultValue: "Projetos" })}
          subtitle={t("home_projects_sub", {
            defaultValue: "Gerir e editar relatórios",
          })}
          onPress={() => router.push("/projects")}
        />
        <Row
          icon="archive-outline"
          title={t("home_archived", { defaultValue: "Arquivados" })}
          subtitle={t("home_archived_sub", {
            defaultValue: "Relatórios guardados",
          })}
          onPress={() => router.push("/archived")}
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
        <Text style={[s.rowSub, { color: COLORS.sub }]}>{subtitle}</Text>
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