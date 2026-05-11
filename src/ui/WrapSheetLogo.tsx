// src/ui/WrapSheetLogo.tsx
//
// Reusable WrapSheet logo mark.
// Use `variant="icon"` for the icon-only badge (sidebar compact),
// `variant="lockup"` for icon + wordmark side-by-side,
// `variant="stacked"` for icon above wordmark (splash / onboarding).
//
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";

type Variant = "icon" | "lockup" | "stacked";
type Size = "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, { badge: number; icon: number; title: number; sub: number }> = {
  sm: { badge: 32, icon: 18, title: 16, sub: 10 },
  md: { badge: 44, icon: 26, title: 22, sub: 12 },
  lg: { badge: 64, icon: 38, title: 32, sub: 14 },
};

interface Props {
  variant?: Variant;
  size?: Size;
  /** Override icon badge background (defaults to black). */
  badgeColor?: string;
  /** Override icon color (defaults to white). */
  iconColor?: string;
}

export function WrapSheetLogo({
  variant = "lockup",
  size = "md",
  badgeColor,
  iconColor = "#FFFFFF",
}: Props) {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const s = SIZE_MAP[size];
  const bg = badgeColor ?? (mode === "dark" ? "#1A1A1A" : "#111111");
  const borderRadius = s.badge * 0.22; // matches iOS icon corner radius proportion

  const Badge = (
    <View
      style={[
        styles.badge,
        {
          width: s.badge,
          height: s.badge,
          borderRadius,
          backgroundColor: bg,
        },
      ]}
    >
      <MaterialCommunityIcons
        name="movie-open"
        size={s.icon}
        color={iconColor}
      />
    </View>
  );

  if (variant === "icon") return Badge;

  const Wordmark = (
    <View style={variant === "stacked" ? styles.wordmarkCenter : styles.wordmarkLeft}>
      <Text
        style={[
          styles.title,
          { fontSize: s.title, color: COLORS.text },
        ]}
        numberOfLines={1}
      >
        WrapSheet
      </Text>
      <Text
        style={[
          styles.sub,
          { fontSize: s.sub, color: COLORS.sub },
        ]}
        numberOfLines={1}
      >
        {t("app_tagline")}
      </Text>
    </View>
  );

  if (variant === "stacked") {
    return (
      <View style={styles.stackedRoot}>
        {Badge}
        {Wordmark}
      </View>
    );
  }

  // lockup (default)
  return (
    <View style={styles.lockupRoot}>
      {Badge}
      {Wordmark}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    // Subtle shadow for depth (matches the logo render)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lockupRoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stackedRoot: {
    alignItems: "center",
    gap: 14,
  },
  wordmarkLeft: {
    justifyContent: "center",
  },
  wordmarkCenter: {
    alignItems: "center",
  },
  title: {
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sub: {
    marginTop: 2,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
});
