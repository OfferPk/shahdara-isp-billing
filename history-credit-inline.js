// Plan 416 — History credit applications shown inline.
//
// Credit applied to a bill never appears in the history as a line:
// the full history list carries each credit entry as a row, but the
// operator-recorded application that settles a bill with that credit
// — which bill, on what date, how much — lives only on the separate
// credit-balance surface. A bill that looks unpaid was often settled
// by credit, and the history misleads the reader into chasing money
// the customer already had. This module adds only the missing
// piece: one inline display of credit applications within the
// customer history — credit applied, to which bill, on what date,
// with the remaining credit shown — in date order.
//
// The running balance after an application is the running balance
// the full history already carries at that date: the credit was
// already counted when the overpayment was recorded or the
// adjustment was approved, so the application itself moves no total
// — it assigns credit that is already there to a bill. What the
// balance after the line proves is that the bill reads as settled:
// a bill settled by credit shows Settled after the application,
// never still owed. The remaining credit on an entry is a
// whole-entry fact, so it is always computed from every
// application on that entry, never from a filtered view — a filter
// must never rewrite how much credit is left, the same way the
// first-dates line is drawn from the full history.
//
// It displays only and applies no credit: it reads the entries the
// full history list already composed, the applications and the
// credit entries already stored on this device, and it writes to
// no store. It never changes any bill, payment, credit balance,
// or customer record.

export const HISTORY_CREDIT_INLINE_EMPTY_TEXT = 'No transactions yet';

export const HISTORY_CREDIT_INLINE_NO_APPLICATIONS_TEXT = 'No credit applied';

export const HISTORY_CREDIT_INLINE_DATE_NOT_RECORDED_TEXT = 'date not recorded';

export const HISTORY_CREDIT_INLINE_BILL_NOT_RECORDED_TEXT = 'bill not recorded';

export const HISTORY_CREDIT_INLINE_BALANCE_NOT_RECORDED_TEXT = 'not recorded';

function cleanCreditInlineKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanCreditInlineText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function finiteCreditInlineCents(value) {
  // A missing, boolean or blank figure is not a number, never zero:
  // Number(null) is 0 and Number(true) is 1, and both would invent
  // credit out of nothing.
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

// The sort key of a date: a month-only date counts as the first of
// that month for ordering but is shown exactly as recorded — a day
// is never guessed. An undated record sorts last.
function creditInlineSortKey(value) {
  const text = cleanCreditInlineText(value);
  if (text === '') return '9999-99-99';
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  return text;
}

// Whether one record is a usable credit application for this
// customer: it names the credit entry it draws on and the bill it
// settles, and it applies a usable positive amount. An application
// naming no bill is refused at record time, and a damaged stored
// record is dropped here rather than shown as a guessed line.
export function historyCreditInlineIsApplication(application, customerId) {
  if (!application || typeof application !== 'object') return false;
  if (cleanCreditInlineKey(application.customerId) !== cleanCreditInlineKey(customerId)) return false;
  if (cleanCreditInlineText(application.creditEntryId ?? application.entryId) === '') return false;
  if (cleanCreditInlineText(application.billId ?? application.bill) === '') return false;
  const amountCents = finiteCreditInlineCents(application.amountCents);
  return amountCents !== null && amountCents > 0;
}

// The credit-application lines of a customer, in date order. Each
// line carries the credit applied, the bill it settles, the date,
// the remaining credit on its entry after this application, and
// the running balance after it, taken from the full history at
// that date. The input entries are never mutated, and the entries
// are read in the order given — the full history list already
// composes them in date order.
export function historyCreditInlineLines(input = {}) {
  const customerId = cleanCreditInlineKey(input.customerId);
  if (!customerId) return [];
  const entries = Array.isArray(input.entries) ? input.entries : [];
  const applications = Array.isArray(input.applications) ? input.applications : [];
  const creditEntries = Array.isArray(input.creditEntries) ? input.creditEntries : [];

  const entryAmountById = new Map();
  for (const entry of creditEntries) {
    if (!entry || typeof entry !== 'object') continue;
    const id = cleanCreditInlineKey(entry.id);
    if (id === '') continue;
    const amountCents = finiteCreditInlineCents(entry.amountCents);
    if (amountCents === null || amountCents <= 0) continue;
    if (!entryAmountById.has(id)) entryAmountById.set(id, amountCents);
  }

  const usable = [];
  for (const application of applications) {
    if (!historyCreditInlineIsApplication(application, customerId)) continue;
    usable.push({
      date: cleanCreditInlineText(application.date),
      bill: cleanCreditInlineText(application.billLabel ?? application.billMonth) || cleanCreditInlineText(application.billId ?? application.bill),
      amountCents: finiteCreditInlineCents(application.amountCents),
      creditEntryId: cleanCreditInlineText(application.creditEntryId ?? application.entryId),
      applicationId: cleanCreditInlineText(application.id),
      note: cleanCreditInlineText(application.note ?? application.reason),
    });
  }
  usable.sort((a, b) => {
    const dateCompare = creditInlineSortKey(a.date) < creditInlineSortKey(b.date) ? -1 : creditInlineSortKey(a.date) > creditInlineSortKey(b.date) ? 1 : 0;
    if (dateCompare !== 0) return dateCompare;
    if (a.creditEntryId !== b.creditEntryId) return a.creditEntryId < b.creditEntryId ? -1 : 1;
    return a.applicationId < b.applicationId ? -1 : a.applicationId > b.applicationId ? 1 : 0;
  });

  // The running balance at each application date, from the full
  // history: the balance after the last entry dated on or before
  // the application. The history starts at nothing owed, so an
  // application dated before every entry reads a balance of zero.
  const sortedEntries = [...entries].sort((a, b) => {
    const aKey = creditInlineSortKey(a?.date);
    const bKey = creditInlineSortKey(b?.date);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });
  const appliedSoFarByEntry = new Map();
  const lines = [];
  let entryIndex = 0;
  let balanceCents = 0;
  for (const application of usable) {
    const appKey = creditInlineSortKey(application.date);
    while (entryIndex < sortedEntries.length && creditInlineSortKey(sortedEntries[entryIndex]?.date) <= appKey) {
      const entryBalance = finiteCreditInlineCents(sortedEntries[entryIndex].runningBalanceCents);
      if (entryBalance !== null) balanceCents = entryBalance;
      entryIndex += 1;
    }
    const entryKey = cleanCreditInlineKey(application.creditEntryId);
    const appliedSoFar = appliedSoFarByEntry.get(entryKey) ?? 0;
    appliedSoFarByEntry.set(entryKey, appliedSoFar + application.amountCents);
    const entryAmount = entryAmountById.get(entryKey);
    lines.push({
      date: application.date,
      bill: application.bill,
      amountCents: application.amountCents,
      remainingCents: entryAmount === undefined ? null : entryAmount - (appliedSoFar + application.amountCents),
      balanceAfterCents: balanceCents,
      creditEntryId: application.creditEntryId,
      applicationId: application.applicationId,
      note: application.note,
    });
  }
  return lines;
}

// Total credit applied over the lines given.
export function historyCreditInlineTotalCents(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return 0;
  let total = 0;
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    const amountCents = finiteCreditInlineCents(line.amountCents);
    if (amountCents === null || amountCents <= 0) continue;
    total += amountCents;
  }
  return total;
}

// Total credit remaining over the lines given: one figure per
// distinct entry, taken from the last line on that entry, so two
// applications on one entry never double-count what is left.
// Lines whose entry is unknown carry no remaining figure and are
// skipped, never zero-filled.
export function historyCreditInlineRemainingCents(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return 0;
  const lastRemainingByEntry = new Map();
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    const key = cleanCreditInlineKey(line.creditEntryId);
    if (key === '') continue;
    const remaining = finiteCreditInlineCents(line.remainingCents);
    if (remaining === null) continue;
    lastRemainingByEntry.set(key, remaining);
  }
  let total = 0;
  for (const remaining of lastRemainingByEntry.values()) total += remaining;
  return total;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatCreditInlineAmount(cents) {
  const amount = finiteCreditInlineCents(cents);
  if (amount === null) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function historyCreditInlineBalanceNote(balanceCents) {
  const balance = finiteCreditInlineCents(balanceCents);
  if (balance === null) return HISTORY_CREDIT_INLINE_BALANCE_NOT_RECORDED_TEXT;
  if (balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatCreditInlineAmount(balance)}`;
  return `Credit ${formatCreditInlineAmount(-balance)}`;
}

export function historyCreditInlineLineText(line) {
  if (!line || typeof line !== 'object') return '';
  const date = line.date ? line.date : HISTORY_CREDIT_INLINE_DATE_NOT_RECORDED_TEXT;
  const bill = line.bill ? line.bill : HISTORY_CREDIT_INLINE_BILL_NOT_RECORDED_TEXT;
  const amount = formatCreditInlineAmount(line.amountCents);
  const remaining = line.remainingCents === null || line.remainingCents === undefined
    ? HISTORY_CREDIT_INLINE_BALANCE_NOT_RECORDED_TEXT
    : formatCreditInlineAmount(line.remainingCents);
  const note = historyCreditInlineBalanceNote(line.balanceAfterCents);
  const extra = line.note ? ` · ${line.note}` : '';
  return `${date} · Credit ${amount} applied to ${bill} · Remaining ${remaining} · Balance after ${note}${extra}`;
}

export function historyCreditInlineSummaryText(shownEntries, allEntries, applications, creditEntries, customerId) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) {
    return HISTORY_CREDIT_INLINE_EMPTY_TEXT;
  }
  const lines = historyCreditInlineLines({ entries: allEntries, applications, creditEntries, customerId });
  if (lines.length === 0) return HISTORY_CREDIT_INLINE_NO_APPLICATIONS_TEXT;
  const shown = lines.filter((line) => creditInlineLineIsShown(line, shownEntries));
  if (shown.length === 0) return HISTORY_CREDIT_INLINE_NO_APPLICATIONS_TEXT;
  const total = historyCreditInlineTotalCents(shown);
  const remaining = historyCreditInlineRemainingCents(lines);
  const last = shown[shown.length - 1];
  const count = shown.length === 1 ? '1 credit application' : `${shown.length} credit applications`;
  const line = `${count} · ${formatCreditInlineAmount(total)} applied · Remaining ${formatCreditInlineAmount(remaining)} · Balance ${historyCreditInlineBalanceNote(last.balanceAfterCents)}`;
  if (shown.length === lines.length) return line;
  const fullTotal = historyCreditInlineTotalCents(lines);
  const fullCount = lines.length === 1 ? '1 credit application' : `${lines.length} credit applications`;
  return `${line} · Full history: ${fullCount} · ${formatCreditInlineAmount(fullTotal)} applied`;
}

function escapeCreditInlineHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function creditInlineBalanceCell(balanceCents) {
  if (balanceCents === null || balanceCents === undefined) {
    return `<td class="col-num">${escapeCreditInlineHtml(HISTORY_CREDIT_INLINE_BALANCE_NOT_RECORDED_TEXT)}</td>`;
  }
  const owedClass = balanceCents > 0 ? 'is-due' : 'is-settled';
  return `<td class="col-num balance-num ${owedClass}">${escapeCreditInlineHtml(formatCreditInlineAmount(balanceCents))}</td>`;
}

function creditInlineRemainingCell(remainingCents) {
  if (remainingCents === null || remainingCents === undefined) {
    return `<td class="col-num">${escapeCreditInlineHtml(HISTORY_CREDIT_INLINE_BALANCE_NOT_RECORDED_TEXT)}</td>`;
  }
  return `<td class="col-num">${escapeCreditInlineHtml(formatCreditInlineAmount(remainingCents))}</td>`;
}

// Whether one application line is shown in the current view: the
// display follows the same shown rows as the list, so a line is
// shown only while its credit entry's row is among the shown
// entries — a filter that hides the entry hides its applications
// too, exactly like the refund display hides a refund its filter
// hides.
function creditInlineLineIsShown(line, shownEntries) {
  return shownEntries.some((entry) => entry
    && typeof entry === 'object'
    && cleanCreditInlineKey(entry.type) === 'credit'
    && cleanCreditInlineKey(entry.ref) === cleanCreditInlineKey(line.creditEntryId));
}

// The inline credit-application display: one table over the shown
// applications, one row per application in date order — date, bill,
// credit applied, remaining credit, balance after — plus a totals
// footer taken from the shown lines, so a filtered view still
// totals only what it shows. The remaining credit in the footer is
// the whole-entry figure from the full history, so a filter never
// rewrites how much credit is left. When the view is filtered, a
// second footer row carries the full-history totals, so the whole
// history stays checkable. The table reuses the statement table
// classes the app already ships, so it adds no new styles. An
// empty shown list renders nothing; a shown list with no
// applications renders a plain line saying so.
export function historyCreditInlineHtml(shownEntries, allEntries, applications, creditEntries, customerId) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) return '';
  const lines = historyCreditInlineLines({ entries: allEntries, applications, creditEntries, customerId });
  const shown = lines.filter((line) => creditInlineLineIsShown(line, shownEntries));
  if (shown.length === 0) {
    return `<p class="notice">${escapeCreditInlineHtml(HISTORY_CREDIT_INLINE_NO_APPLICATIONS_TEXT)}</p>`;
  }
  const total = historyCreditInlineTotalCents(shown);
  const remaining = historyCreditInlineRemainingCents(lines);
  const body = shown.map((line) => {
    const date = line.date ? line.date : HISTORY_CREDIT_INLINE_DATE_NOT_RECORDED_TEXT;
    const bill = line.bill ? line.bill : HISTORY_CREDIT_INLINE_BILL_NOT_RECORDED_TEXT;
    const amount = formatCreditInlineAmount(line.amountCents);
    return `<tr><td>${escapeCreditInlineHtml(date)}</td><td>${escapeCreditInlineHtml(bill)}</td><td class="col-num">${escapeCreditInlineHtml(amount)}</td>${creditInlineRemainingCell(line.remainingCents)}${creditInlineBalanceCell(line.balanceAfterCents)}</tr>`;
  }).join('');
  const last = shown[shown.length - 1];
  const count = shown.length === 1 ? '1 credit application' : `${shown.length} credit applications`;
  let footer = `<tr><td><strong>Totals · ${escapeCreditInlineHtml(count)}</strong></td><td></td><td class="col-num"><strong>${escapeCreditInlineHtml(formatCreditInlineAmount(total))}</strong></td><td class="col-num"><strong>${escapeCreditInlineHtml(formatCreditInlineAmount(remaining))}</strong></td>${creditInlineBalanceCell(last.balanceAfterCents)}</tr>`;
  if (lines.length > shown.length) {
    const fullTotal = historyCreditInlineTotalCents(lines);
    const fullLast = lines[lines.length - 1];
    const fullCount = lines.length === 1 ? '1 credit application' : `${lines.length} credit applications`;
    footer += `<tr><td><strong>Full history · ${escapeCreditInlineHtml(fullCount)}</strong></td><td></td><td class="col-num"><strong>${escapeCreditInlineHtml(formatCreditInlineAmount(fullTotal))}</strong></td><td class="col-num"><strong>${escapeCreditInlineHtml(formatCreditInlineAmount(remaining))}</strong></td>${creditInlineBalanceCell(fullLast.balanceAfterCents)}</tr>`;
  }
  return `<table class="statement-table"><thead><tr><th>Date</th><th>Bill</th><th class="col-num">Credit applied</th><th class="col-num">Remaining credit</th><th class="col-num">Balance after</th></tr></thead><tbody>${body}</tbody><tfoot>${footer}</tfoot></table>`;
}
