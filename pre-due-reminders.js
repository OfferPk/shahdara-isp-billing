// Plan 11 (Plan 1-100) — Pre-due reminder queue with WhatsApp-ready drafts.
//
// READ-ONLY queue, plus a draft, plus a send log. It changes no billing
// figure, no Waada promise, and no disconnection rule, and it sends
// nothing by itself: the operator taps Send, the existing WhatsApp
// route opens with the draft prefilled, and only then is the send
// logged (time, channel) in a log that lives apart from every payment
// and promise record.
//
// What is new here, stated plainly against the existing reminder
// system (reminder-queue.js): the existing "Reminders Today" queue is
// stage-based — it fires on the exact day a stage matches (2 days
// before due, on due, +3/+7/+15 days) and walks customers one at a
// time. This queue is a forward WINDOW list instead: every customer
// whose bill falls due within the next operator-set window (default
// 3 days), all at once, earliest due date first, each with a
// ready-made bilingual draft. It does not replace the stage queue,
// its cooldowns, its shields, or its history; it is the "who is due
// soon" list the owner checks before the due date arrives.
//
// Window rule (inclusive on both ends, calendar days, no clock read):
//   - dueDate == today ............ included (due today, not yet late)
//   - today < dueDate <= today+N .. included
//   - dueDate < today ............. excluded (already overdue — that
//     is Plan 12's escalation ladder, not a pre-due reminder)
//   - dueDate > today+N ........... excluded (outside the window)
//   - no dueDate, or an unparseable dueDate ... excluded, counted,
//     never given an invented due date (a bill month's 5th is NOT
//     assumed when no due date is stored)
//   - balance due <= 0 ............ never appears, counted
//
// One row per customer, not per bill: a customer with several bills
// due inside the window appears once, with the in-window amounts
// summed, the earliest in-window due date as the row's due date, and
// the contributing bills listed. A bill due outside the window never
// contributes to the row's amount, even for a customer who is listed
// for another bill.
//
// The module is import-free by design (like owner-digest.js and
// receivables-ageing.js): the caller supplies every bill, the today
// date, and the window, and the module never reads storage, the
// clock, or the network. Every timestamp in the send log is
// caller-supplied, so a logged send always carries a real send time.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const DEFAULT_PRE_DUE_WINDOW_DAYS = 3;

export const PRE_DUE_DRAFT_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

export function isValidPreDueDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function normalizePreDueWindowDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_PRE_DUE_WINDOW_DAYS;
  const days = Math.floor(n);
  return days > 0 ? days : DEFAULT_PRE_DUE_WINDOW_DAYS;
}

function parseDate(value) {
  if (!isValidPreDueDate(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addPreDueDays(dateStr, days) {
  const date = parseDate(dateStr);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

export function preDueDaysBetween(fromStr, toStr) {
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function formatPreDueAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `PKR ${formatter.format(amount)}`;
}

export function formatPreDueDate(value) {
  if (!isValidPreDueDate(value)) return '';
  const [y, m, d] = value.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildPreDueReminderQueue({ today, windowDays, bills } = {}) {
  const window = normalizePreDueWindowDays(windowDays);
  const valid = isValidPreDueDate(today);
  const windowEnd = valid ? addPreDueDays(today, window) : null;
  const counts = {
    totalBills: 0,
    includedBills: 0,
    excludedZeroBalance: 0,
    excludedOverdue: 0,
    excludedOutsideWindow: 0,
    excludedUndated: 0,
    excludedUnparseable: 0,
    excludedInvalid: 0,
  };
  if (!valid) {
    return { valid: false, today: text(today), windowDays: window, windowEnd: null, rows: [], counts, totalAmount: 0 };
  }
  const byCustomer = new Map();
  for (const bill of Array.isArray(bills) ? bills : []) {
    counts.totalBills += 1;
    const customerId = text(bill?.customerId);
    if (!customerId) { counts.excludedInvalid += 1; continue; }
    const balanceDue = money(bill?.balanceDue);
    if (!(balanceDue > 0)) { counts.excludedZeroBalance += 1; continue; }
    const dueDate = text(bill?.dueDate);
    if (!dueDate) { counts.excludedUndated += 1; continue; }
    if (!isValidPreDueDate(dueDate)) { counts.excludedUnparseable += 1; continue; }
    const daysLeft = preDueDaysBetween(today, dueDate);
    if (daysLeft < 0) { counts.excludedOverdue += 1; continue; }
    if (daysLeft > window) { counts.excludedOutsideWindow += 1; continue; }
    counts.includedBills += 1;
    let row = byCustomer.get(customerId);
    if (!row) {
      row = {
        customerId,
        customerName: text(bill?.customerName) || '—',
        mohalla: text(bill?.mohalla),
        amount: 0,
        dueDate,
        daysLeft,
        billCount: 0,
        bills: [],
      };
      byCustomer.set(customerId, row);
    }
    row.amount += balanceDue;
    row.billCount += 1;
    row.bills.push({ billMonth: text(bill?.billMonth), dueDate, amount: balanceDue });
    if (dueDate < row.dueDate) { row.dueDate = dueDate; row.daysLeft = daysLeft; }
    if (!row.mohalla && text(bill?.mohalla)) row.mohalla = text(bill?.mohalla);
    if (row.customerName === '—' && text(bill?.customerName)) row.customerName = text(bill?.customerName);
  }
  const rows = [...byCustomer.values()].sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    const an = a.customerName.toLowerCase();
    const bn = b.customerName.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return a.customerId < b.customerId ? -1 : 1;
  });
  return {
    valid: true,
    today,
    windowDays: window,
    windowEnd,
    rows,
    counts,
    totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
  };
}

export function buildPreDueReminderDraft(row, variant = PRE_DUE_DRAFT_VARIANTS.ROMAN) {
  const name = text(row?.customerName) || '—';
  const amount = formatPreDueAmount(row?.amount);
  const due = formatPreDueDate(row?.dueDate);
  if (variant === PRE_DUE_DRAFT_VARIANTS.URDU) {
    return {
      variant: PRE_DUE_DRAFT_VARIANTS.URDU,
      text: `السلام علیکم ${name}، یاد دہانی: آپ کا بل ${amount} ${due} تک ادا کرنا ہے۔ برائے مہربانی وقت پر ادا فرما دیں۔ شکریہ — شاہدرہ فائبر نیٹ۔`,
    };
  }
  return {
    variant: PRE_DUE_DRAFT_VARIANTS.ROMAN,
    text: `Assalam-o-Alaikum ${name}, yaad dehani: aap ka bill ${amount} ${due} tak ada karna hai. Baraye meherbani waqt par ada farma dein. Shukriya — Shahdara Fiber Net.`,
  };
}

// Send log: a plain array of { customerId, sentAt, channel }. It lives
// apart from payment and promise records by construction — appending
// here touches no payment, no Waada, and no bill. Returns a NEW array;
// a log entry without a customer or a send time is not recorded.
export function logReminderSent(log, { customerId, sentAt, channel } = {}) {
  const list = Array.isArray(log) ? [...log] : [];
  const id = text(customerId);
  const time = text(sentAt);
  if (!id || !time) return list;
  list.push({ customerId: id, sentAt: time, channel: text(channel) || 'whatsapp' });
  return list;
}

export function reminderSentAt(log, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(log)) return null;
  let found = null;
  for (const entry of log) {
    if (text(entry?.customerId) === id && text(entry?.sentAt)) found = entry.sentAt;
  }
  return found;
}

export function preDueReminderSummaryText(queue) {
  if (!queue?.valid) return 'Pre-due reminder queue unavailable — the queue needs a valid today date.';
  if (queue.rows.length === 0) {
    return `No bills fall due in the next ${queue.windowDays} day${queue.windowDays === 1 ? '' : 's'} (by ${formatPreDueDate(queue.windowEnd)}).`;
  }
  return `${queue.rows.length} customer${queue.rows.length === 1 ? '' : 's'} due within ${queue.windowDays} day${queue.windowDays === 1 ? '' : 's'} (by ${formatPreDueDate(queue.windowEnd)}), total ${formatPreDueAmount(queue.totalAmount)}.`;
}

export function preDueReminderFilename(queue) {
  const day = isValidPreDueDate(queue?.today) ? queue.today : 'unknown-date';
  return `pre-due-reminders-${day}-${queue?.windowDays ?? DEFAULT_PRE_DUE_WINDOW_DAYS}d.csv`;
}

function formatSentAt(sentAt) {
  const value = text(sentAt);
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return `${value.slice(0, 10)} ${value.slice(11, 16)} UTC`;
  return value;
}

export function preDueReminderHtml(queue, sentLog = []) {
  if (!queue?.valid) return '<p class="empty-state">Pre-due reminder queue unavailable — the queue needs a valid today date.</p>';
  if (queue.rows.length === 0) return '<p class="empty-state">No bills fall due in this window.</p>';
  const rows = queue.rows.map((row) => {
    const sentAt = reminderSentAt(sentLog, row.customerId);
    const draft = buildPreDueReminderDraft(row);
    const draftUrdu = buildPreDueReminderDraft(row, PRE_DUE_DRAFT_VARIANTS.URDU);
    return `<tr><td><strong>${escapeHtml(row.customerName)}</strong>${row.mohalla ? `<br><small>${escapeHtml(row.mohalla)}</small>` : ''}</td><td>${formatPreDueAmount(row.amount)}</td><td>${escapeHtml(formatPreDueDate(row.dueDate))}<br><small>${row.daysLeft === 0 ? 'Due today' : `in ${row.daysLeft} day${row.daysLeft === 1 ? '' : 's'}`}</small></td><td><small>${escapeHtml(draft.text)}</small><details><summary>Urdu draft</summary><small>${escapeHtml(draftUrdu.text)}</small></details></td><td>${sentAt ? `<small>Sent ${escapeHtml(formatSentAt(sentAt))}</small>` : '<small>Not sent</small>'}<br><button class="secondary-button btn-sm pre-due-send-btn" type="button" data-customer-id="${escapeHtml(row.customerId)}">📲 Send via WhatsApp</button></td></tr>`;
  }).join('');
  return `<table class="pre-due-reminders-table"><thead><tr><th>Customer</th><th>Amount due</th><th>Due date</th><th>Reminder draft</th><th>Send</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function preDueReminderCsv(queue, sentLog = []) {
  const lines = ['Customer, Mohalla, Amount due (PKR), Due date, Days left, Bills, Sent at, Channel'];
  for (const row of queue?.rows ?? []) {
    const sentAt = reminderSentAt(sentLog, row.customerId);
    const channel = Array.isArray(sentLog) ? (sentLog.filter((e) => text(e?.customerId) === row.customerId).pop()?.channel ?? '') : '';
    lines.push([
      csvCell(row.customerName), csvCell(row.mohalla), row.amount,
      csvCell(row.dueDate), row.daysLeft, row.billCount,
      csvCell(sentAt ?? ''), csvCell(channel),
    ].join(','));
  }
  return lines.join('\n');
}
