export const NOTEBOOK_FORMAT = 'heritage-notebook';
export const NOTEBOOK_VERSION = 1;
export const MAX_NOTE = 20000;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const identity = person => ({ id: person.id, name: person.name, birth: person.birth?.date || '' });
export const matchesPerson = (entry, person) => Boolean(person && entry.id === person.id && entry.name === person.name && entry.birth === (person.birth?.date || ''));

export function validateEntry(entry) {
  if (!plain(entry) || typeof entry.id !== 'string' || !/^@[^@\s]{1,100}@$/.test(entry.id)
      || typeof entry.name !== 'string' || entry.name.length > 1000
      || typeof entry.birth !== 'string' || entry.birth.length > 200
      || typeof entry.note !== 'string' || entry.note.length > MAX_NOTE
      || typeof entry.favorite !== 'boolean' || typeof entry.updatedAt !== 'string'
      || !Number.isFinite(Date.parse(entry.updatedAt))) throw new Error('Une fiche du carnet est invalide. Rien n’a été importé.');
  return { id: entry.id, name: entry.name, birth: entry.birth, note: entry.note, favorite: entry.favorite, updatedAt: entry.updatedAt };
}

export function parseBackup(text, data) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Ce fichier dépasse la limite de 10 Mo.');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('Ce fichier n’est pas une sauvegarde JSON lisible.'); }
  if (!plain(value) || value.format !== NOTEBOOK_FORMAT || value.version !== NOTEBOOK_VERSION
      || !plain(value.tree) || value.tree.rootId !== data.meta.rootId || value.tree.sha256 !== data.meta.sha256
      || !Array.isArray(value.entries) || value.entries.length > 100000) {
    throw new Error('Sauvegarde incompatible : utilisez un carnet de ce même export généalogique.');
  }
  const ids = new Set();
  return value.entries.map(raw => {
    const entry = validateEntry(raw);
    if (ids.has(entry.id)) throw new Error('La sauvegarde contient un identifiant répété. Rien n’a été importé.');
    ids.add(entry.id);
    // Unmatched records can be preserved and exported, but never attached silently.
    return entry;
  });
}

export function mergeEntries(current, incoming) {
  const entries = new Map(current.map(entry => [entry.id, validateEntry(entry)]));
  const report = { added: 0, notes: 0, favorites: 0, conflicts: 0, unchanged: 0 };
  for (const raw of incoming) {
    const item = validateEntry(raw), prior = entries.get(item.id);
    if (!prior) { entries.set(item.id, item); report.added++; continue; }
    if (prior.name !== item.name || prior.birth !== item.birth) { report.conflicts++; continue; }
    const note = prior.note || item.note, favorite = prior.favorite || item.favorite;
    if (prior.note && item.note && prior.note !== item.note) report.conflicts++;
    if (!prior.note && item.note) report.notes++;
    if (!prior.favorite && item.favorite) report.favorites++;
    if (note === prior.note && favorite === prior.favorite) report.unchanged++;
    else entries.set(item.id, { ...prior, note, favorite, updatedAt: new Date().toISOString() });
  }
  return { entries: [...entries.values()], report };
}

export function makeBackup(entries, data) {
  return { format: NOTEBOOK_FORMAT, version: NOTEBOOK_VERSION, createdAt: new Date().toISOString(),
    tree: { rootId: data.meta.rootId, sha256: data.meta.sha256, exportedAt: data.meta.sourceExport },
    entries: entries.map(validateEntry) };
}

export const combinedNote = (current, incoming) => `${current}\n\n— Note issue de la sauvegarde —\n${incoming}`;

// Compare only affected records, including their revisions. Unrelated edits remain safe.
function restoreSnapshot(current, incoming) {
  const byId = new Map(current.map(entry => [entry.id, validateEntry(entry)]));
  return JSON.stringify(incoming.map(entry => byId.get(entry.id) || null));
}

export function previewRestore(current, incoming) {
  const merged = mergeEntries(current, incoming);
  const byId = new Map(current.map(entry => [entry.id, entry]));
  const conflicts = incoming.flatMap(item => {
    const prior = byId.get(item.id);
    if (!prior) return [];
    const identityChanged = prior.name !== item.name || prior.birth !== item.birth;
    if (!identityChanged && (!prior.note || !item.note || prior.note === item.note)) return [];
    return [{ id: item.id, current: prior, incoming: item, identityChanged,
      canCombine: !identityChanged && combinedNote(prior.note, item.note).length <= MAX_NOTE }];
  });
  return { report: merged.report, conflicts, snapshot: restoreSnapshot(current, incoming) };
}

export function applyRestore(current, incoming, preview, choices = {}) {
  if (restoreSnapshot(current, incoming) !== preview.snapshot) {
    throw new Error('Le carnet a changé depuis l’aperçu. Vérifiez le nouvel aperçu avant de restaurer.');
  }
  const fresh = previewRestore(current, incoming);
  const merged = mergeEntries(current, incoming);
  const byId = new Map(merged.entries.map(entry => [entry.id, entry]));
  let combined = 0;
  for (const conflict of fresh.conflicts) {
    const choice = choices[conflict.id] || 'keep';
    if (!['keep', 'combine'].includes(choice)) throw new Error('Choix de restauration invalide.');
    if (choice === 'combine') {
      if (!conflict.canCombine) throw new Error('Ces notes ne peuvent pas être réunies : identité différente ou limite de 20 000 caractères.');
      const entry = byId.get(conflict.id);
      byId.set(conflict.id, validateEntry({ ...entry, note: combinedNote(conflict.current.note, conflict.incoming.note), updatedAt: new Date().toISOString() }));
      combined++;
    }
  }
  return { entries: [...byId.values()], report: { ...merged.report, combined } };
}

// Each operation reads the current record inside one read/write transaction.
// Another tab changing a favorite cannot overwrite the note with stale state.
export function openNotebook(factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!factory) return reject(new Error('Le stockage personnel n’est pas disponible dans ce navigateur.'));
    const request = factory.open('heritage-notebook', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('entries', { keyPath: 'id' });
      request.result.createObjectStore('settings');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Fermez les autres onglets Héritage puis réessayez.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      function transaction(storeName, mode, work) {
        return new Promise((done, fail) => {
          const tx = db.transaction(storeName, mode), store = tx.objectStore(storeName);
          let result, problem;
          const finish = value => { result = value; };
          const abort = error => { problem = error; tx.abort(); };
          tx.oncomplete = () => done(result);
          tx.onabort = () => fail(problem || tx.error || new Error('L’enregistrement a échoué.'));
          tx.onerror = () => {}; // Failure is reported only once, on abort.
          try { work(store, finish, abort); } catch (error) { abort(error); }
        });
      }
      resolve({
        all: () => transaction('entries', 'readonly', (store, done) => { store.getAll().onsuccess = event => done(event.target.result); }),
        update: (person, patch) => transaction('entries', 'readwrite', (store, done, abort) => {
          store.get(person.id).onsuccess = event => {
            try {
              const previous = event.target.result;
              if (previous && !matchesPerson(previous, person)) throw new Error('Cette fiche a changé depuis votre annotation. Exportez le carnet avant de la rapprocher.');
              if (patch.note !== undefined && patch.expectedNote !== undefined && patch.expectedNote !== (previous?.note || '')) throw new Error('La note a été modifiée dans un autre onglet. Copiez votre texte avant de rouvrir la fiche.');
              const entry = validateEntry({ ...identity(person), note: '', favorite: false, ...previous, ...patch, updatedAt: new Date().toISOString() });
              if (entry.id !== person.id) throw new Error('Identifiant incohérent.');
              if (!entry.note && !entry.favorite) store.delete(entry.id);
              else store.put(entry);
              done(entry);
            } catch (error) { abort(error); }
          };
        }),
        restore: (incoming, preview, choices) => transaction('entries', 'readwrite', (store, done, abort) => {
          store.getAll().onsuccess = event => {
            try {
              const merged = preview ? applyRestore(event.target.result, incoming, preview, choices) : mergeEntries(event.target.result, incoming);
              merged.entries.forEach(entry => store.put(entry));
              done(merged.report);
            } catch (error) { abort(error); }
          };
        }),
        getSettings: () => transaction('settings', 'readonly', (store, done) => { store.get('navigation').onsuccess = event => done(event.target.result); }),
        setSettings: value => transaction('settings', 'readwrite', (store, done) => { store.put(value, 'navigation'); done(value); }),
        close: () => db.close()
      });
    };
  });
}
