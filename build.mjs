// Production build for GitHub Pages / Capacitor.
//
// dist/ must contain every file the app loads at runtime. Earlier versions copied a
// hand-maintained list, so every new module imported by app.js (100+) 404'd on the
// live site and the whole ES-module graph failed to start (issue #208).
//
// Now the build walks the runtime graph starting from index.html, sw.js and the
// manifest: HTML src/href, JS static/dynamic imports and re-exports, CSS @import/url(),
// and manifest icons. Every local file reached is copied. A reference to a missing
// file fails the build instead of shipping a broken site.
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');

// Entry points plus files that must always ship (kept from the original list).
export const ENTRY_FILES = ['index.html','styles.css','dashboard.css','nav.css','app.js','dashboard.js','dashboard-charts.js','dashboard-collection-target.js','dashboard-dues-aging.js','nav.js','nav-collection-rounds.js','nav-quick-collect.js','nav-customer-search.js','nav-quick-profile.js','nav-pending-actions.js','form-validation.js','profile-labels.js','profile-ui.js','receipt.js','package-catalog.js','core.js','phase3.js','owner-insights.js','owner-ui.js','backup-store.js','duplicate-detection.js','qa-backup-csv-import.js','sw.js','manifest.webmanifest','icon.svg'];

const stripComments = (source, ext) => {
  if (ext === '.html') return source.replace(/<!--[\s\S]*?-->/g, '');
  if (ext === '.js' || ext === '.mjs' || ext === '.css') return source.replace(/\/\*[\s\S]*?\*\//g, '');
  return source;
};

export function extractReferences(source, ext) {
  const refs = [];
  const text = stripComments(source, ext);
  const push = value => { if (value) refs.push(value.trim()); };
  if (ext === '.html') {
    for (const m of text.matchAll(/<(?:script|link|img|source|iframe)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)) push(m[1]);
    for (const m of text.matchAll(/serviceWorker\.register\(\s*["']([^"']+)["']/g)) push(m[1]);
    for (const m of text.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)) refs.push(...extractReferences(m[1], '.js'));
  } else if (ext === '.js' || ext === '.mjs') {
    for (const m of text.matchAll(/\b(?:import|export)\s[^'"`;]*?\sfrom\s*["']([^"']+)["']/g)) push(m[1]);
    for (const m of text.matchAll(/\bimport\s*["']([^"']+)["']/g)) push(m[1]);
    for (const m of text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) push(m[1]);
  } else if (ext === '.css') {
    for (const m of text.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/g)) push(m[1]);
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) push(m[1]);
  } else if (ext === '.webmanifest' || ext === '.json') {
    const walk = node => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) {
        if (key === 'src' && typeof value === 'string') push(value); else walk(value);
      }
    };
    try { walk(JSON.parse(text)); } catch { /* not JSON */ }
  }
  return refs;
}

// Resolve a reference to a repo-relative path, or null when it is not a local file.
export function resolveLocal(ref, fromFile) {
  if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref) || ref.includes('${')) return null;
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean || clean.endsWith('/')) return null;
  const base = clean.startsWith('/') ? '.' : path.posix.dirname(fromFile);
  const resolved = path.posix.normalize(path.posix.join(base, clean.replace(/^\//, '')));
  if (resolved.startsWith('..')) return null;
  return resolved;
}

const TEXT_EXTS = new Set(['.html','.js','.mjs','.css','.webmanifest','.json']);

export async function collectRuntimeFiles(root = ROOT) {
  const seen = new Set();
  const missing = [];
  const queue = [...ENTRY_FILES.map(file => ({ file, from: '(entry)' }))];
  while (queue.length) {
    const { file, from } = queue.shift();
    if (seen.has(file)) continue;
    const abs = path.join(root, file);
    let info;
    try { info = await stat(abs); } catch { missing.push(`${file} (referenced from ${from})`); continue; }
    if (!info.isFile()) continue;
    seen.add(file);
    const ext = path.extname(file).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    const source = await readFile(abs, 'utf8');
    for (const ref of extractReferences(source, ext)) {
      const local = resolveLocal(ref, file);
      if (local && !seen.has(local)) queue.push({ file: local, from: file });
    }
  }
  return { files: [...seen].sort(), missing };
}

export async function build({ root = ROOT, dist = DIST, quiet = false } = {}) {
  const { files, missing } = await collectRuntimeFiles(root);
  if (missing.length) throw new Error(`Build failed: missing runtime files:\n  ${missing.join('\n  ')}`);
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  for (const file of files) {
    await mkdir(path.dirname(path.join(dist, file)), { recursive: true });
    await cp(path.join(root, file), path.join(dist, file));
  }
  if (!quiet) console.log(`Built static app in dist/ (${files.length} runtime files)`);
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
}
