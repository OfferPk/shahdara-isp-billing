import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WELCOME_PACK_VARIANTS,
  normalizeWelcomePackVariant,
  isValidWelcomePackDate,
  formatWelcomePackAmount,
  formatWelcomePackDate,
  buildWelcomePack,
  welcomePackFromCustomer,
  buildWelcomePackDraft,
  welcomePackSummaryText,
  logWelcomePackSent,
  findWelcomePackSends,
  welcomePackSentText,
  welcomePackHtml,
} from '../welcome-pack.js';

const base = {
  customerId: 'c1',
  customerName: 'Ahmed',
  package: '20 Mbps',
  monthlyAmount: 3000,
  dueDate: '2026-11-05',
  paymentMethods: ['Cash', 'JazzCash'],
  supportContact: '0300-1234567',
};

test('a complete pack is ready and carries the profile figures verbatim', () => {
  const pack = buildWelcomePack(base);
  assert.equal(pack.status, 'ready');
  assert.deepEqual(pack.missing, []);
  assert.equal(pack.package, '20 Mbps');
  assert.equal(pack.monthlyAmount, 3000);
  assert.equal(pack.dueDate, '2026-11-05');
  assert.deepEqual(pack.paymentMethods, ['Cash', 'JazzCash']);
});

test('missing package, amount, or due date makes the pack incomplete and names each gap', () => {
  const pack = buildWelcomePack({ customerId: 'c1', customerName: 'Ahmed' });
  assert.equal(pack.status, 'incomplete');
  assert.deepEqual(pack.missing, ['package', 'monthly-amount', 'due-date']);
  const amountGap = buildWelcomePack({ customerId: 'c1', package: '20 Mbps', dueDate: '2026-11-05' });
  assert.deepEqual(amountGap.missing, ['monthly-amount']);
});

test('a due-day rule stands in for a specific due date, but never invents one', () => {
  const withRule = buildWelcomePack({ ...base, dueDate: null, dueDay: 5 });
  assert.equal(withRule.status, 'ready');
  assert.equal(withRule.dueDate, null);
  assert.equal(withRule.dueDay, 5);
  const draft = buildWelcomePackDraft(withRule);
  assert.match(draft.text, /5th tareekh/);
  const noRule = buildWelcomePack({ ...base, dueDate: null, dueDay: null });
  assert.equal(noRule.status, 'incomplete');
  assert.ok(noRule.missing.includes('due-date'));
});

test('invalid due days and impossible dates are rejected, not normalised into a date', () => {
  assert.equal(isValidWelcomePackDate('2026-02-30'), false);
  assert.equal(isValidWelcomePackDate('2026-11-05'), true);
  assert.equal(isValidWelcomePackDate('05-11-2026'), false);
  for (const bad of [0, 32, -1, 'abc', NaN]) {
    const pack = buildWelcomePack({ ...base, dueDate: null, dueDay: bad });
    assert.equal(pack.dueDay, null, String(bad));
  }
  assert.equal(buildWelcomePack({ ...base, dueDate: '2026-02-30' }).dueDate, null);
});

test('negative or non-numeric amounts are missing, zero is a real amount', () => {
  assert.equal(buildWelcomePack({ ...base, monthlyAmount: -5 }).monthlyAmount, null);
  assert.equal(buildWelcomePack({ ...base, monthlyAmount: 'abc' }).monthlyAmount, null);
  assert.equal(buildWelcomePack({ ...base, monthlyAmount: 0 }).monthlyAmount, 0);
  assert.equal(buildWelcomePack({ ...base, monthlyAmount: '3000' }).monthlyAmount, 3000);
  assert.equal(formatWelcomePackAmount(3000), 'PKR 3,000');
  assert.equal(formatWelcomePackDate('2026-11-05'), '5 Nov 2026');
});

test('payment methods are cleaned and deduped, support contact is optional and never invented', () => {
  const pack = buildWelcomePack({ ...base, paymentMethods: ['Cash', ' Cash ', '', 'Cash', null], supportContact: '  ' });
  assert.deepEqual(pack.paymentMethods, ['Cash']);
  assert.equal(pack.supportContact, '');
  const draft = buildWelcomePackDraft(pack);
  assert.ok(!draft.text.includes('Support ke liye'));
  const withSupport = buildWelcomePackDraft(buildWelcomePack(base));
  assert.match(withSupport.text, /0300-1234567/);
});

test('roman draft carries package, amount, due date, methods, receipt and Waada basics', () => {
  const draft = buildWelcomePackDraft(buildWelcomePack(base));
  assert.equal(draft.variant, 'roman');
  assert.match(draft.text, /Ahmed/);
  assert.match(draft.text, /20 Mbps/);
  assert.match(draft.text, /PKR 3,000/);
  assert.match(draft.text, /5 Nov 2026/);
  assert.match(draft.text, /Cash, JazzCash/);
  assert.match(draft.text, /Receipt/);
  assert.match(draft.text, /Waada/);
  assert.match(draft.text, /Shahdara Fiber Net/);
});

test('urdu draft carries the same figures in Urdu script', () => {
  const draft = buildWelcomePackDraft(buildWelcomePack(base), WELCOME_PACK_VARIANTS.URDU);
  assert.equal(draft.variant, 'urdu');
  assert.match(draft.text, /20 Mbps/);
  assert.match(draft.text, /PKR 3,000/);
  assert.match(draft.text, /شاہدرہ فائبر نیٹ/);
  assert.match(draft.text, /رسید/);
  assert.match(draft.text, /وعدہ/);
});

test('unknown variant falls back to roman, never to a language the customer did not pick', () => {
  assert.equal(normalizeWelcomePackVariant('french'), 'roman');
  assert.equal(normalizeWelcomePackVariant(null), 'roman');
  assert.equal(normalizeWelcomePackVariant('urdu'), 'urdu');
  assert.equal(buildWelcomePackDraft(buildWelcomePack(base), 'french').variant, 'roman');
});

test('an incomplete draft shows Not set for the gap instead of a guessed figure', () => {
  const draft = buildWelcomePackDraft(buildWelcomePack({ customerId: 'c1', customerName: 'Ahmed' }));
  assert.match(draft.text, /Not set/);
  assert.ok(!draft.text.includes('PKR 0'));
});

test('building a pack never mutates its input', () => {
  const input = { ...base, paymentMethods: ['Cash', 'JazzCash'] };
  const snapshot = JSON.stringify(input);
  buildWelcomePack(input);
  buildWelcomePackDraft(buildWelcomePack(input));
  assert.equal(JSON.stringify(input), snapshot);
});

test('welcomePackFromCustomer maps profile fields and the latest bill due date', () => {
  const customer = {
    id: 'c9',
    name: 'Bilal',
    packageSpeed: '10 Mbps',
    monthlySellingAmount: 1500,
    bills: [
      { month: '2026-10', dueDate: '2026-10-05' },
      { month: '2026-11', dueDate: '2026-11-05' },
      { month: '2026-12', dueDate: 'not-a-date' },
    ],
  };
  const pack = welcomePackFromCustomer(customer, { paymentMethods: ['Cash'] });
  assert.equal(pack.customerId, 'c9');
  assert.equal(pack.package, '10 Mbps');
  assert.equal(pack.monthlyAmount, 1500);
  assert.equal(pack.dueDate, '2026-11-05');
  assert.equal(pack.status, 'ready');
});

test('welcomePackFromCustomer with no bills takes the caller due-day rule, not a guessed date', () => {
  const pack = welcomePackFromCustomer(
    { id: 'c2', name: 'Fatima', packageSpeed: '15 Mbps', monthlySellingAmount: 2000, bills: [] },
    { dueDay: 5 },
  );
  assert.equal(pack.dueDate, null);
  assert.equal(pack.dueDay, 5);
  assert.equal(pack.status, 'ready');
  const noRule = welcomePackFromCustomer(
    { id: 'c2', name: 'Fatima', packageSpeed: '15 Mbps', monthlySellingAmount: 2000, bills: [] },
    {},
  );
  assert.equal(noRule.status, 'incomplete');
});

test('send log appends time and channel, ignores entries without id or time, and finds by customer', () => {
  const log = logWelcomePackSent([], { customerId: 'c1', sentAt: '2026-11-04T10:00:00.000Z' });
  assert.equal(log.length, 1);
  assert.equal(log[0].channel, 'whatsapp');
  assert.equal(log[0].variant, 'roman');
  assert.equal(logWelcomePackSent(log, { customerId: '', sentAt: '2026-11-04T10:00:00.000Z' }).length, 1);
  assert.equal(logWelcomePackSent(log, { customerId: 'c1', sentAt: '' }).length, 1);
  const log2 = logWelcomePackSent(log, { customerId: 'c1', sentAt: '2026-11-05T10:00:00.000Z', variant: 'urdu' });
  assert.equal(findWelcomePackSends(log2, 'c1').length, 2);
  assert.equal(findWelcomePackSends(log2, 'other').length, 0);
  assert.equal(findWelcomePackSends(log2, 'c1')[1].variant, 'urdu');
});

test('sent text covers not-sent, sent-once, and re-send states', () => {
  assert.match(welcomePackSentText([]), /not sent yet/);
  assert.match(welcomePackSentText([]), /activation/);
  assert.match(welcomePackSentText([{ customerId: 'c1', sentAt: '2026-11-04T10:00:00.000Z' }]), /4 Nov 2026/);
  assert.match(
    welcomePackSentText([
      { customerId: 'c1', sentAt: '2026-11-04T10:00:00.000Z' },
      { customerId: 'c1', sentAt: '2026-11-05T10:00:00.000Z' },
    ]),
    /re-send anytime/,
  );
});

test('summary text states ready or the exact missing fields', () => {
  assert.match(welcomePackSummaryText(buildWelcomePack(base)), /ready/);
  assert.match(welcomePackSummaryText(buildWelcomePack({ customerId: 'c1' })), /package, monthly-amount, due-date/);
  assert.equal(welcomePackSummaryText(null), 'Welcome pack unavailable.');
});

test('html escapes names and lists the missing fields instead of hiding them', () => {
  const pack = buildWelcomePack({ ...base, customerName: '<b>Ahmed</b>' });
  const html = welcomePackHtml(pack, { draftText: buildWelcomePackDraft(pack).text, sends: [] });
  assert.ok(!html.includes('<b>Ahmed</b>'));
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(html, /not sent yet/);
  const incomplete = welcomePackHtml(buildWelcomePack({ customerId: 'c1' }), { draftText: '', sends: [] });
  assert.match(incomplete, /Missing on the profile/);
  assert.match(incomplete, /package/);
});
