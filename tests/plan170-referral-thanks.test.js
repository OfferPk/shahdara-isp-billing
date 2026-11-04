import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeReferralThanks,
  normalizeReferralThanksList,
  findReferralThanks,
  hasStoredReferralLink,
  upsertReferralThanks,
  removeReferralThanks,
  markReferralThanksSent,
  markReferralThanksUnsent,
  referralThanksForReferrer,
  referralThanksForNewCustomer,
  referralThanksReferrers,
  referralThanksSentList,
  referralThanksUnsentList,
  referralThanksText,
  referralThanksSummaryText,
  referralThanksHtml,
  referralThanksAllHtml,
  referralThanksCsv,
  referralThanksFilename,
} from '../referral-thanks.js';

const dir = dirname(fileURLToPath(import.meta.url));

const draft = (over = {}) => ({
  id: 'RT-1',
  referrerId: 'Cust A',
  newCustomerId: 'Cust B',
  message: 'Thank you for recommending Shahdara Fiber Net to your neighbour.',
  language: 'roman',
  ...over,
});

// A stored Plan 28 referral link for Cust A -> Cust B.
const links = [
  { referredCustomerId: 'Cust B', referrerCustomerId: 'Cust A', date: '2026-10-01', status: 'activated' },
];

test('plan170: half-formed draft refused (no id, referrer, new customer, or message)', () => {
  assert.equal(normalizeReferralThanks(draft({ id: '' })), null);
  assert.equal(normalizeReferralThanks(draft({ referrerId: '' })), null);
  assert.equal(normalizeReferralThanks(draft({ newCustomerId: '' })), null);
  assert.equal(normalizeReferralThanks(draft({ message: '   ' })), null);
  assert.equal(normalizeReferralThanks(draft({ referrerId: 'Cust B' })), null);
  assert.equal(upsertReferralThanks([], draft({ id: '' }), links).length, 0);
});

test('plan170: draft without a stored referral link refused, matching link accepted', () => {
  assert.equal(upsertReferralThanks([], draft(), []).length, 0);
  assert.equal(upsertReferralThanks([], draft(), undefined).length, 0);
  assert.equal(upsertReferralThanks([], draft(), [
    { referredCustomerId: 'Cust C', referrerCustomerId: 'Cust A' },
  ]).length, 0);
  assert.equal(upsertReferralThanks([], draft(), [
    { referredCustomerId: 'Cust B', referrerCustomerId: 'Cust D' },
  ]).length, 0);
  const saved = upsertReferralThanks([], draft(), links);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].referrerId, 'Cust A');
});

test('plan170: stored link matched through Plan 28 field aliases', () => {
  const aliased = [{ referredId: 'Cust B', referredByCustomerId: 'Cust A' }];
  assert.equal(hasStoredReferralLink(aliased, 'Cust A', 'Cust B'), true);
  assert.equal(hasStoredReferralLink(aliased, 'cust a', 'CUST B'), true);
  assert.equal(hasStoredReferralLink(aliased, 'Cust A', 'Cust C'), false);
  assert.equal(hasStoredReferralLink([], 'Cust A', 'Cust B'), false);
});

test('plan170: unknown fields dropped, no offer, discount, or credit field survives', () => {
  const record = normalizeReferralThanks(draft({
    offer: '1 month free', discount: 50, credit: 100, packageId: 'PKG-1', billId: 'B-1',
  }));
  assert.equal(record.offer, undefined);
  assert.equal(record.discount, undefined);
  assert.equal(record.credit, undefined);
  assert.equal(record.packageId, undefined);
  assert.equal(record.billId, undefined);
});

test('plan170: duplicate draft ids never rewritten', () => {
  const first = upsertReferralThanks([], draft(), links);
  assert.deepEqual(upsertReferralThanks(first, draft(), links), first);
  assert.deepEqual(
    upsertReferralThanks(first, draft({ message: 'A different thanks.' }), links),
    first,
  );
});

test('plan170: one draft per referrer and new customer, case-insensitive', () => {
  const first = upsertReferralThanks([], draft(), links);
  const second = upsertReferralThanks(first, draft({
    id: 'RT-2', referrerId: 'cust a', newCustomerId: 'CUST B',
  }), links);
  assert.deepEqual(second, first);
  const otherPair = upsertReferralThanks(first, draft({
    id: 'RT-2', referrerId: 'Cust A', newCustomerId: 'Cust C',
  }), [...links, { referredCustomerId: 'Cust C', referrerCustomerId: 'Cust A' }]);
  assert.equal(otherPair.length, 2);
});

test('plan170: sent date must be a strict date; bad sent date leaves list unchanged', () => {
  const list = upsertReferralThanks([], draft(), links);
  assert.deepEqual(markReferralThanksSent(list, 'RT-1', '2026-02-30'), list);
  assert.deepEqual(markReferralThanksSent(list, 'RT-1', '31-08-2026'), list);
  const sent = markReferralThanksSent(list, 'RT-1', '2026-11-02');
  assert.equal(sent[0].sent, true);
  assert.equal(sent[0].sentDate, '2026-11-02');
  const unsent = markReferralThanksUnsent(sent, 'RT-1');
  assert.equal(unsent[0].sent, false);
  assert.equal(unsent[0].sentDate, '');
});

test('plan170: find and remove drafts', () => {
  const list = upsertReferralThanks([], draft(), links);
  assert.equal(findReferralThanks(list, 'RT-1').newCustomerId, 'Cust B');
  assert.equal(findReferralThanks(list, 'nope'), null);
  assert.equal(removeReferralThanks(list, 'RT-1').length, 0);
  assert.equal(removeReferralThanks(list, 'nope').length, 1);
});

test('plan170: referrer and new-customer views, referrers list, sent and unsent lists', () => {
  const moreLinks = [...links,
    { referredCustomerId: 'Cust C', referrerCustomerId: 'Cust A' },
    { referredCustomerId: 'Cust D', referrerCustomerId: 'Cust E' }];
  let list = upsertReferralThanks([], draft(), moreLinks);
  list = upsertReferralThanks(list, draft({ id: 'RT-2', newCustomerId: 'Cust C' }), moreLinks);
  list = upsertReferralThanks(list, draft({ id: 'RT-3', referrerId: 'Cust E', newCustomerId: 'Cust D' }), moreLinks);
  assert.deepEqual(referralThanksForReferrer(list, 'cust a').map((item) => item.id), ['RT-1', 'RT-2']);
  assert.deepEqual(referralThanksForNewCustomer(list, 'Cust C').map((item) => item.id), ['RT-2']);
  assert.deepEqual(referralThanksReferrers(list), ['Cust A', 'Cust E']);
  const sent = markReferralThanksSent(list, 'RT-2', '2026-11-02');
  assert.deepEqual(referralThanksSentList(sent).map((item) => item.id), ['RT-2']);
  assert.deepEqual(referralThanksUnsentList(sent).map((item) => item.id), ['RT-1', 'RT-3']);
});

test('plan170: language falls back to roman, urdu kept', () => {
  assert.equal(normalizeReferralThanks(draft({ language: 'urdu' })).language, 'urdu');
  assert.equal(normalizeReferralThanks(draft({ language: 'french' })).language, 'roman');
  assert.equal(normalizeReferralThanks(draft({ language: undefined })).language, 'roman');
});

test('plan170: draft text is the stored message, summary text counts drafts, referrers, sent', () => {
  assert.equal(
    referralThanksText(draft()),
    'Thank you for recommending Shahdara Fiber Net to your neighbour.',
  );
  assert.equal(referralThanksText(draft({ message: '' })), '');
  const list = upsertReferralThanks([], draft(), links);
  assert.equal(referralThanksSummaryText(list), '1 referral thank-you drafts · 1 referrers · 0 sent');
  assert.equal(
    referralThanksSummaryText(markReferralThanksSent(list, 'RT-1', '2026-11-02')),
    '1 referral thank-you drafts · 1 referrers · 1 sent',
  );
});

test('plan170: draft HTML names both customers and escapes markup', () => {
  const html = referralThanksHtml(draft({ message: 'Thanks <b>friend</b> & family!' }));
  assert.ok(html.includes('Cust A'));
  assert.ok(html.includes('Cust B'));
  assert.ok(html.includes('Thanks &lt;b&gt;friend&lt;/b&gt; &amp; family!'));
  assert.ok(!html.includes('<b>friend</b>'));
  assert.ok(referralThanksAllHtml([]).includes('No referral thank-you drafts'));
});

test('plan170: CSV export and filename', () => {
  const list = upsertReferralThanks([], draft(), links);
  const csv = referralThanksCsv(list);
  assert.ok(csv.startsWith('id,referrerId,newCustomerId,message,language,sent,sentDate\n'));
  assert.ok(csv.includes('RT-1,Cust A,Cust B,'));
  assert.equal(referralThanksFilename(), 'referral-thank-you-drafts.csv');
});

test('plan170: inputs never mutated', () => {
  const input = draft();
  const snapshot = JSON.stringify(input);
  const listSnapshot = JSON.stringify([input]);
  upsertReferralThanks([input], draft({ id: 'RT-2', newCustomerId: 'Cust C' }), links);
  markReferralThanksSent([input], 'RT-1', '2026-11-02');
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(JSON.stringify([input]), listSnapshot);
});

test('plan170: purity fence — module touches no storage, network, or other store', () => {
  const source = readFileSync(join(dir, '..', 'referral-thanks.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('Date.now'));
  assert.ok(!source.includes('referral-credits'));
  assert.ok(!source.includes('saveReferral'));
});

test('plan170: panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['rtReferrer', 'rtNewCustomer', 'rtMessage', 'rtLanguage', 'rtSaveBtn',
    'rtRemoveId', 'rtRemoveBtn', 'rtSentId', 'rtSentDate', 'rtMarkSentBtn', 'rtMarkUnsentBtn',
    'rtExportBtn', 'rtFilter', 'rtBody', 'rtReferrerBody', 'rtSummary']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
