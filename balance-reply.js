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
  const parts = [`Assalam-o-Alaikum ${name},`];
  if (reply.balanceKind === 'none') {
    parts.push('You have no amount due at the moment.');
  } else if (reply.hasOpenDispute && reply.balanceCents === 0) {
    parts.push('You have no undisputed amount due at the moment.');
  } else if (reply.hasOpenDispute) {
    parts.push(`Your undisputed balance is ${formatAmount(reply.balance)}.`);
  } else {
    parts.push(`Your current balance is ${formatAmount(reply.balance)}.`);
  }
  if (reply.dueDate) {
    parts.push(`Due date: ${reply.dueDate}.`);
  } else {
    parts.push('Due date: not recorded.');
  }
  if (reply.lastPayment) {
    parts.push(`Last payment: ${formatAmount(reply.lastPayment.amount)} on ${reply.lastPayment.date}.`);
  } else {
    parts.push('No payment recorded yet.');
  }
  if (reply.hasOpenDispute) {
    parts.push(`Note: a dispute case is open on your bill (${formatAmount(reply.disputedAmount)}). The balance above does not include the disputed amount.`);
    if (reply.excessCents > 0) {
      parts.push(`The disputed amount exceeds the outstanding balance by ${formatAmount(fromCents(reply.excessCents))}.`);
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

export function balanceReplySummaryText(reply) {
  if (!reply) return 'Balance reply unavailable — the outstanding figure is missing or unusable.';
  if (reply.balanceKind === 'none') return 'No amount due.';
  if (reply.hasOpenDispute && reply.balanceCents === 0) return `No undisputed amount due (disputed ${formatAmount(reply.disputedAmount)} not included).`;
  if (reply.hasOpenDispute) return `Undisputed balance ${formatAmount(reply.balance)} (disputed ${formatAmount(reply.disputedAmount)} not included).`;
  return `Current balance ${formatAmount(reply.balance)}.`;
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

export function balanceReplySentText(sends) {
  const list = Array.isArray(sends) ? sends : [];
  if (list.length === 0) return 'Balance reply not sent yet.';
  const first = list[0];
  const datePart = text(first?.sentAt).slice(0, 10);
  const shown = validBalanceReplyDate(datePart) || datePart;
  if (list.length === 1) return `Balance reply sent on ${shown}.`;
  return `Balance reply sent on ${shown} and ${list.length - 1} more time${list.length - 1 === 1 ? '' : 's'} — re-send anytime from here.`;
}

export function balanceReplyHtml(reply, { draftText = '', sends = [] } = {}) {
  if (!reply) return '<p class="empty-state">Balance reply unavailable — the outstanding figure is missing or unusable.</p>';
  const fields = [
    `Customer: ${escapeHtml(reply.customerName || reply.customerId)}`,
    reply.balanceKind === 'none'
      ? 'Balance: no amount due'
      : (reply.hasOpenDispute && reply.balanceCents === 0
        ? `Balance: no undisputed amount due (disputed ${escapeHtml(formatAmount(reply.disputedAmount))} not included)`
        : (reply.hasOpenDispute
          ? `Undisputed balance: ${escapeHtml(formatAmount(reply.balance))} (disputed ${escapeHtml(formatAmount(reply.disputedAmount))} not included)`
          : `Current balance: ${escapeHtml(formatAmount(reply.balance))}`)),
    reply.dueDate ? `Due date: ${escapeHtml(reply.dueDate)}` : 'Due date: not recorded',
    reply.lastPayment
      ? `Last payment: ${escapeHtml(formatAmount(reply.lastPayment.amount))} on ${escapeHtml(reply.lastPayment.date)}`
      : 'Last payment: none recorded',
  ];
  if (reply.unusableDisputes > 0) {
    fields.push(`Dispute entries with no usable amount: ${reply.unusableDisputes} (not counted)`);
  }
  return `<p>${escapeHtml(balanceReplySummaryText(reply))}</p><ul style="font-size: 12px;">${fields.map((field) => `<li>${field}</li>`).join('')}</ul>`
    + (draftText ? `<p style="font-size: 12px; white-space: pre-wrap;">${escapeHtml(draftText)}</p>` : '')
    + `<p style="font-size: 12px;">${escapeHtml(balanceReplySentText(sends))}</p>`;
}
