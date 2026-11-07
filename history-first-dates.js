// Plan 413 — History first payment and first bill dates.
// The history never says when a customer's money story began —
// their first bill and their first payment — so the start of the
// relationship is a guess. This module supplies the missing piece:
// one first-dates line on the customer history (date of first bill,
// date of first payment, in plain words), drawn from existing
// records. It displays only and it changes nothing: it reads the
// entries the full history list already composes and writes to no
// store, so no bill, payment, or customer record is ever changed by
// the line itself. A bill is a charge entry; a payment is a payment
// or an advance that was not voided, because money that was voided
// was never paid, and a charge, a credit, a refund, or an adjustment
// is not a payment. A month-only date counts as the first of that
// month for ordering, the same rule the list uses, but it is shown
// exactly as recorded — a day is never guessed. A customer with no
// payment yet says so plainly, in the acceptance's own words.

export const HISTORY_FIRST_DATES_NO_BILL_TEXT = 'No bill yet';

export const HISTORY_FIRST_DATES_NO_PAYMENT_TEXT = 'no payment yet';

export const HISTORY_FIRST_DATES_DATE_NOT_RECORDED_TEXT = 'date not recorded';

// A bill that stands: a charge with a positive amount. Anything
// else is not a bill, so it can never be the first bill.
export function historyFirstDatesIsCharge(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.type !== 'charge') return false;
  if (typeof entry.amountCents !== 'number') return false;
  return Number.isFinite(entry.amountCents) && entry.amountCents > 0;
}

// A payment that stands: a payment or an advance that was not
// voided, with a positive amount. Anything else is not a payment
// that was made, so it can never be the first payment.
export function historyFirstDatesIsPayment(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.type !== 'payment' && entry.type !== 'advance') return false;
  if (entry.voided === true) return false;
  if (typeof entry.amountCents !== 'number') return false;
  return Number.isFinite(entry.amountCents) && entry.amountCents > 0;
}

function firstDatesSortKey(value) {
  if (typeof value !== 'string' || value === '') return '9999-99-99';
  if (value.length === 7) return `${value}-01`;
  return value;
}

function cleanFirstDatesText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// The first bill date and the first payment date in the entries.
// The dates are the recorded values, never a guessed day. An entry
// with no date never wins the earliest spot, because its date is
// unknown; it only proves that a bill or a payment exists. The
// entries are never mutated.
export function historyFirstDates(entries) {
  const result = {
    firstBillDate: '',
    firstPaymentDate: '',
    hasBill: false,
    hasPayment: false,
  };
  if (!Array.isArray(entries)) return result;
  for (const entry of entries) {
    if (historyFirstDatesIsCharge(entry)) {
      result.hasBill = true;
      const date = cleanFirstDatesText(entry.date);
      if (date !== '' && (result.firstBillDate === '' || firstDatesSortKey(date) < firstDatesSortKey(result.firstBillDate))) {
        result.firstBillDate = date;
      }
    }
    if (historyFirstDatesIsPayment(entry)) {
      result.hasPayment = true;
      const date = cleanFirstDatesText(entry.date);
      if (date !== '' && (result.firstPaymentDate === '' || firstDatesSortKey(date) < firstDatesSortKey(result.firstPaymentDate))) {
        result.firstPaymentDate = date;
      }
    }
  }
  return result;
}

// One plain-words line for the first dates: the date of the first
// bill and the date of the first payment. A customer with no bill
// yet or no payment yet says so plainly; a bill or a payment whose
// date was never recorded says so too, instead of a guessed date.
export function historyFirstDatesText(firstDates) {
  if (!firstDates || typeof firstDates !== 'object') return '';
  const billDate = firstDates.hasBill
    ? (cleanFirstDatesText(firstDates.firstBillDate) || HISTORY_FIRST_DATES_DATE_NOT_RECORDED_TEXT)
    : HISTORY_FIRST_DATES_NO_BILL_TEXT;
  const paymentDate = firstDates.hasPayment
    ? (cleanFirstDatesText(firstDates.firstPaymentDate) || HISTORY_FIRST_DATES_DATE_NOT_RECORDED_TEXT)
    : HISTORY_FIRST_DATES_NO_PAYMENT_TEXT;
  return `First bill: ${billDate} · First payment: ${paymentDate}`;
}

function escapeFirstDatesHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The first-dates line itself, for the top of the history. Empty
// when the history holds no entries at all, so an empty history
// keeps its own empty line instead of a second one. The dates are
// recorded values, so there is nothing user-entered to escape, but
// the line is escaped anyway before it reaches the page.
export function historyFirstDatesHtml(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  return `<p class="notice">${escapeFirstDatesHtml(historyFirstDatesText(historyFirstDates(entries)))}</p>`;
}
