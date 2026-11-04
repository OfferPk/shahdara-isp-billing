// Plan 90 (Plan 1-100) — Collector cash-in-hand limit with a handover prompt.
//
// A collector can end up carrying a whole day's cash — or more, if a
// handover slips — with no agreed point at which the money must be
// handed over. This module answers one question only: "how much
// unhanded-over cash is the collector carrying right now, and has
// the operator-set limit been reached?" When it has, Field Mode
// shows a plain handover prompt with the amount held and the route
// to the handover screen (Plan S).
//
// Scope fence, stated plainly:
//   - This is a prompt only. It never locks collection, blocks a
//     payment, merges or deletes a payment, or changes any total.
//     The denomination count (Plan 4) still records what is actually
//     handed over; this module never touches it, and never reads or
//     writes any payment, handover, or denomination record itself:
//     the caller supplies every receipt and whether a handover is
//     recorded, and the module only validates, sums, and compares.
//   - It is import-free: it never reads storage, the clock, or the
//     network, and never mutates an input.
//   - Amounts are integer cents. A row carrying amountCents is used
//     as-is; a row carrying only a rupee amount converts once
//     (rounded to the nearest cent), so a stored record re-read
//     through the normaliser never inflates.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). A voided row, an explicitly non-cash
//     row, or a row with no usable date or amount is dropped, never
//     counted on a guessed figure.
//   - The prompt appears exactly when the held cash reaches the
//     limit (equal counts as reached) and clears when a handover is
//     recorded for the day. A collector below the limit sees no
//     prompt. An unset, zero, negative, or non-numeric limit means
//     no limit is set, so no prompt ever shows — a limit of zero
//     would otherwise prompt on the first rupee.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const s = text(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function formatCashCents(cents) {
  if (!Number.isFinite(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

export function validCashDate(value) {
  const match = DATE_RE.exec(text(value));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function centsOf(row, centsField, rupeeField) {
  if (row && Number.isFinite(row[centsField])) return Math.round(row[centsField]);
  if (row && Number.isFinite(row[rupeeField])) return Math.round(row[rupeeField] * 100);
  if (row && typeof row[rupeeField] === 'string' && row[rupeeField].trim() !== '' && Number.isFinite(Number(row[rupeeField]))) {
    return Math.round(Number(row[rupeeField]) * 100);
  }
  return null;
}

function methodOf(row) {
  const method = text(row.method || row.channel || row.paymentMethod || '');
  return method.toLowerCase();
}

// Normalise one cash receipt row for the held-cash sum. Returns null
// for rows that must never count: voided rows, explicitly non-cash
// rows (isCash false, or a method/channel that is not cash), and
// rows with no usable date or positive amount.
export function normalizeCashReceipt(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.voided === true) return null;
  if (row.isCash === false) return null;
  const method = methodOf(row);
  if (method !== '' && method !== 'cash') return null;
  const date = text(row.date);
  if (!validCashDate(date)) return null;
  const amountCents = centsOf(row, 'amountCents', 'amount');
  if (amountCents === null || amountCents <= 0) return null;
  return {
    date,
    customerId: text(row.customerId || row.customer || ''),
    customerName: text(row.customerName || row.customer || row.paidBy || '') || text(row.customerId || row.customer || ''),
    collector: text(row.collectorName || row.shopName || row.paidBy || row.collector || ''),
    amountCents,
  };
}

export function normalizeCashReceipts(list) {
  if (!Array.isArray(list)) return [];
  return list.map((row) => normalizeCashReceipt(row)).filter(Boolean);
}

// The limit is operator-set. Only a positive limit counts; anything
// else means no limit is set and no prompt ever shows. Accepts
// limitCents directly, or a rupee figure under `limit`.
export function normalizeCashLimitSettings(raw) {
  const settings = { limitCents: null };
  if (!raw || typeof raw !== 'object') return settings;
  if (Number.isFinite(raw.limitCents) && raw.limitCents > 0) {
    settings.limitCents = Math.round(raw.limitCents);
    return settings;
  }
  if (Number.isFinite(raw.limit) && raw.limit > 0) {
    settings.limitCents = Math.round(raw.limit * 100);
    return settings;
  }
  if (typeof raw.limit === 'string' && raw.limit.trim() !== '' && Number.isFinite(Number(raw.limit)) && Number(raw.limit) > 0) {
    settings.limitCents = Math.round(Number(raw.limit) * 100);
  }
  return settings;
}

function collectorMatches(row, collector) {
  const wanted = text(collector);
  if (wanted === '' || wanted.toLowerCase() === 'all') return true;
  return row.collector === wanted;
}

// Sum the caller's receipts: the receipts since the last handover
// for one day and, optionally, one collector. When a handover is
// recorded for the day, the day's cash is covered, so the held
// figure is zero and the prompt clears.
export function sumCashInHand(receipts, { date = '', collector = '', handoverRecorded = false } = {}) {
  if (handoverRecorded === true) return { heldCents: 0, receiptCount: 0, receipts: [] };
  const wantedDate = text(date);
  const rows = normalizeCashReceipts(receipts).filter((row) => {
    if (wantedDate !== '' && row.date !== wantedDate) return false;
    return collectorMatches(row, collector);
  });
  return {
    heldCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
    receiptCount: rows.length,
    receipts: rows,
  };
}

// Full status for one day and collector: the held figure, the
// limit, and whether the handover prompt shows. The prompt shows
// exactly when the limit is set, no handover is recorded, and the
// held cash has reached the limit.
export function buildCashInHandStatus({ receipts, settings, handoverRecorded = false, date = '', collector = '' } = {}) {
  const cleanSettings = normalizeCashLimitSettings(settings);
  const sum = sumCashInHand(receipts, { date, collector, handoverRecorded });
  const limitCents = cleanSettings.limitCents;
  const limitSet = limitCents !== null;
  const prompt = limitSet && handoverRecorded !== true && sum.heldCents >= limitCents;
  return {
    date: text(date),
    collector: text(collector),
    heldCents: sum.heldCents,
    receiptCount: sum.receiptCount,
    receipts: sum.receipts,
    limitCents,
    limitSet,
    handedOver: handoverRecorded === true,
    prompt,
    overByCents: prompt ? sum.heldCents - limitCents : 0,
  };
}

export function cashInHandSummaryText(status) {
  if (!status) return 'No cash-in-hand figure available.';
  if (status.handedOver) return 'Cash handed over — nothing held.';
  const held = `${formatCashCents(status.heldCents)} held across ${status.receiptCount} receipt${status.receiptCount === 1 ? '' : 's'}`;
  if (!status.limitSet) return `${held}. No cash-in-hand limit set yet, so no prompt shows.`;
  if (status.prompt) return `${held} — at or over the ${formatCashCents(status.limitCents)} limit. Hand over cash now.`;
  return `${held}, below the ${formatCashCents(status.limitCents)} limit. No prompt.`;
}

// The Field Mode prompt: plain words, the amount held, and the
// route to the handover screen. Empty unless the prompt shows, so a
// collector below the limit sees nothing.
export function cashInHandPromptHtml(status) {
  if (!status || !status.prompt) return '';
  return `<p class="cash-in-hand-prompt"><strong>Hand over cash now — ${escapeHtml(formatCashCents(status.heldCents))} held, at or over the ${escapeHtml(formatCashCents(status.limitCents))} limit.</strong> Use the route sheet's 'Hand over cash' step to open the cash handover screen. This prompt advises only; it never blocks a payment or changes a total.</p>`;
}

export function cashInHandReceiptsHtml(receipts) {
  const rows = normalizeCashReceipts(receipts);
  if (rows.length === 0) return '<p class="empty-state">No unhanded-over cash receipts for this day.</p>';
  const lines = rows.map((row) => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.customerName || '—')}</td><td>${escapeHtml(row.collector || '—')}</td><td>${escapeHtml(formatCashCents(row.amountCents))}</td></tr>`).join('');
  return `<table class="cash-in-hand-table"><thead><tr><th>Date</th><th>Customer</th><th>Collector</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>`;
}

export function cashInHandCsv(receipts) {
  const rows = normalizeCashReceipts(receipts);
  const lines = ['date,customer,collector,amount'];
  for (const row of rows) {
    lines.push([row.date, row.customerName, row.collector, (row.amountCents / 100).toFixed(2)].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function cashInHandFilename() {
  return 'cash-in-hand.csv';
}
