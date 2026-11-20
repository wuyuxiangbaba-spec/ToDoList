#!/usr/bin/env node
/**
 * catalog-selfcheck.mjs —— 抽取 index.html 的 CATALOG-PURE 纯函数段做迁移自检
 * （对应 index.html 内注释「catalog-selfcheck.mjs 会抽取本段做迁移自检」）
 *
 * 用法：node tests/catalog-selfcheck.mjs [index.html路径]
 * 无浏览器依赖：只 new Function 求值纯函数段并做行为断言。
 * 覆盖：个人默认树恢复、dflt-→nmw 迁移、nmw/自建树保护、NeurCross 播种与
 * tombstone、旧单树/旧示例树路径、重复目录 id 去重。
 */
import fs from "node:fs";
import path from "node:path";

const file = process.argv[2] || path.join(process.cwd(), "index.html");
const html = fs.readFileSync(file, "utf8");
const m = html.match(/\/\* ==== CATALOG-PURE-START ====\s*\*\/([\s\S]*?)\/\* ==== CATALOG-PURE-END ====\s*\*\//);
if (!m) { console.error("FAIL: 未找到 CATALOG-PURE 段"); process.exit(1); }
const pure = m[1];
const api = new Function(pure + "\n;return { resolveCatalogState, resolveState, freshUserTreeState, DEFAULT_NODES };")();

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error("  FAIL:", msg); } };
const nmw = nodes => nodes.filter(n => String(n.id).startsWith("nmw")).length;
const dflt = n => ({ id: "dflt-x" + n, name: "模板" + n, parentId: n ? "dflt-x0" : null, done: false, completedAt: "" });

// 1) 个人默认树
{
  const t = api.freshUserTreeState();
  ok(api.DEFAULT_NODES.length === 23, "DEFAULT_NODES=23，实际 " + api.DEFAULT_NODES.length);
  ok(nmw(t.nodes) === 23, "freshUserTreeState 全 nmw");
  ok(t.nodes.some(n => n.name === "昆仑数模" && n.parentId === null), "顶层昆仑数模");
  ok(t.nodes.some(n => n.name === "上海大学" && n.parentId === null), "顶层上海大学");
  ok(t.nodes.some(n => n.name === "上机作业@第三周" && n.done === true && n.completedAt === "2026-11-17 16:10"), "完成态随树恢复");
}

// 2) 全 dflt- 目录 → 迁移回个人树；目录 id/name 保留
{
  const raw = JSON.stringify({
    treeVersion: 2, currentCatalogId: "cat_def",
    catalogs: [
      { id: "cat_def", name: "我改过名", nodes: Array.from({ length: 4 }, (_, i) => dflt(i)),
        links: [{ a: "dflt-x0", b: "dflt-x1" }], linkDone: { "dflt-x0": true } },
      { id: "cat_user", name: "用户目录", nodes: [{ id: "n123", name: "自建", parentId: null, done: false, completedAt: "" }], links: [], linkDone: {} }
    ]
  });
  const st = api.resolveCatalogState(raw);
  const def = st.catalogs.find(c => c.id === "cat_def");
  const usr = st.catalogs.find(c => c.id === "cat_user");
  ok(def.nodes.length === 23 && nmw(def.nodes) === 23, "全 dflt 目录迁移为 23 nmw");
  ok(def.name === "我改过名" && def.links.length === 0 && !def.linkDone["dflt-x0"], "目录名保留、links/linkDone 清空");
  ok(usr.nodes.length === 1 && usr.nodes[0].id === "n123", "用户目录原样保留");
  ok(st.currentCatalogId === "cat_def", "currentCatalogId 不变");
}

// 3) nmw 树 / 混合树 / 空目录：严禁覆盖
{
  const nodes = api.DEFAULT_NODES.map(n => ({ ...n }));
  nodes[2].name = "王静(导师)";
  const raw = JSON.stringify({ catalogs: [{ id: "cat_a", name: "默认目录", nodes, links: [], linkDone: {} }] });
  const st = api.resolveCatalogState(raw);
  ok(st.catalogs[0].nodes.length === 23 && st.catalogs[0].nodes[2].name === "王静(导师)", "改过的 nmw 树原样保留");
  const mixed = JSON.stringify({ catalogs: [{ id: "cat_b", name: "默认目录", nodes: [dflt(0), { id: "n9", name: "加的", parentId: null, done: false, completedAt: "" }], links: [], linkDone: {} }] });
  const st2 = api.resolveCatalogState(mixed);
  ok(st2.catalogs[0].nodes.length === 2, "dflt+自建混合目录不迁移（保守正确）");
  const empty = JSON.stringify({ catalogs: [{ id: "cat_c", name: "默认目录", nodes: [], links: [], linkDone: {} }] });
  const st3 = api.resolveCatalogState(empty);
  ok(st3.catalogs[0].nodes.length === 0, "空目录不播种");
}

// 4) NeurCross 播种 + 删除后不复活 + 存量兼容字段安静忽略
{
  const st = api.resolveCatalogState(JSON.stringify({ catalogs: [{ id: "cat_x", name: "默认目录", nodes: [dflt(0), dflt(1)], links: [], linkDone: {} }] }));
  ok(st.catalogs.some(c => c.name === "NeurCross" || c.id === "cat_neurcross_arch"), "NeurCross 自动播种");
  const st2 = api.resolveCatalogState(JSON.stringify({ neurCrossHidden: true, catalogs: [{ id: "cat_x", name: "默认目录", nodes: [dflt(0)], links: [], linkDone: {}, calendarOpen: true, dailyChecks: { "2026-01-01": {} } }] }));
  ok(!st2.catalogs.some(c => c.id === "cat_neurcross_arch"), "tombstone 尊重");
  const daily = [{ id: "n1", name: "旧每日", parentId: null, done: false, completedAt: "", kind: "daily" }];
  const st3 = api.resolveCatalogState(JSON.stringify({ catalogs: [{ id: "cat_d", name: "目录", nodes: daily, links: [], linkDone: {} }] }));
  ok(st3.catalogs[0].nodes[0].name === "旧每日" && st3.catalogs[0].nodes[0].done === false, "kind:daily 存量按普通节点兼容");
}

// 5) 无数据 / 旧单树路径 → 个人默认树
{
  const st = api.resolveCatalogState(null);
  ok(st.catalogs.length >= 1 && nmw(st.catalogs[0].nodes) === 23, "无数据回个人默认树");
  const old = JSON.stringify({ nodes: [{ id: "nmwiyegtzm0v4", name: "昆仑数模", parentId: null, done: true, completedAt: "2026-11-01 09:00" }], links: [], linkDone: {} });
  const st2 = api.resolveCatalogState(old);
  ok(st2.catalogs[0].nodes.some(n => n.id === "nmwiyegtzm0v4" && n.done), "旧单树迁移保留用户数据");
}

console.log(`catalog-selfcheck: ${pass} pass, ${fail} fail (${file})`);
process.exit(fail ? 1 : 0);
