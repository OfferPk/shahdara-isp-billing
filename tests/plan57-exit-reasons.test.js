/**
 * plan57-exit-reasons.test.js — Plan 57: exit reason log and monthly
 * churn-reason view.
 * Pins:
 * - one exit record per departed customer (a second record replaces
 *   the first, never a second reason alongside it);
 * - the monthly view's counts match the recorded reasons on the same
 *   fixture, by reason and by mohalla (Plan T canonical aliases);
 * - a departed customer with no record shows as "reason not
 *   recorded", never as a guessed cause; an undated record belongs
 *   to no month;
 * - impossible dates (2026-02-30) and bad reasons are refused,
 *   never stored half-formed; recording a reason never alters the
 *   departed record (the module holds no bill, payment, lifecycle,
 *   or archive field, and inputs are never mutated);
 * - SISP-108 is neither read nor written: this module's records
 *   live in their own shape and store.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXIT_REASONS,
  EXIT_REASON_LABELS,
  validExitDate,
  validExitMonth,
  canonicalExitMohalla,
  normalizeExitRecord,
  normalizeExitRecordList,
  findExitRecord,
  upsertExitRecord,
  removeExitRecord,
  buildMonthlyExitView,
  exitSummaryText,
  exitHtml,
  exitCsv,
  exitFilename,
} from '../exit-reasons.js';

const RECORDS = [
  { customerId: 'c-1', customerName: 'Ayesha', mohalla: 'Bani', reason: 'price', recordedDate: '2026-10-05', note: 'too costly' },
  { customerId: 'c-2', customerName: 'Bilal', mohalla: 'Mohalla Kishti', reason: 'repeated_faults', recordedDate: '2026-10-12' },
  { customerId: 'c-3', customerName: 'Usman', mohalla: 'Chamyaa', reason: 'moving_house', recordedDate: '2026-10-20' },
  { customerId: 'c-4', customerName: 'Fatima', mohalla: 'Bani', reason: 'price', recordedDate: '2026-11-02' },
  { customerId: 'c-5', customerName: 'Hassan', mohalla: '', reason: 'service_quality' },
];

const DEPARTED = [
  { id: 'c-1', name: 'Ayesha', mohalla: 'Bani', archived: true },
  { id: 'c-2', name: 'Bilal', mohalla: 'Kishti', archived: true },
  { id: 'c-3', name: 'Usman', mohalla: 'Chamyaa', archived: true },
  { id: 'c-4', name: 'Fatima', mohalla: 'Bani', archived: true },
  { id: 'c-5', name: 'Hassan', mohalla: '', archived: true },
  { id: 'c-9', name: 'No Reason', mohalla: 'Bani', archived: true },
];

test('date and month validation accepts real dates and refuses impossible ones', () => {
  assert.equal(validExitDate('2026-10-05'), '2026-10-05');
  assert.equal(validExitDate('2024-02-29'), '2024-02-29');
  assert.equal(validExitDate('2026-02-30'), null);
  assert.equal(validExitDate('2026-13-01'), null);
  assert.equal(validExitDate('not-a-date'), null);
  assert.equal(validExitMonth('2026-10'), '2026-10');
  assert.equal(validExitMonth('2026-13'), null);
  assert.equal(validExitMonth('2026-10-05'), null);
});

test('half-formed records are refused and blanks become empty, never guesses', () => {
  assert.equal(normalizeExitRecord(null), null);
  assert.equal(normalizeExitRecord({ reason: 'price' }), null);
  assert.equal(normalizeExitRecord({ customerId: 'c-1', reason: 'mystery' }), null);
  assert.equal(normalizeExitRecord({ customerId: 'c-1', reason: 'price', recordedDate: '2026-02-30' }), null);
  assert.deepEqual(normalizeExitRecord({ customerId: 'c-1', reason: 'price' }), {
    customerId: 'c-1', customerName: '', mohalla: '', reason: 'price', note: '', recordedDate: null,
  });
});

test('canonical mohalla resolves Plan T aliases and leaves unknown areas alone', () => {
  assert.deepEqual(canonicalExitMohalla('Mohalla Bani'), { key: 'BANII', label: 'BANII' });
  assert.deepEqual(canonicalExitMohalla('kishti'), { key: 'KISHTII', label: 'KISHTII' });
  assert.deepEqual(canonicalExitMohalla('CHAMYAAA'), { key: 'CHAMYAAA', label: 'CHAMYAAA' });
  assert.deepEqual(canonicalExitMohalla(''), { key: '__unassigned__', label: 'Unassigned' });
  assert.equal(canonicalExitMohalla('New Town').label, 'New Town');
});

test('one record per customer: upsert replaces, remove drops, find locates', () => {
  const replaced = upsertExitRecord(RECORDS, { customerId: 'c-1', reason: 'competitor', recordedDate: '2026-10-06' });
  assert.equal(replaced.filter((r) => r.customerId === 'c-1').length, 1);
  assert.equal(findExitRecord(replaced, 'c-1').reason, 'competitor');
  assert.equal(upsertExitRecord(RECORDS, { customerId: 'c-1', reason: 'mystery' }).length, RECORDS.length);
  assert.equal(removeExitRecord(RECORDS, 'c-2').find((r) => r.customerId === 'c-2'), undefined);
  assert.equal(findExitRecord(RECORDS, 'c-2').reason, 'repeated_faults');
  assert.equal(findExitRecord(RECORDS, 'missing'), null);
  const deduped = normalizeExitRecordList([...RECORDS, { customerId: 'c-1', reason: 'other', recordedDate: '2026-10-07' }]);
  assert.equal(deduped.filter((r) => r.customerId === 'c-1').length, 1);
  assert.equal(deduped.find((r) => r.customerId === 'c-1').reason, 'other');
});

test('monthly view counts match the fixture by reason and by mohalla', () => {
  const view = buildMonthlyExitView(RECORDS, DEPARTED, '2026-10');
  assert.equal(view.month, '2026-10');
  assert.equal(view.totals.total, 3);
  assert.equal(view.totals.price, 1);
  assert.equal(view.totals.repeated_faults, 1);
  assert.equal(view.totals.moving_house, 1);
  assert.equal(view.totals.competitor, 0);
  assert.equal(view.byReason.find((r) => r.reason === 'price').count, 1);
  const banii = view.byMohalla.find((r) => r.name === 'BANII');
  const kishtii = view.byMohalla.find((r) => r.name === 'KISHTII');
  const chamyaaa = view.byMohalla.find((r) => r.name === 'CHAMYAAA');
  assert.equal(banii.total, 1);
  assert.equal(banii.price, 1);
  assert.equal(kishtii.total, 1);
  assert.equal(kishtii.repeated_faults, 1);
  assert.equal(chamyaaa.total, 1);
  assert.equal(chamyaaa.moving_house, 1);
  assert.equal(view.monthRecords.length, 3);
  // November holds only Fatima; the undated Hassan record belongs to no month.
  const november = buildMonthlyExitView(RECORDS, DEPARTED, '2026-11');
  assert.equal(november.totals.total, 1);
  assert.equal(november.totals.price, 1);
  assert.equal(view.undatedRecords, 1);
  assert.equal(view.allRecords, 5);
  assert.equal(buildMonthlyExitView(RECORDS, DEPARTED, 'bad-month'), null);
});

test('departed customers with no record show as reason not recorded, never guessed', () => {
  const view = buildMonthlyExitView(RECORDS, DEPARTED, '2026-10');
  assert.equal(view.noReason.total, 1);
  assert.equal(view.noReason.customers[0].customerId, 'c-9');
  assert.equal(view.noReason.customers[0].mohalla, 'BANII');
  const allRecorded = buildMonthlyExitView(RECORDS, DEPARTED.filter((c) => c.id !== 'c-9'), '2026-10');
  assert.equal(allRecorded.noReason.total, 0);
});

test('inputs are never mutated and records hold no money or lifecycle field', () => {
  const before = JSON.stringify(RECORDS);
  buildMonthlyExitView(RECORDS, DEPARTED, '2026-10');
  upsertExitRecord(RECORDS, { customerId: 'c-1', reason: 'other' });
  assert.equal(JSON.stringify(RECORDS), before);
  for (const record of normalizeExitRecordList(RECORDS)) {
    assert.deepEqual(Object.keys(record).sort(), ['customerId', 'customerName', 'mohalla', 'note', 'reason', 'recordedDate']);
  }
  assert.ok(EXIT_REASONS.includes('repeated_faults'));
  assert.ok(EXIT_REASONS.includes('service_quality'));
  assert.equal(EXIT_REASON_LABELS.price, 'Price too high');
});

test('summary, HTML escaping, CSV quoting, and filename are honest', () => {
  const view = buildMonthlyExitView(RECORDS, DEPARTED, '2026-10');
  assert.match(exitSummaryText(view), /2026-10: 3 exit\(s\) recorded/);
  assert.match(exitSummaryText(view), /1 departed customer\(s\) with no reason recorded/);
  const nasty = buildMonthlyExitView(
    [{ customerId: 'c-x', customerName: '<b>Ana</b>', mohalla: 'Bani', reason: 'other', recordedDate: '2026-10-01', note: 'a,"b"' }],
    [],
    '2026-10',
  );
  assert.ok(!exitHtml(nasty).includes('<b>Ana</b>'));
  assert.ok(exitHtml(nasty).includes('&lt;b&gt;Ana&lt;/b&gt;'));
  assert.ok(exitHtml(nasty).includes('&quot;b&quot;'));
  const comma = buildMonthlyExitView(
    [{ customerId: 'c-y', customerName: 'Ana, B', mohalla: 'Bani', reason: 'other', recordedDate: '2026-10-01' }],
    [],
    '2026-10',
  );
  assert.ok(exitCsv(comma).includes('"Ana, B"'));
  assert.equal(exitFilename('2026-10'), 'exit-reasons-2026-10.csv');
  assert.equal(exitFilename('bad'), 'exit-reasons-all.csv');
  assert.equal(exitSummaryText(null), 'No exit view.');
  assert.equal(exitHtml(null), '<p style="font-size: 12px;">No exit view for this month.</p>');
  assert.equal(exitCsv(null), '');
});
