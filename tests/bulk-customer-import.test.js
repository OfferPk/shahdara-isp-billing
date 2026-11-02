import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, addCustomer, archiveCustomer } from '../core.js';
import { applyCustomerPlan } from '../customer-plan.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  normalizePhonePlus92, phoneNationalKey, parseBulkImportText,
  computeBulkStatuses, summarizeBulkRows, importBulkCustomers,
  computeBulkStatusesWithEnrich, summarizeBulkEnrich, importBulkCustomersWithEnrich,
  customerHasPackage
} from '../bulk-customer-import.js';

const URDU_RE = /[\u0600-\u06FF]/;

test('SISP-53: +92 phone normalization collapses every local form to one value', () => {
  assert.equal(normalizePhonePlus92('03001234567'), '+923001234567');
  assert.equal(normalizePhonePlus92('0300 1234567'), '+923001234567');
  assert.equal(normalizePhonePlus92('0300-1234567'), '+923001234567');
  assert.equal(normalizePhonePlus92('+923001234567'), '+923001234567');
  assert.equal(normalizePhonePlus92('+92 300 1234567'), '+923001234567');
  assert.equal(normalizePhonePlus92('00923001234567'), '+923001234567');
  assert.equal(normalizePhonePlus92('923001234567'), '+923001234567');
  assert.equal(normalizePhonePlus92(''), '');
  assert.equal(normalizePhonePlus92('12345'), '');
  assert.equal(normalizePhonePlus92('02134567890'), '');
  assert.equal(phoneNationalKey('03001234567'), '3001234567');
  assert.equal(phoneNationalKey('+923001234567'), '3001234567');
});

test('SISP-53: Excel TSV paste with a header row maps columns in any order', () => {
  const text = 'Name\tConnection ID\tFee\tPhone\tPackage\tArea\n' +
    'ALI KHAN\t101\t3000\t03001234567\t15Mbps Unlimited\tBARRIAN\n' +
    'SAIM RAZA\t102\t1500\t+923214567890\t5Mbps / 150GB\tPALALIYAA';
  const { rows, header, delimiter } = parseBulkImportText(text);
  assert.equal(header, true);
  assert.equal(delimiter, '\t');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].connectionId, 101);
  assert.equal(rows[0].name, 'ALI KHAN');
  assert.equal(rows[0].phone, '+923001234567');
  assert.equal(rows[0].packageId, '15mbps-unlimited');
  assert.equal(rows[0].fee, 3000);
  assert.equal(rows[0].area, 'BARRIAN');
  assert.match(rows[0].urduName, URDU_RE);
  assert.equal(rows[1].packageId, '5mbps-150gb');
});

test('SISP-53: CSV header row, quoted cells, and Rs-formatted fees parse', () => {
  const text = 'Connection ID,Name,Phone,Package,Fee,Area\n' +
    '201,"Raza, Ali",03001112233,15Mbps Unlimited,"Rs 3,000",Shahdara\n' +
    '202,Usman,03215550001,5mbps,1500,';
  const { rows, header } = parseBulkImportText(text);
  assert.equal(header, true);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'Raza, Ali');
  assert.equal(rows[0].fee, 3000);
  assert.equal(rows[0].phone, '+923001112233');
  assert.equal(rows[1].fee, 1500);
});

test('SISP-53: headerless register paste takes Connection ID first when numeric', () => {
  const { rows, header } = parseBulkImportText('301\tBILAL\t03001234567\t5Mbps / 150GB\t1500\tBARRIAN');
  assert.equal(header, false);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].connectionId, 301);
  assert.equal(rows[0].name, 'BILAL');
  assert.equal(rows[0].phone, '+923001234567');
});

test('SISP-53: duplicate Connection ID and duplicate phone (any format) are flagged, never importable', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'EXISTING ONE', new Date(), { phone: '03001234567' });
  const existingNo = state.customers[0].customerNumber;
  const text = 'Connection ID,Name,Phone,Package,Fee,Area\n' +
    `${existingNo},COPY ID,03215550001,5mbps,1500,\n` +
    '999,COPY PHONE,+923001234567,5mbps,1500,\n' +
    '998,OK ROW,03009998877,5mbps,1500,';
  const { rows } = parseBulkImportText(text);
  const statuses = computeBulkStatuses(rows, state.customers);
  assert.equal(statuses[0].status, 'duplicate-connection');
  assert.equal(statuses[0].included, false);
  assert.match(statuses[0].detail, /already belongs/);
  assert.equal(statuses[1].status, 'duplicate-phone');
  assert.equal(statuses[1].included, false);
  assert.equal(statuses[2].status, 'ok');
  assert.equal(statuses[2].included, true);
});

test('SISP-53: same Connection ID twice in one paste flags the second row', () => {
  const { rows } = parseBulkImportText('Connection ID,Name,Phone,Package,Fee\n555,ONE,03001111111,5mbps,1500\n555,TWO,03002222222,5mbps,1500');
  const statuses = computeBulkStatuses(rows, []);
  assert.equal(statuses[0].status, 'ok');
  assert.equal(statuses[1].status, 'duplicate-connection');
  assert.match(statuses[1].detail, /line 2|Same Connection ID as line/);
});

test('SISP-53: invalid phone and missing name are errors, missing fee is tickable', () => {
  const { rows } = parseBulkImportText('Connection ID,Name,Phone,Package,Fee\n1,BAD PHONE,12345,5mbps,1500\n2,,03001111111,5mbps,1500\n3,NOFEE,03002222222,5mbps,');
  const statuses = computeBulkStatuses(rows, []);
  assert.equal(statuses[0].status, 'error');
  assert.equal(statuses[0].included, false);
  assert.equal(statuses[1].status, 'error');
  assert.equal(statuses[2].status, 'missing-fee');
  assert.equal(statuses[2].included, false);
  const ticked = computeBulkStatuses(rows.map(r => (r.line === 4 ? { ...r, include: true } : r)), []);
  assert.equal(ticked[2].included, true);
  assert.deepEqual(summarizeBulkRows(statuses), { total: 3, ready: 0, skipped: 3, attention: 3, duplicates: 0 });
});

test('SISP-53 spec criterion: 5 valid CSV rows + 1 duplicate Connection ID row imports 5 with Urdu names and flags the 1 duplicate, without crashing', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'REGISTER OWNER', new Date(), { phone: '03000000000' });
  const taken = state.customers[0].customerNumber;
  const csv = 'Connection ID,Name,Phone,Package,Fee,Area\n' +
    '101,ALI KHAN,03001234567,15Mbps Unlimited,3000,BARRIAN\n' +
    '102,SAIM RAZA,03214567890,5Mbps / 150GB,1500,PALALIYAA\n' +
    '103,BILAL AHMED,03331234567,5Mbps / 200GB,2000,CHARYAA\n' +
    '104,USMAN GHANI,03451234567,3Mbps / 100GB,1000,GANGALL\n' +
    '105,HAMZA TARIQ,03019876543,5Mbps / 500GB,2500,MALLA\n' +
    `${taken},DUPLICATE ID,03001112233,5Mbps / 150GB,1500,BARRIAN`;
  const { rows } = parseBulkImportText(csv);
  assert.equal(rows.length, 6);
  const statuses = computeBulkStatuses(rows, state.customers);
  assert.equal(statuses.filter(s => s.status === 'ok').length, 5);
  assert.equal(statuses[5].status, 'duplicate-connection');
  assert.equal(statuses[5].included, false);
  const res = importBulkCustomers(state, statuses, { referenceDate: new Date('2026-10-29T12:00:00') });
  assert.equal(res.added, 5);
  assert.equal(res.skipped, 1);
  const added = res.nextState.customers.filter(c => res.addedIds.includes(c.id));
  assert.deepEqual(added.map(c => c.customerNumber), [101, 102, 103, 104, 105]);
  for (const c of added) assert.match(c.nameUrdu, URDU_RE, `${c.name} should carry an Urdu name`);
  assert.ok(added.every(c => c.phone.startsWith('+92')));
  assert.equal(res.nextState.customers.some(c => c.name === 'DUPLICATE ID'), false);
});

test('SISP-53: requested Connection ID in core is honoured when free, rejected when taken, and never rewinds nextCustomerNumber', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'FIRST', new Date(), {});
  assert.equal(state.customers[0].customerNumber, 1);
  state = addCustomer(state, 'GAP FILL', new Date(), { requestedCustomerNumber: 7 });
  assert.equal(state.customers[1].customerNumber, 7);
  assert.ok(state.nextCustomerNumber > 7);
  assert.throws(() => addCustomer(state, 'CLASH', new Date(), { requestedCustomerNumber: 7 }), /already in use/);
  state = addCustomer(state, 'NEXT', new Date(), {});
  assert.equal(state.customers[2].customerNumber, 8);
});

test('SISP-53 follow-up: an archived customer\'s Connection ID is flagged in preview and can never import', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'OLD ARCHIVED', new Date(), { phone: '03001110000' });
  const archivedNo = state.customers[0].customerNumber;
  state = archiveCustomer(state, state.customers[0].id);
  const { rows } = parseBulkImportText(`Connection ID,Name,Phone,Package,Fee\n${archivedNo},REUSE ID,03002220000,5mbps,1500\n${archivedNo + 50},FRESH ONE,03003330000,5mbps,1500`);
  const statuses = computeBulkStatuses(rows, state.customers);
  assert.equal(statuses[0].status, 'duplicate-connection');
  assert.equal(statuses[0].included, false);
  assert.match(statuses[0].detail, /archived/);
  assert.equal(statuses[1].status, 'ok');
  const res = importBulkCustomers(state, statuses, { referenceDate: new Date('2026-10-29T12:00:00') });
  assert.equal(res.added, 1);
  assert.equal(res.nextState.customers.some(c => c.name === 'REUSE ID'), false);
  assert.equal(res.nextState.customers.some(c => c.name === 'FRESH ONE'), true);
});

test('SISP-53 follow-up: one row failing mid-import does not lose the rest of the batch', () => {
  let previewState = createInitialState([]);
  previewState = addCustomer(previewState, 'PREVIEW OWNER', new Date(), { phone: '03000000000' });
  const { rows } = parseBulkImportText('Connection ID,Name,Phone,Package,Fee\n201,FIRST OK,03001111111,5mbps,1500\n202,SECOND OK,03002222222,5mbps,1500');
  const statuses = computeBulkStatuses(rows, previewState.customers);
  // Between preview and import, another operator takes Connection ID 201.
  let importState = previewState;
  importState = addCustomer(importState, 'LATE TAKER', new Date(), { phone: '03009990000', requestedCustomerNumber: 201 });
  const res = importBulkCustomers(importState, statuses, { referenceDate: new Date('2026-10-29T12:00:00') });
  assert.equal(res.added, 1);
  assert.equal(res.failed.length, 1);
  assert.equal(res.failed[0].line, 2);
  assert.equal(res.nextState.customers.some(c => c.name === 'SECOND OK'), true);
  assert.equal(res.nextState.customers.some(c => c.name === 'FIRST OK'), false);
});

test('SISP-53 follow-up: blank lines in the paste do not shift reported line numbers', () => {
  const text = 'Connection ID,Name,Phone,Package,Fee\n' +
    '301,ONE,03001111111,5mbps,1500\n' +
    '\n' +
    '   \n' +
    '302,TWO,03002222222,5mbps,1500';
  const { rows } = parseBulkImportText(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].line, 2);
  assert.equal(rows[1].line, 5);
  const statuses = computeBulkStatuses(rows, []);
  assert.equal(statuses[1].line, 5);
});

test('SISP-53 follow-up: every bci_ key the wizard renders exists in English and Urdu', () => {
  const keys = ['bci_status_ok', 'bci_status_missing_fee', 'bci_status_dup_id', 'bci_status_dup_phone',
    'bci_status_error', 'bci_detail_bad_phone', 'bci_detail_dup_id', 'bci_detail_dup_id_archived',
    'bci_detail_dup_id_twin', 'bci_detail_dup_phone', 'bci_detail_dup_phone_twin', 'bci_detail_missing_fee',
    'bci_row', 'bci_rows', 'bci_to_add', 'bci_need_look', 'bci_line', 'bci_no_package', 'bci_no_fee',
    'bci_more', 'bci_import_row', 'bci_done_failed'];
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur key ${key}`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur key ${key} fell back to the key itself`);
  }
});

/* ---------------- SISP-197: enrich mode ---------------- */

const REF197 = new Date('2026-10-29T12:00:00');

/** Add a synthetic customer, optionally with a catalogue package applied. */
function addTestCustomer(state, name, { phone = '', mohalla = '', free = false, plan = null } = {}) {
  let next = addCustomer(state, name, REF197, { phone, mohalla, isFreeConnection: free, allowDuplicateName: true });
  const cust = next.customers.at(-1);
  if (plan) next = applyCustomerPlan(next, cust.id, plan, REF197).nextState;
  return { state: next, customer: next.customers.find(c => c.id === cust.id) };
}

test('SISP-197: with the mode off (or not requested) statuses are the shipped wizard, untouched', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST OFF MODE', { phone: '03001110001' }));
  const num = s.customers[0].customerNumber;
  const { rows } = parseBulkImportText(`Connection ID,Name,Phone,Package,Fee\n${num},TEST OFF MODE,03002220002,5Mbps / 150GB,1500`);
  const plain = computeBulkStatuses(rows, s.customers);
  assert.equal(plain[0].status, 'duplicate-connection');
  assert.deepEqual(computeBulkStatusesWithEnrich(rows, s.customers), plain);
  assert.deepEqual(computeBulkStatusesWithEnrich(rows, s.customers, { enrich: false }), plain);
  assert.equal('enrich' in plain[0], false);
});

test('SISP-197: blank phone is filled on the Connection ID match and the stored package is kept', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST GAP PHONE', { mohalla: 'BARRIAN', plan: { packageLabel: '5Mbps / 150GB', fee: 1500 } }));
  const num = s.customers[0].customerNumber;
  assert.equal(s.customers[0].phone, '');
  const { rows } = parseBulkImportText(`Connection ID,Name,Phone,Package,Fee\n${num},TEST GAP PHONE,03002222222,15Mbps Unlimited,3000`);
  const statuses = computeBulkStatusesWithEnrich(rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'enrich');
  assert.equal(statuses[0].enrich.phone, 'fill');
  assert.equal(statuses[0].enrich.package, 'kept');
  assert.equal(statuses[0].included, true);
  assert.match(statuses[0].detail, /Adds phone \+923002222222/);
  assert.match(statuses[0].detail, /already has a package/);
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197, connectionDate: '2026-10-29' });
  assert.equal(res.added, 0);
  assert.equal(res.enrichedPhones, 1);
  assert.equal(res.enrichedPackages, 0);
  assert.equal(res.nextState.customers.length, 1);
  const after = res.nextState.customers[0];
  assert.equal(after.phone, '+923002222222');
  assert.equal(after.packageSpeed, '5Mbps / 150GB');
  assert.equal(after.monthlySellingAmount, 1500);
  assert.equal(after.customerNumber, num);
});

test('SISP-197: blank package is filled on the phone match through applyCustomerPlan, stored phone kept', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST GAP PKG', { phone: '03003333333', mohalla: 'PALALIYAA' }));
  assert.equal(customerHasPackage(s.customers[0]), false);
  const { rows } = parseBulkImportText('Name,Phone,Package,Fee\nTEST GAP PKG,+923003333333,5Mbps / 150GB,1500');
  const statuses = computeBulkStatusesWithEnrich(rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'enrich');
  assert.equal(statuses[0].enrich.phone, 'kept');
  assert.equal(statuses[0].enrich.package, 'fill');
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197, connectionDate: '2026-10-29' });
  assert.equal(res.added, 0);
  assert.equal(res.enrichedPhones, 0);
  assert.equal(res.enrichedPackages, 1);
  assert.ok(res.billed >= 1, 'the plan application creates the current month bill');
  const after = res.nextState.customers[0];
  assert.equal(after.phone, '03003333333', 'the stored phone is kept exactly as recorded');
  assert.equal(after.packageSpeed, '5Mbps / 150GB');
  assert.equal(after.monthlySellingAmount, 1500);
  assert.ok(after.bills.some(b => b.month === '2026-10'), 'current-month bill exists, as a normal package assignment creates');
  assert.ok(after.packageHistory.length >= 1, 'package history is recorded, as the profile plan path records it');
  assert.equal(after.connectionDate, null, 'enrich never rewrites the recorded connection date');
});

test('SISP-197: a stored phone is never overwritten, even when the sheet phone differs (per-field independence)', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST KEEP PHONE', { phone: '03004444444' }));
  const num = s.customers[0].customerNumber;
  const { rows } = parseBulkImportText(`Connection ID,Name,Phone,Package,Fee\n${num},TEST KEEP PHONE,03005555555,15Mbps Unlimited,3000`);
  const statuses = computeBulkStatusesWithEnrich(rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'enrich');
  assert.equal(statuses[0].enrich.phone, 'kept');
  assert.equal(statuses[0].enrich.package, 'fill');
  assert.match(statuses[0].detail, /already has a phone/);
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197 });
  const after = res.nextState.customers[0];
  assert.equal(after.phone, '03004444444', 'the stored phone wins over the sheet');
  assert.equal(after.packageSpeed, '15Mbps Unlimited', 'the blank package still fills');
});

test('SISP-197: a customer with phone and package already stored is enrich-none and byte-unchanged', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST COMPLETE', { phone: '03004444444', plan: { packageLabel: '5Mbps / 150GB', fee: 1500 } }));
  const num = s.customers[0].customerNumber;
  const before = s.customers[0];
  const { rows } = parseBulkImportText(`Connection ID,Name,Phone,Package,Fee\n${num},TEST COMPLETE,03005555555,15Mbps Unlimited,3000`);
  const statuses = computeBulkStatusesWithEnrich(rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'enrich-none');
  assert.equal(statuses[0].included, false);
  assert.match(statuses[0].detail, /already has a phone/);
  assert.match(statuses[0].detail, /already has a package/);
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197 });
  assert.equal(res.enrichSkipped, 1);
  assert.deepEqual(res.nextState.customers[0], before);
});

test('SISP-197: two live customers sharing one phone make the match ambiguous — neither is touched', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST AMB ONE', { phone: '03006666666' }));
  ({ state: s } = addTestCustomer(s, 'TEST AMB TWO', { phone: '03006666666' }));
  const { rows } = parseBulkImportText('Name,Phone,Package,Fee\nWHOEVER,03006666666,5Mbps / 150GB,1500');
  const statuses = computeBulkStatusesWithEnrich(rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'enrich-ambiguous');
  assert.equal(statuses[0].included, false);
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197 });
  assert.equal(res.enrichAmbiguous, 1);
  assert.equal(res.enrichedPackages, 0);
  assert.ok(res.nextState.customers.every(c => !customerHasPackage(c)), 'no package was guessed onto either customer');
});

test('SISP-197: a row carrying customer A\'s Connection ID and customer B\'s phone is ambiguous', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST ID OWNER', {}));
  ({ state: s } = addTestCustomer(s, 'TEST PHONE OWNER', { phone: '03007777777' }));
  const idNum = s.customers[0].customerNumber;
  const { rows } = parseBulkImportText(`Connection ID,Name,Phone,Package,Fee\n${idNum},MIXED ROW,03007777777,5Mbps / 150GB,1500`);
  const statuses = computeBulkStatusesWithEnrich(rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'enrich-ambiguous');
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197 });
  assert.equal(res.nextState.customers[0].phone, '', 'the ID owner was not given the other customer\'s phone');
  assert.equal(customerHasPackage(res.nextState.customers[0]), false);
});

test('SISP-197: a free connection gains a phone but never a priced package', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST FREE GAP', { free: true }));
  const num = s.customers[0].customerNumber;
  const { rows } = parseBulkImportText(`Connection ID,Name,Phone,Package,Fee\n${num},TEST FREE GAP,03008888888,5Mbps / 150GB,1500`);
  const statuses = computeBulkStatusesWithEnrich(rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'enrich');
  assert.equal(statuses[0].enrich.phone, 'fill');
  assert.equal(statuses[0].enrich.package, 'free');
  assert.match(statuses[0].detail, /free connection/);
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197 });
  assert.equal(res.enrichedPhones, 1);
  assert.equal(res.enrichedPackages, 0);
  const after = res.nextState.customers[0];
  assert.equal(after.phone, '+923008888888');
  assert.equal(after.packageSpeed, '');
  assert.equal(after.monthlySellingAmount, null);
  assert.equal(after.bills.length, 0);
  assert.equal(after.isFreeConnection, true);
});

test('SISP-197: an unusable phone and an unrecognised package on a matched row are skipped per field, with reasons', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST BAD FIELDS', {}));
  const num = s.customers[0].customerNumber;
  const { rows } = parseBulkImportText(`Connection ID,Name,Phone,Package,Fee\n${num},TEST BAD FIELDS,12345,999Mbps,`);
  const statuses = computeBulkStatusesWithEnrich(rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'enrich-none');
  assert.equal(statuses[0].enrich.phone, 'invalid');
  assert.equal(statuses[0].enrich.package, 'invalid');
  assert.match(statuses[0].detail, /looks wrong/);
  assert.match(statuses[0].detail, /not recognised/);
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197 });
  assert.deepEqual(res.nextState.customers[0], s.customers[0], 'nothing was applied');
});

test('SISP-197: a bad phone does not block the same row\'s valid package fill', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST BAD PHONE GOOD PKG', {}));
  const num = s.customers[0].customerNumber;
  const { rows } = parseBulkImportText(`Connection ID,Name,Phone,Package,Fee\n${num},TEST BAD PHONE GOOD PKG,12345,5Mbps / 150GB,1500`);
  const statuses = computeBulkStatusesWithEnrich(rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'enrich');
  assert.equal(statuses[0].enrich.phone, 'invalid');
  assert.equal(statuses[0].enrich.package, 'fill');
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197 });
  const after = res.nextState.customers[0];
  assert.equal(after.phone, '', 'the unusable phone was not stored');
  assert.equal(after.packageSpeed, '5Mbps / 150GB');
});

test('SISP-197: name + mohalla resolves a bad-phone row; two same-name customers in one mohalla make it ambiguous', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST NAME MATCH', { mohalla: 'BARRIAN' }));
  const text = 'Name,Phone,Package,Fee,Area\nTEST NAME MATCH,123,5Mbps / 150GB,1500,BARRIAN';
  const first = computeBulkStatusesWithEnrich(parseBulkImportText(text).rows, s.customers, { enrich: true });
  assert.equal(first[0].status, 'enrich');
  assert.equal(first[0].enrich.customerId, s.customers[0].id);
  assert.equal(first[0].enrich.package, 'fill');
  assert.equal(first[0].enrich.phone, 'invalid');
  ({ state: s } = addTestCustomer(s, 'TEST NAME MATCH', { mohalla: 'BARRIAN' }));
  const second = computeBulkStatusesWithEnrich(parseBulkImportText(text).rows, s.customers, { enrich: true });
  assert.equal(second[0].status, 'enrich-ambiguous');
  assert.equal(second[0].included, false);
});

test('SISP-197: an archived customer\'s row stays a plain duplicate and is never enriched', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST ARCHIVED GAP', { phone: '03009999999' }));
  const id = s.customers[0].id;
  const num = s.customers[0].customerNumber;
  s = archiveCustomer(s, id);
  const { rows } = parseBulkImportText(`Connection ID,Name,Phone,Package,Fee\n${num},TEST ARCHIVED GAP,03001112222,5Mbps / 150GB,1500`);
  const statuses = computeBulkStatusesWithEnrich(rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'duplicate-connection');
  assert.match(statuses[0].detail, /archived/);
  assert.equal(statuses[0].included, false);
  const beforeArchived = s.customers.find(c => c.id === id);
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197 });
  const after = res.nextState.customers.find(c => c.id === id);
  assert.deepEqual(after, beforeArchived, 'the archived record is untouched');
  assert.equal(customerHasPackage(after), false);
});

test('SISP-197: the first row in a paste claims a customer; a twin row for them stays a duplicate', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST CLAIMED', { plan: { packageLabel: '5Mbps / 150GB', fee: 1500 } }));
  const num = s.customers[0].customerNumber;
  const text = `Connection ID,Name,Phone,Package,Fee\n${num},TEST CLAIMED,03001111111,5Mbps / 150GB,1500\n${num},TEST CLAIMED,03002222222,5Mbps / 150GB,1500`;
  const statuses = computeBulkStatusesWithEnrich(parseBulkImportText(text).rows, s.customers, { enrich: true });
  assert.equal(statuses[0].status, 'enrich');
  assert.equal(statuses[1].status, 'duplicate-connection');
  assert.match(statuses[1].detail, /already belongs to TEST CLAIMED/);
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197 });
  assert.equal(res.nextState.customers[0].phone, '+923001111111', 'the first row\'s phone is the one applied');
});

test('SISP-197: end-to-end counts are exact and rows matching nobody still import as new customers', () => {
  let s = createInitialState([]);
  ({ state: s } = addTestCustomer(s, 'TEST E2E GAP', { plan: { packageLabel: '5Mbps / 150GB', fee: 1500 } }));
  ({ state: s } = addTestCustomer(s, 'TEST E2E FULL', { phone: '03003330000', plan: { packageLabel: '5Mbps / 150GB', fee: 1500 } }));
  ({ state: s } = addTestCustomer(s, 'TEST E2E AMB ONE', { phone: '03006666666' }));
  ({ state: s } = addTestCustomer(s, 'TEST E2E AMB TWO', { phone: '03006666666' }));
  const gapNum = s.customers[0].customerNumber;
  const fullNum = s.customers[1].customerNumber;
  const text = 'Connection ID,Name,Phone,Package,Fee\n' +
    `${gapNum},TEST E2E GAP,03001110000,5Mbps / 150GB,1500\n` +
    `${fullNum},TEST E2E FULL,03004440000,15Mbps Unlimited,3000\n` +
    ',AMB ROW,03006666666,5Mbps / 150GB,1500\n' +
    '777,TEST BRAND NEW,03008880000,5Mbps / 150GB,1500';
  const statuses = computeBulkStatusesWithEnrich(parseBulkImportText(text).rows, s.customers, { enrich: true });
  assert.deepEqual(summarizeBulkEnrich(statuses), { fill: 1, none: 1, ambiguous: 1, phones: 1, packages: 0 });
  const newRow = statuses.find(r => r.name === 'TEST BRAND NEW');
  assert.equal(newRow.status, 'ok', 'a row matching nobody is still a normal new import in enrich mode');
  const res = importBulkCustomersWithEnrich(s, statuses, { referenceDate: REF197, connectionDate: '2026-10-29' });
  assert.equal(res.added, 1);
  assert.equal(res.nextState.customers.find(c => c.name === 'TEST BRAND NEW').customerNumber, 777);
  assert.equal(res.enrichedPhones, 1);
  assert.equal(res.enrichedPackages, 0);
  assert.equal(res.enrichedCustomers, 1);
  assert.equal(res.enrichSkipped, 1);
  assert.equal(res.enrichAmbiguous, 1);
  assert.equal(res.enrichFailed.length, 0);
  assert.equal(res.nextState.customers.find(c => c.name === 'TEST E2E GAP').phone, '+923001110000');
});

test('SISP-197: every new bci_ enrich key exists in English and Urdu with matching placeholders', () => {
  const keys = ['bci_enrich_mode', 'bci_status_enrich', 'bci_status_enrich_none', 'bci_status_enrich_ambiguous',
    'bci_enrich_add_phone', 'bci_enrich_add_package', 'bci_enrich_kept_phone', 'bci_enrich_kept_package',
    'bci_enrich_free_package', 'bci_enrich_bad_phone_field', 'bci_enrich_bad_package_field', 'bci_enrich_nothing',
    'bci_enrich_ambiguous', 'bci_enrich_row', 'bci_to_enrich', 'bci_done_enrich', 'bci_enrich_failed'];
  const placeholders = str => [...String(str).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur key ${key}`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur key ${key} fell back to the key itself`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder mismatch for ${key}`);
  }
});
