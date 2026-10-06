import {
  INITIAL_NAMES, PAYMENT_METHODS, MONTH_LIMIT, readState, persistState, monthsForHistory, generateMonthlyBillsThroughCurrentMonth,
  addCustomer, deleteCustomer, archiveCustomer, unarchiveCustomer, updateCustomerProfile, saveBillMonth, addPayment, correctPayment,
  deletePayment, recordedAmount, customerPackageProfit, calculateDashboard, searchCustomers, filterCustomersByStatus, derivedBillStatus,
  listTransactions, buildMonthlyReport, effectiveBillStatus, calculatePaymentAllocations, buildPayrollSummary, addIncident, updateIncident,
  deleteIncident, countCustomerIncidentsLast30Days, exportAllPayments, exportCustomerHistory, formatPKR, createJsonBackup, previewJsonBackupMerge, PAKISTAN_TIME_ZONE,
  summarizeCustomerReceipts, summarizeCustomerTenure
} from './core.js?v=1.4.3';
import {
  EXPENSE_CATEGORIES, INVENTORY_STATES, PAYROLL_RULES_EFFECTIVE_DATE, UMAIR_PER_LOGGED_WORKDAY,
  addInventoryItem, updateInventoryItem, addStockMovement, deleteStockMovement, addSaadAttendanceDay, removeSaadAttendanceDay,
  addUmairWorkday, removeUmairWorkday, inventorySummary, addExpense, updateExpense, deleteExpense, buildPhase3Analytics, areaLabel
} from './phase3.js?v=1.4.3';
import { manualServiceStatusLabel, profileArchiveLabel } from './profile-labels.js?v=1.4.3';
import { currentBillPresentation, contactActionTargets, buildGlobalLedgerSearch, resolveReceiptWhatsAppAction } from './profile-ui.js?v=1.4.3';

const $ = selector => document.querySelector(selector);
const appShell = $('.app-shell');
const customerList = $('#customerList');
const historyContainer = $('#historyContainer');
const transactionList = $('#transactionsList');
const reportList = $('#monthlyReportList');
let storageAvailable = true;
let persistenceBlocked = false;
let readFailureMessage = '';
let state;
try {
  state = readState(localStorage);
} catch (error) {
  storageAvailable = false;
  persistenceBlocked = true;
  readFailureMessage = error?.message ?? 'Saved data could not be read.';
  state = {
    version:1,
    nextCustomerNumber:INITIAL_NAMES.length + 1,
    customers:INITIAL_NAMES.map((name, index) => ({ id:`seed-${String(index + 1).padStart(3, '0')}`, customerNumber:index + 1, name, mohalla:'', zone:'', address:'', phone:'', ispProvider:'', serviceStatus:'not-set', packageSpeed:'', monthlyPurchaseCost:null, monthlySellingAmount:null, monthlyPriceSchedule:[], billingStartMonth:null, connectionDate:null, expiryDate:null, cancellationDate:null, packageHistory:[], archived:false, archivedAt:null, bills:[], incidents:[] })), inventoryItems:[], inventoryMovements:[], expenses:[],saadAttendanceDays:[],umairWorkdays:[]
  };
}
state = generateMonthlyBillsThroughCurrentMonth(state, new Date());
if (storageAvailable) { try { persistState(state, localStorage); } catch { storageAvailable = false; } }
let selectedCustomerId = null;
let profileEditMode = false;
let selectedProfileTab = 'billing';
let selectedReportFilter = 'all';
let selectedServiceFilter = 'all';
let selectedBillingFilter = 'all';
let selectedBillingMonth = monthsForHistory()[0];
let selectedPayrollMonth = monthsForHistory()[0];
let pendingBackupPreview = null;
let toastTimer;
const zonedDateTimeParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:PAKISTAN_TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type,part.value]));
const localDate = (date = new Date()) => { const p=zonedDateTimeParts(date); return `${p.year}-${p.month}-${p.day}`; };
const localDateTime = (date = new Date()) => { const p=zonedDateTimeParts(date); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const monthName = month => new Intl.DateTimeFormat(undefined, { month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
const humanDate = date => new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeZone:PAKISTAN_TIME_ZONE }).format(new Date(`${date}T00:00:00Z`));
const humanLocalDateTime = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeStyle:'short', timeZone:PAKISTAN_TIME_ZONE }).format(new Date(`${value}:00+05:00`)) : 'Not restored';
const selectedCustomer = () => state.customers.find(customer => customer.id === selectedCustomerId);
const formatAmount = formatPKR;
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
function paidByFieldMarkup(inputId, value = '') {
  const id = escapeHtml(inputId);
  return `<label class="field-label full" for="${id}">Paid by (optional)</label><input id="${id}" class="full" name="paidBy" type="text" maxlength="100" autocomplete="off" placeholder="Leave blank if not specified" value="${escapeHtml(value)}">`;
}
function paymentPayerMarkup(payment) {
  const paidBy = String(payment?.paidBy ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 100);
  return paidBy ? ` · Paid by: ${escapeHtml(paidBy)}` : '';
}

const profileTabMap = {
  billing:['profileTabBilling','profilePanelBilling'],
  info:['profileTabInfo','profilePanelInfo'],
  complaints:['profileTabComplaints','profilePanelComplaints']
};
function mountCustomerProfileContent() {
  const mounts = $('#profileContentMounts');
  if (!mounts) return;
  const groups = {
    billing:['#customerReceiptSummary','.ledger-heading','.history-retention-note','#customerEmptyNote','#historyContainer'],
    info:['.customer-meta','.package-history-section'],
    complaints:['.incident-section']
  };
  for (const [name, selectors] of Object.entries(groups)) {
    const panel = $(`#${profileTabMap[name][1]}`);
    for (const selector of selectors) {
      const element = mounts.querySelector(selector);
      if (element) panel.append(element);
    }
  }
  mounts.remove();
}
function activateProfileTab(name, focus = false) {
  if (!profileTabMap[name]) return;
  selectedProfileTab = name;
  for (const [tabName, [tabId,panelId]] of Object.entries(profileTabMap)) {
    const active = tabName === name;
    const tab = $(`#${tabId}`);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.tabIndex = active ? 0 : -1;
    $(`#${panelId}`).hidden = !active;
  }
  if (focus) $(`#${profileTabMap[name][0]}`).focus();
}
mountCustomerProfileContent();

function toast(message) {
  const element = $('#toast'); element.textContent = message; element.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.hidden = true; }, 2600);
}
function searchQuery() { return $('#globalCustomerSearch').value; }
function customerListQuery() { return $('#customerListSearch').value.trim() || searchQuery(); }
function save() {
  state = generateMonthlyBillsThroughCurrentMonth(state, new Date());
  if (persistenceBlocked) {
    toast('Saved data could not be read. No changes were written; use a valid JSON backup to recover it.');
    renderStorageWarning(); renderDashboard(); renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); renderPhase3();
    return false;
  }
  try { persistState(state, localStorage); storageAvailable = true; }
  catch { storageAvailable = false; toast('Could not save. Check browser storage is available.'); }
  renderDashboard();
  renderGlobalSearch();
  renderCustomers();
  renderTransactions();
  renderMonthlyReport();
  renderPhase3();
  renderStorageWarning();
  return storageAvailable;
}
function checkMonthlyBilling() {
  const updated = generateMonthlyBillsThroughCurrentMonth(state, new Date());
  if (updated !== state) { state = updated; save(); }
}
function renderDashboard() {
  const referenceDate = new Date();
  const totals = calculateDashboard(state, referenceDate);
  const retainedMonths = new Set(monthsForHistory(referenceDate));
  const allBillRows = state.customers.flatMap(customer => (customer.bills ?? []).map(bill => ({ bill })));
  const retainedBills = allBillRows.filter(({bill}) => retainedMonths.has(bill.month));
  const pricedRetainedBills = retainedBills.filter(({bill}) => bill.dueAmount !== null && bill.dueAmount !== undefined && bill.dueAmount !== '' && Number(bill.dueAmount) > 0);
  const currentBills = allBillRows.filter(({bill}) => bill.month === totals.currentMonth);
  const pricedCurrentBills = currentBills.filter(({bill}) => bill.dueAmount !== null && bill.dueAmount !== undefined && bill.dueAmount !== '' && Number(bill.dueAmount) > 0);
  const retainedPayments = retainedBills.flatMap(({bill}) => bill.payments ?? []);
  const allPayments = allBillRows.flatMap(({bill}) => bill.payments ?? []);
  const todayPayments = allPayments.filter(payment => payment.date === totals.today).length;
  const previousMonthPayments = allPayments.filter(payment => typeof payment.date === 'string' && payment.date.slice(0,7) === totals.previousMonth).length;
  const profilesWithCost = totals.providerCostBreakdown.reduce((sum,group) => sum + group.profilesWithCost, 0);
  const profilesWithProfit = state.customers.filter(customer => !customer.archived && customerPackageProfit(customer) !== null).length;
  $('#dashboardCustomerCount').textContent = totals.totalCustomers;
  $('#serviceCountActive').textContent = totals.activeServiceCount;
  $('#serviceCountOffline').textContent = totals.offlineServiceCount;
  $('#serviceCountNotSet').textContent = totals.unsetServiceCount;
  document.querySelector('[data-customer-service-filter="active"]').setAttribute('aria-label',`Filter by manual service status Active (${totals.activeServiceCount} unarchived)`);
  document.querySelector('[data-customer-service-filter="offline"]').setAttribute('aria-label',`Filter by manual service status Offline (${totals.offlineServiceCount} unarchived)`);
  document.querySelector('[data-customer-service-filter="not-set"]').setAttribute('aria-label',`Filter by manual service status Not set (${totals.unsetServiceCount} unarchived)`);
  $('#serviceStateCountsAnnouncement').textContent = `Manual service counts, excluding archived profiles: Active ${totals.activeServiceCount} · Offline ${totals.offlineServiceCount} · Not set ${totals.unsetServiceCount}`;
  $('#dashboardTotalCollection').textContent = retainedPayments.length ? formatAmount(totals.totalCollection) : 'No payment entries';
  $('#dashboardTotalDue').textContent = retainedBills.length === 0 ? 'No bill entries' : pricedRetainedBills.length ? formatAmount(totals.totalDue) : 'Not set';
  $('#dashboardTodayCollection').textContent = todayPayments ? formatAmount(totals.todayCollection) : 'No payment entries';
  $('#dashboardPreviousCollection').textContent = previousMonthPayments ? formatAmount(totals.previousMonthCollection) : 'No payment entries';
  $('#dashboardCurrentMonthDue').textContent = currentBills.length === 0 ? 'No bill entries' : pricedCurrentBills.length ? formatAmount(totals.currentMonthDue) : 'Not set';
  $('#dashboardPendingCredit').textContent = allPayments.length ? formatAmount(totals.pendingCredit) : 'No credit entries';
  $('#dashboardExpectedProfit').textContent = profilesWithProfit ? formatAmount(totals.expectedMonthlyPackageProfit) : 'Not set';
  $('#dashboardProviderCost').textContent = profilesWithCost ? formatAmount(totals.expectedMonthlyProviderCost) : 'Not set';
  $('#dashboardCustomerPeriod').textContent = `${totals.archivedCustomers} archived · ${totals.totalCustomers} unarchived profiles; service state is manual`;
  $('#dashboardProviderCostPeriod').textContent = profilesWithCost ? 'Expected recurring monthly cost · not cash paid' : 'No provider-cost entries · not cash paid';
  $('#providerCostBreakdownList').innerHTML = totals.providerCostBreakdown.map(group => `<li><span class="provider-breakdown-name">${escapeHtml(group.provider)}</span><strong>${escapeHtml(formatAmount(group.expectedMonthlyCost))}</strong><span class="provider-breakdown-meta">${group.profilesWithCost} cost${group.profilesWithCost === 1 ? '' : 's'} entered · ${group.profilesMissingCost} missing</span></li>`).join('');
  $('#providerCostBreakdownEmpty').hidden = totals.providerCostBreakdown.length > 0;
  $('#dashboardTotalCollectionPeriod').textContent = retainedPayments.length ? `Actual recorded payments · last ${MONTH_LIMIT} retained billing months` : 'No actual payment entries in the retained history';
  $('#dashboardTotalDuePeriod').textContent = retainedBills.length ? `Known outstanding bills · retained ${MONTH_LIMIT}-month history` : 'No bills have been recorded in the retained history';
  $('#dashboardTodayPeriod').textContent = `Actual payments dated today · ${totals.today}`;
  $('#dashboardPreviousPeriod').textContent = `Actual payment dates in ${monthName(totals.previousMonth)}`;
  $('#dashboardCurrentDuePeriod').textContent = `Current billing month · ${monthName(totals.currentMonth)}${currentBills.length ? '' : ' · no bill entries'}`;
  $('#dashboardExpectedProfitPeriod').textContent = 'Selling amount − provider cost · expected margin, not collected cash profit';
  const notes = [];
  if (totals.customersMissingSellingAmount) notes.push(`Selling amount unset for ${plural(totals.customersMissingSellingAmount, 'customer')}; no monthly bills are generated until a price is entered.`);
  if (totals.unpricedBillCount) notes.push(`${plural(totals.unpricedBillCount, 'pending bill')} without a recorded amount are excluded from due totals.`);
  if (totals.incompleteProfitProfiles) notes.push(`Profit not set for ${plural(totals.incompleteProfitProfiles, 'profile')} missing a selling amount or provider cost; excluded from expected package profit.`);
  if (totals.customersMissingProviderCost) notes.push(`Provider cost not set for ${plural(totals.customersMissingProviderCost, 'active profile')}; excluded from expected monthly provider cost.`);
  $('#dashboardExcludedAmounts').textContent = notes.length ? notes.join(' ') : 'Dues use each saved month’s bill snapshot after receipts and carry-forward credit; credits are not new cash.';
}
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function tenurePresentation(customer) {
  const tenure = summarizeCustomerTenure(customer, new Date());
  const monthLabel = tenure.serviceMonths === 1 ? '1 calendar month' : `${tenure.serviceMonths} calendar months`;
  if (tenure.status === 'current') return { primary:monthLabel, detail:`Connected since ${humanDate(tenure.connectionDate)}` };
  if (tenure.status === 'ended') return { primary:monthLabel, detail:`Service ended ${humanDate(tenure.endDate)}` };
  if (tenure.status === 'future') return { primary:'Not started', detail:`Recorded connection date ${humanDate(tenure.connectionDate)}` };
  if (tenure.status === 'end-date-unknown') return { primary:'End date not recorded', detail:`Connected since ${humanDate(tenure.connectionDate)} · duration unavailable` };
  if (tenure.status === 'date-review') return { primary:'Check connection dates', detail:`Saved end date ${humanDate(tenure.endDate)} is before connection` };
  return { primary:'Not recorded', detail:tenure.profileAddedOn ? `Profile added ${humanDate(tenure.profileAddedOn)} · ISP start not recorded` : 'Connection date not recorded' };
}
function profileReceiptSummaryMarkup(customer) {
  const receipts = summarizeCustomerReceipts(customer);
  const tenure = tenurePresentation(customer);
  const receiptRows = receipts.monthly.map(row => `<li class="receipt-month-row"><span>${escapeHtml(monthName(row.month))}</span><strong>${escapeHtml(formatAmount(row.amount))}</strong><small>${plural(row.receiptCount, 'receipt')}</small></li>`).join('');
  return `<section class="customer-receipt-summary" aria-label="Recorded receipts and connection time"><div class="profile-summary-grid"><article class="profile-summary-stat profile-summary-receipts"><span>Total actually received</span><strong>${receipts.receiptCount ? escapeHtml(formatAmount(receipts.total)) : 'No receipts recorded'}</strong><small>${receipts.receiptCount ? `${plural(receipts.receiptCount, 'recorded receipt')} · across all saved months` : 'Bills and charges are not counted as receipts.'}</small></article><article class="profile-summary-stat profile-summary-tenure"><span>Time with ISP</span><strong>${escapeHtml(tenure.primary)}</strong><small>${escapeHtml(tenure.detail)}</small></article></div><div class="receipt-month-history"><div class="receipt-month-heading"><strong>Receipts by payment month</strong><span>Grouped by actual payment date · bill amounts excluded</span></div>${receiptRows ? `<ul class="receipt-month-list" aria-label="Actual receipts by payment month">${receiptRows}</ul>` : '<p class="receipt-month-empty">No actual receipt entries have been recorded.</p>'}</div></section>`;
}
function customerCardMarkup(customer, archived = false) {
  const receipts = summarizeCustomerReceipts(customer);
  const tenure = tenurePresentation(customer);
  const monthBill = (customer.bills ?? []).find(bill => bill.month === selectedBillingMonth);
  const billing = statusPresentation(customer, monthBill);
  const billingLabel = `${monthName(selectedBillingMonth)} bill: ${billing.label}`;
  const manualStatus = manualServiceStatusLabel(customer.serviceStatus);
  const receiptValue = receipts.receiptCount ? formatAmount(receipts.total) : 'No receipts';
  const receiptCount = receipts.receiptCount ? plural(receipts.receiptCount, 'recorded receipt') : 'No payment entries';
  const openLabel = `Open customer profile for #${customer.customerNumber}, ${customer.name}. Total actual receipts: ${receiptValue}. Time with ISP: ${tenure.primary}. ${tenure.detail}.`;
  const serviceButtons = ['active','offline','not-set'].map(status => {
    const label = ({ active:'Active', offline:'Offline', 'not-set':'Not set' })[status];
    const selected = status === customer.serviceStatus;
    return `<button class="service-choice service-choice-${status} ${selected ? 'is-selected' : ''}" type="button" data-set-service="${escapeHtml(customer.id)}" data-service-status="${status}" aria-pressed="${selected}" aria-label="Set customer ${customer.customerNumber} manual service status to ${label}">${label}</button>`;
  }).join('');
  return `<li class="customer-item ${archived ? 'archived-customer-item' : ''}"><button class="customer-select customer-profile-card-open" type="button" data-customer-id="${escapeHtml(customer.id)}" aria-current="${customer.id === selectedCustomerId}" aria-label="${escapeHtml(openLabel)}"><span class="customer-card-heading"><span class="avatar" aria-hidden="true">${escapeHtml(initials(customer.name))}</span><span class="customer-copy"><span class="customer-number-line">#${customer.customerNumber}${archived ? ' · Archived' : ''}</span><span class="customer-name">${escapeHtml(customer.name)}</span></span><span class="customer-manual-state">${escapeHtml(manualStatus)}</span></span><span class="customer-card-stats"><span class="customer-card-stat"><span>Actually received</span><strong>${escapeHtml(receiptValue)}</strong><small>${escapeHtml(receiptCount)}</small></span><span class="customer-card-stat"><span>Time with ISP</span><strong>${escapeHtml(tenure.primary)}</strong><small>${escapeHtml(tenure.detail)}</small></span></span><span class="customer-card-package">${escapeHtml(customer.packageSpeed || 'Package not set')}</span><span class="customer-card-open-hint">Open full profile and monthly billing history <span aria-hidden="true">→</span></span></button><div class="customer-card-controls"><span class="customer-billing-badge ${billing.className}" aria-label="Billing status for ${escapeHtml(monthName(selectedBillingMonth))}: ${billing.label}">${escapeHtml(billingLabel)}</span><div class="service-choice-group" role="group" aria-label="Manual service status for customer ${customer.customerNumber}, ${escapeHtml(customer.name)}">${serviceButtons}</div></div>${archived ? `<button class="archived-unarchive-button" type="button" data-unarchive-customer="${escapeHtml(customer.id)}">Unarchive</button>` : ''}</li>`;
}
function renderCustomers() {
  const customerQuery = customerListQuery();
  const filtered = filterCustomersByStatus(state, { serviceStatus:selectedServiceFilter, billingStatus:selectedBillingFilter, month:selectedBillingMonth, customerQuery });
  const active = filtered.filter(customer => !customer.archived);
  const archived = filtered.filter(customer => customer.archived);
  const searched = searchCustomers(state, customerQuery);
  const activeTotal = searched.filter(customer => !customer.archived).length;
  const archivedTotal = searched.filter(customer => customer.archived).length;
  customerList.innerHTML = active.map(customer => customerCardMarkup(customer)).join('');
  $('#archivedCustomerList').innerHTML = archived.map(customer => customerCardMarkup(customer, true)).join('');
  $('#customerCount').textContent = selectedServiceFilter === 'all' && selectedBillingFilter === 'all' && active.length === activeTotal ? activeTotal : `${active.length}/${activeTotal}`;
  $('#archivedCustomerCount').textContent = archived.length === archivedTotal ? archivedTotal : `${archived.length}/${archivedTotal}`;
  $('#welcomeCount').textContent = state.customers.filter(customer => !customer.archived).length;
  const emptySearch = $('#noSearchResults');
  if (emptySearch) {
    emptySearch.textContent = customerQuery.trim() ? 'No matching customers.' : 'No customers match these service and billing filters.';
    emptySearch.hidden = active.length > 0 || archived.length > 0;
  }
  document.querySelectorAll('[data-customer-service-filter]').forEach(button => button.setAttribute('aria-pressed', button.dataset.customerServiceFilter === selectedServiceFilter ? 'true' : 'false'));
  document.querySelectorAll('[data-customer-billing-filter]').forEach(button => button.setAttribute('aria-pressed', button.dataset.customerBillingFilter === selectedBillingFilter ? 'true' : 'false'));
  for (const list of [customerList,$('#archivedCustomerList')]) list.querySelectorAll('[data-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.customerId)));
  for (const list of [customerList,$('#archivedCustomerList')]) list.querySelectorAll('[data-set-service]').forEach(button => button.addEventListener('click', () => setManualServiceStatus(button.dataset.setService, button.dataset.serviceStatus)));
  $('#archivedCustomerList').querySelectorAll('[data-unarchive-customer]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); restoreCustomer(button.dataset.unarchiveCustomer); }));
}
function setManualServiceStatus(customerId, serviceStatus) {
  const label = ({ active:'Active', offline:'Offline', 'not-set':'Not set' })[serviceStatus];
  if (!label) return;
  try {
    state = updateCustomerProfile(state, customerId, { serviceStatus });
    save();
    if (selectedCustomerId === customerId) {
      $('#serviceStatusInput').value = serviceStatus;
      if (!profileEditMode) renderDetail();
    }
    toast(`Manual service status set to ${label}. No connectivity monitoring is performed.`);
  } catch (error) { toast(error.message); }
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
  const matches = buildGlobalLedgerSearch(state, query, selectedBillingMonth);
  const shown = matches.slice(0, 12);
  options.innerHTML = shown.map(({customer,billing,receipts,receiptCount}) => {
    const receiptText = receipts.length ? `Recent receipts: ${receipts.map(row => `${humanDate(row.date)} · ${formatAmount(row.amount)} · ${row.method} · ${monthName(row.month)}`).join('  |  ')}${receiptCount > receipts.length ? ` · ${receiptCount - receipts.length} more saved` : ''}` : 'No payment receipts saved.';
    return `<button class="global-result-option" type="button" role="option" aria-selected="false" data-global-customer="${escapeHtml(customer.id)}"><span class="global-result-number">#${customer.customerNumber}${customer.archived ? ' · Archived' : ''}</span><span class="global-result-copy"><span class="global-result-name">${escapeHtml(customer.name)}</span><span class="global-result-ledger">${escapeHtml(monthName(billing.month))} · <strong class="customer-billing-badge ${escapeHtml(billing.statusClassName)}">${escapeHtml(billing.statusLabel)}</strong> · Bill ${escapeHtml(billing.billAmountLabel)} · Received ${escapeHtml(billing.receivedAmountLabel)} · Balance ${escapeHtml(billing.balanceDueLabel)}</span><span class="global-result-receipt">${escapeHtml(receiptText)}</span></span></button>`;
  }).join('') || '<div class="global-result-no-match" role="option" aria-disabled="true">No customer, bill, or receipt matches.</div>';
  $('#globalSearchResultCount').textContent = matches.length ? `Showing ${shown.length} of ${matches.length} customers with matching saved history. Service and billing filters affect the customer list only.` : 'Search includes saved customer details, bill status and amounts, and payment date, method, and amount.';
  box.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  $('#globalSearchStatus').textContent = `${matches.length} ${matches.length === 1 ? 'customer' : 'customers'} found with saved bill summaries and receipt history.`;
  options.querySelectorAll('[data-global-customer]').forEach(button => button.addEventListener('click', () => {
    const customerId = button.dataset.globalCustomer;
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    selectCustomer(customerId);
  }));
}
function switchView(view) {
  const views = { customers:['customersView','showCustomersButton'], transactions:['transactionsView','showTransactionsButton'], reports:['billingReportsView','showReportsButton'], analytics:['analyticsView','showAnalyticsButton'], inventory:['inventoryView','showInventoryButton'], expenses:['expensesView','showExpensesButton'] };
  for (const [name, [sectionId, buttonId]] of Object.entries(views)) {
    const active = name === view;
    $(`#${sectionId}`).hidden = !active;
    $(`#${buttonId}`).setAttribute('aria-current', active ? 'page' : 'false');
  }
}
for (const [name, [tabId]] of Object.entries(profileTabMap)) $(`#${tabId}`).addEventListener('click', () => activateProfileTab(name));
$('.profile-tabs').addEventListener('keydown', event => {
  const names = Object.keys(profileTabMap);
  const current = names.indexOf(selectedProfileTab);
  let next = current;
  if (event.key === 'ArrowRight') next = (current + 1) % names.length;
  else if (event.key === 'ArrowLeft') next = (current + names.length - 1) % names.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = names.length - 1;
  else return;
  event.preventDefault();
  activateProfileTab(names[next], true);
});
function statusPresentation(customer, bill, allocations = null) {
  const value = derivedBillStatus(customer, bill, allocations);
  return {
    paid:{ label:'Paid', className:'status-received', value },
    pending:{ label:'Pending', className:'status-pending', value },
    partial:{ label:'Partial', className:'status-partial', value },
    'not-set':{ label:'Not set', className:'status-empty', value }
  }[value];
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
function receiptWhatsAppActionMarkup(customer, receipt) {
  const action = resolveReceiptWhatsAppAction(customer, receipt);
  if (action.type === 'phone-required') {
    const label = action.hasSavedPhone ? 'Update WhatsApp number' : 'Add WhatsApp number';
    return `<button class="receipt-phone-help" type="button" data-edit-receipt-phone="${escapeHtml(customer.id)}" aria-label="${label} for customer #${escapeHtml(customer.customerNumber)} ${escapeHtml(customer.name)} before preparing this receipt" title="Use this customer's full international number including country code.">${label}</button>`;
  }
  if (action.type !== 'draft') return '<span class="whatsapp-receipt-unavailable">Receipt draft unavailable for this customer.</span>';
  return `<span class="receipt-whatsapp-action-wrap"><a class="receipt-whatsapp-action" href="${escapeHtml(action.draft.url)}" target="_blank" rel="noopener noreferrer" aria-label="Review WhatsApp receipt draft for customer #${escapeHtml(customer.customerNumber)} ${escapeHtml(customer.name)}; an internet connection is required to open WhatsApp; it will not send automatically" title="Draft prepared locally; internet is required to open WhatsApp.">WhatsApp receipt</a><small class="receipt-network-note">Internet required to open WhatsApp.</small></span>`;
}
function editCustomerPhoneFromReceipt(customerId) {
  if (!customerId || !state.customers.some(customer => customer.id === customerId)) return;
  selectCustomer(customerId);
  if (selectedCustomerId !== customerId) return;
  profileEditMode = true;
  renderDetail();
  activateProfileTab('info');
  const phoneInput = $('#phoneInput');
  phoneInput.focus();
  phoneInput.scrollIntoView({ behavior:'smooth', block:'center' });
  toast('Edit this customer’s international WhatsApp number, then select Save profile.');
}
function bindReceiptPhoneActions(container) {
  container.querySelectorAll('[data-edit-receipt-phone]').forEach(button => button.addEventListener('click', () => editCustomerPhoneFromReceipt(button.dataset.editReceiptPhone)));
}
function billAmountAuditMarkup(bill) {
  const changes = bill?.amountHistory ?? [];
  if (!changes.length) return '';
  const items = changes.map(change => `<li>${escapeHtml(humanLocalDateTime(change.changedAt))}: ${escapeHtml(formatAmount(change.previousAmount))} → ${escapeHtml(formatAmount(change.newAmount))}</li>`).join('');
  return `<details class="bill-audit"><summary>Bill amount corrections (${changes.length})</summary><ol>${items}</ol></details>`;
}
function renderHistory(customer) {
  const monthList = monthsForHistory();
  const byMonth = new Map(customer.bills.map(bill => [bill.month, bill]));
  const allocations = calculatePaymentAllocations(state);
  $('#customerEmptyNote').hidden = customer.bills.length > 0;
  historyContainer.innerHTML = monthList.map(month => {
    const bill = byMonth.get(month);
    const status = statusPresentation(customer, bill, allocations);
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
      return `<li class="payment-row" data-payment-row="${escapeHtml(payment.id)}"><span class="payment-main"><span class="payment-amount">${escapeHtml(formatAmount(payment.amount))} actual receipt</span><span class="payment-meta">${escapeHtml(humanDate(payment.date))} · ${escapeHtml(payment.method)}${paymentPayerMarkup(payment)}</span>${allocation}</span><span class="payment-actions">${receiptWhatsAppActionMarkup(customer, { customerId:customer.id, date:payment.date, amount:payment.amount, method:payment.method, paidBy:payment.paidBy, month, paymentId:payment.id, billStatus:status.value, billAmount:effectiveAmount, balanceDueCents:monthAllocation?.balanceDueCents ?? null, billDueDate:bill?.dueDate ?? null })}<button class="edit-payment" type="button" data-edit-payment="${escapeHtml(payment.id)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${month}" aria-label="Edit payment for customer ${customer.customerNumber}">Edit</button><button class="delete-payment" type="button" data-delete-payment="${escapeHtml(payment.id)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${month}" aria-label="Delete payment for customer ${customer.customerNumber}">Delete</button></span></li>`;
    }).join('');
    const statusValue = status.value;
    const due = bill?.dueAmount ?? '';
    const hasPartial = statusValue === 'partial';
    const summaryMarkup = !bill ? '<p class="empty-month">No billing details recorded for this month.</p>' : `<div class="month-summary"><span>Status: <strong>${status.label}</strong></span><span>Optional due date (PKT): <strong>${bill.dueDate ? escapeHtml(humanDate(bill.dueDate)) : 'Not set · no due-date rule or penalty applied'}</strong></span><span>Actual receipts (PKR cash): <strong>${formatAmount(received)}</strong></span><span>Carry-in credit (PKR, not new cash): <strong>${creditApplied}</strong></span>${creditSourceMarkup}<span>Bill amount (PKR): <strong>${escapeHtml(displayAmount)}</strong></span><span>Balance due (PKR): <strong>${escapeHtml(balanceDue)}</strong></span>${monthAllocation?.excessGeneratedCents ? `<span>Credit from this month’s receipts (PKR): <strong>${formatAmount(monthAllocation.excessGeneratedCents / 100)}</strong></span>` : ''}${monthAllocation?.creditForwardedCents ? `<span>Credit applied to later bills (PKR): <strong>${formatAmount(monthAllocation.creditForwardedCents / 100)}</strong></span>` : ''}${monthAllocation?.pendingCreditCents ? `<span>Credit waiting for the next generated bill (PKR): <strong>${formatAmount(monthAllocation.pendingCreditCents / 100)}</strong></span>` : ''}${hasPartial ? '<span class="month-status status-pending">Partial payment / credit</span>' : ''}</div>${generatedNote}${billAmountAuditMarkup(bill)}`;
    const amountRequired = bill ? '' : 'required';
    const amountLabel = bill ? 'Optional' : 'Required to create a bill';
    const amountPlaceholder = bill ? 'Leave blank only if not known' : 'Enter confirmed amount in PKR';
    const archivedWithoutBill = customer.archived && !bill;
    const formsMarkup = archivedWithoutBill ? '<p class="notice">Archived customers do not receive new monthly bills or payments. Unarchive this customer to resume billing.</p>' : `<div class="month-forms"><form class="form-card bill-form" data-kind="bill" data-month="${month}"><h4>${bill ? 'Update bill details' : 'Record confirmed bill details'}</h4><div class="form-grid"><label class="field-label full" for="due-${month}">Bill amount (PKR) <span class="optional-label">${amountLabel}</span></label><input id="due-${month}" class="full" name="dueAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${amountPlaceholder}" value="${escapeHtml(due)}" ${amountRequired}><label class="field-label full" for="due-date-${month}">Optional due date (Pakistan local date)</label><input id="due-date-${month}" class="full" name="dueDate" type="date" value="${escapeHtml(bill?.dueDate ?? '')}"><p class="field-help full">No due-date rule or late fees are applied automatically.</p><button class="primary-button" type="submit">${bill ? 'Save bill details' : 'Record this month'}</button></div></form><form class="form-card payment-form" data-kind="payment" data-month="${month}"><h4>Record an actual payment</h4><p class="field-help payment-guidance" id="payment-guidance-${month}" role="status">Enter the actual collected amount, payment date and method. Nothing is saved until you submit this form.</p><div class="form-grid"><label class="field-label full" for="date-${month}">Payment date (Pakistan local date)</label><input id="date-${month}" class="full" name="date" type="date" required><label class="field-label full" for="amount-${month}">Amount received (PKR)</label><input id="amount-${month}" class="full" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Enter actual amount" required><label class="field-label full" for="method-${month}">Payment method</label><select id="method-${month}" class="full" name="method" required><option value="">Choose a method</option>${PAYMENT_METHODS.map(method => `<option value="${method}">${method}</option>`).join('')}</select>${paidByFieldMarkup(`paid-by-${month}`)}<button class="primary-button" type="submit">Record actual payment</button></div></form></div>`;
    return `<details class="month-card" data-month-card="${month}"><summary><span class="month-label">${escapeHtml(monthName(month))}</span><span class="history-count">${bill ? `${bill.payments?.length ?? 0} payment${bill.payments?.length === 1 ? '' : 's'}` : ''}</span><span class="month-status ${status.className}">${status.label}</span></summary><div class="month-body">${summaryMarkup}${formsMarkup}<ul class="payment-list" aria-label="Payments for ${escapeHtml(monthName(month))}">${payments}</ul></div></details>`;
  }).join('');
  historyContainer.querySelectorAll('form[data-kind="bill"]').forEach(form => form.addEventListener('submit', onBillSubmit));
  historyContainer.querySelectorAll('form[data-kind="payment"]').forEach(form => form.addEventListener('submit', onPaymentSubmit));
  historyContainer.querySelectorAll('[data-edit-payment]').forEach(button => button.addEventListener('click', () => beginCorrection(button.dataset.customerId, button.dataset.month, button.dataset.editPayment, 'history')));
  historyContainer.querySelectorAll('[data-delete-payment]').forEach(button => button.addEventListener('click', () => requestDeletePayment(button.dataset.customerId, button.dataset.month, button.dataset.deletePayment)));
  bindReceiptPhoneActions(historyContainer);
}
function renderTransactions() {
  const date = $('#transactionDateFilter').value;
  const recencyValue = $('#transactionRecencyFilter').value;
  const recencyDays = recencyValue === 'all' ? null : Number(recencyValue);
  const transactions = listTransactions(state, { customerQuery:searchQuery(), date, recencyDays });
  const total = listTransactions(state).length;
  $('#transactionsCount').textContent = `${transactions.length} of ${total} recorded ${total === 1 ? 'payment' : 'payments'}`;
  $('#transactionsEmpty').hidden = transactions.length > 0;
  transactionList.innerHTML = transactions.map(transaction => {
    const customer = state.customers.find(item => item.id === transaction.customerId);
    const statusText = reportStatusLabel(transaction.status);
    const serviceLabel = ({ active:'Active', offline:'Offline', 'not-set':'Not set' })[transaction.customerServiceStatus] ?? 'Not set';
    return `<li class="transaction-card" data-payment-row="${escapeHtml(transaction.paymentId)}"><div class="transaction-data"><div class="transaction-title"><span class="transaction-customer"><span class="transaction-customer-number">#${transaction.customerNumber}</span>${escapeHtml(transaction.customerName)}</span><strong class="transaction-amount">${escapeHtml(formatAmount(transaction.amount))}</strong></div><p class="transaction-meta">Actual payment date: ${escapeHtml(humanDate(transaction.date))} · Method: ${escapeHtml(transaction.method)}${paymentPayerMarkup(transaction)}</p><p class="transaction-context">Selected bill month: ${escapeHtml(monthName(transaction.month))} · Billing status: <span class="report-status report-status-${transaction.status}">${statusText}</span> · Manual service: ${serviceLabel}</p>${paymentAllocationMarkup(transaction.allocation)}</div><div class="transaction-actions">${receiptWhatsAppActionMarkup(customer, transaction)}<button class="edit-payment" type="button" data-transaction-edit="${escapeHtml(transaction.paymentId)}" data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}">Edit</button><button class="delete-payment" type="button" data-transaction-delete="${escapeHtml(transaction.paymentId)}" data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}">Delete</button></div></li>`;
  }).join('');
  transactionList.querySelectorAll('[data-transaction-edit]').forEach(button => button.addEventListener('click', () => beginCorrection(button.dataset.customerId, button.dataset.month, button.dataset.transactionEdit, 'transactions')));
  transactionList.querySelectorAll('[data-transaction-delete]').forEach(button => button.addEventListener('click', () => requestDeletePayment(button.dataset.customerId, button.dataset.month, button.dataset.transactionDelete)));
  bindReceiptPhoneActions(transactionList);
}
function reportStatusLabel(status) { return ({ paid:'Paid', pending:'Pending', unpaid:'Pending', partial:'Partial', 'not-set':'Not set' })[status] ?? 'Not set'; }
function renderMonthlyReport() {
  const month = selectedBillingMonth;
  const rows = buildMonthlyReport(state, { month, statusFilter:selectedReportFilter, customerQuery:searchQuery() });
  $('#monthlyReportCount').textContent = `${rows.length} ${rows.length === 1 ? 'customer' : 'customers'} · ${monthName(month)}`;
  $('#monthlyReportEmpty').hidden = rows.length > 0;
  reportList.innerHTML = rows.map(row => {
    const monthlySale = row.monthlySellingAmount === null || row.monthlySellingAmount === undefined ? 'Not set' : formatAmount(row.monthlySellingAmount);
    const billAmount = row.billAmount === null ? 'Not set' : formatAmount(row.billAmount);
    const due = row.balanceDue === null ? 'Not set' : formatAmount(row.balanceDue);
    const speed = row.packageSpeed || 'Not set';
    const provider = row.ispProvider || 'Not set';
    const dueDate = row.dueDate ? humanDate(row.dueDate) : 'Not set · no due-date rule or penalty';
    const creditSources = row.creditSources.map(source => `${monthName(source.originMonth)} receipt ${humanDate(source.paymentDate)} (${source.method}, ${formatAmount(source.receiptAmount)}): ${formatAmount(source.amountCents / 100)} applied`).join('; ');
    const pendingSources = row.pendingCreditSources.map(source => `${monthName(source.originMonth)} receipt ${humanDate(source.paymentDate)} (${source.method}, original ${formatAmount(source.receiptAmount)}): ${formatAmount(source.amountCents / 100)} still available`).join('; ');
    const creditSummary = `Applied to bill ${formatAmount(row.creditApplied)} · forwarded from selected bill ${formatAmount(row.creditForwarded)} · customer-wide unused prepaid balance ${formatAmount(row.creditPending)} (not cash; valid indefinitely)${creditSources ? ` · Applied sources: ${creditSources}` : ''}${pendingSources ? ` · Waiting sources: ${pendingSources}` : ''}`;
    const serviceLabel = ({ active:'Active', offline:'Offline', 'not-set':'Not set' })[row.serviceStatus] ?? 'Not set';
    return `<li class="report-row"><div class="report-customer"><span class="customer-number-line">#${row.customerNumber}${row.archived ? ' · Archived' : ''}</span><div class="report-customer-name">${escapeHtml(row.customerName)}</div><span class="report-cell-label">Service (manual): ${serviceLabel} · Package / speed: ${escapeHtml(speed)} · ISP/provider: ${escapeHtml(provider)}</span></div><div class="report-cell"><span class="report-cell-label">Monthly sale (PKR)</span><span class="report-cell-value">${escapeHtml(monthlySale)}</span></div><div class="report-cell"><span class="report-cell-label">${escapeHtml(monthName(row.month))} bill (PKR)</span><span class="report-cell-value">${escapeHtml(billAmount)}</span></div><div class="report-cell"><span class="report-cell-label">Optional due date (PKT)</span><span class="report-cell-value">${escapeHtml(dueDate)}</span></div><div class="report-cell"><span class="report-cell-label">Actual amount received (PKR)</span><span class="report-cell-value">${escapeHtml(formatAmount(row.amountReceived))}</span></div><div class="report-cell"><span class="report-cell-label">Balance due (PKR)</span><span class="report-cell-value">${escapeHtml(due)}</span></div><div class="report-cell"><span class="report-cell-label">Auto-credit (PKR, not cash)</span><span class="report-credit-value">${escapeHtml(creditSummary)}</span></div><div class="report-cell"><span class="report-cell-label">Billing status</span><span class="report-status report-status-${row.status}">${reportStatusLabel(row.status)}</span></div></li>`;
  }).join('');
  document.querySelectorAll('[data-report-filter]').forEach(button => button.setAttribute('aria-pressed', button.dataset.reportFilter === selectedReportFilter ? 'true' : 'false'));
}
function populateReportMonths() {
  const months = monthsForHistory();
  const options = months.map(month => `<option value="${month}">${escapeHtml(monthName(month))}</option>`).join('');
  $('#reportMonth').innerHTML = options;
  $('#customerFilterMonth').innerHTML = options;
  $('#reportMonth').value = selectedBillingMonth;
  $('#customerFilterMonth').value = selectedBillingMonth;
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
function profileReadonlyField(label, value) {
  return `<div class="profile-readonly-field"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}
function renderCustomerProfileView(customer) {
  const phone = String(customer.phone ?? '').trim();
  const phoneTargets = contactActionTargets(phone);
  const phoneActions = phoneTargets ? `<span class="profile-contact-actions" aria-label="Contact shortcuts"><a class="secondary-button" href="${escapeHtml(phoneTargets.tel)}">Call</a>${phoneTargets.whatsapp ? `<a class="secondary-button" href="${escapeHtml(phoneTargets.whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}</span>` : '';
  const phoneHint = phoneTargets?.whatsapp ? '' : '<p class="profile-contact-note">Save a full international number including its country code (for example, +923001234567) to enable WhatsApp receipt drafts. No country code is guessed.</p>';
  const fields = [
    ['Area / mohalla', customer.mohalla || 'Not set'],
    ['Zone', customer.zone || 'Not set'],
    ['Address', customer.address || 'Not set'],
    ['ISP / provider', customer.ispProvider || 'Not set'],
    ['Service status', manualServiceStatusLabel(customer.serviceStatus)],
    ['Package / speed', customer.packageSpeed || 'Not set'],
    ['Monthly provider purchase cost', formatAmount(customer.monthlyPurchaseCost)],
    ['Monthly selling amount', formatAmount(customer.monthlySellingAmount)],
    ['Connection / subscription start', customer.connectionDate ? humanDate(customer.connectionDate) : 'Not recorded'],
    ['Expiry / end date', customer.expiryDate ? humanDate(customer.expiryDate) : 'Not recorded'],
    ['Cancellation date', customer.cancellationDate ? humanDate(customer.cancellationDate) : 'Not recorded']
  ];
  const profit = customerPackageProfit(customer);
  $('#customerProfileView').innerHTML = `<div class="profile-view-heading"><h3>Customer information</h3><div class="profile-view-actions"><details class="help-tip"><summary class="help-icon" aria-label="Customer information guidance" aria-controls="customerInfoGuidance">i</summary><span id="customerInfoGuidance" class="help-tip-content" role="tooltip">Area / mohalla is the parent location and an optional zone is summarized beneath it. Service status is manually set and separate from billing; it is not monitored. Phone shortcuts open only the device dialer or WhatsApp composer, and never send a message. Receipt drafts contain only this customer’s saved receipt details. All profile values shown here come from saved fields.</span></details><button id="editProfileButton" class="text-button profile-edit-button" type="button">Edit</button></div></div><dl class="profile-readonly-grid">${profileReadonlyField('Phone / WhatsApp number', phone || 'Not set')}${fields.map(([label,value]) => profileReadonlyField(label,value)).join('')}</dl>${phoneActions ? `<div class="profile-contact-shortcuts">${phoneActions}</div>` : ''}${phoneHint}<p class="profile-view-profit">Expected monthly package profit: <strong>${escapeHtml(profit === null ? 'Not set' : formatAmount(profit))}</strong></p>`;
  $('#customerProfileView').querySelector('#editProfileButton').addEventListener('click', () => {
    profileEditMode = true;
    $('#customerProfileView').hidden = true;
    $('#customerProfileForm').hidden = false;
    $('#mohallaInput').focus();
  });
}
function renderCurrentBillSummary(customer) {
  const month = monthsForHistory(new Date())[0];
  const summary = currentBillPresentation(customer, month, calculatePaymentAllocations(state));
  $('#customerCurrentBillSummary').innerHTML = `<div class="current-bill-heading"><h3>Current billing · ${escapeHtml(monthName(month))}</h3><details class="help-tip"><summary class="help-icon" aria-label="Current bill and balance guidance" aria-controls="currentBillGuidance">i</summary><span id="currentBillGuidance" class="help-tip-content" role="tooltip">Bill amount is the saved bill for this month. Paid, Partial, Pending, or Not set is derived from saved receipts and carried credit. Net due is the existing calculated balance; no bill or amount is invented.</span></details></div><div class="current-bill-grid" aria-live="polite"><article class="current-bill-stat"><span>Monthly bill</span><strong>${escapeHtml(summary.billAmountLabel)}</strong></article><article class="current-bill-stat"><span>Billing status</span><strong class="customer-billing-badge ${escapeHtml(summary.statusClassName)}">${escapeHtml(summary.statusLabel)}</strong></article><article class="current-bill-stat"><span>Net due balance</span><strong>${escapeHtml(summary.balanceDueLabel)}</strong></article></div>`;
}
function renderDetail() {
  const customer = selectedCustomer();
  $('#welcomeState').hidden = !!customer;
  $('#customerDetail').hidden = !customer;
  if (!customer) return;
  $('#customerReceiptSummary').innerHTML = profileReceiptSummaryMarkup(customer);
  $('#profileAvatar').textContent = initials(customer.name);
  $('#detailCustomerNumber').textContent = `Customer #${customer.customerNumber}`;
  $('#detailName').textContent = customer.name;
  renderCurrentBillSummary(customer);
  renderCustomerProfileView(customer);
  $('#customerProfileView').hidden = profileEditMode;
  $('#customerProfileForm').hidden = !profileEditMode;
  $('#serviceStatusInput').value = customer.serviceStatus ?? 'not-set';
  const serviceStatus = ['active','offline'].includes(customer.serviceStatus) ? customer.serviceStatus : 'not-set';
  const serviceStatusLabel = manualServiceStatusLabel(serviceStatus).replace('Service status: ', '');
  const serviceStatusBadge = $('#profileServiceStatusBadge');
  serviceStatusBadge.className = `profile-service-status profile-service-status-${serviceStatus}`;
  serviceStatusBadge.textContent = `Service · ${serviceStatusLabel}`;
  serviceStatusBadge.setAttribute('aria-label', `Manual service status: ${serviceStatusLabel}; not monitored`);
  $('#archiveStateBadge').textContent = profileArchiveLabel(customer.archived, customer.archived ? (customer.archivedAt ? humanLocalDateTime(customer.archivedAt) : 'date not recorded') : '');
  $('#archiveCustomerButton').hidden = customer.archived;
  $('#unarchiveCustomerButton').hidden = !customer.archived;
  $('#mohallaInput').value = customer.mohalla ?? '';
  $('#zoneInput').value = customer.zone ?? '';
  $('#addressInput').value = customer.address ?? '';
  $('#phoneInput').value = customer.phone ?? '';
  $('#ispProviderInput').value = customer.ispProvider ?? '';
  $('#packageSpeedInput').value = customer.packageSpeed ?? '';
  $('#monthlyPurchaseCostInput').value = customer.monthlyPurchaseCost ?? '';
  $('#monthlySellingAmountInput').value = customer.monthlySellingAmount ?? '';
  $('#connectionDateInput').value = customer.connectionDate ?? '';
  $('#expiryDateInput').value = customer.expiryDate ?? '';
  $('#cancellationDateInput').value = customer.cancellationDate ?? '';
  $('#packageChangeStaffNameInput').value = '';
  const packageHistory = [...(customer.packageHistory ?? [])].reverse();
  $('#packageHistoryList').innerHTML = packageHistory.map(change => `<li><strong>${escapeHtml(change.date || 'Date not recorded')}</strong> · ${escapeHtml(change.oldPackage || 'Not set')} → ${escapeHtml(change.newPackage || 'Not set')} · Rate ${escapeHtml(formatAmount(change.oldMonthlyRate))} → ${escapeHtml(formatAmount(change.newMonthlyRate))} · monthly delta ${escapeHtml(change.monthlyRecurringPriceDelta === null ? 'Not calculable' : formatAmount(change.monthlyRecurringPriceDelta))}${change.staffName ? ` · ${escapeHtml(change.staffName)}` : ''}</li>`).join('');
  $('#packageHistoryEmpty').hidden = packageHistory.length > 0;
  renderProfileMarginPreview();
  renderIncidents(customer);
  renderHistory(customer);
}
function selectCustomer(id) {
  if (!state.customers.some(customer => customer.id === id)) return;
  switchView('customers');
  selectedCustomerId = id;
  profileEditMode = false;
  activateProfileTab('billing');
  appShell.classList.add('show-detail');
  renderCustomers();
  renderDetail();
  $('#detailPane').scrollTop = 0;
  const shellTop = appShell.getBoundingClientRect().top + window.scrollY;
  const topbarHeight = $('.topbar').getBoundingClientRect().height;
  window.scrollTo({ top:Math.max(0, shellTop - topbarHeight - 8), behavior:'smooth' });
}
function downloadTxt(filename, text) {
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
function downloadJson(filename, text) {
  const blob = new Blob([text], { type:'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
function renderStorageWarning() {
  const warning = $('#storageRecoveryWarning');
  warning.hidden = persistenceBlocked || storageAvailable;
  warning.textContent = persistenceBlocked ? `Saved billing data could not be read (${readFailureMessage || 'storage error'}). The app has not overwritten it. Use a valid JSON backup and review the merge before restoring.` : !storageAvailable ? 'Browser storage is unavailable; recent edits may not survive closing this page. Download a JSON backup after storage becomes available.' : '';
  $('#downloadJsonBackupButton').disabled = persistenceBlocked;
}
function renderBackupPreview(preview) {
  pendingBackupPreview = preview;
  const { counts, conflicts } = preview;
  const summary = [`Backup created: ${preview.exportedAt || 'date not recorded'}.`, `${counts.addedCustomers} new profiles`, `${counts.mergedCustomers} matching profiles checked`, `${counts.addedBills} new bills`, `${counts.addedPayments} new actual receipts`, `${counts.addedIncidents} new complaints/outages`, `${counts.filledProfileFields} blank profile fields filled`, `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} preserved.`].join(' ');
  $('#jsonBackupPreviewSummary').textContent = `${summary} Phase 3 records: ${counts.addedInventoryItems ?? 0} inventory items, ${counts.addedInventoryMovements ?? 0} movements, ${counts.addedExpenses ?? 0} expenses, ${counts.addedSaadAttendanceDays ?? 0} Saad attendance dates, ${counts.addedUmairWorkdays ?? 0} Umair work dates.`;
  const list = $('#jsonBackupConflictList');
  list.replaceChildren();
  for (const conflict of conflicts.slice(0, 25)) {
    const item = document.createElement('li');
    item.textContent = conflict.customerNumber ? `Customer #${conflict.customerNumber} ${conflict.name}: ${conflict.field}. Existing value kept.` : `${conflict.field}: existing value kept.`;
    list.append(item);
  }
  if (conflicts.length > 25) {
    const more = document.createElement('li'); more.textContent = `${conflicts.length - 25} additional conflicts are preserved in the local preview.`; list.append(more);
  }
  $('#applyJsonBackupButton').disabled = !preview.canApply;
  $('#jsonBackupDialog').showModal();
}
$('#downloadJsonBackupButton').addEventListener('click', () => {
  if (persistenceBlocked) { toast('Saved data could not be read; a backup of the blank recovery screen would be unsafe.'); return; }
  downloadJson(`shahdara-isp-billing-backup-${localDate()}.json`, createJsonBackup(state, new Date()));
  toast('JSON backup downloaded to this device. Store it somewhere safe.');
});
$('#restoreJsonBackupButton').addEventListener('click', () => { $('#jsonBackupFileInput').value=''; $('#jsonBackupFileInput').click(); });
$('#backupControlsToggle').addEventListener('click', event => {
  const button = event.currentTarget;
  const controls = $('#backupControls');
  const opening = controls.hidden;
  controls.hidden = !opening;
  button.setAttribute('aria-expanded', String(opening));
  const label = opening ? 'Hide backup and restore controls' : 'Show backup and restore controls';
  button.setAttribute('aria-label', label);
  button.title = label;
});
$('#jsonBackupFileInput').addEventListener('change', async event => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) { toast('Backup must be smaller than 25 MB. No local data was changed.'); return; }
  try { renderBackupPreview(previewJsonBackupMerge(state, await file.text())); }
  catch (error) { toast(`${error.message} No local data was changed.`); }
});
function closeBackupDialog() { pendingBackupPreview = null; $('#jsonBackupDialog').close(); }
document.querySelectorAll('[data-close-backup-dialog]').forEach(button => button.addEventListener('click', closeBackupDialog));
$('#cancelJsonBackupButton').addEventListener('click', closeBackupDialog);
$('#applyJsonBackupButton').addEventListener('click', () => {
  if (!pendingBackupPreview?.canApply) return;
  try {
    const restored = generateMonthlyBillsThroughCurrentMonth(pendingBackupPreview.state, new Date());
    persistState(restored, localStorage);
    state = restored; storageAvailable = true; persistenceBlocked = false; readFailureMessage = '';
    closeBackupDialog(); renderStorageWarning(); renderDashboard(); renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); renderDetail();
    toast('The reviewed safe merge was saved on this device. No existing conflicting values were overwritten.');
  } catch (error) { toast(`Restore could not be saved: ${error.message}`); }
});
function onBillSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form);
  try { state = saveBillMonth(state, selectedCustomerId, { month:form.dataset.month, dueAmount:data.get('dueAmount') || null, dueDate:data.get('dueDate') || null, status:'pending' }); save(); renderDetail(); toast('Bill details saved on this device.'); }
  catch (error) { toast(error.message); }
}
function onPaymentSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form);
  try { state = addPayment(state, selectedCustomerId, form.dataset.month, { date:data.get('date'), amount:data.get('amount'), method:data.get('method'), paidBy:data.get('paidBy') }); save(); renderDetail(); toast('Payment recorded on this device.'); }
  catch (error) { toast(error.message); }
}
function correctionForm(payment, customerId, month, origin) {
  const options = PAYMENT_METHODS.map(method => `<option value="${method}" ${method === payment.method ? 'selected' : ''}>${method}</option>`).join('');
  return `<form class="payment-form editing" data-kind="correct" data-origin="${origin}" data-customer-id="${escapeHtml(customerId)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}"><div class="form-grid"><label class="field-label full" for="edit-date-${escapeHtml(payment.id)}">Payment date</label><input id="edit-date-${escapeHtml(payment.id)}" class="full" name="date" type="date" value="${escapeHtml(payment.date)}" required><label class="field-label full" for="edit-amount-${escapeHtml(payment.id)}">Amount received (PKR)</label><input id="edit-amount-${escapeHtml(payment.id)}" class="full" name="amount" type="number" min="0.01" step="0.01" value="${escapeHtml(payment.amount)}" required><label class="field-label full" for="edit-method-${escapeHtml(payment.id)}">Payment method</label><select id="edit-method-${escapeHtml(payment.id)}" class="full" name="method">${options}</select>${paidByFieldMarkup(`edit-paid-by-${payment.id}`, payment.paidBy ?? '')}<button class="primary-button" type="submit">Save correction</button><button class="secondary-button full" type="button" data-cancel-correction>Cancel</button></div></form>`;
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
    state = correctPayment(state, form.dataset.customerId, form.dataset.month, form.dataset.paymentId, { date:data.get('date'), amount:data.get('amount'), method:data.get('method'), paidBy:data.get('paidBy') });
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

$('#customerListSearch').addEventListener('input', renderCustomers);
$('#clearCustomerListSearch').addEventListener('click', () => { $('#customerListSearch').value = ''; renderCustomers(); $('#customerListSearch').focus(); });
$('#globalCustomerSearch').addEventListener('input', () => { renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); });
$('#globalCustomerSearch').addEventListener('focus', () => { if (searchQuery().trim()) renderGlobalSearch(); });
$('#clearGlobalSearch').addEventListener('click', () => { $('#globalCustomerSearch').value = ''; renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); $('#globalCustomerSearch').focus(); });
$('#showCustomersButton').addEventListener('click', () => switchView('customers'));
function openPaymentEntry(month = selectedBillingMonth) {
  const customer = selectedCustomer();
  if (!customer) { $('#globalCustomerSearch').focus(); toast('Search for a customer, then open their payment form.'); return; }
  const card = historyContainer.querySelector(`[data-month-card="${CSS.escape(month)}"]`);
  if (!card) { toast('That billing month is outside the available history.'); return; }
  card.open = true;
  const form = card.querySelector('form[data-kind="payment"]');
  const amountInput = form?.querySelector('input[name="amount"]');
  if (!form || !amountInput) { toast('This archived customer has no payment form for that month.'); return; }
  const bill = customer.bills.find(item => item.month === month);
  const allocation = calculatePaymentAllocations(state).forMonth(customer.id, month);
  const hint = form.querySelector('.payment-guidance');
  amountInput.value = '';
  if (bill?.dueAmount !== null && bill?.dueAmount !== undefined && allocation?.balanceDueCents > 0) {
    const suggested = (allocation.balanceDueCents / 100).toFixed(2);
    amountInput.value = suggested;
    hint.textContent = `Suggested remaining balance: ${formatAmount(Number(suggested))}. Confirm the actual amount collected, enter the real payment date and method, then submit. Nothing is saved by opening this form.`;
  } else if (bill && derivedBillStatus(customer, bill, calculatePaymentAllocations(state)) === 'paid') {
    hint.textContent = 'This bill is already settled. No amount is due; enter an amount only if an actual additional prepayment is being collected. Nothing is saved until you submit.';
  } else if (!bill?.dueAmount) {
    hint.textContent = 'No bill amount is set for this month, so no remainder can be suggested. Enter only an actual collected amount, plus its real date and method. Nothing is saved until you submit.';
  } else {
    hint.textContent = 'No remaining bill balance is shown. Enter an amount only if it is an actual collected payment, plus its real date and method.';
  }
  amountInput.scrollIntoView({ behavior:'smooth', block:'center' });
  amountInput.focus({ preventScroll:true });
}
$('#quickAddPaymentButton').addEventListener('click', () => { switchView('customers'); openPaymentEntry(); });
$('#currentBillPaymentShortcut').addEventListener('click', () => openPaymentEntry());
$('#showTransactionsButton').addEventListener('click', () => { switchView('transactions'); renderTransactions(); });
$('#showReportsButton').addEventListener('click', () => { switchView('reports'); renderMonthlyReport(); });
$('#transactionDateFilter').addEventListener('input', renderTransactions);
$('#transactionRecencyFilter').addEventListener('change', renderTransactions);
$('#clearTransactionFilters').addEventListener('click', () => { $('#transactionRecencyFilter').value = 'all'; $('#transactionDateFilter').value = ''; $('#globalCustomerSearch').value = ''; renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); });
function setBillingMonth(month) {
  if (!monthsForHistory().includes(month)) return;
  selectedBillingMonth = month;
  $('#reportMonth').value = month;
  $('#customerFilterMonth').value = month;
  renderCustomers();
  renderMonthlyReport();
}
$('#reportMonth').addEventListener('change', event => setBillingMonth(event.currentTarget.value));
$('#customerFilterMonth').addEventListener('change', event => setBillingMonth(event.currentTarget.value));
document.querySelectorAll('[data-customer-service-filter]').forEach(button => button.addEventListener('click', () => { selectedServiceFilter = button.dataset.customerServiceFilter; renderCustomers(); }));
document.querySelectorAll('[data-customer-billing-filter]').forEach(button => button.addEventListener('click', () => { selectedBillingFilter = button.dataset.customerBillingFilter; renderCustomers(); }));
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
      mohalla:$('#mohallaInput').value, zone:$('#zoneInput').value, address:$('#addressInput').value, phone:$('#phoneInput').value,
      ispProvider:$('#ispProviderInput').value,
      serviceStatus:$('#serviceStatusInput').value,
      packageSpeed:$('#packageSpeedInput').value, monthlyPurchaseCost:$('#monthlyPurchaseCostInput').value,
      monthlySellingAmount:$('#monthlySellingAmountInput').value, connectionDate:$('#connectionDateInput').value,
      expiryDate:$('#expiryDateInput').value, cancellationDate:$('#cancellationDateInput').value,
      packageChangeStaffName:$('#packageChangeStaffNameInput').value
    });
    profileEditMode = false;
    save(); renderDetail(); toast('Customer profile saved on this device.');
  } catch (error) { toast(error.message); }
});
$('#cancelProfileEditButton').addEventListener('click', () => { profileEditMode = false; renderDetail(); });
$('#monthlyPurchaseCostInput').addEventListener('input', renderProfileMarginPreview);
$('#monthlySellingAmountInput').addEventListener('input', renderProfileMarginPreview);
function restoreCustomer(customerId) {
  try {
    state = unarchiveCustomer(state, customerId, new Date());
    save();
    if (selectedCustomerId === customerId) renderDetail();
    toast('Customer unarchived. Billing resumes from the current or next eligible month; archived months are not backfilled.');
  } catch (error) { toast(error.message); }
}
$('#archiveCustomerButton').addEventListener('click', () => {
  const customer = selectedCustomer();
  if (!customer || !window.confirm(`Archive customer #${customer.customerNumber} ${customer.name}? Existing bills, receipts, complaints, customer number and unused credit stay on this device; no new monthly bills will be generated while archived.`)) return;
  try { state = archiveCustomer(state, customer.id, new Date()); save(); renderDetail(); toast('Customer archived. Existing history remains available.'); }
  catch (error) { toast(error.message); }
});
$('#unarchiveCustomerButton').addEventListener('click', () => { const customer = selectedCustomer(); if (customer) restoreCustomer(customer.id); });
$('#deleteCustomerButton').addEventListener('click', () => {
  const customer = selectedCustomer();
  if (!customer || !window.confirm(`Permanently delete customer #${customer.customerNumber} ${customer.name}, all bills, receipts, unused prepaid credit, contact/package data and complaint history from this device? The customer number will not be reused. This cannot be undone unless a JSON backup contains the profile. Consider Archive instead.`)) return;
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
renderStorageWarning();
renderDashboard();
renderGlobalSearch();
renderCustomers();
renderTransactions();
renderMonthlyReport();
renderDetail();
if (!storageAvailable) toast('Browser storage is unavailable. Entries may not persist.');


function phase3Cell(value) { return escapeHtml(value ?? ''); }
function phase3Money(value) { return value === null || value === undefined ? 'Not set' : formatAmount(value); }
function readableStock(items, category) {
  const filtered=items.filter(item=>item.category===category&&item.hasMovements);
  if(!filtered.length) return 'Not recorded';
  const totals=new Map(); for(const item of filtered) totals.set(item.unit,(totals.get(item.unit)??0)+item.available);
  return [...totals].map(([unit,amount])=>`${new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(amount)} ${unit}`).join(' · ');
}
function shortMonth(month) { return new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`)); }
function chartAxis(value,isMoney) {
  const rounded=Math.round(value); const text=new Intl.NumberFormat('en-PK',{maximumFractionDigits:0}).format(rounded);
  return isMoney ? `PKR ${text}` : text;
}
function twoSeriesSvg(rows,{first,second,firstLabel,secondLabel,title,isMoney=false}={}) {
  const values=rows.flatMap(row=>[row[first],row[second]]).filter(value=>Number.isFinite(value));
  if(!values.length) return '';
  const width=720,height=220,left=76,right=12,top=14,bottom=38,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const maximum=Math.max(...values,1),groupWidth=plotWidth/Math.max(rows.length,1),barWidth=Math.min(20,groupWidth*.25);
  const ticks=[0,maximum/2,maximum];
  const grid=ticks.map(tick=>{const y=top+plotHeight-(tick/maximum)*plotHeight;return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" class="chart-grid-line"/><text x="${left-7}" y="${y+4}" text-anchor="end" class="chart-axis-label">${phase3Cell(chartAxis(tick,isMoney))}</text>`;}).join('');
  const bars=rows.map((row,index)=>{
    const center=left+groupWidth*(index+.5),monthLabel=phase3Cell(shortMonth(row.month));
    const makeBar=(key,offset,klass,label)=>{const value=row[key];if(!Number.isFinite(value))return '';const h=Math.max(value>0?1:0,(value/maximum)*plotHeight),y=top+plotHeight-h,x=center+offset-barWidth/2;return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="3" class="${klass}"><title>${phase3Cell(label)} · ${monthLabel}: ${phase3Cell(isMoney?formatAmount(value):value)}</title></rect>`;};
    return `${makeBar(first,-barWidth*.55,'chart-bar-first',firstLabel)}${makeBar(second,barWidth*.55,'chart-bar-second',secondLabel)}<text x="${center}" y="${height-12}" text-anchor="middle" class="chart-month-label">${monthLabel}</text>`;
  }).join('');
  const description=rows.map(row=>`${row.month}: ${firstLabel} ${Number.isFinite(row[first])?row[first]:'not recorded'}, ${secondLabel} ${Number.isFinite(row[second])?row[second]:'not recorded'}`).join('; ');
  return `<svg class="phase3-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${phase3Cell(title)}"><title>${phase3Cell(title)}</title><desc>${phase3Cell(description)}</desc>${grid}${bars}</svg>`;
}
function oneSeriesSvg(rows,{key,label,title,isMoney=false}={}) {
  const values=rows.map(row=>row[key]).filter(value=>Number.isFinite(value)); if(!values.length)return '';
  const width=720,height=220,left=76,right=12,top=14,bottom=38,plotWidth=width-left-right,plotHeight=height-top-bottom,maximum=Math.max(...values,1),groupWidth=plotWidth/Math.max(rows.length,1),barWidth=Math.min(30,groupWidth*.42);
  const grid=[0,maximum/2,maximum].map(tick=>{const y=top+plotHeight-(tick/maximum)*plotHeight;return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" class="chart-grid-line"/><text x="${left-7}" y="${y+4}" text-anchor="end" class="chart-axis-label">${phase3Cell(chartAxis(tick,isMoney))}</text>`;}).join('');
  const bars=rows.map((row,index)=>{const value=row[key],center=left+groupWidth*(index+.5),h=Math.max(value>0?1:0,(value/maximum)*plotHeight),y=top+plotHeight-h;return `${Number.isFinite(value)?`<rect x="${center-barWidth/2}" y="${y}" width="${barWidth}" height="${h}" rx="3" class="chart-bar-first"><title>${phase3Cell(label)} · ${phase3Cell(row.month)}: ${phase3Cell(isMoney?formatAmount(value):value)}</title></rect>`:''}<text x="${center}" y="${height-12}" text-anchor="middle" class="chart-month-label">${phase3Cell(shortMonth(row.month))}</text>`;}).join('');
  const description=rows.map(row=>`${row.month}: ${Number.isFinite(row[key])?row[key]:'not recorded'}`).join('; ');
  return `<svg class="phase3-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${phase3Cell(title)}"><title>${phase3Cell(title)}</title><desc>${phase3Cell(description)}</desc>${grid}${bars}</svg>`;
}
function renderAnalytics() {
  const data=buildPhase3Analytics(state,new Date());
  $('#analyticsPeriodNote').textContent=`Last six Pakistan local months through ${data.asOf} · ${monthName(data.currentMonth)} is partial.`;
  $('#forecastAmount').textContent=data.forecast.customersIncluded?formatAmount(data.forecast.amount):'Not set';
  $('#forecastDetail').textContent=data.forecast.customersIncluded?`${data.forecast.customersIncluded} configured subscriptions · ${data.forecast.missingPrice} eligible profiles missing a next-month price · offline status does not exclude a subscriber`:'No confirmed active subscription rates for next month.';
  const currentRevenueCount=data.revenueCollection.find(row=>row.month===data.currentMonth)?.billCount??0;
  $('#analyticsBilledRevenue').textContent=currentRevenueCount?formatAmount(data.currentBilledRevenue):'No bill entries';
  $('#analyticsBilledDetail').textContent=currentRevenueCount?`${currentRevenueCount} current-month bill price snapshots · service month, not cash`:'No current service-month bill price snapshots recorded.';
  $('#analyticsOutstanding').textContent=data.totalBills?formatAmount(data.currentOutstanding):'No bill entries';
  $('#analyticsOutstandingDetail').textContent=data.totalBills?`Current outstanding using saved bills, receipts, and sequential credit · as of ${data.asOf} PKT`:'No bill entries; no outstanding amount is inferred.';
  const currentArpu=data.currentServiceMonthArpu;
  $('#analyticsArpu').textContent=currentArpu.arpu===null?'Not set':formatAmount(currentArpu.arpu);
  $('#analyticsArpuDetail').textContent=`${currentArpu.billedRevenue===null?'No bill snapshots':formatAmount(currentArpu.billedRevenue)} ÷ ${currentArpu.activeSubscriptions} active configured subscriptions · Offline included · ${currentArpu.excludedSubscriptions} excluded`;
  const online=data.onlineOffline;
  $('#analyticsOnlinePercent').textContent=online.onlinePercent===null?'Not set':`${online.onlinePercent}%`;
  $('#analyticsOnlineDetail').textContent=`${online.online} Active ÷ ${online.denominator} Active + Offline · ${online.notSet} Not set excluded`;
  const monthGrowth=data.growth.find(row=>row.month===data.currentMonth);
  $('#analyticsNewConnections').textContent=data.hasConnectionDates?(monthGrowth?.newConnections??0):'Not set';
  $('#analyticsNewConnectionDetail').textContent=data.hasConnectionDates?'Recorded connection dates only; Offline is not churn.':'No real connection dates have been entered.';
  const revenueSvg=twoSeriesSvg(data.revenueCollection,{first:'billedRevenue',second:'cashCollection',firstLabel:'Billed revenue',secondLabel:'Cash collection',title:'Billed revenue by service month compared with actual cash received by date',isMoney:true});
  $('#revenueCollectionChart').innerHTML=data.hasRevenueRecords?revenueSvg:'<p class="empty-state">No bill or payment entries in this six-month window.</p>';
  const outstandingRows=data.monthEndOutstanding.map(row=>({month:row.month,outstanding:row.billCount?row.total:null}));
  $('#outstandingChart').innerHTML=data.totalBills?oneSeriesSvg(outstandingRows,{key:'outstanding',label:'Outstanding snapshot through month-end',title:'Historical outstanding balance snapshots at PKT month-end',isMoney:true}):'<p class="empty-state">No bill entries; historical outstanding snapshots are unavailable.</p>';
  const growthRows=data.growth.map(row=>({month:row.month,newConnections:row.newConnections,cumulative:row.cumulativeKnownActive}));
  $('#growthChart').innerHTML=data.hasConnectionDates?twoSeriesSvg(growthRows,{first:'newConnections',second:'cumulative',firstLabel:'New connections',secondLabel:'Dated active count',title:'Recorded new connections and cumulative active customers with known connection dates'}):'<p class="empty-state">No recorded connection dates in the six-month period.</p>';
  const incomeSvg=twoSeriesSvg(data.incomeExpense,{first:'income',second:'expenses',firstLabel:'Cash income',secondLabel:'Recorded expense',title:'Actual cash receipts compared with dated actual expenses',isMoney:true});
  $('#incomeExpenseChart').innerHTML=data.hasIncomeRecords||data.hasExpenseRecords?incomeSvg:'<p class="empty-state">No payment receipts or expense entries in this six-month window.</p>';
  const incomeLegend=$('#incomeLegend'); if(incomeLegend)incomeLegend.textContent=data.hasIncomeRecords?'Cash income':'Cash income · no entries';
  const expenseLegend=$('#expenseLegend'); if(expenseLegend)expenseLegend.textContent=data.hasExpenseRecords?'Recorded expense':'Expense · no entries';
  const denominator=online.denominator,onlineWidth=denominator?online.online/denominator*100:0,offlineWidth=denominator?online.offline/denominator*100:0;
  $('#onlineSnapshot').innerHTML=`<div class="online-snapshot-rail" role="img" aria-label="Manual status snapshot: ${online.online} active, ${online.offline} offline, ${online.notSet} not set"><span class="online-segment" style="width:${onlineWidth}%"></span><span class="offline-segment" style="width:${offlineWidth}%"></span></div><div class="online-snapshot-values"><span><i class="legend-online"></i>Active ${online.online}</span><span><i class="legend-offline"></i>Offline ${online.offline}</span><span>Not set ${online.notSet}</span><strong>${online.onlinePercent===null?'Online % not set':`${online.onlinePercent}% (${online.online}/${denominator})`}</strong></div>`;
  $('#areaSummaryTable').innerHTML=data.areaRows.map(row=>{
    const level=row.level==='mohalla'?'Mohalla':row.level==='zone'?'Zone':'Area';
    const value=row.area==='Zone not set'?'Not set':row.area.replace(/^(?:Area|Mohalla|Zone):\s*/,'');
    const location=`<span class="location-summary-label location-summary-${row.level}" style="--summary-depth:${row.depth}"><span class="location-summary-type">${level}</span><span class="location-summary-value">${phase3Cell(value)}</span></span>`;
    const context=row.parentArea?` within ${row.parentArea}`:' roll-up';
    return `<tr class="summary-row summary-row-${row.level}"><th scope="row" aria-label="${phase3Cell(`${row.area}${context}`)}">${location}<span class="sr-only">${phase3Cell(context)}</span></th><td>${row.customerCount}</td><td>${row.activeCustomers}</td><td>${row.hasBilledRevenue?phase3Cell(formatAmount(row.billedRevenue)):'No bill snapshots'}</td><td>${row.hasBillHistory?phase3Cell(formatAmount(row.outstanding)):'No bill entries'}</td><td>${row.excludedSubscriptions}</td><td>${row.onlinePercent===null?`Not set (${row.online}/${row.onlineDenominator})`:`${row.onlinePercent}% (${row.online}/${row.onlineDenominator})`}</td><td>${row.complaints}</td><td>${data.hasConnectionDates?row.newConnections:'Not set'}</td><td>${row.arpu===null?'Not set':`<strong class="summary-arpu">${phase3Cell(formatAmount(row.arpu))}</strong>`}</td></tr>`;
  }).join('');
  const namedAreas=data.areaRows.some(row=>row.level==='area');
  $('#areaSummaryEmpty').hidden=namedAreas;
  const unassigned=data.unassignedArea;
  $('#areaSummaryUnassigned').textContent=`Area not set: ${unassigned.profiles} profile${unassigned.profiles===1?'':'s'} (${unassigned.activeConfiguredSubscriptions} active configured; ${unassigned.withZone} with a zone, ${unassigned.withoutZone} without). ${unassigned.namedAreaProfilesWithoutZone} assigned profile${unassigned.namedAreaProfilesWithoutZone===1?'':'s'} have no zone. Profiles without an area are excluded from named-area rows.`;
  $('#packageSummaryTable').innerHTML=data.packageRows.map(row=>`<tr class="summary-row summary-row-package"><th scope="row">${phase3Cell(row.package)}</th><td>${row.customers}</td><td>${row.activeCustomers}</td><td>${row.hasBilledRevenue?phase3Cell(formatAmount(row.billedRevenue)):'No bill snapshots'}</td><td>${row.hasBillHistory?phase3Cell(formatAmount(row.outstanding)):'No bill entries'}</td><td>${row.excludedSubscriptions}</td><td>${row.newSubscriptions}</td><td>${row.expired}</td><td>${row.churn}</td><td>${row.arpu===null?'Not set':`<strong class="summary-arpu">${phase3Cell(formatAmount(row.arpu))}</strong>`}</td></tr>`).join('');
  const configuredPackages=data.packageRows.some(row=>row.packageKey!=='__package_not_set__');
  $('#packageSummaryEmpty').hidden=configuredPackages;
  $('#networkIssuesList').innerHTML=data.incidentCount?data.networkIssues.map(row=>`<li><span>${phase3Cell(monthName(row.month))}</span><strong>${row.count} recorded incident${row.count===1?'':'s'}</strong></li>`).join(''):`<li class="empty-state">No complaint or outage records have been entered.</li>`;
  $('#analyticsEmptyNotice').textContent=data.growthCumulativeIsPartial?`${data.knownUndatedConnections} customer profiles have no connection date; cumulative growth is therefore date-known only and is not a total historical customer count.`:'Historical summaries include only recorded local bills, receipts, dates, statuses, and incidents.';
}
function renderInventory() {
  const summary=inventorySummary(state),items=summary.items;
  const metric=(id,value)=>{const node=$(`#${id}`);if(node)node.textContent=value;};
  metric('inventoryTotalStock',summary.hasMovements?`${items.filter(item=>item.hasMovements).length} item types`:'Not set');
  metric('inventoryOnuStock',readableStock(items,'ONU'));metric('inventoryRouterStock',readableStock(items,'Router'));metric('inventoryFiberStock',readableStock(items,'Fiber cable'));metric('inventoryConnectorStock',readableStock(items,'Connector'));metric('inventoryAdapterStock',readableStock(items,'Adapter / power supply'));
  metric('inventoryLowStock',summary.hasMovements?String(summary.lowStockItems):'Not set');metric('inventoryInstalled',summary.hasMovements?String(summary.installed):'Not set');metric('inventoryDamaged',summary.hasMovements?String(summary.damaged):'Not set');metric('inventoryReturned',summary.hasMovements?String(summary.returned):'Not set');
  metric('inventoryValue',summary.hasMovements?formatAmount(summary.availableValue):'Not set');
  const itemsTable=$('#inventoryItemsTable');
  itemsTable.innerHTML=items.map(item=>`<tr><th scope="row">${phase3Cell(item.name)}</th><td>${phase3Cell(item.category)}</td><td>${item.hasMovements?new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(item.available):'Not recorded'}</td><td>${phase3Cell(item.unit)}</td><td>${new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(item.minimumStock)}</td><td>${item.unitCost===null||item.unitCost===undefined?'Not set':phase3Cell(formatAmount(item.unitCost))}</td><td>${item.hasMovements&&item.value!==null?phase3Cell(formatAmount(item.value)):'Not set'}</td><td>${item.hasMovements?`${item.installed} / ${item.damaged} / ${item.returned}`:'Not recorded'}</td><td><button type="button" class="edit-payment" data-edit-inventory="${phase3Cell(item.id)}">Edit</button></td></tr>`).join('');
  $('#inventoryItemsEmpty').hidden=items.length>0;
  const itemSelect=$('#movementItemId'),selected=itemSelect.value;
  itemSelect.innerHTML='<option value="">Choose item</option>'+items.map(item=>`<option value="${phase3Cell(item.id)}">${phase3Cell(item.name)} · ${phase3Cell(item.category)} (${phase3Cell(item.unit)})</option>`).join('');
  if(items.some(item=>item.id===selected))itemSelect.value=selected;
  const customerSelect=$('#movementCustomerId'),selectedCustomer=customerSelect.value;
  customerSelect.innerHTML='<option value="">Not assigned</option>'+state.customers.map(customer=>`<option value="${phase3Cell(customer.id)}">#${customer.customerNumber} ${phase3Cell(customer.name)}</option>`).join('');
  if(state.customers.some(customer=>customer.id===selectedCustomer))customerSelect.value=selectedCustomer;
  $('#inventoryMovementTable').innerHTML=summary.movements.map(row=>{const customer=state.customers.find(item=>item.id===row.customerId);const assignment=customer?`#${customer.customerNumber} ${phase3Cell(customer.name)}`:row.customerNameSnapshot?`#${phase3Cell(row.customerNumberSnapshot)} ${phase3Cell(row.customerNameSnapshot)} (profile removed)`: 'Not assigned';const action=({receive:'Receive / purchase',install:'Install / issue',issue:'Install / issue',return:'Return',damage:'Damage',correction:'Correction'})[row.type]??row.type;return `<tr><td>${phase3Cell(row.date)}</td><th scope="row">${phase3Cell(row.itemName)}</th><td>${phase3Cell(action)}</td><td>${new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(row.quantity)} ${phase3Cell(row.unit)}</td><td>${phase3Cell(row.fromState||'External')} → ${phase3Cell(row.toState||'Removed')}</td><td>${assignment}</td><td>${phase3Cell(row.notes||'Not recorded')}</td><td><button type="button" class="delete-incident" data-delete-movement="${phase3Cell(row.id)}">Delete</button></td></tr>`;}).join('');
  $('#inventoryMovementsEmpty').hidden=summary.movements.length>0;
  itemsTable.querySelectorAll('[data-edit-inventory]').forEach(button=>button.addEventListener('click',()=>{const item=items.find(row=>row.id===button.dataset.editInventory);if(!item)return;$('#inventoryItemId').value=item.id;$('#inventoryName').value=item.name;$('#inventoryCategory').value=item.category;$('#inventoryUnit').value=item.unit;$('#inventoryMinimum').value=item.minimumStock;$('#inventoryUnitCost').value=item.unitCost??'';$('#inventoryCreatedDate').value=item.createdDate??'';$('#inventoryNotes').value=item.notes??'';$('#inventoryItemSubmit').textContent='Save item changes';$('#inventoryItemCancel').hidden=false;$('#inventoryItemForm').scrollIntoView({behavior:'smooth',block:'center'});}));
  $('#inventoryMovementTable').querySelectorAll('[data-delete-movement]').forEach(button=>button.addEventListener('click',()=>{const movement=summary.movements.find(row=>row.id===button.dataset.deleteMovement);if(!movement||!window.confirm(`Delete the ${movement.type} movement of ${movement.quantity} ${movement.unit} dated ${movement.date}? This may change all current inventory balances.`))return;try{state=deleteStockMovement(state,movement.id);save();toast('Stock movement deleted from this device.');}catch(error){toast(error.message);}}));
}
function renderExpenses() {
  const payrollMonths=monthsForHistory();
  if(!payrollMonths.includes(selectedPayrollMonth))selectedPayrollMonth=payrollMonths[0];
  const payrollMonthSelect=$('#payrollMonth');
  if(!payrollMonthSelect.options.length)payrollMonthSelect.innerHTML=payrollMonths.map(month=>`<option value="${month}">${escapeHtml(monthName(month))}</option>`).join('');
  payrollMonthSelect.value=selectedPayrollMonth;
  const payroll=buildPayrollSummary(state,selectedPayrollMonth);
  $('#saadMonthlySalary').textContent=formatAmount(payroll.saadMonthlySalary);
  $('#saadEligibleCustomerCount').textContent=String(payroll.eligibleActivePaidCustomerCount);
  $('#saadSalaryDetail').textContent=`PKR ${payroll.saadBaseMonthlySalary.toLocaleString('en-PK')} base + PKR 200 × ${payroll.eligibleActivePaidCustomerCount} eligible customer${payroll.eligibleActivePaidCustomerCount===1?'':'s'}. Only post-${PAYROLL_RULES_EFFECTIVE_DATE} additions with current Active status, not archived, and a fully settled ${monthName(selectedPayrollMonth)} bill count.`;
  $('#saadAttendanceCount').textContent=payroll.attendanceDayCount?`${payroll.attendanceDayCount} unique day${payroll.attendanceDayCount===1?'':'s'}`:'No attendance entries';
  $('#umairWorkdayExpense').textContent=payroll.umairWorkdayCount?formatAmount(payroll.umairMonthlyExpense):'No workday entries';
  $('#umairWorkdayDetail').textContent=payroll.umairWorkdayCount?`${payroll.umairWorkdayCount} logged date${payroll.umairWorkdayCount===1?'':'s'} × PKR ${UMAIR_PER_LOGGED_WORKDAY.toLocaleString('en-PK')}`:'No recorded workdays; no amount is assumed.';
  $('#saadAttendanceList').innerHTML=payroll.attendanceDays.map(date=>`<li><time datetime="${date}">${date}</time><button type="button" class="delete-incident" data-remove-attendance="${date}">Remove</button></li>`).join('');
  $('#saadAttendanceEmpty').hidden=payroll.attendanceDays.length>0;
  $('#umairWorkdaysList').innerHTML=payroll.umairWorkdays.map(date=>`<li><time datetime="${date}">${date}</time><button type="button" class="delete-incident" data-remove-workday="${date}">Remove</button></li>`).join('');
  $('#umairWorkdaysEmpty').hidden=payroll.umairWorkdays.length>0;
  $('#saadAttendanceList').querySelectorAll('[data-remove-attendance]').forEach(button=>button.addEventListener('click',()=>{const date=button.dataset.removeAttendance;if(!window.confirm(`Remove Saad's manually logged attendance day dated ${date}?`))return;try{state=removeSaadAttendanceDay(state,date);save();toast('Attendance date removed from this device.');}catch(error){toast(error.message);}}));
  $('#umairWorkdaysList').querySelectorAll('[data-remove-workday]').forEach(button=>button.addEventListener('click',()=>{const date=button.dataset.removeWorkday;if(!window.confirm(`Remove Umair's manually logged workday dated ${date}?`))return;try{state=removeUmairWorkday(state,date);save();toast('Workday removed from this device.');}catch(error){toast(error.message);}}));
  const rows=[...(state.expenses??[])].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  $('#expenseEntryCount').textContent=rows.length?String(rows.length):'No entries';
  $('#expenseEntryHelp').textContent=rows.length?'Actual dated expenses recorded on this device.':'No expense entries recorded; not an assertion that spending was zero.';
  const current=buildPhase3Analytics(state,new Date()).currentMonth,monthRows=rows.filter(row=>row.date.slice(0,7)===current);
  $('#expenseCurrentMonthTotal').textContent=monthRows.length?formatAmount(monthRows.reduce((sum,row)=>sum+Number(row.amount),0)):'No entries';
  $('#expenseTable').innerHTML=rows.map(row=>`<tr><td>${phase3Cell(row.date)}</td><th scope="row">${phase3Cell(row.category)}</th><td>${phase3Cell(formatAmount(row.amount))}</td><td>${phase3Cell(row.notes||'Not recorded')}</td><td><button type="button" class="edit-payment" data-edit-expense="${phase3Cell(row.id)}">Edit</button> <button type="button" class="delete-incident" data-delete-expense="${phase3Cell(row.id)}">Delete</button></td></tr>`).join('');
  $('#expensesEmpty').hidden=rows.length>0;
  $('#expenseTable').querySelectorAll('[data-edit-expense]').forEach(button=>button.addEventListener('click',()=>{const row=rows.find(item=>item.id===button.dataset.editExpense);if(!row)return;$('#expenseId').value=row.id;$('#expenseDate').value=row.date;$('#expenseAmount').value=row.amount;$('#expenseCategory').value=row.category;$('#expenseNotes').value=row.notes??'';$('#expenseSubmit').textContent='Save expense correction';$('#expenseCancel').hidden=false;$('#expenseForm').scrollIntoView({behavior:'smooth',block:'center'});}));
  $('#expenseTable').querySelectorAll('[data-delete-expense]').forEach(button=>button.addEventListener('click',()=>{const row=rows.find(item=>item.id===button.dataset.deleteExpense);if(!row||!window.confirm(`Delete the ${formatAmount(row.amount)} ${row.category} expense dated ${row.date}?`))return;try{state=deleteExpense(state,row.id);save();toast('Expense entry deleted from this device.');}catch(error){toast(error.message);}}));
}
function renderPhase3() { renderAnalytics();renderInventory();renderExpenses(); }
function resetInventoryForm() { $('#inventoryItemForm').reset();$('#inventoryItemId').value='';$('#inventoryMinimum').value='0';$('#inventoryItemSubmit').textContent='Save item definition';$('#inventoryItemCancel').hidden=true; }
function resetExpenseForm() { $('#expenseForm').reset();$('#expenseId').value='';$('#expenseSubmit').textContent='Record actual expense';$('#expenseCancel').hidden=true; }
$('#inventoryItemForm').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget),fields={name:data.get('name'),category:data.get('category'),unit:data.get('unit'),minimumStock:data.get('minimumStock'),unitCost:data.get('unitCost')||null,createdDate:data.get('createdDate')||null,notes:data.get('notes')};try{const id=data.get('itemId');state=id?updateInventoryItem(state,id,fields):addInventoryItem(state,fields);save();resetInventoryForm();toast(id?'Inventory item updated on this device.':'Item definition saved; no stock was added.');}catch(error){toast(error.message);}});
$('#inventoryItemCancel').addEventListener('click',resetInventoryForm);
$('#inventoryMovementForm').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget),fields={itemId:data.get('itemId'),type:data.get('type'),quantity:data.get('quantity'),date:data.get('date'),fromState:data.get('fromState'),toState:data.get('toState'),customerId:data.get('customerId'),notes:data.get('notes')};try{state=addStockMovement(state,fields);save();event.currentTarget.reset();toast('Actual stock movement recorded on this device.');}catch(error){toast(error.message);}});
$('#expenseForm').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget),fields={date:data.get('date'),amount:data.get('amount'),category:data.get('category'),notes:data.get('notes')};try{const id=data.get('expenseId'),previous=id?state.expenses.find(row=>row.id===id):null;if(previous&&!window.confirm(`Correct the saved expense from ${formatAmount(previous.amount)} ${previous.category} on ${previous.date} to ${formatAmount(Number(fields.amount))} ${fields.category} on ${fields.date}?`))return;state=id?updateExpense(state,id,fields):addExpense(state,fields);save();resetExpenseForm();toast(id?'Expense correction saved on this device.':'Actual expense recorded on this device.');}catch(error){toast(error.message);}});
$('#expenseCancel').addEventListener('click',resetExpenseForm);
$('#saadAttendanceForm').addEventListener('submit',event=>{event.preventDefault();const date=new FormData(event.currentTarget).get('date');try{if((state.saadAttendanceDays??[]).includes(date)){toast('That attendance date is already recorded; no duplicate was added.');return;}state=addSaadAttendanceDay(state,date);save();event.currentTarget.reset();toast('Saad attendance day recorded on this device.');}catch(error){toast(error.message);}});
$('#umairWorkdayForm').addEventListener('submit',event=>{event.preventDefault();const date=new FormData(event.currentTarget).get('date');try{if((state.umairWorkdays??[]).includes(date)){toast('That workday is already recorded; no duplicate expense was added.');return;}state=addUmairWorkday(state,date);save();event.currentTarget.reset();toast('Umair workday recorded on this device.');}catch(error){toast(error.message);}});
$('#payrollMonth').addEventListener('change',event=>{if(!monthsForHistory().includes(event.currentTarget.value))return;selectedPayrollMonth=event.currentTarget.value;renderExpenses();});
$('#showAnalyticsButton').addEventListener('click',()=>{switchView('analytics');renderAnalytics();});
$('#showInventoryButton').addEventListener('click',()=>{switchView('inventory');renderInventory();});
$('#showExpensesButton').addEventListener('click',()=>{switchView('expenses');renderExpenses();});
renderPhase3();
