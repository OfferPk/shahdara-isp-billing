// Plan 138 (Plan 101-202) — Field photo/note attachment record
// (metadata only).
//
// Field photos and notes live on a phone and cannot be found later
// when a fault repeats at the same premises. This module is the
// finding aid: one attachment record per field item with a linked
// customer or ticket, a date, a type (photo or note), and a short
// description — plus an optional operator-typed file reference
// (for example a phone filename) so the item can be found again
// on that phone. Only metadata is stored here, never a file.
//
// What this module is NOT, stated plainly:
//   - It is not an upload, a sync, or a send. No file content,
//     no photo bytes, and no link to a cloud copy is ever stored
//     or moved by this module: there is no network call, no
//     storage read, and no file input anywhere in it. A record
//     that arrives carrying file-content fields (data, blob,
//     content, url, or anything like them) has those fields
//     dropped outright, so a file can never creep into this log.
//   - It is not a second copy of any ticket, fault, or visit
//     record. No existing attachment record module was found to
//     check against: the ticket log (ticket-log.js) and the visit
//     outcomes (visit-outcomes.js) hold no photo or attachment
//     fields, and they are neither read nor written here. An
//     attachment names a customer or a ticket by id only; it
//     never changes that customer, that ticket, any fault, any
//     bill, or any payment.
//   - It is not proof of a fault. A description says what the
//     operator saw; the module verifies format and ordering,
//     not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a link (a customer or
//     a ticket — at least one), a real calendar date, a type of
//     photo or note, and a short description. A record with no
//     link and no description is refused, and so is a record
//     with no link at all, no description at all, an unknown
//     type, or an impossible date. Unknown fields are dropped,
//     so a record can never grow a fault, bill, or payment
//     field, and can never grow a file-content field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - A customer or ticket page lists that link's attachments
//     newest first, then id A-Z, with descriptions. A link with
//     no attachments says so plainly, never pretends an item.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validFieldAttachmentDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** The two attachment types. */
export const FIELD_ATTACHMENT_TYPES = ['photo', 'note'];

/** Clean a type: 'photo' or 'note' (case-insensitive), else null. */
export function cleanFieldAttachmentType(value) {
  const type = cleanText(value).toLowerCase();
  return FIELD_ATTACHMENT_TYPES.includes(type) ? type : null;
}

/** Normalise one attachment record, or null when it is half-formed. */
export function normalizeFieldAttachment(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const ticket = cleanText(record.ticket);
  const date = validFieldAttachmentDate(record.date);
  const type = cleanFieldAttachmentType(record.type);
  const description = cleanText(record.description);
  if (!id || !date || !type || !description) return null;
  if (!customer && !ticket) return null;
  return {
    id,
    customer,
    ticket,
    date,
    type,
    description,
    fileRef: cleanText(record.fileRef),
  };
}

/** Normalise a list, dropping half-formed records. */
export function normalizeFieldAttachmentList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const item = normalizeFieldAttachment(record);
    if (item && !out.some((row) => row.id === item.id)) out.push(item);
  }
  return out;
}

/** Find one attachment by id, or null. */
export function findFieldAttachment(list, id) {
  const base = normalizeFieldAttachmentList(list);
  return base.find((item) => item.id === cleanText(id)) ?? null;
}

/**
 * Save one attachment. An identical re-save leaves the list
 * unchanged; a re-save of the same id with different figures is
 * refused. A half-formed record is refused. Returns a new list.
 */
export function upsertFieldAttachment(list, record) {
  const base = normalizeFieldAttachmentList(list);
  const item = normalizeFieldAttachment(record);
  if (!item) return base;
  const at = base.findIndex((row) => row.id === item.id);
  if (at === -1) return [...base, item];
  const existing = base[at];
  const same = existing.customer === item.customer
    && existing.ticket === item.ticket
    && existing.date === item.date
    && existing.type === item.type
    && existing.description === item.description
    && existing.fileRef === item.fileRef;
  if (same) return base;
  return base;
}

/** Remove one attachment by id. Returns a new list. */
export function removeFieldAttachment(list, id) {
  const base = normalizeFieldAttachmentList(list);
  const key = cleanText(id);
  return base.filter((item) => item.id !== key);
}

function sortNewestFirst(rows) {
  return [...rows].sort((a, b) => compareText(b.date, a.date) || compareText(a.id, b.id));
}

/** One customer's attachments, newest first (customer match is case-insensitive). */
export function fieldAttachmentsForCustomer(list, customer) {
  const base = normalizeFieldAttachmentList(list);
  const key = cleanText(customer).toLowerCase();
  if (!key) return [];
  return sortNewestFirst(base.filter((item) => item.customer.toLowerCase() === key));
}

/** One ticket's attachments, newest first (ticket match is exact after trimming). */
export function fieldAttachmentsForTicket(list, ticket) {
  const base = normalizeFieldAttachmentList(list);
  const key = cleanText(ticket);
  if (!key) return [];
  return sortNewestFirst(base.filter((item) => item.ticket === key));
}

/**
 * A link page: attachments for a customer name or a ticket id,
 * newest first. A customer match is case-insensitive; a ticket
 * match is exact after trimming. An empty link lists nothing.
 */
export function fieldAttachmentsForLink(list, link) {
  const base = normalizeFieldAttachmentList(list);
  const key = cleanText(link);
  if (!key) return [];
  const lower = key.toLowerCase();
  return sortNewestFirst(base.filter((item) => item.customer.toLowerCase() === lower || item.ticket === key));
}

/** Counts: attachments, distinct customers, distinct tickets. */
export function fieldAttachmentCounts(list) {
  const base = normalizeFieldAttachmentList(list);
  const customers = new Set(base.filter((item) => item.customer).map((item) => item.customer.toLowerCase()));
  const tickets = new Set(base.filter((item) => item.ticket).map((item) => item.ticket));
  return { attachments: base.length, customers: customers.size, tickets: tickets.size };
}

/** One-line summary of the whole log. */
export function fieldAttachmentSummaryText(list) {
  const base = normalizeFieldAttachmentList(list);
  if (base.length === 0) return 'No field attachment recorded yet.';
  const counts = fieldAttachmentCounts(base);
  const photos = base.filter((item) => item.type === 'photo').length;
  const notes = base.length - photos;
  return `${counts.attachments} field attachment${counts.attachments === 1 ? '' : 's'} (${photos} photo${photos === 1 ? '' : 's'}, ${notes} note${notes === 1 ? '' : 's'}) across ${counts.customers} customer${counts.customers === 1 ? '' : 's'} and ${counts.tickets} ticket${counts.tickets === 1 ? '' : 's'}. Metadata only — no file is uploaded, synced, or sent.`;
}

/** A customer or ticket page: that link's attachments newest first, with descriptions. */
export function fieldAttachmentHtml(list, link) {
  const key = cleanText(link);
  if (!key) return '<p>Pick a customer or a ticket to see their field attachments.</p>';
  const rows = fieldAttachmentsForLink(list, key);
  if (rows.length === 0) return `<p>No field attachment recorded yet for ${escapeHtml(key)}.</p>`;
  const body = rows
    .map((item) => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.fileRef)}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Id</th><th>Date</th><th>Type</th><th>Description</th><th>File reference (on phone)</th></tr></thead><tbody>${body}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value);
  return /[\",\n]/.test(text) ? `"${text.replace(/\"/g, '""')}"` : text;
}

/** CSV for a list of attachments. */
export function fieldAttachmentCsv(list) {
  const base = normalizeFieldAttachmentList(list);
  const header = 'id,customer,ticket,date,type,description,fileRef';
  const rows = base.map((item) => [item.id, item.customer, item.ticket, item.date, item.type, item.description, item.fileRef].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

/** CSV filename for the log. */
export function fieldAttachmentFilename() {
  return 'field-attachments.csv';
}
