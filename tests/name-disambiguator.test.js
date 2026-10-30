import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createInitialState, updateCustomerProfile, archiveCustomer } from '../core.js';
import {
  normalizeCustomerNameKey,
  buildSameNameIndex,
  sameNameInfo,
  sameNameBadgeHtml,
} from '../name-disambiguator.js';
import { renderQuickCollectPickerHtml, renderQuickCollectCustomerListHtml } from '../nav-quick-collect.js';
import { TRANSLATIONS } from '../nav-language.js';

// SISP-77: Same-Name / Homonym Customer Disambiguation Guard.
// PIN: two active customers named "Ali Khan" in different zones both
// render the badge in search (Customers list) and Quick Collect; a
// uniquely-named customer renders none. The guard is read-only.

const REF = new Date('2026-10-29T12:00:00+05:00');
const here = path.dirname(fileURLToPath(import.meta.url));
const readRepoFile = (name) => readFileSync(path.join(here, '..', name), 'utf8');

/** Two Ali Khans (BARRIAN Rs. 3,000 / PALALIYAA Rs. 2,000) + unique Bilal. */
function pinState() {
  let state = createInitialState(['Ali Khan', 'Ali Khan', 'Bilal Ahmed']);
  state = updateCustomerProfile(state, 'seed-001', { mohalla: 'BARRIAN', monthlySellingAmount: '3000' }, REF);
  state = updateCustomerProfile(state, 'seed-002', { mohalla: 'PALALIYAA', monthlySellingAmount: '2000' }, REF);
  state = updateCustomerProfile(state, 'seed-003', { mohalla: 'BARRIAN', monthlySellingAmount: '3000' }, REF);
  return state;
}

test('normalization: case, spacing and Urdu-script variants fold to one key', () => {
  assert.equal(normalizeCustomerNameKey('Ali Khan'), 'ali khan');
  assert.equal(normalizeCustomerNameKey('  ALI   KHAN '), 'ali khan');
  assert.equal(normalizeCustomerNameKey('علی خان'), normalizeCustomerNameKey('علي خان'));
  assert.equal(normalizeCustomerNameKey(''), '');
  assert.equal(normalizeCustomerNameKey(null), '');
});

test('PIN: both Ali Khans carry zone, #ID and rate in the badge; unique Bilal carries none', () => {
  const state = pinState();
  const [ali1, ali2, bilal] = state.customers;
  const badge1 = sameNameBadgeHtml(state, ali1, REF);
  const badge2 = sameNameBadgeHtml(state, ali2, REF);
  assert.ok(badge1.includes('same-name-badge'), badge1);
  assert.ok(badge1.includes('⚠️ Same Name'), badge1);
  assert.ok(badge1.includes('Barrian'), badge1);
  assert.ok(badge1.includes('#1'), badge1);
  assert.ok(badge1.includes('Rs. 3,000'), badge1);
  assert.ok(badge2.includes('Palaliyaa'), badge2);
  assert.ok(badge2.includes('#2'), badge2);
  assert.ok(badge2.includes('Rs. 2,000'), badge2);
  assert.equal(sameNameBadgeHtml(state, bilal, REF), '');
  assert.equal(sameNameInfo(state, bilal, REF), null);
});

test('index: only colliding active customers are indexed, with the other-count', () => {
  const state = pinState();
  const index = buildSameNameIndex(state.customers);
  assert.deepEqual([...index.keys()].sort(), ['seed-001', 'seed-002']);
  assert.equal(index.get('seed-001').sharedWith, 1);
  assert.equal(index.get('seed-002').sharedWith, 1);
});

test('case/spacing variants of the same name collide', () => {
  let state = createInitialState(['ali khan', 'Ali  Khan', 'Solo Name']);
  state = updateCustomerProfile(state, 'seed-001', { mohalla: 'BANII' }, REF);
  state = updateCustomerProfile(state, 'seed-002', { mohalla: 'SODAA' }, REF);
  const index = buildSameNameIndex(state.customers);
  assert.deepEqual([...index.keys()].sort(), ['seed-001', 'seed-002']);
});

test('Urdu nameUrdu collisions badge even when Roman names differ (Arabic-keyboard variants fold)', () => {
  let state = createInitialState(['Ali K.', 'A. Khan']);
  state = updateCustomerProfile(state, 'seed-001', { nameUrdu: 'علی خان', mohalla: 'BARRIAN' }, REF);
  state = updateCustomerProfile(state, 'seed-002', { nameUrdu: 'علي خان', mohalla: 'SODAA' }, REF);
  const index = buildSameNameIndex(state.customers);
  assert.deepEqual([...index.keys()].sort(), ['seed-001', 'seed-002']);
  assert.ok(sameNameBadgeHtml(state, state.customers[0], REF).includes('same-name-badge'));
});

test('archived namesakes do not collide: archiving one Ali Khan clears the other\'s badge', () => {
  let state = pinState();
  state = archiveCustomer(state, 'seed-002', REF);
  const [ali1, ali2] = state.customers;
  assert.equal(sameNameBadgeHtml(state, ali1, REF), '');
  assert.equal(sameNameBadgeHtml(state, ali2, REF), '');
  assert.equal(buildSameNameIndex(state.customers).size, 0);
});

test('badge degrades gracefully: no mohalla and no fee still renders label + #ID', () => {
  const state = createInitialState(['Ali Khan', 'Ali Khan']);
  const badge = sameNameBadgeHtml(state, state.customers[0], REF);
  assert.ok(badge.includes('⚠️ Same Name'), badge);
  assert.ok(badge.includes('#1'), badge);
  assert.ok(!badge.includes('Rs.'), badge);
});

test('read-only: badge derivation never mutates the ledger', () => {
  const state = pinState();
  const before = JSON.stringify(state);
  for (const customer of state.customers) sameNameBadgeHtml(state, customer, REF);
  buildSameNameIndex(state.customers);
  assert.equal(JSON.stringify(state), before);
});

test('PIN (Quick Collect): picker html badges both Ali Khans, unique customer unbadged', () => {
  const bill = (month) => ({ id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending', payments: [] });
  const cust = (id, number, name, mohalla) => ({
    id, customerNumber: number, name, archived: false, mohalla, area: mohalla, phone: '',
    monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 3000 }],
    bills: [bill('2026-10')],
  });
  const state = {
    customers: [
      cust('c-ali-1', 11, 'Ali Khan', 'BARRIAN'),
      cust('c-ali-2', 12, 'Ali Khan', 'PALALIYAA'),
      cust('c-bilal', 13, 'Bilal Ahmed', 'BARRIAN'),
    ],
  };
  const { html } = renderQuickCollectPickerHtml(state, '', 'all');
  const badgeCount = (html.match(/same-name-badge/g) ?? []).length;
  assert.equal(badgeCount, 2, html);
  assert.ok(html.includes('Barrian • #11 • Rs. 3,000'), html);
  assert.ok(html.includes('Palaliyaa • #12 • Rs. 3,000'), html);
  // The list renderer without a badge map stays badge-free (old callers).
  const plain = renderQuickCollectCustomerListHtml([{ id: 'c-ali-1', customerNumber: 11, name: 'Ali Khan', area: 'BARRIAN', phone: '', totalDues: 3000 }], null);
  assert.ok(!plain.includes('same-name-badge'), plain);
});

test('i18n: every t() key used by the module exists in en and ur', () => {
  const source = readRepoFile('name-disambiguator.js');
  const keys = [...source.matchAll(/\bt\('([a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.ok(keys.length > 0);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  assert.ok(TRANSLATIONS.en.same_name_label.includes('⚠️'));
  assert.ok(TRANSLATIONS.ur.same_name_label.includes('⚠️'));
});

test('CSS: badge uses pending theme tokens only, no hardcoded colours', () => {
  const css = readRepoFile('components.css');
  const rule = css.match(/\.same-name-badge\s*\{([^}]*)\}/);
  assert.ok(rule, 'badge rule exists');
  assert.ok(rule[1].includes('var(--color-pending)'), rule[1]);
  assert.ok(rule[1].includes('var(--color-pending-bg)'), rule[1]);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(rule[1]), rule[1]);
});

test('wiring: Customers card, Field Mode cards and QC picker all render the badge; module is not a build entry', () => {
  const app = readRepoFile('app.js');
  assert.ok(app.includes("from './name-disambiguator.js'"), 'app.js imports the module');
  assert.ok(app.includes('${sameNameBadgeHtml(state, customer)}'), 'customer card renders the badge');
  const field = readRepoFile('field-mode.js');
  assert.ok(field.includes("from './name-disambiguator.js'"), 'field-mode imports the module');
  assert.ok(field.includes('sameNameBadgeHtml(nameState'), 'field-mode cards render the badge');
  const qc = readRepoFile('nav-quick-collect.js');
  assert.ok(qc.includes("from './name-disambiguator.js'"), 'quick-collect imports the module');
  assert.ok(qc.includes('sameNameBadges'), 'picker passes badges to the list renderer');
  const build = readRepoFile('build.mjs');
  const entryLine = build.match(/export const ENTRY_FILES = \[([^\]]*)\]/);
  assert.ok(entryLine && !entryLine[1].includes('name-disambiguator'), 'not a build entry (dist stays bundled)');
});
