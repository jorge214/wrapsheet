import { describe, expect, it } from "vitest";
import { calcProject } from "../calc/project";
import type { Dia, Tabela } from "../calc/types";
import { buildCinemaEditableSheetHtml, buildCinemaPdfHtml } from "./buildCinemaHtml";
import { buildEditableSheetHtml, buildPdfHtml } from "./buildPdfHtml";

// Rodapé da marca ("Feito com WrapSheet · wrapsheet-app.com", 17/11/2026):
// sai no PDF das duas folhas, ao lado dos totais, na língua da folha, e NUNCA no editor —
// o editor é o ecrã onde o técnico trabalha, não o que vai para a produção.

function dia(data: string, inicio: string, fim: string, o: Partial<Dia> = {}): Dia {
  return {
    descricao: "Filmagem", data, continuo: false, inicio, fim, refeicaoTrabalho: "00:00",
    jantarTrabalho: "00:00", meioDia: false, tempoTransporteMin: 0, diaSemTrabalho: false, ...o,
  };
}
const perfil = { nome: "Ana", email: "a@b.c", telefone: "91", departamento: "Som", funcao: "Assist", empresa: "", nif: "", iban: "", swift: "" };

const pub = () => {
  const tabela: Tabela = { salarioDia: 250, H_dia: 11, descanso_min: 11, limiar_A: 11, limiar_B: 18, limiar_HR: 10 };
  const p = {
    perfil, tabela, fiscal: { IRS_percent: 23, IVA_percent: 23 },
    projeto: { titulo: "", filme: "Spot", produtora: "P", nifProdutora: "", semana: "", mes: 10, ano: 2026 },
    dias: [dia("2026-10-27", "08:00", "19:00"), dia("2026-10-28", "07:00", "21:00")],
  };
  return { p, pc: calcProject(p as any) };
};
const cin = () => {
  const tabela: Tabela = {
    salarioSemana: 1250, diasSemana: 5, horasBase: 10, descansoSemanal_h: 60, multFolga: 2,
    H_dia: 11, descanso_min: 10, limiar_HR: 10, limiar_A: 11, limiar_B: 18, multHEA: 1.5, multHEB: 2, multHR: 2.5,
  };
  const p = {
    formato: "cinema" as const, perfil, tabela, fiscal: { IRS_percent: 23, IVA_percent: 0, SS_percent: 11 },
    projeto: { titulo: "", filme: "Longa", produtora: "P", nifProdutora: "", semana: "1", mes: 10, ano: 2026 },
    cinema: { tipoProducao: "", proximaSemana: { data: "2026-10-19", inicio: "08:00" } },
    dias: [dia("2026-10-12", "08:00", "19:00"), dia("2026-10-13", "08:00", "19:00"), dia("2026-10-17", "", "", { folga: true })],
  };
  const pc = calcProject(p as any);
  return { p, pc, extra: { fiscal: p.fiscal, cinema: { semana: pc.semana!, info: p.cinema, diasSemana: 5 } } };
};

const pubPdf = (locale: string) => {
  const { p, pc } = pub();
  return buildPdfHtml(p.perfil as any, p.projeto as any, p.dias, pc.calc, pc.totais as any, p.tabela as any, "", locale, "pt", "EUR", "", "", { fiscal: p.fiscal } as any);
};

describe("rodapé da marca no PDF", () => {
  it("publicidade: sai no PDF, com o link", () => {
    const html = pubPdf("pt");
    expect(html).toContain('class="wsBrand"');
    expect(html).toContain("Feito com");
    expect(html).toContain('href="https://wrapsheet-app.com"');
    // ao lado dos totais finais (no espaço vazio à esquerda deles)
    expect(html.indexOf('class="wsBrand"')).toBeGreaterThan(html.indexOf('class="endTotals"'));
  });

  it("segue a língua da folha", () => {
    expect(pubPdf("en")).toContain("Made with");
    expect(pubPdf("es")).toContain("Hecho con");
    expect(pubPdf("it")).toContain("Creato con");
  });

  it("cinema: sai no PDF", () => {
    const { p, pc, extra } = cin();
    const html = buildCinemaPdfHtml(p.perfil as any, p.projeto as any, p.dias, pc.calc, pc.totais as any, p.tabela as any, "", "pt", "pt", "EUR", "", "", extra as any);
    expect(html).toContain('class="wsBrand"');
  });

  it("nunca aparece nos editores", () => {
    const a = pub();
    const ed = buildEditableSheetHtml(a.p.perfil as any, a.p.projeto as any, a.p.dias, a.pc.calc, a.pc.totais as any, a.p.tabela as any, "", "pt", "pt", "EUR", "", "", { fiscal: a.p.fiscal } as any);
    const c = cin();
    const edC = buildCinemaEditableSheetHtml(c.p.perfil as any, c.p.projeto as any, c.p.dias, c.pc.calc, c.pc.totais as any, c.p.tabela as any, "", "pt", "pt", "EUR", "", "", c.extra as any);
    expect(ed).not.toContain("wsBrand");
    expect(edC).not.toContain("wsBrand");
  });
});
