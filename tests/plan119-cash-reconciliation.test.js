import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validCashReconDate,
  validCashReconMonth,
  normalizeCashRecon,
  normalizeCashReconList,
  addCashRecon,
  lockCashRecon,
  findCashRecon,
  cashReconsForMonth,
  verifyAgainstSnapshot,
  cashReconSummary,
  cashReconSummaryText,
  cashReconHtml,
  cashReconCsv,
  cashReconFilename,
} from '../cash-reconciliation.js';

const base = {
  id: 'CR-1', month: '2026-10', ledgerCash: 100000, counted: 60000,
  deposited: 30000, inHand: 10000, operator: 'Saad', date: '2026-11-01',
};

test('strict dates: impossible dates refused, leap day accepted', () => {
  assert.equal(validCashReconDate('2026-02-30'), null);
  assert.equal(validCashReconDate('2026-11-31'), null);
  assert.equal(validCashReconDate('2024-02-29'), '2024-02-29');
  assert.equal(validCashReconDate('2026-10-05'), '2026-10-05');
  assert.equal(validCashReconDate('not-a-date'), null);
});

test('strict months: only YYYY-MM with a real month', () => {
  assert.equal(validCashReconMonth('2026-10'), '2026-10');
  assert.equal(validCashReconMonth('2026-13'), null);
  assert.equal(validCashReconMonth('2026-1'), null);
  assert.equal(validCashReconMonth(''), null);
});

test('rupees convert once; cents figures pass through as-is, never double-converted', () => {
  const fromRupees = normalizeCashRecon(base);
  assert.equal(fromRupees.ledgerCashCents, 10000000);
  const fromCents = normalizeCashRecon({
    ...base, ledgerCashCents: 10000000, ledgerCash: 999,
    countedCents: 6000000, depositedCents: 3000000, inHandCents: 1000000,
  });
  assert.equal(fromCents.ledgerCashCents, 10000000);
  assert.equal(fromCents.accountedCents, 10000000);
});

test('half-formed records refused outright', () => {
  assert.equal(normalizeCashRecon({ ...base, operator: '' }), null);
  assert.equal(normalizeCashRecon({ ...base, month: '2026-13' }), null);
  assert.equal(normalizeCashRecon({ ...base, date: '2026-02-30' }), null);
  assert.equal(normalizeCashRecon({ ...base, counted: -5 }), null);
  const { counted, ...noCounted } = base;
  assert.equal(normalizeCashRecon(noCounted), null);
  assert.equal(normalizeCashRecon({ ...base, counted: 'lots' }), null);
  assert.equal(normalizeCashRecon(null), null);
  assert.equal(normalizeCashRecon([]), null);
});

test('unknown fields dropped so a record never grows payment, bill, or price fields', () => {
  const record = normalizeCashRecon({ ...base, paymentId: 'P-9', billTotal: 500, price: 1500 });
  assert.equal(record.paymentId, undefined);
  assert.equal(record.billTotal, undefined);
  assert.equal(record.price, undefined);
});

test('accounted and difference arithmetic: balanced, shortfall, surplus', () => {
  const balanced = normalizeCashRecon(base);
  assert.equal(balanced.accountedCents, 10000000);
  assert.equal(balanced.differenceCents, 0);
  assert.equal(balanced.balanced, true);
  const short = normalizeCashRecon({ ...base, id: 'CR-2', counted: 59000 });
  assert.equal(short.differenceCents, 100000);
  assert.equal(short.balanced, false);
  const surplus = normalizeCashRecon({ ...base, id: 'CR-3', inHand: 11000 });
  assert.equal(surplus.differenceCents, -100000);
  assert.equal(surplus.balanced, false);
});

test('add: duplicate id never rewritten, identical re-save unchanged', () => {
  const list = addCashRecon([], base);
  assert.equal(list.length, 1);
  assert.deepEqual(addCashRecon(list, base), list);
  assert.deepEqual(addCashRecon(list, { ...base, counted: 61000 }), list);
  assert.deepEqual(addCashRecon(list, { ...base, operator: '' }), list);
  assert.equal(addCashRecon(list, { ...base, id: 'CR-2' }).length, 2);
});

test('lock: balanced locks; unbalanced locks only with an explanation; no unlock', () => {
  const balanced = addCashRecon([], base);
  const locked = lockCashRecon(balanced, 'CR-1', '2026-11-02');
  assert.equal(locked[0].status, 'locked');
  assert.equal(locked[0].lockedDate, '2026-11-02');
  assert.deepEqual(lockCashRecon(locked, 'CR-1', '2026-11-03'), locked);
  const unexplained = addCashRecon([], { ...base, id: 'CR-2', counted: 59000 });
  assert.deepEqual(lockCashRecon(unexplained, 'CR-2', '2026-11-02'), unexplained);
  const explained = addCashRecon([], {
    ...base, id: 'CR-3', counted: 59000, explanation: 'Rs. 1000 short: recount pending',
  });
  assert.equal(lockCashRecon(explained, 'CR-3', '2026-11-02')[0].status, 'locked');
  assert.deepEqual(lockCashRecon(explained, 'CR-3', '2026-02-30'), explained);
  assert.deepEqual(lockCashRecon(explained, 'CR-9', '2026-11-02'), explained);
});

test('a locked record can never be changed by a later add', () => {
  const locked = lockCashRecon(addCashRecon([], base), 'CR-1', '2026-11-02');
  assert.deepEqual(addCashRecon(locked, { ...base, counted: 61000 }), locked);
});

test('find and month filter; bad month gives an empty list', () => {
  const list = addCashRecon(addCashRecon([], base), { ...base, id: 'CR-2', month: '2026-11' });
  assert.equal(findCashRecon(list, 'CR-1').month, '2026-10');
  assert.equal(findCashRecon(list, 'CR-9'), null);
  assert.equal(cashReconsForMonth(list, '2026-10').length, 1);
  assert.equal(cashReconsForMonth(list, '2026-13').length, 0);
});

test('verify against a snapshot figure: agrees, mismatch named, unusable gives no answer', () => {
  const record = normalizeCashRecon(base);
  const agrees = verifyAgainstSnapshot(record, 10000000);
  assert.equal(agrees.agrees, true);
  assert.equal(agrees.differenceCents, 0);
  const mismatch = verifyAgainstSnapshot(record, 9900000);
  assert.equal(mismatch.agrees, false);
  assert.equal(mismatch.differenceCents, 100000);
  assert.equal(verifyAgainstSnapshot(record, null), null);
  assert.equal(verifyAgainstSnapshot(record, 100.5), null);
  assert.equal(verifyAgainstSnapshot({ ...base, operator: '' }, 10000000), null);
});

test('add and lock never mutate their inputs', () => {
  const before = addCashRecon([], base);
  const snapshot = JSON.stringify(before);
  addCashRecon(before, { ...base, id: 'CR-2' });
  lockCashRecon(before, 'CR-1', '2026-11-02');
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(before[0].status, 'open');
});

test('summary counts: total, balanced, unexplained differences, locked', () => {
  const list = addCashRecon(
    addCashRecon(addCashRecon([], base),
      { ...base, id: 'CR-2', counted: 59000 }),
    { ...base, id: 'CR-3', counted: 59000, explanation: 'short, noted' },
  );
  const locked = lockCashRecon(list, 'CR-3', '2026-11-02');
  assert.deepEqual(cashReconSummary(locked), { total: 3, balanced: 1, locked: 1, unexplained: 1 });
  assert.match(cashReconSummaryText(locked), /3 reconciliation record/);
  assert.match(cashReconSummaryText(locked), /1 difference\(s\) still unexplained/);
  assert.equal(cashReconSummaryText([]), 'No month-end cash reconciliation recorded yet.');
});

test('html: difference wording and escaping, locked line shown', () => {
  const html = cashReconHtml({ ...base, counted: 59000, explanation: 'a <b> note & more' });
  assert.match(html, /shortfall/);
  assert.match(html, /a &lt;b&gt; note &amp; more/);
  assert.doesNotMatch(html, /<b> note/);
  assert.match(cashReconHtml(base), /Balanced/);
  const lockedHtml = cashReconHtml(lockCashRecon(addCashRecon([], base), 'CR-1', '2026-11-02')[0]);
  assert.match(lockedHtml, /locked 2026-11-02/);
  assert.equal(cashReconHtml({ ...base, operator: '' }), '');
});

test('csv: header, rows, and quoting of explanations with commas', () => {
  const list = addCashRecon([], { ...base, explanation: 'short, see note' });
  const csv = cashReconCsv(list);
  assert.ok(csv.startsWith('id,month,ledger_cash_cents'));
  assert.match(csv, /"short, see note"/);
  assert.equal(cashReconFilename(), 'month-end-cash-reconciliation.csv');
});

test('purity fence: no imports, storage, page, network, or other-module identifiers', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'cash-reconciliation.js'), 'utf8');
  for (const banned of ['import ', 'localStorage', 'document.', 'fetch(', 'month-close',
    'preclose-sweep', 'month-snapshots', 'monthClose', 'precloseSweep', 'monthSnapshots']) {
    assert.ok(!source.includes(banned), `module source must not contain ${banned}`);
  }
});

test('panel wiring: all panel element ids present in index.html', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  for (const id of ['cashReconMonth', 'cashReconLedger', 'cashReconCounted',
    'cashReconDeposited', 'cashReconInHand', 'cashReconExplanation', 'cashReconOperator',
    'cashReconDate', 'cashReconCloseRef', 'cashReconSnapshotRef', 'cashReconSaveBtn',
    'cashReconFillBtn', 'cashReconBody', 'cashReconSummary', 'cashReconExportBtn',
    'cashReconLockId', 'cashReconLockDate', 'cashReconLockBtn']) {
    assert.ok(html.includes(`id="${id}"`), `index.html must contain ${id}`);
  }
});
