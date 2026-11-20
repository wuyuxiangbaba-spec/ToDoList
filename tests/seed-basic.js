(() => {
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
      id: "cat_test", name: "测试目录", archVersion: 0,
      nodes,
      links: [{ a: "a1", b: "b1" }, { a: "a2", b: "c1" }, { a: "a3", b: "c2" }],
      linkDone: {}
    }],
    currentCatalogId: "cat_test"
  };
  localStorage.setItem("signin-tracker-v1", JSON.stringify(data));
  return { reload: true };
})()