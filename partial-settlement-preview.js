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
// Plan 626: the preview counts the pending charges too — manual
// baqaya, ticket charges and speed-boost fees the caller already
// planned with the save's own planners — so a payment of exactly
// the payable total no longer previews the charge money as
// "left over". The leftover after the bill walk feeds the planned
// charges in engine order; a charge settles only in full, never
// split, exactly as the planners settle it on save.
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
 * Input: { bills, targetMonth, amountCents, advanceTargetMonth, charges }.
 * bills is the customer's priced bills as { month, balanceDueCents },
 * in any order — one entry per month is enough, duplicates merge by
 * summing their remaining balances, and entries with no usable month
 * or no positive remaining balance are left out, never guessed.
 * targetMonth is the bill month the payment will be recorded on.
 * amountCents is the typed amount in integer cents. advanceTargetMonth
 * is the advance target month when the payment is advance-tagged, or
 * '' when it is not.
 * charges (Plan 626) is an optional array of already-planned charges
 * as { label, amountCents, balanceCents } — the amount this payment
 * settles on that charge and the charge's full remaining balance
 * (equal for whole-only ticket/addon charges; larger for a
 * part-settled baqaya entry) — in the engine settle order (baqaya,
 * ticket, addon). The caller plans them with the save's own
 * planners against the save's remainder, so they are never guessed
 * here: the module only walks the bill-walk leftover over them.
 *
 * Returns { lines, leftoverCents, totalAppliedCents } — plus a
 * chargeLines field ONLY when charges settle, so a bill-only preview
 * keeps the exact pinned shape. Each line is
 * { month, balanceDueCents, appliedCents, remainingCents, status },
 * with status 'settled' when the applied amount covers the whole
 * remaining balance and 'partial' when part of it stays open. Each
 * charge line is { label, amountCents, balanceCents, appliedCents,
 * remainingCents, status } with the same settled/partial rule.
 * Lines run in the order the money reaches them: the target bill first,
 * then later bills in month order, then the planned charges in engine
 * order. leftoverCents is the typed amount no open bill or planned
 * charge takes. An amount that is not a positive number, a target
 * month that is not strict YYYY-MM, or a customer with no open bill
 * and no planned charge previews nothing at all.
 */

/**
 * Walk a leftover over already-planned charges, in engine order.
 * A charge settles only in full — the caller planned it against
 * the save's remainder, which never exceeds the leftover the bill
 * walk leaves, so every planned charge settles here; the guard only
 * protects a caller that hands the module more than the walk
 * leaves. Returns the settled charge lines and the leftover after
 * them. A charge line never claims a full settlement it did not
 * make: a part-settled baqaya entry reads as partial.
 */
function walkPlannedCharges(plannedCharges, leftoverCents) {
  const chargeLines = [];
  let left = leftoverCents;
  for (const charge of plannedCharges) {
    if (left < charge.amountCents) break;
    chargeLines.push({
      label: charge.label,
      amountCents: charge.amountCents,
      balanceCents: charge.balanceCents,
      appliedCents: charge.amountCents,
      remainingCents: charge.balanceCents - charge.amountCents,
      status: charge.amountCents === charge.balanceCents ? 'settled' : 'partial',
    });
    left -= charge.amountCents;
  }
  return { chargeLines, leftoverCents: left };
}

export function settlementPreview(input) {
  const empty = { lines: [], leftoverCents: 0, totalAppliedCents: 0 };
  if (!input || typeof input !== 'object') return empty;
  const amountCents = positiveCents(input.amountCents);
  if (amountCents <= 0) return empty;
  const targetMonth = validMonth(input.targetMonth);
  if (!targetMonth) return empty;
  const advanceTargetMonth = validMonth(input.advanceTargetMonth);

  // Plan 626: keep only usable planned charges — a charge with no
  // label or no positive amount is left out, never guessed.
  const plannedCharges = [];
  for (const charge of Array.isArray(input.charges) ? input.charges : []) {
    const amount = positiveCents(charge?.amountCents);
    const label = typeof charge?.label === 'string' ? charge.label : '';
    if (!label || amount <= 0) continue;
    const balance = positiveCents(charge?.balanceCents) || amount;
    plannedCharges.push({ label, amountCents: amount, balanceCents: balance });
  }

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
  if (open.length === 0) {
    // Plan 626: no open bill — but a planned charge still settles
    // from the whole amount (the save's remainder is the amount
    // minus zero dues). Without planned charges the preview is
    // nothing at all, exactly as before.
    if (plannedCharges.length === 0) return empty;
    const walked = walkPlannedCharges(plannedCharges, amountCents);
    if (walked.chargeLines.length === 0) return empty;
    return {
      lines: [],
      chargeLines: walked.chargeLines,
      leftoverCents: walked.leftoverCents,
      totalAppliedCents: amountCents - walked.leftoverCents,
    };
  }

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
  // Plan 626: the leftover after the bill walk feeds the planned
  // charges in engine order.
  const walked = walkPlannedCharges(plannedCharges, left);
  const result = {
    lines,
    leftoverCents: walked.leftoverCents,
    totalAppliedCents: amountCents - walked.leftoverCents,
  };
  // The chargeLines field appears only when charges settle — a
  // bill-only preview keeps the exact pinned shape { lines,
  // leftoverCents, totalAppliedCents } (Plan 385 deepEqual).
  if (walked.chargeLines.length > 0) result.chargeLines = walked.chargeLines;
  return result;
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
 * One settled charge in plain words, for reading aloud to the
 * customer (Plan 626): "Ticket charge (TKT-1042): PKR 500 settled
 * in full" or "Manual baqaya (MBQ-101): PKR 150 of PKR 300 —
 * PKR 150 remains". A charge line never claims a full settlement
 * it did not make: a part-settled baqaya entry reads as partial,
 * exactly like a bill line. Module-private on purpose — the
 * markup is its only caller, and the module keeps exactly the
 * five exports Plan 385 pins.
 */
function settlementPreviewChargeLineText(chargeLine, formatAmount = formatAmountDefault) {
  if (!chargeLine || typeof chargeLine !== 'object') return '';
  const label = typeof chargeLine.label === 'string' ? chargeLine.label : '';
  if (!label) return '';
  const applied = formatAmount(chargeLine.appliedCents);
  if (chargeLine.status === 'settled') return `${label}: ${applied} settled in full`;
  return `${label}: ${applied} of ${formatAmount(chargeLine.balanceCents)} — ${formatAmount(chargeLine.remainingCents)} remains`;
}

/**
 * The leftover amount in plain words: what the typed amount leaves
 * after every open bill it reaches. An advance-tagged payment names
 * the month the leftover is reserved for; an ordinary payment says
 * only that it is left over after all open bills — never an advance,
 * never a credit, because that choice is a later plan's. Plan 626:
 * once charges settle, "after all open bills" is wrong — the money
 * is left after the bills AND the charges — so the plain wording
 * names both. Callers that pass no fourth argument keep the exact
 * old text.
 */
export function settlementPreviewLeftoverText(leftoverCents, advanceTargetMonth = '', formatAmount = formatAmountDefault, chargesSettled = false) {
  const leftover = positiveCents(leftoverCents);
  if (leftover <= 0) return '';
  const target = settlementPreviewMonthLabel(advanceTargetMonth);
  if (target) return `${formatAmount(leftover)} left over — reserved for ${target}`;
  if (chargesSettled) return `${formatAmount(leftover)} left over after all open bills and charges`;
  return `${formatAmount(leftover)} left over after all open bills`;
}

/**
 * The preview as escaped HTML for the entry form, or '' when there
 * is nothing to show. Every value is escaped, so a damaged record
 * can never inject markup into the form. Plan 626: each settled
 * charge is its own line, in engine order, after the bill lines.
 */
export function settlementPreviewMarkup(preview, advanceTargetMonth = '', formatAmount = formatAmountDefault) {
  const chargeLines = Array.isArray(preview?.chargeLines) ? preview.chargeLines : [];
  if (!preview || !Array.isArray(preview.lines) || (preview.lines.length === 0 && chargeLines.length === 0)) return '';
  const items = preview.lines
    .map((line) => `<li>${escapeHtml(settlementPreviewLineText(line, formatAmount))}</li>`)
    .join('');
  const chargeItems = chargeLines
    .map((line) => `<li>${escapeHtml(settlementPreviewChargeLineText(line, formatAmount))}</li>`)
    .join('');
  const leftover = settlementPreviewLeftoverText(preview.leftoverCents, advanceTargetMonth, formatAmount, chargeLines.length > 0);
  const leftoverItem = leftover ? `<li>${escapeHtml(leftover)}</li>` : '';
  return `<ul class="psp-lines">${items}${chargeItems}${leftoverItem}</ul>`;
}
