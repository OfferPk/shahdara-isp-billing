import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await listFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

// Independent (deliberately simple) reference scanner so the test does not just re-use build.mjs logic.
function localRefs(source, file) {
  const refs = [];
  const add = ref => {
    if (!ref || /^(?:[a-z]+:|\/\/|#)/i.test(ref)) return;
    const clean = ref.split(/[?#]/)[0];
    if (!clean || clean.endsWith('/')) return;
    refs.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), clean)));
  };
  if (file.endsWith('.js') || file.endsWith('.mjs')) {
    for (const m of source.matchAll(/(?:^|[;\s])(?:import|export)\b[^'"]*?from\s*['"]([^'"]+)['"]/gm)) add(m[1]);
    for (const m of source.matchAll(/(?:^|[;\s])import\s*['"]([^'"]+)['"]/gm)) add(m[1]);
    for (const m of source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1]);
  } else if (file.endsWith('.html')) {
    for (const m of source.matchAll(/\s(?:src|href)="([^"]+)"/g)) add(m[1]);
    for (const m of source.matchAll(/serviceWorker\.register\('([^']+)'/g)) add(m[1]);
  } else if (file.endsWith('.webmanifest')) {
    for (const m of source.matchAll(/"src"\s*:\s*"([^"]+)"/g)) add(m[1]);
  }
  return refs;
}

test('production build publishes every module, stylesheet and asset the app references (#208)', async () => {
  const dist = await mkdtemp(path.join(os.tmpdir(), 'shahdara-dist-'));
  try {
    await build({ root: ROOT, dist, quiet: true });
    const files = new Set(await listFiles(dist));
    for (const entry of ['index.html', 'app.js', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'styles.css']) assert.ok(files.has(entry), `dist contains ${entry}`);

    const unresolved = [];
    let checked = 0;
    for (const file of files) {
      if (!/\.(m?js|html|webmanifest)$/.test(file)) continue;
      const source = await readFile(path.join(dist, file), 'utf8');
      for (const ref of localRefs(source, file)) {
        checked += 1;
        if (!files.has(ref)) unresolved.push(`${file} -> ${ref}`);
      }
    }
    assert.ok(checked > 100, `expected to check the full import graph, checked ${checked} references`);
    assert.deepEqual(unresolved, [], `every relative reference in dist resolves to a file in dist`);

    // Every module app.js imports directly must ship (the exact failure mode of #208).
    const app = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const appImports = [...app.matchAll(/from\s*'\.\/([^'?]+)/g)].map(m => m[1]);
    assert.ok(appImports.length > 10, 'app.js imports its feature modules');
    assert.ok([...files].filter(f => f.endsWith('.js')).length > 100, 'the whole transitive module graph (100+ modules) ships, not a hand-picked subset');
    for (const mod of appImports) assert.ok(files.has(mod), `dist contains ${mod} imported by app.js`);

    // Tooling and test files never ship.
    for (const file of files) assert.doesNotMatch(file, /^(?:node_modules|tests|\.github|android|dist)\/|^(?:build\.mjs|playwright\.config\.mjs|package(?:-lock)?\.json)$/, `${file} is not a runtime file`);
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});

test('build fails loudly when a referenced runtime file is missing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shahdara-root-'));
  const dist = path.join(root, 'dist');
  try {
    const { ENTRY_FILES } = await import('../build.mjs');
    await mkdir(root, { recursive: true });
    for (const file of ENTRY_FILES) await writeFile(path.join(root, file), file === 'app.js' ? "import { x } from './does-not-exist.js?v=1';\n" : (file.endsWith('.webmanifest') ? '{}' : ''));
    await assert.rejects(build({ root, dist, quiet: true }), /does-not-exist\.js \(referenced from app\.js\)/);
    assert.equal(existsSync(path.join(dist, 'index.html')), false, 'a failed build does not leave a partial dist');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('built service worker precaches exactly the published files under a content-hashed cache (#210)', async () => {
  const dist = await mkdtemp(path.join(os.tmpdir(), 'shahdara-dist-sw-'));
  try {
    const files = await build({ root: ROOT, dist, quiet: true });
    const sw = await readFile(path.join(dist, 'sw.js'), 'utf8');
    const cacheName = sw.match(/const CACHE_NAME = '([^']+)';/)?.[1];
    assert.match(cacheName ?? '', /^shahdara-isp-billing-v\d+-[0-9a-f]{10}$/, 'cache name carries a content hash');
    const appFiles = JSON.parse(sw.match(/const APP_FILES = (\[[^\]]*\]);/)[1]);
    const expected = ['./', ...files.filter(f => f !== 'sw.js').map(f => `./${f}`)];
    assert.deepEqual([...appFiles].sort(), [...expected].sort(), 'precache list == files in dist (minus the worker itself)');
    assert.ok(appFiles.length > 100);
    const again = await build({ root: ROOT, dist, quiet: true }) && await readFile(path.join(dist, 'sw.js'), 'utf8');
    assert.equal(again.match(/const CACHE_NAME = '([^']+)';/)[1], cacheName, 'same sources give the same cache name');
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});

test('index.html shows a reload banner when an updated service worker takes control (#210)', async () => {
  const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  const head = index.slice(0, index.indexOf('<body>'));
  assert.match(head, /addEventListener\('controllerchange'/);
  assert.match(head, /swUpdateBanner/);
  assert.match(head, /Naya version tayyar hai/);
  assert.match(head, /location\.reload\(\)/);
});
