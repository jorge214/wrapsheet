// src/ui/EditableSheet.tsx
// WYSIWYG editor: the editing surface IS the payslip sheet (same layout/colors
// as the exported PDF). White cells = editable; grey/green cells = computed.
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { minutesToHM } from "../calc/engine";
import { CalcDia, Dia } from "../calc/types";
import { fmtMoney, getStrings } from "../export/buildPdfHtml";

/* ---------------- Colours (match the PDF exactly) ---------------- */
const C = {
  ink: "#2b2b2b",
  red: "#c00000",
  boxTitleBg: "#f2f2f2",
  th: "#7f7f7f",
  blue: "#2e75b6",
  olive: "#7f7f2e",
  purple: "#7030a0",
  gold: "#bf9000",
  subGrey: "#d9d9d9",
  subBlue: "#cfe0f2",
  subOlive: "#e6e6c8",
  subPurple: "#e4d6f0",
  subGold: "#f2e2b3",
  green: "#1f7a37",
  blueTxt: "#1b5fbf",
  calcBg: "#f7f7f7",
  white: "#fff",
  text: "#111",
  sub: "#8E8E93",
  danger: "#FF3B30",
};

/* ---------------- Time / date helpers ---------------- */
function parseTimeToMinutes(str: string): number | null {
  if (!str) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || min > 59 || h > 23) return null;
  return h * 60 + min;
}
function isValidTime(v: string) {
  return parseTimeToMinutes(v) !== null;
}
function maskTime(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : d.slice(0, 2) + ":" + d.slice(2);
}
function parseISO(v?: string) {
  if (!v) return null;
  const d = dayjs(v);
  return d.isValid() ? d : null;
}
function formatDateDisplay(v: string | undefined, lang: string) {
  const d = parseISO(v);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat(lang, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d.toDate());
  } catch {
    return d.format("DD/MM/YYYY");
  }
}
function monthTitle(d: dayjs.Dayjs, lang: string) {
  try {
    const s = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" }).format(d.toDate());
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return d.format("MM/YYYY");
  }
}
function monthName(m: number, lang: string) {
  try {
    const s = new Intl.DateTimeFormat(lang, { month: "long" }).format(new Date(2000, (m || 1) - 1, 1));
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return String(m);
  }
}
function weekdayHeaders(lang: string): string[] {
  try {
    const fmt = new Intl.DateTimeFormat(lang, { weekday: "narrow" });
    const base = new Date(2021, 7, 2); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return fmt.format(d);
    });
  } catch {
    return ["S", "T", "Q", "Q", "S", "S", "D"];
  }
}

/* ---------------- Calendar popover ---------------- */
function CalendarModal({
  visible, value, lang, onClose, onPick,
}: {
  visible: boolean; value: string; lang: string; onClose: () => void; onPick: (iso: string) => void;
}) {
  const [view, setView] = useState(() => (parseISO(value) ?? dayjs()).startOf("month"));
  useEffect(() => { if (visible) setView((parseISO(value) ?? dayjs()).startOf("month")); }, [visible]);
  const daysInMonth = view.daysInMonth();
  const firstWeekday = (view.startOf("month").day() + 6) % 7;
  const sel = parseISO(value)?.format("YYYY-MM-DD") ?? "";
  const today = dayjs().format("YYYY-MM-DD");
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={cal.backdrop} onPress={onClose}>
        <Pressable style={cal.card} onPress={() => {}}>
          <View style={cal.header}>
            <Pressable onPress={() => setView(view.subtract(1, "month"))} hitSlop={10} style={cal.nav}><Text style={cal.navTxt}>‹</Text></Pressable>
            <Text style={cal.title}>{monthTitle(view, lang)}</Text>
            <Pressable onPress={() => setView(view.add(1, "month"))} hitSlop={10} style={cal.nav}><Text style={cal.navTxt}>›</Text></Pressable>
          </View>
          <View style={cal.weekRow}>
            {weekdayHeaders(lang).map((h, i) => <Text key={i} style={cal.weekday}>{h}</Text>)}
          </View>
          <View style={cal.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={i} style={cal.cell} />;
              const iso = view.date(d).format("YYYY-MM-DD");
              const isSel = iso === sel;
              const isToday = iso === today;
              return (
                <Pressable key={i} onPress={() => onPick(iso)} style={({ pressed }) => [cal.cell, cal.cellDay, isSel && cal.cellSel, !isSel && isToday && cal.cellToday, pressed && { opacity: 0.7 }]}>
                  <Text style={[cal.cellTxt, isSel && cal.cellTxtSel]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------------- Cell field primitives ---------------- */
function CellText({ value, onChangeText, align = "left" }: { value: string; onChangeText: (v: string) => void; align?: "left" | "right" | "center" }) {
  return (
    <TextInput
      style={[sh.cellInput, { textAlign: align }]}
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor={C.sub}
    />
  );
}
function CellTime({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => { setText(value ?? ""); }, [value]);
  const bad = text.trim().length > 0 && !isValidTime(text);
  return (
    <TextInput
      style={[sh.cellInput, { textAlign: "center" }, bad && sh.cellInputBad]}
      value={text}
      onChangeText={(v) => { const m = maskTime(v); setText(m); onChangeText(m); }}
      keyboardType="numeric"
      placeholder="00:00"
      placeholderTextColor={C.sub}
      maxLength={5}
    />
  );
}
function CellNum({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <TextInput
      style={[sh.cellInput, { textAlign: "center" }]}
      value={String(value ?? 0)}
      onChangeText={(v) => onChange(Number(v) || 0)}
      keyboardType="numeric"
      placeholderTextColor={C.sub}
    />
  );
}
function CellMoney({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value ?? 0));
  useEffect(() => {
    // Only resync from the prop when it no longer matches what's typed
    // (avoids the comma→dot jump while entering decimals).
    if (Number(text.replace(",", ".")) !== Number(value)) setText(String(value ?? 0));
  }, [value]);
  return (
    <TextInput
      style={[sh.cellInput, { textAlign: "right" }]}
      value={text}
      onChangeText={(v) => { setText(v); onChange(Number(v.replace(",", ".")) || 0); }}
      keyboardType="numeric"
      placeholderTextColor={C.sub}
    />
  );
}
function CellDate({ value, lang, onChangeText }: { value: string; lang: string; onChangeText: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const disp = formatDateDisplay(value, lang) || value || "";
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [sh.cellDate, pressed && { opacity: 0.7 }]}>
        <Text style={[sh.cellDateTxt, !disp && { color: C.sub }]} numberOfLines={1}>{disp || "—"}</Text>
      </Pressable>
      <CalendarModal visible={open} value={value} lang={lang} onClose={() => setOpen(false)} onPick={(iso) => { onChangeText(iso); setOpen(false); }} />
    </>
  );
}

/* ---------------- Layout helpers ---------------- */
function Box({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[sh.box, style]}>{children}</View>;
}
function BoxTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={sh.boxTitleRow}>
      <Text style={sh.boxTitle}>{children}</Text>
      {right}
    </View>
  );
}
/** Editable key/value row inside a header box. */
function KV({ label, value, onChangeText, labelW = 120, keyboardType, last }: {
  label: string; value: string; onChangeText: (v: string) => void; labelW?: number; keyboardType?: any; last?: boolean;
}) {
  return (
    <View style={[sh.kvRow, last && { borderBottomWidth: 0 }]}>
      <View style={[sh.kCell, { width: labelW }]}><Text style={sh.kTxt}>{label}</Text></View>
      <View style={sh.vCell}>
        <TextInput style={sh.vInput} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholderTextColor={C.sub} />
      </View>
    </View>
  );
}
/** Computed key/value row (green totals). */
function KVCalc({ label, value, mini }: { label: string; value: string; mini?: boolean }) {
  return (
    <View style={sh.kvRow}>
      <View style={sh.kCellHalf}><Text style={[sh.kGreen, mini && { color: C.sub, fontWeight: "600" }]}>{label}</Text></View>
      <View style={sh.vCellHalf}><Text style={[sh.vCalc, mini && { fontWeight: "600", color: C.sub }]}>{value}</Text></View>
    </View>
  );
}

/* ---------------- Day-table column widths ---------------- */
const W = {
  desc: 120, data: 100, sal: 72,
  ini: 58, ref: 58, fim: 58, jan: 58, tra: 64,
  ht: 78, hd: 78,
  aRef: 64, aPer: 64, aTel: 64, aViat: 64, aMat: 64,
  heaT: 46, heaV: 60, hebT: 46, hebV: 60, hrT: 46, hrV: 60,
  tot: 84, act: 56,
};
const DAY_TABLE_W =
  W.desc + W.data + W.sal + W.ini + W.ref + W.fim + W.jan + W.tra + W.ht + W.hd +
  W.aRef + W.aPer + W.aTel + W.aViat + W.aMat + W.heaT + W.heaV + W.hebT + W.hebV + W.hrT + W.hrV + W.tot + W.act;

/** Header cell (row 1 group / row 2 sub). */
function HCell({ w, label, bg = C.th, color = "#fff", small }: { w: number; label: string; bg?: string; color?: string; small?: boolean }) {
  return (
    <View style={[sh.hCell, { width: w, backgroundColor: bg }]}>
      <Text style={[sh.hTxt, { color }, small && sh.hTxtSmall]} numberOfLines={2}>{label}</Text>
    </View>
  );
}
/** Body cell wrapper. */
function TD({ w, children, calc, tint }: { w: number; children: React.ReactNode; calc?: boolean; tint?: string }) {
  return <View style={[sh.td, { width: w }, calc && sh.tdCalc, tint ? { backgroundColor: tint } : null]}>{children}</View>;
}
function CalcTxt({ children, align = "center", strong, blue }: { children: React.ReactNode; align?: "left" | "right" | "center"; strong?: boolean; blue?: boolean }) {
  return <Text style={[sh.calcTxt, { textAlign: align }, strong && sh.calcStrong, blue && { color: C.blueTxt, fontWeight: "800" }]} numberOfLines={1}>{children}</Text>;
}

/* ---------------- Props ---------------- */
type Perfil = { nome: string; email: string; telefone: string; departamento: string; funcao: string; empresa?: string; nif?: string; iban?: string; swift?: string };
type Projeto = { filme: string; produtora: string; nifProdutora?: string; semana?: string; mes: number; ano: number };
type Ajudas = { refeicao?: number; viatura?: number; material?: number; telefone?: number; perDiem?: number };
type Tabela = { salarioDia?: number; H_dia: number; multHEA?: number; multHEB?: number; multHR?: number; ajudas?: Ajudas };

type Props = {
  perfil: Perfil;
  projeto: Projeto;
  tabela: Tabela;
  dias: Dia[];
  calculos: CalcDia[];
  totais: { ValorBruto: number; IRS_valor: number; IVA_valor: number; ValorFinal: number };
  notas: string;
  condicoes: string;
  locale: string;
  region: string;
  currency: string;
  taxDisclaimer: string;
  isWide: boolean;
  onPerfil: (patch: Partial<Perfil>) => void;
  onProjeto: (patch: Partial<Projeto>) => void;
  onTabela: (patch: Partial<Tabela>) => void;
  onDia: (i: number, patch: Partial<Dia>) => void;
  onAddDia: () => void;
  onDuplicateDia: (i: number) => void;
  onRemoveDia: (i: number) => void;
  onNotas: (v: string) => void;
  onCondicoes: (v: string) => void;
  onApplyProfile: () => void;
};

export default function EditableSheet(props: Props) {
  const {
    perfil, projeto, tabela, dias, calculos, totais, notas, condicoes,
    locale, region, currency, taxDisclaimer, isWide,
    onPerfil, onProjeto, onTabela, onDia, onAddDia, onDuplicateDia, onRemoveDia, onNotas, onCondicoes, onApplyProfile,
  } = props;

  const s = getStrings(locale, region);
  const money = (n: number) => fmtMoney(Number(n) || 0, currency);
  const aj = tabela.ajudas ?? {};
  const setAj = (patch: Partial<Ajudas>) => onTabela({ ajudas: { ...aj, ...patch } });

  const salarioDia = Number(tabela.salarioDia || 0);
  const hDia = tabela.H_dia || 8;
  const vHEA = salarioDia ? (salarioDia / hDia) * Number(tabela.multHEA ?? 1.5) : 0;
  const vHEB = salarioDia ? (salarioDia / hDia) * Number(tabela.multHEB ?? 2.0) : 0;
  const vHR = salarioDia ? (salarioDia / hDia) * Number(tabela.multHR ?? 3.0) : 0;

  const totalDias = dias.reduce((acc, d) => acc + (d.diaSemTrabalho ? 0 : d.meioDia ? 0.5 : 1), 0);
  const today = new Date();
  const emitidoA = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
  const mesNome = monthName(projeto.mes, locale);

  const perHour = s.perHour;
  const perDayUnit = s.perDayUnit;

  // App-only columns (not on the PDF) — minimal localization
  const dinnerLabel = locale.startsWith("en") ? "DINNER" : locale.startsWith("es") ? "CENA" : locale.startsWith("fr") ? "DÎNER" : locale.startsWith("de") ? "ABEND" : locale.startsWith("it") ? "CENA" : "JANTAR";
  const transpLabel = "TRANSP.";

  return (
    <View>
      {/* ── Title bar ─────────────────────────────── */}
      <View style={sh.titleBar}>
        <Text style={sh.titleTxt}>{s.title}</Text>
        <Text style={sh.subTitleTxt}>{s.subtitle}</Text>
      </View>

      {/* ── Header grid ───────────────────────────── */}
      <View style={[sh.headGrid, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
        {/* Personal data */}
        <View style={isWide ? { flex: 1.55 } : {}}>
          <Box>
            <BoxTitle right={<Pressable onPress={onApplyProfile} style={({ pressed }) => [sh.applyBtn, pressed && { opacity: 0.85 }]}><Text style={sh.applyTxt}>⤓ Perfil</Text></Pressable>}>
              {s.personalData}
            </BoxTitle>
            <KV label={s.name} value={perfil.nome} onChangeText={(v) => onPerfil({ nome: v })} />
            <KV label={s.role} value={perfil.funcao} onChangeText={(v) => onPerfil({ funcao: v })} />
            <KV label={s.phone} value={perfil.telefone} onChangeText={(v) => onPerfil({ telefone: v })} keyboardType="phone-pad" />
            <KV label={s.email} value={perfil.email} onChangeText={(v) => onPerfil({ email: v })} />
            <KV label={s.nif} value={perfil.nif ?? ""} onChangeText={(v) => onPerfil({ nif: v })} />
            <KV label={s.iban} value={perfil.iban ?? ""} onChangeText={(v) => onPerfil({ iban: v })} />
            <KV label={s.swift} value={perfil.swift ?? ""} onChangeText={(v) => onPerfil({ swift: v })} />
            <KV label={s.companyLabel} value={perfil.empresa ?? ""} onChangeText={(v) => onPerfil({ empresa: v })} last />
          </Box>
        </View>

        {/* Producer + totals */}
        <View style={isWide ? { flex: 1, gap: 10 } : { gap: 10, marginTop: 10 }}>
          <Box>
            <BoxTitle>{s.productionSection}</BoxTitle>
            <KV label={s.film} value={projeto.filme} onChangeText={(v) => onProjeto({ filme: v })} />
            <KV label={s.productionLabel} value={projeto.produtora} onChangeText={(v) => onProjeto({ produtora: v })} />
            <KV label={s.productionNif} value={projeto.nifProdutora ?? ""} onChangeText={(v) => onProjeto({ nifProdutora: v })} last />
          </Box>
          <Box>
            <KVCalc label={s.totalDays} value={String(totalDias)} />
            <KVCalc label={s.issuedOn} value={emitidoA} />
            <KVCalc label={s.month} value={mesNome} />
            <KVCalc label={s.year} value={String(projeto.ano)} />
            <KVCalc label={s.vb} value={money(totais.ValorBruto)} />
            <KVCalc label={s.irs} value={money(totais.IRS_valor)} />
            <KVCalc label={s.iva} value={money(totais.IVA_valor)} />
            <KVCalc label={s.vf} value={money(totais.ValorFinal)} />
            <KVCalc label="" value={`${mesNome} ${projeto.ano}`} mini />
          </Box>
        </View>
      </View>

      {/* ── Rates row (editable salary + allowances) ─── */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 10 }}>
        <View style={{ minWidth: isWide ? 0 : 720, flexGrow: 1 }}>
          <View style={sh.ratesHead}>
            <HCell w={rateW()} label={s.salary} />
            <HCell w={rateW()} label={s.overtimeA} />
            <HCell w={rateW()} label={s.overtimeB} />
            <HCell w={rateW()} label={s.recoveryHours} bg={C.blue} />
            <HCell w={rateW()} label={s.meal} />
            <HCell w={rateW()} label={s.telephone} />
            <HCell w={rateW()} label={s.vehicle} bg={C.olive} />
            <HCell w={rateW()} label={s.material} bg={C.purple} />
            <HCell w={rateW()} label={s.perDiem} />
          </View>
          <View style={sh.ratesRow}>
            <TD w={rateW()}><CellMoney value={salarioDia} onChange={(n) => onTabela({ salarioDia: n })} /></TD>
            <TD w={rateW()} calc><CalcTxt align="right">{money(vHEA)} <Text style={sh.unit}>{perHour}</Text></CalcTxt></TD>
            <TD w={rateW()} calc><CalcTxt align="right">{money(vHEB)} <Text style={sh.unit}>{perHour}</Text></CalcTxt></TD>
            <TD w={rateW()} calc><CalcTxt align="right">{money(vHR)} <Text style={sh.unit}>{perHour}</Text></CalcTxt></TD>
            <TD w={rateW()}><CellMoney value={Number(aj.refeicao ?? 0)} onChange={(n) => setAj({ refeicao: n })} /></TD>
            <TD w={rateW()}><CellMoney value={Number(aj.telefone ?? 0)} onChange={(n) => setAj({ telefone: n })} /></TD>
            <TD w={rateW()}><CellMoney value={Number(aj.viatura ?? 0)} onChange={(n) => setAj({ viatura: n })} /></TD>
            <TD w={rateW()}><CellMoney value={Number(aj.material ?? 0)} onChange={(n) => setAj({ material: n })} /></TD>
            <TD w={rateW()}><CellMoney value={Number(aj.perDiem ?? 0)} onChange={(n) => setAj({ perDiem: n })} /></TD>
          </View>
        </View>
      </ScrollView>

      {/* ── Day table ─────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 10 }}>
        <View style={{ width: DAY_TABLE_W }}>
          {/* header row 1 (groups) */}
          <View style={{ flexDirection: "row" }}>
            <HCell w={W.desc} label={s.day} />
            <HCell w={W.data} label={s.date} />
            <HCell w={W.sal} label={s.salary} />
            <HCell w={W.ini + W.ref + W.fim + W.jan + W.tra} label={s.schedule} />
            <HCell w={W.ht + W.hd} label={s.totalHours} />
            <HCell w={W.aRef} label={s.meal} />
            <HCell w={W.aPer} label={s.perDiem} />
            <HCell w={W.aTel} label={s.telephone} />
            <HCell w={W.aViat} label={s.vehicle} bg={C.olive} />
            <HCell w={W.aMat} label={s.material} bg={C.purple} />
            <HCell w={W.heaT + W.heaV} label={s.overtimeAFull} />
            <HCell w={W.hebT + W.hebV} label={s.overtimeBFull} />
            <HCell w={W.hrT + W.hrV} label={s.recoveryFull} bg={C.blue} />
            <HCell w={W.tot} label={s.total} bg={C.gold} />
            <HCell w={W.act} label="" />
          </View>
          {/* header row 2 (subheads) */}
          <View style={{ flexDirection: "row" }}>
            <HCell w={W.desc} label={s.description} bg={C.subGrey} color={C.text} small />
            <HCell w={W.data} label="" bg={C.subGrey} color={C.text} small />
            <HCell w={W.sal} label={s.day} bg={C.subGrey} color={C.text} small />
            <HCell w={W.ini} label={s.start} bg={C.subGrey} color={C.text} small />
            <HCell w={W.ref} label={s.mealBreak} bg={C.subGrey} color={C.text} small />
            <HCell w={W.fim} label={s.end} bg={C.subGrey} color={C.text} small />
            <HCell w={W.jan} label={dinnerLabel} bg={C.subGrey} color={C.text} small />
            <HCell w={W.tra} label={transpLabel} bg={C.subGrey} color={C.text} small />
            <HCell w={W.ht} label={s.workHours} bg={C.subGrey} color={C.text} small />
            <HCell w={W.hd} label={s.restHours} bg={C.subBlue} color={C.blueTxt} small />
            <HCell w={W.aRef} label={s.perDay} bg={C.subGrey} color={C.text} small />
            <HCell w={W.aPer} label={s.perDay} bg={C.subGrey} color={C.text} small />
            <HCell w={W.aTel} label={s.perDay} bg={C.subGrey} color={C.text} small />
            <HCell w={W.aViat} label={s.perDay} bg={C.subOlive} color={C.text} small />
            <HCell w={W.aMat} label={s.perDay} bg={C.subPurple} color={C.text} small />
            <HCell w={W.heaT} label={s.total} bg={C.subGrey} color={C.text} small />
            <HCell w={W.heaV} label={s.value} bg={C.subGrey} color={C.text} small />
            <HCell w={W.hebT} label={s.total} bg={C.subGrey} color={C.text} small />
            <HCell w={W.hebV} label={s.value} bg={C.subGrey} color={C.text} small />
            <HCell w={W.hrT} label={s.total} bg={C.subBlue} color={C.blueTxt} small />
            <HCell w={W.hrV} label={s.value} bg={C.subBlue} color={C.blueTxt} small />
            <HCell w={W.tot} label={s.day} bg={C.subGold} color={C.text} small />
            <HCell w={W.act} label="" bg={C.subGrey} color={C.text} small />
          </View>
          {/* body rows */}
          {dias.map((d, i) => {
            const c = calculos[i];
            return (
              <View key={i} style={{ flexDirection: "row" }}>
                <TD w={W.desc}><CellText value={d.descricao || ""} onChangeText={(v) => onDia(i, { descricao: v })} align="left" /></TD>
                <TD w={W.data}><CellDate value={d.data} lang={locale} onChangeText={(v) => onDia(i, { data: v })} /></TD>
                <TD w={W.sal} calc><CalcTxt align="right">{money(salarioDia)}</CalcTxt></TD>
                <TD w={W.ini}><CellTime value={d.inicio} onChangeText={(v) => onDia(i, { inicio: v })} /></TD>
                <TD w={W.ref}><CellTime value={d.refeicaoTrabalho} onChangeText={(v) => onDia(i, { refeicaoTrabalho: v })} /></TD>
                <TD w={W.fim}><CellTime value={d.fim} onChangeText={(v) => onDia(i, { fim: v })} /></TD>
                <TD w={W.jan}><CellTime value={d.jantarTrabalho} onChangeText={(v) => onDia(i, { jantarTrabalho: v })} /></TD>
                <TD w={W.tra}><CellNum value={d.tempoTransporteMin ?? 0} onChange={(n) => onDia(i, { tempoTransporteMin: Math.max(0, Math.round(n)) })} /></TD>
                <TD w={W.ht} calc><CalcTxt>{minutesToHM(c?.HT_min ?? 0)}</CalcTxt></TD>
                <TD w={W.hd} calc><CalcTxt blue>{minutesToHM(c?.HD_min ?? 0)}</CalcTxt></TD>
                <TD w={W.aRef} calc><CalcTxt align="right">{money(Number(aj.refeicao ?? 0))}</CalcTxt></TD>
                <TD w={W.aPer} calc><CalcTxt align="right">{money(Number(aj.perDiem ?? 0))}</CalcTxt></TD>
                <TD w={W.aTel} calc><CalcTxt align="right">{money(Number(aj.telefone ?? 0))}</CalcTxt></TD>
                <TD w={W.aViat} calc><CalcTxt align="right">{money(Number(aj.viatura ?? 0))}</CalcTxt></TD>
                <TD w={W.aMat} calc><CalcTxt align="right">{money(Number(aj.material ?? 0))}</CalcTxt></TD>
                <TD w={W.heaT} calc><CalcTxt align="right">{((c?.HEA_min ?? 0) / 60).toFixed(1).replace(".", ",")}</CalcTxt></TD>
                <TD w={W.heaV} calc><CalcTxt align="right">{money(c?.HEA_valor ?? 0)}</CalcTxt></TD>
                <TD w={W.hebT} calc><CalcTxt align="right">{((c?.HEB_min ?? 0) / 60).toFixed(1).replace(".", ",")}</CalcTxt></TD>
                <TD w={W.hebV} calc><CalcTxt align="right">{money(c?.HEB_valor ?? 0)}</CalcTxt></TD>
                <TD w={W.hrT} calc><CalcTxt align="right">{((c?.HR_min ?? 0) / 60).toFixed(1).replace(".", ",")}</CalcTxt></TD>
                <TD w={W.hrV} calc><CalcTxt align="right">{money(c?.HR_valor ?? 0)}</CalcTxt></TD>
                <TD w={W.tot} calc tint={C.subGold}><CalcTxt align="right" strong>{money(c?.totalDia ?? 0)}</CalcTxt></TD>
                <TD w={W.act}>
                  <View style={sh.actRow}>
                    <Pressable onPress={() => onDuplicateDia(i)} hitSlop={6} style={sh.iconBtn}><Text style={sh.iconTxt}>⧉</Text></Pressable>
                    {i > 0 && <Pressable onPress={() => onRemoveDia(i)} hitSlop={6} style={sh.iconBtn}><Text style={[sh.iconTxt, { color: C.danger }]}>✕</Text></Pressable>}
                  </View>
                </TD>
              </View>
            );
          })}
          {/* add-day footer row */}
          <Pressable onPress={onAddDia} style={({ pressed }) => [sh.addRow, pressed && { opacity: 0.85 }]}>
            <Text style={sh.addTxt}>+ {s.day}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Notes + totals ────────────────────────── */}
      <View style={[sh.bottomGrid, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
        <View style={isWide ? { flex: 2.2 } : {}}>
          <Box>
            <BoxTitle>{s.notes}</BoxTitle>
            <TextInput
              style={sh.notesInput}
              value={notas}
              onChangeText={onNotas}
              multiline
              placeholder="…"
              placeholderTextColor={C.sub}
            />
            {taxDisclaimer ? <Text style={sh.disclaimer}>{taxDisclaimer}</Text> : null}
          </Box>
        </View>
        <View style={isWide ? { flex: 1 } : { marginTop: 10 }}>
          <Box>
            <KVCalc label={s.gross} value={money(totais.ValorBruto)} />
            <KVCalc label={s.irs} value={money(totais.IRS_valor)} />
            <KVCalc label={s.iva} value={money(totais.IVA_valor)} />
            <KVCalc label={s.net} value={money(totais.ValorFinal)} />
          </Box>
        </View>
      </View>

      {/* ── Conditions ────────────────────────────── */}
      <View style={{ marginTop: 10 }}>
        <Box>
          <BoxTitle>{s.workConditions}</BoxTitle>
          <TextInput
            style={sh.notesInput}
            value={condicoes}
            onChangeText={onCondicoes}
            multiline
            placeholder="…"
            placeholderTextColor={C.sub}
          />
        </Box>
      </View>
    </View>
  );
}

function rateW() { return 150; }

/* ---------------- Styles ---------------- */
const sh = StyleSheet.create({
  titleBar: {
    borderWidth: 2, borderColor: C.ink, backgroundColor: C.red,
    paddingVertical: 10, alignItems: "center",
  },
  titleTxt: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
  subTitleTxt: { color: "#fff", fontWeight: "600", fontSize: 11, marginTop: 2 },

  headGrid: { marginTop: 10, gap: 10, alignItems: "stretch" },

  box: { borderWidth: 2, borderColor: C.ink, backgroundColor: "#fff" },
  boxTitleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: 2, borderColor: C.ink, backgroundColor: C.boxTitleBg,
  },
  boxTitle: { paddingVertical: 6, paddingHorizontal: 8, fontWeight: "800", fontSize: 12, color: C.text },
  applyBtn: { marginRight: 6, borderWidth: 1, borderColor: C.ink, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: "#fff" },
  applyTxt: { fontSize: 11, fontWeight: "800", color: C.text },

  kvRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: C.ink, minHeight: 30, alignItems: "stretch" },
  kCell: { justifyContent: "center", paddingHorizontal: 8, borderRightWidth: 1, borderColor: C.ink },
  kTxt: { fontSize: 11, fontWeight: "700", color: C.text },
  vCell: { flex: 1, justifyContent: "center" },
  vInput: { paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, color: C.text },
  kCellHalf: { flex: 1, justifyContent: "center", paddingHorizontal: 8, borderRightWidth: 1, borderColor: C.ink, paddingVertical: 6 },
  kGreen: { fontSize: 12, fontWeight: "700", color: C.green },
  vCellHalf: { flex: 1, justifyContent: "center", paddingHorizontal: 8, paddingVertical: 6 },
  vCalc: { fontSize: 12, fontWeight: "700", color: C.text, textAlign: "right" },

  /* rates */
  ratesHead: { flexDirection: "row" },
  ratesRow: { flexDirection: "row" },

  /* generic table header cell */
  hCell: {
    borderWidth: 1, borderColor: C.ink, alignItems: "center", justifyContent: "center",
    paddingVertical: 5, paddingHorizontal: 2, minHeight: 30,
  },
  hTxt: { fontSize: 10, fontWeight: "800", textAlign: "center" },
  hTxtSmall: { fontSize: 9, fontWeight: "700" },

  /* body cell */
  td: {
    borderWidth: 1, borderColor: C.ink, backgroundColor: "#fff",
    justifyContent: "center", minHeight: 34,
  },
  tdCalc: { backgroundColor: C.calcBg },
  calcTxt: { fontSize: 11, color: C.text, paddingHorizontal: 4 },
  calcStrong: { fontWeight: "900" },
  unit: { fontSize: 9, color: C.sub },

  cellInput: { paddingHorizontal: 4, paddingVertical: 6, fontSize: 11, color: C.text },
  cellInputBad: { backgroundColor: "#FFF0F0", color: C.danger, fontWeight: "700" },
  cellDate: { paddingHorizontal: 4, paddingVertical: 8, justifyContent: "center" },
  cellDateTxt: { fontSize: 11, color: C.text, textAlign: "center" },

  actRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  iconBtn: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: C.ink, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  iconTxt: { fontSize: 11, fontWeight: "900", color: C.text },

  addRow: {
    borderWidth: 1, borderColor: C.ink, borderTopWidth: 0,
    paddingVertical: 9, alignItems: "center", backgroundColor: C.boxTitleBg,
  },
  addTxt: { fontSize: 12, fontWeight: "900", color: C.text },

  bottomGrid: { marginTop: 10, gap: 10, alignItems: "stretch" },
  notesInput: { padding: 10, fontSize: 12, color: C.text, minHeight: 64, textAlignVertical: "top" },
  disclaimer: { paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, color: "#888", borderTopWidth: 1, borderColor: "#ddd" },
});

const cal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 20 },
  card: { width: "100%", maxWidth: 340, backgroundColor: "#fff", borderRadius: 16, padding: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  nav: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#f2f3f5" },
  navTxt: { fontSize: 20, fontWeight: "900", color: C.text },
  title: { fontSize: 15, fontWeight: "900", color: C.text },
  weekRow: { flexDirection: "row", marginBottom: 6 },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "800", color: C.sub, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 2 },
  cellDay: { borderRadius: 10 },
  cellSel: { backgroundColor: C.text, borderRadius: 10 },
  cellToday: { borderWidth: 1.5, borderColor: C.text, borderRadius: 10 },
  cellTxt: { fontSize: 14, fontWeight: "700", color: C.text },
  cellTxtSel: { color: "#fff", fontWeight: "900" },
});
