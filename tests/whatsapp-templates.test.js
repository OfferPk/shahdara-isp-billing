import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WA_TEMPLATES_STORAGE_KEY, WA_TEMPLATE_IDS, WA_TEMPLATE_LABELS,
  DEFAULT_WA_TEMPLATES, getWaTemplates, getWaTemplate, saveWaTemplates,
  updateWaTemplate, sanitizeWaTemplates, resolveWaTemplateValues,
  renderWaTemplate, renderWaTemplateFor, buildPaymentReceivedMessage
} from '../whatsapp-templates.js';
import { buildCampaignQueue, markCustomerLastReminded } from '../reminder-queue.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';

// SISP-25: customizable Urdu / Roman Urdu WhatsApp templates with live
// customer placeholders, plus a 1-tap campaign queue that stamps
// lastRemindedAt only on a real send. Rendering never leaks "undefined"
// or a raw {placeholder} into an outgoing message.

const fakeStorage = (initial = null) => {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; }
  };
};

const customer = (overrides = {}) => ({
  id: 'c1', name: 'Ahmed', nameUrdu: 'احمد', customerNumber: 1, connectionId: 'SH-001',
  packageSpeed: '5 Mbps', zone: 'North', phone: '03001234567',
  bills: [{ dueAmount: 1500, payments: [] }],
  promiseDate: '2026-01-01',
  ...overrides
});

test('template studio: five types under the spec storage key, with defaults', () => {
  assert.equal(WA_TEMPLATES_STORAGE_KEY, 'sisp_wa_templates_v1');
  assert.deepEqual([...WA_TEMPLATE_IDS], ['billGenerated', 'politeReminder', 'brokenWaada', 'outageNotice', 'paymentReceived']);
  assert.equal(WA_TEMPLATE_LABELS.politeReminder, 'Polite Reminder');
  const templates = getWaTemplates(null);
  assert.equal(templates.length, 5);
  assert.ok(templates.every(entry => entry.roman.includes('{name}') || entry.id === 'outageNotice'));
  assert.equal(DEFAULT_WA_TEMPLATES.length, 5);
});

test('rendering substitutes every placeholder with exact customer values', () => {
  const values = resolveWaTemplateValues(customer(), { totalDue: 1500 });
  assert.equal(values.name, 'Ahmed');
  assert.equal(values.urduName, 'احمد');
  assert.equal(values.connectionId, 'SH-001');
  assert.equal(values.package, '5 Mbps');
  assert.equal(values.totalDue, 'PKR 1,500');
  assert.equal(values.waadaDate, '2026-01-01');
  const out = renderWaTemplate('{name} | {urduName} | {connectionId} | {package} | {totalDue} | {waadaDate}', values);
  assert.equal(out, 'Ahmed | احمد | SH-001 | 5 Mbps | PKR 1,500 | 2026-01-01');
});

test('rendering never leaves undefined or raw placeholders behind', () => {
  const out = renderWaTemplate('Hi {name}, due {totalDue}, see {unknown} and {waadaDate}.', resolveWaTemplateValues({}, {}));
  assert.ok(!out.includes('undefined'), 'no undefined in output');
  assert.ok(!out.includes('{'), 'no raw placeholder left');
  assert.equal(out, 'Hi , due , see  and .');
  const templates = getWaTemplates(null);
  const rendered = renderWaTemplateFor(templates, 'politeReminder', {}, { totalDue: 2000 }, 'roman');
  assert.ok(!rendered.includes('undefined') && !rendered.includes('{'));
  assert.ok(rendered.includes('PKR 2,000'));
});

test('urdu variant renders the urdu text with the urdu name', () => {
  const rendered = renderWaTemplateFor(getWaTemplates(null), 'billGenerated', customer(), { totalDue: 1500 }, 'urdu');
  assert.ok(rendered.includes('احمد'));
  assert.ok(rendered.includes('PKR 1,500'));
});

test('studio save round-trips through storage; corrupt or unknown entries fall back to defaults', () => {
  const storage = fakeStorage();
  const updated = updateWaTemplate(storage, 'politeReminder', { roman: 'Salam {name}, bill {totalDue} baaqi hai.' });
  assert.equal(updated.find(entry => entry.id === 'politeReminder').roman, 'Salam {name}, bill {totalDue} baaqi hai.');
  assert.equal(getWaTemplates(storage).find(entry => entry.id === 'politeReminder').roman, 'Salam {name}, bill {totalDue} baaqi hai.');
  assert.equal(getWaTemplates(storage).find(entry => entry.id === 'outageNotice').roman, getWaTemplate(null, 'outageNotice').roman);
  const saved = saveWaTemplates(storage, [{ id: 'nope', roman: 'x', urdu: 'y' }, { id: 'outageNotice', roman: '', urdu: '' }]);
  assert.equal(saved.find(entry => entry.id === 'outageNotice').roman, getWaTemplate(null, 'outageNotice').roman);
  const corrupt = fakeStorage('not-json{');
  assert.equal(getWaTemplates(corrupt).find(entry => entry.id === 'politeReminder').roman, getWaTemplate(null, 'politeReminder').roman);
  assert.deepEqual(
    sanitizeWaTemplates([{ id: 'politeReminder', roman: 'Hi {name}', urdu: '' }, { id: 'nope', roman: 'x', urdu: 'x' }, { id: 'outageNotice', roman: '', urdu: '' }]),
    [{ id: 'politeReminder', roman: 'Hi {name}', urdu: getWaTemplate(null, 'politeReminder').urdu }]
  );
});

test('payment received message uses the amount just received', () => {
  const message = buildPaymentReceivedMessage(customer(), { amount: 2500 }, getWaTemplates(null), 'roman');
  assert.ok(message.includes('Ahmed'));
  assert.ok(message.includes('PKR 2,500'));
  assert.ok(!message.includes('undefined'));
});

test('campaign queue filters unpaid customers by zone and waada tier, broken first', () => {
  const state = {
    customers: [
      customer(),
      customer({ id: 'c2', name: 'Bilal', customerNumber: 2, packageSpeed: '10 Mbps', zone: 'South', phone: '03007654321', bills: [{ dueAmount: 2000, payments: [] }], promiseDate: undefined }),
      customer({ id: 'c3', name: 'Usman', customerNumber: 3, zone: 'North', bills: [{ dueAmount: 1000, payments: [{ amount: 1000 }] }], promiseDate: undefined }),
      customer({ id: 'c4', name: 'Archived', customerNumber: 4, zone: 'North', archived: true, bills: [{ dueAmount: 5000, payments: [] }], promiseDate: undefined }),
      customer({ id: 'c5', name: 'Fatima', customerNumber: 5, zone: 'North', bills: [{ dueAmount: 1200, payments: [] }], promiseDate: '2026-12-01' })
    ]
  };
  const all = buildCampaignQueue(state, { todayString: '2026-10-28' });
  assert.equal(all.totalCount, 3, 'paid and archived customers are excluded');
  assert.deepEqual(all.items.map(item => item.customerId), ['c1', 'c2', 'c5'], 'broken waada first, then highest balance');
  assert.equal(all.totalDuesPkr, 1500 + 2000 + 1200);
  assert.equal(buildCampaignQueue(state, { zone: 'North', todayString: '2026-10-28' }).items.length, 2);
  assert.deepEqual(buildCampaignQueue(state, { waadaTier: 'broken', todayString: '2026-10-28' }).items.map(item => item.customerId), ['c1']);
  assert.deepEqual(buildCampaignQueue(state, { waadaTier: 'promised', todayString: '2026-10-28' }).items.map(item => item.customerId), ['c5']);
  assert.deepEqual(buildCampaignQueue(state, { waadaTier: 'active', todayString: '2026-10-28' }).items.map(item => item.customerId), ['c2']);
});

test('marking lastRemindedAt stamps the customer without mutating the input state', () => {
  const state = { customers: [customer(), customer({ id: 'c2', name: 'Bilal' })] };
  const marked = markCustomerLastReminded(state, 'c1', '2026-10-28');
  assert.equal(marked.customers.find(c => c.id === 'c1').lastRemindedAt, '2026-10-28');
  assert.equal(marked.customers.find(c => c.id === 'c2').lastRemindedAt, undefined);
  assert.equal(state.customers.find(c => c.id === 'c1').lastRemindedAt, undefined, 'input untouched');
  assert.strictEqual(markCustomerLastReminded(state, 'missing', '2026-10-28'), state);
});

test('templates travel in JSON backups under settings.waTemplates and restore', () => {
  const state = createInitialState([]);
  const custom = [{ id: 'politeReminder', roman: 'Salam {name}, {totalDue} baaqi.', urdu: 'سلام {urduName}، {totalDue} باقی۔' }];
  const backupText = createJsonBackup(state, new Date('2026-10-28T12:00:00+05:00'), { waTemplates: custom });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.waTemplates[0].roman, 'Salam {name}, {totalDue} baaqi.');
  const preview = previewJsonBackupMerge(state, backupText, { currentWaTemplates: [], currentWaTemplatesStored: false });
  assert.equal(preview.counts.waTemplatesRestored, 1);
  assert.equal(preview.waTemplates[0].id, 'politeReminder');
});
