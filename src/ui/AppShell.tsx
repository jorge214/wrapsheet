// src/ui/AppShell.tsx
//
// Adaptive layout shell.
//   • Phone  (<768 px)  → transparent wrapper, full-screen stack navigation unchanged
//   • Tablet (768–1099) → 220 px left sidebar + content area
//   • Desktop (≥1100)   → 256 px left sidebar + content area
//
import { Ionicons } from "@expo/vector-icons";
import { Redirect, usePathname } from "expo-router";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/AuthContext";
import { useLivePreview } from "../contexts/LivePreviewContext";
import { getSettings } from "../storage/appSettings";
import { useTheme } from "../theme/ThemeProvider";
import { InstallPrompt } from "./InstallPrompt";
import { runNavGuard } from "./navGuard";
import {
  SIDEBAR_WIDTH,
  useBreakpoint,
  useIsWide,
} from "./useBreakpoint";
import { WrapSheetLogo } from "./WrapSheetLogo";

// ─── Nav items ────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route: string;
  /** Pathname prefix used to decide active state. */
  match: string;
};

// ─── Shell ────────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const isWide = useIsWide();
  const { height } = useWindowDimensions();
  const { previewHtml, zoom, setActualZoom, clearPreview } = useLivePreview();
  const pathname = usePathname();
  const { session, loading } = useAuth();
  const isProjectEditor = /^\/projects\/[^/]+$/.test(pathname);
  const showPreviewPanel = isWide && Platform.OS === "web" && !!previewHtml;
  const iframeRef = useRef<any>(null);

  // Nos ecrãs de autenticação a app "desaparece": sem sidebar (senão dava para
  // saltar para os Projetos a meio do login/reset).
  const isAuthScreen = pathname.startsWith("/auth");

  // Primeira abertura: slides de introdução antes do login. Relê a flag a cada
  // navegação (depois do "Começar" fica true e não volta a aparecer). Os ecrãs
  // /auth/* ficam de fora para não sequestrar links de email (reset/confirmação).
  const [onbComplete, setOnbComplete] = React.useState<boolean | null>(null);
  useEffect(() => {
    getSettings()
      .then((s) => setOnbComplete(!!s.onboardingComplete))
      .catch(() => setOnbComplete(true));
  }, [pathname]);
  // Guard global: sem sessão só se veem os ecrãs públicos. Os dados são locais,
  // por isso sem isto qualquer rota abria os projetos mesmo sem login.
  const isPublic =
    isAuthScreen ||
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/privacy") ||
    pathname === "/terms";

  // Close the live PDF preview whenever we leave the project editor,
  // so it never lingers over other screens (Projects list, Archived, etc.).
  useEffect(() => {
    if (!isProjectEditor && previewHtml) clearPreview();
  }, [isProjectEditor]); // eslint-disable-line react-hooks/exhaustive-deps

  const innerStyle = showPreviewPanel
    ? styles.contentInnerNarrow
    : styles.contentInnerWide;

  // Receive the real rendered zoom from the iframe after auto-fit and store in context
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: any) => {
      if (e.data?.type === "wrapsheet:zoom-actual") {
        setActualZoom(e.data.zoom);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setActualZoom]);

  // Send zoom via postMessage to iframe whenever it changes
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    if (zoom === null) {
      iframeRef.current.contentWindow.postMessage({ type: "wrapsheet:zoom", zoom: "auto" }, "*");
    } else {
      iframeRef.current.contentWindow.postMessage({ type: "wrapsheet:zoom", zoom }, "*");
    }
  }, [zoom]);

  // (depois de TODOS os hooks — regra dos hooks)
  // 1º arranque sem sessão → introdução (slides); só depois o login.
  if (
    !loading &&
    !session &&
    onbComplete === false &&
    !isAuthScreen &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/privacy") &&
    pathname !== "/terms"
  ) {
    return <Redirect href="/onboarding" />;
  }
  if (!loading && !session && !isPublic) return <Redirect href="/auth/login" />;

  // IMPORTANTE: a árvore é SEMPRE a mesma (sidebar só aparece em ecrãs largos).
  // Se a estrutura mudasse entre estreito/largo, rodar o telemóvel para
  // horizontal remontava o ecrã inteiro e perdia o estado (ex.: o editor da
  // folha abria e fechava logo ao forçar landscape).
  return (
    <View style={[styles.root, Platform.OS === "web" ? { height } : { flex: 1 }]}>
      {isWide && !isAuthScreen && <Sidebar />}
      <View style={styles.content}>
        <View style={isWide ? innerStyle : styles.contentInnerWide}>
          {children}
        </View>
      </View>
      {/* Convite para instalar a app (web, fora dos ecrãs de auth) */}
      {Platform.OS === "web" && !isAuthScreen && <InstallPrompt />}
      {showPreviewPanel && (
        <View style={styles.previewPane}>
          {/* @ts-ignore — iframe is web-only */}
          <iframe
            ref={iframeRef}
            srcDoc={previewHtml}
            onLoad={() => {
              if (iframeRef.current?.contentWindow && zoom !== null) {
                iframeRef.current.contentWindow.postMessage({ type: "wrapsheet:zoom", zoom }, "*");
              }
            }}
            style={{ width: "100%", height: "100%", border: "none" } as any}
            title="Live PDF Preview"
          />
        </View>
      )}
    </View>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bp = useBreakpoint();
  const width =
    bp === "desktop" ? SIDEBAR_WIDTH.desktop : SIDEBAR_WIDTH.tablet;

  const navMain: NavItem[] = [
    {
      label: t("home.projects", { defaultValue: "Projects" }),
      icon: "videocam-outline",
      route: "/projects",
      match: "/projects",
    },
    {
      label: t("home.dashboard", { defaultValue: "Dashboard" }),
      icon: "stats-chart-outline",
      route: "/dashboard",
      match: "/dashboard",
    },
    {
      label: t("home.profiles", { defaultValue: "Profiles" }),
      icon: "person-outline",
      route: "/profiles",
      match: "/profiles",
    },
  ];

  const navSettings: NavItem = {
    label: t("home.settings", { defaultValue: "Settings" }),
    icon: "settings-outline",
    route: "/settings",
    match: "/settings",
  };

  return (
    <View
      style={[
        styles.sidebar,
        {
          width,
          backgroundColor: COLORS.card,
          borderRightColor: COLORS.border,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <View style={styles.brand}>
        <WrapSheetLogo variant="lockup" size={bp === "desktop" ? "md" : "sm"} />
      </View>

      {/* ── Main nav ──────────────────────────────────────────────────── */}
      <View style={styles.navSection}>
        {navMain.map((item) => (
          <NavButton
            key={item.route}
            item={item}
            active={pathname.startsWith(item.match)}
            COLORS={COLORS}
            mode={mode}
          />
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {/* ── Separator ─────────────────────────────────────────────────── */}
      <View style={[styles.separator, { backgroundColor: COLORS.border }]} />

      {/* ── Settings at bottom ────────────────────────────────────────── */}
      <View style={{ marginTop: 8 }}>
        <NavButton
          item={navSettings}
          active={pathname.startsWith(navSettings.match)}
          COLORS={COLORS}
          mode={mode}
        />
      </View>
    </View>
  );
}

// ─── Individual nav button ────────────────────────────────────────────────────

function NavButton({
  item,
  active,
  COLORS,
  mode,
}: {
  item: NavItem;
  active: boolean;
  COLORS: any;
  mode: "light" | "dark";
}) {
  return (
    <Pressable
      // O guard deixa ecrãs com alterações por gravar (Perfil) mostrar o
      // popup Guardar/Ignorar antes de sair — para qualquer destino do menu
      onPress={() => runNavGuard(() => router.push(item.route as any))}
      style={({ pressed, hovered }: any) => [
        styles.navItem,
        active && {
          backgroundColor: mode === "dark" ? COLORS.bg : "#ECEEF2",
        },
        Platform.OS === "web" && hovered && !active && {
          backgroundColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "#F0F1F4",
        },
        pressed && { opacity: 0.72 },
        Platform.OS === "web" && ({ cursor: "pointer" } as any),
      ]}
    >
      <Ionicons
        name={item.icon}
        size={19}
        color={active ? COLORS.text : COLORS.sub}
      />
      <Text
        style={[
          styles.navLabel,
          {
            color: active ? COLORS.text : COLORS.sub,
            fontWeight: active ? "800" : "500",
          },
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    borderRightWidth: 1,
    paddingHorizontal: 12,
    // Stretch to full height on web (flex row container)
    alignSelf: "stretch",
  },
  content: {
    flex: 1,
    overflow: "hidden",
  },
  contentInner: {
    flex: 1,
    maxWidth: 960,
    width: "100%",
    alignSelf: "center",
  },
  contentInnerNarrow: {
    flex: 1,
    maxWidth: 600,
    width: "100%",
    alignSelf: "flex-start",
  },
  // Fill the whole available width on desktop (no centred 960px column,
  // no white side bands) so every screen uses the full space.
  contentInnerWide: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
  },
  previewPane: {
    flex: 1,
    borderLeftWidth: 1,
    borderColor: "#E5E6EA",
    backgroundColor: "#fff",
  },
  previewToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: "#E5E6EA",
    backgroundColor: "#F6F7F9",
  },
  zoomBtn: {
    width: 30,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E6EA",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBtnMid: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E6EA",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
  },
  zoomBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  brand: {
    paddingHorizontal: 4,
    paddingBottom: 24,
  },
  navSection: {
    gap: 2,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  navLabel: {
    fontSize: 14,
  },
  separator: {
    height: 1,
    marginHorizontal: 8,
  },
});
