import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MOVE_HISTORY_STORE_KEY,
  MOVE_HISTORY_MOHALLA_MAX_LENGTH,
  MOVE_HISTORY_ADDRESS_MAX_LENGTH,
  MOVE_HISTORY_ANNOTATION_MAX_LENGTH,
  isStrictMoveHistoryDate,
  normalizeMoveHistoryEntry,
  normalizeMoveHistoryList,
  recordMoveHistoryEntry,
  annotateMoveHistoryEntry,
  moveHistoryForCustomer,
  currentAddressForCustomer,
  moveHistoryRowText,
  moveHistorySummaryText,
  moveHouseHistorySectionHtml,
} from '../move-house-history.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'move-house-history.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function customer(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Customer One',
    mohalla: 'Mohalla A',
    address: 'House 1, Street 1',
    ...overrides,
  };
}

function entry(overrides = {}) {
  return {
    id: 'MVH-1',
    customerId: 'CUST-1',
    oldMohalla: 'Mohalla A',
    oldAddress: 'House 1',
    newMohalla: 'Mohalla B',
    newAddress: 'House 2',
    moveDate: '2026-11-02',
    annotations: [],
    ...overrides,
  };
}

test('strict dates: leap day is real in a leap year only', () => {
  assert.equal(isStrictMoveHistoryDate('2024-02-29'), true);
  assert.equal(isStrictMoveHistoryDate('2025-02-29'), false);
  assert.equal(isStrictMoveHistoryDate('2026-02-30'), false);
});

test('strict dates: month lengths follow the real calendar', () => {
  assert.equal(isStrictMoveHistoryDate('2026-08-31'), true);
  assert.equal(isStrictMoveHistoryDate('2026-09-31'), false);
  assert.equal(isStrictMoveHistoryDate('2026-04-31'), false);
  assert.equal(isStrictMoveHistoryDate('2026-12-31'), true);
});

test('strict dates: shape and range are enforced', () => {
  assert.equal(isStrictMoveHistoryDate('02-11-2026'), false);
  assert.equal(isStrictMoveHistoryDate('2026-13-01'), false);
  assert.equal(isStrictMoveHistoryDate('2026-00-10'), false);
  assert.equal(isStrictMoveHistoryDate('2026-11-00'), false);
  assert.equal(isStrictMoveHistoryDate(20261102), false);
  assert.equal(isStrictMoveHistoryDate(''), false);
});

test('normalize: a valid entry passes through trimmed', () => {
  const out = normalizeMoveHistoryEntry(entry({ oldMohalla: '  Mohalla A  ' }));
  assert.equal(out.oldMohalla, 'Mohalla A');
  assert.equal(out.customerId, 'CUST-1');
  assert.equal(out.moveDate, '2026-11-02');
  assert.deepEqual(out.annotations, []);
});

test('normalize: an entry with no id is refused', () => {
  assert.equal(normalizeMoveHistoryEntry(entry({ id: '  ' })), null);
});

test('normalize: an entry with no customer is refused', () => {
  assert.equal(normalizeMoveHistoryEntry(entry({ customerId: '' })), null);
});

test('normalize: an entry with no location note at all is refused', () => {
  assert.equal(normalizeMoveHistoryEntry(entry({
    oldMohalla: '', oldAddress: '', newMohalla: '', newAddress: '',
  })), null);
});

test('normalize: an entry with only an old note is kept', () => {
  const out = normalizeMoveHistoryEntry(entry({ newMohalla: '', newAddress: '' }));
  assert.equal(out.oldMohalla, 'Mohalla A');
});

test('normalize: an entry with a bad move date is refused', () => {
  assert.equal(normalizeMoveHistoryEntry(entry({ moveDate: '2025-02-29' })), null);
});

test('normalize: overlong fields are cut to their caps', () => {
  const out = normalizeMoveHistoryEntry(entry({
    oldMohalla: 'M'.repeat(61),
    oldAddress: 'A'.repeat(121),
  }));
  assert.equal(out.oldMohalla.length, MOVE_HISTORY_MOHALLA_MAX_LENGTH);
  assert.equal(out.oldAddress.length, MOVE_HISTORY_ADDRESS_MAX_LENGTH);
});

test('normalize: annotations are sanitized and bad ones dropped', () => {
  const out = normalizeMoveHistoryEntry(entry({
    annotations: [
      { text: 'Keys handed over', date: '2026-11-03' },
      { text: '  ', date: '2026-11-03' },
      { text: 'Bad date note', date: '2025-02-29' },
      { text: 'N'.repeat(201), date: '2026-11-04' },
    ],
  }));
  assert.equal(out.annotations.length, 2);
  assert.equal(out.annotations[0].text, 'Keys handed over');
  assert.equal(out.annotations[1].text.length, MOVE_HISTORY_ANNOTATION_MAX_LENGTH);
});

test('normalize list: a non-array becomes an empty list', () => {
  assert.deepEqual(normalizeMoveHistoryList(null), []);
  assert.deepEqual(normalizeMoveHistoryList('nope'), []);
});

test('normalize list: duplicate ids are kept once, first wins', () => {
  const out = normalizeMoveHistoryList([
    entry({ id: 'MVH-1', newMohalla: 'Mohalla B' }),
    entry({ id: 'mvh-1', newMohalla: 'Mohalla C' }),
    entry({ id: 'MVH-2', newMohalla: 'Mohalla D' }),
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].newMohalla, 'Mohalla B');
});

test('record: a valid entry is added and the input list is untouched', () => {
  const before = [entry({ id: 'MVH-1' })];
  const after = recordMoveHistoryEntry(before, entry({ id: 'MVH-2', moveDate: '2026-11-05' }));
  assert.equal(after.length, 2);
  assert.equal(before.length, 1);
});

test('record: an invalid entry leaves the list unchanged', () => {
  const before = [entry({ id: 'MVH-1' })];
  const after = recordMoveHistoryEntry(before, entry({ id: 'MVH-2', moveDate: 'not-a-date' }));
  assert.deepEqual(after, before);
});

test('record: a duplicate id is refused', () => {
  const before = [entry({ id: 'MVH-1' })];
  const after = recordMoveHistoryEntry(before, entry({ id: 'MVH-1', newMohalla: 'Mohalla Z' }));
  assert.equal(after.length, 1);
  assert.equal(after[0].newMohalla, 'Mohalla B');
});

test('annotate: a note is appended and the core fields stay exactly as recorded', () => {
  const before = [entry({ id: 'MVH-1' })];
  const after = annotateMoveHistoryEntry(before, 'MVH-1', 'Keys handed over', '2026-11-03');
  assert.equal(after[0].annotations.length, 1);
  assert.equal(after[0].annotations[0].text, 'Keys handed over');
  assert.equal(after[0].annotations[0].date, '2026-11-03');
  assert.equal(after[0].oldMohalla, 'Mohalla A');
  assert.equal(after[0].newMohalla, 'Mohalla B');
  assert.equal(after[0].moveDate, '2026-11-02');
  assert.equal(before[0].annotations.length, 0);
});

test('annotate: a second note keeps the first one in order', () => {
  const once = annotateMoveHistoryEntry([entry()], 'MVH-1', 'First note', '2026-11-03');
  const twice = annotateMoveHistoryEntry(once, 'MVH-1', 'Second note', '2026-11-04');
  assert.deepEqual(twice[0].annotations.map(note => note.text), ['First note', 'Second note']);
});

test('annotate: an unknown entry id leaves the list unchanged', () => {
  const before = [entry()];
  assert.deepEqual(annotateMoveHistoryEntry(before, 'MVH-9', 'Note', '2026-11-03'), before);
});

test('annotate: an empty note or a bad note date is refused', () => {
  const before = [entry()];
  assert.deepEqual(annotateMoveHistoryEntry(before, 'MVH-1', '   ', '2026-11-03'), before);
  assert.deepEqual(annotateMoveHistoryEntry(before, 'MVH-1', 'Note', '2025-02-29'), before);
});

test('for customer: moves list newest first', () => {
  const out = moveHistoryForCustomer([
    entry({ id: 'MVH-1', moveDate: '2026-10-01' }),
    entry({ id: 'MVH-2', moveDate: '2026-11-05' }),
    entry({ id: 'MVH-3', moveDate: '2026-11-02' }),
  ], 'CUST-1');
  assert.deepEqual(out.map(item => item.id), ['MVH-2', 'MVH-3', 'MVH-1']);
});

test('for customer: other customers never appear, and the match ignores case', () => {
  const out = moveHistoryForCustomer([
    entry({ id: 'MVH-1', customerId: 'CUST-1' }),
    entry({ id: 'MVH-2', customerId: 'CUST-2' }),
  ], 'cust-1');
  assert.deepEqual(out.map(item => item.id), ['MVH-1']);
});

test('current address: the latest entry wins', () => {
  const current = currentAddressForCustomer([
    entry({ id: 'MVH-1', moveDate: '2026-10-01', newMohalla: 'Mohalla B', newAddress: 'House 2' }),
    entry({ id: 'MVH-2', moveDate: '2026-11-05', newMohalla: 'Mohalla C', newAddress: 'House 9' }),
  ], 'CUST-1');
  assert.deepEqual(current, { mohalla: 'Mohalla C', address: 'House 9' });
});

test('current address: empty when no move is recorded', () => {
  assert.deepEqual(currentAddressForCustomer([], 'CUST-1'), { mohalla: '', address: '' });
});

test('row text: plain words, from old to new with the date', () => {
  assert.equal(
    moveHistoryRowText(entry()),
    'Mohalla B, House 2 — moved 2026-11-02 — from Mohalla A, House 1',
  );
});

test('row text: missing sides read as not recorded, never blank', () => {
  assert.equal(
    moveHistoryRowText(entry({ oldMohalla: '', oldAddress: '' })),
    'Mohalla B, House 2 — moved 2026-11-02 — from previous address not recorded',
  );
  assert.equal(
    moveHistoryRowText(entry({ newMohalla: '', newAddress: '' })),
    'new address not recorded — moved 2026-11-02 — from Mohalla A, House 1',
  );
});

test('summary text: none, one, and many', () => {
  assert.equal(moveHistorySummaryText([]), 'No move recorded yet.');
  assert.equal(moveHistorySummaryText([entry()]), '1 move recorded.');
  assert.equal(moveHistorySummaryText([entry(), entry({ id: 'MVH-2' })]), '2 moves recorded.');
});

test('section html: the add form carries the move fields', () => {
  const html = moveHouseHistorySectionHtml(customer(), []);
  assert.ok(html.includes('id="mvhForm"'));
  assert.ok(html.includes('id="mvhOldMohalla"'));
  assert.ok(html.includes('id="mvhOldAddress"'));
  assert.ok(html.includes('id="mvhNewMohalla"'));
  assert.ok(html.includes('id="mvhNewAddress"'));
  assert.ok(html.includes('id="mvhDate"'));
  assert.ok(html.includes('No move recorded yet.'));
});

test('section html: moves render newest first with the current address line', () => {
  const html = moveHouseHistorySectionHtml(customer(), [
    entry({ id: 'MVH-1', moveDate: '2026-10-01', newMohalla: 'Mohalla B' }),
    entry({ id: 'MVH-2', moveDate: '2026-11-05', newMohalla: 'Mohalla C' }),
  ]);
  assert.ok(html.indexOf('Mohalla C') < html.indexOf('Mohalla B'));
  assert.ok(html.includes('Current address: Mohalla C, House 2'));
  assert.ok(html.includes('2 moves recorded.'));
});

test('section html: user-entered text is escaped', () => {
  const html = moveHouseHistorySectionHtml(customer(), [
    entry({ oldAddress: '<script>alert(1)</script>' }),
  ]);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('section html: each entry carries its own annotate form', () => {
  const html = moveHouseHistorySectionHtml(customer(), [entry()]);
  assert.ok(html.includes('data-move-history-annotate="MVH-1"'));
  assert.ok(html.includes('Add a note to this move'));
});

test('section html: annotations render under their entry', () => {
  const html = moveHouseHistorySectionHtml(customer(), [
    entry({ annotations: [{ text: 'Keys handed over', date: '2026-11-03' }] }),
  ]);
  assert.ok(html.includes('Keys handed over'));
  assert.ok(html.includes('noted 2026-11-03'));
});

test('purity: the module touches no storage, clock, network, or page', () => {
  assert.ok(!moduleSrc.includes('localStorage'), 'no localStorage');
  assert.ok(!moduleSrc.includes('new Date('), 'no new Date(');
  assert.ok(!moduleSrc.includes('Date.now('), 'no Date.now(');
  assert.ok(!moduleSrc.includes('fetch('), 'no fetch(');
  assert.ok(!moduleSrc.includes('window.'), 'no window.');
  assert.ok(!moduleSrc.includes('document.'), 'no document.');
  assert.ok(!moduleSrc.includes('import '), 'no import');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'no standalone OLT');
});

test('store key: short, in the established style', () => {
  assert.equal(MOVE_HISTORY_STORE_KEY, 'shahdara_mvh_moves_v1');
});

test('fences: the module never names the neighbouring move and shift modules', () => {
  // The neighbouring modules were checked by filename first and are
  // neither read nor rewritten here, so this module never names them —
  // each name is built from fragments so the literal filename appears
  // nowhere in this file either.
  const ownSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const neighbours = [
    'move' + '-transfers',
    'relocation' + '-log',
    'billing' + '-address',
  ];
  for (const name of neighbours) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!ownSrc.includes(name + '.js'), `test must not name ${name}.js`);
  }
});

test('wiring: app.js imports the module and renders the section', () => {
  assert.ok(appSrc.includes("from './move-house-history.js'"), 'import present');
  assert.ok(appSrc.includes('moveHouseHistorySectionHtml'), 'section wired');
  assert.ok(appSrc.includes('loadMoveHistory()'), 'loader wired');
  assert.ok(appSrc.includes('moveHouseHistorySectionMarkup'), 'markup wired');
});

test('wiring: styles carry the move-history classes', () => {
  assert.ok(stylesSrc.includes('.mvh-list'), 'list class present');
  assert.ok(stylesSrc.includes('.mvh-form'), 'form class present');
  assert.ok(stylesSrc.includes('.mvh-annotate'), 'annotate class present');
});
