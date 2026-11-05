import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validBankReconExceptionDate,
  normalizeBankReconException,
  normalizeBankReconExceptionList,
  recordBankReconException,
  removeBankReconException,
  findBankReconException,
  exceptionsSorted,
  exceptionsOpen,
  exceptionsExplained,
  exceptionAgeDays,
  exceptionsForPeriod,
  exceptionsForMethod,
  sumOpenExceptions,
  sumExplainedExceptions,
  reconcileToPeriodDifference,
  explainBankReconException,
  bankReconExceptionText,
  bankReconExceptionHtml,
  bankReconExceptionAllHtml,
  bankReconExceptionSummaryText,
  bankReconExceptionCsv,
  bankReconExceptionFilename,
} from '../bank-reconciliation-exception.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'bank-reconciliation-exception.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const base = {
  id: 'BRE-1', date: '2026-10-05', amountCents: 50000,
  method: 'Bank transfer', linkedSlip: 'SLIP-9',
};

test('half-formed refusal: missing id, date, amount, or method refused', () => {
  assert.equal(recordBankReconException([], { ...base, id: '' }), null);
  assert.equal(recordBankReconException([], { ...base, date: '' }), null);
  assert.equal(recordBankReconException([], { ...base, amountCents: 0 }), null);
  assert.equal(recordBankReconException([], { ...base, method: '' }), null);
  assert.equal(normalizeBankReconException({ ...base, amountCents: 'not money' }), null);
});

test('strict dates: 2026-02-30 refused, 2024-02-29 accepted', () => {
  assert.equal(validBankReconExceptionDate('2026-02-30'), false);
  assert.equal(validBankReconExceptionDate('2024-02-29'), true);
  assert.equal(validBankReconExceptionDate('2026-13-01'), false);
  assert.equal(recordBankReconException([], { ...base, date: '2026-02-30' }), null);
});

test('unknown fields dropped and signed amounts kept', () => {
  const row = normalizeBankReconException({ ...base, surprise: 'x', amountCents: -25000 });
  assert.equal(row.surprise, undefined);
  assert.equal(row.amountCents, -25000);
  assert.equal(row.status, 'open');
  assert.equal(row.explanation, '');
});

test('duplicate ids never rewritten', () => {
  const list = recordBankReconException([], base);
  assert.equal(recordBankReconException(list, { ...base, amountCents: 999 }), null);
  assert.equal(list.length, 1);
  assert.equal(normalizeBankReconExceptionList([base, base]).length, 1);
});

test('find and remove', () => {
  const list = recordBankReconException([], base);
  assert.equal(findBankReconException(list, 'BRE-1').method, 'Bank transfer');
  assert.equal(findBankReconException(list, 'BRE-9'), null);
  assert.equal(removeBankReconException(list, 'BRE-1').length, 0);
});

test('open list is oldest first; explained list keeps its own order', () => {
  const a = { ...base, id: 'BRE-A', date: '2026-10-20' };
  const b = { ...base, id: 'BRE-B', date: '2026-10-01' };
  const list = [a, b];
  assert.deepEqual(exceptionsOpen(list).map((r) => r.id), ['BRE-B', 'BRE-A']);
  assert.deepEqual(exceptionsSorted(list).map((r) => r.id), ['BRE-B', 'BRE-A']);
});

test('age in days against a caller-supplied as-of date', () => {
  assert.equal(exceptionAgeDays(base, '2026-10-15'), 10);
  assert.equal(exceptionAgeDays(base, '2026-10-05'), 0);
  assert.equal(exceptionAgeDays(base, 'not-a-date'), null);
});

test('period filter inclusive at both ends; bad or reversed range yields nothing', () => {
  const list = [
    { ...base, id: 'BRE-1', date: '2026-10-01' },
    { ...base, id: 'BRE-2', date: '2026-10-31' },
    { ...base, id: 'BRE-3', date: '2026-11-05' },
  ];
  assert.deepEqual(
    exceptionsForPeriod(list, { from: '2026-10-01', to: '2026-10-31' }).map((r) => r.id),
    ['BRE-1', 'BRE-2']);
  assert.deepEqual(exceptionsForPeriod(list, { from: '2026-10-31', to: '2026-10-01' }), []);
  assert.deepEqual(exceptionsForPeriod(list, { from: '2026-02-30', to: '2026-10-31' }), []);
});

test('method filter is case-insensitive', () => {
  const list = [
    { ...base, id: 'BRE-1', method: 'Bank transfer' },
    { ...base, id: 'BRE-2', method: 'Cash' },
  ];
  assert.deepEqual(exceptionsForMethod(list, 'bank TRANSFER').map((r) => r.id), ['BRE-1']);
  assert.deepEqual(exceptionsForMethod(list, ''), []);
});

test('open plus explained sums reconcile to the period bank difference', () => {
  const list = [
    { ...base, id: 'BRE-1', amountCents: 50000 },
    { ...base, id: 'BRE-2', amountCents: -20000, status: 'explained', explanation: 'Fee timing', explainedDate: '2026-10-09' },
  ];
  assert.equal(sumOpenExceptions(list), 50000);
  assert.equal(sumExplainedExceptions(list), -20000);
  const match = reconcileToPeriodDifference(list, 30000);
  assert.equal(match.matches, true);
  assert.equal(match.totalCents, 30000);
  assert.equal(match.remainingCents, 0);
  const miss = reconcileToPeriodDifference(list, 99999);
  assert.equal(miss.matches, false);
  assert.equal(miss.remainingCents, 99999 - 30000);
  assert.equal(reconcileToPeriodDifference(list, 'not money'), null);
});

test('explaining keeps explanation and date; never re-explained; bad explain unchanged', () => {
  const list = recordBankReconException([], base);
  const explained = explainBankReconException(list, 'BRE-1', 'Bank fee posted late', '2026-10-12');
  const row = findBankReconException(explained, 'BRE-1');
  assert.equal(row.status, 'explained');
  assert.equal(row.explanation, 'Bank fee posted late');
  assert.equal(row.explainedDate, '2026-10-12');
  const again = explainBankReconException(explained, 'BRE-1', 'Different story', '2026-10-13');
  assert.equal(findBankReconException(again, 'BRE-1').explanation, 'Bank fee posted late');
  assert.deepEqual(explainBankReconException(list, 'BRE-1', '', '2026-10-12'), list);
  assert.deepEqual(explainBankReconException(list, 'BRE-1', 'Fee', '2026-02-30'), list);
});

test('explained without explanation or date stays open', () => {
  const row = normalizeBankReconException({ ...base, status: 'explained' });
  assert.equal(row.status, 'open');
  assert.equal(row.explanation, '');
});

test('summary text counts and sums open and explained', () => {
  const list = [
    { ...base, id: 'BRE-1', amountCents: 50000 },
    { ...base, id: 'BRE-2', amountCents: -20000, status: 'explained', explanation: 'Fee timing', explainedDate: '2026-10-09' },
  ];
  const summary = bankReconExceptionSummaryText(list);
  assert.match(summary, /2 bank reconciliation exception/);
  assert.match(summary, /1 open/);
  assert.match(summary, /1 explained/);
});

test('text, HTML escaping, and empty list HTML', () => {
  const row = { ...base, method: 'Cash <b>&amp;</b>', linkedCredit: '' };
  assert.match(bankReconExceptionText(row), /no explanation yet/);
  assert.doesNotMatch(bankReconExceptionHtml(row), /<b>/);
  assert.match(bankReconExceptionAllHtml([]), /No bank reconciliation exceptions recorded/);
});

test('CSV export and filename', () => {
  const list = [{ ...base, id: 'BRE-1' }];
  const csv = bankReconExceptionCsv(list);
  assert.match(csv, /^id,date,amount_cents,method,linked_slip,linked_credit,status,explanation,explained_date\n/);
  assert.match(csv, /BRE-1,2026-10-05,50000,Bank transfer,SLIP-9,,open,,/);
  assert.equal(bankReconExceptionFilename(), 'bank-reconciliation-exceptions.csv');
});

test('inputs never mutated', () => {
  const frozen = Object.freeze({ ...base });
  const list = recordBankReconException([], frozen);
  assert.equal(list.length, 1);
  assert.equal(frozen.method, 'Bank transfer');
});

test('purity fence: no storage, DOM, network, clock, or neighbour module', () => {
  assert.doesNotMatch(moduleSrc, /localStorage|document\.|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(moduleSrc, /new Date|Date\.now|Date\.UTC/);
  assert.doesNotMatch(moduleSrc, /from '\.\//);
  assert.doesNotMatch(moduleSrc, /method-reconciliation|deposit-slips|bank-credits/);
});

test('panel ids present in index.html', () => {
  for (const id of [
    'breHeading', 'breSummary', 'breExportBtn', 'breDate', 'breAmount',
    'breMethod', 'breSlip', 'breCredit', 'breSaveBtn', 'breRemoveId',
    'breRemoveBtn', 'breExplainId', 'breExplanation', 'breExplainedDate',
    'breExplainBtn', 'breAsOf', 'brePeriodFrom', 'brePeriodTo',
    'brePeriodDifference', 'breReconcileBtn', 'breReconcileResult',
    'breBody', 'breOpenBody',
  ]) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring: import, store key, and render call', () => {
  assert.match(appJs, /from '\.\/bank-reconciliation-exception\.js'/);
  assert.match(appJs, /shahdara_bank_recon_exceptions_v1/);
  assert.match(appJs, /renderBankReconExceptions\(\)/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const lines = appJs.split('\n').filter((line) => /\bOLT\b/.test(line));
  assert.equal(lines.length, 0);
});
