import { describe, expect, it } from "vitest";
import {
  dadosIniciais,
  estadoPassos,
  juntarMarcas,
  lerValor,
  MARCA_PASSO_DIA,
  MARCA_PASSO_PDF,
  MARCA_PASSOS_FECHADOS,
  MARCA_PRIMEIRA_ENTRADA,
  patchPerfilDono,
  pedirDadosNaExportacao,
  perfilCompleto,
  perfilFolhaComDados,
  perfilInicial,
  precisaPrimeiraEntrada,
} from "./passosRegras";

// Regras da primeira entrada, dos primeiros passos e dos dados pedidos na 1.ª
// exportação (18/11/2026). O ponto mais delicado é a primeira entrada NUNCA
// aparecer a uma conta que já tem dados (criaria um 2.º perfil que o servidor
// recusa) — e na dúvida, não aparece.

describe("primeira entrada: quando aparece", () => {
  const base = { marcado: false, perfisLocais: 0, folhasLocais: 0, perfisNuvem: 0, folhasNuvem: 0 };
  it("conta sem nada, aqui e na nuvem → aparece", () => {
    expect(precisaPrimeiraEntrada(base)).toBe(true);
  });
  it("já marcada (feita, adiada ou não se aplica) → não", () => {
    expect(precisaPrimeiraEntrada({ ...base, marcado: true })).toBe(false);
  });
  it("com perfil ou folhas neste aparelho → não", () => {
    expect(precisaPrimeiraEntrada({ ...base, perfisLocais: 1 })).toBe(false);
    expect(precisaPrimeiraEntrada({ ...base, folhasLocais: 2 })).toBe(false);
  });
  it("com dados na nuvem que ainda não chegaram (aparelho novo) → não", () => {
    expect(precisaPrimeiraEntrada({ ...base, perfisNuvem: 1 })).toBe(false);
    expect(precisaPrimeiraEntrada({ ...base, folhasNuvem: 5 })).toBe(false);
  });
  it("sem saber o que há na nuvem (sem rede, erro) → não", () => {
    expect(precisaPrimeiraEntrada({ ...base, perfisNuvem: null })).toBe(false);
    expect(precisaPrimeiraEntrada({ ...base, folhasNuvem: null })).toBe(false);
  });
});

describe("primeira entrada: o perfil criado", () => {
  it("publicidade: o valor é o salário AO DIA", () => {
    const p = perfilInicial("p1", { formato: "publicidade", funcao: "  1.º Assistente\nde Câmara ", valor: 250 });
    expect(p.fixas).toEqual({ salarioDia: 250 });
    expect(p.fixasCinema).toBeUndefined();
    expect(p.funcao).toBe("1.º Assistente de Câmara");
    expect(p.nome).toBe(""); // o nome pede-se na 1.ª exportação
  });
  it("cinema: o valor é o salário À SEMANA (5 dias), não ao dia", () => {
    const p = perfilInicial("p2", { formato: "cinema", funcao: "Anotadora", valor: 1250 });
    expect(p.fixasCinema).toEqual({ salarioSemana: 1250 });
    expect(p.fixas).toEqual({});
  });
  it("sem valor (ou inválido) fica por preencher — nunca um valor inventado", () => {
    for (const valor of [undefined, 0, -5, NaN]) {
      const p = perfilInicial("p3", { formato: "publicidade", funcao: "", valor });
      expect(p.fixas).toEqual({});
      expect(p.fixasCinema).toBeUndefined();
    }
  });
});

describe("primeira entrada: ler o valor escrito", () => {
  it.each([
    ["250", 250],
    ["250 €", 250],
    ["250,5", 250.5],
    ["250,50", 250.5],
    ["12.5", 12.5],
    ["1.250", 1250],
    ["1,250", 1250],
    ["1.250,50", 1250.5],
    ["1 250", 1250],
  ])("%s → %s", (txt, n) => {
    expect(lerValor(txt)).toBe(n);
  });
  it("vazio, zero ou texto → por preencher", () => {
    for (const txt of ["", "abc", "0", "0,00", "€"]) expect(lerValor(txt)).toBeUndefined();
  });
});

describe("primeiros passos", () => {
  const nova = { [MARCA_PRIMEIRA_ENTRADA]: "feita" };
  it("quem já usava a app (sem primeira entrada) nunca vê o cartão", () => {
    expect(estadoPassos({}).visivel).toBe(false);
    expect(estadoPassos({ [MARCA_PRIMEIRA_ENTRADA]: "nao_aplica" }).visivel).toBe(false);
  });
  it("conta nova (feita ou adiada) vê o cartão, com 0 de 3", () => {
    expect(estadoPassos(nova)).toMatchObject({ visivel: true, feitos: 0, dia: false, pdf: false, perfil: false });
    expect(estadoPassos({ [MARCA_PRIMEIRA_ENTRADA]: "adiada" }).visivel).toBe(true);
  });
  it("cada passo conta; o perfil precisa de nome, NIF e IBAN", () => {
    const m = { ...nova, [MARCA_PASSO_DIA]: true, [MARCA_PASSO_PDF]: true };
    expect(estadoPassos(m, { nome: "Ana", nif: "123", iban: "" }).feitos).toBe(2);
    expect(estadoPassos(m, { nome: "Ana", nif: "123", iban: "PT50" })).toMatchObject({ feitos: 3, perfil: true });
  });
  it("fechado → não aparece mais", () => {
    expect(estadoPassos({ ...nova, [MARCA_PASSOS_FECHADOS]: true }).visivel).toBe(false);
  });
  it("perfil completo ignora espaços", () => {
    expect(perfilCompleto({ nome: " ", nif: "1", iban: "2" })).toBe(false);
    expect(perfilCompleto(null)).toBe(false);
  });
  it("as marcas da conta somam as locais (sem rede) às dos metadados", () => {
    const m = juntarMarcas({ [MARCA_PASSO_PDF]: true, [MARCA_PASSO_DIA]: false }, { [MARCA_PASSO_DIA]: true, [MARCA_PRIMEIRA_ENTRADA]: "feita" });
    expect(m[MARCA_PASSO_PDF]).toBe(true);
    expect(m[MARCA_PASSO_DIA]).toBe(true); // um false nos metadados não apaga o feito local
    expect(m[MARCA_PRIMEIRA_ENTRADA]).toBe("feita");
  });
});

describe("dados pedidos na primeira exportação", () => {
  const nova = { [MARCA_PRIMEIRA_ENTRADA]: "feita" };
  it("depois do 1.º PDF a sério nunca mais se pedem", () => {
    expect(pedirDadosNaExportacao({}, { ...nova, [MARCA_PASSO_PDF]: true })).toBe(false);
  });
  it("folha sem nome → pede-se a qualquer conta", () => {
    expect(pedirDadosNaExportacao({ nome: "" }, {})).toBe(true);
  });
  it("conta nova: pede-se se faltar o NIF ou o IBAN", () => {
    expect(pedirDadosNaExportacao({ nome: "Ana", nif: "", iban: "PT50" }, nova)).toBe(true);
    expect(pedirDadosNaExportacao({ nome: "Ana", nif: "123", iban: "PT50" }, nova)).toBe(false);
  });
  it("quem já usava a app e tem nome nunca é incomodado", () => {
    expect(pedirDadosNaExportacao({ nome: "Ana", nif: "", iban: "" }, {})).toBe(false);
  });
  it("o formulário começa com a folha, depois o perfil, e o email da conta", () => {
    const d = dadosIniciais({ nome: "Ana Folha", nif: "" }, { nome: "Ana Perfil", nif: "123", iban: "PT50" }, "ana@x.pt");
    expect(d).toEqual({ nome: "Ana Folha", email: "ana@x.pt", telefone: "", nif: "123", iban: "PT50" });
  });
  it("a folha leva o que está no formulário, numa linha, e mantém o resto", () => {
    const folha = { nome: "", funcao: "Grip", empresa: "X Lda", nif: "" };
    const out = perfilFolhaComDados(folha, { nome: " Ana\nRibeiro ", email: "a@x.pt", telefone: "", nif: "123", iban: "PT50" });
    expect(out).toMatchObject({ nome: "Ana Ribeiro", funcao: "Grip", empresa: "X Lda", nif: "123", iban: "PT50", email: "a@x.pt" });
  });
  it("o perfil só ganha os campos VAZIOS — nunca se troca o que existe", () => {
    const patch = patchPerfilDono({ nome: "Ana", email: "", nif: "999" }, { nome: "Outra", email: "a@x.pt", telefone: "", nif: "123", iban: "PT50" });
    expect(patch).toEqual({ email: "a@x.pt", iban: "PT50" });
  });
});
