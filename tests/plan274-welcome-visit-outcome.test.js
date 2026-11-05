import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validWelcomeVisitOutcomeDate,
  foldWelcomeVisitOutcome,
  normalizeWelcomeVisitOutcomeList,
  recordWelcomeVisitOutcome,
  removeWelcomeVisitOutcome,
  findWelcomeVisitOutcome,
  addWelcomeVisitOpenQuestion,
  answerWelcomeVisitQuestion,
  welcomeVisitOutcomeSorted,
  outcomesForCustomer,
  notesWithOpenQuestions,
  openQuestionsForCustomer,
  welcomeVisitOutcomeCustomers,
  welcomeVisitOutcomeSummaryText,
  welcomeVisitOutcomeText,
  welcomeVisitOutcomeHtml,
  welcomeVisitOutcomeAllHtml,
  welcomeVisitOutcomeCsv,
  welcomeVisitOutcomeFilename,
} from '../welcome-visit-outcome.js';

const first = { id: 'WV-1', customer: 'MOBEEN SHAH', date: '2026-11-10', outcome: 'settled', openQuestions: [], note: 'Showed the ONU lights and the bill date.' };
const second = { id: 'WV-2', customer: 'AQIB EJAZ', date: '2026-11-08', outcome: 'questions open', openQuestions: ['How to pay by Easypaisa?', 'What happens when data runs out?'], note: 'New connection, first week.' };
const third = { id: 'WV-3', customer: 'MOBEEN SHAH', date: '2026-11-12', outcome: 'settled', openQuestions: [{ question: 'How to restart the ONU?', answered: true }], note: 'Second visit, all clear.' };

test('half-formed notes are refused: no customer, no date, or no id', () => {
  assert.deepEqual(recordWelcomeVisitOutcome([], { id: '', customer: 'MOBEEN SHAH', date: '2026-11-10', outcome: 'settled' }), []);
  assert.deepEqual(recordWelcomeVisitOutcome([], { id: 'WV-1', customer: '', date: '2026-11-10', outcome: 'settled' }), []);
  assert.deepEqual(recordWelcomeVisitOutcome([], { id: 'WV-1', customer: '   ', date: '2026-11-10', outcome: 'settled' }), []);
  assert.deepEqual(recordWelcomeVisitOutcome([], { id: 'WV-1', customer: 'MOBEEN SHAH', date: 'not-a-date', outcome: 'settled' }), []);
  assert.deepEqual(recordWelcomeVisitOutcome([], { id: 'WV-1', customer: 'MOBEEN SHAH', outcome: 'settled' }), []);
  assert.deepEqual(recordWelcomeVisitOutcome([], { id: 'WV-1', date: '2026-11-10', outcome: 'settled' }), []);
  assert.equal(recordWelcomeVisitOutcome([], first).length, 1);
  assert.equal(recordWelcomeVisitOutcome([], second).length, 1);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validWelcomeVisitOutcomeDate('2026-01-31'), true);
  assert.equal(validWelcomeVisitOutcomeDate('2026-04-31'), false);
  assert.equal(validWelcomeVisitOutcomeDate('2026-02-29'), false);
  assert.equal(validWelcomeVisitOutcomeDate('2024-02-29'), true);
  assert.equal(validWelcomeVisitOutcomeDate('2026-11-10'), true);
  assert.equal(validWelcomeVisitOutcomeDate('2026-13-01'), false);
  assert.equal(validWelcomeVisitOutcomeDate('2026-11-00'), false);
  assert.equal(validWelcomeVisitOutcomeDate('10-11-2026'), false);
  assert.equal(validWelcomeVisitOutcomeDate(''), false);
  assert.equal(validWelcomeVisitOutcomeDate(null), false);
});

test('outcome spellings fold, and a missing outcome follows the open questions', () => {
  assert.equal(foldWelcomeVisitOutcome('Settled'), 'settled');
  assert.equal(foldWelcomeVisitOutcome('done'), 'settled');
  assert.equal(foldWelcomeVisitOutcome('COMPLETE'), 'settled');
  assert.equal(foldWelcomeVisitOutcome('Questions Open'), 'questions open');
  assert.equal(foldWelcomeVisitOutcome('open'), 'questions open');
  assert.equal(foldWelcomeVisitOutcome('pending'), 'questions open');
  assert.equal(foldWelcomeVisitOutcome('mystery'), null);
  assert.equal(foldWelcomeVisitOutcome(''), null);
  const withQuestion = recordWelcomeVisitOutcome([], { id: 'WV-9', customer: 'ALI', date: '2026-11-10', openQuestions: ['Why is the bill 1500?'] });
  assert.equal(withQuestion[0].outcome, 'questions open');
  const withoutQuestion = recordWelcomeVisitOutcome([], { id: 'WV-9', customer: 'ALI', date: '2026-11-10' });
  assert.equal(withoutQuestion[0].outcome, 'settled');
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 1500, onboardingStatus: 'done', extra: 'x' };
  const before = JSON.stringify(raw);
  const recorded = recordWelcomeVisitOutcome([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('onboardingStatus' in recorded[0], false);
  assert.equal('extra' in recorded[0], false);
  assert.equal(JSON.stringify(raw), before);
  const list = [first];
  const listBefore = JSON.stringify(list);
  recordWelcomeVisitOutcome(list, second);
  assert.equal(JSON.stringify(list), listBefore);
});

test('duplicate ids are never rewritten', () => {
  const changed = { ...second, id: 'WV-1', note: 'Different note.' };
  const out = recordWelcomeVisitOutcome([first], changed);
  assert.equal(out.length, 1);
  assert.equal(out[0].note, first.note);
});

test('find and remove work by id', () => {
  const list = [first, second];
  assert.equal(findWelcomeVisitOutcome(list, 'WV-2').customer, 'AQIB EJAZ');
  assert.equal(findWelcomeVisitOutcome(list, 'WV-9'), null);
  assert.equal(findWelcomeVisitOutcome(list, ''), null);
  assert.deepEqual(removeWelcomeVisitOutcome(list, 'WV-1').map((item) => item.id), ['WV-2']);
  assert.equal(removeWelcomeVisitOutcome(list, 'WV-9').length, 2);
});

test('sorting is by date, then customer, then id', () => {
  const out = welcomeVisitOutcomeSorted([third, first, second]);
  assert.deepEqual(out.map((item) => item.id), ['WV-2', 'WV-1', 'WV-3']);
});

test('a customer page lists their outcomes in date order', () => {
  const out = outcomesForCustomer([third, first, second], 'mobeen shah');
  assert.deepEqual(out.map((item) => item.id), ['WV-1', 'WV-3']);
  assert.deepEqual(outcomesForCustomer([first], ''), []);
  assert.deepEqual(outcomesForCustomer([first], 'No such customer'), []);
});

test('open questions stay listed until answered', () => {
  assert.deepEqual(notesWithOpenQuestions([first, second, third]).map((item) => item.id), ['WV-2']);
  const answeredOne = answerWelcomeVisitQuestion([second], 'WV-2', 'how to pay by easypaisa?');
  assert.deepEqual(notesWithOpenQuestions(answeredOne).map((item) => item.id), ['WV-2']);
  const answeredBoth = answerWelcomeVisitQuestion(answeredOne, 'WV-2', 'What happens when data runs out?');
  assert.deepEqual(notesWithOpenQuestions(answeredBoth), []);
  assert.deepEqual(notesWithOpenQuestions([first, third]), []);
});

test('open questions for one customer name the note and the date', () => {
  const out = openQuestionsForCustomer([third, first, second], 'aqib ejaz');
  assert.equal(out.length, 2);
  assert.equal(out[0].noteId, 'WV-2');
  assert.equal(out[0].date, '2026-11-08');
  assert.equal(out[0].question, 'How to pay by Easypaisa?');
  assert.deepEqual(openQuestionsForCustomer([first], 'MOBEEN SHAH'), []);
  assert.deepEqual(openQuestionsForCustomer([first], ''), []);
});

test('customer list keeps the first spelling', () => {
  const lower = { ...third, id: 'WV-5', customer: 'mobeen shah', date: '2026-11-13' };
  assert.deepEqual(welcomeVisitOutcomeCustomers([second, first, lower]), ['AQIB EJAZ', 'MOBEEN SHAH']);
});

test('adding an open question never rewrites the note', () => {
  const list = [first];
  const added = addWelcomeVisitOpenQuestion(list, 'WV-1', 'When does the package renew?');
  assert.equal(added[0].openQuestions.length, 1);
  assert.equal(added[0].openQuestions[0].question, 'When does the package renew?');
  assert.equal(added[0].openQuestions[0].answered, false);
  assert.equal(added[0].date, '2026-11-10');
  assert.equal(added[0].customer, 'MOBEEN SHAH');
  assert.equal(added[0].outcome, 'settled');
  assert.equal(added[0].note, first.note);
  const unchanged = [{ ...first, openQuestions: [] }];
  assert.deepEqual(addWelcomeVisitOpenQuestion(list, 'WV-1', ''), unchanged);
  assert.deepEqual(addWelcomeVisitOpenQuestion(list, 'WV-9', 'Nope'), unchanged);
});

test('answering a question marks only the first matching one', () => {
  const list = [second];
  const answered = answerWelcomeVisitQuestion(list, 'WV-2', 'What happens when data runs out?');
  assert.equal(answered[0].openQuestions[0].answered, false);
  assert.equal(answered[0].openQuestions[1].answered, true);
  assert.equal(answered[0].customer, 'AQIB EJAZ');
  assert.equal(answered[0].date, '2026-11-08');
  assert.equal(answered[0].outcome, 'questions open');
  const unchanged = [{ ...second, openQuestions: second.openQuestions.map((q) => ({ question: q, answered: false })) }];
  assert.deepEqual(answerWelcomeVisitQuestion(list, 'WV-2', 'No such question'), unchanged);
  assert.deepEqual(answerWelcomeVisitQuestion(list, 'WV-9', 'How to pay by Easypaisa?'), unchanged);
  assert.deepEqual(answerWelcomeVisitQuestion(list, 'WV-2', ''), unchanged);
});

test('summary and entry text name the customer, date, and outcome plainly', () => {
  assert.equal(welcomeVisitOutcomeSummaryText([]), 'No welcome visit outcomes recorded.');
  assert.equal(welcomeVisitOutcomeSummaryText([first, second]), '2 welcome visit outcomes recorded, 1 with open question still to answer.');
  assert.equal(welcomeVisitOutcomeSummaryText([first]), '1 welcome visit outcome recorded, 0 with open questions still to answer.');
  const text = welcomeVisitOutcomeText(second);
  assert.equal(text.includes('2026-11-08'), true);
  assert.equal(text.includes('AQIB EJAZ'), true);
  assert.equal(text.includes('questions open'), true);
  assert.equal(text.includes('How to pay by Easypaisa?'), true);
  assert.equal(text.includes('What happens when data runs out?'), true);
  assert.equal(welcomeVisitOutcomeText(third).includes('Answered: How to restart the ONU?'), true);
  assert.equal(welcomeVisitOutcomeText(null), 'No welcome visit outcome recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, note: '<script>alert(1)</script>' };
  const html = welcomeVisitOutcomeHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(welcomeVisitOutcomeHtml(null), '<p>No welcome visit outcome recorded.</p>');
  assert.equal(welcomeVisitOutcomeAllHtml([]), '<p>No welcome visit outcomes recorded.</p>');
  assert.equal(welcomeVisitOutcomeAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = welcomeVisitOutcomeCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","date","outcome","open questions","answered questions","note"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('WV-2'), true);
  assert.equal(lines[1].includes('How to pay by Easypaisa?'), true);
  assert.equal(welcomeVisitOutcomeFilename(), 'welcome-visit-outcomes.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'WV-9', customer: '', date: '2026-11-10', outcome: 'settled' };
  const out = normalizeWelcomeVisitOutcomeList([bad, first, { ...first, note: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['WV-1', 'WV-2']);
  assert.equal(out[0].note, first.note);
  assert.deepEqual(normalizeWelcomeVisitOutcomeList('nope'), []);
  assert.deepEqual(normalizeWelcomeVisitOutcomeList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../welcome-visit-outcome.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the onboarding checklist, welcome pack draft, and check-in list are untouched', () => {
  const source = readFileSync(new URL('../welcome-visit-outcome.js', import.meta.url), 'utf8');
  assert.equal(source.includes('onboarding-checklist.js'), false, 'module must not reference the onboarding checklist module');
  assert.equal(source.includes('welcome-pack.js'), false, 'module must not reference the welcome pack draft module');
  assert.equal(source.includes('new-customer-checkin.js'), false, 'module must not reference the new-customer check-in list module');
  assert.equal(source.includes('visit-outcomes.js'), false, 'module must not reference the field visit outcomes module');
  assert.equal(existsSync(new URL('../onboarding-checklist.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../welcome-pack.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../new-customer-checkin.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'wvHeading', 'wvSummary', 'wvList', 'wvExportBtn',
    'wvCustomer', 'wvDate', 'wvOutcome', 'wvQuestions', 'wvNote', 'wvRecordBtn',
    'wvAnswerId', 'wvAnswerQuestion', 'wvAnswerBtn',
    'wvAddId', 'wvAddQuestion', 'wvAddBtn',
    'wvRemoveId', 'wvRemoveBtn',
    'wvFilterCustomer', 'wvFilterBtn', 'wvCustomerBody', 'wvOpenBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the welcome visit outcome panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './welcome-visit-outcome.js'"), true);
  assert.equal(source.includes('renderWelcomeVisitOutcomes()'), true);
  assert.equal(source.includes('WELCOME_VISIT_OUTCOME_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
