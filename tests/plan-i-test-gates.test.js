// Plan I — Testing infrastructure and quality gates (Plan A-Z programme).
// Harness self-tests: the shared fixtures in tests/test-fixtures.js
// and the pure helpers in scripts/test-gate.mjs, pinned here so a
// later plan cannot silently break the gate it is supposed to land
// on. These tests use the fixtures themselves, which is the point:
// if a fixture builder drifts, the tests that depend on it fail here
// first, in one place, instead of across dozens of plan tests.
//
// No product behaviour is asserted here. Counts are reported in the
// PR body, never copied from the plan file's estimate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  fixtureCustomer, fixtureBill, fixturePayment, fixtureState,
  inMemoryStorage, cloneFixture,
} from './test-fixtures.js';
import {
  parseTestSummary, classifyFailures, failingTestFiles,
  isKnownBuildGap, KNOWN_BUILD_GAP_FILES, gateModes,
} from '../scripts/test-gate.mjs';
import { createInitialState, persistState, readState, STORAGE_KEY } from '../core.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

// ---- fixtureCustomer: defaults -------------------------------------

const CUSTOMER_DEFAULTS = [
  ['id', 'fixture-customer-001'],
  ['customerNumber', 1],
  ['name', 'Fixture Customer'],
  ['mohalla', 'BARRIAN'],
  ['phone', '03000000001'],
  ['serviceStatus', 'active'],
  ['monthlySellingAmount', 2000],
  ['archived', false],
];
for (const [field, expected] of CUSTOMER_DEFAULTS) {
  test(`Plan I fixtureCustomer default ${field} is ${expected}`, () => {
    assert.equal(fixtureCustomer()[field], expected);
  });
}

// ---- fixtureCustomer: overrides and freshness ----------------------

test('Plan I fixtureCustomer override replaces a top-level field', () => {
  assert.equal(fixtureCustomer({ name: 'Override Name' }).name, 'Override Name');
  assert.equal(fixtureCustomer({ name: 'Override Name' }).customerNumber, 1);
});

test('Plan I fixtureCustomer override can archive a fixture', () => {
  assert.equal(fixtureCustomer({ archived: true }).archived, true);
});

test('Plan I fixtureCustomer bills are fresh per call', () => {
  const a = fixtureCustomer();
  a.bills.push(fixtureBill());
  assert.equal(fixtureCustomer().bills.length, 0);
});

test('Plan I fixtureCustomer incidents are fresh per call', () => {
  const a = fixtureCustomer();
  a.incidents.push({ id: 'x' });
  assert.equal(fixtureCustomer().incidents.length, 0);
});

test('Plan I fixtureCustomer serviceStatusHistory is fresh per call', () => {
  const a = fixtureCustomer();
  a.serviceStatusHistory.push({ status: 'active' });
  assert.equal(fixtureCustomer().serviceStatusHistory.length, 0);
});

test('Plan I fixtureCustomer bill overrides are copied, not aliased', () => {
  const bills = [fixtureBill()];
  const customer = fixtureCustomer({ bills });
  customer.bills[0].dueAmount = 999;
  assert.equal(bills[0].dueAmount, 2000);
});

// ---- fixtureBill ----------------------------------------------------

const BILL_DEFAULTS = [
  ['month', '2026-10'],
  ['dueAmount', 2000],
  ['status', 'pending'],
];
for (const [field, expected] of BILL_DEFAULTS) {
  test(`Plan I fixtureBill default ${field} is ${expected}`, () => {
    assert.equal(fixtureBill()[field], expected);
  });
}

test('Plan I fixtureBill starts with no payments', () => {
  assert.deepEqual(fixtureBill().payments, []);
});

test('Plan I fixtureBill override replaces month and due amount', () => {
  const bill = fixtureBill({ month: '2026-11', dueAmount: 3000 });
  assert.equal(bill.month, '2026-11');
  assert.equal(bill.dueAmount, 3000);
});

test('Plan I fixtureBill override can mark a bill paid', () => {
  assert.equal(fixtureBill({ status: 'paid' }).status, 'paid');
});

test('Plan I fixtureBill payment overrides are copied, not aliased', () => {
  const payments = [fixturePayment()];
  const bill = fixtureBill({ payments });
  bill.payments[0].amount = 999;
  assert.equal(payments[0].amount, 2000);
});

test('Plan I fixtureBill payments are fresh per call', () => {
  const a = fixtureBill();
  a.payments.push(fixturePayment());
  assert.equal(fixtureBill().payments.length, 0);
});

// ---- fixturePayment --------------------------------------------------

const PAYMENT_DEFAULTS = [
  ['id', 'fixture-payment-001'],
  ['date', '2026-10-05'],
  ['amount', 2000],
  ['method', 'Cash'],
];
for (const [field, expected] of PAYMENT_DEFAULTS) {
  test(`Plan I fixturePayment default ${field} is ${expected}`, () => {
    assert.equal(fixturePayment()[field], expected);
  });
}

test('Plan I fixturePayment override replaces method and amount', () => {
  const payment = fixturePayment({ method: 'JazzCash', amount: 1500 });
  assert.equal(payment.method, 'JazzCash');
  assert.equal(payment.amount, 1500);
});

// ---- fixtureState ----------------------------------------------------

test('Plan I fixtureState empty state matches the app initial state', () => {
  const state = fixtureState();
  assert.equal(state.version, createInitialState([]).version);
  assert.deepEqual(state.customers, []);
});

test('Plan I fixtureState empty state starts numbering at 1', () => {
  assert.equal(fixtureState().nextCustomerNumber, 1);
});

test('Plan I fixtureState wraps partial customers into full records', () => {
  const state = fixtureState([{ name: 'Partial Customer' }]);
  assert.equal(state.customers.length, 1);
  assert.equal(state.customers[0].name, 'Partial Customer');
  assert.equal(state.customers[0].mohalla, 'BARRIAN');
  assert.deepEqual(state.customers[0].bills, []);
});

test('Plan I fixtureState numbers follow the highest customer number', () => {
  const state = fixtureState([
    { customerNumber: 3, name: 'Third' },
    { customerNumber: 7, name: 'Seventh' },
  ]);
  assert.equal(state.nextCustomerNumber, 8);
});

test('Plan I fixtureState numbers follow sparse numbers, not the count', () => {
  const state = fixtureState([{ customerNumber: 9, name: 'Ninth' }]);
  assert.equal(state.nextCustomerNumber, 10);
});

test('Plan I fixtureState calls are independent', () => {
  const a = fixtureState([{ name: 'First' }]);
  a.customers[0].bills.push(fixtureBill());
  assert.equal(fixtureState([{ name: 'First' }]).customers[0].bills.length, 0);
});

test('Plan I fixtureState override customers replace the list', () => {
  const state = fixtureState([{ name: 'Ignored' }], {
    customers: [{ name: 'Override List' }],
  });
  assert.deepEqual(state.customers.map((c) => c.name), ['Override List']);
});

test('Plan I fixtureState override nextCustomerNumber is honoured', () => {
  assert.equal(fixtureState([], { nextCustomerNumber: 42 }).nextCustomerNumber, 42);
});

test('Plan I fixtureState keeps other state fields from overrides', () => {
  const state = fixtureState([], { expenses: [{ id: 'e1' }] });
  assert.deepEqual(state.expenses, [{ id: 'e1' }]);
});

// ---- inMemoryStorage -------------------------------------------------

test('Plan I inMemoryStorage missing keys read back as null', () => {
  assert.equal(inMemoryStorage().getItem('nope'), null);
});

test('Plan I inMemoryStorage round-trips a value', () => {
  const storage = inMemoryStorage();
  storage.setItem('k', 'v');
  assert.equal(storage.getItem('k'), 'v');
});

test('Plan I inMemoryStorage overwrite replaces the old value', () => {
  const storage = inMemoryStorage();
  storage.setItem('k', 'old');
  storage.setItem('k', 'new');
  assert.equal(storage.getItem('k'), 'new');
});

test('Plan I inMemoryStorage removeItem drops the key', () => {
  const storage = inMemoryStorage({ k: 'v' });
  storage.removeItem('k');
  assert.equal(storage.getItem('k'), null);
});

test('Plan I inMemoryStorage clear drops every key', () => {
  const storage = inMemoryStorage({ a: '1', b: '2' });
  storage.clear();
  assert.equal(storage.getItem('a'), null);
  assert.equal(storage.getItem('b'), null);
});

test('Plan I inMemoryStorage instances are independent', () => {
  const a = inMemoryStorage();
  const b = inMemoryStorage();
  a.setItem('k', 'v');
  assert.equal(b.getItem('k'), null);
});

test('Plan I inMemoryStorage seed pre-fills keys', () => {
  assert.equal(inMemoryStorage({ seeded: 'yes' }).getItem('seeded'), 'yes');
});

test('Plan I inMemoryStorage stores values as strings', () => {
  const storage = inMemoryStorage();
  storage.setItem('n', 42);
  assert.equal(storage.getItem('n'), '42');
});

// ---- cloneFixture ------------------------------------------------------

test('Plan I cloneFixture deep-copies nested values', () => {
  const original = { bills: [{ payments: [{ amount: 100 }] }] };
  const copy = cloneFixture(original);
  copy.bills[0].payments[0].amount = 999;
  assert.equal(original.bills[0].payments[0].amount, 100);
});

test('Plan I cloneFixture copies arrays independently', () => {
  const original = [1, [2, 3]];
  const copy = cloneFixture(original);
  copy[1].push(4);
  assert.deepEqual(original, [1, [2, 3]]);
});

test('Plan I cloneFixture preserves plain values', () => {
  assert.deepEqual(cloneFixture({ a: 1, b: 'x', c: true, d: null }), { a: 1, b: 'x', c: true, d: null });
});

// ---- parseTestSummary --------------------------------------------------

test('Plan I parseTestSummary reads a full runner summary', () => {
  const summary = parseTestSummary('ℹ tests 5290\nℹ pass 5285\nℹ fail 5\n');
  assert.deepEqual(summary, { tests: 5290, pass: 5285, fail: 5 });
});

test('Plan I parseTestSummary ignores surrounding output', () => {
  const summary = parseTestSummary('✔ some test\nℹ tests 10\nℹ pass 10\nℹ fail 0\nℹ duration_ms 1\n');
  assert.deepEqual(summary, { tests: 10, pass: 10, fail: 0 });
});

test('Plan I parseTestSummary missing fail line is null, not zero', () => {
  const summary = parseTestSummary('ℹ tests 10\nℹ pass 10\n');
  assert.equal(summary.fail, null);
  assert.equal(summary.pass, 10);
});

test('Plan I parseTestSummary with no summary at all is all nulls', () => {
  assert.deepEqual(parseTestSummary('crashed before finishing'), { tests: null, pass: null, fail: null });
});

test('Plan I parseTestSummary reads lines in any order', () => {
  const summary = parseTestSummary('ℹ fail 2\nℹ tests 9\nℹ pass 7\n');
  assert.deepEqual(summary, { tests: 9, pass: 7, fail: 2 });
});

// ---- failingTestFiles / classifyFailures -------------------------------

test('Plan I failingTestFiles extracts failing file lines', () => {
  const output = '✔ ok\n✖ failing tests:\n\ntest at tests/build-output.test.js:44:1\n✖ some test\ntest at tests/perf-budget-219.test.js:12:3\ntest at tests/build-output.test.js:97:1\n';
  assert.deepEqual(failingTestFiles(output), ['tests/build-output.test.js', 'tests/perf-budget-219.test.js']);
});

test('Plan I failingTestFiles ignores lines that are not failing files', () => {
  assert.deepEqual(failingTestFiles('✖ failing something else\n✔ passing tests/foo.test.js\n'), []);
});

test('Plan I failingTestFiles on clean output is empty', () => {
  assert.deepEqual(failingTestFiles('ℹ pass 10\nℹ fail 0\n'), []);
});

for (const file of KNOWN_BUILD_GAP_FILES) {
  test(`Plan I ${file} is a known build gap`, () => {
    assert.equal(isKnownBuildGap(file), true);
    assert.equal(isKnownBuildGap(`tests/${file}`), true);
  });
}

test('Plan I an ordinary test file is not a known build gap', () => {
  assert.equal(isKnownBuildGap('tests/core.test.js'), false);
  assert.equal(isKnownBuildGap('tests/plan-i-test-gates.test.js'), false);
});

test('Plan I classifyFailures splits known gaps from other failures', () => {
  const classified = classifyFailures([
    'tests/build-output.test.js',
    'tests/core.test.js',
    'tests/manifest-verifier.test.js',
  ]);
  assert.deepEqual(classified.knownBuildGap, ['tests/build-output.test.js', 'tests/manifest-verifier.test.js']);
  assert.deepEqual(classified.other, ['tests/core.test.js']);
});

test('Plan I classifyFailures on no failures is empty on both sides', () => {
  assert.deepEqual(classifyFailures([]), { knownBuildGap: [], other: [] });
});

// ---- gate modes ----------------------------------------------------------

test('Plan I gate modes cover unit, build, e2e and all', () => {
  assert.deepEqual(gateModes(), ['unit', 'build', 'e2e', 'all']);
});

test('Plan I gate modes list has exactly four entries', () => {
  assert.equal(gateModes().length, 4);
});

// ---- docs, scripts, CI and e2e contracts -----------------------------------

test('Plan I docs/testing.md documents the unit gate command', () => {
  assert.ok(read('docs/testing.md').includes('node scripts/test-gate.mjs unit'));
});

test('Plan I docs/testing.md documents the bare-VM fallback', () => {
  const doc = read('docs/testing.md');
  assert.ok(doc.includes('bare-VM'));
  assert.ok(doc.includes('SKIPPED'));
});

test('Plan I docs/testing.md defines the per-plan report format', () => {
  const doc = read('docs/testing.md');
  assert.ok(doc.includes('Per-plan test-count report format'));
  assert.ok(doc.includes('New tests added:'));
  assert.ok(doc.includes('Full unit suite:'));
});

test('Plan I docs/testing.md never calls a skipped gate a pass', () => {
  assert.ok(read('docs/testing.md').includes('a skipped gate is never a pass'));
});

test('Plan I package.json exposes the gate as npm run test:gate', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:gate'], 'node scripts/test-gate.mjs unit');
});

test('Plan I package.json keeps the original test script untouched', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.test, 'node --test');
  assert.equal(pkg.scripts['test:e2e'], 'node build.mjs && playwright test');
});

test('Plan I CI runs the unit gate', () => {
  assert.ok(read('.github/workflows/ci.yml').includes('node scripts/test-gate.mjs unit'));
});

test('Plan I CI runs the e2e gate', () => {
  assert.ok(read('.github/workflows/ci.yml').includes('node scripts/test-gate.mjs e2e'));
});

test('Plan I CI still installs dependencies before any gate', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.ok(ci.indexOf('npm ci') < ci.indexOf('test-gate'));
});

test('Plan I test fixtures are not in the build entry list', () => {
  const build = read('build.mjs');
  assert.ok(!build.includes('test-fixtures.js'));
  assert.ok(!build.includes('test-gate.mjs'));
});

test('Plan I gate script is not in the build entry list', () => {
  assert.ok(!read('build.mjs').includes('scripts/test-gate.mjs'));
});

test('Plan I e2e suite exists and is non-trivial', () => {
  const specs = readdirSync(join(root, 'tests', 'e2e')).filter((f) => f.endsWith('.spec.mjs'));
  assert.ok(specs.length >= 100, `expected >=100 e2e specs, found ${specs.length}`);
});

test('Plan I playwright config points at the e2e directory on port 4173', () => {
  const config = read('playwright.config.mjs');
  assert.ok(config.includes("testDir: './tests/e2e'"));
  assert.ok(config.includes('4173'));
});

test('Plan I manifest checker still ships with the test tooling', () => {
  assert.ok(existsSync(join(root, 'tests', 'qa-manifest-check.js')));
});

// ---- fixtures work with the real engine -----------------------------------

test('Plan I fixture state round-trips through persist and read', () => {
  const storage = inMemoryStorage();
  const state = fixtureState([{ name: 'Round Trip', customerNumber: 5 }]);
  persistState(state, storage, STORAGE_KEY);
  const restored = readState(storage, STORAGE_KEY);
  assert.equal(restored.customers[0].name, 'Round Trip');
  assert.equal(restored.nextCustomerNumber, 6);
});

test('Plan I fixture customers are synthetic, never real-looking records', () => {
  assert.ok(fixtureCustomer().name.includes('Fixture'));
  assert.ok(!fixtureCustomer().name.includes('Shahdara'));
});
