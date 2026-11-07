// Plan 415 — History refund entries shown inline.
//
// Refunds live in their own record, and the full history list
// already carries each refund as a row among charges and payments,
// in date order, with its reason in the meta line. What the
// history has never had is one place inside itself where the money
// that came back is gathered: the operator has to hunt through
// the whole list, or open the separate refunds surface, to see
// what was refunded, why, and what it did to the running balance.
// This module adds only that missing piece: one inline display of
// refund entries within the customer history — refund lines in
// date order, each with its reason, and the running balance before
// and after it shown visibly, so the net position is honest and
// complete.
//
// The balance rule is the one the full history list and the
// running-balance column already pin, and this display follows it
// exactly: a refund returns money to the customer, so the amount
// the customer still owes goes UP by the refund — the customer has
// effectively paid less against the charge. Each refund line
// therefore shows the balance before it and the balance after it,
// and the totals footer shows where the balance started and ended
// across the refunds shown. A voided refund moves nothing and is
// marked VOID; it never counts towards the total refunded.
//
// It displays only and records no refund: it reads the entries
// the full history list already composed, in the same date order,
// and it writes to no store. It never changes any bill, payment,
// refund, or customer record.

export const HISTORY_REFUNDS_INLINE_EMPTY_TEXT = 'No transactions yet';

export const HISTORY_REFUNDS_INLINE_NO_REFUNDS_TEXT = 'No refunds';

export const HISTORY_REFUNDS_INLINE_REASON_NOT_RECORDED_TEXT = 'reason not recorded';

export const HISTORY_REFUNDS_INLINE_DATE_NOT_RECORDED_TEXT = 'date not recorded';

export const HISTORY_REFUNDS_INLINE_BALANCE_NOT_RECORDED_TEXT = 'not recorded';

function cleanRefundsInlineKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanRefundsInlineText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function finiteRefundsInlineCents(value) {
  // A missing, boolean or blank figure is not a number, never zero:
  // Number(null) is 0 and Number(true) is 1, and both would invent
  // a refund out of nothing.
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

// Whether one entry is a refund line for this display: typed
// refund with a usable positive amount. A refund entry with no
// usable amount is never zero-filled into a line.
export function historyRefundsInlineIsRefund(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (cleanRefundsInlineKey(entry.type) !== 'refund') return false;
  const amountCents = finiteRefundsInlineCents(entry.amountCents);
  return amountCents !== null && amountCents > 0;
}

// The signed movement of one refund, in cents — the same rule the
// full history list uses for its running balance. A refund adds to
// what is owed; a voided refund is listed but moves nothing. Any
// entry that is not a refund moves nothing here.
export function historyRefundsInlineDelta(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (cleanRefundsInlineKey(entry.type) !== 'refund') return 0;
  if (entry.voided === true) return 0;
  const amountCents = finiteRefundsInlineCents(entry.amountCents);
  if (amountCents === null) return 0;
  return amountCents;
}

// The refund lines of a list, in the order given — the full
// history list already composes its entries in date order, so the
// refunds keep that order here. Each line carries the running
// balance before and after it, taken from the entry's own running
// balance, so the movement the refund caused is visible. A line
// whose running balance is not a number carries no balance at all,
// never a guessed one. The input entries are never mutated.
export function historyRefundsInlineEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const refunds = [];
  for (const entry of entries) {
    if (!historyRefundsInlineIsRefund(entry)) continue;
    const amountCents = finiteRefundsInlineCents(entry.amountCents);
    const balanceAfterCents = finiteRefundsInlineCents(entry.runningBalanceCents);
    const delta = historyRefundsInlineDelta(entry);
    refunds.push({
      date: cleanRefundsInlineText(entry.date),
      reason: cleanRefundsInlineText(entry.note),
      method: cleanRefundsInlineText(entry.method),
      amountCents,
      voided: entry.voided === true,
      balanceBeforeCents: balanceAfterCents === null ? null : balanceAfterCents - delta,
      balanceAfterCents,
    });
  }
  return refunds;
}

// Total refunded over the lines given: money actually returned.
// A voided refund returned nothing, so it never counts here.
export function historyRefundsInlineTotalCents(refunds) {
  if (!Array.isArray(refunds) || refunds.length === 0) return 0;
  let total = 0;
  for (const refund of refunds) {
    if (!refund || typeof refund !== 'object') continue;
    if (refund.voided === true) continue;
    const amountCents = finiteRefundsInlineCents(refund.amountCents);
    if (amountCents === null || amountCents <= 0) continue;
    total += amountCents;
  }
  return total;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatRefundsInlineAmount(cents) {
  const amount = finiteRefundsInlineCents(cents);
  if (amount === null) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function historyRefundsInlineBalanceNote(balanceCents) {
  const balance = finiteRefundsInlineCents(balanceCents);
  if (balance === null) return HISTORY_REFUNDS_INLINE_BALANCE_NOT_RECORDED_TEXT;
  if (balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatRefundsInlineAmount(balance)}`;
  return `Credit ${formatRefundsInlineAmount(-balance)}`;
}

export function historyRefundsInlineLineText(refund) {
  if (!refund || typeof refund !== 'object') return '';
  const date = refund.date ? refund.date : HISTORY_REFUNDS_INLINE_DATE_NOT_RECORDED_TEXT;
  const reason = refund.reason ? refund.reason : HISTORY_REFUNDS_INLINE_REASON_NOT_RECORDED_TEXT;
  const amount = formatRefundsInlineAmount(refund.amountCents);
  const note = historyRefundsInlineBalanceNote(refund.balanceAfterCents);
  const voided = refund.voided === true ? ' · VOID' : '';
  return `${date} · Refund ${amount} · ${reason} · Balance after ${note}${voided}`;
}

export function historyRefundsInlineSummaryText(shownEntries, allEntries) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) {
    return HISTORY_REFUNDS_INLINE_EMPTY_TEXT;
  }
  const refunds = historyRefundsInlineEntries(shownEntries);
  if (refunds.length === 0) return HISTORY_REFUNDS_INLINE_NO_REFUNDS_TEXT;
  const total = historyRefundsInlineTotalCents(refunds);
  const last = refunds[refunds.length - 1];
  const count = refunds.length === 1 ? '1 refund' : `${refunds.length} refunds`;
  const line = `${count} · ${formatRefundsInlineAmount(total)} returned · Balance ${historyRefundsInlineBalanceNote(last.balanceAfterCents)}`;
  const full = Array.isArray(allEntries) ? allEntries : shownEntries;
  if (full.length === shownEntries.length) return line;
  const fullRefunds = historyRefundsInlineEntries(full);
  if (fullRefunds.length === 0) return line;
  const fullTotal = historyRefundsInlineTotalCents(fullRefunds);
  const fullCount = fullRefunds.length === 1 ? '1 refund' : `${fullRefunds.length} refunds`;
  return `${line} · Full history: ${fullCount} · ${formatRefundsInlineAmount(fullTotal)} returned`;
}

function escapeRefundsInlineHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function refundsInlineBalanceCell(balanceCents) {
  if (balanceCents === null) {
    return `<td class="col-num">${escapeRefundsInlineHtml(HISTORY_REFUNDS_INLINE_BALANCE_NOT_RECORDED_TEXT)}</td>`;
  }
  const owedClass = balanceCents > 0 ? 'is-due' : 'is-settled';
  return `<td class="col-num balance-num ${owedClass}">${escapeRefundsInlineHtml(formatRefundsInlineAmount(balanceCents))}</td>`;
}

// The inline refund display: one table over the shown entries,
// one row per refund in date order — date, reason, amount
// refunded, balance before, balance after — plus a totals footer
// taken from the shown refunds, so a filtered view still totals
// only what it shows. When the view is filtered, a second footer
// row carries the full-history totals, so the whole history stays
// checkable. The table reuses the statement table classes the app
// already ships, so it adds no new styles. An empty shown list
// renders nothing; a shown list with no refunds renders a plain
// line saying so.
export function historyRefundsInlineHtml(shownEntries, allEntries) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) return '';
  const refunds = historyRefundsInlineEntries(shownEntries);
  if (refunds.length === 0) {
    return `<p class="notice">${escapeRefundsInlineHtml(HISTORY_REFUNDS_INLINE_NO_REFUNDS_TEXT)}</p>`;
  }
  const total = historyRefundsInlineTotalCents(refunds);
  const body = refunds.map((refund) => {
    const date = refund.date ? refund.date : HISTORY_REFUNDS_INLINE_DATE_NOT_RECORDED_TEXT;
    const reason = refund.reason ? refund.reason : HISTORY_REFUNDS_INLINE_REASON_NOT_RECORDED_TEXT;
    const amount = formatRefundsInlineAmount(refund.amountCents);
    const voided = refund.voided === true ? ' · VOID' : '';
    return `<tr><td>${escapeRefundsInlineHtml(date)}</td><td>${escapeRefundsInlineHtml(reason)}${escapeRefundsInlineHtml(voided)}</td><td class="col-num">${escapeRefundsInlineHtml(amount)}</td>${refundsInlineBalanceCell(refund.balanceBeforeCents)}${refundsInlineBalanceCell(refund.balanceAfterCents)}</tr>`;
  }).join('');
  const first = refunds[0];
  const last = refunds[refunds.length - 1];
  const count = refunds.length === 1 ? '1 refund' : `${refunds.length} refunds`;
  const finalOwedClass = last.balanceAfterCents !== null && last.balanceAfterCents > 0 ? 'is-due' : 'is-settled';
  const finalBalance = last.balanceAfterCents === null
    ? `<td class="col-num">${escapeRefundsInlineHtml(HISTORY_REFUNDS_INLINE_BALANCE_NOT_RECORDED_TEXT)}</td>`
    : `<td class="col-num balance-num ${finalOwedClass}"><strong>${escapeRefundsInlineHtml(formatRefundsInlineAmount(last.balanceAfterCents))}</strong></td>`;
  let footer = `<tr><td><strong>Totals · ${escapeRefundsInlineHtml(count)}</strong></td><td></td><td class="col-num"><strong>${escapeRefundsInlineHtml(formatRefundsInlineAmount(total))}</strong></td>${refundsInlineBalanceCell(first.balanceBeforeCents)}${finalBalance}</tr>`;
  const full = Array.isArray(allEntries) ? allEntries : shownEntries;
  if (full.length !== shownEntries.length) {
    const fullRefunds = historyRefundsInlineEntries(full);
    if (fullRefunds.length > 0) {
      const fullTotal = historyRefundsInlineTotalCents(fullRefunds);
      const fullFirst = fullRefunds[0];
      const fullLast = fullRefunds[fullRefunds.length - 1];
      const fullCount = fullRefunds.length === 1 ? '1 refund' : `${fullRefunds.length} refunds`;
      const fullFinalOwedClass = fullLast.balanceAfterCents !== null && fullLast.balanceAfterCents > 0 ? 'is-due' : 'is-settled';
      const fullFinalBalance = fullLast.balanceAfterCents === null
        ? `<td class="col-num">${escapeRefundsInlineHtml(HISTORY_REFUNDS_INLINE_BALANCE_NOT_RECORDED_TEXT)}</td>`
        : `<td class="col-num balance-num ${fullFinalOwedClass}"><strong>${escapeRefundsInlineHtml(formatRefundsInlineAmount(fullLast.balanceAfterCents))}</strong></td>`;
      footer += `<tr><td><strong>Full history · ${escapeRefundsInlineHtml(fullCount)}</strong></td><td></td><td class="col-num"><strong>${escapeRefundsInlineHtml(formatRefundsInlineAmount(fullTotal))}</strong></td>${refundsInlineBalanceCell(fullFirst.balanceBeforeCents)}${fullFinalBalance}</tr>`;
    }
  }
  return `<table class="statement-table"><thead><tr><th>Date</th><th>Reason</th><th class="col-num">Refunded</th><th class="col-num">Balance before</th><th class="col-num">Balance after</th></tr></thead><tbody>${body}</tbody><tfoot>${footer}</tfoot></table>`;
}
