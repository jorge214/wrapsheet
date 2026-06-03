// Generates a standalone editable HTML page for the day table.
// Opens as a blob URL in a new tab — shares localStorage with the parent app.
// Changes auto-save to localStorage; the parent tab listens via 'storage' event.

import { CalcDia, Dia } from "../calc/types";
import { PdfPerfil, PdfProjeto, PdfTabela, PdfTotais } from "./buildPdfHtml";
import { minutesToHM } from "../calc/engine";

export const EDIT_STORAGE_PREFIX = "wrapsheet:edit:";

function esc(s: string | undefined | null) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoney(n: number, currency = "EUR") {
  const sym = currency === "EUR" ? "€" : currency;
  return `${sym} ${Number(n ?? 0).toFixed(2)}`;
}

export function buildEditableHtml(
  projectId: string,
  perfil: PdfPerfil,
  projeto: PdfProjeto,
  dias: Dia[],
  calculos: CalcDia[],
  totais: PdfTotais,
  tabela: PdfTabela,
  currency = "EUR"
): string {
  const fmt = (n: number) => fmtMoney(n, currency);
  const salarioDia = Number(tabela.salarioDia || 0);
  const storageKey = EDIT_STORAGE_PREFIX + projectId;

  // Embed initial data as JSON for the JS to use
  const initialData = JSON.stringify(
    dias.map((d) => ({
      descricao: d.descricao ?? "",
      data: d.data ?? "",
      inicio: d.inicio ?? "",
      refeicaoTrabalho: d.refeicaoTrabalho ?? "",
      jantarTrabalho: d.jantarTrabalho ?? "",
      fim: d.fim ?? "",
      tempoTransporteMin: d.tempoTransporteMin ?? 0,
      diaSemTrabalho: d.diaSemTrabalho ?? false,
      meioDia: d.meioDia ?? false,
    }))
  );

  const rows = dias
    .map((d, i) => {
      const c = calculos[i] ?? {} as CalcDia;
      const off = d.diaSemTrabalho;
      return `
      <tr data-day="${i}" class="${off ? "row-off" : ""}">
        <td><input class="ei" data-day="${i}" data-f="descricao" value="${esc(d.descricao)}"></td>
        <td><input class="ei date-input" data-day="${i}" data-f="data" value="${esc(d.data)}"></td>
        <td class="right">${fmt(salarioDia)}</td>
        <td><input class="ei time-input" data-day="${i}" data-f="inicio" value="${esc(d.inicio)}" ${off ? "disabled" : ""}></td>
        <td><input class="ei time-input" data-day="${i}" data-f="refeicaoTrabalho" value="${esc(d.refeicaoTrabalho)}" ${off ? "disabled" : ""}></td>
        <td><input class="ei time-input" data-day="${i}" data-f="fim" value="${esc(d.fim)}" ${off ? "disabled" : ""}></td>
        <td class="calc">${off ? "—" : minutesToHM(c.HT_min ?? 0)}</td>
        <td class="calc blue">${off ? "—" : minutesToHM(c.HD_min ?? 0)}</td>
        <td class="right calc">${fmt(off ? 0 : (tabela.ajudas?.refeicao ?? 0))}</td>
        <td class="right calc">${fmt(off ? 0 : (tabela.ajudas?.perDiem ?? 0))}</td>
        <td class="right calc">${fmt(off ? 0 : (tabela.ajudas?.telefone ?? 0))}</td>
        <td class="right calc">${fmt(off ? 0 : (tabela.ajudas?.viatura ?? 0))}</td>
        <td class="right calc">${fmt(off ? 0 : (tabela.ajudas?.material ?? 0))}</td>
        <td class="right calc">${off ? "—" : Number((c.HEA_min ?? 0) / 60).toFixed(1)}</td>
        <td class="right calc">${off ? "—" : fmt(c.HEA_valor ?? 0)}</td>
        <td class="right calc">${off ? "—" : Number((c.HEB_min ?? 0) / 60).toFixed(1)}</td>
        <td class="right calc">${off ? "—" : fmt(c.HEB_valor ?? 0)}</td>
        <td class="right calc">${off ? "—" : Number((c.HR_min ?? 0) / 60).toFixed(1)}</td>
        <td class="right calc">${off ? "—" : fmt(c.HR_valor ?? 0)}</td>
        <td class="right strong calc">${off ? "—" : fmt(c.totalDia ?? 0)}</td>
        <td class="toggles">
          <label title="Dia OFF"><input type="checkbox" class="ei-cb" data-day="${i}" data-f="diaSemTrabalho" ${d.diaSemTrabalho ? "checked" : ""}> OFF</label>
          <label title="Meio dia"><input type="checkbox" class="ei-cb" data-day="${i}" data-f="meioDia" ${d.meioDia ? "checked" : ""}> ½</label>
        </td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>${esc(projeto.filme || "WrapSheet")} — Editar</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px; color: #111; background: #f6f7f9; }
    h2 { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
    .bar { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; padding: 10px 16px; margin-bottom: 12px; }
    .bar .name { flex: 1; font-size: 17px; font-weight: 900; }
    .bar .status { font-size: 12px; color: #888; }
    .bar .totals { font-size: 13px; font-weight: 700; color: #1c1c1e; }
    .note { font-size: 11px; color: #888; margin-bottom: 10px; }
    .wrap { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 10px; overflow: hidden; }
    th, td { border: 1px solid #ddd; padding: 5px 6px; font-size: 11px; text-align: center; vertical-align: middle; white-space: nowrap; }
    th { background: #eaecf0; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: .3px; }
    .calc { background: #f4f5f7; color: #555; }
    .blue { color: #1b5fbf; font-weight: 800; }
    .right { text-align: right; }
    .strong { font-weight: 900; }
    .row-off td { opacity: 0.45; }
    .row-off .toggles { opacity: 1; }
    .ei {
      border: none; background: transparent; width: 100%; min-width: 60px;
      font-size: 11px; text-align: center; color: #111; font-family: inherit;
      padding: 2px 2px;
    }
    .ei:focus { outline: 2px solid #1b5fbf; border-radius: 3px; background: #eef4ff; }
    .time-input { min-width: 48px; font-variant-numeric: tabular-nums; }
    .date-input { min-width: 90px; }
    .toggles { white-space: nowrap; font-size: 10px; }
    .toggles label { display: inline-flex; align-items: center; gap: 2px; margin: 0 3px; cursor: pointer; }
    .ei-cb { cursor: pointer; }
    .saved { color: #1f7a37; }
    .unsaved { color: #c0392b; }
  </style>
</head>
<body>
  <div class="bar">
    <div class="name">${esc(projeto.filme || "—")}</div>
    <div class="totals">
      ${fmt(totais.ValorBruto)} bruto · ${fmt(totais.ValorFinal)} líquido
    </div>
    <div class="status" id="status">A carregar…</div>
  </div>
  <p class="note">Edita diretamente nas células — as alterações guardam automaticamente e sincronizam com a aplicação.</p>

  <div class="wrap">
    <table>
      <thead>
        <tr>
          <th>Descrição</th><th>Data</th><th>Salário/dia</th>
          <th>Início</th><th>Refeição</th><th>Fim</th>
          <th>H.Tot</th><th>H.Desc</th>
          <th>Ref</th><th>PerDiem</th><th>Tel</th><th>Viat</th><th>Mat</th>
          <th>HEA h</th><th>HEA €</th><th>HEB h</th><th>HEB €</th><th>HR h</th><th>HR €</th>
          <th>Total</th><th>Flags</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <script>
    const STORAGE_KEY = ${JSON.stringify(storageKey)};
    const initialData = ${initialData};
    let days = JSON.parse(JSON.stringify(initialData));
    const statusEl = document.getElementById('status');

    function setStatus(msg, cls) {
      statusEl.textContent = msg;
      statusEl.className = cls || '';
    }

    function save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ days: days, ts: Date.now() }));
        setStatus('Guardado ✓', 'saved');
      } catch(e) {
        setStatus('Erro ao guardar', 'unsaved');
      }
    }

    // Load any previously saved edits
    function load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) { setStatus('Pronto'); return; }
        const parsed = JSON.parse(raw);
        if (parsed && parsed.days) {
          days = parsed.days;
          // Apply to inputs
          document.querySelectorAll('.ei[data-day]').forEach(function(el) {
            const i = parseInt(el.getAttribute('data-day'));
            const f = el.getAttribute('data-f');
            if (days[i] && days[i][f] !== undefined) el.value = days[i][f];
          });
          document.querySelectorAll('.ei-cb[data-day]').forEach(function(el) {
            const i = parseInt(el.getAttribute('data-day'));
            const f = el.getAttribute('data-f');
            if (days[i] && days[i][f] !== undefined) el.checked = !!days[i][f];
          });
          setStatus('Guardado ✓', 'saved');
        }
      } catch(e) {}
    }

    // Wire up inputs
    document.querySelectorAll('.ei[data-day]').forEach(function(el) {
      el.addEventListener('input', function() {
        const i = parseInt(el.getAttribute('data-day'));
        const f = el.getAttribute('data-f');
        if (!days[i]) days[i] = {};
        days[i][f] = el.value;
        setStatus('A guardar…', 'unsaved');
        save();
      });
    });

    document.querySelectorAll('.ei-cb[data-day]').forEach(function(el) {
      el.addEventListener('change', function() {
        const i = parseInt(el.getAttribute('data-day'));
        const f = el.getAttribute('data-f');
        if (!days[i]) days[i] = {};
        days[i][f] = el.checked;
        save();
      });
    });

    load();
  </script>
</body>
</html>`;
}
