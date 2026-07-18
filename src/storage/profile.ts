// src/storage/profile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

// Caixa de condições de trabalho (título + texto + imagem opcional em data URI)
export type CondBox = {
  titulo: string;
  texto: string;
  img?: string;
};

// Predefinição das condições — modelo da folha de referência, traduzida e
// adaptada à língua atual da app (ver condDefaults.ts).
export function defaultCondBoxes(): CondBox[] {
  // require dinâmico para evitar import circular (condDefaults importa CondBox daqui)
  const { condBoxesFor } = require("./condDefaults") as typeof import("./condDefaults");
  const i18n = (require("../i18n/i18n") as typeof import("../i18n/i18n")).default;
  return condBoxesFor(i18n.language || "pt");
}

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
  // Condições de trabalho em caixas (título + texto + imagem opcional)
  condTitulo?: string; // título da secção (ex.: "CONDIÇÕES DE TRABALHO - NOME - A partir de 1 de Janeiro de 2026")
  condBoxes?: CondBox[];
  // Regime fiscal do utilizador (percentagens aplicadas aos valores).
  // Se um campo ficar vazio, usa-se o default do país (Definições › Região).
  fiscal?: {
    IRS_percent?: number;
    IVA_percent?: number;
  };
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
    // Regras de horas extra (a partir de que hora se cobra o quê)
    hDia?: number;      // horas do dia base (default 11)
    heaFromHour?: number; // HE-A a partir desta hora de trabalho (default 12)
    hebFromHour?: number; // HE-B a partir desta hora de trabalho (default 19)
    hrRestBelow?: number; // Recuperação se descanso entre dias < N horas (default 10)
  };
  /** Carimbo da última edição — o sync usa-o para decidir quem ganha */
  updatedAt?: string;
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
    condTitulo: "",
    condBoxes: defaultCondBoxes(),
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

export async function upsertProfile(
  p: Profile,
  opts?: { keepTimestamp?: boolean }
): Promise<Profile> {
  const list = await readList();
  const idx = list.findIndex((x) => x.id === p.id);

  // keepTimestamp: o sync preserva o carimbo remoto ao aplicar (ver saveProject)
  const toSave: Profile = {
    ...p,
    updatedAt:
      opts?.keepTimestamp && p.updatedAt ? p.updatedAt : new Date().toISOString(),
  };

  if (idx >= 0) list[idx] = toSave;
  else list.push(toSave);

  await writeList(list);
  return toSave;
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
  if (id) {
    const p = await getProfileById(id);
    if (p) return p;
  }
  // Fallback: perfis sincronizados da cloud chegam sem "ativo" definido neste
  // dispositivo (o ativo é uma definição local) — usa o primeiro e marca-o.
  const list = await readList();
  if (list.length) {
    await setActiveProfileId(list[0].id);
    return list[0];
  }
  return null;
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
