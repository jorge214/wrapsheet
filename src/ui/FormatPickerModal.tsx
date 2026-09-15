// src/ui/FormatPickerModal.tsx
// Ao criar um projeto: que folha? Publicidade (ao dia, a de sempre) ou Cinema
// (à semana), e no cinema quantos dias tem a semana — 5 (+2 folgas, 60h de
// descanso entre semanas) ou 6 (+1 folga, 36h). O formato vive no PROJETO —
// o mesmo perfil faz os dois.
import React from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { FormatoFolha } from "../calc/project";
import { useTheme } from "../theme/ThemeProvider";

export type FormatPick = { formato: FormatoFolha; diasSemana?: 5 | 6 };

export function FormatPickerModal({
  visible,
  onClose,
  onPick,
  /** Só as opções de cinema (quando o painel já está filtrado em Cinema) */
  cinemaOnly,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (pick: FormatPick) => void;
  cinemaOnly?: boolean;
}) {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const s = styles(COLORS);

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
          <Option
            pick={{ formato: "cinema", diasSemana: 5 }}
            label={t("format_cinema_5days", { defaultValue: "Cinema · semana de 5 dias" })}
            hint={t("format_cinema_hint", {
              defaultValue: "Folha à semana: 5 dias + 2 folgas, descanso entre semanas, feriados a dobrar.",
            })}
          />
          <Option
            pick={{ formato: "cinema", diasSemana: 6 }}
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
    cancelBtn: { alignItems: "center", paddingVertical: 10, marginTop: 2 },
    cancelText: { color: COLORS.sub, fontWeight: "800", fontSize: 13.5 },
  });
