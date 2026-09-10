// src/calc/feriadosPT.ts
// Feriados nacionais OBRIGATÓRIOS em Portugal (art. 234.º do Código do
// Trabalho) — os únicos a que a folha de cinema aplica "dia a dobrar".
// Os móveis (Sexta-feira Santa, Páscoa, Corpo de Deus) derivam da Páscoa.

/** Domingo de Páscoa (calendário gregoriano — algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function plusDays(y: number, m: number, d: number, n: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Datas ISO (YYYY-MM-DD) dos 13 feriados obrigatórios de um ano. */
export function feriadosPT(year: number): string[] {
  const e = easterSunday(year);
  return [
    iso(year, 1, 1),                    // Ano Novo
    plusDays(year, e.month, e.day, -2),  // Sexta-feira Santa
    iso(year, e.month, e.day),           // Domingo de Páscoa
    iso(year, 4, 25),                    // Dia da Liberdade
    iso(year, 5, 1),                     // Dia do Trabalhador
    plusDays(year, e.month, e.day, 60),  // Corpo de Deus
    iso(year, 6, 10),                    // Dia de Portugal
    iso(year, 8, 15),                    // Assunção
    iso(year, 10, 5),                    // Implantação da República
    iso(year, 11, 1),                    // Todos os Santos
    iso(year, 12, 1),                    // Restauração da Independência
    iso(year, 12, 8),                    // Imaculada Conceição
    iso(year, 12, 25),                   // Natal
  ];
}

const cache = new Map<number, Set<string>>();

/** É feriado obrigatório em Portugal? (data ISO YYYY-MM-DD) */
export function isFeriadoPT(isoDate: string | undefined): boolean {
  if (!isoDate) return false;
  const y = Number(String(isoDate).slice(0, 4));
  if (!Number.isFinite(y) || y < 1900) return false;
  let set = cache.get(y);
  if (!set) { set = new Set(feriadosPT(y)); cache.set(y, set); }
  return set.has(String(isoDate).slice(0, 10));
}
