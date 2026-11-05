import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validReferralEligibilityDate,
  foldEligible,
  normalizeReferralEligibility,
  normalizeReferralEligibilityList,
  recordReferralEligibility,
  removeReferralEligibility,
  findReferralEligibility,
  referralEligibilitySorted,
  referralEligibilityForReferrer,
  latestReferralEligibility,
  referralEligibilityReferrers,
  referralEligibilityCounts,
  referralEligibilitySummaryText,
  referralEligibilityText,
  referralEligibilityHtml,
  referralEligibilityAllHtml,
  referralEligibilityCsv,
  referralEligibilityFilename,
} from '../referral-eligibility.js';

const first = { id: 'RG-1', referrer: 'Ahmed Raza', referralId: 'REF-101', rule: 'Referred customer active for 30 days', eligible: 'yes', dateChecked: '2026-11-08', note: 'Checked at the shop.' };
const second = { id: 'RG-2', referrer: 'Ahmed Raza', referralId: 'REF-102', rule: 'Referred customer active for 30 days', eligible: 'no', dateChecked: '2026-11-09', note: '' };
const third = { id: 'RG-3', referrer: 'Bilal Khan', referralId: 'REF-103', rule: 'First bill paid in full', eligible: true, dateChecked: '2026-11-07' };

test('half-formed notes are refused', () => {
  assert.deepEqual(recordReferralEligibility([], { ...first, id: '' }), []);
  assert.deepEqual(recordReferralEligibility([], { ...first, referrer: '  ' }), []);
  assert.deepEqual(recordReferralEligibility([], { ...first, referralId: '' }), []);
  assert.deepEqual(recordReferralEligibility([], { ...first, rule: '   ' }), []);
  assert.deepEqual(recordReferralEligibility([], { ...first, eligible: 'maybe' }), []);
  assert.deepEqual(recordReferralEligibility([], { ...first, dateChecked: '' }), []);
  assert.deepEqual(recordReferralEligibility([], { ...first, dateChecked: '2026-02-30' }), []);
  const recorded = recordReferralEligibility([], { ...first, note: '' });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].note, '');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validReferralEligibilityDate('2026-08-31'), true);
  assert.equal(validReferralEligibilityDate('2026-10-31'), true);
  assert.equal(validReferralEligibilityDate('2026-12-31'), true);
  assert.equal(validReferralEligibilityDate('2026-02-29'), false);
  assert.equal(validReferralEligibilityDate('2028-02-29'), true);
  assert.equal(validReferralEligibilityDate('2026-04-31'), false);
  assert.equal(validReferralEligibilityDate('2026-13-01'), false);
  assert.equal(validReferralEligibilityDate('10-11-2026'), false);
  assert.equal(validReferralEligibilityDate(''), false);
  assert.equal(validReferralEligibilityDate(null), false);
});

test('eligible spellings fold to yes or no', () => {
  assert.equal(foldEligible('yes'), true);
  assert.equal(foldEligible('Eligible'), true);
  assert.equal(foldEligible('not_eligible'), false);
  assert.equal(foldEligible('NOT ELIGIBLE'), false);
  assert.equal(foldEligible(true), true);
  assert.equal(foldEligible(0), false);
  assert.equal(foldEligible('maybe'), null);
  assert.equal(foldEligible(''), null);
  assert.equal(foldEligible(null), null);
  assert.equal(normalizeReferralEligibility({ ...first, eligible: 'NOT ELIGIBLE' }).eligible, false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, creditAmount: 500, billAmount: 1500, surprise: 'x' };
  const recorded = recordReferralEligibility([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('creditAmount' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.creditAmount, 500);
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'creditAmount', 'dateChecked', 'eligible', 'id', 'note', 'referralId', 'referrer', 'rule', 'surprise']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordReferralEligibility([], first);
  assert.deepEqual(recordReferralEligibility(list, { ...first, rule: 'Changed.' }), list);
  assert.deepEqual(recordReferralEligibility(list, { ...second, id: 'RG-1' }), list);
});

test('a second note for the same referral is allowed only as a later dated re-check', () => {
  const list = recordReferralEligibility([], first);
  const later = recordReferralEligibility(list, { id: 'RG-9', referrer: 'Ahmed Raza', referralId: 'REF-101', rule: 'Referred customer active for 30 days', eligible: 'no', dateChecked: '2026-11-20', note: 'Re-checked after the first bill.' });
  assert.equal(later.length, 2);
  assert.equal(later[1].eligible, false);
  assert.deepEqual(
    recordReferralEligibility(list, { id: 'RG-9', referrer: 'Ahmed Raza', referralId: 'REF-101', rule: 'Same rule', eligible: 'no', dateChecked: '2026-11-08' }),
    list,
  );
  assert.deepEqual(
    recordReferralEligibility(list, { id: 'RG-9', referrer: 'Ahmed Raza', referralId: 'REF-101', rule: 'Same rule', eligible: 'no', dateChecked: '2026-11-01' }),
    list,
  );
  const otherReferral = recordReferralEligibility(list, { ...second, dateChecked: '2026-11-01' });
  assert.equal(otherReferral.length, 2);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordReferralEligibility(acc, item), []);
  assert.equal(findReferralEligibility(list, 'RG-2').referrer, 'Ahmed Raza');
  assert.equal(findReferralEligibility(list, 'RG-9'), null);
  assert.equal(findReferralEligibility(list, ''), null);
  assert.deepEqual(removeReferralEligibility(list, 'RG-2').map((item) => item.id), ['RG-1', 'RG-3']);
  assert.deepEqual(removeReferralEligibility(list, ''), list);
});

test('a referrer page lists notes in date order', () => {
  const list = [second, first, third].reduce((acc, item) => recordReferralEligibility(acc, item), []);
  assert.deepEqual(referralEligibilityForReferrer(list, 'ahmed raza').map((item) => item.id), ['RG-1', 'RG-2']);
  assert.deepEqual(referralEligibilityForReferrer(list, 'Bilal Khan').map((item) => item.id), ['RG-3']);
  assert.deepEqual(referralEligibilityForReferrer(list, ''), []);
  assert.deepEqual(referralEligibilityForReferrer(list, 'Nobody'), []);
  assert.deepEqual(referralEligibilitySorted(list).map((item) => item.id), ['RG-3', 'RG-1', 'RG-2']);
});

test('latest eligibility per referral', () => {
  const list = recordReferralEligibility(recordReferralEligibility([], first), { id: 'RG-9', referrer: 'Ahmed Raza', referralId: 'REF-101', rule: 'Referred customer active for 30 days', eligible: 'no', dateChecked: '2026-11-20' });
  assert.equal(latestReferralEligibility(list, 'REF-101').id, 'RG-9');
  assert.equal(latestReferralEligibility(list, 'REF-101').eligible, false);
  assert.equal(latestReferralEligibility(list, 'REF-999'), null);
  assert.equal(latestReferralEligibility(list, ''), null);
});

test('referrer list keeps the first spelling', () => {
  const list = [
    { id: 'RG-1', referrer: 'Ahmed Raza', referralId: 'REF-101', rule: 'Rule one', eligible: 'yes', dateChecked: '2026-11-08' },
    { id: 'RG-2', referrer: 'AHMED RAZA', referralId: 'REF-102', rule: 'Rule one', eligible: 'no', dateChecked: '2026-11-09' },
    { id: 'RG-3', referrer: 'Bilal Khan', referralId: 'REF-103', rule: 'Rule two', eligible: 'yes', dateChecked: '2026-11-07' },
  ].reduce((acc, item) => recordReferralEligibility(acc, item), []);
  assert.deepEqual(referralEligibilityReferrers(list), ['Ahmed Raza', 'Bilal Khan']);
});

test('counts and summary text', () => {
  assert.deepEqual(referralEligibilityCounts([]), { total: 0, eligible: 0, notEligible: 0 });
  assert.equal(referralEligibilitySummaryText([]), 'No referral eligibility notes recorded.');
  const list = [first, second, third].reduce((acc, item) => recordReferralEligibility(acc, item), []);
  assert.deepEqual(referralEligibilityCounts(list), { total: 3, eligible: 2, notEligible: 1 });
  assert.equal(referralEligibilitySummaryText(list), '3 referral eligibility notes recorded, 2 eligible and 1 not eligible.');
  assert.equal(referralEligibilitySummaryText([first]), '1 referral eligibility note recorded, 1 eligible and 0 not eligible.');
});

test('summary and entry text name the referrer, referral, rule, and answer plainly', () => {
  const text = referralEligibilityText(first);
  assert.equal(text.includes('Ahmed Raza'), true);
  assert.equal(text.includes('REF-101'), true);
  assert.equal(text.includes('Referred customer active for 30 days'), true);
  assert.equal(text.includes('Eligible for a reward'), true);
  assert.equal(text.includes('2026-11-08'), true);
  assert.equal(text.includes('Checked at the shop.'), true);
  assert.equal(referralEligibilityText(second).includes('Not eligible for a reward'), true);
  assert.equal(referralEligibilityText(null), 'No referral eligibility note recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, rule: '<script>alert(1)</script>' };
  const html = referralEligibilityHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(referralEligibilityHtml(null), '<p>No referral eligibility note recorded.</p>');
  assert.equal(referralEligibilityAllHtml([]), '<p>No referral eligibility notes recorded.</p>');
  assert.equal(referralEligibilityAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = referralEligibilityCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","referrer","referral","rule","eligible","date checked","note"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('RG-1'), true);
  assert.equal(lines[1].includes('Referred customer active for 30 days'), true);
  assert.equal(lines[1].includes('"yes"'), true);
  assert.equal(lines[2].includes('"no"'), true);
  assert.equal(referralEligibilityFilename(), 'referral-eligibility-notes.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'RG-9', referrer: '', referralId: 'REF-109', rule: 'No referrer.', eligible: 'yes', dateChecked: '2026-11-10' };
  const out = normalizeReferralEligibilityList([bad, first, { ...first, rule: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['RG-1', 'RG-2']);
  assert.equal(out[0].rule, first.rule);
  assert.deepEqual(normalizeReferralEligibilityList('nope'), []);
  assert.deepEqual(normalizeReferralEligibilityList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../referral-eligibility.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the referral record, outcome log, and credit engine are untouched', () => {
  const source = readFileSync(new URL('../referral-eligibility.js', import.meta.url), 'utf8');
  assert.equal(source.includes('referral-tracking.js'), false, 'module must not reference the referral record module');
  assert.equal(source.includes('referral-outcome.js'), false, 'module must not reference the referral outcome log module');
  assert.equal(source.includes('referral-credits.js'), false, 'module must not reference the hamsaya credit engine module');
  assert.equal(existsSync(new URL('../referral-tracking.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../referral-outcome.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../referral-credits.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'rgHeading', 'rgSummary', 'rgList', 'rgExportBtn',
    'rgReferrer', 'rgReferral', 'rgRule', 'rgEligible', 'rgDate', 'rgNote', 'rgRecordBtn',
    'rgRemoveId', 'rgRemoveBtn',
    'rgFilterReferrer', 'rgFilterBtn', 'rgReferrerBody',
    'rgLatestReferral', 'rgLatestBtn', 'rgLatestBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the referral eligibility panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './referral-eligibility.js'"), true);
  assert.equal(source.includes('renderReferralEligibility()'), true);
  assert.equal(source.includes('REFERRAL_ELIGIBILITY_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
