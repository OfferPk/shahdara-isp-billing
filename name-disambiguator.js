/**
 * name-disambiguator.js — SISP-77: Same-Name / Homonym Customer
 * Disambiguation Guard.
 *
 * Two different subscribers can share one name (the classic case: two
 * "Ali Khan" records in different mohallas). Collecting from the wrong
 * one is a real money error, so every surface that lists a customer by
 * name — the Customers list / search results, the Field Mode cards and
 * the Quick Collect picker — appends a high-contrast badge to a
 * customer whose name is NOT unique among active customers:
 *
 *   ⚠️ Same Name • Barrian • #12 • Rs. 3,000
 *
 * (zone = canonicalMohalla label, #ID = customerNumber, rate = the
 * current monthly fee from the plan engine — applicablePriceForMonth
 * for the current month).
 *
 * The guard is strictly READ-ONLY: it never renames, merges or edits a
 * record. A customer whose normalized name is unique renders no badge
 * at all, so unique names stay visually untouched.
 *
 * Collision detection mirrors the house name normalization used by
 * customer search (customer-search-filter.js / phase3.js): NFKC,
 * whitespace collapsed, case folded — plus the Urdu-script fold of
 * field-mode.js's normalizeUrduText (Arabic Yeh/Kaf folded to their
 * Urdu forms, harakat/tatweel/zero-width marks stripped), so a name
 * stored in Urdu script collides with the same name typed or stored
 * with Arabic-keyboard variants. Both the Roman `name` and the saved
 * `nameUrdu` participate: a customer collides when EITHER normalized
 * form is shared with another ACTIVE (non-archived) customer.
 */
import { canonicalMohalla } from './phase3.js';
import { monthsForHistory } from './core.js';
import { applicablePriceForMonth } from './billing-cycle.js';
import { t } from './nav-language.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/**
 * The house name key: NFKC + Urdu-script fold + case fold + whitespace
 * collapse. Empty/blank names produce '' and never collide.
 */
export function normalizeCustomerNameKey(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u064A\u06CC]/g, '\u06CC')
    .replace(/[\u0643\u06A9]/g, '\u06A9')
    .replace(/[\u064B-\u0652\u0670\u0640\u200C\u200D]/g, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every normalized name form a customer answers to (Roman + Urdu). */
function nameKeysOf(customer) {
  if (!customer || typeof customer !== 'object') return [];
  return [...new Set([customer.name, customer.customerName, customer.nameUrdu].map(normalizeCustomerNameKey).filter(Boolean))];
}

/**
 * Index of same-name collisions over the ACTIVE (non-archived)
 * customers of a list. Returns a Map customerId -> { sharedWith } for
 * ONLY the customers whose name actually collides; unique names are
 * absent from the map. `sharedWith` counts the OTHER active customers
 * sharing at least one normalized name form with this one.
 */
export function buildSameNameIndex(customers) {
  const list = (Array.isArray(customers) ? customers : []).filter((customer) => customer && !customer.archived);
  const idsByKey = new Map();
  for (const customer of list) {
    for (const key of nameKeysOf(customer)) {
      if (!idsByKey.has(key)) idsByKey.set(key, new Set());
      idsByKey.get(key).add(customer.id);
    }
  }
  const index = new Map();
  for (const customer of list) {
    const others = new Set();
    for (const key of nameKeysOf(customer)) {
      for (const id of idsByKey.get(key) ?? []) {
        if (id !== customer.id) others.add(id);
      }
    }
    if (others.size > 0) index.set(customer.id, { sharedWith: others.size });
  }
  return index;
}

/**
 * The badge facts for one customer, or null when the customer renders
 * no badge (unique name, archived, or not found in the index). `index`
 * may be supplied by list renderers that badge many rows at once;
 * otherwise it is built from state.customers.
 */
export function sameNameInfo(state, customer, referenceDate = new Date(), index = null) {
  if (!customer || typeof customer !== 'object' || customer.archived) return null;
  const idx = index ?? buildSameNameIndex(state?.customers);
  if (!idx.has(customer.id)) return null;
  const canon = canonicalMohalla(customer.mohalla || customer.area || '');
  const zone = canon?.label || String(customer.area ?? '').trim();
  const currentMonth = monthsForHistory(referenceDate)[0];
  const rate = applicablePriceForMonth(customer, currentMonth);
  return {
    zone,
    customerNumber: customer.customerNumber ?? null,
    rate,
    sharedWith: idx.get(customer.id).sharedWith,
  };
}

/**
 * The badge markup: `<span class="same-name-badge">⚠️ Same Name •
 * Zone • #ID • Rs. Rate</span>`, or '' when the customer's name is
 * unique. Zone and rate segments drop out gracefully when unset (no
 * mohalla recorded / no fee priced yet) — the #ID segment always
 * renders, so the badge can never be ambiguous about who it marks.
 */
export function sameNameBadgeHtml(state, customer, referenceDate = new Date(), index = null) {
  const info = sameNameInfo(state, customer, referenceDate, index);
  if (!info) return '';
  const parts = [t('same_name_label')];
  if (info.zone) parts.push(info.zone);
  if (info.customerNumber !== null && info.customerNumber !== '') parts.push(`#${info.customerNumber}`);
  if (info.rate !== null) parts.push(`Rs. ${Number(info.rate).toLocaleString('en-PK')}`);
  return `<span class="same-name-badge">${parts.map(escapeHtml).join(' • ')}</span>`;
}
