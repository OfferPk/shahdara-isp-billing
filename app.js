import {
  INITIAL_NAMES, PAYMENT_METHODS, MONTH_LIMIT, readState, persistState, monthsForHistory, generateMonthlyBillsThroughCurrentMonth,
  addCustomer, deleteCustomer, updateCustomerProfile, saveBillMonth, addPayment, correctPayment,
  deletePayment, recordedAmount, customerPackageProfit, calculateDashboard, searchCustomers,
  listTransactions, buildMonthlyReport, effectiveBillStatus, calculatePaymentAllocations, addIncident, updateIncident,
  deleteIncident, countCustomerIncidentsLast30Days, exportAllPayments, exportCustomerHistory
} from './core.js';

const $ = selector => document.querySelector(selector);
const appShell = $('.app-shell');
const customerList = $('#customerList');
const historyContainer = $('#historyContainer');
const transactionList = $('#transactionsList');
const reportList = $('#monthlyReportList');
let storageAvailable = true;
let state;
try {
  state = readState(localStorage);
} catch {
  storageAvailable = false;
  state = {
    version:1,
    nextCustomerNumber:INITIAL_NAMES.length + 1,
    customers:INITIAL_NAMES.map((name, index) => ({ id:`seed-${String(index + 1).padStart(3, '0')}`, customerNumber:index + 1, name, mohalla:'', address:'', phone:'', packageSpeed:'', monthlyPurchaseCost:null, monthlySellingAmount:null, monthlyPriceSchedule:[], bills:[], incidents:[] }))
  };
}
state = generateMonthlyBillsThroughCurrentMonth(state, new Date());
if (storageAvailable) { try { persistState(state, localStorage); } catch { storageAvailable = false; } }
let selectedCustomerId = null;
let selectedReportFilter = 'all';
let toastTimer;
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const localDateTime = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const monthName = month => new Intl.DateTimeFormat(undefined, { month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
const humanDate = date => new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeZone:'UTC' }).format(new Date(`${date}T00:00:00Z`));
const humanLocalDateTime = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : 'Not restored';
const selectedCustomer = () => state.customers.find(customer => customer.id === selectedCustomerId);
const formatAmount = value => Number(value).toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function toast(message) {
  const element = $('#toast'); element.textContent = message; element.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.hidden = true; }, 2600);
}
function searchQuery() { return $('#globalCustomerSearch').value; }
function save() {
  state = generateMonthlyBillsThroughCurrentMonth(state, new Date());
  try { persistState(state, localStorage); storageAvailable = true; }
  catch { storageAvailable = false; toast('Could not save. Check browser storage is available.'); }
  renderDashboard();
  renderGlobalSearch();
  renderCustomers();
  renderTransactions();
  renderMonthlyReport();
}
function checkMonthlyBilling() {
  const updated = generateMonthlyBillsThroughCurrentMonth(state, new Date());
  if (updated !== state) { state = updated; save(); }
}
function renderDashboard() {
  const totals = calculateDashboard(state, new Date());
  $('#dashboardCustomerCount').textContent = totals.totalCustomers;
  $('#dashboardTotalCollection').textContent = formatAmount(totals.totalCollection);
  $('#dashboardTotalDue').textContent = formatAmount(totals.totalDue);
  $('#dashboardTodayCollection').textContent = formatAmount(totals.todayCollection);
  $('#dashboardPreviousCollection').textContent = formatAmount(totals.previousMonthCollection);
  $('#dashboardCurrentMonthDue').textContent = formatAmount(totals.currentMonthDue);
  $('#dashboardExpectedProfit').textContent = formatAmount(totals.expectedMonthlyPackageProfit);
  $('#dashboardTotalCollectionPeriod').textContent = `Actual recorded payments · last ${MONTH_LIMIT} retained billing months`;
  $('#dashboardTotalDuePeriod').textContent = `Known outstanding bills · retained ${MONTH_LIMIT}-month history`;
  $('#dashboardTodayPeriod').textContent = `Actual payments dated today · ${totals.today}`;
  $('#dashboardPreviousPeriod').textContent = `Actual payment dates in ${monthName(totals.previousMonth)}`;
  $('#dashboardCurrentDuePeriod').textContent = `Current billing month · ${monthName(totals.currentMonth)}`;
  $('#dashboardExpectedProfitPeriod').textContent = 'Selling amount − provider cost · expected margin, not collected cash profit';
  const notes = [];
  if (totals.customersMissingSellingAmount) notes.push(`Selling amount unset for ${plural(totals.customersMissingSellingAmount, 'customer')}; no monthly bills are generated until a price is entered.`);
  if (totals.unpricedBillCount) notes.push(`${plural(totals.unpricedBillCount, 'pending bill')} without a recorded amount are excluded from due totals.`);
  if (totals.incompleteProfitProfiles) notes.push(`Profit not set for ${plural(totals.incompleteProfitProfiles, 'profile')} missing a selling amount or provider cost; excluded from expected package profit.`);
  $('#dashboardExcludedAmounts').textContent = notes.length ? notes.join(' ') : 'Dues use each saved month’s bill snapshot after receipts and carry-forward credit; credits are not new cash.';
}
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function renderCustomers() {
  const matches = searchCustomers(state, searchQuery());
  customerList.innerHTML = matches.map(customer => {
    const margin = customerPackageProfit(customer);
    const speed = customer.packageSpeed ? `${escapeHtml(customer.packageSpeed)} · ` : '';
    const profitLabel = margin === null ? 'Expected profit not set' : `Expected monthly profit ${formatAmount(margin)} (not collected cash)`;
    return `<li class="customer-item"><button class="customer-select" type="button" data-customer-id="${escapeHtml(customer.id)}" aria-current="${customer.id === selectedCustomerId}"><span class="avatar" aria-hidden="true">${escapeHtml(initials(customer.name))}</span><span class="customer-copy"><span class="customer-number-line">#${customer.customerNumber}</span><span class="customer-name">${escapeHtml(customer.name)}</span><span class="customer-profit-line">${speed}${escapeHtml(profitLabel)}</span></span><span class="no-record-dot" aria-label="${customer.bills.length ? 'Has billing entries' : 'No billing entries'}"></span></button></li>`;
  }).join('');
  $('#customerCount').textContent = matches.length === state.customers.length ? state.customers.length : `${matches.length}/${state.customers.length}`;
  $('#welcomeCount').textContent = state.customers.length;
  $('#noSearchResults').hidden = matches.length > 0 || state.customers.length === 0;
  customerList.querySelectorAll('[data-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.customerId)));
}
function renderGlobalSearch() {
  const input = $('#globalCustomerSearch');
  const box = $('#globalCustomerResults');
  const options = $('#globalCustomerOptionList');
  const query = input.value.trim();
  if (!query) {
    box.hidden = true;
    options.innerHTML = '';
    $('#globalSearchResultCount').textContent = '';
    input.setAttribute('aria-expanded', 'false');
    $('#globalSearchStatus').textContent = '';
    return;
  }
  const matches = searchCustomers(state, query);
  const shown = matches.slice(0, 12);
  options.innerHTML = shown.map(customer => `<button class="global-result-option" type="button" role="option" aria-selected="false" data-global-customer="${escapeHtml(customer.id)}"><span class="global-result-number">#${customer.customerNumber}</span><span class="global-result-name">${escapeHtml(customer.name)}</span></button>`).join('') || '<div class="global-result-no-match" role="option" aria-disabled="true">No matching customers.</div>';
  $('#globalSearchResultCount').textContent = matches.length ? `Showing ${shown.length} of ${matches.length} ${matches.length === 1 ? 'match' : 'matches'}.` : 'Search includes saved name, phone, address, and customer number.';
  box.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  $('#globalSearchStatus').textContent = `${matches.length} ${matches.length === 1 ? 'customer' : 'customers'} found.`;
  options.querySelectorAll('[data-global-customer]').forEach(button => button.addEventListener('click', () => {
    const customerId = button.dataset.globalCustomer;
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    selectCustomer(customerId);
  }));
}
function switchView(view) {
  const views = { customers:['customersView','showCustomersButton'], transactions:['transactionsView','showTransactionsButton'], reports:['billingReportsView','showReportsButton'] };
  for (const [name, [sectionId, buttonId]] of Object.entries(views)) {
    const active = name === view;
    $(`#${sectionId}`).hidden = !active;
    $(`#${buttonId}`).setAttribute('aria-current', active ? 'page' : 'false');
  }
}
function statusPresentation(customer, bill) {
  if (!bill) return { label:'Not recorded', className:'status-empty', value:'pending' };
  const received = effectiveBillStatus(customer, bill) === 'received';
  return received ? { label:'Received', className:'status-received', value:'received' } : { label:'Pending', className:'status-pending', value:'pending' };
}
function paymentAllocationMarkup(allocation) {
  if (!allocation) return '';
  if (allocation.billUnpriced) return '<span class="payment-allocation">Selected month has no saved bill amount; no excess credit was inferred.</span>';
  const sameMonthCents = allocation.allocations.filter(item => item.kind === 'same-month').reduce((sum,item) => sum + item.amountCents, 0);
  const lines = [`Applied to selected month: ${formatAmount(sameMonthCents / 100)}`];
  for (const item of allocation.allocations.filter(item => item.kind === 'carry-forward')) lines.push(`Auto-credit to ${monthName(item.month)}: ${formatAmount(item.amountCents / 100)} (allocation, not a new receipt)`);
  if (allocation.unappliedCreditCents) lines.push(`Credit waiting for a future generated bill: ${formatAmount(allocation.unappliedCreditCents / 100)}`);
  return `<span class="payment-allocation">${lines.map(escapeHtml).join('<br>')}</span>`;
}
function billAmountAuditMarkup(bill) {
  const changes = bill?.amountHistory ?? [];
  if (!changes.length) return '';
  const items = changes.map(change => `<li>${escapeHtml(humanLocalDateTime(change.changedAt))}: ${change.previousAmount ?? 'Not recorded'} → ${change.newAmount ?? 'Not recorded'}</li>`).join('');
  return `<details class="bill-audit"><summary>Bill amount corrections (${changes.length})</summary><ol>${items}</ol></details>`;
}
function renderHistory(customer) {
  const monthList = monthsForHistory();
  const byMonth = new Map(customer.bills.map(bill => [bill.month, bill]));
  const allocations = calculatePaymentAllocations(state);
  $('#customerEmptyNote').hidden = customer.bills.length > 0;
  historyContainer.innerHTML = monthList.map(month => {
    const bill = byMonth.get(month);
    const status = statusPresentation(customer, bill);
    const received = bill ? recordedAmount(bill) : 0;
    const effectiveAmount = bill?.dueAmount ?? null;
    const displayAmount = effectiveAmount === null || effectiveAmount === undefined ? 'Not recorded' : formatAmount(effectiveAmount);
    const monthAllocation = allocations.forMonth(customer.id, month);
    const balanceDue = monthAllocation?.balanceDueCents === null || monthAllocation?.balanceDueCents === undefined ? 'Not set' : formatAmount(monthAllocation.balanceDueCents / 100);
    const creditApplied = formatAmount((monthAllocation?.creditAppliedCents ?? 0) / 100);
    const activeHistoryMonths = new Set(monthList);
    const creditSourceMarkup = (monthAllocation?.creditSources ?? []).map(source => {
      const aged = !activeHistoryMonths.has(source.originMonth);
      const sourceControls = aged ? `<span class="carry-source-actions"><button class="edit-payment" type="button" data-edit-payment="${escapeHtml(source.paymentId)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(source.originMonth)}" aria-label="Edit aged credit source receipt dated ${escapeHtml(source.paymentDate)}">Edit source receipt</button><button class="delete-payment" type="button" data-delete-payment="${escapeHtml(source.paymentId)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(source.originMonth)}" aria-label="Delete aged credit source receipt dated ${escapeHtml(source.paymentDate)}">Delete source receipt</button></span>` : '';
      return `<div class="carry-credit-source" ${aged ? `data-payment-row="${escapeHtml(source.paymentId)}"` : ''}><span>From ${escapeHtml(monthName(source.originMonth))} receipt dated ${escapeHtml(humanDate(source.paymentDate))} · ${escapeHtml(source.method)} · original receipt ${escapeHtml(formatAmount(source.receiptAmount))} · applied here ${escapeHtml(formatAmount(source.amountCents / 100))}</span>${sourceControls}</div>`;
    }).join('');
    const generatedNote = bill?.generated && bill.priceSnapshot !== null && bill.priceSnapshot !== undefined ? `<p class="bill-snapshot-note">Auto-generated from the saved selling price: ${escapeHtml(formatAmount(bill.priceSnapshot))}. This month’s snapshot stays unchanged if the price is edited later.</p>` : '';
    const payments = (bill?.payments ?? []).map(payment => {
      const allocation = paymentAllocationMarkup(allocations.byPaymentId.get(payment.id));
      return `<li class="payment-row" data-payment-row="${escapeHtml(payment.id)}"><span class="payment-main"><span class="payment-amount">${escapeHtml(formatAmount(payment.amount))} actual receipt</span><span class="payment-meta">${escapeHtml(humanDate(payment.date))} · ${escapeHtml(payment.method)}</span>${allocation}</span><span class="payment-actions"><button class="edit-payment" type="button" data-edit-payment="${escapeHtml(payment.id)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${month}" aria-label="Edit payment for customer ${customer.customerNumber}">Edit</button><button class="delete-payment" type="button" data-delete-payment="${escapeHtml(payment.id)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${month}" aria-label="Delete payment for customer ${customer.customerNumber}">Delete</button></span></li>`;
    }).join('');
    const statusValue = status.value;
    const due = bill?.dueAmount ?? '';
    const hasPartial = statusValue === 'pending' && effectiveAmount !== null && effectiveAmount !== undefined && (received > 0 || (monthAllocation?.creditAppliedCents ?? 0) > 0);
    const summaryMarkup = !bill ? '<p class="empty-month">No billing details recorded for this month.</p>' : `<div class="month-summary"><span>Status: <strong>${status.label}</strong></span><span>Actual receipts (cash): <strong>${formatAmount(received)}</strong></span><span>Carry-in credit (not new cash): <strong>${creditApplied}</strong></span>${creditSourceMarkup}<span>Bill amount: <strong>${escapeHtml(displayAmount)}</strong></span><span>Balance due after receipts and credit: <strong>${escapeHtml(balanceDue)}</strong></span>${monthAllocation?.excessGeneratedCents ? `<span>Credit from this month’s receipts: <strong>${formatAmount(monthAllocation.excessGeneratedCents / 100)}</strong></span>` : ''}${monthAllocation?.creditForwardedCents ? `<span>Credit applied to later bills: <strong>${formatAmount(monthAllocation.creditForwardedCents / 100)}</strong></span>` : ''}${monthAllocation?.pendingCreditCents ? `<span>Credit waiting for the next generated bill: <strong>${formatAmount(monthAllocation.pendingCreditCents / 100)}</strong></span>` : ''}${hasPartial ? '<span class="month-status status-pending">Partial payment / credit</span>' : ''}</div>${generatedNote}${billAmountAuditMarkup(bill)}`;
    const amountRequired = bill ? '' : 'required';
    const amountLabel = bill ? 'Optional' : 'Required to create a bill';
    const amountPlaceholder = bill ? 'Leave blank only if not known' : 'Enter a confirmed bill amount';
    return `<details class="month-card" data-month-card="${month}"><summary><span class="month-label">${escapeHtml(monthName(month))}</span><span class="history-count">${bill ? `${bill.payments?.length ?? 0} payment${bill.payments?.length === 1 ? '' : 's'}` : ''}</span><span class="month-status ${status.className}">${status.label}</span></summary><div class="month-body">${summaryMarkup}<div class="month-forms"><form class="form-card bill-form" data-kind="bill" data-month="${month}"><h4>${bill ? 'Update bill details' : 'Record confirmed bill details'}</h4><div class="form-grid"><label class="field-label full" for="due-${month}">Bill amount <span class="optional-label">${amountLabel}</span></label><input id="due-${month}" class="full" name="dueAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${amountPlaceholder}" value="${escapeHtml(due)}" ${amountRequired}><label class="field-label full" for="status-${month}">Monthly status</label><select id="status-${month}" class="full" name="status"><option value="pending" ${statusValue === 'pending' ? 'selected' : ''}>Pending</option><option value="received" ${statusValue === 'received' ? 'selected' : ''}>Received</option></select><button class="primary-button" type="submit">${bill ? 'Save bill details' : 'Record this month'}</button></div></form><form class="form-card payment-form" data-kind="payment" data-month="${month}"><h4>Record an actual payment</h4><div class="form-grid"><label class="field-label full" for="date-${month}">Payment date</label><input id="date-${month}" class="full" name="date" type="date" value="${localDate()}" required><label class="field-label full" for="amount-${month}">Amount received</label><input id="amount-${month}" class="full" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Enter actual amount" required><label class="field-label full" for="method-${month}">Payment method</label><select id="method-${month}" class="full" name="method" required><option value="">Choose a method</option>${PAYMENT_METHODS.map(method => `<option value="${method}">${method}</option>`).join('')}</select><button class="primary-button" type="submit">Add payment</button></div></form></div><ul class="payment-list" aria-label="Payments for ${escapeHtml(monthName(month))}">${payments}</ul></div></details>`;
  }).join('');
  historyContainer.querySelectorAll('form[data-kind="bill"]').forEach(form => form.addEventListener('submit', onBillSubmit));
  historyContainer.querySelectorAll('form[data-kind="payment"]').forEach(form => form.addEventListener('submit', onPaymentSubmit));
  historyContainer.querySelectorAll('[data-edit-payment]').forEach(button => button.addEventListener('click', () => beginCorrection(button.dataset.customerId, button.dataset.month, button.dataset.editPayment, 'history')));
  historyContainer.querySelectorAll('[data-delete-payment]').forEach(button => button.addEventListener('click', () => requestDeletePayment(button.dataset.customerId, button.dataset.month, button.dataset.deletePayment)));
}
function renderTransactions() {
  const date = $('#transactionDateFilter').value;
  const transactions = listTransactions(state, { customerQuery:searchQuery(), date });
  const total = listTransactions(state).length;
  $('#transactionsCount').textContent = `${transactions.length} of ${total} recorded ${total === 1 ? 'payment' : 'payments'}`;
  $('#transactionsEmpty').hidden = transactions.length > 0;
  transactionList.innerHTML = transactions.map(transaction => {
    const statusText = transaction.status === 'received' ? 'Paid' : 'Pending';
    return `<li class="transaction-card" data-payment-row="${escapeHtml(transaction.paymentId)}"><div class="transaction-data"><div class="transaction-title"><span class="transaction-customer"><span class="transaction-customer-number">#${transaction.customerNumber}</span>${escapeHtml(transaction.customerName)}</span><strong class="transaction-amount">${escapeHtml(formatAmount(transaction.amount))}</strong></div><p class="transaction-meta">Actual payment date: ${escapeHtml(humanDate(transaction.date))} · Method: ${escapeHtml(transaction.method)}</p><p class="transaction-context">Selected bill month: ${escapeHtml(monthName(transaction.month))} · Status: ${statusText}</p>${paymentAllocationMarkup(transaction.allocation)}</div><div class="transaction-actions"><button class="edit-payment" type="button" data-transaction-edit="${escapeHtml(transaction.paymentId)}" data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}">Edit</button><button class="delete-payment" type="button" data-transaction-delete="${escapeHtml(transaction.paymentId)}" data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}">Delete</button></div></li>`;
  }).join('');
  transactionList.querySelectorAll('[data-transaction-edit]').forEach(button => button.addEventListener('click', () => beginCorrection(button.dataset.customerId, button.dataset.month, button.dataset.transactionEdit, 'transactions')));
  transactionList.querySelectorAll('[data-transaction-delete]').forEach(button => button.addEventListener('click', () => requestDeletePayment(button.dataset.customerId, button.dataset.month, button.dataset.transactionDelete)));
}
function reportStatusLabel(status) { return ({ paid:'Paid', unpaid:'Unpaid / Pending', partial:'Partial', 'not-set':'Not set' })[status] ?? 'Not set'; }
function renderMonthlyReport() {
  const month = $('#reportMonth').value || monthsForHistory()[0];
  const rows = buildMonthlyReport(state, { month, statusFilter:selectedReportFilter, customerQuery:searchQuery() });
  $('#monthlyReportCount').textContent = `${rows.length} ${rows.length === 1 ? 'customer' : 'customers'} · ${monthName(month)}`;
  $('#monthlyReportEmpty').hidden = rows.length > 0;
  reportList.innerHTML = rows.map(row => {
    const monthlySale = row.monthlySellingAmount === null || row.monthlySellingAmount === undefined ? 'Not set' : formatAmount(row.monthlySellingAmount);
    const billAmount = row.billAmount === null ? 'Not set' : formatAmount(row.billAmount);
    const due = row.balanceDue === null ? 'Not set' : formatAmount(row.balanceDue);
    const speed = row.packageSpeed || 'Not set';
    const creditSources = row.creditSources.map(source => `${monthName(source.originMonth)} receipt ${humanDate(source.paymentDate)} (${source.method}, ${formatAmount(source.receiptAmount)}): ${formatAmount(source.amountCents / 100)} applied`).join('; ');
    const creditSummary = `Credit in ${formatAmount(row.creditApplied)} · forwarded ${formatAmount(row.creditForwarded)} · waiting ${formatAmount(row.creditPending)}${creditSources ? ` · Sources: ${creditSources}` : ''}`;
    return `<li class="report-row"><div class="report-customer"><span class="customer-number-line">#${row.customerNumber}</span><div class="report-customer-name">${escapeHtml(row.customerName)}</div><span class="report-cell-label">Package / speed: ${escapeHtml(speed)}</span></div><div class="report-cell"><span class="report-cell-label">Monthly sale</span><span class="report-cell-value">${escapeHtml(monthlySale)}</span></div><div class="report-cell"><span class="report-cell-label">${escapeHtml(monthName(row.month))} bill</span><span class="report-cell-value">${escapeHtml(billAmount)}</span></div><div class="report-cell"><span class="report-cell-label">Actual amount received</span><span class="report-cell-value">${escapeHtml(formatAmount(row.amountReceived))}</span></div><div class="report-cell"><span class="report-cell-label">Balance due</span><span class="report-cell-value">${escapeHtml(due)}</span></div><div class="report-cell"><span class="report-cell-label">Auto-credit (not cash)</span><span class="report-credit-value">${escapeHtml(creditSummary)}</span></div><div class="report-cell"><span class="report-cell-label">Status</span><span class="report-status report-status-${row.status}">${reportStatusLabel(row.status)}</span></div></li>`;
  }).join('');
  document.querySelectorAll('[data-report-filter]').forEach(button => button.setAttribute('aria-pressed', button.dataset.reportFilter === selectedReportFilter ? 'true' : 'false'));
}
function populateReportMonths() {
  const months = monthsForHistory();
  $('#reportMonth').innerHTML = months.map(month => `<option value="${month}">${escapeHtml(monthName(month))}</option>`).join('');
  $('#reportMonth').value = months[0];
}
function renderProfileMarginPreview() {
  const sellingText = $('#monthlySellingAmountInput').value.trim();
  const costText = $('#monthlyPurchaseCostInput').value.trim();
  const preview = $('#customerProfitPreview');
  if (!sellingText || !costText) { preview.textContent = 'Expected monthly package profit: Not set until both monthly amounts are entered.'; return; }
  const selling = Number(sellingText); const cost = Number(costText);
  if (!Number.isFinite(selling) || selling <= 0 || !Number.isFinite(cost) || cost < 0) { preview.textContent = 'Enter a selling amount above zero and a provider cost of zero or more.'; return; }
  preview.textContent = `Expected monthly package profit: ${formatAmount(selling - cost)} · expected margin, not collected cash profit.`;
}
function incidentAuditMarkup(incident) {
  const corrections = incident.corrections ?? [];
  if (!corrections.length) return '';
  const items = corrections.map(correction => `<li><strong>${escapeHtml(humanLocalDateTime(correction.recordedAt))}</strong><br>Previous report: ${escapeHtml(humanLocalDateTime(correction.previous.reportedAt))} · offline start: ${escapeHtml(humanLocalDateTime(correction.previous.offlineAt))} · restored: ${escapeHtml(humanLocalDateTime(correction.previous.restoredAt))}<br>Previous note: ${escapeHtml(correction.previous.note || 'Not recorded')}</li>`).join('');
  return `<details class="incident-audit"><summary>Correction history (${corrections.length})</summary><ol>${items}</ol></details>`;
}
function renderIncidents(customer) {
  const incidents = [...(customer.incidents ?? [])].sort((a,b) => b.reportedAt.localeCompare(a.reportedAt) || a.id.localeCompare(b.id));
  $('#incidentCount30Days').textContent = countCustomerIncidentsLast30Days(state, customer.id, new Date());
  $('#incidentEmptyNote').hidden = incidents.length > 0;
  $('#incidentList').innerHTML = incidents.map(incident => {
    const resolved = Boolean(incident.restoredAt);
    return `<li class="incident-card"><div class="incident-card-head"><span class="incident-card-state ${resolved ? 'incident-resolved' : 'incident-open'}">${resolved ? 'Resolved' : 'Open'}</span><span class="incident-reported">Reported ${escapeHtml(humanLocalDateTime(incident.reportedAt))}</span></div><dl class="incident-times"><div><dt>Offline since</dt><dd>${escapeHtml(humanLocalDateTime(incident.offlineAt))}</dd></div><div><dt>Restored online</dt><dd>${escapeHtml(humanLocalDateTime(incident.restoredAt))}</dd></div></dl><p class="incident-note">${escapeHtml(incident.note || 'No complaint or resolution note recorded.')}</p>${incidentAuditMarkup(incident)}<div class="incident-actions"><button class="edit-incident secondary-button" type="button" data-edit-incident="${escapeHtml(incident.id)}">Edit</button><button class="delete-incident" type="button" data-delete-incident="${escapeHtml(incident.id)}">Delete</button></div></li>`;
  }).join('');
  $('#incidentList').querySelectorAll('[data-edit-incident]').forEach(button => button.addEventListener('click', () => showIncidentEditor(incidents.find(item => item.id === button.dataset.editIncident))));
  $('#incidentList').querySelectorAll('[data-delete-incident]').forEach(button => button.addEventListener('click', () => requestDeleteIncident(customer.id, button.dataset.deleteIncident)));
}
function renderDetail() {
  const customer = selectedCustomer();
  $('#welcomeState').hidden = !!customer;
  $('#customerDetail').hidden = !customer;
  if (!customer) return;
  $('#detailCustomerNumber').textContent = `Customer #${customer.customerNumber}`;
  $('#detailName').textContent = customer.name;
  $('#mohallaInput').value = customer.mohalla ?? '';
  $('#addressInput').value = customer.address ?? '';
  $('#phoneInput').value = customer.phone ?? '';
  $('#packageSpeedInput').value = customer.packageSpeed ?? '';
  $('#monthlyPurchaseCostInput').value = customer.monthlyPurchaseCost ?? '';
  $('#monthlySellingAmountInput').value = customer.monthlySellingAmount ?? '';
  renderProfileMarginPreview();
  renderIncidents(customer);
  renderHistory(customer);
}
function selectCustomer(id) {
  if (!state.customers.some(customer => customer.id === id)) return;
  switchView('customers');
  selectedCustomerId = id;
  appShell.classList.add('show-detail');
  renderCustomers();
  renderDetail();
  $('#detailPane').scrollTop = 0;
  window.scrollTo(0, 0);
}
function downloadTxt(filename, text) {
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
function onBillSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form);
  try { state = saveBillMonth(state, selectedCustomerId, { month:form.dataset.month, dueAmount:data.get('dueAmount') || null, status:data.get('status') }); save(); renderDetail(); toast('Bill details saved on this device.'); }
  catch (error) { toast(error.message); }
}
function onPaymentSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form);
  try { state = addPayment(state, selectedCustomerId, form.dataset.month, { date:data.get('date'), amount:data.get('amount'), method:data.get('method') }); save(); renderDetail(); toast('Payment recorded on this device.'); }
  catch (error) { toast(error.message); }
}
function correctionForm(payment, customerId, month, origin) {
  const options = PAYMENT_METHODS.map(method => `<option value="${method}" ${method === payment.method ? 'selected' : ''}>${method}</option>`).join('');
  return `<form class="payment-form editing" data-kind="correct" data-origin="${origin}" data-customer-id="${escapeHtml(customerId)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}"><div class="form-grid"><label class="field-label full" for="edit-date-${escapeHtml(payment.id)}">Payment date</label><input id="edit-date-${escapeHtml(payment.id)}" class="full" name="date" type="date" value="${escapeHtml(payment.date)}" required><label class="field-label full" for="edit-amount-${escapeHtml(payment.id)}">Amount received</label><input id="edit-amount-${escapeHtml(payment.id)}" class="full" name="amount" type="number" min="0.01" step="0.01" value="${escapeHtml(payment.amount)}" required><label class="field-label full" for="edit-method-${escapeHtml(payment.id)}">Payment method</label><select id="edit-method-${escapeHtml(payment.id)}" class="full" name="method">${options}</select><button class="primary-button" type="submit">Save correction</button><button class="secondary-button full" type="button" data-cancel-correction>Cancel</button></div></form>`;
}
function beginCorrection(customerId, month, paymentId, origin) {
  const customer = state.customers.find(item => item.id === customerId);
  const payment = customer?.bills.find(bill => bill.month === month)?.payments.find(item => item.id === paymentId);
  if (!payment) return;
  const host = origin === 'history' ? historyContainer : transactionList;
  const row = host.querySelector(`[data-payment-row="${CSS.escape(paymentId)}"]`);
  if (!row) return;
  row.innerHTML = correctionForm(payment, customerId, month, origin);
  const form = row.querySelector('form');
  form.addEventListener('submit', onCorrectionSubmit);
  form.querySelector('[data-cancel-correction]').addEventListener('click', () => origin === 'history' ? renderDetail() : renderTransactions());
}
function onCorrectionSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form);
  try {
    state = correctPayment(state, form.dataset.customerId, form.dataset.month, form.dataset.paymentId, { date:data.get('date'), amount:data.get('amount'), method:data.get('method') });
    save();
    if (selectedCustomerId === form.dataset.customerId) renderDetail();
    toast('Payment correction saved on this device.');
  } catch (error) { toast(error.message); }
}
function requestDeletePayment(customerId, month, paymentId) {
  const customer = state.customers.find(item => item.id === customerId);
  const payment = customer?.bills.find(bill => bill.month === month)?.payments.find(item => item.id === paymentId);
  if (!customer || !payment) return;
  const confirmed = window.confirm(`Delete the ${formatAmount(payment.amount)} payment dated ${payment.date} for customer #${customer.customerNumber} ${customer.name}? It will be removed from this device's history, totals and exports.`);
  if (!confirmed) return;
  try {
    state = deletePayment(state, customerId, month, paymentId);
    save();
    if (selectedCustomerId === customerId) renderDetail();
    toast('Payment deleted from this device.');
  } catch (error) { toast(error.message); }
}
function showIncidentEditor(incident = null) {
  const form = $('#incidentForm');
  $('#incidentFormError').hidden = true;
  $('#incidentIdInput').value = incident?.id ?? '';
  $('#incidentReportedAtInput').value = incident?.reportedAt ?? localDateTime();
  $('#incidentOfflineAtInput').value = incident?.offlineAt ?? localDateTime();
  $('#incidentRestoredAtInput').value = incident?.restoredAt ?? '';
  $('#incidentNoteInput').value = incident?.note ?? '';
  $('#incidentSubmitButton').textContent = incident ? 'Save correction' : 'Save incident';
  $('#addIncidentButton').hidden = true;
  form.hidden = false;
  form.scrollIntoView({ behavior:'smooth', block:'nearest' });
  $('#incidentReportedAtInput').focus();
}
function closeIncidentEditor() {
  $('#incidentForm').hidden = true;
  $('#addIncidentButton').hidden = false;
  $('#incidentFormError').hidden = true;
}
function onIncidentSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form);
  const fields = { reportedAt:data.get('reportedAt'), offlineAt:data.get('offlineAt'), restoredAt:data.get('restoredAt'), note:data.get('note') };
  try {
    if (data.get('incidentId')) state = updateIncident(state, selectedCustomerId, data.get('incidentId'), fields);
    else state = addIncident(state, selectedCustomerId, fields);
    closeIncidentEditor();
    save(); renderDetail();
    toast(data.get('incidentId') ? 'Incident correction saved with local history.' : 'Incident saved on this device.');
  } catch (error) {
    const errorBox = $('#incidentFormError'); errorBox.textContent = error.message; errorBox.hidden = false;
  }
}
function requestDeleteIncident(customerId, incidentId) {
  const customer = state.customers.find(item => item.id === customerId);
  const incident = customer?.incidents.find(item => item.id === incidentId);
  if (!customer || !incident) return;
  if (!window.confirm(`Delete this ${incident.restoredAt ? 'resolved' : 'open'} complaint/outage for customer #${customer.customerNumber} ${customer.name}? It and its correction history will be removed from this device, its 30-day count, and customer export.`)) return;
  try { state = deleteIncident(state, customerId, incidentId); save(); if (selectedCustomerId === customerId) renderDetail(); toast('Incident deleted from this device.'); }
  catch (error) { toast(error.message); }
}

$('#globalCustomerSearch').addEventListener('input', () => { renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); });
$('#globalCustomerSearch').addEventListener('focus', () => { if (searchQuery().trim()) renderGlobalSearch(); });
$('#clearGlobalSearch').addEventListener('click', () => { $('#globalCustomerSearch').value = ''; renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); $('#globalCustomerSearch').focus(); });
$('#showCustomersButton').addEventListener('click', () => switchView('customers'));
$('#showTransactionsButton').addEventListener('click', () => { switchView('transactions'); renderTransactions(); });
$('#showReportsButton').addEventListener('click', () => { switchView('reports'); renderMonthlyReport(); });
$('#transactionDateFilter').addEventListener('input', renderTransactions);
$('#clearTransactionFilters').addEventListener('click', () => { $('#transactionDateFilter').value = ''; $('#globalCustomerSearch').value = ''; renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); });
$('#reportMonth').addEventListener('change', renderMonthlyReport);
document.querySelectorAll('[data-report-filter]').forEach(button => button.addEventListener('click', () => { selectedReportFilter = button.dataset.reportFilter; renderMonthlyReport(); }));
$('#addCustomerButton').addEventListener('click', () => { $('#addCustomerError').hidden = true; $('#newCustomerName').value = ''; $('#addCustomerDialog').showModal(); $('#newCustomerName').focus(); });
$('#addCustomerForm').addEventListener('submit', event => {
  event.preventDefault();
  try {
    state = addCustomer(state, $('#newCustomerName').value);
    $('#globalCustomerSearch').value = '';
    save(); $('#addCustomerDialog').close(); selectCustomer(state.customers.at(-1).id); toast(`Customer #${state.customers.at(-1).customerNumber} added.`);
  } catch (error) { const errorBox = $('#addCustomerError'); errorBox.textContent = error.message; errorBox.hidden = false; }
});
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $('#addCustomerDialog').close()));
$('#saveMohallaButton').addEventListener('click', () => {
  if (!selectedCustomer()) return;
  try {
    state = updateCustomerProfile(state, selectedCustomerId, {
      mohalla:$('#mohallaInput').value, address:$('#addressInput').value, phone:$('#phoneInput').value,
      packageSpeed:$('#packageSpeedInput').value, monthlyPurchaseCost:$('#monthlyPurchaseCostInput').value,
      monthlySellingAmount:$('#monthlySellingAmountInput').value
    });
    save(); renderDetail(); toast('Customer profile saved on this device.');
  } catch (error) { toast(error.message); }
});
$('#monthlyPurchaseCostInput').addEventListener('input', renderProfileMarginPreview);
$('#monthlySellingAmountInput').addEventListener('input', renderProfileMarginPreview);
$('#deleteCustomerButton').addEventListener('click', () => {
  const customer = selectedCustomer();
  if (!customer || !window.confirm(`Delete customer #${customer.customerNumber} ${customer.name} and all billing/complaint history stored for this customer on this device?`)) return;
  state = deleteCustomer(state, selectedCustomerId); selectedCustomerId = null; appShell.classList.remove('show-detail'); save(); renderDetail(); toast('Customer deleted from this device.');
});
$('#addIncidentButton').addEventListener('click', () => showIncidentEditor());
$('#incidentForm').addEventListener('submit', onIncidentSubmit);
$('#cancelIncidentEditButton').addEventListener('click', () => { closeIncidentEditor(); renderDetail(); });
$('#customerExportButton').addEventListener('click', () => { const customer = selectedCustomer(); if (customer) downloadTxt(`customer-${customer.customerNumber}-billing-history.txt`, exportCustomerHistory(state, customer.id)); });
$('#exportAllButton').addEventListener('click', () => downloadTxt('shahdara-isp-payment-details.txt', exportAllPayments(state)));
$('#backButton').addEventListener('click', () => { appShell.classList.remove('show-detail'); });
window.addEventListener('resize', () => { if (window.innerWidth > 620) appShell.classList.remove('show-detail'); });
window.addEventListener('focus', checkMonthlyBilling);
window.addEventListener('pageshow', checkMonthlyBilling);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkMonthlyBilling(); });
window.setInterval(checkMonthlyBilling, 60_000);

populateReportMonths();
renderDashboard();
renderGlobalSearch();
renderCustomers();
renderTransactions();
renderMonthlyReport();
renderDetail();
if (!storageAvailable) toast('Browser storage is unavailable. Entries may not persist.');
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
