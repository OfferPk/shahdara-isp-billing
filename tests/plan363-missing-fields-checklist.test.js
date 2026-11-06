import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { missingProfileFields, missingFieldsChecklistHtml, isProfileFieldMissing } from '../missing-fields-checklist.js';
import { PROFILE_FIELD_SAVE_MAP } from '../profile-field-save.js';
import { countProfileCompletion } from '../profile-completion.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'missing-fields-checklist.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

const FIELDS = [
  { controlId: 'phoneInput', fieldKey: 'phone' },
  { controlId: 'cnicInput', fieldKey: 'cnic' },
  { controlId: 'mohallaInput', fieldKey: 'mohalla' },
  { controlId: 'pauseBillingCheckbox', fieldKey: 'paused' },
  { controlId: 'connectionFeeInput', fieldKey: 'connectionFee' },
  { controlId: 'searchAliasesInput', fieldKey: 'searchAliases' },
];

const LABELS = {
  phoneInput: 'Phone',
  cnicInput: 'CNIC',
  mohallaInput: 'Mohalla',
  pauseBillingCheckbox: 'Pause billing',
  connectionFeeInput: 'Connection fee',
  searchAliasesInput: 'Nicknames',
};

const TEXTS = { heading: 'Missing fields', allFilled: 'All fields filled' };

test('missing: names exactly the empty fields, in form order', () => {
  const record = { phone: '03012345678', cnic: '', mohalla: '  ', paused: false, connectionFee: 0, searchAliases: [] };
  assert.deepEqual(missingProfileFields(record, FIELDS), [
    { controlId: 'cnicInput', fieldKey: 'cnic' },
    { controlId: 'mohallaInput', fieldKey: 'mohalla' },
    { controlId: 'pauseBillingCheckbox', fieldKey: 'paused' },
    { controlId: 'searchAliasesInput', fieldKey: 'searchAliases' },
  ]);
});

test('missing: the filled rule matches the counter — blanks, Not set, numbers, booleans, arrays', () => {
  assert.equal(isProfileFieldMissing(''), true);
  assert.equal(isProfileFieldMissing('   '), true);
  assert.equal(isProfileFieldMissing('Not set'), true);
  assert.equal(isProfileFieldMissing('NOT SET'), true);
  assert.equal(isProfileFieldMissing('not set'), true);
  assert.equal(isProfileFieldMissing('03012345678'), false);
  assert.equal(isProfileFieldMissing(0), false);
  assert.equal(isProfileFieldMissing(1500), false);
  assert.equal(isProfileFieldMissing(NaN), true);
  assert.equal(isProfileFieldMissing(Infinity), true);
  assert.equal(isProfileFieldMissing(false), true);
  assert.equal(isProfileFieldMissing(true), false);
  assert.equal(isProfileFieldMissing(null), true);
  assert.equal(isProfileFieldMissing(undefined), true);
  assert.equal(isProfileFieldMissing([]), true);
  assert.equal(isProfileFieldMissing(['']), true);
  assert.equal(isProfileFieldMissing(['', 'Shahdara']), false);
  assert.equal(isProfileFieldMissing({}), true);
});

test('missing: a null record counts as every field missing; no fields means no missing', () => {
  assert.deepEqual(missingProfileFields(null, FIELDS), FIELDS);
  assert.deepEqual(missingProfileFields(undefined, FIELDS), FIELDS);
  assert.deepEqual(missingProfileFields({ phone: '03012345678' }, []), []);
  assert.deepEqual(missingProfileFields({ phone: '03012345678' }, null), []);
  assert.deepEqual(missingProfileFields({}, []), []);
});

test('missing: entries without a control id or field key are skipped, inputs are never mutated', () => {
  const fields = [
    { controlId: '', fieldKey: 'phone' },
    { controlId: 'cnicInput', fieldKey: '' },
    { controlId: 'mohallaInput', fieldKey: 'mohalla' },
    null,
    { controlId: 'phoneInput' },
  ];
  const record = { phone: '', mohalla: '' };
  const before = JSON.stringify({ fields, record });
  assert.deepEqual(missingProfileFields(record, fields), [{ controlId: 'mohallaInput', fieldKey: 'mohalla' }]);
  assert.equal(JSON.stringify({ fields, record }), before);
});

test('missing: a complete record has nothing missing', () => {
  const record = { phone: '03012345678', cnic: '3520212345678', mohalla: 'Shahdara', paused: true, connectionFee: 5000, searchAliases: ['Shahdara'] };
  assert.deepEqual(missingProfileFields(record, FIELDS), []);
});

test('agreement: missing plus the counter filled always equals the counter total on the real field list', () => {
  const realFields = Object.entries(PROFILE_FIELD_SAVE_MAP).map(([controlId, fieldKey]) => ({ controlId, fieldKey }));
  assert.equal(realFields.length, 69);
  const fixtures = [
    {},
    { name: 'Customer One', phone: '03012345678', mohalla: 'Shahdara', monthlySellingAmount: 3000, paused: false, connectionFee: 0 },
    Object.fromEntries(Object.values(PROFILE_FIELD_SAVE_MAP).map((key, i) => [key, i % 2 === 0 ? 'x' : 1])),
    { name: 'Not set', phone: 'Not set', mohalla: '   ', searchAliases: [''] },
  ];
  for (const record of fixtures) {
    const counted = countProfileCompletion(record);
    const missing = missingProfileFields(record, realFields);
    assert.equal(missing.length + counted.filled, counted.total, 'checklist and counter must agree');
    assert.equal(counted.total, 69);
  }
});

test('html: lists each missing field by name as a jump button, in order', () => {
  const missing = [
    { controlId: 'cnicInput', fieldKey: 'cnic' },
    { controlId: 'phoneInput', fieldKey: 'phone' },
  ];
  const html = missingFieldsChecklistHtml(missing, LABELS, TEXTS);
  assert.ok(html.includes('<h4 class="mfc-heading">Missing fields</h4>'));
  assert.ok(html.includes('data-missing-field="cnicInput">CNIC</button>'));
  assert.ok(html.includes('data-missing-field="phoneInput">Phone</button>'));
  assert.ok(html.indexOf('cnicInput') < html.indexOf('phoneInput'));
  assert.ok(!html.includes('All fields filled'));
});

test('html: a complete profile shows the all-filled line and no jump buttons', () => {
  const html = missingFieldsChecklistHtml([], LABELS, TEXTS);
  assert.ok(html.includes('<p class="mfc-all-filled">All fields filled</p>'));
  assert.ok(!html.includes('data-missing-field'));
  assert.ok(!html.includes('<button'));
});

test('html: labels fall back to the field key, never to a blank', () => {
  const html = missingFieldsChecklistHtml([{ controlId: 'cnicInput', fieldKey: 'cnic' }], {}, TEXTS);
  assert.ok(html.includes('>cnic</button>'));
});

test('html: labels and headings are escaped so a field name can never break the markup', () => {
  const labels = { phoneInput: '<script>alert(1)</script>' };
  const html = missingFieldsChecklistHtml([{ controlId: 'phoneInput', fieldKey: 'phone' }], labels, { heading: 'A & B', allFilled: 'Done' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('A &amp; B'));
});

test('html: missing defaults to the all-filled line when the input is not an array', () => {
  assert.ok(missingFieldsChecklistHtml(null, LABELS, TEXTS).includes('All fields filled'));
  assert.ok(missingFieldsChecklistHtml(undefined, LABELS, TEXTS).includes('All fields filled'));
});

test('fences: the module never names the completeness score module', () => {
  // The score module was checked by filename first and is neither read
  // nor rewritten here, so this module never names it — the name is
  // built from fragments so the literal filename appears nowhere in
  // this file either.
  const name = 'customer-' + 'completeness.js';
  assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  assert.ok(!readFileSync(fileURLToPath(import.meta.url), 'utf8').includes(name), `test must not name ${name}`);
});

test('purity: no DOM, no clock, no store, no network in the module', () => {
  for (const token of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'STORE_KEY', 'shahdara_']) {
    assert.ok(!moduleSrc.includes(token), `module must not contain ${token}`);
  }
  assert.ok(!/\\bOLT\\b/.test(moduleSrc), 'module must not name OLT');
});

test('score: the module exports no score, no percentage and no filled count', () => {
  // The prose may say the module scores nothing; the code must contain
  // no scoring function at all — no exported name computes a score, a
  // percentage, or a filled count.
  const exported = [...moduleSrc.matchAll(/export function (\w+)/g)].map((m) => m[1]);
  assert.ok(exported.length > 0, 'module exports its functions');
  for (const name of exported) {
    assert.ok(!/score|percent|count/i.test(name), `module must not export a scoring function, found ${name}`);
  }
  assert.ok(!moduleSrc.includes('countProfileCompletion'), 'module must not count filled fields');
});

test('wiring: app.js imports the module and shows the checklist after the counter', () => {
  assert.ok(appSrc.includes("from './missing-fields-checklist.js'"));
  assert.ok(appSrc.includes('missingProfileFields(customer,'));
  assert.ok(appSrc.includes('missingFieldsChecklistHtml('));
  assert.ok(appSrc.includes("querySelector('.profile-completion-counter')"));
});

test('wiring: tapping a checklist item opens edit mode and reuses the error-jump scroll and focus', () => {
  assert.ok(appSrc.includes('data-missing-field'));
  assert.ok(appSrc.includes("jumpToProfileErrorTarget({ kind: 'field', id:"));
  const checklistAt = appSrc.indexOf('missingFieldsChecklistHtml(');
  const jumpAt = appSrc.indexOf("jumpToProfileErrorTarget({ kind: 'field', id:", checklistAt);
  assert.ok(checklistAt > 0, 'checklist is wired in app.js');
  assert.ok(jumpAt > checklistAt, 'jump binding sits with the checklist wiring');
});

test('wiring: the profile order assertion still holds — banner, strip, then groups', () => {
  const bannerAt = appSrc.indexOf('${wadaProfileBannerHtml(customer)}');
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}', bannerAt);
  const groupsAt = appSrc.indexOf('${profileInfoGroupsHtml}', stripAt);
  assert.ok(bannerAt > 0, 'wada banner is in the profile template');
  assert.ok(stripAt > bannerAt, 'strip sits after the wada banner');
  assert.ok(groupsAt > stripAt, 'strip sits before the field groups');
});

test('styles: the checklist rules exist and reuse existing colours only', () => {
  for (const cls of ['.mfc-checklist', '.mfc-heading', '.mfc-list', '.mfc-jump', '.mfc-all-filled']) {
    assert.ok(stylesSrc.includes(cls), `styles must define ${cls}`);
  }
  const mfcLines = stylesSrc.split('\n').filter((line) => line.includes('.mfc-'));
  for (const line of mfcLines) {
    for (const hex of line.match(/#[0-9a-fA-F]{3,8}/g) ?? []) {
      assert.ok(['#5c6e66', '#fff'].includes(hex.toLowerCase()), `mfc rule must reuse an existing colour, found ${hex}`);
    }
  }
});
