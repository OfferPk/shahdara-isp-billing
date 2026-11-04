import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COMPLAINT_ACK_NEXT_STEPS,
  complaintAckNextStepText,
  normalizeComplaintAck,
  normalizeComplaintAckList,
  findComplaintAck,
  upsertComplaintAck,
  removeComplaintAck,
  acknowledgementsForCustomer,
  acknowledgedCustomers,
  unacknowledgedCustomers,
  complaintAckSummaryText,
  complaintAckDraftText,
  complaintAckAllHtml,
  complaintAckCustomerHtml,
  complaintAckCsv,
  complaintAckFilename,
} from '../complaint-ack.js';

const dir = dirname(fileURLToPath(import.meta.url));

const ack = (over = {}) => ({
  id: 'ACK-1',
  customerId: 'CUS-1',
  dateReceived: '2026-11-03',
  complaint: 'Net slow in the evening',
  nextStep: 'next-working-day',
  ...over,
});

test('strict dates: 31-day months pass, Feb 30 and Apr 31 refused', () => {
  assert.equal(normalizeComplaintAck(ack({ dateReceived: '2026-08-31' })).dateReceived, '2026-08-31');
  assert.equal(normalizeComplaintAck(ack({ dateReceived: '2026-10-31' })).dateReceived, '2026-10-31');
  assert.equal(normalizeComplaintAck(ack({ dateReceived: '2026-12-31' })).dateReceived, '2026-12-31');
  assert.equal(normalizeComplaintAck(ack({ dateReceived: '2026-02-30' })), null);
  assert.equal(normalizeComplaintAck(ack({ dateReceived: '2026-04-31' })), null);
  assert.equal(normalizeComplaintAck(ack({ dateReceived: '2026-02-29' })), null);
  assert.equal(normalizeComplaintAck(ack({ dateReceived: '2024-02-29' })).dateReceived, '2024-02-29');
});

test('half-formed refusal: no customer, no date, no complaint, no id, or no next step refused', () => {
  assert.equal(normalizeComplaintAck(ack({ customerId: '' })), null);
  assert.equal(normalizeComplaintAck(ack({ dateReceived: '' })), null);
  assert.equal(normalizeComplaintAck(ack({ complaint: '  ' })), null);
  assert.equal(normalizeComplaintAck(ack({ id: '' })), null);
  assert.equal(normalizeComplaintAck(ack({ nextStep: '' })), null);
  assert.equal(normalizeComplaintAck(ack({ nextStep: 'we will fix it tomorrow' })), null);
});

test('fixed next-step list only: free-form promise of a fix date refused', () => {
  assert.equal(normalizeComplaintAck(ack({ nextStep: 'fixed by Friday' })), null);
  assert.equal(Object.keys(COMPLAINT_ACK_NEXT_STEPS).length, 4);
  assert.match(complaintAckNextStepText('next-working-day'), /next working day/);
  assert.equal(complaintAckNextStepText('anything else'), '');
});

test('unknown fields dropped, never stored', () => {
  const item = normalizeComplaintAck(ack({ billId: 'B-1', status: 'closed', fixDate: '2026-11-05' }));
  assert.deepEqual(Object.keys(item).sort(), ['complaint', 'customerId', 'dateReceived', 'id', 'nextStep']);
});

test('duplicate ids never rewritten', () => {
  const first = upsertComplaintAck([], ack());
  assert.equal(upsertComplaintAck(first, ack()).length, 1);
  assert.equal(upsertComplaintAck(first, ack({ complaint: 'Different words' })).length, 1);
  assert.equal(upsertComplaintAck(first, ack({ complaint: 'Different words' }))[0].complaint, 'Net slow in the evening');
});

test('find and remove', () => {
  const list = upsertComplaintAck(upsertComplaintAck([], ack()), ack({ id: 'ACK-2' }));
  assert.equal(findComplaintAck(list, 'ACK-2').id, 'ACK-2');
  assert.equal(findComplaintAck(list, 'ACK-9'), null);
  assert.equal(removeComplaintAck(list, 'ACK-1').length, 1);
  assert.equal(removeComplaintAck(list, '').length, 2);
});

test('customer ordering newest first, case-insensitive match', () => {
  const list = [
    ack({ id: 'ACK-1', dateReceived: '2026-11-01' }),
    ack({ id: 'ACK-2', dateReceived: '2026-11-03' }),
    ack({ id: 'ACK-3', customerId: 'CUS-2', dateReceived: '2026-11-02' }),
  ];
  assert.deepEqual(acknowledgementsForCustomer(list, 'cus-1').map((item) => item.id), ['ACK-2', 'ACK-1']);
  assert.deepEqual(acknowledgementsForCustomer(list, ''), []);
});

test('acknowledged and unacknowledged customers', () => {
  const list = [ack({ customerId: 'CUS-1' }), ack({ id: 'ACK-2', customerId: 'cus-1' }), ack({ id: 'ACK-3', customerId: 'CUS-2' })];
  assert.deepEqual(acknowledgedCustomers(list), ['CUS-1', 'CUS-2']);
  assert.deepEqual(unacknowledgedCustomers(['CUS-1', 'CUS-3', 'cus-2'], list), ['CUS-3']);
  assert.deepEqual(unacknowledgedCustomers([], list), []);
});

test('summary text', () => {
  assert.equal(complaintAckSummaryText([]), '0 acknowledgements for 0 customers.');
  assert.equal(complaintAckSummaryText([ack()]), '1 acknowledgement for 1 customer.');
  assert.equal(complaintAckSummaryText([ack(), ack({ id: 'ACK-2', customerId: 'CUS-2' })]), '2 acknowledgements for 2 customers.');
});

test('draft text is prepared, never sent, and names the next step', () => {
  const draft = complaintAckDraftText(ack());
  assert.match(draft, /2026-11-03/);
  assert.match(draft, /Net slow in the evening/);
  assert.match(draft, /next working day/);
  assert.equal(complaintAckDraftText(ack({ nextStep: 'nope' })), '');
});

test('all HTML newest first, customer HTML shows unacknowledged plainly', () => {
  const list = [ack({ id: 'ACK-1', dateReceived: '2026-11-01' }), ack({ id: 'ACK-2', dateReceived: '2026-11-03' })];
  const all = complaintAckAllHtml(list);
  assert.ok(all.indexOf('ACK-2') < all.indexOf('ACK-1'));
  assert.match(complaintAckCustomerHtml(list, 'CUS-1'), /ACK-2/);
  assert.match(complaintAckCustomerHtml(list, 'CUS-9'), /unacknowledged/);
  assert.match(complaintAckAllHtml([]), /No complaint acknowledgement/);
});

test('HTML escaping in complaint text and customer id', () => {
  const list = [ack({ complaint: '<script>alert(1)</script>', customerId: 'CUS-<b>' })];
  const html = complaintAckAllHtml(list);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /CUS-&lt;b&gt;/);
});

test('CSV and filename', () => {
  const list = [ack({ complaint: 'Slow, "evening" net' })];
  const csv = complaintAckCsv(list);
  assert.match(csv, /^id,customerId,dateReceived,complaint,nextStep\n/);
  assert.match(csv, /"Slow, ""evening"" net"/);
  assert.equal(complaintAckFilename(), 'complaint-acknowledgements.csv');
});

test('inputs never mutated', () => {
  const record = ack({ extra: 'x' });
  const before = JSON.stringify(record);
  upsertComplaintAck([], record);
  normalizeComplaintAckList([record]);
  assert.equal(JSON.stringify(record), before);
});

test('purity fence: no imports, storage, clock, or network use', () => {
  const src = readFileSync(join(dir, '..', 'complaint-ack.js'), 'utf8');
  assert.doesNotMatch(src, /^\s*import\s/m);
  assert.doesNotMatch(src, /localStorage|fetch\(|XMLHttpRequest|Date\.now|new Date\(/);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['ackCustomer', 'ackDate', 'ackComplaint', 'ackNextStep', 'ackSaveBtn', 'ackRemoveId', 'ackRemoveBtn', 'ackExportBtn', 'ackFilter', 'ackCustomerBody', 'ackBody', 'ackSummary']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
