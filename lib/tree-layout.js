import { familyView } from './genealogy.js';

export const CARD = { width: 184, height: 82 };
export const MIN_ZOOM = .02;
const STEP = 212, GENERATION = 180;

// An occurrence tree preserves both paths to a shared ancestor (implex).
// Only the active path is used for cycle detection, never a global visited set.
export function layoutFamily(data, centerId, scope = 'all', options = {}) {
  const family = familyView(data, centerId, scope, options);
  const requested = Number(options.ancestorDepth ?? 1);
  const ancestorDepth = Number.isFinite(requested) ? Math.max(1, Math.min(5, Math.floor(requested))) : 1;
  // Family records, not a person's flat children list, determine every union.
  const present = ids => [...new Set(ids)].filter(id => id !== centerId && data.people[id]);
  const unionRecords = scope === 'parents' ? [] : family.unions.length ? family.unions :
    family.couple.length > 1 || family.children.length ? [{ id: '', parents: family.couple, children: family.children }] : [];
  const unionGroups = unionRecords.map((f, index) => ({ id: f.id, key: `union.${index}`,
    partnerIds: present(f.parents), childIds: present(f.children), partners: [], children: [] }));
  const rawDescendantDepth = Number(options.descendantDepth ?? 1);
  const descendantDepth = Number.isFinite(rawDescendantDepth) ? Math.max(1, Math.min(5, Math.floor(rawDescendantDepth))) : 1;
  const multipleUnions = unionGroups.length > 1;
  const shownSiblings = options.showSiblings && scope !== 'parents' ? family.siblings : [];
  const nodes = [], paths = [], links = [], warnings = { cycles: 0, alternativeParents: 0 };
  const collateralUnions = [];
  const groupsFor = ids => ids.map(id => {
    const view = familyView(data, id);
    const partners = [...new Set(view.couple.slice(1))].filter(p => p !== centerId);
    return { id, partners, width: (1 + partners.length) * STEP };
  });
  const rootSiblingGroups = groupsFor(shownSiblings);
  let deepest = 0;
  function ancestry(id, depth, key, trail) {
    const node = { id, key, generation: -depth, role: depth ? 'ancestor' : 'center', parents: [], ancestorPath: [...trail, id] };
    deepest = Math.max(deepest, depth);
    if (depth < ancestorDepth) {
      const view = depth === 0 ? family : familyView(data, id, 'parents');
      if (depth && view.parentalFamilies.length > 1) warnings.alternativeParents++;
      const nextTrail = new Set([...trail, id]);
      node.parents = view.parents.flatMap((parentId, i) => {
        if (nextTrail.has(parentId)) { warnings.cycles++; return []; }
        return [ancestry(parentId, depth + 1, `${key}.${i}`, nextTrail)];
      });
    }
    node.siblingGroups = depth > 0 && options.showSiblings && scope !== 'parents'
      ? groupsFor(familyView(data, id, 'parents').siblings.filter(s => !trail.has(s) && s !== centerId)) : [];
    node.collateralSpan = node.siblingGroups.reduce((sum, group) => sum + group.width, 0);
    node.span = Math.max(STEP + node.collateralSpan, node.parents.reduce((sum, parent) => sum + parent.span, 0));
    return node;
  }
  const root = ancestry(centerId, 0, 'root', new Set());
  const centerY = 330 + deepest * GENERATION;
  function place(node, left) {
    let offset = left;
    for (const parent of node.parents) { place(parent, offset); offset += parent.span; }
    node.x = node.parents.length ? node.parents.reduce((sum, p) => sum + p.x, 0) / node.parents.length : left + node.span / 2;
    if (node.collateralSpan) node.x = left + (node.span - node.collateralSpan) / 2;
    node.y = centerY + node.generation * GENERATION;
    nodes.push(node);
    node.siblingNodes = [];
    let siblingX = node.x + STEP;
    for (const [index, group] of node.siblingGroups.entries()) {
      const sibling = { id: group.id, key: `${node.key}.sibling.${index}`, x: siblingX,
        y: node.y, generation: node.generation, role: 'parent-sibling' };
      nodes.push(sibling); node.siblingNodes.push(sibling);
      addCollateralPartners(sibling, group);
      siblingX += group.width;
    }
  }
  function addCollateralPartners(sibling, group) {
    group.partners.forEach((id, i) => {
      const partner = { id, key: `${sibling.key}.partner.${i}`, x: sibling.x + (i + 1) * STEP,
        y: sibling.y, generation: sibling.generation, role: 'collateral-partner' };
      nodes.push(partner); collateralUnions.push([sibling, partner]);
    });
  }
  place(root, 0);
  function descent(id, generation, key, trail) {
    const nextTrail = new Set([...trail, id]);
    const node = { id, key, generation, role: 'child', groups: [] };
    if (generation < descendantDepth) {
      const view = familyView(data, id);
      const records = view.unions.length ? view.unions : view.children.length ? [{id:'',parents:view.couple,children:view.children}] : [];
      node.groups = records.map((record, index) => {
        const partnerIds = [...new Set(record.parents)].filter(p => p !== id && data.people[p]);
        const children = [...new Set(record.children)].flatMap((child, i) => {
          if (!data.people[child]) return [];
          if (nextTrail.has(child)) { warnings.cycles++; return []; }
          return [descent(child, generation + 1, `${key}.union.${index}.child.${i}`, nextTrail)];
        });
        return { id:record.id, partnerIds, children,
          span: Math.max(STEP * Math.max(1,partnerIds.length), children.reduce((sum,child)=>sum+child.span,0)) };
      });
    }
    const partnerCount = node.groups.reduce((sum,g)=>sum+g.partnerIds.length,0);
    node.selfSpan = (1 + partnerCount) * STEP;
    node.span = Math.max(node.selfSpan, node.groups.reduce((sum,g)=>sum+g.span,0));
    return node;
  }
  const descendantTrees = new Map();
  if (descendantDepth > 1) unionGroups.forEach(group => {
    descendantTrees.set(group.key, group.childIds.map((id,i)=>descent(id,1,`${group.key}.child.${i}`,new Set([centerId]))));
  });
  const couple = [root];
  const childY = centerY + (multipleUnions ? 210 : GENERATION);
  let cursor = root.x + STEP / 2;
  unionGroups.forEach((group, index) => {
    // Each union owns a separate horizontal area, wide enough for all its children.
    const childSpan = descendantTrees.get(group.key)?.reduce((sum,n)=>sum+n.span,0) ?? group.childIds.length * STEP;
    const span = Math.max(STEP,group.partnerIds.length * STEP,childSpan);
    group.span = span;
    group.x = multipleUnions ? cursor + span / 2 : root.x + (family.couple.length - 1) * STEP / 2;
    group.partners = group.partnerIds.map((id, i) => ({ id, key: `${group.key}.partner.${i}`,
      x: multipleUnions ? group.x + (i - (group.partnerIds.length - 1) / 2) * STEP : root.x + (i + 1) * STEP,
      y: centerY, generation: 0, role: 'partner', unionId: group.id }));
    couple.push(...group.partners);
    group.children = group.childIds.map((id, i) => ({ id, key: `${group.key}.child.${i}`,
      x: group.x + (i - (group.childIds.length - 1) / 2) * STEP,
      y: childY, generation: 1, role: 'child', unionId: group.id }));
    cursor += span + 36;
  });
  nodes.push(...couple.slice(1));
  const siblings = [];
  let siblingX = root.x - rootSiblingGroups.reduce((sum, group) => sum + group.width, 0);
  rootSiblingGroups.forEach((group, i) => {
    const sibling = { id: group.id, key: `sibling.${i}`, x: siblingX, y: centerY, generation: 0, role: 'sibling' };
    siblings.push(sibling); nodes.push(sibling); addCollateralPartners(sibling, group);
    siblingX += group.width;
  });
  const descendantGroups = [];
  function placeDescent(node, left) {
    node.x = left + (node.span - node.selfSpan) / 2 + STEP / 2;
    node.y = childY + (node.generation - 1) * 210;
    nodes.push(node);
    let partnerX=node.x+STEP, childLeft=left;
    node.groups.forEach((group,index)=>{
      const partners=group.partnerIds.map((id,i)=>({id,key:`${node.key}.union.${index}.partner.${i}`,
        x:partnerX+i*STEP,y:node.y,generation:node.generation,role:'descendant-partner',unionId:group.id}));
      nodes.push(...partners);partnerX+=partners.length*STEP;
      let offset=childLeft;
      group.children.forEach(child=>{placeDescent(child,offset);offset+=child.span;});
      group.x=group.children.length ? (group.children[0].x+group.children.at(-1).x)/2
        : (node.x+(partners.at(-1)?.x ?? node.x))/2;
      descendantGroups.push({node,partners,children:group.children,x:group.x,id:group.id});
      childLeft+=group.span;
    });
  }
  unionGroups.forEach(group=>{
    const trees=descendantTrees.get(group.key);
    if (!trees) {nodes.push(...group.children);return;}
    let left=group.x-group.span/2;
    trees.forEach(node=>{placeDescent(node,left);left+=node.span;});
    group.children=trees;
  });
  let mid = (root.x + (couple.at(-1)?.x ?? root.x)) / 2;

  // Padding allows a selected card to be centered even at the edges of the scene.
  const dx = 500 - Math.min(...nodes.map(n => n.x - CARD.width / 2));
  nodes.forEach(n => { n.x += dx; }); mid += dx;
  unionGroups.forEach(g => { g.x += dx; });
  descendantGroups.forEach(g=>{g.x+=dx;});
  function connectParents(node, offspring = [node]) {
    if (!node.parents?.length) return;
    const parentMid = node.parents.reduce((sum, p) => sum + p.x, 0) / node.parents.length;
    const joinY = node.y - 68;
    node.parents.forEach(parent => {
      paths.push(`M${parent.x} ${parent.y + CARD.height} V${joinY} H${parentMid}`);
      offspring.forEach(child => links.push({ from: parent.key, to: child.key, type: 'parent' }));
    });
    offspring.forEach(child => paths.push(`M${parentMid} ${joinY} H${child.x} V${child.y}`));
  }
  nodes.filter(n => n.role === 'ancestor').forEach(n => connectParents(n, [n, ...(n.siblingNodes || [])]));
  collateralUnions.forEach(([person, partner]) => {
    paths.push(`M${person.x + CARD.width / 2} ${person.y + CARD.height / 2} H${partner.x - CARD.width / 2}`);
    links.push({ from: person.key, to: partner.key, type: 'union' });
  });
  connectParents(root, [...siblings, root]);
  const unionLabels = [];
  unionGroups.forEach(group => {
    // One shared partner rail is drawn behind the cards, as in a family chart.
    // Descent starts under the relevant partner/union, never under the next union.
    const parents = [root, ...group.partners];
    if (group.partners.length) {
      paths.push(`M${root.x + CARD.width / 2} ${centerY + CARD.height / 2} H${group.partners.at(-1).x - CARD.width / 2}`);
      group.partners.forEach(partner => links.push({ from: root.key, to: partner.key, type: 'union', familyId: group.id }));
    }
    if (multipleUnions || !group.partners.length) unionLabels.push({ familyId: group.id, x: group.x, y: centerY + CARD.height + 8,
      parentIds: parents.map(n => n.id), childCount: group.children.length, unknownParent: !group.partners.length });
    if (group.children.length) {
      const joinY = childY - 58;
      const originY = centerY + (multipleUnions || !group.partners.length ? CARD.height : CARD.height / 2);
      // A lone known parent still has a real connection to this family group.
      if (multipleUnions && !group.partners.length) paths.push(`M${root.x} ${centerY + CARD.height} V${centerY + CARD.height + 5} H${group.x} V${joinY}`);
      else paths.push(`M${group.x} ${originY} V${joinY}`);
      group.children.forEach(child => {
        paths.push(`M${group.x} ${joinY} H${child.x} V${child.y}`);
        parents.forEach(parent => links.push({ from: parent.key, to: child.key, type: 'parent', familyId: group.id }));
      });
    }
  });
  descendantGroups.forEach(group=>{
    const parents=[group.node,...group.partners], y=group.node.y;
    group.partners.forEach(partner=>{
      paths.push(`M${group.node.x+CARD.width/2} ${y+CARD.height/2} H${partner.x-CARD.width/2}`);
      links.push({from:group.node.key,to:partner.key,type:'union',familyId:group.id});
    });
    if (!group.children.length) return;
    const joinY=group.children[0].y-58, railY=y+CARD.height+20;
    paths.push(`M${group.node.x} ${y+CARD.height} V${railY} H${group.x} V${joinY}`);
    group.partners.forEach(partner=>paths.push(`M${partner.x} ${y+CARD.height} V${railY} H${group.x}`));
    group.children.forEach(child=>{
      paths.push(`M${group.x} ${joinY} H${child.x} V${child.y}`);
      parents.forEach(parent=>links.push({from:parent.key,to:child.key,type:'parent',familyId:group.id}));
    });
  });
  const occurrences = new Map();
  nodes.forEach(n => occurrences.set(n.id, (occurrences.get(n.id) ?? 0) + 1));
  nodes.forEach(n => { n.repeated = occurrences.get(n.id) > 1; });
  // The rectangles above a card indicate undeployed ancestry, not a generic
  // recenter action. Compare incoming links for this occurrence, so a parent
  // drawn on another branch does not hide an unexplored parental connection.
  const byKey = new Map(nodes.map(n => [n.key, n]));
  const drawnParents = new Map();
  for (const link of links) {
    if (link.type !== 'parent') continue;
    if (!drawnParents.has(link.to)) drawnParents.set(link.to, new Set());
    drawnParents.get(link.to).add(byKey.get(link.from).id);
  }
  for (const node of nodes) {
    const view = familyView(data, node.id, 'parents');
    const parentIds = view.parentalFamilies.length ? view.parentalFamilies.flatMap(f => f.parents) : view.parents;
    node.hiddenParentIds = [...new Set(parentIds)].filter(id => data.people[id] && id !== node.id
      && !drawnParents.get(node.key)?.has(id) && !node.ancestorPath?.includes(id));
    node.branchParentFamilyId = view.parentalFamilies.find(f => f.parents.some(id => node.hiddenParentIds.includes(id)))?.id ?? '';
  }
  const bounds = {
    left: Math.min(...nodes.map(n => n.x - CARD.width / 2), ...unionLabels.map(l => l.x - CARD.width / 2)),
    right: Math.max(...nodes.map(n => n.x + CARD.width / 2), ...unionLabels.map(l => l.x + CARD.width / 2)),
    top: Math.min(...nodes.map(n => n.y - 38)),
    bottom: Math.max(...nodes.map(n => n.y + CARD.height), ...unionLabels.map(l => l.y + 28)),
  };
  return { ...family, nodes, paths, links, unionGroups, unionLabels, ancestorDepth, descendantDepth, shownSiblings, warnings,
    couple: couple.map(n => n.id), children: [...new Set(unionGroups.flatMap(g => g.childIds))],
    visibleIds: [...occurrences.keys()], width: bounds.right + 500,
    height: Math.max(1800, bounds.bottom + 1000), bounds, mid };
}

export function fitZoom(bounds, width, height) {
  return Math.max(MIN_ZOOM, Math.min(1.15, (width - 90) / (bounds.right - bounds.left), (height - 95) / (bounds.bottom - bounds.top)));
}

export function zoomScroll(scroll, viewport, previousZoom, nextZoom, stageOffset = 0) {
  return Math.max(0, (scroll + viewport / 2 - stageOffset) / previousZoom * nextZoom + stageOffset - viewport / 2);
}

// Coordinates are relative to the viewport; keep the scene under the fingers.
export function pinchFrame(start, current, offset) {
  const zoom = Math.max(MIN_ZOOM, Math.min(1.6, start.zoom * current.distance / start.distance));
  return {
    zoom,
    left: Math.max(0, (start.left + start.x - offset.x) / start.zoom * zoom + offset.x - current.x),
    top: Math.max(0, (start.top + start.y - offset.y) / start.zoom * zoom + offset.y - current.y),
  };
}

export function bindPinch(viewport, read, apply) {
  let start = null, consumed = false;
  const pair = touches => {
    const [a, b] = touches, rect = viewport.getBoundingClientRect();
    return { x: (a.clientX + b.clientX) / 2 - rect.left,
      y: (a.clientY + b.clientY) / 2 - rect.top,
      distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)) };
  };
  const begin = event => {
    if (event.touches.length === 1) consumed = false;
    start = null;
    if (event.touches.length !== 2 || !event.cancelable) return;
    if (![...event.touches].every(t => viewport.contains(t.target))) return;
    const view = read();
    if (!view) return;
    event.preventDefault(); consumed = true;
    start = { ...view, ...pair(event.touches), ids: [...event.touches].map(t => t.identifier) };
  };
  viewport.addEventListener('touchstart', begin, { passive: false });
  viewport.addEventListener('touchmove', event => {
    if (!start) return;
    if (!event.cancelable || event.touches.length !== 2 ||
        ![...event.touches].every(t => start.ids.includes(t.identifier))) { start = null; return; }
    event.preventDefault();
    apply(pinchFrame(start, pair(event.touches), { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }));
  }, { passive: false });
  viewport.addEventListener('touchend', event => {
    if (consumed && event.cancelable) event.preventDefault();
    start = null;
  }, { passive: false });
  viewport.addEventListener('touchcancel', () => { start = null; });
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') consumed = false;
  });
  viewport.addEventListener('click', event => {
    if (consumed && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  return () => { start = null; };
}
