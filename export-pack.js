// Plan 32 (Plan 1-100) — Accountant and portability data export pack.
//
// Figures for an accountant, or for moving to another tool one day,
// can only be copied screen by screen, so totals get mistyped and
// history is left behind. This module builds one offline export pack
// on demand: customers, bills, payments, Waada records, and expenses
// as plain CSV rows plus one JSON document, all stamped with a single
// export date, so the accountant gets the same figures the ledger
// already holds — no re-typing, no re-deriving.
//
// Scope fence, stated plainly:
//   - This is a data export only. It never writes, edits, voids, or
//     deletes any record, never changes any money total, and never
//     creates a record by exporting. Re-importing is out of scope:
//     there is no import helper here.
//   - It is NOT Plan J's backup verification (no backup is produced,
//     verified, or restored here) and NOT Plan R's owner report pack
//     (no presentation, no new metric, no composed report document).
//     The pack is the raw rows plus their totals and counts.
//   - It is import-free (like audit-log.js and campaign-planner.js):
//     the caller supplies every record and the module never reads
//     storage, the clock, or the network, and never mutates an input.
//   - Every exported row carries its customer reference: bill,
//     payment, and Waada rows carry the customer id and name; expense
//     rows are business-level, so they carry an empty customer id
//     unless the expense itself names a customer — the field is
//     always present, never silently dropped.
//   - Amounts are summed only when they are finite numbers (numeric
//     strings accepted, as the ledger stores some amounts as text).
//     A non-finite amount is never counted as zero: the row keeps a
//     null amount, is excluded from the total, and is counted in
//     `excluded` so the accountant can see something was left out.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). The pack's date range is derived
//     from the dated rows it actually contains (payment dates,
//     expense dates, Waada dates); bill months are reported
//     separately as a month range, never converted into dates.
//   - Voided payments are exported and flagged, but never counted
//     in the collected total: `paymentTotal` is non-voided only,
//     and `voidedTotal` is shown separately, so the two never blend.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validExportDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

function finiteAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function customerNameOf(customer) {
  return text(customer.name) || text(customer.customerName) || '';
}

function customerIdOf(customer) {
  return text(customer.id) || text(customer.customerId) || '';
}

function sortRows(rows, compare) {
  return [...rows].sort(compare);
}

export const EXPORT_PACK_SECTIONS = Object.freeze([
  'customers',
  'bills',
  'payments',
  'waadas',
  'expenses',
]);

function buildCustomerRows(customers) {
  const rows = [];
  let excluded = 0;
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object') { excluded += 1; continue; }
    const id = customerIdOf(customer);
    if (!id) { excluded += 1; continue; }
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    let paymentCount = 0;
    for (const bill of bills) {
      if (bill && Array.isArray(bill.payments)) paymentCount += bill.payments.length;
    }
    rows.push({
      customerId: id,
      customerName: customerNameOf(customer),
      phone: text(customer.phone) || text(customer.billingPhone) || '',
      mohalla: text(customer.mohalla) || text(customer.area) || '',
      package: text(customer.packageSpeed) || text(customer.package) || '',
      monthlyAmount: finiteAmount(customer.monthlySellingAmount ?? customer.monthlyAmount),
      archived: customer.archived === true,
      billCount: bills.length,
      paymentCount,
    });
  }
  return { rows: sortRows(rows, (a, b) => a.customerName.localeCompare(b.customerName) || a.customerId.localeCompare(b.customerId)), excluded };
}

function buildBillRows(customers) {
  const rows = [];
  let excluded = 0;
  let total = 0;
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object') continue;
    const id = customerIdOf(customer);
    if (!id) continue;
    for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
      if (!bill || typeof bill !== 'object' || !text(bill.month)) { excluded += 1; continue; }
      const amount = finiteAmount(bill.dueAmount ?? bill.amount);
      if (amount !== null) total += amount;
      else excluded += 1;
      rows.push({
        customerId: id,
        customerName: customerNameOf(customer),
        month: text(bill.month),
        dueAmount: amount,
        dueDate: validExportDate(bill.dueDate) ?? '',
        paymentCount: Array.isArray(bill.payments) ? bill.payments.length : 0,
      });
    }
  }
  return {
    rows: sortRows(rows, (a, b) => a.customerId.localeCompare(b.customerId) || a.month.localeCompare(b.month)),
    total: Math.round(total * 100) / 100,
    excluded,
  };
}

function buildPaymentRows(customers) {
  const rows = [];
  let excluded = 0;
  let total = 0;
  let voidedTotal = 0;
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object') continue;
    const id = customerIdOf(customer);
    if (!id) continue;
    for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of Array.isArray(bill.payments) ? bill.payments : []) {
        if (!payment || typeof payment !== 'object') { excluded += 1; continue; }
        const amount = finiteAmount(payment.amount);
        const voided = payment.voided === true;
        if (amount !== null) {
          if (voided) voidedTotal += amount;
          else total += amount;
        } else {
          excluded += 1;
        }
        rows.push({
          customerId: id,
          customerName: customerNameOf(customer),
          billMonth: text(bill.month),
          date: validExportDate(payment.date) ?? '',
          amount,
          method: text(payment.method),
          transactionId: text(payment.transactionId),
          voided,
        });
      }
    }
  }
  return {
    rows: sortRows(rows, (a, b) => (a.date || '').localeCompare(b.date || '') || a.customerId.localeCompare(b.customerId)),
    total: Math.round(total * 100) / 100,
    voidedTotal: Math.round(voidedTotal * 100) / 100,
    excluded,
  };
}

function buildWaadaRows(customers) {
  const rows = [];
  let total = 0;
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object') continue;
    const id = customerIdOf(customer);
    if (!id) continue;
    const date = text(customer.promiseDate);
    const amount = finiteAmount(customer.promiseAmount);
    const note = text(customer.promiseNote);
    if (!date && amount === null && !note) continue;
    if (amount !== null) total += amount;
    rows.push({
      customerId: id,
      customerName: customerNameOf(customer),
      promiseDate: validExportDate(date) ?? '',
      promiseAmount: amount,
      promiseNote: note,
    });
  }
  return {
    rows: sortRows(rows, (a, b) => (a.promiseDate || '').localeCompare(b.promiseDate || '') || a.customerId.localeCompare(b.customerId)),
    total: Math.round(total * 100) / 100,
  };
}

function buildExpenseRows(expenses) {
  const rows = [];
  let excluded = 0;
  let total = 0;
  for (const expense of Array.isArray(expenses) ? expenses : []) {
    if (!expense || typeof expense !== 'object') { excluded += 1; continue; }
    const amount = finiteAmount(expense.amount);
    if (amount !== null) total += amount;
    else excluded += 1;
    rows.push({
      expenseId: text(expense.id) || '',
      customerId: text(expense.customerId) || '',
      date: validExportDate(expense.date) ?? '',
      amount,
      category: text(expense.category),
      notes: text(expense.notes) || text(expense.note) || '',
    });
  }
  return {
    rows: sortRows(rows, (a, b) => (a.date || '').localeCompare(b.date || '') || a.expenseId.localeCompare(b.expenseId)),
    total: Math.round(total * 100) / 100,
    excluded,
  };
}

export function buildExportPack({ customers = [], expenses = [], exportDate = '' } = {}) {
  const customerPart = buildCustomerRows(customers);
  const billPart = buildBillRows(customers);
  const paymentPart = buildPaymentRows(customers);
  const waadaPart = buildWaadaRows(customers);
  const expensePart = buildExpenseRows(expenses);

  const dated = [];
  for (const row of paymentPart.rows) if (row.date) dated.push(row.date);
  for (const row of expensePart.rows) if (row.date) dated.push(row.date);
  for (const row of waadaPart.rows) if (row.promiseDate) dated.push(row.promiseDate);
  dated.sort();
  const months = billPart.rows.map((row) => row.month).sort();

  return {
    exportDate: validExportDate(exportDate),
    dateRange: dated.length > 0 ? { start: dated[0], end: dated[dated.length - 1] } : null,
    billMonthRange: months.length > 0 ? { first: months[0], last: months[months.length - 1] } : null,
    counts: {
      customers: customerPart.rows.length,
      bills: billPart.rows.length,
      payments: paymentPart.rows.length,
      waadas: waadaPart.rows.length,
      expenses: expensePart.rows.length,
    },
    excluded: {
      customers: customerPart.excluded,
      bills: billPart.excluded,
      payments: paymentPart.excluded,
      expenses: expensePart.excluded,
    },
    totals: {
      billTotal: billPart.total,
      paymentTotal: paymentPart.total,
      voidedPaymentTotal: paymentPart.voidedTotal,
      waadaTotal: waadaPart.total,
      expenseTotal: expensePart.total,
    },
    customers: customerPart.rows,
    bills: billPart.rows,
    payments: paymentPart.rows,
    waadas: waadaPart.rows,
    expenses: expensePart.rows,
  };
}

export function exportPackSummaryText(pack) {
  if (!pack) return 'No export pack built yet.';
  const { counts, totals } = pack;
  const range = pack.dateRange ? `${pack.dateRange.start} to ${pack.dateRange.end}` : 'no dated rows';
  return `Export ${pack.exportDate ?? 'date not recorded'} · ${range} · ${counts.customers} customers, ${counts.bills} bills (PKR ${totals.billTotal.toLocaleString()}), ${counts.payments} payments (PKR ${totals.paymentTotal.toLocaleString()} collected, PKR ${totals.voidedPaymentTotal.toLocaleString()} voided), ${counts.waadas} Waada records, ${counts.expenses} expenses (PKR ${totals.expenseTotal.toLocaleString()}). Re-importing is out of scope; exporting creates no record.`;
}

function escapeExportHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function exportPackHtml(pack) {
  if (!pack) return '<p class="empty-state">No export pack built yet.</p>';
  const { counts, totals } = pack;
  const range = pack.dateRange ? `${pack.dateRange.start} to ${pack.dateRange.end}` : 'No dated rows';
  const months = pack.billMonthRange ? `${pack.billMonthRange.first} to ${pack.billMonthRange.last}` : 'No bills';
  return `<table class="export-pack-table"><thead><tr><th>Section</th><th>Rows</th><th>Total</th></tr></thead><tbody>`
    + `<tr><td>Customers</td><td>${counts.customers}</td><td>—</td></tr>`
    + `<tr><td>Bills (${escapeExportHtml(months)})</td><td>${counts.bills}</td><td>PKR ${totals.billTotal.toLocaleString()}</td></tr>`
    + `<tr><td>Payments</td><td>${counts.payments}</td><td>PKR ${totals.paymentTotal.toLocaleString()} collected · PKR ${totals.voidedPaymentTotal.toLocaleString()} voided</td></tr>`
    + `<tr><td>Waada records</td><td>${counts.waadas}</td><td>PKR ${totals.waadaTotal.toLocaleString()}</td></tr>`
    + `<tr><td>Expenses</td><td>${counts.expenses}</td><td>PKR ${totals.expenseTotal.toLocaleString()}</td></tr>`
    + `</tbody></table><p>Date range: ${escapeExportHtml(range)} · Export date: ${escapeExportHtml(pack.exportDate ?? 'Not recorded')} · Re-importing is out of scope; exporting creates no record.</p>`;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const textValue = String(value);
  return /[",\n]/.test(textValue) ? `"${textValue.replaceAll('"', '""')}"` : textValue;
}

function rowsToCsv(header, rows, pick) {
  return [header, ...rows.map((row) => pick(row).map(csvCell).join(','))].join('\n');
}

export function exportPackCsv(pack, section) {
  if (!pack) return '';
  switch (section) {
    case 'customers':
      return rowsToCsv('customerId,customerName,phone,mohalla,package,monthlyAmount,archived,billCount,paymentCount', pack.customers, (r) => [r.customerId, r.customerName, r.phone, r.mohalla, r.package, r.monthlyAmount, r.archived ? 'yes' : 'no', r.billCount, r.paymentCount]);
    case 'bills':
      return rowsToCsv('customerId,customerName,month,dueAmount,dueDate,paymentCount', pack.bills, (r) => [r.customerId, r.customerName, r.month, r.dueAmount, r.dueDate, r.paymentCount]);
    case 'payments':
      return rowsToCsv('customerId,customerName,billMonth,date,amount,method,transactionId,voided', pack.payments, (r) => [r.customerId, r.customerName, r.billMonth, r.date, r.amount, r.method, r.transactionId, r.voided ? 'yes' : 'no']);
    case 'waadas':
      return rowsToCsv('customerId,customerName,promiseDate,promiseAmount,promiseNote', pack.waadas, (r) => [r.customerId, r.customerName, r.promiseDate, r.promiseAmount, r.promiseNote]);
    case 'expenses':
      return rowsToCsv('expenseId,customerId,date,amount,category,notes', pack.expenses, (r) => [r.expenseId, r.customerId, r.date, r.amount, r.category, r.notes]);
    case 'manifest':
      return rowsToCsv('key,value', [
        ['exportDate', pack.exportDate ?? ''],
        ['dateRangeStart', pack.dateRange?.start ?? ''],
        ['dateRangeEnd', pack.dateRange?.end ?? ''],
        ['billMonthFirst', pack.billMonthRange?.first ?? ''],
        ['billMonthLast', pack.billMonthRange?.last ?? ''],
        ['customers', pack.counts.customers],
        ['bills', pack.counts.bills],
        ['payments', pack.counts.payments],
        ['waadas', pack.counts.waadas],
        ['expenses', pack.counts.expenses],
        ['billTotal', pack.totals.billTotal],
        ['paymentTotal', pack.totals.paymentTotal],
        ['voidedPaymentTotal', pack.totals.voidedPaymentTotal],
        ['waadaTotal', pack.totals.waadaTotal],
        ['expenseTotal', pack.totals.expenseTotal],
      ], (r) => r);
    default:
      return '';
  }
}

export function exportPackJson(pack) {
  return JSON.stringify(pack ?? null, null, 2);
}

export function exportPackFilename(section, exportDate) {
  const date = validExportDate(exportDate) ?? 'undated';
  if (section === 'json') return `export-pack-${date}.json`;
  return `export-pack-${section}-${date}.csv`;
}
