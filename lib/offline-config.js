import { runtime } from '../runtime-config.js';
export const APP_VERSION = '0.13.0';
const namespace = runtime.mode === 'family' ? '-family-' + runtime.treeId + '-' + runtime.sourceSha : '';
export const SHELL_CACHE = 'heritage-shell-' + APP_VERSION + '-r1' + namespace;
export const DATA_CACHE = 'heritage-data-v1' + namespace;
export const MEDIA_CACHE = 'heritage-images-v1' + namespace;
export const SHELL = ['./', './index.html', './styles.css', './app.js', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './manifest.webmanifest',
  './lib/genealogy.js', './lib/tree-layout.js', './lib/media.js', './lib/notebook.js', './lib/personal-ui.js', './lib/offline.js', './lib/offline-config.js',
  './runtime-config.js', './family.css', './lib/family-session.js', './lib/family-ui.js', './lib/private-response.js', './lib/app-update.js'];
export function resourceType(input, base) {
  const url = new URL(input, base), root = new URL('./', base);
  if (url.origin !== root.origin || url.search || url.hash) return '';
  if (url.href === new URL('./data/tree.json', root).href) return 'data';
  if (url.pathname.startsWith(root.pathname + 'data/media/') && /\/data\/media\/[a-f0-9]{64}\.(jpg|png|gif|webp)$/.test(url.pathname)) return 'media';
  if (SHELL.some(path => new URL(path, root).href === url.href)) return 'shell';
  return '';
}
