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
// dúvida (sem rede, erro na contagem), não aparece.
import { supabase } from "../lib/supabase";
import { syncProfileToCloud, syncProjectToCloud } from "../sync/syncService";
import { criarExemploSePreciso } from "./exemplo";
import { eExemplo } from "./exemploMarca";
import { MARCA_PRIMEIRA_ENTRADA, perfilInicial, precisaPrimeiraEntrada, type DadosPrimeiraEntrada } from "./passosRegras";
import { lerMarcas, marcarConta } from "./primeirosPassos";
import { listProfiles, setActiveProfileId, upsertProfile } from "./profile";
import { createProject, getProject, listAllProjectsFull } from "./projects";

/** Perfis e folhas suas (vivas, sem a de exemplo) na nuvem. `null` = não se sabe. */
async function contarNaNuvem(uid: string): Promise<{ perfis: number; folhas: number } | null> {
  try {
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
 * Cria o perfil e a folha desta semana. Devolve o id da folha, ou `null` se
 * entretanto apareceram dados noutro aparelho (aí não cria nada).
 */
export async function concluirPrimeiraEntrada(uid: string, d: DadosPrimeiraEntrada): Promise<string | null> {
  // Última verificação: o perfil pode ter sido criado noutro aparelho entretanto
  const nuvem = await contarNaNuvem(uid);
  if (nuvem && (nuvem.perfis > 0 || nuvem.folhas > 0)) {
    await marcarConta(uid, { [MARCA_PRIMEIRA_ENTRADA]: "nao_aplica" });
    return null;
  }
  const perfil = await upsertProfile(perfilInicial(String(Date.now()), d));
  await setActiveProfileId(perfil.id);
  // Publicidade: um dia, hoje. Cinema: a semana desta segunda a domingo.
  const id = await createProject(d.formato === "cinema" ? { formato: "cinema", diasSemana: 5 } : {});
  // A marca logo a seguir: se a app fechar a meio, a primeira entrada não volta.
  // exemplo_v1: a conta já tem a sua folha, não precisa da de exemplo.
  await marcarConta(uid, { [MARCA_PRIMEIRA_ENTRADA]: "feita", exemplo_v1: true });
  syncProfileToCloud(uid, perfil).catch(() => {});
  const folha = await getProject(id);
  if (folha) syncProjectToCloud(uid, folha).catch(() => {});
  return id;
}

/** "Agora não": fica a folha de exemplo, como antes, e o cartão dos passos. */
export async function adiarPrimeiraEntrada(user: { id: string; user_metadata?: Record<string, any> }): Promise<void> {
  await marcarConta(user.id, { [MARCA_PRIMEIRA_ENTRADA]: "adiada" });
  await criarExemploSePreciso(user);
}
