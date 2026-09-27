import { SHELL, SHELL_CACHE, DATA_CACHE, MEDIA_CACHE } from './offline-config.js';
import { runtime } from '../runtime-config.js';
import { accessStore, validSession } from './family-session.js';

async function hasAccess() {
  if (runtime.mode !== 'family') return true;
  const store = await accessStore(runtime);
  try { return validSession(await store.get(), runtime); } finally { store.close(); }
}

export async function prepareOffline(data) {
  if (!await hasAccess()) throw new Error('Votre accès familial a expiré. Rouvrez l’application avec le code.');
  if (!('serviceWorker' in navigator) || !globalThis.isSecureContext || !globalThis.caches) {
    throw new Error('Le hors connexion nécessite un navigateur compatible et une adresse HTTPS ou locale.');
  }
  const registration = await navigator.serviceWorker.register('./sw.js', { type: 'module', updateViaCache: 'none' });
  await registration.update();
  await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Préparation en attente. Réessayez dans quelques instants.')), 20000))]);
  const cache = await caches.open(DATA_CACHE);
  await cache.put(new URL('./data/tree.json', location.href), new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
  await navigator.storage?.persist?.().catch(() => false);
  return registration;
}

export function localImages(data) {
  const images = new Set();
  const visit = value => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      if (/^\.\/data\/media\/[a-f0-9]{64}\.(jpg|png|gif|webp)$/.test(value.localFile || '')) images.add(value.localFile);
      Object.values(value).forEach(child => { if (child && typeof child === 'object') visit(child); });
    }
  };
  visit(data.people); visit(data.families);
  return [...images];
}

export async function offlineStatus(data) {
  if (!await hasAccess()) return { ready: false, photos: 0, total: localImages(data).length };
  if (!globalThis.caches) return { ready: false, photos: 0, total: localImages(data).length };
  const shell = await caches.open(SHELL_CACHE), corpus = await caches.open(DATA_CACHE), images = await caches.open(MEDIA_CACHE);
  const shellResults = await Promise.all(SHELL.map(path => shell.match(new URL(path, location.href))));
  const saved = await corpus.match(new URL('./data/tree.json', location.href));
  const sameTree = saved ? (await saved.json()).meta?.sha256 === data.meta.sha256 : false;
  const keys = new Set((await images.keys()).map(request => request.url));
  const paths = localImages(data);
  return { ready: Boolean(navigator.serviceWorker?.controller && sameTree && shellResults.every(Boolean)), photos: paths.filter(path => keys.has(new URL(path, location.href).href)).length, total: paths.length };
}

export async function cacheAllImages(data, onProgress, signal) {
  const cache = await caches.open(MEDIA_CACHE), paths = localImages(data);
  let next = 0, done = 0, failures = 0;
  async function worker() {
    while (next < paths.length && !signal.aborted) {
      const url = new URL(paths[next++], location.href);
      try {
        if (!await cache.match(url)) {
          const response = await fetch(url, { signal });
          if (!response.ok || !response.headers.get('Content-Type')?.startsWith('image/')) throw new Error('Image indisponible');
          await cache.put(url, response);
        }
      } catch (error) {
        if (signal.aborted) break;
        if (error.name === 'QuotaExceededError') throw new Error('Espace insuffisant. Les images déjà conservées restent disponibles.');
        failures++;
      }
      onProgress({ done: ++done, total: paths.length, failures });
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return { done, total: paths.length, failures, canceled: signal.aborted };
}
