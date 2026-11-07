// Plan 441 — Quick Collect search by last four digits of phone:
// at a busy counter the customer remembers only the last four
// digits of their number, so four typed digits list every customer
// whose number ends with them, in name order, with name and
// mohalla. The search looks up only: it takes the customer list
// and the typed query from the caller and returns the matching
// records. It never changes any bill, payment, or customer record,
// adds no new field, and keeps no store. Anything other than
// exactly four digits is not a lookup at all — it returns no
// matches, so a shorter fragment or a full number can never drag
// in a list the operator did not ask for. Clearing the field
// clears the list.
export const LAST_FOUR_DIGITS_COUNT = 4;

export const LAST_FOUR_DIGITS_UNASSIGNED_TEXT = 'Unassigned';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Digits only — separators, spaces and "+" are stripped, and
 *  Arabic-Indic digits fold to ASCII, so the typed and stored
 *  forms compare as the same digits. */
export function lastFourDigitsOf(value) {
  const folded = String(value ?? '').normalize('NFKC').replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.codePointAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
  return folded.replace(/\D/g, '');
}

/**
 * The four digits of the typed query, or '' when the query does
 * not carry exactly four digits — a shorter fragment, a longer
 * number, or no digits at all is never a last-four search.
 */
export function lastFourDigitsQuery(query) {
  const digits = lastFourDigitsOf(query);
  return digits.length === LAST_FOUR_DIGITS_COUNT ? digits : '';
}

function normalizeName(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// The mohalla shown beside a name: the record's own mohalla first,
// the legacy area field second, and the app's established placeholder
// when neither is recorded — never a guessed mohalla.
export function lastFourDigitsMohalla(customer) {
  const mohalla = String(customer?.mohalla ?? '').trim();
  if (mohalla) return mohalla;
  const area = String(customer?.area ?? '').trim();
  if (area) return area;
  return LAST_FOUR_DIGITS_UNASSIGNED_TEXT;
}

function customerNumberOrZero(customer) {
  const number = Number(customer?.customerNumber);
  return Number.isFinite(number) ? number : 0;
}

/**
 * True when the typed query carries exactly four digits and the
 * customer's own number ends with them. Both of the number's field
 * names are checked; a missing number never matches, and a number
 * shorter than four digits can only match when it is exactly the
 * four typed digits.
 */
export function lastFourDigitsMatches(customer, query) {
  const digits = lastFourDigitsQuery(query);
  if (!digits) return false;
  if (!customer || typeof customer !== 'object') return false;
  for (const value of [customer.phone, customer.customerPhone]) {
    const stored = lastFourDigitsOf(value);
    if (stored && stored.endsWith(digits)) return true;
  }
  return false;
}

// Every customer whose number ends with the typed four digits, in
// name order (same name twice lists both, the lower customer number
// first). Archived customers never appear, and entries without a
// usable id or name are skipped, never guessed. The input list is
// never mutated: every returned entry is a fresh object.
export function findCustomersByLastFourDigits(customers, query) {
  const digits = lastFourDigitsQuery(query);
  if (!digits) return [];
  const matches = [];
  for (const customer of (Array.isArray(customers) ? customers : [])) {
    if (!customer || customer.archived) continue;
    const id = String(customer.id ?? '').trim();
    const name = String(customer.name ?? '').trim();
    if (!id || !name) continue;
    if (!lastFourDigitsMatches(customer, query)) continue;
    matches.push({
      id,
      name,
      mohalla: lastFourDigitsMohalla(customer),
      customerNumber: customerNumberOrZero(customer),
    });
  }
  matches.sort((a, b) => {
    const byName = normalizeName(a.name).localeCompare(normalizeName(b.name), 'en');
    if (byName !== 0) return byName;
    return a.customerNumber - b.customerNumber;
  });
  return matches;
}

// One plain-words line for a match: name, then mohalla.
export function lastFourDigitsLineText(match) {
  return `${String(match?.name ?? '').trim()} — ${String(match?.mohalla ?? '').trim() || LAST_FOUR_DIGITS_UNASSIGNED_TEXT}`;
}

// Plain-words summary of a last-four search, for the caller to
// show when a search finds nobody — or when the query is not four
// digits at all.
export function lastFourDigitsSummaryText(matches, query) {
  const digits = lastFourDigitsQuery(query);
  if (!digits) return 'Type the last 4 digits of the phone number.';
  const count = Array.isArray(matches) ? matches.length : 0;
  if (count === 0) return `No customer phone ends with ${digits}.`;
  if (count === 1) return `1 customer phone ends with ${digits}.`;
  return `${count} customer phones end with ${digits}.`;
}

// The live list markup: one row per match, each row carrying the
// customer id so the caller can pick it exactly the way a picker
// card is picked. Four typed digits with no match render the plain
// no-match line; anything other than four digits renders nothing
// at all.
export function lastFourDigitsHtml(matches, query) {
  const digits = lastFourDigitsQuery(query);
  if (!digits) return '';
  if (!Array.isArray(matches) || matches.length === 0) {
    return `\n      <p class="lfd-empty">${escapeHtml(lastFourDigitsSummaryText(matches, query))}</p>\n    `;
  }
  return matches.map((match) => {
    const label = lastFourDigitsLineText(match);
    return `\n      <button type="button"\n              class="qc-customer-card lfd-row"\n              data-customer-id="${escapeHtml(match.id)}"\n              aria-label="Pick ${escapeHtml(label)}">\n        <div class="qc-card-left">\n          <div class="qc-cust-info">\n            <span class="qc-cust-name">${escapeHtml(match.name)}</span>\n            <span class="qc-cust-meta">${escapeHtml(match.mohalla)}</span>\n          </div>\n        </div>\n      </button>\n    `;
  }).join('');
}
