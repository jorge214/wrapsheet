// A marca da folha de exemplo (`exemplo: true` no blob — ver storage/exemplo.ts).
// Módulo puro, sem dependências, para o usarem as contas, o armazenamento e os
// testes. A marca vive FORA do tipo ProjectState de propósito: pô-la no tipo
// muda o texto de um erro de tipos antigo da linha de base e o verify bloqueia.
//
// A folha de exemplo não conta nos totais da app (o Painel e o cartão da
// página inicial mostravam "A receber 750 €" a quem nunca trabalhou), nem nas
// estatísticas. Mas deixa de ser exemplo no momento em que alguém a usa a
// sério — senão o trabalho real feito por cima dela desaparecia dos totais,
// dinheiro a menos à vista:
//   • a app atual tira a marca a qualquer edição na folha, ao copiá-la, ao
//     limpá-la e ao dar-lhe nome (semExemplo);
//   • e só conta como exemplo a folha que ainda está INTACTA (eExemplo): com
//     o título igual ao filme, como a montarExemplo a deixa, e os três dias com
//     as horas do modelo. É isto que apanha o que as versões antigas da app
//     (no telemóvel até chegar a atualização) copiaram, renomearam ou
//     preencheram sem tirar a marca.
// (18/11/2026: as 12 folhas de exemplo em produção estavam todas intactas.)

/** As horas dos três dias da folha de exemplo (montarExemplo usa estas). */
export const HORAS_EXEMPLO: readonly (readonly [string, string])[] = [
  ["09:00", "18:00"],
  ["07:00", "20:30"],
  ["06:30", "19:00"],
];

/** Tem a marca de exemplo no blob (intacta ou não)? */
export function temMarcaExemplo(p: unknown): boolean {
  return !!p && typeof p === "object" && (p as { exemplo?: unknown }).exemplo === true;
}

/** É a folha de exemplo, ainda por usar? (fica fora dos totais e das estatísticas) */
export function eExemplo(p: unknown): boolean {
  if (!temMarcaExemplo(p)) return false;
  const q = p as { projeto?: { titulo?: unknown; filme?: unknown }; dias?: unknown };
  const titulo = String(q.projeto?.titulo ?? "").trim();
  if (!titulo || titulo !== String(q.projeto?.filme ?? "").trim()) return false;
  const dias = Array.isArray(q.dias) ? q.dias : [];
  return (
    dias.length === HORAS_EXEMPLO.length &&
    dias.every((d: any, i: number) => d?.inicio === HORAS_EXEMPLO[i][0] && d?.fim === HORAS_EXEMPLO[i][1])
  );
}

/** A mesma folha, sem a marca de exemplo (a própria, se não a tinha). */
export function semExemplo<T extends object>(p: T): T {
  if (!temMarcaExemplo(p)) return p;
  const { exemplo: _marca, ...resto } = p as T & { exemplo?: boolean };
  return resto as T;
}
