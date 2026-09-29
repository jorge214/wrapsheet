# scripts/backup.ps1
# Cópia de segurança da base de dados de PRODUÇÃO do WrapSheet.
#
#   powershell -ExecutionPolicy Bypass -File scripts/backup.ps1
#
# Grava backups/wrapsheet-AAAA-MM-DD-HHmm.sql (a pasta backups/ está no
# .gitignore — um dump tem os dados de toda a gente e NUNCA vai para o git).
#
# Precisa de:
#   1. pg_dump — já está em %USERPROFILE%\tools\pgsql\bin (binários portáteis,
#      só a pasta bin, sem servidor). Noutra máquina: instala as "Command Line
#      Tools" do PostgreSQL ou aponta a variável PG_DUMP.
#   2. A connection string, num de DOIS sítios (nunca no código):
#        - variável de ambiente SUPABASE_DB_URL, ou
#        - ficheiro backups/.db-url (uma linha; a pasta está ignorada pelo git)
#      Usa a "Session pooler" (porta 5432): a ligação direta é só IPv6 no plano
#      gratuito e falha na maioria das redes domésticas.
#
# O que sai no dump: esquemas `public` (projetos, perfis, direitos — com
# triggers e políticas) e `auth` (as contas, sem as quais os projetos não têm
# dono). Sem donos nem privilégios (--no-owner --no-privileges), para o
# ficheiro poder ser restaurado noutro projeto Supabase.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backups = Join-Path $root "backups"

# ── 1. pg_dump ────────────────────────────────────────────────────────────────
$pgDump = $null
if ($env:PG_DUMP -and (Test-Path $env:PG_DUMP)) { $pgDump = $env:PG_DUMP }
if (-not $pgDump) { $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue; if ($cmd) { $pgDump = $cmd.Source } }
if (-not $pgDump) {
  # Binários portáteis (só a pasta bin, sem servidor) — foi onde o Claude os pôs
  $portatil = Join-Path $env:USERPROFILE "tools\pgsql\bin\pg_dump.exe"
  if (Test-Path $portatil) { $pgDump = $portatil }
}
if (-not $pgDump) {
  # Instalações típicas no Windows (EDB), da versão mais recente para a mais antiga
  $candidatos = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending
  if ($candidatos) { $pgDump = $candidatos[0].FullName }
}
if (-not $pgDump) {
  Write-Host ""
  Write-Host "pg_dump nao encontrado." -ForegroundColor Red
  Write-Host "Instala as ferramentas do PostgreSQL (so 'Command Line Tools', sem o servidor):"
  Write-Host "  https://www.enterprisedb.com/downloads/postgres-postgresql-downloads"
  Write-Host "Ou aponta a variavel PG_DUMP para o pg_dump.exe."
  exit 1
}

# ── 2. connection string (nunca impressa) ─────────────────────────────────────
$url = $env:SUPABASE_DB_URL
$urlFile = Join-Path $backups ".db-url"
if (-not $url -and (Test-Path $urlFile)) { $url = (Get-Content $urlFile -Raw).Trim() }
if (-not $url) {
  Write-Host ""
  Write-Host "Falta a connection string." -ForegroundColor Red
  Write-Host "Poe-a na variavel SUPABASE_DB_URL ou no ficheiro backups\.db-url (uma linha)."
  Write-Host "No painel do Supabase: botao 'Connect' > Connection String > Session pooler."
  exit 1
}
if ($url -notmatch '^postgres(ql)?://') {
  Write-Host "A connection string nao parece valida (tem de comecar por postgresql://)." -ForegroundColor Red
  exit 1
}
if ($url -match 'YOUR-PASSWORD') {
  Write-Host "A connection string ainda tem [YOUR-PASSWORD] — substitui pela password da base." -ForegroundColor Red
  exit 1
}

# ── 3. dump ───────────────────────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $backups | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$out = Join-Path $backups "wrapsheet-$stamp.sql"

Write-Host "A fazer dump de producao para backups\wrapsheet-$stamp.sql ..."
$inicio = Get-Date

# --no-owner/--no-privileges: os donos sao roles internos do Supabase e nao
# existem noutro sitio; sem isto o restore rebenta logo na primeira linha.
& $pgDump $url `
  --schema=public --schema=auth `
  --no-owner --no-privileges `
  --file $out

if ($LASTEXITCODE -ne 0) {
  Write-Host "pg_dump falhou (codigo $LASTEXITCODE)." -ForegroundColor Red
  if (Test-Path $out) { Remove-Item $out -Force }
  exit $LASTEXITCODE
}

$mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
$seg = [math]::Round(((Get-Date) - $inicio).TotalSeconds)
Write-Host ("OK  {0} MB em {1}s  ->  {2}" -f $mb, $seg, $out) -ForegroundColor Green

# Quantos backups ha (so informativo — nao apaga nada sozinho)
$n = (Get-ChildItem $backups -Filter "wrapsheet-*.sql").Count
Write-Host "Backups guardados: $n"
