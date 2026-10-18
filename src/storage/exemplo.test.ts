import { beforeEach, describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: async (k: string, v: string) => { mem.set(k, v); },
    removeItem: async (k: string) => { mem.delete(k); },
    multiGet: async (ks: string[]) => ks.map((k) => [k, mem.has(k) ? mem.get(k)! : null]),
    getAllKeys: async () => [...mem.keys()],
  },
}));
vi.mock("../i18n/i18n", () => ({ default: { t: (k: string, o?: any) => o?.defaultValue ?? k, language: "pt" } }));
vi.mock("./profile", async (orig) => ({ ...(await orig<any>()), getActiveProfile: async () => null, getProfileById: async () => null }));
vi.mock("./appSettings", async (orig) => ({ ...(await orig<any>()), getSettings: async () => ({ region: "pt" }) }));
vi.mock("../lib/supabase", () => ({ supabase: {} }));
vi.mock("../sync/syncService", () => ({ syncProjectToCloud: async () => {} }));

const { montarExemplo, precisaDeExemplo } = await import("./exemplo");
const { createProject, getProject, saveProject } = await import("./projects");
const { calcProject } = await import("../calc/project");

const t = (_k: string, o?: any) => o?.defaultValue ?? _k;
beforeEach(() => mem.clear());

describe("quando criar a folha de exemplo", () => {
  it("só para quem não tem folhas em lado nenhum e ainda não recebeu o exemplo", () => {
    expect(precisaDeExemplo({ jaMarcado: false, locais: 0, naNuvem: 0 })).toBe(true);
  });
  it("nunca a quem já tem folhas na nuvem (aparelho novo, local vazio)", () => {
    expect(precisaDeExemplo({ jaMarcado: false, locais: 0, naNuvem: 3 })).toBe(false);
  });
  it("nunca se a contagem na nuvem falhou (sem rede)", () => {
    expect(precisaDeExemplo({ jaMarcado: false, locais: 0, naNuvem: null })).toBe(false);
  });
  it("nunca duas vezes, nem a quem tem folhas locais", () => {
    expect(precisaDeExemplo({ jaMarcado: true, locais: 0, naNuvem: 0 })).toBe(false);
    expect(precisaDeExemplo({ jaMarcado: false, locais: 1, naNuvem: 0 })).toBe(false);
  });
});

describe("a folha de exemplo", () => {
  it("tem 3 dias com horas extra calculadas e não fica a zeros sem perfil", async () => {
    const id = await createProject();
    const ex = montarExemplo((await getProject(id))!, new Date("2026-10-18T12:00:00Z"), t);
    expect((ex as any).exemplo).toBe(true);
    expect(ex.projeto.titulo).toBe("Exemplo — Spot publicitário");
    expect(ex.dias.map((d) => d.data)).toEqual(["2026-10-15", "2026-10-16", "2026-10-17"]);
    const pc: any = calcProject(ex as any);
    // 250 €/dia; dias de 9 h, 13,5 h e 12,5 h → os dois últimos têm horas extra
    expect(pc.calc[0].totalDia).toBeGreaterThan(250);           // refeição
    expect(pc.calc[1].HEA_min + pc.calc[1].HEB_min).toBeGreaterThan(0);
    expect(pc.calc[2].HEA_min + pc.calc[2].HEB_min).toBeGreaterThan(0);
    expect(pc.totais.ValorBruto).toBeGreaterThan(750);
  });

  it("a marca de exemplo sobrevive a gravar e voltar a ler", async () => {
    const id = await createProject();
    await saveProject(montarExemplo((await getProject(id))!, new Date("2026-10-18T12:00:00Z"), t));
    expect(((await getProject(id)) as any)?.exemplo).toBe(true);
  });

  it("um projeto normal não ganha a marca", async () => {
    const id = await createProject();
    expect(((await getProject(id)) as any)?.exemplo).toBeUndefined();
  });
});
