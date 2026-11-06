/**
 * known-as-name.js — Plan 355: customer known-as / nickname, shown beside
 * the formal name.
 *
 * The record already carries the names the mohalla actually uses — a
 * father / reference name and a short nickname list, both editable on the
 * profile — but until now they only ever appeared buried in the profile's
 * contact group and in search matching, never beside the formal name.
 * This module only derives the one display string from those existing
 * fields: the father / reference name first (the "son of" name the
 * collector asks for at the door), else the first nickname. It adds no
 * field, no store, and no record: it renames nothing, changes no billing
 * name, and never touches a bill, a payment, or any other customer field.
 *
 * Pure and import-free: plain strings in, plain strings out. Callers do
 * the escaping and the label translation. A record with neither field
 * yields '' so the caller shows only the formal name.
 */

// i18n keys for the beside-name label — the app already owns both strings
// ("Father / reference" and "Also known as"), so no new key is needed.
export const KNOWN_AS_FATHER_LABEL_KEY = 'fas_field_father';
export const KNOWN_AS_ALIAS_LABEL_KEY = 'fas_field_aliases';

// Display caps mirror the save-time caps of the two source fields, so a
// legacy record that was never re-saved still renders within bounds.
export const KNOWN_AS_FATHER_MAX_LENGTH = 100;
export const KNOWN_AS_ALIAS_MAX_LENGTH = 40;

/**
 * First usable nickname from the record's nickname list. Accepts the
 * stored array form or the profile form's comma-separated string form;
 * trims each entry, drops empties, caps each at 40 characters.
 *
 * @param {Object} customer
 * @returns {string} '' when the record carries no nickname.
 */
function firstNickname(customer) {
  const raw = customer?.searchAliases;
  const list = Array.isArray(raw)
    ? raw
    : (typeof raw === 'string' ? raw.split(',') : []);
  for (const entry of list) {
    const cleaned = String(entry ?? '').trim().slice(0, KNOWN_AS_ALIAS_MAX_LENGTH);
    if (cleaned) return cleaned;
  }
  return '';
}

/**
 * The known-as name to show beside the formal name: the father /
 * reference name when the record has one, else the first nickname,
 * else ''.
 *
 * @param {Object} customer
 * @returns {string}
 */
export function knownAsNameFor(customer) {
  const father = String(customer?.fatherOrReferenceName ?? '')
    .trim()
    .slice(0, KNOWN_AS_FATHER_MAX_LENGTH);
  if (father) return father;
  return firstNickname(customer);
}

/**
 * The i18n key for the beside-name label matching knownAsNameFor:
 * the father label when the name came from the father / reference
 * field, the "also known as" label when it came from a nickname,
 * '' when there is no known-as name at all.
 *
 * @param {Object} customer
 * @returns {string}
 */
export function knownAsLabelKeyFor(customer) {
  if (String(customer?.fatherOrReferenceName ?? '').trim()) return KNOWN_AS_FATHER_LABEL_KEY;
  if (firstNickname(customer)) return KNOWN_AS_ALIAS_LABEL_KEY;
  return '';
}

/**
 * Whether the record carries any known-as name to show.
 *
 * @param {Object} customer
 * @returns {boolean}
 */
export function hasKnownAsName(customer) {
  return knownAsNameFor(customer) !== '';
}
