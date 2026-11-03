// Plan J — Data safety: backup and restore verification.
//
// Tests are in the established style: pure helpers are tested
// directly, and app.js / index.html wiring is pinned by contract
// tests over the source text (app.js is a browser script, not a
// Node import). No test here claims a browser restore was run —
// there is no browser in this environment — each test pins the
// report the operator reads before anything is applied, and the
// wiring that puts that report on screen.
//
// What is deliberately NOT claimed: verification is a pre-check,
// not a second restore engine. The restore preview's deep
// validation (duplicate IDs, invalid snapshots, branch guard)
// still runs before any apply, so a backup verified here can
// still be refused there for a specific reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createJsonBackup } from '../core.js';
import { computeBackupChecksum } from '../backup-health.js';
import {
  BACKUP_FORMAT_TAG,
  summarizeBackup,
  verifyBackup,
  describeRestoreChanges,
  destructiveActionContract,
  DESTRUCTIVE_ACTION_CONTRACTS,
} from '../backup-verification.js';
import {
  fixtureCustomer,
  fixtureBill,
  fixturePayment,
  fixtureState,
  cloneFixture,
} from './test-fixtures.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// Two synthetic customers: A has one bill with two payments across
// two months is impossible on one bill, so A carries two bills
// (2026-09, 2026-10) and B carries one bill (2026-10).
function backupLedgerState() {
  return fixtureState([
    fixtureCustomer({
      id: 'cust-a', customerNumber: 1, name: 'Alpha',
      bills: [
        fixtureBill({ month: '2026-09', payments: [fixturePayment({ id: 'pay-a1', amount: 2000 })] }),
        fixtureBill({ month: '2026-10', payments: [fixturePayment({ id: 'pay-a2', amount: 1500 })] }),
      ],
    }),
    fixtureCustomer({
      id: 'cust-b', customerNumber: 2, name: 'Beta',
      bills: [fixtureBill({ month: '2026-10', payments: [fixturePayment({ id: 'pay-b1', amount: 3000 })] })],
    }),
  ]);
}

function stampedDoc(doc) {
  const stamped = { ...doc, checksum: computeBackupChecksum(doc) };
  return JSON.stringify(stamped);
}

// ------------------------------------------------------- summarizeBackup --

test('Plan J: summarizeBackup reports counts, months and checksum for a real backup', () => {
  const summary = summarizeBackup(createJsonBackup(backupLedgerState()));
  assert.equal(summary.ok, true);
  assert.equal(summary.checksumStatus, 'verified');
  assert.equal(summary.customers, 2);
  assert.equal(summary.bills, 3);
  assert.equal(summary.payments, 3);
  assert.equal(summary.amount, 6500);
  assert.deepEqual(summary.months, ['2026-09', '2026-10']);
  assert.equal(typeof summary.exportedAt, 'string');
  assert.deepEqual(summary.settingsSections, []);
});

test('Plan J: summarizeBackup lists non-empty settings sections by name only', () => {
  const doc = {
    format: BACKUP_FORMAT_TAG, formatVersion: 1, exportedAt: '2026-10-05',
    state: backupLedgerState(),
    settings: { shopSettlements: [{ id: 's1' }], complaints: [], digitalPayments: { ownerPhone: '0300' } },
  };
  const summary = summarizeBackup(stampedDoc(doc));
  assert.equal(summary.ok, true);
  assert.deepEqual(summary.settingsSections, ['digitalPayments', 'shopSettlements']);
});

test('Plan J: summarizeBackup rejects empty, non-JSON and wrong-format input without throwing', () => {
  for (const bad of ['', null, 42, 'not json{', JSON.stringify({ format: 'other', state: { customers: [] } })]) {
    const summary = summarizeBackup(bad);
    assert.equal(summary.ok, false);
    assert.equal(typeof summary.reason, 'string');
  }
});

test('Plan J: summarizeBackup rejects a newer format version and a malformed ledger', () => {
  const newer = stampedDoc({ format: BACKUP_FORMAT_TAG, formatVersion: 2, state: { customers: [] } });
  assert.equal(summarizeBackup(newer).ok, false);
  const noLedger = stampedDoc({ format: BACKUP_FORMAT_TAG, formatVersion: 1, state: {} });
  assert.equal(summarizeBackup(noLedger).ok, false);
  const noCustomers = stampedDoc({ format: BACKUP_FORMAT_TAG, formatVersion: 1, state: { customers: 'x' } });
  assert.equal(summarizeBackup(noCustomers).ok, false);
});

test('Plan J: summarizeBackup reports mismatch for a tampered backup and unverified for a legacy one', () => {
  const real = JSON.parse(createJsonBackup(backupLedgerState()));
  real.state.customers[0].name = 'Tampered';
  assert.equal(summarizeBackup(JSON.stringify(real)).checksumStatus, 'mismatch');
  const legacy = JSON.parse(createJsonBackup(backupLedgerState()));
  delete legacy.checksum;
  const legacySummary = summarizeBackup(JSON.stringify(legacy));
  assert.equal(legacySummary.ok, true);
  assert.equal(legacySummary.checksumStatus, 'unverified');
});

test('Plan J: summarizeBackup rejects an over-25MB backup without parsing it', () => {
  const summary = summarizeBackup('x'.repeat(25 * 1024 * 1024 + 1));
  assert.equal(summary.ok, false);
  assert.match(summary.reason, /too large/);
});

test('Plan J: summarizeBackup deduplicates months and counts a customer with no bills', () => {
  const state = fixtureState([
    fixtureCustomer({ id: 'cust-a', customerNumber: 1, name: 'Alpha', bills: [] }),
    fixtureCustomer({ id: 'cust-b', customerNumber: 2, name: 'Beta', bills: [fixtureBill({ month: '2026-10', payments: [] })] }),
  ]);
  const summary = summarizeBackup(createJsonBackup(state));
  assert.equal(summary.customers, 2);
  assert.equal(summary.bills, 1);
  assert.equal(summary.payments, 0);
  assert.deepEqual(summary.months, ['2026-10']);
});

// ---------------------------------------------------------- verifyBackup --

test('Plan J: verifyBackup against an empty device would add everything and keep nothing', () => {
  const report = verifyBackup(createJsonBackup(backupLedgerState()), fixtureState([]));
  assert.equal(report.verified, true);
  assert.equal(report.warning, null);
  assert.equal(report.wouldAdd.customers.length, 2);
  assert.deepEqual(report.wouldAdd.payments, { count: 3, amount: 6500 });
  assert.equal(report.keptLocalOnly.customers.length, 0);
  assert.deepEqual(report.keptLocalOnly.payments, { count: 0, amount: 0 });
});

test('Plan J: verifyBackup excludes a payment both sides already hold from wouldAdd', () => {
  const backup = createJsonBackup(backupLedgerState());
  const current = fixtureState([
    fixtureCustomer({
      id: 'cust-a', customerNumber: 1, name: 'Alpha',
      bills: [fixtureBill({ month: '2026-09', payments: [fixturePayment({ id: 'pay-a1', amount: 2000 })] })],
    }),
  ]);
  const report = verifyBackup(backup, current);
  assert.equal(report.verified, true);
  assert.equal(report.wouldAdd.customers.length, 1);
  assert.equal(report.wouldAdd.customers[0].id, 'cust-b');
  assert.deepEqual(report.wouldAdd.payments, { count: 2, amount: 4500 });
  assert.deepEqual(report.keptLocalOnly.payments, { count: 0, amount: 0 });
});

test('Plan J: verifyBackup keeps local-only records in keptLocalOnly, never in wouldAdd', () => {
  const backupState = fixtureState([
    fixtureCustomer({ id: 'cust-a', customerNumber: 1, name: 'Alpha', bills: [fixtureBill({ month: '2026-10', payments: [fixturePayment({ id: 'pay-a1', amount: 2000 })] })] }),
  ]);
  const current = fixtureState([
    fixtureCustomer({ id: 'cust-a', customerNumber: 1, name: 'Alpha', bills: [fixtureBill({ month: '2026-10', payments: [fixturePayment({ id: 'pay-a1', amount: 2000 }), fixturePayment({ id: 'pay-local', amount: 700 })] })] }),
    fixtureCustomer({ id: 'cust-c', customerNumber: 3, name: 'Gamma', bills: [] }),
  ]);
  const report = verifyBackup(createJsonBackup(backupState), current);
  assert.equal(report.wouldAdd.payments.count, 0);
  assert.deepEqual(report.keptLocalOnly.payments, { count: 1, amount: 700 });
  assert.equal(report.keptLocalOnly.customers.length, 1);
  assert.equal(report.keptLocalOnly.customers[0].id, 'cust-c');
});

test('Plan J: verifyBackup refuses a checksum mismatch with no wouldAdd and no kept counts', () => {
  const real = JSON.parse(createJsonBackup(backupLedgerState()));
  real.state.customers[0].bills[0].payments[0].amount = 99999;
  const report = verifyBackup(JSON.stringify(real), fixtureState([]));
  assert.equal(report.verified, false);
  assert.match(report.reason, /Checksum mismatch/);
  assert.equal(report.wouldAdd, null);
  assert.equal(report.keptLocalOnly, null);
});

test('Plan J: verifyBackup refuses invalid input and warns, not refuses, a legacy backup', () => {
  const invalid = verifyBackup('not json{', fixtureState([]));
  assert.equal(invalid.verified, false);
  assert.equal(invalid.wouldAdd, null);
  const legacyDoc = JSON.parse(createJsonBackup(backupLedgerState()));
  delete legacyDoc.checksum;
  const legacy = verifyBackup(JSON.stringify(legacyDoc), fixtureState([]));
  assert.equal(legacy.verified, true);
  assert.match(legacy.warning, /older backup/);
});

test('Plan J: verifyBackup never mutates the current ledger', () => {
  const current = backupLedgerState();
  const before = JSON.stringify(current);
  verifyBackup(createJsonBackup(backupLedgerState()), current);
  assert.equal(JSON.stringify(current), before);
});

test('Plan J: verifyBackup counts months from the backup even when the device has none of them', () => {
  const report = verifyBackup(createJsonBackup(backupLedgerState()), fixtureState([]));
  assert.deepEqual(report.months, ['2026-09', '2026-10']);
});

// ------------------------------------------------- describeRestoreChanges --

test('Plan J: describeRestoreChanges counts a wholly new customer and its bills and receipts', () => {
  const current = fixtureState([]);
  const merged = backupLedgerState();
  const changes = describeRestoreChanges(current, merged);
  assert.equal(changes.addedCustomers.length, 2);
  assert.equal(changes.addedBills, 3);
  assert.equal(changes.addedPayments, 3);
  assert.equal(changes.addedPaymentsAmount, 6500);
  assert.equal(changes.nothingRemoved, true);
  assert.equal(changes.totalChanges, 2 + 3 + 3);
});

test('Plan J: describeRestoreChanges counts a new bill month, but not a new payment in a known month, as a bill', () => {
  const current = fixtureState([
    fixtureCustomer({ id: 'cust-a', customerNumber: 1, name: 'Alpha', bills: [fixtureBill({ month: '2026-09', payments: [fixturePayment({ id: 'pay-a1', amount: 2000 })] })] }),
  ]);
  const merged = fixtureState([
    fixtureCustomer({
      id: 'cust-a', customerNumber: 1, name: 'Alpha',
      bills: [
        fixtureBill({ month: '2026-09', payments: [fixturePayment({ id: 'pay-a1', amount: 2000 }), fixturePayment({ id: 'pay-new', amount: 500 })] }),
        fixtureBill({ month: '2026-10', payments: [fixturePayment({ id: 'pay-a2', amount: 1500 })] }),
      ],
    }),
  ]);
  const changes = describeRestoreChanges(current, merged);
  assert.equal(changes.addedBills, 1);
  assert.equal(changes.addedPayments, 2);
  assert.equal(changes.addedPaymentsAmount, 2000);
  assert.equal(changes.nothingRemoved, true);
});

test('Plan J: describeRestoreChanges names changed profile fields for a shared customer', () => {
  const current = fixtureState([fixtureCustomer({ id: 'cust-a', customerNumber: 1, name: 'Alpha', mohalla: 'OLD', bills: [] })]);
  const merged = fixtureState([fixtureCustomer({ id: 'cust-a', customerNumber: 1, name: 'Alpha', mohalla: 'NEW', bills: [] })]);
  const changes = describeRestoreChanges(current, merged);
  assert.equal(changes.changedCustomers.length, 1);
  assert.deepEqual(changes.changedCustomers[0].fields, ['mohalla']);
  assert.equal(changes.addedPayments, 0);
  assert.equal(changes.nothingRemoved, true);
});

test('Plan J: describeRestoreChanges reports a removed customer and flips nothingRemoved', () => {
  const current = backupLedgerState();
  const merged = fixtureState([fixtureCustomer({ id: 'cust-a', customerNumber: 1, name: 'Alpha', bills: [] })]);
  const changes = describeRestoreChanges(current, merged);
  assert.equal(changes.removedCustomers.length, 1);
  assert.equal(changes.removedCustomers[0].id, 'cust-b');
  assert.equal(changes.nothingRemoved, false);
});

test('Plan J: describeRestoreChanges reports a removed bill and its payments for a shared customer', () => {
  const current = backupLedgerState();
  const merged = fixtureState([
    fixtureCustomer({ id: 'cust-a', customerNumber: 1, name: 'Alpha', bills: [fixtureBill({ month: '2026-09', payments: [fixturePayment({ id: 'pay-a1', amount: 2000 })] })] }),
    fixtureCustomer({ id: 'cust-b', customerNumber: 2, name: 'Beta', bills: [fixtureBill({ month: '2026-10', payments: [fixturePayment({ id: 'pay-b1', amount: 3000 })] })] }),
  ]);
  const changes = describeRestoreChanges(current, merged);
  assert.equal(changes.removedBills, 1);
  assert.equal(changes.removedPayments, 1);
  assert.equal(changes.nothingRemoved, false);
});

test('Plan J: describeRestoreChanges reports a removed payment inside a kept bill month', () => {
  const current = fixtureState([
    fixtureCustomer({ id: 'cust-a', customerNumber: 1, name: 'Alpha', bills: [fixtureBill({ month: '2026-10', payments: [fixturePayment({ id: 'pay-a1', amount: 2000 }), fixturePayment({ id: 'pay-a2', amount: 1500 })] })] }),
  ]);
  const merged = fixtureState([
    fixtureCustomer({ id: 'cust-a', customerNumber: 1, name: 'Alpha', bills: [fixtureBill({ month: '2026-10', payments: [fixturePayment({ id: 'pay-a1', amount: 2000 })] })] }),
  ]);
  const changes = describeRestoreChanges(current, merged);
  assert.equal(changes.removedPayments, 1);
  assert.equal(changes.removedBills, 0);
  assert.equal(changes.nothingRemoved, false);
});

test('Plan J: describeRestoreChanges on identical ledgers is all zero and nothingRemoved', () => {
  const changes = describeRestoreChanges(backupLedgerState(), backupLedgerState());
  assert.deepEqual(
    [changes.addedCustomers.length, changes.removedCustomers.length, changes.changedCustomers.length,
     changes.addedBills, changes.addedPayments, changes.removedBills, changes.removedPayments, changes.totalChanges],
    [0, 0, 0, 0, 0, 0, 0, 0],
  );
  assert.equal(changes.nothingRemoved, true);
});

test('Plan J: describeRestoreChanges never mutates either ledger', () => {
  const current = backupLedgerState();
  const merged = cloneFixture(backupLedgerState());
  merged.customers[0].mohalla = 'CHANGED';
  const beforeCurrent = JSON.stringify(current);
  const beforeMerged = JSON.stringify(merged);
  describeRestoreChanges(current, merged);
  assert.equal(JSON.stringify(current), beforeCurrent);
  assert.equal(JSON.stringify(merged), beforeMerged);
});

test('Plan J: describeRestoreChanges tolerates missing customers arrays as empty ledgers', () => {
  const changes = describeRestoreChanges(null, {});
  assert.equal(changes.nothingRemoved, true);
  assert.equal(changes.totalChanges, 0);
});

// ---------------------------------------------- destructiveActionContract --

test('Plan J: every covered destructive action has a complete contract', () => {
  for (const action of ['customer-delete', 'payment-void', 'customer-archive', 'backup-restore', 'backup-restore-local']) {
    const contract = destructiveActionContract(action);
    assert.ok(contract, `${action} has a contract`);
    assert.equal(contract.action, action);
    assert.equal(typeof contract.confirm, 'string');
    assert.equal(typeof contract.safetySnapshot, 'boolean');
    assert.equal(typeof contract.undo, 'string');
    assert.equal(typeof contract.reversibleVia, 'string');
    assert.ok(contract.reversibleVia.length > 20, `${action} explains the way back`);
  }
});

test('Plan J: customer delete contract is danger confirm, snapshot, 5-second toast undo', () => {
  const contract = destructiveActionContract('customer-delete');
  assert.equal(contract.confirm, 'danger');
  assert.equal(contract.safetySnapshot, true);
  assert.equal(contract.undo, 'toast');
  assert.equal(contract.undoWindowMs, 5000);
});

test('Plan J: payment void contract is reason dialog, snapshot, rollback — not a toast undo', () => {
  const contract = destructiveActionContract('payment-void');
  assert.equal(contract.confirm, 'reason-dialog');
  assert.equal(contract.safetySnapshot, true);
  assert.equal(contract.undo, 'rollback');
  assert.match(contract.reversibleVia, /never half-applies/);
});

test('Plan J: customer archive needs no snapshot because archiving keeps the history', () => {
  const contract = destructiveActionContract('customer-archive');
  assert.equal(contract.safetySnapshot, false);
  assert.equal(contract.undo, 'toast');
  assert.match(contract.reversibleVia, /unarchive/);
});

test('Plan J: backup restore contract is preview confirm, snapshot, safety-snapshot undo — no toast undo claimed', () => {
  for (const action of ['backup-restore', 'backup-restore-local']) {
    const contract = destructiveActionContract(action);
    assert.equal(contract.confirm, 'preview');
    assert.equal(contract.safetySnapshot, true);
    assert.equal(contract.undo, 'safety-snapshot');
    assert.match(contract.reversibleVia, /no one-tap undo toast/i);
  }
});

test('Plan J: destructiveActionContract returns null for an unchecked action', () => {
  assert.equal(destructiveActionContract('wipe-everything'), null);
  assert.equal(destructiveActionContract(''), null);
  assert.equal(destructiveActionContract(undefined), null);
});

test('Plan J: destructive action contracts are frozen so no caller can rewrite the pattern', () => {
  assert.equal(Object.isFrozen(DESTRUCTIVE_ACTION_CONTRACTS), true);
  assert.equal(Object.isFrozen(destructiveActionContract('customer-delete')), true);
});

test('Plan J: backup-verification format tag matches the format core.js stamps', () => {
  const core = read('core.js');
  const match = core.match(/BACKUP_FORMAT = '([^']+)'/);
  assert.ok(match, 'core.js declares BACKUP_FORMAT');
  assert.equal(BACKUP_FORMAT_TAG, match[1]);
});

// ------------------------------------------------------------- app wiring --

test('Plan J: app.js imports the verification helpers and wires the verify button to them', () => {
  const app = read('app.js');
  assert.match(app, /import \{ verifyBackup, describeRestoreChanges \} from '\.\/backup-verification\.js/);
  const handlerStart = app.indexOf("$('#verifyLocalBackupButton').addEventListener('click'");
  assert.ok(handlerStart >= 0, 'verify button handler exists');
  const handlerEnd = app.indexOf("$('#restoreLocalBackupButton').addEventListener('click'", handlerStart);
  const handler = app.slice(handlerStart, handlerEnd);
  assert.match(handler, /localBackupStore\.getBackup\(id\)/);
  assert.match(handler, /verifyBackup\(backup\.backupText, state\)/);
  assert.match(handler, /localBackupVerificationResult/);
  assert.doesNotMatch(handler, /renderBackupPreview/);
  assert.match(handler, /No local data was changed/);
});

test('Plan J: app.js restore preview appends the what-changes report, including the nothing-removed line', () => {
  const app = read('app.js');
  const start = app.indexOf('function renderBackupPreview(');
  assert.ok(start >= 0);
  const block = app.slice(start, app.indexOf('\n// SISP-10: surface checksum verification', start));
  assert.match(block, /describeRestoreChanges\(state, preview\.state\)/);
  assert.match(block, /no customer, bill or payment already on this device will be removed/);
  assert.match(block, /would be removed — review before applying/);
});

test('Plan J: app.js enables the verify button exactly where it enables the restore button', () => {
  const app = read('app.js');
  assert.match(app, /\$\('#restoreLocalBackupButton'\)\.disabled = !select\.value;\n  \$\('#verifyLocalBackupButton'\)\.disabled = !select\.value;/);
  assert.match(app, /\$\('#restoreLocalBackupButton'\)\.disabled = !event\.currentTarget\.value;\n  \$\('#verifyLocalBackupButton'\)\.disabled = !event\.currentTarget\.value;/);
});

test('Plan J: index.html carries the verify button and its result line in the backup manager', () => {
  const html = read('index.html');
  assert.match(html, /id="verifyLocalBackupButton"[^>]*disabled>Verify saved backup<\/button>/);
  assert.match(html, /id="localBackupVerificationResult" role="status" aria-live="polite"/);
  const manager = html.indexOf('id="savedLocalBackupSelect"');
  const verify = html.indexOf('id="verifyLocalBackupButton"');
  assert.ok(manager >= 0 && verify > manager, 'verify button sits with the saved-backup controls');
});

test('Plan J: docs/data-safety.md documents verify, what-changes and contracts — and what did not change', () => {
  const doc = read('docs/data-safety.md');
  assert.match(doc, /Verify a backup without restoring it/);
  assert.match(doc, /What a restore will change/);
  assert.match(doc, /Destructive actions: one contract/);
  assert.match(doc, /backup format and the encryption are untouched/);
  assert.match(doc, /no one-tap undo toast after a restore/);
});
