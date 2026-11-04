import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GREETING_KINDS,
  normalizeGreetingDate,
  normalizeGreetingDateList,
  findGreetingDate,
  upsertGreetingDate,
  removeGreetingDate,
  markGreetingSent,
  greetingForCustomer,
  greetingCustomers,
  upcomingGreetings,
  greetingSummaryText,
  greetingDraft,
  greetingAllHtml,
  greetingCustomerHtml,
  greetingUpcomingHtml,
  greetingCsv,
  greetingFilename,
} from '../greeting-date.js';

const dir = dirname(fileURLToPath(import.meta.url));

const gd = (over = {}) => ({
  id: 'GD-1',
  customer: 'Ahmed',
  kind: 'birthday',
  date: '2026-11-10',
  draft: '',
  sentDate: '',
  sentYear: null,
  ...over,
});

test('strict dates: 31-day months pass, Feb 30 and Apr 31 refused, Feb 29 leap only', () => {
  assert.equal(normalizeGreetingDate(gd({ date: '2026-08-31' })).date, '2026-08-31');
  assert.equal(normalizeGreetingDate(gd({ date: '2026-10-31' })).date, '2026-10-31');
  assert.equal(normalizeGreetingDate(gd({ date: '2026-12-31' })).date, '2026-12-31');
  assert.equal(normalizeGreetingDate(gd({ date: '2026-02-30' })), null);
  assert.equal(normalizeGreetingDate(gd({ date: '2026-04-31' })), null);
  assert.equal(normalizeGreetingDate(gd({ date: '2024-02-29' })).date, '2024-02-29');
  assert.equal(normalizeGreetingDate(gd({ date: '2026-02-29' })), null);
});

test('half-formed refusal: no customer, no kind, bad kind, no date, no id', () => {
  assert.equal(normalizeGreetingDate(gd({ customer: '' })), null);
  assert.equal(normalizeGreetingDate(gd({ kind: '' })), null);
  assert.equal(normalizeGreetingDate(gd({ kind: 'wedding' })), null);
  assert.equal(normalizeGreetingDate(gd({ date: '' })), null);
  assert.equal(normalizeGreetingDate(gd({ id: '' })), null);
  assert.equal(normalizeGreetingDate(gd({ sentDate: 'not-a-date' })), null);
});

test('kind case normalization and unknown-field drop', () => {
  const record = normalizeGreetingDate(gd({ kind: 'Birthday', billId: 'B-9', offer: '50% off' }));
  assert.equal(record.kind, 'birthday');
  assert.equal('billId' in record, false);
  assert.equal('offer' in record, false);
});

test('duplicate-id rules: identical re-save unchanged, different figures refused', () => {
  const list = [gd()];
  assert.deepEqual(upsertGreetingDate(list, gd()), list);
  assert.deepEqual(upsertGreetingDate(list, gd({ date: '2026-11-11' })), list);
});

test('one date per customer per kind, both kinds allowed for one customer', () => {
  const list = [gd()];
  assert.deepEqual(upsertGreetingDate(list, gd({ id: 'GD-2', date: '2026-12-01' })), list);
  assert.deepEqual(upsertGreetingDate(list, gd({ id: 'GD-2', customer: 'ahmed' })), list);
  const both = upsertGreetingDate(list, gd({ id: 'GD-2', kind: 'anniversary', date: '2026-05-01' }));
  assert.equal(both.length, 2);
});

test('find and remove', () => {
  const list = [gd(), gd({ id: 'GD-2', customer: 'Bilal', kind: 'anniversary', date: '2026-05-01' })];
  assert.equal(findGreetingDate(list, 'GD-2').customer, 'Bilal');
  assert.equal(findGreetingDate(list, 'GD-9'), null);
  assert.deepEqual(removeGreetingDate(list, 'GD-1').map((r) => r.id), ['GD-2']);
});

test('customer view: case-insensitive match, kind order', () => {
  const list = [
    gd({ id: 'GD-2', kind: 'anniversary', date: '2026-05-01' }),
    gd(),
    gd({ id: 'GD-3', customer: 'Bilal', kind: 'birthday', date: '2026-03-03' }),
  ];
  assert.deepEqual(greetingForCustomer(list, 'AHMED').map((r) => r.kind), ['anniversary', 'birthday']);
  assert.deepEqual(greetingForCustomer(list, ''), []);
  assert.deepEqual(greetingCustomers(list), ['Ahmed', 'Bilal']);
});

test('upcoming: seven-day window, today included, day eight excluded', () => {
  const list = [
    gd({ id: 'GD-T', date: '2020-11-04' }),
    gd({ id: 'GD-7', customer: 'Bilal', date: '2020-11-11' }),
    gd({ id: 'GD-8', customer: 'Chaudhry', date: '2020-11-12' }),
    gd({ id: 'GD-P', customer: 'Danish', date: '2020-11-03' }),
  ];
  const upcoming = upcomingGreetings(list, '2026-11-04');
  assert.deepEqual(upcoming.map((r) => r.id), ['GD-T', 'GD-7']);
  assert.equal(upcoming[0].daysUntil, 0);
  assert.equal(upcoming[1].daysUntil, 7);
});

test('upcoming: year boundary wraps Dec into Jan', () => {
  const list = [gd({ date: '2020-01-02' })];
  const upcoming = upcomingGreetings(list, '2026-12-30');
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].daysUntil, 3);
  assert.equal(upcoming[0].occurrenceYear, 2027);
});

test('upcoming: Feb 29 falls back to Feb 28 in a non-leap year', () => {
  const list = [gd({ date: '2024-02-29' })];
  const upcoming = upcomingGreetings(list, '2026-02-26');
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].daysUntil, 2);
});

test('upcoming: invalid reference date gives an empty list, never a guess', () => {
  assert.deepEqual(upcomingGreetings([gd()], 'not-a-date'), []);
});

test('mark sent: same occurrence not repeated, other occurrences still listed', () => {
  const list = [gd({ date: '2020-11-06' })];
  const sent = markGreetingSent(list, 'GD-1', '2026-11-04');
  assert.equal(sent[0].sentDate, '2026-11-04');
  assert.equal(sent[0].sentYear, 2026);
  assert.deepEqual(upcomingGreetings(sent, '2026-11-04'), []);
  // Next year the same date comes round again and is listed once more.
  assert.equal(upcomingGreetings(sent, '2027-11-01').length, 1);
  assert.deepEqual(markGreetingSent(list, 'GD-9', '2026-11-04'), list);
  assert.deepEqual(markGreetingSent(list, 'GD-1', 'bad-date'), list);
});

test('drafts: Roman Urdu and Urdu script per kind, custom draft wins', () => {
  assert.match(greetingDraft(gd(), 'roman'), /Janam din mubarak ho, Ahmed/);
  assert.match(greetingDraft(gd({ kind: 'anniversary' }), 'roman'), /Connection anniversary mubarak ho, Ahmed/);
  assert.match(greetingDraft(gd(), 'urdu'), /سالگرہ مبارک ہو/);
  assert.match(greetingDraft(gd({ kind: 'anniversary' }), 'urdu'), /کنکشن کی سالگرہ مبارک ہو/);
  assert.equal(greetingDraft(gd({ draft: 'My own words' }), 'urdu'), 'My own words');
  assert.equal(greetingDraft(null, 'roman'), '');
});

test('summary text counts dates and customers', () => {
  assert.match(greetingSummaryText([gd()]), /1 greeting date for 1 customer/);
  assert.match(greetingSummaryText([gd(), gd({ id: 'GD-2', customer: 'Bilal' })]), /2 greeting dates for 2 customers/);
});

test('HTML escapes customer text and draft', () => {
  const html = greetingAllHtml([gd({ customer: '<b>Ahmed</b>', draft: '<script>alert(1)</script>' })]);
  assert.equal(html.includes('<b>Ahmed</b>'), false);
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(greetingCustomerHtml([gd()], 'Nobody'), /No greeting date stored/);
  assert.match(greetingUpcomingHtml([], '2026-11-04'), /next seven days/);
});

test('CSV and filename', () => {
  const csv = greetingCsv([gd({ draft: 'Hello, friend' })]);
  assert.match(csv, /^id,customer,kind,date,draft,sentDate,sentYear\n/);
  assert.match(csv, /"Hello, friend"/);
  assert.equal(greetingFilename(), 'greeting-dates.csv');
});

test('non-mutation: inputs are never changed', () => {
  const input = gd({ draft: '  Hello  ' });
  const before = JSON.stringify(input);
  normalizeGreetingDate(input);
  upsertGreetingDate([], input);
  markGreetingSent([input], 'GD-1', '2026-11-04');
  assert.equal(JSON.stringify(input), before);
});

test('purity fence: module never reads storage, clock, or network', () => {
  const source = readFileSync(join(dir, '..', 'greeting-date.js'), 'utf8');
  assert.equal(/localStorage/.test(source), false);
  assert.equal(/fetch\(/.test(source), false);
  assert.equal(/new Date/.test(source), false);
  assert.equal(/^import /m.test(source), false);
  assert.equal(GREETING_KINDS.length, 2);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['gdCustomer', 'gdKind', 'gdDate', 'gdDraft', 'gdSaveBtn', 'gdSentId', 'gdMarkSentBtn', 'gdRemoveId', 'gdRemoveBtn', 'gdFilter', 'gdRefDate', 'gdCustomerBody', 'gdUpcomingBody', 'gdBody', 'gdSummary', 'gdExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
