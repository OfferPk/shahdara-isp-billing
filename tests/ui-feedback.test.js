import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferToastType, inferTitle, defaultDuration, pakistanToday, TOAST_TYPES } from '../ui-feedback.js';

test('toast type is inferred from existing app messages', () => {
  assert.equal(inferToastType('Payment recorded on this device.'), 'success');
  assert.equal(inferToastType('Customer deleted from this device.'), 'success');
  assert.equal(inferToastType('Could not save. Check browser storage is available.'), 'error');
  assert.equal(inferToastType('Invalid Pakistani phone number.'), 'error');
  assert.equal(inferToastType('Please enter a Transaction ID or an override reason for digital payments.'), 'error');
  assert.equal(inferToastType('⚠️ Duplicate reference'), 'warning');
  assert.equal(inferToastType('Edit this customer’s international WhatsApp number, then select Save profile.'), 'info');
  for (const t of ['success', 'error', 'warning', 'info']) assert.ok(TOAST_TYPES[t].icon && TOAST_TYPES[t].title);
});

test('success titles and durations', () => {
  assert.equal(inferTitle('success', 'Customer profile saved on this device.'), 'Saved');
  assert.equal(inferTitle('success', 'Payment undone. Ledger restored.'), 'Undone');
  assert.equal(inferTitle('success', 'Customer deleted from this device.'), 'Deleted');
  assert.equal(inferTitle('error', 'anything'), null);
  assert.equal(defaultDuration('success', false), 4000);
  assert.equal(defaultDuration('error', false), 6000);
  assert.ok(defaultDuration('success', true) >= 7000, 'toasts with Undo stay long enough to tap');
});

test('Pakistan date for payment date default', () => {
  assert.equal(pakistanToday(new Date('2026-10-19T20:30:00Z')), '2026-10-20');
  assert.equal(pakistanToday(new Date('2026-10-19T10:00:00Z')), '2026-10-19');
});

test('customer and payment flows use the in-app confirm, not window.confirm (#279)', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  for (const fn of ['onPaymentSubmit', 'onCorrectionSubmit', 'requestDeletePayment', 'requestDeleteIncident']) {
    const start = app.indexOf(`function ${fn}(`);
    assert.ok(start > 0, fn);
    const body = app.slice(start, app.indexOf('\n}\n', start));
    assert.doesNotMatch(body, /window\.confirm\(/, `${fn} must not use window.confirm`);
  }
  for (const id of ['deleteCustomerButton', 'archiveCustomerButton', 'saveMohallaButton']) {
    const start = app.indexOf(`$('#${id}').addEventListener`);
    const body = app.slice(start, app.indexOf('\n});', start));
    assert.doesNotMatch(body, /window\.confirm\(/, `${id} must not use window.confirm`);
  }
  assert.doesNotMatch(qc, /window\.confirm\(/, 'Quick Collect duplicate warning is the in-app card only');
  // Delete keeps an Undo window and offers Archive instead.
  assert.match(app, /title:`#\$\{customer\.customerNumber\} \$\{customer\.name\} deleted`[^\n]*actionLabel:'Undo'/);
  assert.match(app, /altLabel: customer\.archived \? '' : 'Archive instead'/);
});
