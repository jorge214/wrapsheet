// Regras PURAS da primeira entrada, dos primeiros passos e dos dados pedidos
// na primeira exportação (18/11/2026). Sem rede nem armazenamento, para se
// testarem. Quem lê e grava é primeiraEntrada.ts e primeirosPassos.ts.
import type { Profile } from "./profile";

/** "feita" | "adiada" (contas novas) | "nao_aplica" (já tinham perfil ou folhas) */
export const MARCA_PRIMEIRA_ENTRADA = "primeira_entrada_v1";
export const MARCA_PASSO_DIA = "passo_dia_v1";
export const MARCA_PASSO_PDF = "passo_pdf_v1";
export const MARCA_PASSOS_FECHADOS = "passos_fechados_v1";

export type Marcas = Record<string, unknown>;

const vazio = (v: unknown) => String(v ?? "").trim() === "";

/** Campos de UMA linha: quebras coladas viram espaço (como na folha). */
export const umaLinha = (v: unknown) => String(v ?? "").replace(/\s*[\r\n\u2028\u2029\u0085]+\s*/g, " ").trim();

/* ---------- Primeira entrada ---------- */

export type DadosPrimeiraEntrada = {
  formato: "publicidade" | "cinema";
  funcao: string;
  /** Publicidade: € por DIA. Cinema: € por SEMANA de 5 dias. Vazio = por preencher. */
  valor?: number;
};

/** A primeira entrada aparece? `null` na nuvem = não se sabe → não. */
export function precisaPrimeiraEntrada(o: {
  marcado: boolean;
  perfisLocais: number;
  folhasLocais: number;
  perfisNuvem: number | null;
  folhasNuvem: number | null;
}): boolean {
  if (o.marcado) return false;
  if (o.perfisLocais > 0 || o.folhasLocais > 0) return false;
  return o.perfisNuvem === 0 && o.folhasNuvem === 0;
}

/**
 * O perfil que a primeira entrada cria. O valor vai para o sítio que cada
 * formato lê ao criar folhas: o salário ao DIA da publicidade, ou o salário à
 * SEMANA do cinema (a folha de cinema divide-o pelos dias da semana). Pedir
 * "ao dia" no cinema e multiplicar por 5 pagava mal as semanas de 6 dias.
 */
export function perfilInicial(id: string, d: DadosPrimeiraEntrada): Profile {
  const valor = typeof d.valor === "number" && Number.isFinite(d.valor) && d.valor > 0 ? d.valor : undefined;
  return {
    id,
    nome: "",
    email: "",
    telefone: "",
    departamento: "",
    funcao: umaLinha(d.funcao).replace(/\s+/g, " "),
    empresa: "",
    nif: "",
    iban: "",
    swift: "",
    condicoes: "",
    condTitulo: "",
    condBoxes: [],
    fixas: d.formato === "publicidade" && valor ? { salarioDia: valor } : {},
    ...(d.formato === "cinema" && valor ? { fixasCinema: { salarioSemana: valor } } : {}),
  };
}

/** Lê o valor escrito ("250", "1.250,50", "250 €"). Vazio ou inválido = undefined. */
export function lerValor(txt: string): number | undefined {
  const limpo = String(txt ?? "").replace(/[^\d,.]/g, "");
  if (!limpo) return undefined;
  // O último separador é o decimal; os outros são de milhares
  const ultimo = Math.max(limpo.lastIndexOf(","), limpo.lastIndexOf("."));
  const n = ultimo >= 0 && limpo.length - ultimo - 1 <= 2
    ? Number(limpo.slice(0, ultimo).replace(/[.,]/g, "") + "." + limpo.slice(ultimo + 1))
    : Number(limpo.replace(/[.,]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/* ---------- Primeiros passos ---------- */

export type EstadoPassos = {
  /** O cartão aparece? (conta nova e não fechado) */
  visivel: boolean;
  /** A conta passou pela primeira entrada (feita ou adiada)? */
  contaNova: boolean;
  dia: boolean;
  pdf: boolean;
  perfil: boolean;
  feitos: number;
};

/** O perfil tem o que a produção precisa para pagar: nome, NIF e IBAN. */
export function perfilCompleto(p?: { nome?: string; nif?: string; iban?: string } | null): boolean {
  return !!p && !vazio(p.nome) && !vazio(p.nif) && !vazio(p.iban);
}

/** As marcas da conta: as dos metadados por cima das locais. */
export function juntarMarcas(meta: Marcas, local: Marcas): Marcas {
  const out: Marcas = { ...local };
  for (const [k, v] of Object.entries(meta)) if (v != null && v !== false) out[k] = v;
  return out;
}

/** Conta nova = passou pela primeira entrada (feita ou adiada). */
export function contaNova(m: Marcas): boolean {
  const v = m[MARCA_PRIMEIRA_ENTRADA];
  return v === "feita" || v === "adiada";
}

export function estadoPassos(m: Marcas, perfil?: { nome?: string; nif?: string; iban?: string } | null): EstadoPassos {
  const novo = contaNova(m);
  const dia = !!m[MARCA_PASSO_DIA];
  const pdf = !!m[MARCA_PASSO_PDF];
  const perf = perfilCompleto(perfil);
  return {
    visivel: novo && !m[MARCA_PASSOS_FECHADOS],
    contaNova: novo,
    dia,
    pdf,
    perfil: perf,
    feitos: [dia, pdf, perf].filter(Boolean).length,
  };
}

/* ---------- Dados pedidos na primeira exportação ---------- */

export const CAMPOS_DADOS = ["nome", "email", "telefone", "nif", "iban"] as const;
export type CampoDados = (typeof CAMPOS_DADOS)[number];
export type DadosFolha = Record<CampoDados, string>;
type ParcialDados = Partial<Record<CampoDados, string | undefined>>;

/**
 * Na exportação pedem-se os dados que saem no PDF?
 *   • Antes do 1.º PDF a sério: a uma conta nova, se faltar nome, NIF ou IBAN;
 *     a quem já usava a app, só se a folha não tiver nome (nunca se incomoda
 *     quem já trabalha assim).
 *   • Depois: só a contas novas, e só se o PERFIL tiver algo que falta a esta
 *     folha — as folhas feitas antes de haver dados no perfil (a semana
 *     seguinte duplicada, por exemplo) nasceram vazias e saíam sem NIF/IBAN.
 *     O diálogo vem preenchido: é um toque. Quem deixou um campo vazio no
 *     perfil de propósito nunca é incomodado por ele.
 */
export function pedirDadosNaExportacao(perfilFolha: ParcialDados, m: Marcas, perfilDono?: ParcialDados | null): boolean {
  if (!m[MARCA_PASSO_PDF]) {
    if (vazio(perfilFolha.nome)) return true;
    return contaNova(m) && (vazio(perfilFolha.nif) || vazio(perfilFolha.iban));
  }
  if (!contaNova(m)) return false;
  return CAMPOS_DADOS.some((k) => vazio(perfilFolha[k]) && !vazio(perfilDono?.[k]));
}

/**
 * O perfil dono com os dados que ficaram PENDENTES (escritos numa exportação
 * sem rede, ainda por gravar no perfil) por cima dos campos VAZIOS — só se o
 * pendente for deste perfil (ou de "nenhum perfil"). Assim a folha seguinte,
 * no mesmo décor sem rede, ainda é oferecida com eles.
 */
export function perfilComPendentes(
  dono: ParcialDados | null | undefined,
  pendente: { perfilId?: string; dados?: Partial<DadosFolha> } | null | undefined,
  donoId?: string
): ParcialDados | null {
  const deste = !!pendente?.dados && (pendente.perfilId == null || pendente.perfilId === donoId);
  if (!deste) return dono ?? null;
  const out: ParcialDados = { ...(dono ?? {}) };
  for (const k of CAMPOS_DADOS) {
    const p = umaLinha(pendente!.dados![k]);
    if (p && vazio(out[k])) out[k] = p;
  }
  return out;
}

/**
 * Numa folha onde a pessoa já confirmou os dados no diálogo: o perfil tem
 * agora algo NOVO para um campo que está vazio na folha (diferente do que
 * havia quando confirmou)? Só então se volta a perguntar — um campo deixado
 * vazio de propósito não volta a cada exportação, mas o IBAN acrescentado
 * depois ao perfil é oferecido.
 */
export function novoParaOferecer(perfilFolha: ParcialDados, dono: ParcialDados | null | undefined, confirmacao: ParcialDados): boolean {
  return CAMPOS_DADOS.some(
    (k) => vazio(perfilFolha[k]) && !vazio(dono?.[k]) && umaLinha(dono?.[k]) !== umaLinha(confirmacao[k])
  );
}

/** O formulário começa com o que já existe: a folha, depois o perfil, e o email da conta. */
export function dadosIniciais(perfilFolha: ParcialDados, perfilDono: ParcialDados | null | undefined, emailConta?: string): DadosFolha {
  const out = {} as DadosFolha;
  for (const k of CAMPOS_DADOS) {
    const daFolha = umaLinha(perfilFolha[k]);
    const doPerfil = umaLinha(perfilDono?.[k]);
    out[k] = daFolha || doPerfil || (k === "email" ? umaLinha(emailConta) : "");
  }
  return out;
}

/** A folha leva o que está no formulário (é o que a pessoa viu e confirmou). */
export function perfilFolhaComDados<T extends ParcialDados>(perfilFolha: T, dados: DadosFolha): T {
  const out = { ...perfilFolha } as Record<string, unknown>;
  for (const k of CAMPOS_DADOS) out[k] = umaLinha(dados[k]);
  return out as T;
}

/**
 * O que o perfil ganha com o formulário: os campos que lá estão VAZIOS e os
 * que a pessoa MUDOU neste diálogo (corrigiu o IBAN que veio do perfil, por
 * exemplo — o diálogo promete que fica no perfil). Um campo apagado nunca
 * apaga o do perfil, e o que veio preenchido e não se mexeu não troca nada.
 * `iniciais` = o que o formulário mostrava ao abrir.
 */
export function patchPerfilDono(
  perfilDono: ParcialDados | null | undefined,
  dados: DadosFolha,
  iniciais?: DadosFolha | null
): Partial<DadosFolha> {
  const out: Partial<DadosFolha> = {};
  for (const k of CAMPOS_DADOS) {
    const novo = umaLinha(dados[k]);
    if (!novo) continue;
    const atual = umaLinha(perfilDono?.[k]);
    if (!atual) out[k] = novo;
    else if (iniciais && novo !== umaLinha(iniciais[k]) && novo !== atual) out[k] = novo;
  }
  return out;
}
