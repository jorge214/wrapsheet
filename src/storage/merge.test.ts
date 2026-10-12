import { describe, expect, it } from "vitest";
import { aplicarEdicaoSobre, guardadoMaisRecente } from "./merge";

// Cenário dos italianos (12/10/2026): a PWA no Dock do Mac tem o projeto
// aberto (sem título); no iPhone dão-lhe nome e horas; o sync descarrega isso
// para o Mac sem o ecrã dar por ela; a primeira tecla no Mac gravava a cópia
// velha inteira por cima.
const carregado = {
  id: "1", updatedAt: "2026-10-12T08:00:00.000Z",
  projeto: { titulo: "", mes: 10, ano: 2026 },
  dias: [{ data: "2026-10-12", inicio: "08:00", fim: "18:00" }],
  notas: "",
};
const guardado = {
  id: "1", updatedAt: "2026-10-12T08:30:00.000Z",
  projeto: { titulo: "ALFA ROMEO", mes: 10, ano: 2026 },
  dias: [{ data: "2026-10-12", inicio: "07:00", fim: "21:30" }, { data: "2026-10-13", inicio: "08:00", fim: "19:00" }],
  notas: "",
};

describe("edição sobre uma versão que ficou velha", () => {
  it("sabe quando o armazenamento tem uma versão mais recente do que a carregada", () => {
    expect(guardadoMaisRecente(carregado, guardado)).toBe(true);
    expect(guardadoMaisRecente(guardado, carregado)).toBe(false);
    expect(guardadoMaisRecente(carregado, { ...guardado, updatedAt: carregado.updatedAt })).toBe(false);
    expect(guardadoMaisRecente(carregado, null)).toBe(false);
  });

  it("uma nota escrita no Mac entra por cima da versão do iPhone sem apagar o título nem as horas", () => {
    const editado = { ...carregado, notas: "Pagar até dia 30" };
    const out = aplicarEdicaoSobre(carregado, editado, guardado);
    expect(out.notas).toBe("Pagar até dia 30");
    expect(out.projeto.titulo).toBe("ALFA ROMEO");
    expect(out.dias).toHaveLength(2);
    expect(out.dias[0].fim).toBe("21:30");
  });

  it("o que o utilizador mudou AGORA ganha, mesmo que o outro aparelho tenha mexido no mesmo bloco", () => {
    const editado = { ...carregado, projeto: { ...carregado.projeto, titulo: "D&G" } };
    const out = aplicarEdicaoSobre(carregado, editado, guardado);
    expect(out.projeto.titulo).toBe("D&G");
    expect(out.dias).toHaveLength(2); // o bloco não tocado vem da versão guardada
  });

  it("não mexe no id nem no carimbo (quem carimba é o saveProject)", () => {
    const editado = { ...carregado, id: "x", updatedAt: "2030-01-01T00:00:00.000Z", notas: "a" };
    const out = aplicarEdicaoSobre(carregado, editado, guardado);
    expect(out.id).toBe("1");
    expect(out.updatedAt).toBe(guardado.updatedAt);
  });

  it("sem diferenças, devolve a versão guardada tal e qual", () => {
    expect(aplicarEdicaoSobre(carregado, { ...carregado }, guardado)).toEqual(guardado);
  });
});
