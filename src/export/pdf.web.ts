// src/export/pdf.web.ts
// Web PDF generation: html2canvas + jsPDF.
// The container must be in the viewport for html2canvas to capture it;
// a white overlay div hides it from the user during rendering.

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

  // Pull the CSS text out of the <style> block
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const cssText = styleMatch ? styleMatch[1] : "";

  // Pull the body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  // Inject styles into <head> so they apply properly to our container
  const styleEl = document.createElement("style");
  styleEl.setAttribute("data-wrapsheet-pdf", "1");
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);

  // White overlay — covers the PDF container so the user doesn't see it flash
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:#fff;z-index:99999;pointer-events:none;";
  document.body.appendChild(overlay);

  // PDF container placed at (0,0) so it's inside the viewport — html2canvas
  // cannot capture elements positioned outside the viewport boundaries.
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;top:0;left:0;width:1587px;background:#fff;z-index:1;";
  container.innerHTML = bodyContent;
  document.body.appendChild(container);

  // Two rAFs: first attaches the nodes, second ensures layout + paint
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  );

  const filename =
    (projeto.filme || "folha-horas").replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf";

  try {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 1587,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    });

    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a3", orientation: "landscape" });

    const pageW = pdf.internal.pageSize.getWidth();  // 420 mm
    const pageH = pdf.internal.pageSize.getHeight(); // 297 mm
    const margin = 5;
    const innerW = pageW - 2 * margin; // 410 mm
    const innerH = pageH - 2 * margin; // 287 mm

    const pxPerMm = canvas.width / innerW;
    const pageHeightPx = Math.floor(innerH * pxPerMm);
    const numPages = Math.ceil(canvas.height / pageHeightPx);

    for (let i = 0; i < numPages; i++) {
      if (i > 0) pdf.addPage();

      const srcY = i * pageHeightPx;
      const srcH = Math.min(pageHeightPx, canvas.height - srcY);

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = srcH;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, srcH);
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.97);
      pdf.addImage(imgData, "JPEG", margin, margin, innerW, srcH / pxPerMm);
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
    document.body.removeChild(overlay);
    document.head.removeChild(styleEl);
  }
}
