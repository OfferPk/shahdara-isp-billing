// Plan 282 (Plan 203-350) — Customer move-out farewell note.
//
// A customer who leaves the area entirely gets an exit reason logged,
// but no farewell note, so the parting is abrupt and a return is
// never invited. This module adds only the missing piece: one
// farewell note per move-out — the customer, the move-out date, the
// farewell message summary in plain words, and whether a return
// was invited.
//
// What this module is NOT, stated plainly:
//   - It is not the exit reason log. That log records why a
//     customer left, for all exits; this module only records the
//     farewell said to a customer who moved out, and the exit
//     reason log is neither read nor rewritten here. The caller
//     supplies the customer and the date, and this module never
//     touches any exit record.
//   - It is not the move-house transfer record. That record keeps
//     a customer who moves within the area; this module is only
//     for a customer who leaves the area entirely, and the
//     transfer record is neither read nor rewritten here.
//   - It never changes any exit, equipment, bill, or payment
//     record. Recording a farewell note never changes any of
//     those, and this module holds no exit, equipment, bill, or
//     payment field beyond the names on the note itself, so there
//     is nothing here that could rewrite one. A wrong note is
//     removed and recorded again; there is no edit function.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every note,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A note with no id, no customer, no strict date, or no
//     farewell message is refused outright. Unknown fields are
//     dropped, so a note can never grow an exit, equipment,
//     bill, or payment field.
//   - A duplicate id is never rewritten.
//   - The return-invited answer folds to yes or no; a missing or
//     unclear answer reads as yes, because the farewell itself
//     is the invitation to come back.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validFarewellNoteDate(value) {
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

const RETURN_YES = new Set(['yes', 'y', 'invited', 'true', '1']);
const RETURN_NO = new Set(['no', 'n', 'not invited', 'false', '0']);

export function foldReturnInvited(value) {
  if (value === true) return true;
  if (value === false) return false;
  const folded = text(value).toLowerCase();
  if (RETURN_YES.has(folded)) return true;
  if (RETURN_NO.has(folded)) return false;
  return true;
}

export function normalizeFarewellNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const date = text(raw.date);
  const message = text(raw.message);
  if (!id || !customer) return null;
  if (!validFarewellNoteDate(date)) return null;
  if (!message) return null;
  return {
    id,
    customer,
    date,
    message,
    returnInvited: foldReturnInvited(raw.returnInvited),
  };
}

export function normalizeFarewellNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeFarewellNote(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findFarewellNote(list, id) {
  const clean = normalizeFarewellNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordFarewellNote(list, raw) {
  const clean = normalizeFarewellNoteList(list);
  const entry = normalizeFarewellNote(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeFarewellNote(list, id) {
  const clean = normalizeFarewellNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

export function farewellNoteSorted(list) {
  return normalizeFarewellNoteList(list).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.customer !== b.customer) return a.customer < b.customer ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function farewellNotesForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return farewellNoteSorted(list).filter(
    (entry) => entry.customer.toLowerCase() === wanted,
  );
}

export function latestFarewellNote(list, customer) {
  const rows = farewellNotesForCustomer(list, customer);
  return rows.length ? rows[rows.length - 1] : null;
}

export function farewellNoteCustomers(list) {
  const seen = new Map();
  for (const entry of normalizeFarewellNoteList(list)) {
    if (!entry.customer) continue;
    const key = entry.customer.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.customer);
  }
  return [...seen.values()];
}

export function farewellNoteSummaryText(list) {
  const clean = normalizeFarewellNoteList(list);
  if (clean.length === 0) return 'No move-out farewell notes recorded.';
  const invited = clean.filter((entry) => entry.returnInvited).length;
  const word = clean.length === 1 ? 'note' : 'notes';
  return `${clean.length} move-out farewell ${word} recorded, ${invited} inviting a return.`;
}

export function farewellNoteText(entry) {
  const clean = normalizeFarewellNote(entry);
  if (!clean) return 'No move-out farewell note recorded.';
  const invited = clean.returnInvited ? 'return invited' : 'return not invited';
  return `${clean.customer} — moved out ${clean.date} — ${clean.message} — ${invited}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function farewellNoteHtml(entry) {
  const clean = normalizeFarewellNote(entry);
  if (!clean) return '<p>No move-out farewell note recorded.</p>';
  return `<p>${escapeHtml(farewellNoteText(clean))}</p>`;
}

export function farewellNoteAllHtml(list) {
  const rows = farewellNoteSorted(list);
  if (!rows.length) return '<p>No move-out farewell notes recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(farewellNoteText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function farewellNoteCsv(list) {
  const rows = farewellNoteSorted(list);
  const lines = ['"id","customer","move-out date","farewell message","return invited"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.customer),
      csvCell(entry.date),
      csvCell(entry.message),
      csvCell(entry.returnInvited ? 'yes' : 'no'),
    ].join(','));
  }
  return lines.join('\n');
}

export function farewellNoteFilename() {
  return 'farewell-notes.csv';
}
