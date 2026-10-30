/**
 * splice-closure-map.test.js — SISP-78 [P1]: TIA-598 12-Core Fiber
 * Joint Closure (JC Box) Color Splice Map.
 *
 * Spec criterion (read-latest.txt, SISP-78): "Mapping Core 1 (Blue) →
 * DB-01 and Core 2 (Orange) → Spare in JC-Barrian-01 persists across
 * reloads/backups and renders color swatches in dark mode."
 *
 * Pins:
 *  - the TIA-598 sequence is exactly 1 Blue … 12 Aqua;
 *  - the spec scenario exactly: a synthetic closure named
 *    JC-Barrian-01 with Core 1 → Splitter DB-01 and Core 2 → Spare
 *    survives a localStorage save/load round trip AND a JSON backup
 *    round trip (settings.spliceClosures, safe-merge rule);
 *  - sanitizer: malformed ids / duplicate ids / out-of-range cores /
 *    unknown target types are dropped or normalized, every kept
 *    closure always carries exactly 12 cores in TIA order, and a
 *    'spare' assignment never keeps a stale ref;
 *  - the in-app core rows render the literal TIA swatch for Core 1
 *    (Blue) with the recorded assignment selected; the printable
 *    Splicer Field Card and the WhatsApp card text carry the same
 *    mapping;
 *  - splitter targets come from the SISP-24 map data (customer
 *    splitterBoxId values);
 *  - no closures are seeded: an untouched store loads empty;
 *  - i18n: every jcmap_* key used by the module or the dialog markup
 *    exists in BOTH dictionaries; wiring: dialog + open button in
 *    index.html, app.js controller + backup wiring, core.js backup
 *    wiring, token CSS, runtime graph (module bundled via app.js,
 *    never a new entry file).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import {
  SPLICE_CLOSURES_KEY,
  TIA598_CORES,
  CORE_TARGET_TYPES,
  addSpliceClosure,
  assignCore,
  buildSplicerFieldCardText,
  closureCoreSummary,
  closureDisplayName,
  coreAssignmentLabel,
  deleteSpliceClosure,
  emptyCoreMap,
  formatClosureId,
  generateSplicerFieldCardHtml,
  knownSplitterBoxIds,
  loadSpliceClosures,
  nextClosureId,
  renderSpliceCoreRowsHtml,
  sanitizeSpliceClosures,
  saveSpliceClosures,
  splicerCardWhatsAppUrl,
  tiaCore
} from '../fiber-splice-closure.js';
import { collectRuntimeFiles, ENTRY_FILES } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

const NOW = '2026-10-29T10:00:00.000Z';

function fakeStorage() {
  const store = new Map();
  return {
    store,
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); }
  };
}

/** The spec-pin closure: JC-Barrian-01, Core 1 → DB-01, Core 2 → Spare. */
function pinClosures() {
  let entries = addSpliceClosure([], { name: 'JC-Barrian-01', landmark: 'Pole near the bridge, Barrian road' }, NOW);
  entries = assignCore(entries, 'JC-01', 1, 'splitter', 'DB-01', NOW);
  entries = assignCore(entries, 'JC-01', 2, 'spare', '', NOW);
  return entries;
}

test('TIA-598 sequence is exactly the standard 12 colors in order', () => {
  assert.deepEqual(
    TIA598_CORES.map((entry) => `${entry.core}:${entry.colorName}`),
    ['1:Blue', '2:Orange', '3:Green', '4:Brown', '5:Slate', '6:White', '7:Red', '8:Black', '9:Yellow', '10:Violet', '11:Rose', '12:Aqua']
  );
  assert.equal(tiaCore(1).hex, '#0072CE');
  assert.equal(tiaCore(12).colorName, 'Aqua');
  assert.equal(tiaCore(13), null);
  assert.deepEqual(CORE_TARGET_TYPES, ['splitter', 'pon', 'media-converter', 'spare']);
});

test('closure ids are JC-01+ and sequential; new closures start all-spare and inputs are never mutated', () => {
  assert.equal(formatClosureId(1), 'JC-01');
  assert.equal(formatClosureId(9), 'JC-09');
  assert.equal(formatClosureId(130), 'JC-130');
  const empty = [];
  const one = addSpliceClosure(empty, { name: 'JC-Barrian-01' }, NOW);
  assert.equal(empty.length, 0);
  assert.equal(one.length, 1);
  assert.equal(one[0].closureId, 'JC-01');
  assert.equal(one[0].cores.length, 12);
  assert.ok(one[0].cores.every((core) => core.targetType === 'spare' && core.targetRef === ''));
  assert.equal(nextClosureId(one), 'JC-02');
  const two = addSpliceClosure(one, { name: 'Second box' }, NOW);
  assert.equal(two[1].closureId, 'JC-02');
  assert.equal(closureDisplayName(two[1]), 'Second box');
  assert.equal(closureDisplayName({ closureId: 'JC-07', name: '' }), 'JC-07');
  assert.deepEqual(emptyCoreMap().map((core) => core.core), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('SPEC PIN: Core 1 (Blue) → DB-01 and Core 2 (Orange) → Spare in JC-Barrian-01 persist across reload', () => {
  const entries = pinClosures();
  const storage = fakeStorage();
  assert.equal(saveSpliceClosures(entries, storage), true);
  assert.ok(storage.store.has(SPLICE_CLOSURES_KEY));
  const loaded = loadSpliceClosures(storage);
  assert.equal(loaded.length, 1);
  const closure = loaded[0];
  assert.equal(closure.name, 'JC-Barrian-01');
  assert.equal(closure.landmark, 'Pole near the bridge, Barrian road');
  const core1 = closure.cores.find((core) => core.core === 1);
  const core2 = closure.cores.find((core) => core.core === 2);
  assert.equal(tiaCore(core1.core).colorName, 'Blue');
  assert.equal(core1.targetType, 'splitter');
  assert.equal(core1.targetRef, 'DB-01');
  assert.equal(tiaCore(core2.core).colorName, 'Orange');
  assert.equal(core2.targetType, 'spare');
  assert.equal(core2.targetRef, '');
  assert.deepEqual(closureCoreSummary(closure), { assigned: 1, spares: 11, total: 12 });
  assert.equal(coreAssignmentLabel(core1, 'en'), 'Splitter DB-01');
  assert.equal(coreAssignmentLabel(core2, 'en'), 'Spare');
});

test('SPEC PIN: the JC-Barrian-01 map travels in backups (settings.spliceClosures) under the safe-merge rule', () => {
  const entries = pinClosures();
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-29T12:00:00+05:00'), { spliceClosures: entries });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.spliceClosures.length, 1);
  assert.equal(parsed.settings.spliceClosures[0].name, 'JC-Barrian-01');
  assert.equal(parsed.settings.spliceClosures[0].cores[0].targetRef, 'DB-01');

  // Empty device adopts the backup's closures.
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.spliceClosures.length, 1);
  assert.equal(preview.spliceClosures[0].cores[0].targetType, 'splitter');
  assert.equal(preview.counts.spliceClosuresRestored, 1);

  // A device holding different real closures keeps its own + conflict.
  const other = addSpliceClosure([], { name: 'JC-Other-01' }, NOW);
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentSpliceClosures: other, currentSpliceClosuresStored: true });
  assert.equal(clash.spliceClosures, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Splice closure records differ from this device'));

  // Identical on both sides: nothing to restore, no conflict.
  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentSpliceClosures: entries, currentSpliceClosuresStored: true });
  assert.equal(identical.spliceClosures, null);
  assert.equal(identical.conflicts.filter((c) => c.field.startsWith('Splice closure')).length, 0);

  // No closures anywhere: the section is simply absent from the backup.
  const bare = JSON.parse(createJsonBackup(createInitialState(), new Date('2026-10-29T12:00:00+05:00'), {}));
  assert.equal(bare.settings?.spliceClosures, undefined);
});

test('sanitizer drops malformed rows and always yields exactly 12 TIA-ordered cores', () => {
  const messy = sanitizeSpliceClosures([
    null,
    'junk',
    { closureId: 'XX-01', name: 'bad id' },
    {
      closureId: 'JC-03',
      name: '  Padded name  ',
      landmark: 'x'.repeat(500),
      cores: [
        { core: 1, targetType: 'splitter', targetRef: ' DB-09 ' },
        { core: 2, targetType: 'spare', targetRef: 'STALE-REF' },
        { core: 5, targetType: 'warp-drive', targetRef: '???' },
        { core: 99, targetType: 'pon', targetRef: 'PON 9' },
        { core: 3, targetType: 'pon', targetRef: 'PON 1/2' }
      ]
    },
    { closureId: 'JC-03', name: 'duplicate id' }
  ]);
  assert.equal(messy.length, 1);
  const closure = messy[0];
  assert.equal(closure.name, 'Padded name');
  assert.equal(closure.landmark.length, 200);
  assert.deepEqual(closure.cores.map((core) => core.core), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(closure.cores[0], { core: 1, targetType: 'splitter', targetRef: 'DB-09' });
  assert.deepEqual(closure.cores[1], { core: 2, targetType: 'spare', targetRef: '' });
  assert.deepEqual(closure.cores[2], { core: 3, targetType: 'pon', targetRef: 'PON 1/2' });
  assert.deepEqual(closure.cores[4], { core: 5, targetType: 'spare', targetRef: '' });
  assert.deepEqual(sanitizeSpliceClosures('nope'), []);
  assert.deepEqual(sanitizeSpliceClosures(undefined), []);
});

test('assignCore validates its inputs, spare clears the ref, and delete removes only the target closure', () => {
  let entries = pinClosures();
  entries = assignCore(entries, 'JC-01', 4, 'media-converter', 'MC at pole 12', NOW);
  assert.equal(entries[0].cores[3].targetType, 'media-converter');
  entries = assignCore(entries, 'JC-01', 4, 'spare', 'ignored', NOW);
  assert.deepEqual(entries[0].cores[3], { core: 4, targetType: 'spare', targetRef: '' });
  const before = JSON.stringify(entries);
  assert.equal(JSON.stringify(assignCore(entries, 'JC-99', 1, 'pon', 'PON 1', NOW)), before);
  assert.equal(JSON.stringify(assignCore(entries, 'JC-01', 42, 'pon', 'PON 1', NOW)), before);
  assert.equal(deleteSpliceClosure(entries, 'JC-01').length, 0);
  assert.equal(deleteSpliceClosure(entries, 'JC-99').length, 1);
});

test('splitter targets come from the SISP-24 map data on customer records', () => {
  const customers = [
    { name: 'Synthetic A', splitterBoxId: 'SPL-Barrian-02', splitterPort: 3 },
    { name: 'Synthetic B', splitterBoxId: 'DB-01', splitterPort: 1 },
    { name: 'Synthetic C', splitterBoxId: 'DB-01', splitterPort: 2 },
    { name: 'Synthetic D' }
  ];
  assert.deepEqual(knownSplitterBoxIds(customers), ['DB-01', 'SPL-Barrian-02']);
  assert.deepEqual(knownSplitterBoxIds([]), []);
});

test('SPEC PIN: core rows render literal TIA swatches (dark-mode safe) with the recorded assignments', () => {
  const closure = pinClosures()[0];
  const html = renderSpliceCoreRowsHtml(closure, { lang: 'en' });
  // Core 1 swatch is the literal TIA Blue, Core 2 the literal Orange.
  assert.ok(html.includes('style="background:#0072CE"'));
  assert.ok(html.includes('style="background:#FF6712"'));
  assert.ok(html.includes('Blue'));
  assert.ok(html.includes('Orange'));
  assert.ok(html.includes('data-core-type="1"'));
  assert.ok(html.includes('value="DB-01"'));
  // 12 rows, one per core.
  assert.equal((html.match(/data-core-row=/g) || []).length, 12);
  // Swatch chrome in CSS uses theme tokens so the map renders on the
  // dark modal surface; the fill itself is the recorded fiber color.
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.jc-swatch'));
  assert.ok(css.includes('border: 1px solid var(--line)'));
  assert.ok(css.includes('.jc-core-row'));
});

test('Splicer Field Card (print HTML + WhatsApp text) carries the same JC-Barrian-01 mapping', () => {
  const closure = pinClosures()[0];
  const html = generateSplicerFieldCardHtml(closure, { lang: 'en', generatedDate: '2026-10-29' });
  assert.ok(html.includes('JC-Barrian-01'));
  assert.ok(html.includes('Pole near the bridge, Barrian road'));
  assert.ok(html.includes('background:#0072CE'));
  assert.ok(html.includes('Splitter DB-01'));
  assert.ok(html.includes('print-color-adjust: exact'));
  assert.ok(html.includes('2026-10-29'));

  const text = buildSplicerFieldCardText(closure, { lang: 'en' });
  assert.ok(text.includes('JC-Barrian-01 (JC-01)'));
  assert.ok(text.includes('1. Blue → Splitter DB-01'));
  assert.ok(text.includes('2. Orange → Spare'));
  const url = splicerCardWhatsAppUrl(closure, { lang: 'en' });
  assert.ok(url.startsWith('https://wa.me/?text='));
  assert.ok(decodeURIComponent(url.split('?text=')[1]).includes('Splitter DB-01'));
});

test('no closures are seeded: an untouched store loads empty', () => {
  const storage = fakeStorage();
  assert.deepEqual(loadSpliceClosures(storage), []);
  assert.deepEqual(loadSpliceClosures({ getItem: () => '{broken', setItem: () => {} }), []);
  assert.equal(renderSpliceCoreRowsHtml(null), '');
  assert.equal(generateSplicerFieldCardHtml(null), '');
});

test('i18n: every jcmap_* key used by the module and dialog exists in both dictionaries', () => {
  const moduleSource = readFileSync(new URL('../fiber-splice-closure.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = new Set();
  for (const source of [moduleSource, indexHtml]) {
    for (const match of source.matchAll(/jcmap_[a-z_]+/g)) keys.add(match[0]);
  }
  assert.ok(keys.size >= 20, `expected at least 20 jcmap keys, found ${keys.size}`);
  for (const key of keys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing en: ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing ur: ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en value is the raw key: ${key}`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur value is the raw key: ${key}`);
  }
});

test('wiring: dialog, controller, backup plumbing and runtime graph include the splice map (no new entry file)', async () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexHtml.includes('id="spliceClosureModal"'));
  assert.ok(indexHtml.includes('id="openSpliceClosureModalBtn"'));
  assert.ok(indexHtml.includes('id="jcCoreList"'));
  assert.ok(indexHtml.includes('id="jcAddForm"'));

  const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appJs.includes("from './fiber-splice-closure.js'"));
  assert.ok(appJs.includes('setupSpliceClosureModal'));
  assert.ok(appJs.includes('spliceClosures: loadSpliceClosures()'));
  assert.ok(appJs.includes('currentSpliceClosures: loadSpliceClosures()'));
  assert.ok(appJs.includes('saveSpliceClosures(pendingBackupPreview.spliceClosures)'));

  const coreJs = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
  assert.ok(coreJs.includes("import { sanitizeSpliceClosures } from './fiber-splice-closure.js'"));
  assert.ok(coreJs.includes('settings.spliceClosures'));
  assert.ok(coreJs.includes('spliceClosuresRestored'));

  assert.ok(!ENTRY_FILES.includes('fiber-splice-closure.js'));
  const { files } = await collectRuntimeFiles(new URL('../', import.meta.url).pathname);
  assert.ok(files.includes('fiber-splice-closure.js'));
});
