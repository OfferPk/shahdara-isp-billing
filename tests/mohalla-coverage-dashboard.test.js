import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COVERAGE_UNASSIGNED_KEY,
  buildCoverageRegister,
  coverageDashboardHtml,
} from '../coverage-register.js';
import { TRANSLATIONS } from '../nav-language.js';

// Mohalla coverage dashboard — the visual read-out on top of the Plan 27
// register. Fixtures copy tests/plan27-coverage-register.test.js exactly:
// plain objects, generic placeholders only. "Barrian 19/10" is the user's
// own worked example from the dashboard spec.

const customer = (id, mohalla, archived) => ({ id, name: id, mohalla, archived: archived ?? false });
const estimate = (mohalla, premises, date, basis) => ({ mohalla, premises, date, basis });

const barrian = () => {
  const customers = Array.from({ length: 10 }, (_, i) => customer(`b${i + 1}`, 'Barrian'));
  return buildCoverageRegister({ customers, estimates: [estimate('Barrian', 19)] });
};

test('row: Barrian 19/10 shows 52.6% covered, 47.4% remaining, 9 houses left', () => {
  const html = coverageDashboardHtml(barrian());
  assert.match(html, /Total houses: 19 · Grabbed houses: 10/);
  assert.match(html, /<strong class="moh-cov-pct">52\.6%<\/strong>/);
  assert.match(html, /style="width:52\.6%"/);
  assert.match(html, /<span class="moh-cov-remaining">47\.4% remaining · 9 houses left<\/span>/);
  assert.match(html, /moh-cov-bar-fill/);
});

test('row: surveyed mohalla with 0 grabbed shows 0% and 100% remaining', () => {
  const reg = buildCoverageRegister({ customers: [], estimates: [estimate('Bani', 40)] });
  const html = coverageDashboardHtml(reg);
  assert.match(html, /Total houses: 40 · Grabbed houses: 0/);
  assert.match(html, /<strong class="moh-cov-pct">0%<\/strong>/);
  assert.match(html, /style="width:0\.0%"/);
  assert.match(html, /100% remaining · 40 houses left/);
});

test('row: 100% covered still shows the red line as 0% remaining', () => {
  const customers = Array.from({ length: 12 }, (_, i) => customer(`m${i + 1}`, 'Malla'));
  const reg = buildCoverageRegister({ customers, estimates: [estimate('Malla', 12)] });
  const html = coverageDashboardHtml(reg);
  assert.match(html, /<strong class="moh-cov-pct">100%<\/strong>/);
  assert.match(html, /style="width:100\.0%"/);
  assert.match(html, /<span class="moh-cov-remaining">0% remaining · 0 houses left<\/span>/);
});

test('row: grabbed above the estimate shows the true 150%, bar clamped to 100%, exceeded wording', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', 'Bani'), customer('c3', 'Bani')],
    estimates: [estimate('Bani', 2)],
  });
  const html = coverageDashboardHtml(reg);
  assert.match(html, /<strong class="moh-cov-pct">150%<\/strong>/);
  assert.match(html, /style="width:100\.0%"/);
  assert.match(html, /Estimate exceeded by 1 — re-survey the total/);
  assert.doesNotMatch(html, /-50%/);
  assert.doesNotMatch(html, /-1 houses left/);
});

test('row: unsurveyed mohalla shows Not surveyed with no bar and no %', () => {
  const reg = buildCoverageRegister({ customers: [customer('c1', 'Kishtii')], estimates: [] });
  const html = coverageDashboardHtml(reg);
  assert.match(html, /Total houses: Not surveyed · Grabbed houses: 1/);
  assert.match(html, /Not surveyed — enter the total in the register above\./);
  assert.doesNotMatch(html, /moh-cov-bar/);
  assert.doesNotMatch(html, /moh-cov-pct/);
  assert.doesNotMatch(html, /moh-cov-remaining/);
});

test('row: archived customers excluded, blank-mohalla customers land in Unassigned last', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', 'Bani', true), customer('c3', ''), customer('c4', null)],
    estimates: [estimate('Bani', 100)],
  });
  const html = coverageDashboardHtml(reg);
  assert.match(html, /Total houses: 100 · Grabbed houses: 1/);
  assert.match(html, /No mohalla recorded/);
  const unassigned = reg.rows.find((row) => row.key === COVERAGE_UNASSIGNED_KEY);
  assert.equal(unassigned.activeCount, 2);
  assert.ok(html.indexOf('Banii') < html.indexOf('Unassigned'));
  assert.ok(html.lastIndexOf('Unassigned') > html.lastIndexOf('Banii'));
});

test('row: area-only customer counts via the register fallback', () => {
  const reg = buildCoverageRegister({
    customers: [{ id: 'c1', name: 'A', area: 'MOHALLA BANI' }],
    estimates: [estimate('Bani', 100)],
  });
  const html = coverageDashboardHtml(reg);
  assert.match(html, /Total houses: 100 · Grabbed houses: 1/);
});

test('rounding: 1/3 is 33.3% covered and 66.7% remaining; 2/3 is 66.7% and 33.3%', () => {
  const oneThird = buildCoverageRegister({
    customers: [customer('c1', 'Bani')],
    estimates: [estimate('Bani', 3)],
  });
  const oneThirdHtml = coverageDashboardHtml(oneThird);
  assert.match(oneThirdHtml, /33\.3%/);
  assert.match(oneThirdHtml, /66\.7% remaining · 2 houses left/);
  const twoThirds = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', 'Bani')],
    estimates: [estimate('Bani', 3)],
  });
  const twoThirdsHtml = coverageDashboardHtml(twoThirds);
  assert.match(twoThirdsHtml, /66\.7%/);
  assert.match(twoThirdsHtml, /33\.3% remaining · 1 houses left/);
});

test('row: mohalla label with HTML is escaped, never rendered as markup', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', '<b>Malla</b>')],
    estimates: [estimate('Bani', 100)],
  });
  const html = coverageDashboardHtml(reg);
  assert.doesNotMatch(html, /<b>Malla<\/b>/);
  assert.match(html, /&lt;b&gt;malla&lt;\/B&gt;/);
});

test('row: register order preserved — labels A–Z, Unassigned last', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Malla'), customer('c2', 'Bani'), customer('c3', '')],
    estimates: [estimate('Malla', 12), estimate('Bani', 40)],
  });
  const html = coverageDashboardHtml(reg);
  assert.ok(html.indexOf('Banii') < html.indexOf('Malla'));
  assert.ok(html.indexOf('Malla') < html.indexOf('Unassigned'));
});

test('village: sums surveyed mohallas only — 71 total, 47 grabbed, 24 left, 66.2% / 33.8%', () => {
  const customers = [
    ...Array.from({ length: 10 }, (_, i) => customer(`bar${i + 1}`, 'Barrian')),
    ...Array.from({ length: 25 }, (_, i) => customer(`ban${i + 1}`, 'Bani')),
    ...Array.from({ length: 12 }, (_, i) => customer(`mal${i + 1}`, 'Malla')),
    ...Array.from({ length: 4 }, (_, i) => customer(`kis${i + 1}`, 'Kishtii')),
  ];
  const reg = buildCoverageRegister({
    customers,
    estimates: [estimate('Barrian', 19), estimate('Bani', 40), estimate('Malla', 12)],
  });
  const html = coverageDashboardHtml(reg);
  // Kishtii's 4 customers contribute nothing to any village figure.
  assert.match(html, /Whole village/);
  assert.match(html, /Total houses: 71 · Grabbed houses: 47/);
  assert.match(html, /<strong class="moh-cov-pct">66\.2%<\/strong>/);
  assert.match(html, /33\.8% remaining · 24 houses left/);
  assert.match(html, /3 of 4 mohallas surveyed — totals cover surveyed mohallas only\./);
});

test('village: Unassigned customers never reach the village grabbed figure', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', 'Bani'), customer('c3', '')],
    estimates: [estimate('Bani', 100)],
  });
  assert.equal(reg.totalActive, 3);
  const html = coverageDashboardHtml(reg);
  assert.match(html, /Total houses: 100 · Grabbed houses: 2/);
  assert.match(html, /98% remaining · 98 houses left/);
});

test('village: zero surveyed shows the no-survey text, no bar, no 0%', () => {
  const reg = buildCoverageRegister({ customers: [customer('c1', 'Bani')], estimates: [] });
  const html = coverageDashboardHtml(reg);
  assert.match(html, /No mohalla surveyed yet — add a premises estimate in the register above\./);
  assert.doesNotMatch(html, /moh-cov-bar/);
  assert.doesNotMatch(html, />0%</);
});

test('village: 100% covered village shows 0% remaining; 0% village shows 100% remaining', () => {
  const full = buildCoverageRegister({
    customers: Array.from({ length: 12 }, (_, i) => customer(`m${i + 1}`, 'Malla')),
    estimates: [estimate('Malla', 12)],
  });
  const fullHtml = coverageDashboardHtml(full);
  assert.match(fullHtml, /<strong class="moh-cov-pct">100%<\/strong>/);
  assert.match(fullHtml, /0% remaining · 0 houses left/);
  const empty = buildCoverageRegister({ customers: [], estimates: [estimate('Bani', 40)] });
  const emptyHtml = coverageDashboardHtml(empty);
  assert.match(emptyHtml, /<strong class="moh-cov-pct">0%<\/strong>/);
  assert.match(emptyHtml, /100% remaining · 40 houses left/);
});

test('village: grabbed above the village total shows the true % and exceeded wording', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', 'Bani'), customer('c3', 'Bani')],
    estimates: [estimate('Bani', 2)],
  });
  const html = coverageDashboardHtml(reg);
  const village = html.slice(0, html.indexOf('moh-cov-rows'));
  assert.match(village, /<strong class="moh-cov-pct">150%<\/strong>/);
  assert.match(village, /Estimate exceeded by 1 — re-survey the total/);
});

test('second connection: one customer record with a second-connection note counts as one house', () => {
  const secondConnectionCustomer = {
    id: 'c1', name: 'Customer A', mohalla: 'Bani',
    connection: 'Connection 2', secondConnectionName: 'Second connection',
  };
  const reg = buildCoverageRegister({
    customers: [secondConnectionCustomer],
    estimates: [estimate('Bani', 100)],
  });
  assert.equal(reg.rows[0].activeCount, 1);
  assert.equal(reg.surveyedActiveCount, 1);
  const html = coverageDashboardHtml(reg);
  assert.match(html, /Total houses: 100 · Grabbed houses: 1/);
});

test('empty register: no rows renders the no-survey text and no bar', () => {
  assert.match(coverageDashboardHtml({ rows: [] }), /No mohalla surveyed yet/);
  assert.match(coverageDashboardHtml(null), /No mohalla surveyed yet/);
  assert.doesNotMatch(coverageDashboardHtml({ rows: [] }), /moh-cov-bar/);
});

test('labels: defaults are English when no labels object is passed', () => {
  const html = coverageDashboardHtml(barrian());
  assert.match(html, /Whole village/);
  assert.match(html, /Total houses: 19 · Grabbed houses: 10/);
  assert.match(html, /47\.4% remaining · 9 houses left/);
});

test('labels: caller-supplied labels override the defaults', () => {
  const html = coverageDashboardHtml(barrian(), { village: 'Village total', remaining: '{pct}% left · {count} to go' });
  assert.match(html, /Village total/);
  assert.match(html, /47\.4% left · 9 to go/);
  assert.match(html, /Total houses: 19 · Grabbed houses: 10/);
});

test('labels: Urdu templates render Urdu wording with the same figures', () => {
  const urLabels = {
    village: TRANSLATIONS.ur.moh_cov_village,
    totalHouses: TRANSLATIONS.ur.moh_cov_total_houses,
    grabbed: TRANSLATIONS.ur.moh_cov_grabbed,
    remaining: TRANSLATIONS.ur.moh_cov_remaining,
    notSurveyed: TRANSLATIONS.ur.moh_cov_not_surveyed,
    notSurveyedNote: TRANSLATIONS.ur.moh_cov_not_surveyed_note,
    unassignedNote: TRANSLATIONS.ur.moh_cov_unassigned_note,
    surveyedCount: TRANSLATIONS.ur.moh_cov_surveyed_count,
    noSurvey: TRANSLATIONS.ur.moh_cov_no_survey,
    exceeded: TRANSLATIONS.ur.moh_cov_exceeded,
  };
  const html = coverageDashboardHtml(barrian(), urLabels);
  assert.match(html, /پورا گاؤں/);
  assert.match(html, /کل گھر: 19 · نیٹ لگے گھر: 10/);
  assert.match(html, /47\.4٪ باقی · 9 گھر باقی/);
});

const MOH_COV_KEYS = [
  'moh_cov_heading',
  'moh_cov_village',
  'moh_cov_total_houses',
  'moh_cov_grabbed',
  'moh_cov_remaining',
  'moh_cov_not_surveyed',
  'moh_cov_not_surveyed_note',
  'moh_cov_unassigned_note',
  'moh_cov_surveyed_count',
  'moh_cov_no_survey',
  'moh_cov_exceeded',
];

const placeholders = (str) => [...String(str).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('i18n: every moh_cov_ key exists in EN and UR with matching placeholders', () => {
  for (const key of MOH_COV_KEYS) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder mismatch for ${key}`);
  }
});

test('i18n: every Urdu moh_cov_ value carries Urdu script', () => {
  for (const key of MOH_COV_KEYS) {
    assert.match(TRANSLATIONS.ur[key], /[\u0600-\u06FF]/, `no Urdu script in ${key}`);
  }
});
