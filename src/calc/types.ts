// src/calc/types.ts

export type AjudasGlobais = {
  refeicao: number;   // € por dia
  viatura: number;    // € por dia
  material: number;   // €
  telefone: number;   // €
  perDiem: number;    // € por dia
};

export type Dia = {
  descricao: string;
  data: string;              // YYYY-MM-DD
  continuo: boolean;         // mantém para compat., mas não altera a lógica nova
  cont?: string;             // marca manual "C" de horário contínuo (só visual, sem cálculo)
  salarioDia?: number;       // override do salário só deste dia (se vazio usa o global)
  inicio: string;            // HH:MM
  refeicaoTrabalho: string;  // HH:MM (< 01:00 conta para HT)
  jantarTrabalho: string;    // HH:MM (< 01:00 conta para HT)
  fim: string;               // HH:MM
  meioDia: boolean;
  tempoTransporteMin: number; // minutos (total do dia)
  diaSemTrabalho: boolean;
  pago?: boolean;             // dia já pago pela produtora

  // Overrides por dia, editados diretamente na folha (vazio = automático).
  // Cada dia é negociado com o produtor — TUDO tem de ser editável.
  ajRefeicao?: number;
  ajViatura?: number;
  ajTelefone?: number;
  ajMaterial?: number;
  ajPerDiem?: number;
  heaHoras?: number;         // horas extra A (contagem) forçadas
  hebHoras?: number;
  hrHoras?: number;
  heaValor?: number;         // € de HE-A forçado (ignora horas × taxa)
  hebValor?: number;
  hrValor?: number;
  /** Total do dia negociado à mão (vazio = soma automática) */
  totalDia?: number;

  // ── Cinema (folha semanal) ──
  /** Linha de FOLGA da semana (sáb/dom). Sem horas = descanso (0 €, conta
   *  24h de descanso); COM horas = dia de folga trabalhado (tudo a dobrar). */
  folga?: boolean;
  /** Feriado obrigatório: dia normal a dobrar (salário e taxas × multFolga). */
  feriado?: boolean;
};

// Tipo canónico — valores sempre em percentagem (ex: 25 significa 25%)
export type Fiscal = {
  IRS_percent: number;
  IVA_percent: number;
  /** Segurança Social (cinema): retida como o IRS. Ausente/0 = sem linha. */
  SS_percent?: number;
  nota?: string;
};

export type Tabela = {
  salarioDia?: number;     // €

  // ── Cinema (folha semanal): a SEMANA define o dia ──
  /** Salário por semana. Quando existe, salarioDia = salarioSemana / diasSemana
   *  (o salarioDia guardado é ignorado — a semana é a fonte de verdade). */
  salarioSemana?: number;
  diasSemana?: number;     // 5 | 6
  /** Divisor do valor-hora (cinema: 10h de trabalho + 1h de refeição = 11h de
   *  horário, mas a hora vale salário/10). Ausente = H_dia (publicidade). */
  horasBase?: number;
  /** Descanso mínimo entre semanas, em horas (60 = semana de 5 dias; 36 = 6). */
  descansoSemanal_h?: number;
  /** Dia de folga trabalhado / feriado: salário e taxas × isto (default 2). */
  multFolga?: number;
  multHEA?: number;        // default 1.5
  multHEB?: number;        // default 2.0
  multHR?: number;         // default 3.0

  // Overrides opcionais da taxa €/hora (editáveis na folha). Se definidos,
  // o motor usa-os em vez de salário/H × multiplicador.
  rateHEA?: number;
  rateHEB?: number;
  rateHR?: number;

  H_dia: number;            // horas contratuais do dia (default 11)
  limiar_A?: number;        // início das HE-A em horas acumuladas (default 11 => 12.ª hora)
  limiar_B?: number;        // início das HE-B (default 18 => 19.ª hora)
  limiar_HR?: number;       // intervalo mínimo entre dias para não cobrar HR, em horas (default 11)
  descanso_min: number;     // legado — substituído por limiar_HR quando definido
  arredondarMeiasHoras?: boolean;

  ajudas?: AjudasGlobais;   // € globais por dia
};

export type CalcDia = {
  HT_min: number;  // minutos totais de trabalho (wall-clock + refeições trabalhadas + transporte)
  HD_min: number;  // descanso até ao próximo dia (min)
  HEA_min: number; // minutos de HE-A
  HEB_min: number; // minutos de HE-B
  HR_min: number;  // minutos de HR (défice de descanso)
  HEA_h: number;   // HE-A em horas decimais (arredondado a 2 casas, para mostrar)
  HEB_h: number;
  HR_h: number;
  HEA_valor: number; // € de HE-A
  HEB_valor: number; // € de HE-B
  HR_valor: number;  // € de HR

  salarioDia: number;
  ajudasTotal: number;
  totalDia: number;

  // Ajudas efetivas do dia (override do dia ?? valor global) — o que a folha
  // e o PDF mostram em cada linha.
  ajRef: number;
  ajViat: number;
  ajTel: number;
  ajMat: number;
  ajPer: number;

  /** Multiplicador aplicado ao dia (2 = folga trabalhada/feriado; 1 = normal). */
  dobra: number;
  /** Linha de descanso (folga sem horas): 0 € mas conta horas de descanso. */
  descanso: boolean;
};
