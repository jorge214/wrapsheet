-- ============================================================================
-- dev_bootstrap.sql — setup COMPLETO do projeto Supabase de DEV (wrapsheet-dev)
-- Colar UMA vez no SQL Editor do projeto de dev e correr.
-- NÃO correr em produção (a produção já tem as tabelas base; lá aplicam-se só
-- as migrações de supabase/migrations/, pela ordem, quando for a altura).
-- ============================================================================

-- ── 1) Tabelas base (espelho da produção: blobs JSON por utilizador) ────────
create table if not exists public.projects (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table if not exists public.profiles (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

alter table public.projects enable row level security;
alter table public.profiles enable row level security;

-- Cada utilizador só vê/escreve as suas linhas (a app usa a publishable key)
drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own profiles" on public.profiles;
create policy "own profiles" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 2) Migração 0001: profile_id nos projetos (multi-perfil) ────────────────
alter table public.projects
  add column if not exists profile_id text;

create index if not exists projects_user_profile_idx
  on public.projects (user_id, profile_id);

-- (o backfill da 0001 não faz nada num projeto vazio — incluído por paridade)
update public.projects p
set profile_id = pr.id
from public.profiles pr
where p.profile_id is null
  and p.user_id = pr.user_id
  and (select count(*) from public.profiles p2 where p2.user_id = pr.user_id) = 1;

-- ── 3) PASSO 5: tabela de direitos (entitlements) ───────────────────────────
-- Um direito por utilizador. `source` preparado para várias origens:
--   'manual'     -> concedido à mão (equivalente ao antigo profiles_unlocked)
--   'revenuecat' -> subscrição iOS (passo 7)
--   'stripe'     -> web/PC (futuro)
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Teto do produto: 9,99€ = ATÉ 10 perfis; não existe plano acima disso.
  max_profiles int not null default 1 check (max_profiles between 1 and 10),
  active boolean not null default true,
  source text not null default 'manual',
  expires_at timestamptz,            -- null = sem expiração
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- O utilizador LÊ o seu direito; ESCREVER só com a service/secret key
-- (webhooks RevenueCat/Stripe e concessões manuais) — sem policy de escrita
-- para authenticated, o RLS bloqueia tudo o resto.
drop policy if exists "read own entitlement" on public.entitlements;
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);

-- Reforço do teto (idempotente): garante o check 1..10 mesmo que a tabela
-- tenha sido criada por uma versão anterior deste script.
alter table public.entitlements drop constraint if exists entitlements_max_profiles_check;
alter table public.entitlements add constraint entitlements_max_profiles_check
  check (max_profiles between 1 and 10);

-- ── 4) Helper (opcional): conceder direito a um utilizador de teste ─────────
-- Depois de registares a conta de teste na app apontada ao dev, corre:
--   insert into public.entitlements (user_id, max_profiles, source)
--   select id, 10, 'manual' from auth.users where email = 'EMAIL_DE_TESTE'
--   on conflict (user_id) do update set max_profiles = 10, active = true;
