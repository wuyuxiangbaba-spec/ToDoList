# 测试工装

对任意版本的 `index.html` 可零改动重跑的验收/自检工具（Node ≥ 22，原生 WebSocket 走 CDP；静态服务与 headless Edge 自起自清，只按 PID 终止）。

## 快速自检（无浏览器）

```powershell
node tests\catalog-selfcheck.mjs            # 抽取 index.html 纯函数段：默认树恢复/dflt迁移/存量保护/NeurCross 播种
```

## Phase-C 验收矩阵（C1–C7，浏览器）

```powershell
node tests\run-phase-c.mjs --file index.html --out out-phase-c
```

覆盖：C1 无缓存首开=23 nmw 个人树；C2 全 dflt- 目录自动迁移回个人树；C3 改过的 nmw 树严禁覆盖；C4 折叠已删（存量子节点仍可见）；C5 日历已删（daily 存量按普通节点勾选落 done）；C6 根节点 A/B 形态（NeurCross/新建目录单层、默认目录根=目录名、改名同步、右键/拖拽/fit/搜索）；C7 回归护栏（虚线贴合≤1.5px、撤销、搜索、缩放 fit、暗黑、多目录、NeurCross 494 节点、环形 JSON 不白屏）。退出码 0=全过。

## Phase-B 通用回归（A1–A8，浏览器）

```powershell
node tests\acceptance-run.mjs --file index.html --out out-acceptance [--mobile]
```

布局无重叠/无反向曲线/无竖脊、虚线贴合、环数据、删节点无悬空连线、移动视口、缩放回归、性能记数。

## 单项工具

| 脚本 | 用途 |
|---|---|
| shot.mjs / mob-shot.mjs | CDP 加载器（1440×900 / 390×844）：`node tests\shot.mjs <url> [seed.js] [shot.png] [measure.js]` |
| seed-basic.js / seed-mixed.js | 注入测试树（含连线/混合完成态） |
| smoke-seed.js / smoke-measure.js | 交叉功能冒烟（六轨元素在位性 + 根名 + 虚线 + 撤销 + 主题 + 搜索 + 缩放） |
| measure-branch.js | 分支几何断言（path 数=边数、无竖脊、逐边匹配） |
| measure-toggle.js | 打卡前后虚线端点 vs 卡片接驳边距离 |
| mob-measure.js | 移动视口指标（innerWidth/clientWidth/滚动条/抽屉） |
| seeds/ | Phase-C 矩阵种子（nmw 23 节点 / dflt 24 节点 / 各场景目录） |

历史验收结果：`docs/phase-b/acceptance/`（Phase-B 基线与集成版）。
