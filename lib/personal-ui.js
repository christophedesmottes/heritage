import { openNotebook, matchesPerson, makeBackup, parseBackup, mergeEntries, MAX_NOTE, MAX_BACKUP_BYTES } from './notebook.js';
import { prepareOffline, offlineStatus, cacheAllImages } from './offline.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let store, data, entries = [], navigate, draftPerson, baseline = '', incoming, registration, downloadController;
const drafts = new Map();
export const hasUnsavedNotes = () => drafts.size > 0;
let settingsTimer, applyingUpdate = false;
let bound = false;
const message = text => { $('#personal-status').textContent = text; };
const record = person => entries.find(entry => matchesPerson(entry, person));
const mismatch = person => entries.some(entry => entry.id === person.id && !matchesPerson(entry, person));

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

function saveFile(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function initPersonal(corpus, onNavigate) {
  data = corpus; navigate = onNavigate;
  let saved;
  try { store = await openNotebook(); entries = await store.all(); saved = await store.getSettings(); }
  catch { store = null; message('Carnet indisponible : le navigateur ne permet pas de conserver vos notes. La consultation reste disponible.'); }
  $('#open-notebook').disabled = false;
  $('#export-notebook').disabled = $('#import-notebook').disabled = !store;
  if (bound) return saved?.rootId === data.meta.rootId ? saved : null;
  bound = true;
  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.favorite && store) {
      const person = data.people[button.dataset.favorite];
      button.disabled = true;
      try {
        await refreshEntries();
        if (mismatch(person)) throw new Error('Une ancienne annotation de cette fiche est à vérifier dans le carnet.');
        await store.update(person, { favorite: !record(person)?.favorite });
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
    $('#notebook-dialog').showModal(); updateOfflineStatus();
  });
  $('#close-notebook').addEventListener('click', () => $('#notebook-dialog').close());
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
      baseline = note;
      if ($('#note-text').value === note) drafts.delete(person.id);
      await refreshEntries();
      $('#note-status').textContent = $('#note-text').value === note ? 'Note enregistrée dans ce navigateur.' : 'Modifications supplémentaires à enregistrer.';
    } catch (error) { $('#note-status').textContent = `Note non enregistrée. ${error.message}`; }
    finally { $('#save-note').disabled = false; }
  });
  window.addEventListener('beforeunload', event => { if (drafts.size) { event.preventDefault(); event.returnValue = ''; } });
  $('#export-notebook').addEventListener('click', async () => {
    if (drafts.size) { message('Enregistrez vos notes en cours avant d’exporter le carnet.'); return; }
    try {
      await refreshEntries();
      saveFile(makeBackup(entries, data), `heritage-carnet-${new Date().toISOString().slice(0, 10)}.json`);
      message('Export du carnet lancé. Conservez le fichier téléchargé ; il contient vos notes et favoris, sans l’arbre ni les photos.');
    } catch { message('Export impossible. Vos données restent dans le navigateur.'); }
  });
  $('#import-notebook').addEventListener('click', () => { $('#notebook-file').value = ''; $('#notebook-file').click(); });
  $('#notebook-file').addEventListener('change', async event => {
    incoming = null; $('#confirm-restore').hidden = true;
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Fichier trop volumineux : limite de 10 Mo.');
      incoming = parseBackup(await file.text(), data);
      await refreshEntries();
      const { report } = mergeEntries(entries, incoming);
      message(`Fichier vérifié : ${report.added} nouvelles fiches, ${report.notes} notes et ${report.favorites} favoris à compléter. ${report.conflicts} conflit(s) : vos notes actuelles seront conservées. Rien n’est modifié avant « Restaurer le carnet ».`);
      $('#confirm-restore').hidden = false;
    } catch (error) { incoming = null; message(error.message); }
  });
  $('#confirm-restore').addEventListener('click', async () => {
    if (!incoming) return;
    $('#confirm-restore').disabled = true;
    try {
      const report = await store.restore(incoming); incoming = null;
      await refreshEntries(); showNotebook();
      message(`Restauration terminée : ${report.added} fiches ajoutées, ${report.notes} notes et ${report.favorites} favoris complétés. ${report.conflicts} conflit(s) conservés sans écraser vos notes actuelles.`);
      $('#confirm-restore').hidden = true;
    } catch (error) { message(`Restauration non effectuée. ${error.message}`); }
    finally { $('#confirm-restore').disabled = false; }
  });
  $('#prepare-offline').addEventListener('click', async () => {
    $('#prepare-offline').disabled = true; $('#offline-status').textContent = 'Préparation de l’arbre hors connexion…';
    try {
      registration = await prepareOffline(data);
      $('#update-app').hidden = !registration.waiting;
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => { if (worker.state === 'installed') $('#update-app').hidden = !registration.waiting; });
      });
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => { if (installing.state === 'installed') $('#update-app').hidden = !registration.waiting; });
      await updateOfflineStatus();
    } catch (error) { $('#offline-status').textContent = `Préparation non terminée. ${error.message}`; }
    finally { $('#prepare-offline').disabled = false; }
  });
  $('#update-app').addEventListener('click', () => {
    if (drafts.size) { message('Enregistrez vos notes en cours avant de mettre à jour.'); return; }
    applyingUpdate = true;
    registration?.waiting?.postMessage({ type: 'ACTIVATE_UPDATE' });
  });
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (applyingUpdate) { location.reload(); return; }
    if (registration?.waiting) return;
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
  const saved = { rootId: data.meta.rootId, center: state.center, selected: state.selected, ancestorDepth: state.ancestorDepth, showSiblings: state.showSiblings, scope: state.scope, parentFamilyId: state.parentFamilyId };
  settingsTimer = setTimeout(() => store.setSettings(saved).catch(() => message('Les réglages de navigation n’ont pas pu être conservés.')), 150);
}
