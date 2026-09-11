// scripts/verify.test.mjs
// Testes à NORMALIZAÇÃO do verify.mjs. Não é código da app, mas é o que decide
// se uma tarefa pode dar-se por terminada — e já falhou uma vez a sério: na
// primeira vez que o hook Stop correu, bloqueou por um erro que JÁ estava na
// linha de base, só porque o Windows deu "c:" em vez de "C:" na mensagem do
// tsc. Estes testes existem para isso não voltar a acontecer.
import { describe, expect, it } from "vitest";
import { normalizarErro } from "./verify.mjs";

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
