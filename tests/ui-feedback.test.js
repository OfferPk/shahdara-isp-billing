import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferToastType, inferTitle, defaultDuration, pakistanToday, TOAST_TYPES, stripLeadingIcon } from '../ui-feedback.js';
import { readdirSync } from 'node:fs';

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

// #297: every literal toast message in the app. A message that is a warning or failure must never be
// shown as a green success, whether the caller passed { type } or the fallback guess decides.
function literalToasts() {
  const root = new URL('../', import.meta.url);
  const re = /\b(?:toast|onToast|showToast)\(\s*(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*(,\s*[^)]{0,160})?/g;
  const out = [];
  for (const f of readdirSync(root).filter(n => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, root), 'utf8');
    let m;
    while ((m = re.exec(src))) {
      const msg = m[1].slice(1, -1).replace(/\$\{[^}]*\}/g, 'X');
      const explicit = /type\s*:\s*['"](\w+)/.exec(m[2] || '')?.[1];
      out.push({ f, msg, type: explicit || inferToastType(msg) });
    }
  }
  return out;
}

test('no warning or failure toast comes out as success (#297)', () => {
  const all = literalToasts();
  assert.ok(all.length > 500, `found ${all.length} literal toast messages`);
  const bad = all.filter(t => t.type === 'success' && (/^\W*no\s/i.test(t.msg) || /not applied|missing|unavailable|not supported|could not|couldn't|failed|unable to/i.test(t.msg)));
  assert.deepEqual(bad.map(t => `${t.f}: ${t.msg}`), []);
});

test('negative wording is checked before success words (#297)', () => {
  assert.equal(inferToastType('No phone number saved for customer.'), 'warning');
  assert.equal(inferToastType('No phone saved. Receipt copied to clipboard!'), 'warning');
  assert.equal(inferToastType('Customer saved, but the package/fee was not applied: x'), 'error');
  assert.equal(inferToastType('Customer phone missing. Statement summary copied to clipboard.'), 'warning');
  assert.equal(inferToastType('No saved records to export.'), 'info');
  assert.equal(inferToastType('No saved handover record to print.'), 'info');
  assert.equal(inferToastType('Please select a customer first.'), 'warning');
  assert.equal(inferToastType('Backup shared successfully! Keep it safe.'), 'success');
  assert.equal(inferToastType('✓ Package set for 74 customers'), 'success');
  // Callers pass the type for the cases in #297.
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const plan = readFileSync(new URL('../customer-plan.js', import.meta.url), 'utf8');
  assert.match(qc, /type: 'warning', title: 'No phone number'/);
  assert.match(qc, /actionLabel = 'Add phone'/);
  assert.match(plan, /was not applied: \$\{err\.message\}`, \{ type: 'error'/);
});

test('a leading ✓ / ⚠️ / ❌ is dropped because the toast shows its own icon (#297)', () => {
  assert.equal(stripLeadingIcon('✓ Package set for 74 customers'), 'Package set for 74 customers');
  assert.equal(stripLeadingIcon('✅ Done'), 'Done');
  assert.equal(stripLeadingIcon('⚠️ Duplicate reference'), 'Duplicate reference');
  assert.equal(stripLeadingIcon('❌ Failed'), 'Failed');
  assert.equal(stripLeadingIcon('Payment recorded'), 'Payment recorded');
});

test('toasts in dialogs go to the top and pause only on real pointer movement (#296)', () => {
  const src = readFileSync(new URL('../ui-feedback.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../ui-feedback.css', import.meta.url), 'utf8');
  assert.match(src, /classList\.toggle\('tsx-in-dialog', inDialog\)/);
  assert.match(src, /onpointermove = \(\) => pause\(rec\)/);
  assert.doesNotMatch(src, /onmouseenter = \(\) => pause/);
  assert.match(src, /attributeFilter: \['open'\]/, 'a toast already showing moves above a dialog that opens');
  assert.match(css, /\.tsx-stack\.tsx-in-dialog[^{]*\{\s*top:/);
});

test('inventory, expenses and attendance use the in-app confirm', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const uses = app.match(/window\.confirm\(/g) || [];
  assert.equal(uses.length, 1, 'only the no-ui-feedback fallback inside appConfirm() remains');
  assert.ok(app.indexOf('window.confirm(') > app.indexOf('function appConfirm('));
  assert.ok(app.indexOf('window.confirm(') < app.indexOf('function duplicateTxnConfirm('));
  for (const title of ['Delete this stock movement?', 'Remove this attendance day?', 'Remove this workday?', 'Delete this expense?', 'Save this expense correction?']) assert.ok(app.includes(title), title);
});
