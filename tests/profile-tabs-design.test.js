// Profile tabs design: compact month cards, 2-col month forms, 2-col
// billing metrics on phones, themed incident pill/form (dark mode).
// Layout-only package: no billing logic, no field, no id, no behaviour
// is removed. These tests guard the markup hooks and the CSS rules so a
// later edit cannot silently re-expand the profile or drop a field.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJs = readFileSync(join(root, 'app.js'), 'utf8');
const stylesCss = readFileSync(join(root, 'styles.css'), 'utf8');

test('profile tabs: month summary renders as stat cells, not bare rows', () => {
  const stats = appJs.match(/month-summary-stat/g) || [];
  // Status, due date, receipts, carry-in credit, bill amount, balance due
  // + 3 conditional credit lines = 9 core stat cells.
  assert.ok(stats.length >= 9, `expected >= 9 month-summary-stat cells, found ${stats.length}`);
  const wide = appJs.match(/month-summary-wide/g) || [];
  // Late-fee row, Apply-Late-Fee button row, partial-payment badge.
  assert.ok(wide.length >= 3, `expected >= 3 month-summary-wide rows, found ${wide.length}`);
});

test('profile tabs: month forms use form-cell wrappers, all fields kept', () => {
  const cells = appJs.match(/<div class="form-cell">/g) || [];
  // Bill form: amount + due date = 2; payment form: amount, method,
  // paid-by, date, txn id, discount = 6 — plus the payment-proof file
  // field added by the 2026-10-29 proof-screenshot feature = 7, plus
  // the SISP-63 sender name + sender last-4 fields next to the txn id
  // = 9.
  assert.equal(cells.length, 11, `expected 11 form-cell wrappers, found ${cells.length}`);
  for (const name of ['name="dueAmount"', 'name="dueDate"', 'name="packageId"',
    'name="amount"', 'name="method"', 'name="paidBy"', 'name="date"',
    'name="transactionId"', 'name="senderTitle"', 'name="senderDigits"',
    'name="proofScreenshot"', 'name="discount"', 'name="discountReason"']) {
    assert.ok(appJs.includes(name), `month form lost field ${name}`);
  }
  for (const id of ['due-', 'due-date-', 'package-', 'amount-', 'method-',
    'paid-by-', 'date-', 'txnid-', 'sender-name-', 'sender-digits-', 'proof-', 'discount-', 'discount-reason-']) {
    assert.ok(appJs.includes(id), `month form lost id prefix ${id}`);
  }
  // phase 3: month-form labels render via t() (English values pinned in urdu-auto-phase3.test.js)
  for (const key of ['prof_hist_bill_update', 'prof_hist_bill_record',
    'prof_hist_pay_title', 'prof_hist_bill_save', 'prof_hist_pay_submit',
    'prof_hist_apply_fee']) {
    assert.ok(appJs.includes(`t('${key}'`), `month form lost label/button ${key}`);
  }
  assert.ok(appJs.includes('data-kind="bill"'), 'bill form data-kind kept');
  assert.ok(appJs.includes('data-kind="payment"'), 'payment form data-kind kept');
});

test('profile tabs: billing metrics grid + incidents section kept', () => {
  assert.ok(appJs.includes('profile-summary-grid'), 'billing metrics grid kept');
  assert.ok(appJs.includes('profile-summary-stat'), 'billing metric cards kept');
  assert.ok(appJs.includes('renderIncidents'), 'legacy incidents renderer kept');
  assert.ok(appJs.includes('incidentList'), 'incident list kept');
  assert.ok(appJs.includes('incidentCount30Days'), 'incident 30-day count kept');
  assert.ok(appJs.includes('incident-section'), 'incident section kept');
});

test('profile tabs: phone CSS uses compact 2-col grids', () => {
  assert.match(stylesCss, /\.month-summary\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    'month summary must be a 2-col grid on phones');
  assert.match(stylesCss, /\.month-forms\s+\.form-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    'month forms must use a 2-col field grid');
  assert.match(stylesCss, /\.profile-summary-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    'billing metrics must stay 2-col on phones');
  assert.match(stylesCss, /\.form-grid\s+\.form-cell\s*\{[^}]*display:\s*flex/,
    'form cells must stack label above control');
});

test('profile tabs: dark-mode rules theme the incident pill and form', () => {
  assert.match(stylesCss, /\[data-theme="dark"\]\s+\.incident-count\s*\{[^}]*var\(--dk-surface\)/,
    'incident count pill must use the dark surface token, never white');
  assert.match(stylesCss, /\[data-theme="dark"\]\s+\.incident-form\s*\{[^}]*var\(--dk-surface\)/,
    'incident form must use the dark surface token');
  assert.match(stylesCss, /\[data-theme="dark"\]\s+\.month-summary-stat\s*>\s*strong\s*\{[^}]*var\(--dk-ink\)/,
    'month summary values must use dark ink');
});
