/* Isolated public map cache. No auth, admin, partner, lead or third-party requests. */
const CONTROL = "offplan-map-control-v1";
const PREFIX = "offplan-map-package-v1-";
const POINTER = "/offline-map/__current_package__";
const SHELL = "/offline-map/app";
const DATA = "/api/public-map";
const LAND = "/map-assets/sea-land-v1.json";
let saving = false;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

function allowed(url) {
  return url.origin === self.location.origin && (url.pathname === SHELL || url.pathname === DATA || url.pathname === LAND || url.pathname.startsWith("/_next/static/"));
}
async function current() {
  const response = await (await caches.open(CONTROL)).match(POINTER);
  return response ? response.json() : null;
}
async function stored(request) {
  const active = await current();
  return active ? (await caches.open(active.name)).match(request) : undefined;
}

self.addEventListener("message", event => {
  const port = event.ports[0];
  if (!port) return;
  if (event.data?.type === "STATUS") {
    event.waitUntil(current().then(active => port.postMessage({type:"STATUS",saved:active?.saved ?? null})));
    return;
  }
  if (event.data?.type !== "SAVE_MAP") return;
  if (saving) { port.postMessage({type:"ERROR",message:"Сохранение карты уже выполняется в другой вкладке."}); return; }
  saving = true;
  event.waitUntil((async () => {
    const name = PREFIX + Date.now() + "-" + crypto.randomUUID();
    try {
      const resources = event.data.resources;
      if (!Array.isArray(resources) || resources.length > 200) throw Error("Слишком большой список файлов карты.");
      const urls = [...new Set([SHELL, DATA, LAND, ...resources].map(value => {
        if (typeof value !== "string") throw Error("Некорректный файл карты.");
        const url = new URL(value, self.location.origin);
        if (!allowed(url) || url.search || url.hash) throw Error("В офлайн-пакет разрешены только публичные файлы карты.");
        return url.href;
      }))];
      const cache = await caches.open(name);
      let bytes = 0, projects = 0;
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const response = await fetch(url, {credentials:"omit"});
        if (!response.ok || response.type === "opaque") throw Error("Не удалось загрузить все файлы. Подключение нужно для полного сохранения.");
        const body = await response.clone().arrayBuffer();
        bytes += body.byteLength;
        if (bytes > 25 * 1024 * 1024) throw Error("Пакет больше 25 МБ. Сохранение остановлено, предыдущая версия сохранена.");
        if (new URL(url).pathname === DATA) {
          const snapshot = await response.clone().json();
          if (snapshot.version !== 1 || !Array.isArray(snapshot.projects) || !snapshot.downloadedAt) throw Error("Публичный снимок не прошёл проверку.");
          projects = snapshot.projects.length;
        }
        await cache.put(url, response);
        port.postMessage({type:"PROGRESS",done:i+1,total:urls.length});
      }
      const saved = {savedAt:new Date().toISOString(),resources:urls.length,projects,bytes};
      // Change the pointer only after every required file is stored. Failed updates preserve the old package.
      await (await caches.open(CONTROL)).put(POINTER, new Response(JSON.stringify({name,saved}), {headers:{"Content-Type":"application/json"}}));
      for (const old of await caches.keys()) if (old.startsWith(PREFIX) && old !== name) await caches.delete(old);
      port.postMessage({type:"SAVED",saved});
    } catch (error) {
      await caches.delete(name);
      port.postMessage({type:"ERROR",message:error instanceof Error ? error.message : "Не удалось сохранить карту."});
    } finally {
      saving = false;
    }
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || !allowed(url)) return;
  if (request.mode === "navigate" && url.pathname === SHELL) {
    event.respondWith((async () => {
      try { const response = await fetch(request); if (response.ok) return response; } catch { /* use saved public shell */ }
      return await stored(new URL(SHELL,self.location.origin).href) ?? new Response("Карта не сохранена. Сначала откройте её с интернетом и нажмите «Сохранить для офлайн».", {status:503,headers:{"Content-Type":"text/plain;charset=utf-8"}});
    })());
    return;
  }
  if (url.pathname === DATA) {
    event.respondWith((async () => {
      try { const response = await fetch(request); if (response.ok) return response; } catch { /* use dated snapshot */ }
      return await stored(new URL(DATA,self.location.origin).href) ?? new Response(JSON.stringify({error:"Публичный снимок ещё не сохранён"}), {status:503,headers:{"Content-Type":"application/json"}});
    })());
    return;
  }
  event.respondWith((async () => await stored(request) ?? fetch(request))());
});
