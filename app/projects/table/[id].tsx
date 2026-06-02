// app/projects/table/[id].tsx — full-page editable day table
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../src/auth/AuthContext";
import { calcAll, calcTotals, CURRENCY } from "../../../src/calc/engine";
import { Dia } from "../../../src/calc/types";
import { getPreset } from "../../../src/constants/countryPresets";
import { getSettings } from "../../../src/storage/appSettings";
import { getProject, saveProject } from "../../../src/storage/projects";
import { syncProjectToCloud } from "../../../src/sync/syncService";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { DayTableEditor } from "../../../src/ui/DayTableEditor";
import { ProjectState } from "../../../src/models/project";

const BLANK_DIA: Dia = {
  descricao: "",
  data: "",
  continuo: false,
  inicio: "08:00",
  refeicaoTrabalho: "00:00",
  jantarTrabalho: "00:00",
  fim: "19:00",
  meioDia: false,
  tempoTransporteMin: 0,
  diaSemTrabalho: false,
};

export default function TableEditorPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { COLORS, mode } = useTheme();
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectState | null>(null);
  const [saving, setSaving] = useState(false);
  const [regionCode, setRegionCode] = useState("pt");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSettings().then((s) => setRegionCode(s.region ?? "pt"));
  }, []);

  useEffect(() => {
    (async () => {
      const p = await getProject(id!);
      if (!p) { router.back(); return; }
      setProject(p as ProjectState);
    })();
  }, [id]);

  const calculos = useMemo(
    () => (project ? calcAll(project.dias, project.tabela as any) : []),
    [project]
  );

  const totais = useMemo(() => {
    if (!project) return { ValorBruto: 0, IRS_valor: 0, IVA_valor: 0, ValorFinal: 0 };
    return calcTotals(calculos, project.fiscal as any);
  }, [calculos, project?.fiscal]);

  // debounced auto-save
  const persistProject = useCallback((next: ProjectState) => {
    setProject(next);
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveProject(next as any);
      if (user) syncProjectToCloud(user.id, next as any);
      setSaving(false);
    }, 600);
  }, [user]);

  function updateDia(index: number, partial: Partial<Dia>) {
    if (!project) return;
    const dias = project.dias.map((d, i) => i === index ? { ...d, ...partial } : d);
    persistProject({ ...project, dias });
  }

  function addDia() {
    if (!project) return;
    const last = project.dias[project.dias.length - 1];
    persistProject({
      ...project,
      dias: [...project.dias, { ...BLANK_DIA, data: last?.data ?? "" }],
    });
  }

  function removeDia(index: number) {
    if (!project || index === 0) return;
    persistProject({
      ...project,
      dias: project.dias.filter((_, i) => i !== index),
    });
  }

  const s = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const totalDias = project.dias.reduce(
    (acc, d) => acc + (d.diaSemTrabalho ? 0 : d.meioDia ? 0.5 : 1), 0
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={s.backLink}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
        </Pressable>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {project.projeto.filme || t("unnamed_project")}
          </Text>
          {saving && (
            <Text style={s.savingLabel}>{t("saving", { defaultValue: "A guardar…" })}</Text>
          )}
        </View>

        {/* Summary chips */}
        <View style={s.chips}>
          <View style={s.chip}>
            <Text style={s.chipLabel}>{totalDias}d</Text>
          </View>
          <View style={[s.chip, s.chipHighlight]}>
            <Text style={[s.chipLabel, s.chipLabelHighlight]}>
              {CURRENCY} {totais.ValorFinal.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Full-width table */}
      <View style={{ flex: 1 }}>
        <DayTableEditor
          dias={project.dias}
          calculos={calculos}
          onChangeDia={updateDia}
          onAddDia={addDia}
          onRemoveDia={removeDia}
          COLORS={COLORS}
          mode={mode}
          currency={getPreset(regionCode).currency}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
    },
    backLink: {
      color: COLORS.text,
      fontSize: 15,
      fontWeight: "800",
      width: 70,
      opacity: 0.9,
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: COLORS.text,
    },
    savingLabel: {
      fontSize: 11,
      color: COLORS.sub,
      marginTop: 2,
    },
    chips: {
      flexDirection: "row",
      gap: 6,
      width: 70,
      justifyContent: "flex-end",
    },
    chip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    chipHighlight: {
      backgroundColor: COLORS.text,
      borderColor: COLORS.text,
    },
    chipLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.text,
    },
    chipLabelHighlight: {
      color: COLORS.bg,
    },
  });
