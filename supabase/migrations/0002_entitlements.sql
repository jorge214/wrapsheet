-- 0002_entitlements.sql — PASSO 5 do multi-perfil: tabela de direitos.
-- 100% ADITIVO (tabela nova + RLS). Aplicar em DEV primeiro; em produção só
-- quando o fluxo estiver testado. Não toca em nada existente.
--
-- Substitui o booleano app_metadata.profiles_unlocked por um limite lido da BD:
-- o cliente lê max_profiles (RLS: só a própria linha); a escrita é exclusiva da
-- service key (webhooks RevenueCat/Stripe do passo 7, concessões manuais).

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  max_profiles int not null default 1 check (max_profiles >= 1),
  active boolean not null default true,
  source text not null default 'manual', -- 'manual' | 'revenuecat' | 'stripe'
  expires_at timestamptz,                -- null = sem expiração
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

drop policy if exists "read own entitlement" on public.entitlements;
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);
