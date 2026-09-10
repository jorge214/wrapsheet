// src/calc/project.ts
// PONTO ÚNICO de cálculo de um projeto: escolhe o motor pelo formato da folha
// (publicidade = como sempre; cinema = descanso semanal + recuperação entre
// semanas + Segurança Social). Quem precisa de números — página do projeto,
// lista, painel, PDF — chama isto e nunca decide o formato por si.
import { calcAllCinema, calcSemanaCinema, type CalcSemana } from "./cinema";
import { calcAll, calcTotals } from "./engine";
import type { CalcDia, Dia, Fiscal, Tabela } from "./types";

export type FormatoFolha = "publicidade" | "cinema";

/** Bloco `cinema` do projeto (só existe em folhas de cinema). */
export type CinemaInfo = {
  /** Telefilme, série, documentário… (texto livre, sai na folha) */
  tipoProducao?: string;
  /** Primeiro dia da semana SEGUINTE (linha B): fecha o descanso entre semanas */
  proximaSemana?: { data?: string; inicio?: string };
  /** Overrides escritos na folha (vazio = automático) */
  hrSemanaHoras?: number;
  hrSemanaValor?: number;
};

export type ProjectLike = {
  formato?: FormatoFolha | string;
  dias: Dia[];
  tabela: Tabela;
  fiscal?: Fiscal | any;
  cinema?: CinemaInfo;
};

export type ProjectTotals = ReturnType<typeof calcTotals>;

export type ProjectCalc = {
  formato: FormatoFolha;
  calc: CalcDia[];
  /** Só em cinema */
  semana?: CalcSemana;
  totais: ProjectTotals;
};

export const isCinema = (p: { formato?: string } | null | undefined): boolean =>
  p?.formato === "cinema";

/** Calcula tudo. `fiscal` opcional sobrepõe o do projeto (a lista/painel
 *  passam um fiscal já normalizado com fallback da Região Fiscal). */
export function calcProject(p: ProjectLike, fiscal?: any): ProjectCalc {
  const f = fiscal ?? p.fiscal ?? {};
  if (isCinema(p)) {
    const calc = calcAllCinema(p.dias, p.tabela);
    const semana = calcSemanaCinema(p.dias, calc, p.tabela, p.cinema?.proximaSemana, {
      hrSemanaHoras: p.cinema?.hrSemanaHoras,
      hrSemanaValor: p.cinema?.hrSemanaValor,
    });
    const totais = calcTotals(calc, f, { extraBruto: semana.HR_valor });
    return { formato: "cinema", calc, semana, totais };
  }
  const calc = calcAll(p.dias, p.tabela);
  return { formato: "publicidade", calc, totais: calcTotals(calc, f) };
}
