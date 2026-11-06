// Plan 396 — Transaction offline queue status on this device: at the
// end of a round the operator cannot tell which transactions were
// recorded today on this phone, so the same payment risks being
// recorded twice on a second device. One view lists exactly today's
// recorded transactions on this device — customer, amount, time,
// receipt number — newest first, each marked "recorded on this
// device"; an empty day says so plainly. It lists only: it syncs
// nothing and never changes any bill, payment, or customer record.
//
// What already exists, and what this plan does NOT rebuild: the app
// already has a pending-actions queue for actions still waiting to
// sync, and the Transactions list already finds one transaction by
// its receipt number. Neither lists today's recorded transactions,
// so this module adds only that view, derived from the transaction
// rows the app already projects — no store of its own, because the
// payments already recorded on this device ARE the queue. The view
// reads the payment date for "today" (the same day the Transactions
// list groups by) and the recorded-at stamp for the time and the
// newest-first order; a payment recorded before stamps existed
// still lists, with no time instead of a guessed one.

const STRICT_QUEUE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const STRICT_QUEUE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function escapeQueueHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Whether the value is a strict YYYY-MM-DD calendar date (month
 * 01-12, a real day for that month, leap-aware). A blank, a typo, a
 * month outside 01-12, or a day that month never has — 30 February,
 * 31 April, 29 February in a common year — is never a queue date.
 */
export function isStrictQueueDate(value) {
  if (typeof value !== 'string') return false;
  const match = STRICT_QUEUE_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

// PKR in the plan modules' own shape: min-0 decimals, never more
// than two (PKR 3,000 · PKR 1,500.5). A null/undefined/empty/boolean
// figure is "not a number", never zero — a missing amount must never
// be printed as PKR 0.
export function formatQueueAmount(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `PKR ${formatter.format(amount)}`;
}

/**
 * The time a payment was recorded, as HH:MM Pakistan time, from the
 * UTC ISO stamp the recorder stores. '' when the stamp is missing
 * or unusable, so an older payment with no stamp shows no time
 * instead of a guessed one. Pure string arithmetic: Pakistan is
 * UTC+5, so only the hour shifts (past midnight wraps to the next
 * day's early hours, which is the time the stamp itself means).
 */
export function queueEntryTime(recordedAt) {
  if (typeof recordedAt !== 'string') return '';
  const match = STRICT_QUEUE_TIME.exec(recordedAt.trim());
  if (!match) return '';
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return '';
  return `${String((hour + 5) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// The receipt number a queue entry carries: the stored number
// first, then — only when the caller supplies one — the caller's
// deterministic derivation (same shape the receipt verification
// lookup uses). '' when the row carries no number at all. A throwing
// deriver never breaks the queue; it just means no derived number.
function queueReceiptNumber(row, deriveReceiptNumber) {
  if (!row || typeof row !== 'object') return '';
  const stored = String(row.receiptNumber ?? '').trim() || String(row.permanentReceiptNumber ?? '').trim();
  if (stored) return stored.slice(0, 64);
  if (typeof deriveReceiptNumber === 'function') {
    try {
      const derived = String(deriveReceiptNumber({
        customerNumber: row.customerNumber,
        paymentDate: row.date,
        paymentId: row.paymentId ?? row.id,
        billMonth: row.month,
      }) ?? '').trim();
      if (derived) return derived.slice(0, 64);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Today's recorded transactions on this device, newest first: the
 * rows whose payment date is the caller's today key, each normalised
 * to customer, amount, time, receipt number, and method. A row with
 * no strict date never matches, and a non-strict today key matches
 * nothing, so a damaged value can never invent a day. A voided row
 * stays listed as history, marked VOID. Ordered by the recorded-at
 * stamp, newest first; rows with no stamp sort last, then by payment
 * id so the order is stable. The input list is never changed.
 */
export function todayQueueEntries(rows, todayKey, { deriveReceiptNumber } = {}) {
  if (!isStrictQueueDate(todayKey)) return [];
  if (!Array.isArray(rows)) return [];
  const entries = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (!isStrictQueueDate(row.date) || row.date !== todayKey) continue;
    const recordedAt = typeof row.recordedAt === 'string' ? row.recordedAt.trim() : '';
    entries.push({
      paymentId: String(row.paymentId ?? row.id ?? ''),
      customerNumber: row.customerNumber ?? null,
      customerName: String(row.customerName ?? '').trim(),
      amount: row.amount ?? null,
      time: queueEntryTime(recordedAt),
      recordedAt,
      receiptNumber: queueReceiptNumber(row, deriveReceiptNumber),
      method: String(row.method ?? '').trim(),
      date: row.date,
      voided: row.voided === true,
    });
  }
  entries.sort((a, b) => {
    if (a.recordedAt && b.recordedAt) {
      if (a.recordedAt !== b.recordedAt) return b.recordedAt.localeCompare(a.recordedAt);
    } else if (a.recordedAt) {
      return -1;
    } else if (b.recordedAt) {
      return 1;
    }
    return String(a.paymentId).localeCompare(String(b.paymentId));
  });
  return entries;
}

/**
 * "3 payments · PKR 9,000" for the queue heading, or '' for an empty
 * queue. Only finite amounts count toward the total, so a missing
 * amount never counts as zero.
 */
export function offlineQueueSummaryText(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return '';
  let total = 0;
  for (const entry of list) {
    const amount = Number(entry?.amount);
    if (Number.isFinite(amount)) total += amount;
  }
  const count = list.length === 1 ? '1 payment' : `${list.length} payments`;
  return `${count} · ${formatQueueAmount(total)}`;
}

/**
 * One queue row: "#36 Customer Name · PKR 3,000 · 14:32 ·
 * RCPT-41-202611-01 · Cash · recorded on this device". Always
 * escaped; a row with no receipt number says so plainly; a row with
 * no time says so plainly; a voided row carries a VOID mark.
 */
export function offlineQueueRowMarkup(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const name = escapeQueueHtml(entry.customerName || 'Unknown customer');
  const number = entry.customerNumber === null || entry.customerNumber === undefined || entry.customerNumber === ''
    ? '' : `#${escapeQueueHtml(entry.customerNumber)} `;
  const amount = escapeQueueHtml(formatQueueAmount(entry.amount));
  const time = entry.time ? escapeQueueHtml(entry.time) : 'No time recorded';
  const receipt = entry.receiptNumber ? escapeQueueHtml(entry.receiptNumber) : 'No receipt number';
  const method = entry.method ? escapeQueueHtml(entry.method) : 'No method';
  const voided = entry.voided === true ? ' <span class="oqs-void">VOID</span>' : '';
  return `<li class="oqs-row"><span class="oqs-customer">${number}${name}</span><span class="oqs-amount">${amount}</span><span class="oqs-meta">${time} · ${receipt} · ${method}</span>${voided}<span class="oqs-mark">recorded on this device</span></li>`;
}

/**
 * The whole queue section: heading, summary, and one row per entry
 * — or the plain empty-day message when nothing was recorded today.
 * Lists only: no buttons, no sync, no record changes.
 */
export function offlineQueueSectionHtml(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) {
    return '<h3 class="oqs-heading">Today on this device</h3><p class="oqs-empty">No payments recorded on this device today.</p>';
  }
  const summary = offlineQueueSummaryText(list);
  const rows = list.map((entry) => offlineQueueRowMarkup(entry)).join('');
  return `<h3 class="oqs-heading">Today on this device</h3><p class="oqs-summary">${escapeQueueHtml(summary)}</p><ul class="oqs-list">${rows}</ul>`;
}
