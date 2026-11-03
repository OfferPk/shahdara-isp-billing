// Plan O — Collections and follow-up: Waada age bands, suspense
// ageing, group pro-rata. Pure-module tests; no DOM harness, so the
// modal controllers (band grouping display, suspense age lines, split
// mode select) are inspection-verified and their behaviour is pinned
// here through the pure helpers they render.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WAADA_AGE_BANDS,
  waadaOverdueDays,
  waadaAgeBand,
  tierWaadaQueue,
  groupBrokenWaadaByAgeBand
} from '../waada-queue.js';
import {
  suspenseAgeDays,
  ageSuspenseEntries,
  suspenseSummary,
  sanitizeSuspensePayments
} from '../suspense-payments.js';
import {
  allocateGroupProRata,
  collectGroupProRata,
  collectGroupPartial,
  buildGroupReceipt,
  groupWaadaTargets
} from '../group-billing.js';

const TODAY = '2026-10-28';
const promised = (daysAgo, id, outstanding = 1000) => ({
  customer: { id, name: `Customer ${id}`, customerNumber: id, promiseDate: `2026-10-${String(28 - daysAgo).padStart(2, '0')}` },
  outstanding
});

// --- Waada age bands ---

test('waadaOverdueDays: today and future are 0, past counts calendar days, invalid is null', () => {
  assert.equal(waadaOverdueDays('2026-10-28', TODAY), 0);
  assert.equal(waadaOverdueDays('2026-10-30', TODAY), 0);
  assert.equal(waadaOverdueDays('2026-10-25', TODAY), 3);
  assert.equal(waadaOverdueDays('2026-10-13', TODAY), 15);
  assert.equal(waadaOverdueDays('2024-02-29', '2024-03-01'), 1);
  assert.equal(waadaOverdueDays('not-a-date', TODAY), null);
  assert.equal(waadaOverdueDays('2026-02-30', TODAY), null);
  assert.equal(waadaOverdueDays(null, TODAY), null);
});

test('waadaAgeBand: every overdue day lands in exactly one band, day 15 is 15+', () => {
  assert.equal(waadaAgeBand('2026-10-28', TODAY), null);
  assert.equal(waadaAgeBand('2026-10-27', TODAY), '1-3');
  assert.equal(waadaAgeBand('2026-10-25', TODAY), '1-3');
  assert.equal(waadaAgeBand('2026-10-24', TODAY), '4-7');
  assert.equal(waadaAgeBand('2026-10-21', TODAY), '4-7');
  assert.equal(waadaAgeBand('2026-10-20', TODAY), '8-14');
  assert.equal(waadaAgeBand('2026-10-14', TODAY), '8-14');
  assert.equal(waadaAgeBand('2026-10-13', TODAY), '15+');
  assert.equal(waadaAgeBand('2026-09-01', TODAY), '15+');
  assert.equal(waadaAgeBand('bad', TODAY), null);
  // Bands are contiguous and non-overlapping: 1..14 then 15+.
  const bands = WAADA_AGE_BANDS;
  assert.deepEqual(bands.map((b) => b.id), ['1-3', '4-7', '8-14', '15+']);
  for (let i = 1; i < bands.length; i++) assert.equal(bands[i].min, bands[i - 1].max + 1);
});

test('tierWaadaQueue: broken items carry overdueDays + ageBand, buckets unchanged', () => {
  const tiers = tierWaadaQueue([
    promised(2, 'a', 500),
    promised(10, 'b', 700),
    promised(20, 'c', 900),
    { customer: { id: 'd', name: 'No promise' }, outstanding: 300 },
    { customer: { id: 'e', name: 'Future', promiseDate: '2026-11-05' }, outstanding: 400 },
    { customer: { id: 'f', name: 'Zero' }, outstanding: 0 }
  ], TODAY);
  assert.equal(tiers.broken.length, 3);
  assert.equal(tiers.active.length, 1);
  assert.equal(tiers.promised.length, 1);
  const byId = Object.fromEntries(tiers.broken.map((item) => [item.customer.id, item]));
  assert.equal(byId.a.overdueDays, 2);
  assert.equal(byId.a.ageBand, '1-3');
  assert.equal(byId.b.overdueDays, 10);
  assert.equal(byId.b.ageBand, '8-14');
  assert.equal(byId.c.overdueDays, 20);
  assert.equal(byId.c.ageBand, '15+');
  assert.deepEqual(tiers.brokenAgeBandCounts, { '1-3': 1, '4-7': 0, '8-14': 1, '15+': 1 });
  assert.equal(tiers.brokenByAgeBand['1-3'][0].customer.id, 'a');
  assert.equal(tiers.brokenByAgeBand['4-7'].length, 0);
});

test('groupBrokenWaadaByAgeBand: band order, counts, totals, empty bands kept', () => {
  const groups = groupBrokenWaadaByAgeBand([
    promised(1, 'a', 100),
    promised(5, 'b', 200),
    promised(6, 'c', 300),
    // 30 days back crosses the month, so use an explicit date here.
    { customer: { id: 'd', name: 'Customer d', customerNumber: 'd', promiseDate: '2026-09-28' }, outstanding: 400 },
    { customer: { id: 'e', name: 'Active' }, outstanding: 500 }
  ], TODAY);
  assert.deepEqual(groups.map((g) => g.id), ['1-3', '4-7', '8-14', '15+']);
  assert.deepEqual(groups.map((g) => g.count), [1, 2, 0, 1]);
  assert.deepEqual(groups.map((g) => g.totalOutstanding), [100, 500, 0, 400]);
  assert.deepEqual(groups[1].items.map((i) => i.customer.id), ['c', 'b']);
  // Within a band, most-overdue-first order is preserved (promiseDate asc).
  assert.deepEqual(groups[1].items.map((i) => i.promiseDate), ['2026-10-22', '2026-10-23']);
});

test('groupBrokenWaadaByAgeBand: boundary days 3/4, 7/8, 14/15 split correctly', () => {
  const groups = groupBrokenWaadaByAgeBand([
    promised(3, 'd3'), promised(4, 'd4'), promised(7, 'd7'),
    promised(8, 'd8'), promised(14, 'd14'), promised(15, 'd15')
  ], TODAY);
  const bandOf = {};
  for (const g of groups) for (const item of g.items) bandOf[item.customer.id] = g.id;
  assert.deepEqual(bandOf, { d3: '1-3', d4: '4-7', d7: '4-7', d8: '8-14', d14: '8-14', d15: '15+' });
});

// --- Suspense ageing ---

const entry = (id, date, amount = 1000, extra = {}) => ({
  suspenseId: id, amount, wallet: 'Easypaisa', senderName: 'Sender', senderMobile: '03001234567',
  tid: `TID-${id}`, date, claimed: false, ...extra
});

test('suspenseAgeDays: entry date vs today, future clamps to 0, invalid is null', () => {
  assert.equal(suspenseAgeDays(entry('SUS-101', '2026-10-28'), TODAY), 0);
  assert.equal(suspenseAgeDays(entry('SUS-101', '2026-10-20'), TODAY), 8);
  assert.equal(suspenseAgeDays(entry('SUS-101', '2026-11-02'), TODAY), 0);
  assert.equal(suspenseAgeDays(entry('SUS-101', 'bad-date'), TODAY), null);
  assert.equal(suspenseAgeDays({ suspenseId: 'SUS-101' }, TODAY), null);
});

test('ageSuspenseEntries: unclaimed only, oldest first, ties by date then id', () => {
  const aged = ageSuspenseEntries([
    entry('SUS-102', '2026-10-25'),
    entry('SUS-101', '2026-10-01'),
    entry('SUS-103', '2026-10-25'),
    entry('SUS-104', '2026-10-27', 500, { claimed: true, claimedCustomerId: 'c1' }),
    entry('SUS-105', '2026-10-28')
  ], TODAY);
  assert.deepEqual(aged.map((e) => e.suspenseId), ['SUS-101', 'SUS-102', 'SUS-103', 'SUS-105']);
  assert.deepEqual(aged.map((e) => e.ageDays), [27, 3, 3, 0]);
  assert.equal(aged[0].amount, 1000);
});

test('suspenseSummary: oldest unclaimed age + id added, existing fields unchanged', () => {
  const summary = suspenseSummary([
    entry('SUS-101', '2026-10-01', 1000),
    entry('SUS-102', '2026-10-20', 2000),
    entry('SUS-103', '2026-10-10', 500, { claimed: true })
  ], TODAY);
  assert.equal(summary.totalCount, 3);
  assert.equal(summary.unclaimedCount, 2);
  assert.equal(summary.unclaimedAmount, 3000);
  assert.equal(summary.claimedCount, 1);
  assert.equal(summary.claimedAmount, 500);
  assert.equal(summary.oldestUnclaimedAgeDays, 27);
  assert.equal(summary.oldestUnclaimedId, 'SUS-101');
  const empty = suspenseSummary([], TODAY);
  assert.equal(empty.oldestUnclaimedAgeDays, null);
  assert.equal(empty.oldestUnclaimedId, null);
  // sanitize still drops malformed rows before ageing.
  assert.equal(sanitizeSuspensePayments([{ amount: -5, wallet: 'Easypaisa', date: '2026-10-01' }]).length, 0);
});

// --- Group pro-rata ---

const group = { billingGroupId: 'GRP-101', groupTitle: 'Test Family', memberIds: ['a', 'b', 'c'] };
const customers = [
  { id: 'a', name: 'A', customerNumber: 1, bills: [{ month: '2026-10', dueAmount: 1000, payments: [] }] },
  { id: 'b', name: 'B', customerNumber: 2, bills: [{ month: '2026-10', dueAmount: 1000, payments: [] }] },
  { id: 'c', name: 'C', customerNumber: 3, bills: [{ month: '2026-10', dueAmount: 2000, payments: [] }] }
];
const state = { customers };
const fakeExecute = (s, { customerId, amount }) => ({
  nextState: {
    ...s,
    customers: s.customers.map((c) => c.id === customerId
      ? { ...c, bills: c.bills.map((bill) => ({ ...bill, payments: [...(bill.payments ?? []), { amount }] })) }
      : c)
  }
});

test('allocateGroupProRata: equal dues split evenly, remainder to first member', () => {
  const lines = allocateGroupProRata([
    { customerId: 'a', dueCents: 100000 },
    { customerId: 'b', dueCents: 100000 },
    { customerId: 'c', dueCents: 100000 }
  ], 100001);
  // 100001 / 3 = 33333 remainder 2 -> floors 33333 each, leftover 2 to
  // earliest members first: a +1, b +1.
  assert.deepEqual(lines.map((l) => l.amountCents), [33334, 33334, 33333]);
  assert.equal(lines.reduce((s, l) => s + l.amountCents, 0), 100001);
});

test('allocateGroupProRata: proportional by due, nobody exceeds their due', () => {
  const lines = allocateGroupProRata([
    { customerId: 'a', dueCents: 100000 },
    { customerId: 'b', dueCents: 300000 }
  ], 100000);
  assert.deepEqual(lines.map((l) => l.amountCents), [25000, 75000]);
  assert.deepEqual(lines.map((l) => l.outcome), ['partial', 'partial']);
  const capped = allocateGroupProRata([
    { customerId: 'a', dueCents: 100 },
    { customerId: 'b', dueCents: 100 },
    { customerId: 'c', dueCents: 100 },
    { customerId: 'd', dueCents: 100000 }
  ], 50000);
  assert.ok(capped.every((l) => l.amountCents <= l.dueCents));
  assert.equal(capped.reduce((s, l) => s + l.amountCents, 0), 50000);
});

test('allocateGroupProRata: cash above total pays everyone in full, zero cash pays nobody', () => {
  const full = allocateGroupProRata([
    { customerId: 'a', dueCents: 50000 },
    { customerId: 'b', dueCents: 50000 }
  ], 150000);
  assert.deepEqual(full.map((l) => l.outcome), ['paid', 'paid']);
  assert.deepEqual(full.map((l) => l.amountCents), [50000, 50000]);
  const none = allocateGroupProRata([{ customerId: 'a', dueCents: 50000 }], 0);
  assert.deepEqual(none.map((l) => l.outcome), ['unpaid']);
  assert.deepEqual(allocateGroupProRata([], 10000), []);
  assert.deepEqual(allocateGroupProRata([{ customerId: 'a', dueCents: 0 }], 10000), []);
});

test('collectGroupProRata: each member gets their share, receipt + waada targets work', () => {
  const result = collectGroupProRata(state, group, {
    amountReceived: 2000, date: '2026-10-28', method: 'Cash', month: '2026-10', execute: fakeExecute
  });
  assert.equal(result.allocationMode, 'pro-rata');
  assert.equal(result.totalCents, 200000);
  assert.equal(result.unallocatedCents, 0);
  assert.equal(result.remainingCents, 200000);
  // Dues 1000/1000/2000, cash 2000 -> shares 500/500/1000.
  assert.deepEqual(result.outcomes.map((o) => o.amountCents), [50000, 50000, 100000]);
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['partial', 'partial', 'partial']);
  assert.equal(result.collected, true);
  const receipt = buildGroupReceipt({ ...result, date: '2026-10-28', method: 'Cash' });
  assert.match(receipt.text, /Still due: Rs\. 2,000/);
  assert.deepEqual(groupWaadaTargets(result.outcomes).map((t) => t.customerId), ['a', 'b', 'c']);
});

test('allocateGroupProRata: leftover cents go to earliest members, never past a due', () => {
  const lines = allocateGroupProRata([
    { customerId: 'a', dueCents: 100 },
    { customerId: 'b', dueCents: 100 },
    { customerId: 'c', dueCents: 100 },
    { customerId: 'd', dueCents: 100000 }
  ], 50000);
  assert.deepEqual(lines.map((l) => l.amountCents), [50, 50, 50, 49850]);
  // First member capped at a 1-cent due: the remainder must skip past
  // them to the next member instead of overpaying the first.
  const tiny = allocateGroupProRata([
    { customerId: 'a', dueCents: 1 },
    { customerId: 'b', dueCents: 1 },
    { customerId: 'c', dueCents: 1 },
    { customerId: 'd', dueCents: 1 },
    { customerId: 'e', dueCents: 100000 }
  ], 50000);
  assert.ok(tiny.every((l) => l.amountCents <= l.dueCents));
  assert.equal(tiny.reduce((s, l) => s + l.amountCents, 0), 50000);
  assert.deepEqual(tiny.map((l) => l.amountCents), [1, 1, 0, 0, 49998]);
});

test('allocateGroupProRata: a single payable member takes cash up to their due', () => {
  const lines = allocateGroupProRata([{ customerId: 'a', dueCents: 75000 }], 100000);
  assert.deepEqual(lines.map((l) => l.amountCents), [75000]);
  assert.deepEqual(lines.map((l) => l.outcome), ['paid']);
});

test('date math: overdue and suspense ages cross month and leap-day boundaries', () => {
  assert.equal(waadaOverdueDays('2026-10-31', '2026-11-02'), 2);
  assert.equal(waadaAgeBand('2026-10-31', '2026-11-02'), '1-3');
  assert.equal(suspenseAgeDays(entry('SUS-101', '2024-02-28'), '2024-03-01'), 2);
  assert.equal(suspenseAgeDays(entry('SUS-101', '2024-02-29'), '2024-03-01'), 1);
});

test('collectGroupProRata: cash above total leaves excess unallocated, members paid in full', () => {
  const result = collectGroupProRata(state, group, {
    amountReceived: 5000, date: '2026-10-28', method: 'Cash', month: '2026-10', execute: fakeExecute
  });
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['paid', 'paid', 'paid']);
  assert.equal(result.totalCents, 400000);
  assert.equal(result.unallocatedCents, 100000);
  assert.equal(result.remainingCents, 0);
  assert.deepEqual(groupWaadaTargets(result.outcomes), []);
});

test('collectGroupProRata: archived / paid / no-bill members consume no cash', () => {
  const mixed = {
    customers: [
      { id: 'a', name: 'A', customerNumber: 1, archived: true, bills: [{ month: '2026-10', dueAmount: 1000, payments: [] }] },
      { id: 'b', name: 'B', customerNumber: 2, bills: [{ month: '2026-10', dueAmount: 1000, payments: [{ amount: 1000 }] }] },
      { id: 'c', name: 'C', customerNumber: 3 },
      { id: 'd', name: 'D', customerNumber: 4, bills: [{ month: '2026-10', dueAmount: 2000, payments: [] }] }
    ]
  };
  const mixedGroup = { billingGroupId: 'GRP-102', groupTitle: 'Mixed', memberIds: ['a', 'b', 'c', 'd'] };
  const result = collectGroupProRata(mixed, mixedGroup, {
    amountReceived: 1000, date: '2026-10-28', method: 'Cash', month: '2026-10', execute: fakeExecute
  });
  // Only D is payable (due 2000); cash 1000 covers half of D, so partial.
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['skipped-archived', 'skipped-paid', 'skipped-no-bill', 'partial']);
  assert.equal(result.totalCents, 100000);
});

test('collectGroupProRata: executor failure is all-or-nothing and names the member', () => {
  const failing = (s, { customerId, amount }) => {
    if (customerId === 'b') throw new Error('simulated failure');
    return fakeExecute(s, { customerId, amount });
  };
  assert.throws(() => collectGroupProRata(state, group, {
    amountReceived: 2000, date: '2026-10-28', method: 'Cash', month: '2026-10', execute: failing
  }), /B: simulated failure — nothing was saved/);
});

test('collectGroupProRata: validation mirrors partial (group, month, executor, positive cash)', () => {
  const opts = { date: '2026-10-28', method: 'Cash', month: '2026-10', execute: fakeExecute };
  assert.throws(() => collectGroupProRata(state, group, { ...opts, amountReceived: 0 }), /more than Rs\. 0/);
  assert.throws(() => collectGroupProRata(state, null, { ...opts, amountReceived: 100 }), /Group is required/);
  assert.throws(() => collectGroupProRata(state, group, { ...opts, month: '', amountReceived: 100 }), /Billing month is required/);
  assert.throws(() => collectGroupProRata(state, group, { ...opts, execute: null, amountReceived: 100 }), /payment executor is required/);
});

test('pro-rata vs waterfall: same cash, different split, same receipt shape', () => {
  const waterfall = collectGroupPartial(state, group, {
    amountReceived: 2000, date: '2026-10-28', method: 'Cash', month: '2026-10', execute: fakeExecute
  });
  const prorata = collectGroupProRata(state, group, {
    amountReceived: 2000, date: '2026-10-28', method: 'Cash', month: '2026-10', execute: fakeExecute
  });
  assert.deepEqual(waterfall.outcomes.map((o) => o.amountCents), [100000, 100000, 0]);
  assert.deepEqual(prorata.outcomes.map((o) => o.amountCents), [50000, 50000, 100000]);
  assert.equal(waterfall.totalCents, prorata.totalCents);
  assert.equal(waterfall.remainingCents, prorata.remainingCents);
  // Both receipts show per-member paid + remaining lines.
  for (const result of [waterfall, prorata]) {
    const receipt = buildGroupReceipt({ ...result, date: '2026-10-28', method: 'Cash' });
    assert.match(receipt.text, /remaining/);
  }
});
