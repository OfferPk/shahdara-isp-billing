import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validDataEntryErrorDay,
  foldDataEntryErrorType,
  normalizeDataEntryError,
  normalizeDataEntryErrorList,
  findDataEntryError,
  recordDataEntryError,
  removeDataEntryError,
  dataEntryErrorsForType,
  dataEntryErrorTypes,
  dataEntryErrorCountsByType,
  dataEntryErrorSummaryText,
  dataEntryErrorEntryText,
  dataEntryErrorEntryHtml,
  dataEntryErrorsByTypeHtml,
  dataEntryErrorAllHtml,
  dataEntryErrorCsv,
  dataEntryErrorFilename,
} from '../data-entry-error-log.js';

const first = {
  id: 'DEE-1',
  recordAffected: 'Customer CUST-1 bill Nov 2026',
  errorType: 'wrong amount',
  dateFound: '2026-11-02',
  correctionRef: 'CORR-12',
  foundBy: 'Saad',
  note: 'Amount typed 3000 instead of 2000',
};
const second = {
  id: 'DEE-2',
  recordAffected: 'Customer CUST-2 payment 2026-11-03',
  errorType: 'wrong customer',
  dateFound: '2026-11-04',
  correctionRef: 'CORR-15',
  foundBy: '',
  note: '',
};
const third = {
  id: 'DEE-3',
  recordAffected: 'Customer CUST-3 bill Nov 2026',
  errorType: 'wrong amount',
  dateFound: '2026-11-03',
  correctionRef: 'CORR-14',
};

test('strict dates: real calendar dates pass, impossible ones fail', () => {
  assert.equal(validDataEntryErrorDay('2026-11-05'), true);
  assert.equal(validDataEntryErrorDay('2028-02-29'), true);
  assert.equal(validDataEntryErrorDay('2026-02-29'), false);
  assert.equal(validDataEntryErrorDay('2026-02-30'), false);
  assert.equal(validDataEntryErrorDay('2026-13-01'), false);
  assert.equal(validDataEntryErrorDay('2026-11-00'), false);
  assert.equal(validDataEntryErrorDay('05-11-2026'), false);
  assert.equal(validDataEntryErrorDay('2026/11/05'), false);
  assert.equal(validDataEntryErrorDay(''), false);
  assert.equal(validDataEntryErrorDay(20261105), false);
  assert.equal(validDataEntryErrorDay(null), false);
});

test('error types fold to the fixed list, unknown reads as other', () => {
  assert.equal(foldDataEntryErrorType('wrong amount'), 'wrong amount');
  assert.equal(foldDataEntryErrorType('Wrong Customer'), 'wrong customer');
  assert.equal(foldDataEntryErrorType('  WRONG DATE  '), 'wrong date');
  assert.equal(foldDataEntryErrorType('wrong package'), 'wrong package');
  assert.equal(foldDataEntryErrorType('wrong mohalla'), 'wrong mohalla');
  assert.equal(foldDataEntryErrorType('spelling mistake'), 'other');
  assert.equal(foldDataEntryErrorType(''), 'other');
  assert.equal(foldDataEntryErrorType(undefined), 'other');
});

test('a full record normalises, keeping every field', () => {
  assert.deepEqual(normalizeDataEntryError(first), {
    id: 'DEE-1',
    recordAffected: 'Customer CUST-1 bill Nov 2026',
    errorType: 'wrong amount',
    dateFound: '2026-11-02',
    correctionRef: 'CORR-12',
    foundBy: 'Saad',
    note: 'Amount typed 3000 instead of 2000',
  });
});

test('a half-formed record is refused: no id, record, strict date, or correction link', () => {
  assert.equal(normalizeDataEntryError({ ...first, id: '' }), null);
  assert.equal(normalizeDataEntryError({ ...first, recordAffected: '   ' }), null);
  assert.equal(normalizeDataEntryError({ ...first, dateFound: '2026-02-30' }), null);
  assert.equal(normalizeDataEntryError({ ...first, dateFound: '2 Nov 2026' }), null);
  assert.equal(normalizeDataEntryError({ ...first, correctionRef: '' }), null);
  assert.equal(normalizeDataEntryError({ ...first, correctionRef: undefined }), null);
  assert.equal(normalizeDataEntryError(null), null);
  assert.equal(normalizeDataEntryError('DEE-1'), null);
  assert.equal(normalizeDataEntryError([first]), null);
});

test('unknown fields are dropped, so no bill, payment, or customer field can survive', () => {
  const clean = normalizeDataEntryError({ ...first, amount: 3000, customerId: 'CUST-1', billMonth: '2026-11' });
  assert.equal(clean.amount, undefined);
  assert.equal(clean.customerId, undefined);
  assert.equal(clean.billMonth, undefined);
  assert.equal(clean.id, 'DEE-1');
});

test('normalising never mutates the input', () => {
  const raw = { ...first, extra: 'drop me' };
  const before = JSON.stringify(raw);
  normalizeDataEntryError(raw);
  assert.equal(JSON.stringify(raw), before);
});

test('a list drops bad records and keeps the first of a duplicate id', () => {
  const list = normalizeDataEntryErrorList([first, { ...first, note: 'second copy' }, second, { ...second, id: '' }]);
  assert.deepEqual(list.map((entry) => entry.id), ['DEE-1', 'DEE-2']);
  assert.equal(list[0].note, 'Amount typed 3000 instead of 2000');
  assert.deepEqual(normalizeDataEntryErrorList('not a list'), []);
  assert.deepEqual(normalizeDataEntryErrorList(null), []);
});

test('recording adds a record, refuses half-formed ones and duplicate ids', () => {
  const list = [first];
  assert.equal(recordDataEntryError(list, second).length, 2);
  assert.deepEqual(recordDataEntryError(list, { ...second, dateFound: '2026-11-31' }), list);
  assert.deepEqual(recordDataEntryError(list, { ...second, id: 'DEE-1' }), list);
  assert.deepEqual(recordDataEntryError(list, { ...second, correctionRef: '' }), list);
});

test('removing drops only that record; a missing id leaves the list unchanged', () => {
  const list = [first, second, third];
  assert.deepEqual(removeDataEntryError(list, 'DEE-2').map((entry) => entry.id), ['DEE-1', 'DEE-3']);
  assert.deepEqual(removeDataEntryError(list, 'DEE-9'), normalizeDataEntryErrorList(list));
  assert.deepEqual(removeDataEntryError(list, ''), normalizeDataEntryErrorList(list));
});

test('find returns one record by id, or null', () => {
  assert.equal(findDataEntryError([first, second], 'DEE-2').recordAffected, 'Customer CUST-2 payment 2026-11-03');
  assert.equal(findDataEntryError([first, second], 'DEE-9'), null);
  assert.equal(findDataEntryError([first, second], '  DEE-1  ').id, 'DEE-1');
});

test('errors for one type list newest first, then id A-Z', () => {
  const list = [first, second, third];
  assert.deepEqual(dataEntryErrorsForType(list, 'wrong amount').map((entry) => entry.id), ['DEE-3', 'DEE-1']);
  assert.deepEqual(dataEntryErrorsForType(list, 'WRONG CUSTOMER').map((entry) => entry.id), ['DEE-2']);
  assert.deepEqual(dataEntryErrorsForType(list, 'wrong date'), []);
});

test('types present list A-Z with no repeats', () => {
  assert.deepEqual(dataEntryErrorTypes([first, second, third]), ['wrong amount', 'wrong customer']);
  assert.deepEqual(dataEntryErrorTypes([]), []);
});

test('counts by type over a period are inclusive and leave out-of-period errors out', () => {
  const list = [first, second, third];
  assert.deepEqual(dataEntryErrorCountsByType(list, '2026-11-02', '2026-11-03'), [
    { errorType: 'wrong amount', count: 2 },
  ]);
  assert.deepEqual(dataEntryErrorCountsByType(list, '2026-11-01', '2026-11-30'), [
    { errorType: 'wrong amount', count: 2 },
    { errorType: 'wrong customer', count: 1 },
  ]);
  assert.deepEqual(dataEntryErrorCountsByType(list, '2026-11-05', '2026-11-06'), []);
});

test('a bad period returns null, never a guessed count', () => {
  const list = [first, second];
  assert.equal(dataEntryErrorCountsByType(list, '2026-02-30', '2026-11-30'), null);
  assert.equal(dataEntryErrorCountsByType(list, '2026-11-01', 'not a date'), null);
  assert.equal(dataEntryErrorCountsByType(list, '2026-11-10', '2026-11-01'), null);
});

test('summary text counts the whole log by type', () => {
  assert.equal(dataEntryErrorSummaryText([]), 'No data entry errors logged.');
  assert.equal(
    dataEntryErrorSummaryText([first, second, third]),
    '3 data entry errors logged: 2 wrong amount, 1 wrong customer.',
  );
  assert.equal(
    dataEntryErrorSummaryText([first]),
    '1 data entry error logged: 1 wrong amount.',
  );
});

test('one error as plain words always names its correction link', () => {
  assert.equal(
    dataEntryErrorEntryText(first),
    '2026-11-02: wrong amount on Customer CUST-1 bill Nov 2026 (correction CORR-12), found by Saad — Amount typed 3000 instead of 2000',
  );
  assert.equal(
    dataEntryErrorEntryText(second),
    '2026-11-04: wrong customer on Customer CUST-2 payment 2026-11-03 (correction CORR-15)',
  );
  assert.equal(dataEntryErrorEntryText({ ...first, id: '' }), '');
});

test('HTML escapes user text and groups errors by type', () => {
  const nasty = { ...first, note: '<script>alert(1)</script>', recordAffected: 'Customer "A & B" bill' };
  const html = dataEntryErrorEntryHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('Customer &quot;A &amp; B&quot; bill'), true);
  const grouped = dataEntryErrorsByTypeHtml([first, second, third]);
  assert.equal(grouped.indexOf('wrong amount') < grouped.indexOf('wrong customer'), true);
  assert.equal(dataEntryErrorsByTypeHtml([]), '<p>No data entry errors logged.</p>');
  assert.equal(dataEntryErrorAllHtml([]).includes('No data entry errors logged.'), true);
});

test('CSV has one header row and one row per error, quoting commas and quotes', () => {
  const csv = dataEntryErrorCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,record affected,error type,date found,correction reference,found by,note');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].startsWith('DEE-1,Customer CUST-1 bill Nov 2026,wrong amount,2026-11-02,CORR-12,Saad,'), true);
  const quoted = dataEntryErrorCsv([{ ...first, note: 'said "fix it", then fixed' }]);
  assert.equal(quoted.includes('"said ""fix it"", then fixed"'), true);
  assert.equal(dataEntryErrorCsv([]), 'id,record affected,error type,date found,correction reference,found by,note');
  assert.equal(dataEntryErrorFilename(), 'data-entry-errors.csv');
});

test('recording and removing never mutate the input list', () => {
  const list = [first, second];
  const before = JSON.stringify(list);
  recordDataEntryError(list, third);
  removeDataEntryError(list, 'DEE-1');
  assert.equal(JSON.stringify(list), before);
});

test('the module is pure: it reads no storage, clock, or network', () => {
  const source = readFileSync(new URL('../data-entry-error-log.js', import.meta.url), 'utf8');
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('XMLHttpRequest'), false);
});

test('the module keeps its fences: no fenced file, no clock, no OLT', () => {
  const source = readFileSync(new URL('../data-entry-error-log.js', import.meta.url), 'utf8');
  for (const fenced of ['billing-corrections', 'print-template-register', 'duplicate-detection']) {
    assert.equal(source.includes(fenced), false, `module must not name the fenced module ${fenced}`);
  }
  assert.equal(source.includes('OLT'), false);
});
