// app/_layout.tsx
import * as Sentry from "@sentry/react-native";
import { Redirect, Stack, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";

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
  const segments = useSegments();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (session) {
      getSettings().then((s) => setOnboardingDone(!!s.onboardingComplete));
    }
  }, [session]);

  if (loading) return null;

  const inAuthGroup = segments[0] === "auth";

  if (!session && !inAuthGroup) {
    return <Redirect href="/auth/login" />;
  }

  if (session && inAuthGroup) {
    if (onboardingDone === false) return <Redirect href="/onboarding" />;
    if (onboardingDone === true) return <Redirect href="/" />;
    return null;
  }

  if (session && onboardingDone === false) {
    return <Redirect href="/onboarding" />;
  }

  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell>
          <WebHead />
          <Stack screenOptions={{ headerShown: false }} />
          <AuthGate />
        </AppShell>
      </AuthProvider>
    </ThemeProvider>
  );
}
