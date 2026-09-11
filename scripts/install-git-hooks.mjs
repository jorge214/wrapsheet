// scripts/install-git-hooks.mjs
// Instala o hook de pre-commit do git. Corre uma vez por máquina:
//     node scripts/install-git-hooks.mjs
//
// Porquê além dos hooks do Claude Code: os hooks do Claude Code só disparam
// quando é o CLAUDE a editar. Uma alteração feita à mão no VS Code não passa
// por lá — o git é a última porta antes de o código ficar gravado.
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = join(ROOT, ".git", "hooks");

if (!existsSync(join(ROOT, ".git"))) {
  console.error("Isto não é um repositório git.");
  process.exit(1);
}
mkdirSync(HOOKS, { recursive: true });

const script = `#!/bin/sh
# Instalado por scripts/install-git-hooks.mjs — não editar à mão.
# Tipos + testes antes de cada commit (~7s). Para saltar numa emergência:
#   git commit --no-verify
node "$(git rev-parse --show-toplevel)/scripts/verify.mjs" || exit 1
`;

const dest = join(HOOKS, "pre-commit");
writeFileSync(dest, script, "utf8");
try {
  chmodSync(dest, 0o755);
} catch {}
console.log("✔ pre-commit instalado em .git/hooks/pre-commit");
