import { describe, expect, it } from "vitest";
import { calcProject } from "../calc/project";
import type { Dia, Tabela } from "../calc/types";
import { buildCinemaEditableDayRowsHtml, buildCinemaEditableSheetHtml, buildCinemaPdfHtml } from "./buildCinemaHtml";
import { buildEditableSheetHtml, editorScript } from "./buildPdfHtml";

// Teste de fumo aos construtores da folha de CINEMA: renderizam sem rebentar
// e o HTML tem as peças que a app e o script do editor esperam encontrar.

function tabela(): Tabela {
  return {
    salarioSemana: 900, diasSemana: 5, horasBase: 10, descansoSemanal_h: 60, multFolga: 2,
    H_dia: 11, descanso_min: 10, limiar_HR: 10, limiar_A: 11, limiar_B: 18,
    multHEA: 1.5, multHEB: 2.0, multHR: 2.5,
    ajudas: { refeicao: 15, viatura: 25, material: 50, telefone: 5, perDiem: 0 },
  };
}
function dia(data: string, inicio: string, fim: string, o: Partial<Dia> = {}): Dia {
  return {
    descricao: "Filmagem", data, continuo: false, inicio, fim, refeicaoTrabalho: "00:00",
    jantarTrabalho: "00:00", meioDia: false, tempoTransporteMin: 0, diaSemTrabalho: false, ...o,
  };
}
const projeto = () => ({
  formato: "cinema" as const,
  perfil: { nome: "Ana", email: "a@b.c", telefone: "91", departamento: "Som", funcao: "Assist", empresa: "", nif: "", iban: "", swift: "" },
  projeto: { titulo: "", folhaTitulo: "", filme: "No Murphy", produtora: "P", nifProdutora: "", semana: "2", mes: 7, ano: 2023 },
  tabela: tabela(),
  fiscal: { IRS_percent: 25, IVA_percent: 23, SS_percent: 5 },
  cinema: { tipoProducao: "Série", proximaSemana: { data: "2023-07-24", inicio: "07:00" } },
  dias: [
    dia("2023-07-17", "09:00", "19:00"),
    dia("2023-07-18", "09:00", "19:00"),
    dia("2023-07-19", "09:00", "20:00"),
    dia("2023-07-20", "07:00", "19:00", { feriado: true }),
    dia("2023-07-21", "07:00", "19:00"),
    dia("2023-07-22", "", "", { descricao: "FOLGA", folga: true }),
    dia("2023-07-23", "", "", { descricao: "FOLGA", folga: true }),
  ],
});

function extraFor(p: ReturnType<typeof projeto>) {
  const pc = calcProject(p);
  return { pc, extra: { fiscal: p.fiscal, cinema: { semana: pc.semana!, info: p.cinema, diasSemana: 5 } } };
}

describe("folha de cinema — editor", () => {
  const p = projeto();
  const { pc, extra } = extraFor(p);
  const html = buildCinemaEditableSheetHtml(
    p.perfil as any, p.projeto as any, p.dias, pc.calc, pc.totais as any, p.tabela as any,
    "notas", "pt", "pt", "EUR", "", "", extra as any
  );

  it("tem as peças que o script partilhado e a app esperam", () => {
    expect(html).toContain('<table class="days">');
    expect(html).toContain('id="wsAddDay"');
    expect(html).toContain('data-c="g_sem"');          // salário à semana
    expect(html).toContain('data-c="g_fsal"');         // tarifas de folga (a dobrar)
    expect(html).toContain('data-c="bss"');            // Seg. Social nos totais
    expect(html).toContain('data-f="SS_percent"');     // SS editável
    expect(html).toContain('data-c="w_hd"');           // descanso entre semanas
    expect(html).toContain('data-f="hrSemanaHoras"');  // override das horas de recuperação
    expect(html).toContain('data-f="proxInicio"');     // linha B: hora de início
    expect(html).toContain('data-f="proxData"');       // linha B: data
    expect(html).toContain('data-f="tipoProducao"');
    expect(html).toContain('data-act="folga"');
    expect(html).toContain('data-act="feriado"');
    expect(html).toContain("ws:toggleFolga");
    // O script do editor é o MESMO da folha de publicidade
    expect(html).toContain(editorScript({ removeDayConfirm: "Remover este dia?" }));
  });

  it("linhas de folga e feriado ficam marcadas; 7 linhas de dias", () => {
    expect(html.split("<tr class=\"").length - 1).toBeGreaterThanOrEqual(7);
    expect(html).toContain("folgaRow");
    expect(html).toContain("feriadoRow");
    expect(html).toContain("restRow");
  });

  it("as linhas soltas (para __wsSetRows) são as mesmas do editor", () => {
    const rows = buildCinemaEditableDayRowsHtml(p.dias, pc.calc, p.tabela as any, "EUR", "pt", "pt");
    expect(html).toContain(rows.trim().slice(0, 200));
    expect(rows.split("<tr").length - 1).toBe(7);
  });
});

describe("folha de cinema — PDF", () => {
  const p = projeto();
  const { pc, extra } = extraFor(p);
  const pdf = buildCinemaPdfHtml(
    p.perfil as any, p.projeto as any, p.dias, pc.calc, pc.totais as any, p.tabela as any,
    "", "pt", "pt", "EUR", "aviso", "", { ...extra, orientation: "landscape" } as any
  );

  it("sem campos editáveis nem script; com totais, SS e descanso entre semanas", () => {
    expect(pdf).not.toContain("contenteditable");
    expect(pdf).not.toContain("<script>");
    expect(pdf).toContain("SEG. SOCIAL");
    // Rótulos pedidos pelo Jorge: "FORMATO" no cabeçalho (não "TIPO") e o
    // retângulo vermelho das tarifas a dobrar chama-se "FERIADO / FOLGAS".
    expect(pdf).toContain("FORMATO:");
    expect(pdf).toContain("FERIADO / FOLGAS");
    expect(pdf).not.toContain("DIA DE FOLGA");
    // A caixa das tarifas a dobrar tem a MESMA estrutura da tabela de cima:
    // título (vermelho), cabeçalhos cinzentos com a recuperação a azul, linha
    // de unidades e valores. Ambas as tabelas trazem "HORA RECUPERAÇÃO".
    expect(pdf).toContain('<th class="folgaTitle"');
    expect((pdf.match(/HORA RECUPERAÇÃO/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(pdf).toContain("FOLGA (HORAS DESCANSO)");
    expect(pdf).toContain("Para 60H");
    expect(pdf).toContain("@page { size: A3 landscape");
    // 60:00 de descanso (05 + 24 + 24 + 07) e nada a cobrar
    expect(pdf).toContain("60:00");
    expect(pc.semana?.HR_valor).toBe(0);
  });

  it("vertical: A4 e escala de fonte", () => {
    const v = buildCinemaPdfHtml(
      p.perfil as any, p.projeto as any, p.dias, pc.calc, pc.totais as any, p.tabela as any,
      "", "en", "uk", "GBP", "", "", { ...extra, orientation: "portrait", fontScale: 1.2 } as any
    );
    expect(v).toContain("@page { size: A4 portrait");
    expect(v).toContain("SOCIAL SECURITY");
    expect(v).toContain("FORMAT:");
    expect(v).toContain("HOLIDAY / DAYS OFF");
  });

  it("todas as línguas renderizam", () => {
    for (const loc of ["pt", "pt-BR", "en", "es", "fr", "de", "it", "nl", "pl"]) {
      const h = buildCinemaPdfHtml(p.perfil as any, p.projeto as any, p.dias, pc.calc, pc.totais as any, p.tabela as any, "", loc, "pt", "EUR", "", "", extra as any);
      expect(h.length).toBeGreaterThan(5000);
    }
  });
});

describe("folha de publicidade continua a usar o script partilhado", () => {
  it("buildEditableSheetHtml inclui editorScript(s)", () => {
    const p = projeto();
    const pc = calcProject({ ...p, formato: undefined } as any);
    const html = buildEditableSheetHtml(p.perfil as any, p.projeto as any, p.dias, pc.calc, pc.totais as any, p.tabela as any, "", "pt", "pt", "EUR", "", "", { fiscal: p.fiscal } as any);
    expect(html).toContain(editorScript({ removeDayConfirm: "Remover este dia?" }));
  });
});
