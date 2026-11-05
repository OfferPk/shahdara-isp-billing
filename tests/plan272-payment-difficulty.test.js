import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validDifficultyNoteDate,
  normalizeDifficultyNoteList,
  recordDifficultyNote,
  removeDifficultyNote,
  findDifficultyNote,
  difficultyNoteSorted,
  difficultyNotesForCustomer,
  overdueDifficultyFollowups,
  difficultyNoteCustomers,
  difficultyNoteSummaryText,
  difficultyNoteText,
  difficultyNoteHtml,
  difficultyNoteAllHtml,
  difficultyNoteCsv,
  difficultyNoteFilename,
} from '../payment-difficulty.js';

const first = { id: 'PD-1', customer: 'Ayesha', date: '2026-11-10', difficulty: 'Struggling to pay this month after a hospital bill.', nextStep: 'Call again on Friday', followUpDate: '2026-11-15' };
const second = { id: 'PD-2', customer: 'Ayesha', date: '2026-11-12', difficulty: 'Pay is late this month.', nextStep: 'Collect a part payment on the 20th', followUpDate: '2026-11-20' };
const third = { id: 'PD-3', customer: 'Bilal', date: '2026-11-09', difficulty: 'Shop earnings are low this week.', nextStep: '', followUpDate: '' };

test('half-formed notes are refused: no customer, no date, or no difficulty', () => {
  assert.deepEqual(recordDifficultyNote([], { id: '', customer: 'Ayesha', date: '2026-11-10', difficulty: 'Hard month.' }), []);
  assert.deepEqual(recordDifficultyNote([], { id: 'PD-1', customer: '', date: '2026-11-10', difficulty: 'Hard month.' }), []);
  assert.deepEqual(recordDifficultyNote([], { id: 'PD-1', customer: '   ', date: '2026-11-10', difficulty: 'Hard month.' }), []);
  assert.deepEqual(recordDifficultyNote([], { id: 'PD-1', customer: 'Ayesha', date: '2026-11-10', difficulty: '' }), []);
  assert.deepEqual(recordDifficultyNote([], { id: 'PD-1', customer: 'Ayesha', date: '2026-11-10', difficulty: '   ' }), []);
  assert.deepEqual(recordDifficultyNote([], { id: 'PD-1', customer: 'Ayesha', date: '2026-02-29', difficulty: 'Hard month.' }), []);
  assert.deepEqual(recordDifficultyNote([], { id: 'PD-1', date: '2026-11-10', difficulty: 'Hard month.' }), []);
  assert.deepEqual(recordDifficultyNote([], { id: 'PD-1', customer: 'Ayesha', difficulty: 'Hard month.' }), []);
  assert.deepEqual(recordDifficultyNote([], { id: 'PD-1', customer: 'Ayesha', date: '2026-11-10' }), []);
  assert.deepEqual(recordDifficultyNote([], { ...first, id: 'PD-9', followUpDate: '2026-13-01' }), []);
  assert.deepEqual(recordDifficultyNote([], { ...first, id: 'PD-9', followUpDate: 'not-a-date' }), []);
  assert.equal(recordDifficultyNote([], first).length, 1);
  assert.equal(recordDifficultyNote([], third).length, 1);
});

test('strict dates: real calendar days only', () => {
  assert.equal(validDifficultyNoteDate('2026-11-10'), true);
  assert.equal(validDifficultyNoteDate('2024-02-29'), true);
  assert.equal(validDifficultyNoteDate('2026-02-29'), false);
  assert.equal(validDifficultyNoteDate('2026-04-31'), false);
  assert.equal(validDifficultyNoteDate('2026-13-01'), false);
  assert.equal(validDifficultyNoteDate('2026-00-10'), false);
  assert.equal(validDifficultyNoteDate('2026-11-00'), false);
  assert.equal(validDifficultyNoteDate('10-11-2026'), false);
  assert.equal(validDifficultyNoteDate('not-a-date'), false);
  assert.equal(validDifficultyNoteDate(''), false);
  assert.equal(validDifficultyNoteDate(null), false);
  assert.deepEqual(recordDifficultyNote([], { ...first, id: 'PD-9', date: '2026-02-29' }), []);
  assert.equal(recordDifficultyNote([], { ...first, id: 'PD-9', date: '2024-02-29' }).length, 1);
  assert.deepEqual(recordDifficultyNote([], { ...first, id: 'PD-9', followUpDate: '2024-02-29' }).length, 1);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 1500, paymentStatus: 'paid', planId: 'PLAN-1', discount: 200, extensionDays: 5, extra: 'drop me' };
  const recorded = recordDifficultyNote([], raw);
  assert.equal(recorded.length, 1);
  assert.deepEqual(Object.keys(recorded[0]).sort(), ['customer', 'date', 'difficulty', 'followUpDate', 'id', 'nextStep']);
  assert.equal('billAmount' in raw, true);
  assert.equal('planId' in raw, true);
  const list = [first, second, third];
  const before = JSON.stringify(list);
  normalizeDifficultyNoteList(list);
  difficultyNoteSorted(list);
  difficultyNotesForCustomer(list, 'Ayesha');
  overdueDifficultyFollowups(list, '2026-11-16');
  assert.equal(JSON.stringify(list), before);
});

test('duplicate ids are never rewritten', () => {
  const list = [first];
  const again = recordDifficultyNote(list, { ...first, difficulty: 'Changed difficulty.' });
  assert.equal(again.length, 1);
  assert.equal(again[0].difficulty, first.difficulty);
  const normalized = normalizeDifficultyNoteList([first, { ...first, difficulty: 'Changed difficulty.' }]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].difficulty, first.difficulty);
});

test('find and remove', () => {
  const list = [first, second, third];
  assert.deepEqual(findDifficultyNote(list, 'PD-2'), second);
  assert.equal(findDifficultyNote(list, 'PD-9'), null);
  assert.equal(findDifficultyNote(list, ''), null);
  assert.equal(removeDifficultyNote(list, 'PD-2').length, 2);
  assert.equal(removeDifficultyNote(list, 'PD-9').length, 3);
  assert.equal(removeDifficultyNote(list, '').length, 3);
});

test('a customer page lists difficulty notes in date order', () => {
  const shuffled = [second, third, first];
  const forAyesha = difficultyNotesForCustomer(shuffled, 'Ayesha');
  assert.deepEqual(forAyesha.map((item) => item.id), ['PD-1', 'PD-2']);
  assert.deepEqual(difficultyNotesForCustomer(shuffled, 'ayesha').map((item) => item.id), ['PD-1', 'PD-2']);
  assert.deepEqual(difficultyNotesForCustomer(shuffled, 'Bilal').map((item) => item.id), ['PD-3']);
  assert.deepEqual(difficultyNotesForCustomer(shuffled, 'Nobody'), []);
  assert.deepEqual(difficultyNotesForCustomer(shuffled, ''), []);
  const sorted = difficultyNoteSorted(shuffled);
  assert.deepEqual(sorted.map((item) => item.id), ['PD-3', 'PD-1', 'PD-2']);
});

test('overdue follow-ups appear on one list, in follow-up order', () => {
  const list = [first, second, third];
  const overdue = overdueDifficultyFollowups(list, '2026-11-16');
  assert.deepEqual(overdue.map((item) => item.id), ['PD-1']);
  assert.deepEqual(overdueDifficultyFollowups(list, '2026-11-21').map((item) => item.id), ['PD-1', 'PD-2']);
  assert.deepEqual(overdueDifficultyFollowups(list, '2026-11-15'), []);
  assert.deepEqual(overdueDifficultyFollowups(list, '2026-11-10'), []);
  assert.deepEqual(overdueDifficultyFollowups(list, 'not-a-date'), []);
  assert.deepEqual(overdueDifficultyFollowups(list, ''), []);
  assert.deepEqual(overdueDifficultyFollowups([], '2026-11-16'), []);
  const outOfOrder = overdueDifficultyFollowups([second, first], '2026-11-21');
  assert.deepEqual(outOfOrder.map((item) => item.id), ['PD-1', 'PD-2']);
});

test('customer list keeps the first spelling', () => {
  const list = [first, second, third, { id: 'PD-4', customer: 'ayesha', date: '2026-11-13', difficulty: 'Still short this month.', nextStep: '', followUpDate: '' }];
  assert.deepEqual(difficultyNoteCustomers(list), ['Bilal', 'Ayesha']);
  assert.deepEqual(difficultyNoteCustomers([]), []);
});

test('summary and entry text', () => {
  assert.equal(difficultyNoteSummaryText([]), 'No payment difficulty notes recorded.');
  assert.equal(difficultyNoteSummaryText([first]), '1 payment difficulty note for 1 customer.');
  assert.equal(difficultyNoteSummaryText([first, second, third]), '3 payment difficulty notes for 2 customers.');
  assert.equal(difficultyNoteText(first), '2026-11-10: Ayesha — Struggling to pay this month after a hospital bill. Next step: Call again on Friday. Follow up by 2026-11-15.');
  assert.equal(difficultyNoteText(third), '2026-11-09: Bilal — Shop earnings are low this week.');
  assert.equal(difficultyNoteText(null), 'No payment difficulty note recorded.');
  assert.equal(difficultyNoteText({ id: 'PD-9', customer: 'Ayesha', date: '2026-11-10', difficulty: '' }), 'No payment difficulty note recorded.');
});

test('HTML is escaped', () => {
  const nasty = { ...first, difficulty: '<script>alert("x")</script> & done' };
  const html = difficultyNoteHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('&amp; done'), true);
  assert.equal(difficultyNoteHtml(null), '<p>No payment difficulty note recorded.</p>');
  const all = difficultyNoteAllHtml([first, second]);
  assert.equal(all.startsWith('<ul>'), true);
  assert.equal(all.includes('PD-1'), false);
  assert.equal(all.includes('Ayesha'), true);
  assert.equal(difficultyNoteAllHtml([]), '<p>No payment difficulty notes recorded.</p>');
});

test('CSV export and filename', () => {
  const csv = difficultyNoteCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","date","difficulty","nextStep","followUpDate"');
  assert.equal(lines[1].startsWith('"PD-1","Ayesha","2026-11-10","Struggling to pay this month after a hospital bill.","Call again on Friday","2026-11-15"'), true);
  assert.equal(lines[2].startsWith('"PD-2","Ayesha","2026-11-12","Pay is late this month."'), true);
  assert.equal(difficultyNoteCsv([]), '"id","customer","date","difficulty","nextStep","followUpDate"');
  assert.equal(difficultyNoteFilename(), 'payment-difficulty-notes.csv');
});

test('list normalisation drops bad rows', () => {
  const mixed = [first, null, 'nope', { id: 'PD-2', customer: 'Ayesha', date: '2026-11-12', difficulty: '' }, second, third];
  assert.deepEqual(normalizeDifficultyNoteList(mixed).map((item) => item.id), ['PD-1', 'PD-2', 'PD-3']);
  assert.deepEqual(normalizeDifficultyNoteList(null), []);
  assert.deepEqual(normalizeDifficultyNoteList('not a list'), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../payment-difficulty.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: repayment, extension, and retention modules are untouched', () => {
  const source = readFileSync(new URL('../payment-difficulty.js', import.meta.url), 'utf8');
  assert.equal(source.includes('repayment-plan'), false, 'module must not reference the arrears repayment plan module');
  assert.equal(source.includes('bill-extension'), false, 'module must not reference the bill extension module');
  assert.equal(source.includes('retention-policy'), false, 'module must not reference the retention offer module');
  assert.equal(source.includes('loyalty-retention'), false, 'module must not reference the retention module');
  assert.equal(existsSync(new URL('../repayment-plan.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../bill-extension.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../retention-policy.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../loyalty-retention.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'pdHeading', 'pdSummary', 'pdList', 'pdExportBtn',
    'pdCustomer', 'pdDate', 'pdDifficulty', 'pdNextStep', 'pdFollowUp', 'pdRecordBtn',
    'pdRemoveId', 'pdRemoveBtn',
    'pdFilterCustomer', 'pdFilterBtn', 'pdFilterBody',
    'pdOverdueAsOf', 'pdOverdueBtn', 'pdOverdueBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the payment difficulty panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './payment-difficulty.js'"), true);
  assert.equal(source.includes('renderPaymentDifficulty()'), true);
  assert.equal(source.includes('PAYMENT_DIFFICULTY_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
