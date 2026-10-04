import { MAP_TAGS, makeGazetteer, collectMapEvents, groupPlaces, filterMapEvents, mapRoutes, validPlaceChoices, placeText } from './places.js';
import { buildKinshipGraph, branchIds, formatDate } from './genealogy.js';
import { runtime } from '../runtime-config.js';
import { familyMode, personalSyncSession, requestFamilyCode } from './family-ui.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const statusName = { matched:'Rapproché', confirmed:'Confirmé', review:'À confirmer', unknown:'Non trouvé', broad:'Trop imprécis', excluded:'Écarté', missing:'Sans lieu' };

export function initMap({ getData, getReference, navigate, storageKey } = {}) {
  const $ = id => document.getElementById(id), dialog = $('map-dialog'), svg = $('family-map');
  const key = storageKey || 'heritage-place-choices-v1-' + (runtime.treeId || 'local');
  let gaz, data, graph, events = [], groups = [], shown = [], reference = '', choices = Object.create(null), selected = '', reviewKey = '', reviewLimit = 40;
  let bounds = [-180,-85,360,170], frame = [...bounds], drag = null, moved = false, blockClick = false, loadPromise, pressedPoint = '';
  const pointers = new Map();
  let pendingImport, expiryTimer;
  async function checkAccess() {
    if (!familyMode) return true;
    let session = await personalSyncSession();
    if (!session) {
      dialog.close();
      await requestFamilyCode('Votre accès a expiré. Saisissez à nouveau le code familial pour consulter la carte.');
      session = await personalSyncSession();
    }
    if (!session) return false;
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => {
      dialog.close();
      requestFamilyCode('Votre accès a expiré. Saisissez à nouveau le code familial.').catch(() => {});
    }, Math.max(1, session.expiresAt-Date.now()));
    return true;
  }
  function message(text) { $('map-message').textContent = text; }
  async function loadGazetteer() {
    const response = await fetch(new URL('../places.json.gz', import.meta.url));
    if (!response.ok) throw new Error('Référentiel indisponible. Ouvrez la carte avec Internet avant de réessayer hors connexion.');
    const buffer = await response.arrayBuffer(), bytes = new Uint8Array(buffer);
    if (bytes[0] === 31 && bytes[1] === 139 && typeof DecompressionStream !== 'function') throw new Error('Ce navigateur ne peut pas ouvrir la carte. Mettez Safari ou votre navigateur à jour, puis réessayez.');
    // Some hosts transparently decompress .gz responses; accept either form.
    const stream = bytes[0] === 31 && bytes[1] === 139 ? new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip')) : new Blob([buffer]).stream();
    return makeGazetteer(await new Response(stream).json());
  }
  function saveChoices() {
    try { localStorage.setItem(key, JSON.stringify({ format:'heritage-place-choices', version:1, choices })); message('Choix enregistrés sur cet appareil. Exportez-les pour les conserver ou les transférer.'); }
    catch { message('Le navigateur ne peut pas enregistrer ces choix. Ils restent actifs ici jusqu’à la fermeture ; exportez-les pour les conserver.'); }
  }
  function setFrame(value) {
    frame = value;
    svg.setAttribute('viewBox', frame.join(' '));
    const radius = frame[2] / Math.max(svg.clientWidth, 300) * 5;
    svg.querySelectorAll('.map-point').forEach(p => p.setAttribute('r', radius));
    svg.querySelectorAll('.map-label').forEach(p => {p.setAttribute('font-size',radius*2.4);p.setAttribute('dx',radius*1.6);p.setAttribute('dy',radius*.8);p.setAttribute('stroke-width',radius*.65);});
    $('map-zoom-value').textContent = Math.round(bounds[2] / frame[2] * 100) + ' %';
  }
  function zoom(factor, x = .5, y = .5) {
    const width = Math.min(360, Math.max(.025, frame[2] * factor)), height = frame[3] * width / frame[2];
    setFrame([frame[0] + (frame[2]-width)*x, frame[1]+(frame[3]-height)*y, width, height]);
  }
  new ResizeObserver(() => {
    if (!dialog.open || !gaz || !svg.clientWidth || !svg.clientHeight) return;
    // Keep the scene center and zoom when rotating a device. Match the SVG
    // aspect ratio so pointer coordinates have no letterbox offset.
    const height = frame[2] * svg.clientHeight / svg.clientWidth;
    setFrame([frame[0],frame[1]+(frame[3]-height)/2,frame[2],height]);
  }).observe(svg);
  function fit() {
    const points = groups.filter(g => g.record).map(g => g.record);
    if (!points.length) { setFrame([-180,-85,360,170]); return; }
    const xs = points.map(p => p.lon), ys = points.map(p => -p.lat), ratio = (svg.clientWidth || 600)/(svg.clientHeight || 400);
    let width = Math.max(.15, Math.max(...xs)-Math.min(...xs))*1.25;
    let height = Math.max(.15, Math.max(...ys)-Math.min(...ys))*1.25;
    width = Math.max(width,height*ratio); height = width/ratio;
    bounds = [(Math.max(...xs)+Math.min(...xs)-width)/2,(Math.max(...ys)+Math.min(...ys)-height)/2,width,height];
    setFrame([...bounds]);
  }
  function pointRows() {
    const points = new Map();
    for (const g of groups) if (g.record) {
      if (!points.has(g.record.id)) points.set(g.record.id, { record:g.record, events:[], variants:new Set() });
      const point = points.get(g.record.id); point.events.push(...g.events); g.variants.forEach(v => point.variants.add(v));
    }
    for (const p of points.values()) p.events.sort((a,b)=>(a.range?.[0]??Infinity)-(b.range?.[0]??Infinity)||a.id.localeCompare(b.id));
    return [...points.values()].sort((a,b) => b.events.length-a.events.length || gaz.label(a.record).localeCompare(gaz.label(b.record)));
  }
  function eventMarkup(event) {
    return `<li><strong>${esc(MAP_TAGS[event.tag])}</strong> · ${esc(formatDate(event.date) || 'Date inconnue')}<br>${event.personIds.map(id => `<button type="button" class="map-person" data-map-person="${esc(id)}">${esc(data.people[id].name)}</button>`).join(' et ')}<small>Lieu de l’export : ${esc(event.place || 'Non renseigné')}</small></li>`;
  }
  function detail() {
    const point = pointRows().find(p => p.record.id === selected);
    if (!point) { $('map-detail').innerHTML = '<p>Choisissez un point ou un lieu de la liste pour voir les événements.</p>'; return; }
    $('map-detail').innerHTML = `<h3>${esc(gaz.label(point.record))}</h3><p>${point.events.length} événement(s) · ${point.variants.size} écriture(s) rapprochée(s)</p><ul>${point.events.slice(0,80).map(eventMarkup).join('')}</ul>${point.events.length>80?'<p>Les 80 premiers événements sont affichés. Affinez les filtres pour voir les suivants.</p>':''}`;
    svg.querySelectorAll('.map-point').forEach(p => p.classList.toggle('selected', p.dataset.mapPoint === selected));
  }
  function reviewDetail() {
    const g = groups.find(g => g.key === reviewKey);
    if (!g) { $('map-review-detail').innerHTML = '<p>Choisissez une écriture pour confirmer sa localisation.</p>'; return; }
    $('map-review-detail').innerHTML = `<h4>${esc([...g.variants][0])}</h4><p>${esc(statusName[g.status])} · ${g.events.length} événement(s)</p><p>L’écriture du GEDCOM sera conservée. Confirmez après vérification des sources ; une proposition n’est pas une localisation certaine.</p><div id="map-candidates"></div><div class="map-choice-actions"><button type="button" class="outline-button" id="map-exclude">Écarter de la carte</button><button type="button" class="outline-button" id="map-clear-choice">Annuler mon choix</button></div>`;
    candidates(g.record ? [g.record] : g.candidates);
    $('map-exclude').onclick = () => { choices[g.key] = 'exclude'; saveChoices(); render(); };
    $('map-clear-choice').onclick = () => { delete choices[g.key]; saveChoices(); render(); };
  }
  function candidates(records) {
    $('map-candidates').innerHTML = records.length ? records.slice(0,30).map(r => `<button type="button" class="map-candidate" data-map-confirm="${esc(r.id)}"><strong>${esc(gaz.label(r))}</strong><small>${esc(r.context.join(' · '))} · ${r.lat.toFixed(3)}, ${r.lon.toFixed(3)}</small><span>Confirmer ce lieu</span></button>`).join('') : '<p>Aucune proposition. Cherchez une commune ci-dessous, avec son pays si nécessaire.</p>';
  }
  function renderReview() {
    const filter = placeText($('map-review-query').value), all = $('map-review-all').checked;
    const rows = groups.filter(g => (all || !g.record && g.status !== 'excluded') && (!filter || [...g.variants].some(v => placeText(v).includes(filter))));
    $('map-review-count').textContent = `${rows.length} écriture(s) ${all?'dans ce périmètre':'à vérifier'}. Vos confirmations sont propres à cet appareil, indépendantes du Carnet.`;
    $('map-review-list').innerHTML = rows.slice(0,reviewLimit).map(g => `<button type="button" class="map-place-row" data-map-review="${esc(g.key)}"><strong>${esc([...g.variants][0])}</strong><small>${esc(statusName[g.status])} · ${g.events.length} événement(s)</small></button>`).join('') || '<p>Aucune écriture à vérifier dans ce périmètre.</p>';
    $('map-review-more').hidden = rows.length <= reviewLimit;
    reviewDetail();
  }
  function render({ fitView = false } = {}) {
    if (!gaz || !data) return;
    const from = $('map-from').value === '' ? undefined : Number($('map-from').value), to = $('map-to').value === '' ? undefined : Number($('map-to').value);
    if ((from !== undefined && (!Number.isInteger(from)||from<1||from>9999)) || (to !== undefined && (!Number.isInteger(to)||to<1||to>9999)) || from !== undefined && to !== undefined && from > to) { message('Vérifiez les années : de 1 à 9999, avec un début antérieur à la fin.'); return; }
    const scope = $('map-scope').value, ids = scope === 'all' ? null : scope === 'person' ? new Set([reference]) : branchIds(graph,reference,scope);
    shown = filterMapEvents(events,{ ids, tag:$('map-event').value, query:$('map-query').value, people:data.people, from,to });
    groups = groupPlaces(shown,gaz,choices);
    const points = pointRows(), located = groups.filter(g => g.record).reduce((n,g) => n+g.events.length,0);
    $('map-count').textContent = `${located} / ${shown.length} événement(s) localisé(s) · ${points.length} lieu(x) · ${groups.filter(g => !g.record && g.status !== 'excluded').length} écriture(s) à vérifier · ${shown.filter(e => !e.place.trim()).length} événement(s) sans lieu.`;
    const route = mapRoutes(shown,groups,reference), routes = $('map-route').checked ? route.segments : [];
    svg.innerHTML = `<g class="map-land">${gaz.outlines.map(ring => `<path d="M${ring.map(([x,y])=>`${x},${-y}`).join('L')}Z"/>`).join('')}</g><g class="map-routes">${routes.map(r => `<path d="M${r.from.record.lon},${-r.from.record.lat}L${r.to.record.lon},${-r.to.record.lat}"><title>${esc(MAP_TAGS[r.from.tag])} ${esc(r.from.date)} → ${esc(MAP_TAGS[r.to.tag])} ${esc(r.to.date)}</title></path>`).join('')}</g><g>${points.map(p => `<circle class="map-point" data-map-point="${esc(p.record.id)}" cx="${p.record.lon}" cy="${-p.record.lat}" r="1" tabindex="0" role="button" aria-label="${esc(gaz.label(p.record))}, ${p.events.length} événements"><title>${esc(gaz.label(p.record))} · ${p.events.length} événement(s)</title></circle>${points.length<=25?`<text class="map-label" x="${p.record.lon}" y="${-p.record.lat}" aria-hidden="true">${esc(p.record.name)}</text>`:''}`).join('')}</g>`;
    $('map-place-list').innerHTML = points.slice(0,80).map(p => `<button type="button" class="map-place-row" data-map-point="${esc(p.record.id)}"><strong>${esc(gaz.label(p.record))}</strong><small>${p.events.length} événement(s) · ${p.variants.size} écriture(s)</small></button>`).join('') || '<p>Aucun lieu localisé. Consultez « Rapprocher les lieux ».</p>';
    $('map-place-more').hidden = points.length <= 80;
    $('map-place-more').onclick = () => { $('map-place-list').innerHTML = points.map(p => `<button type="button" class="map-place-row" data-map-point="${esc(p.record.id)}"><strong>${esc(gaz.label(p.record))}</strong><small>${p.events.length} événement(s)</small></button>`).join(''); $('map-place-more').hidden = true; };
    $('map-route-title').textContent = `Lieux datés de ${data.people[reference].name}`;
    $('map-route-events').innerHTML = route.timeline.map(eventMarkup).join('') || '<li>Aucun événement dans ce périmètre.</li>';
    $('map-route-note').textContent = `${routes.length} liaison(s). Ces traits relient des événements connus : ce ne sont ni des itinéraires ni des dates de voyage. Les dates incertaines, identiques ou manquantes ne sont pas reliées.`;
    detail(); renderReview();
    if (fitView && !points.length && groups.length) $('map-review').open = true;
    if (fitView) fit(); else setFrame(frame);
  }
  async function open() {
    data = getData(); if (!data) return;
    try { if (!await checkAccess()) return; }
    catch { message('L’accès familial ne peut pas être vérifié. Fermez puis rouvrez l’application.'); return; }
    reference = getReference(); if (!data.people[reference]) reference = data.meta.rootId;
    $('map-reference').textContent = 'Référence : ' + data.people[reference].name;
    if (!dialog.open) dialog.showModal(); dialog.scrollTop=0; message('Chargement du référentiel géographique local…'); $('map-content').hidden = true;
    try {
      gaz = await (loadPromise ||= loadGazetteer());
      if (!dialog.open) return;
      let storageWarning='';
      try { const saved = localStorage.getItem(key); choices = saved ? validPlaceChoices(JSON.parse(saved),gaz) : Object.create(null); }
      catch { choices = Object.create(null); storageWarning='Les choix enregistrés ne sont pas lisibles ou le stockage est indisponible. Réimportez votre sauvegarde de rapprochements et exportez vos prochains choix.'; }
      graph = buildKinshipGraph(data); events = collectMapEvents(data); selected = ''; reviewKey = ''; reviewLimit = 40;
      $('map-content').hidden = false; message(storageWarning || 'Les noms familiaux et les lieux restent sur votre appareil.');
      $('map-attributions').innerHTML = gaz.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)} · ${esc(s.license)}</a>`).join(' · ');
      requestAnimationFrame(() => render({fitView:true}));
    } catch (e) { loadPromise = null; message(e.message || 'Ouverture impossible. Réessayez après la mise à jour de l’application.'); }
  }
  $('open-map').addEventListener('click',open);
  $('close-map').onclick = () => dialog.close();
  $('map-retry').onclick = openRetry;
  function openRetry() { dialog.close(); open(); }
  for (const id of ['map-scope','map-event','map-from','map-to','map-query','map-route']) $(id).addEventListener(id === 'map-query' ? 'input':'change', () => { message(''); render(); });
  $('map-fit').onclick = fit; $('map-zoom-in').onclick = () => zoom(.75); $('map-zoom-out').onclick = () => zoom(1.333);
  $('map-review-query').oninput = () => { reviewLimit = 40; renderReview(); };
  $('map-review-all').onchange = renderReview;
  $('map-review-more').onclick = () => { reviewLimit += 40; renderReview(); };
  $('map-find-place').onsubmit = e => {
    e.preventDefault(); if (!reviewKey || !gaz) { message('Choisissez d’abord une écriture à rapprocher.'); return; }
    const query = placeText($('map-city-query').value), country = $('map-country-query').value.trim().toUpperCase();
    if (query.length < 2) { message('Saisissez au moins deux caractères pour chercher une commune.'); return; }
    const exact = gaz.names.get(query) || [], matches = exact.length ? exact : [...gaz.byId.values()].filter(r => placeText(r.name).includes(query));
    const filtered = matches.filter(r => !country || r.country === country);
    candidates(filtered); message(`${filtered.length} proposition(s). Les 30 premières sont affichées ; précisez le nom ou le pays si nécessaire.`);
  };
  dialog.addEventListener('click', e => {
    if (blockClick && svg.contains(e.target)) { e.preventDefault(); return; }
    const point = e.target.closest('[data-map-point]'), review = e.target.closest('[data-map-review]'), confirm = e.target.closest('[data-map-confirm]'), person = e.target.closest('[data-map-person]');
    if (point) { selected = point.dataset.mapPoint; detail(); }
    if (review) { reviewKey = review.dataset.mapReview; reviewDetail(); $('map-review-detail').scrollIntoView({block:'nearest'}); }
    if (confirm && reviewKey) { choices[reviewKey] = confirm.dataset.mapConfirm; saveChoices(); render(); }
    if (person) { dialog.close(); navigate(person.dataset.mapPerson); }
  });
  svg.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.mapPoint) { e.preventDefault(); selected=e.target.dataset.mapPoint; detail(); } });
  svg.addEventListener('wheel', e => { e.preventDefault(); const rect=svg.getBoundingClientRect(); zoom(Math.exp(Math.max(-150,Math.min(150,e.deltaY*(e.deltaMode===1?16:1)))*.003),(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height); },{passive:false});
  function gesture() {
    const p=[...pointers.values()], rect=svg.getBoundingClientRect();
    const center=p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}:p[0];
    return center && {x:center.x,y:center.y,distance:p.length>1?Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y):0,rect,frame:[...frame]};
  }
  svg.addEventListener('pointerdown', e => { if (e.button!==0) return; e.preventDefault(); pressedPoint=pointers.size?'':e.target.dataset.mapPoint || ''; pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); svg.setPointerCapture(e.pointerId); drag=gesture(); moved=false; blockClick=false; svg.classList.add('dragging'); });
  svg.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || !drag) return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); const now=gesture();
    if (Math.hypot(now.x-drag.x,now.y-drag.y)>3 || now.distance && Math.abs(now.distance-drag.distance)>3) moved=true;
    const factor=drag.distance && now.distance?drag.distance/now.distance:1;
    const w=Math.min(360,Math.max(.025,drag.frame[2]*factor)),h=drag.frame[3]*w/drag.frame[2];
    const x=(drag.x-drag.rect.left)/drag.rect.width,y=(drag.y-drag.rect.top)/drag.rect.height;
    setFrame([drag.frame[0]+(drag.frame[2]-w)*x-(now.x-drag.x)/drag.rect.width*w,drag.frame[1]+(drag.frame[3]-h)*y-(now.y-drag.y)/drag.rect.height*h,w,h]);
  });
  function end(e) { if (!pointers.has(e.pointerId)) return; if(e.type==='pointerup' && !moved && pressedPoint && pointers.size===1) {selected=pressedPoint;detail();} pressedPoint=''; pointers.delete(e.pointerId); blockClick=moved; drag=gesture(); if(!pointers.size) svg.classList.remove('dragging'); }
  svg.addEventListener('pointerup',end); svg.addEventListener('pointercancel',end); svg.addEventListener('lostpointercapture',end);
  dialog.addEventListener('close',() => { pointers.clear(); drag=null; clearTimeout(expiryTimer); });
  const recheck = () => { if (dialog.open && familyMode) checkAccess().catch(() => dialog.close()); };
  window.addEventListener('focus',recheck);
  document.addEventListener('visibilitychange',() => { if(document.visibilityState==='visible') recheck(); });
  $('map-export').onclick = () => {
    const blob=new Blob([JSON.stringify({format:'heritage-place-choices',version:1,choices},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url; a.download='heritage-lieux-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('map-import').onchange = async e => {
    const file=e.target.files[0]; e.target.value=''; if(!file || !gaz) return;
    pendingImport=null; $('map-import-confirm').hidden=true;
    try { if(file.size>8000000) throw new Error('Fichier trop volumineux.'); pendingImport=validPlaceChoices(JSON.parse(await file.text()),gaz); message(`${Object.keys(pendingImport).length} choix lus. Confirmez l’import pour les appliquer ; ils remplaceront vos choix pour les mêmes écritures.`); $('map-import-confirm').hidden=false; }
    catch(e) { message(e.message || 'Fichier invalide. Aucun choix appliqué.'); }
  };
  $('map-import-confirm').onclick = () => { if(!pendingImport) return; Object.assign(choices,pendingImport); pendingImport=null; $('map-import-confirm').hidden=true; saveChoices(); render(); };
  return { close:()=>dialog.close() };
}
