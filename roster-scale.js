// Plan Y — Scale: large rosters, pagination, and retention.
//
// SCOPE, STATED PLAINLY. This module changes NO record, NO calculation,
// and deletes NOTHING. It does two things only:
//
// 1. Archived-roster paging. app.js renderCustomers() already paginates
//    the active roster with paginateRows (form-validation.js) but rendered
//    the whole archived list in one archived.map(...) pass, so the page
//    grew without bound as archives grew. archivedRosterPage gives the
//    archived panel the SAME page size and the SAME clamping semantics
//    as the active roster, paged independently: the active page and the
//    archived page are separate numbers and never move each other.
//    Its output is pinned to agree with paginateRows on the same inputs
//    (see tests/plan-y-roster-scale.test.js); it is a separate function
//    only so the archived panel can be tested without importing app.js.
//
// 2. Retention view. There is no stated rhythm for old months, so a
//    multi-year ledger keeps growing in every list. buildRetentionView
//    only DESCRIBES data age, by year: how many customers, bill months,
//    payments and archives each year holds, and the oldest/newest bill
//    month in it. It never deletes, archives, or rewrites anything.
//    The export-before-archive path is retentionYearCsv: a year can be
//    downloaded as CSV first, and only then may an operator take an
//    explicit archive/delete action elsewhere in the app (which already
//    prompts for a backup first). Nothing here is ever silent.
//
// The module is import-free (like nav-collection-rounds.js and
// field-day-flow.js) so it can be unit-tested in isolation.

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isMonthKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

function yearOfDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-\d{2}-\d{2}/);
  return match ? match[1] : null;
}

/**
 * Page one slice of the archived roster with the active roster's rules.
 * @param {Array} archived - already filtered + sorted archived customers
 * @param {number} page - requested page (1-based)
 * @param {number|string} pageSize - same page size as the active roster
 * @returns {{ items: Array, page: number, pageSize: number, totalPages: number, totalItems: number, startIndex: number, endIndex: number }}
 */
export function archivedRosterPage(archived, page = 1, pageSize = 15) {
  const list = Array.isArray(archived) ? archived : [];
  if (pageSize === 'all' || pageSize <= 0) {
    return {
      items: list,
      page: 1,
      pageSize: list.length || 1,
      totalPages: 1,
      totalItems: list.length,
      startIndex: 0,
      endIndex: list.length,
    };
  }
  const size = Math.max(1, Number(pageSize) || 15);
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const currentPage = Math.max(1, Math.min(Number(page) || 1, totalPages));
  const startIndex = (currentPage - 1) * size;
  const endIndex = Math.min(startIndex + size, list.length);
  return {
    items: list.slice(startIndex, endIndex),
    page: currentPage,
    pageSize: size,
    totalPages,
    totalItems: list.length,
    startIndex,
    endIndex,
  };
}

const RETENTION_POLICY =
  'No data is deleted automatically. Archiving a customer keeps its full ' +
  'history readable; deleting a record is always an explicit operator ' +
  'action, and the operator is prompted to back up first. Export a year ' +
  'below before archiving or deleting anything from it.';

/**
 * Describe ledger age by year, from the records the app already stores.
 * A bill month counts in its own year. A payment counts in its payment
 * date's year when it has one, otherwise in its bill month's year (the
 * payment lives inside that bill; no date is invented for it). An
 * archive counts in its archivedAt year. A customer touched in a year
 * counts once for that year, however many bills it has there.
 * @param {Array} customers - state.customers (whole ledger, not filtered)
 * @returns {{ years: Array, totalCustomers: number, totalBillMonths: number, totalPayments: number, oldestMonth: string|null, newestMonth: string|null, policy: string }}
 */
export function buildRetentionView(customers) {
  const list = Array.isArray(customers) ? customers : [];
  const byYear = new Map();
  const ensureYear = (year) => {
    if (!byYear.has(year)) {
      byYear.set(year, {
        year,
        customers: new Set(),
        billMonths: 0,
        payments: 0,
        archivedCustomers: 0,
        oldestMonth: null,
        newestMonth: null,
      });
    }
    return byYear.get(year);
  };
  let totalBillMonths = 0;
  let totalPayments = 0;
  let oldestMonth = null;
  let newestMonth = null;

  for (const customer of list) {
    if (!customer || typeof customer !== 'object') continue;
    const archivedYear = yearOfDate(customer.archivedAt);
    if (archivedYear) {
      const row = ensureYear(archivedYear);
      row.customers.add(customer.id);
      row.archivedCustomers += 1;
    }
    for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
      if (!bill || typeof bill !== 'object' || !isMonthKey(bill.month)) continue;
      const billYear = bill.month.slice(0, 4);
      const row = ensureYear(billYear);
      row.customers.add(customer.id);
      row.billMonths += 1;
      totalBillMonths += 1;
      if (oldestMonth === null || bill.month < oldestMonth) oldestMonth = bill.month;
      if (newestMonth === null || bill.month > newestMonth) newestMonth = bill.month;
      if (row.oldestMonth === null || bill.month < row.oldestMonth) row.oldestMonth = bill.month;
      if (row.newestMonth === null || bill.month > row.newestMonth) row.newestMonth = bill.month;
      for (const payment of Array.isArray(bill.payments) ? bill.payments : []) {
        if (!payment || typeof payment !== 'object') continue;
        const paymentYear = yearOfDate(payment.date) || billYear;
        const paymentRow = ensureYear(paymentYear);
        paymentRow.customers.add(customer.id);
        paymentRow.payments += 1;
        totalPayments += 1;
      }
    }
  }

  const years = [...byYear.values()]
    .sort((a, b) => (a.year < b.year ? 1 : -1))
    .map((row) => ({
      year: row.year,
      customers: row.customers.size,
      billMonths: row.billMonths,
      payments: row.payments,
      archivedCustomers: row.archivedCustomers,
      oldestMonth: row.oldestMonth,
      newestMonth: row.newestMonth,
    }));

  return {
    years,
    totalCustomers: list.filter((c) => c && typeof c === 'object').length,
    totalBillMonths,
    totalPayments,
    oldestMonth,
    newestMonth,
    policy: RETENTION_POLICY,
  };
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Export-before-archive path: one CSV for one year of the ledger.
 * Rows are bill months in that year (payments counted per bill, totalled
 * from the bill's own payments). Nothing is written or deleted here;
 * the caller downloads the returned string.
 */
export function retentionYearCsv(customers, year) {
  const list = Array.isArray(customers) ? customers : [];
  const wanted = String(year ?? '');
  const header = 'Customer number,Customer name,Month,Bill amount,Payments,Payments total';
  const rows = [];
  for (const customer of list) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
      if (!bill || typeof bill !== 'object' || !isMonthKey(bill.month)) continue;
      if (bill.month.slice(0, 4) !== wanted) continue;
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      const paymentsTotal = payments.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
      rows.push([
        customer.customerNumber ?? '',
        customer.name ?? '',
        bill.month,
        bill.dueAmount ?? '',
        payments.length,
        paymentsTotal,
      ].map(csvCell).join(','));
    }
  }
  return [header, ...rows].join('\n');
}

/**
 * Render the retention view as HTML. Plain English copy, same precedent
 * as the Plan R print body and Plan T dialog body (no new i18n keys).
 * Every year row carries its own Export CSV button.
 */
export function retentionViewHtml(view) {
  const years = Array.isArray(view?.years) ? view.years : [];
  if (years.length === 0) {
    return '<div class="retention-view"><h4>Data retention</h4>' +
      '<p>No dated ledger data yet.</p>' +
      `<p>${escapeHtml(view?.policy ?? RETENTION_POLICY)}</p></div>`;
  }
  const rows = years.map((row) => `<tr><td>${escapeHtml(row.year)}</td>` +
    `<td>${escapeHtml(row.customers)}</td>` +
    `<td>${escapeHtml(row.billMonths)}</td>` +
    `<td>${escapeHtml(row.payments)}</td>` +
    `<td>${escapeHtml(row.archivedCustomers)}</td>` +
    `<td>${escapeHtml(row.oldestMonth ?? '—')} – ${escapeHtml(row.newestMonth ?? '—')}</td>` +
    `<td><button type="button" class="secondary-button" data-retention-export-year="${escapeHtml(row.year)}">Export ${escapeHtml(row.year)} CSV</button></td></tr>`).join('');
  return '<div class="retention-view"><h4>Data retention — ledger age by year</h4>' +
    `<p>${escapeHtml(view?.policy ?? RETENTION_POLICY)}</p>` +
    '<table class="retention-table"><thead><tr><th>Year</th><th>Customers</th>' +
    '<th>Bill months</th><th>Payments</th><th>Archived</th><th>Bill months range</th><th>Export</th></tr></thead>' +
    `<tbody>${rows}</tbody></table></div>`;
}
