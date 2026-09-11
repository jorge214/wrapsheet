// scripts/install-git-hooks.mjs
// Instala o hook de pre-commit do git. Corre sozinho a cada `npm install`
// (script "prepare" do package.json), por isso uma máquina nova fica protegida
// desde o primeiro dia — não é preciso lembrar-se de nada.
//
// Porquê além dos hooks do Claude Code: esses só disparam quando é o CLAUDE a
// editar. Uma alteração feita à mão no VS Code não passa por lá — o git é a
// última porta antes de o código ficar gravado.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GIT = join(ROOT, ".git");

// Sem repositório (instalação a partir de um tarball, CI…) não há nada a
// instalar — e sair com erro faria o `npm install` falhar por nada.
if (!existsSync(GIT)) {
  console.log("(sem repositório git — pre-commit não instalado)");
  process.exit(0);
}

const script = `#!/bin/sh
# Instalado por scripts/install-git-hooks.mjs — não editar à mão.
# Tipos + testes antes de cada commit (~7s). Para saltar numa emergência:
#   git commit --no-verify
node "$(git rev-parse --show-toplevel)/scripts/verify.mjs" || exit 1
`;

const dir = join(GIT, "hooks");
const dest = join(dir, "pre-commit");

// Já lá está e igual? Não escrever — assim o `npm install` fica silencioso.
if (existsSync(dest) && readFileSync(dest, "utf8") === script) process.exit(0);

mkdirSync(dir, { recursive: true });
writeFileSync(dest, script, "utf8");
try {
  chmodSync(dest, 0o755);
} catch {}
console.log("✔ pre-commit instalado em .git/hooks/pre-commit");
