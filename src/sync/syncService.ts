import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { Profile, listProfiles, upsertProfile } from "../storage/profile";
import { ProjectState, listAllProjectsFull, saveProject } from "../storage/projects";

const SYNC_FLAG_PREFIX = "sync:done:";

async function hasSynced(userId: string): Promise<boolean> {
  const val = await AsyncStorage.getItem(SYNC_FLAG_PREFIX + userId);
  return val === "1";
}

async function markSynced(userId: string): Promise<void> {
  await AsyncStorage.setItem(SYNC_FLAG_PREFIX + userId, "1");
}

/* ---------- Upload local → Supabase ---------- */

async function uploadProjects(userId: string): Promise<void> {
  const projects = await listAllProjectsFull();
  if (!projects.length) return;

  const rows = projects.map((p) => ({
    id: p.id,
    user_id: userId,
    data: p,
    updated_at: p.updatedAt || new Date().toISOString(),
  }));

  await supabase.from("projects").upsert(rows, { onConflict: "id,user_id" });
}

async function uploadProfiles(userId: string): Promise<void> {
  const profiles = await listProfiles();
  if (!profiles.length) return;

  const rows = profiles.map((p) => ({
    id: p.id,
    user_id: userId,
    data: p,
    updated_at: new Date().toISOString(),
  }));

  await supabase.from("profiles").upsert(rows, { onConflict: "id,user_id" });
}

/* ---------- Download Supabase → local ---------- */

async function downloadProjects(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .select("data, updated_at")
    .eq("user_id", userId);

  if (error || !data) return;

  for (const row of data) {
    try {
      await saveProject(row.data as ProjectState);
    } catch {
      // skip invalid rows
    }
  }
}

async function downloadProfiles(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("data")
    .eq("user_id", userId);

  if (error || !data) return;

  for (const row of data) {
    try {
      await upsertProfile(row.data as Profile);
    } catch {
      // skip invalid rows
    }
  }
}

/* ---------- Sync per-item (after save) ---------- */

export async function syncProjectToCloud(userId: string, project: ProjectState): Promise<void> {
  try {
    await supabase.from("projects").upsert(
      { id: project.id, user_id: userId, data: project, updated_at: project.updatedAt },
      { onConflict: "id,user_id" }
    );
  } catch {
    // silent fail — local save already succeeded
  }
}

export async function syncProfileToCloud(userId: string, profile: Profile): Promise<void> {
  try {
    await supabase.from("profiles").upsert(
      { id: profile.id, user_id: userId, data: profile, updated_at: new Date().toISOString() },
      { onConflict: "id,user_id" }
    );
  } catch {
    // silent fail
  }
}

export async function deleteProjectFromCloud(userId: string, projectId: string): Promise<void> {
  try {
    await supabase.from("projects").delete().eq("id", projectId).eq("user_id", userId);
  } catch {
    // silent fail
  }
}

/* ---------- Full sync on login ---------- */

export async function fullSync(userId: string): Promise<void> {
  try {
    const synced = await hasSynced(userId);

    if (!synced) {
      // First login: upload local data first, then download remote
      await uploadProjects(userId);
      await uploadProfiles(userId);
      await markSynced(userId);
    }

    // Always pull latest from cloud (remote wins for newer items)
    await downloadProjects(userId);
    await downloadProfiles(userId);
  } catch {
    // sync failure is non-critical
  }
}
