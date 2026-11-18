-- 0004_pdf_exports.sql — um registo por cada PDF exportado (18/11/2026).
-- Para medir a ativação: quantas contas exportam o 1.º PDF, e quando. Cada
-- linha guarda a conta, o formato da folha, a orientação, a plataforma, se era
-- a folha de exemplo e a hora. Nada do conteúdo da folha.
--
-- ADITIVO: tabela nova; nenhuma tabela existente muda. As versões antigas da
-- app não a conhecem e continuam iguais (só a versão nova escreve aqui).
--
-- Apagar a conta (delete_user apaga a linha de auth.users) põe o user_id a
-- NULL: o evento fica anónimo — continua nos totais da semana, mas deixa de
-- estar ligado a alguém. Uma FK sem ON DELETE fazia o delete_user rebentar
-- (23503) e a Apple exige que apagar a conta funcione.

create table if not exists public.pdf_exports (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  formato text not null check (formato in ('publicidade', 'cinema')),
  orientacao text check (orientacao in ('landscape', 'portrait')),
  plataforma text check (plataforma in ('ios', 'android', 'web')),
  exemplo boolean not null default false,
  folha_id text
);

create index if not exists pdf_exports_user_criado on public.pdf_exports (user_id, criado_em);
create index if not exists pdf_exports_criado on public.pdf_exports (criado_em);

alter table public.pdf_exports enable row level security;

-- O cliente só INSERE, e só linhas suas. Não lê, não muda, não apaga: quem lê
-- é o relatório semanal (security definer).
drop policy if exists "pdf_exports insere os seus" on public.pdf_exports;
create policy "pdf_exports insere os seus" on public.pdf_exports
  for insert to authenticated
  with check (user_id = auth.uid());

-- Privilégios por coluna: o cliente escreve só o que descreve a exportação.
-- O user_id vem SEMPRE do default auth.uid() e a hora do servidor (um
-- relógio errado no telemóvel não estraga as contas).
revoke all on public.pdf_exports from anon, authenticated;
grant insert (formato, orientacao, plataforma, exemplo, folha_id) on public.pdf_exports to authenticated;
