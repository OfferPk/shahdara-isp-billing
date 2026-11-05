import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WAIVER_REASON_STARTERS,
  normalizeWaiverReason,
  normalizeWaiverReasonList,
  findWaiverReason,
  recordWaiverReason,
  removeWaiverReason,
  waiverReasonsSorted,
  waiverReasonsForCategory,
  waiversForReason,
  waiverReasonCounts,
  waiverReasonUncataloguedCount,
  waiverReasonSummary,
  waiverReasonText,
  waiverReasonHtml,
  waiverReasonAllHtml,
  waiverReasonCsv,
  waiverReasonFilename,
} from '../waiver-reason.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'waiver-reason.js'), 'utf8');

const hardship = { code: 'HARDSHIP', meaning: 'Customer facing genuine financial hardship', category: 'hardship' };
const goodwill = { code: 'GOODWILL', meaning: 'Goodwill gesture for a loyal customer', category: 'goodwill' };
const error = { code: 'ERROR', meaning: 'Correction of a billing error', category: 'error correction' };

test('a catalogue entry with no meaning is refused, as are entries with no code or no category', () => {
  assert.equal(normalizeWaiverReason({ code: 'HARDSHIP', meaning: '', category: 'hardship' }), null);
  assert.equal(normalizeWaiverReason({ code: 'HARDSHIP', category: 'hardship' }), null);
  assert.equal(normalizeWaiverReason({ code: '', meaning: 'Something', category: 'hardship' }), null);
  assert.equal(normalizeWaiverReason({ code: 'HARDSHIP', meaning: 'Something', category: '' }), null);
  assert.equal(normalizeWaiverReason({ code: 'HARDSHIP', meaning: 'Something' }), null);
  assert.equal(normalizeWaiverReason(null), null);
});

test('codes are stored upper-cased and trimmed, so the same reason cannot appear twice', () => {
  assert.deepEqual(
    normalizeWaiverReason({ code: '  hardship ', meaning: 'Hard times', category: 'hardship' }),
    { code: 'HARDSHIP', meaning: 'Hard times', category: 'hardship' },
  );
  assert.deepEqual(
    normalizeWaiverReasonList([hardship, { code: 'hardship', meaning: 'Different words', category: 'hardship' }]),
    [hardship],
  );
});

test('unknown fields are dropped on normalisation', () => {
  assert.deepEqual(
    normalizeWaiverReason({ ...hardship, billId: 'B-1', amount: 500, waived: true }),
    hardship,
  );
});

test('a duplicate code is never rewritten, and there is no edit path', () => {
  const before = [hardship];
  assert.deepEqual(
    recordWaiverReason(before, { code: 'HARDSHIP', meaning: 'Rewritten meaning', category: 'goodwill' }),
    [hardship],
  );
  assert.deepEqual(recordWaiverReason(before, goodwill), [hardship, goodwill]);
  assert.deepEqual(recordWaiverReason(before, { code: 'NEW', meaning: '', category: 'goodwill' }), [hardship]);
});

test('find and remove work case-insensitively', () => {
  assert.deepEqual(findWaiverReason([hardship, goodwill], 'goodwill'), goodwill);
  assert.equal(findWaiverReason([hardship], 'MISSING'), null);
  assert.deepEqual(removeWaiverReason([hardship, goodwill], 'hardship'), [goodwill]);
  assert.deepEqual(removeWaiverReason([hardship], 'MISSING'), [hardship]);
});

test('catalogue sorts by code, and category filter is case-insensitive substring', () => {
  assert.deepEqual(waiverReasonsSorted([error, hardship, goodwill]), [error, goodwill, hardship]);
  assert.deepEqual(waiverReasonsForCategory([hardship, goodwill, error], 'GOOD'), [goodwill]);
  assert.deepEqual(waiverReasonsForCategory([hardship, goodwill, error], 'correction'), [error]);
  assert.deepEqual(waiverReasonsForCategory([hardship], ''), []);
});

test('waivers filter by catalogue reason, case-insensitively', () => {
  const waivers = [
    { id: 'W-1', reasonCode: 'hardship' },
    { id: 'W-2', reasonCode: 'HARDSHIP' },
    { id: 'W-3', reasonCode: 'GOODWILL' },
    { id: 'W-4', reasonCode: 'FREE TEXT' },
    { id: 'W-5' },
  ];
  assert.deepEqual(waiversForReason(waivers, 'hardship').map((w) => w.id), ['W-1', 'W-2']);
  assert.deepEqual(waiversForReason(waivers, 'GOODWILL').map((w) => w.id), ['W-3']);
  assert.deepEqual(waiversForReason(waivers, ''), []);
  assert.deepEqual(waiversForReason(null, 'HARDSHIP'), []);
});

test('waivers count by catalogue reason, with free-word waivers counted as uncatalogued', () => {
  const catalogue = [hardship, goodwill, error];
  const waivers = [
    { id: 'W-1', reasonCode: 'HARDSHIP' },
    { id: 'W-2', reasonCode: 'hardship' },
    { id: 'W-3', reasonCode: 'GOODWILL' },
    { id: 'W-4', reasonCode: 'helped him out' },
    { id: 'W-5' },
  ];
  assert.deepEqual(waiverReasonCounts(catalogue, waivers), [
    { code: 'ERROR', meaning: 'Correction of a billing error', category: 'error correction', count: 0 },
    { code: 'GOODWILL', meaning: 'Goodwill gesture for a loyal customer', category: 'goodwill', count: 1 },
    { code: 'HARDSHIP', meaning: 'Customer facing genuine financial hardship', category: 'hardship', count: 2 },
  ]);
  assert.equal(waiverReasonUncataloguedCount(catalogue, waivers), 2);
  assert.equal(
    waiverReasonSummary(catalogue, waivers),
    '3 waiver(s) across 2 catalogue reason(s) (3 reason(s) in catalogue), 2 uncatalogued.',
  );
  assert.equal(
    waiverReasonSummary(catalogue, [{ id: 'W-1', reasonCode: 'ERROR' }]),
    '1 waiver(s) across 1 catalogue reason(s) (3 reason(s) in catalogue), none uncatalogued.',
  );
});

test('counting never changes a waiver, and inputs are never mutated', () => {
  const waivers = [{ id: 'W-1', reasonCode: 'HARDSHIP', amount: 200 }];
  const snapshot = JSON.parse(JSON.stringify(waivers));
  waiverReasonCounts([hardship], waivers);
  waiversForReason(waivers, 'HARDSHIP');
  assert.deepEqual(waivers, snapshot);
  const catalogue = [hardship];
  const catalogueSnapshot = JSON.parse(JSON.stringify(catalogue));
  recordWaiverReason(catalogue, goodwill);
  removeWaiverReason(catalogue, 'HARDSHIP');
  waiverReasonsSorted(catalogue);
  assert.deepEqual(catalogue, catalogueSnapshot);
});

test('starter catalogue covers hardship, goodwill, and error correction', () => {
  assert.deepEqual(
    WAIVER_REASON_STARTERS.map((entry) => entry.code),
    ['HARDSHIP', 'GOODWILL', 'ERROR'],
  );
  assert.deepEqual(normalizeWaiverReasonList(WAIVER_REASON_STARTERS), WAIVER_REASON_STARTERS);
});

test('text, html escaping, csv, and filename', () => {
  assert.equal(
    waiverReasonText(hardship),
    'HARDSHIP: Customer facing genuine financial hardship (hardship).',
  );
  assert.equal(waiverReasonText(null), 'No waiver reason.');
  assert.equal(waiverReasonHtml(null), '<p>No waiver reason.</p>');
  const tricky = { code: 'X', meaning: 'A <b>bold</b> & "quoted" reason', category: 'goodwill' };
  assert.ok(!waiverReasonHtml(tricky).includes('<b>'));
  assert.ok(waiverReasonHtml(tricky).includes('&lt;b&gt;'));
  assert.ok(waiverReasonAllHtml([]).includes('No waiver reasons'));
  assert.ok(waiverReasonAllHtml([hardship]).includes('HARDSHIP'));
  assert.equal(
    waiverReasonCsv([hardship, goodwill]),
    'Code,Meaning,Category\nGOODWILL,Goodwill gesture for a loyal customer,goodwill\nHARDSHIP,Customer facing genuine financial hardship,hardship',
  );
  assert.equal(waiverReasonFilename(), 'waiver-reasons.csv');
});

test('purity fence: module uses no Date, storage, or network', () => {
  assert.equal(/\bnew Date\b/.test(moduleSrc), false);
  assert.equal(/localStorage/.test(moduleSrc), false);
  assert.equal(/fetch\(/.test(moduleSrc), false);
  assert.equal(/^import /m.test(moduleSrc), false);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['wrCode', 'wrMeaning', 'wrCategory', 'wrSaveBtn', 'wrRemoveId', 'wrRemoveBtn', 'wrCategoryFilter', 'wrBody', 'wrSummary', 'wrExportBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing ${id}`);
  }
});

test('app.js wires the waiver reason panel', () => {
  assert.ok(appJs.includes("from './waiver-reason.js'"));
  assert.ok(appJs.includes('renderWaiverReasons()'));
  assert.ok(appJs.includes('shahdara_waiver_reasons_v1'));
});

test('deployment guard: no standalone OLT word in app.js', () => {
  assert.equal(/\bOLT\b/.test(appJs), false);
});
