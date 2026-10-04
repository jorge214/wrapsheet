import { describe, expect, it } from "vitest";
import { formatoDoBlob, formatoDoResumo } from "./formato";

// Blobs reais de produção (só os campos que contam), 03/10/2026.
// Folha de cinema de 6 dias depois de passar por um aparelho com o código
// anterior ao cinema: perdeu `formato` e `cinema`, a tabela ficou intacta.
const cinemaSemEtiqueta = {
  id: "1789573054390",
  tabela: { salarioDia: 0, salarioSemana: 500, diasSemana: 6, horasBase: 10, descansoSemanal_h: 36, multFolga: 2 },
  dias: [{ descricao: "Filmagem" }, { descricao: "FOLGA", folga: true }],
};
// Publicidade normal (a da Maria, 7 dias escritos à mão): só salarioDia.
const publicidade = { id: "1791017721080", tabela: { salarioDia: 250, H_dia: 11 }, dias: [] };

describe("formato de uma folha guardada", () => {
  it("cinema com etiqueta é cinema", () => {
    expect(formatoDoBlob({ formato: "cinema", tabela: { salarioSemana: 900, diasSemana: 5 } })).toBe("cinema");
  });

  it("cinema que perdeu a etiqueta num aparelho antigo volta a ser cinema", () => {
    expect(formatoDoBlob(cinemaSemEtiqueta)).toBe("cinema");
  });

  it("semana de 5 dias sem etiqueta também, mesmo com salário 0 (folha acabada de criar)", () => {
    expect(formatoDoBlob({ tabela: { salarioSemana: 0, diasSemana: 5 } })).toBe("cinema");
    expect(formatoDoBlob({ tabela: { salarioSemana: 0, diasSemana: "6" } })).toBe("cinema");
  });

  it("publicidade continua publicidade, com ou sem 7 dias", () => {
    expect(formatoDoBlob(publicidade)).toBeUndefined();
    expect(formatoDoBlob({ tabela: {} })).toBeUndefined();
    expect(formatoDoBlob({})).toBeUndefined();
    expect(formatoDoBlob(null)).toBeUndefined();
  });

  it("só o par completo conta: salário à semana sem dias 5/6 (ou o contrário) não é cinema", () => {
    expect(formatoDoBlob({ tabela: { salarioSemana: 500 } })).toBeUndefined();
    expect(formatoDoBlob({ tabela: { salarioSemana: 500, diasSemana: 7 } })).toBeUndefined();
    expect(formatoDoBlob({ tabela: { diasSemana: 5 } })).toBeUndefined();
  });

  it("um formato explícito que não é cinema nunca é trocado pela forma da tabela", () => {
    expect(formatoDoBlob({ formato: "publicidade", tabela: { salarioSemana: 500, diasSemana: 5 } })).toBeUndefined();
  });

  it("o resumo do índice leva sempre um valor explícito", () => {
    expect(formatoDoResumo(cinemaSemEtiqueta)).toBe("cinema");
    expect(formatoDoResumo(publicidade)).toBe("publicidade");
  });
});
