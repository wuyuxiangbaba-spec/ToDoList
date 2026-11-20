# REPORT — PWA + 主题 + 合规 + 时区（b/pwa）

工作文件：`b/pwa/pwa.html`（基线 base.html，commit 3e873f2）。端口：静态服务 8805 / CDP 9435。

## 一、改了什么、为什么

### 1. PWA 化（单文件约束放宽为「入口 index.html + 静态资源」）
- **新增 `sw.js`**：Service Worker，**network-first** 策略——有网永远先回源（用户数据在
  localStorage，本就不经过 SW），失败/断网才回退缓存；只接管**导航请求**与**预缓存静态资源**，
  其余同源 GET 直接放行。预缓存：`./index.html`、`./manifest.webmanifest`、`./icon-192.png`、`./icon-512.png`。
  顶部 `SW_VERSION = "v1"` 常量 + `CACHE_NAME = "signin-tracker-" + SW_VERSION`；
  activate 时删掉所有旧版本缓存并 `skipWaiting()` + `clients.claim()`。
- **新增 `manifest.webmanifest`**：name/short_name、`start_url: "./index.html"`、`scope: "./"`、
  standalone、192/512 图标（512 同时声明 maskable）。
- **新增 `icon-192.png` / `icon-512.png`**：Python Pillow 生成（暖纸底 + 绿色圆角块 + 白色对勾 +
  左上 TODO 红点，呼应应用 DONE/TODO 视觉语言）。
- **pwa.html `<head>`**：`<link rel="manifest">`、两枚 png icon、apple-touch-icon、两条
  `<meta name="theme-color">`（light/dark 各一条，按 media 区分），以及注册 SW 的内联脚本
  （`navigator.serviceWorker.register("sw.js")`，相对路径；不支持 SW 的环境安静跳过）。
- 所有 URL 全部**相对路径**，GitHub Pages 子路径（如 `/repo/`）部署不受影响。

### 2. 合规默认数据
- `DEFAULT_NODES` 从「昆仑数模 / 上海大学 / 人名 / 科研任务」替换为**中性模板树**：
  `健康作息 / 学习提升 / 工作效率` 三个顶层，每个 2–3 个二级方面，每方面 2 个三层日常小任务
  （共 24 节点，严格三层），**每个节点带一句中性说明（note）**，说明会渲染在任务块下方小字。
- 节点 id 用 `dflt-` 前缀，与旧示例集合（`LEGACY_SAMPLE_IDS`）、用户树根（`nmw…`）、
  NeurCross 预置（`nc_`）都不冲突。
- **存量数据不受影响**（迁移守卫验证过，见验收表）：守卫逻辑本身未改——
  含 `USER_ROOT_ID`（旧默认树根）或任何旧集合外 id 的数据一律原样加载；
  只有「节点 id 全部落在旧第三方 App 示例集合内」的本地数据才被替换为新中性树。
- **NeurCross 预置目录原样保留**（用户自己的研究内容），未做任何改动，加载时仍自动补齐。

### 3. 暗黑模式
- `<html data-theme="light|dark">`；`:root`（浅色暖纸，**默认，值与原来完全一致**）与
  `:root[data-theme="dark"]` 成对定义两套变量。原文件里所有写死的颜色（按钮 #fff、hover
  #f7f3eb、卡片边框 #f0c9c6/#bfe0cf、body/tree-card 渐变 tint、link-hint 胶囊等）全部改为变量引用。
- 新增 `--branch-done/--branch-todo`：浅色 = `#1f6b4a/#b42318`（原值），暗色提亮为
  `#52b387/#e08373`。JS 侧 `DONE_HEX/TODO_HEX` 改为 `refreshBranchHexes()` 从 CSS 变量取
  （切主题即刷新重画），SVG 分支、虚线连线（CSS stroke var）、目录进度圆、任务卡全部联动。
- 侧栏头部加切换按钮（🌙/☀️，与收起按钮同款样式）；偏好存**独立 key**
  `signin-tracker-theme`（"light"|"dark"），不碰 `signin-tracker-v1`；未存偏好时由
  `<head>` 引导脚本按 `prefers-color-scheme` 决定默认（引导脚本放 head 尽早执行避免闪色）。

### 4. 时区
- 搜出的全部写死点：`formatShanghai`（`timeZone: "Asia/Shanghai"`）及其在 `nowCompletedAt` /
  `normalizeAt` 里的 3 处调用、墙钟校验的 `+08:00` 拼接。已全部改为**浏览器本地时区**
  （`Intl.DateTimeFormat` 默认时区，函数更名 `formatLocalWallClock`）。
- `normalizeAt` 对无时区串的墙钟解释改为本地时区：校验用 `new Date(raw)`（ES 规范按本地
  时间解析、超界字段 NaN，保持「脏数据不原样返回」的原有保证）；带时区/ISO 串换算为本地墙钟。
- 显示带时区感知：完成时间右下角小字追加当前时区短偏移（`TZ_LABEL`，如 `GMT+8`）。
- **取舍（新数据本地时区、旧数据原样保留显示）与理由**：
  - 本应用存量 `completedAt` 全是「上海墙钟、无时区后缀」字符串。若加载时把旧串按本地时区
    重解释再换算，非 +08:00 环境每次加载都会漂移（这正是原注释警告的问题），且无法区分
    「上海墙钟旧串」与「本地墙钷新串」——没有任何元数据可判别。
  - 因此：旧串**原样返回、原样显示**（不换算、不重写），新勾选写入本地墙钟。代价是跨时区
    混排时字符串比较（`latestDoneFromChecks` 取最新）可能差一个时区偏移；对主要用户
    （Asia/Shanghai，本地=上海）偏移为 0，无实际影响。追零成本、可解释、可逆。
  - 如未来需要严格时区语义，应在写入时带偏移后缀（normalizeAt 已支持解析），一次性迁移即可。

## 二、新增/修改文件清单（b/pwa/）

| 文件 | 性质 | 说明 |
|---|---|---|
| `pwa.html` | 修改 | 本次全部页面改动（patch 见 pwa.patch） |
| `sw.js` | 新增 | Service Worker（network-first，版本常量 v1） |
| `manifest.webmanifest` | 新增 | PWA manifest（相对路径） |
| `icon-192.png` / `icon-512.png` | 新增 | Pillow 生成，已回读验证尺寸 |
| `pwa.patch` | 新增 | `git diff --no-index base.html b\pwa\pwa.html` |
| `REPORT.md` | 新增 | 本报告 |
| `shot-light.png` / `shot-dark.png` | 新增 | 验收截图（同一棵种子树） |
| serve.py / make_icons.py / verify_shots.py / check.mjs / drive.mjs / seed-neutral.js / measure-pwa.js / probe-system-dark.mjs | 测试脚本 | 本地验证用，非部署物 |
| profile/ | 测试产物 | headless Edge 用户目录 |

## 三、验收结果（预期 / 实际 / 证据 / 结论）

| # | 验收项 | 预期 | 实际 | 证据 | 结论 |
|---|---|---|---|---|---|
| 1 | manifest 解析有效 | JSON 可解析、字段齐全 | status 200、MIME `application/manifest+json`、`parses: true`、name=综合签到打卡器；Node `JSON.parse` + 字段断言通过 | 浏览器内 fetch + check.mjs | **PASS** |
| 2 | SW 注册 | register 不抛错、activate | registered=true、state=**activated**、controlled=true；`fetch('sw.js')`=200；缓存 `signin-tracker-v1` 含全部 4 个预缓存 URL | drive.mjs 输出（http://127.0.0.1:8805） | **PASS** |
| 3 | icon 存在且尺寸正确 | 192×192 / 512×512 PNG | `size=(192,192)` / `(512,512)`，format=PNG，1592/4882 字节，`im.verify()` 通过 | make_icons.py 回读输出 | **PASS** |
| 4 | 浅色截图 | 暖纸浅色、同一棵树 | shot-light.png：96.2% 浅底像素、0% 暗底；绿 225 px / 红 2151 px | verify_shots.py + 截图 | **PASS** |
| 5 | 暗色截图 | 暗底可读、同一棵树 | shot-dark.png：91.0% 暗底、0% 浅底；绿 636 px / 红 1896 px（提亮后更醒目）；--paper=#1d2026，分支 fill=#52b387/#e08373 | verify_shots.py + drive.mjs 测量 | **PASS** |
| 6 | 默认树无第三方商标词 | grep 0 命中 | 快手/抖音/红果/京东/支付宝/淘宝/拼多多/美团/番茄小说/微信 全文件 0 命中；旧人名/校名在 DEFAULT_NODES 区 0 命中 | check.mjs（35/35 通过） | **PASS** |
| 7 | 存量用户数据不受影响 | 迁移守卫生效 | 含 USER_ROOT_ID 的用户树（昆仑数模+自建节点+done/completedAt/note）原样保留；旧第三方示例树（ks/dy/jd/zfb…）被替换为中性树；NeurCross 预置 494 节点完好 | check.mjs 纯函数区注入测试 | **PASS** |
| 8 | localStorage key 不变 | 仍是 signin-tracker-v1 | 数据 key 全程未动；刷新后 catalogs=1 完整；主题用独立 key signin-tracker-theme | drive.mjs G 步 | **PASS** |
| 9 | 主题默认跟随系统 | 无偏好时随 prefers-color-scheme | CDP `Emulation.setEmulatedMedia` 模拟系统暗色 + 清 key → 刷新后 themeAttr=dark、--paper=#1d2026 | probe-system-dark.mjs | **PASS** |
| 10 | 时区本地化 | 无 Asia/Shanghai 写死 | 代码区（除注释）0 处 Asia/Shanghai/formatShanghai；浏览器 tz=Asia/Shanghai 下时间样例 `2026-11-19 23:05 GMT+8`；裸墙钟旧串原样保留；带时区串换算本地（`2026-11-17T08:10:00Z`→`2026-11-17 16:10`）；非法串 `2026-99-99 99:99`→空 | check.mjs + drive.mjs | **PASS** |
| 11 | 语法/控制台 | 无 JS 错误 | 3 段内联脚本 + sw.js `new Function` 编译通过；浏览器 console 无 error/exception | check.mjs + drive.mjs console=[] | **PASS** |

汇总：check.mjs **35/35 通过**；浏览器侧 11 项验收全 PASS。

## 四、测试环境与如实报告的限制

- 静态服务：自写 `serve.py`（端口 8805）而非 `python -m http.server`，两个目的：
  1) `.webmanifest` 按 `application/manifest+json` 返回——`http.server` 会给
     `application/octet-stream`，与 GitHub Pages 生产环境不一致；
  2) `/index.html` **别名到 pwa.html**——部署时入口就是 index.html（pwa.html 重命名），
     本地按生产形态验证 SW/manifest/start_url，无需在交付目录里复制一份 index.html。
  别名只存在于测试服务，交付物清单不含 index.html（部署时重命名即可）。
- SW 真实注册发生在 `http://127.0.0.1:8805`（localhost 属安全上下文），**不是** about:blank，
  所以「activated + controlled + 缓存 4 项」是真实结果，不是存在性推断。
- 无头浏览器为 headless Edge 157，无法人眼复核截图，用 Pillow 像素统计替代（上表 #4/#5）。
- `theme-color` meta 用 media 区分浅/暗，跟随系统而非手动切换值——浏览器标题栏颜色与手动
  切换可能短暂不一致（标准做法，无功能影响）。

## 五、部署注意（GitHub Pages）

1. **文件摆放**：`pwa.html` 重命名为 `index.html`，与 `sw.js`、`manifest.webmanifest`、
   `icon-192.png`、`icon-512.png` 放同一目录。全部相对路径，**子路径部署（username.github.io/repo/）无问题**，
   不需要改任何 URL。
2. **HTTPS**：GitHub Pages 自带，SW 才会注册；本地 file:// 打开时 SW 注册被跳过（页面功能不受影响）。
3. **SW 版本更新策略**：改任何预缓存文件（index.html/图标/manifest）时，**必须把 `sw.js` 里的
   `SW_VERSION` 从 v1 升到 v2**。CACHE_NAME 随之变化，activate 清旧缓存 + skipWaiting + claim，
   用户刷新一次即完成升级。只改文件不升版本 → 老客户端断网兜底仍是旧缓存（network-first 下
   在线用户始终拿新版，仅离线兜底滞后）。
4. **GitHub Pages 的 `manifest.webmanifest` MIME 正确**（application/manifest+json），无需 _headers 配置。

## 六、已知风险与未做部分

- **时区混排**（见一.4）：旧上海墙钟串与新本地墙钟串并存时字符串比较可能差一个偏移；
  对 +08:00 用户偏移为 0。已选择不改写旧数据（保守、无损）。
- **本页勾选时间不重写历史**：旧串不迁移意味着若未来用户跨时区搬家，旧记录仍显示当年上海墙钟
  字面值（无时区元数据，本就无法还原绝 对时刻）。
- **图标为程序生成简单图形**，非设计稿；如需品牌化替换文件并 bump SW_VERSION 即可。
- 未做：APK/TWA 包装、push 通知、多语言 manifest（当前 zh-CN 单语）。
- legacy `LEGACY_SAMPLE_IDS`（ks/dy/jd 等旧 id 助记）保留在迁移守卫里，属功能必需（识别旧示例数据），
  不在任何 UI 上展示。
