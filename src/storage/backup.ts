// src/storage/backup.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import i18n from "../i18n/i18n";
import { Share } from "react-native";

const PROFILES_KEY = "profiles:list:v1";
const ACTIVE_PROFILE_KEY = "profiles:activeId:v1";

const PROJECTS_INDEX_KEY = "projects:index:v1";
const PROJECTS_ITEM_PREFIX = "projects:item:";

const ARCHIVED_INDEX_KEY = "projects:archived:index:v1";
const ARCHIVED_ITEM_PREFIX = "projects:archived:item:";

type JsonValue = any;

export interface BackupPayload {
  version: number;
  generatedAt: string;
  profiles: JsonValue[];
  activeProfileId: string | null;
  projects: JsonValue[]; // projetos ATIVOS (objetos completos)
  archived: JsonValue[]; // projetos ARQUIVADOS (objetos completos)
}

type ProjectListItem = {
  id: string;
  nome: string;
  cliente: string;
  mes: string;
  updatedAt: string;
};

/* ------------ Helpers de leitura ------------ */

async function readJsonArray<T = any>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readString(key: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    return raw;
  } catch {
    return raw;
  }
}

/**
 * Lê os objetos completos de projeto a partir de:
 * - uma lista de index (id, nome, mes, ...)
 * - o prefixo das keys de item
 */
async function readProjectsWithItems(
  indexKey: string,
  itemPrefix: string
): Promise<any[]> {
  const index = await readJsonArray<ProjectListItem>(indexKey);
  const result: any[] = [];

  for (const item of index) {
    if (!item?.id) continue;
    const raw = await AsyncStorage.getItem(itemPrefix + item.id);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      result.push(parsed);
    } catch {
      // se estiver corrompido, simplesmente ignora
    }
  }

  return result;
}

/* ------------ BUILD DO BACKUP ------------ */

async function buildBackupPayload(): Promise<BackupPayload> {
  const [profiles, activeProfileId, projects, archived] = await Promise.all([
    readJsonArray(PROFILES_KEY),
    readString(ACTIVE_PROFILE_KEY),
    readProjectsWithItems(PROJECTS_INDEX_KEY, PROJECTS_ITEM_PREFIX),
    readProjectsWithItems(ARCHIVED_INDEX_KEY, ARCHIVED_ITEM_PREFIX),
  ]);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    profiles,
    activeProfileId,
    projects,
    archived,
  };
}

/* ------------ UTIL PARA CRIAR SUMMARY DE PROJETO ------------ */

function projectToSummary(raw: any, fallbackDate: string): ProjectListItem {
  const now = new Date();
  const defaultMes = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const updatedAt = typeof raw?.updatedAt === "string" ? raw.updatedAt : fallbackDate;

  // Caso mais completo: projeto salvo pelo editor (tem .projeto)
  if (raw && raw.projeto) {
    const mesNum =
      typeof raw.projeto.mes === "number" && raw.projeto.mes > 0
        ? raw.projeto.mes
        : now.getMonth() + 1;
    const anoNum =
      typeof raw.projeto.ano === "number" && raw.projeto.ano > 0
        ? raw.projeto.ano
        : now.getFullYear();

    const mesStr = `${String(mesNum).padStart(2, "0")}/${anoNum}`;

    return {
      id: String(raw.id),
      nome: raw.projeto.filme || "",
      cliente: raw.projeto.produtora || "",
      mes: mesStr,
      updatedAt,
    };
  }

  // Caso mais simples: objeto de índice antigo (sem .projeto)
  return {
    id: String(raw.id),
    nome: raw.nome || "",
    cliente: raw.cliente || "",
    mes: typeof raw.mes === "string" && raw.mes.length > 0 ? raw.mes : defaultMes,
    updatedAt,
  };
}

/* ------------ EXPORTAR BACKUP ------------ */

export async function exportBackup(): Promise<void> {
  const payload = await buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const fileName = `wrapsheet-backup-${Date.now()}.json`;

  if ((globalThis as any).document) {
    // Web: trigger browser download
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = (globalThis as any).document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Native: write to file and share
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, json);
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (sharingAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "application/json",
      dialogTitle: i18n.t("backup_export_title"),
      UTI: "public.json",
    });
  } else {
    await Share.share({ title: "Exportar backup", message: json });
  }
}

/* ------------ IMPORTAR BACKUP ------------ */

async function applyBackup(payload: BackupPayload): Promise<void> {
  const nowIso = new Date().toISOString();

  // 1) Ler índices antigos para remover projetos antigos
  const oldActive = await readJsonArray<ProjectListItem>(PROJECTS_INDEX_KEY);
  const oldArchived = await readJsonArray<ProjectListItem>(ARCHIVED_INDEX_KEY);

  const keysToRemove: string[] = [PROJECTS_INDEX_KEY, ARCHIVED_INDEX_KEY];

  for (const it of oldActive) {
    if (it?.id) keysToRemove.push(PROJECTS_ITEM_PREFIX + it.id);
  }
  for (const it of oldArchived) {
    if (it?.id) keysToRemove.push(ARCHIVED_ITEM_PREFIX + it.id);
  }

  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }

  // 2) Perfis
  await AsyncStorage.setItem(
    PROFILES_KEY,
    JSON.stringify(payload.profiles ?? [])
  );

  if (payload.activeProfileId) {
    await AsyncStorage.setItem(
      ACTIVE_PROFILE_KEY,
      JSON.stringify(payload.activeProfileId)
    );
  } else {
    await AsyncStorage.removeItem(ACTIVE_PROFILE_KEY);
  }

  // 3) Projetos ATIVOS
  const activeIndex: ProjectListItem[] = [];

  for (const raw of payload.projects ?? []) {
    if (!raw || !raw.id) continue;
    const summary = projectToSummary(raw, nowIso);
    activeIndex.push(summary);

    // Guardar o objeto "raw" tal como está; o upgrade é feito em getProject()
    await AsyncStorage.setItem(
      PROJECTS_ITEM_PREFIX + summary.id,
      JSON.stringify(raw)
    );
  }

  // 4) Projetos ARQUIVADOS
  const archivedIndex: ProjectListItem[] = [];

  for (const raw of payload.archived ?? []) {
    if (!raw || !raw.id) continue;
    const summary = projectToSummary(raw, nowIso);
    archivedIndex.push(summary);

    await AsyncStorage.setItem(
      ARCHIVED_ITEM_PREFIX + summary.id,
      JSON.stringify(raw)
    );
  }

  await AsyncStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(activeIndex));
  await AsyncStorage.setItem(
    ARCHIVED_INDEX_KEY,
    JSON.stringify(archivedIndex)
  );
}

/**
 * Opens the system file picker, reads the selected JSON file, and applies the backup.
 */
export async function importBackup(): Promise<void> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return;

  const uri = result.assets[0].uri;

  let json: string;
  if ((globalThis as any).document) {
    // Web: blob URI — use fetch to read
    const response = await fetch(uri);
    json = await response.text();
  } else {
    json = await FileSystem.readAsStringAsync(uri);
  }

  await importBackupFromJson(json);
}

/**
 * Recebe o conteúdo de um ficheiro JSON e aplica o backup.
 * Lança erro descritivo em caso de falha (para o ecrã mostrar um Alert).
 */
export async function importBackupFromJson(json: string): Promise<void> {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("INVALID_JSON");
  }

  if (!data || typeof data !== "object") {
    throw new Error("INVALID_FORMAT");
  }

  if (typeof data.version !== "number" || data.version !== 1) {
    throw new Error("UNSUPPORTED_VERSION");
  }

  const payload: BackupPayload = {
    version: 1,
    generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : "",
    profiles: Array.isArray(data.profiles) ? data.profiles : [],
    activeProfileId:
      typeof data.activeProfileId === "string" ? data.activeProfileId : null,
    projects: Array.isArray(data.projects) ? data.projects : [],
    archived: Array.isArray(data.archived) ? data.archived : [],
  };

  await applyBackup(payload);
}
