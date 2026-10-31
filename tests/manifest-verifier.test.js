// SISP-89: Build & Bundle Manifest Completeness Verifier — suite wiring for
// tests/qa-manifest-check.js (QA tooling; never shipped). CI catches any
// runtime module that is missing from disk, fails to parse, sits in the
// build graph without ever being bundled, or is absent from the offline
// precache, before it can 404 on the live site (issue #208 class of bug).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, indexAssetRefs, ENTRY_FILES, PERF_BUDGET } from '../build.mjs';
import { verifyManifest } from './qa-manifest-check.js';

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

test('SISP-89 manifest verifier: zero missing or unbundled runtime references on the current tree', async () => {
  const report = await verifyManifest(ROOT);
  assert.ok(report.graphFiles.length > 200, `runtime graph is 200+ files (got ${report.graphFiles.length}) — the walk is real, not a stub`);
  assert.ok(report.jsModules.length > 200, `runtime graph carries 200+ JS modules (got ${report.jsModules.length})`);
  assert.deepEqual(report.missing, [], 'every module referenced by index.html / ENTRY_FILES exists on disk');
  assert.deepEqual(report.unbundled, [], 'every runtime JS module is bundled from an index.html entry (or is the standalone sw.js)');
  assert.deepEqual(report.syntaxFailures, [], 'every runtime JS module passes node --check');
  assert.equal(report.ok, true);
  // The verifier itself is tooling: it must stay out of the shipped graph.
  assert.ok(!ENTRY_FILES.includes('tests/qa-manifest-check.js'), 'qa-manifest-check.js is not a build entry');
  assert.ok(!report.graphFiles.includes('tests/qa-manifest-check.js'), 'qa-manifest-check.js is not in the runtime graph');
});

test('SISP-89 manifest verifier: detects a missing module, an unbundled module and a syntax failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shahdara-manifest-fixture-'));
  try {
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
    await writeFile(path.join(root, 'index.html'), '<script type="module" src="./app.js"></script>');
    await writeFile(path.join(root, 'app.js'), "import { used } from './used.js';\nimport './ghost.js';\nexport const main = used;\n");
    await writeFile(path.join(root, 'used.js'), 'export const used = 1;\n');
    await writeFile(path.join(root, 'orphan.js'), 'export const orphan = 1;\n');
    await writeFile(path.join(root, 'bad.js'), 'export const broken = ;\n');
    const report = await verifyManifest(root, { seeds: ['index.html', 'app.js', 'orphan.js', 'bad.js'] });
    assert.equal(report.ok, false, 'a tree with gaps must not verify clean');
    assert.deepEqual(report.missing, ['ghost.js (referenced from app.js)'], 'the missing import is named with its referrer');
    assert.deepEqual(report.unbundled, ['bad.js', 'orphan.js'], 'seeded modules no entry imports are flagged unbundled');
    assert.deepEqual(report.syntaxFailures.map(({ file }) => file), ['bad.js'], 'the unparsable module is flagged');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SISP-89 manifest verifier: built precache covers the whole runtime graph and stays within the #219 budget', async () => {
  const dist = await mkdtemp(path.join(os.tmpdir(), 'shahdara-dist-89-'));
  try {
    const distFiles = await build({ root: ROOT, dist, quiet: true });
    const distSet = new Set(distFiles);
    assert.ok(distSet.size <= PERF_BUDGET.maxFirstLoadRequests, `dist ships ${distSet.size} bundled files, budget is ${PERF_BUDGET.maxFirstLoadRequests}`);

    const report = await verifyManifest(ROOT, { syntax: false });
    const indexSource = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const { css: bundledCss, js: jsEntries } = indexAssetRefs(indexSource);

    // Every JS entry index.html loads is published under its own name.
    for (const entry of jsEntries) assert.ok(distSet.has(entry), `dist publishes entry ${entry}`);
    // Every non-JS, non-CSS runtime file is published as-is (manifest, icon, html).
    for (const file of report.graphFiles) {
      if (/\.(?:m?js|css)$/.test(file)) continue;
      assert.ok(distSet.has(file), `dist publishes runtime asset ${file}`);
    }
    // Every runtime stylesheet is either bundled into app.bundle.css or
    // published standalone (e.g. urdu-font.css, #228) — never dropped.
    assert.ok(distSet.has('app.bundle.css'), 'dist publishes the CSS bundle');
    for (const file of report.graphFiles) {
      if (!file.endsWith('.css')) continue;
      assert.ok(distSet.has(file) || bundledCss.includes(file), `stylesheet ${file} is bundled or published, not dropped`);
    }
    // The service worker precaches exactly the published set — no dangling
    // entries, nothing published left offline-unavailable.
    const sw = await readFile(path.join(dist, 'sw.js'), 'utf8');
    const appFiles = JSON.parse(sw.match(/const APP_FILES = (\[[^\]]*\]);/)[1]);
    assert.deepEqual([...appFiles].sort(), ['./', ...distFiles.filter(f => f !== 'sw.js').map(f => `./${f}`)].sort(), 'precache list == published files');
    // Tooling never ships.
    assert.ok(![...distSet].some(file => file.includes('qa-manifest-check')), 'qa-manifest-check.js is not in dist');
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});
