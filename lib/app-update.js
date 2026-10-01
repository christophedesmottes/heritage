// Updating the shell never clears IndexedDB, the tree or the photo cache.
export function createAppUpdater({ serviceWorker, canReload, status, reload }) {
  let registration, checking, pendingReload = false, reloading = false;
  let controlled = Boolean(serviceWorker?.controller);
  const watched = new WeakSet();
  function apply() {
    if (!canReload()) { status('blocked'); return false; }
    if (pendingReload) { if (!reloading) { reloading = true; reload(); } return true; }
    if (!registration?.waiting) return false;
    status('applying');
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    return true;
  }
  function available() {
    if (!registration?.waiting) return;
    status('available');
    if (controlled) apply();
  }
  function watch(worker) {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') setTimeout(available, 0);
      if (worker.state === 'redundant') status('failed');
    });
  }
  serviceWorker?.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; status('current'); return; }
    pendingReload = true;
    apply();
  });
  async function check() {
    if (!serviceWorker) { status('unsupported'); return; }
    if (checking) return checking;
    checking = (async () => {
      status('checking');
      try {
        registration = await serviceWorker.register('./sw.js', { type: 'module', updateViaCache: 'none' });
        if (!watched.has(registration)) {
          watched.add(registration);
          registration.addEventListener('updatefound', () => watch(registration.installing));
        }
        watch(registration.installing);
        await registration.update();
        watch(registration.installing);
        if (pendingReload) { apply(); return; }
        if (registration.waiting) available();
        else status(registration.installing ? 'downloading' : 'current');
      } catch { status('offline'); }
    })();
    try { await checking; } finally { checking = null; }
  }
  return { check, apply };
}
