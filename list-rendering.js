// Plan F — Runtime performance: list rendering helpers.
//
// Pure, no DOM, no storage, no imports. One customer index per
// render instead of one roster scan per visible transaction row.
//
// See docs/performance.md for the full contract, including what
// is deliberately NOT page-sized (counts, totals, full-day
// headers), what is left for Plan Y (archived panel paging), and
// why no lazy import ships in this plan (the first-load budget
// leaves no dist slot for a new lazy chunk).

/**
 * Build a customer index once per render. Keys are customer ids,
 * values are the customer records. The first record for an id
 * wins, exactly as `state.customers.find(c => c.id === id)` would
 * return it.
 */
export function indexCustomers(customers = []) {
  const index = new Map();
  for (const customer of customers) {
    if (!customer || customer.id === undefined || customer.id === null) continue;
    if (!index.has(customer.id)) index.set(customer.id, customer);
  }
  return index;
}

/**
 * Resolve one visible transaction row to its customer, bill and
 * payment using an index built by indexCustomers(). Returns
 * nulls for anything missing, mirroring the old `?.` chains in
 * renderTransactions(): a missing customer, bill or payment
 * never throws here, it just renders without receipt data.
 *
 * `customerIndex` may be any Map-like with a `.get(id)` method,
 * so tests can count lookups with a recording map and prove
 * that a page of N rows performs exactly N lookups, regardless
 * of roster size.
 */
export function resolveTransactionCustomer(transaction, customerIndex) {
  const customer = customerIndex?.get(transaction?.customerId) ?? null;
  const bill = customer?.bills?.find(row => row.month === transaction?.month) ?? null;
  const payment = bill?.payments?.find(row => row.id === transaction?.paymentId) ?? null;
  return { customer, bill, payment };
}

/**
 * Resolve a whole visible page with one lookup per row. Returns
 * an array parallel to `visibleTransactions`, each entry the
 * result of resolveTransactionCustomer() for that row.
 */
export function resolveVisibleTransactions(visibleTransactions = [], customerIndex) {
  return visibleTransactions.map(tx => resolveTransactionCustomer(tx, customerIndex));
}
