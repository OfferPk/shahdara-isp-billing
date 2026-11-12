import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { addPayment, saveBillMonth, PAYMENT_METHODS } from '../core.js';
import * as bulk from '../bulk-collect.js';
import {
  createBatch, addEntry, batchTotals, commitBatch, entryDefaults
} from '../bulk-collect.js';
import { executeQuickCollection, getPendingCollectionCustomers } from '../nav-quick-collect.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');

// The new QC-10 exports do not exist on the pristine base: resolve them lazily
// so the behaviour tests fail (not the whole file) before the fix, while the
// pins below keep passing.
const need = name => {
  const fn = bulk[name];
  assert.equal(typeof fn, 'function', `${name} must be exported from bulk-collect.js (QC-10)`);
  return fn;
};

const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7); // PKT — the app derives the billing month in Asia/Karachi; plain toISOString() (UTC) is a month behind between 00:00–05:00 PKT on the 1st
const today = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10); // PKT
const customer = (id, n, extra = {}) => ({ id, customerNumber: n, name: `Customer ${n}`, phone: `0300000000${n}`, area: n % 2 ? 'Jia Musa' : 'Begum Kot', archived: false, bills: [], ...extra });

function makeState() {
  let s = { customers: [customer('a', 1), customer('b', 2), customer('c', 3), customer('d', 4)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 1500, status: 'pending' });
  s = saveBillMonth(s, 'c', { month, dueAmount: 1000, status: 'pending' });
  s = addPayment(s, 'c', month, { date: '2026-10-01', amount: 1000, method: 'Cash' }); // fully paid
  s = saveBillMonth(s, 'd', { month, dueAmount: 3000, status: 'pending' });
  s = addPayment(s, 'd', month, { date: '2026-10-02', amount: 1200, method: 'Cash' }); // partial
  return s;
}
const fieldsFor = (s, b, id, extra = {}) => ({ ...entryDefaults(s, b, id), method: 'Cash', note: '', ...extra });

// Three lines, three different methods — the QC-10 shape.
function mixedBatch(s) {
  let b = createBatch(today);
  b = addEntry(b, s, fieldsFor(s, b, 'a', { amount: 2000, method: 'Cash' })).batch;
  b = addEntry(b, s, fieldsFor(s, b, 'b', { amount: 1500, method: 'JazzCash' })).batch;
  b = addEntry(b, s, fieldsFor(s, b, 'd', { amount: 800, method: 'Easypaisa' })).batch;
  return b;
}

// ---- QC-10 behaviour: per-line method (pure helpers + markup builders) ----

test('methodOptionsHtml lists every payment method and marks exactly the selected one', () => {
  const methodOptionsHtml = need('methodOptionsHtml');
  const html = methodOptionsHtml('JazzCash');
  for (const m of PAYMENT_METHODS) assert.ok(html.includes(`<option value="${m}"`), `missing option ${m}`);
  assert.match(html, /<option value="JazzCash" selected>/);
  assert.equal((html.match(/ selected/g) || []).length, 1, 'exactly one option is selected');
  assert.equal((methodOptionsHtml('Nope').match(/ selected/g) || []).length, 0, 'an unknown selection marks nothing');
  assert.match(methodOptionsHtml('Cash'), /<option value="Cash" selected>/);
});

test('lineMethod: the picked method wins; otherwise the batch default; otherwise Cash', () => {
  const lineMethod = need('lineMethod');
  assert.equal(lineMethod('JazzCash', 'Cash'), 'JazzCash');
  assert.equal(lineMethod('', 'Easypaisa'), 'Easypaisa');
  assert.equal(lineMethod(undefined, 'Cash'), 'Cash');
  assert.equal(lineMethod(null, null), 'Cash');
});

test('applyBatchMethod updates only untouched lines (touched lines keep their method)', () => {
  const applyBatchMethod = need('applyBatchMethod');
  const s = makeState();
  const b = mixedBatch(s);
  const touched = new Set([b.entries[1].id]); // the JazzCash line was operator-picked
  const out = applyBatchMethod(b, 'Easypaisa', touched);
  assert.deepEqual(out.entries.map(e => e.method), ['Easypaisa', 'JazzCash', 'Easypaisa']);
  assert.equal(out.entries[1], b.entries[1], 'a touched entry keeps its object (and method)');
  assert.deepEqual(out.entries.map(e => e.amount), [2000, 1500, 800], 'amounts untouched');
  assert.deepEqual(out.entries.map(e => e.customerId), ['a', 'b', 'd'], 'order untouched');
  assert.equal(out.history, b.history, 'history carried over');
  assert.deepEqual(applyBatchMethod(b, 'Cash').entries.map(e => e.method), ['Cash', 'Cash', 'Cash'], 'no touched set: every line follows');
  assert.throws(() => applyBatchMethod(b, 'Bitcoin'), /valid payment method/);
});

test('pickRowHtml renders the compact 1-line row: amount + Add, no per-line method select (Bulk Collect Modal Fix item 2)', () => {
  const pickRowHtml = need('pickRowHtml');
  const row = { id: 'a', customerNumber: 1, name: 'Customer 1', area: 'Jia Musa', phone: '03000000001', status: 'due', totalDues: 2000, inBatch: false };
  const html = pickRowHtml(row, { amountValue: '2000' });
  // The per-row method select is gone by design: at phone widths it left
  // no room for the amount and pushed Add below the fold. The line takes
  // the batch default; per-line method lives on the review line (below).
  assert.ok(!html.includes('<select'), 'no per-row method select on the compact row');
  assert.ok(!html.includes('bc-method'), 'no method-select class');
  assert.match(html, /<input class="bc-amount"[^>]*value="2000"[^>]*data-bulk-amount="a"/);
  assert.match(html, /<button[^>]*data-bulk-add="a"[^>]*>\+ Add<\/button>/);
  assert.ok(html.includes('Jia Musa · Due PKR 2,000'), 'Mohalla · Due on the second line');
  assert.equal((html.match(/PKR 2,000/g) || []).length, 1, 'the due is printed exactly once (no badge + meta duplication)');
});

test('pickRowHtml escapes customer text (no raw markup leaks into the row)', () => {
  const pickRowHtml = need('pickRowHtml');
  const row = { id: 'x', customerNumber: 9, name: 'A <B> & "C"', area: 'Jia Musa', phone: '', status: 'paid', totalDues: 0, inBatch: false };
  const html = pickRowHtml(row, { amountValue: '' });
  assert.ok(!html.includes('<B>'), 'raw <B> must not appear');
  assert.ok(html.includes('A &lt;B&gt; &amp; &quot;C&quot;'), 'escaped name');
});

test('reviewItemHtml renders a per-line method select with the entry method selected', () => {
  const reviewItemHtml = need('reviewItemHtml');
  const s = makeState();
  const entry = mixedBatch(s).entries[1]; // JazzCash line
  const html = reviewItemHtml(entry);
  assert.match(html, new RegExp(`<select class="bc-review-method" data-bulk-review-method="${entry.id}" aria-label="Payment method for Customer 2">`));
  assert.match(html, /<option value="JazzCash" selected>/);
  assert.ok(html.includes('#2 · JazzCash'), 'review meta still names the method');
  assert.ok(html.includes('PKR 1,500'), 'amount shown');
  assert.match(html, new RegExp(`data-bulk-remove="${entry.id}"`));
});

test('reviewMetaHtml names the method, note and duplicate flag', () => {
  const reviewMetaHtml = need('reviewMetaHtml');
  assert.equal(
    reviewMetaHtml({ customerNumber: 2, method: 'JazzCash', note: 'Saad', confirmedDuplicate: true }),
    '#2 · JazzCash · Saad · <b class="bc-dup-flag">duplicate confirmed</b>'
  );
  assert.equal(
    reviewMetaHtml({ customerNumber: 1, method: 'Cash', note: '', confirmedDuplicate: false }),
    '#1 · Cash'
  );
});

test('commitBatch saves each entry with its own method (mixed batch)', () => {
  const s = makeState();
  const b = mixedBatch(s);
  const calls = [];
  const spy = (st, f) => { calls.push(f); return executeQuickCollection(st, f); };
  const { receipts } = commitBatch(s, b, spy);
  assert.equal(receipts.length, 3);
  assert.deepEqual(calls.map(c => [c.customerId, c.method]), [['a', 'Cash'], ['b', 'JazzCash'], ['d', 'Easypaisa']]);
});

test('batchTotals splits the total by method across mixed lines', () => {
  const b = mixedBatch(makeState());
  assert.deepEqual(batchTotals(b), { count: 3, total: 4300, byMethod: { Cash: 2000, JazzCash: 1500, Easypaisa: 800 } });
});

test('bulk-collect.css carries rules for the per-line selects that remain', () => {
  const css = read('bulk-collect.css');
  // Review lines keep their method select (QC-10); picker rows no longer
  // carry one (Bulk Collect Modal Fix item 2), so its rules are gone too.
  assert.ok(css.includes('.bc-review-method'), 'missing .bc-review-method rule');
  assert.ok(!css.includes('.bc-method'), '.bc-method rules must be gone with the picker-row select');
});

// ---- Pins: existing Bulk Collect behaviour that QC-10 must not change ----

test('PIN: createBatch shape is unchanged (no method field on the batch)', () => {
  assert.deepEqual(Object.keys(createBatch('2026-10-01')).sort(), ['date', 'entries', 'history']);
});

test('PIN: the batch-level method dropdown stays', () => {
  assert.ok(read('bulk-collect.js').includes('id="bulkCollectMethod"'), 'batch method dropdown removed?');
});

test('PIN: addEntry still validates method and defaults to Cash', () => {
  const s = makeState();
  const b = createBatch(today);
  assert.throws(() => addEntry(b, s, fieldsFor(s, b, 'a', { method: 'Bitcoin' })), /valid payment method/);
  assert.equal(addEntry(b, s, { ...entryDefaults(s, b, 'a'), amount: 100 }).added.method, 'Cash');
});

test('PIN: one Save still saves the whole batch (commitBatch records every entry)', () => {
  const s = makeState();
  const { nextState, receipts } = commitBatch(s, mixedBatch(s));
  assert.equal(receipts.length, 3);
  assert.ok(!getPendingCollectionCustomers(nextState, '', 'all-dues').some(r => r.id === 'a'), 'a paid in full');
  assert.ok(!getPendingCollectionCustomers(nextState, '', 'all-dues').some(r => r.id === 'b'), 'b paid in full');
  assert.equal(getPendingCollectionCustomers(nextState, '', 'all-dues').find(r => r.id === 'd').totalDues, 1000, 'd partial stays with remainder');
});

test('PIN: bulk-collect.css adds no new hex colour (37-colour cap holds)', () => {
  const css = read('bulk-collect.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(css.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.ok(distinct.size <= 37, `bulk-collect.css has ${distinct.size} distinct hex colours, cap is 37`);
});
