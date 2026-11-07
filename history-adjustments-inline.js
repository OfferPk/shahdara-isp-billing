// Plan 417 — History adjustment entries with reasons shown.
//
// Corrections and adjustments change the numbers, but the history
// shows the new figure without the reason, so the change looks
// unexplained: the full history list already carries each
// adjustment as a row in date order, with its amount and the
// running balance after it, yet the row carries no reason for the
// change and no approver. The reason and the approver live on the
// correction record itself — the Plan 109 record that names the
// bill, the original and corrected amounts, the reason in plain
// words, the approver, and the date — on a separate surface the
// operator has to open apart from the history. This module adds
// only the missing piece: one inline display of adjustment entries
// within the customer history — adjustment amount, reason in plain
// words, date, approver where recorded — in date order.
//
// The lines come from two records that already exist, and from no
// new store. A history adjustment row becomes a line with its
// reason and approver taken from the correction record that
// matches it: same customer, same date, and the same money — the
// correction changed the bill by exactly the adjustment's amount.
// An adjustment row whose note is its only reason keeps that note.
// A correction with no matching history row still appears, as its
// own line, with its signed change — corrected minus original —
// its reason and its approver, and no running balance, because a
// correction by itself moves no total: it is the record of a
// change, not a payment. A line whose reason is nowhere recorded
// shows "reason not recorded" rather than a guessed one.
//
// It displays only and corrects nothing: it reads the entries the
// full history list already composed and the correction records
// already stored on this device, and it writes to no store. It
// never changes any bill, payment, correction, or customer record.

export const HISTORY_ADJUSTMENTS_INLINE_EMPTY_TEXT = 'No transactions yet';

export const HISTORY_ADJUSTMENTS_INLINE_NO_ADJUSTMENTS_TEXT = 'No adjustments';

export const HISTORY_ADJUSTMENTS_INLINE_REASON_NOT_RECORDED_TEXT = 'reason not recorded';

export const HISTORY_ADJUSTMENTS_INLINE_DATE_NOT_RECORDED_TEXT = 'date not recorded';

export const HISTORY_ADJUSTMENTS_INLINE_APPROVER_NOT_RECORDED_TEXT = 'approver not recorded';

export const HISTORY_ADJUSTMENTS_INLINE_BALANCE_NOT_RECORDED_TEXT = 'not recorded';

function cleanAdjustmentsInlineKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanAdjustmentsInlineText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function finiteAdjustmentsInlineCents(value) {
  // A missing, boolean or blank figure is not a number, never zero:
  // Number(null) is 0 and Number(true) is 1, and both would invent
  // an adjustment out of nothing.
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

// One money figure, in cents: a whole-cents figure is used as it
// stands, a plain rupees figure converts exactly once on the way
// in. Anything else is not a figure at all.
function adjustmentsInlineMoneyToCents(centsValue, rupeesValue) {
  if (Number.isInteger(centsValue)) return centsValue;
  if (typeof rupeesValue === 'number' && Number.isFinite(rupeesValue)) {
    return Math.round(rupeesValue * 100);
  }
  return null;
}

// Whether one entry is an adjustment line for this display: typed
// adjustment with a usable positive amount. An adjustment entry
// with no usable amount is never zero-filled into a line.
export function historyAdjustmentsInlineIsAdjustment(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (cleanAdjustmentsInlineKey(entry.type) !== 'adjustment') return false;
  const amountCents = finiteAdjustmentsInlineCents(entry.amountCents);
  return amountCents !== null && amountCents > 0;
}

// The signed movement of one adjustment, in cents — the same rule
// the full history list uses for its running balance. An
// adjustment reduces what is owed; a voided adjustment is listed
// but moves nothing. Any entry that is not an adjustment moves
// nothing here.
export function historyAdjustmentsInlineDelta(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (cleanAdjustmentsInlineKey(entry.type) !== 'adjustment') return 0;
  if (entry.voided === true) return 0;
  const amountCents = finiteAdjustmentsInlineCents(entry.amountCents);
  if (amountCents === null) return 0;
  return -amountCents;
}

// The signed change one correction record makes, in cents:
// corrected minus original. A correction that raised the bill is
// positive; one that lowered it is negative. A record whose
// figures are unusable, whose original is not positive, or whose
// corrected figure is negative makes no change that can be shown.
export function historyAdjustmentsInlineCorrectionDelta(correction) {
  if (!correction || typeof correction !== 'object') return null;
  const originalCents = adjustmentsInlineMoneyToCents(
    correction.originalAmountCents, correction.originalAmount,
  );
  const correctedCents = adjustmentsInlineMoneyToCents(
    correction.correctedAmountCents, correction.correctedAmount,
  );
  if (originalCents === null || originalCents <= 0) return null;
  if (correctedCents === null || correctedCents < 0) return null;
  return correctedCents - originalCents;
}

// Whether one record is a usable correction for this customer: it
// names this customer and makes a change that can be shown. The
// reason and the approver may be missing — a correction without a
// recorded reason still appears, saying so — but a record with no
// usable figures cannot be shown as an adjustment of any amount.
export function historyAdjustmentsInlineIsCorrection(correction, customerId) {
  if (!correction || typeof correction !== 'object') return false;
  if (cleanAdjustmentsInlineKey(correction.customerId) !== cleanAdjustmentsInlineKey(customerId)) return false;
  return historyAdjustmentsInlineCorrectionDelta(correction) !== null;
}

// The sort key of a date: a month-only date counts as the first of
// that month for ordering but is shown exactly as recorded — a day
// is never guessed. An undated record sorts last.
function adjustmentsInlineSortKey(value) {
  const text = cleanAdjustmentsInlineText(value);
  if (text === '') return '9999-99-99';
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  return text;
}

// The adjustment lines of a customer, in date order. Each line
// carries the adjustment amount, the reason in plain words, the
// date, the approver where recorded, and the running balance
// before and after it where the history carries one. Lines from
// history adjustment rows keep the order the full history list
// already composed; correction lines join them in date order, a
// history line first where two fall on the same date. The input
// entries and corrections are never mutated.
export function historyAdjustmentsInlineLines(input = {}) {
  const customerId = cleanAdjustmentsInlineKey(input.customerId);
  if (!customerId) return [];
  const entries = Array.isArray(input.entries) ? input.entries : [];
  const corrections = Array.isArray(input.corrections) ? input.corrections : [];

  const usableCorrections = [];
  for (const correction of corrections) {
    if (!historyAdjustmentsInlineIsCorrection(correction, customerId)) continue;
    usableCorrections.push({
      id: cleanAdjustmentsInlineText(correction.id),
      date: cleanAdjustmentsInlineText(correction.date),
      deltaCents: historyAdjustmentsInlineCorrectionDelta(correction),
      reason: cleanAdjustmentsInlineText(correction.reason),
      approver: cleanAdjustmentsInlineText(correction.approver),
      used: false,
    });
  }

  const lines = [];
  for (const entry of entries) {
    if (!historyAdjustmentsInlineIsAdjustment(entry)) continue;
    const amountCents = finiteAdjustmentsInlineCents(entry.amountCents);
    const balanceAfterCents = finiteAdjustmentsInlineCents(entry.runningBalanceCents);
    const delta = historyAdjustmentsInlineDelta(entry);
    const date = cleanAdjustmentsInlineText(entry.date);
    // The correction that explains this row: recorded on the same
    // date, changing the bill by exactly this row's amount. The
    // first still-unmatched record that fits is taken, so two
    // corrections on one date never share one row.
    let matched = null;
    for (const correction of usableCorrections) {
      if (correction.used) continue;
      if (correction.date !== date) continue;
      if (Math.abs(correction.deltaCents) !== amountCents) continue;
      matched = correction;
      correction.used = true;
      break;
    }
    lines.push({
      date,
      amountCents,
      reason: (matched && matched.reason) || cleanAdjustmentsInlineText(entry.note),
      approver: matched ? matched.approver : '',
      balanceBeforeCents: balanceAfterCents === null ? null : balanceAfterCents - delta,
      balanceAfterCents,
      voided: entry.voided === true,
      source: 'history',
      ref: cleanAdjustmentsInlineText(entry.ref),
    });
  }

  // A correction with no matching history row still appears, as
  // its own line: its change, its reason, its approver, and no
  // running balance — a correction by itself moves no total.
  for (const correction of usableCorrections) {
    if (correction.used) continue;
    lines.push({
      date: correction.date,
      amountCents: correction.deltaCents,
      reason: correction.reason,
      approver: correction.approver,
      balanceBeforeCents: null,
      balanceAfterCents: null,
      voided: false,
      source: 'correction',
      ref: correction.id,
    });
  }

  lines.sort((a, b) => {
    const aKey = adjustmentsInlineSortKey(a.date);
    const bKey = adjustmentsInlineSortKey(b.date);
    if (aKey !== bKey) return aKey < bKey ? -1 : 1;
    if (a.source !== b.source) return a.source === 'history' ? -1 : 1;
    return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
  });
  return lines;
}

// Total adjusted over the lines given: the signed change shown. A
// voided adjustment moved nothing, so it never counts here.
export function historyAdjustmentsInlineTotalCents(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return 0;
  let total = 0;
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    if (line.voided === true) continue;
    const amountCents = finiteAdjustmentsInlineCents(line.amountCents);
    if (amountCents === null) continue;
    total += amountCents;
  }
  return total;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatAdjustmentsInlineAmount(cents) {
  const amount = finiteAdjustmentsInlineCents(cents);
  if (amount === null) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function historyAdjustmentsInlineBalanceNote(balanceCents) {
  const balance = finiteAdjustmentsInlineCents(balanceCents);
  if (balance === null) return HISTORY_ADJUSTMENTS_INLINE_BALANCE_NOT_RECORDED_TEXT;
  if (balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatAdjustmentsInlineAmount(balance)}`;
  return `Credit ${formatAdjustmentsInlineAmount(-balance)}`;
}

export function historyAdjustmentsInlineLineText(line) {
  if (!line || typeof line !== 'object') return '';
  const date = line.date ? line.date : HISTORY_ADJUSTMENTS_INLINE_DATE_NOT_RECORDED_TEXT;
  const reason = line.reason ? line.reason : HISTORY_ADJUSTMENTS_INLINE_REASON_NOT_RECORDED_TEXT;
  const amount = formatAdjustmentsInlineAmount(line.amountCents);
  const note = historyAdjustmentsInlineBalanceNote(line.balanceAfterCents);
  const approver = line.approver ? ` · Approved by ${line.approver}` : '';
  const voided = line.voided === true ? ' · VOID' : '';
  return `${date} · Adjustment ${amount} · ${reason} · Balance after ${note}${approver}${voided}`;
}

// Whether one line is shown in the current view: the display
// follows the same shown rows as the list. A history line is shown
// only while its own row is among the shown entries — a filter
// that hides the row hides its adjustment too. A correction line
// has no row of its own, so it is shown while its date falls
// inside the span the shown rows cover; an undated correction, or
// a view whose shown rows carry no date at all, shows the line
// rather than hiding an adjustment that cannot be placed.
function adjustmentsInlineLineIsShown(line, shownEntries) {
  if (line.source === 'history') {
    return shownEntries.some((entry) => entry
      && typeof entry === 'object'
      && cleanAdjustmentsInlineKey(entry.type) === 'adjustment'
      && cleanAdjustmentsInlineText(entry.ref) === cleanAdjustmentsInlineText(line.ref));
  }
  if (line.date === '') return true;
  const dated = shownEntries
    .filter((entry) => entry && typeof entry === 'object' && cleanAdjustmentsInlineText(entry.date) !== '')
    .map((entry) => adjustmentsInlineSortKey(entry.date))
    .sort();
  if (dated.length === 0) return true;
  const key = adjustmentsInlineSortKey(line.date);
  return key >= dated[0] && key <= dated[dated.length - 1];
}

export function historyAdjustmentsInlineSummaryText(shownEntries, allEntries, corrections, customerId) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) {
    return HISTORY_ADJUSTMENTS_INLINE_EMPTY_TEXT;
  }
  const lines = historyAdjustmentsInlineLines({ entries: allEntries, corrections, customerId });
  if (lines.length === 0) return HISTORY_ADJUSTMENTS_INLINE_NO_ADJUSTMENTS_TEXT;
  const shown = lines.filter((line) => adjustmentsInlineLineIsShown(line, shownEntries));
  if (shown.length === 0) return HISTORY_ADJUSTMENTS_INLINE_NO_ADJUSTMENTS_TEXT;
  const total = historyAdjustmentsInlineTotalCents(shown);
  const last = shown[shown.length - 1];
  const count = shown.length === 1 ? '1 adjustment' : `${shown.length} adjustments`;
  const line = `${count} · ${formatAdjustmentsInlineAmount(total)} adjusted · Balance ${historyAdjustmentsInlineBalanceNote(last.balanceAfterCents)}`;
  if (shown.length === lines.length) return line;
  const fullTotal = historyAdjustmentsInlineTotalCents(lines);
  const fullCount = lines.length === 1 ? '1 adjustment' : `${lines.length} adjustments`;
  return `${line} · Full history: ${fullCount} · ${formatAdjustmentsInlineAmount(fullTotal)} adjusted`;
}

function escapeAdjustmentsInlineHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function adjustmentsInlineBalanceCell(balanceCents) {
  if (balanceCents === null || balanceCents === undefined) {
    return `<td class="col-num">${escapeAdjustmentsInlineHtml(HISTORY_ADJUSTMENTS_INLINE_BALANCE_NOT_RECORDED_TEXT)}</td>`;
  }
  const owedClass = balanceCents > 0 ? 'is-due' : 'is-settled';
  return `<td class="col-num balance-num ${owedClass}">${escapeAdjustmentsInlineHtml(formatAdjustmentsInlineAmount(balanceCents))}</td>`;
}

// The inline adjustment display: one table over the shown
// adjustments, one row per adjustment in date order — date, reason,
// adjustment amount, approver, balance before, balance after —
// plus a totals footer taken from the shown lines, so a filtered
// view still totals only what it shows. When the view is filtered,
// a second footer row carries the full-history totals, so the
// whole history stays checkable. The table reuses the statement
// table classes the app already ships, so it adds no new styles.
// An empty shown list renders nothing; a shown list with no
// adjustments renders a plain line saying so.
export function historyAdjustmentsInlineHtml(shownEntries, allEntries, corrections, customerId) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) return '';
  const lines = historyAdjustmentsInlineLines({ entries: allEntries, corrections, customerId });
  const shown = lines.filter((line) => adjustmentsInlineLineIsShown(line, shownEntries));
  if (shown.length === 0) {
    return `<p class="notice">${escapeAdjustmentsInlineHtml(HISTORY_ADJUSTMENTS_INLINE_NO_ADJUSTMENTS_TEXT)}</p>`;
  }
  const total = historyAdjustmentsInlineTotalCents(shown);
  const body = shown.map((line) => {
    const date = line.date ? line.date : HISTORY_ADJUSTMENTS_INLINE_DATE_NOT_RECORDED_TEXT;
    const reason = line.reason ? line.reason : HISTORY_ADJUSTMENTS_INLINE_REASON_NOT_RECORDED_TEXT;
    const approver = line.approver ? line.approver : HISTORY_ADJUSTMENTS_INLINE_APPROVER_NOT_RECORDED_TEXT;
    const amount = formatAdjustmentsInlineAmount(line.amountCents);
    const voided = line.voided === true ? ' · VOID' : '';
    return `<tr><td>${escapeAdjustmentsInlineHtml(date)}</td><td>${escapeAdjustmentsInlineHtml(reason)}${escapeAdjustmentsInlineHtml(voided)}</td><td class="col-num">${escapeAdjustmentsInlineHtml(amount)}</td><td>${escapeAdjustmentsInlineHtml(approver)}</td>${adjustmentsInlineBalanceCell(line.balanceBeforeCents)}${adjustmentsInlineBalanceCell(line.balanceAfterCents)}</tr>`;
  }).join('');
  const first = shown[0];
  const last = shown[shown.length - 1];
  const count = shown.length === 1 ? '1 adjustment' : `${shown.length} adjustments`;
  const finalOwedClass = last.balanceAfterCents !== null && last.balanceAfterCents > 0 ? 'is-due' : 'is-settled';
  const finalBalance = last.balanceAfterCents === null
    ? `<td class="col-num">${escapeAdjustmentsInlineHtml(HISTORY_ADJUSTMENTS_INLINE_BALANCE_NOT_RECORDED_TEXT)}</td>`
    : `<td class="col-num balance-num ${finalOwedClass}"><strong>${escapeAdjustmentsInlineHtml(formatAdjustmentsInlineAmount(last.balanceAfterCents))}</strong></td>`;
  let footer = `<tr><td><strong>Totals · ${escapeAdjustmentsInlineHtml(count)}</strong></td><td></td><td class="col-num"><strong>${escapeAdjustmentsInlineHtml(formatAdjustmentsInlineAmount(total))}</strong></td><td></td>${adjustmentsInlineBalanceCell(first.balanceBeforeCents)}${finalBalance}</tr>`;
  if (lines.length > shown.length) {
    const fullTotal = historyAdjustmentsInlineTotalCents(lines);
    const fullFirst = lines[0];
    const fullLast = lines[lines.length - 1];
    const fullCount = lines.length === 1 ? '1 adjustment' : `${lines.length} adjustments`;
    const fullFinalOwedClass = fullLast.balanceAfterCents !== null && fullLast.balanceAfterCents > 0 ? 'is-due' : 'is-settled';
    const fullFinalBalance = fullLast.balanceAfterCents === null
      ? `<td class="col-num">${escapeAdjustmentsInlineHtml(HISTORY_ADJUSTMENTS_INLINE_BALANCE_NOT_RECORDED_TEXT)}</td>`
      : `<td class="col-num balance-num ${fullFinalOwedClass}"><strong>${escapeAdjustmentsInlineHtml(formatAdjustmentsInlineAmount(fullLast.balanceAfterCents))}</strong></td>`;
    footer += `<tr><td><strong>Full history · ${escapeAdjustmentsInlineHtml(fullCount)}</strong></td><td></td><td class="col-num"><strong>${escapeAdjustmentsInlineHtml(formatAdjustmentsInlineAmount(fullTotal))}</strong></td><td></td>${adjustmentsInlineBalanceCell(fullFirst.balanceBeforeCents)}${fullFinalBalance}</tr>`;
  }
  return `<table class="statement-table"><thead><tr><th>Date</th><th>Reason</th><th class="col-num">Adjustment</th><th>Approver</th><th class="col-num">Balance before</th><th class="col-num">Balance after</th></tr></thead><tbody>${body}</tbody><tfoot>${footer}</tfoot></table>`;
}
