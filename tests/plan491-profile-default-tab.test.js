// Plan 491 — Profile opens on Customer Info, not Billing.
//
// The operator opens a profile to see the customer, not the ledger, so
// the default tab is Customer Info: opening any customer shows the
// profile heading, header strip and Edit without a tab tap, and the
// Billing and Complaints tabs still work exactly as before.
//
// The default tab is expressed in three places, and all three must
// agree — the `selectedProfileTab` variable (arrow-key navigation
// starts from it), `selectCustomer` (which forced Billing on every
// open), and the static HTML initial state (which governs the first
// paint before any script runs). The tab mechanism itself —
// `profileTabMap`, `mountCustomerProfileContent`, the click bindings
// and the arrow-key handler — is untouched.
//
// Synthetic data only; no real customer names or phone numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJs = readFileSync(join(root, 'app.js'), 'utf8');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

// Body of one top-level function, sliced by string position so the
// assertion cannot leak into a neighbouring function.
function functionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `missing ${signature}`);
  const next = source.indexOf('\nfunction ', start + signature.length);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

test('Plan 491: the default selected profile tab is info, not billing', () => {
  assert.ok(appJs.includes("let selectedProfileTab = 'info';"),
    "selectedProfileTab must default to 'info'");
  assert.ok(!appJs.includes("let selectedProfileTab = 'billing';"),
    "no billing default may remain");
});

test('Plan 491: opening a customer (selectCustomer) activates the info tab', () => {
  const body = functionBody(appJs, 'function selectCustomer(id');
  assert.ok(body.includes("activateProfileTab('info')"),
    'selectCustomer must open on the info tab');
  assert.ok(!appJs.includes("activateProfileTab('billing')"),
    'nothing may force the billing tab on open');
});

test('Plan 491: the static HTML starts with Customer Info selected and visible', () => {
  assert.match(indexHtml,
    /id="profileTabInfo"[^>]*aria-selected="true"[^>]*tabindex="0"/,
    'Info tab starts selected and tabbable');
  assert.match(indexHtml,
    /id="profileTabBilling"[^>]*aria-selected="false"[^>]*tabindex="-1"/,
    'Billing tab starts unselected and untabbable');
  assert.match(indexHtml,
    /id="profileTabComplaints"[^>]*aria-selected="false"[^>]*tabindex="-1"/,
    'Complaints tab starts unselected and untabbable');
  assert.match(indexHtml,
    /id="profilePanelInfo"[^>]*role="tabpanel"[^>]*aria-labelledby="profileTabInfo"[^>]*tabindex="0">/,
    'Info panel starts visible (no hidden attribute)');
  assert.match(indexHtml,
    /id="profilePanelBilling"[^>]*role="tabpanel"[^>]*aria-labelledby="profileTabBilling"[^>]*tabindex="0" hidden>/,
    'Billing panel starts hidden');
  assert.match(indexHtml,
    /id="profilePanelComplaints"[^>]*role="tabpanel"[^>]*aria-labelledby="profileTabComplaints"[^>]*tabindex="0" hidden>/,
    'Complaints panel starts hidden');
});

test('Plan 491: the tab mechanism is untouched — map, mounts, bindings, keys', () => {
  assert.match(appJs, /billing:\['profileTabBilling','profilePanelBilling'\]/);
  assert.match(appJs, /info:\['profileTabInfo','profilePanelInfo'\]/);
  assert.match(appJs, /complaints:\['profileTabComplaints','profilePanelComplaints'\]/);
  assert.ok(appJs.includes("billing:['#customerReceiptSummary'"),
    'billing mount group kept');
  assert.ok(appJs.includes("info:['.customer-meta'"),
    'info mount group kept — the profile view and edit form live there');
  assert.ok(appJs.includes("complaints:['.incident-section:not(.uptime-section)']"),
    'complaints mount group kept');
  assert.ok(appJs.includes("$(`#${tabId}`).addEventListener('click', () => activateProfileTab(name));"),
    'click bindings kept');
  assert.match(appJs, /event\.key === 'ArrowRight'/, 'arrow-key nav kept');
  assert.match(appJs, /event\.key === 'ArrowLeft'/, 'arrow-key nav kept');
  assert.match(appJs, /event\.key === 'Home'/, 'Home key kept');
  assert.match(appJs, /event\.key === 'End'/, 'End key kept');
});

test('Plan 491: the edit flows still switch to the info tab', () => {
  // editCustomerPhoneFromReceipt, editCustomerProfile, selectCustomer and
  // now the Plan 494 header "Edit name" handler all activate 'info' —
  // four call sites. (Plan 494: the Edit name button opens the form,
  // which lives in the Info panel, so it lands there too.)
  const calls = appJs.match(/activateProfileTab\('info'\)/g) || [];
  assert.equal(calls.length, 4,
    `expected 4 activateProfileTab('info') call sites, found ${calls.length}`);
  assert.match(appJs,
    /function editCustomerProfile\(id[\s\S]*?activateProfileTab\('info'\)/,
    'edit flow still lands on info');
});
