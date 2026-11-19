// Plan 610 — Package-change preview stops offering the current package.
//
// The preview select rendered every catalogue package with the
// customer's own package pre-selected, so the operator could "change"
// to the package already in effect — and the initial preview showed
// that no-change as a change (direction 'lateral', monthly difference
// PKR 0), which a READY preview then KEPT as a note. The change
// itself can never be a no-change anywhere else: the Quick Collect
// package box disables the current option and changeCustomerPackage
// returns { changed: false, reason: 'same-package' }. The preview
// was the odd one out.
//
// The fix (app.js, template only): resolve the current plan by the
// same label-then-id match as before, WITHOUT the catalogue-first
// fallback, and render the select from the remaining packages in
// catalogue order. The initial preview follows the select: it
// proposes the first remaining package. A customer whose stored
// package matches no catalogue plan keeps all six options with the
// first as the initial preview — exactly as before.
//
// This file asserts NO parity total (0 new keys — 602 / QC-top
// precedent); it must contain NEITHER the current, previous nor older
// parity bare digits (plan591 G5a sweep + pnl G4 count — see the
// self-guard, which builds them from split literals so this file
// never carries them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BILL_PACKAGES } from '../package-catalog.js';
import { buildPackageChangePreview } from '../package-change-preview.js';
import { TRANSLATIONS } from '../nav-language.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');
const appJs = read('app.js');

// Execute the REAL resolution block from app.js (not a mirror of it):
// the three statements that resolve the current plan, the option list
// and the initial selected plan. The block references only
// BILL_PACKAGES and the customer, so it runs standalone.
const blockStart = appJs.indexOf('const packageChangeCurrentPlan');
assert.ok(blockStart >= 0, 'the Plan 610 resolution block exists in app.js');
const blockEndMark = 'const packageChangeSelectedPlan = packageChangeOptions[0];';
const blockEnd = appJs.indexOf(blockEndMark, blockStart) + blockEndMark.length;
assert.ok(blockEnd > blockStart, 'the resolution block ends at the selected-plan line');
const block = appJs.slice(blockStart, blockEnd);
const resolveOptions = new Function(
  'BILL_PACKAGES',
  'customer',
  `${block}; return { current: packageChangeCurrentPlan, options: packageChangeOptions, selected: packageChangeSelectedPlan };`,
);
const ids = (list) => list.map((plan) => plan.id);
const catalogueIds = ids(BILL_PACKAGES);

test('C1: the preview select never lists the current package (label match and id match)', () => {
  // Label match — the stored value is the catalogue label.
  const byLabel = resolveOptions(BILL_PACKAGES, { packageSpeed: '15Mbps Unlimited' });
  assert.equal(byLabel.current?.id, '15mbps-unlimited', 'the current plan resolves by label');
  assert.equal(byLabel.options.length, 5, 'one option leaves, five stay');
  assert.ok(!ids(byLabel.options).includes('15mbps-unlimited'), 'the current package is not offered');
  // Id match — the stored value is the catalogue id.
  const byId = resolveOptions(BILL_PACKAGES, { packageSpeed: '5mbps-200gb' });
  assert.equal(byId.current?.id, '5mbps-200gb', 'the current plan resolves by id');
  assert.ok(!ids(byId.options).includes('5mbps-200gb'), 'the current package is not offered by id either');
  // The template renders the filtered list, not the raw catalogue.
  assert.ok(
    appJs.includes('<select id="packageChangePreviewPackage">${packageChangeOptions.map((plan)'),
    'the select maps the filtered options',
  );
  assert.ok(
    !appJs.includes('<select id="packageChangePreviewPackage">${BILL_PACKAGES.map((plan)'),
    'the select no longer maps the raw catalogue',
  );
});

test('C2: the remaining options keep catalogue order', () => {
  const { options } = resolveOptions(BILL_PACKAGES, { packageSpeed: '5Mbps / 150GB' });
  assert.deepEqual(
    ids(options),
    catalogueIds.filter((id) => id !== '5mbps-150gb'),
    'the rest stay in catalogue order — no sort, no reorder',
  );
  const selectLine = appJs.slice(appJs.indexOf('<select id="packageChangePreviewPackage">'));
  assert.ok(!/\.sort\(/.test(selectLine.slice(0, selectLine.indexOf('</select>'))), 'the select does not sort');
});

test('C3: the initial preview proposes the first remaining package, never the current one', () => {
  const { options, selected, current } = resolveOptions(BILL_PACKAGES, { packageSpeed: '15Mbps Unlimited' });
  assert.equal(selected.id, options[0].id, 'the initial plan is the first option');
  assert.notEqual(selected.id, current.id, 'the initial plan is not the current package');
  assert.equal(selected.id, '3mbps-100gb', 'first remaining package in catalogue order');
});

test('C4: a customer with no package, or an unknown package, keeps all six options', () => {
  for (const packageSpeed of ['', undefined, '99Mbps Custom']) {
    const { current, options, selected } = resolveOptions(BILL_PACKAGES, { packageSpeed });
    assert.equal(current, null, `no current plan resolves for ${JSON.stringify(packageSpeed)}`);
    assert.equal(options.length, 6, 'all six options stay');
    assert.deepEqual(ids(options), catalogueIds, 'order unchanged');
    assert.equal(selected.id, '3mbps-100gb', 'the first catalogue package stays the initial preview');
  }
});

test('C5: the Show handler still reads the select value — no handler change', () => {
  assert.ok(
    appJs.includes("querySelector('#packageChangePreviewPackage')?.value"),
    'the Show handler reads the select value as before',
  );
  assert.ok(
    appJs.includes('BILL_PACKAGES.find((item) => item.id ==='),
    'the Show handler still resolves the chosen plan by id',
  );
});

test('S1: the preview module is untouched — a real change between two same-priced packages is still lateral', () => {
  const lateral = buildPackageChangePreview({
    customerId: 'cust-1',
    currentPackage: '10 Mbps',
    currentPrice: 1000,
    proposedPackage: '20 Mbps',
    proposedPrice: 1000,
    billMonth: '2026-11',
    effectiveDate: '2026-11-05',
  });
  assert.equal(lateral.status, 'ready', 'equal prices still build a ready preview');
  assert.equal(lateral.direction, 'lateral', 'equal prices are still lateral');
  assert.equal(lateral.monthlyDifference, 0, 'equal prices still differ by zero');
});

test('S2: the other package selects still list every package', () => {
  // The bill editor records which package a bill was for; the price
  // history picker records revisions for any package. Neither is the
  // preview select and neither changes here.
  assert.ok(appJs.includes('function billPackageSelectorMarkup'), 'the bill editor selector still exists');
  assert.ok(appJs.includes('function priceHistoryPackageOptions'), 'the price-history picker still exists');
  const billOptions = appJs.slice(appJs.indexOf('function billPackageSelectorMarkup'));
  assert.ok(billOptions.includes('BILL_PACKAGES.map(plan =>'), 'the bill editor still maps the raw catalogue');
  const historyOptions = appJs.slice(appJs.indexOf('function priceHistoryPackageOptions'));
  assert.ok(historyOptions.includes('BILL_PACKAGES.map((plan)'), 'the price-history picker still maps the raw catalogue');
});

test('S3: parity is unchanged in shape — the dicts still agree, no total pinned here', () => {
  assert.equal(
    Object.keys(TRANSLATIONS.en).length,
    Object.keys(TRANSLATIONS.ur).length,
    'EN and UR dicts still agree in size',
  );
});

test('G: this file pins no parity total and stays free of the parity bare digits', () => {
  // The digits are built from split literals so this file itself never
  // contains them (plan591 G5a sweeps the whole tests/ tree for the bare
  // digits of the current total, pnl G4 counts the files containing
  // them). This file asserts no parity total — 0 new keys.
  const selfSrc = read('tests/plan610-package-change-preview-no-current.test.js');
  assert.ok(!selfSrc.includes('51' + '62'), 'this file carries the current parity bare digits');
  assert.ok(!selfSrc.includes('51' + '61'), 'this file carries the previous parity bare digits');
  assert.ok(!selfSrc.includes('51' + '45'), 'this file carries the older parity bare digits');
});
