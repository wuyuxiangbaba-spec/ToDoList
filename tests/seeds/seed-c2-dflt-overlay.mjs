/* C2 dflt 覆盖迁移：默认目录 = 完整 dflt- 模板（24 节点，合规模板期产物）
 * + 另一个用户新建目录。期望（改造后）：刷新后默认目录被迁移为 23 个 nmw 节点
 * （昆仑数模/上海大学），用户目录原样保留，currentCatalogId 不变。
 * neurCrossHidden=true：抑制 NeurCross 预置目录自动补回，保持目录数稳定便于断言。 */
(() => {
  const dfltNodes = [
    { id: "dflt-health", name: "健康作息", parentId: null, done: false, completedAt: "", note: "示例模板：把每天的身体状态拆成几件可勾选的小事" },
    { id: "dflt-health-sleep", name: "规律睡眠", parentId: "dflt-health", done: false, completedAt: "", note: "固定入睡与起床时间，帮助身体形成节律" },
    { id: "dflt-health-sleep-1", name: "23:00 前放下手机", parentId: "dflt-health-sleep", done: false, completedAt: "", note: "睡前半小时远离屏幕，更容易入睡" },
    { id: "dflt-health-sleep-2", name: "保持 7–8 小时睡眠", parentId: "dflt-health-sleep", done: false, completedAt: "", note: "醒来精神饱满即为合适的时长" },
    { id: "dflt-health-move", name: "适量运动", parentId: "dflt-health", done: false, completedAt: "", note: "低强度活动积累起来同样有效" },
    { id: "dflt-health-move-1", name: "快走或慢跑 30 分钟", parentId: "dflt-health-move", done: false, completedAt: "", note: "通勤步行也可以折算进来" },
    { id: "dflt-health-move-2", name: "睡前拉伸 10 分钟", parentId: "dflt-health-move", done: false, completedAt: "", note: "重点放松肩颈与腰背" },
    { id: "dflt-health-eat", name: "均衡饮食", parentId: "dflt-health", done: false, completedAt: "", note: "规律三餐，少油少糖" },
    { id: "dflt-health-eat-1", name: "按时吃早餐", parentId: "dflt-health-eat", done: false, completedAt: "", note: "为上午提供稳定精力" },
    { id: "dflt-health-eat-2", name: "足量饮水", parentId: "dflt-health-eat", done: false, completedAt: "", note: "少量多次，不必一次喝完" },
    { id: "dflt-learn", name: "学习提升", parentId: null, done: false, completedAt: "", note: "示例模板：输入与练习搭配，记录每天的学习节奏" },
    { id: "dflt-learn-read", name: "阅读输入", parentId: "dflt-learn", done: false, completedAt: "", note: "把阅读拆到页数或章节，更容易坚持" },
    { id: "dflt-learn-read-1", name: "阅读 20 页", parentId: "dflt-learn-read", done: false, completedAt: "", note: "纸质书或电子书都可以" },
    { id: "dflt-learn-read-2", name: "摘抄 3 句笔记", parentId: "dflt-learn-read", done: false, completedAt: "", note: "再写一句自己的理解更好" },
    { id: "dflt-learn-skill", name: "技能练习", parentId: "dflt-learn", done: false, completedAt: "", note: "固定时段专注练习一项技能" },
    { id: "dflt-learn-skill-1", name: "专注练习 25 分钟", parentId: "dflt-learn-skill", done: false, completedAt: "", note: "大约一个番茄钟的时长" },
    { id: "dflt-learn-skill-2", name: "整理练习记录", parentId: "dflt-learn-skill", done: false, completedAt: "", note: "每周复盘一次进度" },
    { id: "dflt-work", name: "工作效率", parentId: null, done: false, completedAt: "", note: "示例模板：先计划后执行，减少切换成本" },
    { id: "dflt-work-plan", name: "计划先行", parentId: "dflt-work", done: false, completedAt: "", note: "每天列出少量要事，优先完成" },
    { id: "dflt-work-plan-1", name: "早晨列出 3 件要事", parentId: "dflt-work-plan", done: false, completedAt: "", note: "完成后逐项打勾" },
    { id: "dflt-work-plan-2", name: "睡前核对清单", parentId: "dflt-work-plan", done: false, completedAt: "", note: "未完成项顺延到明天" },
    { id: "dflt-work-focus", name: "减少干扰", parentId: "dflt-work", done: false, completedAt: "", note: "保护整块的注意力时间" },
    { id: "dflt-work-focus-1", name: "专注时段静音通知", parentId: "dflt-work-focus", done: false, completedAt: "", note: "集中时段统一回复消息更高效" },
    { id: "dflt-work-focus-2", name: "单线程处理任务", parentId: "dflt-work-focus", done: false, completedAt: "", note: "减少多任务来回切换" }
  ];
  const userNodes = [
    { id: "u1", name: "我的项目", parentId: null, done: false, completedAt: "", note: "用户自建目录" },
    { id: "u1a", name: "需求梳理", parentId: "u1", done: false, completedAt: "", note: "" },
    { id: "u1b", name: "发布上线", parentId: "u1", done: false, completedAt: "", note: "" }
  ];
  const data = {
    treeVersion: 2, sidebarOpen: true, neurCrossHidden: true, catalogInserts: [], calendarOpen: false,
    catalogs: [
      { id: "cat_dflt_seed", name: "默认目录", archVersion: 0, nodes: dfltNodes, links: [], linkDone: {}, dailyChecks: {} },
      { id: "cat_user_seed", name: "用户目录甲", archVersion: 0, nodes: userNodes, links: [], linkDone: {}, dailyChecks: {} }
    ],
    currentCatalogId: "cat_dflt_seed"
  };
  localStorage.setItem("signin-tracker-v1", JSON.stringify(data));
  return { reload: true, dfltCount: dfltNodes.length, userCount: userNodes.length };
})()
