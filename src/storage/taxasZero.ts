// src/storage/taxasZero.ts
// Taxas €/h GRAVADAS A ZERO numa folha de publicidade. Módulo puro, para se
// testar.
//
// Na publicidade um 0 gravado na taxa é respeitado: cada hora extra (HE-A,
// HE-B) ou de recuperação (HR) paga 0 €. Há quem o ponha de propósito, mas a
// maior parte dos zeros que existem veio de dois erros antigos da app:
//   • o editor, aberto numa folha ainda SEM salário, semeava as três taxas a
//     0,00 € — e escrever o salário depois já não as mudava;
//   • apagar a taxa na folha gravava 0 (hoje volta ao automático).
// Em produção, a 18/11/2026: 69 folhas de 50 contas com uma taxa a 0; em 11
// delas (9 contas) havia horas pagas a 0 €, cerca de 4 200 € a menos no total.
// O aviso, corrido sobre essas 69 folhas, dispara nas 11 e em mais nenhuma.
//
// Três peças:
//   1. `sementeTaxas` — a semente do editor, que deixou de semear sem salário;
//   2. `zerosSemeados` + `editarSalario` — os zeros que uma folha SEM salário
//      já tinha ao abrir (os da semente antiga) saem quando o salário é
//      escrito; um 0 posto depois, ou numa folha que já tinha salário, fica;
//   3. `avisoTaxasZero` — para as folhas que já têm salário E horas a 0 €: a
//      app não adivinha se o 0 é de propósito, PERGUNTA ("Usar a taxa
//      automática" / "Está certo assim"). A resposta "está certo" fica na
//      própria tabela (`zeroOk`): segue a folha entre aparelhos e passa para
//      as cópias da MESMA pessoa ("Duplicar"). "Duplicar para outro perfil"
//      não a leva: a resposta era de outra pessoa (projects.ts).
//   Uma folha nova nunca nasce com zeros confirmados, nem os que vêm do
//   perfil: o campo do perfil grava 0 também quando o texto não é um número
//   ("34,09 €"), e confirmá-lo calava o aviso precisamente aí.
//
// O `zeroOk` é um campo NOVO dentro do blob (aditivo): o motor ignora-o e o
// código antigo conserva-o (a leitura faz `{...defaultTabela(), ...raw.tabela}`).
import { ratesFor } from "../calc/engine";
import { calcProject, isCinema, type ProjectLike } from "../calc/project";
import type { Tabela } from "../calc/types";
import { semeiaTaxaHE } from "./horasExtraPerfil";

export const CHAVES_TAXA = ["rateHEA", "rateHEB", "rateHR"] as const;
export type ChaveTaxa = (typeof CHAVES_TAXA)[number];

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Semente do editor (openEditHtml): a taxa €/h que falta é gravada arredondada
 * a 2 casas, para o que a folha mostra e o que o motor paga coincidirem.
 *   • HE-A/HE-B a × 1 (a escolha "hora normal" do perfil) não se semeiam — ver
 *     `semeiaTaxaHE`;
 *   • SEM salário não se semeia nada: ficavam gravadas a 0,00 € e, na
 *     publicidade, um 0 gravado paga 0. Vazias, seguem o salário quando for
 *     escrito.
 * `so` limita a semente a essas taxas (as outras ficam como estão).
 */
export function sementeTaxas(tabela: Tabela, so?: readonly ChaveTaxa[]): Partial<Record<ChaveTaxa, number>> {
  const patch: Partial<Record<ChaveTaxa, number>> = {};
  const R = ratesFor(tabela);
  if (!(R.horaBase > 0)) return patch;
  const quer = (k: ChaveTaxa) => !so || so.includes(k);
  if (quer("rateHEA") && semeiaTaxaHE(tabela, "HEA")) patch.rateHEA = r2(R.rateHEA);
  if (quer("rateHEB") && semeiaTaxaHE(tabela, "HEB")) patch.rateHEB = r2(R.rateHEB);
  if (quer("rateHR") && tabela.rateHR == null) patch.rateHR = r2(R.rateHR);
  return patch;
}

/** As taxas que a pessoa já confirmou a 0 ("Está certo assim"). */
export function zerosConfirmados(tabela: Tabela | null | undefined): ChaveTaxa[] {
  const z = (tabela as { zeroOk?: unknown } | null | undefined)?.zeroOk;
  return Array.isArray(z) ? CHAVES_TAXA.filter((k) => z.includes(k)) : [];
}

/** Folha de cinema pela TABELA (o mesmo critério do motor, em `taxaGravada`):
 *  lá um 0 gravado não é valor — o motor já cai no multiplicador. */
const tabelaDeCinema = (t: Tabela) => t.salarioSemana != null && (Number(t.diasSemana) || 0) > 0;

/** A tabela com estas taxas de volta ao automático — exatamente como o editor
 *  as deixaria (semeadas, se houver salário). */
function comTaxaAutomatica(tabela: Tabela, chaves: readonly ChaveTaxa[]): Tabela {
  const t: Tabela = { ...tabela };
  for (const k of chaves) delete t[k];
  return { ...t, ...sementeTaxas(t, chaves) };
}

export type AvisoTaxasZero = {
  /** As taxas a 0 que estão a tirar dinheiro a esta folha (HE-A, HE-B, HR) */
  chaves: ChaveTaxa[];
  /** Quanto sobe o valor bruto com a taxa automática */
  diferenca: number;
  /** A tabela corrigida — o que "Usar a taxa automática" grava */
  tabela: Tabela;
};

/**
 * Há horas pagas a 0 € por causa de uma taxa gravada a 0? Devolve quais, e
 * quanto vale a diferença; `null` quando não há nada a perguntar:
 *   • folha de cinema (o motor já ignora o 0);
 *   • nenhuma taxa a 0, ou todas já confirmadas ("Está certo assim");
 *   • a taxa está a 0 mas não custa nada: sem horas dessas, sem salário, ou o
 *     valor/total do dia foi escrito à mão.
 * A conta é a do motor (`calcProject`), com e sem o 0 — nunca uma estimativa.
 */
export function avisoTaxasZero(p: ProjectLike | null | undefined): AvisoTaxasZero | null {
  if (!p || !p.tabela || !Array.isArray(p.dias)) return null;
  if (isCinema(p) || tabelaDeCinema(p.tabela)) return null;
  const confirmadas = zerosConfirmados(p.tabela);
  const zeros = CHAVES_TAXA.filter((k) => p.tabela[k] === 0 && !confirmadas.includes(k));
  if (!zeros.length) return null;
  const bruto = (tabela: Tabela) => calcProject({ ...p, tabela }).totais.ValorBruto;
  const base = bruto(p.tabela);
  const chaves = zeros.filter((k) => r2(bruto(comTaxaAutomatica(p.tabela, [k])) - base) > 0);
  if (!chaves.length) return null;
  const tabela = comTaxaAutomatica(p.tabela, chaves);
  const diferenca = r2(bruto(tabela) - base);
  return diferenca > 0 ? { chaves, diferenca, tabela } : null;
}

/** "Está certo assim": estas taxas ficam a 0 e o aviso não volta a perguntar
 *  por elas (nem nas cópias desta folha feitas pela mesma pessoa). */
export function confirmarZeros(tabela: Tabela, chaves: readonly ChaveTaxa[]): Tabela {
  const ja = zerosConfirmados(tabela);
  return { ...tabela, zeroOk: CHAVES_TAXA.filter((k) => ja.includes(k) || chaves.includes(k)) } as Tabela;
}

/**
 * Os zeros que a semente antiga do editor pode ter deixado: as taxas a 0 (não
 * confirmadas) de uma folha de publicidade que ABRE sem salário. Fotografam-se
 * quando a folha abre no ecrã, e só esses saem quando o salário é escrito.
 * Uma folha que abre JÁ com salário não tem nada a tirar: lá um 0 é escolha de
 * alguém, e o aviso pergunta se custar dinheiro.
 */
export function zerosSemeados(tabela: Tabela | null | undefined): ChaveTaxa[] {
  if (!tabela || tabelaDeCinema(tabela) || Number(tabela.salarioDia) > 0) return [];
  const confirmadas = zerosConfirmados(tabela);
  return CHAVES_TAXA.filter((k) => tabela[k] === 0 && !confirmadas.includes(k));
}

/**
 * Uma tecla na célula do salário. O editor manda o texto da célula a CADA
 * tecla, e apagar para reescrever passa por "" (= salário 0): por isso não se
 * decide pela tecla anterior, mas pelos zeros fotografados ao abrir
 * (`zerosSemeados`). Quando o salário deixa de ser 0, saem os que ainda lá
 * estiverem a 0 — ficando, cada hora extra pagava 0 €; vazias, seguem o
 * salário — e não há mais nada a tirar (`semeados` volta vazio). Assim, apagar
 * e reescrever o salário nunca mexe num 0 posto de propósito (revisão de
 * 18/11: a sequência "", "2", "25", "250" apagava-o e cobrava horas a mais).
 */
export function editarSalario(
  tabela: Tabela,
  salario: number,
  semeados: readonly ChaveTaxa[]
): { tabela: Tabela; semeados: ChaveTaxa[] } {
  const t: Tabela = { ...tabela, salarioDia: salario };
  if (!semeados.length || tabelaDeCinema(t) || !(Number(salario) > 0)) return { tabela: t, semeados: [...semeados] };
  const confirmadas = zerosConfirmados(t);
  for (const k of semeados) if (t[k] === 0 && !confirmadas.includes(k)) delete t[k];
  return { tabela: t, semeados: [] };
}
