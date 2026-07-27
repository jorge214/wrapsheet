-- 0001_multi_profile_profile_id.sql
-- Multi-perfil (branch feat/multi-perfil) — PASSO 1: ligar projetos a perfis.
--
-- SEGURANÇA (a app 1.0.19 está em review e a web em produção partilham esta BD):
--   * 100% ADITIVO: só adiciona UMA coluna NULLABLE + um índice. Nada apagado
--     nem renomeado.
--   * A app atual (web em produção + 1.0.19 em review) IGNORA esta coluna — lê e
--     escreve tudo no blob JSON `data` (select data, updated_at). Por isso NÃO parte.
--   * Aplicar PRIMEIRO no projeto Supabase de DEV. Em produção só DEPOIS da
--     1.0.19 estar aprovada.

-- 1) Coluna nullable: perfil dono do projeto.
--    O tipo é `text` porque os ids de perfil são gerados no cliente (String(Date.now())),
--    iguais aos ids já usados em `projects.id` / `profiles.id`.
alter table public.projects
  add column if not exists profile_id text;

-- 2) Índice para filtrar por perfil (queries / RLS server-side no futuro — passo 6).
create index if not exists projects_user_profile_idx
  on public.projects (user_id, profile_id);

-- 3) Backfill SEGURO: quem tem exatamente 1 perfil -> todos os seus projetos são
--    desse perfil. Como o limite atual é 1 perfil, isto cobre praticamente toda a
--    base. Utilizadores com 0 ou >1 perfis ficam a NULL e são resolvidos no
--    cliente (stamp do perfil ativo -> sync). Só toca em linhas ainda a NULL.
update public.projects p
set profile_id = pr.id
from public.profiles pr
where p.profile_id is null
  and p.user_id = pr.user_id
  and (select count(*) from public.profiles p2 where p2.user_id = pr.user_id) = 1;

-- NOTA: não se cria coluna profile_id na tabela `profiles` (um perfil não pertence
-- a outro perfil). O direito de multi-perfil (max_profiles) vai numa tabela
-- `entitlements` à parte, criada num passo posterior (com coluna `source` para
-- aceitar RevenueCat agora e Stripe/web mais tarde).
