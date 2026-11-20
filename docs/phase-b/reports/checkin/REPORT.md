# REPORT — checkin：日历 ↔ 任务打卡 双模式数据模型

工作文件：`b\checkin\checkin.html`（基线 `base.html`，commit 3e873f2 快照）
端口：静态服务 8802（服务 `.mindmap-test` 根，`/base.html` 与 `/b/checkin/checkin.html` 同源可达）；无头 Edge CDP 9432。
驱动：复制改造 `shot.mjs`（`CDP_PORT=9432`），种子与测量脚本均在本目录（seed-*.js / measure-*.js）。

---

## 一、改了什么 / 为什么

基线版本**没有日历**（全文件无任何日历/选日 UI，"日历只是摆设"的前提在 base.html 上不成立），
因此本任务实际交付 = 新建日历面板 + 双模式数据模型，并保证存量数据（无 kind / 无 dailyChecks）
加载后**逐字节一致**的渲染与行为（见验收 d）。

| 模块 | 改动 |
|---|---|
| 数据模型（纯函数区） | 节点新增可选 `kind: "once" \| "daily"`（默认 once）；目录新增 `dailyChecks`；根状态新增 `calendarOpen` |
| normalize | `normalizeDailyChecks` + `isValidDateStr`：非法日期/不存在节点/非 daily 叶子/脏形状全部清洗；分支上的 daily 防御性降级 once |
| 右键菜单 | 新增「设为每日打卡 / 改为长期任务」（叶子可用；分支禁用；根隐藏，与改名/说明等菜单项同策略） |
| 交互 | daily 叶子点击 = 在**选中日期**打卡/取消（过去补签、未来禁止 + toast）；once 的 done/completedAt/links/linkDone 逻辑零改动（批量切换/连线联动跳过 daily 叶子） |
| 日历面板 | 右侧可收起面板：月视图、格内 n/m、全完实心强调色、完成率热力（--accent rgba 0.05→0.37→实心）、今天内描边高亮、选中日外框、‹›翻月 |
| 统计 | 面板内「连续打卡 Streak / 今日完成率 / 选中日完成度」；侧栏底部迷你条（仅存在 daily 任务时挂载） |
| 存量兼容 | `calendarOpen` 默认 false（首屏与旧版一致）；mini-stats 动态挂载；nodeBtnHtml 对 once 节点输出与基线逐字节相同 |

## 二、新数据结构与迁移规则

### 1) 节点：`nodes[].kind`
- 取值 `"once"`（默认）或 `"daily"`。存量数据无此字段 → `normalizeState` 一律补 `"once"`，行为不变。
- **daily 只允许叶子**：根（虚拟节点）/ 分支在菜单层禁用；若 daily 叶子后来长出子节点
  （新增分支、拖入子节点后保存），保存路径与下次加载的 `normalizeCatalog` 都会把它降回 `once` 并视为其按日记录失效。
- `kind` 是纯增量字段：旧版本代码读不到它也不会出错（多余字段被忽略）。

### 2) 目录：`catalogs[].dailyChecks`
```json
{
  "catalogs": [{
    "id": "cat_x", "name": "…", "nodes": [...], "links": [...], "linkDone": {},
    "dailyChecks": {
      "2026-11-19": { "<daily叶子的nodeId>": { "done": true, "at": "2026-11-19T09:30:00.000Z" } }
    }
  }]
}
```
- 键 `dateStr`：**浏览器本地时区** `YYYY-MM-DD`（`todayIso()` 用本地 `getFullYear/getMonth/getDate` 拼接，不写死任何时区）。
- `at`：打卡时刻的 ISO 串（`new Date().toISOString()`，UTC）；展示时转本地墙上时间。
- 记录只在 `done:true` 时存在；**取消打卡即删除该条**（不存 false），空日期键随保存清理。
- 每个目录独立记账；once 节点的 `done/completedAt` 与 `links/linkDone` 完全不参与该结构。

### 3) normalize 清洗规则（`normalizeDailyChecks`，每次加载执行）
丢弃：非 `YYYY-MM-DD` 键（含 `2026-1-5`）、不存在日历日（`2026-02-30`、`2026-13-40`）、
记录值非对象（字符串/null）、nodeId 不存在、nodeId 已非 daily 叶子、`done !== true` 的条目；
清洗后为空的日期键整键删除。清洗只发生在内存态，首次保存后写回即完成迁移（无损：合法记录全保留）。

### 4) 根状态：`calendarOpen`
布尔，默认 `false`；面板开合即保存。其余字段（treeVersion/sidebarOpen/catalogInserts/neurCrossHidden…）不变。

### 5) 导入/导出
基线本就没有 JSON 导入/导出功能（无 备份/恢复/Blob/download 代码），持久化即 localStorage，
新字段随 `save()` 的 `JSON.stringify(state)` 自然序列化——无需额外适配。

## 三、验收结果（CDP 数值）

### a) 两个 daily 任务，D1 打 1 个、D2 打 2 个 → 两日记录互相独立 — **PASS**
路径：`seed-daily.js`（4 个 once 节点）→ 右键菜单真实 UI 把 d1/d2 设为 daily → 选日打卡。
- D1=2026-11-19（昨天）、D2=2026-11-20（今天）
- `localStorage.dailyChecks["2026-11-19"]` = `["d1"]`；`["2026-11-20"]` = `["d1","d2"]` → 互相独立
- `at` 匹配 `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}`（ISO）→ true
- 菜单标签「设为每日打卡」、`disabled=false`（两次均生效）
（证据：measure-ab.js 输出，shot-ab.png）

### b) 切回 D1 界面只显示 1/2 — **PASS**
- D1 格子 `.cal-frac` = `"1/2"`，D2 格子 = `"2/2"`；D1 格有 `selected` 类
- d1 按钮有 `done` 类、d2 无（按 D1 视图）
- once 节点 o1 在 D2 打卡后切回 D1 仍为 done（切日期不影响 once）→ true
（证据：measure-ab.js）

### c) Streak：3 天全完 + 今天未完 = 3 — **PASS**
`seed-streak.js`：昨天/前天/大前天 2/2 全打、今天 0/2：
- 面板「连续打卡 Streak」= `"3 天"`，今日完成率 `"0%"`
- 补打今天 2 个后：Streak = `"4 天"`、今日 `"100%"`、今天格 `.full` 且 computed bg = `rgb(31, 107, 74)`（--accent）
口径：以「当前目录 daily 任务**全部完成**」为一天完成；今天未全完不断链（从昨天起算）；无 daily 任务恒 0；回看上限 730 天。
（证据：measure-streak.js，shot-streak.png）

### d) 存量（无 kind 字段）行为与基线一致 — **PASS**
同用 `seed-basic.js` 分别加载 `checkin.html` 与 `base.html`：
- `#catTree.innerHTML` **逐字节相同**（35003 = 35003 字符，时间戳归一化后）
- 侧栏底部 innerHTML 相同（mini-stats 在无 daily 时不挂载，DOM 不出现）
- 节点数 11 = 11；点击 a 完成/取消、存储 done 值、sidebarOpen 全部一致
- 两侧 console 均无错误/异常
- 截图：shot-baseline-checkin.png vs shot-baseline-base.png
（唯一可见差异：右上角固定定位的「日历」入口按钮，不占布局空间——这是功能入口，属预期新增）

### e) 环形/脏 dailyChecks 不崩 — **PASS**
`seed-dirty.js` 注入 7 类脏数据（非法月日、不存在的日历日、非日期键、非零填充、幽灵节点、非对象记录、空键）：
- 页面正常渲染（4 节点 / 30 日历格），无异常日志
- 触发一次保存后 localStorage 仅剩 `{"2026-11-19","2026-11-20"}`，昨日记录只留 `d1`（ghost/p/done:false 全清）
- 打卡/取消继续可用（today_after_click="d1"，取消后清空）
（证据：measure-dirty.js，shot-dirty.png）

### 附加验证（均 PASS）
- **热力梯度**：0% → `rgba(31,107,74,0.05)`，50% → `rgba(31,107,74,0.21)`，100% → 实心 `rgb(31,107,74)`（measure-heat.js，shot-heat.png）
- **菜单状态机**：叶子=「设为每日打卡」可用；daily=「改为长期任务」且点击后清空全部按日记录；分支=disabled；根=hidden（measure-kind.js，shot-menu.png）
- **面板开合**：默认收起、rail 可见；展开后 251px、舞台 1439→1187、持久化 `calendarOpen:true`；再收起恢复（measure-panel*.js，shot-panel*.png）
- **daily 叶子加子分支**：kind 自动降回 once、按日记录清空、徽标消失（measure-addchild.js，shot-addchild.png）
- **未来日期**：选明天点 daily → toast「未来日期不能提前打卡」且无记录写入（measure-ab.js 末段）
- 语法：抽取内联 `<script>` 过 `node --check` 通过；纯函数区抽取后 Node 直跑清洗/迁移自检通过

## 四、截图清单（本目录）
shot-ab.png（验收 a/b 终态：D1 选中 1/2 + 双 daily 徽标）· shot-streak.png（热力月格 + Streak）·
shot-heat.png（0%/50% 渐变对比）· shot-menu.png（右键菜单）· shot-dirty.png（脏数据清洗后）·
shot-panel.png / shot-panel-open.png（面板收起/展开）· shot-addchild.png（daily 降级 once）·
shot-baseline-checkin.png / shot-baseline-base.png（存量基线对比）

## 五、已知风险与未做部分
1. **Streak 口径按「当前任务集」**：今天新加一个 daily 任务会让昨天的"全完"变成 2/3 → Streak 归零重算。这是「以选中目录 daily 任务全部完成为口径」的固有语义，已在实现注释与本报告注明；未做按历史任务集快照的精算。
2. **日历仅月视图**：无周/年视图；跨月补签需 ‹› 翻月（选中日期不限当月）。
3. **分支含 daily 叶子时**：分支的完成态（含目录 logo 的 x/y 统计 `catalogDoneStats`）永远差 daily 叶子——长期任务语义上"永远做不完"，故意不计入一次性全完；点击该分支批量切换只作用于 once 叶子（纯 once 树与原逻辑等价，已回归）。
4. **daily 节点不参与连线联动**（连线是 once 概念）：daily↔daily 或 daily↔once 连线可以建立，但完成态不沿边传播。
5. `completedAt` 显示时区沿用基线的上海墙上时间（once），daily 的 `at` 显示用浏览器本地时间——两套各自正确，混合目录下时间戳口径不同（与基线兼容优先）。
6. 删除目录/节点会连带删 dailyChecks（含 normalize 兜底）；旧单树格式（无 catalogs）迁移进"默认目录"时 dailyChecks 为空 {}（旧格式本就没有该数据）。
7. 未做：日历格直接右键批量补签、Streak 历史任务集精算、导入导出（基线无此功能）。
