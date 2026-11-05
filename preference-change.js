// Plan 266 (Plan 203-350) — Customer preference change log.
//
// Contact and language preferences are recorded, but changes to
// them leave no history, so nobody can tell when a preference
// changed or what it was before. This module adds only the missing
// piece: one change entry per preference change — customer, the
// preference changed, the old value, the new value, the date, and
// the operator who recorded it — plus dated follow-up notes.
//
// What this module is NOT, stated plainly:
//   - It is not the contact preferences record. That record holds
//     the current choices per customer (channel, language,
//     opt-out) — it is neither read nor rewritten here. This
//     module logs changes only; it never sets a preference.
//   - It is not the language preference per draft type. That
//     record holds one written form per customer per draft type —
//     it is neither read nor rewritten here. A change to it is
//     logged here as a change entry, and nothing more.
//   - It never changes any bill, payment, or other customer
//     record. Logging a change never alters any of those, and
//     this module holds no bill, payment, or customer field
//     beyond the customer name and the two values on the entry
//     itself, so there is nothing here that could rewrite one.
//   - A change entry is never edited, only followed by a later
//     entry. There is no edit function: only record, annotate,
//     and remove. A dated follow-up never rewrites the customer,
//     the preference changed, the old value, the new value, the
//     date, the operator, or the note.
//   - A customer page lists preference changes newest first,
//     each naming the old and the new value, so the owner can
//     show exactly when a preference changed instead of arguing.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A record with no id, no customer, no preference changed,
//     no old value, no new value, no strict date, or no operator
//     is refused outright. Unknown fields are dropped, so a
//     record can never grow a bill, payment, or customer field.
//   - A duplicate id is never rewritten.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validPreferenceChangeDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validPreferenceChangeDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const preference = text(raw.preference);
  const oldValue = text(raw.oldValue);
  const newValue = text(raw.newValue);
  const date = text(raw.date);
  const operator = text(raw.operator);
  if (!id || !customer || !preference || !oldValue || !newValue) return null;
  if (!validPreferenceChangeDate(date)) return null;
  if (!operator) return null;
  const note = text(raw.note);
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, customer, preference, oldValue, newValue, date, operator, note, followups };
}

export function normalizePreferenceChangeList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordPreferenceChange(list, raw) {
  const clean = normalizePreferenceChangeList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removePreferenceChange(list, id) {
  const clean = normalizePreferenceChangeList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findPreferenceChange(list, id) {
  const clean = normalizePreferenceChangeList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addPreferenceChangeNote(list, id, date, note) {
  const clean = normalizePreferenceChangeList(list);
  const wanted = text(id);
  const followup = cleanFollowup({ date, note });
  if (!wanted || !followup) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, followups: [...item.followups, followup] };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.customer.toLowerCase() !== b.customer.toLowerCase()) return a.customer.toLowerCase() < b.customer.toLowerCase() ? -1 : 1;
  if (a.preference.toLowerCase() !== b.preference.toLowerCase()) return a.preference.toLowerCase() < b.preference.toLowerCase() ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function preferenceChangeSorted(list) {
  return normalizePreferenceChangeList(list).sort(compareEntries);
}

export function preferenceChangesForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return preferenceChangeSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function preferenceChangeCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of preferenceChangeSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

export function preferenceChangeSummaryText(list) {
  const clean = normalizePreferenceChangeList(list);
  if (!clean.length) return 'No preference changes recorded.';
  const customers = preferenceChangeCustomers(list).length;
  return `${clean.length} preference change${clean.length === 1 ? '' : 's'} for ${customers} customer${customers === 1 ? '' : 's'}.`;
}

export function preferenceChangeText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No preference change recorded.';
  const note = clean.note ? ` Note: ${clean.note.replace(/\.+$/, '')}.` : '';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `${clean.customer} — ${clean.preference} changed from ${clean.oldValue} to ${clean.newValue} on ${clean.date}, recorded by ${clean.operator}.${note}${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function preferenceChangeHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No preference change recorded.</p>';
  return `<p>${escapeHtml(preferenceChangeText(clean))}</p>`;
}

export function preferenceChangeAllHtml(list) {
  const sorted = preferenceChangeSorted(list);
  if (!sorted.length) return '<p>No preference changes recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(preferenceChangeText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function preferenceChangeCsv(list) {
  const sorted = preferenceChangeSorted(list);
  const header = ['id', 'customer', 'preference', 'old value', 'new value', 'date', 'operator', 'note', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.preference,
    item.oldValue,
    item.newValue,
    item.date,
    item.operator,
    item.note,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function preferenceChangeFilename() {
  return 'preference-changes.csv';
}
