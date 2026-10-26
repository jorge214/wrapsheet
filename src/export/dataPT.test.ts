import { describe, expect, it } from "vitest";
import { parseDataPT } from "./dataPT";

describe("data escrita na folha", () => {
  it("aceita o ano com 4 dígitos", () => {
    expect(parseDataPT("16/10/2026")).toBe("2026-10-16");
    expect(parseDataPT("1/2/2026")).toBe("2026-02-01");
  });
  it("aceita o ano com 2 dígitos (como se escreve à mão)", () => {
    expect(parseDataPT("19/10/26")).toBe("2026-10-19");
  });
  it("recusa datas que não existem — antes passavam só por terem a forma certa", () => {
    expect(parseDataPT("23/21/1020")).toBeNull(); // mês 21, ano 1020
    expect(parseDataPT("31/02/2026")).toBeNull();
    expect(parseDataPT("00/10/2026")).toBeNull();
  });
  it("29 de fevereiro só em anos bissextos", () => {
    expect(parseDataPT("29/02/2028")).toBe("2028-02-29");
    expect(parseDataPT("29/02/2027")).toBeNull();
  });
  it("recusa incompletos e lixo", () => {
    expect(parseDataPT("16/10")).toBeNull();
    expect(parseDataPT("")).toBeNull();
    expect(parseDataPT(undefined)).toBeNull();
    expect(parseDataPT("16-10-2026")).toBeNull();
  });
});
