# 任务：思维导图分支曲线 + 关联虚线稳定重绘

## 背景
- 生产文件（唯一真相）：C:\Users\25988\Desktop\ToDoList\index.html（160KB，3431 行）。
- 桌面上的 C:\Users\25988\Desktop\.html 是 2026-11-18 的旧版（1081 行），不是当前应用，**不要改它**。
- 静态服务已运行：http://127.0.0.1:8791/  （根目录就是 ToDoList/index.html）
- 基线截图/复现脚本在 C:\Users\25988\Desktop\.mindmap-test\（shot.mjs、seed-basic.js、measure.js）。

## 已复现的 bug（baseline）
树：p -> a,b,c；a -> a1,a2,a3；b -> b1；c -> c1,c2；links = a1-b1, a2-c1, a3-c2。
点击 a1 完成后，a1 卡片从 y=27,h=19 变为 y=33,h=21；b1 从 y=118 变为 y=136；
但 .mindmap-link 仍是 "M 698.0 36.5 C 698.0 62.5, 698.0 82.5, 698.0 108.5"，
端点停在旧卡片边缘 → 虚线脱节。原因：renderTree 先 linkPathCache.clear()，applyPan()
的 rAF 用旧 layoutCache 重算并写入缓存，随后真正的布局 rAF 测量新卡片却复用旧缓存。

## 需求 1：父子分支改为「每个子节点一条完整平滑曲线」
- 删除多兄弟的「短主干 + 竖脊 + 圆角水平接出」方案（branchSpines / BRANCH_STEM / BRANCH_HALF_W_SPINE / ribbonFromSamples / sampleRoundedPolyline 如无其他引用可删）。
- 每个子节点单独一条曲线：从父块右边中点水平离开，从子块左边中点水平进入；多兄弟共用起点，靠曲线自然分开。
- 曲线中心线严格按：M x1,y1 C midX,y1 midX,y2 x2,y2，其中 x1=父块右缘-1，y1=父块垂直中心，x2=子块左缘+1，y2=子块垂直中心，midX=(x1+x2)/2。
- 继续使用现有 cubicRibbon 的「沿切线法线扩宽」视觉（父端半宽 3.9 → 子端半宽 2.0，fill=子节点完成色），不要退回 y±w 的竖偏移。
- 单子节点也使用同一 midX 公式（不要 x1+stem / x2-stem）。
- 保留 branchCorridors（每条边/每组一个包围盒即可，虚线目前已忽略软障碍）。
- 要求：分支 path 数 = 父子边数（不再有额外 spine path）；不得出现竖直脊线。

## 需求 2：关联虚线只存节点 ID，每次布局后按当前盒子重画
- state.links 本来已是 {a,b} 节点 id；保留这个数据模型，不要存像素坐标。
- 删除 linkPathCache 与 linkSoftRects（以及相关 clear/reset）。updateViewport 每帧绘制时直接用当前 cardRects 里的 ra/rb 调 rlPlanLinkPath(ra, rb)（或 rlTwoPointCurve(rlAttachPoint(...))）重新算端点与曲线。
- 端点找不到（ra/rb 缺失）就 continue，不画悬空线；不要用一个旧路径兜底。
- 每次布局 rAF 末尾的 updateViewport(true) 必须画出与最新卡片几何一致的线。
- 不要为了性能恢复「按 a+b 缓存路径」；连线数量很小，cubic 计算是常数级。
- 保留现有命中区 .mindmap-link-hit（data-link-a/b、同 d）与右键断线逻辑。

## 交付物
- 修改后的完整 HTML 副本（各自 agent 目录内），以及相对生产文件的 unified diff / patch。
- 不改生产文件、不提交 git、不改桌面 .html。
- 写一份 REPORT.md：改了什么、如何验证、截图路径、数值证据、已知风险。
