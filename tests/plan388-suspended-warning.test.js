// Plan 388 — Transaction warning when the customer is suspended: a
// suspended customer pays at the counter and the operator takes the
// money without realising the service is suspended, so the customer
// leaves still disconnected and angry. The entry form warns, in
// plain words, that the service is suspended — the payment is
// recorded, and reconnection needs its own step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isStrictSuspendedWarningDate,
  openSuspensionFor,
  suspendedWarningLineText,
  suspendedWarningMarkup,
} from '../suspended-warning.js';
import {
  addPayment,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations,
} from '../core.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const moduleSrc = fs.readFileSync(path.join(ROOT, '../suspended-warning.js'), 'utf8');
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const stylesSrc = fs.readFileSync(path.join(ROOT, '../styles.css'), 'utf8');
const testSrc = fs.readFileSync(path.join(ROOT, 'plan388-suspended-warning.test.js'), 'utf8');

const NOV_6 = new Date(2026, 10, 6, 12);
const SEP_5 = new Date(2026, 8, 5, 12);
const PAYMENT_DATE = '2026-11-05';

// Three open bills at PKR 3,000 each: total dues PKR 9,000.
function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

function totalDuesCents(state) {
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  let dues = 0;
  for (const bill of (customer.bills ?? [])) {
    const remaining = allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? 0;
    if (remaining > 0) dues += remaining;
  }
  return dues;
}

const openRecord = (customerId = 'seed-001', date = '2026-10-05') => ({
  customerId,
  status: 'open',
  date,
  reason: 'non-payment',
  arrearsAtSuspension: 300000,
});

// ---- Module units: strict dates ----

test('Plan 388: only a real calendar date is ever shown on the warning', () => {
  assert.equal(isStrictSuspendedWarningDate('2024-02-29'), true, 'a leap day is real');
  assert.equal(isStrictSuspendedWarningDate('2023-02-29'), false, 'no leap day in 2023');
  assert.equal(isStrictSuspendedWarningDate('2026-11-31'), false, 'November has 30 days');
  assert.equal(isStrictSuspendedWarningDate('2026-13-01'), false, 'no month 13');
  assert.equal(isStrictSuspendedWarningDate('2026-10-05'), true);
  assert.equal(isStrictSuspendedWarningDate('05-10-2026'), false, 'day-first is not the shape');
  assert.equal(isStrictSuspendedWarningDate(''), false);
  assert.equal(isStrictSuspendedWarningDate(null), false);
  assert.equal(isStrictSuspendedWarningDate(20261005), false, 'a number is not a date string');
});

// ---- Module units: finding the open suspension ----

test('Plan 388: the open suspension record is found for its customer', () => {
  const records = [openRecord('seed-001'), openRecord('seed-002', '2026-09-20')];
  const found = openSuspensionFor(records, 'seed-001');
  assert.equal(found, records[0]);
  assert.equal(found.date, '2026-10-05');
});

test('Plan 388: a closed suspension never warns — the service is back', () => {
  const records = [{ customerId: 'seed-001', status: 'closed', date: '2026-10-05', reason: 'non-payment' }];
  assert.equal(openSuspensionFor(records, 'seed-001'), null);
});

test('Plan 388: a closed record listed first never hides the open one behind it', () => {
  const closed = { customerId: 'seed-001', status: 'closed', date: '2026-09-01', reason: 'non-payment' };
  const open = openRecord('seed-001', '2026-10-05');
  assert.equal(openSuspensionFor([closed, open], 'seed-001'), open);
});

test('Plan 388: another customer\'s suspension never warns this customer', () => {
  const records = [openRecord('seed-002', '2026-10-05')];
  assert.equal(openSuspensionFor(records, 'seed-001'), null);
  assert.equal(openSuspensionFor(records, 'seed-003'), null);
});

test('Plan 388: no records, a damaged list, or no customer warns about nothing', () => {
  assert.equal(openSuspensionFor([], 'seed-001'), null);
  assert.equal(openSuspensionFor(null, 'seed-001'), null);
  assert.equal(openSuspensionFor('not-a-list', 'seed-001'), null);
  assert.equal(openSuspensionFor([openRecord()], null), null);
  assert.equal(openSuspensionFor([openRecord()], ''), null);
  assert.equal(openSuspensionFor([null, 'junk', 42, { status: 'open' }, { customerId: 'seed-001' }], 'seed-001'), null);
});

test('Plan 388: the customer match is the same customer even when the id type differs', () => {
  const records = [{ customerId: 36, status: 'open', date: '2026-10-05' }];
  assert.equal(openSuspensionFor(records, '36'), records[0]);
  assert.equal(openSuspensionFor(records, 36), records[0]);
});

test('Plan 388: the first open record wins when two are open', () => {
  const first = openRecord('seed-001', '2026-09-20');
  const second = openRecord('seed-001', '2026-10-05');
  assert.equal(openSuspensionFor([first, second], 'seed-001'), first);
});

// ---- Module units: the line text ----

test('Plan 388: the line says the service is suspended, the payment is recorded, and reconnection is its own step', () => {
  const line = suspendedWarningLineText(openRecord('seed-001', 'not-a-date'));
  assert.equal(line, 'Service suspended — payment recorded, reconnection needs its own step');
});

test('Plan 388: the suspension day is shown only when it is a real calendar date', () => {
  assert.equal(
    suspendedWarningLineText(openRecord('seed-001', '2026-10-05')),
    'Service suspended since 2026-10-05 — payment recorded, reconnection needs its own step',
  );
  const line = suspendedWarningLineText(openRecord('seed-001', '2026-02-30'));
  assert.ok(!line.includes('since'), 'an impossible day is dropped, never guessed');
  assert.equal(line, 'Service suspended — payment recorded, reconnection needs its own step');
});

test('Plan 388: the line text returns nothing for a damaged or missing record', () => {
  assert.equal(suspendedWarningLineText(null), '');
  assert.equal(suspendedWarningLineText(undefined), '');
  assert.equal(suspendedWarningLineText('open'), '');
  assert.equal(suspendedWarningLineText({}), 'Service suspended — payment recorded, reconnection needs its own step');
});

test('Plan 388: the line text takes labels for another language', () => {
  const line = suspendedWarningLineText(openRecord('seed-001', '2026-10-05'), {
    suspended: 'Service band hai',
    reconnection: 'payment darj ho gayi, dobara chalu karna alag step hai',
  });
  assert.equal(line, 'Service band hai since 2026-10-05 — payment darj ho gayi, dobara chalu karna alag step hai');
});

// ---- Module units: the markup ----

test('Plan 388: the markup is the escaped line, or nothing when there is no warning', () => {
  assert.equal(
    suspendedWarningMarkup(openRecord('seed-001', '2026-10-05')),
    'Service suspended since 2026-10-05 — payment recorded, reconnection needs its own step',
  );
  assert.equal(suspendedWarningMarkup(null), '');
  assert.equal(suspendedWarningMarkup({}), 'Service suspended — payment recorded, reconnection needs its own step');
});

test('Plan 388: the markup escapes a hostile label instead of printing it as markup', () => {
  const line = suspendedWarningMarkup(openRecord('seed-001', '2026-10-05'), {
    suspended: '<script>alert(1)</script>',
  });
  assert.ok(!line.includes('<script>'), 'markup must be escaped');
  assert.ok(line.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('Plan 388: warning twice returns the same line and changes nothing', () => {
  const records = [openRecord('seed-001'), openRecord('seed-002', '2026-09-20')];
  const before = JSON.stringify(records);
  const first = suspendedWarningLineText(openSuspensionFor(records, 'seed-001'));
  const second = suspendedWarningLineText(openSuspensionFor(records, 'seed-001'));
  assert.equal(first, second);
  assert.equal(JSON.stringify(records), before, 'the records must be byte-identical after warning');
});

// ---- Acceptance ----

test('Plan 388: acceptance — the warning appears for suspended customers and for no others', () => {
  const suspended = [openRecord('seed-001')];
  const closed = [{ customerId: 'seed-001', status: 'closed', date: '2026-09-01', reason: 'non-payment' }];
  const other = [openRecord('seed-002')];
  assert.ok(suspendedWarningLineText(openSuspensionFor(suspended, 'seed-001')).includes('Service suspended'));
  assert.equal(suspendedWarningLineText(openSuspensionFor(closed, 'seed-001')), '');
  assert.equal(suspendedWarningLineText(openSuspensionFor(other, 'seed-001')), '');
  assert.equal(suspendedWarningLineText(openSuspensionFor([], 'seed-001')), '');
});

test('Plan 388: acceptance — the payment still records normally and the warning changes no record by itself', () => {
  const state = stateWithBills(NOV_6);
  assert.equal(totalDuesCents(state), 900000, 'three open bills at PKR 3,000');
  const records = [openRecord('seed-001')];
  const recordsBefore = JSON.stringify(records);
  const stateBefore = JSON.stringify(state);
  const record = openSuspensionFor(records, 'seed-001');
  const line = suspendedWarningLineText(record);
  assert.ok(line.includes('Service suspended since 2026-10-05'));
  assert.equal(JSON.stringify(records), recordsBefore, 'the warning never writes the suspension record');
  assert.equal(JSON.stringify(state), stateBefore, 'the warning never writes any bill or payment');
  const next = addPayment(state, 'seed-001', '2026-11', { amount: 3000, date: PAYMENT_DATE, method: 'Cash' }, NOV_6);
  const paid = next.customers[0].bills.find((b) => b.month === '2026-11').payments;
  assert.equal(paid.length, 1, 'the payment records normally despite the suspension');
  assert.equal(paid[0].amount, 3000);
  assert.equal(totalDuesCents(next), 600000, 'only the paid bill settles; the warning changed no other bill');
  assert.equal(JSON.stringify(records), recordsBefore, 'recording the payment never touches the suspension record');
});

// ---- Wiring ----

test('Plan 388: the entry form imports the warning and renders it', () => {
  assert.ok(navSrc.includes("import { openSuspensionFor, suspendedWarningLineText } from './suspended-warning.js';"));
  assert.ok(navSrc.includes('function renderSuspendedWarning()'));
  assert.ok(navSrc.includes("document.getElementById('quickCollectSuspendedWarning')"));
  assert.ok(navSrc.includes('suspendedWarningLine.textContent = line;'));
  assert.ok(navSrc.includes('suspendedWarningLine.hidden = line === \'\';'));
});

test('Plan 388: the warning reads the suspension records through the app\'s own loader', () => {
  const fn = navSrc.slice(
    navSrc.indexOf('function renderSuspendedWarning()'),
    navSrc.indexOf('function buildSaveConfirmationSummary()'),
  );
  assert.ok(fn.includes('typeof loadSuspensions === \'function\' ? loadSuspensions() : []'), 'the loader is guarded like the handling-note loader');
  assert.ok(fn.includes('openSuspensionFor(records, activeCustomerId)'));
  assert.ok(fn.includes('suspendedWarningLineText(record)'));
  assert.ok(fn.includes('if (activeCustomerId)'), 'no customer means no warning');
});

test('Plan 388: the warning renders once when the form opens for its customer', () => {
  const calls = navSrc.match(/renderSuspendedWarning\(\)/g) || [];
  // Definition plus the single form-open site: the warning depends on
  // the customer only, so no amount, month, Advance, split, or chip
  // site re-renders it.
  assert.equal(calls.length, 2, `expected 2 renderSuspendedWarning() sites, found ${calls.length}`);
  const openAt = navSrc.indexOf('renderSuspendedWarning();', navSrc.indexOf('function renderSuspendedWarning()'));
  const underAt = navSrc.indexOf('renderUnderpaymentWarning();', navSrc.indexOf('function renderSuspendedWarning()'));
  assert.ok(openAt > underAt, 'the warning must render at form open, after the underpayment warning');
});

test('Plan 388: the warning line sits on the entry form after the underpayment warning', () => {
  const underAt = indexSrc.indexOf('id="quickCollectUnderpaymentWarning"');
  const warningAt = indexSrc.indexOf('id="quickCollectSuspendedWarning"');
  assert.ok(underAt > 0 && warningAt > underAt, 'the warning line must follow the underpayment warning line');
  assert.ok(indexSrc.includes('<p id="quickCollectSuspendedWarning" class="spw-warning" hidden></p>'));
  const chipsAt = indexSrc.indexOf('qc-quick-amount-chips');
  assert.ok(warningAt < chipsAt, 'the warning line must sit above the quick-amount chips');
});

test('Plan 388: the warning style reuses hex colours already in the file and introduces no new hex', () => {
  const rules = stylesSrc.match(/\.spw-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 1, `expected warning rules, found ${rules.length}`);
  const baseline = stylesSrc.replace(/\.spw-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    assert.ok(hexes.length >= 1, 'the warning rule must carry its colours from the file');
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

// ---- Guards ----

test('Plan 388: the module is pure — no page, storage, clock, network, or store', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'import ', 'shahdara_', 'window.']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not contain the standalone word OLT');
  // Exactly the four intended exports, no more.
  const exports = moduleSrc.match(/^export function \w+/gm) || [];
  assert.deepEqual(exports, [
    'export function isStrictSuspendedWarningDate',
    'export function openSuspensionFor',
    'export function suspendedWarningLineText',
    'export function suspendedWarningMarkup',
  ]);
});

test('Plan 388: the module never names a fenced neighbour', () => {
  // Fragment-built so this test itself never spells the fenced name.
  const fenced = [
    'suspension-' + 'records.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});

test('Plan 388: no real customer names in the module or this test', () => {
  // Fragment-built so this test itself never spells the real names.
  const names = ['Sa' + 'ad', 'Kir' + 'an', 'Hai' + 'der', 'Shun' + 'aid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi'];
  for (const name of names) {
    assert.ok(!moduleSrc.includes(name), `module must not contain ${name}`);
    assert.ok(!testSrc.includes(name), `test must not contain ${name}`);
  }
});
