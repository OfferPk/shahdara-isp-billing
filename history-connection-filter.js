// Plan 419 — History per-connection filter for multi-connection customers.
//
// A customer with two connections — a house and a shop, for example —
// has one mixed history, so the operator cannot tell which connection
// a payment belonged to. One connection filter on the customer
// history — one named connection, or all — showing only that
// connection's transactions with subtotals. It filters only and
// changes nothing: it reads the entries the full history list
// already composed and returns the ones of the chosen connection,
// in the same order, with the running balance each entry already
// carries. The choice lives only while the profile is open.
//
// The connection of an entry is read from the entry itself: an
// entry recorded against a connection carries that connection on
// its own record (the full-history list carries the payment and
// bill records' own connection onto the entry), and the filter
// matches it case-insensitively.
// An entry with no recorded connection belongs to no named
// connection and appears only under All connections — the filter
// never guesses a connection for it.
//
// The offered connections come from the caller's billing-link
// record for the customer — its primary and linked connections —
// or from caller-supplied connection rows in the same shape as
// the combined dues view's lines. A customer with no link on
// record has no second connection to filter by, so the caller
// offers All connections only and shows no filter control.
//
// Subtotals follow the monthly grouping's rule on the same
// entries: billed is charges plus refunds, paid is payments plus
// advances plus adjustments plus adjustment-sourced credits. A
// voided entry moves nothing, and a credit from an overpayment
// moves nothing — it was already counted inside its source
// payment. A figure that is not a number never counts as zero.
//
// Pure and import-free: no storage, no clock, no network, no
// other module. Inputs are never mutated.

export const HISTORY_CONNECTION_FILTER_ALL = 'all';

function foldConnectionId(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

function cleanConnectionLabel(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function finiteConnectionCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/**
 * The connection an entry belongs to, folded for matching: the
 * entry's own recorded connection, or '' when the record names
 * none. Never guessed.
 */
export function historyConnectionFilterConnectionOf(entry) {
  if (!entry || typeof entry !== 'object') return '';
  return foldConnectionId(entry.connection ?? entry.connectionId);
}

/**
 * Filter options: All connections first, then one per connection
 * the caller offers. The source may be a billing-link record
 * (primary and linked connections), a list of connection rows
 * ({id, label}), or a list of plain connection names. Blank
 * connections are dropped and duplicates fold to one option, so
 * a link that names the same connection twice offers it once.
 * With no source, All connections is the only option.
 */
export function historyConnectionFilterOptions(source) {
  const options = [{ id: HISTORY_CONNECTION_FILTER_ALL, label: 'All connections' }];
  const seen = new Set([HISTORY_CONNECTION_FILTER_ALL]);
  const add = (id, label) => {
    const folded = foldConnectionId(id);
    if (!folded || seen.has(folded)) return;
    seen.add(folded);
    const shown = cleanConnectionLabel(label) || cleanConnectionLabel(id);
    options.push({ id: folded, label: shown });
  };
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    add(source.primaryConnection, source.primaryConnection);
    add(source.linkedConnection, source.linkedConnection);
  } else if (Array.isArray(source)) {
    for (const row of source) {
      if (typeof row === 'string') {
        add(row, row);
      } else if (row && typeof row === 'object') {
        const id = row.id ?? row.connection ?? row.connectionId;
        add(id, row.label ?? id);
      }
    }
  }
  return options;
}

/**
 * Normalize a filter choice against the offered connections. A
 * valid choice stays itself; 'all', a missing choice, and anything
 * the options do not offer read as 'all', so a damaged choice
 * never drops entries from the list.
 */
export function normalizeHistoryConnectionFilter(value, source) {
  const folded = foldConnectionId(value);
  if (!folded) return HISTORY_CONNECTION_FILTER_ALL;
  const options = historyConnectionFilterOptions(source);
  return options.some((option) => option.id === folded) ? folded : HISTORY_CONNECTION_FILTER_ALL;
}

/**
 * Filter full-history entries by connection. 'all' (or a missing
 * choice) keeps every entry, in the same order; any other
 * connection keeps exactly the entries recorded against it. The
 * input list and its entries are never mutated — the result is a
 * new array.
 */
export function filterHistoryEntriesByConnection(entries, connection) {
  const list = Array.isArray(entries) ? entries : [];
  const choice = foldConnectionId(connection);
  if (!choice || choice === HISTORY_CONNECTION_FILTER_ALL) return [...list];
  return list.filter((entry) => historyConnectionFilterConnectionOf(entry) === choice);
}

/**
 * Counts per offered connection over the full list, plus the
 * total, the untagged count (no recorded connection) and the
 * other count (a recorded connection the options do not offer).
 * The named counts plus untagged plus other always sum to the
 * total, so every entry is accounted for and none is guessed
 * into a connection.
 */
export function historyConnectionFilterCounts(entries, source) {
  const list = Array.isArray(entries) ? entries : [];
  const options = historyConnectionFilterOptions(source);
  const counts = { total: list.length, untagged: 0, other: 0 };
  for (const option of options) counts[option.id] = 0;
  counts[HISTORY_CONNECTION_FILTER_ALL] = list.length;
  for (const entry of list) {
    const connection = historyConnectionFilterConnectionOf(entry);
    if (!connection) {
      counts.untagged += 1;
    } else if (Object.prototype.hasOwnProperty.call(counts, connection)) {
      counts[connection] += 1;
    } else {
      counts.other += 1;
    }
  }
  return counts;
}

/**
 * Subtotals over a list of entries: how many entries, what was
 * billed, what was paid, and what is still owed. Billed is
 * charges plus refunds; paid is payments plus advances plus
 * adjustments plus adjustment-sourced credits. A voided entry
 * contributes nothing, and an entry with no usable amount
 * contributes nothing — never a guessed zero.
 */
export function historyConnectionFilterSubtotals(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let billedCents = 0;
  let paidCents = 0;
  for (const entry of list) {
    if (!entry || typeof entry !== 'object' || entry.voided) continue;
    const cents = finiteConnectionCents(entry.amountCents);
    if (cents === null) continue;
    if (entry.type === 'charge' || entry.type === 'refund') {
      billedCents += cents;
    } else if (entry.type === 'payment' || entry.type === 'advance' || entry.type === 'adjustment') {
      paidCents += cents;
    } else if (entry.type === 'credit' && entry.source === 'adjustment') {
      paidCents += cents;
    }
  }
  return { count: list.length, billedCents, paidCents, stillOwedCents: billedCents - paidCents };
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatHistoryConnectionFilterAmount(cents) {
  const amount = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

function escapeHistoryConnectionFilterHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The filter select markup: one option per offered connection
 * with its live count, e.g. 'House (3)'. The chosen option is
 * marked selected. A customer with no second connection on
 * record is offered All connections only.
 */
export function historyConnectionFilterSelectMarkup(source, selected, entries) {
  const options = historyConnectionFilterOptions(source);
  const counts = historyConnectionFilterCounts(entries, source);
  const choice = normalizeHistoryConnectionFilter(selected, source);
  const markup = options
    .map((option) => `<option value="${escapeHistoryConnectionFilterHtml(option.id)}"${option.id === choice ? ' selected' : ''}>${escapeHistoryConnectionFilterHtml(option.label)} (${counts[option.id] ?? 0})</option>`)
    .join('');
  return `<label class="field-label" for="hcfHistoryConnectionFilter">Connection</label><select id="hcfHistoryConnectionFilter" class="hcf-filter">${markup}</select>`;
}

/**
 * Empty-list line: '' for all (the list's own line covers it),
 * 'No house entries' for one named connection.
 */
export function historyConnectionFilterEmptyText(connection, source) {
  const choice = normalizeHistoryConnectionFilter(connection, source);
  if (choice === HISTORY_CONNECTION_FILTER_ALL) return '';
  const options = historyConnectionFilterOptions(source);
  const option = options.find((item) => item.id === choice);
  return `No ${option ? option.label : choice} entries`;
}

/**
 * Summary line for the shown list while a connection is chosen:
 * '3 of 7 entries · Shop · Billed PKR 2,500 · Paid PKR 1,500 ·
 * Still owed PKR 1,000'. The figures are the subtotals of the
 * shown rows, so every other filter already applied is reflected
 * in them. '' for all — the list's own summary covers it. A
 * disputed-only view in force adds ' · Disputed only'.
 */
export function historyConnectionFilterSummaryText(shown, entries, connection, source, disputed) {
  const choice = normalizeHistoryConnectionFilter(connection, source);
  if (choice === HISTORY_CONNECTION_FILTER_ALL) return '';
  const shownList = Array.isArray(shown) ? shown : [];
  const fullList = Array.isArray(entries) ? entries : [];
  const options = historyConnectionFilterOptions(source);
  const option = options.find((item) => item.id === choice);
  const label = option ? option.label : choice;
  const subtotals = historyConnectionFilterSubtotals(shownList);
  const count = shownList.length === 1
    ? `1 entry of ${fullList.length}`
    : `${shownList.length} of ${fullList.length} entries`;
  const disputedPart = foldConnectionId(disputed) === 'disputed' ? ' · Disputed only' : '';
  return `${count} · ${label}${disputedPart} · Billed ${formatHistoryConnectionFilterAmount(subtotals.billedCents)} · Paid ${formatHistoryConnectionFilterAmount(subtotals.paidCents)} · Still owed ${formatHistoryConnectionFilterAmount(subtotals.stillOwedCents)}`;
}
