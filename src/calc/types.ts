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
  salarioDia?: number;       // override do salário só deste dia (se vazio usa o global)
  inicio: string;            // HH:MM
  refeicaoTrabalho: string;  // HH:MM (< 01:00 conta para HT)
  jantarTrabalho: string;    // HH:MM (< 01:00 conta para HT)
  fim: string;               // HH:MM
  meioDia: boolean;
  tempoTransporteMin: number; // minutos (total do dia)
  diaSemTrabalho: boolean;
  pago?: boolean;             // dia já pago pela produtora
};

// Tipo canónico — valores sempre em percentagem (ex: 25 significa 25%)
export type Fiscal = {
  IRS_percent: number;
  IVA_percent: number;
  nota?: string;
};

export type Tabela = {
  salarioDia?: number;     // €
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
};
