import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentDayLabel, summarizeDay, dayHeaderText, groupByDay, billMonthDiffers, methodSlug, recordPaymentDeletion, readPaymentDeletionLog, markPaymentDeletionUndone, pktDateKey } from '../payments-list.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('day labels use Pakistan dates', () => {
  assert.equal(pktDateKey(new Date('2026-10-19T20:00:00Z')), '2026-10-20');
  assert.equal(paymentDayLabel('2026-10-19', '2026-10-19'), 'Today');
  assert.equal(paymentDayLabel('2026-10-18', '2026-10-19'), 'Yesterday');
  assert.match(paymentDayLabel('2026-10-01', '2026-10-19'), /1 Oct 2026/);
});

test('daily subtotal with a per-method split (#298)', () => {
  const txs = [{ date: '2026-10-19', amount: 1000, method: 'Cash' }, { date: '2026-10-19', amount: 1500, method: 'Cash' }, { date: '2026-10-19', amount: 500, method: 'JazzCash' }];
  const s = summarizeDay(txs);
  assert.equal(s.count, 3);
  assert.equal(s.total, 3000);
  assert.deepEqual(s.byMethod, [['Cash', 2500], ['JazzCash', 500]]);
  assert.equal(dayHeaderText('2026-10-19', txs, '2026-10-19'), 'Today · 3 payments · PKR 3,000 (Cash 2,500, JazzCash 500)');
  const g = groupByDay([...txs, { date: '2026-10-18', amount: 100, method: 'Cash' }]);
  assert.deepEqual([...g.keys()], ['2026-10-19', '2026-10-18']);
});

test('bill month is only repeated when it differs from the payment month', () => {
  assert.equal(billMonthDiffers({ date: '2026-10-19', month: '2026-10' }), false);
  assert.equal(billMonthDiffers({ date: '2026-10-19', month: '2026-09' }), true);
  assert.equal(methodSlug('Bank Transfer'), 'bank-transfer');
});

test('payment deletions are kept in a device audit log with the reason, and undo is marked', () => {
  const st = mem();
  recordPaymentDeletion({ paymentId: 'p1', customerId: 'c1', customerNumber: 2, customerName: 'Test Customer 02', month: '2026-10', date: '2026-10-19', amount: 1000, method: 'Cash', reason: '  entered twice ' }, st);
  let log = readPaymentDeletionLog(st);
  assert.equal(log.length, 1);
  assert.equal(log[0].reason, 'entered twice');
  assert.equal(log[0].undone, false);
  markPaymentDeletionUndone('p1', st);
  log = readPaymentDeletionLog(st);
  assert.equal(log[0].undone, true);
});

test('app.js renders compact payment rows with every action kept, and delete has a 10 s Undo', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  for (const hook of ['data-print-receipt', 'data-print-thermal-receipt', 'data-print-thermal58-receipt', 'data-transaction-edit', 'data-transaction-delete', 'class="tx-row"', 'class="tx-details"', 'tx-day-header']) assert.ok(app.includes(hook), hook);
  assert.match(app, /title:'Payment deleted', duration:5000, actionLabel:'Undo', onAction:\(\) => undoDeletePayment/);
  assert.match(app, /input:\{ label:'Reason \(optional, kept in the deletion log\)'/);
  assert.match(app, /askLabel:'WhatsApp receipt'/);
});

test('transactions advance badge sits on its own line in tx-main, never in the auto-width tx-side (FIX-TXN-NAME)', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../payments-list.css', import.meta.url), 'utf8');
  const defAt = app.indexOf('const advanceBadge = transaction.isAdvance');
  assert.ok(defAt > -1, 'transactions advance badge definition exists');
  const region = app.slice(defAt, app.indexOf("}).join('')", defAt));
  const mainAt = region.indexOf('<span class="tx-main">');
  const sideAt = region.indexOf('<span class="tx-side">');
  const badgeAt = region.indexOf('${advanceBadge}');
  assert.ok(mainAt > -1 && sideAt > mainAt, 'row renders tx-main before tx-side');
  assert.ok(region.indexOf('transaction-customer') > mainAt && region.indexOf('transaction-customer') < badgeAt, 'customer name renders inside tx-main, above the badge line');
  assert.ok(badgeAt > mainAt && badgeAt < sideAt, 'advance badge interpolates inside tx-main, before tx-side opens');
  assert.equal(region.split('${advanceBadge}').length - 1, 1, 'advance badge is interpolated exactly once in the row');
  const sideSlice = region.slice(sideAt, region.indexOf('<span class="tx-chevron"'));
  assert.ok(!sideSlice.includes('${advanceBadge}'), 'tx-side carries amount/status only, so its auto width can never starve the name column');
  assert.match(css, /\.tx-main > \.advance-badge \{ justify-self: start; \}/, 'badge hugs its content on its own tx-main line instead of stretching');
});
