// SISP-93: Shop Collector & Field Lineman Recovery Commission Calculator.
// Pure-function tests on synthetic data only. Spec test criteria:
// configuring Rs. 25 / receipt for a collector with 40 receipts in
// 2026-10 computes Rs. 1,000 commission. Also pinned: percentage mode,
// voided receipts never count, collectors are enumerated from recorded
// data (never hardcoded), and expense posting is idempotent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  COMMISSION_RULES_KEY,
  COMMISSION_EXPENSE_CATEGORY,
  commissionCollectorKey,
  collectFieldPayments,
  listCommissionCollectors,
  sanitizeCommissionRules,
  ruleForCollector,
  upsertCommissionRule,
  loadCommissionRules,
  saveCommissionRules,
  commissionExpenseRef,
  findCommissionExpense,
  buildMonthlyCommission,
  commissionExpenseDate,
  postCommissionExpense
} from '../collector-commission.js';
import { EXPENSE_CATEGORIES, validatePhase3State } from '../phase3.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const customer = (id, number, name, bills) => ({ id, customerNumber: number, name, bills });
const bill = (month, payments) => ({ month, payments });
const payment = (id, overrides) => ({ id, date: '2026-10-06', amount: 0, method: 'Cash', ...overrides });

/** 40 Balla-shop receipts of PKR 1,000 in Oct 2026, + 1 voided, + 1 in Sep. */
function ballaFixture() {
  const payments = [];
  for (let i = 0; i < 40; i++) {
    payments.push(payment(`b${i}`, { date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, amount: 1000, method: 'Cash at Balla shop' }));
  }
  payments.push(payment('bvoid', { date: '2026-10-07', amount: 1000, method: 'Cash at Balla shop', voided: true }));
  payments.push(payment('bsep', { date: '2026-09-07', amount: 1000, method: 'Cash at Balla shop' }));
  return { customers: [customer('c1', 11, 'Synthetic Customer 11', [bill('2026-10', payments)])], expenses: [] };
}

const ballaRule = { collectorKey: 'shop:Balla Shop', kind: 'shop', label: 'Balla Shop', mode: 'perReceipt', perReceiptFixed: 25, percentageOfCollection: 0 };

test('SPEC PIN: Rs 25 per receipt x 40 receipts in 2026-10 = Rs 1,000 commission', () => {
  const report = buildMonthlyCommission(ballaFixture(), [ballaRule], '2026-10');
  const row = report.rows.find((r) => r.key === 'shop:Balla Shop');
  assert.ok(row, 'Balla Shop row exists');
  assert.equal(row.receipts, 40, 'voided receipt and September receipt are excluded');
  assert.equal(row.collected, 40000);
  assert.equal(row.commission, 1000);
  assert.equal(report.totalCommission, 1000);
});

test('percentage mode: 5% of PKR 40,000 collected = PKR 2,000, rounded to the cent', () => {
  const rule = { ...ballaRule, mode: 'percent', percentageOfCollection: 5 };
  const row = buildMonthlyCommission(ballaFixture(), [rule], '2026-10').rows[0];
  assert.equal(row.commission, 2000);

  const small = {
    customers: [customer('c9', 91, 'Synthetic Customer 91', [bill('2026-10', [
      payment('s1', { date: '2026-10-03', amount: 1050, method: 'Cash at Balla shop' })
    ])])],
    expenses: []
  };
  const rounded = buildMonthlyCommission(small, [{ ...rule, percentageOfCollection: 2.5 }], '2026-10').rows[0];
  assert.equal(rounded.commission, 26.25, '2.5% of 1050 rounds the house money way');
});

test('default is inert: no rule means zero commission, and posting zero throws', () => {
  const report = buildMonthlyCommission(ballaFixture(), [], '2026-10');
  const row = report.rows.find((r) => r.key === 'shop:Balla Shop');
  assert.equal(row.commission, 0);
  assert.equal(row.perReceiptFixed, 0);
  assert.throws(() => postCommissionExpense(ballaFixture(), row, '2026-10'), /No commission to post/);
});

test('collectors are enumerated from recorded data only — custom shops and field names included', () => {
  const state = {
    customers: [
      customer('c1', 11, 'Synthetic Customer 11', [bill('2026-10', [
        payment('x1', { date: '2026-10-02', amount: 800, method: 'Cash at Rahim shop' }),
        payment('x2', { date: '2026-10-03', amount: 800, method: 'Cash', paidBy: 'Field Lineman A' }),
        payment('x3', { date: '2026-10-04', amount: 800, method: 'JazzCash', paidBy: 'Field Lineman A' }),
        payment('x4', { date: '2026-10-05', amount: 800, method: 'Cash' }),
        payment('x5', { date: '2026-10-06', amount: 800, method: 'Cash', paidBy: 'Waseem' })
      ])])
    ],
    expenses: []
  };
  const collectors = listCommissionCollectors(state, []);
  const keys = collectors.map((c) => c.key);
  assert.ok(keys.includes('shop:Rahim Shop'), 'custom shop derived from the method string');
  assert.ok(keys.includes('shop:Waseem Abbasi Shop'), 'paidBy naming a shop resolves to the shop, not a field row');
  assert.ok(keys.includes('field:Field Lineman A'), 'field collector derived from paidBy');
  assert.equal(keys.filter((k) => k.startsWith('field:')).length, 1, 'unattributed cash is not a collector');

  const report = buildMonthlyCommission(state, [
    { collectorKey: 'field:Field Lineman A', kind: 'field', label: 'Field Lineman A', mode: 'perReceipt', perReceiptFixed: 50, percentageOfCollection: 0 }
  ], '2026-10');
  const fieldRow = report.rows.find((r) => r.key === 'field:Field Lineman A');
  assert.equal(fieldRow.receipts, 2, 'cash + digital recoveries both count for a field collector');
  assert.equal(fieldRow.commission, 100);
});

test('collectFieldPayments skips shop payments and voided payments', () => {
  const rows = collectFieldPayments(ballaFixture());
  assert.equal(rows.length, 0, 'all fixture payments are shop payments');
  const state = {
    customers: [customer('c2', 12, 'Synthetic Customer 12', [bill('2026-10', [
      payment('f1', { date: '2026-10-02', amount: 500, method: 'Cash', paidBy: 'Field Lineman B' }),
      payment('f2', { date: '2026-10-03', amount: 500, method: 'Cash', paidBy: 'Field Lineman B', voided: true })
    ])])],
    expenses: []
  };
  const field = collectFieldPayments(state);
  assert.equal(field.length, 1);
  assert.equal(field[0].collector, 'Field Lineman B');
});

test('expense posting is idempotent: second post reports alreadyPosted and adds nothing', () => {
  const state = ballaFixture();
  const report = buildMonthlyCommission(state, [ballaRule], '2026-10');
  const row = report.rows.find((r) => r.key === 'shop:Balla Shop');
  const refDate = new Date('2026-10-31T12:00:00+05:00');

  const first = postCommissionExpense(state, row, '2026-10', refDate);
  assert.equal(first.alreadyPosted, false);
  assert.equal(first.state.expenses.length, 1);
  const expense = first.state.expenses[0];
  assert.equal(expense.amount, 1000);
  assert.equal(expense.category, COMMISSION_EXPENSE_CATEGORY);
  assert.ok(EXPENSE_CATEGORIES.includes(expense.category), 'posts through the existing expense categories');
  assert.equal(expense.date, '2026-10-31', 'dated at month end so the month P&L counts it');
  assert.equal(expense.commissionRef, commissionExpenseRef('shop:Balla Shop', '2026-10'));
  assert.equal(expense.commissionMonth, '2026-10');
  assert.equal(state.expenses.length, 0, 'input state is never mutated');

  const second = postCommissionExpense(first.state, row, '2026-10', refDate);
  assert.equal(second.alreadyPosted, true);
  assert.equal(second.state.expenses.length, 1, 'no duplicate expense');
  assert.equal(second.expense.id, expense.id);

  const after = buildMonthlyCommission(first.state, [ballaRule], '2026-10');
  assert.equal(after.rows[0].posted, true);
  assert.equal(after.rows[0].postedExpenseId, expense.id);
  assert.equal(findCommissionExpense(first.state, 'shop:Balla Shop', '2026-10').id, expense.id);

  // The stamped expense survives the app's own backup state validation.
  const validated = validatePhase3State({ ...first.state, inventoryItems: [], inventoryMovements: [], saadAttendanceDays: [], umairWorkdays: [] });
  assert.equal(validated.expenses[0].commissionRef, expense.commissionRef);
});

test('commissionExpenseDate: month end for past months, never a future date', () => {
  assert.equal(commissionExpenseDate('2026-09', new Date('2026-10-15T12:00:00+05:00')), '2026-09-30');
  assert.equal(commissionExpenseDate('2026-10', new Date('2026-10-15T12:00:00+05:00')), '2026-10-15');
});

test('rules sanitize: clamps values, drops malformed entries, dedupes by collector', () => {
  const cleaned = sanitizeCommissionRules([
    { collectorKey: 'shop:Balla Shop', kind: 'shop', label: 'Balla Shop', mode: 'percent', perReceiptFixed: -5, percentageOfCollection: 250 },
    { collectorKey: 'shop:Balla Shop', kind: 'shop', label: 'Balla Shop', mode: 'perReceipt', perReceiptFixed: 10, percentageOfCollection: 0 },
    { kind: 'alien', label: 'Nope' },
    { kind: 'field', label: '   ' },
    null,
    'junk'
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].percentageOfCollection, 100);
  assert.equal(cleaned[0].perReceiptFixed, 0);
  assert.equal(sanitizeCommissionRules('nope').length, 0);
  assert.equal(commissionCollectorKey('shop', 'Balla Shop'), 'shop:Balla Shop');
  assert.deepEqual(ruleForCollector([], 'field:Ghost'), { collectorKey: 'field:Ghost', kind: 'field', label: '', mode: 'perReceipt', perReceiptFixed: 0, percentageOfCollection: 0 });

  const upserted = upsertCommissionRule([ballaRule], { ...ballaRule, perReceiptFixed: 30 });
  assert.equal(upserted.length, 1);
  assert.equal(upserted[0].perReceiptFixed, 30);
});

test('rules storage round-trips under sisp_commission_rules_v1 and survives corruption', () => {
  const storage = memoryStorage();
  assert.equal(saveCommissionRules([ballaRule], storage), true);
  assert.ok(storage.getItem(COMMISSION_RULES_KEY).includes('Balla Shop'));
  assert.deepEqual(loadCommissionRules(storage), sanitizeCommissionRules([ballaRule]));
  assert.deepEqual(loadCommissionRules({ getItem: () => '{broken', setItem: () => {} }), []);
  assert.deepEqual(loadCommissionRules({ getItem: () => null, setItem: () => {} }), []);
});

test('a rule-only collector (no payments yet) stays listed and earns 0', () => {
  const ghost = { collectorKey: 'field:Ghost Collector', kind: 'field', label: 'Ghost Collector', mode: 'perReceipt', perReceiptFixed: 100, percentageOfCollection: 0 };
  const report = buildMonthlyCommission({ customers: [], expenses: [] }, [ghost], '2026-10');
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].receipts, 0);
  assert.equal(report.rows[0].commission, 0);
});

test('backup safe-merge: rules travel in settings.commissionRules and restore only onto an empty device', () => {
  const rules = sanitizeCommissionRules([ballaRule]);
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { commissionRules: rules });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.commissionRules.length, 1);
  assert.equal(parsed.settings.commissionRules[0].collectorKey, 'shop:Balla Shop');

  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.commissionRules.length, 1);
  assert.equal(preview.counts.commissionRulesRestored, 1);

  const other = sanitizeCommissionRules([{ ...ballaRule, perReceiptFixed: 99 }]);
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentCommissionRules: other, currentCommissionRulesStored: true });
  assert.equal(clash.commissionRules, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Commission rule records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentCommissionRules: rules, currentCommissionRulesStored: true });
  assert.equal(identical.commissionRules, null);
  assert.equal(identical.conflicts.filter((c) => c.field.startsWith('Commission')).length, 0);

  const noRules = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), {});
  assert.equal(JSON.parse(noRules).settings?.commissionRules, undefined, 'section written only when rules exist');
});

test('i18n: every comm_ key exists in en + ur with matching placeholders, and every t() key used by the module resolves', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('comm_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('comm_')).sort();
  assert.ok(enKeys.length >= 20, `expected 20+ comm_ keys, found ${enKeys.length}`);
  assert.deepEqual(urKeys, enKeys);
  const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of enKeys) assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);

  const source = read('collector-commission.js');
  const used = [...source.matchAll(/\bt\('([a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.ok(used.length >= 15, 'module renders its strings through t()');
  for (const key of used) {
    assert.ok(TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur key ${key}`);
  }
});

test('markup + css: commission dialog follows the shared close design and token-only styles', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="commissionModal"'), 'dialog exists');
  assert.ok(html.includes('id="openCommissionModalBtn"'), 'dashboard open button exists');
  assert.ok(/id="commissionCloseBtn" class="modal-close"[^>]*>↩<\/button>/.test(html), 'shared red-circle close button with back arrow');
  const css = read('components.css');
  const block = css.slice(css.indexOf('SISP-93: collector commission'), css.indexOf('SISP-2: monthly billing cycle'));
  assert.ok(block.length > 0, 'commission css block present');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'commission css uses theme tokens only, no hex colours');
});
