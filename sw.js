// Héritage 0.18.1 — arbre jusqu’à neuf générations, cadrage conservé ; change this marker with every release.
import { SHELL, SHELL_CACHE, DATA_CACHE, MEDIA_CACHE, resourceType } from './lib/offline-config.js';
import { runtime } from './runtime-config.js';
import { accessStore } from './lib/family-session.js';
import { privateResponse } from './lib/private-response.js';
let familyStore;

self.addEventListener('install', event => {
  // A partial new shell must never replace the working version.
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try { await cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' }))); }
    catch (error) { await caches.delete(SHELL_CACHE); throw error; }
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('heritage-shell-') && name !== SHELL_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const type = resourceType(event.request.url, self.registration.scope);
  if (!type) return;
  event.respondWith((async () => {
    const cache = await caches.open(type === 'shell' ? SHELL_CACHE : type === 'data' ? DATA_CACHE : MEDIA_CACHE);
    if (runtime.mode === 'family' && type !== 'shell') {
      try {
        familyStore ||= await accessStore(runtime);
        return await privateResponse(event.request, { config: runtime, base: self.registration.scope, sessionStore: familyStore, cache });
      } catch { return new Response('Accès familial indisponible', { status: 503 }); }
    }
    const saved = await cache.match(event.request);
    if (saved && type !== 'data') return saved;
    try {
      const response = await fetch(event.request);
      if (!response.ok) throw new Error('Ressource indisponible');
      if (type === 'data') {
        // Keep the last complete tree if a server returns an HTML error or malformed JSON.
        const data = await response.clone().json();
        if (!data.people?.[data.meta?.rootId]) throw new Error('Arbre invalide');
      }
      // A quota failure must not prevent online consultation.
      try { await cache.put(event.request, response.clone()); } catch { /* UI checks actual cache contents. */ }
      return response;
    } catch {
      return saved || new Response('Ressource non disponible hors connexion', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
