import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validLoyaltyDate,
  addLoyaltyYears,
  fullLoyaltyYears,
  fullLoyaltyMonths,
  continuousStartDate,
  latestServicePeriod,
  tenureFor,
  normalizeMilestoneYears,
  standingLabel,
  buildRecognitionList,
  canonicalRecognitionMohalla,
  filterRecognitionByMohalla,
  thankYouDraft,
  normalizeThankYouSend,
  normalizeThankYouSendList,
  upsertThankYouSend,
  removeThankYouSend,
  sendsForCustomer,
  normalizeRestart,
  normalizeRestartList,
  upsertRestart,
  removeRestart,
  restartDateFor,
  recognitionSummaryText,
  recognitionHtml,
  recognitionCsv,
  recognitionFilename,
} from '../loyalty-recognition.js';

const A = { id: 'C1', name: 'Ayesha', mohalla: 'Bani', connectionDate: '2023-11-04' };
const B = { id: 'C2', name: 'Bilal', mohalla: 'Kishti', connectionDate: '2025-11-05' };
const C = { id: 'C3', name: 'Chandni', mohalla: 'Gangall', connectionDate: '2022-01-15' };

test('strict dates refuse impossible and malformed dates', () => {
  assert.equal(validLoyaltyDate('2026-02-30'), null);
  assert.equal(validLoyaltyDate('2026-13-01'), null);
  assert.equal(validLoyaltyDate('2026-11-4'), null);
  assert.equal(validLoyaltyDate('04-11-2026'), null);
  assert.equal(validLoyaltyDate('2024-02-29'), '2024-02-29');
  assert.equal(validLoyaltyDate(' 2023-11-04 '), '2023-11-04');
});

test('full years are anniversary-based, one day short is not a full year', () => {
  assert.equal(fullLoyaltyYears('2023-11-04', '2026-11-03'), 2);
  assert.equal(fullLoyaltyYears('2023-11-04', '2026-11-04'), 3);
  assert.equal(fullLoyaltyMonths('2023-11-04', '2026-11-03'), 35);
  assert.equal(fullLoyaltyMonths('2023-11-04', '2026-11-04'), 36);
});

test('29 February anniversaries clamp to 28 February', () => {
  assert.equal(addLoyaltyYears('2024-02-29', 1), '2025-02-28');
  assert.equal(addLoyaltyYears('2024-02-29', 4), '2028-02-29');
  assert.equal(fullLoyaltyYears('2024-02-29', '2025-02-28'), 1);
});

test('tenure uses the latest continuous period, not the original connection', () => {
  const lapsed = {
    id: 'C9', name: 'Lapsed', mohalla: 'Bani', connectionDate: '2020-01-10',
    periods: [
      { start: '2020-01-10', end: '2024-06-30' },
      { start: '2025-05-01', end: null },
    ],
  };
  assert.equal(continuousStartDate(lapsed), '2025-05-01');
  const tenure = tenureFor(lapsed, '2026-11-04');
  assert.equal(tenure.status, 'current');
  assert.equal(tenure.fullYears, 1);
  assert.equal(tenure.start, '2025-05-01');
});

test('a recorded restart date beats the connection date', () => {
  const restarted = { id: 'C8', name: 'Restarted', connectionDate: '2021-03-01', restartDate: '2024-11-04' };
  assert.equal(continuousStartDate(restarted), '2024-11-04');
  assert.equal(tenureFor(restarted, '2026-11-04').fullYears, 2);
});

test('latest period helper picks the latest start', () => {
  const customer = {
    id: 'C7', periods: [{ start: '2021-01-01', end: '2022-01-01' }, { start: '2023-06-01', end: null }],
  };
  assert.deepEqual(latestServicePeriod(customer), { start: '2023-06-01', end: null });
  assert.equal(latestServicePeriod({ id: 'C6' }), null);
});

test('ended, future, and dateless customers are never current', () => {
  const ended = { id: 'C5', name: 'Ended', connectionDate: '2020-01-01', periods: [{ start: '2020-01-01', end: '2023-01-01' }] };
  assert.equal(tenureFor(ended, '2026-11-04').status, 'ended');
  assert.equal(tenureFor({ id: 'C4', name: 'Future', connectionDate: '2027-01-01' }, '2026-11-04').status, 'future');
  assert.equal(tenureFor({ id: 'C3', name: 'Dateless' }, '2026-11-04').status, 'no-date');
  assert.equal(tenureFor(null, '2026-11-04'), null);
  assert.equal(tenureFor(A, 'not-a-date'), null);
});

test('recognition list holds exactly the milestone customers, longest first', () => {
  const rows = buildRecognitionList([A, B, C], { asOf: '2026-11-04', milestoneYears: 1 });
  assert.deepEqual(rows.map((row) => row.customerId), ['C3', 'C1']);
  assert.equal(rows[0].fullYears, 4);
  assert.equal(rows[0].nextAnniversary, '2027-01-15');
  assert.equal(rows[1].fullYears, 3);
  assert.equal(rows[1].isAnniversaryToday, true);
  assert.equal(rows[1].standing, 'No bills recorded');
});

test('operator milestone is honoured and unusable milestones fall back to one year', () => {
  assert.equal(normalizeMilestoneYears(3), 3);
  assert.equal(normalizeMilestoneYears(0), 1);
  assert.equal(normalizeMilestoneYears(-2), 1);
  assert.equal(normalizeMilestoneYears(2.5), 1);
  assert.equal(normalizeMilestoneYears('three'), 1);
  const rows = buildRecognitionList([A, B, C], { asOf: '2026-11-04', milestoneYears: 4 });
  assert.deepEqual(rows.map((row) => row.customerId), ['C3']);
});

test('same fixture date is used for every row', () => {
  const rows = buildRecognitionList([A, B], { asOf: '2024-11-03', milestoneYears: 1 });
  assert.deepEqual(rows.map((row) => row.customerId), []);
  const later = buildRecognitionList([A, B], { asOf: '2024-11-04', milestoneYears: 1 });
  assert.deepEqual(later.map((row) => row.customerId), ['C1']);
});

test('payment standing comes only from caller-supplied counts', () => {
  assert.equal(standingLabel({ billsCount: 5, paidInFullCount: 5, outstandingCount: 0 }), 'All bills paid in full');
  assert.equal(standingLabel({ billsCount: 5, paidInFullCount: 3, outstandingCount: 2 }), '2 bills still outstanding');
  assert.equal(standingLabel({ billsCount: 1, paidInFullCount: 0, outstandingCount: 1 }), '1 bill still outstanding');
  assert.equal(standingLabel({ billsCount: 2, paidInFullCount: 0, outstandingCount: 0 }), 'Bills recorded');
  assert.equal(standingLabel(undefined), 'No bills recorded');
  const rows = buildRecognitionList([A], {
    asOf: '2026-11-04',
    standings: [{ customerId: 'C1', billsCount: 12, paidInFullCount: 12, outstandingCount: 0 }],
  });
  assert.equal(rows[0].standing, 'All bills paid in full');
});

test('mohalla filter folds aliases and blank keeps all', () => {
  assert.equal(canonicalRecognitionMohalla('bani'), 'BANII');
  assert.equal(canonicalRecognitionMohalla('Mohalla Kishti'), 'KISHTII');
  assert.equal(canonicalRecognitionMohalla('chamyaa'), 'CHAMYAAA');
  assert.equal(canonicalRecognitionMohalla(''), null);
  const rows = buildRecognitionList([A, C], { asOf: '2026-11-04' });
  assert.deepEqual(filterRecognitionByMohalla(rows, 'bani').map((row) => row.customerId), ['C1']);
  assert.equal(filterRecognitionByMohalla(rows, '').length, 2);
});

test('thank-you drafts are bilingual, name the years, and promise nothing', () => {
  const row = { customerId: 'C1', customerName: 'Ayesha', fullYears: 3 };
  const roman = thankYouDraft(row, 'roman');
  assert.match(roman, /Ayesha/);
  assert.match(roman, /3 saal/);
  assert.doesNotMatch(roman, /discount|offer|free|%|Rs\./i);
  const urdu = thankYouDraft(row, 'urdu');
  assert.match(urdu, /آپ 3 سال سے/);
  assert.equal(thankYouDraft({ customerId: 'C1', fullYears: 0 }), '');
  assert.equal(thankYouDraft(null), '');
});

test('send log refuses half-formed sends and non-WhatsApp channels', () => {
  assert.equal(normalizeThankYouSend({ id: '', customer: 'C1', date: '2026-11-04', channel: 'whatsapp' }), null);
  assert.equal(normalizeThankYouSend({ id: 'S1', customer: 'C1', date: '2026-02-30', channel: 'whatsapp' }), null);
  assert.equal(normalizeThankYouSend({ id: 'S1', customer: 'C1', date: '2026-11-04', channel: 'sms' }), null);
  assert.equal(normalizeThankYouSend({ id: 'S1', customer: 'C1', date: '2026-11-04', channel: 'whatsapp', variant: 'french' }), null);
  assert.deepEqual(
    normalizeThankYouSend({ id: 'S1', customer: 'C1', customerName: 'Ayesha', date: '2026-11-04', channel: 'whatsapp', variant: 'urdu', billId: 'B1' }),
    { id: 'S1', customer: 'C1', customerName: 'Ayesha', date: '2026-11-04', channel: 'whatsapp', variant: 'urdu' },
  );
});

test('send log upsert, remove, and per-customer ordering', () => {
  const first = upsertThankYouSend([], { id: 'S1', customer: 'C1', date: '2026-11-04', channel: 'whatsapp' });
  const second = upsertThankYouSend(first, { id: 'S2', customer: 'C1', date: '2025-11-04', channel: 'whatsapp' });
  assert.deepEqual(sendsForCustomer(second, 'C1').map((send) => send.id), ['S1', 'S2']);
  assert.equal(sendsForCustomer(second, 'C2').length, 0);
  assert.deepEqual(removeThankYouSend(second, 'S1').map((send) => send.id), ['S2']);
  assert.deepEqual(upsertThankYouSend(second, { id: 'S3', customer: '', date: '2026-11-04', channel: 'whatsapp' }), second);
  assert.deepEqual(normalizeThankYouSendList([{ id: 'S1', customer: 'C1', date: '2026-11-04', channel: 'whatsapp' }, { id: 'S1', customer: 'C1', date: '2026-11-05', channel: 'whatsapp' }]).length, 1);
});

test('restart records are one per customer and refuse bad dates', () => {
  assert.equal(normalizeRestart({ customer: '', restartDate: '2024-11-04' }), null);
  assert.equal(normalizeRestart({ customer: 'C1', restartDate: '2024-02-30' }), null);
  assert.deepEqual(normalizeRestart({ customer: 'C1', restartDate: '2024-11-04', note: 'x' }), { customer: 'C1', restartDate: '2024-11-04' });
  const list = upsertRestart([], { customer: 'C1', restartDate: '2024-11-04' });
  const replaced = upsertRestart(list, { customer: 'C1', restartDate: '2025-01-15' });
  assert.equal(replaced.length, 1);
  assert.equal(restartDateFor(replaced, 'C1'), '2025-01-15');
  assert.equal(restartDateFor(replaced, 'C2'), null);
  assert.deepEqual(removeRestart(replaced, 'C1'), []);
  assert.deepEqual(normalizeRestartList([{ customer: 'C1', restartDate: '2024-11-04' }, { customer: 'C1', restartDate: '2025-01-15' }]).length, 1);
});

test('summary, HTML escaping, CSV quoting, and filename', () => {
  assert.equal(recognitionSummaryText([], 1), 'No customer has reached 1 full year of continuous service yet.');
  const rows = buildRecognitionList([A], { asOf: '2026-11-04' });
  assert.match(recognitionSummaryText(rows, 1), /1 loyal customer/);
  const tricky = [{ ...rows[0], customerName: 'A <b>& "Q"' }];
  assert.doesNotMatch(recognitionHtml(tricky), /<b>/);
  assert.match(recognitionHtml(tricky), /&lt;b&gt;/);
  assert.match(recognitionHtml([]), /No loyal customer/);
  const csv = recognitionCsv([{ ...rows[0], customerName: 'A, "Q"' }]);
  assert.match(csv, /"A, ""Q"""/);
  assert.equal(recognitionFilename(), 'loyalty-recognition.csv');
});

test('inputs are never mutated', () => {
  const input = [{ ...A, periods: [{ start: '2020-01-01', end: null }] }];
  const snapshot = JSON.stringify(input);
  buildRecognitionList(input, { asOf: '2026-11-04' });
  assert.equal(JSON.stringify(input), snapshot);
});

test('purity fence: module never touches the Plan 56 list or any bill record', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'loyalty-recognition.js'), 'utf8');
  assert.doesNotMatch(source, /at-risk-signals|atRisk/);
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /localStorage|fetch\(|XMLHttpRequest/);
});
