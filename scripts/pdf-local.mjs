// scripts/pdf-local.mjs — gera um PDF com a função api/pdf.js usando o
// Edge/Chrome do computador (sem Vercel), para ver o resultado antes de publicar.
//
//   node scripts/pdf-local.mjs <folha.html> <saida.pdf>
//
// Imprime o número de páginas e o tamanho de cada uma (MediaBox), que é o que
// interessa confirmar: A3 horizontal = 1190×842 pt, A4 vertical = 595×842 pt.
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { renderPdf } = require("../api/pdf.js");

const [input, output = "folha.pdf"] = process.argv.slice(2);
if (!input) { console.error("uso: node scripts/pdf-local.mjs <folha.html> <saida.pdf>"); process.exit(1); }

const html = fs.readFileSync(input, "utf8");
const t0 = Date.now();
const pdf = await renderPdf(html);
fs.writeFileSync(output, pdf);

const txt = pdf.toString("latin1");
const boxes = [...txt.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)]
  .map((m) => `${Math.round(+m[3] - +m[1])}×${Math.round(+m[4] - +m[2])} pt`);
const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(`ok ${output}: ${(pdf.length / 1024).toFixed(0)} KB, ${pages} página(s) [${[...new Set(boxes)].join(", ")}] em ${Date.now() - t0} ms`);
process.exit(0);
