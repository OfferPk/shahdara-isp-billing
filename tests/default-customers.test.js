// Owner default customer roster (ALEX, 2026-10-29): the owner's written
// customer list (93 entries, 11 mohallas, names verbatim) imports BY
// DEFAULT into the app as blank records — name + mohalla only, no
// package / mobile / balance / bills invented; packages and numbers are
// added by the admin later. FREE amendment (same day): AQIB 1, AQIB 999
// and FREE ID LINE MAN (BARRIAN) are free connections — flagged
// isFreeConnection, never billed, never in defaulter/dues outputs, but
// still listed as customers. Synthetic fixtures only beyond the roster
// data itself (which is the owner's own list, pinned verbatim below).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CUSTOMER_ROSTER,
  DEFAULT_ROSTER_VERSION,
  planDefaultCustomerAdditions,
  applyDefaultCustomerRoster
} from '../default-customers.js';
import {
  createInitialState,
  generateMonthlyBillsThroughCurrentMonth,
  persistState,
  readState
} from '../core.js';
import { applyBillingCycle, planCustomerCycleLine } from '../billing-cycle.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';
import { getEscalationStage, isLockDueCustomer } from '../reminder-queue.js';

const REF_DATE = new Date('2026-10-29T12:00:00Z');
const blankState = () => createInitialState([]);
const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
};
const priced = (customer, amount = 3000) => ({
  ...customer,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount }]
});
const unpaidBill = (month) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending',
  payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z', amountHistory: []
});

// ---------- Roster data pins ----------

test('roster: exactly 93 entries with the owner per-mohalla counts', () => {
  assert.equal(DEFAULT_CUSTOMER_ROSTER.length, 93);
  const counts = {};
  for (const item of DEFAULT_CUSTOMER_ROSTER) counts[item.mohalla] = (counts[item.mohalla] ?? 0) + 1;
  assert.deepEqual(counts, {
    CHARYAA: 6, GANGALL: 16, BARRIAN: 14, CHAMYAAA: 7, PALALIYAA: 10,
    THALII: 8, NAKAR: 10, BANII: 4, JABBIYAA: 8, SODAA: 6, 'END POINT': 4
  });
});

test('roster: NAZEER appears only once (owner correction) and names are verbatim', () => {
  const nazeers = DEFAULT_CUSTOMER_ROSTER.filter((item) => item.name === 'NAZEER');
  assert.equal(nazeers.length, 1);
  assert.equal(nazeers[0].mohalla, 'CHARYAA');
  const names = new Set(DEFAULT_CUSTOMER_ROSTER.map((item) => item.name));
  for (const verbatim of ['Afzal Shah darbar', 'qari mubashir', 'sheraaz Shah', 'ch sanwall',
    'KASHIF ABBASI 100Gb', 'ORIOM SCHOOL', 'RAJA USMAN URF SAMI', 'MUFTI SADAQAT QUBAA MASJID',
    'HAMZA URF BABLU', 'RAJA TAIMOOR CHANDAAAL', 'SAWAAAR SHAH']) {
    assert.ok(names.has(verbatim), `missing verbatim name: ${verbatim}`);
  }
});

test('roster: exactly the 3 named BARRIAN entries carry the free flag', () => {
  const free = DEFAULT_CUSTOMER_ROSTER.filter((item) => item.free === true);
  assert.deepEqual(free.map((item) => item.name).sort(), ['AQIB 1', 'AQIB 999', 'FREE ID LINE MAN']);
  assert.ok(free.every((item) => item.mohalla === 'BARRIAN'));
});

// ---------- Planner pins ----------

test('planner: empty store adds all 93 in roster order', () => {
  const additions = planDefaultCustomerAdditions([]);
  assert.equal(additions.length, 93);
  assert.deepEqual(additions[0], { name: 'TEHMINA KHALLA', mohalla: 'CHARYAA', free: false });
  assert.deepEqual(additions.at(-1), { name: 'RAJA ASAD FARM HOUSE', mohalla: 'END POINT', free: false });
  assert.equal(additions.filter((item) => item.free).length, 3);
});

test('planner: when all 93 already exist it adds 0', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE);
  assert.deepEqual(planDefaultCustomerAdditions(applied.customers), []);
});

test('planner: same name in a different mohalla does not satisfy this mohalla', () => {
  const existing = [{ name: 'RAJA AQEEL', mohalla: 'PALALIYAA', archived: false }];
  const additions = planDefaultCustomerAdditions(existing);
  assert.equal(additions.length, 92);
  assert.ok(additions.some((item) => item.name === 'RAJA AQEEL' && item.mohalla === 'GANGALL'));
  assert.ok(!additions.some((item) => item.name === 'RAJA AQEEL' && item.mohalla === 'PALALIYAA'));
});

test('planner: a roster name missing entirely is added exactly once', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE);
  const withoutNazeer = applied.customers.filter((customer) => customer.name !== 'NAZEER');
  assert.deepEqual(planDefaultCustomerAdditions(withoutNazeer), [
    { name: 'NAZEER', mohalla: 'CHARYAA', free: false }
  ]);
});

test('planner: archived records do not count, and matching is case/space-insensitive', () => {
  const archivedOnly = [{ name: 'NAZEER', mohalla: 'CHARYAA', archived: true }];
  assert.equal(planDefaultCustomerAdditions(archivedOnly).length, 93);
  const messy = [{ name: '  nazeer ', mohalla: 'Mohalla Charyaa', archived: false }];
  const additions = planDefaultCustomerAdditions(messy);
  assert.equal(additions.length, 92);
  assert.ok(!additions.some((item) => item.name === 'NAZEER'));
});

// ---------- Import / apply pins ----------

test('import: blank store gains 93 blank customers through the real creation path', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE);
  assert.equal(applied.customers.length, 93);
  assert.deepEqual(
    applied.customers.map((customer) => customer.name).sort(),
    DEFAULT_CUSTOMER_ROSTER.map((item) => item.name).sort()
  );
  const numbers = new Set(applied.customers.map((customer) => customer.customerNumber));
  assert.equal(numbers.size, 93);
  assert.equal(applied.nextCustomerNumber, 94);
  for (const customer of applied.customers) {
    // Blank roster entry: no package, no mobile, no bills, no balance —
    // exactly the app's own addCustomer defaults, nothing invented.
    assert.equal(customer.phone, '');
    assert.equal(customer.packageSpeed, '');
    assert.equal(customer.monthlySellingAmount, null);
    assert.deepEqual(customer.monthlyPriceSchedule, []);
    assert.deepEqual(customer.bills, []);
    assert.equal(customer.serviceStatus, 'not-set');
    assert.equal(customer.archived, false);
    assert.ok(customer.mohalla, 'mohalla recorded');
  }
  const byName = new Map(applied.customers.map((customer) => [`${customer.name}|${customer.mohalla}`, customer]));
  assert.equal(byName.get('Tahir MOLVI|BANII').mohalla, 'BANII');
  assert.equal(byName.get('AKHTAR WAPDA HOUSE|END POINT').mohalla, 'END POINT');
});

test('import: the 3 free entries land with the persistent isFreeConnection field', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE);
  const free = applied.customers.filter((customer) => customer.isFreeConnection === true);
  assert.deepEqual(free.map((customer) => customer.name).sort(), ['AQIB 1', 'AQIB 999', 'FREE ID LINE MAN']);
  assert.ok(free.every((customer) => customer.mohalla === 'BARRIAN'));
  assert.ok(applied.customers.every((customer) => customer.isFreeConnection === true || customer.isFreeConnection === false));
});

test('import: marker is stamped and a second run is a no-op (idempotent)', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE);
  const marker = applied.settings.defaultCustomersImport;
  assert.equal(marker.rosterVersion, DEFAULT_ROSTER_VERSION);
  assert.equal(marker.addedCount, 93);
  const again = applyDefaultCustomerRoster(applied, REF_DATE);
  assert.equal(again, applied);
  assert.equal(again.customers.length, 93);
});

test('import: pre-existing customers are never modified and only the shortfall is added', () => {
  const existing = {
    id: 'hand-1', customerNumber: 7, name: 'RAJA BILAL', mohalla: 'GANGALL', archived: false, bills: []
  };
  const state = { ...blankState(), customers: [existing], nextCustomerNumber: 8 };
  const applied = applyDefaultCustomerRoster(state, REF_DATE);
  assert.equal(applied.customers.length, 93);
  assert.equal(applied.customers[0], existing);
  assert.equal(applied.settings.defaultCustomersImport.addedCount, 92);
});

test('import: marker and free flags survive a persist/readState round-trip', () => {
  const storage = memoryStorage();
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE);
  persistState(applied, storage);
  const loaded = readState(storage);
  assert.equal(loaded.customers.length, 93);
  assert.equal(loaded.customers.find((customer) => customer.name === 'AQIB 999').isFreeConnection, true);
  assert.equal(loaded.customers.find((customer) => customer.name === 'NAZEER').isFreeConnection, false);
  assert.equal(loaded.settings.defaultCustomersImport.rosterVersion, DEFAULT_ROSTER_VERSION);
  assert.equal(applyDefaultCustomerRoster(loaded, REF_DATE), loaded);
});

// ---------- FREE: no bill, no dues, ever ----------

test('free: load-time bill generation never bills a free customer, even after a package is set', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE);
  const withPrices = {
    ...applied,
    customers: applied.customers.map((customer) =>
      customer.name === 'AQIB 1' || customer.name === 'RAJA WAQAR' ? priced(customer) : customer)
  };
  const generated = generateMonthlyBillsThroughCurrentMonth(withPrices, new Date('2026-10-15T12:00:00Z'));
  const free = generated.customers.find((customer) => customer.name === 'AQIB 1');
  const normal = generated.customers.find((customer) => customer.name === 'RAJA WAQAR');
  assert.equal(free.bills.length, 0);
  assert.ok(normal.bills.length > 0);
});

test('free: the SISP-2 billing cycle skips a free customer and bills a normal one', () => {
  const freeFixture = {
    id: 'free-1', customerNumber: 1, name: 'AQIB 1', archived: false, isFreeConnection: true,
    billingStartMonth: null, monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }], bills: []
  };
  const normalFixture = {
    id: 'norm-1', customerNumber: 2, name: 'RAJA WAQAR', archived: false,
    billingStartMonth: null, monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }], bills: []
  };
  const line = planCustomerCycleLine(freeFixture, '2026-10');
  assert.equal(line.skipped, true);
  assert.equal(line.reason, 'free-connection');
  const { state: next } = applyBillingCycle({ customers: [freeFixture, normalFixture] }, '2026-10', new Date('2026-10-01T00:00:00Z'));
  assert.equal(next.customers[0].bills.length, 0);
  assert.equal(next.customers[1].bills.filter((bill) => bill.month === '2026-10').length, 1);
});

test('free: a free customer never appears in top-defaulters or escalation outputs', () => {
  const freeFixture = {
    id: 'free-1', customerNumber: 1, name: 'AQIB 1', mohalla: 'BARRIAN', archived: false,
    isFreeConnection: true, bills: [unpaidBill('2026-09')]
  };
  const normalFixture = {
    id: 'norm-1', customerNumber: 2, name: 'RAJA WAQAR', mohalla: 'BARRIAN', archived: false,
    bills: [unpaidBill('2026-09')]
  };
  const result = calculateTopDefaulters({ customers: [freeFixture, normalFixture] }, { referenceDate: new Date('2026-10-20T12:00:00Z') });
  assert.equal(result.metrics.totalDefaultersCount, 1);
  assert.equal(result.metrics.totalReceivablesDues, 3000);
  assert.ok(!JSON.stringify(result.accounts).includes('AQIB 1'));
  // Grace / final-notice / lock-due escalation excludes free connections
  // even if a stray balance were ever presented for one.
  assert.equal(getEscalationStage(freeFixture, 3000, '2026-10-20'), null);
  assert.equal(isLockDueCustomer(freeFixture, 3000, '2026-10-20'), false);
  const normalStage = getEscalationStage(normalFixture, 3000, '2026-10-20');
  assert.equal(normalStage.stage, 'lock-due');
});
