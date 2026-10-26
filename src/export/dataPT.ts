// Data escrita na folha ("DD/MM/AAAA" ou "DD/MM/AA") → ISO "AAAA-MM-DD", ou
// null se não for uma data que exista. A folha já valida ao sair da célula;
// isto é a segunda barreira, do lado da app: antes só se verificava a FORMA
// ("23/21/1020" passava e gravava-se "1020-21-23") e um ano com 2 dígitos era
// recusado em silêncio.
export function parseDataPT(texto: unknown): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(texto ?? "").trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mo = Number(m[2]);
  const yy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (yy < 1900 || yy > 2100) return null;
  const dt = new Date(Date.UTC(yy, mo - 1, dd));
  if (dt.getUTCFullYear() !== yy || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== dd) return null;
  return `${yy}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
