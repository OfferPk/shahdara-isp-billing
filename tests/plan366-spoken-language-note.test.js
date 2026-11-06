import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPOKEN_LANGUAGE_NOTE_STORE_KEY,
  SPOKEN_LANGUAGE_NOTE_LANGUAGE_MAX_LENGTH,
  SPOKEN_LANGUAGE_NOTE_BY_MAX_LENGTH,
  isStrictSpokenLanguageNoteDate,
  normalizeSpokenLanguageNote,
  normalizeSpokenLanguageNoteList,
  recordSpokenLanguageNote,
  removeSpokenLanguageNote,
  spokenLanguageNoteForCustomer,
  hasSpokenLanguageNote,
  spokenLanguageNoteSummaryText,
  spokenLanguageNoteSectionHtml,
} from '../spoken-language-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'spoken-language-note.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan366-spoken-language-note.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const qcSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function note(overrides = {}) {
  return {
    id: 'SLN-1',
    customerId: 'CUST-1',
    language: 'Punjabi',
    notedBy: 'Saad',
    notedDate: '2026-11-06',
    ...overrides,
  };
}

function customer(overrides = {}) {
  return { id: 'CUST-1', name: 'Customer One', ...overrides };
}

test('Plan 366: store key is short and names the note store', () => {
  assert.equal(SPOKEN_LANGUAGE_NOTE_STORE_KEY, 'shahdara_sln_notes_v1');
  assert.equal(SPOKEN_LANGUAGE_NOTE_LANGUAGE_MAX_LENGTH, 60);
  assert.equal(SPOKEN_LANGUAGE_NOTE_BY_MAX_LENGTH, 60);
});

test('Plan 366: strict dates are leap-aware and reject impossible dates', () => {
  assert.equal(isStrictSpokenLanguageNoteDate('2024-02-29'), true);
  assert.equal(isStrictSpokenLanguageNoteDate('2025-02-29'), false);
  assert.equal(isStrictSpokenLanguageNoteDate('2026-02-30'), false);
  assert.equal(isStrictSpokenLanguageNoteDate('2026-04-31'), false);
  assert.equal(isStrictSpokenLanguageNoteDate('2026-11-06'), true);
  assert.equal(isStrictSpokenLanguageNoteDate('2026-13-01'), false);
  assert.equal(isStrictSpokenLanguageNoteDate('2026-1-5'), false);
  assert.equal(isStrictSpokenLanguageNoteDate(''), false);
  assert.equal(isStrictSpokenLanguageNoteDate(null), false);
  assert.equal(isStrictSpokenLanguageNoteDate(20261106), false);
});

test('Plan 366: normalize keeps a valid note and trims its fields', () => {
  const out = normalizeSpokenLanguageNote(note({ language: '  Urdu  ', notedBy: '  Saad  ' }));
  assert.deepEqual(out, {
    id: 'SLN-1',
    customerId: 'CUST-1',
    language: 'Urdu',
    notedBy: 'Saad',
    notedDate: '2026-11-06',
  });
});

test('Plan 366: normalize refuses a note with no id, no customer, or no language', () => {
  assert.equal(normalizeSpokenLanguageNote(note({ id: '' })), null);
  assert.equal(normalizeSpokenLanguageNote(note({ id: '   ' })), null);
  assert.equal(normalizeSpokenLanguageNote(note({ customerId: '' })), null);
  assert.equal(normalizeSpokenLanguageNote(note({ language: '' })), null);
  assert.equal(normalizeSpokenLanguageNote(note({ language: '   ' })), null);
  assert.equal(normalizeSpokenLanguageNote(null), null);
  assert.equal(normalizeSpokenLanguageNote('Punjabi'), null);
  assert.equal(normalizeSpokenLanguageNote(note({ notedDate: '2026-02-30' })), null);
});

test('Plan 366: normalize caps a long language and a long noted-by', () => {
  const out = normalizeSpokenLanguageNote(note({ language: 'x'.repeat(80), notedBy: 'y'.repeat(80) }));
  assert.equal(out.language.length, 60);
  assert.equal(out.notedBy.length, 60);
});

test('Plan 366: normalize list drops invalid entries and keeps the first per customer and id', () => {
  assert.deepEqual(normalizeSpokenLanguageNoteList('not a list'), []);
  assert.deepEqual(normalizeSpokenLanguageNoteList(null), []);
  const list = normalizeSpokenLanguageNoteList([
    note(),
    note({ id: 'SLN-2', language: 'Urdu' }),
    note({ id: 'SLN-1', language: 'Saraiki' }),
    note({ id: 'SLN-3', customerId: 'CUST-2', language: 'Urdu' }),
    note({ id: 'SLN-4', language: '' }),
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].language, 'Punjabi');
  assert.equal(list[1].customerId, 'CUST-2');
});

test('Plan 366: record adds a note and replaces in place for the same customer', () => {
  const first = recordSpokenLanguageNote([], note());
  assert.equal(first.length, 1);
  const replaced = recordSpokenLanguageNote(first, note({ id: 'SLN-9', language: 'Urdu' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].id, 'SLN-9');
  assert.equal(replaced[0].language, 'Urdu');
  const other = recordSpokenLanguageNote(replaced, note({ id: 'SLN-10', customerId: 'CUST-2', language: 'Saraiki' }));
  assert.equal(other.length, 2);
});

test('Plan 366: record matches the customer case-insensitively and leaves the input alone', () => {
  const before = [note()];
  const after = recordSpokenLanguageNote(before, note({ id: 'SLN-9', customerId: 'cust-1', language: 'Urdu' }));
  assert.equal(after.length, 1);
  assert.equal(after[0].language, 'Urdu');
  assert.equal(before[0].language, 'Punjabi');
  assert.notEqual(after, before);
  const unchanged = recordSpokenLanguageNote(before, note({ language: '' }));
  assert.deepEqual(unchanged, before);
});

test('Plan 366: remove drops only that customer, case-insensitively', () => {
  const list = [note(), note({ id: 'SLN-2', customerId: 'CUST-2', language: 'Urdu' })];
  assert.deepEqual(removeSpokenLanguageNote(list, 'cust-1'), [list[1]]);
  assert.deepEqual(removeSpokenLanguageNote(list, 'CUST-9'), list);
  assert.deepEqual(removeSpokenLanguageNote(list, ''), list);
});

test('Plan 366: lookup is case-insensitive and missing reads as no note', () => {
  const list = [note()];
  assert.equal(spokenLanguageNoteForCustomer(list, 'cust-1').language, 'Punjabi');
  assert.equal(spokenLanguageNoteForCustomer(list, 'CUST-2'), null);
  assert.equal(spokenLanguageNoteForCustomer(list, ''), null);
  assert.equal(spokenLanguageNoteForCustomer([], 'CUST-1'), null);
  assert.equal(hasSpokenLanguageNote(list, 'CUST-1'), true);
  assert.equal(hasSpokenLanguageNote(list, 'CUST-2'), false);
});

test('Plan 366: summary text counts the notes in plain words', () => {
  assert.equal(spokenLanguageNoteSummaryText([]), 'No spoken language noted.');
  assert.equal(spokenLanguageNoteSummaryText([note()]), '1 customer has a spoken language noted.');
  assert.equal(
    spokenLanguageNoteSummaryText([note(), note({ id: 'SLN-2', customerId: 'CUST-2', language: 'Urdu' })]),
    '2 customers have a spoken language noted.',
  );
});

test('Plan 366: section shows the noted language with its byline and an edit form', () => {
  const html = spokenLanguageNoteSectionHtml(customer(), [note()], {});
  assert.match(html, /<strong>Punjabi<\/strong>/);
  assert.match(html, /Saad, 2026-11-06/);
  assert.match(html, /id="slnForm"/);
  assert.match(html, /id="slnLanguage"/);
  assert.match(html, /id="slnBy"/);
  assert.match(html, /id="slnDate"/);
  assert.match(html, /id="slnRemoveBtn"/);
  assert.match(html, /profile-spoken-language-note/);
});

test('Plan 366: section escapes the language text and honours caller labels', () => {
  const html = spokenLanguageNoteSectionHtml(
    customer(),
    [note({ language: '<script>alert(1)</script>' })],
    { heading: 'Boli', placeholder: 'masalan Urdu', none: 'Kuch nahi' },
  );
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Boli/);
  assert.match(html, /masalan Urdu/);
});

test('Plan 366: a profile without a note shows the none line and the add form, never a language', () => {
  const html = spokenLanguageNoteSectionHtml(customer(), [], { none: 'No spoken language noted for this customer.' });
  assert.match(html, /No spoken language noted for this customer\./);
  assert.ok(!html.includes('sln-current'));
  assert.match(html, /id="slnForm"/);
  assert.ok(!html.includes('slnRemoveBtn'));
  assert.equal(spokenLanguageNoteSectionHtml(null, [note()]), '');
  assert.equal(spokenLanguageNoteSectionHtml('not an object', [note()]), '');
});

test('Plan 366: module is pure — no page, storage, clock, network, or import', () => {
  assert.ok(!moduleSrc.includes('document.'));
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!moduleSrc.includes('new Date('));
  assert.ok(!moduleSrc.includes('Date.now('));
  assert.ok(!moduleSrc.includes('fetch('));
  assert.ok(!moduleSrc.includes('window.'));
  assert.ok(!moduleSrc.includes('import '));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
});

test('Plan 366: module and tests never name the fenced neighbours literally', () => {
  const fenced = [
    ['draft', 'language'].join('-') + '.js',
    ['visit', 'language'].join('-') + '.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module names fenced file ${name}`);
    assert.ok(!testSrc.includes(name), `tests name fenced file ${name}`);
  }
});

test('Plan 366: wiring — import, load/save, section after the handling note, bindings', () => {
  assert.ok(appSrc.includes("from './spoken-language-note.js'"));
  assert.ok(appSrc.includes('loadSpokenLanguageNotes'));
  assert.ok(appSrc.includes('saveSpokenLanguageNotes'));
  assert.ok(appSrc.includes('spokenLanguageNoteSectionMarkup'));
  assert.ok(
    appSrc.includes('${handlingNoteSectionMarkup}${spokenLanguageNoteSectionMarkup}${profileHeaderStripSectionHtml}'),
    'spoken language section sits at the top of the profile, after the handling note and before the header strip',
  );
  assert.ok(appSrc.includes('slnForm'));
  assert.ok(appSrc.includes('slnRemoveBtn'));
});

test('Plan 366: the note appears on the profile only — never on the payment entry screen', () => {
  assert.ok(!qcSrc.includes('spokenLanguage'));
  assert.ok(!qcSrc.includes('sln'));
});

test('Plan 366: language keys exist in both language tables', () => {
  assert.ok(langSrc.includes('prof_spoken_lang_heading'));
  assert.ok(langSrc.includes('prof_spoken_lang_placeholder'));
  assert.ok(langSrc.includes('prof_spoken_lang_noted_by'));
  assert.ok(langSrc.includes('prof_spoken_lang_date'));
  assert.ok(langSrc.includes('prof_spoken_lang_remove'));
  assert.ok(langSrc.includes('prof_spoken_lang_none'));
});

test('Plan 366: styles reuse existing colours only — no new hex in spoken-language rules', () => {
  assert.ok(stylesSrc.includes('.profile-spoken-language-note'));
  assert.ok(stylesSrc.includes('.sln-form'));
  const rules = stylesSrc.match(/\.sln-[^{]+\{[^}]*\}|\.profile-spoken-language-note[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0);
  const baseline = stylesSrc.replace(/\.sln-[^{]+\{[^}]*\}|\.profile-spoken-language-note[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map(hex => hex.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
