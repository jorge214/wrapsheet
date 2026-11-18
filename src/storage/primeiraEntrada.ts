// Primeira entrada (18/11/2026): a quem chega sem nada, três perguntas —
// publicidade ou cinema, a função e quanto ganha — e a folha desta semana fica
// logo criada, com o perfil por trás. O resto do perfil (nome, NIF, IBAN…)
// pede-se na primeira exportação do PDF. Um terço das contas registava-se e
// nunca chegava a fazer uma folha. As regras (puras) estão em passosRegras.ts.
//
// Só aparece a contas SEM perfil e SEM folhas suas (a de exemplo não conta),
// no aparelho E na nuvem, e só depois da sincronização (SyncProvider). Criar o
// perfil antes de descarregar os dados da nuvem dava, numa conta antiga num
// aparelho novo, um segundo perfil que o servidor recusa (limite de 1 no plano
// grátis) e folhas presas a esse perfil, invisíveis nos outros aparelhos. Na
// dúvida (sem rede, erro na contagem, sessão que já não é desta conta), não
// aparece — e não se cria perfil nenhum.
import { supabase } from "../lib/supabase";
import { syncProfileToCloud, syncProjectToCloud } from "../sync/syncService";
import { criarExemploSePreciso } from "./exemplo";
import { eExemplo } from "./exemploMarca";
import {
  MARCA_PRIMEIRA_ENTRADA,
  patchPerfilDono,
  perfilInicial,
  precisaPrimeiraEntrada,
  type DadosFolha,
  type DadosPrimeiraEntrada,
} from "./passosRegras";
import { lerMarcas, marcarConta, marcarLocal } from "./primeirosPassos";
import { getActiveProfile, getProfileById, listProfiles, setActiveProfileId, upsertProfile, type Profile } from "./profile";
import { createProject, getProject, listAllProjectsFull } from "./projects";

/**
 * Perfis e folhas suas (vivas, sem a de exemplo) na nuvem. `null` = não se
 * sabe: sem rede, erro, ou a sessão já não é desta conta (sem sessão o pedido
 * vai como anónimo e as regras devolvem listas VAZIAS sem erro — parecia uma
 * conta nova).
 */
async function contarNaNuvem(uid: string): Promise<{ perfis: number; folhas: number } | null> {
  try {
    const { data: s } = await supabase.auth.getSession();
    if (s.session?.user?.id !== uid) return null;
    const [pf, pj] = await Promise.all([
      supabase.from("profiles").select("id, apagado:data->deleted").eq("user_id", uid).limit(1000),
      supabase.from("projects").select("id, apagado:data->deleted, exemplo:data->exemplo").eq("user_id", uid).limit(5000),
    ]);
    if (pf.error || pj.error || !pf.data || !pj.data) return null;
    const vivo = (r: any) => r.apagado !== true;
    return {
      perfis: pf.data.filter(vivo).length,
      folhas: pj.data.filter((r: any) => vivo(r) && r.exemplo !== true).length,
    };
  } catch {
    return null;
  }
}

/**
 * Chamado pelo SyncProvider depois de cada sincronização. Quem já tem perfil
 * ou folhas fica marcado ("nao_aplica") para não se voltar a contar.
 */
export async function verificarPrimeiraEntrada(uid: string): Promise<boolean> {
  try {
    const marcas = await lerMarcas(uid);
    if (marcas[MARCA_PRIMEIRA_ENTRADA]) return false;
    const [perfis, folhas] = await Promise.all([listProfiles(), listAllProjectsFull()]);
    const locais = { perfis: perfis.length, folhas: folhas.filter((p) => !eExemplo(p)).length };
    if (locais.perfis > 0 || locais.folhas > 0) {
      await marcarConta(uid, { [MARCA_PRIMEIRA_ENTRADA]: "nao_aplica" });
      return false;
    }
    const nuvem = await contarNaNuvem(uid);
    if (nuvem && (nuvem.perfis > 0 || nuvem.folhas > 0)) {
      // Há dados na nuvem que ainda não chegaram a este aparelho
      await marcarConta(uid, { [MARCA_PRIMEIRA_ENTRADA]: "nao_aplica" });
      return false;
    }
    return precisaPrimeiraEntrada({
      marcado: false,
      perfisLocais: locais.perfis,
      folhasLocais: locais.folhas,
      perfisNuvem: nuvem?.perfis ?? null,
      folhasNuvem: nuvem?.folhas ?? null,
    });
  } catch {
    return false;
  }
}

/**
 * Cria o PRIMEIRO perfil da conta, mas só com a certeza de que não há nenhum
 * (aqui e na nuvem). Devolve-o, ou `null` se não era seguro criar.
 */
async function criarPrimeiroPerfil(uid: string, perfil: Profile): Promise<Profile | null> {
  const nuvem = await contarNaNuvem(uid);
  if (!nuvem || nuvem.perfis > 0) return null;
  if ((await listProfiles()).length > 0) return null;
  const gravado = await upsertProfile(perfil);
  await setActiveProfileId(gravado.id);
  syncProfileToCloud(uid, gravado).catch(() => {});
  return gravado;
}

/**
 * Cria o perfil e a folha desta semana. Devolve o id da folha, ou `null` se
 * entretanto apareceram dados (aqui ou noutro aparelho) — aí não cria nada.
 * Sem saber o que há na nuvem LANÇA, para o ecrã dizer "tenta outra vez".
 */
export async function concluirPrimeiraEntrada(uid: string, d: DadosPrimeiraEntrada): Promise<string | null> {
  const nuvem = await contarNaNuvem(uid);
  if (!nuvem) throw new Error("sem_nuvem");
  const folhasLocais = (await listAllProjectsFull()).filter((p) => !eExemplo(p)).length;
  if (nuvem.perfis > 0 || nuvem.folhas > 0 || folhasLocais > 0 || (await listProfiles()).length > 0) {
    await marcarConta(uid, { [MARCA_PRIMEIRA_ENTRADA]: "nao_aplica" });
    return null;
  }
  const perfil = await criarPrimeiroPerfil(uid, perfilInicial(String(Date.now()), d));
  if (!perfil) throw new Error("sem_nuvem");
  // Publicidade: um dia, hoje. Cinema: a semana desta segunda a domingo.
  const id = await createProject(d.formato === "cinema" ? { formato: "cinema", diasSemana: 5 } : {});
  // A marca logo a seguir: se a app fechar a meio, a primeira entrada não volta.
  // exemplo_v1: a conta já tem a sua folha, não precisa da de exemplo.
  await marcarConta(uid, { [MARCA_PRIMEIRA_ENTRADA]: "feita", exemplo_v1: true });
  const folha = await getProject(id);
  if (folha) syncProjectToCloud(uid, folha).catch(() => {});
  return id;
}

/**
 * "Agora não": a marca local já foi gravada pelo ecrã (marcarLocal, para o
 * cartão dos passos aparecer logo); aqui sobe para os metadados e cria-se a
 * folha de exemplo, como antes.
 */
export async function adiarPrimeiraEntrada(user: { id: string; user_metadata?: Record<string, any> }): Promise<void> {
  await marcarLocal(user.id, { [MARCA_PRIMEIRA_ENTRADA]: "adiada" });
  await marcarConta(user.id, { [MARCA_PRIMEIRA_ENTRADA]: "adiada" });
  await criarExemploSePreciso(user);
}

/**
 * Os dados escritos no diálogo da exportação (nome, email, telefone, NIF,
 * IBAN) chegam ao perfil dono da folha:
 *   • com perfil: aplica-se o que falta (ou o que a pessoa mudou no diálogo)
 *     por cima da cópia MAIS RECENTE — a local ou a da nuvem. Gravar a local
 *     às cegas, com carimbo novo, desfazia uma mudança feita noutro aparelho
 *     (o salário, por exemplo). Sem rede, não se mexe no perfil: a folha já
 *     leva os dados no PDF, e o diálogo volta a oferecê-los noutra folha.
 *   • sem perfil nenhum (quem respondeu "Agora não"): cria-se o primeiro, com
 *     os dados, a função e o valor da folha — mas só com a certeza de que a
 *     conta não tem perfil na nuvem. Senão os dados perdiam-se e as folhas
 *     seguintes nasciam vazias.
 */
export async function guardarDadosNoPerfil(
  uid: string,
  perfilId: string | undefined,
  dados: DadosFolha,
  iniciais: DadosFolha | null,
  folha: { formato?: string; perfil?: { funcao?: string }; tabela?: { salarioDia?: number; salarioSemana?: number } }
): Promise<void> {
  try {
    // Sem profileId (folhas antigas) a folha é do perfil ativo (belongsToProfile)
    const local = (perfilId ? await getProfileById(perfilId) : null) ?? (await getActiveProfile());
    if (!local) {
      // Sem perfil: o primeiro, com os dados do diálogo
      const cinema = folha.formato === "cinema";
      const base = perfilInicial(String(Date.now()), {
        formato: cinema ? "cinema" : "publicidade",
        funcao: folha.perfil?.funcao ?? "",
        valor: Number(cinema ? folha.tabela?.salarioSemana : folha.tabela?.salarioDia) || undefined,
      });
      await criarPrimeiroPerfil(uid, { ...base, ...patchPerfilDono(null, dados) });
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("data, updated_at")
      .eq("user_id", uid)
      .eq("id", local.id)
      .maybeSingle();
    if (error) return; // sem rede: fica para outra vez
    const remoto = data?.data as Profile | undefined;
    const ts = (v: unknown) => {
      const n = Date.parse(String(v ?? ""));
      return Number.isFinite(n) ? n : 0;
    };
    const base: Profile =
      remoto && !(remoto as any).deleted && ts(remoto.updatedAt ?? data?.updated_at) > ts(local.updatedAt)
        ? { ...remoto, id: local.id }
        : local;
    const patch = patchPerfilDono(base, dados, iniciais);
    if (!Object.keys(patch).length) return;
    const gravado = await upsertProfile({ ...base, ...patch });
    syncProfileToCloud(uid, gravado).catch(() => {});
  } catch {
    /* o PDF já saiu com os dados; o perfil fica para outra vez */
  }
}
