// SISP-188: Reverse Daisy-Chain "Upstream Power-Host / Parent Check"
// Banner. Pure-function tests on synthetic data only. Spec: when
// viewing or logging a complaint for a customer with an
// upstreamCustomerId chain, an inline "⬆️ Upstream Feeder Chain"
// banner lists each ancestor home and warns if any upstream ancestor
// already has an open complaint in the register.
//
// Decisions pinned here (spec silent, stated in the build report):
// - "Open" means exactly what each ledger means: status Open or
//   In Progress; a Resolved record never warns.
// - Both complaint seams are consulted — the SISP-15 register and
//   the SISP-12 field tickets. A SISP-44 linked pair (ticket with
//   complaintId = a register complaint of the same home) is ONE
//   fault event and is counted once, via the register entry; an open
//   ticket whose linked complaint is already Resolved still counts
//   on its own (the field side was reopened — real open work).
// - Archived ancestors are traversed through AND listed (the chain
//   physically passes through their converter), and their open
//   complaints warn — the register itself keeps archived customers'
//   complaints visible, so the banner matches the register.
// - The register-card wrapper follows SISP-49's live-fault gate:
//   the banner shows only while the complaint is unresolved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUpstreamChainCheck,
  traceUpstreamChain
} from '../outage-impact.js';
import {
  AREA_OUTAGE_CUSTOMER_ID,
  complaintUpstreamChainAlert,
  createComplaint
} from '../complaint-register.js';
import { TRANSLATIONS } from '../nav-language.js';

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

// Root A feeds B, B feeds C, C feeds D (D is downstream of C).
function chainCustomers() {
  return [
    customer('cust-a', 'Test Feeder A', { fiberZone: 'Side 1' }),
    customer('cust-b', 'Test Home B', { upstreamCustomerId: 'cust-a', fiberZone: 'Side 1' }),
    customer('cust-c', 'Test Home C', { upstreamCustomerId: 'cust-b', fiberZone: 'Side 1' }),
    customer('cust-d', 'Test Home D', { upstreamCustomerId: 'cust-c', fiberZone: 'Side 1' })
  ];
}

function complaint(id, customerId, extra = {}) {
  return {
    id,
    customerId,
    customerName: '',
    zone: '',
    issueCategory: 'Fiber Cut',
    reportedAt: '2026-10-29T10:00',
    resolvedAt: '',
    downtimeHours: null,
    downtimeManual: false,
    status: 'Open',
    resolutionNote: '',
    resolvedViaTicketId: '',
    syncReopenGuard: '',
    createdAt: '',
    ...extra
  };
}

function ticket(id, customerId, extra = {}) {
  return {
    id,
    customerId,
    customerName: '',
    complaintId: '',
    faultPreset: 'Media Converter / Charger Off',
    customFault: '',
    technician: '',
    priority: 'Normal',
    status: 'Open',
    createdAt: '2026-10-29T09:00',
    resolvedAt: '',
    note: '',
    ...extra
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

test('SISP-188: upstream chain walks nearest-first from the subject to the root', () => {
  const customers = chainCustomers();
  assert.deepEqual(traceUpstreamChain(customers, 'cust-c').map((c) => c.id), ['cust-b', 'cust-a']);
  assert.deepEqual(traceUpstreamChain(customers, 'cust-d').map((c) => c.id), ['cust-c', 'cust-b', 'cust-a']);
  assert.deepEqual(traceUpstreamChain(customers, 'cust-b').map((c) => c.id), ['cust-a']);
});

test('SISP-188: root-fed and unknown customers have no chain', () => {
  const customers = chainCustomers();
  assert.deepEqual(traceUpstreamChain(customers, 'cust-a'), []);
  assert.deepEqual(traceUpstreamChain(customers, 'cust-missing'), []);
  assert.deepEqual(traceUpstreamChain([], 'cust-a'), []);
  assert.deepEqual(traceUpstreamChain(null, 'cust-a'), []);
});

test('SISP-188: check returns the subject, ancestors with depths, and an honest empty result', () => {
  const customers = chainCustomers();
  const check = buildUpstreamChainCheck(customers, 'cust-c');
  assert.equal(check.customer.id, 'cust-c');
  assert.equal(check.count, 2);
  assert.deepEqual(check.ancestors.map((e) => [e.customer.id, e.depth]), [['cust-b', 1], ['cust-a', 2]]);
  assert.deepEqual(check.warnings, []);
  assert.equal(check.hasOpenUpstreamComplaint, false);

  const solo = buildUpstreamChainCheck(customers, 'cust-a');
  assert.ok(solo); // known customer, no chain — an empty result, not null
  assert.equal(solo.count, 0);
  assert.deepEqual(solo.ancestors, []);
  assert.equal(solo.hasOpenUpstreamComplaint, false);

  assert.equal(buildUpstreamChainCheck(customers, 'cust-missing'), null);
  assert.equal(buildUpstreamChainCheck(null, 'cust-a'), null);
});

test('SISP-188: stored feeder cycle terminates — each ancestor listed once, subject never listed', () => {
  const customers = [
    customer('cust-a', 'Test Feeder A', { upstreamCustomerId: 'cust-b' }),
    customer('cust-b', 'Test Home B', { upstreamCustomerId: 'cust-a' })
  ];
  assert.deepEqual(traceUpstreamChain(customers, 'cust-a').map((c) => c.id), ['cust-b']);
  assert.deepEqual(traceUpstreamChain(customers, 'cust-b').map((c) => c.id), ['cust-a']);
  const check = buildUpstreamChainCheck(customers, 'cust-a');
  assert.equal(check.count, 1);
});

test('SISP-188: self-link and dangling upstream id end the chain without inventing homes', () => {
  const customers = [
    customer('cust-a', 'Test Feeder A', { upstreamCustomerId: 'cust-a' }),
    customer('cust-b', 'Test Home B', { upstreamCustomerId: 'cust-ghost' })
  ];
  assert.deepEqual(traceUpstreamChain(customers, 'cust-a'), []);
  assert.deepEqual(traceUpstreamChain(customers, 'cust-b'), []);
});

test('SISP-188: open register complaint on an ancestor warns with its recorded id, category and status', () => {
  const customers = chainCustomers();
  const complaints = [complaint('CMP-101', 'cust-b', { issueCategory: 'Fiber Cut', status: 'Open' })];
  const check = buildUpstreamChainCheck(customers, 'cust-c', { complaints });
  assert.equal(check.hasOpenUpstreamComplaint, true);
  assert.equal(check.warnings.length, 1);
  const [warning] = check.warnings;
  assert.equal(warning.customer.id, 'cust-b');
  assert.equal(warning.depth, 1);
  assert.deepEqual(warning.issue, { source: 'complaint', id: 'CMP-101', label: 'Fiber Cut', status: 'Open' });
  // The issue rides on the ancestor entry too.
  assert.equal(check.ancestors[0].openIssues.length, 1);
  assert.equal(check.ancestors[1].openIssues.length, 0);
});

test('SISP-188: In Progress warns too; Resolved never warns', () => {
  const customers = chainCustomers();
  const inProgress = buildUpstreamChainCheck(customers, 'cust-c', {
    complaints: [complaint('CMP-101', 'cust-a', { status: 'In Progress' })]
  });
  assert.equal(inProgress.warnings.length, 1);
  assert.equal(inProgress.warnings[0].issue.status, 'In Progress');

  const resolved = buildUpstreamChainCheck(customers, 'cust-c', {
    complaints: [complaint('CMP-101', 'cust-b', { status: 'Resolved', resolvedAt: '2026-10-29T14:00' })],
    tickets: [ticket('TKT-101', 'cust-a', { status: 'Resolved' })]
  });
  assert.equal(resolved.hasOpenUpstreamComplaint, false);
  assert.deepEqual(resolved.warnings, []);
});

test('SISP-188: complaints of the subject itself, downstream homes and strangers never warn', () => {
  const customers = chainCustomers();
  const check = buildUpstreamChainCheck(customers, 'cust-c', {
    complaints: [
      complaint('CMP-101', 'cust-c'), // the subject's own complaint
      complaint('CMP-102', 'cust-d'), // downstream of the subject
      complaint('CMP-103', 'cust-z') // not in the chain at all
    ],
    tickets: [ticket('TKT-101', 'cust-d')]
  });
  assert.equal(check.hasOpenUpstreamComplaint, false);
  assert.deepEqual(check.warnings, []);
});

test('SISP-188: an unlinked open field ticket on an ancestor warns with the ticket fault label', () => {
  const customers = chainCustomers();
  const check = buildUpstreamChainCheck(customers, 'cust-c', {
    tickets: [ticket('TKT-101', 'cust-a', { faultPreset: 'Fiber Splice Loss' })]
  });
  assert.equal(check.warnings.length, 1);
  assert.deepEqual(check.warnings[0].issue, { source: 'ticket', id: 'TKT-101', label: 'Fiber Splice Loss', status: 'Open' });
  assert.equal(check.warnings[0].customer.id, 'cust-a');
  assert.equal(check.warnings[0].depth, 2);
});

test('SISP-188: SISP-44 linked pair counts ONCE, via the register entry', () => {
  const customers = chainCustomers();
  const check = buildUpstreamChainCheck(customers, 'cust-c', {
    complaints: [complaint('CMP-101', 'cust-b', { issueCategory: 'WAPDA / Power Outage' })],
    tickets: [ticket('TKT-101', 'cust-b', { complaintId: 'CMP-101' })]
  });
  assert.equal(check.warnings.length, 1);
  assert.deepEqual(check.warnings[0].issue, { source: 'complaint', id: 'CMP-101', label: 'WAPDA / Power Outage', status: 'Open' });
});

test('SISP-188: open ticket whose linked complaint is Resolved still counts once, via the ticket', () => {
  const customers = chainCustomers();
  const check = buildUpstreamChainCheck(customers, 'cust-c', {
    complaints: [complaint('CMP-101', 'cust-b', { status: 'Resolved', resolvedAt: '2026-10-29T14:00' })],
    tickets: [ticket('TKT-101', 'cust-b', { complaintId: 'CMP-101', status: 'In Progress' })]
  });
  assert.equal(check.warnings.length, 1);
  assert.equal(check.warnings[0].issue.source, 'ticket');
  assert.equal(check.warnings[0].issue.id, 'TKT-101');
});

test('SISP-188: every open record on an ancestor warns — two complaints, two warnings', () => {
  const customers = chainCustomers();
  const check = buildUpstreamChainCheck(customers, 'cust-c', {
    complaints: [
      complaint('CMP-101', 'cust-b'),
      complaint('CMP-102', 'cust-b', { issueCategory: 'Router / Wi-Fi Config', status: 'In Progress' })
    ]
  });
  assert.equal(check.warnings.length, 2);
  assert.deepEqual(check.warnings.map((w) => w.issue.id), ['CMP-101', 'CMP-102']);
});

test('SISP-188: archived middle home is traversed through, listed, and its open complaint warns', () => {
  const customers = [
    customer('cust-a', 'Test Feeder A'),
    customer('cust-b', 'Test Home B', { upstreamCustomerId: 'cust-a', archived: true }),
    customer('cust-c', 'Test Home C', { upstreamCustomerId: 'cust-b' })
  ];
  const check = buildUpstreamChainCheck(customers, 'cust-c', {
    complaints: [complaint('CMP-101', 'cust-b')]
  });
  assert.deepEqual(check.ancestors.map((e) => e.customer.id), ['cust-b', 'cust-a']);
  assert.equal(check.warnings.length, 1);
  assert.equal(check.warnings[0].customer.id, 'cust-b');
});

test('SISP-188: area-outage records belong to no home and never attach to an ancestor', () => {
  const customers = chainCustomers();
  const area = createComplaint({ areaOutage: true, zone: 'Barrian', issueCategory: 'Fiber Cut', reportedAt: '2026-10-29T10:00' }, []);
  assert.equal(area.customerId, AREA_OUTAGE_CUSTOMER_ID);
  const check = buildUpstreamChainCheck(customers, 'cust-c', { complaints: [area] });
  assert.equal(check.hasOpenUpstreamComplaint, false);
});

test('SISP-188: register wrapper gates like SISP-49 — unresolved only, real chain only', () => {
  const customers = chainCustomers();
  const open = { ...complaint('CMP-201', 'cust-c'), status: 'Open' };
  const check = complaintUpstreamChainAlert(customers, open, { complaints: [complaint('CMP-101', 'cust-b')] });
  assert.ok(check);
  assert.equal(check.count, 2);
  assert.equal(check.warnings.length, 1);

  assert.ok(complaintUpstreamChainAlert(customers, { ...open, status: 'In Progress' }));
  assert.equal(complaintUpstreamChainAlert(customers, { ...open, status: 'Resolved' }), null);

  const area = createComplaint({ areaOutage: true, zone: 'Barrian', issueCategory: 'Fiber Cut', reportedAt: '2026-10-29T10:00' }, []);
  assert.equal(complaintUpstreamChainAlert(customers, area), null);
  // Root customer: no ancestors, no banner.
  assert.equal(complaintUpstreamChainAlert(customers, complaint('CMP-202', 'cust-a')), null);
  // Unknown customer and malformed complaints.
  assert.equal(complaintUpstreamChainAlert(customers, complaint('CMP-203', 'cust-ghost')), null);
  assert.equal(complaintUpstreamChainAlert(customers, null), null);
  assert.equal(complaintUpstreamChainAlert(customers, {}), null);
});

test('SISP-188: derivation never mutates customers, complaints or tickets (frozen inputs, byte-identical)', () => {
  const customers = chainCustomers();
  const complaints = [complaint('CMP-101', 'cust-b'), complaint('CMP-102', 'cust-a', { status: 'Resolved' })];
  const tickets = [ticket('TKT-101', 'cust-b', { complaintId: 'CMP-101' }), ticket('TKT-102', 'cust-a')];
  const before = JSON.stringify({ customers, complaints, tickets });
  deepFreeze(customers);
  deepFreeze(complaints);
  deepFreeze(tickets);
  const check = buildUpstreamChainCheck(customers, 'cust-d', { complaints, tickets });
  assert.equal(check.count, 3);
  assert.equal(check.warnings.length, 2); // CMP-101 pair (once) + TKT-102
  assert.ok(complaintUpstreamChainAlert(customers, { ...complaint('CMP-201', 'cust-c') }, { complaints, tickets }));
  void traceUpstreamChain(customers, 'cust-d');
  assert.equal(JSON.stringify({ customers, complaints, tickets }), before);
});

test('SISP-188: banner strings exist in both dictionaries with matching placeholders', () => {
  for (const key of ['cmp_upchain_title', 'cmp_upchain_body', 'cmp_upchain_warn']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
  }
  assert.equal(TRANSLATIONS.en.cmp_upchain_title, 'Upstream Feeder Chain');
  const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  assert.deepEqual(placeholders(TRANSLATIONS.en.cmp_upchain_warn), ['detail', 'name']);
  assert.deepEqual(placeholders(TRANSLATIONS.ur.cmp_upchain_warn), placeholders(TRANSLATIONS.en.cmp_upchain_warn));
});
