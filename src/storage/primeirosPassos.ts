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
// Lê-se a sessão guardada (getSession): o AuthContext ignora o USER_UPDATED,
// por isso o `user` do contexto fica com os metadados velhos. E a sessão
// guardada também pode estar velha (só se renova com o token, ~1 h): por isso
// "nao_aplica" nunca se escreve por cima de "feita"/"adiada" sem confirmar no
// servidor — senão um aparelho com a sessão antiga apagava a marca de uma
// conta que tinha acabado de responder noutro aparelho.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { eExemplo } from "./exemploMarca";
import {
  estadoPassos,
  juntarMarcas,
  MARCA_PASSO_DIA,
  MARCA_PASSO_PDF,
  MARCA_PASSOS_FECHADOS,
  MARCA_PRIMEIRA_ENTRADA,
  type EstadoPassos,
  type Marcas,
} from "./passosRegras";
import { getActiveProfile } from "./profile";
import { listAllProjectsFull } from "./projects";

const chaveLocal = (uid: string) => `passos:v1:${uid}`;
const respondida = (v: unknown) => v === "feita" || v === "adiada";

async function lerLocal(uid: string): Promise<Marcas> {
  try {
    const raw = await AsyncStorage.getItem(chaveLocal(uid));
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Os metadados da sessão GUARDADA (sem rede; podem ter até ~1 h). */
async function lerMetadados(): Promise<Marcas> {
  try {
    const { data } = await supabase.auth.getSession();
    return (data.session?.user?.user_metadata ?? {}) as Marcas;
  } catch {
    return {};
  }
}

/** Os metadados acabados de pedir ao servidor. `null` = sem rede/erro. */
async function lerMetadadosFrescos(): Promise<Marcas | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return (data.user.user_metadata ?? {}) as Marcas;
  } catch {
    return null;
  }
}

export async function lerMarcas(uid: string): Promise<Marcas> {
  const [meta, local] = await Promise.all([lerMetadados(), lerLocal(uid)]);
  return juntarMarcas(meta, local);
}

/**
 * As marcas SEM esperar pela rede, para o que está no caminho de um toque (o
 * botão de exportar): sem rede e com o token expirado, o getSession tenta
 * renovar durante ~25 s. Passado `ms`, valem as marcas locais.
 */
export async function lerMarcasRapido(uid: string, ms = 300): Promise<Marcas> {
  const local = lerLocal(uid);
  const prazo = new Promise<null>((r) => setTimeout(() => r(null), ms));
  const todas = await Promise.race([lerMarcas(uid).catch(() => null), prazo]);
  return todas ?? juntarMarcas({}, await local);
}

/* ---------- Folhas onde a pessoa já confirmou os dados no diálogo ---------- */
// Por folha: o que o PERFIL tinha quando a pessoa confirmou. O diálogo só
// volta a aparecer nessa folha se o perfil ganhar algo novo para um campo que
// a folha tem vazio (ver novoParaOferecer). Fica neste aparelho.

const chaveConfirmadas = (uid: string) => `passos:dados-confirmados:v1:${uid}`;
type Confirmacao = Partial<Record<string, string>>;

export async function confirmacaoDeDados(uid: string): Promise<Map<string, Confirmacao>> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(chaveConfirmadas(uid))) || "{}");
    if (Array.isArray(v)) return new Map(v.map((id: unknown) => [String(id), {}])); // formato antigo
    return new Map(Object.entries(v && typeof v === "object" ? (v as Record<string, Confirmacao>) : {}));
  } catch {
    return new Map();
  }
}

export async function marcarDadosConfirmados(uid: string | undefined, folhaId: string, perfilNaAltura: Confirmacao): Promise<void> {
  if (!uid) return;
  try {
    const mapa = await confirmacaoDeDados(uid);
    mapa.delete(folhaId);
    mapa.set(folhaId, perfilNaAltura);
    const ultimas = [...mapa.entries()].slice(-500);
    await AsyncStorage.setItem(chaveConfirmadas(uid), JSON.stringify(Object.fromEntries(ultimas)));
  } catch {
    /* sem armazenamento: o diálogo pode voltar a aparecer nesta folha */
  }
}

/** Grava só a cópia local (sem rede, imediato) — para o ecrã mudar já. */
export async function marcarLocal(uid: string | undefined, marcas: Marcas): Promise<void> {
  if (!uid) return;
  try {
    const local = await lerLocal(uid);
    const novo = { ...local, ...marcas };
    // A primeira entrada respondida nunca volta a "nao_aplica"
    if (respondida(local[MARCA_PRIMEIRA_ENTRADA]) && marcas[MARCA_PRIMEIRA_ENTRADA] === "nao_aplica") {
      novo[MARCA_PRIMEIRA_ENTRADA] = local[MARCA_PRIMEIRA_ENTRADA];
    }
    if (JSON.stringify(novo) !== JSON.stringify(local)) await AsyncStorage.setItem(chaveLocal(uid), JSON.stringify(novo));
  } catch {
    /* sem armazenamento: fica só nos metadados */
  }
}

/**
 * Grava marcas da conta: na cópia local e nos metadados. Sobem as marcas
 * pedidas agora e as que só existem localmente (gravadas sem rede). Em
 * silêncio: sem rede ficam locais e sobem numa próxima vez.
 */
export async function marcarConta(uid: string | undefined, marcas: Marcas): Promise<void> {
  if (!uid) return;
  try {
    let pedidas = { ...marcas };
    // "nao_aplica" só se escreve se o servidor CONFIRMAR que a conta ainda não
    // respondeu à primeira entrada (a sessão guardada pode estar velha).
    if (pedidas[MARCA_PRIMEIRA_ENTRADA] === "nao_aplica") {
      const fresca = await lerMetadadosFrescos();
      if (fresca && respondida(fresca[MARCA_PRIMEIRA_ENTRADA])) {
        pedidas = { ...pedidas, [MARCA_PRIMEIRA_ENTRADA]: fresca[MARCA_PRIMEIRA_ENTRADA] };
      } else if (!fresca) {
        // Sem confirmação: fica só local (e nunca sobe — ver abaixo)
        await marcarLocal(uid, pedidas);
        const { [MARCA_PRIMEIRA_ENTRADA]: _x, ...resto } = pedidas;
        pedidas = resto;
        if (!Object.keys(pedidas).length) return;
      }
    }
    await marcarLocal(uid, pedidas);
    const local = await lerLocal(uid);
    const meta = await lerMetadados();
    const subir: Marcas = {};
    // As pedidas agora (se diferentes) e as locais que nunca chegaram a subir
    for (const [k, v] of Object.entries(pedidas)) if (meta[k] !== v) subir[k] = v;
    for (const [k, v] of Object.entries(local)) {
      if (k in subir || meta[k] !== undefined) continue;
      // Um "nao_aplica" que ficou local sem confirmação não sobe sozinho
      if (k === MARCA_PRIMEIRA_ENTRADA && v === "nao_aplica") continue;
      subir[k] = v;
    }
    if (Object.keys(subir).length) await supabase.auth.updateUser({ data: subir });
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
