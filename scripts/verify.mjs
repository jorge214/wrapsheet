// scripts/verify.mjs
// Verificação de fim de tarefa: tipos + testes. Usada em dois sítios —
//   • hook Stop do Claude Code (com --hook, devolve JSON)
//   • hook pre-commit do git (saída legível, código de saída != 0 se falhar)
//
// Porque não `npx tsc --noEmit` simples: a tsconfig.json do projeto tem um erro
// (TS5098: customConditions vs moduleResolution) que faz o tsc abortar ANTES de
// verificar seja o que for. Os flags abaixo contornam-no. Enquanto isso não for
// arranjado, há erros ANTIGOS noutros ficheiros; comparamos com a linha de base
// gravada em scripts/tsc-baseline.txt e só reclamamos dos NOVOS. Assim o hook
// nunca dispara por dívida que já lá estava.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Deixa uma linha de erro do tsc comparável com a linha de base. Sem isto a
 * comparação dá falsos alarmes — e deu, logo na primeira vez que o hook Stop
 * correu a sério. Tira:
 *   • o nº da linha/coluna — o mesmo erro anda para baixo a cada edição;
 *   • a raiz do projeto dos caminhos absolutos que o tsc mete DENTRO das
 *     mensagens ("import(\"C:/Users/.../models/project\")"). No Windows tanto
 *     dá "C:" como "c:" conforme o processo arrancou, e a linha de base é
 *     partilhada no repositório: sem isto só valia nesta máquina.
 * Testes em verify.test.mjs.
 */
export function normalizarErro(linha, root) {
  const raiz = new RegExp(String(root).replace(/\\/g, "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return String(linha).replace(/\\/g, "/").replace(/\((\d+),(\d+)\)/, "").replace(raiz, "<raiz>").trim();
}

/** Conjunto de erros (normalizados) numa saída do tsc. */
export function errosDe(txt, root) {
  return new Set(
    String(txt)
      .split(/\r?\n/)
      .filter((l) => /^(app|src)[/\\].*error TS\d+/.test(l))
      .map((l) => normalizarErro(l, root))
  );
}

// Chamamos os binários locais com o próprio node em vez de `npx`: no Windows o
// npx.cmd precisa de shell (o Node 22 recusa .cmd sem ele) e ainda por cima é
// mais lento a arrancar.
function run(entry, args) {
  try {
    return {
      ok: true,
      out: execFileSync(process.execPath, [join(ROOT, entry), ...args], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    };
  } catch (e) {
    return { ok: false, out: String(e.stdout || "") + String(e.stderr || "") };
  }
}

function main() {
  const BASELINE = join(ROOT, "scripts", "tsc-baseline.txt");
  const hookMode = process.argv.includes("--hook");
  const TSC = "node_modules/typescript/bin/tsc";
  const VITEST = "node_modules/vitest/vitest.mjs";

  // ── Tipos ──────────────────────────────────────────────────────────────────
  const tsc = run(TSC, ["--noEmit", "--module", "esnext", "--moduleResolution", "bundler"]);
  const agora = errosDe(tsc.out, ROOT);
  const base = existsSync(BASELINE) ? errosDe(readFileSync(BASELINE, "utf8"), ROOT) : new Set();
  const novos = [...agora].filter((e) => !base.has(e));

  // ── Testes ─────────────────────────────────────────────────────────────────
  const test = run(VITEST, ["run", "--reporter=dot"]);

  const problemas = [];
  if (novos.length) problemas.push(`Erros de tipos NOVOS (${novos.length}):\n` + novos.map((e) => "  " + e).join("\n"));
  if (!test.ok) {
    const falhas = test.out.split(/\r?\n/).filter((l) => /FAIL|AssertionError|✗|×/.test(l)).slice(0, 25);
    problemas.push("Testes a falhar:\n" + (falhas.length ? falhas.join("\n") : test.out.slice(-2000)));
  }

  if (hookMode) {
    if (problemas.length) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason:
            "A verificação de fim de tarefa falhou — corrige antes de dar por terminado.\n\n" +
            problemas.join("\n\n") +
            "\n\n(Se um teste falhar, corrige o CÓDIGO. Os valores esperados vêm das tabelas de referência e nunca se alteram para fazer um teste passar.)",
        })
      );
    } else {
      process.stdout.write(JSON.stringify({ suppressOutput: true }));
    }
    process.exit(0); // o bloqueio vai no JSON, não no código de saída
  }

  if (problemas.length) {
    console.error("\n✖ Verificação falhou\n");
    console.error(problemas.join("\n\n"));
    console.error("");
    process.exit(1);
  }
  console.log(`✔ Tipos sem erros novos (${base.size} conhecidos na linha de base) · testes a passar`);
}

// Só corre quando é chamado diretamente. Sem esta guarda, importar o ficheiro
// num teste punha o vitest a chamar o vitest — recursivamente.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
