// QC-1: Field Mode — Not Available marking with reason + note.
// Pure-function tests on synthetic data only (no real customers, no
// real phone numbers). The mark writes ONLY to the existing
// date-scoped route outcome/note stores — it never creates a payment,
// never touches dues or bills, and never adds a store key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  FIELD_ROUTE_OUTCOMES,
  getFieldRouteOutcomes,
  saveFieldRouteOutcome,
  getFieldRouteNotes,
  saveFieldRouteNote,
} from '../nav-collection-rounds.js';
import {
  VISIT_OUTCOMES,
  VISIT_OUTCOME_LABELS,
  QUEUEABLE_VISIT_OUTCOMES,
  normalizeVisitOutcome,
  isQueueableOutcome,
  buildNextActionQueue,
} from '../visit-outcomes.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  FIELD_NOT_AVAILABLE_REASONS,
  fieldNotAvailableReason,
  fieldNotAvailableMark,
  sortFieldModeEntriesWithNotAvailableLast,
  saveFieldNotAvailableMark,
  clearFieldNotAvailableMark,
  markFieldVisitPaid,
} from '../field-mode.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');
const DATE = '2026-11-09';

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    keys: () => [...data.keys()],
  };
}

const entry = (id, totalDues = 1000) => ({ id, name: `Customer ${id}`, totalDues });

// --- QC-1: the shared vocabulary accepts the new reason -------------

test('QC-1: FIELD_ROUTE_OUTCOMES carries CALL_LATER alongside the old eight', () => {
  assert.equal(FIELD_ROUTE_OUTCOMES.CALL_LATER, 'call_later');
  assert.equal(FIELD_ROUTE_OUTCOMES.NOT_HOME, 'not_home');
  assert.equal(FIELD_ROUTE_OUTCOMES.PROMISED, 'promised');
  assert.equal(FIELD_ROUTE_OUTCOMES.REFUSED, 'refused');
  assert.equal(Object.keys(FIELD_ROUTE_OUTCOMES).length, 9);
});

test('QC-1: saveFieldRouteOutcome accepts call_later (was rejected as pending before)', () => {
  const store = fakeStorage();
  const record = saveFieldRouteOutcome('cust-1', { outcome: 'call_later', note: 'Ask again after 6' }, store, DATE);
  assert.equal(record.outcome, 'call_later');
  assert.equal(record.note, 'Ask again after 6');
  assert.equal(getFieldRouteOutcomes(store, DATE)['cust-1'].outcome, 'call_later');
});

test('QC-1: saveFieldRouteOutcome still rejects an unknown outcome as pending', () => {
  const store = fakeStorage();
  saveFieldRouteOutcome('cust-1', { outcome: 'teleported' }, store, DATE);
  assert.equal(getFieldRouteOutcomes(store, DATE)['cust-1'], undefined);
});

test('QC-1: visit-outcomes catalogue carries call_later as a queueable missed visit', () => {
  assert.ok(VISIT_OUTCOMES.includes('call_later'));
  assert.equal(VISIT_OUTCOME_LABELS.call_later, 'Call later');
  assert.ok(QUEUEABLE_VISIT_OUTCOMES.includes('call_later'));
  assert.equal(normalizeVisitOutcome('call later'), 'call_later');
  assert.equal(normalizeVisitOutcome('call-later'), 'call_later');
  assert.equal(isQueueableOutcome('call_later'), true);
});

test('QC-1: a call_later visit joins the next-action queue for the day after the visit', () => {
  const queue = buildNextActionQueue([
    { customerId: 'cust-1', customerName: 'A', outcome: 'call_later', visitDate: '2026-11-09' },
    { customerId: 'cust-2', customerName: 'B', outcome: 'paid', visitDate: '2026-11-09' },
  ]);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].customerId, 'cust-1');
  assert.equal(queue[0].outcomeLabel, 'Call later');
  assert.equal(queue[0].nextActionDate, '2026-11-10');
});

// --- QC-1: the four Field Mode reasons -------------------------------

test('QC-1: FIELD_NOT_AVAILABLE_REASONS is exactly the four user reasons, in order', () => {
  assert.deepEqual(
    FIELD_NOT_AVAILABLE_REASONS.map((r) => r.outcome),
    ['not_home', 'promised', 'refused', 'call_later'],
  );
  for (const reason of FIELD_NOT_AVAILABLE_REASONS) {
    assert.equal(typeof reason.icon, 'string');
    assert.ok(reason.icon.length > 0, reason.outcome);
    assert.equal(typeof reason.labelKey, 'string');
    assert.ok(reason.labelKey.startsWith('fmna_reason_'), reason.outcome);
    assert.equal(typeof reason.label, 'string');
    assert.ok(reason.label.length > 0, reason.outcome);
  }
});

test('QC-1: every reason label matches its EN i18n value and has an Urdu value', () => {
  for (const reason of FIELD_NOT_AVAILABLE_REASONS) {
    assert.equal(TRANSLATIONS.en[reason.labelKey], reason.label, reason.outcome);
    const urdu = TRANSLATIONS.ur[reason.labelKey];
    assert.equal(typeof urdu, 'string');
    assert.ok(/[\u0600-\u06FF]/.test(urdu), `${reason.outcome} Urdu value carries Urdu script`);
  }
});

test('QC-1: fieldNotAvailableReason resolves the four reasons and nothing else', () => {
  assert.equal(fieldNotAvailableReason('not_home').label, 'Home Closed');
  assert.equal(fieldNotAvailableReason('promised').label, 'Payment Promised');
  assert.equal(fieldNotAvailableReason('refused').label, 'Refused to Pay');
  assert.equal(fieldNotAvailableReason('call_later').label, 'Call Later');
  assert.equal(fieldNotAvailableReason('paid'), null);
  assert.equal(fieldNotAvailableReason('dispute'), null);
  assert.equal(fieldNotAvailableReason('nope'), null);
  assert.equal(fieldNotAvailableReason(undefined), null);
});

// --- QC-1: recording a mark (outcome + note, no payment) -------------

test('QC-1: a mark lands in both route stores and nowhere else', () => {
  const store = fakeStorage();
  const state = {
    customers: [{ id: 'cust-1', name: 'Test', bills: [{ month: '2026-11', dueAmount: 1000, status: 'unpaid', payments: [] }] }],
  };
  const before = JSON.stringify(state);
  const record = saveFieldNotAvailableMark('cust-1', 'not_home', 'Gate locked', store, DATE);
  assert.equal(record.outcome, 'not_home');
  assert.equal(record.note, 'Gate locked');
  assert.equal(getFieldRouteOutcomes(store, DATE)['cust-1'].outcome, 'not_home');
  assert.equal(getFieldRouteNotes(store, DATE)['cust-1'], 'Gate locked');
  // No new store key: only the three pre-existing route keys were
  // written (outcomes + notes + the progress sync write that every
  // saveFieldRouteOutcome already performs).
  assert.deepEqual(
    store.keys().sort(),
    ['shahdara_field_route_notes', 'shahdara_field_route_outcomes', 'shahdara_field_route_progress'],
  );
  // No payment record, no dues change, no bill change.
  assert.equal(JSON.stringify(state), before);
});

test('QC-1: a mark without a note still records the reason and clears any old note', () => {
  const store = fakeStorage();
  saveFieldRouteNote('cust-1', 'Old note', store, DATE);
  saveFieldNotAvailableMark('cust-1', 'refused', '   ', store, DATE);
  assert.equal(getFieldRouteOutcomes(store, DATE)['cust-1'].outcome, 'refused');
  assert.equal(getFieldRouteNotes(store, DATE)['cust-1'], undefined);
});

test('QC-1: re-marking overwrites the single-slot outcome (QC-8 owns history)', () => {
  const store = fakeStorage();
  saveFieldNotAvailableMark('cust-1', 'not_home', 'First visit', store, DATE);
  saveFieldNotAvailableMark('cust-1', 'call_later', 'Second visit', store, DATE);
  const outcomes = getFieldRouteOutcomes(store, DATE);
  assert.equal(Object.keys(outcomes).length, 1);
  assert.equal(outcomes['cust-1'].outcome, 'call_later');
  assert.equal(outcomes['cust-1'].note, 'Second visit');
});

test('QC-1: an unknown reason never writes a mark', () => {
  const store = fakeStorage();
  assert.equal(saveFieldNotAvailableMark('cust-1', 'teleported', 'x', store, DATE), null);
  assert.deepEqual(getFieldRouteOutcomes(store, DATE), {});
  assert.deepEqual(store.keys(), []);
});

// --- QC-1: the mark shows afterwards ----------------------------------

test('QC-1: fieldNotAvailableMark returns reason + label + note, or null', () => {
  const store = fakeStorage();
  saveFieldNotAvailableMark('cust-1', 'promised', 'Will pay on the 12th', store, DATE);
  const outcomes = getFieldRouteOutcomes(store, DATE);
  const notes = getFieldRouteNotes(store, DATE);
  const mark = fieldNotAvailableMark(outcomes, notes, 'cust-1');
  assert.deepEqual(mark, { outcome: 'promised', icon: '🤝', label: 'Payment Promised', labelKey: 'fmna_reason_promised', note: 'Will pay on the 12th' });
  assert.equal(fieldNotAvailableMark(outcomes, notes, 'cust-2'), null);
  // A paid outcome is not a not-available mark.
  saveFieldRouteOutcome('cust-2', { outcome: 'paid' }, store, DATE);
  assert.equal(fieldNotAvailableMark(getFieldRouteOutcomes(store, DATE), notes, 'cust-2'), null);
});

test('QC-1: the note falls back to the notes map when the outcome carries none', () => {
  const store = fakeStorage();
  saveFieldRouteOutcome('cust-1', { outcome: 'not_home' }, store, DATE);
  saveFieldRouteNote('cust-1', 'Neighbour said back at 6', store, DATE);
  const mark = fieldNotAvailableMark(getFieldRouteOutcomes(store, DATE), getFieldRouteNotes(store, DATE), 'cust-1');
  assert.equal(mark.note, 'Neighbour said back at 6');
});

// --- QC-1: skip-this-round (marked customers sort to the bottom) -----

test('QC-1: marked entries sort to the bottom, unmarked order untouched', () => {
  const store = fakeStorage();
  saveFieldNotAvailableMark('cust-b', 'not_home', '', store, DATE);
  const entries = [entry('cust-a'), entry('cust-b'), entry('cust-c')];
  const sorted = sortFieldModeEntriesWithNotAvailableLast(entries, getFieldRouteOutcomes(store, DATE));
  assert.deepEqual(sorted.map((e) => e.id), ['cust-a', 'cust-c', 'cust-b']);
  // Input untouched, and the returned list is a new array.
  assert.deepEqual(entries.map((e) => e.id), ['cust-a', 'cust-b', 'cust-c']);
  assert.notEqual(sorted, entries);
});

test('QC-1: with no marks the order is exactly the input order', () => {
  const entries = [entry('cust-a'), entry('cust-b')];
  assert.deepEqual(
    sortFieldModeEntriesWithNotAvailableLast(entries, {}).map((e) => e.id),
    ['cust-a', 'cust-b'],
  );
});

test('QC-1: several marked entries keep their relative order at the bottom', () => {
  const store = fakeStorage();
  saveFieldNotAvailableMark('cust-a', 'refused', '', store, DATE);
  saveFieldNotAvailableMark('cust-c', 'call_later', '', store, DATE);
  const sorted = sortFieldModeEntriesWithNotAvailableLast(
    [entry('cust-a'), entry('cust-b'), entry('cust-c'), entry('cust-d')],
    getFieldRouteOutcomes(store, DATE),
  );
  assert.deepEqual(sorted.map((e) => e.id), ['cust-b', 'cust-d', 'cust-a', 'cust-c']);
});

// --- QC-1: clearing a mark + payment superseding a mark --------------

test('QC-1: clearing removes the outcome and the note', () => {
  const store = fakeStorage();
  saveFieldNotAvailableMark('cust-1', 'not_home', 'Gate locked', store, DATE);
  clearFieldNotAvailableMark('cust-1', store, DATE);
  assert.deepEqual(getFieldRouteOutcomes(store, DATE), {});
  assert.deepEqual(getFieldRouteNotes(store, DATE), {});
});

test('QC-1: a real payment supersedes a stale not-available mark, keeping the note', () => {
  const store = fakeStorage();
  saveFieldNotAvailableMark('cust-1', 'not_home', 'Gate locked', store, DATE);
  const record = markFieldVisitPaid('cust-1', store, DATE);
  assert.equal(record.outcome, 'paid');
  assert.equal(record.note, 'Gate locked');
  assert.equal(getFieldRouteOutcomes(store, DATE)['cust-1'].outcome, 'paid');
});

test('QC-1: markFieldVisitPaid is a no-op with no mark and with an already-paid outcome', () => {
  const store = fakeStorage();
  assert.equal(markFieldVisitPaid('cust-1', store, DATE), null);
  assert.deepEqual(store.keys(), []);
  saveFieldRouteOutcome('cust-1', { outcome: 'paid' }, store, DATE);
  const record = markFieldVisitPaid('cust-1', store, DATE);
  assert.equal(record.outcome, 'paid');
});

// --- QC-1: structural pins (the Field Mode sheet + card wiring) -----

test('QC-1 pin: the Field Mode collect sheet carries the Not Available section', () => {
  const src = read('field-mode.js');
  assert.ok(src.includes('data-field-notavail'), 'reason chips use data-field-notavail');
  assert.ok(src.includes('fmna_title'), 'section heading uses the fmna_title key');
  assert.ok(src.includes('fieldNotAvailableMark'), 'sheet reads the mark for display');
  assert.ok(src.includes('saveFieldNotAvailableMark'), 'sheet saves through the QC-1 wrapper');
  assert.ok(src.includes('sortFieldModeEntriesWithNotAvailableLast'), 'list sorts marked stops last');
  // No new element id: the section is wired by class / data attribute only.
  assert.ok(!src.includes('id="fieldModeNotAvail'), 'no fieldModeNotAvail id exists');
  // No new store key: field-mode.js still names no shahdara_ key at all.
  assert.equal((src.match(/shahdara_/g) || []).length, 0, 'no shahdara_ store key in field-mode.js');
});

test('QC-1 pin: the route sheet shows a Call Later badge for the new outcome', () => {
  const src = read('nav-collection-rounds.js');
  assert.ok(src.includes("outcome === 'call_later'"), 'route sheet badges call_later');
  assert.ok(src.includes('Call later'), 'badge carries the Call later label');
});

test('QC-1 pin: the new note input is token-only CSS (components.css stays hex-free)', () => {
  // The Plan A ratchet strips comments first — the file header
  // itself says "#230 design-system components", which is not a
  // colour. Same strip here.
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
  const css = stripComments(read('components.css'));
  assert.ok(css.includes('.field-mode-notavail-note'), 'note input rule exists');
  const block = css.slice(css.indexOf('.field-mode-notavail-note'));
  const rule = block.slice(0, block.indexOf('}'));
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(rule), 'note rule carries no hex colour');
  assert.ok(!/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/.test(css), 'components.css stays hex-free');
});

test('QC-1 pin: all fmna_ keys exist in EN and UR with Urdu script in UR', () => {
  const keys = [
    'fmna_title', 'fmna_note_placeholder', 'fmna_save', 'fmna_clear',
    'fmna_saved', 'fmna_cleared', 'fmna_marked_today',
    'fmna_reason_not_home', 'fmna_reason_promised',
    'fmna_reason_refused', 'fmna_reason_call_later',
  ];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `EN ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `UR ${key}`);
    assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur[key]), `UR ${key} carries Urdu script`);
  }
});
