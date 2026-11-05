import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customerCompletenessFields,
  customerCompletenessFieldLabel,
  customerCompletenessFieldPresent,
  scoreCustomerCompleteness,
  scoreCustomerCompletenessList,
  customerCompletenessIncomplete,
  customerCompletenessSummary,
  customerCompletenessScoreText,
  customerCompletenessSummaryText,
  customerCompletenessScoreHtml,
  customerCompletenessAllHtml,
  customerCompletenessCsv,
  customerCompletenessFilename,
} from '../customer-completeness.js';

function record(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Ahmed Raza',
    phone: '03001234567',
    mohalla: 'Shahdara',
    address: 'House 12, Main Road',
    package: '15 Mbps Unlimited',
    ...overrides,
  };
}

test('expected fields are fixed: name, phone, mohalla, address, package', () => {
  assert.deepEqual(customerCompletenessFields(), [
    'name',
    'phone',
    'mohalla',
    'address',
    'package',
  ]);
  assert.equal(customerCompletenessFieldLabel('phone'), 'Phone');
  assert.equal(customerCompletenessFieldLabel('mohalla'), 'Mohalla');
});

test('a field is present only with a real value, never blank or spaces', () => {
  assert.equal(customerCompletenessFieldPresent('03001234567'), true);
  assert.equal(customerCompletenessFieldPresent('  '), false);
  assert.equal(customerCompletenessFieldPresent(''), false);
  assert.equal(customerCompletenessFieldPresent(undefined), false);
  assert.equal(customerCompletenessFieldPresent(null), false);
  assert.equal(customerCompletenessFieldPresent(1500), true);
  assert.equal(customerCompletenessFieldPresent(false), false);
});

test('a full record scores 100 percent and is complete', () => {
  const scored = scoreCustomerCompleteness(record());
  assert.deepEqual(scored, {
    id: 'CUST-1',
    name: 'Ahmed Raza',
    present: 5,
    expected: 5,
    missingFields: [],
    score: 100,
    complete: true,
  });
});

test('missing phone, address and package score 40 percent with missing listed in order', () => {
  const scored = scoreCustomerCompleteness(
    record({ phone: '', address: '   ', package: undefined }),
  );
  assert.equal(scored.present, 2);
  assert.equal(scored.score, 40);
  assert.equal(scored.complete, false);
  assert.deepEqual(scored.missingFields, ['phone', 'address', 'package']);
});

test('one missing field scores 80 percent', () => {
  const scored = scoreCustomerCompleteness(record({ mohalla: '' }));
  assert.equal(scored.score, 80);
  assert.deepEqual(scored.missingFields, ['mohalla']);
});

test('a record with no id, or not an object, scores null instead of a guessed score', () => {
  assert.equal(scoreCustomerCompleteness(record({ id: '' })), null);
  assert.equal(scoreCustomerCompleteness(record({ id: '   ' })), null);
  assert.equal(scoreCustomerCompleteness({ name: 'No Id' }), null);
  assert.equal(scoreCustomerCompleteness(null), null);
  assert.equal(scoreCustomerCompleteness('CUST-1'), null);
  assert.equal(scoreCustomerCompleteness(['CUST-1']), null);
});

test('the score recomputes exactly from the same fixture, and changes with the fields', () => {
  const first = scoreCustomerCompleteness(record({ phone: '' }));
  const second = scoreCustomerCompleteness(record({ phone: '' }));
  assert.deepEqual(first, second);
  const changed = scoreCustomerCompleteness(record({ phone: '', address: '' }));
  assert.equal(changed.score, 60);
  assert.notDeepEqual(first, changed);
});

test('scoring never mutates the record', () => {
  const input = record({ phone: '' });
  const frozen = Object.freeze({ ...input });
  const before = JSON.stringify(frozen);
  scoreCustomerCompleteness(frozen);
  assert.equal(JSON.stringify(frozen), before);
});

test('the list sorts most incomplete first, then name A-Z, then id', () => {
  const scored = scoreCustomerCompletenessList([
    record({ id: 'CUST-3', name: 'Zahid', phone: '' }),
    record({ id: 'CUST-1', name: 'Ahmed Raza' }),
    record({ id: 'CUST-2', name: 'Bilal', phone: '', address: '' }),
    record({ id: 'CUST-4', name: 'Ahmed Raza', phone: '' }),
  ]);
  assert.deepEqual(
    scored.map((item) => item.id),
    ['CUST-2', 'CUST-4', 'CUST-3', 'CUST-1'],
  );
});

test('records with no id are skipped from the list, never scored with a guessed id', () => {
  const scored = scoreCustomerCompletenessList([
    record(),
    { name: 'No Id', phone: '03001234567' },
  ]);
  assert.equal(scored.length, 1);
  assert.equal(scored[0].id, 'CUST-1');
  assert.deepEqual(scoreCustomerCompletenessList('not a list'), []);
});

test('the incomplete filter keeps only records with missing fields', () => {
  const scored = scoreCustomerCompletenessList([
    record(),
    record({ id: 'CUST-2', phone: '' }),
  ]);
  const incomplete = customerCompletenessIncomplete(scored);
  assert.equal(incomplete.length, 1);
  assert.equal(incomplete[0].id, 'CUST-2');
  assert.deepEqual(customerCompletenessIncomplete('not a list'), []);
});

test('the summary counts totals and names the most missing fields', () => {
  const scored = scoreCustomerCompletenessList([
    record(),
    record({ id: 'CUST-2', phone: '' }),
    record({ id: 'CUST-3', phone: '', address: '' }),
  ]);
  const summary = customerCompletenessSummary(scored);
  assert.equal(summary.totalRecords, 3);
  assert.equal(summary.completeRecords, 1);
  assert.equal(summary.incompleteRecords, 2);
  assert.equal(summary.totalPresent, 12);
  assert.equal(summary.totalExpected, 15);
  assert.equal(summary.averageScore, 80);
  assert.deepEqual(summary.missingFieldCounts, {
    name: 0,
    phone: 2,
    mohalla: 0,
    address: 1,
    package: 0,
  });
});

test('the average score is a whole percent rounded down, and an empty list reads zero', () => {
  const summary = customerCompletenessSummary([
    { present: 2, expected: 15, complete: false, missingFields: [] },
    { present: 1, expected: 15, complete: false, missingFields: [] },
  ]);
  assert.equal(summary.averageScore, 10);
  assert.deepEqual(customerCompletenessSummary([]), {
    totalRecords: 0,
    completeRecords: 0,
    incompleteRecords: 0,
    totalPresent: 0,
    totalExpected: 0,
    averageScore: 0,
    missingFieldCounts: { name: 0, phone: 0, mohalla: 0, address: 0, package: 0 },
  });
});

test('score text names the missing fields in plain words', () => {
  assert.equal(
    customerCompletenessScoreText(scoreCustomerCompleteness(record())),
    'CUST-1 (Ahmed Raza): 100% complete — 5 of 5 fields present.',
  );
  assert.equal(
    customerCompletenessScoreText(
      scoreCustomerCompleteness(record({ phone: '', package: '' })),
    ),
    'CUST-1 (Ahmed Raza): 60% complete — 3 of 5 fields present; missing Phone, Package.',
  );
  assert.equal(customerCompletenessScoreText(null), 'No completeness score.');
});

test('summary text covers the shop-wide gap, and reads plainly when empty', () => {
  assert.equal(customerCompletenessSummaryText([]), 'No customer records scored.');
  const scored = scoreCustomerCompletenessList([
    record(),
    record({ id: 'CUST-2', phone: '' }),
    record({ id: 'CUST-3', phone: '', address: '' }),
  ]);
  assert.equal(
    customerCompletenessSummaryText(scored),
    '3 customer records scored, 1 complete, 2 incomplete, 12 of 15 fields present, average 80%. Most missing: 2 missing Phone, 1 missing Address.',
  );
});

test('HTML escapes user text in names and never shows a raw tag', () => {
  const html = customerCompletenessScoreHtml(
    scoreCustomerCompleteness(record({ name: '<script>alert(1)</script>' })),
  );
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.equal(customerCompletenessScoreHtml(null), '');
});

test('the full HTML list carries the summary first, then each record', () => {
  const html = customerCompletenessAllHtml(
    scoreCustomerCompletenessList([record(), record({ id: 'CUST-2', phone: '' })]),
  );
  assert.ok(html.includes('2 customer records scored, 1 complete, 1 incomplete'));
  assert.ok(html.includes('CUST-2 (Ahmed Raza): 80% complete'));
  assert.equal(customerCompletenessAllHtml([]), '<p>No customer records scored.</p>');
});

test('CSV has one row per record with the missing fields named', () => {
  const csv = customerCompletenessCsv(
    scoreCustomerCompletenessList([record(), record({ id: 'CUST-2', phone: '', address: '' })]),
  );
  const lines = csv.split('\n');
  assert.equal(
    lines[0],
    'customer id,customer name,fields present,fields expected,score percent,complete,missing fields',
  );
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes('CUST-2,Ahmed Raza,3,5,60,no,Phone; Address'));
  assert.ok(lines[2].startsWith('CUST-1,Ahmed Raza,5,5,100,yes,'));
  assert.equal(customerCompletenessCsv([]).split('\n').length, 1);
});

test('CSV quotes a name that carries a comma', () => {
  const csv = customerCompletenessCsv([
    scoreCustomerCompleteness(record({ name: 'Raza, Ahmed' })),
  ]);
  assert.ok(csv.includes('"Raza, Ahmed"'));
});

test('the CSV filename is fixed', () => {
  assert.equal(customerCompletenessFilename(), 'customer-completeness.csv');
});
