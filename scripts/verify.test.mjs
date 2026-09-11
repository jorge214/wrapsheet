// scripts/verify.test.mjs
// Testes à comparação do verify.mjs. Não é código da app, mas é o que decide
// se uma tarefa pode dar-se por terminada — e já falhou a sério: na primeira
// vez que o hook Stop correu, bloqueou por um erro que JÁ estava na linha de
// base, só porque o Windows deu "c:" em vez de "C:" na mensagem do tsc.
import { describe, expect, it } from "vitest";
import { compararComBase, contarErros, normalizarErro } from "./verify.mjs";

const ROOT_C = "C:/Users/jorge/app-horas-mobile";
const err = (caminho, linha) =>
  `app/projects/[id].tsx(${linha},25): error TS2345: Argument of type 'import("${caminho}/src/models/project").ProjectState' is not assignable.`;

describe("normalização dos erros do tsc", () => {
  it("a letra da unidade não conta: C: e c: são o mesmo erro", () => {
    // Foi isto que bloqueou o primeiro Stop: a linha de base foi gerada com
    // cwd em "C:" e o hook correu com cwd em "c:".
    expect(normalizarErro(err(ROOT_C, 388), ROOT_C)).toBe(
      normalizarErro(err("c:/Users/jorge/app-horas-mobile", 388), ROOT_C)
    );
  });

  it("o número da linha não conta (o mesmo erro anda para baixo a cada edição)", () => {
    expect(normalizarErro(err(ROOT_C, 388), ROOT_C)).toBe(normalizarErro(err(ROOT_C, 402), ROOT_C));
  });

  it("as barras não contam (Windows vs POSIX)", () => {
    expect(normalizarErro("app\\projects\\x.tsx(1,2): error TS1 x", ROOT_C)).toBe(
      normalizarErro("app/projects/x.tsx(1,2): error TS1 x", ROOT_C)
    );
  });

  it("a raiz do projeto sai do caminho — a linha de base serve noutra máquina", () => {
    const noutra = "/home/jorge/wrapsheet";
    expect(normalizarErro(err(ROOT_C, 388), ROOT_C)).toBe(normalizarErro(err(noutra, 388), noutra));
  });

  it("erros DIFERENTES continuam diferentes", () => {
    expect(normalizarErro("src/a.ts(1,1): error TS2322: Type 'string'", ROOT_C)).not.toBe(
      normalizarErro("src/b.ts(1,1): error TS2322: Type 'string'", ROOT_C)
    );
    expect(normalizarErro("src/a.ts(1,1): error TS2322: Type 'string'", ROOT_C)).not.toBe(
      normalizarErro("src/a.ts(1,1): error TS2345: Type 'string'", ROOT_C)
    );
  });
});

describe("contagem de ocorrências", () => {
  // Sem contagem, tirar o nº da linha juntava dois erros iguais no mesmo
  // ficheiro num só — uma SEGUNDA chamada errada à mesma função passava.
  const um = "src/a.ts(10,1): error TS2345: Argument of type 'X' is not assignable.";
  const outro = "src/a.ts(99,1): error TS2345: Argument of type 'X' is not assignable.";

  it("duas ocorrências do mesmo erro contam duas", () => {
    const m = contarErros([um, outro].join("\n"), ROOT_C);
    expect(m.size).toBe(1);
    expect([...m.values()][0]).toBe(2);
  });

  it("passar de 1 para 2 é erro NOVO (era o buraco)", () => {
    const base = contarErros(um, ROOT_C);
    const agora = contarErros([um, outro].join("\n"), ROOT_C);
    const { apareceram } = compararComBase(agora, base);
    expect(apareceram).toHaveLength(1);
    expect(apareceram[0].novas).toBe(1);
    expect(apareceram[0].antes).toBe(1);
  });

  it("continuar em 1 não é erro novo", () => {
    const base = contarErros(um, ROOT_C);
    const agora = contarErros(outro, ROOT_C); // mesma mensagem, linha diferente
    expect(compararComBase(agora, base).apareceram).toHaveLength(0);
  });

  it("linhas que não são erros do tsc são ignoradas", () => {
    const m = contarErros("a compilar…\nnode_modules/x.d.ts(1,1): error TS1 y\n" + um, ROOT_C);
    expect(m.size).toBe(1);
  });
});

describe("a linha de base só encolhe", () => {
  const a = "src/a.ts(1,1): error TS1: um";
  const b = "src/b.ts(1,1): error TS2: dois";

  it("um erro antigo que desaparece é assinalado (para apertar a base)", () => {
    const base = contarErros([a, b].join("\n"), ROOT_C);
    const agora = contarErros(a, ROOT_C);
    const { apareceram, desapareceram } = compararComBase(agora, base);
    expect(apareceram).toHaveLength(0);
    expect(desapareceram).toHaveLength(1);
    expect(desapareceram[0].menos).toBe(1);
  });

  it("2 → 1 do mesmo erro também conta como encolher", () => {
    const base = contarErros([a, "src/a.ts(50,1): error TS1: um"].join("\n"), ROOT_C);
    const agora = contarErros(a, ROOT_C);
    expect(compararComBase(agora, base).desapareceram[0].menos).toBe(1);
  });

  it("sem mudanças, não há nada a apertar nem a bloquear", () => {
    const base = contarErros([a, b].join("\n"), ROOT_C);
    const agora = contarErros([a, b].join("\n"), ROOT_C);
    const r = compararComBase(agora, base);
    expect(r.apareceram).toHaveLength(0);
    expect(r.desapareceram).toHaveLength(0);
  });
});
