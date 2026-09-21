// api/pdf.js — função serverless da Vercel que gera o PDF da folha.
//
// Porquê: a web mandava o browser "imprimir" a folha, e cada browser imprime à
// sua maneira (o Safari só respeita a orientação do @page desde a 18.2, o
// Firefox mete cabeçalhos e margens próprias, a app instalada a partir do
// Firefox no Android nem abre o diálogo). Aqui a folha é renderizada SEMPRE
// pelo mesmo Chromium — o motor do Chrome, que é o que já saía bem — e o
// browser recebe um ficheiro PDF a sério.
//
// Pedido:  POST /api/pdf  { html: string, fileName?: string }
//          Authorization: Bearer <access_token do Supabase>  (só utilizadores
//          com sessão; o Chromium não fica aberto ao mundo)
// Resposta: application/pdf
//
// A folha traz o seu @page (tamanho, orientação, margens) e é isso que manda
// (preferCSSPageSize). Nada do que chega fica guardado.
//
// Local (fora da Vercel) usa o Edge/Chrome do computador — ver scripts/pdf-local.mjs.

const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://joymgpqtbkobjmznqyzi.supabase.co";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpveW1ncHF0YmtvYmptem5xeXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjc3NTYsImV4cCI6MjA5NTgwMzc1Nn0.wkClDRRUXINktGHApzuXaE_iHKRAxFfHQDeYgKvKev8";

// Chromium para Lambda/Vercel: o pacote é descarregado para /tmp no primeiro
// arranque de cada instância (≈70 MB) e reutilizado enquanto ela estiver quente.
// A versão do pack TEM de ser a mesma do @sparticuz/chromium-min do package.json.
const CHROMIUM_PACK = "https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar";

const MAX_HTML = 4_000_000; // a Vercel corta o corpo aos 4,5 MB de qualquer forma
const RENDER_TIMEOUT_MS = 25_000;

const NA_VERCEL = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// ── Fontes ────────────────────────────────────────────────────────────────────
// A folha pede -apple-system / "Segoe UI" / Roboto. No Linux da Vercel não há
// nenhuma, e o Chromium caía numa fonte qualquer com outras medidas. Roboto
// (Apache 2.0, já é a 4.ª da lista e a que o Android usa) vai embutida e
// declarada TAMBÉM como "Segoe UI", para a lista de fontes da folha a apanhar
// sem mexer no CSS. Só regular e bold: 800/900 caem na bold, como no Windows.
let fontsCss = null;
function fontFaces() {
  if (fontsCss !== null) return fontsCss;
  const dir = path.join(__dirname, "fonts");
  const faces = [["Roboto-Regular.ttf", 400], ["Roboto-Bold.ttf", 700]];
  const css = [];
  for (const [file, weight] of faces) {
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) continue;
    const b64 = fs.readFileSync(p).toString("base64");
    for (const family of ["Segoe UI", "Roboto"]) {
      css.push(`@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;src:url(data:font/ttf;base64,${b64}) format("truetype")}`);
    }
  }
  fontsCss = css.length ? `<style id="wsFonts">${css.join("")}</style>` : "";
  return fontsCss;
}

function withFonts(html) {
  const f = fontFaces();
  if (!f) return html;
  const i = html.indexOf("<head>");
  return i >= 0 ? html.slice(0, i + 6) + f + html.slice(i + 6) : f + html;
}

// ── Browser (um por instância, reutilizado entre pedidos) ────────────────────
let browserPromise = null;
async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.connected) return b;
    browserPromise = null;
  }
  browserPromise = (async () => {
    // import() e não require(): na Vercel o puppeteer-core só carrega como
    // módulo ES ("require() of ES Module … not supported").
    const puppeteer = (await import("puppeteer-core")).default;
    if (NA_VERCEL) {
      const chromium = (await import("@sparticuz/chromium-min")).default;
      // O binário do pacote é o chrome-headless-shell: tem de arrancar em modo
      // "shell" (o "headless: true" novo do puppeteer manda flags que ele não tem).
      return puppeteer.launch({
        args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
        executablePath: await chromium.executablePath(CHROMIUM_PACK),
        headless: "shell",
      });
    }
    const local = [
      process.env.PDF_BROWSER,
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "/usr/bin/chromium",
      "/usr/bin/google-chrome",
    ].find((p) => p && fs.existsSync(p));
    if (!local) throw new Error("Sem Chrome/Edge local (define PDF_BROWSER)");
    return puppeteer.launch({ executablePath: local, headless: true, args: ["--disable-gpu"] });
  })();
  return browserPromise;
}

// ── Sessão Supabase ──────────────────────────────────────────────────────────
async function sessaoValida(authorization) {
  if (process.env.PDF_SKIP_AUTH === "1" && !NA_VERCEL) return true; // só para testes locais
  if (!authorization || !authorization.startsWith("Bearer ")) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
    });
    return r.ok;
  } catch {
    return false;
  }
}

function nomeSeguro(name) {
  const base = String(name || "Folha")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 80) || "Folha";
  return base.toLowerCase().endsWith(".pdf") ? base : base + ".pdf";
}

// ── Render ───────────────────────────────────────────────────────────────────
async function renderPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // A folha é auto-contida (imagens em data:). Nada de pedidos à rede a
    // partir do Chromium do servidor — nem por engano, nem por malícia.
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      const u = r.url();
      if (u.startsWith("data:") || u.startsWith("about:")) r.continue();
      else r.abort();
    });
    await page.setContent(withFonts(html), { waitUntil: "load", timeout: RENDER_TIMEOUT_MS });
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({
      preferCSSPageSize: true, // o @page da folha manda (A3 horizontal / A4 vertical)
      format: "A4",            // só se a folha não trouxer @page
      printBackground: true,
      displayHeaderFooter: false,
      timeout: RENDER_TIMEOUT_MS,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method" });
    return;
  }
  if (!(await sessaoValida(req.headers.authorization))) {
    res.status(401).json({ error: "auth" });
    return;
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const html = typeof body.html === "string" ? body.html : "";
  if (!html || html.length > MAX_HTML) {
    res.status(400).json({ error: html ? "too_large" : "html" });
    return;
  }
  try {
    const pdf = await renderPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeSeguro(body.fileName)}"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pdf);
  } catch (e) {
    console.error("[api/pdf]", e);
    browserPromise = null; // próxima chamada arranca um browser novo
    // A mensagem (sem stack) vai na resposta: os logs da Vercel não se leem
    // pela API e sem isto um 500 é mudo.
    res.status(500).json({ error: "render", detail: String((e && e.message) || e).slice(0, 300) });
  }
};

module.exports.renderPdf = renderPdf; // para o teste local
