/* C7-6 多目录切换：目录一 = 10 节点基础树（当前），目录二 = 4 节点小树。
 * 期望：点击侧栏第二目录后画布重绘为 4 节点树，currentCatalogId 同步落盘。 */
(() => {
  const catA = [
    { id: "p", name: "父节点", parentId: null, done: false, completedAt: "", note: "" },
    { id: "a", name: "子节点 A", parentId: "p", done: false, completedAt: "", note: "" },
    { id: "a1", name: "孙节点 A1", parentId: "a", done: false, completedAt: "", note: "" },
    { id: "a2", name: "孙节点 A2", parentId: "a", done: false, completedAt: "", note: "" },
    { id: "a3", name: "孙节点 A3", parentId: "a", done: false, completedAt: "", note: "" },
    { id: "b", name: "子节点 B", parentId: "p", done: false, completedAt: "", note: "" },
    { id: "b1", name: "孙节点 B1", parentId: "b", done: false, completedAt: "", note: "" },
    { id: "c", name: "子节点 C", parentId: "p", done: false, completedAt: "", note: "" },
    { id: "c1", name: "孙节点 C1", parentId: "c", done: false, completedAt: "", note: "" },
    { id: "c2", name: "孙节点 C2", parentId: "c", done: false, completedAt: "", note: "" }
  ];
  const catB = [
    { id: "q", name: "第二目录根", parentId: null, done: false, completedAt: "", note: "" },
    { id: "q1", name: "分支一", parentId: "q", done: false, completedAt: "", note: "" },
    { id: "q2", name: "分支二", parentId: "q", done: false, completedAt: "", note: "" },
    { id: "q3", name: "分支三", parentId: "q", done: false, completedAt: "", note: "" }
  ];
  const data = {
    treeVersion: 2, sidebarOpen: true, neurCrossHidden: true, catalogInserts: [], calendarOpen: false,
    catalogs: [
      { id: "cat_c7_a", name: "目录一", archVersion: 0, nodes: catA, links: [], linkDone: {} },
      { id: "cat_c7_b", name: "目录二", archVersion: 0, nodes: catB, links: [], linkDone: {} }
    ],
    currentCatalogId: "cat_c7_a"
  };
  localStorage.setItem("signin-tracker-v1", JSON.stringify(data));
  return { reload: true, a: catA.length, b: catB.length };
})()
