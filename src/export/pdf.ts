// src/export/pdf.ts
// Native delivery (iOS / Android) via expo-print + expo-sharing.
// Metro bundler uses pdf.web.ts on web instead of this file.

// "/legacy": no SDK 54 o export principal do expo-file-system deixou de ter
// cacheDirectory/copyAsync. Sem isto, o "if (cacheDirectory)" abaixo era
// sempre falso, a cópia com nome nunca corria, e o PDF seguia para o email/
// WhatsApp com o nome aleatório da impressão (relatado pela sócia do Jorge, 19/09).
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { CalcDia, Dia } from "../calc/types";
import { buildCinemaPdfHtml } from "./buildCinemaHtml";
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
    // Folha de cinema (semanal) tem construtor próprio; a de publicidade é a de sempre.
    const build = extraNative.cinema ? buildCinemaPdfHtml : buildPdfHtml;
    const html = build(perfil, projeto, dias, calculos, totais, tabela, notas, locale, region, currency, taxDisclaimer, condicoes, extraNative);

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
    // iPad: frame A4 vertical a 794×1123pt (viewport=794 -> escala 1.0), o que
    // DESLIGA a inflação de texto do desktop-class browsing -> a tabela cabe. Com
    // a fonte normal (10px), as células ficam com o MESMO tamanho aparente do
    // iPhone (10/794 = 7.5/595 = 1.26% da página). iPhone/web ficam em 595×842.
    const isIpadPortrait = portrait && isIpad;
    const pageW = portrait ? (isIpadPortrait ? 794 : 595) : 1191;
    const pageH = isIpadPortrait ? 1123 : 842;
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

    // Copia para um ficheiro com o nome certo — é esse nome que o email, o
    // WhatsApp e o "Guardar em Ficheiros" mostram.
    if (FileSystem.cacheDirectory) {
      const dest = `${FileSystem.cacheDirectory}${baseName}.pdf`;
      try {
        await FileSystem.deleteAsync(dest, { idempotent: true });
        await FileSystem.copyAsync({ from: outUri, to: dest });
        outUri = dest;
      } catch (e) {
        console.warn("PDF copyAsync falhou, a usar uri original:", e);
      }
    } else {
      console.warn("PDF: sem cacheDirectory, o ficheiro segue com o nome da impressão");
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(outUri);
    }
  } catch (e) {
    console.error("Erro exportPDF:", e);
    throw e;
  }
}
