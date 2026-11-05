// Plan 216 (Plan 203-350) — Bill reissue note.
//
// A bill reprinted or reissued for a lost copy looks identical to a
// second bill for the same month, so a reissued bill can be mistaken
// for a new charge. This module is the mark that stops that mistake:
// one reissue note per reissued bill, carrying the original bill
// reference, the reissue date, the reason, and who reissued it. Every
// reissued bill carries a REISSUE mark with the original bill
// reference and date, and reissued bills are listed per customer.
//
// Scope fence, stated plainly:
//   - This marks a copy only. It creates no new bill, no charge,
//     and no total: there is no amount field anywhere in a record,
//     and recording a reissue never changes a total or alters the
//     original bill. There is no edit function and no function
//     that touches any bill, payment, customer, or staff record.
//   - This is NOT receipt reprint control (Plan 121,
//     receipt-reprints.js): that module covers receipts, this one
//     covers bills. Neither module is read or written here, and
//     recording a bill reissue never creates or changes a receipt
//     reprint record.
//   - It is import-free: the caller supplies every note and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     refused, never mapped onto a neighbouring date).

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 30, 31, 30, 31, 30, 31];

export function validReissueDate(value) {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) limit = 29;
  return day <= limit;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Normalise one reissue note, or null when half-formed. Unknown
// fields are dropped, so a note can never grow an amount, a charge,
// or a total field. The id, customer, original bill reference, and
// reissue date are mandatory, because a reissue without them proves
// nothing; the reason and the reissuer are optional plain words.
export function normalizeBillReissue(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = cleanText(raw.id);
  const customer = cleanText(raw.customer);
  const originalBillRef = cleanText(raw.originalBillRef ?? raw.originalBill);
  const reissueDate = cleanText(raw.reissueDate ?? raw.date);
  if (!id || !customer || !originalBillRef || !validReissueDate(reissueDate)) return null;
  return Object.freeze({
    id,
    customer,
    originalBillRef,
    reissueDate,
    reason: cleanText(raw.reason),
    reissuedBy: cleanText(raw.reissuedBy),
  });
}

export function normalizeBillReissueList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const note = normalizeBillReissue(raw);
    if (note && !seen.has(note.id)) {
      seen.add(note.id);
      out.push(note);
    }
  }
  return out;
}

export function findBillReissue(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return null;
  return normalizeBillReissueList(list).find((note) => note.id === wanted) ?? null;
}

// Record a reissue note. A duplicate id never rewrites the recorded
// note, and a half-formed note leaves the list unchanged.
export function recordBillReissue(list, note) {
  const clean = normalizeBillReissueList(list);
  const next = normalizeBillReissue(note);
  if (!next) return clean;
  if (clean.some((item) => item.id === next.id)) return clean;
  return [...clean, next];
}

export function removeBillReissue(list, id) {
  const wanted = cleanText(id);
  return normalizeBillReissueList(list).filter((note) => note.id !== wanted);
}

// Listed per customer: customer A-Z, then reissue date, then the
// original bill reference, then id.
export function billReissuesSorted(list) {
  return normalizeBillReissueList(list).sort((a, b) =>
    a.customer.localeCompare(b.customer, 'en') ||
    a.reissueDate.localeCompare(b.reissueDate) ||
    a.originalBillRef.localeCompare(b.originalBillRef, 'en') ||
    a.id.localeCompare(b.id, 'en'));
}

export function billReissuesForCustomer(list, customer) {
  const query = cleanText(customer).toLowerCase();
  if (!query) return billReissuesSorted(list);
  return billReissuesSorted(list).filter((note) => note.customer.toLowerCase().includes(query));
}

export function billReissueSummaryText(list) {
  const clean = normalizeBillReissueList(list);
  if (!clean.length) return 'No bill reissues recorded.';
  const customers = new Set(clean.map((note) => note.customer)).size;
  return `${clean.length} bill reissue${clean.length === 1 ? '' : 's'} recorded for ${customers} customer${customers === 1 ? '' : 's'}.`;
}

// The REISSUE mark a reissued copy carries: the original bill
// reference and the reissue date, so nobody mistakes the copy for a
// new charge.
export function reissueCopyText(originalBillRef, reissueDate) {
  const ref = cleanText(originalBillRef);
  const date = cleanText(reissueDate);
  if (!ref || !validReissueDate(date)) return '';
  return `REISSUE — Original bill: ${ref}, reissued on ${date}. This is a copy of the original bill, not a new charge.`;
}

export function billReissueText(note) {
  const clean = normalizeBillReissue(note);
  if (!clean) return '';
  const mark = reissueCopyText(clean.originalBillRef, clean.reissueDate);
  const reason = clean.reason ? ` Reason: ${clean.reason}.` : ' No reason noted.';
  const by = clean.reissuedBy ? ` Reissued by: ${clean.reissuedBy}.` : '';
  return `${clean.customer} — ${mark}${reason}${by}`;
}

export function billReissueHtml(note) {
  const clean = normalizeBillReissue(note);
  if (!clean) return '';
  return `<p>${escapeHtml(billReissueText(clean))}</p>`;
}

export function billReissueAllHtml(list) {
  return billReissuesSorted(list).map((note) => billReissueHtml(note)).join('');
}

export function billReissueCsv(list) {
  const rows = [['id', 'customer', 'original_bill_ref', 'reissue_date', 'reason', 'reissued_by']];
  for (const note of billReissuesSorted(list)) {
    rows.push([note.id, note.customer, note.originalBillRef, note.reissueDate, note.reason, note.reissuedBy]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function billReissueFilename() {
  return 'bill-reissues.csv';
}
