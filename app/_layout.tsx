// app/_layout.tsx
import * as Sentry from "@sentry/react-native";
import { Stack, router } from "expo-router";
import React, { useEffect } from "react";

import "../src/i18n/i18n";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { getSettings } from "../src/storage/appSettings";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { AppShell } from "../src/ui/AppShell";
import { WebHead } from "../src/ui/WebHead";

const SENTRY_DSN = "YOUR_SENTRY_DSN_HERE";
if (SENTRY_DSN.startsWith("https://")) {
  Sentry.init({ dsn: SENTRY_DSN, enabled: !__DEV__ });
}

function AuthGate() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/auth/login");
      return;
    }
    getSettings().then((s) => {
      if (!s.onboardingComplete) {
        router.replace("/onboarding");
      }
    });
  }, [session, loading]);

  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell>
          <WebHead />
          <AuthGate />
          <Stack screenOptions={{ headerShown: false }} />
        </AppShell>
      </AuthProvider>
    </ThemeProvider>
  );
}
