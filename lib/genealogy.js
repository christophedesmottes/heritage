const MONTHS = { JAN: 'janvier', FEB: 'février', MAR: 'mars', APR: 'avril', MAY: 'mai', JUN: 'juin', JUL: 'juillet', AUG: 'août', SEP: 'septembre', OCT: 'octobre', NOV: 'novembre', DEC: 'décembre' };
const QUALIFIERS = { ABT: 'vers', BEF: 'avant', AFT: 'après', EST: 'estimé en', CAL: 'calculé en' };

export function normalize(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[’']/g, ' ').trim();
}

export function searchPeople(people, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return Object.values(people)
    .filter(person => words.every(word => normalize(person.name).includes(word)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function formatDate(raw = '') {
  if (!raw.trim()) return 'Non renseignée';
  return raw.trim().split(/\s+/).map(token => MONTHS[token] ?? QUALIFIERS[token] ?? ({ BET: 'entre', AND: 'et', FROM: 'de', TO: 'à' }[token]) ?? token).join(' ');
}

export function yearLabel(raw = '') {
  if (!raw.trim()) return '?';
  const years = raw.match(/\b\d{3,4}\b/g);
  if (!years) return raw;
  if (years.length > 1) return formatDate(raw);
  const qualifier = raw.split(/\s+/)[0];
  return `${QUALIFIERS[qualifier] ? `${QUALIFIERS[qualifier]} ` : ''}${years[0]}`;
}

export function lifeSpan(person) {
  if (person.death?.recorded === false) return yearLabel(person.birth?.date);
  if (person.death?.recorded && !person.death.date) return `${yearLabel(person.birth?.date)} — décès non daté`;
  return `${yearLabel(person.birth?.date)} — ${yearLabel(person.death?.date)}`;
}

export function familyView(data, centerId, scope = 'all', options = {}) {
  const person = data.people[centerId];
  if (!person) throw new Error('Personne absente de cet extrait.');
  const idsFor = relation => [...new Set(person[relation] ?? [])].filter(id => id !== centerId);
  const available = relation => idsFor(relation).filter(id => data.people[id]);
  const unions = (person.fams ?? []).map(id => data.families?.[id]).filter(Boolean);
  const parentalFamilies = (person.famc ?? []).map(id => data.families?.[id]).filter(Boolean);
  const parentalFamily = parentalFamilies.find(f => f.id === options.parentFamilyId) ?? parentalFamilies[0];
  const present = ids => [...new Set(ids)].filter(id => id !== centerId && data.people[id]);
  const parents = parentalFamily ? present(parentalFamily.parents) : available('parents');
  const partners = scope === 'parents' ? [] : unions.length ? present(unions.flatMap(f => f.parents)) : available('partners');
  const children = scope === 'parents' ? [] : unions.length ? present(unions.flatMap(f => f.children)) : available('children');
  const siblings = parentalFamily ? present(parentalFamily.children) : [];
  const hiddenCount = ['parents', ...(scope === 'parents' ? [] : ['partners', 'children'])]
    .reduce((total, relation) => total + idsFor(relation).filter(id => !data.people[id]).length, 0);
  return { parents, couple: [centerId, ...partners], children, siblings, hiddenCount,
    unions, parentalFamilies, parentFamilyId: parentalFamily?.id ?? '',
    visibleIds: [...new Set([...parents, centerId, ...partners, ...children])] };
}

export function buildSearchIndex(people) {
  return Object.values(people).map(p => ({ id: p.id, reference: normalize(p.id),
    text: normalize([p.name, ...(p.names ?? []).map(n => n.name),
      p.birth?.date, p.birth?.place, p.death?.date, p.death?.place].join(' '))
  })).sort((a, b) => people[a.id].name.localeCompare(people[b.id].name, 'fr'));
}

export function queryIndex(index, query, offset = 0, limit = 60) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const ids = []; let total = 0;
  for (const entry of index) {
    if (!words.every(word => word.startsWith('@') || /^i\d+$/.test(word)
      ? entry.reference.includes(word) : entry.text.includes(word))) continue;
    if (total >= offset && ids.length < limit) ids.push(entry.id);
    total++;
  }
  return { ids, total, hasMore: offset + ids.length < total };
}

export function relationship(data, centerId, personId) {
  if (centerId === personId) return "Au centre de l'arbre";
  const center = data.people[centerId];
  const person = data.people[personId];
  const name = center.firstName?.split(' ')[0] || center.name;
  if (center.parents.includes(personId)) return `${person.sex === 'F' ? 'Mère' : person.sex === 'M' ? 'Père' : 'Parent'} de ${name}`;
  if (center.partners.includes(personId)) return `${person.sex === 'F' ? 'Conjointe' : 'Conjoint'} de ${name}`;
  if (center.children.includes(personId)) return `${person.sex === 'F' ? 'Fille' : person.sex === 'M' ? 'Fils' : 'Enfant'} de ${name}`;
  return 'Dans votre famille';
}

export function marriageEvents(data, personId) {
  const person = data.people[personId];
  return (person.fams ?? []).map(id => data.families[id])
    .filter(family => family && (family.marriage.date || family.marriage.place))
    .map(family => ({ ...family.marriage, partners: family.parents.filter(id => id !== personId).map(id => data.people[id]?.name).filter(Boolean) }));
}
