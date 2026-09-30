import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculatePaymentAllocations } from '../core.js';
import { currentBillPresentation, contactActionTargets } from '../profile-ui.js';

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

test('saved-phone shortcuts are derived without country-code inference and never send or auto-activate', () => {
  assert.equal(contactActionTargets(''), null);
  assert.equal(contactActionTargets('   '), null);
  assert.equal(contactActionTargets('extension only'), null);
  assert.deepEqual(contactActionTargets('+92 (300) 123-4567'), {
    tel:'tel:+923001234567',
    whatsapp:'https://wa.me/923001234567'
  });
  assert.equal(contactActionTargets('0300-1234567').whatsapp, 'https://wa.me/03001234567');
  assert.match(app, /href="\$\{escapeHtml\(phoneTargets\.tel\)\}"/);
  assert.match(app, /href="\$\{escapeHtml\(phoneTargets\.whatsapp\)\}" target="_blank" rel="noopener"/);
  assert.doesNotMatch(app, /fetch\([^)]*(?:wa\.me|phoneTargets)|window\.open\([^)]*(?:wa\.me|phoneTargets)|sendText|autoSend/i);
});
