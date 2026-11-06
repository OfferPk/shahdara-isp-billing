import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CUSTOMER_EMERGENCY_CONTACT_STORE_KEY,
  CUSTOMER_EMERGENCY_CONTACT_NAME_MAX_LENGTH,
  CUSTOMER_EMERGENCY_CONTACT_RELATIONSHIP_MAX_LENGTH,
  CUSTOMER_EMERGENCY_CONTACT_PHONE_MAX_LENGTH,
  normalizeCustomerEmergencyContact,
  normalizeCustomerEmergencyContactList,
  loadCustomerEmergencyContactList,
  recordCustomerEmergencyContact,
  removeCustomerEmergencyContact,
  customerEmergencyContactForCustomer,
  hasCustomerEmergencyContact,
  customerEmergencyContactSummaryText,
  customerEmergencyContactSectionHtml,
} from '../customer-emergency-contact.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'customer-emergency-contact.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan368-customer-emergency-contact.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const qcSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');

// Generic fixtures only — clearly made-up names and a pattern-fake
// number (the 03012345678 ascending-digit family), never a real
// customer and never a real number.
function contact(overrides = {}) {
  return {
    id: 'EMC-1',
    customerId: 'CUST-1',
    name: 'Contact One',
    relationship: 'Brother',
    phone: '03012345678',
    ...overrides,
  };
}

function customer(overrides = {}) {
  return { id: 'CUST-1', name: 'Customer One', ...overrides };
}

test('Plan 368: store key is short and names the contact store', () => {
  assert.equal(CUSTOMER_EMERGENCY_CONTACT_STORE_KEY, 'shahdara_emc_contacts_v1');
  assert.equal(CUSTOMER_EMERGENCY_CONTACT_NAME_MAX_LENGTH, 60);
  assert.equal(CUSTOMER_EMERGENCY_CONTACT_RELATIONSHIP_MAX_LENGTH, 60);
  assert.equal(CUSTOMER_EMERGENCY_CONTACT_PHONE_MAX_LENGTH, 40);
});

test('Plan 368: normalize keeps a valid contact and trims its fields', () => {
  const out = normalizeCustomerEmergencyContact(contact({
    name: '  Contact One  ',
    relationship: '  Brother  ',
    phone: '  03012345678  ',
  }));
  assert.deepEqual(out, {
    id: 'EMC-1',
    customerId: 'CUST-1',
    name: 'Contact One',
    relationship: 'Brother',
    phone: '03012345678',
  });
});

test('Plan 368: normalize refuses a contact with no id, no customer, no name, or no phone', () => {
  assert.equal(normalizeCustomerEmergencyContact(contact({ id: '' })), null);
  assert.equal(normalizeCustomerEmergencyContact(contact({ id: '   ' })), null);
  assert.equal(normalizeCustomerEmergencyContact(contact({ customerId: '' })), null);
  assert.equal(normalizeCustomerEmergencyContact(contact({ name: '' })), null);
  assert.equal(normalizeCustomerEmergencyContact(contact({ name: '   ' })), null);
  assert.equal(normalizeCustomerEmergencyContact(contact({ phone: '' })), null);
  assert.equal(normalizeCustomerEmergencyContact(contact({ phone: '   ' })), null);
  assert.equal(normalizeCustomerEmergencyContact(null), null);
  assert.equal(normalizeCustomerEmergencyContact('Contact One'), null);
});

test('Plan 368: normalize caps a long name, relationship, and phone', () => {
  const out = normalizeCustomerEmergencyContact(contact({
    name: 'x'.repeat(80),
    relationship: 'y'.repeat(80),
    phone: '0'.repeat(60),
  }));
  assert.equal(out.name.length, 60);
  assert.equal(out.relationship.length, 60);
  assert.equal(out.phone.length, 40);
});

test('Plan 368: normalize list drops invalid entries and keeps the first per customer and id', () => {
  assert.deepEqual(normalizeCustomerEmergencyContactList('not a list'), []);
  assert.deepEqual(normalizeCustomerEmergencyContactList(null), []);
  const list = normalizeCustomerEmergencyContactList([
    contact(),
    contact({ id: 'EMC-2', name: 'Contact Two' }),
    contact({ id: 'EMC-1', name: 'Contact Three' }),
    contact({ id: 'EMC-3', customerId: 'CUST-2', name: 'Contact Four' }),
    contact({ id: 'EMC-4', phone: '' }),
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].name, 'Contact One');
  assert.equal(list[1].customerId, 'CUST-2');
});

test('Plan 368: load reads the list from a storage-like object and tolerates bad storage', () => {
  const storage = {
    getItem: () => JSON.stringify([contact(), contact({ id: 'EMC-2', customerId: 'CUST-2', name: 'Contact Two' })]),
  };
  assert.equal(loadCustomerEmergencyContactList(storage).length, 2);
  assert.deepEqual(loadCustomerEmergencyContactList({ getItem: () => 'not json' }), []);
  assert.deepEqual(loadCustomerEmergencyContactList(null), []);
  assert.deepEqual(loadCustomerEmergencyContactList(undefined), []);
});

test('Plan 368: record adds a contact and replaces in place for the same customer', () => {
  const first = recordCustomerEmergencyContact([], contact());
  assert.equal(first.length, 1);
  const replaced = recordCustomerEmergencyContact(first, contact({ id: 'EMC-9', name: 'Contact Two', phone: '03012345679' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].id, 'EMC-9');
  assert.equal(replaced[0].name, 'Contact Two');
  assert.equal(replaced[0].phone, '03012345679');
  const other = recordCustomerEmergencyContact(replaced, contact({ id: 'EMC-10', customerId: 'CUST-2', name: 'Contact Three' }));
  assert.equal(other.length, 2);
});

test('Plan 368: record matches the customer case-insensitively and leaves the input alone', () => {
  const before = [contact()];
  const after = recordCustomerEmergencyContact(before, contact({ id: 'EMC-9', customerId: 'cust-1', name: 'Contact Two' }));
  assert.equal(after.length, 1);
  assert.equal(after[0].name, 'Contact Two');
  assert.equal(before[0].name, 'Contact One');
  assert.notEqual(after, before);
  const unchanged = recordCustomerEmergencyContact(before, contact({ phone: '' }));
  assert.deepEqual(unchanged, before);
});

test('Plan 368: remove drops only that customer, case-insensitively', () => {
  const list = [contact(), contact({ id: 'EMC-2', customerId: 'CUST-2', name: 'Contact Two' })];
  assert.deepEqual(removeCustomerEmergencyContact(list, 'cust-1'), [list[1]]);
  assert.deepEqual(removeCustomerEmergencyContact(list, 'CUST-9'), list);
  assert.deepEqual(removeCustomerEmergencyContact(list, ''), list);
});

test('Plan 368: lookup is case-insensitive and missing reads as no contact', () => {
  const list = [contact()];
  assert.equal(customerEmergencyContactForCustomer(list, 'cust-1').name, 'Contact One');
  assert.equal(customerEmergencyContactForCustomer(list, 'CUST-2'), null);
  assert.equal(customerEmergencyContactForCustomer(list, ''), null);
  assert.equal(customerEmergencyContactForCustomer([], 'CUST-1'), null);
  assert.equal(hasCustomerEmergencyContact(list, 'CUST-1'), true);
  assert.equal(hasCustomerEmergencyContact(list, 'CUST-2'), false);
});

test('Plan 368: summary text counts the contacts in plain words', () => {
  assert.equal(customerEmergencyContactSummaryText([]), 'No emergency contact noted.');
  assert.equal(customerEmergencyContactSummaryText([contact()]), '1 customer has an emergency contact noted.');
  assert.equal(
    customerEmergencyContactSummaryText([contact(), contact({ id: 'EMC-2', customerId: 'CUST-2', name: 'Contact Two' })]),
    '2 customers have an emergency contact noted.',
  );
});

test('Plan 368: section shows the contact with name, relationship, and number plus an edit form', () => {
  const html = customerEmergencyContactSectionHtml(customer(), [contact()], {});
  assert.match(html, /<strong>Contact One<\/strong>/);
  assert.match(html, /Brother/);
  assert.match(html, /03012345678/);
  assert.match(html, /id="emcForm"/);
  assert.match(html, /id="emcName"/);
  assert.match(html, /id="emcRelationship"/);
  assert.match(html, /id="emcPhone"/);
  assert.match(html, /id="emcRemoveBtn"/);
  assert.match(html, /profile-customer-emergency-contact/);
});

test('Plan 368: section escapes the contact text and honours caller labels', () => {
  const html = customerEmergencyContactSectionHtml(
    customer(),
    [contact({ name: '<script>alert(1)</script>' })],
    { heading: 'Rabta', nameLabel: 'Naam', none: 'Kuch nahi' },
  );
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Rabta/);
  assert.match(html, /Naam/);
});

test('Plan 368: a profile without a contact shows the none line and the add form, never a number', () => {
  const html = customerEmergencyContactSectionHtml(customer(), [], { none: 'No emergency contact noted for this customer.' });
  assert.match(html, /No emergency contact noted for this customer\./);
  assert.ok(!html.includes('emc-current'));
  assert.match(html, /id="emcForm"/);
  assert.ok(!html.includes('emcRemoveBtn'));
  assert.equal(customerEmergencyContactSectionHtml(null, [contact()]), '');
  assert.equal(customerEmergencyContactSectionHtml('not an object', [contact()]), '');
});

test('Plan 368: a contact with no relationship still shows name and number', () => {
  const html = customerEmergencyContactSectionHtml(customer(), [contact({ relationship: '' })], {});
  assert.match(html, /<strong>Contact One<\/strong>/);
  assert.match(html, /03012345678/);
  // The current line carries no relationship separator when none is recorded.
  assert.ok(!html.includes(' — Brother'));
});

test('Plan 368: the phone is stored exactly as entered, trimmed — never reformatted', () => {
  const out = normalizeCustomerEmergencyContact(contact({ phone: '0301 2345678' }));
  assert.equal(out.phone, '0301 2345678');
  const recorded = recordCustomerEmergencyContact([], contact({ phone: '+92 301 2345678' }));
  assert.equal(recorded[0].phone, '+92 301 2345678');
});

test('Plan 368: module is pure — no page, storage, clock, network, or import', () => {
  assert.ok(!moduleSrc.includes('document.'));
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!moduleSrc.includes('new Date('));
  assert.ok(!moduleSrc.includes('Date.now('));
  assert.ok(!moduleSrc.includes('fetch('));
  assert.ok(!moduleSrc.includes('window.'));
  assert.ok(!moduleSrc.includes('import '));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
});

test('Plan 368: module and tests never name the fenced neighbours literally', () => {
  const fenced = [
    ['emergency', 'card'].join('-') + '.js',
    ['occupancy', 'guarantor'].join('-') + '.js',
    ['contact', 'preferences'].join('-') + '.js',
    ['emergency', 'kit', 'checklist'].join('-') + '.js',
    ['emergency', 'runbook', 'card'].join('-') + '.js',
    ['business', 'contact'].join('-') + '.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module names fenced file ${name}`);
    assert.ok(!testSrc.includes(name), `tests name fenced file ${name}`);
  }
});

test('Plan 368: wiring — import, load/save, section after the gate access instruction, bindings', () => {
  assert.ok(appSrc.includes("from './customer-emergency-contact.js'"));
  assert.ok(appSrc.includes('loadCustomerEmergencyContacts'));
  assert.ok(appSrc.includes('saveCustomerEmergencyContacts'));
  assert.ok(appSrc.includes('customerEmergencyContactSectionMarkup'));
  // Order, not adjacency: the emergency contact section sits between
  // the gate access instruction and the header strip, after the
  // handling note and the spoken language note.
  const handlingAt = appSrc.indexOf('${handlingNoteSectionMarkup}');
  const spokenAt = appSrc.indexOf('${spokenLanguageNoteSectionMarkup}');
  const gateAt = appSrc.indexOf('${gateAccessInstructionSectionMarkup}');
  const emergencyAt = appSrc.indexOf('${customerEmergencyContactSectionMarkup}');
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  assert.ok(handlingAt !== -1 && spokenAt !== -1 && gateAt !== -1 && emergencyAt !== -1 && stripAt !== -1);
  assert.ok(
    handlingAt < spokenAt && spokenAt < gateAt && gateAt < emergencyAt && emergencyAt < stripAt,
    'emergency contact section sits after the gate access instruction and before the header strip',
  );
  assert.ok(appSrc.includes('emcForm'));
  assert.ok(appSrc.includes('emcRemoveBtn'));
});

test('Plan 368: the contact appears on the profile only — never on the payment entry screen', () => {
  assert.ok(!qcSrc.includes('customerEmergencyContact'));
  assert.ok(!qcSrc.includes('emc'));
});

test('Plan 368: emergency contact keys exist in both language tables', () => {
  assert.ok(langSrc.includes('prof_emc_heading'));
  assert.ok(langSrc.includes('prof_emc_name'));
  assert.ok(langSrc.includes('prof_emc_relationship'));
  assert.ok(langSrc.includes('prof_emc_phone'));
  assert.ok(langSrc.includes('prof_emc_name_placeholder'));
  assert.ok(langSrc.includes('prof_emc_relationship_placeholder'));
  assert.ok(langSrc.includes('prof_emc_phone_placeholder'));
  assert.ok(langSrc.includes('prof_emc_remove'));
  assert.ok(langSrc.includes('prof_emc_none'));
});

test('Plan 368: styles reuse existing colours only — no new hex in emergency contact rules', () => {
  assert.ok(stylesSrc.includes('.profile-customer-emergency-contact'));
  assert.ok(stylesSrc.includes('.emc-form'));
  const rules = stylesSrc.match(/\.emc-[^{]+\{[^}]*\}|\.profile-customer-emergency-contact[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0);
  const baseline = stylesSrc.replace(/\.emc-[^{]+\{[^}]*\}|\.profile-customer-emergency-contact[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map(hex => hex.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
