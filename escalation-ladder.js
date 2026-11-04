// Plan 12 (Plan 1-100) — Overdue reminder escalation ladder.
//
// OVERDUE-ONLY, drafts-only. This is the counterpart of Plan 11, not a
// second copy of it: Plan 11 lists bills that fall due in a FORWARD
// window (due today up to today+N, never overdue). This ladder lists
// bills that are already PAST their due date, and puts each customer
// on exactly one of three steps by days overdue:
//
//   gentle reminder .. daysOverdue >= gentleDays (default 1)
//   firm reminder .... daysOverdue >= firmDays   (default 8)
//   final notice ..... daysOverdue >= finalDays  (default 21)
//
// A 2-day slip and a 30-day silence are therefore never the same
// case: the step, the wording, and the sort order all say so.
//
// What the ladder NEVER does, stated plainly:
//   - it never disconnects, suspends, or otherwise changes a service;
//   - it never changes a balance, a bill, or a payment record;
//   - it never creates, changes, or closes a Waada promise (Plan O
//     tracks promises separately — a Waada is not a ladder step, and
//     a ladder step is not a Waada);
//   - it sends nothing by itself. The operator taps Send, the
//     existing WhatsApp route opens with the draft prefilled, and
//     only then is the send logged (customer, step, time, channel)
//     in a log that lives apart from every payment, Waada, and
//     lifecycle record. Sending a step advances that log and nothing
//     else.
//
// One row per customer, not per bill: a customer with several
// overdue bills appears once, with the overdue amounts summed, the
// earliest due date as the row's due date, and the largest days
// overdue as the row's days overdue — so the step always follows
// the customer's most overdue bill. A bill that is due today or in
// the future never contributes here (that is Plan 11's window), a
// bill with no stored due date is never given an invented one, and
// a zero-balance customer never appears.
//
// The module is import-free by design (like pre-due-reminders.js):
// the caller supplies every bill, the today date, and the
// thresholds, and the module never reads storage, the clock, or
// the network. Every timestamp in the send log is caller-supplied,
// so a logged send always carries a real send time.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const ESCALATION_STEPS = Object.freeze({
  GENTLE: 'gentle',
  FIRM: 'firm',
  FINAL: 'final',
});

export const ESCALATION_STEP_LABELS = Object.freeze({
  gentle: 'Gentle reminder',
  firm: 'Firm reminder',
  final: 'Final notice',
});

export const DEFAULT_ESCALATION_THRESHOLDS = Object.freeze({
  gentleDays: 1,
  firmDays: 8,
  finalDays: 21,
});

export const ESCALATION_DRAFT_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

export function isValidEscalationDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Thresholds must be strictly increasing positive whole days:
// gentle < firm < final, gentle >= 1 (0 days overdue is not overdue
// at all — that bill belongs to Plan 11, not to this ladder). Any
// triple that fails that rule falls back to the defaults as a
// whole, so a mistyped threshold can never silently collapse two
// steps into one or make every record final.
export function normalizeEscalationThresholds(value) {
  const defaults = { ...DEFAULT_ESCALATION_THRESHOLDS };
  if (!value || typeof value !== 'object') return defaults;
  const field = (raw, fallback) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    const days = Math.floor(n);
    return days >= 1 ? days : fallback;
  };
  const gentleDays = field(value.gentleDays, defaults.gentleDays);
  const firmDays = field(value.firmDays, defaults.firmDays);
  const finalDays = field(value.finalDays, defaults.finalDays);
  if (!(gentleDays < firmDays && firmDays < finalDays)) return defaults;
  return { gentleDays, firmDays, finalDays };
}

function parseDate(value) {
  if (!isValidEscalationDate(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function escalationDaysBetween(fromStr, toStr) {
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function formatEscalationAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `PKR ${formatter.format(amount)}`;
}

export function formatEscalationDate(value) {
  if (!isValidEscalationDate(value)) return '';
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

// Exactly one step per days-overdue figure, or null when the figure
// is below the gentle threshold (not yet on the ladder at all).
export function stepForDaysOverdue(daysOverdue, thresholds) {
  const days = Number(daysOverdue);
  if (!Number.isFinite(days) || days < 0) return null;
  const t = normalizeEscalationThresholds(thresholds);
  if (days < t.gentleDays) return null;
  if (days < t.firmDays) return ESCALATION_STEPS.GENTLE;
  if (days < t.finalDays) return ESCALATION_STEPS.FIRM;
  return ESCALATION_STEPS.FINAL;
}

export function buildEscalationLadder({ today, thresholds, bills } = {}) {
  const t = normalizeEscalationThresholds(thresholds);
  const valid = isValidEscalationDate(today);
  const counts = {
    totalBills: 0,
    includedBills: 0,
    excludedZeroBalance: 0,
    excludedNotOverdue: 0,
    excludedUndated: 0,
    excludedUnparseable: 0,
    excludedInvalid: 0,
  };
  if (!valid) {
    return {
      valid: false, today: text(today), thresholds: t, rows: [], counts,
      stepCounts: { gentle: 0, firm: 0, final: 0 }, totalAmount: 0,
    };
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
    if (!isValidEscalationDate(dueDate)) { counts.excludedUnparseable += 1; continue; }
    const daysOverdue = escalationDaysBetween(dueDate, today);
    if (daysOverdue === null || daysOverdue <= 0) { counts.excludedNotOverdue += 1; continue; }
    const step = stepForDaysOverdue(daysOverdue, t);
    if (!step) { counts.excludedNotOverdue += 1; continue; }
    counts.includedBills += 1;
    let row = byCustomer.get(customerId);
    if (!row) {
      row = {
        customerId,
        customerName: text(bill?.customerName) || '—',
        mohalla: text(bill?.mohalla),
        amount: 0,
        dueDate,
        daysOverdue,
        billCount: 0,
        bills: [],
        step,
      };
      byCustomer.set(customerId, row);
    }
    row.amount += balanceDue;
    row.billCount += 1;
    row.bills.push({ billMonth: text(bill?.billMonth), dueDate, amount: balanceDue });
    // Earliest due date = most overdue bill = the row's step.
    if (dueDate < row.dueDate) {
      row.dueDate = dueDate;
      row.daysOverdue = daysOverdue;
      row.step = step;
    }
    if (!row.mohalla && text(bill?.mohalla)) row.mohalla = text(bill?.mohalla);
    if (row.customerName === '—' && text(bill?.customerName)) row.customerName = text(bill?.customerName);
  }
  const rows = [...byCustomer.values()].sort((a, b) => {
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    if (a.amount !== b.amount) return b.amount - a.amount;
    const an = a.customerName.toLowerCase();
    const bn = b.customerName.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return a.customerId < b.customerId ? -1 : 1;
  });
  const stepCounts = { gentle: 0, firm: 0, final: 0 };
  for (const row of rows) stepCounts[row.step] += 1;
  return {
    valid: true,
    today,
    thresholds: t,
    rows,
    counts,
    stepCounts,
    totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
  };
}

// Each step's wording differs on purpose — a gentle nudge must not
// read like a final notice. The final notice asks for payment or a
// conversation with the owner; it never promises a disconnection,
// because this ladder cannot disconnect anything.
export function buildEscalationDraft(row, variant = ESCALATION_DRAFT_VARIANTS.ROMAN) {
  const name = text(row?.customerName) || '—';
  const amount = formatEscalationAmount(row?.amount);
  const due = formatEscalationDate(row?.dueDate);
  const days = Number(row?.daysOverdue);
  const step = Object.values(ESCALATION_STEPS).includes(row?.step)
    ? row.step
    : stepForDaysOverdue(days, DEFAULT_ESCALATION_THRESHOLDS) || ESCALATION_STEPS.GENTLE;
  const dayWord = Number.isFinite(days) ? `${days} din` : '';
  if (variant === ESCALATION_DRAFT_VARIANTS.URDU) {
    if (step === ESCALATION_STEPS.FINAL) {
      return {
        variant: ESCALATION_DRAFT_VARIANTS.URDU, step,
        text: `السلام علیکم ${name}، آخری نوٹس: آپ کا بل ${amount} ${dayWord} سے واجب الادا ہے (واجب الادا تاریخ ${due})۔ برائے مہربانی فوراً ادا کریں یا مالک سے رابطہ کریں تاکہ معاملہ حل ہو سکے۔ شکریہ — شاہدرہ فائبر نیٹ۔`,
      };
    }
    if (step === ESCALATION_STEPS.FIRM) {
      return {
        variant: ESCALATION_DRAFT_VARIANTS.URDU, step,
        text: `السلام علیکم ${name}، یاد دہانی: آپ کا بل ${amount} ${dayWord} سے واجب الادا ہے (واجب الادا تاریخ ${due})۔ برائے مہربانی فوراً ادا کریں تاکہ سروس میں کوئی رکاوٹ نہ آئے۔ شکریہ — شاہدرہ فائبر نیٹ۔`,
      };
    }
    return {
      variant: ESCALATION_DRAFT_VARIANTS.URDU, step,
      text: `السلام علیکم ${name}، یاد دہانی: آپ کا بل ${amount} ${dayWord} سے واجب الادا ہے (واجب الادا تاریخ ${due})۔ برائے مہربانی جلد ادا فرما دیں۔ شکریہ — شاہدرہ فائبر نیٹ۔`,
    };
  }
  if (step === ESCALATION_STEPS.FINAL) {
    return {
      variant: ESCALATION_DRAFT_VARIANTS.ROMAN, step,
      text: `Assalam-o-Alaikum ${name}, FINAL NOTICE: aap ka bill ${amount} ${dayWord} se overdue hai (due date ${due}). Baraye meherbani foran ada karein ya owner se rabta karein taake mamla hal ho sake. Shukriya — Shahdara Fiber Net.`,
    };
  }
  if (step === ESCALATION_STEPS.FIRM) {
    return {
      variant: ESCALATION_DRAFT_VARIANTS.ROMAN, step,
      text: `Assalam-o-Alaikum ${name}, yaad dehani: aap ka bill ${amount} ${dayWord} se overdue hai (due date ${due}). Baraye meherbani foran ada karein taake service mein koi rukawat na aaye. Shukriya — Shahdara Fiber Net.`,
    };
  }
  return {
    variant: ESCALATION_DRAFT_VARIANTS.ROMAN, step,
    text: `Assalam-o-Alaikum ${name}, yaad dehani: aap ka bill ${amount} ${dayWord} se overdue hai (due date ${due}). Baraye meherbani jald ada farma dein. Shukriya — Shahdara Fiber Net.`,
  };
}

// Send log: a plain array of { customerId, step, sentAt, channel }.
// It lives apart from payment, Waada, and lifecycle records by
// construction — appending here touches none of them. Returns a NEW
// array; an entry without a customer, a valid step, or a send time
// is not recorded.
export function logEscalationSent(log, { customerId, step, sentAt, channel } = {}) {
  const list = Array.isArray(log) ? [...log] : [];
  const id = text(customerId);
  const time = text(sentAt);
  if (!id || !time || !Object.values(ESCALATION_STEPS).includes(step)) return list;
  list.push({ customerId: id, step, sentAt: time, channel: text(channel) || 'whatsapp' });
  return list;
}

export function lastEscalationSent(log, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(log)) return null;
  let found = null;
  for (const entry of log) {
    if (text(entry?.customerId) === id && text(entry?.sentAt)) found = entry;
  }
  return found;
}

export function escalationSummaryText(ladder) {
  if (!ladder?.valid) return 'Overdue escalation ladder unavailable — the ladder needs a valid today date.';
  if (ladder.rows.length === 0) return 'No overdue bills on the ladder.';
  const { gentle, firm, final } = ladder.stepCounts;
  return `${ladder.rows.length} overdue customer${ladder.rows.length === 1 ? '' : 's'}, total ${formatEscalationAmount(ladder.totalAmount)} — ${gentle} gentle, ${firm} firm, ${final} final notice${final === 1 ? '' : 's'}.`;
}

export function escalationFilename(ladder) {
  const day = isValidEscalationDate(ladder?.today) ? ladder.today : 'unknown-date';
  return `escalation-ladder-${day}.csv`;
}

function formatSentAt(sentAt) {
  const value = text(sentAt);
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return `${value.slice(0, 10)} ${value.slice(11, 16)} UTC`;
  return value;
}

export function escalationHtml(ladder, sentLog = []) {
  if (!ladder?.valid) return '<p class="empty-state">Overdue escalation ladder unavailable — the ladder needs a valid today date.</p>';
  if (ladder.rows.length === 0) return '<p class="empty-state">No overdue bills on the ladder.</p>';
  const rows = ladder.rows.map((row) => {
    const sent = lastEscalationSent(sentLog, row.customerId);
    const draft = buildEscalationDraft(row);
    const draftUrdu = buildEscalationDraft(row, ESCALATION_DRAFT_VARIANTS.URDU);
    // Plan 62: when the caller adjusted this row to its undisputed
    // portion, the preview says so — the amount shown is the
    // undisputed portion only, never the disputed amount. Rows
    // without a note render exactly as before.
    const disputeNote = text(row?.disputeNote)
      ? `<br><small>⚖️ ${escapeHtml(row.disputeNote)}</small>` : '';
    return `<tr><td><strong>${escapeHtml(row.customerName)}</strong>${row.mohalla ? `<br><small>${escapeHtml(row.mohalla)}</small>` : ''}</td><td><strong>${escapeHtml(ESCALATION_STEP_LABELS[row.step])}</strong></td><td>${formatEscalationAmount(row.amount)}</td><td>${escapeHtml(formatEscalationDate(row.dueDate))}<br><small>${row.daysOverdue} day${row.daysOverdue === 1 ? '' : 's'} overdue</small></td><td><small>${escapeHtml(draft.text)}</small>${disputeNote}<details><summary>Urdu draft</summary><small>${escapeHtml(draftUrdu.text)}</small></details></td><td>${sent ? `<small>Last sent: ${escapeHtml(ESCALATION_STEP_LABELS[sent.step] ?? sent.step)} ${escapeHtml(formatSentAt(sent.sentAt))}</small>` : '<small>Not sent</small>'}<br><button class="secondary-button btn-sm escalation-send-btn" type="button" data-customer-id="${escapeHtml(row.customerId)}">📲 Send via WhatsApp</button></td></tr>`;
  }).join('');
  return `<table class="escalation-ladder-table"><thead><tr><th>Customer</th><th>Step</th><th>Amount due</th><th>Due date</th><th>Step draft</th><th>Send</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function escalationCsv(ladder, sentLog = []) {
  const lines = ['Customer, Mohalla, Step, Amount due (PKR), Due date, Days overdue, Bills, Last sent step, Last sent at, Channel'];
  for (const row of ladder?.rows ?? []) {
    const sent = lastEscalationSent(sentLog, row.customerId);
    lines.push([
      csvCell(row.customerName), csvCell(row.mohalla), csvCell(row.step), row.amount,
      csvCell(row.dueDate), row.daysOverdue, row.billCount,
      csvCell(sent?.step ?? ''), csvCell(sent?.sentAt ?? ''), csvCell(sent?.channel ?? ''),
    ].join(','));
  }
  return lines.join('\n');
}
