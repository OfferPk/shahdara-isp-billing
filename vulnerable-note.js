// Plan 173 (Plan 101-202) — Vulnerable-Customer Note for Field Visits.
//
// On a visit, the collector may not know that a customer is elderly,
// has no phone, or needs extra time, so the visit is rushed or fails
// for a reason that could have been avoided. This module records one
// short note per customer, visible on the visit view, holding only
// practical visit needs — entered by the operator with the
// customer's knowledge. It carries no medical or personal detail
// beyond what the visit needs.
//
// What this module is NOT, stated plainly:
//   - It is not a visit outcome, bill, payment, or route record.
//     Recording, editing, or removing a note never changes any
//     visit outcome, bill, payment, or route, and this module never
//     reads or writes one.
//   - It never shares the note outside the visit view. The note is
//     surfaced only through vulnerableNoteForCustomer / the visit
//     panel; there is no export-to-anyone, no message, and no
//     sending of any kind.
//   - It is not a medical or personal record. Only the fixed
//     practical visit-need labels below plus one short free-text
//     line are stored; anything else is dropped.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A note with no id or no customer is refused outright.
//     Unknown fields are dropped, so a note can never grow a
//     visit-outcome, bill, payment, route, or sending field.
//   - One note per customer (case-insensitive): a second note for
//     the same customer with a different id is refused outright.
//     To record a customer again, the operator removes the old
//     note first.
//   - A duplicate id is never rewritten by recording: an identical
//     re-save leaves the list unchanged, and a re-save with
//     different figures also leaves the list unchanged. Changing
//     a note goes only through updateVulnerableNote, which keeps
//     the id and the customer and replaces only the needs and
//     the free-text line.
//   - Needs are only the fixed labels below. Any other label is
//     dropped, never stored, so a note can never smuggle in a
//     diagnosis or a personal detail through a label.

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// The only visit-need labels a note may carry. Each is a practical
// fact about how the visit should be run, nothing more.
export const VULNERABLE_NEED_LABELS = [
  'elderly',
  'no-phone',
  'family-member-present',
  'needs-extra-time',
];

const NEED_WORDS = {
  elderly: 'Elderly — allow extra patience',
  'no-phone': 'No phone — visit in person, do not rely on a call',
  'family-member-present': 'Needs a family member present',
  'needs-extra-time': 'Needs extra time — do not rush the visit',
};

function cleanNeeds(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const out = [];
  for (const item of raw) {
    const key = cleanKey(item);
    if (VULNERABLE_NEED_LABELS.includes(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

export function normalizeVulnerableNote(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const customerId = cleanText(value.customerId);
  if (!id || !customerId) return null;
  return {
    id,
    customerId,
    needs: cleanNeeds(value.needs),
    note: cleanText(value.note),
  };
}

export function normalizeVulnerableNoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const note = normalizeVulnerableNote(item);
    if (note) out.push(note);
  }
  return out;
}

export function findVulnerableNote(list, id) {
  const notes = normalizeVulnerableNoteList(list);
  const key = cleanText(id);
  return notes.find((note) => note.id === key) ?? null;
}

export function recordVulnerableNote(list, note) {
  const notes = normalizeVulnerableNoteList(list);
  const next = normalizeVulnerableNote(note);
  if (!next) return notes;
  if (notes.some((item) => item.id === next.id)) return notes;
  if (notes.some((item) => cleanKey(item.customerId) === cleanKey(next.customerId))) return notes;
  return [...notes, next];
}

// Editing replaces only the needs and the free-text line. The id
// and the customer never move, so an edit can never retarget a
// note at a different customer or merge two customers' notes.
export function updateVulnerableNote(list, id, patch) {
  const notes = normalizeVulnerableNoteList(list);
  const key = cleanText(id);
  if (!patch || typeof patch !== 'object') return notes;
  return notes.map((note) => {
    if (note.id !== key) return note;
    const updated = { ...note };
    if (patch.needs !== undefined) updated.needs = cleanNeeds(patch.needs);
    if (patch.note !== undefined) updated.note = cleanText(patch.note);
    return updated;
  });
}

export function removeVulnerableNote(list, id) {
  const notes = normalizeVulnerableNoteList(list);
  const key = cleanText(id);
  return notes.filter((note) => note.id !== key);
}

// The visit-view lookup: the note for one customer, matched
// case-insensitively, or null when that customer has no note.
// Nothing else about any other customer is returned.
export function vulnerableNoteForCustomer(list, customerId) {
  const notes = normalizeVulnerableNoteList(list);
  const key = cleanKey(customerId);
  return notes.find((note) => cleanKey(note.customerId) === key) ?? null;
}

export function vulnerableCustomers(list) {
  const seen = new Map();
  for (const note of normalizeVulnerableNoteList(list)) {
    const key = cleanKey(note.customerId);
    if (!seen.has(key)) seen.set(key, note.customerId);
  }
  return [...seen.values()].sort((a, b) => (cleanKey(a) < cleanKey(b) ? -1 : 1));
}

export function vulnerableNoteText(note) {
  const item = normalizeVulnerableNote(note);
  if (!item) return '';
  const needsText = item.needs.length > 0
    ? item.needs.map((need) => NEED_WORDS[need]).join('; ')
    : 'No specific visit needs recorded';
  const noteText = item.note ? ` Note: ${item.note}` : '';
  return `Visit note for ${item.customerId}: ${needsText}.${noteText}`;
}

export function vulnerableNoteSummaryText(list) {
  const notes = normalizeVulnerableNoteList(list);
  const customers = vulnerableCustomers(list);
  return `${notes.length} visit note${notes.length === 1 ? '' : 's'} for ${customers.length} customer${customers.length === 1 ? '' : 's'}`;
}

export function vulnerableNoteHtml(note) {
  const item = normalizeVulnerableNote(note);
  if (!item) return '';
  return `<p><strong>${escapeHtml(item.customerId)}</strong> · ${escapeHtml(vulnerableNoteText(item))} <small>(${escapeHtml(item.id)})</small></p>`;
}

export function vulnerableNoteAllHtml(list) {
  const notes = normalizeVulnerableNoteList(list);
  if (notes.length === 0) return '<p>No vulnerable-customer visit notes recorded.</p>';
  const sorted = [...notes].sort((a, b) => (cleanKey(a.customerId) < cleanKey(b.customerId) ? -1 : 1));
  return sorted.map((note) => vulnerableNoteHtml(note)).join('');
}

export function vulnerableNoteCsv(list) {
  const rows = [['id', 'customer', 'needs', 'note']];
  for (const note of normalizeVulnerableNoteList(list)) {
    rows.push([note.id, note.customerId, note.needs.join('; '), note.note]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function vulnerableNoteFilename() {
  return 'shahdara_vulnerable_notes.csv';
}
