// 综合签到打卡器 Service Worker
// 缓存策略：network-first —— 有网永远先拿最新（本地数据在 localStorage，不受影响），
// 断网/失败时回退缓存；只接管导航请求与预缓存静态资源，其余请求不经过 SW。
//
// 版本更新策略：改任何预缓存内容时，把 SW_VERSION 常量 +1（v1 → v2 …）。
// CACHE_NAME 随版本变化，activate 时清掉全部旧版本缓存并 skipWaiting + clients.claim，
// 用户刷新一次即完成升级；不改版本号只改文件，老客户端会一直用旧缓存兜底。

const SW_VERSION = "v1";
const CACHE_NAME = "signin-tracker-" + SW_VERSION;

// 预缓存：入口 index.html 与图标（全部相对路径，GitHub Pages 子路径部署无影响）
const PRECACHE_URLS = [
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // allSettled：个别资源暂时取不到也不阻塞安装（fetch 兜底仍会先走网络）
    await Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // 只保留当前版本缓存，旧版本全部清掉（版本号即更新开关）
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  const isNav = req.mode === "navigate";
  const precached = PRECACHE_URLS.some((u) =>
    url.pathname === new URL(u, self.location.href).pathname);
  if (!isNav && !precached) return; // 其余请求（如同源 JSON）直接放行

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone()); // 拿到新版顺手刷新缓存
      }
      return fresh;
    } catch (e) {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (isNav) { // 导航兜底：离线时回缓存里的入口页
        const index = await cache.match("./index.html");
        if (index) return index;
      }
      return new Response("离线且无缓存", { status: 503, statusText: "Offline" });
    }
  })());
});
