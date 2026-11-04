// Plan 110 (Plan 101-202) — Discount and waiver approval limits.
//
// Any operator can grant any discount or waiver today, so a generous
// month by one person becomes a precedent nobody approved. This record
// fixes that without granting anything itself: it writes down who may
// approve how much, requires a reason for every discount or waiver,
// and puts an expiry date on every approval, so a large giveaway stays
// an owner decision with a paper trail.
//
// What this module is NOT:
//   - It grants no discount and no waiver. Checking a posting only
//     answers allowed/refused; the discount itself is still given
//     through its own existing path, never here.
//   - It does not change the promotional offer path (Plan 98) or the
//     dispute sign-off (Plan 64). Neither is read or rewritten here;
//     this module names no promotional offer and no dispute record.
//   - It never rewrites a past bill or a past discount. Approvals are
//     a separate review list; a recorded approval is never edited in
//     place (a duplicate id is refused, and there is no edit function).
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Money is integer cents throughout; a *Cents figure is used
// as-is, while a plain rupees figure converts to cents exactly once
// on the way in.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  return `${sign}PKR ${Math.abs(cents / 100).toLocaleString('en-US')}`;
}

function toCents(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100);
  }
  const text = cleanText(value);
  if (text === '') return null;
  const num = Number(text);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

/** A strict YYYY-MM-DD date that really exists on the calendar. */
export function validApprovalDate(value) {
  const text = cleanText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (day > (leap ? 29 : 28)) return false;
  } else if (day > daysInMonth) {
    return false;
  }
  return true;
}

/** Discount/waiver kinds, in catalogue order. */
export const APPROVAL_KINDS = ['discount', 'waiver'];

export const APPROVAL_KIND_LABELS = {
  discount: 'Discount',
  waiver: 'Waiver',
};

/** One approval tier: who may approve, up to what amount. */
export function normalizeTier(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const role = cleanText(raw.role);
  if (!id || !role) return null;
  // A *Cents figure is used as-is; a plain rupees figure converts once.
  const upToCents =
    raw.upToCents !== undefined && raw.upToCents !== null && raw.upToCents !== ''
      ? Math.round(Number(raw.upToCents))
      : raw.upTo !== undefined && raw.upTo !== null && raw.upTo !== ''
        ? toCents(raw.upTo)
        : null;
  if (upToCents === null || !Number.isFinite(upToCents) || upToCents <= 0) return null;
  return { id, role, upToCents };
}

export function normalizeTierList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const tier = normalizeTier(item);
    if (!tier || seen.has(tier.id)) continue;
    seen.add(tier.id);
    out.push(tier);
  }
  return out.sort((a, b) => a.upToCents - b.upToCents);
}

/** Add a tier; a duplicate id leaves the list exactly unchanged. */
export function upsertTier(list, raw) {
  const tiers = normalizeTierList(list);
  const tier = normalizeTier(raw);
  if (!tier) return tiers;
  if (tiers.some((item) => item.id === tier.id)) return tiers;
  return normalizeTierList([...tiers, tier]);
}

export function removeTier(list, id) {
  return normalizeTierList(list).filter((item) => item.id !== cleanText(id));
}

export function findTier(list, id) {
  return normalizeTierList(list).find((item) => item.id === cleanText(id)) || null;
}

/**
 * The smallest tier whose limit covers the amount, or null when no
 * tier covers it. Exactly at a tier's limit is covered by that tier;
 * one cent over it moves to the next tier (or to null).
 */
export function tierForAmount(list, amountCents) {
  const tiers = normalizeTierList(list);
  const amount = typeof amountCents === 'number' ? amountCents : toCents(amountCents);
  if (amount === null || amount <= 0) return null;
  return tiers.find((tier) => amount <= tier.upToCents) || null;
}

/** One recorded approval: tier, approver, and reason are mandatory. */
export function normalizeApproval(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const customerId = cleanText(raw.customerId);
  const kind = cleanText(raw.kind);
  const tierId = cleanText(raw.tierId);
  const approver = cleanText(raw.approver);
  const reason = cleanText(raw.reason);
  if (!id || !customerId || !APPROVAL_KINDS.includes(kind)) return null;
  if (!tierId || !approver || !reason) return null;
  // A *Cents figure is used as-is; a plain rupees figure converts once.
  const amountCents =
    raw.amountCents !== undefined && raw.amountCents !== null && raw.amountCents !== ''
      ? Math.round(Number(raw.amountCents))
      : raw.amount !== undefined && raw.amount !== null && raw.amount !== ''
        ? toCents(raw.amount)
        : null;
  if (amountCents === null || !Number.isFinite(amountCents) || amountCents <= 0) return null;
  const date = cleanText(raw.date);
  const expiresDate = cleanText(raw.expiresDate);
  if (!validApprovalDate(date) || !validApprovalDate(expiresDate)) return null;
  if (expiresDate < date) return null;
  return {
    id,
    customerId,
    customerName: cleanText(raw.customerName),
    kind,
    tierId,
    approver,
    reason,
    amountCents,
    date,
    expiresDate,
  };
}

export function normalizeApprovalList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const approval = normalizeApproval(item);
    if (!approval || seen.has(approval.id)) continue;
    seen.add(approval.id);
    out.push(approval);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Record an approval; a duplicate id, or a half-formed record, leaves
 * the list exactly unchanged (returns null when nothing was recorded).
 */
export function addApproval(list, raw) {
  const approvals = normalizeApprovalList(list);
  const approval = normalizeApproval(raw);
  if (!approval) return null;
  if (approvals.some((item) => item.id === approval.id)) return null;
  return normalizeApprovalList([...approvals, approval]);
}

export function findApproval(list, id) {
  return normalizeApprovalList(list).find((item) => item.id === cleanText(id)) || null;
}

export function approvalsForCustomer(list, customerId) {
  return normalizeApprovalList(list).filter((item) => item.customerId === cleanText(customerId));
}

/** An approval is expired the day after its expiry date, not on it. */
export function approvalExpired(approval, onDate) {
  const item = normalizeApproval(approval);
  if (!item) return true;
  const date = cleanText(onDate);
  if (!validApprovalDate(date)) return true;
  return date > item.expiresDate;
}

/**
 * Approvals for review, oldest first, each carrying its expired flag
 * on the supplied review date. Filters by customer and/or kind.
 */
export function approvalsForReview(list, { customerId = '', kind = '', onDate = '' } = {}) {
  let rows = normalizeApprovalList(list);
  if (customerId) rows = rows.filter((item) => item.customerId === cleanText(customerId));
  if (kind) rows = rows.filter((item) => item.kind === cleanText(kind));
  return rows.map((item) => ({ ...item, expired: approvalExpired(item, onDate) }));
}

/**
 * The posting gate. A discount or waiver may be posted when:
 *   - a reason is recorded, and
 *   - either the operator's own tier covers the amount, or
 *   - a recorded, unexpired approval names the same kind, covers at
 *     least the amount, and its tier covers the amount.
 * Anything else is refused, and nothing is written anywhere: this
 * function only answers allowed/refused with the reason why.
 */
export function checkPosting({ tiers = [], operatorTierId = '', amountCents = null, kind = '', reason = '', approvals = [], date = '' } = {}) {
  const tierList = normalizeTierList(tiers);
  const amount = typeof amountCents === 'number' ? amountCents : toCents(amountCents);
  const cleanKind = cleanText(kind);
  const cleanReason = cleanText(reason);
  if (amount === null || amount <= 0) {
    return { allowed: false, tier: null, refusal: 'Amount must be a positive figure.' };
  }
  if (!APPROVAL_KINDS.includes(cleanKind)) {
    return { allowed: false, tier: null, refusal: 'Kind must be a discount or a waiver.' };
  }
  if (!cleanReason) {
    return { allowed: false, tier: null, refusal: 'A reason is required for every discount or waiver.' };
  }
  if (!validApprovalDate(date)) {
    return { allowed: false, tier: null, refusal: 'A real posting date is required.' };
  }
  const operatorTier = findTier(tierList, operatorTierId);
  if (!operatorTier) {
    return { allowed: false, tier: null, refusal: 'The operator tier is not recorded in the limits.' };
  }
  if (amount <= operatorTier.upToCents) {
    return { allowed: true, tier: operatorTier, refusal: '' };
  }
  const covering = normalizeApprovalList(approvals).find((item) => {
    if (item.kind !== cleanKind) return false;
    if (item.amountCents < amount) return false;
    const approvalTier = findTier(tierList, item.tierId);
    if (!approvalTier || amount > approvalTier.upToCents) return false;
    if (approvalExpired(item, date)) return false;
    return true;
  });
  if (!covering) {
    return {
      allowed: false,
      tier: tierForAmount(tierList, amount),
      refusal: 'Above the operator tier: a higher approval covering this amount, with a reason, must be recorded first.',
    };
  }
  return { allowed: true, tier: findTier(tierList, covering.tierId), refusal: '' };
}

export function approvalSummaryText(approvals) {
  const rows = normalizeApprovalList(approvals);
  if (rows.length === 0) return 'No approvals recorded yet.';
  const discounts = rows.filter((item) => item.kind === 'discount').length;
  const waivers = rows.length - discounts;
  const total = rows.reduce((sum, item) => sum + item.amountCents, 0);
  return `${rows.length} approval${rows.length === 1 ? '' : 's'} recorded (${discounts} discount${discounts === 1 ? '' : 's'}, ${waivers} waiver${waivers === 1 ? '' : 's'}), totalling ${formatMoney(total)}.`;
}

export function tierHtml(tier) {
  const item = normalizeTier(tier);
  if (!item) return '';
  return `<p><strong>${escapeHtml(item.role)}</strong> — approves up to ${escapeHtml(formatMoney(item.upToCents))}</p>`;
}

export function approvalHtml(approval) {
  const item = normalizeApproval(approval);
  if (!item) return '';
  const name = item.customerName || item.customerId;
  return `<p><strong>${escapeHtml(APPROVAL_KIND_LABELS[item.kind])}</strong> ${escapeHtml(formatMoney(item.amountCents))} · ${escapeHtml(name)} · tier ${escapeHtml(item.tierId)} · approved by ${escapeHtml(item.approver)} · ${escapeHtml(item.date)} to ${escapeHtml(item.expiresDate)} · ${escapeHtml(item.reason)}</p>`;
}

export function approvalCsv(approvals) {
  const rows = normalizeApprovalList(approvals);
  const header = 'id,customer,kind,tier,approver,reason,amount_cents,date,expires_date';
  const lines = rows.map((item) =>
    [item.id, item.customerId, item.kind, item.tierId, item.approver, item.reason, item.amountCents, item.date, item.expiresDate]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function approvalFilename() {
  return 'approval-limits.csv';
}
