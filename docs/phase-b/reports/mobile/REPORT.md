# REPORT — mobile（移动端可用性 + 原生弹窗替换）

工作文件：`b\mobile\mobile.html`（基线 = base.html 快照，commit 3e873f2）
补丁：`b\mobile\mobile.patch`（`git diff --no-index -- base.html b\mobile\mobile.html`，退出码 1 属正常）
测试：静态服务 127.0.0.1:8803（python http.server），无头 Edge + CDP 9433，驱动 `mobile-check.mjs`，结果 `mobile-check-result.json`。

## 一、改了什么 / 为什么

### 1. 自定义弹窗系统（替代原生对话框）
- 新增 **Modal 确认框**：`#mmModal`（标题 / 正文 / 危险色确认按钮 / 取消按钮 / 遮罩），`confirmDialog(msg, opts) → Promise<boolean>`（取消、Esc、点遮罩均 resolve(false）；旧弹窗自动让位）。CSS 用现有变量（--paper/--ink/--danger/--radius/--shadow）。
- 新增 **Toast**：`showToast(msg, "success"|"error")`，顶部居中，**2.5s 自动消失**。
- 替换全部原生调用（grep 全文仅有 3 处，全部替换，语义不变）：
  - `deleteNode`：`if (!confirm(msg)) return` → `confirmDialog(msg, {title:"删除节点", confirmText:"删除"}).then(ok => ok && doDeleteNode(...))`；确认后才删，取消不删，与原生完全等价（拆出 `doDeleteNode` 承载原删除逻辑）。
  - `deleteCatalog` 仅剩目录时的 `alert` → `showToast("至少要保留一个目录，不能删除。", "error")`。
  - `deleteCatalog` 的 `confirm` → `confirmDialog`（拆出 `doDeleteCatalog`）。
- 删除成功后补一个 `showToast(..., "success")` 轻量反馈（新增行为，不改变删除语义）。
- Esc 键统一关闭：弹窗(Esc=取消)、Action Sheet、原有三个菜单。
- **全文（含 DOM 序列化）grep 不到任何 `confirm(`/`alert(`/`prompt(` 调用**（连注释都不含这两个字面量）。

### 2. 长按操作抽屉（Action Sheet）
- 仅 `pointerType === "touch"` 的 pointerdown 启动长按计时（**≥500ms**、位移 ≤10px 才触发）；pointermove 超阈值 / pointerup / pointercancel / 新手指按下都会取消。
- 命中**节点**：底部弹出 Action Sheet，条目 = 新增子分支 / 重命名 / 说明（已有说明显示"编辑说明"）/ 连线 / 删除（危险色）；与桌面右键菜单可见性规则一致（有连线时多一项"取消连线"、有目录徽标时多一项"移除目录标识"、虚拟根只显示"新增子分支"）——动作直接复用桌面菜单同一套分发（`runNodeAction`），**行为语义不变**。本应用没有"设为每日打卡"功能，按任务说明跳过。
- 命中**空白**：Action Sheet 单条"新增一级分支"（= 桌面右键空白语义）。
- 命中**任务连线**（虚线加宽命中区）：单条"删除该连线"（= 桌面右键连线语义）。
- **防误触（轻点仍=打卡）**：长按触发时①结束进行中的平移；②置 `swallowNextClick`+`suppressNextTreeClick`，在 document 捕获阶段吞掉紧随 pointerup 的那次 click（验收实测：长按后节点 done 前后均为 false）；③触屏长按引出的系统 contextmenu 在 1200ms 触屏窗口内被拦截，不会弹出桌面右键菜单（实测 ctxMenu 保持 hidden）。
- **桌面右键菜单保留不动**（contextmenu 处理器仅在触屏窗口内短路）。

### 3. 触控画布（平移 + 捏合）
- 现有 pointer 平移逻辑改造为触控/鼠标统一：单指（或鼠标左键）拖空白 = 平移（原逻辑保留：连线模式空白单击取消、clampPan、虚拟化补画）。
- **双指捏合**：第二指落下进入捏合（取消单指平移与长按），`scale = s0 × (当前两指距/初始两指距)`，并以"初始中点指向的内容跟随当前双指中点"调整 pan（围绕双指中点缩放 + 双指拖动二合一）；范围沿用 `Math.min(ZOOM_MAX=3, Math.max(zoomMin, ...))`。抬指后剩一指可继续平移（预置 moved=true，不当空白点击）。
- 滚轮缩放原样保留（桌面回归实测 1 → 1.12）。

### 4. 移动端布局（<760px）
- 侧栏目录改为**可收起抽屉**：`@media (max-width:759px)` 下 `position:fixed` 左侧滑入（`transform: translateX(-103%)` ⇄ `.drawer-open`），宽 `min(78vw,300px)`，带遮罩 `#drawerMask`；汉堡按钮 `#mobileMenuBtn`（40px 圆角方块，左上角）呼出，桌面 `display:none`。抽屉开合**纯运行时状态，不写 localStorage**（数据 schema 零改动）。
- 点目录项/删除即收抽屉；点 ✎ 改名不收（要在抽屉内编辑）；跨断点自动复位。
- 工具区只有左上角 40px 汉堡按钮，不遮挡画布操作（可正常在其下方长按/拖动）。
- 390×844 无横向滚动：`innerWidth(390) === clientWidth(390)` 无滚动条；`html/body` 与 stage `overflow:hidden`（与 base.html 完全一致）。`scrollWidth=948 > 390` 是**基线同款现象**（画布绝对定位内容在 overflow:hidden 下被裁剪的量度，实测 base.html 为 949），非本次改动引入，用户无法横向滚动。

### 5. 数据兼容
- localStorage key 仍为 `signin-tracker-v1`；**未新增任何持久化字段**（抽屉状态运行时）；纯函数区（CATALOG-PURE）零改动；连线路径无缓存、分支贝塞尔、viewport 虚拟化均未触碰。

## 二、触控事件模拟方式（验收写明）

- 设备：CDP `Emulation.setDeviceMetricsOverride {width:390, height:844, deviceScaleFactor:2}` + `Emulation.setTouchEmulationEnabled`。
  ⚠ 本机 headless Edge 在 `mobile:true` 时出现坐标系撕裂（布局/rect 空间 948×2052 vs 视口 390×844，elementFromPoint 与 dispatchTouchEvent 命中不一致，换 window-size / screenWidth 均无效），故驱动用 `mobile:false`：**视口仍为 390×844、matchMedia(max-width:759px) 命中、touch 派发照常产生 pointerType="touch"**，仅无移动端视觉视口元数据。真机不受影响。
- **长按**：`Input.dispatchTouchEvent` touchStart（单 touchPoint，固定 id）→ 静置 **680ms**（>500ms 阈值）→ touchEnd。浏览器由触摸流派生 pointerdown/pointerup(pointerType="touch") 与 click，页面代码走真实触屏路径。
- **轻点（打卡）**：touchStart → 60ms → touchEnd（产生真实 click）。
- **单指平移**：touchStart → 10 步 touchMove → touchEnd。
- **双指捏合**：touchStart 同时下两点（id 1/2）→ 8 步 touchMove 同步两指从 90px 张到 255px → touchEnd。
- **文本输入**：`Runtime.evaluate` 设 input.value 后派发 `KeyboardEvent(Enter)`（输入框已有 keydown 提交监听，等价键入回车；长按本身仍是上述 touch 流）。
- 所有触点坐标先经 `elementFromPoint` 验证命中目标节点/空白后才派发；目标不在视口时先用单指拖动画布带入（同时充当平移验收）。
- 页面脚本运行前注入计数器，替换 `window.confirm/alert` 为记录函数 → 运行期原生调用计数（真调用会被记录且不弹窗）。

## 三、验收结果（CDP 390×844 + touch，全程无右键）

数据来源 `mobile-check-result.json`（exit 0，console 无错误无异常）。

| # | 验收点 | 预期 | 实际 | 证据 | 判定 |
|---|--------|------|------|------|------|
| 1 | 视口布局 | 390×844，无横向滚动条 | innerWidth=390=clientWidth（无滚动条）；body/stage overflow:hidden；scrollWidth 948 与基线 949 同源（overflow:hidden 裁剪量度） | layout-390 步 | PASS |
| 2 | 汉堡抽屉 | 点击汉堡开抽屉，点目录项关闭 | drawerOpen=true / transform:none / 遮罩显示；点目录后 drawerOpen=false | drawer-open.png, drawer-close-after-item-tap | PASS |
| 3 | 单指拖动平移 | 拖后画布平移 | transform matrix (1,0,0,1,0,242) → (1,0,0,1,**-308**,242) | one-finger-pan 步 | PASS |
| 4 | 长按节点弹 Action Sheet | 500ms+ 按住节点弹出底部抽屉 | 标题"子节点 A"，条目 [add:新增子分支, rename:重命名, note:说明, link:连线, delete:删除]；桌面菜单 ctxMenu 保持 hidden | sheet-node.png | PASS |
| 5 | 长按不误触打卡 | 长按后节点完成态不变 | nodeADoneBefore=false，nodeADoneAfterLongPress=false | longpress-sheet 步 | PASS |
| 6 | 新增子分支 | sheet→新增子分支→输入→回车入库 | editorOpen=true（aria-label 新分支名称）；入库 parentId="a"（父=子节点 A），节点总数 10→11 | add-editor.png, after-add.png | PASS |
| 7 | 重命名 | sheet→重命名→输入→回车 | renamed=true，旧名 oldGone=true（localStorage） | after-rename.png | PASS |
| 8 | 轻点打卡 | 轻点=切换完成 | doneInStorage=true，hasCompletedAt=true，DOM .node-btn.done=true | after-checkin.png | PASS |
| 9 | 删除（自定义 Modal） | sheet→删除→确认框（危险色）→确认后删除 | modalVisible=true，标题"删除节点"，正文"确定删除「改名后的分支」？"，确认钮文本"删除"/class danger；确认后 modalHidden=true、nodeGone=true、总数回落 10 | delete-modal.png, after-delete-toast.png | PASS |
| 10 | Toast 2.5s 自动消失 | 删除后 toast 显示并自动消失 | toastShown=true，文本"已删除「改名后的分支」"，class "mm-toast success"；2.7s 后 hidden=true | delete-confirmed / toast-autodismiss | PASS |
| 11 | 长按空白 | 弹出"新增一级分支" | 标题"空白处"，条目 [add-root:新增一级分支]；点击后 aria-label="新的一级分支名称" | sheet-blank.png | PASS |
| 12 | 双指捏合缩放 | scale 数值变化（zoomMin..3） | 两指距 90→255px：transform scale **1 → 2.82843 →（捏回）0.754575**（=距离比 255/90×0.97 前后一致，未越 3 上限/0.3 下限） | after-pinch-out.png, pinch-zoom 步 | PASS |
| 13 | 无原生对话框（静态） | 页面 grep 不到 confirm(/alert( | DOM 序列化正则匹配 confirm(/alert(/prompt( = **0/0/0** | static-check 步 | PASS |
| 14 | 无原生对话框（运行期） | 全流程无原生调用 | 注入计数器记录 = [] | static-check 步 | PASS |
| 15 | 桌面回归：右键菜单 | 桌面右键节点弹原菜单 | 1440×900 无 touch：右键节点 → ctxMenu visible，条目 [add,rename,note,link,delete]；空白右键 → 一级分支编辑器；汉堡 display:none | debug9-desktop（已跑完删除） | PASS |
| 16 | 桌面回归：滚轮缩放 | 保留 | wheel -120 → scale 1 → 1.12 | debug9-desktop | PASS |

截图清单：drawer-open / sheet-node / add-editor / after-add / after-rename / after-checkin / delete-modal / after-delete-toast / sheet-blank / after-pinch-out（均 390×844@2x，780×1688）。

## 四、已知风险与未做部分
1. **CDP 用 mobile:false**：本机 headless Edge 的 mobile:true 坐标撕裂（见二）。视口尺寸/媒体查询/触控语义均达标，但未覆盖"移动端视觉视口元数据"（如 Safari 地址栏收缩）。真机行为需实机抽查。
2. **scrollWidth 948 > 390**：基线同款（base 949），overflow:hidden 下无滚动条、不可横滚；如需"量度也相等"需给画布容器换裁剪策略，属基线架构决定，未改。
3. 捏合要求两指起点都在**空白**（与桌面"节点上不平移"同一过滤规则）；一指在节点上一指在空白时，空白指仍可单指平移。
4. "设为每日打卡"选项：本应用无此功能，按任务说明跳过。
5. 目录删除/节点删除改 Promise 化后是异步提交（确认后一拍再删），语义等价；`deleteNode(id, true)`（D 快捷键）路径不变。
6. iOS Safari / Android Chrome 实机未测（仅 headless Chromium/Edge 157）；`-webkit-touch-callout`/`-webkit-tap-highlight-color` 已加，长按系统呼出在 Chromium 系已由 contextmenu 拦截验证。
7. 长按弹抽屉后如浏览器仍合成 click（各厂商时序差异），由捕获阶段 swallowNextClick 兜底吞掉一次；若某些浏览器长按不派发 click，标记会被下一次任意 pointerdown 复位，不影响后续操作。

## 五、复现
```
cd C:\Users\25988\Desktop\.mindmap-test\b\mobile
python -m http.server 8803 --bind 127.0.0.1 .
# Edge headless CDP 9433（user-data-dir=本目录\profile）
node mobile-check.mjs http://127.0.0.1:8803/mobile.html   # 输出各步 JSON + 截图 + mobile-check-result.json
```
