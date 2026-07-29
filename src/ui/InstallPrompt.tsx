// src/ui/InstallPrompt.tsx
// Convite para instalar a app (web only), na língua da app:
//   • PC/Mac (Chrome/Edge): botão "Instalar" nativo (beforeinstallprompt/PWA)
//   • PC/Mac (Safari/Firefox): instruções (Adicionar à Dock / menu do browser)
//   • Telemóvel via web: link para a App Store — DESLIGADO até a app estar
//     publicada (SHOW_MOBILE_STORE), para não apontar para uma página 404.
// "Agora não" guarda no localStorage e não volta a aparecer.
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { WrapSheetLogo } from "./WrapSheetLogo";

const DISMISS_KEY = "ws:installPrompt:dismissed:v1";
const APP_STORE_URL = "https://apps.apple.com/app/id6774636607";
// App publicada na App Store (2026-07): iPhone/iPad passam a ver o convite.
// (Android continua sem loja — suprimido à parte, ver useEffect.)
const SHOW_MOBILE_STORE = true;

type Kind = "ios" | "android" | "desktop";

function detectKind(): Kind {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (/iPhone|iPod/.test(ua)) return "ios";
  // iPadOS diz "Macintosh" mas tem ecrã tátil
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
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
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return;
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        (window.navigator as any).standalone;
      if (standalone) return; // já está instalada
    } catch {
      return;
    }
    kindRef.current = detectKind();
    const isMobile = kindRef.current !== "desktop";
    // Android: ainda sem Play Store — não mostrar convite nenhum
    if (kindRef.current === "android") return;
    if (isMobile && !SHOW_MOBILE_STORE) return;
    if (kindRef.current === "ios") {
      // iPhone/iPad: a versão web não é otimizada — takeover imediato para a
      // App Store (com escape "Continuar na web", memorizado no localStorage).
      setShow(true);
      return;
    }

    const onPrompt = (e: any) => {
      e.preventDefault();
      deferredRef.current = e;
      setCanNative(true);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Browsers sem o evento (Safari/Firefox): mostra na mesma, com instruções
    const timer = setTimeout(() => setShow(true), 3500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(timer);
    };
  }, []);

  if (Platform.OS !== "web" || !show) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
  };

  const installNative = async () => {
    const ev = deferredRef.current;
    if (!ev) return;
    ev.prompt();
    try {
      await ev.userChoice;
    } catch {}
    dismiss();
  };

  const kind = kindRef.current;

  // iPhone/iPad: ecrã inteiro — a web não é otimizada para estes aparelhos e a
  // app nativa está na App Store. "Continuar na web" fica memorizado.
  if (kind === "ios") {
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
            {t("install_ios_title", { defaultValue: "O WrapSheet está na App Store" })}
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
            {t("install_ios_body", {
              defaultValue:
                "No iPhone e no iPad, a app é muito melhor do que a versão web. Descarrega-a gratuitamente.",
            })}
          </Text>

          <Pressable
            onPress={() => {
              window.location.href = APP_STORE_URL;
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
              {t("install_ios_cta", { defaultValue: "Descarregar na App Store" })}
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

  const isMobile = kind !== "desktop";
  const title = isMobile
    ? t("install_mobile_title", { defaultValue: "Leva o WrapSheet contigo" })
    : t("install_desktop_title", { defaultValue: "Instala o WrapSheet no computador" });
  const body = isMobile
    ? t("install_mobile_body", { defaultValue: "Descarrega a app para iPhone e iPad e trabalha em qualquer lado." })
    : t("install_desktop_body", { defaultValue: "Usa o WrapSheet como uma aplicação própria, com janela e ícone — sem abrir o browser." });

  return (
    <View
      style={{
        // @ts-ignore — position fixed é web-only
        position: "fixed",
        bottom: 16,
        right: 16,
        left: isMobile ? 16 : undefined,
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

      {!isMobile && !canNative && (
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

        {isMobile && kind === "ios" && (
          <Pressable
            onPress={() => { window.open(APP_STORE_URL, "_blank"); dismiss(); }}
            style={({ pressed }) => [
              { backgroundColor: COLORS.text, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ color: COLORS.bg, fontWeight: "900", fontSize: 13 }}>
              {t("install_appstore", { defaultValue: "Ver na App Store" })}
            </Text>
          </Pressable>
        )}

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
