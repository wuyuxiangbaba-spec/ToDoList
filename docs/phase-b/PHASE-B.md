# PHASE-B 公共规范（所有子代理必读）

## 基线
- 工作文件：自己目录下的 <name>.html（内容 = 生产文件快照 base.html，commit 3e873f2，已含两项修复：
  1) 分支=每子一条三次贝塞尔 M x1,y1 C midX,y1 midX,y2 x2,y2，无竖脊；
  2) 关联虚线无像素缓存，updateViewport 每帧用当前 cardRects 现算）。
- 生产仓库 C:\Users\25988\Desktop\ToDoList\ 绝对只读！不 git、不提交、不改桌面任何文件、不动其他 agent 目录。

## 硬约束
1. 保持**单文件 HTML** 架构（GitHub Pages 根路径部署 index.html）；所有 JS/CSS 内联，不用外部 CDN。
2. localStorage key 仍是 "signin-tracker-v1"，**存量用户数据必须无损加载**（加字段要可选、有默认值、向后兼容；禁止整体换 schema 丢数据）。
3. 遵守现有代码风格（中文注释、现有命名、现有 CSS 变量 --paper/--ink/--accent 等）。
4. 不得重新引入连线路径缓存、不得回退分支曲线方案、不得破坏 viewport 虚拟化。
5. 禁用 alert/confirm/prompt（如涉及，替换为自定义 Modal/Toast）。

## 交付物（缺一不可）
1. <name>.html：改后的完整文件（在你目录里改）。
2. <name>.patch：cd C:\Users\25988\Desktop\.mindmap-test && git diff --no-index -- base.html b\<name>\<name>.html > b\<name>\<name>.patch（注意 git diff --no-index 退出码 1 是正常）。
3. REPORT.md（中文）：改了什么、为什么、怎么验证、数值/截图证据、已知风险与未做部分。
4. 截图 png 若干（放自己目录）。

## 测试环境（自己起、自己清）
- 静态服务：python -m http.server <你的端口> --bind 127.0.0.1 --directory <你的目录>（后台运行）。
- 无头浏览器：$p = Start-Process -FilePath 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList '--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=<你的CDP端口>','--user-data-dir=<你的目录>\profile','about:blank' -PassThru；结束只许 Stop-Process -Id $p.Id，**严禁 Get-Process msedge | Stop-Process 之类的按名杀**（会杀掉用户自己的浏览器）。
- CDP 驱动参考：复制 C:\Users\25988\Desktop\.mindmap-test\shot.mjs 到自己目录改造（支持 --setup/--measure/--screenshot 的加载执行器，Node 24 原生 WebSocket 可用）。
- 端口分配：undo=8801/9431，checkin=8802/9432，mobile=8803/9433，canvas=8804/9434，pwa=8805/9435，accept=8806/9436。
- 数据注入参考（localStorage 结构）：见 .mindmap-test\seed-basic.js（catalogs[].nodes/links/linkDone）。

## 报告口径
- 每条验收给：预期 / 实际 / 证据（数字或截图）/ PASS-FAIL。
- 有困难就缩小范围并如实写进 REPORT，不许谎报 PASS。
