/* C6 根节点场景：默认目录 = 原始 23 节点 nmw 树（昆仑数模 + 上海大学两顶层）。
 * neurCrossHidden=false：让页面按真实用户路径自动补回 NeurCross 预置目录
 * （cat_neurcross_arch，494 节点），供 C6a 切换验证。 */
(() => {
  const nodes = [
    { id: "nmwiyegtzm0v4", name: "昆仑数模", parentId: null, done: false, completedAt: "", note: "" },
    { id: "nmwiyekmtshvg", name: "上海大学", parentId: null, done: false, completedAt: "", note: "" },
    { id: "nmwiyes47mg9k", name: "王静", parentId: "nmwiyegtzm0v4", done: false, completedAt: "", note: "" },
    { id: "nmwiyf1ofag9i", name: "G5二次开发", parentId: "nmwiyes47mg9k", done: false, completedAt: "", note: "" },
    { id: "nmwiyfd4n5bi5", name: "宋亦诚", parentId: "nmwiyekmtshvg", done: false, completedAt: "", note: "" },
    { id: "nmwiyfjkrrj1t", name: "有限元作业批改", parentId: "nmwiyfd4n5bi5", done: false, completedAt: "", note: "" },
    { id: "nmwiyg84eqd74", name: "基于标架场的全四边形动网格", parentId: "nmwiyfd4n5bi5", done: false, completedAt: "", note: "" },
    { id: "nmwiyh6f0uvi5", name: "上机作业@第三周", parentId: "nmwiyfjkrrj1t", done: false, completedAt: "", note: "" },
    { id: "nmwiyhe7ow45g", name: "上机作业@第四周", parentId: "nmwiyfjkrrj1t", done: false, completedAt: "", note: "" },
    { id: "nmwiyhi0un6d9", name: "代码", parentId: "nmwiyg84eqd74", done: false, completedAt: "", note: "" },
    { id: "nmwiyhmuh3kk8", name: "算例", parentId: "nmwiyg84eqd74", done: false, completedAt: "", note: "" },
    { id: "nmwiyhrdyz4x1", name: "文章本体", parentId: "nmwiyg84eqd74", done: false, completedAt: "", note: "" },
    { id: "nmwiyhvwukpr5", name: "PPT汇报", parentId: "nmwiyegtzm0v4", done: false, completedAt: "", note: "" },
    { id: "nmwiyi34z6iem", name: "昆仑的工作", parentId: "nmwiyhvwukpr5", done: false, completedAt: "", note: "" },
    { id: "nmwiyi6ogqspx", name: "科研工作", parentId: "nmwiyhvwukpr5", done: false, completedAt: "", note: "" },
    { id: "nmwkexync69fx", name: "G5输出三角形节点", parentId: "nmwiyf1ofag9i", done: false, completedAt: "", note: "" },
    { id: "nmwkey9gw84md", name: "程序读取节点", parentId: "nmwiyf1ofag9i", done: false, completedAt: "", note: "" },
    { id: "nmwkeyg24u5em", name: "G5读取四边形节点", parentId: "nmwiyf1ofag9i", done: false, completedAt: "", note: "" },
    { id: "nmwkezurhvevm", name: "读取三角形节点", parentId: "nmwiyhi0un6d9", done: false, completedAt: "", note: "" },
    { id: "nmwkf046xe2ip", name: "布置/光滑标架场", parentId: "nmwiyhi0un6d9", done: false, completedAt: "", note: "" },
    { id: "nmwkf08uatt86", name: "找奇异点", parentId: "nmwiyhi0un6d9", done: false, completedAt: "", note: "" },
    { id: "nmwkf0d77uxqr", name: "分块", parentId: "nmwiyhi0un6d9", done: false, completedAt: "", note: "" },
    { id: "nmwkf0i9b3ft6", name: "生成四边形网格", parentId: "nmwiyhi0un6d9", done: false, completedAt: "", note: "" }
  ];
  const data = {
    treeVersion: 2, sidebarOpen: true, neurCrossHidden: false, catalogInserts: [], calendarOpen: false,
    catalogs: [{ id: "cat_c6_dflt", name: "默认目录", archVersion: 0, nodes, links: [], linkDone: {} }],
    currentCatalogId: "cat_c6_dflt"
  };
  localStorage.setItem("signin-tracker-v1", JSON.stringify(data));
  return { reload: true, nodes: nodes.length };
})()
