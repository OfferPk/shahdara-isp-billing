// SISP-181: Uptime Tracking <-> Outage Concession bridge.
// Quick Collect's "⚡ Apply Uptime Concession" fills the SISP-30 concession
// box from the customer's exact calendar-month offline hours
// (uptime-tracking's buildMonthlyUptime) run through concession-helper's
// EXISTING suggestion computation — same formula, same >= 12h threshold,
// no second math anywhere.
//
// Pinned criteria:
//   (1) Spec pin: 31-day month with 2d 6h (54h) offline on a Rs. 3,000
//       package -> the helper's exact pro-rata figure, eligible.
//   (2) A period recorded BOTH as an incident and in the service-status
//       history counts once (union rule) in the hours fed to the formula.
//   (3) Below-threshold and zero-offline months fill nothing (eligible
//       false) — the button's toast path, no invented concession.
//   (4) Month basis is the Quick Collect bill month: 54h offline LAST
//       month does not fill THIS month's 3h concession.
//   (5) Manual equivalence: stamping via applyConcessionToBill with the
//       bridge suggestion is byte-identical to the manual path with the
//       same amount + reason.
//   (6) Free connections have no bill -> the empty, ineligible shape
//       (the UI mirrors the manual control: no bill, no button).
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONCESSION_THRESHOLD_HOURS,
  buildUptimeConcessionSuggestion,
  concessionAmountFor,
  concessionReasonFor,
  suggestConcession
} from '../concession-helper.js';
import { applyConcessionToBill } from '../core.js';
import { buildMonthlyUptime } from '../uptime-tracking.js';
import { TRANSLATIONS, t } from '../nav-language.js';

// After October 2026 ends, so the October window is the full 31 days.
const REF = new Date('2026-11-10T12:00:00+05:00');

const bill = (month, dueAmount, overrides = {}) => ({
  id: `bill-${month}`,
  month,
  dueAmount,
  status: 'pending',
  payments: [],
  amountHistory: [],
  ...overrides
});

const customer = (overrides = {}) => ({
  id: 'c1',
  customerNumber: 101,
  name: 'Synthetic Customer',
  packageSpeed: '5 Mbps',
  connectionDate: '2026-08-01',
  addedOn: '2026-08-01',
  serviceStatus: 'active',
  serviceStatusHistory: [],
  incidents: [],
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000, recordedAt: '2026-08-01T00:00' }],
  bills: [bill('2026-10', 3000)],
  ...overrides
});

// 2026-10-05 10:00 -> 2026-10-07 16:00 = 2 days 6 hours = 54h offline.
const incident54h = (overrides = {}) => ({
  id: 'inc-54',
  reportedAt: '2026-10-05T10:05',
  offlineAt: '2026-10-05T10:00',
  restoredAt: '2026-10-07T16:00',
  note: 'Fiber cut on the main road',
  createdAt: '2026-10-05T10:05',
  corrections: [],
  ...overrides
});

test('spec pin: 31-day month, 54h offline, Rs. 3,000 package -> exact pro-rata concession', () => {
  const cust = customer({ incidents: [incident54h()] });
  const october = cust.bills[0];
  assert.equal(buildMonthlyUptime(cust, '2026-10', REF).daysInMonth, 31);
  const suggestion = buildUptimeConcessionSuggestion(cust, october, { referenceDate: REF });
  assert.equal(suggestion.source, 'uptime');
  assert.equal(suggestion.offlineMinutes, 3240);
  assert.equal(suggestion.downtimeHours, 54);
  assert.equal(suggestion.eligible, true);
  assert.equal(suggestion.thresholdHours, CONCESSION_THRESHOLD_HOURS);
  // The figure is the shared helper's own output for the same inputs —
  // asserted against the helper, never a hand-computed duplicate formula.
  assert.equal(suggestion.suggestedAmount, concessionAmountFor(3000, 54));
  assert.equal(suggestion.suggestedAmount, suggestConcession({ packageRate: 3000, downtimeHours: 54 }).suggestedAmount);
  assert.equal(suggestion.suggestedAmount, 225);
  assert.equal(suggestion.reason, concessionReasonFor(54));
  assert.equal(suggestion.alreadyApplied, false);
});

test('union rule: a period recorded as incident AND status history counts once', () => {
  const cust = customer({
    incidents: [incident54h()],
    serviceStatusHistory: [
      { status: 'offline', at: '2026-10-05T10:00' },
      { status: 'active', at: '2026-10-07T16:00' }
    ]
  });
  const suggestion = buildUptimeConcessionSuggestion(cust, cust.bills[0], { referenceDate: REF });
  assert.equal(suggestion.offlineMinutes, 3240);
  assert.equal(suggestion.downtimeHours, 54);
  assert.equal(suggestion.suggestedAmount, 225);
});

test('below threshold: 3h offline fills nothing', () => {
  const cust = customer({
    incidents: [incident54h({ id: 'inc-3', offlineAt: '2026-10-10T10:00', restoredAt: '2026-10-10T13:00', reportedAt: '2026-10-10T10:05', createdAt: '2026-10-10T10:05' })]
  });
  const suggestion = buildUptimeConcessionSuggestion(cust, cust.bills[0], { referenceDate: REF });
  assert.equal(suggestion.downtimeHours, 3);
  assert.equal(suggestion.eligible, false);
  assert.equal(suggestion.reason, '');
});

test('zero offline hours: no concession is invented', () => {
  const cust = customer();
  const suggestion = buildUptimeConcessionSuggestion(cust, cust.bills[0], { referenceDate: REF });
  assert.equal(suggestion.offlineMinutes, 0);
  assert.equal(suggestion.downtimeHours, 0);
  assert.equal(suggestion.suggestedAmount, 0);
  assert.equal(suggestion.eligible, false);
});

test('month basis: 54h offline last month does not fill this month\'s 3h', () => {
  const cust = customer({
    incidents: [
      incident54h({ id: 'inc-sep', offlineAt: '2026-09-10T09:00', restoredAt: '2026-09-12T15:00', reportedAt: '2026-09-10T09:05', createdAt: '2026-09-10T09:05' }),
      incident54h({ id: 'inc-oct', offlineAt: '2026-10-10T10:00', restoredAt: '2026-10-10T13:00', reportedAt: '2026-10-10T10:05', createdAt: '2026-10-10T10:05' })
    ],
    bills: [bill('2026-09', 3000), bill('2026-10', 3000)]
  });
  const october = buildUptimeConcessionSuggestion(cust, cust.bills[1], { referenceDate: REF });
  assert.equal(october.downtimeHours, 3);
  assert.equal(october.eligible, false);
  // The same recorded hours DO belong to September's own bill month.
  const september = buildUptimeConcessionSuggestion(cust, cust.bills[0], { referenceDate: REF });
  assert.equal(september.downtimeHours, 54);
  assert.equal(september.eligible, true);
  assert.equal(september.suggestedAmount, 225);
});

test('manual equivalence: the bridge stamp is byte-identical to the manual path', () => {
  const cust = customer({ incidents: [incident54h()] });
  const state = { version: 1, customers: [cust] };
  const suggestion = buildUptimeConcessionSuggestion(cust, cust.bills[0], { referenceDate: REF });
  const viaBridge = applyConcessionToBill(state, 'c1', '2026-10', { amount: suggestion.suggestedAmount, reason: suggestion.reason }, REF);
  const viaManual = applyConcessionToBill(state, 'c1', '2026-10', { amount: concessionAmountFor(3000, 54), reason: concessionReasonFor(54) }, REF);
  assert.deepEqual(viaBridge.customers[0].bills[0], viaManual.customers[0].bills[0]);
  const stamped = viaBridge.customers[0].bills[0];
  assert.equal(stamped.concessionAmount, 225);
  assert.equal(stamped.concessionReason, 'Outage Reaayat: 54h offline');
  assert.equal(stamped.amountHistory.at(-1).type, 'concession_applied');
  // The original state was not mutated by either application.
  assert.equal(cust.bills[0].concessionAmount, undefined);
});

test('purity: building the suggestion mutates neither customer nor bill', () => {
  const cust = customer({ incidents: [incident54h()] });
  const before = JSON.stringify(cust);
  buildUptimeConcessionSuggestion(cust, cust.bills[0], { referenceDate: REF });
  assert.equal(JSON.stringify(cust), before);
});

test('already applied: an existing concession is reported, not re-suggested over', () => {
  const cust = customer({
    incidents: [incident54h()],
    bills: [bill('2026-10', 3000, { concessionAmount: 100, concessionReason: 'Outage Reaayat: 24h offline' })]
  });
  const suggestion = buildUptimeConcessionSuggestion(cust, cust.bills[0], { referenceDate: REF });
  assert.equal(suggestion.alreadyApplied, true);
  assert.equal(suggestion.existingAmount, 100);
  assert.equal(suggestion.existingReason, 'Outage Reaayat: 24h offline');
});

test('free connection: no bill -> empty ineligible shape (no button, like the manual control)', () => {
  const free = customer({ isFreeConnection: true, bills: [] });
  // The uptime one-liner still has something honest to say for a free
  // connection (it needs no bill) — only the concession bridge has nothing
  // to fill, because there is no bill to fill it on.
  assert.equal(buildMonthlyUptime(free, '2026-10', REF).daysInMonth, 31);
  const noBill = buildUptimeConcessionSuggestion(free, undefined, { referenceDate: REF });
  assert.equal(noBill.eligible, false);
  assert.equal(noBill.suggestedAmount, 0);
  assert.equal(noBill.alreadyApplied, false);
  assert.equal(noBill.offlineMinutes, 0);
  const noCustomer = buildUptimeConcessionSuggestion(null, null, { referenceDate: REF });
  assert.equal(noCustomer.eligible, false);
  assert.equal(noCustomer.customerId, null);
});

test('i18n: every new bridge string exists in en + ur with matching placeholders', () => {
  const keys = ['upt_qc_apply_concession', 'upt_qc_concession_filled', 'upt_qc_concession_below_threshold'];
  const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `missing en ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder parity ${key}`);
    assert.notEqual(t(key, 'en', { amount: 225, hours: 3, threshold: 12 }), key);
    assert.notEqual(t(key, 'ur', { amount: 225, hours: 3, threshold: 12 }), key);
  }
  // The below-threshold toast renders the real figures, no raw placeholders.
  const toast = t('upt_qc_concession_below_threshold', 'en', { hours: 3, threshold: CONCESSION_THRESHOLD_HOURS });
  assert.ok(toast.includes('3h') && toast.includes('12h') && !toast.includes('{'));
});

test('wiring: Quick Collect fills via the bridge and never copies the formula', () => {
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qc.includes('buildUptimeConcessionSuggestion'), 'QC imports the bridge builder');
  assert.ok(qc.includes("t('upt_qc_apply_concession')"), 'QC renders the ⚡ button from the i18n key');
  assert.ok(qc.includes('data-qc-uptime-concession'), 'QC marks the bridge button');
  assert.ok(qc.includes('fillUptimeConcession'), 'QC has the fill handler');
  assert.ok(qc.includes("t('upt_qc_concession_below_threshold'"), 'QC toasts honestly below threshold');
  assert.ok(!qc.includes('/ 720') && !qc.includes('/720'), 'QC carries no private copy of the pro-rata formula');
  const helper = readFileSync(new URL('../concession-helper.js', import.meta.url), 'utf8');
  assert.ok(helper.includes("from './uptime-tracking.js'"), 'bridge reads uptime-tracking');
  assert.ok(helper.includes('buildMonthlyUptime'), 'bridge uses the shared month summary');
});
