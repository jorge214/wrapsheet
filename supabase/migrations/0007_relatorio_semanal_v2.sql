-- 0007_relatorio_semanal_v2.sql — relatório semanal, terceira versão (18/11/2026).
-- Duas correções à 0006:
--   • os PDFs e as "ativas" de cada semana contam-se pela hora de CHEGADA do
--     registo, como na 0005. Recuar a hora (criado_em - atraso_s) para essas
--     contagens fazia uma exportação feita sem rede na sexta e enviada na
--     segunda depois das 08:00 não contar em semana NENHUMA: a semana dela já
--     estava fotografada e a seguinte já não a apanhava. A hora real (recuada)
--     fica só para o teste "1.º PDF nos 7 dias a seguir ao registo";
--   • reenviar o relatório da mesma semana mostra sempre a fotografia
--     guardada (antes, o cabeçalho era recalculado e a tabela não — dois
--     números diferentes para a mesma semana no mesmo email).
-- E uma nota no rodapé: a 1.ª sessão de quem instala pela loja corre o código
-- que vem com a app (a atualização só se aplica no arranque seguinte), por
-- isso esses PDFs só se registam quando houver versões nas lojas com isto.
--
-- ADITIVO: só a função muda (create or replace).

create or replace function public.relatorio_semanal(
  p_para text default 'getwrapsheet@gmail.com',
  p_enviar boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  -- Desde quando há registo de exportações (versão de 18/11/2026)
  c_inicio_pdfs constant timestamptz := '2026-11-18 00:00:00+00';
  v_seg date;           -- segunda-feira de início da semana relatada
  v_ini timestamptz;
  v_fim timestamptz;
  v_coorte_ini timestamptz;
  v_contas_total int;
  v_contas_novas int;
  v_ativas int;
  v_pdfs int;
  v_pdfs_contas int;
  v_coorte int;
  v_coorte_pdf int;
  v_key text;
  v_html text;
  v_linhas text := '';
  v_pct text;
  r record;
begin
  -- A semana que acabou na última segunda 00:00 (Lisboa)
  v_seg := (date_trunc('week', now() at time zone 'Europe/Lisbon') - interval '7 days')::date;
  v_ini := v_seg::timestamp at time zone 'Europe/Lisbon';
  v_fim := (v_seg + 7)::timestamp at time zone 'Europe/Lisbon';
  v_coorte_ini := (v_seg - 7)::timestamp at time zone 'Europe/Lisbon';

  create temp table if not exists _rs_contas (id uuid primary key, criada timestamptz) on commit drop;
  truncate _rs_contas;
  insert into _rs_contas
    select u.id, u.created_at
      from auth.users u
     where u.created_at < v_fim
       and lower(u.email) not in (select lower(email) from public.contas_internas);

  select count(*) into v_contas_total from _rs_contas;
  select count(*) into v_contas_novas from _rs_contas where criada >= v_ini;

  -- Ativas: mexeram numa folha SUA (não a de exemplo, não apagada) ou
  -- exportaram um PDF de uma folha sua, dentro da semana (hora de chegada).
  select count(*) into v_ativas from (
    select p.user_id
      from public.projects p join _rs_contas c on c.id = p.user_id
     where p.updated_at >= v_ini and p.updated_at < v_fim
       and coalesce(p.data->>'deleted', 'false') <> 'true'
       and coalesce(p.data->>'exemplo', 'false') <> 'true'
    union
    select e.user_id
      from public.pdf_exports e join _rs_contas c on c.id = e.user_id
     where e.criado_em >= v_ini and e.criado_em < v_fim and not e.exemplo
  ) a;

  select count(*), count(distinct e.user_id) into v_pdfs, v_pdfs_contas
    from public.pdf_exports e
   where e.criado_em >= v_ini and e.criado_em < v_fim and not e.exemplo
     and (e.user_id is null or e.user_id in (select id from _rs_contas));

  -- Coorte: contas criadas na semana anterior (já tiveram 7 dias completos).
  -- Aqui conta a hora REAL da exportação (a de chegada menos o tempo na fila).
  select count(*) into v_coorte from _rs_contas where criada >= v_coorte_ini and criada < v_ini;
  if v_coorte_ini >= c_inicio_pdfs then
    select count(*) into v_coorte_pdf
      from _rs_contas c
     where c.criada >= v_coorte_ini and c.criada < v_ini
       and exists (
         select 1 from public.pdf_exports e
          where e.user_id = c.id and not e.exemplo
            and e.criado_em - make_interval(secs => coalesce(e.atraso_s, 0)) < c.criada + interval '7 days'
       );
  else
    v_coorte_pdf := null;
  end if;

  if not p_enviar then
    -- Pré-visualização: só os números, sem gravar nada
    return jsonb_build_object(
      'semana', v_seg, 'contas_total', v_contas_total, 'contas_novas', v_contas_novas,
      'ativas', v_ativas, 'pdfs', v_pdfs, 'pdfs_contas', v_pdfs_contas,
      'coorte_contas', v_coorte, 'coorte_pdf_7d', v_coorte_pdf);
  end if;

  -- A primeira fotografia da semana fica (a da segunda de manhã): recalcular
  -- mais tarde só baixava as "ativas" (contam pela ÚLTIMA edição de cada folha)
  insert into public.estatisticas_semanais
    (semana, contas_total, contas_novas, ativas, pdfs, pdfs_contas, coorte_contas, coorte_pdf_7d, calculado_em)
  values
    (v_seg, v_contas_total, v_contas_novas, v_ativas, v_pdfs, v_pdfs_contas, v_coorte, v_coorte_pdf, now())
  on conflict (semana) do nothing;

  -- O email mostra SEMPRE a fotografia guardada (num reenvio, a mesma que já
  -- está na tabela das últimas semanas)
  select s.contas_total, s.contas_novas, s.ativas, s.pdfs, s.pdfs_contas, s.coorte_contas, s.coorte_pdf_7d
    into v_contas_total, v_contas_novas, v_ativas, v_pdfs, v_pdfs_contas, v_coorte, v_coorte_pdf
    from public.estatisticas_semanais s
   where s.semana = v_seg;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_key is null then raise exception 'sem chave resend_api_key no vault'; end if;

  -- Tendência: as últimas 8 semanas guardadas
  for r in
    select * from public.estatisticas_semanais where semana <= v_seg order by semana desc limit 8
  loop
    v_pct := case
      when r.coorte_pdf_7d is null or r.coorte_contas = 0 then '—'
      else round(100.0 * r.coorte_pdf_7d / r.coorte_contas) || '% (' || r.coorte_pdf_7d || '/' || r.coorte_contas || ')'
    end;
    v_linhas := v_linhas
      || '<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">' || to_char(r.semana, 'DD/MM') || '</td>'
      || '<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">' || r.contas_novas || '</td>'
      || '<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">' || v_pct || '</td>'
      || '<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">' || r.ativas || '</td>'
      || '<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">' || r.pdfs || '</td></tr>';
  end loop;

  v_pct := case
    when v_coorte_pdf is null then '— (só há registo de PDFs desde 18/11)'
    when v_coorte = 0 then '— (nenhuma conta nova nessa semana)'
    else round(100.0 * v_coorte_pdf / v_coorte) || '%  (' || v_coorte_pdf || ' de ' || v_coorte || ')'
  end;

  v_html := '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px">'
    || '<h2 style="margin:0 0 4px">WrapSheet · a semana em números</h2>'
    || '<p style="margin:0 0 18px;color:#666">' || to_char(v_seg, 'DD/MM') || ' a ' || to_char(v_seg + 6, 'DD/MM/YYYY') || '</p>'
    || '<table style="border-collapse:collapse;width:100%;margin-bottom:22px">'
    || '<tr><td style="padding:8px 0;border-bottom:1px solid #eee">Contas novas</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:800">' || v_contas_novas || '</td></tr>'
    || '<tr><td style="padding:8px 0;border-bottom:1px solid #eee">Exportaram o 1.º PDF em 7 dias<br><span style="color:#888;font-size:13px">contas criadas de ' || to_char(v_seg - 7, 'DD/MM') || ' a ' || to_char(v_seg - 1, 'DD/MM') || '</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:800">' || v_pct || '</td></tr>'
    || '<tr><td style="padding:8px 0;border-bottom:1px solid #eee">Contas ativas na semana<br><span style="color:#888;font-size:13px">mexeram numa folha ou exportaram um PDF</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:800">' || v_ativas || '</td></tr>'
    || '<tr><td style="padding:8px 0;border-bottom:1px solid #eee">PDFs exportados</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:800">' || v_pdfs || ' <span style="color:#888;font-weight:400">(' || v_pdfs_contas || ' contas)</span></td></tr>'
    || '<tr><td style="padding:8px 0">Contas no total</td><td style="padding:8px 0;text-align:right;font-weight:800">' || v_contas_total || '</td></tr>'
    || '</table>'
    || '<p style="margin:0 0 6px;font-weight:800">Últimas semanas</p>'
    || '<table style="border-collapse:collapse;width:100%;font-size:14px">'
    || '<tr style="color:#666"><td style="padding:6px 10px">Semana</td><td style="padding:6px 10px;text-align:right">Novas</td><td style="padding:6px 10px;text-align:right">1.º PDF em 7 dias</td><td style="padding:6px 10px;text-align:right">Ativas</td><td style="padding:6px 10px;text-align:right">PDFs</td></tr>'
    || v_linhas
    || '</table>'
    || '<p style="margin-top:22px;color:#888;font-size:12px">Sem as contas internas e sem a folha de exemplo. O "1.º PDF em 7 dias" é sobre as contas da semana anterior, que já tiveram os 7 dias completos. '
    || 'Quem instala a app pela loja usa na 1.ª sessão a versão que vem com ela (a atualização só entra no arranque seguinte): até haver versões nas lojas com o registo dos PDF, esses PDF não contam e a percentagem sai por baixo.</p>'
    || '</div>';

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'WrapSheet <noreply@wrapsheet-app.com>',
      'to', jsonb_build_array(p_para),
      'subject', 'WrapSheet · semana de ' || to_char(v_seg, 'DD/MM') || ': ' || v_contas_novas || ' contas novas, ' || v_ativas || ' ativas',
      'html', v_html
    )
  );

  return jsonb_build_object('enviado_para', p_para, 'semana', v_seg);
end;
$$;

revoke all on function public.relatorio_semanal(text, boolean) from public, anon, authenticated;
