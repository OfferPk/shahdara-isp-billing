import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeBusinessContact,
  normalizeBusinessContactList,
  findBusinessContact,
  recordBusinessContact,
  removeBusinessContact,
  businessContactsSorted,
  businessContactsByOrganisation,
  businessContactsByRole,
  businessContactsBySearch,
  businessContactSummaryText,
  businessContactText,
  businessContactHtml,
  businessContactAllHtml,
  businessContactCsv,
  businessContactFilename,
} from '../business-contact.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'business-contact.js'), 'utf8');

const contactA = { id: 'BC-1', organisation: 'Fibre Supplier Ltd', contactName: 'Ayesha Khan', role: 'Sales', phoneOrAddress: '0300-1111111', note: 'Main supplier' };
const contactB = { id: 'BC-2', organisation: 'Fibre Supplier Ltd', contactName: 'Bilal Ahmed', role: 'Support', phoneOrAddress: 'Shop Street 12', note: '' };
const contactC = { id: 'BC-3', organisation: 'City Authority', contactName: 'Sara Malik', role: 'Permits', phoneOrAddress: '', note: 'Permit desk' };

test('half-formed contacts are refused', () => {
  assert.equal(normalizeBusinessContact(null), null);
  assert.equal(normalizeBusinessContact({}), null);
  assert.equal(normalizeBusinessContact({ id: 'BC-1', organisation: 'Org' }), null);
  assert.equal(normalizeBusinessContact({ id: 'BC-1', contactName: 'Name' }), null);
  assert.equal(normalizeBusinessContact({ organisation: 'Org', contactName: 'Name' }), null);
  assert.equal(normalizeBusinessContact({ id: '  ', organisation: 'Org', contactName: 'Name' }), null);
});

test('unknown fields are dropped so no bill, payment, vendor, customer, or sending field can creep in', () => {
  const clean = normalizeBusinessContact({ ...contactA, billId: 'B-1', payment: 500, customerId: 'C-1', vendorContract: 'VC-1', sendTo: '0300', password: 'secret' });
  assert.deepEqual(Object.keys(clean).sort(), ['contactName', 'id', 'note', 'organisation', 'phoneOrAddress', 'role']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordBusinessContact([], contactA);
  const again = recordBusinessContact(list, { ...contactA, contactName: 'Changed Name' });
  assert.equal(again.length, 1);
  assert.equal(again[0].contactName, 'Ayesha Khan');
});

test('find and remove work by id', () => {
  const list = [contactA, contactB, contactC];
  assert.equal(findBusinessContact(list, 'BC-2').contactName, 'Bilal Ahmed');
  assert.equal(findBusinessContact(list, 'BC-9'), null);
  assert.equal(findBusinessContact(list, ''), null);
  const removed = removeBusinessContact(list, 'BC-2');
  assert.equal(removed.length, 2);
  assert.equal(findBusinessContact(removed, 'BC-2'), null);
});

test('contacts sort by organisation, then contact name, then id', () => {
  const sorted = businessContactsSorted([contactC, contactB, contactA]);
  assert.deepEqual(sorted.map((c) => c.id), ['BC-3', 'BC-1', 'BC-2']);
});

test('organisation search is case-insensitive substring', () => {
  const list = [contactA, contactB, contactC];
  assert.deepEqual(businessContactsByOrganisation(list, 'fibre').map((c) => c.id), ['BC-1', 'BC-2']);
  assert.deepEqual(businessContactsByOrganisation(list, 'CITY').map((c) => c.id), ['BC-3']);
  assert.equal(businessContactsByOrganisation(list, '').length, 3);
});

test('role search is case-insensitive substring', () => {
  const list = [contactA, contactB, contactC];
  assert.deepEqual(businessContactsByRole(list, 'sales').map((c) => c.id), ['BC-1']);
  assert.deepEqual(businessContactsByRole(list, 'support').map((c) => c.id), ['BC-2']);
  assert.deepEqual(businessContactsByRole(list, 'no-such-role'), []);
});

test('combined search matches organisation, name, or role', () => {
  const list = [contactA, contactB, contactC];
  assert.deepEqual(businessContactsBySearch(list, 'sara').map((c) => c.id), ['BC-3']);
  assert.deepEqual(businessContactsBySearch(list, 'permits').map((c) => c.id), ['BC-3']);
  assert.equal(businessContactsBySearch(list, '').length, 3);
});

test('summary text counts contacts and organisations', () => {
  assert.equal(businessContactSummaryText([]), 'No business contacts recorded.');
  assert.equal(businessContactSummaryText([contactA]), '1 business contact across 1 organisation.');
  assert.equal(businessContactSummaryText([contactA, contactB, contactC]), '3 business contacts across 2 organisations.');
});

test('a contact with no note says so plainly', () => {
  assert.match(businessContactText(contactB), /No note\./);
  assert.match(businessContactText(contactA), /Main supplier/);
  assert.equal(businessContactText(null), '');
});

test('text rendering keeps phone or address as entered', () => {
  assert.match(businessContactText(contactA), /0300-1111111/);
  assert.match(businessContactText(contactB), /Shop Street 12/);
});

test('HTML escapes user text', () => {
  const html = businessContactHtml({ ...contactA, note: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(businessContactHtml(null), '');
  assert.match(businessContactAllHtml([contactA]), /Fibre Supplier Ltd/);
});

test('CSV columns and filename', () => {
  const csv = businessContactCsv([contactB, contactA]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,organisation,contact_name,role,phone_or_address,note');
  assert.match(lines[1], /^BC-1,/);
  assert.equal(businessContactFilename(), 'business-contacts.csv');
});

test('inputs are never mutated', () => {
  const input = { ...contactA };
  const before = JSON.stringify(input);
  recordBusinessContact([], input);
  businessContactsSorted([input]);
  assert.equal(JSON.stringify(input), before);
});

test('list normalization drops bad entries and duplicate ids', () => {
  const clean = normalizeBusinessContactList([contactA, null, { id: 'BC-1', organisation: 'Other', contactName: 'Dup' }, contactC]);
  assert.deepEqual(clean.map((c) => c.id), ['BC-1', 'BC-3']);
  assert.deepEqual(normalizeBusinessContactList('not-a-list'), []);
});

test('purity fence: the module is import-free and touches no storage, clock, or network', () => {
  assert.doesNotMatch(moduleSrc, /^import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['bcSummary', 'bcExportBtn', 'bcOrg', 'bcName', 'bcRole', 'bcReach', 'bcNote', 'bcSaveBtn', 'bcRemoveId', 'bcRemoveBtn', 'bcOrgFilter', 'bcRoleFilter', 'bcBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring is present', () => {
  assert.ok(appJs.includes("from './business-contact.js'"));
  assert.ok(appJs.includes('renderBusinessContacts'));
  assert.ok(appJs.includes('shahdara_business_contacts_v1'));
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const matches = appJs.match(/(?<![A-Za-z])OLT(?![A-Za-z])/g) ?? [];
  assert.equal(matches.length, 0);
});
