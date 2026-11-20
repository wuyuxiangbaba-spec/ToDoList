/* C7-8 环形 JSON：A 的父是 B，B 的父是 A；r/nC 为正常链 */
(() => {
  const nodes = [
    { id: "r", name: "正常根", parentId: null, done: false, completedAt: "", note: "" },
    { id: "nA", name: "环节点A", parentId: "nB", done: false, completedAt: "", note: "" },
    { id: "nB", name: "环节点B", parentId: "nA", done: false, completedAt: "", note: "" },
    { id: "nC", name: "正常子", parentId: "r", done: false, completedAt: "", note: "" }
  ];
  const data = {
    treeVersion: 2, sidebarOpen: true, neurCrossHidden: true, catalogInserts: [], calendarOpen: false,
    catalogs: [{ id: "cat_cycle", name: "环目录", archVersion: 0, nodes, links: [], linkDone: {} }],
    currentCatalogId: "cat_cycle"
  };
  localStorage.setItem("signin-tracker-v1", JSON.stringify(data));
  return { reload: true };
})()
