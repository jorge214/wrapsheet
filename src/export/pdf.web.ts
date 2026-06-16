// src/export/pdf.web.ts
// Web delivery: generates a PDF file via html2pdf.js and triggers a browser download.
// No print dialog — the user gets a direct .pdf file download.
// html2pdf.js is loaded dynamically to avoid SSR/Node.js import errors.

import { CalcDia, Dia } from "../calc/types";
import {
  buildPdfHtml,
  PdfPerfil,
  PdfProjeto,
  PdfTabela,
  PdfTotais,
} from "./buildPdfHtml";

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
  taxDisclaimer?: string
): Promise<void> {
  const html = buildPdfHtml(
    perfil, projeto, dias, calculos, totais, tabela,
    notas, locale, region, currency, taxDisclaimer
  );

  // Extract <style> blocks and <body> content so we can render off-screen
  const styles = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join("\n");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  // Create a fixed-width off-screen container so html2canvas captures at the
  // correct A3 landscape width (420 mm ≈ 1587 px at 96 dpi)
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1587px;background:#fff;";
  container.innerHTML = styles + bodyContent;
  document.body.appendChild(container);

  const filename =
    (projeto.filme || "folha-horas").replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf";

  // Dynamic import so html2pdf.js is never evaluated during SSR/static render
  const html2pdf = (await import("html2pdf.js")).default;

  try {
    await html2pdf()
      .from(container)
      .set({
        margin: 5,
        filename,
        image: { type: "jpeg", quality: 0.97 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1587,
        },
        jsPDF: { unit: "mm", format: "a3", orientation: "landscape" },
      })
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
