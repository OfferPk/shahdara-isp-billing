// SISP-159: Defaulter Risk Segmentation — 🟢 Polite Reminder (first-time
// late, reliability >= 80) / 🟡 Standard Follow-Up / 🔴 High-Risk Chronic
// (2+ months arrears OR a broken waada), with template tone auto-selection.
// Pure classifier boundary matrix + population gates + derivation from
// real records (allocation engine + waada stamps) + queue/defaulter
// wiring + state purity. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULTER_SEGMENTS,
  classifyDefaulter,
  classifyCustomerDefaulter,
  classifyDefaulterFromMonths,
  deriveDefaulterInputs,
  waadaReliabilityScore,
  computeFirstLate,
  segmentTemplateType,
  segmentStudioTemplateId,
  defaulterSegmentChipHtml,
  defaulterSegmentLabel
} from '../defaulter-risk-segment.js';
import {
  createInitialState,
  addCustomer,
  saveBillMonth
} from '../core.js';
import { computeWaadaScore } from '../waada-queue.js';
import {
  getRemindersTodayQueue,
  buildCampaignQueue
} from '../reminder-queue.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';
import { WA_TEMPLATE_IDS } from '../whatsapp-templates.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const TODAY = '2026-10-20';
const REF = new Date(2026, 9, 20, 12);
const mockStorage = () => {
  const data = new Map();
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
};
const withCustomerPatch = (state, customerId, patch) => ({
  ...state,
  customers: state.customers.map(c => c.id === customerId ? { ...c, ...patch } : c)
});
const pricedBill = (state, customerId, month, dueAmount) =>
  saveBillMonth(state, customerId, { month, dueAmount, dueDate: `${month}-05`, status: 'pending' }, REF);

// --- Pure classifier: the full boundary matrix from the spec ---

test('classifier: 1 month arrears + 1 broken waada → chronic (broken waada wins)', () => {
  const r = classifyDefaulter({}, { monthsWithArrears: 1, brokenWaada: 1, reliability: 100, firstLate: false });
  assert.equal(r.segment, DEFAULTER_SEGMENTS.CHRONIC);
  assert.ok(r.reasons.includes('broken_waada'));
});

test('classifier: 1 month + reliability 79 + first late → standard (79 is below the bar)', () => {
  const r = classifyDefaulter({}, { monthsWithArrears: 1, brokenWaada: 0, reliability: 79, firstLate: true });
  assert.equal(r.segment, DEFAULTER_SEGMENTS.STANDARD);
  assert.ok(r.reasons.includes('low_reliability'));
});

test('classifier: first-time late + reliability exactly 80 → polite (80 qualifies)', () => {
  const r = classifyDefaulter({}, { monthsWithArrears: 1, brokenWaada: 0, reliability: 80, firstLate: true });
  assert.equal(r.segment, DEFAULTER_SEGMENTS.POLITE);
  assert.ok(r.reasons.includes('first_time_late'));
});

test('classifier: 2 months arrears + reliability 95 → chronic (precedence over polite inputs)', () => {
  const r = classifyDefaulter({}, { monthsWithArrears: 2, brokenWaada: 0, reliability: 95, firstLate: false });
  assert.equal(r.segment, DEFAULTER_SEGMENTS.CHRONIC);
  assert.ok(r.reasons.includes('two_plus_months_arrears'));
});

test('classifier: 1 month, reliable, but NOT first late → standard', () => {
  const r = classifyDefaulter({}, { monthsWithArrears: 1, brokenWaada: 0, reliability: 100, firstLate: false });
  assert.equal(r.segment, DEFAULTER_SEGMENTS.STANDARD);
});

test('classifier: 3 months + 2 broken waadas → chronic with both reasons', () => {
  const r = classifyDefaulter({}, { monthsWithArrears: 3, brokenWaada: 2, reliability: 20, firstLate: false });
  assert.equal(r.segment, DEFAULTER_SEGMENTS.CHRONIC);
  assert.ok(r.reasons.includes('two_plus_months_arrears'));
  assert.ok(r.reasons.includes('broken_waada'));
});

// --- Reliability conversion + first-late helper ---

test('reliability: no recorded resolutions → 100; kept/total rounds to nearest', () => {
  assert.equal(waadaReliabilityScore({ kept: 0, broken: 0, total: 0 }), 100);
  assert.equal(waadaReliabilityScore({ kept: 4, broken: 1, total: 5 }), 80);
  assert.equal(waadaReliabilityScore({ kept: 3, broken: 1, total: 4 }), 75);
  assert.equal(waadaReliabilityScore({ kept: 1, broken: 1, total: 2 }), 50);
  assert.equal(waadaReliabilityScore({ kept: 0, broken: 2, total: 2 }), 0);
});

test('firstLate: only the current month unpaid and no broken waada', () => {
  assert.equal(computeFirstLate(['2026-10'], '2026-10', 0), true);
  assert.equal(computeFirstLate(['2026-09'], '2026-10', 0), false, 'an unpaid earlier month is not a first late');
  assert.equal(computeFirstLate(['2026-10'], '2026-10', 1), false, 'a broken waada is never a first late');
  assert.equal(computeFirstLate([], '2026-10', 0), false);
});

// --- Waada outcomes derivation (SISP-98 canonical computeWaadaScore;
// the build's local mirror deriveWaadaOutcomes was deleted at merge) ---

test('waada outcomes: kept stamp, late stamp, voided stamp ignored, live broken promise counts', () => {
  const customer = {
    id: 'c-outcomes',
    promiseDate: '2026-10-10',
    bills: [
      { month: '2026-08', payments: [{ id: 'p1', date: '2026-08-04', amount: 3000, clearedWaada: { promiseDate: '2026-08-05' } }] },
      { month: '2026-09', payments: [{ id: 'p2', date: '2026-09-09', amount: 3000, clearedWaada: { promiseDate: '2026-09-05' } }] },
      { month: '2026-10', payments: [{ id: 'p3', date: '2026-10-02', amount: 3000, voided: true, clearedWaada: { promiseDate: '2026-10-05' } }] }
    ]
  };
  const outcomes = computeWaadaScore(customer, 3000, TODAY);
  assert.equal(outcomes.kept, 1, 'paid on/before the promised date');
  assert.equal(outcomes.broken, 2, 'one late-paid stamp + the live expired promise');
  assert.equal(outcomes.total, 3);
  assert.equal(waadaReliabilityScore(outcomes), 33);
});

// --- Derivation + population from real records ---

function segmentFixtureState() {
  let state = createInitialState();
  state = addCustomer(state, 'Seg Polite', REF);
  state = addCustomer(state, 'Seg Chronic Months', REF);
  state = addCustomer(state, 'Seg Chronic Waada', REF);
  state = addCustomer(state, 'Seg Paid Up', REF);
  const [polite, chronicMonths, chronicWaada, paidUp] = state.customers;
  state = pricedBill(state, polite.id, '2026-10', 3000);
  state = pricedBill(state, chronicMonths.id, '2026-09', 3000);
  state = pricedBill(state, chronicMonths.id, '2026-10', 3000);
  state = pricedBill(state, chronicWaada.id, '2026-10', 3000);
  state = withCustomerPatch(state, chronicWaada.id, { promiseDate: '2026-10-10', promiseAmount: 3000 });
  state = pricedBill(state, paidUp.id, '2026-10', 3000);
  state = withCustomerPatch(state, paidUp.id, {
    bills: state.customers.find(c => c.id === paidUp.id).bills.map(b => ({
      ...b,
      payments: [{ id: 'p-paid', date: '2026-10-03', amount: 3000, method: 'Cash' }]
    }))
  });
  // saveBillMonth/withCustomerPatch return new states — re-read the final
  // customer records so the returned fixtures carry their bills.
  const byId = id => state.customers.find(c => c.id === id);
  return {
    state,
    polite: byId(polite.id),
    chronicMonths: byId(chronicMonths.id),
    chronicWaada: byId(chronicWaada.id),
    paidUp: byId(paidUp.id)
  };
}

test('derivation: first-timer with only the current month unpaid → polite, engine figures', () => {
  const { state, polite } = segmentFixtureState();
  const result = classifyCustomerDefaulter(polite, state, TODAY);
  assert.equal(result.segment, 'polite');
  assert.equal(result.derived.outstanding, 3000);
  assert.equal(result.derived.monthsWithArrears, 1);
  assert.deepEqual(result.derived.unpaidMonths, ['2026-10']);
  assert.equal(result.derived.firstLate, true);
  assert.equal(result.derived.reliability, 100);
});

test('derivation: two unpaid months → chronic even with a clean waada record', () => {
  const { state, chronicMonths } = segmentFixtureState();
  const result = classifyCustomerDefaulter(chronicMonths, state, TODAY);
  assert.equal(result.segment, 'chronic');
  assert.equal(result.derived.monthsWithArrears, 2);
  assert.equal(result.derived.outstanding, 6000);
  assert.equal(result.derived.brokenWaada, 0);
});

test('derivation: one unpaid month + live broken waada → chronic via the waada rule', () => {
  const { state, chronicWaada } = segmentFixtureState();
  const result = classifyCustomerDefaulter(chronicWaada, state, TODAY);
  assert.equal(result.segment, 'chronic');
  assert.equal(result.derived.monthsWithArrears, 1);
  assert.equal(result.derived.brokenWaada, 1);
  assert.equal(result.derived.firstLate, false);
});

test('population: paid-up, FREE and archived customers are excluded (null segment)', () => {
  const { state, paidUp, polite } = segmentFixtureState();
  assert.equal(classifyCustomerDefaulter(paidUp, state, TODAY), null, 'no dues → not in the population');
  const freeState = withCustomerPatch(state, polite.id, { isFreeConnection: true });
  assert.equal(classifyCustomerDefaulter(freeState.customers.find(c => c.id === polite.id), freeState, TODAY), null, 'FREE never owes');
  const archivedState = withCustomerPatch(state, polite.id, { archived: true });
  assert.equal(classifyCustomerDefaulter(archivedState.customers.find(c => c.id === polite.id), archivedState, TODAY), null, 'archived is history');
});

test('derivation: a kept-waada history month paid in full is not an arrears month', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Seg Kept History', REF);
  const c = state.customers[0];
  state = pricedBill(state, c.id, '2026-09', 3000);
  state = pricedBill(state, c.id, '2026-10', 3000);
  state = withCustomerPatch(state, c.id, {
    bills: state.customers[0].bills.map(b => b.month === '2026-09'
      ? { ...b, payments: [{ id: 'p-sep', date: '2026-09-04', amount: 3000, method: 'Cash', clearedWaada: { promiseDate: '2026-09-05', promiseAmount: 3000 } }] }
      : b)
  });
  const derived = deriveDefaulterInputs(state.customers[0], state, TODAY);
  assert.deepEqual(derived.unpaidMonths, ['2026-10']);
  assert.equal(derived.keptWaada, 1);
  assert.equal(derived.brokenWaada, 0);
  assert.equal(derived.reliability, 100);
  assert.equal(derived.firstLate, true);
  assert.equal(classifyCustomerDefaulter(state.customers[0], state, TODAY).segment, 'polite');
});

// --- Wiring: reminder queue, campaign queue, top defaulters ---

test('wiring: Reminders Today queue items carry their segment; campaign items too', () => {
  const { state, polite, chronicMonths } = segmentFixtureState();
  const queueData = getRemindersTodayQueue(state, { todayString: TODAY, storage: mockStorage() });
  const politeItem = queueData.queue.find(item => item.customerId === polite.id);
  assert.ok(politeItem, 'first-timer is in today\'s queue (15 days late matches a stage)');
  assert.equal(politeItem.riskSegment.segment, 'polite');
  const chronicItem = queueData.queue.find(item => item.customerId === chronicMonths.id);
  assert.ok(chronicItem);
  assert.equal(chronicItem.riskSegment.segment, 'chronic');

  const campaign = buildCampaignQueue(state, { todayString: TODAY });
  const campaignPolite = campaign.items.find(item => item.customerId === polite.id);
  assert.equal(campaignPolite.riskSegment.segment, 'polite');
  const campaignChronic = campaign.items.find(item => item.customerId === chronicMonths.id);
  assert.equal(campaignChronic.riskSegment.segment, 'chronic');
});

test('wiring: Top Defaulters rows carry the segment matching their own unpaid months', () => {
  const { state, polite, chronicMonths } = segmentFixtureState();
  const data = calculateTopDefaulters(state, { referenceDate: REF, limit: null });
  const politeRow = data.accounts.find(a => a.id === polite.id);
  assert.equal(politeRow.riskSegment.segment, 'polite');
  assert.equal(politeRow.riskSegment.derived.monthsWithArrears, politeRow.unpaidMonthsCount);
  const chronicRow = data.accounts.find(a => a.id === chronicMonths.id);
  assert.equal(chronicRow.riskSegment.segment, 'chronic');
  // The row-level helper agrees with the full state derivation.
  const viaHelper = classifyDefaulterFromMonths(chronicMonths, {
    outstanding: chronicRow.totalOutstanding,
    unpaidMonths: chronicRow.unpaidMonths.map(m => m.month),
    todayStr: TODAY
  });
  assert.equal(viaHelper.segment, chronicRow.riskSegment.segment);
});

// --- Template auto-selection ---

test('templates: reminder-flow types per segment (due / overdue / disconnection)', () => {
  assert.equal(segmentTemplateType('polite'), 'due');
  assert.equal(segmentTemplateType('standard'), 'overdue');
  assert.equal(segmentTemplateType('chronic'), 'disconnection');
});

test('templates: studio ids per segment exist in the shipped studio; broken-waada chronic picks brokenWaada', () => {
  assert.equal(segmentStudioTemplateId('polite', { brokenWaada: 0 }), 'politeReminder');
  assert.equal(segmentStudioTemplateId('standard', { brokenWaada: 0 }), 'billGenerated');
  assert.equal(segmentStudioTemplateId('chronic', { brokenWaada: 2 }), 'brokenWaada');
  assert.equal(segmentStudioTemplateId('chronic', { brokenWaada: 0 }), 'billGenerated',
    'chronic without a broken waada falls back to the neutral bill notice (studio ships no generic firm template)');
  for (const segment of ['polite', 'standard', 'chronic']) {
    for (const brokenWaada of [0, 1]) {
      assert.ok(WA_TEMPLATE_IDS.includes(segmentStudioTemplateId(segment, { brokenWaada })),
        `${segment}/${brokenWaada} maps to a real studio template id`);
    }
  }
});

// --- Chip rendering + i18n audit ---

test('chip: safety-badge tones + emoji + localized labels; every riskseg_ key exists in en and ur', () => {
  const politeChip = defaulterSegmentChipHtml({ segment: 'polite' }, 'en');
  assert.ok(politeChip.includes('safety-badge badge-healthy'));
  assert.ok(politeChip.includes('🟢'));
  assert.ok(politeChip.includes('Polite Reminder'));
  const chronicChip = defaulterSegmentChipHtml({ segment: 'chronic' }, 'en');
  assert.ok(chronicChip.includes('safety-badge badge-danger'));
  assert.ok(chronicChip.includes('🔴'));
  const standardUr = defaulterSegmentChipHtml({ segment: 'standard' }, 'ur');
  assert.ok(standardUr.includes('badge-warning'));
  assert.ok(standardUr.includes('🟡'));
  assert.ok(standardUr.includes('معمول کی یاد دہانی'));
  assert.equal(defaulterSegmentLabel({ segment: 'polite' }, 'ur'), '🟢 نرم یاد دہانی');
  assert.equal(defaulterSegmentChipHtml(null), '');
  assert.equal(defaulterSegmentChipHtml({ segment: 'bogus' }), '');

  const usedKeys = ['riskseg_polite', 'riskseg_standard', 'riskseg_chronic',
    'riskseg_reason_months', 'riskseg_reason_broken_waada', 'riskseg_reason_first_late', 'riskseg_reason_reliability'];
  for (const key of usedKeys) {
    assert.ok(TRANSLATIONS.en[key], `en has ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur has ${key}`);
    assert.notEqual(t(key, 'en', { months: 2, score: 80 }), key, 'en renders, never the raw key');
    assert.notEqual(t(key, 'ur', { months: 2, score: 80 }), key, 'ur renders, never the raw key');
  }
  assert.equal(t('riskseg_reason_months', 'en', { months: 2 }), 'Arrears: 2 months');
});

// --- Purity: classification never writes to the ledger ---

test('purity: segmentation, queues and defaulter derivation leave state byte-for-byte unchanged', () => {
  const { state, polite } = segmentFixtureState();
  const before = JSON.stringify(state);
  classifyCustomerDefaulter(polite, state, TODAY);
  deriveDefaulterInputs(polite, state, TODAY);
  getRemindersTodayQueue(state, { todayString: TODAY, storage: mockStorage() });
  buildCampaignQueue(state, { todayString: TODAY });
  calculateTopDefaulters(state, { referenceDate: REF, limit: null });
  assert.equal(JSON.stringify(state), before);
});
