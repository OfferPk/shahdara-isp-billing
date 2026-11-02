import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, collectRuntimeFiles, extractReferences, resolveLocal, PERF_BUDGET } from '../build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const refs = source => extractReferences(source, '.js');

// SISP-191 (PR #494 follow-up): the build's import scanner must never mistake
// words inside strings, templates or comments for module references. During
// SISP-53 a translation string ending in the word "import" made the naive
// scanner pair that string's closing quote with the next dictionary entry's
// opening quote and invent a garbage reference that failed the build.

test('a translation string ending in "import" yields no module reference', () => {
  const dictShape = "const DICT = { en: {\n  foo_hint: 'Use the bulk import',\n  bar_label: 'Bar',\n} };";
  assert.deepEqual(refs(dictShape), []);
});

test('a dictionary value ending in "import" cannot swallow the next entry, even a path-like one', () => {
  const source = "const DICT = { en: {\n  a_hint: 'Use the bulk import',\n  b_label: './not-a-module.js',\n} };";
  assert.deepEqual(refs(source), []);
});

test('the word "import" inside strings, templates and comments is never a reference', () => {
  assert.deepEqual(refs("const h = 'import data from CSV';"), []);
  assert.deepEqual(refs('const s = `start import`;'), []);
  assert.deepEqual(refs("const s = `Total ${'import'} done`;"), []);
  assert.deepEqual(refs("// import './ghost.js'\nconst x = 1;"), []);
  assert.deepEqual(refs("/* import './ghost2.js' */\nconst y = 2;"), []);
  assert.deepEqual(refs('const a = "don\'t import";\nconst b = \'can\\\'t import\';'), []);
});

test('a regex literal containing "import" and quotes is not a reference and eats no code', () => {
  assert.deepEqual(refs("const re = /import\\s+[\"']([^\"']+)[\"']/;\nconst z = 1;"), []);
  assert.deepEqual(refs("if (/import/.test(x)) { f(); }"), []);
});

test('real imports, re-exports and dynamic imports are all still found', () => {
  assert.deepEqual(refs("import './real.js';"), ['./real.js']);
  assert.deepEqual(refs("import def, { named } from './a.js';"), ['./a.js']);
  assert.deepEqual(refs("import {\n  alpha,\n  beta\n} from './multi.js';"), ['./multi.js']);
  assert.deepEqual(refs("export { thing } from './reexp.js';"), ['./reexp.js']);
  assert.deepEqual(refs("export * from './star.js';\nexport { a } from './named.js';"), ['./star.js', './named.js']);
  assert.deepEqual(refs("const m = await import('./dyn.js');"), ['./dyn.js']);
  // The customer-import.js shape: a block comment inside the import() parens.
  assert.deepEqual(refs("const m = () => import(/* @vite-ignore */ './lazy.js');"), ['./lazy.js']);
  // A dynamic import inside a template ${ } expression is code and is found.
  assert.deepEqual(refs("const s = `x ${await import('./inner.js')} y`;"), ['./inner.js']);
});

test('a poisoned string does not hide or corrupt a real import in the same file', () => {
  const source = "const D = { a: 'Use the bulk import', b: 'x' };\nimport real from './real.js';";
  assert.deepEqual(refs(source), ['./real.js']);
  const afterDivision = "const q = a / b / c;\nimport './after-div.js';";
  assert.deepEqual(refs(afterDivision), ['./after-div.js']);
  const afterEscapedQuote = "const s = 'it\\'s import time';\nimport './esc.js';";
  assert.deepEqual(refs(afterEscapedQuote), ['./esc.js']);
});

test('the real nav-language.js dictionary (the PR #494 file) scans to zero references', async () => {
  const source = await readFile(path.join(ROOT, 'nav-language.js'), 'utf8');
  assert.deepEqual(extractReferences(source, '.js'), []);
});

test('no runtime file in the real tree produces a phantom reference', async () => {
  const { files } = await collectRuntimeFiles(ROOT);
  const runtime = new Set(files);
  const TEXT_EXTS = new Set(['.html', '.js', '.mjs', '.css', '.webmanifest', '.json']);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    const source = await readFile(path.join(ROOT, file), 'utf8');
    for (const ref of extractReferences(source, ext)) {
      const local = resolveLocal(ref, file);
      if (local) assert.ok(runtime.has(local), `${file} references ${JSON.stringify(ref)} -> ${local}, which is not a runtime file`);
    }
  }
});

async function listFilesRecursive(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await listFilesRecursive(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

test('#219 bundle ceiling: the build ships exactly 24 files, within the perf budget', async () => {
  const dist = await mkdtemp(path.join(os.tmpdir(), 'shahdara-dist-191-'));
  try {
    const distFiles = await build({ root: ROOT, dist, quiet: true });
    assert.ok(distFiles.length <= PERF_BUDGET.maxFirstLoadRequests, `dist ships ${distFiles.length} files, budget is ${PERF_BUDGET.maxFirstLoadRequests}`);
    assert.equal(distFiles.length, 24, 'dist currently ships exactly 24 bundled files (pin updated 25 -> 24 at the SISP-191 merge, main having consolidated to 24)');
    assert.deepEqual(await listFilesRecursive(dist), [...distFiles].sort(), 'files on disk in dist match the count the build itself reports');
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});
