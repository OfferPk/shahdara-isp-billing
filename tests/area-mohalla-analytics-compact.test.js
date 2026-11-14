import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, calculatePaymentAllocations } from '../core.js';
import { calculateMohallaBars } from '../dashboard-mohalla-bars.js';
import { buildMohallaCardStats } from '../customer-search-filter.js';
import { canonicalMohalla, DEFAULT_MOHALLAS } from '../phase3.js';
import { sortMohallaNamesByNumberedOrder } from '../owner-insights.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  AREA_MODULE_TOP_N,
  areaChipMatches,
  sortAreaRowsByDueDesc,
  sliceAreaRows,
  buildAreaJumpOptions
} from '../area-analytics-module.js';

// Area & Mohalla Analytics compact module (Nov 2026): the four Home
// pieces — collection thermometer, per-mohalla bars, mohalla action
// cards, expansion calculator — live in ONE module in the Collect
// tab (three pill tabs, one dues chip row, a jump control, a Top-5
// slice with show-all). The pure view helpers live in
// area-analytics-module.js; the renderers live in app.js.

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const MONTH = '2026-11';

const readRepo = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('tabs: three pill tabs, three panels, and the wiring switches them', () => {
  const index = readRepo('index.html');
  assert.ok(index.includes('id="areaAnalyticsModule"'), 'module exists');
  for (const [tab, panel, key] of [
    ['areaAnalyticsTabProgressBtn', 'areaAnalyticsTabProgress', 'area_mod_tab_progress'],
    ['areaAnalyticsTabCardsBtn', 'areaAnalyticsTabCards', 'area_mod_tab_cards'],
    ['areaAnalyticsTabPlannerBtn', 'areaAnalyticsTabPlanner', 'area_mod_tab_planner']
  ]) {
    assert.ok(index.includes(`id="${tab}"`), `tab button ${tab} exists`);
    assert.ok(index.includes(`aria-controls="${panel}"`), `tab controls ${panel}`);
    assert.ok(index.includes(`data-i18n="${key}"`), `tab label ${key} is translated`);
    assert.ok(index.includes(`id="${panel}" role="tabpanel"`), `panel ${panel} exists`);
  }
  // The default tab is Progress & Dues.
  assert.ok(index.includes('id="areaAnalyticsTabProgressBtn" aria-controls="areaAnalyticsTabProgress" aria-pressed="true"'), 'progress tab starts pressed');
  assert.ok(index.includes('id="areaAnalyticsTabCards" role="tabpanel" aria-labelledby="areaAnalyticsTabCardsBtn" hidden'), 'cards panel starts hidden');
  assert.ok(index.includes('id="areaAnalyticsTabPlanner" role="tabpanel" aria-labelledby="areaAnalyticsTabPlannerBtn" hidden'), 'planner panel starts hidden');

  const app = readRepo('app.js');
  assert.ok(app.includes("let areaModuleTab = 'progress'"), 'default tab is progress');
  assert.ok(app.includes('areaModuleTab = tab;'), 'tab click switches the active tab');
  assert.ok(app.includes('panel.hidden = tab !== areaModuleTab'), 'sync hides the inactive panels');
  assert.ok(app.includes("btn.setAttribute('aria-pressed', String(tab === areaModuleTab))"), 'sync marks the active tab pressed');
});

test('Top 5: the slice caps the collapsed list and the toggle expands it', () => {
  assert.equal(AREA_MODULE_TOP_N, 5, 'Top 5, not 4 (parent decision D-§2)');
  const rows = [1, 2, 3, 4, 5, 6, 7];
  assert.deepEqual(sliceAreaRows(rows, false), [1, 2, 3, 4, 5], 'collapsed shows the first five');
  assert.deepEqual(sliceAreaRows(rows, true), rows, 'expanded shows everything');
  assert.deepEqual(sliceAreaRows([1, 2, 3], false), [1, 2, 3], 'a short list is never cut');
  assert.deepEqual(rows, [1, 2, 3, 4, 5, 6, 7], 'the input is never mutated');

  const app = readRepo('app.js');
  assert.ok(app.includes('sliceAreaRows(filtered, areaModuleExpanded)'), 'both tabs slice through the shared toggle state');
  assert.ok(app.includes('areaModuleExpanded = !areaModuleExpanded;'), 'toggle flips the shared state');
  assert.ok(app.includes('toggleBtn.hidden = filteredCount <= AREA_MODULE_TOP_N'), 'toggle hides when there is nothing more to show');
});

test('chips: Pending Dues hides zero-due rows, 100% Cleared shows only them, All shows everything', () => {
  // Still-due is the filter figure: a mohalla is cleared when it
  // owes exactly zero, not when its paid % hits 100 — a mohalla
  // can be fully paid for the current month while still owing
  // older arrears, and that money must keep it out of the
  // cleared list.
  assert.equal(areaChipMatches(600000, 'pending'), true, 'PKR 6,000 still due is pending');
  assert.equal(areaChipMatches(0, 'pending'), false, 'PKR 0 still due is not pending');
  assert.equal(areaChipMatches(0, 'cleared'), true, 'PKR 0 still due is cleared');
  assert.equal(areaChipMatches(600000, 'cleared'), false, 'PKR 6,000 still due is not cleared');
  assert.equal(areaChipMatches(0, 'all'), true, 'All shows a cleared row');
  assert.equal(areaChipMatches(600000, 'all'), true, 'All shows a pending row');
  assert.equal(areaChipMatches(0, 'bogus'), true, 'an unknown chip behaves like All, never hides everything');

  const rows = [
    { key: 'a', dueCents: 10000 },
    { key: 'b', dueCents: 50000 },
    { key: 'c', dueCents: 0 },
    { key: 'd', dueCents: 50000 }
  ];
  const sorted = sortAreaRowsByDueDesc(rows, (row) => row.dueCents);
  assert.deepEqual(sorted.map((row) => row.key), ['b', 'd', 'a', 'c'], 'highest still-due first, ties keep their order');
  assert.deepEqual(rows.map((row) => row.key), ['a', 'b', 'c', 'd'], 'the sort never mutates its input');

  const app = readRepo('app.js');
  assert.ok(app.includes("let areaModuleChip = 'pending'"), 'default chip is Pending Dues');
  assert.ok(app.includes('areaChipMatches(row.dueCents, areaModuleChip)'), 'Tab 1 filters on the bars still-due figure');
  assert.ok(app.includes('areaChipMatches(row.unpaidPKR * 100, areaModuleChip)'), 'Tab 2 filters on the card unpaid figure');
});

test('jump: sixteen mohallas plus Unassigned, and picking one un-hides and scrolls', () => {
  const mohallas = sortMohallaNamesByNumberedOrder(DEFAULT_MOHALLAS)
    .map((name) => canonicalMohalla(name))
    .filter(Boolean)
    .map((canon) => ({ key: canon.key, label: canon.label }));
  const options = buildAreaJumpOptions(mohallas);
  assert.equal(options.length, 17, '16 mohallas + Unassigned');
  assert.equal(options[0].key, 'charyaa', 'first is mohalla #1 Charyaa');
  assert.equal(options[11].key, 'end point', 'twelfth is Haweli or End Point');
  assert.deepEqual(options.at(-1), { key: '__unassigned__', label: 'Unassigned' }, 'Unassigned is last');
  assert.deepEqual(
    buildAreaJumpOptions([...mohallas, { key: '__unassigned__', label: 'Unassigned' }]),
    options,
    'an Unassigned entry in the input is not duplicated'
  );
  assert.deepEqual(buildAreaJumpOptions(null), [{ key: '__unassigned__', label: 'Unassigned' }], 'no input still offers Unassigned');

  const app = readRepo('app.js');
  assert.ok(app.includes('sortMohallaNamesByNumberedOrder(DEFAULT_MOHALLAS)'), 'jump lists the sixteen in the fixed numbered order');
  assert.ok(app.includes("areaModuleChip = 'all';"), 'jump clears the chip when it hides the target');
  assert.ok(app.includes('areaModuleExpanded = true;'), 'jump expands the Top-5 slice when it hides the target');
  assert.ok(app.includes("target.scrollIntoView({ block: 'nearest' })"), 'jump scrolls the target into view');
  assert.ok(app.includes("if (areaModuleTab === 'planner') areaModuleTab = 'progress';"), 'jump from the planner lands on Tab 1');
});

test('compact card shape: name one line, headline one line, buttons one row', () => {
  // Harness (2026-11-13, real template + real styles, 360px):
  // before [244, 244, 244, 244, 264.5, 264.5] → after
  // [162, 162, 162, 162, 182.5, 182.5] — a ~31–34% cut, short of
  // the spec's literal 50% and of the ~40–45% estimate, disclosed
  // in the PR body. The real gate passes: 6 cards fully visible
  // per 640px viewport scrolled to the grid at 360px (4 at 320px),
  // zero horizontal overflow at both widths.
  const app = readRepo('app.js');
  const template = app.slice(app.indexOf('return `<div class="mohalla-card"'));
  assert.ok(template.includes('class="mohalla-card-headline"'), 'headline element exists');
  assert.ok(template.indexOf('mohalla-card-count') < template.indexOf('mohalla-card-users'), 'count comes before users in the headline');
  assert.ok(template.indexOf('mohalla-card-users') < template.indexOf('mohalla-card-paid'), 'paid % follows users in the headline');
  assert.ok(template.includes('class="mohalla-card-actions"'), 'actions row exists');
  const actions = template.slice(template.indexOf('mohalla-card-actions'));
  assert.ok(actions.includes('data-mohalla-collect'), 'Field Collect sits in the actions row');
  assert.ok(actions.includes('data-mohalla-area-view'), 'Area view sits in the same actions row');
  assert.ok(template.includes("dsIcon('Bike', 16)"), 'Field Collect carries the Bike icon, not the 3D emoji');
  assert.ok(!template.includes('🏍️'), 'no motorcycle emoji in the card template');

  const css = readRepo('components.css');
  assert.ok(css.includes('#areaAnalyticsModule .mohalla-card-name'), 'module name rule exists');
  const nameRule = css.slice(css.indexOf('#areaAnalyticsModule .mohalla-card-name'));
  assert.ok(nameRule.includes('white-space: nowrap'), 'name stays on one line');
  assert.ok(nameRule.includes('text-overflow: ellipsis'), 'a long name ellipsises');
  assert.ok(css.includes('#areaAnalyticsModule .mohalla-card-actions { display: flex;'), 'actions row is one flex row');
  assert.ok(css.includes('#areaAnalyticsModule .mohalla-card-headline { display: flex;'), 'headline is one flex row');
  assert.ok(css.includes('#areaAnalyticsModule .mohalla-card-collect--primary'), 'primary collect button exists');
  assert.ok(css.includes('var(--ds-brand)'), 'primary button uses the brand token');
});

test('§4: Charyaa and Chamyaa stay separate; Chamyaa/Chamyaaa and Kishti/Kishtii fold to one row', () => {
  let state = createInitialState(['Area Cust A', 'Area Cust B', 'Area Cust C', 'Area Cust D', 'Area Cust E']);
  const id = (index) => state.customers[index].id;
  // A: CHARYAA (#1), B: CHAMYAA (single-a spelling), C: CHAMYAAA
  // (double-a standard), D: KISHTI (single-i), E: KISHTII (double-i).
  state.customers[0].mohalla = 'CHARYAA';
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state.customers[1].mohalla = 'CHAMYAA';
  state = saveBillMonth(state, id(1), { month: MONTH, dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state.customers[2].mohalla = 'CHAMYAAA';
  state = saveBillMonth(state, id(2), { month: MONTH, dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state.customers[3].mohalla = 'KISHTI';
  state = saveBillMonth(state, id(3), { month: MONTH, dueAmount: 500, status: 'pending', dueDate: TODAY }, REF_DATE);
  state.customers[4].mohalla = 'KISHTII';
  state = saveBillMonth(state, id(4), { month: MONTH, dueAmount: 700, status: 'pending', dueDate: TODAY }, REF_DATE);

  // Tab 1 source: the bars rows. Charyaa and Chamyaa are TWO rows;
  // the Chamyaa + Chamyaaa bills land on ONE row, as do Kishti +
  // Kishtii.
  const bars = calculateMohallaBars(state, REF_DATE);
  const barByKey = (key) => bars.rows.find((row) => row.key === key);
  assert.ok(barByKey('charyaa'), 'Charyaa has its own bars row');
  assert.ok(barByKey('chamyaaa'), 'Chamyaaa has its own bars row');
  assert.equal(barByKey('charyaa').dueCents, 300000, 'Charyaa row carries only the CHARYAA bill');
  assert.equal(barByKey('chamyaaa').dueCents, 300000, 'Chamyaaa row carries the CHAMYAA + CHAMYAAA bills together');
  assert.equal(barByKey('kishtii').dueCents, 120000, 'Kishtii row carries the KISHTI + KISHTII bills together');
  assert.equal(bars.rows.filter((row) => row.key === 'chamyaa').length, 0, 'no separate chamyaa row');

  // Tab 2 source: the card stats fold the same way.
  const stats = buildMohallaCardStats(state.customers, calculatePaymentAllocations(state), MONTH);
  assert.equal(stats.length, 3, 'three cards, not five');
  const cardByKey = (key) => stats.find((row) => row.key === key);
  assert.equal(cardByKey('charyaa').count, 1, 'Charyaa card counts one customer');
  assert.equal(cardByKey('chamyaaa').count, 2, 'Chamyaaa card counts both spellings');
  assert.equal(cardByKey('kishtii').count, 2, 'Kishtii card counts both spellings');
});

test('i18n: every area_mod_ key exists in English and Urdu', () => {
  for (const key of [
    'area_mod_title', 'area_mod_sub',
    'area_mod_tab_progress', 'area_mod_tab_cards', 'area_mod_tab_planner',
    'area_mod_chip_pending', 'area_mod_chip_cleared', 'area_mod_chip_all',
    'area_mod_show_all', 'area_mod_show_less',
    'area_mod_jump_label', 'area_mod_jump_placeholder', 'area_mod_empty'
  ]) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en ${key} is empty`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur ${key} is empty`);
  }
  const language = readRepo('nav-language.js');
  assert.ok(!language.includes("dash_mohalla_collect: '🏍️"), 'the motorcycle emoji is gone from the collect label');
});
