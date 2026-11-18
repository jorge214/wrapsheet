import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dia } from "../calc/types";

// O aviso das "horas pagas a 0 €" (storage/taxasZero.ts) nas folhas NOVAS e
// nas CÓPIAS, com o armazenamento verdadeiro (AsyncStorage em memória).
// Contas à mão, região Portugal (H_dia 11, HE-A × 1,5, HE-B × 2, HR × 3) e as
// regras por omissão do perfil (HE-A a partir da 12.ª hora → limiar 11 h;
// HR se o descanso for inferior a 10 h):
//   2/11 das 08:00 às 22:00 = 14 h → 3 h de HE-A
//   3/11 das 06:00 às 16:00 = 10 h → sem extras
//   descanso 22:00 → 06:00 = 8 h → faltam 2 h para as 10 → 2 h de HR
//   salário 220 €/dia → hora 20 € → HE-A 30 €/h, HR 60 €/h
//   salário 250 €/dia → hora 22,7272… € → HR 250 ÷ 11 × 3 = 68,1818… → 68,18 €/h

const mem = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: async (k: string, v: string) => { mem.set(k, v); },
    removeItem: async (k: string) => { mem.delete(k); },
    multiGet: async (ks: string[]) => ks.map((k) => [k, mem.has(k) ? mem.get(k)! : null]),
    multiRemove: async (ks: string[]) => { for (const k of ks) mem.delete(k); },
    getAllKeys: async () => [...mem.keys()],
  },
}));
vi.mock("../i18n/i18n", () => ({
  default: { t: (k: string, o?: any) => o?.defaultValue ?? k, language: "pt" },
}));

const { createProject, duplicateProject, duplicateProjectToProfile, getProject, saveProject } = await import("./projects");
const { calcProject } = await import("../calc/project");
const { avisoTaxasZero, confirmarZeros, editarSalario, zerosConfirmados, zerosSemeados } = await import("./taxasZero");

function dia(data: string, inicio: string, fim: string): Dia {
  return {
    descricao: "Rodagem", data, continuo: false, inicio, refeicaoTrabalho: "00:00", jantarTrabalho: "00:00",
    fim, meioDia: false, tempoTransporteMin: 0, diaSemTrabalho: false,
  };
}
const DIAS = [dia("2026-11-02", "08:00", "22:00"), dia("2026-11-03", "06:00", "16:00")];

function gravaPerfis(perfis: { id: string; fixas: Record<string, number> }[], ativo: string) {
  mem.set(
    "profiles:list:v1",
    JSON.stringify(perfis.map((p) => ({ id: p.id, nome: p.id, email: "", telefone: "", departamento: "", funcao: "", fixas: p.fixas })))
  );
  mem.set("profiles:activeId:v1", ativo);
}
const comDias = (p: any) => ({ ...p, dias: DIAS });
const espera = () => new Promise((r) => setTimeout(r, 3)); // ids = Date.now()

beforeEach(() => mem.clear());

describe("folha NOVA a partir do perfil", () => {
  it("uma taxa a 0 no perfil passa à folha, mas não nasce confirmada: o aviso pergunta (2 h × 60 € = 120 €)", async () => {
    gravaPerfis([{ id: "chefe", fixas: { salarioDia: 220, rateHR: 0 } }], "chefe");
    const f = (await getProject(await createProject({ mes: 11, ano: 2026 })))!;
    expect(f.tabela.rateHR).toBe(0);
    expect(zerosConfirmados(f.tabela as any)).toEqual([]);
    // Com a HR a 0: (220 + 3 × 30) + 220 = 530 €. Automática: + 2 × 60 = 650 €.
    expect(calcProject(comDias(f)).totais.ValorBruto).toBe(530);
    const a = avisoTaxasZero(comDias(f))!;
    expect(a.chaves).toEqual(["rateHR"]);
    expect(a.diferenca).toBe(120);
  });
});

describe("folha NOVA de um perfil SEM salário com a HR a 0", () => {
  it("escrever o salário na folha não tira o 0 do perfil: 530 € e o aviso pergunta (2 h × 60 € = 120 €)", async () => {
    gravaPerfis([{ id: "chefe", fixas: { rateHR: 0 } }], "chefe");
    const f = (await getProject(await createProject({ mes: 11, ano: 2026 })))!;
    expect(Number(f.tabela.salarioDia) || 0).toBe(0);
    expect(f.tabela.rateHR).toBe(0);
    // A folha é desta versão: o 0 veio do perfil, não da semente antiga
    let semeados = zerosSemeados(f.tabela as any);
    expect(semeados).toEqual([]);
    let t: any = f.tabela;
    for (const v of ["2", "22", "220"]) ({ tabela: t, semeados } = editarSalario(t, Number(v), semeados));
    expect(t.rateHR).toBe(0);
    // (220 + 3 × 30) + 220 = 530 €; a HR automática seria 2 × 60 = 120 €
    expect(calcProject(comDias({ ...f, tabela: t })).totais.ValorBruto).toBe(530);
    expect(avisoTaxasZero(comDias({ ...f, tabela: t }))!.diferenca).toBe(120);
  });
});

describe("cópias de uma folha com o \"Está certo assim\"", () => {
  async function folhaConfirmada() {
    gravaPerfis(
      [
        { id: "chefe", fixas: { salarioDia: 220 } },
        { id: "tecnico", fixas: { salarioDia: 250 } }, // sem HR no perfil
      ],
      "chefe"
    );
    const id = await createProject({ mes: 11, ano: 2026 });
    const f = (await getProject(id))!;
    // O chefe não cobra recuperação: HR a 0, confirmada
    await saveProject({ ...f, dias: DIAS, tabela: confirmarZeros({ ...f.tabela, rateHR: 0 } as any, ["rateHR"]) as any });
    await espera();
    return id;
  }

  it("\"Duplicar\" (a mesma pessoa) leva a resposta: o aviso continua calado", async () => {
    const id = await folhaConfirmada();
    const copia = (await getProject(await duplicateProject(id)))!;
    expect(zerosConfirmados(copia.tabela as any)).toEqual(["rateHR"]);
    expect(avisoTaxasZero(comDias(copia))).toBeNull();
  });

  it("\"Duplicar para outro perfil\" NÃO leva a resposta: o técnico é perguntado (2 h × 68,18 € = 136,36 €)", async () => {
    const id = await folhaConfirmada();
    const copia = (await getProject(await duplicateProjectToProfile(id, "tecnico")))!;
    expect(copia.profileId).toBe("tecnico");
    expect(copia.tabela.salarioDia).toBe(250);
    // O 0 passa, como sempre passou (o perfil do técnico não tem HR)…
    expect(copia.tabela.rateHR).toBe(0);
    // …mas a resposta do chefe não
    expect(zerosConfirmados(copia.tabela as any)).toEqual([]);
    const a = avisoTaxasZero(comDias(copia))!;
    expect(a.chaves).toEqual(["rateHR"]);
    expect(a.diferenca).toBe(136.36);
  });
});
