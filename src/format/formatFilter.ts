// Recortes da lista de projetos (formato da folha e pasta) e o aviso de que o
// formato está a esconder projetos.
//
// O formato (Todos / Publicidade / Cinema) é lembrado por aparelho, por isso a
// lista pode abrir com 1 projeto num mês que tem 4 — e a página inicial a dizer
// "4 projetos ativos". Sem aviso, isso lê-se como "os projetos desapareceram".
// Aqui conta-se quantos o formato esconde e o que mostra o botão "Ver todos os
// formatos (n)": n é SEMPRE o que se vê depois do toque.
//
// Módulo puro (sem React nem armazenamento) para se poder testar.

export type FormatoFiltro = "todos" | "publicidade" | "cinema";
export type Pasta = "todos" | "areceber" | "arquivados";
type Linha = { formato?: string | null; archived?: boolean; pago?: boolean };

/** Formato aplicado. Folhas antigas não têm `formato` — são publicidade. */
export function noFormato<T extends Linha>(arr: T[], formato: FormatoFiltro): T[] {
  if (formato === "cinema") return arr.filter((p) => p.formato === "cinema");
  if (formato === "publicidade") return arr.filter((p) => p.formato !== "cinema");
  return arr;
}

/** Pasta aplicada: "A Receber" = nem arquivado nem marcado pago; "Pagos" = arquivados. */
export function naPasta<T extends Linha>(arr: T[], pasta: Pasta): T[] {
  if (pasta === "areceber") return arr.filter((p) => !p.archived && !p.pago);
  if (pasta === "arquivados") return arr.filter((p) => p.archived);
  return arr;
}

export type AvisoFormato = {
  /** Projetos desta pasta que SÓ o formato esconde. */
  escondidos: number;
  /** O formato esconde o mês inteiro (em todas as pastas). */
  escondeTudo: boolean;
  /** O n de "Ver todos os formatos (n)": o que fica à vista depois do toque. */
  verTodosN: number;
  /**
   * O toque também volta a pasta a "Todos": quando nem o outro formato tem
   * nada NESTA pasta (ex.: "Pagos" com o mês todo por pagar), tirar só o
   * formato dava uma lista vazia, a desmentir o número.
   */
  repoePasta: boolean;
};

/** `mes` = os projetos do mês em foco (ou de todos os meses), antes de formato e pasta. */
export function avisoFormato(mes: Linha[], formato: FormatoFiltro, pasta: Pasta): AvisoFormato {
  const daPasta = naPasta(mes, pasta);
  const escondidos = formato === "todos" ? 0 : daPasta.length - noFormato(daPasta, formato).length;
  const escondeTudo = formato !== "todos" && mes.length > 0 && noFormato(mes, formato).length === 0;
  const repoePasta = escondidos === 0;
  return {
    escondidos,
    escondeTudo,
    verTodosN: repoePasta ? mes.length : daPasta.length,
    repoePasta,
  };
}
