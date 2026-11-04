import { describe, expect, it } from "vitest";
import {
  ANDROID_PACKAGE,
  deleteAccountNote,
  hasPlanOrRenewal,
  isPlayBilling,
  manageInfo,
  nativeStore,
  paywallLegal,
  planLegal,
  playManageUrl,
  playSubscriptionId,
  purchaseErrorKind,
  purchaseOutcome,
  rcKeyFor,
  RENEWAL_GRACE_MS,
  rejectedProfileNotice,
  showsTeamPlan,
  storeAware,
  syncBullet,
  type RcEntitlement,
} from "./storeRules";

const OSES = ["ios", "android", "web"];
const play: RcEntitlement = { store: "PLAY_STORE", productId: "wrapsheet_profiles10:monthly", sandbox: false };
const playTeste: RcEntitlement = { ...play, sandbox: true };
const apple: RcEntitlement = { store: "APP_STORE", productId: "wrapsheet_profiles10_yearly", sandbox: false };
const stripe: RcEntitlement = { store: "STRIPE", productId: "x", sandbox: false };

describe("que loja vende aqui — a ponte e as compras existem no iOS E no Android", () => {
  it("o SDK nativo serve as duas lojas; a web não tem", () => {
    expect(nativeStore("ios")).toBe("app_store");
    expect(nativeStore("android")).toBe("play_store");
    expect(nativeStore("web")).toBeNull();
  });

  it("cada plataforma usa a sua chave; a web nunca tem chave (compra pela Stripe)", () => {
    const keys = { ios: "appl_x", android: "goog_y" };
    expect(rcKeyFor("ios", keys)).toBe("appl_x");
    expect(rcKeyFor("android", keys)).toBe("goog_y");
    expect(rcKeyFor("web", keys)).toBe("");
  });

  it("Android SEM a chave goog_ (hoje): chave vazia -> compras desligadas, como estava", () => {
    expect(rcKeyFor("android", { ios: "appl_x", android: "" })).toBe("");
    // ...e o iOS não depende da chave do Android
    expect(rcKeyFor("ios", { ios: "appl_x", android: "" })).toBe("appl_x");
  });

  it("faturação da Google Play só no Android com compras ligadas", () => {
    expect(isPlayBilling("android", true)).toBe(true);
    expect(isPlayBilling("android", false)).toBe(false);
    expect(isPlayBilling("ios", true)).toBe(false);
    expect(isPlayBilling("web", false)).toBe(false);
  });

  it("textos por loja só no Android", () => {
    expect(storeAware("android")).toBe(true);
    expect(storeAware("ios")).toBe(false);
    expect(storeAware("web")).toBe(false);
  });
});

describe("texto legal do paywall", () => {
  it("iOS: o da App Store, como sempre", () => {
    expect(paywallLegal("ios", true)).toBe("apple");
  });
  it("web: o da Stripe, como sempre", () => {
    expect(paywallLegal("web", false)).toBe("stripe");
  });
  it("Android com compras: o da Google Play (nunca o da App Store)", () => {
    expect(paywallLegal("android", true)).toBe("google");
  });
});

describe("texto legal do cartão de upgrade (ecrã Plano)", () => {
  it("iOS e web: como sempre", () => {
    expect(planLegal("ios", true)).toBe("apple");
    expect(planLegal("ios", false)).toBe("apple");
    expect(planLegal("web", false)).toBe("apple");
  });
  it("Android com compras: Google Play", () => {
    expect(planLegal("android", true)).toBe("google");
  });
  it("Android sem compras: nada (antes mandava cancelar na App Store)", () => {
    expect(planLegal("android", false)).toBeNull();
  });
});

describe("linha 'Sincroniza no …' do paywall", () => {
  it("no Android não fala de iPhone/iPad; iOS e web como sempre", () => {
    expect(syncBullet("android")).toBe("android");
    expect(syncBullet("ios")).toBe("apple");
    expect(syncBullet("web")).toBe("apple");
  });
});

describe("plano mostrado na Conta e nas Definições", () => {
  it("Android: quem tem mais de 1 perfil vê 'Equipa'", () => {
    expect(showsTeamPlan("android", 10)).toBe(true);
    expect(showsTeamPlan("android", 1)).toBe(false);
  });
  it("iOS e web: texto de sempre", () => {
    expect(showsTeamPlan("ios", 10)).toBe(false);
    expect(showsTeamPlan("web", 10)).toBe(false);
  });
});

describe("link do centro de subscrições da Google Play", () => {
  it("o sku é o id da subscrição, sem o plano base", () => {
    expect(playSubscriptionId("wrapsheet_profiles10:monthly")).toBe("wrapsheet_profiles10");
    expect(playSubscriptionId("wrapsheet_profiles10")).toBe("wrapsheet_profiles10");
    expect(playSubscriptionId(undefined)).toBe("");
  });

  it("com produto: abre a subscrição do WrapSheet (sku + package)", () => {
    expect(playManageUrl("wrapsheet_profiles10:monthly")).toBe(
      "https://play.google.com/store/account/subscriptions?sku=wrapsheet_profiles10&package=com.wrapsheet"
    );
    expect(ANDROID_PACKAGE).toBe("com.wrapsheet");
  });

  it("sem produto: a lista de subscrições", () => {
    expect(playManageUrl(null)).toBe("https://play.google.com/store/account/subscriptions");
    expect(playManageUrl("")).toBe("https://play.google.com/store/account/subscriptions");
  });
});

describe("gerir/cancelar o plano (ecrã Plano)", () => {
  it("iOS: o texto de sempre, sem link, venha a compra de onde vier", () => {
    for (const ent of [null, play, apple, stripe]) {
      expect(manageInfo("ios", true, ent)).toEqual({ note: "apple", url: null });
    }
  });

  it("web: o texto de sempre, sem link", () => {
    expect(manageInfo("web", false, null)).toEqual({ note: "apple", url: null });
  });

  it("Android sem compras (sem chave): como estava", () => {
    expect(manageInfo("android", false, null)).toEqual({ note: "elsewhere", url: null });
    // Uma OTA sem a chave goog_ não pode mandar um subscritor da Play à App Store
    expect(manageInfo("android", false, play).note).toBe("google");
    expect(manageInfo("android", false, apple).note).toBe("apple_device");
  });

  it("Android, comprado na Google Play: nota da Play e link para a subscrição", () => {
    expect(manageInfo("android", true, play)).toEqual({
      note: "google",
      url: "https://play.google.com/store/account/subscriptions?sku=wrapsheet_profiles10&package=com.wrapsheet",
    });
  });

  it("Android, comprado no iPhone/iPad: só texto (nunca um link para a Apple)", () => {
    expect(manageInfo("android", true, apple)).toEqual({ note: "apple_device", url: null });
    expect(manageInfo("android", true, { ...apple, store: "MAC_APP_STORE" })).toEqual({ note: "apple_device", url: null });
  });

  it("Android, Stripe/manual/desconhecido: texto neutro, sem link", () => {
    expect(manageInfo("android", true, stripe)).toEqual({ note: "elsewhere", url: null });
    expect(manageInfo("android", true, null)).toEqual({ note: "elsewhere", url: null });
    expect(manageInfo("android", true, { store: "PROMOTIONAL", productId: "", sandbox: false })).toEqual({
      note: "elsewhere",
      url: null,
    });
  });

  it("nunca há link que não seja da Google Play — e só no Android", () => {
    const lojas = ["PLAY_STORE", "APP_STORE", "MAC_APP_STORE", "STRIPE", "PROMOTIONAL", "RC_BILLING", "AMAZON", ""];
    for (const os of OSES) {
      for (const canBuy of [true, false]) {
        for (const store of lojas) {
          const { url } = manageInfo(os, canBuy, { store, productId: "wrapsheet_profiles10:monthly", sandbox: false });
          if (url === null) continue;
          expect(os).toBe("android");
          expect(url.startsWith("https://play.google.com/store/account/subscriptions")).toBe(true);
        }
      }
    }
  });
});

describe("aviso ao apagar a conta", () => {
  it("iOS e web: a confirmação de sempre", () => {
    expect(deleteAccountNote("ios", 10, apple)).toBeNull();
    expect(deleteAccountNote("web", 10, null)).toBeNull();
  });
  it("Android, subscrição da Play: avisa que a Google continua a cobrar", () => {
    expect(deleteAccountNote("android", 10, play)).toBe("google");
  });
  it("Android, plano de outra origem: aviso neutro", () => {
    expect(deleteAccountNote("android", 10, null)).toBe("elsewhere");
    expect(deleteAccountNote("android", 10, apple)).toBe("elsewhere");
  });
  it("Android, plano gratuito: nada a avisar", () => {
    expect(deleteAccountNote("android", 1, null)).toBeNull();
  });
});

describe("depois de pagar", () => {
  it("iOS: sempre 'Plano ativo', como dantes", () => {
    expect(purchaseOutcome("ios", true, false)).toBe("active");
    expect(purchaseOutcome("ios", false, false)).toBe("active");
    expect(purchaseOutcome("ios", false, true)).toBe("active");
  });

  it("Android com a linha já no servidor: 'Plano ativo'", () => {
    expect(purchaseOutcome("android", true, false)).toBe("active");
    expect(purchaseOutcome("android", true, true)).toBe("active"); // build de teste ligada à BD de teste
  });

  it("Android, compra real à espera do webhook: diz a verdade (ativo no aparelho, sobe depois)", () => {
    expect(purchaseOutcome("android", false, false)).toBe("pending_server");
  });

  it("Android, testador de licenças na app de produção: compra de teste, só neste aparelho", () => {
    expect(purchaseOutcome("android", false, true)).toBe("sandbox");
  });
});

describe("erros da compra", () => {
  it("iOS: a mensagem genérica de sempre, seja qual for o código", () => {
    for (const code of ["20", "6", "7", "13", "2", undefined]) {
      expect(purchaseErrorKind("ios", code)).toBe("generic");
    }
  });

  it("Android: pagamento pendente não é erro", () => {
    expect(purchaseErrorKind("android", "20")).toBe("pending");
  });

  it("Android: já comprada nesta conta Google / pertence a outra conta WrapSheet", () => {
    expect(purchaseErrorKind("android", "6")).toBe("already_owned");
    expect(purchaseErrorKind("android", "7")).toBe("in_use");
    expect(purchaseErrorKind("android", "13")).toBe("in_use");
  });

  it("Android: o resto é o erro genérico", () => {
    expect(purchaseErrorKind("android", "2")).toBe("generic");
    expect(purchaseErrorKind("android", undefined)).toBe("generic");
    expect(purchaseErrorKind("android", null)).toBe("generic");
  });
});

describe("o paywall não vende a quem já tem o plano", () => {
  const agora = Date.parse("2026-11-04T12:00:00Z");
  const hora = 60 * 60 * 1000;

  it("mais de 1 perfil (BD, RevenueCat no aparelho ou desbloqueio manual): já tem", () => {
    expect(hasPlanOrRenewal(10, null, agora)).toBe(true);
  });

  it("sem linha, ou linha inativa, ou de 1 perfil: não tem", () => {
    expect(hasPlanOrRenewal(1, null, agora)).toBe(false);
    expect(hasPlanOrRenewal(1, { active: false, max_profiles: 10, expires_at: null }, agora)).toBe(false);
    expect(hasPlanOrRenewal(1, { active: true, max_profiles: 1, expires_at: null }, agora)).toBe(false);
  });

  it("linha ativa que expirou há 1 hora: renovação a caminho, não se vende outra", () => {
    const row = { active: true, max_profiles: 10, expires_at: new Date(agora - hora).toISOString() };
    expect(hasPlanOrRenewal(1, row, agora)).toBe(true);
  });

  it("linha ativa expirada há mais do que a tolerância: já não tem", () => {
    const row = { active: true, max_profiles: 10, expires_at: new Date(agora - RENEWAL_GRACE_MS - hora).toISOString() };
    expect(hasPlanOrRenewal(1, row, agora)).toBe(false);
  });

  it("linha ativa sem expiração: tem", () => {
    expect(hasPlanOrRenewal(1, { active: true, max_profiles: 10, expires_at: null }, agora)).toBe(true);
  });

  it("data inválida: não conta", () => {
    expect(hasPlanOrRenewal(1, { active: true, max_profiles: 10, expires_at: "lixo" }, agora)).toBe(false);
  });
});

describe("perfil recusado pelo servidor (acima do plano)", () => {
  it("quem não comprou, e o iOS: o aviso de sempre", () => {
    expect(rejectedProfileNotice("android", null)).toBe("subscribe");
    expect(rejectedProfileNotice("ios", play)).toBe("subscribe");
  });
  it("Android, já pagou e a BD ainda não confirmou: sobe sozinho", () => {
    expect(rejectedProfileNotice("android", play)).toBe("pending_server");
    expect(rejectedProfileNotice("android", apple)).toBe("pending_server");
  });
  it("Android, compra de teste: fica só neste aparelho (sem mandar subscrever outra vez)", () => {
    expect(rejectedProfileNotice("android", playTeste)).toBe("sandbox");
  });
});
