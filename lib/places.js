import { dateRange, normalize } from './genealogy.js';

export const MAP_TAGS = { BIRT: 'Naissance', MARR: 'Mariage', RESI: 'Résidence', IMMI: 'Immigration', EMIG: 'Émigration', DEAT: 'Décès' };
export function placeText(value = '') {
  return normalize(String(value)).replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function contextText(value) {
  return placeText(value).replace(/^(?:province|provincie|region|departement|arrondissement|county|state)(?: of| de| du| d)? /, '')
    .replace(/ county$/, '').replace(/^(?:wallonia|walloon region|region wallonne)$/, 'wallonie');
}
export function placeParts(raw) {
  return String(raw || '').replace(/[()]/g, ',').replace(/@/g, ',').replace(/-\s+/g, ',')
    .split(/[,;]+/).map(placeText).filter(Boolean);
}
export function placeKey(raw) { return placeParts(raw).join('|'); }

export function makeGazetteer(data) {
  if (data?.version !== 1 || !Array.isArray(data.places) || !Array.isArray(data.countries)) throw new Error('Référentiel géographique invalide.');
  const countries = new Map(), countryNames = new Map(), byId = new Map(), names = new Map(), frenchDepartments = new Map();
  const fr = new Intl.DisplayNames(['fr'], { type: 'region' });
  for (const [code, iso3, name] of data.countries) {
    countryNames.set(code, fr.of(code) || name);
    for (const alias of [code, iso3, name, fr.of(code)]) if (alias) countries.set(placeText(alias), code);
  }
  for (const [code, aliases] of Object.entries({ US: ['USA', 'États-Unis', 'United States of America'], GB: ['UK', 'Royaume-Uni', 'Great Britain'], BE: ['Belgique', 'Belgium'], FR: ['France'] })) {
    for (const alias of aliases) countries.set(placeText(alias), code);
  }
  for (const row of data.places) {
    const [id, name, country, context, aliases, lon, lat] = row;
    if (typeof id !== 'string' || typeof name !== 'string' || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 || byId.has(id)) continue;
    const record = { id, name, country, context, aliases, lon, lat, keys: new Set(context.map(contextText)) };
    byId.set(id, record);
    for (const alias of new Set([name, ...aliases].map(placeText))) {
      if (!alias) continue;
      if (!names.has(alias)) names.set(alias, []);
      names.get(alias).push(record);
    }
    if (id.startsWith('fr:')) {
      frenchDepartments.set(placeText(context[0]), country);
      frenchDepartments.set(placeText(context[1]), country);
    }
  }
  const label = record => [...new Set([record.name, record.country === 'BE' ? record.context.find(x => /^province /i.test(x)) : record.context.find(x => !/^\d/.test(x)), countryNames.get(record.country) || record.country].filter(Boolean))].join(', ');
  return { countries, countryNames, byId, names, frenchDepartments, label, outlines: data.outlines || [], sources: data.sources || [] };
}

export function resolvePlace(raw, gazetteer, choices = {}) {
  const key = placeKey(raw), parts = placeParts(raw), saved = Object.hasOwn(choices, key) ? choices[key] : undefined;
  if (saved === 'exclude') return { key, status: 'excluded', candidates: [] };
  if (typeof saved === 'string' && gazetteer.byId.has(saved)) return { key, status: 'confirmed', record: gazetteer.byId.get(saved), candidates: [] };
  if (!parts.length || /^(?:inconnu|unknown|non renseigne|n a)$/.test(parts[0])) return { key, status: 'missing', candidates: [] };
  let country = gazetteer.countries.get(parts.at(-1));
  if (parts.length === 1 && country) return { key, status: 'broad', candidates: [] };
  let locality = parts[0], contexts = parts.slice(1, country ? -1 : undefined);
  const belgianPostal = locality.match(/^b\s*(\d{4})\s+(.+)$/);
  if (belgianPostal && (!country || country === 'BE')) { country = 'BE'; locality = belgianPostal[2]; }
  if (!country && contexts.some(x => gazetteer.frenchDepartments.has(x))) country = 'FR';
  const all = gazetteer.names.get(locality) || [];
  const candidates = all.filter(r => !country || r.country === country);
  const matching = candidates.filter(r => contexts.every(value => r.keys.has(contextText(value))));
  // Postal prefixes without a postal reference and sparsely covered countries
  // need confirmation. A unique catalog result alone is not proof of identity.
  if (country && !belgianPostal && matching.length === 1 && (['FR', 'BE'].includes(country) || contexts.length)) return { key, status: 'matched', record: matching[0], candidates: [] };
  const offered = matching.length ? matching : candidates;
  return { key, status: offered.length ? 'review' : 'unknown', candidates: offered.slice(0, 40), candidateCount: offered.length };
}

export function collectMapEvents(data) {
  const events = [], seen = new Set(), familySignatures = new Set();
  const signature = e => JSON.stringify([e.tag, e.date || '', placeKey(e.place)]);
  const add = (event, ids, owner) => {
    if (!event || !MAP_TAGS[event.tag] || !(event.recorded || event.place || event.date || event.value)) return;
    const personIds = [...new Set(ids)].filter(id => data.people[id]);
    if (!personIds.length) return;
    const key = owner + ':' + signature(event);
    if (seen.has(key)) return;
    seen.add(key);
    events.push({ id: key, personIds, tag: event.tag, date: event.date || '', place: String(event.place || ''), owner, range: dateRange(event.date || '') });
  };
  for (const [id, family] of Object.entries(data.families || {})) {
    const source = [...(family.events || [])];
    if (family.marriage) source.push({ ...family.marriage, tag: 'MARR' });
    for (const e of source.filter(e => e.tag === 'MARR')) {
      add(e, family.parents || [], 'family:' + id);
      for (const pid of family.parents || []) familySignatures.add(pid + ':' + signature(e));
    }
  }
  for (const [id, person] of Object.entries(data.people)) {
    const source = [...(person.events || [])];
    if (person.birth) source.push({ ...person.birth, tag: 'BIRT' });
    if (person.death) source.push({ ...person.death, tag: 'DEAT' });
    for (const e of source) {
      if (e.tag === 'MARR' && familySignatures.has(id + ':' + signature(e))) continue;
      add(e, [id], 'person:' + id);
    }
  }
  return events;
}

export function groupPlaces(events, gazetteer, choices = {}) {
  const groups = new Map();
  for (const event of events) {
    const key = placeKey(event.place);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { key, variants: new Set(), events: [], ...resolvePlace(event.place, gazetteer, choices) });
    const group = groups.get(key);
    group.variants.add(event.place); group.events.push(event);
  }
  return [...groups.values()].sort((a, b) => b.events.length - a.events.length || a.key.localeCompare(b.key));
}

export function filterMapEvents(events, { ids = null, tag = '', query = '', people = {}, from, to } = {}) {
  const words = placeText(query).split(' ').filter(Boolean);
  return events.filter(e => (!ids || e.personIds.some(id => ids.has(id))) && (!tag || e.tag === tag)
    && (from === undefined && to === undefined || e.range && e.range[1] >= (from ?? -Infinity) && e.range[0] <= (to ?? Infinity))
    && words.every(w => placeText([e.place, ...e.personIds.map(id => people[id]?.name || '')].join(' ')).includes(w)));
}

// Paths link observations, not actual journeys. Same-year/uncertain dates never acquire a direction.
export function mapRoutes(events, groups, personId) {
  const lookup = new Map(groups.map(g => [g.key, g.record]));
  const timeline = events.filter(e => e.personIds.includes(personId)).map(e => ({ ...e, record: lookup.get(placeKey(e.place)) }))
    .sort((a, b) => (a.range?.[0] ?? Infinity) - (b.range?.[0] ?? Infinity) || a.id.localeCompare(b.id));
  const segments = [];
  let previous;
  for (const item of timeline) {
    if (!item.record || !item.range || item.range.some(x => !Number.isFinite(x)) || /\b(?:ABT|EST|CAL|BEF|AFT|BET|FROM|TO)\b/i.test(item.date)) { previous = null; continue; }
    if (previous && previous.range[1] < item.range[0] && previous.record.id !== item.record.id && Math.abs(previous.record.lon - item.record.lon) < 180) segments.push({ from: previous, to: item });
    previous = item;
  }
  return { timeline, segments };
}

export function validPlaceChoices(input, gazetteer) {
  if (!input || input.format !== 'heritage-place-choices' || input.version !== 1 || !input.choices || typeof input.choices !== 'object' || Array.isArray(input.choices)) throw new Error('Fichier de rapprochements invalide.');
  const valid = Object.create(null), entries = Object.entries(input.choices);
  if (entries.length > 50000) throw new Error('Fichier trop volumineux.');
  for (const [key, value] of entries) {
    if (!key || key.length > 1000 || ['__proto__', 'constructor', 'prototype'].includes(key) || typeof value !== 'string' || (value !== 'exclude' && !gazetteer.byId.has(value))) throw new Error('Rapprochement inconnu ou invalide. Aucun choix appliqué.');
    valid[key] = value;
  }
  return valid;
}
