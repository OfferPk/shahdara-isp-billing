// Transaction category tag (Plan 398): transactions of different
// kinds — collection, advance, refund, adjustment — sit in one
// undifferentiated list, so the operator cannot filter to just the
// kind they are looking for. One category tag on each transaction,
// in plain words, set at entry and used only for filtering. It tags
// only: it never changes any amount, type, bill, payment total,
// method reconciliation, or customer record by itself. A
// transaction without a tag reads as 'other' — in the filter, in
// the counts, and in the reader — so the counts over the full list
// always sum to the full list total.
//
// The tag rides the payment record itself (the same field the
// payment validator keeps), so it needs no store of its own: the
// record is the tag. Only the four meaningful tags are stored; a
// payment without one stores nothing extra. The tag is a filter
// label, not a type: it is independent of the advance marker the
// allocation engine reads, and of the overpayment choice (Plan
// 386), which says advance-or-credit for the extra over the dues.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Inputs are never mutated.

export const TRANSACTION_CATEGORY_TAGS = Object.freeze(['collection', 'advance', 'refund', 'adjustment', 'other']);

export const TRANSACTION_CATEGORY_TAG_LABELS = Object.freeze({
  collection: 'Collection',
  advance: 'Advance',
  refund: 'Refund',
  adjustment: 'Adjustment',
  other: 'Other',
});

function foldCategoryTag(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** True only for the five words a category tag can ever be. */
export function isTransactionCategoryTag(value) {
  return TRANSACTION_CATEGORY_TAGS.includes(foldCategoryTag(value));
}

/**
 * Normalize one category tag to a storable value. Only the four
 * meaningful tags are stored — 'collection', 'advance', 'refund',
 * 'adjustment'. 'other', a missing tag, and anything unknown store
 * nothing (null): a payment without a stored tag reads as 'other'
 * anyway, so storing the word would add nothing.
 */
export function normalizeTransactionCategoryTag(value) {
  const folded = foldCategoryTag(value);
  if (folded === 'collection' || folded === 'advance' || folded === 'refund' || folded === 'adjustment') return folded;
  return null;
}

/**
 * Defensive reader: the category tag a payment or transaction row
 * carries, or 'other' when it carries none. Only a well-formed
 * stored tag counts, so a damaged record reads as 'other' and is
 * never dropped from the list.
 */
export function transactionCategoryTagOf(payment) {
  const folded = foldCategoryTag(payment?.categoryTag);
  if (TRANSACTION_CATEGORY_TAGS.includes(folded)) return folded;
  return 'other';
}

/** The tag in plain words: 'Collection', 'Advance', 'Refund', 'Adjustment', or 'Other'. */
export function transactionCategoryTagLabel(value) {
  return TRANSACTION_CATEGORY_TAG_LABELS[transactionCategoryTagOf({ categoryTag: value })];
}

/**
 * Filter transaction rows by tag. 'all' (or a missing filter) keeps
 * every row; any other tag keeps exactly the rows that read as that
 * tag — a transaction without a stored tag reads as 'other', so it
 * appears under the 'other' filter. An unknown tag matches nothing.
 */
export function filterTransactionsByCategoryTag(rows, tag) {
  const list = Array.isArray(rows) ? rows : [];
  const folded = foldCategoryTag(tag);
  if (!folded || folded === 'all') return list;
  if (!TRANSACTION_CATEGORY_TAGS.includes(folded)) return [];
  return list.filter((row) => transactionCategoryTagOf(row) === folded);
}

/**
 * Counts per tag over a list of rows, plus the total. Every key is
 * always present (0 when absent), and the five tag counts always
 * sum to the total — a transaction without a stored tag counts
 * under 'other', so no row is ever left out.
 */
export function transactionCategoryTagCounts(rows) {
  const counts = { collection: 0, advance: 0, refund: 0, adjustment: 0, other: 0, total: 0 };
  for (const row of Array.isArray(rows) ? rows : []) {
    counts[transactionCategoryTagOf(row)] += 1;
    counts.total += 1;
  }
  return counts;
}

/**
 * The entry-form options: one <option> per tag, with the given tag
 * selected (collection when nothing is given — the ordinary
 * payment). Values and labels come only from this module's own
 * tables, so no caller text ever reaches the markup.
 */
export function transactionCategoryTagSelectOptions(selected) {
  const chosen = normalizeTransactionCategoryTag(selected) || 'collection';
  return TRANSACTION_CATEGORY_TAGS.map((tag) =>
    `<option value="${tag}"${tag === chosen ? ' selected' : ''}>${TRANSACTION_CATEGORY_TAG_LABELS[tag]}</option>`).join('');
}

/**
 * The tag in plain words for a payment that carries one, or '' when
 * the payment carries no stored tag — so a transaction without one
 * shows nothing extra on its row. It still reads as 'other' in the
 * filter and the counts.
 */
export function categoryTagLineText(payment) {
  const stored = normalizeTransactionCategoryTag(payment?.categoryTag);
  return stored ? TRANSACTION_CATEGORY_TAG_LABELS[stored] : '';
}

/**
 * The tag as it appears beside a transaction: a ' · …' suffix for
 * the payment-meta line, or '' when the payment carries no stored
 * tag. The label comes only from this module's own table, so no
 * caller text ever reaches the markup.
 */
export function categoryTagMarkup(payment) {
  const text = categoryTagLineText(payment);
  return text ? ` · ${text}` : '';
}
