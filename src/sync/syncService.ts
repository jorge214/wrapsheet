import { supabase } from "../lib/supabase";
import { Profile, listProfiles, upsertProfile } from "../storage/profile";
import { ProjectState, listAllProjectsFull, saveProject } from "../storage/projects";

// Refresh token guardado já não é aceite pelo servidor (sessão rotacionada
// noutro dispositivo, storage antigo do Expo Go, etc.).
function isInvalidRefreshToken(err: any): boolean {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return msg.includes("refresh token") || err?.code === "refresh_token_not_found";
}

// Os ecrãs chamam o sync em fire-and-forget; uma exceção aqui (ex.: renovação
// do token a falhar dentro do fetch do Supabase) subia como unhandled rejection
// e rebentava a app. O sync nunca deve derrubar a UI: loga e, se a sessão está
// morta, purga-a localmente para o guard mandar o utilizador para o login.
async function guard(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[sync] ${label}:`, e);
    if (isInvalidRefreshToken(e)) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
  }
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

  const { error } = await supabase.from("projects").upsert(rows, {});
  if (error) console.error("[sync] uploadProjects:", error.message);
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

  const { error } = await supabase.from("profiles").upsert(rows, {});
  if (error) console.error("[sync] uploadProfiles:", error.message);
}

/* ---------- Download Supabase → local ---------- */

async function downloadProjects(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .select("data, updated_at")
    .eq("user_id", userId);

  if (error) { console.error("[sync] downloadProjects:", error.message); return; }
  if (!data) return;

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

  if (error) { console.error("[sync] downloadProfiles:", error.message); return; }
  if (!data) return;

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
  await guard("syncProjectToCloud", async () => {
    const { error } = await supabase.from("projects").upsert(
      { id: project.id, user_id: userId, data: project, updated_at: project.updatedAt },
      {}
    );
    if (error) console.error("[sync] syncProjectToCloud:", error.message);
  });
}

export async function syncProfileToCloud(userId: string, profile: Profile): Promise<void> {
  await guard("syncProfileToCloud", async () => {
    const { error } = await supabase.from("profiles").upsert(
      { id: profile.id, user_id: userId, data: profile, updated_at: new Date().toISOString() },
      {}
    );
    if (error) console.error("[sync] syncProfileToCloud:", error.message);
  });
}

export async function deleteProjectFromCloud(userId: string, projectId: string): Promise<void> {
  await guard("deleteProjectFromCloud", async () => {
    const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("user_id", userId);
    if (error) console.error("[sync] deleteProjectFromCloud:", error.message);
  });
}

// Sem isto, apagar um perfil só o removia localmente e o downloadProfiles
// da sincronização seguinte ressuscitava-o a partir da cloud.
export async function deleteProfileFromCloud(userId: string, profileId: string): Promise<void> {
  await guard("deleteProfileFromCloud", async () => {
    const { error } = await supabase.from("profiles").delete().eq("id", profileId).eq("user_id", userId);
    if (error) console.error("[sync] deleteProfileFromCloud:", error.message);
  });
}

/* ---------- Full sync on login ---------- */

export async function fullSync(userId: string): Promise<void> {
  await guard("fullSync", async () => {
    await uploadProjects(userId);
    await uploadProfiles(userId);
    await downloadProjects(userId);
    await downloadProfiles(userId);
  });
}
