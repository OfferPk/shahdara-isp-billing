import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validAnniversaryMilestoneDate,
  normalizeAnniversaryMilestoneList,
  recordAnniversaryMilestone,
  removeAnniversaryMilestone,
  findAnniversaryMilestone,
  addAnniversaryMilestoneNote,
  anniversaryMilestoneSorted,
  milestonesForCustomer,
  anniversaryMilestoneCustomers,
  anniversaryMilestoneSummaryText,
  anniversaryMilestoneText,
  anniversaryMilestoneHtml,
  anniversaryMilestoneAllHtml,
  anniversaryMilestoneCsv,
  anniversaryMilestoneFilename,
} from '../anniversary-milestone.js';

const first = { id: 'AM-1', customer: 'Ahmed Raza', yearsReached: 3, dateReached: '2026-11-01', acknowledged: true, note: 'Thanked in person by Saad.' };
const second = { id: 'AM-2', customer: 'Bilal Ahmed', yearsReached: 1, dateReached: '2026-10-15', acknowledged: 'no', note: '' };
const third = { id: 'AM-3', customer: 'Ahmed Raza', yearsReached: 5, dateReached: '2026-09-20', acknowledged: 'Yes', note: 'Five years of service.' };

test('half-formed milestone entries are refused', () => {
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, id: '' }), []);
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, dateReached: '' }), []);
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, dateReached: '2026-02-30' }), []);
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, yearsReached: 0 }), []);
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, yearsReached: 2.5 }), []);
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, yearsReached: '3' }), []);
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, acknowledged: 'maybe' }), []);
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, acknowledged: '' }), []);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validAnniversaryMilestoneDate('2026-08-31'), true);
  assert.equal(validAnniversaryMilestoneDate('2026-10-31'), true);
  assert.equal(validAnniversaryMilestoneDate('2026-12-31'), true);
  assert.equal(validAnniversaryMilestoneDate('2026-02-29'), false);
  assert.equal(validAnniversaryMilestoneDate('2028-02-29'), true);
  assert.equal(validAnniversaryMilestoneDate('2026-04-31'), false);
  assert.equal(validAnniversaryMilestoneDate('2026-13-01'), false);
  assert.equal(validAnniversaryMilestoneDate('10-11-2026'), false);
  assert.equal(validAnniversaryMilestoneDate(''), false);
  assert.equal(validAnniversaryMilestoneDate(null), false);
});

test('acknowledgement accepts yes/no words and booleans only', () => {
  assert.equal(recordAnniversaryMilestone([], { ...first, id: 'AM-9', acknowledged: 'YES' })[0].acknowledged, true);
  assert.equal(recordAnniversaryMilestone([], { ...first, id: 'AM-9', acknowledged: 'No' })[0].acknowledged, false);
  assert.equal(recordAnniversaryMilestone([], { ...first, id: 'AM-9', acknowledged: false })[0].acknowledged, false);
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, acknowledged: 1 }), []);
  assert.deepEqual(recordAnniversaryMilestone([], { ...first, acknowledged: undefined }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, customerStatus: 'changed', billAmount: 500, paymentId: 'P-1' };
  const recorded = recordAnniversaryMilestone([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('customerStatus' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('paymentId' in recorded[0], false);
  assert.equal(recorded[0].note, 'Thanked in person by Saad.');
  assert.deepEqual(recorded[0].followups, []);
  const before = JSON.stringify(first);
  recordAnniversaryMilestone([], first);
  assert.equal(JSON.stringify(first), before);
});

test('duplicate ids and a second entry for the same customer in the same year are refused', () => {
  const list = recordAnniversaryMilestone([], first);
  assert.deepEqual(recordAnniversaryMilestone(list, { ...first, dateReached: '2026-11-09' }), list);
  assert.deepEqual(recordAnniversaryMilestone(list, { ...second, id: 'AM-9', customer: 'ahmed raza', yearsReached: 3 }), list);
  const laterYear = recordAnniversaryMilestone(list, third);
  assert.equal(laterYear.length, 2);
  assert.equal(recordAnniversaryMilestone(laterYear, { ...third, id: 'AM-9', dateReached: '2026-09-21' }).length, 2);
});

test('find and remove work by id', () => {
  const list = [first, second].reduce((acc, item) => recordAnniversaryMilestone(acc, item), []);
  assert.equal(findAnniversaryMilestone(list, 'AM-2').customer, 'Bilal Ahmed');
  assert.equal(findAnniversaryMilestone(list, 'AM-9'), null);
  assert.equal(findAnniversaryMilestone(list, ''), null);
  assert.deepEqual(removeAnniversaryMilestone(list, 'AM-1').map((item) => item.id), ['AM-2']);
  assert.deepEqual(removeAnniversaryMilestone(list, 'AM-9'), list);
});

test('sorting is by date reached, then years, then customer, then id', () => {
  const list = [first, third, second].reduce((acc, item) => recordAnniversaryMilestone(acc, item), []);
  assert.deepEqual(anniversaryMilestoneSorted(list).map((item) => item.id), ['AM-3', 'AM-2', 'AM-1']);
  assert.deepEqual(milestonesForCustomer(list, 'AHMED RAZA').map((item) => item.id), ['AM-3', 'AM-1']);
  assert.deepEqual(milestonesForCustomer(list, ''), []);
  assert.deepEqual(anniversaryMilestoneCustomers(list), ['Ahmed Raza', 'Bilal Ahmed']);
});

test('a milestone is never edited, only annotated with dated follow-ups', () => {
  const list = recordAnniversaryMilestone([], first);
  const noted = addAnniversaryMilestoneNote(list, 'AM-1', '2026-11-08', 'Customer thanked us back.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].followups[0].date, '2026-11-08');
  assert.equal(noted[0].customer, 'Ahmed Raza');
  assert.equal(noted[0].yearsReached, 3);
  assert.equal(noted[0].dateReached, '2026-11-01');
  assert.equal(noted[0].acknowledged, true);
  assert.equal(noted[0].note, 'Thanked in person by Saad.');
  assert.deepEqual(addAnniversaryMilestoneNote(list, 'AM-1', '2026-02-30', 'Bad date.'), list);
  assert.deepEqual(addAnniversaryMilestoneNote(list, 'AM-1', '2026-11-08', ''), list);
  assert.deepEqual(addAnniversaryMilestoneNote(list, 'AM-9', '2026-11-08', 'Unknown entry.'), list);
});

test('summary and entry text show the milestone plainly', () => {
  assert.equal(anniversaryMilestoneSummaryText([]), 'No anniversary milestones recorded.');
  const list = [first, second].reduce((acc, item) => recordAnniversaryMilestone(acc, item), []);
  assert.equal(anniversaryMilestoneSummaryText(list), '2 anniversary milestones: 1 acknowledged, 1 not yet acknowledged.');
  const text = anniversaryMilestoneText(first);
  assert.equal(text.includes('Ahmed Raza — 3 years reached 2026-11-01, acknowledged.'), true);
  assert.equal(text.includes('Note: Thanked in person by Saad.'), true);
  assert.equal(anniversaryMilestoneText(second).includes('Bilal Ahmed — 1 year reached 2026-10-15, not yet acknowledged.'), true);
  assert.equal(anniversaryMilestoneText(null), 'No anniversary milestone recorded.');
  const noted = addAnniversaryMilestoneNote(list, 'AM-1', '2026-11-08', 'Customer thanked us back.');
  assert.equal(anniversaryMilestoneText(noted[0]).includes('Follow-ups: 2026-11-08: Customer thanked us back.'), true);
});

test('HTML escapes markup and the all-list renders in date order', () => {
  const nasty = { ...first, id: 'AM-9', customer: 'Bad <script> Customer', yearsReached: 2, dateReached: '2026-11-02', acknowledged: false, note: 'Fixed & tested' };
  const html = anniversaryMilestoneHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('Fixed &amp; tested'), true);
  assert.equal(anniversaryMilestoneHtml(null), '<p>No anniversary milestone recorded.</p>');
  assert.equal(anniversaryMilestoneAllHtml([]), '<p>No anniversary milestones recorded.</p>');
  const all = anniversaryMilestoneAllHtml([first, second]);
  assert.equal(all.indexOf('Bilal Ahmed') < all.indexOf('Ahmed Raza'), true);
});

test('CSV export has the milestone columns in order', () => {
  const list = [first, second, third].reduce((acc, item) => recordAnniversaryMilestone(acc, item), []);
  const csv = anniversaryMilestoneCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","years reached","date reached","acknowledged","note","follow-ups"');
  assert.equal(lines[1].includes('"Ahmed Raza"'), true);
  assert.equal(lines[1].includes('"5"'), true);
  assert.equal(lines[2].includes('"Bilal Ahmed"'), true);
  assert.equal(lines[2].includes('"no"'), true);
  assert.equal(anniversaryMilestoneFilename(), 'anniversary-milestones.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, dateReached: '2026-11-09' }, { id: 'AM-9' }, null, 'nope', second];
  assert.deepEqual(normalizeAnniversaryMilestoneList(messy).map((item) => item.id), ['AM-1', 'AM-2']);
  assert.deepEqual(normalizeAnniversaryMilestoneList('not a list'), []);
  assert.deepEqual(normalizeAnniversaryMilestoneList(undefined), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../anniversary-milestone.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the recognition list and greeting draft are untouched', () => {
  const source = readFileSync(new URL('../anniversary-milestone.js', import.meta.url), 'utf8');
  assert.equal(source.includes('loyalty-recognition'), false, 'module must not reference the recognition list module');
  assert.equal(source.includes('greeting-date'), false, 'module must not reference the greeting draft module');
  assert.equal(existsSync(new URL('../loyalty-recognition.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../greeting-date.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'amHeading', 'amSummary', 'amList', 'amExportBtn',
    'amCustomer', 'amYears', 'amDateReached', 'amAcknowledged', 'amNote', 'amRecordBtn',
    'amAnnotateId', 'amAnnotateDate', 'amAnnotateNote', 'amAnnotateBtn',
    'amRemoveId', 'amRemoveBtn',
    'amFilterCustomer', 'amFilterBtn', 'amFilterBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the customer anniversary milestone panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './anniversary-milestone.js'"), true);
  assert.equal(source.includes('renderAnniversaryMilestones()'), true);
  assert.equal(source.includes('ANNIVERSARY_MILESTONE_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
