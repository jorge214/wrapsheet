import { describe, expect, it } from "vitest";
import { lerNumero } from "./numero";

// Os campos numéricos do perfil (lerNumero). Antes: Number(v.replace(",", ".")) || 0
// — o símbolo do euro dava NaN e gravava 0.
describe("número escrito num campo do perfil", () => {
  it("com o símbolo do euro ou espaços: lê o número (antes gravava 0)", () => {
    expect(lerNumero("34,09 €")).toBe(34.09);
    expect(lerNumero("€ 45")).toBe(45);
    expect(lerNumero(" 250 ")).toBe(250);
  });

  it("como sempre: vírgula ou ponto decimais, inteiros, a escrever (\"23,\")", () => {
    expect(lerNumero("23,2")).toBe(23.2);
    expect(lerNumero("1.5")).toBe(1.5);
    expect(lerNumero("300")).toBe(300);
    expect(lerNumero("23,")).toBe(23);
  });

  it("o 0 é um valor (IVA 0 %), não vazio", () => {
    expect(lerNumero("0")).toBe(0);
    expect(lerNumero("0,00 €")).toBe(0);
  });

  it("sem algarismos = vazio (antes: 0)", () => {
    for (const v of ["", "   ", "€", "abc", null, undefined]) expect(lerNumero(v)).toBeUndefined();
  });

  it("um número partido não vira 0 escondido", () => {
    expect(lerNumero("1,2,3")).toBeUndefined();
  });

  it("uma hora escrita como relógio fica VAZIA (não 1900 h): \"19:00\", \"19h00\", \"8h30\"", () => {
    for (const v of ["11:00", "19:00", "19h00", "8h30"]) expect(lerNumero(v)).toBeUndefined();
  });

  it("a unidade e os símbolos só saem das pontas; espaços de milhar saem", () => {
    expect(lerNumero("10 %")).toBe(10);
    expect(lerNumero("12 h")).toBe(12);
    expect(lerNumero("1 250")).toBe(1250);
    expect(lerNumero("1\u00a0250 €")).toBe(1250);
  });
});
