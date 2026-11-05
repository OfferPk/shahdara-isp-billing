// Plan 218 (Plan 203-350) — Discount expiry note.
//
// A time-boxed discount or promotional offer (Plan 98) ends, but
// nobody is warned before it ends, so the customer is surprised by
// the next full-price bill. This module is the warning only: it
// records one expiry note per discount — the discount reference,
// the expiry date, the customer or mohalla affected, the last
// discounted bill, and a notice draft for the operator to send —
// so discounts expiring within the operator-set window appear on
// an expiry list ordered by date, and the customer hears about the
// end of a discount before the bill arrives.
//
// What this module is NOT, stated plainly:
//   - It is not the discount or the offer (Plan 98). The Plan 98
//     promotional-offer record was checked first: it holds the
//     offer itself, and this module never reads or rewrites it.
//     Recording a note ends nothing by itself and changes no
//     offer, no bill, and no payment.
//   - It is not a bill, a payment, or a notice sent. The notice
//     draft is only words for the operator to send; this module
//     sends nothing, and recording a note never changes any bill,
//     payment, discount, customer, or staff record by itself.
//   - It is not any SISP/MD module. The corresponding SISP/MD
//     material was checked first: no discount-expiry warning
//     exists there, so this module adds only the missing piece
//     and never reads or rewrites an SISP/MD record.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record and every window date, and the module never reads
//     storage, the clock, or the network, and never mutates an
//     input. Dates compare as YYYY-MM-DD strings, so no Date
//     object is ever used.
//   - A note with no id, no discount reference, no strict
//     expiry date, no affected customer or mohalla, or no last
//     discounted bill is refused outright. Unknown fields are
//     dropped, so a note can never grow a bill, payment, or
//     offer field.
//   - A duplicate id is never rewritten: a re-save with
//     different figures also leaves the list unchanged. There is
//     no edit function; only recording a note and removal.
//   - The expiry list is ordered by expiry date, then discount
//     reference, then id, and the window filter is inclusive at
//     both ends: a discount expiring on the first or the last
//     day of the window appears on the list. A bad window
//     (missing date, or from after to) shows nothing, never a
//     guessed list.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function validDiscountExpiryDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeDiscountExpiry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const discountRef = cleanText(raw.discountRef);
  const expiryDate = cleanText(raw.expiryDate);
  const affected = cleanText(raw.affected);
  const lastDiscountedBill = cleanText(raw.lastDiscountedBill);
  if (!id || !discountRef || !validDiscountExpiryDate(expiryDate)) return null;
  if (!affected || !lastDiscountedBill) return null;
  return { id, discountRef, expiryDate, affected, lastDiscountedBill, noticeDraft: cleanText(raw.noticeDraft) };
}

export function normalizeDiscountExpiryList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const clean = normalizeDiscountExpiry(raw);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

export function findDiscountExpiry(list, id) {
  const clean = normalizeDiscountExpiryList(list);
  const wanted = cleanText(id);
  return clean.find((note) => note.id === wanted) ?? null;
}

export function recordDiscountExpiry(list, record) {
  const clean = normalizeDiscountExpiryList(list);
  const next = normalizeDiscountExpiry(record);
  if (!next) return clean;
  if (clean.some((note) => note.id === next.id)) return clean;
  return [...clean, next];
}

export function removeDiscountExpiry(list, id) {
  const wanted = cleanText(id);
  return normalizeDiscountExpiryList(list).filter((note) => note.id !== wanted);
}

export function discountExpiriesSorted(list) {
  return normalizeDiscountExpiryList(list).sort((a, b) => {
    if (a.expiryDate !== b.expiryDate) return a.expiryDate < b.expiryDate ? -1 : 1;
    const byRef = a.discountRef.localeCompare(b.discountRef);
    if (byRef !== 0) return byRef;
    return a.id.localeCompare(b.id);
  });
}

export function discountExpiriesWithinWindow(list, fromDate, toDate) {
  const from = cleanText(fromDate);
  const to = cleanText(toDate);
  if (!validDiscountExpiryDate(from) || !validDiscountExpiryDate(to) || from > to) return [];
  return discountExpiriesSorted(list).filter(
    (note) => note.expiryDate >= from && note.expiryDate <= to,
  );
}

export function discountExpiriesForAffected(list, affected) {
  const query = cleanText(affected).toLowerCase();
  if (!query) return [];
  return discountExpiriesSorted(list).filter((note) =>
    note.affected.toLowerCase().includes(query),
  );
}

export function discountExpiryText(note) {
  if (!note) return 'No discount expiry note.';
  const draft = note.noticeDraft ? ` Notice draft: ${note.noticeDraft}` : ' No notice draft yet.';
  return `${note.discountRef} expires ${note.expiryDate} — ${note.affected}. Last discounted bill: ${note.lastDiscountedBill}.${draft}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function discountExpiryHtml(note) {
  if (!note) return '<p>No discount expiry note.</p>';
  return `<p>${escapeHtml(discountExpiryText(note))}</p>`;
}

export function discountExpiryAllHtml(notes) {
  const clean = Array.isArray(notes) ? discountExpiriesSorted(notes) : [];
  if (!clean.length) return '<p>No discount expiry notes yet.</p>';
  const rows = clean.map((note) =>
    `<tr><td>${escapeHtml(note.discountRef)}</td><td>${escapeHtml(note.expiryDate)}</td><td>${escapeHtml(note.affected)}</td><td>${escapeHtml(note.lastDiscountedBill)}</td><td>${escapeHtml(note.noticeDraft || 'No notice draft yet.')}</td></tr>`,
  ).join('');
  return `<table><thead><tr><th>Discount</th><th>Expiry date</th><th>Affected</th><th>Last discounted bill</th><th>Notice draft</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function discountExpiryCsv(notes) {
  const clean = Array.isArray(notes) ? discountExpiriesSorted(notes) : [];
  const header = 'Discount,Expiry date,Affected,Last discounted bill,Notice draft';
  const rows = clean.map((note) => [
    note.discountRef, note.expiryDate, note.affected,
    note.lastDiscountedBill, note.noticeDraft,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function discountExpiryFilename() {
  return 'discount-expiry.csv';
}
