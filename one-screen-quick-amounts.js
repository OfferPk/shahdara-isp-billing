// Plan 430 — quick amount buttons for the one-screen payment flow:
// one row of three buttons under the one screen's amount field —
// full dues, half dues, package price. Each button fills the amount
// field with the figure it names and nothing else: tapping never
// posts the payment, and the filled amount stays freely editable
// afterwards, exactly as if it had been typed. The row only fills;
// it never changes any bill, payment, or customer record by itself.
//
// The normal entry form already carries its own row of quick chips,
// including the same three figures. The one screen has no row at
// all, so this module is only the one screen's row — it does not
// rebuild the entry form's chips, and it never touches them.
//
// Figures come from the caller, never from storage, the page, the
// clock, or the network: the full dues are the amount default the
// one screen already fills the field with, and the package price is
// the customer's own package price when it is known. A button whose
// figure cannot be known shows plain words and fills nothing — it
// never guesses a figure. Half dues are half the full dues, rounded
// to whole rupees — the same shared rule the entry form's Full and
// 50% chips follow (Plan 521): all three surfaces fill from the
// Plan 429 full-dues default, and when half the dues work out to
// nothing every surface fills nothing instead of guessing a figure.
//
// Money is rupees throughout, PKR only, never converted. Inputs
// are never mutated.

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
 * The three quick amounts for the one screen, in rupees: the full
 * dues, half the full dues (rounded to whole rupees), and the
 * package price. Each is a positive finite figure or null when it
 * cannot be known — a zero, negative, blank, or non-numeric figure
 * is never an amount, and half of nothing is nothing.
 */
export function oneScreenQuickAmountFigures(input = {}) {
  const { fullDues, packagePrice } = input ?? {};
  const full = finitePositiveRupees(fullDues);
  const half = full === null ? null : finitePositiveRupees(Math.round(full / 2));
  const packageAmount = finitePositiveRupees(packagePrice);
  return { full, half, package: packageAmount };
}

/**
 * The buttons row for the one screen, in the order full dues, half
 * dues, package price. A button whose figure is known carries it in
 * data-qab-amount and shows it in its label; a button whose figure
 * cannot be known shows plain words and carries no amount, so
 * tapping it fills nothing. Buttons are type="button" — tapping one
 * never submits anything.
 */
export function oneScreenQuickAmountButtonsHtml(figures = {}) {
  const { full = null, half = null, package: packageAmount = null } = figures ?? {};
  const buttons = [
    { words: 'Full dues', amount: finitePositiveRupees(full) },
    { words: 'Half dues', amount: finitePositiveRupees(half) },
    { words: 'Package price', amount: finitePositiveRupees(packageAmount) },
  ];
  return buttons.map(({ words, amount }) => {
    const data = amount === null ? '' : ` data-qab-amount="${amount}"`;
    return `<button type="button" class="qab-amount-chip"${data}>${buttonLabel(words, amount)}</button>`;
  }).join('');
}
