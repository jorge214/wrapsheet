// src/ui/EditableSheet.tsx
// WYSIWYG editor: the editing surface IS the payslip sheet (same layout/colors
// as the exported PDF). White cells = editable; grey/green cells = computed.
// The whole sheet is ONE fixed-width document so zoom scales it uniformly.
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { minutesToHM, round2 } from "../calc/engine";
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

/* ---------------- Day-table column widths ---------------- */
const W = {
  desc: 130, data: 104, sal: 78,
  ini: 60, ref: 60, fim: 60, tra: 64,
  ht: 78, hd: 78,
  aRef: 64, aPer: 64, aTel: 64, aViat: 64, aMat: 64,
  heaT: 46, heaV: 60, hebT: 46, hebV: 60, hrT: 46, hrV: 60,
  tot: 86,
};
export const SHEET_W =
  W.desc + W.data + W.sal + W.ini + W.ref + W.fim + W.tra + W.ht + W.hd +
  W.aRef + W.aPer + W.aTel + W.aViat + W.aMat + W.heaT + W.heaV + W.hebT + W.hebV + W.hrT + W.hrV + W.tot;

/* row heights (fixed → keeps every column aligned) */
const H_HEAD1 = 32;
const H_HEAD2 = 30;
const H_ROW = 40;

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
  return parseTimeToMinutes(normalizeTimeSep(v)) !== null;
}
// Normaliza qualquer separador (";", ".", "h", " ") para ":" — evita "00;00"
function normalizeTimeSep(v: string) {
  return (v ?? "").replace(/[.;,hH\s]/g, ":");
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
/**
 * Input de texto com estado local + tracking de foco. Mantém o cursor
 * estável enquanto se escreve (o valor externo só re-sincroniza quando o
 * campo NÃO está focado). Resolve o bug do título/células onde não dava
 * para apagar e o cursor saltava.
 */
function LocalTextInput({
  value, onChangeText, style, ...rest
}: { value: string; onChangeText: (v: string) => void; style?: any } & Record<string, any>) {
  const [text, setText] = useState(value ?? "");
  const focused = React.useRef(false);
  useEffect(() => {
    if (!focused.current && (value ?? "") !== text) setText(value ?? "");
  }, [value]);
  return (
    <TextInput
      placeholderTextColor={C.sub}
      {...rest}
      style={style}
      value={text}
      onFocus={(e) => { focused.current = true; rest.onFocus?.(e); }}
      onBlur={(e) => { focused.current = false; setText(value ?? ""); rest.onBlur?.(e); }}
      onChangeText={(v) => { setText(v); onChangeText(v); }}
    />
  );
}
function CellText({ value, onChangeText, align = "left" }: { value: string; onChangeText: (v: string) => void; align?: "left" | "right" | "center" }) {
  return <LocalTextInput style={[sh.cellInput, { textAlign: align }]} value={value} onChangeText={onChangeText} />;
}
function CellTime({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  const [text, setText] = useState(normalizeTimeSep(value ?? ""));
  const focused = React.useRef(false);
  useEffect(() => { if (!focused.current) setText(normalizeTimeSep(value ?? "")); }, [value]);
  const bad = text.trim().length > 0 && !isValidTime(text);

  // Web: seletor de hora nativo — dá para editar dígito a dígito
  if (Platform.OS === "web") {
    const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
    const tv = m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
    return (
      // @ts-ignore — input nativo é web-only
      <input
        type="time"
        value={tv}
        onChange={(e: any) => onChangeText(e.target.value)}
        style={{ width: "100%", border: "none", background: "transparent", textAlign: "center", fontSize: 11, color: C.text, fontFamily: "inherit", padding: "5px 2px" } as any}
      />
    );
  }

  // Nativo: edição livre, formata só ao sair do campo
  return (
    <TextInput
      style={[sh.cellInput, { textAlign: "center" }, bad && sh.cellInputBad]}
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; const m2 = maskTime(normalizeTimeSep(text)); setText(m2); onChangeText(m2); }}
      onChangeText={(v) => setText(v)}
      keyboardType="numbers-and-punctuation"
      placeholder="00:00"
      placeholderTextColor={C.sub}
      maxLength={5}
    />
  );
}
function CellNum({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value ?? 0));
  const focused = React.useRef(false);
  useEffect(() => { if (!focused.current && Number(text) !== Number(value)) setText(String(value ?? 0)); }, [value]);
  return (
    <TextInput
      style={[sh.cellInput, { textAlign: "center" }]}
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(String(Number(text) || 0)); }}
      onChangeText={(v) => { setText(v); onChange(Number(v) || 0); }}
      keyboardType="numeric"
      placeholderTextColor={C.sub}
    />
  );
}
function CellMoney({ value, onChange, align = "right", placeholder }: { value: number; onChange: (n: number) => void; align?: "left" | "right" | "center"; placeholder?: string }) {
  const [text, setText] = useState(String(value ?? 0));
  const focused = React.useRef(false);
  useEffect(() => {
    if (!focused.current && Number(text.replace(",", ".")) !== Number(value)) setText(String(value ?? 0));
  }, [value]);
  return (
    <TextInput
      style={[sh.cellInput, { textAlign: align }]}
      value={text}
      onFocus={() => { focused.current = true; }}
      // Ao sair do campo, um valor vazio volta a 0 (não fica em branco)
      onBlur={() => { focused.current = false; setText(String(Number(text.replace(",", ".")) || 0)); }}
      onChangeText={(v) => { setText(v); onChange(Number(v.replace(",", ".")) || 0); }}
      keyboardType="numeric"
      placeholder={placeholder}
      placeholderTextColor={C.sub}
    />
  );
}
/** Salário global (linha de taxas). Semeia as taxas €/h ao sair do campo. */
function SalaryRateCell({ value, onChange, onCommit }: { value: number; onChange: (n: number) => void; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value ?? 0));
  const focused = React.useRef(false);
  useEffect(() => {
    if (!focused.current && Number(text.replace(",", ".")) !== Number(value)) setText(String(value ?? 0));
  }, [value]);
  return (
    <View style={sh.rateCell}>
      <TextInput
        style={[sh.cellInput, { textAlign: "center" }]}
        value={text}
        onFocus={() => { focused.current = true; }}
        onBlur={() => {
          focused.current = false;
          const n = Number(text.replace(",", ".")) || 0;
          setText(String(n));
          onCommit(n);
        }}
        onChangeText={(v) => { setText(v); onChange(Number(v.replace(",", ".")) || 0); }}
        keyboardType="numeric"
        placeholderTextColor={C.sub}
      />
    </View>
  );
}
/** Salário por dia: mostra o salário efetivo (override do dia ou global).
 *  Editar cria um override só desse dia; apagar volta a herdar o global. */
function DaySalaryCell({ override, effective, onChange }: { override?: number; effective: number; onChange: (n: number | undefined) => void }) {
  const [text, setText] = useState(String(override ?? effective ?? 0));
  const focused = React.useRef(false);
  useEffect(() => { if (!focused.current) setText(String(override ?? effective ?? 0)); }, [override, effective]);
  return (
    <TextInput
      style={[sh.cellInput, { textAlign: "right" }]}
      value={text}
      placeholderTextColor={C.sub}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(String(override ?? effective ?? 0)); }}
      onChangeText={(v) => {
        setText(v);
        if (v.trim() === "") onChange(undefined);
        else onChange(Number(v.replace(",", ".")) || 0);
      }}
      keyboardType="numeric"
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

/* ---------------- Header-box helpers ---------------- */
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
function KV({ label, value, onChangeText, keyboardType, last }: {
  label: string; value: string; onChangeText: (v: string) => void; keyboardType?: any; last?: boolean;
}) {
  return (
    <View style={[sh.kvRow, last && { borderBottomWidth: 0 }]}>
      <View style={sh.kCell}><Text style={sh.kTxt}>{label}</Text></View>
      <View style={sh.vCell}>
        <LocalTextInput style={sh.vInput} value={value} onChangeText={onChangeText} keyboardType={keyboardType} />
      </View>
    </View>
  );
}
function KVCalc({ label, value, mini }: { label: string; value: string; mini?: boolean }) {
  return (
    <View style={sh.kvRow}>
      <View style={sh.kCellHalf}><Text style={[sh.kGreen, mini && { color: C.sub, fontWeight: "600" }]}>{label}</Text></View>
      <View style={sh.vCellHalf}><Text style={[sh.vCalc, mini && { fontWeight: "600", color: C.sub }]}>{value}</Text></View>
    </View>
  );
}

/* ---------------- Day-table cell helpers ---------------- */
function HCell({ w, h, label, bg = C.th, color = "#fff", small }: { w: number; h: number; label: string; bg?: string; color?: string; small?: boolean }) {
  return (
    <View style={[sh.hCell, { width: w, height: h, backgroundColor: bg }]}>
      <Text style={[sh.hTxt, { color }, small && sh.hTxtSmall]} numberOfLines={2}>{label}</Text>
    </View>
  );
}
function TD({ w, children, calc, tint }: { w: number; children: React.ReactNode; calc?: boolean; tint?: string }) {
  return <View style={[sh.td, { width: w, height: H_ROW }, calc && sh.tdCalc, tint ? { backgroundColor: tint } : null]}>{children}</View>;
}
function CalcTxt({ children, align = "center", strong, blue }: { children: React.ReactNode; align?: "left" | "right" | "center"; strong?: boolean; blue?: boolean }) {
  return <Text style={[sh.calcTxt, { textAlign: align }, strong && sh.calcStrong, blue && { color: C.blueTxt, fontWeight: "800" }]} numberOfLines={1}>{children}</Text>;
}

/* ---------------- Props ---------------- */
type Perfil = { nome: string; email: string; telefone: string; departamento: string; funcao: string; empresa?: string; nif?: string; iban?: string; swift?: string };
type Projeto = { titulo?: string; filme: string; produtora: string; nifProdutora?: string; semana?: string; mes: number; ano: number };
type Ajudas = { refeicao?: number; viatura?: number; material?: number; telefone?: number; perDiem?: number };
type Tabela = { salarioDia?: number; H_dia: number; multHEA?: number; multHEB?: number; multHR?: number; rateHEA?: number; rateHEB?: number; rateHR?: number; ajudas?: Ajudas };

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
  applyLabel: string;
  addLabel: string;
  duplicateLabel: string;
  removeLabel: string;
  titlePlaceholder: string;
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
    locale, region, currency, taxDisclaimer, applyLabel, addLabel, duplicateLabel, removeLabel, titlePlaceholder,
    onPerfil, onProjeto, onTabela, onDia, onAddDia, onDuplicateDia, onRemoveDia, onNotas, onCondicoes, onApplyProfile,
  } = props;

  const s = getStrings(locale, region);
  const money = (n: number) => fmtMoney(Number(n) || 0, currency);
  const aj = tabela.ajudas ?? {};
  const setAj = (patch: Partial<Ajudas>) => onTabela({ ajudas: { ...aj, ...patch } });

  const salarioDia = Number(tabela.salarioDia || 0);
  const hDia = tabela.H_dia || 8;
  // Taxa efetiva: override editado na folha, senão salário/H × multiplicador
  const vHEA = tabela.rateHEA ?? (salarioDia ? (salarioDia / hDia) * Number(tabela.multHEA ?? 1.5) : 0);
  const vHEB = tabela.rateHEB ?? (salarioDia ? (salarioDia / hDia) * Number(tabela.multHEB ?? 2.0) : 0);
  const vHR = tabela.rateHR ?? (salarioDia ? (salarioDia / hDia) * Number(tabela.multHR ?? 3.0) : 0);

  const totalDias = dias.reduce((acc, d) => acc + (d.diaSemTrabalho ? 0 : d.meioDia ? 0.5 : 1), 0);
  const today = new Date();
  const emitidoA = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
  const mesNome = monthName(projeto.mes, locale);

  const transpLabel = "TRANSP.";

  // Rate cell: editable money value
  const RateEdit = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <View style={sh.rateCell}><CellMoney value={value} onChange={onChange} align="center" /></View>
  );
  return (
    <View style={{ width: SHEET_W }}>
      {/* ── Title bar (editable — título é independente do nome do filme) ── */}
      <View style={sh.titleBar}>
        <LocalTextInput
          style={sh.titleInput}
          value={projeto.titulo ?? ""}
          onChangeText={(v) => onProjeto({ titulo: v })}
          placeholder={titlePlaceholder}
          placeholderTextColor="rgba(255,255,255,0.85)"
        />
      </View>

      {/* ── Header grid ─────────────────────────────── */}
      <View style={sh.headGrid}>
        <View style={{ flex: 1.55 }}>
          <Box>
            <BoxTitle right={<Pressable onPress={onApplyProfile} style={({ pressed }) => [sh.applyBtn, pressed && { opacity: 0.85 }]}><Text style={sh.applyTxt}>{applyLabel} ⤓</Text></Pressable>}>
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
        <View style={{ flex: 1, gap: 10 }}>
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
      <View style={sh.ratesBlock}>
        <View style={{ flexDirection: "row" }}>
          <View style={[sh.rateHead]}><Text style={sh.hTxt}>{s.salary}</Text></View>
          <View style={[sh.rateHead]}><Text style={sh.hTxt}>{s.overtimeA}</Text></View>
          <View style={[sh.rateHead]}><Text style={sh.hTxt}>{s.overtimeB}</Text></View>
          <View style={[sh.rateHead, { backgroundColor: C.blue }]}><Text style={sh.hTxt}>{s.recoveryHours}</Text></View>
          <View style={[sh.rateHead]}><Text style={sh.hTxt}>{s.meal}</Text></View>
          <View style={[sh.rateHead]}><Text style={sh.hTxt}>{s.telephone}</Text></View>
          <View style={[sh.rateHead, { backgroundColor: C.olive }]}><Text style={sh.hTxt}>{s.vehicle}</Text></View>
          <View style={[sh.rateHead, { backgroundColor: C.purple }]}><Text style={sh.hTxt}>{s.material}</Text></View>
          <View style={[sh.rateHead]}><Text style={sh.hTxt}>{s.perDiem}</Text></View>
        </View>
        <View style={{ flexDirection: "row" }}>
          <SalaryRateCell
            value={salarioDia}
            onChange={(n) => onTabela({ salarioDia: n })}
            onCommit={(n) => {
              // Semeia as taxas €/h a partir do salário APENAS na 1.ª vez (se ainda
              // não existirem) e só ao SAIR do campo (evita usar dígitos parciais).
              // Depois disso, mudar o salário já não altera as taxas de HE.
              const patch: Partial<Tabela> = {};
              const base = n / hDia;
              if (tabela.rateHEA == null) patch.rateHEA = round2(base * Number(tabela.multHEA ?? 1.5));
              if (tabela.rateHEB == null) patch.rateHEB = round2(base * Number(tabela.multHEB ?? 2.0));
              if (tabela.rateHR == null) patch.rateHR = round2(base * Number(tabela.multHR ?? 3.0));
              if (Object.keys(patch).length) onTabela(patch);
            }}
          />
          <RateEdit value={vHEA} onChange={(n) => onTabela({ rateHEA: n })} />
          <RateEdit value={vHEB} onChange={(n) => onTabela({ rateHEB: n })} />
          <RateEdit value={vHR} onChange={(n) => onTabela({ rateHR: n })} />
          <RateEdit value={Number(aj.refeicao ?? 0)} onChange={(n) => setAj({ refeicao: n })} />
          <RateEdit value={Number(aj.telefone ?? 0)} onChange={(n) => setAj({ telefone: n })} />
          <RateEdit value={Number(aj.viatura ?? 0)} onChange={(n) => setAj({ viatura: n })} />
          <RateEdit value={Number(aj.material ?? 0)} onChange={(n) => setAj({ material: n })} />
          <RateEdit value={Number(aj.perDiem ?? 0)} onChange={(n) => setAj({ perDiem: n })} />
        </View>
      </View>

      {/* ── Day table ─────────────────────────────── */}
      <View style={{ marginTop: 10 }}>
        {/* header row 1 (groups) */}
        <View style={{ flexDirection: "row" }}>
          <HCell w={W.desc} h={H_HEAD1} label={s.day} />
          <HCell w={W.data} h={H_HEAD1} label={s.date} />
          <HCell w={W.sal} h={H_HEAD1} label={s.salary} />
          <HCell w={W.ini + W.ref + W.fim + W.tra} h={H_HEAD1} label={s.schedule} />
          <HCell w={W.ht + W.hd} h={H_HEAD1} label={s.totalHours} />
          <HCell w={W.aRef} h={H_HEAD1} label={s.meal} />
          <HCell w={W.aPer} h={H_HEAD1} label={s.perDiem} />
          <HCell w={W.aTel} h={H_HEAD1} label={s.telephone} />
          <HCell w={W.aViat} h={H_HEAD1} label={s.vehicle} bg={C.olive} />
          <HCell w={W.aMat} h={H_HEAD1} label={s.material} bg={C.purple} />
          <HCell w={W.heaT + W.heaV} h={H_HEAD1} label={s.overtimeAFull} />
          <HCell w={W.hebT + W.hebV} h={H_HEAD1} label={s.overtimeBFull} />
          <HCell w={W.hrT + W.hrV} h={H_HEAD1} label={s.recoveryFull} bg={C.blue} />
          <HCell w={W.tot} h={H_HEAD1} label={s.total} bg={C.gold} />
        </View>
        {/* header row 2 (subheads) */}
        <View style={{ flexDirection: "row" }}>
          <HCell w={W.desc} h={H_HEAD2} label={s.description} bg={C.subGrey} color={C.text} small />
          <HCell w={W.data} h={H_HEAD2} label="" bg={C.subGrey} color={C.text} small />
          <HCell w={W.sal} h={H_HEAD2} label={s.day} bg={C.subGrey} color={C.text} small />
          <HCell w={W.ini} h={H_HEAD2} label={s.start} bg={C.subGrey} color={C.text} small />
          <HCell w={W.ref} h={H_HEAD2} label={s.mealBreak} bg={C.subGrey} color={C.text} small />
          <HCell w={W.fim} h={H_HEAD2} label={s.end} bg={C.subGrey} color={C.text} small />
          <HCell w={W.tra} h={H_HEAD2} label={transpLabel} bg={C.subGrey} color={C.text} small />
          <HCell w={W.ht} h={H_HEAD2} label={s.workHours} bg={C.subGrey} color={C.text} small />
          <HCell w={W.hd} h={H_HEAD2} label={s.restHours} bg={C.subBlue} color={C.blueTxt} small />
          <HCell w={W.aRef} h={H_HEAD2} label={s.perDay} bg={C.subGrey} color={C.text} small />
          <HCell w={W.aPer} h={H_HEAD2} label={s.perDay} bg={C.subGrey} color={C.text} small />
          <HCell w={W.aTel} h={H_HEAD2} label={s.perDay} bg={C.subGrey} color={C.text} small />
          <HCell w={W.aViat} h={H_HEAD2} label={s.perDay} bg={C.subOlive} color={C.text} small />
          <HCell w={W.aMat} h={H_HEAD2} label={s.perDay} bg={C.subPurple} color={C.text} small />
          <HCell w={W.heaT} h={H_HEAD2} label={s.total} bg={C.subGrey} color={C.text} small />
          <HCell w={W.heaV} h={H_HEAD2} label={s.value} bg={C.subGrey} color={C.text} small />
          <HCell w={W.hebT} h={H_HEAD2} label={s.total} bg={C.subGrey} color={C.text} small />
          <HCell w={W.hebV} h={H_HEAD2} label={s.value} bg={C.subGrey} color={C.text} small />
          <HCell w={W.hrT} h={H_HEAD2} label={s.total} bg={C.subBlue} color={C.blueTxt} small />
          <HCell w={W.hrV} h={H_HEAD2} label={s.value} bg={C.subBlue} color={C.blueTxt} small />
          <HCell w={W.tot} h={H_HEAD2} label={s.day} bg={C.subGold} color={C.text} small />
        </View>
        {/* body rows */}
        {dias.map((d, i) => {
          const c = calculos[i];
          return (
            <View key={i} style={{ flexDirection: "row" }}>
              <TD w={W.desc}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View style={{ flex: 1 }}>
                    <CellText value={d.descricao || ""} onChangeText={(v) => onDia(i, { descricao: v })} align="left" />
                  </View>
                  {i > 0 && (
                    <Pressable onPress={() => onRemoveDia(i)} hitSlop={6} style={sh.delBtn}>
                      <Text style={sh.delTxt}>✕</Text>
                    </Pressable>
                  )}
                </View>
              </TD>
              <TD w={W.data}><CellDate value={d.data} lang={locale} onChangeText={(v) => onDia(i, { data: v })} /></TD>
              <TD w={W.sal}><DaySalaryCell override={d.salarioDia} effective={salarioDia} onChange={(n) => onDia(i, { salarioDia: n })} /></TD>
              <TD w={W.ini}><CellTime value={d.inicio} onChangeText={(v) => onDia(i, { inicio: v })} /></TD>
              <TD w={W.ref}><CellTime value={d.refeicaoTrabalho} onChangeText={(v) => onDia(i, { refeicaoTrabalho: v })} /></TD>
              <TD w={W.fim}><CellTime value={d.fim} onChangeText={(v) => onDia(i, { fim: v })} /></TD>
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
            </View>
          );
        })}
        {/* add / duplicate / delete footer */}
        <View style={{ flexDirection: "row" }}>
          <Pressable onPress={onAddDia} style={({ pressed }) => [sh.footBtn, pressed && { opacity: 0.85 }]}>
            <Text style={sh.addTxt}>+ {addLabel}</Text>
          </Pressable>
          <Pressable onPress={() => onDuplicateDia(Math.max(0, dias.length - 1))} style={({ pressed }) => [sh.footBtn, sh.footBtnRight, pressed && { opacity: 0.85 }]}>
            <Text style={sh.addTxt}>⧉ {duplicateLabel}</Text>
          </Pressable>
          <Pressable onPress={() => onRemoveDia(dias.length - 1)} style={({ pressed }) => [sh.footBtn, sh.footBtnRight, pressed && { opacity: 0.85 }]}>
            <Text style={[sh.addTxt, { color: C.danger }]}>✕ {removeLabel}</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Notes + totals ────────────────────────── */}
      <View style={sh.bottomGrid}>
        <View style={{ flex: 2.2 }}>
          <Box>
            <BoxTitle>{s.notes}</BoxTitle>
            <LocalTextInput style={sh.notesInput} value={notas} onChangeText={onNotas} multiline placeholder="…" />
            {taxDisclaimer ? <Text style={sh.disclaimer}>{taxDisclaimer}</Text> : null}
          </Box>
        </View>
        <View style={{ flex: 1 }}>
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
          <LocalTextInput style={sh.notesInput} value={condicoes} onChangeText={onCondicoes} multiline placeholder="…" />
        </Box>
      </View>
    </View>
  );
}

/* ---------------- Styles ---------------- */
const sh = StyleSheet.create({
  titleBar: { borderWidth: 2, borderColor: C.ink, backgroundColor: C.red, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  titleInput: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5, textAlign: "center", alignSelf: "stretch", paddingVertical: 0 },

  headGrid: { marginTop: 10, flexDirection: "row", gap: 10, alignItems: "flex-start" },

  box: { borderWidth: 2, borderColor: C.ink, backgroundColor: "#fff" },
  boxTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 2, borderColor: C.ink, backgroundColor: C.boxTitleBg },
  boxTitle: { paddingVertical: 6, paddingHorizontal: 8, fontWeight: "800", fontSize: 12, color: C.text },
  applyBtn: { marginRight: 6, borderWidth: 1, borderColor: C.ink, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: "#fff" },
  applyTxt: { fontSize: 11, fontWeight: "800", color: C.text },

  kvRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: C.ink, minHeight: 30, alignItems: "stretch" },
  kCell: { width: 120, justifyContent: "center", paddingHorizontal: 8, borderRightWidth: 1, borderColor: C.ink },
  kTxt: { fontSize: 11, fontWeight: "700", color: C.text },
  vCell: { flex: 1, justifyContent: "center" },
  vInput: { paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, color: C.text },
  kCellHalf: { flex: 1, justifyContent: "center", paddingHorizontal: 8, borderRightWidth: 1, borderColor: C.ink, paddingVertical: 6 },
  kGreen: { fontSize: 12, fontWeight: "700", color: C.green },
  vCellHalf: { flex: 1, justifyContent: "center", paddingHorizontal: 8, paddingVertical: 6 },
  vCalc: { fontSize: 12, fontWeight: "700", color: C.text, textAlign: "right" },

  ratesBlock: { marginTop: 10 },
  rateHead: { flex: 1, borderWidth: 1, borderColor: C.ink, alignItems: "center", justifyContent: "center", paddingVertical: 5, paddingHorizontal: 2, minHeight: 30, backgroundColor: C.th },
  rateCell: { flex: 1, borderWidth: 1, borderColor: C.ink, backgroundColor: "#fff", minHeight: 40, justifyContent: "center" },
  rateVal: { fontSize: 12, fontWeight: "700", color: C.text },
  rateUnit: { fontSize: 10, color: C.sub, marginTop: 1 },

  hCell: { borderWidth: 1, borderColor: C.ink, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  hTxt: { fontSize: 10, fontWeight: "800", textAlign: "center", color: "#fff" },
  hTxtSmall: { fontSize: 9, fontWeight: "700" },

  td: { borderWidth: 1, borderColor: C.ink, backgroundColor: "#fff", justifyContent: "center" },
  tdCalc: { backgroundColor: C.calcBg },
  calcTxt: { fontSize: 11, color: C.text, paddingHorizontal: 4 },
  calcStrong: { fontWeight: "900" },

  moneyRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  curSuffix: { fontSize: 10, fontWeight: "700", color: C.sub, paddingRight: 4, paddingLeft: 1 },
  cellInput: { paddingHorizontal: 4, paddingVertical: 6, fontSize: 11, color: C.text },
  cellInputBad: { backgroundColor: "#FFF0F0", color: C.danger, fontWeight: "700" },
  cellDate: { paddingHorizontal: 4, justifyContent: "center", flex: 1 },
  cellDateTxt: { fontSize: 11, color: C.text, textAlign: "center" },

  actRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  iconBtn: { width: 20, height: 22, borderRadius: 5, borderWidth: 1, borderColor: C.ink, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  iconTxt: { fontSize: 10, fontWeight: "900", color: C.text },

  addRow: { borderWidth: 1, borderColor: C.ink, borderTopWidth: 0, paddingVertical: 9, alignItems: "center", backgroundColor: C.boxTitleBg },
  addTxt: { fontSize: 12, fontWeight: "900", color: C.text },
  footBtn: { flex: 1, borderWidth: 1, borderColor: C.ink, borderTopWidth: 0, paddingVertical: 9, alignItems: "center", backgroundColor: C.boxTitleBg },
  footBtnRight: { borderLeftWidth: 0 },
  delBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  delTxt: { color: C.danger, fontWeight: "900", fontSize: 12 },

  bottomGrid: { marginTop: 10, flexDirection: "row", gap: 10, alignItems: "flex-start" },
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
