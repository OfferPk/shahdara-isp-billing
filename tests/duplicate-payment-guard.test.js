/**
 * duplicate-payment-guard.test.js — SISP-146: 5-Minute Double-Tap
 * Duplicate Payment Guard.
 *
 * The field failure this prevents: a collector taps "collect" twice
 * (or re-opens the sheet and records again) and the same cash lands on
 * the ledger twice within moments — same customer, same amount, same
 * method. The guard detects that shape BEFORE recording and asks the
 * operator through the shared themed confirm; it never silently blocks.
 *
 * Pins:
 *  - the pure detector: same customer + same amount (exact cents) +
 *    same method + a `recordedAt` stamp strictly inside [0, 5min)
 *    matches; exactly 5:00 ago is OUT (the stated boundary rule);
 *    different amount / method / customer never match; the most recent
 *    matching payment wins; a match on ANOTHER bill month still counts
 *    (the spec key has no month) and reports that month;
 *  - a VOIDED twin never triggers (SISP-34: re-recording after a void
 *    is the legitimate correction path);
 *  - an UNSTAMPED payment never triggers — and the billing DATE is
 *    never used as a stand-in: a payment recorded 3 days ago but dated
 *    today does not match, while one recorded 2 minutes ago but dated
 *    last week does;
 *  - a future stamp (device clock moved backwards) never matches;
 *  - core.addPayment stamps every payment it records with the logged
 *    instant (the call's reference date); correctPayment carries the
 *    stamp over verbatim and never fabricates one for a legacy row;
 *    the stamp survives storage and travels in the JSON backup;
 *  - the seam-level prompt flow (Quick Collect's recorder): after a
 *    collection, the detector flags an immediate repeat; the CANCEL
 *    path records nothing (state byte-for-byte unchanged) and the
 *    CONFIRM path records the second payment normally;
 *  - askDuplicatePayment resolves false when no confirmer exists (a
 *    surface that cannot ask does not record);
 *  - the confirm options are built from the dupguard_* i18n keys in
 *    BOTH languages with matching placeholders and no raw keys;
 *  - static wiring: Quick Collect, Field Mode (collect + advance),
 *    the profile payment form, the Advance dialog + prepay save and
 *    the Suspense claim all consult the one shared detector.
 *
 * Deliberate exclusions (stated in the phase report): group collect
 * (one tap, many members at different amounts — no single honest
 * prompt) and the payments inbox (already hard-blocks a duplicate
 * TID). Split-tender legs (SISP-121, a sibling branch) cannot
 * self-trigger by construction: its two legs always carry distinct
 * methods, and this match key requires the same method.
 *
 * Synthetic data only — no real customer names.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  addPayment, correctPayment, createJsonBackup, previewJsonBackupMerge,
  persistState, readState, formatPKR
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { TRANSLATIONS, t } from '../nav-language.js';
import {
  DUPLICATE_PAYMENT_WINDOW_MS,
  paymentRecordedAtMs,
  findRecentDuplicate,
  duplicatePaymentBypassKey,
  duplicatePaymentAgoText,
  buildDuplicatePaymentConfirmOptions,
  askDuplicatePayment
} from '../duplicate-payment-guard.js';

const NOW = new Date('2026-10-29T07:00:00.000Z');
const isoAgo = (ms) => new Date(NOW.getTime() - ms).toISOString();
const CANDIDATE = { customerId: 'cust-1', amount: 3000, method: 'Cash' };

/** Pure detector fixture: one customer, one bill, the given payments. */
function fixtureState(payments, { customerId = 'cust-1', month = '2026-10' } = {}) {
  return {
    customers: [{
      id: customerId,
      name: 'Dup Tester',
      bills: [{ id: 'bill-1', month, payments }]
    }]
  };
}

const stampedPayment = (overrides = {}) => ({
  id: 'pay-1',
  date: '2026-10-29',
  amount: 3000,
  method: 'Cash',
  recordedAt: isoAgo(60 * 1000),
  ...overrides
});

/* ------------------------------ detector ------------------------------ */

test('detector: a same customer + amount + method payment logged 4:59 ago matches', () => {
  const state = fixtureState([stampedPayment({ recordedAt: isoAgo(4 * 60 * 1000 + 59 * 1000) })]);
  const dup = findRecentDuplicate(state, CANDIDATE, NOW);
  assert.ok(dup, 'expected a duplicate');
  assert.equal(dup.paymentId, 'pay-1');
  assert.equal(dup.billMonth, '2026-10');
  assert.equal(dup.amount, 3000);
  assert.equal(dup.method, 'Cash');
  assert.equal(dup.date, '2026-10-29');
  assert.equal(dup.elapsedMs, 299 * 1000);
});

test('detector: boundary rule — exactly 5:00 ago is OUT, 5:01 ago is OUT, just now is IN', () => {
  assert.equal(DUPLICATE_PAYMENT_WINDOW_MS, 5 * 60 * 1000);
  const atBoundary = fixtureState([stampedPayment({ recordedAt: isoAgo(DUPLICATE_PAYMENT_WINDOW_MS) })]);
  assert.equal(findRecentDuplicate(atBoundary, CANDIDATE, NOW), null);
  const pastBoundary = fixtureState([stampedPayment({ recordedAt: isoAgo(DUPLICATE_PAYMENT_WINDOW_MS + 1000) })]);
  assert.equal(findRecentDuplicate(pastBoundary, CANDIDATE, NOW), null);
  const justNow = fixtureState([stampedPayment({ recordedAt: isoAgo(0) })]);
  assert.ok(findRecentDuplicate(justNow, CANDIDATE, NOW));
});

test('detector: different amount, method or customer never matches', () => {
  const state = fixtureState([stampedPayment()]);
  assert.equal(findRecentDuplicate(state, { ...CANDIDATE, amount: 2500 }, NOW), null);
  assert.equal(findRecentDuplicate(state, { ...CANDIDATE, amount: 3000.01 }, NOW), null);
  assert.equal(findRecentDuplicate(state, { ...CANDIDATE, method: 'Easypaisa' }, NOW), null);
  assert.equal(findRecentDuplicate(state, { ...CANDIDATE, customerId: 'cust-2' }, NOW), null);
  assert.equal(findRecentDuplicate(state, { ...CANDIDATE, amount: 0 }, NOW), null);
  assert.equal(findRecentDuplicate(state, { customerId: 'cust-1', amount: 'not-a-number', method: 'Cash' }, NOW), null);
  assert.equal(findRecentDuplicate(null, CANDIDATE, NOW), null);
  assert.equal(findRecentDuplicate(state, null, NOW), null);
});

test('detector: a voided twin never triggers (re-recording after a void is legitimate)', () => {
  const state = fixtureState([stampedPayment({ voided: true, voidedAt: isoAgo(30 * 1000), voidReason: 'entered twice' })]);
  assert.equal(findRecentDuplicate(state, CANDIDATE, NOW), null);
});

test('detector: an unstamped legacy payment never triggers', () => {
  const legacy = stampedPayment();
  delete legacy.recordedAt;
  assert.equal(findRecentDuplicate(fixtureState([legacy]), CANDIDATE, NOW), null);
  assert.equal(findRecentDuplicate(fixtureState([stampedPayment({ recordedAt: 'not-a-date' })]), CANDIDATE, NOW), null);
  assert.equal(paymentRecordedAtMs(legacy), null);
  assert.equal(paymentRecordedAtMs({ recordedAt: isoAgo(5000) }), NOW.getTime() - 5000);
});

test('detector: the billing DATE is never a stand-in for the logged time', () => {
  // Recorded 3 days ago, but the payment is DATED today — not a double-tap.
  const oldButDatedToday = fixtureState([stampedPayment({ recordedAt: isoAgo(3 * 24 * 60 * 60 * 1000), date: '2026-10-29' })]);
  assert.equal(findRecentDuplicate(oldButDatedToday, CANDIDATE, NOW), null);
  // Recorded 2 minutes ago, but backdated to last week — still a double-tap.
  const recentButBackdated = fixtureState([stampedPayment({ recordedAt: isoAgo(2 * 60 * 1000), date: '2026-10-21' })]);
  const dup = findRecentDuplicate(recentButBackdated, CANDIDATE, NOW);
  assert.ok(dup);
  assert.equal(dup.date, '2026-10-21');
});

test('detector: a future stamp (clock moved backwards) never matches', () => {
  const future = fixtureState([stampedPayment({ recordedAt: new Date(NOW.getTime() + 60 * 1000).toISOString() })]);
  assert.equal(findRecentDuplicate(future, CANDIDATE, NOW), null);
});

test('detector: the most recent match wins, across bill months, and excludePaymentId is honoured', () => {
  const state = {
    customers: [{
      id: 'cust-1',
      name: 'Dup Tester',
      bills: [
        { id: 'bill-sep', month: '2026-09', payments: [stampedPayment({ id: 'pay-old', recordedAt: isoAgo(3 * 60 * 1000) })] },
        { id: 'bill-oct', month: '2026-10', payments: [stampedPayment({ id: 'pay-new', recordedAt: isoAgo(60 * 1000) })] }
      ]
    }]
  };
  const dup = findRecentDuplicate(state, CANDIDATE, NOW);
  assert.equal(dup.paymentId, 'pay-new');
  assert.equal(dup.billMonth, '2026-10');
  const excluded = findRecentDuplicate(state, { ...CANDIDATE, excludePaymentId: 'pay-new' }, NOW);
  assert.equal(excluded.paymentId, 'pay-old');
  assert.equal(excluded.billMonth, '2026-09');
});

/* --------------------------- recordedAt stamp -------------------------- */

const REF_A = new Date(2026, 9, 29, 12, 0, 0);
const REF_B = new Date(2026, 9, 29, 12, 2, 0);

function octoberState() {
  let state = createInitialState(['Dup Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, REF_A);
  state = generateMonthlyBillsThroughCurrentMonth(state, REF_A);
  return state;
}

const paymentsOf = (state) => state.customers[0].bills.flatMap(b => b.payments ?? []);

test('stamp: addPayment stamps the logged instant; the detector flags an immediate repeat', () => {
  let state = octoberState();
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-29', amount: 3000, method: 'Cash' }, REF_A);
  const [payment] = paymentsOf(state);
  assert.equal(payment.recordedAt, REF_A.toISOString());
  const dup = findRecentDuplicate(state, { customerId: 'seed-001', amount: 3000, method: 'Cash' }, REF_B);
  assert.ok(dup);
  assert.equal(dup.paymentId, payment.id);
  assert.equal(dup.elapsedMs, 2 * 60 * 1000);
});

test('stamp: correctPayment carries recordedAt verbatim; a legacy row stays unstamped', () => {
  let state = octoberState();
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-29', amount: 3000, method: 'Cash' }, REF_A);
  const original = paymentsOf(state)[0];
  state = correctPayment(state, 'seed-001', '2026-10', original.id, { date: '2026-10-29', amount: 2800, method: 'Cash' }, REF_B);
  assert.equal(paymentsOf(state)[0].recordedAt, REF_A.toISOString());

  let legacy = octoberState();
  const bill = legacy.customers[0].bills[0];
  legacy = {
    ...legacy,
    customers: legacy.customers.map(c => ({
      ...c,
      bills: c.bills.map(b => b.month === bill.month
        ? { ...b, payments: [{ id: 'legacy-1', date: '2026-10-05', amount: 1000, method: 'Cash' }] }
        : b)
    }))
  };
  legacy = correctPayment(legacy, 'seed-001', '2026-10', 'legacy-1', { date: '2026-10-05', amount: 1200, method: 'Cash' }, REF_B);
  assert.equal('recordedAt' in paymentsOf(legacy).find(p => p.id === 'legacy-1'), false);
});

test('stamp: survives storage round-trip and travels in the JSON backup', () => {
  let state = octoberState();
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-29', amount: 3000, method: 'Cash' }, REF_A);

  const storeData = new Map();
  const store = { getItem: k => storeData.get(k) ?? null, setItem: (k, v) => storeData.set(k, v) };
  persistState(state, store);
  const loaded = readState(store);
  assert.equal(paymentsOf(loaded)[0].recordedAt, REF_A.toISOString());

  const backupText = createJsonBackup(state, REF_B);
  const parsed = JSON.parse(backupText);
  const backedUp = parsed.state.customers[0].bills.flatMap(b => b.payments ?? [])[0];
  assert.equal(backedUp.recordedAt, REF_A.toISOString());
  // The backup validator accepts the stamp (its raw-spread merge keeps
  // later payment fields on purpose) and the preview does not throw.
  const preview = previewJsonBackupMerge(createInitialState(['Other Tester']), backupText);
  assert.ok(preview && Array.isArray(preview.conflicts));
});

/* ------------------------- seam-level prompt flow ---------------------- */

test('seam flow: cancel records nothing (state unchanged); confirm records the repeat', () => {
  let state = octoberState();
  const first = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-29', method: 'Cash'
  }, REF_A);
  state = first.nextState;
  assert.equal(paymentsOf(state).length, 1);

  // Two minutes later the same collection is attempted again.
  const dup = findRecentDuplicate(state, { customerId: 'seed-001', amount: 3000, method: 'Cash' }, REF_B);
  assert.ok(dup, 'the repeat must be detected before recording');

  // CANCEL path: the surface simply does not record — state is untouched.
  const stateBefore = JSON.stringify(state);
  assert.equal(JSON.stringify(state), stateBefore);
  assert.equal(paymentsOf(state).length, 1);

  // CONFIRM path: the surface records anyway through the same recorder.
  const second = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-29', method: 'Cash'
  }, REF_B);
  assert.equal(paymentsOf(second.nextState).length, 2);
});

test('askDuplicatePayment: without a confirmer it resolves false (cannot ask -> does not bless recording)', async () => {
  const dup = findRecentDuplicate(fixtureState([stampedPayment()]), CANDIDATE, NOW);
  assert.ok(dup);
  assert.equal(await askDuplicatePayment(dup, formatPKR), false);
});

test('bypass key: stable for the same decision, different for a different duplicate', () => {
  const dupA = { paymentId: 'pay-1' };
  const dupB = { paymentId: 'pay-2' };
  const keyA = duplicatePaymentBypassKey('cust-1', 3000, 'Cash', dupA);
  assert.equal(keyA, duplicatePaymentBypassKey('cust-1', 3000, 'Cash', dupA));
  assert.notEqual(keyA, duplicatePaymentBypassKey('cust-1', 3000, 'Cash', dupB));
  assert.notEqual(keyA, duplicatePaymentBypassKey('cust-1', 2500, 'Cash', dupA));
  assert.notEqual(keyA, duplicatePaymentBypassKey('cust-1', 3000, 'Easypaisa', dupA));
  assert.equal(duplicatePaymentBypassKey('cust-1', 3000, 'Cash', null), '');
});

/* ------------------------------ i18n / UI ------------------------------ */

test('confirm options: built from dupguard_* keys in both languages, no raw keys, ago text correct', () => {
  const dup = { paymentId: 'pay-1', billMonth: '2026-10', amount: 3000, method: 'Cash', date: '2026-10-29', elapsedMs: 3 * 60 * 1000 };
  const en = buildDuplicatePaymentConfirmOptions(dup, formatPKR, 'en');
  assert.equal(en.tone, 'warning');
  assert.equal(en.title, 'Possible duplicate payment');
  assert.equal(en.confirmLabel, 'Record anyway');
  assert.equal(en.cancelLabel, 'Cancel');
  assert.match(en.subject, /PKR 3,000/);
  assert.match(en.message, /PKR 3,000/);
  assert.match(en.message, /Cash/);
  assert.match(en.message, /2026-10/);
  assert.match(en.message, /2026-10-29/);
  assert.match(en.message, /3 min ago/);
  for (const value of [en.title, en.subject, en.message, en.confirmLabel, en.cancelLabel]) {
    assert.ok(!String(value).startsWith('dupguard_'), `raw key leaked: ${value}`);
  }

  const ur = buildDuplicatePaymentConfirmOptions(dup, formatPKR, 'ur');
  assert.equal(ur.confirmLabel, 'پھر بھی درج کریں');
  assert.match(ur.message, /3 منٹ پہلے/);
  assert.ok(!String(ur.message).startsWith('dupguard_'));

  assert.equal(duplicatePaymentAgoText(30 * 1000, 'en'), 'just now');
  assert.equal(duplicatePaymentAgoText(60 * 1000, 'en'), '1 min ago');
  assert.equal(duplicatePaymentAgoText(60 * 1000, 'ur'), '1 منٹ پہلے');
});

test('i18n audit: every dupguard_* key the module calls exists in en AND ur with matching placeholders', () => {
  const source = readFileSync(new URL('../duplicate-payment-guard.js', import.meta.url), 'utf8');
  const usedKeys = [...new Set([...source.matchAll(/t\('(dupguard_[a-z_]+)'/g)].map(m => m[1]))];
  assert.ok(usedKeys.length >= 6, `expected at least 6 dupguard keys, found ${usedKeys.join(',')}`);
  const placeholders = (text) => [...String(text).matchAll(/\{([a-z]+)\}/g)].map(m => m[1]).sort();
  for (const key of usedKeys) {
    assert.ok(TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur key ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder mismatch for ${key}`);
    assert.match(TRANSLATIONS.ur[key], /[\u0600-\u06FF]/, `ur value for ${key} carries no Urdu script`);
    assert.notEqual(t(key, 'en'), key);
    assert.notEqual(t(key, 'ur'), key);
  }
});

test('wiring: every covered surface consults the one shared detector; core stamps at the choke point', () => {
  const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

  const core = read('core.js');
  assert.match(core, /recordedAt: paymentRecordedAtStamp\(referenceDate\)/);
  assert.match(core, /recordedAt: existingPayment\.recordedAt/);

  const qc = read('nav-quick-collect.js');
  assert.match(qc, /from '\.\/duplicate-payment-guard\.js'/);
  assert.match(qc, /findRecentDuplicate\(state, \{\s*customerId: activeCustomerId/);
  assert.match(qc, /askDuplicatePayment\(recentDuplicate, formatPKR\)/);
  // The guard check runs before the recorder call in the submit handler.
  assert.ok(qc.indexOf('findRecentDuplicate(state, {') < qc.indexOf('executeQuickCollection(state, {\n        customerId: activeCustomerId'));

  const fm = read('field-mode.js');
  assert.match(fm, /from '\.\/duplicate-payment-guard\.js'/);
  assert.ok((fm.match(/findRecentDuplicate\(state/g) ?? []).length >= 2, 'field mode collect + advance both check');

  const app = read('app.js');
  assert.match(app, /from '\.\/duplicate-payment-guard\.js'/);
  assert.ok((app.match(/findRecentDuplicate\(state/g) ?? []).length >= 3, 'profile form + advance dialog + prepay all check');

  const suspense = read('suspense-payments.js');
  assert.match(suspense, /from '\.\/duplicate-payment-guard\.js'/);
  assert.match(suspense, /findRecentDuplicate\(claimState/);
});
