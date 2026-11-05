import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  isStrictWadaDate,
  wadaWeekdayName,
  formatWadaDate,
  normalizeWadaRecord,
  normalizeWadaRecordList,
  findWadaRecord,
  recordWadaRecord,
  removeWadaRecord,
  markWadaRecordKept,
  markWadaRecordBroken,
  wadaRecordsSorted,
  wadaRecordsForCustomer,
  activeWadaRecordsForCustomer,
  wadaRecordBannerState,
  wadaHealthForCustomer,
  wadaHealthText,
  wadaRecordText,
  wadaRecordHtml,
  wadaBannerHtml,
  wadaHistoryHtml,
  wadaRecordCsv,
  wadaRecordFilename,
} from '../wada-record.js';

// Generic fixtures only — no real customer names are used anywhere
// in this file. The user's four example wadas informed the shape
// (an amount promised for the next bill; a date-only promise), never
// the test data.
const first = {
  id: 'WD-1',
  customer: 'CUST-1',
  promisedDate: '2026-11-07',
  amountPromised: 100,
  note: 'in next bill',
  status: 'pending',
  closedDate: ''
};
const second = {
  id: 'WD-2',
  customer: 'CUST-1',
  promisedDate: '2026-11-10',
  amountPromised: null,
  note: '',
  status: 'pending',
  closedDate: ''
};
const third = {
  id: 'WD-3',
  customer: 'CUST-2',
  promisedDate: '2026-11-05',
  amountPromised: 500,
  note: 'pay after salary',
  status: 'pending',
  closedDate: ''
};
const kept = {
  id: 'WD-4',
  customer: 'CUST-1',
  promisedDate: '2026-11-03',
  amountPromised: 200,
  note: '',
  status: 'kept',
  closedDate: '2026-11-02'
};
const keptLate = {
  id: 'WD-5',
  customer: 'CUST-1',
  promisedDate: '2026-11-03',
  amountPromised: null,
  note: '',
  status: 'keptLate',
  closedDate: '2026-11-05'
};
const broken = {
  id: 'WD-6',
  customer: 'CUST-1',
  promisedDate: '2026-11-03',
  amountPromised: 300,
  note: '',
  status: 'broken',
  closedDate: '2026-11-06'
};
const fixture = [second, kept, first, broken, third, keptLate];

test('strict dates: real calendar, leap-aware', () => {
  assert.equal(isStrictWadaDate('2026-11-07'), true);
  assert.equal(isStrictWadaDate('2024-02-29'), true);
  assert.equal(isStrictWadaDate('2025-02-29'), false);
  assert.equal(isStrictWadaDate('2026-11-31'), false);
  assert.equal(isStrictWadaDate('2026-13-01'), false);
  assert.equal(isStrictWadaDate('2026-00-10'), false);
  assert.equal(isStrictWadaDate('2026-11-00'), false);
  assert.equal(isStrictWadaDate('07-11-2026'), false);
  assert.equal(isStrictWadaDate(''), false);
  assert.equal(isStrictWadaDate(null), false);
  assert.equal(isStrictWadaDate(20261107), false);
});

test('weekday comes from the calendar alone, never a clock', () => {
  // The confusion that motivated this polish: 7 Nov 2026 is a
  // Saturday, Monday is the 9th, Tuesday is the 10th.
  assert.equal(wadaWeekdayName('2026-11-07'), 'Saturday');
  assert.equal(wadaWeekdayName('2026-11-09'), 'Monday');
  assert.equal(wadaWeekdayName('2026-11-10'), 'Tuesday');
  assert.equal(wadaWeekdayName('2024-02-29'), 'Thursday');
  assert.equal(wadaWeekdayName('2000-01-01'), 'Saturday');
  assert.equal(wadaWeekdayName('2025-02-29'), null);
  assert.equal(wadaWeekdayName(''), null);
  assert.equal(formatWadaDate('2026-11-07'), '7 Nov 2026 — Saturday');
  assert.equal(formatWadaDate('2026-11-10'), '10 Nov 2026 — Tuesday');
  assert.equal(formatWadaDate('2025-02-29'), '');
});

test('half-formed wadas are refused', () => {
  assert.equal(normalizeWadaRecord(null), null);
  assert.equal(normalizeWadaRecord([]), null);
  assert.equal(normalizeWadaRecord({ ...first, id: '  ' }), null);
  assert.equal(normalizeWadaRecord({ ...first, customer: '' }), null);
  assert.equal(normalizeWadaRecord({ ...first, promisedDate: '2026-11-31' }), null);
  assert.equal(normalizeWadaRecord({ ...first, promisedDate: '2025-02-29' }), null);
  assert.equal(normalizeWadaRecord({ ...first, amountPromised: 100.5 }), null);
  assert.equal(normalizeWadaRecord({ ...first, amountPromised: '100.5' }), null);
  assert.equal(normalizeWadaRecord({ ...first, amountPromised: 0 }), null);
  assert.equal(normalizeWadaRecord({ ...first, amountPromised: -50 }), null);
  assert.equal(normalizeWadaRecord({ ...first, amountPromised: 'abc' }), null);
  assert.equal(normalizeWadaRecord({ ...kept, closedDate: '' }), null);
  assert.equal(normalizeWadaRecord({ ...first, closedDate: '2026-11-05' }), null);
});

test('amount is optional, and digit strings fold to whole rupees', () => {
  assert.equal(normalizeWadaRecord({ ...first, amountPromised: null }).amountPromised, null);
  assert.equal(normalizeWadaRecord({ ...first, amountPromised: '' }).amountPromised, null);
  assert.equal(normalizeWadaRecord({ ...first, amountPromised: undefined }).amountPromised, null);
  assert.equal(normalizeWadaRecord({ ...first, amountPromised: '100' }).amountPromised, 100);
  assert.equal(normalizeWadaRecord(second).amountPromised, null);
  assert.equal(normalizeWadaRecord(second).status, 'pending');
  assert.equal(normalizeWadaRecord({ ...first, status: 'unclear' }).status, 'pending');
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = {
    ...first,
    billId: 'B-9',
    paymentId: 'P-9',
    customerStatus: 'suspended',
    balanceDue: 3000,
    extra: 'drop me'
  };
  const before = JSON.stringify(raw);
  const normalized = normalizeWadaRecord(raw);
  assert.equal('billId' in normalized, false);
  assert.equal('paymentId' in normalized, false);
  assert.equal('customerStatus' in normalized, false);
  assert.equal('balanceDue' in normalized, false);
  assert.equal('extra' in normalized, false);
  assert.equal(JSON.stringify(raw), before);
  const listBefore = JSON.stringify(fixture);
  recordWadaRecord(fixture, { id: 'WD-7', customer: 'CUST-3', promisedDate: '2026-11-12', amountPromised: 50, note: '', status: 'pending', closedDate: '' });
  assert.equal(JSON.stringify(fixture), listBefore);
});

test('duplicate ids are never rewritten', () => {
  const next = recordWadaRecord(fixture, { ...first, amountPromised: 999, note: 'changed' });
  assert.equal(next.length, fixture.length);
  assert.equal(findWadaRecord(next, 'WD-1').amountPromised, 100);
  assert.equal(findWadaRecord(next, 'WD-1').note, 'in next bill');
  assert.equal(recordWadaRecord(fixture, { ...first, id: 'WD-9' }).length, fixture.length + 1);
});

test('find and remove', () => {
  assert.equal(findWadaRecord(fixture, 'WD-2').promisedDate, '2026-11-10');
  assert.equal(findWadaRecord(fixture, 'WD-99'), null);
  assert.equal(findWadaRecord(fixture, ''), null);
  assert.equal(removeWadaRecord(fixture, 'WD-3').length, fixture.length - 1);
  assert.equal(removeWadaRecord(fixture, 'WD-99').length, fixture.length);
  assert.equal(removeWadaRecord(fixture, '').length, fixture.length);
});

test('mark kept: on or before the date is kept, after it is kept late', () => {
  const onDate = markWadaRecordKept([first], 'WD-1', '2026-11-07');
  assert.equal(onDate[0].status, 'kept');
  assert.equal(onDate[0].closedDate, '2026-11-07');
  const early = markWadaRecordKept([first], 'WD-1', '2026-11-05');
  assert.equal(early[0].status, 'kept');
  const late = markWadaRecordKept([first], 'WD-1', '2026-11-08');
  assert.equal(late[0].status, 'keptLate');
  assert.equal(late[0].closedDate, '2026-11-08');
  // Already closed, bad date, or unknown id: list unchanged.
  assert.deepEqual(markWadaRecordKept([kept], 'WD-4', '2026-11-09'), [kept]);
  assert.deepEqual(markWadaRecordKept([first], 'WD-1', '2026-11-31'), [first]);
  assert.deepEqual(markWadaRecordKept([first], 'WD-1', ''), [first]);
  assert.deepEqual(markWadaRecordKept([first], 'WD-99', '2026-11-07'), [first]);
});

test('mark broken: only a pending wada can be marked broken', () => {
  const next = markWadaRecordBroken([first], 'WD-1', '2026-11-09');
  assert.equal(next[0].status, 'broken');
  assert.equal(next[0].closedDate, '2026-11-09');
  assert.deepEqual(markWadaRecordBroken([kept], 'WD-4', '2026-11-09'), [kept]);
  assert.deepEqual(markWadaRecordBroken([first], 'WD-1', 'bad-date'), [first]);
});

test('per-customer listing sorts earliest due date first', () => {
  const mine = wadaRecordsForCustomer(fixture, 'CUST-1');
  assert.deepEqual(mine.map((row) => row.id), ['WD-4', 'WD-5', 'WD-6', 'WD-1', 'WD-2']);
  assert.deepEqual(wadaRecordsForCustomer(fixture, 'cust-1').map((row) => row.id), ['WD-4', 'WD-5', 'WD-6', 'WD-1', 'WD-2']);
  assert.deepEqual(wadaRecordsForCustomer(fixture, 'CUST-2').map((row) => row.id), ['WD-3']);
  assert.deepEqual(wadaRecordsForCustomer(fixture, 'CUST-9'), []);
  assert.deepEqual(wadaRecordsForCustomer(fixture, ''), []);
  assert.deepEqual(wadaRecordsSorted(fixture).map((row) => row.id), ['WD-4', 'WD-5', 'WD-6', 'WD-3', 'WD-1', 'WD-2']);
});

test('active wadas are pending only, earliest due first', () => {
  assert.deepEqual(activeWadaRecordsForCustomer(fixture, 'CUST-1').map((row) => row.id), ['WD-1', 'WD-2']);
  assert.deepEqual(activeWadaRecordsForCustomer(fixture, 'CUST-2').map((row) => row.id), ['WD-3']);
});

test('banner state: on track today or later, overdue once the date passes', () => {
  assert.equal(wadaRecordBannerState(first, '2026-11-05'), 'onTrack');
  assert.equal(wadaRecordBannerState(first, '2026-11-07'), 'onTrack');
  assert.equal(wadaRecordBannerState(first, '2026-11-08'), 'overdue');
  assert.equal(wadaRecordBannerState(kept, '2026-11-05'), '');
  assert.equal(wadaRecordBannerState(broken, '2026-11-05'), '');
  assert.equal(wadaRecordBannerState(first, 'bad-date'), 'onTrack');
  assert.equal(wadaRecordBannerState(null, '2026-11-05'), '');
});

test('wada health: counts only, plain words, no scores or percentages', () => {
  assert.deepEqual(wadaHealthForCustomer(fixture, 'CUST-1'), { kept: 1, keptLate: 1, broken: 1, pending: 2, total: 5 });
  assert.deepEqual(wadaHealthForCustomer(fixture, 'CUST-2'), { kept: 0, keptLate: 0, broken: 0, pending: 1, total: 1 });
  assert.deepEqual(wadaHealthForCustomer(fixture, 'CUST-9'), { kept: 0, keptLate: 0, broken: 0, pending: 0, total: 0 });
  const text = wadaHealthText(fixture, 'CUST-1');
  assert.equal(text, 'Wada health: 1 kept on time · 1 kept late · 1 broken · 2 still open.');
  assert.equal(text.includes('%'), false);
  assert.equal(text.toLowerCase().includes('score'), false);
  assert.equal(wadaHealthText(fixture, 'CUST-9'), 'No wadas recorded for this customer.');
});

test('entry text names the outcome and the weekday', () => {
  assert.equal(wadaRecordText(first, '2026-11-05'), 'Rs 100 promised by 7 Nov 2026 — Saturday — “in next bill”.');
  assert.equal(wadaRecordText(first, '2026-11-08'), 'Rs 100 promised by 7 Nov 2026 — Saturday — overdue — “in next bill”.');
  assert.equal(wadaRecordText(second, '2026-11-05'), 'promised by 10 Nov 2026 — Tuesday.');
  assert.equal(wadaRecordText(kept, '2026-11-05'), 'Rs 200 promised by 3 Nov 2026 — Tuesday — kept on 2026-11-02.');
  assert.equal(wadaRecordText(keptLate, '2026-11-05'), 'promised by 3 Nov 2026 — Tuesday — kept late on 2026-11-05.');
  assert.equal(wadaRecordText(broken, '2026-11-05'), 'Rs 300 promised by 3 Nov 2026 — Tuesday — broken.');
  assert.equal(wadaRecordText(null, '2026-11-05'), '');
});

test('entry html escapes markup', () => {
  const html = wadaRecordHtml({ ...first, note: '<script>alert(1)</script>' }, '2026-11-05');
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('7 Nov 2026 — Saturday'), true);
  assert.equal(html.includes('wada-banner-on-track'), true);
  assert.equal(wadaRecordHtml({ ...first }, '2026-11-08').includes('wada-banner-overdue'), true);
  assert.equal(wadaRecordHtml(null, '2026-11-05'), '');
});

test('banner html shows only open wadas with close actions and weekday', () => {
  const html = wadaBannerHtml(fixture, '2026-11-05');
  assert.equal(html.includes('data-wada-kept="WD-1"'), true);
  assert.equal(html.includes('data-wada-broken="WD-1"'), true);
  assert.equal(html.includes('data-wada-kept="WD-2"'), true);
  assert.equal(html.includes('data-wada-kept="WD-4"'), false);
  assert.equal(html.includes('data-wada-kept="WD-6"'), false);
  assert.equal(html.includes('7 Nov 2026 — Saturday'), true);
  assert.equal(html.includes('10 Nov 2026 — Tuesday'), true);
  assert.equal(wadaBannerHtml([kept, broken], '2026-11-05'), '');
  assert.equal(wadaBannerHtml([], '2026-11-05'), '');
});

test('history html shows closed wadas with outcomes and remove actions', () => {
  const html = wadaHistoryHtml(fixture, '2026-11-05');
  assert.equal(html.includes('kept on 2026-11-02'), true);
  assert.equal(html.includes('kept late on 2026-11-05'), true);
  assert.equal(html.includes('broken'), true);
  assert.equal(html.includes('data-wada-remove="WD-4"'), true);
  assert.equal(html.includes('data-wada-remove="WD-1"'), false);
  assert.equal(wadaHistoryHtml([first, second], '2026-11-05'), '');
});

test('csv export and filename', () => {
  const csv = wadaRecordCsv(fixture);
  assert.equal(csv.split('\n')[0], 'id,customer,promised_date,amount_promised,note,status,closed_date');
  assert.equal(csv.includes('WD-1,CUST-1,2026-11-07,100,in next bill,pending,'), true);
  assert.equal(csv.includes('WD-2,CUST-1,2026-11-10,,,pending,'), true);
  assert.equal(csv.includes('WD-5,CUST-1,2026-11-03,,,keptLate,2026-11-05'), true);
  assert.equal(wadaRecordFilename(), 'wada-records.csv');
});

test('list normalisation drops invalid rows and keeps the first id', () => {
  const list = normalizeWadaRecordList([
    first,
    { ...first, note: 'second copy' },
    { ...first, id: 'WD-1' },
    { id: '', customer: 'CUST-1', promisedDate: '2026-11-07' },
    null,
    second
  ]);
  assert.deepEqual(list.map((row) => row.id), ['WD-1', 'WD-2']);
  assert.equal(list[0].note, 'in next bill');
  assert.deepEqual(normalizeWadaRecordList(null), []);
  assert.deepEqual(normalizeWadaRecordList('nope'), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../wada-record.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: existing promise stores are never touched', () => {
  const source = readFileSync(new URL('../wada-record.js', import.meta.url), 'utf8');
  assert.equal(source.includes('collection-promise.js'), false, 'module must not reference the promise-history file');
  assert.equal(source.includes('promise-tracker.js'), false, 'module must not reference the operator promise tracker file');
  assert.equal(source.includes('promise-delivery-check.js'), false, 'module must not reference the delivery-check file');
  assert.equal(source.includes('waada-queue.js'), false, 'module must not reference the live-waada file');
  assert.equal(source.includes('shahdara_collection_promises_v1'), false, 'module must not touch the promise-history store');
  assert.equal(source.includes('setCustomerWaada'), false, 'module must not write the live waada');
  assert.equal(source.includes('computeWaadaScore'), false, 'module must not reuse the score derivation');
  assert.equal(existsSync(new URL('../collection-promise.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../promise-tracker.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../promise-delivery-check.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../waada-queue.js', import.meta.url)), true);
});

test('wiring: profile banner sits at the top of the profile view', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(app.includes('wada-record.js'), true, 'module must be imported');
  assert.equal(app.includes("const WADA_RECORD_KEY = 'shahdara_wada_records_v1'"), true);
  assert.equal(app.includes('${wadaProfileBannerHtml(customer)}${profileInfoGroupsHtml}'), true, 'banner must render before the profile info groups');
  for (const id of ['wadaQuickDate', 'wadaQuickAmount', 'wadaQuickNote', 'wadaQuickSaveBtn']) {
    assert.equal(app.includes(`id="${id}"`), true, `missing ${id}`);
  }
  assert.equal(app.includes('data-wada-kept'), true);
  assert.equal(app.includes('data-wada-broken'), true);
  assert.equal(app.includes('data-wada-remove'), true);
  assert.equal(app.includes('markWadaRecordKept'), true);
  assert.equal(app.includes('markWadaRecordBroken'), true);
});

test('wiring: search result cards carry Add Payment and Add Wada', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(app.includes('data-global-add-payment'), true);
  assert.equal(app.includes('data-global-add-wada'), true);
  assert.equal(app.includes('global-result-actions'), true);
  assert.equal(app.includes('quickCollectModalController?.selectAndOpen'), true, 'Add Payment must open the existing payment flow');
  assert.equal(app.includes('pendingWadaQuickAddCustomerId'), true, 'Add Wada must open the profile quick-add for that customer');
});

test('wiring: banner and search-action styles exist', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  for (const rule of ['.profile-wada-banner', '.wada-banner-on-track', '.wada-banner-overdue', '.wada-quick-form', '.global-result-actions', '.global-result-action']) {
    assert.equal(styles.includes(rule), true, `missing ${rule}`);
  }
});

test('deployment guard: no standalone OLT word in app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
