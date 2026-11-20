# accept — PHASE-B 验收工装 REPORT

本代理不改 HTML，交付**可对任意候选版本零改动重跑**的验收工装 `run.mjs`，
并已在基线 `base.html` 上完成全量首跑。以下为运行方法、设计说明与基线结果。

## 一、交付物清单

| 文件 | 说明 |
|---|---|
| `run.mjs` | 验收工装本体（Node 24，无第三方依赖，原生 WebSocket 走 CDP） |
| `out/report.md` | 基线（base.html）人类可读报告：A1–A8 表格 + 数值证据 |
| `out/results.json` | 基线机读结果（含每条断言的 expect/actual/pass、指标、控制台日志） |
| `out/shots/*.png` | 基线截图：A1–A8 每用例至少 1 张（A7 三档缩放各 1 张） |
| `out-candidate/` | 对 `accept.html`（base 快照副本）零改动重跑的对照输出，证明工装可复用 |
| `REPORT.md` | 本文档 |

不产出 `accept.patch`：工装不修改任何 HTML（PHASE-B 的 patch 交付项仅适用于改码代理）。

## 二、运行方法

```powershell
cd C:\Users\25988\Desktop\.mindmap-test\b\accept

# 基线 / 任意候选（零改动，只换 --file）：
node run.mjs --file ..\..\base.html      --out out            # 桌面 1440×900（A6 单独切 390×844）
node run.mjs --file ..\checkin\checkin.html --out out-checkin # 例：候选版
node run.mjs --file ..\mobile\mobile.html   --out out-mobile --mobile  # 全程 390×844 移动视口

# 可选参数：--http-port 8806 --cdp-port 9436 --edge <msedge路径> --python python
```

- 前置：Node ≥ 24（原生 WebSocket）、Edge（默认 `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`）、
  python（起静态服务；缺失时自动回退 Node 内置静态服务）。
- 端口：静态服务 8806 / CDP 9436（PHASE-B 分配给 accept，工装自起自清）。
- 单次全量运行约 12–20 秒；结束后自动清理，输出写入 `--out` 目录。

### 自起自清（只按 PID 杀）

- python 静态服务、Edge 均为本进程子进程，结束 `taskkill /PID <pid> /T /F`。
- Edge 有 compat-relaunch 行为（spawn 的 PID 以 exit=0 让位给新 PID 的浏览器树）：
  工装以 CDP 端口就绪为成功判据；清理时按「CDP 端口 LISTENING 归属 PID」与
  「命令行引用本 profile 目录的 msedge PID」双路清扫（逐 PID 验证后杀，**绝不按进程名杀**，
  不会碰用户自己的浏览器）。启动前同样自愈上次崩溃可能遗留的进程。
- 实测多次连跑后：8806/9436 无监听、无引用本 profile 的 msedge 残留。

## 三、用例矩阵（动作序列 → 断言 → 判定）

所有断言只依赖 DOM / localStorage / SVG 数值，不读页面闭包变量；
数据注入沿用 shot.mjs 的「写入 localStorage → 刷新」模式（schema 同 seed-basic.js）。

| 用例 | 动作序列 | 数值断言（全过=PASS） |
|---|---|---|
| A1 | 清空 localStorage → 刷新加载默认树 | readyState=complete；.mm-node≥20；.mindmap-branch≥18；页面异常 0 |
| A2 | 注入 50 节点树（7 一级分支 + 43 叶，**标题恰 30 字**）→ 刷新 | 相邻卡片重叠对数=0（可视盒：mm-node 有 translateY(-50%)，从 computed transform 修正）；.mindmap-branch 反向曲线=0（起点x<终点x，多边形取半程转折点、描边取终点）；竖脊=0（#mindSvg 内 getBBox 宽<20 且 高>40 的 path 数） |
| A3 | 注入 10 节点 3 连线 → 打卡 a1（联动完成 b1，两卡增高变宽）→ 再点取消 | 每档：3 条 .mindmap-link 全画出；每条 d 首末端点到两端卡片「接驳边中点」距离≤1.5px（接驳边规则复刻 rlSideToward：中心连线水平主导取左右边、垂直主导取上下边；卡片矩形与页面 cardRects 同测法 offsetLeft/offsetTop-btn高/2） |
| A4 | 注入环形 JSON（nA 父=nB、nB 父=nA，另有正常 r→nC）→ 刷新 | 不白屏：readyState=complete、body 文本>0、节点≥3、页面异常 0；可用：正常节点 nC 打卡状态可翻转 |
| A5 | 右键 a1（带连线节点）→ 菜单点「删除」→（原生 confirm 被预载脚本放行 / 自定义模态自动点确认） | a1 从 DOM 移除；悬空 .mindmap-link-hit=0（hit 的 data-link-a/b 必须都在现存卡片 ref 里）；localStorage 剩余连线不含已删节点 |
| A6 | 切 390×844 移动视口 → 加载 → 打卡 → 右键删除尝试 | scrollingElement.scrollWidth≤390；预载脚本重写 confirm/alert/prompt 计数均为 0 |
| A7 | A3 场景下滚轮缩放至 0.3 / 1 / 3（CDP Input 真事件，从 catTree transform 矩阵实测倍率） | 每档到达目标 ±6% 带内（滚轮每档 ×1.12 的物理粒度）；每档 A3 贴合断言仍全过 |
| A8 | 注入 50 节点树 → 连续 5 次打卡（每次 click 后等 2 rAF，覆盖同步重建+布局帧） | 5 次全部执行；给出每次耗时 ms、其后 DOM 节点数、总耗时与波动（**只记数，不设阈值**） |

## 四、基线结果（base.html，2026-11-20）

**总览：7/8 PASS；A6 FAIL（符合任务预期的基线形态）**

| 用例 | 结果 | 关键数值 |
|---|---|---|
| A1 | PASS | 24 卡片 / 23 分支 / 0 异常 |
| A2 | PASS | 可见 51/51 卡片；重叠 0；反向 0；竖脊 0；分支 50 |
| A3 | PASS | 打卡前/后/取消后均 3/3 画出，端点最大偏差 0px（≤1.5 达标） |
| A4 | PASS | 环不白屏（节点 5、文本 47 字符），nC 打卡 false→true |
| A5 | PASS | a1 删除成功，悬空 hit 0，存储连线剩 a2-c1 / a3-c2 |
| A6 | **FAIL（预期）** | scrollWidth=949>390；confirm 调用 1 次（alert/prompt 0） |
| A7 | PASS | 实测缩放 0.3 / 1.044 / 2.894，各档贴合最大偏差 0px |
| A8 | PASS（记数） | 5 次打卡 12.6/11.8/14.5/11.7/8.9 ms，总 59.5ms；DOM 344→348（+1/次，来自完成时间戳 span，稳定） |

### 预期差异口径（重要）

- **A2 / A3 基线应 PASS**（已修复回归项）：实测确实 PASS，守卫有效。
- **A6 原生弹窗断言基线应 FAIL**：实测 confirm=1，符合任务说明的预期差异；
  mobile-ux 修好后（自定义 Modal）应为 0 → PASS。工装的删除路径对两种实现都兼容
  （原生 confirm 由预载计数脚本放行；自定义模态自动点「确认/删除」按钮）。
- **A6 横向滚动断言在基线同样 FAIL（scrollWidth=949）**：任务说明只预告了弹窗项，
  此项是基线在 390 宽下的真实溢出（页面固有最小宽约 949px 超出视口，mindmap 画布与
  工具区不收缩）。已如实计入 FAIL；同属 mobile-ux 候选应修复的范围。

## 五、零改动重跑验证

对 `b\accept\accept.html`（base 的快照副本）执行 `node run.mjs --file accept.html --out out-candidate`：
同样 7/8 PASS、A6 同因 FAIL，逐条数值与基线一致 —— 证明工装对候选版本零改动可重跑、结果可横向对比。

## 六、已知限制与风险

1. **缩放倍率物理粒度**：滚轮每档 ×1.12，无法精确命中 0.3/1/3；到达判定为目标 ±6% 带，
   报告同时给出实测值（如 1.044、2.894）。A7 的贴合断言不受影响（与倍率无关）。
2. **A2 种子深度**：30 字长标题的叶子放在 depth≤2（常规行高 40）。depth≥3 会命中
   NeurCross 短参数专用的紧凑行高 ROW_H_PARAM=22，那是另一场景，不混入本用例。
3. **A6 的删除尝试**走桌面同款 contextmenu→菜单路径；若某候选把移动端删除入口
   改成别的手势，该步骤会在 metrics 里如实记录（menu-open/delete 步骤结果），
   弹窗计数断言仍然有效（没触发就保持 0）。
4. **视口虚拟化**：超大树缩得很小时视野外连线按设计不画；工装在测量前自动
   滚轮缩小直到全部连线画出，并在结果中记录 drawn/total。
5. Edge headless 偶发 GPU/网络噪音日志已过滤，不计入异常判定；页面 JS 异常
   （exceptionThrown / console.error / window error）全量计入。

## 七、环境

- Node v24.18.0（原生 WebSocket）、Edge headless=new、Python 3.14（http.server）。
- 运行目录：`C:\Users\25988\Desktop\.mindmap-test\b\accept`（profile 子目录为 Edge 用户数据）。
- 生产仓库 `C:\Users\25988\Desktop\ToDoList\` 全程未触碰；桌面其他 agent 目录未触碰。
