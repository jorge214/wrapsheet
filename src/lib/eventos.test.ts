import { beforeEach, describe, expect, it, vi } from "vitest";

// Registo das exportações de PDF (lib/eventos.ts): nunca atrapalha o export,
// sem rede guarda numa fila, e a fila só sai com a sessão da conta dona de
// cada evento (o servidor regista sempre a conta da sessão).

const mem = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: async (k: string, v: string) => { mem.set(k, v); },
    removeItem: async (k: string) => { mem.delete(k); },
  },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

// O que o servidor responde a cada insert, e o que recebeu
let resposta: { error: any } | Error = { error: null };
const enviados: any[] = [];
vi.mock("./supabase", () => ({
  supabase: {
    from: () => ({
      insert: async (linhas: any) => {
        if (resposta instanceof Error) throw resposta;
        if (!resposta.error) enviados.push(...(Array.isArray(linhas) ? linhas : [linhas]));
        return resposta;
      },
    }),
  },
}));

const { enviarFilaPdf, linhaExportacao, registarExportacaoPdf } = await import("./eventos");
const FILA = "eventos:pdf:fila:v1";
const fila = () => JSON.parse(mem.get(FILA) ?? "[]");
const ev = { formato: "cinema" as const, orientacao: "portrait" as const, exemplo: false, folhaId: "f1" };
const REDE = { error: { message: "TypeError: Failed to fetch", code: "" } };

beforeEach(() => {
  mem.clear();
  enviados.length = 0;
  resposta = { error: null };
});

describe("registo das exportações de PDF", () => {
  it("a linha leva só as colunas que o cliente pode escrever (nunca o user_id)", () => {
    expect(linhaExportacao(ev)).toEqual({ formato: "cinema", orientacao: "portrait", plataforma: "ios", exemplo: false, folha_id: "f1" });
  });

  it("com rede: vai direto, nada fica na fila", async () => {
    await registarExportacaoPdf("A", ev);
    expect(enviados).toHaveLength(1);
    expect(mem.has(FILA)).toBe(false);
  });

  it("sem rede: fica na fila com a conta, e segue na sincronização", async () => {
    resposta = REDE;
    await registarExportacaoPdf("A", ev);
    expect(fila()).toEqual([{ ...ev, uid: "A" }]);
    resposta = { error: null };
    await enviarFilaPdf("A");
    expect(enviados).toHaveLength(1);
    expect(mem.has(FILA)).toBe(false);
  });

  it("uma exceção (fetch a rebentar) também vai para a fila — e não sobe", async () => {
    resposta = new Error("network");
    await expect(registarExportacaoPdf("A", ev)).resolves.toBeUndefined();
    expect(fila()).toHaveLength(1);
  });

  it("recusado pelo servidor (tem code): não se repete", async () => {
    resposta = { error: { message: "permission denied", code: "42501" } };
    await registarExportacaoPdf("A", ev);
    expect(mem.has(FILA)).toBe(false);
  });

  it("a fila de outra conta espera por ela", async () => {
    resposta = REDE;
    await registarExportacaoPdf("A", ev);
    await registarExportacaoPdf("B", { ...ev, folhaId: "f2" });
    resposta = { error: null };
    await enviarFilaPdf("B");
    expect(enviados.map((l) => l.folha_id)).toEqual(["f2"]);
    expect(fila().map((x: any) => x.uid)).toEqual(["A"]);
  });

  it("sem conta não faz nada", async () => {
    await registarExportacaoPdf(undefined, ev);
    expect(enviados).toHaveLength(0);
    expect(mem.has(FILA)).toBe(false);
  });
});
