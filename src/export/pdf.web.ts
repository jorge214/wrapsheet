// src/export/pdf.web.ts
// Web delivery: opens a print-ready window and triggers the browser print dialog.
// Metro bundler uses this file on web instead of pdf.ts.

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
  const html = buildPdfHtml(perfil, projeto, dias, calculos, totais, tabela, notas, locale, region, currency, taxDisclaimer);

  const win = (window as any).open("", "_blank");
  if (!win) {
    throw new Error(
      "Popup bloqueado pelo browser. Permite popups para este site e tenta novamente."
    );
  }
  win.document.write(html);
  win.document.close();
  // Small delay so the browser finishes rendering before opening the print dialog
  setTimeout(() => win.print(), 400);
}
