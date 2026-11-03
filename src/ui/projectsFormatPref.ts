// Formato em foco na lista de projetos (Todos / Publicidade / Cinema), lembrado
// por aparelho. Pedido de uma utilizadora que queria abrir "por pastas"
// Publicidade e Cinema: em vez de reorganizar a navegação, a lista volta com o
// formato que se deixou escolhido.
import type { FormatoFiltro } from "../format/formatFilter";
import { createDevicePref } from "./devicePref";

export type { FormatoFiltro };

/** Valor guardado -> filtro. Ausente ou desconhecido = "todos" (o de sempre). */
export function parseFormatoFiltro(raw: string | null | undefined): FormatoFiltro {
  return raw === "publicidade" || raw === "cinema" ? raw : "todos";
}

export const projectsFormatPref = createDevicePref<FormatoFiltro>(
  "ui:projectsFormat:v1",
  parseFormatoFiltro,
  "todos"
);

if (typeof (globalThis as any).window !== "undefined") projectsFormatPref.load();
