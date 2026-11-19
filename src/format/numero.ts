// src/format/numero.ts
// Um número escrito à mão num campo do perfil (salário, taxas €/h, IRS, IVA,
// horas). Lê-se como sempre se leu — a vírgula é o separador decimal — mas
// ignorando o que não é número: "34,09 €" dava NaN e o campo gravava 0 (uma
// taxa de horas extra a 0 € em todas as folhas novas). Sem algarismos = vazio.
// O 0 é um valor (IVA 0 %), por isso não se confunde com vazio.
export function lerNumero(txt: unknown): number | undefined {
  const limpo = String(txt ?? "").replace(/[^\d,.\-]/g, "");
  if (!/\d/.test(limpo)) return undefined;
  const n = Number(limpo.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
