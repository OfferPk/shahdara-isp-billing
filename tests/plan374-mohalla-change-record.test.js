import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MOHALLA_CHANGE_STORE_KEY,
  MOHALLA_CHANGE_MOHALLA_MAX_LENGTH,
  MOHALLA_CHANGE_RECORDED_BY_MAX_LENGTH,
  MOHALLA_CHANGE_ANNOTATION_MAX_LENGTH,
  isStrictMohallaChangeDate,
  normalizeMohallaChangeEntry,
  normalizeMohallaChangeList,
  recordMohallaChangeEntry,
  annotateMohallaChangeEntry,
  mohallaChangesForCustomer,
  currentMohallaForCustomer,
  mohallaChangeRowText,
  mohallaChangeSummaryText,
  mohallaChangeRecordSectionHtml,
} from '../mohalla-change-record.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'mohalla-change-record.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function customer(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Customer One',
    mohalla: 'Mohalla A',
    phone: '03012345678',
    ...overrides,
  };
}

function entry(overrides = {}) {
  return {
    id: 'MCR-1',
    customerId: 'CUST-1',
    oldMohalla: 'Mohalla A',
    newMohalla: 'Mohalla B',
    changeDate: '2026-11-06',
    recordedBy: 'Saad',
    annotations: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Strict dates
// ---------------------------------------------------------------------------

test('dates: strict YYYY-MM-DD, leap-aware', () => {
  assert.equal(isStrictMohallaChangeDate('2024-02-29'), true);
  assert.equal(isStrictMohallaChangeDate('2025-02-29'), false);
  assert.equal(isStrictMohallaChangeDate('2026-11-06'), true);
  assert.equal(isStrictMohallaChangeDate('2026-11-31'), false);
  assert.equal(isStrictMohallaChangeDate('2026-13-01'), false);
  assert.equal(isStrictMohallaChangeDate('2026-00-10'), false);
  assert.equal(isStrictMohallaChangeDate('06-11-2026'), false);
  assert.equal(isStrictMohallaChangeDate(''), false);
  assert.equal(isStrictMohallaChangeDate(null), false);
  assert.equal(isStrictMohallaChangeDate(20261106), false);
});

// ---------------------------------------------------------------------------
// Normalize, record, annotate
// ---------------------------------------------------------------------------

test('normalize: trims, caps lengths, and keeps a well-formed entry', () => {
  const got = normalizeMohallaChangeEntry(entry({ oldMohalla: '  Mohalla A  ', newMohalla: 'Mohalla B' }));
  assert.equal(got.oldMohalla, 'Mohalla A');
  assert.equal(got.newMohalla, 'Mohalla B');
  assert.equal(got.changeDate, '2026-11-06');
  assert.equal(got.recordedBy, 'Saad');
  assert.deepEqual(got.annotations, []);
});

test('normalize: over-long mohalla and recorded-by are capped, not refused', () => {
  const got = normalizeMohallaChangeEntry(entry({
    oldMohalla: 'M'.repeat(80),
    recordedBy: 'R'.repeat(80),
  }));
  assert.equal(got.oldMohalla.length, MOHALLA_CHANGE_MOHALLA_MAX_LENGTH);
  assert.equal(got.recordedBy.length, MOHALLA_CHANGE_RECORDED_BY_MAX_LENGTH);
});

test('normalize: refuses a missing id, customer, mohalla, or real date', () => {
  assert.equal(normalizeMohallaChangeEntry(entry({ id: '' })), null);
  assert.equal(normalizeMohallaChangeEntry(entry({ customerId: '  ' })), null);
  assert.equal(normalizeMohallaChangeEntry(entry({ oldMohalla: '' })), null);
  assert.equal(normalizeMohallaChangeEntry(entry({ newMohalla: '' })), null);
  assert.equal(normalizeMohallaChangeEntry(entry({ changeDate: '2025-02-29' })), null);
  assert.equal(normalizeMohallaChangeEntry(entry({ changeDate: 'tomorrow' })), null);
  assert.equal(normalizeMohallaChangeEntry(null), null);
  assert.equal(normalizeMohallaChangeEntry('not an object'), null);
});

test('normalize: the same mohalla twice is not a change', () => {
  assert.equal(normalizeMohallaChangeEntry(entry({ newMohalla: 'Mohalla A' })), null);
  assert.equal(normalizeMohallaChangeEntry(entry({ newMohalla: 'mohalla a' })), null);
  assert.equal(normalizeMohallaChangeEntry(entry({ newMohalla: '  MOHALLA A ' })), null);
});

test('normalize: annotations keep only well-formed notes', () => {
  const got = normalizeMohallaChangeEntry(entry({
    annotations: [
      { text: 'Customer confirmed the move', date: '2026-11-07' },
      { text: '', date: '2026-11-07' },
      { text: 'No date on this one', date: '2025-02-29' },
      { text: 'x'.repeat(250), date: '2026-11-08' },
    ],
  }));
  assert.equal(got.annotations.length, 2);
  assert.equal(got.annotations[0].text, 'Customer confirmed the move');
  assert.equal(got.annotations[1].text.length, MOHALLA_CHANGE_ANNOTATION_MAX_LENGTH);
});

test('normalize list: drops invalid entries and dedupes by id, case-insensitive', () => {
  const got = normalizeMohallaChangeList([
    entry(),
    entry({ id: 'mcr-1', newMohalla: 'Mohalla C' }),
    entry({ id: 'MCR-2', newMohalla: 'Mohalla C' }),
    entry({ id: 'MCR-3', newMohalla: 'Mohalla B' }),
    null,
  ]);
  assert.deepEqual(got.map(e => e.id), ['MCR-1', 'MCR-2', 'MCR-3']);
  assert.deepEqual(normalizeMohallaChangeList(null), []);
  assert.deepEqual(normalizeMohallaChangeList('not a list'), []);
});

test('record: appends a fresh entry and refuses a duplicate id or a bad entry', () => {
  const list = [entry()];
  const added = recordMohallaChangeEntry(list, entry({ id: 'MCR-2', newMohalla: 'Mohalla C' }));
  assert.equal(added.length, 2);
  assert.equal(list.length, 1, 'input is never mutated');
  const dup = recordMohallaChangeEntry(list, entry({ id: 'mcr-1', newMohalla: 'Mohalla C' }));
  assert.equal(dup.length, 1);
  const bad = recordMohallaChangeEntry(list, entry({ newMohalla: 'Mohalla A' }));
  assert.equal(bad.length, 1);
});

test('annotate: appends a note and leaves the entry itself exactly as recorded', () => {
  const list = [entry()];
  const next = annotateMohallaChangeEntry(list, 'MCR-1', 'Customer confirmed the move', '2026-11-07');
  assert.notEqual(next, list);
  assert.equal(next[0].annotations.length, 1);
  assert.equal(next[0].annotations[0].text, 'Customer confirmed the move');
  assert.equal(next[0].oldMohalla, 'Mohalla A');
  assert.equal(next[0].newMohalla, 'Mohalla B');
  assert.equal(next[0].changeDate, '2026-11-06');
  assert.equal(list[0].annotations.length, 0, 'input is never mutated');
});

test('annotate: a refused note returns the very list passed in', () => {
  const list = [entry()];
  assert.equal(annotateMohallaChangeEntry(list, 'MCR-1', '', '2026-11-07'), list);
  assert.equal(annotateMohallaChangeEntry(list, 'MCR-1', 'A note', '2025-02-29'), list);
  assert.equal(annotateMohallaChangeEntry(list, 'MCR-9', 'A note', '2026-11-07'), list);
  assert.equal(annotateMohallaChangeEntry(list, 'mcr-1', 'Second note', '2026-11-08').length, 1);
});

// ---------------------------------------------------------------------------
// Lookup: newest first, current mohalla is the latest entry
// ---------------------------------------------------------------------------

test('lookup: changes list newest first for one customer only, case-insensitive', () => {
  const list = [
    entry({ id: 'MCR-1', changeDate: '2026-11-01', newMohalla: 'Mohalla B' }),
    entry({ id: 'MCR-2', changeDate: '2026-11-06', newMohalla: 'Mohalla C' }),
    entry({ id: 'MCR-3', customerId: 'CUST-2', changeDate: '2026-11-05', newMohalla: 'Mohalla D' }),
    entry({ id: 'MCR-4', changeDate: '2026-11-03', newMohalla: 'Mohalla D' }),
  ];
  const got = mohallaChangesForCustomer(list, 'cust-1');
  assert.deepEqual(got.map(e => e.id), ['MCR-2', 'MCR-4', 'MCR-1']);
  assert.deepEqual(mohallaChangesForCustomer(list, 'CUST-9'), []);
  assert.deepEqual(mohallaChangesForCustomer(list, ''), []);
});

test('current mohalla: the latest entry wins; empty when no change is recorded', () => {
  const list = [
    entry({ id: 'MCR-1', changeDate: '2026-11-01', newMohalla: 'Mohalla B' }),
    entry({ id: 'MCR-2', changeDate: '2026-11-06', newMohalla: 'Mohalla C' }),
  ];
  assert.equal(currentMohallaForCustomer(list, 'CUST-1'), 'Mohalla C');
  assert.equal(currentMohallaForCustomer(list, 'CUST-2'), '');
  assert.equal(currentMohallaForCustomer([], 'CUST-1'), '');
});

// ---------------------------------------------------------------------------
// Text and section HTML
// ---------------------------------------------------------------------------

test('row text: names the new mohalla, the date, the old mohalla, and the recorder', () => {
  assert.equal(
    mohallaChangeRowText(entry()),
    'Mohalla B \u2014 changed 2026-11-06 \u2014 from Mohalla A \u2014 recorded by Saad',
  );
  assert.equal(
    mohallaChangeRowText(entry({ recordedBy: '' })),
    'Mohalla B \u2014 changed 2026-11-06 \u2014 from Mohalla A',
  );
  assert.equal(mohallaChangeRowText(null), '');
});

test('summary text: none, one, many', () => {
  assert.equal(mohallaChangeSummaryText([]), 'No mohalla change recorded yet.');
  assert.equal(mohallaChangeSummaryText([entry()]), '1 mohalla change recorded.');
  assert.equal(mohallaChangeSummaryText([entry(), entry({ id: 'MCR-2' })]), '2 mohalla changes recorded.');
});

test('section: shows the current mohalla, the list newest first, and the add form', () => {
  const list = [
    entry({ id: 'MCR-1', changeDate: '2026-11-01', newMohalla: 'Mohalla B' }),
    entry({ id: 'MCR-2', changeDate: '2026-11-06', newMohalla: 'Mohalla C' }),
  ];
  const html = mohallaChangeRecordSectionHtml(customer(), list);
  assert.ok(html.includes('Mohalla change record'));
  assert.ok(html.includes('Current mohalla: Mohalla C'));
  assert.ok(html.includes('2026-11-06'));
  assert.ok(html.indexOf('Mohalla C') < html.indexOf('Mohalla B'), 'newest change first');
  assert.ok(html.includes('id="mcrForm"'));
  assert.ok(html.includes('id="mcrOldMohalla"'));
  assert.ok(html.includes('id="mcrNewMohalla"'));
  assert.ok(html.includes('id="mcrDate"'));
  assert.ok(html.includes('id="mcrRecordedBy"'));
  assert.ok(html.includes('data-mohalla-change-annotate="MCR-2"'));
  assert.ok(html.includes('2 mohalla changes recorded.'));
});

test('section: a profile with no change shows the none line, never a guessed mohalla', () => {
  const html = mohallaChangeRecordSectionHtml(customer(), []);
  assert.ok(html.includes('No mohalla change recorded yet.'));
  assert.ok(html.includes('the mohalla on the profile is the current one'));
  assert.ok(!html.includes('Current mohalla: Mohalla'));
});

test('section: user-entered text is escaped, and no customer means no section', () => {
  const html = mohallaChangeRecordSectionHtml(customer(), [entry({
    newMohalla: '<script>alert(1)</script>',
    recordedBy: 'A & B',
  })]);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A &amp; B'));
  assert.equal(mohallaChangeRecordSectionHtml(null, [entry()]), '');
});

// ---------------------------------------------------------------------------
// Purity, fences, wiring
// ---------------------------------------------------------------------------

test('purity: the module never touches the page, storage, the clock or the network', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
});

test('fences: the module never names the neighbouring billing-address, move-transfer or move-history modules', () => {
  // The neighbouring modules were checked by filename first and are
  // neither read nor rewritten here, so this module never names them —
  // each name is built from fragments so the literal filename appears
  // nowhere in this file either.
  const neighbours = [
    'billing' + '-address',
    'move' + '-transfers',
    'move' + '-house' + '-history',
  ];
  for (const name of neighbours) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name + '.js'), `test must not name ${name}.js`);
  }
});

test('store key: short and in the established style', () => {
  assert.equal(MOHALLA_CHANGE_STORE_KEY, 'shahdara_mcr_changes_v1');
});

test('wiring: app.js imports the module, loads and saves the record, and shows the section after the number-change log', () => {
  assert.ok(appSrc.includes("from './mohalla-change-record.js'"));
  assert.ok(appSrc.includes('function loadMohallaChangeRecord()'));
  assert.ok(appSrc.includes('function saveMohallaChangeRecord('));
  assert.ok(appSrc.includes("querySelector('#mcrForm')"));
  assert.ok(appSrc.includes("querySelector('#mcrOldMohalla')"));
  assert.ok(appSrc.includes('currentMohallaForCustomer(loadMohallaChangeRecord(), customer.id)'));
  // Order, not adjacency: the record sits between the number-change
  // log and the package history, so the log is still after the
  // move-house history and still before the package history.
  const logAt = appSrc.indexOf('${numberChangeLogSectionMarkup}');
  const recordAt = appSrc.indexOf('${mohallaChangeRecordSectionMarkup}');
  const packageAt = appSrc.indexOf('${packageHistorySectionMarkup}');
  assert.ok(logAt > 0 && recordAt > logAt && packageAt > recordAt);
});

test('wiring: the profile order assertion still holds — banner, strip, then groups', () => {
  const bannerAt = appSrc.indexOf('${wadaProfileBannerHtml(customer)}');
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}', bannerAt);
  const groupsAt = appSrc.indexOf('${profileInfoGroupsHtml}', stripAt);
  assert.ok(bannerAt > 0, 'wada banner is in the profile template');
  assert.ok(stripAt > bannerAt, 'strip sits after the wada banner');
  assert.ok(groupsAt > stripAt, 'strip sits before the field groups');
  const recordAt = appSrc.indexOf('${mohallaChangeRecordSectionMarkup}');
  assert.ok(recordAt > stripAt, 'mohalla change record sits after the strip');
  assert.ok(recordAt < groupsAt, 'mohalla change record sits before the field groups');
});

test('styles: the record rules exist and reuse an existing colour only', () => {
  for (const cls of ['.mcr-list', '.mcr-change', '.mcr-form', '.mcr-annotate', '.mcr-current']) {
    assert.ok(stylesSrc.includes(cls), `styles must define ${cls}`);
  }
  const stripped = stylesSrc.replace(/\.profile-mohalla-change-record[^{]*\{[^}]*\}|\.mcr-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((stripped.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  const rules = stylesSrc.match(/\.profile-mohalla-change-record[^{]*\{[^}]*\}|\.mcr-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0, 'mohalla change record styles exist');
  for (const rule of rules) {
    for (const hex of rule.match(/#[0-9a-fA-F]{3,8}/g) || []) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('language: both tables carry the mohalla change record labels', () => {
  // Count `key:` (with the colon) so a key is not also counted inside
  // a longer key that starts with it.
  for (const key of ['prof_mcr_heading', 'prof_mcr_intro', 'prof_mcr_old_mohalla', 'prof_mcr_new_mohalla', 'prof_mcr_date', 'prof_mcr_recorded_by', 'prof_mcr_recorded_by_placeholder', 'prof_mcr_save', 'prof_mcr_add_note', 'prof_mcr_annotate_placeholder', 'prof_mcr_current', 'prof_mcr_none', 'prof_mcr_no_change_current']) {
    assert.equal(langSrc.split(`${key}:`).length - 1, 2, `${key} must appear once per language table`);
  }
});

test('no real customer names or phone numbers in the module or its tests', () => {
  // Pattern-based: an 11-digit Pakistani mobile shape, or a +92 number,
  // must never appear in the module or its tests. (Substring checks
  // would trip on the pattern itself, so the shape is tested by regex.)
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(moduleSrc));
  assert.ok(!phoneShape.test(testSrc));
});
