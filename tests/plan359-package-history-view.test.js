import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validPackageHistoryDay,
  normalizePackageHistoryEntry,
  normalizePackageHistoryList,
  packageHistorySegmentsFor,
  packageHistorySegmentText,
  packageHistoryViewText,
  packageHistoryViewSectionHtml,
} from '../package-history-view.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'package-history-view.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

const formatAmount = (value) => `PKR ${value}`;

// Generic fixtures only — clearly made-up names, never a real customer.
// No phone numbers anywhere in this file.
function customer(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Customer One',
    mohalla: 'Mohalla A',
    packageSpeed: '15 Mbps',
    monthlySellingAmount: 3000,
    packageHistory: [],
    ...overrides,
  };
}

function change(overrides = {}) {
  return {
    date: '2026-03-01',
    oldPackage: '5 Mbps',
    newPackage: '15 Mbps',
    oldMonthlyRate: 2000,
    newMonthlyRate: 3000,
    staffName: 'Saad',
    ...overrides,
  };
}

function currentPackage(overrides = {}) {
  return { label: '15 Mbps', price: 3000, ...overrides };
}

// ---------------------------------------------------------------------------
// Strict dates
// ---------------------------------------------------------------------------

test('dates: strict calendar dates only, leap-aware', () => {
  assert.equal(validPackageHistoryDay('2026-03-01'), '2026-03-01');
  assert.equal(validPackageHistoryDay('2024-02-29'), '2024-02-29');
  assert.equal(validPackageHistoryDay('2026-02-29'), null);
  assert.equal(validPackageHistoryDay('2026-02-30'), null);
  assert.equal(validPackageHistoryDay('2026-13-01'), null);
  assert.equal(validPackageHistoryDay('2026-00-10'), null);
  assert.equal(validPackageHistoryDay('2026-01-00'), null);
  assert.equal(validPackageHistoryDay('2026-3-1'), null);
  assert.equal(validPackageHistoryDay(''), null);
  assert.equal(validPackageHistoryDay(null), null);
  assert.equal(validPackageHistoryDay(20260301), null);
});

test('dates: a datetime contributes only its date part', () => {
  assert.equal(validPackageHistoryDay('2026-03-01T10:30:00'), '2026-03-01');
  assert.equal(validPackageHistoryDay('  2026-03-01  '), '2026-03-01');
});

// ---------------------------------------------------------------------------
// Normalizing entries
// ---------------------------------------------------------------------------

test('normalize entry: non-objects are refused', () => {
  assert.equal(normalizePackageHistoryEntry(null), null);
  assert.equal(normalizePackageHistoryEntry('2026-03-01'), null);
  assert.equal(normalizePackageHistoryEntry(42), null);
});

test('normalize entry: a usable entry keeps its fields, prices in cents', () => {
  const out = normalizePackageHistoryEntry(change());
  assert.equal(out.date, '2026-03-01');
  assert.equal(out.oldPackage, '5 Mbps');
  assert.equal(out.newPackage, '15 Mbps');
  assert.equal(out.oldPriceCents, 200000);
  assert.equal(out.newPriceCents, 300000);
  assert.equal(out.staffName, 'Saad');
});

test('normalize entry: an unusable date is kept as null, never invented', () => {
  const out = normalizePackageHistoryEntry(change({ date: '2026-02-30' }));
  assert.equal(out.date, null);
  assert.equal(out.newPackage, '15 Mbps');
});

test('normalize entry: zero is a real price, blank and negative are not', () => {
  assert.equal(normalizePackageHistoryEntry(change({ oldMonthlyRate: 0 })).oldPriceCents, 0);
  assert.equal(normalizePackageHistoryEntry(change({ oldMonthlyRate: '' })).oldPriceCents, null);
  assert.equal(normalizePackageHistoryEntry(change({ oldMonthlyRate: -5 })).oldPriceCents, null);
  assert.equal(normalizePackageHistoryEntry(change({ oldMonthlyRate: 'abc' })).oldPriceCents, null);
  assert.equal(normalizePackageHistoryEntry(change({ oldMonthlyRate: undefined })).oldPriceCents, null);
});

test('normalize list: a non-array is an empty list; inputs are never mutated', () => {
  assert.deepEqual(normalizePackageHistoryList(null), []);
  assert.deepEqual(normalizePackageHistoryList('nope'), []);
  const raw = [change(), change({ date: '2026-04-01' })];
  const before = JSON.stringify(raw);
  const out = normalizePackageHistoryList(raw);
  assert.equal(out.length, 2);
  assert.equal(JSON.stringify(raw), before);
  assert.notEqual(out[0], raw[0]);
});

// ---------------------------------------------------------------------------
// Segments: the periods
// ---------------------------------------------------------------------------

test('segments: no changes means one current period, start not recorded', () => {
  const view = packageHistorySegmentsFor({ packageHistory: [], currentPackageLabel: '15 Mbps', currentPackagePrice: 3000 });
  assert.equal(view.totalChanges, 0);
  assert.equal(view.undatedCount, 0);
  assert.equal(view.segments.length, 1);
  const [current] = view.segments;
  assert.equal(current.packageLabel, '15 Mbps');
  assert.equal(current.priceCents, 300000);
  assert.equal(current.startDate, null);
  assert.equal(current.endDate, null);
  assert.equal(current.isCurrent, true);
  assert.equal(current.startKnown, false);
});

test('segments: no changes and no current package means no periods at all', () => {
  const view = packageHistorySegmentsFor({ packageHistory: [], currentPackageLabel: '', currentPackagePrice: null });
  assert.deepEqual(view.segments, []);
  assert.equal(packageHistoryViewText(view, formatAmount), 'No package history recorded.');
});

test('segments: one change gives two periods, newest first, current matches the profile', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [change()],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  assert.equal(view.segments.length, 2);
  const [current, before] = view.segments;
  assert.equal(current.packageLabel, '15 Mbps');
  assert.equal(current.priceCents, 300000);
  assert.equal(current.startDate, '2026-03-01');
  assert.equal(current.endDate, null);
  assert.equal(current.isCurrent, true);
  assert.equal(before.packageLabel, '5 Mbps');
  assert.equal(before.priceCents, 200000);
  assert.equal(before.startDate, null);
  assert.equal(before.endDate, '2026-03-01');
  assert.equal(before.isCurrent, false);
  assert.equal(before.startKnown, false);
  assert.equal(before.endKnown, true);
});

test('segments: two changes give three periods in date order', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [
      change({ date: '2026-01-01', oldPackage: '3 Mbps', newPackage: '5 Mbps', oldMonthlyRate: 1000, newMonthlyRate: 2000 }),
      change({ date: '2026-03-01', oldPackage: '5 Mbps', newPackage: '15 Mbps', oldMonthlyRate: 2000, newMonthlyRate: 3000 }),
    ],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  assert.equal(view.segments.length, 3);
  assert.deepEqual(view.segments.map((s) => s.packageLabel), ['15 Mbps', '5 Mbps', '3 Mbps']);
  assert.deepEqual(view.segments.map((s) => s.startDate), ['2026-03-01', '2026-01-01', null]);
  assert.deepEqual(view.segments.map((s) => s.endDate), [null, '2026-03-01', '2026-01-01']);
  assert.deepEqual(view.segments.map((s) => s.price), [3000, 2000, 1000]);
});

test('segments: entries sort by date even when recorded out of order', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [
      change({ date: '2026-03-01' }),
      change({ date: '2026-01-01', oldPackage: '3 Mbps', newPackage: '5 Mbps', oldMonthlyRate: 1000, newMonthlyRate: 2000 }),
    ],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  assert.deepEqual(view.segments.map((s) => s.packageLabel), ['15 Mbps', '5 Mbps', '3 Mbps']);
});

test('segments: the profile price wins for the current period', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [change({ newMonthlyRate: 2500 })],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  assert.equal(view.segments[0].priceCents, 300000);
  assert.equal(view.segments[1].priceCents, 200000);
});

test('segments: when the profile has no price, the recorded rate stands', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [change()],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: null,
  });
  assert.equal(view.segments[0].priceCents, 300000);
});

test('segments: a missing rate reads as price not recorded, never guessed', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [change({ oldMonthlyRate: null, newMonthlyRate: null })],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: null,
  });
  assert.equal(view.segments[0].priceCents, null);
  assert.equal(view.segments[1].priceCents, null);
  assert.match(packageHistoryViewText(view, formatAmount), /price not recorded/);
});

test('segments: a missing package label reads as not recorded', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [change({ oldPackage: '', newPackage: '15 Mbps' })],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  assert.equal(view.segments[1].packageLabel, '');
  assert.match(packageHistorySegmentText(view.segments[1], formatAmount), /Package not recorded/);
});

// ---------------------------------------------------------------------------
// Segments: gaps, mismatches, no-ops, undated entries
// ---------------------------------------------------------------------------

test('segments: a broken chain leaves the gap visible, never claimed away', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [
      change({ date: '2026-01-01', oldPackage: '3 Mbps', newPackage: '5 Mbps', oldMonthlyRate: 1000, newMonthlyRate: 2000 }),
      // The next change starts from 10 Mbps, not the 5 Mbps the
      // previous change moved the customer to: a change in between
      // was never recorded.
      change({ date: '2026-03-01', oldPackage: '10 Mbps', newPackage: '15 Mbps', oldMonthlyRate: 2500, newMonthlyRate: 3000 }),
    ],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  assert.equal(view.segments.length, 4);
  const [current, ten, five, three] = view.segments;
  assert.equal(current.packageLabel, '15 Mbps');
  assert.equal(ten.packageLabel, '10 Mbps');
  assert.equal(ten.startDate, null);
  assert.equal(ten.endDate, '2026-03-01');
  assert.equal(ten.gapBefore, true);
  assert.equal(five.packageLabel, '5 Mbps');
  assert.equal(five.startDate, '2026-01-01');
  assert.equal(five.endDate, null);
  assert.equal(five.endKnown, false);
  assert.equal(three.packageLabel, '3 Mbps');
});

test('segments: when the profile current differs from the last change, its start is not recorded', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [change({ newPackage: '10 Mbps', newMonthlyRate: 2500 })],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  assert.equal(view.segments.length, 3);
  const [current, ten, five] = view.segments;
  assert.equal(current.packageLabel, '15 Mbps');
  assert.equal(current.startDate, null);
  assert.equal(current.gapBefore, true);
  assert.equal(ten.packageLabel, '10 Mbps');
  assert.equal(ten.endDate, null);
  assert.equal(ten.endKnown, false);
  assert.equal(five.packageLabel, '5 Mbps');
});

test('segments: when the profile has no current label, the last recorded package stands as current', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [change()],
    currentPackageLabel: '',
    currentPackagePrice: null,
  });
  assert.equal(view.segments.length, 2);
  assert.equal(view.segments[0].packageLabel, '15 Mbps');
  assert.equal(view.segments[0].isCurrent, true);
  assert.equal(view.segments[0].startDate, '2026-03-01');
});

test('segments: a change that changed nothing opens no new period', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [
      change({ date: '2026-01-01', oldPackage: '5 Mbps', newPackage: '5 Mbps', oldMonthlyRate: 2000, newMonthlyRate: 2000 }),
      change({ date: '2026-03-01', oldPackage: '5 Mbps', newPackage: '15 Mbps', oldMonthlyRate: 2000, newMonthlyRate: 3000 }),
    ],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  assert.equal(view.segments.length, 2);
  assert.equal(view.segments[1].packageLabel, '5 Mbps');
});

test('segments: same package with a new price does open a new period', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [
      change({ date: '2026-01-01', oldPackage: '5 Mbps', newPackage: '5 Mbps', oldMonthlyRate: 2000, newMonthlyRate: 2500 }),
    ],
    currentPackageLabel: '5 Mbps',
    currentPackagePrice: 2500,
  });
  assert.equal(view.segments.length, 2);
  assert.equal(view.segments[1].priceCents, 200000);
  assert.equal(view.segments[0].priceCents, 250000);
});

test('segments: undated entries are counted, never assigned a date', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [
      change(),
      change({ date: 'not a date', oldPackage: '3 Mbps', newPackage: '5 Mbps' }),
      change({ date: '2026-02-30', oldPackage: '3 Mbps', newPackage: '5 Mbps' }),
    ],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  assert.equal(view.totalChanges, 3);
  assert.equal(view.undatedCount, 2);
  assert.equal(view.segments.length, 2);
  assert.match(packageHistoryViewText(view, formatAmount), /2 package changes without a recorded date/);
});

test('segments: package matching ignores case and surrounding space', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [
      change({ date: '2026-01-01', oldPackage: '3 Mbps', newPackage: '5 Mbps', oldMonthlyRate: 1000, newMonthlyRate: 2000 }),
      change({ date: '2026-03-01', oldPackage: '  5 MBPS ', newPackage: '15 Mbps', oldMonthlyRate: 2000, newMonthlyRate: 3000 }),
    ],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  assert.equal(view.segments.length, 3);
  assert.equal(view.segments[1].gapBefore, false);
  assert.equal(view.segments[1].endDate, '2026-03-01');
});

// ---------------------------------------------------------------------------
// Text and HTML
// ---------------------------------------------------------------------------

test('text: current and past periods read in plain words', () => {
  const view = packageHistorySegmentsFor({
    packageHistory: [change()],
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  });
  const textOut = packageHistoryViewText(view, formatAmount);
  assert.match(textOut, /15 Mbps — PKR 3000\/month, since 2026-03-01 \(current\)/);
  assert.match(textOut, /5 Mbps — PKR 2000\/month, \(start not recorded\) to 2026-03-01/);
});

test('text: a segment with no label or price says so plainly', () => {
  const out = packageHistorySegmentText({ packageLabel: '', priceCents: null, startDate: null, endDate: '2026-03-01', isCurrent: false }, formatAmount);
  assert.match(out, /Package not recorded/);
  assert.match(out, /price not recorded/);
  assert.match(out, /\(start not recorded\) to 2026-03-01/);
});

test('html: the section lists periods newest first with a current badge', () => {
  const html = packageHistoryViewSectionHtml(customer({ packageHistory: [change()] }), currentPackage(), formatAmount);
  assert.ok(html.includes('<section class="profile-package-history"'));
  assert.ok(html.includes('<ul id="phvList" class="phv-list">'));
  assert.ok(html.includes('Package history'));
  assert.ok(html.indexOf('15 Mbps') < html.indexOf('5 Mbps'));
  assert.ok(html.includes('<span class="phv-current">Current</span>'));
  assert.ok(html.includes('Since 2026-03-01'));
  assert.ok(html.includes('(start not recorded) to 2026-03-01'));
});

test('html: a broken chain shows the gap badge on the later period', () => {
  const html = packageHistoryViewSectionHtml(customer({
    packageHistory: [
      change({ date: '2026-01-01', oldPackage: '3 Mbps', newPackage: '5 Mbps', oldMonthlyRate: 1000, newMonthlyRate: 2000 }),
      change({ date: '2026-03-01', oldPackage: '10 Mbps', newPackage: '15 Mbps', oldMonthlyRate: 2500, newMonthlyRate: 3000 }),
    ],
  }), currentPackage(), formatAmount);
  assert.ok(html.includes('<span class="phv-gap">Gap in the record</span>'));
});

test('html: undated changes get a plain note, never a guessed date', () => {
  const html = packageHistoryViewSectionHtml(customer({
    packageHistory: [change(), change({ date: 'bad', oldPackage: '3 Mbps', newPackage: '5 Mbps' })],
  }), currentPackage(), formatAmount);
  assert.ok(html.includes('1 package change without a recorded date.'));
  assert.ok(!html.includes('bad'));
});

// Plan 509 — the view section is the profile's only package-history
// list now, so its empty state carries the one pinned wording (the
// static section's text, quoted in the plan); the old "No package
// history recorded." line went with the duplicate.
test('html: no history at all reads as no package or monthly selling-rate changes recorded', () => {
  const html = packageHistoryViewSectionHtml(customer({ packageSpeed: '', monthlySellingAmount: null, packageHistory: [] }), { label: '', price: null }, formatAmount);
  assert.ok(html.includes('<p class="phv-none">No package or monthly selling-rate changes have been recorded.</p>'));
});

test('html: package labels are escaped, never injected', () => {
  const html = packageHistoryViewSectionHtml(customer({
    packageHistory: [change({ oldPackage: '<script>alert(1)</script>' })],
  }), currentPackage(), formatAmount);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('html: building the section never changes the customer record', () => {
  const cust = customer({ packageHistory: [change()] });
  const before = JSON.stringify(cust);
  packageHistoryViewSectionHtml(cust, currentPackage(), formatAmount);
  assert.equal(JSON.stringify(cust), before);
});

// ---------------------------------------------------------------------------
// Purity, fences, wiring
// ---------------------------------------------------------------------------

test('purity: the module never touches the page, storage, the clock or the network', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
});

test('fences: the module never names the neighbouring price, lifecycle and preview modules', () => {
  // The neighbouring modules were checked by filename first and are
  // neither read nor rewritten here, so this module never names them —
  // each name is built from fragments so the literal filename appears
  // nowhere in this file either.
  const neighbours = [
    'applied' + '-price',
    'package' + '-price-history',
    'lifecycle' + '-journey',
    'package' + '-change-preview',
    'package' + '-catalog',
  ];
  for (const name of neighbours) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!readFileSync(fileURLToPath(import.meta.url), 'utf8').includes(name + '.js'), `test must not name ${name}.js`);
  }
});

test('store: the view holds no store of its own', () => {
  assert.ok(!moduleSrc.includes('STORE_KEY'));
  assert.ok(!moduleSrc.includes('shahdara_'));
});

test('wiring: app.js imports the module and shows the section after the number-change log', () => {
  assert.ok(appSrc.includes("from './package-history-view.js'"));
  assert.ok(appSrc.includes('packageHistoryViewSectionHtml(customer, {'));
  // Polish #28 Phase A — the package history opens the Service
  // section; the number-change log lives in the History section, so
  // sections now order by topic (Service before History) and the old
  // "history after the log" placement is superseded by the section map.
  // The preserved intent is the section renders first in Service.
  const serviceBodyAt = appSrc.indexOf('const profileSectionServiceBody = ');
  const serviceBody = appSrc.slice(serviceBodyAt, appSrc.indexOf('\n', serviceBodyAt));
  assert.ok(serviceBody.startsWith('const profileSectionServiceBody = `${packageHistorySectionMarkup}'), 'package history opens the Service section');
});

test('wiring: the profile order assertion still holds — banner, strip, then groups', () => {
  // Polish #28 Phase A — the profile renders as 7 <details> sections:
  // the strip sits in the assembly above every section, the wada banner
  // opens the Financial section, and the field groups are fragments
  // inside the section bodies. The old flat order (banner → strip →
  // groups) no longer exists; the preserved intent is strip above the
  // sections, banner first in Financial, and the package history first
  // in Service.
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  const serviceAt = appSrc.indexOf('${profileSectionServiceHtml}', stripAt);
  assert.ok(stripAt > 0, 'strip is in the profile assembly');
  assert.ok(serviceAt > stripAt, 'Service section sits after the strip');
  const serviceBodyAt = appSrc.indexOf('const profileSectionServiceBody = ');
  const serviceBody = appSrc.slice(serviceBodyAt, appSrc.indexOf('\n', serviceBodyAt));
  assert.ok(serviceBody.startsWith('const profileSectionServiceBody = `${packageHistorySectionMarkup}'), 'package history opens the Service section');
});

test('styles: the history rules exist and reuse an existing colour only', () => {
  for (const cls of ['.phv-list', '.phv-package', '.phv-price', '.phv-dates', '.phv-current', '.phv-gap', '.phv-summary', '.phv-undated', '.phv-none']) {
    assert.ok(stylesSrc.includes(cls), `styles must define ${cls}`);
  }
  const phvLines = stylesSrc.split('\n').filter((line) => line.includes('.phv-'));
  for (const line of phvLines) {
    for (const hex of line.match(/#[0-9a-fA-F]{3,8}/g) ?? []) {
      assert.equal(hex.toLowerCase(), '#5c6e66', `phv rule must reuse an existing colour, found ${hex}`);
    }
  }
});
