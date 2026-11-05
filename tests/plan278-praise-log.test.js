import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validPraiseLogDate,
  normalizePraiseLogList,
  recordPraiseLog,
  removePraiseLog,
  findPraiseLog,
  praiseLogSorted,
  praiseLogsForCustomer,
  praiseLogsForSubject,
  praiseLogCustomers,
  praiseLogSubjects,
  praiseLogSummaryText,
  praiseLogText,
  praiseLogHtml,
  praiseLogAllHtml,
  praiseLogCsv,
  praiseLogFilename,
} from '../praise-log.js';

const first = { id: 'PZ-1', customer: 'Ahmed Raza', date: '2026-11-08', description: 'Said the net has been steady all month and the speed is good.', subject: 'Saad' };
const second = { id: 'PZ-2', customer: 'Ahmed Raza', date: '2026-11-10', description: 'Thanked the shop for fixing the line the same day.', subject: 'same-day fix' };
const third = { id: 'PZ-3', customer: 'Bilal Khan', date: '2026-11-09', description: 'Said the bill reminder call was polite and helpful.', subject: 'Saad' };

test('half-formed praise is refused', () => {
  assert.deepEqual(recordPraiseLog([], { ...first, id: '' }), []);
  assert.deepEqual(recordPraiseLog([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordPraiseLog([], { ...first, description: '' }), []);
  assert.deepEqual(recordPraiseLog([], { ...first, description: '   ' }), []);
  assert.deepEqual(recordPraiseLog([], { ...first, date: '' }), []);
  assert.deepEqual(recordPraiseLog([], { ...first, date: '2026-02-30' }), []);
  const recorded = recordPraiseLog([], { ...first, subject: '' });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].subject, '');
  const recordedNoSubject = recordPraiseLog([], { id: 'PZ-9', customer: 'Sara Bibi', date: '2026-11-11', description: 'Said the service is worth the price.' });
  assert.equal(recordedNoSubject.length, 1);
  assert.equal(recordedNoSubject[0].subject, '');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validPraiseLogDate('2026-08-31'), true);
  assert.equal(validPraiseLogDate('2026-10-31'), true);
  assert.equal(validPraiseLogDate('2026-12-31'), true);
  assert.equal(validPraiseLogDate('2026-02-29'), false);
  assert.equal(validPraiseLogDate('2028-02-29'), true);
  assert.equal(validPraiseLogDate('2026-04-31'), false);
  assert.equal(validPraiseLogDate('2026-13-01'), false);
  assert.equal(validPraiseLogDate('10-11-2026'), false);
  assert.equal(validPraiseLogDate(''), false);
  assert.equal(validPraiseLogDate(null), false);
  assert.deepEqual(recordPraiseLog([], { ...first, date: '2026-02-30' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 1500, paymentStatus: 'paid', surprise: 'x' };
  const recorded = recordPraiseLog([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('paymentStatus' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.billAmount, 1500);
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'customer', 'date', 'description', 'id', 'paymentStatus', 'subject', 'surprise']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordPraiseLog([], first);
  assert.deepEqual(recordPraiseLog(list, { ...first, description: 'Changed.' }), list);
  assert.deepEqual(recordPraiseLog(list, { ...second, id: 'PZ-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordPraiseLog(acc, item), []);
  assert.equal(findPraiseLog(list, 'PZ-2').customer, 'Ahmed Raza');
  assert.equal(findPraiseLog(list, 'PZ-9'), null);
  assert.equal(findPraiseLog(list, ''), null);
  assert.deepEqual(removePraiseLog(list, 'PZ-2').map((item) => item.id), ['PZ-1', 'PZ-3']);
  assert.deepEqual(removePraiseLog(list, ''), list);
});

test('a customer page lists praise in date order', () => {
  const list = [second, first, third].reduce((acc, item) => recordPraiseLog(acc, item), []);
  assert.deepEqual(praiseLogsForCustomer(list, 'ahmed raza').map((item) => item.id), ['PZ-1', 'PZ-2']);
  assert.deepEqual(praiseLogsForCustomer(list, 'Bilal Khan').map((item) => item.id), ['PZ-3']);
  assert.deepEqual(praiseLogsForCustomer(list, ''), []);
  assert.deepEqual(praiseLogsForCustomer(list, 'Nobody'), []);
  assert.deepEqual(praiseLogSorted(list).map((item) => item.id), ['PZ-1', 'PZ-3', 'PZ-2']);
});

test('praise for one subject names the subject', () => {
  const list = [first, second, third].reduce((acc, item) => recordPraiseLog(acc, item), []);
  assert.deepEqual(praiseLogsForSubject(list, 'saad').map((item) => item.id), ['PZ-1', 'PZ-3']);
  assert.deepEqual(praiseLogsForSubject(list, 'same-day fix').map((item) => item.id), ['PZ-2']);
  assert.deepEqual(praiseLogsForSubject(list, ''), []);
  assert.deepEqual(praiseLogsForSubject(list, 'Nobody'), []);
});

test('customer and subject lists keep the first spelling', () => {
  const list = [
    { id: 'PZ-1', customer: 'Ahmed Raza', date: '2026-11-08', description: 'Good.', subject: 'Saad' },
    { id: 'PZ-2', customer: 'AHMED RAZA', date: '2026-11-09', description: 'Great.', subject: 'SAAD' },
    { id: 'PZ-3', customer: 'Bilal Khan', date: '2026-11-09', description: 'Fine.', subject: 'Speed' },
  ].reduce((acc, item) => recordPraiseLog(acc, item), []);
  assert.deepEqual(praiseLogCustomers(list), ['Ahmed Raza', 'Bilal Khan']);
  assert.deepEqual(praiseLogSubjects(list), ['Saad', 'Speed']);
  assert.deepEqual(praiseLogSubjects([]), []);
});

test('summary and entry text name the customer, date, description, and subject plainly', () => {
  assert.equal(praiseLogSummaryText([]), 'No praise recorded.');
  assert.equal(praiseLogSummaryText([first, second]), '2 praise entries recorded, about 2 subjects.');
  assert.equal(praiseLogSummaryText([first]), '1 praise entry recorded, about 1 subject.');
  assert.equal(praiseLogSummaryText([{ ...first, subject: '' }]), '1 praise entry recorded, about 0 subjects.');
  const text = praiseLogText(first);
  assert.equal(text.includes('2026-11-08'), true);
  assert.equal(text.includes('Ahmed Raza'), true);
  assert.equal(text.includes('steady all month'), true);
  assert.equal(text.includes('Praised: Saad.'), true);
  assert.equal(praiseLogText(second).includes('Praised: same-day fix.'), true);
  assert.equal(praiseLogText({ ...first, subject: '' }).includes('Praised:'), false);
  assert.equal(praiseLogText(null), 'No praise recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, description: '<script>alert(1)</script>' };
  const html = praiseLogHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(praiseLogHtml(null), '<p>No praise recorded.</p>');
  assert.equal(praiseLogAllHtml([]), '<p>No praise recorded.</p>');
  assert.equal(praiseLogAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = praiseLogCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","date","description","subject"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('PZ-1'), true);
  assert.equal(lines[1].includes('steady all month'), true);
  assert.equal(praiseLogFilename(), 'praise-log.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'PZ-9', customer: '', date: '2026-11-10', description: 'No customer.' };
  const out = normalizePraiseLogList([bad, first, { ...first, description: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['PZ-1', 'PZ-2']);
  assert.equal(out[0].description, first.description);
  assert.deepEqual(normalizePraiseLogList('nope'), []);
  assert.deepEqual(normalizePraiseLogList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../praise-log.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the complaint log and the testimonial consent note are untouched', () => {
  const source = readFileSync(new URL('../praise-log.js', import.meta.url), 'utf8');
  assert.equal(source.includes('complaint-register.js'), false, 'module must not reference the complaint log module');
  assert.equal(source.includes('testimonial-consent.js'), false, 'module must not reference the testimonial consent note module');
  assert.equal(existsSync(new URL('../complaint-register.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../testimonial-consent.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'pzHeading', 'pzSummary', 'pzList', 'pzExportBtn',
    'pzCustomer', 'pzDate', 'pzDescription', 'pzSubject', 'pzRecordBtn',
    'pzRemoveId', 'pzRemoveBtn',
    'pzSubjectBody', 'pzSubjectFilter', 'pzSubjectBtn',
    'pzFilterCustomer', 'pzFilterBtn', 'pzCustomerBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the praise log panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './praise-log.js'"), true);
  assert.equal(source.includes('renderPraiseLog()'), true);
  assert.equal(source.includes('PRAISE_LOG_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
