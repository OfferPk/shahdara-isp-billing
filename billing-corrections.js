// Plan 109 (Plan 101-202) — Billing error correction workflow.
//
// When a bill is wrong for an operator reason (wrong package, wrong
// amount, wrong date), the fix must not be made by editing the bill:
// editing destroys the evidence of what was wrong. This workflow
// preserves the original bill, posts a reversing entry, and issues a
// corrected bill, with the reason and the approver recorded on the
// correction itself. The three together net to the correct amount.
//
// This workflow is for operator errors only. Customer-raised cases
// have their own separate workflow and are never touched here.
//
// Append-only, by design:
//   - A correction, once recorded, cannot be edited. Re-adding the
//     same id is refused and leaves the original untouched.
//   - There is deliberately no edit function and no remove function
//     in this module: a correction is audit evidence, not a draft.
//   - Recording a correction changes no bill, payment, or total.
//     The original bill, the reversing entry, and the corrected bill
//     are a linked triple of records shown together; the bill records
//     themselves are never opened or rewritten here.
//   - A locked mid-cycle sheet may be named by its reference text
//     only (lockedSheetRef). The sheet itself is never opened or
//     rewritten here; this plan unlocks that correction path by
//     reference only.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Money is integer cents throughout; a plain rupees figure
// converts to cents exactly once on the way in.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  return `${sign}PKR ${Math.abs(cents / 100).toLocaleString('en-US')}`;
}

/** Operator-error kinds, in catalogue order. */
export const CORRECTION_ERROR_KINDS = ['wrong_package', 'wrong_amount', 'wrong_date', 'other'];

export const CORRECTION_ERROR_KIND_LABELS = {
  wrong_package: 'Wrong package',
  wrong_amount: 'Wrong amount',
  wrong_date: 'Wrong date',
  other: 'Other operator error',
};

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validCorrectionDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const built = new Date(Date.UTC(year, month - 1, day));
  return built.getUTCFullYear() === year && built.getUTCMonth() === month - 1 && built.getUTCDate() === day;
}

function moneyToCents(centsValue, rupeesValue) {
  if (Number.isInteger(centsValue)) return centsValue;
  if (typeof rupeesValue === 'number' && Number.isFinite(rupeesValue)) {
    return Math.round(rupeesValue * 100);
  }
  return null;
}

/**
 * One correction record. Returns null when half-formed.
 * Unknown fields are dropped, so a correction can never grow a
 * payment, bill, or total field of its own.
 */
export function normalizeBillingCorrection(input) {
  if (!input || typeof input !== 'object') return null;
  const id = cleanText(input.id);
  const customerId = cleanText(input.customerId);
  const originalBillId = cleanText(input.originalBillId);
  const reason = cleanText(input.reason);
  const approver = cleanText(input.approver);
  const date = cleanText(input.date);
  const errorKind = cleanText(input.errorKind);
  if (!id || !customerId || !originalBillId || !reason || !approver) return null;
  if (!validCorrectionDate(date)) return null;
  if (!CORRECTION_ERROR_KINDS.includes(errorKind)) return null;
  const originalAmountCents = moneyToCents(input.originalAmountCents, input.originalAmount);
  const correctedAmountCents = moneyToCents(input.correctedAmountCents, input.correctedAmount);
  if (originalAmountCents === null || originalAmountCents <= 0) return null;
  if (correctedAmountCents === null || correctedAmountCents < 0) return null;
  return {
    id,
    customerId,
    customerName: cleanText(input.customerName),
    originalBillId,
    errorKind,
    originalAmountCents,
    correctedAmountCents,
    reason,
    approver,
    date,
    lockedSheetRef: cleanText(input.lockedSheetRef),
  };
}

export function normalizeBillingCorrectionList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const clean = normalizeBillingCorrection(item);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

/**
 * Record a correction. Returns null when half-formed or when the id
 * is already recorded — a recorded correction is never overwritten.
 * Otherwise returns a new list with the correction appended.
 */
export function addBillingCorrection(list, input) {
  const clean = normalizeBillingCorrection(input);
  if (!clean) return null;
  const base = normalizeBillingCorrectionList(list);
  if (base.some((item) => item.id === clean.id)) return null;
  return [...base, clean];
}

export function findBillingCorrection(list, id) {
  const cleanId = cleanText(id);
  if (!cleanId) return null;
  return normalizeBillingCorrectionList(list).find((item) => item.id === cleanId) ?? null;
}

export function correctionsForCustomer(list, customerId) {
  const cleanId = cleanText(customerId);
  if (!cleanId) return [];
  return normalizeBillingCorrectionList(list).filter((item) => item.customerId === cleanId);
}

export function correctionsForBill(list, billId) {
  const cleanId = cleanText(billId);
  if (!cleanId) return [];
  return normalizeBillingCorrectionList(list).filter((item) => item.originalBillId === cleanId);
}

/**
 * The linked triple for one correction: the original bill as it
 * stands, the reversing entry that cancels it, and the corrected
 * bill. The reversing entry carries the negative of the original
 * amount; the corrected bill carries the correct amount.
 */
export function correctionTriple(correction) {
  const clean = normalizeBillingCorrection(correction);
  if (!clean) return [];
  return [
    { key: 'original', label: 'Original bill', billId: clean.originalBillId, amountCents: clean.originalAmountCents },
    { key: 'reversing', label: 'Reversing entry', billId: `${clean.originalBillId}-REV`, amountCents: -clean.originalAmountCents },
    { key: 'corrected', label: 'Corrected bill', billId: `${clean.originalBillId}-CORR`, amountCents: clean.correctedAmountCents },
  ];
}

/**
 * The three amounts together net to the corrected amount:
 * original + reversing + corrected = corrected, because the
 * reversing entry exactly cancels the original.
 */
export function correctionNet(correction) {
  const triple = correctionTriple(correction);
  if (triple.length !== 3) return null;
  const [original, reversing, corrected] = triple;
  return {
    originalAmountCents: original.amountCents,
    reversingAmountCents: reversing.amountCents,
    correctedAmountCents: corrected.amountCents,
    netAmountCents: original.amountCents + reversing.amountCents + corrected.amountCents,
  };
}

export function correctionSummaryText(list) {
  const clean = normalizeBillingCorrectionList(list);
  if (clean.length === 0) return 'No billing corrections recorded.';
  const correctedTotal = clean.reduce((sum, item) => sum + item.correctedAmountCents, 0);
  return `${clean.length} billing correction${clean.length === 1 ? '' : 's'} recorded; corrected bills total ${formatMoney(correctedTotal)}. Originals are preserved, never edited.`;
}

export function correctionHtml(correction) {
  const clean = normalizeBillingCorrection(correction);
  if (!clean) return '';
  const net = correctionNet(clean);
  const rows = correctionTriple(clean).map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.billId)}</td><td>${escapeHtml(formatMoney(row.amountCents))}</td></tr>`).join('');
  const sheetPart = clean.lockedSheetRef ? `<p>Locked sheet ref: ${escapeHtml(clean.lockedSheetRef)} (reference only — the sheet itself is untouched).</p>` : '';
  return `<div><p><strong>${escapeHtml(clean.id)}</strong> · ${escapeHtml(clean.customerName || clean.customerId)} · ${escapeHtml(CORRECTION_ERROR_KIND_LABELS[clean.errorKind])} · ${escapeHtml(clean.date)}</p><p>Reason: ${escapeHtml(clean.reason)} · Approver: ${escapeHtml(clean.approver)}</p><table><thead><tr><th>Entry</th><th>Bill</th><th>Amount</th></tr></thead><tbody>${rows}<tr><td><strong>Net</strong></td><td></td><td><strong>${escapeHtml(formatMoney(net.netAmountCents))}</strong></td></tr></tbody></table>${sheetPart}</div>`;
}

export function correctionCsv(list) {
  const clean = normalizeBillingCorrectionList(list);
  const header = 'id,customerId,customerName,originalBillId,errorKind,originalAmountCents,correctedAmountCents,reason,approver,date,lockedSheetRef,netAmountCents';
  const rows = clean.map((item) => {
    const net = correctionNet(item);
    return [item.id, item.customerId, item.customerName, item.originalBillId, item.errorKind, item.originalAmountCents, item.correctedAmountCents, item.reason, item.approver, item.date, item.lockedSheetRef, net.netAmountCents].map(csvCell).join(',');
  });
  return [header, ...rows].join('\n');
}

export function correctionFilename() {
  return 'billing-corrections.csv';
}
