// Transaction quick amount buttons (Plan 391): one row of buttons on
// the transaction entry form that fills the amount field with the
// figure the button names — full dues, the package price, Rs 500,
// Rs 1,000 — and nothing else. A button fills only: it never posts
// the payment, and it never changes any bill, payment, or customer
// record by itself. The operator can change the filled amount
// freely afterwards, exactly as if it had been typed.
//
// The row already carried buttons for the full balance, the current
// month, 50%, and the round figures 1,000 / 1,500 / 2,000. This
// module adds only what was missing: the package price and Rs 500.
// The full-dues and Rs 1,000 buttons already existed and are left
// exactly as they were.
//
// The package price follows the same rule the profile header strip
// already uses: the customer's own monthly selling amount when it
// is a usable figure, otherwise the catalogue price of the package
// the customer is on, matched by label or id. A customer with no
// usable selling amount and no catalogue match has no package price
// at all — the button then fills nothing, and never guesses a
// figure. The catalogue is passed in by the caller, so this module
// reads no catalogue, page, storage, clock, or network itself.
//
// Money is rupees throughout, PKR only, never converted. Inputs
// are never mutated.
function finitePositiveRupees(value) {
  if (value === null || value === undefined || typeof value === 'boolean' || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function normalizeKey(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

/**
 * The customer's package price in rupees, or null when it cannot be
 * known: the monthly selling amount when it is a finite positive
 * figure, otherwise the catalogue price of the package named by the
 * customer's package field (label or id, case- and space-insensitive).
 * A zero, negative, blank, or non-numeric selling amount never reads
 * as a price, and a package with no catalogue match has no price.
 */
export function packagePriceForCustomer(customer, catalogue) {
  if (!customer || typeof customer !== 'object') return null;
  const selling = finitePositiveRupees(customer.monthlySellingAmount);
  if (selling !== null) return selling;
  const wanted = normalizeKey(customer.packageSpeed);
  if (!wanted || !Array.isArray(catalogue)) return null;
  const plan = catalogue.find((entry) => entry
    && (normalizeKey(entry.label) === wanted || normalizeKey(entry.id) === wanted));
  return plan ? finitePositiveRupees(plan.price) : null;
}

/**
 * The amount a quick amount button fills, in rupees, or null when
 * the button names no usable figure. 'full' fills the full dues,
 * 'package' fills the package price, and a plain number names the
 * round figure itself ('500' fills 500). Anything else — a button
 * the caller handles another way, a zero or negative figure, a
 * missing figure — resolves to null, and the caller leaves the
 * amount field untouched.
 */
export function resolveQuickAmount(type, figures = {}) {
  if (type === 'full') return finitePositiveRupees(figures.fullDues);
  if (type === 'package') return finitePositiveRupees(figures.packagePrice);
  if (typeof type !== 'string' || type.trim() === '') return null;
  return finitePositiveRupees(Number(type));
}

/**
 * The label for the package-price button: the price in view when it
 * is known ("Package (Rs 2,000)"), plain words ("Package price")
 * when it is not, so the button never shows a figure it cannot fill.
 */
export function packageChipLabel(packagePrice) {
  const price = finitePositiveRupees(packagePrice);
  return price === null
    ? 'Package price'
    : `Package (Rs ${price.toLocaleString('en-PK')})`;
}
