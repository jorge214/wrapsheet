// app/_layout.tsx
import * as Sentry from "@sentry/react-native";
import { Stack, router } from "expo-router";
import React, { useEffect } from "react";

import "../src/i18n/i18n";
import { getSettings } from "../src/storage/appSettings";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { AppShell } from "../src/ui/AppShell";

const SENTRY_DSN = "YOUR_SENTRY_DSN_HERE";
if (SENTRY_DSN.startsWith("https://")) {
  Sentry.init({ dsn: SENTRY_DSN, enabled: !__DEV__ });
}

function OnboardingGate() {
  useEffect(() => {
    getSettings().then((s) => {
      if (!s.onboardingComplete) {
        router.replace("/onboarding");
      }
    });
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell>
        <OnboardingGate />
        <Stack screenOptions={{ headerShown: false }} />
      </AppShell>
    </ThemeProvider>
  );
}
