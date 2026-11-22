// QC speed-pill emoji — the area + speed line on a Quick Collect
// picker card is a pill with the speed's own emoji before the speed.
//
// Spec (user, 2026-11-22): 🚲 3, 🏍 5, 🚁 10, 🚀 15 Mbps, a different
// emoji for every speed — "jaisay due k sath uska emoji attached hai",
// i.e. the same pattern as the DUE pill (⏰ DUE). 29 Mbps, the
// flagship tier, takes 🛸 (faster than 15's rocket, keeps the vehicle
// theme). Exact map first, then the speed bands (≤3 → 🚲, ≤5 → 🏍,
// ≤10 → 🚁, ≤15 → 🚀, >15 → 🛸) so a free-form custom speed is never
// emoji-less. Unparseable or missing package -> no emoji, no pill —
// the plain area-only line stays.
//
// Scope: QC picker cards ONLY (nav-quick-collect.js). The customer
// directory cards are a separate surface (follow-up), Field Mode has
// no area•package line, and the profile package box keeps its
// speed-blind 🚀 (out of scope). The DUE pill is the model and is
// unchanged.
//
// Harness: real core.js state + real bills, one customer per render
// (the due-emoji test's pattern). Synthetic data only — no real
// customer names, no realistic phone numbers (pattern-fake digits
// only). This file is NOT a pinning file: it carries no parity total.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
} from '../core.js';
import {
  getPendingCollectionCustomers, renderQuickCollectCustomerListHtml,
} from '../nav-quick-collect.js';

const REF = new Date('2026-11-07T10:00:00Z');

// One customer, one bill month, unpaid (so the card renders in the
// pending picker with its DUE pill). The packageSpeed is the only
// thing that varies between cases.
function pickerHtmlFor(packageSpeed) {
  let state = createInitialState(['Speed Pill Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    mohalla: 'Chamyaa', packageSpeed, monthlySellingAmount: 1000,
  }, REF);
  state = generateMonthlyBillsThroughCurrentMonth(state, REF);
  const customers = getPendingCollectionCustomers(state, '', 'all-dues', REF);
  return renderQuickCollectCustomerListHtml(customers);
}

test('3 Mbps takes the bicycle emoji in a speed pill', () => {
  const html = pickerHtmlFor('3Mbps / 100GB');
  assert.ok(html.includes('CHAMYAAA • 🚲 3Mbps / 100GB'), 'emoji sits immediately before the speed');
  assert.ok(html.includes('class="qc-cust-meta qc-speed-pill"'), 'the subtitle is a pill');
});

test('5 Mbps takes the motorcycle emoji in a speed pill', () => {
  const html = pickerHtmlFor('5Mbps / 150GB');
  assert.ok(html.includes('CHAMYAAA • 🏍 5Mbps / 150GB'), 'emoji sits immediately before the speed');
  assert.ok(html.includes('class="qc-cust-meta qc-speed-pill"'), 'the subtitle is a pill');
});

test('10 Mbps takes the helicopter emoji (no catalogue entry needed)', () => {
  const html = pickerHtmlFor('10 Mbps');
  assert.ok(html.includes('CHAMYAAA • 🚁 10 Mbps'), 'the free-form 10 Mbps speed still gets its emoji');
  assert.ok(html.includes('class="qc-cust-meta qc-speed-pill"'), 'the subtitle is a pill');
});

test('15 Mbps takes the rocket emoji in a speed pill', () => {
  const html = pickerHtmlFor('15Mbps Unlimited');
  assert.ok(html.includes('CHAMYAAA • 🚀 15Mbps Unlimited'), 'emoji sits immediately before the speed');
  assert.ok(html.includes('class="qc-cust-meta qc-speed-pill"'), 'the subtitle is a pill');
});

test('29 Mbps takes the UFO emoji in a speed pill', () => {
  const html = pickerHtmlFor('29 Mbps');
  assert.ok(html.includes('CHAMYAAA • 🛸 29 Mbps'), 'the flagship tier gets its own emoji');
  assert.ok(html.includes('class="qc-cust-meta qc-speed-pill"'), 'the subtitle is a pill');
});

test('band fallback: unmapped speeds take their band emoji', () => {
  assert.ok(pickerHtmlFor('7 Mbps').includes('CHAMYAAA • 🚁 7 Mbps'), '7 Mbps falls in the ≤10 band');
  assert.ok(pickerHtmlFor('25 Mbps').includes('CHAMYAAA • 🛸 25 Mbps'), '25 Mbps falls in the >15 band');
  assert.ok(pickerHtmlFor('2.5 Mbps').includes('CHAMYAAA • 🚲 2.5 Mbps'), '2.5 Mbps falls in the ≤3 band');
});

test('unparseable or missing package: no emoji, no pill', () => {
  const customHtml = pickerHtmlFor('Custom plan');
  assert.ok(customHtml.includes('CHAMYAAA • Custom plan'), 'the label stays as recorded');
  assert.equal(customHtml.includes('qc-speed-pill'), false, 'a digit-free label takes no pill');
  const missingHtml = pickerHtmlFor('');
  assert.ok(missingHtml.includes('>CHAMYAAA</span>'), 'area-only line stays plain');
  assert.equal(missingHtml.includes('qc-speed-pill'), false, 'a missing package takes no pill');
});

test('the pill keeps .qc-cust-meta and the DUE pill is unchanged', () => {
  const html = pickerHtmlFor('3Mbps / 100GB');
  assert.ok(html.includes('qc-cust-meta qc-speed-pill'), 'the pill class is added to the meta span, not a rename');
  assert.ok(html.indexOf('qc-due-tag') < html.indexOf('qc-cust-meta'), 'the DUE pill still renders before the subtitle');
  assert.ok(html.includes('⏰ DUE'), 'the full unpaid bill still shows the clock DUE badge');
});
