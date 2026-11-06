/**
 * Plan 353 — Find customer by mohalla plus name combined filter.
 *
 * Common names repeat across mohallas, so searching by name alone
 * returns several look-alike customers and the operator can open the
 * wrong profile. This module is the mohalla-first half of the fix:
 * pick a mohalla, then search names within that mohalla only. The
 * mohalla list itself is never copied here — the caller passes the
 * app's own list in, so there is exactly one list in the whole app.
 *
 * Matching is by cleaned key, so spelling variants fold together:
 * "Bani", "BANII" and "MOHALLA BANI" are the same mohalla, and a
 * customer whose record carries only the legacy area field is still
 * found through that field. A blank mohalla means the full list —
 * clearing the filter returns to every customer.
 *
 * The filter is read-only and stores nothing: it takes the customer
 * list, the chosen mohalla and the typed name from the caller and
 * returns the matching records in name order. It never changes any
 * customer record, adds no new field, and never invents a mohalla.
 */

/** Collapse whitespace and trim, so "  Bani  " and "Bani" compare equal. */
function cleanText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

/**
 * Comparison key for a mohalla value: cleaned, lowercased, with the
 * leading generic "Mohalla" word stripped, since it is not part of a
 * mohalla's identity. Blank values give an empty key.
 *
 * Evidenced spelling variants fold into their canonical key: the old
 * suggestion list wrote single-i KISHTI/CHAMYAA and "MOHALAA BANI",
 * while the owner's list uses double-i KISHTII/CHAMYAAA and BANII.
 * These three foldings mirror the canonical module's table, so a
 * customer stored under an old spelling is still found.
 */
const MOHALLA_KEY_ALIASES = Object.freeze({ bani: 'banii', kishti: 'kishtii', chamyaa: 'chamyaaa' });

export function mohallaNameFilterKey(value) {
  const text = cleanText(value);
  if (!text) return '';
  const stripped = text.replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  const key = (stripped || text).toLocaleLowerCase();
  return MOHALLA_KEY_ALIASES[key] ?? key;
}

/**
 * The canonical list entry for a typed or selected mohalla value, or
 * null when the value is blank or matches no entry in the list. The
 * returned spelling is the list's own spelling, so the filter always
 * displays the standard form.
 */
export function resolveMohallaFilter(value, mohallaList) {
  const key = mohallaNameFilterKey(value);
  if (!key) return null;
  const list = Array.isArray(mohallaList) ? mohallaList : [];
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    if (mohallaNameFilterKey(entry) === key) return entry;
  }
  return null;
}

/**
 * True when the customer belongs to the chosen mohalla — or when no
 * mohalla is chosen at all, in which case every customer passes. The
 * customer's mohalla field is read first and the legacy area field is
 * the fallback, the same order the app reads them everywhere else.
 */
export function mohallaNameMatches(customer, mohalla) {
  const key = mohallaNameFilterKey(mohalla);
  if (!key) return true;
  if (!customer || typeof customer !== 'object') return false;
  const stored = customer.mohalla || customer.area;
  return mohallaNameFilterKey(stored) === key;
}

/**
 * True when the typed name fragment appears anywhere in the
 * customer's name, case-insensitively — or when nothing is typed, in
 * which case every customer passes.
 */
export function mohallaNameQueryMatches(customer, nameQuery) {
  const query = cleanText(nameQuery).toLocaleLowerCase();
  if (!query) return true;
  if (!customer || typeof customer !== 'object') return false;
  return cleanText(customer.name).toLocaleLowerCase().includes(query);
}

/**
 * True when the customer passes both halves of the combined filter:
 * the chosen mohalla, and the typed name within it.
 */
export function mohallaAndNameMatches(customer, mohalla, nameQuery) {
  return mohallaNameMatches(customer, mohalla) && mohallaNameQueryMatches(customer, nameQuery);
}

/**
 * Every live customer in the chosen mohalla whose name contains the
 * typed fragment, in name order (then id, so the order is stable when
 * names repeat). Archived customers never appear — the finder lists
 * live records only. A blank mohalla returns the full list; a blank
 * name returns the whole mohalla. The input list is never mutated and
 * no record is changed.
 */
export function findCustomersByMohallaAndName(customers, mohalla, nameQuery) {
  const list = Array.isArray(customers) ? customers : [];
  return list
    .filter((customer) => customer && typeof customer === 'object' && !customer.archived
      && mohallaAndNameMatches(customer, mohalla, nameQuery))
    .sort((a, b) => cleanText(a.name).toLocaleLowerCase().localeCompare(cleanText(b.name).toLocaleLowerCase())
      || String(a.id ?? '').localeCompare(String(b.id ?? '')));
}

/** Plain-words summary of a combined mohalla-plus-name search, for
 *  the finder to show when a search finds nobody — or how many it
 *  found. The mohalla is shown exactly as the operator chose it. */
export function mohallaNameFilterSummaryText(matches, mohalla, nameQuery) {
  const count = Array.isArray(matches) ? matches.length : 0;
  const place = cleanText(mohalla);
  const name = cleanText(nameQuery);
  const where = place && name
    ? `in ${place} matching "${name}"`
    : place ? `in ${place}` : name ? `matching "${name}"` : '';
  if (count === 0) return where ? `No customers ${where}.` : 'No customers found.';
  if (count === 1) return where ? `1 customer ${where}.` : '1 customer.';
  return where ? `${count} customers ${where}.` : `${count} customers.`;
}

/** Escapes HTML characters for safe template string interpolation. */
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/**
 * The mohalla filter options for the finder select, built from the
 * app's own mohalla list: "All mohallas" first, then one option per
 * list entry in list order. The selected value is matched by key, so
 * a variant spelling still selects its canonical entry. Every value
 * and label is escaped before it reaches the page.
 */
export function mohallaFilterOptionsHtml(mohallaList, selected) {
  const list = Array.isArray(mohallaList) ? mohallaList : [];
  const selectedKey = mohallaNameFilterKey(selected);
  const options = ['<option value="">All mohallas</option>'];
  for (const entry of list) {
    const value = String(entry ?? '').trim();
    if (!value) continue;
    const isSelected = selectedKey !== '' && mohallaNameFilterKey(value) === selectedKey;
    options.push(`<option value="${escapeHtml(value)}"${isSelected ? ' selected' : ''}>${escapeHtml(value)}</option>`);
  }
  return options.join('');
}
