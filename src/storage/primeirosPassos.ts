// "Primeiros passos" (18/11/2026): o cartão da página inicial com três coisas
// para fazer — registar um dia, exportar o PDF e completar o perfil. As regras
// (puras) estão em passosRegras.ts; aqui lê-se e grava-se.
//
// Só as contas novas veem o cartão: as que passaram pela primeira entrada
// (feita ou adiada). Quem já usava a app antes nunca o vê — a lista dizia-lhe
// "regista um dia" com 20 folhas feitas.
//
// As marcas vivem nos METADADOS da conta (seguem a pessoa para outro aparelho)
// e numa cópia LOCAL por conta, que mostra o passo feito logo, mesmo sem rede.
// Lê-se sempre a sessão guardada (getSession): o AuthContext ignora o
// USER_UPDATED, por isso o `user` do contexto fica com os metadados velhos.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { eExemplo } from "./exemploMarca";
import {
  estadoPassos,
  juntarMarcas,
  MARCA_PASSO_DIA,
  MARCA_PASSO_PDF,
  MARCA_PASSOS_FECHADOS,
  type EstadoPassos,
  type Marcas,
} from "./passosRegras";
import { getActiveProfile } from "./profile";
import { listAllProjectsFull } from "./projects";

const chaveLocal = (uid: string) => `passos:v1:${uid}`;

async function lerLocal(uid: string): Promise<Marcas> {
  try {
    const raw = await AsyncStorage.getItem(chaveLocal(uid));
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Os metadados da sessão GUARDADA (frescos depois de um updateUser). */
async function lerMetadados(): Promise<Marcas> {
  try {
    const { data } = await supabase.auth.getSession();
    return (data.session?.user?.user_metadata ?? {}) as Marcas;
  } catch {
    return {};
  }
}

export async function lerMarcas(uid: string): Promise<Marcas> {
  const [meta, local] = await Promise.all([lerMetadados(), lerLocal(uid)]);
  return juntarMarcas(meta, local);
}

/**
 * Grava marcas da conta: já na cópia local e, se ainda não estiverem nos
 * metadados, também lá. Em silêncio — sem rede ficam só locais e sobem da
 * próxima vez que se marcar alguma coisa.
 */
export async function marcarConta(uid: string | undefined, marcas: Marcas): Promise<void> {
  if (!uid) return;
  try {
    const local = await lerLocal(uid);
    const novoLocal = { ...local, ...marcas };
    if (JSON.stringify(novoLocal) !== JSON.stringify(local)) {
      await AsyncStorage.setItem(chaveLocal(uid), JSON.stringify(novoLocal));
    }
    // Sobe o que falta nos metadados (incluindo marcas que ficaram só locais
    // por falta de rede)
    const meta = await lerMetadados();
    const falta: Marcas = {};
    for (const [k, v] of Object.entries(novoLocal)) if (meta[k] !== v) falta[k] = v;
    if (Object.keys(falta).length) await supabase.auth.updateUser({ data: falta });
  } catch {
    /* fica local; sobe da próxima vez */
  }
}

/** Marca um passo como feito (uma vez por conta; as seguintes não fazem nada). */
export async function marcarPasso(uid: string | undefined, passo: "dia" | "pdf"): Promise<void> {
  if (!uid) return;
  const chave = passo === "dia" ? MARCA_PASSO_DIA : MARCA_PASSO_PDF;
  if ((await lerLocal(uid))[chave] === true) return; // já marcado neste aparelho
  await marcarConta(uid, { [chave]: true });
}

export async function fecharPassos(uid: string | undefined): Promise<void> {
  await marcarConta(uid, { [MARCA_PASSOS_FECHADOS]: true });
}

export async function lerEstadoPassos(uid: string): Promise<EstadoPassos> {
  const [m, perfil] = await Promise.all([lerMarcas(uid), getActiveProfile().catch(() => null)]);
  return estadoPassos(m, perfil);
}

/** A folha SUA mais recente (sem a de exemplo), para os atalhos do cartão. */
export async function ultimaFolhaPropria(): Promise<string | null> {
  try {
    const todas = (await listAllProjectsFull()).filter((p) => !eExemplo(p));
    todas.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return todas[0]?.id ?? null;
  } catch {
    return null;
  }
}
