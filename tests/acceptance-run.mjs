#!/usr/bin/env node
/**
 * run.mjs — 思维导图签到应用 PHASE-B 验收工装（accept）
 *
 * 用法：
 *   node run.mjs --file <html路径> --out <输出目录> [--mobile]
 *   可选：--http-port 8806 --cdp-port 9436 --edge <msedge路径> --python python
 *
 * 对任意候选版本（base.html / b\<name>\<name>.html）零改动重跑：
 * 工装只通过「真实用户路径」驱动页面（点击打卡按钮、右键菜单删除、滚轮缩放），
 * 断言全部基于 DOM / localStorage / SVG 数值，不依赖页面内部闭包变量。
 *
 * 用例矩阵 A1–A8 详见 report.md；输出：
 *   <out>/report.md    人类可读报告（表格）
 *   <out>/results.json 机读结果
 *   <out>/shots/*.png  每用例截图
 *
 * 自起自清：静态服务（python http.server，8806）与无头 Edge（CDP 9436）
 * 均为本进程子进程，结束时只按 PID 杀（taskkill /PID <pid> /T /F），
 * 绝不按进程名杀，避免误杀用户浏览器。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
if (!args.file) {
  console.error("用法: node run.mjs --file <html路径> --out <目录> [--mobile]");
  process.exit(2);
}
const FILE = path.resolve(args.file);
const OUT = path.resolve(args.out || path.join(__dirname, "out"));
const MOBILE = !!args.mobile;
const HTTP_PORT = parseInt(args["http-port"] || "8806", 10);
const CDP_PORT = parseInt(args["cdp-port"] || "9436", 10);
const EDGE_PATH = args.edge || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PYTHON = args.python || "python";
const DESKTOP = { width: 1440, height: 900 };
const MOBILE_VP = { width: 390, height: 844 };
const VIEW = MOBILE ? MOBILE_VP : DESKTOP;
const BASE_URL = "http://127.0.0.1:" + HTTP_PORT;
const PAGE_URL = BASE_URL + "/" + encodeURIComponent(path.basename(FILE));

if (!fs.existsSync(FILE)) { console.error("找不到目标文件: " + FILE); process.exit(2); }
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });

/* ====================== 进程管理（只按 PID 杀） ======================
 * 1) 本进程 spawn 出的子进程记入 spawned，结束时 taskkill /PID <pid> /T /F；
 * 2) Edge 有 compat-layer 自重启行为：spawn 的 PID 会 exit=0 让位给新 PID 的
 *    浏览器树（命令行相同，仍占用我的 CDP 端口）。因此清理时对「我的端口
 *    8806/9436 的 LISTENING 归属 PID」同样按 PID 树清除——这两个端口是
 *    PHASE-B 分配给 accept 的专用端口，只有本工装会使用；
 * 3) 绝不按进程名杀（不碰用户自己的浏览器）。 */
const spawned = []; // { pid, name, handle? }
function pidKill(pid) {
  return new Promise(resolve => {
    if (!pid) return resolve(false);
    const tk = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    tk.on("close", () => resolve(true));
    tk.on("error", () => { try { process.kill(pid); } catch (e) {} resolve(true); });
  });
}
/* netstat 找出监听在指定端口上的归属 PID（只返回 PID，绝不按名匹配） */
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
async function freePort(port, label) {
  for (let round = 0; round < 6; round++) {
    const pids = await portOwnerPids(port);
    if (!pids.length) return true;
    for (const pid of pids) await pidKill(pid);
    await sleep(500);
  }
  return (await portOwnerPids(port)).length === 0;
}
async function cleanup() {
  for (const p of spawned.reverse()) {
    if (p.handle) { try { p.handle.close(); } catch (e) {} }
    await pidKill(p.pid);
  }
  // 清掉 Edge 自重启后换 PID 存活的浏览器树：按 CDP 端口归属 PID +
  // 按 profile 目录归属 PID 双路清扫（都只针对本工装自己的进程）
  await freePort(CDP_PORT, "cdp");
  await sweepEdgeProfile(path.join(__dirname, "profile"));
}

/* -------- 静态服务：python http.server，失败则回退 Node 内置服务 -------- */
async function startServer() {
  const dir = path.dirname(FILE);
  // 端口自愈：若被上次崩溃运行的遗留服务占用（该端口为本工装专用），先按 PID 清
  if (!(await freePort(HTTP_PORT, "http"))) throw new Error("端口 " + HTTP_PORT + " 被非本工装进程占用，拒绝动它");
  let py = null;
  try {
    py = spawn(PYTHON, ["-m", "http.server", String(HTTP_PORT), "--bind", "127.0.0.1", "--directory", dir], { stdio: "ignore" });
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
  // 回退：Node 内置静态服务（只服务目标文件所在目录）
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
/* 找出命令行引用本工装 profile 目录的 msedge PID（只杀自己的，绝不按名杀） */
function edgeProfilePids(profile) {
  return new Promise(resolve => {
    const ps = spawn("powershell", ["-NoProfile", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*" + profile.replace(/'/g, "''").replace(/\\/g, "\\") + "*' } | ForEach-Object { Write-Output $_.ProcessId }"],
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
async function startEdge() {
  const profile = path.join(__dirname, "profile");
  fs.mkdirSync(profile, { recursive: true });
  // 自愈：清掉上次异常退出遗留的、引用本 profile 的 Edge 进程（逐 PID 验证命令行）
  await sweepEdgeProfile(profile);
  await freePort(CDP_PORT, "cdp");
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const edge = spawn(EDGE_PATH, [
      "--headless=new", "--disable-gpu", "--no-first-run",
      "--remote-debugging-port=" + CDP_PORT,
      "--user-data-dir=" + profile,
      "about:blank"
    ], { stdio: "ignore" });
    spawned.push({ pid: edge.pid, name: "msedge" });
    // 注意：Edge 可能 compat-relaunch（spawn 的 PID exit=0 让位新 PID），因此
    // 以 CDP 端口就绪为准，不把子进程退出当作失败；清理阶段按端口/profile 归属 PID 杀。
    for (let i = 0; i < 150; i++) {
      await sleep(200);
      try {
        const res = await fetch("http://127.0.0.1:" + CDP_PORT + "/json/version", { signal: AbortSignal.timeout(1000) });
        if (res.ok) return { pid: edge.pid };
      } catch (e) {}
    }
    lastErr = new Error("CDP 端口 " + CDP_PORT + " 未就绪（edge exitCode=" + edge.exitCode + "）");
    await sweepEdgeProfile(profile);
    await freePort(CDP_PORT, "cdp");
  }
  throw lastErr;
}

/* ====================== CDP 客户端（Node 24 原生 WebSocket） ====================== */
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
  // 每个新文档先于页面脚本注入：原生弹窗计数器 + 页内错误收集
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: PRELOAD });
  return c;
}

/* 页面脚本先于应用执行：拦截原生 confirm/alert/prompt（计数并放行），
   收集 window error / unhandledrejection。A6 断言计数为 0。 */
const PRELOAD = `
window.__acceptNative = { confirm: 0, alert: 0, prompt: 0 };
window.__acceptErrors = [];
window.confirm = function () { window.__acceptNative.confirm++; return true; };
window.alert = function () { window.__acceptNative.alert++; return true; };
window.prompt = function () { window.__acceptNative.prompt++; return "accept-harness"; };
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
async function setViewport(w, h, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile
  });
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
async function screenshot(name) {
  const rel = "shots/" + name + ".png";
  const s = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, rel), Buffer.from(s.data, "base64"));
  return rel;
}
async function currentScale() {
  const t = await evalExpr('getComputedStyle(document.getElementById("catTree")).transform');
  if (!t || t === "none") return 1;
  const m = /matrix\(([-\d.e]+),/.exec(t);
  return m ? parseFloat(m[1]) : 1;
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
async function zoomTo(target) {
  // 滚轮每档 ×1.12，无法精确命中目标值：停在目标 ±6% 带内即算到达
  let guard = 0, s = 0;
  while (guard++ < 120) {
    s = await currentScale();
    if (s >= target * 0.94 && s <= target * 1.06) return s;
    const goingIn = target > s;
    await wheel(goingIn ? "in" : "out", 1);
    await sleep(40);
  }
  return await currentScale();
}
/* 用例数据注入 + 刷新（shot.mjs 的 setup→reload 模式） */
async function seedAndReload(seedScript) {
  await evalExpr(seedScript);
  await cdp.send("Page.reload", { ignoreCache: true });
  for (let i = 0; i < 150; i++) {
    await sleep(100);
    try { if (await evalExpr("document.readyState", 5000) === "complete") break; } catch (e) {}
  }
  await waitForFrames(3);
  await sleep(400);
}

/* ====================== 页内测量脚本（字符串注入） ====================== */
/* 卡片世界坐标矩形：与页面 cardRects 同一测法
   （x=el.offsetLeft, y=el.offsetTop-btn.offsetHeight/2, w/h=btn 偏移尺寸） */
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
  let linksTotal = null;
  try {
    const st = JSON.parse(localStorage.getItem("signin-tracker-v1") || "{}");
    const cat = (st.catalogs || []).find(c => c.id === (st.currentCatalogId || ""));
    if (cat) linksTotal = (cat.links || []).length;
  } catch (e) {}
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
  return { drawn: linkEls.length, hits: hitEls.length, linksTotal, per, maxDist: +maxDist.toFixed(2) };
})()`;

const M_TREE = `(() => {
  const els = Array.from(document.querySelectorAll(".mm-node"));
  // 卡片可视盒：.mm-node 以 translateY(-50%) 垂直居中（top=中心线），
  // 从 computed transform 读 ty 修正为真实可视 top，兼容无 transform 的实现
  const visualY = el => {
    const t = getComputedStyle(el).transform;
    if (!t || t === "none") return el.offsetTop;
    const m = /matrix\(([-\d.e]+),([-\d.e]+),([-\d.e]+),([-\d.e]+),([-\d.e]+),([-\d.e]+)\)/.exec(t);
    return m ? el.offsetTop + parseFloat(m[6]) : el.offsetTop;
  };
  const rects = els.map(el => ({
    ref: el.dataset.ref || "",
    x: el.offsetLeft, y: visualY(el), w: el.offsetWidth, h: el.offsetHeight,
    hidden: getComputedStyle(el).display === "none"
  }));
  let overlapPairs = 0;
  const pairList = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.hidden || b.hidden) continue;
    if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 &&
        a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) {
      overlapPairs++;
      if (pairList.length < 10) pairList.push(a.ref + "<>" + b.ref);
    }
  }
  const branches = Array.from(document.querySelectorAll("#mindSvg .mindmap-branch"));
  let reverse = 0;
  const revList = [];
  for (const p of branches) {
    const d = p.getAttribute("d") || "";
    const nums = (d.match(/-?\\d+(?:\\.\\d+)?/g) || []).map(Number);
    const pts = [];
    for (let k = 0; k + 1 < nums.length; k += 2) pts.push({ x: nums[k], y: nums[k + 1] });
    if (pts.length < 2) continue;
    // 填充多边形（cubicRibbon）：点列 = 上沿(父→子) + 下沿反序(子→父)，转折点在半程；
    // 描边路径（M..C..）：终点即最后一点
    const end = d.indexOf("Z") >= 0 ? pts[Math.floor(pts.length / 2)] : pts[pts.length - 1];
    const start = pts[0];
    if (!(end.x - start.x > 0.5)) {
      reverse++;
      if (revList.length < 5) revList.push({ sx: +start.x.toFixed(1), ex: +end.x.toFixed(1) });
    }
  }
  let spine = 0;
  const spineList = [];
  for (const p of Array.from(document.querySelectorAll("#mindSvg path"))) {
    let b; try { b = p.getBBox(); } catch (e) { continue; }
    if (b.width < 20 && b.height > 40) {
      spine++;
      if (spineList.length < 5) spineList.push({ w: +b.width.toFixed(1), h: +b.height.toFixed(1), cls: p.getAttribute("class") });
    }
  }
  return {
    nodeTotal: els.length,
    visible: rects.filter(r => !r.hidden).length,
    overlapPairs, pairList,
    branchCount: branches.length, reverse, revList,
    spine, spineList
  };
})()`;

const M_ENV = `(() => {
  const se = document.scrollingElement || document.documentElement;
  return {
    readyState: document.readyState,
    scrollWidth: se.scrollWidth,
    innerWidth: window.innerWidth,
    nodeCount: document.querySelectorAll(".mm-node").length,
    bodyTextLen: (document.body.innerText || "").trim().length,
    native: window.__acceptNative ? Object.assign({}, window.__acceptNative) : null,
    pageErrors: (window.__acceptErrors || []).slice(0, 10)
  };
})()`;

/* ====================== 用例种子数据 ====================== */
/* 10 节点 + 3 连线（含带说明节点）：与 seed-basic.js 同构 */
const SEED_BASIC = `(() => {
  const nodes = [
    { id: "p", name: "父节点", parentId: null, done: false, completedAt: "", note: "" },
    { id: "a", name: "子节点 A", parentId: "p", done: false, completedAt: "", note: "" },
    { id: "a1", name: "孙节点 A1", parentId: "a", done: false, completedAt: "", note: "" },
    { id: "a2", name: "孙节点 A2", parentId: "a", done: false, completedAt: "", note: "带一段说明文字的节点" },
    { id: "a3", name: "孙节点 A3", parentId: "a", done: false, completedAt: "", note: "" },
    { id: "b", name: "子节点 B", parentId: "p", done: false, completedAt: "", note: "" },
    { id: "b1", name: "孙节点 B1", parentId: "b", done: false, completedAt: "", note: "" },
    { id: "c", name: "子节点 C", parentId: "p", done: false, completedAt: "", note: "" },
    { id: "c1", name: "孙节点 C1", parentId: "c", done: false, completedAt: "", note: "" },
    { id: "c2", name: "孙节点 C2", parentId: "c", done: false, completedAt: "", note: "" }
  ];
  const data = {
    treeVersion: 2, sidebarOpen: false, neurCrossHidden: true, catalogInserts: [],
    catalogs: [{
      id: "cat_test", name: "测试目录", archVersion: 0, nodes,
      links: [{ a: "a1", b: "b1" }, { a: "a2", b: "c1" }, { a: "a3", b: "c2" }],
      linkDone: {}
    }],
    currentCatalogId: "cat_test"
  };
  localStorage.setItem("signin-tracker-v1", JSON.stringify(data));
  return { reload: true };
})()`;

/* 50 节点 + 30 字长标题（7 个一级分支 + 43 叶，叶子全部 depth=2：
 * 常规任务行高 ROW_H_STD=40。避免把叶子放到 depth>=3——那是 NeurCross
 * 短参数名的紧凑行（ROW_H_PARAM=22），不适用 30 字长标题场景） */
const SEED_50 = `(() => {
  const t = i => (("超长标题压测节点" + String(i).padStart(3, "0") + "－").repeat(3)).slice(0, 30);
  const nodes = [];
  const per = [7, 7, 7, 6, 6, 5, 5]; // 7 分支共 43 叶 + 7 分支 = 50
  let n = 0;
  for (let bi = 0; bi < 7; bi++) {
    const bid = "b" + (bi + 1);
    nodes.push({ id: bid, name: t(n++), parentId: null, done: false, completedAt: "", note: "" });
    for (let k = 0; k < per[bi]; k++) {
      nodes.push({ id: bid + "l" + k, name: t(n++), parentId: bid, done: false, completedAt: "", note: "" });
    }
  }
  const data = {
    treeVersion: 2, sidebarOpen: false, neurCrossHidden: true, catalogInserts: [],
    catalogs: [{ id: "cat_50", name: "压测目录", archVersion: 0, nodes, links: [], linkDone: {} }],
    currentCatalogId: "cat_50"
  };
  localStorage.setItem("signin-tracker-v1", JSON.stringify(data));
  return { reload: true, nodes: nodes.length, titleLen: t(1).length };
})()`;

/* 环形 JSON：A 的父是 B，B 的父是 A；r/nC 为正常链 */
const SEED_CYCLE = `(() => {
  const nodes = [
    { id: "r", name: "正常根", parentId: null, done: false, completedAt: "", note: "" },
    { id: "nA", name: "环节点A", parentId: "nB", done: false, completedAt: "", note: "" },
    { id: "nB", name: "环节点B", parentId: "nA", done: false, completedAt: "", note: "" },
    { id: "nC", name: "正常子", parentId: "r", done: false, completedAt: "", note: "" }
  ];
  const data = {
    treeVersion: 2, sidebarOpen: false, neurCrossHidden: true, catalogInserts: [],
    catalogs: [{ id: "cat_cycle", name: "环目录", archVersion: 0, nodes, links: [], linkDone: {} }],
    currentCatalogId: "cat_cycle"
  };
  localStorage.setItem("signin-tracker-v1", JSON.stringify(data));
  return { reload: true };
})()`;

/* ====================== 用例公共动作 ====================== */
async function clickToggle(ref) {
  return evalExpr("(() => {" +
    "const el = document.querySelector('.mm-node[data-ref=\"" + ref + "\"] .node-btn[data-toggle]');" +
    "if (!el) return { ok: false };" +
    "el.click(); return { ok: true };" +
    "})()");
}
async function openCtxMenuOn(ref) {
  return evalExpr("(() => {" +
    "const el = document.querySelector('.mm-node[data-ref=\"" + ref + "\"]');" +
    "if (!el) return { ok: false, step: 'find-node' };" +
    "const r = el.getBoundingClientRect();" +
    "el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, " +
    "clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 2 }));" +
    "const m = document.getElementById('ctxMenu');" +
    "return { ok: !!(m && !m.hidden), step: 'menu-open' };" +
    "})()");
}
async function clickMenuDelete() {
  return evalExpr("(() => {" +
    "const m = document.getElementById('ctxMenu');" +
    "const btn = m && m.querySelector('button[data-act=\"delete\"]');" +
    "if (!m || m.hidden || !btn) return { ok: false, step: 'find-delete' };" +
    "btn.click(); return { ok: true, step: 'clicked-delete' };" +
    "})()");
}
/* 原生 confirm 已被预载脚本放行；自定义模态则点它的确认按钮 */
async function settleDeletion(ref) {
  return evalExpr("(async () => {" +
    "const gone = () => !document.querySelector('.mm-node[data-ref=\"" + ref + "\"]');" +
    "let modalSeen = false, modalClicked = 0;" +
    "for (let i = 0; i < 25 && !gone(); i++) {" +
    "  const modals = Array.from(document.querySelectorAll('dialog,[role=\"dialog\"],[class*=\"modal\"],[class*=\"dialog\"],[class*=\"confirm\"'))" +
    "    .filter(el => !el.hidden && el.offsetParent !== null);" +
    "  if (modals.length) modalSeen = true;" +
    "  for (const m of modals) {" +
    "    const btns = Array.from(m.querySelectorAll('button')).filter(b => b.offsetParent !== null);" +
    "    const yes = btns.find(b => /确|删除|确定|是|OK|DELETE/i.test(b.textContent || '') && !/取消|cancel|否/i.test(b.textContent || ''));" +
    "    if (yes) { yes.click(); modalClicked++; break; }" +
    "  }" +
    "  await new Promise(r => setTimeout(r, 120));" +
    "}" +
    "return { gone: gone(), modalSeen, modalClicked, native: window.__acceptNative ? Object.assign({}, window.__acceptNative) : null };" +
    "})()");
}
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

/* ====================== 结果框架 ====================== */
const results = {
  meta: {
    file: FILE, fileName: path.basename(FILE), out: OUT, mobile: MOBILE,
    viewport: VIEW.width + "x" + VIEW.height,
    httpPort: HTTP_PORT, cdpPort: CDP_PORT,
    startedAt: new Date().toISOString(),
    node: process.version
  },
  cases: {},
  summary: {}
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
      if (!/favicon|gpu|GPU|WebGPU|fallback/i.test(t)) out.push({ kind: "log.error", text: t });
    }
  }
  return out;
}
async function runCase(id, title, fn) {
  const entry = { id, title, checks: [], metrics: {}, screenshots: [], logs: [], pass: null };
  const t0 = Date.now();
  const mark = cdp.events.length;
  try {
    await setViewport(VIEW.width, VIEW.height, MOBILE);
    await fn(entry);
  } catch (e) {
    entry.error = String((e && e.message) || e);
  }
  entry.logs = logsSince(mark);
  entry.durationMs = Date.now() - t0;
  const errCount = entry.logs.filter(l => l.kind === "exception" || l.kind === "console.error").length;
  entry.pass = !entry.error && errCount === 0 && entry.checks.length > 0 && entry.checks.every(c => c.pass);
  results.cases[id] = entry;
  console.log((entry.pass ? "PASS" : "FAIL") + "  " + id + " " + title + (entry.error ? "  [error] " + entry.error : ""));
}
function check(entry, id, expect, actual, pass, note) {
  entry.checks.push({ id, expect, actual: actual === undefined ? null : actual, pass: !!pass, note: note || "" });
}

/* ====================== 用例实现 A1–A8 ====================== */
async function caseA1(e) {
  await evalExpr("localStorage.clear()");
  await seedAndReload("(() => ({ reload: true }))()");
  await waitForFrames(3);
  const m = await evalExpr(M_ENV);
  const tree = await evalExpr(M_TREE);
  e.metrics = { env: m, tree };
  check(e, "ready", "complete", m.readyState, m.readyState === "complete");
  check(e, "nodes", ">=20(.mm-node)", m.nodeCount, m.nodeCount >= 20);
  check(e, "branches", ">=18(.mindmap-branch)", tree.branchCount, tree.branchCount >= 18);
  check(e, "no-page-errors", "0", m.pageErrors.length, m.pageErrors.length === 0);
  e.screenshots.push(await screenshot("A1"));
}

async function caseA2(e) {
  const seedInfo = await evalExpr(SEED_50);
  await seedAndReload(SEED_50);
  const m = await evalExpr(M_TREE);
  e.metrics = { seed: seedInfo, tree: m };
  check(e, "nodes50", "50(数据节点)", seedInfo.nodes, seedInfo.nodes === 50);
  check(e, "titleLen30", "30字", seedInfo.titleLen, seedInfo.titleLen === 30);
  check(e, "visible", "51(50+虚拟根)", m.visible, m.visible >= 50);
  check(e, "overlap=0", "相邻卡片重叠对数=0", m.overlapPairs, m.overlapPairs === 0);
  check(e, "reverse=0", ".mindmap-branch 反向曲线数=0(起点x<终点x)", m.reverse, m.reverse === 0);
  check(e, "spine=0", "竖脊 path 数=0(bbox宽<20且高>40)", m.spine, m.spine === 0);
  e.screenshots.push(await screenshot("A2"));
}

async function caseA3(e) {
  await seedAndReload(SEED_BASIC);
  await ensureLinksDrawn(3);
  const s0 = await evalExpr(M_LINKS);
  await clickToggle("a1"); // 打卡 ON：a1 与联动 b1 完成，卡片增高/变宽
  await waitForFrames(3); await sleep(150);
  const s1 = await evalExpr(M_LINKS);
  e.screenshots.push(await screenshot("A3"));
  await clickToggle("a1"); // 再点取消
  await waitForFrames(3); await sleep(150);
  const s2 = await evalExpr(M_LINKS);
  e.metrics = { before: s0, afterOn: s1, afterOff: s2 };
  for (const [label, s] of [["afterOn", s1], ["afterOff", s2]]) {
    check(e, "drawn-" + label, "3条全部画出", s.drawn, s.drawn === 3);
    check(e, "maxdist-" + label, "端点到接驳边中点距离≤1.5px", s.maxDist, s.maxDist <= 1.5);
  }
  check(e, "no-missing-card", "连线端点卡片齐全", s1.per.filter(p => p.err).length + s2.per.filter(p => p.err).length, (s1.per.filter(p => p.err).length + s2.per.filter(p => p.err).length) === 0);
}

async function caseA4(e) {
  await seedAndReload(SEED_CYCLE);
  const m = await evalExpr(M_ENV);
  e.metrics.env = m;
  check(e, "ready", "complete", m.readyState, m.readyState === "complete");
  check(e, "no-white-screen", "body 文本>0 且节点≥3", m.bodyTextLen + "/" + m.nodeCount, m.bodyTextLen > 0 && m.nodeCount >= 3);
  check(e, "no-page-errors", "0", m.pageErrors.length, m.pageErrors.length === 0);
  // 页面可用：正常节点 nC 可打卡切换
  const t1 = await evalExpr("(() => {" +
    "const el = document.querySelector('.mm-node[data-ref=\"nC\"] .node-btn[data-toggle]');" +
    "if (!el) return { ok: false };" +
    "const before = el.classList.contains('done');" +
    "el.click(); return { ok: true, before };" +
    "})()");
  await waitForFrames(3); await sleep(150);
  const t2 = await evalExpr("(() => { const el = document.querySelector('.mm-node[data-ref=\"nC\"] .node-btn[data-toggle]'); return el ? el.classList.contains('done') : null; })()");
  const flipped = t1.ok && t2 !== null && t2 === !t1.before;
  check(e, "usable-toggle", "打卡状态可翻转", (t1.before + "→" + t2), flipped);
  e.screenshots.push(await screenshot("A4"));
}

async function caseA5(e) {
  await seedAndReload(SEED_BASIC);
  const open = await openCtxMenuOn("a1");
  const del = await clickMenuDelete();
  const settle = await settleDeletion("a1");
  await waitForFrames(3); await sleep(150);
  const m = await evalExpr("(() => {" +
    "const refs = new Set(Array.from(document.querySelectorAll('.mm-node[data-ref]')).map(el => el.dataset.ref));" +
    "const hits = Array.from(document.querySelectorAll('.mindmap-link-hit'));" +
    "const dangling = hits.filter(h => !refs.has(h.dataset.linkA) || !refs.has(h.dataset.linkB));" +
    "const links = document.querySelectorAll('.mindmap-link').length;" +
    "let stored = null;" +
    "try { const st = JSON.parse(localStorage.getItem('signin-tracker-v1') || '{}');" +
    "  const cat = (st.catalogs || []).find(c => c.id === st.currentCatalogId); stored = cat ? cat.links : null; } catch (err) {}" +
    "return { a1Gone: !refs.has('a1'), hitCount: hits.length, linkCount: links," +
    "  dangling: dangling.map(h => h.dataset.linkA + '-' + h.dataset.linkB), storedLinks: stored };" +
    "})()");
  e.metrics = { open, del, settle, after: m };
  check(e, "menu-open", "右键菜单打开", open.ok, open.ok);
  check(e, "delete-clicked", "删除动作已触发", del.ok, del.ok);
  check(e, "node-gone", "a1 已从 DOM 移除", m.a1Gone, m.a1Gone);
  check(e, "dangling-hit=0", "无悬空 .mindmap-link-hit", m.dangling.length, m.dangling.length === 0);
  check(e, "stored-links-clean", "localStorage 连线不含已删节点", m.storedLinks, Array.isArray(m.storedLinks) && !m.storedLinks.some(l => l.a === "a1" || l.b === "a1"));
  e.screenshots.push(await screenshot("A5"));
}

async function caseA6(e) {
  await setViewport(MOBILE_VP.width, MOBILE_VP.height, true);
  await seedAndReload(SEED_BASIC);
  // 场景：打卡切换 + 尝试删除带连线节点（基线会触发原生 confirm）
  await clickToggle("a2");
  await waitForFrames(3);
  const open = await openCtxMenuOn("a1");
  const del = open.ok ? await clickMenuDelete() : { ok: false, step: "menu-not-open" };
  const settle = del.ok ? await settleDeletion("a1") : null;
  await waitForFrames(2);
  const m = await evalExpr(M_ENV);
  e.metrics = { open, del, settle, env: m };
  check(e, "no-h-scroll", "scrollingElement.scrollWidth≤390", m.scrollWidth, m.scrollWidth <= 390);
  const n = m.native || { confirm: -1, alert: -1, prompt: -1 };
  check(e, "no-native-confirm", "window.confirm 调用数=0", n.confirm, n.confirm === 0);
  check(e, "no-native-alert", "window.alert 调用数=0", n.alert, n.alert === 0);
  check(e, "no-native-prompt", "window.prompt 调用数=0", n.prompt, n.prompt === 0);
  e.screenshots.push(await screenshot("A6"));
  if (!MOBILE) await setViewport(DESKTOP.width, DESKTOP.height, false); // 还原后续用例视口
}

async function caseA7(e) {
  await seedAndReload(SEED_BASIC);
  await ensureLinksDrawn(3);
  for (const target of [0.3, 1, 3]) {
    const s = await zoomTo(target);
    await waitForFrames(3); await sleep(150);
    const m = await evalExpr(M_LINKS);
    const tag = ("z" + String(Math.round(target * 100)).padStart(3, "0"));
    e.metrics[tag] = { targetScale: target, measuredScale: +s.toFixed(3), links: m };
    e.screenshots.push(await screenshot("A7-" + tag));
    check(e, "fit-" + tag, "缩放到达目标(±6%)", +s.toFixed(3) + "(目标" + target + ")", Math.abs(s - target) / target <= 0.061);
    check(e, "maxdist-" + tag, "端点贴合≤1.5px", m.maxDist, m.maxDist <= 1.5);
  }
}

async function caseA8(e) {
  const seedInfo = await evalExpr(SEED_50);
  await seedAndReload(SEED_50);
  const leaves = ["b1l0", "b2l0", "b3l0", "b4l0", "b5l0"];
  const rows = [];
  for (const id of leaves) {
    const row = await evalExpr("(async () => {" +
      "const el = document.querySelector('.mm-node[data-ref=\"" + id + "\"] .node-btn[data-toggle]');" +
      "if (!el) return null;" +
      "const t0 = performance.now();" +
      "el.click();" +
      "await new Promise(r => requestAnimationFrame(function () { requestAnimationFrame(r); }));" +
      "const t1 = performance.now();" +
      "return { id: '" + id + "', ms: +(t1 - t0).toFixed(1), dom: document.getElementsByTagName('*').length };" +
      "})()");
    if (row) rows.push(row);
    await sleep(60);
  }
  const totalMs = +rows.reduce((s, r) => s + r.ms, 0).toFixed(1);
  const domCounts = rows.map(r => r.dom);
  e.metrics = { seed: seedInfo, rows, totalMs, domCounts, domDelta: Math.max(...domCounts) - Math.min(...domCounts) };
  check(e, "toggles-done", "5 次打卡全部执行", rows.length, rows.length === 5);
  e.screenshots.push(await screenshot("A8"));
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
  L.push("# 思维导图应用 PHASE-B 验收报告");
  L.push("");
  L.push("- 被测文件：`" + m.file + "`");
  L.push("- 运行时间：" + m.startedAt + "（耗时 " + ((Date.now() - Date.parse(m.startedAt)) / 1000).toFixed(1) + "s）");
  L.push("- 视口：" + m.viewport + (MOBILE ? "（--mobile 全程移动视口）" : "（A6 单独使用 390×844 移动视口）"));
  L.push("- 环境：Node " + m.node + "，静态服务端口 " + m.httpPort + "，CDP 端口 " + m.cdpPort + "（服务与 Edge 均由工装自起自清，只按 PID 杀）");
  L.push("");
  L.push("## 结果总览");
  L.push("");
  L.push("| 用例 | 场景 | 结果 |");
  L.push("|---|---|---|");
  const titles = {
    A1: "加载默认树无异常", A2: "50节点+30字长标题布局", A3: "打卡后虚线端点贴合",
    A4: "环形JSON注入", A5: "删除带连线节点", A6: "移动端390×844", A7: "缩放0.3/1/3后贴合", A8: "50节点5次打卡性能"
  };
  for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]) {
    const c = results.cases[id];
    if (!c) continue;
    L.push("| " + id + " | " + titles[id] + " | " + (c.pass ? "✅ PASS" : "❌ FAIL") + " |");
  }
  L.push("");
  for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]) {
    const c = results.cases[id];
    if (!c) continue;
    L.push("## " + id + " " + c.title);
    L.push("");
    L.push("| 断言 | 预期 | 实际 | 结果 |");
    L.push("|---|---|---|---|");
    for (const k of c.checks) {
      L.push("| " + k.id + " | " + fmt(k.expect) + " | " + fmt(k.actual) + " | " + (k.pass ? "PASS" : "**FAIL**") + " |");
    }
    if (c.error) L.push("> 执行错误：`" + c.error + "`");
    const mm = c.metrics || {};
    if (id === "A3" || id === "A7") {
      const states = id === "A3"
        ? [["初始", mm.before], ["打卡后", mm.afterOn], ["取消后", mm.afterOff]]
        : Object.entries(mm).filter(([k]) => k.startsWith("z")).map(([k, v]) => ["缩放" + v.targetScale + "(实测" + v.measuredScale + ")", v.links]);
      for (const [label, s] of states) {
        if (!s) continue;
        L.push("");
        L.push("- **" + label + "**：画出 " + s.drawn + "/" + (s.linksTotal ?? "-") + " 条，端点最大偏差 " + s.maxDist + "px；逐条 " +
          (s.per || []).map(p => p.err ? p.err : (p.a + "-" + p.b + ":" + p.d0 + "/" + p.d1)).join("，"));
      }
    }
    if (id === "A2") {
      const t = mm.tree || {};
      L.push("");
      L.push("- 可见卡片 " + t.visible + "/" + t.nodeTotal + "，分支 " + t.branchCount + " 条，重叠对 " + t.overlapPairs +
        "，反向 " + t.reverse + "，竖脊 " + t.spine + (t.pairList && t.pairList.length ? "，重叠明细：" + t.pairList.join(" ") : ""));
    }
    if (id === "A8" && mm.rows) {
      L.push("");
      L.push("| 打卡 | 耗时ms | 其后 DOM 节点数 |");
      L.push("|---|---|---|");
      for (const r of mm.rows) L.push("| " + r.id + " | " + r.ms + " | " + r.dom + " |");
      L.push("");
      L.push("- 5 次连续打卡总耗时 **" + mm.totalMs + "ms**；DOM 节点数 " + mm.domCounts.join(" → ") +
        "（波动 " + mm.domDelta + "，无阈值判定，仅记录）");
    }
    if (id === "A6") {
      const env = (mm.env || {});
      L.push("");
      L.push("- scrollWidth=" + env.scrollWidth + "，innerWidth=" + env.innerWidth +
        "，原生弹窗计数=" + JSON.stringify(env.native) +
        "；删除尝试路径=" + JSON.stringify({ open: mm.open, del: mm.del, settle: mm.settle }));
      L.push("- 备注：**基线（未含 mobile-ux 修复）此处应 FAIL**——原生 confirm 被调用 1 次属任务说明的预期差异；" +
        "横向溢出（scrollWidth>390）是基线在 390 宽下的真实表现（页面固有最小宽超出视口），同属 mobile-ux 修复范围。两项在候选版都应转为 PASS。");
    }
    if (c.logs && c.logs.length) {
      L.push("");
      L.push("<details><summary>控制台错误/异常（" + c.logs.length + "）</summary>");
      L.push("");
      for (const l of c.logs.slice(0, 10)) L.push("- `[" + l.kind + "] " + l.text.slice(0, 300));
      L.push("");
      L.push("</details>");
    }
    if (c.screenshots && c.screenshots.length) L.push("");
    for (const s of c.screenshots) L.push("![" + s + "](" + s + ")");
    L.push("");
  }
  L.push("## 基线预期口径（重要）");
  L.push("");
  L.push("- A2 / A3 在 base.html（commit 3e873f2，已含分支曲线与虚线现算两项修复）**应 PASS**——它们是已修复回归项的守卫。");
  L.push("- A6 的「无原生 confirm/alert」断言在基线**应 FAIL**（删除仍走原生 confirm，调用 1 次）——mobile-ux 修好后应 PASS；这是预期差异，报告注明。");
  L.push("");
  return L.join("\n");
}

/* ====================== 主流程 ====================== */
let server = null, edge = null;
try {
  server = await startServer();
  edge = await startEdge();
  cdp = await cdpConnect();
  console.log("被测页面: " + PAGE_URL + "（服务=" + server.kind + "，Edge PID=" + edge.pid + "）");
  await navigate(PAGE_URL); // 先离开 about:blank，拿到 http 源（localStorage 可用）

  await runCase("A1", "加载默认树无异常", caseA1);
  await runCase("A2", "50节点+30字长标题：无重叠/无反向/无竖脊", caseA2);
  await runCase("A3", "打卡切换后虚线端点贴合(≤1.5px)", caseA3);
  await runCase("A4", "环形JSON(A→B→A)注入刷新不白屏", caseA4);
  await runCase("A5", "删除带连线节点后无悬空link-hit", caseA5);
  await runCase("A6", "390×844移动端：无横向滚动/无原生弹窗", caseA6);
  await runCase("A7", "缩放0.3/1/3后A3仍成立", caseA7);
  await runCase("A8", "50节点5次连续打卡耗时与DOM稳定性", caseA8);

  const ids = Object.keys(results.cases);
  results.summary = {
    total: ids.length,
    passed: ids.filter(i => results.cases[i].pass).length,
    failed: ids.filter(i => !results.cases[i].pass).map(i => i),
    note: "A2/A3 基线应 PASS（已修复回归项）；A6 原生弹窗断言基线应 FAIL（mobile-ux 未修）"
  };
  results.meta.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, "report.md"), buildReport());
  console.log("完成：" + results.summary.passed + "/" + results.summary.total + " PASS，FAIL=" + JSON.stringify(results.summary.failed));
  console.log("报告: " + path.join(OUT, "report.md"));
} catch (err) {
  console.error("[run.mjs] 主流程错误:", err && err.stack || err);
  process.exitCode = 1;
} finally {
  try { if (cdp && cdp.ws) cdp.ws.close(); } catch (e) {}
  try { await cleanup(); } catch (e) { console.error("[run.mjs] 清理错误:", e && e.message || e); }
  if (server && server.handle) { try { server.handle.close(); } catch (e) {} }
}
