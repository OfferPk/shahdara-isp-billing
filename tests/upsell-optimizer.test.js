/**
 * upsell-optimizer.test.js — SISP-59: Customer Speed Upgrade Upsell &
 * ARPU Optimizer.
 *
 * Pins (synthetic data only):
 *  - SPEC PIN: a Rs. 2,000 (5 Mbps) customer with 2 slow-speed
 *    complaints is flagged, target = the next catalogue tier above
 *    5 Mbps priced Rs. 3,000 ("15Mbps Unlimited" — the shipped
 *    catalogue has no 10 Mbps entry), ARPU lift exactly +Rs. 1,000.
 *  - Complaint matcher: the SISP-12 'Slow Speed / High Attenuation'
 *    preset counts exactly; keyword matches count in ticket
 *    customFault/note, register resolutionNote and incident notes
 *    (English + Urdu); non-speed records never count; other
 *    customers' records never count; open AND resolved both count.
 *  - On-time streak: 3 consecutive fully-paid months flag a customer
 *    with no complaints; a partial month breaks the run; a voided
 *    payment never counts (engine status); the current month still
 *    being collected does not break the streak.
 *  - Exclusions: archived, FREE, non-active, > 5 Mbps, unparseable
 *    custom label (no invented speed), no fee, no higher tier.
 *  - Custom fees: target = cheapest catalogue tier above the current
 *    SPEED priced above the current fee; gain = target − fee.
 *  - Offer: Roman Urdu text naming customer/current/target/difference;
 *    wa.me URL via the existing formatWhatsAppUrl helper; an invalid
 *    phone yields no URL (never a fabricated one).
 *  - Read-only: building candidates mutates nothing.
 *  - i18n: every upsell_* / prof_upsell_* key exists in en + ur;
 *    wiring: dashboard section, app.js render, styles.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildUpsellCandidates, buildUpsellSummary, buildUpgradeOfferText,
  countSlowSpeedComplaints, currentPackageInfo, isSlowSpeedText,
  nextUpgradeTier, onTimePaidStreak, upsellCandidateForCustomer
} from '../upsell-optimizer.js';
import { calculatePaymentAllocations } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-15T12:00:00+05:00'); // PKT month 2026-10

function customer(overrides = {}) {
  return {
    id: 'c1', customerNumber: 1, name: 'Test Customer', phone: '03001234567',
    mohalla: 'BARRIAN', serviceStatus: 'active', archived: false,
    isFreeConnection: false, packageSpeed: '5Mbps / 200GB',
    monthlySellingAmount: 2000, monthlyPriceSchedule: [],
    bills: [], incidents: [], ...overrides
  };
}
function bill(month, dueAmount, payments = []) {
  return { id: `b-${month}`, month, dueAmount, status: 'pending', payments };
}
function pay(id, date, amount, extra = {}) {
  return { id, date, amount, method: 'Cash', ...extra };
}
function speedTicket(id, customerId, extra = {}) {
  return { id, customerId, faultPreset: 'Slow Speed / High Attenuation', customFault: '', note: '', status: 'Resolved', ...extra };
}

test('spec pin: Rs 2,000 5 Mbps customer with 2 slow-speed complaints -> Rs 3,000 target, +Rs 1,000/month', () => {
  const state = { customers: [customer()] };
  const tickets = [speedTicket('TKT-101', 'c1'), speedTicket('TKT-102', 'c1', { status: 'Open' })];
  const candidates = buildUpsellCandidates(state, { tickets }, REF);
  assert.equal(candidates.length, 1);
  const c = candidates[0];
  assert.equal(c.currentFee, 2000);
  assert.equal(c.currentSpeedMbps, 5);
  assert.equal(c.targetId, '15mbps-unlimited');
  assert.equal(c.targetPrice, 3000);
  assert.equal(c.targetSpeedMbps, 15);
  assert.equal(c.gainPerMonth, 1000);
  assert.equal(c.slowSpeedComplaints, 2);
  assert.deepEqual(c.reasons, ['complaints']);
});

test('complaint matcher: preset, keywords (en + ur), all three ledgers; non-speed never counts', () => {
  const cust = customer({ incidents: [{ id: 'i1', note: 'انٹرنیٹ بہت سست ہے', reportedAt: '2026-10-01T10:00' }] });
  const counts = countSlowSpeedComplaints(cust, {
    complaints: [
      { id: 'CMP-101', customerId: 'c1', issueCategory: 'Other', resolutionNote: 'Customer said net is very slow, checked line', status: 'Resolved' },
      { id: 'CMP-102', customerId: 'c1', issueCategory: 'Fiber Cut', resolutionNote: 'Splice redone', status: 'Resolved' },
      { id: 'CMP-103', customerId: 'other', issueCategory: 'Other', resolutionNote: 'slow speed', status: 'Open' }
    ],
    tickets: [
      speedTicket('TKT-101', 'c1'),
      { id: 'TKT-102', customerId: 'c1', faultPreset: 'Fiber Cut / Splice Loss', customFault: '', note: 'Replaced connector', status: 'Resolved' },
      { id: 'TKT-103', customerId: 'c1', faultPreset: '', customFault: 'buffering bohat hoti hai', note: '', status: 'Open' }
    ]
  });
  assert.equal(counts.register, 1);
  assert.equal(counts.tickets, 2);
  assert.equal(counts.incidents, 1);
  assert.equal(counts.total, 4);
  assert.equal(isSlowSpeedText('Speed bohat slow hai'), true);
  assert.equal(isSlowSpeedText('fiber cut ho gaya'), false);
  assert.equal(isSlowSpeedText(''), false);
});

test('on-time streak: 3 consecutive paid months flag a complaint-free customer; current unpaid month does not break it', () => {
  const cust = customer({
    bills: [
      bill('2026-07', 2000, [pay('p1', '2026-07-05', 2000)]),
      bill('2026-08', 2000, [pay('p2', '2026-08-05', 2000)]),
      bill('2026-09', 2000, [pay('p3', '2026-09-05', 2000)]),
      bill('2026-10', 2000, [])
    ]
  });
  const state = { customers: [cust] };
  const allocations = calculatePaymentAllocations(state);
  assert.equal(onTimePaidStreak(cust, allocations, '2026-10'), 3);
  const candidates = buildUpsellCandidates(state, {}, REF);
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].reasons, ['on-time']);
  assert.equal(candidates[0].onTimeStreak, 3);
});

test('on-time streak: a partial month breaks the run; a voided payment never counts', () => {
  const partial = customer({
    bills: [
      bill('2026-07', 2000, [pay('p1', '2026-07-05', 2000)]),
      bill('2026-08', 2000, [pay('p2', '2026-08-05', 1000)]),
      bill('2026-09', 2000, [pay('p3', '2026-09-05', 2000)])
    ]
  });
  const voided = customer({
    id: 'c2', customerNumber: 2,
    bills: [
      bill('2026-07', 2000, [pay('p1', '2026-07-05', 2000)]),
      bill('2026-08', 2000, [pay('p2', '2026-08-05', 2000)]),
      bill('2026-09', 2000, [pay('p3', '2026-09-05', 2000, { voided: true })])
    ]
  });
  const state = { customers: [partial, voided] };
  const allocations = calculatePaymentAllocations(state);
  assert.equal(onTimePaidStreak(partial, allocations, '2026-10'), 1);
  assert.equal(onTimePaidStreak(voided, allocations, '2026-10'), 0);
  assert.equal(buildUpsellCandidates(state, {}, REF).length, 0);
});

test('exclusions: archived, FREE, offline, faster tier, unparseable label, no fee, no higher tier', () => {
  const tickets = [speedTicket('TKT-101', 'c1'), speedTicket('TKT-102', 'c2'), speedTicket('TKT-103', 'c3'),
    speedTicket('TKT-104', 'c4'), speedTicket('TKT-105', 'c5'), speedTicket('TKT-106', 'c6'), speedTicket('TKT-107', 'c7')];
  const state = {
    customers: [
      customer({ id: 'c1', archived: true }),
      customer({ id: 'c2', customerNumber: 2, isFreeConnection: true, monthlySellingAmount: null }),
      customer({ id: 'c3', customerNumber: 3, serviceStatus: 'offline' }),
      customer({ id: 'c4', customerNumber: 4, packageSpeed: '15Mbps Unlimited', monthlySellingAmount: 3000 }),
      customer({ id: 'c5', customerNumber: 5, packageSpeed: 'Home Special Pack', monthlySellingAmount: 1800 }),
      customer({ id: 'c6', customerNumber: 6, monthlySellingAmount: null, packageSpeed: '' }),
      customer({ id: 'c7', customerNumber: 7, monthlySellingAmount: 3000 })
    ]
  };
  assert.deepEqual(buildUpsellCandidates(state, { tickets }, REF), []);
});

test('custom fee: cheapest higher-speed tier above the fee wins; gain is target minus fee', () => {
  assert.equal(nextUpgradeTier(5, 2000).id, '15mbps-unlimited');
  assert.equal(nextUpgradeTier(3, 1600).id, '5mbps-200gb');
  assert.equal(nextUpgradeTier(3, 1000).id, '5mbps-150gb');
  assert.equal(nextUpgradeTier(15, 3000), null);
  assert.equal(nextUpgradeTier(5, 3000), null);
  const cust = customer({ packageSpeed: '3Mbps / 300GB', monthlySellingAmount: 1600 });
  const state = { customers: [cust] };
  const candidates = buildUpsellCandidates(state, { tickets: [speedTicket('TKT-101', 'c1')] }, REF);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].targetPrice, 2000);
  assert.equal(candidates[0].gainPerMonth, 400);
  assert.deepEqual(currentPackageInfo(cust), { label: '3Mbps / 300GB', speedMbps: 3, fee: 1600, packageId: '3mbps-300gb' });
});

test('offer text names customer, current and target packages and the difference; wa.me URL uses the existing helper', () => {
  const state = { customers: [customer()] };
  const [c] = buildUpsellCandidates(state, { tickets: [speedTicket('TKT-101', 'c1')] }, REF);
  assert.match(c.offerText, /Test Customer/);
  assert.match(c.offerText, /5Mbps \/ 200GB/);
  assert.match(c.offerText, /15Mbps Unlimited/);
  assert.match(c.offerText, /Rs 1,000/);
  assert.ok(c.whatsappUrl.startsWith('https://wa.me/923001234567?text='));
  assert.equal(buildUpgradeOfferText({ customerName: 'A', currentLabel: 'X', currentFee: 2000, targetLabel: 'Y', targetPrice: 3000, gainPerMonth: 1000 }).includes('Rs 3,000'), true);
  const noPhone = buildUpsellCandidates({ customers: [customer({ phone: '123' })] }, { tickets: [speedTicket('TKT-101', 'c1')] }, REF);
  assert.equal(noPhone[0].whatsappUrl, '');
});

test('summary totals and read-only guarantee', () => {
  const state = { customers: [customer(), customer({ id: 'c2', customerNumber: 2, packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000 })] };
  const snapshot = JSON.stringify(state);
  const tickets = [speedTicket('TKT-101', 'c1'), speedTicket('TKT-102', 'c2')];
  const candidates = buildUpsellCandidates(state, { tickets }, REF);
  assert.equal(JSON.stringify(state), snapshot);
  const summary = buildUpsellSummary(candidates);
  assert.equal(summary.count, 2);
  assert.equal(summary.totalGainPerMonth, 1000 + 500);
  assert.equal(candidates[0].gainPerMonth, 1000); // sorted by gain desc
  assert.equal(upsellCandidateForCustomer(state, state.customers[1], { tickets }, REF).customerId, 'c2');
  assert.equal(upsellCandidateForCustomer(state, customer({ id: 'zz' }), { tickets }, REF), null);
});

test('i18n: every upsell key exists in both dictionaries', () => {
  const keys = ['upsell_title', 'upsell_sub', 'upsell_empty', 'upsell_total', 'upsell_offer',
    'upsell_reason_complaints', 'upsell_reason_ontime', 'upsell_gain', 'upsell_pkg_line',
    'prof_upsell_heading', 'prof_upsell_text'];
  for (const lang of ['en', 'ur']) {
    for (const key of keys) {
      assert.equal(typeof TRANSLATIONS[lang][key], 'string', `${lang}:${key}`);
      assert.notEqual(TRANSLATIONS[lang][key], key);
    }
  }
});

test('wiring: dashboard section, app.js render + profile hint, token-based styles', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="upsellList"/);
  assert.match(html, /id="upsellTotalGain"/);
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /from '\.\/upsell-optimizer\.js'/);
  assert.match(app, /buildUpsellCandidates\(state/);
  assert.match(app, /upsellCandidateForCustomer\(state/);
  const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
  assert.match(css, /\.upsell-card \{/);
  assert.match(css, /var\(--surface\)/);
});
