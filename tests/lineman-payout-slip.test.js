/**
 * tests/lineman-payout-slip.test.js
 * SISP-155 — Lineman Monthly Salary + Visit Commissions − Mid-Month
 * Advance (Upad) Settlement Slip.
 *
 * Pins: the spec math fixture (salary 30,000 + installs 5 × 1,000 +
 * visits 12 × 250 + bonus 2,000 − advances 8,000 = net 32,000);
 * duplicate prevention per (lineman, month) via the deterministic id;
 * exactly-once posting through the convergent sync into Expenses
 * (frozen category 'Salary — Saad') and — for drawer-paid settlements
 * — exactly one Roznamcha outflow, with no second expense via the
 * roznamcha mirror; deletion reversing both mirrors; the negative-net
 * clamp (advances ≥ earnings → net 0, excess carried forward, nothing
 * posted); slip reprint stability from the stored record; the prefill
 * from the real visit/payment trails; backup safe-merge; and the
 * mechanical i18n audit. Synthetic data only — the fixture lineman is
 * "Test Lineman"; no real person's data appears here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LINEMAN_PAYOUTS_KEY,
  LINEMAN_PAYOUT_EXPENSE_CATEGORY,
  LINEMAN_PAYOUT_DRAWER_CATEGORY,
  buildLinemanPayout,
  buildLinemanPayoutPrefill,
  buildLinemanPayoutSlipHtml,
  buildLinemanPayoutSlipModel,
  computeLinemanPayoutLines,
  deleteLinemanPayout,
  findLinemanPayout,
  linemanPayoutIdFor,
  sanitizeLinemanPayouts,
  settleLinemanPayout,
  syncLinemanPayoutLedgers,
  syncedLinemanPayoutExpenseId,
  syncedLinemanPayoutOutflowId
} from '../lineman-payout-slip.js';
import { buildRoznamchaDay, closeRoznamchaDay, syncRoznamchaExpenses } from '../roznamcha.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REF = new Date('2026-10-31T12:00:00+05:00');

// The spec fixture: salary 30,000 + installs 5 × 1,000 + visits
// 12 × 250 + bonus 2,000 − advances 8,000 = net 32,000.
const FIXTURE = Object.freeze({
  linemanName: 'Test Lineman',
  month: '2026-10',
  paidDate: '2026-10-31',
  baseSalary: 30000,
  installCount: 5,
  installRate: 1000,
  visitCount: 12,
  visitRate: 250,
  bonuses: 2000,
  advances: 8000,
  recordedPaymentsTotal: 8000,
  recordedPaymentsCount: 3,
  paidFromDrawer: false,
  note: 'October hisaab'
});

function settledFixture(overrides = {}) {
  return settleLinemanPayout([], { ...FIXTURE, ...overrides }).settlement;
}

// ---- Math ----

test('math: spec fixture nets exactly 32,000 with every line stored', () => {
  const lines = computeLinemanPayoutLines(FIXTURE);
  assert.equal(lines.installCommission, 5000);
  assert.equal(lines.visitCommission, 3000);
  assert.equal(lines.grossEarnings, 40000);
  assert.equal(lines.netPayable, 32000);
  assert.equal(lines.excessAdvance, 0);
  const settlement = buildLinemanPayout(FIXTURE);
  assert.equal(settlement.netPayable, 32000);
  assert.equal(settlement.grossEarnings, 40000);
  assert.equal(settlement.installCommission, 5000);
  assert.equal(settlement.visitCommission, 3000);
  assert.equal(settlement.recordedPaymentsTotal, 8000);
  assert.equal(settlement.id, 'LP-test-lineman-2026-10');
});

test('math: whole-PKR rounding and junk tolerance in the pure builder', () => {
  const lines = computeLinemanPayoutLines({
    baseSalary: '1000.6', installCount: '2', installRate: '333.4',
    visitCount: 1, visitRate: 100, bonuses: 'abc', advances: -50
  });
  assert.equal(lines.baseSalary, 1001);
  // Rates are whole-PKR figures: 333.4 rounds to 333 BEFORE the ×2.
  assert.equal(lines.installCommission, 666);
  assert.equal(lines.bonuses, 0);
  assert.equal(lines.advances, 0);
  assert.equal(lines.netPayable, 1001 + 666 + 100);
});

// ---- Deterministic id + duplicate prevention ----

test('id: deterministic per (lineman, month), name-normalized', () => {
  assert.equal(linemanPayoutIdFor('Test Lineman', '2026-10'), 'LP-test-lineman-2026-10');
  assert.equal(linemanPayoutIdFor('  Test   Lineman ', '2026-10'), 'LP-test-lineman-2026-10');
  assert.notEqual(linemanPayoutIdFor('Test Lineman', '2026-11'), 'LP-test-lineman-2026-10');
});

test('duplicate: same lineman + month refused; other month / lineman allowed', () => {
  const first = settleLinemanPayout([], FIXTURE);
  assert.equal(first.payouts.length, 1);
  assert.throws(() => settleLinemanPayout(first.payouts, FIXTURE), /already settled/);
  // Same slug through case/space variants is the same settlement.
  assert.throws(() => settleLinemanPayout(first.payouts, { ...FIXTURE, linemanName: 'test  lineman' }), /already settled/);
  const otherMonth = settleLinemanPayout(first.payouts, { ...FIXTURE, month: '2026-11', paidDate: '2026-11-30' });
  assert.equal(otherMonth.payouts.length, 2);
  const otherLineman = settleLinemanPayout(first.payouts, { ...FIXTURE, linemanName: 'Second Lineman' });
  assert.equal(otherLineman.payouts.length, 2);
  assert.equal(findLinemanPayout(first.payouts, 'Test Lineman', '2026-10').netPayable, 32000);
  assert.equal(findLinemanPayout(first.payouts, 'Test Lineman', '2026-09'), null);
});

test('validation: bad month, missing name and bad paid date are refused', () => {
  assert.throws(() => buildLinemanPayout({ ...FIXTURE, month: '2026-13' }), /settlement month/);
  assert.throws(() => buildLinemanPayout({ ...FIXTURE, linemanName: '  ' }), /Lineman name is required/);
  assert.throws(() => buildLinemanPayout({ ...FIXTURE, paidDate: '31-10-2026' }), /Paid date must be a valid date/);
});

// ---- Sanitizer ----

test('sanitizer: junk dropped, duplicate ids collapse, tampered figures recomputed', () => {
  const settlement = settledFixture();
  const dirty = [
    settlement,
    { ...settlement },
    null,
    'junk',
    { id: 'LP-x-2026-10', linemanName: 'X', month: '2026-13', paidDate: '2026-10-31' },
    { ...settlement, id: 'LP-other-2026-10', linemanName: 'Other', month: '2026-10', paidDate: '2026-10-31', netPayable: 999999, grossEarnings: 1 }
  ];
  const clean = sanitizeLinemanPayouts(dirty);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].id, settlement.id);
  const other = clean.find((row) => row.id === 'LP-other-2026-10');
  assert.equal(other.netPayable, 32000); // recomputed, tamper gone
  assert.equal(other.grossEarnings, 40000);
  assert.deepEqual(sanitizeLinemanPayouts(null), []);
  assert.deepEqual(sanitizeLinemanPayouts('nope'), []);
});

// ---- Posting: exactly once through the convergent sync ----

test('posting: exactly one expense with the frozen salary category and deterministic ref', () => {
  const settlement = settledFixture();
  const sync = syncLinemanPayoutLedgers([], [], [settlement], REF);
  assert.equal(sync.changed, true);
  assert.equal(sync.added, 1);
  assert.equal(sync.expenses.length, 1);
  const expense = sync.expenses[0];
  assert.equal(expense.id, syncedLinemanPayoutExpenseId(settlement.id));
  assert.equal(expense.id, 'lineman-payout-LP-test-lineman-2026-10');
  assert.equal(expense.linemanPayoutId, settlement.id);
  assert.equal(expense.category, 'Salary — Saad');
  assert.equal(expense.category, LINEMAN_PAYOUT_EXPENSE_CATEGORY);
  assert.equal(expense.amount, 32000);
  assert.equal(expense.date, '2026-10-31');
  assert.equal(expense.source, 'lineman-payout');
  // P&L derives the outflow from that ONE record.
  const pnl = calculatePnlAnalytics({ customers: [], expenses: sync.expenses }, { selectedMonth: '2026-10' });
  const cat = pnl.selectedMonthCategoryBreakdown.categories.find((c) => c.category === 'Salary — Saad');
  assert.ok(cat);
  assert.equal(cat.amount, 32000);
  assert.equal(cat.count, 1);
  // Re-running the sync is a strict no-op — identical references.
  const again = syncLinemanPayoutLedgers(sync.expenses, sync.days, [settlement], REF);
  assert.equal(again.changed, false);
  assert.equal(again.expenses, sync.expenses);
  assert.equal(again.days, sync.days);
});

test('posting: manual expenses are never touched; drifted mirror is restored', () => {
  const settlement = settledFixture();
  const manual = { id: 'manual-1', date: '2026-10-05', amount: 999, category: 'Other expenses', notes: 'owner entry' };
  const sync = syncLinemanPayoutLedgers([manual], [], [settlement], REF);
  assert.equal(sync.expenses.length, 2);
  assert.equal(sync.expenses[0], manual);
  const drifted = sync.expenses.map((row) => row.linemanPayoutId ? { ...row, amount: 1 } : row);
  const repaired = syncLinemanPayoutLedgers(drifted, [], [settlement], REF);
  assert.equal(repaired.updated, 1);
  assert.equal(repaired.expenses.find((row) => row.linemanPayoutId).amount, 32000);
});

test('posting: drawer-paid settlement adds exactly one roznamcha outflow and no second expense', () => {
  const settlement = settledFixture({ paidFromDrawer: true });
  const state = { customers: [] };
  const sync = syncLinemanPayoutLedgers([], [], [settlement], REF);
  assert.equal(sync.drawerAdded, 1);
  const view = buildRoznamchaDay(state, sync.days, '2026-10-31', []);
  const own = view.outflows.filter((o) => o.id === syncedLinemanPayoutOutflowId(settlement.id));
  assert.equal(own.length, 1);
  assert.equal(own[0].amount, 32000);
  assert.equal(own[0].category, LINEMAN_PAYOUT_DRAWER_CATEGORY);
  assert.equal(own[0].lineman, 'Test Lineman');
  // The roznamcha expense mirror must NOT spawn a second expense from
  // this outflow (SISP-155 skip in syncRoznamchaExpenses).
  const mirror = syncRoznamchaExpenses(sync.expenses, sync.days, REF);
  assert.equal(mirror.changed, false);
  assert.equal(mirror.expenses.filter((row) => row.linemanPayoutId === settlement.id).length, 1);
  // And the payout sync itself stays idempotent with the drawer on.
  const again = syncLinemanPayoutLedgers(sync.expenses, sync.days, [settlement], REF);
  assert.equal(again.changed, false);
});

test('posting: closed roznamcha day is never mutated; expense still posts', () => {
  const settlement = settledFixture({ paidFromDrawer: true });
  const state = { customers: [] };
  const open = [{ date: '2026-10-31', outflows: [], closed: false }];
  const closed = closeRoznamchaDay(open, buildRoznamchaDay(state, open, '2026-10-31', []), 0);
  const sync = syncLinemanPayoutLedgers([], closed, [settlement], REF);
  assert.equal(sync.drawerSkippedClosed, 1);
  assert.equal(sync.days, closed);
  assert.equal(sync.expenses.length, 1);
});

// ---- Deletion reverses the posting ----

test('deletion: removing the settlement removes its expense and outflow exactly once', () => {
  const settlement = settledFixture({ paidFromDrawer: true });
  const sync = syncLinemanPayoutLedgers([], [], [settlement], REF);
  const remaining = deleteLinemanPayout([settlement], settlement.id);
  assert.equal(remaining.length, 0);
  const reversed = syncLinemanPayoutLedgers(sync.expenses, sync.days, remaining, REF);
  assert.equal(reversed.changed, true);
  assert.equal(reversed.removed, 1);
  assert.equal(reversed.drawerRemoved, 1);
  assert.equal(reversed.expenses.filter((row) => row.linemanPayoutId).length, 0);
  const view = buildRoznamchaDay({ customers: [] }, reversed.days, '2026-10-31', []);
  assert.equal(view.outflows.filter((o) => o.id.startsWith('lineman-payout-')).length, 0);
  const again = syncLinemanPayoutLedgers(reversed.expenses, reversed.days, remaining, REF);
  assert.equal(again.changed, false);
  assert.throws(() => deleteLinemanPayout([], 'LP-missing-2026-10'), /not found/);
});

// ---- Negative-net rule ----

test('negative net: advances above earnings clamp to 0 with the excess carried forward; nothing posts', () => {
  const settlement = settledFixture({ advances: 50000, paidFromDrawer: true });
  assert.equal(settlement.grossEarnings, 40000);
  assert.equal(settlement.netPayable, 0);
  assert.equal(settlement.excessAdvance, 10000);
  const sync = syncLinemanPayoutLedgers([], [], [settlement], REF);
  assert.equal(sync.changed, false);
  assert.equal(sync.expenses.length, 0);
  assert.equal(sync.days.length, 0);
  const html = buildLinemanPayoutSlipHtml(settlement, { generatedDate: '2026-11-01' });
  assert.match(html, /Advance Carried Forward/);
  assert.match(html, /10,000/);
});

// ---- Slip ----

test('slip: model + HTML carry every stored figure; reprint is stable', () => {
  const settlement = settledFixture();
  const model = buildLinemanPayoutSlipModel(settlement);
  assert.equal(model.netPayable, 32000);
  assert.equal(model.baseSalary, 30000);
  assert.equal(buildLinemanPayoutSlipModel(null), null);
  const html = buildLinemanPayoutSlipHtml(settlement, { generatedDate: '2026-11-05' });
  assert.match(html, /Test Lineman/);
  assert.match(html, /2026-10/);
  assert.match(html, /30,000/);
  assert.match(html, /5,000/);
  assert.match(html, /3,000/);
  assert.match(html, /2,000/);
  assert.match(html, /40,000/);
  assert.match(html, /-8,000/);
  assert.match(html, /32,000/);
  assert.match(html, /Signature — Lineman/);
  assert.match(html, /Signature — Owner \/ Partner/);
  assert.match(html, /LP-test-lineman-2026-10/);
  // Reprint from a sanitized copy of the stored record: same figures.
  const reprinted = buildLinemanPayoutSlipHtml(sanitizeLinemanPayouts([JSON.parse(JSON.stringify(settlement))])[0], { generatedDate: '2026-11-05' });
  assert.equal(reprinted, html);
  assert.equal(buildLinemanPayoutSlipHtml(null), '');
});

// ---- Prefill from the real trails ----

test('prefill: counts from the visit log, advances from the payment log, name from the drawer log', () => {
  const visits = [];
  const visit = (date, type) => ({ id: `v-${visits.length}`, date, type });
  for (let i = 0; i < 5; i += 1) visits.push(visit('2026-10-0' + (i + 1), 'install'));
  for (let i = 0; i < 12; i += 1) visits.push(visit('2026-10-1' + (i % 10), i % 2 ? 'splicing' : 'fiber-fix'));
  visits.push(visit('2026-09-30', 'install')); // other month — excluded
  const payments = [
    { id: 'p-1', date: '2026-10-10', amount: 3000, type: 'salary' },
    { id: 'p-2', date: '2026-10-20', amount: 5000, type: 'commission' },
    { id: 'p-3', date: '2026-09-20', amount: 9000, type: 'salary' } // other month — excluded
  ];
  const roznamchaDays = [
    { date: '2026-10-03', outflows: [{ id: 'o-1', category: 'Splicing', amount: 400, lineman: 'Test Lineman' }], closed: false },
    { date: '2026-10-04', outflows: [{ id: 'o-2', category: 'Splicing', amount: 400, lineman: 'Test Lineman' }, { id: 'o-3', category: 'Petrol', amount: 300, lineman: 'Helper' }], closed: false }
  ];
  const prefill = buildLinemanPayoutPrefill({ visits, payments, roznamchaDays, month: '2026-10' });
  assert.equal(prefill.installCount, 5);
  assert.equal(prefill.visitCount, 12);
  assert.equal(prefill.advances, 8000);
  assert.equal(prefill.recordedPaymentsTotal, 8000);
  assert.equal(prefill.recordedPaymentsCount, 2);
  assert.equal(prefill.baseSalary, 15000); // recorded SAAD_BASE_MONTHLY_SALARY default
  assert.equal(prefill.linemanName, 'Test Lineman');
  const empty = buildLinemanPayoutPrefill({ visits: [], payments: [], roznamchaDays: [], month: '2026-10' });
  assert.equal(empty.linemanName, '');
  assert.equal(empty.installCount, 0);
  assert.equal(empty.advances, 0);
});

// ---- Backup wiring (core.js) ----

test('backup: settlements travel in settings and restore under safe-merge rules', () => {
  const settlement = settledFixture();
  const backupText = createJsonBackup(createInitialState(), REF, { linemanPayouts: [settlement] });
  const backup = JSON.parse(backupText);
  assert.equal(backup.settings.linemanPayouts.length, 1);
  assert.equal(backup.settings.linemanPayouts[0].id, settlement.id);
  // Fresh device adopts the section.
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.canApply, true);
  assert.equal(preview.linemanPayouts.length, 1);
  assert.equal(preview.counts.linemanPayoutsRestored, 1);
  // A device holding DIFFERENT settlements keeps its own + conflict.
  const other = settledFixture({ linemanName: 'Other Lineman' });
  const clash = previewJsonBackupMerge(createInitialState(), backupText, {
    currentLinemanPayouts: [other],
    currentLinemanPayoutsStored: true
  });
  assert.equal(clash.linemanPayouts, null);
  assert.ok(clash.conflicts.some((c) => /Lineman payout records differ/.test(c.field)));
  // Identical records on both sides: no restore needed, no conflict.
  const same = previewJsonBackupMerge(createInitialState(), backupText, {
    currentLinemanPayouts: [settlement],
    currentLinemanPayoutsStored: true
  });
  assert.equal(same.linemanPayouts, null);
  assert.ok(!same.conflicts.some((c) => /Lineman payout/.test(c.field)));
});

// ---- i18n audit ----

test('i18n: every linpayout_ key used by the module + dialog exists in en and ur', () => {
  const moduleSrc = fs.readFileSync(path.join(ROOT, 'lineman-payout-slip.js'), 'utf8');
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dialogRegion = indexSrc.slice(indexSrc.indexOf('id="linemanPayoutModal"'), indexSrc.indexOf('id="linemanPayoutModal"') + 9000);
  const used = new Set();
  for (const match of moduleSrc.matchAll(/t\('(linpayout_[a-z_]+)'/g)) used.add(match[1]);
  for (const match of indexSrc.matchAll(/data-i18n="(linpayout_[a-z_]+)"/g)) used.add(match[1]);
  assert.ok(used.size >= 20, `expected 20+ linpayout_ keys, found ${used.size}`);
  assert.ok(dialogRegion.includes('id="linemanPayoutForm"'));
  const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0 && TRANSLATIONS.ur[key].length > 0, `empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder mismatch ${key}`);
  }
  // Rendered output substitutes params — never a raw key or raw token.
  const rendered = t('linpayout_duplicate', 'en', { month: '2026-10' });
  assert.ok(rendered.includes('2026-10'));
  assert.ok(!rendered.includes('{month}'));
  assert.notEqual(t('linpayout_title', 'ur'), 'linpayout_title');
});

// ---- CSS + wiring pins ----

test('css: the SISP-155 block uses theme tokens only (no hex colours)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'components.css'), 'utf8');
  const block = css.slice(css.indexOf('/* SISP-155'));
  assert.ok(block.length > 200);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'hex colour found in SISP-155 CSS block');
  assert.ok(block.includes('var(--line)'));
});

test('wiring: app.js imports the module, syncs at startup and on change; dialog ids exist', () => {
  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.ok(appSrc.includes("from './lineman-payout-slip.js'"));
  assert.ok(appSrc.includes('recordLinemanPayoutSync()'));
  assert.ok(appSrc.includes('setupLinemanPayoutModal({'));
  assert.ok(appSrc.includes('linemanPayouts: loadLinemanPayouts()'));
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const id of ['linemanPayoutModal', 'openLinemanPayoutBtn', 'linemanPayoutForm', 'linemanPayoutList', 'linPayoutName', 'linPayoutMonth', 'linPayoutPaidDate', 'linPayoutBaseSalary', 'linPayoutInstallCount', 'linPayoutInstallRate', 'linPayoutVisitCount', 'linPayoutVisitRate', 'linPayoutBonuses', 'linPayoutAdvances', 'linPayoutFromDrawer', 'linPayoutNote', 'linPayoutTotals', 'linPayoutPrefillBtn', 'linPayoutAdvancesHint']) {
    assert.ok(indexSrc.includes(`id="${id}"`), `missing dialog element ${id}`);
  }
  const rozSrc = fs.readFileSync(path.join(ROOT, 'roznamcha.js'), 'utf8');
  assert.ok(rozSrc.includes("startsWith('lineman-payout-')"));
  assert.equal(LINEMAN_PAYOUTS_KEY, 'sisp_lineman_payouts_v1');
});
