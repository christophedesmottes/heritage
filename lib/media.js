import { runtime } from '../runtime-config.js';
// Family edition never exposes original third-party signed media URLs.
export function mediaSource(item) {
  if (/^\.\/data\/media\/[a-f0-9]{64}\.(jpg|png|gif|webp)$/.test(item.localFile ?? '')) return item.localFile;
  if (runtime.mode === 'family') return '';
  try {
    const url = new URL(item.file);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function mediaFor(person) {
  const seen = new Set();
  return [...(person.media ?? []), ...(person.events ?? []).flatMap(event => event.media ?? [])]
    .filter(item => {
      const source = mediaSource(item);
      if (!source || seen.has(source)) return false;
      seen.add(source);
      return true;
    });
}

export function portraitFor(person) {
  const items = mediaFor(person);
  return items.find(item => item.primary) ?? items[0];
}
