import { StyleSheet } from "react-native";
import { FONT } from "./metrics";

/**
 * Presets SEMÂNTICOS:
 * - não uses FONT.h1/h2/h3 diretamente nas páginas
 * - usa sempre TYPO.*
 */
export const TYPO = StyleSheet.create({
  // Título grande do ecrã (Dashboard / Projetos / Arquivados)
  screenTitle: {
    fontSize: FONT.h1 ?? 28,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  // Subtítulo/ajuda (ex: "Toque para selecionar o mês")
  helper: {
    fontSize: FONT.body ?? 14,
    fontWeight: "500",
  },

  // Título do mês (Janeiro 2026)
  monthTitle: {
    fontSize: FONT.h2 ?? 22,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  // Títulos de secção (ex: "Recentes no mês", "Menu principal")
  sectionTitle: {
    fontSize: FONT.label ?? 15,
    fontWeight: "700",
  },

  // ✅ ESTE É O TEU “UNIVERSAL CARD TITLE”
  // (Projeto sem nome / Teste 1 / etc.) — igual em toda a app
  cardTitle: {
    fontSize: FONT.h3 ?? 18,
    fontWeight: "800",
  },

  // Texto secundário em cards (cliente · 01/2026, atualizado, etc.)
  meta: {
    fontSize: FONT.small ?? 13,
    fontWeight: "500",
  },

  // Texto normal
  body: {
    fontSize: FONT.body ?? 14,
    fontWeight: "500",
  },
});
