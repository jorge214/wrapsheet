// scripts/pdf-extents.mjs — mede, por página de um PDF, o tamanho da folha e a
// caixa que a TINTA ocupa lá dentro (margens reais em cima/baixo/esquerda/direita).
//
//   node scripts/pdf-extents.mjs folha.pdf
//
// Serve para responder a "a folha tem margem a mais de um lado" ou "transborda"
// com números em vez de olhómetro. Lê os fluxos de conteúdo (Flate), segue a
// matriz corrente (cm/q/Q) e regista a extensão dos rectângulos (re) e do texto
// (Td/TD/Tm/T*/TJ/Tj) — chega para enquadrar a mancha da folha.
import fs from "node:fs";
import zlib from "node:zlib";

const file = process.argv[2];
if (!file) { console.error("uso: node scripts/pdf-extents.mjs <ficheiro.pdf>"); process.exit(1); }
const buf = fs.readFileSync(file);
const raw = buf.toString("latin1");

// ── objetos do PDF (sem xref: varre "N 0 obj … endobj") ──────────────────────
const objs = new Map();
for (const m of raw.matchAll(/(\d+)\s+0\s+obj\b([\s\S]*?)endobj/g)) objs.set(+m[1], m[2]);

function streamOf(src) {
  const i = src.indexOf("stream");
  if (i < 0) return null;
  let s = i + 6;
  if (src[s] === "\r") s++;
  if (src[s] === "\n") s++;
  const e = src.indexOf("endstream", s);
  if (e < 0) return null;
  const data = Buffer.from(src.slice(s, e), "latin1");
  if (/\/FlateDecode/.test(src.slice(0, i))) {
    try { return zlib.inflateSync(data); } catch { return null; }
  }
  return data;
}

// ── páginas: /Type /Page com /MediaBox e /Contents ───────────────────────────
const paginas = [];
for (const [num, src] of objs) {
  if (!/\/Type\s*\/Page[^s]/.test(src)) continue;
  let mb = src.match(/\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/);
  if (!mb) {
    const pai = src.match(/\/Parent\s+(\d+)/);
    const p = pai && objs.get(+pai[1]);
    if (p) mb = p.match(/\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/);
  }
  const cont = [...src.matchAll(/\/Contents\s+(?:(\d+)\s+0\s+R|\[([^\]]*)\])/g)];
  const ids = [];
  for (const c of cont) {
    if (c[1]) ids.push(+c[1]);
    else for (const r of c[2].matchAll(/(\d+)\s+0\s+R/g)) ids.push(+r[1]);
  }
  paginas.push({ num, mb: mb ? mb.slice(1, 5).map(Number) : null, ids });
}
paginas.sort((a, b) => a.num - b.num);

const NUM = "[-+]?[0-9]*\\.?[0-9]+";
function extentes(txt) {
  let ctm = [1, 0, 0, 1, 0, 0];
  const pilha = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const ponto = (x, y) => {
    const X = ctm[0] * x + ctm[2] * y + ctm[4];
    const Y = ctm[1] * x + ctm[3] * y + ctm[5];
    if (X < minX) minX = X; if (X > maxX) maxX = X;
    if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
  };
  const re = new RegExp(
    `(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+re|` +   // 1-4 rectângulo
    `(${NUM})\\s+(${NUM})\\s+(?:m|l)\\b|` +                    // 5-6 linha
    `(${NUM})\\s+(${NUM})\\s+(?:Td|TD)\\b|` +                  // 7-8 texto relativo
    `(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(cm|Tm)\\b|` + // 9-15
    `\\b(q|Q|BT|ET)\\b`, "g");                                 // 16
  let tm = null;
  for (const m of txt.matchAll(re)) {
    if (m[1] !== undefined) {
      const [x, y, w, h] = [+m[1], +m[2], +m[3], +m[4]];
      ponto(x, y); ponto(x + w, y + h);
    } else if (m[5] !== undefined) {
      ponto(+m[5], +m[6]);
    } else if (m[7] !== undefined && tm) {
      tm = [tm[0], tm[1], tm[2], tm[3], tm[4] + +m[7] * tm[0], tm[5] + +m[8] * tm[3]];
      ponto(tm[4], tm[5]);
    } else if (m[9] !== undefined) {
      const v = [+m[9], +m[10], +m[11], +m[12], +m[13], +m[14]];
      if (m[15] === "cm") {
        ctm = [
          v[0] * ctm[0] + v[1] * ctm[2], v[0] * ctm[1] + v[1] * ctm[3],
          v[2] * ctm[0] + v[3] * ctm[2], v[2] * ctm[1] + v[3] * ctm[3],
          v[4] * ctm[0] + v[5] * ctm[2] + ctm[4], v[4] * ctm[1] + v[5] * ctm[3] + ctm[5],
        ];
      } else { tm = v; ponto(v[4], v[5]); }
    } else if (m[16] === "q") pilha.push(ctm.slice());
    else if (m[16] === "Q") { const p = pilha.pop(); if (p) ctm = p; }
    else if (m[16] === "BT") tm = [1, 0, 0, 1, 0, 0];
    else if (m[16] === "ET") tm = null;
  }
  return { minX, minY, maxX, maxY };
}

const mm = (pt) => (pt * 25.4 / 72).toFixed(1);
console.log(file.split(/[\\/]/).pop() + " — " + paginas.length + " página(s)");
paginas.forEach((p, i) => {
  const partes = p.ids.map((id) => { const s = objs.get(id); const b = s && streamOf(s); return b ? b.toString("latin1") : ""; });
  const e = extentes(partes.join("\n"));
  const [x0, y0, x1, y1] = p.mb || [0, 0, 0, 0];
  const W = x1 - x0, H = y1 - y0;
  if (!isFinite(e.minX)) { console.log(`  pág ${i + 1}: ${Math.round(W)}×${Math.round(H)} pt — sem conteúdo legível`); return; }
  console.log(
    `  pág ${i + 1}: folha ${Math.round(W)}×${Math.round(H)} pt` +
    ` · tinta ${Math.round(e.maxX - e.minX)}×${Math.round(e.maxY - e.minY)} pt` +
    ` · margens esq ${mm(e.minX - x0)} / dir ${mm(x1 - e.maxX)} / cima ${mm(y1 - e.maxY)} / baixo ${mm(e.minY - y0)} mm` +
    ` · largura usada ${(100 * (e.maxX - e.minX) / W).toFixed(1)}%`
  );
});
