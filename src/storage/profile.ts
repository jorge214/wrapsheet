// src/storage/profile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

// Caixa de condições de trabalho (título + texto + imagem opcional em data URI)
export type CondBox = {
  titulo: string;
  texto: string;
  img?: string;
};

// Predefinição das condições — modelo da folha de referência (PDF)
export function defaultCondBoxes(): CondBox[] {
  return [
    { titulo: "HORA EXTRA A", texto: "* São cobradas Horas Extra A (x1,5), a partir do início da 12ª hora de trabalho." },
    { titulo: "HORA EXTRA B", texto: "* São cobradas Horas Extra B (x2), a partir do início da 19ª hora de trabalho." },
    { titulo: "HORA RECUPERAÇÃO", texto: "* São cobradas Horas Extra de Recuperação (x3), se o intervalo entre o final de um dia de trabalho e o início do dia seguinte for inferior a 10 horas." },
    { titulo: "REFEIÇÃO", texto: "* Caso a pausa para refeição seja inferior a 01 hora, ou não ocorrer durante a rodagem, será incluída nas horas de trabalho, e poderá ser contabilizada como uma hora extraordinária. Em horários que terminem entre as 20h e as 22h é devida uma refeição servida ou paga, que será incluída nas horas de trabalho." },
    { titulo: "2ª REFEIÇÃO NO FINAL DO HORÁRIO DE TRABALHO", texto: "* Preparação: Em horários que terminem após as 20h (15€).\n* Dias de Rodagem: 21h (Horário de Inverno) ou 22h (Horário de Verão). Quando não é feita uma pausa para a 2ª refeição, deverá ser acrescentada 01:00 no final do dia de trabalho, que será incluída nas horas de trabalho. Só após o final dessa hora será iniciada a contagem das horas de recuperação." },
    { titulo: "HORÁRIO CONTÍNUO", texto: "* A pausa de refeição deve ser feita até à 7ª hora consecutiva de trabalho, podendo o dia de trabalho incluir o tempo de transporte em função da distância a percorrer até ao local de filmagem. Caso isso não aconteça, considera-se o horário de trabalho como horário contínuo.\nNestes casos as horas extraordinárias começam a ser contabilizadas a partir da 8ª hora, contabilizando desde logo a hora da refeição como hora extraordinária." },
    { titulo: "DESLOCAÇÕES", texto: "* A partir da Praça Marquês de Pombal (Lisboa) ou do hotel, caso seja esse o alojamento, os tempos de transporte serão calculados da seguinte forma:\n* Zona 0 – Lisboa Concelho — não se cobra tempo de transporte\n* Zona 1 – num percurso entre 10 Km a 25 Km — 30m por percurso\n* Zona 2 – num percurso entre 25 Km a 45 Km — 45m por percurso\n* Zona 3 – num percurso entre 45 Km a 80 Km — 60m (01H00) por percurso\n* Zona 4 – acima de 80 Km ou 1H de transporte — direito a alojamento.\n* Caso haja tempo de transporte, a pausa de refeição deve ser feita até à 7ª hora consecutiva de trabalho a contar a partir do local onde se inicia o transporte. Caso isso não aconteça, considera-se o horário de trabalho como horário contínuo." },
    { titulo: "UTILIZAÇÃO DE VIATURA PRÓPRIA", texto: "* Cabe à Produtora providenciar transporte para efetuar visitas técnicas enquadradas no âmbito profissional.\n* No caso de ser requisitada a utilização da viatura própria para Preparação, visita a locais de filmagem (Recce/Repérage), ou Filmagem, o pagamento de combustível, portagens, parqueamento, quilometragem, e aluguer deverá ser assegurado pela Produtora." },
    { titulo: "DIA DE VIAGEM", texto: "* O Dia de Viagem é pago como meio dia de salário diário, até 05 horas de viagem/trabalho.\nPara além das 05 horas, será cobrado um dia completo de salário." },
    { titulo: "TELEFONE", texto: "* No caso da utilização regular de telefone próprio para chamadas internacionais para fora da U.E. (União Europeia), poderá ser cobrado um valor diário indicado acima." },
    { titulo: "ALOJAMENTO", texto: "* O Alojamento é da responsabilidade da Produtora, em quartos individuais, com pagamento de despesas inerentes, ou de despesas de deslocação/Per Diems." },
    { titulo: "PER DIEMS", texto: "* Em viagens domésticas (dentro do país) – refeições diárias incluídas (pequeno-almoço, almoço ou jantar):\n• No caso de não serem fornecidas nenhuma das refeições, os per diems têm o valor de: 40€ por dia (24 horas);\n• No caso de serem servidas duas das três refeições diárias, os per diems têm o valor de: 20€ diários (24 horas).\n* Em viagens para fora do país de residência – refeições diárias incluídas (pequeno-almoço, almoço ou jantar):\n• No caso de não serem fornecidas nenhuma das refeições, o valor dos per diems é de: 50€ por dia (24 horas);\n• No caso de serem servidas duas das três refeições diárias, os per diems têm o valor de: 30€ por dia (24 horas).\n* Sendo uma retribuição, o montante pago a título de ajudas de custo deve constar do recibo de vencimento, discriminando a parte não sujeita a tributação e a parte sujeita (se a houver)." },
  ];
}

export type Profile = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  departamento: string;
  funcao: string;
  empresa?: string;
  nif?: string;
  iban?: string;
  swift?: string;
  condicoes?: string;
  // Condições de trabalho em caixas (título + texto + imagem opcional)
  condTitulo?: string; // título da secção (ex.: "CONDIÇÕES DE TRABALHO - NOME - A partir de 1 de Janeiro de 2026")
  condBoxes?: CondBox[];
  // Regime fiscal do utilizador (percentagens aplicadas aos valores).
  // Se um campo ficar vazio, usa-se o default do país (Definições › Região).
  fiscal?: {
    IRS_percent?: number;
    IVA_percent?: number;
  };
  // Condições fixas (a linha de taxas): aplicam-se automaticamente a projetos novos
  fixas?: {
    salarioDia?: number;
    rateHEA?: number;
    rateHEB?: number;
    rateHR?: number;
    refeicao?: number;
    telefone?: number;
    viatura?: number;
    material?: number;
    perDiem?: number;
    // Regras de horas extra (a partir de que hora se cobra o quê)
    hDia?: number;      // horas do dia base (default 11)
    heaFromHour?: number; // HE-A a partir desta hora de trabalho (default 12)
    hebFromHour?: number; // HE-B a partir desta hora de trabalho (default 19)
    hrRestBelow?: number; // Recuperação se descanso entre dias < N horas (default 10)
  };
};

/* ---------- Keys ---------- */
const KEY_LIST = "profiles:list:v1";
const KEY_ACTIVE = "profiles:activeId:v1";

/* ---------- Criar perfil em branco ---------- */
function BLANK(): Profile {
  return {
    id: String(Date.now()),
    nome: "",
    email: "",
    telefone: "",
    departamento: "",
    funcao: "",
    empresa: "",
    nif: "",
    iban: "",
    swift: "",
    condicoes: "",
    condTitulo: "",
    condBoxes: defaultCondBoxes(),
    fixas: {},
  };
}

/* ---------- Helpers ---------- */
async function readList(): Promise<Profile[]> {
  const raw = await AsyncStorage.getItem(KEY_LIST);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Profile[];
  } catch {
    return [];
  }
}

async function writeList(list: Profile[]): Promise<void> {
  await AsyncStorage.setItem(KEY_LIST, JSON.stringify(list));
}

/* ---------- API Pública ---------- */

export async function listProfiles(): Promise<Profile[]> {
  return await readList();
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const list = await readList();
  return list.find((p) => p.id === id) ?? null;
}

export async function upsertProfile(p: Profile): Promise<Profile> {
  const list = await readList();
  const idx = list.findIndex((x) => x.id === p.id);

  if (idx >= 0) list[idx] = p;
  else list.push(p);

  await writeList(list);
  return p;
}

export async function createProfile(): Promise<Profile> {
  const p = BLANK();
  await upsertProfile(p);
  return p;
}

export async function deleteProfile(id: string): Promise<void> {
  const list = await readList();
  const next = list.filter((p) => p.id !== id);
  await writeList(next);

  const active = await getActiveProfileId();
  if (active === id) {
    await setActiveProfileId(next[0]?.id ?? "");
  }
}

export async function setActiveProfileId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEY_ACTIVE, id || "");
}

export async function getActiveProfileId(): Promise<string> {
  return (await AsyncStorage.getItem(KEY_ACTIVE)) || "";
}

export async function getActiveProfile(): Promise<Profile | null> {
  const id = await getActiveProfileId();
  if (id) {
    const p = await getProfileById(id);
    if (p) return p;
  }
  // Fallback: perfis sincronizados da cloud chegam sem "ativo" definido neste
  // dispositivo (o ativo é uma definição local) — usa o primeiro e marca-o.
  const list = await readList();
  if (list.length) {
    await setActiveProfileId(list[0].id);
    return list[0];
  }
  return null;
}

/* ---------- Compatibilidade antiga ---------- */
export async function getProfile(): Promise<Profile> {
  const active = await getActiveProfile();
  if (active) return active;

  const created = await createProfile();
  await setActiveProfileId(created.id);
  return created;
}

export async function saveProfile(p: Profile): Promise<void> {
  await upsertProfile(p);
  await setActiveProfileId(p.id);
}

/* ---------- NEW: obter perfil default para projetos ---------- */
export async function getDefaultProfile(): Promise<Profile | null> {
  return await getActiveProfile();
}
