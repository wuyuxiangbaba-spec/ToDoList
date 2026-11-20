/* C4 折叠已删：存量数据里带 collapsed:true 的节点（子节点 A 有 3 个孩子）。
 * 期望（改造后）：折叠功能删除后该字段被忽略，A1/A2/A3 仍全部渲染可见。 */
(() => {
  const nodes = [
    { id: "p", name: "父节点", parentId: null, done: false, completedAt: "", note: "" },
    { id: "a", name: "子节点 A", parentId: "p", done: false, completedAt: "", note: "", collapsed: true },
    { id: "a1", name: "孙节点 A1", parentId: "a", done: false, completedAt: "", note: "" },
    { id: "a2", name: "孙节点 A2", parentId: "a", done: false, completedAt: "", note: "" },
    { id: "a3", name: "孙节点 A3", parentId: "a", done: false, completedAt: "", note: "" },
    { id: "b", name: "子节点 B", parentId: "p", done: false, completedAt: "", note: "" },
    { id: "b1", name: "孙节点 B1", parentId: "b", done: false, completedAt: "", note: "" }
  ];
  const data = {
    treeVersion: 2, sidebarOpen: true, neurCrossHidden: true, catalogInserts: [], calendarOpen: false,
    catalogs: [{ id: "cat_fold", name: "折叠存量目录", archVersion: 0, nodes, links: [], linkDone: {} }],
    currentCatalogId: "cat_fold"
  };
  localStorage.setItem("signin-tracker-v1", JSON.stringify(data));
  return { reload: true, collapsedOn: "a", children: ["a1", "a2", "a3"] };
})()
