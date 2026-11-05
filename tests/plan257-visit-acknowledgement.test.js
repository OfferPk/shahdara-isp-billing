// Plan 257 — Field visit customer signature note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validVisitAcknowledgementDate,
  normalizeVisitAcknowledgementList,
  recordVisitAcknowledgement,
  removeVisitAcknowledgement,
  findVisitAcknowledgement,
  addVisitAcknowledgementFollowup,
  visitAcknowledgementSorted,
  visitAcknowledgementsForCustomer,
  visitAcknowledgementCustomers,
  visitAcknowledgementStatus,
  visitsWithoutAcknowledgement,
  visitAcknowledgementSummaryText,
  visitAcknowledgementText,
  visitAcknowledgementHtml,
  visitAcknowledgementCsv,
  visitAcknowledgementFilename,
} from '../visit-acknowledgement.js';

const first = {
  id: 'VA-1',
  visitRef: 'V-101',
  customer: 'Ahmed Raza',
  date: '2026-11-02',
  acknowledged: true,
  note: 'Customer agreed the new drop cable was fitted and the signal was checked.',
};

const second = {
  id: 'VA-2',
  visitRef: 'V-102',
  customer: 'Bilal Ahmed',
  date: '2026-11-03',
  acknowledged: 'no',
  note: 'Customer was out; the neighbour was told the work would be finished tomorrow.',
};

const third = {
  id: 'VA-3',
  visitRef: 'v-103',
  customer: 'ahmed raza',
  date: '2026-11-01',
  acknowledged: 'yes',
  note: 'Customer agreed the ONU was replaced and the old unit was taken back.',
};

test('half-formed entries are refused', () => {
  const list = [];
  assert.deepEqual(recordVisitAcknowledgement(list, { ...first, id: '' }), []);
  assert.deepEqual(recordVisitAcknowledgement(list, { ...first, visitRef: '' }), []);
  assert.deepEqual(recordVisitAcknowledgement(list, { ...first, customer: '' }), []);
  assert.deepEqual(recordVisitAcknowledgement(list, { ...first, note: '' }), []);
  assert.deepEqual(recordVisitAcknowledgement(list, { ...first, date: 'not a date' }), []);
  assert.deepEqual(recordVisitAcknowledgement(list, { ...first, acknowledged: 'maybe' }), []);
  assert.deepEqual(recordVisitAcknowledgement(list, { ...first, acknowledged: undefined }), []);
  assert.deepEqual(recordVisitAcknowledgement(list, { ...first, acknowledged: 1 }), []);
  assert.deepEqual(recordVisitAcknowledgement(list, null), []);
  assert.deepEqual(recordVisitAcknowledgement(list, 'nope'), []);
  const kept = recordVisitAcknowledgement(list, first);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].acknowledged, true);
});

test('acknowledgement accepts yes and no in words and as booleans', () => {
  assert.equal(recordVisitAcknowledgement([], { ...first, acknowledged: 'YES' }).length, 1);
  assert.equal(recordVisitAcknowledgement([], { ...first, acknowledged: 'No' })[0].acknowledged, false);
  assert.equal(recordVisitAcknowledgement([], { ...first, acknowledged: false })[0].acknowledged, false);
  assert.equal(recordVisitAcknowledgement([], { ...first, acknowledged: ' Yes ' })[0].acknowledged, true);
});

test('strict dates: real calendar days only', () => {
  assert.equal(validVisitAcknowledgementDate('2026-02-29'), false);
  assert.equal(validVisitAcknowledgementDate('2024-02-29'), true);
  assert.equal(validVisitAcknowledgementDate('2026-04-31'), false);
  assert.equal(validVisitAcknowledgementDate('2026-11-02'), true);
  assert.equal(validVisitAcknowledgementDate('2026-13-01'), false);
  assert.equal(validVisitAcknowledgementDate('02-11-2026'), false);
  assert.equal(validVisitAcknowledgementDate(''), false);
  assert.equal(validVisitAcknowledgementDate(null), false);
  assert.deepEqual(recordVisitAcknowledgement([], { ...first, date: '2026-02-29' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, signatureImage: 'data:image/png;base64,xxx', legalDocument: true, extra: 1 };
  const kept = recordVisitAcknowledgement([], raw);
  assert.equal(kept.length, 1);
  assert.equal('signatureImage' in kept[0], false);
  assert.equal('legalDocument' in kept[0], false);
  assert.equal('extra' in kept[0], false);
  assert.equal(raw.signatureImage, 'data:image/png;base64,xxx');
  assert.deepEqual(Object.keys(kept[0]).sort(), ['acknowledged', 'customer', 'date', 'followups', 'id', 'note', 'visitRef']);
});

test('duplicate ids and duplicate visit references are never rewritten', () => {
  const list = recordVisitAcknowledgement([], first);
  assert.deepEqual(recordVisitAcknowledgement(list, { ...first, note: 'Changed.' }), list);
  assert.deepEqual(
    recordVisitAcknowledgement(list, { ...second, id: 'VA-9', visitRef: 'v-101' }),
    list,
  );
  assert.equal(recordVisitAcknowledgement(list, second).length, 2);
});

test('find and remove', () => {
  const list = recordVisitAcknowledgement(recordVisitAcknowledgement([], first), second);
  assert.equal(findVisitAcknowledgement(list, 'VA-1')?.visitRef, 'V-101');
  assert.equal(findVisitAcknowledgement(list, 'VA-9'), null);
  assert.equal(findVisitAcknowledgement(list, ''), null);
  assert.deepEqual(removeVisitAcknowledgement(list, 'VA-1').map((item) => item.id), ['VA-2']);
  assert.deepEqual(removeVisitAcknowledgement(list, 'VA-9'), list);
  assert.deepEqual(removeVisitAcknowledgement(list, ''), list);
});

test('sorting is by date, then visit reference, then id', () => {
  const list = [first, second, third];
  assert.deepEqual(visitAcknowledgementSorted(list).map((item) => item.id), ['VA-3', 'VA-1', 'VA-2']);
  assert.deepEqual(visitAcknowledgementSorted('not a list'), []);
});

test('per-customer listing is case-insensitive and customers keep the first spelling', () => {
  const list = [first, second, third];
  assert.deepEqual(visitAcknowledgementsForCustomer(list, 'AHMED RAZA').map((item) => item.id), ['VA-3', 'VA-1']);
  assert.deepEqual(visitAcknowledgementsForCustomer(list, ''), []);
  assert.deepEqual(visitAcknowledgementCustomers(list), ['ahmed raza', 'Bilal Ahmed']);
  assert.deepEqual(visitAcknowledgementCustomers([]), []);
});

test('a visit shows its acknowledgement status', () => {
  const list = [first, second];
  assert.deepEqual(visitAcknowledgementStatus(list, 'V-101'), { visitRef: 'V-101', status: 'acknowledged' });
  assert.deepEqual(visitAcknowledgementStatus(list, 'v-102'), { visitRef: 'V-102', status: 'not acknowledged' });
  assert.deepEqual(visitAcknowledgementStatus(list, 'V-999'), { visitRef: 'V-999', status: 'no note recorded' });
  assert.equal(visitAcknowledgementStatus(list, ''), null);
  assert.equal(visitAcknowledgementStatus(list, null), null);
});

test('visits without acknowledgement are listed as exceptions', () => {
  const list = [first, second];
  assert.deepEqual(visitsWithoutAcknowledgement(list, ['V-101', 'V-102', 'V-103', 'v-102', '', null, 42]), [
    { visitRef: 'V-102', status: 'not acknowledged' },
    { visitRef: 'V-103', status: 'no note recorded' },
  ]);
  assert.deepEqual(visitsWithoutAcknowledgement(list, ['V-101']), []);
  assert.deepEqual(visitsWithoutAcknowledgement(list, []), []);
  assert.deepEqual(visitsWithoutAcknowledgement(list, 'not a list'), []);
  assert.deepEqual(visitsWithoutAcknowledgement([], ['V-101']), [
    { visitRef: 'V-101', status: 'no note recorded' },
  ]);
});

test('follow-up only: a note is never edited, only annotated', () => {
  const list = recordVisitAcknowledgement([], first);
  const noted = addVisitAcknowledgementFollowup(list, 'VA-1', '2026-11-04', 'Customer confirmed by phone that the work held.');
  assert.equal(noted.length, 1);
  assert.equal(noted[0].visitRef, 'V-101');
  assert.equal(noted[0].customer, 'Ahmed Raza');
  assert.equal(noted[0].date, '2026-11-02');
  assert.equal(noted[0].acknowledged, true);
  assert.equal(noted[0].note, first.note);
  assert.deepEqual(noted[0].followups, [{ date: '2026-11-04', note: 'Customer confirmed by phone that the work held.' }]);
  assert.deepEqual(addVisitAcknowledgementFollowup(list, 'VA-1', '2026-02-30', 'bad date'), list);
  assert.deepEqual(addVisitAcknowledgementFollowup(list, 'VA-9', '2026-11-04', 'unknown id'), list);
  assert.deepEqual(addVisitAcknowledgementFollowup(list, 'VA-1', '2026-11-04', ''), list);
});

test('summary and entry text name the visit, the customer, and the acknowledgement', () => {
  assert.equal(visitAcknowledgementSummaryText([]), 'No visit acknowledgement notes recorded.');
  assert.equal(visitAcknowledgementSummaryText([first]), '1 visit acknowledgement note: 1 acknowledged, 0 not acknowledged.');
  assert.equal(visitAcknowledgementSummaryText([first, second]), '2 visit acknowledgement notes: 1 acknowledged, 1 not acknowledged.');
  assert.equal(
    visitAcknowledgementText(first),
    'Visit V-101 (Ahmed Raza, 2026-11-02): acknowledged — Customer agreed the new drop cable was fitted and the signal was checked.',
  );
  assert.equal(
    visitAcknowledgementText(second),
    'Visit V-102 (Bilal Ahmed, 2026-11-03): not acknowledged — Customer was out; the neighbour was told the work would be finished tomorrow.',
  );
  assert.equal(visitAcknowledgementText({ ...first, customer: '' }), 'No visit acknowledgement note recorded.');
});

test('HTML is escaped', () => {
  const nasty = { ...first, customer: 'A & B', note: '<script>alert(1)</script>' };
  const html = visitAcknowledgementHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('A &amp; B'), true);
  assert.equal(visitAcknowledgementHtml({ ...first, customer: '' }), '<p>No visit acknowledgement note recorded.</p>');
});

test('CSV export and filename', () => {
  const csv = visitAcknowledgementCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '"id","visit reference","customer","date","acknowledged","note","follow-ups"');
  assert.equal(lines[1].includes('"V-101"'), true);
  assert.equal(lines[1].includes('"yes"'), true);
  assert.equal(lines[2].includes('"no"'), true);
  assert.equal(visitAcknowledgementCsv([]), '"id","visit reference","customer","date","acknowledged","note","follow-ups"');
  assert.equal(visitAcknowledgementFilename(), 'visit-acknowledgements.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, note: 'Changed.' }, { id: 'VA-9' }, null, 'nope', second];
  assert.deepEqual(normalizeVisitAcknowledgementList(messy).map((item) => item.id), ['VA-1', 'VA-2']);
  assert.deepEqual(normalizeVisitAcknowledgementList('not a list'), []);
  assert.deepEqual(normalizeVisitAcknowledgementList(undefined), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../visit-acknowledgement.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the visit feedback record and the second-visit rule are untouched', () => {
  const source = readFileSync(new URL('../visit-acknowledgement.js', import.meta.url), 'utf8');
  assert.equal(source.includes('visit-feedback'), false, 'module must not reference the visit feedback module');
  assert.equal(source.includes('second-visit'), false, 'module must not reference the second-visit rule module');
  assert.equal(existsSync(new URL('../visit-feedback.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../second-visit.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'vaHeading', 'vaSummary', 'vaList', 'vaExportBtn',
    'vaVisitRef', 'vaCustomer', 'vaDate', 'vaAcknowledged', 'vaNote', 'vaRecordBtn',
    'vaAnnotateId', 'vaAnnotateDate', 'vaAnnotateNote', 'vaAnnotateBtn',
    'vaRemoveId', 'vaRemoveBtn',
    'vaStatusRef', 'vaStatusBtn', 'vaStatusBody',
    'vaExceptionsInput', 'vaExceptionsBtn', 'vaExceptionsBody',
    'vaFilterCustomer', 'vaCustomerBtn', 'vaCustomerBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the visit acknowledgement panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './visit-acknowledgement.js'"), true);
  assert.equal(source.includes('renderVisitAcknowledgements()'), true);
  assert.equal(source.includes('VISIT_ACKNOWLEDGEMENT_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
