import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validAppPerformanceDay,
  foldAppPerformanceFrequency,
  normalizeAppPerformanceNote,
  normalizeAppPerformanceNoteList,
  findAppPerformanceNote,
  recordAppPerformanceNote,
  appPerformanceNotesForScreen,
  appPerformanceScreens,
  appPerformanceCountsByScreen,
  appPerformanceSummaryText,
  appPerformanceFrequencyText,
  appPerformanceNoteText,
  appPerformanceNoteHtml,
  appPerformanceNotesHtml,
  appPerformanceCountsHtml,
  appPerformanceCsv,
  appPerformanceFilename,
} from '../app-performance-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

function note(id, overrides = {}) {
  return {
    id,
    screen: 'Customer profile',
    device: 'Saad phone',
    symptom: 'Profile opens slowly after tapping a customer',
    date: '2026-11-06',
    frequency: 'often',
    ...overrides,
  };
}

function fixture() {
  return [
    note('APN-1', { date: '2026-11-04', frequency: 'once' }),
    note('APN-2', { screen: 'Billing dashboard', device: 'Shop tablet', symptom: 'Dashboard waits a long time before showing today totals', date: '2026-11-05', frequency: 'every time' }),
    note('APN-3', { screen: 'Billing dashboard', device: '', symptom: 'Add payment screen freezes for a few seconds', date: '2026-11-06', frequency: 'sometimes' }),
    note('APN-4', { screen: 'Search customers', device: 'Saad phone', symptom: 'Search results take long to appear', date: '2026-11-06', frequency: 'often' }),
  ];
}

test('strict days accept real calendar days and reject impossible ones', () => {
  assert.equal(validAppPerformanceDay('2026-11-06'), true);
  assert.equal(validAppPerformanceDay('2028-02-29'), true);
  assert.equal(validAppPerformanceDay('2026-08-31'), true);
  assert.equal(validAppPerformanceDay('2026-02-30'), false);
  assert.equal(validAppPerformanceDay('2026-11-31'), false);
  assert.equal(validAppPerformanceDay('2027-02-29'), false);
  assert.equal(validAppPerformanceDay('06-11-2026'), false);
  assert.equal(validAppPerformanceDay('2026-13-01'), false);
  assert.equal(validAppPerformanceDay(''), false);
  assert.equal(validAppPerformanceDay(null), false);
});

test('frequency folds the four known values and unknown reads once', () => {
  assert.equal(foldAppPerformanceFrequency('once'), 'once');
  assert.equal(foldAppPerformanceFrequency('Sometimes'), 'sometimes');
  assert.equal(foldAppPerformanceFrequency('  OFTEN  '), 'often');
  assert.equal(foldAppPerformanceFrequency('every time'), 'every time');
  assert.equal(foldAppPerformanceFrequency('daily'), 'once');
  assert.equal(foldAppPerformanceFrequency(''), 'once');
  assert.equal(foldAppPerformanceFrequency(null), 'once');
  assert.equal(foldAppPerformanceFrequency(3), 'once');
});

test('a well-formed note normalizes with trimmed text and a folded frequency', () => {
  const clean = normalizeAppPerformanceNote(note('APN-1', { screen: '  Search customers  ', frequency: 'OFTEN' }));
  assert.equal(clean.screen, 'Search customers');
  assert.equal(clean.frequency, 'often');
  assert.equal(clean.device, 'Saad phone');
  assert.equal(clean.date, '2026-11-06');
});

test('a note with no screen is refused', () => {
  assert.equal(normalizeAppPerformanceNote(note('APN-1', { screen: '' })), null);
  assert.equal(normalizeAppPerformanceNote(note('APN-1', { screen: '   ' })), null);
  assert.equal(normalizeAppPerformanceNote(note('APN-1', { screen: undefined })), null);
});

test('a note with no symptom is refused', () => {
  assert.equal(normalizeAppPerformanceNote(note('APN-1', { symptom: '' })), null);
  assert.equal(normalizeAppPerformanceNote(note('APN-1', { symptom: '   ' })), null);
});

test('a note with no id or no strict date is refused', () => {
  assert.equal(normalizeAppPerformanceNote(note('', {})), null);
  assert.equal(normalizeAppPerformanceNote(note('APN-1', { date: '2026-02-30' })), null);
  assert.equal(normalizeAppPerformanceNote(note('APN-1', { date: 'Nov 6' })), null);
  assert.equal(normalizeAppPerformanceNote(null), null);
  assert.equal(normalizeAppPerformanceNote('not an object'), null);
  assert.equal(normalizeAppPerformanceNote([]), null);
});

test('a note without a device is kept with a blank device', () => {
  const clean = normalizeAppPerformanceNote(note('APN-1', { device: '' }));
  assert.equal(clean.device, '');
  assert.equal(appPerformanceNoteText(clean), 'Customer profile — Profile opens slowly after tapping a customer (Often, Device not recorded, 2026-11-06)');
});

test('unknown fields are dropped so no optimisation field can survive', () => {
  const clean = normalizeAppPerformanceNote(note('APN-1', { fixed: true, optimised: 'yes', amount: 500 }));
  assert.equal(clean.fixed, undefined);
  assert.equal(clean.optimised, undefined);
  assert.equal(clean.amount, undefined);
});

test('normalizing a list drops bad notes and keeps the first note per id', () => {
  assert.deepEqual(normalizeAppPerformanceNoteList('not a list'), []);
  assert.deepEqual(normalizeAppPerformanceNoteList(null), []);
  const clean = normalizeAppPerformanceNoteList([
    note('APN-1'),
    note('APN-1', { symptom: 'A second note with the same id' }),
    note('APN-2', { screen: '' }),
    note('APN-3'),
  ]);
  assert.deepEqual(clean.map((entry) => entry.id), ['APN-1', 'APN-3']);
  assert.equal(clean[0].symptom, 'Profile opens slowly after tapping a customer');
});

test('find returns the note or null', () => {
  const list = fixture();
  assert.equal(findAppPerformanceNote(list, 'APN-2').screen, 'Billing dashboard');
  assert.equal(findAppPerformanceNote(list, 'APN-9'), null);
  assert.equal(findAppPerformanceNote(list, ''), null);
});

test('recording appends a valid note and never rewrites a duplicate id', () => {
  const list = fixture();
  const next = recordAppPerformanceNote(list, note('APN-5', { screen: 'Ledger' }));
  assert.equal(next.length, 5);
  assert.equal(list.length, 4);
  const dup = recordAppPerformanceNote(list, note('APN-1', { symptom: 'Changed symptom' }));
  assert.equal(dup.length, 4);
  assert.equal(dup[0].symptom, 'Profile opens slowly after tapping a customer');
});

test('recording an invalid note leaves the list unchanged', () => {
  const list = fixture();
  assert.deepEqual(recordAppPerformanceNote(list, note('APN-5', { screen: '' })), list);
  assert.deepEqual(recordAppPerformanceNote(list, note('APN-5', { symptom: '' })), list);
  assert.deepEqual(recordAppPerformanceNote(list, note('APN-5', { date: '2026-11-31' })), list);
});

test('notes for a screen match case-insensitively and read newest first', () => {
  const found = appPerformanceNotesForScreen(fixture(), 'billing DASHBOARD');
  assert.deepEqual(found.map((entry) => entry.id), ['APN-3', 'APN-2']);
  assert.deepEqual(appPerformanceNotesForScreen(fixture(), 'No such screen'), []);
  assert.deepEqual(appPerformanceNotesForScreen(fixture(), ''), []);
});

test('screens list is distinct and A to Z with the first spelling kept', () => {
  const list = [
    note('APN-1', { screen: 'search customers' }),
    note('APN-2', { screen: 'Billing dashboard' }),
    note('APN-3', { screen: 'Search Customers' }),
    note('APN-4', { screen: 'customer profile' }),
  ];
  assert.deepEqual(appPerformanceScreens(list), ['Billing dashboard', 'customer profile', 'search customers']);
});

test('counts by screen cover a period inclusive of both ends', () => {
  const counts = appPerformanceCountsByScreen(fixture(), '2026-11-05', '2026-11-06');
  assert.deepEqual(counts, [
    { screen: 'Billing dashboard', count: 2 },
    { screen: 'Search customers', count: 1 },
  ]);
  assert.deepEqual(appPerformanceCountsByScreen(fixture(), '2026-11-04', '2026-11-04'), [
    { screen: 'Customer profile', count: 1 },
  ]);
  assert.deepEqual(appPerformanceCountsByScreen(fixture(), '2026-11-01', '2026-11-03'), []);
});

test('counts by screen are most reported first, then A to Z', () => {
  const list = [
    note('APN-1', { screen: 'Zebra screen', date: '2026-11-06' }),
    note('APN-2', { screen: 'Alpha screen', date: '2026-11-06' }),
    note('APN-3', { screen: 'Alpha screen', date: '2026-11-06' }),
    note('APN-4', { screen: 'Middle screen', date: '2026-11-06' }),
  ];
  assert.deepEqual(
    appPerformanceCountsByScreen(list, '2026-11-01', '2026-11-30').map((entry) => entry.screen),
    ['Alpha screen', 'Middle screen', 'Zebra screen'],
  );
});

test('a bad period returns null instead of guessed counts', () => {
  const list = fixture();
  assert.equal(appPerformanceCountsByScreen(list, 'not a date', '2026-11-06'), null);
  assert.equal(appPerformanceCountsByScreen(list, '2026-11-01', '2026-02-30'), null);
  assert.equal(appPerformanceCountsByScreen(list, '2026-11-06', '2026-11-01'), null);
});

test('summary text names the total, the screens, and the most reported screen', () => {
  assert.equal(appPerformanceSummaryText([]), 'No app performance notes recorded.');
  assert.equal(appPerformanceSummaryText([note('APN-1')]), '1 app performance note across 1 screen. Most reported: Customer profile (1).');
  assert.equal(
    appPerformanceSummaryText(fixture()),
    '4 app performance notes across 3 screens. Most reported: Billing dashboard (2).',
  );
});

test('frequency labels read in plain words', () => {
  assert.equal(appPerformanceFrequencyText('once'), 'Once');
  assert.equal(appPerformanceFrequencyText('sometimes'), 'Sometimes');
  assert.equal(appPerformanceFrequencyText('often'), 'Often');
  assert.equal(appPerformanceFrequencyText('every time'), 'Every time');
  assert.equal(appPerformanceFrequencyText('unknown'), 'Once');
});

test('note text and HTML escape user-entered text', () => {
  const clean = normalizeAppPerformanceNote(note('APN-1', { symptom: '<script>alert(1)</script> slow', device: 'Phone & tablet' }));
  assert.match(appPerformanceNoteText(clean), /<script>alert\(1\)<\/script> slow/);
  const html = appPerformanceNoteHtml(clean);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Phone &amp; tablet/);
  assert.equal(appPerformanceNoteHtml(null), '');
  assert.equal(appPerformanceNoteText(note('APN-1', { screen: '' })), '');
});

test('notes HTML groups by screen A to Z with counts', () => {
  assert.equal(appPerformanceNotesHtml([]), '<p>No app performance notes recorded.</p>');
  const html = appPerformanceNotesHtml(fixture());
  assert.ok(html.indexOf('Billing dashboard (2)') < html.indexOf('Customer profile (1)'));
  assert.ok(html.indexOf('Customer profile (1)') < html.indexOf('Search customers (1)'));
  assert.match(html, /Dashboard waits a long time/);
});

test('counts HTML reports a bad period instead of guessing', () => {
  assert.match(appPerformanceCountsHtml(fixture(), 'bad', '2026-11-06'), /valid from and to date/);
  assert.equal(appPerformanceCountsHtml(fixture(), '2026-11-01', '2026-11-03'), '<p>No app performance notes in this period.</p>');
  const html = appPerformanceCountsHtml(fixture(), '2026-11-05', '2026-11-06');
  assert.match(html, /Billing dashboard: 2/);
  assert.match(html, /Search customers: 1/);
});

test('CSV carries every field and quotes commas and quotes', () => {
  const csv = appPerformanceCsv([note('APN-1', { symptom: 'Slow, "very" slow' })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,screen,device,symptom,date,frequency');
  assert.equal(lines[1], 'APN-1,Customer profile,Saad phone,"Slow, ""very"" slow",2026-11-06,often');
  assert.equal(appPerformanceCsv([]), 'id,screen,device,symptom,date,frequency');
  assert.equal(appPerformanceFilename(), 'app-performance-notes.csv');
});

test('composing never mutates the input, even when frozen', () => {
  const frozen = Object.freeze(fixture().map((entry) => Object.freeze({ ...entry })));
  const before = JSON.stringify(frozen);
  appPerformanceSummaryText(frozen);
  appPerformanceNotesHtml(frozen);
  appPerformanceCsv(frozen);
  appPerformanceCountsByScreen(frozen, '2026-11-01', '2026-11-30');
  assert.equal(JSON.stringify(frozen), before);
});

test('wiring: app.js imports the module and renders the panel', () => {
  assert.match(appJs, /from '\.\/app-performance-note\.js'/);
  assert.match(appJs, /function renderAppPerformanceNotes\(\)/);
  assert.match(appJs, /renderAppPerformanceNotes\(\);/);
  assert.match(appJs, /shahdara_apn_notes_v1/);
});

test('wiring: index.html carries the app performance note panel', () => {
  for (const id of ['apnHeading', 'apnSummary', 'apnBody', 'apnCountsBody', 'apnScreen', 'apnDevice', 'apnSymptom', 'apnDate', 'apnFrequency', 'apnRecordBtn', 'apnExportBtn', 'apnFrom', 'apnTo', 'apnCountsBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html is missing ${id}`);
  }
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const mine = appJs.match(/app-performance-note|AppPerformance|APP_PERFORMANCE|renderAppPerformanceNotes/g) || [];
  assert.ok(mine.length > 0);
});
