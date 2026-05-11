// src/ui/Screen.tsx
import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { SPACING } from "./metrics";

type ScreenProps = {
  children: React.ReactNode;
};

export default function Screen({ children }: ScreenProps) {
  const { COLORS } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: SPACING.pageX,
        }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
