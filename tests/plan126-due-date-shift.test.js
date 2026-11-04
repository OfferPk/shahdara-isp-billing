import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validShiftDate,
  weekdayOf,
  normalizeShiftRule,
  normalizeShiftRuleList,
  findShiftRule,
  recordShiftRule,
  isWorkingDay,
  shiftRuleForDate,
  shiftDueDate,
  effectiveDueDate,
  applyShiftToBills,
  shiftRuleSummaryText,
  shiftRuleHtml,
  shiftedBillHtml,
  shiftRuleCsv,
  shiftRuleFilename,
} from '../due-date-shift.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// 2026-11-01 is a Sunday, 2026-11-07 a Saturday.
function forwardRule(over = {}) {
  return {
    id: 'R-1',
    name: 'Sunday closed',
    direction: 'forward',
    closedWeekdays: [0],
    holidays: [],
    effectiveDate: '2026-01-01',
    ...over,
  };
}

test('strict dates and weekdays: real dates pass, impossible dates refused', () => {
  assert.equal(validShiftDate('2026-02-29'), null);
  assert.equal(validShiftDate('2024-02-29'), '2024-02-29');
  assert.equal(validShiftDate('2026-02-30'), null);
  assert.equal(validShiftDate('2026-13-01'), null);
  assert.equal(validShiftDate('2026-11-01'), '2026-11-01');
  assert.equal(weekdayOf('2026-11-01'), 0);
  assert.equal(weekdayOf('2026-11-07'), 6);
  assert.equal(weekdayOf('2026-11-02'), 1);
  assert.equal(weekdayOf('2026-02-30'), null);
});

test('rule normalisation: half-formed refused, unknown fields dropped', () => {
  assert.equal(normalizeShiftRule({ id: 'R-1' }), null);
  assert.equal(normalizeShiftRule(forwardRule({ direction: 'sideways' })), null);
  assert.equal(normalizeShiftRule(forwardRule({ effectiveDate: '2026-02-30' })), null);
  assert.equal(normalizeShiftRule(forwardRule({ closedWeekdays: [7] })), null);
  assert.equal(normalizeShiftRule(forwardRule({ closedWeekdays: [0.5] })), null);
  assert.equal(normalizeShiftRule(forwardRule({ holidays: ['2026-02-30'] })), null);
  assert.equal(normalizeShiftRule(forwardRule({ holidays: '2026-11-02' })), null);
  const clean = normalizeShiftRule(forwardRule({ amount: 500, billId: 'B-1' }));
  assert.equal(clean.amount, undefined);
  assert.equal(clean.billId, undefined);
  assert.deepEqual(clean.closedWeekdays, [0]);
  // Weekdays deduped and sorted; holidays deduped and sorted.
  const sorted = normalizeShiftRule(forwardRule({ closedWeekdays: [6, 0, 6], holidays: ['2026-12-25', '2026-11-02', '2026-11-02'] }));
  assert.deepEqual(sorted.closedWeekdays, [0, 6]);
  assert.deepEqual(sorted.holidays, ['2026-11-02', '2026-12-25']);
});

test('record rules: duplicate id never rewritten', () => {
  const before = [forwardRule()];
  assert.equal(recordShiftRule(before, forwardRule()).length, 1);
  assert.equal(recordShiftRule(before, forwardRule())[0].id, 'R-1');
  assert.equal(recordShiftRule(before, forwardRule({ direction: 'back' })).length, 1);
  assert.equal(recordShiftRule(before, forwardRule({ id: 'R-2' })).length, 2);
  assert.equal(recordShiftRule(before, { id: 'R-3' }).length, 1);
  assert.equal(findShiftRule(before, 'R-1').direction, 'forward');
  assert.equal(findShiftRule(before, 'nope'), null);
  assert.equal(normalizeShiftRuleList([forwardRule(), forwardRule()]).length, 1);
});

test('working days: weekday closure and holidays both close a day', () => {
  const rule = forwardRule({ holidays: ['2026-11-02'] });
  assert.equal(isWorkingDay(rule, '2026-11-01'), false);
  assert.equal(isWorkingDay(rule, '2026-11-02'), false);
  assert.equal(isWorkingDay(rule, '2026-11-03'), true);
  assert.equal(isWorkingDay(rule, '2026-02-30'), false);
  assert.equal(isWorkingDay({ id: 'x' }, '2026-11-03'), false);
});

test('forward shift: closed Sunday moves to Monday', () => {
  const out = shiftDueDate(forwardRule(), '2026-11-01');
  assert.equal(out.shiftedDate, '2026-11-02');
  assert.equal(out.shifted, true);
  assert.equal(out.originalDate, '2026-11-01');
  assert.equal(out.ruleId, 'R-1');
});

test('back shift: closed Sunday moves to Saturday', () => {
  const out = shiftDueDate(forwardRule({ direction: 'back' }), '2026-11-01');
  assert.equal(out.shiftedDate, '2026-10-31');
  assert.equal(out.shifted, true);
});

test('shift chains over weekends and holidays', () => {
  // Sunday closed, Monday a holiday: forward lands Tuesday.
  const out = shiftDueDate(forwardRule({ holidays: ['2026-11-02'] }), '2026-11-01');
  assert.equal(out.shiftedDate, '2026-11-03');
  // Saturday and Sunday closed: back from Sunday lands Friday.
  const back = shiftDueDate(forwardRule({ direction: 'back', closedWeekdays: [0, 6] }), '2026-11-01');
  assert.equal(back.shiftedDate, '2026-10-30');
});

test('working day due dates are never shifted', () => {
  const out = shiftDueDate(forwardRule(), '2026-11-03');
  assert.equal(out.shifted, false);
  assert.equal(out.shiftedDate, '2026-11-03');
});

test('effective date: due dates before it are never shifted', () => {
  const rule = forwardRule({ effectiveDate: '2026-11-01' });
  const before = shiftDueDate(rule, '2026-10-25');
  assert.equal(before.shifted, false);
  assert.equal(before.shiftedDate, '2026-10-25');
  const on = shiftDueDate(rule, '2026-11-01');
  assert.equal(on.shifted, true);
  assert.equal(on.shiftedDate, '2026-11-02');
  assert.equal(shiftDueDate(rule, '2026-02-30'), null);
  assert.equal(shiftDueDate({ id: 'x' }, '2026-11-01'), null);
});

test('rule in force: latest effective date on or before the due date wins', () => {
  const rules = [
    forwardRule({ id: 'OLD', effectiveDate: '2026-01-01' }),
    forwardRule({ id: 'NEW', direction: 'back', effectiveDate: '2026-10-01' }),
  ];
  assert.equal(shiftRuleForDate(rules, '2026-11-01').id, 'NEW');
  assert.equal(shiftRuleForDate(rules, '2026-06-07').id, 'OLD');
  assert.equal(shiftRuleForDate(rules, '2025-06-07'), null);
  assert.equal(shiftRuleForDate(rules, '2026-02-30'), null);
  assert.equal(effectiveDueDate(rules, '2026-11-01'), '2026-10-31');
  assert.equal(effectiveDueDate(rules, '2025-06-07'), '2025-06-07');
  assert.equal(effectiveDueDate([], '2026-11-01'), '2026-11-01');
  assert.equal(effectiveDueDate(rules, '2026-02-30'), null);
});

test('all days closed: no working day found, never a guessed date', () => {
  const rule = forwardRule({ closedWeekdays: [0, 1, 2, 3, 4, 5, 6] });
  assert.equal(shiftDueDate(rule, '2026-11-01'), null);
});

test('apply to bills: original kept beside shifted, amounts untouched, inputs unmutated', () => {
  const bills = [
    { id: 'B-1', customer: 'Ayesha Khan', dueDate: '2026-11-01', amountCents: 150000 },
    { id: 'B-2', customer: 'Bilal Ahmed', dueDate: '2026-11-03', amountCents: 200000 },
    { id: 'B-3', customer: 'No Date', dueDate: '2026-02-30', amountCents: 100000 },
  ];
  const out = applyShiftToBills([forwardRule()], bills);
  assert.equal(out[0].originalDueDate, '2026-11-01');
  assert.equal(out[0].shiftedDueDate, '2026-11-02');
  assert.equal(out[0].shifted, true);
  assert.equal(out[0].amountCents, 150000);
  assert.equal(out[1].shifted, false);
  assert.equal(out[1].shiftedDueDate, '2026-11-03');
  assert.equal(out[2].shiftedDueDate, null);
  assert.equal(out[2].shifted, false);
  assert.equal(bills[0].shiftedDueDate, undefined);
  assert.equal(bills[0].originalDueDate, undefined);
  assert.deepEqual(applyShiftToBills([forwardRule()], 'nope'), []);
});

test('summary, HTML escaping, and CSV', () => {
  assert.equal(shiftRuleSummaryText([]), 'No due-date shift rule recorded yet.');
  assert.match(shiftRuleSummaryText([forwardRule()]), /shift forward from 2026-01-01/);
  assert.match(shiftRuleHtml(forwardRule({ name: '<b>Shop</b>' })), /&lt;b&gt;Shop&lt;\/b&gt;/);
  assert.equal(shiftRuleHtml({ id: 'x' }), '');
  assert.match(shiftedBillHtml({ id: 'B-1', customer: 'Ayesha', originalDueDate: '2026-11-01', shiftedDueDate: '2026-11-02' }), /original due 2026-11-01 — shifted due 2026-11-02/);
  const csv = shiftRuleCsv([forwardRule({ note: 'a, "quoted" note' })]);
  assert.match(csv, /^id,name,direction,effective_date,closed_weekdays,holidays,note\n/);
  assert.match(csv, /"a, ""quoted"" note"/);
  assert.equal(shiftRuleFilename(), 'due-date-shift-rules.csv');
});

test('purity fence: no imports, storage, DOM, network, or other-record identifiers', () => {
  const src = readFileSync(join(root, 'due-date-shift.js'), 'utf8');
  assert.equal(/^\s*import\s/m.test(src), false);
  assert.equal(src.includes('localStorage'), false);
  assert.equal(src.includes('document.'), false);
  assert.equal(src.includes('fetch('), false);
  assert.equal(src.includes('billing-cycle'), false);
  assert.equal(src.includes('bill-extension'), false);
  assert.equal(src.includes('late-fee-policy'), false);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  for (const id of ['shiftRuleBody', 'shiftRuleSummary', 'shiftRuleDirection', 'shiftRuleWeekdays', 'shiftRuleHolidays', 'shiftRuleEffective', 'shiftRuleName', 'shiftRuleSaveBtn', 'shiftCheckDate', 'shiftCheckBtn', 'shiftCheckResult', 'shiftExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
