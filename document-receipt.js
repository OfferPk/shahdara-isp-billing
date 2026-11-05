// Plan 284 (Plan 203-350) — Customer document receipt note.
//
// A CNIC copy or a form handed in at the shop is taken with no
// receipt record, so the customer cannot later prove they gave it.
// This module adds only the missing piece: one receipt note per
// document received — the customer, the document type in plain
// words, the date received, and who received it.
//
// What this module is NOT, stated plainly:
//   - It is not a terms acknowledgement. That record says a
//     customer agreed to terms; this module only records that a
//     document was handed in, and the terms record is neither
//     read nor rewritten here. The caller supplies the customer,
//     the document type, and the date, and this module never
//     touches any terms record.
//   - It stores no document image or copy. A receipt note names
//     the document type in plain words only; there is no field
//     for an image, a scan, or a file, and this module never
//     uploads or stores any document copy.
//   - It never changes any customer record, bill, or payment.
//     Recording a receipt creates no bill and changes no
//     customer; this module holds no bill or payment field beyond
//     the names on the receipt itself, so there is nothing here
//     that could rewrite one. A wrong note is removed and
//     recorded again; there is no edit function.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     receipt note, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - A note with no id, no customer, no document type, no
//     receiver, or no strict date received is refused outright.
//     Unknown fields are dropped, so a note can never grow a
//     customer, bill, or payment field, and never a document
//     image field.
//   - A duplicate id is never rewritten.
//   - A customer page lists that customer's receipt notes by
//     date, with the document type and the receiver named.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDocumentReceiptDate(value) {
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

export function normalizeDocumentReceipt(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const documentType = text(raw.documentType);
  const dateReceived = text(raw.dateReceived);
  const receivedBy = text(raw.receivedBy);
  if (!id || !customer || !documentType) return null;
  if (!validDocumentReceiptDate(dateReceived)) return null;
  if (!receivedBy) return null;
  return {
    id,
    customer,
    documentType,
    dateReceived,
    receivedBy,
  };
}

export function normalizeDocumentReceiptList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeDocumentReceipt(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findDocumentReceipt(list, id) {
  const clean = normalizeDocumentReceiptList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordDocumentReceipt(list, raw) {
  const clean = normalizeDocumentReceiptList(list);
  const entry = normalizeDocumentReceipt(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeDocumentReceipt(list, id) {
  const clean = normalizeDocumentReceiptList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

export function documentReceiptSorted(list) {
  const clean = normalizeDocumentReceiptList(list);
  return [...clean].sort((a, b) => {
    if (a.dateReceived !== b.dateReceived) return a.dateReceived < b.dateReceived ? -1 : 1;
    const aCustomer = a.customer.toLowerCase();
    const bCustomer = b.customer.toLowerCase();
    if (aCustomer !== bCustomer) return aCustomer < bCustomer ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function documentReceiptsForCustomer(list, customer) {
  const clean = normalizeDocumentReceiptList(list);
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return documentReceiptSorted(clean.filter((entry) => entry.customer.toLowerCase() === wanted));
}

export function documentReceiptCustomers(list) {
  const clean = normalizeDocumentReceiptList(list);
  const seen = new Map();
  for (const entry of clean) {
    const key = entry.customer.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.customer);
  }
  return [...seen.values()];
}

export function documentReceiptSummaryText(list) {
  const clean = normalizeDocumentReceiptList(list);
  if (clean.length === 0) return 'No document receipts recorded.';
  const word = clean.length === 1 ? 'receipt' : 'receipts';
  return `${clean.length} document ${word} recorded.`;
}

export function documentReceiptText(entry) {
  const clean = normalizeDocumentReceipt(entry);
  if (!clean) return 'No document receipt recorded.';
  return `${clean.customer} — ${clean.documentType} — received ${clean.dateReceived} by ${clean.receivedBy}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function documentReceiptHtml(entry) {
  const clean = normalizeDocumentReceipt(entry);
  if (!clean) return '<p>No document receipt recorded.</p>';
  return `<p>${escapeHtml(documentReceiptText(clean))}</p>`;
}

export function documentReceiptAllHtml(list) {
  const rows = documentReceiptSorted(list);
  if (!rows.length) return '<p>No document receipts recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(documentReceiptText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function documentReceiptCsv(list) {
  const rows = documentReceiptSorted(list);
  const lines = ['"id","customer","document type","date received","received by"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.customer),
      csvCell(entry.documentType),
      csvCell(entry.dateReceived),
      csvCell(entry.receivedBy),
    ].join(','));
  }
  return lines.join('\n');
}

export function documentReceiptFilename() {
  return 'document-receipts.csv';
}
