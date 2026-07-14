// src/models/project.ts
// Fix #13: import the single canonical Fiscal type from calc/types (was duplicated here)
import { Dia, Fiscal } from "../calc/types";

export type Perfil = {
  nome: string; email: string; telefone: string;
  departamento: string; funcao: string; empresa?: string;
  nif?: string; iban?: string; swift?: string;
};

export type Projeto = {
  titulo?: string; filme: string; produtora: string; nifProdutora?: string;
  semana?: string; mes: number; ano: number;
  /** Total de dias editado à mão na folha (5,5 / 4,3…); vazio = contagem automática */
  totalDias?: number;
};

export type Tabela = {
  salarioDia?: number;
  H_dia: number;
  descanso_min: number;  // stored in HOURS (field name is misleading)
  multHEA?: number;
  multHEB?: number;
  multHR?: number;
  rateHEA?: number;
  rateHEB?: number;
  rateHR?: number;
  limiar_A?: number;
  limiar_B?: number;
  limiar_HR?: number;
  arredondarMeiasHoras?: boolean;
  ajudas?: { refeicao?: number; viatura?: number; material?: number; telefone?: number; perDiem?: number };
};

export type ProjectState = {
  id: string;
  perfil: Perfil;
  projeto: Projeto;
  fiscal: Fiscal;
  tabela: Tabela;
  dias: Dia[];
  notas?: string;
  condicoes?: string;
  condTitulo?: string;
  condBoxes?: { titulo: string; texto: string; img?: string }[];
  pago?: boolean;
  updatedAt?: number;
};
