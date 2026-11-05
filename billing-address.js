// Plan 229 (Plan 203-350) — Customer billing address note.
//
// The address where the bill should go — a shop, a relative's
// house, a different street — can differ from the service address,
// but only one address is kept, so bills are delivered to the wrong
// place. This module adds only the missing piece: one billing
// address record per customer, stating where bills go, from which
// date, and a note saying where it differs from the service address
// — so bills reach the person who pays, even when they do not live
// at the connected premises, and delivery failures fall.
//
// One billing-address record: the customer, the billing address,
// the effective date, and a note where it differs from the service
// address.
//
// The fences, stated plainly:
//   - This records where bills go only. It never moves the service
//     and never changes the service address: a move-house transfer
//     (Plan 85) is a different record that changes the service
//     itself, and it is neither read nor rewritten here. The bill
//     delivery log (Plan 205) records how a bill reached the
//     customer, not where it should go, and it is neither read nor
//     rewritten here either: the delivery address below is a pure
//     lookup the delivery code can call, not a change to the log.
//   - Recording a billing address never changes any bill, payment,
//     or service record by itself: the module takes no bill,
//     payment, or customer object in, edits none, and returns none.
//   - A billing address with no customer is refused outright, as is
//     a record with no id, no billing address, or a non-calendar
//     effective date. One record per customer: a second record for
//     the same customer is refused, never overwriting the first.
//     Duplicate ids are never rewritten. There is no edit function:
//     only record and remove.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validBillingAddressDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  const cell = String(value);
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function normalizeBillingAddress(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const billingAddress = text(raw.billingAddress);
  const dateEffective = text(raw.dateEffective);
  if (!id || !customer || !billingAddress) return null;
  if (!validBillingAddressDate(dateEffective)) return null;
  return {
    id,
    customer,
    billingAddress,
    dateEffective,
    note: text(raw.note),
  };
}

export function normalizeBillingAddressList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeBillingAddress(raw);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    if (seenCustomers.has(record.customer.toLowerCase())) continue;
    seenIds.add(record.id);
    seenCustomers.add(record.customer.toLowerCase());
    out.push(record);
  }
  return out;
}

export function recordBillingAddress(list, raw) {
  const clean = normalizeBillingAddressList(list);
  const record = normalizeBillingAddress(raw);
  if (!record) return null;
  if (clean.some((item) => item.id === record.id)) return null;
  if (clean.some((item) => item.customer.toLowerCase() === record.customer.toLowerCase())) return null;
  return [...clean, record];
}

export function removeBillingAddress(list, id) {
  const clean = normalizeBillingAddressList(list);
  const key = text(id);
  if (!key) return clean;
  return clean.filter((item) => item.id !== key);
}

export function findBillingAddress(list, customer) {
  const clean = normalizeBillingAddressList(list);
  const key = text(customer).toLowerCase();
  if (!key) return null;
  return clean.find((item) => item.customer.toLowerCase() === key) || null;
}

export function billingAddressesSorted(list) {
  const clean = normalizeBillingAddressList(list);
  return [...clean].sort((a, b) => {
    const byCustomer = a.customer.toLowerCase().localeCompare(b.customer.toLowerCase());
    if (byCustomer !== 0) return byCustomer;
    if (a.dateEffective !== b.dateEffective) return a.dateEffective < b.dateEffective ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function billingAddressesForCustomer(list, customer) {
  const clean = normalizeBillingAddressList(list);
  const needle = text(customer).toLowerCase();
  if (!needle) return clean;
  return clean.filter((item) => item.customer.toLowerCase().includes(needle));
}

// The address a bill should be delivered to: the billing address
// where one is set for this customer, otherwise the service address
// the caller supplies. This is the lookup bill delivery (Plan 205)
// uses; it changes no delivery record and no bill.
export function deliveryAddressFor(list, customer, serviceAddress) {
  const record = findBillingAddress(list, customer);
  if (record) return record.billingAddress;
  return text(serviceAddress);
}

// True when the billing address differs from the service address
// (trimmed, case-insensitive); a missing service address counts as
// differing, never as matching.
export function billingAddressDiffers(billingAddress, serviceAddress) {
  const billing = text(billingAddress).toLowerCase();
  const service = text(serviceAddress).toLowerCase();
  if (!billing) return false;
  if (!service) return true;
  return billing !== service;
}

// Service address and billing address side by side for one customer.
// Where no billing address is set, that is said plainly: bills go to
// the service address, and no billing address is invented.
export function billingAddressSideBySideText(serviceAddress, record) {
  const service = text(serviceAddress) || 'No service address noted.';
  if (!record) return `Service address: ${service}. Billing address: none set — bills go to the service address.`;
  const differs = billingAddressDiffers(record.billingAddress, serviceAddress)
    ? 'Differs from the service address.'
    : 'Same as the service address.';
  const note = record.note ? ` Note: ${record.note}` : '';
  return `Service address: ${service}. Billing address (from ${record.dateEffective}): ${record.billingAddress}. ${differs}${note}`;
}

export function billingAddressText(record) {
  const note = record.note ? ` Note: ${record.note}` : '';
  return `${record.customer} — bills to ${record.billingAddress} (from ${record.dateEffective}).${note}`;
}

export function billingAddressSummaryText(list) {
  const clean = normalizeBillingAddressList(list);
  if (clean.length === 0) return 'No billing addresses recorded.';
  if (clean.length === 1) return '1 customer has a separate billing address.';
  return `${clean.length} customers have separate billing addresses.`;
}

export function billingAddressEntryHtml(record, serviceAddress) {
  const sideBySide = billingAddressSideBySideText(serviceAddress, record);
  return `<p>${escapeHtml(sideBySide)}</p>`;
}

export function billingAddressHtml(list) {
  const sorted = billingAddressesSorted(list);
  if (sorted.length === 0) return '';
  return sorted.map((record) => `<p>${escapeHtml(billingAddressText(record))}</p>`).join('');
}

export function billingAddressCsv(list) {
  const sorted = billingAddressesSorted(list);
  const rows = [['id', 'customer', 'billing_address', 'date_effective', 'note']];
  for (const record of sorted) {
    rows.push([record.id, record.customer, record.billingAddress, record.dateEffective, record.note]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function billingAddressFilename() {
  return 'billing-addresses.csv';
}
