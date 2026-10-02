import { openNotebook, matchesPerson, makeBackup, parseBackup, previewRestore, MAX_NOTE, MAX_BACKUP_BYTES, notebookCode, validNotebookCode, synchronizeNotebook, validateEntry } from './notebook.js';
import { prepareOffline, offlineStatus, cacheAllImages } from './offline.js';
import { personalSyncSession } from './family-ui.js';
import { runtime } from '../runtime-config.js';
import { APP_VERSION } from './offline-config.js';
import { createAppUpdater } from './app-update.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let store, data, entries = [], navigate, draftPerson, baseline = '', incoming, registration, downloadController;
const drafts = new Map();
export const hasUnsavedNotes = () => drafts.size > 0;
let settingsTimer, appUpdater;
let bound = false;
let restorePreview, restoreChoices = {}, conflictIndex = 0, importGeneration = 0;
let backingUp = false;
let syncing = false, syncTimer, syncState, changingSyncCode = false;
const message = text => { $('#personal-status').textContent = text; };
const record = person => entries.find(entry => matchesPerson(entry, person));
const mismatch = person => entries.some(entry => entry.id === person.id && !matchesPerson(entry, person));

let installPrompt;
const appDisplay = window.matchMedia('(display-mode: standalone)');
function updateInstallation() {
  const status = $('#installation-status'), button = $('#install-app');
  if (!status || !button) return;
  const standalone = appDisplay.matches || navigator.standalone === true;
  button.hidden = standalone || !installPrompt;
  status.textContent = standalone ? 'Héritage est ouvert en mode application.'
    : installPrompt ? 'Ce navigateur propose l’installation. Vous pourrez confirmer dans sa fenêtre.'
    : 'Consultez les étapes ci-dessous pour ajouter Héritage à votre écran d’accueil.';
  $('#installation-local').hidden = !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; updateInstallation();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null; updateInstallation();
  if ($('#installation-status')) $('#installation-status').textContent = 'Installation confirmée par le navigateur. Ouvrez Héritage depuis son icône.';
});
appDisplay.addEventListener('change', updateInstallation);

export function profileTools(person) {
  const entry = record(person);
  return `<div class="personal-tools"><button type="button" class="outline-button favorite-button" data-favorite="${escape(person.id)}" aria-pressed="${Boolean(entry?.favorite)}" ${store ? '' : 'disabled'}>${entry?.favorite ? '★ Favori' : '☆ Favori'}</button><button type="button" class="outline-button" data-note="${escape(person.id)}" ${store ? '' : 'disabled'}>${entry?.note ? '✎ Ma note' : '✎ Ajouter une note'}</button></div>`;
}

function refreshButtons() {
  document.querySelectorAll('[data-favorite]').forEach(button => {
    const entry = record(data.people[button.dataset.favorite]);
    button.setAttribute('aria-pressed', String(Boolean(entry?.favorite)));
    button.textContent = entry?.favorite ? '★ Favori' : '☆ Favori';
  });
  document.querySelectorAll('[data-note]').forEach(button => { button.textContent = record(data.people[button.dataset.note])?.note ? '✎ Ma note' : '✎ Ajouter une note'; });
}

async function refreshEntries() { entries = await store.all(); refreshButtons(); }
function showNotebook() {
  const filter = $('#notebook-filter').value;
  const matching = entries.filter(entry => matchesPerson(entry, data.people[entry.id]));
  const visible = matching.filter(entry => filter === 'notes' ? Boolean(entry.note) : filter === 'favorites' ? entry.favorite : entry.favorite || entry.note);
  $('#notebook-count').textContent = `${matching.filter(entry => entry.favorite).length} favoris · ${matching.filter(entry => entry.note).length} notes personnelles`;
  $('#notebook-list').innerHTML = visible.length ? visible.sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(entry => `<button class="notebook-person" type="button" data-notebook-person="${escape(entry.id)}"><span class="notebook-star" aria-hidden="true">${entry.favorite ? '★' : '·'}</span><span><strong>${escape(entry.name)}</strong><small>${escape(entry.note ? entry.note.slice(0, 130) : 'Retrouver cette personne dans l’arbre')}</small></span><span aria-hidden="true">↗</span></button>`).join('') : '<p class="empty-search">Votre carnet commence ici.<br>Ouvrez une fiche pour ajouter un favori ou une note.</p>';
  const unmatched = entries.length - matching.length;
  $('#notebook-unmatched').hidden = !unmatched;
  $('#notebook-unmatched').textContent = `${unmatched} fiche(s) du carnet ne correspondent plus exactement à cet export. Elles sont conservées dans votre sauvegarde, sans rattachement automatique. Exportez le carnet avant un rapprochement manuel.`;
}

async function updateOfflineStatus() {
  try {
    const result = await offlineStatus(data);
    $('#offline-status').textContent = result.ready ? `Arbre prêt hors connexion · ${result.photos} / ${result.total} photos conservées dans ce navigateur.` : 'Le hors connexion n’est pas encore prêt dans ce navigateur.';
    $('#cache-photos').disabled = !result.ready || Boolean(downloadController);
  } catch { $('#offline-status').textContent = 'Impossible de vérifier la copie hors connexion.'; }
}

async function updateBackupAvailability() {
  if (runtime.mode !== 'local' || !['127.0.0.1', 'localhost'].includes(location.hostname)) return;
  $('#complete-backup-section').hidden = false;
  if (backingUp) return;
  try {
    const response = await fetch('./__local/complete-backup', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok || !(await response.json()).available) throw new Error();
    $('#complete-backup').disabled = !store;
    $('#complete-backup-status').textContent = store ? 'Prêt sur ce PC. Les fichiers seront vérifiés avant le téléchargement.' : 'Le Carnet doit être disponible pour créer une sauvegarde complète.';
  } catch {
    $('#complete-backup').disabled = true;
    $('#complete-backup-status').textContent = 'La sauvegarde complète nécessite le serveur local à jour et les fichiers originaux. Relancez le serveur du projet sur le PC, puis rouvrez le Carnet.';
  }
}

function saveFile(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function clearRestore() {
  importGeneration++;
  incoming = null; restorePreview = null; restoreChoices = {}; conflictIndex = 0;
  $('#restore-preview').hidden = true;
  $('#restore-conflict').replaceChildren();
  $('#confirm-restore').hidden = true;
}

function showConflict() {
  const conflicts = restorePreview.conflicts, conflict = conflicts[conflictIndex];
  $('#restore-pagination').hidden = !conflicts.length;
  $('#restore-position').textContent = conflicts.length ? `Différence ${conflictIndex + 1} sur ${conflicts.length}` : '';
  $('#restore-previous').disabled = conflictIndex === 0;
  $('#restore-next').disabled = conflictIndex >= conflicts.length - 1;
  if (!conflict) { $('#restore-conflict').replaceChildren(); return; }
  $('#restore-conflict').innerHTML = `<h4>${escape(conflict.current.name)}</h4>
    <div class="restore-comparison"><div><h5>Dans ce navigateur</h5><p>${escape(conflict.current.name)} · ${escape(conflict.current.birth || 'Naissance non renseignée')}</p><pre>${escape(conflict.current.note || 'Aucune note')}</pre></div><div><h5>Dans la sauvegarde</h5><p>${escape(conflict.incoming.name)} · ${escape(conflict.incoming.birth || 'Naissance non renseignée')}</p><pre>${escape(conflict.incoming.note || 'Aucune note')}</pre></div></div>
    ${conflict.identityChanged ? '<p class="personal-warning">L’identité diffère pour ce même identifiant. Cette fiche sera ignorée : aucun rattachement automatique. Conservez le fichier de sauvegarde pour vérifier cette personne.</p>' : `<label class="restore-choice">Pour cette note<select id="restore-choice"><option value="keep">Garder ma note actuelle</option><option value="combine" ${conflict.canCombine ? '' : 'disabled'}>Réunir les deux textes</option></select></label><p>${conflict.canCombine ? 'Les textes réunis seront séparés par la mention « Note issue de la sauvegarde ». Les favoris sont conservés.' : 'Les deux textes dépassent ensemble 20 000 caractères. Gardez le fichier pour les comparer et les raccourcir si nécessaire.'}</p>`}`;
  const select = $('#restore-choice');
  if (select) {
    select.value = restoreChoices[conflict.id] || 'keep';
    select.addEventListener('change', () => { restoreChoices[conflict.id] = select.value; });
  }
}

async function showRestorePreview() {
  const generation = importGeneration, selected = incoming;
  await refreshEntries();
  if (generation !== importGeneration || !selected) return;
  restorePreview = previewRestore(entries, selected); restoreChoices = {}; conflictIndex = 0;
  const { report } = restorePreview;
  const unmatched = incoming.filter(entry => !matchesPerson(entry, data.people[entry.id])).length;
  $('#restore-summary').textContent = `${incoming.length} fiche(s) vérifiée(s) : ${report.added} à ajouter, ${report.notes} note(s) et ${report.favorites} favori(s) à compléter. ${report.conflicts} différence(s) à examiner. ${unmatched ? `${unmatched} fiche(s) sans correspondance exacte dans l’arbre ; aucune association automatique. ` : ''}Aucun changement avant la restauration. Par défaut, vos notes actuelles sont conservées.`;
  $('#restore-preview').hidden = false; $('#confirm-restore').hidden = false;
  showConflict();
}

const syncStatus = text => { $('#notebook-sync-status').textContent = text; };
const syncAllowed = () => !drafts.size && !incoming && !backingUp && !$('#note-dialog').open;
async function syncRequest(action, code, extra = {}) {
  const session = await personalSyncSession();
  if (!session) throw new Error('Rouvrez l’accès familial pour synchroniser. Vos notes restent sur cet appareil.');
  const body = JSON.stringify({ action, code, ...extra });
  if (new TextEncoder().encode(body).length > 8388608) throw new Error('Carnet trop volumineux pour être synchronisé (8 Mo). Exportez une sauvegarde.');
  const response = await fetch(runtime.endpoint + '/notebook', { method:'POST', cache:'no-store',
    headers:{'Content-Type':'application/json',Authorization:'Bearer ' + session.token}, body, signal:AbortSignal.timeout(30000) });
  if (!response.ok) {
    const messages = {401:'Rouvrez l’accès familial pour synchroniser.',403:'Code personnel inconnu. Vérifiez le code du Carnet.',409:'Un autre appareil a modifié le Carnet.',429:'Limite de création atteinte. Réessayez demain.',413:'Carnet trop volumineux.'};
    const error = new Error(messages[response.status] || 'Synchronisation indisponible. Vérifiez l’installation Supabase puis réessayez.');
    error.status = response.status; throw error;
  }
  return response.json();
}
async function showSync() {
  const available = runtime.mode === 'family' && Boolean(store);
  $('#notebook-sync-create').disabled = $('#notebook-sync-join').disabled = !available || syncing;
  $('#notebook-sync-change').textContent = changingSyncCode ? 'Annuler le changement de code' : 'Utiliser un autre code';
  if (!available) { syncStatus(store ? 'La synchronisation est disponible depuis l’adresse familiale publiée. Cette copie locale conserve son Carnet ; exportez-le puis restaurez-le sur le site publié.' : 'Le stockage du Carnet est indisponible.'); return; }
  const snapshot = await store.syncSnapshot(runtime.treeId); syncState = snapshot.sync;
  $('#notebook-sync-setup').hidden = Boolean(syncState) && !changingSyncCode;
  $('#notebook-sync-create').hidden = Boolean(syncState);
  $('#notebook-sync-connected').hidden = !syncState;
  $('#notebook-sync-code').value = syncState?.code || '';
  $('#notebook-sync-pause').textContent = syncState?.paused ? 'Reprendre la synchronisation' : 'Mettre en pause';
  const conflicts = syncState?.conflicts || [];
  const box = $('#notebook-sync-conflicts'); box.hidden = !conflicts.length;
  // Display one difference at a time, so a large initial pairing remains usable.
  const conflict = conflicts[0];
  box.innerHTML = conflict ? `<h4>${conflicts.length} différence(s) à résoudre</h4><article><strong>${escape(conflict.local?.name || conflict.remote?.name || conflict.id)}</strong><div class="restore-comparison"><div><h5>Sur cet appareil</h5><pre>${escape(conflict.local?.note || 'Note supprimée ou absente')}</pre></div><div><h5>Dans le Carnet synchronisé</h5><pre>${escape(conflict.remote?.note || 'Note supprimée ou absente')}</pre></div></div>${conflict.reason === 'identity' ? '<p>Identités différentes : aucun remplacement automatique. Conservez vos sauvegardes avant de rapprocher ces personnes.</p>' : '<div class="notebook-actions"><button type="button" data-sync-choice="local" class="outline-button">Garder ma note locale</button><button type="button" data-sync-choice="remote" class="outline-button">Garder la note synchronisée</button><button type="button" data-sync-choice="combine" class="outline-button">Réunir les textes</button></div>'}</article>` : '';
  $('#notebook-sync-now').disabled = syncing || !syncState || Boolean(syncState.paused) || Boolean(conflicts.length);
  $('#notebook-sync-pause').disabled = $('#notebook-sync-change').disabled = syncing;
  if (conflicts.length) syncStatus('Les deux versions sont conservées. Choisissez comment les rapprocher avant de reprendre la synchronisation.');
  else if (syncState?.paused) syncStatus('Synchronisation en pause sur cet appareil. Vos nouvelles modifications restent locales.');
  else if (syncState?.lastSynced) syncStatus('Dernière synchronisation : ' + new Date(syncState.lastSynced).toLocaleString('fr-FR') + '. Les modifications locales attendent la prochaine synchronisation.');
}
async function runSync() {
  if (runtime.mode !== 'family' || !store || syncing || changingSyncCode) return;
  if (!syncAllowed()) { syncStatus('Enregistrez et fermez la note en cours ; la synchronisation reprendra ensuite.'); return; }
  syncing = true;
  $('#notebook-sync-now').disabled = $('#notebook-sync-pause').disabled = $('#notebook-sync-change').disabled = $('#notebook-sync-create').disabled = $('#notebook-sync-join').disabled = true;
  try {
    const before = await store.syncSnapshot(runtime.treeId);
    if (!before.sync || before.sync.paused || before.sync.conflicts?.length) { await showSync(); return; }
    syncStatus('Synchronisation en cours…');
    const result = await synchronizeNotebook({store,tree:runtime.treeId,data,request:syncRequest,canCommit:syncAllowed});
    await refreshEntries(); if ($('#notebook-dialog').open) showNotebook();
    await showSync();
    if (!result.sync?.conflicts?.length && syncAllowed()) syncStatus('Carnet synchronisé. Notes et favoris enregistrés sur cet appareil et sur le serveur.');
  } catch (error) {
    await showSync();
    syncStatus((error.name === 'TypeError' || error.name === 'TimeoutError' ? 'Connexion interrompue. Réessayez au retour d’Internet.' : error.message) + ' Vos notes locales sont conservées.');
  } finally { syncing = false; $('#notebook-sync-pause').disabled = $('#notebook-sync-change').disabled = false; $('#notebook-sync-now').disabled = !syncState || Boolean(syncState.paused || syncState.conflicts?.length); $('#notebook-sync-create').disabled = $('#notebook-sync-join').disabled = false; }
}
function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(runSync, 1000); }
function bindSync() {
  void showSync();
  $('#notebook-sync-create').addEventListener('click', async () => {
    if (syncing || !syncAllowed()) { syncStatus('Terminez vos modifications en cours avant de relier un Carnet.'); return; }
    try {
      const snapshot = await store.syncSnapshot(runtime.treeId);
      if (snapshot.sync) return;
      const state = {code:notebookCode(),base:[],revision:0,pendingCreate:true,conflicts:[],paused:false};
      await store.syncCommit(runtime.treeId,snapshot,snapshot.entries,state);
      await showSync(); await runSync();
    } catch(error) { syncStatus(error.message); }
  });
  $('#notebook-sync-join').addEventListener('click', async () => {
    if (syncing || !syncAllowed()) { syncStatus('Terminez vos modifications en cours avant de relier un Carnet.'); return; }
    const code = $('#notebook-sync-input').value.trim();
    if (!validNotebookCode(code)) { syncStatus('Saisissez le code personnel complet, commençant par H1-.'); return; }
    let joined = false;
    syncing = true; $('#notebook-sync-join').disabled = true;
    try {
      const snapshot = await store.syncSnapshot(runtime.treeId);
      if (snapshot.sync && !changingSyncCode) return;
      // Verify that joining never silently creates a different empty notebook.
      await syncRequest('read',code);
      await store.syncCommit(runtime.treeId,snapshot,snapshot.entries,{code,base:[],revision:0,conflicts:[],paused:false});
      $('#notebook-sync-input').value = ''; changingSyncCode = false; joined = true; await showSync();
    } catch(error) { syncStatus(error.message + ' Votre Carnet local reste inchangé.'); }
    finally { syncing = false; $('#notebook-sync-join').disabled = false; }
    if (joined) await runSync();
  });
  $('#notebook-sync-change').addEventListener('click', async () => {
    if (syncing) return;
    if (syncState?.conflicts?.length) { syncStatus('Résolvez les différences de ce Carnet avant de changer de code.'); return; }
    changingSyncCode = !changingSyncCode;
    await showSync();
    if (changingSyncCode) {
      $('#notebook-sync-setup details').open = true;
      syncStatus('Conservez votre code actuel. Saisir un autre code rapprochera toutes vos notes locales du Carnet choisi, sans effacer l’ancien Carnet distant.');
      $('#notebook-sync-input').focus();
    } else scheduleSync();
  });
  $('#notebook-sync-show').addEventListener('click', () => {
    const input = $('#notebook-sync-code'); input.type = input.type === 'password' ? 'text' : 'password';
    $('#notebook-sync-show').textContent = input.type === 'text' ? 'Masquer le code' : 'Afficher le code';
  });
  $('#notebook-sync-copy').addEventListener('click', async () => {
    if (!syncState) return;
    try { await navigator.clipboard.writeText(syncState.code); syncStatus('Code personnel copié. Collez-le sur votre autre appareil et gardez-en une copie privée.'); }
    catch { $('#notebook-sync-code').type = 'text'; $('#notebook-sync-show').textContent = 'Masquer le code'; $('#notebook-sync-code').select(); syncStatus('Code sélectionné. Utilisez Copier dans le menu de votre appareil.'); }
  });
  $('#notebook-sync-save-code').addEventListener('click', () => {
    if (!syncState) return;
    saveFile({format:'heritage-personal-code',version:1,code:syncState.code},'heritage-code-personnel.json');
    syncStatus('Code personnel téléchargé. Conservez-le sur un support privé ; saisissez sa valeur H1-… sur vos autres appareils.');
  });
  $('#notebook-sync-now').addEventListener('click',runSync);
  $('#notebook-sync-pause').addEventListener('click', async () => {
    if (syncing) return;
    try {
      const snapshot = await store.syncSnapshot(runtime.treeId); if (!snapshot.sync) return;
      await store.syncCommit(runtime.treeId,snapshot,snapshot.entries,{...snapshot.sync,paused:!snapshot.sync.paused});
      await showSync(); if (!syncState.paused) scheduleSync();
    } catch(error) { syncStatus(error.message); }
  });
  $('#notebook-sync-conflicts').addEventListener('click', async event => {
    const choice = event.target.closest('[data-sync-choice]')?.dataset.syncChoice;
    if (!choice || syncing) return;
    if (!syncAllowed()) { syncStatus('Terminez vos modifications en cours.'); return; }
    try {
      const snapshot = await store.syncSnapshot(runtime.treeId), state = snapshot.sync, conflict = state?.conflicts?.[0];
      if (!conflict || conflict.reason === 'identity') return;
      const current = snapshot.entries.find(e=>e.id===conflict.id);
      if ((current?.note || '') !== (conflict.local?.note || '')) {
        await store.syncCommit(runtime.treeId,snapshot,snapshot.entries,{...state,conflicts:[{...conflict,local:current || null},...state.conflicts.slice(1)]});
        await showSync(); throw new Error('La note locale a changé. La comparaison a été actualisée ; relisez les deux versions avant de choisir.');
      }
      let note = choice === 'local' ? (current?.note || '') : (conflict.remote?.note || '');
      if (choice === 'combine') note = [current?.note,conflict.remote?.note].filter(Boolean).join('\n\n— Note issue d’un autre appareil —\n');
      if (note.length > MAX_NOTE) throw new Error('Les textes réunis dépassent 20 000 caractères. Exportez-les pour les raccourcir.');
      const next = validateEntry({...conflict.base,...conflict.remote,...conflict.local,...current,favorite:current?.favorite ?? false,note,updatedAt:new Date().toISOString()});
      const entries = snapshot.entries.filter(e=>e.id!==conflict.id); if (next.note || next.favorite) entries.push(next);
      // This explicit decision is relative to the observed remote version.
      const base = state.base.filter(e=>e.id!==conflict.id); if (conflict.remote) base.push(conflict.remote);
      await store.syncCommit(runtime.treeId,snapshot,entries,{...state,base,conflicts:state.conflicts.slice(1)});
      await refreshEntries(); showNotebook(); await showSync(); scheduleSync();
    } catch(error) { syncStatus(error.message); }
  });
  window.addEventListener('online',scheduleSync);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleSync();});
  $('#note-dialog').addEventListener('close',scheduleSync);
  setInterval(()=>{if(!document.hidden)scheduleSync();},60000);
  scheduleSync();
}

export async function initPersonal(corpus, onNavigate) {
  data = corpus; navigate = onNavigate;
  let saved;
  try { store = await openNotebook(); await store.rebase(data.people); entries = await store.all(); saved = await store.getSettings(); }
  catch { store = null; message('Carnet indisponible : le navigateur ne permet pas de conserver vos notes. La consultation reste disponible.'); }
  $('#open-notebook').disabled = false;
  $('#export-notebook').disabled = $('#import-notebook').disabled = !store;
  if (bound) return saved?.rootId === data.meta.rootId ? saved : null;
  bound = true;
  if (store) bindSync();
  $('#app-version').textContent = `Version ${APP_VERSION}`;
  appUpdater = createAppUpdater({ serviceWorker: navigator.serviceWorker,
    canReload: () => !drafts.size && !incoming && !backingUp && !downloadController && !syncing,
    reload: () => location.reload(),
    status: value => {
      const messages = { checking: 'Recherche d’une nouvelle version…', downloading: 'Téléchargement de la nouvelle version…',
        available: 'Nouvelle version disponible.', applying: 'Mise à jour en cours…',
        blocked: 'Mise à jour prête. Enregistrez vos notes et terminez les opérations du Carnet, puis activez la mise à jour.',
        current: 'Application à jour.', offline: 'Vérification impossible sans connexion. La version installée reste disponible.',
        failed: 'Téléchargement incomplet. La version installée est conservée ; réessayez.', unsupported: 'Mise à jour automatique indisponible dans ce navigateur.' };
      $('#app-update-status').textContent = messages[value];
      $('#update-app').hidden = !['available', 'blocked'].includes(value);
    } });
  $('#check-update').addEventListener('click', () => appUpdater.check());
  window.addEventListener('online', () => appUpdater.check());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) appUpdater.check(); });
  void appUpdater.check();
  updateInstallation();
  $('#install-app')?.addEventListener('click', async () => {
    const prompt = installPrompt;
    if (!prompt) return;
    installPrompt = null; updateInstallation();
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      $('#installation-status').textContent = choice.outcome === 'accepted'
        ? 'Demande acceptée. Le navigateur termine l’installation.'
        : 'Installation annulée. Vous pouvez continuer ici ou utiliser le menu du navigateur.';
    } catch {
      $('#installation-status').textContent = 'Installation non lancée. Utilisez les étapes du menu du navigateur ci-dessous.';
    }
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.favorite && store) {
      const person = data.people[button.dataset.favorite];
      button.disabled = true;
      try {
        await refreshEntries();
        if (mismatch(person)) throw new Error('Une ancienne annotation de cette fiche est à vérifier dans le carnet.');
        await store.update(person, { favorite: !record(person)?.favorite }); scheduleSync();
        await refreshEntries();
        $('#announcement').textContent = record(person)?.favorite ? 'Personne ajoutée aux favoris.' : 'Personne retirée des favoris.';
      } catch (error) { message(error.message); $('#notebook-dialog').showModal(); }
      finally { button.disabled = false; }
    } else if (button.dataset.note && store) {
      try {
        await refreshEntries(); draftPerson = data.people[button.dataset.note];
        if (mismatch(draftPerson)) throw new Error('Une ancienne annotation de cette fiche est à vérifier dans le carnet.');
        baseline = record(draftPerson)?.note || '';
        $('#note-person').textContent = draftPerson.name;
        $('#note-text').value = drafts.get(draftPerson.id) ?? baseline;
        $('#note-status').textContent = 'Cette note vous appartient. Elle ne modifie pas le GEDCOM.';
        $('#note-dialog').showModal(); $('#note-text').focus();
      } catch (error) { message(error.message); $('#notebook-dialog').showModal(); }
    } else if (button.dataset.notebookPerson) {
      $('#notebook-dialog').close(); navigate(button.dataset.notebookPerson);
    }
  });
  $('#open-notebook').addEventListener('click', async () => {
    if (store) { try { await refreshEntries(); showNotebook(); } catch { message('Lecture du carnet impossible. Réessayez.'); } }
    $('#notebook-dialog').showModal(); updateOfflineStatus(); updateBackupAvailability(); void showSync(); scheduleSync();
  });
  $('#close-notebook').addEventListener('click', () => $('#notebook-dialog').close());
  $('#notebook-dialog').addEventListener('close', clearRestore);
  $('#notebook-filter').addEventListener('change', showNotebook);
  $('#note-text').maxLength = MAX_NOTE;
  $('#note-text').addEventListener('input', () => {
    if ($('#note-text').value === baseline) drafts.delete(draftPerson.id);
    else drafts.set(draftPerson.id, $('#note-text').value);
    $('#note-status').textContent = 'Modifications à enregistrer.';
  });
  $('#close-note').addEventListener('click', () => $('#note-dialog').close());
  $('#save-note').addEventListener('click', async () => {
    const note = $('#note-text').value, person = draftPerson;
    $('#save-note').disabled = true; $('#note-status').textContent = 'Enregistrement…';
    try {
      await store.update(person, { note, expectedNote: baseline });
      baseline = note; scheduleSync();
      if ($('#note-text').value === note) drafts.delete(person.id);
      await refreshEntries();
      $('#note-status').textContent = $('#note-text').value === note ? 'Note enregistrée dans ce navigateur.' : 'Modifications supplémentaires à enregistrer.';
    } catch (error) { $('#note-status').textContent = `Note non enregistrée. ${error.message}`; }
    finally { $('#save-note').disabled = false; }
  });
  window.addEventListener('beforeunload', event => { if (drafts.size || backingUp) { event.preventDefault(); event.returnValue = ''; } });
  $('#export-notebook').addEventListener('click', async () => {
    if (drafts.size) { message('Enregistrez vos notes en cours avant d’exporter le carnet.'); return; }
    try {
      await refreshEntries();
      saveFile(makeBackup(entries, data), `heritage-carnet-${new Date().toISOString().slice(0, 10)}.json`);
      message('Export du carnet lancé. Conservez le fichier téléchargé ; il contient vos notes et favoris, sans l’arbre ni les photos.');
    } catch { message('Export impossible. Vos données restent dans le navigateur.'); }
  });
  $('#complete-backup').addEventListener('click', async () => {
    if (backingUp || !store) return;
    const status = $('#complete-backup-status');
    if (drafts.size) { status.textContent = 'Enregistrez vos notes en cours avant de créer la sauvegarde complète.'; return; }
    backingUp = true; $('#complete-backup').disabled = true;
    status.textContent = 'Création et vérification du ZIP sur ce PC… Gardez cette page ouverte.';
    try {
      await refreshEntries();
      const backup = makeBackup(entries, data);
      // Canonical ISO dates retain the same instant and simplify portable validation.
      backup.entries = backup.entries.map(entry => ({ ...entry, updatedAt: new Date(entry.updatedAt).toISOString() }));
      const response = await fetch('./__local/complete-backup', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Heritage-Backup': '1' }, body: JSON.stringify(backup) });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Le serveur local n’a pas pu créer la sauvegarde.');
      }
      if (!response.headers.get('Content-Type')?.includes('application/zip')) throw new Error('Le serveur n’a pas renvoyé une archive ZIP.');
      status.textContent = 'ZIP vérifié. Préparation du téléchargement…';
      const blob = await response.blob();
      const expected = Number(response.headers.get('Content-Length'));
      if (!expected || blob.size !== expected) throw new Error('Téléchargement incomplet. Relancez la sauvegarde.');
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `heritage-complet-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = `Téléchargement lancé : ZIP vérifié, ${backup.entries.length} fiche(s) du Carnet incluse(s). Retrouvez le fichier dans vos téléchargements et copiez-le sur un support privé distinct du PC. Le guide LIRE-MOI.txt décrit la restauration.`;
    } catch (error) { status.textContent = `Sauvegarde complète non téléchargée. ${error.message}`; }
    finally { backingUp = false; $('#complete-backup').disabled = false; }
  });
  $('#import-notebook').addEventListener('click', () => {
    if (drafts.size) { message('Enregistrez vos notes en cours avant de restaurer le carnet.'); return; }
    clearRestore(); $('#notebook-file').value = ''; $('#notebook-file').click();
  });
  $('#cancel-restore').addEventListener('click', () => { clearRestore(); message('Restauration annulée. Votre carnet est inchangé.'); });
  $('#restore-previous').addEventListener('click', () => { conflictIndex--; showConflict(); });
  $('#restore-next').addEventListener('click', () => { conflictIndex++; showConflict(); });
  $('#notebook-file').addEventListener('change', async event => {
    clearRestore(); const generation = importGeneration;
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Fichier trop volumineux : limite de 10 Mo.');
      const text = await file.text();
      if (generation !== importGeneration) return;
      incoming = parseBackup(text, data);
      await showRestorePreview();
      if (generation !== importGeneration) return;
      message(`Sauvegarde sélectionnée : ${file.name}. Examinez l’aperçu ci-dessous.`);
    } catch (error) { if (generation === importGeneration) { clearRestore(); message(error.message); } }
  });
  $('#confirm-restore').addEventListener('click', async () => {
    if (!incoming || !restorePreview) return;
    if (drafts.size) { message('Enregistrez vos notes en cours avant de restaurer le carnet.'); return; }
    $('#confirm-restore').disabled = true;
    $('#import-notebook').disabled = $('#cancel-restore').disabled = true;
    let restored = false;
    try {
      const report = await store.restore(incoming, restorePreview, { ...restoreChoices });
      restored = true; scheduleSync();
      clearRestore();
      await refreshEntries(); showNotebook();
      message(`Restauration terminée : ${report.added} fiche(s) ajoutée(s), ${report.notes} note(s) et ${report.favorites} favori(s) complété(s), ${report.combined} note(s) réunie(s). ${report.conflicts - report.combined} différence(s) laissée(s) inchangée(s). Conservez votre fichier de sauvegarde.`);
    } catch (error) {
      if (restored) { message('Restauration enregistrée, mais l’affichage n’a pas pu être actualisé. Rouvrez le carnet.'); return; }
      message(`Restauration non effectuée. ${error.message}`);
      try { if (incoming) await showRestorePreview(); }
      catch { clearRestore(); }
    }
    finally { $('#confirm-restore').disabled = false; $('#import-notebook').disabled = $('#cancel-restore').disabled = false; }
  });
  $('#prepare-offline').addEventListener('click', async () => {
    $('#prepare-offline').disabled = true; $('#offline-status').textContent = 'Préparation de l’arbre hors connexion…';
    try {
      registration = await prepareOffline(data);
      await appUpdater.check();
      await updateOfflineStatus();
    } catch (error) { $('#offline-status').textContent = `Préparation non terminée. ${error.message}`; }
    finally { $('#prepare-offline').disabled = false; }
  });
  $('#update-app').addEventListener('click', () => {
    appUpdater.apply();
  });
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    updateOfflineStatus();
  });
  $('#cache-photos').addEventListener('click', async () => {
    downloadController = new AbortController(); $('#cache-photos').disabled = true; $('#stop-photos').hidden = false;
    try {
      const result = await cacheAllImages(data, progress => { $('#offline-status').textContent = `${progress.done} / ${progress.total} photos traitées · ${progress.failures} échec(s). Gardez cette page ouverte.`; }, downloadController.signal);
      await updateOfflineStatus();
      if (result.canceled || result.failures) $('#offline-status').textContent += result.canceled ? ' Téléchargement arrêté ; vous pouvez le reprendre.' : ` ${result.failures} échec(s), relancez pour réessayer.`;
    } catch (error) { downloadController.abort(); $('#offline-status').textContent = error.message; }
    finally { downloadController = null; $('#cache-photos').disabled = false; $('#stop-photos').hidden = true; }
  });
  $('#stop-photos').addEventListener('click', () => downloadController?.abort());
  return saved?.rootId === data.meta.rootId ? saved : null;
}

export function rememberNavigation(state) {
  if (!store) return;
  clearTimeout(settingsTimer);
  const saved = { rootId: data.meta.rootId, center: state.center, selected: state.selected, ancestorDepth: state.ancestorDepth, descendantDepth: state.descendantDepth, showSiblings: state.showSiblings, scope: state.scope, parentFamilyId: state.parentFamilyId };
  settingsTimer = setTimeout(() => store.setSettings(saved).catch(() => message('Les réglages de navigation n’ont pas pu être conservés.')), 150);
}
