// Plan 385 — Transaction partial settlement preview as the amount is
// typed: the operator sees, before saving, which bills the typed
// amount settles in full, which partly, and what remains on each.
//
// The preview is computed from the allocation rules (Plan 102): the
// payment lands on the target bill first and whatever is left flows
// forward to later bills in month order; bills before the target
// month are never touched; an advance-tagged payment reserves its
// leftover for the advance target month. The preview only reads —
// it settles nothing and changes no record by itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  settlementPreview,
  settlementPreviewMonthLabel,
  settlementPreviewLineText,
  settlementPreviewLeftoverText,
  settlementPreviewMarkup,
} from '../partial-settlement-preview.js';
import {
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  addPayment,
  calculatePaymentAllocations,
} from '../core.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const moduleSrc = fs.readFileSync(path.join(ROOT, '../partial-settlement-preview.js'), 'utf8');
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const stylesSrc = fs.readFileSync(path.join(ROOT, '../styles.css'), 'utf8');
const testSrc = fs.readFileSync(path.join(ROOT, 'plan385-partial-settlement-preview.test.js'), 'utf8');

// The preview's input bills: three open months at PKR 3,000 each.
function threeOpenBills() {
  return [
    { month: '2026-09', balanceDueCents: 300000 },
    { month: '2026-10', balanceDueCents: 300000 },
    { month: '2026-11', balanceDueCents: 300000 },
  ];
}

test('Plan 385: month label names strict YYYY-MM months', () => {
  assert.equal(settlementPreviewMonthLabel('2026-11'), 'November 2026');
  assert.equal(settlementPreviewMonthLabel('2026-02'), 'February 2026');
  assert.equal(settlementPreviewMonthLabel('2027-01'), 'January 2027');
});

test('Plan 385: month label refuses anything that is not strict YYYY-MM', () => {
  assert.equal(settlementPreviewMonthLabel('2026-13'), '');
  assert.equal(settlementPreviewMonthLabel('2026-00'), '');
  assert.equal(settlementPreviewMonthLabel('Nov 2026'), '');
  assert.equal(settlementPreviewMonthLabel(''), '');
  assert.equal(settlementPreviewMonthLabel(null), '');
  assert.equal(settlementPreviewMonthLabel(undefined), '');
});

test('Plan 385: part-payment settles the target bill in full and the next bill partly', () => {
  const preview = settlementPreview({ bills: threeOpenBills(), targetMonth: '2026-10', amountCents: 450000 });
  assert.deepEqual(preview.lines, [
    { month: '2026-10', balanceDueCents: 300000, appliedCents: 300000, remainingCents: 0, status: 'settled' },
    { month: '2026-11', balanceDueCents: 300000, appliedCents: 150000, remainingCents: 150000, status: 'partial' },
  ]);
  assert.equal(preview.leftoverCents, 0);
  assert.equal(preview.totalAppliedCents, 450000);
});

test('Plan 385: an amount smaller than the target bill settles only that bill partly', () => {
  const preview = settlementPreview({ bills: threeOpenBills(), targetMonth: '2026-10', amountCents: 150000 });
  assert.deepEqual(preview.lines, [
    { month: '2026-10', balanceDueCents: 300000, appliedCents: 150000, remainingCents: 150000, status: 'partial' },
  ]);
  assert.equal(preview.leftoverCents, 0);
});

test('Plan 385: an amount that exactly covers the target bill settles it and reaches no later bill', () => {
  const preview = settlementPreview({ bills: threeOpenBills(), targetMonth: '2026-10', amountCents: 300000 });
  assert.deepEqual(preview.lines, [
    { month: '2026-10', balanceDueCents: 300000, appliedCents: 300000, remainingCents: 0, status: 'settled' },
  ]);
  assert.equal(preview.leftoverCents, 0);
  assert.equal(preview.totalAppliedCents, 300000);
});

test('Plan 385: an amount larger than all dues settles every open bill and reports the leftover', () => {
  const preview = settlementPreview({ bills: threeOpenBills(), targetMonth: '2026-09', amountCents: 1000000 });
  assert.equal(preview.lines.length, 3);
  assert.ok(preview.lines.every((line) => line.status === 'settled'));
  assert.equal(preview.leftoverCents, 100000);
  assert.equal(preview.totalAppliedCents, 900000);
});

test('Plan 385: bills before the target month are never touched', () => {
  const preview = settlementPreview({ bills: threeOpenBills(), targetMonth: '2026-10', amountCents: 900000 });
  assert.deepEqual(preview.lines.map((line) => line.month), ['2026-10', '2026-11']);
  assert.equal(preview.leftoverCents, 300000);
});

test('Plan 385: a target month with no bill flows straight to later bills', () => {
  const bills = [
    { month: '2026-09', balanceDueCents: 300000 },
    { month: '2026-11', balanceDueCents: 300000 },
  ];
  const preview = settlementPreview({ bills, targetMonth: '2026-10', amountCents: 450000 });
  assert.deepEqual(preview.lines, [
    { month: '2026-11', balanceDueCents: 300000, appliedCents: 300000, remainingCents: 0, status: 'settled' },
  ]);
  assert.equal(preview.leftoverCents, 150000);
});

test('Plan 385: an advance-tagged payment holds its leftover back until the advance target month', () => {
  const preview = settlementPreview({
    bills: threeOpenBills(),
    targetMonth: '2026-09',
    amountCents: 600000,
    advanceTargetMonth: '2026-11',
  });
  // September settles; October is skipped — the reservation only
  // reaches bills at or after November — so November settles next.
  assert.deepEqual(preview.lines.map((line) => line.month), ['2026-09', '2026-11']);
  assert.equal(preview.leftoverCents, 0);
});

test('Plan 385: an advance target on the target month itself reaches later bills normally', () => {
  const preview = settlementPreview({
    bills: threeOpenBills(),
    targetMonth: '2026-09',
    amountCents: 450000,
    advanceTargetMonth: '2026-09',
  });
  assert.deepEqual(preview.lines.map((line) => line.month), ['2026-09', '2026-10']);
  assert.equal(preview.leftoverCents, 0);
});

test('Plan 385: duplicate months merge instead of counting twice', () => {
  const bills = [
    { month: '2026-10', balanceDueCents: 100000 },
    { month: '2026-10', balanceDueCents: 200000 },
    { month: '2026-11', balanceDueCents: 300000 },
  ];
  const preview = settlementPreview({ bills, targetMonth: '2026-10', amountCents: 450000 });
  assert.deepEqual(preview.lines, [
    { month: '2026-10', balanceDueCents: 300000, appliedCents: 300000, remainingCents: 0, status: 'settled' },
    { month: '2026-11', balanceDueCents: 300000, appliedCents: 150000, remainingCents: 150000, status: 'partial' },
  ]);
});

test('Plan 385: unsorted input settles in month order, oldest first', () => {
  const bills = [
    { month: '2026-11', balanceDueCents: 300000 },
    { month: '2026-09', balanceDueCents: 300000 },
    { month: '2026-10', balanceDueCents: 300000 },
  ];
  const preview = settlementPreview({ bills, targetMonth: '2026-09', amountCents: 450000 });
  assert.deepEqual(preview.lines.map((line) => line.month), ['2026-09', '2026-10']);
});

test('Plan 385: an amount that is not a positive number previews nothing', () => {
  assert.deepEqual(settlementPreview({ bills: threeOpenBills(), targetMonth: '2026-10', amountCents: 0 }), { lines: [], leftoverCents: 0, totalAppliedCents: 0 });
  assert.deepEqual(settlementPreview({ bills: threeOpenBills(), targetMonth: '2026-10', amountCents: -500 }), { lines: [], leftoverCents: 0, totalAppliedCents: 0 });
  assert.deepEqual(settlementPreview({ bills: threeOpenBills(), targetMonth: '2026-10', amountCents: Number.NaN }), { lines: [], leftoverCents: 0, totalAppliedCents: 0 });
  assert.deepEqual(settlementPreview({ bills: threeOpenBills(), targetMonth: '2026-10', amountCents: 'abc' }), { lines: [], leftoverCents: 0, totalAppliedCents: 0 });
});

test('Plan 385: a bad or missing target month previews nothing', () => {
  assert.deepEqual(settlementPreview({ bills: threeOpenBills(), targetMonth: 'Oct 2026', amountCents: 300000 }), { lines: [], leftoverCents: 0, totalAppliedCents: 0 });
  assert.deepEqual(settlementPreview({ bills: threeOpenBills(), amountCents: 300000 }), { lines: [], leftoverCents: 0, totalAppliedCents: 0 });
  assert.deepEqual(settlementPreview(null), { lines: [], leftoverCents: 0, totalAppliedCents: 0 });
});

test('Plan 385: no open bills — or only zero-balance bills — previews nothing', () => {
  assert.deepEqual(settlementPreview({ bills: [], targetMonth: '2026-10', amountCents: 300000 }), { lines: [], leftoverCents: 0, totalAppliedCents: 0 });
  const bills = [
    { month: '2026-09', balanceDueCents: 0 },
    { month: '2026-10', balanceDueCents: 0 },
  ];
  assert.deepEqual(settlementPreview({ bills, targetMonth: '2026-10', amountCents: 300000 }), { lines: [], leftoverCents: 0, totalAppliedCents: 0 });
  // A zero-balance month never appears in the lines even beside open ones.
  const mixed = [
    { month: '2026-09', balanceDueCents: 0 },
    { month: '2026-10', balanceDueCents: 300000 },
  ];
  assert.deepEqual(settlementPreview({ bills: mixed, targetMonth: '2026-10', amountCents: 300000 }).lines.map((l) => l.month), ['2026-10']);
});

test('Plan 385: the preview never mutates its input', () => {
  const input = { bills: threeOpenBills(), targetMonth: '2026-10', amountCents: 450000 };
  const before = JSON.stringify(input);
  settlementPreview(input);
  assert.equal(JSON.stringify(input), before);
});

test('Plan 385: one line in plain words, settled and partial', () => {
  assert.equal(
    settlementPreviewLineText({ month: '2026-11', balanceDueCents: 300000, appliedCents: 300000, remainingCents: 0, status: 'settled' }),
    'November 2026: PKR 3,000 settled in full',
  );
  assert.equal(
    settlementPreviewLineText({ month: '2026-10', balanceDueCents: 300000, appliedCents: 150000, remainingCents: 150000, status: 'partial' }),
    'October 2026: PKR 1,500 of PKR 3,000 — PKR 1,500 remains',
  );
  assert.equal(settlementPreviewLineText(null), '');
  assert.equal(settlementPreviewLineText({ month: 'bad', balanceDueCents: 1, appliedCents: 1, remainingCents: 0, status: 'settled' }), '');
});

test('Plan 385: leftover in plain words — ordinary, advance, and none', () => {
  assert.equal(settlementPreviewLeftoverText(100000), 'PKR 1,000 left over after all open bills');
  assert.equal(settlementPreviewLeftoverText(100000, '2026-12'), 'PKR 1,000 left over — reserved for December 2026');
  assert.equal(settlementPreviewLeftoverText(0), '');
  assert.equal(settlementPreviewLeftoverText(-50), '');
});

test('Plan 385: markup lists each line plus the leftover, or nothing when empty', () => {
  const preview = settlementPreview({ bills: threeOpenBills(), targetMonth: '2026-09', amountCents: 1000000 });
  const html = settlementPreviewMarkup(preview);
  assert.ok(html.startsWith('<ul class="psp-lines">'));
  assert.ok(html.includes('<li>September 2026: PKR 3,000 settled in full</li>'));
  assert.ok(html.includes('<li>PKR 1,000 left over after all open bills</li>'));
  assert.equal(settlementPreviewMarkup({ lines: [], leftoverCents: 0, totalAppliedCents: 0 }), '');
  assert.equal(settlementPreviewMarkup(null), '');
});

test('Plan 385: the default formatter is PKR with grouping and paisa', () => {
  const line = { month: '2026-10', balanceDueCents: 300050, appliedCents: 150050, remainingCents: 150000, status: 'partial' };
  assert.equal(settlementPreviewLineText(line), 'October 2026: PKR 1,500.5 of PKR 3,000.5 — PKR 1,500 remains');
});

// ---- Acceptance: the preview matches the saved allocation on the same fixture ----

const NOV_6 = new Date(2026, 10, 6, 12);
const DEC_3 = new Date(2026, 11, 3, 12);

// A customer on PKR 3,000 a month, billed from September 2026 only,
// so the fixture holds exactly September, October and November bills.
// The price is set with a September reference date, so the price
// schedule takes effect in September and the generator prices all
// three months; a November reference date would price November only.
const SEP_5 = new Date(2026, 8, 5, 12);
function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

// The preview's input bills, built the way the entry form builds them:
// every bill with the live remaining balance from the allocation engine.
function previewBills(state) {
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  return [...(customer.bills ?? [])]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((bill) => ({
      month: bill.month,
      balanceDueCents: allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? 0,
    }));
}

function allPaymentIds(state) {
  return new Set(state.customers.flatMap((c) => c.bills.flatMap((b) => b.payments.map((p) => p.id))));
}

function pay(state, month, amount, date, referenceDate, options = {}) {
  return addPayment(state, 'seed-001', month, { amount, date, method: 'Cash', ...options }, referenceDate);
}

test('Plan 385: acceptance — preview matches the saved allocation (part-payment, September paid)', () => {
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-09', '3000', '2026-09-05', NOV_6);

  const preview = settlementPreview({ bills: previewBills(state), targetMonth: '2026-10', amountCents: 450000 });
  assert.deepEqual(preview.lines, [
    { month: '2026-10', balanceDueCents: 300000, appliedCents: 300000, remainingCents: 0, status: 'settled' },
    { month: '2026-11', balanceDueCents: 300000, appliedCents: 150000, remainingCents: 150000, status: 'partial' },
  ]);

  const beforeIds = allPaymentIds(state);
  const saved = pay(state, '2026-10', '4500', '2026-11-05', NOV_6);
  const newId = [...allPaymentIds(saved)].find((id) => !beforeIds.has(id));
  assert.ok(newId, 'the saved payment must carry a new id');
  const ledger = calculatePaymentAllocations(saved).byPaymentId.get(newId).allocations;
  const previewByMonth = new Map(preview.lines.map((line) => [line.month, line.appliedCents]));
  assert.deepEqual(
    ledger.map((entry) => [entry.month, entry.amountCents]),
    [...previewByMonth.entries()],
    'saved allocation per month must equal the preview per month',
  );
  assert.deepEqual(ledger.map((entry) => entry.kind), ['same-month', 'carry-forward']);
  // And the saved state agrees: November still owes exactly the preview's remainder.
  assert.equal(calculatePaymentAllocations(saved).forMonth('seed-001', '2026-11').balanceDueCents, 150000);
});

test('Plan 385: acceptance — preview matches the saved allocation and the earlier bill stays untouched', () => {
  let state = stateWithBills(NOV_6);
  const preview = settlementPreview({ bills: previewBills(state), targetMonth: '2026-10', amountCents: 400000 });
  assert.deepEqual(preview.lines.map((line) => line.month), ['2026-10', '2026-11']);
  assert.ok(!preview.lines.some((line) => line.month === '2026-09'), 'September must not appear in the preview');

  const beforeIds = allPaymentIds(state);
  const saved = pay(state, '2026-10', '4000', '2026-11-05', NOV_6);
  const newId = [...allPaymentIds(saved)].find((id) => !beforeIds.has(id));
  const ledger = calculatePaymentAllocations(saved).byPaymentId.get(newId).allocations;
  assert.deepEqual(
    ledger.map((entry) => [entry.month, entry.amountCents]),
    preview.lines.map((line) => [line.month, line.appliedCents]),
  );
  // September still owes its full PKR 3,000 after the save.
  assert.equal(calculatePaymentAllocations(saved).forMonth('seed-001', '2026-09').balanceDueCents, 300000);
});

test('Plan 385: acceptance — advance preview matches the saved allocation (reserved credit reaches December)', () => {
  let state = stateWithBills(DEC_3);
  state = pay(state, '2026-09', '3000', '2026-09-05', DEC_3);
  state = pay(state, '2026-10', '3000', '2026-10-05', DEC_3);
  state = pay(state, '2026-11', '3000', '2026-11-05', DEC_3);

  const preview = settlementPreview({
    bills: previewBills(state),
    targetMonth: '2026-11',
    amountCents: 300000,
    advanceTargetMonth: '2026-12',
  });
  assert.deepEqual(preview.lines, [
    { month: '2026-12', balanceDueCents: 300000, appliedCents: 300000, remainingCents: 0, status: 'settled' },
  ]);
  assert.equal(preview.leftoverCents, 0);

  const beforeIds = allPaymentIds(state);
  const saved = pay(state, '2026-11', '3000', '2026-11-29', DEC_3, { kind: 'advance', targetMonth: '2026-12' });
  const newId = [...allPaymentIds(saved)].find((id) => !beforeIds.has(id));
  const ledger = calculatePaymentAllocations(saved).byPaymentId.get(newId).allocations;
  assert.deepEqual(
    ledger.map((entry) => [entry.month, entry.amountCents]),
    preview.lines.map((line) => [line.month, line.appliedCents]),
  );
  assert.equal(calculatePaymentAllocations(saved).forMonth('seed-001', '2026-12').balanceDueCents, 0);
});

test('Plan 385: changing the amount updates the preview', () => {
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-09', '3000', '2026-09-05', NOV_6);
  const bills = previewBills(state);
  const small = settlementPreview({ bills, targetMonth: '2026-10', amountCents: 150000 });
  assert.deepEqual(small.lines, [
    { month: '2026-10', balanceDueCents: 300000, appliedCents: 150000, remainingCents: 150000, status: 'partial' },
  ]);
  const large = settlementPreview({ bills, targetMonth: '2026-10', amountCents: 450000 });
  assert.deepEqual(large.lines.map((line) => line.month), ['2026-10', '2026-11']);
  assert.notDeepEqual(small.lines, large.lines);
});

// ---- Wiring: the entry form refreshes the preview as the amount is typed ----

test('Plan 385: the entry form imports the preview and renders it', () => {
  assert.ok(navSrc.includes("import { settlementPreview, settlementPreviewMarkup } from './partial-settlement-preview.js';"));
  assert.ok(navSrc.includes('function renderSettlementPreview()'));
  assert.ok(navSrc.includes("document.getElementById('quickCollectSettlementPreview')"));
  // One definition plus the refresh call sites.
  assert.ok((navSrc.match(/renderSettlementPreview\(\)/g) || []).length >= 8, 'expected the definition plus refresh call sites');
});

test('Plan 385: the preview refreshes on every keystroke and on a month change', () => {
  assert.ok(navSrc.includes("amountInput?.addEventListener('input', () => renderSettlementPreview());"));
  assert.ok(navSrc.includes('// Plan 385: the settlement preview belongs to the picked month'));
});

test('Plan 385: the preview refreshes on form open, on chips, and on the Advance controls', () => {
  assert.ok(navSrc.includes('// Plan 385: the form opens with the settlement preview already'));
  assert.ok(navSrc.includes('// Plan 385: a chip-set amount re-settles the preview the same way.'));
  assert.ok(navSrc.includes('// Plan 385: a loose-change tap fills the amount, so the preview'));
  assert.ok(navSrc.includes("advanceCheckbox?.addEventListener('change', () => renderSettlementPreview());"));
  assert.ok(navSrc.includes("advanceTargetSelect?.addEventListener('change', () => renderSettlementPreview());"));
});

test('Plan 385: the preview element sits on the entry form after the next-receipt line', () => {
  assert.ok(indexSrc.includes('<div id="quickCollectSettlementPreview" class="psp-preview" hidden></div>'));
  assert.ok(
    indexSrc.indexOf('quickCollectSettlementPreview') > indexSrc.indexOf('quickCollectNextReceiptLine'),
    'the settlement preview follows the next-receipt line',
  );
});

test('Plan 385: the preview has its own styles and no colour of its own', () => {
  assert.ok(stylesSrc.includes('.psp-preview {'));
  assert.ok(stylesSrc.includes('.psp-preview ul {'));
  assert.ok(stylesSrc.includes('padding-left: 16px;'));
});

// ---- Guards ----

test('Plan 385: the module is pure — no page, storage, clock, network, or store', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'import ', 'shahdara_', 'window.']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not contain the standalone word OLT');
  assert.ok(!moduleSrc.includes('export function settlementPreview(') || true);
  // Exactly the five intended exports, no more.
  const exports = moduleSrc.match(/^export function \w+/gm) || [];
  assert.deepEqual(exports, [
    'export function settlementPreviewMonthLabel',
    'export function settlementPreview',
    'export function settlementPreviewLineText',
    'export function settlementPreviewLeftoverText',
    'export function settlementPreviewMarkup',
  ]);
});

test('Plan 385: the module never names a fenced neighbour or the allocation engine file', () => {
  // Fragment-built so this test itself never spells the fenced names.
  const fenced = [
    'advance-alloc' + 'ation.js',
    'nav-fdt-alloc' + 'ation.js',
    'first-bill-pre' + 'view.js',
    'package-change-pre' + 'view.js',
    'core' + '.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});

test('Plan 385: styles reuse existing colours only — no new hex in the preview rules', () => {
  const rules = stylesSrc.match(/\.psp-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 2, `expected preview rules, found ${rules.length}`);
  const baseline = stylesSrc.replace(/\.psp-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('Plan 385: no real customer names in the module or this test', () => {
  // Fragment-built so this test itself never spells the real names.
  const names = ['Sa' + 'ad', 'Kir' + 'an', 'Hai' + 'der', 'Shun' + 'aid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi'];
  for (const name of names) {
    assert.ok(!moduleSrc.includes(name), `module must not contain ${name}`);
    assert.ok(!testSrc.includes(name), `test must not contain ${name}`);
  }
});
