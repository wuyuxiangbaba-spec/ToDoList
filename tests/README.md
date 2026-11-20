# 测试工装

对任意版本的 `index.html` 可零改动重跑的验收/回归工具（Node ≥ 22，原生 WebSocket 走 CDP；静态服务与 headless Edge 自起自清，仅按 PID 终止）。

## 一键验收矩阵（A1–A8）

```powershell
node tests\acceptance-run.mjs --file <index.html绝对路径> --out <结果目录> [--mobile]
```

覆盖：默认树加载、50 节点+30 字长标题无重叠/无反向曲线/无竖脊、打卡后虚线端点贴合（≤1.5px）、环形 JSON 不白屏、删节点无悬空连线、390×844 移动端（原生弹窗拦截、横向滚动）、缩放 0.3/1/3 回归、连续打卡性能。

## 单项工具

| 脚本 | 用途 |
|---|---|
| shot.mjs / mob-shot.mjs | CDP 加载器（桌面 1440×900 / 移动 390×844）：`node shot.mjs <url> [seed.js] [shot.png] [measure.js]` |
| seed-basic.js / seed-mixed.js | 注入测试树（含连线/混合完成态），seed 后自动 reload |
| smoke-seed.js / smoke2-seed.js | 交叉功能冒烟种子（折叠×每日打卡×撤销） |
| measure-branch.js | 分支几何断言（path 数=边数、无竖脊、逐边匹配） |
| measure-toggle.js | 打卡前后虚线端点 vs 卡片接驳边距离 |
| smoke-measure.js / smoke2-measure.js | 六轨功能存在性 + 日历打卡链路 + 撤销回滚 |
| mob-measure.js | 移动视口指标（innerWidth/clientWidth/滚动条/抽屉） |

典型用法：

```powershell
python -m http.server 8791 --bind 127.0.0.1 --directory <仓库根>
$edge = Start-Process 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList '--headless=new','--disable-gpu','--remote-debugging-port=9411','--user-data-dir=<临时目录>','about:blank' -PassThru
$env:CDP_PORT='9411'
node tests\shot.mjs http://127.0.0.1:8791/index.html tests\seed-basic.js out.png tests\measure-branch.js
Stop-Process -Id $edge.Id   # 只按 PID 清理
```

历史验收结果见 `docs/phase-b/acceptance/`（基线与集成版报告+截图）。
