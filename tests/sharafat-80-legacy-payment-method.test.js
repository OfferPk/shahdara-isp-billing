// Sharafat 80 — editing a payment whose method is a legacy/retired name
// must preserve the method unless the operator changes it.
//
// The live failure was silent data corruption, not a blocked save: the
// correction form built its method <select> only from PAYMENT_METHODS,
// so with a legacy stored method the browser showed the FIRST option
// ('Cash') and an unrelated correction silently REWROTE the method.
// The fix has two halves, both required: (i) correctionForm offers the
// stored method as an extra selected option (escaped, labelled as-is);
// (ii) correctPayment passes the stored method to validatePayment as a
// legacyMethod option, so the save accepts the payment's OWN stored
// method and still refuses any OTHER non-listed method.
//
// No actually-retired method exists in the repo today (both "legacy"
// shop spellings are still in PAYMENT_METHODS), so the fixture is the
// pattern-fake 'Cash at Alpha shop' — already a non-listed method in
// tests/morning-briefing.test.js, shop-aging-alert.test.js and
// shop-performance-analytics.test.js. No real customer names, no phone
// numbers anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  addPayment, correctPayment, validatePayment, previewJsonBackupMerge,
  BACKUP_FORMAT, PAYMENT_METHODS,
} from '../core.js';
import { paymentMethodGroup } from '../billing-ledger-presentation.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Pattern-fake retired shop method (see header). 'Cheque' is the
// established non-listed method pinned as refused by addPayment in
// tests/core.test.js:484.
const LEGACY = 'Cash at Alpha shop';
const HOSTILE = 'Cash at <script>alert(1)</script> shop';
const REF = new Date('2026-11-16T00:00:00Z');
const MONTH = '2026-10';

const stateWith = (method, extra = {}) => ({
  customers: [{
    id: 'cust-1', customerNumber: 1, name: 'Test Customer',
    bills: [{
      id: 'bill-1', month: MONTH,
      payments: [{ id: 'pay-1', date: '2026-10-05', amount: 1000, method, ...extra }],
    }],
  }],
});
const kept = (out) => out.customers[0].bills[0].payments[0];

// ---------- Functional: correctPayment keeps the stored method ----------

test('Sharafat 80: correctPayment keeps a legacy method on an amount-only change', () => {
  const out = correctPayment(stateWith(LEGACY), 'cust-1', MONTH, 'pay-1',
    { date: '2026-10-05', amount: 1200, method: LEGACY }, REF);
  assert.equal(kept(out).method, LEGACY);
  assert.equal(kept(out).amount, 1200);
});

test('Sharafat 80: correctPayment keeps a legacy method on a date-only change', () => {
  const out = correctPayment(stateWith(LEGACY), 'cust-1', MONTH, 'pay-1',
    { date: '2026-10-06', amount: 1000, method: LEGACY }, REF);
  assert.equal(kept(out).method, LEGACY);
  assert.equal(kept(out).date, '2026-10-06');
});

test('Sharafat 80: correctPayment legacy -> Cash still saves (operator change works)', () => {
  const out = correctPayment(stateWith(LEGACY), 'cust-1', MONTH, 'pay-1',
    { date: '2026-10-05', amount: 1000, method: 'Cash' }, REF);
  assert.equal(kept(out).method, 'Cash');
});

test('Sharafat 80: correctPayment legacy -> a DIFFERENT non-listed method still throws', () => {
  assert.throws(() => correctPayment(stateWith(LEGACY), 'cust-1', MONTH, 'pay-1',
    { date: '2026-10-05', amount: 1000, method: 'Cheque' }, REF),
  /valid payment method/);
});

test('Sharafat 80: correctPayment current -> non-listed method still throws', () => {
  assert.throws(() => correctPayment(stateWith('Cash'), 'cust-1', MONTH, 'pay-1',
    { date: '2026-10-05', amount: 1000, method: 'Cheque' }, REF),
  /valid payment method/);
});

test('Sharafat 80: correctPayment keeps a current method on an amount-only change', () => {
  const out = correctPayment(stateWith('Cash'), 'cust-1', MONTH, 'pay-1',
    { date: '2026-10-05', amount: 1200, method: 'Cash' }, REF);
  assert.equal(kept(out).method, 'Cash');
  assert.equal(kept(out).amount, 1200);
});

test('Sharafat 80: addPayment with a legacy method still throws (new payments stay current-only)', () => {
  assert.throws(() => addPayment(stateWith('Cash'), 'cust-1', MONTH,
    { date: '2026-10-05', amount: 500, method: LEGACY }, REF),
  /valid payment method/);
});

test('Sharafat 80: shop-settled legacy payment, amount-only correction saves and keeps the stamp', () => {
  const out = correctPayment(stateWith(LEGACY, { shopSettledAmount: 500 }), 'cust-1', MONTH, 'pay-1',
    { date: '2026-10-05', amount: 1200, method: LEGACY }, REF);
  assert.equal(kept(out).method, LEGACY);
  assert.equal(kept(out).shopSettledAmount, 500);
});

test('Sharafat 80: shop-settled payment, method CHANGED still throws the channel error first', () => {
  assert.throws(() => correctPayment(stateWith(LEGACY, { shopSettledAmount: 500 }), 'cust-1', MONTH, 'pay-1',
    { date: '2026-10-05', amount: 1000, method: 'Cash' }, REF),
  /channel cannot be changed|shop-settled/i);
});

test('Sharafat 80: validatePayment alone still refuses a legacy method (the allowance lives in correctPayment)', () => {
  assert.throws(() => validatePayment({ date: '2026-10-05', amount: 1000, method: LEGACY }, REF),
    /valid payment method/);
});

// ---------- The exemption is equality-scoped to a non-empty stored method ----------

test('Sharafat 80: validatePayment accepts the method when it equals the legacyMethod option', () => {
  const out = validatePayment({ date: '2026-10-05', amount: 1000, method: LEGACY }, REF, { legacyMethod: LEGACY });
  assert.equal(out.method, LEGACY);
});

test('Sharafat 80: validatePayment refuses a non-listed method that is NOT the legacyMethod', () => {
  assert.throws(() => validatePayment({ date: '2026-10-05', amount: 1000, method: 'Cheque' }, REF, { legacyMethod: LEGACY }),
    /valid payment method/);
});

test('Sharafat 80: validatePayment still refuses a missing method when no legacyMethod is passed', () => {
  assert.throws(() => validatePayment({ date: '2026-10-05', amount: 1000 }, REF),
    /valid payment method/);
  assert.throws(() => validatePayment({ date: '2026-10-05', amount: 1000, method: '' }, REF),
    /valid payment method/);
});

test('Sharafat 80: an empty legacyMethod is not an exemption (missing method still throws)', () => {
  assert.throws(() => validatePayment({ date: '2026-10-05', amount: 1000, method: '' }, REF, { legacyMethod: '' }),
    /valid payment method/);
  assert.throws(() => validatePayment({ date: '2026-10-05', amount: 1000 }, REF, { legacyMethod: undefined }),
    /valid payment method/);
});

// ---------- Render: the real correctionForm from app.js ----------
// Free variables inside correctionForm: PAYMENT_METHODS, escapeHtml,
// localDate, paidByFieldMarkup, collectionPlaceNoteFieldsMarkup,
// sameDayCorrectionNoteFieldsMarkup. Pure ESM, no node_modules.
const appJs = read('app.js');
const formStart = appJs.indexOf('function correctionForm(');
const formEnd = appJs.indexOf('\nfunction beginCorrection', formStart);
assert.notEqual(formStart, -1, 'correctionForm must exist in app.js');
assert.notEqual(formEnd, -1, 'beginCorrection must follow correctionForm');
const escapeHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const factory = new Function('PAYMENT_METHODS', 'escapeHtml', 'localDate', 'paidByFieldMarkup', 'collectionPlaceNoteFieldsMarkup', 'sameDayCorrectionNoteFieldsMarkup',
  `${appJs.slice(formStart, formEnd)}\nreturn correctionForm;`);
const correctionForm = factory(PAYMENT_METHODS, escapeHtml, () => '2026-11-16', () => '', () => '', () => '');
const render = (method) => correctionForm({ id: 'pay-1', date: '2026-10-05', amount: 1000, method }, 'cust-1', MONTH, 'history');
const optionTags = (html) => [...html.matchAll(/<option[^>]*>[^<]*<\/option>/g)].map((m) => m[0]);

test('Sharafat 80: correctionForm offers the stored legacy method, selected', () => {
  const selected = optionTags(render(LEGACY)).find((o) => o.includes('selected'));
  assert.ok(selected, 'a selected option must exist');
  assert.ok(selected.includes(`value="${LEGACY}"`), `selected option must be the stored legacy method, got ${selected}`);
});

test('Sharafat 80: the legacy option is escaped — a hostile stored method renders with no literal <script>', () => {
  const html = render(HOSTILE);
  assert.ok(!html.includes('<script>'), 'unescaped <script> in rendered form');
  const selected = optionTags(html).find((o) => o.includes('selected'));
  assert.ok(selected && selected.includes('value="Cash at &lt;script&gt;'), `no escaped selected option for the stored method, got ${selected}`);
});

test('Sharafat 80: correctionForm with a current method has exactly one selected option, no duplicate', () => {
  const html = render('Cash');
  const selected = optionTags(html).filter((o) => o.includes('selected'));
  assert.equal(selected.length, 1);
  assert.ok(selected[0].includes('value="Cash"'));
  assert.equal(optionTags(html).filter((o) => o.includes('value="Cash"')).length, 1, 'duplicate Cash option');
});

test('Sharafat 80: correctionForm with a blank stored method adds no blank option', () => {
  assert.ok(!optionTags(render('')).some((o) => o.includes('value=""')), 'blank option present');
});

// ---------- Scope guards: everything else stays current-only ----------

test('Sharafat 80: the record form offers only current methods + a blank Choose (new payments only)', () => {
  const m = appJs.match(/<select id="method-[^>]*required>.*?<\/select>/);
  assert.ok(m, 'record-form method select not found');
  assert.ok(m[0].includes('<option value="">'), 'blank Choose option missing');
  assert.ok(m[0].includes('PAYMENT_METHODS.map(method =>'), 'options not built from PAYMENT_METHODS');
  assert.ok(!m[0].includes('payment.method'), 'record form references stored payment.method');
});

test('Sharafat 80: the kist payoff refusal for genuinely unknown methods is intact', () => {
  assert.ok(appJs.includes('Unknown payment method:'), 'payoff refusal string missing');
});

test('Sharafat 80: the reassign modal refusal is intact (deliberate-change flow)', () => {
  assert.ok(read('payment-method-reassign.js').includes('Choose a valid payment method'), 'reassign refusal missing');
});

test('Sharafat 80: the Quick Collect record refusal is intact', () => {
  assert.ok(read('nav-quick-collect.js').includes('Choose a valid payment method from:'), 'QC refusal missing');
});

test('Sharafat 80: a legacy method groups as cash, no crash', () => {
  assert.equal(paymentMethodGroup(LEGACY), 'cash');
});

// ---------- Disclosed, NOT fixed here: the backup surface ----------

test('Sharafat 80: a backup containing a legacy-method payment still fails restore preview (disclosed, follow-up owns the backup rule)', () => {
  // validateBackupState requires a bill status ('pending'/'received') —
  // add it to the backup copy only; the method check is what this
  // case exercises.
  const backupCustomers = stateWith(LEGACY).customers.map((c) => ({ ...c, bills: c.bills.map((b) => ({ ...b, status: 'received' })) }));
  const backup = JSON.stringify({ format: BACKUP_FORMAT, formatVersion: 1, state: { version: 1, customers: backupCustomers } });
  assert.throws(() => previewJsonBackupMerge(stateWith('Cash'), backup), /valid payment method/);
});
