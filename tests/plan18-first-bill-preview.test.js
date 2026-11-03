import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeFirstPeriodMode,
  buildFirstBillPreview,
  previewFromCustomer,
  firstBillPreviewSummaryText,
  firstBillPreviewHtml,
  findFirstBillPreviewShown,
  recordFirstBillPreviewShown,
  firstBillPreviewShownText,
} from '../first-bill-preview.js';

const base = {
  customerName: 'Ahmed',
  monthlyAmount: 3000,
  connectionFee: 2000,
  securityDeposit: 1000,
  startDate: '2026-11-01',
};

test('1st of month is a full month, and the total sums the three lines exactly', () => {
  const p = buildFirstBillPreview(base);
  assert.equal(p.status, 'ready');
  assert.equal(p.firstPeriodMode, 'full');
  assert.equal(p.chargedDays, 30);
  assert.equal(p.daysInMonth, 30);
  assert.equal(p.firstPeriodCharge, 3000);
  assert.equal(p.totalDue, 6000);
  assert.equal(p.totalDue, p.installationFee + p.firstPeriodCharge + p.deposit);
});

test('mid-month start pro-rates inclusively: 16 Nov of 30 days charges 15 days', () => {
  const p = buildFirstBillPreview({ ...base, startDate: '2026-11-16' });
  assert.equal(p.firstPeriodMode, 'prorata');
  assert.equal(p.chargedDays, 15);
  assert.equal(p.firstPeriodCharge, 1500);
  assert.equal(p.totalDue, 4500);
});

test('changing only the start date updates only the pro-rata figure', () => {
  const early = buildFirstBillPreview({ ...base, startDate: '2026-11-11' });
  const late = buildFirstBillPreview({ ...base, startDate: '2026-11-21' });
  assert.equal(early.firstPeriodCharge, 2000); // 20 of 30 days
  assert.equal(late.firstPeriodCharge, 1000); // 10 of 30 days
  assert.equal(early.installationFee, late.installationFee);
  assert.equal(early.deposit, late.deposit);
  assert.equal(early.totalDue - late.totalDue, 1000);
});

test('last day of the month charges exactly one day', () => {
  const p = buildFirstBillPreview({ ...base, startDate: '2026-11-30' });
  assert.equal(p.chargedDays, 1);
  assert.equal(p.firstPeriodCharge, 100);
  assert.equal(p.totalDue, 3100);
});

test('leap February pro-rates over 29 days', () => {
  const p = buildFirstBillPreview({
    ...base, monthlyAmount: 2900, startDate: '2024-02-15',
  });
  assert.equal(p.daysInMonth, 29);
  assert.equal(p.chargedDays, 15);
  assert.equal(p.firstPeriodCharge, 1500);
});

test('non-leap February pro-rates over 28 days', () => {
  const p = buildFirstBillPreview({
    ...base, monthlyAmount: 2800, startDate: '2026-02-15',
  });
  assert.equal(p.daysInMonth, 28);
  assert.equal(p.chargedDays, 14);
  assert.equal(p.firstPeriodCharge, 1400);
});

test('explicit full mode charges the whole month even for a mid-month start', () => {
  const p = buildFirstBillPreview({ ...base, startDate: '2026-11-16', firstPeriodMode: 'full' });
  assert.equal(p.firstPeriodMode, 'full');
  assert.equal(p.chargedDays, 30);
  assert.equal(p.firstPeriodCharge, 3000);
});

test('explicit prorata mode on the 1st still charges the whole month by formula', () => {
  const p = buildFirstBillPreview({ ...base, startDate: '2026-11-01', firstPeriodMode: 'prorata' });
  assert.equal(p.firstPeriodMode, 'prorata');
  assert.equal(p.chargedDays, 30);
  assert.equal(p.firstPeriodCharge, 3000);
});

test('unknown mode falls back to auto, never to a silent full', () => {
  assert.equal(normalizeFirstPeriodMode('bogus'), 'auto');
  assert.equal(normalizeFirstPeriodMode('FULL'), 'full');
  assert.equal(normalizeFirstPeriodMode(''), 'auto');
  const p = buildFirstBillPreview({ ...base, startDate: '2026-11-16', firstPeriodMode: 'bogus' });
  assert.equal(p.firstPeriodMode, 'prorata');
});

test('pro-rata rounds to two decimals, never a long fraction', () => {
  const p = buildFirstBillPreview({
    ...base, monthlyAmount: 1000, startDate: '2026-11-16',
  });
  assert.equal(p.firstPeriodCharge, 500);
  const odd = buildFirstBillPreview({
    ...base, monthlyAmount: 1001, startDate: '2026-11-16',
  });
  assert.equal(odd.firstPeriodCharge, 500.5);
  const third = buildFirstBillPreview({
    ...base, monthlyAmount: 100, startDate: '2026-11-29',
  });
  assert.equal(third.firstPeriodCharge, 6.67); // 2 of 30 days
});

test('free connection waives the installation fee but keeps the other lines', () => {
  const p = buildFirstBillPreview({ ...base, isFreeConnection: true });
  assert.equal(p.installationFee, 0);
  assert.equal(p.installationFeeWaived, true);
  assert.equal(p.totalDue, 4000);
});

test('missing monthly price makes the preview incomplete with a null total, never a guess', () => {
  const p = buildFirstBillPreview({ ...base, monthlyAmount: null });
  assert.equal(p.status, 'incomplete');
  assert.deepEqual(p.reasons, ['monthly-price-missing']);
  assert.equal(p.firstPeriodCharge, null);
  assert.equal(p.totalDue, null);
});

test('blank, negative and non-numeric monthly prices are all missing, not zero', () => {
  for (const bad of ['', -500, 'abc', NaN]) {
    const p = buildFirstBillPreview({ ...base, monthlyAmount: bad });
    assert.equal(p.status, 'incomplete');
    assert.equal(p.totalDue, null);
  }
});

test('an impossible start date makes the preview incomplete, never a guessed date', () => {
  const p = buildFirstBillPreview({ ...base, startDate: '2026-02-30' });
  assert.equal(p.status, 'incomplete');
  assert.deepEqual(p.reasons, ['start-date-invalid']);
  assert.equal(p.startDate, null);
  assert.equal(p.totalDue, null);
});

test('a wrong-format start date is invalid too', () => {
  const p = buildFirstBillPreview({ ...base, startDate: '16-11-2026' });
  assert.equal(p.status, 'incomplete');
  assert.equal(p.startDate, null);
});

test('both problems are listed together', () => {
  const p = buildFirstBillPreview({ monthlyAmount: null, startDate: 'not-a-date' });
  assert.deepEqual(p.reasons, ['monthly-price-missing', 'start-date-invalid']);
});

test('unrecorded installation fee is counted as 0 and listed as an assumption', () => {
  const p = buildFirstBillPreview({ ...base, connectionFee: null });
  assert.equal(p.installationFee, 0);
  assert.equal(p.totalDue, 4000);
  assert.ok(p.assumptions.some((a) => a.includes('Installation fee')));
  assert.equal(p.status, 'ready');
});

test('unrecorded deposit is 0, and a recorded 0 needs no assumption', () => {
  const absent = buildFirstBillPreview({ ...base, securityDeposit: null });
  assert.equal(absent.deposit, 0);
  assert.equal(absent.totalDue, 5000);
  const zero = buildFirstBillPreview({ ...base, securityDeposit: 0 });
  assert.equal(zero.deposit, 0);
  assert.equal(zero.totalDue, 5000);
});

test('negative fee and deposit inputs are treated as not recorded, never subtracted', () => {
  const p = buildFirstBillPreview({ ...base, connectionFee: -2000, securityDeposit: -1000 });
  assert.equal(p.installationFee, 0);
  assert.equal(p.deposit, 0);
  assert.equal(p.totalDue, 3000);
});

test('string whole-number money is accepted, matching how form inputs arrive', () => {
  const p = buildFirstBillPreview({
    ...base, monthlyAmount: '3000', connectionFee: '2000', securityDeposit: '1000',
  });
  assert.equal(p.totalDue, 6000);
});

test('inputs are never mutated', () => {
  const input = { ...base, startDate: '2026-11-16' };
  const snapshot = { ...input };
  buildFirstBillPreview(input);
  assert.deepEqual(input, snapshot);
});

test('previewFromCustomer pulls the quoted price and fee settings off the record', () => {
  const customer = {
    name: 'Zara', monthlySellingAmount: 2500, connectionFee: 1500,
    securityDeposit: 500, connectionDate: '2026-11-10', bills: [],
  };
  const p = previewFromCustomer(customer);
  assert.equal(p.customerName, 'Zara');
  assert.equal(p.monthlyAmount, 2500);
  assert.equal(p.startDate, '2026-11-10');
  assert.equal(p.chargedDays, 21);
  assert.equal(p.firstPeriodCharge, 1750);
  assert.equal(p.totalDue, 3750);
});

test('previewFromCustomer start-date override changes only the pro-rata figure', () => {
  const customer = {
    name: 'Zara', monthlySellingAmount: 2500, connectionFee: 1500,
    securityDeposit: 500, connectionDate: '2026-11-10', bills: [],
  };
  const a = previewFromCustomer(customer);
  const b = previewFromCustomer(customer, { startDate: '2026-11-01' });
  assert.equal(a.firstPeriodCharge, 1750);
  assert.equal(b.firstPeriodCharge, 2500);
  assert.equal(a.installationFee, b.installationFee);
});

test('previewFromCustomer never touches the customer record or its bills', () => {
  const customer = {
    name: 'Zara', monthlySellingAmount: 2500, connectionFee: 1500,
    securityDeposit: 500, connectionDate: '2026-11-10', bills: [],
  };
  const snapshot = JSON.parse(JSON.stringify(customer));
  previewFromCustomer(customer);
  assert.deepEqual(customer, snapshot);
  assert.deepEqual(customer.bills, []);
});

test('previewFromCustomer with no connection date is incomplete, not dated today', () => {
  const p = previewFromCustomer({ name: 'Noor', monthlySellingAmount: 2000 });
  assert.equal(p.status, 'incomplete');
  assert.equal(p.startDate, null);
});

test('summary text carries the name, lines and total for a ready preview', () => {
  const p = buildFirstBillPreview(base);
  const text = firstBillPreviewSummaryText(p);
  assert.ok(text.includes('Ahmed'));
  assert.ok(text.includes('6000'));
  assert.ok(text.includes('2000'));
});

test('summary text for an incomplete preview names the problem, not a total', () => {
  const p = buildFirstBillPreview({ ...base, monthlyAmount: null });
  const text = firstBillPreviewSummaryText(p);
  assert.ok(text.includes('incomplete'));
  assert.ok(text.includes('monthly-price-missing'));
  assert.ok(!text.includes('total due PKR null'));
});

test('HTML escapes a hostile customer name and shows the total row', () => {
  const p = buildFirstBillPreview({ ...base, customerName: '<script>alert(1)</script>' });
  const html = firstBillPreviewHtml(p);
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(html.includes('Total due'));
  assert.ok(html.includes('Preview only'));
});

test('HTML for an incomplete preview shows the reason and no total figure', () => {
  const p = buildFirstBillPreview({ ...base, monthlyAmount: null });
  const html = firstBillPreviewHtml(p);
  assert.ok(html.includes('monthly-price-missing'));
  assert.ok(html.includes('No total is shown'));
});

test('HTML uses the caller formatter when one is supplied', () => {
  const p = buildFirstBillPreview(base);
  const html = firstBillPreviewHtml(p, (amount) => `Rs.${amount}`);
  assert.ok(html.includes('Rs.6000'));
});

test('preview-shown tracking: record, find, and re-record updates the date', () => {
  let list = [];
  assert.equal(findFirstBillPreviewShown(list, 'c1'), null);
  list = recordFirstBillPreviewShown(list, 'c1', '2026-11-03');
  assert.deepEqual(findFirstBillPreviewShown(list, 'c1'), { customerId: 'c1', shownAt: '2026-11-03' });
  assert.equal(firstBillPreviewShownText(findFirstBillPreviewShown(list, 'c1')), 'First-bill preview shown on 2026-11-03');
  list = recordFirstBillPreviewShown(list, 'c1', '2026-11-04');
  assert.equal(list.length, 1);
  assert.equal(findFirstBillPreviewShown(list, 'c1').shownAt, '2026-11-04');
});

test('preview-shown tracking never invents a flag for a bad id or a bad date', () => {
  const list = recordFirstBillPreviewShown([], 'c1', '2026-11-03');
  assert.deepEqual(recordFirstBillPreviewShown(list, '', '2026-11-04'), list);
  assert.deepEqual(recordFirstBillPreviewShown(list, 'c2', '2026-02-30'), list);
  assert.deepEqual(recordFirstBillPreviewShown(list, 'c2', ''), list);
  assert.equal(findFirstBillPreviewShown(list, 'c2'), null);
  assert.equal(firstBillPreviewShownText(null), 'First-bill preview not shown yet');
});

test('preview-shown tracking never mutates the incoming list', () => {
  const list = [{ customerId: 'c1', shownAt: '2026-11-03' }];
  const next = recordFirstBillPreviewShown(list, 'c2', '2026-11-04');
  assert.equal(list.length, 1);
  assert.equal(next.length, 2);
});
