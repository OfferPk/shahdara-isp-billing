// Plan 489 — full-dues and half-dues one-tap amount buttons for the
// Add payment screen: two buttons under the amount field on the
// Quick Collect form step — full dues, half dues. Each button fills
// the amount field with the figure it names and nothing else:
// tapping never posts the payment, and the filled amount stays
// freely editable afterwards, exactly as if it had been typed. The
// row only fills; it never changes any bill, payment, or customer
// record by itself.
//
// The one screen already carries its own row (Plan 430), and the
// form step's chip row already carries Full Balance and 50% — since
// Plan 521 those fill from the same Plan 429 full-dues default this
// module uses, half of it rounded to whole rupees, filling nothing
// when half works out to nothing; the entry chip row even reuses
// this module's figures function, so the rule is shared, not
// restated. This module is only the form step's pair: the full dues
// are the amount default the form already fills the field with
// (Plan 429 — every open bill plus unpaid manual baqaya, lifted to
// the full payable when ticket or boost charges are pending), and
// half dues are half of that, rounded to whole rupees.
//
// Figures come from the caller, never from storage, the page, the
// clock, or the network: the caller passes the amount default the
// form already computed. The buttons reuse the one screen's chip
// look (the same class), so no new style is introduced. Money is
// rupees throughout, PKR only, never converted. Inputs are never
// mutated.

// A usable rupee figure: a finite number greater than zero. A null,
// undefined, empty, or boolean figure is "not a number", never zero;
// a zero, negative, or non-numeric figure is not an amount either.
function finitePositiveRupees(value) {
  if (value === null || value === undefined || typeof value === 'boolean' || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function formatRupees(amount) {
  return amount.toLocaleString('en-PK');
}

function buttonLabel(words, amount) {
  return amount === null ? words : `${words} (Rs ${formatRupees(amount)})`;
}

/**
 * The two quick amounts for the Add payment form step, in rupees:
 * the full dues, and half the full dues (rounded to whole rupees).
 * Each is a positive finite figure or null when it cannot be known —
 * a zero, negative, blank, or non-numeric figure is never an amount,
 * and half of nothing is nothing.
 */
export function addPaymentDuesFigures(input = {}) {
  const { fullDues } = input ?? {};
  const full = finitePositiveRupees(fullDues);
  const half = full === null ? null : finitePositiveRupees(Math.round(full / 2));
  return { full, half };
}

/**
 * The two buttons for the Add payment form step, in the order full
 * dues, half dues. A button whose figure is known carries it in
 * data-apd-amount and shows it in its label; a button whose figure
 * cannot be known shows plain words and carries no amount, so
 * tapping it fills nothing. Buttons are type="button" — tapping one
 * never submits anything.
 */
export function addPaymentDuesButtonsHtml(figures = {}) {
  const { full = null, half = null } = figures ?? {};
  const buttons = [
    { words: 'Full dues', amount: finitePositiveRupees(full) },
    { words: 'Half dues', amount: finitePositiveRupees(half) },
  ];
  return buttons.map(({ words, amount }) => {
    const data = amount === null ? '' : ` data-apd-amount="${amount}"`;
    return `<button type="button" class="qab-amount-chip"${data}>${buttonLabel(words, amount)}</button>`;
  }).join('');
}
