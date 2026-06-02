import React, { useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { minutesToHM } from "../calc/engine";
import { CalcDia, Dia } from "../calc/types";

interface Props {
  dias: Dia[];
  calculos: CalcDia[];
  onChangeDia: (index: number, partial: Partial<Dia>) => void;
  onAddDia: () => void;
  onRemoveDia: (index: number) => void;
  COLORS: any;
  mode: "light" | "dark";
  currency: string;
}

const W = {
  num:   32,
  data:  96,
  desc:  90,
  time:  62,
  transp: 54,
  tog:   42,
  calc:  68,
  money: 80,
  del:   34,
};

const COLS = [
  { key: "num",    label: "#",       width: W.num,    type: "readonly" },
  { key: "data",   label: "Data",    width: W.data,   type: "text" },
  { key: "desc",   label: "Desc.",   width: W.desc,   type: "text" },
  { key: "inicio", label: "Início",  width: W.time,   type: "text" },
  { key: "ref",    label: "Ref.",    width: W.time,   type: "text" },
  { key: "jantar", label: "Jantar",  width: W.time,   type: "text" },
  { key: "fim",    label: "Fim",     width: W.time,   type: "text" },
  { key: "transp", label: "Transp.", width: W.transp, type: "num" },
  { key: "off",    label: "OFF",     width: W.tog,    type: "toggle" },
  { key: "meio",   label: "½D",      width: W.tog,    type: "toggle" },
  { key: "ht",     label: "H.Tot",   width: W.calc,   type: "calc" },
  { key: "hea",    label: "H.E.A",   width: W.calc,   type: "calc" },
  { key: "heb",    label: "H.E.B",   width: W.calc,   type: "calc" },
  { key: "hr",     label: "H.R",     width: W.calc,   type: "calc" },
  { key: "total",  label: "Total",   width: W.money,  type: "calc" },
  { key: "del",    label: "",        width: W.del,    type: "del" },
] as const;

const totalWidth = COLS.reduce((s, c) => s + c.width, 0) + COLS.length;

export function DayTableEditor({
  dias,
  calculos,
  onChangeDia,
  onAddDia,
  onRemoveDia,
  COLORS,
  mode,
  currency,
}: Props) {
  const s = React.useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);
  const fmt = (n: number) =>
    `${currency === "EUR" ? "€" : currency} ${Number(n ?? 0).toFixed(2)}`;

  return (
    <View style={s.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View style={{ minWidth: totalWidth }}>

          {/* Header */}
          <View style={s.headerRow}>
            {COLS.map((col) => (
              <View key={col.key} style={[s.headerCell, { width: col.width }]}>
                <Text style={s.headerText} numberOfLines={1}>{col.label}</Text>
              </View>
            ))}
          </View>

          {/* Rows */}
          {dias.map((d, i) => {
            const c = calculos[i] ?? {} as CalcDia;
            const isOff = d.diaSemTrabalho;

            return (
              <View key={i} style={[s.row, isOff && s.rowOff]}>

                {/* # */}
                <View style={[s.cell, { width: W.num }]}>
                  <Text style={[s.cellText, s.muted]}>{i + 1}</Text>
                </View>

                {/* Data */}
                <Cell width={W.data} disabled={isOff}>
                  <TextInput
                    style={s.cellInput}
                    value={d.data}
                    onChangeText={(v) => onChangeDia(i, { data: v })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.sub}
                    editable={!isOff}
                  />
                </Cell>

                {/* Desc */}
                <Cell width={W.desc} disabled={isOff}>
                  <TextInput
                    style={s.cellInput}
                    value={d.descricao ?? ""}
                    onChangeText={(v) => onChangeDia(i, { descricao: v })}
                    placeholder="—"
                    placeholderTextColor={COLORS.sub}
                    editable={!isOff}
                  />
                </Cell>

                {/* Início */}
                <Cell width={W.time} disabled={isOff}>
                  <TextInput
                    style={[s.cellInput, s.mono]}
                    value={d.inicio}
                    onChangeText={(v) => onChangeDia(i, { inicio: v })}
                    placeholder="00:00"
                    placeholderTextColor={COLORS.sub}
                    editable={!isOff}
                  />
                </Cell>

                {/* Refeição */}
                <Cell width={W.time} disabled={isOff}>
                  <TextInput
                    style={[s.cellInput, s.mono]}
                    value={d.refeicaoTrabalho}
                    onChangeText={(v) => onChangeDia(i, { refeicaoTrabalho: v })}
                    placeholder="00:00"
                    placeholderTextColor={COLORS.sub}
                    editable={!isOff}
                  />
                </Cell>

                {/* Jantar */}
                <Cell width={W.time} disabled={isOff}>
                  <TextInput
                    style={[s.cellInput, s.mono]}
                    value={d.jantarTrabalho}
                    onChangeText={(v) => onChangeDia(i, { jantarTrabalho: v })}
                    placeholder="00:00"
                    placeholderTextColor={COLORS.sub}
                    editable={!isOff}
                  />
                </Cell>

                {/* Fim */}
                <Cell width={W.time} disabled={isOff}>
                  <TextInput
                    style={[s.cellInput, s.mono]}
                    value={d.fim}
                    onChangeText={(v) => onChangeDia(i, { fim: v })}
                    placeholder="00:00"
                    placeholderTextColor={COLORS.sub}
                    editable={!isOff}
                  />
                </Cell>

                {/* Transporte (min) */}
                <Cell width={W.transp} disabled={isOff}>
                  <TextInput
                    style={[s.cellInput, s.mono]}
                    value={String(d.tempoTransporteMin ?? 0)}
                    onChangeText={(v) => {
                      const n = parseInt(v, 10);
                      onChangeDia(i, { tempoTransporteMin: isNaN(n) ? 0 : n });
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.sub}
                    editable={!isOff}
                  />
                </Cell>

                {/* OFF toggle */}
                <View style={[s.cell, { width: W.tog }]}>
                  <Pressable
                    onPress={() => onChangeDia(i, { diaSemTrabalho: !d.diaSemTrabalho })}
                    style={[s.toggle, d.diaSemTrabalho && s.toggleOn]}
                  >
                    <Text style={[s.toggleText, d.diaSemTrabalho && s.toggleTextOn]}>
                      {d.diaSemTrabalho ? "✓" : "—"}
                    </Text>
                  </Pressable>
                </View>

                {/* Meio dia toggle */}
                <View style={[s.cell, { width: W.tog }]}>
                  <Pressable
                    onPress={() => !isOff && onChangeDia(i, { meioDia: !d.meioDia })}
                    style={[s.toggle, d.meioDia && !isOff && s.toggleOn, isOff && { opacity: 0.3 }]}
                  >
                    <Text style={[s.toggleText, d.meioDia && !isOff && s.toggleTextOn]}>
                      {d.meioDia ? "✓" : "—"}
                    </Text>
                  </Pressable>
                </View>

                {/* H.Tot (calc) */}
                <View style={[s.cell, s.calcCell, { width: W.calc }]}>
                  <Text style={[s.cellText, s.mono, isOff && s.muted]}>
                    {isOff ? "—" : minutesToHM(c.HT_min ?? 0)}
                  </Text>
                </View>

                {/* H.E.A (calc) */}
                <View style={[s.cell, s.calcCell, { width: W.calc }]}>
                  <Text style={[s.cellText, s.mono, isOff && s.muted]}>
                    {isOff ? "—" : minutesToHM(c.HEA_min ?? 0)}
                  </Text>
                </View>

                {/* H.E.B (calc) */}
                <View style={[s.cell, s.calcCell, { width: W.calc }]}>
                  <Text style={[s.cellText, s.mono, isOff && s.muted]}>
                    {isOff ? "—" : minutesToHM(c.HEB_min ?? 0)}
                  </Text>
                </View>

                {/* H.R (calc) */}
                <View style={[s.cell, s.calcCell, { width: W.calc }]}>
                  <Text style={[s.cellText, s.mono, isOff && s.muted]}>
                    {isOff ? "—" : minutesToHM(c.HR_min ?? 0)}
                  </Text>
                </View>

                {/* Total € (calc) */}
                <View style={[s.cell, s.calcCell, s.totalCell, { width: W.money }]}>
                  <Text style={[s.cellText, s.bold, isOff && s.muted]}>
                    {isOff ? "—" : fmt(c.totalDia ?? 0)}
                  </Text>
                </View>

                {/* Delete */}
                <View style={[s.cell, { width: W.del }]}>
                  {i > 0 && (
                    <Pressable
                      onPress={() => onRemoveDia(i)}
                      hitSlop={6}
                      style={({ pressed }) => [s.delBtn, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={s.delText}>×</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          {/* Add row */}
          <Pressable
            onPress={onAddDia}
            style={({ pressed }) => [s.addRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={[s.addText, { color: COLORS.text }]}>+ Dia</Text>
          </Pressable>

        </View>
      </ScrollView>
    </View>
  );
}

function Cell({
  width,
  disabled,
  children,
}: {
  width: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[{ width, borderRightWidth: 1, borderColor: "transparent" }, disabled && { opacity: 0.35 }]}>
      {children}
    </View>
  );
}

const createStyles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    root: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 12,
      overflow: "hidden",
    },
    headerRow: {
      flexDirection: "row",
      backgroundColor: mode === "dark" ? COLORS.bg : "#EAECF0",
      borderBottomWidth: 1,
      borderColor: COLORS.border,
    },
    headerCell: {
      paddingVertical: 7,
      paddingHorizontal: 4,
      borderRightWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
    },
    headerText: {
      fontSize: 11,
      fontWeight: "900",
      color: COLORS.sub,
      textTransform: "uppercase",
      letterSpacing: 0.2,
    },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    rowOff: {
      backgroundColor: mode === "dark" ? COLORS.bg : "#F7F8FA",
    },
    cell: {
      paddingHorizontal: 4,
      paddingVertical: 4,
      borderRightWidth: 1,
      borderColor: COLORS.border,
      justifyContent: "center",
      alignItems: "center",
      minHeight: 38,
    },
    calcCell: {
      backgroundColor: mode === "dark" ? COLORS.bg : "#F4F5F7",
    },
    totalCell: {
      backgroundColor: mode === "dark" ? "#1a1a1a" : "#EDF2EC",
    },
    cellText: { fontSize: 13, color: COLORS.text },
    cellInput: {
      fontSize: 13,
      color: COLORS.text,
      paddingVertical: 4,
      paddingHorizontal: 4,
      width: "100%",
      minHeight: 30,
    },
    mono: { fontVariant: ["tabular-nums"] as any },
    muted: { opacity: 0.4 },
    bold: { fontWeight: "700" },
    toggle: {
      width: 28,
      height: 24,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.bg,
    },
    toggleOn: {
      backgroundColor: COLORS.text,
      borderColor: COLORS.text,
    },
    toggleText: { fontSize: 13, color: COLORS.sub },
    toggleTextOn: { color: COLORS.bg, fontWeight: "900" },
    delBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    delText: { fontSize: 16, color: COLORS.sub, lineHeight: 20 },
    addRow: {
      paddingVertical: 10,
      alignItems: "center",
      backgroundColor: COLORS.card,
      borderTopWidth: 1,
      borderColor: COLORS.border,
    },
    addText: { fontSize: 13, fontWeight: "900" },
  });
