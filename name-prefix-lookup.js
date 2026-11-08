// Plan 427 — live name-prefix lookup for the Quick Collect screen:
// as the operator types, customers whose name starts with the typed
// letters appear at once, in name order, with name and mohalla. The
// lookup looks up only: it takes the customer list and the typed
// prefix from the caller and returns the matching records. It never
// changes any bill, payment, or customer record, adds no new field,
// and keeps no store. Fewer than two letters is not a lookup at all
// — it returns no matches, so a single letter can never drag in
// half the list. Clearing the field clears the list.
export const NAME_PREFIX_LOOKUP_MIN_LETTERS = 2;

export const NAME_PREFIX_LOOKUP_UNASSIGNED_TEXT = 'Unassigned';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeName(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// The mohalla shown beside a name: the record's own mohalla first,
// the legacy area field second, and the app's established placeholder
// when neither is recorded — never a guessed mohalla.
export function namePrefixLookupMohalla(customer) {
  const mohalla = String(customer?.mohalla ?? '').trim();
  if (mohalla) return mohalla;
  const area = String(customer?.area ?? '').trim();
  if (area) return area;
  return NAME_PREFIX_LOOKUP_UNASSIGNED_TEXT;
}

function customerNumberOrZero(customer) {
  const number = Number(customer?.customerNumber);
  return Number.isFinite(number) ? number : 0;
}

// Every customer whose name starts with the typed prefix, in name
// order (same name twice lists both, the lower customer number
// first). Archived customers never appear, and entries without a
// usable id or name are skipped, never guessed. The input list is
// never mutated: every returned entry is a fresh object.
export function namePrefixLookupMatches(customers, prefix) {
  const needle = normalizeName(prefix);
  if (needle.length < NAME_PREFIX_LOOKUP_MIN_LETTERS) return [];
  const matches = [];
  for (const customer of (Array.isArray(customers) ? customers : [])) {
    if (!customer || customer.archived) continue;
    const id = String(customer.id ?? '').trim();
    const name = String(customer.name ?? '').trim();
    if (!id || !name) continue;
    if (!normalizeName(name).startsWith(needle)) continue;
    matches.push({
      id,
      name,
      mohalla: namePrefixLookupMohalla(customer),
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
export function namePrefixLookupLineText(match) {
  return `${String(match?.name ?? '').trim()} — ${String(match?.mohalla ?? '').trim() || NAME_PREFIX_LOOKUP_UNASSIGNED_TEXT}`;
}

// Plan 488: the dues-and-status text for one row, when the caller
// supplies it (a Map or a plain object keyed by customer id). The
// caller computes it from the customer's own records; this module
// only renders it, escaped, beside the mohalla. Without it the row
// renders exactly as before.
function namePrefixLookupDuesText(match, duesTextById) {
  if (!duesTextById || typeof duesTextById !== 'object') return '';
  const id = String(match?.id ?? '').trim();
  if (!id) return '';
  const text = typeof duesTextById.get === 'function' ? duesTextById.get(id) : duesTextById[id];
  return typeof text === 'string' ? text : '';
}

// The live list markup: one row per match, each row carrying the
// customer id so the caller can pick it exactly the way a picker
// card is picked. No matches renders nothing at all. Plan 488: when
// the caller passes the dues-and-status text per customer id, each
// row shows it beside the mohalla, in the row's own meta styling;
// without it the row renders exactly as before.
export function namePrefixLookupHtml(matches, duesTextById) {
  if (!Array.isArray(matches) || matches.length === 0) return '';
  return matches.map((match) => {
    const duesText = namePrefixLookupDuesText(match, duesTextById);
    const label = duesText ? `${namePrefixLookupLineText(match)} · ${duesText}` : namePrefixLookupLineText(match);
    return `\n      <button type="button"\n              class="qc-customer-card npl-row"\n              data-customer-id="${escapeHtml(match.id)}"\n              aria-label="Pick ${escapeHtml(label)}">\n        <div class="qc-card-left">\n          <div class="qc-cust-info">\n            <span class="qc-cust-name">${escapeHtml(match.name)}</span>\n            <span class="qc-cust-meta">${escapeHtml(match.mohalla)}</span>${duesText ? `\n            <span class="qc-cust-meta">${escapeHtml(duesText)}</span>` : ''}\n          </div>\n        </div>\n      </button>\n    `;
  }).join('');
}
