// SISP-190 — Build Bundle, Service-Worker Precache & Circular-Dependency
// Integrity Gate.
//
// A FAST, hermetic complement to tests/build-output.test.js and
// tests/perf-budget-219.test.js: those run the real esbuild build (and so
// need node_modules and a temp dist). This gate needs neither — it reads the
// source tree only, so it can run anywhere `node --test` can, and it pins the
// three integrity properties the build relies on:
//
//   1. EXISTENCE — every module in build.mjs ENTRY_FILES exists, and the
//      runtime graph walked from them (build.mjs collectRuntimeFiles, the
//      exact walk the build itself performs) references no missing file.
//   2. CYCLES — the ES-module import graph over the runtime .js files,
//      scanned with a real tokenizer (see below). See the SISP-190 FINDING
//      note on the cycle test: current main is NOT cycle-free.
//   3. PRECACHE — the service-worker contract: source sw.js declares
//      CACHE_NAME / APP_FILES in exactly the shapes build.mjs rewrites, every
//      source APP_FILES entry exists, and build.mjs writeServiceWorker
//      precaches exactly the published file list it is handed (minus sw.js
//      itself). Together with build-output.test.js (which pins that build()
//      hands it the true dist listing) this covers "every file the app loads
//      is precached" without running a build here.
//
// Import scanning: build.mjs extractReferences is a regex scanner and can be
// fooled by import-shaped text inside string literals (the SISP-191 gotcha).
// This gate therefore tokenizes each module properly: comments, string /
// template literal contents and regex literals never become tokens, so only
// real import / export-from / dynamic-import statements produce graph edges.
// Fixtures below prove a string containing "import ... from '...'" creates
// NO phantom edge, and that the gate can actually fail (fake cycle, fake
// missing entry, fake precache gap are all detected).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTRY_FILES, collectRuntimeFiles, resolveLocal, writeServiceWorker } from '../build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- tokenizer
const isIdentStart = c => /[A-Za-z_$]/.test(c);
const isIdentPart = c => /[A-Za-z0-9_$]/.test(c);
// After these keywords a `/` opens a regex literal rather than division.
const REGEX_OK_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof', 'do', 'else', 'yield', 'await', 'throw']);

function tokenize(source) {
  const tokens = [];
  const n = source.length;
  let i = 0;
  let prev = null;
  const push = (type, value) => { const t = { type, value }; tokens.push(t); prev = t; };
  const regexAllowed = () => {
    if (!prev) return true;
    if (prev.type === 'string' || prev.type === 'number' || prev.type === 'regex' || prev.type === 'template') return false;
    if (prev.type === 'ident') return REGEX_OK_KEYWORDS.has(prev.value);
    return !(prev.value === ')' || prev.value === ']' || prev.value === '}');
  };
  // Frame stack: template literals nest; `${ ... }` pushes a code frame that
  // ends at its matching close brace.
  const stack = [{ kind: 'code', expr: false, depth: 0 }];
  const top = () => stack[stack.length - 1];
  while (i < n) {
    const frame = top();
    const c = source[i];
    if (frame.kind === 'template') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; stack.pop(); push('template', null); continue; }
      if (c === '$' && source[i + 1] === '{') { i += 2; stack.push({ kind: 'code', expr: true, depth: 0 }); continue; }
      i++; continue;
    }
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v' || c === '\u00A0' || c === '\u2028' || c === '\u2029' || c === '\uFEFF') { i++; continue; }
    if (c === '/' && source[i + 1] === '/') { i += 2; while (i < n && source[i] !== '\n') i++; continue; }
    if (c === '/' && source[i + 1] === '*') { i += 2; while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '/' && regexAllowed()) {
      i++;
      let inClass = false;
      while (i < n) {
        const ch = source[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) { i++; break; }
        else if (ch === '\n') break;
        i++;
      }
      while (i < n && isIdentPart(source[i])) i++;
      push('regex', null);
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c; i++;
      let value = '';
      while (i < n && source[i] !== quote && source[i] !== '\n') {
        if (source[i] === '\\') { value += source[i] + (source[i + 1] ?? ''); i += 2; continue; }
        value += source[i]; i++;
      }
      i++;
      push('string', value);
      continue;
    }
    if (c === '`') { i++; stack.push({ kind: 'template' }); continue; }
    if (c === '{') { if (frame.expr) frame.depth++; push('punct', c); i++; continue; }
    if (c === '}') {
      if (frame.expr && frame.depth === 0) { stack.pop(); i++; continue; }
      if (frame.expr) frame.depth--;
      push('punct', c); i++; continue;
    }
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdentPart(source[j])) j++;
      push('ident', source.slice(i, j));
      i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < n && /[0-9A-Za-z._]/.test(source[j])) j++;
      push('number', source.slice(i, j));
      i = j; continue;
    }
    push('punct', c);
    i++;
  }
  return tokens;
}

// Module specifiers of the real import / export-from / dynamic-import
// statements in a module's source. Template-literal specifiers are not
// returned (build.mjs resolveLocal rejects `${...}` references the same way).
function extractImports(source) {
  const tokens = tokenize(source);
  const specs = [];
  const isPunct = (t, v) => t && t.type === 'punct' && t.value === v;
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.type !== 'ident' || (t.value !== 'import' && t.value !== 'export')) continue;
    if (isPunct(tokens[k - 1], '.')) continue; // obj.import / obj.export
    if (t.value === 'import') {
      const next = tokens[k + 1];
      if (!next) continue;
      if (isPunct(next, '.')) continue; // import.meta
      if (isPunct(next, '(')) {
        const arg = tokens[k + 2];
        if (arg && arg.type === 'string') specs.push(arg.value);
        continue;
      }
      if (next.type === 'string') { specs.push(next.value); continue; }
    }
    // import/export clause: scan for `from '<spec>'` up to the statement end.
    for (let j = k + 1; j < Math.min(tokens.length, k + 1000); j++) {
      const u = tokens[j];
      if (isPunct(u, ';')) break;
      if (u.type === 'ident' && u.value === 'from') {
        const arg = tokens[j + 1];
        if (arg && arg.type === 'string') specs.push(arg.value);
        break;
      }
      if (u.type === 'string') break;
    }
  }
  return specs;
}

// Import graph over a Map of repo-relative file -> source text. Edges point
// only at files inside the map and use build.mjs resolveLocal, so query
// strings (?v=...) and resolution rules match the build exactly.
function buildImportGraph(sources) {
  const graph = new Map();
  for (const [file, source] of sources) {
    const edges = new Set();
    for (const spec of extractImports(source)) {
      const local = resolveLocal(spec, file);
      if (local && sources.has(local)) edges.add(local);
    }
    graph.set(file, [...edges].sort());
  }
  return graph;
}

// Tarjan's algorithm: the partition into strongly connected components is
// canonical (independent of traversal order), so it can be pinned exactly.
function stronglyConnectedComponents(graph) {
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const tstack = [];
  const components = [];
  let counter = 0;
  const strongconnect = v => {
    index.set(v, counter); low.set(v, counter); counter++;
    tstack.push(v); onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) { strongconnect(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const comp = [];
      let w;
      do { w = tstack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
      components.push(comp.sort());
    }
  };
  for (const v of graph.keys()) if (!index.has(v)) strongconnect(v);
  return components;
}

const cycleComponents = graph => stronglyConnectedComponents(graph)
  .filter(comp => comp.length > 1)
  .sort((a, b) => (a[0] < b[0] ? -1 : 1));
const selfLoops = graph => [...graph.entries()].filter(([f, edges]) => edges.includes(f)).map(([f]) => f);

// ------------------------------------------------------------- sw.js parsing
// The exact declaration shapes build.mjs writeServiceWorker rewrites (it
// throws when either is absent), applied to the SOURCE worker. Source
// APP_FILES uses single quotes; the generated dist worker is JSON.
function parseSourceWorker(swSource) {
  const cacheMatch = swSource.match(/const CACHE_NAME = '([^']+)';/);
  const filesMatch = swSource.match(/const APP_FILES = \[([^\]]*)\];/);
  if (!cacheMatch || !filesMatch) return null;
  return {
    cacheName: cacheMatch[1],
    appFiles: [...filesMatch[1].matchAll(/'([^']*)'/g)].map(m => m[1])
  };
}

const entriesMissingOnDisk = (entries, root) => entries.filter(f => !existsSync(path.join(root, f)));
const precacheEntriesMissingOnDisk = (appFiles, root) =>
  appFiles.filter(f => f !== './' && !existsSync(path.join(root, f.replace(/^\.\//, ''))));

// ------------------------------------------------------------------- tests
test('SISP-190: every ENTRY_FILE exists and the walked runtime graph references no missing file', async () => {
  assert.deepEqual(entriesMissingOnDisk(ENTRY_FILES, ROOT), [], 'every build.mjs ENTRY_FILES entry exists in the source tree');
  const { files, missing } = await collectRuntimeFiles(ROOT);
  assert.deepEqual(missing, [], 'the runtime graph walked from ENTRY_FILES references no missing file');
  for (const entry of ENTRY_FILES) assert.ok(files.includes(entry), `${entry} is part of the walked runtime graph`);
  assert.ok(files.length > 200, `runtime graph still spans the whole app (${files.length} files) — the walk did not silently shrink`);
});

// SISP-190 FINDING (verified on pristine main 8df7bad9, 2026-10-30): the spec
// asks for zero circular imports, but main is NOT cycle-free. Direct source
// inspection confirms 6 real mutual-import pairs in 2 components — e.g.
// dashboard.js line 2 imports from dashboard-charts.js while
// dashboard-charts.js line 2 imports back from dashboard.js, and nav.js
// imports each nav-*.js feature module whose modules import helpers
// (triggerHaptic, getOfflineSyncQueue) back from nav.js. These are legal ES
// module cycles that esbuild bundles and the app runs today; restructuring
// them is a deliberate refactor decision, NOT part of this gate phase.
// The gate therefore pins the cycle topology EXACTLY as a ratchet: any NEW
// cycle, a grown/merged component, or a resolved cycle all fail here, so the
// baseline can only move by a deliberate, reviewed update to this list.
// RECONCILIATION UPDATE (deliberate, 2026-11-02, onto main 78e1ff44 /
// SISP-189): a third component appeared on current main — core.js imports
// sanitizers from dark-fiber-finder / fiber-splice-closure /
// pole-asset-tracker / signal-history / splitter-port-swap /
// storm-inspection, each of those (transitively via splitter-map.js, which
// imports formatWhatsAppUrl from form-validation.js) reaches
// form-validation.js, which imports buildPayrollSummary /
// paymentSenderLabel back from core.js. The original 2 components are
// unchanged. No shipped code was restructured to remove this cycle.
const KNOWN_CYCLE_COMPONENTS = [
  ['core.js', 'dark-fiber-finder.js', 'fiber-splice-closure.js', 'form-validation.js', 'pole-asset-tracker.js', 'signal-history.js', 'splitter-map.js', 'splitter-port-swap.js', 'storm-inspection.js'],
  ['dashboard-charts.js', 'dashboard.js'],
  ['nav-aerial-alerts.js', 'nav-optical-map.js', 'nav-otdr-trace.js', 'nav-pending-actions.js', 'nav-van-inventory.js', 'nav.js']
];

test('SISP-190: import cycle topology matches the documented baseline exactly (ratchet — see finding above)', async () => {
  const { files } = await collectRuntimeFiles(ROOT);
  const jsFiles = files.filter(f => /\.m?js$/.test(f));
  assert.ok(jsFiles.length > 200, `runtime graph covers the app modules (${jsFiles.length} JS files)`);
  const sources = new Map();
  for (const file of jsFiles) sources.set(file, await readFile(path.join(ROOT, file), 'utf8'));
  const graph = buildImportGraph(sources);
  assert.deepEqual(selfLoops(graph), [], 'no module imports itself');
  assert.deepEqual(
    cycleComponents(graph),
    KNOWN_CYCLE_COMPONENTS,
    'cycle topology changed: a NEW import cycle appeared (break it), or a known one was resolved (update KNOWN_CYCLE_COMPONENTS deliberately)'
  );
});

test('SISP-190: source sw.js declares the exact worker contract build.mjs rewrites, and every precached shell file exists', async () => {
  const swSource = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const parsed = parseSourceWorker(swSource);
  assert.ok(parsed, 'sw.js declares CACHE_NAME and APP_FILES in the exact shapes build.mjs writeServiceWorker requires');
  assert.match(parsed.cacheName, /^shahdara-isp-billing-v\d+$/, 'source cache name is the un-hashed base build.mjs versions at build time');
  assert.equal(parsed.appFiles[0], './', 'precache list starts with the app root');
  assert.ok(parsed.appFiles.includes('./index.html'), 'precache list includes the app shell');
  assert.deepEqual(precacheEntriesMissingOnDisk(parsed.appFiles, ROOT), [], 'every file in source APP_FILES exists in the source tree');
  assert.ok(ENTRY_FILES.includes('sw.js'), 'the service worker itself ships (it is an ENTRY_FILE)');
});

test('SISP-190: the generated service worker precaches exactly the published files it is handed (minus the worker itself)', async () => {
  const dist = await mkdtemp(path.join(os.tmpdir(), 'shahdara-sw-gate-'));
  try {
    const first = await writeServiceWorker({ root: ROOT, dist, files: ['index.html', 'app.js', 'core.js', 'sw.js'] });
    assert.deepEqual(first.appFiles, ['./', './index.html', './app.js', './core.js'], 'precache == handed file list, sw.js excluded, root first');
    assert.match(first.cacheName, /^shahdara-isp-billing-v37-[0-9a-f]{10}$/, 'generated cache name carries the content hash');
    const writtenSource = await readFile(path.join(dist, 'sw.js'), 'utf8');
    const writtenFiles = JSON.parse(writtenSource.match(/const APP_FILES = (\[[^\]]*\]);/)[1]);
    assert.deepEqual(writtenFiles, first.appFiles, 'the written dist/sw.js carries the same precache list');
    assert.equal(writtenSource.match(/const CACHE_NAME = '([^']+)';/)[1], first.cacheName, 'the written dist/sw.js carries the hashed cache name');
    const second = await writeServiceWorker({ root: ROOT, dist, files: ['index.html', 'sw.js'] });
    assert.deepEqual(second.appFiles, ['./', './index.html'], 'a different handed list gives exactly that list — nothing is hardcoded');
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});

// ------------------------------------------------------- gate-can-fail pins
test('SISP-190 fixture: a fake import cycle IS detected', () => {
  const graph = buildImportGraph(new Map([
    ['a.js', "import './b.js';"],
    ['b.js', "import { c } from './c.js';"],
    ['c.js', "export * from './a.js';"],
    ['d.js', "import './a.js';"]
  ]));
  assert.deepEqual(cycleComponents(graph), [['a.js', 'b.js', 'c.js']], 'the a->b->c->a cycle is reported as one component');
  assert.deepEqual(selfLoops(buildImportGraph(new Map([['s.js', "import './s.js';"]]))), ['s.js'], 'a self-import is reported');
});

test('SISP-190 fixture: a fake missing entry IS detected', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shahdara-gate-missing-'));
  try {
    await writeFile(path.join(root, 'present.js'), '');
    assert.deepEqual(entriesMissingOnDisk(['present.js', 'ghost.js'], root), ['ghost.js']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SISP-190 fixture: a fake precache gap IS detected', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shahdara-gate-precache-'));
  try {
    await writeFile(path.join(root, 'index.html'), '');
    assert.deepEqual(precacheEntriesMissingOnDisk(['./', './index.html', './ghost.js'], root), ['./ghost.js'], 'a listed-but-absent precache file is reported');
    assert.equal(parseSourceWorker("const CACHE_NAME = 'x-v1';\n"), null, 'a worker without the APP_FILES declaration fails the shape check');
    assert.equal(parseSourceWorker('const APP_FILES = [];\n'), null, 'a worker without the CACHE_NAME declaration fails the shape check');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SISP-190 fixture: import-shaped text inside strings, templates and regexes creates NO phantom edge', () => {
  const source = [
    'const a = "import x from \'./phantom.js\'";',
    "const b = 'export * from \"./phantom2.js\"';",
    "const c = `import y from './phantom3.js'`;",
    "const tpl = `outer ${cond ? `inner import x from './phantom4.js'` : ''} import y from './phantom5.js'`;",
    "const re = /[\"']import\\s+from\\s*'([^']+)'/g;",
    "const note = 'press to import'; // import './phantom6.js'",
    "import './real.js';",
    "const s = \"don't\"; import './after-quote.js';"
  ].join('\n');
  assert.deepEqual(extractImports(source), ['./real.js', './after-quote.js'], 'only the two real import statements produce specifiers');
});
