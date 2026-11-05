import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validPromiseDeliveryCheckDate,
  normalizePromiseDeliveryCheckList,
  recordPromiseDeliveryCheck,
  removePromiseDeliveryCheck,
  findPromiseDeliveryCheck,
  addPromiseDeliveryCheckNote,
  promiseDeliveryCheckSorted,
  checksForPromise,
  checksForCustomer,
  promiseDeliveryCheckCustomers,
  missedPromiseDeliveryChecks,
  promiseDeliveryCheckSummaryText,
  promiseDeliveryCheckText,
  promiseDeliveryCheckHtml,
  promiseDeliveryCheckAllHtml,
  promiseDeliveryCheckCsv,
  promiseDeliveryCheckFilename,
} from '../promise-delivery-check.js';

const first = { id: 'PD-1', promiseRef: 'P-101', customer: 'Ahmed', promiseDate: '2026-11-01', promised: 'Visit on Friday to fix the line', delivered: 'Visit on Friday, line fixed', deliveredDate: '2026-11-07', outcome: 'met', note: 'Customer happy.' };
const second = { id: 'PD-2', promiseRef: 'P-102', customer: 'Bilal', promiseDate: '2026-11-02', promised: 'Package change to 20 Mbps', delivered: 'Package changed but speed still low', deliveredDate: '2026-11-08', outcome: 'partly met', note: 'Speed to recheck.', followups: [{ date: '2026-11-09', note: 'Speed still low, engineer to visit.' }] };
const third = { id: 'PD-3', promiseRef: 'P-103', customer: 'Ahmed', promiseDate: '2026-10-28', promised: 'Call back by Monday', delivered: 'No call was made', deliveredDate: '2026-11-03', outcome: 'missed', note: 'Owner to apologise.' };

test('half-formed delivery checks are refused', () => {
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, id: '' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, promiseRef: '  ' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, customer: '' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, promiseDate: '' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, promised: '' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, delivered: '' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, deliveredDate: '' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, note: '' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, outcome: 'done' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, outcome: 'almost' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, outcome: '' }), []);
  const recorded = recordPromiseDeliveryCheck([], { ...first, outcome: 'Met' });
  assert.equal(recorded[0].outcome, 'met');
  const recordedPartly = recordPromiseDeliveryCheck([], { ...first, id: 'PD-9', outcome: 'PARTLY MET' });
  assert.equal(recordedPartly[0].outcome, 'partly met');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validPromiseDeliveryCheckDate('2026-08-31'), true);
  assert.equal(validPromiseDeliveryCheckDate('2026-10-31'), true);
  assert.equal(validPromiseDeliveryCheckDate('2026-12-31'), true);
  assert.equal(validPromiseDeliveryCheckDate('2026-02-29'), false);
  assert.equal(validPromiseDeliveryCheckDate('2028-02-29'), true);
  assert.equal(validPromiseDeliveryCheckDate('2026-04-31'), false);
  assert.equal(validPromiseDeliveryCheckDate('2026-13-01'), false);
  assert.equal(validPromiseDeliveryCheckDate('10-11-2026'), false);
  assert.equal(validPromiseDeliveryCheckDate(''), false);
  assert.equal(validPromiseDeliveryCheckDate(null), false);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, promiseDate: '2026-02-30' }), []);
  assert.deepEqual(recordPromiseDeliveryCheck([], { ...first, deliveredDate: '2026-02-30' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, promiseStatus: 'done', billAmount: 500, surprise: 'x' };
  const recorded = recordPromiseDeliveryCheck([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('promiseStatus' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal('promiseStatus' in raw, true);
  assert.deepEqual(raw.followups, undefined);
  const frozen = Object.freeze({ ...first });
  assert.doesNotThrow(() => recordPromiseDeliveryCheck([], frozen));
});

test('duplicate ids are never rewritten and one check per promise is kept', () => {
  const list = recordPromiseDeliveryCheck([], first);
  assert.deepEqual(recordPromiseDeliveryCheck(list, { ...first, note: 'Changed.' }), list);
  assert.deepEqual(recordPromiseDeliveryCheck(list, { ...first, id: 'PD-9', note: 'Changed.' }), list);
  assert.deepEqual(recordPromiseDeliveryCheck(list, { ...first, id: 'PD-9', promiseRef: 'p-101', note: 'Changed.' }), list);
  const other = recordPromiseDeliveryCheck(list, second);
  assert.equal(other.length, 2);
});

test('find and remove work by id', () => {
  const list = [first, second, third].reduce((acc, item) => recordPromiseDeliveryCheck(acc, item), []);
  assert.equal(findPromiseDeliveryCheck(list, 'PD-2').promiseRef, 'P-102');
  assert.equal(findPromiseDeliveryCheck(list, 'PD-9'), null);
  assert.equal(findPromiseDeliveryCheck(list, ''), null);
  assert.deepEqual(removePromiseDeliveryCheck(list, 'PD-2').map((item) => item.id), ['PD-1', 'PD-3']);
  assert.deepEqual(removePromiseDeliveryCheck(list, 'PD-9'), list);
});

test('sorting is by promise date, then promise reference, then id', () => {
  const list = [second, third, first].reduce((acc, item) => recordPromiseDeliveryCheck(acc, item), []);
  assert.deepEqual(promiseDeliveryCheckSorted(list).map((item) => item.id), ['PD-3', 'PD-1', 'PD-2']);
});

test('checks for one promise and one customer', () => {
  const list = [first, second, third].reduce((acc, item) => recordPromiseDeliveryCheck(acc, item), []);
  assert.deepEqual(checksForPromise(list, 'p-102').map((item) => item.id), ['PD-2']);
  assert.deepEqual(checksForPromise(list, ''), []);
  assert.deepEqual(checksForPromise(list, 'P-999'), []);
  assert.deepEqual(checksForCustomer(list, 'ahmed').map((item) => item.id), ['PD-3', 'PD-1']);
  assert.deepEqual(checksForCustomer(list, ''), []);
  assert.deepEqual(promiseDeliveryCheckCustomers(list), ['Ahmed', 'Bilal']);
});

test('missed promises appear on one list sorted by promise date', () => {
  const missedFirst = { ...third, id: 'PD-4', promiseRef: 'P-104', promiseDate: '2026-10-20', customer: 'Chaudhry' };
  const list = [first, second, third, missedFirst].reduce((acc, item) => recordPromiseDeliveryCheck(acc, item), []);
  assert.deepEqual(missedPromiseDeliveryChecks(list).map((item) => item.id), ['PD-4', 'PD-3']);
  assert.deepEqual(missedPromiseDeliveryChecks([first, second]).map((item) => item.id), []);
  assert.deepEqual(missedPromiseDeliveryChecks([]), []);
});

test('a check is never edited, only annotated with dated follow-up notes', () => {
  const list = recordPromiseDeliveryCheck([], first);
  const annotated = addPromiseDeliveryCheckNote(list, 'PD-1', '2026-11-08', 'Customer confirmed the fix held.');
  assert.equal(annotated[0].followups.length, 1);
  assert.equal(annotated[0].promised, first.promised);
  assert.equal(annotated[0].delivered, first.delivered);
  assert.equal(annotated[0].deliveredDate, first.deliveredDate);
  assert.equal(annotated[0].outcome, 'met');
  assert.equal(annotated[0].note, first.note);
  assert.deepEqual(addPromiseDeliveryCheckNote(list, 'PD-1', '2026-02-30', 'Bad date.'), list);
  assert.deepEqual(addPromiseDeliveryCheckNote(list, 'PD-1', '2026-11-08', ''), list);
  assert.deepEqual(addPromiseDeliveryCheckNote(list, 'PD-9', '2026-11-08', 'Unknown id.'), list);
});

test('summary text counts met, partly met and missed', () => {
  const list = [first, second, third].reduce((acc, item) => recordPromiseDeliveryCheck(acc, item), []);
  assert.equal(promiseDeliveryCheckSummaryText(list), '3 promise delivery checks: 1 met, 1 partly met, 1 missed.');
  assert.equal(promiseDeliveryCheckSummaryText([first]), '1 promise delivery check: 1 met, 0 partly met, 0 missed.');
  assert.equal(promiseDeliveryCheckSummaryText([]), 'No promise delivery checks recorded.');
});

test('promised versus delivered show side by side in text', () => {
  const text = promiseDeliveryCheckText(first);
  assert.equal(text.includes('promised \u201cVisit on Friday to fix the line\u201d'), true);
  assert.equal(text.includes('delivered \u201cVisit on Friday, line fixed\u201d on 2026-11-07: met'), true);
  assert.equal(text.includes('Customer happy.'), true);
  const withFollowups = promiseDeliveryCheckText(second);
  assert.equal(withFollowups.includes('Follow-ups: 2026-11-09: Speed still low, engineer to visit.'), true);
  assert.equal(promiseDeliveryCheckText(null), 'No promise delivery check recorded.');
  assert.equal(promiseDeliveryCheckText({ ...first, outcome: 'done' }), 'No promise delivery check recorded.');
});

test('HTML escapes markup and renders the side-by-side check', () => {
  const evil = { ...first, promised: '<script>alert(1)</script>', delivered: 'Fixed & tested' };
  const html = promiseDeliveryCheckHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('Fixed &amp; tested'), true);
  assert.equal(promiseDeliveryCheckHtml(null), '<p>No promise delivery check recorded.</p>');
  assert.equal(promiseDeliveryCheckAllHtml([]), '<p>No promise delivery checks recorded.</p>');
  const all = promiseDeliveryCheckAllHtml([second, first]);
  assert.equal(all.indexOf('P-101') < all.indexOf('P-102'), true);
});

test('CSV export has the promised and delivered columns in order', () => {
  const list = [first, second, third].reduce((acc, item) => recordPromiseDeliveryCheck(acc, item), []);
  const csv = promiseDeliveryCheckCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","promise reference","customer","promise date","promised","delivered","delivered date","outcome","note","follow-ups"');
  assert.equal(lines[1].includes('"P-103"'), true);
  assert.equal(lines[1].includes('"missed"'), true);
  assert.equal(lines[2].includes('"P-101"'), true);
  assert.equal(lines[2].includes('"met"'), true);
  assert.equal(promiseDeliveryCheckFilename(), 'promise-delivery-checks.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, note: 'Changed.' }, { id: 'PD-9' }, null, 'nope', second];
  assert.deepEqual(normalizePromiseDeliveryCheckList(messy).map((item) => item.id), ['PD-1', 'PD-2']);
  assert.deepEqual(normalizePromiseDeliveryCheckList('not a list'), []);
  assert.deepEqual(normalizePromiseDeliveryCheckList(undefined), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../promise-delivery-check.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the operator promise tracker is untouched', () => {
  const source = readFileSync(new URL('../promise-delivery-check.js', import.meta.url), 'utf8');
  assert.equal(source.includes('promise-tracker'), false, 'module must not reference the operator promise tracker module');
  assert.equal(existsSync(new URL('../promise-tracker.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'pdcHeading', 'pdcSummary', 'pdcList', 'pdcExportBtn',
    'pdcPromiseRef', 'pdcCustomer', 'pdcPromiseDate', 'pdcPromised', 'pdcDelivered', 'pdcDeliveredDate', 'pdcOutcome', 'pdcNote', 'pdcRecordBtn',
    'pdcAnnotateId', 'pdcAnnotateDate', 'pdcAnnotateNote', 'pdcAnnotateBtn',
    'pdcRemoveId', 'pdcRemoveBtn',
    'pdcMissedBtn', 'pdcMissedBody',
    'pdcFilterPromise', 'pdcFilterBtn', 'pdcFilterBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the promise delivery check panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './promise-delivery-check.js'"), true);
  assert.equal(source.includes('renderPromiseDeliveryChecks()'), true);
  assert.equal(source.includes('PROMISE_DELIVERY_CHECK_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
