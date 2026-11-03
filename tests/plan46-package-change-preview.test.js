/**
 * plan46-package-change-preview.test.js — Plan 46: package upgrade
 * and downgrade preview with next-bill estimate.
 * Pins:
 * - the preview is a preview only: it applies nothing, and its
 *   prices resolve through the Plan 34 rule (latest revision on or
 *   before the bill month's first day, else the caller baseline,
 *   else null — never guessed);
 * - full month when the change is already effective at the bill
 *   month's start, pro-rata by calendar days (Plan 18 style,
 *   effective date belongs to the new package) inside the month,
 *   old price alone when the change falls after the month;
 * - changing the effective date updates the estimate;
 * - applying a change still happens through the existing flow, and
 *   the preview is kept as a note on that change only when it
 *   matches the change — an incomplete or mismatched preview
 *   leaves the change untouched, and inputs are never mutated.
 * Synthetic data only; no bill, payment, package-history, or
 * lifecycle record is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidChangeDate,
  validBillMonth,
  resolveChangePackagePrice,
  normalizeChangeMode,
  buildPackageChangePreview,
  packageChangePreviewSummaryText,
  packageChangePreviewNote,
  previewMatchesChange,
  attachPreviewNoteToChange,
  packageChangePreviewHtml,
  packageChangePreviewCsv,
  packageChangePreviewFilename,
  findPackageChangePreview,
  recordPackageChangePreview,
  removePackageChangePreview,
  packageChangePreviewStoredText,
} from '../package-change-preview.js';

const BASE = {
  customerId: 'cust-1',
  customerName: 'Test Customer',
  currentPackage: '10 Mbps',
  currentPrice: 1000,
  proposedPackage: '20 Mbps',
  proposedPrice: 2000,
  billMonth: '2026-11',
};

test('date and month validation: impossible dates and months rejected', () => {
  assert.equal(isValidChangeDate('2026-02-30'), false);
  assert.equal(isValidChangeDate('2026-11-15'), true);
  assert.equal(isValidChangeDate('15-11-2026'), false);
  assert.equal(validBillMonth('2026-11'), '2026-11');
  assert.equal(validBillMonth('2026-13'), null);
  assert.equal(validBillMonth('2026-11-15'), null);
  assert.equal(normalizeChangeMode('FULL'), 'full');
  assert.equal(normalizeChangeMode('bogus'), 'auto');
});

test('full month when the change is already effective at the month start', () => {
  const preview = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-10-15' });
  assert.equal(preview.status, 'ready');
  assert.equal(preview.estimateMode, 'full');
  assert.equal(preview.estimatedNextBill, 2000);
  assert.equal(preview.monthlyDifference, 1000);
  assert.equal(preview.direction, 'upgrade');
  assert.equal(preview.lines.length, 1);
  assert.equal(preview.lines[0].amount, 2000);
});

test('effective on the 1st is a full month', () => {
  const preview = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-01' });
  assert.equal(preview.estimateMode, 'full');
  assert.equal(preview.estimatedNextBill, 2000);
  assert.equal(preview.newDays, 30);
  assert.equal(preview.oldDays, 0);
});

test('pro-rata inside the month, effective date belongs to the new package', () => {
  // November has 30 days; effective 16th: 15 old days, 15 new days.
  const preview = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-16' });
  assert.equal(preview.estimateMode, 'prorata');
  assert.equal(preview.oldDays, 15);
  assert.equal(preview.newDays, 15);
  assert.equal(preview.lines[0].amount, 500);
  assert.equal(preview.lines[1].amount, 1000);
  assert.equal(preview.estimatedNextBill, 1500);
  // Shares always add up exactly to the total.
  assert.equal(preview.lines[0].amount + preview.lines[1].amount, preview.estimatedNextBill);
});

test('pro-rata cents split exactly on an uneven month split', () => {
  // Effective 11th: 10 old days at 1000, 20 new days at 2000.
  const preview = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-11' });
  assert.equal(preview.lines[0].amount, 333.33);
  assert.equal(preview.lines[1].amount, 1333.33);
  assert.equal(preview.estimatedNextBill, 1666.66);
});

test('change after the bill month leaves the next bill at the old price', () => {
  const preview = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-12-05' });
  assert.equal(preview.estimateMode, 'not-yet-effective');
  assert.equal(preview.estimatedNextBill, 1000);
  assert.equal(preview.monthlyDifference, 1000);
  assert.match(preview.estimateNote, /after this bill month/);
});

test('changing the effective date updates the estimate', () => {
  const early = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-16' });
  const late = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-21' });
  assert.equal(early.estimatedNextBill, 1500);
  // 20 old days at 1000 (666.67) + 10 new days at 2000 (666.67).
  assert.equal(late.estimatedNextBill, 1333.34);
  assert.notEqual(early.estimatedNextBill, late.estimatedNextBill);
});

test('explicit full charges the whole month; explicit prorata before the month is still full', () => {
  const full = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-16', mode: 'full' });
  assert.equal(full.estimateMode, 'full');
  assert.equal(full.estimatedNextBill, 2000);
  const prorata = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-10-20', mode: 'prorata' });
  assert.equal(prorata.estimateMode, 'full');
  assert.equal(prorata.estimatedNextBill, 2000);
});

test('downgrade and lateral directions with exact differences', () => {
  const down = buildPackageChangePreview({ ...BASE, proposedPrice: 500, effectiveDate: '2026-10-15' });
  assert.equal(down.direction, 'downgrade');
  assert.equal(down.monthlyDifference, -500);
  assert.equal(down.estimatedNextBill, 500);
  const lateral = buildPackageChangePreview({ ...BASE, proposedPrice: 1000, effectiveDate: '2026-10-15' });
  assert.equal(lateral.direction, 'lateral');
  assert.equal(lateral.monthlyDifference, 0);
});

test('prices resolve through the Plan 34 rule: bill month counts as its first day', () => {
  const history = [
    { packageKey: '20 Mbps', amount: 1800, effectiveDate: '2026-11-15' },
    { packageKey: '10 Mbps', amount: 900, effectiveDate: '2026-10-01' },
  ];
  // November's bill month counts as 2026-11-01: the mid-November
  // revision does NOT apply yet, so the baseline still rules.
  const november = buildPackageChangePreview({ ...BASE, priceHistory: history, effectiveDate: '2026-10-15' });
  assert.equal(november.proposedPrice, 2000);
  assert.equal(november.proposedPriceSource, 'baseline');
  assert.equal(november.currentPrice, 900);
  assert.equal(november.currentPriceSource, 'revision');
  assert.equal(november.currentPriceEffectiveDate, '2026-10-01');
  // December: the revision is now effective.
  const december = buildPackageChangePreview({
    ...BASE, priceHistory: history, billMonth: '2026-12', effectiveDate: '2026-11-20',
  });
  assert.equal(december.proposedPrice, 1800);
  assert.equal(december.proposedPriceSource, 'revision');
  assert.equal(december.proposedPriceEffectiveDate, '2026-11-15');
});

test('resolveChangePackagePrice: baseline fallback, then null — never guessed', () => {
  assert.deepEqual(
    resolveChangePackagePrice([], '20 Mbps', '2026-11', 2000),
    { price: 2000, source: 'baseline', effectiveDate: null },
  );
  assert.deepEqual(
    resolveChangePackagePrice([], '20 Mbps', '2026-11', null),
    { price: null, source: 'missing', effectiveDate: null },
  );
  assert.deepEqual(
    resolveChangePackagePrice(
      [{ packageKey: '20 Mbps', amount: 1900, effectiveDate: '2026-11-01' }],
      '20 Mbps', '2026-11', 2000,
    ),
    { price: 1900, source: 'revision', effectiveDate: '2026-11-01' },
  );
});

test('incomplete previews carry reasons and no estimate or note', () => {
  const missingPackage = buildPackageChangePreview({ ...BASE, proposedPackage: '  ', effectiveDate: '2026-10-15' });
  assert.equal(missingPackage.status, 'incomplete');
  assert.equal(missingPackage.estimatedNextBill, null);
  assert.ok(missingPackage.reasons.includes('package-missing'));
  const badDate = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-02-30' });
  assert.equal(badDate.status, 'incomplete');
  assert.ok(badDate.reasons.includes('effective-date-invalid'));
  const badMonth = buildPackageChangePreview({ ...BASE, billMonth: '2026-13', effectiveDate: '2026-10-15' });
  assert.equal(badMonth.status, 'incomplete');
  assert.ok(badMonth.reasons.includes('bill-month-invalid'));
  const noPrice = buildPackageChangePreview({
    customerId: 'cust-1', currentPackage: '10 Mbps', proposedPackage: '20 Mbps',
    billMonth: '2026-11', effectiveDate: '2026-10-15',
  });
  assert.equal(noPrice.status, 'incomplete');
  assert.ok(noPrice.reasons.includes('current-price-missing'));
  assert.ok(noPrice.reasons.includes('proposed-price-missing'));
  assert.equal(packageChangePreviewNote(noPrice), null);
  assert.match(packageChangePreviewSummaryText(noPrice), /incomplete/);
});

test('summary text names both packages, difference, date and estimate', () => {
  const preview = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-16' });
  const summary = packageChangePreviewSummaryText(preview);
  assert.match(summary, /10 Mbps \(PKR 1000\) → 20 Mbps \(PKR 2000\)/);
  assert.match(summary, /monthly difference PKR 1000/);
  assert.match(summary, /effective 2026-11-16/);
  assert.match(summary, /next bill 2026-11 estimated PKR 1500/);
  assert.match(summary, /upgrade/);
});

test('preview note attaches only to the matching change, inputs never mutated', () => {
  const preview = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-16' });
  const change = { date: '2026-11-16', oldPackage: '10 Mbps', newPackage: '20 Mbps', oldMonthlyRate: 1000, newMonthlyRate: 2000 };
  const before = JSON.stringify(change);
  const attached = attachPreviewNoteToChange(change, preview);
  assert.equal(JSON.stringify(change), before);
  assert.equal(attached.packageChangePreviewNote, packageChangePreviewSummaryText(preview));
  assert.equal(attached.newPackage, '20 Mbps');
  assert.equal(previewMatchesChange(preview, change), true);
  const other = { ...change, newPackage: '30 Mbps' };
  assert.equal(previewMatchesChange(preview, other), false);
  const untouched = attachPreviewNoteToChange(other, preview);
  assert.equal(untouched.packageChangePreviewNote, undefined);
  assert.equal(JSON.stringify(other), JSON.stringify({ ...change, newPackage: '30 Mbps' }));
});

test('incomplete preview never attaches a note', () => {
  const incomplete = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-02-30' });
  const change = { newPackage: '20 Mbps' };
  assert.equal(attachPreviewNoteToChange(change, incomplete).packageChangePreviewNote, undefined);
});

test('package objects and string prices resolve the same way', () => {
  const preview = buildPackageChangePreview({
    customerId: 'cust-1',
    currentPackage: { label: '10 Mbps', price: '1000' },
    proposedPackage: { label: '20 Mbps', price: '2000' },
    billMonth: '2026-11',
    effectiveDate: '2026-10-15',
  });
  assert.equal(preview.status, 'ready');
  assert.equal(preview.estimatedNextBill, 2000);
  assert.equal(preview.currentPackage, '10 Mbps');
});

test('input object is never mutated by building a preview', () => {
  const input = { ...BASE, effectiveDate: '2026-11-16', priceHistory: [{ packageKey: '20 Mbps', amount: 1900, effectiveDate: '2026-10-01' }] };
  const before = JSON.stringify(input);
  buildPackageChangePreview(input);
  assert.equal(JSON.stringify(input), before);
});

test('preview store: only ready previews recorded, one per customer, removable', () => {
  const ready = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-16' });
  const incomplete = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-02-30' });
  let list = recordPackageChangePreview([], incomplete);
  assert.equal(list.length, 0);
  list = recordPackageChangePreview(list, ready);
  assert.equal(list.length, 1);
  assert.equal(findPackageChangePreview(list, 'cust-1').estimatedNextBill, 1500);
  const newer = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-21' });
  list = recordPackageChangePreview(list, newer);
  assert.equal(list.length, 1);
  assert.equal(findPackageChangePreview(list, 'cust-1').estimatedNextBill, 1333.34);
  assert.equal(findPackageChangePreview(list, 'nobody'), null);
  list = removePackageChangePreview(list, 'cust-1');
  assert.equal(list.length, 0);
  assert.match(packageChangePreviewStoredText(ready), /20 Mbps from 2026-11-16/);
  assert.match(packageChangePreviewStoredText(null), /No package change preview/);
});

test('html escapes labels and states the preview-only fence', () => {
  const preview = buildPackageChangePreview({
    ...BASE, proposedPackage: '<script>alert(1)</script>', effectiveDate: '2026-10-15',
  });
  const html = packageChangePreviewHtml(preview, (amount) => `PKR ${amount}`);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Preview only — no package, bill, or lifecycle record has changed/);
  const incomplete = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-02-30' });
  assert.match(packageChangePreviewHtml(incomplete), /Preview incomplete/);
});

test('csv and filename helpers', () => {
  const preview = buildPackageChangePreview({ ...BASE, effectiveDate: '2026-11-16' });
  const csv = packageChangePreviewCsv(preview);
  assert.match(csv, /^customer,current_package,current_price,proposed_package,proposed_price,monthly_difference,effective_date,bill_month,estimated_next_bill\n/);
  assert.match(csv, /10 Mbps,1000,20 Mbps,2000,1000,2026-11-16,2026-11,1500/);
  assert.equal(packageChangePreviewFilename(), 'package-change-preview.csv');
});
