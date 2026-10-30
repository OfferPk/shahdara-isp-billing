// SISP-84: Commercial / Plaza VIP Connection SLA Priority Tag.
// Pure-function tests on synthetic data only. Spec test criterion
// (verbatim): "Logging a complaint for a commercial_vip customer
// automatically sets priority to Urgent and pins it above residential
// complaints."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONNECTION_TYPES,
  normalizeConnectionType,
  isCommercialVip,
  isOpenQueueItem,
  queueItemCustomer,
  isSlaPinned,
  effectiveQueuePriority,
  priorityForNewQueueItem,
  sortQueueBySla
} from '../commercial-sla.js';
import {
  createInitialState,
  addCustomer,
  updateCustomerProfile,
  readState,
  persistState,
  createJsonBackup,
  previewJsonBackupMerge
} from '../core.js';
import { createComplaint, sanitizeComplaints } from '../complaint-register.js';
import { createTicket, sanitizeTickets } from '../complaint-tickets.js';
import { assignTicketForComplaint } from '../complaint-ticket-sync.js';
import { commercialVipBadgeHtml } from '../profile-ui.js';
import { TRANSLATIONS, t } from '../nav-language.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const residential = { id: 'c-res', name: 'Residential Test', connectionType: 'residential' };
const vip = { id: 'c-vip', name: 'Plaza Test', connectionType: 'commercial_vip' };
const legacy = { id: 'c-old', name: 'Legacy Test' };
const customers = [residential, vip, legacy];

const complaint = (overrides = {}) => ({
  id: 'CMP-101',
  customerId: 'c-res',
  customerName: 'Residential Test',
  zone: 'Barrian',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-10-28T10:00',
  resolvedAt: '',
  downtimeHours: null,
  downtimeManual: false,
  priority: 'Normal',
  status: 'Open',
  resolutionNote: '',
  resolvedViaTicketId: '',
  syncReopenGuard: '',
  createdAt: '',
  ...overrides
});

const ticket = (overrides = {}) => ({
  id: 'TKT-101',
  customerId: 'c-res',
  customerName: 'Residential Test',
  complaintId: '',
  faultPreset: 'Fiber Cut / Splice Loss',
  customFault: '',
  technician: 'Lineman Test',
  priority: 'Normal',
  status: 'Open',
  createdAt: '2026-10-28T10:00',
  resolvedAt: '',
  note: '',
  materialsUsed: [],
  billingType: 'free',
  billedAmount: 0,
  chargePaid: false,
  chargePaidAt: '',
  chargePaymentId: '',
  resolvedViaComplaintId: '',
  stockDeductions: [],
  stockDeducted: false,
  ...overrides
});

test('connection type normalization: only the exact VIP tag is VIP', () => {
  assert.deepEqual(CONNECTION_TYPES, ['residential', 'commercial_vip']);
  assert.equal(normalizeConnectionType('commercial_vip'), 'commercial_vip');
  for (const bad of ['residential', '', 'vip', 'Commercial_VIP', 'plaza', null, undefined, 7, true]) {
    assert.equal(normalizeConnectionType(bad), 'residential', `value ${String(bad)}`);
  }
  assert.equal(isCommercialVip(vip), true);
  assert.equal(isCommercialVip(residential), false);
  assert.equal(isCommercialVip(legacy), false);
  assert.equal(isCommercialVip(null), false);
  assert.equal(isCommercialVip('commercial_vip'), false);
});

test('addCustomer: residential by default, VIP only via the explicit option', () => {
  const ref = new Date('2026-10-01T00:00:00Z');
  let state = createInitialState();
  state = addCustomer(state, 'Default Test', ref);
  state = addCustomer(state, 'Vip Test', ref, { connectionType: 'commercial_vip' });
  state = addCustomer(state, 'Bogus Test', ref, { connectionType: 'plaza' });
  const byName = (name) => state.customers.find((c) => c.name === name);
  assert.equal(byName('Default Test').connectionType, 'residential');
  assert.equal(byName('Vip Test').connectionType, 'commercial_vip');
  assert.equal(byName('Bogus Test').connectionType, 'residential');
});

test('updateCustomerProfile: sets, preserves and coerces connectionType', () => {
  const ref = new Date('2026-10-02T00:00:00Z');
  let state = createInitialState();
  state = addCustomer(state, 'Profile Test', ref);
  const id = state.customers[0].id;
  assert.equal(state.customers[0].connectionType, 'residential');

  state = updateCustomerProfile(state, id, { connectionType: 'commercial_vip' }, ref);
  assert.equal(state.customers[0].connectionType, 'commercial_vip');

  // An unrelated save (no connectionType key) must not clear the tag.
  state = updateCustomerProfile(state, id, { phone: '+920000000000' }, ref);
  assert.equal(state.customers[0].connectionType, 'commercial_vip');

  state = updateCustomerProfile(state, id, { connectionType: 'residential' }, ref);
  assert.equal(state.customers[0].connectionType, 'residential');

  // A corrupt value coerces to residential instead of blocking the save.
  state = updateCustomerProfile(state, id, { connectionType: 'gold' }, ref);
  assert.equal(state.customers[0].connectionType, 'residential');
});

test('save/load round trip: VIP survives, legacy and corrupt values load residential', () => {
  const ref = new Date('2026-10-02T00:00:00Z');
  let state = createInitialState();
  state = addCustomer(state, 'Vip Round Trip', ref, { connectionType: 'commercial_vip' });
  state = addCustomer(state, 'Plain Round Trip', ref);
  const storage = memoryStorage();
  persistState(state, storage);
  const loaded = readState(storage);
  assert.equal(loaded.customers.find((c) => c.name === 'Vip Round Trip').connectionType, 'commercial_vip');
  assert.equal(loaded.customers.find((c) => c.name === 'Plain Round Trip').connectionType, 'residential');

  // Legacy record: field absent entirely -> residential, never invented VIP.
  const raw = JSON.parse(storage.getItem('shahdara-isp-billing-v1'));
  delete raw.customers[0].connectionType;
  raw.customers[1].connectionType = 'plaza-vip';
  storage.setItem('shahdara-isp-billing-v1', JSON.stringify(raw));
  const legacyLoaded = readState(storage);
  assert.equal(legacyLoaded.customers[0].connectionType, 'residential');
  assert.equal(legacyLoaded.customers[1].connectionType, 'residential');
});

test('JSON backup round trip keeps connectionType (backup-safe)', () => {
  const ref = new Date('2026-10-02T00:00:00Z');
  let state = createInitialState();
  state = addCustomer(state, 'Backup Vip Test', ref, { connectionType: 'commercial_vip' });
  const backupJson = createJsonBackup(state, new Date('2026-10-18T00:00:00Z'));
  const parsed = JSON.parse(backupJson);
  assert.equal(parsed.state.customers.find((c) => c.name === 'Backup Vip Test').connectionType, 'commercial_vip');

  const localState = JSON.parse(JSON.stringify(state));
  localState.customers.find((c) => c.name === 'Backup Vip Test').connectionType = 'residential';
  const mergePreview = previewJsonBackupMerge(localState, backupJson);
  assert.equal(mergePreview.canApply, true);
  assert.equal(
    mergePreview.state.customers.find((c) => c.name === 'Backup Vip Test').connectionType,
    'commercial_vip'
  );

  // The reverse never strips a tag: a local VIP stays VIP when the
  // backup still says residential.
  const vipLocal = JSON.parse(JSON.stringify(state));
  const plainBackup = createJsonBackup(
    updateCustomerProfile(state, state.customers[0].id, { connectionType: 'residential' }, ref),
    new Date('2026-10-18T00:00:00Z')
  );
  const stripPreview = previewJsonBackupMerge(vipLocal, plainBackup);
  assert.equal(
    stripPreview.state.customers.find((c) => c.name === 'Backup Vip Test').connectionType,
    'commercial_vip'
  );
});

test('PIN: logging a complaint for a commercial_vip customer sets priority Urgent', () => {
  // The register modal passes priorityForNewQueueItem(customer).
  assert.equal(priorityForNewQueueItem(vip), 'Urgent');
  assert.equal(priorityForNewQueueItem(vip, 'Normal'), 'Urgent');
  assert.equal(priorityForNewQueueItem(residential), 'Normal');
  assert.equal(priorityForNewQueueItem(residential, 'Urgent'), 'Urgent');
  assert.equal(priorityForNewQueueItem(legacy), 'Normal');
  assert.equal(priorityForNewQueueItem(null), 'Normal');

  const logged = createComplaint({
    customerId: vip.id,
    customerName: vip.name,
    zone: 'Barrian',
    issueCategory: 'Fiber Cut',
    reportedAt: '2026-10-28T10:00',
    priority: priorityForNewQueueItem(vip)
  }, []);
  assert.equal(logged.priority, 'Urgent');
  assert.equal(logged.status, 'Open');

  const plain = createComplaint({
    customerId: residential.id,
    customerName: residential.name,
    zone: 'Barrian',
    issueCategory: 'Fiber Cut',
    reportedAt: '2026-10-28T11:00',
    priority: priorityForNewQueueItem(residential)
  }, [logged]);
  assert.equal(plain.priority, 'Normal');

  // Sanitizer keeps a stored Urgent; legacy records without the field
  // load as Normal.
  const [kept] = sanitizeComplaints([logged]);
  assert.equal(kept.priority, 'Urgent');
  const [legacyLoaded] = sanitizeComplaints([{ id: 'CMP-101', customerId: 'c-res', status: 'Open' }]);
  assert.equal(legacyLoaded.priority, 'Normal');
});

test('PIN: an open VIP complaint pins above residential complaints; relative order otherwise kept', () => {
  // Register base order = newest reported first.
  const rows = [
    complaint({ id: 'CMP-103', customerId: 'c-res', reportedAt: '2026-10-28T12:00' }),
    complaint({ id: 'CMP-102', customerId: 'c-vip', reportedAt: '2026-10-28T11:00' }),
    complaint({ id: 'CMP-101', customerId: 'c-res', reportedAt: '2026-10-28T10:00' })
  ];
  const sorted = sortQueueBySla(rows, customers);
  assert.deepEqual(sorted.map((c) => c.id), ['CMP-102', 'CMP-103', 'CMP-101']);
  // Input not mutated, residential relative order unchanged.
  assert.deepEqual(rows.map((c) => c.id), ['CMP-103', 'CMP-102', 'CMP-101']);
  assert.equal(isSlaPinned(rows[1], customers), true);
  assert.equal(isSlaPinned(rows[0], customers), false);
});

test('resolved VIP items are never pinned and keep their stored priority', () => {
  const rows = [
    complaint({ id: 'CMP-102', customerId: 'c-res', reportedAt: '2026-10-28T12:00' }),
    complaint({ id: 'CMP-101', customerId: 'c-vip', priority: 'Urgent', status: 'Resolved', reportedAt: '2026-10-28T09:00' })
  ];
  assert.equal(isOpenQueueItem(rows[1]), false);
  assert.equal(isSlaPinned(rows[1], customers), false);
  assert.deepEqual(sortQueueBySla(rows, customers).map((c) => c.id), ['CMP-102', 'CMP-101']);
  // Unaffected = the stored priority stands as recorded.
  assert.equal(effectiveQueuePriority(rows[1], customers), 'Urgent');
});

test('effective priority is derived live: upgrading a customer raises their open items', () => {
  const stored = complaint({ customerId: 'c-vip', priority: 'Normal' });
  assert.equal(effectiveQueuePriority(stored, customers), 'Urgent');
  assert.equal(effectiveQueuePriority(stored, [residential]), 'Normal');
  assert.equal(effectiveQueuePriority(complaint({ customerId: 'c-res', priority: 'Urgent' }), customers), 'Urgent');
  assert.equal(effectiveQueuePriority(complaint({ customerId: 'c-res' }), customers), 'Normal');
  // Area-outage records have no customer and never pin.
  const area = complaint({ customerId: 'AREA_OUTAGE', customerName: 'AREA_OUTAGE' });
  assert.equal(queueItemCustomer(customers, area), null);
  assert.equal(isSlaPinned(area, customers), false);
  assert.equal(effectiveQueuePriority(area, customers), 'Normal');
  // In Progress is still open work and pins too.
  assert.equal(isSlaPinned(complaint({ customerId: 'c-vip', status: 'In Progress' }), customers), true);
});

test('tickets: a VIP customer ticket is born Urgent and pins in the worklist', () => {
  const created = createTicket({
    customerId: vip.id,
    customerName: vip.name,
    faultPreset: 'Fiber Cut / Splice Loss',
    technician: 'Lineman Test',
    priority: priorityForNewQueueItem(vip, 'Normal')
  }, [], new Date('2026-10-28T05:00:00Z'));
  assert.equal(created.priority, 'Urgent');
  const [kept] = sanitizeTickets([created]);
  assert.equal(kept.priority, 'Urgent');

  const rows = [
    ticket({ id: 'TKT-103', customerId: 'c-res', createdAt: '2026-10-28T12:00' }),
    ticket({ id: 'TKT-102', customerId: 'c-vip', priority: 'Urgent', createdAt: '2026-10-28T11:00' }),
    ticket({ id: 'TKT-101', customerId: 'c-vip', priority: 'Urgent', status: 'Resolved', createdAt: '2026-10-28T09:00' })
  ];
  // The resolved VIP ticket is NOT pinned above open residential work.
  assert.deepEqual(sortQueueBySla(rows, customers).map((x) => x.id), ['TKT-102', 'TKT-103', 'TKT-101']);
});

test('SISP-44 sync: an Urgent complaint passes its urgency to the assigned ticket', () => {
  const urgentComplaint = createComplaint({
    customerId: vip.id,
    customerName: vip.name,
    zone: 'Barrian',
    issueCategory: 'Fiber Cut',
    reportedAt: '2026-10-28T10:00',
    priority: priorityForNewQueueItem(vip)
  }, []);
  const assigned = assignTicketForComplaint([urgentComplaint], [], urgentComplaint.id, { technician: 'Lineman Test' });
  assert.equal(assigned.created, true);
  assert.equal(assigned.ticket.priority, 'Urgent');

  const normalComplaint = createComplaint({
    customerId: residential.id,
    customerName: residential.name,
    zone: 'Barrian',
    issueCategory: 'Fiber Cut',
    reportedAt: '2026-10-28T10:00',
    priority: priorityForNewQueueItem(residential)
  }, []);
  const assignedNormal = assignTicketForComplaint([normalComplaint], [], normalComplaint.id, { technician: 'Lineman Test' });
  assert.equal(assignedNormal.ticket.priority, 'Normal');

  // An explicit caller priority still wins over the complaint's.
  const explicit = assignTicketForComplaint([normalComplaint], [], normalComplaint.id, { technician: 'Lineman Test', priority: 'Urgent' });
  assert.equal(explicit.ticket.priority, 'Urgent');
});

test('profile VIP tag renders only for commercial_vip customers', () => {
  const html = commercialVipBadgeHtml(vip);
  assert.match(html, /sla-vip-badge/);
  assert.match(html, /Commercial VIP/);
  assert.equal(commercialVipBadgeHtml(residential), '');
  assert.equal(commercialVipBadgeHtml(legacy), '');
  assert.equal(commercialVipBadgeHtml(null), '');
});

test('i18n: every SISP-84 key exists in en and ur and resolves via t()', () => {
  const keys = [
    'sla_vip_badge',
    'sla_hours_badge',
    'prof_form_connection_type',
    'prof_form_connection_type_note',
    'prof_conn_residential',
    'prof_conn_commercial'
  ];
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
    assert.notEqual(t(key, 'en'), key);
    assert.notEqual(t(key, 'ur'), key);
  }
  assert.match(t('sla_hours_badge', 'en'), /< 2 Hours SLA/);
  // The keys the queue renders actually use exist too (mechanical audit
  // of the t()/translate() calls added by this phase).
  const registerSrc = readFileSync(new URL('../complaint-register.js', import.meta.url), 'utf8');
  const ticketsSrc = readFileSync(new URL('../complaint-tickets.js', import.meta.url), 'utf8');
  for (const src of [registerSrc, ticketsSrc]) {
    for (const match of src.matchAll(/(?:t|translate)\('(sla_[a-z_]+)'\)/g)) {
      assert.ok(TRANSLATIONS.en[match[1]], `en missing used key ${match[1]}`);
      assert.ok(TRANSLATIONS.ur[match[1]], `ur missing used key ${match[1]}`);
    }
  }
});

test('wiring: profile form, app save/fill, queue imports and token-only CSS', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /id="connectionTypeInput"/);
  assert.match(index, /<option value="commercial_vip"/);
  for (const match of index.matchAll(/<select id="connectionTypeInput">([\s\S]*?)<\/select>/g)) {
    for (const keyMatch of match[1].matchAll(/data-i18n="([a-z0-9_]+)"/g)) {
      assert.ok(TRANSLATIONS.en[keyMatch[1]], `en missing data-i18n ${keyMatch[1]}`);
      assert.ok(TRANSLATIONS.ur[keyMatch[1]], `ur missing data-i18n ${keyMatch[1]}`);
    }
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /connectionTypeInput/);
  assert.match(app, /connectionType: \$\('#connectionTypeInput'\)\.value/);
  assert.match(app, /commercialVipBadgeHtml\(customer\)/);
  const registerSrc = readFileSync(new URL('../complaint-register.js', import.meta.url), 'utf8');
  const ticketsSrc = readFileSync(new URL('../complaint-tickets.js', import.meta.url), 'utf8');
  assert.match(registerSrc, /from '\.\/commercial-sla\.js'/);
  assert.match(ticketsSrc, /from '\.\/commercial-sla\.js'/);
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('/* SISP-84:'), css.indexOf('.sla-badge {', css.indexOf('/* SISP-84:')) + 200);
  assert.match(block, /\.sla-vip-badge/);
  assert.match(block, /\.sla-badge/);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-84 CSS must use theme tokens only (no hex)');
});
