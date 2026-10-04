// Formato de uma folha guardada (publicidade / cinema), lido do blob JSON.
//
// Porque não basta ler `raw.formato`: o código anterior ao cinema (main até
// 29/09/2026, commit 0aff42c — App Store 1.1.0 sem a OTA, web antiga em cache)
// reconstrói o projeto ao ler com uma lista FIXA de campos, sem `formato` nem
// `cinema`. Uma folha de cinema lida e gravada por um aparelho desses perde a
// etiqueta e passa a abrir e a listar-se como publicidade (aconteceu em
// produção: projeto 1789573054390, semana de 6 dias, gravado a 18/09).
//
// O que sobrevive a essa limpeza é a `tabela` (o código antigo espalha-a toda):
// `salarioSemana` + `diasSemana` 5 ou 6. Só os caminhos de cinema escrevem esse
// par (createProject de cinema, duplicar para outro perfil no ramo de cinema,
// editor da folha semanal) e o motor já o usa para reconhecer o cinema
// (`taxaGravada` em calc/engine.ts). Por isso uma folha SEM `formato` com esse
// par é uma folha de cinema que perdeu a etiqueta — e recupera-a aqui.
//
// Módulo puro (sem AsyncStorage) para se poder testar.
import type { FormatoFolha } from "../calc/project";

export function formatoDoBlob(raw: any): FormatoFolha | undefined {
  if (raw?.formato === "cinema") return "cinema";
  // Qualquer outro valor explícito é publicidade; só se infere quando falta.
  if (raw?.formato != null) return undefined;
  const t = raw?.tabela;
  const dias = Number(t?.diasSemana);
  return t && t.salarioSemana != null && (dias === 5 || dias === 6) ? "cinema" : undefined;
}

/** Valor para o resumo do índice: explícito, para o reparo não voltar a ler a folha. */
export function formatoDoResumo(raw: any): FormatoFolha {
  return formatoDoBlob(raw) ?? "publicidade";
}
