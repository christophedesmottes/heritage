import { runtime } from '../runtime-config.js';
import { validFamilyConfig, validSession, sessionFromLink, accessStore } from './family-session.js';
import { DATA_CACHE, MEDIA_CACHE } from './offline-config.js';

export const familyMode = runtime.mode === 'family';
let store, readyPromise, unlocked;
const $ = selector => document.querySelector(selector);

export async function initializeFamilyAccess() {
  if (!familyMode) return;
  document.body.dataset.edition = 'family';
  if (!validFamilyConfig(runtime)) throw new Error('Configuration de l’accès familial invalide.');
  store ||= await accessStore(runtime);
  if (!readyPromise) readyPromise = (async () => {
    if (!globalThis.isSecureContext || !navigator.serviceWorker) throw new Error('Ouvrez cette application avec une adresse HTTPS.');
    await navigator.serviceWorker.register('./sw.js', { type: 'module', updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((resolve, reject) => {
      const changed = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => { navigator.serviceWorker.removeEventListener('controllerchange', changed); reject(new Error('Préparation du navigateur incomplète. Rechargez la page.')); }, 15000);
      navigator.serviceWorker.addEventListener('controllerchange', changed, { once: true });
    });
    $('#family-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = $('#family-submit'); button.disabled = true;
      $('#family-message').textContent = 'Vérification du code…';
      try {
        const response = await fetch(runtime.endpoint + '/unlock', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: $('#family-code').value }), signal: AbortSignal.timeout(20000)
        });
        $('#family-code').value = '';
        if (!response.ok) throw new Error(response.status === 401 ? 'Ce code familial n’est pas correct.' : response.status === 429 ? 'Trop de tentatives. Réessayez dans quinze minutes.' : 'L’accès familial est momentanément indisponible.');
        const result = await response.json();
        if (result.expiresIn !== 604800) throw new Error('Réponse de connexion invalide.');
        const session = { token: result.token, expiresAt: Date.now() + result.expiresIn * 1000, endpoint: runtime.endpoint, treeId: runtime.treeId };
        if (!validSession(session, runtime)) throw new Error('Réponse de connexion invalide.');
        await store.set(session);
        document.body.dataset.access = 'open'; $('#family-gate').hidden = true;
        unlocked?.(); unlocked = null;
      } catch (error) {
        $('#family-code').value = '';
        $('#family-message').textContent = error.name === 'TimeoutError' || error instanceof TypeError ? 'Connexion impossible. Vérifiez votre accès à Internet puis réessayez.' : error.message;
      } finally { button.disabled = false; }
    });
    $('#show-family-code').addEventListener('click', () => {
      const field = $('#family-code'), visible = field.type === 'password';
      field.type = visible ? 'text' : 'password';
      $('#show-family-code').textContent = visible ? 'Masquer' : 'Afficher';
      $('#show-family-code').setAttribute('aria-pressed', String(visible));
    });
  })();
  await readyPromise;
  let linkMessage = '';
  if (location.hash.startsWith('#access=')) {
    const fragment = location.hash;
    // Do not retain the access token in the visible address or current history entry.
    history.replaceState(null, '', location.pathname + location.search);
    try {
      const candidate = sessionFromLink(fragment, runtime, Date.now() + 60000);
      if (!candidate) throw new Error('Lien d’essai invalide.');
      const response = await fetch(runtime.endpoint + '/session', {
        headers: { Authorization: 'Bearer ' + candidate.token }, signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('Ce lien d’essai est expiré ou indisponible.');
      const session = sessionFromLink(fragment, runtime, (await response.json()).expiresAt);
      if (!session) throw new Error('Lien d’essai invalide.');
      await store.set(session);
    } catch (error) { linkMessage = error.message; }
  }
  if (!validSession(await store.get(), runtime)) await requestFamilyCode(linkMessage);
  $('#lock-family').hidden = false;
}

export async function requestFamilyCode(message = '') {
  await store.clear();
  document.body.dataset.access = 'locked';
  $('#family-gate').hidden = false; $('#family-message').textContent = message;
  $('#family-code').value = ''; $('#family-code').type = 'password';
  if (runtime.accessMode === 'preview') {
    $('#family-form').hidden = true;
    $('.family-footnote').textContent = message || 'Version d’essai : ouvrez le lien complet qui vous a été transmis. Aucun code familial n’est nécessaire pour cet essai.';
  }
  $('#show-family-code').textContent = 'Afficher'; $('#show-family-code').setAttribute('aria-pressed', 'false');
  $('#family-code').focus();
  return new Promise(resolve => { unlocked = resolve; });
}

export async function lockFamily() {
  if (!familyMode) return;
  store ||= await accessStore(runtime);
  await store.clear();
  // Personal annotations are deliberately not deleted by closing family access.
  await Promise.all([caches.delete(DATA_CACHE), caches.delete(MEDIA_CACHE)]);
  location.reload();
}
