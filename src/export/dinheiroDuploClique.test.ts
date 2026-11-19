import { describe, expect, it } from "vitest";
import { editorScript, getStrings } from "./buildPdfHtml";

// Duplo clique numa célula de dinheiro do editor (o script injetado, partilhado
// pelas duas folhas). O browser selecionava só uma "palavra" — em "0,00", o
// "00" — e escrever 220 dava "0,220" = 0,22 €. O script volta a selecionar o
// valor TODO, como no primeiro toque.

function correr(ativa: (el: any) => boolean) {
  const code = [...editorScript(getStrings("pt", "pt")).matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  const listeners: Record<string, Function[]> = {};
  const selecionado: any[] = [];
  const document: any = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (t: string, f: Function) => { (listeners[t] ||= []).push(f); },
    documentElement: { style: {}, scrollWidth: 0 }, body: { style: {}, scrollWidth: 0 },
    activeElement: null,
    createRange: () => ({ selectNodeContents: (el: any) => selecionado.push(el) }),
  };
  const win: any = {
    addEventListener: () => {}, innerWidth: 1366, visualViewport: null,
    getSelection: () => ({ removeAllRanges: () => {}, addRange: () => {} }),
  };
  win.parent = win;
  // setTimeout corre já (o script adia a seleção para depois da do browser)
  new Function("window", "document", "screen", "setTimeout", code)(win, document, { width: 1366, height: 900 }, (f: Function) => f());
  return { listeners, selecionado, document, ativa };
}

describe("duplo clique numa célula de dinheiro", () => {
  it("o script ouve o dblclick", () => {
    const { listeners } = correr(() => true);
    expect((listeners.dblclick || []).length).toBe(1);
  });

  it("numa célula de dinheiro em foco: seleciona o valor TODO", () => {
    const { listeners, selecionado, document } = correr(() => true);
    const celula = { classList: { contains: (c: string) => c === "ei" || c === "money" } };
    document.activeElement = celula;
    listeners.dblclick[0]({ target: { closest: (sel: string) => (sel === ".ei.money" ? celula : null) } });
    expect(selecionado).toEqual([celula]);
  });

  it("noutra célula (texto, horas) não mexe na seleção", () => {
    const { listeners, selecionado, document } = correr(() => true);
    document.activeElement = {};
    listeners.dblclick[0]({ target: { closest: () => null } });
    expect(selecionado).toEqual([]);
  });

  it("se a célula já não está em foco, não seleciona", () => {
    const { listeners, selecionado, document } = correr(() => true);
    const celula = {};
    document.activeElement = { outra: true };
    listeners.dblclick[0]({ target: { closest: () => celula } });
    expect(selecionado).toEqual([]);
  });
});
