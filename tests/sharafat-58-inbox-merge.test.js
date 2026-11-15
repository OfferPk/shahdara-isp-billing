// Sharafat 58: re-import keeps TID-less rows in a Needs-review bucket
// instead of dropping them, and never silently overwrites a recorded
// row's money/party fields. Pattern-fake data only (Test Customer #101,
// 03012345678 family, TESTTXN* ids) — no real customer data.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeInboxItems,
  mergeInboxItemsWithReport,
  inboxRowKey,
  inboxContentKey,
  formatImportCounts,
  PaymentsInboxController
} from '../payments-inbox.js';
import { parseEasypaisaCsv, parseEasypaisaEmails, inboxContentHash } from '../easypaisa-parser.js';

// renderTransactionRow calls the app shell's ambient escapeHtml global;
// stub the same escaping here so the row markup can be tested in Node.
if (typeof globalThis.escapeHtml === 'undefined') {
  globalThis.escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DAY = '2026-10-20';
const SENDER = 'Test Sender';
const PHONE = '03012345678';
const OTHER_PHONE = '03012345679';

function tidless(overrides = {}) {
  return {
    txnId: '',
    status: 'Needs review',
    direction: 'Received',
    date: DAY,
    amount: 3000,
    senderName: SENDER,
    senderNumber: PHONE,
    rawText: 'unparsed easypaisa message text',
    ...overrides
  };
}

function renderRow(item, customers = []) {
  return PaymentsInboxController.prototype.renderTransactionRow.call(
    { selectedCustomerMatches: new Map() },
    item,
    customers,
    null
  );
}

test('sharafat 58: a TID-less import is kept as Needs review under a stable content key', () => {
  const merged = mergeInboxItems([], [tidless()]);
  assert.equal(merged.length, 1);
  const [row] = merged;
  assert.equal(row.txnId, '');
  assert.equal(row.status, 'Needs review');
  assert.match(row.mergeKey, /^INBOX-REVIEW-[0-9a-f]{8}$/);
  assert.equal(inboxRowKey(row), row.mergeKey);
  // Same content mints the same key every time.
  assert.equal(inboxContentKey(tidless()), row.mergeKey);
  assert.equal(inboxContentKey(tidless({ amount: 2500 })), inboxContentKey(tidless({ amount: 2500 })));
  assert.notEqual(inboxContentKey(tidless({ amount: 2500 })), row.mergeKey);
});

test('sharafat 58: an already-stored TID-less row survives re-import', () => {
  const stored = mergeInboxItems([], [tidless()]);
  const merged = mergeInboxItems(stored, [{ txnId: 'TESTTXN0020', direction: 'Received', amount: 2000, date: DAY }]);
  assert.equal(merged.length, 2);
  assert.ok(merged.some(i => i.mergeKey === stored[0].mergeKey), 'stored TID-less row must survive');
});

test('sharafat 58: the same TID-less transfer re-imported dedupes instead of duplicating', () => {
  const first = mergeInboxItems([], [tidless()]);
  const report = mergeInboxItemsWithReport(first, [tidless()]);
  assert.equal(report.items.length, 1);
  assert.equal(report.kept, 0);
  assert.equal(report.duplicates, 1);
  assert.equal(report.dropped, 0);
  assert.equal(report.items[0].mergeKey, first[0].mergeKey);
});

test('sharafat 58: two different TID-less transfers get different keys and both survive', () => {
  const merged = mergeInboxItems([], [
    tidless(),
    tidless({ amount: 2500, senderName: 'Other Name', senderNumber: OTHER_PHONE, rawText: 'a different unparsed message' })
  ]);
  assert.equal(merged.length, 2);
  assert.notEqual(merged[0].mergeKey, merged[1].mergeKey);
  assert.ok(merged.every(i => i.status === 'Needs review'));
});

test('sharafat 58: re-import over a recorded row preserves amount/sender and flags the conflict', () => {
  const stored = {
    txnId: 'TESTTXN0030', amount: 3000, direction: 'Received', date: DAY,
    senderName: SENDER, senderNumber: PHONE,
    recorded: true, recordedPaymentId: 'pay-1', recordedMonth: '2026-10', recordedCustomerId: 'cust-1'
  };
  const [row] = mergeInboxItems([stored], [{
    txnId: 'TESTTXN0030', amount: 2500, direction: 'Received', date: DAY,
    senderName: 'Other Name', senderNumber: OTHER_PHONE
  }]);
  assert.equal(row.amount, 3000, 'recorded amount must not move');
  assert.equal(row.senderName, SENDER, 'recorded sender must not move');
  assert.equal(row.senderNumber, PHONE, 'recorded sender number must not move');
  assert.equal(row.recorded, true);
  assert.equal(row.recordedPaymentId, 'pay-1');
  assert.equal(row.importConflict, 'Re-import changed amount 3000 → 2500; sender \'Test Sender\' → \'Other Name\'; sender number \'03012345678\' → \'03012345679\'');
});

test('sharafat 58: a recorded row re-imported unchanged carries no conflict', () => {
  const stored = {
    txnId: 'TESTTXN0031', amount: 3000, direction: 'Received', date: DAY,
    senderName: SENDER, senderNumber: PHONE,
    recorded: true, recordedPaymentId: 'pay-1', recordedMonth: '2026-10', recordedCustomerId: 'cust-1'
  };
  const [row] = mergeInboxItems([stored], [{
    txnId: 'TESTTXN0031', amount: 3000, direction: 'Received', date: DAY,
    senderName: SENDER, senderNumber: PHONE
  }]);
  assert.equal(row.amount, 3000);
  assert.equal(row.importConflict, null);
});

test('sharafat 58: an unrecorded row takes the fresh parse whole, with no conflict', () => {
  const stored = {
    txnId: 'TESTTXN0032', amount: 3000, direction: 'Received', date: DAY,
    senderName: SENDER, senderNumber: PHONE, recorded: false
  };
  const [row] = mergeInboxItems([stored], [{
    txnId: 'TESTTXN0032', amount: 2500, direction: 'Received', date: DAY,
    senderName: 'Other Name', senderNumber: OTHER_PHONE
  }]);
  assert.equal(row.amount, 2500, 'unrecorded rows take the fresh parse');
  assert.equal(row.senderName, 'Other Name');
  assert.equal(row.importConflict, null);
});

test('sharafat 58: merge report counts kept, dropped and duplicates', () => {
  const existing = [{ txnId: 'TESTTXN0040', amount: 1000, direction: 'Received', date: DAY }];
  const report = mergeInboxItemsWithReport(existing, [
    { txnId: 'TESTTXN0040', amount: 1000, direction: 'Received', date: DAY },
    { txnId: 'TESTTXN0041', amount: 2000, direction: 'Received', date: DAY },
    null
  ]);
  assert.equal(report.items.length, 2);
  assert.equal(report.kept, 1);
  assert.equal(report.duplicates, 1);
  assert.equal(report.dropped, 1);
  assert.equal(
    formatImportCounts(report),
    'kept 1 · dropped 1 (no TID) · 1 duplicates'
  );
});

test('sharafat 58: an unparseable paste parses TID-less and the merge keeps it (S3)', () => {
  const parsed = parseEasypaisaEmails('this is not an easypaisa message at all', {});
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].txnId, '');
  assert.equal(parsed[0].status, 'Needs review');
  const merged = mergeInboxItems([], parsed);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'Needs review');
});

test('sharafat 58: REVIEW-CSV keys are content-derived — different sheets no longer collapse (S4b)', () => {
  // A date in the first column is rewritten to a REVIEW-CSV key; both
  // sheets land their single row on the same index, so the old
  // row-index key collapsed them into one row.
  const sheetA = '13-Oct-2026 14:20:38,Money Transfer,Test Sender,03012345678,Receiver One,03012345679,3000';
  const sheetB = '13-Oct-2026 14:20:38,Money Transfer,Other Sender,03012345678,Receiver One,03012345679,9000';
  const [rowA] = parseEasypaisaCsv(sheetA, {});
  const [rowB] = parseEasypaisaCsv(sheetB, {});
  assert.match(rowA.txnId, /^REVIEW-CSV-[0-9a-f]{8}$/);
  assert.match(rowB.txnId, /^REVIEW-CSV-[0-9a-f]{8}$/);
  assert.notEqual(rowA.txnId, rowB.txnId, 'different transfers must mint different keys');
  assert.equal(rowA.status, 'Needs review');
  // Same sheet parsed twice mints the same key.
  assert.equal(parseEasypaisaCsv(sheetA, {})[0].txnId, rowA.txnId);
  const merged = mergeInboxItems([rowA], [rowB]);
  assert.equal(merged.length, 2);
});

test('sharafat 58: EP-CSV keys are content-derived — re-import dedupes instead of duplicating (S4c)', () => {
  const headers = 'Transaction ID,Date & Time,Type,Sender Name,Sender Number,Receiver Name,Receiver Number,Amount (PKR),Fee (PKR),Total (PKR),Direction,Status';
  const csv = `${headers}
,13-Oct-2026 14:20:38,Money Transfer,Test Sender,03012345678,Receiver One,03012345679,3000,0,3000,Received,Parsed
,13-Oct-2026 15:45:12,Money Transfer,Other Sender,03012345678,Receiver One,03012345679,2500,0,2500,Received,Parsed`;
  const first = parseEasypaisaCsv(csv, {});
  const second = parseEasypaisaCsv(csv, {});
  assert.equal(first.length, 2);
  assert.match(first[0].txnId, /^EP-CSV-[0-9a-f]{8}$/);
  assert.match(first[1].txnId, /^EP-CSV-[0-9a-f]{8}$/);
  assert.notEqual(first[0].txnId, first[1].txnId);
  assert.deepEqual(second.map(r => r.txnId), first.map(r => r.txnId), 'same CSV must mint the same keys');
  const report = mergeInboxItemsWithReport(first, second);
  assert.equal(report.items.length, 2, 're-import must not duplicate the rows');
  assert.equal(report.duplicates, 2);
  assert.equal(report.kept, 0);
});

test('sharafat 58: the shared hash is deterministic across parser and merge', () => {
  assert.equal(inboxContentHash('abc'), inboxContentHash('abc'));
  assert.match(inboxContentHash('abc'), /^[0-9a-f]{8}$/);
  assert.notEqual(inboxContentHash('abc'), inboxContentHash('abd'));
});

test('sharafat 58: render keys TID-less rows by mergeKey and never offers Record on them', () => {
  const merged = mergeInboxItems([], [
    tidless(),
    tidless({ amount: 2500, senderName: 'Other Name', senderNumber: OTHER_PHONE, rawText: 'a different unparsed message' })
  ]);
  const htmls = merged.map(row => renderRow(row));
  assert.ok(htmls.every(h => !h.includes('data-record-txn')), 'a TID-less row must never offer Record');
  assert.ok(htmls.every(h => h.includes('Review Required')), 'a TID-less row shows Review Required');
  const keys = htmls.map(h => h.match(/data-txn-id="([^"]+)"/)[1]);
  assert.equal(new Set(keys).size, 2, 'two TID-less rows must render distinct row keys');
  assert.ok(keys.every(k => k.startsWith('INBOX-REVIEW-')));
  // A TID-less row that somehow carries status Parsed still gets no button.
  const parsedHtml = renderRow({ ...tidless(), status: 'Parsed' });
  assert.ok(!parsedHtml.includes('data-record-txn'));
});

test('sharafat 58: render shows the import conflict on the recorded row', () => {
  const [row] = mergeInboxItems(
    [{
      txnId: 'TESTTXN0050', amount: 3000, direction: 'Received', date: DAY,
      senderName: SENDER, senderNumber: PHONE,
      recorded: true, recordedPaymentId: 'pay-1', recordedMonth: '2026-10', recordedCustomerId: 'cust-1'
    }],
    [{ txnId: 'TESTTXN0050', amount: 2500, direction: 'Received', date: DAY, senderName: SENDER, senderNumber: PHONE }]
  );
  const html = renderRow(row);
  assert.ok(html.includes('Re-import changed amount 3000 → 2500'), 'conflict must render on the row');
  assert.ok(html.includes('import-conflict'));
});

test('sharafat 58: render still offers Record for a normal unrecorded received row', () => {
  const html = renderRow({
    txnId: 'TESTTXN0060', amount: 3000, direction: 'Received', date: DAY,
    status: 'Parsed', senderName: SENDER, senderNumber: PHONE
  });
  assert.ok(html.includes('data-record-txn="TESTTXN0060"'));
});
