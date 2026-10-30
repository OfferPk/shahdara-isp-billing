/**
 * field-dispatch-board.test.js — SISP-67 [P1]: Unified Zone Field
 * Dispatch Board.
 *
 * Spec criterion (read-latest.txt, SISP-67): "Having 1 open
 * complaint, 1 pending installation, and 1 pending work item in
 * 'Barrian' groups all 3 under the Barrian card and includes all 3 in
 * the WhatsApp dispatch summary."
 *
 * Pins:
 *  - the spec scenario exactly (complaint + installation + pending
 *    work all under the BARRIAN card, all 3 in the summary);
 *  - only OPEN items board: resolved complaints/tickets, installed
 *    requests and done works never appear;
 *  - an open ticket covers its linked open complaint (SISP-44 pair
 *    counts once, as the ticket); a complaint whose ticket resolved
 *    boards as a complaint again;
 *  - zones group by canonicalMohalla: spelling variants merge,
 *    aliases fold (Bani → BANII), non-canonical names keep their own
 *    group, zones with no open items never appear;
 *  - hardware recovery boards per disconnected customer holding
 *    unrecovered ISP-owned items, and clears once recovered;
 *  - AREA_OUTAGE complaints board under their recorded zone;
 *  - items with no resolvable zone land in one trailing unassigned
 *    group (nothing is silently dropped);
 *  - zones sort busiest first, unassigned always last;
 *  - dispatch URL: share-picker URL by default, direct wa.me chat
 *    link via formatWhatsAppUrl when a number is supplied;
 *  - read-only: building the board mutates no source collection;
 *  - empty / malformed sources return an empty board, never throw;
 *  - i18n: every fdisp_* key exists in BOTH dictionaries with the
 *    same placeholders; wiring: section markup, app.js render call,
 *    token-only CSS, and build-graph reachability (perf budget #219).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFieldDispatchBoard,
  buildZoneDispatchSummary,
  buildZoneDispatchUrl,
  UNASSIGNED_ZONE_KEY
} from '../field-dispatch-board.js';
import { collectRuntimeFiles } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

let seq = 0;
const nid = (prefix) => `${prefix}${String(++seq).padStart(4, '0')}`;
const cust = (name, mohalla, extra = {}) => ({
  id: nid('cust-'), customerNumber: seq, name, mohalla, zone: '', archived: false, bills: [], ...extra
});
const complaint = (extra = {}) => ({
  id: nid('CMP-'), customerId: null, customerName: '', zone: '',
  issueCategory: 'Fiber Cut', reportedAt: '2026-10-28T09:00', status: 'Open', ...extra
});
const ticket = (extra = {}) => ({
  id: `TKT-${100 + (++seq)}`, customerId: '', customerName: '',
  faultPreset: 'Fiber Cut', priority: 'Normal', status: 'Open',
  createdAt: '2026-10-28T09:30', ...extra
});
const install = (extra = {}) => ({
  id: nid('REQ-'), requesterName: 'Synthetic Requester', customerId: '',
  requestDate: '2026-10-27', amountPaid: 0, payMethod: 'cash', installDate: '', ...extra
});
const work = (extra = {}) => ({
  id: nid('PW-'), note: '', source: '', threshold: null, status: 'pending',
  createdAt: '2026-10-27T10:00', ...extra
});

test('spec criterion: complaint + installation + pending work in Barrian group together and fill the summary', () => {
  const customer = cust('Synthetic Barrian User', 'BARRIAN');
  const board = buildFieldDispatchBoard({ customers: [customer] }, {
    complaints: [complaint({ customerId: customer.id, customerName: customer.name, zone: 'Barrian' })],
    installRequests: [install({ requesterName: customer.name, customerId: customer.id })],
    pendingWorks: [work({ note: 'Barrian pole 12 drop wire change karna hai' })]
  });

  assert.equal(board.zones.length, 1);
  const zone = board.zones[0];
  assert.equal(zone.key, 'barrian');
  assert.equal(zone.totalCount, 3);
  assert.deepEqual(zone.counts, { complaint: 1, ticket: 0, installation: 1, work: 1, recovery: 0 });
  assert.equal(board.totalOpen, 3);

  for (const title of ['Synthetic Barrian User', 'Barrian pole 12 drop wire change karna hai']) {
    assert.ok(zone.summary.includes(title), `summary includes "${title}"`);
  }
  assert.ok(zone.summary.includes('BARRIAN'), 'summary heads with the zone name');
  assert.ok(zone.summary.includes('Complaints (1)'));
  assert.ok(zone.summary.includes('New installations (1)'));
  assert.ok(zone.summary.includes('Pending works (1)'));
  assert.equal(zone.items.length, 3);
});

test('only open items board: resolved/installed/done rows are excluded', () => {
  const customer = cust('Synthetic Gangall User', 'GANGALL');
  const board = buildFieldDispatchBoard({ customers: [customer] }, {
    complaints: [
      complaint({ customerId: customer.id, status: 'Resolved' }),
      complaint({ customerId: customer.id, status: 'In Progress' })
    ],
    tickets: [ticket({ customerId: customer.id, status: 'Resolved' })],
    installRequests: [
      install({ customerId: customer.id, installDate: '2026-10-28' }),
      install({ customerId: customer.id })
    ],
    pendingWorks: [work({ note: 'Gangall box check', status: 'done' })]
  });
  assert.equal(board.totalOpen, 2);
  const zone = board.zones.find((z) => z.key === 'gangall');
  assert.equal(zone.counts.complaint, 1);
  assert.equal(zone.counts.installation, 1);
  assert.equal(zone.counts.ticket, 0);
  assert.equal(zone.counts.work, 0);
});

test('an open ticket covers its linked complaint; a resolved ticket releases it', () => {
  const customer = cust('Synthetic Thalii User', 'THALII');
  const linked = complaint({ id: 'CMP-900', customerId: customer.id, customerName: customer.name });

  const covered = buildFieldDispatchBoard({ customers: [customer] }, {
    complaints: [linked],
    tickets: [ticket({ customerId: customer.id, customerName: customer.name, complaintId: 'CMP-900' })]
  });
  assert.equal(covered.totalOpen, 1);
  assert.equal(covered.zones[0].counts.ticket, 1);
  assert.equal(covered.zones[0].counts.complaint, 0);

  const released = buildFieldDispatchBoard({ customers: [customer] }, {
    complaints: [linked],
    tickets: [ticket({ customerId: customer.id, complaintId: 'CMP-900', status: 'Resolved', resolvedAt: '2026-10-28T12:00' })]
  });
  assert.equal(released.totalOpen, 1);
  assert.equal(released.zones[0].counts.complaint, 1);
  assert.equal(released.zones[0].counts.ticket, 0);
});

test('zones group by canonicalMohalla: variants merge, aliases fold, custom areas keep their own group', () => {
  const a = cust('Variant One', 'Barrian');
  const b = cust('Variant Two', 'BARRIAN');
  const c = cust('Alias User', 'Bani');
  const d = cust('Custom Area User', 'HAVELI');
  const board = buildFieldDispatchBoard({ customers: [a, b, c, d] }, {
    complaints: [
      complaint({ customerId: a.id }),
      complaint({ customerId: b.id }),
      complaint({ customerId: c.id }),
      complaint({ customerId: d.id })
    ]
  });
  const byKey = Object.fromEntries(board.zones.map((z) => [z.key, z]));
  assert.equal(byKey.barrian.totalCount, 2);
  assert.equal(byKey.banii.totalCount, 1);
  assert.equal(byKey.banii.label, 'BANII');
  assert.equal(byKey.haveli.totalCount, 1);
  assert.equal(board.zones.length, 3, 'no empty canonical mohallas appear');
});

test('hardware recovery boards per disconnected customer and clears when recovered', () => {
  const gone = cust('Synthetic Gone User', 'NAKAR', {
    archived: true, routerOwnership: 'isp-owned', mediaConverterOwnership: 'customer-owned',
    hardwareRecovered: { router: null, mediaConverter: null }
  });
  const boarded = buildFieldDispatchBoard({ customers: [gone] }, {});
  assert.equal(boarded.zones.length, 1);
  assert.equal(boarded.zones[0].key, 'nakar');
  assert.equal(boarded.zones[0].counts.recovery, 1);
  assert.ok(boarded.zones[0].items[0].detail.includes('Router'));
  assert.ok(boarded.zones[0].summary.includes('Hardware recovery (1)'));

  const back = { ...gone, hardwareRecovered: { router: '2026-10-28', mediaConverter: null } };
  const cleared = buildFieldDispatchBoard({ customers: [back] }, {});
  assert.equal(cleared.totalOpen, 0);
});

test('AREA_OUTAGE complaints board under their recorded zone', () => {
  const board = buildFieldDispatchBoard({ customers: [] }, {
    complaints: [complaint({ customerId: 'AREA_OUTAGE', zone: 'Gangall', issueCategory: 'WAPDA / Power Outage' })]
  });
  assert.equal(board.zones.length, 1);
  assert.equal(board.zones[0].key, 'gangall');
  assert.equal(board.zones[0].items[0].title, 'Area outage · Gangall');
});

test('unresolvable zones land in one trailing unassigned group; zones sort busiest first', () => {
  const busy = cust('Busy Zone User', 'SODAA');
  const board = buildFieldDispatchBoard({ customers: [busy] }, {
    complaints: [complaint({ customerId: busy.id }), complaint({ customerId: busy.id })],
    installRequests: [install({ requesterName: 'Walk-in Requester' })],
    pendingWorks: [work({ note: 'General store se cable uthana hai' })]
  });
  assert.equal(board.zones.length, 2);
  assert.equal(board.zones[0].key, 'sodaa');
  assert.equal(board.zones[1].key, UNASSIGNED_ZONE_KEY);
  assert.equal(board.zones[1].totalCount, 2);
  assert.equal(board.unassignedCount, 2);
  assert.equal(board.totalOpen, 4, 'nothing is silently dropped');
});

test('dispatch URL: share URL by default, direct chat link with a valid number', () => {
  const customer = cust('Synthetic Barrian User', 'BARRIAN');
  const board = buildFieldDispatchBoard({ customers: [customer] }, {
    complaints: [complaint({ customerId: customer.id, customerName: customer.name })]
  });
  const zone = board.zones[0];
  assert.ok(zone.whatsappUrl.startsWith('https://wa.me/?text='));
  assert.equal(decodeURIComponent(zone.whatsappUrl.split('?text=')[1]), zone.summary);

  const direct = buildZoneDispatchUrl(zone, '0300 1234567');
  assert.ok(direct.startsWith('https://wa.me/923001234567?text='));
  assert.equal(decodeURIComponent(direct.split('?text=')[1]), zone.summary);

  assert.equal(buildZoneDispatchSummary(null), '');
  assert.equal(buildZoneDispatchUrl(null), '');
});

test('read-only: building the board mutates no source collection', () => {
  const customer = cust('Synthetic User', 'CHARYAA');
  const sources = {
    complaints: [complaint({ customerId: customer.id })],
    tickets: [ticket({ customerId: customer.id })],
    installRequests: [install({ customerId: customer.id })],
    pendingWorks: [work({ note: 'Charyaa joint box seal' })]
  };
  const snapshot = JSON.stringify(sources);
  buildFieldDispatchBoard({ customers: [customer] }, sources);
  assert.equal(JSON.stringify(sources), snapshot);
});

test('empty and malformed sources return an empty board, never throw', () => {
  assert.deepEqual(buildFieldDispatchBoard(null, null).zones, []);
  assert.deepEqual(buildFieldDispatchBoard({}, { complaints: 'junk', tickets: 42 }).zones, []);
  assert.equal(buildFieldDispatchBoard({ customers: 'nope' }, {}).totalOpen, 0);
});

test('i18n: every fdisp_* key exists in both dictionaries with the same placeholders', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('fdisp_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('fdisp_')).sort();
  assert.ok(enKeys.length >= 12, `expected the SISP-67 keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys, enKeys);
  for (const key of enKeys) {
    const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);
  }
});

test('wiring: dashboard section, render call, token-only styles, build-graph reachability', async () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['fieldDispatchHeading', 'fieldDispatchTotal', 'fieldDispatchList']) {
    assert.ok(index.includes(`id="${id}"`), `index.html carries #${id}`);
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './field-dispatch-board.js'"), 'app.js imports the dispatch board');
  assert.ok(app.includes('buildFieldDispatchBoard(state, {'), 'renderDashboard builds the board');

  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-67'));
  assert.ok(block.includes('.field-dispatch-zone'), 'dispatch styles shipped');
  assert.ok(block.includes('var(--modal-surface)') || block.includes('var(--surface)'), 'dispatch styles use theme tokens');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-67 styles use theme tokens only, no hex');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('field-dispatch-board.js'), 'dispatch board is in the runtime graph');
});
