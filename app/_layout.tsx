// app/_layout.tsx
import * as Sentry from "@sentry/react-native";
import { Stack, router } from "expo-router";
import { Head } from "expo-router/head";
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
        <Head>
          <title>WrapSheet — Film & Production Hours</title>
          <meta name="description" content="Track your film and production work hours. Generate professional PDF reports in seconds." />
          <meta property="og:title" content="WrapSheet — Film & Production Hours" />
          <meta property="og:description" content="Track your film and production work hours. Generate professional PDF reports in seconds." />
          <meta property="og:image" content="https://wrapsheet-theta.vercel.app/favicon.png" />
          <meta property="og:url" content="https://wrapsheet-theta.vercel.app" />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content="WrapSheet — Film & Production Hours" />
          <meta name="twitter:description" content="Track your film and production work hours. Generate professional PDF reports in seconds." />
          <meta name="twitter:image" content="https://wrapsheet-theta.vercel.app/favicon.png" />
        </Head>
        <OnboardingGate />
        <Stack screenOptions={{ headerShown: false }} />
      </AppShell>
    </ThemeProvider>
  );
}
