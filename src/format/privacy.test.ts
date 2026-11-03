import { describe, expect, it } from "vitest";
import { MONEY_MASK, MONEY_PENDING, moneyOrMask, parsePrivacy } from "./privacy";

describe("modo privacidade — o que o dinheiro mostra", () => {
  it("desligado: o valor normal da app", () => {
    // 1234,5 -> 2 casas "1234.50" -> milhares com ponto "1.234", decimais com
    // vírgula ",50", símbolo à frente (identidade dos ecrãs, money.ts)
    expect(moneyOrMask(1234.5, "off")).toBe("€ 1.234,50");
  });

  it("ligado: só a máscara, com o símbolo à frente como o resto da app", () => {
    expect(moneyOrMask(1234.5, "on")).toBe("€ ••••");
    expect(moneyOrMask(10, "on", "CHF")).toBe("CHF ••••");
  });

  it("ligado: a máscara não denuncia a ordem de grandeza", () => {
    // Quatro pontos para 5 € e para 123 milhões: nem o comprimento passa.
    expect(moneyOrMask(5, "on")).toBe(moneyOrMask(123456789, "on"));
    expect(moneyOrMask(0, "on")).toBe(`€ ${MONEY_MASK}`);
  });

  it("ainda por ler: nenhum algarismo, nem a máscara (quem tem o modo desligado não vê pontos a piscar)", () => {
    const v = moneyOrMask(2868.4, "unknown");
    expect(v).toBe(MONEY_PENDING);
    expect(v).not.toMatch(/\d/);
    expect(v).not.toContain(MONEY_MASK);
    // Espaço que não colapsa: a linha mantém a altura enquanto espera
    expect(v.length).toBe(1);
  });

  it("nunca há algarismos com o modo ligado, seja qual for o valor", () => {
    for (const n of [0, 0.01, 99.99, 1000, 2868.4, 1e9, -50]) {
      expect(moneyOrMask(n, "on")).not.toMatch(/\d/);
    }
  });
});

describe("parsePrivacy — o que ficou guardado no aparelho", () => {
  it("só 'on' liga", () => {
    expect(parsePrivacy("on")).toBe("on");
  });

  it("nada guardado (primeira vez) ou valor estranho = desligado, o comportamento de sempre", () => {
    for (const raw of [null, undefined, "", "off", "1", "true", "ON"]) {
      expect(parsePrivacy(raw)).toBe("off");
    }
  });
});
