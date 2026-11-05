// Plan 324 (Plan 203-350) — Print template register.
//
// Printouts (info sheets, receipts in Urdu script) drift
// apart because nobody records which template version
// each printout uses. This module adds only the missing
// piece: one register entry per print template — the
// template name, its purpose, its version, the date it
// was adopted, and the screens or printed sheets it
// serves — so every template shows its current version
// and adoption date, and superseded versions stay listed
// as superseded, never deleted.
//
// What this module is NOT, stated plainly:
//   - It is not a new printout type. It registers
//     templates only; it never creates an info sheet,
//     a receipt, or any other printed sheet.
//   - It is not the self-service info sheet (Plan 165),
//     which is a printout for customers. That sheet
//     already exists and is neither read nor rewritten
//     here; this register only records which template
//     version a printout uses.
//   - It is not the Urdu receipt option (Plan 168),
//     which renders receipts in Urdu script. That
//     option already exists and is neither read nor
//     rewritten here; this register never renders a
//     receipt itself.
//   - It is not the branding pack (Plan Q), which sets
//     the shop's look on printed sheets. That pack
//     already exists and is neither read nor rewritten
//     here; this register only records template
//     versions, it never changes a look or a layout.
//   - It is not the accessibility note per screen
//     (Plan 323), which records screens that are hard
//     to use. Those notes already exist and are neither
//     read nor rewritten here; a register entry is
//     about a print template, never about a screen
//     being hard to use.
//   - It is not a bill, payment, or customer change.
//     Recording or superseding an entry never changes
//     any printed sheet, bill, payment, or customer
//     record by itself: the register only lists which
//     template version is current and which versions
//     are superseded.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every entry, and the module never reads storage,
//     the clock, or the network, and never mutates an
//     input.
//   - An entry with no id, no template name, no
//     purpose, no version, or no strict adoption date
//     is refused outright. Unknown fields are dropped,
//     so an entry can never grow a bill, payment, or
//     customer field.
//   - A duplicate id is never rewritten: the first
//     entry stays.
//   - Superseding an entry only changes that entry's
//     status to superseded and records which newer
//     entry superseded it. A superseded entry stays
//     in the list, listed as superseded, and is never
//     deleted; an already-superseded entry cannot be
//     superseded again.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validPrintTemplateDay(value) {
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

function cleanServes(value) {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function cleanStatus(value) {
  return text(value).toLowerCase() === 'superseded' ? 'superseded' : 'current';
}

/**
 * One print template register entry, or null when
 * half-formed. An entry needs an id, a template name,
 * a purpose, a version, and a strict adoption date.
 * The screens or printed sheets it serves are a list
 * of plain words (an array, or a comma-separated
 * string); they may be empty until they are known.
 * The status folds to current unless it literally
 * reads superseded. Unknown fields are dropped; the
 * input is never mutated.
 */
export function normalizePrintTemplate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const name = text(raw.name);
  const purpose = text(raw.purpose);
  const version = text(raw.version);
  const date = text(raw.date);
  if (!id) return null;
  if (!name) return null;
  if (!purpose) return null;
  if (!version) return null;
  if (!validPrintTemplateDay(date)) return null;
  const status = cleanStatus(raw.status);
  const supersededBy = status === 'superseded' ? text(raw.supersededBy) : '';
  return { id, name, purpose, version, date, serves: cleanServes(raw.serves), status, supersededBy };
}

/** Normalised print template entries only; a duplicate id is never rewritten, the first stays. */
export function normalizePrintTemplateList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizePrintTemplate(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findPrintTemplate(list, id) {
  const clean = normalizePrintTemplateList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

/**
 * Record a print template entry. Refused when
 * half-formed or when its id is already recorded — the
 * first entry for an id always stays.
 */
export function recordPrintTemplate(list, raw) {
  const clean = normalizePrintTemplateList(list);
  const entry = normalizePrintTemplate(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

/**
 * Supersede one entry: its status becomes superseded
 * and the newer entry that superseded it is recorded.
 * Only that entry changes. Refused when the id is
 * missing or unknown, or when the entry is already
 * superseded — a superseded entry stays listed, it is
 * never deleted and never superseded again.
 */
export function supersedePrintTemplate(list, id, supersededBy) {
  const clean = normalizePrintTemplateList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  const nextBy = text(supersededBy);
  let changed = false;
  const out = clean.map((entry) => {
    if (entry.id !== wanted || entry.status === 'superseded') return entry;
    changed = true;
    return { ...entry, status: 'superseded', supersededBy: nextBy };
  });
  return changed ? out : clean;
}

function byDateThenId(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function byNameThenDay(a, b) {
  const nameA = a.name.toLowerCase();
  const nameB = b.name.toLowerCase();
  if (nameA !== nameB) return nameA < nameB ? -1 : 1;
  return byDateThenId(a, b);
}

/**
 * The current version of one template, or null when
 * the template has no current entry. Among current
 * entries with the same name (case-insensitive), the
 * latest adopted date wins; superseded entries never
 * count as current.
 */
export function printTemplateCurrentVersion(list, name) {
  const wanted = text(name).toLowerCase();
  if (!wanted) return null;
  const current = normalizePrintTemplateList(list)
    .filter((entry) => entry.name.toLowerCase() === wanted && entry.status === 'current')
    .sort(byDateThenId);
  if (!current.length) return null;
  return current[current.length - 1].version;
}

/** Every entry for one template name, in adoption date order; the match is case-insensitive. */
export function printTemplatesForName(list, name) {
  const wanted = text(name).toLowerCase();
  if (!wanted) return [];
  return normalizePrintTemplateList(list)
    .filter((entry) => entry.name.toLowerCase() === wanted)
    .sort(byDateThenId);
}

/** Entries grouped by template name, names in A-Z order, entries in adoption date order. */
export function printTemplatesByName(list) {
  const clean = normalizePrintTemplateList(list);
  const groups = [];
  const byName = new Map();
  for (const entry of clean) {
    const key = entry.name.toLowerCase();
    if (!byName.has(key)) {
      const group = { name: entry.name, items: [] };
      byName.set(key, group);
      groups.push(group);
    }
    byName.get(key).items.push(entry);
  }
  groups.sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
  });
  for (const group of groups) group.items.sort(byDateThenId);
  return groups;
}

/** Template names that carry at least one entry, A-Z, in plain words. */
export function printTemplateNamesWithEntries(list) {
  return printTemplatesByName(list).map((group) => group.name);
}

/** Plain-words summary: how many templates are registered, how many are current, how many superseded. */
export function printTemplateSummaryText(list) {
  const clean = normalizePrintTemplateList(list);
  if (!clean.length) return 'No print templates registered.';
  const names = printTemplateNamesWithEntries(list).length;
  const current = clean.filter((entry) => entry.status === 'current').length;
  const superseded = clean.length - current;
  const templateWord = names === 1 ? '1 print template registered' : `${names} print templates registered`;
  const currentWord = current === 1 ? '1 current version' : `${current} current versions`;
  const supersededWord = superseded === 1 ? '1 superseded version' : `${superseded} superseded versions`;
  return `${templateWord}: ${currentWord}, ${supersededWord}.`;
}

/** One line naming a print template entry, for lists and messages. */
export function printTemplateEntryText(entry) {
  const clean = normalizePrintTemplate(entry);
  if (!clean) return '';
  const serves = clean.serves.length ? ` — serves ${clean.serves.join(', ')}` : '';
  const status = clean.status === 'superseded' ? ' (superseded)' : '';
  return `${clean.date} — ${clean.name} ${clean.version}: ${clean.purpose}${serves}${status}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function printTemplateEntryHtml(entry) {
  const clean = normalizePrintTemplate(entry);
  if (!clean) return '';
  return `<li>${escapeHtml(printTemplateEntryText(clean))}</li>`;
}

/** Entries grouped by template name, with each entry's version, adoption date and status shown; an empty list says so plainly. */
export function printTemplatesByNameHtml(list) {
  const groups = printTemplatesByName(list);
  if (!groups.length) return '<p>No print templates registered.</p>';
  return groups
    .map(
      (group) =>
        `<h4>${escapeHtml(group.name)}</h4><ul>${group.items
          .map((entry) => printTemplateEntryHtml(entry))
          .join('')}</ul>`,
    )
    .join('');
}

export function printTemplateAllHtml(list) {
  const clean = normalizePrintTemplateList(list);
  if (!clean.length) return '<p>No print templates registered.</p>';
  const sorted = [...clean].sort(byNameThenDay);
  return `<ul>${sorted.map((entry) => printTemplateEntryHtml(entry)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function printTemplateCsv(list) {
  const clean = normalizePrintTemplateList(list);
  const sorted = [...clean].sort(byNameThenDay);
  const header = ['id', 'name', 'purpose', 'version', 'date', 'serves', 'status', 'supersededBy'].join(',');
  const rows = sorted.map((entry) =>
    [entry.id, entry.name, entry.purpose, entry.version, entry.date, entry.serves.join('; '), entry.status, entry.supersededBy]
      .map(csvCell)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

export function printTemplateFilename() {
  return 'print-templates.csv';
}
