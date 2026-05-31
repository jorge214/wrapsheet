import React, { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { fullSync } from "./syncService";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const lastSyncRef = useRef<number>(0);

  async function runSync() {
    if (!user) return;
    const now = Date.now();
    // Throttle: don't sync more than once every 30 seconds
    if (now - lastSyncRef.current < 30_000) return;
    lastSyncRef.current = now;
    await fullSync(user.id);
  }

  // Sync on login
  useEffect(() => {
    if (user) runSync();
  }, [user?.id]);

  // Sync on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runSync();
    });
    return () => sub.remove();
  }, [user?.id]);

  return <>{children}</>;
}
