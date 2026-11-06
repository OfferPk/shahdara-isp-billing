/**
 * Plan 352 — Find customer by partial phone number.
 *
 * A customer calls or visits and gives only part of a phone number, so
 * the profile finder must find them from those digits alone — last
 * digits, middle digits, or the full number, whatever the caller
 * remembers. This module is the digit-normalized phone search behind
 * that finder: it compares digits only, so dashes, spaces, parentheses
 * and a leading plus in the stored number (or in the typed query) never
 * hide a match, and a number stored with the country code still matches
 * a query typed with the leading zero, and the other way round.
 *
 * The search is read-only and stores nothing: it takes the customer
 * list and the typed query from the caller and returns the matching
 * records in name order. It never changes any number and never changes
 * any customer record. A query with fewer than three digits is not a
 * phone search at all — it returns no phone matches, so a one- or
 * two-digit fragment can never drag in half the list.
 *
 * The field-scoped list search and the global search already match
 * phone digits in their own places; this module is the missing piece
 * for the fast customer search sheet, whose phone branch compared the
 * raw stored string and so missed a match whenever the stored and
 * typed formatting differed. The landlord or guarantor phone is
 * deliberately not matched here — it belongs to a different person and
 * the other searches already cover it.
 */

/** Digits only — separators, spaces and "+" are stripped, and
 *  Arabic-Indic digits fold to ASCII, so "٠٣٤١" and "0341" compare
 *  as the same digits. */
export function partialPhoneDigits(value) {
  const folded = String(value ?? '').normalize('NFKC').replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.codePointAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
  return folded.replace(/\D/g, '');
}

/**
 * The 10 national digits of a Pakistani mobile, or '' when the value
 * is not a Pakistani mobile form. "03012345678", "+92 301 2345678",
 * "00923012345678" and "3012345678" all collapse to "3012345678", so
 * the stored and typed forms meet even when one side carries the
 * country code and the other carries the leading zero.
 */
export function partialPhoneNationalDigits(value) {
  const digits = partialPhoneDigits(value);
  if (!digits) return '';
  let national = '';
  if (digits.startsWith('0092') && digits.length === 14) national = digits.slice(4);
  else if (digits.startsWith('92') && digits.length === 12) national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('03')) national = digits.slice(1);
  else if (digits.length === 10 && digits.startsWith('3')) national = digits;
  return national.length === 10 && national.startsWith('3') ? national : '';
}

/**
 * The digits of the typed query, or '' when the query carries fewer
 * than three digits — a shorter fragment is never a phone search.
 */
export function partialPhoneQueryDigits(query) {
  const digits = partialPhoneDigits(query);
  return digits.length >= 3 ? digits : '';
}

const normalizedName = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();

/**
 * True when the typed query (three or more digits) appears anywhere
 * in the customer's stored phone number — last digits, middle digits,
 * or the full number. Both the raw digit strings and the national
 * forms are compared, so formatting and the 0-versus-92 prefix never
 * hide a match. The customer's own number is checked under both of
 * its field names; a missing number never matches.
 */
export function partialPhoneMatches(customer, query) {
  const digits = partialPhoneQueryDigits(query);
  if (!digits) return false;
  if (!customer || typeof customer !== 'object') return false;
  const nationalQuery = partialPhoneNationalDigits(query);
  for (const value of [customer.phone, customer.customerPhone]) {
    const stored = partialPhoneDigits(value);
    if (stored && stored.includes(digits)) return true;
    const nationalStored = partialPhoneNationalDigits(value);
    if (nationalQuery && nationalStored && nationalStored.includes(nationalQuery)) return true;
  }
  return false;
}

/**
 * Every customer whose stored number contains the typed digits, in
 * name order (then id, so the order is stable when names repeat).
 * Archived customers never appear — the finder lists live records
 * only. A query with fewer than three digits returns an empty list.
 * The input list is never mutated and no record is changed.
 */
export function findCustomersByPartialPhone(customers, query) {
  const digits = partialPhoneQueryDigits(query);
  if (!digits) return [];
  const list = Array.isArray(customers) ? customers : [];
  return list
    .filter((customer) => customer && typeof customer === 'object' && !customer.archived && partialPhoneMatches(customer, query))
    .sort((a, b) => normalizedName(a.name).localeCompare(normalizedName(b.name))
      || String(a.id ?? '').localeCompare(String(b.id ?? '')));
}

/** Plain-words summary of a partial phone search, for the finder to
 *  show when a search finds nobody — or when the query is too short
 *  to be a phone search at all. */
export function partialPhoneSearchSummaryText(matches, query) {
  const digits = partialPhoneQueryDigits(query);
  if (!digits) return 'Type at least 3 digits to search by phone.';
  const count = Array.isArray(matches) ? matches.length : 0;
  if (count === 0) return `No customer found for phone digits ${digits} — no phone number contains those digits.`;
  if (count === 1) return `1 customer found for phone digits ${digits}.`;
  return `${count} customers found for phone digits ${digits}.`;
}
