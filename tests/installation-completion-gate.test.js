// SISP-137: 5-Point New Installation Handover & Initial Signal (dBm)
// Quality Gate. Pure-builder tests (the 5 checks in pass/fail/warn
// states, the -25.0 dBm threshold edges, the drop-cable evidence
// ladder), the completion-stamp audit plumbing in install-tracker.js,
// the bilingual dictionary audit, and the wiring (dialog, app.js,
// tracker hook). Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  INSTALL_GATE_SIGNAL_WARN_DBM,
  buildGateReviewRecord,
  buildInstallationGate,
  renderInstallGateRows
} from '../installation-completion-gate.js';
import {
  applyInstallCompletion,
  buildInstallCompletionPlan,
  sanitizeGateReview,
  sanitizeInstallCompletion,
  sanitizeInstallRequests
} from '../install-tracker.js';
import { TRANSLATIONS } from '../nav-language.js';
import { collectRuntimeFiles } from '../build.mjs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

function check(gate, key) {
  return gate.checks.find((entry) => entry.key === key);
}

/** A customer whose record passes every record-side check. */
function goodCustomer(overrides = {}) {
  return {
    id: 'cust-gate-1',
    name: 'Gate Fixture Customer',
    splitterBoxId: 'SPL-Test-01',
    splitterPort: 3,
    oltPonPort: 'PON 1/2/3',
    lastRxDbm: -20,
    routerOwnership: 'isp-owned',
    mediaConverterOwnership: '',
    connectionFee: 1500,
    fiberMeters: 120,
    installmentPlans: [],
    ...overrides
  };
}

/** A sanitized install request carrying a SISP-57 completion stamp. */
function completedRequest({ deductions = [{ itemId: 'fiber-2core', qty: 120 }], warnings = [], fiberMeters = 120 } = {}) {
  return sanitizeInstallRequests([{
    id: 'IR-7',
    requesterName: 'Gate Fixture Customer',
    requestDate: '2026-10-01',
    amountPaid: 1500,
    payMethod: 'cash',
    installDate: '2026-10-03',
    completedCustomerId: 'cust-gate-1',
    completion: {
      connectionFee: 1500,
      routerModel: '',
      routerPrice: null,
      fiberMeters,
      routerQty: 0,
      mediaConverterQty: 0,
      stockDeductions: deductions,
      stockWarnings: warnings,
      stockDeductedAt: '2026-10-03T00:00:00.000Z'
    }
  }])[0];
}

test('gate: exactly the 5 spec checks, in order, all passing on a complete install', () => {
  const gate = buildInstallationGate(goodCustomer(), { installRequest: completedRequest(), movements: [] });
  assert.deepEqual(gate.checks.map((entry) => entry.key), ['splitter', 'signal', 'custody', 'dropCable', 'feeKist']);
  assert.deepEqual(gate.checks.map((entry) => entry.status), ['pass', 'pass', 'pass', 'pass', 'pass']);
  assert.equal(gate.passCount, 5);
  assert.equal(gate.warnCount, 0);
  assert.equal(gate.failCount, 0);
  assert.equal(gate.total, 5);
  assert.equal(gate.ok, true);
  for (const entry of gate.checks) {
    assert.ok(entry.label.length > 0 && !entry.label.startsWith('instgate_'), `label resolved for ${entry.key}`);
    assert.ok(entry.detail.length > 0 && !entry.detail.startsWith('instgate_'), `detail resolved for ${entry.key}`);
  }
});

test('gate splitter check: box + port pass; either one missing fails', () => {
  const base = { installRequest: completedRequest(), movements: [] };
  assert.equal(check(buildInstallationGate(goodCustomer(), base), 'splitter').status, 'pass');
  assert.equal(check(buildInstallationGate(goodCustomer({ splitterBoxId: '' }), base), 'splitter').status, 'fail');
  assert.equal(check(buildInstallationGate(goodCustomer({ splitterPort: null }), base), 'splitter').status, 'fail');
  assert.equal(check(buildInstallationGate(goodCustomer({ splitterBoxId: '', splitterPort: 4 }), base), 'splitter').status, 'fail');
  assert.equal(check(buildInstallationGate(goodCustomer({ splitterPort: 99 }), base), 'splitter').status, 'fail', 'out-of-range port is not an assignment');
});

test('gate signal check: missing fails, -25.0 passes, -25.1 warns, -20 passes', () => {
  const base = { installRequest: completedRequest(), movements: [] };
  const signal = (dbm) => check(buildInstallationGate(goodCustomer({ lastRxDbm: dbm }), base), 'signal');
  assert.equal(INSTALL_GATE_SIGNAL_WARN_DBM, -25.0);
  assert.equal(signal(null).status, 'fail', 'no reading recorded');
  assert.equal(signal('').status, 'fail', 'empty reading recorded');
  assert.equal(signal(-25.0).status, 'pass', 'exactly -25.0 passes (warn is strictly below)');
  assert.equal(signal(-25.1).status, 'warn', '-25.1 is a weak install');
  assert.equal(signal(-20).status, 'pass');
  assert.equal(signal(-31.5).status, 'warn', 'a recorded reading never fails, however weak');
  assert.match(signal(-25.1).detail, /-25\.1/);
});

test('gate custody check: any recorded ownership logs the custody; none fails', () => {
  const base = { installRequest: completedRequest(), movements: [] };
  const custody = (overrides) => check(buildInstallationGate(goodCustomer(overrides), base), 'custody');
  assert.equal(custody({ routerOwnership: 'isp-owned' }).status, 'pass');
  assert.equal(custody({ routerOwnership: 'customer-owned' }).status, 'pass', 'customer-purchased is still a custody log');
  assert.equal(custody({ routerOwnership: '', mediaConverterOwnership: 'isp-owned' }).status, 'pass');
  assert.equal(custody({ routerOwnership: '', mediaConverterOwnership: '' }).status, 'fail');
  assert.match(custody({ routerOwnership: 'isp-owned' }).detail, /Router/);
});

test('gate drop-cable check: completion stamp deduction is the strongest evidence', () => {
  const gate = buildInstallationGate(goodCustomer(), { installRequest: completedRequest(), movements: [] });
  const drop = check(gate, 'dropCable');
  assert.equal(drop.status, 'pass');
  assert.match(drop.detail, /120/);
});

test('gate drop-cable check: a stock-out movement carrying the installation note passes', () => {
  const request = { id: 'IR-9', completion: null };
  const movements = [
    { itemId: 'fiber-2core', kind: 'out', qty: 80, date: '2026-10-03', customerName: 'Gate Fixture Customer', note: 'Installation IR-9 — 2-Core Fiber Cable' },
    { itemId: 'router', kind: 'out', qty: 1, date: '2026-10-03', customerName: 'Gate Fixture Customer', note: 'Installation IR-9 — Router' }
  ];
  const drop = check(buildInstallationGate(goodCustomer({ fiberMeters: null }), { installRequest: request, movements }), 'dropCable');
  assert.equal(drop.status, 'pass');
  assert.match(drop.detail, /80/);
});

test('gate drop-cable check: another installation\'s movement does not count', () => {
  const request = { id: 'IR-9', completion: null };
  const movements = [
    { itemId: 'fiber-2core', kind: 'out', qty: 80, date: '2026-10-03', customerName: 'Someone Else', note: 'Installation IR-10 — 2-Core Fiber Cable' }
  ];
  const drop = check(buildInstallationGate(goodCustomer({ fiberMeters: null }), { installRequest: request, movements }), 'dropCable');
  assert.equal(drop.status, 'fail');
});

test('gate drop-cable check: without a request, an installation movement must name this customer', () => {
  const movements = [
    { itemId: 'fiber-2core', kind: 'out', qty: 60, date: '2026-10-03', customerName: 'Gate Fixture Customer', note: 'Installation IR-3 — 2-Core Fiber Cable' }
  ];
  assert.equal(check(buildInstallationGate(goodCustomer({ fiberMeters: null }), { movements }), 'dropCable').status, 'pass');
  const other = [{ ...movements[0], customerName: 'Different Customer' }];
  assert.equal(check(buildInstallationGate(goodCustomer({ fiberMeters: null }), { movements: other }), 'dropCable').status, 'fail');
});

test('gate drop-cable check: a deduction staged by the completion plan passes pre-completion', () => {
  const drop = check(buildInstallationGate(goodCustomer({ fiberMeters: null }), {
    installRequest: { id: 'IR-11', completion: null },
    movements: [],
    pendingDeductions: [{ itemId: 'fiber-2core', kind: 'out', qty: 95 }]
  }), 'dropCable');
  assert.equal(drop.status, 'pass');
  assert.match(drop.detail, /95/);
});

test('gate drop-cable check: a skipped deduction (stock short) fails and says so', () => {
  const skippedAtCompletion = buildInstallationGate(goodCustomer(), {
    installRequest: completedRequest({ deductions: [], warnings: [{ itemId: 'fiber-2core', qty: 120, available: 40, reason: 'insufficient' }] }),
    movements: []
  });
  assert.equal(check(skippedAtCompletion, 'dropCable').status, 'fail');
  assert.match(check(skippedAtCompletion, 'dropCable').detail, /NOT deducted/);

  const skippedInPlan = buildInstallationGate(goodCustomer({ fiberMeters: null }), {
    installRequest: { id: 'IR-12', completion: null },
    movements: [],
    pendingDeductions: [],
    pendingStockWarnings: [{ itemId: 'fiber-2core', qty: 70, available: 0, reason: 'insufficient' }]
  });
  assert.equal(check(skippedInPlan, 'dropCable').status, 'fail');
});

test('gate drop-cable check: typed meters alone are NOT a deduction', () => {
  const drop = check(buildInstallationGate(goodCustomer({ fiberMeters: 120 }), { movements: [] }), 'dropCable');
  assert.equal(drop.status, 'fail');
  assert.match(drop.detail, /not a deduction/);
  const bare = check(buildInstallationGate(goodCustomer({ fiberMeters: null }), { movements: [] }), 'dropCable');
  assert.equal(bare.status, 'fail');
});

test('gate fee/kist check: recorded fee passes (including an explicit 0), kist passes, pending fee passes', () => {
  const base = { installRequest: completedRequest(), movements: [] };
  const fee = (customer, sources = base) => check(buildInstallationGate(customer, sources), 'feeKist');
  assert.equal(fee(goodCustomer({ connectionFee: 1500 })).status, 'pass');
  assert.equal(fee(goodCustomer({ connectionFee: 0 })).status, 'pass', 'an explicitly recorded 0 fee is a recording (core stores null when never entered)');
  const plan = { id: 'kist-1', itemTitle: 'Router Tenda', totalAmount: 3000, downPayment: 500, monthlyKist: 500, totalMonths: 5, monthsBilled: 0, monthsPaid: 0 };
  const kist = fee(goodCustomer({ connectionFee: null, installmentPlans: [plan] }));
  assert.equal(kist.status, 'pass', 'a kist plan satisfies the check without a fee');
  assert.match(kist.detail, /Router Tenda/);
  const pending = fee(goodCustomer({ connectionFee: null }), { movements: [], pendingConnectionFee: 2000 });
  assert.equal(pending.status, 'pass', 'the fee the completion form is about to write counts pre-completion');
  assert.equal(fee(goodCustomer({ connectionFee: null })).status, 'fail', 'neither fee nor kist recorded');
});

test('gate: builder is pure — inputs are never mutated', () => {
  const customer = goodCustomer();
  const sources = { installRequest: completedRequest(), movements: [{ itemId: 'fiber-2core', kind: 'out', qty: 10, note: 'Installation IR-7 — x', customerName: 'Gate Fixture Customer' }] };
  const before = JSON.stringify({ customer, sources });
  buildInstallationGate(customer, sources);
  assert.equal(JSON.stringify({ customer, sources }), before);
});

test('gate review record: clean gate stamps nothing; warns and fails are recorded by key', () => {
  const clean = buildInstallationGate(goodCustomer(), { installRequest: completedRequest(), movements: [] });
  assert.equal(buildGateReviewRecord(clean, '2026-10-29T10:00:00.000Z'), null);
  const weak = buildInstallationGate(goodCustomer({ lastRxDbm: -27 }), { installRequest: completedRequest(), movements: [] });
  assert.deepEqual(buildGateReviewRecord(weak, '2026-10-29T10:00:00.000Z'), {
    at: '2026-10-29T10:00:00.000Z', failedChecks: [], warnedChecks: ['signal']
  });
  const bare = buildInstallationGate({}, {});
  assert.deepEqual(buildGateReviewRecord(bare, '2026-10-29T10:00:00.000Z'), {
    at: '2026-10-29T10:00:00.000Z',
    failedChecks: ['splitter', 'signal', 'custody', 'dropCable', 'feeKist'],
    warnedChecks: []
  });
});

test('gate rows render: 5 rows with status badges, and detail text is HTML-escaped', () => {
  const gate = buildInstallationGate(goodCustomer({ splitterBoxId: 'SPL-<b>01</b>' }), { installRequest: completedRequest(), movements: [] });
  const html = renderInstallGateRows(gate);
  assert.equal((html.match(/class="install-gate-row /g) || []).length, 5);
  assert.ok(html.includes('badge-healthy'), 'pass rows use the healthy badge');
  assert.ok(html.includes('SPL-&lt;b&gt;01&lt;/b&gt;'), 'recorded values are escaped, never raw HTML');
  const weak = renderInstallGateRows(buildInstallationGate(goodCustomer({ lastRxDbm: -28 }), { installRequest: completedRequest(), movements: [] }));
  assert.ok(weak.includes('badge-warning'), 'warn rows use the warning badge');
  const bare = renderInstallGateRows(buildInstallationGate({}, {}));
  assert.ok(bare.includes('badge-danger'), 'fail rows use the danger badge');
});

test('stamp plumbing: sanitizeGateReview keeps a real review and drops junk', () => {
  assert.deepEqual(
    sanitizeGateReview({ at: '2026-10-29T10:00:00.000Z', failedChecks: ['splitter', 'bogus'], warnedChecks: ['signal'] }),
    { at: '2026-10-29T10:00:00.000Z', failedChecks: ['splitter'], warnedChecks: ['signal'] }
  );
  assert.equal(sanitizeGateReview(null), null);
  assert.equal(sanitizeGateReview({ failedChecks: ['splitter'] }), null, 'no timestamp, no record');
  assert.equal(sanitizeGateReview({ at: '2026-10-29T10:00:00.000Z', failedChecks: [], warnedChecks: [] }), null, 'an empty review is not a record');
});

test('stamp plumbing: completion shape is unchanged without a review, and preserves one with it', () => {
  const base = {
    connectionFee: 1500, routerModel: '', routerPrice: null, fiberMeters: 120,
    routerQty: 0, mediaConverterQty: 0,
    stockDeductions: [{ itemId: 'fiber-2core', qty: 120 }], stockWarnings: [],
    stockDeductedAt: '2026-10-03T00:00:00.000Z'
  };
  const clean = sanitizeInstallCompletion(base);
  assert.ok(!('gateReview' in clean), 'no review → no new key (old records stay byte-identical in shape)');
  const review = { at: '2026-10-29T10:00:00.000Z', failedChecks: ['custody'], warnedChecks: [] };
  const stamped = sanitizeInstallCompletion({ ...base, gateReview: review });
  assert.deepEqual(stamped.gateReview, review);
  const roundTripped = sanitizeInstallRequests([{
    id: 'IR-7', requesterName: 'Gate Fixture Customer', requestDate: '2026-10-01', amountPaid: 1500,
    payMethod: 'cash', installDate: '2026-10-03', completedCustomerId: 'cust-gate-1', completion: { ...base, gateReview: review }
  }]);
  assert.deepEqual(roundTripped[0].completion.gateReview, review, 'the review survives the sanitize/backup round-trip');
});

test('stamp plumbing: applyInstallCompletion stamps plan.gateReview exactly once', () => {
  const requests = sanitizeInstallRequests([{
    id: 'IR-21', requesterName: 'Gate Fixture Customer', requestDate: '2026-10-01',
    amountPaid: 0, payMethod: 'cash', installDate: '', completedCustomerId: '', completion: null
  }]);
  const plan = buildInstallCompletionPlan(requests[0], {
    installDate: '2026-10-03', connectionFee: 1500, fiberMeters: 120, routerQty: 0, mediaConverterQty: 0
  }, { customers: [], movements: [{ itemId: 'fiber-2core', kind: 'in', qty: 500, date: '2026-10-01', customerName: '', note: 'Purchase' }] });
  const review = { at: '2026-10-29T10:00:00.000Z', failedChecks: [], warnedChecks: ['signal'] };
  plan.gateReview = review;
  const customer = { id: 'cust-new-1', name: 'Gate Fixture Customer', customerNumber: 501 };
  const stamped = applyInstallCompletion(requests, plan, customer, '2026-10-03T00:00:00.000Z');
  assert.deepEqual(stamped[0].completion.gateReview, review);
  // Re-completing keeps the original stamp (exactly-once), never re-stamps.
  const again = applyInstallCompletion(stamped, { ...plan, alreadyCompleted: true }, customer, '2026-10-04T00:00:00.000Z');
  assert.deepEqual(again[0].completion.gateReview, review);
  assert.equal(again[0].completion.stockDeductedAt, '2026-10-03T00:00:00.000Z');
});

test('i18n: every instgate_* key exists in both dictionaries with matching placeholders', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('instgate_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('instgate_')).sort();
  assert.ok(enKeys.length >= 40, `expected the SISP-137 keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys, enKeys);
  const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of enKeys) {
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);
  }
});

test('i18n: every t() key the gate + tracker use exists in both dictionaries (zero raw keys)', () => {
  const used = new Set();
  for (const rel of ['installation-completion-gate.js', 'install-tracker.js']) {
    for (const match of read(rel).matchAll(/t\('(instgate_[a-z_]+)'/g)) used.add(match[1]);
    for (const match of read(rel).matchAll(/'(instgate_[a-z_]+)'/g)) used.add(match[1]);
  }
  for (const match of read('index.html').matchAll(/data-i18n="(instgate_[a-z_]+)"/g)) used.add(match[1]);
  assert.ok(used.size >= 30, `expected broad instgate usage, got ${used.size}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string', `en missing ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string', `ur missing ${key}`);
  }
});

test('wiring: dialog markup, tracker hook order, app.js wiring, token-only CSS, build graph', async () => {
  const index = read('index.html');
  assert.ok(index.includes('id="installGateModal"'), 'index.html carries the gate dialog');
  assert.ok(/<dialog id="installGateModal"[^>]*data-nested-dialog/.test(index), 'gate dialog is a nested sub-dialog (#215 pattern, opens over the tracker)');
  for (const id of ['installGateCloseBtn', 'installGateCustomer', 'installGateIntro', 'installGateSummary', 'installGateRows', 'installGateNote', 'installGateBackBtn', 'installGateProceedBtn']) {
    assert.ok(index.includes(`id="${id}"`), `index.html carries #${id}`);
  }
  assert.ok(/id="installGateCloseBtn" class="modal-close" type="button" aria-label="Close">↩/.test(index), 'shared red-circle close button');

  const tracker = read('install-tracker.js');
  const gateAt = tracker.indexOf('onReviewInstallGate(plan, request)');
  const completeAt = tracker.indexOf('await onCompleteInstall(plan)');
  assert.ok(gateAt > -1 && completeAt > -1 && gateAt < completeAt, 'the gate is reviewed BEFORE the completion executor runs');
  assert.ok(tracker.includes('data-gate-request'), 'completed cards carry the read-only gate button');

  const app = read('app.js');
  assert.ok(app.includes("from './installation-completion-gate.js'"), 'app.js imports the gate module (app.js-only import, dist stays bundled)');
  assert.ok(app.includes('setupInstallGateDialog'), 'app.js sets up the gate dialog');
  assert.ok(app.includes('onReviewInstallGate: (plan, request) => reviewInstallGateBeforeCompletion(plan, request)'), 'tracker receives the pre-completion review');
  assert.ok(app.includes('onShowInstallGate: (request) => showInstallGateForRequest(request)'), 'tracker receives the read-only view');

  const css = read('components.css');
  const block = css.slice(css.indexOf('SISP-137'));
  assert.ok(block.includes('.install-gate-row'), 'gate styles shipped');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-137 styles use theme tokens only, no hex');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('installation-completion-gate.js'), 'the gate module is inside the bundled runtime graph');
});
