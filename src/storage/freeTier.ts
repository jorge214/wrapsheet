// src/storage/freeTier.ts
// Limites do plano gratuito.
// - Exports de PDF: ILIMITADOS (o PDF é o recibo com que o técnico é pago —
//   nunca se bloqueia; a antiga contagem de 3 exports foi removida).
// - O gate do futuro Pro é o número de projetos ativos (por agora desativado
//   com Infinity, até o Pro ser comprável).
export const FREE_PROJECT_LIMIT = Infinity;
