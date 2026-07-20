// Formatação de moeda/números da APP (ecrãs), independente do Intl.
// O Hermes (motor JS do React Native) não agrupa milhares com toLocaleString/
// Intl.NumberFormat, por isso os valores saíam "4342,00" no telemóvel. Aqui o
// agrupamento é feito à mão, igual na web e no telemóvel.
//
// Identidade da app: símbolo à frente ("€ 4.342,00"), milhares com ".",
// decimais com ",". (A FOLHA/PDF usa fmtMoney em buildPdfHtml.ts, com o símbolo
// à direita — formato de folha de referência — mas o mesmo agrupamento.)

/** Insere "." (ou outro separador) a cada 3 dígitos: "4342" -> "4.342". */
export function groupInt(intStr: string, sep = "."): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** Número localizado PT: "1.234", "1.234,5", "1.234,00". */
export function formatNumber(n: number, digits = 0): string {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  const neg = safe < 0;
  const fixed = Math.abs(safe).toFixed(digits);
  if (digits <= 0) return `${neg ? "-" : ""}${groupInt(fixed)}`;
  const [i, d] = fixed.split(".");
  return `${neg ? "-" : ""}${groupInt(i)},${d}`;
}

/** Dinheiro dos ecrãs da app: "€ 4.342,00" (símbolo à frente). */
export function formatMoneyApp(n: number, symbol = "€"): string {
  return `${symbol} ${formatNumber(n, 2)}`;
}
