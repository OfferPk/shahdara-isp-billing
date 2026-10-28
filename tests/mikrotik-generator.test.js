// SISP-13: MikroTik RouterOS PPPoE Script and Defaulter Walled-Garden
// Command Generator. Pure-function tests on synthetic data only.
// Spec test criterion (verbatim): generated RouterOS script contains valid
// syntax matching the customer's exact username, package speed limit, and
// customerId comment, and excludes customers with a valid future promiseDate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeRouterOs,
  routerOsQuoted,
  derivePppoeUsername,
  resolvePackageSpeedMbps,
  formatRateLimitMbps,
  hasFutureWaada,
  buildCustomerMikrotikSnippet,
  buildDefaulterLockScript,
  buildDefaulterRestoreScript,
  DEFAULTER_PROFILE,
  ACTIVE_PROFILE,
  DEFAULTER_RATE_LIMIT,
  PASSWORD_PLACEHOLDER
} from '../mikrotik-generator.js';
import { addCustomer, updateCustomerProfile } from '../core.js';

const fullCustomer = (overrides = {}) => ({
  id: 'cust-abc',
  customerNumber: 42,
  name: 'RAJA FAISAL',
  packageSpeed: '5Mbps / 150GB',
  pppoeUsername: 'faisal42',
  pppoePassword: 's3cret!',
  staticIp: '192.168.1.50',
  macAddress: 'AA:BB:CC:DD:EE:FF',
  promiseDate: null,
  ...overrides
});

const emptyState = () => ({ customers: [], nextCustomerNumber: 1 });

test('escapeRouterOs quotes backslashes and flattens newlines', () => {
  assert.equal(escapeRouterOs('a"b\\c'), 'a\\"b\\\\c');
  assert.equal(escapeRouterOs('line1\nline2\r\nline3'), 'line1 line2 line3');
  assert.equal(routerOsQuoted('a"b'), '"a\\"b"');
});

test('derivePppoeUsername prefers stored, else cust-<number>, else cust-unknown', () => {
  assert.equal(derivePppoeUsername(fullCustomer()), 'faisal42');
  assert.equal(derivePppoeUsername({ customerNumber: 7 }), 'cust-7');
  assert.equal(derivePppoeUsername({}), 'cust-unknown');
});

test('resolvePackageSpeedMbps: catalog label, free-text parse, unknown', () => {
  assert.equal(resolvePackageSpeedMbps({ packageSpeed: '3Mbps / 100GB' }), 3);
  assert.equal(resolvePackageSpeedMbps({ packageSpeed: '15Mbps Unlimited' }), 15);
  assert.equal(resolvePackageSpeedMbps({ packageSpeed: '10 Mbps' }), 10);
  assert.equal(resolvePackageSpeedMbps({ packageSpeed: 'Standard' }), null);
  assert.equal(resolvePackageSpeedMbps({ packageSpeed: '' }), null);
  assert.equal(resolvePackageSpeedMbps({}), null);
  assert.equal(formatRateLimitMbps(5), '5M');
  assert.equal(formatRateLimitMbps(2.5), '2.5M');
  assert.equal(formatRateLimitMbps(null), null);
});

test('spec criterion: snippet has exact username, speed limit, customerId comment', () => {
  const script = buildCustomerMikrotikSnippet(fullCustomer());
  assert.match(script, /\/ppp secret add name="faisal42" password="s3cret!" service=pppoe profile=default/);
  assert.match(script, /\/queue simple add name="q-faisal42" target=192\.168\.1\.50\/32 max-limit=5M\/5M/);
  assert.match(script, /comment="customerId: cust-abc RAJA FAISAL #42"/);
  assert.match(script, /\/ip arp add address=192\.168\.1\.50 mac-address=AA:BB:CC:DD:EE:FF/);
});

test('snippet escapes quotes and backslashes in names and usernames', () => {
  const script = buildCustomerMikrotikSnippet(fullCustomer({
    name: 'ALI "THE \\ BOSS"',
    pppoeUsername: 'ali"x'
  }));
  assert.match(script, /name="ali\\"x"/);
  // The quoted comment field carries the escaped name; the plain header
  // comment may show the readable name (quotes are harmless in comments).
  assert.match(script, /ALI \\"THE \\\\ BOSS\\"/);
});

test('snippet with no stored router fields uses derived username and CHANGE-ME, no ARP line', () => {
  const script = buildCustomerMikrotikSnippet({
    id: 'cust-9', customerNumber: 9, name: 'NO ROUTER', packageSpeed: '3Mbps / 100GB'
  });
  assert.match(script, /name="cust-9" password="CHANGE-ME"/);
  assert.match(script, /TODO: no PPPoE password/);
  assert.match(script, /TODO: no static IP stored/);
  assert.ok(!script.includes('/ip arp add'));
  // No live queue command — only the TODO example line mentions the rate.
  assert.ok(!script.includes('\n/queue simple add'));
});

test('snippet with unrecognized speed keeps the secret, comments out the queue', () => {
  const script = buildCustomerMikrotikSnippet(fullCustomer({ packageSpeed: 'Super Fast Plan', staticIp: '' }));
  assert.match(script, /\/ppp secret add/);
  assert.match(script, /TODO: package speed not recognized/);
  assert.ok(!script.includes('/queue simple add'));
});

test('snippet with only one of static IP / MAC omits ARP with a note', () => {
  const script = buildCustomerMikrotikSnippet(fullCustomer({ macAddress: '' }));
  assert.ok(!script.includes('/ip arp add'));
  assert.match(script, /ARP\/MAC binding omitted/);
});

test('hasFutureWaada: future only — today and past do not exclude', () => {
  assert.equal(hasFutureWaada({ promiseDate: '2026-11-15' }, '2026-10-28'), true);
  assert.equal(hasFutureWaada({ promiseDate: '2026-10-28' }, '2026-10-28'), false);
  assert.equal(hasFutureWaada({ promiseDate: '2026-10-01' }, '2026-10-28'), false);
  assert.equal(hasFutureWaada({ promiseDate: 'not-a-date' }, '2026-10-28'), false);
  assert.equal(hasFutureWaada({}, '2026-10-28'), false);
});

test('spec criterion: lock script excludes future-Waada customers, locks the rest at 128k', () => {
  const future = fullCustomer({ id: 'c-future', customerNumber: 1, name: 'FUTURE WAADA', promiseDate: '2026-11-15' });
  const past = fullCustomer({ id: 'c-past', customerNumber: 2, name: 'PAST WAADA', promiseDate: '2026-10-01' });
  const plain = fullCustomer({ id: 'c-plain', customerNumber: 3, name: 'NO WAADA', promiseDate: null });
  const { script, locked, skippedWaada } = buildDefaulterLockScript([future, past, plain], { todayStr: '2026-10-28' });
  assert.equal(locked.length, 2);
  assert.equal(skippedWaada.length, 1);
  assert.equal(skippedWaada[0].id, 'c-future');
  assert.ok(!script.includes('# Lock: FUTURE WAADA'));
  assert.match(script, /Excluded \(active future Waada\): FUTURE WAADA \(customerId: c-future FUTURE WAADA #1\)/);
  assert.match(script, new RegExp(`profile=${DEFAULTER_PROFILE}`));
  assert.match(script, new RegExp(`max-limit=${DEFAULTER_RATE_LIMIT.replace('/', '\\/')}`));
  assert.match(script, /Excluded \(active future Waada\)/);
});

test('lock script with everyone on future Waada locks nobody', () => {
  const { script, locked } = buildDefaulterLockScript(
    [fullCustomer({ promiseDate: '2027-01-01' })],
    { todayStr: '2026-10-28' }
  );
  assert.equal(locked.length, 0);
  assert.match(script, /No customers to lock/);
});

test('restore script returns profile default and original package speed', () => {
  const { script, restored } = buildDefaulterRestoreScript([fullCustomer()]);
  assert.equal(restored.length, 1);
  assert.match(script, new RegExp(`profile=${ACTIVE_PROFILE}`));
  assert.match(script, /max-limit=5M\/5M/);
  assert.ok(!script.includes(DEFAULTER_PROFILE));
  assert.ok(!script.includes('128k'));
});

test('restore script with unrecognized speed keeps profile switch, TODOs the queue', () => {
  const { script } = buildDefaulterRestoreScript([fullCustomer({ packageSpeed: 'Mystery Plan' })]);
  assert.match(script, new RegExp(`profile=${ACTIVE_PROFILE}`));
  assert.match(script, /TODO: package speed not recognized/);
  assert.ok(!script.includes('/queue simple set'));
});

test('generators are read-only: frozen input is untouched', () => {
  const customer = fullCustomer();
  const frozen = Object.freeze({ ...customer });
  assert.doesNotThrow(() => buildCustomerMikrotikSnippet(frozen));
  assert.doesNotThrow(() => buildDefaulterLockScript([frozen], { todayStr: '2026-10-28' }));
  assert.doesNotThrow(() => buildDefaulterRestoreScript([frozen]));
  assert.equal(frozen.pppoeUsername, 'faisal42');
  assert.equal(frozen.promiseDate, null);
});

test('core: addCustomer and updateCustomerProfile carry the four router fields', () => {
  let state = addCustomer(emptyState(), 'ROUTER CUSTOMER', new Date('2026-10-28'), {
    pppoeUsername: 'router1',
    pppoePassword: 'pw1',
    staticIp: '10.0.0.5',
    macAddress: 'AA:00:BB:11:CC:22'
  });
  const created = state.customers[0];
  assert.equal(created.pppoeUsername, 'router1');
  assert.equal(created.pppoePassword, 'pw1');
  assert.equal(created.staticIp, '10.0.0.5');
  assert.equal(created.macAddress, 'AA:00:BB:11:CC:22');
  state = updateCustomerProfile(state, created.id, { staticIp: '10.0.0.9', macAddress: '' });
  const updated = state.customers[0];
  assert.equal(updated.staticIp, '10.0.0.9');
  assert.equal(updated.macAddress, '');
  assert.equal(updated.pppoeUsername, 'router1');
});
