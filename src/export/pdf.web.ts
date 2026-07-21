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

  // A folha tem de sair IGUAL no PC e no telemóvel. No vertical, as condições
  // saltam INTEIRAS para uma página nova (break-before) em vez de partirem a
  // meio a seguir à tabela — o MESMO CSS nos dois. Usa-se break-before (não
  // break-inside:avoid) porque no WebKit do iOS um bloco maior que a página com
  // avoid é CORTADO; break-before é sempre seguro (se passar de uma página,
  // parte limpo com as molduras fechadas — box-decoration-break no CSS
  // partilhado). Só se aplica quando há condições substanciais.
  const condChars =
    (condicoes ?? "").length +
    (extra?.condBoxes ?? []).reduce(
      (n, b) => n + (b?.titulo ?? "").length + (b?.texto ?? "").length,
      0
    );
  const isPortrait = extra?.orientation === "portrait";
  const condVerticalCss =
    condChars > 1200 && isPortrait
      ? "<style>@media print{ .condWrap { break-before: page; page-break-before: always; } }</style>"
      : "";

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
    const htmlWithPrint = html
      .replace("</head>", condVerticalCss + "</head>")
      .replace("</body>", printScript + "</body>");
    const blob = new Blob([htmlWithPrint], { type: "text/html; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url;
    else setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Desktop / Android: hidden iframe + browser print dialog.
  // VERTICAL: exatamente o mesmo CSS do telemóvel (condVerticalCss) para a
  // folha sair igual nos dois. HORIZONTAL: mantém-se o break-inside:avoid de
  // sempre (o bloco salta inteiro para a página seguinte quando não cabe; no
  // Blink um bloco maior que a página parte na mesma, nunca corta).
  const desktopPrintCss = isPortrait
    ? condVerticalCss
    : "<style>@media print{ .condWrap, .notesWrap { break-inside: avoid; page-break-inside: avoid; } }</style>";
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
