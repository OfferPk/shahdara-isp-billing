// Plan 165 (Plan 101-202) — Customer Self-Service Info Sheet Printout.
//
// Customers keep asking the same basic questions — what package they
// have, what they pay, who to contact — and the operator answers
// from memory each time. This module is the single printable info
// sheet per customer: package name, monthly rate, mohalla, and the
// shop contact route the operator has stored, plus a short blank
// space for a handwritten note. It is generated offline from the
// stored details and printed or handed over by the operator.
//
// What this module is NOT, stated plainly:
//   - It is not Plan 74's info card. Plan 74 composes a bilingual
//     draft answer from the customer profile (package, price,
//     billing cycle, next due date, connection status, expiry,
//     support contact) for the operator to send. It is neither
//     read nor written here. This module is a PRINTABLE sheet
//     with a narrower, fixed field set — package, monthly rate,
//     mohalla, contact route, printed date, and a blank note
//     space — and nothing else.
//   - It contains no bill history and no payment amounts beyond
//     the monthly rate. It never creates a bill or a receipt,
//     and it never changes any customer, bill, or payment record.
//   - It is not proof that the details are right. The sheet shows
//     the stored details exactly as stored; the module verifies
//     format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record
//     and the module never reads storage, the clock, or the
//     network, and never touches another record.
//   - A sheet with no id, no customer, no package name, no usable
//     monthly rate, or no strict printed date is refused outright.
//     Unknown fields are dropped, so a sheet can never grow a
//     bill-history, payment, due-date, balance, or status field.
//   - One sheet per customer: a second sheet for the same customer
//     (case-insensitive) with a different id is refused outright.
//     To change a sheet the operator removes the old one and
//     records a new one.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal.
//   - The handwritten-note space is always blank: the module never
//     fills it, so nothing the operator did not write appears on
//     the printed sheet.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= maxDay;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanRate(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value.trim());
    return Number.isFinite(num) && num >= 0 ? num : null;
  }
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeInfoSheet(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const packageName = cleanText(record.packageName);
  const monthlyRate = cleanRate(record.monthlyRate);
  const printedDate = cleanText(record.printedDate);
  if (!id || !customer || !packageName || monthlyRate === null || !isStrictDate(printedDate)) return null;
  return {
    id,
    customer,
    packageName,
    monthlyRate,
    mohalla: cleanText(record.mohalla),
    contactRoute: cleanText(record.contactRoute),
    printedDate,
  };
}

export function normalizeInfoSheetList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  for (const item of list) {
    const sheet = normalizeInfoSheet(item);
    if (!sheet) continue;
    if (seenIds.has(sheet.id)) continue;
    if (seenCustomers.has(sheet.customer.toLowerCase())) continue;
    seenIds.add(sheet.id);
    seenCustomers.add(sheet.customer.toLowerCase());
    out.push(sheet);
  }
  return out;
}

export function findInfoSheet(list, id) {
  const clean = normalizeInfoSheetList(list);
  const wanted = cleanText(id);
  return clean.find((sheet) => sheet.id === wanted) || null;
}

export function upsertInfoSheet(list, record) {
  const clean = normalizeInfoSheetList(list);
  const sheet = normalizeInfoSheet(record);
  if (!sheet) return clean;
  const byId = clean.find((item) => item.id === sheet.id);
  // A duplicate id is never rewritten, whether identical or different.
  if (byId) return clean;
  const byCustomer = clean.find((item) => item.customer.toLowerCase() === sheet.customer.toLowerCase());
  if (byCustomer) return clean;
  return [...clean, sheet];
}

export function removeInfoSheet(list, id) {
  const clean = normalizeInfoSheetList(list);
  const wanted = cleanText(id);
  if (!wanted) return clean;
  return clean.filter((sheet) => sheet.id !== wanted);
}

export function infoSheetForCustomer(list, customer) {
  const clean = normalizeInfoSheetList(list);
  const wanted = cleanText(customer).toLowerCase();
  if (!wanted) return null;
  return clean.find((sheet) => sheet.customer.toLowerCase() === wanted) || null;
}

export function infoSheetCustomers(list) {
  const clean = normalizeInfoSheetList(list);
  const seen = new Set();
  const out = [];
  for (const sheet of clean) {
    const key = sheet.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sheet.customer);
  }
  return out.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

export function infoSheetSummaryText(list) {
  const clean = normalizeInfoSheetList(list);
  const customers = infoSheetCustomers(clean).length;
  return `${clean.length} info sheet${clean.length === 1 ? '' : 's'} for ${customers} customer${customers === 1 ? '' : 's'}`;
}

function sheetRow(label, value) {
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

export function infoSheetHtml(sheet) {
  const clean = normalizeInfoSheet(sheet);
  if (!clean) return '<p>No info sheet to show.</p>';
  const mohalla = clean.mohalla || 'not recorded';
  const contact = clean.contactRoute || 'not recorded';
  return `<div class="info-sheet-print" style="border: 1px solid #999; padding: 12px; margin: 8px 0;">`
    + `<h4 style="margin: 0 0 8px 0;">Shahdara Fiber Net — Customer Info Sheet</h4>`
    + sheetRow('Customer', clean.customer)
    + sheetRow('Package', clean.packageName)
    + sheetRow('Monthly rate', `Rs ${clean.monthlyRate}`)
    + sheetRow('Mohalla', mohalla)
    + sheetRow('Shop contact route', contact)
    + sheetRow('Printed date', clean.printedDate)
    + `<p><strong>Handwritten note:</strong></p>`
    + `<div style="border: 1px solid #bbb; min-height: 60px;"></div>`
    + `</div>`;
}

export function infoSheetAllHtml(list) {
  const clean = normalizeInfoSheetList(list);
  if (clean.length === 0) return '<p>No info sheets recorded yet.</p>';
  const sorted = [...clean].sort((a, b) => a.customer.toLowerCase().localeCompare(b.customer.toLowerCase()));
  return sorted.map((sheet) => infoSheetHtml(sheet)).join('');
}

export function infoSheetCustomerHtml(list, customer) {
  const sheet = infoSheetForCustomer(list, customer);
  if (!sheet) return `<p>No info sheet recorded for ${escapeHtml(cleanText(customer))}.</p>`;
  return infoSheetHtml(sheet);
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function infoSheetCsv(list) {
  const clean = normalizeInfoSheetList(list);
  const lines = ['id,customer,package,monthly_rate,mohalla,contact_route,printed_date'];
  for (const sheet of clean) {
    lines.push([
      csvCell(sheet.id),
      csvCell(sheet.customer),
      csvCell(sheet.packageName),
      csvCell(sheet.monthlyRate),
      csvCell(sheet.mohalla),
      csvCell(sheet.contactRoute),
      csvCell(sheet.printedDate),
    ].join(','));
  }
  return lines.join('\n');
}

export function infoSheetFilename() {
  return 'shahdara-info-sheets.csv';
}
