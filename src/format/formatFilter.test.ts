import { describe, expect, it } from "vitest";
import { avisoFormato, naPasta, noFormato } from "./formatFilter";

// Um mês com tudo o que a lista pode ter:
//   P1, P2  publicidade por pagar
//   C1      cinema por pagar
//   C2      cinema pago (arquivado)
//   L       folha ANTIGA sem `formato` (= publicidade), paga (arquivada)
//   X       publicidade marcada paga mas ainda não arquivada
const P1 = { id: "P1", formato: "publicidade" };
const P2 = { id: "P2", formato: "publicidade" };
const C1 = { id: "C1", formato: "cinema" };
const C2 = { id: "C2", formato: "cinema", archived: true };
const L = { id: "L", archived: true };
const X = { id: "X", formato: "publicidade", pago: true };
const MES = [P1, P2, C1, C2, L, X];
const ids = (arr: { id: string }[]) => arr.map((p) => p.id);

describe("recortes da lista: formato e pasta", () => {
  it("formato: folhas antigas sem formato contam como publicidade", () => {
    expect(ids(noFormato(MES, "cinema"))).toEqual(["C1", "C2"]);
    expect(ids(noFormato(MES, "publicidade"))).toEqual(["P1", "P2", "L", "X"]);
    expect(noFormato(MES, "todos")).toHaveLength(6);
  });

  it("pasta: A Receber exclui arquivados E marcados pagos; Pagos = arquivados", () => {
    expect(ids(naPasta(MES, "areceber"))).toEqual(["P1", "P2", "C1"]);
    expect(ids(naPasta(MES, "arquivados"))).toEqual(["C2", "L"]);
    expect(naPasta(MES, "todos")).toHaveLength(6);
  });
});

describe("aviso de que o formato lembrado esconde projetos", () => {
  it("formato 'Todos' nunca esconde nada", () => {
    expect(avisoFormato(MES, "todos", "todos")).toMatchObject({ escondidos: 0, escondeTudo: false });
    expect(avisoFormato(MES, "todos", "arquivados")).toMatchObject({ escondidos: 0, escondeTudo: false });
  });

  it("Cinema na pasta Todos: à vista C1 e C2, escondidos os 4 de publicidade", () => {
    // 6 do mês - 2 de cinema = 4. O botão mostra o mês todo: 6.
    expect(avisoFormato(MES, "cinema", "todos")).toEqual({
      escondidos: 4,
      escondeTudo: false,
      verTodosN: 6,
      repoePasta: false,
    });
  });

  it("Cinema em A Receber: conta só o que o formato esconde NESTA pasta", () => {
    // A Receber = P1, P2, C1 (X está marcado pago). À vista C1; escondidos P1
    // e P2 = 2. Tirar o formato mantém a pasta e mostra os 3.
    expect(avisoFormato(MES, "cinema", "areceber")).toEqual({
      escondidos: 2,
      escondeTudo: false,
      verTodosN: 3,
      repoePasta: false,
    });
  });

  it("Publicidade em Pagos: a folha antiga sem formato fica à vista", () => {
    // Pagos = C2, L. L é publicidade (sem formato): à vista 1, escondido C2.
    expect(avisoFormato(MES, "publicidade", "arquivados")).toEqual({
      escondidos: 1,
      escondeTudo: false,
      verTodosN: 2,
      repoePasta: false,
    });
  });

  it("Cinema lembrado num mês só de publicidade: esconde tudo", () => {
    // Pasta Todos: os 2 estão nesta pasta, escondidos 2; o botão mostra 2.
    expect(avisoFormato([P1, P2], "cinema", "todos")).toEqual({
      escondidos: 2,
      escondeTudo: true,
      verTodosN: 2,
      repoePasta: false,
    });
  });

  it("Cinema + Pagos num mês só com publicidade por pagar: o botão também repõe a pasta", () => {
    // O caso da revisão: em Pagos não há nada de NENHUM formato (P1 e P2 estão
    // por pagar), por isso tirar só o formato dava lista vazia com "(2)" no
    // botão. Repõe-se a pasta e o 2 é o mês todo (P1, P2).
    expect(avisoFormato([P1, P2], "cinema", "arquivados")).toEqual({
      escondidos: 0,
      escondeTudo: true,
      verTodosN: 2,
      repoePasta: true,
    });
  });

  it("mês vazio: nada escondido, nada a avisar", () => {
    expect(avisoFormato([], "cinema", "todos")).toMatchObject({ escondidos: 0, escondeTudo: false });
  });

  it("o formato não esconde nada quando o mês só tem esse formato", () => {
    expect(avisoFormato([C1, C2], "cinema", "todos")).toMatchObject({ escondidos: 0, escondeTudo: false });
  });
});
