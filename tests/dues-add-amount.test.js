// Dues recovery "Add amount" (2026-11-10, Option C): the recovery
// list's Outstanding is the total the owner can collect — bill dues
// PLUS the customer's unpaid manual baqaya — for customers already
// listed. Baqaya-only customers still never appear (the QC-2 listing
// rule: only an open priced bill lists a customer). The priority
// score and group stay bill-only on purpose: the scorer is shared
// with the QC-2 priority tiers, which must not move when a baqaya
// is added. The recovery card shows the breakdown ("Bill X +
// Additional Y") and a ＋ Add amount button opening the existing
// Additional Pending dialog, which sets the TOTAL additional amount.
// Synthetic data only — no real customer names anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, setManualBaqayaOutstanding } from '../core.js';
import { buildSmartDuesRecovery } from '../owner-insights.js';
import { TRANSLATIONS } from '../nav-language.js';

const today = new Date('2026-10-07T12:00:00+05:00');

function fixture({ withBaqaya = true } = {}) {
  let state = createInitialState(['Ali', 'Bina', 'Cid']);
  // Ali (seed-001): one open bill of 1000, plus 500 manual baqaya.
  state = saveBillMonth(state, 'seed-001', { month: '2026-10', dueAmount: '1000', status: 'pending' }, today);
  if (withBaqaya) state = setManualBaqayaOutstanding(state, 'seed-001', { amount: 500, date: '2026-10-01', note: 'test baqaya' }, today);
  // Bina (seed-002): baqaya only, no bills — must never appear.
  state = setManualBaqayaOutstanding(state, 'seed-002', { amount: 700, date: '2026-10-01', note: 'test baqaya' }, today);
  // Cid (seed-003): one open bill of 1000, no baqaya.
  state = saveBillMonth(state, 'seed-003', { month: '2026-10', dueAmount: '1000', status: 'pending' }, today);
  return state;
}

function rowFor(result, customerId) {
  return result.groups.flatMap(group => group.customers).find(row => row.customerId === customerId);
}

test('recovery outstanding adds the manual baqaya for listed customers only', () => {
  const result = buildSmartDuesRecovery(fixture(), today);
  // Bina (baqaya-only) never appears; Ali and Cid do.
  assert.equal(result.totalCustomers, 2);
  assert.equal(rowFor(result, 'seed-002'), undefined);
  const ali = rowFor(result, 'seed-001');
  assert.equal(ali.billDuesCents, 100000);
  assert.equal(ali.manualBaqayaCents, 50000);
  assert.equal(ali.outstandingCents, 150000);
  assert.equal(ali.outstanding, 1500);
  assert.equal(ali.billDues, 1000);
  assert.equal(ali.manualBaqaya, 500);
  const cid = rowFor(result, 'seed-003');
  assert.equal(cid.billDuesCents, 100000);
  assert.equal(cid.manualBaqayaCents, 0);
  assert.equal(cid.outstandingCents, 100000);
  assert.equal(cid.outstanding, 1000);
  // Group and list totals follow the inclusive figure.
  assert.equal(result.totalRecoverable, 2500);
  assert.equal(result.groups.reduce((sum, group) => sum + group.recoverableAmount, 0), result.totalRecoverable);
});

test('priority score, group and reasons ignore the baqaya (QC-2 tiers do not move)', () => {
  const withBaqaya = buildSmartDuesRecovery(fixture({ withBaqaya: true }), today);
  const withoutBaqaya = buildSmartDuesRecovery(fixture({ withBaqaya: false }), today);
  const aliWith = rowFor(withBaqaya, 'seed-001');
  const aliWithout = rowFor(withoutBaqaya, 'seed-001');
  assert.equal(aliWith.priorityScore, aliWithout.priorityScore);
  assert.equal(aliWith.group, aliWithout.group);
  assert.deepEqual(aliWith.reasons, aliWithout.reasons);
  assert.deepEqual(aliWith.components, aliWithout.components);
});

test('recovery card carries the Collect button, the health tag and the breakdown line', () => {
  const ownerUi = readFileSync(new URL('../owner-ui.js', import.meta.url), 'utf8');
  // Dues Recovery Overhaul §4: the recovery card's ＋ Add amount
  // button is renamed to Collect and opens the payment collection
  // pre-filled with the outstanding balance (it no longer opens the
  // Additional Pending dialog — that dialog is still reachable from
  // the customer card). The bill + baqaya breakdown line stays.
  assert.ok(ownerUi.includes('data-recovery-collect'), 'recovery card Collect button opens the payment collection');
  assert.ok(ownerUi.includes("t('recovery_collect')"), 'Collect label is the new recovery_collect key');
  assert.ok(ownerUi.includes('openCollect'), 'collection opener is wired through setupOwnerCenter');
  assert.ok(!ownerUi.includes('data-additional-pending'), 'the recovery card no longer carries the Add-amount button');
  assert.ok(ownerUi.includes("t('addpend_breakdown'"), 'breakdown line reuses the existing addpend_breakdown key');
  assert.equal(TRANSLATIONS.en.recovery_add_amount, '＋ Add amount');
  assert.equal(TRANSLATIONS.ur.recovery_add_amount, '＋ رقم شامل کریں');
});

test('the Additional Pending dialog save refreshes the owner view', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  // The dialog save must re-render the recovery list too, or a card
  // edited from the list would keep its old figure until the next
  // view render.
  const handlerStart = app.indexOf("$('#additionalPendingForm').addEventListener('submit'");
  assert.ok(handlerStart >= 0, 'dialog submit handler exists');
  const handler = app.slice(handlerStart, app.indexOf("$('#saveMohallaButton')", handlerStart));
  assert.ok(handler.includes('refreshOwnerCenter()'), 'dialog save calls refreshOwnerCenter()');
  assert.ok(app.includes('openCollect:'), 'setupOwnerCenter receives the Collect opener');
});
