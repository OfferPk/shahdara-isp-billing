import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';
import {
  packageHistorySegmentsFor,
  packageHistoryViewSectionHtml,
} from '../package-history-view.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const app = read('app.js');
const index = read('index.html');

const formatAmount = (value) => `PKR ${value}`;

// Plan 509 — Package history renders once: the profile rendered the
// same package history twice — the view section
// (packageHistoryViewSectionHtml, Plan 359) inside
// #customerProfileView, and the static section (#packageHistoryList,
// populated in renderDetail) mounted into the Info panel below it.
// Both were populated on every renderDetail pass, so a package change
// showed up in two lists that read as if two different histories
// existed. The fix keeps the view section (the purpose-built period
// view, with gap detection and the Current badge) and removes the
// static section, its populate code, its mount claim and its nine
// prof_pkghist_* keys. The surviving list's empty state carries the
// one pinned wording from the plan.
//
// Boundaries, stated plainly: the recorded entries stay on the
// customer record — only their second rendering is gone, so the save
// flow that appends entries is untouched. The per-change pro-rata
// bill/adjustment, staff name and preview note that only the static
// list showed no longer render on the profile (the pending-change
// pro-rata preview in the edit form is untouched). In edit mode the
// static block no longer shows either — it lived outside the form —
// so the view's history is the single source when viewing. The
// .package-history-section / .package-history-list CSS rules are left
// in place, unreferenced (Plan 506/507 precedent: editing shared
// selector lists for zero user-visible benefit). The text-summary
// fallback in packageHistoryViewText ('No package history recorded.')
// is untouched — it never renders as the list's empty state (the
// summary paragraph only renders when segments exist). No new
// element-id prefix, store key, hex colour or i18n key.
//
// Generic fixtures only — clearly made-up names, never a real
// customer. No phone numbers anywhere in this file.
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

function infoViewTemplate() {
  const start = app.indexOf("$('#customerProfileView').innerHTML = `");
  assert.notEqual(start, -1, '#customerProfileView innerHTML assignment must exist');
  const end = app.indexOf('`;', start);
  assert.notEqual(end, -1, 'innerHTML template must close');
  // Polish #28 Phase A — the Info view renders as 7 <details> sections:
  // the assembly line carries only the heading + section shells, and
  // each section's items live in its body const. The Info view's full
  // render is the assembly plus the seven bodies.
  const bodies = ['Customer', 'Service', 'Financial', 'Connection', 'Network', 'Hardware', 'History']
    .map((name) => {
      const at = app.indexOf(`const profileSection${name}Body = `);
      assert.notEqual(at, -1, `${name} section body must exist`);
      return app.slice(at, app.indexOf('\n', at));
    })
    .join('\n');
  return `${app.slice(start, end)}\n${bodies}`;
}

const DEAD_PKG_HIST_KEYS = [
  'prof_pkghist_eyebrow',
  'prof_pkghist_heading',
  'prof_pkghist_note',
  'prof_pkghist_empty',
  'prof_pkghist_row',
  'prof_pkghist_not_calc',
  'prof_pkghist_prorata',
  'prof_pkghist_prorata_adj',
  'prof_pkghist_date_norec',
];

test('Plan 509: the view section is still the profile package-history list, rendered once', () => {
  assert.ok(app.includes("from './package-history-view.js'"),
    'app.js must still import the package-history view module');
  assert.ok(app.includes('packageHistoryViewSectionHtml(customer, {'),
    'the view must still build its history section from the module');
  const template = infoViewTemplate();
  const hits = template.split('${packageHistorySectionMarkup}').length - 1;
  assert.equal(hits, 1, 'the view template must interpolate the history section exactly once');
});

test('Plan 509: the static section is gone from index.html', () => {
  assert.ok(!index.includes('packageHistoryList'), 'no #packageHistoryList in index.html');
  assert.ok(!index.includes('packageHistoryEmpty'), 'no #packageHistoryEmpty in index.html');
  assert.ok(!index.includes('package-history-section'), 'no .package-history-section in index.html');
  assert.ok(!index.includes('package-history-list'), 'no .package-history-list in index.html');
  assert.ok(!index.includes('prof_pkghist_'), 'no prof_pkghist_ data-i18n key in index.html');
});

test('Plan 509: the mount group no longer claims the static section', () => {
  assert.ok(!app.includes("'.package-history-section'"),
    'no mount group may claim the removed static section');
  assert.ok(app.includes("info:['.customer-meta','.uptime-section','.profile-danger-zone']"),
    'the info group must still mount the view, uptime and danger zone');
});

test('Plan 509: renderDetail no longer populates the static list', () => {
  assert.ok(!app.includes("$('#packageHistoryList')"),
    'nothing may write into the removed #packageHistoryList');
  assert.ok(!app.includes("$('#packageHistoryEmpty')"),
    'nothing may toggle the removed #packageHistoryEmpty');
  assert.ok(!app.includes('packageHistoryList'), 'no reference to the static list id may remain in app.js');
});

test('Plan 509: the nine dead prof_pkghist_* keys are gone from both dictionaries', () => {
  for (const key of DEAD_PKG_HIST_KEYS) {
    assert.ok(!(key in TRANSLATIONS.en), `${key} must be gone from the EN dictionary`);
    assert.ok(!(key in TRANSLATIONS.ur), `${key} must be gone from the UR dictionary`);
  }
  // The keys are gone from the shipped source too, not just the export.
  const lang = read('nav-language.js');
  for (const key of DEAD_PKG_HIST_KEYS) {
    assert.ok(!lang.includes(key), `${key} must not appear in nav-language.js`);
  }
});

test('Plan 509: the surviving empty state is the pinned wording, exactly once', () => {
  const html = packageHistoryViewSectionHtml(
    customer({ packageSpeed: '', monthlySellingAmount: null, packageHistory: [] }),
    { label: '', price: null },
    formatAmount,
  );
  const pinned = '<p class="phv-none">No package or monthly selling-rate changes have been recorded.</p>';
  const hits = html.split(pinned).length - 1;
  assert.equal(hits, 1, 'the pinned empty state must appear exactly once');
  assert.ok(!html.includes('<ul id="phvList"'), 'no list element when there is no history');
  assert.ok(!html.includes('No package history recorded.'),
    'the old empty-state wording must not survive in the rendered list');
});

test('Plan 509: one list per profile — a package change renders in exactly one list', () => {
  const history = [
    change({ date: '2026-01-01', oldPackage: '3 Mbps', newPackage: '5 Mbps', oldMonthlyRate: 1000, newMonthlyRate: 2000 }),
    change(),
  ];
  const html = packageHistoryViewSectionHtml(
    customer({ packageHistory: history }),
    currentPackage(),
    formatAmount,
  );
  assert.equal(html.split('<section class="profile-package-history"').length - 1, 1,
    'exactly one package-history section');
  assert.equal(html.split('<ul id="phvList"').length - 1, 1, 'exactly one list in the section');
  const ulStart = html.indexOf('<ul id="phvList"');
  const ulEnd = html.indexOf('</ul>', ulStart);
  const ul = html.slice(ulStart, ulEnd);
  const segments = packageHistorySegmentsFor({
    packageHistory: history,
    currentPackageLabel: '15 Mbps',
    currentPackagePrice: 3000,
  }).segments;
  assert.equal(ul.split('<li>').length - 1, segments.length,
    'one row per period, no duplicated change rows');
  // And nowhere else in the profile is there a second list for it.
  assert.equal(app.split('packageHistoryList').length - 1, 0, 'no second list id in app.js');
  assert.equal(index.split('packageHistoryList').length - 1, 0, 'no second list id in index.html');
});

test('Plan 509: money in the surviving list is PKR only', () => {
  const html = packageHistoryViewSectionHtml(
    customer({ packageHistory: [change()] }),
    currentPackage(),
    formatAmount,
  );
  assert.ok(html.includes('PKR 3000'), 'the current price reads in PKR');
  assert.ok(!html.includes('USD'), 'no USD anywhere in the list');
  assert.ok(!html.includes('EUR'), 'no EUR anywhere in the list');
});
