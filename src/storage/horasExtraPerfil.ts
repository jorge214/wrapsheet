// src/storage/horasExtraPerfil.ts
// Escolha do perfil (folha de PUBLICIDADE): horas extra COM ACRÉSCIMO (a hora
// normal × 1,5 / × 2 da região) ou AO VALOR DA HORA NORMAL (× 1, sem
// percentagem). Pedido de uma utilizadora real (02/11/2026): "eu não cobro
// percentual face à hora extra".
//
// A escolha fica em multHEA / multHEB = 1: campos NOVOS no blob `fixas`
// (aditivos), que o código antigo ignora sem partir.
//
// COMO CHEGA À FOLHA (createProject e "Duplicar para outro perfil", em
// projects.ts, pelo `heParaTabela` mais abaixo): a folha leva o MULTIPLICADOR
// × 1, não uma taxa €/h. O motor faz a conta com o salário e o H_dia DA FOLHA
// (e com o salário de um dia, se tiver override): acompanha um salário mudado
// na folha e o horário base da região de quem a cria. Para não a congelar
// outra vez, o editor também não semeia essa taxa (`semeiaTaxaHE`).
//
// E, ainda assim, a taxa MATERIALIZADA no perfil: ao GRAVAR com a escolha,
// escreve-se em fixas.rateHEA / rateHEB o valor da hora normal (salário ÷
// horário base, SEM arredondar: o mesmo número que o motor faz com × 1) e
// marca-se em `heAuto` que foi a escolha que as escreveu. É para as versões
// ANTIGAS da app (bundle em cache antes da OTA), que leem este mesmo perfil da
// nuvem e só conhecem a taxa €/h: sem ela criavam a folha a × 1,5 / × 2. A
// versão de agora não a usa (o heParaTabela tira-a). Ao ABRIR o perfil
// tiram-se outra vez: o campo volta a aparecer vazio, com o valor automático a
// cinzento. Um valor escrito à mão nunca leva marca — é um override e manda
// sempre, nas duas versões.
import type { RegionPreset } from "../constants/countryPresets";
import { condBoxesFor } from "./condDefaults";
import type { CondBox, Profile } from "./profile";

export type FixasHE = NonNullable<Profile["fixas"]> & {
  /** Multiplicador da HE-A escolhido no perfil. Ausente = o da região; 1 = hora normal. */
  multHEA?: number;
  /** Multiplicador da HE-B escolhido no perfil. Ausente = o da região; 1 = hora normal. */
  multHEB?: number;
  /** Taxas €/h que a ESCOLHA escreveu na última gravação (não o utilizador). */
  heAuto?: { rateHEA?: number; rateHEB?: number };
};

/** O que a Região Fiscal põe na tabela de uma folha nova de publicidade
 *  (createProject: `{ ...defaultTabela(), ...preset.tabela }`). */
export type BaseRegiaoHE = { H_dia: number; multHEA: number; multHEB: number; multHR: number };

/** Portugal — também o que o motor assume quando a tabela não diz nada. */
export const BASE_HE_PT: BaseRegiaoHE = { H_dia: 11, multHEA: 1.5, multHEB: 2, multHR: 3 };

export type ModoHE = "acrescimo" | "normal";

const r2 = (n: number) => Math.round(n * 100) / 100;
const CHAVES = ["rateHEA", "rateHEB"] as const;
const MULT_DE = { rateHEA: "multHEA", rateHEB: "multHEB" } as const;

export function baseRegiaoHE(preset?: Pick<RegionPreset, "tabela"> | null): BaseRegiaoHE {
  const tb: any = preset?.tabela ?? {};
  return {
    H_dia: Number(tb.H_dia) > 0 ? Number(tb.H_dia) : BASE_HE_PT.H_dia,
    multHEA: Number(tb.multHEA) > 0 ? Number(tb.multHEA) : BASE_HE_PT.multHEA,
    multHEB: Number(tb.multHEB) > 0 ? Number(tb.multHEB) : BASE_HE_PT.multHEB,
    multHR: Number(tb.multHR) > 0 ? Number(tb.multHR) : BASE_HE_PT.multHR,
  };
}

/** "normal" só com as DUAS horas extra a × 1 (é sempre assim que a escolha grava). */
export function modoHE(fx?: FixasHE | null): ModoHE {
  return fx?.multHEA === 1 && fx?.multHEB === 1 ? "normal" : "acrescimo";
}

/** Aplica a escolha. "acrescimo" APAGA os campos (volta ao da região), em vez
 *  de gravar 1,5 / 2: quem nunca mexeu fica exatamente como antes. */
export function comModoHE(fx: FixasHE | undefined | null, modo: ModoHE): FixasHE {
  const { multHEA: _a, multHEB: _b, ...resto } = fx ?? {};
  return modo === "normal" ? { ...resto, multHEA: 1, multHEB: 1 } : resto;
}

/** Hora normal das folhas novas deste perfil: salário ÷ horário base (o do
 *  perfil ou, vazio, o da região — o mesmo H_dia que o createProject grava).
 *  undefined sem salário: aí não há hora normal que se saiba. */
export function horaNormalPerfil(fx: FixasHE | undefined | null, base: BaseRegiaoHE): number | undefined {
  const sal = Number(fx?.salarioDia);
  const h = Number(fx?.hDia ?? base.H_dia);
  if (!(sal > 0) || !(h > 0)) return undefined;
  return sal / h;
}

/** Multiplicadores efetivos: os do perfil (a escolha) ou os da região. As HR
 *  (recuperação por défice de descanso) não são horas extra — ficam sempre
 *  com o multiplicador da região. */
export function multsPerfil(fx: FixasHE | undefined | null, base: BaseRegiaoHE) {
  return {
    multHEA: fx?.multHEA ?? base.multHEA,
    multHEB: fx?.multHEB ?? base.multHEB,
    multHR: base.multHR,
  };
}

/** Taxa €/h automática (a que a folha usa se o campo ficar vazio), a 2 casas.
 *  É o placeholder dos campos do perfil. */
export function taxaAutoPerfil(
  fx: FixasHE | undefined | null,
  base: BaseRegiaoHE,
  qual: "HEA" | "HEB" | "HR"
): number | undefined {
  const h = horaNormalPerfil(fx, base);
  if (h == null) return undefined;
  const m = multsPerfil(fx, base);
  return r2(h * (qual === "HEA" ? m.multHEA : qual === "HEB" ? m.multHEB : m.multHR));
}

/** Ao ABRIR o perfil: as taxas que a escolha escreveu voltam a "automático"
 *  (campo vazio). Sem marca, devolve o MESMO objeto — perfis antigos não mudam. */
export function fixasParaEditar<T extends FixasHE | undefined | null>(fx: T): T {
  const heAuto = fx?.heAuto;
  if (!fx || !heAuto) return fx;
  const { heAuto: _marca, ...out } = fx as FixasHE;
  for (const k of CHAVES) {
    if (heAuto[k] != null && out[k] === heAuto[k]) delete out[k];
  }
  return out as T;
}

/** Ao GRAVAR o perfil: com um multiplicador escolhido no perfil, a taxa €/h
 *  vazia passa a levar o valor da hora × esse multiplicador (é o que as
 *  versões antigas da app levam para a folha nova). Um valor escrito à mão
 *  fica como está. Idempotente: parte
 *  sempre da forma "para editar", por isso gravar duas vezes dá o mesmo. */
export function fixasParaGravar<T extends FixasHE | undefined | null>(fx: T, base: BaseRegiaoHE): T {
  if (!fx) return fx;
  const out: FixasHE = { ...fixasParaEditar(fx as FixasHE) };
  const auto: NonNullable<FixasHE["heAuto"]> = {};
  const h = horaNormalPerfil(out, base);
  for (const k of CHAVES) {
    const mult = out[MULT_DE[k]];
    // Sem escolha no perfil (o motor usa o da região), com valor à mão, ou
    // sem salário (não há hora normal para escrever): não se toca.
    if (mult == null || out[k] != null || h == null) continue;
    // SEM arredondar: arredondada a 2 casas (27,27) a taxa pagava cêntimos a
    // menos e o erro crescia com as horas (11 h davam 299,97 € em vez dos
    // 300 € de um dia). Assim é o mesmo número que o motor calcula com × 1.
    out[k] = auto[k] = h * mult;
  }
  return (Object.keys(auto).length ? { ...out, heAuto: auto } : out) as T;
}

/** O perfil inteiro, na forma de editar (ao abrir o ecrã). */
export function perfilParaEditar<P extends { fixas?: FixasHE }>(p: P): P {
  const fx = fixasParaEditar(p.fixas);
  return fx === p.fixas ? p : { ...p, fixas: fx };
}

/** O perfil inteiro, na forma de gravar (local e nuvem). */
export function perfilParaGravar<P extends { fixas?: FixasHE }>(p: P, base: BaseRegiaoHE): P {
  const fx = fixasParaGravar(p.fixas, base);
  return fx === p.fixas ? p : { ...p, fixas: fx };
}

/** Ao ABRIR: a taxa GRAVADA (a que as versões antigas da app levam para as
 *  folhas novas; a de agora usa o × 1 — ver heParaTabela) ainda é a que a
 *  escolha daria agora? Deixa de ser quando a Região Fiscal — o horário base —
 *  mudou depois de gravar, ou quando uma versão antiga da app mudou o salário
 *  sem saber da escolha. Abrir o ecrã não grava nada, por isso é preciso
 *  dizê-lo. Devolve a primeira taxa que mudou (guardada → nova) ou null. */
export function heDesatualizado(
  fx: FixasHE | undefined | null,
  base: BaseRegiaoHE
): { qual: "HEA" | "HEB"; guardada?: number; nova?: number } | null {
  if (!fx) return null;
  const g = fixasParaGravar(fx, base);
  for (const k of CHAVES) {
    if (g[k] !== fx[k] || g.heAuto?.[k] !== fx.heAuto?.[k]) {
      return { qual: k === "rateHEA" ? "HEA" : "HEB", guardada: fx[k], nova: g[k] };
    }
  }
  return null;
}

/** Perfil antigo que já contornava o problema à mão: HE-A e HE-B escritas
 *  iguais à hora normal (a um cêntimo), sem a escolha. É o caso provável de
 *  quem pediu esta opção — o ecrã sugere-lhe passar para a escolha. */
export function pareceHoraNormal(fx: FixasHE | undefined | null, base: BaseRegiaoHE): boolean {
  if (!fx || modoHE(fx) === "normal" || fx.rateHEA == null || fx.rateHEB == null) return false;
  const h = horaNormalPerfil(fx, base);
  if (h == null) return false;
  return Math.abs(fx.rateHEA - h) <= 0.01 && Math.abs(fx.rateHEB - h) <= 0.01;
}

/** "Passar para a hora normal": a escolha × 1 e as taxas de HE-A/HE-B à mão
 *  apagadas — passam a automáticas e acompanham o salário. */
export function paraHoraNormal(fx: FixasHE | undefined | null): FixasHE {
  const { rateHEA: _a, rateHEB: _b, ...resto } = fx ?? {};
  return comModoHE(resto, "normal");
}

type TabelaHE = { multHEA?: number; multHEB?: number; rateHEA?: number; rateHEB?: number };

/**
 * O que a escolha do perfil põe na TABELA de uma folha de publicidade criada a
 * partir dele: createProject (`anterior` = a base da região) e
 * duplicateProjectToProfile (`anterior` = a tabela da folha original).
 *
 * Com a escolha, a folha leva o MULTIPLICADOR (× 1) e NÃO a taxa que a
 * escolha materializou: o motor deriva então a hora extra do salário e do
 * H_dia DA FOLHA (e do salário do dia, se tiver override) — acompanha uma
 * mudança de salário na folha e a região de quem a cria. Um valor escrito à
 * mão no perfil continua a ir, e manda.
 *
 * Sem escolha, exatamente o que já ia: a taxa do perfil ou, vazia, a de
 * `anterior` — no createProject nenhuma (a região não traz taxas); ao duplicar,
 * a da folha original, que é como uma taxa negociada para o trabalho passa ao
 * colega que não tem a sua — e o multiplicador de `anterior`.
 *
 * Exceção: um × 1 HERDADO de outra folha (duplicar). Numa folha de publicidade
 * só a escolha de um perfil o lá põe (nenhuma região tem × 1 e a folha não
 * edita multiplicadores): é um termo do perfil de ORIGEM, não do trabalho, e
 * pagava a × 1 a quem cobra acréscimo. Com `regiao`, volta ao da região — o
 * que uma folha nova desse perfil levaria.
 */
export function heParaTabela(
  fx: FixasHE | undefined | null,
  anterior: TabelaHE,
  regiao?: Pick<BaseRegiaoHE, "multHEA" | "multHEB">
): TabelaHE {
  const ed: FixasHE = fixasParaEditar(fx ?? undefined) ?? {};
  const out: TabelaHE = {};
  for (const k of CHAVES) {
    const m = MULT_DE[k];
    if (fx?.[m] != null) {
      out[m] = fx[m];
      out[k] = ed[k];
    } else {
      out[m] = anterior[m] === 1 && regiao ? regiao[m] : anterior[m];
      out[k] = fx?.[k] ?? anterior[k];
    }
  }
  return out;
}

/**
 * Semente do editor (openEditHtml, app/projects/[id].tsx): na 1.ª abertura no
 * telemóvel, a taxa €/h que falta é gravada arredondada a 2 casas e fica presa
 * — mudar depois o salário da folha já não a mexe. Com × 1 (só a escolha "hora
 * normal" o põe numa folha de publicidade) NÃO se semeia: presa, deixava de
 * acompanhar o salário da folha e o de cada dia, que é o que a escolha
 * promete; e arredondada pagava cêntimos a menos (27,27 × 2 h = 54,54 € em vez
 * de 300 ÷ 11 × 2 = 54,55 €; 11 h davam 299,97 € em vez de 300 €). Vazia, o
 * motor faz a conta. Com acréscimo fica como sempre foi.
 */
export function semeiaTaxaHE(tabela: TabelaHE, qual: "HEA" | "HEB"): boolean {
  const k = qual === "HEA" ? "rateHEA" : "rateHEB";
  return tabela[k] == null && tabela[MULT_DE[k]] !== 1;
}

// ── Condições de trabalho (as caixas que saem no PDF) ──
// O modelo ("Repor modelo (PDF)", nas 8 línguas) diz "Horas Extra A (x1,5)" e
// "Horas Extra B (x2)". Com a escolha "hora normal", a folha mostra a HE-A a
// 27,27 €/h e as condições do mesmo PDF prometem × 1,5 — a produtora lê as
// duas coisas. O multiplicador escrito: "(x1,5)", "(x1.5)", "(x2)", "× 2"…
// Não apanha "x3" (as HR), "x2,5" nem "x25".
const RE_MULT = /(^|[\s(])([x×])\s?(?:1[,.]5|2)(?!\d|[,.]\d)/i;
const RE_MULT_G = new RegExp(RE_MULT.source, "gi");

// As frases do MODELO que dizem o multiplicador da HE-A e da HE-B, e a mesma
// frase com × 1. Só estas se trocam com um toque: um texto escrito pela pessoa
// só se assinala (pode estar a falar de outro × 2, p.ex. dos feriados).
const PARES_MODELO: [comAcrescimo: string, horaNormal: string][] = [
  ...new Set(
    ["pt", "en", "es", "fr", "de", "it", "nl", "pl"]
      .flatMap((l) => condBoxesFor(l).map((b) => b.texto))
      .filter((t) => RE_MULT.test(t))
  ),
].map((f) => [f, f.replace(RE_MULT_G, (_m, pre: string, x: string) => `${pre}${x}1`)]);

/** Caixas cujo texto ainda fala em × 1,5 / × 2 (o modelo ou texto próprio). */
export function condComAcrescimo(boxes?: CondBox[] | null): CondBox[] {
  return (boxes ?? []).filter((b) => RE_MULT.test(b?.texto ?? ""));
}

/** Põe as frases do MODELO de acordo com a escolha: "normal" troca "(x1,5)" e
 *  "(x2)" por "(x1)"; "acrescimo" desfaz essa troca. null = nada a trocar. */
export function condParaModo(boxes: CondBox[] | undefined | null, modo: ModoHE): CondBox[] | null {
  let mudou = false;
  const out = (boxes ?? []).map((b) => {
    const orig = b?.texto ?? "";
    let t = orig;
    for (const [acr, x1] of PARES_MODELO) {
      const [de, para] = modo === "normal" ? [acr, x1] : [x1, acr];
      if (t.includes(de)) {
        t = t.split(de).join(para);
        mudou = true;
      }
    }
    return t === orig ? b : { ...b, texto: t };
  });
  return mudou ? out : null;
}
