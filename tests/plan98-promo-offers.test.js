import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validPromoDate,
  canonicalPromoMohalla,
  normalizePromo,
  normalizePromoList,
  upsertPromo,
  removePromo,
  findPromo,
  promoStatus,
  promoStatusLabel,
  promoBenefit,
  filterPromos,
  normalizePromoApplication,
  normalizePromoApplicationList,
  recordPromoApplication,
  removePromoApplication,
  applicationsForPromo,
  promoSummaryText,
  promoHtml,
  promoApplicationHtml,
  promoCsv,
  promoApplicationCsv,
  promoFilename,
} from '../promo-offers.js';

const promo = (overrides = {}) => ({
  id: 'PR-1',
  name: 'Eid street offer',
  packages: ['10 Mbps', '15 Mbps'],
  benefit: 'First month at half the package price',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  mohallas: ['Bani', 'Kishti'],
  ...overrides,
});

const application = (overrides = {}) => ({
  id: 'PA-1',
  promotionId: 'PR-1',
  customer: 'C-1',
  customerName: 'Ahmed',
  concessionRef: 'CONC-77',
  date: '2026-11-10',
  ...overrides,
});

test('strict dates: real dates pass, impossible and malformed dates fail', () => {
  assert.equal(validPromoDate('2026-11-01'), '2026-11-01');
  assert.equal(validPromoDate('2024-02-29'), '2024-02-29');
  assert.equal(validPromoDate('2026-12-31'), '2026-12-31');
  assert.equal(validPromoDate('2026-04-31'), null);
  assert.equal(validPromoDate('2026-02-30'), null);
  assert.equal(validPromoDate('2026-13-01'), null);
  assert.equal(validPromoDate('01-11-2026'), null);
  assert.equal(validPromoDate(''), null);
  assert.equal(validPromoDate(null), null);
});

test('half-formed refusal: no id, no name, blank benefit, no package, no mohalla, bad or reversed window', () => {
  assert.equal(normalizePromo(promo({ id: '' })), null);
  assert.equal(normalizePromo(promo({ name: '  ' })), null);
  assert.equal(normalizePromo(promo({ benefit: '' })), null);
  assert.equal(normalizePromo(promo({ packages: [] })), null);
  assert.equal(normalizePromo(promo({ packages: ['  '] })), null);
  assert.equal(normalizePromo(promo({ mohallas: [] })), null);
  assert.equal(normalizePromo(promo({ startDate: '2026-02-30' })), null);
  assert.equal(normalizePromo(promo({ endDate: '' })), null);
  assert.equal(normalizePromo(promo({ startDate: '2026-11-30', endDate: '2026-11-01' })), null);
  assert.equal(normalizePromo(null), null);
  assert.equal(normalizePromo('nope'), null);
});

test('exactly one benefit wording, one window, comma lists normalised and deduped', () => {
  const normalized = normalizePromo(promo({
    packages: '10 Mbps, 15 Mbps, 10 Mbps',
    mohallas: ['Bani', 'bani', 'Kishti'],
  }));
  assert.deepEqual(normalized.packages, ['10 Mbps', '15 Mbps']);
  assert.deepEqual(normalized.mohallas, ['Bani', 'Kishti']);
  assert.equal(normalized.benefit, 'First month at half the package price');
  assert.equal(normalized.startDate, '2026-11-01');
  assert.equal(normalized.endDate, '2026-11-30');
});

test('unknown fields are dropped, so the record can never grow a bill, payment, or price field', () => {
  const normalized = normalizePromo(promo({ billTotal: 2000, paymentId: 'P-1', price: 1500, discount: 500 }));
  assert.deepEqual(Object.keys(normalized).sort(), ['benefit', 'endDate', 'id', 'mohallas', 'name', 'packages', 'startDate']);
});

test('upsert replaces by id, half-formed upsert leaves the list unchanged', () => {
  const list = [promo()];
  assert.equal(upsertPromo(list, promo({ name: 'Renamed offer' })).length, 1);
  assert.equal(upsertPromo(list, promo({ name: 'Renamed offer' }))[0].name, 'Renamed offer');
  assert.deepEqual(upsertPromo(list, promo({ benefit: '' })), normalizePromoList(list));
  assert.equal(removePromo(list, 'PR-1').length, 0);
  assert.equal(findPromo(list, 'PR-1').name, 'Eid street offer');
  assert.equal(findPromo(list, 'PR-9'), null);
});

test('window status: upcoming before start, active on both end days inclusive, expired the day after', () => {
  const item = promo();
  assert.equal(promoStatus(item, '2026-10-31'), 'upcoming');
  assert.equal(promoStatus(item, '2026-11-01'), 'active');
  assert.equal(promoStatus(item, '2026-11-30'), 'active');
  assert.equal(promoStatus(item, '2026-12-01'), 'expired');
  assert.equal(promoStatus(item, 'not-a-date'), null);
  assert.equal(promoStatusLabel('active'), 'Active');
  assert.equal(promoStatusLabel('expired'), 'Expired');
  assert.equal(promoStatusLabel('bogus'), 'Not recorded');
});

test('expired promotion offers no benefit; active promotion offers exactly its wording', () => {
  const item = promo();
  assert.equal(promoBenefit(item, '2026-11-10'), 'First month at half the package price');
  assert.equal(promoBenefit(item, '2026-12-01'), null);
  assert.equal(promoBenefit(item, '2026-10-31'), null);
  assert.equal(promoBenefit(promo({ benefit: '' }), '2026-11-10'), null);
});

test('filters: by status on a day, by package, and by mohalla with the Plan T canonical rule', () => {
  const list = [
    promo(),
    promo({ id: 'PR-2', name: 'New area offer', packages: ['5 Mbps'], startDate: '2026-12-01', endDate: '2026-12-31', mohallas: ['Chamyaa'] }),
  ];
  assert.deepEqual(filterPromos(list, { status: 'active' }, '2026-11-10').map((p) => p.id), ['PR-1']);
  assert.deepEqual(filterPromos(list, { status: 'upcoming' }, '2026-11-10').map((p) => p.id), ['PR-2']);
  assert.deepEqual(filterPromos(list, { status: 'expired' }, '2026-11-10').map((p) => p.id), []);
  assert.deepEqual(filterPromos(list, { package: '5 Mbps' }, '2026-11-10').map((p) => p.id), ['PR-2']);
  assert.deepEqual(filterPromos(list, { package: '10 mbps' }, '2026-11-10').map((p) => p.id), ['PR-1']);
  assert.deepEqual(filterPromos(list, { mohalla: 'kishti' }, '2026-11-10').map((p) => p.id), ['PR-1']);
  assert.deepEqual(filterPromos(list, { mohalla: 'chamyaa' }, '2026-11-10').map((p) => p.id), ['PR-2']);
  assert.deepEqual(filterPromos(list, { mohalla: 'nowhere' }, '2026-11-10').map((p) => p.id), []);
  assert.deepEqual(filterPromos(list, {}, '2026-11-10').map((p) => p.id), ['PR-1', 'PR-2']);
});

test('canonical mohalla rule mirrors Plan T: aliases and the mohalla prefix', () => {
  assert.equal(canonicalPromoMohalla('bani').key, 'banii');
  assert.equal(canonicalPromoMohalla('Mohalla Kishti').key, 'kishtii');
  assert.equal(canonicalPromoMohalla(''), null);
});

test('application half-formed refusal: no concession reference, no customer, impossible date', () => {
  assert.equal(normalizePromoApplication(application({ concessionRef: '  ' })), null);
  assert.equal(normalizePromoApplication(application({ customer: '' })), null);
  assert.equal(normalizePromoApplication(application({ promotionId: '' })), null);
  assert.equal(normalizePromoApplication(application({ date: '2026-02-30' })), null);
  assert.equal(normalizePromoApplication(null), null);
});

test('applying records only the link: active window accepts, expired or upcoming window refuses unchanged', () => {
  const promotions = [promo()];
  const accepted = recordPromoApplication(promotions, [], application());
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].concessionRef, 'CONC-77');
  assert.equal(accepted[0].promotionId, 'PR-1');
  assert.deepEqual(recordPromoApplication(promotions, [], application({ date: '2026-12-01' })), []);
  assert.deepEqual(recordPromoApplication(promotions, [], application({ date: '2026-10-31' })), []);
  assert.deepEqual(recordPromoApplication(promotions, [], application({ promotionId: 'PR-9' })), []);
  assert.deepEqual(recordPromoApplication(promotions, [], application({ concessionRef: '' })), []);
});

test('applying never touches the promotions list itself', () => {
  const promotions = [promo()];
  const before = JSON.stringify(normalizePromoList(promotions));
  recordPromoApplication(promotions, [], application());
  assert.equal(JSON.stringify(normalizePromoList(promotions)), before);
});

test('applications list: per-promotion view oldest first, removal by id', () => {
  const apps = normalizePromoApplicationList([
    application({ id: 'PA-2', date: '2026-11-20' }),
    application(),
    application({ id: 'PA-3', promotionId: 'PR-2', date: '2026-11-05' }),
  ]);
  assert.deepEqual(applicationsForPromo(apps, 'PR-1').map((a) => a.id), ['PA-1', 'PA-2']);
  assert.equal(removePromoApplication(apps, 'PA-1').length, 2);
});

test('summary text counts active, upcoming, and expired on the given day', () => {
  const list = [
    promo(),
    promo({ id: 'PR-2', startDate: '2026-12-01', endDate: '2026-12-31' }),
    promo({ id: 'PR-3', startDate: '2026-10-01', endDate: '2026-10-31' }),
  ];
  assert.equal(promoSummaryText(list, '2026-11-10'), '3 promotions recorded · 1 active · 1 upcoming · 1 expired');
  assert.equal(promoSummaryText([], '2026-11-10'), '0 promotions recorded · 0 active · 0 upcoming · 0 expired');
});

test('non-mutation: normalising and upserting never change the caller’s records', () => {
  const original = promo();
  const snapshot = JSON.stringify(original);
  normalizePromo(original);
  upsertPromo([original], promo({ name: 'Changed' }));
  assert.equal(JSON.stringify(original), snapshot);
});

test('HTML escapes markup and shows the status on the given day; CSV quotes and names the file', () => {
  const item = promo({ name: '<b>Offer</b>', benefit: 'Half "first" month, free' });
  const html = promoHtml([item], '2026-11-10');
  assert.match(html, /&lt;b&gt;Offer&lt;\/b&gt;/);
  assert.match(html, /Active/);
  assert.match(promoHtml([], '2026-11-10'), /No promotions recorded yet/);
  const csv = promoCsv([item]);
  assert.match(csv, /^id,name,packages,benefit,startDate,endDate,mohallas\n/);
  assert.match(csv, /"Half ""first"" month, free"/);
  assert.equal(promoFilename('2026-11-10'), 'promo-offers-2026-11-10.csv');
  assert.equal(promoFilename('bogus'), 'promo-offers-undated.csv');
  const appHtml = promoApplicationHtml([application()]);
  assert.match(appHtml, /CONC-77/);
  assert.match(promoApplicationHtml([]), /No promotion applied/);
  assert.match(promoApplicationCsv([application()]), /^id,promotionId,customer,customerName,concessionRef,date\n/);
});

test('purity fence: the module imports nothing and touches no store, price history, or campaign', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'promo-offers.js'), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /localStorage|document\.|fetch\(|price-history|campaign-planner|priceHistory|campaignPlanner/);
  assert.doesNotMatch(source, /shahdara_/);
});
