// Site-wide service worker: keeps the itinerary pages readable offline.
// Bump CACHE_VERSION whenever the precache list or caching logic changes; content edits to
// listed files do not need a bump because pages and payloads are fetched network-first.
const CACHE_VERSION = 'v1-2026-11-05';
const CACHE_PREFIX = 'jormal-offline-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const META_KEY = '__offline-meta__';
const NETWORK_TIMEOUT_MS = 6000;
const PRECACHE_TIMEOUT_MS = 20000;

// Paths are relative to this file (the site root). Directory pages end with "/".
// scripts/verify-static-site.mjs checks that every entry exists in the repository.
// PRECACHE-START
const PRECACHE = [
  './',
  'assets/favicon.svg',
  'assets/itinerary.css',
  'assets/travel-log.css',
  'assets/offline.js',
  'info/',
  'info/plan/',
  'info/plan/iberian-passage-2026/',
  'info/plan/iberian-passage-2026/unlock.js',
  'info/plan/iberian-passage-2026/crypto.js',
  'info/plan/iberian-passage-2026/data.enc.json',
  'info/log/',
  'info/log/iberian-passage-2026/',
  'temp/lisbon-sevilla/',
  'temp/lisbon-sevilla/data.enc.json',
];
// PRECACHE-END

// Without these the protected plan cannot be read offline.
const ESSENTIAL = [
  'assets/itinerary.css',
  'assets/offline.js',
  'info/plan/iberian-passage-2026/',
  'info/plan/iberian-passage-2026/unlock.js',
  'info/plan/iberian-passage-2026/crypto.js',
  'info/plan/iberian-passage-2026/data.enc.json',
];

const IMAGE_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

function scopeUrl(path) {
  return new URL(path, self.registration.scope).href;
}

function isPage(url) {
  return url.endsWith('/') || url.endsWith('.html');
}

// Images referenced by cached pages (wine photos and thumbnails) are cached too, so the
// precache list does not have to name every image.
function imageUrlsIn(html, pageUrl) {
  const urls = new Set();
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)["']/gi)) {
    const url = new URL(match[1], pageUrl);
    if (url.origin === self.location.origin && IMAGE_PATTERN.test(url.pathname)) urls.add(url.href);
  }
  return [...urls];
}

async function writeMeta(cache, meta) {
  await cache.put(scopeUrl(META_KEY), new Response(JSON.stringify(meta), {
    headers: { 'content-type': 'application/json' },
  }));
}

async function readMeta() {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(scopeUrl(META_KEY));
  return response ? response.json() : null;
}

function fetchWithTimeout(input, init = {}, ms = PRECACHE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isCacheable(response) {
  return response.ok && response.status !== 206 && response.type === 'basic' && !response.redirected;
}

async function safePut(cache, key, response) {
  try {
    await cache.put(key, response);
    return true;
  } catch {
    // Quota or unsupported response: the page still gets the network response.
    return false;
  }
}

// Fetch every listed file one by one so a single missing file (for example an undeployed
// temp page) does not abort the whole offline copy. A file that cannot be fetched keeps the
// copy from this or an older cache version, and counts as missing only when no copy exists.
async function precache({ reload }) {
  const cache = await caches.open(CACHE_NAME);
  const previous = await readMeta();
  const failed = [];
  const images = new Set();
  let saved = 0;

  await Promise.all(PRECACHE.map(async (path) => {
    const url = scopeUrl(path);
    try {
      const response = await fetchWithTimeout(url, { cache: reload ? 'reload' : 'no-cache' });
      if (!isCacheable(response)) throw new Error(String(response.status));
      if (isPage(url)) {
        for (const image of imageUrlsIn(await response.clone().text(), url)) images.add(image);
      }
      if (!(await safePut(cache, url, response))) throw new Error('cache write failed');
      saved += 1;
    } catch {
      if (await cache.match(url)) return;
      const older = await caches.match(url);
      if (!older || !(await safePut(cache, url, older))) failed.push(path);
    }
  }));

  // Nothing reached the network: keep the existing offline copy and its timestamp.
  if (saved === 0 && previous) return { ...previous, refreshFailed: true };

  // Images rarely change: reuse any cached copy (also across cache versions) and fetch only
  // the missing ones.
  await Promise.all([...images].map(async (url) => {
    if (await cache.match(url)) return;
    try {
      const older = await caches.match(url);
      const response = older ?? await fetchWithTimeout(url);
      if (isCacheable(response)) await safePut(cache, url, response);
    } catch {
      // Images are optional for reading the itinerary.
    }
  }));

  const meta = { version: CACHE_VERSION, updated: new Date().toISOString(), saved, failed: failed.sort() };
  await writeMeta(cache, meta);
  return meta;
}

// A new version only takes over when the files needed to read the plan offline are cached;
// otherwise installation fails and the previous version (and its cache) stays in charge.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const meta = await precache({ reload: false });
    const missing = ESSENTIAL.filter((path) => meta.failed.includes(path));
    if (missing.length) {
      await caches.delete(CACHE_NAME);
      throw new Error(`Missing essential offline files: ${missing.join(', ')}`);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Directory pages may be requested as ".../index.html" or without a trailing slash.
async function matchCached(cache, request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  const candidates = [url.href];
  if (url.pathname.endsWith('/index.html')) candidates.push(url.href.slice(0, -'index.html'.length));
  else if (request.mode === 'navigate' && !url.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(url.pathname)) candidates.push(`${url.href}/`);
  for (const candidate of candidates) {
    const response = await cache.match(candidate);
    if (response) return response;
  }
  return null;
}

function cacheKey(request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  if (url.pathname.endsWith('/index.html')) url.pathname = url.pathname.slice(0, -'index.html'.length);
  return url.href;
}

// Network first so updates arrive whenever the phone is online; fall back to the cached copy
// when the network fails, answers with an error, or is too slow.
async function networkFirst(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const network = fetch(request).then(async (response) => {
    if (isCacheable(response)) await safePut(cache, cacheKey(request), response.clone());
    return response;
  });
  event.waitUntil(network.catch(() => {}));

  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(resolve, NETWORK_TIMEOUT_MS, null); });
  let response = null;
  try {
    response = await Promise.race([network, timeout]);
    if (response?.ok) return response;
  } catch {
    // Offline: use the cached copy below.
  } finally {
    clearTimeout(timer);
  }

  const cached = await matchCached(cache, request);
  if (cached) return cached;
  return response ?? network;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await matchCached(cache, request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) await safePut(cache, cacheKey(request), response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (url.href === scopeUrl(META_KEY) || request.headers.has('range')) return;

  if (IMAGE_PATTERN.test(url.pathname)) event.respondWith(cacheFirst(request));
  else event.respondWith(networkFirst(event));
});

self.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (!port) return;
  const { type } = event.data ?? {};
  const work = type === 'refresh' ? precache({ reload: true }) : readMeta();
  event.waitUntil(work
    .then((meta) => port.postMessage({ ok: true, meta }))
    .catch((error) => port.postMessage({ ok: false, error: String(error) })));
});
