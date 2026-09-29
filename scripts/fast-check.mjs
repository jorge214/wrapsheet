// scripts/fast-check.mjs
// Verificação INSTANTÂNEA a seguir a cada edição (hook PostToolUse). Só coisas
// que custam milissegundos — a verificação de tipos e os testes ficam para o
// fim da tarefa (scripts/verify.mjs), senão cada edição custava 10 segundos.
//
// Hoje: os 9 ficheiros de tradução têm de continuar JSON válido. São editados
// por scripts (inserção por âncora) e um ficheiro partido só dá erro quando a
// app arranca — tarde de mais.
//
// Recebe o JSON do hook no stdin; sai com 2 e uma mensagem se algo estiver mal.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const I18N = join(ROOT, "src", "i18n");

let stdin = "";
try {
  stdin = readFileSync(0, "utf8");
} catch {}
let ficheiro = "";
try {
  const j = JSON.parse(stdin || "{}");
  ficheiro = String(j?.tool_response?.filePath || j?.tool_input?.file_path || "");
} catch {}

// Só corre quando a edição tocou numa tradução (ou quando não sabemos qual foi)
const tocouI18n = !ficheiro || /[/\\]src[/\\]i18n[/\\].*\.json$/i.test(ficheiro.replace(/\\/g, "/"));
if (!tocouI18n) process.exit(0);

const partidos = [];
for (const f of readdirSync(I18N).filter((x) => x.endsWith(".json"))) {
  try {
    JSON.parse(readFileSync(join(I18N, f), "utf8"));
  } catch (e) {
    partidos.push(`${f}: ${e.message}`);
  }
}

if (partidos.length) {
  console.error("JSON de tradução inválido — a app não arranca assim:\n" + partidos.map((p) => "  " + p).join("\n"));
  process.exit(2);
}
process.exit(0);
