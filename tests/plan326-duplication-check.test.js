import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validDuplicationCheckDay,
  foldDuplicationCheckRecordType,
  foldDuplicationPairDecision,
  normalizeDuplicationPair,
  normalizeDuplicationPairList,
  normalizeDuplicationCheck,
  normalizeDuplicationCheckList,
  findDuplicationCheck,
  recordDuplicationCheck,
  removeDuplicationCheck,
  duplicationChecksForType,
  duplicationCheckRecordTypes,
  duplicationCheckOpenPairs,
  decideDuplicationPair,
  findSuspectedDuplicatePairs,
  duplicationCheckSummaryText,
  duplicationChecksSummaryText,
  duplicationCheckPairText,
  duplicationCheckPairHtml,
  duplicationCheckOpenHtml,
  duplicationCheckAllHtml,
  duplicationCheckCsv,
  duplicationCheckFilename,
} from '../duplication-check.js';

function pair(overrides = {}) {
  return {
    id: 'P-1',
    recordA: 'CUST-1',
    recordB: 'CUST-2',
    matchingFields: ['name', 'phone'],
    decision: 'open',
    reason: '',
    decidedBy: '',
    ...overrides,
  };
}

function check(overrides = {}) {
  return {
    id: 'DPC-1',
    dateChecked: '2026-11-05',
    checkedBy: 'Saad',
    recordType: 'customer',
    pairs: [pair()],
    ...overrides,
  };
}

test('strict calendar dates: real dates pass, impossible dates fail', () => {
  assert.equal(validDuplicationCheckDay('2026-11-05'), true);
  assert.equal(validDuplicationCheckDay('2028-02-29'), true);
  assert.equal(validDuplicationCheckDay('2026-02-29'), false);
  assert.equal(validDuplicationCheckDay('2026-04-31'), false);
  assert.equal(validDuplicationCheckDay('2026-13-01'), false);
  assert.equal(validDuplicationCheckDay('05-11-2026'), false);
  assert.equal(validDuplicationCheckDay(20261105), false);
});

test('record type folds to the fixed list, unknown reads as other', () => {
  assert.equal(foldDuplicationCheckRecordType('Customer'), 'customer');
  assert.equal(foldDuplicationCheckRecordType('BILL'), 'bill');
  assert.equal(foldDuplicationCheckRecordType('payment'), 'payment');
  assert.equal(foldDuplicationCheckRecordType('ledger'), 'other');
  assert.equal(foldDuplicationCheckRecordType(''), 'other');
});

test('pair decision folds to the fixed list, unknown reads as open', () => {
  assert.equal(foldDuplicationPairDecision('DISMISSED'), 'dismissed');
  assert.equal(foldDuplicationPairDecision('confirmed'), 'confirmed');
  assert.equal(foldDuplicationPairDecision('merged'), 'open');
  assert.equal(foldDuplicationPairDecision(''), 'open');
});

test('a pair needs an id, two different records, and a matching field', () => {
  assert.equal(normalizeDuplicationPair(pair()).id, 'P-1');
  assert.equal(normalizeDuplicationPair(pair({ id: '' })), null);
  assert.equal(normalizeDuplicationPair(pair({ recordA: '' })), null);
  assert.equal(normalizeDuplicationPair(pair({ recordB: '' })), null);
  assert.equal(normalizeDuplicationPair(pair({ recordA: 'CUST-1', recordB: 'CUST-1' })), null);
  assert.equal(normalizeDuplicationPair(pair({ matchingFields: [] })), null);
  assert.equal(normalizeDuplicationPair(pair({ matchingFields: 'phone' })), null);
});

test('dismissing a pair needs a recorded reason', () => {
  assert.equal(normalizeDuplicationPair(pair({ decision: 'dismissed' })), null);
  assert.equal(normalizeDuplicationPair(pair({ decision: 'dismissed', reason: 'Same person, two spellings, kept both' })).decision, 'dismissed');
  assert.equal(normalizeDuplicationPair(pair({ decision: 'confirmed', reason: '' })).decision, 'confirmed');
});

test('unknown pair fields are dropped and matching fields sort and dedupe', () => {
  const clean = normalizeDuplicationPair(pair({ matchingFields: ['phone', 'name', 'phone'], billAmount: 3000 }));
  assert.deepEqual(clean.matchingFields, ['name', 'phone']);
  assert.equal('billAmount' in clean, false);
});

test('a check needs an id, a strict date checked, and a checker', () => {
  assert.equal(normalizeDuplicationCheck(check()).id, 'DPC-1');
  assert.equal(normalizeDuplicationCheck(check({ id: '' })), null);
  assert.equal(normalizeDuplicationCheck(check({ dateChecked: '2026-02-30' })), null);
  assert.equal(normalizeDuplicationCheck(check({ checkedBy: '' })), null);
});

test('unknown check fields are dropped and a check with no pairs is a clean check', () => {
  const clean = normalizeDuplicationCheck(check({ pairs: [], customerName: 'Someone' }));
  assert.deepEqual(clean.pairs, []);
  assert.equal('customerName' in clean, false);
  assert.equal(clean.recordType, 'customer');
});

test('duplicate pair ids inside one check are never rewritten', () => {
  const clean = normalizeDuplicationPairList([pair(), pair({ recordB: 'CUST-9' })]);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].recordB, 'CUST-2');
});

test('recording a check: half-formed and duplicate ids leave the list unchanged', () => {
  assert.deepEqual(recordDuplicationCheck([], check()), [normalizeDuplicationCheck(check())]);
  assert.deepEqual(recordDuplicationCheck([check()], check({ checkedBy: 'Other' })), [normalizeDuplicationCheck(check())]);
  assert.deepEqual(recordDuplicationCheck([check()], check({ id: '' })), [normalizeDuplicationCheck(check())]);
});

test('removing and finding checks by id', () => {
  assert.deepEqual(removeDuplicationCheck([check(), check({ id: 'DPC-2' })], 'DPC-1'), [normalizeDuplicationCheck(check({ id: 'DPC-2' }))]);
  assert.deepEqual(removeDuplicationCheck([check()], 'DPC-9'), [normalizeDuplicationCheck(check())]);
  assert.equal(findDuplicationCheck([check()], 'DPC-1').checkedBy, 'Saad');
  assert.equal(findDuplicationCheck([check()], 'DPC-9'), null);
});

test('checks list by type, newest date checked first', () => {
  const list = [
    check({ id: 'DPC-1', dateChecked: '2026-11-01', recordType: 'bill' }),
    check({ id: 'DPC-2', dateChecked: '2026-11-05', recordType: 'customer' }),
    check({ id: 'DPC-3', dateChecked: '2026-11-03', recordType: 'customer' }),
  ];
  assert.deepEqual(duplicationChecksForType(list, 'CUSTOMER').map((item) => item.id), ['DPC-2', 'DPC-3']);
  assert.deepEqual(duplicationCheckRecordTypes(list), ['bill', 'customer']);
});

test('phone match suspects a pair; name plus another field suspects a pair', () => {
  const records = [
    { id: 'CUST-1', name: 'Ahmed Raza', phone: '03001234567', mohalla: 'Shahdara' },
    { id: 'CUST-2', name: 'Ahmed Raza', phone: '03001234567', mohalla: 'Shahdara' },
  ];
  const found = findSuspectedDuplicatePairs(records);
  assert.equal(found.length, 1);
  assert.equal(found[0].recordA, 'CUST-1');
  assert.equal(found[0].recordB, 'CUST-2');
  assert.deepEqual(found[0].matchingFields, ['name', 'phone']);
  assert.equal(found[0].decision, 'open');
});

test('a single name match alone never suspects a pair', () => {
  const records = [
    { id: 'CUST-1', name: 'Ahmed Raza', phone: '03001234567' },
    { id: 'CUST-2', name: 'Ahmed Raza', phone: '03009998877' },
  ];
  assert.deepEqual(findSuspectedDuplicatePairs(records), []);
});

test('phone digits are compared, so formatting differences do not hide a match', () => {
  const records = [
    { id: 'CUST-1', name: 'Bilal', phone: '0300 1234567' },
    { id: 'CUST-2', name: 'Kiran', phone: '03001234567' },
  ];
  const found = findSuspectedDuplicatePairs(records);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].matchingFields, ['phone']);
});

test('no match, empty fields, and the same id are never suspected', () => {
  const records = [
    { id: 'CUST-1', name: 'Ahmed', phone: '03001111111' },
    { id: 'CUST-2', name: 'Bilal', phone: '03002222222' },
    { id: 'CUST-3', name: '', phone: '' },
  ];
  assert.deepEqual(findSuspectedDuplicatePairs(records), []);
  assert.deepEqual(findSuspectedDuplicatePairs([{ id: 'CUST-1', name: 'Ahmed', phone: '03001111111' }, { id: 'CUST-1', name: 'Ahmed', phone: '03001111111' }]), []);
  assert.deepEqual(findSuspectedDuplicatePairs('not a list'), []);
  assert.deepEqual(findSuspectedDuplicatePairs([{ id: 'CUST-1', name: 'Ahmed', phone: '03001111111' }], []), []);
});

test('dismissing without a reason is refused; with a reason it changes only that pair', () => {
  const list = [check({ pairs: [pair(), pair({ id: 'P-2', recordA: 'CUST-3', recordB: 'CUST-4' })] })];
  assert.deepEqual(decideDuplicationPair(list, 'DPC-1', 'P-1', 'dismissed', '', 'Saad'), normalizeDuplicationCheckList(list));
  const decided = decideDuplicationPair(list, 'DPC-1', 'P-1', 'dismissed', 'Two brothers, not one customer', 'Saad');
  assert.equal(decided[0].pairs[0].decision, 'dismissed');
  assert.equal(decided[0].pairs[0].reason, 'Two brothers, not one customer');
  assert.equal(decided[0].pairs[0].decidedBy, 'Saad');
  assert.equal(decided[0].pairs[1].decision, 'open');
  assert.equal(decided[0].pairs[1].reason, '');
});

test('deciding a missing check or pair, or confirming, behaves plainly', () => {
  const list = [check()];
  assert.deepEqual(decideDuplicationPair(list, 'DPC-9', 'P-1', 'dismissed', 'Reason', 'Saad'), normalizeDuplicationCheckList(list));
  assert.deepEqual(decideDuplicationPair(list, 'DPC-1', 'P-9', 'dismissed', 'Reason', 'Saad'), normalizeDuplicationCheckList(list));
  const confirmed = decideDuplicationPair(list, 'DPC-1', 'P-1', 'confirmed', 'Same customer twice', 'Saad');
  assert.equal(confirmed[0].pairs[0].decision, 'confirmed');
});

test('open pairs list only the undecided pairs', () => {
  const decided = check({ pairs: [pair(), pair({ id: 'P-2', recordA: 'CUST-3', recordB: 'CUST-4', decision: 'dismissed', reason: 'Brothers' })] });
  assert.deepEqual(duplicationCheckOpenPairs(decided).map((item) => item.id), ['P-1']);
  assert.equal(duplicationCheckOpenPairs(null).length, 0);
});

test('summary texts name the check, the counts, and the open pairs', () => {
  assert.equal(
    duplicationCheckSummaryText(check()),
    'Check DPC-1 on 2026-11-05 by Saad (customer): 1 suspected pair, 1 open, 0 dismissed, 0 confirmed.',
  );
  assert.equal(duplicationChecksSummaryText([]), 'No duplication checks recorded.');
  assert.equal(duplicationChecksSummaryText([check()]), '1 duplication check, 1 suspected pair, 1 still open.');
  assert.equal(duplicationCheckPairText(pair()), 'CUST-1 and CUST-2 match on name, phone — open.');
  assert.equal(
    duplicationCheckPairText(pair({ decision: 'dismissed', reason: 'Brothers', decidedBy: 'Saad' })),
    'CUST-1 and CUST-2 match on name, phone — dismissed — Brothers (Saad).',
  );
});

test('HTML escapes user text and the open list says so when nothing is open', () => {
  const html = duplicationCheckPairHtml(pair({ recordA: '<script>alert(1)</script>' }));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(duplicationCheckOpenHtml(check({ pairs: [] })), '<p>No open suspected pairs.</p>');
  assert.equal(duplicationCheckAllHtml([]), '<p>No duplication checks recorded.</p>');
  assert.equal(duplicationCheckAllHtml([check()]).includes('Check DPC-1 on 2026-11-05'), true);
});

test('CSV has one row per pair and quotes cells with commas', () => {
  const csv = duplicationCheckCsv([check({ pairs: [pair({ decision: 'dismissed', reason: 'Two brothers, not one', decidedBy: 'Saad' })] })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'check id,date checked,checked by,record type,pair id,record a,record b,matching fields,decision,reason,decided by');
  assert.equal(lines.length, 2);
  assert.equal(lines[1].includes('"Two brothers, not one"'), true);
  assert.equal(duplicationCheckFilename(), 'duplication-checks.csv');
});

test('record, decide, and the finder never mutate their inputs', () => {
  const before = [check()];
  const frozen = JSON.parse(JSON.stringify(before));
  Object.freeze(before);
  Object.freeze(before[0]);
  Object.freeze(before[0].pairs);
  Object.freeze(before[0].pairs[0]);
  recordDuplicationCheck(before, check({ id: 'DPC-2' }));
  decideDuplicationPair(before, 'DPC-1', 'P-1', 'dismissed', 'Reason', 'Saad');
  assert.deepEqual(JSON.parse(JSON.stringify(before)), frozen);
  const records = [
    { id: 'CUST-1', name: 'Ahmed', phone: '03001111111' },
    { id: 'CUST-2', name: 'Ahmed', phone: '03001111111' },
  ];
  const recordsFrozen = JSON.parse(JSON.stringify(records));
  findSuspectedDuplicatePairs(records);
  assert.deepEqual(records, recordsFrozen);
});
