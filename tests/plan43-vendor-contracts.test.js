/**
 * plan43-vendor-contracts.test.js — Plan 43: vendor and contract
 * register with renewal dates.
 * Pins:
 * - one contract per vendor agreement (vendor, service, start/end
 *   dates, agreed rate, notice period, renewal note); a record with
 *   no vendor, an impossible date (2026-02-30), an end before its
 *   start, a non-positive rate, or a negative notice period is
 *   rejected, never stored half-formed; missing rate/date/notice
 *   stays null ("Not recorded"), never guessed;
 * - the renewal list shows only contracts ending inside the
 *   operator-set window, in end-date order, with days remaining
 *   and a notice-due flag from end minus notice period;
 * - editing a rate keeps the previous rate and its dates in
 *   history; a bad rate, bad date, or same rate leaves the list
 *   unchanged; inputs are never mutated;
 * - the vendor list is shared with Plan 41 (union of contract and
 *   schedule vendors, case-insensitive dedupe), and the register
 *   holds no bill, payment, expense, or customer field and never
 *   alters any expense total.
 * Synthetic data only; no ledger figure is ever changed by this
 * plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidContractDate,
  normalizeVendorContract,
  normalizeVendorContracts,
  findVendorContract,
  upsertVendorContract,
  removeVendorContract,
  updateContractRate,
  sharedVendorNames,
  buildRenewalList,
  renewalSummaryText,
  vendorContractsHtml,
  vendorContractsCsv,
  vendorContractsFilename,
} from '../vendor-contracts.js';

const upstream = {
  id: 'vc-1', vendor: 'Upstream ISP', service: 'bandwidth',
  startDate: '2026-01-01', endDate: '2026-12-31', rate: 50000,
  rateEffectiveDate: '2026-01-01', noticeDays: 30, renewalNote: 'Renegotiate before winter',
};
const rent = {
  id: 'vc-2', vendor: 'Shop Landlord', service: 'shop rent',
  startDate: '2026-03-01', endDate: '2026-06-30', rate: 20000,
  rateEffectiveDate: '2026-03-01', noticeDays: 60, renewalNote: '',
};

test('valid dates only: 2026-02-30 rejected, real dates accepted', () => {
  assert.equal(isValidContractDate('2026-02-30'), false);
  assert.equal(isValidContractDate('2026-02-28'), true);
  assert.equal(isValidContractDate('2026-13-01'), false);
  assert.equal(isValidContractDate('not-a-date'), false);
});

test('normalize rejects half-formed records, keeps missing fields null', () => {
  assert.equal(normalizeVendorContract({ id: 'x', vendor: '' }), null);
  assert.equal(normalizeVendorContract({ id: '', vendor: 'V' }), null);
  assert.equal(normalizeVendorContract({ ...upstream, endDate: '2026-02-30' }), null);
  assert.equal(normalizeVendorContract({ ...upstream, startDate: '2026-06-01', endDate: '2026-01-01' }), null);
  assert.equal(normalizeVendorContract({ ...upstream, rate: 0 }), null);
  assert.equal(normalizeVendorContract({ ...upstream, rate: -5 }), null);
  assert.equal(normalizeVendorContract({ ...upstream, noticeDays: -1 }), null);
  assert.equal(normalizeVendorContract({ ...upstream, noticeDays: 1.5 }), null);
  const bare = normalizeVendorContract({ id: 'vc-9', vendor: '  Spares Shop  ' });
  assert.equal(bare.vendor, 'Spares Shop');
  assert.equal(bare.service, '');
  assert.equal(bare.startDate, null);
  assert.equal(bare.endDate, null);
  assert.equal(bare.rate, null);
  assert.equal(bare.noticeDays, null);
  assert.deepEqual(bare.rateHistory, []);
});

test('upsert is last-wins per id and sorts vendor A-Z; remove drops only that id', () => {
  let list = upsertVendorContract([], rent);
  list = upsertVendorContract(list, upstream);
  assert.deepEqual(list.map((row) => row.vendor), ['Shop Landlord', 'Upstream ISP']);
  const changed = { ...upstream, rate: 55000 };
  list = upsertVendorContract(list, changed);
  assert.equal(list.length, 2);
  assert.equal(findVendorContract(list, 'vc-1').rate, 55000);
  list = upsertVendorContract(list, { ...upstream, rate: -1 });
  assert.equal(findVendorContract(list, 'vc-1').rate, 55000);
  list = removeVendorContract(list, 'vc-2');
  assert.deepEqual(list.map((row) => row.id), ['vc-1']);
  assert.equal(findVendorContract(list, 'vc-2'), null);
});

test('renewal list: only endings inside the window, end-date order, days + notice flag', () => {
  const list = [upstream, rent, { id: 'vc-3', vendor: 'No Date Vendor', service: 'spares' }];
  const renewals = buildRenewalList(list, { today: '2026-06-01', windowDays: 30 });
  assert.deepEqual(renewals.map((row) => row.id), ['vc-2']);
  assert.equal(renewals[0].daysRemaining, 29);
  assert.equal(renewals[0].noticeDueDate, '2026-05-01');
  assert.equal(renewals[0].noticeDue, true);
  const wide = buildRenewalList(list, { today: '2026-06-01', windowDays: 400 });
  assert.deepEqual(wide.map((row) => row.id), ['vc-2', 'vc-1']);
  assert.equal(wide[1].noticeDue, false);
  assert.equal(wide[1].noticeDueDate, '2026-12-01');
  assert.deepEqual(buildRenewalList(list, { today: '2026-02-30', windowDays: 30 }), []);
  assert.deepEqual(buildRenewalList(list, { today: '2026-06-01', windowDays: 'bogus' }).map((row) => row.id), ['vc-2']);
  assert.deepEqual(buildRenewalList(list, { today: '2026-06-01', windowDays: 0 }).map((row) => row.id), []);
});

test('renewal list includes a contract ending exactly today and exactly at the window end', () => {
  const edge = [
    { id: 'a', vendor: 'Ends Today', endDate: '2026-06-01' },
    { id: 'b', vendor: 'Ends At Edge', endDate: '2026-07-01' },
    { id: 'c', vendor: 'Past Window', endDate: '2026-07-02' },
    { id: 'd', vendor: 'Already Ended', endDate: '2026-05-31' },
  ];
  assert.deepEqual(buildRenewalList(edge, { today: '2026-06-01', windowDays: 30 }).map((row) => row.id), ['a', 'b']);
});

test('rate edit keeps the previous rate and its dates in history', () => {
  const list = [upstream, rent];
  const updated = updateContractRate(list, 'vc-1', 60000, '2026-07-01');
  const row = findVendorContract(updated, 'vc-1');
  assert.equal(row.rate, 60000);
  assert.equal(row.rateEffectiveDate, '2026-07-01');
  assert.deepEqual(row.rateHistory, [{ rate: 50000, from: '2026-01-01', to: '2026-07-01' }]);
  // Inputs untouched, and the other contract untouched.
  assert.equal(findVendorContract(list, 'vc-1').rate, 50000);
  assert.deepEqual(findVendorContract(updated, 'vc-2'), normalizeVendorContract(rent));
  // A second edit stacks history in order.
  const twice = updateContractRate(updated, 'vc-1', 65000, '2027-01-01');
  assert.deepEqual(findVendorContract(twice, 'vc-1').rateHistory, [
    { rate: 50000, from: '2026-01-01', to: '2026-07-01' },
    { rate: 60000, from: '2026-07-01', to: '2027-01-01' },
  ]);
});

test('rate edit refuses bad input and same-rate re-saves without a duplicate history entry', () => {
  const list = [upstream];
  const normalized = [normalizeVendorContract(upstream)];
  assert.deepEqual(updateContractRate(list, 'vc-1', 0, '2026-07-01'), normalized);
  assert.deepEqual(updateContractRate(list, 'vc-1', 60000, '2026-02-30'), normalized);
  assert.deepEqual(updateContractRate(list, 'vc-missing', 60000, '2026-07-01'), normalized);
  assert.deepEqual(updateContractRate(list, 'vc-1', 50000, '2026-07-01'), normalized);
  assert.deepEqual(findVendorContract(updateContractRate(list, 'vc-1', 50000, '2026-07-01'), 'vc-1').rateHistory, []);
});

test('rate edit on a contract with no prior rate adds no invented history', () => {
  const bare = { id: 'vc-9', vendor: 'Spares Shop', service: 'spares' };
  const updated = updateContractRate([bare], 'vc-9', 3000, '2026-05-01');
  assert.equal(findVendorContract(updated, 'vc-9').rate, 3000);
  assert.deepEqual(findVendorContract(updated, 'vc-9').rateHistory, []);
});

test('shared vendor names union contracts and Plan 41 schedules, case-insensitive', () => {
  const schedules = [
    { vendor: 'upstream isp', billType: 'bandwidth' },
    { vendor: 'Electricity Board', billType: 'electricity' },
    { vendor: '', billType: 'blank' },
  ];
  assert.deepEqual(sharedVendorNames([upstream, rent], schedules), ['Electricity Board', 'Shop Landlord', 'Upstream ISP']);
  assert.deepEqual(sharedVendorNames([], schedules), ['Electricity Board', 'upstream isp']);
  assert.deepEqual(sharedVendorNames([upstream], 'not-a-list'), ['Upstream ISP']);
});

test('normalize drops invalid rows and invalid history entries only', () => {
  const list = normalizeVendorContracts([
    upstream,
    { ...rent, endDate: '2026-02-30' },
    { ...upstream, id: 'vc-8', rateHistory: [{ rate: 40000, from: '2025-01-01', to: '2026-01-01' }, { rate: -1, from: '2024-01-01', to: '2025-01-01' }, { rate: 30000, from: '2026-02-30', to: null }] },
  ]);
  assert.deepEqual(list.map((row) => row.id), ['vc-1', 'vc-8']);
  assert.deepEqual(findVendorContract(list, 'vc-8').rateHistory, [{ rate: 40000, from: '2025-01-01', to: '2026-01-01' }]);
});

test('summary text counts contracts, dated contracts, and notice-due renewals', () => {
  const renewals = buildRenewalList([upstream, rent], { today: '2026-06-01', windowDays: 30 });
  const text = renewalSummaryText([upstream, rent], renewals, 30);
  assert.match(text, /2 vendor contract\(s\) on file \(2 with an end date\)/);
  assert.match(text, /1 ending within 30 day\(s\), 1 with notice already due/);
  assert.match(renewalSummaryText([], [], 30), /0 vendor contract\(s\) on file \(0 with an end date\)\. 0 ending within 30 day\(s\)/);
});

test('HTML shows dates, rate, notice, note and earlier rates, and escapes markup', () => {
  const nasty = { ...upstream, vendor: '<b>Up</b> & Co', renewalNote: '<script>alert(1)</script>' };
  const html = vendorContractsHtml([nasty], buildRenewalList([nasty], { today: '2026-12-01', windowDays: 30 }));
  assert.match(html, /&lt;b&gt;Up&lt;\/b&gt; &amp; Co/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /2026-01-01 — 2026-12-31/);
  assert.match(html, /50000 PKR from 2026-01-01/);
  assert.match(html, /30 day\(s\)/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /No earlier rate/);
  assert.match(vendorContractsHtml([], []), /No vendor contracts yet/);
  assert.match(vendorContractsHtml([], []), /No contracts ending inside the renewal window/);
});

test('CSV carries every field plus earlier rates, quoted safely', () => {
  const updated = updateContractRate([upstream], 'vc-1', 60000, '2026-07-01');
  const csv = vendorContractsCsv(updated);
  assert.match(csv, /^vendor,service,start_date,end_date,rate,rate_effective_date,notice_days,renewal_note,earlier_rates\n/);
  assert.match(csv, /Upstream ISP,bandwidth,2026-01-01,2026-12-31,60000,2026-07-01,30,Renegotiate before winter,50000 PKR from 2026-01-01 until 2026-07-01/);
  assert.equal(vendorContractsFilename(), 'vendor-contracts.csv');
});

test('the register holds no bill, payment, expense, or customer field', () => {
  const row = normalizeVendorContract(upstream);
  assert.deepEqual(Object.keys(row).sort(), ['endDate', 'id', 'noticeDays', 'rate', 'rateEffectiveDate', 'rateHistory', 'renewalNote', 'service', 'startDate', 'vendor']);
});
