import { beforeEach, describe, expect, it, vi } from "vitest";

// A linha da tabela `entitlements` (servidor) e o direito do RevenueCat no
// próprio aparelho, controlados por cada teste.
let row: any = null;
let rcActive = false;
vi.mock("./supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  },
}));
vi.mock("./purchases", () => ({
  hasActiveEntitlement: async () => rcActive,
}));

const { getMaxProfiles, readServerEntitlement } = await import("./entitlements");

const daqui = (ms: number) => new Date(Date.now() + ms).toISOString();
const DIA = 24 * 60 * 60 * 1000;

beforeEach(() => {
  row = null;
  rcActive = false;
});

describe("getMaxProfiles — a ponte do RevenueCat no aparelho (iOS e Android)", () => {
  it("acabou de pagar e o webhook ainda não escreveu: o RevenueCat no aparelho já dá 10", async () => {
    rcActive = true;
    expect(await getMaxProfiles({ id: "u1" })).toBe(10);
  });

  it("compra de teste na app de produção (a linha nunca chega): o aparelho fica com 10 na mesma", async () => {
    // O RevenueCat conta os direitos de sandbox como ativos no aparelho; é a
    // ponte que deixa o testador usar o plano ali mesmo sem a BD de produção.
    rcActive = true;
    row = null;
    expect(await getMaxProfiles({ id: "u1" })).toBe(10);
  });

  it("sem linha e sem compra: plano gratuito (1 perfil)", async () => {
    expect(await getMaxProfiles({ id: "u1" })).toBe(1);
  });

  it("linha válida no servidor: vale a linha, mesmo sem o RevenueCat", async () => {
    row = { max_profiles: 10, active: true, expires_at: daqui(30 * DIA) };
    expect(await getMaxProfiles({ id: "u1" })).toBe(10);
  });

  it("linha expirada e sem compra no aparelho: volta a 1", async () => {
    row = { max_profiles: 10, active: true, expires_at: daqui(-DIA) };
    expect(await getMaxProfiles({ id: "u1" })).toBe(1);
  });

  it("sem utilizador: 1", async () => {
    rcActive = true;
    expect(await getMaxProfiles(null)).toBe(1);
  });
});

describe("readServerEntitlement — a linha tal como está no servidor", () => {
  it("devolve a linha (para o paywall perceber uma renovação a caminho)", async () => {
    row = { max_profiles: 10, active: true, expires_at: "2026-11-01T00:00:00Z" };
    expect(await readServerEntitlement("u1")).toEqual(row);
  });

  it("sem linha, ou sem utilizador: null", async () => {
    expect(await readServerEntitlement("u1")).toBeNull();
    row = { max_profiles: 10, active: true, expires_at: null };
    expect(await readServerEntitlement("")).toBeNull();
  });
});
