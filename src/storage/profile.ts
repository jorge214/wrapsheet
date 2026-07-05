// src/storage/profile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Profile = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  departamento: string;
  funcao: string;
  empresa?: string;
  nif?: string;
  iban?: string;
  swift?: string;
  condicoes?: string;
  // Condições fixas (a linha de taxas): aplicam-se automaticamente a projetos novos
  fixas?: {
    salarioDia?: number;
    rateHEA?: number;
    rateHEB?: number;
    rateHR?: number;
    refeicao?: number;
    telefone?: number;
    viatura?: number;
    material?: number;
    perDiem?: number;
  };
};

/* ---------- Keys ---------- */
const KEY_LIST = "profiles:list:v1";
const KEY_ACTIVE = "profiles:activeId:v1";

/* ---------- Criar perfil em branco ---------- */
function BLANK(): Profile {
  return {
    id: String(Date.now()),
    nome: "",
    email: "",
    telefone: "",
    departamento: "",
    funcao: "",
    empresa: "",
    nif: "",
    iban: "",
    swift: "",
    condicoes: "",
    fixas: {},
  };
}

/* ---------- Helpers ---------- */
async function readList(): Promise<Profile[]> {
  const raw = await AsyncStorage.getItem(KEY_LIST);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Profile[];
  } catch {
    return [];
  }
}

async function writeList(list: Profile[]): Promise<void> {
  await AsyncStorage.setItem(KEY_LIST, JSON.stringify(list));
}

/* ---------- API Pública ---------- */

export async function listProfiles(): Promise<Profile[]> {
  return await readList();
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const list = await readList();
  return list.find((p) => p.id === id) ?? null;
}

export async function upsertProfile(p: Profile): Promise<Profile> {
  const list = await readList();
  const idx = list.findIndex((x) => x.id === p.id);

  if (idx >= 0) list[idx] = p;
  else list.push(p);

  await writeList(list);
  return p;
}

export async function createProfile(): Promise<Profile> {
  const p = BLANK();
  await upsertProfile(p);
  return p;
}

export async function deleteProfile(id: string): Promise<void> {
  const list = await readList();
  const next = list.filter((p) => p.id !== id);
  await writeList(next);

  const active = await getActiveProfileId();
  if (active === id) {
    await setActiveProfileId(next[0]?.id ?? "");
  }
}

export async function setActiveProfileId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEY_ACTIVE, id || "");
}

export async function getActiveProfileId(): Promise<string> {
  return (await AsyncStorage.getItem(KEY_ACTIVE)) || "";
}

export async function getActiveProfile(): Promise<Profile | null> {
  const id = await getActiveProfileId();
  if (!id) return null;
  return await getProfileById(id);
}

/* ---------- Compatibilidade antiga ---------- */
export async function getProfile(): Promise<Profile> {
  const active = await getActiveProfile();
  if (active) return active;

  const created = await createProfile();
  await setActiveProfileId(created.id);
  return created;
}

export async function saveProfile(p: Profile): Promise<void> {
  await upsertProfile(p);
  await setActiveProfileId(p.id);
}

/* ---------- NEW: obter perfil default para projetos ---------- */
export async function getDefaultProfile(): Promise<Profile | null> {
  return await getActiveProfile();
}
