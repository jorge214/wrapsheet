// scripts/android-icons.mjs — gera os ícones adaptativos de Android a partir
// do ícone da app (assets/images/icon.png, claquete preta em fundo branco):
//
//   android-icon-foreground.png  claquete a 60% do quadro, fundo transparente
//                                (zona segura das máscaras redondas = 66%)
//   android-icon-monochrome.png  silhueta branca com alfa (ícones temáticos do
//                                Android 13+)
//
// Usa o Edge em headless (canvas + dump do DOM); não precisa de dependências.
//   node scripts/android-icons.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const src = path.join(root, "assets/images/icon.png");
const outFg = path.join(root, "assets/images/android-icon-foreground.png");
const outMono = path.join(root, "assets/images/android-icon-monochrome.png");

const dataUri = "data:image/png;base64," + fs.readFileSync(src).toString("base64");
const SIZE = 1024, SCALE = 0.6;

const html = `<!doctype html><html><body>
<img id="src" src="${dataUri}">
<pre id="fg"></pre><pre id="mono"></pre>
<script>
const img = document.getElementById("src");
img.onload = () => {
  const S = ${SIZE}, k = ${SCALE}, w = Math.round(S * k), off = Math.round((S - w) / 2);
  // 1) claquete escalada, branco → transparente
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d");
  g.drawImage(img, off, off, w, w);
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i] > 235 && p[i + 1] > 235 && p[i + 2] > 235) p[i + 3] = 0;
  }
  g.putImageData(d, 0, 0);
  document.getElementById("fg").textContent = c.toDataURL("image/png");
  // 2) silhueta branca (alfa = o que não era branco)
  const m = document.createElement("canvas"); m.width = S; m.height = S;
  const gm = m.getContext("2d");
  const dm = gm.createImageData(S, S), q = dm.data;
  for (let i = 0; i < p.length; i += 4) { q[i] = 255; q[i + 1] = 255; q[i + 2] = 255; q[i + 3] = p[i + 3]; }
  gm.putImageData(dm, 0, 0);
  document.getElementById("mono").textContent = m.toDataURL("image/png");
};
</script></body></html>`;

const tmp = path.join(os.tmpdir(), "wrapsheet-android-icons.html");
fs.writeFileSync(tmp, html);
const dom = execFileSync(EDGE, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--virtual-time-budget=5000",
  "--dump-dom", "file:///" + tmp.replace(/\\/g, "/"),
], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");

const grab = (id) => {
  const m = dom.match(new RegExp(`<pre id="${id}">(data:image/png;base64,[^<]+)</pre>`));
  if (!m) throw new Error("sem resultado para " + id);
  return Buffer.from(m[1].slice("data:image/png;base64,".length), "base64");
};
fs.writeFileSync(outFg, grab("fg"));
fs.writeFileSync(outMono, grab("mono"));
fs.unlinkSync(tmp);
console.log("ok", path.relative(root, outFg), path.relative(root, outMono));
