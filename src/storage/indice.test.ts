import { beforeEach, describe, expect, it, vi } from "vitest";

// AsyncStorage em memória, assíncrono como o real (cada chamada cede a vez).
const mem = new Map<string, string>();
const tick = () => new Promise((r) => setTimeout(r, 0));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => { await tick(); return mem.has(k) ? mem.get(k)! : null; },
    setItem: async (k: string, v: string) => { await tick(); mem.set(k, v); },
    removeItem: async (k: string) => { await tick(); mem.delete(k); },
    multiGet: async (ks: string[]) => { await tick(); return ks.map((k) => [k, mem.has(k) ? mem.get(k)! : null]); },
    getAllKeys: async () => [...mem.keys()],
  },
}));
vi.mock("../i18n/i18n", () => ({
  default: { t: (k: string, o?: any) => (k === "copy_suffix" ? " (Cópia)" : o?.defaultValue ?? k), language: "pt" },
}));
vi.mock("./profile", () => ({
  getActiveProfile: async () => ({ id: "perfil-1", nome: "Ana" }),
  getProfileById: async () => null,
}));

const { backfillProfileIds, duplicateProject, getProject, listProjects, saveProject } = await import("./projects");

const INDEX = "projects:index:v1";

function projeto(id: string, titulo: string, extra: any = {}) {
  return {
    id, perfil: {}, projeto: { titulo, filme: "", mes: 10, ano: 2026 },
    tabela: { salarioDia: 250, H_dia: 11, descanso_min: 11, ajudas: { refeicao: 0, viatura: 0, material: 0, telefone: 0, perDiem: 0 } },
    fiscal: {}, notas: "", condicoes: "", condTitulo: "", pago: false,
    dias: [{ descricao: "Filmagem", data: "2026-10-12", inicio: "08:00", fim: "18:00" }],
    updatedAt: "2026-10-12T08:00:00.000Z", profileId: "perfil-1",
    ...extra,
  };
}

beforeEach(() => mem.clear());

describe("índice da lista de projetos", () => {
  it("duas gravações ao mesmo tempo não se pisam: os dois títulos ficam na lista", async () => {
    // Era o "Sem nome" dos italianos: a folha grava a cada tecla e o sync grava
    // ao mesmo tempo; a segunda escrita levava a lista lida ANTES da primeira.
    await saveProject(projeto("a", "") as any);
    await saveProject(projeto("b", "") as any);
    await Promise.all([
      saveProject(projeto("a", "ALFA ROMEO") as any),
      saveProject(projeto("b", "CHANEL") as any),
      saveProject(projeto("c", "D&G") as any),
    ]);
    const nomes = Object.fromEntries((await listProjects()).map((i) => [i.id, i.nome]));
    expect(nomes).toEqual({ a: "ALFA ROMEO", b: "CHANEL", c: "D&G" });
  });

  it("gravar devolve a versão carimbada (é essa que vai para a cloud)", async () => {
    const antes = projeto("a", "ALFA ROMEO");
    const gravado = await saveProject(antes as any);
    expect(gravado.updatedAt).not.toBe(antes.updatedAt);
    expect(Date.parse(gravado.updatedAt)).toBeGreaterThan(Date.parse(antes.updatedAt));
    expect(JSON.parse(mem.get("projects:item:a")!).updatedAt).toBe(gravado.updatedAt);
  });

  it("duplicar um projeto com título: a cópia diz (Cópia) no título e na lista", async () => {
    await saveProject(projeto("a", "ALFA ROMEO") as any);
    const novo = await duplicateProject("a");
    const copia = await getProject(novo);
    expect(copia?.projeto.titulo).toBe("ALFA ROMEO (Cópia)");
    const lista = await listProjects();
    expect(lista.find((i) => i.id === novo)?.nome).toBe("ALFA ROMEO (Cópia)");
    expect(lista.find((i) => i.id === "a")?.nome).toBe("ALFA ROMEO");
  });

  it("duplicar um projeto só com filme continua a pôr (Cópia) no filme", async () => {
    await saveProject(projeto("a", "", { projeto: { titulo: "", filme: "SPOT VERÃO", mes: 10, ano: 2026 } }) as any);
    const novo = await duplicateProject("a");
    const copia = await getProject(novo);
    expect(copia?.projeto.filme).toBe("SPOT VERÃO (Cópia)");
    expect((await listProjects()).find((i) => i.id === novo)?.nome).toBe("SPOT VERÃO (Cópia)");
  });

  it("carimbar o perfil nos projetos antigos não lhes muda a data (senão a cópia velha ganhava ao outro aparelho)", async () => {
    await saveProject(projeto("a", "ALFA ROMEO", { profileId: undefined }) as any, { keepTimestamp: true });
    const antes = JSON.parse(mem.get("projects:item:a")!);
    expect(antes.profileId).toBeUndefined();
    await backfillProfileIds();
    const depois = JSON.parse(mem.get("projects:item:a")!);
    expect(depois.profileId).toBe("perfil-1");
    expect(depois.updatedAt).toBe(antes.updatedAt);
  });
});
