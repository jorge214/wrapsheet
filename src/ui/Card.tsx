// src/ui/Card.tsx
import React from "react";
import { View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { RADIUS, SPACING } from "./metrics";

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export function Card({ children, style }: CardProps) {
  const { COLORS, mode } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: COLORS.card,
          borderRadius: RADIUS.card,
          padding: SPACING.card,
          borderWidth: 1,
          borderColor: COLORS.border,
          shadowColor: COLORS.shadow,
          shadowOpacity: mode === "dark" ? 0.35 : 0.15,
          shadowRadius: 4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
