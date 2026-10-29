// SISP-57: Installation Request Tracker → Active Customer + Auto Stock
// Deduction pipeline. Pure-plan tests plus a harness that executes a
// plan exactly the way app.js completeInstallRequest does (core
// addCustomer / updateCustomerProfile for the customer, inventory-book
// addMovement as the ONLY stock write, install-tracker
// applyInstallCompletion for the stamp). Synthetic data only.
//
// Spec pin: completing an installation request with 120m fiber and 1
// router creates the active customer record and deducts 120m fiber and
// 1 router from sisp_inventory_v1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, addCustomer, updateCustomerProfile, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { INVENTORY_ITEM_IDS, addMovement, availableFor, loadInventory, saveInventory } from '../inventory-book.js';
import {
  addInstallRequest,
  applyInstallCompletion,
  buildInstallCompletionPlan,
  loadInstallRequests,
  sanitizeInstallRequests,
  saveInstallRequests
} from '../install-tracker.js';
import { TRANSLATIONS, t } from '../nav-language.js';

function stockIn(movements, itemId, qty) {
  return addMovement(movements, { itemId, kind: 'in', qty, date: '2026-10-01', customerName: '', note: 'Purchase' });
}

function baseStock() {
  let movements = [];
  movements = stockIn(movements, 'fiber-2core', 500);
  movements = stockIn(movements, 'router', 3);
  movements = stockIn(movements, 'media-converter', 2);
  return movements;
}

function pendingRequest(overrides = {}) {
  return addInstallRequest([], {
    requesterName: 'Pipeline Customer',
    requestDate: '2026-10-01',
    amountPaid: '10000',
    payMethod: 'easypaisa',
    ...overrides
  }, { customers: [] });
}

// Mirrors app.js completeInstallRequest: link updates only entered
// fields (+ connectionDate when unset, Active status); create goes
// through core addCustomer; stock moves only via addMovement, after
// the customer step, so a customer failure deducts nothing.
function executePlan(state, plan, movements) {
  if (plan.alreadyCompleted) {
    const existing = state.customers.find((c) => c.id === plan.customerId);
    if (!existing) throw new Error('The completed customer is no longer in the list.');
    return { state, movements, customer: existing };
  }
  const referenceDate = new Date(`${plan.installDate}T12:00:00+05:00`);
  let customer;
  if (plan.mode === 'link') {
    const existing = state.customers.find((c) => c.id === plan.customerId);
    if (!existing) throw new Error('The linked customer is no longer in the list.');
    const fields = { ...plan.customerFields };
    if (!existing.connectionDate) fields.connectionDate = plan.installDate;
    if (existing.serviceStatus !== 'active') fields.serviceStatus = 'active';
    state = updateCustomerProfile(state, existing.id, fields, referenceDate);
    customer = state.customers.find((c) => c.id === existing.id);
  } else {
    const nc = plan.newCustomer || {};
    const beforeIds = new Set(state.customers.map((c) => c.id));
    state = addCustomer(state, nc.name, referenceDate, {
      phone: nc.phone || '',
      connectionFee: nc.connectionFee,
      routerModel: nc.routerModel || '',
      routerPrice: nc.routerPrice,
      fiberMeters: nc.fiberMeters,
      serviceStatus: 'active'
    });
    customer = state.customers.find((c) => !beforeIds.has(c.id));
    state = updateCustomerProfile(state, customer.id, { connectionDate: plan.installDate }, referenceDate);
    customer = state.customers.find((c) => c.id === customer.id);
  }
  let nextMovements = movements;
  for (const deduction of plan.deductions) nextMovements = addMovement(nextMovements, deduction);
  return { state, movements: nextMovements, customer };
}

function complete(state, requests, movements, requestId, input) {
  const request = requests.find((r) => r.id === requestId);
  const plan = buildInstallCompletionPlan(request, input, {
    customers: state.customers,
    movements,
    inventoryItemIds: INVENTORY_ITEM_IDS
  });
  const done = executePlan(state, plan, movements);
  const stamped = applyInstallCompletion(requests, plan, done.customer);
  return { ...done, plan, requests: stamped };
}

test('spec pin: 120m fiber + 1 router creates the active customer and deducts exactly that stock', () => {
  const requests = pendingRequest({ phone: '0300 1112223' });
  const result = complete(createInitialState(), requests, baseStock(), requests[0].id, {
    installDate: '2026-10-03',
    connectionFee: '3000',
    routerModel: 'TP-Link WR841',
    routerPrice: '2500',
    fiberMeters: '120',
    routerQty: '1',
    mediaConverterQty: '0'
  });
  // Customer created, active, with the recorded connection fields.
  assert.equal(result.state.customers.length, 1);
  const customer = result.state.customers[0];
  assert.equal(customer.name, 'Pipeline Customer');
  assert.equal(customer.phone, '0300 1112223');
  assert.equal(customer.serviceStatus, 'active');
  assert.equal(customer.connectionDate, '2026-10-03');
  assert.equal(customer.connectionFee, 3000);
  assert.equal(customer.routerModel, 'TP-Link WR841');
  assert.equal(customer.routerPrice, 2500);
  assert.equal(customer.fiberMeters, 120);
  // Stock deducted exactly: 120m fiber, 1 router, no media converter.
  assert.equal(availableFor(result.movements, 'fiber-2core'), 380);
  assert.equal(availableFor(result.movements, 'router'), 2);
  assert.equal(availableFor(result.movements, 'media-converter'), 2);
  const outs = result.movements.filter((m) => m.kind === 'out');
  assert.deepEqual(outs.map((m) => [m.itemId, m.qty]), [['router', 1], ['fiber-2core', 120]]);
  // Request stamped: installed, linked, completion recorded.
  const stamped = result.requests[0];
  assert.equal(stamped.installDate, '2026-10-03');
  assert.equal(stamped.customerId, customer.id);
  assert.equal(stamped.completedCustomerId, customer.id);
  assert.deepEqual(stamped.completion.stockDeductions, [{ itemId: 'router', qty: 1 }, { itemId: 'fiber-2core', qty: 120 }]);
  assert.deepEqual(stamped.completion.stockWarnings, []);
  assert.ok(stamped.completion.stockDeductedAt);
  assert.equal(stamped.completion.fiberMeters, 120);
});

test('media converter deducts when the operator records one used', () => {
  const requests = pendingRequest();
  const result = complete(createInitialState(), requests, baseStock(), requests[0].id, {
    installDate: '2026-10-02', fiberMeters: '', routerQty: '0', mediaConverterQty: '1'
  });
  assert.equal(availableFor(result.movements, 'media-converter'), 1);
  assert.deepEqual(result.requests[0].completion.stockDeductions, [{ itemId: 'media-converter', qty: 1 }]);
});

test('link mode: completes against the linked customer, blanks never overwrite its fields', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Linked Person', new Date('2026-09-01T12:00:00+05:00'), { fiberMeters: 50, routerPrice: 1800 });
  const linked = state.customers[0];
  const requests = addInstallRequest([], {
    requesterName: 'Linked Person', requestDate: '2026-10-01', amountPaid: '5000', payMethod: 'cash', customerId: linked.id
  }, { customers: state.customers });
  const plan = buildInstallCompletionPlan(requests[0], {
    installDate: '2026-10-04', connectionFee: '', routerModel: '', routerPrice: '2600', fiberMeters: '', routerQty: '1', mediaConverterQty: '0'
  }, { customers: state.customers, movements: baseStock(), inventoryItemIds: INVENTORY_ITEM_IDS });
  assert.equal(plan.mode, 'link');
  assert.deepEqual(plan.customerFields, { routerPrice: 2600 });
  const result = complete(state, requests, baseStock(), requests[0].id, {
    installDate: '2026-10-04', connectionFee: '', routerModel: '', routerPrice: '2600', fiberMeters: '', routerQty: '1', mediaConverterQty: '0'
  });
  assert.equal(result.state.customers.length, 1); // no duplicate created
  const customer = result.state.customers[0];
  assert.equal(customer.routerPrice, 2600); // entered field updated
  assert.equal(customer.fiberMeters, 50); // blank left the stored value alone
  assert.equal(customer.connectionDate, '2026-10-04'); // unset -> install date
  assert.equal(customer.serviceStatus, 'active');
  assert.equal(result.requests[0].completedCustomerId, linked.id);
});

test('double completion is a no-op for customer AND stock (re-mark after edit clears the date)', () => {
  const requests = pendingRequest();
  const first = complete(createInitialState(), requests, baseStock(), requests[0].id, {
    installDate: '2026-10-03', fiberMeters: '120', routerQty: '1', mediaConverterQty: '0'
  });
  // Simulate the operator editing the request back to pending, then
  // marking it installed again: the stamp survives sanitize, the new
  // plan is alreadyCompleted, and nothing is created or deducted twice.
  const cleared = sanitizeInstallRequests(first.requests.map((r) => ({ ...r, installDate: '' })));
  assert.equal(cleared[0].completedCustomerId, first.customer.id);
  const second = complete(first.state, cleared, first.movements, cleared[0].id, {
    installDate: '2026-10-05', fiberMeters: '120', routerQty: '1', mediaConverterQty: '0'
  });
  assert.equal(second.plan.alreadyCompleted, true);
  assert.deepEqual(second.plan.deductions, []);
  assert.equal(second.state.customers.length, 1);
  assert.equal(availableFor(second.movements, 'fiber-2core'), 380);
  assert.equal(availableFor(second.movements, 'router'), 2);
  assert.equal(second.requests[0].installDate, '2026-10-05');
  assert.equal(second.requests[0].completion.stockDeductedAt, first.requests[0].completion.stockDeductedAt);
});

test('insufficient stock: that line is skipped with a warning, the rest completes', () => {
  let movements = [];
  movements = stockIn(movements, 'fiber-2core', 50); // only 50m in the book
  movements = stockIn(movements, 'router', 3);
  const requests = pendingRequest();
  const result = complete(createInitialState(), requests, movements, requests[0].id, {
    installDate: '2026-10-03', fiberMeters: '120', routerQty: '1', mediaConverterQty: '0'
  });
  assert.equal(result.state.customers.length, 1); // customer still completes
  assert.equal(result.state.customers[0].fiberMeters, 120); // operator fact kept on the record
  assert.equal(availableFor(result.movements, 'fiber-2core'), 50); // untouched
  assert.equal(availableFor(result.movements, 'router'), 2); // router still deducted
  assert.deepEqual(result.plan.warnings, [{ itemId: 'fiber-2core', qty: 120, available: 50, reason: 'insufficient' }]);
  assert.deepEqual(result.requests[0].completion.stockWarnings, result.plan.warnings);
  assert.deepEqual(result.requests[0].completion.stockDeductions, [{ itemId: 'router', qty: 1 }]);
});

test('missing catalog item: skipped as unavailable, never fabricated', () => {
  const requests = pendingRequest();
  const request = requests[0];
  const plan = buildInstallCompletionPlan(request, {
    installDate: '2026-10-03', fiberMeters: '', routerQty: '1', mediaConverterQty: '0'
  }, { customers: [], movements: baseStock(), inventoryItemIds: INVENTORY_ITEM_IDS.filter((id) => id !== 'router') });
  assert.deepEqual(plan.deductions, []);
  assert.deepEqual(plan.warnings, [{ itemId: 'router', qty: 1, available: 0, reason: 'unavailable' }]);
});

test('vanished link, duplicate name, and plain-installed requests are refused honestly', () => {
  const ghost = addInstallRequest([], {
    requesterName: 'Ghost Link', requestDate: '2026-10-01', amountPaid: '0', payMethod: 'cash', customerId: 'c1'
  }, { customers: [{ id: 'c1', name: 'Ghost Link', customerNumber: 1 }] });
  assert.throws(() => buildInstallCompletionPlan(ghost[0], { installDate: '2026-10-03' }, { customers: [], movements: baseStock(), inventoryItemIds: INVENTORY_ITEM_IDS }), /no longer in the list/);
  // Create mode refuses a name already on the list (core guard) and
  // deducts nothing, because stock moves only after the customer step.
  let state = createInitialState();
  state = addCustomer(state, 'Pipeline Customer', new Date('2026-09-01T12:00:00+05:00'), {});
  const requests = pendingRequest();
  const plan = buildInstallCompletionPlan(requests[0], {
    installDate: '2026-10-03', fiberMeters: '120', routerQty: '1', mediaConverterQty: '0'
  }, { customers: state.customers, movements: baseStock(), inventoryItemIds: INVENTORY_ITEM_IDS });
  assert.throws(() => executePlan(state, plan, baseStock()), /already in the list/);
  // A request installed the legacy way (no completion stamp) cannot be
  // pipeline-completed afterwards.
  const legacy = sanitizeInstallRequests([{ ...requests[0], installDate: '2026-10-02' }]);
  assert.throws(() => buildInstallCompletionPlan(legacy[0], { installDate: '2026-10-03' }, { customers: [], movements: baseStock(), inventoryItemIds: INVENTORY_ITEM_IDS }), /already marked installed/);
});

test('validation: fractional router qty, negative fee, install before request all throw', () => {
  const requests = pendingRequest();
  const ctx = { customers: [], movements: baseStock(), inventoryItemIds: INVENTORY_ITEM_IDS };
  assert.throws(() => buildInstallCompletionPlan(requests[0], { installDate: '2026-10-03', routerQty: '1.5' }, ctx), /whole number/);
  assert.throws(() => buildInstallCompletionPlan(requests[0], { installDate: '2026-10-03', connectionFee: '-5' }, ctx), /0 or more/);
  assert.throws(() => buildInstallCompletionPlan(requests[0], { installDate: '2026-09-30' }, ctx), /before the request date/);
  assert.throws(() => buildInstallCompletionPlan(requests[0], { installDate: 'bad' }, ctx), /valid install date/);
  assert.throws(() => applyInstallCompletion(requests, { requestId: 'IR-999', installDate: '2026-10-03' }, { id: 'x' }), /not found/);
});

test('completion stamp survives storage and backup round-trips', () => {
  const requests = pendingRequest();
  const result = complete(createInitialState(), requests, baseStock(), requests[0].id, {
    installDate: '2026-10-03', fiberMeters: '120', routerQty: '1', mediaConverterQty: '0'
  });
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(saveInstallRequests(result.requests, storage), true);
  const loaded = loadInstallRequests(storage);
  assert.equal(loaded[0].completedCustomerId, result.customer.id);
  assert.equal(loaded[0].completion.stockDeductedAt, result.requests[0].completion.stockDeductedAt);
  // Inventory movements travel under their own key too.
  saveInventory(result.movements, storage);
  assert.equal(availableFor(loadInventory(storage), 'fiber-2core'), 380);
  // Backup: the stamp rides settings.installRequests through sanitize.
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { installRequests: result.requests });
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.installRequests[0].completedCustomerId, result.customer.id);
  assert.deepEqual(preview.installRequests[0].completion.stockDeductions, [{ itemId: 'router', qty: 1 }, { itemId: 'fiber-2core', qty: 120 }]);
});

test('i18n: every instpipe_* key used in code and markup resolves in en AND ur', () => {
  const sources = [
    readFileSync(new URL('../install-tracker.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  ].join('\n');
  const keys = [...new Set([...sources.matchAll(/instpipe_[a-z_]+/g)].map((m) => m[0]))];
  assert.ok(keys.length >= 10, `expected the pipeline keys, found ${keys.length}`);
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `missing en: ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur: ${key}`);
    assert.notEqual(t(key, 'en'), key);
    assert.notEqual(t(key, 'ur'), key);
  }
});
