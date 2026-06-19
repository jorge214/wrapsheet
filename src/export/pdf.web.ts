// src/export/pdf.web.ts
// Web PDF export: writes the HTML into a hidden iframe and calls print().
// On iOS this shows the native share sheet (Save to Files, AirDrop, etc.).
// On desktop the browser print dialog opens — user picks "Save as PDF".
// This approach uses the browser's own rendering engine, which is always correct.

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

  // iOS Safari: iframe.contentWindow.print() prints the parent app page, not the iframe.
  // Open the PDF HTML as a blob URL in a new tab — user sees the PDF, taps
  // Safari's share button → Print to get the proper iOS share / save sheet.
  const isIOS =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) {
    const blob = new Blob([html], { type: "text/html; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url; // fallback if popup blocked
    else setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Desktop / Android: hidden iframe + browser print dialog
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise<void>((r) => setTimeout(r, 700));

  iframe.contentWindow!.print();

  setTimeout(() => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }, 2000);
}
