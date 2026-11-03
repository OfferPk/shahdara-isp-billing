import test from 'node:test';
import assert from 'node:assert/strict';

import { computeBackupChecksum } from '../backup-health.js';

import {
  TRANSFER_FORMAT_TAG,
  countTransferLedger,
  buildTransferPack,
  transferPackText,
  transferPackFilename,
  verifyTransferPack,
  decideTransferApply,
  spotCheckTransfer,
  transferPackSummaryText,
  transferPackHtml,
} from '../transfer-pack.js';

const customer = (id, name, bills) => ({ id, name, bills });
const bill = (month, payments) => ({ month, payments });
const payment = (id, amount) => ({ id, amount });

const ledger = () => [
  customer('c1', 'Ali', [bill('2026-10', [payment('p1', 1000), payment('p2', 500)]), bill('2026-11', [payment('p3', 1000)])]),
  customer('c2', 'Bina', [bill('2026-10', [])]),
];

test('countTransferLedger counts customers, bills, payments, amount and months', () => {
  const counts = countTransferLedger(ledger());
  assert.equal(counts.customers, 2);
  assert.equal(counts.bills, 3);
  assert.equal(counts.payments, 3);
  assert.equal(counts.amount, 2500);
  assert.deepEqual(counts.months, ['2026-10', '2026-11']);
});

test('countTransferLedger ignores non-finite payment amounts and bills without months', () => {
  const counts = countTransferLedger([customer('c1', 'Ali', [bill('', [payment('p1', 'x'), payment('p2', 700)])])]);
  assert.equal(counts.payments, 2);
  assert.equal(counts.amount, 700);
  assert.deepEqual(counts.months, []);
});

test('buildTransferPack reuses the Plan J backup format and stamps counts and a checksum', () => {
  const pack = buildTransferPack(ledger(), { exportedAt: '2026-11-04T02:30', deviceLabel: 'Saad phone' });
  assert.equal(pack.format, TRANSFER_FORMAT_TAG);
  assert.equal(pack.formatVersion, 1);
  assert.equal(pack.transfer.kind, 'device-transfer');
  assert.equal(pack.transfer.deviceLabel, 'Saad phone');
  assert.equal(pack.exportedAt, '2026-11-04T02:30');
  assert.deepEqual(pack.transfer.counts, countTransferLedger(ledger()));
  assert.match(pack.checksum, /^crc32:[0-9a-f]{8}$/);
});

test('buildTransferPack never mutates its input and the pack carries a copy', () => {
  const input = ledger();
  const before = JSON.stringify(input);
  const pack = buildTransferPack(input);
  pack.state.customers[0].name = 'Changed';
  assert.equal(JSON.stringify(input), before);
  assert.equal(input[0].name, 'Ali');
});

test('buildTransferPack with no exportedAt leaves it null, never invented', () => {
  assert.equal(buildTransferPack(ledger()).exportedAt, null);
  assert.equal(buildTransferPack(ledger(), { deviceLabel: '  ' }).transfer.deviceLabel, null);
});

test('verifyTransferPack accepts a pack built by buildTransferPack', () => {
  const text = transferPackText(buildTransferPack(ledger(), { exportedAt: '2026-11-04T02:30' }));
  const result = verifyTransferPack(text);
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.checksumStatus, 'verified');
  assert.equal(result.exportedAt, '2026-11-04T02:30');
  assert.deepEqual(result.counts, countTransferLedger(ledger()));
  assert.deepEqual(result.customers, ledger());
});

test('verifyTransferPack refuses empty and invalid JSON with a plain reason', () => {
  for (const bad of ['', '   ', '{not json', '{"format":']) {
    const result = verifyTransferPack(bad);
    assert.equal(result.ok, false);
    assert.match(result.reason, /not valid JSON|No transfer pack/);
    assert.equal(result.customers, null);
  }
});

test('verifyTransferPack refuses a truncated pack', () => {
  const full = transferPackText(buildTransferPack(ledger()));
  const result = verifyTransferPack(full.slice(0, Math.floor(full.length / 2)));
  assert.equal(result.ok, false);
  assert.match(result.reason, /not valid JSON|truncated/);
});

test('verifyTransferPack refuses a tampered pack via checksum mismatch', () => {
  const pack = buildTransferPack(ledger());
  pack.state.customers[0].name = 'Tampered';
  const result = verifyTransferPack(JSON.stringify(pack));
  assert.equal(result.ok, false);
  assert.equal(result.checksumStatus, 'mismatch');
  assert.match(result.reason, /Checksum mismatch/);
});

test('verifyTransferPack refuses a pack whose stated counts do not match its records', () => {
  const pack = buildTransferPack(ledger());
  pack.transfer.counts.payments = 999;
  // Re-stamp the checksum so only the counts check can catch it.
  pack.checksum = computeBackupChecksum(pack);
  const result = verifyTransferPack(JSON.stringify(pack));
  assert.equal(result.ok, false);
  assert.match(result.reason, /counts do not match/);
});

test('verifyTransferPack refuses a legacy pack without a checksum', () => {
  const pack = buildTransferPack(ledger());
  delete pack.checksum;
  const result = verifyTransferPack(JSON.stringify(pack));
  assert.equal(result.ok, false);
  assert.match(result.reason, /No checksum found/);
});

test('verifyTransferPack refuses a wrong format and a newer format version', () => {
  const pack = buildTransferPack(ledger());
  const wrong = { ...pack, format: 'something-else' };
  assert.equal(verifyTransferPack(JSON.stringify(wrong)).ok, false);
  const newer = { ...pack, formatVersion: 2 };
  const result = verifyTransferPack(JSON.stringify(newer));
  assert.equal(result.ok, false);
  assert.match(result.reason, /newer version/);
});

test('verifyTransferPack refuses a pack with no customer ledger', () => {
  const pack = buildTransferPack(ledger());
  delete pack.state;
  assert.equal(verifyTransferPack(JSON.stringify(pack)).ok, false);
  const badRow = buildTransferPack([null]);
  assert.equal(verifyTransferPack(transferPackText(badRow)).ok, false);
});

test('decideTransferApply applies a verified pack onto an empty device', () => {
  const text = transferPackText(buildTransferPack(ledger()));
  const decision = decideTransferApply(text, []);
  assert.equal(decision.allowed, true);
  assert.equal(decision.action, 'apply');
  assert.deepEqual(decision.customers, ledger());
  assert.deepEqual(decision.counts, countTransferLedger(ledger()));
});

test('decideTransferApply re-applying the same ledger changes nothing', () => {
  const text = transferPackText(buildTransferPack(ledger()));
  const decision = decideTransferApply(text, ledger());
  assert.equal(decision.allowed, true);
  assert.equal(decision.action, 'already-applied');
  assert.match(decision.reason, /already holds exactly this ledger/);
});

test('decideTransferApply refuses a different ledger already on the device', () => {
  const text = transferPackText(buildTransferPack(ledger()));
  const other = [customer('c9', 'Other', [bill('2026-10', [payment('p9', 100)])])];
  const decision = decideTransferApply(text, other);
  assert.equal(decision.allowed, false);
  assert.equal(decision.action, 'refused');
  assert.match(decision.reason, /never merges two ledgers/);
  assert.equal(decision.customers, null);
});

test('decideTransferApply refuses a tampered pack and writes nothing', () => {
  const pack = buildTransferPack(ledger());
  pack.state.customers[0].name = 'Tampered';
  const decision = decideTransferApply(JSON.stringify(pack), []);
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /Checksum mismatch/);
});

test('spotCheckTransfer matches identical ledgers', () => {
  const check = spotCheckTransfer(ledger(), ledger());
  assert.equal(check.match, true);
  assert.deepEqual(check.mismatches, []);
  assert.deepEqual(check.sourceCounts, check.receivedCounts);
});

test('spotCheckTransfer names a missing customer and a changed payment total', () => {
  const received = [
    customer('c1', 'Ali', [bill('2026-10', [payment('p1', 1000), payment('p2', 500)]), bill('2026-11', [payment('p3', 900)])]),
    customer('c3', 'Extra', []),
  ];
  const check = spotCheckTransfer(ledger(), received);
  assert.equal(check.match, false);
  assert.ok(check.mismatches.some((item) => item.id === 'c2' && /missing/.test(item.problem)));
  assert.ok(check.mismatches.some((item) => item.id === 'c1' && /amount 2500 vs 2400/.test(item.problem)));
  assert.ok(check.mismatches.some((item) => item.id === 'c3' && /extra/.test(item.problem)));
});

test('transferPackSummaryText and Html report verified counts and escape names', () => {
  const result = verifyTransferPack(transferPackText(buildTransferPack(ledger(), { exportedAt: '2026-11-04T02:30' })));
  assert.match(transferPackSummaryText(result), /2 customers, 3 bills, 3 payments/);
  assert.match(transferPackSummaryText(result), /Checksum verified/);
  const html = transferPackHtml(result);
  assert.match(html, /<td>2<\/td>/);
  assert.match(html, /Checksum verified/);
  assert.match(transferPackHtml({ ok: false, reason: 'Bad <pack>' }), /Bad &lt;pack&gt;/);
  assert.match(transferPackSummaryText({ ok: false, reason: 'Bad pack' }), /Bad pack/);
});

test('transferPackFilename stamps the export date and falls back when undated', () => {
  assert.equal(transferPackFilename('2026-11-04T02:30'), 'shahdara-transfer-pack-2026-11-04T02-30.json');
  assert.equal(transferPackFilename(null), 'shahdara-transfer-pack-undated.json');
});
