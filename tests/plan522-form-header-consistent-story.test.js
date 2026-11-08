// Plan 522 — Form header tells one consistent story: the line under
// the amount field used to call the oldest open bill "the starting
// amount", while since Plan 429 the field starts with full dues; and
// the form header's big figure flipped between "Total Payable" and
// "Total Dues" with no label explaining the gap to the big-name
// confirm line's dues figure. This plan is labels and wording only —
// no figure, prefill, or allocation changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  transactionPrefillLineText,
  transactionPrefillLineHtml,
} from '../transaction-prefill.js';
import { calculatePaymentAllocations } from '../core.js';
import { createTicket, resolveTicket } from '../complaint-tickets.js';
import {
  bigNameConfirmLine,
  bigNameConfirmLineText,
} from '../quick-collect-big-name-confirm.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'transaction-prefill.js'), 'utf8');
const quickCollectSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');

const REF = new Date('2026-10-15T10:00:00Z');

// Generic fixtures only — clearly made-up names, never a real customer.
function bill(month, dueAmount, payments = []) {
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    id: `B-${month}`,
    month,
    dueAmount,
    status: paid >= dueAmount ? 'paid' : paid > 0 ? 'partial' : 'pending',
    payments,
  };
}

function payment(date, amount, method = 'Cash') {
  return { id: `P-${date}`, date, amount, method };
}

function customerWithBills(bills, overrides = {}) {
  return {
    id: 'CUST-1',
    customerNumber: 1,
    name: 'Customer One',
    mohalla: 'Mohalla A',
    archived: false,
    monthlySellingAmount: 2500,
    bills,
    ...overrides,
  };
}

function stateWith(customer) {
  return { version: 1, nextCustomerNumber: 2, customers: [customer] };
}

// August paid in full, September partially paid (2,500 billed, 1,000
// received), October unpaid — the Plan 376 mixed-dues shape.
function mixedDuesCustomer() {
  return customerWithBills([
    bill('2026-08', 2500, [payment('2026-08-05', 2500)]),
    bill('2026-09', 2500, [payment('2026-09-07', 1000, 'JazzCash')]),
    bill('2026-10', 3000),
  ]);
}

// The two txp_line values, EN first then UR — the key appears once
// per language table (pinned by the Plan 376 test).
function txpLineValues() {
  const matches = [...langSrc.matchAll(/txp_line: '([^']*)'/g)].map((m) => m[1]);
  assert.equal(matches.length, 2, 'txp_line must appear once per language table');
  return matches;
}

const NEW_EN_LINE =
  'Oldest open bill 2026-09: PKR 1,500 still open — the amount field starts with your full dues.';

// ---------------------------------------------------------------------------
// Prefill line wording — the oldest bill is a reference, not the amount
// ---------------------------------------------------------------------------

test('line: default text names the oldest bill and its balance, and states the field starts with full dues', () => {
  assert.equal(
    transactionPrefillLineText({ amount: 1500, month: '2026-09', billAmount: 2500 }),
    NEW_EN_LINE
  );
});

test('line: the default text never claims the oldest bill is the starting amount', () => {
  const text = transactionPrefillLineText({ amount: 1500, month: '2026-09', billAmount: 2500 });
  assert.ok(!text.includes('offered as the starting amount'), 'old claim must be gone');
  assert.ok(!text.includes('starting amount is'), 'no starting-amount claim about the bill');
  assert.ok(text.includes('full dues'), 'the field holds full dues');
});

test('line html: escaped line in the pre-fill class, with the new wording', () => {
  const html = transactionPrefillLineHtml({ amount: 1500, month: '2026-09', billAmount: 2500 });
  assert.match(html, /class="txp-prefill-line"/);
  assert.match(html, /Oldest open bill 2026-09: PKR 1,500 still open/);
  assert.match(html, /the amount field starts with your full dues/);
  assert.equal(transactionPrefillLineHtml(null), '');
});

// ---------------------------------------------------------------------------
// i18n keys — EN + UR together, fallback template matches the EN key
// ---------------------------------------------------------------------------

test('i18n: EN txp_line is the new wording; UR names the oldest bill and the full dues', () => {
  const [en, ur] = txpLineValues();
  assert.equal(en, NEW_EN_LINE.replace('2026-09', '{month}').replace('1,500', '{amount}'));
  assert.ok(!en.includes('offered as the starting amount'), 'EN drops the old claim');
  assert.ok(ur.includes('{month}') && ur.includes('{amount}'), 'UR keeps both placeholders');
  assert.ok(ur.includes('سب سے پرانا کھلا بل'), 'UR still names the oldest open bill');
  assert.ok(ur.includes('مکمل واجبات'), 'UR states the full dues');
  assert.ok(!ur.includes('شروع کی رقم کے طور پر'), 'UR drops the old starting-amount claim');
});

test('fallback: the plain default template in transaction-prefill.js matches the EN key', () => {
  const [en] = txpLineValues();
  const fallback = moduleSrc.match(/TRANSACTION_PREFILL_LINE_TEMPLATE =\n\s*'([^']*)';/);
  assert.ok(fallback, 'fallback template constant must exist');
  assert.equal(fallback[1], en, 'fallback and EN key must stay the same words');
});

// ---------------------------------------------------------------------------
// Acceptance — two open bills: the line names the oldest bill, the
// field holds full dues (wording only — figures unchanged)
// ---------------------------------------------------------------------------

test('fixture two bills: line names the oldest bill and balance; field holds full dues', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  const state = stateWith(mixedDuesCustomer());
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF);
  // Plan 429 figures, unchanged by this plan: the field starts with
  // full dues (1,500 still open on September + 3,000 on October).
  assert.equal(defaults.suggestedAmount, 4500);
  assert.equal(defaults.balanceDue, 1500);
  assert.deepEqual(defaults.prefill, { amount: 1500, month: '2026-09', billAmount: 2500 });
  const [en] = txpLineValues();
  const line = transactionPrefillLineText(defaults.prefill, en);
  assert.ok(line.includes('2026-09'), 'line names the oldest bill month');
  assert.ok(line.includes('PKR 1,500'), 'line names the oldest bill balance');
  assert.ok(!line.includes('starting amount'), 'line never claims the oldest bill is the starting amount');
  assert.ok(line.includes('full dues'), 'line states the field holds full dues');
});

// ---------------------------------------------------------------------------
// Acceptance — pending ticket charge: both header figures visible,
// each labelled for what it counts
// ---------------------------------------------------------------------------

test('fixture ticket charge: payable 3,500, dues 3,000, charge 500 — each labelled', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  const state = stateWith(customerWithBills([bill('2026-10', 3000)]));
  const created = createTicket({
    customerId: 'CUST-1',
    customerName: 'Customer One',
    faultPreset: 'Fiber Cut / Splice Loss',
    technician: 'Saad',
  }, []);
  const resolved = resolveTicket([created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500 }],
    billingType: 'billed',
    referenceDate: REF,
  });
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF, resolved);
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.ticketChargesPending, 500);
  assert.equal(defaults.payableTotal, 3500);
  assert.equal(defaults.suggestedAmount, 3500);

  // Header box label: the payable figure says it includes charges.
  assert.ok(
    quickCollectSrc.includes("hasExtras ? 'Total Payable (incl. charges)' : 'Total Dues'"),
    'header box labels the payable figure as including charges'
  );
  // The SISP-43 e2e expectation still holds: 'Total Payable' is a
  // substring of the new label.
  assert.ok(quickCollectSrc.includes('Total Payable'), "'Total Payable' still appears");
  // Header breakdown spells out the dues figure beside the charge.
  assert.ok(quickCollectSrc.includes('Bill dues: PKR'), 'header breakdown labels the bill-dues figure');
  assert.ok(quickCollectSrc.includes('Murammat / Material Charge'), 'header breakdown labels the charge line');

  // Big-name confirm line: the dues figure, labelled as dues — it
  // matches the header breakdown's bill-dues figure, not the payable.
  const line = bigNameConfirmLine(state.customers[0], defaults.totalDues + defaults.manualBaqayaPending);
  assert.equal(bigNameConfirmLineText(line), 'Customer One — Mohalla A — Dues PKR 3,000');
  // The gap between the two header figures is exactly the charge.
  assert.equal(defaults.payableTotal - (defaults.totalDues + defaults.manualBaqayaPending), 500);
});

// ---------------------------------------------------------------------------
// Acceptance — no charges: one consistent figure
// ---------------------------------------------------------------------------

test('fixture no charges: header and confirm line show the same single figure', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  const state = stateWith(customerWithBills([bill('2026-10', 3000)]));
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF, []);
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.ticketChargesPending, 0);
  assert.equal(defaults.payableTotal, 3000);
  assert.equal(defaults.suggestedAmount, 3000);
  // Without extras the header box keeps the plain 'Total Dues' label.
  assert.ok(
    quickCollectSrc.includes("'Total Payable (incl. charges)' : 'Total Dues'"),
    'no-extras branch still reads Total Dues'
  );
  const line = bigNameConfirmLine(state.customers[0], defaults.totalDues + defaults.manualBaqayaPending);
  assert.equal(bigNameConfirmLineText(line), 'Customer One — Mohalla A — Dues PKR 3,000');
});

// ---------------------------------------------------------------------------
// Guard — the old wording is gone from the shipped strings
// ---------------------------------------------------------------------------

test('guard: the old bare header label and old prefill claim appear nowhere', () => {
  assert.ok(
    !quickCollectSrc.includes("${hasExtras ? 'Total Payable' : 'Total Dues'}"),
    'the bare Total Payable label must be gone'
  );
  assert.ok(!langSrc.includes('offered as the starting amount'), 'old EN claim must be gone');
  assert.ok(!langSrc.includes('شروع کی رقم کے طور پر دیا گیا ہے'), 'old UR claim must be gone');
  assert.ok(!moduleSrc.includes('offered as the starting amount'), 'old fallback wording must be gone');
});
