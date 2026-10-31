/**
 * system-health-center.test.js — SISP-100: Master System Health &
 * All-Ledger Telemetry Center.
 *
 * Pins:
 *  - the ledger registry is keyed by the SAME storage-key constants
 *    the owning modules export (no re-typed key can drift);
 *  - a populated synthetic fixture reports the exact record count for
 *    every registered ledger (the spec test criterion), incl. the
 *    per-shop breakdown taken from recorded shop names;
 *  - empty storage + empty state open cleanly with zero errors, all
 *    counts 0 (the zero-runtime-error pin);
 *  - an unparseable / wrong-shape store reports count null (never a
 *    guessed 0) and raises an integrity finding;
 *  - the report + Master Integrity Check are READ-ONLY: state and
 *    storage are byte-for-byte unchanged afterwards;
 *  - integrity findings fire with exact counts for duplicate customer
 *    numbers, duplicate bill months, orphan inventory movements,
 *    splitter port conflicts, orphan group members and orphan
 *    referral parties — and a clean fixture reports healthy;
 *  - last-modified appears ONLY where the store itself records a
 *    stamp; everywhere else the row carries null (rendered '—');
 *  - every syshealth_* / dash_health_* key the feature can emit
 *    (static t() calls, data-i18n attributes, ledger nameKeys and the
 *    dynamically built finding keys) exists in BOTH dictionaries and
 *    never renders as the raw key;
 *  - the new CSS block is token-only (no hex colours) and the dialog +
 *    dashboard card ids exist in index.html.
 *
 * Synthetic data only — no real customer names, shops or figures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SYSTEM_HEALTH_STATE_LEDGERS,
  SYSTEM_HEALTH_STORAGE_LEDGERS,
  buildSystemHealthReport,
  countSplitterBoxes,
  runMasterIntegrityCheck,
  buildSystemHealthMarkup,
  setupSystemHealthCenter,
  storeRecordedTimestamp,
  summarizeSystemHealth,
  utf8ByteLength
} from '../system-health-center.js';
import { STORAGE_KEY, createInitialState } from '../core.js';
import { SHOP_SETTLEMENTS_KEY } from '../shop-settlement.js';
import { COMPLAINTS_KEY } from '../complaint-register.js';
import { TICKETS_KEY } from '../complaint-tickets.js';
import { ROZNAMCHA_KEY } from '../roznamcha.js';
import { INVENTORY_KEY } from '../inventory-book.js';
import { GROUP_BILLING_KEY } from '../group-billing.js';
import { SUSPENSE_PAYMENTS_KEY } from '../suspense-payments.js';
import { REFERRAL_CREDITS_KEY } from '../referral-credits.js';
import { PARTNER_LEDGER_KEY, PARTNER_SETTLEMENTS_KEY } from '../partner-settlement.js';
import { VOIDED_PAYMENTS_KEY } from '../payment-void-audit.js';
import { HOME_BUDGET_KEY } from '../home-budget.js';
import { LOAN_KEY } from '../loan-ledger.js';
import { SAAD_VISITS_KEY, SAAD_PAYMENTS_KEY } from '../saad-visits.js';
import { INSTALL_REQUESTS_KEY } from '../install-tracker.js';
import { PENDING_WORKS_KEY } from '../pending-works.js';
import { MONTHLY_CLOSING_NOTES_KEY } from '../monthly-closing-notes.js';
import { OVERHEAD_KEY } from '../fixed-overheads.js';
import { WA_TEMPLATES_STORAGE_KEY } from '../whatsapp-templates.js';
import { BILLING_CYCLES_KEY } from '../billing-cycle.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    dump: () => Object.fromEntries(map)
  };
}

const json = (value) => JSON.stringify(value);
const records = (count, make) => Array.from({ length: count }, (_, index) => make(index));

function payment(id) { return { id, date: '2026-10-05', amount: 1500, method: 'Cash' }; }
function bill(month, payments) { return { id: `bill-${month}`, month, dueAmount: 1500, status: 'paid', payments }; }
function customer(id, customerNumber, bills, extra = {}) {
  return { id, customerNumber, name: `Test Customer ${customerNumber}`, bills, incidents: [], ...extra };
}

/** Fully populated synthetic fixture: every registered ledger holds data. */
function populatedFixture() {
  const state = {
    version: 1,
    nextCustomerNumber: 4,
    customers: [
      customer('cust-a', 1, [bill('2026-09', [payment('p1'), payment('p2')]), bill('2026-10', [payment('p3')])], { splitterBoxId: 'DB-01', splitterPort: 1 }),
      customer('cust-b', 2, [bill('2026-10', [payment('p4')])], { splitterBoxId: 'DB-01', splitterPort: 2 }),
      customer('cust-c', 3, [], { splitterBoxId: 'DB-02', splitterPort: 1 })
    ],
    inventoryItems: [{ id: 'item-1' }, { id: 'item-2' }],
    inventoryMovements: [
      { id: 'mov-1', itemId: 'item-1' },
      { id: 'mov-2', itemId: 'item-2' },
      { id: 'mov-3', itemId: 'item-1' }
    ],
    expenses: [{ id: 'exp-1' }, { id: 'exp-2' }],
    saadAttendanceDays: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'],
    umairWorkdays: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
    monthlyClosings: [{ month: '2026-09' }]
  };
  const storage = fakeStorage({
    [STORAGE_KEY]: json(state),
    [SHOP_SETTLEMENTS_KEY]: json([
      { id: 'set-1', shop: 'Test Shop One', amount: 5000, date: '2026-10-03' },
      { id: 'set-2', shop: 'Test Shop One', amount: 3000, date: '2026-10-10' },
      { id: 'set-3', shop: 'Test Shop Two', amount: 2000, date: '2026-10-11' }
    ]),
    [COMPLAINTS_KEY]: json(records(2, (i) => ({ complaintId: `CMP-${i + 1}` }))),
    [TICKETS_KEY]: json(records(1, (i) => ({ ticketId: `TKT-${i + 1}` }))),
    [ROZNAMCHA_KEY]: json(records(2, (i) => ({ date: `2026-10-0${i + 1}` }))),
    [INVENTORY_KEY]: json(records(4, (i) => ({ id: `stock-${i + 1}` }))),
    [GROUP_BILLING_KEY]: json([{ billingGroupId: 'GRP-101', groupTitle: 'Test Group', memberIds: ['cust-a', 'cust-b'] }]),
    [SUSPENSE_PAYMENTS_KEY]: json(records(2, (i) => ({ suspenseId: `SUS-${i + 1}` }))),
    [REFERRAL_CREDITS_KEY]: json([{ referralId: 'REF-1', referrerCustomerId: 'cust-a', referredCustomerId: 'cust-b', amount: 500 }]),
    [PARTNER_LEDGER_KEY]: json(records(3, (i) => ({ id: `pl-${i + 1}` }))),
    [PARTNER_SETTLEMENTS_KEY]: json(records(1, (i) => ({ id: `ps-${i + 1}` }))),
    [VOIDED_PAYMENTS_KEY]: json(records(1, (i) => ({ paymentId: `void-${i + 1}` }))),
    [INSTALL_REQUESTS_KEY]: json(records(2, (i) => ({ id: `req-${i + 1}` }))),
    [PENDING_WORKS_KEY]: json(records(3, (i) => ({ id: `work-${i + 1}` }))),
    [BILLING_CYCLES_KEY]: json(records(2, (i) => ({ month: `2026-0${8 + i}` }))),
    [SAAD_VISITS_KEY]: json(records(2, (i) => ({ id: `visit-${i + 1}` }))),
    [SAAD_PAYMENTS_KEY]: json(records(1, (i) => ({ id: `spay-${i + 1}` }))),
    [HOME_BUDGET_KEY]: json(records(2, (i) => ({ id: `hb-${i + 1}` }))),
    [LOAN_KEY]: json(records(1, (i) => ({ id: `loan-${i + 1}` }))),
    [WA_TEMPLATES_STORAGE_KEY]: json(records(1, (i) => ({ id: `tpl-${i + 1}` }))),
    [MONTHLY_CLOSING_NOTES_KEY]: json({ '2026-08': { note: 'a', savedAt: '' }, '2026-09': { note: 'b', savedAt: '' } }),
    [OVERHEAD_KEY]: json({ templates: records(2, (i) => ({ id: `tpl-${i + 1}` })), postings: records(3, (i) => ({ id: `post-${i + 1}` })), updatedAt: '2026-10-15T09:30:00.000Z' })
  });
  return { state, storage };
}

const EXPECTED_COUNTS = {
  customers: 3, bills: 3, receipts: 4, expenses: 2,
  'inventory-items': 2, 'inventory-movements': 3, 'monthly-closings': 1,
  'saad-attendance': 5, 'umair-workdays': 4, splitters: 2,
  'shop-settlements': 3, complaints: 2, tickets: 1, roznamcha: 2,
  'stock-book': 4, 'billing-groups': 1, 'suspense-payments': 2,
  'referral-credits': 1, 'partner-ledger': 3, 'partner-settlements': 1,
  'voided-payments': 1, 'install-requests': 2, 'pending-works': 3,
  'billing-cycles': 2, 'saad-visits': 2, 'saad-payments': 1,
  'home-budget': 2, loans: 1, 'wa-templates': 1, 'closing-notes': 2, overheads: 5
};

test('registry keys are the owning modules\u2019 exported constants, unique and complete', () => {
  const expectedKeys = {
    'shop-settlements': SHOP_SETTLEMENTS_KEY, complaints: COMPLAINTS_KEY, tickets: TICKETS_KEY,
    roznamcha: ROZNAMCHA_KEY, 'stock-book': INVENTORY_KEY, 'billing-groups': GROUP_BILLING_KEY,
    'suspense-payments': SUSPENSE_PAYMENTS_KEY, 'referral-credits': REFERRAL_CREDITS_KEY,
    'partner-ledger': PARTNER_LEDGER_KEY, 'partner-settlements': PARTNER_SETTLEMENTS_KEY,
    'voided-payments': VOIDED_PAYMENTS_KEY, 'install-requests': INSTALL_REQUESTS_KEY,
    'pending-works': PENDING_WORKS_KEY, 'billing-cycles': BILLING_CYCLES_KEY,
    'saad-visits': SAAD_VISITS_KEY, 'saad-payments': SAAD_PAYMENTS_KEY,
    'home-budget': HOME_BUDGET_KEY, loans: LOAN_KEY, 'wa-templates': WA_TEMPLATES_STORAGE_KEY,
    'closing-notes': MONTHLY_CLOSING_NOTES_KEY, overheads: OVERHEAD_KEY
  };
  assert.equal(SYSTEM_HEALTH_STORAGE_LEDGERS.length, Object.keys(expectedKeys).length);
  for (const descriptor of SYSTEM_HEALTH_STORAGE_LEDGERS) {
    assert.equal(descriptor.key, expectedKeys[descriptor.id], `${descriptor.id} must use its owner module's key`);
  }
  const allIds = [...SYSTEM_HEALTH_STATE_LEDGERS.map((d) => d.id), ...SYSTEM_HEALTH_STORAGE_LEDGERS.map((d) => d.id), 'main-ledger', 'splitters'];
  assert.equal(new Set(allIds).size, allIds.length, 'ledger ids are unique');
  const allKeys = SYSTEM_HEALTH_STORAGE_LEDGERS.map((d) => d.key);
  assert.equal(new Set(allKeys).size, allKeys.length, 'storage keys are unique');
});

test('populated fixture: every registered ledger reports its exact recorded count', () => {
  const { state, storage } = populatedFixture();
  const report = buildSystemHealthReport({ state, storage });
  const byId = new Map(report.rows.map((row) => [row.id, row]));
  for (const [id, expected] of Object.entries(EXPECTED_COUNTS)) {
    assert.equal(byId.get(id)?.count, expected, `${id} count`);
    assert.equal(byId.get(id)?.status, 'ok', `${id} status`);
    if (id === 'splitters') {
      assert.equal(byId.get(id).bytes, null, 'derived row carries no footprint of its own');
    } else {
      assert.ok(byId.get(id).bytes > 0, `${id} footprint measured`);
    }
  }
  // The main container row: no record count of its own, real footprint.
  const main = byId.get('main-ledger');
  assert.equal(main.count, null);
  assert.equal(main.bytes, utf8ByteLength(storage.getItem(STORAGE_KEY)));
  // Totals add up exactly from the per-ledger counts.
  const expectedTotal = Object.values(EXPECTED_COUNTS).reduce((sum, n) => sum + n, 0);
  assert.equal(report.totals.totalRecords, expectedTotal);
  assert.equal(report.totals.ledgerCount, report.rows.length);
  assert.equal(report.totals.unreadableCount, 0);
  const summary = summarizeSystemHealth(report);
  assert.equal(summary.totalRecords, expectedTotal);
  assert.match(summary.sizeLabel, /KB|MB|B/);
});

test('shop breakdown comes from recorded shop names only', () => {
  const { state, storage } = populatedFixture();
  const report = buildSystemHealthReport({ state, storage });
  const shops = report.rows.find((row) => row.id === 'shop-settlements');
  assert.deepEqual(shops.breakdown, [
    { label: 'Test Shop One', count: 2 },
    { label: 'Test Shop Two', count: 1 }
  ]);
});

test('empty storage + empty state: zero errors, every count 0', () => {
  const report = buildSystemHealthReport({ state: createInitialState(), storage: fakeStorage() });
  assert.equal(report.totals.totalRecords, 0);
  assert.equal(report.totals.unreadableCount, 0);
  for (const row of report.rows) {
    if (row.id === 'main-ledger') { assert.equal(row.count, null); continue; }
    assert.equal(row.count, 0, `${row.id} counts 0 on a fresh install`);
  }
  const integrity = runMasterIntegrityCheck({ state: createInitialState(), storage: fakeStorage() });
  assert.equal(integrity.healthy, true);
  assert.deepEqual(integrity.findings, []);
});

test('no state and no storage at all: still no throw (unavailable rows)', () => {
  const report = buildSystemHealthReport({});
  const stateRow = report.rows.find((row) => row.id === 'customers');
  assert.equal(stateRow.count, null);
  assert.equal(stateRow.status, 'unavailable');
  assert.doesNotThrow(() => runMasterIntegrityCheck({}));
  assert.doesNotThrow(() => buildSystemHealthMarkup(report, null, { lang: 'en' }));
});

test('unparseable and wrong-shape stores report null counts and raise findings', () => {
  const storage = fakeStorage({
    [COMPLAINTS_KEY]: '{not json',
    [TICKETS_KEY]: json({ nope: true })
  });
  const report = buildSystemHealthReport({ state: createInitialState(), storage });
  const complaints = report.rows.find((row) => row.id === 'complaints');
  assert.equal(complaints.count, null, 'unparseable count is never guessed as 0');
  assert.equal(complaints.status, 'unreadable');
  assert.ok(complaints.bytes > 0, 'footprint is still the raw stored size');
  const tickets = report.rows.find((row) => row.id === 'tickets');
  assert.equal(tickets.count, null);
  assert.equal(tickets.status, 'invalid-shape');
  assert.equal(report.totals.unreadableCount, 2);

  const integrity = runMasterIntegrityCheck({ state: createInitialState(), storage });
  const codes = integrity.findings.map((f) => `${f.code}:${f.ledgerId}`);
  assert.ok(codes.includes('store_unparseable:complaints'));
  assert.ok(codes.includes('store_wrong_shape:tickets'));
  assert.equal(integrity.healthy, false);
  assert.equal(integrity.errors, 2);
});

test('report and integrity check are read-only: state and storage byte-for-byte unchanged', () => {
  const { state, storage } = populatedFixture();
  const stateBefore = JSON.stringify(state);
  const storageBefore = json(storage.dump());
  buildSystemHealthReport({ state, storage });
  runMasterIntegrityCheck({ state, storage });
  buildSystemHealthMarkup(buildSystemHealthReport({ state, storage }), runMasterIntegrityCheck({ state, storage }), { lang: 'en' });
  assert.equal(JSON.stringify(state), stateBefore);
  assert.equal(json(storage.dump()), storageBefore);
});

test('integrity findings fire with exact counts on a dirty fixture', () => {
  const state = {
    version: 1,
    customers: [
      customer('cust-a', 7, [bill('2026-10', []), bill('2026-10', [])], { splitterBoxId: 'DB-01', splitterPort: 3 }),
      customer('cust-b', 7, [], { splitterBoxId: 'DB-01', splitterPort: 3 }),
      customer('cust-c', 9, [])
    ],
    inventoryItems: [{ id: 'item-1' }],
    inventoryMovements: [{ id: 'mov-1', itemId: 'item-ghost' }],
    expenses: [], saadAttendanceDays: [], umairWorkdays: [], monthlyClosings: []
  };
  const storage = fakeStorage({
    [GROUP_BILLING_KEY]: json([{ billingGroupId: 'GRP-101', groupTitle: 'Test', memberIds: ['cust-a', 'cust-ghost'] }]),
    [REFERRAL_CREDITS_KEY]: json([{ referralId: 'REF-1', referrerCustomerId: 'cust-a', referredCustomerId: 'cust-ghost', amount: 100 }])
  });
  const integrity = runMasterIntegrityCheck({ state, storage });
  const byCode = new Map(integrity.findings.map((f) => [f.code, f]));
  assert.equal(byCode.get('duplicate_customer_number')?.count, 1);
  assert.equal(byCode.get('duplicate_customer_number')?.severity, 'error');
  assert.equal(byCode.get('duplicate_bill_month')?.count, 1);
  assert.equal(byCode.get('orphan_inventory_movement')?.count, 1);
  assert.equal(byCode.get('splitter_port_conflict')?.count, 1);
  assert.equal(byCode.get('orphan_group_member')?.count, 1);
  assert.equal(byCode.get('orphan_referral_party')?.count, 1);
  assert.equal(integrity.errors, 2);
  assert.equal(integrity.warnings, 4);
  // Findings carry counts only — never a customer name or id.
  for (const finding of integrity.findings) {
    assert.deepEqual(Object.keys(finding).sort(), ['code', 'count', 'ledgerId', 'messageKey', 'severity']);
  }
});

test('clean populated fixture passes the integrity check healthy', () => {
  const { state, storage } = populatedFixture();
  const integrity = runMasterIntegrityCheck({ state, storage });
  assert.deepEqual(integrity.findings, []);
  assert.equal(integrity.healthy, true);
  assert.equal(integrity.errors, 0);
  assert.equal(integrity.warnings, 0);
});

test('last-modified is shown only where the store itself records a stamp', () => {
  const { state, storage } = populatedFixture();
  const report = buildSystemHealthReport({ state, storage });
  const overheads = report.rows.find((row) => row.id === 'overheads');
  assert.equal(overheads.lastModified, '2026-10-15T09:30:00.000Z', 'object store stamp is surfaced verbatim');
  const complaints = report.rows.find((row) => row.id === 'complaints');
  assert.equal(complaints.lastModified, null, 'array stores record no stamp — nothing is derived');
  const customers = report.rows.find((row) => row.id === 'customers');
  assert.equal(customers.lastModified, null, 'the main state records no stamp');
  assert.equal(storeRecordedTimestamp([{ updatedAt: '2026-01-01' }]), null, 'arrays never yield a stamp');
  assert.equal(storeRecordedTimestamp({ updatedAt: 'not-a-date' }), null);
  assert.equal(storeRecordedTimestamp({ savedAt: '2026-02-02T00:00:00.000Z' }), '2026-02-02T00:00:00.000Z');
});

test('countSplitterBoxes counts distinct recorded box ids only', () => {
  assert.equal(countSplitterBoxes({ customers: [{ splitterBoxId: 'DB-01' }, { splitterBoxId: 'DB-01' }, { splitterBoxId: ' DB-02 ' }, { splitterBoxId: '' }, {}] }), 2);
  assert.equal(countSplitterBoxes(null), 0);
  assert.equal(countSplitterBoxes({}), 0);
});

test('markup renders names, totals, breakdown and findings with no raw keys', () => {
  const { state, storage } = populatedFixture();
  const report = buildSystemHealthReport({ state, storage });
  const html = buildSystemHealthMarkup(report, null, { lang: 'en' });
  assert.match(html, /Customers/);
  assert.match(html, /Test Shop One/);
  assert.match(html, /32 ledgers/, 'totals line carries the ledger count');
  assert.ok(!html.includes('syshealth_'), 'no raw i18n key leaks into the markup');
  const dirty = runMasterIntegrityCheck({
    state: { customers: [customer('x', 5, []), customer('y', 5, [])], inventoryItems: [], inventoryMovements: [] },
    storage: fakeStorage()
  });
  const dirtyHtml = buildSystemHealthMarkup(report, dirty, { lang: 'en' });
  assert.match(dirtyHtml, /customer number\(s\) are assigned to more than one customer/);
  assert.ok(!dirtyHtml.includes('syshealth_'));
  const urduHtml = buildSystemHealthMarkup(report, null, { lang: 'ur' });
  assert.match(urduHtml, /کسٹمرز/);
  assert.ok(!urduHtml.includes('syshealth_'));
});

test('i18n audit: every key this feature can emit exists in both dictionaries', async () => {
  const moduleSource = await readFile(path.join(ROOT, 'system-health-center.js'), 'utf8');
  const indexSource = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
  const keys = new Set();
  for (const match of moduleSource.matchAll(/t\('([a-z0-9_]+)'/g)) keys.add(match[1]);
  for (const match of moduleSource.matchAll(/nameKey: '([a-z0-9_]+)'/g)) keys.add(match[1]);
  for (const match of moduleSource.matchAll(/noteKey: '([a-z0-9_]+)'/g)) keys.add(match[1]);
  for (const match of indexSource.matchAll(/data-i18n="(syshealth_[a-z0-9_]+|dash_card_health|dash_btn_health)"/g)) keys.add(match[1]);
  for (const match of appSource.matchAll(/t\('(dash_health_[a-z0-9_]+)'/g)) keys.add(match[1]);
  // Dynamically built finding keys: syshealth_finding_<code>.
  const dirty = runMasterIntegrityCheck({
    state: {
      customers: [customer('x', 5, [bill('2026-10', []), bill('2026-10', [])], { splitterBoxId: 'DB-01', splitterPort: 1 }), customer('y', 5, [], { splitterBoxId: 'DB-01', splitterPort: 1 })],
      inventoryItems: [], inventoryMovements: [{ id: 'm', itemId: 'ghost' }]
    },
    storage: fakeStorage({
      [COMPLAINTS_KEY]: '{bad',
      [TICKETS_KEY]: json({ nope: 1 }),
      [GROUP_BILLING_KEY]: json([{ billingGroupId: 'GRP-1', groupTitle: 'T', memberIds: ['ghost'] }]),
      [REFERRAL_CREDITS_KEY]: json([{ referralId: 'R', referrerCustomerId: 'ghost', referredCustomerId: 'x', amount: 1 }])
    })
  });
  assert.ok(dirty.findings.length >= 6, 'dirty fixture exercises the finding keys');
  for (const finding of dirty.findings) keys.add(finding.messageKey);
  assert.ok(keys.size >= 50, `audit covers the full key surface (got ${keys.size})`);
  for (const key of keys) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en dictionary missing ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur dictionary missing ${key}`);
    assert.notEqual(t(key, 'en'), key, `en renders ${key}`);
    assert.notEqual(t(key, 'ur'), key, `ur renders ${key}`);
  }
});

test('index.html carries the dialog, its actions and the dashboard card', async () => {
  const indexSource = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  for (const id of ['systemHealthModal', 'systemHealthCloseBtn', 'systemHealthRunCheckBtn', 'systemHealthArchiveBtn', 'systemHealthBody', 'openSystemHealthModalBtn', 'dashboardSystemHealthValue', 'dashboardSystemHealthPeriod']) {
    assert.ok(indexSource.includes(`id="${id}"`), `index.html has #${id}`);
  }
  assert.match(indexSource, /<dialog id="systemHealthModal" class="billing-modal[^"]*"/, 'dialog uses the shared billing-modal shell (var(--modal-surface))');
});

test('SISP-100 CSS block is token-only (dark-mode safe, no hex colours)', async () => {
  const css = await readFile(path.join(ROOT, 'components.css'), 'utf8');
  const block = css.slice(css.indexOf('/* SISP-100'));
  assert.ok(block.length > 200, 'SISP-100 CSS block exists');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hex colours in the SISP-100 block');
  assert.match(block, /var\(--surface\)/);
  assert.match(block, /var\(--line\)/);
});

test('controller setup is a safe no-op without a DOM (Node)', () => {
  assert.equal(setupSystemHealthCenter({ getState: () => null }), null);
  assert.equal(setupSystemHealthCenter(), null);
});
