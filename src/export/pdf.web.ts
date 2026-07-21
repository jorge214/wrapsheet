// src/export/pdf.web.ts
// Web PDF export: writes the HTML into a hidden iframe and calls print().
// On iOS this shows the native share sheet (Save to Files, AirDrop, etc.).
// On desktop the browser print dialog opens — user picks "Save as PDF".
// This approach uses the browser's own rendering engine, which is always correct.

import { CalcDia, Dia } from "../calc/types";
import {
  buildPdfHtml,
  PdfExtra,
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
  taxDisclaimer?: string,
  condicoes?: string,
  extra?: PdfExtra
): Promise<void> {
  const html = buildPdfHtml(
    perfil, projeto, dias, calculos, totais, tabela,
    notas, locale, region, currency, taxDisclaimer, condicoes, extra
  );

  // iOS Safari: iframe.contentWindow.print() prints the parent app page, not the iframe.
  // Open the PDF HTML as a blob URL in a new tab — user sees the PDF, taps
  // Safari's share button → Print to get the proper iOS share / save sheet.
  const isIOS =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // Inject auto-print script so the iOS print dialog fires automatically when the page loads.
    // The print dialog on iOS shows the correct content preview + "Save to Files" / AirPrint.
    const printScript =
      '<scr' + 'ipt>window.addEventListener("load",function(){setTimeout(function(){window.print();},400);});<\/scr' + 'ipt>';
    // Condições curtas: também no iOS saltam INTEIRAS para a página seguinte
    // quando não cabem no resto da página (como no desktop). Mas só quando é
    // garantido que o bloco cabe numa página: no WebKit, break-inside:avoid
    // num bloco maior que a página CORTA o fim (o bug antigo do expo-print).
    // A salvaguarda é pelo tamanho do texto (limite conservador — ~3500
    // caracteres cabem folgados numa página em ambas as orientações, ajustado
    // ao fontScale). Condições longas continuam a fluir e partir entre linhas
    // com as molduras fechadas (box-decoration-break no CSS partilhado).
    const condChars =
      (condicoes ?? "").length +
      (extra?.condBoxes ?? []).reduce(
        (n, b) => n + (b?.titulo ?? "").length + (b?.texto ?? "").length,
        0
      );
    const fsScale = extra?.fontScale && extra.fontScale > 0 ? extra.fontScale : 1;
    const condFitCss =
      condChars > 0 && condChars < 3500 / (fsScale * fsScale)
        ? "<style>@media print{ .condWrap { break-inside: avoid; page-break-inside: avoid; } }</style>"
        : "";
    const htmlWithPrint = html
      .replace("</head>", condFitCss + "</head>")
      .replace("</body>", printScript + "</body>");
    const blob = new Blob([htmlWithPrint], { type: "text/html; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url;
    else setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Desktop / Android: hidden iframe + browser print dialog
  // Só aqui (Blink/Gecko): se as condições/notas não couberem no resto da
  // página, o bloco salta INTEIRO para a página seguinte — caixa fechada em
  // vez de partida ao meio. Não se injeta no iOS: no WebKit um bloco maior que
  // uma página com break-inside:avoid é CORTADO no fim (o bug do expo-print);
  // lá o bloco flui e parte entre linhas, com as molduras clonadas
  // (box-decoration-break no CSS partilhado). Nos Blink/Gecko um bloco maior
  // que a página ignora o avoid e parte na mesma — nunca perde conteúdo.
  const desktopPrintCss =
    "<style>@media print{ .condWrap, .notesWrap { break-inside: avoid; page-break-inside: avoid; } }</style>";
  const htmlDesktop = html.replace("</head>", desktopPrintCss + "</head>");

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(htmlDesktop);
  doc.close();

  await new Promise<void>((r) => setTimeout(r, 700));

  iframe.contentWindow!.print();

  setTimeout(() => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }, 2000);
}
