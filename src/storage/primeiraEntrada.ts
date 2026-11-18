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
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { zerosSemeados } from "./taxasZero";
import { createProject, getProject, listAllProjectsFull, saveProject } from "./projects";

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
 * A contagem na nuvem com prazo: no décor, com a rede em "buraco negro", o
 * fetch do Android não tem limite e o do iOS só desiste aos 60 s (com novas
 * tentativas, ~4 min) — e o "Criar" ficava preso sem saída. Passado o prazo
 * vale "não se sabe" (null): não se cria nada e o ecrã diz "tenta outra vez".
 * O resultado que chegar depois é ignorado.
 */
function contarComPrazo(uid: string, ms = 10_000): Promise<{ perfis: number; folhas: number } | null> {
  return Promise.race([contarNaNuvem(uid), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
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
  const nuvem = await contarComPrazo(uid);
  if (!nuvem || nuvem.perfis > 0) return null;
  if ((await listProfiles()).length > 0) return null;
  const gravado = await upsertProfile(perfil);
  await setActiveProfileId(gravado.id);
  syncProfileToCloud(uid, gravado).catch(() => {});
  return gravado;
}

/**
 * Cria o perfil e a folha desta semana. Devolve o id da folha, ou `null` se a
 * conta já tem um perfil (aqui ou na nuvem) ou folhas noutro aparelho — aí
 * não cria nada. Sem saber o que há na nuvem LANÇA, para o ecrã dizer "tenta
 * outra vez".
 *
 * Se a pessoa já criou uma folha com o "+" antes de as perguntas aparecerem
 * (o 1.º sync pode demorar), as respostas não se perdem: cria-se o perfil e
 * essa folha ganha a função e o valor que estivessem por preencher.
 */
export async function concluirPrimeiraEntrada(uid: string, d: DadosPrimeiraEntrada): Promise<string | null> {
  const nuvem = await contarComPrazo(uid);
  if (!nuvem) throw new Error("sem_nuvem");
  const proprias = (await listAllProjectsFull()).filter((p) => !eExemplo(p));
  const semDados = nuvem.perfis === 0 && (await listProfiles()).length === 0;
  // Folhas na nuvem que ainda não chegaram aqui = a conta já é usada noutro aparelho
  if (!semDados || (nuvem.folhas > 0 && !proprias.length)) {
    // A marca local já; a subida para a conta sem esperar (ver o fim)
    await marcarLocal(uid, { [MARCA_PRIMEIRA_ENTRADA]: "nao_aplica" });
    marcarConta(uid, { [MARCA_PRIMEIRA_ENTRADA]: "nao_aplica" }).catch(() => {});
    return null;
  }
  const perfil = await criarPrimeiroPerfil(uid, perfilInicial(String(Date.now()), d));
  if (!perfil) throw new Error("sem_nuvem");

  let id: string;
  if (proprias.length) {
    // A folha que já criou (a mais recente): função e valor, se faltarem
    proprias.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const f = proprias[0];
    const cinema = f.formato === "cinema";
    const valor = d.valor && d.valor > 0 && cinema === (d.formato === "cinema") ? d.valor : undefined;
    const tabela = { ...f.tabela };
    const salarioVazio = cinema ? !(Number(tabela.salarioSemana) > 0) : !(Number(tabela.salarioDia) > 0);
    if (valor && salarioVazio) {
      if (cinema) tabela.salarioSemana = valor;
      else tabela.salarioDia = valor;
      // Taxas gravadas a 0 pela semente antiga do editor numa folha sem
      // salário: com elas as horas extra pagavam 0 €; sem elas seguem o
      // salário agora preenchido. Só essas (zerosSemeados): um 0 escolhido fica.
      for (const k of zerosSemeados(f.tabela as any)) delete (tabela as any)[k];
      if (!cinema) (tabela as any).semSemente = true;
    }
    const funcao = String(f.perfil?.funcao ?? "").trim() ? f.perfil.funcao : perfil.funcao;
    const mudou = JSON.stringify(tabela) !== JSON.stringify(f.tabela) || funcao !== f.perfil?.funcao;
    if (mudou) {
      const gravada = await saveProject({ ...f, tabela, perfil: { ...f.perfil, funcao }, profileId: perfil.id });
      syncProjectToCloud(uid, gravada as any).catch(() => {});
    }
    id = f.id;
  } else {
    // Publicidade: um dia, hoje. Cinema: a semana desta segunda a domingo.
    id = await createProject(d.formato === "cinema" ? { formato: "cinema", diasSemana: 5 } : {});
    const folha = await getProject(id);
    if (folha) syncProjectToCloud(uid, folha).catch(() => {});
  }
  // exemplo_v1: a conta já tem a sua folha, não precisa da de exemplo.
  // A marca local já (o perfil e a folha também já estão gravados); a subida
  // para a conta vai sem esperar: com a rede presa, o "Criar" ficava a rodar
  // e sem saída depois de tudo feito. Sem rede sobe numa próxima vez.
  const feita = { [MARCA_PRIMEIRA_ENTRADA]: "feita" as const, exemplo_v1: true };
  await marcarLocal(uid, feita);
  marcarConta(uid, feita).catch(() => {});
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

/* ---------- Os dados do diálogo de exportação, no perfil ---------- */

type FolhaDados = { formato?: string; perfil?: { funcao?: string } };
/** `em`: quando o diálogo foi confirmado; `id`: para não apagar um pendente mais novo */
type Pendente = { perfilId?: string; dados: DadosFolha; iniciais: DadosFolha | null; folha: FolhaDados; em?: number; id?: string };

const chavePendente = (uid: string) => `passos:dados-pendentes:v1:${uid}`;

/**
 * Os dados escritos no diálogo da exportação (nome, email, telefone, NIF,
 * IBAN) chegam ao perfil dono da folha. Devolve se ficaram gravados (ou se não
 * havia nada a gravar); `false` = fica para depois (ver guardarDadosOuAdiar).
 *   • com perfil: aplica-se o que falta (ou o que a pessoa mudou no diálogo)
 *     por cima da cópia MAIS RECENTE — a local ou a da nuvem. Gravar a local
 *     às cegas, com carimbo novo, desfazia uma mudança feita noutro aparelho
 *     (o salário, por exemplo).
 *   • sem perfil nenhum (quem respondeu "Agora não"): cria-se o primeiro, com
 *     os dados e a função da folha — só com a certeza de que a conta não tem
 *     perfil na nuvem. O valor da folha NÃO passa para o perfil: a pessoa não
 *     o confirmou aqui (podia ser o da folha de exemplo, ou o de uma semana
 *     de 6 dias, que no perfil passava a valer para as de 5).
 */
export function guardarDadosNoPerfil(
  uid: string,
  perfilId: string | undefined,
  dados: DadosFolha,
  iniciais: DadosFolha | null,
  folha: FolhaDados,
  desde?: number
): Promise<boolean> {
  // Uma gravação de cada vez: a do diálogo e a reposição do sync, em
  // paralelo, podiam criar DOIS primeiros perfis
  const vez = filaGravacoes.then(() => guardarAgora(uid, perfilId, dados, iniciais, folha, desde));
  filaGravacoes = vez.catch(() => false);
  return vez;
}
let filaGravacoes: Promise<unknown> = Promise.resolve();

async function guardarAgora(
  uid: string,
  perfilId: string | undefined,
  dados: DadosFolha,
  iniciais: DadosFolha | null,
  folha: FolhaDados,
  desde?: number
): Promise<boolean> {
  try {
    // Só com a sessão DESTA conta. Sem ela (sessão morta, ou já de outra conta
    // depois de uma troca com um sync a meio), o pedido abaixo ia como anónimo
    // e as regras devolviam 0 linhas SEM erro: parecia não haver cópia na
    // nuvem, a local velha ia por cima de uma correção mais recente, ou os
    // dados desta conta iam para o perfil da outra. Fica pendente.
    const { data: s } = await supabase.auth.getSession();
    if (s.session?.user?.id !== uid) return false;
    // Sem profileId (folhas antigas) a folha é do perfil ativo (belongsToProfile)
    const local = (perfilId ? await getProfileById(perfilId) : null) ?? (await getActiveProfile());
    if (!local) {
      const base = perfilInicial(String(Date.now()), {
        formato: folha.formato === "cinema" ? "cinema" : "publicidade",
        funcao: folha.perfil?.funcao ?? "",
      });
      // null = sem rede, ou já há perfil na nuvem (chega no próximo sync e o
      // pendente aplica-se então por cima dele)
      return !!(await criarPrimeiroPerfil(uid, { ...base, ...patchPerfilDono(null, dados) }));
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("data, updated_at")
      .eq("user_id", uid)
      .eq("id", local.id)
      .maybeSingle();
    if (error) return false; // sem rede: fica pendente
    const remoto = data?.data as Profile | undefined;
    const ts = (v: unknown) => {
      const n = Date.parse(String(v ?? ""));
      return Number.isFinite(n) ? n : 0;
    };
    const base: Profile =
      remoto && !(remoto as any).deleted && ts(remoto.updatedAt ?? data?.updated_at) > ts(local.updatedAt)
        ? { ...remoto, id: local.id }
        : local;
    // Reposição de um pendente: se o perfil mudou DEPOIS do diálogo (corrigiu
    // o IBAN no computador, por exemplo), só se preenchem os campos vazios —
    // o "mudado no diálogo" já não vale contra uma correção mais recente.
    const ini = desde != null && ts(base.updatedAt) > desde ? null : iniciais;
    const patch = patchPerfilDono(base, dados, ini);
    if (!Object.keys(patch).length) return true;
    const gravado = await upsertProfile({ ...base, ...patch });
    syncProfileToCloud(uid, gravado).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Grava os dados no perfil; se não der agora (sem rede no décor — o PDF faz-se
 * sem rede), ficam PENDENTES e aplicam-se na próxima sincronização. Sem isto
 * perdiam-se: a folha seguinte nascia vazia e o diálogo já não perguntava.
 */
export async function guardarDadosOuAdiar(
  uid: string,
  perfilId: string | undefined,
  dados: DadosFolha,
  iniciais: DadosFolha | null,
  folha: FolhaDados
): Promise<void> {
  // O pendente fica gravado ANTES de tentar a rede: sem rede, a tentativa
  // pode demorar ~25-50 s (o Supabase tenta renovar o token) e, se a app for
  // fechada entretanto, os dados perdiam-se. Sai só se a gravação resultar.
  const em = Date.now();
  const pendente: Pendente = {
    perfilId,
    dados,
    iniciais,
    folha: { formato: folha.formato, perfil: { funcao: folha.perfil?.funcao } },
    em,
    id: `${em}-${Math.random().toString(36).slice(2, 8)}`,
  };
  try {
    await AsyncStorage.setItem(chavePendente(uid), JSON.stringify(pendente));
  } catch {
    /* sem armazenamento: tenta-se só agora */
  }
  if (await guardarDadosNoPerfil(uid, perfilId, dados, iniciais, folha)) await tirarPendente(uid, pendente.id);
}

/** Apaga o pendente só se ainda for o mesmo (não um de um diálogo mais novo). */
async function tirarPendente(uid: string, id: string | undefined): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(chavePendente(uid));
    if (!raw) return;
    const atual = JSON.parse(raw) as Pendente;
    if (!id || atual?.id === id) await AsyncStorage.removeItem(chavePendente(uid));
  } catch {
    /* fica para a próxima */
  }
}

/** O pendente desta conta, sem rede (para o diálogo da exportação seguinte). */
export async function lerDadosPendentes(uid: string): Promise<Pendente | null> {
  try {
    const raw = await AsyncStorage.getItem(chavePendente(uid));
    const p = raw ? (JSON.parse(raw) as Pendente) : null;
    return p?.dados ? p : null;
  } catch {
    return null;
  }
}

/** Chamado pelo SyncProvider depois de cada sincronização. */
export async function aplicarDadosPendentes(uid: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(chavePendente(uid));
    if (!raw) return;
    const p = JSON.parse(raw) as Pendente;
    if (!p?.dados) {
      await AsyncStorage.removeItem(chavePendente(uid));
      return;
    }
    // `desde`: o que se mudou no perfil DEPOIS do diálogo ganha ao "mudado no diálogo"
    if (await guardarDadosNoPerfil(uid, p.perfilId, p.dados, p.iniciais ?? null, p.folha ?? {}, p.em ?? 0)) {
      await tirarPendente(uid, p.id);
    }
  } catch {
    /* fica para a próxima */
  }
}
