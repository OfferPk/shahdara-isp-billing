// Hisaab Clearly Visible (H2): Upstream tab in the Expenses view +
// single-write mirror. Synthetic data only — small fixture amounts (a
// 60,575 new-bill fixture); the Nayatel seed rows are H1's test file,
// never reproduced here. No bill ID, account ID or NTL number exists
// anywhere in the model, the mirror, or these tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  seedUpstreamProviders,
  sanitizeUpstreamProviders,
  loadUpstreamProviders,
  saveUpstreamProviders,
  providerBillExpenseCategory,
  providerBillExpenseNotes,
  syncedUpstreamExpenseId,
  isUpstreamMirrorExpense,
  addUpstreamProvider,
  createProviderBill,
  mirrorProviderBill,
  addProviderBillMirror,
  editProviderBillMirror,
  deleteProviderBillMirror,
  setProviderPendingBill,
} from '../upstream-providers.js';
import { addExpense, updateExpense, buildPartnerShareReport } from '../phase3.js';
import { postOverhead, overheadPostingFor } from '../fixed-overheads.js';
import {
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge,
} from '../core.js';

const REF = new Date('2026-11-18T12:00:00+05:00');

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

let mockStorage;
test.beforeEach(() => {
  mockStorage = new MockLocalStorage();
  globalThis.localStorage = mockStorage;
});
test.afterEach(() => {
  delete globalThis.localStorage;
});

const emptyRegister = () => ({ providers: [] });
const nayatelOnly = () => ({
  providers: [{
    id: 'prov-nayatel', name: 'Nayatel', active: true, bills: [], pendingBill: null,
  }],
});
const newBillFields = (overrides = {}) => ({
  providerId: 'prov-nayatel', date: '2026-11-05', amount: 60575,
  billMonth: '2026-11', method: '', note: '', ...overrides,
});

// --- G1: mirror add ---------------------------------------------------------

test('G1: add Nayatel bill — provider row + expense row in one call, linked by providerBillId', () => {
  const result = addProviderBillMirror(nayatelOnly(), [], newBillFields());
  assert.equal(result.added, true);
  assert.equal(result.providers.providers[0].bills.length, 1);
  const bill = result.bill;
  assert.equal(bill.mirrored, true, 'the new bill is marked mirrored');
  assert.equal(bill.seeded, false);
  assert.equal(result.expenses.length, 1);
  const row = result.expenses[0];
  assert.equal(row.id, syncedUpstreamExpenseId(bill.id), 'deterministic expense id upb-<billId>');
  assert.equal(row.id, `upb-${bill.id}`);
  assert.equal(row.date, '2026-11-05');
  assert.equal(row.amount, 60575);
  assert.equal(row.category, 'Nayatel bill');
  assert.equal(row.providerBillId, bill.id);
  assert.equal(row.notes, '');
  assert.equal(row.area, '');
  assert.ok(row.createdAt, 'the mirror row carries createdAt like addExpense rows');
});

test('G1: category mapping — Nayatel mirrors to Nayatel bill, others to Other expenses + Upstream note', () => {
  assert.equal(providerBillExpenseCategory('Nayatel'), 'Nayatel bill');
  assert.equal(providerBillExpenseCategory('PTCL'), 'Other expenses');
  assert.equal(providerBillExpenseCategory('Jazz'), 'Other expenses');
  assert.equal(providerBillExpenseNotes('Nayatel', 'Nov bill'), 'Nov bill');
  assert.equal(providerBillExpenseNotes('PTCL', ''), 'Upstream: PTCL');
  assert.equal(providerBillExpenseNotes('PTCL', 'Nov bill'), 'Upstream: PTCL — Nov bill');
  const register = {
    providers: [
      { id: 'prov-nayatel', name: 'Nayatel', active: true, bills: [], pendingBill: null },
      { id: 'prov-ptcl', name: 'PTCL', active: true, bills: [], pendingBill: null },
    ],
  };
  const result = addProviderBillMirror(register, [], newBillFields({ providerId: 'prov-ptcl', amount: 12000, note: 'Nov bill' }));
  assert.equal(result.expenses[0].category, 'Other expenses');
  assert.equal(result.expenses[0].notes, 'Upstream: PTCL — Nov bill');
  assert.equal(result.expenses[0].providerBillId, result.bill.id);
});

test('G1: the mirror row moves the partner-share month expenses by exactly the bill amount', () => {
  const result = addProviderBillMirror(nayatelOnly(), [], newBillFields());
  const before = buildPartnerShareReport({ expenses: [], paymentEntries: [] }, '2026-11', new Date('2026-11-18T00:00:00Z'));
  const after = buildPartnerShareReport({ expenses: result.expenses, paymentEntries: [] }, '2026-11', new Date('2026-11-18T00:00:00Z'));
  assert.equal(after.summary.expenses - before.summary.expenses, 60575, 'the P&L payoff: the mirror row is an ordinary expense row to the engines');
});

// --- G2: dedupe -------------------------------------------------------------

test('G2: re-mirroring the same bill is a no-op — one expense row, one provider bill', () => {
  const first = addProviderBillMirror(nayatelOnly(), [], newBillFields());
  const second = mirrorProviderBill(first.providers, first.expenses, first.bill.id);
  assert.equal(second.added, false, 'a re-save never creates a second expense row');
  assert.equal(second.expenses.length, 1);
  assert.equal(second.providers.providers[0].bills.length, 1);
  assert.equal(second.expense.id, first.expense.id);
  assert.deepEqual(second.expenses, first.expenses);
  assert.deepEqual(second.providers, first.providers);
});

test('G2: dedupe is by bill id, not amount — two 60,575 bills in different months make two rows', () => {
  const first = addProviderBillMirror(nayatelOnly(), [], newBillFields());
  const second = addProviderBillMirror(first.providers, first.expenses, newBillFields({ date: '2026-12-05', billMonth: '2026-12' }));
  assert.equal(second.expenses.length, 2, 'same amount, different months: two expense rows');
  assert.equal(second.providers.providers[0].bills.length, 2);
  assert.notEqual(second.expenses[0].id, second.expenses[1].id);
  assert.notEqual(second.expenses[0].providerBillId, second.expenses[1].providerBillId);
});

// --- G3: seed safety --------------------------------------------------------

test('G3: a seed-only register produces zero expense rows from any mirror entry point', () => {
  const seed = seedUpstreamProviders();
  const seedBill = seed.providers[0].bills[0];
  assert.equal(seedBill.seeded, true);
  const mirrored = mirrorProviderBill(seed, [], seedBill.id);
  assert.equal(mirrored.added, false);
  assert.equal(mirrored.reason, 'seeded');
  assert.deepEqual(mirrored.expenses, [], 'no expense row is ever written for a seed row');
  assert.equal(mirrored.providers.providers[0].bills[0].mirrored, false);
});

test('G3: adding a new bill next to seed rows leaves every seed row mirrored:false and unmodified', () => {
  const seed = seedUpstreamProviders();
  const seedBefore = JSON.stringify(seed.providers[0].bills);
  const result = addProviderBillMirror(seed, [], newBillFields());
  assert.equal(result.providers.providers[0].bills.length, 23, '22 seed bills + 1 new bill');
  const seedRows = result.providers.providers[0].bills.slice(0, 22);
  assert.equal(JSON.stringify(seedRows), seedBefore, 'seed rows are byte-identical after the add');
  for (const row of seedRows) assert.equal(row.mirrored, false, 'no seed row ever gains an expense row');
  assert.equal(result.bill.mirrored, true);
  assert.equal(result.expenses.length, 1);
});

// --- G4: edit / delete / refusal --------------------------------------------

test('G4: edit through the mirror updates BOTH rows in place — same ids, still one row each', () => {
  const added = addProviderBillMirror(nayatelOnly(), [], newBillFields());
  const edited = editProviderBillMirror(added.providers, added.expenses, added.bill.id,
    { date: '2026-11-06', amount: 61000, billMonth: '2026-11', method: 'Easypaisa', note: 'corrected' });
  assert.equal(edited.providers.providers[0].bills.length, 1);
  assert.equal(edited.bill.id, added.bill.id, 'the bill id is stable across an edit');
  assert.equal(edited.bill.amount, 61000);
  assert.equal(edited.bill.date, '2026-11-06');
  assert.equal(edited.bill.method, 'Easypaisa');
  assert.equal(edited.expenses.length, 1);
  assert.equal(edited.expense.id, added.expense.id, 'the expense id is stable across an edit');
  assert.equal(edited.expense.amount, 61000);
  assert.equal(edited.expense.date, '2026-11-06');
  assert.equal(edited.expense.providerBillId, added.bill.id);
  // A partial edit keeps the untouched fields.
  const partial = editProviderBillMirror(edited.providers, edited.expenses, edited.bill.id, { amount: 62000 });
  assert.equal(partial.bill.amount, 62000);
  assert.equal(partial.bill.date, '2026-11-06', 'date is kept when the edit omits it');
  assert.equal(partial.bill.method, 'Easypaisa', 'method is kept when the edit omits it');
});

test('G4: delete through the mirror removes BOTH rows; other bills are untouched', () => {
  const first = addProviderBillMirror(nayatelOnly(), [], newBillFields());
  const second = addProviderBillMirror(first.providers, first.expenses, newBillFields({ date: '2026-12-05', billMonth: '2026-12' }));
  assert.equal(second.expenses.length, 2);
  const deleted = deleteProviderBillMirror(second.providers, second.expenses, first.bill.id);
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.providers.providers[0].bills.length, 1);
  assert.equal(deleted.providers.providers[0].bills[0].id, second.bill.id);
  assert.equal(deleted.expenses.length, 1);
  assert.equal(deleted.expenses[0].providerBillId, second.bill.id);
});

test('G4: refusal predicate — a mirror row is refused, an ordinary manual Nayatel row is not', () => {
  const added = addProviderBillMirror(nayatelOnly(), [], newBillFields());
  assert.equal(isUpstreamMirrorExpense(added.expenses[0]), true);
  assert.equal(isUpstreamMirrorExpense({ id: 'e-manual', date: '2026-11-05', category: 'Nayatel bill', amount: 60575 }), false,
    'an ordinary hand-entered Nayatel bill is not a mirror row');
  assert.equal(isUpstreamMirrorExpense(null), false);
  assert.equal(isUpstreamMirrorExpense({ providerBillId: '' }), false);
  assert.throws(() => mirrorProviderBill(added.providers, added.expenses, 'pb-no-such-bill'), /Unknown provider bill/);
});

test('G4: updateExpense preserves the link — documents the drift the generic-form guard prevents', () => {
  const added = addProviderBillMirror(nayatelOnly(), [], newBillFields());
  const state = { expenses: added.expenses };
  const edited = updateExpense(state, added.expense.id, { amount: 100 });
  assert.equal(edited.expenses[0].providerBillId, added.bill.id, 'the link survives a generic-form edit — hence the guard');
  assert.equal(edited.expenses[0].amount, 100);
});

// --- G5: double-count visibility + null amount -------------------------------

test('G5: a live overhead posting is shown, not blocking — mirror still writes its own row', () => {
  const posted = postOverhead({ expenses: [] }, { templates: [], postings: [] }, 'upstream-bandwidth', { amount: 60575, date: '2026-11-05' });
  const live = overheadPostingFor(posted.overheads, posted.state, 'upstream-bandwidth', '2026-11');
  assert.ok(live, 'the tab can surface the posted amount');
  assert.equal(live.amount, 60575);
  const result = addProviderBillMirror(nayatelOnly(), posted.state.expenses, newBillFields());
  assert.equal(result.expenses.length, 2, 'overhead posting + mirror row: two distinct rows for the same month');
  const mirrorRows = result.expenses.filter(row => isUpstreamMirrorExpense(row));
  assert.equal(mirrorRows.length, 1, 'exactly one row carries providerBillId — the two are distinguishable');
  assert.equal(result.expenses.filter(row => !isUpstreamMirrorExpense(row)).length, 1);
});

test('G5: a null-amount bill is refused — the mirror throws and writes neither row', () => {
  assert.throws(() => createProviderBill(nayatelOnly(), newBillFields({ amount: null })), /unknown amount/);
  assert.throws(() => addProviderBillMirror(nayatelOnly(), [], newBillFields({ amount: null })), /unknown amount/);
  assert.throws(() => addProviderBillMirror(nayatelOnly(), [], newBillFields({ amount: '' })), /unknown amount/);
  const register = nayatelOnly();
  assert.deepEqual(register.providers[0].bills, [], 'no provider row was written');
});

// --- Helpers: provider add + pending setter + seed protection -----------------

test('Helpers: addUpstreamProvider adds by fixed-list name, dedupes, refuses free text', () => {
  const added = addUpstreamProvider(emptyRegister(), 'PTCL');
  assert.equal(added.added, true);
  assert.equal(added.provider.id, 'prov-ptcl');
  assert.equal(added.provider.name, 'PTCL');
  assert.deepEqual(added.provider.bills, []);
  assert.equal(added.provider.pendingBill, null);
  const again = addUpstreamProvider(added.providers, 'PTCL');
  assert.equal(again.added, false, 'the same name twice is one provider');
  assert.equal(again.providers.providers.length, 1);
  assert.throws(() => addUpstreamProvider(emptyRegister(), 'Ghost ISP'), /from the list/);
});

test('Helpers: setProviderPendingBill sets, validates and clears — and writes no expense row', () => {
  const added = addUpstreamProvider(emptyRegister(), 'PTCL');
  const set = setProviderPendingBill(added.providers, added.provider.id,
    { month: '2026-12', amount: 60575, issuedDate: '2026-12-01' });
  assert.deepEqual(set.provider.pendingBill, { month: '2026-12', amount: 60575, issuedDate: '2026-12-01' });
  assert.throws(() => setProviderPendingBill(added.providers, added.provider.id,
    { month: '2026-13', amount: 100, issuedDate: '2026-12-01' }), /valid pending bill/);
  assert.throws(() => setProviderPendingBill(added.providers, 'prov-nope', null), /Unknown upstream provider/);
  const cleared = setProviderPendingBill(set.providers, added.provider.id, null);
  assert.equal(cleared.provider.pendingBill, null);
});

test('Helpers: seed history cannot be edited or deleted through the mirror', () => {
  const seed = seedUpstreamProviders();
  const seedBill = seed.providers[0].bills[0];
  assert.throws(() => editProviderBillMirror(seed, [], seedBill.id, { amount: 1 }), /Seed history cannot be edited/);
  assert.throws(() => deleteProviderBillMirror(seed, [], seedBill.id), /Seed history cannot be deleted/);
  assert.throws(() => editProviderBillMirror(seed, [], 'pb-no-such-bill', { amount: 1 }), /Unknown provider bill/);
  assert.throws(() => deleteProviderBillMirror(seed, [], 'pb-no-such-bill'), /Unknown provider bill/);
});

// --- G6: backup wiring (parent follow-up) ------------------------------------
// H1 proved the round-trip at the core.js function level. These tests prove
// the app.js wiring that actually calls it in the real backup path:
// backupExtras() exports the section, backupRestoreOptions() snapshots the
// current section for the merge preview, and the apply block restores it.
// There is no DOM harness for app.js, so the wiring itself is asserted on
// the app.js source (the repo's established pattern for app.js-only
// behaviour) and the end-to-end seam is exercised through core.js exactly
// as app.js calls it.

const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('G6: app.js backupExtras() exports the upstream register (write side of the real backup path)', () => {
  assert.ok(appJs.includes('upstreamProviders: loadUpstreamProviders()'),
    'backupExtras() must pass the register to createJsonBackup — otherwise real backups never contain the section');
  assert.ok(appJs.includes("from './upstream-providers.js'"),
    'app.js imports the register module (same specifier as core.js, so the module bundles once)');
});

test('G6: app.js backupRestoreOptions() snapshots the current register for the merge preview', () => {
  assert.ok(appJs.includes('currentUpstreamProviders: loadUpstreamProviders()'),
    'the preview needs the current register or it cannot tell identical from conflicting');
  assert.ok(appJs.includes('currentUpstreamProvidersStored: upstreamProvidersStored'),
    'the preview needs the stored flag or a fresh device looks like a conflicting device');
  assert.ok(appJs.includes('localStorage.getItem(UPSTREAM_PROVIDERS_KEY)'),
    'the stored flag is read from the key itself');
});

test('G6: app.js applies a restored register after the safe merge', () => {
  assert.ok(appJs.includes('saveUpstreamProviders(pendingBackupPreview.upstreamProviders)'),
    'without the apply line the preview adopts the register and then drops it');
});

test('G6: end-to-end seam — export, preview and apply through the exact calls app.js makes', () => {
  // Export side: backupExtras() hands loadUpstreamProviders() to createJsonBackup.
  const loaded = loadUpstreamProviders(); // seeds Nayatel on first read
  assert.equal(loaded.providers.length, 1);
  const backupText = createJsonBackup(createInitialState(), REF, { upstreamProviders: loaded });
  assert.deepEqual(JSON.parse(backupText).settings.upstreamProviders, sanitizeUpstreamProviders(loaded));
  // Preview side: backupRestoreOptions() hands current* to previewJsonBackupMerge.
  const preview = previewJsonBackupMerge(createInitialState(), backupText, {
    currentUpstreamProviders: { providers: [] },
    currentUpstreamProvidersStored: false,
  });
  assert.equal(preview.checksumStatus, 'verified');
  assert.deepEqual(preview.upstreamProviders, sanitizeUpstreamProviders(loaded));
  assert.equal(preview.counts.upstreamProvidersRestored, 1);
  assert.deepEqual(preview.conflicts, []);
  // Apply side: the apply block calls saveUpstreamProviders(preview.upstreamProviders).
  mockStorage.clear();
  saveUpstreamProviders(preview.upstreamProviders);
  const restored = loadUpstreamProviders();
  assert.equal(restored.providers.length, 1);
  assert.equal(restored.providers[0].name, 'Nayatel');
  assert.equal(restored.providers[0].bills.length, 22);
});

test('G6: conflict at the app seam — differing records on both sides keep existing and raise a conflict', () => {
  const loaded = loadUpstreamProviders();
  const backupText = createJsonBackup(createInitialState(), REF, { upstreamProviders: loaded });
  const other = {
    providers: [{
      id: 'prov-nayatel', name: 'Nayatel', active: true,
      bills: [{ id: 'pb-other', date: '2026-10-31', amount: 1, billMonth: '2026-10', method: '', note: '', seeded: false, mirrored: false }],
      pendingBill: null,
    }],
  };
  const conflicted = previewJsonBackupMerge(createInitialState(), backupText, {
    currentUpstreamProviders: other,
    currentUpstreamProvidersStored: true,
  });
  assert.equal(conflicted.upstreamProviders, null, 'existing records are kept');
  assert.ok(conflicted.conflicts.some(entry => entry.field === 'Upstream provider records differ from this device'));
});

// --- G7: static UI wiring (no DOM harness for the Expenses view) -------------

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('G7: the Upstream tab and panel exist in the Expenses view, after Fixed overheads', () => {
  assert.ok(indexHtml.includes('id="expenseTabUpstream"'), 'tab button exists');
  assert.ok(indexHtml.includes('id="upstreamPanel"'), 'panel exists');
  assert.ok(indexHtml.indexOf('expenseTabUpstream') > indexHtml.indexOf('expenseTabOverheads'),
    'the tab sits after Fixed overheads');
  assert.ok(indexHtml.indexOf('id="upstreamPanel"') > indexHtml.indexOf('id="overheadsPanel"'),
    'the panel section sits after the overheads panel section');
  const tabIds = [...new Set(indexHtml.match(/id="expenseTab[A-Z][a-z]+"/g) || [])];
  assert.equal(tabIds.length, 6, `six expense tabs, got: ${tabIds.join(', ')}`);
  assert.ok(indexHtml.includes('aria-controls="upstreamPanel"'), 'the tab controls the panel');
  assert.ok(!indexHtml.includes('accountId') && !indexHtml.includes('NTL'),
    'the panel has no account-ID field anywhere (hard rule)');
});

test('G7: app.js wires the tab — syncExpenseTabs, click wiring, render arm, guard and table lock', () => {
  assert.ok(/upstream:\s*'#expenseTabUpstream'/.test(appJs), 'syncExpenseTabs tabs map has upstream');
  assert.ok(/upstream:\s*'#upstreamPanel'/.test(appJs), 'syncExpenseTabs panels map has upstream');
  assert.ok(appJs.includes("['upstream','#expenseTabUpstream']"), 'tab click wiring includes upstream');
  assert.ok(appJs.includes('renderUpstream()'), 'a renderUpstream branch exists');
  assert.ok(appJs.includes("if (expenseActiveTab === 'upstream') renderUpstream();"), 'renderExpenses refreshes the tab');
  assert.ok(appJs.includes('previous?.providerBillId'), 'the generic-form guard refuses a providerBillId row (SISP-45/56/107 shape)');
  assert.ok(appJs.includes("typeof row.providerBillId === 'string'"), 'the ledger table locks provider rows (SISP-107 shape)');
  assert.ok(appJs.includes("t('exp_upstream_synced_hint')"),
    'the refusal toast points at the Upstream tab through the keyed hint (H5 D2(b) — the "hardcoded, H2 adds no i18n key" comment is now false, rewritten not deleted)');
  assert.ok(appJs.includes('<span class="expense-roznamcha-badge">Upstream</span>'),
    'the ledger shows a plain Upstream badge, no jump button');
});
