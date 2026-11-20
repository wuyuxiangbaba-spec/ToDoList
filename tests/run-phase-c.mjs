#!/usr/bin/env node
/**
 * run-c.mjs — PHASE-C 四项改造的可复跑验收矩阵（tests 工装）
 *
 * 用法：
 *   node run-c.mjs --file <html路径> --out <结果目录>
 *   可选：--http-port 8807 --cdp-port 9437 --edge <msedge路径> --python python
 *
 * 对任意候选版本（head.html / impl.html / ...）零改动重跑：
 * 工装只通过「真实用户路径」驱动页面（点击打卡按钮、右键菜单、侧栏切换/
 * 双击改名、HTML5 拖拽事件、滚轮缩放、搜索输入、Ctrl+Z 键盘事件、
 * createCatalog()），断言全部基于 DOM / localStorage / SVG 数值
 * （CDP Runtime.evaluate），不依赖页面内部闭包变量。
 *
 * 用例矩阵 C1–C7 详见 report.md；输出：
 *   <out>/report.md     人类可读报告（含 预期/实际/PASS-FAIL 表格）
 *   <out>/results.json  机读结果（含每断言 expected/actual/pass 与基线预期）
 *   <out>/shots/*.png   每用例截图
 *
 * 自起自清：静态服务（python http.server，默认 8807）与无头 Edge（CDP 默认
 * 9437）均为本进程子进程，结束时只按 PID 杀（taskkill /PID <pid> /T /F），
 * 绝不按进程名杀用户浏览器；遗留进程只按「我的端口归属 PID」与「我的
 * profile 目录归属 PID」双路清扫（均为本工装专用资源）。
 *
 * 退出码：0=全部符合基线预期；3=存在与基线预期不一致的用例；1=工装错误。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SEEDS = path.join(__dirname, "seeds");

/* ============================== CLI ============================== */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    }
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
if (!args.file || !args.out) {
  console.error("用法: node run-c.mjs --file <html路径> --out <目录>");
  process.exit(2);
}
const FILE = path.resolve(args.file);
const OUT = path.resolve(args.out);
const HTTP_PORT = parseInt(args["http-port"] || "8807", 10);
const CDP_PORT = parseInt(args["cdp-port"] || "9437", 10);
const EDGE_PATH = args.edge || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PYTHON = args.python || "python";
const VIEW = { width: 1440, height: 900 };
const BASE_URL = "http://127.0.0.1:" + HTTP_PORT;
const PAGE_URL = BASE_URL + "/" + encodeURIComponent(path.basename(FILE));
const PROFILE = path.join(__dirname, "profile-run-c");

if (typeof WebSocket !== "function") {
  console.error("需要 Node >= 22（原生 WebSocket）驱动 CDP，当前 " + process.version);
  process.exit(2);
}
if (!fs.existsSync(FILE)) { console.error("找不到目标文件: " + FILE); process.exit(2); }
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });

/* ============ 迁移目标常量（与 seeds/ 保持同一份口径） ============ */
// 旧默认树（nmw）23 节点：昆仑数模 + 上海大学两顶层 —— C1/C2 迁移目标
const NMW_EXPECTED = { count: 23, tops: ["昆仑数模", "上海大学"], rootId: "nmwiyegtzm0v4" };
// C3 期望：用户改过的 nmw 树原样保留（改名1 + done叶1 + 连线1）
const C3_EXPECTED_TUPLES = [
  ["nmwiyegtzm0v4", "昆仑数模", null, false],
  ["nmwiyekmtshvg", "上海大学", null, false],
  ["nmwiyes47mg9k", "王静(导师)", "nmwiyegtzm0v4", false],
  ["nmwiyf1ofag9i", "G5二次开发", "nmwiyes47mg9k", false],
  ["nmwiyfd4n5bi5", "宋亦诚", "nmwiyekmtshvg", false],
  ["nmwiyfjkrrj1t", "有限元作业批改", "nmwiyfd4n5bi5", false],
  ["nmwiyg84eqd74", "基于标架场的全四边形动网格", "nmwiyfd4n5bi5", false],
  ["nmwiyh6f0uvi5", "上机作业@第三周", "nmwiyfjkrrj1t", false],
  ["nmwiyhe7ow45g", "上机作业@第四周", "nmwiyfjkrrj1t", true],
  ["nmwiyhi0un6d9", "代码", "nmwiyg84eqd74", false],
  ["nmwiyhmuh3kk8", "算例", "nmwiyg84eqd74", false],
  ["nmwiyhrdyz4x1", "文章本体", "nmwiyg84eqd74", false],
  ["nmwiyhvwukpr5", "PPT汇报", "nmwiyegtzm0v4", false],
  ["nmwiyi34z6iem", "昆仑的工作", "nmwiyhvwukpr5", false],
  ["nmwiyi6ogqspx", "科研工作", "nmwiyhvwukpr5", false],
  ["nmwkexync69fx", "G5输出三角形节点", "nmwiyf1ofag9i", false],
  ["nmwkey9gw84md", "程序读取节点", "nmwiyf1ofag9i", false],
  ["nmwkeyg24u5em", "G5读取四边形节点", "nmwiyf1ofag9i", false],
  ["nmwkezurhvevm", "读取三角形节点", "nmwiyhi0un6d9", false],
  ["nmwkf046xe2ip", "布置/光滑标架场", "nmwiyhi0un6d9", false],
  ["nmwkf08uatt86", "找奇异点", "nmwiyhi0un6d9", false],
  ["nmwkf0d77uxqr", "分块", "nmwiyhi0un6d9", false],
  ["nmwkf0i9b3ft6", "生成四边形网格", "nmwiyhi0un6d9", false]
].map(t => ({ id: t[0], name: t[1], parentId: t[2], done: t[3] }));
const C3_EXPECTED_LINKS = [["nmwiyhe7ow45g", "nmwkf0i9b3ft6"]];
const NEURCROSS_COUNT = 494; // 代码架构预置树节点数（HEAD 实测）

/* ====================== 进程管理（只按 PID 杀） ====================== */
const spawned = [];
function pidKill(pid) {
  return new Promise(resolve => {
    if (!pid) return resolve(false);
    const tk = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    tk.on("close", () => resolve(true));
    tk.on("error", () => { try { process.kill(pid); } catch (e) {} resolve(true); });
  });
}
function portOwnerPids(port) {
  return new Promise(resolve => {
    let out = "";
    const ns = spawn("netstat", ["-ano", "-p", "tcp"], { stdio: ["ignore", "pipe", "ignore"] });
    ns.stdout.on("data", d => { out += d.toString(); });
    ns.on("close", () => {
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const m = /^\s*TCP\s+(\S+):(\d+)\s+(\S+)\s+LISTENING\s+(\d+)\s*$/.exec(line);
        if (m && parseInt(m[2], 10) === port) pids.add(parseInt(m[4], 10));
      }
      resolve([...pids]);
    });
    ns.on("error", () => resolve([]));
  });
}
async function freePort(port) {
  for (let round = 0; round < 6; round++) {
    const pids = await portOwnerPids(port);
    if (!pids.length) return true;
    for (const pid of pids) await pidKill(pid);
    await sleep(500);
  }
  return (await portOwnerPids(port)).length === 0;
}
function edgeProfilePids(profile) {
  return new Promise(resolve => {
    const ps = spawn("powershell", ["-NoProfile", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*" + profile.replace(/'/g, "''").replace(/\\/g, "\\\\") + "*' } | ForEach-Object { Write-Output $_.ProcessId }"],
      { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    ps.stdout.on("data", d => { out += d.toString(); });
    ps.on("close", () => resolve(out.split(/\r?\n/).map(s => parseInt(s, 10)).filter(n => Number.isFinite(n))));
    ps.on("error", () => resolve([]));
  });
}
async function sweepEdgeProfile(profile) {
  for (let round = 0; round < 3; round++) {
    const pids = await edgeProfilePids(profile);
    if (!pids.length) return true;
    for (const pid of pids) await pidKill(pid);
    await sleep(700);
  }
  return (await edgeProfilePids(profile)).length === 0;
}
let cleaned = false;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  for (const p of spawned.reverse()) {
    if (p.handle) { try { p.handle.close(); } catch (e) {} }
    await pidKill(p.pid);
  }
  await freePort(CDP_PORT);
  await sweepEdgeProfile(PROFILE);
}
process.on("SIGINT", async () => { await cleanup(); process.exit(130); });

/* -------- 静态服务：python http.server（PROMPT 指定），失败回退 Node 内置 -------- */
async function startServer() {
  const dir = path.dirname(FILE);
  if (!(await freePort(HTTP_PORT))) throw new Error("端口 " + HTTP_PORT + " 被非本工装进程占用，拒绝动它");
  try {
    const py = spawn(PYTHON, ["-m", "http.server", String(HTTP_PORT), "--bind", "127.0.0.1", "--directory", dir], { stdio: "ignore" });
    spawned.push({ pid: py.pid, name: "python-http.server" });
    for (let i = 0; i < 40; i++) {
      await sleep(150);
      try {
        const res = await fetch(PAGE_URL, { signal: AbortSignal.timeout(1000) });
        if (res.ok) return { kind: "python", pid: py.pid, url: PAGE_URL };
      } catch (e) {}
      if (py.exitCode !== null) break;
    }
  } catch (e) {}
  const http = await import("node:http");
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const fp = path.normalize(path.join(dir, p));
    if (!fp.startsWith(dir) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
      res.writeHead(404); res.end("not found"); return;
    }
    res.writeHead(200, { "Content-Type": fp.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
    fs.createReadStream(fp).pipe(res);
  });
  await new Promise((res, rej) => { srv.once("error", rej); srv.listen(HTTP_PORT, "127.0.0.1", res); });
  spawned.push({ pid: null, name: "node-http-server", handle: srv });
  return { kind: "node", handle: srv, url: PAGE_URL };
}

/* -------- 无头 Edge（CDP），只按 PID 杀 -------- */
async function startEdge() {
  fs.mkdirSync(PROFILE, { recursive: true });
  await sweepEdgeProfile(PROFILE);
  await freePort(CDP_PORT);
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const edge = spawn(EDGE_PATH, [
      "--headless=new", "--disable-gpu", "--no-first-run",
      "--remote-debugging-port=" + CDP_PORT,
      "--user-data-dir=" + PROFILE,
      "about:blank"
    ], { stdio: "ignore" });
    spawned.push({ pid: edge.pid, name: "msedge" });
    for (let i = 0; i < 150; i++) {
      await sleep(200);
      try {
        const res = await fetch("http://127.0.0.1:" + CDP_PORT + "/json/version", { signal: AbortSignal.timeout(1000) });
        if (res.ok) return { pid: edge.pid };
      } catch (e) {}
    }
    lastErr = new Error("CDP 端口 " + CDP_PORT + " 未就绪（edge exitCode=" + edge.exitCode + "）");
    await sweepEdgeProfile(PROFILE);
    await freePort(CDP_PORT);
  }
  throw lastErr;
}

/* ====================== CDP 客户端（Node 22+ 原生 WebSocket） ====================== */
async function cdpConnect() {
  const list = await (await fetch("http://127.0.0.1:" + CDP_PORT + "/json/list")).json();
  let page = list.find(t => t.type === "page");
  if (!page) page = await (await fetch("http://127.0.0.1:" + CDP_PORT + "/json/new?about:blank", { method: "PUT" })).json();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("CDP WebSocket 连接失败")); });
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
  const c = {
    ws, events,
    send(method, params = {}, timeout = 30000) {
      return new Promise((res, rej) => {
        const mid = ++id;
        pending.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params }));
        setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error("CDP 超时: " + method)); } }, timeout);
      });
    }
  };
  await c.send("Runtime.enable");
  await c.send("Page.enable");
  await c.send("Log.enable");
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: PRELOAD });
  return c;
}

/* 页面脚本先于应用执行：拦截原生 confirm/alert/prompt（计数并放行），收集页内错误 */
const PRELOAD = `
window.__acceptNative = { confirm: 0, alert: 0, prompt: 0 };
window.__acceptErrors = [];
window.confirm = function () { window.__acceptNative.confirm++; return true; };
window.alert = function () { window.__acceptNative.alert++; return true; };
window.prompt = function () { window.__acceptNative.prompt++; return "run-c-harness"; };
window.addEventListener("error", function (e) { window.__acceptErrors.push(String(e.message || e)); });
window.addEventListener("unhandledrejection", function (e) {
  window.__acceptErrors.push("unhandledrejection: " + String((e.reason && e.reason.message) || e.reason));
});
`;

/* ====================== 页面驱动助手 ====================== */
let cdp = null;
async function evalExpr(expression, timeout = 20000) {
  const r = await cdp.send("Runtime.evaluate", {
    expression, awaitPromise: true, returnByValue: true, userGesture: true
  }, timeout);
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error((d.exception && d.exception.description) || d.text);
  }
  return r.result ? r.result.value : undefined;
}
async function navigate(url) {
  await cdp.send("Page.navigate", { url });
  for (let i = 0; i < 150; i++) {
    await sleep(100);
    try { if (await evalExpr("document.readyState", 5000) === "complete") break; } catch (e) {}
  }
  await sleep(300);
}
const waitForFrames = (n = 3) => evalExpr(
  "new Promise(function (resolve) { var i = 0; var f = function () { if (++i >= " + n + ") resolve(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })"
);
async function reloadPage() {
  await cdp.send("Page.reload", { ignoreCache: true });
  for (let i = 0; i < 150; i++) {
    await sleep(100);
    try { if (await evalExpr("document.readyState", 5000) === "complete") break; } catch (e) {}
  }
  await waitForFrames(3);
  await sleep(400);
}
async function screenshot(name) {
  const rel = "shots/" + name + ".png";
  const s = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, rel), Buffer.from(s.data, "base64"));
  return rel;
}
async function seedAndReload(seedName) {
  const src = fs.readFileSync(path.join(SEEDS, seedName), "utf8");
  const info = await evalExpr(src);
  await reloadPage();
  return info;
}
async function wheel(dir, count) {
  const x = Math.floor(VIEW.width / 2), y = Math.floor(VIEW.height / 2);
  for (let i = 0; i < count; i++) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseWheel", x, y, deltaX: 0, deltaY: dir === "in" ? -120 : 120
    });
    await sleep(30);
  }
}
async function clickToggle(ref) {
  return evalExpr("(() => {" +
    "const el = document.querySelector('.mm-node[data-ref=\"" + ref + '\"] .node-btn[data-toggle]' + "');" +
    "if (!el) return { ok: false };" +
    "el.click(); return { ok: true };" +
    "})()");
}

/* ====================== 页内测量脚本（字符串注入） ====================== */
/* 虚线端点 vs 卡片接驳边（复用仓库 tests/measure-toggle.js 的口径） */
const M_LINKS = `(() => {
  const svg = document.getElementById("mindSvg");
  if (!svg) return { error: "no-svg" };
  const linkEls = Array.from(svg.querySelectorAll(".mindmap-link"));
  const hitEls = Array.from(svg.querySelectorAll(".mindmap-link-hit"));
  const rects = new Map();
  for (const el of document.querySelectorAll(".mm-node[data-ntype='node'][data-ref]")) {
    const btn = el.querySelector(".node-btn");
    if (!btn) continue;
    rects.set(el.dataset.ref, {
      x: el.offsetLeft, y: el.offsetTop - btn.offsetHeight / 2,
      w: btn.offsetWidth, h: btn.offsetHeight
    });
  }
  const ctr = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const sideToward = (r, o) => {
    const c = ctr(r), d = ctr(o);
    const dx = d.x - c.x, dy = d.y - c.y;
    return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
  };
  const sidePoint = (r, s) => s === "left" ? { x: r.x, y: r.y + r.h / 2 }
    : s === "top" ? { x: r.x + r.w / 2, y: r.y }
    : s === "bottom" ? { x: r.x + r.w / 2, y: r.y + r.h }
    : { x: r.x + r.w, y: r.y + r.h / 2 };
  const per = [];
  for (let i = 0; i < linkEls.length; i++) {
    const p = linkEls[i], hit = hitEls[i];
    if (!hit) { per.push({ err: "no-hit-pair" }); continue; }
    const d = p.getAttribute("d") || "";
    const nums = (d.match(/-?\\d+(?:\\.\\d+)?/g) || []).map(Number);
    if (nums.length < 4) { per.push({ err: "bad-d" }); continue; }
    const start = { x: nums[0], y: nums[1] };
    const end = { x: nums[nums.length - 2], y: nums[nums.length - 1] };
    const ra = rects.get(hit.dataset.linkA), rb = rects.get(hit.dataset.linkB);
    if (!ra || !rb) { per.push({ a: hit.dataset.linkA, b: hit.dataset.linkB, err: "missing-card" }); continue; }
    const pa = sidePoint(ra, sideToward(ra, rb));
    const pb = sidePoint(rb, sideToward(rb, ra));
    const d0 = Math.hypot(start.x - pa.x, start.y - pa.y);
    const d1 = Math.hypot(end.x - pb.x, end.y - pb.y);
    per.push({ a: hit.dataset.linkA, b: hit.dataset.linkB, d0: +d0.toFixed(2), d1: +d1.toFixed(2) });
  }
  const maxDist = per.reduce((m, x) => Math.max(m, x.d0 || 0, x.d1 || 0), 0);
  return { drawn: linkEls.length, hits: hitEls.length, per, maxDist: +maxDist.toFixed(2) };
})()`;

/* 根节点几何/名称/同名层数（C6 专用；选择器用 [data-ntype="root"]，不用 data-ref） */
const M_ROOT = `(() => {
  const root = document.querySelector('.mm-node[data-ntype="root"]');
  if (!root) return { exists: false };
  const nameEl = root.querySelector(".node-name");
  const r = root.getBoundingClientRect();
  const nameCounts = {};
  let minLeft = Infinity;
  for (const el of document.querySelectorAll(".mm-node")) {
    const nm = el.querySelector(".node-name");
    const t = nm ? nm.textContent.trim() : "";
    if (t) nameCounts[t] = (nameCounts[t] || 0) + 1;
    const rr = el.getBoundingClientRect();
    if (rr.left < minLeft) minLeft = rr.left;
  }
  return {
    exists: true,
    name: nameEl ? nameEl.textContent.trim() : "",
    left: +r.left.toFixed(1), top: +r.top.toFixed(1),
    width: +r.width.toFixed(1), height: +r.height.toFixed(1),
    vw: innerWidth, vh: innerHeight,
    inViewport: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
    isLeftmost: r.left <= minLeft + 0.5,
    nameCounts: nameCounts,
    depth1: Array.from(document.querySelectorAll('.mm-node[data-ntype="node"][data-depth="1"]'))
      .map(el => { const n = el.querySelector(".node-name"); return n ? n.textContent.trim() : ""; }).filter(Boolean),
    nodeTotal: document.querySelectorAll(".mm-node").length
  };
})()`;

/* localStorage 状态摘要（按目录 id 取，catId 由调用方拼接） */
function mState(catId) {
  return `(() => {
    let st = null;
    try { st = JSON.parse(localStorage.getItem("signin-tracker-v1") || "null"); } catch (e) {}
    if (!st) return { has: false };
    const c = (st.catalogs || []).find(x => x.id === "${catId}") || null;
    const cat = c ? {
      id: c.id, name: c.name,
      count: (c.nodes || []).length,
      dflt: (c.nodes || []).filter(n => String(n.id).indexOf("dflt-") === 0).length,
      nmw: (c.nodes || []).filter(n => String(n.id).indexOf("nmw") === 0).length,
      tops: (c.nodes || []).filter(n => !n.parentId).map(n => n.name),
      hasKunlun: (c.nodes || []).some(n => n.name === "昆仑数模"),
      hasSHU: (c.nodes || []).some(n => n.name === "上海大学"),
      tuples: (c.nodes || []).map(n => [n.id, n.name, n.parentId || null, n.done === true]),
      links: (c.links || []).map(l => [l.a, l.b]).sort(),
      dailyChecks: c.dailyChecks || null
    } : null;
    return {
      has: true,
      currentCatalogId: st.currentCatalogId || null,
      catalogIds: (st.catalogs || []).map(x => x.id + ":" + x.name),
      calendarOpen: st.calendarOpen === true,
      theme: (function () { try { return localStorage.getItem("signin-tracker-theme"); } catch (e) { return null; } })(),
      cat: cat
    };
  })()`;
}

/* 节点字段子集（按目录 id + 节点 id） */
function mNode(catId, nodeId) {
  return `(() => {
    let st = null;
    try { st = JSON.parse(localStorage.getItem("signin-tracker-v1") || "null"); } catch (e) {}
    if (!st) return { has: false };
    const c = (st.catalogs || []).find(x => x.id === "${catId}");
    const n = c && (c.nodes || []).find(x => x.id === "${nodeId}");
    return { has: !!n, node: n ? { id: n.id, name: n.name, parentId: n.parentId || null, done: n.done === true, kind: n.kind || null, collapsed: n.collapsed === true } : null,
      dailyChecksDates: c && c.dailyChecks ? Object.keys(c.dailyChecks) : null };
  })()`;
}

const M_ENV = `(() => {
  return {
    readyState: document.readyState,
    theme: document.documentElement.getAttribute("data-theme"),
    nodeCount: document.querySelectorAll(".mm-node").length,
    bodyTextLen: (document.body.innerText || "").trim().length,
    pageErrors: (window.__acceptErrors || []).slice(0, 10)
  };
})()`;

/* DOM 特征扫描（C4/C5 删除项与保留项） */
const M_DOM = `(() => {
  const q = s => document.querySelectorAll(s);
  return {
    foldBtns: q(".node-fold").length,
    foldBadges: q(".node-fold-badge").length,
    expandAllBtn: !!document.getElementById("expandAllBtn"),
    zoomInBtn: !!document.getElementById("zoomInBtn"),
    zoomOutBtn: !!document.getElementById("zoomOutBtn"),
    fitViewBtn: !!document.getElementById("fitViewBtn"),
    toolbar: !!document.getElementById("canvasToolbar"),
    dailyAside: !!document.getElementById("dailyAside"),
    dailyRail: !!document.getElementById("dailyRail"),
    calGrid: !!document.getElementById("calGrid"),
    dailyBadgeCount: q(".daily-badge").length,
    dfltDomNodes: Array.from(document.querySelectorAll(".mm-node[data-ref]"))
      .filter(el => String(el.dataset.ref).indexOf("dflt-") === 0).length,
    names: Array.from(document.querySelectorAll(".mm-node .node-name")).map(e => e.textContent.trim())
  };
})()`;

/* 节点可见性（C4：collapsed:true 存量节点的子节点是否仍渲染可见） */
function mChildrenVisible(ids) {
  return `(() => {
    const out = {};
    const ids = ${JSON.stringify(ids)};
    for (const id of ids) {
      const el = document.querySelector('.mm-node[data-ref="' + id + '"]');
      if (!el) { out[id] = { present: false, visible: false }; continue; }
      const disp = getComputedStyle(el).display;
      const r = el.getBoundingClientRect();
      out[id] = { present: true, visible: disp !== "none" && r.width > 0 && r.height > 0, display: disp, w: +r.width.toFixed(1) };
    }
    return out;
  })()`;
}

/* 右键菜单：在指定节点（ref="" 为根）上打开并回读可见项（随后关闭） */
function mCtxMenuOn(ref) {
  const sel = ref === "" ? '.mm-node[data-ntype="root"]' : '.mm-node[data-ref="' + ref + '"]';
  return `(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return { ok: false, step: "find-node" };
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 2 }));
    const m = document.getElementById("ctxMenu");
    if (!m || m.hidden) return { ok: false, step: "menu-open" };
    const items = Array.from(m.querySelectorAll("button"))
      .map(b => ({ act: b.dataset.act || "", text: b.textContent.trim(), hidden: b.hidden, disabled: b.disabled }));
    m.hidden = true;
    return { ok: true, isRoot: el.dataset.ntype === "root", items: items };
  })()`;
}

/* C6b：调用页面全局 createCatalog()（真实用户路径），Esc 关掉自动弹出的改名框 */
const A_CREATE_CATALOG = `(async () => {
  if (typeof createCatalog !== "function") return { ok: false, step: "no-global" };
  createCatalog();
  await new Promise(r => setTimeout(r, 300));
  const input = document.querySelector("#catalogList .catalog-rename-input");
  if (input) input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 200));
  return { ok: true };
})()`;

/* C6d：侧栏双击改名（真实用户路径：dblclick → 输入 → Enter） */
const A_RENAME_CATALOG = `(async () => {
  const li = document.querySelector('#catalogList [data-cat-id="cat_c6_dflt"]');
  const nameEl = li && li.querySelector(".catalog-item-name");
  if (!nameEl) return { ok: false, step: "find-item" };
  nameEl.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 200));
  const input = document.querySelector("#catalogList .catalog-rename-input");
  if (!input) return { ok: false, step: "rename-input" };
  input.value = "我的目录X";
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 400));
  const li2 = document.querySelector('#catalogList [data-cat-id="cat_c6_dflt"]');
  const name2 = li2 && li2.querySelector(".catalog-item-name");
  return { ok: true, sidebarName: name2 ? name2.textContent.trim() : "" };
})()`;

/* C6e：根节点右键「+ 分支」提交内联编辑新增一级分支 */
const A_ROOT_ADD_CHILD = `(async () => {
  const root = document.querySelector('.mm-node[data-ntype="root"]');
  if (!root) return { ok: false, step: "find-root" };
  const r = root.getBoundingClientRect();
  root.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true,
    clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 2 }));
  const m = document.getElementById("ctxMenu");
  if (!m || m.hidden) return { ok: false, step: "menu-open" };
  const add = m.querySelector('button[data-act="add"]');
  if (!add || add.hidden) return { ok: false, step: "find-add" };
  add.click();
  await new Promise(r2 => setTimeout(r2, 300));
  const input = document.querySelector("#catTree input");
  if (!input) return { ok: false, step: "inline-editor" };
  input.value = "根上新增分支";
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await new Promise(r2 => setTimeout(r2, 400));
  return { ok: true };
})()`;

/* C6e：把 王静(nmwiyes47mg9k) 拖到根节点（HTML5 DnD 事件序列，dataTransfer 真实传递） */
const A_DRAG_TO_ROOT = `(async () => {
  const src = document.querySelector('.mm-node[data-ref="nmwiyes47mg9k"]');
  const root = document.querySelector('.mm-node[data-ntype="root"]');
  if (!src || !root) return { ok: false, step: "find" };
  const dt = new DataTransfer();
  src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
  root.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
  root.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  src.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
  await new Promise(r => setTimeout(r, 500));
  return { ok: true };
})()`;

/* 侧栏切换目录（真实用户路径：点击目录项） */
const aSwitchCatalog = (catId) => `(async () => {
  const li = document.querySelector('#catalogList [data-cat-id="${catId}"]');
  if (!li) return { ok: false };
  li.querySelector(".catalog-item-name").click();
  await new Promise(r => setTimeout(r, 700));
  return { ok: true };
})()`;

/* 搜索输入（真实用户路径：input 事件） */
const aSearch = (kw) => `(async () => {
  const input = document.getElementById("searchInput");
  if (!input) return { ok: false };
  input.focus();
  input.value = ${JSON.stringify(kw)};
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  const count = document.getElementById("searchCount");
  return {
    ok: true,
    hits: document.querySelectorAll(".mm-node.search-hit").length,
    rootHit: !!document.querySelector('.mm-node[data-ntype="root"].search-hit'),
    countText: count && !count.hidden ? count.textContent.trim() : ""
  };
})()`;

/* Ctrl+Z 撤销（document 级 keydown，页面快捷键处理器同路径） */
const A_UNDO = `(async () => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", code: "KeyZ", ctrlKey: true, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 500));
  return { ok: true };
})()`;

/* 主题切换（真实用户路径：点击按钮） */
const A_THEME_TOGGLE = `(async () => {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return { ok: false };
  btn.click();
  await new Promise(r => setTimeout(r, 400));
  return { ok: true, theme: document.documentElement.getAttribute("data-theme") };
})()`;

/* fitView 后全体节点是否都在视口内 + 当前缩放 */
const M_FIT = `(() => {
  const bad = [];
  for (const el of document.querySelectorAll(".mm-node")) {
    if (getComputedStyle(el).display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) {
      if (bad.length < 5) bad.push({ ref: el.dataset.ref || "root", l: +r.left.toFixed(0), t: +r.top.toFixed(0), r: +r.right.toFixed(0), b: +r.bottom.toFixed(0) });
    }
  }
  const t = getComputedStyle(document.getElementById("catTree")).transform;
  const m = /matrix\\(([-\\d.e]+),/.exec(t || "");
  return { scale: t === "none" ? 1 : (m ? parseFloat(m[1]) : null), outOfView: bad, vw: innerWidth, vh: innerHeight };
})()`;

/* ====================== 结果框架 ====================== */
/* 基线预期：C1/C2/C4/C5/C6 在未改造的 head.html 上应 FAIL（Phase-C 改造目标），
 * C3/C7 是回归护栏：任何时候都必须 PASS（任何版本上 FAIL 都算回归）。 */
const EXPECT_BASELINE = { C1: "FAIL", C2: "FAIL", C3: "PASS", C4: "FAIL", C5: "FAIL", C6: "FAIL", C7: "PASS" };
const GUARDS = ["C3", "C7"]; // 不得回归
const CASE_TITLES = {
  C1: "无缓存首开：默认目录=23 nmw 节点（昆仑数模+上海大学）",
  C2: "dflt 模板覆盖迁移：默认目录→nmw 树，用户目录/currentCatalogId 原样",
  C3: "旧 nmw 缓存保护：用户改过的 nmw 树刷新后完全一致、无覆盖",
  C4: "折叠已删：无 .node-fold/.node-fold-badge/#expandAllBtn；collapsed 存量子节点仍可见",
  C5: "日历已删：无 #dailyAside/#dailyRail/每日打卡菜单；daily 存量按普通节点勾选落 done",
  C6: "根节点：名称=目录名/单顶层去重/两顶层为子节点/改名同步/右键拖拽/fit/搜索",
  C7: "回归护栏：虚线贴合/撤销/搜索/缩放fit/暗黑/多目录/NeurCross 494/环形不白屏"
};
const results = {
  meta: {
    file: FILE, fileName: path.basename(FILE), out: OUT,
    viewport: VIEW.width + "x" + VIEW.height,
    httpPort: HTTP_PORT, cdpPort: CDP_PORT,
    startedAt: new Date().toISOString(), node: process.version
  },
  cases: {}, summary: {}
};
function logsSince(mark) {
  const out = [];
  for (const e of cdp.events.slice(mark)) {
    if (e.method === "Runtime.consoleAPICalled" && e.params.type === "error") {
      out.push({ kind: "console.error", text: e.params.args.map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(" ") });
    } else if (e.method === "Runtime.exceptionThrown") {
      const d = e.params.exceptionDetails;
      out.push({ kind: "exception", text: (d.exception && d.exception.description) || d.text });
    } else if (e.method === "Log.entryAdded" && e.params.entry.level === "error") {
      const t = e.params.entry.text + (e.params.entry.url ? " @ " + e.params.entry.url : "");
      // 环境噪声过滤：单文件托管时缺失的 PWA 资源（manifest/图标/SW 注册 404）与应用无关
      if (!/favicon|gpu|GPU|WebGPU|fallback|autofill|password|manifest|icon-\d+\.png|bad HTTP response code/i.test(t)) out.push({ kind: "log.error", text: t });
    }
  }
  return out;
}
async function runCase(id, fn) {
  const entry = { id, title: CASE_TITLES[id], expectedBaseline: EXPECT_BASELINE[id], guard: GUARDS.includes(id), checks: [], metrics: {}, screenshots: [], logs: [], pass: null };
  const t0 = Date.now();
  const mark = cdp.events.length;
  try {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: VIEW.width, height: VIEW.height, deviceScaleFactor: 1, mobile: false });
    await fn(entry);
  } catch (e) {
    entry.error = String((e && e.message) || e);
  }
  entry.logs = logsSince(mark);
  entry.durationMs = Date.now() - t0;
  const errCount = entry.logs.filter(l => l.kind === "exception" || l.kind === "console.error").length;
  entry.pass = !entry.error && errCount === 0 && entry.checks.length > 0 && entry.checks.every(c => c.pass);
  results.cases[id] = entry;
  const tag = entry.guard && !entry.pass ? "  ← 回归！护栏用例不得 FAIL"
    : (!entry.guard && entry.pass ? "  [基线预期 FAIL，此处 PASS：基线已含该项？]" : "");
  console.log((entry.pass ? "PASS" : "FAIL") + "  " + id + " " + CASE_TITLES[id] + (entry.error ? "  [error] " + entry.error : "") + tag);
}
function check(entry, id, expect, actual, pass, note) {
  entry.checks.push({ id, expect, actual: actual === undefined ? null : actual, pass: !!pass, note: note || "" });
}
const eqSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
async function ensureLinksDrawn(minExpected) {
  for (let i = 0; i < 12; i++) {
    const m = await evalExpr("document.querySelectorAll('#mindSvg .mindmap-link').length");
    if (m >= minExpected) return m;
    await wheel("out", 2);
    await sleep(60);
    await waitForFrames(2);
  }
  return await evalExpr("document.querySelectorAll('#mindSvg .mindmap-link').length");
}
/* 触发一次落盘（侧栏收起→展开，走 save() 路径）但不改树数据 */
async function touchSave() {
  await evalExpr("document.getElementById('catalogCollapseBtn').click()");
  await sleep(250);
  await evalExpr("document.getElementById('catalogRail').click()");
  await sleep(250);
}

/* ====================== 用例实现 C1–C7 ====================== */

/* C1 无缓存首开：清 localStorage 加载（首开后未落盘，从 DOM 断言当前目录树） */
async function caseC1(e) {
  await evalExpr("localStorage.clear()");
  await reloadPage();
  await waitForFrames(3);
  const dom = await evalExpr(M_DOM);
  const root = await evalExpr(M_ROOT);
  const env = await evalExpr(M_ENV);
  e.metrics = { dom: dom, root: root, env: env };
  check(e, "default-nodes-23", "默认目录 23 个数据节点（DOM）", root.nodeTotal - 1, root.nodeTotal - 1 === NMW_EXPECTED.count);
  check(e, "tops-kunlun-shu", "两顶层=昆仑数模+上海大学", JSON.stringify(root.depth1), root.depth1.length === 2 && eqSet(root.depth1, NMW_EXPECTED.tops));
  check(e, "no-dflt-dom", "DOM 无 dflt- 前缀节点", dom.dfltDomNodes, dom.dfltDomNodes === 0);
  check(e, "has-kunlun-node", "DOM 含「昆仑数模」", String(dom.names.includes("昆仑数模")), dom.names.includes("昆仑数模"));
  check(e, "has-shu-node", "DOM 含「上海大学」", String(dom.names.includes("上海大学")), dom.names.includes("上海大学"));
  check(e, "no-page-errors", "页面错误 0", env.pageErrors.length, env.pageErrors.length === 0);
  e.screenshots.push(await screenshot("C1"));
}

/* C2 dflt 覆盖迁移 */
async function caseC2(e) {
  const info = await seedAndReload("seed-c2-dflt-overlay.mjs");
  await waitForFrames(3);
  const dom = await evalExpr(M_DOM); // DOM 直接反映页面内存态（迁移是否生效）
  await touchSave();                  // 再走一次落盘，检查 save 路径不被旧数据回写
  const st = await evalExpr(mState("cat_dflt_seed"));
  const user = await evalExpr(mState("cat_user_seed"));
  e.metrics = { seed: info, dom: dom, state: st, user: user };
  check(e, "dom-migrated", "DOM 当前目录渲染 nmw 树（含昆仑数模+上海大学，0 个 dflt-）",
    JSON.stringify({ dfltDom: dom.dfltDomNodes, kunlun: dom.names.includes("昆仑数模"), shu: dom.names.includes("上海大学") }),
    dom.dfltDomNodes === 0 && dom.names.includes("昆仑数模") && dom.names.includes("上海大学"));
  check(e, "dflt-migrated", "落盘后默认目录 = 23 nmw 节点（0 dflt-）", st.cat ? st.cat.count + " nodes/" + st.cat.dflt + " dflt-" : "null",
    !!(st.cat && st.cat.count === NMW_EXPECTED.count && st.cat.dflt === 0 && st.cat.nmw === NMW_EXPECTED.count));
  check(e, "migrated-tops", "迁移后两顶层=昆仑数模+上海大学", JSON.stringify(st.cat && st.cat.tops),
    !!(st.cat && st.cat.hasKunlun && st.cat.hasSHU && st.cat.tops.length === 2));
  check(e, "user-catalog-intact", "用户目录甲 3 节点原样", JSON.stringify(user.cat && user.cat.tuples && user.cat.tuples.map(t => t[1])),
    !!(user.cat && user.cat.count === 3 && user.cat.tuples.every(t => ["我的项目", "需求梳理", "发布上线"].includes(t[1]))));
  check(e, "current-unchanged", "currentCatalogId 仍为 cat_dflt_seed", st.currentCatalogId, st.currentCatalogId === "cat_dflt_seed");
  check(e, "catalog-count", "目录数仍为 2（NeurCross 抑制不复活）", st.catalogIds && st.catalogIds.length, !!st.catalogIds && st.catalogIds.length === 2);
  e.screenshots.push(await screenshot("C2"));
}

/* C3 旧 nmw 缓存保护（不得回归） */
const M_C3_DOM = `(() => ({
  renamed: Array.from(document.querySelectorAll(".mm-node .node-name")).some(n => n.textContent.trim() === "王静(导师)"),
  doneLeaf: !!document.querySelector('.mm-node[data-ref="nmwiyhe7ow45g"] .node-btn.done'),
  linkDrawn: !!document.querySelector('.mindmap-link-hit[data-link-a="nmwiyhe7ow45g"][data-link-b="nmwkf0i9b3ft6"], .mindmap-link-hit[data-link-a="nmwkf0i9b3ft6"][data-link-b="nmwiyhe7ow45g"]'),
  nodeCount: document.querySelectorAll(".mm-node").length
}))()`;
async function caseC3(e) {
  const info = await seedAndReload("seed-c3-nmw-modified.mjs");
  await waitForFrames(3);
  const dom = await evalExpr(M_C3_DOM);
  await touchSave(); // 落盘路径也必须原样写回
  const st = await evalExpr(mState("cat_nmw_mod"));
  const got = ((st.cat && st.cat.tuples) || []).map(t => ({ id: t[0], name: t[1], parentId: t[2], done: t[3] }));
  const same = got.length === C3_EXPECTED_TUPLES.length && got.every(t => {
    const x = C3_EXPECTED_TUPLES.find(y => y.id === t.id);
    return x && x.name === t.name && x.parentId === t.parentId && x.done === t.done;
  });
  const linksOk = st.cat && st.cat.links.length === C3_EXPECTED_LINKS.length && st.cat.links.every(l => C3_EXPECTED_LINKS.some(x => x[0] === l[0] && x[1] === l[1]));
  e.metrics = { seed: info, dom: dom, state: st };
  check(e, "dom-renamed", "DOM 显示改名后的「王静(导师)」", String(dom.renamed), dom.renamed);
  check(e, "dom-done-leaf", "DOM 上机作业@第四周 = done", String(dom.doneLeaf), dom.doneLeaf);
  check(e, "dom-link-drawn", "用户连线已画出", String(dom.linkDrawn), dom.linkDrawn);
  check(e, "dom-node-count", "23 个数据节点 + 1 根", dom.nodeCount, dom.nodeCount === 24);
  check(e, "storage-tuples-identical", "落盘后 23 节点元组与种子完全一致（无覆盖）", got.length + " tuples", same);
  check(e, "storage-link-kept", "用户连线保留", JSON.stringify(st.cat && st.cat.links), !!linksOk);
  e.screenshots.push(await screenshot("C3"));
}

/* C4 折叠已删 */
async function caseC4(e) {
  const info = await seedAndReload("seed-c4-collapsed.mjs");
  await waitForFrames(3);
  const dom = await evalExpr(M_DOM);
  const kids = await evalExpr(mChildrenVisible(["a1", "a2", "a3"]));
  e.metrics = { seed: info, dom: dom, kids: kids };
  check(e, "no-node-fold", "DOM 无 .node-fold", dom.foldBtns, dom.foldBtns === 0);
  check(e, "no-fold-badge", "DOM 无 .node-fold-badge", dom.foldBadges, dom.foldBadges === 0);
  check(e, "no-expand-all", "工具条无 #expandAllBtn", String(dom.expandAllBtn), dom.expandAllBtn === false);
  check(e, "toolbar-zoom-fit", "工具条仍有 #zoomInBtn/#zoomOutBtn/#fitViewBtn", [dom.zoomInBtn, dom.zoomOutBtn, dom.fitViewBtn].join("/"), !!(dom.zoomInBtn && dom.zoomOutBtn && dom.fitViewBtn));
  const allVisible = kids && ["a1", "a2", "a3"].every(id => kids[id] && kids[id].present && kids[id].visible);
  check(e, "collapsed-children-visible", "collapsed:true 存量节点的子节点 a1/a2/a3 全部渲染可见", JSON.stringify(kids), !!allVisible);
  e.screenshots.push(await screenshot("C4"));
}

/* C5 日历已删 */
const M_C5_DAILY = `(() => {
  const el = document.querySelector('.mm-node[data-ref="a1"] .node-btn');
  return el ? { hasDailyClass: el.classList.contains("daily") } : null;
})()`;
async function caseC5(e) {
  const info = await seedAndReload("seed-c5-daily.mjs");
  await waitForFrames(3);
  const dom0 = await evalExpr(M_DOM);
  const menu = await evalExpr(mCtxMenuOn("a1"));
  const dailyDom = await evalExpr(M_C5_DAILY);
  const errCount = await evalExpr("(window.__acceptErrors||[]).length");
  const t1 = await clickToggle("a1");
  await waitForFrames(3); await sleep(400);
  const after = await evalExpr(mNode("cat_daily_seed", "a1"));
  e.metrics = { seed: info, dom: dom0, menu: menu, dailyDom: dailyDom, clicked: t1, after: after };
  check(e, "no-daily-aside", "DOM 无 #dailyAside", String(dom0.dailyAside), dom0.dailyAside === false);
  check(e, "no-daily-rail", "DOM 无 #dailyRail", String(dom0.dailyRail), dom0.dailyRail === false);
  const kindItems = (menu.items || []).filter(i => !i.hidden && /每日打卡|长期任务/.test(i.text));
  check(e, "ctx-no-daily-item", "右键菜单无「设为每日打卡/改为长期任务」项", JSON.stringify(kindItems.map(i => i.text)), !!(menu.ok && kindItems.length === 0));
  check(e, "daily-node-normal", "daily 存量节点按普通节点显示（无 daily 类/每日徽标）", JSON.stringify(dailyDom) + " badges=" + dom0.dailyBadgeCount, !!(dailyDom && !dailyDom.hasDailyClass && dom0.dailyBadgeCount === 0));
  check(e, "no-page-errors", "含 dailyChecks/kind/calendarOpen 存量数据加载 0 报错", errCount, errCount === 0);
  check(e, "toggle-persist-done", "勾选后 done 持久化到节点 done 字段", JSON.stringify(after.node && { done: after.node.done, dailyDates: after.dailyChecksDates }),
    !!(t1.ok && after.node && after.node.done === true));
  e.screenshots.push(await screenshot("C5"));
}

/* C6 根节点 */
const M_CURRENT_CATALOG = `(() => {
  try {
    const s = JSON.parse(localStorage.getItem("signin-tracker-v1"));
    const c = (s.catalogs || []).find(x => x.id === s.currentCatalogId);
    return c ? { name: c.name, id: c.id, count: (c.nodes || []).length } : null;
  } catch (err) { return null; }
})()`;
async function caseC6(e) {
  const info = await seedAndReload("seed-c6-catalogs.mjs");
  await waitForFrames(3);
  // 前置护栏：NeurCross 预置目录仍自动补回（硬约束：多目录管理）
  const ncLi = await evalExpr("!!document.querySelector('#catalogList [data-cat-id=\"cat_neurcross_arch\"]')");
  check(e, "prel-neurcross-kept", "NeurCross 预置目录仍自动补回（硬约束）", String(ncLi), ncLi === true);

  // a) NeurCross 目录：根显示 NeurCross 且不出现两层同名
  await evalExpr(aSwitchCatalog("cat_neurcross_arch"));
  await waitForFrames(3); await sleep(600);
  const ra = await evalExpr(M_ROOT);
  e.metrics.a = ra;
  check(e, "a-root-name", "a) 根节点名称=NeurCross", ra.name, ra.name === "NeurCross");
  check(e, "a-single-layer", "a) name=NeurCross 的 .mm-node 恰 1 个（无两层同名）", (ra.nameCounts["NeurCross"] || 0), (ra.nameCounts["NeurCross"] || 0) === 1);
  check(e, "a-root-leftmost", "a) 根节点为最左节点", String(ra.isLeftmost), ra.isLeftmost === true);
  e.screenshots.push(await screenshot("C6a"));

  // b) 新建目录（直接调用页面全局 createCatalog()，真实路径；Esc 关掉自动改名框）
  await evalExpr(aSwitchCatalog("cat_c6_dflt"));
  await waitForFrames(2); await sleep(300);
  const created = await evalExpr(A_CREATE_CATALOG);
  await waitForFrames(3); await sleep(400);
  const rb = await evalExpr(M_ROOT);
  const stb = await evalExpr(M_CURRENT_CATALOG);
  e.metrics.b = { created: created, root: rb, catalog: stb };
  check(e, "b-create-ok", "b) createCatalog() 成功（方式：直接调用页面全局函数，等价用户点「＋ 新建目录」）", JSON.stringify(created), !!(created && created.ok && stb));
  check(e, "b-root-name", "b) 根节点名称=新目录名「" + (stb ? stb.name : "?") + "」", rb.name, !!(stb && rb.name === stb.name));
  check(e, "b-single-layer", "b) 与目录同名的 .mm-node 恰 1 个（单顶层不再包一层）", stb ? String(rb.nameCounts[stb.name] || 0) : "0", !!(stb && (rb.nameCounts[stb.name] || 0) === 1));
  e.screenshots.push(await screenshot("C6b"));

  // c) 默认目录（昆仑数模+上海大学两顶层）：根=「默认目录」
  await evalExpr(aSwitchCatalog("cat_c6_dflt"));
  await waitForFrames(3); await sleep(400);
  const rc = await evalExpr(M_ROOT);
  e.metrics.c = rc;
  check(e, "c-root-name", "c) 根节点名称=「默认目录」", rc.name, rc.name === "默认目录");
  check(e, "c-not-quanbu", "c) 根节点名称≠「全部项目」", rc.name, rc.name !== "全部项目");
  check(e, "c-two-tops", "c) 两顶层为根的子节点（depth1=昆仑数模+上海大学）", JSON.stringify(rc.depth1), rc.depth1.length === 2 && eqSet(rc.depth1, NMW_EXPECTED.tops));

  // g) 根搜索「默认目录」命中（先于 d 改名，保持场景纯净）
  const sg = await evalExpr(aSearch("默认目录"));
  await evalExpr(aSearch(""));
  e.metrics.g = sg;
  check(e, "g-root-search-hit", "g) 搜索「默认目录」命中根节点（≥1 且根带 search-hit）", JSON.stringify({ hits: sg.hits, rootHit: sg.rootHit, text: sg.countText }), !!(sg.ok && sg.hits >= 1 && sg.rootHit));

  // d) 侧栏重命名目录 → 画布根名同步（真实路径 dblclick→输入→Enter）
  const rd0 = await evalExpr(A_RENAME_CATALOG);
  await waitForFrames(3); await sleep(400);
  const rd = await evalExpr(M_ROOT);
  e.metrics.d = { action: rd0, root: rd };
  check(e, "d-sidebar-renamed", "d) 侧栏目录名变为「我的目录X」", rd0.sidebarName, !!(rd0.ok && rd0.sidebarName === "我的目录X"));
  check(e, "d-root-sync", "d) 画布根节点名同步=「我的目录X」", rd.name, rd.name === "我的目录X");
  e.screenshots.push(await screenshot("C6d"));

  // e) 根右键新增子分支 + 拖节点到根升为一级 + 根上无改名/删除菜单项
  const menuRoot = await evalExpr(mCtxMenuOn(""));
  const addVisible = (menuRoot.items || []).some(i => i.act === "add" && !i.hidden && !i.disabled);
  const renameHidden = (menuRoot.items || []).every(i => i.act !== "rename" || i.hidden === true);
  const deleteHidden = (menuRoot.items || []).every(i => i.act !== "delete" || i.hidden === true);
  e.metrics.e_menu = menuRoot;
  check(e, "e-root-menu-add", "e) 根右键有「+ 分支」", String(addVisible), addVisible);
  check(e, "e-root-menu-no-rename", "e) 根右键无「改名」", String(renameHidden), renameHidden);
  check(e, "e-root-menu-no-delete", "e) 根右键无「删除」", String(deleteHidden), deleteHidden);
  const added = await evalExpr(A_ROOT_ADD_CHILD);
  await waitForFrames(3); await sleep(300);
  const stAdd = await evalExpr(mState("cat_c6_dflt"));
  const addedOk = !!(added.ok && stAdd.cat && stAdd.cat.tuples.some(t => t[1] === "根上新增分支" && t[2] === null));
  check(e, "e-root-add-child", "e) 根右键新增子分支落盘（根上新增分支/parentId=null）", JSON.stringify({ action: added.ok, found: addedOk }), addedOk);
  const dragged = await evalExpr(A_DRAG_TO_ROOT);
  await waitForFrames(3); await sleep(300);
  const wj = await evalExpr(mNode("cat_c6_dflt", "nmwiyes47mg9k"));
  const rAfterDrag = await evalExpr(M_ROOT);
  e.metrics.e_drag = { action: dragged, wangjing: wj, root: rAfterDrag };
  check(e, "e-drag-to-root", "e) 王静拖到根后 parentId=null（升为一级）", JSON.stringify(wj.node && { parentId: wj.node.parentId }), !!(dragged.ok && wj.node && wj.node.parentId === null));
  check(e, "e-toplevel-count", "e) 一级分支=4（昆仑数模/上海大学/根上新增分支/王静）", JSON.stringify(rAfterDrag.depth1), rAfterDrag.depth1.length === 4);

  // f) fitView 后根节点在视野内
  await evalExpr("document.getElementById('fitViewBtn').click()");
  await waitForFrames(3); await sleep(400);
  const rf = await evalExpr(M_ROOT);
  const fit = await evalExpr(M_FIT);
  e.metrics.f = { root: rf, fit: fit };
  check(e, "f-fit-root-in-view", "f) fitView 后根节点在视口内", JSON.stringify({ left: rf.left, top: rf.top, w: rf.width, h: rf.height, vw: rf.vw, vh: rf.vh }), rf.inViewport === true);
  e.screenshots.push(await screenshot("C6f"));
}

/* C7 回归护栏（必须全 PASS，不得回归） */
const M_NC = `(() => ({
  ncNodes: document.querySelectorAll('.mm-node[data-ref^="nc_"]').length,
  errors: (window.__acceptErrors || []).length,
  rootExists: !!document.querySelector('.mm-node[data-ntype="root"]'),
  bodyText: (document.body.innerText || "").trim().length
}))()`;
const M_CYCLE = `(() => ({
  nodes: document.querySelectorAll('.mm-node').length,
  bodyText: (document.body.innerText || "").trim().length,
  errors: (window.__acceptErrors || []).length
}))()`;
async function caseC7(e) {
  // 7.1 打卡后虚线端点贴合 ≤1.5px（复用仓库 measure-toggle 口径）
  await seedAndReload("seed-basic.mjs");
  await ensureLinksDrawn(3);
  const s0 = await evalExpr(M_LINKS);
  await clickToggle("a1");
  await waitForFrames(3); await sleep(300);
  const s1 = await evalExpr(M_LINKS);
  e.metrics.fit0 = s0; e.metrics.fit1 = s1;
  e.screenshots.push(await screenshot("C7-1-toggle"));
  check(e, "1-link-drawn", "3 条连线全部画出（打卡后）", s1.drawn, s1.drawn === 3);
  check(e, "1-endpoint-fit", "虚线端点到接驳边距离 ≤1.5px（打卡后）", s1.maxDist + "px", s1.maxDist <= 1.5);

  // 7.2 撤销 Ctrl+Z 恢复
  await evalExpr(A_UNDO);
  await waitForFrames(3); await sleep(400);
  const undoState = await evalExpr(mNode("cat_test", "a1"));
  const undoDom = await evalExpr("!!document.querySelector('.mm-node[data-ref=\"a1\"] .node-btn.done')");
  e.metrics.undo = { state: undoState, domDone: undoDom };
  check(e, "2-undo-storage", "Ctrl+Z 后 a1.done 落盘恢复 false", JSON.stringify(undoState.node && undoState.node.done), !!(undoState.node && undoState.node.done === false));
  check(e, "2-undo-dom", "Ctrl+Z 后 DOM a1 恢复未完成", String(undoDom), undoDom === false);

  // 7.3 搜索高亮计数
  const sr = await evalExpr(aSearch("子节点"));
  await evalExpr(aSearch(""));
  e.metrics.search = sr;
  check(e, "3-search-count", "搜索「子节点」命中 3 处（子节点A/B/C）", JSON.stringify({ hits: sr.hits, text: sr.countText }), !!(sr.ok && sr.hits === 3 && sr.countText === "3 处"));

  // 7.4 缩放工具条 fit
  await wheel("out", 6);
  await waitForFrames(2); await sleep(200);
  const zoomedOut = await evalExpr(M_FIT);
  await evalExpr("document.getElementById('fitViewBtn').click()");
  await waitForFrames(3); await sleep(400);
  const fitted = await evalExpr(M_FIT);
  e.metrics.zoom = { zoomedOut: zoomedOut, fitted: fitted };
  check(e, "4-fit-restores", "滚轮缩小后点击 fitViewBtn 恢复（scale 回到 1）", zoomedOut.scale + "→" + fitted.scale, !!fitted.scale && Math.abs(fitted.scale - 1) < 0.01);
  check(e, "4-fit-all-in-view", "fit 后所有节点都在视口内", JSON.stringify(fitted.outOfView), fitted.outOfView.length === 0);

  // 7.5 暗黑切换 data-theme
  await evalExpr(A_THEME_TOGGLE);
  const darkState = await evalExpr("({ attr: document.documentElement.getAttribute('data-theme'), store: localStorage.getItem('signin-tracker-theme') })");
  e.screenshots.push(await screenshot("C7-5-dark"));
  await evalExpr(A_THEME_TOGGLE);
  const lightState = await evalExpr("({ attr: document.documentElement.getAttribute('data-theme'), store: localStorage.getItem('signin-tracker-theme') })");
  e.metrics.theme = { dark: darkState, light: lightState };
  check(e, "5-dark-on", "点击后 data-theme=dark 且落盘", JSON.stringify(darkState), darkState.attr === "dark" && darkState.store === "dark");
  check(e, "5-dark-off", "再点击恢复 light 且落盘", JSON.stringify(lightState), lightState.attr === "light" && lightState.store === "light");

  // 7.6 多目录切换渲染
  await seedAndReload("seed-c7-two-catalogs.mjs");
  const before = await evalExpr(M_ROOT);
  const sw = await evalExpr(aSwitchCatalog("cat_c7_b"));
  await waitForFrames(3); await sleep(400);
  const after = await evalExpr(M_ROOT);
  const stAfter = await evalExpr(mState("cat_c7_b"));
  e.metrics.switch = { before: before.nodeTotal, after: after.nodeTotal, action: sw, current: stAfter.currentCatalogId };
  e.screenshots.push(await screenshot("C7-6-switch"));
  check(e, "6-switch-render", "切到目录二后画布渲染 4 个数据节点", after.nodeTotal - 1, after.nodeTotal - 1 === 4);
  check(e, "6-switch-current", "currentCatalogId 落盘为 cat_c7_b", stAfter.currentCatalogId, stAfter.currentCatalogId === "cat_c7_b");

  // 7.7 NeurCross 预置 494 节点加载 0 异常
  await evalExpr("localStorage.clear()");
  await reloadPage();
  await waitForFrames(3);
  const swNc = await evalExpr(aSwitchCatalog("cat_neurcross_arch"));
  await waitForFrames(4); await sleep(800);
  const nc = await evalExpr(M_NC);
  e.metrics.neurcross = { action: swNc, measure: nc };
  e.screenshots.push(await screenshot("C7-7-neurcross"));
  check(e, "7-neurcross-494", "NeurCross 预置 494 节点全部加载", nc.ncNodes + "（切换 " + swNc.ok + "）", !!(swNc.ok && nc.ncNodes === NEURCROSS_COUNT));
  check(e, "7-neurcross-0-errors", "加载 0 页面异常", nc.errors, nc.errors === 0);

  // 7.8 环数据不白屏
  await seedAndReload("seed-cycle.mjs");
  const cyc = await evalExpr(M_CYCLE);
  const t1c = await clickToggle("nC");
  await waitForFrames(3); await sleep(300);
  const t2c = await evalExpr("!!document.querySelector('.mm-node[data-ref=\"nC\"] .node-btn.done')");
  e.metrics.cycle = { cyc: cyc, toggled: t1c.ok, doneNow: t2c };
  e.screenshots.push(await screenshot("C7-8-cycle"));
  check(e, "8-no-white-screen", "环形 JSON 不白屏（body 文本>0 且节点≥3）", JSON.stringify({ bodyText: cyc.bodyText, nodes: cyc.nodes }), cyc.bodyText > 0 && cyc.nodes >= 3);
  check(e, "8-cycle-0-errors", "环形数据 0 异常", cyc.errors, cyc.errors === 0);
  check(e, "8-cycle-usable", "正常节点 nC 可打卡", String(t1c.ok) + "→" + String(t2c), !!(t1c.ok && t2c === true));
}

/* ====================== 报告生成 ====================== */
function fmt(v) {
  if (v === null || v === undefined) return "-";
  if (typeof v === "number") return String(+v.toFixed?.(3));
  if (typeof v === "object") { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  return String(v);
}
function buildReport() {
  const L = [];
  const m = results.meta;
  L.push("# PHASE-C 验收矩阵报告（run-c.mjs）");
  L.push("");
  L.push("- 被测文件：`" + m.file + "`");
  L.push("- 运行时间：" + m.startedAt + "（耗时 " + ((Date.now() - Date.parse(m.startedAt)) / 1000).toFixed(1) + "s）");
  L.push("- 视口：1440×900（CDP Emulation）；环境：Node " + m.node + "，http 端口 " + m.httpPort + "，CDP 端口 " + m.cdpPort + "（服务与 Edge 自起自清，只按 PID 杀）");
  L.push("");
  L.push("## 结果总览");
  L.push("");
  L.push("| 用例 | 场景 | 结果 | 基线预期 | 口径 |");
  L.push("|---|---|---|---|---|");
  const notes = {
    C1: "改造目标：默认树恢复 nmw 23 节点（基线现为 dflt- 模板 24 节点）",
    C2: "改造目标：dflt 模板期存量默认目录迁移为 nmw 树",
    C3: "护栏：用户改过的 nmw 树必须原样保留（不得回归）",
    C4: "改造目标：折叠功能删除（UI 元素 + collapsed 存量字段忽略）",
    C5: "改造目标：日历功能删除（UI + 菜单项 + daily 存量降级为普通节点）",
    C6: "改造目标：根节点改名/去同名层（e/f 为现有行为护栏，应保持 PASS）",
    C7: "回归护栏：现有能力不得回归"
  };
  for (const id of ["C1", "C2", "C3", "C4", "C5", "C6", "C7"]) {
    const c = results.cases[id];
    if (!c) continue;
    L.push("| " + id + " | " + c.title + " | " + (c.pass ? "✅ PASS" : "❌ FAIL") + " | " + c.expectedBaseline + " | " + notes[id] + " |");
  }
  L.push("");
  const guardFail = GUARDS.filter(id => results.cases[id] && !results.cases[id].pass);
  L.push(guardFail.length === 0
    ? "**护栏（C3/C7）全部 PASS**；C1/C2/C4/C5/C6 的 FAIL 项即 Phase-C 待改造清单（基线跑批属预期）。"
    : "**回归告警：护栏用例 " + guardFail.join("/") + " FAIL——现有能力被破坏，必须修复。**");
  L.push("");
  for (const id of ["C1", "C2", "C3", "C4", "C5", "C6", "C7"]) {
    const c = results.cases[id];
    if (!c) continue;
    L.push("## " + id + " " + c.title + "（基线预期 " + c.expectedBaseline + (c.guard ? "，护栏" : "") + "）");
    L.push("");
    L.push("| 断言 | 预期 | 实际 | 结果 |");
    L.push("|---|---|---|---|");
    for (const k of c.checks) {
      L.push("| " + k.id + " | " + fmt(k.expect) + " | " + fmt(k.actual) + " | " + (k.pass ? "PASS" : "**FAIL**") + " |");
    }
    if (c.error) L.push("> 执行错误：`" + c.error + "`");
    if (c.logs && c.logs.length) {
      L.push("");
      L.push("<details><summary>控制台错误/异常（" + c.logs.length + "）</summary>");
      L.push("");
      for (const l of c.logs.slice(0, 10)) L.push("- `[" + l.kind + "] " + String(l.text).slice(0, 300));
      L.push("");
      L.push("</details>");
    }
    for (const s of c.screenshots) L.push("![" + s + "](" + s + ")");
    L.push("");
  }
  L.push("## 运行方法");
  L.push("");
  L.push("```powershell");
  L.push("# 基线（本目录 head.html）");
  L.push("node run-c.mjs --file .\\head.html --out baseline");
  L.push("# 候选版（实现代理的 impl.html）");
  L.push("node run-c.mjs --file ..\\impl\\impl.html --out impl-result");
  L.push("# 默认端口 http=8807 / CDP=9437，可用 --http-port/--cdp-port 覆盖");
  L.push("```");
  L.push("");
  L.push("- 种子在 `seeds/`（注入 localStorage → 自动刷新；结构同仓库 tests/seed-basic.js）。");
  L.push("- C6b 新建目录场景直接调用页面全局 `createCatalog()`（与用户点「＋ 新建目录」完全同一路径）；其余场景均为 DOM/事件驱动。");
  L.push("- 退出码：0=护栏全过；3=护栏（C3/C7）有 FAIL（回归）；1=工装自身错误。");
  L.push("");
  return L.join("\n");
}

/* ====================== 主流程 ====================== */
let server = null;
try {
  server = await startServer();
  const edge = await startEdge();
  cdp = await cdpConnect();
  console.log("被测页面: " + PAGE_URL + "（服务=" + server.kind + "，Edge PID=" + edge.pid + "）");
  await navigate(PAGE_URL);

  await runCase("C1", caseC1);
  await runCase("C2", caseC2);
  await runCase("C3", caseC3);
  await runCase("C4", caseC4);
  await runCase("C5", caseC5);
  await runCase("C6", caseC6);
  await runCase("C7", caseC7);

  const ids = Object.keys(results.cases);
  const guardFailed = GUARDS.filter(i => results.cases[i] && !results.cases[i].pass);
  results.summary = {
    total: ids.length,
    passed: ids.filter(i => results.cases[i].pass).length,
    failed: ids.filter(i => !results.cases[i].pass).map(i => i),
    expectedFailOnBaseline: ids.filter(i => EXPECT_BASELINE[i] === "FAIL").map(i => i),
    guards: GUARDS,
    guardFailed: guardFailed,
    note: "C1/C2/C4/C5/C6 基线应 FAIL（Phase-C 改造目标）；C3/C7 为回归护栏，任何时候 FAIL 都算回归"
  };
  results.meta.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, "report.md"), buildReport());
  console.log("完成：" + results.summary.passed + "/" + results.summary.total + " PASS；护栏回归：" + JSON.stringify(guardFailed));
  console.log("报告: " + path.join(OUT, "report.md"));
  if (guardFailed.length) process.exitCode = 3;
} catch (err) {
  console.error("[run-c.mjs] 主流程错误:", err && err.stack || err);
  process.exitCode = 1;
} finally {
  try { if (cdp && cdp.ws) cdp.ws.close(); } catch (e) {}
  await cleanup();
}
