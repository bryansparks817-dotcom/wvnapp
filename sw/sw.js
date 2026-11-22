// The Pass service worker: keeps a copy of the app on the phone so it opens
// and runs with no signal (a client's kitchen, a walk-in dead zone). The
// kitchen's data itself lives in localStorage and syncs when back online.
//
// The build fills in BUILD and PRECACHE (see vite.config.js).
const BUILD = "__BUILD__";
const PRECACHE = __PRECACHE__;
const CACHE = `the-pass-${BUILD}`;
const FONTS = "the-pass-fonts";

const FONT_CSS = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&family=Oswald:wght@500;600&display=swap";

// The app's fonts, so it looks the same offline. Best effort: the app still
// works with the phone's own fonts if this fails.
async function saveFonts() {
  try {
    const cache = await caches.open(FONTS);
    if (await cache.match(FONT_CSS)) return;
    const css = await fetch(FONT_CSS);
    if (!css.ok) return;
    const text = await css.clone().text();
    await cache.put(FONT_CSS, css);
    const files = [...text.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]);
    await Promise.all(files.map(async (url) => {
      const res = await fetch(url, { mode: "cors" });
      if (res.ok) await cache.put(url, res);
    }));
  } catch {
    // offline or blocked: the fonts get saved on a later visit
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([caches.open(CACHE).then((cache) => cache.addAll(["/", ...PRECACHE])), saveFonts()]).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first for the page itself (so a new version shows up as soon as
// there's signal), falling back to the saved copy after 4 seconds or offline.
async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 4000)),
    ]);
    if (response.ok) cache.put("/", response.clone());
    return response;
  } catch {
    return (await cache.match("/", { ignoreVary: true })) ?? Response.error();
  }
}

// Saved copy first for build files and fonts (their names never change).
async function saved(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true, ignoreSearch: false });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(page(request));
  } else if (url.origin === self.location.origin && (url.pathname.startsWith("/assets/") || PRECACHE.includes(url.pathname))) {
    event.respondWith(saved(request, CACHE));
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(saved(request, FONTS));
  }
  // Everything else (the shared database) goes straight to the network.
});
