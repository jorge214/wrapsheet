// A marca da folha de exemplo (`exemplo: true` no blob — ver storage/exemplo.ts).
// Módulo puro, sem dependências, para o usarem as contas, o armazenamento e os
// testes. A marca vive FORA do tipo ProjectState de propósito: pô-la no tipo
// muda o texto de um erro de tipos antigo da linha de base e o verify bloqueia.
//
// A folha de exemplo não conta nos totais da app (o Painel e o cartão da
// página inicial mostravam "A receber 750 €" a quem nunca trabalhou), nem nas
// estatísticas. Mas deixa de ser exemplo no momento em que alguém a usa a
// sério: ao copiá-la, limpá-la ou dar-lhe nome/produção. Senão o trabalho real
// feito por cima dela desaparecia dos totais — dinheiro a menos à vista.
// (18/11/2026: das 12 folhas de exemplo em produção, nenhuma tinha sido
// renomeada nem mexida — mas o caminho tem de estar fechado.)

/** A folha é a de exemplo? */
export function eExemplo(p: unknown): boolean {
  return !!p && typeof p === "object" && (p as { exemplo?: unknown }).exemplo === true;
}

/** A mesma folha, sem a marca de exemplo (a própria, se não a tinha). */
export function semExemplo<T extends object>(p: T): T {
  if (!eExemplo(p)) return p;
  const { exemplo: _marca, ...resto } = p as T & { exemplo?: boolean };
  return resto as T;
}

/** Mudar um destes campos da produção faz da folha de exemplo uma folha a sério. */
export const CAMPOS_QUE_TORNAM_REAL: ReadonlySet<string> = new Set(["titulo", "folhaTitulo", "filme", "produtora"]);
