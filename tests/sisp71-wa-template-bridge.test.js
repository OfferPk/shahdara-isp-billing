// SISP-71: WhatsApp Template Studio Global Module Bridge.
// The SISP-25 studio templates (sisp_wa_templates_v1) now speak inside the
// modules that generate WhatsApp drafts: the SISP-3 Waada / Reminders
// queue (Broken Waada Alert + Polite Reminder), the promise follow-up,
// the SISP-7 outage tool (Outage Notice) and the receipt-side Payment
// Received / Bill Notice helpers. A template only replaces built-in
// wording once the operator has actually customized it — untouched
// templates fall back safely to the existing default text, and rendering
// never emits a raw {placeholder} or "undefined".
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WA_PLACEHOLDER_KEYS,
  getWaTemplates,
  saveWaTemplates,
  updateWaTemplate,
  resolveWaTemplateValues,
  renderWaTemplate,
  isWaTemplateCustomized,
  renderCustomWaTemplate
} from '../whatsapp-templates.js';
import { waadaTemplateIdForTier, WAADA_TIERS } from '../waada-queue.js';
import { createInitialState, saveBillMonth } from '../core.js';
import {
  DEFAULT_REMINDER_STAGES,
  getRemindersTodayQueue,
  formatPromiseFollowupWhatsApp
} from '../reminder-queue.js';
import {
  OUTAGE_MESSAGE_ROMAN,
  OUTAGE_MESSAGE_URDU,
  buildOutageQueue,
  buildOutageQueueText
} from '../outage-impact.js';
import {
  buildReceiptPaymentReceivedMessage,
  buildReceiptBillNoticeMessage
} from '../receipt.js';

const mockStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
};

const customer = (overrides = {}) => ({
  id: 'c1', name: 'Ahmed', nameUrdu: 'احمد', customerNumber: 1, connectionId: 'SH-001',
  packageSpeed: '5 Mbps', zone: 'North', fiberZone: 'Side 2', phone: '03001234567',
  promiseDate: '2026-01-01',
  ...overrides
});

// --- {zone} placeholder -----------------------------------------------------

test('SISP-71: {zone} is a first-class placeholder (extras > customer.zone > fiberZone)', () => {
  assert.ok(WA_PLACEHOLDER_KEYS.includes('zone'));
  assert.equal(resolveWaTemplateValues(customer(), {}).zone, 'North');
  assert.equal(resolveWaTemplateValues(customer({ zone: '' }), {}).zone, 'Side 2');
  assert.equal(resolveWaTemplateValues(customer(), { zone: 'Override' }).zone, 'Override');
  const out = renderWaTemplate('Zone: {zone} / {name}', resolveWaTemplateValues(customer(), {}));
  assert.equal(out, 'Zone: North / Ahmed');
  assert.ok(!out.includes('{'), 'no raw placeholder left behind');
});

// --- Bridge core: customized-only rendering ---------------------------------

test('SISP-71: renderCustomWaTemplate returns null for untouched templates', () => {
  const templates = getWaTemplates(mockStorage());
  assert.equal(isWaTemplateCustomized(templates, 'brokenWaada'), false);
  assert.equal(renderCustomWaTemplate(templates, 'brokenWaada', customer(), { totalDue: 1500 }), null);
  assert.equal(renderCustomWaTemplate(templates, 'outageNotice', customer(), {}, 'urdu'), null);
  assert.equal(renderCustomWaTemplate(templates, 'noSuchId', customer(), {}), null);
});

test('SISP-71: renderCustomWaTemplate renders a customized template with live values', () => {
  const storage = mockStorage();
  updateWaTemplate(storage, 'brokenWaada', { roman: 'CUSTOM {name} {totalDue} {waadaDate} {zone}' });
  const templates = getWaTemplates(storage);
  assert.equal(isWaTemplateCustomized(templates, 'brokenWaada'), true);
  assert.equal(isWaTemplateCustomized(templates, 'politeReminder'), false);
  const out = renderCustomWaTemplate(templates, 'brokenWaada', customer(), { totalDue: 1500 });
  assert.equal(out, 'CUSTOM Ahmed PKR 1,500 2026-01-01 North');
  assert.ok(!out.includes('undefined'));
});

test('SISP-71: a customized template that renders empty falls back (null)', () => {
  const storage = mockStorage();
  updateWaTemplate(storage, 'politeReminder', { roman: '{totalDue}' });
  const templates = getWaTemplates(storage);
  assert.equal(renderCustomWaTemplate(templates, 'politeReminder', customer(), {}), null);
  assert.equal(renderCustomWaTemplate(templates, 'politeReminder', customer(), { totalDue: 900 }), 'PKR 900');
});

// --- Tier mapping ------------------------------------------------------------

test('SISP-71: waadaTemplateIdForTier maps broken -> brokenWaada, others -> politeReminder', () => {
  assert.equal(waadaTemplateIdForTier(WAADA_TIERS.BROKEN), 'brokenWaada');
  assert.equal(waadaTemplateIdForTier(WAADA_TIERS.ACTIVE), 'politeReminder');
  assert.equal(waadaTemplateIdForTier(WAADA_TIERS.PROMISED), 'politeReminder');
  assert.equal(waadaTemplateIdForTier('unknown'), null);
  assert.equal(waadaTemplateIdForTier(null), null);
});

// --- PIN: Broken Waada queue draft URL follows the studio template ----------

const SAMPLE_NAMES = Array.from({ length: 74 }, (_, i) => `Test Customer ${String(i + 1).padStart(2, '0')}`);
const withPromise = (state, customerId, promise) => ({
  ...state,
  customers: state.customers.map(c => c.id === customerId ? { ...c, ...promise } : c)
});
const pricedBill = (state, customerId, month, dueAmount, refDate) =>
  saveBillMonth(state, customerId, { month, dueAmount, dueDate: `${month}-05`, status: 'pending' }, refDate);
const octoberReference = new Date(2026, 9, 20, 12);

function brokenQueueState() {
  let state = createInitialState(SAMPLE_NAMES);
  state = pricedBill(state, 'seed-001', '2026-10', '3000', octoberReference);
  state = pricedBill(state, 'seed-002', '2026-10', '5000', octoberReference);
  state = withPromise(state, 'seed-001', { promiseDate: '2026-10-10' });
  // A valid international number so the queue generates a real wa.me draft.
  state = {
    ...state,
    customers: state.customers.map(c => c.id === 'seed-001' ? { ...c, phone: '+923001234567' } : c)
  };
  return state;
}

test('SISP-71 PIN: customizing the Broken Waada Alert immediately updates the queue draft URL', () => {
  const storage = mockStorage();
  saveWaTemplates(storage, [{ id: 'brokenWaada', roman: 'CUSTOM BROKEN {name} {totalDue} {waadaDate}', urdu: '' }]);
  const queue = getRemindersTodayQueue(brokenQueueState(), {
    todayString: '2026-10-28',
    stages: DEFAULT_REMINDER_STAGES,
    storage
  });
  const broken = queue.queue.find(e => e.customerId === 'seed-001');
  assert.ok(broken, 'broken-waada customer is queued');
  assert.equal(broken.waadaTier, WAADA_TIERS.BROKEN);
  assert.equal(broken.messageText, 'CUSTOM BROKEN Test Customer 01 PKR 3,000 2026-10-10');
  assert.ok(broken.whatsappUrl, 'draft URL generated');
  assert.ok(decodeURIComponent(broken.whatsappUrl).includes('CUSTOM BROKEN Test Customer 01'));

  // A later studio edit is picked up by the very next queue build.
  updateWaTemplate(storage, 'brokenWaada', { roman: 'CHANGED {name}' });
  const rebuilt = getRemindersTodayQueue(brokenQueueState(), {
    todayString: '2026-10-28',
    stages: DEFAULT_REMINDER_STAGES,
    storage
  });
  assert.equal(rebuilt.queue.find(e => e.customerId === 'seed-001').messageText, 'CHANGED Test Customer 01');
});

test('SISP-71: untouched studio keeps the built-in queue wording and URL', () => {
  const queue = getRemindersTodayQueue(brokenQueueState(), {
    todayString: '2026-10-28',
    stages: DEFAULT_REMINDER_STAGES,
    storage: mockStorage()
  });
  const broken = queue.queue.find(e => e.customerId === 'seed-001');
  assert.ok(broken.messageText.includes('Shahdara ISP'), 'built-in stage text preserved');
  assert.ok(!broken.messageText.includes('CUSTOM'));
  assert.ok(decodeURIComponent(broken.whatsappUrl).includes('FINAL NOTICE'),
    'draft URL carries the built-in message');
});

test('SISP-71: customized Polite Reminder speaks for due-stage queue entries only', () => {
  let state = createInitialState(SAMPLE_NAMES);
  state = pricedBill(state, 'seed-001', '2026-10', '3000', octoberReference);
  state = pricedBill(state, 'seed-002', '2026-10', '2000', octoberReference);
  state = withPromise(state, 'seed-001', { promiseDate: '2026-10-03' });
  const storage = mockStorage();
  saveWaTemplates(storage, [{ id: 'politeReminder', roman: 'POLITE CUSTOM {name} {totalDue}', urdu: '' }]);
  const queue = getRemindersTodayQueue(state, {
    todayString: '2026-10-05',
    stages: DEFAULT_REMINDER_STAGES,
    storage
  });
  const due = queue.queue.find(e => e.customerId === 'seed-002');
  assert.ok(due, 'due-stage customer is queued on the due date');
  assert.equal(due.templateType, 'due');
  assert.equal(due.messageText, 'POLITE CUSTOM Test Customer 02 PKR 2,000');
  const broken = queue.queue.find(e => e.customerId === 'seed-001');
  assert.ok(broken, 'broken customer still queued');
  assert.ok(!broken.messageText.includes('POLITE CUSTOM'), 'broken entry is not polite-reminded');
});

// --- Promise follow-up bridge -------------------------------------------------

test('SISP-71: broken promise follow-up uses a customized Broken Waada Alert', () => {
  const storage = mockStorage();
  updateWaTemplate(storage, 'brokenWaada', { roman: 'FOLLOWUP {name} {totalDue} {waadaDate}' });
  const msg = formatPromiseFollowupWhatsApp(
    { customerName: 'Ahmed', promisedAmount: 2500, promisedDate: '2026-01-01', isBroken: true },
    null,
    getWaTemplates(storage)
  );
  assert.equal(msg, 'FOLLOWUP Ahmed PKR 2,500 2026-01-01');
});

test('SISP-71: broken promise follow-up keeps built-in bilingual text by default', () => {
  const msg = formatPromiseFollowupWhatsApp(
    { customerName: 'Ahmed', promisedAmount: 2500, promisedDate: '2026-01-01', isBroken: true },
    null,
    getWaTemplates(mockStorage())
  );
  assert.ok(msg.includes('Wada / Promise-to-Pay Reminder'));
  assert.ok(msg.includes('PKR 2,500'));
});

// --- Outage bridge --------------------------------------------------------------

const house = (id, overrides = {}) => ({
  id,
  name: `House ${id}`,
  mohalla: 'Shahdara Town',
  phone: '+923001234567',
  archived: false,
  upstreamCustomerId: '',
  fiberZone: '',
  packageSpeed: '10 Mbps',
  ...overrides
});
const chain = () => ([
  house('A'),
  house('B', { upstreamCustomerId: 'A', fiberZone: 'Side 1' }),
  house('C', { upstreamCustomerId: 'B', fiberZone: 'Side 1' })
]);

test('SISP-71: outage queue keeps the spec-verbatim message when the studio is untouched', () => {
  const queue = buildOutageQueue(chain(), 'A', { templates: getWaTemplates(mockStorage()) });
  assert.deepEqual(queue.impacted.map(e => e.message), [OUTAGE_MESSAGE_ROMAN, OUTAGE_MESSAGE_ROMAN]);
  const bare = buildOutageQueue(chain(), 'A');
  assert.deepEqual(bare.impacted.map(e => e.message), [OUTAGE_MESSAGE_ROMAN, OUTAGE_MESSAGE_ROMAN]);
});

test('SISP-71: customized Outage Notice renders per subscriber with {name} and {zone}', () => {
  const storage = mockStorage();
  updateWaTemplate(storage, 'outageNotice', { roman: 'OUTAGE CUSTOM {name} zone {zone} pkg {package}' });
  const templates = getWaTemplates(storage);
  const queue = buildOutageQueue(chain(), 'A', { templates });
  assert.deepEqual(queue.impacted.map(e => e.message), [
    'OUTAGE CUSTOM House B zone Side 1 pkg 10 Mbps',
    'OUTAGE CUSTOM House C zone Side 1 pkg 10 Mbps'
  ]);
  const text = buildOutageQueueText(queue);
  assert.ok(text.includes('House B: OUTAGE CUSTOM House B'));
  assert.ok(text.includes('House C: OUTAGE CUSTOM House C'));
});

test('SISP-71: customized Urdu Outage Notice renders in the Urdu variant', () => {
  const storage = mockStorage();
  updateWaTemplate(storage, 'outageNotice', { urdu: 'اردو اطلاع {name}' });
  const templates = getWaTemplates(storage);
  const queue = buildOutageQueue(chain(), 'A', { urdu: true, templates });
  assert.deepEqual(queue.impacted.map(e => e.message), ['اردو اطلاع House B', 'اردو اطلاع House C']);
  const romanQueue = buildOutageQueue(chain(), 'A', { templates });
  assert.deepEqual(romanQueue.impacted.map(e => e.message), [OUTAGE_MESSAGE_ROMAN, OUTAGE_MESSAGE_ROMAN],
    'roman variant untouched, so the roman queue still uses the verbatim text');
  assert.notEqual(OUTAGE_MESSAGE_URDU, '');
});

// --- Receipt bridge helpers -----------------------------------------------------

test('SISP-71: receipt helpers return null until the studio is customized', () => {
  const templates = getWaTemplates(mockStorage());
  assert.equal(buildReceiptPaymentReceivedMessage(customer(), { amount: 1500 }, templates), null);
  assert.equal(buildReceiptBillNoticeMessage(customer(), { totalDue: 1500 }, templates), null);
});

test('SISP-71: customized Payment Received / Bill Generated render via the receipt helpers', () => {
  const storage = mockStorage();
  updateWaTemplate(storage, 'paymentReceived', { roman: 'RECEIVED {name} {totalDue}' });
  updateWaTemplate(storage, 'billGenerated', { roman: 'BILL {name} {package} {totalDue} {zone}' });
  const templates = getWaTemplates(storage);
  assert.equal(
    buildReceiptPaymentReceivedMessage(customer(), { amount: 1500 }, templates),
    'RECEIVED Ahmed PKR 1,500'
  );
  assert.equal(
    buildReceiptBillNoticeMessage(customer(), { totalDue: 2000 }, templates),
    'BILL Ahmed 5 Mbps PKR 2,000 North'
  );
});