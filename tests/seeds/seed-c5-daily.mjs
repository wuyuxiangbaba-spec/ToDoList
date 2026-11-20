/* C5 日历已删：存量数据同时含 dailyChecks（含一条过去日期补签记录）、
 * kind:"daily" 节点（孙节点 A1）与 calendarOpen:true。
 * 期望（改造后）：加载不报错；A1 按普通节点显示（无每日徽标）可勾选，
 * 勾选结果持久化到节点 done 字段（而非 dailyChecks）。 */
(() => {
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = iso(new Date());
  const past = iso(new Date(Date.now() - 9 * 86400000)); // 9 天前：合法的历史补签日期
  const nodes = [
    { id: "p", name: "父节点", parentId: null, done: false, completedAt: "", note: "" },
    { id: "a", name: "子节点 A", parentId: "p", done: false, completedAt: "", note: "" },
    { id: "a1", name: "孙节点 A1", parentId: "a", done: false, completedAt: "", note: "", kind: "daily" },
    { id: "a2", name: "孙节点 A2", parentId: "a", done: false, completedAt: "", note: "" },
    { id: "b", name: "子节点 B", parentId: "p", done: false, completedAt: "", note: "" },
    { id: "b1", name: "孙节点 B1", parentId: "b", done: false, completedAt: "", note: "" }
  ];
  const data = {
    treeVersion: 2, sidebarOpen: true, neurCrossHidden: true, catalogInserts: [], calendarOpen: true,
    catalogs: [{
      id: "cat_daily_seed", name: "日历存量目录", archVersion: 0,
      nodes,
      links: [],
      linkDone: {},
      dailyChecks: (function () {
        const dc = {};
        dc[past] = { a1: { done: true, at: past + "T08:00:00.000Z" } };
        return dc;
      })()
    }],
    currentCatalogId: "cat_daily_seed"
  };
  localStorage.setItem("signin-tracker-v1", JSON.stringify(data));
  return { reload: true, today, past };
})()
