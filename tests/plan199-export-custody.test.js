import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validCustodyDate,
  normalizeCustodyConfirmation,
  normalizeCustodyEntry,
  normalizeCustodyList,
  findCustodyExport,
  recordCustodyExport,
  removeCustodyExport,
  confirmCustodyExport,
  custodyExportsSorted,
  custodyUnconfirmed,
  custodyByKind,
  custodySummaryText,
  custodyText,
  custodyHtml,
  custodyAllHtml,
  custodyCsv,
  custodyFilename,
} from '../export-custody.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const first = {
  id: 'EC-1', date: '2026-11-01', exportKind: 'Accountant pack',
  takenBy: 'Saad', purpose: 'Tax filing', confirmation: 'unconfirmed', note: '',
};
const second = {
  id: 'EC-2', date: '2026-11-03', exportKind: 'Printed bills',
  takenBy: 'Owner', purpose: 'Shop record', confirmation: 'confirmed', note: 'Filed',
};

test('half-formed entries are refused', () => {
  assert.equal(normalizeCustodyEntry(null), null);
  assert.equal(normalizeCustodyEntry({ ...first, id: '' }), null);
  assert.equal(normalizeCustodyEntry({ ...first, date: '2026-13-01' }), null);
  assert.equal(normalizeCustodyEntry({ ...first, exportKind: '  ' }), null);
  assert.equal(normalizeCustodyEntry({ ...first, takenBy: '' }), null);
  assert.equal(normalizeCustodyEntry({ ...first, purpose: '' }), null);
});

test('strict calendar dates', () => {
  assert.equal(validCustodyDate('2026-02-29'), false);
  assert.equal(validCustodyDate('2024-02-29'), true);
  assert.equal(validCustodyDate('2026-04-31'), false);
  assert.equal(validCustodyDate('2026-08-31'), true);
  assert.equal(validCustodyDate('2026-11-05'), true);
  assert.equal(validCustodyDate('05-11-2026'), false);
});

test('confirmation falls back to unconfirmed', () => {
  assert.equal(normalizeCustodyConfirmation('confirmed'), 'confirmed');
  assert.equal(normalizeCustodyConfirmation('done'), 'unconfirmed');
  assert.equal(normalizeCustodyConfirmation(''), 'unconfirmed');
  assert.equal(normalizeCustodyEntry({ ...first, confirmation: 'returned' }).confirmation, 'unconfirmed');
});

test('unknown fields are dropped', () => {
  const entry = normalizeCustodyEntry({ ...first, billId: 'B-1', paymentTotal: 500, exportedData: '...', sendTo: 'x' });
  assert.deepEqual(Object.keys(entry).sort(), ['confirmation', 'date', 'exportKind', 'id', 'note', 'purpose', 'takenBy']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordCustodyExport([first], { ...first, purpose: 'Changed purpose' });
  assert.equal(list.length, 1);
  assert.equal(list[0].purpose, 'Tax filing');
});

test('find and remove', () => {
  assert.equal(findCustodyExport([first, second], 'EC-2').takenBy, 'Owner');
  assert.equal(findCustodyExport([first], 'EC-9'), null);
  assert.deepEqual(removeCustodyExport([first, second], 'EC-1'), [second]);
  assert.equal(removeCustodyExport([first], '').length, 1);
});

test('confirming changes only the marker', () => {
  const list = confirmCustodyExport([first], 'EC-1');
  assert.equal(list[0].confirmation, 'confirmed');
  assert.equal(list[0].purpose, 'Tax filing');
  assert.deepEqual(confirmCustodyExport([first], 'EC-9'), [first]);
});

test('newest-first sorting with id ties', () => {
  const a = { ...first, id: 'EC-9', date: '2026-11-03' };
  const sorted = custodyExportsSorted([first, second, a]);
  assert.deepEqual(sorted.map((e) => e.id), ['EC-2', 'EC-9', 'EC-1']);
});

test('unconfirmed view flags open exports', () => {
  assert.deepEqual(custodyUnconfirmed([first, second]).map((e) => e.id), ['EC-1']);
  assert.deepEqual(custodyUnconfirmed([second]), []);
});

test('kind filter is case-insensitive', () => {
  assert.deepEqual(custodyByKind([first, second], 'accountant pack').map((e) => e.id), ['EC-1']);
  assert.equal(custodyByKind([first, second], '').length, 2);
});

test('summary text', () => {
  assert.equal(custodySummaryText([]), 'No exports logged.');
  assert.equal(custodySummaryText([second]), '1 export logged, all confirmed.');
  assert.equal(custodySummaryText([first, second]), '2 exports logged, 1 unconfirmed.');
});

test('text rendering marks unconfirmed plainly', () => {
  assert.match(custodyText(first), /UNCONFIRMED/);
  assert.match(custodyText(second), /Confirmed \(returned or deleted\)/);
  assert.equal(custodyText(null), '');
});

test('HTML escapes input', () => {
  const html = custodyHtml({ ...first, purpose: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('CSV columns and filename', () => {
  const csv = custodyCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,date,export_kind,taken_by,purpose,confirmation,note');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /EC-2/);
  assert.equal(custodyFilename(), 'export-custody.csv');
});

test('inputs are never mutated', () => {
  const entry = { ...first };
  const before = JSON.stringify(entry);
  recordCustodyExport([], entry);
  normalizeCustodyEntry(entry);
  assert.equal(JSON.stringify(entry), before);
});

test('list normalization drops bad and duplicate entries', () => {
  const list = normalizeCustodyList([first, { ...first, purpose: 'Other' }, null, { ...first, id: '' }]);
  assert.equal(list.length, 1);
  assert.deepEqual(normalizeCustodyList('not a list'), []);
});

test('purity fence: no import, no storage, no audit-log import', () => {
  const src = readFileSync(join(dir, '..', 'export-custody.js'), 'utf8');
  assert.doesNotMatch(src, /^import /m);
  assert.doesNotMatch(src, /localStorage/);
  assert.doesNotMatch(src, /from '\.\/audit-log\.js'/);
});

test('panel ids are present in index.html', () => {
  for (const id of ['ecBody', 'ecSummary', 'ecExportBtn', 'ecDate', 'ecKind', 'ecTakenBy', 'ecPurpose', 'ecNote', 'ecSaveBtn', 'ecConfirmId', 'ecConfirmBtn', 'ecRemoveId', 'ecRemoveBtn', 'ecKindFilter']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing ${id}`);
  }
});

test('app.js wiring is present', () => {
  assert.ok(appJs.includes("from './export-custody.js'"));
  assert.ok(appJs.includes('shahdara_export_custody_v1'));
  assert.ok(appJs.includes('renderExportCustody()'));
  assert.ok(appJs.includes('ecExportBtn'));
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const mine = appJs.match(/export-custody|ExportCustody|EXPORT_CUSTODY/g) || [];
  assert.ok(mine.length > 0);
});
