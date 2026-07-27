import React, { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/AuthContext";
import {
  clearLocalUserData,
  getLastUserId,
  setLastUserId,
} from "../storage/clearLocal";
import { fullSync } from "./syncService";
import { backfillProfileIds } from "../storage/projects";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const lastSyncRef = useRef<number>(0);

  async function runSync() {
    if (!user) return;

    // Entrou uma conta diferente da dona dos dados locais → limpa-os antes
    // de sincronizar (senão apareciam na conta nova e o upload do fullSync
    // enviava-os para a cloud dela). Sem marcador (1ª sessão com contas)
    // não se limpa: são dados pré-conta do próprio, o sync migra-os.
    const last = await getLastUserId();
    const switched = !!last && last !== user.id;
    if (switched) await clearLocalUserData();
    await setLastUserId(user.id);

    const now = Date.now();
    // Throttle: don't sync more than once every 30 seconds (bypass na troca
    // de conta — o download dos dados da conta nova não pode ficar retido)
    if (!switched && now - lastSyncRef.current < 30_000) return;
    lastSyncRef.current = now;
    await fullSync(user.id);
    // Multi-perfil: carimba os projetos legados (sem profileId) com o perfil
    // ativo — depois do download, para carimbar já com os dados mais recentes.
    await backfillProfileIds();
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
