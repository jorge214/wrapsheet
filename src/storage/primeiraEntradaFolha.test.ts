import { beforeEach, describe, expect, it, vi } from "vitest";

// A folha que a primeira entrada cria tem de pagar EXATAMENTE o que a pessoa
// escreveu: o valor vai para o perfil (perfilInicial) e é o createProject de
// sempre que o leva para a folha. Valores à mão:
//   • publicidade, 250 €/dia, 1 dia das 08:00 às 18:00 (10 h, abaixo das 11 h
//     do dia base) → 250 € brutos, sem horas extra;
//   • cinema, 1250 €/semana de 5 dias, 5 dias das 08:00 às 19:00 (11 h = o dia
//     base) e 2 folgas sem horas → 1250/5 × 5 = 1250 € brutos, sem extras.

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
vi.mock("../i18n/i18n", () => ({
  default: { t: (k: string, o?: any) => o?.defaultValue ?? k, language: "pt" },
}));

const { createProject, getProject } = await import("./projects");
const { setActiveProfileId, upsertProfile } = await import("./profile");
const { perfilInicial } = await import("./passosRegras");
const { calcProject } = await import("../calc/project");

beforeEach(() => mem.clear());

async function primeiraFolha(formato: "publicidade" | "cinema", valor: number) {
  const perfil = await upsertProfile(perfilInicial("perfil-1", { formato, funcao: "Assistente de Câmara", valor }));
  await setActiveProfileId(perfil.id);
  const id = await createProject(formato === "cinema" ? { formato: "cinema", diasSemana: 5 } : {});
  return (await getProject(id))!;
}

describe("a folha criada pela primeira entrada", () => {
  it("publicidade: 250 €/dia → um dia de 10 h vale 250 €", async () => {
    const p = await primeiraFolha("publicidade", 250);
    expect(p.tabela.salarioDia).toBe(250);
    expect(p.perfil.funcao).toBe("Assistente de Câmara");
    expect(p.profileId).toBe("perfil-1");
    expect(p.dias).toHaveLength(1);
    expect(p.dias[0]).toMatchObject({ inicio: "08:00", fim: "18:00" });
    expect(calcProject(p as any).totais.ValorBruto).toBe(250);
  });

  it("cinema: 1250 €/semana → 5 dias de 11 h valem 1250 €", async () => {
    const p = await primeiraFolha("cinema", 1250);
    expect(p.formato).toBe("cinema");
    expect(p.tabela.salarioSemana).toBe(1250);
    expect(p.tabela.diasSemana).toBe(5);
    // sem salário ao dia (a leitura da folha guarda-o como 0): quem manda é a semana
    expect(Number(p.tabela.salarioDia) || 0).toBe(0);
    expect(p.dias.filter((d) => !d.folga)).toHaveLength(5);
    expect(calcProject(p as any).totais.ValorBruto).toBe(1250);
  });
});
