/**
 * collection-velocity.test.js — SISP-144: Dashboard "Collection
 * Velocity" card (4-bucket monthly collection curve).
 *
 * Pins: date-bucket partitioning (every boundary day individually,
 * short-month day 28/29 in bucket 4, payment counted by its own DATE
 * not its bill's month, other months excluded, voided SISP-34 payments
 * excluded, discount portion never counted as cash, malformed dates
 * skipped), pct math (1 decimal, null on a zero month — never NaN),
 * month-over-month delta math (PKR deltas always real, share deltas
 * only when both months have collections), the previous-month-zero
 * rule, read-only derivation, the bilingual renderer, the mechanical
 * i18n audit and the dashboard wiring. Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCollectionVelocity,
  buildCollectionVelocityComparison,
  renderCollectionVelocityRowsHtml,
  COLLECTION_VELOCITY_BUCKETS
} from '../collection-velocity.js';
import { TRANSLATIONS } from '../nav-language.js';

function payment(id, date, amount, extra = {}) {
  return { id, date, amount, method: 'Cash', ...extra };
}

function bill(month, payments) {
  return { id: `bill-${month}`, month, dueAmount: 1500, status: 'paid', payments };
}

function customer(id, bills) {
  return { id, customerNumber: Number(id.replace(/\D/g, '')) || 1, name: `Synthetic ${id}`, bills };
}

function stateOf(...customers) {
  return { customers };
}

test('bucket definitions are the four spec ranges in order', () => {
  assert.deepEqual(
    COLLECTION_VELOCITY_BUCKETS.map(b => [b.fromDay, b.toDay]),
    [[1, 5], [6, 10], [11, 20], [21, 31]]
  );
});

test('boundary days land in the right buckets (each day pinned)', () => {
  // Amount = day x Rs 100 so each bucket total names its member days.
  const days = [1, 5, 6, 10, 11, 20, 21, 31];
  const state = stateOf(customer('c1', [
    bill('2026-10', days.map(day => payment(`p${day}`, `2026-10-${String(day).padStart(2, '0')}`, day * 100)))
  ]));
  const model = buildCollectionVelocity(state, '2026-10');
  assert.equal(model.month, '2026-10');
  assert.equal(model.totalCents, 1050000);
  assert.deepEqual(model.buckets.map(b => b.amountCents), [60000, 160000, 310000, 520000]);
  assert.deepEqual(model.buckets.map(b => b.pct), [5.7, 15.2, 29.5, 49.5]);
});

test('short months: Feb day 28 and leap day 29 land in bucket 4', () => {
  const feb = buildCollectionVelocity(stateOf(customer('c1', [
    bill('2027-02', [payment('f28', '2027-02-28', 2800)])
  ])), '2027-02');
  assert.deepEqual(feb.buckets.map(b => b.amountCents), [0, 0, 0, 280000]);
  const leap = buildCollectionVelocity(stateOf(customer('c1', [
    bill('2024-02', [payment('f29', '2024-02-29', 2900)])
  ])), '2024-02');
  assert.deepEqual(leap.buckets.map(b => b.amountCents), [0, 0, 0, 290000]);
});

test('a payment counts in the month of its own DATE, not its bill month', () => {
  const state = stateOf(customer('c1', [
    bill('2026-09', [payment('late', '2026-10-03', 1700)]),
    bill('2026-10', [payment('early', '2026-09-27', 1300)])
  ]));
  const oct = buildCollectionVelocity(state, '2026-10');
  assert.equal(oct.totalCents, 170000);
  assert.deepEqual(oct.buckets.map(b => b.amountCents), [170000, 0, 0, 0]);
  const sep = buildCollectionVelocity(state, '2026-09');
  assert.equal(sep.totalCents, 130000);
  assert.deepEqual(sep.buckets.map(b => b.amountCents), [0, 0, 0, 130000]);
});

test('payments dated outside the month never enter it', () => {
  const state = stateOf(customer('c1', [
    bill('2026-10', [
      payment('before', '2026-09-30', 900),
      payment('after', '2026-11-01', 900),
      payment('inside', '2026-10-15', 900)
    ])
  ]));
  const oct = buildCollectionVelocity(state, '2026-10');
  assert.equal(oct.totalCents, 90000);
  assert.deepEqual(oct.buckets.map(b => b.amountCents), [0, 0, 90000, 0]);
});

test('voided payments (SISP-34) never count as collected', () => {
  const state = stateOf(customer('c1', [
    bill('2026-10', [
      payment('ok', '2026-10-04', 1000),
      payment('rev', '2026-10-04', 9999, { voided: true })
    ])
  ]));
  const oct = buildCollectionVelocity(state, '2026-10');
  assert.equal(oct.totalCents, 100000);
});

test('the discount portion of a payment is not collected cash', () => {
  const state = stateOf(customer('c1', [
    bill('2026-10', [payment('disc', '2026-10-08', 1000, { discount: 500 })])
  ]));
  const oct = buildCollectionVelocity(state, '2026-10');
  // P&L treatment: income is payment.amount only — never amount+discount.
  assert.equal(oct.totalCents, 100000);
  assert.deepEqual(oct.buckets.map(b => b.amountCents), [0, 100000, 0, 0]);
});

test('advance payments count like the P&L counts them: amount, in date month', () => {
  const state = stateOf(customer('c1', [
    bill('2026-10', [payment('adv', '2026-10-22', 4500, { kind: 'advance' })])
  ]));
  const oct = buildCollectionVelocity(state, '2026-10');
  assert.equal(oct.totalCents, 450000);
  assert.deepEqual(oct.buckets.map(b => b.amountCents), [0, 0, 0, 450000]);
});

test('malformed dates are skipped, never guessed, and never throw', () => {
  const state = stateOf(customer('c1', [
    bill('2026-10', [
      payment('bad1', '2026-10-5', 700),
      payment('bad2', 'not-a-date', 700),
      payment('bad3', undefined, 700),
      payment('good', '2026-10-12', 700)
    ])
  ]));
  const oct = buildCollectionVelocity(state, '2026-10');
  assert.equal(oct.totalCents, 70000);
  assert.deepEqual(oct.buckets.map(b => b.amountCents), [0, 0, 70000, 0]);
});

test('a zero month returns null pcts (never NaN) and a zero total', () => {
  const model = buildCollectionVelocity(stateOf(customer('c1', [bill('2026-10', [])])), '2026-10');
  assert.equal(model.totalCents, 0);
  assert.deepEqual(model.buckets.map(b => b.pct), [null, null, null, null]);
  const html = renderCollectionVelocityRowsHtml(buildCollectionVelocityComparison({ customers: [] }, '2026-10'), 'en');
  assert.ok(!html.includes('NaN'));
  assert.ok(html.includes('—'));
});

test('malformed month argument returns the zero model without guessing', () => {
  const state = stateOf(customer('c1', [bill('2026-10', [payment('x', '2026-10-02', 500)])]));
  for (const bad of [undefined, null, '', 'October', '2026-13']) {
    const model = buildCollectionVelocity(state, bad);
    assert.equal(model.totalCents, 0);
    assert.deepEqual(model.buckets.map(b => b.amountCents), [0, 0, 0, 0]);
  }
});

test('month-over-month: exact PKR deltas and share deltas', () => {
  const state = stateOf(customer('c1', [
    bill('2026-09', [
      payment('s1', '2026-09-02', 1000),
      payment('s3', '2026-09-15', 2000),
      payment('s4', '2026-09-25', 1000)
    ]),
    bill('2026-10', [
      payment('o1', '2026-10-03', 3000),
      payment('o2', '2026-10-08', 1000),
      payment('o3', '2026-10-12', 1000),
      payment('o4', '2026-10-22', 3000)
    ])
  ]));
  const cmp = buildCollectionVelocityComparison(state, '2026-10');
  assert.equal(cmp.previousMonth, '2026-09');
  assert.equal(cmp.totalCents, 800000);
  assert.equal(cmp.previousTotalCents, 400000);
  assert.equal(cmp.totalDeltaCents, 400000);
  assert.deepEqual(cmp.buckets.map(b => b.prevAmountCents), [100000, 0, 200000, 100000]);
  assert.deepEqual(cmp.buckets.map(b => b.deltaCents), [200000, 100000, -100000, 200000]);
  // Sep pcts [25, 0, 50, 25]; Oct pcts [37.5, 12.5, 12.5, 37.5].
  assert.deepEqual(cmp.buckets.map(b => b.shareDeltaPp), [12.5, 12.5, -37.5, 12.5]);
});

test('previous month with zero collections: PKR delta real, share delta null', () => {
  const state = stateOf(customer('c1', [
    bill('2026-10', [payment('o1', '2026-10-03', 3000), payment('o4', '2026-10-22', 1000)])
  ]));
  const cmp = buildCollectionVelocityComparison(state, '2026-10');
  assert.equal(cmp.previousTotalCents, 0);
  assert.deepEqual(cmp.buckets.map(b => b.deltaCents), [300000, 0, 0, 100000]);
  assert.deepEqual(cmp.buckets.map(b => b.shareDeltaPp), [null, null, null, null]);
  const html = renderCollectionVelocityRowsHtml(cmp, 'en');
  assert.ok(html.includes('+PKR 3,000 · —'), 'share delta renders an honest dash');
});

test('previous month resolves across the year boundary', () => {
  const cmp = buildCollectionVelocityComparison({ customers: [] }, '2027-01');
  assert.equal(cmp.previousMonth, '2026-12');
});

test('builders are read-only: frozen state survives, snapshot unchanged', () => {
  const state = stateOf(customer('c1', [
    bill('2026-09', [payment('s1', '2026-09-02', 1000)]),
    bill('2026-10', [payment('o1', '2026-10-03', 3000)])
  ]));
  const snapshot = JSON.stringify(state);
  const frozen = JSON.parse(snapshot);
  (function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  })(frozen);
  assert.doesNotThrow(() => buildCollectionVelocityComparison(frozen, '2026-10'));
  buildCollectionVelocityComparison(state, '2026-10');
  assert.equal(JSON.stringify(state), snapshot);
});

test('renderer: amounts via formatPKR, bar width equals share, delta signed', () => {
  const state = stateOf(customer('c1', [
    bill('2026-09', [payment('s1', '2026-09-02', 1000), payment('s3', '2026-09-15', 2000), payment('s4', '2026-09-25', 1000)]),
    bill('2026-10', [payment('o1', '2026-10-03', 3000), payment('o2', '2026-10-08', 1000), payment('o3', '2026-10-12', 1000), payment('o4', '2026-10-22', 3000)])
  ]));
  const html = renderCollectionVelocityRowsHtml(buildCollectionVelocityComparison(state, '2026-10'), 'en');
  assert.ok(html.includes('Days 1–5'));
  assert.ok(html.includes('PKR 3,000'));
  assert.ok(html.includes('37.5%'));
  assert.ok(html.includes('style="width:37.5%"'));
  assert.ok(html.includes('+PKR 2,000 · +12.5 pp'));
  assert.ok(html.includes('PKR -1,000 · -37.5 pp'));
  assert.ok(html.includes('vel-delta-up') && html.includes('vel-delta-down'));
});

test('renderer: Urdu labels render from the ur dictionary', () => {
  const html = renderCollectionVelocityRowsHtml(buildCollectionVelocityComparison({ customers: [] }, '2026-10'), 'ur');
  assert.ok(html.includes('دن 1–5'));
  assert.ok(html.includes('دن 21–31'));
  assert.ok(!html.includes('vel_bucket'), 'no raw i18n keys render');
});

test('i18n: every velocity string exists in both dictionaries', () => {
  const keys = ['vel_title', 'vel_sub', 'vel_bucket_1_5', 'vel_bucket_6_10', 'vel_bucket_11_20', 'vel_bucket_21_31', 'vel_vs_prev', 'vel_total'];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  assert.ok(TRANSLATIONS.en.vel_total.includes('{amount}'));
  assert.ok(TRANSLATIONS.ur.vel_total.includes('{amount}'));
});

test('i18n audit: every vel_ key the module and app reference exists in both dictionaries', () => {
  const moduleSource = readFileSync(new URL('../collection-velocity.js', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const referenced = new Set();
  for (const source of [moduleSource, appSource]) {
    for (const match of source.matchAll(/t\('(vel_[a-z0-9_]+)'/g)) referenced.add(match[1]);
  }
  for (const match of moduleSource.matchAll(/labelKey: '(vel_[a-z0-9_]+)'/g)) referenced.add(match[1]);
  for (const match of htmlSource.matchAll(/data-i18n="(vel_[a-z0-9_]+)"/g)) referenced.add(match[1]);
  assert.ok(referenced.size >= 8, `expected at least 8 referenced vel_ keys, found ${[...referenced].join(',')}`);
  for (const key of referenced) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing referenced ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing referenced ${key}`);
  }
});

test('wiring: card hooks, renderer call and token-only CSS are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="collectionVelocityBody"'), 'card body hook present');
  assert.ok(html.includes('id="collectionVelocityTotal"'), 'card total hook present');
  assert.ok(html.includes('data-i18n="vel_title"'), 'card title translated');
  assert.ok(html.includes('data-i18n="vel_sub"'), 'card subtitle translated');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './collection-velocity.js'"), 'app.js imports the module');
  assert.ok(app.includes('buildCollectionVelocityComparison(state, totals.currentMonth)'), 'renderer follows the dashboard current month');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-144'));
  assert.ok(block.includes('.vel-row'), 'velocity row styles present');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'velocity CSS uses theme tokens only (no hex)');
  assert.ok(!readFileSync(new URL('../nav.css', import.meta.url), 'utf8').includes('vel-row'), 'nav.css untouched by velocity styles');
});
