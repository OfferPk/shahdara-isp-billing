// Plan 230 (Plan 203-350) — Second-connection billing link.
//
// A customer with two connections — a house and a shop, for
// example — has no link saying those connections bill together, so
// a joint statement or a single-visit collection (the combined
// view of Plan 127) has to be rebuilt from memory each time. This
// module adds only the missing piece: one billing-link record per
// customer with two connections, linking for billing presentation
// and collection only, so the link itself is on record instead of
// in memory.
//
// One billing-link record: the customer, the primary connection,
// the linked connection, the link date, and a link note.
//
// The fences, stated plainly:
//   - This links for billing presentation and collection only. It
//     merges no customer records and it changes no bill: the
//     combined dues shown for a linked customer are a view computed
//     from caller-supplied dues rows, and they match the combined
//     view (Plan 127) on the same fixture exactly. The combined
//     view itself is neither read nor rewritten here — the caller
//     supplies the dues rows, and this module imports nothing.
//   - Recording or unlinking a link never changes any bill,
//     payment, or connection record by itself: the module takes no
//     bill, payment, or connection object in, edits none, and
//     returns none. It holds link records only.
//   - Unlinking keeps a dated history of the link: an unlinked link
//     stays in the list with its unlink date and leaves the active
//     view only. A linked customer may be linked again later with
//     a fresh record. There is no hard delete and no edit function:
//     only record and unlink.
//   - A link with no customer is refused outright, as is a record
//     with no id, no primary connection, no linked connection, a
//     non-calendar link date, or the same connection on both sides.
//     One active link per customer: a second active link for the
//     same customer is refused, never overwriting the first.
//     Duplicate ids are never rewritten.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validBillingLinkDate(value) {
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

function isActive(record) {
  return !record.dateUnlinked;
}

export function normalizeBillingLink(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const primaryConnection = text(raw.primaryConnection);
  const linkedConnection = text(raw.linkedConnection);
  const linkDate = text(raw.linkDate);
  if (!id || !customer || !primaryConnection || !linkedConnection) return null;
  if (!validBillingLinkDate(linkDate)) return null;
  if (primaryConnection.toLowerCase() === linkedConnection.toLowerCase()) return null;
  const dateUnlinked = text(raw.dateUnlinked);
  if (dateUnlinked && !validBillingLinkDate(dateUnlinked)) return null;
  return {
    id,
    customer,
    primaryConnection,
    linkedConnection,
    linkDate,
    linkNote: text(raw.linkNote),
    dateUnlinked,
  };
}

export function normalizeBillingLinkList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenActiveCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeBillingLink(raw);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    if (isActive(record)) {
      const key = record.customer.toLowerCase();
      if (seenActiveCustomers.has(key)) continue;
      seenActiveCustomers.add(key);
    }
    seenIds.add(record.id);
    out.push(record);
  }
  return out;
}

export function recordBillingLink(list, raw) {
  const clean = normalizeBillingLinkList(list);
  const record = normalizeBillingLink(raw);
  if (!record) return null;
  if (!isActive(record)) return null;
  if (clean.some((item) => item.id === record.id)) return null;
  if (clean.some((item) => isActive(item) && item.customer.toLowerCase() === record.customer.toLowerCase())) return null;
  return [...clean, record];
}

// Unlinking keeps a dated history: the link stays in the list with
// its unlink date and leaves the active view only. A bad unlink
// date, an unknown id, or an already-unlinked link leaves the list
// unchanged.
export function unlinkBillingLink(list, id, dateUnlinked) {
  const clean = normalizeBillingLinkList(list);
  const key = text(id);
  const date = text(dateUnlinked);
  if (!key || !validBillingLinkDate(date)) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id === key && isActive(item)) {
      changed = true;
      return { ...item, dateUnlinked: date };
    }
    return item;
  });
  return changed ? out : clean;
}

export function findBillingLink(list, customer) {
  const clean = normalizeBillingLinkList(list);
  const key = text(customer).toLowerCase();
  if (!key) return null;
  return clean.find((item) => isActive(item) && item.customer.toLowerCase() === key) || null;
}

export function billingLinksSorted(list) {
  const clean = normalizeBillingLinkList(list);
  return [...clean].sort((a, b) => {
    const byCustomer = a.customer.toLowerCase().localeCompare(b.customer.toLowerCase());
    if (byCustomer !== 0) return byCustomer;
    if (a.linkDate !== b.linkDate) return a.linkDate < b.linkDate ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function billingLinksActive(list) {
  return billingLinksSorted(list).filter(isActive);
}

export function billingLinksHistory(list) {
  const clean = normalizeBillingLinkList(list);
  return clean
    .filter((item) => !isActive(item))
    .sort((a, b) => {
      if (a.dateUnlinked !== b.dateUnlinked) return a.dateUnlinked < b.dateUnlinked ? -1 : 1;
      const byCustomer = a.customer.toLowerCase().localeCompare(b.customer.toLowerCase());
      if (byCustomer !== 0) return byCustomer;
      return a.id.localeCompare(b.id);
    });
}

export function billingLinksForCustomer(list, customer) {
  const clean = normalizeBillingLinkList(list);
  const needle = text(customer).toLowerCase();
  if (!needle) return clean;
  return clean.filter((item) => item.customer.toLowerCase().includes(needle));
}

// One amount to integer cents, without ever guessing the unit: an
// `amountCents` integer is used as-is, while a plain `amount` is
// always rupees and converts exactly once (x100). Anything else is
// null.
export function billingLinkDuesCents(value) {
  if (!value || typeof value !== 'object') return null;
  if (Number.isInteger(value.amountCents)) return value.amountCents;
  if (typeof value.amount === 'number' && Number.isFinite(value.amount)) {
    return Math.round(value.amount * 100);
  }
  return null;
}

// The linked customer's combined dues as a view only: the two
// connections of the link, each with its dues from caller-supplied
// rows, and their combined total. A connection with no dues row is
// reported plainly in `missing` and contributes nothing — never an
// invented zero row. This view changes no bill, payment, or
// connection record, and on a fixture where both connections carry
// dues it matches the combined view (Plan 127) exactly.
export function billingLinkCombinedDues(link, duesRows) {
  const record = normalizeBillingLink(link);
  if (!record) return null;
  const rows = Array.isArray(duesRows) ? duesRows : [];
  const findRow = (connectionId) => rows.find((row) => row && typeof row === 'object' && text(row.connectionId) === connectionId) || null;
  const primaryRow = findRow(record.primaryConnection);
  const linkedRow = findRow(record.linkedConnection);
  const missing = [];
  if (!primaryRow) missing.push(record.primaryConnection);
  if (!linkedRow) missing.push(record.linkedConnection);
  const primaryCents = primaryRow ? billingLinkDuesCents(primaryRow) : null;
  const linkedCents = linkedRow ? billingLinkDuesCents(linkedRow) : null;
  return {
    customer: record.customer,
    primaryConnection: record.primaryConnection,
    linkedConnection: record.linkedConnection,
    primaryCents: primaryCents === null ? 0 : primaryCents,
    linkedCents: linkedCents === null ? 0 : linkedCents,
    totalCents: (primaryCents === null ? 0 : primaryCents) + (linkedCents === null ? 0 : linkedCents),
    missing,
  };
}

export function billingLinkText(record) {
  const note = record.linkNote ? ` Note: ${record.linkNote}` : '';
  const unlinked = record.dateUnlinked ? ` Unlinked on ${record.dateUnlinked}.` : '';
  return `${record.customer} — ${record.primaryConnection} linked with ${record.linkedConnection} (from ${record.linkDate}).${note}${unlinked}`;
}

export function billingLinkSummaryText(list) {
  const clean = normalizeBillingLinkList(list);
  const active = clean.filter(isActive).length;
  const history = clean.length - active;
  if (clean.length === 0) return 'No billing links recorded.';
  if (history === 0) {
    if (active === 1) return '1 customer has two connections linked for billing.';
    return `${active} customers have two connections linked for billing.`;
  }
  return `${active} active billing link${active === 1 ? '' : 's'}, ${history} unlinked link${history === 1 ? '' : 's'} kept in history.`;
}

export function billingLinkEntryHtml(record) {
  return `<p>${escapeHtml(billingLinkText(record))}</p>`;
}

export function billingLinkHtml(list) {
  const active = billingLinksActive(list);
  if (active.length === 0) return '';
  return active.map((record) => `<p>${escapeHtml(billingLinkText(record))}</p>`).join('');
}

export function billingLinkHistoryHtml(list) {
  const history = billingLinksHistory(list);
  if (history.length === 0) return '';
  return history.map((record) => `<p>${escapeHtml(billingLinkText(record))}</p>`).join('');
}

export function billingLinkCsv(list) {
  const sorted = billingLinksSorted(list);
  const rows = [['id', 'customer', 'primary_connection', 'linked_connection', 'link_date', 'link_note', 'date_unlinked']];
  for (const record of sorted) {
    rows.push([record.id, record.customer, record.primaryConnection, record.linkedConnection, record.linkDate, record.linkNote, record.dateUnlinked]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function billingLinkFilename() {
  return 'billing-links.csv';
}
