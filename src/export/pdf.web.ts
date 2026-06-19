// src/export/pdf.web.ts
// Web PDF generation: html2canvas captures the HTML, jsPDF assembles the PDF.
// We bypass html2pdf.js because v0.14 wraps the element in an opacity:0 overlay
// which causes html2canvas to produce a blank canvas.

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

  // Extract <style> and <body> content to inject into our container div
  const styles = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join("\n");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  // Off-screen container at A3 landscape width (420 mm ≈ 1587 px @ 96 dpi)
  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-9999px;top:0;width:1587px;background:#fff;";
  container.innerHTML = styles + bodyContent;
  document.body.appendChild(container);

  // Two rAFs: first attaches the node, second ensures layout + font painting
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const filename =
    (projeto.filme || "folha-horas").replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf";

  try {
    // Capture with html2canvas directly (dynamic import — safe for SSR)
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 1587,
    });

    // Assemble PDF with jsPDF
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a3", orientation: "landscape" });

    const pageW = pdf.internal.pageSize.getWidth();  // 420 mm
    const pageH = pdf.internal.pageSize.getHeight(); // 297 mm
    const margin = 5; // mm
    const innerW = pageW - 2 * margin; // 410 mm
    const innerH = pageH - 2 * margin; // 287 mm

    // How many px represent 1 mm of inner page width
    const pxPerMm = canvas.width / innerW;
    const pageHeightPx = Math.floor(innerH * pxPerMm);
    const numPages = Math.ceil(canvas.height / pageHeightPx);

    for (let i = 0; i < numPages; i++) {
      if (i > 0) pdf.addPage();

      const srcY = i * pageHeightPx;
      const srcH = Math.min(pageHeightPx, canvas.height - srcY);

      // Slice this page out of the full canvas
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = srcH;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, srcH);
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.97);
      const imgH = srcH / pxPerMm;
      pdf.addImage(imgData, "JPEG", margin, margin, innerW, imgH);
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
