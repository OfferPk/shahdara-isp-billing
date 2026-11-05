import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validServiceTrialDate,
  foldTrialOutcome,
  normalizeServiceTrial,
  normalizeServiceTrialList,
  findServiceTrial,
  recordServiceTrial,
  removeServiceTrial,
  serviceTrialSorted,
  serviceTrialsForCustomer,
  serviceTrialCustomers,
  overlappingServiceTrials,
  serviceTrialHasOverlap,
  serviceTrialSummaryText,
  serviceTrialText,
  serviceTrialHtml,
  serviceTrialAllHtml,
  serviceTrialCsv,
  serviceTrialFilename,
} from '../service-trial.js';

const first = { id: 'ST-1', customer: 'Ahmed Raza', package: '5 Mbps / 200 GB', startDate: '2026-11-01', endDate: '2026-11-07', outcome: 'kept', note: 'Happy with the speed.' };
const second = { id: 'ST-2', customer: 'Ahmed Raza', package: '5 Mbps / 500 GB', startDate: '2026-11-05', endDate: '2026-11-11', outcome: 'declined', note: '' };
const third = { id: 'ST-3', customer: 'Bilal Khan', package: '3 Mbps / 100 GB', startDate: '2026-11-05', endDate: '2026-11-11', outcome: '', note: 'Still deciding.' };

test('half-formed trials are refused', () => {
  assert.deepEqual(recordServiceTrial([], { ...first, id: '' }), []);
  assert.deepEqual(recordServiceTrial([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordServiceTrial([], { ...first, package: '' }), []);
  assert.deepEqual(recordServiceTrial([], { ...first, startDate: '' }), []);
  assert.deepEqual(recordServiceTrial([], { ...first, endDate: '' }), []);
  assert.deepEqual(recordServiceTrial([], { ...first, startDate: '2026-11-07', endDate: '2026-11-01' }), []);
  assert.deepEqual(recordServiceTrial([], { ...first, startDate: '2026-02-30' }), []);
  const sameDay = recordServiceTrial([], { ...first, startDate: '2026-11-03', endDate: '2026-11-03' });
  assert.equal(sameDay.length, 1);
  assert.equal(sameDay[0].outcome, 'kept');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validServiceTrialDate('2026-08-31'), true);
  assert.equal(validServiceTrialDate('2026-10-31'), true);
  assert.equal(validServiceTrialDate('2026-12-31'), true);
  assert.equal(validServiceTrialDate('2026-02-29'), false);
  assert.equal(validServiceTrialDate('2028-02-29'), true);
  assert.equal(validServiceTrialDate('2026-04-31'), false);
  assert.equal(validServiceTrialDate('2026-13-01'), false);
  assert.equal(validServiceTrialDate('10-11-2026'), false);
  assert.equal(validServiceTrialDate(''), false);
  assert.equal(validServiceTrialDate(null), false);
  assert.deepEqual(recordServiceTrial([], { ...first, endDate: '2026-02-30' }), []);
});

test('outcome folding and the in-progress default', () => {
  assert.equal(foldTrialOutcome('kept'), 'kept');
  assert.equal(foldTrialOutcome('Keep'), 'kept');
  assert.equal(foldTrialOutcome('stayed'), 'kept');
  assert.equal(foldTrialOutcome(true), 'kept');
  assert.equal(foldTrialOutcome('declined'), 'declined');
  assert.equal(foldTrialOutcome('Decline'), 'declined');
  assert.equal(foldTrialOutcome('no'), 'declined');
  assert.equal(foldTrialOutcome(false), 'declined');
  assert.equal(foldTrialOutcome(''), 'in progress');
  assert.equal(foldTrialOutcome('maybe'), 'in progress');
  assert.equal(foldTrialOutcome(undefined), 'in progress');
  assert.equal(normalizeServiceTrial(third).outcome, 'in progress');
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 1500, packagePrice: 2000, surprise: 'x' };
  const recorded = recordServiceTrial([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('packagePrice' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.billAmount, 1500);
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'customer', 'endDate', 'id', 'note', 'outcome', 'package', 'packagePrice', 'startDate', 'surprise']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordServiceTrial([], first);
  assert.deepEqual(recordServiceTrial(list, { ...first, note: 'Changed.' }), list);
  assert.deepEqual(recordServiceTrial(list, { ...second, id: 'ST-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordServiceTrial(acc, item), []);
  assert.equal(findServiceTrial(list, 'ST-2').customer, 'Ahmed Raza');
  assert.equal(findServiceTrial(list, 'ST-9'), null);
  assert.equal(findServiceTrial(list, ''), null);
  assert.deepEqual(removeServiceTrial(list, 'ST-2').map((item) => item.id), ['ST-1', 'ST-3']);
  assert.deepEqual(removeServiceTrial(list, ''), list);
});

test('sorting is by start date, then customer, then id', () => {
  const list = [third, second, first].reduce((acc, item) => recordServiceTrial(acc, item), []);
  assert.deepEqual(serviceTrialSorted(list).map((item) => item.id), ['ST-1', 'ST-2', 'ST-3']);
});

test('a customer page lists trials in date order', () => {
  const list = [second, first, third].reduce((acc, item) => recordServiceTrial(acc, item), []);
  assert.deepEqual(serviceTrialsForCustomer(list, 'ahmed raza').map((item) => item.id), ['ST-1', 'ST-2']);
  assert.deepEqual(serviceTrialsForCustomer(list, 'Bilal Khan').map((item) => item.id), ['ST-3']);
  assert.deepEqual(serviceTrialsForCustomer(list, ''), []);
  assert.deepEqual(serviceTrialsForCustomer(list, 'Nobody'), []);
});

test('overlapping trials for the same customer are flagged', () => {
  const list = [first, second, third].reduce((acc, item) => recordServiceTrial(acc, item), []);
  assert.deepEqual(overlappingServiceTrials(list).map((item) => item.id), ['ST-1', 'ST-2']);
  assert.deepEqual(overlappingServiceTrials([first, third]).map((item) => item.id), []);
  assert.deepEqual(overlappingServiceTrials([first]).map((item) => item.id), []);
  const touching = recordServiceTrial(
    recordServiceTrial([], { ...first, id: 'ST-9', startDate: '2026-11-07', endDate: '2026-11-09', outcome: 'kept' }),
    { ...first, id: 'ST-10', startDate: '2026-11-01', endDate: '2026-11-07', outcome: 'kept' },
  );
  assert.deepEqual(overlappingServiceTrials(touching).map((item) => item.id), ['ST-10', 'ST-9']);
  const adjacent = recordServiceTrial(
    recordServiceTrial([], { ...first, id: 'ST-9', startDate: '2026-11-08', endDate: '2026-11-09', outcome: 'kept' }),
    { ...first, id: 'ST-10', startDate: '2026-11-01', endDate: '2026-11-07', outcome: 'kept' },
  );
  assert.deepEqual(overlappingServiceTrials(adjacent).map((item) => item.id), []);
});

test('has-overlap checks a candidate trial against the list', () => {
  const list = recordServiceTrial([], first);
  assert.equal(serviceTrialHasOverlap(list, { ...second, id: 'ST-9' }), true);
  assert.equal(serviceTrialHasOverlap(list, { ...third, id: 'ST-9' }), false);
  assert.equal(serviceTrialHasOverlap(list, { ...first, id: 'ST-1' }), false);
  assert.equal(serviceTrialHasOverlap(list, { ...second, id: 'ST-9', startDate: 'bad' }), false);
});

test('customer list keeps the first spelling', () => {
  const list = [
    { id: 'ST-1', customer: 'Ahmed Raza', package: '5 Mbps / 200 GB', startDate: '2026-11-01', endDate: '2026-11-07', outcome: 'kept' },
    { id: 'ST-2', customer: 'AHMED RAZA', package: '5 Mbps / 500 GB', startDate: '2026-11-08', endDate: '2026-11-14', outcome: 'declined' },
    { id: 'ST-3', customer: 'Bilal Khan', package: '3 Mbps / 100 GB', startDate: '2026-11-09', endDate: '2026-11-15', outcome: 'kept' },
  ].reduce((acc, item) => recordServiceTrial(acc, item), []);
  assert.deepEqual(serviceTrialCustomers(list), ['Ahmed Raza', 'Bilal Khan']);
});

test('summary and entry text name the customer, package, dates, and outcome plainly', () => {
  assert.equal(serviceTrialSummaryText([]), 'No service trials recorded.');
  assert.equal(serviceTrialSummaryText([first, second]), '2 service trials recorded, 1 kept, 1 declined, 0 in progress.');
  assert.equal(serviceTrialSummaryText([third]), '1 service trial recorded, 0 kept, 0 declined, 1 in progress.');
  const text = serviceTrialText(first);
  assert.equal(text.includes('2026-11-01'), true);
  assert.equal(text.includes('2026-11-07'), true);
  assert.equal(text.includes('Ahmed Raza'), true);
  assert.equal(text.includes('5 Mbps / 200 GB'), true);
  assert.equal(text.includes('kept'), true);
  assert.equal(text.includes('Happy with the speed.'), true);
  assert.equal(serviceTrialText(second).includes('Happy'), false);
  assert.equal(serviceTrialText(null), 'No service trial recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, note: '<script>alert(1)</script>' };
  const html = serviceTrialHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(serviceTrialHtml(null), '<p>No service trial recorded.</p>');
  assert.equal(serviceTrialAllHtml([]), '<p>No service trials recorded.</p>');
  assert.equal(serviceTrialAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = serviceTrialCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","package","start date","end date","outcome","note"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('ST-1'), true);
  assert.equal(lines[1].includes('Happy with the speed.'), true);
  assert.equal(serviceTrialFilename(), 'service-trials.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'ST-9', customer: '', package: '5 Mbps / 200 GB', startDate: '2026-11-10', endDate: '2026-11-16', outcome: 'kept' };
  const out = normalizeServiceTrialList([bad, first, { ...first, note: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['ST-1', 'ST-2']);
  assert.equal(out[0].note, first.note);
  assert.deepEqual(normalizeServiceTrialList('nope'), []);
  assert.deepEqual(normalizeServiceTrialList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../service-trial.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the package preview, the change queue, and the first-bill preview are untouched', () => {
  const source = readFileSync(new URL('../service-trial.js', import.meta.url), 'utf8');
  assert.equal(source.includes('package-change-preview.js'), false, 'module must not reference the package-change preview module');
  assert.equal(source.includes('change-requests.js'), false, 'module must not reference the plan-change queue module');
  assert.equal(source.includes('first-bill-preview.js'), false, 'module must not reference the first-bill preview module');
  assert.equal(existsSync(new URL('../package-change-preview.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../change-requests.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../first-bill-preview.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'svHeading', 'svSummary', 'svList', 'svExportBtn',
    'svCustomer', 'svPackage', 'svStart', 'svEnd', 'svOutcome', 'svNote', 'svRecordBtn',
    'svRemoveId', 'svRemoveBtn',
    'svFilterCustomer', 'svFilterBtn', 'svCustomerBody',
    'svOverlapBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the service trial panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './service-trial.js'"), true);
  assert.equal(source.includes('renderServiceTrials()'), true);
  assert.equal(source.includes('SERVICE_TRIAL_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
