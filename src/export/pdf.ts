// src/export/pdf.ts
// Native delivery (iOS / Android) via expo-print + expo-sharing.
// Metro bundler uses pdf.web.ts on web instead of this file.

import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

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
    // Este caminho é sempre o expo-print (WebKit) no iOS/iPad — marca-o para o
    // builder calibrar a paginação ao motor certo (≠ do Blink na web).
    const isIpad = Platform.OS === "ios" && (Platform as any).isPad === true;
    const extraNative: PdfExtra = { ...extra, nativePrint: true, ipadPdf: isIpad };
    const html = buildPdfHtml(perfil, projeto, dias, calculos, totais, tabela, notas, locale, region, currency, taxDisclaimer, condicoes, extraNative);

    // Horizontal = A3 landscape (1191×842 pt, como sempre foi — a tabela dos
    // dias precisa desta largura); vertical = A4 portrait (595×842).
    //
    // iPad (só): a tabela dos dias transbordava à direita porque o WebKit LIGA
    // o text-autosizing (font boosting) quando a página imprime a escala < 1 —
    // e 595pt / 794px de viewport = escala ~0.749. O boosting inflava as fontes
    // das células -> o min-content da tabela (layout auto) ultrapassava o 100%
    // -> transbordo. Solução: imprimir o vertical num frame de 794×1123pt (=
    // viewport 794px -> escala 1.0), o que DESLIGA o boosting (WebKit só o corta
    // com escala >= 1). Mesmo rácio A4 (1123/794 = 297/210), imprime igual em
    // fit-to-page. iPhone/web ficam nos 595×842 e no CSS calibrado, intactos.
    const portrait = extra?.orientation === "portrait";
    // DIAGNÓSTICO (temporário): frame do iPad de volta a 595 para o clientWidth
    // distinguir "viewport honrado (794)" de "layout à largura da frame (595)".
    const pageW = portrait ? (isIpad ? 595 : 595) : 1191;
    const pageH = portrait ? (isIpad ? 842 : 842) : 842;
    const result = await Print.printToFileAsync({
      html,
      width: pageW,
      height: pageH,
    });
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
