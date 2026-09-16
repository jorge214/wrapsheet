// src/export/pdf.web.ts
// Exportação de PDF na WEB.
//
// Caminho principal: a folha (HTML) vai para /api/pdf, que a renderiza com
// Chromium no servidor e devolve um PDF a sério — igual em Chrome, Firefox,
// Safari e nas apps instaladas (PWA). No telemóvel/tablet abre a folha de
// partilha nativa (Guardar em Ficheiros, WhatsApp…); no computador descarrega.
//
// Recurso (se o servidor falhar ou não houver rede): o caminho antigo — mandar
// o browser imprimir a folha — que só é fiável no Chrome/Edge. Ficou porque é
// melhor do que nada: o Safari ignorava a orientação do @page até à 18.2, o
// Firefox punha cabeçalhos e margens próprias, e a PWA do Firefox no Android
// não abria diálogo nenhum. Foi por isso que o PDF passou para o servidor.

import { CalcDia, Dia } from "../calc/types";
import { supabase } from "../lib/supabase";
import { buildCinemaPdfHtml } from "./buildCinemaHtml";
import {
  buildPdfHtml,
  PdfExtra,
  PdfPerfil,
  PdfProjeto,
  PdfTabela,
  PdfTotais,
} from "./buildPdfHtml";

const GENERATING: Record<string, string> = {
  pt: "A gerar o PDF…", "pt-BR": "Gerando o PDF…", en: "Generating PDF…", es: "Generando el PDF…",
  fr: "Génération du PDF…", de: "PDF wird erstellt…", it: "Generazione del PDF…", nl: "PDF wordt gemaakt…",
  pl: "Generowanie PDF…",
};

function sanitizeFilename(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

// Mesmo nome que o nativo dá ao ficheiro: Folha_<filme>_<Mês>_<ano>.pdf
function fileNameFor(projeto: PdfProjeto, locale: string): string {
  let mesNome = "";
  try {
    mesNome = new Intl.DateTimeFormat(locale, { month: "long" })
      .format(new Date(2000, (projeto.mes ?? 1) - 1, 1))
      .replace(/^./, (c) => c.toUpperCase());
  } catch {
    mesNome = String(projeto.mes ?? "");
  }
  return sanitizeFilename(`Folha_${projeto.filme || "Projeto"}_${mesNome}_${projeto.ano}`) + ".pdf";
}

const isMobile = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Aviso discreto enquanto o servidor trabalha (a primeira exportação depois de
// uns minutos parados arranca o Chromium e demora uns segundos).
function showBusy(text: string): () => void {
  const el = document.createElement("div");
  el.textContent = text;
  el.setAttribute("role", "status");
  el.style.cssText =
    "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:999999;" +
    "background:#111;color:#fff;font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
    "padding:10px 16px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none;";
  document.body.appendChild(el);
  return () => { if (el.parentNode) el.parentNode.removeChild(el); };
}

async function renderOnServer(html: string, fileName: string): Promise<Blob> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("sem sessão");
  const res = await fetch("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ html, fileName }),
  });
  if (!res.ok) throw new Error(`api/pdf ${res.status}`);
  const blob = await res.blob();
  if (!blob.size || !/pdf/i.test(blob.type)) throw new Error("resposta não é PDF");
  return blob;
}

async function deliver(blob: Blob, fileName: string): Promise<void> {
  const nav: any = navigator;
  // Telemóvel/tablet: folha de partilha nativa (Safari iOS, Chrome Android,
  // Samsung Internet). O Firefox não partilha ficheiros → cai no download.
  if (isMobile() && typeof File !== "undefined" && typeof nav.canShare === "function") {
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: fileName });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return; // o utilizador fechou a folha de partilha
        // outra falha (ex.: ativação expirada) → download
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── Recurso: impressão pelo browser (o caminho antigo) ───────────────────────
function printFallback(html: string): void {
  const isIOS = isMobile() && !/Android/i.test(navigator.userAgent);
  if (isIOS) {
    // iOS Safari: iframe.contentWindow.print() imprime a app, não a folha.
    const printScript =
      '<scr' + 'ipt>window.addEventListener("load",function(){setTimeout(function(){window.print();},400);});<\/scr' + 'ipt>';
    const blob = new Blob([html.replace("</body>", printScript + "</body>")], { type: "text/html; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url;
    else setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try { iframe.contentWindow!.print(); } catch (e) { console.error(e); }
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
  }, 700);
}

export async function exportPDF(
  perfil: PdfPerfil,
  projeto: PdfProjeto,
  dias: Dia[],
  calculos: CalcDia[],
  totais: PdfTotais,
  tabela: PdfTabela,
  _logoDataUri?: string,
  notas?: string,
  locale: string = "pt",
  region?: string,
  currency: string = "EUR",
  taxDisclaimer?: string,
  condicoes?: string,
  extra?: PdfExtra
): Promise<void> {
  // Folha de cinema (semanal) tem construtor próprio; a de publicidade é a de sempre.
  const build = extra?.cinema ? buildCinemaPdfHtml : buildPdfHtml;
  const html = build(
    perfil, projeto, dias, calculos, totais, tabela,
    notas, locale, region, currency, taxDisclaimer, condicoes, extra
  );
  const fileName = fileNameFor(projeto, locale);

  const hide = showBusy(GENERATING[locale] || GENERATING[locale.split("-")[0]] || GENERATING.en);
  try {
    const blob = await renderOnServer(html, fileName);
    hide();
    await deliver(blob, fileName);
    return;
  } catch (e) {
    console.warn("[pdf] servidor indisponível, a usar a impressão do browser:", e);
  } finally {
    hide();
  }
  printFallback(html);
}
