// Plan 65 (Plan 1-100) — Dispute outcome letter draft and monthly
// dispute-reason view.
//
// A customer told verbally that a dispute is resolved has no written
// explanation, so the same dispute returns next month, and the owner
// never sees which billing errors keep recurring. This module is the
// written answer: a bilingual outcome draft composed from the
// resolved case (Plan 61) and its resolution (Plan 64) — what was
// disputed, the finding, what changed or why the bill stands, and
// the resulting balance — plus a read-only monthly view counting
// resolved disputes by reason and outcome.
//
// The fences, stated plainly:
//   - Drafting, sending, or viewing never changes any bill,
//     payment, case, or Waada record. The module holds no bill
//     total, payment row, or Waada field of its own: the ledger
//     figures it prints are caller-supplied, carried verbatim,
//     and never written back anywhere.
//   - The draft is offered only for a resolved case that has a
//     resolution record. A resolved case with no resolution yet
//     shows as awaiting its letter, never as a letter with an
//     invented finding. An unresolved case is never offered one.
//   - The resulting balance is bill total minus payments
//     received minus the adjustment applied, in integer cents.
//     A correction or concession uses the resolution's recorded
//     adjustment amount; a "none" path adjusts by zero; a matched
//     payment adjusts by zero because the matched payment itself
//     is a payment and belongs in payments received. If the bill
//     total or the payments received are missing or unusable,
//     the balance is null and the draft says so — never
//     zero-filled, never guessed.
//   - Sending is by the operator through the existing WhatsApp
//     route only; nothing here sends anything on its own, and
//     every send is logged with case, time, variant, and channel.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is
//     not a date). Inputs are never mutated, and the module never
//     reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const DISPUTE_LETTER_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

export const DISPUTE_LETTER_REASON_LABELS = {
  wrong_amount: 'Wrong amount',
  double_charge: 'Double charge',
  payment_not_credited: 'Payment not credited',
  package_change_timing: 'Package-change timing',
  fee_not_agreed: 'Fee not agreed',
  other: 'Other',
};

export const DISPUTE_LETTER_REASON_LABELS_URDU = {
  wrong_amount: 'غلط رقم',
  double_charge: 'دوہری چارج',
  payment_not_credited: 'ادائیگی درج نہیں ہوئی',
  package_change_timing: 'پیکیج تبدیلی کا وقت',
  fee_not_agreed: 'فیس پر اتفاق نہیں ہوا',
  other: 'دیگر',
};

export const DISPUTE_LETTER_PATH_LABELS = {
  correction: 'Correction via Plan K',
  concession: 'Concession via the existing concession path',
  matched_payment: 'Matched payment via Plan 63',
  none: 'No adjustment — bill was right',
};

export const DISPUTE_LETTER_PATH_LABELS_URDU = {
  correction: 'اصلاح',
  concession: 'رعایت',
  matched_payment: 'ملنے والی ادائیگی',
  none: 'کوئی تبدیلی نہیں',
};

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

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

// A ledger figure in integer cents, or null when missing or
// unusable. Zero is a real figure; a blank, a boolean, a
// non-finite value, or a negative amount is not a figure at all.
function toLedgerCents(amount) {
  if (typeof amount === 'boolean' || amount === null || amount === undefined) return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function fromCents(cents) {
  return cents / 100;
}

export function normalizeLetterVariant(value) {
  const raw = text(value).toLowerCase();
  return raw === DISPUTE_LETTER_VARIANTS.URDU ? DISPUTE_LETTER_VARIANTS.URDU : DISPUTE_LETTER_VARIANTS.ROMAN;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validLetterDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

export function validLetterMonth(value) {
  const raw = text(value);
  return MONTH_RE.test(raw) ? raw : null;
}

function reasonLabel(reason, variant) {
  const key = text(reason).toLowerCase().replace(/[\s-]+/g, '_');
  if (variant === DISPUTE_LETTER_VARIANTS.URDU) return DISPUTE_LETTER_REASON_LABELS_URDU[key] ?? key;
  return DISPUTE_LETTER_REASON_LABELS[key] ?? key;
}

function pathLabel(path, variant) {
  const key = text(path).toLowerCase().replace(/[\s-]+/g, '_');
  if (variant === DISPUTE_LETTER_VARIANTS.URDU) return DISPUTE_LETTER_PATH_LABELS_URDU[key] ?? key;
  return DISPUTE_LETTER_PATH_LABELS[key] ?? key;
}

// The adjustment that counts against the balance for this path.
// A correction or concession counts its recorded amount; a
// matched payment counts zero (it is a payment, not an
// adjustment); a "none" path counts zero. A caller-supplied
// adjustmentApplied always wins over the recorded amount.
function appliedAdjustmentCents(resolution, adjustmentApplied) {
  const supplied = toLedgerCents(adjustmentApplied);
  if (supplied !== null) return supplied;
  const path = text(resolution?.path).toLowerCase().replace(/[\s-]+/g, '_');
  if (path === 'correction' || path === 'concession') {
    const recorded = toLedgerCents(resolution?.adjustmentAmount);
    return recorded === null ? null : recorded;
  }
  if (path === 'matched_payment' || path === 'none') return 0;
  return null;
}

// Ready: resolved case with a resolution record — a letter can be
// composed. Awaiting: resolved case with no resolution yet — the
// case shows as awaiting its letter, never with an invented
// finding. Not resolved: anything else, never offered a letter.
export function letterStatus(caseRecord, resolution) {
  if (!caseRecord || typeof caseRecord !== 'object') return 'not_resolved';
  if (text(caseRecord.status).toLowerCase() !== 'resolved') return 'not_resolved';
  if (!resolution || typeof resolution !== 'object') return 'awaiting';
  if (!text(resolution.finding) || !text(resolution.outcome)) return 'awaiting';
  return 'ready';
}

// Compose the bilingual outcome draft. Returns null unless the
// case is resolved and carries a resolution record with a finding
// and an outcome. The draft's figures are the case's disputed
// amount, the resolution's finding/outcome/path/link, and the
// caller-supplied ledger figures — nothing is invented, and a
// missing ledger figure leaves the balance unrecorded rather
// than zero-filled.
export function buildOutcomeLetter({ caseRecord, resolution, billTotal, paymentsReceived, adjustmentApplied, variant } = {}) {
  if (letterStatus(caseRecord, resolution) !== 'ready') return null;
  const useVariant = normalizeLetterVariant(variant);
  const billTotalCents = toLedgerCents(billTotal);
  const paymentsCents = toLedgerCents(paymentsReceived);
  const adjustmentCents = appliedAdjustmentCents(resolution, adjustmentApplied);
  let resultingCents = null;
  if (billTotalCents !== null && paymentsCents !== null && adjustmentCents !== null) {
    resultingCents = billTotalCents - paymentsCents - adjustmentCents;
  }
  const path = text(resolution.path).toLowerCase().replace(/[\s-]+/g, '_');
  const letter = {
    caseId: text(caseRecord.id),
    customerId: text(caseRecord.customerId),
    customerName: text(caseRecord.customerName),
    billId: text(caseRecord.billId),
    billMonth: text(caseRecord.billMonth),
    disputedAmount: caseRecord.disputedAmount ?? null,
    reason: text(caseRecord.reason).toLowerCase().replace(/[\s-]+/g, '_'),
    reasonLabel: reasonLabel(caseRecord.reason, useVariant),
    finding: text(resolution.finding),
    outcome: text(resolution.outcome),
    path,
    pathLabel: pathLabel(path, useVariant),
    adjustmentAmount: adjustmentCents === null ? null : fromCents(adjustmentCents),
    linkedId: text(resolution.linkedId),
    billTotal: billTotalCents === null ? null : fromCents(billTotalCents),
    paymentsReceived: paymentsCents === null ? null : fromCents(paymentsCents),
    resultingBalance: resultingCents === null ? null : fromCents(resultingCents),
    variant: useVariant,
  };
  letter.text = buildOutcomeLetterText(letter);
  return letter;
}

function formatAmount(value) {
  return value === null || value === undefined ? null : `Rs. ${value}`;
}

function buildOutcomeLetterText(letter) {
  const name = letter.customerName || letter.customerId;
  if (letter.variant === DISPUTE_LETTER_VARIANTS.URDU) {
    const parts = [
      `السلام علیکم ${name}،`,
      `شاہدرہ فائبر نیٹ — آپ کے بل ${letter.billId} کے بارے میں فیصلہ:`,
      `آپ نے ${formatAmount(letter.disputedAmount)} کی رقم پر اعتراض کیا تھا (${letter.reasonLabel})۔`,
      `ہماری تحقیق: ${letter.finding}`,
      `فیصلہ: ${letter.outcome}`,
    ];
    if (letter.path === 'none') {
      parts.push('بل جوں کا توں برقرار ہے، کوئی تبدیلی نہیں کی گئی۔');
    } else if (letter.path === 'matched_payment') {
      parts.push(`آپ کی ادائیگی مل گئی ہے${letter.linkedId ? ` (حوالہ: ${letter.linkedId})` : ''}۔`);
    } else if (letter.adjustmentAmount !== null) {
      parts.push(`${letter.pathLabel} کے ذریعے ${formatAmount(letter.adjustmentAmount)} کی تبدیلی کی گئی ہے${letter.linkedId ? ` (حوالہ: ${letter.linkedId})` : ''}۔`);
    }
    if (letter.resultingBalance !== null) {
      parts.push(`موجودہ بقایا: ${formatAmount(letter.resultingBalance)}۔`);
    } else {
      parts.push('موجودہ بقایا درج نہیں ہے۔');
    }
    parts.push('شکریہ — شاہدرہ فائبر نیٹ۔');
    return parts.join(' ');
  }
  const parts = [
    `Assalam-o-Alaikum ${name},`,
    `Shahdara Fiber Net — decision on your bill ${letter.billId}:`,
    `You disputed ${formatAmount(letter.disputedAmount)} (${letter.reasonLabel}).`,
    `Our finding: ${letter.finding}`,
    `Decision: ${letter.outcome}`,
  ];
  if (letter.path === 'none') {
    parts.push('The bill stands as issued — no change was made.');
  } else if (letter.path === 'matched_payment') {
    parts.push(`Your payment has been found${letter.linkedId ? ` (reference: ${letter.linkedId})` : ''}.`);
  } else if (letter.adjustmentAmount !== null) {
    parts.push(`${formatAmount(letter.adjustmentAmount)} was changed via ${letter.pathLabel}${letter.linkedId ? ` (reference: ${letter.linkedId})` : ''}.`);
  }
  if (letter.resultingBalance !== null) {
    parts.push(`Resulting balance: ${formatAmount(letter.resultingBalance)}.`);
  } else {
    parts.push('Resulting balance not recorded.');
  }
  parts.push('Shukriya — Shahdara Fiber Net.');
  return parts.join(' ');
}

export function letterSummaryText(letter) {
  if (!letter) return 'No outcome letter for this case.';
  const balance = letter.resultingBalance === null ? 'balance not recorded' : `resulting balance ${formatAmount(letter.resultingBalance)}`;
  return `Outcome letter for case ${letter.caseId} (bill ${letter.billId}): disputed ${formatAmount(letter.disputedAmount)}, ${letter.pathLabel}, ${balance}.`;
}

// Read-only monthly view. `month` is YYYY-MM and matches a
// resolution's dateResolved month. Resolved cases whose
// resolution carries no date belong to no month: they are counted
// in undatedResolved, never forced into the month. Resolved cases
// with no resolution at all are listed as awaiting their letter.
export function buildMonthlyDisputeView(cases, resolutions, month) {
  const monthKey = validLetterMonth(month);
  const caseList = Array.isArray(cases) ? cases : [];
  const resolutionList = Array.isArray(resolutions) ? resolutions : [];
  const byId = new Map();
  for (const entry of resolutionList) {
    const key = text(entry?.caseId);
    if (key) byId.set(key, entry);
  }
  const byReason = new Map();
  const byOutcome = new Map();
  let resolvedInMonth = 0;
  let undatedResolved = 0;
  let allResolved = 0;
  const awaiting = [];
  for (const entry of caseList) {
    if (!entry || typeof entry !== 'object') continue;
    if (text(entry.status).toLowerCase() !== 'resolved') continue;
    allResolved += 1;
    const resolution = byId.get(text(entry.id));
    if (!resolution || !text(resolution.finding) || !text(resolution.outcome)) {
      awaiting.push(entry);
      continue;
    }
    const resolvedDate = validLetterDate(resolution.dateResolved ?? resolution.date);
    if (!resolvedDate) {
      undatedResolved += 1;
      continue;
    }
    if (monthKey && resolvedDate.slice(0, 7) !== monthKey) continue;
    resolvedInMonth += 1;
    const reasonKey = text(entry.reason).toLowerCase().replace(/[\s-]+/g, '_') || 'other';
    byReason.set(reasonKey, (byReason.get(reasonKey) ?? 0) + 1);
    const outcomeKey = text(entry.outcome) || text(resolution.outcome);
    byOutcome.set(outcomeKey, (byOutcome.get(outcomeKey) ?? 0) + 1);
  }
  const byReasonRows = [...byReason.entries()]
    .map(([reason, count]) => ({ reason, label: DISPUTE_LETTER_REASON_LABELS[reason] ?? reason, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const byOutcomeRows = [...byOutcome.entries()]
    .map(([outcome, count]) => ({ outcome, count }))
    .sort((a, b) => b.count - a.count || a.outcome.localeCompare(b.outcome));
  return {
    month: monthKey,
    resolvedInMonth,
    allResolved,
    undatedResolved,
    byReason: byReasonRows,
    byOutcome: byOutcomeRows,
    awaiting: awaiting.map((entry) => ({
      id: text(entry.id),
      customerId: text(entry.customerId),
      customerName: text(entry.customerName),
      billId: text(entry.billId),
      reason: text(entry.reason).toLowerCase().replace(/[\s-]+/g, '_'),
    })),
  };
}

export function monthlyDisputeViewText(view) {
  if (!view) return 'No dispute view.';
  const monthLabel = view.month || 'all months';
  const parts = [`${view.resolvedInMonth} resolved dispute${view.resolvedInMonth === 1 ? '' : 's'} in ${monthLabel} (${view.allResolved} resolved in total, ${view.undatedResolved} with no resolution date and belonging to no month)`];
  if (view.byReason.length > 0) {
    parts.push(`by reason: ${view.byReason.map((row) => `${row.label} ${row.count}`).join(', ')}`);
  }
  if (view.byOutcome.length > 0) {
    parts.push(`by outcome: ${view.byOutcome.map((row) => `${row.outcome} ${row.count}`).join(', ')}`);
  }
  if (view.awaiting.length > 0) {
    parts.push(`${view.awaiting.length} resolved case${view.awaiting.length === 1 ? '' : 's'} still awaiting ${view.awaiting.length === 1 ? 'its' : 'their'} letter`);
  }
  return parts.join('. ') + '.';
}

export function monthlyDisputeHtml(view) {
  if (!view) return '<p style="font-size: 12px;">No dispute view.</p>';
  const reasonRows = view.byReason.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${row.count}</td></tr>`).join('');
  const outcomeRows = view.byOutcome.map((row) => `<tr><td>${escapeHtml(row.outcome)}</td><td>${row.count}</td></tr>`).join('');
  const awaitingRows = view.awaiting.map((entry) => `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.customerName || entry.customerId)}</td><td>${escapeHtml(entry.billId)}</td><td>${escapeHtml(DISPUTE_LETTER_REASON_LABELS[entry.reason] ?? entry.reason)}</td></tr>`).join('');
  return `<p style="font-size: 12px;">${escapeHtml(monthlyDisputeViewText(view))}</p>`
    + `<table class="data-table"><thead><tr><th>Reason</th><th>Resolved in month</th></tr></thead><tbody>${reasonRows || '<tr><td colspan="2">No resolved disputes in this month.</td></tr>'}</tbody></table>`
    + `<table class="data-table"><thead><tr><th>Outcome</th><th>Resolved in month</th></tr></thead><tbody>${outcomeRows || '<tr><td colspan="2">No resolved disputes in this month.</td></tr>'}</tbody></table>`
    + (view.awaiting.length > 0
      ? `<table class="data-table"><thead><tr><th>Awaiting letter</th><th>Customer</th><th>Bill</th><th>Reason</th></tr></thead><tbody>${awaitingRows}</tbody></table>`
      : '<p style="font-size: 12px;">No resolved case is awaiting its letter.</p>');
}

export function monthlyDisputeCsv(view) {
  if (!view) return '';
  const lines = ['section,reason,outcome,count'].map(csvCell).join(',');
  const rows = [];
  for (const row of view.byReason) rows.push(['reason', row.label, '', row.count].map(csvCell).join(','));
  for (const row of view.byOutcome) rows.push(['outcome', '', row.outcome, row.count].map(csvCell).join(','));
  for (const entry of view.awaiting) rows.push(['awaiting', DISPUTE_LETTER_REASON_LABELS[entry.reason] ?? entry.reason, entry.id, ''].map(csvCell).join(','));
  return [lines, ...rows].join('\n');
}

export function monthlyDisputeFilename(month) {
  const key = validLetterMonth(month);
  return key ? `dispute-reasons-${key}.csv` : 'dispute-reasons.csv';
}

// Append a send to the log (case, customer, time, channel,
// variant), returning a new list. Entries without a case id, a
// customer id, or a send time are ignored: a logged send always
// carries a real send time. The log never touches a bill,
// payment, case, or Waada record.
export function logLetterSent(log, { caseId, customerId, sentAt, channel, variant } = {}) {
  const list = Array.isArray(log) ? [...log] : [];
  const id = text(caseId);
  const customer = text(customerId);
  const time = text(sentAt);
  if (!id || !customer || !time) return list;
  list.push({
    caseId: id,
    customerId: customer,
    sentAt: time,
    channel: text(channel) || 'whatsapp',
    variant: normalizeLetterVariant(variant),
  });
  return list;
}

export function findLetterSends(log, caseId) {
  const id = text(caseId);
  if (!id || !Array.isArray(log)) return [];
  return log.filter((entry) => text(entry?.caseId) === id);
}

export function letterSentText(sends) {
  const list = Array.isArray(sends) ? sends : [];
  if (list.length === 0) return 'Outcome letter not sent yet — send it once for this resolved case.';
  const first = list[0];
  const datePart = text(first?.sentAt).slice(0, 10);
  const shown = validLetterDate(datePart) || datePart;
  if (list.length === 1) return `Outcome letter sent on ${shown}.`;
  return `Outcome letter sent on ${shown} and ${list.length - 1} more time${list.length - 1 === 1 ? '' : 's'} — re-send anytime from here.`;
}

export function letterHtml(letter, { draftText = '', sends = [] } = {}) {
  if (!letter) return '<p class="empty-state">No outcome letter for this case.</p>';
  const fields = [
    `Case: ${escapeHtml(letter.caseId)} — bill ${escapeHtml(letter.billId)}`,
    `Disputed: ${escapeHtml(formatAmount(letter.disputedAmount))} (${escapeHtml(letter.reasonLabel)})`,
    `Finding: ${escapeHtml(letter.finding)}`,
    `Decision: ${escapeHtml(letter.outcome)}`,
    `Path: ${escapeHtml(letter.pathLabel)}${letter.linkedId ? ` (reference: ${escapeHtml(letter.linkedId)})` : ''}`,
    letter.resultingBalance === null
      ? 'Resulting balance: not recorded'
      : `Resulting balance: ${escapeHtml(formatAmount(letter.resultingBalance))}`,
  ];
  return `<p>${escapeHtml(letterSummaryText(letter))}</p><ul style="font-size: 12px;">${fields.map((field) => `<li>${field}</li>`).join('')}</ul>`
    + (draftText ? `<p style="font-size: 12px; white-space: pre-wrap;">${escapeHtml(draftText)}</p>` : '')
    + `<p style="font-size: 12px;">${escapeHtml(letterSentText(sends))}</p>`;
}
