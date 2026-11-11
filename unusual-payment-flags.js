// Plan 88 (Plan 1-100) — Unusual payment flag for review (amount far
// from the bill).
//
// A payment far above or below the bill — a mistyped zero, a payment
// for the wrong customer, a part-payment typed as a full one — sails
// into the ledger looking ordinary, and is only questioned when the
// customer complains. This module adds only a read-only review list,
// computed fresh from caller-supplied payment and bill rows, with
// operator-set tolerances:
//
//   - amount_differs: the payment differs from the bill it settles
//     by more than the tolerance (a percentage of the bill, default
//     10%). A payment inside tolerance never appears under this
//     rule.
//   - no_bill: the payment settles no bill at all and is above a
//     small operator-set threshold (default Rs. 500). A bill-less
//     payment at or below the threshold never appears.
//   - several_same_day: the customer made several payments on one
//     day (default: 3 or more), so the day's payments are listed
//     together for review.
//
// The fences, stated plainly:
//   - Flagging never blocks a payment, never changes an amount, and
//     never creates anything else: no suspense item and no dispute
//     case is created by this module, and no bill, payment, or
//     balance field is ever written here.
//   - Clearing a flag records who reviewed it and why in this
//     plan's own cleared log, without touching the payment record.
//     Because flags are recomputed fresh, a cleared payment id
//     stays out of the open list until its cleared entry is
//     removed.
//   - Voided payments are skipped outright, so a voided row never
//     appears for review. Rows with no usable customer, date, or
//     amount are dropped, never flagged on a guessed figure.
//   - Amounts are integer cents. A row carrying amountCents (or
//     billAmountCents) is used as-is; a row carrying only a rupee
//     amount converts once (rounded to the nearest cent), so a
//     stored record re-read through the normaliser never inflates.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is
//     not a date). Inputs are never mutated, and the module never
//     reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const UNUSUAL_FLAG_REASONS = ['amount_differs', 'no_bill', 'several_same_day'];
export const UNUSUAL_FLAG_REASON_LABELS = {
  amount_differs: 'Amount far from the bill',
  no_bill: 'Payment with no bill',
  several_same_day: 'Several payments on one day',
};
export const UNUSUAL_FLAG_DEFAULTS = {
  tolerancePercent: 10,
  noBillThresholdCents: 50000,
  sameDayThreshold: 3,
};

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

export function formatCents(cents) {
  if (!Number.isFinite(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  // Owner 5-part fix: whole rupees print without decimals and with
  // thousands grouping (Rs. 6,000, not Rs. 6000.00); a fractional
  // amount keeps up to two decimals.
  return `${sign}Rs. ${(abs / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

// Mohalla key in the Plan T spirit: "Mohalla Bani", "bani" and
// "  BANI " are the same mohalla; a blank mohalla is unassigned.
// Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
// JABBIYAA, so it folds to the same key. Charyaa is its own mohalla
// and never folds to Chamyaa.
export function mohallaKey(value) {
  const raw = text(value).replace(/^mohalla\s+/i, '').replace(/\s+/g, ' ').toLowerCase();
  if (raw === '') return '__unassigned__';
  return raw === 'jabbiyaaa' ? 'jabbiyaa' : raw;
}

// Display label in consistent Title Case, so a stored 'CHARYAA'
// and a stored 'Charyaa' read the same; the folded JABBIYAAA
// spelling reads as its canonical 'Jabbiyaa'.
export function mohallaLabel(value) {
  const raw = text(value).replace(/^mohalla\s+/i, '').trim();
  if (!raw) return '';
  if (mohallaKey(value) === 'jabbiyaa') return 'Jabbiyaa';
  return raw.split(/\s+/).map((word) => {
    const chars = Array.from(word);
    if (!chars.length) return word;
    // Same rule as phase3's readableLabel: a 2–3-letter all-caps
    // word (an acronym or a short label such as 'X<Y') keeps its
    // own casing instead of being forced to Title Case.
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  }).join(' ');
}

function centsOf(row, centsField, rupeeField) {
  if (row && Number.isFinite(row[centsField])) return Math.round(row[centsField]);
  if (row && Number.isFinite(row[rupeeField])) return Math.round(row[rupeeField] * 100);
  if (row && typeof row[rupeeField] === 'string' && row[rupeeField].trim() !== '' && Number.isFinite(Number(row[rupeeField]))) {
    return Math.round(Number(row[rupeeField]) * 100);
  }
  return null;
}

export function normalizeUnusualFlagSettings(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  const tolerance = Number(s.tolerancePercent);
  const threshold = Number(s.noBillThresholdCents);
  const sameDay = Number(s.sameDayThreshold);
  return {
    tolerancePercent: Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : UNUSUAL_FLAG_DEFAULTS.tolerancePercent,
    noBillThresholdCents: Number.isFinite(threshold) && threshold >= 0 ? Math.round(threshold) : UNUSUAL_FLAG_DEFAULTS.noBillThresholdCents,
    sameDayThreshold: Number.isFinite(sameDay) && sameDay >= 2 ? Math.floor(sameDay) : UNUSUAL_FLAG_DEFAULTS.sameDayThreshold,
  };
}

// Normalise one payment row for flagging. Returns null for rows
// that must never be flagged: voided rows, and rows with no usable
// customer, date, or amount.
export function normalizePaymentRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.voided === true) return null;
  const customerId = text(row.customerId || row.customer);
  const date = text(row.date);
  const amountCents = centsOf(row, 'amountCents', 'amount');
  if (!customerId || !isValidDate(date) || amountCents === null || amountCents <= 0) return null;
  return {
    paymentId: text(row.paymentId || row.id || ''),
    customerId,
    customerName: text(row.customerName || row.name || ''),
    mohalla: text(row.mohalla || row.area || ''),
    billId: text(row.billId || row.bill || ''),
    billMonth: text(row.billMonth || row.month || ''),
    date,
    amountCents,
    channel: text(row.channel || row.method || ''),
    reference: text(row.reference || row.tid || row.receiptId || ''),
  };
}

function normalizeBillRow(row) {
  if (!row || typeof row !== 'object') return null;
  const billId = text(row.billId || row.id || '');
  const amountCents = centsOf(row, 'billAmountCents', 'amount');
  if (!billId || amountCents === null || amountCents < 0) return null;
  return { billId, customerId: text(row.customerId || row.customer || ''), amountCents, billMonth: text(row.billMonth || row.month || '') };
}

function reasonText(flag) {
  const parts = [];
  if (flag.reasons.includes('amount_differs')) {
    parts.push(`amount ${formatCents(flag.amountCents)} vs bill ${formatCents(flag.billAmountCents)}`);
  }
  if (flag.reasons.includes('no_bill')) parts.push('no bill linked');
  if (flag.reasons.includes('several_same_day')) parts.push(`${flag.sameDayCount} payments on ${flag.date}`);
  return parts.join('; ');
}

// Build the open flag list, recomputed fresh every call. A payment
// carries one flag with every rule that caught it; cleared payment
// ids are excluded by the caller-supplied list.
export function buildUnusualFlags({ payments, bills, settings, clearedPaymentIds } = {}) {
  const s = normalizeUnusualFlagSettings(settings);
  const cleared = new Set((Array.isArray(clearedPaymentIds) ? clearedPaymentIds : []).map((id) => text(id)).filter(Boolean));
  const billById = new Map();
  for (const b of Array.isArray(bills) ? bills : []) {
    const nb = normalizeBillRow(b);
    if (nb) billById.set(nb.billId, nb);
  }
  const rows = [];
  for (const p of Array.isArray(payments) ? payments : []) {
    const np = normalizePaymentRow(p);
    if (np && !cleared.has(np.paymentId)) rows.push(np);
  }
  // Same-day groups, keyed by customer + date.
  const dayGroups = new Map();
  for (const r of rows) {
    const key = `${r.customerId}|||${r.date}`;
    if (!dayGroups.has(key)) dayGroups.set(key, []);
    dayGroups.get(key).push(r);
  }
  const flags = [];
  for (const r of rows) {
    const reasons = [];
    const bill = r.billId ? billById.get(r.billId) || null : null;
    let billAmountCents = null;
    if (bill) {
      billAmountCents = bill.amountCents;
      const toleranceCents = (billAmountCents * s.tolerancePercent) / 100;
      if (Math.abs(r.amountCents - billAmountCents) > toleranceCents) reasons.push('amount_differs');
    } else if (r.amountCents > s.noBillThresholdCents) {
      reasons.push('no_bill');
    }
    const group = dayGroups.get(`${r.customerId}|||${r.date}`) || [];
    const sameDayCount = group.length;
    if (sameDayCount >= s.sameDayThreshold) reasons.push('several_same_day');
    if (reasons.length === 0) continue;
    const flag = {
      paymentId: r.paymentId,
      customerId: r.customerId,
      customerName: r.customerName,
      mohalla: r.mohalla,
      billId: r.billId || null,
      billMonth: r.billMonth || null,
      billAmountCents,
      date: r.date,
      amountCents: r.amountCents,
      channel: r.channel,
      reference: r.reference,
      reasons,
      sameDayCount: reasons.includes('several_same_day') ? sameDayCount : null,
    };
    flag.reasonText = reasonText(flag);
    flags.push(flag);
  }
  flags.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.customerName || a.customerId).localeCompare(b.customerName || b.customerId)));
  return flags;
}

export function flagsFiltered(flags, { reason, mohalla } = {}) {
  const list = Array.isArray(flags) ? flags : [];
  const reasonKey = text(reason);
  const mohallaRaw = text(mohalla);
  return list.filter((f) => {
    if (reasonKey && !f.reasons.includes(reasonKey)) return false;
    if (mohallaRaw) {
      if (mohallaRaw === '__unassigned__') {
        if (mohallaKey(f.mohalla) !== '__unassigned__') return false;
      } else if (mohallaKey(f.mohalla) !== mohallaKey(mohallaRaw)) {
        return false;
      }
    }
    return true;
  });
}

export function buildFlagSummary(flags) {
  const list = Array.isArray(flags) ? flags : [];
  const byReason = {};
  for (const r of UNUSUAL_FLAG_REASONS) byReason[r] = 0;
  for (const f of list) for (const r of f.reasons) if (r in byReason) byReason[r] += 1;
  return { total: list.length, byReason };
}

export function flagSummaryText(summary) {
  const s = summary && typeof summary === 'object' ? summary : buildFlagSummary([]);
  const parts = UNUSUAL_FLAG_REASONS.map((r) => `${UNUSUAL_FLAG_REASON_LABELS[r]}: ${s.byReason?.[r] ?? 0}`);
  return `${s.total} flagged payment${s.total === 1 ? '' : 's'} (${parts.join(', ')})`;
}

// Cleared-flag log: who reviewed a flag and why. Clearing never
// touches the payment record; it only records the review here.
export function normalizeClearedList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const paymentId = text(e.paymentId);
    if (!paymentId) continue;
    out.push({
      paymentId,
      customerId: text(e.customerId || ''),
      customerName: text(e.customerName || ''),
      date: text(e.date || ''),
      amountCents: Number.isFinite(e.amountCents) ? Math.round(e.amountCents) : null,
      reviewedBy: text(e.reviewedBy || ''),
      reason: text(e.reason || ''),
      clearedAt: text(e.clearedAt || ''),
    });
  }
  return out;
}

export function clearFlag(list, entry) {
  const clean = normalizeClearedList(list);
  const paymentId = text(entry?.paymentId);
  if (!paymentId) return clean;
  const next = clean.filter((e) => e.paymentId !== paymentId);
  next.push({
    paymentId,
    customerId: text(entry.customerId || ''),
    customerName: text(entry.customerName || ''),
    date: text(entry.date || ''),
    amountCents: Number.isFinite(entry.amountCents) ? Math.round(entry.amountCents) : null,
    reviewedBy: text(entry.reviewedBy || ''),
    reason: text(entry.reason || ''),
    clearedAt: text(entry.clearedAt || ''),
  });
  return next;
}

export function removeCleared(list, paymentId) {
  return normalizeClearedList(list).filter((e) => e.paymentId !== text(paymentId));
}

export function flagsHtml(flags) {
  const list = Array.isArray(flags) ? flags : [];
  if (list.length === 0) return '<p style="font-size: 12px;">No unusual payments for review.</p>';
  const rows = list.map((f) => `<tr><td>${escapeHtml(f.date)}</td><td>${escapeHtml(f.customerName || f.customerId)}</td><td>${escapeHtml(mohallaLabel(f.mohalla) || '—')}</td><td>${formatCents(f.amountCents)}</td><td>${f.billId ? `${escapeHtml(f.billId)} (${formatCents(f.billAmountCents)})` : 'No bill linked'}</td><td>${f.reasons.map((r) => escapeHtml(UNUSUAL_FLAG_REASON_LABELS[r] || r)).join(', ')}</td><td>${escapeHtml(f.reasonText)}</td><td><button class="secondary-button btn-sm unusual-flag-clear-btn" type="button" data-payment-id="${escapeHtml(f.paymentId)}">Mark reviewed</button></td></tr>`).join('');
  // Owner 5-part fix: the eight-column table scrolls inside its own
  // card on a phone instead of crushing the rightmost column to a
  // one-character strip (2026-10-19 payment list).
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Customer</th><th>Mohalla</th><th>Payment</th><th>Bill</th><th>Rule</th><th>Why flagged</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function clearedHtml(list) {
  const clean = normalizeClearedList(list);
  if (clean.length === 0) return '<p style="font-size: 12px;">No flags cleared yet.</p>';
  const rows = clean.map((e) => `<tr><td>${escapeHtml(e.date)}</td><td>${escapeHtml(e.customerName || e.customerId)}</td><td>${formatCents(e.amountCents)}</td><td>${escapeHtml(e.reviewedBy || '—')}</td><td>${escapeHtml(e.reason || '—')}</td><td><button class="secondary-button btn-sm unusual-flag-unclear-btn" type="button" data-payment-id="${escapeHtml(e.paymentId)}">Restore</button></td></tr>`).join('');
  return `<table class="data-table"><thead><tr><th>Date</th><th>Customer</th><th>Payment</th><th>Reviewed by</th><th>Reason</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function flagsCsv(flags) {
  const list = Array.isArray(flags) ? flags : [];
  const head = 'date,customer,mohalla,payment_amount_rs,bill_id,bill_amount_rs,rule,why';
  const rows = list.map((f) => [f.date, f.customerName || f.customerId, f.mohalla, (f.amountCents / 100).toFixed(2), f.billId || '', f.billAmountCents === null ? '' : (f.billAmountCents / 100).toFixed(2), f.reasons.join('+'), f.reasonText].map(csvCell).join(','));
  return [head, ...rows].join('\n');
}

export function flagsFilename() {
  return 'unusual-payment-flags.csv';
}
