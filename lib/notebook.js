export const NOTEBOOK_FORMAT = 'heritage-notebook';
export const NOTEBOOK_VERSION = 1;
export const MAX_NOTE = 20000;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const identity = person => ({ id: person.id, name: person.name, birth: person.birth?.date || '' });
export const matchesPerson = (entry, person) => Boolean(person && entry.id === person.id &&
  [{ name: person.name, birth: person.birth?.date || '' }, ...(person.previousIdentities || [])]
    .some(prior => entry.name === prior.name && entry.birth === prior.birth));

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
      || !plain(value.tree) || ![{ rootId: data.meta.rootId, sha256: data.meta.sha256 }, ...(data.meta.previousExports || [])]
        .some(prior => prior.rootId === value.tree.rootId && prior.sha256 === value.tree.sha256)
      || !Array.isArray(value.entries) || value.entries.length > 100000) {
    throw new Error('Sauvegarde incompatible : utilisez un carnet de cet arbre ou d’un export antérieur reconnu.');
  }
  const ids = new Set();
  return value.entries.map(raw => {
    const entry = validateEntry(raw);
    if (ids.has(entry.id)) throw new Error('La sauvegarde contient un identifiant répété. Rien n’a été importé.');
    ids.add(entry.id);
    // Unmatched records can be preserved and exported, but never attached silently.
    const person = data.people?.[entry.id];
    return matchesPerson(entry, person) ? { ...entry, ...identity(person) } : entry;
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

// Synchronization compares each field against the last common version. Device
// clocks are deliberately irrelevant; deletions are empty note/favorite pairs.
export function reconcileNotebook(base, local, remote) {
  const maps = [base, local, remote].map(list => new Map(list.map(raw => {
    const entry = validateEntry(raw); return [entry.id, entry];
  })));
  const entries = [], conflicts = [];
  for (const id of new Set(maps.flatMap(map => [...map.keys()]))) {
    const [prior, here, there] = maps.map(map => map.get(id));
    const present = [here, there, prior].filter(Boolean);
    const reference = present[0];
    // Identity changes need a verified reimport alias before reconciliation.
    if (present.some(entry => entry.name !== reference.name || entry.birth !== reference.birth)) {
      conflicts.push({ id, reason: 'identity', base: prior ?? null, local: here ?? null, remote: there ?? null });
      if (here) entries.push(here);
      continue;
    }
    const next = { ...reference }, fields = [];
    for (const field of ['note', 'favorite']) {
      const empty = field === 'note' ? '' : false;
      const [before, current, incoming] = [prior, here, there].map(entry => entry?.[field] ?? empty);
      if (current === incoming || incoming === before) next[field] = current;
      else if (current === before) next[field] = incoming;
      else { fields.push(field); next[field] = current; }
    }
    if (fields.length) conflicts.push({ id, reason: 'content', fields, base: prior ?? null, local: here ?? null, remote: there ?? null });
    if (next.note || next.favorite) entries.push(next);
  }
  return { entries, conflicts };
}

export function notebookCode(random = globalThis.crypto) {
  return 'H1-' + [...random.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export const validNotebookCode = code => typeof code === 'string' && /^H1-[a-f0-9]{32}$/.test(code);
export const sameNotebookContents = (a, b) => {
  const comparable = entries => JSON.stringify(entries.map(({ id, name, birth, note, favorite }) =>
    [id, name, birth, note, favorite]).sort((x, y) => x[0].localeCompare(y[0])));
  return comparable(a) === comparable(b);
};

// request is supplied by the authenticated transport, keeping reconciliation
// independently testable. The server snapshot has a monotonic CAS revision.
export async function synchronizeNotebook({ store, tree, data, request, canCommit = () => true }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const snapshot = await store.syncSnapshot(tree), state = snapshot.sync;
    if (!state || state.paused || state.conflicts?.length || !canCommit()) return snapshot;
    if (!validNotebookCode(state.code)) throw new Error('Code personnel invalide.');
    const normalize = list => list.map(raw => {
      const entry = validateEntry(raw), person = data.people[entry.id];
      return matchesPerson(entry, person) ? { ...entry, ...identity(person) } : entry;
    });
    const validateRemote = value => {
      if (!Number.isSafeInteger(value?.revision) || value.revision < 0 || !Array.isArray(value.entries)
          || value.entries.length > 10000) throw new Error('Réponse de synchronisation invalide.');
      const entries = normalize(value.entries);
      if (new Set(entries.map(e => e.id)).size !== entries.length) throw new Error('Fiches distantes répétées.');
      return { ...value, entries };
    };
    const remote = validateRemote(await request(state.pendingCreate ? 'create' : 'read', state.code));
    const base = normalize(state.base || []);
    // A lost write acknowledgement must not make an intentional local deletion
    // indistinguishable from a never-seen remote note during the next pairing.
    for (const prior of normalize(state.deletions || [])) {
      const index = base.findIndex(e => e.id === prior.id);
      if (index < 0) { base.push(prior); continue; }
      const theirs = remote.entries.find(e => e.id === prior.id);
      // Keep the acknowledged baseline when the server is unchanged; otherwise
      // compare a removal with the last local value that was explicitly removed.
      for (const field of ['note', 'favorite']) {
        const empty = field === 'note' ? '' : false;
        if (prior[field] && (theirs?.[field] ?? empty) !== base[index][field]) base[index][field] = prior[field];
      }
    }
    const merged = reconcileNotebook(base, normalize(snapshot.entries), remote.entries);
    if (!canCommit()) return snapshot;
    if (merged.conflicts.length) {
      return store.syncCommit(tree, snapshot, merged.entries, { ...state, pendingCreate: false,
        conflicts: merged.conflicts, revision: remote.revision, conflictRemote: remote.entries });
    }
    let saved = remote;
    if (!sameNotebookContents(merged.entries, remote.entries)) {
      try { saved = validateRemote(await request('write', state.code, { revision: remote.revision, entries: merged.entries })); }
      catch (error) { if (error.status === 409) continue; throw error; }
    }
    if (!canCommit()) return snapshot;
    return store.syncCommit(tree, snapshot, saved.entries, { ...state, pendingCreate: false, base: saved.entries,
      revision: saved.revision, conflicts: [], conflictRemote: null, deletions: [], lastSynced: new Date().toISOString() });
  }
  throw new Error('Un autre appareil modifie le Carnet. Réessayez dans un instant.');
}

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
      let syncTree = '';
      function transaction(storeName, mode, work, extraStores = []) {
        return new Promise((done, fail) => {
          const tx = db.transaction([storeName, ...extraStores], mode), store = tx.objectStore(storeName);
          let result, problem;
          const finish = value => { result = value; };
          const abort = error => { problem = error; tx.abort(); };
          tx.oncomplete = () => done(result);
          tx.onabort = () => fail(problem || tx.error || new Error('L’enregistrement a échoué.'));
          tx.onerror = () => {}; // Failure is reported only once, on abort.
          try { work(store, finish, abort, tx); } catch (error) { abort(error); }
        });
      }
      function syncTransaction(tree, mode, work) {
        return new Promise((done, fail) => {
          const tx = db.transaction(['entries', 'settings'], mode);
          const records = tx.objectStore('entries'), settings = tx.objectStore('settings');
          const key = 'sync-notebook:' + tree;
          const all = records.getAll(), state = settings.get(key);
          let result, problem;
          tx.oncomplete = () => done(result);
          tx.onabort = () => fail(problem || tx.error || new Error('Le Carnet a changé. Réessayez.'));
          tx.onerror = () => {};
          let read = 0;
          const ready = () => {
            if (++read !== 2) return;
            try { result = work({ entries: all.result, sync: state.result ?? null }, records, settings, key); }
            catch (error) { problem = error; tx.abort(); }
          };
          all.onsuccess = state.onsuccess = ready;
        });
      }
      resolve({
        syncSnapshot: tree => { syncTree = tree; return syncTransaction(tree, 'readonly', snapshot => snapshot); },
        syncCommit: (tree, expected, entries, sync) => syncTransaction(tree, 'readwrite', (current, records, settings, key) => {
          if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('Le Carnet a changé pendant la synchronisation. Réessayez.');
          const checked = entries.map(validateEntry);
          if (new Set(checked.map(entry => entry.id)).size !== checked.length) throw new Error('Fiches répétées.');
          records.clear(); checked.forEach(entry => records.put(entry));
          if (sync) settings.put(sync, key); else settings.delete(key);
          return { entries: checked, sync };
        }),
        all: () => transaction('entries', 'readonly', (store, done) => { store.getAll().onsuccess = event => done(event.target.result); }),
        rebase: people => transaction('entries', 'readwrite', (store, done, abort) => {
          store.getAll().onsuccess = event => {
            try {
              let updated = 0;
              for (const entry of event.target.result) {
                const person = people[entry.id];
                if (matchesPerson(entry, person) && (entry.name !== person.name || entry.birth !== (person.birth?.date || ''))) {
                  store.put(validateEntry({ ...entry, ...identity(person) })); updated++;
                }
              }
              done(updated);
            } catch (error) { abort(error); }
          };
        }),
        update: (person, patch) => transaction('entries', 'readwrite', (store, done, abort, tx) => {
          store.get(person.id).onsuccess = event => {
            try {
              const previous = event.target.result;
              if (previous && !matchesPerson(previous, person)) throw new Error('Cette fiche a changé depuis votre annotation. Exportez le carnet avant de la rapprocher.');
              if (patch.note !== undefined && patch.expectedNote !== undefined && patch.expectedNote !== (previous?.note || '')) throw new Error('La note a été modifiée dans un autre onglet. Copiez votre texte avant de rouvrir la fiche.');
              const entry = validateEntry({ note: '', favorite: false, ...previous, ...identity(person), ...patch, updatedAt: new Date().toISOString() });
              if (entry.id !== person.id) throw new Error('Identifiant incohérent.');
              if (!entry.note && !entry.favorite) store.delete(entry.id);
              else store.put(entry);
              if (syncTree) {
                const settings = tx.objectStore('settings'), key = 'sync-notebook:' + syncTree;
                settings.get(key).onsuccess = event => {
                  try {
                    const state = event.target.result; if (!state) return;
                    const prior = (state.deletions || []).find(e => e.id === entry.id);
                    const deletion = validateEntry({ ...entry,
                      note: entry.note ? '' : (previous?.note || prior?.note || ''),
                      favorite: entry.favorite ? false : Boolean(previous?.favorite || prior?.favorite) });
                    const deletions = (state.deletions || []).filter(e => e.id !== entry.id);
                    if (deletion.note || deletion.favorite) deletions.push(deletion);
                    settings.put({ ...state, deletions }, key);
                  } catch (error) { abort(error); }
                };
              }
              done(entry);
            } catch (error) { abort(error); }
          };
        }, ['settings']),
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
