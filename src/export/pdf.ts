// src/export/pdf.ts
// Native delivery (iOS / Android) via expo-print + expo-sharing.
// Metro bundler uses pdf.web.ts on web instead of this file.

import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { CalcDia, Dia } from "../calc/types";
import {
  buildPdfHtml,
  PdfExtra,
  PdfPerfil,
  PdfProjeto,
  PdfTabela,
  PdfTotais,
} from "./buildPdfHtml";

function sanitizeFilename(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
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
  try {
    const html = buildPdfHtml(perfil, projeto, dias, calculos, totais, tabela, notas, locale, region, currency, taxDisclaimer, condicoes, extra);

    // A3 horizontal (1191×842 pt) — sem isto o iOS usa A4 vertical e a folha
    // sai cortada à direita (faltavam colunas no PDF exportado no telemóvel).
    const result = await Print.printToFileAsync({ html, width: 1191, height: 842 });
    let outUri = result.uri;

    const mesNome = new Intl.DateTimeFormat(locale, { month: "long" })
      .format(new Date(2000, (projeto.mes ?? 1) - 1, 1))
      .replace(/^./, (c) => c.toUpperCase());

    const baseName = sanitizeFilename(
      `Folha_${projeto.filme || "Projeto"}_${mesNome}_${projeto.ano}`
    );

    const fsAny = FileSystem as any;
    if (fsAny.cacheDirectory) {
      const dest = `${fsAny.cacheDirectory}${baseName}.pdf`;
      try {
        await FileSystem.copyAsync({ from: outUri, to: dest });
        outUri = dest;
      } catch (e) {
        console.warn("PDF copyAsync falhou, a usar uri original:", e);
      }
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(outUri);
    }
  } catch (e) {
    console.error("Erro exportPDF:", e);
    throw e;
  }
}
