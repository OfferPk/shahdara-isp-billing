// Sharafat 62 — Transactions lists archived customers' payments with no
// marker, as if they were live. Pure-module behaviour is tested directly;
// app-level wiring is pinned by source-text assertions, the repo's pattern
// for app.js (no unit test imports app.js directly).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listTransactions } from '../core.js';
import { generateCsvContent } from '../form-validation.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const componentsCss = read('components.css');
const paymentsListCss = read('payments-list.css');

// Generic placeholder fixtures only (no real customer names; the
// 03012345678 phone is the repo's pattern-fake family).
function customer(id, n, archived) {
  return {
    id, customerNumber: n, name: archived ? 'Test Archived' : 'Test Live',
    phone: '03012345678', archived,
    bills: [{ id: `b${n}`, month: '2026-10', status: 'received', dueAmount: 3000,
      payments: [{ id: `p${n}`, date: '2026-10-05', amount: 3000, method: 'Cash' }] }],
  };
}
const state = { customers: [customer('c-live', 1, false), customer('c-arch', 2, true)] };
const rows = listTransactions(state);
const live = rows.find(r => r.customerId === 'c-live');
const arch = rows.find(r => r.customerId === 'c-arch');

// Slice of the Transactions row template (renderFeedRow lives inside
// renderTransactions as a closure, so the template is pinned by source
// text, like the Plan F perf pins).
const rowStart = app.indexOf('const renderFeedRow = (transaction) => {');
const rowEnd = app.indexOf('};', app.indexOf('return `<li class="transaction-card', rowStart));
const rowTpl = app.slice(rowStart, rowEnd);
const finderStart = app.indexOf('function receiptFinderRowHtml(');
const finderEnd = app.indexOf('\n}\n', finderStart);
const finderFn = app.slice(finderStart, finderEnd);

test('listTransactions carries archived: true on an archived customer row', () => {
  assert.equal(arch.archived, true);
});

test('listTransactions carries archived: false on a live customer row', () => {
  assert.equal(live.archived, false);
});

test('listTransactions still lists archived rows — marking, not filtering', () => {
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.customerId).sort(), ['c-arch', 'c-live']);
  assert.equal(rows.reduce((sum, r) => sum + r.amount, 0), 6000);
});

test('renderFeedRow badges archived rows in .tx-main beside the advance badge', () => {
  assert.match(rowTpl, /const archivedBadge = transaction\.archived === true \? `<span class="archived-badge">\$\{escapeHtml\(t\('bill_row_archived'\)\)\}<\/span>` : '';/);
  assert.match(rowTpl, /\$\{advanceBadge\}\$\{archivedBadge\}<\/span><span class="tx-side">/);
});

test('renderFeedRow mutes the archived row and names Archived in its aria-label', () => {
  assert.match(rowTpl, /class="transaction-card tx-compact\$\{transaction\.archived === true \? ' archived-transaction' : ''\}"/);
  assert.match(rowTpl, /\$\{transaction\.archived === true \? `, \$\{escapeHtml\(t\('bill_row_archived'\)\)\}` : ''\}\. Show details and actions/);
});

test('renderFeedRow hides Edit + Delete on archived rows but keeps Void', () => {
  // The archived gate wraps Edit/Delete only; Void (and the channel
  // action) sit outside it, so the correction path stays open.
  const gateStart = rowTpl.indexOf("transaction.archived === true ? '' : `<button class=\"edit-payment\"");
  assert.ok(gateStart >= 0, 'archived gate opens before the Edit button');
  const gateEnd = rowTpl.indexOf('${channelActionMarkup', gateStart);
  const gated = rowTpl.slice(gateStart, gateEnd);
  assert.match(gated, /data-transaction-edit/);
  assert.match(gated, /data-transaction-delete/);
  assert.doesNotMatch(gated, /data-transaction-void/);
  assert.match(rowTpl.slice(gateEnd), /<button class="void-payment"[^>]*data-transaction-void/);
});

test('renderFeedRow keeps all three actions on live rows', () => {
  assert.match(rowTpl, /data-transaction-edit/);
  assert.match(rowTpl, /data-transaction-delete/);
  assert.match(rowTpl, /data-transaction-void/);
  // The voided gate is untouched: a voided row shows no actions at all.
  assert.match(rowTpl, /savedPayment\?\.voided === true \? '' : /);
});

test('receipt finder rows badge archived customers too', () => {
  assert.match(finderFn, /transaction\.archived === true \? ` <span class="archived-badge">\$\{escapeHtml\(t\('bill_row_archived'\)\)\}<\/span>` : ''/);
});

test('Void dialog summary names the archived customer at the moment of action', () => {
  const fnStart = app.indexOf('function openVoidPaymentDialogUnlocked(');
  const fnEnd = app.indexOf('\n}\n', fnStart);
  const fn = app.slice(fnStart, fnEnd);
  assert.match(fn, /customer\.archived === true \? ` · \$\{t\('bill_row_archived'\)\}` : ''/);
});

test('Transactions CSV export carries an Archived column (Yes / blank)', () => {
  assert.match(app, /\{ key: 'archived', label: 'Archived' \}/);
  assert.match(app, /txs\.map\(tx => \(\{ \.\.\.tx, archived: tx\.archived === true \? 'Yes' : '' \}\)\)/);
  const csv = generateCsvContent(
    [{ key: 'customerName', label: 'Customer Name' }, { key: 'archived', label: 'Archived' }],
    [{ customerName: 'Test Archived', archived: 'Yes' }, { customerName: 'Test Live', archived: '' }]
  );
  const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
  assert.equal(lines[0], 'Customer Name,Archived');
  assert.equal(lines[1], 'Test Archived,Yes');
  assert.equal(lines[2], 'Test Live,');
});

test('archived badge CSS is token-only and hugs its content in .tx-main', () => {
  const badgeRule = componentsCss.match(/\.archived-badge \{[^}]*\}/);
  assert.ok(badgeRule, 'archived-badge rule exists');
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(badgeRule[0]), 'archived-badge uses tokens only, no hex');
  assert.match(paymentsListCss, /\.tx-main > \.archived-badge \{ justify-self: start; \}/);
  assert.match(paymentsListCss, /#transactionsList \.transaction-card\.archived-transaction \{ background: var\(--surface-2\); \}/);
});

test('renderTransactions still builds one customer index per render (Plan F pin)', () => {
  const fn = extractFunction(app, 'renderTransactions');
  assert.match(fn, /const\s+customerIndex\s*=\s*indexCustomers\(state\.customers\)/);
  assert.match(fn, /resolveTransactionCustomer\(transaction,\s*customerIndex\)/);
  assert.doesNotMatch(fn, /state\.customers\.find\(/);
});

test('profile history keeps all three actions — the rule is Transactions-list-only', () => {
  // History rows wire the same handlers with their own data attributes;
  // the archived gate lives in the Transactions template only.
  assert.match(app, /historyContainer\.querySelectorAll\('\[data-edit-payment\]'\)\.forEach\(button => button\.addEventListener\('click', \(\) => beginCorrection\(button\.dataset\.customerId, button\.dataset\.month, button\.dataset\.editPayment, 'history'\)\)\);/);
  assert.match(app, /historyContainer\.querySelectorAll\('\[data-delete-payment\]'\)\.forEach\(button => button\.addEventListener\('click', \(\) => requestDeletePayment\(button\.dataset\.customerId, button\.dataset\.month, button\.dataset\.deletePayment\)\)\);/);
  assert.match(app, /historyContainer\.querySelectorAll\('\[data-void-payment\]'\)\.forEach\(button => button\.addEventListener\('click', \(\) => openVoidPaymentDialog\(button\.dataset\.customerId, button\.dataset\.month, button\.dataset\.voidPayment\)\)\);/);
});

// Brace-matching extractor (same shape as the Plan F perf pins use).
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') { depth--; if (depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces in ${name}`);
}
