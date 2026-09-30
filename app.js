import { familyView, formatDate, lifeSpan, relationship, buildSearchIndex, queryIndex } from './lib/genealogy.js';
import { CARD, MIN_ZOOM, layoutFamily, fitZoom, zoomScroll, bindPinch } from './lib/tree-layout.js';
import { mediaFor, mediaSource, portraitFor } from './lib/media.js';
import { initPersonal, profileTools, rememberNavigation, hasUnsavedNotes } from './lib/personal-ui.js';
import { familyMode, initializeFamilyAccess, requestFamilyCode, lockFamily } from './lib/family-ui.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { data: null, center: '', selected: '', scope: 'all', view: 'tree', panel: innerWidth >= 760, zoom: innerWidth < 500 ? .9 : 1, history: [], layout: null, parentFamilyId: '', searchIndex: [], searchLimit: 60, ancestorDepth: 3, showSiblings: true, framing: innerWidth >= 760 ? 'overview' : 'selection', selectedKey: '' };
const viewport = $('#tree-viewport');
const panel = $('#portrait-panel');
const dialog = $('#search-dialog');
const isMobile = () => matchMedia('(max-width:759px)').matches;
const firstName = p => p.firstName?.split(' ')[0] || p.name;
const displayName = p => p.name || `${p.firstName} ${p.surname}`.trim();
const monogram = p => `${p.firstName?.[0] ?? ''}${p.surname?.[0] ?? ''}`;
const photoMarkup = (p, extraClass = '') => {
  const media = portraitFor(p);
  return `<span class="person-avatar ${extraClass}" aria-hidden="true">${media ? `<img src="${escape(mediaSource(media))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : ''}<span class="avatar-fallback">${escape(monogram(p))}</span></span>`;
};
const announce = message => { $('#announcement').textContent = message; };
const branchIcon = '<svg viewBox="0 0 34 24" aria-hidden="true"><path d="M14 7h6m-3 0v17"/><rect x="1" y="3" width="13" height="8" rx="2"/><rect x="20" y="3" width="13" height="8" rx="2"/></svg>';
const navigateIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7"/></svg>';

function eventMarkup(label, event, extra = '') {
  const approximate = /^(ABT|EST|CAL|BEF|AFT|BET|FROM)\b/.test(event.date ?? '');
  return `<li><span class="event-title">${escape(label)}</span><strong>${escape(formatDate(event.date))}</strong>${event.place ? `<span class="place">${escape(event.place)}</span>` : ''}${event.address ? `<span class="place imported-text">${escape(event.address)}</span>` : ''}${extra ? `<span class="place event-extra">${escape(extra)}</span>` : ''}${approximate ? '<span class="uncertain-label">Précision de la date conservée</span>' : ''}${(event.notes ?? []).map(note => `<span class="event-notes">${escape(note)}</span>`).join('')}</li>`;
}

function relativeList(label, ids) {
  const available = [...new Set(ids)].filter(id => state.data.people[id]);
  if (!available.length) return '';
  return `<p class="relative-heading">${label}</p><ul class="relative-list">${available.map(id => {
    const p = state.data.people[id];
    return `<li><button type="button" class="relative-link" data-relative="${escape(id)}"><span class="mini-avatar" aria-hidden="true">${escape(monogram(p))}</span><span><span class="relative-name">${escape(displayName(p))}</span><span class="relative-years">${escape(lifeSpan(p))}</span></span></button></li>`;
  }).join('')}</ul>`;
}

const EVENT_LABELS = { BIRT: 'Naissance', DEAT: 'Décès', BAPM: 'Baptême', CHR: 'Baptême', BURI: 'Inhumation', CREM: 'Crémation', RESI: 'Résidence', OCCU: 'Profession', EDUC: 'Études', RELI: 'Religion', EMIG: 'Émigration', IMMI: 'Immigration', NATU: 'Naturalisation', CENS: 'Recensement', MARR: 'Mariage', DIV: 'Divorce', ENGA: 'Fiançailles', ADOP: 'Adoption', RETI: 'Retraite', PROB: 'Succession', WILL: 'Testament' };
const pedigreeLabel = value => ({ adopted: 'adoption', birth: 'naissance', foster: 'famille d’accueil', sealing: 'lien déclaré' }[value?.toLowerCase()] || value || '');
const countLabel = (count, singular, plural = singular + 's') => `${count} ${count === 1 ? singular : plural}`;
const familyName = (family, personId) => family.parents.filter(id => id !== personId).map(id => state.data.people[id]?.name).filter(Boolean).join(' et ') || 'Autre parent non renseigné';

function sourceMarkup(citations) {
  const seen = new Set();
  return citations.filter(c => { const key = JSON.stringify(c); if (seen.has(key)) return false; seen.add(key); return true; }).map(c => {
    const source = state.data.sources?.[c.id];
    return `<li><strong>${escape(source?.title || c.text || c.id || 'Source sans titre')}</strong>${c.page ? `<p>${escape(c.page)}</p>` : ''}${source?.author ? `<p>${escape(source.author)}</p>` : ''}${source?.text ? `<details><summary>Lire la transcription</summary><p class="imported-text">${escape(source.text)}</p></details>` : ''}</li>`;
  }).join('');
}

function mediaMarkup(person) {
  const media = mediaFor(person);
  if (!media.length) return '';
  const allLocal = media.every(item => mediaSource(item).startsWith('./data/media/'));
  return `<details class="profile-section media-section"><summary>Photographies · ${media.length}</summary><div class="media-gallery">${media.map((item, index) => `<figure><a href="${escape(mediaSource(item))}" target="_blank" rel="noopener noreferrer" aria-label="Agrandir ${escape(item.title || `la photographie ${index + 1}`)} (nouvel onglet)"><img src="${escape(mediaSource(item))}" alt="${escape(item.title || `Photographie ${index + 1} de ${displayName(person)}`)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;this.closest('figure').querySelector('.media-unavailable').hidden=false"></a><span class="media-unavailable" hidden>Photographie indisponible</span><figcaption>${escape(item.title || `Photographie ${index + 1}`)}</figcaption></figure>`).join('')}</div><p class="source-note media-note">${allLocal ? (familyMode ? 'Ces photographies proviennent de la bibliothèque familiale privée.' : 'Ces photographies sont conservées sur ce PC.') : 'Certaines photographies nécessitent un accès à leur site d’origine.'} Cliquez sur une image pour l’agrandir.</p></details>`;
}

function selectedRelationship() {
  const n = state.layout.nodes.find(n => n.key === state.selectedKey && n.id === state.selected) ?? state.layout.nodes.find(n => n.id === state.selected);
  const p = state.data.people[state.selected], name = firstName(state.data.people[state.center]);
  if (n?.role === 'sibling') return `${p.sex === 'F' ? 'Sœur' : p.sex === 'M' ? 'Frère' : 'Membre de la fratrie'} de ${name}`;
  if (n?.generation <= -2) {
    const generation = -n.generation;
    const label = generation === 2 ? 'Grand-parent' : generation === 3 ? 'Arrière-grand-parent' : `Ancêtre à ${generation} générations`;
    return `${label} de ${name}`;
  }
  return relationship(state.data, state.center, state.selected);
}

function renderProfile() {
  const p = state.data.people[state.selected];
  const family = familyView(state.data, p.id, 'all', p.id === state.center ? state : {});
  const personalEvents = p.events ?? [];
  const events = [...personalEvents];
  if (!events.some(e => e.tag === 'BIRT')) events.unshift({ tag: 'BIRT', date: '', place: '' });
  for (const union of family.unions) {
    for (const e of union.events ?? []) events.push({ ...e, context: `Avec ${familyName(union, p.id)}` });
  }
  events.sort((a, b) => ({ BIRT: -1, DEAT: 1 }[a.tag] || 0) - ({ BIRT: -1, DEAT: 1 }[b.tag] || 0));
  const citations = [...(p.sources ?? []), ...events.flatMap(e => e.sources ?? [])];
  const notes = [...(p.notes ?? [])];
  const mediaCount = mediaFor(p).length;
  const occupation = personalEvents.filter(e => e.tag === 'OCCU').map(e => e.value).filter(Boolean).join(', ');
  const summary = [occupation ? `Profession renseignée : ${occupation}.` : '', p.birth.place ? `Lieu de naissance : ${p.birth.place}.` : '', p.death.place ? `Lieu de décès : ${p.death.place}.` : ''].filter(Boolean).join(' ');
  panel.innerHTML = `<div class="profile-header">
    <button type="button" class="icon-button profile-close" data-close-profile aria-label="Fermer la fiche">×</button>
    <div class="profile-identification"><div class="profile-avatar" aria-hidden="true">${photoMarkup(p, 'profile-photo')}</div><div><h2 class="portrait-name" tabindex="-1">${escape(p.firstName)}<span>${escape(p.surname)}</span></h2><p class="portrait-years">${escape(lifeSpan(p))}</p></div></div>
    <p class="relationship">${escape(selectedRelationship())}</p>
    <div class="profile-actions">${state.view === 'portrait' ? '<button type="button" class="outline-button" data-view="tree">← Revenir à l’arbre</button>' : '<button type="button" class="outline-button" data-view="portrait">Lire le portrait</button>'}<button type="button" class="outline-button" data-explore="${escape(p.id)}">Explorer sa famille ${navigateIcon}</button></div>
    ${profileTools(p)}
  </div>
  <details class="profile-section" open><summary>Événements</summary><ol class="timeline" aria-label="Événements de cette vie">${events.map(e => eventMarkup(e.type || EVENT_LABELS[e.tag] || 'Événement', e, [e.value === 'Y' ? '' : e.value, e.context].filter(Boolean).join(' · '))).join('')}</ol></details>
  ${summary ? `<details class="profile-section" ${state.view === 'portrait' ? 'open' : ''}><summary>Repères de vie</summary><p class="portrait-story">${escape(summary)}</p></details>` : ''}
  <details class="profile-section" open><summary>Famille immédiate</summary>${family.parentalFamilies.length ? family.parentalFamilies.map(f => { const qualifier = pedigreeLabel(p.parentLinks?.find(link => link.familyId === f.id)?.pedigree); return relativeList(qualifier ? `Parents · ${escape(qualifier)}` : 'Parents', f.parents); }).join('') : relativeList('Parents', p.parents)}${relativeList('Frères et sœurs de la même famille', family.siblings)}${family.unions.map(union => `<div class="union-group"><p class="relative-heading">Famille avec ${escape(familyName(union, p.id))}</p>${relativeList('Conjoint·e / autre parent', union.parents.filter(id => id !== p.id))}${relativeList(countLabel(union.children.length, 'enfant'), union.children)}${union.parents.find(id => id !== p.id && state.data.people[id]) ? `<button type="button" class="outline-button family-open" data-explore="${escape(union.parents.find(id => id !== p.id && state.data.people[id]))}">Explorer cette branche</button>` : ''}</div>`).join('')}${!p.parents.length && !family.unions.length ? '<p class="portrait-story">Aucun proche rattaché dans ce fichier.</p>' : ''}</details>
  ${notes.length ? `<details class="profile-section"><summary>Notes du fichier · ${notes.length}</summary>${notes.map(note => `<p class="imported-text">${escape(note)}</p>`).join('')}</details>` : ''}
  ${citations.length ? `<details class="profile-section"><summary>Sources des événements et de la personne</summary><ul class="source-list">${sourceMarkup(citations)}</ul></details>` : ''}
  ${p.relationshipWarnings?.length ? '<p class="source-note">Un lien familial figure dans la fiche de cette personne, mais pas dans l’enregistrement réciproque de la famille. Il est conservé tel que déclaré dans votre export.</p>' : ''}
  ${mediaMarkup(p)}
  <p class="source-note">Export du ${escape(formatDate(state.data.meta.sourceExport))}.<br>Identifiant : ${escape(p.id)}.${mediaCount ? `<br>${countLabel(mediaCount, 'photographie référencée', 'photographies référencées')}` : ''}</p>`;
  $('#mobile-name').textContent = displayName(p);
  $('#mobile-avatar').textContent = monogram(p);
  panel.scrollTop = 0;
}

function renderFamilyChoices() {
  const layout = state.layout;
  const p = state.data.people[state.center];
  const parentPicker = layout.parentalFamilies.length > 1 ? `<label>Parents affichés<select id="parent-choice" aria-label="Choisir une famille parentale">${layout.parentalFamilies.map(f => { const pedigree = p.parentLinks?.find(l => l.familyId === f.id)?.pedigree; return `<option value="${escape(f.id)}" ${f.id === layout.parentFamilyId ? 'selected' : ''}>${escape(f.parents.map(id => state.data.people[id]?.name).join(' et '))}${pedigree ? ` · ${escape(pedigreeLabel(pedigree))}` : ''}</option>`; }).join('')}</select></label>` : '';
  const depthPicker = `<label class="depth-choice">Ancêtres<select id="depth-choice" aria-label="Nombre de générations d’ancêtres" title="1 : parents · 2 : grands-parents · 3 : arrière-grands-parents">${[1, 2, 3, 4, 5].map(depth => `<option value="${depth}" ${depth === state.ancestorDepth ? 'selected' : ''}>${depth} génération${depth > 1 ? 's' : ''}</option>`).join('')}</select></label>`;
  const siblingsPicker = `<label class="siblings-choice" title="Frères et sœurs de la famille parentale choisie"><input id="siblings-choice" type="checkbox" aria-label="Afficher les frères et sœurs" ${state.showSiblings ? 'checked' : ''} ${state.scope === 'parents' ? 'disabled' : ''}>Fratrie</label>`;
  $('#family-choices').innerHTML = parentPicker + depthPicker + siblingsPicker;
  $('#family-choices').hidden = false;
}

function drawTree() {
  state.layout = layoutFamily(state.data, state.center, state.scope, state);
  const layout = state.layout;
  state.parentFamilyId = layout.parentFamilyId;
  renderFamilyChoices();
  $('#tree-stage').style.width = `${layout.width}px`;
  $('#tree-stage').style.height = `${layout.height}px`;
  $('#tree-stage').innerHTML = `<svg class="tree-lines" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">${layout.paths.map(d => `<path d="${d}"/>`).join('')}</svg>${layout.nodes.map(n => {
    const p = state.data.people[n.id];
    return `<div class="node-wrap" data-generation="${n.generation}" data-role="${n.role}" data-union="${escape(n.unionId ?? '')}" style="left:${n.x - CARD.width / 2}px;top:${n.y}px"><button type="button" class="person-card" data-person="${escape(p.id)}" data-occurrence="${escape(n.key)}" data-sex="${escape(p.sex)}" aria-pressed="${p.id === state.selected}" aria-label="${escape(displayName(p))}, ${escape(lifeSpan(p))}${n.repeated ? ", présent sur plusieurs branches" : ""}">${photoMarkup(p)}<span class="person-info"><span class="person-first">${escape(p.firstName)}</span><span class="person-surname">${escape(p.surname)}</span><span class="person-years">${escape(lifeSpan(p))}</span></span></button>${n.repeated ? '<span class="repeat-marker" title="Même personne présente sur plusieurs branches">↗↗</span>' : ''}${n.id === state.center ? '<span class="center-marker" aria-hidden="true"></span>' : n.hiddenParentIds.length ? `<button type="button" class="branch-toggle" data-explore="${escape(p.id)}" data-parent-family="${escape(n.branchParentFamilyId)}" aria-label="Afficher la branche familiale de ${escape(displayName(p))}" title="Découvrir l’ascendance non déployée de ${escape(displayName(p))}">${branchIcon}</button>` : ''}</div>`;
  }).join('')}${layout.unionLabels.map(label => {
    const names = label.parentIds.map(id => displayName(state.data.people[id]));
    const shortNames = label.parentIds.map(id => firstName(state.data.people[id]));
    if (label.unknownParent) { names.push('autre parent non renseigné'); shortNames.push('parent non renseigné'); }
    return `<span class="union-caption" data-union="${escape(label.familyId)}" style="left:${label.x - CARD.width / 2}px;top:${label.y}px" title="${escape(names.join(' et '))} · ${countLabel(label.childCount, 'enfant renseigné', 'enfants renseignés')}">${escape(shortNames.join(' & '))}</span>`;
  }).join('')}`;
  $('#visible-count').textContent = `${layout.visibleIds.length} sur ${state.data.meta.fullCount.toLocaleString('fr')}`;
  $('#visible-count').title = `${layout.visibleIds.length} personnes distinctes · ${layout.nodes.length} cartes`;
  $('#branch-title').textContent = `Autour de ${firstName(state.data.people[state.center])}`;
  const pedigree = pedigreeLabel(state.data.people[state.center].parentLinks?.find(link => link.familyId === layout.parentFamilyId)?.pedigree);
  $('#sample-hint').textContent = `${pedigree ? `Filiation : ${pedigree} · ` : ''}${state.ancestorDepth} génération${state.ancestorDepth > 1 ? 's' : ''} d’ancêtres${state.scope === 'parents' ? '' : ' · Enfants : 1 génération'}${layout.warnings.cycles ? ' · Lien cyclique interrompu' : ''}${layout.warnings.alternativeParents ? ' · Certains ancêtres ont plusieurs filiations : ouvrir leur branche pour choisir' : ''}`;
  updateZoom();
}

function applyView() {
  document.body.dataset.view = state.view;
  document.body.dataset.panel = state.panel ? 'open' : 'closed';
  $('#toggle-panel').setAttribute('aria-expanded', String(state.panel));
  $('#toggle-panel').setAttribute('aria-label', state.panel ? 'Masquer la fiche' : 'Afficher la fiche');
  document.querySelectorAll('.view-nav [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  document.querySelectorAll('[data-scope]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scope === state.scope)));
  $('#go-back').disabled = !state.history.length;
}

function render({ center = false } = {}) {
  applyView();
  drawTree();
  renderProfile();
  rememberNavigation(state);
  if (center) requestAnimationFrame(frameTree);
}

function availableHeight() {
  let height = viewport.clientHeight;
  if (isMobile()) height -= state.panel ? panel.clientHeight : 65;
  return Math.max(60, height);
}

function centerOnSelection(includePartner = false) {
  if (!state.layout || state.view !== 'tree' || !viewport.clientWidth) return;
  const node = state.layout.nodes.find(n => n.key === state.selectedKey && n.id === state.selected) ?? state.layout.nodes.find(n => n.id === state.selected);
  if (!node) return;
  const couple = state.layout.nodes.filter(n => n.role === 'center' || n.role === 'partner');
  const coupleWidth = Math.max(...couple.map(n => n.x)) - Math.min(...couple.map(n => n.x)) + CARD.width;
  const coupleFits = coupleWidth * state.zoom + 48 <= viewport.clientWidth;
  const x = includePartner && state.selected === state.center && coupleFits ? state.layout.mid : node.x;
  viewport.scrollLeft = Math.max(0, x * state.zoom);
  viewport.scrollTop = Math.max(0, (node.y + CARD.height / 2) * state.zoom + viewport.clientHeight / 2 - availableHeight() / 2);
}

function updateZoom() {
  const layout = state.layout;
  if (!layout) return;
  $('#tree-sizer').style.width = `${layout.width * state.zoom + viewport.clientWidth}px`;
  $('#tree-sizer').style.height = `${layout.height * state.zoom + viewport.clientHeight}px`;
  $('#tree-stage').style.left = `${viewport.clientWidth / 2}px`;
  $('#tree-stage').style.top = `${viewport.clientHeight / 2}px`;
  $('#tree-stage').style.transform = `scale(${state.zoom})`;
  $('#zoom-reset').textContent = `${Math.round(state.zoom * 100)} %`;
  $('#zoom-out').disabled = state.zoom <= MIN_ZOOM;
  $('#zoom-in').disabled = state.zoom >= 1.6;
}

function zoomTo(value) {
  state.framing = 'selection';
  const previous = state.zoom;
  const left = viewport.scrollLeft, top = viewport.scrollTop;
  state.zoom = Math.max(MIN_ZOOM, Math.min(1.6, value));
  updateZoom();
  viewport.scrollLeft = zoomScroll(left, viewport.clientWidth, previous, state.zoom, viewport.clientWidth / 2);
  viewport.scrollTop = zoomScroll(top, viewport.clientHeight, previous, state.zoom, viewport.clientHeight / 2);
}

function fitTree() {
  if (!state.layout || state.view !== 'tree' || !viewport.clientWidth) return;
  const bounds = state.layout.bounds;
  state.zoom = fitZoom(bounds, viewport.clientWidth, availableHeight());
  updateZoom();
  viewport.scrollLeft = Math.max(0, (bounds.left + bounds.right) / 2 * state.zoom);
  viewport.scrollTop = Math.max(0, (bounds.top + bounds.bottom) / 2 * state.zoom + viewport.clientHeight / 2 - availableHeight() / 2);
}

function frameTree() {
  if (isMobile() && state.panel) { state.framing = 'selection'; state.zoom = Math.max(.85, state.zoom); }
  updateZoom();
  if (state.framing === 'overview') fitTree();
  else centerOnSelection(true);
}

function togglePanel(open = !state.panel) {
  state.panel = open;
  applyView();
  requestAnimationFrame(frameTree);
  if (!open) $('#toggle-panel').focus({ preventScroll: true });
  else if (isMobile()) $('.portrait-name').focus({ preventScroll: true });
}

function recenter(personId, parentFamilyId = '') {
  if (!state.data.people[personId]) return;
  if (state.center !== personId || (parentFamilyId && state.parentFamilyId !== parentFamilyId)) state.history.push({ center: state.center, selected: state.selected, scope: state.scope, zoom: state.zoom, parentFamilyId: state.parentFamilyId, ancestorDepth: state.ancestorDepth, showSiblings: state.showSiblings, framing: state.framing, selectedKey: state.selectedKey });
  // An overview of a very large family should not make the next family unreadable.
  if (state.zoom < .3) state.zoom = isMobile() ? .9 : 1;
  Object.assign(state, { center: personId, selected: personId, scope: 'all', view: 'tree', parentFamilyId, selectedKey: '', framing: isMobile() ? 'selection' : 'overview' });
  if (isMobile()) state.panel = false;
  render({ center: true });
  viewport.focus({ preventScroll: true });
  announce(`Famille de ${displayName(state.data.people[personId])}`);
}

function selectPerson(personId, occurrence = '') {
  if (!state.data.people[personId]) return;
  if (!state.layout.visibleIds.includes(personId)) recenter(personId);
  state.selected = personId;
  state.selectedKey = occurrence;
  state.framing = 'selection';
  state.panel = true;
  render();
  announce(`Fiche de ${displayName(state.data.people[personId])}`);
  if (isMobile()) {
    state.zoom = Math.max(.85, state.zoom);
    updateZoom();
    requestAnimationFrame(() => centerOnSelection());
    $('.portrait-name').focus({ preventScroll: true });
  } else document.querySelector(`[data-person="${CSS.escape(personId)}"]`)?.focus({ preventScroll: true });
}

function renderSearch() {
  const result = queryIndex(state.searchIndex, $('#search-input').value, 0, state.searchLimit);
  $('#search-count').textContent = `${countLabel(result.total, 'personne trouvée', 'personnes trouvées')} · ${result.ids.length} affichées`;
  $('#search-results').innerHTML = result.ids.length ? result.ids.map(id => {
    const p = state.data.people[id];
    const context = [p.birth.place || p.death.place, p.id].filter(Boolean).join(' · ');
    return `<button type="button" class="search-result" data-result="${escape(p.id)}"><span class="mini-avatar" aria-hidden="true">${escape(monogram(p))}</span><span class="result-copy"><span class="result-name">${escape(displayName(p))}</span><span class="result-years">${escape(lifeSpan(p))}</span><span class="result-context">${escape(context)}</span></span><span class="result-arrow" aria-hidden="true">↗</span></button>`;
  }).join('') : '<p class="empty-search">Aucune personne trouvée.<br>Essayez un prénom, un nom, un lieu ou une année.</p>';
  $('#search-more').hidden = !result.hasMore;
}

function openSearch() {
  if (!state.data) return;
  $('#search-input').value = '';
  state.searchLimit = 60;
  renderSearch();
  dialog.showModal();
  $('#search-input').focus();
}

function changeView(view) {
  state.view = view;
  render({ center: view === 'tree' });
  if (view === 'portrait') { $('.portrait-name').focus({ preventScroll: true }); $('#main').scrollTop = 0; }
  else viewport.focus({ preventScroll: true });
  announce(view === 'portrait' ? 'Lecture du portrait' : 'Vue famille');
}

document.addEventListener('click', event => {
  const b = event.target.closest('button');
  if (!b || !state.data) return;
  if (b.dataset.person) selectPerson(b.dataset.person, b.dataset.occurrence);
  else if (b.dataset.relative) selectPerson(b.dataset.relative);
  else if (b.dataset.explore) recenter(b.dataset.explore, b.dataset.parentFamily);
  else if (b.dataset.view) changeView(b.dataset.view);
  else if (b.hasAttribute('data-close-profile')) togglePanel(false);
  else if (b.dataset.scope) {
    state.scope = b.dataset.scope;
    if (!layoutFamily(state.data, state.center, state.scope, state).visibleIds.includes(state.selected)) state.selected = state.center;
    state.framing = 'overview';
    if (isMobile()) state.panel = false;
    render({ center: true });
    announce(`${state.layout.visibleIds.length} personnes affichées`);
  } else if (b.dataset.result) {
    dialog.close();
    recenter(b.dataset.result);
    if (!isMobile()) togglePanel(true);
  }
});

$('#toggle-panel').addEventListener('click', () => togglePanel());
$('#open-mobile-profile').addEventListener('click', () => togglePanel(true));
$('#focus-person').addEventListener('click', () => { state.framing = 'selection'; centerOnSelection(); });
$('#go-home').addEventListener('click', () => recenter(state.data.meta.rootId));
$('#go-back').addEventListener('click', () => {
  const prior = state.history.pop();
  if (!prior) return;
  Object.assign(state, prior, { view: 'tree' });
  render({ center: true });
  announce(`Retour à la famille de ${firstName(state.data.people[state.center])}`);
});
$('#zoom-in').addEventListener('click', () => zoomTo(state.zoom + .1));
$('#zoom-out').addEventListener('click', () => zoomTo(state.zoom - .1));
$('#zoom-reset').addEventListener('click', () => { zoomTo(1); centerOnSelection(true); });
$('#fit-tree').addEventListener('click', () => { state.framing = 'overview'; fitTree(); });
$('#open-search').addEventListener('click', openSearch);
$('#close-search').addEventListener('click', () => dialog.close());
let searchTimer;
$('#search-input').addEventListener('input', () => {
  clearTimeout(searchTimer);
  state.searchLimit = 60;
  searchTimer = setTimeout(renderSearch, 100);
});
$('#search-more').addEventListener('click', () => { state.searchLimit += 60; renderSearch(); });
$('#family-choices').addEventListener('change', event => {
  if (event.target.id === 'parent-choice') state.parentFamilyId = event.target.value;
  if (event.target.id === 'depth-choice') state.ancestorDepth = Number(event.target.value);
  if (event.target.id === 'siblings-choice') state.showSiblings = event.target.checked;
  const control = event.target.id;
  state.selected = state.center;
  state.selectedKey = '';
  state.framing = 'overview';
  if (isMobile()) state.panel = false;
  render({ center: true });
  document.getElementById(control)?.focus({ preventScroll: true });
  announce(`${state.layout.visibleIds.length} personnes affichées, jusqu’à ${state.ancestorDepth} générations d’ancêtres`);
});
// Only dismiss when the click lands outside the dialog's actual rectangle.
// Clicking padding inside the search must not close it.
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !document.querySelector('dialog[open]') && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); openSearch(); }
  else if (event.key === 'Escape' && !document.querySelector('dialog[open]') && state.view === 'tree' && state.panel) togglePanel(false);
});

let drag = null;
viewport.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button')) return;
  drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add('dragging');
});
viewport.addEventListener('pointermove', event => {
  if (!drag) return;
  viewport.scrollLeft = drag.left - event.clientX + drag.x;
  viewport.scrollTop = drag.top - event.clientY + drag.y;
});
const endDrag = () => { drag = null; viewport.classList.remove('dragging'); };
viewport.addEventListener('pointerup', endDrag);
viewport.addEventListener('pointercancel', endDrag);
viewport.addEventListener('lostpointercapture', endDrag);

const cancelPinch = bindPinch(viewport,
  () => state.layout && state.view === 'tree' ? { zoom: state.zoom, left: viewport.scrollLeft, top: viewport.scrollTop } : null,
  frame => {
    state.framing = 'selection';
    state.zoom = frame.zoom; updateZoom();
    viewport.scrollLeft = frame.left; viewport.scrollTop = frame.top;
  });
let previousSize = '';
new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect;
  const size = `${Math.round(width)}:${Math.round(height)}`;
  if (!state.data || !width || size === previousSize) return;
  previousSize = size;
  cancelPinch();
  requestAnimationFrame(frameTree);
}).observe(viewport);

async function load() {
  const started = performance.now();
  $('#loading').hidden = false;
  $('#error').hidden = true;
  try {
    await initializeFamilyAccess();
    let response = await fetch('./data/tree.json', { cache: 'no-store' });
    while (familyMode && response.status === 401) {
      await requestFamilyCode('Votre accès a expiré. Saisissez à nouveau le code familial.');
      response = await fetch('./data/tree.json', { cache: 'no-store' });
    }
    if (!response.ok) throw new Error('Données locales indisponibles');
    const data = await response.json();
    if (!data.people?.[data.meta?.rootId]) throw new Error('Arbre invalide');
    state.data = data;
    state.searchIndex = buildSearchIndex(data.people);
    state.center = state.selected = data.meta.rootId;
    const saved = await initPersonal(data, personId => { recenter(personId); selectPerson(personId); });
    if (saved && data.people[saved.center]) {
      state.center = saved.center;
      state.selected = data.people[saved.selected] ? saved.selected : saved.center;
      state.ancestorDepth = [1, 2, 3, 4, 5].includes(saved.ancestorDepth) ? saved.ancestorDepth : 3;
      state.showSiblings = saved.showSiblings !== false;
      state.scope = saved.scope === 'parents' ? 'parents' : 'all';
      state.parentFamilyId = typeof saved.parentFamilyId === 'string' ? saved.parentFamilyId : '';
    }
    const homeName = firstName(data.people[data.meta.rootId]);
    $('#go-home').setAttribute('aria-label', `Revenir à la famille de ${homeName}`);
    $('.brand').setAttribute('aria-label', `Héritage, revenir à ${homeName}`);
    $('#workspace').hidden = false;
    render({ center: true });
    console.info('Héritage : arbre prêt ' + JSON.stringify({ people: data.meta.fullCount, milliseconds: Math.round(performance.now() - started) }));
  } catch (error) {
    $('#error').hidden = false;
    console.error('Ouverture de la maquette impossible :', error.message);
  } finally { $('#loading').hidden = true; }
}
$('#retry').addEventListener('click', load);
$('#lock-family').addEventListener('click', async () => {
  if (hasUnsavedNotes()) { $('#announcement').textContent = 'Enregistrez votre note avant de fermer l’accès familial.'; return; }
  $('#lock-family').disabled = true;
  try { await lockFamily(); } catch { $('#lock-family').disabled = false; $('#announcement').textContent = 'La fermeture n’a pas pu être terminée. Réessayez.'; }
});
load();
