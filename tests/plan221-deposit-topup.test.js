import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDepositTopUp,
  normalizeDepositTopUpList,
  findDepositTopUp,
  recordDepositTopUp,
  removeDepositTopUp,
  depositTopUpsSorted,
  depositTopUpsForDeposit,
  depositTopUpsForCustomer,
  depositTopUpTotalCents,
  depositRegisterBalance,
  depositWithTopUpsBalance,
  depositTopUpSummaryText,
  depositTopUpText,
  depositTopUpHtml,
  depositTopUpAllHtml,
  depositTopUpCsv,
  depositTopUpFilename,
} from '../deposit-topup.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'deposit-topup.js'), 'utf8');

const first = {
  id: 'TU-1', depositRef: 'DEP-1', customer: 'Ahmed', amountAdded: 1000,
  date: '2026-10-05', reason: 'Package upgraded.', source: 'Cash payment',
};
const second = {
  id: 'TU-2', depositRef: 'DEP-1', customer: 'Ahmed', amountAdded: 500,
  date: '2026-09-05', reason: 'Second connection added.', source: 'Bank transfer',
};

test('a top-up with no deposit reference, no amount, no date, no reason, or no source is refused', () => {
  assert.equal(normalizeDepositTopUp({ ...first, depositRef: '' }), null);
  assert.equal(normalizeDepositTopUp({ ...first, amountAdded: 0 }), null);
  assert.equal(normalizeDepositTopUp({ ...first, amountAdded: -50 }), null);
  assert.equal(normalizeDepositTopUp({ ...first, date: '' }), null);
  assert.equal(normalizeDepositTopUp({ ...first, reason: '' }), null);
  assert.equal(normalizeDepositTopUp({ ...first, source: '' }), null);
  assert.equal(normalizeDepositTopUp({ ...first, id: '' }), null);
});

test('strict dates are enforced: 2026-02-30 refused, 2024-02-29 accepted', () => {
  assert.equal(normalizeDepositTopUp({ ...first, date: '2026-02-30' }), null);
  assert.notEqual(normalizeDepositTopUp({ ...first, date: '2024-02-29' }), null);
  assert.equal(normalizeDepositTopUp({ ...first, date: '2026-13-01' }), null);
  assert.equal(normalizeDepositTopUp({ ...first, date: '05-10-2026' }), null);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...first, billId: 'BILL-9', paymentId: 'PAY-9' };
  const normalized = normalizeDepositTopUp(input);
  assert.equal(normalized.billId, undefined);
  assert.equal(normalized.paymentId, undefined);
  assert.equal(input.billId, 'BILL-9');
  const list = recordDepositTopUp([], input);
  assert.equal(list[0].billId, undefined);
});

test('a duplicate id is never rewritten', () => {
  const list = recordDepositTopUp([first], { ...first, amountAdded: 9999 });
  assert.equal(list.length, 1);
  assert.equal(list[0].amountAddedCents, 100000);
});

test('find and remove work on the normalised list', () => {
  const list = [first, second];
  assert.equal(findDepositTopUp(list, 'TU-2').depositRef, 'DEP-1');
  assert.equal(findDepositTopUp(list, 'TU-9'), null);
  assert.equal(removeDepositTopUp(list, 'TU-1').length, 1);
  assert.equal(removeDepositTopUp(list, 'TU-9').length, 2);
});

test('top-ups sort by date, then deposit reference, then id', () => {
  const sorted = depositTopUpsSorted([first, second]);
  assert.deepEqual(sorted.map((row) => row.id), ['TU-2', 'TU-1']);
});

test('top-ups filter by exact deposit reference and by customer substring', () => {
  const list = [first, second, { ...first, id: 'TU-3', depositRef: 'DEP-2', customer: 'Bilal' }];
  assert.equal(depositTopUpsForDeposit(list, 'DEP-1').length, 2);
  assert.equal(depositTopUpsForDeposit(list, 'DEP-2').length, 1);
  assert.equal(depositTopUpsForDeposit(list, '').length, 0);
  assert.equal(depositTopUpsForCustomer(list, 'ahm').length, 2);
  assert.equal(depositTopUpsForCustomer(list, 'BILAL').length, 1);
});

test('top-ups for a deposit sum exactly, and the register balance adds original plus top-ups plus notes', () => {
  const list = [first, second];
  assert.equal(depositTopUpTotalCents(list, 'DEP-1'), 150000);
  assert.equal(depositTopUpTotalCents(list, 'DEP-2'), 0);
  const balance = depositWithTopUpsBalance(list, 'DEP-1', 200000, 2500);
  assert.equal(balance.balanceCents, 352500);
  assert.equal(balance.originalCents, 200000);
  assert.equal(balance.topUpCents, 150000);
  assert.equal(balance.notesCents, 2500);
  assert.equal(balance.topUpCount, 2);
  assert.equal(depositRegisterBalance(200000, 150000, -5000).balanceCents, 345000);
  assert.equal(depositRegisterBalance(200000, 150000, 'bad'), null);
});

test('summary text, note text, HTML escaping, and CSV with filename', () => {
  assert.equal(depositTopUpSummaryText([]), 'No deposit top-ups recorded.');
  assert.match(depositTopUpSummaryText([first, second]), /2 deposit top-ups.*Rs\. 1500\.00/);
  assert.match(depositTopUpText(first), /TU-1 to deposit DEP-1 for Ahmed: Rs\. 1000\.00 added on 2026-10-05/);
  assert.equal(depositTopUpText({ ...first, source: '' }), 'Deposit top-up not recorded: its inputs are incomplete.');
  const html = depositTopUpHtml({ ...first, reason: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(depositTopUpAllHtml([]), /No deposit top-ups recorded/);
  const csv = depositTopUpCsv([second, first]);
  assert.ok(csv.startsWith('Top-up,Deposit,Customer,Amount added,Date,Reason,Source'));
  assert.ok(csv.indexOf('TU-2') < csv.indexOf('TU-1'));
  assert.equal(depositTopUpFilename(), 'deposit-topups.csv');
});

test('a stored record re-read through the normaliser never inflates a hundredfold', () => {
  const stored = normalizeDepositTopUp(first);
  const reread = normalizeDepositTopUp({ ...stored, amountAdded: undefined });
  assert.equal(reread.amountAddedCents, 100000);
});

test('purity fence: the module reads no storage, clock, or network', () => {
  assert.doesNotMatch(moduleSrc, /localStorage|Date\.now|new Date\(|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(moduleSrc, /from '\.\//);
});

test('neighbour-module fence: the register and the notes modules are neither read nor rewritten here', () => {
  assert.doesNotMatch(moduleSrc, /deposit-register\.js|deposit-notes\.js/);
  assert.doesNotMatch(moduleSrc, /normalizeDeposit\(|normalizeDepositNote\(|upsertDeposit\(|upsertDepositNote\(/);
});

test('panel ids are present in index.html', () => {
  for (const id of ['dtHeading', 'dtBody', 'dtSummary', 'dtExportBtn', 'dtDepositRef', 'dtCustomer', 'dtAmount', 'dtDate', 'dtReason', 'dtSource', 'dtSaveBtn', 'dtRemoveId', 'dtRemoveBtn', 'dtDepositFilter']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the deposit top-up panel', () => {
  assert.ok(appJs.includes("from './deposit-topup.js'"));
  assert.ok(appJs.includes('renderDepositTopUps()'));
  assert.ok(appJs.includes('shahdara_deposit_topups_v1'));
});

test('deployment guard: no standalone OLT word is added to app.js by this plan', () => {
  const lines = appJs.split('\n');
  const hit = lines.find((line) => /\bOLT\b/.test(line) && line.includes('deposit'));
  assert.equal(hit, undefined);
});
