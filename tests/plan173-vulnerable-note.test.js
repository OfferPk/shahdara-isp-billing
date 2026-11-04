import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VULNERABLE_NEED_LABELS,
  normalizeVulnerableNote,
  normalizeVulnerableNoteList,
  findVulnerableNote,
  recordVulnerableNote,
  updateVulnerableNote,
  removeVulnerableNote,
  vulnerableNoteForCustomer,
  vulnerableCustomers,
  vulnerableNoteText,
  vulnerableNoteSummaryText,
  vulnerableNoteHtml,
  vulnerableNoteAllHtml,
  vulnerableNoteCsv,
  vulnerableNoteFilename,
} from '../vulnerable-note.js';

const dir = dirname(fileURLToPath(import.meta.url));

const note = (over = {}) => ({
  id: 'VN-1',
  customerId: 'Cust A',
  needs: ['elderly', 'needs-extra-time'],
  note: 'Knock loudly, doorbell is broken.',
  ...over,
});

test('half-formed note refused: no id or no customer', () => {
  assert.equal(normalizeVulnerableNote({ customerId: 'Cust A' }), null);
  assert.equal(normalizeVulnerableNote({ id: 'VN-1' }), null);
  assert.equal(normalizeVulnerableNote(null), null);
  assert.equal(normalizeVulnerableNote('nope'), null);
  assert.equal(recordVulnerableNote([], { customerId: 'Cust A' }).length, 0);
});

test('needs: only the fixed labels are kept, unknown labels dropped, duplicates removed', () => {
  assert.deepEqual(normalizeVulnerableNote(note({ needs: ['elderly', 'diabetic', 'ELDERLY', 'no-phone'] })).needs, ['elderly', 'no-phone']);
  assert.deepEqual(normalizeVulnerableNote(note({ needs: 'elderly, family-member-present, something-else' })).needs, ['elderly', 'family-member-present']);
  assert.deepEqual(normalizeVulnerableNote(note({ needs: [] })).needs, []);
  assert.deepEqual(normalizeVulnerableNote(note({ needs: null })).needs, []);
  assert.deepEqual(VULNERABLE_NEED_LABELS, ['elderly', 'no-phone', 'family-member-present', 'needs-extra-time']);
});

test('unknown fields dropped: no visit, bill, payment, route, or sending field can ever exist', () => {
  const record = normalizeVulnerableNote(note({
    visitOutcome: 'done', billId: 'B-1', paymentId: 'P-1', route: 'R-1',
    sendTo: 'someone', diagnosis: 'private detail', medicalNote: 'private detail',
  }));
  assert.deepEqual(Object.keys(record).sort(), ['customerId', 'id', 'needs', 'note']);
});

test('duplicate id never rewritten by recording', () => {
  const list = [note()];
  assert.deepEqual(recordVulnerableNote(list, note()), list);
  assert.deepEqual(recordVulnerableNote(list, note({ needs: ['no-phone'], note: 'Changed.' })), list);
  assert.equal(recordVulnerableNote([], note()).length, 1);
});

test('one note per customer, case-insensitive', () => {
  const list = [note()];
  assert.deepEqual(recordVulnerableNote(list, note({ id: 'VN-2', customerId: 'cust a' })), list);
  assert.equal(recordVulnerableNote(list, note({ id: 'VN-2', customerId: 'Cust B' })).length, 2);
});

test('find and remove by id', () => {
  const list = [note(), note({ id: 'VN-2', customerId: 'Cust B', needs: [], note: '' })];
  assert.equal(findVulnerableNote(list, 'VN-2').customerId, 'Cust B');
  assert.equal(findVulnerableNote(list, 'VN-9'), null);
  assert.deepEqual(removeVulnerableNote(list, 'VN-1').map((item) => item.id), ['VN-2']);
  assert.equal(removeVulnerableNote(list, 'VN-9').length, 2);
});

test('edit replaces only needs and free-text line, never id or customer', () => {
  const list = [note()];
  const edited = updateVulnerableNote(list, 'VN-1', { needs: ['no-phone'], note: 'New note.', customerId: 'Cust Z', id: 'VN-9' });
  assert.equal(edited[0].id, 'VN-1');
  assert.equal(edited[0].customerId, 'Cust A');
  assert.deepEqual(edited[0].needs, ['no-phone']);
  assert.equal(edited[0].note, 'New note.');
  assert.deepEqual(updateVulnerableNote(list, 'VN-9', { note: 'Nope.' }), list);
  const dropped = updateVulnerableNote(list, 'VN-1', { needs: ['elderly', 'diagnosis-x'] });
  assert.deepEqual(dropped[0].needs, ['elderly']);
});

test('visit-view lookup is case-insensitive and returns nothing for unknown customers', () => {
  const list = [note()];
  assert.equal(vulnerableNoteForCustomer(list, 'CUST a').id, 'VN-1');
  assert.equal(vulnerableNoteForCustomer(list, 'Cust B'), null);
  assert.equal(vulnerableNoteForCustomer([], 'Cust A'), null);
});

test('customers list keeps first spelling, sorted A-Z', () => {
  const list = [
    note({ id: 'VN-2', customerId: 'cust b' }),
    note({ id: 'VN-1', customerId: 'Cust A' }),
    note({ id: 'VN-3', customerId: 'Cust C' }),
  ];
  assert.deepEqual(vulnerableCustomers(list), ['Cust A', 'cust b', 'Cust C']);
});

test('visit note text states needs in plain words plus the free-text line', () => {
  const text = vulnerableNoteText(note());
  assert.match(text, /Cust A/);
  assert.match(text, /Elderly/);
  assert.match(text, /do not rush the visit/);
  assert.match(text, /Knock loudly/);
  assert.match(vulnerableNoteText(note({ needs: [], note: '' })), /No specific visit needs recorded/);
  assert.equal(vulnerableNoteText(null), '');
});

test('summary text counts notes and customers', () => {
  assert.equal(vulnerableNoteSummaryText([]), '0 visit notes for 0 customers');
  assert.equal(vulnerableNoteSummaryText([note()]), '1 visit note for 1 customer');
  assert.equal(vulnerableNoteSummaryText([note(), note({ id: 'VN-2', customerId: 'Cust B' })]), '2 visit notes for 2 customers');
});

test('HTML escapes customer text and lists notes customer A-Z', () => {
  const html = vulnerableNoteAllHtml([note({ customerId: 'Cust <B> & Sons', note: '<script>' })]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Cust &lt;B&gt; &amp; Sons/);
  assert.equal(vulnerableNoteAllHtml([]), '<p>No vulnerable-customer visit notes recorded.</p>');
  assert.equal(vulnerableNoteHtml(null), '');
});

test('CSV export and filename', () => {
  const csv = vulnerableNoteCsv([note({ note: 'Has a "gate", code 12' })]);
  assert.match(csv, /^id,customer,needs,note\n/);
  assert.match(csv, /"Has a ""gate"", code 12"/);
  assert.equal(vulnerableNoteFilename(), 'shahdara_vulnerable_notes.csv');
});

test('inputs never mutated; list normalization tolerates junk', () => {
  const input = note({ extra: 'dropped' });
  const frozen = JSON.stringify(input);
  recordVulnerableNote([], input);
  updateVulnerableNote([input], 'VN-1', { note: 'Changed.' });
  removeVulnerableNote([input], 'VN-1');
  assert.equal(JSON.stringify(input), frozen);
  assert.equal(normalizeVulnerableNoteList('nope').length, 0);
  assert.equal(normalizeVulnerableNoteList([note(), null, 'x']).length, 1);
});

test('purity fence: module never touches storage, network, or the clock', () => {
  const source = readFileSync(join(dir, '..', 'vulnerable-note.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|fetch\(|XMLHttpRequest|new Date|Date\.now/);
});

test('panel wiring: all panel element ids exist in index.html, no standalone OLT in app.js', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['vnHeading', 'vnSummary', 'vnExportBtn', 'vnCustomer', 'vnNeedElderly', 'vnNeedNoPhone', 'vnNeedFamily', 'vnNeedExtraTime', 'vnNote', 'vnSaveBtn', 'vnEditId', 'vnEditNeeds', 'vnEditNote', 'vnEditBtn', 'vnRemoveId', 'vnRemoveBtn', 'vnFilter', 'vnBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
