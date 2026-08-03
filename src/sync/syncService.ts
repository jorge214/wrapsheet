import { supabase } from "../lib/supabase";
import { Profile, deleteProfile, listProfiles, upsertProfile } from "../storage/profile";
import {
  ProjectState,
  archiveProject,
  deleteArchivedProject,
  deleteProject,
  getProject,
  listAllProjectsFull,
  listArchivedProjects,
  saveProject,
} from "../storage/projects";

// ─── Regras do protocolo ──────────────────────────────────────────────────────
// 1) Last-write-wins pelos carimbos updatedAt, nas DUAS direções: um aparelho
//    com uma cópia velha nunca esmaga a edição mais recente de outro (era o
//    bug: marcar pago no iPhone e o PC repor "a receber" no sync seguinte).
// 2) Eliminações deixam LÁPIDE na cloud (data.deleted=true) — sem isso, o
//    outro aparelho que ainda tinha o projeto ressuscitava-o para todos.
// 3) O estado "arquivado" viaja na cloud (data.archived) — era local e
//    perdia-se entre aparelhos.

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

// Erros devolvidos (não lançados) pelo PostgREST. 23503 = violação de foreign
// key no user_id: a conta foi apagada no servidor mas o token deste aparelho
// ainda está vivo (~1h) — sessão fantasma. Corta já a sessão local em vez de
// esperar que o token expire.
async function syncErr(label: string, error: any): Promise<void> {
  console.error(`[sync] ${label}:`, error?.message ?? error);
  if (error?.code === "23503") {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }
}

// ── Aviso de perfil recusado pelo servidor ───────────────────────────────────
// O trigger `enforce_profile_limit` recusa perfis acima do plano. Antes isso
// morria num console.error: o perfil ficava a funcionar no aparelho mas nunca
// subia, e o utilizador não via nada. Guardamos o aviso para o ecrã de Perfis
// o mostrar uma vez.
let profileRejected = false;
function isProfileLimitError(error: any): boolean {
  const msg = String(error?.message ?? "");
  return error?.code === "P0001" || msg.includes("profile_limit_reached");
}
/** Houve um perfil recusado pelo servidor desde a última vez que se perguntou? */
export function consumeProfileRejected(): boolean {
  const v = profileRejected;
  profileRejected = false;
  return v;
}

// Carimbo → ms (formatos ISO locais e timestamptz do Postgres não são
// comparáveis como texto: "…Z" vs "…+00:00")
function ts(v: any): number {
  const n = Date.parse(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/* ---------- Upload local → Supabase (só o que é mais novo) ---------- */

async function uploadProjects(userId: string): Promise<void> {
  const projects = await listAllProjectsFull();
  if (!projects.length) return;
  const archivedIds = new Set((await listArchivedProjects()).map((i) => i.id));

  const { data: cloud, error: e1 } = await supabase
    .from("projects").select("id, updated_at").eq("user_id", userId);
  if (e1) { await syncErr("uploadProjects", e1); return; }
  const cloudTs = new Map((cloud ?? []).map((r: any) => [r.id, ts(r.updated_at)]));

  const rows = projects
    .filter((p) => {
      const c = cloudTs.get(p.id);
      return c == null || ts(p.updatedAt) > c;
    })
    .map((p) => ({
      id: p.id,
      user_id: userId,
      data: { ...p, archived: archivedIds.has(p.id) },
      updated_at: p.updatedAt || new Date().toISOString(),
    }));
  if (!rows.length) return;

  const { error } = await supabase.from("projects").upsert(rows, {});
  if (error) await syncErr("uploadProjects", error);
}

async function uploadProfiles(userId: string): Promise<void> {
  const profiles = await listProfiles();
  if (!profiles.length) return;

  const { data: cloud, error: e1 } = await supabase
    .from("profiles").select("id, updated_at").eq("user_id", userId);
  if (e1) { await syncErr("uploadProfiles", e1); return; }
  const cloudTs = new Map((cloud ?? []).map((r: any) => [r.id, ts(r.updated_at)]));

  const rows = profiles
    .filter((p) => {
      const c = cloudTs.get(p.id);
      // Perfis antigos sem carimbo: só sobem se a cloud não os tiver
      return c == null || ts(p.updatedAt) > c;
    })
    .map((p) => ({
      id: p.id,
      user_id: userId,
      data: p,
      updated_at: p.updatedAt || new Date().toISOString(),
    }));
  if (!rows.length) return;

  const { error } = await supabase.from("profiles").upsert(rows, {});
  if (!error) return;

  // O upsert é UM statement: se o trigger recusar uma linha (perfil acima do
  // plano), o lote inteiro falha e edições legítimas dos OUTROS perfis ficavam
  // por sincronizar, em silêncio. Por isso, ao falhar, repete-se linha a linha:
  // as boas passam, e só a recusada fica de fora (com aviso para a UI).
  if (rows.length === 1) {
    if (isProfileLimitError(error)) profileRejected = true;
    await syncErr("uploadProfiles", error);
    return;
  }
  for (const row of rows) {
    const { error: e } = await supabase.from("profiles").upsert([row], {});
    if (!e) continue;
    if (isProfileLimitError(e)) profileRejected = true;
    await syncErr(`uploadProfiles(${row.id})`, e);
  }
}

/* ---------- Download Supabase → local (só o que é mais novo) ---------- */

async function downloadProjects(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .select("data, updated_at")
    .eq("user_id", userId);

  if (error) { await syncErr("downloadProjects", error); return; }
  if (!data) return;

  for (const row of data) {
    try {
      const remote: any = row.data;
      if (!remote?.id) continue;
      const remoteTs = Math.max(ts(remote.updatedAt), ts((row as any).updated_at));

      const local = await getProject(remote.id);
      if (local && ts(local.updatedAt) >= remoteTs) continue; // local ganha

      if (remote.deleted) {
        // lápide: apaga localmente, esteja onde estiver
        await deleteProject(remote.id).catch(() => {});
        await deleteArchivedProject(remote.id).catch(() => {});
        continue;
      }

      const { archived, deleted, ...state } = remote;
      const isArchivedLocal = (await listArchivedProjects()).some((i) => i.id === state.id);

      if (isArchivedLocal && !archived) {
        // remoto diz "ativo": tira a cópia arquivada antes de gravar
        await deleteArchivedProject(state.id).catch(() => {});
      }
      await saveProject(state as ProjectState, { keepTimestamp: true });
      if (archived && !isArchivedLocal) {
        await archiveProject(state.id).catch(() => {});
      }
    } catch {
      // skip invalid rows
    }
  }
}

async function downloadProfiles(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("data, updated_at")
    .eq("user_id", userId);

  if (error) { await syncErr("downloadProfiles", error); return; }
  if (!data) return;

  for (const row of data) {
    try {
      const remote: any = row.data;
      if (!remote?.id) continue;
      const remoteTs = Math.max(ts(remote.updatedAt), ts((row as any).updated_at));

      const locals = await listProfiles();
      const local = locals.find((p) => p.id === remote.id);
      if (local && ts(local.updatedAt) >= remoteTs) continue;

      if (remote.deleted) {
        await deleteProfile(remote.id).catch(() => {});
        continue;
      }

      const { deleted, ...state } = remote;
      await upsertProfile(state as Profile, { keepTimestamp: true });
    } catch {
      // skip invalid rows
    }
  }
}

/* ---------- Sync per-item (after save) ---------- */

export async function syncProjectToCloud(userId: string, project: ProjectState): Promise<void> {
  await guard("syncProjectToCloud", async () => {
    // O estado arquivado segue junto — na cloud é um campo do data
    const archivedIds = new Set((await listArchivedProjects()).map((i) => i.id));
    const { error } = await supabase.from("projects").upsert(
      {
        id: project.id,
        user_id: userId,
        data: { ...project, archived: archivedIds.has(project.id) },
        updated_at: project.updatedAt || new Date().toISOString(),
      },
      {}
    );
    if (error) await syncErr("syncProjectToCloud", error);
  });
}

export async function syncProfileToCloud(userId: string, profile: Profile): Promise<void> {
  await guard("syncProfileToCloud", async () => {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: profile.id,
        user_id: userId,
        data: profile,
        updated_at: profile.updatedAt || new Date().toISOString(),
      },
      {}
    );
    if (error) await syncErr("syncProfileToCloud", error);
  });
}

// Eliminar = LÁPIDE na cloud (não apagar a linha): sem isto, outro aparelho
// que ainda tivesse o projeto voltava a enviá-lo e ele "ressuscitava".
export async function deleteProjectFromCloud(userId: string, projectId: string): Promise<void> {
  await guard("deleteProjectFromCloud", async () => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("projects").upsert(
      { id: projectId, user_id: userId, data: { id: projectId, deleted: true, updatedAt: now }, updated_at: now },
      {}
    );
    if (error) await syncErr("deleteProjectFromCloud", error);
  });
}

// Sem isto, apagar um perfil só o removia localmente e o downloadProfiles
// da sincronização seguinte ressuscitava-o a partir da cloud.
export async function deleteProfileFromCloud(userId: string, profileId: string): Promise<void> {
  await guard("deleteProfileFromCloud", async () => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("profiles").upsert(
      { id: profileId, user_id: userId, data: { id: profileId, deleted: true, updatedAt: now }, updated_at: now },
      {}
    );
    if (error) await syncErr("deleteProfileFromCloud", error);
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