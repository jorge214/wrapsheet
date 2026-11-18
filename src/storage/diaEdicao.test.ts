import { describe, expect, it } from "vitest";
import { editarCampoDia } from "./diaEdicao";

// O feriado de um dia de cinema (região PT) só se re-avalia quando a DATA
// muda de facto. O editor manda a data a cada saída da célula, mesmo sem
// mudança — e desligava um feriado marcado à mão (o dia passava a singelo).
// Datas: 13/06/2026 é Santo António (Lisboa), NÃO é feriado nacional;
// 08/12/2026 é a Imaculada Conceição, feriado nacional.

describe("editar a data de um dia de cinema", () => {
  it("a mesma data (só entrar e sair da célula) mantém o feriado marcado à mão", () => {
    const dia = { data: "2026-06-13", feriado: true };
    expect(editarCampoDia(dia, "data", "2026-06-13", true).feriado).toBe(true);
  });

  it("a mesma data mantém DESLIGADO um feriado nacional desligado à mão", () => {
    const dia = { data: "2026-12-08", feriado: undefined };
    expect(editarCampoDia(dia, "data", "2026-12-08", true).feriado).toBeUndefined();
  });

  it("mudar para um feriado nacional liga-o; mudar para um dia normal desliga-o", () => {
    expect(editarCampoDia({ data: "2026-12-07" }, "data", "2026-12-08", true).feriado).toBe(true);
    expect(editarCampoDia({ data: "2026-12-08", feriado: true }, "data", "2026-12-09", true).feriado).toBeUndefined();
  });

  it("folga, publicidade ou outra região: a data não mexe no feriado", () => {
    expect(editarCampoDia({ data: "2026-12-07", folga: true }, "data", "2026-12-08", true).feriado).toBeUndefined();
    expect(editarCampoDia({ data: "2026-12-07" }, "data", "2026-12-08", false).feriado).toBeUndefined();
  });

  it("outros campos não mexem no feriado", () => {
    expect(editarCampoDia({ data: "2026-06-13", feriado: true }, "fim", "20:00", true)).toEqual({ data: "2026-06-13", feriado: true, fim: "20:00" });
  });
});
