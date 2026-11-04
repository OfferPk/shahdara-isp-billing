/**
 * plan74-info-card.test.js — Plan 74: package and service info
 * card on request (customer asked, operator sends).
 * Pins:
 * - the card's package, price, cycle, and due date match the
 *   profile on the same fixture, in integer cents;
 * - a customer mid-package-change shows the current package
 *   with the change noted, never the future package as current;
 * - a missing package or a missing/unusable monthly price
 *   refuses the whole card, never zero-filled or guessed;
 *   a missing cycle, due date, status, expiry, or support
 *   contact is said plainly, never invented;
 * - sending is logged once per customer with re-send allowed,
 *   and drafting or sending never changes any package,
 *   billing, or lifecycle record;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no profile figure is ever changed by
 * this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INFO_CARD_VARIANTS,
  normalizeInfoCardVariant,
  normalizeInfoCardDueDay,
  validInfoCardDate,
  buildInfoCard,
  infoCardSummaryText,
  logInfoCardSent,
  findInfoCardSends,
  infoCardSentText,
  infoCardHtml,
} from '../info-card.js';

const base = (overrides = {}) => ({
  customerId: 'cust-1',
  customerName: 'Ahmed',
  package: '20 Mbps',
  monthlyPrice: 1500,
  cycleDueDay: 15,
  cycleIsDefault: false,
  nextDueDate: '2026-11-15',
  connectionStatus: 'Active',
  expiryDate: '2026-11-30',
  supportContact: '0300-1234567',
  variant: 'roman',
  ...overrides,
});

test('strict dates and variant/due-day normalisation', () => {
  assert.equal(validInfoCardDate('2026-02-30'), null);
  assert.equal(validInfoCardDate('2026-11-15'), '2026-11-15');
  assert.equal(validInfoCardDate('2026-11-15T10:00:00Z'), '2026-11-15');
  assert.equal(normalizeInfoCardVariant('urdu'), INFO_CARD_VARIANTS.URDU);
  assert.equal(normalizeInfoCardVariant('bogus'), INFO_CARD_VARIANTS.ROMAN);
  assert.equal(normalizeInfoCardDueDay('15'), 15);
  assert.equal(normalizeInfoCardDueDay(0), null);
  assert.equal(normalizeInfoCardDueDay(32), null);
  assert.equal(normalizeInfoCardDueDay(''), null);
});

test('exact card figures match the profile fixture', () => {
  const card = buildInfoCard(base());
  assert.ok(card);
  assert.equal(card.package, '20 Mbps');
  assert.equal(card.monthlyPriceCents, 150000);
  assert.equal(card.monthlyPrice, 1500);
  assert.equal(card.cycleDueDay, 15);
  assert.equal(card.cycleIsDefault, false);
  assert.equal(card.nextDueDate, '2026-11-15');
  assert.equal(card.connectionStatus, 'Active');
  assert.equal(card.expiryDate, '2026-11-30');
  assert.equal(card.supportContact, '0300-1234567');
  assert.ok(card.text.includes('20 Mbps'));
  assert.ok(card.text.includes('Rs. 1500'));
  assert.ok(card.text.includes('2026-11-15'));
  assert.ok(card.text.includes('2026-11-30'));
  assert.equal(infoCardSummaryText(card), '20 Mbps — Rs. 1500 / month. Next due date 2026-11-15.');
});

test('default cycle day is labelled as the default', () => {
  const card = buildInfoCard(base({ cycleDueDay: 5, cycleIsDefault: true }));
  assert.ok(card.text.includes('day 5 (default)'));
});

test('mid-package-change shows current package with the change noted', () => {
  const card = buildInfoCard(base({
    pendingChange: { proposedPackage: '50 Mbps', effectiveDate: '2026-12-01', billMonth: '2026-12', estimatedNextBill: 3000 },
  }));
  assert.ok(card);
  assert.equal(card.package, '20 Mbps');
  assert.equal(card.pendingChange.proposedPackage, '50 Mbps');
  assert.ok(card.text.includes('20 Mbps'));
  assert.ok(card.text.includes('Package change noted: 50 Mbps'));
  assert.ok(!card.text.includes('Aap ka current package: 50 Mbps'));
  assert.ok(infoCardSummaryText(card).includes('Package change noted: 50 Mbps'));
});

test('a kept preview for the same package is not a pending change', () => {
  const card = buildInfoCard(base({
    pendingChange: { proposedPackage: '20 Mbps', effectiveDate: '2026-12-01' },
  }));
  assert.equal(card.pendingChange, null);
  assert.ok(!card.text.includes('Package change noted'));
});

test('missing package or unusable price refuses the card, never zero-filled', () => {
  assert.equal(buildInfoCard(base({ package: '' })), null);
  assert.equal(buildInfoCard(base({ package: '   ' })), null);
  assert.equal(buildInfoCard(base({ monthlyPrice: '' })), null);
  assert.equal(buildInfoCard(base({ monthlyPrice: true })), null);
  assert.equal(buildInfoCard(base({ monthlyPrice: -100 })), null);
  assert.equal(buildInfoCard(base({ monthlyPrice: Number.NaN })), null);
  assert.equal(buildInfoCard(base({ customerId: '' })), null);
  assert.equal(infoCardSummaryText(null), 'Info card unavailable — the package or monthly price is missing or unusable.');
  assert.ok(infoCardHtml(null).includes('Info card unavailable'));
});

test('zero price is a real figure; missing fields are said plainly', () => {
  const card = buildInfoCard(base({
    monthlyPrice: 0,
    cycleDueDay: null,
    nextDueDate: null,
    connectionStatus: '',
    expiryDate: null,
    supportContact: '',
  }));
  assert.ok(card);
  assert.equal(card.monthlyPrice, 0);
  assert.equal(card.cycleDueDay, null);
  assert.ok(card.text.includes('not recorded'));
  assert.ok(!card.text.includes('Rs. null'));
});

test('impossible dates are never stored as dates', () => {
  const card = buildInfoCard(base({ nextDueDate: '2026-02-30', expiryDate: '2026-02-30' }));
  assert.equal(card.nextDueDate, null);
  assert.equal(card.expiryDate, null);
  assert.ok(card.text.includes('not recorded'));
});

test('Urdu variant carries the same figures', () => {
  const card = buildInfoCard(base({ variant: 'urdu' }));
  assert.equal(card.variant, INFO_CARD_VARIANTS.URDU);
  assert.ok(card.text.includes('20 Mbps'));
  assert.ok(card.text.includes('Rs. 1500'));
  assert.ok(card.text.includes('2026-11-15'));
});

test('send log once plus re-send, half-formed entries ignored', () => {
  const log = logInfoCardSent([], { customerId: 'cust-1', sentAt: '2026-11-04T10:00:00Z', channel: 'whatsapp', variant: 'roman' });
  const log2 = logInfoCardSent(log, { customerId: 'cust-1', sentAt: '2026-11-05T10:00:00Z', channel: 'whatsapp', variant: 'urdu' });
  assert.equal(findInfoCardSends(log2, 'cust-1').length, 2);
  assert.equal(findInfoCardSends(log2, 'cust-2').length, 0);
  assert.equal(logInfoCardSent(log2, { customerId: '', sentAt: '2026-11-06T10:00:00Z' }).length, 2);
  assert.equal(logInfoCardSent(log2, { customerId: 'cust-1', sentAt: '' }).length, 2);
  assert.equal(infoCardSentText([]), 'Info card not sent yet.');
  assert.ok(infoCardSentText(findInfoCardSends(log2, 'cust-1')).includes('and 1 more time'));
});

test('non-mutation and no package/bill/payment/lifecycle field on the card', () => {
  const input = base({ pendingChange: { proposedPackage: '50 Mbps', effectiveDate: '2026-12-01' } });
  const snapshot = JSON.stringify(input);
  const card = buildInfoCard(input);
  assert.equal(JSON.stringify(input), snapshot);
  const forbidden = ['bill', 'payment', 'waada', 'lifecycle', 'packageHistory', 'packageChangePreviewNote'];
  for (const key of Object.keys(card)) {
    assert.ok(!forbidden.some((bad) => key.toLowerCase().includes(bad)), `card key ${key} must not be a ledger field`);
  }
  assert.ok(!('bills' in card) && !('payments' in card));
});

test('HTML escaping and summary text', () => {
  const card = buildInfoCard(base({ customerName: '<script>alert(1)</script>', supportContact: '0300 & sons' }));
  const html = infoCardHtml(card, { draftText: card.text, sends: [] });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('0300 &amp; sons'));
  assert.ok(html.includes('Info card not sent yet.'));
});
