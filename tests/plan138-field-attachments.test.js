import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validFieldAttachmentDate,
  cleanFieldAttachmentType,
  normalizeFieldAttachment,
  normalizeFieldAttachmentList,
  findFieldAttachment,
  upsertFieldAttachment,
  removeFieldAttachment,
  fieldAttachmentsForCustomer,
  fieldAttachmentsForTicket,
  fieldAttachmentsForLink,
  fieldAttachmentSummaryText,
  fieldAttachmentHtml,
  fieldAttachmentCsv,
  fieldAttachmentFilename,
  FIELD_ATTACHMENT_TYPES,
} from '../field-attachments.js';

const dir = dirname(fileURLToPath(import.meta.url));

const item = (over = {}) => ({
  id: 'FA-1',
  customer: 'Ahmed',
  ticket: '',
  date: '2026-11-05',
  type: 'photo',
  description: 'Burnt connector at the premises.',
  fileRef: 'IMG_2041.jpg',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(validFieldAttachmentDate('2026-08-31'), '2026-08-31');
  assert.equal(validFieldAttachmentDate('2026-10-31'), '2026-10-31');
  assert.equal(validFieldAttachmentDate('2026-12-31'), '2026-12-31');
  assert.equal(validFieldAttachmentDate('2026-02-30'), null);
  assert.equal(validFieldAttachmentDate('2026-04-31'), null);
  assert.equal(validFieldAttachmentDate('2026-09-31'), null);
  assert.equal(validFieldAttachmentDate('2026-11-31'), null);
  assert.equal(validFieldAttachmentDate('not-a-date'), null);
  assert.equal(validFieldAttachmentDate(''), null);
  assert.equal(validFieldAttachmentDate(20261105), null);
});

test('type cleaning: photo/note only, case-insensitive', () => {
  assert.equal(cleanFieldAttachmentType('photo'), 'photo');
  assert.equal(cleanFieldAttachmentType('Photo'), 'photo');
  assert.equal(cleanFieldAttachmentType('NOTE'), 'note');
  assert.equal(cleanFieldAttachmentType('video'), null);
  assert.equal(cleanFieldAttachmentType(''), null);
  assert.deepEqual(FIELD_ATTACHMENT_TYPES, ['photo', 'note']);
});

test('half-formed refusal: no link, no description, unknown type, bad date', () => {
  assert.equal(normalizeFieldAttachment(item({ customer: '', ticket: '' })), null);
  assert.equal(normalizeFieldAttachment(item({ customer: '', ticket: '', description: '' })), null);
  assert.equal(normalizeFieldAttachment(item({ description: '' })), null);
  assert.equal(normalizeFieldAttachment(item({ description: '   ' })), null);
  assert.equal(normalizeFieldAttachment(item({ type: 'video' })), null);
  assert.equal(normalizeFieldAttachment(item({ date: '2026-02-30' })), null);
  assert.equal(normalizeFieldAttachment(item({ id: '' })), null);
  assert.equal(normalizeFieldAttachment(null), null);
  assert.equal(normalizeFieldAttachment('nope'), null);
  // A ticket link alone is a valid link; a customer link alone is too.
  assert.ok(normalizeFieldAttachment(item({ customer: '', ticket: 'T-9' })));
  assert.ok(normalizeFieldAttachment(item({ ticket: '' })));
});

test('unknown fields dropped: no fault/bill/payment/file-content field can ever be stored', () => {
  const cleaned = normalizeFieldAttachment(item({
    faultStatus: 'fixed',
    billAmount: 3000,
    paymentId: 'P-1',
    data: 'base64bytes',
    blob: {},
    content: 'file-bytes',
    url: 'https://example.invalid/photo.jpg',
  }));
  assert.deepEqual(Object.keys(cleaned).sort(), ['customer', 'date', 'description', 'fileRef', 'id', 'ticket', 'type']);
  assert.equal(cleaned.fileRef, 'IMG_2041.jpg');
});

test('duplicate ids never rewritten; identical re-save unchanged', () => {
  const base = [item()];
  assert.equal(upsertFieldAttachment(base, item()).length, 1);
  assert.deepEqual(upsertFieldAttachment(base, item()), base);
  const changed = upsertFieldAttachment(base, item({ description: 'Different note.' }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].description, 'Burnt connector at the premises.');
  assert.equal(upsertFieldAttachment(base, item({ id: 'FA-2' })).length, 2);
});

test('list normalisation drops half-formed rows and duplicate ids', () => {
  const list = normalizeFieldAttachmentList([item(), item({ customer: '', ticket: '' }), item({ id: 'FA-1', description: 'Copy.' }), item({ id: 'FA-2', type: 'note', description: 'Visit note.' })]);
  assert.equal(list.length, 2);
  assert.equal(list[0].description, 'Burnt connector at the premises.');
});

test('customer listing newest first, case-insensitive; ticket listing exact', () => {
  const list = [
    item({ id: 'FA-1', date: '2026-11-01' }),
    item({ id: 'FA-2', date: '2026-11-05' }),
    item({ id: 'FA-3', date: '2026-11-05', customer: 'ahmed' }),
    item({ id: 'FA-4', customer: 'Bilal', date: '2026-11-06' }),
    item({ id: 'FA-5', customer: '', ticket: 'T-9', date: '2026-11-02' }),
  ];
  assert.deepEqual(fieldAttachmentsForCustomer(list, 'AHMED').map((row) => row.id), ['FA-2', 'FA-3', 'FA-1']);
  assert.deepEqual(fieldAttachmentsForCustomer(list, '').map((row) => row.id), []);
  assert.deepEqual(fieldAttachmentsForTicket(list, 'T-9').map((row) => row.id), ['FA-5']);
  assert.deepEqual(fieldAttachmentsForTicket(list, 't-9').map((row) => row.id), []);
  assert.deepEqual(fieldAttachmentsForTicket(list, '').map((row) => row.id), []);
});

test('link page: customer or ticket, newest first, empty link lists nothing', () => {
  const list = [
    item({ id: 'FA-1', date: '2026-11-01' }),
    item({ id: 'FA-2', customer: '', ticket: 'T-9', date: '2026-11-04' }),
    item({ id: 'FA-3', customer: 'Ahmed', ticket: 'T-9', date: '2026-11-03' }),
  ];
  assert.deepEqual(fieldAttachmentsForLink(list, 'Ahmed').map((row) => row.id), ['FA-3', 'FA-1']);
  assert.deepEqual(fieldAttachmentsForLink(list, 'T-9').map((row) => row.id), ['FA-2', 'FA-3']);
  assert.deepEqual(fieldAttachmentsForLink(list, 'Nobody').map((row) => row.id), []);
  assert.deepEqual(fieldAttachmentsForLink(list, '').map((row) => row.id), []);
});

test('find and remove by id', () => {
  const list = [item(), item({ id: 'FA-2', type: 'note', description: 'Visit note.' })];
  assert.equal(findFieldAttachment(list, 'FA-2').type, 'note');
  assert.equal(findFieldAttachment(list, 'FA-9'), null);
  assert.deepEqual(removeFieldAttachment(list, 'FA-1').map((row) => row.id), ['FA-2']);
  assert.deepEqual(removeFieldAttachment(list, 'FA-9').map((row) => row.id), ['FA-1', 'FA-2']);
});

test('inputs are never mutated', () => {
  const record = item();
  const before = JSON.stringify(record);
  const list = [record];
  upsertFieldAttachment(list, item({ id: 'FA-2' }));
  removeFieldAttachment(list, 'FA-1');
  fieldAttachmentsForCustomer(list, 'Ahmed');
  assert.equal(JSON.stringify(record), before);
  assert.equal(list.length, 1);
});

test('summary text: empty, single, and counts with metadata-only note', () => {
  assert.equal(fieldAttachmentSummaryText([]), 'No field attachment recorded yet.');
  assert.match(fieldAttachmentSummaryText([item()]), /1 field attachment \(1 photo, 0 notes\) across 1 customer and 0 tickets/);
  assert.match(fieldAttachmentSummaryText([item(), item({ id: 'FA-2', type: 'note', description: 'N.' })]), /Metadata only/);
});

test('html page: picker note, plain empty note, rows newest first, escaped', () => {
  assert.match(fieldAttachmentHtml([], ''), /Pick a customer or a ticket/);
  assert.match(fieldAttachmentHtml([], 'Ahmed'), /No field attachment recorded yet for Ahmed/);
  const html = fieldAttachmentHtml([item({ description: '<b>Bold</b> & "quoted"' }), item({ id: 'FA-2', date: '2026-11-01', type: 'note', description: 'Older note.' })], 'Ahmed');
  assert.ok(html.indexOf('FA-1') < html.indexOf('FA-2'));
  assert.ok(!html.includes('<b>Bold</b>'));
  assert.ok(html.includes('&lt;b&gt;Bold&lt;/b&gt;'));
  assert.ok(html.includes('IMG_2041.jpg'));
});

test('csv and filename', () => {
  const csv = fieldAttachmentCsv([item({ description: 'Has, comma' })]);
  assert.equal(csv.split('\n')[0], 'id,customer,ticket,date,type,description,fileRef');
  assert.match(csv, /"Has, comma"/);
  assert.equal(fieldAttachmentFilename(), 'field-attachments.csv');
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['fieldAttachHeading', 'fieldAttachSummary', 'fieldAttachExportBtn', 'fieldAttachCustomer', 'fieldAttachTicket', 'fieldAttachDate', 'fieldAttachType', 'fieldAttachDescription', 'fieldAttachFileRef', 'fieldAttachSaveBtn', 'fieldAttachFilter', 'fieldAttachRemoveId', 'fieldAttachRemoveBtn', 'fieldAttachBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('purity: module never imports, reads storage, or touches the network', () => {
  const source = readFileSync(join(dir, '..', 'field-attachments.js'), 'utf8');
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('XMLHttpRequest'));
  assert.ok(!source.includes('FileReader'));
});
