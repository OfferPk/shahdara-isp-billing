// Plan 446 — Quick Collect mohalla filter for the customer list:
// the picker covers every mohalla at once, so on a day spent in
// one mohalla the operator scrolls past everyone else. One filter
// on that list: choose a mohalla, see exactly its customers with
// dues, in name order; clear it and the full list returns.
//
// What already exists, and what this plan does NOT rebuild: the
// canonical mohalla list already exists (the app's own list, the
// single source of truth — the caller passes it in, so it is never
// copied here), and the picker already lists customers with dues.
// This module adds only the missing piece: matching a picker entry
// to a chosen mohalla and narrowing the list to it. It filters
// only and it changes nothing: it never changes any bill, payment,
// or customer record, adds no new field, and holds no store of its
// own. Pure: the caller supplies the entries, the chosen mohalla
// and the list, and the module never reads storage, the clock, or
// the network, and never mutates an input.
//
// Matching is by cleaned key, so spelling variants fold together:
// "Bani", "BANII" and "MOHALLA BANI" are the same mohalla, and an
// entry whose record carries only the legacy area field is still
// found through that field. The three old-spelling foldings mirror
// the canonical list's own table, so a customer stored under an old
// spelling is still found. A blank mohalla means the full list —
// clearing the filter returns to every customer. An entry with no
// recorded mohalla or area never matches a chosen mohalla: it is
// left out of the filtered list, never guessed into one.

// Collapse whitespace and trim, so "  Bani  " and "Bani" compare
// equal. Lowercased throughout: this is the comparison key, not
// display text.
function cleanKey(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
}

const MOHALLA_KEY_ALIASES = Object.freeze({ bani: 'banii', kishti: 'kishtii', chamyaa: 'chamyaaa' });

/**
 * Comparison key for a mohalla value: cleaned, lowercased, with
 * the leading generic "Mohalla" word stripped, since it is not
 * part of a mohalla's identity. Blank values give an empty key.
 */
export function quickCollectMohallaFilterKey(value) {
  const text = cleanKey(value);
  if (!text) return '';
  const stripped = text.replace(/^(?:mohalla|mohalaa)\s+/u, '');
  const key = stripped || text;
  return MOHALLA_KEY_ALIASES[key] ?? key;
}

/**
 * The canonical list entry for a chosen mohalla value, or null
 * when the value is blank or matches no entry in the list. The
 * returned spelling is the list's own spelling, so the filter
 * always shows the standard form.
 */
export function resolveQuickCollectMohallaFilter(value, mohallaList) {
  const key = quickCollectMohallaFilterKey(value);
  if (!key) return null;
  const list = Array.isArray(mohallaList) ? mohallaList : [];
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    if (quickCollectMohallaFilterKey(entry) === key) return entry;
  }
  return null;
}

// The mohalla an entry belongs to: the record's own mohalla first,
// the legacy area field second. The picker's own entries carry
// both; the lookup rows carry mohalla already resolved. An empty
// mohalla falls back to area — a blank field is no mohalla at all.
function entryMohalla(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const mohalla = String(entry.mohalla ?? '').trim();
  if (mohalla) return mohalla;
  return String(entry.area ?? '').trim();
}

/**
 * True when the entry belongs to the chosen mohalla — or when no
 * mohalla is chosen at all, in which case every entry passes.
 */
export function quickCollectMohallaFilterMatches(entry, mohalla) {
  const key = quickCollectMohallaFilterKey(mohalla);
  if (!key) return true;
  if (!entry || typeof entry !== 'object') return false;
  return quickCollectMohallaFilterKey(entryMohalla(entry)) === key;
}

function customerNumberOrZero(entry) {
  const number = Number(entry?.customerNumber);
  return Number.isFinite(number) ? number : 0;
}

function entryName(entry) {
  return cleanKey(entry?.name);
}

/**
 * Every entry in the chosen mohalla, in name order (same name
 * twice lists both, the lower customer number first). The picker
 * itself lists by dues first, so the filtered list is re-sorted
 * here: a mohalla round is worked name by name. Archived entries
 * never appear, and entries without a usable id or name are
 * skipped, never guessed. A blank mohalla returns the full list in
 * its own order — the picker's dues-first order is left alone.
 * The input list is never mutated and every returned entry is a
 * fresh object, so the caller's list — and each entry's dues
 * figure — rides through unchanged.
 */
export function filterQuickCollectByMohalla(entries, mohalla) {
  const key = quickCollectMohallaFilterKey(mohalla);
  const matches = [];
  for (const entry of (Array.isArray(entries) ? entries : [])) {
    if (!entry || typeof entry !== 'object' || entry.archived) continue;
    const id = String(entry.id ?? '').trim();
    const name = String(entry.name ?? '').trim();
    if (!id || !name) continue;
    if (key && !quickCollectMohallaFilterMatches(entry, mohalla)) continue;
    matches.push({ ...entry });
  }
  if (!key) return matches;
  matches.sort((a, b) => {
    const byName = entryName(a).localeCompare(entryName(b), 'en');
    if (byName !== 0) return byName;
    return customerNumberOrZero(a) - customerNumberOrZero(b);
  });
  return matches;
}

/** Plain-words summary of a filtered list, for the picker to show
 *  under the filter: how many customers, and in which mohalla. The
 *  mohalla is shown exactly as the operator chose it. */
export function quickCollectMohallaFilterSummaryText(matches, mohalla) {
  const count = Array.isArray(matches) ? matches.length : 0;
  const place = String(mohalla ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const where = place ? ` in ${place}` : '';
  if (count === 0) return `No customers${where}.`;
  if (count === 1) return `1 customer${where}.`;
  return `${count} customers${where}.`;
}

/** Escapes HTML characters for safe template string interpolation. */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/**
 * The mohalla filter options for the picker select, built from the
 * app's own mohalla list: "All mohallas" first, then one option
 * per list entry in list order. The selected value is matched by
 * key, so a variant spelling still selects its canonical entry.
 * Every value and label is escaped before it reaches the page.
 */
export function quickCollectMohallaFilterOptionsHtml(mohallaList, selected) {
  const list = Array.isArray(mohallaList) ? mohallaList : [];
  const selectedKey = quickCollectMohallaFilterKey(selected);
  const options = ['<option value="">All mohallas</option>'];
  for (const entry of list) {
    const value = String(entry ?? '').trim();
    if (!value) continue;
    const isSelected = selectedKey !== '' && quickCollectMohallaFilterKey(value) === selectedKey;
    options.push(`<option value="${escapeHtml(value)}"${isSelected ? ' selected' : ''}>${escapeHtml(value)}</option>`);
  }
  return options.join('');
}
