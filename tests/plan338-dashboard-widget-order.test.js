import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validDashboardWidgetOrderDay,
  foldDashboardWidgetOrderStatus,
  normalizeDashboardWidgetOrderWidgets,
  normalizeDashboardWidgetOrderPreference,
  normalizeDashboardWidgetOrderPreferenceList,
  dashboardWidgetOrderForOperator,
  dashboardWidgetOrderHistoryForOperator,
  recordDashboardWidgetOrderPreference,
  resetDashboardWidgetOrder,
  dashboardWidgetsInPreferredOrder,
  dashboardWidgetOrderCounts,
  dashboardWidgetOrderSummaryText,
  dashboardWidgetOrderText,
  dashboardWidgetOrderHtml,
  dashboardWidgetOrdersHtml,
  dashboardWidgetOrderCurrentHtml,
  dashboardWidgetsInPreferredOrderHtml,
  dashboardWidgetOrderCsv,
  dashboardWidgetOrderFilename,
} from '../dashboard-widget-order.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'dashboard-widget-order.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const PREF_A = { id: 'DWO-1', operator: 'Saad', widgets: ['Collections today', 'Overdue list', 'Due in 7 days'], dateSet: '2026-11-05' };
const PREF_B = { id: 'DWO-2', operator: 'Bike', widgets: ['Overdue list', 'Collections today'], dateSet: '2026-11-06' };
const DEFAULT_WIDGETS = ['Collections today', 'Overdue list', 'Due in 7 days', 'New customers'];

test('valid day accepts strict dates and refuses bad ones', () => {
  assert.equal(validDashboardWidgetOrderDay('2026-11-05'), true);
  assert.equal(validDashboardWidgetOrderDay('2028-02-29'), true);
  assert.equal(validDashboardWidgetOrderDay('2026-02-29'), false);
  assert.equal(validDashboardWidgetOrderDay('2026-04-31'), false);
  assert.equal(validDashboardWidgetOrderDay('2026-13-01'), false);
  assert.equal(validDashboardWidgetOrderDay('2026-00-10'), false);
  assert.equal(validDashboardWidgetOrderDay('2026-11-5'), false);
  assert.equal(validDashboardWidgetOrderDay('05-11-2026'), false);
  assert.equal(validDashboardWidgetOrderDay(''), false);
  assert.equal(validDashboardWidgetOrderDay(null), false);
  assert.equal(validDashboardWidgetOrderDay(20261105), false);
});

test('status folds reset and active, unknown reads active', () => {
  assert.equal(foldDashboardWidgetOrderStatus('reset'), 'reset');
  assert.equal(foldDashboardWidgetOrderStatus('RESET'), 'reset');
  assert.equal(foldDashboardWidgetOrderStatus('  reset  '), 'reset');
  assert.equal(foldDashboardWidgetOrderStatus('active'), 'active');
  assert.equal(foldDashboardWidgetOrderStatus('anything else'), 'active');
  assert.equal(foldDashboardWidgetOrderStatus(''), 'active');
  assert.equal(foldDashboardWidgetOrderStatus(null), 'active');
});

test('normalize widgets trims, splits strings, and collapses repeats', () => {
  assert.deepEqual(normalizeDashboardWidgetOrderWidgets(['  Collections today ', 'Overdue list', 'collections today', '', '  ']), ['Collections today', 'Overdue list']);
  assert.deepEqual(normalizeDashboardWidgetOrderWidgets('Overdue list, Collections today\nDue in 7 days'), ['Overdue list', 'Collections today', 'Due in 7 days']);
  assert.deepEqual(normalizeDashboardWidgetOrderWidgets('Collections today, collections today'), ['Collections today']);
  assert.deepEqual(normalizeDashboardWidgetOrderWidgets(''), []);
  assert.deepEqual(normalizeDashboardWidgetOrderWidgets(null), []);
  assert.deepEqual(normalizeDashboardWidgetOrderWidgets(42), []);
});

test('normalize trims fields and drops unknown fields', () => {
  const pref = normalizeDashboardWidgetOrderPreference({ ...PREF_A, extra: 'ignored', operator: '  Saad  ' });
  assert.deepEqual(pref, { ...PREF_A, status: 'active' });
  assert.equal('extra' in pref, false);
});

test('normalize refuses half-formed preferences', () => {
  assert.equal(normalizeDashboardWidgetOrderPreference({ operator: 'Saad', widgets: ['x'], dateSet: '2026-11-05' }), null);
  assert.equal(normalizeDashboardWidgetOrderPreference({ id: 'DWO-1', widgets: ['x'], dateSet: '2026-11-05' }), null);
  assert.equal(normalizeDashboardWidgetOrderPreference({ id: 'DWO-1', operator: 'Saad', widgets: [], dateSet: '2026-11-05' }), null);
  assert.equal(normalizeDashboardWidgetOrderPreference({ id: 'DWO-1', operator: 'Saad', widgets: ['x'], dateSet: '2026-02-29' }), null);
  assert.equal(normalizeDashboardWidgetOrderPreference(null), null);
  assert.equal(normalizeDashboardWidgetOrderPreference([PREF_A]), null);
  assert.equal(normalizeDashboardWidgetOrderPreference('order'), null);
});

test('normalize keeps a reset record with empty widgets', () => {
  const reset = normalizeDashboardWidgetOrderPreference({ id: 'DWO-9', operator: 'Saad', widgets: [], dateSet: '2026-11-07', status: 'reset' });
  assert.deepEqual(reset, { id: 'DWO-9', operator: 'Saad', widgets: [], dateSet: '2026-11-07', status: 'reset' });
});

test('normalize list drops invalid preferences and keeps the first per id', () => {
  const list = normalizeDashboardWidgetOrderPreferenceList([PREF_A, { ...PREF_A, operator: 'Other' }, PREF_B, null, { id: 'DWO-3' }]);
  assert.deepEqual(list.map((pref) => pref.id), ['DWO-1', 'DWO-2']);
  assert.deepEqual(normalizeDashboardWidgetOrderPreferenceList('not a list'), []);
  assert.deepEqual(normalizeDashboardWidgetOrderPreferenceList(null), []);
});

test('current preference returns the latest active record for an operator', () => {
  assert.deepEqual(dashboardWidgetOrderForOperator([PREF_A, PREF_B], 'saad'), { ...PREF_A, status: 'active' });
  assert.deepEqual(dashboardWidgetOrderForOperator([PREF_A, PREF_B], 'BIKE'), { ...PREF_B, status: 'active' });
  assert.equal(dashboardWidgetOrderForOperator([PREF_A], 'Nobody'), null);
  assert.equal(dashboardWidgetOrderForOperator([PREF_A], ''), null);
});

test('a newer preference for the same operator supersedes the older one', () => {
  const newer = { id: 'DWO-3', operator: 'Saad', widgets: ['Due in 7 days', 'Collections today'], dateSet: '2026-11-06' };
  const list = [PREF_A, newer];
  assert.deepEqual(dashboardWidgetOrderForOperator(list, 'Saad'), { ...newer, status: 'active' });
  assert.equal(list.length, 2);
});

test('record adds a preference and refuses a duplicate id', () => {
  const next = recordDashboardWidgetOrderPreference([], PREF_A);
  assert.equal(next.length, 1);
  assert.deepEqual(next[0], { ...PREF_A, status: 'active' });
  const again = recordDashboardWidgetOrderPreference(next, { ...PREF_B, id: 'DWO-1' });
  assert.deepEqual(again, next);
});

test('record refuses half-formed preferences and leaves the list unchanged', () => {
  const before = [PREF_A];
  assert.deepEqual(recordDashboardWidgetOrderPreference(before, { id: 'DWO-2', operator: 'Bike' }), normalizeDashboardWidgetOrderPreferenceList(before));
  assert.deepEqual(recordDashboardWidgetOrderPreference(before, null), normalizeDashboardWidgetOrderPreferenceList(before));
});

test('reset appends a reset record and restores the default order without deleting history', () => {
  const next = resetDashboardWidgetOrder([PREF_A], 'Saad', { id: 'DWO-9', resetDate: '2026-11-07' });
  assert.equal(next.length, 2);
  assert.deepEqual(next[1], { id: 'DWO-9', operator: 'Saad', widgets: [], dateSet: '2026-11-07', status: 'reset' });
  assert.equal(dashboardWidgetOrderForOperator(next, 'Saad'), null);
  assert.deepEqual(dashboardWidgetsInPreferredOrder(DEFAULT_WIDGETS, dashboardWidgetOrderForOperator(next, 'Saad')), DEFAULT_WIDGETS);
});

test('reset refuses without an active preference, with a bad date, or with a duplicate id', () => {
  assert.deepEqual(resetDashboardWidgetOrder([], 'Saad', { id: 'DWO-9', resetDate: '2026-11-07' }), []);
  assert.deepEqual(resetDashboardWidgetOrder([PREF_A], 'Saad', { id: 'DWO-9', resetDate: '2026-02-30' }), normalizeDashboardWidgetOrderPreferenceList([PREF_A]));
  assert.deepEqual(resetDashboardWidgetOrder([PREF_A], 'Saad', { id: 'DWO-1', resetDate: '2026-11-07' }), normalizeDashboardWidgetOrderPreferenceList([PREF_A]));
  assert.deepEqual(resetDashboardWidgetOrder([PREF_A], '', { id: 'DWO-9', resetDate: '2026-11-07' }), normalizeDashboardWidgetOrderPreferenceList([PREF_A]));
});

test('reset is case-insensitive on the operator and re-setting after a reset works', () => {
  const reset = resetDashboardWidgetOrder([PREF_A], 'SAAD', { id: 'DWO-9', resetDate: '2026-11-07' });
  assert.equal(dashboardWidgetOrderForOperator(reset, 'Saad'), null);
  const again = recordDashboardWidgetOrderPreference(reset, { id: 'DWO-10', operator: 'Saad', widgets: ['Due in 7 days'], dateSet: '2026-11-08' });
  assert.deepEqual(dashboardWidgetOrderForOperator(again, 'Saad'), { id: 'DWO-10', operator: 'Saad', widgets: ['Due in 7 days'], dateSet: '2026-11-08', status: 'active' });
  assert.equal(again.length, 3);
});

test('history lists one operator newest first', () => {
  const list = [PREF_A, { id: 'DWO-3', operator: 'Saad', widgets: ['Due in 7 days'], dateSet: '2026-11-06' }, PREF_B];
  assert.deepEqual(dashboardWidgetOrderHistoryForOperator(list, 'saad').map((pref) => pref.id), ['DWO-3', 'DWO-1']);
  assert.deepEqual(dashboardWidgetOrderHistoryForOperator(list, 'Nobody'), []);
});

test('order puts preferred widgets first in preference order, then the rest', () => {
  const pref = dashboardWidgetOrderForOperator([PREF_A], 'Saad');
  assert.deepEqual(dashboardWidgetsInPreferredOrder(DEFAULT_WIDGETS, pref), ['Collections today', 'Overdue list', 'Due in 7 days', 'New customers']);
  const bikePref = dashboardWidgetOrderForOperator([PREF_B], 'Bike');
  assert.deepEqual(dashboardWidgetsInPreferredOrder(DEFAULT_WIDGETS, bikePref), ['Overdue list', 'Collections today', 'Due in 7 days', 'New customers']);
});

test('order ignores preference widgets not in the list and keeps the caller spelling', () => {
  const pref = { id: 'DWO-5', operator: 'Saad', widgets: ['missing widget', 'OVERDUE LIST'], dateSet: '2026-11-06', status: 'active' };
  assert.deepEqual(dashboardWidgetsInPreferredOrder(DEFAULT_WIDGETS, pref), ['Overdue list', 'Collections today', 'Due in 7 days', 'New customers']);
});

test('order returns a copy of the list with no preference or a reset preference', () => {
  assert.deepEqual(dashboardWidgetsInPreferredOrder(DEFAULT_WIDGETS, null), DEFAULT_WIDGETS);
  assert.notEqual(dashboardWidgetsInPreferredOrder(DEFAULT_WIDGETS, null), DEFAULT_WIDGETS);
  const reset = { id: 'DWO-9', operator: 'Saad', widgets: [], dateSet: '2026-11-07', status: 'reset' };
  assert.deepEqual(dashboardWidgetsInPreferredOrder(DEFAULT_WIDGETS, reset), DEFAULT_WIDGETS);
});

test('counts cover total, active, reset, and operators', () => {
  assert.deepEqual(dashboardWidgetOrderCounts([]), { total: 0, active: 0, reset: 0, operators: 0 });
  const reset = resetDashboardWidgetOrder([PREF_A, PREF_B], 'Saad', { id: 'DWO-9', resetDate: '2026-11-07' });
  assert.deepEqual(dashboardWidgetOrderCounts(reset), { total: 3, active: 2, reset: 1, operators: 2 });
});

test('summary text covers empty, active-only, and reset cases', () => {
  assert.equal(dashboardWidgetOrderSummaryText([]), 'No widget orders saved.');
  assert.equal(dashboardWidgetOrderSummaryText([PREF_A]), '1 saved order across 1 operator.');
  assert.equal(dashboardWidgetOrderSummaryText([PREF_A, PREF_B]), '2 saved orders across 2 operators.');
  const reset = resetDashboardWidgetOrder([PREF_A, PREF_B], 'Saad', { id: 'DWO-9', resetDate: '2026-11-07' });
  assert.equal(dashboardWidgetOrderSummaryText(reset), '2 saved orders across 2 operators, 1 reset back to the default order.');
});

test('preference text names the operator, widgets, and date; reset text names the reset date', () => {
  assert.equal(dashboardWidgetOrderText(PREF_A), 'Saad — Collections today, Overdue list, Due in 7 days — set on 2026-11-05');
  const reset = { id: 'DWO-9', operator: 'Saad', widgets: [], dateSet: '2026-11-07', status: 'reset' };
  assert.equal(dashboardWidgetOrderText(reset), 'Saad — back on the default order, reset on 2026-11-07');
  assert.equal(dashboardWidgetOrderText({ id: 'DWO-9' }), '');
});

test('preference html escapes user text and returns empty for an invalid preference', () => {
  const nasty = { id: 'DWO-7', operator: '<script>alert(1)</script>', widgets: ['A & B'], dateSet: '2026-11-06' };
  const html = dashboardWidgetOrderHtml(nasty);
  assert.ok(!html.includes('<script>'), 'raw script tag must not appear');
  assert.ok(html.includes('&lt;script&gt;'), 'script tag is escaped');
  assert.ok(html.includes('A &amp; B'), 'ampersand is escaped');
  assert.equal(dashboardWidgetOrderHtml({ id: 'DWO-9' }), '');
});

test('lists html covers all, current, and ordered views', () => {
  assert.equal(dashboardWidgetOrdersHtml([]), '<p>No widget orders saved.</p>');
  assert.ok(dashboardWidgetOrdersHtml([PREF_A, PREF_B]).includes('<ul>'), 'all view is a list');
  assert.ok(dashboardWidgetOrdersHtml([PREF_A]).includes('Saad'), 'operator named');
  assert.equal(dashboardWidgetOrderCurrentHtml([], 'Saad'), '<p>On the default order.</p>');
  assert.ok(dashboardWidgetOrderCurrentHtml([PREF_A], 'Saad').includes('Saad'), 'current preference named');
  assert.equal(dashboardWidgetsInPreferredOrderHtml([], null), '<p>No widgets listed.</p>');
  const ordered = dashboardWidgetsInPreferredOrderHtml(DEFAULT_WIDGETS, dashboardWidgetOrderForOperator([PREF_B], 'Bike'));
  assert.ok(ordered.startsWith('<ol>'), 'ordered view is numbered');
  assert.ok(ordered.indexOf('Overdue list') < ordered.indexOf('Collections today'), 'preferred widget comes first');
});

test('csv export has the preference fields and quotes commas and quotes', () => {
  const csv = dashboardWidgetOrderCsv([PREF_A, { id: 'DWO-8', operator: 'Bike, Jr', widgets: ['A "quoted" widget', 'B'], dateSet: '2026-11-06' }]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,operator,widgets,dateSet,status');
  assert.equal(lines[1], 'DWO-1,Saad,Collections today; Overdue list; Due in 7 days,2026-11-05,active');
  assert.ok(lines[2].includes('"Bike, Jr"'), 'comma in operator is quoted');
  assert.ok(lines[2].includes('"A ""quoted"" widget; B"'), 'quotes inside a cell are doubled');
  assert.equal(dashboardWidgetOrderCsv([]), 'id,operator,widgets,dateSet,status');
});

test('filename is the widget orders csv name', () => {
  assert.equal(dashboardWidgetOrderFilename(), 'dashboard-widget-orders.csv');
});

test('inputs are never mutated, even when deep frozen', () => {
  const frozen = deepFreeze([{ ...PREF_A }, { ...PREF_B }]);
  const snapshot = JSON.stringify(frozen);
  recordDashboardWidgetOrderPreference(frozen, { id: 'DWO-3', operator: 'Saad', widgets: ['Due in 7 days'], dateSet: '2026-11-07' });
  resetDashboardWidgetOrder(frozen, 'Saad', { id: 'DWO-9', resetDate: '2026-11-07' });
  dashboardWidgetOrderForOperator(frozen, 'Saad');
  dashboardWidgetsInPreferredOrder(deepFreeze([...DEFAULT_WIDGETS]), dashboardWidgetOrderForOperator(frozen, 'Saad'));
  assert.equal(JSON.stringify(frozen), snapshot);
});

test('ordering works on plain widget names only, with no app state access', () => {
  assert.doesNotMatch(moduleSrc, /state\./);
  assert.doesNotMatch(moduleSrc, /import /);
});

test('pure module reads no storage, clock, network, or page', () => {
  assert.doesNotMatch(moduleSrc, /document\./);
  assert.doesNotMatch(moduleSrc, /localStorage/);
  assert.doesNotMatch(moduleSrc, /new Date\(/);
  assert.doesNotMatch(moduleSrc, /Date\.now\(/);
  assert.doesNotMatch(moduleSrc, /fetch\(/);
  assert.doesNotMatch(moduleSrc, /window\./);
});

test('app.js wires the widget order panel and index.html carries it', () => {
  assert.ok(appJs.includes("from './dashboard-widget-order.js'"), 'app.js imports the module');
  assert.ok(appJs.includes('renderDashboardWidgetOrders();'), 'render call is wired');
  assert.ok(appJs.includes('shahdara_dwo_prefs_v1'), 'store key is wired');
  assert.ok(indexHtml.includes('id="dwoHeading"'), 'panel heading present');
  assert.ok(indexHtml.includes('id="dwoBody"'), 'preferences body present');
  assert.ok(indexHtml.includes('id="dwoCurrentBody"'), 'current order body present');
  assert.ok(indexHtml.includes('id="dwoSaveBtn"'), 'save button present');
  assert.ok(indexHtml.includes('id="dwoResetBtn"'), 'reset button present');
  assert.ok(indexHtml.includes('id="dwoExportBtn"'), 'export button present');
});
