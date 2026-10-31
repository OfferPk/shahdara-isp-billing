/**
 * delta-merge-sync.js — SISP-102: Multi-Device Phone-to-PC Incremental
 * Delta Merge.
 *
 * The shipped backup flow (core.js `previewJsonBackupMerge`) already unions
 * the MAIN LEDGER STATE by record id — customers, bills, payments/receipts,
 * incidents, expenses, inventory items/movements and monthly closings —
 * with local-wins conflict reporting. What it cannot do is merge the
 * sibling ledgers that travel in a backup's `settings` sections (complaint
 * register, field tickets, shop settlements, partner ledgers, suspense
 * payments, void log, …): those sections are adopted wholesale only when
 * the device holds none, and otherwise conflict as one opaque block. Two
 * devices that each recorded REAL work (the phone took a payment, the PC
 * logged a complaint) could therefore never be reconciled record-by-record.
 *
 * This module is the missing per-record layer for those sections:
 *
 *   verifyDeltaMergeBackup(backupText)
 *     The delta gate. Delta mode is stricter than the shipped safe merge:
 *     the file must parse, carry the backup format stamp, and its CRC-32
 *     checksum (SISP-10 / PR #418, backup-health.js) must VERIFY. A
 *     mismatch (corrupted/edited in transit), an unverifiable legacy file
 *     (no checksum — it can still use the standard review flow), or any
 *     shape failure is refused with a reason and zero writes.
 *
 *   planDeltaMergeSections({ backupText, currentSections })
 *     Pure preview. For every record family below, incoming records are
 *     sanitized with the family's OWN shipped sanitizer (identical rules
 *     on both sides, so comparisons are symmetric) and classified by
 *     unique record id:
 *       - id only in the backup        → `added` (will be appended)
 *       - id on both sides, same bytes → unchanged (counted only)
 *       - id on both sides, differs    → `conflicts` (local kept by
 *         default; the owner may explicitly resolve one to 'incoming')
 *       - record without a usable id   → skipped + counted (`skippedUnkeyed`):
 *         an unkeyed record can never be unioned safely, because re-merging
 *         the same backup would duplicate it. It is never silently added.
 *       - duplicate id inside the backup itself → first copy wins, the
 *         rest are counted (`skippedDuplicates`), never added twice.
 *     NOTHING is ever deleted by a delta merge, on either side.
 *
 *   applyDeltaMergeSections({ currentSections, plan, resolutions })
 *     Pure apply of a plan: local order is preserved, additions are
 *     appended in backup order, conflicts stay local unless the owner
 *     resolved that exact conflict to 'incoming'. Re-applying the same
 *     backup is a no-op (every added record is then present and identical;
 *     unresolved conflicts simply conflict again and stay local).
 *
 * Deliberately OUT of delta scope (documented, not silently dropped):
 *   - the main ledger state — merged by the shipped previewJsonBackupMerge,
 *     which the app composes with this module (state first, sections here);
 *     customer balances after a merge are always RECALCULATED by the
 *     engine (calculatePaymentAllocations) from the merged records, never
 *     copied from either device.
 *   - `settings.digitalPaymentsSettings` — a single settings object, not a
 *     record family; the shipped safe-merge rule governs it.
 *   - `settings.branchGuard` — the SISP-46 lineage stamp; never merged.
 *     The app still runs the guard classification through the shipped
 *     preview and a blocked verdict blocks the delta apply too.
 *   - roznamcha days merge at DAY granularity (keyed by date): a closed
 *     day carries computed totals, so unioning individual outflows across
 *     devices could silently desync them. A same-date day that differs is
 *     a conflict for the owner to resolve whole, never a partial merge.
 *
 * Void records (SISP-34) are keyed by `paymentId` — the payment they void
 * is their cross-device identity — and union in with their full audit
 * detail. The payment's own `voided` flag lives in the ledger state, so a
 * cross-device void ALSO surfaces there as a shipped-preview payment
 * conflict (local copy kept), and `findIncomingVoidNotices` lists every
 * still-live payment the other device voided. The void is therefore never
 * lost and never silently applied: the owner voids locally through the
 * audited SISP-34 flow if the other device's void is correct.
 *
 * Pure module: no storage, no DOM. The app wires file → gate → shipped
 * state preview + this plan → pre-merge safety snapshot (a failed snapshot
 * aborts the apply) → persist.
 */
import { BACKUP_FORMAT } from './core.js';
import { verifyBackupChecksum, canonicalize } from './backup-health.js';
import { sanitizeShopSettlements } from './shop-settlement.js';
import { sanitizeComplaints } from './complaint-register.js';
import { sanitizeRoznamchaDays } from './roznamcha.js';
import { sanitizeTickets } from './complaint-tickets.js';
import { sanitizeInventory } from './inventory-book.js';
import { sanitizeHomeBudget } from './home-budget.js';
import { sanitizeLoanEntries } from './loan-ledger.js';
import { sanitizeWaTemplates } from './whatsapp-templates.js';
import { sanitizeSaadVisits, sanitizeSaadPayments } from './saad-visits.js';
import { sanitizeInstallRequests } from './install-tracker.js';
import { sanitizePendingWorks } from './pending-works.js';
import { sanitizeBillingGroups } from './group-billing.js';
import { sanitizeSuspensePayments } from './suspense-payments.js';
import { sanitizeReferralCredits } from './referral-credits.js';
import { sanitizeMonthlyClosingNotes } from './monthly-closing-notes.js';
import { sanitizeOverheads } from './fixed-overheads.js';
import { sanitizePartnerLedgerEntries, sanitizePartnerSettlements } from './partner-settlement.js';
import { sanitizeVoidPayments } from './payment-void-audit.js';

// Same cap the shipped preview enforces (core.js MAX_BACKUP_CHARACTERS).
const MAX_DELTA_BACKUP_CHARACTERS = 25 * 1024 * 1024;

const deepCopy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const sameRecord = (a, b) => canonicalize(a) === canonicalize(b);
const byId = (record) => (typeof record?.id === 'string' ? record.id : '');

/**
 * Record-family registry. `key` is the backup `settings` section name (and
 * the key the app uses for the device's current collections). `sanitize`
 * is the family's shipped sanitizer — the exact function core.js applies
 * to that section. `keyOf` extracts the unique record id ('' = unkeyed,
 * never unioned). `toRecords`/`fromRecords` adapt the two non-array
 * section shapes (monthly closing notes, overheads) to record lists.
 */
export const DELTA_MERGE_FAMILIES = Object.freeze([
  { key: 'shopSettlements', idField: 'id', sanitize: sanitizeShopSettlements, keyOf: byId },
  { key: 'complaints', idField: 'id', sanitize: sanitizeComplaints, keyOf: byId },
  { key: 'tickets', idField: 'id', sanitize: sanitizeTickets, keyOf: byId },
  { key: 'roznamchaDays', idField: 'date', sanitize: sanitizeRoznamchaDays, keyOf: (day) => (typeof day?.date === 'string' ? day.date : '') },
  { key: 'inventory', idField: 'id', sanitize: sanitizeInventory, keyOf: byId },
  { key: 'homeBudget', idField: 'id', sanitize: sanitizeHomeBudget, keyOf: byId },
  { key: 'loans', idField: 'id', sanitize: sanitizeLoanEntries, keyOf: byId },
  { key: 'waTemplates', idField: 'id', sanitize: sanitizeWaTemplates, keyOf: byId },
  { key: 'saadVisits', idField: 'id', sanitize: sanitizeSaadVisits, keyOf: byId },
  { key: 'saadPayments', idField: 'id', sanitize: sanitizeSaadPayments, keyOf: byId },
  { key: 'installRequests', idField: 'id', sanitize: sanitizeInstallRequests, keyOf: byId },
  { key: 'pendingWorks', idField: 'id', sanitize: sanitizePendingWorks, keyOf: byId },
  { key: 'billingGroups', idField: 'billingGroupId', sanitize: sanitizeBillingGroups, keyOf: (group) => (typeof group?.billingGroupId === 'string' ? group.billingGroupId : '') },
  { key: 'suspensePayments', idField: 'suspenseId', sanitize: sanitizeSuspensePayments, keyOf: (entry) => (typeof entry?.suspenseId === 'string' ? entry.suspenseId : '') },
  { key: 'referralCredits', idField: 'referralId', sanitize: sanitizeReferralCredits, keyOf: (entry) => (typeof entry?.referralId === 'string' ? entry.referralId : '') },
  { key: 'partnerLedger', idField: 'id', sanitize: sanitizePartnerLedgerEntries, keyOf: byId },
  { key: 'partnerSettlements', idField: 'id', sanitize: sanitizePartnerSettlements, keyOf: byId },
  // Keyed by paymentId: the voided payment is the record's identity across
  // devices (two devices voiding the same payment are ONE event to
  // reconcile, surfaced as a conflict when their details differ).
  { key: 'voidPayments', idField: 'paymentId', sanitize: sanitizeVoidPayments, keyOf: (entry) => (typeof entry?.paymentId === 'string' ? entry.paymentId : '') },
  {
    key: 'monthlyClosingNotes', idField: 'month', sanitize: sanitizeMonthlyClosingNotes,
    keyOf: (entry) => (typeof entry?.month === 'string' ? entry.month : ''),
    toRecords: (notes) => Object.entries(notes && typeof notes === 'object' ? notes : {})
      .map(([month, entry]) => ({ month, note: entry.note, savedAt: entry.savedAt }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    fromRecords: (records) => Object.fromEntries(
      [...records].sort((a, b) => a.month.localeCompare(b.month)).map((entry) => [entry.month, { note: entry.note, savedAt: entry.savedAt }])
    )
  },
  {
    key: 'overheads', idField: 'id', sanitize: sanitizeOverheads,
    keyOf: (entry) => (entry?.id ? `${entry.__deltaKind}:${entry.id}` : ''),
    toRecords: (value) => [
      ...(Array.isArray(value?.templates) ? value.templates : []).map((row) => ({ ...row, __deltaKind: 'template' })),
      ...(Array.isArray(value?.postings) ? value.postings : []).map((row) => ({ ...row, __deltaKind: 'posting' }))
    ],
    fromRecords: (records) => ({
      templates: records.filter((row) => row.__deltaKind === 'template').map(({ __deltaKind, ...row }) => row),
      postings: records.filter((row) => row.__deltaKind === 'posting').map(({ __deltaKind, ...row }) => row)
    })
  }
]);

const familyRecords = (family, sectionValue) => {
  const sanitized = family.sanitize(sectionValue);
  return family.toRecords ? family.toRecords(sanitized) : (Array.isArray(sanitized) ? sanitized : []);
};
const recordsToSection = (family, records, currentValue) => (
  family.fromRecords ? family.fromRecords(records, currentValue) : records
);

/**
 * The delta gate: parse + format + CRC-32 verification. Delta merges only
 * ever run on checksum-VERIFIED backups (the spec's "CRC-32 verified JSON
 * backup"); every other verdict is a refusal with a plain reason.
 */
export function verifyDeltaMergeBackup(backupText) {
  if (typeof backupText !== 'string' || backupText.length > MAX_DELTA_BACKUP_CHARACTERS) {
    return { ok: false, status: 'invalid', error: 'Backup is too large or is not readable JSON. No local data has changed.' };
  }
  let document;
  try { document = JSON.parse(backupText); }
  catch { return { ok: false, status: 'invalid', error: 'Backup is not valid JSON. No local data has changed.' }; }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { ok: false, status: 'invalid', error: 'Backup is not valid JSON. No local data has changed.' };
  }
  if (document.format !== BACKUP_FORMAT) {
    return { ok: false, status: 'invalid', error: 'This is not a supported Shahdara ISP Billing JSON backup. No local data has changed.' };
  }
  if (Number(document.formatVersion) > 1) {
    return { ok: false, status: 'invalid', error: 'Backup format version is newer than supported by this app. No local data has changed.' };
  }
  const checksum = verifyBackupChecksum(backupText);
  if (checksum.status === 'mismatch') {
    return { ok: false, status: 'mismatch', error: 'Checksum mismatch — this backup was corrupted or edited in transit. Delta merge refused; export a fresh copy from the original device. No local data has changed.' };
  }
  if (checksum.status === 'invalid') {
    return { ok: false, status: 'invalid', error: 'Backup is not valid JSON. No local data has changed.' };
  }
  if (checksum.status !== 'verified') {
    return { ok: false, status: 'unverified', error: 'This backup has no checksum, so its integrity cannot be verified. Delta merge needs a checksum-verified backup — use the standard Review JSON backup flow for older backups. No local data has changed.' };
  }
  return { ok: true, status: 'verified', document };
}

/**
 * Build the per-family union plan. Pure: inputs are never mutated, and the
 * returned plan is plain JSON-safe data the UI can hold between preview
 * and apply. `currentSections` maps family key → this device's current
 * collection (the same shapes the loaders return / backups carry).
 */
export function planDeltaMergeSections({ backupText, currentSections = {} } = {}) {
  const gate = verifyDeltaMergeBackup(backupText);
  const totals = { added: 0, unchanged: 0, conflicts: 0, skippedUnkeyed: 0, skippedDuplicates: 0 };
  if (!gate.ok) return { ok: false, status: gate.status, error: gate.error, families: {}, totals };
  const settings = (gate.document.settings && typeof gate.document.settings === 'object' && !Array.isArray(gate.document.settings))
    ? gate.document.settings
    : {};
  const families = {};
  for (const family of DELTA_MERGE_FAMILIES) {
    if (!Object.hasOwn(settings, family.key)) continue;
    const incomingRecords = familyRecords(family, settings[family.key]);
    const currentRecords = familyRecords(family, currentSections?.[family.key]);
    const currentByKey = new Map();
    for (const record of currentRecords) {
      const id = family.keyOf(record);
      if (id && !currentByKey.has(id)) currentByKey.set(id, record);
    }
    const added = [];
    const conflicts = [];
    const seenIncoming = new Set();
    let unchanged = 0;
    let skippedUnkeyed = 0;
    let skippedDuplicates = 0;
    for (const record of incomingRecords) {
      const id = family.keyOf(record);
      if (!id) { skippedUnkeyed++; continue; }
      if (seenIncoming.has(id)) { skippedDuplicates++; continue; }
      seenIncoming.add(id);
      const local = currentByKey.get(id);
      if (!local) { added.push(deepCopy(record)); continue; }
      if (sameRecord(local, record)) { unchanged++; continue; }
      conflicts.push({ key: `${family.key}:${id}`, family: family.key, id, local: deepCopy(local), incoming: deepCopy(record) });
    }
    families[family.key] = { added, unchanged, conflicts, skippedUnkeyed, skippedDuplicates };
    totals.added += added.length;
    totals.unchanged += unchanged;
    totals.conflicts += conflicts.length;
    totals.skippedUnkeyed += skippedUnkeyed;
    totals.skippedDuplicates += skippedDuplicates;
  }
  return { ok: true, status: 'verified', exportedAt: gate.document.exportedAt ?? '', families, totals };
}

/**
 * Void notices: payments that the OTHER device voided (a void record is
 * in the merged void log) while this device's merged state still holds
 * the payment as live money. A delta merge NEVER flips a payment's void
 * state silently — voiding is an audited local action (SISP-34) — so
 * these are surfaced for the owner to act on, never auto-applied. Pure
 * and read-only: mergedSections is the apply output, mergedState is the
 * shipped preview's merged state.
 */
export function findIncomingVoidNotices(mergedSections, mergedState) {
  const voids = Array.isArray(mergedSections?.voidPayments) ? mergedSections.voidPayments : [];
  if (!voids.length || !Array.isArray(mergedState?.customers)) return [];
  const notices = [];
  for (const entry of voids) {
    const paymentId = typeof entry?.paymentId === 'string' ? entry.paymentId : '';
    if (!paymentId) continue;
    for (const customer of mergedState.customers) {
      for (const bill of customer?.bills ?? []) {
        const payment = (bill?.payments ?? []).find((row) => row?.id === paymentId);
        if (payment && payment.voided !== true) {
          notices.push({
            paymentId,
            customerId: customer.id ?? null,
            customerNumber: customer.customerNumber ?? null,
            customerName: typeof customer.name === 'string' ? customer.name : '',
            billMonth: bill.month ?? '',
            amount: Number(payment.amount) || 0,
            voidReason: typeof entry.voidReason === 'string' ? entry.voidReason : '',
            voidedAt: typeof entry.voidedAt === 'string' ? entry.voidedAt : ''
          });
        }
      }
    }
  }
  return notices;
}

/**
 * Apply a plan to the current sections. Pure: returns a NEW sections
 * object; families the plan does not touch pass through unchanged, and
 * local records are never removed or reordered. `resolutions` maps a
 * conflict's `key` to 'incoming' to adopt the backup's copy of that one
 * record; anything else (including a missing entry) keeps the local copy.
 */
export function applyDeltaMergeSections({ currentSections = {}, plan, resolutions = {} } = {}) {
  if (!plan || plan.ok !== true) throw new Error('Delta merge plan is not applicable. No local data has changed.');
  const sections = {};
  for (const [key, value] of Object.entries(currentSections ?? {})) sections[key] = deepCopy(value);
  const applied = { added: 0, resolvedIncoming: 0, keptLocal: 0, perFamily: {} };
  for (const family of DELTA_MERGE_FAMILIES) {
    const familyPlan = plan.families?.[family.key];
    if (!familyPlan) continue;
    // Start from the FULL local list — every local record survives,
    // including any record that carries no usable id (it can never be
    // unioned, but a merge must never delete it either).
    const merged = familyRecords(family, currentSections?.[family.key]).map((record) => deepCopy(record));
    const indexByKey = new Map();
    merged.forEach((record, index) => {
      const id = family.keyOf(record);
      if (id && !indexByKey.has(id)) indexByKey.set(id, index);
    });
    let familyAdded = 0;
    for (const record of familyPlan.added ?? []) {
      const id = family.keyOf(record);
      if (!id || indexByKey.has(id)) continue;
      indexByKey.set(id, merged.length);
      merged.push(deepCopy(record));
      familyAdded++;
    }
    let familyResolved = 0;
    let familyKept = 0;
    for (const conflict of familyPlan.conflicts ?? []) {
      if (resolutions?.[conflict.key] === 'incoming' && indexByKey.has(conflict.id)) {
        merged[indexByKey.get(conflict.id)] = deepCopy(conflict.incoming);
        familyResolved++;
      } else {
        familyKept++;
      }
    }
    sections[family.key] = recordsToSection(family, merged, currentSections?.[family.key]);
    applied.added += familyAdded;
    applied.resolvedIncoming += familyResolved;
    applied.keptLocal += familyKept;
    applied.perFamily[family.key] = { added: familyAdded, resolvedIncoming: familyResolved, keptLocal: familyKept };
  }
  return { sections, applied };
}
