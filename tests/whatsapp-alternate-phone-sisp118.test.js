// SISP-118: Separate whatsappPhone & alternatePhone Support on Customer
// Profiles. Pure-function + core-integration tests on synthetic data only.
// Spec test criterion (verbatim): A customer with phone: "03001111111" and
// whatsappPhone: "03219999999" generates https://wa.me/923219999999 for
// WhatsApp links and tel:03001111111 for primary voice calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addCustomer,
  createInitialState,
  createJsonBackup,
  persistState,
  previewJsonBackupMerge,
  readState,
  updateCustomerProfile,
  whatsappPhoneFor
} from '../core.js';
import { formatWhatsAppUrl, normalizePakistaniWhatsAppPhone } from '../form-validation.js';
import { contactActionTargets, resolveReceiptWhatsAppAction } from '../profile-ui.js';
import { getRemindersTodayQueue } from '../reminder-queue.js';
import { buildOutageQueue } from '../outage-impact.js';
import { formatQuickCollectWhatsAppReceipt } from '../nav-quick-collect.js';
import { collectFieldModePayment } from '../field-mode.js';
import { getPendingCollectionCustomers } from '../nav-quick-collect.js';
import { calculateCustomerQuickProfile } from '../nav-quick-profile.js';
import { calculateFieldCollectionRoutes } from '../nav-collection-rounds.js';
import { TRANSLATIONS } from '../nav-language.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const REF = new Date('2026-10-15T05:00:00.000Z');

const SPEC_CUSTOMER = { phone: '03001111111', whatsappPhone: '03219999999' };

test('SISP-118 spec pin: WhatsApp links target the WhatsApp number, voice calls dial the primary', () => {
  assert.equal(whatsappPhoneFor(SPEC_CUSTOMER), '03219999999');
  const wa = formatWhatsAppUrl(whatsappPhoneFor(SPEC_CUSTOMER));
  assert.equal(wa.url, 'https://wa.me/923219999999');
  assert.equal(contactActionTargets(SPEC_CUSTOMER.phone).tel, 'tel:03001111111');
});

test('SISP-118 helper: preference and fallback matrix', () => {
  // Usable WhatsApp number wins over a usable primary.
  assert.equal(whatsappPhoneFor({ phone: '+923001234567', whatsappPhone: '+923219999999' }), '+923219999999');
  // Unusable WhatsApp number falls back to the primary — never a broken target.
  assert.equal(whatsappPhoneFor({ phone: '03001111111', whatsappPhone: '123' }), '03001111111');
  assert.equal(whatsappPhoneFor({ phone: '+923001234567', whatsappPhone: 'not-a-number' }), '+923001234567');
  // No WhatsApp number recorded -> primary, exactly as before the phase.
  assert.equal(whatsappPhoneFor({ phone: '03001111111' }), '03001111111');
  assert.equal(whatsappPhoneFor({ phone: '03001111111', whatsappPhone: '' }), '03001111111');
  assert.equal(whatsappPhoneFor({ phone: '03001111111', whatsappPhone: '   ' }), '03001111111');
  // Primary unusable, WhatsApp usable -> WhatsApp still works.
  assert.equal(whatsappPhoneFor({ phone: 'abc', whatsappPhone: '03219999999' }), '03219999999');
  assert.equal(whatsappPhoneFor({ phone: '', whatsappPhone: '03219999999' }), '03219999999');
  // Neither usable -> the preferred raw value rides through so each
  // surface's own formatter reports it invalid exactly as it did before.
  assert.equal(whatsappPhoneFor({ phone: '', whatsappPhone: '' }), '');
  assert.equal(whatsappPhoneFor({}), '');
  assert.equal(whatsappPhoneFor(null), '');
  assert.equal(whatsappPhoneFor({ phone: '123', whatsappPhone: '' }), '123');
});

test('SISP-118 helper: never disagrees with the real normalizer about usability', () => {
  const numbers = ['03001111111', '03219999999', '+923219999999', '923001234567', '3001234567',
    '123', 'not-a-number', '', '0300-1111111', '+92 321 9999999', '00923219999999',
    '04235712345', '1234567890123456', '+14155552671', '0321', '92'];
  for (const wa of numbers) {
    for (const phone of numbers) {
      const picked = whatsappPhoneFor({ phone, whatsappPhone: wa });
      const anyUsable = normalizePakistaniWhatsAppPhone(wa).valid || normalizePakistaniWhatsAppPhone(phone).valid;
      if (anyUsable) {
        assert.ok(normalizePakistaniWhatsAppPhone(picked).valid,
          `picked "${picked}" must be usable when wa="${wa}" phone="${phone}"`);
      }
      // A usable WhatsApp number is never shadowed by the primary.
      if (normalizePakistaniWhatsAppPhone(wa).valid) {
        assert.equal(picked, wa.trim(), `usable whatsappPhone "${wa}" must win over phone "${phone}"`);
      }
    }
  }
});

test('SISP-118 core: addCustomer stores the new fields trimmed, defaults empty, rejects over-length', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Synthetic Wa Customer', REF, {
    phone: '03001111111', whatsappPhone: ' 03219999999 ', alternatePhone: ' 03005555555 '
  });
  const created = state.customers.at(-1);
  assert.equal(created.phone, '03001111111');
  assert.equal(created.whatsappPhone, '03219999999');
  assert.equal(created.alternatePhone, '03005555555');

  state = addCustomer(state, 'Synthetic Plain Customer', REF, { phone: '03001111111' });
  const plain = state.customers.at(-1);
  assert.equal(plain.whatsappPhone, '');
  assert.equal(plain.alternatePhone, '');

  assert.throws(
    () => addCustomer(state, 'Synthetic Long Wa', REF, { whatsappPhone: '0'.repeat(41) }),
    /WhatsApp number must be 40 characters or fewer/
  );
  assert.throws(
    () => addCustomer(state, 'Synthetic Long Alt', REF, { alternatePhone: '0'.repeat(41) }),
    /Alternate phone number must be 40 characters or fewer/
  );
});

test('SISP-118 core: updateCustomerProfile sets, clears and preserves the new fields', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Synthetic Edit Customer', REF, { phone: '03001111111' });
  const id = state.customers.at(-1).id;

  state = updateCustomerProfile(state, id, { whatsappPhone: '03219999999', alternatePhone: '03005555555' });
  let saved = state.customers.find(c => c.id === id);
  assert.equal(saved.whatsappPhone, '03219999999');
  assert.equal(saved.alternatePhone, '03005555555');
  assert.equal(saved.phone, '03001111111', 'primary phone untouched');

  // An unrelated save that omits the keys preserves the recorded values.
  state = updateCustomerProfile(state, id, { address: 'Synthetic Street 1' });
  saved = state.customers.find(c => c.id === id);
  assert.equal(saved.whatsappPhone, '03219999999');
  assert.equal(saved.alternatePhone, '03005555555');

  // Explicit clear returns the customer to primary-only behaviour.
  state = updateCustomerProfile(state, id, { whatsappPhone: '', alternatePhone: '' });
  saved = state.customers.find(c => c.id === id);
  assert.equal(saved.whatsappPhone, '');
  assert.equal(saved.alternatePhone, '');
  assert.equal(whatsappPhoneFor(saved), '03001111111');
});

test('SISP-118 persistence: fields survive a persist/read round-trip', () => {
  const backing = new Map();
  const storage = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, String(v))
  };
  let state = createInitialState();
  state = addCustomer(state, 'Synthetic Persist Customer', REF, SPEC_CUSTOMER);
  persistState(state, storage);
  const loaded = readState(storage);
  const customer = loaded.customers.find(c => c.name === 'Synthetic Persist Customer');
  assert.equal(customer.whatsappPhone, '03219999999');
  assert.equal(customer.phone, '03001111111');
});

test('SISP-118 backup: fields round-trip through createJsonBackup + merge preview', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Synthetic Backup Customer', REF, {
    ...SPEC_CUSTOMER, alternatePhone: '03005555555'
  });
  const backup = createJsonBackup(state, REF);
  const preview = previewJsonBackupMerge(createInitialState(), backup);
  assert.equal(preview.canApply, true);
  const merged = preview.state.customers.find(c => c.name === 'Synthetic Backup Customer');
  assert.equal(merged.whatsappPhone, '03219999999');
  assert.equal(merged.alternatePhone, '03005555555');
  assert.equal(merged.phone, '03001111111');
});

test('SISP-118 backup: merge fills the new fields onto an existing profile that lacks them', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Synthetic Fill Customer', REF, {
    ...SPEC_CUSTOMER, alternatePhone: '03005555555'
  });
  const backup = createJsonBackup(state, REF);
  // Same identity on this device, but the new fields were never recorded here.
  const local = JSON.parse(JSON.stringify(state));
  const localCustomer = local.customers.find(c => c.name === 'Synthetic Fill Customer');
  localCustomer.whatsappPhone = '';
  localCustomer.alternatePhone = '';
  const preview = previewJsonBackupMerge(local, backup);
  const merged = preview.state.customers.find(c => c.name === 'Synthetic Fill Customer');
  assert.equal(merged.whatsappPhone, '03219999999');
  assert.equal(merged.alternatePhone, '03005555555');
  assert.ok(preview.counts.filledProfileFields >= 2);
});

test('SISP-118 backup: an over-length WhatsApp number in a backup is rejected, not imported', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Synthetic Bad Backup', REF, SPEC_CUSTOMER);
  const doc = JSON.parse(createJsonBackup(state, REF));
  doc.state.customers[0].whatsappPhone = '0'.repeat(41);
  // Re-stamp the checksum-free legacy path: validation runs before any merge.
  delete doc.checksum;
  assert.throws(
    () => previewJsonBackupMerge(createInitialState(), JSON.stringify(doc)),
    /invalid WhatsApp number/
  );
});

test('SISP-118 receipt drafts: profile resolver targets the WhatsApp number, with primary fallback', () => {
  const receipt = {
    customerId: 'synthetic-118', amount: 1500, date: '2026-10-05', method: 'Cash', month: '2026-10'
  };
  // Primary is local-only (no WhatsApp target); the dedicated WhatsApp
  // number is international, so the draft exists and targets it.
  const withWa = resolveReceiptWhatsAppAction(
    { id: 'synthetic-118', name: 'Synthetic Customer', customerNumber: 7, phone: '03001111111', whatsappPhone: '+923219999999' },
    receipt
  );
  assert.equal(withWa.type, 'draft');
  assert.ok(withWa.draft.url.startsWith('https://wa.me/923219999999?text='));

  // Junk WhatsApp number + usable primary -> the draft still targets the primary.
  const junkWa = resolveReceiptWhatsAppAction(
    { id: 'synthetic-118', name: 'Synthetic Customer', customerNumber: 7, phone: '+923001234567', whatsappPhone: '123' },
    receipt
  );
  assert.equal(junkWa.type, 'draft');
  assert.ok(junkWa.draft.url.startsWith('https://wa.me/923001234567?text='));

  // Neither recorded -> the pre-SISP-118 phone-required behaviour is unchanged.
  const none = resolveReceiptWhatsAppAction(
    { id: 'synthetic-118', name: 'Synthetic Customer', customerNumber: 7, phone: '' },
    receipt
  );
  assert.deepEqual(none, { type: 'phone-required', hasSavedPhone: false });
});

test('SISP-118 reminders: the Reminders Today queue drafts to the WhatsApp number', () => {
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
  const state = {
    customers: [{
      id: 'c118', customerNumber: 118, name: 'Synthetic Reminder Customer',
      ...SPEC_CUSTOMER, customDueDate: 5,
      bills: [{ dueAmount: 1500, payments: [] }]
    }]
  };
  const queue = getRemindersTodayQueue(state, { todayString: '2026-10-05', storage });
  assert.equal(queue.totalCount, 1);
  const item = queue.queue[0];
  assert.ok(item.whatsappUrl.includes('wa.me/923219999999'), `queue draft targets WhatsApp number: ${item.whatsappUrl}`);
  assert.equal(item.phone, '03001111111', 'the queue row still displays the primary phone');
  assert.equal(item.normalizedPhone, '+92 321 9999999');
});

test('SISP-118 outage alerts: queue prefers the WhatsApp number, falls back to a usable primary', () => {
  const house = (id, overrides = {}) => ({
    id, name: `House ${id}`, mohalla: 'Shahdara Town', phone: '+923001234567',
    archived: false, upstreamCustomerId: '', fiberZone: '', ...overrides
  });
  const customers = [
    house('A'),
    house('B', { upstreamCustomerId: 'A', phone: '03001111111', whatsappPhone: '+923219999999' }),
    house('C', { upstreamCustomerId: 'A', phone: '+923334444444', whatsappPhone: '03219999999' }),
    house('D', { upstreamCustomerId: 'A', phone: '+923555555555' })
  ];
  const queue = buildOutageQueue(customers, 'A');
  const byId = new Map(queue.impacted.map(e => [e.customer.id, e.whatsappLink]));
  assert.equal(byId.get('B'), 'https://wa.me/923219999999', 'international WhatsApp number wins');
  assert.equal(byId.get('C'), 'https://wa.me/923334444444', 'local-format WhatsApp number yields no outage link, so the primary is used — never a lost alert');
  assert.equal(byId.get('D'), 'https://wa.me/923555555555', 'no WhatsApp number -> primary, unchanged');
});

test('SISP-118 Quick Collect receipt: the optional WhatsApp target overrides the draft URL only', () => {
  const receipt = {
    receiptNumber: 'RCP-118', date: '2026-10-15', customerName: 'Synthetic Customer',
    customerNumber: 118, phone: '03001111111', area: 'Barrian', month: '2026-10',
    amount: 3000, method: 'Cash', payableRemaining: 0
  };
  const targeted = formatQuickCollectWhatsAppReceipt(receipt, { whatsappPhone: '+923219999999' });
  assert.ok(targeted.url.startsWith('https://wa.me/923219999999?text='));
  assert.ok(targeted.text.includes('03001111111'), 'the printed phone line still shows the recorded primary number');
  const legacy = formatQuickCollectWhatsAppReceipt(receipt);
  assert.ok(legacy.url.startsWith('https://wa.me/923001111111?text='), 'no option -> the receipt phone drives the URL, unchanged');
  const legacyIntl = formatQuickCollectWhatsAppReceipt({ ...receipt, phone: '+923001234567' });
  assert.ok(legacyIntl.url.startsWith('https://wa.me/923001234567?text='), 'no option -> receipt phone drives the URL, unchanged');
});

test('SISP-118 Field Mode: a collected payment drafts its WA receipt to the WhatsApp number', () => {
  const refDate = new Date('2026-10-28T05:00:00.000Z');
  const state = {
    customers: [{
      id: 'fm118', customerNumber: 118, name: 'Synthetic Field Customer', archived: false,
      mohalla: 'Barrian', zone: 'Barrian', ...SPEC_CUSTOMER,
      bills: [{ id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, dueDate: '2026-10-05', status: 'pending', payments: [] }]
    }]
  };
  const [entry] = getPendingCollectionCustomers(state, '', 'all-dues', refDate);
  const { whatsapp } = collectFieldModePayment(state, entry, 'Cash', refDate);
  assert.ok(whatsapp.url.startsWith('https://wa.me/923219999999'), `field draft targets WhatsApp number: ${whatsapp.url}`);
});

test('SISP-118 quick profile: WhatsApp targets the WhatsApp number, Call dials primary, Alt Call dials alternate', () => {
  const state = {
    customers: [{
      id: 'qp118', customerNumber: 118, name: 'Synthetic Quick Customer',
      ...SPEC_CUSTOMER, alternatePhone: '03005555555', bills: []
    }]
  };
  const profile = calculateCustomerQuickProfile(state.customers[0], state, { referenceDate: REF, storage: null });
  assert.equal(profile.whatsappUrl, 'https://wa.me/923219999999');
  assert.equal(profile.phoneUrl, 'tel:03001111111');
  assert.equal(profile.alternatePhoneUrl, 'tel:03005555555');
  assert.equal(profile.alternatePhone, '03005555555');

  const plain = calculateCustomerQuickProfile(
    { id: 'qp119', customerNumber: 119, name: 'Synthetic Plain', phone: '03001111111', bills: [] },
    { customers: [] }, { referenceDate: REF, storage: null }
  );
  assert.equal(plain.whatsappUrl, 'https://wa.me/923001111111');
  assert.equal(plain.alternatePhoneUrl, null, 'no alternate recorded -> no Alt Call target');
});

test('SISP-118 collection rounds: stop drafts prefer the WhatsApp number and expose an alternate Call target', () => {
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const route = calculateFieldCollectionRoutes({
    customers: [{
      id: 'cr118', customerNumber: 118, name: 'Synthetic Round Customer',
      ...SPEC_CUSTOMER, alternatePhone: '03005555555', mohalla: 'Barrian',
      bills: [{ id: 'bill-2026-10', month: '2026-10', dueAmount: 2000, dueDate: '2026-10-05', status: 'pending', payments: [] }]
    }]
  }, { dateStr: '2026-10-15', storage });
  assert.equal(route.stops.length, 1);
  const stop = route.stops[0];
  assert.equal(stop.whatsappPhone, '923219999999');
  assert.ok(stop.whatsappUrl.includes('923219999999'), `round WhatsApp targets WhatsApp number: ${stop.whatsappUrl}`);
  assert.equal(stop.phoneUrl, 'tel:03001111111');
  assert.equal(stop.alternatePhoneUrl, 'tel:03005555555');
});

test('SISP-118 i18n: every new string exists in both dictionaries and no t() call can render a raw key', () => {
  const keys = [
    'prof_form_whatsapp_phone', 'prof_form_whatsapp_phone_help',
    'prof_form_alternate_phone', 'prof_form_alternate_phone_help',
    'prof_view_call_alternate'
  ];
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
  }
  // Mechanical audit: every t('...') key used by the changed surfaces
  // exists in both dictionaries.
  const sources = ['app.js', 'profile-ui.js'].map(read).join('\n');
  const used = new Set([...sources.matchAll(/\bt\('([a-z0-9_]+)'/g)].map(m => m[1]));
  for (const key of ['prof_view_call_alternate']) {
    assert.ok(used.has(key), `${key} is actually used via t()`);
  }
});

test('SISP-118 wiring: profile form carries both inputs and app.js fills + saves them', () => {
  const index = read('index.html');
  assert.match(index, /id="whatsappPhoneInput"/);
  assert.match(index, /id="alternatePhoneInput"/);
  const app = read('app.js');
  assert.match(app, /\$\('#whatsappPhoneInput'\)\.value = customer\.whatsappPhone/);
  assert.match(app, /\$\('#alternatePhoneInput'\)\.value = customer\.alternatePhone/);
  assert.match(app, /whatsappPhone: \$\('#whatsappPhoneInput'\)\.value/);
  assert.match(app, /alternatePhone: \$\('#alternatePhoneInput'\)\.value/);
  // The profile contact actions resolve WhatsApp through the one seam.
  assert.match(app, /const waPhone = whatsappPhoneFor\(customer\);/);
});
