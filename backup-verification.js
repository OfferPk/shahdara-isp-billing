// Plan J — Data safety: backup and restore verification.
//
// Pure module, one import (the checksum verifier from backup-health.js,
// itself pure and zero-import), so it runs unchanged in the browser
// bundle and in Node unit tests. It adds the operator flow the plan
// found missing, without rebuilding the backup format or the
// encryption, and without changing any existing restore behaviour:
//
// 1. `verifyBackup` — "prove my backup restores" WITHOUT restoring:
//    parse + format + checksum + counts + months covered, compared
//    against the current ledger. It never writes, never mutates
//    either input, and never throws for malformed input: a bad
//    backup is a report (`verified: false` + a reason), not a crash.
//    A checksum mismatch is never restorable — the same rule the
//    restore preview already enforces with `canApply: false`.
//    A legacy backup without a checksum is restorable with a
//    warning, exactly as the preview already treats it.
// 2. `describeRestoreChanges` — the what-changes report a restore
//    preview should show BEFORE it applies: what will be added,
//    what will change, and — explicitly — what will NOT be removed.
//    The existing restore is a merge (previewJsonBackupMerge in
//    core.js adds and fills, conflicts keep the local value), so a
//    correct report shows removed counts of zero; if a future
//    merge ever removed a record, this report would say so instead
//    of silently hiding it.
// 3. `destructiveActionContract` — the single statement of the
//    confirm-and-undo pattern for the covered destructive flows.
//    It pins the behaviour app.js already implements (verified
//    against the call sites, not invented): customer delete has a
//    danger confirm + safety snapshot + a 5-second undo toast;
//    payment void has a reason dialog + safety snapshot + a
//    rollback guard when its log write fails; customer archive has
//    a reason dialog + an undo toast and needs no snapshot because
//    archiving keeps the history and unarchive reverses it; a
//    backup restore has the preview itself as its confirmation,
//    a safety snapshot taken before applying, and undo by
//    restoring that safety snapshot from the backup controls
//    (there is no one-tap undo toast after a restore — the
//    contract says so plainly rather than claiming one).
//
// What is deliberately NOT claimed here: this module does not
// apply a restore, decrypt anything, or re-validate a backup the
// way previewJsonBackupMerge does (duplicate IDs, invalid
// snapshots, bad expenses). Verification is a pre-check; the
// preview's deep validation still runs before any apply, and a
// backup this module calls verified can still be refused there
// for a specific validation reason. The encryption and backup
// format are untouched.

import { verifyBackupChecksum } from './backup-health.js';

// Mirrors core.js BACKUP_FORMAT ('shahdara-isp-billing-backup').
// This module does not import core.js: core is the whole ledger
// engine, and verification only needs the format tag. The test
// suite pins the two spellings equal by reading core.js source.
export const BACKUP_FORMAT_TAG = 'shahdara-isp-billing-backup';

export const MAX_BACKUP_CHARACTERS = 25 * 1024 * 1024;

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function asCustomers(state) {
  return state && Array.isArray(state.customers) ? state.customers : [];
}

function billsOf(customer) {
  return Array.isArray(customer?.bills) ? customer.bills : [];
}

function paymentsOf(bill) {
  return Array.isArray(bill?.payments) ? bill.payments : [];
}

function countLedger(customers) {
  let bills = 0;
  let payments = 0;
  let amount = 0;
  const months = new Set();
  for (const customer of customers) {
    for (const bill of billsOf(customer)) {
      bills++;
      if (typeof bill?.month === 'string' && bill.month) months.add(bill.month);
      for (const payment of paymentsOf(bill)) {
        payments++;
        if (Number.isFinite(payment?.amount)) amount += payment.amount;
      }
    }
  }
  return { customers: customers.length, bills, payments, amount, months: [...months].sort() };
}

function paymentKeys(customers) {
  // Merge identity used by the restore preview: customer id +
  // bill month + payment id. A payment without an id cannot be
  // matched across devices, so it is keyed by its JSON shape and
  // counted as unmatched rather than silently treated as new.
  const keys = new Map();
  for (const customer of customers) {
    for (const bill of billsOf(customer)) {
      for (const payment of paymentsOf(bill)) {
        const key = payment?.id
          ? `${customer?.id}|${bill?.month}|${payment.id}`
          : `unkeyed|${customer?.id}|${bill?.month}|${JSON.stringify(payment)}`;
        keys.set(key, payment);
      }
    }
  }
  return keys;
}

// Parse and summarise a backup document without touching any
// stored data. Never throws: every failure mode is a report.
export function summarizeBackup(backupText) {
  if (typeof backupText !== 'string' || !backupText) {
    return { ok: false, reason: 'Backup data is empty or invalid.', checksumStatus: 'invalid' };
  }
  if (backupText.length > MAX_BACKUP_CHARACTERS) {
    return { ok: false, reason: 'Backup is too large to verify (over 25 MB).', checksumStatus: 'invalid' };
  }
  let document;
  try { document = JSON.parse(backupText); }
  catch {
    return { ok: false, reason: 'Backup is not valid JSON.', checksumStatus: 'invalid' };
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { ok: false, reason: 'Backup is not valid JSON.', checksumStatus: 'invalid' };
  }
  if (document.format !== BACKUP_FORMAT_TAG) {
    return { ok: false, reason: 'This is not a supported Shahdara ISP Billing JSON backup.', checksumStatus: 'invalid' };
  }
  const formatVersion = Number(document.formatVersion);
  if (Number.isFinite(formatVersion) && formatVersion > 1) {
    return { ok: false, reason: 'Backup format version is newer than supported by this app.', checksumStatus: 'invalid' };
  }
  if (!document.state || typeof document.state !== 'object' || !Array.isArray(document.state.customers)) {
    return { ok: false, reason: 'Backup ledger is missing or malformed.', checksumStatus: 'invalid' };
  }
  const checksumStatus = verifyBackupChecksum(backupText).status;
  const counts = countLedger(document.state.customers);
  const settingsSections = document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings)
    ? Object.keys(document.settings).filter(key => {
      const value = document.settings[key];
      return value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
    }).sort()
    : [];
  return {
    ok: true,
    reason: null,
    checksumStatus,
    exportedAt: typeof document.exportedAt === 'string' ? document.exportedAt : null,
    formatVersion: Number.isFinite(formatVersion) && formatVersion >= 1 ? formatVersion : 1,
    ...counts,
    settingsSections,
  };
}

// Verify a backup against the current ledger, without restoring
// anything. `verified` is false for every failure mode — invalid
// JSON, unsupported format, malformed ledger, and checksum
// mismatch — and true (with `warning` set) for a legacy backup
// whose integrity could not be confirmed. The comparison counts
// are what the backup would ADD under the merge rules, and what
// it does NOT contain but this device already has (those local
// records stay — a merge never deletes them). Matching here is by
// customer id and payment identity only; the preview's
// number/name conflict check still runs before any apply, so a
// backup customer sharing a number with a different id will be a
// conflict there, not a clean addition here.
export function verifyBackup(backupText, currentState) {
  const summary = summarizeBackup(backupText);
  if (!summary.ok) return { ...summary, verified: false, warning: null, wouldAdd: null, keptLocalOnly: null };
  if (summary.checksumStatus === 'mismatch') {
    return {
      ...summary,
      verified: false,
      reason: 'Checksum mismatch — this backup was corrupted or edited in transit. It cannot be applied.',
      warning: null,
      wouldAdd: null,
      keptLocalOnly: null,
    };
  }
  let backupDocument;
  try { backupDocument = JSON.parse(backupText); } catch { backupDocument = null; }
  const backupCustomers = asCustomers(backupDocument?.state);
  const currentCustomers = asCustomers(currentState);
  const currentIds = new Set(currentCustomers.map(customer => customer?.id));
  const backupIds = new Set(backupCustomers.map(customer => customer?.id));
  const customersOnlyInBackup = backupCustomers
    .filter(customer => !currentIds.has(customer?.id))
    .map(customer => ({ id: customer?.id, customerNumber: customer?.customerNumber, name: customer?.name }));
  const customersOnlyInCurrent = currentCustomers
    .filter(customer => !backupIds.has(customer?.id))
    .map(customer => ({ id: customer?.id, customerNumber: customer?.customerNumber, name: customer?.name }));
  const backupPayments = paymentKeys(backupCustomers);
  const currentPayments = paymentKeys(currentCustomers);
  const sumPayments = (keys, map) => {
    let count = 0;
    let amount = 0;
    for (const key of keys) {
      const payment = map.get(key);
      count++;
      if (Number.isFinite(payment?.amount)) amount += payment.amount;
    }
    return { count, amount };
  };
  const onlyInBackupKeys = [...backupPayments.keys()].filter(key => !currentPayments.has(key));
  const onlyInCurrentKeys = [...currentPayments.keys()].filter(key => !backupPayments.has(key));
  const warning = summary.checksumStatus === 'unverified'
    ? 'No checksum found — this is an older backup, so integrity could not be verified. Review it carefully before applying.'
    : null;
  return {
    ...summary,
    verified: true,
    warning,
    wouldAdd: {
      customers: customersOnlyInBackup,
      payments: sumPayments(onlyInBackupKeys, backupPayments),
    },
    keptLocalOnly: {
      customers: customersOnlyInCurrent,
      payments: sumPayments(onlyInCurrentKeys, currentPayments),
    },
  };
}

// Diff a current ledger against a merged ledger (the state a
// restore preview computed). Pure: both inputs are only read.
// `removed*` counts are the safety half of the report — under
// merge semantics they are zero, and the report says so
// explicitly instead of omitting them.
export function describeRestoreChanges(currentState, mergedState) {
  const current = asCustomers(currentState);
  const merged = asCustomers(mergedState);
  const currentById = new Map(current.map(customer => [customer?.id, customer]));
  const mergedById = new Map(merged.map(customer => [customer?.id, customer]));
  const addedCustomers = merged
    .filter(customer => !currentById.has(customer?.id))
    .map(customer => {
      const counts = countLedger([customer]);
      return { id: customer?.id, customerNumber: customer?.customerNumber, name: customer?.name, bills: counts.bills, payments: counts.payments };
    });
  const removedCustomers = current
    .filter(customer => !mergedById.has(customer?.id))
    .map(customer => ({ id: customer?.id, customerNumber: customer?.customerNumber, name: customer?.name }));
  const changedCustomers = [];
  let addedBills = 0;
  let addedPayments = 0;
  let addedPaymentsAmount = 0;
  let removedBills = 0;
  let removedPayments = 0;
  for (const customer of merged) {
    const before = currentById.get(customer?.id);
    if (!before) continue;
    const beforeBillMonths = new Map(billsOf(before).map(bill => [bill?.month, bill]));
    const afterBillMonths = new Map(billsOf(customer).map(bill => [bill?.month, bill]));
    const changedFields = [];
    for (const key of Object.keys(customer)) {
      if (key === 'bills' || key === 'incidents') continue;
      if (!sameJson(before[key], customer[key])) changedFields.push(key);
    }
    if (changedFields.length) {
      changedCustomers.push({ id: customer?.id, customerNumber: customer?.customerNumber, name: customer?.name, fields: changedFields.sort() });
    }
    for (const [month, bill] of afterBillMonths) {
      const beforeBill = beforeBillMonths.get(month);
      if (!beforeBill) {
        addedBills++;
        addedPayments += paymentsOf(bill).length;
        for (const payment of paymentsOf(bill)) if (Number.isFinite(payment?.amount)) addedPaymentsAmount += payment.amount;
        continue;
      }
      const beforeIds = new Set(paymentsOf(beforeBill).map(payment => payment?.id));
      const afterIds = new Set(paymentsOf(bill).map(payment => payment?.id));
      for (const payment of paymentsOf(bill)) {
        if (!beforeIds.has(payment?.id)) {
          addedPayments++;
          if (Number.isFinite(payment?.amount)) addedPaymentsAmount += payment.amount;
        }
      }
      for (const payment of paymentsOf(beforeBill)) if (!afterIds.has(payment?.id)) removedPayments++;
    }
    for (const month of beforeBillMonths.keys()) if (!afterBillMonths.has(month)) {
      removedBills++;
      removedPayments += paymentsOf(beforeBillMonths.get(month)).length;
    }
  }
  for (const customer of addedCustomers) {
    addedBills += customer.bills;
    addedPayments += customer.payments;
  }
  // Amount for payments of wholly-new customers is counted above
  // from their bills; add it here so the total is complete.
  for (const customer of merged) {
    if (currentById.has(customer?.id)) continue;
    for (const bill of billsOf(customer)) {
      for (const payment of paymentsOf(bill)) if (Number.isFinite(payment?.amount)) addedPaymentsAmount += payment.amount;
    }
  }
  return {
    addedCustomers,
    removedCustomers,
    changedCustomers,
    addedBills,
    addedPayments,
    addedPaymentsAmount,
    removedBills,
    removedPayments,
    nothingRemoved: removedCustomers.length === 0 && removedBills === 0 && removedPayments === 0,
    totalChanges: addedCustomers.length + changedCustomers.length + addedBills + addedPayments,
  };
}

// The confirm-and-undo pattern, as app.js actually implements it.
// `undo` is one of: 'toast' (a timed Undo button restores the exact
// record), 'rollback' (a failed follow-up write restores the prior
// ledger — the action itself has no toast undo), 'safety-snapshot'
// (undo is a manual restore of the pre-action safety snapshot from
// the backup controls), 'unarchive' (the action is reversed by
// unarchiving, history intact). Unknown actions return null —
// callers must not invent a contract for a flow they have not
// checked.
export const DESTRUCTIVE_ACTION_CONTRACTS = Object.freeze({
  'customer-delete': Object.freeze({
    action: 'customer-delete',
    confirm: 'danger',
    safetySnapshot: true,
    undo: 'toast',
    undoWindowMs: 5000,
    reversibleVia: 'Undo toast restores the exact record at its original position; after that, the pre-delete safety snapshot in the backup controls.',
  }),
  'payment-void': Object.freeze({
    action: 'payment-void',
    confirm: 'reason-dialog',
    safetySnapshot: true,
    undo: 'rollback',
    undoWindowMs: null,
    reversibleVia: 'No toast undo: a failed void-log or ticket/boost reopen write rolls the whole void back, so a void never half-applies. The pre-void safety snapshot in the backup controls is the manual way back.',
  }),
  'customer-archive': Object.freeze({
    action: 'customer-archive',
    confirm: 'reason-dialog',
    safetySnapshot: false,
    undo: 'toast',
    undoWindowMs: null,
    reversibleVia: 'Undo toast, or unarchive later: archiving keeps all bills and history, so no snapshot is needed to reverse it.',
  }),
  'backup-restore': Object.freeze({
    action: 'backup-restore',
    confirm: 'preview',
    safetySnapshot: true,
    undo: 'safety-snapshot',
    undoWindowMs: null,
    reversibleVia: 'The restore preview is the confirmation step; a safety snapshot is saved before applying, and undo is restoring that snapshot from the backup controls. There is no one-tap undo toast after a restore.',
  }),
  'backup-restore-local': Object.freeze({
    action: 'backup-restore-local',
    confirm: 'preview',
    safetySnapshot: true,
    undo: 'safety-snapshot',
    undoWindowMs: null,
    reversibleVia: 'Same as backup-restore: preview confirms, safety snapshot is saved before applying, undo is restoring that snapshot from the backup controls. There is no one-tap undo toast after a restore.',
  }),
});

export function destructiveActionContract(action) {
  return DESTRUCTIVE_ACTION_CONTRACTS[action] ?? null;
}
