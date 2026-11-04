import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validCreditDate,
  creditAmountCents,
  normalizeCreditEntry,
  normalizeCreditEntryList,
  upsertCreditEntry,
  removeCreditEntry,
  normalizeCreditApplication,
  normalizeCreditApplicationList,
  appliedForEntry,
  remainingForEntry,
  applyCredit,
  removeCreditApplication,
  creditBalanceForCustomer,
  creditEntriesForCustomer,
  creditSummaryText,
  creditHtml,
  creditCsv,
  creditFilename,
} from '../credit-balance.js';

const here = dirname(fileURLToPath(import.meta.url));

const entry = (overrides = {}) => ({
  id: 'CR-1',
  customerId: 'C-76',
  customerName: 'Orient school',
  source: 'overpayment',
  sourcePaymentId: 'PAY-9',
  amountCents: 50000,
  date: '2026-11-04',
  note: '',
  ...overrides,
});

const application = (overrides = {}) => ({
  id: 'APP-1',
  creditEntryId: 'CR-1',
  customerId: 'C-76',
  billId: 'B-2026-11',
  amountCents: 20000,
  date: '2026-11-05',
  note: '',
  ...overrides,
});

test('strict dates: real dates pass, impossible dates fail', () => {
  assert.equal(validCreditDate('2026-11-04'), true);
  assert.equal(validCreditDate('2026-02-30'), false);
  assert.equal(validCreditDate('2026-13-01'), false);
  assert.equal(validCreditDate('04-11-2026'), false);
  assert.equal(validCreditDate(''), false);
});

test('amounts: cents used as-is, rupees convert exactly once', () => {
  assert.equal(creditAmountCents({ amountCents: 5050 }), 5050);
  assert.equal(creditAmountCents({ amount: 50.5 }), 5050);
  assert.equal(creditAmountCents({ amount: '50.5' }), 5050);
  assert.equal(creditAmountCents({ amount: 'abc' }), null);
  assert.equal(creditAmountCents({}), null);
  assert.equal(creditAmountCents(null), null);
});

test('half-formed entries refused: missing fields, bad source, bad date, non-positive amount', () => {
  assert.equal(normalizeCreditEntry(entry({ id: '' })), null);
  assert.equal(normalizeCreditEntry(entry({ customerId: '' })), null);
  assert.equal(normalizeCreditEntry(entry({ source: 'gift' })), null);
  assert.equal(normalizeCreditEntry(entry({ amountCents: 0 })), null);
  assert.equal(normalizeCreditEntry(entry({ amountCents: -100 })), null);
  assert.equal(normalizeCreditEntry(entry({ date: '2026-02-30' })), null);
  assert.equal(normalizeCreditEntry(null), null);
});

test('overpayment without a source payment is refused; adjustment without a note is refused', () => {
  assert.equal(normalizeCreditEntry(entry({ sourcePaymentId: '' })), null);
  assert.equal(normalizeCreditEntry(entry({ source: 'adjustment', sourcePaymentId: '', note: '' })), null);
  const ok = normalizeCreditEntry(entry({ source: 'adjustment', sourcePaymentId: '', note: 'Approved by owner' }));
  assert.equal(ok.source, 'adjustment');
  assert.equal(ok.note, 'Approved by owner');
});

test('unknown fields dropped, so an entry never grows payment or bill fields', () => {
  const clean = normalizeCreditEntry(entry({ billId: 'B-1', paidAmount: 999, refunded: true }));
  assert.deepEqual(Object.keys(clean).sort(), ['amountCents', 'customerId', 'customerName', 'date', 'id', 'note', 'source', 'sourcePaymentId']);
});

test('upsert replaces by id; half-formed upsert leaves the list exactly unchanged', () => {
  const base = [entry()];
  const replaced = upsertCreditEntry(base, entry({ amountCents: 60000 }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].amountCents, 60000);
  assert.equal(upsertCreditEntry(base, entry({ amountCents: 0 })), null);
  assert.deepEqual(base, [entry()]);
});

test('application gates: unknown entry, wrong customer, no bill, over-remaining all refused unchanged', () => {
  const entries = [entry()];
  assert.equal(applyCredit(entries, [], application({ creditEntryId: 'NOPE' })), null);
  assert.equal(applyCredit(entries, [], application({ customerId: 'C-99' })), null);
  assert.equal(applyCredit(entries, [], application({ billId: '' })), null);
  assert.equal(applyCredit(entries, [], application({ amountCents: 50001 })), null);
  assert.equal(applyCredit(entries, [], application({ date: '2026-02-30' })), null);
  const ok = applyCredit(entries, [], application());
  assert.equal(ok.length, 1);
  assert.equal(ok[0].billId, 'B-2026-11');
});

test('applying exactly the remaining credit passes; one cent more is refused', () => {
  const entries = [entry()];
  const afterFirst = applyCredit(entries, [], application({ amountCents: 30000 }));
  assert.equal(remainingForEntry(entries, afterFirst, 'CR-1'), 20000);
  assert.equal(applyCredit(entries, afterFirst, application({ id: 'APP-2', amountCents: 20001 })), null);
  const fully = applyCredit(entries, afterFirst, application({ id: 'APP-2', amountCents: 20000 }));
  assert.equal(remainingForEntry(entries, fully, 'CR-1'), 0);
});

test('balance sums exactly: in, applied, remaining; entries oldest first, undated last', () => {
  const entries = [
    entry({ id: 'CR-2', date: '', amountCents: 10000 }),
    entry({ id: 'CR-1', date: '2026-11-04', amountCents: 50000 }),
  ];
  const apps = applyCredit(entries, [], application({ amountCents: 20000 }));
  const balance = creditBalanceForCustomer(entries, apps, 'C-76');
  assert.equal(balance.totalInCents, 60000);
  assert.equal(balance.totalAppliedCents, 20000);
  assert.equal(balance.remainingCents, 40000);
  assert.equal(balance.totalInCents, balance.totalAppliedCents + balance.remainingCents);
  assert.deepEqual(balance.entries.map((item) => item.id), ['CR-1', 'CR-2']);
  assert.equal(balance.entries[0].remainingCents, 30000);
  assert.equal(appliedForEntry(apps, 'CR-1'), 20000);
  assert.equal(creditEntriesForCustomer(entries, 'C-76').length, 2);
  assert.equal(creditBalanceForCustomer(entries, apps, 'C-99').totalInCents, 0);
});

test('removing an entry named by an application is refused; removing an application frees its credit', () => {
  const entries = [entry()];
  const apps = applyCredit(entries, [], application());
  assert.equal(removeCreditEntry(entries, apps, 'CR-1'), null);
  assert.deepEqual(removeCreditEntry(entries, [], 'CR-1'), []);
  assert.deepEqual(removeCreditApplication(apps, 'APP-1'), []);
  assert.equal(remainingForEntry(entries, removeCreditApplication(apps, 'APP-1'), 'CR-1'), 50000);
  assert.equal(removeCreditApplication(apps, ''), null);
});

test('non-mutation: applying and balancing never edit the supplied lists', () => {
  const entries = [entry()];
  const apps = [];
  const snapshot = JSON.stringify({ entries, apps });
  applyCredit(entries, apps, application());
  creditBalanceForCustomer(entries, apps, 'C-76');
  assert.equal(JSON.stringify({ entries, apps }), snapshot);
});

test('summary, HTML escaping, and CSV quoting', () => {
  const entries = [entry({ customerName: 'A <b>& Co' })];
  const apps = applyCredit(entries, [], application());
  const balance = creditBalanceForCustomer(entries, apps, 'C-76');
  assert.match(creditSummaryText(balance), /Rs\. 500\.00/);
  assert.match(creditSummaryText(balance), /Rs\. 200\.00/);
  assert.match(creditSummaryText(balance), /Rs\. 300\.00/);
  const html = creditHtml(balance);
  assert.match(html, /B-2026-11/);
  assert.doesNotMatch(html, /<b>/);
  const csv = creditCsv(balance);
  assert.match(csv, /^date,source,credit_in_cents,applied_cents,remaining_cents,applied_to_bill\n/);
  assert.match(csv, /50000,20000,30000,B-2026-11/);
  assert.equal(creditFilename(), 'customer-credit-balance.csv');
  assert.match(creditHtml(creditBalanceForCustomer([], [], 'C-76')), /No credit recorded/);
});

test('purity fence: no imports, no storage, no DOM, no payment/bill rewriting, no cash-out path', () => {
  const source = readFileSync(join(here, '..', 'credit-balance.js'), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /localStorage|document\.|fetch\(/);
  assert.doesNotMatch(source, /part-payment-rules|repayment-plan|advance-allocation/);
  assert.doesNotMatch(source, /function cashOut|function refundCredit|convertToCash/);
});
