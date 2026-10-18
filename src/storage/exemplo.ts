// Folha de exemplo para quem entra sem nenhuma folha.
//
// Cerca de um terço das contas registou-se e nunca criou uma folha (18/10/2026).
// Uma folha já preenchida mostra logo o que a app faz: horas extra calculadas,
// totais e o PDF. Cria-se UMA vez por conta — a marca vive nos metadados do
// utilizador (`exemplo_v1`), por isso não volta a aparecer noutro aparelho nem
// depois de apagada.
//
// Nunca se cria para quem já tem folhas: além do armazenamento local, conta-se
// na NUVEM (a quem abre a app num telemóvel novo sem rede, o local está vazio
// mas a conta não). Se a contagem falhar, não se cria nada.
import i18n from "../i18n/i18n";
import { supabase } from "../lib/supabase";
import { syncProjectToCloud } from "../sync/syncService";
import { createProject, getProject, listArchivedProjects, listProjects, saveProject, type Dia, type ProjectState } from "./projects";

export const MARCA_EXEMPLO = "exemplo_v1";

/** Decide se se cria a folha de exemplo. `naNuvem` null = não se sabe → não. */
export function precisaDeExemplo(o: { jaMarcado: boolean; locais: number; naNuvem: number | null }): boolean {
  return !o.jaMarcado && o.locais === 0 && o.naNuvem === 0;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Preenche um projeto acabado de criar com 3 dias de exemplo (os 3 dias antes de `hoje`). */
export function montarExemplo(p: ProjectState, hoje: Date, t: (k: string, o?: any) => string): ProjectState {
  const dia = (offset: number): string => {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - offset));
    return iso(d);
  };
  const modelo = p.dias[0];
  const filmagem = t("day_description_default", { defaultValue: "Filmagem" });
  const dias: Dia[] = [
    { ...modelo, data: dia(3), descricao: t("example_day_prep", { defaultValue: "Preparação" }), inicio: "09:00", fim: "18:00", ajRefeicao: 15 },
    { ...modelo, data: dia(2), descricao: filmagem, inicio: "07:00", fim: "20:30", ajRefeicao: 15 },
    { ...modelo, data: dia(1), descricao: filmagem, inicio: "06:30", fim: "19:00", ajRefeicao: 15, ajViatura: 25 },
  ];
  return {
    ...p,
    exemplo: true, // marca no blob (fora do tipo ProjectState de propósito)
    projeto: {
      ...p.projeto,
      titulo: t("example_project_title", { defaultValue: "Exemplo — Spot publicitário" }),
      // a barra vermelha da folha mostra o filme; sem ele dizia só "PUBLICIDADE"
      filme: t("example_project_title", { defaultValue: "Exemplo — Spot publicitário" }),
      produtora: t("example_producer", { defaultValue: "Produtora de exemplo" }),
    },
    // O perfil de quem acabou de entrar ainda não tem salário: sem isto a folha
    // de exemplo mostrava tudo a 0. As taxas de horas extra ficam por preencher
    // e o motor usa o automático (hora normal × 1,5 / × 2 / × 3).
    tabela: { ...p.tabela, salarioDia: Number(p.tabela.salarioDia) > 0 ? p.tabela.salarioDia : 250 },
    dias,
  } as unknown as ProjectState;
}

/** Chamado depois de cada sincronização. Silencioso: qualquer falha = não faz nada. */
export async function criarExemploSePreciso(user: { id: string; user_metadata?: Record<string, any> } | null): Promise<void> {
  try {
    if (!user) return;
    const jaMarcado = !!user.user_metadata?.[MARCA_EXEMPLO];
    if (jaMarcado) return;
    const locais = (await listProjects()).length + (await listArchivedProjects()).length;
    let naNuvem: number | null = null;
    if (locais === 0) {
      // Conta tudo, incluindo apagados: quem apagou as folhas já não é novo.
      const { count, error } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      naNuvem = error ? null : count ?? null;
    }
    if (!precisaDeExemplo({ jaMarcado, locais, naNuvem })) {
      // Já tem folhas: marca para não voltar a contar a cada sincronização.
      if (locais > 0 || (naNuvem ?? 0) > 0) await supabase.auth.updateUser({ data: { [MARCA_EXEMPLO]: true } });
      return;
    }
    const id = await createProject();
    const base = await getProject(id);
    if (!base) return;
    const t = (k: string, o?: any) => String(i18n.t(k, o));
    const gravado = await saveProject(montarExemplo(base, new Date(), t));
    await syncProjectToCloud(user.id, gravado as any);
    await supabase.auth.updateUser({ data: { [MARCA_EXEMPLO]: true } });
  } catch {
    // nunca impede a app de arrancar
  }
}
