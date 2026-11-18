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

// O que o servidor responde a cada insert, o que recebeu, e de quem é a sessão
let resposta: { error: any; status?: number } | Error = { error: null, status: 201 };
let sessao: string | null = "A";
const enviados: any[] = [];
vi.mock("./supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: sessao ? { user: { id: sessao } } : null } }) },
    from: () => ({
      insert: async (linhas: any) => {
        if (resposta instanceof Error) throw resposta;
        if (!resposta.error) enviados.push(...(Array.isArray(linhas) ? linhas : [linhas]));
        return resposta;
      },
    }),
  },
}));

const { atrasoSegundos, enviarFilaPdf, linhaExportacao, registarExportacaoPdf, valeRepetir } = await import("./eventos");
const FILA = "eventos:pdf:fila:v1";
const fila = () => JSON.parse(mem.get(FILA) ?? "[]");
const ev = { formato: "cinema" as const, orientacao: "portrait" as const, exemplo: false, folhaId: "f1" };
const REDE = { error: { message: "TypeError: Failed to fetch", code: "" }, status: 0 };

beforeEach(() => {
  mem.clear();
  enviados.length = 0;
  resposta = { error: null, status: 201 };
  sessao = "A";
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
    expect(fila()).toHaveLength(1);
    expect(fila()[0]).toMatchObject({ ...ev, uid: "A" });
    expect(typeof fila()[0].em).toBe("number"); // a hora a que o PDF foi feito
    resposta = { error: null, status: 201 };
    await enviarFilaPdf("A");
    expect(enviados).toHaveLength(1);
    // chega com o tempo que esperou na fila (o relatório recua a hora)
    expect(enviados[0].atraso_s).toBeGreaterThanOrEqual(0);
    expect(mem.has(FILA)).toBe(false);
  });

  it("uma exceção (fetch a rebentar) também vai para a fila — e não sobe", async () => {
    resposta = new Error("network");
    await expect(registarExportacaoPdf("A", ev)).resolves.toBeUndefined();
    expect(fila()).toHaveLength(1);
  });

  it("recusado de vez pelo servidor (400 com code): não se repete", async () => {
    resposta = { error: { message: "check violation", code: "23514" }, status: 400 };
    await registarExportacaoPdf("A", ev);
    expect(mem.has(FILA)).toBe(false);
  });

  it("sessão recusada (401) ou servidor em baixo (5xx): fica na fila", async () => {
    resposta = { error: { message: "JWT expired", code: "PGRST303" }, status: 401 };
    await registarExportacaoPdf("A", ev);
    resposta = { error: { message: "pool", code: "PGRST003" }, status: 504 };
    await registarExportacaoPdf("A", ev);
    expect(fila()).toHaveLength(2);
    // e a fila também não se apaga por estes erros
    await enviarFilaPdf("A");
    expect(fila()).toHaveLength(2);
  });

  it("sem a sessão desta conta (saiu, ou entrou outra): nada sai, fica tudo à espera", async () => {
    sessao = null;
    await registarExportacaoPdf("A", ev);
    expect(enviados).toHaveLength(0);
    expect(fila()).toHaveLength(1);
    sessao = "B"; // entrou outra conta neste aparelho
    await enviarFilaPdf("A");
    expect(enviados).toHaveLength(0);
    expect(fila()).toHaveLength(1);
    sessao = "A";
    await enviarFilaPdf("A");
    expect(enviados).toHaveLength(1);
    expect(mem.has(FILA)).toBe(false);
  });

  it("a fila de outra conta espera por ela", async () => {
    resposta = REDE;
    await registarExportacaoPdf("A", ev);
    sessao = "B";
    await registarExportacaoPdf("B", { ...ev, folhaId: "f2" });
    resposta = { error: null, status: 201 };
    await enviarFilaPdf("B");
    expect(enviados.map((l) => l.folha_id)).toEqual(["f2"]);
    expect(fila().map((x: any) => x.uid)).toEqual(["A"]);
  });

  it("o atraso conta-se em segundos, nunca negativo nem acima de 30 dias", () => {
    expect(atrasoSegundos(1_000_000, 1_090_000)).toBe(90);
    expect(atrasoSegundos(2_000_000, 1_000_000)).toBe(0); // relógio que andou para trás
    expect(atrasoSegundos(0, 40 * 86400 * 1000)).toBe(2592000);
    expect(atrasoSegundos(undefined, 1)).toBeUndefined(); // eventos da fila antiga
    expect(linhaExportacao(ev, 90)).toMatchObject({ atraso_s: 90 });
  });

  it("quando vale a pena repetir", () => {
    expect(valeRepetir(null, 201)).toBe(false);
    expect(valeRepetir({ code: "" }, 0)).toBe(true);
    expect(valeRepetir({ code: "PGRST303" }, 401)).toBe(true);
    expect(valeRepetir({ code: "PGRST003" }, 503)).toBe(true);
    expect(valeRepetir({ code: "23514" }, 400)).toBe(false);
  });

  it("sem conta não faz nada", async () => {
    await registarExportacaoPdf(undefined, ev);
    expect(enviados).toHaveLength(0);
    expect(mem.has(FILA)).toBe(false);
  });
});
