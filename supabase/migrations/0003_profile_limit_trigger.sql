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
