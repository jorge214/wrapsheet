// src/ui/FormatPickerModal.tsx
// Ao criar um projeto: que folha? Publicidade (ao dia, a de sempre) ou Cinema
// (à semana), e no cinema quantos dias tem a semana — 5 (+2 folgas, 60h de
// descanso entre semanas) ou 6 (+1 folga, 36h). O formato vive no PROJETO —
// o mesmo perfil faz os dois. No cinema escolhe-se também a SEMANA (esta ou a
// seguinte): quem começa na segunda seguinte não tem de mudar 7 datas à mão.
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { FormatoFolha } from "../calc/project";
import { segundaDaSemana } from "../storage/novaFolha";
import { useTheme } from "../theme/ThemeProvider";

export type FormatPick = { formato: FormatoFolha; diasSemana?: 5 | 6; semanas?: 0 | 1 };

export function FormatPickerModal({
  visible,
  onClose,
  onPick,
  /** Só as opções de cinema (quando o painel já está filtrado em Cinema) */
  cinemaOnly,
  mes,
  ano,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (pick: FormatPick) => void;
  cinemaOnly?: boolean;
  /** Mês em foco na lista (sem = mês corrente), para mostrar as datas das semanas */
  mes?: number;
  ano?: number;
}) {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const s = styles(COLORS);
  const [semanas, setSemanas] = useState<0 | 1>(0);
  useEffect(() => {
    if (visible) setSemanas(0);
  }, [visible]);

  const Option = ({ pick, label, hint }: { pick: FormatPick; label: string; hint: string }) => (
    <Pressable
      onPress={() => onPick(pick)}
      style={({ pressed }) => [s.opt, pressed && { opacity: 0.85, borderColor: COLORS.text }]}
    >
      <Text style={s.optLabel}>{label}</Text>
      <Text style={s.optHint}>{hint}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>
            {cinemaOnly
              ? t("new_project_week_title", { defaultValue: "Semana de quantos dias?" })
              : t("new_project_format_title", { defaultValue: "Que folha queres criar?" })}
          </Text>

          {!cinemaOnly && (
            <Option
              pick={{ formato: "publicidade" }}
              label={t("format_publicidade", { defaultValue: "Publicidade" })}
              hint={t("format_publicidade_hint", { defaultValue: "Folha ao dia — a de sempre." })}
            />
          )}
          <Text style={s.weekLabel}>{t("new_project_which_week", { defaultValue: "Que semana?" })}</Text>
          <View style={s.weekRow}>
            {([0, 1] as const).map((w) => {
              const seg = segundaDaSemana(mes, ano, w);
              const on = semanas === w;
              return (
                <Pressable
                  key={w}
                  onPress={() => setSemanas(w)}
                  accessibilityState={{ selected: on }}
                  style={[s.weekChip, on && { borderColor: COLORS.accent, backgroundColor: COLORS.bg }]}
                >
                  <Text style={[s.weekChipText, on && { color: COLORS.accent }]} numberOfLines={1}>
                    {seg.format("DD/MM")} – {seg.add(6, "day").format("DD/MM")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Option
            pick={{ formato: "cinema", diasSemana: 5, semanas }}
            label={t("format_cinema_5days", { defaultValue: "Cinema · semana de 5 dias" })}
            hint={t("format_cinema_hint", {
              defaultValue: "Folha à semana: 5 dias + 2 folgas, descanso entre semanas, feriados a dobrar.",
            })}
          />
          <Option
            pick={{ formato: "cinema", diasSemana: 6, semanas }}
            label={t("format_cinema_6days", { defaultValue: "Cinema · semana de 6 dias" })}
            hint={t("format_cinema_6_hint", {
              defaultValue: "6 dias + 1 folga; 36 horas de descanso entre semanas.",
            })}
          />

          <Pressable onPress={onClose} style={s.cancelBtn}>
            <Text style={s.cancelText}>{t("cancel", { defaultValue: "Cancelar" })}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (COLORS: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 16,
      padding: 18,
      width: "100%",
      maxWidth: 380,
      gap: 10,
    },
    title: { fontSize: 17, fontWeight: "900", color: COLORS.text, textAlign: "center", marginBottom: 4 },
    opt: {
      borderWidth: 1.5,
      borderColor: COLORS.border,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 14,
      gap: 4,
    },
    optLabel: { fontSize: 16, fontWeight: "900", color: COLORS.text },
    optHint: { fontSize: 13, lineHeight: 18, color: COLORS.sub, fontWeight: "600" },
    weekLabel: { fontSize: 13, fontWeight: "800", color: COLORS.sub, marginTop: 4 },
    weekRow: { flexDirection: "row", gap: 8 },
    weekChip: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
    },
    weekChipText: { fontSize: 14, fontWeight: "800", color: COLORS.sub },
    cancelBtn: { alignItems: "center", paddingVertical: 10, marginTop: 2 },
    cancelText: { color: COLORS.sub, fontWeight: "800", fontSize: 13.5 },
  });
