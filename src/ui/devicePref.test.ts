import { beforeEach, describe, expect, it, vi } from "vitest";

// AsyncStorage em memória, com uma "porta" para segurar as leituras: assim dá
// para reproduzir o toque no botão que chega ANTES de a leitura do disco voltar.
const mem = new Map<string, string>();
let gate: Promise<void> | null = null;
let reads = 0;
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => {
      reads++;
      if (gate) await gate;
      if (k === "boom") throw new Error("armazenamento bloqueado");
      return mem.has(k) ? mem.get(k)! : null;
    },
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
  },
}));

const { createDevicePref } = await import("./devicePref");
const { parseFormatoFiltro } = await import("./projectsFormatPref");
const { parsePrivacy } = await import("../format/privacy");

beforeEach(() => {
  mem.clear();
  gate = null;
  reads = 0;
});

describe("createDevicePref — preferência do aparelho partilhada pelos ecrãs", () => {
  it("antes de ler não se sabe; sem nada guardado vale o de sempre", async () => {
    const p = createDevicePref("k", parsePrivacy, "off");
    expect(p.get()).toBeUndefined();
    await p.load();
    expect(p.get()).toBe("off");
  });

  it("lê o que ficou guardado", async () => {
    mem.set("k", "on");
    const p = createDevicePref("k", parsePrivacy, "off");
    await p.load();
    expect(p.get()).toBe("on");
  });

  it("o que se escolhe fica gravado: a app reaberta (instância nova) volta igual", async () => {
    const a = createDevicePref("k", parsePrivacy, "off");
    await a.load();
    a.set("on");
    await Promise.resolve(); // o setItem é assíncrono
    expect(mem.get("k")).toBe("on");

    const b = createDevicePref("k", parsePrivacy, "off");
    await b.load();
    expect(b.get()).toBe("on");
  });

  it("um toque antes de a leitura acabar não é desfeito por ela", async () => {
    mem.set("k", "on");
    let open!: () => void;
    gate = new Promise<void>((r) => (open = r));
    const p = createDevicePref("k", parsePrivacy, "off");
    const loading = p.load();
    p.set("off"); // a pessoa decidiu enquanto o disco ainda não respondeu
    open();
    await loading;
    expect(p.get()).toBe("off");
  });

  it("todos os ecrãs subscritos sabem da leitura e de cada mudança, ao mesmo tempo", async () => {
    const p = createDevicePref("k", parsePrivacy, "off");
    const ecraA = vi.fn();
    const ecraB = vi.fn();
    const offA = p.subscribe(ecraA);
    p.subscribe(ecraB);
    await p.load();
    expect(ecraA).toHaveBeenCalledTimes(1);
    expect(ecraB).toHaveBeenCalledTimes(1);

    p.set("on");
    expect(ecraA).toHaveBeenCalledTimes(2);
    expect(ecraB).toHaveBeenCalledTimes(2);

    // Escolher o que já está escolhido não acorda ninguém
    p.set("on");
    expect(ecraB).toHaveBeenCalledTimes(2);

    // Ecrã desmontado deixa de ser avisado
    offA();
    p.set("off");
    expect(ecraA).toHaveBeenCalledTimes(2);
    expect(ecraB).toHaveBeenCalledTimes(3);
  });

  it("leitura que falha vale o valor de recurso (e o botão continua a funcionar)", async () => {
    const p = createDevicePref("boom", parsePrivacy, "off");
    await p.load();
    expect(p.get()).toBe("off");
    p.set("on");
    expect(p.get()).toBe("on");
  });

  it("lê o disco uma vez só, por muitos ecrãs que peçam", async () => {
    const p = createDevicePref("k", parsePrivacy, "off");
    await Promise.all([p.load(), p.load(), p.load()]);
    await p.load();
    expect(reads).toBe(1);
  });
});

describe("parseFormatoFiltro — formato lembrado na lista de projetos", () => {
  it("repõe publicidade e cinema", () => {
    expect(parseFormatoFiltro("publicidade")).toBe("publicidade");
    expect(parseFormatoFiltro("cinema")).toBe("cinema");
    expect(parseFormatoFiltro("todos")).toBe("todos");
  });

  it("nada guardado ou valor desconhecido = Todos, como sempre foi", () => {
    for (const raw of [null, undefined, "", "Cinema", "documentario"]) {
      expect(parseFormatoFiltro(raw)).toBe("todos");
    }
  });
});
