// SISP-36: Offline Data Integrity Doctor & Cross-Ledger Reconciliation.
// Pure-module tests on synthetic data only.
//
// Pinned test criteria (spec): mutating a cached balance triggers a
// diagnostic warning, and Auto-Repair restores the exact ledger-derived
// balance. Plus the spec formula: pendingBalance === Sum(Bills + Kists)
// - Sum(Valid Payments) - Sum(Concessions), with voided payments (SISP-34)
// excluded, valid settlementId references, 0 <= monthsPaid <= monthsBilled
// <= totalMonths, and zero NaN values.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLedgerBalance,
  ledgerFingerprint,
  buildKhataDoctorCache,
  runKhataDoctor,
  repairKhataDoctor
} from '../qa-khata-doctor.js';
import {
  KHATA_DOCTOR_CACHE_KEY,
  sanitizeKhataDoctorCache,
  loadKhataDoctorCache,
  saveKhataDoctorCache
} from '../backup-store.js';

const NOW = new Date('2026-10-29T12:00:00+05:00');

// Synthetic customer: Oct bill = Rs. 3,000 package + Rs. 1,000 kist
// (dueAmount 4,000, priceSnapshot 3,000, kistTotal 1,000), one valid
// payment of Rs. 1,500 and a Rs. 300 outage concession (SISP-30).
// Ledger-derived pending balance: 4,000 - 1,500 - 300 = Rs. 2,200.
const healthyCustomer = () => ({
  id: 'c1',
  customerNumber: 101,
  name: 'Synthetic Customer',
  bills: [{
    id: 'b1', month: '2026-10', dueAmount: 4000, dueDate: '2026-10-05', status: 'pending',
    priceSnapshot: 3000, kistTotal: 1000,
    kistLines: [{ planId: 'p1', installmentNumber: 1, totalMonths: 4, amount: 1000, itemTitle: 'Router' }],
    concessionAmount: 300, concessionReason: 'Outage Reaayat: 72h offline',
    amountHistory: [],
    payments: [{ id: 'pay1', date: '2026-10-06', amount: 1500, method: 'Cash' }]
  }],
  installmentPlans: [{ id: 'p1', itemTitle: 'Router', totalAmount: 4000, downPayment: 0, monthlyKist: 1000, totalMonths: 4, monthsBilled: 1, monthsPaid: 0, startDate: '2026-10-01', status: 'active' }]
});
const healthyState = () => ({ customers: [healthyCustomer()] });

test('SISP-36: ledger-derived balance follows the spec formula (bills + kist - valid payments - concessions)', () => {
  const ledger = computeLedgerBalance(healthyCustomer());
  assert.equal(ledger.balanceCents, 220000);
  assert.equal(ledger.chargesCents, 400000);
  assert.equal(ledger.paymentsCents, 150000);
  assert.equal(ledger.concessionsCents, 30000);
});

test('SISP-36: voided payments are NOT valid payments and never reduce the balance', () => {
  const customer = healthyCustomer();
  customer.bills[0].payments.push({ id: 'pay2', date: '2026-10-07', amount: 2000, method: 'Cash', voided: true, voidedAt: '2026-10-08T10:00:00', voidReason: 'Duplicate entry' });
  // If the voided Rs. 2,000 counted, the balance would drop to Rs. 200.
  assert.equal(computeLedgerBalance(customer).balanceCents, 220000);
});

test('SISP-36: a healthy ledger with a verified cache reports fully healthy', () => {
  const state = healthyState();
  const cache = buildKhataDoctorCache(state, NOW);
  const report = runKhataDoctor(state, { cache });
  assert.equal(report.healthy, true);
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.warnings, 0);
  assert.equal(report.customers[0].ledgerBalanceCents, 220000);
  assert.equal(report.customers[0].cachedBalanceCents, 220000);
});

test('SISP-36: PINNED — mutating a cached balance triggers a diagnostic warning', () => {
  const state = healthyState();
  const cache = buildKhataDoctorCache(state, NOW);
  cache.balances.c1.balanceCents = 999900; // mutated cache, ledger untouched
  const report = runKhataDoctor(state, { cache });
  assert.equal(report.healthy, false);
  const warning = report.customers[0].issues.find((entry) => entry.code === 'balance-mismatch');
  assert.ok(warning, 'expected a balance-mismatch warning');
  assert.equal(warning.severity, 'warning');
  assert.equal(warning.cachedBalanceCents, 999900);
  assert.equal(warning.ledgerBalanceCents, 220000);
});

test('SISP-36: PINNED — Auto-Repair restores the exact ledger-derived balance', () => {
  const state = healthyState();
  const cache = buildKhataDoctorCache(state, NOW);
  cache.balances.c1.balanceCents = 999900;
  const { cache: rebuilt, fixes } = repairKhataDoctor(state, { cache, now: NOW });
  assert.equal(rebuilt.balances.c1.balanceCents, 220000);
  assert.equal(rebuilt.balances.c1.fingerprint, ledgerFingerprint(healthyCustomer()));
  assert.ok(fixes.some((line) => line.includes('ledger-derived')));
  const after = runKhataDoctor(state, { cache: rebuilt });
  assert.equal(after.healthy, true);
});

test('SISP-36: the diagnostic is read-only — input state and cache are never mutated', () => {
  const state = healthyState();
  state.customers[0].installmentPlans[0].monthsPaid = 9; // repairable issue present
  const cache = buildKhataDoctorCache(healthyState(), NOW);
  const stateBefore = JSON.stringify(state);
  const cacheBefore = JSON.stringify(cache);
  runKhataDoctor(state, { cache });
  assert.equal(JSON.stringify(state), stateBefore);
  assert.equal(JSON.stringify(cache), cacheBefore);
});

test('SISP-36: a legit ledger change makes the cache stale (info), never a false warning', () => {
  const cache = buildKhataDoctorCache(healthyState(), NOW);
  const moved = healthyState();
  moved.customers[0].bills[0].payments.push({ id: 'pay9', date: '2026-10-09', amount: 200, method: 'Cash' });
  const report = runKhataDoctor(moved, { cache });
  assert.equal(report.summary.warnings, 0);
  assert.equal(report.summary.errors, 0);
  assert.ok(report.customers[0].issues.some((entry) => entry.code === 'balance-stale'));
  assert.equal(report.customers[0].ledgerBalanceCents, 200000);
});

test('SISP-36: plan counters outside 0 <= paid <= billed <= total are errors and repair clamps them', () => {
  const state = healthyState();
  state.customers[0].installmentPlans[0].monthsPaid = 3;
  state.customers[0].installmentPlans[0].monthsBilled = 1;
  const report = runKhataDoctor(state, {});
  const found = report.customers[0].issues.find((entry) => entry.code === 'plan-range');
  assert.ok(found);
  assert.equal(found.severity, 'error');
  assert.equal(found.repairable, true);
  const { state: repaired, remaining } = repairKhataDoctor(state, { now: NOW });
  const plan = repaired.customers[0].installmentPlans[0];
  assert.ok(plan.monthsPaid <= plan.monthsBilled && plan.monthsBilled <= plan.totalMonths);
  assert.equal(plan.monthsPaid, 1);
  assert.ok(!remaining.some((entry) => entry.code === 'plan-range'));
});

test('SISP-36: a dangling settlementId reference is an error and is never auto-repaired away', () => {
  const state = healthyState();
  state.customers[0].bills[0].payments[0].settlementIds = ['STL-MISSING'];
  const settlements = [{ id: 'STL-OTHER', shop: 'Waseem Abbasi shop' }];
  const report = runKhataDoctor(state, { settlements });
  const found = report.customers[0].issues.find((entry) => entry.code === 'settlement-ref-missing');
  assert.ok(found);
  assert.equal(found.repairable, false);
  const { remaining } = repairKhataDoctor(state, { settlements, now: NOW });
  assert.ok(remaining.some((entry) => entry.code === 'settlement-ref-missing'));
  // A reference that DOES resolve is clean.
  state.customers[0].bills[0].payments[0].settlementIds = ['STL-OTHER'];
  assert.ok(!runKhataDoctor(state, { settlements }).customers[0].issues.some((entry) => entry.code === 'settlement-ref-missing'));
});

test('SISP-36: NaN / unreadable money values are errors and repair zeroes them deterministically', () => {
  const state = healthyState();
  state.customers[0].bills[0].payments[0].amount = 'not-a-number';
  state.customers[0].bills[0].lateFee = Number.NaN;
  const report = runKhataDoctor(state, {});
  assert.ok(report.customers[0].issues.filter((entry) => entry.code === 'nan-value').length >= 2);
  const { state: repaired } = repairKhataDoctor(state, { now: NOW });
  assert.equal(repaired.customers[0].bills[0].payments[0].amount, 0);
  assert.equal(repaired.customers[0].bills[0].lateFee, 0);
  // Original input untouched by repair (pure function).
  assert.equal(state.customers[0].bills[0].payments[0].amount, 'not-a-number');
});

test('SISP-36: a silently edited bill amount breaks provenance and is flagged, not rewritten', () => {
  const state = healthyState();
  state.customers[0].bills[0].dueAmount = 4500; // snapshot 3,000 + kist 1,000 = 4,000
  const report = runKhataDoctor(state, {});
  const found = report.customers[0].issues.find((entry) => entry.code === 'bill-amount-mismatch');
  assert.ok(found);
  assert.equal(found.expectedCents, 400000);
  assert.equal(found.actualCents, 450000);
  const { state: repaired } = repairKhataDoctor(state, { now: NOW });
  assert.equal(repaired.customers[0].bills[0].dueAmount, 4500);
});

test('SISP-36: void-log cross-check flags a voided payment with no log record', () => {
  const state = healthyState();
  state.customers[0].bills[0].payments.push({ id: 'payV', date: '2026-10-07', amount: 500, method: 'Cash', voided: true, voidReason: 'Wrong customer' });
  const missing = runKhataDoctor(state, { voidPayments: [] });
  assert.ok(missing.issues.some((entry) => entry.code === 'void-log-missing'));
  const logged = runKhataDoctor(state, { voidPayments: [{ paymentId: 'payV', customerId: 'c1', amount: 500 }] });
  assert.ok(!logged.issues.some((entry) => entry.code === 'void-log-missing'));
});

test('SISP-36: doctor cache persists through backup-store with safe defaults', () => {
  const backing = new Map();
  const storage = {
    getItem: (key) => (backing.has(key) ? backing.get(key) : null),
    setItem: (key, value) => backing.set(key, String(value))
  };
  assert.deepEqual(loadKhataDoctorCache(storage), { version: 1, updatedAt: null, balances: {} });
  const cache = buildKhataDoctorCache(healthyState(), NOW);
  assert.equal(saveKhataDoctorCache(cache, storage), true);
  assert.ok(backing.has(KHATA_DOCTOR_CACHE_KEY));
  const loaded = loadKhataDoctorCache(storage);
  assert.equal(loaded.balances.c1.balanceCents, 220000);
  assert.equal(loaded.balances.c1.fingerprint, cache.balances.c1.fingerprint);
  // Malformed entries degrade to empty instead of throwing.
  assert.deepEqual(sanitizeKhataDoctorCache({ balances: { c1: { balanceCents: 'x' } } }).balances, {});
  assert.deepEqual(sanitizeKhataDoctorCache(null), { version: 1, updatedAt: null, balances: {} });
});

test('SISP-36: wiring — doctor card, buttons and bundle entry exist', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="runKhataDoctorButton"'));
  assert.ok(html.includes('id="repairKhataDoctorButton"'));
  assert.ok(html.includes('id="khataDoctorResults"'));
  const dashboard = await readFile(new URL('../dashboard.js', import.meta.url), 'utf8');
  assert.ok(dashboard.includes('setupKhataDoctorCard'));
  assert.ok(dashboard.includes("from './qa-khata-doctor.js'") || dashboard.includes('qa-khata-doctor.js'));
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('setupKhataDoctorCard'));
  assert.ok(app.includes('loadKhataDoctorCache'));
  const { ENTRY_FILES } = await import('../build.mjs');
  assert.ok(ENTRY_FILES.includes('qa-khata-doctor.js'));
});
