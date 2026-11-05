import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNUAL_LEAVE_PLAN_STATUSES,
  validAnnualLeavePlanDay,
  foldAnnualLeavePlanStatus,
  foldAnnualLeavePlanYear,
  normalizeAnnualLeavePlanBlock,
  parseAnnualLeavePlanBlocks,
  normalizeAnnualLeavePlan,
  normalizeAnnualLeavePlanList,
  findAnnualLeavePlan,
  recordAnnualLeavePlan,
  removeAnnualLeavePlan,
  setAnnualLeavePlanStatus,
  annualLeavePlanPlansSorted,
  annualLeavePlanPlansForYear,
  annualLeavePlanPlansForStaff,
  annualLeavePlanTotalDays,
  annualLeavePlanDaysInBlock,
  annualLeavePlanStaffMembers,
  annualLeavePlanYears,
  annualLeavePlanClashes,
  annualLeavePlanSummaryText,
  annualLeavePlanPlanText,
  annualLeavePlanClashText,
  annualLeavePlanPlanHtml,
  annualLeavePlanYearHtml,
  annualLeavePlanAllHtml,
  annualLeavePlanCsv,
  annualLeavePlanFilename,
} from '../annual-leave-plan.js';

const saad = {
  id: 'ALP-1', staffMember: 'Saad', year: 2027,
  blocks: [
    { start: '2027-01-04', end: '2027-01-10', note: 'Winter break' },
    { start: '2027-06-01', end: '2027-06-05', note: '' },
  ],
};
const ayesha = {
  id: 'ALP-2', staffMember: 'Ayesha', year: 2027,
  blocks: [{ start: '2027-01-08', end: '2027-01-12', note: '' }],
};
const bilal = {
  id: 'ALP-3', staffMember: 'Bilal', year: 2027,
  blocks: [{ start: '2027-03-15', end: '2027-03-15', note: 'One day' }],
  status: 'confirmed',
};

test('strict day accepts a real date and refuses impossible or malformed days', () => {
  assert.equal(validAnnualLeavePlanDay('2027-01-04'), true);
  assert.equal(validAnnualLeavePlanDay('2028-02-29'), true);
  assert.equal(validAnnualLeavePlanDay('2027-02-29'), false);
  assert.equal(validAnnualLeavePlanDay('2027-01-32'), false);
  assert.equal(validAnnualLeavePlanDay('04-01-2027'), false);
  assert.equal(validAnnualLeavePlanDay(''), false);
  assert.equal(validAnnualLeavePlanDay(null), false);
});

test('status folds known spellings and missing reads as planned, year folds a digit string', () => {
  assert.equal(foldAnnualLeavePlanStatus(''), 'planned');
  assert.equal(foldAnnualLeavePlanStatus(undefined), 'planned');
  assert.equal(foldAnnualLeavePlanStatus('Approved'), 'confirmed');
  assert.equal(foldAnnualLeavePlanStatus('called off'), 'cancelled');
  assert.equal(foldAnnualLeavePlanStatus('ignored'), null);
  assert.equal(foldAnnualLeavePlanYear('2027'), 2027);
  assert.equal(foldAnnualLeavePlanYear(2027), 2027);
  assert.equal(foldAnnualLeavePlanYear('next year'), null);
  assert.equal(foldAnnualLeavePlanYear(2027.5), null);
  assert.deepEqual(ANNUAL_LEAVE_PLAN_STATUSES, ['planned', 'confirmed', 'cancelled']);
});

test('normalize keeps a full plan, sorts blocks, and starts the status as planned', () => {
  const shuffled = { ...saad, blocks: [...saad.blocks].reverse() };
  assert.deepEqual(normalizeAnnualLeavePlan(shuffled), {
    ...saad, status: 'planned', note: '',
  });
  assert.deepEqual(normalizeAnnualLeavePlan(bilal), { ...bilal, note: '' });
});

test('normalize refuses a plan missing any required field', () => {
  assert.equal(normalizeAnnualLeavePlan({ ...saad, id: '' }), null);
  assert.equal(normalizeAnnualLeavePlan({ ...saad, staffMember: '  ' }), null);
  assert.equal(normalizeAnnualLeavePlan({ ...saad, year: 1999 }), null);
  assert.equal(normalizeAnnualLeavePlan({ ...saad, year: 'soon' }), null);
  assert.equal(normalizeAnnualLeavePlan({ ...saad, blocks: [] }), null);
  assert.equal(normalizeAnnualLeavePlan({ ...saad, status: 'ignored' }), null);
  assert.equal(normalizeAnnualLeavePlan(null), null);
  assert.equal(normalizeAnnualLeavePlan([]), null);
});

test('normalize refuses blocks outside the year, ending before they start, or overlapping', () => {
  assert.equal(normalizeAnnualLeavePlan({ ...saad, blocks: [{ start: '2026-12-28', end: '2027-01-02' }] }), null);
  assert.equal(normalizeAnnualLeavePlan({ ...saad, blocks: [{ start: '2027-01-10', end: '2027-01-04' }] }), null);
  assert.equal(normalizeAnnualLeavePlan({ ...saad, blocks: [{ start: '2027-02-29', end: '2027-03-01' }] }), null);
  assert.equal(normalizeAnnualLeavePlan({
    ...saad,
    blocks: [
      { start: '2027-01-04', end: '2027-01-10' },
      { start: '2027-01-09', end: '2027-01-12' },
    ],
  }), null);
  assert.equal(normalizeAnnualLeavePlanBlock({ start: '2027-01-04', end: '2027-01-10' }, 2027).note, '');
});

test('normalize drops unknown fields and never mutates the input', () => {
  const raw = { ...saad, billAmount: 3000, customerName: 'Test', dutyDate: '2027-01-04' };
  const frozen = { ...raw, blocks: [...raw.blocks] };
  const clean = normalizeAnnualLeavePlan(raw);
  assert.equal('billAmount' in clean, false);
  assert.equal('customerName' in clean, false);
  assert.equal('dutyDate' in clean, false);
  assert.deepEqual(raw, frozen);
});

test('parse blocks reads ranges and single days and refuses bad parts', () => {
  assert.deepEqual(parseAnnualLeavePlanBlocks('2027-01-04 to 2027-01-10, 2027-06-01 to 2027-06-05'), [
    { start: '2027-01-04', end: '2027-01-10', note: '' },
    { start: '2027-06-01', end: '2027-06-05', note: '' },
  ]);
  assert.deepEqual(parseAnnualLeavePlanBlocks('2027-03-15'), [
    { start: '2027-03-15', end: '2027-03-15', note: '' },
  ]);
  assert.equal(parseAnnualLeavePlanBlocks('2027-01-10 to 2027-01-04'), null);
  assert.equal(parseAnnualLeavePlanBlocks('2027-02-29 to 2027-03-01'), null);
  assert.equal(parseAnnualLeavePlanBlocks('next week'), null);
  assert.equal(parseAnnualLeavePlanBlocks(''), null);
  assert.equal(parseAnnualLeavePlanBlocks(null), null);
});

test('list normalize drops half-formed plans and keeps the first plan for a duplicate id', () => {
  const list = normalizeAnnualLeavePlanList([saad, { ...saad, blocks: [{ start: '2027-02-01', end: '2027-02-02' }] }, { ...ayesha }, null]);
  assert.equal(list.length, 2);
  assert.equal(list[0].blocks.length, 2);
  assert.equal(list[1].id, 'ALP-2');
  assert.deepEqual(normalizeAnnualLeavePlanList('nope'), []);
});

test('find returns the plan by id or null', () => {
  assert.equal(findAnnualLeavePlan([saad, ayesha], 'ALP-2').staffMember, 'Ayesha');
  assert.equal(findAnnualLeavePlan([saad], 'ALP-9'), null);
  assert.equal(findAnnualLeavePlan([saad], ''), null);
});

test('record refuses half-formed plans, duplicate ids, and a second plan for the same staff in the same year', () => {
  const one = recordAnnualLeavePlan([], saad);
  assert.equal(one.length, 1);
  assert.equal(recordAnnualLeavePlan(one, { ...saad, blocks: [{ start: '2027-02-01', end: '2027-02-02' }] }).length, 1);
  assert.equal(recordAnnualLeavePlan(one, { ...ayesha, id: 'ALP-1' }).length, 1);
  assert.equal(recordAnnualLeavePlan(one, { ...saad, id: 'ALP-9', year: 2028, blocks: [{ start: '2028-01-04', end: '2028-01-06', note: '' }] }).length, 2);
  assert.equal(recordAnnualLeavePlan(one, ayesha).length, 2);
  assert.equal(recordAnnualLeavePlan(one, { ...ayesha, id: 'ALP-9', year: 2026, blocks: [{ start: '2026-01-08', end: '2026-01-12', note: '' }] }).length, 2);
});

test('remove drops only the named plan', () => {
  const list = [saad, ayesha];
  assert.equal(removeAnnualLeavePlan(list, 'ALP-1').length, 1);
  assert.equal(removeAnnualLeavePlan(list, 'ALP-1')[0].id, 'ALP-2');
  assert.equal(removeAnnualLeavePlan(list, 'ALP-9').length, 2);
  assert.equal(removeAnnualLeavePlan(list, '').length, 2);
});

test('status change sets only that plan and is refused for a missing plan or unknown status', () => {
  const changed = setAnnualLeavePlanStatus([saad, ayesha], 'ALP-1', 'confirmed');
  assert.equal(changed[0].status, 'confirmed');
  assert.equal(changed[1].status, 'planned');
  assert.deepEqual(setAnnualLeavePlanStatus([saad], 'ALP-9', 'confirmed'), [normalizeAnnualLeavePlan(saad)]);
  assert.deepEqual(setAnnualLeavePlanStatus([saad], 'ALP-1', 'ignored'), [normalizeAnnualLeavePlan(saad)]);
});

test('sorted lists year then staff A-Z, and year and staff lookups match case-insensitively', () => {
  const sorted = annualLeavePlanPlansSorted([bilal, ayesha, saad, { ...saad, id: 'ALP-4', year: 2026, blocks: [{ start: '2026-01-04', end: '2026-01-06', note: '' }] }]);
  assert.deepEqual(sorted.map((plan) => plan.id), ['ALP-4', 'ALP-2', 'ALP-3', 'ALP-1']);
  assert.deepEqual(annualLeavePlanPlansForYear([saad, ayesha, bilal], '2027').map((plan) => plan.id), ['ALP-2', 'ALP-3', 'ALP-1']);
  assert.deepEqual(annualLeavePlanPlansForYear([saad], 'soon'), []);
  assert.deepEqual(annualLeavePlanPlansForStaff([saad, ayesha], 'saad').map((plan) => plan.id), ['ALP-1']);
  assert.deepEqual(annualLeavePlanPlansForStaff([saad], ''), []);
});

test('total days count both ends of every block', () => {
  assert.equal(annualLeavePlanDaysInBlock({ start: '2027-01-04', end: '2027-01-10' }), 7);
  assert.equal(annualLeavePlanDaysInBlock({ start: '2027-03-15', end: '2027-03-15' }), 1);
  assert.equal(annualLeavePlanDaysInBlock({ start: '2027-01-10', end: '2027-01-04' }), 0);
  assert.equal(annualLeavePlanTotalDays(saad), 12);
  assert.equal(annualLeavePlanTotalDays(bilal), 1);
  assert.equal(annualLeavePlanTotalDays({ ...saad, blocks: [] }), 0);
});

test('staff members list in A-Z order keeping the first spelling seen, years earliest first', () => {
  assert.deepEqual(
    annualLeavePlanStaffMembers([bilal, ayesha, saad, { ...saad, id: 'ALP-4', staffMember: 'saad', year: 2028 }]),
    ['Ayesha', 'Bilal', 'Saad'],
  );
  assert.deepEqual(annualLeavePlanYears([bilal, { ...saad, year: 2028, id: 'ALP-4', blocks: [{ start: '2028-01-04', end: '2028-01-06', note: '' }] }]), [2027, 2028]);
});

test('clashes name overlapping blocks between different staff in the same year', () => {
  const clashes = annualLeavePlanClashes([saad, ayesha, bilal], 2027);
  assert.equal(clashes.length, 1);
  assert.deepEqual(clashes[0], {
    staffA: 'Ayesha', staffB: 'Saad', start: '2027-01-08', end: '2027-01-10', days: 3,
  });
  assert.deepEqual(annualLeavePlanClashes([saad, bilal], 2027), []);
  assert.deepEqual(annualLeavePlanClashes([saad, ayesha], 2028), []);
});

test('cancelled plans never clash and a staff member never clashes with themselves', () => {
  const cancelled = { ...ayesha, status: 'cancelled' };
  assert.deepEqual(annualLeavePlanClashes([saad, cancelled], 2027), []);
  const sameStaff = { ...ayesha, id: 'ALP-9', staffMember: 'Saad' };
  assert.deepEqual(annualLeavePlanClashes([saad, sameStaff], 2027), []);
});

test('summary names the count, staff, days, and clashes', () => {
  assert.equal(annualLeavePlanSummaryText([]), 'No annual leave plans recorded.');
  assert.equal(annualLeavePlanSummaryText([saad, ayesha, bilal]), '3 plans, 3 staff members, 18 planned days.');
  assert.equal(annualLeavePlanSummaryText([saad, ayesha, bilal], 2027), '3 plans for 2027, 3 staff members, 18 planned days, 1 clash.');
  assert.equal(annualLeavePlanSummaryText([saad, bilal], 2027), '2 plans for 2027, 2 staff members, 13 planned days, no clashes.');
  assert.equal(annualLeavePlanSummaryText([saad], 2028), 'No annual leave plans recorded for 2028.');
});

test('plan text shows blocks, days, and status, and clash text names both staff', () => {
  assert.match(annualLeavePlanPlanText(saad), /Saad, 2027: 2027-01-04 to 2027-01-10, 2027-06-01 to 2027-06-05 \(12 days\)/);
  assert.match(annualLeavePlanPlanText(saad), /Status: planned/);
  assert.match(annualLeavePlanPlanText(bilal), /2027-03-15 \(1 days\)/);
  assert.equal(annualLeavePlanPlanText({ ...saad, blocks: [] }), '');
  assert.equal(
    annualLeavePlanClashText({ staffA: 'Ayesha', staffB: 'Saad', start: '2027-01-08', end: '2027-01-10', days: 3 }),
    'Ayesha and Saad are both away 2027-01-08 to 2027-01-10.',
  );
  assert.equal(annualLeavePlanClashText({ staffA: '', staffB: 'Saad', start: '2027-01-08', end: '2027-01-10' }), '');
});

test('html escapes user text and the year view puts staff side by side with clashes visible', () => {
  const tricky = { ...saad, id: 'ALP-9', staffMember: 'Saad <b>boss</b>' };
  const html = annualLeavePlanPlanHtml(tricky);
  assert.equal(html.includes('<b>'), false);
  assert.match(html, /Saad &lt;b&gt;boss&lt;\/b&gt;/);
  const yearHtml = annualLeavePlanYearHtml([saad, ayesha, bilal], 2027);
  assert.match(yearHtml, /<table>/);
  assert.match(yearHtml, /<th>Saad \(planned\)<\/th>/);
  assert.match(yearHtml, /<th>Ayesha \(planned\)<\/th>/);
  assert.match(yearHtml, /Ayesha and Saad are both away 2027-01-08 to 2027-01-10/);
  assert.match(annualLeavePlanYearHtml([saad, bilal], 2027), /No clashes/);
  assert.equal(annualLeavePlanYearHtml([], 2027), '<p>No annual leave plans recorded for 2027.</p>');
  assert.match(annualLeavePlanAllHtml([saad, { ...saad, id: 'ALP-4', year: 2028, blocks: [{ start: '2028-01-04', end: '2028-01-06', note: '' }] }]), /<h4>2027<\/h4>/);
  assert.match(annualLeavePlanAllHtml([saad, { ...saad, id: 'ALP-4', year: 2028, blocks: [{ start: '2028-01-04', end: '2028-01-06', note: '' }] }]), /<h4>2028<\/h4>/);
  assert.equal(annualLeavePlanAllHtml([]), '<p>No annual leave plans recorded.</p>');
});

test('csv lists plans year then staff with a header and the fixed filename', () => {
  const csv = annualLeavePlanCsv([bilal, saad, ayesha]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,staffMember,year,blocks,status,note');
  assert.match(lines[1], /^ALP-2,Ayesha,2027,2027-01-08 to 2027-01-12,planned,/);
  assert.match(lines[2], /^ALP-3,Bilal,2027,2027-03-15,confirmed,$/);
  assert.equal(annualLeavePlanFilename(), 'annual-leave-plans.csv');
});

test('csv quotes a note that contains a comma', () => {
  const csv = annualLeavePlanCsv([{ ...saad, note: 'Family trip, booked early' }]);
  assert.match(csv, /"Family trip, booked early"/);
});

test('recording a plan leaves the input list untouched', () => {
  const before = [saad];
  const after = recordAnnualLeavePlan(before, ayesha);
  assert.equal(before.length, 1);
  assert.equal(after.length, 2);
});
