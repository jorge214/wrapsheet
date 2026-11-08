import { describe, expect, it } from "vitest";
import { calcProject } from "../calc/project";
import type { Dia, Tabela } from "../calc/types";
import { buildCinemaEditableDayRowsHtml, buildCinemaEditableSheetHtml } from "./buildCinemaHtml";
import { buildEditableDayRowsHtml, buildEditableSheetHtml, DAY_BTNS_CSS, editorScript, getStrings } from "./buildPdfHtml";

// O script do editor vive dentro de um template literal: um erro de sintaxe
// (ou uma barra de regex comida na interpolação) só se via com a folha aberta
// no telemóvel. Aqui extrai-se o <script> GERADO e prova-se que é JavaScript
// válido, que arranca sem rebentar num DOM mínimo e que traz o "dia em foco"
// (os botões de baixo atuam sobre o dia escolhido, não sempre sobre o último).

const LOCALES: [string, string | undefined][] = [
  ["pt", "pt"], ["pt-BR", undefined], ["en", undefined], ["en", "uk"], ["es", undefined],
  ["fr", undefined], ["de", undefined], ["it", undefined], ["nl", undefined], ["pl", undefined],
];

function scripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

// Corre o script com um "DOM" mínimo (sem tabela): basta para apanhar erros
// de arranque — variável por definir, função chamada antes de existir…
function runInStub(code: string) {
  const listeners: Record<string, Function[]> = {};
  const document = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (t: string, f: Function) => { (listeners[t] ||= []).push(f); },
    documentElement: { style: {} as any, scrollWidth: 0 }, body: { style: {} as any, scrollWidth: 0 },
    activeElement: null,
  };
  const win: any = { addEventListener: () => {}, innerWidth: 390, visualViewport: null };
  win.parent = win;
  new Function("window", "document", "screen", "setTimeout", code)(win, document, { width: 390, height: 844 }, () => 0);
  return { win, listeners };
}

function dia(data: string, o: Partial<Dia> = {}): Dia {
  return {
    descricao: "Filmagem", data, continuo: false, inicio: "08:00", fim: "19:00", refeicaoTrabalho: "13:00",
    jantarTrabalho: "00:00", meioDia: false, tempoTransporteMin: 0, diaSemTrabalho: false, ...o,
  };
}
const perfil = { nome: "Ana", email: "a@b.c", telefone: "91", funcao: "Som", empresa: "", nif: "", iban: "", swift: "" };
const projeto = { titulo: "", folhaTitulo: "", filme: "F", produtora: "P", nifProdutora: "", semana: "1", mes: 10, ano: 2026 };
const dias = [dia("2026-10-12"), dia("2026-10-13"), dia("2026-10-14")];

describe("script do editor (editorScript)", () => {
  it("é JavaScript válido em todas as línguas e arranca sem erros", () => {
    for (const [loc, region] of LOCALES) {
      const all = scripts(editorScript(getStrings(loc, region)));
      expect(all.length).toBe(1);
      expect(() => new Function(all[0])).not.toThrow();
      const { win, listeners } = runInStub(all[0]);
      expect(typeof win.__wsSetRows).toBe("function");
      expect(typeof win.__wsFlush).toBe("function");
      // Sem tabela, __wsSetRows não faz nada (e não rebenta)
      expect(() => win.__wsSetRows("")).not.toThrow();
      expect((listeners.focusin || []).length).toBeGreaterThan(0);
    }
  });

  it("traz o dia em foco: escolha por focusin/click, reapontar e rótulos com a data", () => {
    const js = scripts(editorScript(getStrings("pt", "pt")))[0];
    expect(js).toContain("document.addEventListener('focusin', pickDay, true)");
    expect(js).toContain("document.addEventListener('click', pickDay, true)");
    // e na própria tabela: no iOS o ouvinte no document não torna as células
    // "clicáveis" (horas calculadas, dia da semana não gerariam click)
    expect(js).toContain("dt0.addEventListener('click', pickDay, false)");
    expect(js).toContain("classList.add('curRow')");
    expect(js).toContain("function repoint(cur, before, after)");
    expect(js).toContain("sendDay('dup', targetDay())");
    expect(js).toContain("confirmDel(i)");
    // Duplicar SÓ pela barra: nenhuma linha manda um dupDay por conta própria
    expect(js.split("sendDay('dup'").length - 1).toBe(1);
    // Textos (pt-PT) com o marcador {d} da data e a pergunta antiga como recurso
    expect(js).toContain('"confD":"Remover o dia {d}?"');
    expect(js).toContain('"conf":"Remover este dia?"');
    expect(js).toContain('"delOn":"Remover {d}"');
    expect(js).toContain('"dupOn":"Duplicar {d}"');
    // As barras das regex sobreviveram ao template literal (\D, não D)
    expect(js).toContain("replace(/\\D/g,'')");
    expect(js).not.toContain("replace(/D/g");
  });

  it("cada língua tem as três frases novas, todas com {d}", () => {
    for (const [loc, region] of LOCALES) {
      const s: any = getStrings(loc, region);
      for (const k of ["removeDayConfirmDate", "dupDayOn", "removeDayOn"]) {
        expect(typeof s[k]).toBe("string");
        expect(s[k]).toContain("{d}");
      }
    }
  });
});

describe("botões de dia nas duas folhas", () => {
  const tabelaPub: Tabela = {
    salarioDia: 250, H_dia: 10, descanso_min: 12, limiar_HR: 12, limiar_A: 10, limiar_B: 12,
    multHEA: 1.5, multHEB: 2, multHR: 3, ajudas: { refeicao: 12, viatura: 0, telefone: 0, material: 0, perDiem: 0 },
  } as any;
  const tabelaCin: Tabela = {
    salarioSemana: 900, diasSemana: 5, horasBase: 10, descansoSemanal_h: 60, multFolga: 2,
    H_dia: 11, descanso_min: 10, limiar_HR: 10, limiar_A: 11, limiar_B: 18, multHEA: 1.5, multHEB: 2.0, multHR: 2.5,
    ajudas: { refeicao: 15, viatura: 25, material: 50, telefone: 5, perDiem: 0 },
  } as any;

  const pub = (() => {
    const p = { perfil, projeto, tabela: tabelaPub, fiscal: { IRS_percent: 25, IVA_percent: 23 }, dias };
    const pc = calcProject(p as any);
    return {
      sheet: buildEditableSheetHtml(perfil as any, projeto as any, dias, pc.calc as any, pc.totais as any, tabelaPub as any, "", "pt", "pt", "EUR", "", "", { fiscal: p.fiscal } as any),
      rows: buildEditableDayRowsHtml(dias, pc.calc as any, tabelaPub as any, "EUR", "pt"),
    };
  })();
  const cin = (() => {
    const p = {
      formato: "cinema" as const, perfil, projeto, tabela: tabelaCin, fiscal: { IRS_percent: 25, IVA_percent: 23, SS_percent: 11 },
      cinema: { tipoProducao: "Série", proximaSemana: { data: "2026-10-19", inicio: "07:00" } }, dias,
    };
    const pc = calcProject(p as any);
    const extra = { fiscal: p.fiscal, cinema: { semana: pc.semana!, info: p.cinema, diasSemana: 5 } };
    return {
      sheet: buildCinemaEditableSheetHtml(perfil as any, projeto as any, dias, pc.calc as any, pc.totais as any, tabelaCin as any, "", "pt", "pt", "EUR", "", "", extra as any),
      rows: buildCinemaEditableDayRowsHtml(dias, pc.calc as any, tabelaCin as any, "EUR", "pt", "pt"),
    };
  })();

  for (const [nome, f] of [["publicidade", pub], ["cinema", cin]] as const) {
    it(`${nome}: um caixote com ícone SVG em cada linha (sem duplicar), rótulos na barra, nada no print`, () => {
      // Um caixote por dia, com o índice certo e um nome acessível
      for (let i = 0; i < dias.length; i++) {
        expect(f.rows).toContain(`class="rbtn rdel" role="button" data-act="del" data-i="${i}" title="Remover dia"`);
      }
      expect(f.rows.split('<svg class="ico"').length - 1).toBe(dias.length);
      // O duplicar por linha saiu (não pede confirmação: um toque ao lado do
      // caixote metia um dia pago a mais). Fica só na barra.
      expect(f.rows).not.toContain('data-act="dup"');
      expect(f.sheet).not.toContain('data-act="dup"');
      // Os caracteres antigos (dependiam da fonte do sistema) já não vêm
      expect(f.rows).not.toContain("⧉");
      expect(f.rows).not.toContain("✕");
      // Barra: o texto vive num .dayLbl, que o script reescreve com a data
      expect(f.sheet).toContain('id="wsDupDay"');
      expect(f.sheet).toContain('<span class="dayLbl">Duplicar dia</span>');
      expect(f.sheet).toContain('<span class="dayLbl">Remover dia</span>');
      // Print: botões escondidos e o realce do dia em foco desligado
      expect(f.sheet).toMatch(/@media print \{\s*\.addDayBar, \.rowBtns \{ display: none; \}/);
      expect(f.sheet).toContain("table.days tr.curRow > td, table.days tr.curRow > td:first-child { background-image: none; box-shadow: none; }");
      // Todos os <script> da folha (o do cinema tem dois) são JavaScript válido
      for (const js of scripts(f.sheet)) expect(() => new Function(js)).not.toThrow();
    });
  }

  it("cinema: os interruptores Folga/Feriado têm :active (são alvo de toque no Chromium)", () => {
    // No Chromium um elemento com :active é "alvo de toque"; sem ele, um toque
    // em "Folga" não era alvo nenhum e era desviado para o botão logo acima
    // (na 1.2.3 de teste, o duplicar: um dia a mais na folha, sem pergunta).
    expect(cin.sheet).toMatch(/\.rtog:active \{[^}]+\}/);
    expect(cin.sheet).toMatch(/\.rbtn:active \{[^}]+\}/);
    // O vão entre o caixote e os interruptores é padding do .rowBtns (zona
    // morta para a guarda do toque, ver abaixo), não margem dos interruptores.
    expect(cin.sheet).toContain(".rowBtns { padding-bottom: 16px; }");
    expect(cin.sheet).not.toMatch(/\.rowTogs \{[^}]*margin-top/);
  });
});
// Extrai uma função do script gerado (pelas chavetas) para a testar sozinha.
function extractFn(js: string, header: string): string {
  const start = js.indexOf(header);
  if (start < 0) throw new Error("sem " + header);
  let depth = 0;
  for (let k = js.indexOf("{", start); k < js.length; k++) {
    if (js[k] === "{") depth++;
    else if (js[k] === "}" && --depth === 0) return js.slice(start, k + 1);
  }
  throw new Error("chaveta por fechar em " + header);
}

describe("dia em foco depois de adicionar/duplicar/remover (repoint)", () => {
  // A regra vive no script injetado; corre-se aqui a função TAL COMO SAI na
  // folha. Devolve [índice novo, índice antigo do dia que lá tem de estar]
  // (-1 = dia novo) ou null (= sem dia em foco). Os índices seguem o que
  // handleEditMessage faz: a cópia de um duplicado entra em i+1, um dia novo
  // entra no fim, um dia removido sai e os seguintes sobem um lugar.
  const js = scripts(editorScript(getStrings("pt", "pt")))[0];
  const src = extractFn(js, "function repoint(cur, before, after)");
  type R = [number, number] | null;
  const repoint = (pend: any, cur: number | null, before: number, after: number): R =>
    new Function("pend", `${src}; return repoint;`)(pend)(cur, before, after);

  it("mesmo nº de linhas (folga, feriado, recálculo): o mesmo dia", () => {
    expect(repoint(null, 2, 5, 5)).toEqual([2, 2]);
    expect(repoint(null, null, 5, 5)).toBeNull();
  });

  it("adicionar: o dia novo (entra no fim: 5 linhas → índice 5), com ou sem dia em foco", () => {
    expect(repoint({ act: "add", n: 5 }, 2, 5, 6)).toEqual([5, -1]);
    expect(repoint({ act: "add", n: 5 }, null, 5, 6)).toEqual([5, -1]);
  });

  it("duplicar o dia 1: a cópia entra em 2, por isso o dia 3 passa a 4; o 0 e o 1 ficam", () => {
    const p = { act: "dup", i: 1, n: 5 };
    expect(repoint(p, 3, 5, 6)).toEqual([4, 3]);
    expect(repoint(p, 1, 5, 6)).toEqual([1, 1]);
    expect(repoint(p, 0, 5, 6)).toEqual([0, 0]);
    expect(repoint(p, null, 5, 6)).toBeNull(); // sem foco: a barra continua no último
  });

  it("remover o dia em foco: passa para o dia que lhe ocupou o lugar, nunca para o último", () => {
    // Remover o 2 de 5: o antigo 3 sobe para o lugar 2 → [2, 3]
    expect(repoint({ act: "del", i: 2, n: 5 }, 2, 5, 4)).toEqual([2, 3]);
    // Remover o último (4 de 5): não há seguinte, fica o anterior, o 3 → [3, 3]
    expect(repoint({ act: "del", i: 4, n: 5 }, 4, 5, 4)).toEqual([3, 3]);
  });

  it("remover outro dia: depois dele desce um, antes dele fica", () => {
    const p = { act: "del", i: 2, n: 5 };
    expect(repoint(p, 4, 5, 4)).toEqual([3, 4]);
    expect(repoint(p, 1, 5, 4)).toEqual([1, 1]);
  });

  it("o que não se sabe explicar larga o dia em foco", () => {
    // Linhas novas sem operação desta folha (vieram da outra folha aberta)
    expect(repoint(null, 2, 5, 4)).toBeNull();
    // A operação foi enviada com outro nº de linhas (operações cruzadas)
    expect(repoint({ act: "del", i: 1, n: 6 }, 2, 5, 4)).toBeNull();
    // Contagem que não bate com a operação (adicionar mas ficaram menos)
    expect(repoint({ act: "add", n: 5 }, 2, 5, 4)).toBeNull();
    expect(repoint({ act: "del", i: 1, n: 5 }, 2, 5, 3)).toBeNull();
  });

  it("__wsSetRows confirma a data do dia reapontado e larga-o se não bater", () => {
    expect(js).toContain("old.push(dayDM(j))");
    expect(js).toContain("(r[1] < 0 || dayDM(r[0]) === old[r[1]])");
  });
});

describe("correções da revisão", () => {
  const js = scripts(editorScript(getStrings("pt", "pt")))[0];

  it("folha com um só dia: o Remover não pergunta nada e fica desligado", () => {
    expect(js).toContain("function canDel(){ return dayRows().length > 1; }");
    expect(js).toContain("if(canDel() && confirmDel(i))");
    expect(js).toContain("if(!canDel()) return;");
    expect(js).toContain("delBtn.disabled = one");
    expect(js).toContain("t.classList.add('oneDay')");
    expect(DAY_BTNS_CSS).toContain("table.days.oneDay .rbtn {");
    expect(DAY_BTNS_CSS).toContain(".addDayBar button:disabled {");
  });

  it("um campo fora da tabela larga o dia em foco; os botões não", () => {
    expect(js).toContain("e.type === 'focusin' && curDay !== null && isField(e.target)");
    // isField não aceita <button>: no Android o botão da barra recebe foco
    // antes do click e não pode largar o dia a que se vai aplicar
    expect(extractFn(js, "function isField(el)")).not.toContain("BUTTON");
  });

  it("iOS: ouvinte de touchstart para o :active funcionar; células clicáveis em ecrãs tácteis", () => {
    expect(js).toContain("document.addEventListener('touchstart', function(){}, { passive: true })");
    expect(DAY_BTNS_CSS).toMatch(/@media \(any-pointer: coarse\) \{\s*table\.days td \{ cursor: pointer;/);
  });

  it("caixote: pílula pequena (36x24) por baixo da descrição, que não estica a linha", () => {
    // Era 72x36 a encher a coluna: cada linha ficava com mais do dobro da
    // altura e o Jorge achou-o grande demais (08/11/2026). O alvo grande para
    // remover é o "Remover dd/mm" da barra; os toques reais (CDP) no telemóvel
    // e no iPad foram medidos com este tamanho.
    const m = /\.rbtn \{[^}]*?width: ([^;]+); height: (\d+)px/.exec(DAY_BTNS_CSS)!;
    expect(DAY_BTNS_CSS).toContain("table.days .ei.left { display: block; width: 72px;");
    expect(m[1]).toBe("36px");
    expect(Number(m[2])).toBe(24);
    // Nada de ::after a alargar o toque (desviava toques dos vizinhos)
    expect(DAY_BTNS_CSS).not.toMatch(/\.rbtn[^{]*::?after/);
    // O :active fica: é ele que torna o caixote alvo de toque no Chromium
    expect(DAY_BTNS_CSS).toMatch(/\.rbtn:active \{[^}]+\}/);
  });

  it("inglês: \"Remove day 14/10?\"", () => {
    expect((getStrings("en", undefined) as any).removeDayConfirmDate).toBe("Remove day {d}?");
    expect((getStrings("en", "uk") as any).removeDayConfirmDate).toBe("Remove day {d}?");
  });
});

describe("toque desviado: vale o ponto real do dedo (guarda na window)", () => {
  // No Chromium o click — e o alvo do touchstart — vão para o alvo de toque
  // que o dedo mais cobre. À escala a que a folha abre num telemóvel (~0,3)
  // um toque EM CIMA do caixote do cinema ligava a Folga/Feriado (dia pago a
  // dobrar, sem pergunta). A guarda compara o click com o elementFromPoint do
  // ponto CRU do touchstart. Aqui corre-se o script gerado com um DOM de
  // bolso e disparam-se os ouvintes da window à mão.
  const js = scripts(editorScript(getStrings("pt", "pt")))[0];

  it("está registada na window, em captura, para touchstart e click", () => {
    expect(js).toContain("window.addEventListener('touchstart', function(e){");
    expect(js).toContain("}, { capture: true, passive: true });");
    expect(js).toContain("document.elementFromPoint(raw.x, raw.y)");
    expect(js).toContain("var gap = real ? null : upTo(at, '.rowBtns');");
  });

  type FakeEl = {
    nodeType: 1; tag: string; cls: string[]; attrs: string[]; parent: FakeEl | null; clicks: number; focuses: number;
    closest(sel: string): FakeEl | null; contains(o: FakeEl | null): boolean; click(): void; focus(): void;
  };
  function el(tag: string, cls: string[] = [], parent: FakeEl | null = null, attrs: string[] = []): FakeEl {
    const matches = (e: FakeEl, s: string) =>
      s.startsWith(".") ? e.cls.includes(s.slice(1)) : s.startsWith("[") ? e.attrs.includes(s.slice(1, -1)) : e.tag === s;
    const me: FakeEl = {
      nodeType: 1, tag, cls, attrs, parent, clicks: 0, focuses: 0,
      closest(sel) {
        const want = sel.split(",").map((x) => x.trim());
        for (let e: FakeEl | null = me; e; e = e.parent) if (want.some((w) => matches(e!, w))) return e;
        return null;
      },
      contains(o) { for (let e = o; e; e = e.parent) if (e === me) return true; return false; },
      click() { me.clicks++; },
      focus() { me.focuses++; },
    };
    return me;
  }

  // A célula da descrição de um dia do cinema: descrição, caixote (com o
  // vão por baixo, que é padding do .rowBtns) e os dois interruptores.
  function cell() {
    const td = el("td");
    const desc = el("span", ["ei", "left"], td, ["contenteditable"]);
    const rowBtns = el("span", ["rowBtns"], td);
    const trash = el("span", ["rbtn", "rdel"], rowBtns);
    const ico = el("svg", ["ico"], trash);
    const togs = el("span", ["rowTogs"], td);
    const folga = el("span", ["rtog"], togs);
    const feriado = el("span", ["rtog"], togs);
    return { td, desc, rowBtns, trash, ico, folga, feriado };
  }

  function boot() {
    const win: Record<string, Function[]> = {};
    let under: FakeEl | null = null;
    const document = {
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      addEventListener: () => {}, activeElement: null,
      documentElement: { style: {} as any, scrollWidth: 0 }, body: { style: {} as any, scrollWidth: 0 },
      elementFromPoint: () => under,
    };
    const w: any = { addEventListener: (t: string, f: Function) => { (win[t] ||= []).push(f); }, innerWidth: 390, visualViewport: null };
    w.parent = w;
    new Function("window", "document", "screen", "setTimeout", js)(w, document, { width: 390, height: 844 }, () => 0);
    const touch = (n = 1) => {
      const touches = Array.from({ length: n }, () => ({ clientX: 10, clientY: 20 }));
      for (const f of win.touchstart || []) f({ type: "touchstart", touches });
    };
    // Devolve se o click foi travado (e o preventDefault)
    const click = (target: FakeEl, fingerOn: FakeEl | null) => {
      under = fingerOn;
      const r = { stopped: false, prevented: false };
      const ev = { type: "click", target, stopImmediatePropagation: () => { r.stopped = true; }, preventDefault: () => { r.prevented = true; } };
      for (const f of win.click || []) { f(ev); if (r.stopped) break; }
      return r;
    };
    return { touch, click };
  }

  it("dedo em cima do caixote mas o click foi para a Folga: conta o caixote", () => {
    const g = boot(), c = cell();
    g.touch();
    expect(g.click(c.folga, c.trash)).toEqual({ stopped: true, prevented: true });
    expect(c.trash.clicks).toBe(1);
    expect(c.folga.clicks).toBe(0);
  });

  it("dedo no ícone (svg) do caixote: o caixote, não o Feriado do dia de cima", () => {
    const g = boot(), c = cell(), cima = cell();
    g.touch();
    expect(g.click(cima.feriado, c.ico).stopped).toBe(true);
    expect(c.trash.clicks).toBe(1);
  });

  it("dedo num interruptor e o click no caixote: conta o interruptor", () => {
    const g = boot(), c = cell();
    g.touch();
    expect(g.click(c.trash, c.feriado).stopped).toBe(true);
    expect(c.feriado.clicks).toBe(1);
  });

  it("dedo na descrição: foca a descrição, não liga nada", () => {
    const g = boot(), c = cell();
    g.touch();
    expect(g.click(c.feriado, c.desc).stopped).toBe(true);
    expect(c.desc.focuses).toBe(1);
    expect(c.feriado.clicks + c.trash.clicks).toBe(0);
  });

  it("dedo no vão entre o caixote e os interruptores: não faz nada", () => {
    const g = boot(), c = cell();
    g.touch();
    expect(g.click(c.folga, c.rowBtns)).toEqual({ stopped: true, prevented: true });
    g.touch();
    expect(g.click(c.trash, c.rowBtns).stopped).toBe(true);
    expect(c.folga.clicks + c.trash.clicks + c.desc.focuses).toBe(0);
  });

  it("o resto passa: dedo no próprio alvo, ao lado (célula), rato, dois dedos, toque já gasto", () => {
    const c = cell();
    let g = boot(); g.touch();
    expect(g.click(c.trash, c.ico).stopped).toBe(false);   // dentro do próprio caixote
    g = boot(); g.touch();
    expect(g.click(c.feriado, c.td).stopped).toBe(false);  // mesmo ao lado: fica a escolha do browser
    g = boot();
    expect(g.click(c.folga, c.trash).stopped).toBe(false); // rato: sem touchstart
    g = boot(); g.touch(2);
    expect(g.click(c.folga, c.trash).stopped).toBe(false); // pinça
    g = boot(); g.touch();
    g.click(c.desc, c.desc);                               // o toque gastou-se neste click
    expect(g.click(c.folga, c.trash).stopped).toBe(false);
    expect(c.trash.clicks).toBe(0);
  });
});
