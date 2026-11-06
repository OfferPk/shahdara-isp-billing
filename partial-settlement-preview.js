// Transaction partial settlement preview (Plan 385): while the
// operator types a part-payment on the transaction entry form, the
// preview shows which bills the typed amount will settle — which in
// full, which partly, and what remains on each — so the customer
// hears, before paying, exactly which months this money settles.
//
// The preview is computed from the allocation rules (Plan 102):
// the payment lands on the target bill first, and whatever is left
// flows forward to later bills in month order. Bills before the
// target month are never touched by this payment — the engine never
// applies a payment backwards — so they never appear in the preview.
// An advance-tagged payment reserves its leftover for the advance
// target month instead: after the target bill, the leftover only
// reaches bills at or after that month, exactly as the engine holds
// reserved credit until the target month arrives.
//
// The preview only reads. It settles nothing, reserves no number,
// and changes no bill, payment, or customer record by itself: the
// caller supplies the pre-save balances from the allocation engine
// and the typed amount, and previewing twice returns the same lines
// with the records byte-identical. It builds no second allocator and
// changes no allocation rule: it walks the engine's own remaining
// balances in the engine's own order.
//
// The module never reads storage, the clock, the network, or the
// page. Inputs are never mutated. Money is integer cents throughout,
// PKR only, never converted.

const STRICT_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function formatAmountDefault(cents) {
  const rupees = Math.round(cents) / 100;
  return `PKR ${rupees.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function validMonth(value) {
  return typeof value === 'string' && STRICT_MONTH.test(value) ? value : '';
}

function positiveCents(value) {
  const cents = Math.round(Number(value));
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}

/** A strict YYYY-MM month as "November 2026", or '' when unusable. */
export function settlementPreviewMonthLabel(month) {
  const match = STRICT_MONTH.exec(String(month || ''));
  if (!match) return '';
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

/**
 * Walk the typed amount over the customer's open bills and say, per
 * bill, how much of it settles that bill and what remains on it.
 *
 * Input: { bills, targetMonth, amountCents, advanceTargetMonth }.
 * bills is the customer's priced bills as { month, balanceDueCents },
 * in any order — one entry per month is enough, duplicates merge by
 * summing their remaining balances, and entries with no usable month
 * or no positive remaining balance are left out, never guessed.
 * targetMonth is the bill month the payment will be recorded on.
 * amountCents is the typed amount in integer cents. advanceTargetMonth
 * is the advance target month when the payment is advance-tagged, or
 * '' when it is not.
 *
 * Returns { lines, leftoverCents, totalAppliedCents }. Each line is
 * { month, balanceDueCents, appliedCents, remainingCents, status },
 * with status 'settled' when the applied amount covers the whole
 * remaining balance and 'partial' when part of it stays open. Lines
 * run in the order the money reaches them: the target bill first,
 * then later bills in month order. leftoverCents is the typed amount
 * no open bill takes. An amount that is not a positive number, a
 * target month that is not strict YYYY-MM, or a customer with no
 * open bill previews nothing at all.
 */
export function settlementPreview(input) {
  const empty = { lines: [], leftoverCents: 0, totalAppliedCents: 0 };
  if (!input || typeof input !== 'object') return empty;
  const amountCents = positiveCents(input.amountCents);
  if (amountCents <= 0) return empty;
  const targetMonth = validMonth(input.targetMonth);
  if (!targetMonth) return empty;
  const advanceTargetMonth = validMonth(input.advanceTargetMonth);

  // One row per month, oldest first; duplicate months merge by
  // summing what is still owed, so a month is never counted twice.
  const byMonth = new Map();
  for (const bill of Array.isArray(input.bills) ? input.bills : []) {
    const month = validMonth(bill?.month);
    const balance = positiveCents(bill?.balanceDueCents);
    if (!month || balance <= 0) continue;
    byMonth.set(month, (byMonth.get(month) ?? 0) + balance);
  }
  const open = [...byMonth.entries()]
    .map(([month, balanceDueCents]) => ({ month, balanceDueCents }))
    .sort((a, b) => a.month.localeCompare(b.month));
  if (open.length === 0) return empty;

  // The order the money reaches the bills: the target bill first,
  // then later bills in month order. An advance-tagged payment holds
  // its leftover back until the advance target month, so later bills
  // before that month never see it.
  const ordered = [];
  const target = open.find((bill) => bill.month === targetMonth);
  if (target) ordered.push(target);
  for (const bill of open) {
    if (bill.month <= targetMonth) continue;
    if (advanceTargetMonth && bill.month < advanceTargetMonth) continue;
    ordered.push(bill);
  }

  let left = amountCents;
  const lines = [];
  for (const bill of ordered) {
    if (left <= 0) break;
    const appliedCents = Math.min(left, bill.balanceDueCents);
    if (appliedCents <= 0) continue;
    lines.push({
      month: bill.month,
      balanceDueCents: bill.balanceDueCents,
      appliedCents,
      remainingCents: bill.balanceDueCents - appliedCents,
      status: appliedCents === bill.balanceDueCents ? 'settled' : 'partial',
    });
    left -= appliedCents;
  }
  return { lines, leftoverCents: left, totalAppliedCents: amountCents - left };
}

/**
 * One preview line in plain words, for reading aloud to the customer:
 * "November 2026: PKR 3,000 settled in full" or "October 2026:
 * PKR 1,500 of PKR 3,000 — PKR 1,500 remains".
 */
export function settlementPreviewLineText(line, formatAmount = formatAmountDefault) {
  if (!line || typeof line !== 'object') return '';
  const label = settlementPreviewMonthLabel(line.month);
  if (!label) return '';
  const applied = formatAmount(line.appliedCents);
  if (line.status === 'settled') return `${label}: ${applied} settled in full`;
  return `${label}: ${applied} of ${formatAmount(line.balanceDueCents)} — ${formatAmount(line.remainingCents)} remains`;
}

/**
 * The leftover amount in plain words: what the typed amount leaves
 * after every open bill it reaches. An advance-tagged payment names
 * the month the leftover is reserved for; an ordinary payment says
 * only that it is left over after all open bills — never an advance,
 * never a credit, because that choice is a later plan's.
 */
export function settlementPreviewLeftoverText(leftoverCents, advanceTargetMonth = '', formatAmount = formatAmountDefault) {
  const leftover = positiveCents(leftoverCents);
  if (leftover <= 0) return '';
  const target = settlementPreviewMonthLabel(advanceTargetMonth);
  if (target) return `${formatAmount(leftover)} left over — reserved for ${target}`;
  return `${formatAmount(leftover)} left over after all open bills`;
}

/**
 * The preview as escaped HTML for the entry form, or '' when there
 * is nothing to show. Every value is escaped, so a damaged record
 * can never inject markup into the form.
 */
export function settlementPreviewMarkup(preview, advanceTargetMonth = '', formatAmount = formatAmountDefault) {
  if (!preview || !Array.isArray(preview.lines) || preview.lines.length === 0) return '';
  const items = preview.lines
    .map((line) => `<li>${escapeHtml(settlementPreviewLineText(line, formatAmount))}</li>`)
    .join('');
  const leftover = settlementPreviewLeftoverText(preview.leftoverCents, advanceTargetMonth, formatAmount);
  const leftoverItem = leftover ? `<li>${escapeHtml(leftover)}</li>` : '';
  return `<ul class="psp-lines">${items}${leftoverItem}</ul>`;
}
