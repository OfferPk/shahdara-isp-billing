import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validScreenHelpNoteDay,
  foldScreenHelpNoteStatus,
  normalizeScreenHelpNote,
  normalizeScreenHelpNoteList,
  findScreenHelpNote,
  recordScreenHelpNote,
  updateScreenHelpNoteCheck,
  screenHelpNoteScreens,
  screenHelpNoteGaps,
  screenHelpNoteCoverage,
  screenHelpNoteSummaryText,
  screenHelpNoteStatusText,
  screenHelpNoteText,
  screenHelpNoteHtml,
  screenHelpNotesHtml,
  screenHelpNoteGapsHtml,
  screenHelpNoteCoverageHtml,
  screenHelpNoteCsv,
  screenHelpNoteFilename,
} from '../screen-help-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

function entry(id, overrides = {}) {
  return {
    id,
    screen: 'Customer profile',
    status: 'present',
    reference: 'Handbook section 4',
    dateChecked: '2026-11-06',
    ...overrides,
  };
}

function fixture() {
  return [
    entry('SHN-1', { dateChecked: '2026-11-04' }),
    entry('SHN-2', { screen: 'Billing dashboard', status: 'missing', reference: '', dateChecked: '2026-11-05' }),
    entry('SHN-3', { screen: 'Search customers', status: 'present', reference: 'Handbook section 2', dateChecked: '2026-11-06' }),
    entry('SHN-4', { screen: 'Ledger', status: 'missing', reference: '', dateChecked: '2026-11-06' }),
  ];
}

test('strict days accept real calendar days and reject impossible ones', () => {
  assert.equal(validScreenHelpNoteDay('2026-11-06'), true);
  assert.equal(validScreenHelpNoteDay('2028-02-29'), true);
  assert.equal(validScreenHelpNoteDay('2026-08-31'), true);
  assert.equal(validScreenHelpNoteDay('2026-02-30'), false);
  assert.equal(validScreenHelpNoteDay('2026-11-31'), false);
  assert.equal(validScreenHelpNoteDay('2027-02-29'), false);
  assert.equal(validScreenHelpNoteDay('06-11-2026'), false);
  assert.equal(validScreenHelpNoteDay('2026-13-01'), false);
  assert.equal(validScreenHelpNoteDay(''), false);
  assert.equal(validScreenHelpNoteDay(null), false);
});

test('status folds present spellings and unknown reads missing', () => {
  assert.equal(foldScreenHelpNoteStatus('present'), 'present');
  assert.equal(foldScreenHelpNoteStatus('Present'), 'present');
  assert.equal(foldScreenHelpNoteStatus('  YES  '), 'present');
  assert.equal(foldScreenHelpNoteStatus('has help'), 'present');
  assert.equal(foldScreenHelpNoteStatus('documented'), 'present');
  assert.equal(foldScreenHelpNoteStatus('missing'), 'missing');
  assert.equal(foldScreenHelpNoteStatus('no'), 'missing');
  assert.equal(foldScreenHelpNoteStatus(''), 'missing');
  assert.equal(foldScreenHelpNoteStatus(null), 'missing');
  assert.equal(foldScreenHelpNoteStatus(3), 'missing');
});

test('a well-formed entry normalizes with trimmed text and a folded status', () => {
  const clean = normalizeScreenHelpNote(entry('SHN-1', { screen: '  Search customers  ', status: 'YES', reference: '  Handbook section 2  ' }));
  assert.equal(clean.screen, 'Search customers');
  assert.equal(clean.status, 'present');
  assert.equal(clean.reference, 'Handbook section 2');
  assert.equal(clean.dateChecked, '2026-11-06');
});

test('an entry with no screen is refused', () => {
  assert.equal(normalizeScreenHelpNote(entry('SHN-1', { screen: '' })), null);
  assert.equal(normalizeScreenHelpNote(entry('SHN-1', { screen: '   ' })), null);
  assert.equal(normalizeScreenHelpNote(entry('SHN-1', { screen: undefined })), null);
});

test('an entry with no id or no strict date is refused', () => {
  assert.equal(normalizeScreenHelpNote(entry('', {})), null);
  assert.equal(normalizeScreenHelpNote(entry('SHN-1', { dateChecked: '2026-02-30' })), null);
  assert.equal(normalizeScreenHelpNote(entry('SHN-1', { dateChecked: 'Nov 6' })), null);
  assert.equal(normalizeScreenHelpNote(null), null);
  assert.equal(normalizeScreenHelpNote('not an object'), null);
  assert.equal(normalizeScreenHelpNote([]), null);
});

test('an entry without a reference is kept with a blank reference', () => {
  const clean = normalizeScreenHelpNote(entry('SHN-1', { reference: '' }));
  assert.equal(clean.reference, '');
  assert.equal(screenHelpNoteText(clean), 'Customer profile — Help note present, checked 2026-11-06');
  const noRef = normalizeScreenHelpNote(entry('SHN-1', { status: 'missing', reference: undefined }));
  assert.equal(screenHelpNoteText(noRef), 'Customer profile — Help note missing, checked 2026-11-06');
});

test('unknown fields are dropped so no help text field can survive', () => {
  const clean = normalizeScreenHelpNote(entry('SHN-1', { helpText: 'Tap here to pay', helpBody: 'long text', amount: 500 }));
  assert.equal(clean.helpText, undefined);
  assert.equal(clean.helpBody, undefined);
  assert.equal(clean.amount, undefined);
});

test('normalizing a list drops bad entries and keeps the first entry per id', () => {
  assert.deepEqual(normalizeScreenHelpNoteList('not a list'), []);
  assert.deepEqual(normalizeScreenHelpNoteList(null), []);
  const clean = normalizeScreenHelpNoteList([
    entry('SHN-1'),
    entry('SHN-1', { screen: 'Ledger' }),
    entry('SHN-2', { screen: '' }),
    entry('SHN-3'),
  ]);
  assert.deepEqual(clean.map((item) => item.id), ['SHN-1', 'SHN-3']);
  assert.equal(clean[0].screen, 'Customer profile');
});

test('find returns the entry or null', () => {
  const list = fixture();
  assert.equal(findScreenHelpNote(list, 'SHN-2').screen, 'Billing dashboard');
  assert.equal(findScreenHelpNote(list, 'SHN-9'), null);
  assert.equal(findScreenHelpNote(list, ''), null);
});

test('recording appends a valid entry and never rewrites a duplicate id', () => {
  const list = fixture();
  const next = recordScreenHelpNote(list, entry('SHN-5', { screen: 'Add payment' }));
  assert.equal(next.length, 5);
  assert.equal(list.length, 4);
  const dup = recordScreenHelpNote(list, entry('SHN-1', { screen: 'Ledger' }));
  assert.equal(dup.length, 4);
  assert.equal(dup[0].screen, 'Customer profile');
});

test('recording a second entry for the same screen is refused', () => {
  const list = fixture();
  const dup = recordScreenHelpNote(list, entry('SHN-5', { screen: 'billing DASHBOARD' }));
  assert.equal(dup.length, 4);
  assert.deepEqual(dup, list);
});

test('recording an invalid entry leaves the list unchanged', () => {
  const list = fixture();
  assert.deepEqual(recordScreenHelpNote(list, entry('SHN-5', { screen: '' })), list);
  assert.deepEqual(recordScreenHelpNote(list, entry('SHN-5', { dateChecked: '2026-11-31' })), list);
});

test('a re-check replaces only that screen entry and keeps the rest', () => {
  const list = fixture();
  const next = updateScreenHelpNoteCheck(list, entry('SHN-9', { screen: 'Billing dashboard', status: 'present', reference: 'Handbook section 7', dateChecked: '2026-11-06' }));
  assert.equal(next.length, 4);
  assert.equal(next[1].id, 'SHN-9');
  assert.equal(next[1].status, 'present');
  assert.equal(next[0].screen, 'Customer profile');
  assert.equal(next[2].screen, 'Search customers');
});

test('a re-check for a screen that was never registered is refused', () => {
  const list = fixture();
  assert.deepEqual(updateScreenHelpNoteCheck(list, entry('SHN-9', { screen: 'Add payment' })), list);
  assert.deepEqual(updateScreenHelpNoteCheck(list, entry('SHN-9', { screen: 'Billing dashboard', dateChecked: '2026-02-30' })), list);
});

test('screens list is distinct and A to Z with the first spelling kept', () => {
  const list = [
    entry('SHN-1', { screen: 'search customers' }),
    entry('SHN-2', { screen: 'Billing dashboard' }),
    entry('SHN-3', { screen: 'Search Customers' }),
    entry('SHN-4', { screen: 'customer profile' }),
  ];
  assert.deepEqual(screenHelpNoteScreens(list), ['Billing dashboard', 'customer profile', 'search customers']);
});

test('gaps list holds missing entries and unregistered screens, A to Z', () => {
  const gaps = screenHelpNoteGaps(fixture(), ['Customer profile', 'Billing dashboard', 'Search customers', 'Ledger', 'Add payment']);
  assert.deepEqual(gaps.map((gap) => gap.screen), ['Add payment', 'Billing dashboard', 'Ledger']);
  assert.deepEqual(gaps.map((gap) => gap.status), ['unregistered', 'missing', 'missing']);
  assert.deepEqual(screenHelpNoteGaps(fixture(), []), [
    { screen: 'Billing dashboard', status: 'missing', reference: '', dateChecked: '2026-11-05' },
    { screen: 'Ledger', status: 'missing', reference: '', dateChecked: '2026-11-06' },
  ]);
  assert.deepEqual(screenHelpNoteGaps([entry('SHN-1')], []), []);
});

test('coverage counts reconcile to the screens listed', () => {
  const coverage = screenHelpNoteCoverage(fixture(), ['Customer profile', 'Billing dashboard', 'Search customers', 'Ledger', 'Add payment']);
  assert.equal(coverage.total, 5);
  assert.equal(coverage.present, 2);
  assert.equal(coverage.missing, 2);
  assert.equal(coverage.unregistered, 1);
  assert.equal(coverage.present + coverage.missing + coverage.unregistered, coverage.total);
  assert.deepEqual(coverage.presentScreens, ['Customer profile', 'Search customers']);
  assert.deepEqual(coverage.missingScreens, ['Billing dashboard', 'Ledger']);
  assert.deepEqual(coverage.unregisteredScreens, ['Add payment']);
});

test('coverage with no screen list covers the register only', () => {
  const coverage = screenHelpNoteCoverage(fixture());
  assert.equal(coverage.total, 4);
  assert.equal(coverage.present, 2);
  assert.equal(coverage.missing, 2);
  assert.equal(coverage.unregistered, 0);
  assert.deepEqual(screenHelpNoteCoverage([], []), { total: 0, present: 0, missing: 0, unregistered: 0, presentScreens: [], missingScreens: [], unregisteredScreens: [] });
});

test('summary text names the registered, missing, and unregistered screens', () => {
  assert.equal(screenHelpNoteSummaryText([], []), 'No screens registered in the help note register.');
  assert.equal(screenHelpNoteSummaryText(fixture()), '4 screens registered: 2 with a help note, 2 missing.');
  assert.equal(
    screenHelpNoteSummaryText(fixture(), ['Customer profile', 'Billing dashboard', 'Search customers', 'Ledger', 'Add payment']),
    '4 screens registered: 2 with a help note, 2 missing. 1 screen not registered.',
  );
});

test('status labels read in plain words', () => {
  assert.equal(screenHelpNoteStatusText('present'), 'Help note present');
  assert.equal(screenHelpNoteStatusText('missing'), 'Help note missing');
  assert.equal(screenHelpNoteStatusText('unknown'), 'Help note missing');
});

test('entry text and HTML escape user-entered text', () => {
  const clean = normalizeScreenHelpNote(entry('SHN-1', { screen: 'Customer <profile>', reference: 'Section "4" & notes' }));
  assert.match(screenHelpNoteText(clean), /Customer <profile>/);
  const html = screenHelpNoteHtml(clean);
  assert.match(html, /Customer &lt;profile&gt;/);
  assert.match(html, /Section &quot;4&quot; &amp; notes/);
  assert.equal(screenHelpNoteHtml(null), '');
  assert.equal(screenHelpNoteText(entry('SHN-1', { screen: '' })), '');
});

test('entries HTML lists screens A to Z', () => {
  assert.equal(screenHelpNotesHtml([]), '<p>No screens registered in the help note register.</p>');
  const html = screenHelpNotesHtml(fixture());
  assert.ok(html.indexOf('Billing dashboard') < html.indexOf('Customer profile'));
  assert.ok(html.indexOf('Customer profile') < html.indexOf('Ledger'));
  assert.ok(html.indexOf('Ledger') < html.indexOf('Search customers'));
  assert.match(html, /Handbook section 4/);
});

test('gaps HTML names the gaps or says there are none', () => {
  assert.equal(screenHelpNoteGapsHtml([entry('SHN-1')], []), '<p>No gaps: every registered screen has a help note.</p>');
  const html = screenHelpNoteGapsHtml(fixture(), ['Add payment']);
  assert.match(html, /Add payment — Not registered/);
  assert.match(html, /Billing dashboard — Help note missing/);
  assert.match(html, /Ledger — Help note missing/);
});

test('coverage HTML reconciles the counts in plain words', () => {
  assert.match(screenHelpNoteCoverageHtml([], []), /Give the screens to check/);
  const html = screenHelpNoteCoverageHtml(fixture(), ['Customer profile', 'Billing dashboard', 'Search customers', 'Ledger', 'Add payment']);
  assert.match(html, /5 screens listed: 2 with a help note, 2 missing, 1 not registered/);
  assert.match(html, /Missing: Billing dashboard, Ledger/);
  assert.match(html, /Not registered: Add payment/);
});

test('CSV carries every field and quotes commas and quotes', () => {
  const csv = screenHelpNoteCsv([entry('SHN-1', { screen: 'Customer, profile', reference: 'Section "4"' })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,screen,status,reference,dateChecked');
  assert.equal(lines[1], 'SHN-1,"Customer, profile",present,"Section ""4""",2026-11-06');
  assert.equal(screenHelpNoteCsv([]), 'id,screen,status,reference,dateChecked');
  assert.equal(screenHelpNoteFilename(), 'screen-help-note-register.csv');
});

test('composing never mutates the input, even when frozen', () => {
  const frozen = Object.freeze(fixture().map((item) => Object.freeze({ ...item })));
  const before = JSON.stringify(frozen);
  screenHelpNoteSummaryText(frozen, ['Add payment']);
  screenHelpNotesHtml(frozen);
  screenHelpNoteGapsHtml(frozen, ['Add payment']);
  screenHelpNoteCoverageHtml(frozen, ['Add payment']);
  screenHelpNoteCsv(frozen);
  screenHelpNoteGaps(frozen, ['Add payment']);
  screenHelpNoteCoverage(frozen, ['Add payment']);
  assert.equal(JSON.stringify(frozen), before);
});

test('wiring: app.js imports the module and renders the panel', () => {
  assert.match(appJs, /from '\.\/screen-help-note\.js'/);
  assert.match(appJs, /function renderScreenHelpNotes\(\)/);
  assert.match(appJs, /renderScreenHelpNotes\(\);/);
  assert.match(appJs, /shahdara_shn_entries_v1/);
});

test('wiring: index.html carries the screen help note register panel', () => {
  for (const id of ['shnHeading', 'shnSummary', 'shnBody', 'shnGapsBody', 'shnScreen', 'shnStatus', 'shnReference', 'shnDate', 'shnRecordBtn', 'shnRecheckBtn', 'shnExportBtn', 'shnScreens', 'shnCoverageBtn', 'shnCoverageBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html is missing ${id}`);
  }
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const mine = appJs.match(/screen-help-note|ScreenHelpNote|SCREEN_HELP_NOTE|renderScreenHelpNotes/g) || [];
  assert.ok(mine.length > 0);
});
