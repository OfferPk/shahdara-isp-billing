// Home Budget compact empty state.
//
// The Home Budget view used to repeat the router's header (a second
// 'Home Budget' h2 + a five-line note), show three KPI cards with the third
// orphaned on its own row, keep the entry form always open, and render the
// Monthly totals card plus four filter controls even when zero entries
// exist. It now shows one subtitle line, two balanced KPI cards, a form
// collapsed behind a closed <details>, and hides the totals card and the
// filter toolbar at zero entries. The entry count already lived in the
// All-time subtitle, so the dropped third card needed no replacement.
//
// These are source-text pins: they assert the markup and the render wiring
// in the shipped files, not the ledger logic (covered by
// tests/home-budget.test.js). No key counts are asserted here.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const indexHtml = read('index.html');
const appJs = read('app.js');
const routerJs = read('screen-router.js');
const stylesCss = read('styles.css');

test('no duplicate heading: the view has no h2 and names itself with aria-label', () => {
  assert.equal(indexHtml.includes('homeBudgetHeading'), false, 'the second h2 and its id are gone');
  assert.equal(indexHtml.includes('aria-labelledby="homeBudgetHeading"'), false, 'no dangling labelledby');
  assert.ok(indexHtml.includes('<section id="homeBudgetView" class="phase3-view" aria-label="Home Budget" hidden>'), 'section keeps an accessible name');
});

test('KPI grid is exactly two cards and the Recorded entries card is gone', () => {
  const viewStart = indexHtml.indexOf('id="homeBudgetView"');
  const formStart = indexHtml.indexOf('id="homeBudgetFormDetails"');
  const head = indexHtml.slice(viewStart, formStart);
  assert.equal((head.match(/<article class="phase3-metric">/g) || []).length, 2, 'two KPI cards only');
  assert.equal(indexHtml.includes('homeBudgetEntryCount'), false, 'third card strong is gone');
  assert.equal(indexHtml.includes('homeBudgetEntryHelp'), false, 'third card help is gone');
  assert.equal(appJs.includes("$('#homeBudgetEntryCount')"), false, 'dead guarded write is gone');
  assert.equal(appJs.includes("$('#homeBudgetEntryHelp')"), false, 'dead guarded help write is gone');
});

test('the entry count lives in the All-time subtitle', () => {
  assert.ok(appJs.includes("`${summary.count} ${summary.count === 1 ? 'entry' : 'entries'} · all months`"), 'count in the All-time subtitle');
  assert.ok(appJs.includes("'No home entries recorded'"), 'zero-entry subtitle text survives');
});

test('the entry form is a closed details behind the registry summary', () => {
  assert.ok(indexHtml.includes('<details id="homeBudgetFormDetails">'), 'form wrapped in details');
  assert.equal(indexHtml.includes('<details id="homeBudgetFormDetails" open'), false, 'closed by default');
  assert.ok(indexHtml.includes('<summary class="secondary-button registry-create-summary" id="homeBudgetFormHeading">Add or correct a home expense</summary>'), 'summary is the create button and keeps the heading id');
  assert.equal(indexHtml.includes('PERSONAL EXPENSE ONLY'), false, 'the form eyebrow drops');
});

test('the router focus branch opens enclosing closed details before scrolling', () => {
  assert.ok(routerJs.includes("el.closest('details:not([open])')"), 'router looks for a closed enclosing details');
  assert.ok(routerJs.includes('closedDetails.open = true'), 'router opens it');
  const focusStart = routerJs.indexOf("} else if (action.focus) {");
  const focusBlock = routerJs.slice(focusStart, routerJs.indexOf('input?.focus', focusStart));
  assert.ok(focusBlock.indexOf('closedDetails.open = true') < focusBlock.indexOf('scrollIntoView'), 'details open before scrollIntoView');
});

test('Edit opens the form details before scrolling to the form', () => {
  assert.ok(appJs.includes('if (formDetails) formDetails.open = true;'), 'edit opens the details');
  const editStart = appJs.indexOf("button.dataset.editHomeBudget");
  const editBlock = appJs.slice(editStart, appJs.indexOf("scrollIntoView", editStart));
  assert.ok(editBlock.includes('formDetails.open = true'), 'open happens before the edit scroll');
});

test('reset closes the form details, so save and Cancel both collapse it', () => {
  const resetStart = appJs.indexOf('function resetHomeBudgetForm()');
  const resetBlock = appJs.slice(resetStart, appJs.indexOf('\n}\n', resetStart));
  assert.ok(resetBlock.includes('formDetails.open = false'), 'reset closes the details');
  assert.ok(appJs.includes("$('#homeBudgetCancel')?.addEventListener('click', resetHomeBudgetForm)"), 'Cancel calls reset');
});

test('at zero entries the months card and the filter toolbar hide; the dead empty paragraph is gone', () => {
  assert.ok(indexHtml.includes('id="homeBudgetMonthsCard"'), 'months card has an id');
  assert.ok(indexHtml.includes('id="homeBudgetFilterToolbar"'), 'filter toolbar has an id');
  assert.equal(indexHtml.includes('homeBudgetMonthTotalsEmpty'), false, 'dead inner paragraph removed from markup');
  assert.equal(appJs.includes("$('#homeBudgetMonthTotalsEmpty')"), false, 'dead guarded lines removed from render');
  assert.ok(appJs.includes('monthsCard.hidden = summary.months.length === 0'), 'months card hides at zero months');
  assert.ok(appJs.includes('filterToolbar.hidden = entries.length === 0'), 'toolbar hides at zero entries');
});

test('single empty state, verbatim separation phrase, and the load-bearing [hidden] rule', () => {
  assert.ok(indexHtml.includes('No home entries recorded yet — tap + Add Home Expense above to record one.'), 'the one clean empty state survives');
  assert.ok(indexHtml.includes('never enter the business expense ledger'), 'separation phrase kept verbatim');
  assert.ok(stylesCss.includes('.table-card[hidden], .table-filter-toolbar[hidden]{display:none!important}'), 'grid/flex cards need the scoped hidden override');
});
