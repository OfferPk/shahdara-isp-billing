// Production build for GitHub Pages / Capacitor.
//
// dist/ must contain every file the app loads at runtime. Earlier versions copied a
// hand-maintained list, so every new module imported by app.js (100+) 404'd on the
// live site and the whole ES-module graph failed to start (issue #208).
//
// The build still walks the runtime graph starting from index.html, sw.js and the
// manifest (HTML src/href, JS static/dynamic imports and re-exports, CSS @import/url(),
// and manifest icons) and fails loudly when a referenced file is missing.
//
// Issue #219: the walked graph is no longer copied file-by-file. The JavaScript
// entry points named by index.html are bundled + minified with esbuild (code
// splitting produces one shared chunk set, so the browser loads the entries and
// their shared chunks instead of 154 separate modules), all stylesheets are
// bundled + minified into a single app.bundle.css, and dist/index.html is
// rewritten to reference only those bundles and minified. The service worker
// precaches exactly the bundled dist files, so every feature still works
// offline after the first load.
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');

// Entry points plus files that must always ship (kept from the original list).
export const ENTRY_FILES = ['index.html','tokens.css','components.css','styles.css','dashboard.css','nav.css','payments-inbox.css','urdu-font.css','app.js','home-today.js','dashboard.js','dashboard-charts.js','dashboard-collection-target.js','dashboard-dues-aging.js','nav.js','nav-collection-rounds.js','nav-quick-collect.js','nav-customer-search.js','nav-quick-profile.js','nav-pending-actions.js','reminder-queue.js','waada-queue.js','whatsapp-templates.js','digital-payments-settings.js','payments-inbox.js','easypaisa-parser.js','form-validation.js','profile-labels.js','profile-ui.js','receipt.js','package-catalog.js','core.js','phase3.js','owner-insights.js','owner-ui.js','backup-store.js','shop-settlement.js','billing-cycle.js','complaint-register.js','downtime-analytics.js','monthly-complaint-report.js','roznamcha.js','complaint-tickets.js','inventory-book.js','loan-ledger.js','outage-impact.js','saad-visits.js','duplicate-detection.js','qa-backup-csv-import.js','pause-billing.js','backup-health.js','install-tracker.js','mikrotik-generator.js','qr-card.js','pending-works.js','hardware-custody.js','home-budget.js','owner-khata.js','monthly-closing-notes.js','wallet-reconciliation.js','partner-settlement.js','sw.js','manifest.webmanifest','icon.svg'];// Performance budget for issue #219: the first load of Home must need no more// than this many requests (HTML + one CSS bundle + JS entries/shared chunks +
// manifest + icon + service worker). Enforced by tests/perf-budget-219.test.js
// and tests/e2e/perf-budget-219.spec.mjs.
export const PERF_BUDGET = { maxFirstLoadRequests: 25 };
export const CSS_BUNDLE = 'app.bundle.css';

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
    for (const m of text.matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*["']([^"']+)["']/g)) push(m[1]);
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

// Stylesheet and module-script references of index.html, in document order.
export function indexAssetRefs(indexHtml) {
  const css = [];
  for (const m of indexHtml.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)) {
    const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
    const local = href && resolveLocal(href, 'index.html');
    if (local) css.push(local);
  }
  const js = [];
  for (const m of indexHtml.matchAll(/<script\b[^>]*type=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi)) {
    const local = resolveLocal(m[1], 'index.html');
    if (local) js.push(local);
  }
  return { css, js };
}

// Conservative HTML minifier for dist/index.html: script/style/pre/textarea
// contents are preserved byte-for-byte; elsewhere comments are dropped and
// whitespace runs between tags collapse to a single space (which is exactly
// how the browser already renders them), removing the pretty-printing bytes.
export function minifyHtml(html) {
  const protectedBlocks = [];
  const withPlaceholders = html.replace(/<(script|style|pre|textarea)\b[\s\S]*?<\/\1>/gi, block => {
    protectedBlocks.push(block);
    return `\u0000${protectedBlocks.length - 1}\u0000`;
  });
  const minified = withPlaceholders
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '> <')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  return minified.replace(/\u0000(\d+)\u0000/g, (_, i) => protectedBlocks[Number(i)]);
}

// Rewrite dist/index.html so it loads the CSS bundle instead of every
// stylesheet. Module scripts keep their file names (esbuild writes each
// entry back under the same name, bundled) and their version queries.
export function rewriteIndexHtml(indexHtml, versionQuery = '') {
  let out = indexHtml;
  let replaced = false;
  out = out.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>\s*/gi, () => {
    if (replaced) return '';
    replaced = true;
    return `<link rel="stylesheet" href="./${CSS_BUNDLE}${versionQuery}">\n  `;
  });
  return minifyHtml(out);
}

async function listDistFiles(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await listDistFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

// Count the requests a cold first load of dist/index.html makes: the document
// itself, its stylesheet/script references, the static chunk imports of those
// scripts, the manifest, the icon and the service-worker script.
export async function countFirstLoadRequests(dist) {
  const files = new Set(await listDistFiles(dist));
  const requested = new Set(['index.html']);
  const index = await readFile(path.join(dist, 'index.html'), 'utf8');
  for (const ref of extractReferences(index, '.html')) {
    const local = resolveLocal(ref, 'index.html');
    if (local && files.has(local)) requested.add(local);
  }
  const queue = [...requested].filter(f => f.endsWith('.js'));
  const seen = new Set(queue);
  while (queue.length) {
    const file = queue.shift();
    const source = await readFile(path.join(dist, file), 'utf8');
    for (const ref of extractReferences(source, '.js')) {
      const local = resolveLocal(ref, file);
      if (local && files.has(local)) {
        requested.add(local);
        if (local.endsWith('.js') && !seen.has(local)) { seen.add(local); queue.push(local); }
      }
    }
  }
  if (files.has('sw.js')) requested.add('sw.js');
  return [...requested].sort();
}

export async function build({ root = ROOT, dist = DIST, quiet = false } = {}) {
  const { files, missing } = await collectRuntimeFiles(root);
  if (missing.length) throw new Error(`Build failed: missing runtime files:\n  ${missing.join('\n  ')}`);
  let esbuild;
  try {
    esbuild = await import('esbuild');
  } catch {
    throw new Error('Build failed: esbuild is not installed (run npm ci / npm install) — bundling is required since #219');
  }
  const indexSource = await readFile(path.join(root, 'index.html'), 'utf8');
  const { css: cssFiles, js: jsEntries } = indexAssetRefs(indexSource);
  if (!jsEntries.length) throw new Error('Build failed: index.html names no module script entries to bundle');
  if (!cssFiles.length) throw new Error('Build failed: index.html names no stylesheets to bundle');

  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  // 1) Bundle + minify every JS entry with code splitting: entries keep their
  //    names, shared code lands in a small number of chunk-*.js files.
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: jsEntries,
    outdir: dist,
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    sourcemap: false,
    logLevel: 'silent',
    chunkNames: 'chunk-[hash]',
  });

  // 2) Bundle + minify all stylesheets, in index.html order, into one file.
  const cssSource = (await Promise.all(cssFiles.map(async file => {
    const source = await readFile(path.join(root, file), 'utf8');
    // The runtime graph already proved every CSS reference resolves; esbuild
    // only minifies here, so strip @import lines whose targets are inlined
    // by this concatenation (there are currently none, kept for safety).
    return source;
  }))).join('\n');
  const cssResult = await esbuild.transform(cssSource, { loader: 'css', minify: true });
  await writeFile(path.join(dist, CSS_BUNDLE), cssResult.code);

  // 3) Copy the remaining runtime assets (manifest, icon, ...). Stylesheets
  //    named by index.html are in the bundle; standalone stylesheets loaded
  //    on demand (urdu-font.css, #228) are copied as their own files.
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.js' || ext === '.mjs' || file === 'index.html' || file === 'sw.js') continue;
    if (ext === '.css' && cssFiles.includes(file)) continue;
    await mkdir(path.dirname(path.join(dist, file)), { recursive: true });
    await cp(path.join(root, file), path.join(dist, file));
  }

  // 4) Rewrite + minify index.html to reference the bundles.
  const versionQuery = indexSource.match(/href=["']\.\/styles\.css(\?[^"']*)["']/)?.[1] ?? '';
  await writeFile(path.join(dist, 'index.html'), rewriteIndexHtml(indexSource, versionQuery));

  // 5) Service worker precaches exactly the bundled dist files (#210 + #219).
  const distFiles = [...await listDistFiles(dist), 'sw.js'].sort();
  if (files.includes('sw.js')) await writeServiceWorker({ root, dist, files: distFiles });
  if (!quiet) console.log(`Built static app in dist/ (${distFiles.length} bundled files, ${files.length} source runtime files)`);
  return distFiles;
}

// Generate dist/sw.js: precache exactly the published files and version the cache by their content,
// so every deploy installs a new worker and drops the previous cache (#210).
export async function writeServiceWorker({ root = ROOT, dist = DIST, files }) {
  const hash = createHash('sha256');
  const precached = files.filter(file => file !== 'sw.js');
  for (const file of precached) {
    // Bundled files only exist in dist; fall back to the source tree for
    // callers that still pass source file lists.
    let content;
    try { content = await readFile(path.join(dist, file)); }
    catch { content = await readFile(path.join(root, file)); }
    hash.update(file).update('\0').update(content);
  }
  const source = await readFile(path.join(root, 'sw.js'), 'utf8');
  const cacheMatch = source.match(/const CACHE_NAME = '([^']+)';/);
  const filesMatch = source.match(/const APP_FILES = \[[^\]]*\];/);
  if (!cacheMatch || !filesMatch) throw new Error('Build failed: sw.js must declare CACHE_NAME and APP_FILES');
  const cacheName = `${cacheMatch[1]}-${hash.digest('hex').slice(0, 10)}`;
  const appFiles = ['./', ...precached.map(file => `./${file}`)];
  const output = source
    .replace(cacheMatch[0], `const CACHE_NAME = '${cacheName}';`)
    .replace(filesMatch[0], `const APP_FILES = ${JSON.stringify(appFiles)};`);
  await writeFile(path.join(dist, 'sw.js'), output);
  return { cacheName, appFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
}
