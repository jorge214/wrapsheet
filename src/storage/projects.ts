import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import i18n from "../i18n/i18n";
import { getPreset } from "../constants/countryPresets";
import { effectiveFiscalOf, getSettings } from "./appSettings";
import { CondBox, getActiveProfile, getProfileById } from "./profile";

/* ------------ Tipos internos ------------ */

export type Dia = {
  descricao: string;
  data: string; // YYYY-MM-DD
  continuo: boolean;
  cont?: string; // marca manual "C" de horário contínuo (só visual, sem cálculo)
  salarioDia?: number; // override do salário só deste dia (vazio = usa o global)
  inicio: string; // "HH:MM"
  refeicaoTrabalho: string; // "HH:MM"
  jantarTrabalho: string; // "HH:MM"
  fim: string; // "HH:MM"
  meioDia: boolean;
  tempoTransporteMin: number;
  diaSemTrabalho: boolean;
  pago?: boolean; // dia já pago
  // Overrides por dia editados na folha (vazio = automático) — ver calc/types
  ajRefeicao?: number;
  ajViatura?: number;
  ajTelefone?: number;
  ajMaterial?: number;
  ajPerDiem?: number;
  heaHoras?: number;
  hebHoras?: number;
  hrHoras?: number;
  heaValor?: number;
  hebValor?: number;
  hrValor?: number;
  /** Total do dia negociado à mão (vazio = soma automática) */
  totalDia?: number;
};

export type Ajudas = {
  refeicao: number;
  viatura: number;
  material: number;
  telefone: number;
  perDiem: number;
};

export type Tabela = {
  salarioDia?: number;
  H_dia: number;
  descanso_min: number;
  multHEA?: number;
  multHEB?: number;
  multHR?: number;
  rateHEA?: number;
  rateHEB?: number;
  rateHR?: number;
  limiar_A?: number;
  limiar_B?: number;
  limiar_HR?: number;
  ajudas?: Ajudas;
};

export type Fiscal = {
  IRS_percent: number;
  IVA_percent: number;
  nota?: string;
};

export type Perfil = {
  nome: string;
  email: string;
  telefone: string;
  departamento: string;
  funcao: string;
  empresa?: string;
  nif?: string;
  iban?: string;
  swift?: string;
};

export type ProjetoInfo = {
  titulo?: string;
  /** Título da barra vermelha da FOLHA — independente do nome do projeto na app */
  folhaTitulo?: string;
  filme: string;
  produtora: string;
  nifProdutora?: string;
  semana?: string;
  mes: number;
  ano: number;
  /** Total de dias editado à mão (decimal); vazio = contagem automática */
  totalDias?: number;
};

export type ProjectState = {
  id: string;
  /** Perfil a que este projeto pertence (multi-perfil). Vive no blob `data`,
   *  por isso sincroniza sem alterar o esquema da BD. Projetos legados ficam
   *  sem isto (undefined) e são tratados como do perfil ativo (ver filtros). */
  profileId?: string;
  perfil: Perfil;
  projeto: ProjetoInfo;
  tabela: Tabela;
  fiscal: Fiscal;
  dias: Dia[];
  notas: string;
  condicoes?: string;
  condTitulo?: string;
  condBoxes?: CondBox[];
  pago?: boolean; // projeto já pago
  updatedAt: string;
};

export type ProjectListItem = {
  id: string;
  nome: string;
  cliente: string;
  mes: string;
  pago?: boolean;
  updatedAt: string;
  /** Perfil dono (multi-perfil). Undefined em itens legados. */
  profileId?: string;
};

/* ------------ Keys no AsyncStorage ------------ */

const KEY_INDEX = "projects:index:v1";
const KEY_PROJECT_PREFIX = "projects:item:";
const KEY_ARCHIVED_INDEX = "projects:archived:index:v1";
const KEY_ARCHIVED_PREFIX = "projects:archived:item:";

/* ------------ Helpers de index ------------ */

async function readIndex(key: string): Promise<ProjectListItem[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ProjectListItem[];
  } catch {
    return [];
  }
}

async function writeIndex(key: string, list: ProjectListItem[]) {
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

/* ------------ Defaults ------------ */

function defaultDia(date: string): Dia {
  return {
    descricao: i18n.t("day_description_default", { defaultValue: "Filmagem" }),
    data: date,
    continuo: false,
    inicio: "08:00",
    refeicaoTrabalho: "00:00",
    jantarTrabalho: "00:00",
    fim: "18:00",
    meioDia: false,
    tempoTransporteMin: 0,
    diaSemTrabalho: false,
    // Ajudas a 0 — só entram quando negociadas/cobradas. Horas extra SEM
    // override: calculam automaticamente pelas condições do perfil (forçar
    // um valor — incluindo 0 — faz-se na folha; apagar volta ao automático).
    ajRefeicao: 0, ajViatura: 0, ajTelefone: 0, ajMaterial: 0, ajPerDiem: 0,
  };
}

function defaultTabela(): Tabela {
  return {
    salarioDia: 0,
    H_dia: 11, // Fix #6: industry standard — salarioDia is the rate for an 11-hour day
    descanso_min: 11,
    multHEA: 1.5,
    multHEB: 2.0,
    multHR: 3.0,
    limiar_A: 11,
    limiar_B: 18,
    ajudas: {
      refeicao: 0,
      viatura: 0,
      material: 0,
      telefone: 0,
      perDiem: 0,
    },
  };
}

function defaultFiscal(): Fiscal {
  return {
    IRS_percent: 0,
    IVA_percent: 0,
  };
}

function blankPerfil(from?: Perfil): Perfil {
  if (!from) {
    return {
      nome: "",
      email: "",
      telefone: "",
      departamento: "",
      funcao: "",
      empresa: "",
      nif: "",
      iban: "",
      swift: "",
    };
  }
  return {
    nome: from.nome || "",
    email: from.email || "",
    telefone: from.telefone || "",
    departamento: from.departamento || "",
    funcao: from.funcao || "",
    empresa: from.empresa || "",
    nif: from.nif || "",
    iban: from.iban || "",
    swift: from.swift || "",
  };
}

/* ------------ Upgrade para garantir estrutura completa ------------ */

function upgradeProject(raw: any, id: string): ProjectState {
  const today = dayjs().format("YYYY-MM-DD");

  // Quebras de linha presas em campos de UMA linha (coladas no contenteditable
  // da folha) rendiam linhas fantasma no cabeçalho — sanear ao carregar cura
  // os dados antigos.
  const oneLine = (v: any) =>
    String(v ?? "").replace(/\s*[\r\n\u2028\u2029\u0085]+\s*/g, " ").trim();

  // Horas partidas por vers\u00f5es antigas (o contenteditable deixava "00:::",
  // "08::0"\u2026). Curar ao carregar torna-as v\u00e1lidas em toda a app (folha, c\u00e1lculo
  // e PDF). J\u00e1 em HH:MM = mant\u00e9m; sen\u00e3o reconstr\u00f3i a partir dos d\u00edgitos.
  const cleanTime = (v: any): string => {
    const s = String(v ?? "").trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (m) {
      const h = Math.min(23, Number(m[1]) || 0);
      const mm = Math.min(59, Number(m[2]) || 0);
      return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
    const d = s.replace(/\D/g, "").slice(0, 4);
    if (!d) return "";
    if (d.length <= 2) return `${d.padStart(2, "0")}:00`;
    if (d.length === 3) return `${d.slice(0, 2)}:0${d.charAt(2)}`;
    return `${d.slice(0, 2)}:${d.slice(2)}`;
  };

  const tabela = {
    ...defaultTabela(),
    ...(raw.tabela || {}),
    ajudas: {
      ...defaultTabela().ajudas!,
      ...(raw.tabela?.ajudas || {}),
    },
  };

  // Fix #13: migrate old format { irs, iva } → { IRS_percent, IVA_percent }
  const rawFiscal = raw.fiscal || {};
  const fiscal: Fiscal = {
    IRS_percent: Number(rawFiscal.IRS_percent ?? rawFiscal.irs ?? rawFiscal.IRS ?? 0),
    IVA_percent: Number(rawFiscal.IVA_percent ?? rawFiscal.iva ?? rawFiscal.IVA ?? 0),
    nota: rawFiscal.nota ?? "",
  };

  const perfilRaw = blankPerfil(raw.perfil);
  const perfil: Perfil = {
    ...perfilRaw,
    nome: oneLine(perfilRaw.nome),
    email: oneLine(perfilRaw.email),
    telefone: oneLine(perfilRaw.telefone),
    departamento: oneLine(perfilRaw.departamento),
    funcao: oneLine(perfilRaw.funcao),
    empresa: oneLine(perfilRaw.empresa),
    nif: oneLine(perfilRaw.nif),
    iban: oneLine(perfilRaw.iban),
    swift: oneLine(perfilRaw.swift),
  };

  const projeto: ProjetoInfo = {
    titulo: oneLine(raw.projeto?.titulo),
    // Título da barra vermelha da folha (independente do nome do projeto)
    folhaTitulo: oneLine(raw.projeto?.folhaTitulo),
    filme: oneLine(raw.projeto?.filme || raw.nome),
    produtora: oneLine(raw.projeto?.produtora || raw.cliente),
    nifProdutora: oneLine(raw.projeto?.nifProdutora),
    semana: oneLine(raw.projeto?.semana),
    mes:
      typeof raw.projeto?.mes === "number"
        ? raw.projeto.mes
        : dayjs().month() + 1,
    ano:
      typeof raw.projeto?.ano === "number"
        ? raw.projeto.ano
        : dayjs().year(),
    // Total de dias editado à mão na folha (decimal); vazio = contagem automática
    totalDias:
      typeof raw.projeto?.totalDias === "number" ? raw.projeto.totalDias : undefined,
  };

  const dias: Dia[] =
    Array.isArray(raw.dias) && raw.dias.length > 0
      ? raw.dias.map((d: any) => ({
          ...d,
          inicio: cleanTime(d.inicio),
          fim: cleanTime(d.fim),
          refeicaoTrabalho: cleanTime(d.refeicaoTrabalho),
          jantarTrabalho: d.jantarTrabalho == null ? d.jantarTrabalho : cleanTime(d.jantarTrabalho),
        }))
      : [defaultDia(today)];

  return {
    id,
    perfil,
    projeto,
    tabela,
    fiscal,
    dias,
    notas: raw.notas || "",
    condicoes: raw.condicoes || "",
    condTitulo: raw.condTitulo || "",
    condBoxes: Array.isArray(raw.condBoxes) ? raw.condBoxes : undefined,
    pago: !!raw.pago,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

/* ------------ API pública ------------ */

// lista de projetos para o ecrã /projects (apenas ativos)
export async function listProjects(): Promise<ProjectListItem[]> {
  return await readIndex(KEY_INDEX);
}

// obter projeto completo (ATIVO OU ARQUIVADO) para o editor /projects/[id]
export async function getProject(id: string): Promise<ProjectState | null> {
  let raw = await AsyncStorage.getItem(KEY_PROJECT_PREFIX + id);
  if (!raw) {
    raw = await AsyncStorage.getItem(KEY_ARCHIVED_PREFIX + id);
    if (!raw) return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return upgradeProject(parsed, id);
  } catch {
    return null;
  }
}

// guardar / atualizar projeto completo.
// keepTimestamp: usado pelo sync ao aplicar dados vindos da cloud — preserva
// o updatedAt remoto (carimbar "agora" fazia cada download parecer uma edição
// nova e os aparelhos entravam em pingue-pongue de uploads).
export async function saveProject(
  p: ProjectState,
  opts?: { keepTimestamp?: boolean }
): Promise<void> {
  const updatedAt =
    opts?.keepTimestamp && p.updatedAt ? p.updatedAt : new Date().toISOString();
  const toSave: ProjectState = { ...p, updatedAt };

  const archivedIndex = await readIndex(KEY_ARCHIVED_INDEX);
  const isArchived = archivedIndex.some((i) => i.id === p.id);

  const summary: ProjectListItem = {
    id: p.id,
    nome: toSave.projeto.titulo || toSave.projeto.filme || "",
    cliente: toSave.projeto.produtora || "",
    mes: `${String(toSave.projeto.mes).padStart(2, "0")}/${toSave.projeto.ano}`,
    pago: !!toSave.pago,
    updatedAt,
    profileId: toSave.profileId,
  };

  if (isArchived) {
    await AsyncStorage.setItem(KEY_ARCHIVED_PREFIX + p.id, JSON.stringify(toSave));

    const idx = archivedIndex.findIndex((i) => i.id === p.id);
    if (idx >= 0) archivedIndex[idx] = summary;
    else archivedIndex.push(summary);

    await writeIndex(KEY_ARCHIVED_INDEX, archivedIndex);
  } else {
    await AsyncStorage.setItem(KEY_PROJECT_PREFIX + p.id, JSON.stringify(toSave));

    const index = await readIndex(KEY_INDEX);
    const existingIdx = index.findIndex((i) => i.id === p.id);
    if (existingIdx >= 0) index[existingIdx] = summary;
    else index.push(summary);

    await writeIndex(KEY_INDEX, index);
  }
}

// criar projeto novo
export async function createProject(): Promise<string> {
  const id = String(Date.now());
  const today = dayjs().format("YYYY-MM-DD");

  const active = await getActiveProfile();
  const perfil = active ? blankPerfil(active as any) : blankPerfil();
  const condicoesFromProfile = (active as any)?.condicoes || "";
  const fixas = (active as any)?.fixas || {};

  const projeto: ProjetoInfo = {
    titulo: "",
    filme: "",
    produtora: "",
    nifProdutora: "",
    semana: "",
    mes: dayjs().month() + 1,
    ano: dayjs().year(),
  };

  const settings = await getSettings();
  const preset = getPreset(settings.region);

  // Aplica as condições fixas do perfil (salário + taxas €/h + ajudas)
  const baseTabela = { ...defaultTabela(), ...preset.tabela };
  const tabela: Tabela = {
    ...baseTabela,
    salarioDia: fixas.salarioDia ?? baseTabela.salarioDia,
    rateHEA: fixas.rateHEA,
    rateHEB: fixas.rateHEB,
    rateHR: fixas.rateHR,
    // Regras de horas extra (predefinição = como no PDF: HE-A 12ª h, HE-B 19ª h, HR < 10h)
    H_dia: fixas.hDia ?? baseTabela.H_dia,
    limiar_A: (fixas.heaFromHour ?? 12) - 1,
    limiar_B: (fixas.hebFromHour ?? 19) - 1,
    limiar_HR: fixas.hrRestBelow ?? 10,
    ajudas: {
      ...baseTabela.ajudas!,
      refeicao: fixas.refeicao ?? baseTabela.ajudas!.refeicao,
      telefone: fixas.telefone ?? baseTabela.ajudas!.telefone,
      viatura: fixas.viatura ?? baseTabela.ajudas!.viatura,
      material: fixas.material ?? baseTabela.ajudas!.material,
      perDiem: fixas.perDiem ?? baseTabela.ajudas!.perDiem,
    },
  };

  const novo: ProjectState = {
    id,
    profileId: active?.id || undefined,
    perfil,
    projeto,
    tabela,
    // Impostos: a fonte é GLOBAL (Definições › Região Fiscal — standard do
    // país ou valores personalizados lá). O perfil não mexe em taxas; a folha
    // de cada projeto pode depois sobrepor num trabalho-exceção.
    fiscal: {
      ...defaultFiscal(),
      ...effectiveFiscalOf(settings),
    },
    dias: [defaultDia(today)],
    notas: "",
    condicoes: condicoesFromProfile,
    condTitulo: (active as any)?.condTitulo || "",
    condBoxes: Array.isArray((active as any)?.condBoxes) ? (active as any).condBoxes : undefined,
    updatedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(KEY_PROJECT_PREFIX + id, JSON.stringify(novo));

  const index = await readIndex(KEY_INDEX);
  index.push({
    id,
    nome: "",
    cliente: "",
    mes: `${String(novo.projeto.mes).padStart(2, "0")}/${novo.projeto.ano}`,
    updatedAt: novo.updatedAt,
    profileId: novo.profileId,
  });
  await writeIndex(KEY_INDEX, index);

  return id;
}

// apagar projeto ATIVO
export async function deleteProject(id: string): Promise<void> {
  await AsyncStorage.removeItem(KEY_PROJECT_PREFIX + id);
  const index = await readIndex(KEY_INDEX);
  const next = index.filter((p) => p.id !== id);
  await writeIndex(KEY_INDEX, next);
}

// apagar projeto ARQUIVADO
export async function deleteArchivedProject(id: string): Promise<void> {
  await AsyncStorage.removeItem(KEY_ARCHIVED_PREFIX + id);
  const index = await readIndex(KEY_ARCHIVED_INDEX);
  const next = index.filter((p) => p.id !== id);
  await writeIndex(KEY_ARCHIVED_INDEX, next);
}

// duplicar projeto (mesmo mês/ano)
export async function duplicateProject(id: string): Promise<string> {
  const original = await getProject(id);
  if (!original) throw new Error("Projeto não encontrado");

  const newId = String(Date.now());
  const now = new Date().toISOString();

  const clone: ProjectState = {
    ...original,
    id: newId,
    projeto: {
      ...original.projeto,
      filme: original.projeto.filme
        ? `${original.projeto.filme}${i18n.t("copy_suffix")}`
        : "",
    },
    updatedAt: now,
  };

  await AsyncStorage.setItem(KEY_PROJECT_PREFIX + newId, JSON.stringify(clone));

  const index = await readIndex(KEY_INDEX);
  index.push({
    id: newId,
    nome: clone.projeto.filme || "",
    cliente: clone.projeto.produtora || "",
    mes: `${String(clone.projeto.mes).padStart(2, "0")}/${clone.projeto.ano}`,
    updatedAt: now,
    profileId: clone.profileId,
  });
  await writeIndex(KEY_INDEX, index);

  return newId;
}

// 🔥 duplicar projeto escolhendo mês/ano
export async function duplicateProjectToMonth(
  id: string,
  mes: number,
  ano: number
): Promise<string> {
  const original = await getProject(id);
  if (!original) throw new Error("Projeto não encontrado");

  const newId = String(Date.now());
  const now = new Date().toISOString();

  const clone: ProjectState = {
    ...original,
    id: newId,
    projeto: {
      ...original.projeto,
      mes,
      ano,
    },
    updatedAt: now,
  };

  await AsyncStorage.setItem(KEY_PROJECT_PREFIX + newId, JSON.stringify(clone));

  const index = await readIndex(KEY_INDEX);
  index.push({
    id: newId,
    nome: clone.projeto.filme || "",
    cliente: clone.projeto.produtora || "",
    mes: `${String(mes).padStart(2, "0")}/${ano}`,
    updatedAt: now,
    profileId: clone.profileId,
  });
  await writeIndex(KEY_INDEX, index);

  return newId;
}

/* ------ NOVO (multi-perfil): duplicar para OUTRO perfil ------ */
// A funcionalidade "paga": clonar a folha e atribuí-la a outro perfil. Cinco
// folhas do mesmo filme só diferem nas tarifas do perfil de cada um, por isso
// aplica também as tarifas fixas (fixas) do perfil de destino à tabela do clone.
export async function duplicateProjectToProfile(
  id: string,
  targetProfileId: string
): Promise<string> {
  const original = await getProject(id);
  if (!original) throw new Error("Projeto não encontrado");
  const target = await getProfileById(targetProfileId);

  const newId = String(Date.now());
  const now = new Date().toISOString();

  // Tarifas do perfil de destino (se tiver) — o resto da folha (dias, projeto)
  // fica igual; muda o dono e o cabeçalho pessoal.
  const fixas: any = (target as any)?.fixas || {};
  const tabela: Tabela = {
    ...original.tabela,
    salarioDia: fixas.salarioDia ?? original.tabela.salarioDia,
    rateHEA: fixas.rateHEA ?? original.tabela.rateHEA,
    rateHEB: fixas.rateHEB ?? original.tabela.rateHEB,
    rateHR: fixas.rateHR ?? original.tabela.rateHR,
    ajudas: {
      ...original.tabela.ajudas!,
      refeicao: fixas.refeicao ?? original.tabela.ajudas!.refeicao,
      telefone: fixas.telefone ?? original.tabela.ajudas!.telefone,
      viatura: fixas.viatura ?? original.tabela.ajudas!.viatura,
      material: fixas.material ?? original.tabela.ajudas!.material,
      perDiem: fixas.perDiem ?? original.tabela.ajudas!.perDiem,
    },
  };

  const clone: ProjectState = {
    ...original,
    id: newId,
    profileId: targetProfileId,
    perfil: target ? blankPerfil(target as any) : original.perfil,
    tabela,
    condicoes: (target as any)?.condicoes ?? original.condicoes,
    condTitulo: (target as any)?.condTitulo ?? original.condTitulo,
    condBoxes: Array.isArray((target as any)?.condBoxes)
      ? (target as any).condBoxes
      : original.condBoxes,
    projeto: {
      ...original.projeto,
      filme: original.projeto.filme
        ? `${original.projeto.filme}${i18n.t("copy_suffix")}`
        : "",
    },
    updatedAt: now,
  };

  await AsyncStorage.setItem(KEY_PROJECT_PREFIX + newId, JSON.stringify(clone));

  const index = await readIndex(KEY_INDEX);
  index.push({
    id: newId,
    nome: clone.projeto.titulo || clone.projeto.filme || "",
    cliente: clone.projeto.produtora || "",
    mes: `${String(clone.projeto.mes).padStart(2, "0")}/${clone.projeto.ano}`,
    updatedAt: now,
    profileId: targetProfileId,
  });
  await writeIndex(KEY_INDEX, index);

  return newId;
}

/** Um projeto pertence ao perfil `profileId`? Itens legados (sem profileId)
 *  contam como do perfil ativo — assim nada desaparece a quem já tem projetos. */
export function belongsToProfile(
  p: { profileId?: string },
  profileId: string
): boolean {
  return !p.profileId || p.profileId === profileId;
}

// arquivar projeto
export async function archiveProject(id: string): Promise<void> {
  const project = await getProject(id);
  if (!project) throw new Error("Projeto não encontrado");

  await AsyncStorage.setItem(KEY_ARCHIVED_PREFIX + id, JSON.stringify(project));

  const archivedIndex = await readIndex(KEY_ARCHIVED_INDEX);
  archivedIndex.push({
    id,
    nome: project.projeto.titulo || project.projeto.filme || "",
    cliente: project.projeto.produtora || "",
    mes: `${String(project.projeto.mes).padStart(2, "0")}/${project.projeto.ano}`,
    pago: !!project.pago,
    updatedAt: new Date().toISOString(),
    profileId: project.profileId,
  });
  await writeIndex(KEY_ARCHIVED_INDEX, archivedIndex);

  await deleteProject(id);
}

// listar arquivados
export async function listArchivedProjects(): Promise<ProjectListItem[]> {
  return await readIndex(KEY_ARCHIVED_INDEX);
}

// desarquivar: volta o projeto para a lista ativa e marca como NÃO pago ("A Receber")
export async function unarchiveProject(id: string): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY_ARCHIVED_PREFIX + id);
  if (!raw) return;

  let project: ProjectState;
  try {
    project = upgradeProject(JSON.parse(raw), id);
  } catch {
    return;
  }

  const restored: ProjectState = {
    ...project,
    pago: false,
    updatedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(KEY_PROJECT_PREFIX + id, JSON.stringify(restored));

  const index = await readIndex(KEY_INDEX);
  const summary: ProjectListItem = {
    id,
    nome: restored.projeto.titulo || restored.projeto.filme || "",
    cliente: restored.projeto.produtora || "",
    mes: `${String(restored.projeto.mes).padStart(2, "0")}/${restored.projeto.ano}`,
    pago: false,
    updatedAt: restored.updatedAt,
    profileId: restored.profileId,
  };
  const existing = index.findIndex((i) => i.id === id);
  if (existing >= 0) index[existing] = summary;
  else index.push(summary);
  await writeIndex(KEY_INDEX, index);

  await deleteArchivedProject(id);
}

// marcar como pago E arquivar num só passo (pago ⟺ arquivado)
export async function markProjectPaidAndArchive(id: string): Promise<void> {
  await setProjectPaid(id, true);
  await archiveProject(id);
}

// voltar a "A Receber": desarquiva (se estiver arquivado) e desmarca o pago.
// Cobre também o estado legado "pago mas não arquivado" que a versão antiga
// do menu do projeto criava.
export async function markProjectToReceive(id: string): Promise<void> {
  await unarchiveProject(id); // no-op se não estiver arquivado
  const p = await getProject(id);
  if (p && p.pago) await saveProject({ ...p, pago: false });
}

// Zera a folha (mesmo shape do "Limpar projeto" da página do projeto):
// limpa perfil/produção/fiscal/notas/condições e deixa um único dia por
// preencher. Mantém id, tarifas da tabela e o estado pago/arquivado.
export async function clearProjectData(
  id: string,
  dayDescription: string
): Promise<ProjectState | null> {
  const p = await getProject(id);
  if (!p) return null;
  const empty: ProjectState = {
    ...p,
    perfil: {
      nome: "", email: "", telefone: "", departamento: "",
      funcao: "", empresa: "", nif: "", iban: "", swift: "",
    },
    projeto: {
      filme: "", produtora: "", nifProdutora: "", semana: "",
      mes: dayjs().month() + 1, ano: dayjs().year(),
    },
    notas: "",
    condicoes: "",
    // Impostos voltam à predefinição da app (Região Fiscal), não a 0/0
    fiscal: { ...effectiveFiscalOf(await getSettings()), nota: "" },
    dias: [
      {
        descricao: dayDescription,
        data: dayjs().format("YYYY-MM-DD"),
        continuo: false,
        inicio: "08:00",
        refeicaoTrabalho: "00:00",
        jantarTrabalho: "00:00",
        fim: "18:00",
        meioDia: false,
        tempoTransporteMin: 0,
        diaSemTrabalho: false,
      },
    ],
  };
  await saveProject(empty);
  return empty;
}

/* ------------ NOVO: RENOMEAR PROJETO ------------ */

export async function setProjectPaid(id: string, pago: boolean): Promise<void> {
  const project = await getProject(id);
  if (!project) return;
  await saveProject({ ...project, pago });
}

export async function renameProject(id: string, newName: string): Promise<void> {
  const project = await getProject(id);
  if (!project) throw new Error("Projeto não encontrado");

  const updated: ProjectState = {
    ...project,
    projeto: {
      ...project.projeto,
      // "titulo" é o nome do projeto na app (lista, cabeçalho, barra da folha).
      // Escrever em "filme" não mudava nada visível (titulo ganha sempre) e
      // ainda alterava o campo FILME da folha.
      titulo: newName.trim(),
    },
  };

  await saveProject(updated); // atualiza índice + updatedAt
}

/* ------ Carimbo contínuo do profileId (multi-perfil) ------ */
// Projetos criados por clientes ANTIGOS (web em produção + 1.0.19) gravam sempre
// profileId a NULL. O cliente novo tem de carimbar SEMPRE que sincroniza (não só
// uma vez na migração), senão esses projetos ficariam "sem perfil" para sempre.
// Regra: sem profileId -> carimba com o perfil ATIVO. Só toca em projetos por
// carimbar (idempotente depois disso). Corre no SyncProvider a cada sync.
export async function backfillProfileIds(): Promise<void> {
  const active = await getActiveProfile();
  if (!active?.id) return; // sem perfil ativo -> nada a carimbar
  const all = await listAllProjectsFull();
  for (const p of all) {
    if (!p.profileId) {
      await saveProject({ ...p, profileId: active.id });
    }
  }
}

/* ------ listar TODOS os projetos (ativos + arquivados) ------ */
export async function listAllProjectsFull(): Promise<ProjectState[]> {
  const idxActive = await readIndex(KEY_INDEX);
  const idxArchived = await readIndex(KEY_ARCHIVED_INDEX);

  const ids = [...idxActive, ...idxArchived].map((i) => i.id);
  const uniqueIds = Array.from(new Set(ids));

  const result: ProjectState[] = [];
  for (const id of uniqueIds) {
    const p = await getProject(id);
    if (p) result.push(p);
  }
  return result;
}
