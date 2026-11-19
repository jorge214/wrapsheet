import { beforeEach, describe, expect, it, vi } from "vitest";

// O nome automático ("Semana de 16 de nov.") precisa do 1.º dia no índice da
// lista (\`inicio\`). Itens antigos não o têm: a leitura do índice vai buscá-lo à
// folha uma vez — senão a mesma folha tinha um nome na lista e outro no ecrã.
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

const { listProjects, createProject, duplicateProjectNextWeek } = await import("./projects");

beforeEach(() => mem.clear());

describe("o 1.º dia no índice da lista", () => {
  it("um item antigo sem \`inicio\` ganha-o da folha (uma vez); sem dias fica \"\"", async () => {
    mem.set("projects:item:A", JSON.stringify({ id: "A", formato: "cinema", projeto: { titulo: "", filme: "" }, dias: [{ data: "2026-11-16" }] }));
    mem.set("projects:item:B", JSON.stringify({ id: "B", projeto: { titulo: "", filme: "" }, dias: [] }));
    mem.set("projects:index:v1", JSON.stringify([
      { id: "A", nome: "", cliente: "", mes: "11/2026", updatedAt: "x" },
      { id: "B", nome: "", cliente: "", mes: "11/2026", updatedAt: "x", formato: "publicidade" },
    ]));
    const l = await listProjects();
    expect(l.find((i) => i.id === "A")).toMatchObject({ inicio: "2026-11-16", formato: "cinema" });
    expect(l.find((i) => i.id === "B")!.inicio).toBe("");
    // gravado: a próxima leitura já não vai às folhas
    expect(JSON.parse(mem.get("projects:index:v1")!).map((i: any) => i.inicio)).toEqual(["2026-11-16", ""]);
  });

  it("uma folha nova e a cópia da semana seguinte têm cada uma o SEU 1.º dia", async () => {
    const id = await createProject({ formato: "cinema", diasSemana: 5 });
    await new Promise((r) => setTimeout(r, 3));
    const id2 = await duplicateProjectNextWeek(id);
    const l = await listProjects();
    const a = l.find((i) => i.id === id)!.inicio!;
    const b = l.find((i) => i.id === id2)!.inicio!;
    expect(a).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 7 dias depois
    expect((Date.parse(b) - Date.parse(a)) / 86_400_000).toBe(7);
  });
});
