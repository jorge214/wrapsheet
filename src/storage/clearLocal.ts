import AsyncStorage from "@react-native-async-storage/async-storage";

// Dono dos dados locais. Os projetos/perfis no AsyncStorage não têm conta
// associada — este marcador diz de quem são, para o SyncProvider poder limpar
// quando entra outra conta (senão os dados do utilizador anterior apareciam
// na conta nova e o sync até os enviava para a cloud dela).
const LAST_USER_KEY = "sync:lastUserId:v1";

export async function getLastUserId(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_USER_KEY);
}

export async function setLastUserId(id: string): Promise<void> {
  await AsyncStorage.setItem(LAST_USER_KEY, id);
}

export async function forgetLastUser(): Promise<void> {
  await AsyncStorage.removeItem(LAST_USER_KEY);
}

// Apaga TODOS os dados de utilizador locais (projetos ativos e arquivados,
// perfis e perfil ativo). Preferências do aparelho (língua, tema) ficam.
// Varre por prefixo em vez de seguir os índices — apanha também itens órfãos.
export async function clearLocalUserData(): Promise<void> {
  try {
    const all = await AsyncStorage.getAllKeys();
    const doomed = all.filter(
      (k) => k.startsWith("projects:") || k.startsWith("profiles:")
    );
    if (doomed.length) await AsyncStorage.multiRemove([...doomed]);
  } catch (e) {
    console.error("[storage] clearLocalUserData:", e);
  }
}
