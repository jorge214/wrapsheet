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

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content + fonts to render before triggering print
  await new Promise<void>((r) => setTimeout(r, 700));

  iframe.contentWindow!.print();

  // Remove iframe after a short delay so the print dialog has time to open
  setTimeout(() => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }, 2000);
}
