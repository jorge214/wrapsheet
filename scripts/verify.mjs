// scripts/verify.mjs
// Verificação de fim de tarefa: tipos + testes. Usada em dois sítios —
//   • hook Stop do Claude Code (com --hook, devolve JSON)
//   • hook pre-commit do git (saída legível, código de saída != 0 se falhar)
//
// Há 9 erros de tipos ANTIGOS no projeto (dívida de antes). Em vez de os
// arranjar todos agora, guardamos-lhes uma linha de base em
// scripts/tsc-baseline.txt e só reclamamos do que for NOVO. Duas regras que
// fazem a diferença entre isto ser uma rede e ser um teatro:
//
//   • Contamos OCORRÊNCIAS, não presenças. Tirar o nº da linha faz com que
//     dois erros iguais no mesmo ficheiro fiquem com o mesmo texto — uma
//     segunda chamada errada à mesma função passaria despercebida se
//     usássemos um conjunto. Se a base tem 1 e agora há 2, bloqueia.
//   • A linha de base só ENCOLHE. Quando um erro antigo desaparece, o
//     ficheiro é reescrito. Senão, arranjar um erro e voltar a parti-lo mais
//     tarde passava como "conhecido".
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

/** Linhas de erro do tsc (cruas) numa saída. */
export function linhasDeErro(txt) {
  return String(txt)
    .split(/\r?\n/)
    .filter((l) => /^(app|src)[/\\].*error TS\d+/.test(l));
}

/** Mapa erro-normalizado → nº de ocorrências. */
export function contarErros(txt, root) {
  const m = new Map();
  for (const l of linhasDeErro(txt)) {
    const k = normalizarErro(l, root);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * Compara com a linha de base. Devolve o que APARECEU (com quantas ocorrências
 * a mais) e o que DESAPARECEU — este último serve para apertar a linha de base.
 */
export function compararComBase(agora, base) {
  const apareceram = [];
  for (const [erro, n] of agora) {
    const antes = base.get(erro) ?? 0;
    if (n > antes) apareceram.push({ erro, novas: n - antes, antes });
  }
  const desapareceram = [];
  for (const [erro, n] of base) {
    const depois = agora.get(erro) ?? 0;
    if (depois < n) desapareceram.push({ erro, menos: n - depois });
  }
  return { apareceram, desapareceram };
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

  // O hook Stop recebe JSON no stdin. `stop_hook_active` = já estamos a
  // continuar por causa de um bloqueio anterior; bloquear outra vez seria
  // prender o agente num ciclo a tentar "resolver" o que não sabe resolver.
  let jaBloqueadoAntes = false;
  if (hookMode) {
    try {
      jaBloqueadoAntes = !!JSON.parse(readFileSync(0, "utf8") || "{}").stop_hook_active;
    } catch {}
  }

  // A tsconfig.json já não discute com a base do Expo (era o TS5098), por isso
  // o tsc corre com a MESMA configuração que o VS Code usa — sem flags.
  const tsc = run("node_modules/typescript/bin/tsc", ["--noEmit"]);
  const agora = contarErros(tsc.out, ROOT);
  const base = existsSync(BASELINE) ? contarErros(readFileSync(BASELINE, "utf8"), ROOT) : new Map();
  const { apareceram, desapareceram } = compararComBase(agora, base);

  const test = run("node_modules/vitest/vitest.mjs", ["run", "--reporter=dot"]);

  const problemas = [];
  if (apareceram.length) {
    const total = apareceram.reduce((s, x) => s + x.novas, 0);
    problemas.push(
      `Erros de tipos NOVOS (${total}):\n` +
        apareceram
          .map((x) => "  " + x.erro + (x.antes ? `   [já havia ${x.antes}, agora ${x.antes + x.novas}]` : ""))
          .join("\n")
    );
  }
  if (!test.ok) {
    const falhas = test.out.split(/\r?\n/).filter((l) => /FAIL|AssertionError|✗|×/.test(l)).slice(0, 25);
    problemas.push("Testes a falhar:\n" + (falhas.length ? falhas.join("\n") : test.out.slice(-2000)));
  }

  // Nada de novo e alguma coisa melhorou? Aperta a linha de base — ela só desce.
  let apertada = null;
  if (!problemas.length && desapareceram.length) {
    writeFileSync(BASELINE, linhasDeErro(tsc.out).join("\n") + (linhasDeErro(tsc.out).length ? "\n" : ""), "utf8");
    apertada =
      `Linha de base apertada: ${desapareceram.reduce((s, x) => s + x.menos, 0)} erro(s) antigo(s) desapareceram ` +
      `(ficam ${linhasDeErro(tsc.out).length}). scripts/tsc-baseline.txt foi atualizado — inclui-o no commit.`;
  }

  if (hookMode) {
    if (problemas.length && !jaBloqueadoAntes) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason:
            "A verificação de fim de tarefa falhou — corrige antes de dar por terminado.\n\n" +
            problemas.join("\n\n") +
            "\n\n(Se um teste falhar, corrige o CÓDIGO. Os valores esperados vêm das tabelas de " +
            "referência, calculados à mão, e NUNCA se alteram para fazer um teste passar.)",
        })
      );
    } else if (problemas.length) {
      // Segunda vez a falhar: deixa parar e conta ao Jorge, em vez de insistir.
      process.stdout.write(
        JSON.stringify({
          systemMessage:
            "⚠ A verificação continua a falhar depois de uma tentativa de correção — parei aqui em vez de insistir.\n\n" +
            problemas.join("\n\n"),
        })
      );
    } else {
      process.stdout.write(apertada ? JSON.stringify({ systemMessage: "✔ " + apertada }) : JSON.stringify({ suppressOutput: true }));
    }
    process.exit(0); // o bloqueio vai no JSON, não no código de saída
  }

  if (problemas.length) {
    console.error("\n✖ Verificação falhou\n");
    console.error(problemas.join("\n\n"));
    console.error("");
    process.exit(1);
  }
  if (apertada) console.log("✔ " + apertada);
  console.log(`✔ Tipos sem erros novos (${linhasDeErro(tsc.out).length} conhecidos na linha de base) · testes a passar`);
}

// Só corre quando é chamado diretamente. Sem esta guarda, importá-lo num teste
// punha o vitest a chamar o vitest — recursivamente.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
