// Plan 431 — Quick Collect payment method remembered per customer.
//
// The regular who always pays by JazzCash should not have to choose the
// method again every month: the Quick Collect screen pre-selects the
// method of the customer's last payment. The module only remembers —
// it pre-selects nothing on its own and never writes anything.
//
// Rules, stated plainly:
//   - The remembered method is the method of the customer's latest
//     payment (latest date first; same-day ties break by payment id —
//     the same ordering the payment sheet already uses for its last
//     payment). A payment on any of the customer's bills counts.
//   - The method must be one of the methods the caller passes in; a
//     last payment whose method is missing, blank, or not in that
//     list remembers nothing.
//   - A customer with no past payment remembers nothing: null, and
//     the screen pre-selects nothing. The operator picks.
//   - No store: the method is derived from the payment records the
//     app already keeps. Nothing here reads storage, the clock, or
//     the network, and no input is mutated.
//   - This is not a preferred channel: what it reads is the last
//     payment, never the channel setting, and nothing here writes a
//     channel, a bill, a payment, or a customer record.

/**
 * The remembered method from a list of payment records, or null.
 *
 * @param {Array} payments - payment records ({ date, id, method })
 * @param {Array<string>} methods - the methods the screen offers
 * @returns {string|null} the last payment's method, or null
 */
export function rememberedPaymentMethodOfPayments(payments, methods) {
  const list = Array.isArray(payments) ? payments : [];
  const known = Array.isArray(methods) ? methods : [];
  if (list.length === 0 || known.length === 0) return null;
  const sorted = [...list].sort((a, b) => {
    const dateA = String(a?.date ?? '');
    const dateB = String(b?.date ?? '');
    return dateA.localeCompare(dateB) || String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  });
  const last = sorted[sorted.length - 1];
  const method = String(last?.method ?? '').trim();
  return method !== '' && known.includes(method) ? method : null;
}

/**
 * The remembered method for one customer, or null.
 *
 * @param {Object} customer - the customer record ({ bills: [{ payments }] })
 * @param {Array<string>} methods - the methods the screen offers
 * @returns {string|null} the method of the customer's last payment, or null
 */
export function rememberedPaymentMethod(customer, methods) {
  if (!customer || typeof customer !== 'object') return null;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const payments = bills.flatMap((bill) => bill?.payments ?? []);
  return rememberedPaymentMethodOfPayments(payments, methods);
}
