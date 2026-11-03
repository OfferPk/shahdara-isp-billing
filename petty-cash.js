// Plan 45 (Plan 1-100) — Petty cash and field advance log.
//
// Small field spending — cable, connectors, transport, a quick repair —
// is paid out of the collector's pocket or the day's cash with no
// record, so it surfaces later as an unexplained gap in the handover.
// This module answers one question per advance: how much was given,
// how much was spent against it, and how much is left.
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every advance and spend,
//     and the module never reads storage, the clock, or the network,
//     and never mutates an input.
//   - It is a log only. It never changes a customer payment, a bill,
//     a Waada promise, or any total anywhere, and it never writes
//     into the ledger.
//   - It is NOT the daily cash drawer (SISP-11 roznamcha) and NOT the
//     Plan 4 handover denomination count. The roznamcha owns one
//     day's drawer: cash in, petty outflows out, a closing snapshot.
//     This log owns one advance's lifecycle: money given to a named
//     holder, spends recorded against that advance, and a close that
//     accounts for every rupee. Neither system reads or writes the
//     other, and this module holds no drawer, denomination, or
//     expense-ledger field.
//   - Money is summed in integer cents, so no float drift. A spend
//     with an impossible date (2026-02-30), a non-positive or
//     non-finite amount, a blank purpose, or no open advance to
//     belong to is refused outright, never stored half-formed.
//     A blank mohalla stays null ("not recorded"), never guessed.
//   - Closing an advance requires every rupee accounted for: the
//     remaining balance must be zero, or returned in full (the
//     returned amount is recorded), or explained by an
//     operator-recorded reason for the shortfall. A close that
//     accounts for nothing leaves the advance open and the list
//     unchanged. An overspend (spends past the amount given) shows
//     a negative remaining balance honestly and can only close
//     with a reason, never silently.
//   - A closed advance takes no further spend, and a spend can only
//     ever be recorded against an open advance.

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isRealDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidPettyDate(value) {
  return isRealDate(value);
}

export function isValidPettyMonth(value) {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

function toCents(amount) {
  const n = typeof amount === 'string' && amount.trim() !== '' ? Number(amount) : amount;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function fromCents(cents) {
  return cents / 100;
}

function formatPkr(cents) {
  return `Rs. ${fromCents(cents).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// One advance, sanitized — null when unusable. A missing note stays
// null; a missing close stays open. Nothing is ever guessed.
export function normalizeAdvance(row) {
  if (!row || typeof row !== 'object') return null;
  const id = text(row.id);
  const holder = text(row.holder);
  if (!id || !holder) return null;
  if (!isRealDate(row.dateGiven)) return null;
  const amountCents = toCents(row.amountGiven ?? row.amount);
  if (amountCents === null) return null;
  const status = row.status === 'closed' ? 'closed' : 'open';
  const out = {
    id,
    holder,
    amountGiven: fromCents(amountCents),
    dateGiven: row.dateGiven,
    note: text(row.note) || null,
    status,
    returnedAmount: null,
    closeReason: null,
    closedDate: null,
  };
  if (status === 'closed') {
    out.returnedAmount = typeof row.returnedAmount === 'number' && Number.isFinite(row.returnedAmount) && row.returnedAmount >= 0
      ? row.returnedAmount : null;
    out.closeReason = text(row.closeReason) || null;
    out.closedDate = isRealDate(row.closedDate) ? row.closedDate : null;
  }
  return out;
}

// One spend, sanitized — null when unusable. The caller checks the
// advance exists and is open; this function only checks the row.
export function normalizeSpend(row) {
  if (!row || typeof row !== 'object') return null;
  const id = text(row.id);
  const advanceId = text(row.advanceId);
  const purpose = text(row.purpose);
  if (!id || !advanceId || !purpose) return null;
  if (!isRealDate(row.date)) return null;
  const amountCents = toCents(row.amount);
  if (amountCents === null) return null;
  return {
    id,
    advanceId,
    date: row.date,
    purpose,
    mohalla: text(row.mohalla) || null,
    amount: fromCents(amountCents),
  };
}

export function normalizeAdvances(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Map();
  for (const row of list) {
    const adv = normalizeAdvance(row);
    if (adv) seen.set(adv.id, adv);
  }
  return [...seen.values()];
}

export function normalizeSpends(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Map();
  for (const row of list) {
    const spend = normalizeSpend(row);
    if (spend) seen.set(spend.id, spend);
  }
  return [...seen.values()];
}

// Last wins per advance id; a bad row leaves the list unchanged.
export function upsertAdvance(advances, row) {
  const list = normalizeAdvances(advances);
  const adv = normalizeAdvance(row);
  if (!adv) return list;
  const next = list.filter((a) => a.id !== adv.id);
  next.push(adv);
  return next;
}

// A spend only lands on an open advance. Anything else — unknown
// advance, closed advance, bad row — leaves both lists unchanged.
export function recordSpend(advances, spends, row) {
  const advList = normalizeAdvances(advances);
  const spendList = normalizeSpends(spends);
  const spend = normalizeSpend(row);
  if (!spend) return { advances: advList, spends: spendList, accepted: false };
  const target = advList.find((a) => a.id === spend.advanceId);
  if (!target || target.status !== 'open') return { advances: advList, spends: spendList, accepted: false };
  const next = spendList.filter((s) => s.id !== spend.id);
  next.push(spend);
  return { advances: advList, spends: next, accepted: true };
}

function spendsFor(advanceId, spends) {
  return spends.filter((s) => s.advanceId === advanceId);
}

function summarizeAdvance(advance, spends) {
  const rows = spendsFor(advance.id, spends);
  const spentCents = rows.reduce((sum, s) => sum + Math.round(s.amount * 100), 0);
  const givenCents = Math.round(advance.amountGiven * 100);
  const remainingCents = givenCents - spentCents;
  return {
    ...advance,
    spends: rows.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1)),
    spent: fromCents(spentCents),
    remaining: fromCents(remainingCents),
    spendCount: rows.length,
    overspent: remainingCents < 0,
  };
}

// One summary row per advance: open first, then most recent given
// date first, then holder A–Z, then id.
export function buildAdvanceSummaries(advances, spends) {
  const advList = normalizeAdvances(advances);
  const spendList = normalizeSpends(spends);
  return advList
    .map((a) => summarizeAdvance(a, spendList))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
      if (a.dateGiven !== b.dateGiven) return a.dateGiven < b.dateGiven ? 1 : -1;
      if (a.holder !== b.holder) return a.holder < b.holder ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
}

// Closing accounts for every rupee. Allowed when the remaining
// balance is zero, when the caller returns exactly the remaining
// balance (recorded on the advance), or when the caller records a
// reason for the shortfall or overspend. Anything else leaves the
// list unchanged and reports why.
export function closeAdvance(advances, spends, advanceId, options = {}) {
  const advList = normalizeAdvances(advances);
  const spendList = normalizeSpends(spends);
  const target = advList.find((a) => a.id === advanceId);
  if (!target) return { advances: advList, closed: false, reason: 'Advance not found.' };
  if (target.status === 'closed') return { advances: advList, closed: false, reason: 'Advance is already closed.' };
  const summary = summarizeAdvance(target, spendList);
  const remainingCents = Math.round(summary.remaining * 100);
  const reason = text(options.reason);
  let returnedCents = null;
  if (options.returnedAmount !== undefined && options.returnedAmount !== null && options.returnedAmount !== '') {
    const n = Number(options.returnedAmount);
    if (!Number.isFinite(n) || n < 0) return { advances: advList, closed: false, reason: 'Returned amount must be zero or more.' };
    returnedCents = Math.round(n * 100);
    if (returnedCents > remainingCents) {
      return { advances: advList, closed: false, reason: 'Returned amount cannot exceed the remaining balance.' };
    }
  }
  const accounted = remainingCents === 0
    || (returnedCents !== null && returnedCents === remainingCents)
    || reason !== '';
  if (!accounted) {
    return {
      advances: advList,
      closed: false,
      reason: 'This advance still has an unaccounted balance: return the remaining cash or record a reason for the shortfall.',
    };
  }
  const closedDate = isRealDate(options.closedDate) ? options.closedDate : null;
  const next = advList.map((a) => (a.id === advanceId
    ? {
      ...a,
      status: 'closed',
      returnedAmount: returnedCents !== null ? fromCents(returnedCents) : null,
      closeReason: reason || null,
      closedDate,
    }
    : a));
  return { advances: next, closed: true, reason: null };
}

export function pettyCashSummaryText(summaries) {
  const open = summaries.filter((s) => s.status === 'open');
  const closed = summaries.filter((s) => s.status === 'closed');
  const openGiven = open.reduce((sum, s) => sum + Math.round(s.amountGiven * 100), 0);
  const openSpent = open.reduce((sum, s) => sum + Math.round(s.spent * 100), 0);
  const openRemaining = openGiven - openSpent;
  return `${summaries.length} advance(s): ${open.length} open, ${closed.length} closed. `
    + `Open advances: given ${formatPkr(openGiven)}, spent ${formatPkr(openSpent)}, remaining ${formatPkr(openRemaining)}. `
    + `A spend can only be recorded against an open advance; closing needs the remaining cash returned or a recorded reason.`;
}

export function pettyCashHtml(summaries) {
  if (summaries.length === 0) return '<p>No advances recorded yet.</p>';
  const rows = summaries.map((s) => {
    const spendLines = s.spends.map((sp) => `<li>${escapeHtml(sp.date)} — ${escapeHtml(sp.purpose)} — ${formatPkr(Math.round(sp.amount * 100))}${sp.mohalla ? ` (${escapeHtml(sp.mohalla)})` : ' (mohalla not recorded)'}</li>`).join('');
    const closeLine = s.status === 'closed'
      ? ` Closed${s.closedDate ? ` on ${escapeHtml(s.closedDate)}` : ''}${s.returnedAmount !== null ? `, returned ${formatPkr(Math.round(s.returnedAmount * 100))}` : ''}${s.closeReason ? `, reason: ${escapeHtml(s.closeReason)}` : ''}.`
      : '';
    return `<tr><td>${escapeHtml(s.holder)}</td><td>${escapeHtml(s.dateGiven)}</td>`
      + `<td>${formatPkr(Math.round(s.amountGiven * 100))}</td><td>${formatPkr(Math.round(s.spent * 100))}</td>`
      + `<td>${formatPkr(Math.round(s.remaining * 100))}${s.overspent ? ' (overspent)' : ''}</td>`
      + `<td>${escapeHtml(s.status)}${closeLine}</td>`
      + `<td>${s.note ? escapeHtml(s.note) : '—'}</td>`
      + `<td>${spendLines ? `<ul>${spendLines}</ul>` : 'No spends yet.'}</td></tr>`;
  }).join('');
  return '<table><thead><tr><th>Holder</th><th>Given on</th><th>Given</th><th>Spent</th><th>Remaining</th><th>Status</th><th>Note</th><th>Spends</th></tr></thead>'
    + `<tbody>${rows}</tbody></table>`;
}

export function pettyCashCsv(summaries) {
  const lines = ['advance_id,holder,date_given,amount_given,spent,remaining,status,returned_amount,close_reason,spend_count'];
  for (const s of summaries) {
    lines.push([
      csvCell(s.id), csvCell(s.holder), csvCell(s.dateGiven),
      csvCell(s.amountGiven), csvCell(s.spent), csvCell(s.remaining),
      csvCell(s.status), csvCell(s.returnedAmount ?? ''),
      csvCell(s.closeReason ?? ''), csvCell(s.spendCount),
    ].join(','));
  }
  return lines.join('\n');
}

export function pettyCashFilename() {
  return 'petty-cash-advances.csv';
}
