import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validTransferDate,
  transferAmountCents,
  normalizeConnectionCredit,
  normalizeConnectionCreditList,
  normalizeConnectionCreditTransfer,
  normalizeConnectionCreditTransferList,
  recordConnectionCreditTransfer,
  removeConnectionCreditTransfer,
  connectionCreditTransfersSorted,
  connectionCreditTransfersForCustomer,
  applyConnectionCreditTransfers,
  connectionCreditTotal,
  connectionCreditTransferSummary,
  connectionCreditTransferSummaryText,
  connectionCreditTransferText,
  connectionCreditTransfersHtml,
  connectionCreditTransferCsv,
  connectionCreditTransferFilename,
} from '../connection-credit-transfer.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'connection-credit-transfer.js'), 'utf8');

const house = { id: 'CONN-HOUSE', customer: 'Ahmed', label: 'House', creditCents: 50000 };
const shop = { id: 'CONN-SHOP', customer: 'Ahmed', label: 'Shop', creditCents: 10000 };
const other = { id: 'CONN-OTHER', customer: 'Bilal', label: 'House', creditCents: 70000 };

const transferA = { id: 'CCT-1', customer: 'Ahmed', fromConnection: 'CONN-HOUSE', toConnection: 'CONN-SHOP', amountCents: 20000, date: '2026-11-05', operator: 'Saad' };
const transferB = { id: 'CCT-2', customer: 'Ahmed', fromConnection: 'CONN-SHOP', toConnection: 'CONN-HOUSE', amountCents: 5000, date: '2026-11-06', operator: 'Saad', note: 'Shop overpaid' };

test('half-formed transfers are refused', () => {
  assert.equal(normalizeConnectionCreditTransfer({ customer: 'Ahmed', fromConnection: 'CONN-HOUSE', toConnection: 'CONN-SHOP', amountCents: 1000, date: '2026-11-05', operator: 'Saad' }), null);
  assert.equal(normalizeConnectionCreditTransfer({ ...transferA, customer: '' }), null);
  assert.equal(normalizeConnectionCreditTransfer({ ...transferA, fromConnection: '' }), null);
  assert.equal(normalizeConnectionCreditTransfer({ ...transferA, toConnection: '' }), null);
  assert.equal(normalizeConnectionCreditTransfer({ ...transferA, operator: '' }), null);
  assert.equal(normalizeConnectionCreditTransfer({ ...transferA, date: '' }), null);
  assert.equal(normalizeConnectionCreditTransfer({ ...transferA, amountCents: 0 }), null);
  assert.equal(normalizeConnectionCreditTransfer({ ...transferA, amountCents: -500 }), null);
  assert.equal(normalizeConnectionCreditTransfer(null), null);
  assert.equal(normalizeConnectionCreditTransfer('nope'), null);
});

test('a transfer from a connection to itself is refused', () => {
  assert.equal(normalizeConnectionCreditTransfer({ ...transferA, toConnection: 'CONN-HOUSE' }), null);
});

test('strict calendar dates: 31-day months, Feb 29 leap and non-leap', () => {
  assert.equal(validTransferDate('2026-08-31'), true);
  assert.equal(validTransferDate('2026-08-32'), false);
  assert.equal(validTransferDate('2026-02-30'), false);
  assert.equal(validTransferDate('2024-02-29'), true);
  assert.equal(validTransferDate('2026-02-29'), false);
  assert.equal(validTransferDate('2026-11-05'), true);
  assert.equal(validTransferDate('2026-13-01'), false);
  assert.equal(validTransferDate('2026-1-05'), false);
  assert.equal(normalizeConnectionCreditTransfer({ ...transferA, date: '2026-02-30' }), null);
});

test('amounts convert exactly once: rupees to cents, cents as-is', () => {
  assert.equal(transferAmountCents({ amount: 250 }), 25000);
  assert.equal(transferAmountCents({ amount: '250.50' }), 25050);
  assert.equal(transferAmountCents({ amountCents: 25050 }), 25050);
  assert.equal(transferAmountCents({ amountCents: 25050, amount: 999 }), 25050);
  assert.equal(transferAmountCents({}), null);
  assert.equal(transferAmountCents({ amount: 'not money' }), null);
  assert.equal(normalizeConnectionCreditTransfer({ ...transferA, amountCents: undefined, amount: 200 }).amountCents, 20000);
});

test('unknown fields are dropped, so no bill, payment, or cross-customer field can creep in', () => {
  const clean = normalizeConnectionCreditTransfer({ ...transferA, billId: 'B-1', paymentId: 'P-1', toCustomer: 'Bilal', crossCustomer: true, forfeit: true });
  assert.deepEqual(Object.keys(clean).sort(), ['amountCents', 'customer', 'date', 'fromConnection', 'id', 'note', 'operator', 'toConnection']);
});

test('connection credit rows: missing id or customer refused, zero credit kept, negatives refused', () => {
  assert.equal(normalizeConnectionCredit({ customer: 'Ahmed', creditCents: 100 }), null);
  assert.equal(normalizeConnectionCredit({ id: 'CONN-X', creditCents: 100 }), null);
  assert.equal(normalizeConnectionCredit({ id: 'CONN-X', customer: 'Ahmed', creditCents: -1 }), null);
  assert.deepEqual(normalizeConnectionCredit({ id: 'CONN-X', customer: 'Ahmed', creditCents: 0 }), { id: 'CONN-X', customer: 'Ahmed', label: '', creditCents: 0 });
  assert.equal(normalizeConnectionCreditList([house, house, null]).length, 1);
});

test('from-connection falls and to-connection rises by exactly the transfer amount', () => {
  const result = applyConnectionCreditTransfers([house, shop], [transferA]);
  assert.equal(result.applied.length, 1);
  assert.equal(result.refused.length, 0);
  const after = Object.fromEntries(result.connections.map((row) => [row.id, row.creditCents]));
  assert.equal(after['CONN-HOUSE'], 30000);
  assert.equal(after['CONN-SHOP'], 30000);
});

test("the customer's total credit is unchanged on the same fixture", () => {
  const before = connectionCreditTotal([house, shop]);
  const result = applyConnectionCreditTransfers([house, shop], [transferA, transferB]);
  assert.equal(result.applied.length, 2);
  assert.equal(connectionCreditTotal(result.connections), before);
  const after = Object.fromEntries(result.connections.map((row) => [row.id, row.creditCents]));
  assert.equal(after['CONN-HOUSE'], 35000);
  assert.equal(after['CONN-SHOP'], 25000);
});

test('a transfer naming two different customers is refused and moves nothing', () => {
  const cross = { ...transferA, id: 'CCT-9', fromConnection: 'CONN-HOUSE', toConnection: 'CONN-OTHER' };
  const result = applyConnectionCreditTransfers([house, shop, other], [cross]);
  assert.equal(result.applied.length, 0);
  assert.equal(result.refused.length, 1);
  assert.equal(result.refused[0].reason, 'different-customers');
  assert.deepEqual(result.connections, [house, shop, other]);
});

test('a transfer whose connections belong to someone other than the named customer is refused', () => {
  const wrong = { ...transferA, id: 'CCT-9', customer: 'Bilal' };
  const result = applyConnectionCreditTransfers([house, shop], [wrong]);
  assert.equal(result.applied.length, 0);
  assert.equal(result.refused[0].reason, 'different-customers');
});

test('unknown connections are refused and move nothing', () => {
  const ghost = { ...transferA, id: 'CCT-9', toConnection: 'CONN-GHOST' };
  const result = applyConnectionCreditTransfers([house, shop], [ghost]);
  assert.equal(result.applied.length, 0);
  assert.equal(result.refused[0].reason, 'unknown-connection');
  assert.deepEqual(result.connections, [house, shop]);
});

test('a transfer larger than the from-connection credit is refused, never clamped or negative', () => {
  const tooBig = { ...transferA, id: 'CCT-9', amountCents: 60000 };
  const result = applyConnectionCreditTransfers([house, shop], [tooBig]);
  assert.equal(result.applied.length, 0);
  assert.equal(result.refused[0].reason, 'insufficient-credit');
  assert.deepEqual(result.connections, [house, shop]);
});

test('transfers apply in date order, so a later transfer sees the earlier balance', () => {
  const first = { ...transferA, amountCents: 45000 };
  const second = { ...transferB, id: 'CCT-3', date: '2026-11-07', fromConnection: 'CONN-HOUSE', toConnection: 'CONN-SHOP', amountCents: 5000 };
  const result = applyConnectionCreditTransfers([house, shop], [second, first]);
  assert.equal(result.applied.map((entry) => entry.id).join(','), 'CCT-1,CCT-3');
  assert.equal(result.refused.length, 0);
  const after = Object.fromEntries(result.connections.map((row) => [row.id, row.creditCents]));
  assert.equal(after['CONN-HOUSE'], 0);
  assert.equal(after['CONN-SHOP'], 60000);
});

test('a second transfer that no longer fits is refused while the first still applies', () => {
  const first = { ...transferA, amountCents: 45000 };
  const second = { ...transferA, id: 'CCT-3', date: '2026-11-07', amountCents: 10000 };
  const result = applyConnectionCreditTransfers([house, shop], [first, second]);
  assert.equal(result.applied.map((entry) => entry.id).join(','), 'CCT-1');
  assert.equal(result.refused[0].reason, 'insufficient-credit');
});

test('inputs are never mutated by recording, removing, or applying', () => {
  const connections = [house, shop];
  const transfers = [transferA];
  const snapshotConnections = JSON.parse(JSON.stringify(connections));
  const snapshotTransfers = JSON.parse(JSON.stringify(transfers));
  applyConnectionCreditTransfers(connections, transfers);
  recordConnectionCreditTransfer(transfers, transferB);
  removeConnectionCreditTransfer(transfers, 'CCT-1');
  assert.deepEqual(connections, snapshotConnections);
  assert.deepEqual(transfers, snapshotTransfers);
});

test('record, remove, sort, and filter behave', () => {
  assert.equal(recordConnectionCreditTransfer([transferA], transferA).length, 1);
  assert.equal(recordConnectionCreditTransfer([transferA], transferB).length, 2);
  assert.equal(recordConnectionCreditTransfer([transferA], { ...transferA, amountCents: 999 }).length, 1);
  assert.equal(removeConnectionCreditTransfer([transferA, transferB], 'CCT-1').length, 1);
  assert.equal(removeConnectionCreditTransfer([transferA], 'CCT-zzz').length, 1);
  assert.deepEqual(connectionCreditTransfersSorted([transferB, transferA]).map((entry) => entry.id), ['CCT-1', 'CCT-2']);
  assert.deepEqual(connectionCreditTransfersForCustomer([transferA, { ...transferB, customer: 'Bilal' }], 'Ahmed').map((entry) => entry.id), ['CCT-1']);
  assert.deepEqual(connectionCreditTransferSummary([transferA, transferB]), { totalCount: 2, totalAmountCents: 25000 });
  assert.equal(connectionCreditTransferSummaryText([]), 'No connection credit transfers recorded.');
  assert.equal(connectionCreditTransferSummaryText([transferA]), '1 transfer recorded, Rs. 200.00 moved between connections.');
});

test('text, HTML escaping, CSV, and filename', () => {
  assert.equal(connectionCreditTransferText(transferA), 'CCT-1: Ahmed · CONN-HOUSE → CONN-SHOP · Rs. 200.00 · 2026-11-05 · Saad');
  assert.equal(connectionCreditTransferText({ ...transferA, note: 'House to shop' }), 'CCT-1: Ahmed · CONN-HOUSE → CONN-SHOP · Rs. 200.00 · 2026-11-05 · Saad — House to shop');
  assert.match(connectionCreditTransfersHtml([{ ...transferA, customer: '<Ahmed>&' }]), /&lt;Ahmed&gt;&amp;/);
  assert.match(connectionCreditTransfersHtml([{ ...transferA, customer: '<Ahmed>&' }]), /CONN-HOUSE/);
  assert.equal(connectionCreditTransfersHtml([]), '<p>No connection credit transfers recorded.</p>');
  const csv = connectionCreditTransferCsv([transferA]);
  assert.match(csv, /^id,customer,from_connection,to_connection,amount_rs,date,operator,note\n/);
  assert.match(csv, /"CCT-1","Ahmed","CONN-HOUSE","CONN-SHOP","200.00","2026-11-05","Saad",""\n$/);
  assert.equal(connectionCreditTransferFilename(), 'connection-credit-transfers.csv');
});

test('the module never reads or writes the cross-customer, combined-dues, or credit-balance modules', () => {
  assert.doesNotMatch(moduleSrc, /from '\.\/credit-transfer\.js'|from '\.\/combined-dues\.js'|from '\.\/credit-balance\.js'|require\(/);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
});

test('panel wiring: app.js imports the module and renders the panel', () => {
  assert.match(appJs, /from '\.\/connection-credit-transfer\.js'/);
  assert.match(appJs, /CONNECTION_CREDIT_TRANSFER_KEY = 'shahdara_connection_credit_transfers_v1'/);
  assert.match(appJs, /function renderConnectionCreditTransfers\(\)/);
  assert.match(appJs, /renderConnectionCreditTransfers\(\)/);
  assert.doesNotMatch(appJs, /\bOLT\b/);
});

test('panel ids are present in index.html', () => {
  for (const id of ['cctCustomer', 'cctFrom', 'cctTo', 'cctAmount', 'cctDate', 'cctOperator', 'cctSaveBtn', 'cctRemoveBtn', 'cctBody', 'cctSummary', 'cctExportBtn', 'cctCheckBtn', 'cctCheckBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
