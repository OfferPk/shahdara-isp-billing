import { INITIAL_NAMES, PAYMENT_METHODS, MONTH_LIMIT, readState, persistState, monthsForHistory, addCustomer, deleteCustomer, updateMohalla, saveBillMonth, addPayment, correctPayment, recordedAmount, exportAllPayments, exportCustomerHistory } from './core.js';

const $ = selector => document.querySelector(selector);
const appShell = $('.app-shell');
const customerList = $('#customerList');
const historyContainer = $('#historyContainer');
let storageAvailable = true;
let state;
try { state = readState(localStorage); } catch { storageAvailable = false; state = { version: 1, customers: INITIAL_NAMES.map((name, i) => ({id:`seed-${String(i+1).padStart(3,'0')}`,name,mohalla:'',bills:[]})) }; }
let selectedCustomerId = null;
let toastTimer;
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const monthName = month => new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`));
const humanDate = date => new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));
const selectedCustomer = () => state.customers.find(c => c.id === selectedCustomerId);

function save() {
  try { persistState(state, localStorage); storageAvailable = true; }
  catch { storageAvailable = false; toast('Could not save. Check browser storage is available.'); }
}
function notify(message) {
  const toast = $('#toast'); toast.textContent = message; toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}
function initials(name) { return name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
function renderCustomers() {
  const query = $('#searchInput').value.trim().toLocaleLowerCase();
  const matches = state.customers.filter(c => c.name.toLocaleLowerCase().includes(query));
  customerList.innerHTML = matches.map(c => `<li class="customer-item"><button class="customer-select" type="button" data-customer-id="${escapeHtml(c.id)}" aria-current="${c.id === selectedCustomerId}"><span class="avatar" aria-hidden="true">${escapeHtml(initials(c.name))}</span><span class="customer-name">${escapeHtml(c.name)}</span><span class="no-record-dot" aria-label="${c.bills.length ? 'Has billing entries' : 'No billing entries'}"></span></button></li>`).join('');
  $('#customerCount').textContent = state.customers.length; $('#welcomeCount').textContent = state.customers.length;
  $('#noSearchResults').hidden = matches.length > 0 || state.customers.length === 0;
  customerList.querySelectorAll('[data-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.customerId)));
}
function statusPresentation(bill) {
  if (!bill) return {label:'Not recorded', className:'status-empty'};
  return bill.status === 'received' ? {label:'Received', className:'status-received'} : {label:'Pending', className:'status-pending'};
}
function renderHistory(customer) {
  const monthList = monthsForHistory();
  const byMonth = new Map(customer.bills.map(b => [b.month,b]));
  $('#customerEmptyNote').hidden = customer.bills.length > 0;
  historyContainer.innerHTML = monthList.map(month => {
    const bill = byMonth.get(month); const status = statusPresentation(bill); const received = bill ? recordedAmount(bill) : 0;
    const payments = (bill?.payments ?? []).map(payment => `<li class="payment-row" data-payment-row="${escapeHtml(payment.id)}"><span class="payment-main"><span class="payment-amount">${escapeHtml(payment.amount)} received</span><span class="payment-meta">${escapeHtml(humanDate(payment.date))} · ${escapeHtml(payment.method)}</span></span><button class="edit-payment" type="button" data-edit-payment="${escapeHtml(payment.id)}" data-month="${month}">Correct</button></li>`).join('');
    const statusValue = bill?.status ?? 'pending';
    const due = bill?.dueAmount ?? '';
    return `<details class="month-card" data-month-card="${month}"><summary><span class="month-label">${escapeHtml(monthName(month))}</span><span class="history-count">${bill ? `${bill.payments?.length ?? 0} payment${bill.payments?.length === 1 ? '' : 's'}` : ''}</span><span class="month-status ${status.className}">${status.label}</span></summary><div class="month-body">${!bill ? '<p class="empty-month">No billing details recorded for this month.</p>' : `<div class="month-summary"><span>Status: <strong>${status.label}</strong></span><span>Received: <strong>${received.toFixed(2)}</strong></span><span>Bill amount: <strong>${due === '' ? 'Not recorded' : escapeHtml(due)}</strong></span>${Number(due) > received && received > 0 ? '<span class="month-status status-pending">Partial payment</span>' : ''}</div>`}<div class="month-forms"><form class="form-card bill-form" data-kind="bill" data-month="${month}"><h4>${bill ? 'Update bill status' : 'Record bill details'}</h4><div class="form-grid"><label class="field-label full" for="due-${month}">Bill amount <span class="optional-label">Optional</span></label><input id="due-${month}" class="full" name="dueAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Leave blank if not known" value="${escapeHtml(due)}"><label class="field-label full" for="status-${month}">Monthly status</label><select id="status-${month}" class="full" name="status"><option value="pending" ${statusValue === 'pending' ? 'selected' : ''}>Pending</option><option value="received" ${statusValue === 'received' ? 'selected' : ''}>Received</option></select><button class="primary-button" type="submit">${bill ? 'Save bill details' : 'Record this month'}</button></div></form><form class="form-card payment-form" data-kind="payment" data-month="${month}"><h4>Record a payment</h4><div class="form-grid"><label class="field-label full" for="date-${month}">Payment date</label><input id="date-${month}" class="full" name="date" type="date" value="${localDate()}" required><label class="field-label full" for="amount-${month}">Amount received</label><input id="amount-${month}" class="full" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Enter actual amount" required><label class="field-label full" for="method-${month}">Payment method</label><select id="method-${month}" class="full" name="method" required><option value="">Choose a method</option>${PAYMENT_METHODS.map(method => `<option value="${method}">${method}</option>`).join('')}</select><button class="primary-button" type="submit">Add payment</button></div></form></div><ul class="payment-list" aria-label="Payments for ${escapeHtml(monthName(month))}">${payments}</ul></div></details>`;
  }).join('');
  historyContainer.querySelectorAll('form[data-kind="bill"]').forEach(form => form.addEventListener('submit', onBillSubmit));
  historyContainer.querySelectorAll('form[data-kind="payment"]').forEach(form => form.addEventListener('submit', onPaymentSubmit));
  historyContainer.querySelectorAll('[data-edit-payment]').forEach(button => button.addEventListener('click', () => beginCorrection(button.dataset.month, button.dataset.editPayment)));
}
function renderDetail() {
  const customer = selectedCustomer();
  $('#welcomeState').hidden = !!customer; $('#customerDetail').hidden = !customer;
  if (!customer) return;
  $('#detailName').textContent = customer.name; $('#mohallaInput').value = customer.mohalla ?? '';
  renderHistory(customer);
}
function selectCustomer(id) {
  if (!state.customers.some(c => c.id === id)) return;
  selectedCustomerId = id; appShell.classList.add('show-detail'); renderCustomers(); renderDetail();
  $('#detailPane').scrollTop = 0; window.scrollTo(0,0);
}
function downloadTxt(filename, text) {
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'}); const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
function onBillSubmit(event) {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
  try { state = saveBillMonth(state, selectedCustomerId, {month:form.dataset.month,dueAmount:data.get('dueAmount') || null,status:data.get('status')}); save(); renderCustomers(); renderHistory(selectedCustomer()); notify('Bill details saved on this device.'); }
  catch(error) { notify(error.message); }
}
function onPaymentSubmit(event) {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
  try { state = addPayment(state, selectedCustomerId, form.dataset.month, {date:data.get('date'),amount:data.get('amount'),method:data.get('method')}); save(); renderCustomers(); renderHistory(selectedCustomer()); notify('Payment recorded on this device.'); }
  catch(error) { notify(error.message); }
}
function beginCorrection(month, paymentId) {
  const customer = selectedCustomer(); const payment = customer?.bills.find(b => b.month === month)?.payments.find(p => p.id === paymentId); if (!payment) return;
  const row = historyContainer.querySelector(`[data-payment-row="${CSS.escape(paymentId)}"]`); if (!row) return;
  const options = PAYMENT_METHODS.map(method => `<option value="${method}" ${method === payment.method ? 'selected' : ''}>${method}</option>`).join('');
  row.innerHTML = `<form class="payment-form editing" data-kind="correct" data-month="${month}" data-payment-id="${escapeHtml(paymentId)}"><div class="form-grid"><label class="field-label full" for="edit-date-${escapeHtml(paymentId)}">Correct payment date</label><input id="edit-date-${escapeHtml(paymentId)}" class="full" name="date" type="date" value="${escapeHtml(payment.date)}" required><label class="field-label full" for="edit-amount-${escapeHtml(paymentId)}">Correct amount</label><input id="edit-amount-${escapeHtml(paymentId)}" class="full" name="amount" type="number" min="0.01" step="0.01" value="${escapeHtml(payment.amount)}" required><label class="field-label full" for="edit-method-${escapeHtml(paymentId)}">Correct method</label><select id="edit-method-${escapeHtml(paymentId)}" class="full" name="method">${options}</select><button class="primary-button" type="submit">Save correction</button><button class="secondary-button full" type="button" data-cancel-correction>Cancel</button></div></form>`;
  row.querySelector('form').addEventListener('submit', onCorrectionSubmit); row.querySelector('[data-cancel-correction]').addEventListener('click', () => renderHistory(selectedCustomer()));
}
function onCorrectionSubmit(event) {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
  try { state = correctPayment(state, selectedCustomerId, form.dataset.month, form.dataset.paymentId, {date:data.get('date'),amount:data.get('amount'),method:data.get('method')}); save(); renderHistory(selectedCustomer()); renderCustomers(); notify('Payment correction saved.'); }
  catch(error) { notify(error.message); }
}

$('#searchInput').addEventListener('input', renderCustomers);
$('#addCustomerButton').addEventListener('click', () => { $('#addCustomerError').hidden = true; $('#newCustomerName').value = ''; $('#addCustomerDialog').showModal(); $('#newCustomerName').focus(); });
$('#addCustomerForm').addEventListener('submit', event => {
  event.preventDefault(); const name = $('#newCustomerName').value;
  try { state = addCustomer(state, name); save(); $('#addCustomerDialog').close(); renderCustomers(); selectCustomer(state.customers.at(-1).id); notify('Customer added.'); }
  catch(error) { const errorBox = $('#addCustomerError'); errorBox.textContent = error.message; errorBox.hidden = false; }
});
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $('#addCustomerDialog').close()));
$('#saveMohallaButton').addEventListener('click', () => { if (!selectedCustomer()) return; state = updateMohalla(state, selectedCustomerId, $('#mohallaInput').value); save(); renderDetail(); notify('Mohalla saved on this device.'); });
$('#deleteCustomerButton').addEventListener('click', () => { const customer = selectedCustomer(); if (!customer || !window.confirm(`Delete ${customer.name} and all billing details stored for this customer on this device?`)) return; state = deleteCustomer(state, selectedCustomerId); selectedCustomerId = null; save(); appShell.classList.remove('show-detail'); renderCustomers(); renderDetail(); notify('Customer deleted from this device.'); });
$('#customerExportButton').addEventListener('click', () => { const customer = selectedCustomer(); if (customer) downloadTxt(`${customer.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-billing-history.txt`, exportCustomerHistory(state, customer.id)); });
$('#exportAllButton').addEventListener('click', () => downloadTxt('shahdara-isp-payment-details.txt', exportAllPayments(state)));
$('#backButton').addEventListener('click', () => { appShell.classList.remove('show-detail'); });
window.addEventListener('resize', () => { if (window.innerWidth > 620) appShell.classList.remove('show-detail'); });
renderCustomers(); renderDetail();
if (!storageAvailable) notify('Browser storage is unavailable. Entries may not persist.');
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
