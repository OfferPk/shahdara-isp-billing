// Sharafat 88: receivables ageing (Plan 7 bill-age ageing +
// Plan 213 per-mohalla note) renders in Urdu mode.
//
// 48 new ageing_* keys move every hardcoded English string the two
// ageing modules render — bucket labels + descriptions, table
// headings, the unaged-section heading, the summary/row-text
// sentences, and both CSV headers — behind t(). The data model stays
// English-canonical (AGEING_BUCKETS labels/descriptions, view labels,
// row.note 'No dues.'), so every existing English pin survives
// verbatim and the renderers map key -> t() at render time only.
//
// Fixture uses generic placeholder names only — no real customers, no
// phones. (Ayesha/Bilal/Chand, Bani/Shahdara/Saddar; asOf 2026-11;
// one current + one 1-month + one unaged entry.)
import test from 'node:test';
import assert from 'node:assert/strict';

import { TRANSLATIONS } from '../nav-language.js';
import {
  AGEING_BUCKETS,
  buildReceivablesAgeing,
  ageingHtml,
  ageingCsv,
  ageingMohallaLabel,
} from '../receivables-ageing.js';
import {
  MOHALLA_AGEING_BUCKETS,
  buildMohallaAgeing,
  mohallaAgeingLabel,
  mohallaAgeingSummaryText,
  mohallaAgeingRowText,
  mohallaAgeingHtml,
  mohallaAgeingCsv,
} from '../mohalla-ageing.js';

const URDU = /[\u0600-\u06FF]/;
const AS_OF = '2026-11';
const entries = [
  { customerId: 'c1', customerName: 'Ayesha', mohalla: 'Bani', billMonth: '2026-11', amount: 500000 },
  { customerId: 'c2', customerName: 'Bilal', mohalla: 'Bani', billMonth: '2026-10', amount: 250000 },
  { customerId: 'c3', customerName: 'Chand', mohalla: 'Shahdara', billMonth: 'unknown', amount: 150000 },
];
const view = buildReceivablesAgeing(entries, AS_OF);
const summary = buildMohallaAgeing(view, ['Bani', 'Shahdara', 'Saddar']);
const baniRow = summary.rows.find((row) => row.key === 'BANI');
const shahdaraRow = summary.rows.find((row) => row.key === 'SHAHDARA');
const saddarRow = summary.rows.find((row) => row.key === 'SADDAR');

// The 48 ageing_* keys (prep §4.3) — EN byte-identical to the
// pre-change literals; UR values are proposals for the parent to check.
const AGEING_KEYS = [
  'ageing_bucket_current',
  'ageing_bucket_one',
  'ageing_bucket_two',
  'ageing_bucket_three_plus',
  'ageing_bucket_current_desc',
  'ageing_bucket_one_desc',
  'ageing_bucket_two_desc',
  'ageing_bucket_three_plus_desc',
  'ageing_unaged',
  'ageing_unassigned',
  'ageing_no_dues',
  'ageing_col_age_bucket',
  'ageing_col_meaning',
  'ageing_col_amount',
  'ageing_col_bills',
  'ageing_col_customers',
  'ageing_col_mohalla',
  'ageing_col_total',
  'ageing_col_customer',
  'ageing_col_bill_months',
  'ageing_col_bill_month_as_recorded',
  'ageing_col_note',
  'ageing_col_bill_month_unreadable',
  'ageing_heading_mohalla_totals',
  'ageing_heading_customers',
  'ageing_heading_unaged',
  'ageing_total_outstanding',
  'ageing_empty_no_bills',
  'ageing_empty_no_mohallas',
  'ageing_business_total',
  'ageing_totals_mismatch',
  'ageing_intro',
  'ageing_intro_mohalla',
  'ageing_summary_no_empty',
  'ageing_summary_with_empty',
  'ageing_word_mohalla',
  'ageing_word_mohallas',
  'ageing_row_with_dues',
  'ageing_row_unaged_part',
  'ageing_csv_bucket',
  'ageing_csv_customer',
  'ageing_csv_mohalla',
  'ageing_csv_bill_month',
  'ageing_csv_amount',
  'ageing_csv_total',
  'ageing_csv_bills',
  'ageing_csv_note',
  'ageing_csv_bill_month_unreadable',
];

test('dictionary: all 48 ageing_* keys exist in BOTH dicts, non-empty', () => {
  assert.equal(AGEING_KEYS.length, 48);
  for (const key of AGEING_KEYS) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `${key} missing in en`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `${key} empty in en`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `${key} missing in ur`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `${key} empty in ur`);
  }
  // Symmetric coverage: no ageing_* key exists in one dict only (a
  // missing pair would print the raw key name in the UI instead of
  // failing loudly, and would break the en/ur parity pin).
  for (const key of Object.keys(TRANSLATIONS.en)) {
    if (key.startsWith('ageing_')) assert.ok(key in TRANSLATIONS.ur, `${key} missing in ur`);
  }
  for (const key of Object.keys(TRANSLATIONS.ur)) {
    if (key.startsWith('ageing_')) assert.ok(key in TRANSLATIONS.en, `${key} missing in en`);
  }
});

test('dictionary: EN values are byte-identical to the pre-change literals', () => {
  assert.equal(TRANSLATIONS.en.ageing_bucket_current, 'Current');
  assert.equal(TRANSLATIONS.en.ageing_bucket_one, '1 month');
  assert.equal(TRANSLATIONS.en.ageing_bucket_two, '2 months');
  assert.equal(TRANSLATIONS.en.ageing_bucket_three_plus, '3+ months');
  assert.equal(TRANSLATIONS.en.ageing_bucket_current_desc, 'Bill month is the as-of month');
  assert.equal(TRANSLATIONS.en.ageing_unaged, 'Unaged');
  assert.equal(TRANSLATIONS.en.ageing_unassigned, 'Unassigned');
  assert.equal(TRANSLATIONS.en.ageing_no_dues, 'No dues.');
  assert.equal(TRANSLATIONS.en.ageing_heading_unaged, 'Bills without a readable bill month (counted in the total, in no bucket)');
  assert.equal(TRANSLATIONS.en.ageing_total_outstanding, 'Total outstanding (bills)');
  assert.equal(TRANSLATIONS.en.ageing_empty_no_bills, 'No outstanding bills.');
  assert.equal(TRANSLATIONS.en.ageing_empty_no_mohallas, 'No mohallas recorded.');
  assert.equal(TRANSLATIONS.en.ageing_business_total, 'Business total');
  assert.equal(TRANSLATIONS.en.ageing_csv_bucket, 'bucket');
  assert.equal(TRANSLATIONS.en.ageing_csv_bill_month_unreadable, 'bill month unreadable');
});

test('dictionary: every UR value carries Urdu script', () => {
  for (const key of AGEING_KEYS) {
    // The four word keys that are numbers/latin by design ('1 month'
    // family) still carry Urdu script in their UR values; every other
    // key must too.
    assert.match(TRANSLATIONS.ur[key], URDU, `${key} has no Urdu script`);
  }
});

test('Urdu HTML: receivables table shows Urdu bucket labels, headings, intro', () => {
  const html = ageingHtml(view, 'ur');
  assert.match(html, /موجودہ/);
  assert.match(html, /1 ماہ/);
  assert.match(html, /2 ماہ/);
  assert.match(html, /3\+ ماہ/);
  assert.match(html, /بل کے مہینے کے حساب سے وصولیوں کی عمر/);
  assert.match(html, /ایسے بل جن کا مہینہ پڑھا نہیں جا سکا/);
  assert.match(html, /محلوں کے کل/);
  assert.match(html, /کل واجب الادا \(بل\)/);
  assert.match(html, /عمر کا درجہ/);
  assert.doesNotMatch(html, /<td>Current<\/td>/);
  assert.doesNotMatch(html, /<td>1 month<\/td>/);
  assert.doesNotMatch(html, /<td>2 months<\/td>/);
  assert.doesNotMatch(html, /<td>3\+ months<\/td>/);
  assert.doesNotMatch(html, /Bills without a readable bill month/);
  assert.doesNotMatch(html, /Total outstanding \(bills\)/);
  assert.doesNotMatch(html, /Mohalla totals/);
});

test('Urdu HTML: per-bucket customer sections use the Urdu heading', () => {
  const html = ageingHtml(view, 'ur');
  assert.match(html, /موجودہ — گاہک/);
  assert.match(html, /1 ماہ — گاہک/);
  assert.doesNotMatch(html, /Current — customers/);
  assert.doesNotMatch(html, /1 month — customers/);
});

test('Urdu CSV: receivables headers and row labels translate', () => {
  const csv = ageingCsv(view, entries, 'ur');
  assert.match(csv, /^درجہ,گاہک,محلہ,بل کا مہینہ,رقم\n/);
  assert.match(csv, /موجودہ,Ayesha,Bani,2026-11,5000\.00/);
  assert.match(csv, /بغیر عمر کے,Chand,Shahdara,unknown,1500\.00/);
  assert.match(csv, /\nمحلہ,کل,بل,موجودہ,1 ماہ,2 ماہ,3\+ ماہ\n/);
  assert.doesNotMatch(csv, /^bucket,customer,mohalla,bill month,amount\n/m);
  assert.doesNotMatch(csv, /Current,Ayesha/);
  assert.doesNotMatch(csv, /Unaged,Chand/);
});

test('Urdu HTML: mohalla table shows Urdu headers, summary and note', () => {
  const html = mohallaAgeingHtml(summary, 'ur');
  assert.match(html, /ہر محلے کے واجبات کی عمر کا نوٹ/);
  assert.match(html, /3 محلے، جن میں سے 2 کے واجبات ہیں؛ 1 محلہ میں کوئی واجب رقم نہیں/);
  assert.match(html, /<th>محلہ<\/th>/);
  assert.match(html, /<th>موجودہ<\/th>/);
  assert.match(html, /<th>بل کا مہینہ پڑھا نہیں جا سکا<\/th>/);
  assert.match(html, /<th>کل<\/th>/);
  assert.match(html, /<tfoot><tr><td>کاروباری کل<\/td>/);
  assert.match(html, /کوئی واجب رقم نہیں۔/);
  assert.doesNotMatch(html, /<th>Mohalla<\/th>/);
  assert.doesNotMatch(html, /<th>Current<\/th>/);
  assert.doesNotMatch(html, /<th>Bill month unreadable<\/th>/);
  assert.doesNotMatch(html, /Dues ageing note per mohalla/);
  assert.doesNotMatch(html, /No dues\./);
});

test('Urdu CSV: mohalla header, note and business-total row translate', () => {
  const csv = mohallaAgeingCsv(summary, 'ur');
  assert.match(csv, /^محلہ,موجودہ,1 ماہ,2 ماہ,3\+ ماہ,بل کا مہینہ پڑھا نہیں جا سکا,کل,بل,نوٹ\n/);
  assert.match(csv, /Saddar,0\.00,0\.00,0\.00,0\.00,0\.00,0\.00,0,کوئی واجب رقم نہیں۔\n/);
  assert.match(csv, /کاروباری کل,,,,,,9000\.00,,\n?$/);
  assert.doesNotMatch(csv, /^mohalla,current,1 month,2 months,3\+ months,bill month unreadable,total,bills,note\n/m);
  assert.doesNotMatch(csv, /Business total/);
  assert.doesNotMatch(csv, /No dues\./);
});

test('Urdu summary and row text read in Urdu', () => {
  const text = mohallaAgeingSummaryText(summary, 'ur');
  assert.match(text, /3 محلے، جن میں سے 2 کے واجبات ہیں/);
  assert.match(text, /کاروباری کل Rs\. 9,000، 2026-11 تک۔/);
  assert.doesNotMatch(text, /mohallas/);
  assert.doesNotMatch(text, /Business total/);
  const baniText = mohallaAgeingRowText(baniRow, 'ur');
  assert.match(baniText, /Bani: Rs\. 7,500 واجب الادا — موجودہ Rs\. 5,000، 1 ماہ Rs\. 2,500، 2 ماہ Rs\. 0، 3\+ ماہ Rs\. 0۔/);
  const shahdaraText = mohallaAgeingRowText(shahdaraRow, 'ur');
  assert.match(shahdaraText, /، بل کا مہینہ پڑھا نہیں جا سکا Rs\. 1,500۔/);
  assert.equal(mohallaAgeingRowText(saddarRow, 'ur'), 'Saddar: کوئی واجب رقم نہیں۔');
});

test('Urdu summary with no empty mohalla uses the no-empty key', () => {
  const allWithDues = buildMohallaAgeing(view, ['Bani', 'Shahdara']);
  const text = mohallaAgeingSummaryText(allWithDues, 'ur');
  assert.match(text, /2 محلے، جن میں سے 2 کے واجبات ہیں۔ کاروباری کل Rs\. 9,000، 2026-11 تک۔/);
  assert.doesNotMatch(text, /کوئی واجب رقم نہیں/);
});

test('label helpers translate Unassigned, keep data labels as-is', () => {
  assert.equal(ageingMohallaLabel('', 'ur'), 'غیر منسوب');
  assert.equal(mohallaAgeingLabel('', 'ur'), 'غیر منسوب');
  assert.equal(ageingMohallaLabel(''), 'Unassigned');
  assert.equal(mohallaAgeingLabel(''), 'Unassigned');
  assert.equal(ageingMohallaLabel('Bani', 'ur'), 'Bani');
  assert.equal(mohallaAgeingLabel('Bani', 'ur'), 'Bani');
});

test('guards: data model stays English-canonical', () => {
  assert.deepEqual(AGEING_BUCKETS.map((bucket) => bucket.label), ['Current', '1 month', '2 months', '3+ months']);
  assert.deepEqual(MOHALLA_AGEING_BUCKETS.map((bucket) => bucket.label), ['Current', '1 month', '2 months', '3+ months']);
  assert.equal(view.buckets.current.label, 'Current');
  assert.equal(view.buckets.current.description, 'Bill month is the as-of month');
  assert.equal(saddarRow.note, 'No dues.');
  assert.equal(saddarRow.hasDues, false);
});

test('guards: English default output is byte-identical to before', () => {
  const html = ageingHtml(view);
  assert.match(html, /<td>Current<\/td><td>Bill month is the as-of month<\/td>/);
  assert.match(html, /Receivables ageing by bill month, as of 2026-11\./);
  assert.match(html, /<h4>Current — customers<\/h4>/);
  assert.match(html, /<h4>Bills without a readable bill month \(counted in the total, in no bucket\)<\/h4>/);
  assert.match(html, /<h4>Mohalla totals<\/h4>/);
  assert.match(html, /Total outstanding \(bills\)/);
  const csv = ageingCsv(view, entries);
  assert.match(csv, /^bucket,customer,mohalla,bill month,amount\n/);
  assert.match(csv, /Current,Ayesha,Bani,2026-11,5000\.00/);
  assert.match(csv, /Unaged,Chand,Shahdara,unknown,1500\.00/);
  assert.match(csv, /\nmohalla,total,bills,current,1 month,2 months,3\+ months\n/);
  const mohallaHtml = mohallaAgeingHtml(summary);
  assert.match(mohallaHtml, /Dues ageing note per mohalla, as of 2026-11\./);
  assert.match(mohallaHtml, /3 mohallas, 2 with dues; 1 mohalla with no dues\. Business total Rs\. 9,000 as of 2026-11\./);
  assert.match(mohallaHtml, /<th>Bill month unreadable<\/th>/);
  const mohallaCsv = mohallaAgeingCsv(summary);
  assert.match(mohallaCsv, /^mohalla,current,1 month,2 months,3\+ months,bill month unreadable,total,bills,note\n/);
  assert.match(mohallaCsv, /Saddar,0\.00,0\.00,0\.00,0\.00,0\.00,0\.00,0,No dues\.\n/);
  assert.equal(mohallaAgeingSummaryText(summary), '3 mohallas, 2 with dues; 1 mohalla with no dues. Business total Rs. 9,000 as of 2026-11.');
  assert.equal(mohallaAgeingRowText(saddarRow), 'Saddar: No dues.');
  assert.match(mohallaAgeingRowText(baniRow), /^Bani: Rs\. 7,500 outstanding — Current Rs\. 5,000, 1 month Rs\. 2,500, 2 months Rs\. 0, 3\+ months Rs\. 0\.$/);
  assert.match(mohallaAgeingRowText(shahdaraRow), /, bill month unreadable Rs\. 1,500\.$/);
});

test('guards: sums reconcile and the Rs. money format is untouched', () => {
  assert.equal(view.sumsMatch, true);
  assert.equal(view.totalOutstanding, 900000);
  assert.equal(view.buckets.current.amount + view.buckets.one.amount + view.unagedAmount, view.totalOutstanding);
  assert.equal(summary.sumsMatch, true);
  assert.equal(summary.businessTotal, 900000);
  assert.equal(summary.rowsTotal, 900000);
  assert.match(ageingHtml(view), /Rs\. 9,000/);
  assert.match(ageingHtml(view, 'ur'), /Rs\. 9,000/);
  assert.match(mohallaAgeingSummaryText(summary, 'ur'), /Rs\. 9,000/);
  assert.doesNotMatch(ageingHtml(view, 'ur'), /PKR/);
});

test('guards: EN/UR dictionary parity holds', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, Object.keys(TRANSLATIONS.ur).length);
});

test('toggle behaviour: lang is read at call time, not cached', () => {
  assert.match(ageingHtml(view, 'ur'), /موجودہ/);
  assert.match(ageingHtml(view), /<td>Current<\/td>/);
  assert.match(ageingHtml(view, 'en'), /<td>Current<\/td>/);
  assert.match(mohallaAgeingHtml(summary, 'ur'), /موجودہ/);
  assert.match(mohallaAgeingHtml(summary), /<th>Current<\/th>/);
  assert.match(mohallaAgeingSummaryText(summary, 'ur'), /محلے/);
  assert.match(mohallaAgeingSummaryText(summary), /mohallas/);
});
