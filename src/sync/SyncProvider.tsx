import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { enviarFilaPdf } from "../lib/eventos";
import {
  clearLocalUserData,
  getLastUserId,
  setLastUserId,
} from "../storage/clearLocal";
import { fullSync } from "./syncService";
import { backfillProfileIds } from "../storage/projects";
import { criarExemploSePreciso } from "../storage/exemplo";
import { verificarPrimeiraEntrada } from "../storage/primeiraEntrada";

type SyncCtx = {
  /** A conta é nova e a primeira entrada (src/ui/PrimeiraEntrada.tsx) deve aparecer */
  primeiraEntrada: boolean;
  fecharPrimeiraEntrada: () => void;
  /** Volta a abrir as três perguntas (cartão dos passos, a quem disse "Agora não") */
  abrirPrimeiraEntrada: () => void;
};

const SyncContext = createContext<SyncCtx>({
  primeiraEntrada: false,
  fecharPrimeiraEntrada: () => {},
  abrirPrimeiraEntrada: () => {},
});
export const useSync = () => useContext(SyncContext);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const lastSyncRef = useRef<number>(0);
  const [primeiraEntrada, setPrimeiraEntrada] = useState(false);
  // A conta com sessão AGORA: uma sincronização que ainda corre depois de
  // sair da conta (ou de trocar) não pode abrir a primeira entrada à seguinte.
  const uidRef = useRef<string | undefined>(user?.id);
  uidRef.current = user?.id;
  // Aberta pelo cartão dos passos (a quem disse "Agora não"): a sincronização
  // seguinte não a fecha por si — a conta já estava marcada como "adiada".
  const abertaAMao = useRef(false);

  async function runSync() {
    if (!user) return;
    const uid = user.id;

    // Entrou uma conta diferente da dona dos dados locais → limpa-os antes
    // de sincronizar (senão apareciam na conta nova e o upload do fullSync
    // enviava-os para a cloud dela). Sem marcador (1ª sessão com contas)
    // não se limpa: são dados pré-conta do próprio, o sync migra-os.
    const last = await getLastUserId();
    const switched = !!last && last !== uid;
    if (switched) await clearLocalUserData();
    await setLastUserId(uid);

    const now = Date.now();
    // Throttle: don't sync more than once every 30 seconds (bypass na troca
    // de conta — o download dos dados da conta nova não pode ficar retido)
    if (!switched && now - lastSyncRef.current < 30_000) return;
    lastSyncRef.current = now;
    await fullSync(uid);
    // Multi-perfil: carimba os projetos legados (sem profileId) com o perfil
    // ativo — depois do download, para carimbar já com os dados mais recentes.
    await backfillProfileIds();
    // Exportações de PDF registadas sem rede (ver lib/eventos.ts)
    await enviarFilaPdf(uid);
    // Conta sem perfil e sem folhas, aqui e na nuvem → primeira entrada (três
    // perguntas e a folha da semana criada). Só DEPOIS do download: antes dele
    // uma conta antiga num aparelho novo parecia vazia. A folha de exemplo
    // espera pela resposta ("Agora não" cria-a — ver primeiraEntrada.ts).
    const precisa = await verificarPrimeiraEntrada(uid);
    if (uidRef.current !== uid) return; // entretanto saiu da conta ou trocou
    // Também FECHA: se a conta respondeu noutro aparelho, os dados chegaram
    // e as perguntas abertas aqui já não fazem sentido.
    if (precisa || !abertaAMao.current) setPrimeiraEntrada(precisa);
    if (precisa) return;
    // Quem ainda não tem nenhuma folha (local E na nuvem) recebe uma de exemplo,
    // uma vez por conta. Depois do download, para não a criar a quem só está
    // num aparelho novo.
    await criarExemploSePreciso(user as any);
  }

  // Sync on login. A cada troca de conta (e ao sair) a primeira entrada fecha.
  useEffect(() => {
    abertaAMao.current = false;
    setPrimeiraEntrada(false);
    if (user) runSync();
  }, [user?.id]);

  // Sync on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runSync();
    });
    return () => sub.remove();
  }, [user?.id]);

  return (
    <SyncContext.Provider
      value={{
        primeiraEntrada,
        fecharPrimeiraEntrada: () => {
          abertaAMao.current = false;
          setPrimeiraEntrada(false);
        },
        abrirPrimeiraEntrada: () => {
          abertaAMao.current = true;
          setPrimeiraEntrada(true);
        },
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
