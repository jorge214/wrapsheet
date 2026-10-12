// Edição feita sobre uma versão que entretanto ficou velha.
//
// O ecrã do projeto guarda em memória a versão que carregou (projectRef). Se a
// app ficar no fundo (a PWA no Dock do Mac, por exemplo), o sync descarrega a
// versão mais recente do outro aparelho para o armazenamento, mas o ecrã não
// dá por isso. A primeira tecla que o utilizador carregar gravaria a versão
// VELHA inteira com um carimbo novo — e o outro aparelho perdia o título, as
// horas, tudo o que tinha feito entretanto (os italianos, 12/10/2026).
//
// Aqui aplica-se só o que o utilizador mudou AGORA (as chaves de topo que
// diferem entre a versão carregada e a editada) por cima da versão guardada.
// Módulo puro, para se testar. Os carimbos aceitam ISO (storage) ou número
// (o tipo antigo de models/), porque os dois ProjectState ainda coexistem.
type Carimbado = { updatedAt?: string | number };

const ts = (v?: string | number) => {
  if (typeof v === "number") return v;
  const n = Date.parse(v || "");
  return Number.isFinite(n) ? n : 0;
};

/** A versão guardada é mais recente do que a que o ecrã carregou? */
export function guardadoMaisRecente(carregado: Carimbado, guardado: Carimbado | null | undefined): boolean {
  return !!guardado && ts(guardado.updatedAt) > ts(carregado.updatedAt);
}

/**
 * `anterior` = o que o ecrã tinha; `editado` = o mesmo com a edição de agora;
 * `guardado` = o que está no armazenamento (mais recente). Devolve `guardado`
 * com as chaves que mudaram entre `anterior` e `editado` por cima.
 */
export function aplicarEdicaoSobre<T extends Record<string, any>>(anterior: T, editado: T, guardado: T): T {
  const out: Record<string, any> = { ...guardado };
  const chaves = new Set([...Object.keys(anterior), ...Object.keys(editado)]);
  for (const k of chaves) {
    if (k === "updatedAt" || k === "id") continue;
    if (JSON.stringify(anterior[k]) !== JSON.stringify(editado[k])) out[k] = editado[k];
  }
  return out as T;
}
