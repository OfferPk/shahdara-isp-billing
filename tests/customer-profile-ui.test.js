import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment, calculatePaymentAllocations, listTransactions } from '../core.js';
import { currentBillPresentation, contactActionTargets, buildGlobalLedgerSearch, createReceiptWhatsAppDraft, resolveReceiptWhatsAppAction } from '../profile-ui.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const helper = read('profile-ui.js');
const styles = read('styles.css');

function syntheticCustomer(bill) {
  return {
    id:'synthetic-customer-1',
    customerNumber:1,
    name:'Synthetic Test Customer',
    monthlySellingAmount:1200,
    phone:'',
    bills:bill ? [bill] : []
  };
}
function present(bill) {
  const customer = syntheticCustomer(bill);
  const allocations = calculatePaymentAllocations({ customers:[customer] });
  return currentBillPresentation(customer, '2026-09', allocations);
}

const fullPaidTemplate = `🧾 SHAHDARA ISP — PAYMENT RECEIPT

👤 Customer: TEHMENA
🆔 Customer #: 3

💰 Amount Paid: PKR 2,000
📅 Payment Date: Oct 5 2026
💳 Method: Cash
📆 Billing Month: Oct 2026

✅ Status: PAID
💵 Outstanding: PKR 0

━━━━━━━━━━━━━━
📅 Next Bill Due: Nov 5 2026

⚠️ Please pay by the 5th to avoid service interruption. thanks 🥰`;

test('customer profiles open in read-only mode and existing fields are revealed only by Edit', () => {
  assert.match(index, /id="customerProfileView"[^>]*class="customer-profile-view"/);
  assert.match(index, /id="customerProfileForm"[^>]*hidden/);
  assert.match(app, /id="editProfileButton"[^>]*>Edit<\/button>/);
  assert.match(index, /id="cancelProfileEditButton"/);
  assert.match(app, /profileEditMode = true;[\s\S]*?customerProfileView'\)\.hidden = true[\s\S]*?customerProfileForm'\)\.hidden = false/);
  assert.match(app, /cancelProfileEditButton'\)\.addEventListener\('click', \(\) => \{ profileEditMode = false; renderDetail\(\); \}\)/);
  assert.match(app, /profileEditMode = false;\s*save\(\); renderDetail\(\)/);
});

test('current bill status and net due use only saved bill values and existing receipt/credit allocations', () => {
  const pending = present({ id:'synthetic-bill-1', month:'2026-09', dueAmount:1200, payments:[] });
  assert.equal(pending.billAmount, 1200);
  assert.equal(pending.status, 'pending');
  assert.equal(pending.statusLabel, 'Pending');
  assert.equal(pending.balanceDueCents, 120000);
  assert.equal(pending.balanceDueLabel, 'PKR 1,200');

  const partial = present({ id:'synthetic-bill-2', month:'2026-09', dueAmount:1200, payments:[{ id:'synthetic-receipt-1', date:'2026-09-02', amount:300, method:'Cash' }] });
  assert.equal(partial.status, 'partial');
  assert.equal(partial.balanceDueCents, 90000);
  assert.equal(partial.balanceDueLabel, 'PKR 900');

  const paid = present({ id:'synthetic-bill-3', month:'2026-09', dueAmount:1200, payments:[{ id:'synthetic-receipt-2', date:'2026-09-02', amount:1200, method:'Cash' }] });
  assert.equal(paid.status, 'paid');
  assert.equal(paid.statusLabel, 'Paid');
  assert.equal(paid.balanceDueCents, 0);
  assert.equal(paid.balanceDueLabel, 'PKR 0');
});

test('an absent bill is Not set even when a monthly selling price exists', () => {
  const absent = present(null);
  assert.equal(absent.billAmount, null);
  assert.equal(absent.billAmountLabel, 'Not set');
  assert.equal(absent.status, 'not-set');
  assert.equal(absent.statusLabel, 'Not set');
  assert.equal(absent.balanceDueCents, null);
  assert.equal(absent.balanceDueLabel, 'Not set');
});

test('help disclosures and profile tabs have accessible names, relationships, and keyboard support', () => {
  assert.match(index, /<details class="help-tip[^\"]*"><summary class="help-icon" aria-label="Billing dashboard guidance" aria-controls="dashboardGuidance">/);
  assert.match(index, /id="dashboardGuidance" class="help-tip-content" role="tooltip"/);
  assert.match(index, /id="filterGuidance" class="help-tip-content" role="tooltip"/);
  for (const [tabId,panelId,label] of [
    ['profileTabBilling','profilePanelBilling','Billing &amp; Ledger'],
    ['profileTabInfo','profilePanelInfo','Customer Info'],
    ['profileTabComplaints','profilePanelComplaints','Complaints']
  ]) {
    assert.match(index, new RegExp(`id="${tabId}"[^>]*role="tab"[^>]*aria-controls="${panelId}"`));
    assert.match(index, new RegExp(`id="${panelId}"[^>]*role="tabpanel"[^>]*aria-labelledby="${tabId}"`));
    assert.ok(index.includes(label));
  }
  assert.match(app, /event\.key === 'ArrowRight'/);
  assert.match(app, /event\.key === 'ArrowLeft'/);
  assert.match(app, /event\.key === 'Home'/);
  assert.match(app, /event\.key === 'End'/);
});

test('complaints tab mounts existing incident records and empty state without a new storage model', () => {
  assert.match(index, /id="incidentList" class="incident-list"/);
  assert.match(index, /id="incidentEmptyNote" class="incident-empty"/);
  assert.match(app, /complaints:\['\.incident-section'\]/);
  assert.match(app, /addIncident\(state, selectedCustomerId, fields\)/);
  assert.match(app, /updateIncident\(state, selectedCustomerId, data\.get\('incidentId'\), fields\)/);
  assert.match(app, /deleteIncident\(state, customerId, incidentId\)/);
  assert.doesNotMatch(helper, /localStorage|STORAGE_KEY|incidents\s*=\s*\[\]/);
});

test('saved-phone shortcuts require an explicit international number for WhatsApp and never guess a country code', () => {
  assert.equal(contactActionTargets(''), null);
  assert.equal(contactActionTargets('   '), null);
  assert.equal(contactActionTargets('extension only'), null);
  assert.deepEqual(contactActionTargets('+92 (300) 123-4567'), {
    tel:'tel:+923001234567',
    whatsapp:'https://wa.me/923001234567'
  });
  assert.deepEqual(contactActionTargets('0300-1234567'), { tel:'tel:03001234567', whatsapp:null });
  assert.equal(contactActionTargets('+92 300 123 4567 ext 9'), null);
  assert.equal(contactActionTargets('+9999999999999999').whatsapp, null);
  assert.match(app, /href="\$\{escapeHtml\(phoneTargets\.tel\)\}"/);
  assert.match(app, /href="\$\{escapeHtml\(phoneTargets\.whatsapp\)\}" target="_blank" rel="noopener noreferrer"/);
  assert.match(index, /Phone \/ WhatsApp number/);
});

test('global search preview shows exact partial and paid bill state and actual receipt entries', () => {
  const referenceDate = new Date(2026, 8, 29, 12);
  let state = createInitialState(['Synthetic Partial','Synthetic Paid']);
  state = saveBillMonth(state, 'seed-001', { month:'2026-09', dueAmount:'1200', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', '2026-09', { date:'2026-09-12', amount:'300', method:'Easypaisa' }, referenceDate);
  state = saveBillMonth(state, 'seed-002', { month:'2026-09', dueAmount:'800', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-002', '2026-09', { date:'2026-09-13', amount:'800', method:'JazzCash' }, referenceDate);

  const partial = buildGlobalLedgerSearch(state, 'Synthetic Partial', '2026-09');
  assert.equal(partial.length, 1);
  assert.equal(partial[0].billing.statusLabel, 'Partial');
  assert.equal(partial[0].billing.billAmountLabel, 'PKR 1,200');
  assert.equal(partial[0].billing.receivedAmountLabel, 'PKR 300');
  assert.equal(partial[0].billing.balanceDueLabel, 'PKR 900');
  assert.equal(partial[0].receipts[0].date, '2026-09-12');
  assert.equal(partial[0].receipts[0].method, 'Easypaisa');
  const paid = buildGlobalLedgerSearch(state, 'Paid', '2026-09');
  assert.deepEqual(paid.map(result => result.customer.id), ['seed-002']);
  assert.equal(paid[0].billing.statusLabel, 'Paid');
});

test('each actual profile-history receipt has one customer-bound draft action and a direct phone-field route when needed', () => {
  const start = app.indexOf('const payments = (bill?.payments ?? []).map(payment => {');
  const end = app.indexOf("    }).join('');", start);
  assert.ok(start >= 0 && end > start, 'profile payment row renderer is present');
  const paymentRenderer = app.slice(start, end);
  assert.equal((paymentRenderer.match(/receiptWhatsAppActionMarkup\(/g) ?? []).length, 1);
  assert.match(paymentRenderer, /customerId:customer\.id/);
  assert.match(paymentRenderer, /paymentId:payment\.id/);
  assert.match(app, /receiptWhatsAppActionMarkup\(customer, transaction\)/);
  assert.match(app, /function bindReceiptPhoneActions\(container\)/);
  assert.match(app, /bindReceiptPhoneActions\(historyContainer\)/);
  assert.match(app, /bindReceiptPhoneActions\(transactionList\)/);
  assert.match(app, /selectCustomer\(customerId\);[\s\S]*?profileEditMode = true;[\s\S]*?activateProfileTab\('info'\);[\s\S]*?phoneInput\.focus\(\)/);
  assert.match(app, /class="receipt-phone-help"/);
  assert.match(styles, /\.receipt-whatsapp-action,\.receipt-phone-help\{[^}]*min-height:44px/);
});

test('receipt draft safely encodes actual customer and payment fields', () => {
  const draft = createReceiptWhatsAppDraft('+92 (300) 123-4567', {
    customerName:"O'Brien & Sons\nsecond line",
    customerNumber:7,
    amount:1250,
    date:'2026-09-12',
    method:'Easypaisa',
    month:'2026-09'
  });
  assert.ok(draft);
  const url = new URL(draft.url);
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/923001234567');
  assert.equal(url.searchParams.get('text'), draft.message);
  assert.match(draft.url, /%0A/);
  assert.match(draft.url, /%26/);
  assert.match(draft.url, /%F0%9F/);
  for (const detail of ["O'Brien & Sons second line", 'Customer #: 7', 'Amount Received: PKR 1,250', 'Payment Date: Sep 12 2026', 'Method: Easypaisa', 'Billing Month: Sep 2026']) assert.ok(draft.message.includes(detail));
  assert.doesNotMatch(draft.message, /\nsecond line|Other Customer|Other receipt/);
});

test('fully-paid draft exactly matches the approved receipt template and calculates the next fifth from bill month', () => {
  const receipt = {
    customerName:'TEHMENA', customerNumber:3, amount:2000, date:'2026-10-05', method:'Cash', month:'2026-10',
    billStatus:'paid', billAmount:2000, balanceDueCents:0, billDueDate:'2026-10-05'
  };
  const original = JSON.stringify(receipt);
  const draft = createReceiptWhatsAppDraft('+92 300 123 4567', receipt);
  assert.equal(JSON.stringify(receipt), original, 'draft creation does not mutate the saved receipt context');
  assert.equal(draft.message, fullPaidTemplate);
  const url = new URL(draft.url);
  assert.equal(url.searchParams.get('text'), fullPaidTemplate);

  const yearBoundaryDraft = createReceiptWhatsAppDraft('+92 300 123 4567', {
    ...receipt, date:'2027-01-20', month:'2026-12', billDueDate:'2026-12-05'
  });
  assert.match(yearBoundaryDraft.message, /📅 Next Bill Due: Jan 5 2027/);
  assert.doesNotMatch(yearBoundaryDraft.message, /Feb 5 2027/);
});

test('partial receipt shows actual received amount, outstanding balance and saved current due date only', () => {
  const draft = createReceiptWhatsAppDraft('+92 300 123 4567', {
    customerName:'Synthetic Test Customer', customerNumber:1, amount:300, date:'2026-10-10', method:'Cash', month:'2026-10',
    billStatus:'partial', billAmount:1200, balanceDueCents:90000, billDueDate:'2026-10-05'
  });
  for (const detail of ['💰 Amount Received: PKR 300', '📅 Payment Date: Oct 10 2026', '📆 Billing Month: Oct 2026', '🟠 Status: PARTIAL', '💵 Outstanding: PKR 900', '💳 Bill Amount: PKR 1,200', '📅 Current Bill Due: Oct 5 2026']) {
    assert.ok(draft.message.includes(detail), `partial receipt contains ${detail}`);
  }
  assert.doesNotMatch(draft.message, /Status: PAID|Outstanding: PKR 0|Next Bill Due:/);

  const contradictoryPaidDraft = createReceiptWhatsAppDraft('+92 300 123 4567', {
    customerName:'Synthetic Test Customer', customerNumber:1, amount:300, date:'2026-10-10', method:'Cash', month:'2026-10',
    billStatus:'paid', billAmount:1200, balanceDueCents:90000, billDueDate:'2026-10-05'
  });
  assert.doesNotMatch(contradictoryPaidDraft.message, /Status: PAID|Outstanding: PKR 0|Next Bill Due:/);
});

test('receipt action uses the selected customer phone/name/number and rejects a cross-customer receipt', () => {
  const customer = { id:'synthetic-owner-3', name:'TEHMENA', customerNumber:3, phone:'+92 300 123 4567' };
  const receipt = {
    customerId:'synthetic-owner-3', paymentId:'synthetic-payment-3', customerPhone:'+1 202 555 0199',
    customerName:'Wrong Customer', customerNumber:99, amount:2000, date:'2026-10-05', method:'Cash', month:'2026-10', paidBy:'Tanveer',
    billStatus:'paid', billAmount:2000, balanceDueCents:0
  };
  const action = resolveReceiptWhatsAppAction(customer, receipt);
  assert.equal(action.type, 'draft');
  const url = new URL(action.draft.url);
  assert.equal(url.pathname, '/923001234567', 'the target comes only from the owning profile');
  const expectedWithPayer = fullPaidTemplate.replace('🆔 Customer #: 3\n\n', '🆔 Customer #: 3\nPaid by: Tanveer\n\n');
  assert.equal(action.draft.message, expectedWithPayer);
  assert.doesNotMatch(action.draft.message, /Wrong Customer|Customer #: 99|202 555 0199/);

  const mismatch = resolveReceiptWhatsAppAction(customer, { ...receipt, customerId:'synthetic-other-owner' });
  assert.deepEqual(mismatch, { type:'unavailable', reason:'customer-mismatch' });
});

test('missing or invalid saved phone returns a profile-field route instead of targeting another customer', () => {
  const receipt = { customerId:'synthetic-owner', amount:10, date:'2026-09-12', method:'Cash', month:'2026-09', customerNumber:1 };
  const missing = resolveReceiptWhatsAppAction({ id:'synthetic-owner', name:'Synthetic Customer', customerNumber:1, phone:'' }, receipt);
  assert.deepEqual(missing, { type:'phone-required', hasSavedPhone:false });
  for (const phone of ['0300-1234567', 'not-a-number', '+92 300 123 4567 ext 9']) {
    const action = resolveReceiptWhatsAppAction({ id:'synthetic-owner', name:'Synthetic Customer', customerNumber:1, phone }, receipt);
    assert.deepEqual(action, { type:'phone-required', hasSavedPhone:true });
  }
  assert.equal(createReceiptWhatsAppDraft('0300-1234567', { ...receipt, customerName:'Synthetic Customer' }), null);
  assert.equal(createReceiptWhatsAppDraft('not-a-number', { ...receipt, customerName:'Synthetic Customer' }), null);
  assert.match(app, /data-edit-receipt-phone=/);
  assert.match(app, /function editCustomerPhoneFromReceipt\(customerId\)/);
  assert.match(app, /activateProfileTab\('info'\)/);
});

test('drafts reject invalid receipt fields and never auto-send or call a WhatsApp API', () => {
  const receipt = { customerName:'Synthetic Customer', customerNumber:1, amount:10, date:'2026-09-12', method:'Cash', month:'2026-09' };
  assert.equal(createReceiptWhatsAppDraft('+92 300 123 4567', { ...receipt, date:'2026-02-30' }), null);
  assert.equal(createReceiptWhatsAppDraft('+92 300 123 4567', { ...receipt, amount:0 }), null);
  assert.equal(createReceiptWhatsAppDraft('+92 300 123 4567', { ...receipt, customerNumber:null }), null);
  assert.equal(createReceiptWhatsAppDraft('+92 300 123 4567', { ...receipt, method:'Unknown' }), null);
  assert.match(app, /href="\$\{escapeHtml\(action\.draft\.url\)\}" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(app, /fetch\([^)]*wa\.me|window\.open\([^)]*wa\.me|sendText|autoSend/i);
});

test('transaction receipt drafts retain saved partial status, balance, payer and due date', () => {
  const referenceDate = new Date('2026-10-04T19:00:00.000Z');
  let state = createInitialState(['Synthetic Receipt QA']);
  state = saveBillMonth(state, 'seed-001', { month:'2026-10', dueAmount:'1200', dueDate:'2026-10-05', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', '2026-10', { date:'2026-10-10', amount:'300', method:'Easypaisa', paidBy:'Tanveer' }, referenceDate);
  const [row] = listTransactions(state, {}, referenceDate);
  assert.equal(row.status, 'partial');
  assert.equal(row.billAmount, 1200);
  assert.equal(row.balanceDueCents, 90000);
  assert.equal(row.billDueDate, '2026-10-05');
  assert.equal(row.paidBy, 'Tanveer');
  const customer = { ...state.customers[0], phone:'+92 300 123 4567' };
  const action = resolveReceiptWhatsAppAction(customer, row);
  assert.equal(action.type, 'draft');
  assert.match(action.draft.message, /Paid by: Tanveer/);
  assert.match(action.draft.message, /Status: PARTIAL/);
  assert.match(action.draft.message, /Outstanding: PKR 900/);
  assert.match(action.draft.message, /Current Bill Due: Oct 5 2026/);
  assert.doesNotMatch(action.draft.message, /Status: PAID|Next Bill Due:/);
});

test('new-payment and correction forms expose an optional, non-autofilled payer field', () => {
  assert.match(app, /Paid by \(optional\)/);
  assert.match(app, /autocomplete="off"/);
  assert.match(app, /paidBy:data\.get\('paidBy'\)/);
  assert.match(app, /paidBy:payment\.paidBy/);
  assert.match(app, /receiptWhatsAppActionMarkup\(customer, transaction\)/);
  assert.match(app, /correctPayment\(state,[^\n]*paidBy:data\.get\('paidBy'\)/);
  assert.match(app, /function paymentPayerMarkup\(payment\)/);
  assert.match(app, /Paid by: \$\{escapeHtml\(paidBy\)\}/);
});
