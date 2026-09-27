export function validFamilyConfig(config) {
  try {
    const url = new URL(config.endpoint);
    return config.mode === 'family' && url.protocol === 'https:' && !url.username && !url.password
      && !url.search && !url.hash && url.hostname.endsWith('.supabase.co')
      && url.pathname === '/functions/v1/family-access'
      && /^[a-f0-9-]{36}$/.test(config.treeId) && /^[a-f0-9]{64}$/.test(config.sourceSha);
  } catch { return false; }
}
export function validSession(session, config, now = Date.now()) {
  return validFamilyConfig(config) && session?.treeId === config.treeId && session?.endpoint === config.endpoint
    && typeof session.token === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(session.token)
    && session.token.length < 1500 && Number.isFinite(session.expiresAt)
    && session.expiresAt > now && session.expiresAt <= now + 7 * 24 * 3600000;
}
export function gatewayResource(url, base) {
  const item = new URL(url, base), root = new URL('./', base);
  if (item.origin !== root.origin || item.search || item.hash) return '';
  if (item.href === new URL('data/tree.json', root).href) return '/tree';
  const prefix = new URL('data/media/', root).href;
  const name = item.href.startsWith(prefix) ? item.href.slice(prefix.length) : '';
  return /^[a-f0-9]{64}\.(jpg|png|gif|webp)$/.test(name) ? '/media/' + name : '';
}
export function accessStore(config, factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!validFamilyConfig(config) || !factory) return reject(new Error('Accès familial indisponible.'));
    const request = factory.open('heritage-access-' + config.treeId, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      function operation(mode, work) {
        return new Promise((done, fail) => {
          const tx = db.transaction('session', mode); let value;
          tx.oncomplete = () => done(value); tx.onabort = () => fail(tx.error); tx.onerror = () => {};
          const result = work(tx.objectStore('session'));
          result.onsuccess = () => { value = result.result; };
        });
      }
      resolve({ get: () => operation('readonly', store => store.get('current')),
        set: value => operation('readwrite', store => store.put(value, 'current')),
        clear: () => operation('readwrite', store => store.delete('current')), close: () => db.close() });
    };
  });
}
