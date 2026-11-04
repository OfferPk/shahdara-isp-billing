import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validNoticeDate,
  normalizeNoticePackageKey,
  formatNoticeCents,
  normalizePriceNotice,
  normalizePriceNoticeList,
  upsertPriceNotice,
  removePriceNotice,
  filterPriceNotices,
  buildNoticeDrafts,
  buildNoticeText,
  priceNoticeSummaryText,
  priceNoticeHtml,
  priceNoticeDraftHtml,
  priceNoticeCsv,
  priceNoticeFilename,
  normalizePriceNoticeSend,
  normalizePriceNoticeSendList,
  logPriceNoticeSent,
  findPriceNoticeSends,
} from '../price-notices.js';

const notice = (overrides = {}) => ({
  id: 'N-1',
  packageKey: '5mbps-500gb',
  packageLabel: '5Mbps / 500GB',
  oldCents: 200000,
  newCents: 250000,
  effectiveDate: '2026-12-01',
  reason: 'Network upgrade costs',
  status: 'draft',
  ...overrides,
});

const history = [
  { packageKey: '5mbps-500gb', packageLabel: '5Mbps / 500GB', amount: 2000, effectiveDate: '2026-06-01' },
  { packageKey: '5mbps-500gb', packageLabel: '5Mbps / 500GB', amount: 2500, effectiveDate: '2026-12-01' },
  { packageKey: '3mbps-100gb', packageLabel: '3Mbps / 100GB', amount: 1000, effectiveDate: '2026-12-01' },
];

const baselines = [
  { packageKey: '5mbps-500gb', amount: 1500 },
  { packageKey: '3mbps-100gb', amount: 1000 },
];

test('validNoticeDate accepts real dates and rejects impossible ones', () => {
  assert.equal(validNoticeDate('2026-12-01'), '2026-12-01');
  assert.equal(validNoticeDate('2024-02-29'), '2024-02-29');
  assert.equal(validNoticeDate('2026-02-30'), null);
  assert.equal(validNoticeDate('2026-13-01'), null);
  assert.equal(validNoticeDate('2026-12'), null);
  assert.equal(validNoticeDate(20261201), null);
});

test('normalizeNoticePackageKey collapses case and spacing', () => {
  assert.equal(normalizeNoticePackageKey('  5Mbps  /  500GB '), '5mbps / 500gb');
  assert.equal(normalizeNoticePackageKey(''), '');
  assert.equal(normalizeNoticePackageKey(null), '');
});

test('formatNoticeCents renders rupees with two decimals', () => {
  assert.equal(formatNoticeCents(250000), 'Rs. 2,500.00');
  assert.equal(formatNoticeCents(9677), 'Rs. 96.77');
  assert.equal(formatNoticeCents(0), 'Rs. 0.00');
});

test('normalizePriceNotice keeps a valid notice and converts rupees once', () => {
  assert.deepEqual(normalizePriceNotice({ ...notice(), oldCents: undefined, newCents: undefined, oldAmount: 2000, newAmount: 2500 }), notice());
  const stored = normalizePriceNotice(notice());
  assert.deepEqual(normalizePriceNotice(stored), stored, 're-reading a stored record never inflates a hundredfold');
});

test('normalizePriceNotice uses a *Cents field as-is', () => {
  const kept = normalizePriceNotice(notice({ oldCents: 200000, oldAmount: 9999 }));
  assert.equal(kept.oldCents, 200000);
});

test('normalizePriceNotice refuses half-formed records', () => {
  assert.equal(normalizePriceNotice(notice({ id: '' })), null);
  assert.equal(normalizePriceNotice(notice({ packageKey: '' })), null);
  assert.equal(normalizePriceNotice(notice({ effectiveDate: '2026-02-30' })), null);
  assert.equal(normalizePriceNotice(notice({ oldCents: -1 })), null);
  assert.equal(normalizePriceNotice(notice({ newCents: undefined, newAmount: 'not a number' })), null);
  assert.equal(normalizePriceNotice(notice({ reason: '   ' })), null);
  assert.equal(normalizePriceNotice(notice({ oldCents: 250000, newCents: 250000 })), null, 'equal prices are not a change');
  assert.equal(normalizePriceNotice(null), null);
  assert.equal(normalizePriceNotice([]), null);
});

test('upsert, remove, and filter keep the list sorted and clean', () => {
  const list = upsertPriceNotice([], notice());
  assert.equal(list.length, 1);
  const replaced = upsertPriceNotice(list, notice({ newCents: 260000, reason: 'Updated reason' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].newCents, 260000);
  assert.equal(upsertPriceNotice(list, notice({ id: '' })).length, 1, 'refused notice leaves the list unchanged');
  assert.equal(removePriceNotice(replaced, 'N-1').length, 0);
  assert.equal(filterPriceNotices(replaced, { packageKey: '5MBPS-500GB' }).length, 1);
  assert.equal(filterPriceNotices(replaced, { packageKey: 'other' }).length, 0);
  assert.equal(filterPriceNotices(replaced, { status: 'sent' }).length, 0);
});

test('buildNoticeDrafts takes the old price from the previous revision, then the baseline', () => {
  const drafts = buildNoticeDrafts(history, baselines, { '5mbps-500gb|2026-12-01': 'Network upgrade costs' });
  assert.equal(drafts.length, 2, 'the equal 3mbps revision is not a change and gets no draft');
  const first = drafts.find((d) => d.effectiveDate === '2026-06-01');
  assert.equal(first.oldCents, 150000, 'first revision falls back to the catalogue baseline');
  assert.equal(first.newCents, 200000);
  assert.equal(first.direction, 'increase');
  assert.equal(first.complete, false, 'no reason recorded for the first draft');
  const second = drafts.find((d) => d.effectiveDate === '2026-12-01');
  assert.equal(second.oldCents, 200000, 'second revision takes the previous revision as its old price');
  assert.equal(second.newCents, 250000);
  assert.equal(second.reason, 'Network upgrade costs');
  assert.equal(second.complete, true);
});

test('buildNoticeDrafts never guesses an unrecorded old price', () => {
  const drafts = buildNoticeDrafts(
    [{ packageKey: 'new-pack', packageLabel: 'New Pack', amount: 1800, effectiveDate: '2026-12-01' }],
    [],
  );
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].oldCents, null);
  assert.equal(drafts[0].direction, 'unknown');
  assert.equal(drafts[0].complete, false);
});

test('buildNoticeDrafts drops unusable rows and never mutates inputs', () => {
  const snapshot = JSON.parse(JSON.stringify(history));
  const drafts = buildNoticeDrafts([...history, { packageKey: '', amount: 1, effectiveDate: '2026-12-01' }, { packageKey: 'x', amount: 1, effectiveDate: '2026-02-30' }], baselines);
  assert.equal(drafts.length, 2);
  assert.deepEqual(history, snapshot);
});

test('buildNoticeText carries the same figures in both variants', () => {
  const draft = buildNoticeDrafts(history, baselines, { '5mbps-500gb|2026-12-01': 'Network upgrade costs' })
    .find((d) => d.effectiveDate === '2026-12-01');
  const roman = buildNoticeText(draft, 'roman');
  const urdu = buildNoticeText(draft, 'urdu');
  for (const text of [roman, urdu]) {
    assert.ok(text.includes('Rs. 2,000.00'), 'old price present');
    assert.ok(text.includes('Rs. 2,500.00'), 'new price present');
    assert.ok(text.includes('2026-12-01'), 'effective date present');
    assert.ok(text.includes('Network upgrade costs'), 'reason carried verbatim');
  }
  assert.ok(roman.includes('Shahdara Fiber Net'));
  assert.ok(urdu.includes('شاہدرہ فائبر نیٹ'));
});

test('buildNoticeText says plainly when the old price or reason is unrecorded', () => {
  const draft = buildNoticeDrafts(
    [{ packageKey: 'new-pack', packageLabel: 'New Pack', amount: 1800, effectiveDate: '2026-12-01' }],
    [],
  )[0];
  const roman = buildNoticeText(draft, 'roman');
  assert.ok(roman.includes('Purani qeemat darj nahi hai'));
  assert.ok(roman.includes('Wajah darj nahi hai.'));
  const urdu = buildNoticeText(draft, 'urdu');
  assert.ok(urdu.includes('پرانی قیمت درج نہیں ہے'));
  assert.ok(urdu.includes('وجہ درج نہیں ہے۔'));
});

test('summary, html, draft html, csv, and filename', () => {
  const list = normalizePriceNoticeList([notice(), notice({ id: 'N-2', status: 'sent' })]);
  assert.equal(priceNoticeSummaryText(list), '2 notices (1 sent, 1 draft)');
  const html = priceNoticeHtml(list);
  assert.ok(html.includes('Rs. 2,000.00') && html.includes('Rs. 2,500.00') && html.includes('Network upgrade costs'));
  assert.ok(priceNoticeHtml([]).includes('No price-change notices yet.'));
  const drafts = buildNoticeDrafts(history, baselines);
  assert.ok(priceNoticeDraftHtml(drafts).includes('Reason not recorded yet'));
  assert.ok(priceNoticeDraftHtml([]).includes('No recorded price changes'));
  const csv = priceNoticeCsv(list);
  assert.ok(csv.startsWith('Notice,Package,Old price (Rs.),New price (Rs.),Effective date,Reason,Status'));
  assert.ok(csv.includes('2000.00,2500.00'));
  assert.equal(priceNoticeFilename('2026-12-01'), 'price-change-notices-2026-12-01.csv');
  assert.equal(priceNoticeFilename('bad'), 'price-change-notices-undated.csv');
});

test('send log records sends, allows re-sends, and drops invalid entries', () => {
  const sends = logPriceNoticeSent([], { noticeId: 'N-1', date: '2026-11-20', channel: 'whatsapp', sentBy: 'Owner' });
  assert.equal(sends.length, 1);
  assert.deepEqual(normalizePriceNoticeSend(sends[0]), sends[0]);
  const resent = logPriceNoticeSent(sends, { noticeId: 'N-1', date: '2026-11-21', channel: 'announcement' });
  assert.equal(resent.length, 2, 're-sending logs a second entry');
  assert.equal(findPriceNoticeSends(resent, 'N-1').length, 2);
  assert.equal(logPriceNoticeSent(resent, { noticeId: 'N-1', date: '2026-02-30', channel: 'whatsapp' }).length, 2);
  assert.equal(logPriceNoticeSent(resent, { noticeId: 'N-1', date: '2026-11-22', channel: 'pigeon' }).length, 2);
  assert.equal(normalizePriceNoticeSendList(null).length, 0);
});

test('purity fence: module reads no store, imports nothing, and names no ledger field', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'price-notices.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('shahdara_price_history'));
  assert.ok(!source.includes('billId') && !source.includes('paymentId'));
});
