// src/format/numero.ts
// Um número escrito à mão num campo do perfil (salário, taxas €/h, horas,
// limiares). Lê-se como sempre se leu — a vírgula é o separador decimal — mas
// tirando o que está nas PONTAS (moeda, %, "h") e os espaços: "34,09 €" dava
// NaN e o campo gravava 0 (uma taxa de horas extra a 0 € em todas as folhas
// novas). O que não é um número simples — "19:00", "8h30", "1,2,3" — fica
// VAZIO (vale o automático), em vez de colar os algarismos num número
// convincente e errado (1900 h). Sem algarismos = vazio. O 0 é um valor.
export function lerNumero(txt: unknown): number | undefined {
  const limpo = String(txt ?? "")
    .replace(/[\s  ]/g, "")
    .replace(/^[^\d\-,.]+|[^\d,.]+$/g, "");
  if (!/\d/.test(limpo) || !/^-?\d*[.,]?\d*$/.test(limpo)) return undefined;
  const n = Number(limpo.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
