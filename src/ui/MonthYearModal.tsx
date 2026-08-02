// src/ui/MonthYearModal.tsx
// Seletor de mês/ano de um projeto — define a que mês ele PERTENCE (o que a
// lista e o painel usam para filtrar), independentemente das datas dos dias.
// Usado na lista de projetos (menu ⋯ → "Mover para outro mês") e como atalho
// no próprio projeto. Nomes dos meses vêm do Intl, por isso ficam na língua da
// app sem precisarem de tradução própria.
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import i18n from "../i18n/i18n";
import { useTheme } from "../theme/ThemeProvider";

export function MonthYearModal({
  visible,
  mes,
  ano,
  title,
  onClose,
  onPick,
}: {
  visible: boolean;
  mes: number;
  ano: number;
  /** Título do modal; por omissão "Mês do projeto". */
  title?: string;
  onClose: () => void;
  onPick: (mes: number, ano: number) => void;
}) {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const [selMes, setSelMes] = useState(mes);
  const [selAno, setSelAno] = useState(ano);

  // Reabrir o modal parte sempre do mês atual do projeto (e não do que ficou
  // selecionado da vez anterior).
  useEffect(() => {
    if (visible) {
      setSelMes(mes);
      setSelAno(ano);
    }
  }, [visible, mes, ano]);

  const monthName = (m: number) => {
    const s = new Intl.DateTimeFormat(i18n.language, { month: "short" }).format(
      new Date(2000, m - 1, 1)
    );
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const s = styles(COLORS);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>
            {title ?? t("project_month", { defaultValue: "Mês do projeto" })}
          </Text>

          <View style={s.yearRow}>
            <Pressable onPress={() => setSelAno((y) => y - 1)} hitSlop={10} style={s.yearBtn}>
              <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            </Pressable>
            <Text style={s.yearText}>{selAno}</Text>
            <Pressable onPress={() => setSelAno((y) => y + 1)} hitSlop={10} style={s.yearBtn}>
              <Ionicons name="chevron-forward" size={22} color={COLORS.text} />
            </Pressable>
          </View>

          <View style={s.grid}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const sel = m === selMes;
              return (
                <Pressable key={m} onPress={() => setSelMes(m)} style={[s.month, sel && s.monthSel]}>
                  <Text style={[s.monthText, sel && s.monthTextSel]}>{monthName(m)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={s.saveBtn} onPress={() => onPick(selMes, selAno)}>
            <Text style={s.saveText}>{t("save", { defaultValue: "Guardar" })}</Text>
          </Pressable>
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
      maxWidth: 360,
    },
    title: { fontSize: 17, fontWeight: "900", color: COLORS.text, textAlign: "center", marginBottom: 12 },
    yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 14 },
    yearBtn: { padding: 6 },
    yearText: { fontSize: 20, fontWeight: "900", color: COLORS.text, minWidth: 72, textAlign: "center" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
    month: {
      width: "30%",
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
    },
    // Preto (COLORS.text), não o azul de sistema: é a cor dos botões
    // principais da app (ex.: "Editar folha" na página do projeto).
    monthSel: { backgroundColor: COLORS.text, borderColor: COLORS.text },
    monthText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
    monthTextSel: { color: COLORS.card },
    saveBtn: { backgroundColor: COLORS.text, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 16 },
    saveText: { color: COLORS.card, fontWeight: "900", fontSize: 15 },
    cancelBtn: { alignItems: "center", paddingVertical: 10, marginTop: 2 },
    cancelText: { color: COLORS.sub, fontWeight: "800", fontSize: 13.5 },
  });
