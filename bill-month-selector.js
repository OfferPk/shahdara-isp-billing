// Transaction bill-month selector (Plan 394): on the transaction
// entry form, the operator picks which month's bill this payment is
// for — "this is for last month" — together with the customer, and
// the payment is recorded on that month's bill. The choice is
// recorded only: picking a month settles nothing, changes no bill,
// no payment total, and no customer record by itself; the save is
// what records the payment, on the chosen bill, exactly as the
// entry form already records a payment on its own month when no
// choice is made. A payment with no choice goes on the form's own
// month, so the allocation rules apply exactly as before.
//
// The choice is a strict YYYY-MM month. Anything that is not a
// strict month — a blank, a typo, a month outside 01-12 — reads as
// no choice and falls back to the form's own month, so a damaged
// value can never invent a bill month. The module never reads
// storage, the clock, the network, or the page. Inputs are never
// mutated. Money is never touched here at all.

const STRICT_BILL_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function escapeBillMonthHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/** A strict YYYY-MM month, or '' when the value is not one. */
function strictBillMonth(value) {
  return typeof value === 'string' && STRICT_BILL_MONTH.test(value) ? value : '';
}

/**
 * Whether the value is a strict YYYY-MM month (year, dash, month
 * 01-12). A month of 00 or 13, a missing dash, or a non-string is
 * never a bill month.
 */
export function isStrictBillMonth(value) {
  return strictBillMonth(value) !== '';
}

/**
 * The chosen bill month, or the form's own month when the choice is
 * not a strict month, or '' when neither is one. A blank, a typo, or
 * a damaged value never invents a month: the fallback is the form's
 * own month, and without a usable fallback there is no choice at all.
 */
export function normalizeBillMonthChoice(value, fallbackMonth) {
  return strictBillMonth(value) || strictBillMonth(fallbackMonth);
}

/**
 * Read the bill-month choice from a form submission — a FormData-like
 * with a .get, or a plain object carrying billMonth — and normalize
 * it against the form's own month. A source with no readable choice
 * reads as the fallback, never as a guessed month.
 */
export function billMonthChoiceOf(source, fallbackMonth) {
  const raw = source && typeof source.get === 'function'
    ? source.get('billMonth')
    : source?.billMonth;
  return normalizeBillMonthChoice(raw, fallbackMonth);
}

/** A strict YYYY-MM month as "November 2026", or '' when unusable. */
export function billMonthLabel(month) {
  const match = STRICT_BILL_MONTH.exec(String(month || ''));
  if (!match) return '';
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

/**
 * The <option> list for a bill-month selector: one option per month
 * in the caller's list, labelled "November 2026" and valued YYYY-MM.
 * Non-strict entries are dropped and duplicates keep only their
 * first spelling, so a damaged list can never offer a month that is
 * not a real one. The selected month is marked selected; when it is
 * a strict month missing from the list it is offered first, selected,
 * so the form's own month is always available and always the
 * default. Returns '' for an empty or unusable list.
 */
export function billMonthSelectOptions(months, selectedMonth) {
  const seen = new Set();
  const list = [];
  for (const entry of (Array.isArray(months) ? months : [])) {
    const month = strictBillMonth(entry);
    if (month && !seen.has(month)) {
      seen.add(month);
      list.push(month);
    }
  }
  const selected = strictBillMonth(selectedMonth);
  if (selected && !seen.has(selected)) {
    list.unshift(selected);
    seen.add(selected);
  }
  return list.map((month) => `<option value="${escapeBillMonthHtml(month)}"${month === selected ? ' selected' : ''}>${escapeBillMonthHtml(billMonthLabel(month))}</option>`).join('');
}

/**
 * The live line for the entry form when the operator picks a month
 * other than the form's own: "This payment will be recorded for
 * November 2026." Empty when the month is not strict, so the line
 * only ever names a real month.
 */
export function billMonthChoiceLineText(month) {
  const label = billMonthLabel(month);
  return label ? `This payment will be recorded for ${label}.` : '';
}
