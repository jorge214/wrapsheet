// app/(tabs)/_layout.tsx
import { Stack } from "expo-router";
import React from "react";

// i18n deve ser carregado uma vez no root do "grupo" (tabs)
import "../../src/i18n/i18n";

export default function TabsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}