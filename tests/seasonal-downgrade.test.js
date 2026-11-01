// SISP-153: Seasonal CCTV / Keep-Alive Package Downgrade & Auto-Restore.
// Pure-function tests on synthetic data only — no real customer names,
// no real prices from the owner's ledger.
//
// Spec pins: seasonal billing during active months (the until month
// itself included) and automatic package restoration after expiry,
// with NO mutation of the record. Plus precedence (FREE, vacation
// hold), the all-or-nothing triple sanitizer, backup round-trip, and
// the already-generated-bill snapshot guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  hasSeasonalTriple,
  isValidSeasonalMonth,
  sanitizeSeasonalFields,
  seasonalPriceFor,
  seasonalStateForMonth,
  validateSeasonalFields
} from '../seasonal-downgrade.js';
import { applicablePriceForMonth, planCustomerCycleLine } from '../billing-cycle.js';
import {
  addCustomer,
  createInitialState,
  createJsonBackup,
  generateMonthlyBillsThroughCurrentMonth,
  persistState,
  previewJsonBackupMerge,
  readState,
  updateCustomerProfile
} from '../core.js';
import { seasonalBillingSummary } from '../profile-ui.js';
import { TRANSLATIONS } from '../nav-language.js';
import { ENTRY_FILES } from '../build.mjs';

const TRIPLE = { seasonalRatePKR: 500, seasonalUntilMonth: '2027-03', restorePackageRatePKR: 3000 };

function baseCustomer(overrides = {}) {
  return {
    id: 'c1',
    customerNumber: 1,
    name: 'TEST SEASONAL CUSTOMER',
    monthlySellingAmount: 3000,
    monthlyPriceSchedule: [{ amount: 3000, effectiveMonth: '2026-01', recordedAt: '2026-01-01 00:00' }],
    billingStartMonth: '2026-01',
    bills: [],
    incidents: [],
    installmentPlans: [],
    packageHistory: [],
    archived: false,
    isFreeConnection: false,
    paused: false,
    pauseStartDate: null,
    autoResumeDate: null,
    pauseSkippedMonths: [],
    ...TRIPLE,
    ...overrides
  };
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value))
  };
}

// ---------------------------------------------------------------- module

test('sanitizer: a complete valid triple survives, money rounds to paisa', () => {
  assert.deepEqual(
    sanitizeSeasonalFields({ seasonalRatePKR: '500.456', seasonalUntilMonth: '2027-03', restorePackageRatePKR: 3000 }),
    { seasonalRatePKR: 500.46, seasonalUntilMonth: '2027-03', restorePackageRatePKR: 3000 }
  );
  assert.equal(hasSeasonalTriple(baseCustomer()), true);
  assert.equal(isValidSeasonalMonth('2027-03'), true);
  assert.equal(isValidSeasonalMonth('2027-13'), false);
  assert.equal(isValidSeasonalMonth('2027-3'), false);
});

test('sanitizer: any missing or invalid part drops the WHOLE triple to inert', () => {
  const inert = { seasonalRatePKR: null, seasonalUntilMonth: null, restorePackageRatePKR: null };
  for (const broken of [
    { seasonalRatePKR: null, seasonalUntilMonth: '2027-03', restorePackageRatePKR: 3000 },
    { seasonalRatePKR: 500, seasonalUntilMonth: null, restorePackageRatePKR: 3000 },
    { seasonalRatePKR: 500, seasonalUntilMonth: '2027-03', restorePackageRatePKR: null },
    { seasonalRatePKR: 0, seasonalUntilMonth: '2027-03', restorePackageRatePKR: 3000 },
    { seasonalRatePKR: -5, seasonalUntilMonth: '2027-03', restorePackageRatePKR: 3000 },
    { seasonalRatePKR: 'abc', seasonalUntilMonth: '2027-03', restorePackageRatePKR: 3000 },
    { seasonalRatePKR: 500, seasonalUntilMonth: '2027-13', restorePackageRatePKR: 3000 },
    { seasonalRatePKR: 500, seasonalUntilMonth: 'March 2027', restorePackageRatePKR: 3000 },
    {},
    null,
    undefined
  ]) {
    assert.deepEqual(sanitizeSeasonalFields(broken), inert, JSON.stringify(broken));
  }
});

test('validate: clear is valid, a lone restore value clears with the window, partial is an error', () => {
  assert.equal(validateSeasonalFields({ seasonalRatePKR: '', seasonalUntilMonth: '', restorePackageRatePKR: '' }), null);
  assert.equal(validateSeasonalFields({ seasonalRatePKR: null, seasonalUntilMonth: null, restorePackageRatePKR: null }), null);
  // The form pre-fills the restore rate alone: not an error, and the
  // sanitizer stores no triple for it.
  assert.equal(validateSeasonalFields({ seasonalRatePKR: '', seasonalUntilMonth: '', restorePackageRatePKR: '3000' }), null);
  assert.deepEqual(
    sanitizeSeasonalFields({ seasonalRatePKR: '', seasonalUntilMonth: '', restorePackageRatePKR: '3000' }),
    { seasonalRatePKR: null, seasonalUntilMonth: null, restorePackageRatePKR: null }
  );
  assert.match(validateSeasonalFields({ seasonalRatePKR: '500', seasonalUntilMonth: '', restorePackageRatePKR: '3000' }), /until/i);
  assert.match(validateSeasonalFields({ seasonalRatePKR: '', seasonalUntilMonth: '2027-03', restorePackageRatePKR: '3000' }), /rate/i);
  assert.match(validateSeasonalFields({ seasonalRatePKR: '500', seasonalUntilMonth: '2027-03', restorePackageRatePKR: '' }), /restore/i);
  assert.equal(validateSeasonalFields({ seasonalRatePKR: '500', seasonalUntilMonth: '2027-03', restorePackageRatePKR: '3000' }), null);
});

// ------------------------------------------------------------- price seam

test('price seam: seasonal rate bills inside the window, the until month included', () => {
  const customer = baseCustomer();
  assert.equal(seasonalPriceFor(customer, '2026-10'), 500);
  assert.equal(applicablePriceForMonth(customer, '2026-11'), 500);
  assert.equal(applicablePriceForMonth(customer, '2027-03'), 500); // until month itself
  assert.equal(seasonalStateForMonth(customer, '2027-03'), 'active');
});

test('price seam: auto-restore after expiry — restore rate, record byte-identical (no mutation)', () => {
  const customer = baseCustomer();
  const before = JSON.stringify(customer);
  assert.equal(applicablePriceForMonth(customer, '2027-04'), 3000); // first month after the window
  assert.equal(applicablePriceForMonth(customer, '2027-12'), 3000);
  assert.equal(seasonalPriceFor(customer, '2028-06'), 3000);
  assert.equal(seasonalStateForMonth(customer, '2027-04'), 'expired');
  assert.equal(JSON.stringify(customer), before);
});

test('price seam: no triple -> the schedule rules exactly as before, later schedule changes honoured', () => {
  const plain = baseCustomer({ seasonalRatePKR: null, seasonalUntilMonth: null, restorePackageRatePKR: null });
  assert.equal(applicablePriceForMonth(plain, '2026-11'), 3000);
  assert.equal(applicablePriceForMonth(plain, '2027-04'), 3000);
  assert.equal(seasonalPriceFor(plain, '2026-11'), null);
  const raised = baseCustomer({
    seasonalRatePKR: null, seasonalUntilMonth: null, restorePackageRatePKR: null,
    monthlyPriceSchedule: [
      { amount: 3000, effectiveMonth: '2026-01', recordedAt: '2026-01-01 00:00' },
      { amount: 3500, effectiveMonth: '2027-01', recordedAt: '2026-12-20 00:00' }
    ]
  });
  assert.equal(applicablePriceForMonth(raised, '2027-02'), 3500);
});

test('price seam: an incomplete or junk triple is inert — schedule price applies', () => {
  for (const overrides of [
    { seasonalRatePKR: null },
    { seasonalUntilMonth: null },
    { restorePackageRatePKR: null },
    { seasonalRatePKR: 'abc' },
    { seasonalUntilMonth: '2027-13' },
    { seasonalRatePKR: 0 }
  ]) {
    const customer = baseCustomer(overrides);
    assert.equal(applicablePriceForMonth(customer, '2026-11'), 3000, JSON.stringify(overrides));
    assert.equal(hasSeasonalTriple(customer), false);
  }
});

test('cycle line: an in-window month plans at the seasonal rate; the month after restores', () => {
  const customer = baseCustomer();
  const inside = planCustomerCycleLine(customer, '2026-11');
  assert.equal(inside.skipped, false);
  assert.equal(inside.currentMonthBill, 500);
  const restored = planCustomerCycleLine(customer, '2027-04');
  assert.equal(restored.skipped, false);
  assert.equal(restored.currentMonthBill, 3000);
});

test('precedence: FREE never prices (skipped before the seam), a held month is never billed', () => {
  const free = baseCustomer({ isFreeConnection: true });
  assert.equal(planCustomerCycleLine(free, '2026-11').reason, 'free-connection');
  const held = baseCustomer({ paused: true, pauseStartDate: '2026-10-15', autoResumeDate: null });
  const heldLine = planCustomerCycleLine(held, '2026-11');
  assert.equal(heldLine.skipped, true);
  assert.equal(heldLine.reason, 'paused');
  // Even inside the seasonal window, the generator creates no bill for
  // a held month — the hold's rule wins over the seasonal rate.
  const state = { customers: [baseCustomer({ id: 'h1', billingStartMonth: '2026-10', paused: true, pauseStartDate: '2026-10-15', autoResumeDate: null })] };
  const generated = generateMonthlyBillsThroughCurrentMonth(state, new Date('2026-11-15T12:00:00Z'));
  assert.equal(generated.customers[0].bills.length, 0);
});

// ------------------------------------------------------------ auto-generator

test('auto-generator: new bills inside the window stamp the seasonal rate; after expiry the restore rate', () => {
  const seasonal = baseCustomer({ id: 'g1', billingStartMonth: '2026-10', seasonalUntilMonth: '2026-10' });
  const state = { customers: [seasonal] };
  const next = generateMonthlyBillsThroughCurrentMonth(state, new Date('2026-11-15T12:00:00Z'));
  const bills = next.customers[0].bills;
  const october = bills.find((bill) => bill.month === '2026-10');
  const november = bills.find((bill) => bill.month === '2026-11');
  assert.equal(october.dueAmount, 500);
  assert.equal(october.priceSnapshot, 500);
  assert.equal(november.dueAmount, 3000);
  assert.equal(november.priceSnapshot, 3000);
});

test('snapshot guard: an already-generated bill is never repriced by a later seasonal set', () => {
  const existingBill = {
    id: 'b-nov', month: '2026-11', dueAmount: 3000, dueDate: '2026-11-05', status: 'pending',
    payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-11-01 09:00', amountHistory: []
  };
  const customer = baseCustomer({ bills: [existingBill] });
  // The cycle adopts the existing bill at its stamped amount — the
  // seasonal rate (500) must NOT rewrite it.
  const line = planCustomerCycleLine(customer, '2026-11');
  assert.equal(line.skipped, false);
  assert.equal(line.currentMonthBill, 3000);
  // And the auto-generator leaves the existing month completely alone.
  const state = { customers: [baseCustomer({ id: 'g2', billingStartMonth: '2026-11', bills: [existingBill] })] };
  const next = generateMonthlyBillsThroughCurrentMonth(state, new Date('2026-11-15T12:00:00Z'));
  const bills = next.customers[0].bills;
  assert.equal(bills.length, 1);
  assert.equal(bills[0].dueAmount, 3000);
  assert.equal(bills[0].priceSnapshot, 3000);
});

// ------------------------------------------------------------ profile saves

test('updateCustomerProfile: setting the triple writes no package history and no schedule change', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Seasonal Profile Test', new Date('2026-10-01'));
  const id = state.customers.find((c) => c.name === 'Seasonal Profile Test').id;
  const before = state.customers.find((c) => c.id === id);
  assert.equal(before.seasonalRatePKR, null);
  assert.equal(before.seasonalUntilMonth, null);
  assert.equal(before.restorePackageRatePKR, null);

  state = updateCustomerProfile(state, id, { seasonalRatePKR: '500', seasonalUntilMonth: '2027-03', restorePackageRatePKR: '3000' }, new Date('2026-10-20'));
  const after = state.customers.find((c) => c.id === id);
  assert.equal(after.seasonalRatePKR, 500);
  assert.equal(after.seasonalUntilMonth, '2027-03');
  assert.equal(after.restorePackageRatePKR, 3000);
  // Not a package change: no history entry, no schedule edit, speed untouched.
  assert.deepEqual(after.packageHistory, before.packageHistory);
  assert.deepEqual(after.monthlyPriceSchedule, before.monthlyPriceSchedule);
  assert.equal(after.packageSpeed, before.packageSpeed);
});

test('updateCustomerProfile: partial seasonal save throws; an unrelated save preserves the triple', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Seasonal Guard Test', new Date('2026-10-01'), { ...TRIPLE });
  const id = state.customers.find((c) => c.name === 'Seasonal Guard Test').id;
  assert.throws(
    () => updateCustomerProfile(state, id, { seasonalRatePKR: '700', seasonalUntilMonth: '', restorePackageRatePKR: '' }),
    /seasonal/i
  );
  state = updateCustomerProfile(state, id, { phone: '0300-0000000' }, new Date('2026-10-21'));
  const after = state.customers.find((c) => c.id === id);
  assert.equal(after.seasonalRatePKR, 500);
  assert.equal(after.seasonalUntilMonth, '2027-03');
  assert.equal(after.restorePackageRatePKR, 3000);
});

test('updateCustomerProfile: clearing the window fields removes the triple; a lone restore pre-fill saves fine', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Seasonal Clear Test', new Date('2026-10-01'), { ...TRIPLE });
  const id = state.customers.find((c) => c.name === 'Seasonal Clear Test').id;
  state = updateCustomerProfile(state, id, { seasonalRatePKR: '', seasonalUntilMonth: '', restorePackageRatePKR: '3000' }, new Date('2026-11-01'));
  const cleared = state.customers.find((c) => c.id === id);
  assert.equal(cleared.seasonalRatePKR, null);
  assert.equal(cleared.seasonalUntilMonth, null);
  assert.equal(cleared.restorePackageRatePKR, null);

  // A customer who never had a triple: the form's restore pre-fill
  // alone must not block or alter an ordinary profile save.
  state = addCustomer(state, 'Seasonal Prefill Test', new Date('2026-10-01'));
  const prefillId = state.customers.find((c) => c.name === 'Seasonal Prefill Test').id;
  state = updateCustomerProfile(state, prefillId, { seasonalRatePKR: '', seasonalUntilMonth: '', restorePackageRatePKR: '3000', phone: '0300-1111111' }, new Date('2026-11-01'));
  const plain = state.customers.find((c) => c.id === prefillId);
  assert.equal(plain.seasonalRatePKR, null);
  assert.equal(plain.phone, '0300-1111111');
});

// ------------------------------------------------------- storage and backup

test('readState: the triple survives a save/load round-trip; a corrupt triple loads as none', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Seasonal Storage Test', new Date('2026-10-01'), { ...TRIPLE });
  const storage = memoryStorage();
  persistState(state, storage);
  const restored = readState(storage).customers.find((c) => c.name === 'Seasonal Storage Test');
  assert.equal(restored.seasonalRatePKR, 500);
  assert.equal(restored.seasonalUntilMonth, '2027-03');
  assert.equal(restored.restorePackageRatePKR, 3000);

  const corrupt = JSON.parse(JSON.stringify(state));
  const target = corrupt.customers.find((c) => c.name === 'Seasonal Storage Test');
  target.seasonalRatePKR = 'not-a-number';
  const corruptStorage = memoryStorage();
  persistState(corrupt, corruptStorage);
  const cleaned = readState(corruptStorage).customers.find((c) => c.name === 'Seasonal Storage Test');
  assert.equal(cleaned.seasonalRatePKR, null);
  assert.equal(cleaned.seasonalUntilMonth, null);
  assert.equal(cleaned.restorePackageRatePKR, null);
});

test('backup: the triple travels in a JSON backup and merges into an empty local profile', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Seasonal Backup Test', new Date('2026-10-01'), { ...TRIPLE });
  const backupJson = createJsonBackup(state, new Date('2026-10-18T00:00:00Z'));
  const parsed = JSON.parse(backupJson);
  const backedUp = parsed.state.customers.find((c) => c.name === 'Seasonal Backup Test');
  assert.equal(backedUp.seasonalRatePKR, 500);
  assert.equal(backedUp.seasonalUntilMonth, '2027-03');
  assert.equal(backedUp.restorePackageRatePKR, 3000);

  // Merge onto a device whose copy of the customer has no triple yet.
  const localState = JSON.parse(JSON.stringify(state));
  const local = localState.customers.find((c) => c.name === 'Seasonal Backup Test');
  local.seasonalRatePKR = null;
  local.seasonalUntilMonth = null;
  local.restorePackageRatePKR = null;
  const preview = previewJsonBackupMerge(localState, backupJson);
  assert.equal(preview.canApply, true);
  const merged = preview.state.customers.find((c) => c.name === 'Seasonal Backup Test');
  assert.equal(merged.seasonalRatePKR, 500);
  assert.equal(merged.seasonalUntilMonth, '2027-03');
  assert.equal(merged.restorePackageRatePKR, 3000);
});

test('backup: a fresh-device restore adopts the triple with the customer', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Seasonal Restore Test', new Date('2026-10-01'), { ...TRIPLE });
  const backupJson = createJsonBackup(state, new Date('2026-10-18T00:00:00Z'));
  const preview = previewJsonBackupMerge(createInitialState(), backupJson);
  assert.equal(preview.canApply, true);
  const adopted = preview.state.customers.find((c) => c.name === 'Seasonal Restore Test');
  assert.equal(adopted.seasonalRatePKR, 500);
  assert.equal(adopted.seasonalUntilMonth, '2027-03');
  assert.equal(adopted.restorePackageRatePKR, 3000);
});

// ------------------------------------------------------------------- view

test('profile summary: the note shows only while the current month is inside the window', () => {
  const customer = baseCustomer();
  const active = seasonalBillingSummary(customer, '2026-11');
  assert.equal(active.hasSeasonal, true);
  assert.equal(active.active, true);
  assert.match(active.detail, /PKR 500/);
  assert.match(active.detail, /Mar 2027/);
  assert.match(active.detail, /PKR 3,000/);
  const lastMonth = seasonalBillingSummary(customer, '2027-03');
  assert.equal(lastMonth.active, true);
  const expired = seasonalBillingSummary(customer, '2027-04');
  assert.equal(expired.hasSeasonal, true);
  assert.equal(expired.active, false);
  assert.equal(expired.detail, '');
  const none = seasonalBillingSummary(baseCustomer({ seasonalRatePKR: null, seasonalUntilMonth: null, restorePackageRatePKR: null }), '2026-11');
  assert.equal(none.hasSeasonal, false);
  assert.equal(none.detail, '');
});

// ------------------------------------------------------------------ i18n

test('i18n: every seasonal key exists in both dictionaries with matching placeholders', () => {
  const keys = [
    'prof_form_seasonal_rate', 'prof_form_seasonal_rate_note',
    'prof_form_seasonal_until', 'prof_form_seasonal_until_note',
    'prof_form_seasonal_restore', 'prof_form_seasonal_restore_note',
    'prof_field_seasonal', 'prof_seasonal_active'
  ];
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
  }
  for (const placeholder of ['{rate}', '{month}', '{restore}']) {
    assert.ok(TRANSLATIONS.en.prof_seasonal_active.includes(placeholder), `en prof_seasonal_active missing ${placeholder}`);
    assert.ok(TRANSLATIONS.ur.prof_seasonal_active.includes(placeholder), `ur prof_seasonal_active missing ${placeholder}`);
  }
  // The form fields in index.html reference the new keys, and app.js
  // wires the three inputs (populate + save).
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['seasonalRateInput', 'seasonalUntilMonthInput', 'seasonalRestoreRateInput']) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing ${id}`);
  }
  for (const key of ['prof_form_seasonal_rate', 'prof_form_seasonal_until', 'prof_form_seasonal_restore']) {
    assert.ok(html.includes(`data-i18n="${key}"`), `index.html missing data-i18n ${key}`);
  }
});

// ----------------------------------------------------------------- wiring

test('wiring: seasonal-downgrade is an import-graph module, not a new build entry', () => {
  assert.ok(!ENTRY_FILES.includes('seasonal-downgrade.js'));
  const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
  const cycle = readFileSync(new URL('../billing-cycle.js', import.meta.url), 'utf8');
  assert.match(core, /from '\.\/seasonal-downgrade\.js'/);
  assert.match(cycle, /from '\.\/seasonal-downgrade\.js'/);
  assert.match(cycle, /seasonalPriceFor\(customer, month\)/);
});
