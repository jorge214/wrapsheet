// app/_layout.tsx
import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";
import { Dimensions, Platform } from "react-native";

import "../src/i18n/i18n";
import { AuthProvider } from "../src/auth/AuthContext";
import { LivePreviewProvider } from "../src/contexts/LivePreviewContext";
import { SyncProvider } from "../src/sync/SyncProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { AppShell } from "../src/ui/AppShell";

const SENTRY_DSN = "https://65f96b52fe9c560186fd8f5b5bd7be8a@o4511576189501440.ingest.de.sentry.io/4511576194416720";
if (SENTRY_DSN.startsWith("https://")) {
  Sentry.init({ dsn: SENTRY_DSN, enabled: !__DEV__ });
}

// iPhone: a app vive em vertical — o horizontal é só do editor da folha (que
// se tranca sozinho em landscape) e do iPad, onde roda livremente.
const scr = Dimensions.get("screen");
if (Platform.OS !== "web" && Math.min(scr.width, scr.height) < 600) {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SyncProvider>
          <LivePreviewProvider>
            <AppShell>
              <Stack screenOptions={{ headerShown: false }} />
            </AppShell>
          </LivePreviewProvider>
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
