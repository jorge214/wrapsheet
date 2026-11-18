// Registo das exportações de PDF (tabela pdf_exports — migração 0004).
//
// Serve só para medir a ativação: o relatório semanal (migração 0005) conta
// quantas contas novas exportam o 1.º PDF nos primeiros 7 dias. Nunca pode
// atrapalhar a exportação: corre em silêncio e nada aqui lança.
//
// Sem rede (o PDF faz-se offline no telemóvel) o evento fica numa fila no
// aparelho e segue na exportação seguinte ou na próxima sincronização. A fila
// guarda a conta de cada evento: o servidor regista sempre a conta da SESSÃO
// (o cliente nem pode escrever o user_id), por isso um evento da conta A só
// sai quando a A estiver outra vez com sessão neste aparelho.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export type ExportacaoPdf = {
  formato: "publicidade" | "cinema";
  orientacao: "landscape" | "portrait";
  /** Era a folha de exemplo? (não conta para a ativação) */
  exemplo: boolean;
  folhaId?: string;
};

type Pendente = ExportacaoPdf & { uid: string };

const FILA = "eventos:pdf:fila:v1";
const MAX_FILA = 50;

function plataforma(): "ios" | "android" | "web" | null {
  return Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web" ? Platform.OS : null;
}

/** A linha tal como vai para a tabela (só as colunas que o cliente pode escrever). */
export function linhaExportacao(e: ExportacaoPdf) {
  return {
    formato: e.formato,
    orientacao: e.orientacao,
    plataforma: plataforma(),
    exemplo: !!e.exemplo,
    folha_id: e.folhaId ?? null,
  };
}

/**
 * Falha de rede (vale a pena tentar outra vez) ou recusa do servidor (não
 * vale)? Os erros do PostgREST trazem sempre um `code`; um pedido que nem
 * chegou ao servidor não.
 */
export function eFalhaDeRede(error: { code?: string | null } | null | undefined): boolean {
  return !!error && !error.code;
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

/** Regista uma exportação. Sem rede, fica na fila. */
export async function registarExportacaoPdf(uid: string | undefined, e: ExportacaoPdf): Promise<void> {
  if (!uid) return;
  try {
    const { error } = await supabase.from("pdf_exports").insert(linhaExportacao(e));
    if (!error) {
      await enviarFilaPdf(uid);
      return;
    }
    if (!eFalhaDeRede(error)) return; // recusado pelo servidor: não adianta repetir
  } catch {
    /* sem rede: vai para a fila */
  }
  const fila = await lerFila();
  fila.push({ ...e, uid });
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
    const { error } = await supabase.from("pdf_exports").insert(minhas.map(linhaExportacao));
    // Enviados, ou recusados pelo servidor (repetir não muda nada): saem da fila.
    // Os de outras contas ficam à espera delas.
    if (!error || !eFalhaDeRede(error)) await gravarFila(fila.filter((x) => x.uid !== uid));
  } catch {
    /* sem rede: fica para a próxima */
  } finally {
    aEnviar = false;
  }
}
