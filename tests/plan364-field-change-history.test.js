import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  FIELD_CHANGE_STORE_KEY,
  isStrictFieldChangeDate,
  fieldChangeValueText,
  normalizeFieldChangeDraft,
  normalizeFieldChangeEntry,
  normalizeFieldChangeList,
  recordFieldChange,
  recordFieldChanges,
  fieldChangesForSave,
  fieldChangesForCustomer,
  fieldChangeSummaryText,
  fieldChangeHistorySectionHtml,
} from '../field-change-history.js';
import { PROFILE_FIELD_SAVE_MAP } from '../profile-field-save.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'field-change-history.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const languageSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');

const CUSTOMER = { id: 'CUST-1', name: 'Customer One' };
const TEXTS = {
  heading: 'Field change history',
  intro: 'Every change to this profile, with the old and new value, the date, and who recorded it.',
  none: 'No field change recorded yet.',
  notSet: 'not set',
};
const LABELS = { packageSpeed: 'Package speed', phone: 'Phone', mohalla: 'Mohalla' };

function entry(overrides = {}) {
  return {
    id: 'fch-1',
    customerId: 'CUST-1',
    field: 'packageSpeed',
    oldValue: '5 Mbps',
    newValue: '15 Mbps',
    changedBy: 'owner',
    date: '2026-11-06',
    ...overrides,
  };
}

test('dates: strict leap-aware YYYY-MM-DD only', () => {
  assert.equal(isStrictFieldChangeDate('2026-11-06'), true);
  assert.equal(isStrictFieldChangeDate('2024-02-29'), true);
  assert.equal(isStrictFieldChangeDate('2026-02-29'), false);
  assert.equal(isStrictFieldChangeDate('2026-02-30'), false);
  assert.equal(isStrictFieldChangeDate('2026-13-01'), false);
  assert.equal(isStrictFieldChangeDate('2026-00-10'), false);
  assert.equal(isStrictFieldChangeDate('2026-11-00'), false);
  assert.equal(isStrictFieldChangeDate('2026-11-32'), false);
  assert.equal(isStrictFieldChangeDate('06-11-2026'), false);
  assert.equal(isStrictFieldChangeDate('2026/11/06'), false);
  assert.equal(isStrictFieldChangeDate(''), false);
  assert.equal(isStrictFieldChangeDate(null), false);
  assert.equal(isStrictFieldChangeDate(20261106), false);
});

test('values: stringified for comparison and display', () => {
  assert.equal(fieldChangeValueText(null), '');
  assert.equal(fieldChangeValueText(undefined), '');
  assert.equal(fieldChangeValueText('  5 Mbps '), '5 Mbps');
  assert.equal(fieldChangeValueText(1500), '1500');
  assert.equal(fieldChangeValueText(0), '0');
  assert.equal(fieldChangeValueText(NaN), '');
  assert.equal(fieldChangeValueText(true), 'true');
  assert.equal(fieldChangeValueText(false), 'false');
  assert.equal(fieldChangeValueText(['a', 'b']), 'a, b');
  assert.equal(fieldChangeValueText(['', 'x']), 'x');
  assert.equal(fieldChangeValueText({}), '');
});

test('draft: valid drafts pass, no-change and bad dates are refused', () => {
  const valid = normalizeFieldChangeDraft({ customerId: 'CUST-1', field: 'phone', oldValue: '03012345678', newValue: '03012345679', changedBy: 'owner', date: '2026-11-06' });
  assert.deepEqual(valid, { customerId: 'CUST-1', field: 'phone', oldValue: '03012345678', newValue: '03012345679', changedBy: 'owner', date: '2026-11-06' });
  assert.equal(normalizeFieldChangeDraft({ customerId: 'CUST-1', field: 'phone', oldValue: 'x', newValue: 'x', date: '2026-11-06' }), null);
  assert.equal(normalizeFieldChangeDraft({ customerId: 'CUST-1', field: 'phone', oldValue: '', newValue: '', date: '2026-11-06' }), null);
  assert.equal(normalizeFieldChangeDraft({ customerId: 'CUST-1', field: 'phone', oldValue: 'a', newValue: 'b', date: '2026-02-30' }), null);
  assert.equal(normalizeFieldChangeDraft({ customerId: '', field: 'phone', oldValue: 'a', newValue: 'b', date: '2026-11-06' }), null);
  assert.equal(normalizeFieldChangeDraft({ customerId: 'CUST-1', field: '', oldValue: 'a', newValue: 'b', date: '2026-11-06' }), null);
  assert.equal(normalizeFieldChangeDraft(null), null);
});

test('draft: long values and recorder names are capped, not refused', () => {
  const draft = normalizeFieldChangeDraft({ customerId: 'CUST-1', field: 'notes', oldValue: 'a'.repeat(300), newValue: 'b', changedBy: 'c'.repeat(80), date: '2026-11-06' });
  assert.equal(draft.oldValue.length, 200);
  assert.equal(draft.changedBy.length, 60);
});

test('entry: needs an id, and the list dedupes by id case-insensitively', () => {
  assert.equal(normalizeFieldChangeEntry({ ...entry(), id: '' }), null);
  assert.deepEqual(normalizeFieldChangeEntry(entry()), entry());
  const list = normalizeFieldChangeList([entry(), entry({ id: 'FCH-1', newValue: '20 Mbps' }), entry({ id: 'fch-2', field: 'phone', oldValue: '', newValue: '03012345678' })]);
  assert.equal(list.length, 2);
  assert.equal(list[0].newValue, '15 Mbps');
  assert.deepEqual(normalizeFieldChangeList(null), []);
  assert.deepEqual(normalizeFieldChangeList('nope'), []);
});

test('record one: appends a valid entry, refuses a duplicate id', () => {
  const after = recordFieldChange([], entry());
  assert.equal(after.length, 1);
  assert.equal(recordFieldChange(after, entry({ newValue: '20 Mbps' })).length, 1);
  assert.equal(recordFieldChange(after, entry({ id: 'fch-9', field: 'phone', oldValue: '', newValue: '03012345678' })).length, 2);
  assert.equal(recordFieldChange([], { ...entry(), id: '' }).length, 0);
});

test('record drafts: each valid draft gets the next free sequential id', () => {
  const drafts = [
    { customerId: 'CUST-1', field: 'packageSpeed', oldValue: '5 Mbps', newValue: '15 Mbps', changedBy: 'owner', date: '2026-11-06' },
    { customerId: 'CUST-1', field: 'phone', oldValue: '', newValue: '03012345678', changedBy: 'collector', date: '2026-11-06' },
    { customerId: 'CUST-1', field: 'phone', oldValue: 'x', newValue: 'x', changedBy: 'owner', date: '2026-11-06' },
    { customerId: 'CUST-1', field: 'mohalla', oldValue: 'A', newValue: 'B', changedBy: 'owner', date: '2026-02-30' },
  ];
  const recorded = recordFieldChanges([], drafts);
  assert.equal(recorded.length, 2);
  assert.equal(recorded[0].id, 'fch-1');
  assert.equal(recorded[1].id, 'fch-2');
  assert.equal(recorded[1].changedBy, 'collector');
  const more = recordFieldChanges(recorded, [{ customerId: 'CUST-1', field: 'mohalla', oldValue: 'A', newValue: 'B', changedBy: 'owner', date: '2026-11-07' }]);
  assert.equal(more.length, 3);
  assert.equal(more[2].id, 'fch-3');
  const existing = [{ id: 'fch-7', customerId: 'CUST-1', field: 'phone', oldValue: '', newValue: '03012345678', changedBy: 'owner', date: '2026-11-01' }];
  const next = recordFieldChanges(existing, [{ customerId: 'CUST-1', field: 'phone', oldValue: '03012345678', newValue: '03012345679', changedBy: 'owner', date: '2026-11-06' }]);
  assert.equal(next[1].id, 'fch-8');
  assert.deepEqual(recordFieldChanges([], [{ customerId: 'CUST-1', field: 'x', oldValue: 'a', newValue: 'a', date: '2026-11-06' }]), []);
});

test('diff: only fields whose stored value changed produce drafts, in key order', () => {
  const oldRecord = { id: 'CUST-1', packageSpeed: '5 Mbps', monthlySellingAmount: 1500, phone: '03012345678', mohalla: 'A' };
  const newRecord = { id: 'CUST-1', packageSpeed: '15 Mbps', monthlySellingAmount: '1500', phone: '03012345678', mohalla: 'B' };
  const drafts = fieldChangesForSave(oldRecord, newRecord, { by: 'owner', date: '2026-11-06', fieldKeys: ['packageSpeed', 'monthlySellingAmount', 'phone', 'mohalla'] });
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].field, 'packageSpeed');
  assert.equal(drafts[0].oldValue, '5 Mbps');
  assert.equal(drafts[0].newValue, '15 Mbps');
  assert.equal(drafts[0].changedBy, 'owner');
  assert.equal(drafts[0].date, '2026-11-06');
  assert.equal(drafts[1].field, 'mohalla');
  assert.equal(drafts.length, 2);
});

test('diff: numbers and strings compare by value, blanks compare as blank', () => {
  const drafts = fieldChangesForSave(
    { id: 'CUST-1', connectionFee: 0, notes: null, paused: false },
    { id: 'CUST-1', connectionFee: '0', notes: '', paused: false },
    { by: 'owner', date: '2026-11-06', fieldKeys: ['connectionFee', 'notes', 'paused'] },
  );
  assert.deepEqual(drafts, []);
  const changed = fieldChangesForSave(
    { id: 'CUST-1', connectionFee: null, paused: false },
    { id: 'CUST-1', connectionFee: 2000, paused: true },
    { by: 'collector', date: '2026-11-06', fieldKeys: ['connectionFee', 'paused'] },
  );
  assert.equal(changed.length, 2);
  assert.equal(changed[0].oldValue, '');
  assert.equal(changed[0].newValue, '2000');
  assert.equal(changed[1].oldValue, 'false');
  assert.equal(changed[1].newValue, 'true');
});

test('diff: no drafts without a customer, a real date, or keys outside the list', () => {
  const oldRecord = { id: 'CUST-1', phone: '03012345678' };
  const newRecord = { id: 'CUST-1', phone: '03012345679' };
  assert.deepEqual(fieldChangesForSave(null, null, { by: 'owner', date: '2026-11-06', fieldKeys: ['phone'] }), []);
  assert.deepEqual(fieldChangesForSave(oldRecord, newRecord, { by: 'owner', date: '2026-02-30', fieldKeys: ['phone'] }), []);
  assert.deepEqual(fieldChangesForSave(oldRecord, newRecord, { by: 'owner', date: '', fieldKeys: ['phone'] }), []);
  assert.deepEqual(fieldChangesForSave(oldRecord, newRecord, { by: 'owner', date: '2026-11-06', fieldKeys: ['mohalla'] }), []);
  assert.deepEqual(fieldChangesForSave(oldRecord, newRecord, { by: 'owner', date: '2026-11-06', fieldKeys: [] }), []);
  assert.deepEqual(fieldChangesForSave(oldRecord, newRecord, { by: 'owner', date: '2026-11-06', fieldKeys: ['phone', 'phone'] }).length, 1);
  const fromOldId = fieldChangesForSave({ id: 'CUST-1', phone: 'a' }, { phone: 'b' }, { by: 'owner', date: '2026-11-06', fieldKeys: ['phone'] });
  assert.equal(fromOldId[0].customerId, 'CUST-1');
});

test('diff: the 69 profile fields are the diff scope — every map key is a plain string key', () => {
  const keys = Object.values(PROFILE_FIELD_SAVE_MAP);
  assert.equal(keys.length, 69);
  assert.ok(keys.every((key) => typeof key === 'string' && key !== ''));
  assert.equal(new Set(keys).size, 69);
});

test('list: newest first, other customers excluded, customer match is case-insensitive', () => {
  const list = [
    entry({ id: 'fch-1', date: '2026-11-01', field: 'phone', oldValue: '', newValue: '03012345678' }),
    entry({ id: 'fch-2', date: '2026-11-06', field: 'packageSpeed', oldValue: '5 Mbps', newValue: '15 Mbps' }),
    entry({ id: 'fch-3', date: '2026-11-03', field: 'mohalla', oldValue: 'A', newValue: 'B' }),
    entry({ id: 'fch-4', customerId: 'CUST-2', date: '2026-11-06', field: 'phone', oldValue: '', newValue: '03012345678' }),
  ];
  const mine = fieldChangesForCustomer(list, 'cust-1');
  assert.deepEqual(mine.map((row) => row.id), ['fch-2', 'fch-3', 'fch-1']);
  assert.deepEqual(fieldChangesForCustomer(list, ''), []);
  assert.deepEqual(fieldChangesForCustomer([], 'CUST-1'), []);
});

test('summary: plain words, no score, no percentage', () => {
  assert.equal(fieldChangeSummaryText([]), 'No field change recorded yet.');
  assert.equal(fieldChangeSummaryText([entry()]), '1 field change recorded.');
  assert.equal(fieldChangeSummaryText([entry(), entry({ id: 'fch-2' })]), '2 field changes recorded.');
});

test('section: lists changes newest first with old and new values and who recorded them', () => {
  const list = [
    entry({ id: 'fch-1', date: '2026-11-01', field: 'phone', oldValue: '', newValue: '03012345678', changedBy: 'collector' }),
    entry({ id: 'fch-2', date: '2026-11-06', field: 'packageSpeed', oldValue: '5 Mbps', newValue: '15 Mbps', changedBy: 'owner' }),
  ];
  const html = fieldChangeHistorySectionHtml(CUSTOMER, list, LABELS, TEXTS);
  assert.ok(html.includes('Field change history'));
  assert.ok(html.includes('2 field changes recorded.'));
  const packageAt = html.indexOf('Package speed');
  const phoneAt = html.indexOf('Phone');
  assert.ok(packageAt > 0 && phoneAt > packageAt, 'newest change lists first');
  assert.ok(html.includes('changed 2026-11-06 — from 5 Mbps to 15 Mbps — by owner'));
  assert.ok(html.includes('changed 2026-11-01 — from not set to 03012345678 — by collector'));
  assert.ok(html.includes('fch-history'));
});

test('section: a field never changed shows no entry, and a complete history is honest about blanks', () => {
  assert.ok(fieldChangeHistorySectionHtml(CUSTOMER, [], LABELS, TEXTS).includes('No field change recorded yet.'));
  assert.ok(fieldChangeHistorySectionHtml(CUSTOMER, [entry({ id: 'fch-9', field: 'unknownField', oldValue: 'a', newValue: 'b' })], LABELS, TEXTS).includes('unknownField'));
  assert.equal(fieldChangeHistorySectionHtml(null, [entry()], LABELS, TEXTS), '');
  const noBy = fieldChangeHistorySectionHtml(CUSTOMER, [entry({ changedBy: '' })], LABELS, TEXTS);
  assert.ok(noBy.includes('from 5 Mbps to 15 Mbps'));
  assert.ok(!noBy.includes(' — by '));
});

test('section: every stored value is escaped', () => {
  const evil = entry({ field: 'notes', oldValue: '<script>alert(1)</script>', newValue: 'a & b "quoted"', changedBy: 'o<wner' });
  const html = fieldChangeHistorySectionHtml(CUSTOMER, [evil], { notes: '<b>Notes</b>' }, TEXTS);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('a &amp; b &quot;quoted&quot;'));
  assert.ok(html.includes('&lt;b&gt;Notes&lt;/b&gt;'));
  assert.ok(html.includes('o&lt;wner'));
});

test('purity: the module reads no store, clock, network, or page', () => {
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!moduleSrc.includes('new Date('));
  assert.ok(!moduleSrc.includes('Date.now('));
  assert.ok(!moduleSrc.includes('fetch('));
  assert.ok(!moduleSrc.includes('window.'));
  assert.ok(!moduleSrc.includes('import '));
  assert.ok(!moduleSrc.includes('document.'));
  assert.ok(!moduleSrc.includes('OLT'));
  assert.equal(FIELD_CHANGE_STORE_KEY, 'shahdara_fch_changes_v1');
});

test('fences: the module never names the fenced neighbour files literally', () => {
  const fenced = [
    ['audit', '-log', '.js'],
    ['monthly', '-audit', '-summary', '.js'],
    ['preference', '-change', '.js'],
  ].map((parts) => parts.join(''));
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});

test('wiring: import, store helpers, and the section hook exist in app.js', () => {
  assert.ok(appSrc.includes("from './field-change-history.js'"));
  assert.ok(appSrc.includes('loadFieldChanges'));
  assert.ok(appSrc.includes('saveFieldChanges'));
  assert.ok(appSrc.includes('FIELD_CHANGE_STORE_KEY'));
  assert.ok(appSrc.includes('fieldChangeHistorySectionHtml'));
  assert.ok(appSrc.includes('fieldChangesForSave'));
  assert.ok(appSrc.includes('recordFieldChanges'));
});

test('wiring: the history section sits after the tenure section and before the field groups', () => {
  // Polish #28 Phase A — the tenure section now lives in the Service
  // section and the history list appends last inside the History
  // section; the old .stv-section anchor would have dropped the list
  // inside Service. The preserved intent is the list renders in
  // History, after every History item, and tenure still follows the
  // package history inside Service.
  const serviceBodyAt = appSrc.indexOf('const profileSectionServiceBody = ');
  const serviceBody = appSrc.slice(serviceBodyAt, appSrc.indexOf('\n', serviceBodyAt));
  assert.ok(serviceBody.indexOf('${serviceTenureSectionMarkup}') > serviceBody.indexOf('${packageHistorySectionMarkup}'), 'tenure section still follows the package history, inside Service');
  assert.ok(appSrc.includes("querySelector('[data-profile-section=\"history\"] .profile-section-body')?.insertAdjacentHTML('beforeend', fieldChangeHistorySectionHtml("), 'history appends into the History section body');
  assert.ok(!appSrc.includes("querySelector('.stv-section')?.insertAdjacentHTML('afterend', fieldChangeHistorySectionHtml("), 'history no longer anchors on the tenure section');
  assert.ok(appSrc.includes('fieldChangeHistorySectionHtml('));
});

test('wiring: both profile save paths record field changes', () => {
  assert.ok(appSrc.includes('fieldChangesForSave(customer, saved,'));
  assert.ok(appSrc.includes('fieldChangesForSave(currentCustomer, savedCustomer,'));
  assert.ok(appSrc.includes("by: currentOperatorMode()"));
  assert.ok(appSrc.includes('date: localDate()'));
  assert.ok(appSrc.includes('Object.values(PROFILE_FIELD_SAVE_MAP)'));
});

test('wiring: language keys exist in both tables', () => {
  for (const key of ['prof_fch_heading', 'prof_fch_intro', 'prof_fch_none', 'prof_fch_not_set']) {
    assert.ok(languageSrc.includes(key), `${key} is present`);
  }
});

test('styles: the history rules reuse existing colours only — no new hex colour', () => {
  const baselineHex = new Set((stylesSrc.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((hex) => hex.toLowerCase()));
  const stripped = stylesSrc.replace(/\.fch-[^{]+\{[^}]*\}/g, '');
  const strippedHex = new Set((stripped.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((hex) => hex.toLowerCase()));
  assert.ok(stylesSrc.includes('.fch-history'));
  assert.ok(stylesSrc.includes('.fch-list'));
  const newHex = [...baselineHex].filter((hex) => !strippedHex.has(hex));
  assert.deepEqual(newHex, []);
});
