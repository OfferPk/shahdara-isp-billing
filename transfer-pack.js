// Plan 35 — Field-device data transfer pack (second phone, same ledger).
//
// A transfer pack is NOT a second backup format. It IS a Plan J backup
// document — same format tag, same format version, same CRC-32 checksum
// from backup-health.js — with one added `transfer` header carrying the
// record counts the receiving device checks before it touches anything.
// Plan J's backup-verification idea is reused for the same purpose:
// prove the pack before applying it, and refuse it with a plain message
// when the proof fails, instead of crashing or half-applying.
//
// Rules, all enforced in this pure module (one import: the checksum
// helpers from backup-health.js, itself pure and zero-import, exactly
// the precedent backup-verification.js already sets):
//
// 1. Build: `buildTransferPack` stamps the pack with the counts of the
//    ledger it was built from (customers, bills, payments, payment
//    amount, months covered) and a checksum over the whole document.
//    Inputs are never mutated; the pack carries a deep copy.
// 2. Verify: `verifyTransferPack` never throws. Every failure mode is
//    a refusal with a plain reason — empty input, invalid JSON
//    (a truncated pack), unsupported format, a format version newer
//    than this app, a malformed ledger, a checksum mismatch (the pack
//    was changed or damaged in transit), a missing checksum (a legacy
//    pack whose integrity cannot be proved — a transfer, unlike a
//    restore preview, never applies on an unproved pack), and stated
//    counts that do not match the counts recomputed from the pack
//    itself (an incomplete pack).
// 3. Apply: `decideTransferApply` never merges two different ledgers
//    and never silently overwrites newer records. A pack applies only
//    onto an empty receiving ledger, or onto a ledger already
//    identical to the pack (an idempotent re-apply, which changes
//    nothing). A device that already holds its own different ledger
//    gets a plain refusal naming the conflict, and nothing is written.
// 4. Spot-check: `spotCheckTransfer` compares the source ledger with
//    the received ledger customer by customer — bills, payments and
//    payment amount per customer — and names every mismatch, so the
//    operator can prove the transfer landed whole.
//
// What this module deliberately does NOT do: it does not merge, it
// does not resolve conflicts (there is no conflict resolution — a
// conflict is a refusal), it does not touch the branch-guard record,
// and it does not re-price or rewrite any bill. The wiring applies a
// pack only through the decision above.

import { computeBackupChecksum, verifyBackupChecksum } from './backup-health.js';

// Mirrors core.js BACKUP_FORMAT and backup-verification.js
// BACKUP_FORMAT_TAG on purpose: a transfer pack is a backup document.
export const TRANSFER_FORMAT_TAG = 'shahdara-isp-billing-backup';
export const TRANSFER_FORMAT_VERSION = 1;
export const TRANSFER_KIND = 'device-transfer';

export const MAX_TRANSFER_CHARACTERS = 25 * 1024 * 1024;

function cloneJson(value) {
  if (value === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}

function asCustomers(customers) {
  return Array.isArray(customers) ? customers : [];
}

function billsOf(customer) {
  return customer && Array.isArray(customer.bills) ? customer.bills : [];
}

function paymentsOf(bill) {
  return bill && Array.isArray(bill.payments) ? bill.payments : [];
}

// Counts of one ledger, recomputed from the records themselves — the
// same shape the pack header carries, so the two can be compared.
export function countTransferLedger(customers) {
  const list = asCustomers(customers);
  let bills = 0;
  let payments = 0;
  let amount = 0;
  const months = new Set();
  for (const customer of list) {
    for (const bill of billsOf(customer)) {
      bills++;
      if (typeof bill.month === 'string' && bill.month) months.add(bill.month);
      for (const payment of paymentsOf(bill)) {
        payments++;
        if (Number.isFinite(payment?.amount)) amount += payment.amount;
      }
    }
  }
  return { customers: list.length, bills, payments, amount, months: [...months].sort() };
}

function sameCounts(a, b) {
  return !!a && !!b
    && a.customers === b.customers
    && a.bills === b.bills
    && a.payments === b.payments
    && a.amount === b.amount
    && JSON.stringify(a.months ?? []) === JSON.stringify(b.months ?? []);
}

function countsText(counts) {
  return `${counts.customers} customers, ${counts.bills} bills, ${counts.payments} payments`
    + (counts.amount ? ` (PKR ${counts.amount.toLocaleString()})` : '');
}

// Build a transfer pack from a customer list. `exportedAt` is a
// caller-supplied stamp (the wiring passes the local date-time);
// when absent it is null, never invented from the ledger.
export function buildTransferPack(customers, options = {}) {
  const copied = cloneJson(asCustomers(customers)) ?? [];
  const counts = countTransferLedger(copied);
  const pack = {
    format: TRANSFER_FORMAT_TAG,
    formatVersion: TRANSFER_FORMAT_VERSION,
    exportedAt: typeof options.exportedAt === 'string' && options.exportedAt ? options.exportedAt : null,
    transfer: {
      kind: TRANSFER_KIND,
      deviceLabel: typeof options.deviceLabel === 'string' && options.deviceLabel.trim()
        ? options.deviceLabel.trim()
        : null,
      counts,
    },
    state: { customers: copied },
  };
  pack.checksum = computeBackupChecksum(pack);
  return pack;
}

export function transferPackText(pack) {
  return JSON.stringify(pack, null, 2);
}

export function transferPackFilename(exportedAt) {
  const stamp = typeof exportedAt === 'string' && exportedAt
    ? exportedAt.replace(/[^0-9T]/g, '-')
    : 'undated';
  return `shahdara-transfer-pack-${stamp}.json`;
}

// Verify a pack without touching any stored data. Never throws.
export function verifyTransferPack(packText) {
  const refused = (reason, extra = {}) => ({
    ok: false, reason, checksumStatus: 'invalid', counts: null, statedCounts: null,
    exportedAt: null, customers: null, ...extra,
  });
  if (typeof packText !== 'string' || !packText.trim()) {
    return refused('No transfer pack was pasted. Paste the pack JSON first.');
  }
  if (packText.length > MAX_TRANSFER_CHARACTERS) {
    return refused('This pack is too large to verify (over 25 MB).');
  }
  let document;
  try { document = JSON.parse(packText); }
  catch { return refused('This pack is not valid JSON — it may be truncated or incomplete. It cannot be applied.'); }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return refused('This pack is not valid JSON — it may be truncated or incomplete. It cannot be applied.');
  }
  if (document.format !== TRANSFER_FORMAT_TAG) {
    return refused('This is not a Shahdara ISP Billing transfer pack.');
  }
  const formatVersion = Number(document.formatVersion);
  if (Number.isFinite(formatVersion) && formatVersion > TRANSFER_FORMAT_VERSION) {
    return refused('This pack was made by a newer version of the app and cannot be applied here.');
  }
  if (!document.state || typeof document.state !== 'object' || !Array.isArray(document.state.customers)) {
    return refused('This pack has no customer ledger in it. It cannot be applied.');
  }
  if (document.state.customers.some((customer) => !customer || typeof customer !== 'object' || Array.isArray(customer))) {
    return refused('This pack contains a malformed customer record. It cannot be applied.');
  }
  const checksumStatus = verifyBackupChecksum(packText).status;
  if (checksumStatus === 'mismatch') {
    return refused(
      'Checksum mismatch — this pack was changed or damaged in transit. It cannot be applied.',
      { checksumStatus },
    );
  }
  if (checksumStatus !== 'verified') {
    return refused(
      'No checksum found — this pack cannot be proved whole, so it cannot be applied. Export a fresh transfer pack from the sending device.',
      { checksumStatus },
    );
  }
  const counts = countTransferLedger(document.state.customers);
  const stated = document.transfer && typeof document.transfer === 'object' && !Array.isArray(document.transfer)
    ? document.transfer.counts ?? null
    : null;
  if (!stated || !sameCounts(counts, stated)) {
    return refused(
      'Record counts do not match — this pack is incomplete or truncated. It cannot be applied.',
      { checksumStatus, counts, statedCounts: stated },
    );
  }
  return {
    ok: true,
    reason: null,
    checksumStatus,
    counts,
    statedCounts: stated,
    exportedAt: typeof document.exportedAt === 'string' ? document.exportedAt : null,
    customers: cloneJson(document.state.customers),
  };
}

// Decide whether a pack may land on this device. Returns the action
// the wiring must take — never a silent merge and never a silent
// overwrite. `currentCustomers` is the receiving ledger, read only.
export function decideTransferApply(packText, currentCustomers) {
  const verification = verifyTransferPack(packText);
  if (!verification.ok) {
    return { allowed: false, action: 'refused', reason: verification.reason, counts: verification.counts, customers: null };
  }
  const current = asCustomers(currentCustomers);
  if (current.length === 0) {
    return {
      allowed: true, action: 'apply', reason: null,
      counts: verification.counts, customers: verification.customers,
    };
  }
  const check = spotCheckTransfer(verification.customers, current);
  if (check.match) {
    return {
      allowed: true, action: 'already-applied',
      reason: 'This device already holds exactly this ledger, so nothing changes.',
      counts: verification.counts, customers: current,
    };
  }
  return {
    allowed: false,
    action: 'refused',
    reason: `This device already has its own ledger (${current.length} customers), which is different from this pack. `
      + 'A transfer never merges two ledgers or overwrites newer records — apply this pack on a device with no customers yet.',
    counts: verification.counts,
    customers: null,
  };
}

// Compare a source ledger with a received ledger, customer by
// customer. Returns every mismatch by customer id, never a bare
// true/false, so the operator can see exactly what differs.
export function spotCheckTransfer(sourceCustomers, receivedCustomers) {
  const source = asCustomers(sourceCustomers);
  const received = asCustomers(receivedCustomers);
  const receivedById = new Map();
  for (const customer of received) {
    if (customer && customer.id !== undefined && customer.id !== null) receivedById.set(customer.id, customer);
  }
  const mismatches = [];
  const perCustomer = (customer) => {
    const counts = countTransferLedger([customer]);
    return { bills: counts.bills, payments: counts.payments, amount: counts.amount };
  };
  for (const customer of source) {
    const other = customer && customer.id !== undefined && customer.id !== null
      ? receivedById.get(customer.id)
      : undefined;
    if (!other) {
      mismatches.push({ id: customer?.id ?? null, name: customer?.name ?? null, problem: 'missing on receiving device' });
      continue;
    }
    const a = perCustomer(customer);
    const b = perCustomer(other);
    if (a.bills !== b.bills || a.payments !== b.payments || a.amount !== b.amount) {
      mismatches.push({
        id: customer.id, name: customer.name ?? null,
        problem: `bills ${a.bills} vs ${b.bills}, payments ${a.payments} vs ${b.payments}, amount ${a.amount} vs ${b.amount}`,
      });
    }
  }
  for (const customer of received) {
    const found = customer && customer.id !== undefined && customer.id !== null
      && source.some((item) => item && item.id === customer.id);
    if (!found) {
      mismatches.push({ id: customer?.id ?? null, name: customer?.name ?? null, problem: 'extra on receiving device' });
    }
  }
  const sourceCounts = countTransferLedger(source);
  const receivedCounts = countTransferLedger(received);
  return {
    match: mismatches.length === 0 && sameCounts(sourceCounts, receivedCounts),
    sourceCounts, receivedCounts, mismatches,
  };
}

export function transferPackSummaryText(verification) {
  if (!verification || !verification.ok) return verification?.reason ?? 'No transfer pack verified yet.';
  return `Transfer pack verified: ${countsText(verification.counts)}`
    + (verification.exportedAt ? `, exported ${verification.exportedAt}.` : '.')
    + ' Checksum verified.';
}

const escapeHtmlText = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function transferPackHtml(verification) {
  if (!verification || !verification.ok) {
    return `<p>${escapeHtmlText(verification?.reason ?? 'No transfer pack verified yet.')}</p>`;
  }
  const counts = verification.counts;
  return `<table class="data-table"><thead><tr><th>Customers</th><th>Bills</th><th>Payments</th><th>Payment total</th><th>Months</th></tr></thead>`
    + `<tbody><tr><td>${counts.customers}</td><td>${counts.bills}</td><td>${counts.payments}</td>`
    + `<td>${escapeHtmlText(counts.amount.toLocaleString())}</td>`
    + `<td>${escapeHtmlText(counts.months.length ? counts.months.join(', ') : '—')}</td></tr></tbody></table>`
    + `<p>Checksum verified. A pack applies only onto a device with no customers yet, or onto a device that already holds exactly this ledger — it never merges two ledgers or overwrites newer records.</p>`;
}
