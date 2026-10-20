import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, countFirstLoadRequests, collectRuntimeFiles, PERF_BUDGET, CSS_BUNDLE } from '../build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('#219 first load stays within the request budget and the source graph is bundled, not copied', async () => {
  const dist = await mkdtemp(path.join(os.tmpdir(), 'shahdara-dist-219-'));
  try {
    const distFiles = await build({ root: ROOT, dist, quiet: true });
    const { files: sourceFiles } = await collectRuntimeFiles(ROOT);
    assert.ok(sourceFiles.length > 100, `source runtime graph is still 100+ files (got ${sourceFiles.length}) — nothing was deleted to hit the budget`);
    assert.ok(distFiles.length <= PERF_BUDGET.maxFirstLoadRequests, `dist ships ${distFiles.length} files, budget is ${PERF_BUDGET.maxFirstLoadRequests}`);

    const firstLoad = await countFirstLoadRequests(dist);
    assert.ok(firstLoad.length <= PERF_BUDGET.maxFirstLoadRequests, `first load needs ${firstLoad.length} requests: ${firstLoad.join(', ')}`);
    assert.ok(firstLoad.includes(CSS_BUNDLE), 'first load uses the single CSS bundle');
    assert.equal(firstLoad.filter(f => f.endsWith('.css')).length, 1, 'exactly one stylesheet request on first load');

    const index = await readFile(path.join(dist, 'index.html'), 'utf8');
    assert.ok(!/href="\.\/(?:styles|dashboard|nav|screen-router|bulk-collect|customer-import|ui-feedback|dark-contrast|payments-list|profile-ui|payments-inbox)\.css/.test(index), 'dist/index.html no longer links every stylesheet separately');
    assert.ok(index.split('\n').length < 1000, `dist/index.html is minified (${index.split('\n').length} lines, source is ~20k)`);

    // Offline: the service worker precaches every bundled file, so all
    // features (including the shared chunks) work after the first load.
    const sw = await readFile(path.join(dist, 'sw.js'), 'utf8');
    const appFiles = JSON.parse(sw.match(/const APP_FILES = (\[[^\]]*\]);/)[1]);
    assert.deepEqual([...appFiles].sort(), ['./', ...distFiles.filter(f => f !== 'sw.js').map(f => `./${f}`)].sort());
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});
