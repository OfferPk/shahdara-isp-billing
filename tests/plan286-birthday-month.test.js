import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  MONTH_NAMES,
  validBirthdayDate,
  validBirthdayMonth,
  monthName,
  normalizeBirthdayRow,
  normalizeBirthdayRows,
  birthdaysForMonth,
  birthdaysByMonth,
  birthdayMonthSummaryText,
  birthdayMonthText,
  birthdayMonthHtml,
  birthdayMonthsHtml,
  birthdayMonthCsv,
  birthdayMonthsCsv,
  birthdayMonthFilename,
  birthdayMonthsFilename,
} from '../birthday-month.js';

const ali = { customer: 'Ali', date: '1990-01-15', mohalla: 'Bani' };
const sara = { customer: 'Sara', date: '1992-01-03', mohalla: 'Bani' };
const zain = { customer: 'Zain', date: '1993-01-15', mohalla: 'Shahdara Kalan' };
const ahmed = { customer: 'Ahmed', date: '1988-02-29', mohalla: 'Shahdara Kalan' };
const bilal = { customer: 'Bilal', date: '1995-03-31', mohalla: '' };
const hina = { customer: 'Hina', date: '1991-12-25', mohalla: 'Bani' };
const fixture = [ali, sara, zain, ahmed, bilal, hina];

test('half-formed rows are refused', () => {
  assert.equal(normalizeBirthdayRow(null), null);
  assert.equal(normalizeBirthdayRow('nope'), null);
  assert.equal(normalizeBirthdayRow({ ...ali, customer: '  ' }), null);
  assert.equal(normalizeBirthdayRow({ ...ali, date: '' }), null);
  assert.equal(normalizeBirthdayRow({ ...ali, date: '2026-02-30' }), null);
  assert.equal(normalizeBirthdayRow({ ...ali, date: '15-01-1990' }), null);
  const row = normalizeBirthdayRow(ali);
  assert.deepEqual(row, { customer: 'Ali', date: '1990-01-15', month: 1, birthDay: 15, mohalla: 'Bani' });
  assert.deepEqual(normalizeBirthdayRow({ customer: 'Noor', date: '1994-06-07' }),
    { customer: 'Noor', date: '1994-06-07', month: 6, birthDay: 7, mohalla: '' });
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validBirthdayDate('2026-08-31'), true);
  assert.equal(validBirthdayDate('2026-10-31'), true);
  assert.equal(validBirthdayDate('2026-12-31'), true);
  assert.equal(validBirthdayDate('2026-02-29'), false);
  assert.equal(validBirthdayDate('2028-02-29'), true);
  assert.equal(validBirthdayDate('1988-02-29'), true);
  assert.equal(validBirthdayDate('2026-04-31'), false);
  assert.equal(validBirthdayDate('2026-13-01'), false);
  assert.equal(validBirthdayDate('02-11-2026'), false);
  assert.equal(validBirthdayDate(''), false);
  assert.equal(validBirthdayDate(null), false);
  assert.equal(validBirthdayMonth(1), true);
  assert.equal(validBirthdayMonth(12), true);
  assert.equal(validBirthdayMonth('3'), true);
  assert.equal(validBirthdayMonth(0), false);
  assert.equal(validBirthdayMonth(13), false);
  assert.equal(validBirthdayMonth('jan'), false);
  assert.equal(validBirthdayMonth(null), false);
  assert.equal(monthName(1), 'January');
  assert.equal(monthName(12), 'December');
  assert.equal(monthName(13), '');
  assert.equal(MONTH_NAMES.length, 12);
});

test('anniversary rows are dropped, a missing kind is fine', () => {
  assert.equal(normalizeBirthdayRow({ ...ali, kind: 'anniversary' }), null);
  assert.equal(normalizeBirthdayRow({ ...ali, kind: 'ANNIVERSARY' }), null);
  assert.notEqual(normalizeBirthdayRow({ ...ali, kind: 'birthday' }), null);
  assert.notEqual(normalizeBirthdayRow({ ...ali, kind: 'Birthday' }), null);
  assert.notEqual(normalizeBirthdayRow(ali), null);
  const rows = normalizeBirthdayRows([
    { ...ali, kind: 'anniversary' },
    { ...sara, kind: 'birthday' },
  ]);
  assert.deepEqual(rows.map((row) => row.customer), ['Sara']);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...ali, billAmount: 1500, package: '5 Mbps', surprise: 'x' };
  const row = normalizeBirthdayRow(raw);
  assert.equal(row.customer, 'Ali');
  assert.equal('billAmount' in row, false);
  assert.equal('package' in row, false);
  assert.equal('surprise' in row, false);
  assert.equal(raw.billAmount, 1500);
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'customer', 'date', 'mohalla', 'package', 'surprise']);
});

test('one birth date per customer keeps the first', () => {
  const rows = normalizeBirthdayRows([
    ali,
    { customer: 'ALI', date: '1991-05-05', mohalla: 'Bani' },
    sara,
  ]);
  assert.deepEqual(rows.map((row) => row.customer), ['Ali', 'Sara']);
  assert.equal(rows[0].date, '1990-01-15');
  assert.deepEqual(normalizeBirthdayRows('nope'), []);
  assert.deepEqual(normalizeBirthdayRows(null), []);
});

test("each month's list shows exactly that month's customers on the same fixture", () => {
  const january = birthdaysForMonth(fixture, 1);
  assert.equal(january.month, 1);
  assert.equal(january.monthName, 'January');
  assert.deepEqual(january.entries.map((entry) => entry.customer), ['Sara', 'Ali', 'Zain']);
  assert.equal(january.count, 3);
  assert.equal(january.hasBirthdays, true);
  assert.deepEqual(birthdaysForMonth(fixture, 2).entries.map((entry) => entry.customer), ['Ahmed']);
  assert.deepEqual(birthdaysForMonth(fixture, '3').entries.map((entry) => entry.customer), ['Bilal']);
  assert.deepEqual(birthdaysForMonth(fixture, 12).entries.map((entry) => entry.customer), ['Hina']);
  assert.deepEqual(birthdaysForMonth(fixture, 4).entries, []);
  assert.equal(birthdaysForMonth(fixture, 4).hasBirthdays, false);
  assert.equal(birthdaysForMonth(fixture, 0), null);
  assert.equal(birthdaysForMonth(fixture, 13), null);
  assert.equal(birthdaysForMonth(fixture, 'jan'), null);
  const all = birthdaysByMonth(fixture);
  assert.equal(all.length, 12);
  assert.deepEqual(all.map((view) => view.count), [3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(all.map((view) => view.count).reduce((a, b) => a + b, 0), fixture.length);
});

test('a month with no birthdays says so plainly', () => {
  const april = birthdaysForMonth(fixture, 4);
  assert.equal(birthdayMonthText(april), 'No birthdays in April.');
  assert.equal(birthdayMonthHtml(april), '<p>No birthdays in April.</p>');
  assert.equal(birthdayMonthText(null), 'Give a month from 1 to 12 to see its birthdays.');
  assert.equal(birthdayMonthHtml(null), '<p>Give a month from 1 to 12 to see its birthdays.</p>');
  assert.equal(birthdayMonthsHtml([]), '<p>No birthdays recorded.</p>');
  const january = birthdaysForMonth(fixture, 1);
  assert.equal(birthdayMonthText(january).includes('January: 3 birthdays'), true);
  assert.equal(birthdayMonthText(january).includes('Sara — day 3'), true);
});

test('a month list is sorted by birth day then customer A-Z', () => {
  const rows = normalizeBirthdayRows([zain, ali, sara]);
  assert.deepEqual(birthdaysForMonth(rows, 1).entries.map((entry) => entry.customer), ['Sara', 'Ali', 'Zain']);
  assert.deepEqual(birthdaysForMonth(rows, 1).entries.map((entry) => entry.birthDay), [3, 15, 15]);
});

test('mohalla is kept, a missing mohalla reads blank', () => {
  assert.equal(birthdaysForMonth(fixture, 3).entries[0].mohalla, '');
  assert.equal(birthdaysForMonth(fixture, 1).entries[0].mohalla, 'Bani');
  assert.equal(birthdayMonthHtml(birthdaysForMonth(fixture, 3)).includes('Mohalla not recorded'), true);
});

test('summary text names the counts plainly', () => {
  assert.equal(birthdayMonthSummaryText([]), 'No birthdays recorded.');
  assert.equal(birthdayMonthSummaryText([ali]), '1 birthday recorded across 1 month.');
  assert.equal(birthdayMonthSummaryText(fixture), '6 birthdays recorded across 4 months.');
});

test('html escapes input', () => {
  const evil = { customer: '<script>alert(1)</script>', date: '1990-01-15', mohalla: 'Bani' };
  const html = birthdayMonthHtml(birthdaysForMonth([evil], 1));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(birthdayMonthsHtml(birthdaysByMonth([evil])).includes('&lt;script&gt;'), true);
});

test('csv export and filenames', () => {
  const csv = birthdayMonthCsv(birthdaysForMonth(fixture, 1));
  const lines = csv.split('\n');
  assert.equal(lines[0], 'month,customer,birth day,birth date,mohalla');
  assert.equal(lines.length, 5);
  assert.equal(lines[1].includes('Sara'), true);
  assert.equal(lines[1].includes('January'), true);
  assert.equal(birthdayMonthCsv(birthdaysForMonth(fixture, 4)), 'month,customer,birth day,birth date,mohalla\n');
  const year = birthdayMonthsCsv(fixture).split('\n');
  assert.equal(year[0], 'month,customer,birth day,birth date,mohalla');
  assert.equal(year.length, 8);
  assert.equal(birthdayMonthFilename(1), 'birthdays-january.csv');
  assert.equal(birthdayMonthFilename(12), 'birthdays-december.csv');
  assert.equal(birthdayMonthFilename(13), 'birthdays.csv');
  assert.equal(birthdayMonthsFilename(), 'birthdays-all-months.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { customer: '', date: '2026-11-10', mohalla: 'Bani' };
  const out = normalizeBirthdayRows([bad, ali, { ...ali, date: '1991-05-05' }, sara, 'nope', null]);
  assert.deepEqual(out.map((row) => row.customer), ['Ali', 'Sara']);
  assert.equal(out[0].date, '1990-01-15');
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../birthday-month.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the birthday greeting draft record is untouched', () => {
  const source = readFileSync(new URL('../birthday-month.js', import.meta.url), 'utf8');
  assert.equal(source.includes('greeting-date.js'), false, 'module must not reference the greeting draft module');
  assert.equal(existsSync(new URL('../greeting-date.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'bmHeading', 'bmSummary', 'bmMonth', 'bmShowBtn', 'bmBody',
    'bmYearBody', 'bmExportBtn', 'bmExportYearBtn',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the birthday month panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './birthday-month.js'"), true);
  assert.equal(source.includes('renderBirthdayMonth()'), true);
  assert.equal(source.includes('birthdayMonthRows()'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
