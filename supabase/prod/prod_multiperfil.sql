-- prod_multiperfil.sql — migracoes do multi-perfil para a base de PRODUCAO.
-- Correr UMA vez no SQL Editor do projeto de producao do Supabase.
--
-- ADITIVO: so acrescenta coluna/indice/tabela/trigger. Nada e apagado nem
-- renomeado, por isso a app que esta na App Store (1.0.22) e a web continuam
-- a funcionar exatamente na mesma enquanto isto corre.
--
-- Junta as migracoes 0001 + 0002 + 0003, pela ordem.

-- ============================================================
-- 0001_multi_profile_profile_id.sql
-- ============================================================
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

-- ============================================================
-- 0002_entitlements.sql
-- ============================================================
-- 0002_entitlements.sql — PASSO 5 do multi-perfil: tabela de direitos.
-- 100% ADITIVO (tabela nova + RLS). Aplicar em DEV primeiro; em produção só
-- quando o fluxo estiver testado. Não toca em nada existente.
--
-- Substitui o booleano app_metadata.profiles_unlocked por um limite lido da BD:
-- o cliente lê max_profiles (RLS: só a própria linha); a escrita é exclusiva da
-- service key (webhooks RevenueCat/Stripe do passo 7, concessões manuais).

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Teto do produto: 9,99€ = ATÉ 10 perfis; não existe plano acima disso.
  max_profiles int not null default 1 check (max_profiles between 1 and 10),
  active boolean not null default true,
  source text not null default 'manual', -- 'manual' | 'revenuecat' | 'stripe'
  expires_at timestamptz,                -- null = sem expiração
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

drop policy if exists "read own entitlement" on public.entitlements;
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);

-- ============================================================
-- 0003_profile_limit_trigger.sql
-- ============================================================
-- 0003_profile_limit_trigger.sql — PASSO 6: limite de perfis imposto na BD.
-- O cliente já trava a criação (passo 5), mas um cliente alterado contornava o
-- if. Este trigger torna o limite inviolável: INSERT de perfil novo acima do
-- permitido é rejeitado pela própria base de dados.
--
-- Regras:
--   * Só bloqueia INSERTs de perfis NOVOS. Upserts de perfis existentes
--     (edições/sync) passam sempre — quem já tem mais do que o limite mantém
--     e edita os que tem; só não cria novos.
--   * Lápides (data.deleted=true) passam sempre e não contam para o total.
--   * Limite = entitlements válido (active e não expirado) ou 1; teto 10.
-- ADITIVO: função + trigger novos; nada alterado/apagado.

create or replace function public.enforce_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed int;
  current_count int;
begin
  -- Upsert de perfil que já existe = edição/sync → passa sempre
  if exists (
    select 1 from public.profiles p
     where p.id = new.id and p.user_id = new.user_id
  ) then
    return new;
  end if;

  -- Lápide de eliminação → passa sempre
  if coalesce(new.data->>'deleted', 'false') = 'true' then
    return new;
  end if;

  select coalesce(
    (select e.max_profiles
       from public.entitlements e
      where e.user_id = new.user_id
        and e.active
        and (e.expires_at is null or e.expires_at > now())),
    1) into allowed;
  allowed := least(allowed, 10); -- teto absoluto do produto

  select count(*) into current_count
    from public.profiles p
   where p.user_id = new.user_id
     and coalesce(p.data->>'deleted', 'false') <> 'true';

  if current_count >= allowed then
    raise exception 'profile_limit_reached (% de %)', current_count, allowed
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_limit on public.profiles;
create trigger trg_enforce_profile_limit
  before insert on public.profiles
  for each row execute function public.enforce_profile_limit();

