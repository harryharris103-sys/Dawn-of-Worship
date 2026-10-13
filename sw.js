/* DOW Software — offline cache (service worker)
   Keeps the app itself (index.html) and the PPTX unzip library available with no internet.
   Bibles, songs, media, PPTX decks, fonts and templates are NOT stored here — they already
   live in the browser's own storage (IndexedDB / localStorage) and are available offline.
   Optional hygiene: bump VERSION when you ship a new release (the page itself always
   refreshes from the network first when online, so forgetting is harmless). */
const VERSION = 'v1.8.0';
const SHELL = 'dow-shell-' + VERSION;
const LIBS = 'dow-libs-v1';
const SHELL_URLS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const LIB_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'];
const NET_TIMEOUT = 3000; // church wifi can hang — fall back to the saved copy after 3 s

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    // one by one, so a single failure never blocks the whole install
    for (const u of SHELL_URLS) { try { await shell.add(new Request(u, { cache: 'reload' })); } catch (err) {} }
    const libs = await caches.open(LIBS);
    for (const u of LIB_URLS) {
      try { if (!(await libs.match(u, { ignoreVary: true }))) { const r = await fetch(new Request(u, { mode: 'cors' })); if (r.ok) await libs.put(u, r); } } catch (err) {}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('dow-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([fetch(req), timeout(NET_TIMEOUT)]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html'));
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (LIB_URLS.includes(url.href)) { e.respondWith(cacheFirst(req, LIBS)); return; }
  if (url.origin !== location.origin) return;                  // GitHub API, online Bible sites, etc. — never touched
  const path = url.pathname;
  const dir = location.pathname.replace(/[^/]*$/, '');         // folder the app lives in
  if (req.mode === 'navigate' || path === dir || path.endsWith('/index.html')) { e.respondWith(networkFirst(req)); return; }
  if (SHELL_URLS.some(u => new URL(u, location.href).pathname === path)) e.respondWith(cacheFirst(req, SHELL));
});
