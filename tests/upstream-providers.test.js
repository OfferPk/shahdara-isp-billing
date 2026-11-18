// Hisaab Clearly Visible (H1): upstream bandwidth provider register.
// Pure module + seed + backup manifest entry. Synthetic data only —
// the seed transcribes the operator's Nayatel history (dates + amounts
// only); no bill ID, account ID or NTL number exists anywhere in the
// model, the seed, or these tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UPSTREAM_PROVIDERS_KEY,
  UPSTREAM_PROVIDER_NAMES,
  SEED_PROVIDER_ID,
  SEED_TOTAL_PAID,
  SEED_SINCE,
  seedUpstreamProviders,
  sanitizeUpstreamProviders,
  loadUpstreamProviders,
  saveUpstreamProviders,
  providerById,
  providerByName,
  providerBillTotals,
  providerSince,
  providerBillsForMonth,
  providerMonthSummary,
  providerRunRate,
  summarizeProvider,
} from '../upstream-providers.js';
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

const seededNayatel = () => seedUpstreamProviders().providers[0];

// --- G1: seed + load -------------------------------------------------------

test('G1: seed loads once when the key is absent — 1 provider, 22 bills, total 502,820, since 2025-05-05, pending Nov 2026 60,575', () => {
  assert.equal(UPSTREAM_PROVIDERS_KEY, 'sisp_upstream_providers_v1');
  assert.deepEqual(UPSTREAM_PROVIDER_NAMES, ['Nayatel', 'PTCL', 'Transworld', 'Wateen', 'Telenor', 'Jazz', 'Other']);
  const loaded = loadUpstreamProviders();
  assert.equal(loaded.providers.length, 1);
  const nayatel = loaded.providers[0];
  assert.equal(nayatel.id, SEED_PROVIDER_ID);
  assert.equal(nayatel.name, 'Nayatel');
  assert.equal(nayatel.active, true);
  assert.equal(nayatel.bills.length, 22);
  assert.deepEqual(providerBillTotals(nayatel), { total: 502820, knownCount: 21, unknownCount: 1, billCount: 22 });
  assert.equal(providerSince(nayatel), SEED_SINCE);
  assert.deepEqual(nayatel.pendingBill, { month: '2026-11', amount: 60575, issuedDate: '2026-11-01' });
  for (const bill of nayatel.bills) {
    assert.equal(bill.seeded, true, 'every seed row is history-only');
    assert.equal(bill.mirrored, false, 'no seed row ever gains an expense row');
  }
  // The seed is persisted, so the next read is a plain read.
  assert.ok(mockStorage.getItem(UPSTREAM_PROVIDERS_KEY), 'the seed is saved on first read');
});

test('G1: second load does NOT re-seed — same bills, same ids, storage untouched', () => {
  const first = loadUpstreamProviders();
  const firstRaw = mockStorage.getItem(UPSTREAM_PROVIDERS_KEY);
  const second = loadUpstreamProviders();
  assert.deepEqual(second, first);
  assert.deepEqual(second.providers[0].bills.map(bill => bill.id), first.providers[0].bills.map(bill => bill.id));
  assert.equal(mockStorage.getItem(UPSTREAM_PROVIDERS_KEY), firstRaw);
});

test('G1: an existing key is respected — stored providers survive, no seed is applied', () => {
  const custom = {
    providers: [{
      id: 'prov-ptcl',
      name: 'PTCL',
      active: true,
      bills: [{ id: 'pb-custom-1', date: '2026-10-05', amount: 12000, billMonth: '2026-10', method: '', note: '', seeded: false, mirrored: true }],
      pendingBill: null,
    }],
  };
  saveUpstreamProviders(custom);
  const loaded = loadUpstreamProviders();
  assert.equal(loaded.providers.length, 1);
  assert.equal(loaded.providers[0].name, 'PTCL');
  assert.equal(providerByName(loaded, 'Nayatel'), null);
  assert.equal(providerById(loaded, 'prov-ptcl')?.name, 'PTCL');

  // A present-but-empty register is an operator-cleared register, not a missing one.
  saveUpstreamProviders({ providers: [] });
  assert.deepEqual(loadUpstreamProviders(), { providers: [] });
});

test('G1: corrupt stored JSON returns empty and does not re-seed or overwrite', () => {
  mockStorage.setItem(UPSTREAM_PROVIDERS_KEY, '{not json');
  assert.deepEqual(loadUpstreamProviders(), { providers: [] });
  assert.equal(mockStorage.getItem(UPSTREAM_PROVIDERS_KEY), '{not json');
});

// --- G2: totals, since, run-rate, months ------------------------------------

test('G2: provider totals — 502,820 over 21 known bills, 1 unknown excluded and counted', () => {
  const nayatel = seededNayatel();
  assert.deepEqual(providerBillTotals(nayatel), { total: SEED_TOTAL_PAID, knownCount: 21, unknownCount: 1, billCount: 22 });
  assert.equal(SEED_TOTAL_PAID, 502820);
  assert.equal(providerBillTotals({ name: 'Nayatel', bills: [] }).total, 0);
  assert.equal(providerBillTotals(null).total, 0);
});

test('G2: since is the oldest bill date; a provider with no bills has no since', () => {
  assert.equal(providerSince(seededNayatel()), '2025-05-05');
  assert.equal(providerSince({ name: 'Nayatel', bills: [] }), null);
  assert.equal(providerSince(null), null);
});

test('G2: run-rate — last bill Oct 2026 60,575; last-three average 60,575', () => {
  const nayatel = seededNayatel();
  assert.deepEqual(providerRunRate(nayatel), {
    lastBill: { date: '2026-10-31', amount: 60575 },
    lastThreeAverage: 60575,
    lastThreeCount: 3,
  });
  const twoBill = {
    name: 'PTCL', bills: [
      { id: 'pb-a', date: '2026-09-01', amount: 10000, billMonth: '2026-09', method: '', note: '', seeded: false, mirrored: false },
      { id: 'pb-b', date: '2026-10-01', amount: 20000, billMonth: '2026-10', method: '', note: '', seeded: false, mirrored: false },
    ],
  };
  assert.deepEqual(providerRunRate(twoBill), {
    lastBill: { date: '2026-10-01', amount: 20000 },
    lastThreeAverage: 15000,
    lastThreeCount: 2,
  });
  const unknownOnly = {
    name: 'Jazz', bills: [
      { id: 'pb-c', date: '2026-10-01', amount: null, billMonth: '2026-10', method: '', note: 'raqam maloom nahi', seeded: false, mirrored: false },
    ],
  };
  assert.deepEqual(providerRunRate(unknownOnly), { lastBill: null, lastThreeAverage: null, lastThreeCount: 0 });
});

test('G2: a month with no record is null, never Rs. 0; an unknown-amount month has null total', () => {
  const nayatel = seededNayatel();
  assert.equal(providerMonthSummary(nayatel, '2026-06'), null, 'Jun 2026 has no payment row');
  assert.deepEqual(providerBillsForMonth(nayatel, '2026-06'), []);
  assert.deepEqual(providerMonthSummary(nayatel, '2026-05'), { total: null, knownCount: 0, unknownCount: 1, billCount: 1 });
  assert.deepEqual(providerMonthSummary(nayatel, '2026-02'), { total: 27376, knownCount: 4, unknownCount: 0, billCount: 4 });
  assert.deepEqual(providerMonthSummary(nayatel, '2025-06'), { total: 8657, knownCount: 2, unknownCount: 0, billCount: 2 });
});

test('G2: summarizeProvider bundles the card figures', () => {
  const summary = summarizeProvider(seededNayatel());
  assert.deepEqual(summary, {
    id: 'prov-nayatel',
    name: 'Nayatel',
    active: true,
    total: 502820,
    knownCount: 21,
    unknownCount: 1,
    billCount: 22,
    since: '2025-05-05',
    lastBill: { date: '2026-10-31', amount: 60575 },
    lastThreeAverage: 60575,
    lastThreeCount: 3,
    pendingBill: { month: '2026-11', amount: 60575, issuedDate: '2026-11-01' },
  });
  assert.equal(summarizeProvider(null), null);
  assert.equal(summarizeProvider({ name: 'Not A Provider', bills: [] }), null);
});

// --- G3: sanitizer + the hard rule ------------------------------------------

test('G3: the sanitizer whitelists fields — account IDs and NTL numbers never survive', () => {
  const smuggled = {
    providers: [{
      id: 'prov-nayatel',
      name: 'Nayatel',
      active: true,
      accountId: 'TEST-ACCOUNT-ID',
      ntlNumber: 'NTL-000000',
      bills: [{
        id: 'pb-1', date: '2025-05-05', amount: 30892, billMonth: '2025-05',
        method: '', note: '', seeded: true, mirrored: false, accountId: 'TEST-ACCOUNT-ID',
      }],
      pendingBill: null,
    }],
  };
  const cleaned = sanitizeUpstreamProviders(smuggled);
  assert.equal(cleaned.providers.length, 1);
  assert.equal(cleaned.providers[0].bills.length, 1);
  assert.equal(JSON.stringify(cleaned).includes('TEST-ACCOUNT-ID'), false);
  assert.equal(JSON.stringify(cleaned).includes('NTL-000000'), false);
  assert.equal(JSON.stringify(cleaned).includes('accountId'), false);
  assert.equal(JSON.stringify(cleaned).includes('ntlNumber'), false);
  // The seed itself carries no such field either.
  const seedJson = JSON.stringify(seedUpstreamProviders());
  assert.equal(/account|NTL/i.test(seedJson), false, 'the seed holds dates, amounts and a provider name only');
});

test('G3: the sanitizer drops invalid rows, dedupes, and fills missing ids', () => {
  const dirty = {
    providers: [
      { id: 'prov-nayatel', name: 'Nayatel', active: true, bills: [
        { id: 'pb-keep', date: '2025-05-05', amount: 100, billMonth: '2025-05', method: '', note: '', seeded: false, mirrored: false },
        { id: 'pb-keep', date: '2025-05-06', amount: 200, billMonth: '2025-05', method: '', note: '', seeded: false, mirrored: false },
        { id: 'pb-bad-date', date: '2025-13-40', amount: 300, billMonth: '2025-13', method: '', note: '', seeded: false, mirrored: false },
        { id: 'pb-bad-amount', date: '2025-05-07', amount: -50, billMonth: '2025-05', method: '', note: '', seeded: false, mirrored: false },
        { id: 'pb-bad-amount-2', date: '2025-05-07', amount: 'abc', billMonth: '2025-05', method: '', note: '', seeded: false, mirrored: false },
        { date: '2025-05-08', amount: 400, billMonth: '2025-05', method: 'x'.repeat(80), note: 'y'.repeat(150), seeded: false, mirrored: false },
      ], pendingBill: { month: '2026-13', amount: 100, issuedDate: '2026-11-01' } },
      { id: 'prov-nayatel', name: 'Nayatel', active: true, bills: [], pendingBill: null },
      { id: 'prov-ghost', name: 'Ghost ISP', active: true, bills: [], pendingBill: null },
      { name: 'PTCL', active: true, bills: [], pendingBill: null },
      null,
    ],
  };
  const cleaned = sanitizeUpstreamProviders(dirty);
  assert.equal(cleaned.providers.length, 2, 'duplicate Nayatel, unknown Ghost ISP and the null row are dropped');
  const nayatel = cleaned.providers[0];
  assert.equal(nayatel.bills.length, 2, 'duplicate id, bad date and bad amounts are dropped');
  assert.equal(nayatel.bills[0].id, 'pb-keep');
  assert.ok(nayatel.bills[1].id.startsWith('pb-'), 'a bill without an id gets one');
  assert.equal(nayatel.bills[1].method.length, 50, 'method is capped at 50 chars');
  assert.equal(nayatel.bills[1].note.length, 100, 'note is capped at 100 chars');
  assert.equal(nayatel.pendingBill, null, 'a pending bill with an invalid month is dropped');
  assert.equal(cleaned.providers[1].id, 'prov-ptcl', 'a provider without an id gets a slug id');
  assert.deepEqual(sanitizeUpstreamProviders(null), { providers: [] });
  assert.deepEqual(sanitizeUpstreamProviders([]), { providers: [] });
  assert.deepEqual(sanitizeUpstreamProviders({ providers: 'nope' }), { providers: [] });
});

test('G3: the sanitizer keeps null-amount bills and seeded/mirrored flags', () => {
  const value = {
    providers: [{
      id: 'prov-nayatel', name: 'Nayatel', active: true,
      bills: [{ id: 'pb-null', date: '2026-05-12', amount: null, billMonth: '2026-05', method: '', note: 'raqam maloom nahi', seeded: true, mirrored: false }],
      pendingBill: null,
    }],
  };
  const cleaned = sanitizeUpstreamProviders(value);
  assert.equal(cleaned.providers[0].bills[0].amount, null);
  assert.equal(cleaned.providers[0].bills[0].seeded, true);
  assert.equal(cleaned.providers[0].bills[0].mirrored, false);
  const mirrored = sanitizeUpstreamProviders({ providers: [{ id: 'prov-x', name: 'PTCL', bills: [{ id: 'pb-m', date: '2026-10-01', amount: 100, seeded: false, mirrored: true }], pendingBill: null }] });
  assert.equal(mirrored.providers[0].bills[0].mirrored, true);
});

// --- G4: backup round-trip ---------------------------------------------------

test('G4: the backup writes the section only when providers exist', () => {
  const state = createInitialState();
  const seed = seedUpstreamProviders();
  const withProviders = JSON.parse(createJsonBackup(state, REF, { upstreamProviders: seed }));
  assert.deepEqual(withProviders.settings.upstreamProviders, sanitizeUpstreamProviders(seed));
  const withoutProviders = JSON.parse(createJsonBackup(state, REF, {}));
  assert.equal('upstreamProviders' in (withoutProviders.settings ?? {}), false);
  const emptyProviders = JSON.parse(createJsonBackup(state, REF, { upstreamProviders: { providers: [] } }));
  assert.equal('upstreamProviders' in (emptyProviders.settings ?? {}), false);
});

test('G4: full round-trip — the seed restores deep-identical onto a fresh device', () => {
  const state = createInitialState();
  const seed = seedUpstreamProviders();
  const backupText = createJsonBackup(state, REF, { upstreamProviders: seed });
  const preview = previewJsonBackupMerge(createInitialState(), backupText, {});
  assert.equal(preview.checksumStatus, 'verified', 'the backup passes its own checksum gate');
  assert.deepEqual(preview.upstreamProviders, sanitizeUpstreamProviders(seed));
  assert.equal(preview.counts.upstreamProvidersRestored, 1);
  assert.deepEqual(preview.conflicts, [], 'a fresh-device restore has no conflicts');
  assert.equal(preview.canApply, true);
});

test('G4: conflict — differing records on both sides keep existing and raise a conflict; identical restores silently', () => {
  const state = createInitialState();
  const seed = seedUpstreamProviders();
  const backupText = createJsonBackup(state, REF, { upstreamProviders: seed });

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
  assert.equal(conflicted.counts.upstreamProvidersRestored, undefined);
  assert.ok(conflicted.conflicts.some(entry => entry.field === 'Upstream provider records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, {
    currentUpstreamProviders: seed,
    currentUpstreamProvidersStored: true,
  });
  assert.equal(identical.upstreamProviders, null, 'nothing to restore when both sides match');
  assert.equal(identical.counts.upstreamProvidersRestored, undefined);
  assert.deepEqual(identical.conflicts, []);
});
