import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validCreditDate,
  normalizeBankCredit,
  normalizeBankCreditList,
  findBankCredit,
  bankCreditForPayment,
  recordBankCredit,
  matchBankCredit,
  explainBankCredit,
  unmatchedBankCredits,
  matchedBankCredits,
  explainedBankCredits,
  unmatchedBankCreditTotalCents,
  bankCreditSummaryText,
  bankCreditHtml,
  bankCreditCsv,
  bankCreditFilename,
} from '../bank-credits.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function credit(over = {}) {
  return {
    id: 'BC-1',
    date: '2026-11-02',
    amount: 1500,
    reference: 'TRF-7781',
    candidates: ['Ayesha Khan'],
    ...over,
  };
}

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(validCreditDate('2026-11-02'), '2026-11-02');
  assert.equal(validCreditDate('2024-02-29'), '2024-02-29');
  assert.equal(validCreditDate('2026-02-30'), null);
  assert.equal(validCreditDate('2026-13-01'), null);
  assert.equal(validCreditDate('02-11-2026'), null);
  assert.equal(validCreditDate(''), null);
  assert.equal(validCreditDate(null), null);
});

test('rupees convert once, *Cents pass through as-is', () => {
  assert.equal(normalizeBankCredit(credit()).amountCents, 150000);
  assert.equal(normalizeBankCredit(credit({ amount: undefined, amountCents: 150000 })).amountCents, 150000);
  // A *Cents figure is never multiplied again.
  assert.equal(normalizeBankCredit(credit({ amountCents: 100 })).amountCents, 100);
  assert.equal(normalizeBankCredit(credit({ amount: 10.005 })).amountCents, 1001);
});

test('half-formed credits refused, unknown fields dropped', () => {
  assert.equal(normalizeBankCredit(credit({ id: '' })), null);
  assert.equal(normalizeBankCredit(credit({ date: '2026-02-30' })), null);
  assert.equal(normalizeBankCredit(credit({ amount: 0 })), null);
  assert.equal(normalizeBankCredit(credit({ amount: -50 })), null);
  assert.equal(normalizeBankCredit(credit({ amount: '1500' })), null);
  assert.equal(normalizeBankCredit(credit({ status: 'paid' })), null);
  const clean = normalizeBankCredit(credit({ billId: 'B-9', paymentTotal: 999 }));
  assert.equal(clean.billId, undefined);
  assert.equal(clean.paymentTotal, undefined);
});

test('reference kept as received, missing reference stays null never invented', () => {
  assert.equal(normalizeBankCredit(credit()).reference, 'TRF-7781');
  assert.equal(normalizeBankCredit(credit({ reference: '' })).reference, null);
  assert.equal(normalizeBankCredit(credit({ reference: undefined })).reference, null);
});

test('candidates deduped in order, blanks dropped, never a match by themselves', () => {
  const clean = normalizeBankCredit(credit({ candidates: ['Ayesha', ' ', 'Ayesha', 'Bilal'] }));
  assert.deepEqual(clean.candidates, ['Ayesha', 'Bilal']);
  assert.equal(clean.status, 'unmatched');
  assert.equal(clean.matchedPaymentId, null);
});

test('record rules: duplicate id never rewritten, half-formed refused', () => {
  const one = recordBankCredit([], credit());
  assert.equal(one.length, 1);
  assert.equal(recordBankCredit(one, credit({ amount: 9999 })).length, 1);
  assert.equal(recordBankCredit(one, credit({ amount: 9999 }))[0].amountCents, 150000);
  assert.equal(recordBankCredit(one, credit({ id: 'BC-2', amount: 0 })).length, 1);
  const two = recordBankCredit(one, credit({ id: 'BC-2', amount: 500 }));
  assert.equal(two.length, 2);
  assert.equal(findBankCredit(two, 'BC-2').amountCents, 50000);
});

test('match: unmatched only, needs payment + customer + real date', () => {
  const list = recordBankCredit([], credit());
  assert.equal(matchBankCredit(list, 'BC-1', '', 'Ayesha', '2026-11-03').length, 1);
  assert.equal(matchBankCredit(list, 'BC-1', 'PAY-1', '', '2026-11-03')[0].status, 'unmatched');
  assert.equal(matchBankCredit(list, 'BC-1', 'PAY-1', 'Ayesha', '2026-02-30')[0].status, 'unmatched');
  assert.equal(matchBankCredit(list, 'NOPE', 'PAY-1', 'Ayesha', '2026-11-03').length, 1);
  const matched = matchBankCredit(list, 'BC-1', 'PAY-1', 'Ayesha', '2026-11-03');
  assert.equal(matched[0].status, 'matched');
  assert.equal(matched[0].matchedPaymentId, 'PAY-1');
  assert.equal(matched[0].matchedCustomer, 'Ayesha');
  assert.equal(matched[0].matchedDate, '2026-11-03');
  assert.equal(bankCreditForPayment(matched, 'PAY-1').id, 'BC-1');
});

test('a credit is never matched to two customers, a payment to two credits', () => {
  const list = recordBankCredit(recordBankCredit([], credit()), credit({ id: 'BC-2', amount: 700 }));
  const matched = matchBankCredit(list, 'BC-1', 'PAY-1', 'Ayesha', '2026-11-03');
  // Second match on the same credit refused.
  assert.equal(matchBankCredit(matched, 'BC-1', 'PAY-2', 'Bilal', '2026-11-04')[0].status, 'matched');
  assert.equal(matchBankCredit(matched, 'BC-1', 'PAY-2', 'Bilal', '2026-11-04')[0].matchedPaymentId, 'PAY-1');
  // Same payment id matched to a second credit refused.
  assert.equal(matchBankCredit(matched, 'BC-2', 'PAY-1', 'Bilal', '2026-11-04')[1].status, 'unmatched');
  const second = matchBankCredit(matched, 'BC-2', 'PAY-2', 'Bilal', '2026-11-04');
  assert.equal(second[1].status, 'matched');
});

test('explain: needs reason + real date, only from unmatched, stays in history', () => {
  const list = recordBankCredit([], credit());
  assert.equal(explainBankCredit(list, 'BC-1', '', '2026-11-03')[0].status, 'unmatched');
  assert.equal(explainBankCredit(list, 'BC-1', 'Bank charges', '2026-02-30')[0].status, 'unmatched');
  const explained = explainBankCredit(list, 'BC-1', 'Bank charges', '2026-11-03');
  assert.equal(explained[0].status, 'explained');
  assert.equal(explained[0].explanation, 'Bank charges');
  // Explained can never be matched afterwards.
  assert.equal(matchBankCredit(explained, 'BC-1', 'PAY-1', 'Ayesha', '2026-11-04')[0].status, 'explained');
  assert.equal(explainedBankCredits(explained).length, 1);
});

test('unmatched queue: oldest first, matched/explained excluded, total in cents', () => {
  let list = recordBankCredit([], credit({ id: 'BC-9', date: '2026-11-05', amount: 100 }));
  list = recordBankCredit(list, credit({ id: 'BC-3', date: '2026-11-01', amount: 200 }));
  list = matchBankCredit(list, 'BC-9', 'PAY-9', 'Ayesha', '2026-11-06');
  const queue = unmatchedBankCredits(list);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, 'BC-3');
  assert.equal(unmatchedBankCreditTotalCents(list), 20000);
  assert.equal(matchedBankCredits(list).length, 1);
});

test('matched credit normalisation needs its link and date', () => {
  assert.equal(normalizeBankCredit(credit({ status: 'matched' })), null);
  assert.equal(normalizeBankCredit(credit({ status: 'matched', matchedPaymentId: 'PAY-1', matchedCustomer: 'Ayesha', matchedDate: '2026-11-03' })).status, 'matched');
  assert.equal(normalizeBankCredit(credit({ status: 'explained' })), null);
  assert.equal(normalizeBankCredit(credit({ status: 'explained', explanation: 'Charges', explanationDate: '2026-11-03' })).status, 'explained');
});

test('no mutation: inputs and lists come back unchanged', () => {
  const raw = credit();
  const frozen = Object.freeze({ ...raw, candidates: Object.freeze([...raw.candidates]) });
  const list = recordBankCredit([], frozen);
  const matched = matchBankCredit(list, 'BC-1', 'PAY-1', 'Ayesha', '2026-11-03');
  assert.equal(list[0].status, 'unmatched');
  assert.equal(matched[0].status, 'matched');
  assert.equal(frozen.amount, 1500);
});

test('summary, HTML escaping, CSV quoting', () => {
  const list = recordBankCredit([], credit({ reference: 'A&B <x>' }));
  const summary = bankCreditSummaryText(list);
  assert.match(summary, /1 bank credits, 1 still unmatched/);
  assert.match(summary, /Rs\. 1500\.00/);
  const html = bankCreditHtml(list[0]);
  assert.match(html, /A&amp;B &lt;x&gt;/);
  assert.match(html, /still unmatched|unmatched/);
  const csv = bankCreditCsv(recordBankCredit(list, credit({ id: 'BC-2', reference: 'say "hi", ok' })));
  assert.match(csv, /"say ""hi"", ok"/);
  assert.equal(bankCreditFilename(), 'bank-credits.csv');
});

test('purity fence: no imports, storage, DOM, network, or other-module identifiers', () => {
  const source = readFileSync(join(root, 'bank-credits.js'), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /localStorage|document\.|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /payment-claims|paymentClaims|paymentClearance|receiptSeries/);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  for (const id of ['bankCreditBody', 'bankCreditSummary', 'bankCreditQueueBody', 'bankCreditSaveBtn', 'bankCreditMatchBtn', 'bankCreditExplainBtn', 'bankCreditExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
