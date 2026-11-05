import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validWinbackOutcomeDate,
  normalizeWinbackOutcomeList,
  recordWinbackOutcome,
  removeWinbackOutcome,
  findWinbackOutcome,
  addWinbackOutcomeNote,
  winbackOutcomeSorted,
  attemptsForCustomer,
  winbackOutcomeCustomers,
  latestWinbackOutcome,
  openWinbackCustomers,
  winbackOutcomeSummaryText,
  winbackOutcomeText,
  winbackOutcomeHtml,
  winbackOutcomeAllHtml,
  winbackOutcomeCsv,
  winbackOutcomeFilename,
} from '../winback-outcome.js';

const first = { id: 'WO-1', customer: 'Ahmed Raza', attemptDate: '2026-11-08', outcome: 'no answer', note: 'Called twice, no answer.' };
const second = { id: 'WO-2', customer: 'Ahmed Raza', attemptDate: '2026-11-10', outcome: 'declined', note: 'Says the price is too high.', followups: [{ date: '2026-11-10', note: 'Offered the 3 Mbps package.' }] };
const third = { id: 'WO-3', customer: 'Bilal Khan', attemptDate: '2026-11-09', outcome: 'returned', note: 'Came back on the 5 Mbps package.' };

test('half-formed outcomes are refused', () => {
  assert.deepEqual(recordWinbackOutcome([], { ...first, id: '' }), []);
  assert.deepEqual(recordWinbackOutcome([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordWinbackOutcome([], { ...first, attemptDate: '' }), []);
  assert.deepEqual(recordWinbackOutcome([], { ...first, note: '' }), []);
  assert.deepEqual(recordWinbackOutcome([], { ...first, outcome: 'maybe' }), []);
  assert.deepEqual(recordWinbackOutcome([], { ...first, outcome: '' }), []);
  assert.deepEqual(recordWinbackOutcome([], { ...first, outcome: 'returned later' }), []);
  const recorded = recordWinbackOutcome([], { ...first, outcome: 'Returned' });
  assert.equal(recorded[0].outcome, 'returned');
  const recordedNo = recordWinbackOutcome([], { ...first, id: 'WO-9', outcome: 'NO ANSWER' });
  assert.equal(recordedNo[0].outcome, 'no answer');
  const recordedDeclined = recordWinbackOutcome([], { ...first, id: 'WO-8', outcome: '  Declined ' });
  assert.equal(recordedDeclined[0].outcome, 'declined');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validWinbackOutcomeDate('2026-08-31'), true);
  assert.equal(validWinbackOutcomeDate('2026-10-31'), true);
  assert.equal(validWinbackOutcomeDate('2026-12-31'), true);
  assert.equal(validWinbackOutcomeDate('2026-02-29'), false);
  assert.equal(validWinbackOutcomeDate('2028-02-29'), true);
  assert.equal(validWinbackOutcomeDate('2026-04-31'), false);
  assert.equal(validWinbackOutcomeDate('2026-13-01'), false);
  assert.equal(validWinbackOutcomeDate('10-11-2026'), false);
  assert.equal(validWinbackOutcomeDate(''), false);
  assert.equal(validWinbackOutcomeDate(null), false);
  assert.deepEqual(recordWinbackOutcome([], { ...first, attemptDate: '2026-02-30' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, customerStatus: 'active', billAmount: 1500, surprise: 'x' };
  const recorded = recordWinbackOutcome([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('customerStatus' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.customerStatus, 'active');
  assert.deepEqual(Object.keys(raw).sort(), ['attemptDate', 'billAmount', 'customer', 'customerStatus', 'id', 'note', 'outcome', 'surprise']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordWinbackOutcome([], first);
  assert.deepEqual(recordWinbackOutcome(list, { ...first, note: 'Changed.' }), list);
  assert.deepEqual(recordWinbackOutcome(list, { ...second, id: 'WO-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordWinbackOutcome(acc, item), []);
  assert.equal(findWinbackOutcome(list, 'WO-2').customer, 'Ahmed Raza');
  assert.equal(findWinbackOutcome(list, 'WO-9'), null);
  assert.equal(findWinbackOutcome(list, ''), null);
  assert.deepEqual(removeWinbackOutcome(list, 'WO-2').map((item) => item.id), ['WO-1', 'WO-3']);
  assert.deepEqual(removeWinbackOutcome(list, 'WO-9'), list);
  assert.deepEqual(removeWinbackOutcome(list, ''), list);
});

test('sorting and per-customer attempts in date order', () => {
  const list = [third, second, first].reduce((acc, item) => recordWinbackOutcome(acc, item), []);
  assert.deepEqual(winbackOutcomeSorted(list).map((item) => item.id), ['WO-1', 'WO-3', 'WO-2']);
  assert.deepEqual(attemptsForCustomer(list, 'ahmed raza').map((item) => item.id), ['WO-1', 'WO-2']);
  assert.deepEqual(attemptsForCustomer(list, 'Nobody'), []);
  assert.deepEqual(attemptsForCustomer(list, ''), []);
  assert.deepEqual(winbackOutcomeCustomers(list), ['Ahmed Raza', 'Bilal Khan']);
});

test('latest outcome is prominent per customer', () => {
  const list = [first, second, third].reduce((acc, item) => recordWinbackOutcome(acc, item), []);
  assert.equal(latestWinbackOutcome(list, 'Ahmed Raza').id, 'WO-2');
  assert.equal(latestWinbackOutcome(list, 'Ahmed Raza').outcome, 'declined');
  assert.equal(latestWinbackOutcome(list, 'Bilal Khan').outcome, 'returned');
  assert.equal(latestWinbackOutcome(list, 'Nobody'), null);
  assert.equal(latestWinbackOutcome(list, ''), null);
});

test('returned customers leave the open winback list', () => {
  const list = [first, second, third].reduce((acc, item) => recordWinbackOutcome(acc, item), []);
  assert.deepEqual(openWinbackCustomers(list, ['Ahmed Raza', 'Bilal Khan', 'Sana Malik']), ['Ahmed Raza', 'Sana Malik']);
  assert.deepEqual(openWinbackCustomers(list, ['bilal khan', 'BILAL KHAN', '  ', 'Ahmed Raza']), ['Ahmed Raza']);
  assert.deepEqual(openWinbackCustomers([], ['Ahmed Raza', 'Bilal Khan']), ['Ahmed Raza', 'Bilal Khan']);
  assert.deepEqual(openWinbackCustomers(list, []), []);
  assert.deepEqual(openWinbackCustomers(list, 'not a list'), []);
  assert.deepEqual(openWinbackCustomers(list, [null, '', '  Sana Malik  ']), ['Sana Malik']);
});

test('dated follow-up notes never rewrite the record', () => {
  const list = [first, second].reduce((acc, item) => recordWinbackOutcome(acc, item), []);
  const noted = addWinbackOutcomeNote(list, 'WO-1', '2026-11-11', 'Tried again in the evening.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].customer, 'Ahmed Raza');
  assert.equal(noted[0].attemptDate, '2026-11-08');
  assert.equal(noted[0].outcome, 'no answer');
  assert.equal(noted[0].note, 'Called twice, no answer.');
  assert.deepEqual(addWinbackOutcomeNote(list, 'WO-1', '2026-02-30', 'Bad date.'), list);
  assert.deepEqual(addWinbackOutcomeNote(list, 'WO-1', '2026-11-11', ''), list);
  assert.deepEqual(addWinbackOutcomeNote(list, 'WO-9', '2026-11-11', 'Unknown.'), list);
});

test('summary and entry text name the outcome plainly', () => {
  assert.equal(winbackOutcomeSummaryText([]), 'No winback outcomes recorded.');
  const list = [first, second, third].reduce((acc, item) => recordWinbackOutcome(acc, item), []);
  assert.equal(winbackOutcomeSummaryText(list), '3 winback outcomes: 1 returned, 1 declined, 1 no answer.');
  assert.equal(winbackOutcomeText(first), 'Customer Ahmed Raza (2026-11-08): no answer — Called twice, no answer.');
  assert.equal(winbackOutcomeText(second), 'Customer Ahmed Raza (2026-11-10): declined — Says the price is too high. Follow-ups: 2026-11-10: Offered the 3 Mbps package.');
  assert.equal(winbackOutcomeText(third), 'Customer Bilal Khan (2026-11-09): returned — Came back on the 5 Mbps package.');
  assert.equal(winbackOutcomeText(null), 'No winback outcome recorded.');
});

test('html escapes input', () => {
  const nasty = { ...first, note: '<script>alert(1)</script> & "quoted"' };
  const html = winbackOutcomeHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('&amp;'), true);
  assert.equal(winbackOutcomeHtml(null), '<p>No winback outcome recorded.</p>');
  const list = [first, second].reduce((acc, item) => recordWinbackOutcome(acc, item), []);
  assert.equal(winbackOutcomeAllHtml(list).startsWith('<ul>'), true);
  assert.equal(winbackOutcomeAllHtml([]), '<p>No winback outcomes recorded.</p>');
});

test('csv export and filename', () => {
  const list = [first, second].reduce((acc, item) => recordWinbackOutcome(acc, item), []);
  const csv = winbackOutcomeCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","attempt date","outcome","note","follow-ups"');
  assert.equal(lines[1].includes('"Ahmed Raza"'), true);
  assert.equal(lines[1].includes('"no answer"'), true);
  assert.equal(lines[2].includes('"declined"'), true);
  assert.equal(winbackOutcomeFilename(), 'winback-outcomes.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, note: 'Changed.' }, { id: 'WO-9' }, null, 'nope', second];
  assert.deepEqual(normalizeWinbackOutcomeList(messy).map((item) => item.id), ['WO-1', 'WO-2']);
  assert.deepEqual(normalizeWinbackOutcomeList('not a list'), []);
  assert.deepEqual(normalizeWinbackOutcomeList(undefined), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../winback-outcome.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the winback queue and the winback cadence are untouched', () => {
  const source = readFileSync(new URL('../winback-outcome.js', import.meta.url), 'utf8');
  assert.equal(source.includes('winback-queue'), false, 'module must not reference the winback queue module');
  assert.equal(source.includes('winback-cadence'), false, 'module must not reference the winback cadence module');
  assert.equal(existsSync(new URL('../winback-queue.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../winback-cadence.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'woHeading', 'woSummary', 'woList', 'woExportBtn',
    'woCustomer', 'woAttemptDate', 'woOutcome', 'woNote', 'woRecordBtn',
    'woAnnotateId', 'woAnnotateDate', 'woAnnotateNote', 'woAnnotateBtn',
    'woRemoveId', 'woRemoveBtn',
    'woFilterCustomer', 'woFilterBtn', 'woFilterBody',
    'woLatestCustomer', 'woLatestBtn', 'woLatestBody',
    'woOpenRefs', 'woOpenBtn', 'woOpenBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the winback outcome panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './winback-outcome.js'"), true);
  assert.equal(source.includes('renderWinbackOutcomes()'), true);
  assert.equal(source.includes('WINBACK_OUTCOME_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
