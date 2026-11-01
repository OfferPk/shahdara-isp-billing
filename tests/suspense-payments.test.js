// SISP-37: Unidentified / Suspense Online Payment Register.
// Pure-function tests on synthetic data only. Pins the spec criterion:
// logging an unclaimed Rs. 3,000 EasyPaisa entry and linking it to a
// customer clears their Rs. 3,000 due balance and marks the suspense
// record claimed: true — verified through the REAL core allocation
// engine (saveBillMonth + calculatePaymentAllocations) and the REAL
// quick-collection executor (the same payment path every other payment
// uses). Also pins: SISP-21 normalizeTid duplicate semantics on logging
// (whitespace/case-insensitive, hyphens NOT stripped), the double-count
// guard (a TID already recorded as a customer payment cannot be
// claimed), claimed records kept for audit, and the backup safe-merge
// round-trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../nav-language.js';
import {
  addPayment, saveBillMonth, calculatePaymentAllocations,
  createInitialState, createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { findPaymentsByTid, normalizeTid } from '../wallet-reconciliation.js';
import {
  SUSPENSE_PAYMENTS_KEY,
  addSuspensePayment,
  buildSuspenseFields,
  buildSuspenseReceipt,
  claimSuspensePayment,
  deleteSuspensePayment,
  findSuspenseByTid,
  formatSuspensePKR,
  loadSuspensePayments,
  nextSuspenseId,
  sanitizeSuspensePayments,
  saveSuspensePayments,
  suggestSuspenseMatches,
  suspensePendingBalanceCents,
  suspenseSummary,
  unclaimedSuspense,
  SUSPENSE_SUGGESTION_LIMIT
} from '../suspense-payments.js';

const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7); // PKT — the app derives the billing month in Asia/Karachi; plain toISOString() (UTC) is a month behind between 00:00–05:00 PKT on the 1st
const today = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10); // PKT

const customer = (id, n, extra = {}) => ({
  id, customerNumber: n, name: `Customer ${n}`, phone: `0300000000${n}`,
  area: 'Shahdara', archived: false, bills: [], ...extra
});

function stateWithDue3000() {
  let s = { customers: [customer('a', 1), customer('b', 2)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 3000, status: 'pending' });
  return s;
}

function balanceDueCents(state, customerId) {
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth(customerId, month);
  return summary ? summary.balanceDueCents : null;
}

const entry3000 = (overrides = {}) => addSuspensePayment([], {
  amount: 3000,
  wallet: 'Easypaisa',
  senderName: 'Unknown Sender',
  senderMobile: '03009998887',
  tid: 'TXN 9001',
  date: today,
  ...overrides
})[0];

test('PINNED: Rs. 3,000 unclaimed EasyPaisa entry, claimed & linked, clears the Rs. 3,000 due and marks claimed: true', () => {
  const entries = addSuspensePayment([], {
    amount: 3000, wallet: 'Easypaisa', senderName: 'Unknown Sender',
    senderMobile: '03009998887', tid: 'TXN 9001', date: today
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].suspenseId, 'SUS-101');
  assert.equal(entries[0].claimed, false);
  assert.equal(entries[0].amount, 3000);
  assert.equal(entries[0].wallet, 'Easypaisa');

  const state = stateWithDue3000();
  assert.equal(balanceDueCents(state, 'a'), 300000);

  const result = claimSuspensePayment(state, entries, 'SUS-101', {
    customerId: 'a', month, date: today, execute: executeQuickCollection
  });

  // The due is cleared through the real allocation engine.
  assert.equal(balanceDueCents(result.nextState, 'a'), 0);
  // The suspense record is marked claimed and KEPT (audit), not deleted.
  assert.equal(result.entries.length, 1);
  assert.equal(result.entry.claimed, true);
  assert.equal(result.entry.claimedCustomerId, 'a');
  assert.equal(result.entry.claimedMonth, month);
  assert.ok(result.entry.claimedAt);
  // The recorded payment is a normal ledger payment: wallet method + TID.
  const bill = result.nextState.customers.find((c) => c.id === 'a').bills.find((b) => b.month === month);
  assert.equal(bill.payments.length, 1);
  assert.equal(bill.payments[0].method, 'Easypaisa');
  assert.equal(bill.payments[0].amount, 3000);
  assert.equal(normalizeTid(bill.payments[0].transactionId), normalizeTid('TXN 9001'));
  // A receipt is issued for the claim.
  const receipt = buildSuspenseReceipt({
    entry: result.entry, customerName: 'Customer 1', customerNumber: 1,
    month, receiptNumber: result.paymentReceipt?.receiptNumber ?? ''
  });
  assert.match(receipt.text, /Rs\. 3,000/);
  assert.match(receipt.text, /SUS-101/);
  assert.match(receipt.whatsappText, /Rs\. 3,000/);
});

test('logging validation: amount, wallet and date are required; wallet must be a digital wallet', () => {
  assert.throws(() => buildSuspenseFields({ amount: 0, wallet: 'Easypaisa', date: today }), /Amount is required/);
  assert.throws(() => buildSuspenseFields({ amount: -5, wallet: 'Easypaisa', date: today }), /Amount is required/);
  assert.throws(() => buildSuspenseFields({ amount: 100, wallet: 'Cash', date: today }), /Wallet is required/);
  assert.throws(() => buildSuspenseFields({ amount: 100, wallet: '', date: today }), /Wallet is required/);
  assert.throws(() => buildSuspenseFields({ amount: 100, wallet: 'Easypaisa', date: '' }), /Date is required/);
  assert.throws(() => buildSuspenseFields({ amount: 100, wallet: 'Easypaisa', date: '2026-02-30' }), /Date is required/);
  const fields = buildSuspenseFields({ amount: '1500.50', wallet: 'easy paisa', date: today, tid: ' X1 ' });
  assert.equal(fields.amount, 1500.5);
  assert.equal(fields.wallet, 'Easypaisa');
  assert.equal(fields.tid, 'X1');
});

test('duplicate TID on logging is refused under normalizeTid semantics; a hyphen makes a different TID', () => {
  const entries = [entry3000()];
  // Same TID with different spacing/case = same TID (SISP-21 rule).
  assert.throws(
    () => addSuspensePayment(entries, { amount: 500, wallet: 'JazzCash', tid: 'txn9001', date: today }),
    /already in the suspense register/
  );
  assert.throws(
    () => addSuspensePayment(entries, { amount: 500, wallet: 'JazzCash', tid: 'TXN9001', date: today }),
    /already in the suspense register/
  );
  // Hyphens are NOT stripped: TXN-9001 is a different TID and logs fine.
  const withHyphen = addSuspensePayment(entries, { amount: 500, wallet: 'JazzCash', tid: 'TXN-9001', date: today });
  assert.equal(withHyphen.length, 2);
  // Empty TIDs never collide.
  const noTid = addSuspensePayment(withHyphen, { amount: 100, wallet: 'Raast', tid: '', date: today });
  const noTid2 = addSuspensePayment(noTid, { amount: 200, wallet: 'Raast', tid: '', date: today });
  assert.equal(noTid2.length, 4);
  assert.equal(findSuspenseByTid(noTid2, '  txn 9001 ')?.suspenseId, 'SUS-101');
  assert.equal(findSuspenseByTid(noTid2, ''), null);
});

test('double-count guard: a TID already recorded as a customer payment cannot be claimed', () => {
  let state = stateWithDue3000();
  state = addPayment(state, 'b', month, {
    date: today, amount: 3000, method: 'Easypaisa', transactionId: 'TXN9001'
  });
  const entries = [entry3000()];
  assert.throws(
    () => claimSuspensePayment(state, entries, 'SUS-101', { customerId: 'a', month, date: today, execute: executeQuickCollection }),
    /already recorded as a payment/
  );
  // Nothing changed: entry still unclaimed, customer a still owes 3,000.
  assert.equal(entries[0].claimed, false);
  assert.equal(balanceDueCents(state, 'a'), 300000);
});

test('claim refusals: already claimed, unknown customer, archived customer', () => {
  const state = stateWithDue3000();
  const entries = [entry3000()];
  const claimed = claimSuspensePayment(state, entries, 'SUS-101', {
    customerId: 'a', month, date: today, execute: executeQuickCollection
  });
  assert.throws(
    () => claimSuspensePayment(claimed.nextState, claimed.entries, 'SUS-101', { customerId: 'b', month, date: today, execute: executeQuickCollection }),
    /already claimed/
  );
  assert.throws(
    () => claimSuspensePayment(state, entries, 'SUS-101', { customerId: 'nobody', month, date: today, execute: executeQuickCollection }),
    /Customer not found/
  );
  const archivedState = { customers: [customer('z', 9, { archived: true })] };
  assert.throws(
    () => claimSuspensePayment(archivedState, entries, 'SUS-101', { customerId: 'z', month, date: today, execute: executeQuickCollection }),
    /Archived customers/
  );
  assert.throws(
    () => claimSuspensePayment(state, entries, 'SUS-999', { customerId: 'a', month, date: today, execute: executeQuickCollection }),
    /not found/
  );
});

test('findPaymentsByTid (SISP-21 helper): normalizeTid match, voided payments ignored, empty TID matches nothing', () => {
  let state = stateWithDue3000();
  state = addPayment(state, 'a', month, {
    date: today, amount: 1200, method: 'JazzCash', transactionId: 'JC 555'
  });
  const found = findPaymentsByTid(state.customers, 'jc555');
  assert.equal(found.length, 1);
  assert.equal(found[0].customerName, 'Customer 1');
  assert.equal(found[0].amount, 1200);
  assert.equal(findPaymentsByTid(state.customers, '').length, 0);
  assert.equal(findPaymentsByTid(state.customers, 'JC-555').length, 0); // hyphen = different TID
  const voided = JSON.parse(JSON.stringify(state));
  voided.customers[0].bills[0].payments[0].voided = true;
  assert.equal(findPaymentsByTid(voided.customers, 'JC555').length, 0);
});

test('delete: unclaimed entries can be removed, claimed entries are audit history', () => {
  const entries = addSuspensePayment([entry3000()], { amount: 700, wallet: 'Raast', tid: 'R1', date: today });
  assert.equal(entries[1].suspenseId, 'SUS-102');
  const afterDelete = deleteSuspensePayment(entries, 'SUS-102');
  assert.equal(afterDelete.length, 1);
  const state = stateWithDue3000();
  const claimed = claimSuspensePayment(state, entries, 'SUS-101', {
    customerId: 'a', month, date: today, execute: executeQuickCollection
  });
  assert.throws(() => deleteSuspensePayment(claimed.entries, 'SUS-101'), /kept for audit/);
});

test('sanitize: malformed rows dropped, ids filled from SUS-101, summary + unclaimed views', () => {
  const clean = sanitizeSuspensePayments([
    { amount: 3000, wallet: 'Easypaisa', date: today, tid: 'A1' },
    { amount: -1, wallet: 'Easypaisa', date: today },
    { amount: 100, wallet: 'Cash', date: today },
    { amount: 100, wallet: 'Raast', date: 'not-a-date' },
    null,
    { amount: 250, wallet: 'JazzCash', date: today, claimed: true, claimedCustomerId: 'a' }
  ]);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].suspenseId, 'SUS-101');
  assert.equal(clean[1].suspenseId, 'SUS-102');
  assert.equal(nextSuspenseId(clean), 'SUS-103');
  const summary = suspenseSummary(clean);
  assert.deepEqual(summary, { totalCount: 2, unclaimedCount: 1, unclaimedAmount: 3000, claimedCount: 1, claimedAmount: 250 });
  assert.equal(unclaimedSuspense(clean).length, 1);
  assert.equal(formatSuspensePKR(3000), 'Rs. 3,000');
  assert.equal(formatSuspensePKR(1500.5), 'Rs. 1,500.50');
});

test('storage round-trip under sisp_suspense_payments_v1', () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v))
  };
  const entries = [entry3000()];
  assert.equal(saveSuspensePayments(entries, storage), true);
  assert.ok(store.has(SUSPENSE_PAYMENTS_KEY));
  const loaded = loadSuspensePayments(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].tid, 'TXN 9001');
  assert.deepEqual(loadSuspensePayments({ getItem: () => '{broken', setItem: () => {} }), []);
});

test('backup safe-merge: suspense entries travel in settings.suspensePayments and restore only onto an empty device', () => {
  const entries = [entry3000()];
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { suspensePayments: entries });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.suspensePayments.length, 1);
  assert.equal(parsed.settings.suspensePayments[0].suspenseId, 'SUS-101');

  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.suspensePayments.length, 1);
  assert.equal(preview.suspensePayments[0].amount, 3000);

  const other = [addSuspensePayment([], { amount: 900, wallet: 'Raast', tid: 'ZZ9', date: today })[0]];
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentSuspensePayments: other, currentSuspensePaymentsStored: true });
  assert.equal(clash.suspensePayments, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Suspense payment records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentSuspensePayments: entries, currentSuspensePaymentsStored: true });
  assert.equal(identical.suspensePayments, null);
  assert.equal(identical.conflicts.filter((c) => c.field.startsWith('Suspense')).length, 0);
});

// ---------------------------------------------------------------------------
// SISP-179: auto-match suggestion engine. The balance source in these
// tests is the REAL core allocation engine, read through the module's
// own suspensePendingBalanceCents — the same composition app.js wires
// into the modal as pendingBalanceOf.
// ---------------------------------------------------------------------------

const balanceOfFromState = (state) => {
  const allocations = calculatePaymentAllocations(state);
  return (cust) => suspensePendingBalanceCents(allocations, cust);
};

function suggestionState() {
  // a: due 3,000 + phone ends 8887 (BOTH signals for entry3000)
  // b: due 3,000, other phone (amount only)
  // c: no due, phone ends 8887 (suffix only)
  // d: due 1,500, other phone (no signal)
  // z: due 3,000 + phone ends 8887, archived AFTER billing (picker never
  // offers archived; saveBillMonth itself refuses archived customers)
  let s = { customers: [
    customer('a', 1, { phone: '03009998887' }),
    customer('b', 2, { phone: '03210001122' }),
    customer('c', 3, { phone: '03458878887' }),
    customer('d', 4, { phone: '03001112233' }),
    customer('z', 9, { phone: '03009998887' })
  ] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 3000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 3000, status: 'pending' });
  s = saveBillMonth(s, 'd', { month, dueAmount: 1500, status: 'pending' });
  s = saveBillMonth(s, 'z', { month, dueAmount: 3000, status: 'pending' });
  return { ...s, customers: s.customers.map((c) => (c.id === 'z' ? { ...c, archived: true } : c)) };
}

test('SISP-179 PIN: exact amount match + 4-digit suffix match ranking (both > amount > suffix)', () => {
  const state = suggestionState();
  const suggestions = suggestSuspenseMatches(entry3000(), state.customers, balanceOfFromState(state));
  assert.deepEqual(suggestions.map((s) => s.customerId), ['a', 'b', 'c']);
  assert.deepEqual(
    suggestions.map((s) => [s.matchedAmount, s.matchedSuffix]),
    [[true, true], [true, false], [false, true]]
  );
  assert.equal(suggestions[0].customerNumber, 1);
  assert.equal(suggestions[0].name, 'Customer 1');
  assert.equal(suggestions[0].pendingBalanceCents, 300000);
  assert.equal(suggestions[1].pendingBalanceCents, 300000);
  assert.equal(suggestions[2].pendingBalanceCents, 0);
  // archived 'z' (both signals!) and no-signal 'd' are never suggested
  assert.ok(!suggestions.some((s) => s.customerId === 'z'));
  assert.ok(!suggestions.some((s) => s.customerId === 'd'));
});

test('SISP-179: pending balance is the engine total across months; partial payment moves it', () => {
  const prevMonth = (() => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();
  let s = { customers: [customer('a', 1), customer('b', 2)] };
  s = saveBillMonth(s, 'a', { month: prevMonth, dueAmount: 1200, status: 'pending' });
  s = saveBillMonth(s, 'a', { month, dueAmount: 1800, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 3000, status: 'pending' });
  s = addPayment(s, 'b', month, { date: today, amount: 1000, method: 'Cash' });
  const balanceOf = balanceOfFromState(s);
  assert.equal(balanceOf(s.customers[0]), 300000); // 1,200 arrears + 1,800 current
  assert.equal(balanceOf(s.customers[1]), 200000); // 3,000 billed - 1,000 paid
  // so the 3,000 entry amount-matches 'a' only, never the partially-paid 'b'
  const forA = suggestSuspenseMatches(entry3000({ senderMobile: '' }), s.customers, balanceOf);
  assert.deepEqual(forA.map((x) => x.customerId), ['a']);
  // degenerate allocation inputs contribute nothing instead of throwing
  assert.equal(suspensePendingBalanceCents(null, s.customers[0]), 0);
  assert.equal(suspensePendingBalanceCents({ forMonth: () => null }, s.customers[0]), 0);
  assert.equal(suspensePendingBalanceCents({ forMonth: () => ({ balanceDueCents: null }) }, s.customers[0]), 0);
});

test('SISP-179: suffix matching is digit-normalized (dashes, spaces, +92) and reads customerPhone too', () => {
  const customers = [
    customer('a', 1, { phone: '+92 300-999 8887' }),
    customer('b', 2, { phone: '', customerPhone: '0300 111-8887' }),
    customer('c', 3, { phone: '03005554444' })
  ];
  const entry = entry3000({ senderMobile: '0300 999-8887', amount: 12345 });
  const suggestions = suggestSuspenseMatches(entry, customers, null);
  assert.deepEqual(suggestions.map((s) => s.customerId), ['a', 'b']);
  assert.ok(suggestions.every((s) => s.matchedSuffix && !s.matchedAmount));
});

test('SISP-179: ties break by customerNumber ascending and the list caps at the suggestion limit', () => {
  const customers = [5, 3, 4, 6].map((n) => customer(`c${n}`, n, { phone: `0311000000${n}` }));
  const state = { customers };
  const allocations = { forMonth: () => ({ balanceDueCents: 300000 }) };
  const balanceOf = (cust) => suspensePendingBalanceCents(allocations, cust);
  // give each customer one bill so the stub allocations apply per customer
  const withBills = customers.map((c) => ({ ...c, bills: [{ month }] }));
  const entry = entry3000({ senderMobile: '' });
  const suggestions = suggestSuspenseMatches(entry, withBills, balanceOf);
  assert.equal(SUSPENSE_SUGGESTION_LIMIT, 3);
  assert.equal(suggestions.length, 3);
  assert.deepEqual(suggestions.map((s) => s.customerNumber), [3, 4, 5]);
  assert.ok(suggestions.every((s) => s.matchedAmount && !s.matchedSuffix));
  assert.equal(state.customers.length, 4); // input untouched (pure)
});

test('SISP-179: senderMobile shorter than 4 digits yields NO suffix candidates (never matches on empty)', () => {
  const state = suggestionState();
  const shortEntry = entry3000({ senderMobile: '887' });
  const suggestions = suggestSuspenseMatches(shortEntry, state.customers, balanceOfFromState(state));
  // amount signal still works; NOBODY gains a suffix match from '887'
  assert.deepEqual(suggestions.map((s) => s.customerId), ['a', 'b']);
  assert.ok(suggestions.every((s) => s.matchedAmount && !s.matchedSuffix));
  const blankEntry = entry3000({ senderMobile: '' });
  assert.deepEqual(
    suggestSuspenseMatches(blankEntry, state.customers, balanceOfFromState(state)).map((s) => s.customerId),
    ['a', 'b']
  );
});

test('SISP-179: claimed entries get no suggestions; FREE customers stay suggestible (picker parity)', () => {
  const state = suggestionState();
  const claimedEntry = { ...entry3000(), claimed: true, claimedCustomerId: 'a' };
  assert.deepEqual(suggestSuspenseMatches(claimedEntry, state.customers, balanceOfFromState(state)), []);
  // the manual picker offers every non-archived customer, FREE included —
  // a FREE customer (no dues by construction) can still suffix-match.
  const free = customer('f', 6, { isFreeConnection: true, phone: '03119998887' });
  const withFree = [...state.customers, free];
  // generous limit here: the default cap of 3 is already filled by a/b/c
  const suggestions = suggestSuspenseMatches(entry3000(), withFree, balanceOfFromState(state), 10);
  const freeSuggestion = suggestions.find((s) => s.customerId === 'f');
  assert.ok(freeSuggestion, 'FREE customer should be suffix-suggested like the picker offers them');
  assert.deepEqual([freeSuggestion.matchedAmount, freeSuggestion.matchedSuffix], [false, true]);
});

test('SISP-179: without a balance injector only the suffix signal ranks (amount never guessed)', () => {
  const state = suggestionState();
  const suggestions = suggestSuspenseMatches(entry3000(), state.customers);
  assert.deepEqual(suggestions.map((s) => s.customerId), ['a', 'c']);
  assert.ok(suggestions.every((s) => s.matchedSuffix && !s.matchedAmount && s.pendingBalanceCents === null));
});

test('SISP-179: claiming the top suggestion settles the due through the real claim path', () => {
  const state = suggestionState();
  const entries = [entry3000()];
  const [top] = suggestSuspenseMatches(entries[0], state.customers, balanceOfFromState(state));
  assert.equal(top.customerId, 'a');
  const result = claimSuspensePayment(state, entries, 'SUS-101', {
    customerId: top.customerId, month, date: today, execute: executeQuickCollection
  });
  assert.equal(result.entry.claimed, true);
  assert.equal(result.entry.claimedCustomerId, 'a');
  assert.equal(balanceDueCents(result.nextState, 'a'), 0);
});

test('SISP-179 wiring: chips and picker share ONE claim dispatch; app.js injects engine balances', () => {
  const source = readFileSync(new URL('../suspense-payments.js', import.meta.url), 'utf8');
  assert.match(source, /data-suspense-suggest="/);
  assert.match(source, /data-suspense-suggest-customer="/);
  assert.match(source, /async function runClaim\(entry, customerId\)/);
  assert.match(source, /onClaim\(entry, \{ customerId, month: getMonth\(\) \}\)/);
  // both entry points (picker button + suggestion chip) funnel into runClaim
  assert.equal((source.match(/await runClaim\(entry, customerId\)/g) || []).length, 2);
  // rendering a chip never claims: suggestions are computed in render(),
  // the claim fires only from the click handler's runClaim call.
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /pendingBalanceOf: \(customer\) =>/);
  assert.match(app, /suspensePendingBalanceCents\(suspenseSuggestionAllocations, customer\)/);
  assert.match(app, /suspenseSuggestionAllocations = calculatePaymentAllocations\(state\)/);
});

test('SISP-179 i18n audit: every t() key the suggestion UI uses exists in BOTH dictionaries', () => {
  const source = readFileSync(new URL('../suspense-payments.js', import.meta.url), 'utf8');
  const keys = [...new Set([...source.matchAll(/\bt\('([a-z0-9_]+)'\)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(keys, ['suspense_suggest_claim', 'suspense_suggest_label']);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
});
