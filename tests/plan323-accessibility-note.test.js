import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validAccessibilityNoteDay,
  normalizeAccessibilityNote,
  normalizeAccessibilityNoteList,
  findAccessibilityNote,
  recordAccessibilityNote,
  removeAccessibilityNote,
  accessibilityNotesForScreen,
  accessibilityNotesByScreen,
  accessibilityNoteScreensWithNotes,
  accessibilityNoteScreenStatus,
  accessibilityNoteSummaryText,
  accessibilityNoteEntryText,
  accessibilityNoteEntryHtml,
  accessibilityNotesByScreenHtml,
  accessibilityNoteAllHtml,
  accessibilityNoteScreenStatusHtml,
  accessibilityNoteCsv,
  accessibilityNoteFilename,
} from '../accessibility-note.js';

const first = {
  id: 'AN-1',
  screen: 'Customers',
  issue: 'Small text is hard to read on the field phone',
  workaround: 'Zoom in before reading the list',
  date: '2026-11-04',
};
const second = {
  id: 'AN-2',
  screen: 'Billing',
  issue: 'Buttons are too close together for shaky hands',
  workaround: '',
  date: '2026-11-02',
};
const third = {
  id: 'AN-3',
  screen: 'customers',
  issue: 'The search box is hard to reach with one hand',
  workaround: 'Hold the phone with both hands',
  date: '2026-11-05',
};

test('strict dates accept real calendar days and refuse the rest', () => {
  assert.equal(validAccessibilityNoteDay('2026-11-04'), true);
  assert.equal(validAccessibilityNoteDay('2028-02-29'), true);
  assert.equal(validAccessibilityNoteDay('2027-02-29'), false);
  assert.equal(validAccessibilityNoteDay('2026-02-30'), false);
  assert.equal(validAccessibilityNoteDay('2026-13-01'), false);
  assert.equal(validAccessibilityNoteDay('2026-11-4'), false);
  assert.equal(validAccessibilityNoteDay('04-11-2026'), false);
  assert.equal(validAccessibilityNoteDay(''), false);
  assert.equal(validAccessibilityNoteDay(null), false);
});

test('a good note normalises with its workaround kept', () => {
  assert.deepEqual(normalizeAccessibilityNote(first), first);
});

test('a note with no workaround yet is still a good note', () => {
  assert.deepEqual(normalizeAccessibilityNote(second), second);
});

test('a note with no screen or no issue is refused', () => {
  assert.equal(normalizeAccessibilityNote({ ...first, screen: '  ' }), null);
  assert.equal(normalizeAccessibilityNote({ ...first, issue: '' }), null);
  assert.equal(normalizeAccessibilityNote({ ...first, id: '' }), null);
  assert.equal(normalizeAccessibilityNote({ ...first, date: '2026-11-31' }), null);
  assert.equal(normalizeAccessibilityNote(null), null);
  assert.equal(normalizeAccessibilityNote([]), null);
});

test('unknown fields are dropped so a note never grows a bill or customer field', () => {
  assert.deepEqual(normalizeAccessibilityNote({ ...first, amount: 3000, customerId: 'C-1' }), first);
});

test('a duplicate id is never rewritten, the first note stays', () => {
  const list = normalizeAccessibilityNoteList([first, { ...first, issue: 'A different issue' }]);
  assert.equal(list.length, 1);
  assert.equal(list[0].issue, first.issue);
  assert.deepEqual(recordAccessibilityNote([first], { ...first, issue: 'A different issue' }), [first]);
});

test('record adds a note and remove takes only that note away', () => {
  assert.deepEqual(recordAccessibilityNote([], first), [first]);
  assert.deepEqual(recordAccessibilityNote([first], second), [first, second]);
  assert.deepEqual(recordAccessibilityNote([first], { ...second, date: 'not a date' }), [first]);
  assert.deepEqual(removeAccessibilityNote([first, second], 'AN-1'), [second]);
  assert.deepEqual(removeAccessibilityNote([first], 'AN-9'), [first]);
  assert.deepEqual(removeAccessibilityNote([first], ''), [first]);
});

test('find returns the note by id and null when it is missing', () => {
  assert.deepEqual(findAccessibilityNote([first, second], 'AN-2'), second);
  assert.equal(findAccessibilityNote([first], 'AN-9'), null);
  assert.equal(findAccessibilityNote([first], ''), null);
});

test('notes for one screen match case-insensitively and list in date order', () => {
  assert.deepEqual(accessibilityNotesForScreen([third, first, second], 'CUSTOMERS'), [first, third]);
  assert.deepEqual(accessibilityNotesForScreen([first], ''), []);
});

test('notes group by screen in A-Z order with entries in date order', () => {
  const groups = accessibilityNotesByScreen([third, second, first]);
  assert.deepEqual(
    groups.map((group) => group.screen),
    ['Billing', 'customers'],
  );
  assert.deepEqual(groups[1].items, [first, third]);
  assert.deepEqual(accessibilityNotesByScreen([]), []);
});

test('screens with notes list A-Z in plain words', () => {
  assert.deepEqual(accessibilityNoteScreensWithNotes([third, second, first]), ['Billing', 'customers']);
  assert.deepEqual(accessibilityNoteScreensWithNotes([]), []);
});

test('the screen list shows which screens carry notes and which are clear', () => {
  assert.deepEqual(accessibilityNoteScreenStatus([first, second], ['Billing', 'Customers', 'Payments']), [
    { screen: 'Billing', hasNote: true, noteCount: 1 },
    { screen: 'Customers', hasNote: true, noteCount: 1 },
    { screen: 'Payments', hasNote: false, noteCount: 0 },
  ]);
  assert.deepEqual(accessibilityNoteScreenStatus([], ['Payments']), [
    { screen: 'Payments', hasNote: false, noteCount: 0 },
  ]);
  assert.deepEqual(accessibilityNoteScreenStatus([first], []), []);
  assert.deepEqual(accessibilityNoteScreenStatus([first], null), []);
});

test('the screen list counts notes per screen and collapses repeated names', () => {
  assert.deepEqual(accessibilityNoteScreenStatus([first, third], ['customers', 'Customers', '  ', 'Payments']), [
    { screen: 'customers', hasNote: true, noteCount: 2 },
    { screen: 'Payments', hasNote: false, noteCount: 0 },
  ]);
});

test('the summary names the note count and the screen count in plain words', () => {
  assert.equal(accessibilityNoteSummaryText([]), 'No accessibility notes recorded.');
  assert.equal(accessibilityNoteSummaryText([first]), '1 accessibility note recorded on 1 screen.');
  assert.equal(
    accessibilityNoteSummaryText([first, second, third]),
    '3 accessibility notes recorded on 2 screens.',
  );
});

test('one note reads as a plain line, with or without a workaround', () => {
  assert.equal(
    accessibilityNoteEntryText(first),
    '2026-11-04 — Customers: Small text is hard to read on the field phone (workaround: Zoom in before reading the list).',
  );
  assert.equal(
    accessibilityNoteEntryText(second),
    '2026-11-02 — Billing: Buttons are too close together for shaky hands.',
  );
  assert.equal(accessibilityNoteEntryText({ ...first, date: 'bad' }), '');
});

test('html escapes user text so a note can never break the page', () => {
  const nasty = { ...first, issue: '<b>tiny</b> & "small" text' };
  assert.equal(
    accessibilityNoteEntryHtml(nasty),
    '<li>2026-11-04 — Customers: &lt;b&gt;tiny&lt;/b&gt; &amp; &quot;small&quot; text (workaround: Zoom in before reading the list).</li>',
  );
  assert.equal(accessibilityNoteEntryHtml({ ...first, date: 'bad' }), '');
});

test('grouped html lists notes under each screen and says so when empty', () => {
  const html = accessibilityNotesByScreenHtml([first, second]);
  assert.match(html, /<h4>Billing<\/h4>/);
  assert.match(html, /<h4>Customers<\/h4>/);
  assert.ok(html.indexOf('<h4>Billing</h4>') < html.indexOf('<h4>Customers</h4>'));
  assert.equal(accessibilityNotesByScreenHtml([]), '<p>No accessibility notes recorded.</p>');
  assert.equal(accessibilityNoteAllHtml([]), '<p>No accessibility notes recorded.</p>');
  assert.match(accessibilityNoteAllHtml([second, first]), /Billing.*Customers/s);
});

test('screen status html names each screen as carrying notes or clear', () => {
  const html = accessibilityNoteScreenStatusHtml([first], ['Customers', 'Payments']);
  assert.equal(html, '<ul><li>Customers: 1 note</li><li>Payments: clear</li></ul>');
  assert.equal(accessibilityNoteScreenStatusHtml([first, third], ['Customers']), '<ul><li>Customers: 2 notes</li></ul>');
  assert.equal(accessibilityNoteScreenStatusHtml([], []), '<p>No screens listed.</p>');
});

test('csv carries every note in screen then date order with quoting', () => {
  const csv = accessibilityNoteCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,screen,issue,workaround,date');
  assert.equal(lines[1], 'AN-2,Billing,Buttons are too close together for shaky hands,,2026-11-02');
  assert.equal(
    lines[2],
    'AN-1,Customers,Small text is hard to read on the field phone,Zoom in before reading the list,2026-11-04',
  );
  const quoted = accessibilityNoteCsv([{ ...first, issue: 'Text "too small", really' }]);
  assert.match(quoted, /"Text ""too small"", really"/);
  assert.equal(accessibilityNoteCsv([]), 'id,screen,issue,workaround,date');
  assert.equal(accessibilityNoteFilename(), 'accessibility-notes.csv');
});

test('the module never mutates its input', () => {
  const before = JSON.stringify([first, second]);
  const frozen = Object.freeze([Object.freeze({ ...first }), Object.freeze({ ...second })]);
  recordAccessibilityNote(frozen, third);
  accessibilityNotesByScreen(frozen);
  accessibilityNoteScreenStatus(frozen, ['Customers']);
  assert.equal(JSON.stringify([first, second]), before);
});

test('the module keeps its fences: no fenced file, no clock, no OLT', () => {
  const source = readFileSync(new URL('../accessibility-note.js', import.meta.url), 'utf8');
  for (const fenced of ['nav-accessibility', 'app-feedback-inbox', 'access-difficulty', 'access-register']) {
    assert.equal(source.includes(fenced), false, `module must not name the fenced module ${fenced}`);
  }
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('OLT'), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('fetch('), false);
});
