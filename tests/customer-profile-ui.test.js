import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment, calculatePaymentAllocations, listTransactions } from '../core.js';
import { currentBillPresentation, contactActionTargets, buildGlobalLedgerSearch, createReceiptWhatsAppDraft } from '../profile-ui.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const helper = read('profile-ui.js');

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
  assert.match(index, /<details class="help-tip[^"]*"><summary class="help-icon" aria-label="Billing dashboard guidance" aria-controls="dashboardGuidance">/);
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
  let state = createInitialState();
  state = saveBillMonth(state, 'seed-001', { month:'2026-09', dueAmount:'1200', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', '2026-09', { date:'2026-09-12', amount:'300', method:'Easypaisa' }, referenceDate);
  state = saveBillMonth(state, 'seed-002', { month:'2026-09', dueAmount:'800', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-002', '2026-09', { date:'2026-09-13', amount:'800', method:'JazzCash' }, referenceDate);

  const partial = buildGlobalLedgerSearch(state, 'Nazeer', '2026-09');
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

test('WhatsApp receipt draft encodes one customer’s amount, date, method, and bill context for manual review', () => {
  const draft = createReceiptWhatsAppDraft('+92 (300) 123-4567', {
    customerName:"O'Brien & Sons",
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
  for (const detail of ['O\'Brien & Sons', 'Customer #: 7', 'Amount received: PKR 1,250', 'Date: 2026-09-12', 'Payment method: Easypaisa', 'Bill month: 2026-09']) assert.ok(draft.message.includes(detail));
  assert.doesNotMatch(draft.message, /Other Customer|Other receipt/);
});

test('invalid or incomplete phone/receipt data never produces a WhatsApp draft; opening a draft never auto-sends', () => {
  const receipt = { customerName:'Synthetic Customer', customerNumber:1, amount:10, date:'2026-09-12', method:'Cash', month:'2026-09' };
  assert.equal(createReceiptWhatsAppDraft('0300-1234567', receipt), null);
  assert.equal(createReceiptWhatsAppDraft('not-a-number', receipt), null);
  assert.equal(createReceiptWhatsAppDraft('+92 300 123 4567', { ...receipt, date:'2026-02-30' }), null);
  assert.equal(createReceiptWhatsAppDraft('+92 300 123 4567', { ...receipt, amount:0 }), null);
  assert.equal(createReceiptWhatsAppDraft('+92 300 123 4567', { ...receipt, method:'Unknown' }), null);
  assert.match(app, /receiptWhatsAppActionMarkup/);
  assert.match(app, /href="\$\{escapeHtml\(draft\.url\)\}" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(app, /fetch\([^)]*wa\.me|window\.open\([^)]*wa\.me|sendText|autoSend/i);
});

test('fully paid receipt states the next fifth from the bill month and includes the warm 5th/12th reminder', () => {
  const octoberReceipt = {
    customerName:'Synthetic Test Customer', customerNumber:1, amount:1200, date:'2026-10-05', method:'Easypaisa', month:'2026-10',
    billStatus:'paid', billAmount:1200, balanceDueCents:0, billDueDate:'2026-10-05'
  };
  const original = JSON.stringify(octoberReceipt);
  const octoberDraft = createReceiptWhatsAppDraft('+92 300 123 4567', octoberReceipt);
  assert.equal(JSON.stringify(octoberReceipt), original, 'draft creation does not mutate the stored receipt context');
  for (const detail of ['Bill status: Paid', 'Bill amount: PKR 1,200', 'Remaining balance: PKR 0', 'Next bill due: November 5, 2026', 'pay by the 5th', 'by the 12th', 'may be temporarily suspended', 'service will be restored after payment is received and confirmed']) {
    assert.ok(octoberDraft.message.toLowerCase().includes(detail.toLowerCase()), `receipt contains ${detail}`);
  }

  const yearBoundaryDraft = createReceiptWhatsAppDraft('+92 300 123 4567', {
    ...octoberReceipt, date:'2027-01-20', month:'2026-12', billDueDate:'2026-12-05'
  });
  assert.match(yearBoundaryDraft.message, /Next bill due: January 5, 2027/);
  assert.doesNotMatch(yearBoundaryDraft.message, /Next bill due: February 5, 2027/);
});

test('partial receipt shows the outstanding balance and saved current due date but never advances to the next cycle or claims Paid', () => {
  const draft = createReceiptWhatsAppDraft('+92 300 123 4567', {
    customerName:'Synthetic Test Customer', customerNumber:1, amount:300, date:'2026-10-10', method:'Cash', month:'2026-10',
    billStatus:'partial', billAmount:1200, balanceDueCents:90000, billDueDate:'2026-10-05'
  });
  for (const detail of ['Amount received: PKR 300', 'Bill status: Partial', 'Bill amount: PKR 1,200', 'Remaining balance: PKR 900', 'Current bill due date: October 5, 2026', 'by the 12th', 'may be temporarily suspended', 'service will be restored after payment is received and confirmed']) {
    assert.ok(draft.message.toLowerCase().includes(detail.toLowerCase()), `partial receipt contains ${detail}`);
  }
  assert.doesNotMatch(draft.message, /Bill status: Paid|Next bill due:/);

  const contradictoryPaidDraft = createReceiptWhatsAppDraft('+92 300 123 4567', {
    customerName:'Synthetic Test Customer', customerNumber:1, amount:300, date:'2026-10-10', method:'Cash', month:'2026-10',
    billStatus:'paid', billAmount:1200, balanceDueCents:90000, billDueDate:'2026-10-05'
  });
  assert.doesNotMatch(contradictoryPaidDraft.message, /Bill status: Paid|Next bill due:/);
});

test('transaction-history receipt drafts use the saved bill status, balance and due date', () => {
  const referenceDate = new Date('2026-10-04T19:00:00.000Z');
  let state = createInitialState(['Synthetic Receipt QA']);
  state = saveBillMonth(state, 'seed-001', { month:'2026-10', dueAmount:'1200', dueDate:'2026-10-05', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', '2026-10', { date:'2026-10-10', amount:'300', method:'Easypaisa' }, referenceDate);
  const [row] = listTransactions(state, {}, referenceDate);
  assert.equal(row.status, 'partial');
  assert.equal(row.billAmount, 1200);
  assert.equal(row.balanceDueCents, 90000);
  assert.equal(row.billDueDate, '2026-10-05');
  const draft = createReceiptWhatsAppDraft('+92 300 123 4567', row);
  assert.match(draft.message, /Bill status: Partial/);
  assert.match(draft.message, /Remaining balance: PKR 900/);
  assert.match(draft.message, /Current bill due date: October 5, 2026/);
  assert.doesNotMatch(draft.message, /Next bill due:/);
});
