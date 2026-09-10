// src/export/buildCinemaHtml.ts
// Folha de CINEMA (semanal) — PDF e editor no MESMO construtor.
//
// A folha de publicidade (buildPdfHtml.ts) fica intacta; daqui só se importam
// os helpers que ela já tinha (formatação, campos editáveis, condições, script
// do editor). O que é próprio do cinema vive aqui:
//   • salário À SEMANA (a linha de valores mostra "SEMANA 5 DIAS") e a linha
//     "DIA DE FOLGA" com tudo a dobrar;
//   • linhas de FOLGA (sáb/dom) e feriados marcados a dobrar;
//   • barra do descanso entre semanas: total, "Para 60H", saldo e as horas de
//     recuperação cobradas;
//   • linha B: início da semana seguinte (data + hora), que fecha o cálculo;
//   • Segurança Social ao lado do IRS e do IVA.
// O editor usa o MESMO script e as mesmas classes (table.days, .ei, .rbtn…)
// da folha de publicidade — as máscaras de horas/datas, o iPad e o
// protocolo ws:* são um só código.
import { minutesToHM, ratesFor } from "../calc/engine";
import type { CalcDia, Dia } from "../calc/types";
import {
  applyFontScale, CE, conditionsHtml, currencySymbol, edDate, edDi, edMi, edNum, edTi, edTime,
  editorScript, escapeHtml, fmtMoney, fmtNum, formatDatePT, getMonthName, getStrings, safeStr,
  type PdfExtra, type PdfPerfil, type PdfProjeto, type PdfTabela, type PdfTotais,
} from "./buildPdfHtml";

// ── Rótulos próprios do cinema (o resto vem de getStrings) ───────────────────
const CINEMA_STRINGS = {
  pt: {
    title: "CINEMA", weekWord: "SEMANA", daysWord: "Dias", daysWordUp: "DIAS",
    sheetSubtitle: "Folha de Pagamentos Individual", department: "DEPARTAMENTO:", productionType: "TIPO:",
    productionTypePh: "Telefilme, série, documentário…", weekNr: "Semana n.º", dayOff: "DIA DE FOLGA",
    dayOffRow: "FOLGA", holiday: "FERIADO", restRowLabel: "FOLGA (HORAS DESCANSO)",
    restBetweenWeeks: "Horas de descanso entre uma semana e outra", target: "Para",
    recoveryBetweenWeeks: "Horas de recuperação entre uma semana e a semana seguinte",
    nextWeekStart: "Início da semana seguinte", ss: "SEG. SOCIAL", notChargeable: "sem hora de início → não se cobra",
    toggleDayOff: "Folga", toggleHoliday: "Feriado",
  },
  en: {
    title: "FILM", weekWord: "WEEK", daysWord: "Days", daysWordUp: "DAYS",
    sheetSubtitle: "Individual Timesheet", department: "DEPARTMENT:", productionType: "TYPE:",
    productionTypePh: "TV movie, series, documentary…", weekNr: "Week no.", dayOff: "DAY OFF",
    dayOffRow: "DAY OFF", holiday: "HOLIDAY", restRowLabel: "DAYS OFF (REST HOURS)",
    restBetweenWeeks: "Rest hours between one week and the next", target: "Target",
    recoveryBetweenWeeks: "Recovery hours between one week and the next",
    nextWeekStart: "Start of next week", ss: "SOCIAL SECURITY", notChargeable: "no start time → not charged",
    toggleDayOff: "Day off", toggleHoliday: "Holiday",
  },
  es: {
    title: "CINE", weekWord: "SEMANA", daysWord: "Días", daysWordUp: "DÍAS",
    sheetSubtitle: "Hoja de pagos individual", department: "DEPARTAMENTO:", productionType: "TIPO:",
    productionTypePh: "Telefilme, serie, documental…", weekNr: "Semana n.º", dayOff: "DÍA DE DESCANSO",
    dayOffRow: "DESCANSO", holiday: "FESTIVO", restRowLabel: "DESCANSO (HORAS DE DESCANSO)",
    restBetweenWeeks: "Horas de descanso entre una semana y la siguiente", target: "Para",
    recoveryBetweenWeeks: "Horas de recuperación entre una semana y la siguiente",
    nextWeekStart: "Inicio de la semana siguiente", ss: "SEG. SOCIAL", notChargeable: "sin hora de inicio → no se cobra",
    toggleDayOff: "Descanso", toggleHoliday: "Festivo",
  },
  fr: {
    title: "CINÉMA", weekWord: "SEMAINE", daysWord: "Jours", daysWordUp: "JOURS",
    sheetSubtitle: "Feuille de paie individuelle", department: "DÉPARTEMENT :", productionType: "TYPE :",
    productionTypePh: "Téléfilm, série, documentaire…", weekNr: "Semaine n°", dayOff: "JOUR DE REPOS",
    dayOffRow: "REPOS", holiday: "FÉRIÉ", restRowLabel: "REPOS (HEURES DE REPOS)",
    restBetweenWeeks: "Heures de repos entre une semaine et la suivante", target: "Objectif",
    recoveryBetweenWeeks: "Heures de récupération entre une semaine et la suivante",
    nextWeekStart: "Début de la semaine suivante", ss: "SÉCU. SOCIALE", notChargeable: "sans heure de début → non facturé",
    toggleDayOff: "Repos", toggleHoliday: "Férié",
  },
  de: {
    title: "FILM", weekWord: "WOCHE", daysWord: "Tage", daysWordUp: "TAGE",
    sheetSubtitle: "Individuelle Abrechnung", department: "ABTEILUNG:", productionType: "ART:",
    productionTypePh: "Fernsehfilm, Serie, Dokumentation…", weekNr: "Woche Nr.", dayOff: "FREIER TAG",
    dayOffRow: "FREI", holiday: "FEIERTAG", restRowLabel: "FREI (RUHEZEIT)",
    restBetweenWeeks: "Ruhezeit zwischen einer Woche und der nächsten", target: "Ziel",
    recoveryBetweenWeeks: "Erholungsstunden zwischen einer Woche und der nächsten",
    nextWeekStart: "Beginn der nächsten Woche", ss: "SOZIALVERS.", notChargeable: "ohne Startzeit → nicht berechnet",
    toggleDayOff: "Frei", toggleHoliday: "Feiertag",
  },
  it: {
    title: "CINEMA", weekWord: "SETTIMANA", daysWord: "Giorni", daysWordUp: "GIORNI",
    sheetSubtitle: "Foglio paga individuale", department: "REPARTO:", productionType: "TIPO:",
    productionTypePh: "Film TV, serie, documentario…", weekNr: "Settimana n.", dayOff: "GIORNO DI RIPOSO",
    dayOffRow: "RIPOSO", holiday: "FESTIVO", restRowLabel: "RIPOSO (ORE DI RIPOSO)",
    restBetweenWeeks: "Ore di riposo tra una settimana e la successiva", target: "Per",
    recoveryBetweenWeeks: "Ore di recupero tra una settimana e la successiva",
    nextWeekStart: "Inizio della settimana successiva", ss: "PREV. SOCIALE", notChargeable: "senza ora di inizio → non addebitato",
    toggleDayOff: "Riposo", toggleHoliday: "Festivo",
  },
  nl: {
    title: "FILM", weekWord: "WEEK", daysWord: "Dagen", daysWordUp: "DAGEN",
    sheetSubtitle: "Individuele urenstaat", department: "AFDELING:", productionType: "TYPE:",
    productionTypePh: "Tv-film, serie, documentaire…", weekNr: "Week nr.", dayOff: "VRIJE DAG",
    dayOffRow: "VRIJ", holiday: "FEESTDAG", restRowLabel: "VRIJ (RUSTUREN)",
    restBetweenWeeks: "Rusturen tussen de ene week en de volgende", target: "Doel",
    recoveryBetweenWeeks: "Hersteluren tussen de ene week en de volgende",
    nextWeekStart: "Start van de volgende week", ss: "SOC. ZEKERHEID", notChargeable: "geen starttijd → niet in rekening",
    toggleDayOff: "Vrij", toggleHoliday: "Feestdag",
  },
  pl: {
    title: "FILM", weekWord: "TYDZIEŃ", daysWord: "Dni", daysWordUp: "DNI",
    sheetSubtitle: "Indywidualna karta wynagrodzeń", department: "DZIAŁ:", productionType: "TYP:",
    productionTypePh: "Film TV, serial, dokument…", weekNr: "Tydzień nr", dayOff: "DZIEŃ WOLNY",
    dayOffRow: "WOLNE", holiday: "ŚWIĘTO", restRowLabel: "WOLNE (GODZINY ODPOCZYNKU)",
    restBetweenWeeks: "Godziny odpoczynku między tygodniami", target: "Cel",
    recoveryBetweenWeeks: "Godziny odpoczynku wyrównawczego między tygodniami",
    nextWeekStart: "Początek następnego tygodnia", ss: "UBEZP. SPOŁ.", notChargeable: "brak godziny rozpoczęcia → nie nalicza się",
    toggleDayOff: "Wolne", toggleHoliday: "Święto",
  },
};

function pickCinemaStrings(locale: string, region?: string) {
  const lang = (locale || "pt").toLowerCase();
  const byLang = (Object.keys(CINEMA_STRINGS) as (keyof typeof CINEMA_STRINGS)[]).find((k) => lang.startsWith(k));
  if (byLang) return CINEMA_STRINGS[byLang];
  const r = (region ?? "").toLowerCase();
  if (r === "uk" || r === "se" || r === "no" || r === "fi" || r === "cz" || r === "hu") return CINEMA_STRINGS.en;
  if (r === "de" || r === "at" || r === "ch") return CINEMA_STRINGS.de;
  if (r === "fr" || r === "be") return CINEMA_STRINGS.fr;
  if (r === "es") return CINEMA_STRINGS.es;
  if (r === "nl") return CINEMA_STRINGS.nl;
  if (r === "pl") return CINEMA_STRINGS.pl;
  return CINEMA_STRINGS.pt;
}

/** Rótulos completos da folha de cinema: os gerais (getStrings) + os próprios. */
export function getCinemaStrings(locale: string, region?: string) {
  return { ...getStrings(locale, region), ...pickCinemaStrings(locale, region) };
}

type CStrings = ReturnType<typeof getCinemaStrings>;

// ── Linhas da tabela de dias ─────────────────────────────────────────────────
// Mesmas colunas da publicidade menos os PER DIEMS (20 colunas). As linhas de
// FOLGA saem a vermelho; um feriado leva a marca ★. No editor cada linha tem
// os botões duplicar/remover (⧉ ✕) e dois interruptores: Folga e Feriado.
function dayRowHtml(
  d: Dia, i: number, c: CalcDia | undefined, s: CStrings, fmt: (n: number) => string,
  salarioDiaBase: number, editable: boolean
): string {
  const descanso = !!c?.descanso;
  const cls = [d.folga ? "folgaRow" : "", d.feriado ? "feriadoRow" : "", descanso ? "restRow" : ""].filter(Boolean).join(" ");
  const eff = (d as any).salarioDia ?? (descanso ? 0 : c?.salarioDia ?? salarioDiaBase);
  const star = d.feriado ? `<span class="fer" title="${escapeHtml(s.holiday)}">★</span>` : "";
  const hd = escapeHtml(minutesToHM(c?.HD_min ?? 0));
  const ht = escapeHtml(minutesToHM(c?.HT_min ?? 0));

  if (!editable) {
    return `
        <tr class="${cls}">
          <td class="left">${star}${escapeHtml(d.descricao || (d.folga ? s.dayOffRow : ""))}</td>
          <td class="cData">${escapeHtml(formatDatePT(d.data))}</td>
          <td class="right cSal">${fmt(eff)}</td>
          <td class="cCont">${escapeHtml((d as any).cont || "")}</td>
          <td class="cIni">${escapeHtml(d.inicio || "")}</td>
          <td>${escapeHtml(d.refeicaoTrabalho || "")}</td>
          <td class="cFim">${escapeHtml(d.fim || "")}</td>
          <td>${ht}</td>
          <td class="blue">${hd}</td>
          <td class="right cPd">${fmt(c?.ajRef ?? 0)}</td>
          <td class="right cPd">${fmt(c?.ajViat ?? 0)}</td>
          <td class="right cPd">${fmt(c?.ajMat ?? 0)}</td>
          <td class="right cPd">${fmt(c?.ajTel ?? 0)}</td>
          <td class="right">${fmtNum((c?.HEA_min ?? 0) / 60, 1)}</td>
          <td class="right cOtv">${fmt(c?.HEA_valor ?? 0)}</td>
          <td class="right">${fmtNum((c?.HEB_min ?? 0) / 60, 1)}</td>
          <td class="right cOtv">${fmt(c?.HEB_valor ?? 0)}</td>
          <td class="right">${fmtNum((c?.HR_min ?? 0) / 60, 1)}</td>
          <td class="right cOtv">${fmt(c?.HR_valor ?? 0)}</td>
          <td class="right strong tday cTot">${fmt(c?.totalDia ?? 0)}</td>
        </tr>`;
  }

  const tog = (act: "folga" | "feriado", on: boolean, label: string) =>
    `<span class="rtog${on ? " on" : ""}" data-act="${act}" data-i="${i}">${escapeHtml(label)}</span>`;
  return `
        <tr class="${cls}">
          <td class="left">${star}${edDi(i, "descricao", d.descricao || "", "left")}<span class="rowBtns"><span class="rbtn" data-act="dup" data-i="${i}">⧉</span><span class="rbtn rdel" data-act="del" data-i="${i}">✕</span></span><span class="rowTogs">${tog("folga", !!d.folga, s.toggleDayOff)}${tog("feriado", !!d.feriado, s.toggleHoliday)}</span></td>
          <td class="dateCell">${edDate(i, formatDatePT(d.data))}</td>
          <td>${edNum(i, "salarioDia", "sal", fmt(eff))}</td>
          <td class="contCell">${edDi(i, "cont", (d as any).cont || "", "cmark")}</td>
          <td class="timeCell">${edTime(i, "inicio", d.inicio || "")}</td>
          <td class="timeCell">${edTime(i, "refeicaoTrabalho", d.refeicaoTrabalho || "")}</td>
          <td class="timeCell">${edTime(i, "fim", d.fim || "")}</td>
          <td class="calc" data-c="ht" data-i="${i}">${ht}</td>
          <td class="blue calc" data-c="hd" data-i="${i}">${hd}</td>
          <td class="mealDay">${edNum(i, "ajRefeicao", "d_ref", fmt(c?.ajRef ?? 0))}</td>
          <td>${edNum(i, "ajViatura", "d_viat", fmt(c?.ajViat ?? 0))}</td>
          <td>${edNum(i, "ajMaterial", "d_mat", fmt(c?.ajMat ?? 0))}</td>
          <td>${edNum(i, "ajTelefone", "d_tel", fmt(c?.ajTel ?? 0))}</td>
          <td>${edNum(i, "heaHoras", "hea_h", fmtNum((c?.HEA_min ?? 0) / 60, 1))}</td>
          <td class="otVal">${edNum(i, "heaValor", "hea_v", fmt(c?.HEA_valor ?? 0))}</td>
          <td>${edNum(i, "hebHoras", "heb_h", fmtNum((c?.HEB_min ?? 0) / 60, 1))}</td>
          <td class="otVal">${edNum(i, "hebValor", "heb_v", fmt(c?.HEB_valor ?? 0))}</td>
          <td>${edNum(i, "hrHoras", "hr_h", fmtNum((c?.HR_min ?? 0) / 60, 1))}</td>
          <td class="otVal">${edNum(i, "hrValor", "hr_v", fmt(c?.HR_valor ?? 0))}</td>
          <td class="strong tday">${edNum(i, "totalDia", "tot", fmt(c?.totalDia ?? 0))}</td>
        </tr>`;
}

/** Só as <tr> editáveis da tabela de dias — a app troca-as no sítio via
 *  window.__wsSetRows ao adicionar/duplicar/remover/marcar dias. */
export function buildCinemaEditableDayRowsHtml(
  dias: Dia[],
  calculos: CalcDia[],
  tabela: PdfTabela,
  currency: string = "EUR",
  locale: string = "pt",
  region?: string
): string {
  const s = getCinemaStrings(locale, region);
  const fmt = (n: number) => fmtMoney(n, currency);
  const R = ratesFor(tabela as any);
  return dias.map((d, i) => dayRowHtml(d, i, calculos[i], s, fmt, R.salarioDia, true)).join("");
}

// ── Construtor (PDF e editor) ────────────────────────────────────────────────
function render(
  editable: boolean,
  perfil: PdfPerfil,
  projeto: PdfProjeto,
  dias: Dia[],
  calculos: CalcDia[],
  totais: PdfTotais,
  tabela: PdfTabela,
  notas?: string,
  locale: string = "pt",
  region?: string,
  currency: string = "EUR",
  taxDisclaimer?: string,
  condicoes?: string,
  extra?: PdfExtra
): string {
  const s = getCinemaStrings(locale, region);
  const fmt = (n: number) => fmtMoney(n, currency);
  const curSym = currencySymbol(currency);
  const R = ratesFor(tabela as any);
  const semana = extra?.cinema?.semana;
  const info = extra?.cinema?.info ?? {};
  const nDias = Number(tabela.diasSemana) || extra?.cinema?.diasSemana || 5;
  const salarioSemana = Number(tabela.salarioSemana ?? 0) || 0;
  const aj = tabela.ajudas ?? {};
  const valRef = Number(aj.refeicao ?? 0), valTel = Number(aj.telefone ?? 0);
  const valViat = Number(aj.viatura ?? 0), valMat = Number(aj.material ?? 0);
  const mf = R.multFolga;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const today = new Date();
  const emitidoA = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
  const mesNome = getMonthName(projeto.mes, locale);

  const irsPct = extra?.fiscal?.IRS_percent;
  const ivaPct = extra?.fiscal?.IVA_percent;
  const ssPct = extra?.fiscal?.SS_percent;
  const pct = (v?: number) => (v == null ? "—" : `${fmtNum(Number(v), 2)}%`);
  const pctEdit = (f: string, v?: number) =>
    `<span class="ei money pctv" ${CE} inputmode="decimal" data-k="fiscal" data-f="${f}">${escapeHtml(String(v ?? 0))}</span>%`;

  // Campos: no editor são editáveis; no PDF, texto simples.
  const kvU = (label: string, k: string, f: string, val: string, ph = "") =>
    `<div class="uRow"><div class="uk">${escapeHtml(label)}</div><div class="uv">${
      editable ? edTi(k, f, val, ph ? `placeholder="${escapeHtml(ph)}"` : "") : escapeHtml(val)
    }</div></div>`;
  const money = (k: string, f: string, val: number, cKey: string) =>
    editable
      ? `${edMi(k, f, r2(val), cKey)} <span class="mini">${curSym}</span>`
      : fmt(val);
  const calcCell = (cKey: string, val: string) =>
    editable ? `<span data-c="${cKey}">${val}</span>` : val;

  const dayRows = dias.map((d, i) => dayRowHtml(d, i, calculos[i], s, fmt, R.salarioDia, editable)).join("");

  // Descanso entre semanas + recuperação (linha da folha de referência)
  const alvoH = semana ? Math.round(semana.alvo_min / 60) : 60;
  const wk = semana
    ? {
        hd: minutesToHM(semana.descanso_min),
        saldo: minutesToHM(semana.saldo_min),
        hrH: fmtNum(semana.HR_h, 1),
        hrV: fmt(semana.HR_valor),
        seg: minutesToHM(semana.segmento_min),
        cobravel: semana.cobravel,
      }
    : { hd: "00:00", saldo: minutesToHM(-alvoH * 60), hrH: "0,0", hrV: fmt(0), seg: "00:00", cobravel: false };

  const proxData = formatDatePT(info.proximaSemana?.data);
  const proxInicio = info.proximaSemana?.inicio ?? "";
  const nextWeekRow = editable
    ? `<tr>
          <td class="bTag">B</td>
          <td class="left">${escapeHtml(s.nextWeekStart)}</td>
          <td class="dateCell"><input class="ei date" type="text" inputmode="numeric" autocomplete="off" size="10" data-k="cinema" data-f="proxData" value="${escapeHtml(proxData)}"></td>
          <td class="timeCell"><input class="ei time" type="text" inputmode="numeric" autocomplete="off" data-k="cinema" data-f="proxInicio" value="${escapeHtml(proxInicio)}"></td>
          <td class="blue calc" data-c="w_seg">${escapeHtml(wk.seg)}</td>
          <td class="hint">${wk.cobravel ? "" : escapeHtml(s.notChargeable)}</td>
        </tr>`
    : `<tr>
          <td class="bTag">B</td>
          <td class="left">${escapeHtml(s.nextWeekStart)}</td>
          <td class="cData">${escapeHtml(proxData)}</td>
          <td class="cIni">${escapeHtml(proxInicio)}</td>
          <td class="blue">${escapeHtml(wk.seg)}</td>
          <td class="hint">${wk.cobravel ? "" : escapeHtml(s.notChargeable)}</td>
        </tr>`;

  const hrHCell = editable
    ? `<span class="ei money" ${CE} inputmode="decimal" data-k="cinema" data-f="hrSemanaHoras" data-c="w_hr_h">${escapeHtml(wk.hrH)}</span>`
    : escapeHtml(wk.hrH);
  const hrVCell = editable
    ? `<span class="ei money" ${CE} inputmode="decimal" data-k="cinema" data-f="hrSemanaValor" data-c="w_hr_v">${escapeHtml(wk.hrV)}</span>`
    : escapeHtml(wk.hrV);

  const pageCss = extra?.orientation === "portrait" ? "A4 portrait" : "A3 landscape";
  const pageWidthPx = extra?.orientation === "portrait" ? 794 : 1587;
  const pageMargin = extra?.orientation === "portrait" ? "7mm 6mm 3mm 6mm" : "14mm";

  const titleBar = editable
    ? edTi("projeto", "folhaTitulo", projeto.folhaTitulo || "", `placeholder="${escapeHtml(s.title)}"`)
    : escapeHtml(projeto.folhaTitulo || projeto.filme || s.title);

  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="${editable ? "width=device-width, initial-scale=1" : `width=${pageWidthPx}, initial-scale=1`}" />
      <style>
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        html, body { margin: 0; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 18px; color: #111; background: #fff; }
        .titleBox { border: 2px solid #2b2b2b; padding: 8px 10px; text-align: center; font-weight: 800; letter-spacing: .5px; background: #c00000; color: #fff; }
        .titleBox .ei { display: block; width: 100%; min-height: 1.2em; color: #fff; background: transparent; text-align: center; font-weight: 800; letter-spacing: .5px; }
        .titleBox .ei:empty::before { color: rgba(255,255,255,0.85); }
        .titleBox .ei:focus { background: rgba(255,255,255,.18); box-shadow: none; }
        .weekBar { border: 2px solid #2b2b2b; border-top: 0; padding: 5px 10px; text-align: center; font-weight: 800; font-size: 12px; background: #e9eef5; color: #1b3a63; }
        .weekBar .sub { display: block; font-weight: 700; font-size: 11px; color: #333; background: #f5f5f5; margin: 5px -10px -5px; padding: 4px; border-top: 1px solid #2b2b2b; }
        .headgrid { margin-top: 10px; display: grid; grid-template-columns: 40% 20%; justify-content: space-between; gap: 0; align-items: start; }
        .stack { display: flex; flex-direction: column; gap: 10px; }
        .box { border: 2px solid #2b2b2b; background: #fff; }
        .row { display: grid; grid-template-columns: 140px minmax(0, 1fr); border-top: 1px solid #2b2b2b; }
        .row:first-of-type { border-top: 0; }
        .k, .v { padding: 6px 8px; font-size: 12px; border-right: 1px solid #2b2b2b; min-width: 0; overflow: hidden; }
        .v { border-right: 0; }
        .mini { font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 2px solid #2b2b2b; padding: 6px; font-size: 12px; text-align: center; vertical-align: middle; }
        th { background: #7f7f7f; color: #fff; font-weight: 800; }
        th.h-blue { background: #2e75b6; color: #fff; }
        th.h-olive { background: #7f7f2e; color: #fff; }
        th.h-purple { background: #7030a0; color: #fff; }
        th.h-total { background: #bf9000; color: #fff; }
        th.h-red { background: #c00000; color: #fff; }
        .days .subhead th, .rates .subhead th { background: #d9d9d9; color: #111; }
        .days .subhead th.h-blue, .rates .subhead th.h-blue { background: #cfe0f2; color: #1b5fbf; }
        .days .subhead th.h-olive, .rates .subhead th.h-olive { background: #e6e6c8; color: #111; }
        .days .subhead th.h-purple, .rates .subhead th.h-purple { background: #e4d6f0; color: #111; }
        .days .subhead th.h-total, .rates .subhead th.h-total { background: #f2e2b3; color: #111; }
        .rates.folga .subhead th, .rates.folga th.h-red { color: #c00000; }
        .rates.folga .subhead th { background: #fbe5e5; }
        .rates.folga td { color: #c00000; font-weight: 800; }
        .days th { font-size: 11px; }
        .days td { font-size: 11px; }
        .days .mini { font-size: 10px; font-weight: 700; }
        .days th.cmark, .days td.cCont { text-align: center; padding-left: 3px; padding-right: 3px; }
        .days td.cCont { color: #c65a00; font-weight: 800; text-transform: uppercase; }
        .days th.cmark { color: #c65a00; }
        .days td.left, .days td.right { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
        .strong { font-weight: 900; }
        .blue { color: #1b5fbf; font-weight: 800; }
        .calc { background: #f7f7f7; color: #333; }
        /* Linhas de FOLGA a vermelho e feriado com ★ — como na folha de referência */
        .days tr.folgaRow td:first-child, .days tr.folgaRow td.dateCell, .days tr.folgaRow td.cData { color: #c00000; font-weight: 800; }
        .days tr.folgaRow .ei.left { color: #c00000; font-weight: 800; }
        .days tr.restRow td { background: #fff7f7; }
        .fer { color: #c00000; margin-right: 3px; }
        .days td.tday { background: #fff3bf; white-space: nowrap; }
        .days td.right { white-space: nowrap; }
        .days td.cIni, .days td.cFim { min-width: 44px; }
        .days td.cPd { min-width: 48px; }
        .days td.cOtv { min-width: 48px; }
        .days td.cTot { min-width: 58px; }
        table.rates { table-layout: fixed; margin-top: 18px; }
        table.rates.folga { margin-top: 8px; width: 60%; }
        table.rates td { word-break: break-word; }
        .secTitle { font-weight: 900; font-size: 12px; margin: 8px 0 2px; text-transform: uppercase; }
        .uRow { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px; align-items: end; }
        .uk { font-size: 11px; font-weight: 800; padding: 5px 0 3px; }
        .uv { font-size: 13.5px; font-weight: 700; border-bottom: 1px solid #2b2b2b; padding: 5px 2px 3px; min-height: 1.25em; min-width: 0; overflow: hidden; }
        .uv .ei { display: block; width: 100%; min-height: 1.1em; white-space: nowrap; overflow: hidden; }
        .sideBox .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .sideBox .k { font-weight: 800; }
        .sideBox .v { text-align: right; font-weight: 700; white-space: nowrap; }
        .sideBox .vfRow .v { background: #fff3bf; font-weight: 900; }
        /* Barra do descanso entre semanas + linha B (início da semana seguinte) */
        table.weekRest { margin-top: 6px; }
        table.weekRest th { background: #f2f2f2; color: #111; font-size: 10.5px; text-align: left; padding: 5px 8px; }
        table.weekRest th.lbl { background: #c00000; color: #fff; text-align: center; width: 15%; }
        table.weekRest td { font-size: 11.5px; font-weight: 800; white-space: nowrap; }
        table.weekRest td.blue { color: #1b5fbf; }
        table.weekRest td.hr { background: #fff3bf; }
        table.weekRest th.rec { background: #cfe0f2; color: #1b5fbf; }
        table.nextWeek { margin-top: 6px; width: 60%; }
        table.nextWeek th { font-size: 10.5px; }
        table.nextWeek td.bTag { background: #2e75b6; color: #fff; font-weight: 900; width: 26px; }
        table.nextWeek td.left { text-align: left; font-size: 11px; }
        table.nextWeek td.hint { font-size: 10px; color: #7a0000; font-weight: 700; text-align: left; border-left: 0; }
        table.endTotals { width: auto; margin-left: auto; margin-top: 8px; }
        table.endTotals th { background: #f2f2f2; color: #111; text-align: left; font-size: 11px; padding: 5px 10px; min-width: 130px; }
        table.endTotals td { font-weight: 900; text-align: right; font-size: 11px; min-width: 120px; }
        table.endTotals tr.net th { font-weight: 900; }
        table.endTotals tr.net td { background: #fff3bf; }
        .condWrap { margin-top: 10px; border: 2px solid #2b2b2b; }
        .condMain { background: #ffd400; color: #7a0000; font-weight: 900; text-align: center; padding: 6px 8px; font-size: 12px; border-bottom: 2px solid #2b2b2b; text-transform: uppercase; }
        .notesWrap { margin-top: 10px; border: 2px solid #2b2b2b; }
        .notesTitle { background: #ffd400; color: #7a0000; font-weight: 900; text-align: center; padding: 6px 8px; font-size: 12px; border-bottom: 2px solid #2b2b2b; text-transform: uppercase; }
        .notesArea { padding: 8px 10px; font-size: 11.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; min-height: 44px; }
        .condRow { display: grid; grid-template-columns: 190px minmax(0, 1fr); border-top: 1px solid #2b2b2b; }
        .condRow:first-of-type { border-top: 0; }
        .condT { background: #e8e8e8; font-weight: 900; font-size: 10px; text-transform: uppercase; display: flex; align-items: center; justify-content: center; text-align: center; padding: 6px; border-right: 1px solid #2b2b2b; }
        .condB { padding: 6px 8px; font-size: 11.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        .condImg { display: block; margin: 8px auto 2px; max-width: 70%; max-height: 240px; border: 1px solid #999; }
        .conditionsBody { padding: 8px 10px; font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        ${editable ? `
        /* ── Editor ── */
        .ei:empty::before { content: attr(placeholder); color: #b3b3b3; }
        .ei { background: transparent; color: #111; cursor: text; outline: none; min-width: 10px; display: inline-block; }
        .ei:focus { background: #eef4ff; box-shadow: inset 0 0 0 1px #1b5fbf; }
        .ei:empty { min-width: 24px; min-height: 1em; }
        .row .v .ei { display: block; width: 100%; min-height: 1.1em; }
        .row .v .ei.pctv { display: inline-block; width: auto; min-width: 24px; text-align: right; }
        .notes { display: block; width: 100%; min-height: 48px; white-space: pre-wrap; text-align: left; }
        td.tdias .ei { color: #7a0000; }
        .ei.money { white-space: nowrap; }
        input.ei { border: 0; margin: 0; padding: 0; font: inherit; color: #111; text-align: center; width: 100%; box-sizing: border-box; background: transparent; -webkit-appearance: none; appearance: none; border-radius: 0; }
        input.ei::placeholder { color: #b3b3b3; }
        input.ei:focus { background: #eef4ff; outline: none; box-shadow: inset 0 0 0 1px #1b5fbf; }
        .days td.timeCell, table.nextWeek td.timeCell { width: 56px; min-width: 56px; padding-left: 4px; padding-right: 4px; }
        .days td.contCell, .days th.cmark { width: 26px; min-width: 26px; padding-left: 2px; padding-right: 2px; text-align: center; }
        .days td.contCell .ei.cmark { display: block; text-align: center; text-transform: uppercase; color: #c65a00; font-weight: 800; }
        .days td.dateCell, table.nextWeek td.dateCell { width: 82px; min-width: 82px; padding-left: 4px; padding-right: 4px; }
        .days td.otVal { min-width: 64px; }
        .days td.mealDay { min-width: 54px; }
        .days td.calc { white-space: nowrap; }
        .afterDays { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .afterDays .endTotals { margin-top: 8px; }
        .addDayBar { margin-top: 10px; text-align: left; }
        .addDayBar button { font: inherit; font-weight: 800; font-size: 13px; padding: 8px 14px; border: 2px solid #2b2b2b; border-radius: 999px; background: #f2f2f2; color: #111; cursor: pointer; margin-right: 8px; }
        .addDayBar .delBtn { border-color: #c05050; color: #c05050; background: #fff; }
        table.days .ei.left { display: block; width: 72px; white-space: normal; }
        .rowBtns { display: block; white-space: nowrap; margin-top: 2px; }
        .rbtn { cursor: pointer; user-select: none; -webkit-user-select: none; color: #9a9a9a; font-size: 12px; padding: 0 4px; }
        .rbtn.rdel { color: #c05050; }
        /* Interruptores Folga / Feriado por linha (só no editor; não saem no PDF) */
        .rowTogs { display: block; white-space: nowrap; margin-top: 3px; }
        .rtog { display: inline-block; cursor: pointer; user-select: none; -webkit-user-select: none; font-size: 9px; font-weight: 800; text-transform: uppercase; color: #9a9a9a; border: 1px solid #cfcfcf; border-radius: 999px; padding: 1px 6px; margin-right: 3px; }
        .rtog.on { color: #fff; background: #c00000; border-color: #c00000; }
        @media print { .addDayBar, .rowBtns, .rowTogs, table.nextWeek td.hint { display: none; } }
        ` : `
        /* ── PDF ── */
        .condGroup { break-inside: avoid; page-break-inside: avoid; } .condTopSpacer { display: block; height: 6mm; } .condWrap { margin-top: 0; }
        .condWrap, .notesWrap { -webkit-box-decoration-break: clone; box-decoration-break: clone; }
        .condMain, .notesTitle { break-after: avoid; page-break-after: avoid; }
        .condRow { break-inside: avoid; page-break-inside: avoid; }
        table.endTotals, table.weekRest, table.nextWeek { break-inside: avoid; page-break-inside: avoid; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        table.nextWeek td.hint { display: none; }
        @media print {
          @page { size: ${pageCss}; margin: ${pageMargin}; }
          body { padding: 0; }
          ${extra?.orientation === "portrait"
            ? "body { font-size: 9px; } .titleBox { font-size: 13px; } .k, .v, .uv { font-size: 10px; } .days th { font-size: 8px; } .days td { font-size: 10px; } .days th, .days td { padding: 4px 1.1px; } .secTitle { font-size: 10px; } table.rates { table-layout: auto; } .condMain { font-size: 10px; padding: 3px 8px; } .condT { font-size: 8.5px; padding: 3px 4px; } .condB, .conditionsBody { font-size: 9.5px; line-height: 1.28; padding: 3px 6px; } .condRow { grid-template-columns: 150px minmax(0, 1fr); } .days td.cData { min-width: 60px; } .days td.cSal { min-width: 54px; } table.weekRest th, table.weekRest td { font-size: 9px; padding: 3px 5px; }" + (extra?.ipadPdf ? " table.days, table.days th, table.days td { min-width: 0 !important; }" : "")
            : "table.days { table-layout: fixed; } .days th, .days td { word-break: break-word; padding: 3px 4px; } .days th { font-size: 9px; padding-left: 2px; padding-right: 2px; letter-spacing: -0.2px; } .days col.col-desc { width: 6%; } .days col.col-data { width: 7%; } .days col.col-sal { width: 5.5%; } .days col.col-cont { width: 2%; } .days col.col-ini { width: 4%; } .days col.col-ref { width: 4.6%; } .days col.col-fim { width: 4%; } .days col.col-ht { width: 5.3%; } .days col.col-hd { width: 5.3%; } .days col.col-pd { width: 4.6%; } .days col.col-ott { width: 3.8%; } .days col.col-otv { width: 5.6%; } .days col.col-tot { width: 6%; } .condMain { font-size: 11px; padding: 4px 8px; } .condT { font-size: 9px; padding: 4px 5px; } .condB { font-size: 10px; line-height: 1.3; padding: 4px 7px; } .conditionsBody { font-size: 10px; line-height: 1.3; padding: 6px 8px; } .condRow { grid-template-columns: 220px minmax(0, 1fr); }"}
        }
        `}
      </style>
    </head>
    <body>
      <div class="titleBox">${titleBar}</div>
      <div class="weekBar">${escapeHtml(s.weekWord)} - ${nDias} ${escapeHtml(s.daysWord)}<span class="sub">${escapeHtml(s.sheetSubtitle)}</span></div>

      <div class="headgrid">
        <div class="stack">
          <div class="secTitle">${escapeHtml(s.personalData)}</div>
          <div>
            ${kvU(s.name, "perfil", "nome", safeStr(perfil.nome))}
            ${kvU(s.role, "perfil", "funcao", safeStr(perfil.funcao))}
            ${kvU(s.department, "perfil", "departamento", safeStr(perfil.departamento ?? ""))}
            ${kvU(s.companyLabel, "perfil", "empresa", safeStr(perfil.empresa ?? ""))}
            ${kvU(s.phone, "perfil", "telefone", safeStr(perfil.telefone))}
            ${kvU(s.email, "perfil", "email", safeStr(perfil.email))}
            ${kvU(s.nif, "perfil", "nif", safeStr(perfil.nif ?? ""))}
            ${kvU(s.iban, "perfil", "iban", safeStr(perfil.iban ?? ""))}
            ${kvU(s.swift, "perfil", "swift", safeStr(perfil.swift ?? ""))}
          </div>
          <div class="secTitle">${escapeHtml(s.productionSection)}</div>
          <div>
            ${kvU(s.film, "projeto", "filme", safeStr(projeto.filme))}
            ${kvU(s.productionLabel, "projeto", "produtora", safeStr(projeto.produtora))}
            ${kvU(s.productionNif, "projeto", "nifProdutora", safeStr(projeto.nifProdutora ?? ""))}
            ${kvU(s.productionType, "cinema", "tipoProducao", safeStr(info.tipoProducao ?? ""), s.productionTypePh)}
          </div>
        </div>
        <div class="stack">
          <div class="box sideBox">
            <div class="row"><div class="k">${escapeHtml(s.issuedOn)}</div><div class="v">${escapeHtml(emitidoA)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.irs)}</div><div class="v">${editable ? pctEdit("IRS_percent", irsPct) : pct(irsPct)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.iva)}</div><div class="v">${editable ? pctEdit("IVA_percent", ivaPct) : pct(ivaPct)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.ss)}</div><div class="v">${editable ? pctEdit("SS_percent", ssPct) : pct(ssPct)}</div></div>
            <div class="row vfRow"><div class="k">${escapeHtml(s.vf)}</div><div class="v"${editable ? ` data-c="vf"` : ""}>${fmt(totais.ValorFinal)}</div></div>
          </div>
          <div class="box sideBox">
            <div class="row"><div class="k">${escapeHtml(s.weekNr)}</div><div class="v">${editable ? edTi("projeto", "semana", safeStr(projeto.semana ?? "")) : escapeHtml(safeStr(projeto.semana ?? ""))}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.month)}</div><div class="v">${escapeHtml(mesNome)}</div></div>
            <div class="row"><div class="k">${escapeHtml(s.year)}</div><div class="v">${escapeHtml(String(projeto.ano))}</div></div>
          </div>
        </div>
      </div>

      <table class="rates">
        <tr>
          <th>${escapeHtml(s.salary)}</th>
          <th>${escapeHtml(s.overtimeA)}</th>
          <th>${escapeHtml(s.overtimeB)}</th>
          <th class="h-blue">${escapeHtml(s.recoveryHours)}</th>
          <th>${escapeHtml(s.meal)}</th>
          <th class="h-olive">${escapeHtml(s.vehicle)}</th>
          <th class="h-purple">${escapeHtml(s.material)}</th>
          <th>${escapeHtml(s.telephone)}</th>
        </tr>
        <tr class="subhead">
          <th class="mini">${escapeHtml(s.weekWord)} ${nDias} ${escapeHtml(s.daysWordUp)}</th>
          <th class="mini">${escapeHtml((s as any).perHourLabel || s.perHour)}</th>
          <th class="mini">${escapeHtml((s as any).perHourLabel || s.perHour)}</th>
          <th class="mini h-blue">${escapeHtml((s as any).perHourLabel || s.perHour)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-olive">${escapeHtml(s.perDay)}</th>
          <th class="mini h-purple">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
        </tr>
        <tr>
          <td>${money("tabela", "salarioSemana", salarioSemana, "g_sem")}</td>
          <td>${money("tabela", "rateHEA", R.rateHEA, "g_hea")}</td>
          <td>${money("tabela", "rateHEB", R.rateHEB, "g_heb")}</td>
          <td>${money("tabela", "rateHR", R.rateHR, "g_hr")}</td>
          <td>${money("ajudas", "refeicao", valRef, "g_ref")}</td>
          <td>${money("ajudas", "viatura", valViat, "g_viat")}</td>
          <td>${money("ajudas", "material", valMat, "g_mat")}</td>
          <td>${money("ajudas", "telefone", valTel, "g_tel")}</td>
        </tr>
      </table>

      <table class="rates folga">
        <tr>
          <th class="h-red" colspan="4">${escapeHtml(s.dayOff)}</th>
        </tr>
        <tr class="subhead">
          <th class="mini">${escapeHtml(s.salary)} · ${escapeHtml(s.day)}</th>
          <th class="mini">${escapeHtml(s.overtimeA)}</th>
          <th class="mini">${escapeHtml(s.overtimeB)}</th>
          <th class="mini">${escapeHtml(s.recoveryHours)}</th>
        </tr>
        <tr>
          <td>${calcCell("g_fsal", fmt(R.salarioDia * mf))}</td>
          <td>${calcCell("g_fhea", fmt(R.rateHEA * mf))}</td>
          <td>${calcCell("g_fheb", fmt(R.rateHEB * mf))}</td>
          <td>${calcCell("g_fhr", fmt(R.rateHR * mf))}</td>
        </tr>
      </table>

      <table class="days">
        <colgroup>
          <col class="col-desc" /><col class="col-data" /><col class="col-sal" /><col class="col-cont" />
          <col class="col-ini" /><col class="col-ref" /><col class="col-fim" />
          <col class="col-ht" /><col class="col-hd" />
          <col class="col-pd" /><col class="col-pd" /><col class="col-pd" /><col class="col-pd" />
          <col class="col-ott" /><col class="col-otv" />
          <col class="col-ott" /><col class="col-otv" />
          <col class="col-ott" /><col class="col-otv" />
          <col class="col-tot" />
        </colgroup>
        <tr>
          <th colspan="2">${escapeHtml(s.day)}</th>
          <th>${escapeHtml(s.value)}</th>
          <th colspan="4">${escapeHtml(s.schedule)}</th>
          <th colspan="2">${escapeHtml(s.totalHours)}</th>
          <th>${escapeHtml(s.meal)}</th>
          <th class="h-olive">${escapeHtml(s.vehicle)}</th>
          <th class="h-purple">${escapeHtml(s.material)}</th>
          <th>${escapeHtml(s.telephone)}</th>
          <th colspan="2">${escapeHtml(s.overtimeAFull)}</th>
          <th colspan="2">${escapeHtml(s.overtimeBFull)}</th>
          <th colspan="2" class="h-blue">${escapeHtml(s.recoveryFull)}</th>
          <th class="h-total">${escapeHtml(s.total)}</th>
        </tr>
        <tr class="subhead">
          <th class="mini">${escapeHtml(s.description)}</th>
          <th class="mini">${escapeHtml(s.date)}</th>
          <th class="mini">${escapeHtml(s.day)}</th>
          <th class="mini cmark">C</th>
          <th class="mini">${escapeHtml(s.start)}</th>
          <th class="mini">${escapeHtml(s.mealBreak)}</th>
          <th class="mini">${escapeHtml(s.end)}</th>
          <th class="mini">${escapeHtml(s.workHours)}</th>
          <th class="mini blue">${escapeHtml(s.restHours)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini h-olive">${escapeHtml(s.perDay)}</th>
          <th class="mini h-purple">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.perDay)}</th>
          <th class="mini">${escapeHtml(s.total)}</th>
          <th class="mini">${escapeHtml(s.value)}</th>
          <th class="mini">${escapeHtml(s.total)}</th>
          <th class="mini">${escapeHtml(s.value)}</th>
          <th class="mini h-blue">${escapeHtml(s.total)}</th>
          <th class="mini h-blue">${escapeHtml(s.value)}</th>
          <th class="mini h-total">${escapeHtml(s.day)}</th>
        </tr>
        ${dayRows}
      </table>

      <table class="weekRest">
        <tr>
          <th class="lbl">${escapeHtml(s.restRowLabel)}</th>
          <th>${escapeHtml(s.restBetweenWeeks)}</th>
          <td class="blue">${calcCell("w_hd", escapeHtml(wk.hd))}</td>
          <th>${escapeHtml(s.target)} ${alvoH}H</th>
          <td class="blue">${calcCell("w_saldo", escapeHtml(wk.saldo))}</td>
          <th class="rec">${escapeHtml(s.recoveryBetweenWeeks)}</th>
          <td class="hr">${hrHCell}</td>
          <td class="hr">${hrVCell}</td>
        </tr>
      </table>

      <table class="nextWeek">
        <tr class="subhead">
          <th class="mini"></th>
          <th class="mini">${escapeHtml(s.description)}</th>
          <th class="mini">${escapeHtml(s.date)}</th>
          <th class="mini">${escapeHtml(s.start)}</th>
          <th class="mini blue">${escapeHtml(s.restHours)}</th>
          <th class="mini" style="border-left:0"></th>
        </tr>
        ${nextWeekRow}
      </table>

      ${editable ? `<div class="afterDays">
        <div class="addDayBar">
          <button type="button" id="wsAddDay">＋ ${escapeHtml(s.addDay)}</button>
          <button type="button" id="wsDupDay">⧉ ${escapeHtml((s as any).dupDay || "Duplicar dia")}</button>
          <button type="button" id="wsDelDay" class="delBtn">✕ ${escapeHtml((s as any).removeDay || "Remover dia")}</button>
        </div>` : `<div class="totalsTopSpacer"></div>`}
        <table class="endTotals">
          <tr><th>${escapeHtml(s.vb)}</th><td${editable ? ` data-c="gross"` : ""}>${fmt(totais.ValorBruto)}</td></tr>
          <tr><th>${escapeHtml(s.irs)}</th><td${editable ? ` data-c="birs"` : ""}>${fmt(totais.IRS_valor)}</td></tr>
          <tr><th>${escapeHtml(s.iva)}</th><td${editable ? ` data-c="biva"` : ""}>${fmt(totais.IVA_valor)}</td></tr>
          <tr><th>${escapeHtml(s.ss)}</th><td${editable ? ` data-c="bss"` : ""}>${fmt(totais.SS_valor ?? 0)}</td></tr>
          <tr class="net"><th>${escapeHtml(s.vf)}</th><td${editable ? ` data-c="net"` : ""}>${fmt(totais.ValorFinal)}</td></tr>
        </table>
      ${editable ? `</div>` : ``}

      ${editable
        ? conditionsHtml(s, safeStr(perfil.nome), condicoes, extra, CE)
        : (() => {
            const ch = conditionsHtml(s, safeStr(perfil.nome), condicoes, extra);
            return ch ? `<div class="condGroup"><div class="condTopSpacer"></div>${ch}</div>` : "";
          })()}

      ${editable
        ? `<div class="notesWrap"><div class="notesTitle">${escapeHtml(s.notes)}</div><div class="ei notes notesArea" ${CE} data-k="notas" data-f="notas" placeholder="…">${escapeHtml(notas || "")}</div></div>`
        : (notas && notas.trim() ? `<div class="notesWrap"><div class="notesTitle">${escapeHtml(s.notes)}</div><div class="notesArea">${escapeHtml(notas)}</div></div>` : "")}

      ${!editable && taxDisclaimer ? `<div style="margin-top:8px;font-size:9px;color:#999;">${escapeHtml(taxDisclaimer)}</div>` : ""}

      ${editable ? `<script>
      (function(){
        // Interruptores Folga / Feriado por linha (classe própria .rtog para o
        // handler dos ⧉/✕ da folha base — .rbtn — não os apanhar).
        function post(m){ try{
          if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
          else if(window.parent && window.parent!==window){ window.parent.postMessage(m,'*'); }
        }catch(e){} }
        document.addEventListener('click', function(e){
          var el = e.target;
          if(!el.classList || !el.classList.contains('rtog')) return;
          var i = parseInt(el.getAttribute('data-i'), 10);
          post({ type: el.getAttribute('data-act') === 'folga' ? 'ws:toggleFolga' : 'ws:toggleFeriado', i: i });
        }, true);
      })();
      </script>
      ${editorScript(s)}` : ""}
    </body>
  </html>`;

  return editable ? html : applyFontScale(html, extra?.fontScale);
}

/** PDF da folha de cinema (mesma assinatura do buildPdfHtml). */
export function buildCinemaPdfHtml(
  perfil: PdfPerfil, projeto: PdfProjeto, dias: Dia[], calculos: CalcDia[], totais: PdfTotais, tabela: PdfTabela,
  notas?: string, locale: string = "pt", region?: string, currency: string = "EUR",
  taxDisclaimer?: string, condicoes?: string, extra?: PdfExtra
): string {
  return render(false, perfil, projeto, dias, calculos, totais, tabela, notas, locale, region, currency, taxDisclaimer, condicoes, extra);
}

/** Editor da folha de cinema (mesma assinatura do buildEditableSheetHtml). */
export function buildCinemaEditableSheetHtml(
  perfil: PdfPerfil, projeto: PdfProjeto, dias: Dia[], calculos: CalcDia[], totais: PdfTotais, tabela: PdfTabela,
  notas?: string, locale: string = "pt", region?: string, currency: string = "EUR",
  taxDisclaimer?: string, condicoes?: string, extra?: PdfExtra
): string {
  return render(true, perfil, projeto, dias, calculos, totais, tabela, notas, locale, region, currency, taxDisclaimer, condicoes, extra);
}
