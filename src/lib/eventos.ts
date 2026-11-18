// Registo das exportações de PDF (tabela pdf_exports — migrações 0004 e 0006).
//
// Serve só para medir a ativação: o relatório semanal conta quantas contas
// novas exportam o 1.º PDF nos primeiros 7 dias. Nunca pode atrapalhar a
// exportação: corre em silêncio, em segundo plano, e nada aqui lança.
//
// Sem rede (o PDF faz-se offline no telemóvel) o evento fica numa fila no
// aparelho e segue na exportação seguinte ou na próxima sincronização. A fila
// guarda a conta de cada evento e só o envia com a sessão DESSA conta: o
// servidor regista sempre a conta da sessão (o cliente nem pode escrever o
// user_id), por isso um evento da conta A enviado com a sessão de B ficava em
// nome de B — e sem sessão ia como anónimo e era recusado.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export type ExportacaoPdf = {
  formato: "publicidade" | "cinema";
  orientacao: "landscape" | "portrait";
  /** Era a folha de exemplo? (não conta para a ativação) */
  exemplo: boolean;
};

/** Na fila: a conta e a hora (relógio do aparelho) em que o PDF foi feito */
type Pendente = ExportacaoPdf & { uid: string; em?: number };

const FILA = "eventos:pdf:fila:v1";
const MAX_FILA = 50;

function plataforma(): "ios" | "android" | "web" | null {
  return Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web" ? Platform.OS : null;
}

/**
 * A linha tal como vai para a tabela (só as colunas que o cliente pode
 * escrever). `atrasoS`: quantos segundos o evento esperou na fila — o
 * servidor põe a hora de chegada e o relatório recua-a (migração 0006). Só
 * a DIFERENÇA de tempo vem do aparelho, nunca a hora em si.
 */
export function linhaExportacao(e: ExportacaoPdf, atrasoS?: number) {
  return {
    formato: e.formato,
    orientacao: e.orientacao,
    plataforma: plataforma(),
    exemplo: !!e.exemplo,
    // Sem o identificador da folha (a coluna folha_id fica vazia): o relatório
    // não o usa e ligava cada exportação à folha e ao que ela tem. A política
    // de privacidade diz "a data, o formato e a plataforma" — e é só isso.
    ...(atrasoS != null ? { atraso_s: atrasoS } : {}),
  };
}

/** Segundos desde `em` até `agora`, entre 0 e 30 dias (o que o servidor aceita). */
export function atrasoSegundos(em: number | undefined, agora: number): number | undefined {
  if (typeof em !== "number" || !Number.isFinite(em)) return undefined;
  return Math.min(2592000, Math.max(0, Math.round((agora - em) / 1000)));
}

/**
 * Vale a pena tentar outra vez? Sim se o pedido nem chegou ao servidor (sem
 * `code`), se a sessão foi recusada (401: token a expirar, sessão perdida) ou
 * se o servidor falhou (5xx). Uma recusa definitiva (dados inválidos, 400)
 * não se repete.
 */
export function valeRepetir(error: { code?: string | null } | null | undefined, status?: number): boolean {
  if (!error) return false;
  if (!error.code) return true;
  return !status || status === 401 || status >= 500;
}

/** A sessão guardada é desta conta? (sem ela o pedido iria como anónimo) */
async function sessaoDe(uid: string): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id === uid;
  } catch {
    return false;
  }
}

async function lerFila(): Promise<Pendente[]> {
  try {
    const raw = await AsyncStorage.getItem(FILA);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function gravarFila(fila: Pendente[]): Promise<void> {
  try {
    if (fila.length) await AsyncStorage.setItem(FILA, JSON.stringify(fila.slice(-MAX_FILA)));
    else await AsyncStorage.removeItem(FILA);
  } catch {
    /* sem armazenamento: perde-se o evento, nunca a exportação */
  }
}

/** Regista uma exportação. Sem rede (ou sem a sessão desta conta), fica na fila. */
export async function registarExportacaoPdf(uid: string | undefined, e: ExportacaoPdf): Promise<void> {
  if (!uid) return;
  try {
    if (await sessaoDe(uid)) {
      const { error, status } = await supabase.from("pdf_exports").insert(linhaExportacao(e));
      if (!error) {
        await enviarFilaPdf(uid);
        return;
      }
      if (!valeRepetir(error, status)) return; // recusado de vez: não adianta repetir
    }
  } catch {
    /* sem rede: vai para a fila */
  }
  const fila = await lerFila();
  fila.push({ ...e, uid, em: Date.now() });
  await gravarFila(fila);
}

let aEnviar = false;

/** Envia o que ficou na fila desta conta (chamado no sync e depois de cada registo). */
export async function enviarFilaPdf(uid: string | undefined): Promise<void> {
  if (!uid || aEnviar) return;
  aEnviar = true;
  try {
    const fila = await lerFila();
    const minhas = fila.filter((x) => x.uid === uid);
    if (!minhas.length) return;
    // Só com a sessão desta conta (ver o cabeçalho); senão espera
    if (!(await sessaoDe(uid))) return;
    const agora = Date.now();
    const { error, status } = await supabase
      .from("pdf_exports")
      .insert(minhas.map((x) => linhaExportacao(x, atrasoSegundos(x.em, agora))));
    // Enviados, ou recusados de vez: saem da fila. Os de outras contas ficam.
    if (!error || !valeRepetir(error, status)) await gravarFila(fila.filter((x) => x.uid !== uid));
  } catch {
    /* sem rede: fica para a próxima */
  } finally {
    aEnviar = false;
  }
}
