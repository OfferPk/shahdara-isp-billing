import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createInitialState, addCustomer, saveBillMonth, addPayment } from '../core.js';
import { COMPLAINT_CATEGORIES, AREA_OUTAGE_CUSTOMER_ID } from '../complaint-register.js';
import { TICKET_PRESETS } from '../complaint-tickets.js';
import { getRemindersTodayQueue } from '../reminder-queue.js';
import { t, TRANSLATIONS } from '../nav-language.js';
import {
  FAULT_COMPLAINT_CATEGORIES,
  FAULT_TICKET_PRESETS,
  isFaultComplaint,
  isFaultTicket,
  buildFaultSuppressedCustomerIds,
  customerHasOpenFault,
  fixCollectDuePkr,
  fixCollectInfo,
  fixCollectBadgeHtml,
  runResolveAndCollect
} from '../fix-and-collect-bridge.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (name) => fs.readFileSync(path.join(repoRoot, name), 'utf8');

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index) => Array.from(store.keys())[index] || null
  };
}

/** Billing state built only through core's real recorders. */
function buildBillingState() {
  const refDate = new Date('2026-10-05T12:00:00Z');
  let state = createInitialState([]);

  // Unpaid: Sep 2,000 untouched + Oct 2,500 with a 500 part payment.
  state = addCustomer(state, 'Synthetic Unpaid', refDate, { phone: '03001110001' });
  const unpaid = state.customers[state.customers.length - 1];
  state = saveBillMonth(state, unpaid.id, { month: '2026-09', dueAmount: 2000, status: 'pending' }, refDate);
  state = saveBillMonth(state, unpaid.id, { month: '2026-10', dueAmount: 2500, status: 'pending' }, refDate);
  state = addPayment(state, unpaid.id, '2026-10', { amount: 500, date: '2026-10-03', method: 'Cash' }, refDate);

  // Paid up: Oct 2,200 paid in full.
  state = addCustomer(state, 'Synthetic Paid', refDate, { phone: '03001110002' });
  const paid = state.customers[state.customers.length - 1];
  state = saveBillMonth(state, paid.id, { month: '2026-10', dueAmount: 2200, status: 'pending' }, refDate);
  state = addPayment(state, paid.id, '2026-10', { amount: 2200, date: '2026-10-04', method: 'Cash' }, refDate);

  // FREE connection with a recorded (never billed) month on the record.
  state = addCustomer(state, 'Synthetic Free', refDate, { phone: '03001110003' });
  const free = state.customers[state.customers.length - 1];
  state = saveBillMonth(state, free.id, { month: '2026-10', dueAmount: 3000, status: 'pending' }, refDate);
  state.customers.find((c) => c.id === free.id).isFreeConnection = true;

  return { state, unpaidId: unpaid.id, paidId: paid.id, freeId: free.id };
}

test('SISP-163: fault sets are pinned to the canonical category/preset lists', () => {
  // Every register category except the catch-all 'Other' is a service
  // fault; if a future category appears upstream, this pin forces a
  // deliberate classification decision instead of a silent drift.
  assert.deepEqual([...FAULT_COMPLAINT_CATEGORIES], COMPLAINT_CATEGORIES.filter((c) => c !== 'Other'));
  assert.ok(!FAULT_COMPLAINT_CATEGORIES.includes('Other'));
  // Every shipped ticket preset is a service fault.
  assert.deepEqual([...FAULT_TICKET_PRESETS], [...TICKET_PRESETS]);
});

test('SISP-163: isFaultComplaint — open fault yes; resolved, Other, area outage no', () => {
  const base = { id: 'CMP-101', customerId: 'cust-1', issueCategory: 'Fiber Cut', status: 'Open', reportedAt: '2026-10-04T10:00' };
  assert.equal(isFaultComplaint(base), true);
  assert.equal(isFaultComplaint({ ...base, status: 'In Progress' }), true);
  assert.equal(isFaultComplaint({ ...base, status: 'Resolved' }), false);
  assert.equal(isFaultComplaint({ ...base, issueCategory: 'Other' }), false);
  assert.equal(isFaultComplaint({ ...base, issueCategory: 'WAPDA / Power Outage' }), true);
  assert.equal(isFaultComplaint({ ...base, issueCategory: 'Main Uplink / NayaPay Down' }), true);
  assert.equal(isFaultComplaint({ ...base, customerId: AREA_OUTAGE_CUSTOMER_ID }), false);
  assert.equal(isFaultComplaint({ ...base, customerId: '' }), false);
  assert.equal(isFaultComplaint(null), false);
});

test('SISP-163: isFaultTicket — presets yes; custom-fault-only and resolved no', () => {
  const base = { id: 'TKT-101', customerId: 'cust-1', faultPreset: 'Slow Speed / High Attenuation', customFault: '', status: 'Open' };
  assert.equal(isFaultTicket(base), true);
  assert.equal(isFaultTicket({ ...base, status: 'In Progress', faultPreset: 'Media Converter Power/Charger' }), true);
  assert.equal(isFaultTicket({ ...base, status: 'Resolved' }), false);
  // Free-text faults are unclassifiable: never treated as a service fault.
  assert.equal(isFaultTicket({ ...base, faultPreset: '', customFault: 'Billing dispute about last month' }), false);
  assert.equal(isFaultTicket(null), false);
});

test('SISP-163: suppressed id set comes from either ledger and mutates nothing', () => {
  const complaints = [
    { id: 'CMP-101', customerId: 'cust-1', issueCategory: 'Fiber Splice Loss', status: 'Open' },
    { id: 'CMP-102', customerId: 'cust-2', issueCategory: 'Other', status: 'Open' },
    { id: 'CMP-103', customerId: 'cust-3', issueCategory: 'Fiber Cut', status: 'Resolved' }
  ];
  const tickets = [
    { id: 'TKT-101', customerId: 'cust-4', faultPreset: 'CAT6 / RJ45 Fault', customFault: '', status: 'In Progress' },
    { id: 'TKT-102', customerId: 'cust-5', faultPreset: '', customFault: 'Customer says bill is wrong', status: 'Open' }
  ];
  const before = JSON.stringify({ complaints, tickets });
  const ids = buildFaultSuppressedCustomerIds(complaints, tickets);
  assert.deepEqual([...ids].sort(), ['cust-1', 'cust-4']);
  assert.equal(customerHasOpenFault(complaints, tickets, 'cust-1'), true);
  assert.equal(customerHasOpenFault(complaints, tickets, 'cust-2'), false);
  assert.equal(customerHasOpenFault(complaints, tickets, 'cust-3'), false);
  assert.equal(customerHasOpenFault(undefined, undefined, 'cust-1'), false);
  assert.equal(JSON.stringify({ complaints, tickets }), before);
});

test('SISP-163: badge detection — unpaid customer badges with the exact engine total', () => {
  const { state, unpaidId } = buildBillingState();
  const before = JSON.stringify(state);
  assert.equal(fixCollectDuePkr(state, unpaidId), 4000);
  const info = fixCollectInfo(state, unpaidId);
  assert.ok(info);
  assert.equal(info.duePkr, 4000);
  assert.match(info.badgeHtml, /fix-collect-badge/);
  assert.ok(info.badgeHtml.includes('PKR 4,000'), 'badge shows the exact amount');
  assert.ok(info.badgeHtml.includes('Fix &amp; Collect'), 'badge label is HTML-escaped like every other t() insertion in the modals');
  assert.ok(!info.badgeHtml.includes('fcx_badge'), 'badge never leaks a raw i18n key');
  assert.ok(info.collectLabel.includes('PKR 4,000'));
  assert.equal(JSON.stringify(state), before, 'derivation is read-only');
});

test('SISP-163: badge detection — paid-up, FREE and unknown customers never badge', () => {
  const { state, paidId, freeId } = buildBillingState();
  assert.equal(fixCollectDuePkr(state, paidId), 0);
  assert.equal(fixCollectInfo(state, paidId), null);
  assert.equal(fixCollectDuePkr(state, freeId), 0, 'FREE connections owe 0 by the owner rule');
  assert.equal(fixCollectInfo(state, freeId), null);
  assert.equal(fixCollectDuePkr(state, 'no-such-customer'), 0);
  assert.equal(fixCollectInfo(state, 'no-such-customer'), null);
  assert.equal(fixCollectBadgeHtml(0), '');
  assert.equal(fixCollectBadgeHtml(-100), '');
});

test('SISP-163: badge HTML renders the translated label in both languages', () => {
  assert.ok(t('fcx_badge', 'en', { amount: 'PKR 3,000' }).includes('Fix & Collect: PKR 3,000 Due'));
  assert.ok(t('fcx_badge', 'ur', { amount: 'PKR 3,000' }).includes('PKR 3,000'));
  const html = fixCollectBadgeHtml(3000);
  assert.ok(html.includes('PKR 3,000'));
});

test('SISP-163: runResolveAndCollect runs resolve first, then collect, in order', async () => {
  const events = [];
  const entry = { id: 'CMP-101', status: 'Resolved' };
  const result = await runResolveAndCollect({
    resolve: () => { events.push('resolve'); return entry; },
    launchCollect: (resolved) => { events.push('collect'); assert.equal(resolved, entry); return true; }
  });
  assert.deepEqual(events, ['resolve', 'collect']);
  assert.deepEqual(result, { resolved: true, collectLaunched: true, entry });
});

test('SISP-163: runResolveAndCollect — a failed resolve never opens collection', async () => {
  let collectCalls = 0;
  await assert.rejects(
    runResolveAndCollect({
      resolve: () => { throw new Error('Complaint could not be resolved.'); },
      launchCollect: () => { collectCalls++; return true; }
    }),
    /could not be resolved/
  );
  assert.equal(collectCalls, 0);

  const declined = await runResolveAndCollect({
    resolve: () => null,
    launchCollect: () => { collectCalls++; return true; }
  });
  assert.deepEqual(declined, { resolved: false, collectLaunched: false, entry: null });
  assert.equal(collectCalls, 0);
});

test('SISP-163: runResolveAndCollect — skipping collection never un-resolves', async () => {
  // The ticket record the resolve step flipped; the collect step is
  // then aborted (operator closes Quick Collect / collector missing).
  const ticket = { id: 'TKT-101', status: 'Open' };
  const skipped = await runResolveAndCollect({
    resolve: () => { ticket.status = 'Resolved'; return ticket; },
    launchCollect: () => false
  });
  assert.equal(skipped.resolved, true);
  assert.equal(skipped.collectLaunched, false);
  assert.equal(ticket.status, 'Resolved', 'an aborted collection leaves the resolve standing');

  const exploding = await runResolveAndCollect({
    resolve: () => ({ id: 'CMP-9', status: 'Resolved' }),
    launchCollect: () => { throw new Error('Quick Collect unavailable'); }
  });
  assert.equal(exploding.resolved, true);
  assert.equal(exploding.collectLaunched, false);
});

function queueState() {
  return {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Queue One', phone: '03001111111', customDueDate: 5, bills: [{ dueAmount: 1500, payments: [] }] },
      { id: 'c2', customerNumber: 2, name: 'Queue Two', phone: '03002222222', customDueDate: 5, bills: [{ dueAmount: 3500, payments: [] }] }
    ]
  };
}
const queueOptions = (extra = {}) => ({ todayString: '2026-10-05', storage: createMockStorage(), ...extra });

test('SISP-163: reminder queue is unchanged when no ledgers are passed', () => {
  const result = getRemindersTodayQueue(queueState(), queueOptions());
  assert.equal(result.totalCount, 2);
  assert.equal(result.suppressedCount, 0);
});

test('SISP-163: an open fault complaint pauses the reminder and is counted honestly', () => {
  const complaints = [
    { id: 'CMP-101', customerId: 'c1', issueCategory: 'Fiber Cut', status: 'Open', reportedAt: '2026-10-04T09:30' }
  ];
  const result = getRemindersTodayQueue(queueState(), queueOptions({ complaints }));
  assert.deepEqual(result.queue.map((q) => q.customerId), ['c2']);
  assert.equal(result.suppressedCount, 1);
  assert.equal(result.totalCount, 1);
});

test('SISP-163: non-fault categories do not suppress; closing the fault restores the customer', () => {
  const other = [
    { id: 'CMP-101', customerId: 'c1', issueCategory: 'Other', status: 'Open', reportedAt: '2026-10-04T09:30' }
  ];
  const withOther = getRemindersTodayQueue(queueState(), queueOptions({ complaints: other }));
  assert.equal(withOther.totalCount, 2);
  assert.equal(withOther.suppressedCount, 0);

  const resolved = [
    { id: 'CMP-101', customerId: 'c1', issueCategory: 'Fiber Cut', status: 'Resolved', reportedAt: '2026-10-04T09:30' }
  ];
  const afterClose = getRemindersTodayQueue(queueState(), queueOptions({ complaints: resolved }));
  assert.equal(afterClose.totalCount, 2, 'ticket closed → customer is back in the queue');
  assert.equal(afterClose.suppressedCount, 0);
});

test('SISP-163: an open fault ticket suppresses too; a custom-fault ticket does not', () => {
  const tickets = [
    { id: 'TKT-101', customerId: 'c2', faultPreset: 'Fiber Cut / Splice Loss', customFault: '', status: 'In Progress' }
  ];
  const result = getRemindersTodayQueue(queueState(), queueOptions({ tickets }));
  assert.deepEqual(result.queue.map((q) => q.customerId), ['c1']);
  assert.equal(result.suppressedCount, 1);

  const customOnly = [
    { id: 'TKT-102', customerId: 'c2', faultPreset: '', customFault: 'Billing question', status: 'Open' }
  ];
  const customResult = getRemindersTodayQueue(queueState(), queueOptions({ tickets: customOnly }));
  assert.equal(customResult.totalCount, 2);
  assert.equal(customResult.suppressedCount, 0);
});

test('SISP-163: every fcx_* key exists in both dictionaries with placeholders intact', () => {
  const keys = ['fcx_badge', 'fcx_resolve_collect_btn', 'fcx_collect_checkbox', 'fcx_suppressed_line', 'fcx_resolve_collect_failed'];
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
    assert.notEqual(t(key, 'en', { amount: 'PKR 1,000', count: 2 }), key);
    assert.notEqual(t(key, 'ur', { amount: 'PKR 1,000', count: 2 }), key);
  }
  assert.ok(t('fcx_suppressed_line', 'en', { count: 3 }).startsWith('3 '));
  assert.ok(t('fcx_collect_checkbox', 'en', { amount: 'PKR 1,500' }).includes('PKR 1,500'));
});

test('SISP-163: wiring pins — bridge stays out of the build entries, surfaces are connected', () => {
  const buildSource = readSource('build.mjs');
  const entriesSegment = buildSource.slice(buildSource.indexOf('ENTRY_FILES = ['), buildSource.indexOf('];', buildSource.indexOf('ENTRY_FILES = [')));
  assert.ok(!entriesSegment.includes('fix-and-collect-bridge'), 'bridge must ride the existing import graph, never a new entry');

  const queueSource = readSource('reminder-queue.js');
  assert.ok(queueSource.includes('buildFaultSuppressedCustomerIds'));
  assert.ok(queueSource.includes('suppressedCount'));

  const appSource = readSource('app.js');
  assert.ok(appSource.includes("from './fix-and-collect-bridge.js'"));
  assert.ok(appSource.includes('reminderQueueLedgerOptions'));
  assert.ok(appSource.includes('getFixCollect: (customerId) => fixCollectInfo(state, customerId)'));
  assert.ok(appSource.includes('runResolveAndCollect'));
  assert.ok(appSource.includes("t('fcx_suppressed_line'"));

  const registerSource = readSource('complaint-register.js');
  assert.ok(registerSource.includes('data-complaint-action="resolve-collect"'));
  assert.ok(registerSource.includes('getFixCollect'));

  const ticketsSource = readSource('complaint-tickets.js');
  assert.ok(ticketsSource.includes('data-resolve-collect'));
  assert.ok(ticketsSource.includes('getFixCollect'));
  // Re-pinned at SISP-163 reconciliation: the build-era "imports nothing"
  // pin predates SISP-84/123, whose merges gave complaint-tickets.js its
  // three leaf imports (nav-language / commercial-sla / root-cause-advisor).
  // The phase's own rule still holds: Fix & Collect arrives ONLY via the
  // getFixCollect callback — the module never imports the bridge or core.
  assert.ok(!ticketsSource.includes("from './fix-and-collect-bridge.js'"), 'complaint-tickets.js receives Fix & Collect via callback — it never imports the bridge');
  assert.ok(!ticketsSource.includes("from './core.js'"), 'complaint-tickets.js stays out of the core ledger module graph');
});
