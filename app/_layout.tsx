// app/_layout.tsx
import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import React from "react";

import "../src/i18n/i18n";
import { AuthProvider } from "../src/auth/AuthContext";
import { SyncProvider } from "../src/sync/SyncProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { AppShell } from "../src/ui/AppShell";
import { WebHead } from "../src/ui/WebHead";

const SENTRY_DSN = "YOUR_SENTRY_DSN_HERE";
if (SENTRY_DSN.startsWith("https://")) {
  Sentry.init({ dsn: SENTRY_DSN, enabled: !__DEV__ });
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SyncProvider>
          <AppShell>
            <WebHead />
            <Stack screenOptions={{ headerShown: false }} />
          </AppShell>
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
