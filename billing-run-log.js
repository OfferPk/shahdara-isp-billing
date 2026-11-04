// Plan 108 (Plan 101-202) — Monthly billing run log.
//
// One log entry per billing run: run date, operator, bills generated,
// bills skipped (each with its reason), and an exception report
// reference. The log proves afterwards which bills a given month's run
// produced, by whom, and with what exceptions — so a missing bill is
// answered from a record, not from recollection.
//
// Append-only, by design:
//   - An entry, once written, cannot be edited. Re-adding the same id
//     with different data is refused and leaves the original untouched.
//   - The only later change allowed is a dated correction note, appended
//     to the entry's own notes. There is deliberately no edit function
//     and no remove function in this module.
//   - The log itself neither creates nor changes any bill: it records
//     ids and reasons only. Plan 107's exception report is referenced
//     by its reference text, never opened or rewritten here.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Money is not carried here at all — this log counts bills,
// it never prices them.

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

/** Billing month key: YYYY-MM. */
export function validBillingRunMonth(value) {
  if (typeof value !== 'string') return false;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validBillingRunDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const built = new Date(Date.UTC(year, month - 1, day));
  return built.getUTCFullYear() === year && built.getUTCMonth() === month - 1 && built.getUTCDate() === day;
}

function cleanIdList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const id = cleanText(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function splitIdList(value) {
  if (Array.isArray(value)) return cleanIdList(value);
  if (typeof value === 'string') return cleanIdList(value.split(','));
  return [];
}

/**
 * One skipped bill: a bill id and the reason it was skipped. The reason
 * is mandatory — a skipped bill without a reason is exactly the gap
 * this log exists to close. Customer fields are optional context.
 * Returns null when half-formed. Unknown fields are dropped.
 */
export function normalizeSkippedBill(value) {
  if (!value || typeof value !== 'object') return null;
  const billId = cleanText(value.billId ?? value.id);
  const reason = cleanText(value.reason);
  if (!billId || !reason) return null;
  return {
    billId,
    customerId: cleanText(value.customerId),
    customerName: cleanText(value.customerName),
    reason,
  };
}

export function normalizeSkippedBillList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const row = normalizeSkippedBill(item);
    if (row) out.push(row);
  }
  return out;
}

function normalizeCorrectionNote(value) {
  if (!value || typeof value !== 'object') return null;
  const note = cleanText(value.note);
  const date = cleanText(value.date);
  if (!note || !validBillingRunDate(date)) return null;
  return { note, date };
}

/**
 * One run log entry. Half-formed entries are refused (null): no id, no
 * run month, no real run date, no operator, or a skipped bill without
 * a reason. Unknown fields are dropped, so an entry can never grow
 * bill, payment, or price fields of its own.
 */
export function normalizeBillingRun(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const runMonth = cleanText(value.runMonth ?? value.month);
  const runDate = cleanText(value.runDate ?? value.date);
  const operator = cleanText(value.operator);
  if (!id || !validBillingRunMonth(runMonth) || !validBillingRunDate(runDate) || !operator) return null;
  const skippedBills = normalizeSkippedBillList(value.skippedBills);
  if (Array.isArray(value.skippedBills) && value.skippedBills.length > 0 && skippedBills.length !== value.skippedBills.length) return null;
  const notes = [];
  if (Array.isArray(value.notes)) {
    for (const item of value.notes) {
      const note = normalizeCorrectionNote(item);
      if (note) notes.push(note);
    }
  }
  return {
    id,
    runMonth,
    runDate,
    operator,
    generatedBillIds: splitIdList(value.generatedBillIds ?? value.billIds),
    skippedBills,
    exceptionReportRef: cleanText(value.exceptionReportRef ?? value.exceptionRef),
    notes,
  };
}

export function normalizeBillingRunList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const entry = normalizeBillingRun(item);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

/**
 * Append one entry. Returns the new list, or null when the entry is
 * half-formed or its id is already logged — an existing entry is never
 * edited, so a re-add with different data leaves the original exactly
 * as it was.
 */
export function addBillingRun(list, entry) {
  const clean = normalizeBillingRunList(list);
  const next = normalizeBillingRun(entry);
  if (!next) return null;
  if (clean.some((item) => item.id === next.id)) return null;
  return [...clean, next];
}

/**
 * The only later change allowed: append a dated correction note to one
 * entry. Returns the new list, or null when the run is unknown, the
 * note is blank, or the date is not real. Every other field of the
 * entry is carried over untouched.
 */
export function annotateBillingRun(list, correction) {
  const clean = normalizeBillingRunList(list);
  if (!correction || typeof correction !== 'object') return null;
  const runId = cleanText(correction.runId ?? correction.id);
  const note = normalizeCorrectionNote(correction);
  if (!runId || !note) return null;
  let found = false;
  const next = clean.map((entry) => {
    if (entry.id !== runId) return entry;
    found = true;
    return { ...entry, notes: [...entry.notes, note] };
  });
  return found ? next : null;
}

/** How many bills this run generated. */
export function billingRunGeneratedCount(entry) {
  const clean = normalizeBillingRun(entry);
  return clean ? clean.generatedBillIds.length : 0;
}

export function billingRunsForMonth(list, month) {
  const clean = normalizeBillingRunList(list);
  if (!validBillingRunMonth(month)) return [];
  return clean.filter((entry) => entry.runMonth === month);
}

function normalizeBillRef(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id ?? value.billId);
  const month = cleanText(value.month ?? value.billMonth);
  if (!id || !validBillingRunMonth(month)) return null;
  return { id, month };
}

/**
 * Check one entry against the bills issued for its month, on the same
 * fixture: expected = the bills carrying this run's month, generated =
 * the entry's own ids. A mismatch is reported plainly as missing and
 * extra ids — never silently corrected, and no bill is touched.
 */
export function verifyBillingRun(entry, bills) {
  const clean = normalizeBillingRun(entry);
  if (!clean) return null;
  const refs = [];
  if (Array.isArray(bills)) {
    for (const item of bills) {
      const ref = normalizeBillRef(item);
      if (ref && ref.month === clean.runMonth) refs.push(ref);
    }
  }
  const expectedIds = refs.map((ref) => ref.id);
  const generated = new Set(clean.generatedBillIds);
  const expected = new Set(expectedIds);
  const missingBillIds = expectedIds.filter((id) => !generated.has(id));
  const extraBillIds = clean.generatedBillIds.filter((id) => !expected.has(id));
  return {
    runId: clean.id,
    runMonth: clean.runMonth,
    expectedCount: expectedIds.length,
    generatedCount: clean.generatedBillIds.length,
    skippedCount: clean.skippedBills.length,
    matches: missingBillIds.length === 0 && extraBillIds.length === 0,
    missingBillIds,
    extraBillIds,
  };
}

export function billingRunSummaryText(list) {
  const clean = normalizeBillingRunList(list);
  const generated = clean.reduce((sum, entry) => sum + entry.generatedBillIds.length, 0);
  const skipped = clean.reduce((sum, entry) => sum + entry.skippedBills.length, 0);
  return `${clean.length} run${clean.length === 1 ? '' : 's'} logged · ${generated} bill${generated === 1 ? '' : 's'} generated · ${skipped} skipped`;
}

export function billingRunHtml(entry, verification) {
  const clean = normalizeBillingRun(entry);
  if (!clean) return '';
  const check = verification && verification.runId === clean.id ? verification : null;
  const checkLine = !check
    ? ''
    : check.matches
      ? `<p>✓ Count matches this month's bills (${check.generatedCount} generated, ${check.expectedCount} issued).</p>`
      : `<p>⚠️ Count does not match: ${check.missingBillIds.length > 0 ? `missing ${escapeHtml(check.missingBillIds.join(', '))}` : ''}${check.missingBillIds.length > 0 && check.extraBillIds.length > 0 ? '; ' : ''}${check.extraBillIds.length > 0 ? `extra ${escapeHtml(check.extraBillIds.join(', '))}` : ''} (generated ${check.generatedCount}, issued ${check.expectedCount}).</p>`;
  const skippedLine = clean.skippedBills.length === 0
    ? '<p>No bills skipped.</p>'
    : `<ul>${clean.skippedBills.map((row) => `<li>${escapeHtml(row.billId)}${row.customerName ? ` · ${escapeHtml(row.customerName)}` : ''} — ${escapeHtml(row.reason)}</li>`).join('')}</ul>`;
  const notesLine = clean.notes.length === 0
    ? ''
    : `<p>Correction notes: ${clean.notes.map((item) => `${escapeHtml(item.date)}: ${escapeHtml(item.note)}`).join(' · ')}</p>`;
  return `<div><p><strong>${escapeHtml(clean.runMonth)}</strong> · run ${escapeHtml(clean.runDate)} by ${escapeHtml(clean.operator)} · ${clean.generatedBillIds.length} bill${clean.generatedBillIds.length === 1 ? '' : 's'} generated, ${clean.skippedBills.length} skipped${clean.exceptionReportRef ? ` · exception report: ${escapeHtml(clean.exceptionReportRef)}` : ''}</p>${checkLine}${skippedLine}${notesLine}</div>`;
}

export function billingRunCsv(list) {
  const clean = normalizeBillingRunList(list);
  const header = 'run_id,run_month,run_date,operator,generated_count,generated_bill_ids,skipped_count,skipped_bills,exception_report_ref,correction_notes';
  const rows = clean.map((entry) => [
    entry.id,
    entry.runMonth,
    entry.runDate,
    entry.operator,
    entry.generatedBillIds.length,
    entry.generatedBillIds.join('; '),
    entry.skippedBills.length,
    entry.skippedBills.map((row) => `${row.billId}: ${row.reason}`).join('; '),
    entry.exceptionReportRef,
    entry.notes.map((item) => `${item.date}: ${item.note}`).join('; '),
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function billingRunFilename() {
  return 'billing-run-log.csv';
}
