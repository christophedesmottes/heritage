import { familyView, formatDate, lifeSpan, relationship, buildSearchIndex, queryIndex, buildKinshipGraph, findKinship, branchIds, layoutKinship, buildReview, filterReview, buildTimeline } from './lib/genealogy.js';
import { CARD, MIN_ZOOM, layoutFamily, fitZoom, zoomScroll, bindPinch, preserveTreeFrame } from './lib/tree-layout.js';
import { mediaFor, mediaSource, portraitFor } from './lib/media.js';
import { initPersonal, profileTools, rememberNavigation, hasUnsavedNotes } from './lib/personal-ui.js';
import { familyMode, initializeFamilyAccess, requestFamilyCode, lockFamily } from './lib/family-ui.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { data: null, center: '', selected: '', scope: 'all', view: 'tree', panel: innerWidth >= 760, zoom: innerWidth < 500 ? .9 : 1, history: [], layout: null, parentFamilyId: '', searchIndex: [], searchLimit: 60, ancestorDepth: 3, descendantDepth: 3, showSiblings: true, framing: innerWidth >= 760 ? 'overview' : 'selection', selectedKey: '' };
const viewport = $('#tree-viewport');
const panel = $('#portrait-panel');
const dialog = $('#search-dialog');
const kinshipDialog = $('#kinship-dialog');
let reviewFindings=null, reviewReference='', reviewLimit=60;
let kinshipGraph, kinshipFrom = '', kinshipTo = '', searchTarget = 'center', branchReference = '', branchQuery = '';
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

function chronologyMarkup(person) {
  const items=buildTimeline(state.data,person.id),dated=items.filter(item=>item.range),undated=items.filter(item=>!item.range);
  const rows=list=>list.map(item=>{
    const e=item.event,label=item.kind==='child'?'Naissance d’un enfant':e.type || EVENT_LABELS[e.tag] || 'Événement';
    const links=item.relatedIds.map(id=>`<button type="button" class="outline-button chronology-relative" data-relative="${escape(id)}">${escape(displayName(state.data.people[id]))}</button>`).join('');
    const photos=mediaFor({media:e.media || [],events:[]});
    const portrait=item.portraitId && portraitFor(state.data.people[item.portraitId]);
    const images=photos.length?`<div class="chronology-photos">${photos.map(photo=>`<figure><a href="${escape(mediaSource(photo))}" target="_blank" rel="noopener noreferrer"><img src="${escape(mediaSource(photo))}" alt="${escape(photo.title || 'Document rattaché à cet événement')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;this.closest('figure').querySelector('figcaption').textContent='Image indisponible'"></a><figcaption>${escape(photo.title || 'Document de l’événement')}</figcaption></figure>`).join('')}</div>`:'';
    const contextPhoto=portrait?`<figure class="chronology-portrait">${photoMarkup(state.data.people[item.portraitId])}<figcaption>Portrait de ${escape(displayName(state.data.people[item.portraitId]))} · date de la photo non attribuée à cette naissance</figcaption></figure>`:'';
    const body=eventMarkup(label,e,[e.value==='Y'?'':e.value,item.context].filter(Boolean).join(' · '));
    return body.replace('</li>',`${links}${images}${contextPhoto}${e.sources?.length?`<details class="chronology-sources"><summary>Sources de cet événement · ${e.sources.length}</summary><ul class="source-list">${sourceMarkup(e.sources)}</ul></details>`:''}</li>`);
  }).join('');
  return `<details class="profile-section chronology-section" open><summary>Chronologie · ${countLabel(items.length, 'événement')}</summary><p class="chronology-note">Ordre indicatif lorsque les dates sont approximatives ou se chevauchent. Les documents rattachés à un événement sont distingués des portraits généraux ; aucune date de prise de vue n’est déduite.</p>${dated.length?`<ol class="timeline life-timeline" aria-label="Chronologie datée">${rows(dated)}</ol>`:''}${undated.length?`<h3 class="chronology-undated">Date non précisée ou non classable</h3><ol class="timeline life-timeline" aria-label="Événements sans date classable">${rows(undated)}</ol>`:''}</details>`;
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
  const citations = [...(p.sources ?? []), ...events.flatMap(e => e.sources ?? []), ...family.unions.flatMap(f => f.sources ?? [])];
  const notes = [...(p.notes ?? [])];
  const mediaCount = mediaFor(p).length;
  const occupation = personalEvents.filter(e => e.tag === 'OCCU').map(e => e.value).filter(Boolean).join(', ');
  const summary = [occupation ? `Profession renseignée : ${occupation}.` : '', p.birth.place ? `Lieu de naissance : ${p.birth.place}.` : '', p.death.place ? `Lieu de décès : ${p.death.place}.` : ''].filter(Boolean).join(' ');
  panel.innerHTML = `<div class="profile-header">
    <button type="button" class="icon-button profile-close" data-close-profile aria-label="Fermer la fiche">×</button>
    <div class="profile-identification"><div class="profile-avatar" aria-hidden="true">${photoMarkup(p, 'profile-photo')}</div><div><h2 class="portrait-name" tabindex="-1">${escape(p.firstName)}<span>${escape(p.surname)}</span></h2><p class="portrait-years">${escape(lifeSpan(p))}</p></div></div>
    <p class="relationship">${escape(selectedRelationship())}</p>
    <div class="profile-actions">${state.view === 'portrait' ? '<button type="button" class="outline-button" data-view="tree">← Revenir à l’arbre</button>' : '<button type="button" class="outline-button" data-view="portrait">Lire le portrait</button>'}<button type="button" class="outline-button" data-explore="${escape(p.id)}">Explorer sa famille ${navigateIcon}</button></div>
    <button type="button" class="outline-button profile-kinship" data-kinship="${escape(p.id)}">Comparer son lien de parenté</button>
    ${profileTools(p)}
  </div>
  ${chronologyMarkup(p)}
  ${summary ? `<details class="profile-section" ${state.view === 'portrait' ? 'open' : ''}><summary>Repères de vie</summary><p class="portrait-story">${escape(summary)}</p></details>` : ''}
  <details class="profile-section" open><summary>Famille immédiate</summary>${family.parentalFamilies.length ? family.parentalFamilies.map(f => { const qualifier = pedigreeLabel(p.parentLinks?.find(link => link.familyId === f.id)?.pedigree); return relativeList(qualifier ? `Parents · ${escape(qualifier)}` : 'Parents', f.parents); }).join('') : relativeList('Parents', p.parents)}${relativeList('Frères et sœurs de la même famille', family.siblings)}${family.unions.map(union => `<div class="union-group"><p class="relative-heading">Famille avec ${escape(familyName(union, p.id))}</p>${relativeList('Conjoint·e / autre parent', union.parents.filter(id => id !== p.id))}${relativeList(countLabel(union.children.length, 'enfant'), union.children)}${union.parents.find(id => id !== p.id && state.data.people[id]) ? `<button type="button" class="outline-button family-open" data-explore="${escape(union.parents.find(id => id !== p.id && state.data.people[id]))}">Explorer cette branche</button>` : ''}</div>`).join('')}${!p.parents.length && !family.unions.length ? '<p class="portrait-story">Aucun proche rattaché dans ce fichier.</p>' : ''}</details>
  ${notes.length ? `<details class="profile-section"><summary>Notes du fichier · ${notes.length}</summary>${notes.map(note => `<p class="imported-text">${escape(note)}</p>`).join('')}</details>` : ''}
  ${citations.length ? `<details class="profile-section"><summary>Sources des événements, de la personne et des familles</summary><ul class="source-list">${sourceMarkup(citations)}</ul></details>` : ''}
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
  const siblingsPicker = `<label class="siblings-choice" title="Fratrie et conjoints de la personne centrale et de chaque ancêtre affiché"><input id="siblings-choice" type="checkbox" aria-label="Afficher les frères et sœurs" ${state.showSiblings ? 'checked' : ''} ${state.scope === 'parents' ? 'disabled' : ''}>Fratrie</label>`;
  const descendantsPicker = `<label class="depth-choice">Descendants<select id="descendant-choice" aria-label="Nombre de générations de descendants" ${state.scope === 'parents' ? 'disabled' : ''}>${[1,2,3,4,5].map(depth=>`<option value="${depth}" ${depth===state.descendantDepth?'selected':''}>${depth} génération${depth>1?'s':''}</option>`).join('')}</select></label>`;
  $('#family-choices').innerHTML = parentPicker + depthPicker + descendantsPicker + siblingsPicker;
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
  $('#sample-hint').textContent = `${pedigree ? `Filiation : ${pedigree} · ` : ''}${state.ancestorDepth} génération${state.ancestorDepth > 1 ? 's' : ''} d’ancêtres${state.scope === 'parents' ? '' : ` · Descendants : ${state.descendantDepth} génération${state.descendantDepth > 1 ? 's' : ''}`}${layout.warnings.cycles ? ' · Lien cyclique interrompu' : ''}${layout.warnings.alternativeParents ? ' · Certains ancêtres ont plusieurs filiations : ouvrir leur branche pour choisir' : ''}`;
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
  if (isMobile() && state.panel) state.framing = 'selection';
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
  if (state.center !== personId || (parentFamilyId && state.parentFamilyId !== parentFamilyId)) state.history.push({ center: state.center, selected: state.selected, scope: state.scope, zoom: state.zoom, parentFamilyId: state.parentFamilyId, ancestorDepth: state.ancestorDepth, descendantDepth: state.descendantDepth, showSiblings: state.showSiblings, framing: state.framing, selectedKey: state.selectedKey });
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
  const filters = {};
  $('#search-reference').textContent = `Référence : ${displayName(state.data.people[branchReference || state.center])}`;
  if (searchTarget === 'center') {
    for (const field of ['from', 'to']) {
      const input = $(`#search-${field}`);
      input.removeAttribute('aria-invalid');
      if (input.value !== '') {
        const year = Number(input.value);
        if (!input.validity.valid || !Number.isInteger(year) || year < 1 || year > 9999) {
          input.setAttribute('aria-invalid', 'true');
          $('#search-count').textContent = 'Saisissez une année entière entre 1 et 9999.';
          $('#search-results').replaceChildren(); $('#search-more').hidden = true; return;
        }
        filters[field] = year;
      }
    }
    if (filters.from > filters.to) {
      $('#search-count').textContent = 'L’année de début doit précéder ou égaler l’année de fin.';
      $('#search-results').replaceChildren(); $('#search-more').hidden = true; return;
    }
    filters.event = $('#search-event').value; filters.place = $('#search-place').value;
    if ($('#search-branch').value !== 'all') filters.ids = branchIds(kinshipGraph, branchReference || state.center, $('#search-branch').value);
  }
  const result = queryIndex(state.searchIndex, $('#search-input').value, 0, state.searchLimit, filters);
  const active = filters.from !== undefined || filters.to !== undefined || filters.place || filters.ids;
  $('#search-count').textContent = `${countLabel(result.total, 'personne trouvée', 'personnes trouvées')} · ${result.ids.length} affichée${result.ids.length === 1 ? '' : 's'}${active ? ' · filtres actifs' : ''}`;
  $('#search-results').innerHTML = result.ids.length ? result.ids.map(id => {
    const p = state.data.people[id];
    const context = [p.birth.place || p.death.place, p.id].filter(Boolean).join(' · ');
    return `<button type="button" class="search-result" data-result="${escape(p.id)}"><span class="mini-avatar" aria-hidden="true">${escape(monogram(p))}</span><span class="result-copy"><span class="result-name">${escape(displayName(p))}</span><span class="result-years">${escape(lifeSpan(p))}</span><span class="result-context">${escape(context)}</span></span><span class="result-arrow" aria-hidden="true">↗</span></button>`;
  }).join('') : '<p class="empty-search">Aucune personne trouvée.<br>Essayez un prénom, un nom, un lieu ou une année.</p>';
  $('#search-more').hidden = !result.hasMore;
}

function openSearch(target = 'center') {
  if (!state.data) return;
  searchTarget = target;
  $('#search-title').textContent = target === 'center' ? 'Rechercher une personne' : target === 'branch' ? 'Choisir la référence de la branche' : 'Choisir une personne à comparer';
  $('#search-filters').hidden = target !== 'center';
  $('#search-input').value = '';
  state.searchLimit = 60;
  renderSearch();
  dialog.showModal();
  $('#search-input').focus();
}

let kinshipCancel = () => {};
function kinshipChart(result) {
  const layout = layoutKinship(state.data, result, kinshipGraph);
  const lookup = new Map(layout.nodes.map(n => [n.id, n]));
  const word = (kind, person) => {
    const sex = person.sex;
    return kind === 'parent' ? (sex === 'F' ? 'Mère' : sex === 'M' ? 'Père' : 'Parent')
      : kind === 'child' ? (sex === 'F' ? 'Fille' : sex === 'M' ? 'Fils' : 'Enfant')
      : kind === 'sibling' ? (sex === 'F' ? 'Sœur / demi-sœur' : sex === 'M' ? 'Frère / demi-frère' : 'Fratrie') : 'Conjoint·e / autre parent';
  };
  const lines = layout.edges.map(edge => {
    const a = lookup.get(edge.from), b = lookup.get(edge.to), horizontal = a.y === b.y;
    const x1 = horizontal ? a.x + 190 : a.x + 95, y1 = horizontal ? a.y + 70 : a.y + (b.y > a.y ? 140 : 0);
    const x2 = horizontal ? b.x : b.x + 95, y2 = horizontal ? b.y + 70 : b.y + (b.y > a.y ? 0 : 140);
    const middle = (y1 + y2) / 2;
    const d = horizontal ? `M${x1},${y1}H${x2}` : `M${x1},${y1}V${middle}H${x2}V${y2}`;
    const label = word(edge.kind, state.data.people[b.id]) + (edge.pedigree.length ? ` · ${edge.pedigree.map(pedigreeLabel).join(', ')}` : '');
    return `<path class="${edge.kind === 'context' ? 'kin-context-line' : 'kin-route-line'}" d="${d}" ${edge.kind !== 'context' ? 'marker-end="url(#kin-arrow)"' : ''}/>${edge.kind !== 'context' ? `<text x="${horizontal ? (x1 + x2) / 2 : x1}" y="${horizontal ? y1 - 13 : middle - 8}" text-anchor="middle">${escape(label)}</text>` : ''}`;
  }).join('');
  return `<section class="kin-chart" aria-label="Arbre simplifié du lien de parenté"><div class="kin-chart-tools"><strong>Arbre du lien de parenté</strong><button type="button" data-kin-zoom="out" aria-label="Dézoomer le graphique">−</button><output id="kin-chart-zoom">100 %</output><button type="button" data-kin-zoom="in" aria-label="Zoomer le graphique">+</button><button type="button" data-kin-zoom="fit">Tout voir</button></div><p class="kin-chart-help">Chemin en couleur · parents communs en gris. Molette ou pincement pour zoomer ; glissez pour déplacer.</p><div class="kin-chart-viewport" tabindex="0" aria-label="Graphique défilant, utilisez aussi les touches fléchées"><div class="kin-chart-space"><div class="kin-chart-canvas" style="width:${layout.width}px;height:${layout.height}px"><svg width="${layout.width}" height="${layout.height}" aria-hidden="true"><defs><marker id="kin-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>${lines}</svg>${layout.nodes.map(n => {
    const person = state.data.people[n.id], endpoint = n.id === result.path[0] || n.id === result.path.at(-1);
    return `<button type="button" class="kin-chart-person ${n.context ? 'kin-context-person' : ''} ${endpoint ? 'kin-endpoint' : ''}" data-chart-person="${escape(n.id)}" style="left:${n.x}px;top:${n.y}px" aria-label="Explorer ${escape(displayName(person))}">${photoMarkup(person)}<span class="kin-chart-name">${escape(displayName(person))}</span><span class="result-years">${escape(lifeSpan(person))}</span>${endpoint ? `<span class="kin-endpoint-label">${n.id === result.path[0] ? 'Départ' : 'Arrivée'}</span>` : ''}</button>`;
  }).join('')}</div></div></div></section>`;
}
function bindKinshipChart() {
  const view = $('.kin-chart-viewport'); if (!view) return;
  const canvas = $('.kin-chart-canvas'), space = $('.kin-chart-space');
  const width = parseFloat(canvas.style.width), height = parseFloat(canvas.style.height);
  let zoom = 1, drag = null, moved = false;
  const apply = value => {
    zoom = Math.max(.03, Math.min(1.6, value));
    canvas.style.transform = `scale(${zoom})`; space.style.width = `${width * zoom}px`; space.style.height = `${height * zoom}px`;
    $('#kin-chart-zoom').textContent = `${Math.round(zoom * 100)} %`;
  };
  const scale = (value, x = view.clientWidth / 2, y = view.clientHeight / 2) => {
    const left = (view.scrollLeft + x) / zoom, top = (view.scrollTop + y) / zoom;
    apply(value); view.scrollLeft = left * zoom - x; view.scrollTop = top * zoom - y;
  };
  const fit = () => { apply(Math.min(1, view.clientWidth / width, view.clientHeight / height)); view.scrollLeft = view.scrollTop = 0; };
  $('.kin-chart-tools').addEventListener('click', event => {
    const action = event.target.closest('[data-kin-zoom]')?.dataset.kinZoom;
    if (action === 'fit') fit(); else if (action) scale(zoom * (action === 'in' ? 1.2 : 1 / 1.2));
  });
  view.addEventListener('wheel', event => { event.preventDefault(); const r = view.getBoundingClientRect(); scale(zoom * Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .002), event.clientX - r.left, event.clientY - r.top); }, { passive: false });
  view.addEventListener('pointerdown', event => {
    moved = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    event.preventDefault(); // Pan the canvas without starting native text/image selection.
    (event.target.closest('button') || view).focus({ preventScroll: true });
    drag = { x: event.clientX, y: event.clientY, left: view.scrollLeft, top: view.scrollTop, id: event.pointerId };
  });
  view.addEventListener('dragstart', event => event.preventDefault());
  view.addEventListener('pointermove', event => {
    if (!drag) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) { moved = true; view.setPointerCapture(drag.id); }
    if (moved) { view.scrollLeft = drag.left + drag.x - event.clientX; view.scrollTop = drag.top + drag.y - event.clientY; }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) view.addEventListener(type, () => { drag = null; });
  view.addEventListener('click', event => { if (moved) { event.preventDefault(); event.stopImmediatePropagation(); moved = false; } }, true);
  kinshipCancel = bindPinch(view, () => ({ zoom, left: view.scrollLeft + view.clientWidth / 2, top: view.scrollTop + view.clientHeight / 2 }), frame => { apply(frame.zoom); view.scrollLeft = frame.left - view.clientWidth / 2; view.scrollTop = frame.top - view.clientHeight / 2; }, { min: .03 });
  requestAnimationFrame(() => {
    // Open at a readable scale near the departure; overview remains a deliberate action.
    apply(.85);
    const departure = canvas.querySelector('[data-chart-person="' + CSS.escape(kinshipFrom) + '"]');
    view.scrollLeft = parseFloat(departure.style.left) * zoom - view.clientWidth / 2 + 95 * zoom;
    view.scrollTop = parseFloat(departure.style.top) * zoom - view.clientHeight + 170 * zoom;
  });
}
function renderKinship() {
  kinshipCancel();
  $('#kinship-from').textContent = displayName(state.data.people[kinshipFrom]);
  $('#kinship-to').textContent = kinshipTo ? displayName(state.data.people[kinshipTo]) : 'Choisir une personne';
  if (!kinshipTo) { $('#kinship-result').textContent = 'Choisissez la seconde personne pour découvrir le lien.'; return; }
  const result = findKinship(state.data, kinshipFrom, kinshipTo, kinshipGraph);
  const edgeLabel = edge => ({ parent: 'Parent', child: 'Enfant', partner: 'Conjoint·e / autre parent' }[edge.kind])
    + (edge.pedigree.length ? ` · ${edge.pedigree.map(pedigreeLabel).join(', ')}` : '');
  const explanation = !result.generations ? '' : result.generations.every(n => n > 0)
    ? `Ancêtre commun retenu : ${escape(displayName(state.data.people[result.ancestor]))}.<br>${result.generations[0]} génération(s) depuis le départ · ${result.generations[1]} depuis la personne comparée.`
    : `${Math.max(...result.generations)} génération(s) de filiation séparent ces deux personnes.`;
  $('#kinship-result').innerHTML = `<h3>${escape(result.label)}</h3><p>${escape(displayName(state.data.people[kinshipTo]))} par rapport à ${escape(displayName(state.data.people[kinshipFrom]))}.</p>${explanation ? `<p>${explanation}</p>` : ''}${result.path.length ? `${kinshipChart(result)}<details class="kinship-detail"><summary>Détail du chemin, étape par étape</summary><ol class="kinship-path">${result.path.map((id, i) => `<li>${i ? `<p class="kinship-step">${result.steps[i - 1].kind === 'parent' ? '↑' : result.steps[i - 1].kind === 'child' ? '↓' : '↔'} ${escape(edgeLabel(result.steps[i - 1]))} de la personne précédente</p>` : ''}<button type="button" class="search-result" data-path-person="${escape(id)}"><span class="mini-avatar" aria-hidden="true">${escape(monogram(state.data.people[id]))}</span><span class="result-copy"><span class="result-name">${escape(displayName(state.data.people[id]))}</span><span class="result-years">${escape(lifeSpan(state.data.people[id]))}</span></span><span aria-hidden="true">↗</span></button></li>`).join('')}</ol></details>` : ''}`;
  bindKinshipChart();
}

function openKinship(personId = state.selected) {
  if (!state.data) return;
  kinshipFrom = state.center;
  kinshipTo = personId !== kinshipFrom ? personId : '';
  renderKinship(); kinshipDialog.showModal();
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
    if (searchTarget === 'branch') {
      branchReference = b.dataset.result; openSearch(); $('#search-input').value = branchQuery; renderSearch(); return;
    }
    if (searchTarget !== 'center') {
      if (searchTarget === 'from') kinshipFrom = b.dataset.result; else kinshipTo = b.dataset.result;
      renderKinship(); kinshipDialog.showModal(); return;
    }
    recenter(b.dataset.result);
    if (!isMobile()) togglePanel(true);
  } else if (b.dataset.kinship) {
    openKinship(b.dataset.kinship);
  } else if (b.dataset.pathPerson || b.dataset.chartPerson) {
    kinshipDialog.close(); recenter(b.dataset.pathPerson || b.dataset.chartPerson); if (!isMobile()) togglePanel(true);
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
viewport.addEventListener('wheel', event => {
  if (!state.layout || state.view !== 'tree' || !event.cancelable) return;
  event.preventDefault();
  const rect = viewport.getBoundingClientRect();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
  const delta = Math.max(-100, Math.min(100, event.deltaY * unit));
  const previous = state.zoom, left = viewport.scrollLeft, top = viewport.scrollTop;
  zoomTo(state.zoom * Math.exp(-delta * .002));
  viewport.scrollLeft = Math.max(0, (left + x - viewport.clientWidth / 2) / previous * state.zoom + viewport.clientWidth / 2 - x);
  viewport.scrollTop = Math.max(0, (top + y - viewport.clientHeight / 2) / previous * state.zoom + viewport.clientHeight / 2 - y);
}, { passive: false });
$('#zoom-in').addEventListener('click', () => zoomTo(state.zoom + .1));
$('#zoom-out').addEventListener('click', () => zoomTo(state.zoom - .1));
$('#zoom-reset').addEventListener('click', () => { zoomTo(1); centerOnSelection(true); });
$('#fit-tree').addEventListener('click', () => { state.framing = 'overview'; fitTree(); });
$('#open-search').addEventListener('click', () => openSearch());
function renderReview() {
  const category=$('#review-category').value, scope=$('#review-branch').value;
  const ids=scope ? branchIds(kinshipGraph,reviewReference,scope) : null;
  const list=filterReview(reviewFindings,state.data.people,{category,query:$('#review-query').value,ids});
  const names={dates:'Dates à vérifier',missing:'Informations manquantes',duplicates:'Doublons possibles',sources:'Citations de sources'};
  const counts=Object.keys(names).map(key=>`${names[key]} : ${reviewFindings.filter(item=>item.category===key).length}`).join(' · ');
  $('#review-reference').textContent='Référence des branches : '+displayName(state.data.people[reviewReference])+'. Les branches incluent cette personne.';
  $('#review-count').textContent=`${list.length} signalement(s) correspondant aux filtres · ${Math.min(reviewLimit,list.length)} affiché(s). Dans tout l’export : ${counts}`;
  $('#review-results').innerHTML=list.length ? list.slice(0,reviewLimit).map(item=>`<article class="review-item"><p class="eyebrow">${names[item.category]}</p><h3>${escape(item.title)}</h3><p>${escape(item.detail)}</p><div class="review-people">${item.ids.slice(0,20).map(id=>{const person=state.data.people[id];return `<button type="button" class="outline-button" data-review-person="${escape(id)}">${escape(displayName(person))} · ${escape(lifeSpan(person))}</button>`;}).join('')}</div>${item.ids.length>20?`<p>Groupe de ${item.ids.length} fiches : les 20 premières sont proposées ici. Retrouvez les autres avec la recherche par nom.</p>`:''}</article>`).join('') : '<p>Aucun signalement ne correspond à ces filtres. Cela ne constitue pas une validation complète de l’arbre.</p>';
  $('#review-more').hidden=list.length<=reviewLimit;
}
$('#open-review').addEventListener('click',()=>{
  if (!state.data) return;
  reviewFindings ??= buildReview(state.data); reviewReference=state.selected || state.center; reviewLimit=60;
  renderReview(); $('#review-dialog').showModal();
});
$('#close-review').addEventListener('click',()=>$('#review-dialog').close());
for (const id of ['review-category','review-query','review-branch']) $('#'+id).addEventListener(id==='review-query'?'input':'change',()=>{reviewLimit=60;renderReview();});
$('#review-more').addEventListener('click',()=>{reviewLimit+=60;renderReview();});
$('#review-results').addEventListener('click',event=>{
  const button=event.target.closest('[data-review-person]'); if(!button) return;
  $('#review-dialog').close(); recenter(button.dataset.reviewPerson); selectPerson(button.dataset.reviewPerson);
});

$('#open-kinship').addEventListener('click', () => openKinship());
$('#close-kinship').addEventListener('click', () => kinshipDialog.close());
for (const target of ['from', 'to']) $(`#kinship-${target}`).addEventListener('click', () => { kinshipDialog.close(); openSearch(target); });
$('#kinship-swap').addEventListener('click', () => { if (!kinshipTo) return; [kinshipFrom, kinshipTo] = [kinshipTo, kinshipFrom]; renderKinship(); });
dialog.addEventListener('close', () => {
  if (searchTarget === 'from' || searchTarget === 'to') {
    // Cancel/Escape returns to the comparison; selecting a result opens it synchronously.
    if (!kinshipDialog.open) { renderKinship(); kinshipDialog.showModal(); }
  }
});
$('#search-reference').addEventListener('click', () => { branchQuery = $('#search-input').value; dialog.close(); openSearch('branch'); });
$('#search-reset').addEventListener('click', () => {
  for (const field of ['from', 'to', 'place']) $(`#search-${field}`).value = '';
  $('#search-event').value = 'birth'; $('#search-branch').value = 'all'; branchReference = '';
  state.searchLimit = 60; renderSearch();
});
for (const field of ['from', 'to', 'place', 'event', 'branch']) $(`#search-${field}`).addEventListener('input', () => { state.searchLimit = 60; renderSearch(); });
$('#close-search').addEventListener('click', () => dialog.close());
let searchTimer;
$('#search-input').addEventListener('input', () => {
  clearTimeout(searchTimer);
  state.searchLimit = 60;
  searchTimer = setTimeout(renderSearch, 100);
});
$('#search-more').addEventListener('click', () => { state.searchLimit += 60; renderSearch(); });
$('#family-choices').addEventListener('change', event => {
  const control = event.target.id;
  const preserveFrame = ['depth-choice', 'descendant-choice', 'siblings-choice'].includes(control);
  const previousLayout = state.layout;
  const previousFrame = { zoom: state.zoom, left: viewport.scrollLeft, top: viewport.scrollTop };
  if (event.target.id === 'parent-choice') state.parentFamilyId = event.target.value;
  if (event.target.id === 'depth-choice') state.ancestorDepth = Number(event.target.value);
  if (event.target.id === 'descendant-choice') state.descendantDepth = Number(event.target.value);
  if (event.target.id === 'siblings-choice') state.showSiblings = event.target.checked;
  if (preserveFrame) {
    state.framing = 'selection';
    render();
    const frame = preserveTreeFrame(previousLayout, state.layout, previousFrame);
    viewport.scrollLeft = frame.left;
    viewport.scrollTop = frame.top;
  } else {
    state.selected = state.center;
    state.selectedKey = '';
    state.framing = 'overview';
    if (isMobile()) state.panel = false;
    render({ center: true });
  }
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
  requestAnimationFrame(() => {
    if (state.framing === 'overview') { frameTree(); return; }
    // Safari's controls and native selectors can resize the canvas. A manual
    // view keeps its zoom and scene center instead of framing the selection.
    const left = viewport.scrollLeft, top = viewport.scrollTop;
    updateZoom();
    viewport.scrollLeft = left;
    viewport.scrollTop = top;
  });
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
    reviewFindings = null; $('#open-review').disabled = false;
    kinshipGraph = buildKinshipGraph(data);
    state.searchIndex = buildSearchIndex(data.people);
    state.center = state.selected = data.meta.rootId;
    const saved = await initPersonal(data, personId => { recenter(personId); selectPerson(personId); });
    if (saved && data.people[saved.center]) {
      state.center = saved.center;
      state.selected = data.people[saved.selected] ? saved.selected : saved.center;
      state.ancestorDepth = [1, 2, 3, 4, 5].includes(saved.ancestorDepth) ? saved.ancestorDepth : 3;
      state.descendantDepth = [1,2,3,4,5].includes(saved.descendantDepth) ? saved.descendantDepth : 3;
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
