import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validOperatorNotePinDay,
  normalizeOperatorNotePin,
  normalizeOperatorNotePinList,
  isOperatorNotePinActive,
  findOperatorNotePin,
  recordOperatorNotePin,
  unpinOperatorNotePin,
  activeOperatorNotePins,
  operatorNotePinsInDisplayOrder,
  operatorNotePinSummaryText,
  operatorNotePinText,
  operatorNotePinHtml,
  operatorNotePinsHtml,
  activeOperatorNotePinsHtml,
  operatorNotePinsInDisplayOrderHtml,
  operatorNotePinCsv,
  operatorNotePinFilename,
} from '../operator-note-pin.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'operator-note-pin.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const PIN_A = { id: 'ONP-1', noteRef: 'Fragile segment — Mohalla 4', pinnedBy: 'Bike', datePinned: '2026-11-05' };
const PIN_B = { id: 'ONP-2', noteRef: 'Customer needs care on visits', pinnedBy: 'Saad', datePinned: '2026-11-06' };

test('valid day accepts strict dates and refuses bad ones', () => {
  assert.equal(validOperatorNotePinDay('2026-11-05'), true);
  assert.equal(validOperatorNotePinDay('2028-02-29'), true);
  assert.equal(validOperatorNotePinDay('2026-02-29'), false);
  assert.equal(validOperatorNotePinDay('2026-04-31'), false);
  assert.equal(validOperatorNotePinDay('2026-13-01'), false);
  assert.equal(validOperatorNotePinDay('2026-00-10'), false);
  assert.equal(validOperatorNotePinDay('2026-11-5'), false);
  assert.equal(validOperatorNotePinDay('05-11-2026'), false);
  assert.equal(validOperatorNotePinDay(''), false);
  assert.equal(validOperatorNotePinDay(null), false);
  assert.equal(validOperatorNotePinDay(20261105), false);
});

test('normalize trims fields and drops unknown fields', () => {
  const pin = normalizeOperatorNotePin({ ...PIN_A, extra: 'ignored', noteRef: '  Fragile segment — Mohalla 4  ' });
  assert.deepEqual(pin, { ...PIN_A, unpinDate: '', unpinReason: '' });
  assert.equal('extra' in pin, false);
});

test('normalize refuses half-formed pins', () => {
  assert.equal(normalizeOperatorNotePin({ noteRef: 'x', pinnedBy: 'Bike', datePinned: '2026-11-05' }), null);
  assert.equal(normalizeOperatorNotePin({ id: 'ONP-1', pinnedBy: 'Bike', datePinned: '2026-11-05' }), null);
  assert.equal(normalizeOperatorNotePin({ id: 'ONP-1', noteRef: 'x', datePinned: '2026-11-05' }), null);
  assert.equal(normalizeOperatorNotePin({ id: 'ONP-1', noteRef: 'x', pinnedBy: 'Bike', datePinned: '2026-02-29' }), null);
  assert.equal(normalizeOperatorNotePin(null), null);
  assert.equal(normalizeOperatorNotePin([PIN_A]), null);
  assert.equal(normalizeOperatorNotePin('pinned'), null);
});

test('normalize drops an invalid unpin date but keeps a valid one', () => {
  const pin = normalizeOperatorNotePin({ ...PIN_A, unpinDate: '2026-02-30', unpinReason: 'no longer needed' });
  assert.equal(pin.unpinDate, '');
  assert.equal(pin.unpinReason, 'no longer needed');
  const dated = normalizeOperatorNotePin({ ...PIN_A, unpinDate: '2026-11-06' });
  assert.equal(dated.unpinDate, '2026-11-06');
});

test('normalize list drops invalid pins and keeps the first pin per id', () => {
  const list = normalizeOperatorNotePinList([PIN_A, { ...PIN_A, noteRef: 'other note' }, PIN_B, null, { id: 'ONP-3' }]);
  assert.deepEqual(list.map((pin) => pin.id), ['ONP-1', 'ONP-2']);
  assert.deepEqual(normalizeOperatorNotePinList('not a list'), []);
  assert.deepEqual(normalizeOperatorNotePinList(null), []);
});

test('active means no unpin date and no unpin reason', () => {
  assert.equal(isOperatorNotePinActive(PIN_A), true);
  assert.equal(isOperatorNotePinActive({ ...PIN_A, unpinDate: '2026-11-06' }), false);
  assert.equal(isOperatorNotePinActive({ ...PIN_A, unpinReason: 'done' }), false);
  assert.equal(isOperatorNotePinActive({ id: 'ONP-9' }), false);
});

test('find returns the active pin for a note, case-insensitively', () => {
  assert.deepEqual(findOperatorNotePin([PIN_A, PIN_B], 'fragile segment — mohalla 4'), { ...PIN_A, unpinDate: '', unpinReason: '' });
  assert.equal(findOperatorNotePin([PIN_A], 'missing note'), null);
  assert.equal(findOperatorNotePin([{ ...PIN_A, unpinDate: '2026-11-06' }], PIN_A.noteRef), null);
  assert.equal(findOperatorNotePin([PIN_A], ''), null);
  assert.equal(findOperatorNotePin([PIN_A], '  '), null);
});

test('record adds a pin and refuses a duplicate id', () => {
  const next = recordOperatorNotePin([], PIN_A);
  assert.equal(next.length, 1);
  assert.deepEqual(next[0], { ...PIN_A, unpinDate: '', unpinReason: '' });
  const again = recordOperatorNotePin(next, { ...PIN_B, id: 'ONP-1' });
  assert.deepEqual(again, next);
});

test('record refuses a second active pin for the same note', () => {
  const list = recordOperatorNotePin([PIN_A], { id: 'ONP-9', noteRef: 'FRAGILE SEGMENT — MOHALLA 4', pinnedBy: 'Saad', datePinned: '2026-11-06' });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'ONP-1');
});

test('record refuses half-formed pins and leaves the list unchanged', () => {
  const before = [PIN_A];
  assert.deepEqual(recordOperatorNotePin(before, { id: 'ONP-2', noteRef: 'x' }), normalizeOperatorNotePinList(before));
  assert.deepEqual(recordOperatorNotePin(before, null), normalizeOperatorNotePinList(before));
});

test('record allows a fresh pin after the old one was unpinned', () => {
  const unpinned = unpinOperatorNotePin([PIN_A], PIN_A.noteRef, { unpinDate: '2026-11-06' });
  const next = recordOperatorNotePin(unpinned, { id: 'ONP-3', noteRef: PIN_A.noteRef, pinnedBy: 'Saad', datePinned: '2026-11-07' });
  assert.equal(next.length, 2);
  assert.equal(next[1].id, 'ONP-3');
  assert.equal(isOperatorNotePinActive(next[1]), true);
});

test('unpin with a date marks only that pin unpinned', () => {
  const before = [PIN_A, PIN_B];
  const next = unpinOperatorNotePin(before, PIN_A.noteRef, { unpinDate: '2026-11-07' });
  assert.equal(next.length, 2);
  assert.equal(next[0].unpinDate, '2026-11-07');
  assert.equal(next[0].unpinReason, '');
  assert.deepEqual(next[1], { ...PIN_B, unpinDate: '', unpinReason: '' });
  assert.equal(isOperatorNotePinActive(next[0]), false);
  assert.equal(isOperatorNotePinActive(next[1]), true);
});

test('unpin with a reason only works and leaves the unpin date blank', () => {
  const next = unpinOperatorNotePin([PIN_A], PIN_A.noteRef, { unpinReason: 'segment repaired' });
  assert.equal(next[0].unpinDate, '');
  assert.equal(next[0].unpinReason, 'segment repaired');
  assert.equal(isOperatorNotePinActive(next[0]), false);
});

test('unpin refuses with neither a valid date nor a reason', () => {
  const before = [PIN_A];
  assert.deepEqual(unpinOperatorNotePin(before, PIN_A.noteRef, {}), normalizeOperatorNotePinList(before));
  assert.deepEqual(unpinOperatorNotePin(before, PIN_A.noteRef, { unpinDate: '2026-02-30' }), normalizeOperatorNotePinList(before));
  assert.deepEqual(unpinOperatorNotePin(before, PIN_A.noteRef), normalizeOperatorNotePinList(before));
  assert.deepEqual(unpinOperatorNotePin(before, PIN_A.noteRef, { unpinDate: '', unpinReason: '   ' }), normalizeOperatorNotePinList(before));
});

test('unpin refuses a missing note and an already unpinned note', () => {
  const before = [PIN_A];
  assert.deepEqual(unpinOperatorNotePin(before, 'no such note', { unpinDate: '2026-11-07' }), normalizeOperatorNotePinList(before));
  const unpinned = unpinOperatorNotePin(before, PIN_A.noteRef, { unpinDate: '2026-11-07' });
  assert.deepEqual(unpinOperatorNotePin(unpinned, PIN_A.noteRef, { unpinDate: '2026-11-08' }), unpinned);
});

test('active pins list only active pins, in pinned order', () => {
  const list = [
    { ...PIN_B, datePinned: '2026-11-06' },
    { ...PIN_A, datePinned: '2026-11-05' },
    { id: 'ONP-3', noteRef: 'Old warning', pinnedBy: 'Bike', datePinned: '2026-11-04', unpinDate: '2026-11-05' },
    { id: 'ONP-4', noteRef: 'Same day note', pinnedBy: 'Bike', datePinned: '2026-11-05' },
  ];
  assert.deepEqual(activeOperatorNotePins(list).map((pin) => pin.id), ['ONP-1', 'ONP-4', 'ONP-2']);
});

test('display order puts pinned notes first in pinned order, then the rest', () => {
  const ordered = operatorNotePinsInDisplayOrder([PIN_B, PIN_A], [
    'Regular note one',
    'Customer needs care on visits',
    'Regular note two',
    'Fragile segment — Mohalla 4',
  ]);
  assert.deepEqual(ordered.map((item) => item.noteRef), [
    'Fragile segment — Mohalla 4',
    'Customer needs care on visits',
    'Regular note one',
    'Regular note two',
  ]);
  assert.equal(ordered[0].pinned, true);
  assert.equal(ordered[0].pinnedBy, 'Bike');
  assert.equal(ordered[0].datePinned, '2026-11-05');
  assert.equal(ordered[2].pinned, false);
  assert.equal(ordered[2].pinnedBy, '');
});

test('display order skips pins whose note is not in the list and collapses repeats', () => {
  const ordered = operatorNotePinsInDisplayOrder([PIN_A, PIN_B], ['Regular note', 'regular note', 'Fragile segment — Mohalla 4']);
  assert.deepEqual(ordered.map((item) => item.noteRef), ['Fragile segment — Mohalla 4', 'Regular note']);
  assert.deepEqual(operatorNotePinsInDisplayOrder([PIN_A], []), []);
  assert.deepEqual(operatorNotePinsInDisplayOrder([], ['Only note']), [{ noteRef: 'Only note', pinned: false, pinnedBy: '', datePinned: '' }]);
});

test('display order keeps the caller spelling of a note, never the pin spelling', () => {
  const ordered = operatorNotePinsInDisplayOrder(
    [{ ...PIN_A, noteRef: 'FRAGILE SEGMENT — MOHALLA 4' }],
    ['fragile segment — mohalla 4'],
  );
  assert.equal(ordered[0].noteRef, 'fragile segment — mohalla 4');
  assert.equal(ordered[0].pinned, true);
});

test('summary text counts pinned and unpinned pins', () => {
  assert.equal(operatorNotePinSummaryText([]), 'No notes pinned.');
  assert.equal(operatorNotePinSummaryText([PIN_A]), '1 pinned note.');
  assert.equal(operatorNotePinSummaryText([PIN_A, PIN_B]), '2 pinned notes.');
  assert.equal(
    operatorNotePinSummaryText([PIN_A, { ...PIN_B, unpinDate: '2026-11-07' }]),
    '1 pinned note, 1 unpinned.',
  );
});

test('pin text names the note, who pinned it, and the unpin detail', () => {
  assert.equal(operatorNotePinText(PIN_A), 'Fragile segment — Mohalla 4 — pinned by Bike on 2026-11-05');
  assert.equal(
    operatorNotePinText({ ...PIN_A, unpinDate: '2026-11-07', unpinReason: 'segment repaired' }),
    'Fragile segment — Mohalla 4 — pinned by Bike on 2026-11-05, unpinned on 2026-11-07 (segment repaired)',
  );
  assert.equal(
    operatorNotePinText({ ...PIN_A, unpinReason: 'done' }),
    'Fragile segment — Mohalla 4 — pinned by Bike on 2026-11-05, unpinned (done)',
  );
  assert.equal(operatorNotePinText(null), '');
});

test('pin html escapes user text and returns empty for an invalid pin', () => {
  const html = operatorNotePinHtml({ ...PIN_A, noteRef: '<script>alert(1)</script>' });
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal(operatorNotePinHtml(null), '');
});

test('pin lists html covers all, active-only, and display-order views', () => {
  const all = operatorNotePinsHtml([PIN_A, { ...PIN_B, unpinDate: '2026-11-07' }]);
  assert.match(all, /Fragile segment/);
  assert.match(all, /Customer needs care/);
  assert.equal(operatorNotePinsHtml([]), '<p>No notes pinned.</p>');
  assert.equal(activeOperatorNotePinsHtml([]), '<p>No pinned notes.</p>');
  assert.match(activeOperatorNotePinsHtml([PIN_A, { ...PIN_B, unpinDate: '2026-11-07' }]), /Fragile segment/);
  assert.doesNotMatch(activeOperatorNotePinsHtml([PIN_A, { ...PIN_B, unpinDate: '2026-11-07' }]), /Customer needs care/);
  assert.equal(operatorNotePinsInDisplayOrderHtml([], []), '<p>No notes listed.</p>');
  const ordered = operatorNotePinsInDisplayOrderHtml([PIN_A], ['Regular note', PIN_A.noteRef]);
  assert.ok(ordered.indexOf(PIN_A.noteRef) < ordered.indexOf('Regular note'));
  assert.match(ordered, /\(pinned by Bike on 2026-11-05\)/);
});

test('csv export has the pin fields and quotes commas and quotes', () => {
  const csv = operatorNotePinCsv([{ ...PIN_A, noteRef: 'Note, with "quotes"' }]);
  assert.equal(csv.split('\n')[0], 'id,noteRef,pinnedBy,datePinned,unpinDate,unpinReason');
  assert.match(csv, /"Note, with ""quotes"""/);
  assert.equal(operatorNotePinCsv([]), 'id,noteRef,pinnedBy,datePinned,unpinDate,unpinReason');
  assert.equal(operatorNotePinFilename(), 'operator-note-pins.csv');
});

test('inputs are never mutated, even when deep frozen', () => {
  const frozen = deepFreeze([{ ...PIN_A }, { ...PIN_B }]);
  const snapshot = JSON.stringify(frozen);
  recordOperatorNotePin(frozen, { id: 'ONP-3', noteRef: 'New note', pinnedBy: 'Bike', datePinned: '2026-11-07' });
  unpinOperatorNotePin(frozen, PIN_A.noteRef, { unpinDate: '2026-11-07' });
  activeOperatorNotePins(frozen);
  operatorNotePinsInDisplayOrder(frozen, deepFreeze(['Regular note', PIN_A.noteRef]));
  assert.equal(JSON.stringify(frozen), snapshot);
});

test('pure module reads no storage, clock, network, or page', () => {
  assert.doesNotMatch(moduleSrc, /document\./);
  assert.doesNotMatch(moduleSrc, /localStorage/);
  assert.doesNotMatch(moduleSrc, /new Date\(/);
  assert.doesNotMatch(moduleSrc, /Date\.now\(/);
  assert.doesNotMatch(moduleSrc, /fetch\(/);
  assert.doesNotMatch(moduleSrc, /window\./);
});

test('app.js wires the pinning panel and index.html carries it', () => {
  assert.ok(appJs.includes("from './operator-note-pin.js'"), 'app.js imports the module');
  assert.ok(appJs.includes('renderOperatorNotePins();'), 'render call is wired');
  assert.ok(appJs.includes('shahdara_onp_pins_v1'), 'store key is wired');
  assert.ok(indexHtml.includes('id="onpHeading"'), 'panel heading present');
  assert.ok(indexHtml.includes('id="onpBody"'), 'pins body present');
  assert.ok(indexHtml.includes('id="onpPinnedBody"'), 'pinned body present');
  assert.ok(indexHtml.includes('id="onpPinBtn"'), 'pin button present');
  assert.ok(indexHtml.includes('id="onpUnpinBtn"'), 'unpin button present');
  assert.ok(indexHtml.includes('id="onpExportBtn"'), 'export button present');
});
