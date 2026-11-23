// Plan 72 (Plan 1-100) — Balance enquiry reply draft (customer
// asked, operator sends).
//
// A customer who messages "mera balance kitna hai?" gets a
// typed-from-memory answer, so the figure can be stale, rounded,
// or missing the due date, and the next question is the same one
// again. This module is the same-shaped answer every time: a
// bilingual balance reply draft composed from existing figures —
// current outstanding, next due date, and last payment (amount
// and date) — plus, where a dispute case (Plan 61) is open, the
// undisputed balance with a note that a case is open.
//
// The fences, stated plainly:
//   - Drafting or sending never changes any bill, payment, or
//     Waada record. The module holds no bill total, payment row,
//     or Waada field of its own: the ledger figures it prints are
//     caller-supplied, carried verbatim, and never written back
//     anywhere. Sending is by the operator through the existing
//     WhatsApp route only; nothing here sends anything on its
//     own, and every send is logged.
//   - It never touches the disputed-balance split (Plan 62)
//     except to show the undisputed balance: the caller supplies
//     the customer's open Plan 61 cases, this module sums their
//     disputed amounts, and the balance shown is outstanding
//     minus disputed, floored at zero, with any excess reported
//     separately — never a negative balance, never a forced fit.
//   - A customer with a zero balance gets a "no amount due"
//     wording, never a zero presented as a demand.
//   - Money is integer cents throughout, so no float drift. A
//     missing or unusable outstanding figure refuses the whole
//     draft — never zero-filled, never guessed. A missing due
//     date or last payment is said plainly ("not recorded"),
//     never invented.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is
//     not a date). Inputs are never mutated, and the module never
//     reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const BALANCE_REPLY_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// A ledger figure in integer cents, or null when missing or
// unusable. Zero is a real figure; a blank, a boolean, a
// non-finite value, or a negative amount is not a figure at all.
function toLedgerCents(amount) {
  if (typeof amount === 'boolean' || amount === null || amount === undefined) return null;
  if (typeof amount === 'string' && amount.trim() === '') return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function fromCents(cents) {
  return cents / 100;
}

export function normalizeBalanceReplyVariant(value) {
  const raw = text(value).toLowerCase();
  return raw === BALANCE_REPLY_VARIANTS.URDU ? BALANCE_REPLY_VARIANTS.URDU : BALANCE_REPLY_VARIANTS.ROMAN;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validBalanceReplyDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  const match = DATE_RE.exec(datePart);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

function formatAmount(value) {
  return value === null || value === undefined ? null : `Rs. ${value}`;
}

// The last payment, or null: both a usable positive amount and a
// strict date are required. A payment with no amount or no date
// is not shown as a last payment — the draft says plainly that
// no payment is recorded, rather than printing half a payment.
function normalizeLastPayment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amountCents = toLedgerCents(raw.amount);
  const date = validBalanceReplyDate(raw.date);
  if (amountCents === null || amountCents <= 0 || !date) return null;
  return { amountCents, amount: fromCents(amountCents), date };
}

// The open dispute total for one customer, from the caller's
// list of open Plan 61 cases. Entries with no usable disputed
// amount are counted, never zero-filled into the total.
function disputeTotal(openDisputes) {
  const list = Array.isArray(openDisputes) ? openDisputes : [];
  let disputedCents = 0;
  let unusableDisputes = 0;
  for (const entry of list) {
    const cents = toLedgerCents(entry?.disputedAmount);
    if (cents === null) {
      unusableDisputes += 1;
    } else {
      disputedCents += cents;
    }
  }
  return { disputedCents, unusableDisputes, count: list.length };
}

function buildBalanceReplyText(reply) {
  const name = reply.customerName || reply.customerId;
  if (reply.variant === BALANCE_REPLY_VARIANTS.URDU) {
    const parts = [`السلام علیکم ${name}،`];
    if (reply.balanceKind === 'none') {
      parts.push('اس وقت آپ پر کوئی رقم واجب الادا نہیں ہے۔');
    } else if (reply.hasOpenDispute && reply.balanceCents === 0) {
      parts.push('اس وقت آپ پر کوئی غیر متنازعہ رقم واجب الادا نہیں ہے۔');
    } else if (reply.hasOpenDispute) {
      parts.push(`آپ کا غیر متنازعہ بقایا: ${formatAmount(reply.balance)}۔`);
    } else {
      parts.push(`آپ کا موجودہ بقایا: ${formatAmount(reply.balance)}۔`);
    }
    if (reply.dueDate) {
      parts.push(`ادائیگی کی آخری تاریخ: ${reply.dueDate}۔`);
    } else {
      parts.push('ادائیگی کی آخری تاریخ درج نہیں ہے۔');
    }
    if (reply.lastPayment) {
      parts.push(`آخری ادائیگی: ${formatAmount(reply.lastPayment.amount)}، تاریخ ${reply.lastPayment.date}۔`);
    } else {
      parts.push('ابھی تک کوئی ادائیگی درج نہیں ہے۔');
    }
    if (reply.hasOpenDispute) {
      parts.push(`نوٹ: آپ کے بل پر ایک تنازعہ زیر غور ہے (${formatAmount(reply.disputedAmount)})۔ اوپر دی گئی رقم میں متنازعہ رقم شامل نہیں ہے۔`);
      if (reply.excessCents > 0) {
        parts.push(`متنازعہ رقم بقایا سے ${formatAmount(fromCents(reply.excessCents))} زیادہ ہے۔`);
      }
    }
    parts.push('— شاہدرہ فائبر نیٹ');
    return parts.join('\n');
  }
  // Profile Billing tab M3 (Specs P+Q+R, 2026-11-22) — the 'roman'
  // variant is Roman Urdu, not English: the draft a customer reads on
  // WhatsApp speaks the operator's language. The Urdu-script branch
  // above is untouched (Plan 72 pins it); only this branch changes,
  // and every figure (amount, date, dispute) renders exactly as before.
  const parts = [`Assalam-o-Alaikum ${name},`];
  if (reply.balanceKind === 'none') {
    parts.push('Aap ka koi baqaya baqi nahi hai.');
  } else if (reply.hasOpenDispute && reply.balanceCents === 0) {
    parts.push('Aap ka koi ghair-mutanaziah baqaya baqi nahi hai.');
  } else if (reply.hasOpenDispute) {
    parts.push(`Aap ka ghair-mutanaziah baqaya ${formatAmount(reply.balance)} hai.`);
  } else {
    parts.push(`Aap ka maujooda baqaya ${formatAmount(reply.balance)} hai.`);
  }
  if (reply.dueDate) {
    parts.push(`Adaigi ki aakhri tareekh: ${reply.dueDate}.`);
  } else {
    parts.push('Adaigi ki aakhri tareekh darj nahi hai.');
  }
  if (reply.lastPayment) {
    parts.push(`Aakhri adaigi: ${formatAmount(reply.lastPayment.amount)}, tareekh ${reply.lastPayment.date}.`);
  } else {
    parts.push('Abhi tak koi adaigi darj nahi hai.');
  }
  if (reply.hasOpenDispute) {
    parts.push(`Note: aap ke bill par aik tanaziah case khula hua hai (${formatAmount(reply.disputedAmount)}). Upar di gayi raqam mein mutanaziah raqam shamil nahi hai.`);
    if (reply.excessCents > 0) {
      parts.push(`Mutanaziah raqam baqaya se ${formatAmount(fromCents(reply.excessCents))} zyada hai.`);
    }
  }
  parts.push('— Shahdara Fiber Net');
  return parts.join('\n');
}

// Build one balance reply draft, or null when the outstanding
// figure itself is missing or unusable. The caller supplies the
// ledger figures (outstanding in PKR, next due date, last
// payment, and the customer's open Plan 61 cases); this module
// composes them and invents nothing. The payment-instruction
// line for the customer's preferred channel (Plan 40) is appended
// by the caller with withPaymentInstructions, as other drafts do.
export function buildBalanceReply({
  customerId,
  customerName,
  outstanding,
  dueDate,
  lastPayment,
  openDisputes,
  variant,
} = {}) {
  const outstandingCents = toLedgerCents(outstanding);
  if (outstandingCents === null) return null;
  const id = text(customerId);
  const dispute = disputeTotal(openDisputes);
  const hasOpenDispute = dispute.count > 0;
  const undisputedCents = Math.max(0, outstandingCents - dispute.disputedCents);
  const excessCents = Math.max(0, dispute.disputedCents - outstandingCents);
  const balanceKind = outstandingCents === 0 ? 'none' : (hasOpenDispute ? 'undisputed' : 'due');
  const balanceCents = hasOpenDispute ? undisputedCents : outstandingCents;
  const reply = {
    customerId: id,
    customerName: text(customerName),
    outstandingCents,
    outstanding: fromCents(outstandingCents),
    disputedCents: dispute.disputedCents,
    disputedAmount: fromCents(dispute.disputedCents),
    undisputedCents,
    excessCents,
    unusableDisputes: dispute.unusableDisputes,
    hasOpenDispute,
    openDisputeCount: dispute.count,
    balanceKind,
    balanceCents,
    balance: fromCents(balanceCents),
    dueDate: validBalanceReplyDate(dueDate),
    lastPayment: normalizeLastPayment(lastPayment),
    variant: normalizeBalanceReplyVariant(variant),
  };
  reply.text = buildBalanceReplyText(reply);
  return reply;
}

// Plan 600 — the preview chrome renders through a caller-supplied
// labels object (the 591 header-strip pattern), so this module stays
// import-free. Defaults are the English strings, so old callers (and
// old tests) keep byte-identical output. 'Customer:' is shared with
// info-card, 'Current balance:' with payment-slip (one key each).
const DEFAULT_BALANCE_REPLY_LABELS = {
  unavailable: 'Balance reply unavailable — the outstanding figure is missing or unusable.',
  noAmountDue: 'No amount due.',
  noUndisputed: 'No undisputed amount due (disputed {disputed} not included).',
  undisputed: 'Undisputed balance {amount} (disputed {disputed} not included).',
  current: 'Current balance {amount}.',
  notSent: 'Balance reply not sent yet.',
  sent1: 'Balance reply sent on {date}.',
  sentN1: 'Balance reply sent on {date} and 1 more time — re-send anytime from here.',
  sentN: 'Balance reply sent on {date} and {count} more times — re-send anytime from here.',
  customer: 'Customer:',
  noDueLine: 'Balance: no amount due',
  noUndisputedLine: 'Balance: no undisputed amount due (disputed {disputed} not included)',
  undisputedLine: 'Undisputed balance: {amount} (disputed {disputed} not included)',
  currentLine: 'Current balance:',
  dueDate: 'Due date:',
  dueNotRecorded: 'Due date: not recorded',
  lastPaymentLine: 'Last payment: {amount} on {date}',
  lastNone: 'Last payment: none recorded',
  disputeEntries: 'Dispute entries with no usable amount: {count} (not counted)',
};
function balLabel(labels, key) {
  return (labels && typeof labels[key] === 'string' && labels[key] !== '') ? labels[key] : DEFAULT_BALANCE_REPLY_LABELS[key];
}
function balFill(template, params) {
  let out = String(template);
  for (const [k, v] of Object.entries(params || {})) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export function balanceReplySummaryText(reply, labels = DEFAULT_BALANCE_REPLY_LABELS) {
  if (!reply) return balLabel(labels, 'unavailable');
  if (reply.balanceKind === 'none') return balLabel(labels, 'noAmountDue');
  if (reply.hasOpenDispute && reply.balanceCents === 0) return balFill(balLabel(labels, 'noUndisputed'), { disputed: formatAmount(reply.disputedAmount) });
  if (reply.hasOpenDispute) return balFill(balLabel(labels, 'undisputed'), { amount: formatAmount(reply.balance), disputed: formatAmount(reply.disputedAmount) });
  return balFill(balLabel(labels, 'current'), { amount: formatAmount(reply.balance) });
}

// Append a send to the log (customer, time, channel, variant),
// returning a new list. Entries without a customer id or a send
// time are ignored: a logged send always carries a real send
// time. The log never touches a bill, payment, case, or Waada
// record.
export function logBalanceReplySent(log, { customerId, sentAt, channel, variant } = {}) {
  const list = Array.isArray(log) ? [...log] : [];
  const customer = text(customerId);
  const time = text(sentAt);
  if (!customer || !time) return list;
  list.push({
    customerId: customer,
    sentAt: time,
    channel: text(channel) || 'whatsapp',
    variant: normalizeBalanceReplyVariant(variant),
  });
  return list;
}

export function findBalanceReplySends(log, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(log)) return [];
  return log.filter((entry) => text(entry?.customerId) === id);
}

export function balanceReplySentText(sends, labels = DEFAULT_BALANCE_REPLY_LABELS) {
  const list = Array.isArray(sends) ? sends : [];
  if (list.length === 0) return balLabel(labels, 'notSent');
  const first = list[0];
  const datePart = text(first?.sentAt).slice(0, 10);
  const shown = validBalanceReplyDate(datePart) || datePart;
  if (list.length === 1) return balFill(balLabel(labels, 'sent1'), { date: shown });
  if (list.length - 1 === 1) return balFill(balLabel(labels, 'sentN1'), { date: shown });
  return balFill(balLabel(labels, 'sentN'), { date: shown, count: list.length - 1 });
}

export function balanceReplyHtml(reply, { draftText = '', sends = [], labels = DEFAULT_BALANCE_REPLY_LABELS } = {}) {
  if (!reply) return `<p class="empty-state">${escapeHtml(balLabel(labels, 'unavailable'))}</p>`;
  const fields = [
    `${balLabel(labels, 'customer')} ${escapeHtml(reply.customerName || reply.customerId)}`,
    reply.balanceKind === 'none'
      ? balLabel(labels, 'noDueLine')
      : (reply.hasOpenDispute && reply.balanceCents === 0
        ? balFill(balLabel(labels, 'noUndisputedLine'), { disputed: escapeHtml(formatAmount(reply.disputedAmount)) })
        : (reply.hasOpenDispute
          ? balFill(balLabel(labels, 'undisputedLine'), { amount: escapeHtml(formatAmount(reply.balance)), disputed: escapeHtml(formatAmount(reply.disputedAmount)) })
          : `${balLabel(labels, 'currentLine')} ${escapeHtml(formatAmount(reply.balance))}`)),
    reply.dueDate ? `${balLabel(labels, 'dueDate')} ${escapeHtml(reply.dueDate)}` : balLabel(labels, 'dueNotRecorded'),
    reply.lastPayment
      ? balFill(balLabel(labels, 'lastPaymentLine'), { amount: escapeHtml(formatAmount(reply.lastPayment.amount)), date: escapeHtml(reply.lastPayment.date) })
      : balLabel(labels, 'lastNone'),
  ];
  if (reply.unusableDisputes > 0) {
    fields.push(balFill(balLabel(labels, 'disputeEntries'), { count: reply.unusableDisputes }));
  }
  return `<p>${escapeHtml(balanceReplySummaryText(reply, labels))}</p><ul style="font-size: 12px;">${fields.map((field) => `<li>${field}</li>`).join('')}</ul>`
    + (draftText ? `<p style="font-size: 12px; white-space: pre-wrap;">${escapeHtml(draftText)}</p>` : '')
    + `<p style="font-size: 12px;">${escapeHtml(balanceReplySentText(sends, labels))}</p>`;
}
