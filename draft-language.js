// Plan 164 (Plan 101-202) — Language Preference Per Draft Type.
//
// One customer reads Roman Urdu comfortably and another prefers Urdu
// script, but every draft goes out in the same form, so some messages
// are never properly read. This module is the RECORD for one language
// preference per customer per draft type (for example greeting,
// announcement, or service-change confirmation), chosen from Roman
// Urdu or Urdu script, stored separately from any other contact
// preference.
//
// What this module is NOT, stated plainly:
//   - It is not the global interface language. nav-language.js switches
//     the whole app UI between English and Urdu; it is neither read
//     nor written here. This module stores, per customer and per
//     draft type, which written form that customer's drafts use.
//   - It never sends anything. A draft created with a preference is
//     still a draft the operator reviews and sends by hand.
//   - It never changes any bill, payment, or customer record beyond
//     the preference itself. It reads and writes no other record
//     type at all: no bill, no payment, no package, no status, and
//     no contact-preference record.
//   - It never blocks a draft. When no preference is stored for a
//     customer and draft type, the draft falls back to Roman Urdu.
//   - It is not proof that a preference is right. The record says
//     what the operator recorded; the module verifies format and
//     ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never touches another record.
//   - A preference with no customer, no draft type, no id, or a
//     language outside Roman Urdu / Urdu script is refused outright.
//     Unknown fields are dropped, so a preference can never grow a
//     bill, payment, package, status, or sending field.
//   - One preference per customer per draft type: a second record
//     for the same customer (case-insensitive) and the same draft
//     type (case-insensitive) with a different id is refused outright.
//     Changing one type's preference therefore never touches any
//     other type: the operator removes the old record for that pair
//     and records the new one.
//   - A duplicate id is never rewritten: an identical re-save leaves
//     the list unchanged, and a re-save with different figures is
//     refused outright. There is no edit function; the only later
//     changes are removal, and remove-then-record to change a
//     preference.

export const DRAFT_LANGUAGES = ['roman', 'urdu'];

export const DRAFT_LANGUAGE_LABELS = {
  roman: 'Roman Urdu',
  urdu: 'Urdu script',
};

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLanguage(value) {
  const text = cleanText(value).toLowerCase();
  return DRAFT_LANGUAGES.includes(text) ? text : '';
}

export function normalizeDraftLanguage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const customer = cleanText(raw.customer);
  const draftType = cleanText(raw.draftType).toLowerCase();
  const language = normalizeLanguage(raw.language);
  if (!id || !customer || !draftType || !language) return null;
  return { id, customer, draftType, language };
}

export function normalizeDraftLanguageList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenIds = new Set();
  const seenPair = new Set();
  for (const entry of list) {
    const record = normalizeDraftLanguage(entry);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    const key = `${record.customer.toLowerCase()}|${record.draftType}`;
    if (seenPair.has(key)) continue;
    seenIds.add(record.id);
    seenPair.add(key);
    out.push(record);
  }
  return out;
}

export function findDraftLanguage(list, id) {
  const records = normalizeDraftLanguageList(list);
  return records.find((record) => record.id === id) || null;
}

export function upsertDraftLanguage(list, raw) {
  const records = normalizeDraftLanguageList(list);
  const record = normalizeDraftLanguage(raw);
  if (!record) return records;
  const existing = records.find((item) => item.id === record.id);
  // A duplicate id is never rewritten: an identical re-save leaves
  // the list unchanged, and different figures are refused outright.
  if (existing) return records;
  const clash = records.some((item) => item.customer.toLowerCase() === record.customer.toLowerCase()
    && item.draftType === record.draftType);
  if (clash) return records;
  return [...records, record];
}

export function removeDraftLanguage(list, id) {
  return normalizeDraftLanguageList(list).filter((record) => record.id !== id);
}

// Change one customer's preference for one draft type, leaving every
// other type untouched: drop the old record for that pair, then
// record the new one. The new record keeps the caller's id when one
// is given, so the change is a single deliberate step.
export function changeDraftLanguage(list, raw) {
  const record = normalizeDraftLanguage(raw);
  if (!record) return normalizeDraftLanguageList(list);
  const kept = normalizeDraftLanguageList(list).filter((item) => !(
    item.customer.toLowerCase() === record.customer.toLowerCase()
    && item.draftType === record.draftType
    && item.id !== record.id));
  const existing = kept.find((item) => item.id === record.id);
  if (existing) return kept;
  return [...kept, record];
}

// The language a draft of a given type uses for a customer. A missing
// preference never blocks a draft: it falls back to Roman Urdu.
export function preferenceFor(list, customer, draftType) {
  const records = normalizeDraftLanguageList(list);
  const wantedCustomer = cleanText(customer).toLowerCase();
  const wantedType = cleanText(draftType).toLowerCase();
  if (!wantedCustomer || !wantedType) return 'roman';
  const found = records.find((record) => record.customer.toLowerCase() === wantedCustomer
    && record.draftType === wantedType);
  return found ? found.language : 'roman';
}

// Pick the draft text in the customer's preferred form for this draft
// type. A missing Urdu text falls back to the Roman text, so a draft
// is never left blank by a missing translation.
export function applyDraftLanguage(list, customer, draftType, romanText, urduText) {
  const language = preferenceFor(list, customer, draftType);
  if (language === 'urdu' && cleanText(urduText)) return cleanText(urduText);
  return cleanText(romanText);
}

export function draftLanguageForCustomer(list, customer) {
  const records = normalizeDraftLanguageList(list);
  const wanted = cleanText(customer).toLowerCase();
  if (!wanted) return [];
  return records
    .filter((record) => record.customer.toLowerCase() === wanted)
    .sort((a, b) => (a.draftType < b.draftType ? -1 : a.draftType > b.draftType ? 1 : 0));
}

export function draftLanguageCustomers(list) {
  const records = normalizeDraftLanguageList(list);
  const seen = new Map();
  for (const record of records) {
    const key = record.customer.toLowerCase();
    if (!seen.has(key)) seen.set(key, record.customer);
  }
  return [...seen.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1
    : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
}

export function draftLanguageSummaryText(list) {
  const records = normalizeDraftLanguageList(list);
  const customers = draftLanguageCustomers(list).length;
  return `${records.length} draft language preference${records.length === 1 ? '' : 's'} for ${customers} customer${customers === 1 ? '' : 's'}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function preferenceRowHtml(record) {
  return `<tr><td>${escapeHtml(record.customer)}</td><td>${escapeHtml(record.draftType)}</td>`
    + `<td>${escapeHtml(DRAFT_LANGUAGE_LABELS[record.language])}</td>`
    + `<td>${escapeHtml(record.id)}</td></tr>`;
}

export function draftLanguageAllHtml(list) {
  const records = normalizeDraftLanguageList(list)
    .sort((a, b) => (a.customer.toLowerCase() < b.customer.toLowerCase() ? -1
      : a.customer.toLowerCase() > b.customer.toLowerCase() ? 1
      : a.draftType < b.draftType ? -1 : a.draftType > b.draftType ? 1 : 0));
  if (records.length === 0) return '<p>No draft language preferences recorded yet.</p>';
  return '<table><thead><tr><th>Customer</th><th>Draft type</th><th>Language</th><th>Id</th></tr></thead><tbody>'
    + records.map(preferenceRowHtml).join('') + '</tbody></table>';
}

export function draftLanguageCustomerHtml(list, customer) {
  const records = draftLanguageForCustomer(list, customer);
  if (records.length === 0) {
    return `<p>No draft language preference recorded for ${escapeHtml(customer)} — drafts for this customer fall back to Roman Urdu.</p>`;
  }
  return '<table><thead><tr><th>Customer</th><th>Draft type</th><th>Language</th><th>Id</th></tr></thead><tbody>'
    + records.map(preferenceRowHtml).join('') + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function draftLanguageCsv(list) {
  const records = normalizeDraftLanguageList(list);
  const lines = ['customer,draft_type,language,id'];
  for (const record of records) {
    lines.push([record.customer, record.draftType, record.language, record.id].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function draftLanguageFilename() {
  return 'draft-language-preferences.csv';
}
