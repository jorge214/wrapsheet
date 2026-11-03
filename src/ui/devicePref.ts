// Preferência DO APARELHO (não da conta), guardada no AsyncStorage e partilhada
// por todos os ecrãs montados.
//
// Porque não um useState + AsyncStorage em cada ecrã: na web os ecrãs empilhados
// ficam MONTADOS por baixo (o Dashboard aberto a partir da página inicial deixa
// a página inicial viva, escondida). Cada um com a sua cópia, ligar o modo
// privacidade num deixava o outro a mostrar valores ao voltar. Aqui o valor vive
// no módulo e cada ecrã subscreve-o (useSyncExternalStore): uma mudança chega a
// todos no mesmo instante.
//
// `get()` devolve undefined enquanto o valor guardado não foi lido — quem usa
// decide o que mostrar nesse intervalo (no modo privacidade: nada, nunca o valor).
//
// A chave não começa por "projects:" nem "profiles:", que é o que o
// clearLocalUserData varre ao mudar de conta: uma preferência do aparelho fica,
// como a língua.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";

export type DevicePref<T extends string> = {
  readonly key: string;
  get(): T | undefined;
  set(v: T): void;
  /** Lê o valor guardado (uma vez só; chamadas seguintes devolvem a mesma promessa). */
  load(): Promise<void>;
  subscribe(fn: () => void): () => void;
};

export function createDevicePref<T extends string>(
  key: string,
  parse: (raw: string | null) => T,
  /** O que vale se o armazenamento não puder ser lido (site data bloqueada, etc.). */
  onReadError: T
): DevicePref<T> {
  let value: T | undefined;
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());

  // A leitura do disco só entra se ninguém escolheu entretanto: um toque no
  // botão antes de a leitura acabar não pode ser desfeito por ela.
  function settle(v: T) {
    if (value !== undefined) return;
    value = v;
    emit();
  }

  const pref: DevicePref<T> = {
    key,
    get: () => value,
    set(v: T) {
      if (value === v) return;
      value = v;
      emit();
      AsyncStorage.setItem(key, v).catch(() => {});
    },
    load() {
      if (!loading) {
        let p: Promise<string | null>;
        try {
          p = AsyncStorage.getItem(key);
        } catch (e) {
          p = Promise.reject(e);
        }
        loading = p.then(
          (raw) => settle(parse(raw)),
          () => settle(onReadError)
        );
      }
      return loading;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };

  // Web: outra aba/PWA aberta muda a preferência -> esta acompanha. O evento
  // "storage" só dispara nas OUTRAS abas, nunca na que gravou. No telemóvel não
  // há window.addEventListener e isto não faz nada.
  const w: any = typeof globalThis !== "undefined" ? (globalThis as any).window : undefined;
  if (w && typeof w.addEventListener === "function") {
    w.addEventListener("storage", (e: any) => {
      if (e?.key !== key || e.newValue == null) return;
      const v = parse(e.newValue);
      if (v === value) return;
      value = v;
      emit();
    });
  }

  return pref;
}

// No servidor (export estático da web) não há aparelho: a página sai sempre no
// estado "ainda não sei", e a hidratação no browser trata do resto.
const noValue = () => undefined;

/** Valor da preferência neste ecrã (undefined = ainda não lido). */
export function useDevicePref<T extends string>(pref: DevicePref<T>): T | undefined {
  const v = useSyncExternalStore(pref.subscribe, pref.get, noValue);
  // Rede de segurança: o módulo de cada preferência já começa a leitura ao ser
  // carregado; isto garante-a mesmo que esse arranque não tenha acontecido.
  useEffect(() => {
    pref.load();
  }, [pref]);
  return v;
}
