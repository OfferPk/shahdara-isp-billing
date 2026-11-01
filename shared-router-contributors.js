/**
 * shared-router-contributors.js — SISP-158: Shared-Router 2-Neighbor Split
 * Bill Contributor Tracker (مشترکہ راؤٹر بل تقسیم).
 *
 * One connection (one router) is often shared by two neighbouring houses.
 * The main customer record may therefore carry `subContributors[]` — the
 * neighbours who share the connection and owe an agreed part of the bill:
 *   { id: 'SC-1', name: 'Hamsaya name', sharePKR: 1000, phone: '03…' }
 *
 * BOUNDARY (the whole point of this module): contributors are an
 * ATTRIBUTION LAYER ONLY. The customer still gets ONE normal bill for the
 * full package price; the allocation engine, FIFO and every dues figure
 * work exactly as before and never split anything by contributor. This
 * module only answers "who has paid their part, and whose part is still
 * left" — it never moves money.
 *
 * The split reading: each contributor's sharePKR is THEIR part. Anything
 * not allocated to a contributor is implicitly the MAIN customer's own
 * share: price − Σ contributor shares, floored at 0. The shares do NOT
 * have to add up to the package price (the profile shows a soft warning
 * when they don't — it never blocks saving or billing).
 *
 * Payments may carry a `paidByContributor = { id, name }` SNAPSHOT stamp,
 * written at record time from the contributor list (the SISP-43/106 stamp
 * discipline): later edits or removal of a contributor never rewrite a
 * saved payment — a removed contributor's tagged payments still attribute
 * to their snapshot name with share 0 (see contributorSplitStatus).
 *
 * Per-month status is a PURE DERIVATION from the bill's own payments:
 * nothing is stored per month, so a new month starts everyone at 0 paid
 * automatically (the cycle reset is derived, never a stored reset).
 *
 * This module is dependency-free on purpose (the installment-plan.js /
 * hardware-custody.js sanitizer precedent): core.js, receipt.js and the
 * UI modules import it without any import cycle. The voided check below
 * mirrors payment-void-audit.js isVoidedPayment (payment.voided === true)
 * for the same reason.
 */

export const CONTRIBUTOR_ID_RE = /^SC-\d+$/;
export const MAX_SUB_CONTRIBUTORS = 10;
const CONTRIBUTOR_NAME_CAP = 100;
const CONTRIBUTOR_PHONE_CAP = 40;

const cleanStampName = (value) => String(value ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, CONTRIBUTOR_NAME_CAP);
const centsOf = (value) => Math.round(Number(value) * 100);
const moneyOf = (cents) => Math.round(cents) / 100;

/**
 * The single sanitization point for `customer.subContributors` (core.js
 * calls it from addCustomer, updateCustomerProfile, readState, backup
 * validate and the backup preview-merge). Never throws: a row survives
 * only with a non-empty trimmed name (house cap) and a finite share > 0;
 * anything else is dropped, so corrupt saved data can never pose as a
 * contributor. Ids are stable: a valid, unused SC-n id is kept as-is;
 * missing or duplicate ids are assigned the next free SC-n at save time.
 * Phone is optional and stored as typed (trimmed, capped) — never parsed
 * or reformatted.
 */
export function sanitizeSubContributors(value) {
  if (!Array.isArray(value)) return [];
  const candidates = [];
  for (const entry of value) {
    if (candidates.length >= MAX_SUB_CONTRIBUTORS) break;
    if (!entry || typeof entry !== 'object') continue;
    const name = cleanStampName(entry.name);
    if (!name) continue;
    const share = Number(entry.sharePKR);
    if (!Number.isFinite(share) || share <= 0) continue;
    const rawId = typeof entry.id === 'string' ? entry.id.trim() : '';
    candidates.push({
      id: CONTRIBUTOR_ID_RE.test(rawId) ? rawId : null,
      name,
      sharePKR: moneyOf(centsOf(share)),
      phone: String(entry.phone ?? '').trim().slice(0, CONTRIBUTOR_PHONE_CAP)
    });
  }
  // Two passes so an explicit id later in the list is never stolen by an
  // id-less row earlier in the list.
  const usedIds = new Set(candidates.map((row) => row.id).filter(Boolean));
  const seenIds = new Set();
  for (const row of candidates) {
    if (row.id && !seenIds.has(row.id)) { seenIds.add(row.id); continue; }
    let n = 1;
    while (usedIds.has(`SC-${n}`) || seenIds.has(`SC-${n}`)) n++;
    row.id = `SC-${n}`;
    seenIds.add(row.id);
    usedIds.add(row.id);
  }
  return candidates;
}

/** The customer's sanitized contributor list ([] when none / unreadable). */
export function subContributorsOf(customer) {
  return sanitizeSubContributors(customer?.subContributors);
}

/**
 * The single sanitization point for a payment's `paidByContributor`
 * stamp. A stamp is kept only as an exact { id: SC-n, name } pair with a
 * non-empty name; anything malformed reads as null (no stamp), so a
 * corrupt value in a backup can never attribute money to a phantom
 * neighbour — core's validatePayment drops it the same way.
 */
export function sanitizePaidByContributorStamp(value) {
  if (!value || typeof value !== 'object') return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (!CONTRIBUTOR_ID_RE.test(id)) return null;
  const name = cleanStampName(value.name);
  if (!name) return null;
  return { id, name };
}

/** A saved payment's contributor stamp, sanitized ([]-safe reader). */
export function paidByContributorOf(payment) {
  return sanitizePaidByContributorStamp(payment?.paidByContributor);
}

/**
 * Build the { id, name } snapshot to stamp on a NEW payment for the
 * contributor the operator picked (Quick Collect). Returns null when the
 * id names no current contributor — the payment then stays untagged and
 * attributes to the main customer.
 */
export function contributorSnapshotFor(customer, contributorId) {
  const id = typeof contributorId === 'string' ? contributorId.trim() : '';
  if (!CONTRIBUTOR_ID_RE.test(id)) return null;
  const found = subContributorsOf(customer).find((entry) => entry.id === id);
  return found ? { id: found.id, name: found.name } : null;
}

/**
 * Pure per-month split status for one bill. Returns null when the
 * customer has no contributors (callers then render nothing — ordinary
 * customers stay byte-identical everywhere).
 *
 *   price    — the package price the shares are read against. Callers
 *              pass the applicable price when they know it; the bill's
 *              own dueAmount is the fallback, then 0.
 *   payments — optional payment list override (the receipt builder
 *              passes only the payments up to and including its own
 *              payment, for through-this-payment semantics). Defaults
 *              to the bill's saved payments.
 *
 * paid = Σ NON-VOIDED payments on this bill tagged with the contributor's
 * id (the payment's cash amount; a discount is an ISP waiver, not a
 * neighbour's payment, and ticket-charge portions still count as money
 * the payer handed over on this bill). Untagged payments — and stamps
 * too malformed to read — attribute to the MAIN customer. A contributor
 * who overpays shows remaining 0: the excess is ordinary bill money,
 * never a per-contributor credit. A payment tagged to a contributor who
 * has since been REMOVED still shows as a row under its snapshot name
 * with share 0, so history never silently folds into the main row.
 */
export function contributorSplitStatus(customer, bill, { price = null, payments = null } = {}) {
  const contributors = subContributorsOf(customer);
  if (contributors.length === 0) return null;
  const billPayments = Array.isArray(payments) ? payments : (Array.isArray(bill?.payments) ? bill.payments : []);
  const explicitPrice = Number(price);
  const billPrice = Number(bill?.dueAmount);
  const priceCents = Number.isFinite(explicitPrice) && explicitPrice > 0
    ? centsOf(explicitPrice)
    : Number.isFinite(billPrice) && billPrice > 0 ? centsOf(billPrice) : 0;

  const contributorIds = new Set(contributors.map((entry) => entry.id));
  const paidById = new Map();
  const orphanPaid = new Map();
  let mainPaidCents = 0;
  for (const payment of billPayments) {
    if (!payment || typeof payment !== 'object') continue;
    if (payment.voided === true) continue; // SISP-34: a voided receipt is not a payment anymore.
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const amountCents = centsOf(amount);
    const stamp = sanitizePaidByContributorStamp(payment.paidByContributor);
    if (stamp && contributorIds.has(stamp.id)) {
      paidById.set(stamp.id, (paidById.get(stamp.id) ?? 0) + amountCents);
    } else if (stamp) {
      const prev = orphanPaid.get(stamp.id);
      orphanPaid.set(stamp.id, { id: stamp.id, name: stamp.name, paidCents: (prev?.paidCents ?? 0) + amountCents });
    } else {
      mainPaidCents += amountCents;
    }
  }

  const sharesSumCents = contributors.reduce((sum, entry) => sum + centsOf(entry.sharePKR), 0);
  const mainShareCents = Math.max(0, priceCents - sharesSumCents);
  const rows = contributors.map((entry) => {
    const shareCents = centsOf(entry.sharePKR);
    const paidCents = paidById.get(entry.id) ?? 0;
    return {
      kind: 'contributor',
      id: entry.id,
      name: entry.name,
      phone: entry.phone,
      share: moneyOf(shareCents),
      paid: moneyOf(paidCents),
      remaining: moneyOf(Math.max(0, shareCents - paidCents))
    };
  });
  for (const orphan of orphanPaid.values()) {
    rows.push({
      kind: 'contributor',
      id: orphan.id,
      name: orphan.name,
      phone: '',
      share: 0,
      paid: moneyOf(orphan.paidCents),
      remaining: 0,
      removed: true
    });
  }
  return {
    month: typeof bill?.month === 'string' ? bill.month : '',
    price: moneyOf(priceCents),
    sharesSum: moneyOf(sharesSumCents),
    // Soft-warning state for the profile: the shares were expected to
    // describe the whole package price. Only meaningful when a positive
    // price is known; the warning never blocks anything.
    sharesMismatch: priceCents > 0 && sharesSumCents !== priceCents,
    rows,
    main: {
      kind: 'main',
      id: null,
      name: cleanStampName(customer?.name),
      share: moneyOf(mainShareCents),
      paid: moneyOf(mainPaidCents),
      remaining: moneyOf(Math.max(0, mainShareCents - mainPaidCents))
    }
  };
}
