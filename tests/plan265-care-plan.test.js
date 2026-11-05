import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validCarePlanDate,
  normalizeCarePlanList,
  recordCarePlan,
  removeCarePlan,
  findCarePlan,
  addCarePlanNote,
  reviewCarePlan,
  carePlanSorted,
  carePlansForCustomer,
  overdueCarePlans,
  carePlanCustomers,
  carePlanSummaryText,
  carePlanText,
  carePlanHtml,
  carePlanAllHtml,
  carePlanCsv,
  carePlanFilename,
} from '../care-plan.js';

const first = { id: 'CP-1', customer: 'Haji Kareem', actions: ['Call before every visit', 'Collect in the morning only'], reviewDate: '2026-11-20', note: 'Elderly, lives alone.' };
const second = { id: 'CP-2', customer: 'Bibi Zainab', actions: ['Send a reminder the day before'], reviewDate: '2026-11-10', note: 'Hard of hearing, speak slowly.' };
const third = { id: 'CP-3', customer: 'Chacha Yousaf', actions: ['Visit with Saad only'], reviewDate: '2026-12-01', note: 'Narrow lane, needs help with the router.' };

test('half-formed care plans are refused', () => {
  assert.deepEqual(recordCarePlan([], { ...first, id: '' }), []);
  assert.deepEqual(recordCarePlan([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordCarePlan([], { ...first, actions: [] }), []);
  assert.deepEqual(recordCarePlan([], { ...first, actions: ['  ', ''] }), []);
  assert.deepEqual(recordCarePlan([], { ...first, actions: 'Call first' }), []);
  assert.deepEqual(recordCarePlan([], { ...first, reviewDate: '' }), []);
  assert.deepEqual(recordCarePlan([], { ...first, reviewDate: '2026-02-30' }), []);
  assert.deepEqual(recordCarePlan([], { ...first, note: '' }), []);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validCarePlanDate('2026-08-31'), true);
  assert.equal(validCarePlanDate('2026-10-31'), true);
  assert.equal(validCarePlanDate('2026-12-31'), true);
  assert.equal(validCarePlanDate('2026-02-29'), false);
  assert.equal(validCarePlanDate('2028-02-29'), true);
  assert.equal(validCarePlanDate('2026-04-31'), false);
  assert.equal(validCarePlanDate('2026-13-01'), false);
  assert.equal(validCarePlanDate('10-11-2026'), false);
  assert.equal(validCarePlanDate(''), false);
  assert.equal(validCarePlanDate(null), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, customerId: 'C-1', billId: 'B-1', paymentId: 'P-1', discount: '10%' };
  const recorded = recordCarePlan([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('customerId' in recorded[0], false);
  assert.equal('billId' in recorded[0], false);
  assert.equal('paymentId' in recorded[0], false);
  assert.equal('discount' in recorded[0], false);
  assert.deepEqual(recorded[0].actions, ['Call before every visit', 'Collect in the morning only']);
  assert.equal(recorded[0].lastReviewedDate, '');
  assert.deepEqual(recorded[0].followups, []);
  const before = JSON.stringify(first);
  recordCarePlan([], first);
  assert.equal(JSON.stringify(first), before);
});

test('duplicate ids and a second plan for the same customer are refused', () => {
  const list = recordCarePlan([], first);
  assert.deepEqual(recordCarePlan(list, { ...first, reviewDate: '2026-12-15' }), list);
  assert.deepEqual(recordCarePlan(list, { ...second, id: 'CP-9', customer: 'haji kareem' }), list);
  const other = recordCarePlan(list, second);
  assert.equal(other.length, 2);
  assert.deepEqual(recordCarePlan(other, { ...third, id: 'CP-1' }), other);
});

test('find and remove work by id only', () => {
  const list = recordCarePlan(recordCarePlan([], first), second);
  assert.equal(findCarePlan(list, 'CP-1').customer, 'Haji Kareem');
  assert.equal(findCarePlan(list, 'CP-9'), null);
  assert.equal(findCarePlan(list, ''), null);
  assert.deepEqual(removeCarePlan(list, 'CP-1').map((item) => item.id), ['CP-2']);
  assert.deepEqual(removeCarePlan(list, 'CP-9'), list);
});

test('plans sort by review date, then customer, then id', () => {
  const list = recordCarePlan(
    recordCarePlan(recordCarePlan([], third), first),
    second,
  );
  assert.deepEqual(carePlanSorted(list).map((item) => item.id), ['CP-2', 'CP-1', 'CP-3']);
});

test('plans for one customer are found case-insensitively', () => {
  const list = recordCarePlan(recordCarePlan([], first), second);
  assert.deepEqual(carePlansForCustomer(list, 'haji kareem').map((item) => item.id), ['CP-1']);
  assert.deepEqual(carePlansForCustomer(list, 'Nobody'), []);
  assert.deepEqual(carePlansForCustomer(list, ''), []);
});

test('overdue reviews appear on one list sorted by review date', () => {
  const list = recordCarePlan(
    recordCarePlan(recordCarePlan([], third), first),
    second,
  );
  assert.deepEqual(overdueCarePlans(list, '2026-11-15').map((item) => item.id), ['CP-2']);
  assert.deepEqual(overdueCarePlans(list, '2026-11-21').map((item) => item.id), ['CP-2', 'CP-1']);
  assert.deepEqual(overdueCarePlans(list, '2026-11-10'), []);
  assert.deepEqual(overdueCarePlans(list, '2026-02-30'), []);
  assert.deepEqual(overdueCarePlans(list, ''), []);
});

test('a review records the review date and a dated note, and never rewrites the plan', () => {
  const list = recordCarePlan([], first);
  const reviewed = reviewCarePlan(list, 'CP-1', '2026-11-18', 'Reviewed with Saad, actions still fit.');
  assert.equal(reviewed[0].lastReviewedDate, '2026-11-18');
  assert.equal(reviewed[0].followups.length, 1);
  assert.equal(reviewed[0].reviewDate, '2026-11-20');
  assert.deepEqual(reviewed[0].actions, first.actions);
  assert.equal(reviewed[0].note, 'Elderly, lives alone.');
  assert.deepEqual(reviewCarePlan(list, 'CP-1', '2026-02-30', 'Bad date.'), list);
  assert.deepEqual(reviewCarePlan(list, 'CP-1', '2026-11-18', ''), list);
  assert.deepEqual(reviewCarePlan(list, 'CP-9', '2026-11-18', 'Unknown id.'), list);
});

test('a care plan is never edited, only annotated with dated notes', () => {
  const list = recordCarePlan([], first);
  const noted = addCarePlanNote(list, 'CP-1', '2026-11-12', 'Called ahead, as agreed.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].customer, 'Haji Kareem');
  assert.equal(noted[0].reviewDate, '2026-11-20');
  assert.deepEqual(noted[0].actions, first.actions);
  assert.equal(noted[0].lastReviewedDate, '');
  assert.deepEqual(addCarePlanNote(list, 'CP-1', '2026-02-30', 'Bad date.'), list);
  assert.deepEqual(addCarePlanNote(list, 'CP-1', '2026-11-12', ''), list);
  assert.deepEqual(addCarePlanNote(list, 'CP-9', '2026-11-12', 'Unknown id.'), list);
});

test('customer list keeps first spelling only', () => {
  const list = recordCarePlan(
    recordCarePlan(recordCarePlan([], first), second),
    third,
  );
  assert.deepEqual(carePlanCustomers(list), ['Bibi Zainab', 'Haji Kareem', 'Chacha Yousaf']);
  assert.deepEqual(
    carePlanCustomers(recordCarePlan(list, { ...third, id: 'CP-9', customer: 'bibi zainab' })),
    ['Bibi Zainab', 'Haji Kareem', 'Chacha Yousaf'],
  );
});

test('summary text counts plans', () => {
  assert.equal(carePlanSummaryText([]), 'No care plans recorded.');
  const list = recordCarePlan(
    recordCarePlan(recordCarePlan([], first), second),
    third,
  );
  assert.equal(carePlanSummaryText(list), '3 care plans for vulnerable customers.');
});

test('plan text, html escaping, and all-html list', () => {
  assert.equal(
    carePlanText(first),
    'Haji Kareem — review by 2026-11-20. Actions: Call before every visit; Collect in the morning only. Note: Elderly, lives alone.',
  );
  assert.equal(carePlanText(null), 'No care plan recorded.');
  const nasty = { ...first, id: 'CP-9', customer: '<b>Alice</b> & "Bob"' };
  assert.equal(carePlanHtml(nasty).includes('<b>'), false);
  assert.equal(carePlanHtml(nasty).includes('&lt;b&gt;Alice&lt;/b&gt;'), true);
  assert.equal(carePlanHtml(null), '<p>No care plan recorded.</p>');
  assert.equal(carePlanAllHtml([]), '<p>No care plans recorded.</p>');
  assert.equal(carePlanAllHtml([first]).startsWith('<ul>'), true);
});

test('csv export and filename', () => {
  const list = recordCarePlan(recordCarePlan([], first), second);
  const csv = carePlanCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","actions","review date","last reviewed","note","follow-ups"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('"CP-2"'), true);
  assert.equal(carePlanFilename(), 'care-plans.csv');
});

test('list normalisation drops bad rows, duplicate ids, and second plans for one customer', () => {
  const list = normalizeCarePlanList([
    first,
    { ...first, reviewDate: '2026-12-15' },
    { ...first, id: 'CP-9', reviewDate: 'bogus' },
    null,
    second,
    { ...second, id: 'CP-2', customer: 'Someone Else' },
  ]);
  assert.deepEqual(list.map((item) => item.id), ['CP-1', 'CP-2']);
});

test('module stays pure: no storage, clock, or network access', () => {
  const source = readFileSync(new URL('../care-plan.js', import.meta.url), 'utf8');
  for (const banned of ['localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'window.', 'globalThis', 'new Date(', 'Date.now(']) {
    assert.equal(source.includes(banned), false, `banned token present: ${banned}`);
  }
});

test('neighbour module is fenced off: the visit note is neither read nor written', () => {
  const source = readFileSync(new URL('../care-plan.js', import.meta.url), 'utf8');
  assert.equal(source.includes('vulnerable-note.js'), false);
  assert.equal(source.includes('import '), false);
});

test('panel ids exist in index.html and app.js wires the panel', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['cpList', 'cpSummary', 'cpExportBtn', 'cpCustomer', 'cpActions', 'cpReviewDate', 'cpNote', 'cpRecordBtn', 'cpAnnotateId', 'cpAnnotateDate', 'cpAnnotateNote', 'cpAnnotateBtn', 'cpRemoveId', 'cpRemoveBtn', 'cpReviewId', 'cpReviewedDate', 'cpReviewNote', 'cpReviewBtn', 'cpOverdueAsOf', 'cpOverdueBtn', 'cpOverdueBody', 'cpFilterCustomer', 'cpFilterBtn', 'cpFilterBody']) {
    assert.equal(html.includes(`id="${id}"`), true, `missing panel id: ${id}`);
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(app.includes('care-plan.js'), true);
  assert.equal(app.includes('loadCarePlans'), true);
  assert.equal(app.includes('renderCarePlans'), true);
  assert.equal(app.includes('shahdara_care_plans_v1'), true);
});

test('deployment guard: app.js carries no standalone OLT word', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(app), false);
});
