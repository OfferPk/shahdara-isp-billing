import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validDepositSlipDate,
  validDepositSlipMonth,
  normalizeDepositSlip,
  normalizeDepositSlipList,
  addDepositSlip,
  findDepositSlip,
  depositSlipsForMonth,
  depositedTotalForMonth,
  verifyAgainstDepositedTotal,
  depositSlipSummary,
  depositSlipSummaryText,
  depositSlipHtml,
  depositSlipCsv,
  depositSlipFilename,
} from '../deposit-slips.js';

const base = {
  id: 'DS-1', date: '2026-10-05', amount: 45000, slipNumber: 'SLIP-101',
  collector: 'Saad', coveredDates: ['2026-10-01', '2026-10-02'],
};

test('strict dates: impossible dates refused, leap day accepted', () => {
  assert.equal(validDepositSlipDate('2026-02-30'), null);
  assert.equal(validDepositSlipDate('2026-11-31'), null);
  assert.equal(validDepositSlipDate('2024-02-29'), '2024-02-29');
  assert.equal(validDepositSlipDate('2026-10-05'), '2026-10-05');
  assert.equal(validDepositSlipDate('not-a-date'), null);
});

test('strict months: only YYYY-MM with a real month', () => {
  assert.equal(validDepositSlipMonth('2026-10'), '2026-10');
  assert.equal(validDepositSlipMonth('2026-13'), null);
  assert.equal(validDepositSlipMonth('2026-1'), null);
});

test('rupees convert once, cents pass through as-is', () => {
  assert.equal(normalizeDepositSlip(base).amountCents, 4500000);
  assert.equal(normalizeDepositSlip({ ...base, amount: undefined, amountCents: 4500000 }).amountCents, 4500000);
  // A cents figure must not be re-multiplied: 4500000 cents is Rs. 45,000, not Rs. 4,500,000.
  assert.equal(normalizeDepositSlip({ ...base, amountCents: 100 }).amountCents, 100);
  assert.equal(normalizeDepositSlip({ ...base, amount: 10.005 }).amountCents, 1001);
});

test('half-formed slips refused: missing fields, bad amount, no covered day', () => {
  assert.equal(normalizeDepositSlip({ ...base, id: '' }), null);
  assert.equal(normalizeDepositSlip({ ...base, slipNumber: '  ' }), null);
  assert.equal(normalizeDepositSlip({ ...base, collector: '' }), null);
  assert.equal(normalizeDepositSlip({ ...base, date: '2026-02-30' }), null);
  assert.equal(normalizeDepositSlip({ ...base, amount: 0 }), null);
  assert.equal(normalizeDepositSlip({ ...base, amount: -500 }), null);
  assert.equal(normalizeDepositSlip({ ...base, amount: '45000' }), null);
  assert.equal(normalizeDepositSlip({ ...base, coveredDates: [] }), null);
  assert.equal(normalizeDepositSlip({ ...base, coveredDates: ['2026-02-30'] }), null);
  assert.equal(normalizeDepositSlip({ ...base, coveredDates: '2026-10-01' }), null);
  assert.equal(normalizeDepositSlip(null), null);
});

test('unknown fields dropped, covered days deduped and sorted', () => {
  const slip = normalizeDepositSlip({
    ...base, paymentId: 'P-9', handoverTotal: 999,
    coveredDates: ['2026-10-03', '2026-10-01', '2026-10-03', 'bad-date'],
  });
  assert.equal(slip.paymentId, undefined);
  assert.equal(slip.handoverTotal, undefined);
  assert.deepEqual(slip.coveredDates, ['2026-10-01', '2026-10-03']);
  assert.equal(slip.month, '2026-10');
});

test('duplicate id never rewritten, identical re-save unchanged', () => {
  const list = addDepositSlip([], base);
  const same = addDepositSlip(list, base);
  assert.equal(same.length, 1);
  assert.deepEqual(same, list);
  const changed = addDepositSlip(list, { ...base, amount: 46000 });
  assert.equal(changed.length, 1);
  assert.equal(changed[0].amountCents, 4500000);
  assert.equal(normalizeDepositSlipList([base, base]).length, 1);
});

test('slip number reuse refused without an explanation, allowed with one', () => {
  const list = addDepositSlip([], base);
  const refused = addDepositSlip(list, {
    ...base, id: 'DS-2', date: '2026-10-06', amount: 10000,
    coveredDates: ['2026-10-03'],
  });
  assert.equal(refused.length, 1);
  const allowed = addDepositSlip(list, {
    ...base, id: 'DS-2', date: '2026-10-06', amount: 10000,
    coveredDates: ['2026-10-03'], reuseExplanation: 'bank reissued the same slip number',
  });
  assert.equal(allowed.length, 2);
  assert.equal(allowed[1].reuseExplanation, 'bank reissued the same slip number');
  // A different slip number is never a reuse.
  const other = addDepositSlip(list, { ...base, id: 'DS-3', slipNumber: 'SLIP-102' });
  assert.equal(other.length, 2);
});

test('find, month filter, and period total', () => {
  const list = addDepositSlip(addDepositSlip([], base),
    { ...base, id: 'DS-2', date: '2026-11-02', amount: 5000, slipNumber: 'SLIP-102', coveredDates: ['2026-11-01'] });
  assert.equal(findDepositSlip(list, 'DS-2').slipNumber, 'SLIP-102');
  assert.equal(findDepositSlip(list, 'DS-9'), null);
  assert.equal(depositSlipsForMonth(list, '2026-10').length, 1);
  assert.equal(depositSlipsForMonth(list, '2026-13').length, 0);
  assert.equal(depositedTotalForMonth(list, '2026-10'), 4500000);
  assert.equal(depositedTotalForMonth(list, '2026-11'), 500000);
  assert.equal(depositedTotalForMonth(list, '2026-12'), 0);
});

test('verify against a caller-supplied deposited total: agree, mismatch, no answer', () => {
  const list = addDepositSlip(addDepositSlip([], base),
    { ...base, id: 'DS-2', amount: 5000, slipNumber: 'SLIP-102', coveredDates: ['2026-10-03'] });
  const agrees = verifyAgainstDepositedTotal(list, '2026-10', 5000000);
  assert.equal(agrees.agrees, true);
  assert.equal(agrees.slipsTotalCents, 5000000);
  assert.equal(agrees.differenceCents, 0);
  assert.equal(agrees.slipCount, 2);
  const mismatch = verifyAgainstDepositedTotal(list, '2026-10', 5100000);
  assert.equal(mismatch.agrees, false);
  assert.equal(mismatch.differenceCents, 100000);
  assert.equal(verifyAgainstDepositedTotal(list, '2026-10', '5000000'), null);
  assert.equal(verifyAgainstDepositedTotal(list, '2026-13', 5000000), null);
});

test('non-mutation: adding never changes the input list', () => {
  const before = addDepositSlip([], base);
  const snapshot = JSON.stringify(before);
  addDepositSlip(before, { ...base, id: 'DS-2', slipNumber: 'SLIP-102' });
  assert.equal(JSON.stringify(before), snapshot);
});

test('summary counts, totals, and reuse flag', () => {
  const list = addDepositSlip(addDepositSlip([], base),
    { ...base, id: 'DS-2', amount: 5000, slipNumber: 'SLIP-102', coveredDates: ['2026-10-03'] });
  assert.deepEqual(depositSlipSummary(list), { total: 2, totalCents: 5000000, reused: 0 });
  assert.match(depositSlipSummaryText(list), /2 deposit slip\(s\) totalling Rs\. 50000\.00/);
  assert.equal(depositSlipSummaryText([]), 'No bank deposit slip recorded yet.');
  const reused = addDepositSlip(list, {
    ...base, id: 'DS-3', slipNumber: 'SLIP-101', reuseExplanation: 'reissued',
  });
  assert.equal(depositSlipSummary(reused).reused, 1);
  assert.match(depositSlipSummaryText(reused), /1 with a recorded slip-number reuse explanation/);
});

test('html: covered days, bank, reuse line, and escaping', () => {
  const html = depositSlipHtml({ ...base, bank: 'Bank <b>X</b>', reuseExplanation: 'a <note> & more' });
  assert.match(html, /SLIP-101/);
  assert.match(html, /Rs\. 45000\.00/);
  assert.match(html, /2026-10-01, 2026-10-02/);
  assert.match(html, /Bank &lt;b&gt;X&lt;\/b&gt;/);
  assert.match(html, /a &lt;note&gt; &amp; more/);
  assert.doesNotMatch(html, /<b>X/);
  assert.equal(depositSlipHtml({ ...base, collector: '' }), '');
});

test('csv: header, rows, and quoting of commas', () => {
  const list = addDepositSlip([], { ...base, bank: 'Bank, Main Branch' });
  const csv = depositSlipCsv(list);
  assert.ok(csv.startsWith('id,date,month,amount_cents,slip_number,collector,covered_dates,bank,reuse_explanation'));
  assert.match(csv, /"Bank, Main Branch"/);
  assert.match(csv, /2026-10-01;2026-10-02/);
  assert.equal(depositSlipFilename(), 'bank-deposit-slips.csv');
});

test('purity fence: no imports, storage, page, network, or other-module identifiers', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'deposit-slips.js'), 'utf8');
  for (const banned of ['import ', 'localStorage', 'document.', 'fetch(',
    'cash-reconciliation', 'cashRecon', 'method-reconciliation', 'methodRecon',
    'cash-in-hand', 'cashInHand']) {
    assert.ok(!source.includes(banned), `module source must not contain ${banned}`);
  }
});

test('panel wiring: all panel element ids present in index.html', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  for (const id of ['depositSlipMonth', 'depositSlipDate', 'depositSlipAmount',
    'depositSlipNumber', 'depositSlipCollector', 'depositSlipDates', 'depositSlipBank',
    'depositSlipReuse', 'depositSlipSaveBtn', 'depositSlipBody', 'depositSlipSummary',
    'depositSlipExportBtn', 'depositSlipDeposited', 'depositSlipCheckBtn',
    'depositSlipCheckResult']) {
    assert.ok(html.includes(`id="${id}"`), `index.html must contain ${id}`);
  }
});
