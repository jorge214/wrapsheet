// src/ui/MonthYearPicker.tsx
// Seletor de Mês + Ano — grelha de 12 meses + ano com setas, no lugar da
// antiga barra de scroll gigante. Usado em Projetos e no Painel.
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type Props = {
  visible: boolean;
  locale: string;
  year: number;          // ano inicial mostrado
  month: number;         // mês selecionado (1..12)
  showAll?: boolean;     // "Todos" selecionado
  minYear: number;
  maxYear: number;
  onClose: () => void;
  onSelect: (m: number, y: number) => void;
  onSelectAll?: () => void;
};

export function MonthYearPicker({
  visible, locale, year, month, showAll, minYear, maxYear, onClose, onSelect, onSelectAll,
}: Props) {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const [viewYear, setViewYear] = useState(year);

  // Sempre que abre, arranca no ano atualmente selecionado
  useEffect(() => { if (visible) setViewYear(year); }, [visible, year]);

  const monthShort = (m: number) => {
    const name = new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2000, m - 1, 1));
    const clean = name.replace(".", "");
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const canPrev = viewYear > minYear;
  const canNext = viewYear < maxYear;

  const s = styles(COLORS, mode);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>{t("select_month", { defaultValue: "Selecionar mês" })}</Text>

          {/* Ano com setas */}
          <View style={s.yearRow}>
            <Pressable
              disabled={!canPrev}
              onPress={() => canPrev && setViewYear((y) => y - 1)}
              hitSlop={12}
              style={({ pressed }) => [s.yArrow, pressed && { opacity: 0.5 }, !canPrev && { opacity: 0.25 }]}
            >
              <Text style={s.yArrowText}>‹</Text>
            </Pressable>
            <Text style={s.yearText}>{viewYear}</Text>
            <Pressable
              disabled={!canNext}
              onPress={() => canNext && setViewYear((y) => y + 1)}
              hitSlop={12}
              style={({ pressed }) => [s.yArrow, pressed && { opacity: 0.5 }, !canNext && { opacity: 0.25 }]}
            >
              <Text style={s.yArrowText}>›</Text>
            </Pressable>
          </View>

          {/* Grelha de meses */}
          <View style={s.grid}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const sel = !showAll && m === month && viewYear === year;
              return (
                <Pressable
                  key={m}
                  onPress={() => onSelect(m, viewYear)}
                  style={({ pressed }) => [s.mCell, sel && s.mCellOn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={[s.mCellText, sel && s.mCellTextOn]}>{monthShort(m)}</Text>
                </Pressable>
              );
            })}
          </View>

          {onSelectAll && (
            <Pressable
              onPress={onSelectAll}
              style={({ pressed }) => [s.allBtn, showAll && s.allBtnOn, pressed && { opacity: 0.85 }]}
            >
              <Text style={[s.allBtnText, showAll && s.allBtnTextOn]}>{t("all_months", { defaultValue: "Todos" })}</Text>
            </Pressable>
          )}

          <Pressable onPress={onClose} style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.85 }]}>
            <Text style={s.closeText}>{t("close", { defaultValue: "Fechar" })}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
    card: { width: "100%", maxWidth: 380, backgroundColor: COLORS.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border },
    title: { fontSize: 16, fontWeight: "900", color: COLORS.text, textAlign: "center", marginBottom: 12 },
    yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 14 },
    yArrow: { paddingHorizontal: 10, paddingVertical: 2, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) },
    yArrowText: { fontSize: 30, fontWeight: "900", color: COLORS.text, lineHeight: 34 },
    yearText: { fontSize: 22, fontWeight: "900", color: COLORS.text, minWidth: 90, textAlign: "center" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
    mCell: {
      width: "23%", paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
      backgroundColor: COLORS.bg, alignItems: "center",
      ...(Platform.OS === "web" ? ({ cursor: "pointer", userSelect: "none" } as any) : {}),
    },
    mCellOn: { backgroundColor: COLORS.text, borderColor: COLORS.text },
    mCellText: { color: COLORS.text, fontWeight: "800", fontSize: 14, textTransform: "capitalize" },
    mCellTextOn: { color: COLORS.bg },
    allBtn: {
      marginTop: 12, paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border,
      alignItems: "center", backgroundColor: COLORS.bg,
      ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
    },
    allBtnOn: { backgroundColor: COLORS.text, borderColor: COLORS.text },
    allBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
    allBtnTextOn: { color: COLORS.bg },
    closeBtn: { marginTop: 10, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 8 },
    closeText: { color: COLORS.sub, fontWeight: "900", fontSize: 13 },
  });
