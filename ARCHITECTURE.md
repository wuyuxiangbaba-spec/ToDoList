# 综合签到打卡器 · 架构说明

> 本文档描述当前单文件应用的架构、数据 Schema，以及商用化改造（Phase B）的设计决策与后续路线。
> 部署形态：GitHub Pages 根路径 `index.html`，纯静态、无构建、离线可用（PWA 化见 Phase B-5）。

## 1. 总体架构（现状）

单文件 `index.html`（约 3400 行），四个逻辑层：

| 层 | 位置（行号区间大致） | 职责 |
|---|---|---|
| 纯函数数据层 | `CATALOG-PURE-START..END` | normalize/finalize/迁移：localStorage 原始字符串 → 多目录状态；环检测断环、重复 id 去重、旧格式迁移 |
| 视图虚拟化层 | `VIEWPORT-VIRTUALIZATION` | 整树布局算世界坐标，DOM 只渲染视野附近；平移/缩放 rAF 节流补画 |
| 路由库 | `ROUTE-LIB-START..END` | 纯函数几何：接驳边选择、三次贝塞尔、色带法线扩宽 |
| 交互层 | 其余 | 右键菜单、内联编辑器、拖拽改挂、连线模式、日历 |

渲染流水线：`render()` → `renderTree()`（两遍布局：先估行高，DOM 实测后重排 + 局部避挡右移）→ rAF 内缓存 `layoutCache` → `updateViewport(true)` 拼 SVG innerHTML。

### 1.1 分支（父子实线）
- **每条父子边一条完整三次贝塞尔色带**：中心线 `M x1,y1 C midX,y1 midX,y2 x2,y2`；`x1=`父块右缘-1，`x2=`子块左缘+1，`midX=(x1+x2)/2`。两端切线水平，多兄弟共用起点、靠曲线自然分开，无共享主干/竖脊。
- 色带 = 中心线沿切线法线扩宽（父端半宽 3.9 → 子端 2.0，`cubicRibbon`），fill = 子节点完成色（DONE_HEX/TODO_HEX）。

### 1.2 关联虚线（任务连线）
- **数据只存节点 ID**：`state.links = [{ a, b }]`（规范化时 a<b 排序去重、双端存在性过滤）。
- **不存任何像素坐标**：`updateViewport` 每帧用当前 `cardRects` 现算接驳点（`rlSideToward` 选朝向对方的边）与三次 S 曲线；端点卡片缺失即跳过（不画悬空线）。
- 命中区 `.mindmap-link-hit` 同路径加宽透明，右键断线。

## 2. 数据 Schema（localStorage key: `signin-tracker-v1`）

```jsonc
{
  "treeVersion": 2,
  "sidebarOpen": true,
  "neurCrossHidden": false,
  "currentCatalogId": "cat_xxx",
  "catalogInserts": [ { "catalog": "cat_a", "node": "n1", "target": "cat_b" } ],
  "catalogs": [
    {
      "id": "cat_xxx",
      "name": "默认目录",
      "archVersion": 0,            // NeurCross 预置树版本守卫
      "nodes": [
        { "id": "n1", "name": "…", "parentId": null|"n0",
          "done": false, "completedAt": "", "note": "" }
      ],
      "links": [ { "a": "n1", "b": "n2" } ],
      "linkDone": { "n2": true }   // 「被连线连带完成」标记
    }
  ]
}
```

- 完成态挂在叶子；分支完成态由子树派生（加载时清分支残留 done）。
- 兼容链：`nodeChecks[date][id]` → 单树 nodes/links → 多目录 catalogs（`resolveCatalogState` 逐级迁移，用户编辑永不回退）。

## 3. Phase B 商用化改造（已落地，2026-11-20）

保持单文件 + 无构建的部署约束，六轨并行实现并经独立验收工装回归（A1–A8 桌面 7/8 PASS，A6 移动端弹窗清零、无可见横向滚动；工装对画布 scrollWidth 的断言为 overflow:hidden 裁剪伪影，实测 innerWidth=clientWidth=390）：

| 轨道 | 内容 | 数据模型变化 | 状态 |
|---|---|---|---|
| B-1 撤销/重做 | ≥30 步历史栈，Ctrl+Z / Ctrl+Shift+Z，时间戳原样恢复（防伪验证：篡改时间源后重做仍恢复原值） | 无（内存态） | ✅ |
| B-2 日历打卡 | 节点 `kind: "once"|"daily"`；`dailyChecks[dateStr][nodeId]` 按本地时区按天记录；日历热力/完成度、Streak、补签；打卡可撤销 | 新增可选字段 + catalogs 级新 map | ✅ |
| B-3 移动端 | 自定义 Modal/Toast 取代 confirm/alert（全文 0 处原生调用）；长按 Action Sheet；双指缩放/单指平移；<760px 侧栏抽屉 | 无 | ✅ |
| B-4 画布控件 | 缩放工具条 + 一键 fit + 全部展开；节点折叠（徽章 n/m，持久化）；搜索高亮 + 只看未完成；长文本防重叠修复（基线 6 对→0） | 节点可选 `collapsed` | ✅ |
| B-5 PWA/主题/合规 | manifest + SW 离线（真实注册验证 activated）；中性默认模板（去第三方商标，grep 0 命中）；暗黑模式；本地时区 | 独立 key `signin-tracker-theme` | ✅ |
| B-6 验收工装 | run.mjs：重叠/反向曲线/虚线贴合/环数据/移动视口/原生弹窗拦截 等矩阵 | 无 | ✅ |

所有新字段可选、默认值等价旧行为；存量数据无损加载是硬约束。

## 4. 后续路线（本轮不做）

1. **工程化重构**：React + TS + Vite + Tailwind，组件化局部更新替代 innerHTML 全量重建；本仓库保持 Pages 直出，构建产物可后续切 `dist/`。
2. **Local-First 同步抽象**：`StorageAdapter`（IndexedDB 迁移）→ `CloudSyncAdapter`（Supabase/自建，增量 + LWW 冲突合并）。
3. 节点上限/性能护栏、错误上报（Sentry 自托管）、隐私政策页、免费/Pro 功能开关。

## 5. 验收基线（已固化于 .mindmap-test）

- 分支：path 数 === 父子边数；无竖脊；10/10 边几何匹配。
- 虚线：打卡切换前后端点到当前卡片接驳边中点距离 0px（容差 1.5px）。
- 语法：`node --check` 通过；0 console exception。
