(() => {
  const mk = (id, name, parentId, done, note) => ({ id, name, parentId, done: !!done, completedAt: done ? "2026-11-20 09:00" : "", note: note || "" });
  const nodes = [
    mk("p", "父节点", null, false),
    mk("a", "子节点 A", "p", false),
    mk("a1", "孙节点 A1", "a", true),
    mk("a2", "孙节点 A2", "a", false, "带一段说明文字的节点"),
    mk("a3", "孙节点 A3", "a", false),
    mk("b", "子节点 B", "p", false),
    mk("b1", "孙节点 B1", "b", false),
    mk("c", "子节点 C", "p", false),
    mk("c1", "孙节点 C1", "c", true),
    mk("c2", "孙节点 C2", "c", false)
  ];
  localStorage.setItem("signin-tracker-v1", JSON.stringify({
    treeVersion: 2, sidebarOpen: false, neurCrossHidden: true, catalogInserts: [],
    catalogs: [{ id: "cat_test", name: "测试目录", archVersion: 0, nodes, links: [], linkDone: {} }],
    currentCatalogId: "cat_test"
  }));
  return { reload: true };
})()