import { beforeEach, describe, expect, it, vi } from "vitest";

// AsyncStorage em memória: o mesmo que o telemóvel/browser guarda, sem aparelho.
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

// O i18n puxa o expo-localization (react-native), que o vitest não lê.
vi.mock("../i18n/i18n", () => ({
  default: { t: (k: string, o?: any) => o?.defaultValue ?? k, language: "pt" },
}));

const { archiveProject, getProject, listArchivedProjects, listProjects, saveProject, unarchiveProject } =
  await import("./projects");

const INDEX = "projects:index:v1";
const ITEM = "projects:item:";

// Folha de cinema de 6 dias tal como ficou em produção depois de passar por um
// aparelho com o código antigo (03/10/2026): sem `formato` nem `cinema`.
function cinemaDespido(id: string) {
  return {
    id, perfil: {}, projeto: { titulo: "Semana 1", mes: 9, ano: 2026 },
    tabela: { salarioDia: 0, salarioSemana: 500, diasSemana: 6, horasBase: 10, descansoSemanal_h: 36, multFolga: 2, H_dia: 11, descanso_min: 10 },
    fiscal: {}, notas: "", condicoes: "", condTitulo: "", pago: false,
    dias: [{ descricao: "Filmagem", data: "2026-09-14", inicio: "08:00", fim: "19:00" }, { descricao: "FOLGA", data: "2026-09-20", inicio: "", fim: "", folga: true }],
    updatedAt: "2026-09-18T18:00:23.927Z",
  };
}
function publicidade(id: string) {
  return {
    id, perfil: {}, projeto: { titulo: "Anúncio", mes: 10, ano: 2026 },
    tabela: { salarioDia: 250, H_dia: 11, descanso_min: 11 },
    fiscal: {}, notas: "", condicoes: "", condTitulo: "", pago: false,
    dias: [{ descricao: "Filmagem", data: "2026-10-03", inicio: "08:00", fim: "18:00" }],
    updatedAt: "2026-10-03T12:47:36.197Z",
  };
}
// Resumo como o escrevia o código antigo (e o arquivar até 03/10): sem formato.
const resumoAntigo = (id: string, mes: string) => ({ id, nome: "", cliente: "", mes, updatedAt: "2026-09-18T18:00:23.927Z" });

beforeEach(() => mem.clear());

describe("formato das folhas no armazenamento", () => {
  it("cinema despido por um aparelho antigo abre como cinema e a tabela fica intacta", async () => {
    mem.set(ITEM + "c1", JSON.stringify(cinemaDespido("c1")));
    const p = await getProject("c1");
    expect(p?.formato).toBe("cinema");
    expect(p?.tabela.salarioSemana).toBe(500);
    expect(p?.tabela.diasSemana).toBe(6);
  });

  it("publicidade continua publicidade", async () => {
    mem.set(ITEM + "p1", JSON.stringify(publicidade("p1")));
    expect((await getProject("p1"))?.formato).toBeUndefined();
  });

  it("índice antigo sem formato: a lista põe cada folha no seu sítio e grava-o", async () => {
    mem.set(ITEM + "c1", JSON.stringify({ ...cinemaDespido("c1"), formato: "cinema" }));
    mem.set(ITEM + "c2", JSON.stringify(cinemaDespido("c2")));
    mem.set(ITEM + "p1", JSON.stringify(publicidade("p1")));
    mem.set(INDEX, JSON.stringify([resumoAntigo("c1", "09/2026"), resumoAntigo("c2", "09/2026"), resumoAntigo("p1", "10/2026")]));

    const l = await listProjects();
    const f = Object.fromEntries(l.map((i) => [i.id, i.formato]));
    expect(f).toEqual({ c1: "cinema", c2: "cinema", p1: "publicidade" });
    // ficou gravado: a próxima leitura já não precisa de abrir as folhas
    const gravado = JSON.parse(mem.get(INDEX)!);
    expect(gravado.map((i: any) => i.formato)).toEqual(["cinema", "cinema", "publicidade"]);
  });

  it("arquivar e desarquivar uma folha de cinema mantém-na em Cinema", async () => {
    await saveProject({ ...cinemaDespido("c1"), formato: "cinema" } as any);
    expect((await listProjects()).find((i) => i.id === "c1")?.formato).toBe("cinema");

    await archiveProject("c1");
    expect(JSON.parse(mem.get("projects:archived:index:v1")!)[0].formato).toBe("cinema");
    expect((await listArchivedProjects())[0].formato).toBe("cinema");

    await unarchiveProject("c1");
    expect(JSON.parse(mem.get(INDEX)!).find((i: any) => i.id === "c1").formato).toBe("cinema");
    expect((await getProject("c1"))?.formato).toBe("cinema");
  });

  it("o sync grava o blob da cloud tal como veio: um cinema despido recupera a etiqueta na folha e na lista", async () => {
    await saveProject(cinemaDespido("c2") as any, { keepTimestamp: true });
    expect(JSON.parse(mem.get(ITEM + "c2")!).formato).toBe("cinema");
    expect(JSON.parse(mem.get(ITEM + "c2")!).updatedAt).toBe("2026-09-18T18:00:23.927Z"); // sem carimbo novo → sem upload
    expect(JSON.parse(mem.get(INDEX)!)[0].formato).toBe("cinema");
  });

  it("gravar uma publicidade não lhe põe formato na folha (apps antigas leem igual)", async () => {
    await saveProject(publicidade("p1") as any);
    expect("formato" in JSON.parse(mem.get(ITEM + "p1")!)).toBe(false);
    expect(JSON.parse(mem.get(INDEX)!)[0].formato).toBe("publicidade");
  });
});
