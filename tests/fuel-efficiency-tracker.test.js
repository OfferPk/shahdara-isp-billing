/**
 * fuel-efficiency-tracker.test.js — SISP-112 [P1-HIGH]: Lineman Petrol
 * vs. Field Activity Efficiency Calculator.
 *
 * Spec criteria (read-latest.txt, SISP-112): "Logging Rs. 1,200 petrol
 * across 15 field jobs computes Rs. 80/job, and a day with Rs. 500
 * petrol and 0 field jobs flags an unmatched fuel warning."
 *
 * Pins:
 *  - the spec scenario exactly (petrol 1,200 / 15 jobs = 80 per job,
 *    jobs = 6 collections + 5 Saad visits + 4 resolved);
 *  - the unmatched-day pin (500 petrol, no activity that day → flagged;
 *    a petrol day WITH a visit is not flagged);
 *  - petrol comes ONLY from roznamcha outflows in the catalogue's
 *    petrol category (derived live, member of ROZNAMCHA_CATEGORIES);
 *    the mirrored Expenses-ledger rows never double-count;
 *  - voided payments and other-month records never count;
 *  - a resolved ticket + its linked register complaint is ONE job
 *    (SISP-39 union rule); an unlinked resolved complaint also counts;
 *  - zero jobs → fuelCostPerJob is null (never 0/Infinity fiction);
 *  - the builder is read-only (inputs byte-identical after the call);
 *  - i18n: every t() key the module uses exists in BOTH dictionaries;
 *    wiring: app.js import + render call, index.html section ids,
 *    dashboard.css token-only card block.
 *
 * Synthetic data only — no real customer or staff records.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildFuelEfficiency,
  fuelEfficiencyCardHtml,
  fuelMonthNow,
  fuelPetrolCategory,
  normalizeFuelMonth
} from '../fuel-efficiency-tracker.js';
import { ROZNAMCHA_CATEGORIES } from '../roznamcha.js';
import { TRANSLATIONS } from '../nav-language.js';

const MONTH = '2026-10';
const REF = new Date('2026-10-29T07:00:00Z'); // 12:00 PKT, still October

const petrolDay = (date, amount) => ({
  date,
  outflows: [{ id: `out-${date}`, category: 'Petrol / Bike Fuel', amount, lineman: '', note: '' }]
});
const payment = (id, date, amount, extra = {}) => ({ id, date, amount, method: 'Cash', ...extra });
const stateWithPayments = (payments) => ({
  customers: [{ id: 'cust-1', bills: [{ month: MONTH, payments }] }]
});
const visit = (id, date) => ({ id, date, type: 'splicing', customerId: '', customerName: '', area: '' });
const ticket = (id, resolvedAt, complaintId = '') => ({
  id, customerId: 'cust-1', status: 'Resolved', createdAt: '2026-10-01T09:00', resolvedAt, complaintId
});
const complaint = (id, resolvedAt) => ({
  id, customerId: 'cust-1', status: 'Resolved', reportedAt: '2026-10-01T09:00', resolvedAt
});

test('spec pin: Rs 1,200 petrol across 15 field jobs = Rs 80/job', () => {
  const summary = buildFuelEfficiency({
    state: stateWithPayments([
      payment('p1', '2026-10-03', 3000), payment('p2', '2026-10-03', 2000),
      payment('p3', '2026-10-10', 3000), payment('p4', '2026-10-12', 1500),
      payment('p5', '2026-10-15', 3000), payment('p6', '2026-10-20', 2500)
    ]),
    roznamchaDays: [petrolDay('2026-10-03', 700), petrolDay('2026-10-10', 500)],
    saadVisits: [
      visit('v1', '2026-10-03'), visit('v2', '2026-10-08'), visit('v3', '2026-10-10'),
      visit('v4', '2026-10-18'), visit('v5', '2026-10-25')
    ],
    tickets: [
      ticket('TKT-101', '2026-10-04T11:00'), ticket('TKT-102', '2026-10-11T12:00'),
      ticket('TKT-103', '2026-10-19T10:30')
    ],
    complaints: [complaint('CMP-201', '2026-10-21T13:00')]
  }, MONTH, REF);
  assert.equal(summary.petrolTotal, 1200);
  assert.equal(summary.fieldCollections, 6);
  assert.equal(summary.fieldCollectionAmount, 15000);
  assert.equal(summary.saadVisits, 5);
  assert.equal(summary.resolvedTickets, 4);
  assert.equal(summary.totalJobs, 15);
  assert.equal(summary.fuelCostPerJob, 80);
});

test('spec pin: a day with Rs 500 petrol and 0 field jobs is flagged unmatched', () => {
  const summary = buildFuelEfficiency({
    state: stateWithPayments([]),
    roznamchaDays: [petrolDay('2026-10-05', 500), petrolDay('2026-10-06', 300)],
    saadVisits: [visit('v1', '2026-10-06')],
    tickets: [],
    complaints: []
  }, MONTH, REF);
  assert.deepEqual(summary.unmatchedFuelDays, [{ date: '2026-10-05', amount: 500 }]);
  assert.equal(summary.petrolTotal, 800);
  assert.equal(summary.totalJobs, 1);
});

test('petrol category is derived from the roznamcha catalogue', () => {
  assert.equal(fuelPetrolCategory(), 'Petrol / Bike Fuel');
  assert.ok(ROZNAMCHA_CATEGORIES.includes(fuelPetrolCategory()));
});

test('non-petrol roznamcha categories never count as petrol', () => {
  const summary = buildFuelEfficiency({
    roznamchaDays: [{
      date: '2026-10-03',
      outflows: [
        { id: 'o1', category: 'Fiber Splicing', amount: 900, lineman: '', note: '' },
        { id: 'o2', category: 'Petrol / Bike Fuel', amount: 100, lineman: '', note: '' },
        { id: 'o3', category: 'Lineman Allowance', amount: 400, lineman: '', note: '' }
      ]
    }, petrolDay('2026-09-30', 999)]
  }, MONTH, REF);
  assert.equal(summary.petrolTotal, 100);
  assert.deepEqual(summary.petrolDays, [{ date: '2026-10-03', amount: 100 }]);
});

test('voided payments and other-month payments never count as field collections', () => {
  const summary = buildFuelEfficiency({
    state: stateWithPayments([
      payment('p1', '2026-10-03', 100),
      payment('p2', '2026-10-04', 500, { voided: true }),
      payment('p3', '2026-09-15', 700)
    ])
  }, MONTH, REF);
  assert.equal(summary.fieldCollections, 1);
  assert.equal(summary.fieldCollectionAmount, 100);
});

test('resolved ticket + linked complaint counts once; unlinked complaint counts too', () => {
  const summary = buildFuelEfficiency({
    tickets: [ticket('TKT-110', '2026-10-07T10:00', 'CMP-210')],
    complaints: [complaint('CMP-210', '2026-10-07T10:00'), complaint('CMP-211', '2026-10-09T09:00')]
  }, MONTH, REF);
  assert.equal(summary.resolvedTickets, 2);
});

test('open tickets and other-month resolutions never count', () => {
  const summary = buildFuelEfficiency({
    tickets: [
      { ...ticket('TKT-120', ''), status: 'Open' },
      ticket('TKT-121', '2026-09-28T10:00')
    ],
    complaints: [{ ...complaint('CMP-220', ''), status: 'In Progress' }],
    saadVisits: [visit('v1', '2026-09-05')]
  }, MONTH, REF);
  assert.equal(summary.resolvedTickets, 0);
  assert.equal(summary.saadVisits, 0);
  assert.equal(summary.totalJobs, 0);
  assert.equal(summary.fuelCostPerJob, null);
});

test('mirrored Expenses-ledger rows never double-count roznamcha petrol', () => {
  const summary = buildFuelEfficiency({
    state: {
      customers: [],
      expenses: [{ id: 'roz-out-2026-10-03', date: '2026-10-03', amount: 1200, category: 'Other expenses', notes: 'Roznamcha: Petrol / Bike Fuel' }]
    },
    roznamchaDays: [petrolDay('2026-10-03', 1200)]
  }, MONTH, REF);
  assert.equal(summary.petrolTotal, 1200);
});

test('zero petrol with jobs gives a 0 cost per job; empty month is all zeros', () => {
  const withJobs = buildFuelEfficiency({ saadVisits: [visit('v1', '2026-10-02'), visit('v2', '2026-10-03')] }, MONTH, REF);
  assert.equal(withJobs.petrolTotal, 0);
  assert.equal(withJobs.fuelCostPerJob, 0);
  const empty = buildFuelEfficiency({}, MONTH, REF);
  assert.deepEqual(
    [empty.petrolTotal, empty.fieldCollections, empty.saadVisits, empty.resolvedTickets, empty.totalJobs, empty.fuelCostPerJob, empty.unmatchedFuelDays.length],
    [0, 0, 0, 0, 0, null, 0]
  );
  assert.equal(normalizeFuelMonth('bogus', REF), fuelMonthNow(REF));
  assert.equal(buildFuelEfficiency({}, undefined, REF).month, '2026-10');
});

test('builder is read-only: inputs are byte-identical after the call', () => {
  const sources = {
    state: stateWithPayments([payment('p1', '2026-10-03', 300)]),
    roznamchaDays: [petrolDay('2026-10-03', 200)],
    saadVisits: [visit('v1', '2026-10-03')],
    tickets: [ticket('TKT-101', '2026-10-03T10:00')],
    complaints: [complaint('CMP-201', '2026-10-03T11:00')]
  };
  const before = JSON.stringify(sources);
  buildFuelEfficiency(sources, MONTH, REF);
  assert.equal(JSON.stringify(sources), before);
});

test('card HTML renders figures and the unmatched warning in both languages', () => {
  const summary = buildFuelEfficiency({
    roznamchaDays: [petrolDay('2026-10-05', 500), petrolDay('2026-10-03', 700)],
    saadVisits: [visit('v1', '2026-10-03')]
  }, MONTH, REF);
  const en = fuelEfficiencyCardHtml(summary, 'en');
  assert.ok(en.includes('PKR 1,200'));
  assert.ok(en.includes('2026-10-05'));
  assert.ok(en.includes('Unmatched fuel days'));
  assert.ok(!/fuel_[a-z_]+/.test(en), 'no raw i18n keys in English card');
  const ur = fuelEfficiencyCardHtml(summary, 'ur');
  assert.ok(ur.includes('بغیر سرگرمی والے پٹرول دن'));
  assert.ok(ur.includes('PKR 1,200'));
  assert.ok(!/fuel_[a-z_]+/.test(ur), 'no raw i18n keys in Urdu card');
  const emptyHtml = fuelEfficiencyCardHtml(buildFuelEfficiency({}, MONTH, REF), 'en');
  assert.ok(emptyHtml.includes('No petrol or field jobs recorded this month.'));
});

test('i18n audit: every t() key used by the module exists in both dictionaries', () => {
  const source = readFileSync(new URL('../fuel-efficiency-tracker.js', import.meta.url), 'utf8');
  const keys = [...new Set([...source.matchAll(/t\('([a-z0-9_]+)'/g)].map((m) => m[1]))];
  assert.ok(keys.length >= 10, `expected at least 10 t() keys, found ${keys.length}`);
  for (const key of keys) {
    assert.ok(key in TRANSLATIONS.en, `missing en key ${key}`);
    assert.ok(key in TRANSLATIONS.ur, `missing ur key ${key}`);
  }
  const fuelEn = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('fuel_'));
  const fuelUr = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('fuel_'));
  assert.deepEqual(fuelUr.sort(), fuelEn.sort());
});

test('wiring: app.js renders the card, index.html carries the section, CSS is token-only', () => {
  const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appJs.includes("from './fuel-efficiency-tracker.js'"));
  assert.ok(appJs.includes('buildFuelEfficiency('));
  assert.ok(appJs.includes("$('#fuelEfficiencyBody')"));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['fuelEfficiencyBody', 'fuelMonthInput', 'fuelEfficiencyCost', 'fuelEfficiencyHeading']) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  assert.ok(html.includes('data-i18n="fuel_title"'));
  const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-112'));
  assert.ok(block.includes('.fuel-efficiency-card'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-112 CSS block must not add hex colors');
  assert.ok(block.includes('var(--modal-surface)') || block.includes('var(--surface)'));
});
