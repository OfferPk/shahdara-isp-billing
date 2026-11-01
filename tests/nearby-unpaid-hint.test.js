// SISP-168: Same-Pole / Same-Splitter Nearby Unpaid Neighbor Prompt in
// Field Mode. Pure-builder tests on synthetic data only. Spec pins:
//   - proximity ranking: tier pole > chain > splitter; within a tier
//     dues descending, then customerNumber ascending; cap 3.
//   - exclusion of paid / paused / archived / FREE accounts and of the
//     just-paid customer himself (even with a remainder due).
//   - a multi-tier candidate appears ONCE, at its best tier.
// The builder is read-only and derives dues from the real allocation
// engine (calculatePaymentAllocations) — the Field Mode lists' source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calculatePaymentAllocations } from '../core.js';
import { TRANSLATIONS, t } from '../nav-language.js';
import { buildNearbyUnpaidHints, NEARBY_HINT_LIMIT } from '../nearby-unpaid-hint.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

// Fixed "today": 2026-10-28 PKT, so the current month is 2026-10 and
// the pause checks stay stable (the field-mode.test.js convention).
const REF_DATE = new Date('2026-10-28T05:00:00.000Z');

const bill = (month, dueAmount, payments = []) => ({
  id: `bill-${month}`, month, dueAmount, dueDate: `${month}-05`,
  status: 'pending', payments
});
const paidBill = (month, dueAmount) => bill(month, dueAmount, [
  { id: `pay-${month}`, date: `${month}-10`, amount: dueAmount, method: 'Cash' }
]);
const customer = (id, number, name, overrides = {}) => ({
  id, customerNumber: number, name, archived: false, bills: [], ...overrides
});
const stateWith = (customers) => ({ customers });
const hintsFor = (state, paidId) => buildNearbyUnpaidHints(state, paidId, null, REF_DATE);

test('SISP-168 ranking: pole (dues desc) -> chain -> splitter, capped at 3', () => {
  const state = stateWith([
    customer('paid', 50, 'PAID HOUSE', {
      poleNumber: 'P-7', splitterBoxId: 'DB-01',
      bills: [paidBill('2026-10', 3000)]
    }),
    customer('pole-big', 61, 'POLE BIG', {
      poleNumber: 'P-7', bills: [bill('2026-10', 5000)]
    }),
    customer('pole-small', 62, 'POLE SMALL', {
      poleNumber: '  P-7  ', bills: [bill('2026-10', 2000)]
    }),
    customer('chain-c', 63, 'CHAIN HOUSE', {
      upstreamCustomerId: 'paid', bills: [bill('2026-10', 4000)]
    }),
    customer('split-c', 64, 'SPLITTER HOUSE', {
      splitterBoxId: 'DB-01', bills: [bill('2026-10', 9000)]
    })
  ]);
  const hints = hintsFor(state, 'paid');
  assert.equal(hints.length, NEARBY_HINT_LIMIT);
  assert.deepEqual(hints.map((h) => h.customerId), ['pole-big', 'pole-small', 'chain-c']);
  assert.deepEqual(hints.map((h) => h.relation), ['pole', 'pole', 'chain']);
  assert.deepEqual(hints.map((h) => h.duesCents), [500000, 200000, 400000]);
  // The splitter neighbour owes the MOST but the tier order cuts him:
  // pole and chain stops come first on the same visit.
  assert.ok(!hints.some((h) => h.customerId === 'split-c'));
  assert.equal(hints[0].relationLabel, 'P-7');
});

test('SISP-168 ranking: same tier + same dues falls back to customerNumber ascending', () => {
  const state = stateWith([
    customer('paid', 50, 'PAID HOUSE', { poleNumber: 'P-9', bills: [paidBill('2026-10', 3000)] }),
    customer('later', 72, 'LATER NUMBER', { poleNumber: 'P-9', bills: [bill('2026-10', 3000)] }),
    customer('earlier', 71, 'EARLIER NUMBER', { poleNumber: 'P-9', bills: [bill('2026-10', 3000)] })
  ]);
  const hints = hintsFor(state, 'paid');
  assert.deepEqual(hints.map((h) => h.customerId), ['earlier', 'later']);
});

test('SISP-168 exclusions: paid-up, paused, archived, FREE neighbours never hint', () => {
  const state = stateWith([
    customer('paid', 50, 'PAID HOUSE', { poleNumber: 'P-3', bills: [paidBill('2026-10', 3000)] }),
    customer('paid-up', 81, 'PAID UP', { poleNumber: 'P-3', bills: [paidBill('2026-10', 3000)] }),
    customer('paused', 82, 'ON HOLD', {
      poleNumber: 'P-3', paused: true, pauseStartDate: '2026-10-01', autoResumeDate: null,
      bills: [bill('2026-10', 3000)]
    }),
    customer('skipped', 83, 'SKIPPED MONTH', {
      poleNumber: 'P-3', pauseSkippedMonths: ['2026-10'],
      bills: [bill('2026-10', 3000)]
    }),
    customer('archived', 84, 'LEFT', {
      poleNumber: 'P-3', archived: true, bills: [bill('2026-10', 3000)]
    }),
    customer('free', 85, 'FREE LINE', {
      poleNumber: 'P-3', isFreeConnection: true, bills: []
    }),
    customer('owing', 86, 'STILL OWING', { poleNumber: 'P-3', bills: [bill('2026-10', 1500)] })
  ]);
  const hints = hintsFor(state, 'paid');
  assert.deepEqual(hints.map((h) => h.customerId), ['owing']);
});

test('SISP-168 exclusions: the just-paid customer is never his own hint, even with a remainder', () => {
  const state = stateWith([
    customer('paid', 50, 'PART PAYER', {
      poleNumber: 'P-4',
      bills: [bill('2026-10', 3000, [{ id: 'part-1', date: '2026-10-28', amount: 1000, method: 'Cash' }])]
    }),
    customer('neighbour', 87, 'NEXT DOOR', { poleNumber: 'P-4', bills: [bill('2026-10', 3000)] })
  ]);
  const hints = hintsFor(state, 'paid');
  assert.deepEqual(hints.map((h) => h.customerId), ['neighbour']);
});

test('SISP-168 multi-tier: same pole + splitter + chain appears ONCE at pole', () => {
  const state = stateWith([
    customer('paid', 50, 'PAID HOUSE', {
      poleNumber: 'P-5', splitterBoxId: 'DB-05', bills: [paidBill('2026-10', 3000)]
    }),
    customer('multi', 88, 'ALL THREE', {
      poleNumber: 'P-5', splitterBoxId: 'DB-05', upstreamCustomerId: 'paid',
      bills: [bill('2026-10', 3000)]
    })
  ]);
  const hints = hintsFor(state, 'paid');
  assert.equal(hints.length, 1);
  assert.equal(hints[0].customerId, 'multi');
  assert.equal(hints[0].relation, 'pole');
});

test('SISP-168 chain: sibling, upstream and same-root cousin all count as chain', () => {
  // The just-paid house hangs under mid-a; mid-a itself still owes
  // (upstream match), the sibling shares mid-a as upstream, and the
  // cousin shares only the root ancestor via mid-b.
  const state = stateWith([
    customer('root', 5, 'ROOT HOUSE', { bills: [paidBill('2026-10', 3000)] }),
    customer('mid-a', 6, 'MID A', { upstreamCustomerId: 'root', bills: [bill('2026-10', 1000)] }),
    customer('mid-b', 7, 'MID B', { upstreamCustomerId: 'root', bills: [paidBill('2026-10', 3000)] }),
    customer('paid', 50, 'PAID HOUSE', { upstreamCustomerId: 'mid-a', bills: [paidBill('2026-10', 3000)] }),
    customer('sibling', 91, 'SIBLING', { upstreamCustomerId: 'mid-a', bills: [bill('2026-10', 1000)] }),
    customer('cousin', 93, 'COUSIN', { upstreamCustomerId: 'mid-b', bills: [bill('2026-10', 1000)] })
  ]);
  const hints = hintsFor(state, 'paid');
  const byId = new Map(hints.map((h) => [h.customerId, h]));
  assert.deepEqual([...byId.keys()].sort(), ['cousin', 'mid-a', 'sibling']);
  for (const h of hints) assert.equal(h.relation, 'chain');
  // Sibling's label is the shared upstream's customer number.
  assert.equal(byId.get('sibling').relationLabel, '6');
});

test('SISP-168 chain: a pre-existing upstream cycle never hangs and never hints strangers', () => {
  const state = stateWith([
    customer('paid', 50, 'PAID HOUSE', { bills: [paidBill('2026-10', 3000)] }),
    customer('loop-a', 95, 'LOOP A', { upstreamCustomerId: 'loop-b', bills: [bill('2026-10', 3000)] }),
    customer('loop-b', 96, 'LOOP B', { upstreamCustomerId: 'loop-a', bills: [bill('2026-10', 3000)] })
  ]);
  assert.deepEqual(hintsFor(state, 'paid'), []);
  // ...but a pole match inside the same roster still works.
  const state2 = stateWith([
    customer('paid', 50, 'PAID HOUSE', { poleNumber: 'P-8', bills: [paidBill('2026-10', 3000)] }),
    customer('loop-a', 95, 'LOOP A', {
      poleNumber: 'P-8', upstreamCustomerId: 'loop-b', bills: [bill('2026-10', 3000)]
    }),
    customer('loop-b', 96, 'LOOP B', { upstreamCustomerId: 'loop-a', bills: [bill('2026-10', 3000)] })
  ]);
  const hints = hintsFor(state2, 'paid');
  assert.deepEqual(hints.map((h) => h.customerId), ['loop-a']);
  assert.equal(hints[0].relation, 'pole');
});

test('SISP-168 splitter: box-only match hints at the splitter tier with the box id as label', () => {
  const state = stateWith([
    customer('paid', 50, 'PAID HOUSE', { splitterBoxId: 'DB-02', bills: [paidBill('2026-10', 3000)] }),
    customer('box-mate', 97, 'BOX MATE', { splitterBoxId: 'DB-02', bills: [bill('2026-09', 2500)] }),
    customer('other-box', 98, 'OTHER BOX', { splitterBoxId: 'DB-99', bills: [bill('2026-10', 2500)] })
  ]);
  const hints = hintsFor(state, 'paid');
  assert.equal(hints.length, 1);
  assert.equal(hints[0].customerId, 'box-mate');
  assert.equal(hints[0].relation, 'splitter');
  assert.equal(hints[0].relationLabel, 'DB-02');
  assert.equal(hints[0].duesCents, 250000);
});

test('SISP-168: no shared pole/box/chain means no hints; unknown paid id means no hints', () => {
  const state = stateWith([
    customer('paid', 50, 'PAID HOUSE', { bills: [paidBill('2026-10', 3000)] }),
    customer('stranger', 99, 'FAR AWAY', {
      poleNumber: 'P-ELSEWHERE', splitterBoxId: 'DB-77', bills: [bill('2026-10', 3000)]
    })
  ]);
  assert.deepEqual(hintsFor(state, 'paid'), []);
  assert.deepEqual(hintsFor(state, 'missing-id'), []);
  assert.deepEqual(buildNearbyUnpaidHints(null, 'paid', null, REF_DATE), []);
});

test('SISP-168: dues span all unpaid months and a shared allocations pass gives the same answer', () => {
  const state = stateWith([
    customer('paid', 50, 'PAID HOUSE', { poleNumber: 'P-6', bills: [paidBill('2026-10', 3000)] }),
    customer('two-months', 90, 'TWO MONTHS', {
      poleNumber: 'P-6', bills: [bill('2026-09', 3000), bill('2026-10', 3000)]
    })
  ]);
  const fresh = hintsFor(state, 'paid');
  assert.equal(fresh[0].duesCents, 600000);
  const shared = buildNearbyUnpaidHints(state, 'paid', calculatePaymentAllocations(state), REF_DATE);
  assert.deepEqual(shared, fresh);
});

test('SISP-168: the builder is read-only (frozen state in, hints out, nothing mutated)', () => {
  const state = stateWith([
    customer('paid', 50, 'PAID HOUSE', { poleNumber: 'P-7', bills: [paidBill('2026-10', 3000)] }),
    customer('owing', 61, 'OWING', { poleNumber: 'P-7', bills: [bill('2026-10', 3000)] })
  ]);
  const before = JSON.stringify(state);
  const deepFreeze = (v) => {
    if (v && typeof v === 'object') { Object.values(v).forEach(deepFreeze); Object.freeze(v); }
    return v;
  };
  deepFreeze(state);
  const hints = hintsFor(state, 'paid');
  assert.equal(hints.length, 1);
  assert.equal(JSON.stringify(state), before);
});

test('SISP-168 i18n: every fmnear_* key used by field-mode exists in en + ur and never renders raw', () => {
  const fieldMode = read('field-mode.js');
  // Every fmnear_* literal field-mode passes to t() — directly or via
  // the chipKey variable — must resolve in both dictionaries.
  const used = [...new Set([...fieldMode.matchAll(/'(fmnear_[a-z_]+)'/g)].map((m) => m[1]))];
  assert.deepEqual(used.sort(), ['fmnear_chain', 'fmnear_dismiss', 'fmnear_pole', 'fmnear_splitter', 'fmnear_title']);
  for (const key of used) {
    assert.ok(TRANSLATIONS.en[key], `missing en ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur ${key}`);
    assert.notEqual(t(key, 'en'), key);
    assert.notEqual(t(key, 'ur'), key);
  }
});

test('SISP-168 wiring: Field Mode computes hints from the post-payment state and renders the card container', () => {
  const fieldMode = read('field-mode.js');
  const html = read('index.html');
  assert.ok(fieldMode.includes("buildNearbyUnpaidHints(nextState, fresh.id, calculatePaymentAllocations(nextState))"));
  assert.ok(fieldMode.includes("document.getElementById('fieldModeNearbyHints')"));
  assert.ok(fieldMode.includes('data-field-nearby-dismiss'));
  assert.ok(fieldMode.includes('data-field-nearby-id'));
  assert.ok(html.includes('id="fieldModeNearbyHints"'));
  // The hint card must not sit inside the receipt/action panel markup.
  const listIdx = html.indexOf('id="fieldModeCustomerList"');
  const hintsIdx = html.indexOf('id="fieldModeNearbyHints"');
  assert.ok(hintsIdx > -1 && hintsIdx < listIdx);
});
