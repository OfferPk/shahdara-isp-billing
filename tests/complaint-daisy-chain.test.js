// SISP-49: Complaint Register Upstream Daisy-Chain Alert Banner.
// Pure-function tests on synthetic data only. Spec: when logging or
// viewing a complaint for a customer who has downstream dependents in
// outage-impact.js (SISP-7), display an inline alert banner listing all
// affected downstream homes with a 1-tap button to launch their bulk
// WhatsApp outage notifications.
//
// Decisions pinned here (spec silent): the banner shows only while the
// complaint is unresolved (Open / In Progress) — a resolved complaint's
// outage is over; the banner is strictly read-only and never mutates
// any complaint or customer record; dismissal needs no stored state
// because the banner is recomputed from live data on every render (it
// disappears by itself when the chain or the complaint state changes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDaisyChainAlert,
  buildOutageQueue,
  traceDownstreamImpact
} from '../outage-impact.js';
import {
  AREA_OUTAGE_CUSTOMER_ID,
  complaintDaisyChainAlert,
  createComplaint
} from '../complaint-register.js';

function customer(id, name, extra = {}) {
  return {
    id,
    customerNumber: Number(String(id).replace(/\D/g, '')) || 0,
    name,
    mohalla: 'Barrian',
    phone: '',
    upstreamCustomerId: '',
    fiberZone: '',
    archived: false,
    ...extra
  };
}

// House A feeds House B, House B feeds House C (spec chain).
function chainCustomers() {
  return [
    customer('cust-a', 'Test Feeder A', { fiberZone: 'Side 1' }),
    customer('cust-b', 'Test Home B', { upstreamCustomerId: 'cust-a', fiberZone: 'Side 1', phone: '923001234567' }),
    customer('cust-c', 'Test Home C', { upstreamCustomerId: 'cust-b', fiberZone: 'Side 1', phone: '03001234567' })
  ];
}

function complaintFor(customerId, status = 'Open', name = 'Test Feeder A') {
  const created = createComplaint({
    customerId,
    customerName: name,
    issueCategory: 'Media Converter / Charger Off',
    reportedAt: '2026-10-29T10:00'
  }, []);
  return { ...created, status };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

test('SISP-49: chain A->B->C — alert for A lists B and C in order with count 2', () => {
  const alert = buildDaisyChainAlert(chainCustomers(), 'cust-a');
  assert.ok(alert);
  assert.equal(alert.count, 2);
  assert.equal(alert.source.id, 'cust-a');
  assert.deepEqual(alert.impacted.map((e) => e.customer.id), ['cust-b', 'cust-c']);
  assert.deepEqual(alert.impacted.map((e) => e.customer.name), ['Test Home B', 'Test Home C']);
});

test('SISP-49: no dependents or unknown source — no alert', () => {
  const customers = chainCustomers();
  assert.equal(buildDaisyChainAlert(customers, 'cust-c'), null); // leaf feeds nobody
  assert.equal(buildDaisyChainAlert(customers, 'cust-missing'), null); // unknown id
  assert.equal(buildDaisyChainAlert([customer('solo', 'Test Solo')], 'solo'), null);
  assert.equal(buildDaisyChainAlert([], 'cust-a'), null);
  assert.equal(buildDaisyChainAlert(null, 'cust-a'), null);
});

test('SISP-49: complaint on B alerts only C — different sources never merge into one banner', () => {
  const customers = [
    ...chainCustomers(),
    customer('cust-x', 'Test Feeder X'),
    customer('cust-y', 'Test Home Y', { upstreamCustomerId: 'cust-x' })
  ];
  const alertB = complaintDaisyChainAlert(customers, complaintFor('cust-b', 'Open', 'Test Home B'));
  assert.deepEqual(alertB.impacted.map((e) => e.customer.id), ['cust-c']);
  const alertX = complaintDaisyChainAlert(customers, complaintFor('cust-x', 'Open', 'Test Feeder X'));
  assert.deepEqual(alertX.impacted.map((e) => e.customer.id), ['cust-y']);
  const alertA = complaintDaisyChainAlert(customers, complaintFor('cust-a'));
  assert.deepEqual(alertA.impacted.map((e) => e.customer.id), ['cust-b', 'cust-c']);
});

test('SISP-49: banner only while unresolved — Open and In Progress show it, Resolved does not', () => {
  const customers = chainCustomers();
  assert.ok(complaintDaisyChainAlert(customers, complaintFor('cust-a', 'Open')));
  assert.ok(complaintDaisyChainAlert(customers, complaintFor('cust-a', 'In Progress')));
  assert.equal(complaintDaisyChainAlert(customers, complaintFor('cust-a', 'Resolved')), null);
});

test('SISP-49: area-outage and malformed complaints never alert', () => {
  const customers = chainCustomers();
  const area = createComplaint({ areaOutage: true, zone: 'Barrian', issueCategory: 'Fiber Cut', reportedAt: '2026-10-29T10:00' }, []);
  assert.equal(area.customerId, AREA_OUTAGE_CUSTOMER_ID);
  assert.equal(complaintDaisyChainAlert(customers, area), null);
  assert.equal(complaintDaisyChainAlert(customers, null), null);
  assert.equal(complaintDaisyChainAlert(customers, {}), null);
  assert.equal(complaintDaisyChainAlert(customers, complaintFor('cust-ghost')), null);
});

test('SISP-49: stored feeder cycle terminates — each home listed once, source never listed', () => {
  const customers = [
    customer('cust-a', 'Test Feeder A', { upstreamCustomerId: 'cust-b' }),
    customer('cust-b', 'Test Home B', { upstreamCustomerId: 'cust-a' })
  ];
  const alert = buildDaisyChainAlert(customers, 'cust-a');
  assert.ok(alert);
  assert.deepEqual(alert.impacted.map((e) => e.customer.id), ['cust-b']);
});

test('SISP-49: archived middle house is traversed through but never listed', () => {
  const customers = [
    customer('cust-a', 'Test Feeder A'),
    customer('cust-b', 'Test Home B', { upstreamCustomerId: 'cust-a', archived: true }),
    customer('cust-c', 'Test Home C', { upstreamCustomerId: 'cust-b' })
  ];
  const alert = buildDaisyChainAlert(customers, 'cust-a');
  assert.deepEqual(alert.impacted.map((e) => e.customer.id), ['cust-c']);
});

test('SISP-49: banner list is exactly the bulk-notification queue for the same source', () => {
  const customers = chainCustomers();
  const alert = buildDaisyChainAlert(customers, 'cust-a');
  const queue = buildOutageQueue(customers, 'cust-a');
  assert.deepEqual(
    alert.impacted.map((e) => e.customer.id),
    queue.impacted.map((e) => e.customer.id)
  );
  assert.deepEqual(traceDownstreamImpact(customers, 'cust-a').map((c) => c.id), ['cust-b', 'cust-c']);
});

test('SISP-49: wa.me draft links follow the SISP-7 rule (international number links, local 03xx does not)', () => {
  const alert = buildDaisyChainAlert(chainCustomers(), 'cust-a');
  const byId = Object.fromEntries(alert.impacted.map((e) => [e.customer.id, e.whatsappLink]));
  assert.equal(byId['cust-b'], 'https://wa.me/923001234567');
  assert.equal(byId['cust-c'], null); // 0300… local number: no guessed country code
});

test('SISP-49: banner logic never mutates complaints or customers (frozen inputs, byte-identical)', () => {
  const customers = chainCustomers();
  const complaints = [complaintFor('cust-a'), complaintFor('cust-b', 'In Progress', 'Test Home B')];
  const before = JSON.stringify({ customers, complaints });
  deepFreeze(customers);
  deepFreeze(complaints);
  for (const complaint of complaints) {
    const alert = complaintDaisyChainAlert(customers, complaint);
    assert.ok(alert);
    void alert.impacted.map((e) => e.customer.name).join(',');
  }
  assert.equal(JSON.stringify({ customers, complaints }), before);
});
