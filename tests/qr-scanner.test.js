// SISP-48: In-App QR Khata Card Camera Scanner.
// Pure-function tests on synthetic data only. Spec test criteria (verbatim):
// decoding a valid ?customer=12&action=pay QR payload opens Customer #12's
// Quick Collect modal; unknown ID shows a safe toast.
// The pins:
//  - the SISP-14 payload format is unchanged: buildKhataDeepLink output
//    round-trips through the strict scanner parser back to the same
//    customer, and the scanner routes it with action 'pay';
//  - a scanned payload is UNTRUSTED: foreign hosts, other paths, extra or
//    duplicate parameters, non-pay actions, hostile schemes and malformed
//    strings are all rejected, and a rejection/not-found result NEVER
//    carries a customer record or any navigation target;
//  - the session lifecycle is idempotent: double start acquires once,
//    double stop releases once, stop-during-acquire releases the late
//    stream without ever starting the loop, and a payload is delivered
//    exactly once after the session has fully stopped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KHATA_APP_URL, buildKhataDeepLink } from '../qr-card.js';
import {
  parseScannedKhataPayload,
  qrScannerAllowedBases,
  qrScannerSupport,
  routeScannedKhata,
  createQrScannerSession,
  scannedGroupPrompt,
  createContinuousScanFlow
} from '../qr-scanner.js';
import { billingGroupForCustomer, buildGroupDue } from '../group-billing.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const customers = [
  { id: 'cust-12', customerNumber: 12, name: 'Test Customer 12' },
  { id: 'cust-abc', customerNumber: 42, name: 'Test Customer 42' }
];
const BASES = qrScannerAllowedBases('http://localhost:3000/');

// ------------------------------------------------------------ round trip

test('round trip: the SISP-14 canonical payload format is unchanged and routes to the same customer', () => {
  const payload = buildKhataDeepLink('cust-12');
  assert.equal(payload, `${KHATA_APP_URL}?customer=cust-12&action=pay`);
  assert.deepEqual(parseScannedKhataPayload(payload, { allowedBases: BASES }),
    { ok: true, customerId: 'cust-12', action: 'pay' });
  const routed = routeScannedKhata(customers, payload, { allowedBases: BASES });
  assert.equal(routed.status, 'found');
  assert.equal(routed.customer.id, 'cust-12');
  assert.equal(routed.action, 'pay');
});

test('spec criterion: ?customer=12&action=pay resolves Customer #12 with the pay action', () => {
  const routed = routeScannedKhata(customers, '?customer=12&action=pay', { allowedBases: BASES });
  assert.equal(routed.status, 'found');
  assert.equal(routed.customer.customerNumber, 12);
  assert.equal(routed.action, 'pay');
  // Bare full URL and bare query forms of the same card resolve identically.
  for (const form of [
    `${KHATA_APP_URL}?customer=12&action=pay`,
    'customer=12&action=pay'
  ]) {
    const again = routeScannedKhata(customers, form, { allowedBases: BASES });
    assert.equal(again.status, 'found', form);
    assert.equal(again.customer.id, 'cust-12', form);
    assert.equal(again.action, 'pay', form);
  }
  // No action parameter = profile (the SISP-14 default), still routable.
  const profile = routeScannedKhata(customers, '?customer=cust-abc', { allowedBases: BASES });
  assert.equal(profile.status, 'found');
  assert.equal(profile.action, 'profile');
});

// ------------------------------------------------------------ not found

test('unknown customer id: not-found, with NO customer record and NO navigation target', () => {
  const routed = routeScannedKhata(customers, '?customer=999&action=pay', { allowedBases: BASES });
  assert.equal(routed.status, 'not-found');
  assert.equal(routed.customerId, '999');
  assert.equal('customer' in routed, false);
  assert.deepEqual(Object.keys(routed).sort(), ['action', 'customerId', 'status']);
});

// ------------------------------------------------------------ rejection

test('foreign URLs are rejected: other host, lookalike host, other path, userinfo trick', () => {
  const foreign = [
    'https://evil.example.com/?customer=12&action=pay',
    'https://offerpk.github.io.evil.com/shahdara-isp-billing/?customer=12&action=pay',
    'https://offerpk.github.io/other-app/?customer=12&action=pay',
    'https://offerpk.github.io@evil.com/shahdara-isp-billing/?customer=12&action=pay',
    'http://offerpk.github.io/shahdara-isp-billing/?customer=12&action=pay' // wrong scheme for the canonical host
  ];
  for (const payload of foreign) {
    const parsed = parseScannedKhataPayload(payload, { allowedBases: BASES });
    assert.equal(parsed.ok, false, payload);
    assert.equal(parsed.reason, 'foreign', payload);
    const routed = routeScannedKhata(customers, payload, { allowedBases: BASES });
    assert.equal(routed.status, 'invalid', payload);
    assert.equal('customer' in routed, false, payload);
  }
});

test('extra, duplicate or hostile parameters are rejected', () => {
  const cases = [
    ['?customer=12&action=pay&admin=1', 'unexpected-params'],
    ['?customer=12&action=pay&redirect=https://evil.example.com', 'unexpected-params'],
    ['?customer=12&customer=42&action=pay', 'duplicate-param'],
    ['?customer=12&action=pay&action=pay', 'duplicate-param'],
    ['?customer=12&action=delete', 'bad-action'],
    ['?customer=12&action=profile', 'bad-action'],
    [`${KHATA_APP_URL}?customer=12&action=pay&debug=1`, 'unexpected-params']
  ];
  for (const [payload, reason] of cases) {
    const parsed = parseScannedKhataPayload(payload, { allowedBases: BASES });
    assert.equal(parsed.ok, false, payload);
    assert.equal(parsed.reason, reason, payload);
  }
});

test('malformed and hostile strings are rejected without throwing', () => {
  const cases = [
    ['', 'empty'],
    ['   ', 'empty'],
    ['hello world', 'malformed'],
    ['just some text with customer inside', 'malformed'],
    ['javascript:alert(1)', 'foreign'],
    ['data:text/html,<b>hi</b>', 'foreign'],
    ['?action=pay', 'missing-customer'],
    ['?customer=&action=pay', 'missing-customer'],
    ['?customer', 'malformed'],
    ['?customer=12&action', 'malformed'],
    ['?customer=%zz&action=pay', 'malformed'],
    [`${KHATA_APP_URL}`, 'missing-customer'],
    [`${KHATA_APP_URL}?customer=12&action=pay#frag`, 'malformed'],
    ['?customer=12&action=pay#frag', 'malformed'],
    ['x'.repeat(600), 'too-long']
  ];
  for (const [payload, reason] of cases) {
    assert.deepEqual(parseScannedKhataPayload(payload, { allowedBases: BASES }),
      { ok: false, reason }, JSON.stringify(payload));
  }
  for (const junk of [null, undefined, 42, {}, [], true]) {
    assert.equal(parseScannedKhataPayload(junk, { allowedBases: BASES }).ok, false);
    assert.equal(routeScannedKhata(customers, junk, { allowedBases: BASES }).status, 'invalid');
  }
});

test('hostile customer values resolve nowhere (no crash, no wrong customer)', () => {
  for (const payload of [
    '?customer=%2e%2e&action=pay',
    '?customer=cust-12%00&action=pay',
    '?customer=%20&action=pay'
  ]) {
    const routed = routeScannedKhata(customers, payload, { allowedBases: BASES });
    assert.notEqual(routed.status, 'found', payload);
    assert.equal('customer' in routed, false, payload);
  }
});

test("this install's own served base is accepted alongside the canonical base", () => {
  const href = 'https://mirror.example.org/billing/index.html';
  const bases = qrScannerAllowedBases(href);
  assert.ok(bases.includes(KHATA_APP_URL));
  assert.ok(bases.includes('https://mirror.example.org/billing/'));
  const routed = routeScannedKhata(customers,
    'https://mirror.example.org/billing/?customer=42&action=pay', { allowedBases: bases });
  assert.equal(routed.status, 'found');
  assert.equal(routed.customer.id, 'cust-abc');
});

// ------------------------------------------------------------ support probe

test('capability probe: reports which scan paths exist; manual always available', () => {
  assert.deepEqual(qrScannerSupport({}), { barcodeDetector: false, getUserMedia: false, manual: true });
  assert.deepEqual(
    qrScannerSupport({ BarcodeDetector: function () {}, navigator: { mediaDevices: { getUserMedia: () => {} } } }),
    { barcodeDetector: true, getUserMedia: true, manual: true }
  );
  assert.equal(qrScannerSupport(null).manual, true);
});

// ------------------------------------------------------------ session

function fakeSession({ detectResults = [], acquireError = null } = {}) {
  const calls = { acquire: 0, release: 0, payloads: [], errors: [] };
  const queue = [];
  const session = createQrScannerSession({
    acquire: async () => {
      calls.acquire += 1;
      if (acquireError) throw acquireError;
      return { stream: calls.acquire };
    },
    release: () => { calls.release += 1; },
    detect: async () => (detectResults.length ? detectResults.shift() : null),
    scheduleFrame: (cb) => { queue.push(cb); return queue.length; },
    cancelFrame: () => {},
    onPayload: (text) => { calls.payloads.push(text); },
    onError: (err) => { calls.errors.push(err); }
  });
  const pump = async () => {
    const cb = queue.shift();
    if (cb) await cb();
  };
  return { session, calls, pump, pendingFrames: () => queue.length };
}

test('session: a decoded payload is delivered exactly once, after a full stop', async () => {
  const { session, calls, pump } = fakeSession({ detectResults: [null, null, '?customer=12&action=pay'] });
  assert.equal(await session.start(), true);
  assert.equal(session.getState(), 'scanning');
  await pump(); // frame 1: nothing
  await pump(); // frame 2: nothing
  assert.deepEqual(calls.payloads, []);
  await pump(); // frame 3: payload
  assert.deepEqual(calls.payloads, ['?customer=12&action=pay']);
  assert.equal(session.getState(), 'idle');
  assert.equal(calls.release, 1);
  await pump(); // nothing left scheduled
  assert.equal(calls.payloads.length, 1);
  assert.equal(calls.release, 1);
});

test('session: start and stop are idempotent — one acquire, one release', async () => {
  const { session, calls } = fakeSession();
  assert.equal(session.stop(), false); // stop while idle: no-op
  assert.equal(await session.start(), true);
  assert.equal(await session.start(), false); // double start: no second acquire
  assert.equal(calls.acquire, 1);
  assert.equal(session.stop(), true);
  assert.equal(session.stop(), false); // double stop: no second release
  assert.equal(calls.release, 1);
  assert.equal(session.isActive(), false);
});

test('session: stop during a pending acquire releases the late stream and never scans', async () => {
  let resolveAcquire;
  const calls = { release: 0, payloads: 0 };
  const queue = [];
  const session = createQrScannerSession({
    acquire: () => new Promise((resolve) => { resolveAcquire = resolve; }),
    release: () => { calls.release += 1; },
    detect: async () => '?customer=12&action=pay',
    scheduleFrame: (cb) => { queue.push(cb); return queue.length; },
    cancelFrame: () => {},
    onPayload: () => { calls.payloads += 1; },
    onError: () => {}
  });
  const started = session.start();
  assert.equal(session.getState(), 'starting');
  assert.equal(session.stop(), true);
  resolveAcquire({ stream: 1 });
  assert.equal(await started, false);
  assert.equal(calls.release, 1); // the late stream was handed straight back
  assert.equal(session.getState(), 'idle');
  assert.equal(queue.length, 0); // the decode loop never started
  assert.equal(calls.payloads, 0);
});

test('session: a per-frame decode error never kills the loop; acquire failure reports once', async () => {
  let detectCalls = 0;
  const payloads = [];
  const queue = [];
  const flaky = createQrScannerSession({
    acquire: async () => ({}),
    release: () => {},
    detect: async () => {
      detectCalls += 1;
      if (detectCalls === 1) throw new Error('blurry frame');
      return '?customer=42&action=pay';
    },
    scheduleFrame: (cb) => { queue.push(cb); return queue.length; },
    cancelFrame: () => {},
    onPayload: (text) => { payloads.push(text); },
    onError: () => {}
  });
  assert.equal(await flaky.start(), true);
  await queue.shift()(); // frame 1 throws inside detect — loop survives
  assert.deepEqual(payloads, []);
  assert.equal(flaky.getState(), 'scanning');
  await queue.shift()(); // frame 2 decodes
  assert.deepEqual(payloads, ['?customer=42&action=pay']);
  assert.equal(flaky.getState(), 'idle');

  const failing = fakeSession({ acquireError: new Error('permission denied') });
  assert.equal(await failing.session.start(), false);
  assert.equal(failing.calls.errors.length, 1);
  assert.equal(failing.session.getState(), 'idle');
  assert.equal(failing.calls.release, 0);
});

// ------------------------------------------------------------ SISP-187
// Group-Billing prompt + Continuous Counter Scan. Spec test criteria:
// pin continuous-scan re-entry after collection and group-billing
// prompt visibility. Fixtures are synthetic only.

const GROUP_MONTH = '2026-10';
const groupCustomers = [
  { id: 'cust-12', customerNumber: 12, name: 'Test Customer 12', bills: [{ month: GROUP_MONTH, dueAmount: 3000, payments: [] }] },
  { id: 'cust-abc', customerNumber: 42, name: 'Test Customer 42', bills: [{ month: GROUP_MONTH, dueAmount: 2000, payments: [{ amount: 500 }] }] },
  { id: 'cust-solo', customerNumber: 7, name: 'Test Solo 7', bills: [{ month: GROUP_MONTH, dueAmount: 1500, payments: [] }] },
  { id: 'cust-old', customerNumber: 9, name: 'Test Archived 9', archived: true, bills: [{ month: GROUP_MONTH, dueAmount: 9000, payments: [] }] }
];
const groupsFixture = [
  { billingGroupId: 'GRP-101', groupTitle: 'Test Family', memberIds: ['cust-12', 'cust-abc', 'cust-old'], createdAt: '' }
];

test('SISP-187: billingGroupForCustomer resolves membership from the group record (no customer-side field)', () => {
  const group = billingGroupForCustomer(groupsFixture, 'cust-abc');
  assert.equal(group.billingGroupId, 'GRP-101');
  assert.equal(billingGroupForCustomer(groupsFixture, 'cust-solo'), null);
  assert.equal(billingGroupForCustomer(groupsFixture, 'nobody'), null);
  assert.equal(billingGroupForCustomer(groupsFixture, ''), null);
  assert.equal(billingGroupForCustomer(null, 'cust-12'), null);
  assert.equal(billingGroupForCustomer([null, { groupTitle: '', memberIds: [] }, 'junk'], 'cust-12'), null);
});

test('SISP-187: group prompt appears ONLY for grouped customers, with the existing flow\'s own total', () => {
  const prompt = scannedGroupPrompt(groupCustomers[0], {
    groups: groupsFixture, customers: groupCustomers, month: GROUP_MONTH
  });
  assert.ok(prompt);
  assert.equal(prompt.billingGroupId, 'GRP-101');
  assert.equal(prompt.groupTitle, 'Test Family');
  // 3000 (cust-12) + 1500 remaining (cust-abc) = 4500 → 450000 cents.
  // The archived member's 9000 is listed by the flow but NEVER totals.
  assert.equal(prompt.totalCents, 450000);
  assert.equal(prompt.payableCount, 2);
  // No parallel math: the prompt figure IS buildGroupDue's figure.
  const due = buildGroupDue(groupsFixture[0], groupCustomers, GROUP_MONTH);
  assert.equal(prompt.totalCents, due.totalCents);
  assert.equal(prompt.payableCount, due.payableCount);
  // Ungrouped customers never see the prompt.
  assert.equal(scannedGroupPrompt(groupCustomers[2], {
    groups: groupsFixture, customers: groupCustomers, month: GROUP_MONTH
  }), null);
  assert.equal(scannedGroupPrompt(null, { groups: groupsFixture, customers: groupCustomers, month: GROUP_MONTH }), null);
  assert.equal(scannedGroupPrompt(undefined, {}), null);
});

test('SISP-187: group prompt total follows the allocation engine when the host supplies it', () => {
  const allocations = {
    forMonth: (id) => (id === 'cust-12'
      ? { balanceDueCents: 123400 }
      : id === 'cust-abc' ? { balanceDueCents: 0 } : { balanceDueCents: null })
  };
  const prompt = scannedGroupPrompt(groupCustomers[1], {
    groups: groupsFixture, customers: groupCustomers, month: GROUP_MONTH, allocations
  });
  assert.ok(prompt);
  assert.equal(prompt.totalCents, 123400);
  assert.equal(prompt.payableCount, 1);
});

test('SISP-187: continuous flow re-opens ONLY after a saved scan-initiated collection, in continuous mode', () => {
  const flow = createContinuousScanFlow();
  // Default OFF: a saved scan collection does not re-open (legacy behaviour).
  flow.beginScanCollection();
  flow.noteSaved();
  assert.equal(flow.endCollection(), false);
  // ON + save + close → re-open, exactly once.
  flow.setContinuous(true);
  assert.equal(flow.isContinuous(), true);
  flow.beginScanCollection();
  flow.noteSaved();
  assert.equal(flow.endCollection(), true);
  assert.equal(flow.endCollection(), false);
  // Multiple saves in one session (Collect Another) still end in one re-open.
  flow.beginScanCollection();
  flow.noteSaved();
  flow.noteSaved();
  assert.equal(flow.endCollection(), true);
});

test('SISP-187: continuous flow never re-opens after cancel/dismiss, and a stale pending can never pair with a later save', () => {
  const flow = createContinuousScanFlow();
  flow.setContinuous(true);
  // Cancel/dismiss: session ends with no save noted → no re-entry…
  flow.beginScanCollection();
  assert.equal(flow.hasPending(), true);
  assert.equal(flow.endCollection(), false);
  assert.equal(flow.hasPending(), false);
  // …and the consumed pending cannot pair with a later unrelated save.
  flow.noteSaved();
  assert.equal(flow.endCollection(), false);
  // A save with no scan session at all is ignored.
  const fresh = createContinuousScanFlow();
  fresh.setContinuous(true);
  fresh.noteSaved();
  assert.equal(fresh.endCollection(), false);
});

test('SISP-187: turning continuous mode OFF disarms a pending session', () => {
  const flow = createContinuousScanFlow();
  flow.setContinuous(true);
  flow.beginScanCollection();
  flow.noteSaved();
  flow.setContinuous(false);
  assert.equal(flow.isContinuous(), false);
  assert.equal(flow.hasPending(), false);
  assert.equal(flow.endCollection(), false);
});

test('SISP-187: hostile payloads stay rejected — continuous/group features never widen the parser', () => {
  for (const payload of [
    'https://evil.example.com/?customer=12&action=pay',
    '?customer=12&action=pay&admin=1',
    'javascript:alert(1)'
  ]) {
    const routed = routeScannedKhata(groupCustomers, payload, { allowedBases: BASES });
    assert.equal(routed.status, 'invalid', payload);
    assert.equal('customer' in routed, false, payload);
  }
  // And a valid grouped scan still routes normally.
  const ok = routeScannedKhata(groupCustomers, '?customer=12&action=pay', { allowedBases: BASES });
  assert.equal(ok.status, 'found');
  assert.equal(ok.customer.id, 'cust-12');
});

test('SISP-187: i18n — every new qrscan key exists in en + ur with placeholder parity', () => {
  const keys = [
    'qrscan_continuous_label',
    'qrscan_continuous_hint',
    'qrscan_group_prompt',
    'qrscan_group_collect',
    'qrscan_single_collect'
  ];
  const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), key);
  }
  // t() interpolation actually fills the group prompt + button strings.
  assert.equal(
    t('qrscan_group_prompt', 'en', { name: 'Test Customer 12', group: 'Test Family' }),
    'Test Customer 12 belongs to group “Test Family”.'
  );
  assert.ok(t('qrscan_group_collect', 'en', { total: 'Rs. 4,500' }).includes('Rs. 4,500'));
  assert.ok(t('qrscan_group_collect', 'ur', { total: 'Rs. 4,500' }).includes('Rs. 4,500'));
});

test('SISP-187: wiring pins — dialog controls, scanner hooks and the Quick Collect onCollected seam exist', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['qrScannerContinuousToggle', 'qrScannerGroupPrompt', 'qrScannerGroupPromptText', 'qrScannerGroupCollectBtn', 'qrScannerSingleCollectBtn']) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  const scannerSrc = readFileSync(new URL('../qr-scanner.js', import.meta.url), 'utf8');
  assert.ok(scannerSrc.includes('createContinuousScanFlow'));
  assert.ok(scannerSrc.includes('scannedGroupPrompt'));
  assert.ok(scannerSrc.includes('noteCollectionClosed'));
  const qcSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qcSrc.includes('onCollected'), 'Quick Collect must expose the saved-payment hook');
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes('noteCollectionSaved'), 'app.js must forward saved payments to the scanner');
  assert.ok(appSrc.includes('onOpenGroup'), 'app.js must route the group prompt into the group modal');
});
