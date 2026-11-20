# undo — 撤销 / 重做（历史栈）实现报告

工作文件：`b/undo/undo.html`（基线 = base.html，commit 3e873f2）
交付物：`undo.html`、`undo.patch`（8,881 字节）、本报告、截图 9 张、`evidence.json`（CDP 数值证据全文）

---

## 一、改了什么、为什么

### 1. 历史栈引擎（核心新增，约 80 行）
位置：脚本内 `state` 定义之后，独立成节「撤销 / 重做（历史栈）」。

- **快照口径**：一次用户操作完成后「最终 state」的 JSON 深拷贝（以字符串形式入栈，比较与恢复都直接用字符串）。
- **栈深**：`HISTORY_MAX = 31` = 基线快照 + 30 步操作，超出丢最旧（`shift()`）。满栈时可撤销 30 步，满足「栈深至少 30 步」。
- **索引模型**：`historyStack[historyIndex]` 恒等于当前状态。新操作先截断重做分支（`slice(0, index+1)`）再入栈——标准的 undo/redo 语义。
- **去重**：入栈前与栈顶字符串比较，相同则跳过（覆盖「拖拽落回原父节点」「同值提交改名」这类无实际变化的 save，保证一次操作 = 一步历史）。

### 2. snapshot() / restore() 设计（任务书要求写清的一对）

```js
function snapshotState() {
  // replacer 返回 undefined 的键不写入 JSON：把 sidebarOpen（纯视图状态）排除出历史
  return JSON.stringify(state, (k, v) => (k === "sidebarOpen" ? undefined : v));
}
function restoreSnapshot(json) {
  const keepSidebarOpen = state.sidebarOpen;
  Object.assign(state, JSON.parse(json));   // 只回写数据字段
  state.sidebarOpen = keepSidebarOpen;
  if (!currentCatalog()) state.currentCatalogId = state.catalogs[0].id; // 防御
}
```

**关于任务书里的 getter 问题（实测回答）**：任务书问「JSON.parse(JSON.stringify(state)) 会拿到 getter 值吗？——会的」。**实测结论：不会，但快照仍然完整**。`state` 上的 `nodes/links/linkDone` 是 `Object.defineProperties` 定义的**不可枚举**访问器（base.html 原注释也写明「getters 不可枚举，不会写入 JSON」），`JSON.stringify` 只序列化可枚举自有属性，所以快照 JSON 里**没有**这三个键（evidence: `snapshotKeys = [catalogInserts, catalogs, currentCatalogId, neurCrossHidden, treeVersion]`）。但它们的底层数据本来就存放在 `state.catalogs[i].nodes/links/linkDone` 里，随整份 JSON 一起被深拷贝——快照内容是完整的。

**恢复时如何写回**：不替换 `state` 对象、不重定义访问器。`Object.assign(state, JSON.parse(json))` 只回写 `catalogs / currentCatalogId / catalogInserts / neurCrossHidden / treeVersion` 这五个数据字段（快照里根本没有 `nodes/links/linkDone` 键，所以不会碰访问器）；访问器动态读取 `state.catalogs`，自然指向恢复后的当前目录——等效于「刷新了 getter」。实测证据（evidence `phaseF_restoreMechanics`）：撤销后 `state.nodes === 当前目录.nodes`、`state.links === 当前目录.links`、`state.linkDone === 当前目录.linkDone` 全为 true，且 `nodes` 仍是 get+set 访问器（enumerable=false）。

### 3. 入栈钩子：save() 本身
`save(recordHistory)` 增加可选参数，默认入栈：所有会调用 `save()` 的数据变更入口自动成为一步历史，无需逐处埋点。撤销/重做自身与侧栏折叠/展开传 `false`（前者避免自我嵌套，后者是任务书规定的「折叠不算变更」——本代码库里唯一的「折叠」就是目录侧栏收起/展开）。

### 4. 快照时机清单（哪些入口入了栈）

| # | 入口 | 操作 | 入栈 |
|---|---|---|---|
| 1 | `addLinkBetween`（addLink 后 save） | 连线新增（含联动完成） | ✅ 一步 |
| 2 | `removeLinkBetween` | 连线删除 | ✅ 一步 |
| 3 | `closeEditor` note 模式（值变化时才 save） | 插入/编辑说明 | ✅ 一步 |
| 4 | `closeEditor` rename 模式（值变化时才 save） | 节点改名 | ✅ 一步 |
| 5 | `closeEditor` add 模式 | 新增节点 | ✅ 一步 |
| 6 | `deleteNode` | 删除节点（含子节点升级、连线清理、徽标清理） | ✅ 一步 |
| 7 | 树点击 `button[data-toggle]`（打卡/批量切换，一次点击一次 save） | 打卡/批量切换（含连线联动） | ✅ 一步 |
| 8 | 右键菜单 unpin | 移除目录徽标 | ✅ 一步 |
| 9 | 拖拽 drop 改挂父节点 | 拖拽改挂 | ✅ 一步（无变化时被去重跳过） |
| 10 | `switchCatalog` | 目录切换 | ✅ 一步 |
| 11 | `createCatalog` | 目录新增（含自动切换） | ✅ 一步 |
| 12 | `deleteCatalog` | 目录删除 | ✅ 一步 |
| 13 | 目录改名 commit（`applyCatalogRename` 返回 true 才 save） | 目录改名 | ✅ 一步 |
| 14 | `insertCatalogOnNode`（目录拖到分支上） | 徽标新增 | ✅ 一步 |
| 15 | `catalogCollapseBtn` / `catalogRailBtn`（侧栏折叠/展开） | 纯视图状态 | ❌ `save(false)`（不入栈；快照也剔除 sidebarOpen） |
| 16 | 初始化（load 后） | 基线快照 | ✅ 第 0 步（不占操作步数） |
| 17 | 撤销/重做内部 `save(false)` | 恢复结果落盘 | ❌ 不入栈 |

### 5. 键盘
`Ctrl/Cmd+Z` 撤销；`Ctrl/Cmd+Shift+Z` 与 `Ctrl+Y` 重做。目标是 `INPUT / TEXTAREA / isContentEditable` 时不拦截（不 preventDefault，交给浏览器原生文本编辑）。带 Alt 修饰的忽略。

### 6. UI
页头右侧新增固定悬浮工具条（本应用没有传统页头，与左上角「» 目录」浮钮同一语言：fixed、top:10、z-index 900、--paper 底 + --shadow）：
- `↩ 撤销`：title「撤销上一步（Ctrl+Z）」、aria-label「撤销上一步操作」
- `↪ 重做`：title「重做（Ctrl+Shift+Z 或 Ctrl+Y）」、aria-label「重做已撤销的操作」
- 容器 `role="toolbar" aria-label="撤销与重做"`
- 禁用态灰显：实测 disabled 时 color=rgb(107,114,128)（--muted）、opacity=0.45、cursor=not-allowed；启用时 color=rgb(30,36,48)（--ink）、opacity=1、cursor=pointer

---

## 二、怎么验证（全部 CDP 数值证明）

环境：`python -m http.server 8801`（服务 b/undo 目录）+ Edge headless（CDP 9431），驱动 `test-undo.mjs`（Node 24 原生 WebSocket）。种子数据仿 `seed-basic.js`（`neurCrossHidden:true` 阻止预置目录混入，10 节点 3 连线）。全部证据在 `evidence.json`，全程 console 错误 0、警告 0。

### 验收 a) 勾父批量完成 → Ctrl+Z 恢复原状 — **PASS**
| 项 | 预期 | 实际 |
|---|---|---|
| 勾选「子节点 A」（3 个叶子子节点） | a1/a2/a3 done=true, completedAt=T1 | `true/2026-11-20 18:08` ×3（T1），分支 a 自身仍 `false/` |
| 一次批量 = 一步 | 栈 1→2 | `stackLen: 2`（基线 1） |
| Ctrl+Z 后 | 三个子节点 done=false 且 completedAt="" | `false/` ×3，DOM 完成按钮数 0，undoBtn 禁用/redoBtn 启用 |

### 验收 b) Ctrl+Shift+Z → done=true 且 completedAt===T1 — **PASS**
| 项 | 预期 | 实际 |
|---|---|---|
| Ctrl+Shift+Z 后 | a1/a2/a3 = `true/T1`（时间戳原样恢复） | `true/2026-11-20 18:08` ×3，与 T1 逐字符相等 |
| Ctrl+Y 路径 | 同上 | `true/2026-11-20 18:08` ×3 |
| **防伪检验**（排除“同一分钟内重新生成”的巧合） | — | 撤销后把 `nowCompletedAt` 篡改为恒返 `"2099-01-01 00:00"` 再重做：结果仍是 `2026-11-20 18:08` 而非 2099 → 证明是快照恢复、不是重新执行 |

### 验收 c) 删除带子节点的节点 → Ctrl+Z 全部回来 — **PASS**
操作路径全部走真实 UI（右键菜单 → 连线/删除）。先给 a、b 连一条线（共 4 条连线），再右键删除 a：
| 项 | 删除后 | Ctrl+Z 后 |
|---|---|---|
| 节点数 | 9（a 消失） | **10**（a 回来，parentId=p） |
| 子节点挂载 | a1/a2/a3.parentId=p（升级） | **parentId=a**（子树挂回） |
| 连线 | 3 条（a-b 被剪） | **4 条**（a-b 回来） |
| DOM | — | 10 个节点块、SVG 连线 4 条、节点 a 存在 |
| 栈 | 3（基线+连线+删除） | index 回到 1 |

### 验收 d) 连续 35 次操作后最早历史被丢弃不报错 — **PASS**
对叶子 c2 连续打卡 35 次（每次一步）：
- 35 次后：`historyStack.length = 31`（= HISTORY_MAX，36 份快照丢了最旧 5 份），`historyIndex = 30`，无任何异常（console errors=0）
- 连续撤销 32 次：**成功 30 次**，第 31、32 次返回 false（到底了）
- 撤到底后 c2.done=**true**（第 5 次操作后的状态，奇数次）——证明最早 4 步已被丢弃、再也回不去，且全程不报错

### 验收 e) localStorage 的数据在撤销后与界面一致 — **PASS**
- 验收 a 撤销后：`lsMatchesLive: true`（localStorage 当前目录每个节点的 [id,done,completedAt] 与内存 state 完全一致），localStorage 里 a1 = `false/`，DOM 完成按钮 0 个
- 验收 c 撤销后：localStorage 里 a 存在、links 4 条与内存一致（`lsEqualsLive: true`），DOM 10 节点/4 连线
- 机制证据：撤销后 `savedJsonEqualsSnapshot: true`（落盘 JSON === 当前栈顶快照）

### 其他验证
- **输入框不拦截**：改名框聚焦时向其派发 Ctrl+Z → `historyIndex` 不变、`defaultPrevented=false`、编辑框仍开着；Enter 提交改名（1 步）后 Ctrl+Z → 名字恢复
- **目录增/切换可撤销**：新建目录（自动切换过去）→ Ctrl+Z → 目录数 2→1、currentCatalogId 回到 cat_test、侧栏 DOM 同步
- **折叠不入历史**：侧栏收起/展开后 `historyStack.length` 与 `historyIndex` 均不变，但 localStorage 的 sidebarOpen=false 已持久化、侧栏 class=collapsed（save(false) 生效）
- **默认数据回归**：清空 localStorage 全新加载（默认树 + NeurCross 预置目录，23 节点）→ 基线栈 1 → 打卡一步 → Ctrl+Z 恢复，localStorage 节点数一致
- **getter 机制**：见上文第二节，`enumerableStateKeys` 不含 nodes/links/linkDone，`snapshotKeys` 亦然；恢复后三访问器仍指向当前目录（identity 相等）

---

## 三、截图清单（本目录）
1. `shot-0-baseline.png` — 初始状态，撤销/重做均禁用（灰显）
2. `shot-a1-checked.png` — 勾选父节点后 3 子节点完成（T1 时间戳可见），撤销可用
3. `shot-a2-undone.png` — Ctrl+Z 后恢复原状，重做可用
4. `shot-a3-redone.png` — 重做后完成态恢复
5. `shot-b1-deleted.png` — 删除带子节点的节点 a 后
6. `shot-b2-restored.png` — Ctrl+Z 后节点/子树/连线全部回来
7. `shot-c1-after35.png` — 35 次操作后（栈已封顶 31）
8. `shot-c2-undone30.png` — 连续撤销 30 次到底后
9. `shot-e1-catalog-undo.png` — 目录新建被撤销后

---

## 四、已知风险与未做部分

1. **快照是全量 JSON 深拷贝**：目录很多/NeurCross 大树时每步快照约几十～几百 KB，31 步上限内存占用约几 MB，可接受；如未来目录规模暴涨可改为结构共享或按目录分栈（未做）。
2. **撤销粒度 = save() 调用粒度**：依赖「每个用户操作恰好调用一次 save」这一现有代码事实。若未来某个新入口在一次交互里多次 save（例如批量导入），会被记成多步——去重只能合并“无变化”的连续步，不能合并“有变化的中间步”。
3. **侧栏折叠/展开不入历史但会落盘**：撤销其它操作时 sidebarOpen 保持现值（快照剔除了它），这是有意为之（视图状态不参与数据历史）。
4. **跨目录撤销会重置视野**（pendingAutoFit）：与手动切换目录的行为一致；撤销同目录内的操作不影响 pan/scale。
5. 任务书提到的「节点折叠」在本基线（commit 3e873f2）中不存在（唯一折叠是目录侧栏，已按规范排除）；若后续加入节点折叠，其状态应同样走 save(false) + 快照剔除。
6. alert/confirm/prompt：本次改动未引入新的；`deleteNode`/`deleteCatalog` 沿用基线已有的 confirm（未在本次范围内改动）。
