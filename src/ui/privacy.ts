// Modo privacidade (por aparelho): esconde o dinheiro na página inicial, no
// Dashboard e na lista de projetos. A regra do que se mostra está em
// src/format/privacy.ts; aqui só o estado partilhado e o hook.
import { useCallback } from "react";
import { moneyOrMask, parsePrivacy, type PrivacyState } from "../format/privacy";
import { createDevicePref, useDevicePref } from "./devicePref";

export const privacyPref = createDevicePref<"on" | "off">(
  "ui:privacyMode:v1",
  parsePrivacy,
  // Sem conseguir ler, não há modo guardado que respeitar (também não se
  // conseguiu gravar): mostra os valores, e o botão continua a funcionar.
  "off"
);

// A leitura começa logo que o módulo é carregado (com o primeiro ecrã que o
// importa), não quando o ecrã pede: assim, quando o resumo do mês acaba de
// ler o índice e as folhas — várias leituras, depois da sessão e do perfil
// ativo —, esta leitura única, pedida antes, já voltou. No iOS e no Android o
// AsyncStorage atende numa fila série, por ordem de chegada; na web é o
// localStorage, síncrono por dentro (a promessa resolve no microtask seguinte).
// Quem tem o modo desligado não chega a ver o branco de espera.
if (typeof (globalThis as any).window !== "undefined") privacyPref.load();

export function usePrivacy(): {
  state: PrivacyState;
  /** Modo ligado (só depois de lido). */
  hidden: boolean;
  /** Já se sabe o estado guardado. */
  ready: boolean;
  toggle: () => void;
  /** Dinheiro como este ecrã o deve mostrar agora. */
  money: (n: number, symbol?: string) => string;
} {
  const v = useDevicePref(privacyPref);
  const state: PrivacyState = v ?? "unknown";
  const toggle = useCallback(() => {
    const cur = privacyPref.get();
    if (cur === undefined) return; // ainda a ler: não se adivinha
    privacyPref.set(cur === "on" ? "off" : "on");
  }, []);
  const money = useCallback((n: number, symbol?: string) => moneyOrMask(n, state, symbol), [state]);
  return { state, hidden: state === "on", ready: state !== "unknown", toggle, money };
}
