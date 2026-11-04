// Plan 113 (Plan 101-202) — Downgrade and unused-days credit record.
//
// When a customer downgrades mid-month after paying for the higher
// package, the unused days were forgotten or credited informally,
// with no figure the customer could check. This module is that
// record only: one unused-days credit record per downgrade, naming
// the old package, the new package, the days unused, the daily rate,
// and the credit amount, with its arithmetic shown in plain words.
//
// What already existed, checked first:
//   - The customer credit balance (Plan 103) is the only way credit
//     reaches a bill: a credit here is applied only by naming the
//     bill it settles, and the operator records that credit through
//     the credit balance. This module never opens that record
//     itself; it only names the bill, so the two records agree
//     without either one rewriting the other.
//   - A goodwill credit for an outage is a different record (Plan
//     93) and a promotional benefit is a different record (Plan
//     98). Neither is read or written here, and neither identifier
//     appears in this module.
//   - The original payment and the downgrade itself are never
//     rewritten: this module keeps only its own credit list, and
//     every function returns new arrays and objects, never mutating
//     its inputs.
//
// The fences, stated plainly:
//   - A credit record is refused outright when it is half-formed:
//     no id, no customer, no old or new package, the same package
//     twice (that is not a downgrade), an impossible date, days
//     unused that is not a positive whole number, a daily rate
//     that is not positive, or no amount paid for the unused days.
//     Unknown fields are dropped, so a credit record can never grow
//     a payment, bill, or price field.
//   - The credit never exceeds the amount paid for the unused
//     days: credit = days unused x daily rate, capped at the amount
//     paid for those days. A stored credit figure that disagrees
//     with its own inputs is refused, never silently corrected.
//   - A credit names the bill it is applied to, and only by an
//     operator-recorded application: applying to no bill, to an
//     unknown credit, or to a credit already applied is refused
//     and the lists are left exactly unchanged. Clearing an
//     application only clears the bill link; the credit itself
//     stays. An applied credit cannot be removed while it is
//     linked to a bill.
//   - Money is integer cents: a *Cents field is already in cents
//     and is used as-is; a plain amount field is rupees and
//     converts at x100 once, so a stored record re-read through
//     the normaliser never inflates a hundredfold. Dates are strict
//     YYYY-MM-DD calendar dates (2026-02-30 is not a date). The
//     module never reads storage, the DOM, the clock, or the
//     network, and it imports nothing.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validDowngradeCreditDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `*Cents` integer is used as-is, while a plain amount is always
 * rupees and converts exactly once (x100). Anything else is null.
 */
export function downgradeCreditAmountCents(record, centsKey, plainKey) {
  if (!record || typeof record !== 'object') return null;
  if (Number.isInteger(record[centsKey])) return record[centsKey];
  const plain = record[plainKey];
  if (typeof plain === 'number' && Number.isFinite(plain)) return Math.round(plain * 100);
  if (typeof plain === 'string' && plain.trim() !== '') {
    const parsed = Number(plain.trim());
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

/** days unused x daily rate, capped at the amount paid for those days. */
export function computeDowngradeCreditCents(daysUnused, dailyRateCents, paidForUnusedDaysCents) {
  if (!Number.isInteger(daysUnused) || daysUnused <= 0) return null;
  if (!Number.isInteger(dailyRateCents) || dailyRateCents <= 0) return null;
  if (!Number.isInteger(paidForUnusedDaysCents) || paidForUnusedDaysCents <= 0) return null;
  return Math.min(daysUnused * dailyRateCents, paidForUnusedDaysCents);
}

export function normalizeDowngradeCredit(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customerId = cleanText(record.customerId);
  const oldPackage = cleanText(record.oldPackage);
  const newPackage = cleanText(record.newPackage);
  if (!id || !customerId || !oldPackage || !newPackage) return null;
  if (oldPackage.toLowerCase() === newPackage.toLowerCase()) return null;
  const downgradeDate = cleanText(record.downgradeDate);
  if (downgradeDate !== '' && !validDowngradeCreditDate(downgradeDate)) return null;
  const daysUnused = record.daysUnused;
  if (!Number.isInteger(daysUnused) || daysUnused <= 0) return null;
  const dailyRateCents = downgradeCreditAmountCents(record, 'dailyRateCents', 'dailyRate');
  const paidCents = downgradeCreditAmountCents(record, 'paidForUnusedDaysCents', 'paidForUnusedDays');
  if (dailyRateCents === null || dailyRateCents <= 0) return null;
  if (paidCents === null || paidCents <= 0) return null;
  const creditCents = computeDowngradeCreditCents(daysUnused, dailyRateCents, paidCents);
  if (creditCents === null) return null;
  // A stored credit figure that disagrees with its own inputs is
  // refused, never silently corrected.
  const supplied = downgradeCreditAmountCents(record, 'creditCents', 'creditAmount');
  if (supplied !== null && supplied !== creditCents) return null;
  const appliedBillId = cleanText(record.appliedBillId);
  return {
    id,
    customerId,
    customerName: cleanText(record.customerName),
    oldPackage,
    newPackage,
    downgradeDate,
    daysUnused,
    dailyRateCents,
    paidForUnusedDaysCents: paidCents,
    creditCents,
    appliedBillId,
    note: cleanText(record.note),
  };
}

export function normalizeDowngradeCreditList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const normalized = normalizeDowngradeCredit(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

export function findDowngradeCredit(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeDowngradeCreditList(list).find((c) => c.id === clean) || null;
}

/**
 * Add a credit record. A record with an id already on the list is
 * refused when it differs from the stored record, and left exactly
 * unchanged when it is identical — a credit, once written, is never
 * quietly rewritten.
 */
export function upsertDowngradeCredit(list, record) {
  const normalized = normalizeDowngradeCredit(record);
  const current = normalizeDowngradeCreditList(list);
  if (!normalized) return current;
  const existing = current.find((c) => c.id === normalized.id);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(normalized)) return current;
    return current;
  }
  return [...current, normalized];
}

/** Remove an unapplied credit. An applied credit stays linked to its bill. */
export function removeDowngradeCredit(list, id) {
  const clean = cleanText(id);
  const current = normalizeDowngradeCreditList(list);
  if (!clean) return current;
  const target = current.find((c) => c.id === clean);
  if (!target || target.appliedBillId) return current;
  return current.filter((c) => c.id !== clean);
}

export function creditsForCustomer(list, customerId) {
  const clean = cleanText(customerId);
  if (!clean) return [];
  return normalizeDowngradeCreditList(list).filter((c) => c.customerId === clean);
}

export function appliedDowngradeCredits(list) {
  return normalizeDowngradeCreditList(list).filter((c) => c.appliedBillId !== '');
}

export function unappliedDowngradeCredits(list) {
  return normalizeDowngradeCreditList(list).filter((c) => c.appliedBillId === '');
}

export function totalDowngradeCreditsCents(list) {
  return normalizeDowngradeCreditList(list).reduce((sum, c) => sum + c.creditCents, 0);
}

/**
 * Record that a credit is applied to a bill. Refused when the credit
 * is unknown, the bill id is blank, or the credit is already
 * applied — the lists are then left exactly unchanged.
 */
export function applyDowngradeCredit(list, id, billId) {
  const cleanId = cleanText(id);
  const cleanBill = cleanText(billId);
  const current = normalizeDowngradeCreditList(list);
  if (!cleanId || !cleanBill) return current;
  const target = current.find((c) => c.id === cleanId);
  if (!target || target.appliedBillId) return current;
  return current.map((c) => (c.id === cleanId ? { ...c, appliedBillId: cleanBill } : c));
}

/** Clear a bill link only; the credit record itself stays untouched. */
export function clearDowngradeCreditApplication(list, id) {
  const clean = cleanText(id);
  const current = normalizeDowngradeCreditList(list);
  if (!clean) return current;
  return current.map((c) => (c.id === clean ? { ...c, appliedBillId: '' } : c));
}

function formatRs(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

export function downgradeCreditArithmeticText(credit) {
  const normalized = normalizeDowngradeCredit(credit);
  if (!normalized) return 'Credit not recorded: its inputs are incomplete.';
  const raw = normalized.daysUnused * normalized.dailyRateCents;
  const capped = raw > normalized.paidForUnusedDaysCents;
  const base = `${normalized.daysUnused} unused days x ${formatRs(normalized.dailyRateCents)} per day = ${formatRs(raw)}`;
  return capped
    ? `${base}, capped at the amount paid for those days (${formatRs(normalized.paidForUnusedDaysCents)}) = credit ${formatRs(normalized.creditCents)}`
    : `${base} = credit ${formatRs(normalized.creditCents)}`;
}

export function downgradeCreditSummaryText(list) {
  const credits = normalizeDowngradeCreditList(list);
  if (credits.length === 0) return 'No downgrade credits recorded yet.';
  const applied = appliedDowngradeCredits(credits).length;
  return `${credits.length} downgrade credit${credits.length === 1 ? '' : 's'} totalling ${formatRs(totalDowngradeCreditsCents(credits))}; ${applied} applied to a bill, ${credits.length - applied} unapplied.`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downgradeCreditHtml(credit) {
  const normalized = normalizeDowngradeCredit(credit);
  if (!normalized) return '<p>Credit not recorded: its inputs are incomplete.</p>';
  const who = normalized.customerName || normalized.customerId;
  const applied = normalized.appliedBillId
    ? `Applied to bill ${escapeHtml(normalized.appliedBillId)}`
    : 'Not yet applied to any bill — record it through the customer credit balance when it settles a bill.';
  const datePart = normalized.downgradeDate ? ` · downgraded ${escapeHtml(normalized.downgradeDate)}` : '';
  const notePart = normalized.note ? ` · ${escapeHtml(normalized.note)}` : '';
  return `<div>${escapeHtml(who)}: ${escapeHtml(normalized.oldPackage)} → ${escapeHtml(normalized.newPackage)}${datePart} · ${escapeHtml(downgradeCreditArithmeticText(normalized))} · ${applied}${notePart}</div>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downgradeCreditCsv(list) {
  const credits = normalizeDowngradeCreditList(list);
  const header = 'id,customer,old package,new package,downgrade date,days unused,daily rate (Rs),amount paid for unused days (Rs),credit (Rs),applied bill id,note';
  const rows = credits.map((c) => [
    c.id,
    c.customerName || c.customerId,
    c.oldPackage,
    c.newPackage,
    c.downgradeDate,
    c.daysUnused,
    (c.dailyRateCents / 100).toFixed(2),
    (c.paidForUnusedDaysCents / 100).toFixed(2),
    (c.creditCents / 100).toFixed(2),
    c.appliedBillId,
    c.note,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function downgradeCreditFilename() {
  return 'downgrade-credits.csv';
}
