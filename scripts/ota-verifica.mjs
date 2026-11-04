// Pede o manifesto de produção (runtime 1.1.0) ao servidor de updates e
// inspeciona o bundle que os aparelhos vão receber — iOS por omissão, ou Android.
// Uso: node scripts/ota-verifica.mjs [id-do-update que o `eas update` imprimiu] [ios|android]
//   (sem plataforma é o iOS, como sempre; a ordem dos dois argumentos é livre)
// Corre-se DEPOIS de cada `eas update --channel production` (ver CLAUDE.md), uma
// vez por plataforma publicada, cada uma com o id que o `eas update` lhe deu.
//
// Os bundles (iOS e Android) são BYTECODE HERMES, não JavaScript em texto:
// descarregam-se em bytes (nunca .text(), que estraga tudo o que não é UTF-8
// válido). Strings só-ASCII estão em bytes simples; com acentos/€, em UTF-16LE.
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_MANIFESTO = "https://u.expo.dev/6add5ccd-c99b-4660-a1eb-84246ef113c0";
const PLATAFORMAS = ["ios", "android"];
const args = process.argv.slice(2);
const plataforma = args.map((a) => a.toLowerCase()).find((a) => PLATAFORMAS.includes(a)) ?? "ios";
const esperado = args.find((a) => !PLATAFORMAS.includes(a.toLowerCase()));

const r = await fetch(URL_MANIFESTO, {
  headers: {
    "expo-platform": plataforma,
    "expo-runtime-version": "1.1.0",
    "expo-channel-name": "production",
    "expo-protocol-version": "1",
    accept: "multipart/mixed",
  },
});
const ct = r.headers.get("content-type") || "";
const corpo = await r.text();
const b = ct.match(/boundary="?([^";]+)"?/);
if (!b) {
  console.log("resposta sem multipart:", r.status, ct, corpo.slice(0, 300));
  process.exit(1);
}
const partes = {};
for (const p of corpo.split("--" + b[1])) {
  const i = p.indexOf("\r\n\r\n");
  if (i < 0) continue;
  const nome = p.slice(0, i).match(/name="([^"]+)"/);
  if (nome) partes[nome[1]] = p.slice(i + 4).trim();
}
const manifesto = JSON.parse(partes.manifest);
const ext = partes.extensions ? JSON.parse(partes.extensions) : {};
const cliente = manifesto.extra?.expoClient || {};
console.log("update servido:", manifesto.id, "| plataforma:", plataforma);
console.log("criado:", manifesto.createdAt, "| runtime:", manifesto.runtimeVersion, "| app.json version:", cliente.version);
if (esperado) console.log(manifesto.id === esperado ? "✔ é o update acabado de publicar" : "✘ NÃO é o update esperado (" + esperado + ")");

const la = manifesto.launchAsset;
const cab = ext.assetRequestHeaders?.[la.key] || Object.values(ext.assetRequestHeaders || {})[0] || {};
const bytes = Buffer.from(await (await fetch(la.url, { headers: cab })).arrayBuffer());
const guardado = join(tmpdir(), `wrapsheet-ota-${plataforma}.bundle`);
writeFileSync(guardado, bytes);
// Magia do Hermes: 0x1F1903C103BCF1C6 em little-endian.
const hermes = bytes.subarray(0, 8).toString("hex") === "c61fbc03c103191f";
console.log("bundle:", Math.round(bytes.length / 1024), "KB (guardado em " + guardado + ") |", hermes ? "bytecode Hermes" : "NÃO é Hermes (cabeçalho " + bytes.subarray(0, 8).toString("hex") + ")");

const ascii = (s) => bytes.includes(Buffer.from(s, "latin1"));
const u16 = (s) => bytes.includes(Buffer.from(s, "utf16le"));
const checks = [
  ["Supabase de PRODUÇÃO (joymgpqtbkobjmznqyzi)", ascii("joymgpqtbkobjmznqyzi")],
  ["sem Supabase de DEV (gfagdphminpevuoikhoh)", !ascii("gfagdphminpevuoikhoh")],
  // A chave da loja DESTA plataforma (a outra pode nem estar: o Metro corta o
  // ramo da outra plataforma). Sem ela as compras ficam desligadas sem erro
  // nenhum (no Android, o paywall volta a "ainda não disponível").
  plataforma === "android"
    ? ["chave RevenueCat goog_ presente", /goog_[A-Za-z0-9]{10,}/.test(bytes.toString("latin1"))]
    : ["chave RevenueCat appl_ presente", /appl_[A-Za-z0-9]{10,}/.test(bytes.toString("latin1"))],
  ["código novo — pt: \"usam os valores por hora aqui inseridos\"", u16("usam os valores por hora aqui inseridos")],
  ["código novo — en: \"use the per-hour values entered here\"", ascii("use the per-hour values entered here")],
  ["código novo — es: \"introducidos aquí, como en publicidad\"", u16("introducidos aquí, como en publicidad")],
  // Os textos antigos são os do commit anterior (git show HEAD~1:src/i18n/xx.json);
  // só a parte ASCII no pt, que a UTF-16 de "número" não se procura assim.
  ["código ANTIGO ausente — pt: \"multiplica-se o valor da hora normal pelo n\"", !u16("multiplica-se o valor da hora normal pelo n")],
  ["código ANTIGO ausente — en: \"multiply the normal hourly rate by the decimal number\"", !ascii("multiply the normal hourly rate by the decimal number")],
];
let falhas = 0;
for (const [nome, ok] of checks) {
  console.log((ok ? "✔ " : "✘ ") + nome);
  if (!ok) falhas++;
}
console.log(falhas ? `${falhas} verificação(ões) FALHADA(S)` : "Bundle de produção OK.");
process.exit(falhas ? 1 : 0);
