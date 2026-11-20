# canvas.html 画布控制能力 — REPORT（canvas-controls）

工作文件：`.mindmap-test/b/canvas/canvas.html`（基于 base.html，commit 3e873f2 快照）
补丁：`canvas.patch`（`git diff --no-index -- base.html b/canvas/canvas.html`，退出码 1 属正常）
测试环境：静态服务 127.0.0.1:8804（python PID 15376）、无头 Edge CDP 127.0.0.1:9434（PID 66156），结束均按 PID Stop-Process。
驱动：本目录 `cdp.mjs`（shot.mjs 改造，支持 setup/eval/wait/shot/measure 步骤），场景 `steps-*.json`，原始数值 `out-*.json`。

## 一、改了什么、为什么

### 1. 悬浮工具条（画布右下角、竖排）
- 新增 `#canvasToolbar`（role=toolbar，aria-orientation=vertical）：放大 `#zoomInBtn`、缩小 `#zoomOutBtn`、缩放百分比 `#zoomLabelBtn`（点击回 100%）、一键适应 `#fitViewBtn`（复用 `applyFitView`）、全部展开 `#expandAllBtn`。图标为内联 SVG，均带 `aria-label` + `title`（tooltip）。
- 新增 `zoomTo(next, mx, my)` / `zoomAtCenter(next)`：与滚轮缩放同一套「pan 在 scale 之前」的锚点数学，工具条以舞台中心为锚；`updateZoomLabel()` 挂进 `applyPan()`，百分比随每次平移/缩放刷新（值不变则不写 DOM）。
- 几何验证：工具条右/底缘距舞台右下角各 16px，flex-direction=column，5 按钮齐全（steps-geom.json 运行结果）。

### 2. 节点折叠/展开
- 数据：节点可选字段 `collapsed`（`normalizeState` 透传 `collapsed: n.collapsed === true`）；存量数据无字段 = 展开，不动 treeVersion、不做任何迁移；旧格式（无 catalogs）加载验证通过。
- 渲染：`buildMindData` 里折叠分支的 `children` 剪空 → 子树**不进 allNodes/cardRects/edges**（不是标 hidden），分支色带不画；指向子树内节点的任务连线因 `rectByRef.get` 找不到端点自动不画（updateViewport 原有兜底，未改）。
- 交互：分支节点胶囊左侧新增小圆箭头 `button.node-fold[data-fold]`（▸ 折叠后 / ▾ 展开中，aria-expanded 同步）；`catTree` click 最前面拦截，`toggleCollapse` → `save()` → `renderTree()`，不触发打卡/连线逻辑。
- 徽章：折叠后父节点右侧显示 已完成数/总数（`subtreeDoneStats`，与 `catalogDoneStats` 同为 nodeDone 递归派生口径）；全完加 `all-done`（绿实线），否则红虚线。
- 「全部展开」= `expandAllCollapsed()`；拖拽挂到折叠分支、向折叠分支新增子节点时自动展开，防止新内容不可见。

### 3. 搜索与筛选（会话内状态，不持久化）
- 顶部展开式搜索框 `#canvasSearch`：默认只露放大镜按钮，聚焦/有内容时 width 0→168px 过渡展开；`#searchInput` 输入即过滤，`#searchCount` 显示「N 处」（aria-live）。
- 匹配文本 = 名称+说明（`searchText` 小写，写入 `data-search`）；命中 `search-hit`（绿描边），其余 `search-dim`（0.22）；`applySearchFilter()` 只切 class，不动布局与 viewport 虚拟化，`renderTree` 重建 DOM 后自动重放。
- 「只看未完成」`#undoFilterBtn`（aria-pressed）：已完成的**叶子**淡化（`done-dim`，0.16），分支照常（按真实 leafKind 判定，折叠分支不算叶子）。Esc 清空搜索。

### 4. 长文本防重叠回归修复（基线潜在 bug）
- 现象：自建 57 节点、8 个 30+ 字长标题的树，基线 base.html 出现 6 对相邻同层卡片重叠（均为「带说明小字的叶子 X_3」压到「下一张卡 X_4」，out-baseref.json）。
- 根因：`rowH = btnH + extra` 只保证内容总高，但 `stackY` 让节点以 rowH/2 **居中**，说明/完成时间只向下悬垂 → 悬垂内容伸出本行底缘（约 6px）压到下一行卡片。
- 修复：行高测量记录 `n.btnH` 与 `n.belowH`（胶囊下方悬垂高度，按 param/std 与 time/note 组合取精确 gap）；`stackY` 叶子改为**顶对齐**（y = yStart + btnH/2，悬垂落在本行内）；分支保持居中但 span ≥ btnH + 2×belowH。shiftBlocked/ROUTE_GAP 动态列距未动、仍生效（badDirs=0）。

## 二、动过的函数清单（供主代理集成）

| 位置 | 函数/成员 | 改动 |
|---|---|---|
| CSS | `.tree-card` | +position:relative（承载两个悬浮层） |
| CSS | `.canvas-search` 族、`.mm-node.search-hit/.search-dim/.done-dim`、`.node-fold(.collapsed)`、`.node-fold-badge(.all-done)`、`.canvas-toolbar` 族 | 新增 |
| HTML | `.tree-card` 内 | +`#canvasSearch`（searchToggleBtn/searchInput/searchCount/undoFilterBtn）与 `#canvasToolbar`（zoomInBtn/zoomOutBtn/zoomLabelBtn/fitViewBtn/expandAllBtn） |
| 纯函数区 | `normalizeState` | 节点映射 +`collapsed: n.collapsed === true`（可选字段，向后兼容） |
| JS | `subtreeDoneStats(node)` | **新增**（折叠徽章统计） |
| JS | `buildMindData`/`buildNode` | 折叠剪枝（children=[]）、拼 node-fold 按钮 + node-fold-badge、+`searchText` |
| JS | `renderTree` | .mm-node 模板 +`data-search`；innerHTML 后调 `applySearchFilter()`；行高测量 +`n.btnH/n.belowH`；`stackY` 叶子顶对齐、分支 span 预留；edge 记 `e.x1/e.x2` |
| JS | `updateViewport` | .mindmap-branch path +`data-x1/data-x2`（仅断言用，不参与绘制） |
| JS | `applyPan` | +`updateZoomLabel()` |
| JS | CANVAS-CONTROLS 块 | **新增** `toggleCollapse`、`expandAllCollapsed`、`applySearchFilter`、`updateSearchCount`、`zoomTo`、`zoomAtCenter`、`updateZoomLabel`（含 lastZoomPct） |
| JS | `catTree` click 监听 | 开头 +`button[data-fold]` 拦截分支 |
| JS | `closeEditor`（add 模式） | 父节点折叠时自动展开 |
| JS | `catTree` drop 监听 | 拖入折叠分支时自动展开 |
| JS | 脚本尾 | **新增** 工具条/搜索事件绑定；`render()` 后 `updateZoomLabel()` |

未改动：resolveState/迁移逻辑、viewport 虚拟化（worldViewRect/nodeInView/updateViewport 主体）、分支贝塞尔（cubicRibbon/中点公式）、连线路由（ROUTE-LIB）、目录侧栏。

## 三、验收证据（CDP 数值，视口 1440×900）

### A. 折叠/展开（steps-collapse.json → out-collapse.json）
| 项 | 预期 | 实际 | 判定 |
|---|---|---|---|
| 初始 .mm-node | 12（11 节点+虚拟根） | 12 | PASS |
| 折叠 3 个子节点(A/B/C)后 .mm-node | 减少 | **5**（root+p+A+B+C） | PASS |
| 徽章文本 | 3/5 | A=**3/5**、B=3/3、C=0/2 | PASS |
| 全完绿色 | B 子树全完成 → all-done | greens=[false,**true**,false] | PASS |
| localStorage 持久化 | A/B/C collapsed=true | collapsedIds=[A,B,C] | PASS |
| 刷新后仍折叠 | 仍 5、徽章不变 | mm=5，badges=[3/5,3/3,0/2] | PASS |
| 全部展开 | 恢复 12、徽章清空 | mm=12，badges=0，collapsedIds=[] | PASS |
| 分支 path 数 | 只画可见父子边 | 折叠后 branchPaths=4 | PASS |

### B. 连线与折叠交互（steps-compat.json，seed-basic.js 种子）
| 项 | 实际 | 判定 |
|---|---|---|
| 折叠前 | mm=11，links=3（a1-b1/a2-c1/a3-c2） | PASS |
| 折叠 a 后 | mm=8，**links=0**（3 条线端点均在折叠子树内 → 不画），badge=0/4 | PASS |
| 重新展开 | mm=11，links=3 恢复 | PASS |

### C. 搜索与筛选（steps-search.json → out-search.json）
| 项 | 预期 | 实际 | 判定 |
|---|---|---|---|
| 搜索 xyz 高亮数 | 3（s1、s2 名称，s3a 说明） | hits=[s1,s2,s3a]，**hitCount=3**，count=「3 处」 | PASS |
| 其余淡化 | 10-3=7 | dims=7 | PASS |
| 只看未完成 | 已完成叶子淡化、分支照常 | doneDims=[s4a,s4b]，s4Dimmed=false | PASS |
| 清空关键词 | 0/0 | hitCount=0，dims=0（开关独立保留） | PASS |
| 刷新不持久化 | 输入空、开关复位 | inputValue=""，undoPressed="false" | PASS |

### D. 缩放工具条（steps-bigtree.json → out-bigtree.json）
| 操作 | scale 实际 | 标签 | 判定 |
|---|---|---|---|
| 初始（自动 fit） | 0.660363 | 66% | PASS |
| 点击 + | 0.792436（=0.6604×1.2） | 79% | PASS |
| 点击 − | 0.660363 | 66% | PASS |
| 点击百分比 | 1.0 | 100% | PASS |
| 点击适应画布 | 0.660363（applyFitView） | 66% | PASS |

### E. 50+ 节点防重叠回归（57 节点 + 虚拟根 = 58 .mm-node，8 个 30+ 字长标题）
| 指标 | 基线 base.html | 修改后 | 判定 |
|---|---|---|---|
| 重叠对数（两两卡片盒相交>0.5px） | **6**（b1_3&b1_4 等） | **0** | PASS |
| 相邻同层 bottom>next.top 违规 | 6 | **0** | PASS |
| 反向曲线（data-x1<x2） | —（基线无该属性） | 57/57 全 x1<x2，badDirs=0 | PASS |
| d 属性起点 x < 终点 x（解析 d 首点 vs 最大 x） | dParseBad=0 | dParseBad=0 | PASS |
| 缩放往返后再测 | — | overlapPairs=0 保持 | PASS |

### F. 兼容性
- 旧格式数据（无 catalogs、无 collapsed 字段）：加载正常（mm=3，全展开，1 个折叠按钮），console 无错误。
- 全部场景 console/exception 日志均为空（logs=[]）。

截图（本目录）：shot-toolbar.png（工具条+搜索框全景）、shot-collapse.png / shot-after-reload.png（折叠徽章 3/5、3/3 绿）、shot-expand-all.png、shot-search.png（xyz 高亮+淡化）、shot-undo-filter.png、shot-bigtree-fit.png（50+ 节点 fit）、shot-zoom-in.png。

## 四、已知风险与未做部分

1. **徽章与目录插入 logo 并存**：两者都绝对定位在胶囊右侧（badge left:calc(100%+6px)，logo left:calc(100%+5px)），同一节点折叠且又挂目录标识时会视觉相叠。本任务场景未同时出现；集成方如需并存可把 .node-catalog-logos 再右移一位。
2. **搜索不自动展开折叠分支**：命中只统计当前渲染树（折叠子树内不显示、不计数）。需要全树搜索先点「全部展开」。有意取舍：避免搜索隐式改持久化状态。
3. **只看未完成选了「淡化」而非「隐藏」**（任务允许二者之一）：不动布局与虚拟化，规避重排/连线端点缺失问题。
4. **stackY 修复改变叶子垂直对齐**（顶对齐替代居中）：树整体更紧凑、总高度略有变化；分支仍居中。57 节点回归全绿，NeurCross 大树未单独目测。
5. 徽章统计口径 = 子树全部节点（含分支）按 nodeDone 派生，与目录统计 catalogDoneStats 一致；若想只数叶子需另改。
6. 未做：搜索命中自动平移进视野、移动端双指手势、折叠动画过渡。
