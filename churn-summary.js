// Plan 60 (Plan 1-100) — Monthly churn and retention summary (read-only).
//
// The owner can see today's collections and this month's new
// connections, but not the simple retention arithmetic — how many
// left, how many stayed, how many joined, and what that did to the
// customer base — so a month that looks busy can quietly be
// shrinking. This module is that one honest monthly page, composed
// from records the caller already has. It creates no new metric
// store and changes no bill, payment, or lifecycle record.
//
// The arithmetic, stated in plain words (the summary text repeats
// it, so the page never asks to be trusted blind):
//   - month start = customers active at the first day of the month:
//     joined before the month began (or with no recorded join date,
//     counted as already customers and named in the assumptions)
//     and not departed before the month began;
//   - new = customers whose join date falls inside the month;
//   - departed = customers whose departure date falls inside the
//     month;
//   - stayed = month-start customers who did not depart during the
//     month (counted directly, not as start minus departed, because
//     departures also include customers who joined during the month);
//   - month end = start + new − departed, which is also exactly the
//     count of customers active at the end of the month (the view
//     carries both counts and a `reconciles` flag so a mismatch
//     could never hide);
//   - churn rate = departed ÷ month-start customers, or null when
//     there were no customers at month start (a rate over zero
//     customers is not 0%, it is not calculable);
//   - revenue at risk = the sum of the monthly package amounts of
//     the customers on the Plan 56 at-risk list, as supplied by the
//     caller; an at-risk entry with no usable amount is counted
//     separately and never guessed at zero.
//
// Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is not a
// date). A departure dated before its join date is inconsistent
// data: it is ignored (the customer counts as still active) and
// counted in `inconsistentDates`, never silently repaired. A join
// date may be a datetime string; only its date part is used. Inputs
// are never mutated, and the module never reads storage, the clock,
// or the network.
//
// Input shapes:
//   customers: [{ id, name, joinedDate, leftDate }] — joinedDate is
//     the activation/add date as resolved by the caller; leftDate
//     is the archive/disconnect date, or null while still active.
//   atRisk: [{ customerId, monthlyAmount }] — the Plan 56 at-risk
//     rows joined to their monthly package amounts by the caller.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validChurnDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

export function validChurnMonth(value) {
  const clean = text(value);
  if (!MONTH_RE.test(clean)) return null;
  const [year, month] = clean.split('-').map(Number);
  if (month < 1 || month > 12 || year < 1) return null;
  return clean;
}

// First and last calendar day of a month, or null for a bad month.
export function monthBounds(month) {
  const clean = validChurnMonth(month);
  if (!clean) return null;
  const [year, monthNum] = clean.split('-').map(Number);
  const first = `${clean}-01`;
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const last = `${clean}-${String(lastDay).padStart(2, '0')}`;
  return { start: first, end: last };
}

function monthOf(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : null;
}

// One normalised customer row, or null when there is no id to
// count. A missing join date counts the customer as already a
// customer at month start (named in the assumptions, never hidden);
// an inconsistent departure (before the join date) is ignored.
function normalizeChurnCustomer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id ?? raw.customerId);
  if (!id) return null;
  const joinedDate = validChurnDate(raw.joinedDate);
  const leftDate = validChurnDate(raw.leftDate);
  let inconsistent = false;
  let effectiveLeft = leftDate;
  if (joinedDate && leftDate && leftDate < joinedDate) {
    effectiveLeft = null;
    inconsistent = true;
  }
  return {
    customerId: id,
    customerName: text(raw.name ?? raw.customerName) || id,
    joinedDate,
    leftDate: effectiveLeft,
    joinedUnknown: joinedDate === null,
    inconsistent,
  };
}

function toCents(amount) {
  // Number(null) is 0 and Number(true) is 1: a missing amount must
  // never become a zero amount, so nullish, blank, and boolean
  // inputs are unknown, not zero.
  if (amount === null || amount === undefined || typeof amount === 'boolean') return null;
  if (typeof amount === 'string' && amount.trim() === '') return null;
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function fromCents(cents) {
  return Math.round(cents) / 100;
}

export function buildMonthlyChurnSummary({ month, customers = [], atRisk = [] } = {}) {
  const cleanMonth = validChurnMonth(month);
  if (!cleanMonth) return null;
  const bounds = monthBounds(cleanMonth);
  const rows = [];
  for (const raw of Array.isArray(customers) ? customers : []) {
    const row = normalizeChurnCustomer(raw);
    if (row) rows.push(row);
  }

  const startRows = [];
  const newRows = [];
  const departedRows = [];
  const endRows = [];
  for (const row of rows) {
    const joinedBeforeMonth = row.joinedDate === null || row.joinedDate < bounds.start;
    const joinedInMonth = row.joinedDate !== null && monthOf(row.joinedDate) === cleanMonth;
    const leftInMonth = row.leftDate !== null && monthOf(row.leftDate) === cleanMonth;
    const leftBeforeMonth = row.leftDate !== null && row.leftDate < bounds.start;
    const activeAtStart = joinedBeforeMonth && !leftBeforeMonth;
    // A customer who departs on the first day of the month still
    // counts at month start: they were a customer when the month
    // began, and the departure is counted in the month.
    const activeAtEnd =
      (row.joinedDate === null || row.joinedDate <= bounds.end) &&
      (row.leftDate === null || row.leftDate > bounds.end);
    if (activeAtStart) startRows.push(row);
    if (joinedInMonth) newRows.push(row);
    if (leftInMonth) departedRows.push(row);
    if (activeAtEnd) endRows.push(row);
  }

  const start = startRows.length;
  const newCount = newRows.length;
  const departed = departedRows.length;
  const end = start + newCount - departed;
  // Stayed is counted directly, not as start minus departed: the
  // departed count also includes customers who joined during the
  // month, who were never month-start customers to begin with.
  const departedIds = new Set(departedRows.map((row) => row.customerId));
  const stayed = startRows.filter((row) => !departedIds.has(row.customerId)).length;
  const churnRate = start === 0 ? null : departed / start;

  // Revenue at risk: the Plan 56 at-risk rows, joined to monthly
  // package amounts by the caller. Amounts sum in integer cents;
  // an entry with no usable amount is counted, never zero-filled.
  let revenueAtRiskCents = 0;
  let atRiskCount = 0;
  let atRiskUnknownAmount = 0;
  const atRiskIds = new Set();
  for (const entry of Array.isArray(atRisk) ? atRisk : []) {
    if (!entry || typeof entry !== 'object') continue;
    const id = text(entry.customerId ?? entry.id);
    if (!id) continue;
    atRiskCount += 1;
    atRiskIds.add(id);
    const cents = toCents(entry.monthlyAmount);
    if (cents === null) atRiskUnknownAmount += 1;
    else revenueAtRiskCents += cents;
  }

  const nameSort = (a, b) =>
    a.customerName.localeCompare(b.customerName) || a.customerId.localeCompare(b.customerId);
  const newList = [...newRows].sort(nameSort).map((row) => ({
    customerId: row.customerId,
    customerName: row.customerName,
    joinedDate: row.joinedDate,
  }));
  const departedList = [...departedRows].sort(nameSort).map((row) => ({
    customerId: row.customerId,
    customerName: row.customerName,
    leftDate: row.leftDate,
  }));

  const assumptions = [];
  const unknownJoined = rows.filter((row) => row.joinedUnknown).length;
  if (unknownJoined > 0) {
    assumptions.push(
      `${unknownJoined} customer${unknownJoined === 1 ? '' : 's'} with no recorded join date counted as already customers at month start.`,
    );
  }
  const inconsistent = rows.filter((row) => row.inconsistent).length;
  if (inconsistent > 0) {
    assumptions.push(
      `${inconsistent} departure${inconsistent === 1 ? '' : 's'} dated before its join date ignored as inconsistent data.`,
    );
  }
  if (atRiskUnknownAmount > 0) {
    assumptions.push(
      `${atRiskUnknownAmount} at-risk customer${atRiskUnknownAmount === 1 ? '' : 's'} with no usable monthly amount excluded from revenue at risk.`,
    );
  }

  return {
    month: cleanMonth,
    monthStart: bounds.start,
    monthEnd: bounds.end,
    start,
    newCustomers: newCount,
    departed,
    stayed,
    end,
    endCheck: endRows.length,
    reconciles: end === endRows.length,
    netChange: newCount - departed,
    churnRate,
    churnRatePercent: churnRate === null ? null : Math.round(churnRate * 1000) / 10,
    revenueAtRisk: fromCents(revenueAtRiskCents),
    revenueAtRiskCents,
    atRiskCount,
    atRiskUnknownAmount,
    newList,
    departedList,
    assumptions,
    basis:
      'Month start counts customers joined before the month began and not departed before it. ' +
      'New counts join dates inside the month; departed counts departure dates inside the month. ' +
      'Churn rate is departed divided by month-start customers. Revenue at risk sums the monthly package ' +
      'amounts of the customers on the Plan 56 at-risk list.',
  };
}

export function churnSummaryText(view) {
  if (!view || typeof view !== 'object') return 'No churn view.';
  const churn = view.churnRate === null
    ? 'churn rate not calculable (no customers at month start)'
    : `churn rate ${view.churnRatePercent}%`;
  return (
    `${view.month}: ${view.start} at month start, ${view.newCustomers} new, ${view.departed} departed, ` +
    `${view.stayed} stayed, ${view.end} at month end (net ${view.netChange >= 0 ? '+' : ''}${view.netChange}), ${churn}; ` +
    `monthly revenue at risk Rs. ${view.revenueAtRisk} across ${view.atRiskCount} at-risk customer${view.atRiskCount === 1 ? '' : 's'}.`
  );
}

function customerListHtml(title, list, dateLabel, dateKey) {
  if (!list || list.length === 0) return `<p style="font-size: 12px;">No ${title.toLowerCase()} this month.</p>`;
  const body = list
    .map((row) => `<tr><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row[dateKey] || 'Not recorded')}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>${escapeHtml(title)}</th><th>${escapeHtml(dateLabel)}</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function churnHtml(view) {
  if (!view || typeof view !== 'object') return '<p style="font-size: 12px;">No churn view for this month.</p>';
  const churnCell = view.churnRate === null ? 'Not calculable' : `${view.churnRatePercent}%`;
  const assumptionsHtml = view.assumptions && view.assumptions.length > 0
    ? `<p style="font-size: 12px;">Assumptions: ${escapeHtml(view.assumptions.join(' '))}</p>`
    : '';
  return (
    `<p style="font-size: 12px;">${escapeHtml(view.basis)}</p>` +
    `<table><thead><tr><th>Measure</th><th>Count</th></tr></thead><tbody>` +
    `<tr><td>Customers at month start</td><td>${view.start}</td></tr>` +
    `<tr><td>New activations</td><td>${view.newCustomers}</td></tr>` +
    `<tr><td>Departures</td><td>${view.departed}</td></tr>` +
    `<tr><td>Stayed (month-start customers still active)</td><td>${view.stayed}</td></tr>` +
    `<tr><td>Customers at month end</td><td>${view.end}</td></tr>` +
    `<tr><td>Net change</td><td>${view.netChange >= 0 ? '+' : ''}${view.netChange}</td></tr>` +
    `<tr><td>Churn rate (departed ÷ month start)</td><td>${escapeHtml(churnCell)}</td></tr>` +
    `<tr><td>Monthly revenue at risk (Plan 56 at-risk list)</td><td>Rs. ${view.revenueAtRisk}</td></tr>` +
    `</tbody></table>` +
    `<p style="font-size: 12px;">Reconciliation: start ${view.start} + new ${view.newCustomers} − departed ${view.departed} = end ${view.end}${view.reconciles ? ' ✓' : ' — does not match the independently counted month-end figure, check the dates.'}</p>` +
    assumptionsHtml +
    `<h4 style="font-size: 13px; margin: 8px 0 4px;">New this month</h4>${customerListHtml('Customer', view.newList, 'Joined', 'joinedDate')}` +
    `<h4 style="font-size: 13px; margin: 8px 0 4px;">Departed this month</h4>${customerListHtml('Customer', view.departedList, 'Departed', 'leftDate')}`
  );
}

export function churnCsv(view) {
  if (!view || typeof view !== 'object') return '';
  const lines = ['measure,value'];
  const rows = [
    ['month', view.month],
    ['customers at month start', view.start],
    ['new activations', view.newCustomers],
    ['departures', view.departed],
    ['stayed', view.stayed],
    ['customers at month end', view.end],
    ['net change', view.netChange],
    ['churn rate', view.churnRate === null ? 'not calculable' : view.churnRatePercent],
    ['monthly revenue at risk', view.revenueAtRisk],
    ['at-risk customers', view.atRiskCount],
  ];
  for (const [measure, value] of rows) lines.push([csvCell(measure), csvCell(value)].join(','));
  for (const row of view.newList || []) {
    lines.push(['new', csvCell(row.customerName), csvCell(row.joinedDate || '')].join(','));
  }
  for (const row of view.departedList || []) {
    lines.push(['departed', csvCell(row.customerName), csvCell(row.leftDate || '')].join(','));
  }
  return lines.join('\n');
}

export function churnFilename(month) {
  const clean = validChurnMonth(month) || 'all';
  return `churn-summary-${clean}.csv`;
}
