// Plan 406 — History running balance after each transaction.
// A history list shows amounts but never the balance after each one,
// so a customer cannot see the moment their dues became zero — or
// the moment they went behind. This module composes the missing
// piece: one running-balance column on the customer history, built
// from the same history entries in order. It is a view only: it
// reads the entries the full history list already composed (each one
// already carries the balance after it) and it recomputes nothing
// stored. It never changes any bill, payment, customer record, or
// the monthly roll-forward proof view; it never writes to any store,
// and it never reorders or drops an entry. Each row carries the
// balance before it and the balance after it, so every step's
// arithmetic is checkable from the line above it: the balance after
// a row is the balance before it plus that row's signed movement,
// and the final balance is the customer's current dues.
export const HISTORY_RUNNING_BALANCE_EMPTY_TEXT = 'No transactions yet';

export const HISTORY_RUNNING_BALANCE_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
  info: 'Info',
});

function cleanRunningBalanceKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanRunningBalanceText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function finiteRunningBalanceCents(value) {
  // A missing, boolean or blank figure is not a number, never zero:
  // Number(null) is 0 and Number(true) is 1, and both would invent a
  // movement or a dues figure out of nothing.
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

// The signed movement of one entry, in cents. Charges and refunds
// add to what is owed; payments, advances and adjustments reduce it.
// A credit entry that came from an overpayment is already counted
// inside its source payment, so it moves nothing; a credit entry
// from an approved adjustment reduces what is owed. An informational
// line (Sharafat 12 — ticket/add-on charges already inside the
// payment cash) moves nothing by design: its amount is shown, never
// charged twice. A voided entry is listed but moves nothing. A
// missing or non-finite amount is not a number, never zero-filled
// into a movement: it moves nothing.
export function historyRunningBalanceExpectedDelta(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (entry.voided === true) return 0;
  const amountCents = finiteRunningBalanceCents(entry.amountCents);
  if (amountCents === null) return 0;
  const type = cleanRunningBalanceKey(entry.type);
  if (type === 'info') return 0;
  if (type === 'charge' || type === 'refund') return amountCents;
  if (type === 'payment' || type === 'advance' || type === 'adjustment') return -amountCents;
  if (type === 'credit') {
    return cleanRunningBalanceKey(entry.source) === 'adjustment' ? -amountCents : 0;
  }
  return 0;
}

// One column row per entry, in the same order as the entries given.
// The balance before a row is the balance after it minus that row's
// own signed movement, so the row is checkable on its own: previous
// plus movement equals the balance after. A row whose recorded
// balance is missing reads as no recorded movement from the row
// before it, never as an invented figure.
export function historyRunningBalanceRows(entries) {
  if (!Array.isArray(entries)) return [];
  let previousBalanceCents = 0;
  return entries.map((entry, index) => {
    const safe = entry && typeof entry === 'object' ? entry : {};
    const deltaCents = historyRunningBalanceExpectedDelta(safe);
    const recorded = finiteRunningBalanceCents(safe.runningBalanceCents);
    const balanceAfterCents = recorded === null ? previousBalanceCents : recorded;
    const row = {
      index,
      date: cleanRunningBalanceText(safe.date),
      label: HISTORY_RUNNING_BALANCE_TYPE_LABELS[cleanRunningBalanceKey(safe.type)] || 'Payment',
      type: cleanRunningBalanceKey(safe.type) || 'payment',
      amountCents: finiteRunningBalanceCents(safe.amountCents) ?? 0,
      deltaCents,
      previousBalanceCents: balanceAfterCents - deltaCents,
      balanceAfterCents,
      voided: safe.voided === true,
      ref: cleanRunningBalanceText(safe.ref),
    };
    previousBalanceCents = balanceAfterCents;
    return row;
  });
}

// Verifies the running-balance chain as recorded: the first row's
// balance must equal its own movement from an opening of zero, and
// every later row's balance must equal the row above it plus that
// row's own movement. Returns the first row that fails, or ok.
export function historyRunningBalanceChainCheck(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: true, badIndex: -1, expectedCents: 0, actualCents: 0, message: 'No transactions yet' };
  }
  let previousBalanceCents = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const expectedCents = previousBalanceCents + historyRunningBalanceExpectedDelta(entry);
    const recorded = entry && typeof entry === 'object' ? finiteRunningBalanceCents(entry.runningBalanceCents) : null;
    const actualCents = recorded === null ? previousBalanceCents : recorded;
    if (actualCents !== expectedCents) {
      return {
        ok: false,
        badIndex: index,
        expectedCents,
        actualCents,
        message: `Balance after entry ${index + 1} should be ${formatRunningBalanceAmount(expectedCents)} but is ${formatRunningBalanceAmount(actualCents)}`,
      };
    }
    previousBalanceCents = actualCents;
  }
  return {
    ok: true,
    badIndex: -1,
    expectedCents: previousBalanceCents,
    actualCents: previousBalanceCents,
    message: `All ${entries.length} balance steps check out`,
  };
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatRunningBalanceAmount(cents) {
  const amount = finiteRunningBalanceCents(cents);
  if (amount === null) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function historyRunningBalanceNote(balanceCents) {
  const balance = finiteRunningBalanceCents(balanceCents);
  if (balance === null || balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatRunningBalanceAmount(balance)}`;
  return `Credit ${formatRunningBalanceAmount(-balance)}`;
}

// The final running balance: the balance after the last entry, or
// zero when there are no entries. The caller supplies the
// customer's current dues figure; the column never computes dues
// itself, it only shows whether the two agree.
export function historyRunningBalanceFinal(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  const last = entries[entries.length - 1];
  const balance = last && typeof last === 'object' ? finiteRunningBalanceCents(last.runningBalanceCents) : null;
  return balance === null ? 0 : balance;
}

export function historyRunningBalanceMatchesDues(entries, currentDuesCents) {
  const finalCents = historyRunningBalanceFinal(entries);
  const dues = finiteRunningBalanceCents(currentDuesCents);
  if (dues === null) {
    return {
      finalCents,
      duesCents: null,
      matches: false,
      text: `Final balance ${formatRunningBalanceAmount(finalCents)} · current dues not recorded`,
    };
  }
  // Sharafat 12: the engine clamps each bill's due at zero, so an
  // overpaid customer reads as no dues even though the history final
  // is a real credit — compare the final CLAMPED at zero, the same
  // clamp as the engine, or every overpaid customer would read as a
  // mismatch. The reported final stays the raw figure; only the
  // comparison clamps.
  const clampedFinalCents = Math.max(0, finalCents);
  const matches = clampedFinalCents === dues;
  return {
    finalCents,
    duesCents: dues,
    matches,
    text: matches
      ? (finalCents < 0
        ? `Final balance ${formatRunningBalanceAmount(finalCents)} matches current dues — overpaid, credit ${formatRunningBalanceAmount(-finalCents)}`
        : `Final balance ${formatRunningBalanceAmount(finalCents)} matches current dues`)
      : `Final balance ${formatRunningBalanceAmount(finalCents)} does not match current dues ${formatRunningBalanceAmount(dues)}`,
  };
}

export function historyRunningBalanceLineText(row) {
  if (!row || typeof row !== 'object') return '';
  const date = row.date ? row.date : 'date not recorded';
  const amount = formatRunningBalanceAmount(row.amountCents);
  const after = formatRunningBalanceAmount(row.balanceAfterCents);
  const before = formatRunningBalanceAmount(row.previousBalanceCents);
  const voided = row.voided ? ' · VOID' : '';
  return `${date} · ${row.label || 'Payment'}${voided} · ${amount} · Balance after ${after} (was ${before})`;
}

export function historyRunningBalanceSummaryText(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return HISTORY_RUNNING_BALANCE_EMPTY_TEXT;
  const count = entries.length === 1 ? '1 step' : `${entries.length} steps`;
  return `${count} · Final balance ${formatRunningBalanceAmount(historyRunningBalanceFinal(entries))} · ${historyRunningBalanceNote(historyRunningBalanceFinal(entries))}`;
}

function escapeRunningBalanceHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The running-balance column: one table over the shown entries, in
// the same order as the history list, with a column header and one
// row per entry — date, transaction, amount, balance after — plus a
// final-balance footer taken from the full history, so a filtered
// view still ends on the customer's true final balance. The table
// reuses the statement table classes the app already ships, so it
// adds no new styles. An empty shown list renders nothing.
export function historyRunningBalanceColumnHtml(shownEntries, allEntries) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) return '';
  const full = Array.isArray(allEntries) ? allEntries : shownEntries;
  const rows = historyRunningBalanceRows(shownEntries);
  const body = rows.map((row) => {
    const date = row.date ? row.date : 'date not recorded';
    const amount = formatRunningBalanceAmount(row.amountCents);
    const after = formatRunningBalanceAmount(row.balanceAfterCents);
    const balanceClass = row.balanceAfterCents > 0 ? 'is-due' : 'is-settled';
    const voided = row.voided ? ' · VOID' : '';
    return `<tr><td>${escapeRunningBalanceHtml(date)}</td><td>${escapeRunningBalanceHtml(row.label)}${escapeRunningBalanceHtml(voided)}</td><td class="col-num">${escapeRunningBalanceHtml(amount)}</td><td class="col-num balance-num ${balanceClass}">${escapeRunningBalanceHtml(after)}</td></tr>`;
  }).join('');
  const finalCents = historyRunningBalanceFinal(full);
  const finalLabel = shownEntries.length === full.length ? 'Final balance' : 'Final balance (full history)';
  return `<table class="statement-table"><thead><tr><th>Date</th><th>Transaction</th><th class="col-num">Amount</th><th class="col-num">Balance after</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="3"><strong>${escapeRunningBalanceHtml(finalLabel)}</strong></td><td class="col-num balance-num ${finalCents > 0 ? 'is-due' : 'is-settled'}"><strong>${escapeRunningBalanceHtml(formatRunningBalanceAmount(finalCents))}</strong></td></tr></tfoot></table>`;
}
