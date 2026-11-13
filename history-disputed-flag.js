// Plan 414 — History disputed transactions flag view.
//
// A transaction that belongs to an open dispute case looks exactly
// like a settled one in the history, so the operator can collect
// on it or count it as settled by mistake. This module is the
// missing flag: every history line that belongs to an open case
// carries its flag, with the case reference shown beside the line,
// and a filter shows only the flagged lines. It flags only and it
// changes nothing: it reads the entries the full history already
// composes plus the dispute cases already on this device, and it
// writes to no store, no bill, no payment, no case, and no
// customer record. Closing a case clears its flag, because only
// an open case ever matches.
//
// Matching a case to a line follows the same rule the app already
// uses for the disputed-balance split: same customer, and the same
// bill — matched by bill id when the line carries one, otherwise
// by bill month. A charge line carries its bill id as its
// reference; a payment line carries its bill month. The two agree
// on every consistent record, since one customer has one bill per
// month. A case for another customer, another bill, or a resolved
// case never flags a line, a line with neither a reference nor
// a month is never flagged, and a case with no reference recorded
// never flags a line either, since the flag always carries its
// reference. Open means open, investigating, or escalated — the
//
// The flag list renders the same rows the full history renders,
// with the flag text added to the flagged rows only; with no open
// case the two renderings are identical, so the ordinary list
// never changes shape.
export const HISTORY_DISPUTED_FLAG_OPEN_STATUSES = Object.freeze([
  'open',
  'investigating',
  'escalated',
]);

export const HISTORY_DISPUTED_FLAG_FILTER_ALL = 'all';
export const HISTORY_DISPUTED_FLAG_FILTER_DISPUTED = 'disputed';
export const HISTORY_DISPUTED_FLAG_EMPTY_TEXT = 'No disputed entries';

const HISTORY_DISPUTED_FLAG_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
  info: 'Info',
});

const HISTORY_DISPUTED_FLAG_METHOD_LABELS = Object.freeze({
  cash: 'Cash',
  bank: 'Bank transfer',
  wallet: 'Mobile wallet',
  other: 'Other',
});

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapDisputedFlagYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isStrictDisputedFlagDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const lastDay = month === 2 && isLeapDisputedFlagYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= lastDay;
}

function cleanDisputedFlagText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanDisputedFlagKey(value) {
  return cleanDisputedFlagText(value).toLowerCase().replace(/\s+/g, ' ');
}

function foldDisputedFlagStatus(value) {
  return cleanDisputedFlagText(value).toLowerCase().replace(/[\s-]+/g, '_');
}

function escapeDisputedFlagHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and
// one decimal for a paisa remainder (PKR 1,500.5), the same shape
// the entry-screen formatters use.
export function formatDisputedFlagAmount(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

function disputedFlagSubtotalCents(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let total = 0;
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const cents = Number(entry.amountCents);
    if (!Number.isFinite(cents)) continue;
    total += Math.round(cents);
  }
  return total;
}

function disputedFlagRunningNote(balanceCents) {
  const balance = Number(balanceCents);
  if (!Number.isFinite(balance) || balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatDisputedFlagAmount(balance)}`;
  return `Credit ${formatDisputedFlagAmount(-balance)}`;
}

// A case is open when its status is one of the open statuses. A
// case with no status recorded is not open — a flag is never raised
// on a guess.
export function historyDisputedFlagIsOpenCase(raw) {
  if (!raw || typeof raw !== 'object') return false;
  return HISTORY_DISPUTED_FLAG_OPEN_STATUSES.includes(foldDisputedFlagStatus(raw.status));
}

// One case normalised to the fields this flag needs, or null when
// it carries nothing usable. A case with no customer never matches;
// a case with no bill id and no bill month never matches either,
// since there is nothing to match a line against.
function normalizeDisputedFlagCase(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const customerId = cleanDisputedFlagText(raw.customerId);
  if (!customerId) return null;
  return {
    id: cleanDisputedFlagText(raw.id),
    customerId,
    billId: cleanDisputedFlagText(raw.billId),
    billMonth: cleanDisputedFlagText(raw.billMonth),
    status: foldDisputedFlagStatus(raw.status),
  };
}

function openDisputedFlagCases(cases) {
  const list = Array.isArray(cases) ? cases : [];
  const out = [];
  for (const raw of list) {
    const item = normalizeDisputedFlagCase(raw);
    if (!item) continue;
    if (!HISTORY_DISPUTED_FLAG_OPEN_STATUSES.includes(item.status)) continue;
    out.push(item);
  }
  return out;
}

// The reference of the first open case the line belongs to, or ''.
// A line belongs to a case when the customer matches and the
// line's reference is the case's bill id, or the line's month is
// the case's bill month. A case with no reference recorded never
// matches, since the flag always carries its reference. The first
// match in the caller's case order wins, so the flag is stable
// for the same inputs.
export function historyDisputedFlagCaseRefForEntry(entry, cases, customerId) {
  if (!entry || typeof entry !== 'object') return '';
  const customer = cleanDisputedFlagText(customerId);
  if (!customer) return '';
  const ref = cleanDisputedFlagText(entry.ref);
  const month = cleanDisputedFlagText(entry.month);
  if (!ref && !month) return '';
  const open = openDisputedFlagCases(cases);
  for (const item of open) {
    if (item.customerId !== customer) continue;
    if (item.id === '') continue;
    if (ref !== '' && item.billId !== '' && ref === item.billId) return item.id;
    if (month !== '' && item.billMonth !== '' && month === item.billMonth) return item.id;
  }
  return '';
}

// The entries with their flag attached: each entry is copied with
// a disputedCaseRef field — the case reference, or '' when the
// line belongs to no open case. Inputs are never mutated, and the
// entries keep their order.
export function historyDisputedFlagEntries(entries, cases, customerId) {
  const list = Array.isArray(entries) ? entries : [];
  return list.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    return {
      ...entry,
      disputedCaseRef: historyDisputedFlagCaseRefForEntry(entry, cases, customerId),
    };
  });
}

// Counts over flagged entries: the total lines and how many carry
// a flag. Entries must already carry disputedCaseRef, as attached
// by the flag function above.
export function historyDisputedFlagCounts(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let disputed = 0;
  for (const entry of list) {
    if (entry && typeof entry === 'object' && cleanDisputedFlagText(entry.disputedCaseRef) !== '') {
      disputed += 1;
    }
  }
  return { total: list.length, disputed };
}

export function normalizeHistoryDisputedFlagFilter(value) {
  return cleanDisputedFlagKey(value) === HISTORY_DISPUTED_FLAG_FILTER_DISPUTED
    ? HISTORY_DISPUTED_FLAG_FILTER_DISPUTED
    : HISTORY_DISPUTED_FLAG_FILTER_ALL;
}

// The flagged-lines filter: 'disputed' keeps only the lines that
// carry a flag; anything else keeps the list as it is.
export function filterHistoryEntriesByDisputedFlag(entries, filter) {
  const list = Array.isArray(entries) ? entries : [];
  if (normalizeHistoryDisputedFlagFilter(filter) !== HISTORY_DISPUTED_FLAG_FILTER_DISPUTED) {
    return [...list];
  }
  return list.filter(
    (entry) => entry && typeof entry === 'object' && cleanDisputedFlagText(entry.disputedCaseRef) !== '',
  );
}

export function historyDisputedFlagOptions(entries) {
  const counts = historyDisputedFlagCounts(entries);
  return [
    { value: HISTORY_DISPUTED_FLAG_FILTER_ALL, label: 'All lines', count: counts.total },
    { value: HISTORY_DISPUTED_FLAG_FILTER_DISPUTED, label: 'Disputed only', count: counts.disputed },
  ];
}

export function historyDisputedFlagSelectMarkup(entries, selected) {
  const choice = normalizeHistoryDisputedFlagFilter(selected);
  const options = historyDisputedFlagOptions(entries)
    .map((option) => `<option value="${escapeDisputedFlagHtml(option.value)}"${option.value === choice ? ' selected' : ''}>${escapeDisputedFlagHtml(option.label)} (${option.count})</option>`)
    .join('');
  return `<label class="field-label" for="hdfHistoryDisputedFlag">Disputed</label><select id="hdfHistoryDisputedFlag" class="hdf-filter">${options}</select>`;
}

// Empty-list line: 'No disputed entries' while the disputed-only
// filter is on. With no filter chosen it returns '' so the caller
// keeps whatever empty line the other filters already show.
export function historyDisputedFlagEmptyText(filter) {
  if (normalizeHistoryDisputedFlagFilter(filter) !== HISTORY_DISPUTED_FLAG_FILTER_DISPUTED) return '';
  return HISTORY_DISPUTED_FLAG_EMPTY_TEXT;
}

function normalizeDisputedFlagDateRange(from, to) {
  return {
    from: isStrictDisputedFlagDate(from) ? from : '',
    to: isStrictDisputedFlagDate(to) ? to : '',
  };
}

// A typed amount search, folded the way the amount search reads
// it: digits with commas and spaces fold away, a leading Rs or PKR
// is tolerated, and only a positive whole-rupee figure counts —
// anything else reads as no search.
function normalizeDisputedFlagAmountSearch(amount) {
  if (typeof amount === 'number') {
    return Number.isInteger(amount) && amount > 0 ? amount : null;
  }
  if (typeof amount !== 'string') return null;
  const cleaned = amount.trim().replace(/^(rs|pkr)\s*/i, '').replace(/[,\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const rupees = Number(cleaned);
  return Number.isSafeInteger(rupees) && rupees > 0 ? rupees : null;
}

// Summary line for the shown list while the disputed-only filter
// is on: '2 of 10 entries · Disputed only · Subtotal PKR 4,000',
// with the date span added when a range is active too, and the
// type, method and amount suffixes when those are chosen too.
// With no disputed filter chosen it returns '' so the caller keeps
// the summary the other filters already show.
export function historyDisputedFlagSummaryText(shown, entries, filter, amount, from, to, type, method) {
  if (normalizeHistoryDisputedFlagFilter(filter) !== HISTORY_DISPUTED_FLAG_FILTER_DISPUTED) return '';
  const shownList = Array.isArray(shown) ? shown : [];
  const fullList = Array.isArray(entries) ? entries : [];
  const count = shownList.length === 1
    ? `1 entry of ${fullList.length}`
    : `${shownList.length} of ${fullList.length} entries`;
  const range = normalizeDisputedFlagDateRange(from, to);
  const span = range.from !== '' && range.to !== ''
    ? ` in ${range.from} – ${range.to}`
    : range.from !== ''
      ? ` from ${range.from}`
      : range.to !== ''
        ? ` up to ${range.to}`
        : '';
  const foldedType = cleanDisputedFlagKey(type);
  const typePart = foldedType !== '' && foldedType !== 'all' && HISTORY_DISPUTED_FLAG_TYPE_LABELS[foldedType]
    ? ` · ${HISTORY_DISPUTED_FLAG_TYPE_LABELS[foldedType]} only`
    : '';
  const foldedMethod = cleanDisputedFlagKey(method);
  const methodPart = foldedMethod !== '' && foldedMethod !== 'all' && HISTORY_DISPUTED_FLAG_METHOD_LABELS[foldedMethod]
    ? ` · ${HISTORY_DISPUTED_FLAG_METHOD_LABELS[foldedMethod]} only`
    : '';
  const rupees = normalizeDisputedFlagAmountSearch(amount);
  const amountPart = rupees === null ? '' : ` · ${formatDisputedFlagAmount(rupees * 100)} only`;
  const subtotal = formatDisputedFlagAmount(disputedFlagSubtotalCents(shownList));
  return `${count} · Disputed only${span}${typePart}${methodPart}${amountPart} · Subtotal ${subtotal}`;
}

// The history list with its flags: the same rows the full history
// renders — label, amount, date, method, note and running balance
// — with ' · Disputed · CASE-REF' added to the meta line of every
// flagged row. With no flagged row the output is the ordinary
// list, unchanged.
export function historyDisputedFlagListHtml(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return '';
  const rows = list.map((entry) => {
    if (!entry || typeof entry !== 'object') return '';
    const label = HISTORY_DISPUTED_FLAG_TYPE_LABELS[entry.type] || 'Payment';
    const date = entry.date ? entry.date : 'date not recorded';
    const amount = formatDisputedFlagAmount(entry.amountCents);
    const note = disputedFlagRunningNote(entry.runningBalanceCents);
    const details = [date, entry.method, entry.note].filter(Boolean).join(' · ');
    const voided = entry.voided ? ' · VOID' : '';
    return `<li class="payment-row"><span class="payment-main"><span class="payment-amount">${escapeDisputedFlagHtml(label)} · ${escapeDisputedFlagHtml(amount)}${escapeDisputedFlagHtml(voided)}</span><span class="payment-meta">${escapeDisputedFlagHtml(details)} · ${escapeDisputedFlagHtml(note)}${escapeDisputedFlagHtml(disputedFlagText(entry))}</span></span></li>`;
  });
  return `<ul class="payment-list">${rows.join('')}</ul>`;
}

function disputedFlagText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const ref = entry.disputedCaseRef;
  if (typeof ref !== 'string' || ref === '') return '';
  return ` · Disputed · ${ref}`;
}
