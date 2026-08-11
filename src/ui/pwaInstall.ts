// src/ui/pwaInstall.ts
// Captura GLOBAL do evento de instalação da PWA (web).
//
// O browser dispara `beforeinstallprompt` uma vez e, se ninguém o guardar,
// perde-se — não há forma de o pedir outra vez. Antes só o convite (InstallPrompt)
// o escutava, e mesmo esse desistia se o utilizador já tivesse dispensado o
// convite; resultado: quem carregava em "Agora não" ficava sem qualquer maneira
// de instalar. Aqui apanha-se sempre, no arranque, e quem quiser (o convite ou
// as Definições) pergunta a este módulo.
import { Platform } from "react-native";

let deferred: any = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {}
  }
}

if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault(); // impede a barra automática do Chrome; passa a ser nossa
    deferred = e;
    notify();
  });
  // Instalada (por nós ou pelo menu do browser): o evento deixa de valer
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** A app já está a correr instalada (janela própria)? */
export function isStandalone(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
      (window.navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

/** Dá para instalar com um clique? (só Chrome/Edge; e só se ainda não instalada) */
export function canInstall(): boolean {
  return !!deferred && !isStandalone();
}

/** Avisa quando o estado muda (evento chegou, ou app instalada). */
export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Abre o diálogo nativo. Devolve true se o utilizador aceitou instalar. */
export async function promptInstall(): Promise<boolean> {
  const ev = deferred;
  if (!ev) return false;
  try {
    ev.prompt();
    const choice = await ev.userChoice;
    const accepted = choice?.outcome === "accepted";
    if (accepted) deferred = null; // o evento só serve uma vez
    return accepted;
  } catch {
    return false;
  }
}

/** Browser em uso — para dar a instrução certa a quem não tem o botão nativo. */
export function detectBrowser(): "chrome" | "safari" | "firefox" | "other" {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Edg\//.test(ua) || /Chrome\//.test(ua) || /Chromium\//.test(ua) || /CriOS\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}
