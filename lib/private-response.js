import { validSession, gatewayResource } from './family-session.js';

export async function privateResponse(request, { config, base, sessionStore, cache, fetcher = fetch, now = Date.now }) {
  const denied = () => new Response('Code familial requis', { status: 401 });
  const route = gatewayResource(request.url, base);
  if (!route || request.method !== 'GET') return new Response('Ressource inconnue', { status: 404 });
  const session = await sessionStore.get();
  if (!validSession(session, config, now())) return denied();
  const stillAuthorized = async () => {
    const latest = await sessionStore.get();
    return latest?.token === session.token && validSession(latest, config, now());
  };
  const saved = await cache.match(request);
  if (saved && route !== '/tree') return await stillAuthorized() ? saved : denied();
  try {
    const response = await fetcher(config.endpoint + route, {
      headers: { Authorization: 'Bearer ' + session.token }, cache: 'no-store', signal: AbortSignal.timeout(25000)
    });
    if (response.status === 401 || response.status === 403) {
      // Do not erase a newer session created in another tab during this request.
      if (await stillAuthorized()) await sessionStore.clear();
      return denied();
    }
    if (!response.ok) throw new Error('Indisponible');
    if (route === '/tree') {
      const data = await response.clone().json();
      if (!data.people?.[data.meta?.rootId] || data.meta.sha256 !== config.sourceSha) throw new Error('Arbre invalide');
    } else if (!response.headers.get('Content-Type')?.startsWith('image/')) throw new Error('Image invalide');
    if (!await stillAuthorized()) return denied();
    try { await cache.put(request, response.clone()); } catch { /* Online reading survives a full cache. */ }
    return response;
  } catch {
    if (!await stillAuthorized()) return denied();
    return saved || new Response('Copie hors connexion indisponible', { status: 503 });
  }
}
