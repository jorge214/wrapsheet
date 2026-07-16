// src/theme/ThemeProvider.tsx
import React, { createContext, useContext, useMemo } from "react";

type ThemeMode = "light" | "dark";

type Theme = {
  mode: ThemeMode;
  COLORS: {
    bg: string;
    card: string;
    border: string;
    text: string;
    sub: string;
    accent: string;
    danger: string;
    shadow: string;
  };
  setMode: (m: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
};

const light = {
  bg: "#F6F7F9",
  card: "#FFFFFF",
  border: "#E5E6EA",
  text: "#1C1C1E",
  sub: "#8E8E93",
  accent: "#007AFF",
  danger: "#FF3B30",
  shadow: "rgba(0,0,0,0.08)",
};

const dark = {
  bg: "#0C0D0F",
  card: "#14161A",
  border: "#2A2D33",
  text: "#F5F6F7",
  sub: "#A3A7AF",
  accent: "#4DA3FF",
  danger: "#FF453A",
  shadow: "rgba(0,0,0,0.6)",
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Modo escuro removido: a app é sempre clara. A estrutura (mode/setMode/
  // toggle e a paleta dark) fica intacta porque dezenas de ecrãs consomem
  // useTheme() — e para o dark poder voltar um dia sem arqueologia.
  const value = useMemo<Theme>(
    () => ({
      mode: "light",
      COLORS: light,
      setMode: async () => {},
      toggle: async () => {},
    }),
    []
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
