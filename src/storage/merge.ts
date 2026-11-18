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

const objeto = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Um bloco (a tabela, o projeto, o perfil da folha…) junta-se CAMPO A CAMPO:
 * só os campos que mudaram agora vão por cima do guardado. Antes ia o bloco
 * inteiro da cópia velha — mudar a refeição num ecrã velho desfazia o salário
 * e as taxas que o outro aparelho tinha escrito (revisão de 18/11). Recursivo
 * (tabela.ajudas, cinema.proximaSemana). Um campo apagado agora (ou posto a
 * undefined, que a gravação deita fora) sai também do guardado.
 */
function juntarBloco(a: Record<string, any>, e: Record<string, any>, g: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...g };
  for (const k of new Set([...Object.keys(a), ...Object.keys(e)])) {
    if (JSON.stringify(a[k]) === JSON.stringify(e[k])) continue;
    if (e[k] === undefined) {
      delete out[k];
      continue;
    }
    out[k] = objeto(a[k]) && objeto(e[k]) && objeto(g[k]) ? juntarBloco(a[k], e[k], g[k]) : e[k];
  }
  return out;
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
    if (JSON.stringify(anterior[k]) === JSON.stringify(editado[k])) continue;
    // Os DIAS juntam-se linha a linha: mudar a data de UM dia num ecrã com a
    // cópia velha repunha TODOS os dias dessa cópia por cima dos que o outro
    // aparelho tinha mudado ("mudas o primeiro dia e ele muda os outros").
    // Só se a semana mudou de forma (dias acrescentados/removidos) é que vai
    // a lista toda, que aí não há linha a linha que faça sentido.
    const a = anterior[k], e = editado[k], g = guardado[k];
    if (k === "dias" && Array.isArray(a) && Array.isArray(e) && Array.isArray(g) && a.length === e.length && g.length === e.length) {
      out[k] = e.map((row: any, i: number) => (JSON.stringify(a[i]) !== JSON.stringify(row) ? row : g[i]));
      continue;
    }
    if (objeto(a) && objeto(e) && objeto(g)) {
      out[k] = juntarBloco(a, e, g);
      continue;
    }
    out[k] = editado[k];
  }
  return out as T;
}
