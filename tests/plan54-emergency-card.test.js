/**
 * plan54-emergency-card.test.js — Plan 54: emergency contact and
 * escalation card (offline, on-device).
 * Pins:
 * - the four roles, with typed spellings folded to keys and
 *   anything outside refused;
 * - phone validation: at least 7 digits, nothing but digits, +,
 *   spaces, dashes, or parentheses; the number is kept exactly
 *   as typed, never silently repaired;
 * - half-formed contacts refused outright, never stored
 *   half-formed; a blank note stays empty, never guessed;
 * - one contact per id (a second save with the same id replaces
 *   the first), remove/find, and non-mutation;
 * - the escalation order: unknown ids dropped, repeats collapsed,
 *   unlisted contacts follow name A–Z and are marked unlisted,
 *   so nobody on the card is ever hidden;
 * - situation lookup is case-insensitive and "all" covers every
 *   situation;
 * - summary text, HTML escaping, CSV quoting, filename safety,
 *   and the fence: the module holds no bill, payment, customer,
 *   or ticket field, and renders phones as plain text, never as
 *   a dial link.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMERGENCY_ROLES,
  normalizeEmergencyRole,
  emergencyRoleLabel,
  normalizeEmergencyPhone,
  normalizeEmergencyContact,
  normalizeEmergencyContacts,
  findEmergencyContact,
  upsertEmergencyContact,
  removeEmergencyContact,
  normalizeEscalationOrder,
  normalizeEmergencyCard,
  escalationList,
  contactsForSituation,
  emergencyCardSummaryText,
  emergencyCardHtml,
  emergencyContactsCsv,
  emergencyCardFilename,
} from '../emergency-card.js';

const upstream = {
  id: 'c1', name: 'Upstream Support Desk', role: 'upstream_support',
  phone: '0800 123 456', situations: ['upstream outage', 'slow speeds'], note: '',
};
const electrician = {
  id: 'c2', name: 'Rashid Electrician', role: 'power_electrician',
  phone: '+92 300 1234567', situations: ['power cut'], note: 'Evenings only',
};
const supplier = {
  id: 'c3', name: 'City Equipment Store', role: 'equipment_supplier',
  phone: '042-35712345', situations: ['all'], note: '',
};

test('roles: four roles, aliases fold, unknown refused', () => {
  assert.equal(EMERGENCY_ROLES.length, 4);
  assert.deepEqual(EMERGENCY_ROLES.map((r) => r.value), [
    'upstream_support', 'power_electrician', 'equipment_supplier', 'owner',
  ]);
  assert.equal(normalizeEmergencyRole('Electrician'), 'power_electrician');
  assert.equal(normalizeEmergencyRole('ISP'), 'upstream_support');
  assert.equal(normalizeEmergencyRole('vendor'), 'equipment_supplier');
  assert.equal(normalizeEmergencyRole('second contact'), 'owner');
  assert.equal(normalizeEmergencyRole('technician'), null);
  assert.equal(normalizeEmergencyRole(''), null);
  assert.equal(emergencyRoleLabel('owner'), 'Owner');
  assert.equal(emergencyRoleLabel('nobody'), null);
});

test('phones: kept as typed, at least 7 digits, junk refused', () => {
  assert.equal(normalizeEmergencyPhone('+92 300 1234567'), '+92 300 1234567');
  assert.equal(normalizeEmergencyPhone('042-35712345'), '042-35712345');
  assert.equal(normalizeEmergencyPhone('123456'), null);
  assert.equal(normalizeEmergencyPhone('call me'), null);
  assert.equal(normalizeEmergencyPhone('0300-abc-def'), null);
  assert.equal(normalizeEmergencyPhone(''), null);
  assert.equal(normalizeEmergencyPhone(null), null);
});

test('half-formed contacts refused outright, blank note stays empty', () => {
  assert.equal(normalizeEmergencyContact({ ...upstream, name: '' }), null);
  assert.equal(normalizeEmergencyContact({ ...upstream, role: 'technician' }), null);
  assert.equal(normalizeEmergencyContact({ ...upstream, phone: '123' }), null);
  assert.equal(normalizeEmergencyContact({ ...upstream, situations: [] }), null);
  assert.equal(normalizeEmergencyContact({ ...upstream, situations: [' ', ','] }), null);
  assert.equal(normalizeEmergencyContact({ ...upstream, id: '' }), null);
  assert.equal(normalizeEmergencyContact(null), null);
  const kept = normalizeEmergencyContact({ ...upstream, note: '  ' });
  assert.equal(kept.note, '');
  assert.deepEqual(normalizeEmergencyContact({ ...upstream, situations: 'Upstream Outage, upstream outage, , power cut' }).situations,
    ['Upstream Outage', 'power cut']);
});

test('upsert replaces by id, remove drops, find works, inputs never mutated', () => {
  const before = [upstream];
  const snapshot = JSON.parse(JSON.stringify(before));
  const replaced = upsertEmergencyContact(before, { ...upstream, phone: '0800 999 999' });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].phone, '0800 999 999');
  assert.deepEqual(before, snapshot);
  const added = upsertEmergencyContact(before, electrician);
  assert.equal(added.length, 2);
  assert.equal(upsertEmergencyContact(before, { ...upstream, phone: 'bad' }).length, 1);
  assert.equal(removeEmergencyContact(added, 'c1').length, 1);
  assert.equal(findEmergencyContact(added, 'c2').name, 'Rashid Electrician');
  assert.equal(findEmergencyContact(added, 'nope'), null);
  assert.deepEqual(normalizeEmergencyContacts([upstream, upstream, { ...upstream, phone: 'bad' }]).length, 1);
});

test('escalation order: unknown dropped, repeats collapsed, unlisted follow name A–Z', () => {
  const card = normalizeEmergencyCard({
    contacts: [supplier, upstream, electrician],
    escalationOrder: ['c2', 'c1', 'c2', 'ghost'],
    escalationNote: 'Call upstream first, then the electrician.',
  });
  assert.deepEqual(card.escalationOrder, ['c2', 'c1']);
  assert.equal(card.escalationNote, 'Call upstream first, then the electrician.');
  const list = escalationList(card);
  assert.deepEqual(list.map((c) => c.id), ['c2', 'c1', 'c3']);
  assert.deepEqual(list.map((c) => c.position), [1, 2, 3]);
  assert.deepEqual(list.map((c) => c.unlisted), [false, false, true]);
  assert.deepEqual(escalationList({ contacts: [upstream] }).map((c) => c.unlisted), [true]);
  assert.deepEqual(normalizeEscalationOrder([upstream], 'not-an-array'), []);
});

test('situation lookup is case-insensitive and "all" covers everything', () => {
  const contacts = [upstream, electrician, supplier];
  assert.deepEqual(contactsForSituation(contacts, 'POWER CUT').map((c) => c.id), ['c3', 'c2']);
  assert.deepEqual(contactsForSituation(contacts, 'upstream outage').map((c) => c.id), ['c3', 'c1']);
  assert.deepEqual(contactsForSituation(contacts, 'anything at all').map((c) => c.id), ['c3']);
  assert.deepEqual(contactsForSituation(contacts, ''), []);
});

test('summary text, HTML escaping, CSV, filename — and no dial link, no money field', () => {
  const card = { contacts: [upstream, electrician], escalationOrder: ['c1'] };
  assert.equal(
    emergencyCardSummaryText(card),
    '2 emergency contacts. call first: Upstream Support Desk (Upstream support).',
  );
  assert.equal(
    emergencyCardSummaryText({ contacts: [], escalationOrder: [], escalationNote: '' }),
    '0 emergency contacts.',
  );
  const nasty = { ...upstream, name: '<script>alert(1)</script>' };
  const html = emergencyCardHtml({ contacts: [nasty], escalationOrder: [] });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('tel:'));
  assert.ok(!html.includes('href='));
  assert.equal(emergencyCardHtml({ contacts: [] }), '<p>No emergency contacts yet.</p>');
  const csv = emergencyContactsCsv({ contacts: [{ ...upstream, note: 'says "call first", please' }], escalationOrder: ['c1'] });
  assert.ok(csv.startsWith('Order,Name,Role,Phone,Covers,Note'));
  assert.ok(csv.includes('"says ""call first"", please"'));
  assert.equal(emergencyCardFilename('2026-11-04'), 'emergency-contacts-2026-11-04.csv');
  assert.equal(emergencyCardFilename('not-a-date'), 'emergency-contacts-undated.csv');
  const keys = Object.keys(normalizeEmergencyContact(upstream));
  for (const forbidden of ['bill', 'payment', 'customerId', 'ticketId', 'amount']) {
    assert.ok(!keys.includes(forbidden), `must not carry ${forbidden}`);
  }
});
