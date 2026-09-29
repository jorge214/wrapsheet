// Captura de ecrã com EMULAÇÃO de dispositivo (iPhone/iPad) via protocolo
// DevTools do Edge — o --window-size do headless não desce abaixo de ~480 px.
//   node shot.js <url> <out.png> <largura> <altura> [mobile=1] [escala=2] [fullpage=0]
const { spawn } = require("child_process");
const fs = require("fs");

const [url, out, wS, hS, mobileS = "1", scaleS = "2", fullS = "0"] = process.argv.slice(2);
const width = +wS, height = +hS, mobile = mobileS === "1", scale = +scaleS, full = fullS === "1";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9333;
const UA = mobile
  ? (width >= 700
      ? "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
  : "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const tmpProfile = process.env.TEMP + "/edge-shot-profile";
  const edge = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + tmpProfile,
    "--window-size=1200,900", "about:blank",
  ], { stdio: "ignore" });
  try {
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) {
      await sleep(250);
      try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch {}
    }
    if (!targets) throw new Error("Edge não respondeu na porta " + PORT);
    const page = targets.find((t) => t.type === "page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = new Map(); let loaded = false;
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      if (m.method === "Page.loadEventFired") loaded = true;
    };
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile, screenWidth: width, screenHeight: height });
    if (UA) await send("Emulation.setUserAgentOverride", { userAgent: UA });
    if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
    await send("Page.navigate", { url });
    for (let i = 0; i < 80 && !loaded; i++) await sleep(100);
    await sleep(1500); // React a montar, fontes, sync da folha

    let clip;
    if (full) {
      const lm = await send("Page.getLayoutMetrics");
      const cs = lm.result.cssContentSize || lm.result.contentSize;
      clip = { x: 0, y: 0, width, height: Math.min(cs.height, 6000), scale: 1 };
      await send("Emulation.setDeviceMetricsOverride", { width, height: Math.ceil(clip.height), deviceScaleFactor: scale, mobile, screenWidth: width, screenHeight: Math.ceil(clip.height) });
      await sleep(300);
    }
    const shot = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip, captureBeyondViewport: true } : {}) });
    fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
    console.log("ok " + out + " (" + width + "x" + (clip ? Math.round(clip.height) : height) + (mobile ? ", mobile" : "") + ")");
    ws.close();
  } finally {
    edge.kill();
  }
}
main().catch((e) => { console.error("falhou: " + e.message); process.exit(1); });
