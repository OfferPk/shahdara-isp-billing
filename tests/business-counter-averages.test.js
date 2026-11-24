// Business-days counter + billing averages + achievements (Features A/B/C).
// PINNING FILE: asserts the NEW parity total (+8 keys). It must not contain
// the bare literal of the previous total.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACHIEVEMENT_MILESTONES, BUSINESS_START_DATE, calculateHisaabAverages,
  calculateLifetimePnl, calculatePnlAnalytics, checkAchievements, countBusinessDays,
} from '../dashboard-pnl.js';
import { formatPKR } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';
import { ACHIEVEMENTS_KEY, loadAchievements, saveAchievements } from '../achievements.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

let mockStorage;
test.beforeEach(() => {
  mockStorage = new MockLocalStorage();
  globalThis.localStorage = mockStorage;
});
test.afterEach(() => {
  delete globalThis.localStorage;
});

// Fixture: 2 distinct payers, 3 payment transactions in 2026-11 (Rs 4,000).
const fixtureState = {
  customers: [
    { id: 'c1', bills: [{ month: '2026-11', payments: [
      { date: '2026-11-05', amount: 1000 },
      { date: '2026-11-06', amount: 1000 } ] }] },
    { id: 'c2', bills: [{ month: '2026-11', payments: [
      { date: '2026-11-07', amount: 2000 } ] }] },
  ],
  expenses: [],
};

test('A1 business start is Eid-ul-Fitr 2025 (31 Mar 2025)', () => {
  assert.equal(BUSINESS_START_DATE, '2025-03-31');
});

test('A2 countBusinessDays: 599 / 709 / 730 / 0 / null-on-bad', () => {
  assert.equal(countBusinessDays('2025-03-31', '2026-11-20'), 599);
  assert.equal(countBusinessDays('2025-03-31', '2027-03-10'), 709);
  assert.equal(countBusinessDays('2025-03-31', '2027-03-31'), 730);
  assert.equal(countBusinessDays('2025-03-31', '2025-03-31'), 0);
  assert.equal(countBusinessDays('bad', '2026-11-20'), null);
  assert.equal(countBusinessDays('2025-03-31', '2025-03-30'), null);
});

test('A3 counter + averages lines exist in index.html and are wired in app.js', () => {
  for (const id of ['hisaabBusinessAge', 'hisaabMonthAverages', 'hisaabLifeAverages']) {
    assert.ok(indexHtml.includes(`id="${id}"`), id);
  }
  for (const marker of ['hisaabBusinessAge', 'hisaabMonthAverages', 'hisaabLifeAverages', 'calculateHisaabAverages', 'countBusinessDays']) {
    assert.ok(appJs.includes(marker), marker);
  }
});

test('B1 engine carries payerCount (2 distinct payers, 3 transactions)', () => {
  const analytics = calculatePnlAnalytics(fixtureState, { selectedMonth: '2026-11', referenceDate: new Date('2026-11-20T00:00:00Z') });
  const monthRow = analytics.monthlyData.find((row) => row.month === '2026-11');
  assert.equal(monthRow.payerCount, 2);
  assert.equal(monthRow.incomeCount, 3);
  assert.equal(calculateLifetimePnl(fixtureState).payerCount, 2);
});

test('B2 averages: 188000/88 = 2136.36, 50000/100 = 500, profit 1636.36', () => {
  const avg = calculateHisaabAverages({ income: 188000, expenses: 50000, payerCount: 88, activeCustomerCount: 100 });
  assert.ok(Math.abs(avg.avgBill - 2136.36) < 0.01);
  assert.equal(avg.expensePerCustomer, 500);
  assert.ok(Math.abs(avg.profitPerCustomer - 1636.36) < 0.01);
  assert.equal(formatPKR(avg.avgBill), 'PKR 2,136.36');
});

test('B3 missing denominators give null, never 0', () => {
  const noPayers = calculateHisaabAverages({ income: 188000, expenses: 50000, payerCount: 0, activeCustomerCount: 100 });
  assert.equal(noPayers.avgBill, null);
  assert.equal(noPayers.profitPerCustomer, null);
  const noRoster = calculateHisaabAverages({ income: 188000, expenses: 50000, payerCount: 88, activeCustomerCount: 0 });
  assert.equal(noRoster.expensePerCustomer, null);
  assert.equal(noRoster.profitPerCustomer, null);
});

test('C1 milestone table: 14 entries, unique ids, days-1000 threshold 999 label 1000', () => {
  assert.equal(ACHIEVEMENT_MILESTONES.length, 14);
  assert.equal(new Set(ACHIEVEMENT_MILESTONES.map((m) => m.id)).size, 14);
  const d1000 = ACHIEVEMENT_MILESTONES.find((m) => m.id === 'days-1000');
  assert.equal(d1000.threshold, 999);
  assert.equal(d1000.label, 1000);
  for (const id of ['profit-100000', 'profit-2000000', 'customers-150', 'customers-500']) {
    assert.ok(ACHIEVEMENT_MILESTONES.some((m) => m.id === id), id);
  }
});

test('C2 checker crosses on >= and lists every crossed rung', () => {
  assert.ok(checkAchievements({ days: 999, lifetimeProfit: 0, activeCustomers: 0 }, []).includes('days-1000'));
  const multi = checkAchievements({ days: 100, lifetimeProfit: 100000, activeCustomers: 150 }, []);
  assert.ok(multi.includes('days-100') && multi.includes('profit-100000') && multi.includes('customers-150'));
  assert.ok(checkAchievements({ days: 1000, lifetimeProfit: 0, activeCustomers: 0 }, []).includes('days-1000'));
});

test('C3 once-only: second check with the achieved set returns nothing', () => {
  const metrics = { days: 999, lifetimeProfit: 2000000, activeCustomers: 500 };
  const first = checkAchievements(metrics, []);
  assert.ok(first.length > 0);
  assert.deepEqual(checkAchievements(metrics, first), []);
});

test('C4 register: first run is null, save/load round-trips, unknown ids are dropped', () => {
  assert.equal(loadAchievements(), null);
  const saved = saveAchievements({ achieved: ['days-100', 'bogus-id'] });
  assert.deepEqual(saved, { achieved: ['days-100'] });
  assert.deepEqual(loadAchievements(), { achieved: ['days-100'] });
  assert.equal(ACHIEVEMENTS_KEY, 'shahdara_achievements_v1');
});

test('C5 milestone messages exist in EN + UR; 1000-day toast carries the party emoji', () => {
  for (const key of ['ach_days_1000', 'ach_days', 'ach_profit', 'ach_customers']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', key);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', key);
  }
  assert.ok(TRANSLATIONS.en.ach_days_1000.includes('🎉🎊'));
  assert.ok(TRANSLATIONS.ur.ach_days_1000.includes('🎉🎊'));
  assert.ok(TRANSLATIONS.ur.ach_days_1000.endsWith('۔'));
  assert.ok(TRANSLATIONS.ur.ach_profit.endsWith('۔'));
  assert.ok(TRANSLATIONS.ur.ach_customers.endsWith('۔'));
});

test('P1 parity total is the new total in EN + UR (+8 keys)', () => {
  // Re-pin (Reports Closing polish): parity 5,223 → 5,229 — the item adds
  // exactly one i18n key, dash_khata_open ('Open Khata Closing ›'), EN + UR.
  // The Reports Register polish (+5 keys) merged first, so this re-pin lands at 5,231 (was 5,229 via Reports Closing).
  // Re-pin (Bill card rebase 2026-11-23): parity 5,229 → 5,231 — L adds 2 keys, prof_hist_snapshot_footnote + prof_hist_due_on, EN + UR.
  // Re-pin (Billing history rebase 2026-11-23): parity 5,231 → 5,234 — M adds 3 keys, prof_hist_empty_months + prof_hist_mark_paid + prof_hist_empty_custom, EN + UR.
  // Re-pin (Recovery Pipeline redesign 2026-11-24): parity 5,234 → 5,235 — the item adds exactly one i18n key, dash_pending_manual_empty, EN + UR.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5235);
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5235);
});

test('P2 the 8 new keys exist in both dicts', () => {
  const keys = ['hisaab_business_days', 'hisaab_avg_bill', 'hisaab_expense_per_customer',
    'hisaab_profit_per_customer', 'ach_days_1000', 'ach_days', 'ach_profit', 'ach_customers'];
  for (const key of keys) {
    assert.ok(key in TRANSLATIONS.en, key);
    assert.ok(key in TRANSLATIONS.ur, key);
  }
});
