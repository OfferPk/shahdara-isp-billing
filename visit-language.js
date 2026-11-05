// Plan 280 (Plan 203-350) — Customer language and dialect note per visit.
//
// The language a customer actually speaks at the door is not noted
// per visit, so each visit risks starting in the wrong language.
// This module adds only the missing piece: one language note per
// visit — the customer, the visit date, the language or dialect
// observed on that visit, and a note.
//
// What this module is NOT, stated plainly:
//   - It is not the language preference per draft type. The Plan
//     164 record stores which written form (Roman Urdu or Urdu
//     script) a customer's drafts use, per draft type; it governs
//     written drafts only, and it is neither read nor rewritten
//     here. A visit language note records only what was heard at
//     the door on that one visit, and it never changes any
//     preference record.
//   - It is not a customer record change. Recording a note never
//     changes any customer record, any bill, or any payment. It
//     holds no bill, payment, or customer-status field at all, so
//     there is nothing here that could rewrite one.
//   - It never sends anything and never picks a language for the
//     operator. The latest note is only surfaced on the visit view
//     so the operator can see, at a glance, which language was
//     heard last time.
//   - It is not proof that a language is right. The record says
//     what the operator observed on that visit; the module verifies
//     format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every note,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A note with no id, no customer, no visit date, or no
//     language observed is refused outright. Unknown fields are
//     dropped, so a note can never grow a preference, bill, or
//     payment field.
//   - A duplicate id is never rewritten. There is no edit
//     function: only record, find, and remove. A wrong note is
//     removed and recorded again.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validVisitLanguageDate(value) {
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

export function normalizeVisitLanguage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const visitDate = text(raw.visitDate);
  const language = text(raw.language);
  if (!id || !customer || !language) return null;
  if (!validVisitLanguageDate(visitDate)) return null;
  return {
    id,
    customer,
    visitDate,
    language,
    note: text(raw.note),
  };
}

export function normalizeVisitLanguageList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeVisitLanguage(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findVisitLanguage(list, id) {
  const clean = normalizeVisitLanguageList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordVisitLanguage(list, raw) {
  const clean = normalizeVisitLanguageList(list);
  const entry = normalizeVisitLanguage(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeVisitLanguage(list, id) {
  const clean = normalizeVisitLanguageList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

export function visitLanguageSorted(list) {
  return normalizeVisitLanguageList(list).slice().sort((a, b) => {
    if (a.visitDate !== b.visitDate) return a.visitDate < b.visitDate ? -1 : 1;
    if (a.customer !== b.customer) return a.customer < b.customer ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function visitLanguagesForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return visitLanguageSorted(list)
    .filter((entry) => entry.customer.toLowerCase() === wanted)
    .reverse();
}

export function latestVisitLanguage(list, customer) {
  const rows = visitLanguagesForCustomer(list, customer);
  return rows.length ? rows[0] : null;
}

export function visitLanguageCustomers(list) {
  const seen = new Map();
  for (const entry of normalizeVisitLanguageList(list)) {
    const key = entry.customer.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.customer);
  }
  return [...seen.values()];
}

export function visitLanguagesObserved(list) {
  const seen = new Map();
  for (const entry of normalizeVisitLanguageList(list)) {
    const key = entry.language.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.language);
  }
  return [...seen.values()];
}

export function visitLanguageSummaryText(list) {
  const clean = normalizeVisitLanguageList(list);
  if (clean.length === 0) return 'No visit language notes recorded.';
  const word = clean.length === 1 ? 'note' : 'notes';
  const languages = visitLanguagesObserved(list);
  return `${clean.length} visit language ${word} recorded, covering ${languages.length} language${languages.length === 1 ? '' : 's'} observed.`;
}

export function visitLanguageText(entry) {
  const clean = normalizeVisitLanguage(entry);
  if (!clean) return 'No visit language note recorded.';
  const note = clean.note ? ` — ${clean.note}` : '';
  return `${clean.customer} — visited ${clean.visitDate} — speaks ${clean.language}${note}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function visitLanguageHtml(entry) {
  const clean = normalizeVisitLanguage(entry);
  if (!clean) return '<p>No visit language note recorded.</p>';
  return `<p>${escapeHtml(visitLanguageText(clean))}</p>`;
}

export function visitLanguageAllHtml(list) {
  const rows = visitLanguageSorted(list);
  if (!rows.length) return '<p>No visit language notes recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(visitLanguageText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function visitLanguageCsv(list) {
  const rows = visitLanguageSorted(list);
  const lines = ['"id","customer","visit date","language","note"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.customer),
      csvCell(entry.visitDate),
      csvCell(entry.language),
      csvCell(entry.note),
    ].join(','));
  }
  return lines.join('\n');
}

export function visitLanguageFilename() {
  return 'visit-language-notes.csv';
}
