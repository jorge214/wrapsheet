// src/export/pdf.web.ts
// Web delivery: injects a hidden iframe, writes HTML directly and triggers print.
// Using contentDocument.write avoids popup blockers and unreliable srcdoc onload.

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

  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
      document.body.appendChild(iframe);

      iframe.contentDocument!.write(html);
      iframe.contentDocument!.close();

      setTimeout(() => {
        try {
          iframe.contentWindow!.focus();
          iframe.contentWindow!.print();
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          }, 2000);
        }
      }, 600);
    } catch (err) {
      reject(err);
    }
  });
}
