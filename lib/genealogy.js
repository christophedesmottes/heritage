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
    dates: { birth: dateRange(p.birth?.date), death: dateRange(p.death?.date) },
    places: normalize([p.birth?.place, p.death?.place, ...(p.events ?? []).map(event => event.place)].join(' ')),
    text: normalize([p.name, ...(p.names ?? []).map(n => n.name),
      p.birth?.date, p.birth?.place, p.death?.date, p.death?.place, ...(p.events ?? []).map(event => event.place)].join(' '))
  })).sort((a, b) => people[a.id].name.localeCompare(people[b.id].name, 'fr'));
}

export function queryIndex(index, query, offset = 0, limit = 60, filters = {}) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const ids = []; let total = 0;
  for (const entry of index) {
    if (filters.ids && !filters.ids.has(entry.id)) continue;
    if (normalize(filters.place || '').split(/\s+/).filter(Boolean).some(word => !(entry.places || '').includes(word))) continue;
    if (filters.from !== undefined || filters.to !== undefined) {
      const range = entry.dates?.[filters.event || 'birth'];
      if (!range || range[1] < (filters.from ?? -Infinity) || range[0] > (filters.to ?? Infinity)) continue;
    }
    if (!words.every(word => word.startsWith('@') || /^i\d+$/.test(word)
      ? entry.reference.includes(word) : entry.text.includes(word))) continue;
    if (total >= offset && ids.length < limit) ids.push(entry.id);
    total++;
  }
  return { ids, total, hasMore: offset + ids.length < total };
}

// Uncertain GEDCOM dates keep their bounds; ABT/EST/CAL filter by the stated year.
export function dateRange(raw = '') {
  const years = raw.match(/\b\d{3,4}\b/g)?.map(Number);
  if (!years?.length) return null;
  if (/^BEF\b/.test(raw)) return [-Infinity, years[0] - 1];
  if (/^AFT\b/.test(raw)) return [years[0] + 1, Infinity];
  if (/^TO\b/.test(raw)) return [-Infinity, years[0]];
  if (/^FROM\b/.test(raw) && years.length === 1) return [years[0], Infinity];
  return [Math.min(...years), Math.max(...years)];
}

export function buildKinshipGraph(data) {
  const graph = new Map(Object.keys(data.people).map(id => [id, []]));
  const add = (from, to, kind, familyId = '', pedigree = '') => {
    if (from === to || !graph.has(from) || !graph.has(to)) return;
    const existing = graph.get(from).find(edge => edge.to === to && edge.kind === kind);
    if (existing) { if (pedigree && !existing.pedigree.includes(pedigree)) existing.pedigree.push(pedigree); return; }
    graph.get(from).push({ to, kind, familyId, pedigree: pedigree ? [pedigree] : [] });
  };
  for (const [fid, family] of Object.entries(data.families ?? {})) {
    for (const child of family.children) for (const parent of family.parents) {
      const pedigree = data.people[child]?.parentLinks?.find(link => link.familyId === fid)?.pedigree || '';
      add(child, parent, 'parent', fid, pedigree); add(parent, child, 'child', fid, pedigree);
    }
    for (const a of family.parents) for (const b of family.parents) add(a, b, 'partner', fid);
  }
  for (const person of Object.values(data.people)) {
    for (const parent of person.parents ?? []) { add(person.id, parent, 'parent'); add(parent, person.id, 'child'); }
    for (const child of person.children ?? []) { add(person.id, child, 'child'); add(child, person.id, 'parent'); }
    for (const partner of person.partners ?? []) { add(person.id, partner, 'partner'); add(partner, person.id, 'partner'); }
  }
  for (const edges of graph.values()) edges.sort((a, b) => a.to.localeCompare(b.to));
  return graph;
}

function walk(graph, start, accept) {
  const visited = new Map([[start, { distance: 0, previous: null, edge: null }]]), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const edge of graph.get(id) ?? []) {
      if (!accept(edge) || visited.has(edge.to)) continue;
      visited.set(edge.to, { distance: visited.get(id).distance + 1, previous: id, edge }); queue.push(edge.to);
    }
  }
  return visited;
}

export function branchIds(graph, reference, mode) {
  if (!graph.has(reference)) return new Set();
  return new Set(walk(graph, reference, edge => edge.kind === (mode === 'ancestors' ? 'parent' : 'child')).keys());
}

function pathTo(visited, end) {
  const path = [end], steps = [];
  while (visited.get(end)?.previous !== null) {
    const item = visited.get(end); if (!item) break;
    steps.unshift(item.edge); end = item.previous; path.unshift(end);
  }
  return { path, steps };
}

function kinshipLabel(a, b, person) {
  const sex = person.sex;
  const word = (male, female, neutral) => sex === 'M' ? male : sex === 'F' ? female : neutral;
  if (!b) {
    if (a === 1) return word('Père', 'Mère', 'Parent');
    if (a === 2) return word('Grand-père', 'Grand-mère', 'Grand-parent');
    if (a === 3) return word('Arrière-grand-père', 'Arrière-grand-mère', 'Arrière-grand-parent');
    return `Ancêtre à ${a} générations`;
  }
  if (!a) {
    if (b === 1) return word('Fils', 'Fille', 'Enfant');
    if (b === 2) return word('Petit-fils', 'Petite-fille', 'Petit-enfant');
    if (b === 3) return word('Arrière-petit-fils', 'Arrière-petite-fille', 'Arrière-petit-enfant');
    return `Descendant à ${b} générations`;
  }
  if (a === 1 && b === 1) return word('Frère ou demi-frère', 'Sœur ou demi-sœur', 'Fratrie ou demi-fratrie');
  if (b === 1 && a === 2) return word('Oncle ou demi-oncle', 'Tante ou demi-tante', 'Oncle / tante');
  if (a === 1 && b === 2) return word('Neveu ou demi-neveu', 'Nièce ou demi-nièce', 'Neveu / nièce');
  if (b === 1) return `Fratrie d’un ancêtre à ${a - 1} générations`;
  if (a === 1) return `Descendance de la fratrie à ${b - 1} générations`;
  return word('Cousin', 'Cousine', 'Cousinage') + (a !== b ? ' · générations décalées' : ' · ascendance commune');
}

export function findKinship(data, from, to, graph = buildKinshipGraph(data)) {
  if (!graph.has(from) || !graph.has(to)) return { kind: 'missing', label: 'Personne absente de cet export', path: [], steps: [] };
  if (from === to) return { kind: 'self', label: 'Même personne', path: [from], steps: [] };
  const directUnion = graph.get(from).find(edge => edge.to === to && edge.kind === 'partner');
  if (directUnion) return { kind: 'alliance', label: 'Conjoint·e / autre parent déclaré', path: [from, to], steps: [directUnion] };
  const left = walk(graph, from, edge => edge.kind === 'parent');
  const right = walk(graph, to, edge => edge.kind === 'parent');
  const common = [...left.keys()].filter(id => right.has(id)).sort((x, y) =>
    (left.get(x).distance + right.get(x).distance) - (left.get(y).distance + right.get(y).distance)
    || Math.max(left.get(x).distance, right.get(x).distance) - Math.max(left.get(y).distance, right.get(y).distance)
    || x.localeCompare(y));
  if (common.length) {
    const ancestor = common[0], a = left.get(ancestor).distance, b = right.get(ancestor).distance;
    const first = pathTo(left, ancestor), second = pathTo(right, ancestor);
    const reverse = second.steps.slice().reverse().map((edge, i) => ({ ...edge, kind: 'child', to: second.path[second.path.length - 2 - i] }));
    let label = kinshipLabel(a, b, data.people[to]);
    if (a === 1 && b === 1) {
      const parentsFrom = graph.get(from).filter(edge => edge.kind === 'parent').map(edge => edge.to);
      const parentsTo = graph.get(to).filter(edge => edge.kind === 'parent').map(edge => edge.to);
      const shared = parentsFrom.filter(id => parentsTo.includes(id)).length;
      const base = data.people[to].sex === 'F' ? 'Sœur' : data.people[to].sex === 'M' ? 'Frère' : 'Fratrie';
      if (shared >= 2) label = base;
      else if (parentsFrom.length >= 2 && parentsTo.length >= 2) label = 'Demi-' + base.toLowerCase();
    }
    return { kind: 'lineage', label, ancestor, generations: [a, b],
      path: [...first.path, ...second.path.slice(0, -1).reverse()], steps: [...first.steps, ...reverse] };
  }
  const connected = walk(graph, from, () => true);
  if (!connected.has(to)) return { kind: 'none', label: 'Aucun chemin trouvé dans cet export', path: [], steps: [] };
  return { kind: 'family', label: 'Lien familial par les filiations et unions déclarées', ...pathTo(connected, to) };
}

// Display only the selected path. A parent/child turn becomes a sibling fork,
// with the actual shared parents retained above it as context.
export function layoutKinship(data, result, graph = buildKinshipGraph(data)) {
  const nodes = [], edges = [], forks = [];
  let row = 0, col = 0, previousKind = '';
  const add = id => { const node = { id, row, col, context: false }; nodes.push(node); return node; };
  if (!result.path.length) return { nodes, edges, width: 0, height: 0 };
  let previous = add(result.path[0]);
  for (let i = 0; i < result.steps.length; i++) {
    let edge = result.steps[i], kind = edge.kind;
    if (kind === 'parent' && result.steps[i + 1]?.kind === 'child') {
      const other = result.path[i + 2];
      const shared = (graph.get(previous.id) ?? []).filter(e => e.kind === 'parent' &&
        (graph.get(other) ?? []).some(x => x.kind === 'parent' && x.to === e.to));
      // Keep adoption and other pedigree qualifications on the highlighted link.
      edge = { ...edge, pedigree: [...new Set([...edge.pedigree, ...result.steps[i + 1].pedigree])] };
      col += 2; const next = add(other);
      edges.push({ from: previous.id, to: next.id, kind: 'sibling', pedigree: edge.pedigree });
      forks.push({ left: previous, right: next, parents: shared.map(e => e.to), row: row - 1 });
      previous = next; previousKind = 'sibling'; i++; continue;
    }
    if (kind === 'partner' || (previousKind === 'child' && kind === 'parent')) col += 2;
    if (kind === 'parent') row--;
    if (kind === 'child') row++;
    const next = add(result.path[i + 1]);
    edges.push({ from: previous.id, to: next.id, kind, pedigree: edge.pedigree });
    previous = next; previousKind = kind;
  }
  for (const fork of forks) for (const [index, id] of fork.parents.entries()) {
    let parent = nodes.find(n => n.id === id);
    if (!parent) {
      let column = fork.left.col + index;
      while (nodes.some(n => n.row === fork.row && n.col === column)) column++;
      parent = { id, row: fork.row, col: column, context: true }; nodes.push(parent);
    }
    for (const child of [fork.left, fork.right]) edges.push({ from: id, to: child.id, kind: 'context', pedigree: [] });
  }
  const minRow = Math.min(...nodes.map(n => n.row));
  for (const node of nodes) { node.x = 40 + node.col * 240; node.y = 40 + (node.row - minRow) * 210; }
  return { nodes, edges, width: Math.max(...nodes.map(n => n.x)) + 230,
    height: Math.max(...nodes.map(n => n.y)) + 190 };
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
