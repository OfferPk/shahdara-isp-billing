import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HANDLING_NOTE_STORE_KEY,
  HANDLING_NOTE_TEXT_MAX_LENGTH,
  HANDLING_NOTE_BY_MAX_LENGTH,
  isStrictHandlingNoteDate,
  normalizeHandlingNote,
  normalizeHandlingNoteList,
  recordHandlingNote,
  removeHandlingNote,
  handlingNoteForCustomer,
  hasHandlingNote,
  handlingNoteSummaryText,
  handlingNoteSectionHtml,
  handlingNoteAlertHtml,
} from '../handling-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'handling-note.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan361-handling-note.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const qcSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function note(overrides = {}) {
  return {
    id: 'CHN-1',
    customerId: 'CUST-1',
    text: 'Collect only from the father',
    updatedBy: 'Saad',
    updatedDate: '2026-11-05',
    ...overrides,
  };
}

test('Plan 361: store key is short and names the note store', () => {
  assert.equal(HANDLING_NOTE_STORE_KEY, 'shahdara_chn_notes_v1');
  assert.equal(HANDLING_NOTE_TEXT_MAX_LENGTH, 300);
  assert.equal(HANDLING_NOTE_BY_MAX_LENGTH, 60);
});

test('Plan 361: strict dates are leap-aware and reject impossible dates', () => {
  assert.equal(isStrictHandlingNoteDate('2024-02-29'), true);
  assert.equal(isStrictHandlingNoteDate('2025-02-29'), false);
  assert.equal(isStrictHandlingNoteDate('2026-02-30'), false);
  assert.equal(isStrictHandlingNoteDate('2026-04-31'), false);
  assert.equal(isStrictHandlingNoteDate('2026-11-05'), true);
  assert.equal(isStrictHandlingNoteDate('2026-13-01'), false);
  assert.equal(isStrictHandlingNoteDate('2026-1-5'), false);
  assert.equal(isStrictHandlingNoteDate(''), false);
  assert.equal(isStrictHandlingNoteDate(null), false);
  assert.equal(isStrictHandlingNoteDate(20261105), false);
});

test('Plan 361: normalize trims, caps lengths, and refuses invalid notes', () => {
  assert.deepEqual(normalizeHandlingNote(note({ text: '  Collect only from the father  ' })), note());
  assert.equal(normalizeHandlingNote(note({ text: 'x'.repeat(400) })).text.length, 300);
  assert.equal(normalizeHandlingNote(note({ updatedBy: 'y'.repeat(80) })).updatedBy.length, 60);
  assert.equal(normalizeHandlingNote(note({ id: '  ' })), null);
  assert.equal(normalizeHandlingNote(note({ customerId: '' })), null);
  assert.equal(normalizeHandlingNote(note({ text: '   ' })), null);
  assert.equal(normalizeHandlingNote(note({ updatedDate: '2026-02-30' })), null);
  assert.equal(normalizeHandlingNote(note({ updatedDate: '' })).updatedDate, '');
  assert.equal(normalizeHandlingNote(null), null);
  assert.equal(normalizeHandlingNote('note'), null);
});

test('Plan 361: normalize list drops invalid entries and keeps one note per customer', () => {
  const list = normalizeHandlingNoteList([
    note(),
    note({ id: 'CHN-2', customerId: 'CUST-2', text: 'Never disconnect without calling the owner' }),
    note({ id: 'CHN-1', text: 'Duplicate id' }),
    note({ id: 'CHN-3', customerId: 'cust-1', text: 'Same customer, other case' }),
    note({ id: 'CHN-4', customerId: 'CUST-3', text: '  ' }),
    null,
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].text, 'Collect only from the father');
  assert.equal(list[1].text, 'Never disconnect without calling the owner');
  assert.deepEqual(normalizeHandlingNoteList(null), []);
  assert.deepEqual(normalizeHandlingNoteList('notes'), []);
});

test('Plan 361: recording replaces the note for the same customer in place', () => {
  const before = [note(), note({ id: 'CHN-2', customerId: 'CUST-2', text: 'Old note' })];
  const after = recordHandlingNote(before, note({ id: 'CHN-3', text: 'Collect only from the father, after 6pm' }));
  assert.equal(after.length, 2);
  assert.equal(after[0].id, 'CHN-3');
  assert.equal(after[0].text, 'Collect only from the father, after 6pm');
  assert.equal(after[1].text, 'Old note');
  assert.equal(before[0].id, 'CHN-1');
  assert.equal(before[0].text, 'Collect only from the father');
});

test('Plan 361: recording matches the customer case-insensitively and appends new customers', () => {
  const after = recordHandlingNote([note()], note({ id: 'CHN-9', customerId: 'cust-1', text: 'New wording' }));
  assert.equal(after.length, 1);
  assert.equal(after[0].id, 'CHN-9');
  const appended = recordHandlingNote([note()], note({ id: 'CHN-2', customerId: 'CUST-2', text: 'Second customer' }));
  assert.equal(appended.length, 2);
  assert.equal(appended[1].customerId, 'CUST-2');
});

test('Plan 361: recording an invalid note leaves the list unchanged', () => {
  const before = [note()];
  const after = recordHandlingNote(before, note({ text: '   ' }));
  assert.deepEqual(after, before);
  assert.notEqual(after, before);
});

test('Plan 361: removing deletes only that customer note', () => {
  const list = [note(), note({ id: 'CHN-2', customerId: 'CUST-2', text: 'Other' })];
  const after = removeHandlingNote(list, 'CUST-1');
  assert.equal(after.length, 1);
  assert.equal(after[0].customerId, 'CUST-2');
  assert.equal(removeHandlingNote(list, 'CUST-9').length, 2);
  assert.equal(removeHandlingNote(list, '').length, 2);
  assert.equal(removeHandlingNote(list, 'cust-2').length, 1);
});

test('Plan 361: lookup is case-insensitive and returns null without a note', () => {
  assert.equal(handlingNoteForCustomer([note()], 'cust-1').id, 'CHN-1');
  assert.equal(handlingNoteForCustomer([note()], 'CUST-9'), null);
  assert.equal(handlingNoteForCustomer([note()], ''), null);
  assert.equal(hasHandlingNote([note()], 'CUST-1'), true);
  assert.equal(hasHandlingNote([note()], 'CUST-9'), false);
});

test('Plan 361: summary text counts customers with a note', () => {
  assert.equal(handlingNoteSummaryText([]), 'No handling note recorded.');
  assert.equal(handlingNoteSummaryText([note()]), '1 customer has a handling note.');
  assert.equal(
    handlingNoteSummaryText([note(), note({ id: 'CHN-2', customerId: 'CUST-2', text: 'Other' })]),
    '2 customers have a handling note.',
  );
});

test('Plan 361: section shows the note with byline and an edit form', () => {
  const html = handlingNoteSectionHtml({ id: 'CUST-1' }, [note()], {});
  assert.ok(html.includes('Handling note'));
  assert.ok(html.includes('Collect only from the father'));
  assert.ok(html.includes('Saad, 2026-11-05'));
  assert.ok(html.includes('id="chnForm"'));
  assert.ok(html.includes('id="chnText"'));
  assert.ok(html.includes('maxlength="300"'));
  assert.ok(html.includes('id="chnBy"'));
  assert.ok(html.includes('id="chnDate"'));
  assert.ok(html.includes('id="chnSaveBtn"'));
  assert.ok(html.includes('id="chnRemoveBtn"'));
  assert.ok(html.includes('profile-handling-note'));
  assert.ok(html.includes('blocks nothing and grants nothing'));
});

test('Plan 361: section shows the empty state and no remove button without a note', () => {
  const html = handlingNoteSectionHtml({ id: 'CUST-1' }, [], {});
  assert.ok(html.includes('No handling note for this customer.'));
  assert.ok(html.includes('id="chnForm"'));
  assert.ok(!html.includes('id="chnRemoveBtn"'));
  assert.equal(handlingNoteSectionHtml(null, [note()], ''), '');
});

test('Plan 361: section escapes note text and byline before rendering', () => {
  const html = handlingNoteSectionHtml(
    { id: 'CUST-1' },
    [note({ text: '<script>alert(1)</script>', updatedBy: 'A & B' })],
    {},
  );
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('A &amp; B'));
});

test('Plan 361: section uses supplied labels and falls back to plain words', () => {
  const html = handlingNoteSectionHtml({ id: 'CUST-1' }, [], {
    heading: 'Khaas hidayat',
    placeholder: 'Misaal: sirf walid se lain',
    save: 'Mehfooz karein',
  });
  assert.ok(html.includes('Khaas hidayat'));
  assert.ok(html.includes('Misaal: sirf walid se lain'));
  assert.ok(html.includes('Mehfooz karein'));
});

test('Plan 361: payment alert shows the note and stays empty without one', () => {
  const html = handlingNoteAlertHtml('Collect only from the father', 'Handling note');
  assert.ok(html.includes('Collect only from the father'));
  assert.ok(html.includes('Handling note'));
  assert.ok(html.includes('class="chn-alert"'));
  assert.ok(html.includes('role="alert"'));
  assert.equal(handlingNoteAlertHtml('', 'Handling note'), '');
  assert.equal(handlingNoteAlertHtml('   ', 'Handling note'), '');
  assert.equal(handlingNoteAlertHtml(null, 'Handling note'), '');
});

test('Plan 361: payment alert escapes note text', () => {
  const html = handlingNoteAlertHtml('<b>bold</b> & "quoted"', 'Handling note');
  assert.ok(!html.includes('<b>bold</b>'));
  assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;'));
});

test('Plan 361: module is pure — no page, storage, clock, network or standalone OLT', () => {
  assert.ok(!moduleSrc.includes('document.'));
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!moduleSrc.includes('new Date('));
  assert.ok(!moduleSrc.includes('Date.now('));
  assert.ok(!moduleSrc.includes('fetch('));
  assert.ok(!moduleSrc.includes('window.'));
  assert.ok(!moduleSrc.includes('import '));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  assert.ok(!/03\d{9}/.test(moduleSrc));
});

test('Plan 361: module header and tests never name fenced neighbour modules literally', () => {
  const fenced = [
    ['operator', 'note', 'pin'].join('-') + '.js',
    ['cash', 'handling'].join('-') + '.js',
    ['move', 'house', 'history'].join('-') + '.js',
    ['household', 'link'].join('-') + '.js',
    ['number', 'change', 'log'].join('-') + '.js',
    ['package', 'history', 'view'].join('-') + '.js',
    ['service', 'tenure'].join('-') + '.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('Plan 361: app.js wires the module, store, profile section and bindings', () => {
  assert.ok(appSrc.includes("from './handling-note.js'"));
  assert.ok(appSrc.includes('loadHandlingNotes'));
  assert.ok(appSrc.includes('saveHandlingNotes'));
  assert.ok(appSrc.includes('handlingNoteSectionMarkup'));
  assert.ok(
    appSrc.includes('${wadaProfileBannerHtml(customer)}${handlingNoteSectionMarkup}${profileHeaderStripSectionHtml}'),
    'handling note section sits right after the wada banner, before the header strip',
  );
  assert.ok(appSrc.includes('chnForm'));
  assert.ok(appSrc.includes('chnRemoveBtn'));
  assert.ok(appSrc.includes('loadHandlingNotes: () => loadHandlingNotes()'));
});

test('Plan 361: payment entry screen renders the note box and calls the alert', () => {
  assert.ok(qcSrc.includes('handlingNoteAlertHtml'));
  assert.ok(qcSrc.includes('handlingNoteForCustomer'));
  assert.ok(qcSrc.includes('quickCollectHandlingNoteBox'));
  assert.ok(qcSrc.includes('renderHandlingNoteBox'));
  assert.ok(indexSrc.includes('id="quickCollectHandlingNoteBox"'));
});

test('Plan 361: handling-note labels exist in both language tables', () => {
  const headingHits = langSrc.split('prof_handling_heading').length - 1;
  assert.ok(headingHits >= 2, `prof_handling_heading appears ${headingHits} times`);
  assert.ok(langSrc.includes('prof_handling_placeholder'));
  assert.ok(langSrc.includes('prof_handling_noted_by'));
  assert.ok(langSrc.includes('prof_handling_date'));
  assert.ok(langSrc.includes('prof_handling_remove'));
  assert.ok(langSrc.includes('prof_handling_none'));
});

test('Plan 361: styles reuse existing colours only — no new hex in handling-note rules', () => {
  assert.ok(stylesSrc.includes('.profile-handling-note'));
  assert.ok(stylesSrc.includes('.chn-alert'));
  const rules = stylesSrc.match(/\.chn-[^{]+\{[^}]*\}|\.profile-handling-note[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 2, `expected handling-note rules, found ${rules.length}`);
  const baseline = stylesSrc.replace(/\.chn-[^{]+\{[^}]*\}|\.profile-handling-note[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map(h => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
  assert.ok(stylesSrc.includes('.chn-alert{') || stylesSrc.includes('.chn-alert {'));
  assert.match(stylesSrc, /\.chn-alert\{[^}]*var\(--amber-bg\)/);
});
