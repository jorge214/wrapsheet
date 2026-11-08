// src/ui/InstallPrompt.tsx
// Convite para instalar a app (web only), na língua da app:
//   • PC/Mac (Chrome/Edge): botão "Instalar" nativo (beforeinstallprompt/PWA)
//   • PC/Mac (Safari/Firefox): instruções (Adicionar à Dock / menu do browser)
//   • iPhone/iPad: ecrã inteiro com o botão da App Store
//   • Android: ecrã inteiro com o botão da Google Play (no ar desde 02/11/2026)
// "Agora não" / "Continuar na web" guarda no localStorage e não volta a aparecer.
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { WrapSheetLogo } from "./WrapSheetLogo";
import { canInstall as canInstallPwa, promptInstall, subscribeInstall } from "./pwaInstall";

const DISMISS_KEY = "ws:installPrompt:dismissed:v1";
// Com /pt/: o URL sem país cai na loja dos EUA, onde a app (ainda) não está
// disponível -> dava 404. A página /pt/ abre para toda a gente e o "Obter" no
// iPhone/iPad resolve na loja do próprio utilizador.
const APP_STORE_URL = "https://apps.apple.com/pt/app/id6774636607";
// App publicada na App Store (2026-07): iPhone/iPad passam a ver o convite.
const SHOW_MOBILE_STORE = true;
// Google Play (desde 02/11/2026). O link https abre a app da Play Store no
// Android, também a partir do browser interno do Instagram.
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.wrapsheet";
// Chave PRÓPRIA no Android: quem dispensou o antigo aviso da app web ("Agora
// não") nunca viu a Play Store — esse "não" não vale para a loja.
const DISMISS_KEY_ANDROID = "ws:installPrompt:dismissed:android-play:v1";

type Kind = "ios" | "android" | "desktop";

function detectKind(): Kind {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (/iPhone|iPod/.test(ua)) return "ios";
  // iPadOS diz "Macintosh" mas tem ecrã tátil
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function dismissKeyFor(kind: Kind): string {
  return kind === "android" ? DISMISS_KEY_ANDROID : DISMISS_KEY;
}

// Cada browser instala PWAs de forma diferente (ou não instala) — a instrução
// tem de ser específica, senão manda o utilizador procurar um botão que não existe.
function detectBrowser(): "chrome" | "safari" | "firefox" | "other" {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Edg\//.test(ua) || /Chrome\//.test(ua) || /Chromium\//.test(ua) || /CriOS\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

export function InstallPrompt() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const deferredRef = useRef<any>(null);
  const kindRef = useRef<Kind>("desktop");

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    kindRef.current = detectKind();
    try {
      if (window.localStorage.getItem(dismissKeyFor(kindRef.current))) return;
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        (window.navigator as any).standalone;
      if (standalone) return; // já está instalada
    } catch {
      return;
    }
    if (kindRef.current === "ios" || kindRef.current === "android") {
      // Telemóvel/tablet: a versão web não é otimizada — takeover imediato
      // para a loja (App Store ou Google Play), com escape "Continuar na web",
      // memorizado no localStorage. É o que vê quem toca no link da bio do
      // Instagram.
      if (kindRef.current === "ios" && !SHOW_MOBILE_STORE) return;
      setShow(true);
      return;
    }

    // A captura do evento é global (pwaInstall.ts) — aqui só reagimos ao estado.
    // Antes o listener vivia neste componente e só era registado se o convite
    // não tivesse sido dispensado, pelo que o evento se perdia para sempre.
    const sync = () => {
      if (canInstallPwa()) {
        setCanNative(true);
        setShow(true);
      }
    };
    sync();
    const unsub = subscribeInstall(sync);
    // Browsers sem o evento (Safari/Firefox): mostra na mesma, com instruções
    const timer = setTimeout(() => setShow(true), 3500);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  if (Platform.OS !== "web" || !show) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissKeyFor(kindRef.current), String(Date.now()));
    } catch {}
    setShow(false);
  };

  const installNative = async () => {
    await promptInstall();
    dismiss();
  };

  const kind = kindRef.current;

  // iPhone/iPad e Android: ecrã inteiro — a web não é otimizada para estes
  // aparelhos e a app nativa está na loja. "Continuar na web" fica memorizado.
  if (kind === "ios" || kind === "android") {
    const android = kind === "android";
    return (
      <View
        style={{
          // @ts-ignore — position fixed é web-only
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          backgroundColor: COLORS.bg,
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
        }}
      >
        <View style={{ maxWidth: 420, width: "100%", alignItems: "center" }}>
          <WrapSheetLogo variant="lockup" size="lg" />
          <Text
            style={{
              color: COLORS.text,
              fontWeight: "900",
              fontSize: 24,
              textAlign: "center",
              marginTop: 28,
            }}
          >
            {android
              ? t("install_android_store_title", { defaultValue: "O WrapSheet está na Google Play" })
              : t("install_ios_title", { defaultValue: "O WrapSheet está na App Store" })}
          </Text>
          <Text
            style={{
              color: COLORS.sub,
              fontSize: 15,
              lineHeight: 22,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            {android
              ? t("install_android_store_body", {
                  defaultValue: "No Android, a app é muito melhor do que a versão web. Descarrega-a gratuitamente.",
                })
              : t("install_ios_body", {
                  defaultValue:
                    "No iPhone e no iPad, a app é muito melhor do que a versão web. Descarrega-a gratuitamente.",
                })}
          </Text>

          <Pressable
            onPress={() => {
              window.location.href = android ? PLAY_STORE_URL : APP_STORE_URL;
            }}
            style={({ pressed }) => [
              {
                backgroundColor: COLORS.text,
                borderRadius: 999,
                paddingVertical: 15,
                paddingHorizontal: 28,
                marginTop: 28,
                alignSelf: "stretch",
                alignItems: "center",
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ color: COLORS.bg, fontWeight: "900", fontSize: 16 }}>
              {android
                ? t("install_android_store_cta", { defaultValue: "Descarregar na Google Play" })
                : t("install_ios_cta", { defaultValue: "Descarregar na App Store" })}
            </Text>
          </Pressable>

          <Pressable
            onPress={dismiss}
            hitSlop={8}
            style={({ pressed }) => [{ marginTop: 18, padding: 8 }, pressed && { opacity: 0.7 }]}
          >
            <Text
              style={{
                color: COLORS.sub,
                fontWeight: "700",
                fontSize: 13,
                textDecorationLine: "underline",
              }}
            >
              {t("install_continue_web", { defaultValue: "Continuar na web" })}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Aqui só chega o computador: telemóveis e tablets saem antes, no takeover
  // da loja. (O antigo aviso "Ainda não estamos na Play Store" saiu.)
  const title = t("install_desktop_title", { defaultValue: "Instala o WrapSheet no computador" });
  const body = t("install_desktop_body", { defaultValue: "Usa o WrapSheet como uma aplicação própria, com janela e ícone — sem abrir o browser." });

  return (
    <View
      style={{
        // @ts-ignore — position fixed é web-only
        position: "fixed",
        bottom: 16,
        right: 16,
        maxWidth: 380,
        zIndex: 9999,
        backgroundColor: COLORS.card,
        borderColor: COLORS.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 15 }}>{title}</Text>
      <Text style={{ color: COLORS.sub, fontSize: 13, lineHeight: 19, marginTop: 6 }}>{body}</Text>

      {/* Sem botão nativo: explicar como se instala neste browser. */}
      {!canNative && (
        <Text style={{ color: COLORS.sub, fontSize: 12, lineHeight: 18, marginTop: 8, fontStyle: "italic" }}>
          {detectBrowser() === "safari"
            ? t("install_hint_safari", {
                defaultValue: "No Safari (Mac): menu Ficheiro → Adicionar à Dock. (Precisa de macOS Sonoma ou mais recente.)",
              })
            : detectBrowser() === "firefox"
            ? t("install_hint_firefox", {
                defaultValue: "O Firefox não permite instalar apps web. Usa o Chrome ou o Safari para instalar — ou continua aqui no browser, funciona igual.",
              })
            : t("install_hint_menu", {
                defaultValue: "No menu do browser escolhe “Instalar aplicação” — no Safari do Mac: Ficheiro → Adicionar à Dock.",
              })}
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12, justifyContent: "flex-end", alignItems: "center" }}>
        <Pressable onPress={dismiss} hitSlop={8} style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 10 }, pressed && { opacity: 0.7 }]}>
          <Text style={{ color: COLORS.sub, fontWeight: "800", fontSize: 13 }}>
            {t("install_not_now", { defaultValue: "Agora não" })}
          </Text>
        </Pressable>

        {/* Não há aqui botão de loja: telemóveis e tablets nunca chegam a este
            aviso — saem antes no ecrã inteiro, que já tem o botão da loja. */}
        {canNative && (
          <Pressable
            onPress={installNative}
            style={({ pressed }) => [
              { backgroundColor: COLORS.text, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ color: COLORS.bg, fontWeight: "900", fontSize: 13 }}>
              {t("install_now", { defaultValue: "Instalar" })}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
