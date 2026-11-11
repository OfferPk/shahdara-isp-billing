/* Profile "Clear dues" (2026-11-10): one green button per profile that
 * pays the customer's FULL due in one Cash payment. "Due" is the
 * payableTotal from getCustomerPaymentDefaults — open bills PLUS
 * pending ticket charges, add-on (boost) charges and unpaid manual
 * baqaya — never just the profile's displayed outstanding (bills +
 * baqaya only). The confirm dialog therefore shows the total with a
 * breakdown, and the result line shows the honest remainder the
 * receipt reports: a bill priced between the check and the record can
 * leave a small remainder, and a non-finite remainder is reported as
 * unclear rather than guessed. Pure and import-free: no storage, no
 * DOM, no network, no other module. Inputs are never mutated. */

export function buildClearDuesConfirm(defaults, { formatAmount, title } = {}) {
  const money = typeof formatAmount === 'function'
    ? formatAmount
    : (value) => `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
  const totalDues = Number(defaults?.totalDues) || 0;
  const ticketChargesPending = Number(defaults?.ticketChargesPending) || 0;
  const addonChargesPending = Number(defaults?.addonChargesPending) || 0;
  const manualBaqayaPending = Number(defaults?.manualBaqayaPending) || 0;
  const payableTotal = Number(defaults?.payableTotal) || 0;
  const lines = [];
  if (totalDues > 0) lines.push(`Bills: ${money(totalDues)}`);
  if (ticketChargesPending > 0) lines.push(`Ticket charges: ${money(ticketChargesPending)}`);
  if (addonChargesPending > 0) lines.push(`Add-on charges: ${money(addonChargesPending)}`);
  if (manualBaqayaPending > 0) lines.push(`Additional (baqaya): ${money(manualBaqayaPending)}`);
  lines.push(`Total due: ${money(payableTotal)}`);
  const subjectParts = [];
  if (defaults?.customerNumber !== undefined && defaults?.customerNumber !== null && String(defaults.customerNumber).trim() !== '') subjectParts.push(`#${defaults.customerNumber}`);
  if (defaults?.name) subjectParts.push(String(defaults.name));
  return {
    title: title || 'Clear dues',
    subject: subjectParts.join(' '),
    // The themed confirm dialog renders its message as flowing text
    // (no preserved line breaks), so the breakdown joins with middots
    // instead of newlines — the figures stay scannable in one paragraph.
    message: `${lines.join(' · ')}. One Cash payment settles the full due, oldest months first.`,
    confirmLabel: `Pay ${money(payableTotal)}`
  };
}

/**
 * The honest remainder line for the result toast, from the receipt's
 * own payableRemaining (bills + ticket + add-on + baqaya still due
 * after the record). "Fully paid" only when the receipt says nothing
 * is left; a non-finite figure is never printed as a number.
 */
export function clearDuesRemainderLine(receipt, formatAmount) {
  const money = typeof formatAmount === 'function'
    ? formatAmount
    : (value) => `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
  const remaining = Number(receipt?.payableRemaining);
  if (!Number.isFinite(remaining)) return 'Remainder unclear — check the ledger.';
  if (remaining > 0) return `Still owes ${money(remaining)}.`;
  return 'Fully paid.';
}
