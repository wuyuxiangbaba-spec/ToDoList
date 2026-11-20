import fs from "node:fs";

const [,, url, setupPath, shotPath, measurePath] = process.argv;
const PORT = process.env.CDP_PORT || "9411";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("ws error")); });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.method + " " + JSON.stringify(msg.error)));
      else res(msg.result);
    } else if (msg.method) events.push(msg);
  };
  return { ws, events, send(method, params = {}) {
    return new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { res, rej });
      ws.send(JSON.stringify({ id: mid, method, params }));
      setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error("timeout: " + method)); } }, 45000);
    });
  }};
}

async function getPage() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  let page = list.find(t => t.type === "page");
  if (!page) page = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  return page;
}

const page = await getPage();
const c = await connect(page.webSocketDebuggerUrl);
await c.send("Runtime.enable");
await c.send("Log.enable");
await c.send("Page.enable");
await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const evaluate = async (expr, awaitPromise = true) => {
  const r = await c.send("Runtime.evaluate", { expression: expr, awaitPromise, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result && r.result.value;
};

await c.send("Page.navigate", { url });
for (let i = 0; i < 100; i++) {
  await sleep(100);
  if (await evaluate("document.readyState") === "complete") break;
}
await sleep(700);

if (setupPath) {
  const setup = fs.readFileSync(setupPath, "utf8");
  const v = await evaluate(setup);
  if (v && v.reload) {
    await c.send("Page.reload", { ignoreCache: true });
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      try { if (await evaluate("document.readyState") === "complete") break; } catch (e) {}
    }
    await sleep(1300);
  }
}

let measurement = null, measureError = null;
if (measurePath) {
  try { measurement = await evaluate(fs.readFileSync(measurePath, "utf8")); }
  catch (e) { measureError = String(e.message || e); }
}

if (shotPath) {
  const s = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(shotPath, Buffer.from(s.data, "base64"));
}

const logs = [];
for (const e of c.events) {
  if (e.method === "Runtime.consoleAPICalled") logs.push({ kind: "console." + e.params.type, text: e.params.args.map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(" ") });
  else if (e.method === "Runtime.exceptionThrown") { const d = e.params.exceptionDetails; logs.push({ kind: "exception", text: (d.exception && d.exception.description) || d.text }); }
  else if (e.method === "Log.entryAdded") { const en = e.params.entry; logs.push({ kind: "log." + en.level, text: en.text + (en.url ? " @ " + en.url : "") }); }
}
console.log(JSON.stringify({ url, measurement, measureError, logs: logs.filter(l => !/favicon/.test(l.text)) }, null, 2));
c.ws.close();
process.exit(0);
