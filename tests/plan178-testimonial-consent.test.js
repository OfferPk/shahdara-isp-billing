import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeTestimonialConsent,
  normalizeTestimonialConsentList,
  findTestimonialConsent,
  upsertTestimonialConsent,
  removeTestimonialConsent,
  withdrawTestimonialConsent,
  testimonialForCustomer,
  usableTestimonials,
  customersWithConsent,
  testimonialConsentText,
  testimonialConsentSummaryText,
  testimonialConsentHtml,
  testimonialConsentAllHtml,
  testimonialConsentCsv,
  testimonialConsentFilename,
} from '../testimonial-consent.js';

const dir = dirname(fileURLToPath(import.meta.url));

const note = (over = {}) => ({
  id: 'TC-1',
  customerId: 'Cust A',
  agreed: true,
  form: 'name',
  agreementDate: '2026-11-01',
  words: 'Net is fast and the shop always answers.',
  ...over,
});

test('half-formed notes are refused, agreed notes need a strict date', () => {
  assert.equal(normalizeTestimonialConsent(note({ id: '' })), null);
  assert.equal(normalizeTestimonialConsent(note({ customerId: '  ' })), null);
  assert.equal(normalizeTestimonialConsent(note({ agreementDate: '2026-02-30' })), null);
  assert.equal(normalizeTestimonialConsent(note({ agreementDate: '2026-13-01' })), null);
  assert.equal(normalizeTestimonialConsent(note({ agreementDate: 'not-a-date' })), null);
  assert.equal(normalizeTestimonialConsent(null), null);
  // A note that does not say agreed needs no date or form.
  const declined = normalizeTestimonialConsent(note({ agreed: false, agreementDate: '', form: '' }));
  assert.ok(declined);
  assert.equal(declined.agreed, false);
  assert.equal(declined.form, '');
  assert.equal(declined.agreementDate, '');
});

test('strict dates accept 31-day months and leap-day rules', () => {
  assert.ok(normalizeTestimonialConsent(note({ agreementDate: '2026-08-31' })));
  assert.ok(normalizeTestimonialConsent(note({ agreementDate: '2024-02-29' })));
  assert.equal(normalizeTestimonialConsent(note({ agreementDate: '2026-02-29' })), null);
  assert.equal(normalizeTestimonialConsent(note({ agreementDate: '2026-04-31' })), null);
});

test('form normalizes to name, mohalla, or anonymous', () => {
  assert.equal(normalizeTestimonialConsent(note({ form: 'Mohalla' })).form, 'mohalla');
  assert.equal(normalizeTestimonialConsent(note({ form: 'anonymous' })).form, 'anonymous');
  // An unrecognised form falls back to anonymous, the safest form.
  assert.equal(normalizeTestimonialConsent(note({ form: 'on a billboard' })).form, 'anonymous');
  assert.equal(normalizeTestimonialConsent(note({ form: '' })).form, 'anonymous');
});

test('unknown fields are dropped, words stay exactly as given', () => {
  const clean = normalizeTestimonialConsent(note({ billId: 'B-9', publishNow: true, words: '  Great service!  ' }));
  assert.equal(clean.billId, undefined);
  assert.equal(clean.publishNow, undefined);
  assert.equal(clean.words, 'Great service!');
});

test('duplicate ids are never rewritten', () => {
  const base = upsertTestimonialConsent([], note());
  assert.equal(upsertTestimonialConsent(base, note()).length, 1);
  assert.equal(upsertTestimonialConsent(base, note({ words: 'Changed words.' })).length, 1);
  assert.equal(findTestimonialConsent(base, 'TC-1').words, 'Net is fast and the shop always answers.');
});

test('one consent note per customer, case-insensitive', () => {
  const base = upsertTestimonialConsent([], note());
  assert.equal(upsertTestimonialConsent(base, note({ id: 'TC-2', customerId: 'cust a' })).length, 1);
  assert.equal(upsertTestimonialConsent(base, note({ id: 'TC-2', customerId: 'Cust B' })).length, 2);
});

test('find and remove', () => {
  const base = upsertTestimonialConsent([], note());
  assert.equal(findTestimonialConsent(base, 'TC-1').customerId, 'Cust A');
  assert.equal(findTestimonialConsent(base, 'nope'), null);
  assert.equal(findTestimonialConsent(base, ''), null);
  assert.equal(removeTestimonialConsent(base, 'TC-1').length, 0);
  assert.equal(removeTestimonialConsent(base, 'nope').length, 1);
});

test('withdrawing consent immediately marks the testimonial unusable', () => {
  const base = upsertTestimonialConsent([], note());
  const withdrawn = withdrawTestimonialConsent(base, 'TC-1');
  const record = findTestimonialConsent(withdrawn, 'TC-1');
  assert.equal(record.agreed, false);
  assert.equal(record.form, '');
  assert.equal(record.agreementDate, '');
  assert.equal(record.words, 'Net is fast and the shop always answers.');
  assert.equal(usableTestimonials(withdrawn).length, 0);
  // Withdrawing again, or an unknown id, leaves the list unchanged.
  assert.deepEqual(withdrawTestimonialConsent(withdrawn, 'TC-1'), withdrawn);
  assert.deepEqual(withdrawTestimonialConsent(base, 'nope'), base);
});

test('customer lookup is case-insensitive, usable list is agreed-only and A-Z', () => {
  let list = [];
  list = upsertTestimonialConsent(list, note({ id: 'TC-1', customerId: 'Zara' }));
  list = upsertTestimonialConsent(list, note({ id: 'TC-2', customerId: 'Ali', agreed: false, form: '', agreementDate: '' }));
  list = upsertTestimonialConsent(list, note({ id: 'TC-3', customerId: 'Bilal', form: 'anonymous' }));
  assert.equal(testimonialForCustomer(list, 'zara').id, 'TC-1');
  assert.equal(testimonialForCustomer(list, 'nobody'), null);
  assert.deepEqual(usableTestimonials(list).map((item) => item.customerId), ['Bilal', 'Zara']);
  assert.deepEqual(customersWithConsent(list), ['Ali', 'Bilal', 'Zara']);
});

test('consent text states form, date, and the customer’s own words', () => {
  assert.equal(
    testimonialConsentText(note()),
    'Testimonial for Cust A: agreed to share with name on 2026-11-01. Words: "Net is fast and the shop always answers."',
  );
  assert.equal(
    testimonialConsentText(note({ form: 'anonymous', words: '' })),
    'Testimonial for Cust A: agreed to share anonymously on 2026-11-01.',
  );
  assert.ok(testimonialConsentText(note({ agreed: false, form: '', agreementDate: '' })).includes('not usable'));
  assert.equal(testimonialConsentText(null), '');
});

test('summary counts usable and not usable', () => {
  let list = [];
  list = upsertTestimonialConsent(list, note());
  list = upsertTestimonialConsent(list, note({ id: 'TC-2', customerId: 'Cust B', agreed: false, form: '', agreementDate: '' }));
  assert.equal(testimonialConsentSummaryText(list), '2 consent notes, 1 usable, 1 not usable');
  assert.equal(testimonialConsentSummaryText([]), '0 consent notes, 0 usable, 0 not usable');
});

test('HTML escapes markup, all-HTML handles an empty list', () => {
  const html = testimonialConsentHtml(note({ customerId: '<b>Cust</b>', words: 'A & B <great>' }));
  assert.ok(!html.includes('<b>Cust</b>'));
  assert.ok(html.includes('&lt;b&gt;Cust&lt;/b&gt;'));
  assert.ok(html.includes('A &amp; B &lt;great&gt;'));
  assert.equal(testimonialConsentHtml(null), '');
  assert.ok(testimonialConsentAllHtml([]).includes('No testimonial consent notes.'));
});

test('CSV export and filename', () => {
  const csv = testimonialConsentCsv([note()]);
  assert.ok(csv.startsWith('id,customerId,agreed,form,agreementDate,words'));
  assert.ok(csv.includes('"TC-1","Cust A","yes","name","2026-11-01","Net is fast and the shop always answers."'));
  assert.equal(testimonialConsentFilename(), 'testimonial-consents.csv');
});

test('inputs are never mutated', () => {
  const input = note();
  const snapshot = JSON.stringify(input);
  upsertTestimonialConsent([], input);
  withdrawTestimonialConsent([input], 'TC-1');
  assert.equal(JSON.stringify(input), snapshot);
});

test('list normalization drops bad records and non-lists', () => {
  assert.deepEqual(normalizeTestimonialConsentList(null), []);
  assert.deepEqual(normalizeTestimonialConsentList([note(), note({ id: '' })]).length, 1);
});

test('purity fence: the module never reads storage, the clock, or the network', () => {
  const source = readFileSync(join(dir, '..', 'testimonial-consent.js'), 'utf8');
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['tcHeading', 'tcSummary', 'tcExportBtn', 'tcCustomer', 'tcAgreed', 'tcForm', 'tcDate', 'tcWords', 'tcSaveBtn', 'tcWithdrawId', 'tcWithdrawBtn', 'tcRemoveId', 'tcRemoveBtn', 'tcFilter', 'tcBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the testimonial-consent panel and render loop', () => {
  const source = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(source.includes("from './testimonial-consent.js'"));
  assert.ok(source.includes('shahdara_testimonial_consent_v1'));
  assert.ok(source.includes('renderTestimonialConsent();'));
});

test('no standalone OLT word added to app.js', () => {
  const source = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(!/(^|[^A-Za-z])OLT([^A-Za-z]|$)/.test(source));
});
