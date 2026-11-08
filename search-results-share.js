/*
 * Plan 470 — Share search results as a plain-text list.
 *
 * After a good search — the overdue list for one mohalla, say — the
 * operator cannot take that list to the field, because the results
 * live only on the search screen and must be copied out by hand.
 * This module is the missing piece: one plain-text list from the
 * search result the sheet already computed, in the same order —
 * name, mohalla, phone, dues in PKR, status per customer — prepared
 * as a draft the operator reads first and sends onward with one
 * tap. It drafts only and sends nothing automatically.
 *
 * What this module NEVER does, stated plainly:
 *   - it never sends anything: Send is the operator's tap, and the
 *     wiring routes it through a recipient-less share link, so the
 *     operator picks who gets the list;
 *   - it never changes a customer, bill, or payment record, and it
 *     never invents a figure: a row with no usable dues figure
 *     reads as dues not recorded, never a guessed zero, and a row
 *     with no usable status reads as status not recorded;
 *   - it never reorders, filters, or drops a result: the list
 *     contains exactly the rows it was given, in the same order —
 *     the dues figure is the sheet's own figure on each row, and a
 *     manual baqaya is a separate record the sheet does not
 *     display, so it is never part of it;
 *   - it never reads storage, the clock, or the page, takes no
 *     other module, and never mutates an input.
 */

export const SEARCH_RESULTS_SHARE_EMPTY_TEXT = 'No customers to share.';
export const SEARCH_RESULTS_SHARE_DRAFT_HEADING_TEXT = 'Customer list draft';
export const SEARCH_RESULTS_SHARE_SEND_TEXT = 'Send on WhatsApp';
export const SEARCH_RESULTS_SHARE_DISMISS_TEXT = 'Dismiss';
export const SEARCH_RESULTS_SHARE_SENT_TEXT = 'List ready to send.';

// One line of text, whitespace collapsed so one customer always
// stays on one line: a name carrying a stray newline or double
// space can never split the list.
function cleanSearchResultsShareText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeSearchResultsShareHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

// A missing, boolean or blank figure is not a number, never zero:
// Number(null) is 0 and Number(true) is 1, and both would invent an
// amount out of nothing. The value is the row's dues in rupees; the
// result is in integer cents.
export function searchResultsShareDuesCents(row) {
  const value = row?.totalDues;
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const rupees = Number(value);
  if (!Number.isFinite(rupees)) return null;
  return Math.round(rupees * 100);
}

// Min-0 decimals, grouped like the other live lines: 250000 cents
// reads '2,500', 100050 cents reads '1,000.5'.
export function formatSearchResultsShareAmount(cents) {
  const value = cents === null || cents === undefined || typeof cents === 'boolean'
    || (typeof cents === 'string' && cents.trim() === '') ? null : Number(cents);
  const safe = value !== null && Number.isFinite(value) ? Math.round(value) : 0;
  return (safe / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// The status in plain words: the row's own account-status labels
// first (Overdue, Due, Paid up, then Suspended, then New), joined
// the way the row shows them; a row without labels falls back to
// its billing tag in plain words, exactly as the row renders it.
// A row with neither reads as status not recorded, never a guess.
function searchResultsShareStatusText(row) {
  const labels = (Array.isArray(row?.accountStatusLabels) ? row.accountStatusLabels : [])
    .map((label) => cleanSearchResultsShareText(label))
    .filter(Boolean);
  if (labels.length > 0) return labels.join(' · ');
  const billing = cleanSearchResultsShareText(row?.billingStatus).toLowerCase();
  if (billing === 'paid') return 'Paid';
  if (billing === 'partial') return 'Partial';
  if (billing === 'pending') return 'Pending';
  if (billing !== '') return 'Not set';
  return 'status not recorded';
}

// One customer, one line: name, mohalla, phone, dues in PKR,
// status. A row that is not an object is not a customer and
// renders nothing.
export function searchResultsShareLineText(row) {
  if (!row || typeof row !== 'object') return '';
  const name = cleanSearchResultsShareText(row.name) || 'Customer';
  const mohalla = cleanSearchResultsShareText(row.mohalla)
    || cleanSearchResultsShareText(row.area)
    || 'Unassigned';
  const phone = cleanSearchResultsShareText(row.phone) || 'no phone';
  const duesCents = searchResultsShareDuesCents(row);
  const dues = duesCents === null
    ? 'dues not recorded'
    : `PKR ${formatSearchResultsShareAmount(duesCents)}`;
  const status = searchResultsShareStatusText(row);
  return `${name} · ${mohalla} · ${phone} · ${dues} · ${status}`;
}

// The whole list: a heading with the count, then one numbered line
// per customer, in the order given. A search with no results shares
// nothing — an empty string, never a heading over an empty list.
export function searchResultsShareText(results) {
  const rows = (Array.isArray(results) ? results : [])
    .filter((row) => row && typeof row === 'object');
  if (rows.length === 0) return '';
  const heading = rows.length === 1
    ? 'Customer list (1 customer)'
    : `Customer list (${rows.length} customers)`;
  const lines = rows.map((row, index) => `${index + 1}. ${searchResultsShareLineText(row)}`);
  return [heading, ...lines].join('\n');
}

// The draft as shown: heading, the list text exactly as it will go
// out, and Send / Dismiss. The buttons only ask; the wiring sends
// or dismisses, and nothing here posts anything.
export function searchResultsShareDraftHtml(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') return '';
  return `<div class="srs-share-draft" role="region" aria-label="${escapeSearchResultsShareHtml(SEARCH_RESULTS_SHARE_DRAFT_HEADING_TEXT)}">`
    + `<p class="srs-share-draft-heading">${escapeSearchResultsShareHtml(SEARCH_RESULTS_SHARE_DRAFT_HEADING_TEXT)}</p>`
    + `<pre class="srs-share-draft-text">${escapeSearchResultsShareHtml(text)}</pre>`
    + '<div class="srs-share-draft-actions">'
    + `<button type="button" class="primary-button" data-srs-send>${escapeSearchResultsShareHtml(SEARCH_RESULTS_SHARE_SEND_TEXT)}</button>`
    + `<button type="button" class="secondary-button" data-srs-dismiss>${escapeSearchResultsShareHtml(SEARCH_RESULTS_SHARE_DISMISS_TEXT)}</button>`
    + '</div></div>';
}
