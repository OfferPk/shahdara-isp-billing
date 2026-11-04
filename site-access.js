// Plan 156 (Plan 101-202) — Site Access Permission Record.
//
// Rooftop, pole, or building access is refused on the day
// because permission was never recorded from the last visit.
// This module is the memory: one access record per site with
// a site/location note, a permission holder, a permission
// scope, and an expiry or review date. A site view shows the
// current permission and flags expired or review-due
// permissions, so a field visit to a shared roof or building
// is never wasted on an access refusal.
//
// What this module is NOT, stated plainly:
//   - It is not a customer record, a ticket, a bill, or a
//     payment. Recording permission here never writes,
//     changes, or replaces any of those anywhere else: the
//     record only says who allowed access to which site, for
//     what, and until when.
//   - It is not a second copy of any neighbouring module.
//     No existing module records site access permission:
//     the midspan access audits (nav-midspan-access.js)
//     audit midspan equipment, and the site access notes in
//     other logs are visit notes, not permission records —
//     and none of them is read or written here. An access
//     record names a site by its own note only.
//   - It is not proof that access will be granted. The
//     record says what the operator recorded; the module
//     verifies format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a site, a holder, a
//     scope, and a real expiry or review date. A record with
//     no site or no holder is refused outright, as is any
//     impossible date. Unknown fields are dropped, so a
//     record can never grow a customer, ticket, bill, or
//     payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal of the record itself.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass). Against a reference
//     date, a permission is current when its expiry date is
//     still ahead, due when it falls on that date, and
//     expired when it is already past.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
function strictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  if (day < 1 || day > limit) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one access record, or null when half-formed. */
export function normalizeSiteAccess(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const site = cleanText(record.site);
  const holder = cleanText(record.holder);
  const scope = cleanText(record.scope);
  const expiryDate = strictDate(record.expiryDate);
  if (!id || !site || !holder || !scope || !expiryDate) return null;
  return { id, site, holder, scope, expiryDate };
}

/** Normalize a list: half-formed records dropped, order kept. */
export function normalizeSiteAccessList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const clean = normalizeSiteAccess(record);
    if (clean) out.push(clean);
  }
  return out;
}

/** Find one access record by id, or null. */
export function findSiteAccess(list, id) {
  const clean = normalizeSiteAccessList(list);
  const want = cleanText(id);
  return clean.find((item) => item.id === want) || null;
}

/**
 * Add an access record, or leave the list unchanged when the
 * record is half-formed or a duplicate id carrying different
 * figures. An identical re-save leaves the list unchanged.
 */
export function upsertSiteAccess(list, record) {
  const clean = normalizeSiteAccessList(list);
  const next = normalizeSiteAccess(record);
  if (!next) return clean;
  const existing = clean.find((item) => item.id === next.id);
  if (existing) {
    const same = existing.site === next.site
      && existing.holder === next.holder
      && existing.scope === next.scope
      && existing.expiryDate === next.expiryDate;
    return same ? clean : clean;
  }
  return [...clean, next];
}

/** Remove an access record by id; unknown ids leave the list unchanged. */
export function removeSiteAccess(list, id) {
  const clean = normalizeSiteAccessList(list);
  const want = cleanText(id);
  return clean.filter((item) => item.id !== want);
}

/**
 * Status of one record against a reference date: 'current'
 * when the expiry date is still ahead, 'due' when it falls
 * on that date, 'expired' when it is already past. An
 * invalid reference date gives null, never a guessed status.
 */
export function permissionStatus(record, referenceDate) {
  const clean = normalizeSiteAccess(record);
  const ref = strictDate(referenceDate);
  if (!clean || !ref) return null;
  if (clean.expiryDate < ref) return 'expired';
  if (clean.expiryDate === ref) return 'due';
  return 'current';
}

/** Records for one site (case-insensitive), latest expiry first, then id A-Z. */
export function sitePermissions(list, site) {
  const want = cleanText(site).toLowerCase();
  if (!want) return [];
  const clean = normalizeSiteAccessList(list).filter((item) => item.site.toLowerCase() === want);
  clean.sort((a, b) => compareText(b.expiryDate, a.expiryDate) || compareText(a.id, b.id));
  return clean;
}

/** The current permission for a site: its record with the latest expiry date, or null. */
export function siteCurrentPermission(list, site) {
  const records = sitePermissions(list, site);
  return records.length > 0 ? records[0] : null;
}

/** Every site present, A-Z (case-insensitive, first spelling kept). */
export function siteAccessSites(list) {
  const clean = normalizeSiteAccessList(list);
  const seen = new Map();
  for (const item of clean) {
    const key = item.site.toLowerCase();
    if (!seen.has(key)) seen.set(key, item.site);
  }
  return [...seen.values()].sort((a, b) => compareText(a.toLowerCase(), b.toLowerCase()));
}

/**
 * Expired or review-due records against a reference date:
 * most overdue expiry first, then id A-Z. An invalid
 * reference date gives an empty list, never a guessed order.
 */
export function flaggedPermissions(list, referenceDate) {
  const ref = strictDate(referenceDate);
  if (!ref) return [];
  const clean = normalizeSiteAccessList(list).filter((item) => item.expiryDate <= ref);
  clean.sort((a, b) => compareText(a.expiryDate, b.expiryDate) || compareText(a.id, b.id));
  return clean;
}

/** Summary text: records / sites / expired / due counts against a reference date. */
export function siteAccessSummaryText(list, referenceDate) {
  const clean = normalizeSiteAccessList(list);
  const sites = siteAccessSites(list).length;
  const ref = strictDate(referenceDate);
  let expired = 0;
  let due = 0;
  if (ref) {
    for (const item of clean) {
      if (item.expiryDate < ref) expired += 1;
      else if (item.expiryDate === ref) due += 1;
    }
  }
  const tail = ref ? `, ${expired} expired, ${due} due for review` : '';
  return `${clean.length} access record${clean.length === 1 ? '' : 's'} across ${sites} site${sites === 1 ? '' : 's'}${tail}.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusFlag(record, referenceDate) {
  const status = permissionStatus(record, referenceDate);
  if (status === 'expired') return '⚠ Expired';
  if (status === 'due') return '⚠ Due for review';
  if (status === 'current') return 'Current';
  return '—';
}

function accessRowHtml(item, referenceDate) {
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.site)}</td>`
    + `<td>${esc(item.holder)}</td><td>${esc(item.scope)}</td>`
    + `<td>${esc(item.expiryDate)}</td><td>${esc(statusFlag(item, referenceDate))}</td></tr>`;
}

function accessTableHtml(rows, intro, referenceDate) {
  const body = rows.map((item) => accessRowHtml(item, referenceDate)).join('');
  return `<p>${intro}</p>`
    + '<table><thead><tr><th>Id</th><th>Site</th>'
    + '<th>Holder</th><th>Scope</th><th>Expiry / review</th><th>Status</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

/** All access records as HTML, latest expiry first (then id A-Z). */
export function siteAccessAllHtml(list, referenceDate) {
  const clean = normalizeSiteAccessList(list);
  if (clean.length === 0) return '<p>No site access permissions recorded yet.</p>';
  clean.sort((a, b) => compareText(b.expiryDate, a.expiryDate) || compareText(a.id, b.id));
  return accessTableHtml(clean, 'All site access permissions, latest expiry first.', referenceDate);
}

/** One site as HTML: its current permission prominent, then its full history with flags. */
export function siteAccessHtml(list, site, referenceDate) {
  const records = sitePermissions(list, site);
  if (records.length === 0) {
    const want = cleanText(site);
    return want
      ? `<p>No access permission recorded for ${esc(want)}. Ask before the visit, not on the day.</p>`
      : '<p>Pick a site to see its current permission.</p>';
  }
  const current = records[0];
  const flag = statusFlag(current, referenceDate);
  return `<p>Current permission for ${esc(current.site)}: ${esc(current.holder)} — ${esc(current.scope)}, expiry / review ${esc(current.expiryDate)} (${esc(flag)}).</p>`
    + accessTableHtml(records, 'Full permission history for this site, latest expiry first.', referenceDate);
}

/** Expired or review-due permissions as HTML, most overdue first. */
export function flaggedAccessHtml(list, referenceDate) {
  const ref = strictDate(referenceDate);
  if (!ref) return '<p>Pick a real reference date to see expired or review-due permissions.</p>';
  const flagged = flaggedPermissions(list, ref);
  if (flagged.length === 0) return `<p>No expired or review-due permissions as of ${esc(ref)}. No visit will be wasted on an access refusal.</p>`;
  return accessTableHtml(flagged, `Expired or review-due permissions as of ${esc(ref)}, most overdue first — renew these before the next visit.`, ref);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of access records. */
export function siteAccessCsv(list) {
  const rows = normalizeSiteAccessList(list);
  const lines = ['id,site,holder,scope,expiryDate'];
  for (const item of rows) {
    lines.push([item.id, item.site, item.holder, item.scope, item.expiryDate].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the access log. */
export function siteAccessFilename() {
  return 'site-access.csv';
}
