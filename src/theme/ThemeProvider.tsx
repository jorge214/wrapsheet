// src/theme/ThemeProvider.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";

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

const STORAGE_KEY = "app:theme";

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
  const [mode, setModeState] = useState<ThemeMode>("light");

  // Carrega o tema guardado ou usa o tema do sistema na primeira vez
  useEffect(() => {
    (async () => {
      try {
        const saved = (await AsyncStorage.getItem(STORAGE_KEY)) as
          | ThemeMode
          | null;

        if (saved === "light" || saved === "dark") {
          setModeState(saved);
        } else {
          const sys = Appearance.getColorScheme();
          setModeState(sys === "dark" ? "dark" : "light");
        }
      } catch (e) {
        // se der erro, fica em "light" por defeito
        const sys = Appearance.getColorScheme();
        setModeState(sys === "dark" ? "dark" : "light");
      }
    })();
  }, []);

  const value = useMemo<Theme>(
    () => ({
      mode,
      COLORS: mode === "dark" ? dark : light,
      setMode: async (m: ThemeMode) => {
        setModeState(m);
        await AsyncStorage.setItem(STORAGE_KEY, m);
      },
      toggle: async () => {
        const next = mode === "dark" ? "light" : "dark";
        setModeState(next);
        await AsyncStorage.setItem(STORAGE_KEY, next);
      },
    }),
    [mode]
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
