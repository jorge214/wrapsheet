import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { mesDaFolhaCinema, primeiroDiaPublicidade, segundaDaSemana } from "./novaFolha";

// "Hoje" fixo: quarta-feira, 28/10/2026 (meio-dia, para nenhum fuso o empurrar
// para outro dia).
const hoje = dayjs(new Date(2026, 9, 28, 12, 0, 0));
const iso = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD");

describe("1.º dia de uma folha de publicidade nova", () => {
  it("no mês corrente (ou sem mês) nasce hoje", () => {
    expect(primeiroDiaPublicidade(10, 2026, hoje)).toBe("2026-10-28");
    expect(primeiroDiaPublicidade(undefined, undefined, hoje)).toBe("2026-10-28");
  });
  it("criada a ver novembro, nasce em novembro (antes: 28/10 num projeto de novembro)", () => {
    expect(primeiroDiaPublicidade(11, 2026, hoje)).toBe("2026-11-01");
  });
  it("uma folha atrasada de maio nasce em maio", () => {
    expect(primeiroDiaPublicidade(5, 2026, hoje)).toBe("2026-05-01");
  });
  it("o mesmo mês de outro ano não é o mês corrente", () => {
    expect(primeiroDiaPublicidade(10, 2027, hoje)).toBe("2027-10-01");
  });
});

describe("segunda-feira de uma folha de cinema nova", () => {
  it("no mês corrente, a desta semana: qua 28/10 → seg 26/10", () => {
    expect(iso(segundaDaSemana(10, 2026, 0, hoje))).toBe("2026-10-26");
  });
  it("a semana seguinte começa 7 dias depois: seg 02/11", () => {
    expect(iso(segundaDaSemana(10, 2026, 1, hoje))).toBe("2026-11-02");
  });
  it("a um domingo, 'esta semana' é a que acaba nesse domingo", () => {
    const domingo = dayjs(new Date(2026, 10, 1, 12, 0, 0)); // dom 01/11/2026
    expect(iso(segundaDaSemana(11, 2026, 0, domingo))).toBe("2026-10-26");
    expect(iso(segundaDaSemana(11, 2026, 1, domingo))).toBe("2026-11-02");
  });
  it("noutro mês, a 1.ª segunda desse mês (dezembro de 2026 começa a uma terça → seg 07/12)", () => {
    expect(iso(segundaDaSemana(12, 2026, 0, hoje))).toBe("2026-12-07");
    expect(iso(segundaDaSemana(12, 2026, 1, hoje))).toBe("2026-12-14");
  });
  it("um mês que começa a uma segunda usa o próprio dia 1 (fevereiro de 2027)", () => {
    expect(iso(segundaDaSemana(2, 2027, 0, hoje))).toBe("2027-02-01");
  });
});

describe("mês em que fica uma folha de cinema nova", () => {
  it("esta semana: o mês em foco (como sempre)", () => {
    expect(mesDaFolhaCinema(10, 2026, 0, hoje)).toEqual({ mes: 10, ano: 2026 });
    expect(mesDaFolhaCinema(undefined, undefined, 0, hoje)).toEqual({ mes: 10, ano: 2026 });
  });
  it("a semana seguinte, escolhida a 28/10, é a de 02/11 → fica em NOVEMBRO, não em outubro", () => {
    expect(mesDaFolhaCinema(10, 2026, 1, hoje)).toEqual({ mes: 11, ano: 2026 });
    expect(mesDaFolhaCinema(undefined, undefined, 1, hoje)).toEqual({ mes: 11, ano: 2026 });
  });
  it("na última semana de dezembro, a seguinte é de janeiro do ano a seguir", () => {
    const d = dayjs(new Date(2026, 11, 30, 12, 0, 0)); // qua 30/12/2026
    expect(mesDaFolhaCinema(12, 2026, 1, d)).toEqual({ mes: 1, ano: 2027 });
  });
  it("noutro mês, a semana seguinte à 1.ª segunda continua nesse mês", () => {
    expect(mesDaFolhaCinema(12, 2026, 1, hoje)).toEqual({ mes: 12, ano: 2026 });
  });
});
