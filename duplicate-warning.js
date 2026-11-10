// Plan 87 (Plan 1-100) — Near-duplicate payment warning at entry time.
//
// The same payment can be recorded twice by mistake — once in the
// field and once from a wallet message — and the duplicate is only
// noticed when a customer or the month-end sweep finds it. This
// module adds only the warning layer shown when a payment is
// entered: same customer, same amount, and same channel within an
// operator-set window (same day by default), or the same wallet
// reference (TID) already recorded, surfaces the earlier payment
// for comparison. The operator may still save the new payment with
// a recorded reason.
//
// The fences, stated plainly:
//   - The warning never blocks, merges, or deletes a payment. It
//     returns matches for comparison; saving after a warning only
//     records the operator's reason in this plan's own
//     acknowledgement log, never on the payment itself.
//   - It never changes the wallet matching rules (Plan V) or the
//     voided-TID guard (Plan K / CP-01). Plan V's matching and
//     Plan K's voided handling are neither read nor rewritten
//     here: this module takes caller-supplied payment rows and
//     applies its own two warning rules only. Voided rows are
//     skipped outright, so a TID that matches only a voided
//     payment never warns — the same outcome as the voided-TID
//     guard, reached independently.
//   - A legitimate second payment does not warn: a different
//     amount never matches, and a payment for a different bill
//     (both rows carrying a bill month, and the months differ)
//     never matches on the amount rule. The same-TID rule is the
//     exception: a TID identifies one transfer, so it warns
//     whichever bill the earlier payment sits on.
//   - Amounts are integer cents. A row carrying amountCents is
//     used as-is; a row carrying only a rupee amount converts
//     once (rounded to the nearest cent), so a stored record
//     re-read through the normaliser never inflates.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30
//     is not a date). The window is in whole days, inclusive at
//     both ends; window 0 means the same calendar date. An
//     unset, negative, or non-numeric window falls back to 0.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, or the network. It holds no bill,
//     payment, or balance field of its own — only the warning
//     matches and the operator's acknowledgement log shape.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DUPLICATE_WARNING_DEFAULT_WINDOW_DAYS = 0;

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

function isValidDate(value) {
  const m = DATE_RE.exec(text(value));
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function daysBetween(a, b) {
  const pa = DATE_RE.exec(text(a));
  const pb = DATE_RE.exec(text(b));
  const da = Date.UTC(Number(pa[1]), Number(pa[2]) - 1, Number(pa[3]));
  const db = Date.UTC(Number(pb[1]), Number(pb[2]) - 1, Number(pb[3]));
  return Math.round(Math.abs(db - da) / 86400000);
}

// Reference comparison mirrors wallet-reconciliation.js normalizeTid
// (strip all non-alphanumerics, lowercase) without importing it, because
// this module stays import-free. The two copies must stay in
// lockstep: a reference that differs only by separators, case, or
// spacing is the same reference. (QC-7: the old copy stripped
// whitespace/case only, so "TID-100" and "TID100" never warned as the
// same reference.)
function normalizeReference(value) {
  return text(value).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function normalizeChannel(value) {
  return text(value).toLowerCase();
}

function toCents(row) {
  if (row && Number.isInteger(row.amountCents)) return row.amountCents;
  const amount = row ? Number(row.amount) : NaN;
  if (Number.isFinite(amount)) return Math.round(amount * 100);
  return null;
}

// One normalised view of a recorded payment row, or null when the
// row cannot be compared: voided rows, rows with no customer, no
// usable date, or no usable amount never warn.
export function normalizePaymentRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.voided === true) return null;
  const customerId = text(row.customerId);
  if (!customerId) return null;
  const date = text(row.date);
  if (!isValidDate(date)) return null;
  const amountCents = toCents(row);
  if (amountCents === null || !Number.isFinite(amountCents)) return null;
  return {
    paymentId: text(row.paymentId || row.id),
    customerId,
    customerName: text(row.customerName),
    billMonth: text(row.billMonth || row.month),
    date,
    amountCents,
    channel: text(row.channel || row.method),
    channelKey: normalizeChannel(row.channel || row.method),
    reference: text(row.reference || row.transactionId || row.tid),
    referenceKey: normalizeReference(row.reference || row.transactionId || row.tid),
  };
}

export function normalizeDuplicateWarningSettings(settings) {
  const raw = settings && typeof settings === 'object' ? settings : {};
  const days = Number(raw.windowDays);
  return {
    windowDays: Number.isFinite(days) && days >= 0 ? Math.floor(days) : DUPLICATE_WARNING_DEFAULT_WINDOW_DAYS,
  };
}

// The two warning rules. Returns matches only — never a decision
// about the candidate itself.
export function findNearDuplicates(input) {
  const { payments, candidate, settings } = input || {};
  const windowDays = normalizeDuplicateWarningSettings(settings).windowDays;
  const cand = normalizePaymentRow(candidate);
  if (!cand) return { candidateValid: false, matches: [] };
  const seen = new Set();
  const matches = [];
  for (const row of Array.isArray(payments) ? payments : []) {
    const existing = normalizePaymentRow(row);
    if (!existing) continue;
    if (existing.customerId !== cand.customerId) continue;
    if (cand.paymentId && existing.paymentId && existing.paymentId === cand.paymentId) continue;
    let reason = null;
    if (cand.referenceKey && existing.referenceKey && existing.referenceKey === cand.referenceKey) {
      reason = 'same-reference';
    } else if (
      existing.amountCents === cand.amountCents &&
      cand.channelKey && existing.channelKey && existing.channelKey === cand.channelKey &&
      daysBetween(existing.date, cand.date) <= windowDays &&
      !(existing.billMonth && cand.billMonth && existing.billMonth !== cand.billMonth)
    ) {
      reason = 'same-amount-channel-date';
    }
    if (!reason) continue;
    const key = existing.paymentId || `${existing.date}|${existing.amountCents}|${existing.referenceKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ ...existing, reason });
  }
  matches.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === 'same-reference' ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.paymentId.localeCompare(b.paymentId);
  });
  return { candidateValid: true, matches };
}

// Entry-time check: warnings plus whether the save may proceed.
// A warning never blocks by itself; with warnings present, the
// save needs a recorded reason, which the panel stores in the
// acknowledgement log below.
export function checkNewPayment(input) {
  const { payments, candidate, settings, overrideReason } = input || {};
  const found = findNearDuplicates({ payments, candidate, settings });
  if (!found.candidateValid) {
    return {
      candidateValid: false,
      warnings: [],
      requiresReason: false,
      canSave: false,
      message: 'Candidate payment is incomplete: it needs a customer, a valid date, and a usable amount before it can be checked.',
    };
  }
  const reason = text(overrideReason);
  const requiresReason = found.matches.length > 0;
  const canSave = !requiresReason || reason !== '';
  return {
    candidateValid: true,
    warnings: found.matches,
    requiresReason,
    canSave,
    message: !requiresReason
      ? 'No earlier payment looks like this one.'
      : canSave
        ? `${found.matches.length} earlier payment${found.matches.length === 1 ? '' : 's'} look${found.matches.length === 1 ? 's' : ''} like this one, and a reason is recorded, so it may still be saved.`
        : `${found.matches.length} earlier payment${found.matches.length === 1 ? '' : 's'} look${found.matches.length === 1 ? 's' : ''} like this one. Check the match below, then record a reason if this really is a second payment.`,
  };
}

export function formatCents(cents) {
  if (!Number.isFinite(cents)) return '—';
  return `Rs. ${(cents / 100).toFixed(2)}`;
}

export const DUPLICATE_WARNING_REASON_LABELS = {
  'same-reference': 'Same wallet reference (TID)',
  'same-amount-channel-date': 'Same amount, channel, and date window',
};

export function warningHtml(matches) {
  const rows = Array.isArray(matches) ? matches : [];
  if (rows.length === 0) return '<p>No earlier payment looks like this one.</p>';
  return `<table><thead><tr><th>Earlier payment</th><th>Date</th><th>Amount</th><th>Channel</th><th>Reference</th><th>Why it warned</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.customerName || r.customerId)}${r.billMonth ? ` · ${escapeHtml(r.billMonth)}` : ''}</td><td>${escapeHtml(r.date)}</td><td>${escapeHtml(formatCents(r.amountCents))}</td><td>${escapeHtml(r.channel || '—')}</td><td>${escapeHtml(r.reference || '—')}</td><td>${escapeHtml(DUPLICATE_WARNING_REASON_LABELS[r.reason] || r.reason || '—')}</td></tr>`).join('')}</tbody></table>`;
}

export function warningCsv(matches) {
  const rows = Array.isArray(matches) ? matches : [];
  const header = ['paymentId', 'customerId', 'customerName', 'billMonth', 'date', 'amountCents', 'channel', 'reference', 'reason'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.paymentId, r.customerId, r.customerName, r.billMonth, r.date, r.amountCents, r.channel, r.reference, r.reason].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function warningFilename() {
  return 'duplicate-payment-warnings.csv';
}

// Acknowledgement log: one record per save-after-warning. The
// reason lives here, never on the payment itself.
export function normalizeAckList(list) {
  const out = [];
  for (const entry of Array.isArray(list) ? list : []) {
    if (!entry || typeof entry !== 'object') continue;
    const id = text(entry.id);
    const customerId = text(entry.customerId);
    const reason = text(entry.reason);
    const matchedPaymentIds = Array.isArray(entry.matchedPaymentIds)
      ? entry.matchedPaymentIds.map((v) => text(v)).filter(Boolean)
      : [];
    if (!id || !customerId || !reason || matchedPaymentIds.length === 0) continue;
    out.push({
      id,
      customerId,
      customerName: text(entry.customerName),
      candidateDate: text(entry.candidateDate),
      candidateAmountCents: Number.isInteger(entry.candidateAmountCents) ? entry.candidateAmountCents : null,
      candidateChannel: text(entry.candidateChannel),
      candidateReference: text(entry.candidateReference),
      matchedPaymentIds,
      reason,
      date: text(entry.date),
    });
  }
  return out;
}

export function upsertAck(list, ack) {
  const clean = normalizeAckList(Array.isArray(list) ? list : []);
  const one = normalizeAckList([ack]);
  if (one.length === 0) return clean;
  const next = clean.filter((e) => e.id !== one[0].id);
  next.push(one[0]);
  return next;
}

export function removeAck(list, id) {
  return normalizeAckList(Array.isArray(list) ? list : []).filter((e) => e.id !== text(id));
}

export function ackHtml(list) {
  const rows = normalizeAckList(list);
  if (rows.length === 0) return '<p>No save-after-warning recorded yet.</p>';
  return `<table><thead><tr><th>Customer</th><th>New payment</th><th>Matched earlier payment(s)</th><th>Reason recorded</th><th>Date</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.customerName || r.customerId)}</td><td>${escapeHtml(r.candidateDate || '—')} · ${escapeHtml(r.candidateAmountCents === null ? '—' : formatCents(r.candidateAmountCents))} · ${escapeHtml(r.candidateChannel || '—')}${r.candidateReference ? ` · ${escapeHtml(r.candidateReference)}` : ''}</td><td>${escapeHtml(r.matchedPaymentIds.join(', '))}</td><td>${escapeHtml(r.reason)}</td><td>${escapeHtml(r.date || '—')}</td><td><button type="button" class="duplicate-warning-ack-remove-btn secondary-button btn-sm" data-ack-id="${escapeHtml(r.id)}">Remove</button></td></tr>`).join('')}</tbody></table>`;
}
