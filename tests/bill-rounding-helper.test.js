// SISP-131: Pro-Rata & Concession "Nearest Rs. 50" Note Rounding Toggle.
// Pure-helper + state-layer tests on synthetic data only.
//
// Pinned spec criteria:
//   - roundToNearest50(amountPKR, mode): 'nearest' rounds to the closest
//     multiple of 50 with midpoints rounding UP (Rs. 2,425 -> Rs. 2,450),
//     'down' floors (Rs. 2,499 -> Rs. 2,450; Rs. 2,449 -> Rs. 2,400),
//     'exact' passes the amount through; the spec example Rs. 2,419
//     rounds to Rs. 2,400 in 'nearest'.
//   - Exact multiples of 50 are unchanged in every mode.
//   - The stamped figure IS the rounded figure (concessionAmount /
//     recorded pro-rata credit), and the unrounded figure survives in an
//     audit tag { rawAmount, roundedAmount, mode } on the bill's
//     amountHistory entry / the customer's packageHistory entry.
//   - Toggle OFF (no rounding passed) -> stamps and history entries are
//     byte-identical to the pre-SISP-131 shapes.
//   - The Khata Doctor agrees with a rounded pro-rata stamp via its tag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ROUNDING_MODES,
  isRoundingMode,
  roundToNearest50,
  roundedAmountFor,
  roundingTagFor,
  sanitizeRoundingTag
} from '../bill-rounding-helper.js';
import {
  netDueAfterConcession,
  roundedConcessionSuggestion,
  suggestConcession
} from '../concession-helper.js';
import {
  applyConcessionToBill,
  createJsonBackup,
  previewJsonBackupMerge,
  updateCustomerProfile
} from '../core.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import { calculatePlanMigrationProration } from '../form-validation.js';
import { auditBillingCorrectness, AUDIT_RULE_CODES } from '../qa-billing-correctness.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const REF = new Date('2026-10-15T12:00:00+05:00');

// --- roundToNearest50: modes ---------------------------------------------

test('exact multiples of 50 are unchanged in every mode', () => {
  for (const mode of ROUNDING_MODES) {
    for (const amount of [0, 50, 100, 2400, 3000]) {
      assert.equal(roundToNearest50(amount, mode), amount, `${amount} in ${mode}`);
    }
  }
});

test('nearest: closest multiple of 50, midpoints round UP', () => {
  assert.equal(roundToNearest50(2419, 'nearest'), 2400); // spec example
  assert.equal(roundToNearest50(2425, 'nearest'), 2450); // midpoint -> up
  assert.equal(roundToNearest50(2475, 'nearest'), 2500); // midpoint -> up
  assert.equal(roundToNearest50(25, 'nearest'), 50);     // midpoint -> up
  assert.equal(roundToNearest50(2424, 'nearest'), 2400);
  assert.equal(roundToNearest50(2474, 'nearest'), 2450);
  assert.equal(roundToNearest50(24, 'nearest'), 0);
  assert.equal(roundToNearest50(2425), 2450);            // default mode is nearest
});

test('down: floors to a multiple of 50', () => {
  assert.equal(roundToNearest50(2499, 'down'), 2450);
  assert.equal(roundToNearest50(2449, 'down'), 2400);
  assert.equal(roundToNearest50(2419, 'down'), 2400);
  assert.equal(roundToNearest50(49, 'down'), 0);
});

test('exact: the amount passes through unchanged', () => {
  assert.equal(roundToNearest50(2419, 'exact'), 2419);
  assert.equal(roundToNearest50(2419.75, 'exact'), 2419.75);
});

test('fractional input is absorbed by nearest/down; results are whole rupees', () => {
  assert.equal(roundToNearest50(2419.5, 'nearest'), 2400);
  assert.equal(roundToNearest50(2475.2, 'nearest'), 2500);
  assert.equal(roundToNearest50(2449.9, 'down'), 2400);
});

test('invalid input fails loudly: non-finite/non-number -> TypeError, negative -> RangeError, bad mode -> Error', () => {
  assert.throws(() => roundToNearest50(Number.NaN), TypeError);
  assert.throws(() => roundToNearest50(Infinity), TypeError);
  assert.throws(() => roundToNearest50('2419'), TypeError);
  assert.throws(() => roundToNearest50(null), TypeError);
  assert.throws(() => roundToNearest50(-1), RangeError);
  assert.throws(() => roundToNearest50(2400, 'up'), /Unknown rounding mode/);
  assert.equal(isRoundingMode('nearest'), true);
  assert.equal(isRoundingMode('up'), false);
});

// --- audit tag helpers -----------------------------------------------------

test('roundingTagFor: a tag only when a real rounding happened', () => {
  assert.deepEqual(roundingTagFor(2419, 2400, 'nearest'), { rawAmount: 2419, roundedAmount: 2400, mode: 'nearest' });
  assert.equal(roundingTagFor(2400, 2400, 'nearest'), null); // already on a note boundary
  assert.equal(roundingTagFor(2419, 2419, 'exact'), null);
  assert.equal(roundingTagFor(2419, 2400, 'up'), null);
  assert.equal(roundingTagFor('x', 2400, 'nearest'), null);
});

test('sanitizeRoundingTag: keeps exactly { rawAmount, roundedAmount, mode }', () => {
  assert.deepEqual(
    sanitizeRoundingTag({ rawAmount: 2419, roundedAmount: 2400, mode: 'down', junk: true }),
    { rawAmount: 2419, roundedAmount: 2400, mode: 'down' }
  );
  assert.equal(sanitizeRoundingTag(null), null);
  assert.equal(sanitizeRoundingTag({ rawAmount: 2400, roundedAmount: 2400, mode: 'nearest' }), null);
});

test('roundedAmountFor: toggle off -> input + no tag; on -> rounded figure + tag', () => {
  assert.deepEqual(roundedAmountFor(2419), { amount: 2419, rounding: null });
  assert.deepEqual(roundedAmountFor(2419, { enabled: false, mode: 'down' }), { amount: 2419, rounding: null });
  assert.deepEqual(roundedAmountFor(2419, { enabled: true, mode: 'nearest' }), {
    amount: 2400,
    rounding: { rawAmount: 2419, roundedAmount: 2400, mode: 'nearest' }
  });
  assert.deepEqual(roundedAmountFor(2419, { enabled: true, mode: 'exact' }), { amount: 2419, rounding: null });
  assert.deepEqual(roundedAmountFor(2400, { enabled: true, mode: 'nearest' }), { amount: 2400, rounding: null });
});

// --- concession flow (SISP-30 suggestion -> rounded stamp + audit tag) -----

const customerWithBill = (dueAmount, scheduleAmount = null) => ({
  id: 'c1',
  customerNumber: 101,
  name: 'Synthetic Customer',
  packageSpeed: '5 Mbps',
  monthlyPriceSchedule: scheduleAmount === null ? [] : [{ effectiveMonth: '2026-10', amount: scheduleAmount, recordedAt: '2026-10-01T00:00' }],
  bills: [{ id: 'bill-2026-10', month: '2026-10', dueAmount, dueDate: '2026-10-05', priceSnapshot: dueAmount, status: 'pending', payments: [], amountHistory: [] }],
  incidents: []
});

const stateWithBill = (dueAmount, scheduleAmount = null) => ({
  version: 1,
  nextCustomerNumber: 102,
  customers: [customerWithBill(dueAmount, scheduleAmount)]
});

test('the spec example end-to-end: Rs. 3,483 package + 500h downtime suggests Rs. 2,419', () => {
  const suggestion = suggestConcession({ packageRate: 3483, downtimeHours: 500 });
  assert.equal(suggestion.eligible, true);
  assert.equal(suggestion.suggestedAmount, 2419);
});

test('roundedConcessionSuggestion: on -> rounded figure + raw kept + tag; off -> raw, no tag', () => {
  const suggestion = suggestConcession({ packageRate: 3483, downtimeHours: 500 });
  const on = roundedConcessionSuggestion(suggestion, { enabled: true, mode: 'nearest' });
  assert.equal(on.suggestedAmount, 2400);
  assert.equal(on.rawSuggestedAmount, 2419);
  assert.deepEqual(on.rounding, { rawAmount: 2419, roundedAmount: 2400, mode: 'nearest' });
  const off = roundedConcessionSuggestion(suggestion, { enabled: false, mode: 'nearest' });
  assert.equal(off.suggestedAmount, 2419);
  assert.equal(off.rounding, null);
  const down = roundedConcessionSuggestion(suggestion, { enabled: true, mode: 'down' });
  assert.equal(down.suggestedAmount, 2400);
});

test('ledger audit tag: a rounded concession stamps the ROUNDED figure and tags raw + rounded + mode', () => {
  const suggestion = suggestConcession({ packageRate: 3483, downtimeHours: 500 });
  const effective = roundedConcessionSuggestion(suggestion, { enabled: true, mode: 'nearest' });
  const next = applyConcessionToBill(stateWithBill(3483, 3483), 'c1', '2026-10', {
    amount: effective.suggestedAmount,
    reason: suggestion.reason,
    rounding: effective.rounding
  }, REF);
  const bill = next.customers[0].bills[0];
  assert.equal(bill.concessionAmount, 2400); // the stamp IS the rounded figure
  const entry = bill.amountHistory[bill.amountHistory.length - 1];
  assert.equal(entry.type, 'concession_applied');
  assert.equal(entry.concession, 2400);
  assert.deepEqual(entry.rounding, { rawAmount: 2419, roundedAmount: 2400, mode: 'nearest' });
  // Every reader of the stamp sees the rounded figure: the surfaces' net
  // due is 3,483 - 2,400, and the Khata Doctor's ledger balance agrees.
  assert.equal(netDueAfterConcession(3483, bill.concessionAmount), 3483 - 2400);
  const ledger = computeLedgerBalance(next.customers[0]);
  assert.equal(ledger.concessionsCents, 2400 * 100);
  assert.equal(ledger.balanceCents, (3483 - 2400) * 100);
});

test('toggle OFF: the raw figure is stamped and the history entry keeps its exact pre-SISP-131 shape', () => {
  const next = applyConcessionToBill(stateWithBill(3483, 3483), 'c1', '2026-10', {
    amount: 2419,
    reason: 'Outage Reaayat: 500h offline'
  }, REF);
  const bill = next.customers[0].bills[0];
  assert.equal(bill.concessionAmount, 2419);
  const entry = bill.amountHistory[bill.amountHistory.length - 1];
  assert.equal('rounding' in entry, false);
  assert.deepEqual(Object.keys(entry).sort(), ['changedAt', 'concession', 'note', 'previousConcession', 'type']);
});

test('a tag that does not describe the stamped amount is dropped, never trusted', () => {
  const next = applyConcessionToBill(stateWithBill(3483, 3483), 'c1', '2026-10', {
    amount: 2400,
    reason: 'Outage Reaayat: 500h offline',
    rounding: { rawAmount: 2419, roundedAmount: 2450, mode: 'nearest' } // claims 2,450, stamp is 2,400
  }, REF);
  const entry = next.customers[0].bills[0].amountHistory.at(-1);
  assert.equal(next.customers[0].bills[0].concessionAmount, 2400);
  assert.equal('rounding' in entry, false);
});

test('the rounding tag survives a JSON backup round-trip on the amountHistory entry', () => {
  const withTag = applyConcessionToBill(stateWithBill(3483, 3483), 'c1', '2026-10', {
    amount: 2400,
    reason: 'Outage Reaayat: 500h offline',
    rounding: { rawAmount: 2419, roundedAmount: 2400, mode: 'nearest' }
  }, REF);
  const backup = createJsonBackup(withTag, REF);
  const preview = previewJsonBackupMerge(stateWithBill(3483, 3483), backup);
  const mergedEntry = preview.state.customers[0].bills[0].amountHistory.at(-1);
  assert.deepEqual(mergedEntry.rounding, { rawAmount: 2419, roundedAmount: 2400, mode: 'nearest' });
});

// --- pro-rata flow (package-change credit -> packageHistory tag) -----------

const profileCustomer = (overrides = {}) => ({
  id: 'c1',
  customerNumber: 1,
  name: 'TEST CUSTOMER',
  packageSpeed: '15 Mbps',
  monthlySellingAmount: 3000,
  monthlyPriceSchedule: [{ amount: 3000, effectiveMonth: '2026-01', recordedAt: '2026-01-01 00:00' }],
  billingStartMonth: '2026-01',
  bills: [],
  archived: false,
  serviceStatus: 'active',
  paused: false,
  pauseStartDate: null,
  autoResumeDate: null,
  pauseSkippedMonths: [],
  ...overrides
});

const profileState = (overrides = {}) => ({ customers: [profileCustomer(overrides)], nextCustomerNumber: 2 });

test('pro-rata: a rounded credit lands in packageHistory WITH its audit tag', () => {
  const next = updateCustomerProfile(profileState(), 'c1', {
    packageSpeed: '5 Mbps',
    monthlySellingAmount: 1000,
    proRataAdjustment: -2400,
    proRatedBillAmount: 2100,
    proRataRounding: { rawAmount: 2419, roundedAmount: 2400, mode: 'nearest' }
  }, REF);
  const entry = next.customers[0].packageHistory.at(-1);
  assert.equal(entry.proRataAdjustment, -2400);
  assert.deepEqual(entry.rounding, { rawAmount: 2419, roundedAmount: 2400, mode: 'nearest' });
});

test('pro-rata: no rounding passed -> the history entry has no rounding key (pre-SISP-131 shape)', () => {
  const next = updateCustomerProfile(profileState(), 'c1', {
    packageSpeed: '5 Mbps',
    monthlySellingAmount: 1000,
    proRataAdjustment: -2419,
    proRatedBillAmount: 2100
  }, REF);
  const entry = next.customers[0].packageHistory.at(-1);
  assert.equal(entry.proRataAdjustment, -2419);
  assert.equal('rounding' in entry, false);
});

test('Doctor agreement: a tag-backed rounded pro-rata entry is NOT flagged; a tampered one is', () => {
  // Derive the raw credit from the real calculator, then round it the
  // way the save flow does, and record exactly that entry.
  const recomputed = calculatePlanMigrationProration(3000, 1000, '2026-10-15');
  assert.ok(recomputed.netAdjustment < 0, 'fixture must be a credit (downgrade)');
  const rawCredit = Math.abs(recomputed.netAdjustment);
  const roundedCredit = roundToNearest50(rawCredit, 'nearest');
  const entry = {
    date: '2026-10-15',
    recordedAt: '2026-10-15 12:00',
    oldPackage: '15 Mbps',
    newPackage: '5 Mbps',
    oldMonthlyRate: 3000,
    newMonthlyRate: 1000,
    monthlyRecurringPriceDelta: -2000,
    proRataAdjustment: -roundedCredit,
    proRatedBillAmount: recomputed.proRatedCurrentBill,
    ...(roundedCredit !== rawCredit ? { rounding: { rawAmount: rawCredit, roundedAmount: roundedCredit, mode: 'nearest' } } : {})
  };
  const clean = auditBillingCorrectness(profileState({ packageHistory: [entry] }));
  assert.equal(clean.discrepancies.filter((d) => d.ruleId === AUDIT_RULE_CODES.PRORATA_HISTORY_MISMATCH).length, 0);
  const tampered = { ...entry, proRataAdjustment: -roundedCredit - 500 };
  const flagged = auditBillingCorrectness(profileState({ packageHistory: [tampered] }));
  assert.equal(flagged.discrepancies.filter((d) => d.ruleId === AUDIT_RULE_CODES.PRORATA_HISTORY_MISMATCH).length, 1);
});

// --- i18n + wiring ----------------------------------------------------------

test('i18n: every round50_* key resolves in English and Urdu (no raw keys)', () => {
  const keys = ['round50_toggle', 'round50_mode_nearest', 'round50_mode_down', 'round50_mode_exact', 'round50_rounded_from', 'round50_prorata_toggle'];
  for (const key of keys) {
    assert.ok(key in TRANSLATIONS.en, `${key} missing in en`);
    assert.ok(key in TRANSLATIONS.ur, `${key} missing in ur`);
    assert.notEqual(t(key, 'en'), key);
    assert.notEqual(t(key, 'ur'), key);
  }
});

test('wiring: both flows expose the toggle and route through the helper', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(app.includes('data-round50-toggle'), 'profile concession toggle');
  assert.ok(app.includes('roundedConcessionSuggestion'), 'profile uses the rounded suggestion');
  assert.ok(app.includes('roundProrataCreditCheckbox'), 'profile save reads the pro-rata toggle');
  assert.ok(qc.includes('data-qc-round50-toggle'), 'Quick Collect concession toggle');
  assert.ok(qc.includes('roundedConcessionSuggestion'), 'Quick Collect uses the rounded suggestion');
  assert.ok(html.includes('id="roundProrataCreditCheckbox"'), 'pro-rata toggle control exists');
  assert.ok(html.includes('id="roundProrataModeSelect"'), 'pro-rata mode select exists');
});
