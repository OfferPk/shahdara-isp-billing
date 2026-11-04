import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeEducationNote,
  normalizeEducationNoteList,
  findEducationNote,
  upsertEducationNote,
  removeEducationNote,
  normalizeEducationShare,
  normalizeEducationShareList,
  recordEducationShare,
  removeEducationShare,
  educationNotesSorted,
  educationSharesForNote,
  educationSharesForCustomer,
  educationNoteStarters,
  educationNoteSummaryText,
  educationShareSummaryText,
  educationNoteHtml,
  educationNoteAllHtml,
  educationShareHtml,
  educationShareAllHtml,
  educationNoteCsv,
  educationNoteFilename,
  educationShareCsv,
  educationShareFilename,
} from '../education-note.js';

const dir = dirname(fileURLToPath(import.meta.url));

const note = (over = {}) => ({
  id: 'EDU-1',
  title: 'How to restart your ONU',
  steps: ['Switch the ONU off, wait 30 seconds.', 'Switch it back on.'],
  appliesWhen: 'When the internet stops suddenly.',
  ...over,
});

const share = (over = {}) => ({
  id: 'SHARE-1',
  noteId: 'EDU-1',
  customerId: 'Cust A',
  sharedDate: '2026-11-01',
  ...over,
});

test('plan169: half-formed note refused (no id, title, steps, or applies-when)', () => {
  assert.equal(normalizeEducationNote(note({ id: '  ' })), null);
  assert.equal(normalizeEducationNote(note({ title: '' })), null);
  assert.equal(normalizeEducationNote(note({ steps: [] })), null);
  assert.equal(normalizeEducationNote(note({ steps: ['  ', ''] })), null);
  assert.equal(normalizeEducationNote(note({ appliesWhen: '' })), null);
  assert.equal(normalizeEducationNote(null), null);
  assert.equal(normalizeEducationNote('not an object'), null);
});

test('plan169: steps normalize from newline string and drop blank lines', () => {
  const clean = normalizeEducationNote(note({ steps: 'First step.\n\nSecond step.\n  ' }));
  assert.deepEqual(clean.steps, ['First step.', 'Second step.']);
});

test('plan169: half-formed share refused (no id, note, customer, or bad date)', () => {
  assert.equal(normalizeEducationShare(share({ id: '' })), null);
  assert.equal(normalizeEducationShare(share({ noteId: '' })), null);
  assert.equal(normalizeEducationShare(share({ customerId: '  ' })), null);
  assert.equal(normalizeEducationShare(share({ sharedDate: '' })), null);
  assert.equal(normalizeEducationShare(share({ sharedDate: '2026-02-30' })), null);
  assert.equal(normalizeEducationShare(share({ sharedDate: '2026-04-31' })), null);
  assert.equal(normalizeEducationShare(share({ sharedDate: '2026-13-01' })), null);
  assert.equal(normalizeEducationShare(share({ sharedDate: '01-11-2026' })), null);
});

test('plan169: strict share dates accept 31-day months and Feb 29 on leap years only', () => {
  assert.ok(normalizeEducationShare(share({ sharedDate: '2026-08-31' })));
  assert.ok(normalizeEducationShare(share({ sharedDate: '2026-10-31' })));
  assert.ok(normalizeEducationShare(share({ sharedDate: '2026-12-31' })));
  assert.ok(normalizeEducationShare(share({ sharedDate: '2024-02-29' })));
  assert.equal(normalizeEducationShare(share({ sharedDate: '2026-02-29' })), null);
  assert.equal(normalizeEducationShare(share({ sharedDate: '2026-09-31' })), null);
  assert.equal(normalizeEducationShare(share({ sharedDate: '2026-11-31' })), null);
});

test('plan169: unknown fields dropped from notes and shares', () => {
  const cleanNote = normalizeEducationNote(note({ diagnosis: 'faulty splitter', billId: 'B-1' }));
  assert.equal(cleanNote.diagnosis, undefined);
  assert.equal(cleanNote.billId, undefined);
  const cleanShare = normalizeEducationShare(share({ sentBySms: true, amount: 500 }));
  assert.equal(cleanShare.sentBySms, undefined);
  assert.equal(cleanShare.amount, undefined);
});

test('plan169: duplicate note ids never rewritten', () => {
  const base = [note()];
  assert.deepEqual(upsertEducationNote(base, note()), base);
  assert.deepEqual(upsertEducationNote(base, note({ title: 'Different title' })), base);
  assert.equal(upsertEducationNote(base, note({ id: 'EDU-2' })).length, 2);
});

test('plan169: share of an unknown note refused, duplicate share ids never rewritten', () => {
  assert.deepEqual(recordEducationShare([], [], share()), []);
  assert.deepEqual(recordEducationShare([note()], [], share({ noteId: 'EDU-MISSING' })), []);
  const base = recordEducationShare([note()], [], share());
  assert.equal(base.length, 1);
  assert.deepEqual(recordEducationShare([note()], base, share()), base);
  assert.deepEqual(recordEducationShare([note()], base, share({ customerId: 'Cust B' })), base);
  assert.equal(recordEducationShare([note()], base, share({ id: 'SHARE-2' })).length, 2);
});

test('plan169: find and remove notes and shares', () => {
  const notes = [note(), note({ id: 'EDU-2', title: 'Blinking lights' })];
  assert.equal(findEducationNote(notes, 'EDU-2').title, 'Blinking lights');
  assert.equal(findEducationNote(notes, 'EDU-9'), null);
  assert.deepEqual(removeEducationNote(notes, 'EDU-1').map((item) => item.id), ['EDU-2']);
  assert.deepEqual(removeEducationNote(notes, ''), notes);
  const shares = recordEducationShare(notes, [], share());
  assert.deepEqual(removeEducationShare(shares, 'SHARE-1'), []);
  assert.deepEqual(removeEducationShare(shares, 'SHARE-9'), shares);
});

test('plan169: notes sort by title A-Z, shares newest first', () => {
  const notes = [note({ id: 'EDU-2', title: 'Zebra guide' }), note({ id: 'EDU-1', title: 'Apple guide' })];
  assert.deepEqual(educationNotesSorted(notes).map((item) => item.id), ['EDU-1', 'EDU-2']);
  const shares = [
    share({ id: 'S1', sharedDate: '2026-11-01' }),
    share({ id: 'S2', sharedDate: '2026-11-05' }),
    share({ id: 'S3', sharedDate: '2026-11-03' }),
  ];
  assert.deepEqual(educationSharesForNote(shares, 'EDU-1').map((item) => item.id), ['S2', 'S3', 'S1']);
  assert.deepEqual(educationSharesForNote(shares, 'EDU-9'), []);
});

test('plan169: shares for customer match case-insensitively', () => {
  const shares = [
    share({ id: 'S1', customerId: 'Cust A' }),
    share({ id: 'S2', customerId: 'cust a' }),
    share({ id: 'S3', customerId: 'Cust B' }),
  ];
  assert.deepEqual(educationSharesForCustomer(shares, 'CUST A').map((item) => item.id), ['S1', 'S2']);
  assert.deepEqual(educationSharesForCustomer(shares, ''), []);
});

test('plan169: starter notes are valid library notes', () => {
  const starters = educationNoteStarters();
  assert.equal(starters.length, 3);
  const clean = normalizeEducationNoteList(starters);
  assert.equal(clean.length, 3);
  assert.ok(clean.every((item) => item.title && item.steps.length > 0 && item.appliesWhen));
  assert.ok(clean.some((item) => item.id === 'EDU-RESTART-ONU'));
});

test('plan169: summary texts', () => {
  assert.equal(educationNoteSummaryText([]), '0 education notes');
  assert.equal(educationNoteSummaryText([note()]), '1 education note');
  assert.equal(educationNoteSummaryText([note(), note({ id: 'EDU-2' })]), '2 education notes');
  assert.equal(educationShareSummaryText([]), '0 shares recorded');
  assert.equal(educationShareSummaryText([share()]), '1 share recorded');
});

test('plan169: note HTML shows title, steps, and applies-when, and escapes markup', () => {
  const html = educationNoteHtml(note({ title: '<b>Bold</b> guide', steps: ['Step <one> & two'] }));
  assert.match(html, /&lt;b&gt;Bold&lt;\/b&gt; guide/);
  assert.match(html, /Step &lt;one&gt; &amp; two/);
  assert.match(html, /Applies when: When the internet stops suddenly\./);
  assert.equal(educationNoteHtml(note({ title: '' })), '');
  assert.match(educationNoteAllHtml([]), /No education notes recorded yet/);
  assert.match(educationNoteAllHtml([note()]), /How to restart your ONU/);
});

test('plan169: share HTML names the note title and escapes customer input', () => {
  const html = educationShareHtml(share({ customerId: '<script>alert(1)</script>' }), [note()]);
  assert.match(html, /How to restart your ONU/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /2026-11-01/);
  assert.match(educationShareAllHtml([], []), /No shares recorded yet/);
  assert.equal(educationShareHtml(share({ customerId: '' }), [note()]), '');
});

test('plan169: CSV exports and filenames for notes and shares', () => {
  const noteCsv = educationNoteCsv([note({ title: 'Guide, "quoted"' })]);
  assert.match(noteCsv, /^"id","title","steps","appliesWhen"\n/);
  assert.match(noteCsv, /"Guide, ""quoted"""/);
  assert.equal(educationNoteFilename(), 'education-notes.csv');
  const shareCsv = educationShareCsv([share()]);
  assert.match(shareCsv, /^"id","noteId","customerId","sharedDate"\n/);
  assert.match(shareCsv, /"SHARE-1","EDU-1","Cust A","2026-11-01"/);
  assert.equal(educationShareFilename(), 'education-note-shares.csv');
});

test('plan169: inputs never mutated', () => {
  const rawNote = note({ steps: ['  Step one.  '] });
  const rawShare = share();
  const noteBefore = JSON.stringify(rawNote);
  const shareBefore = JSON.stringify(rawShare);
  normalizeEducationNote(rawNote);
  upsertEducationNote([rawNote], note({ id: 'EDU-2' }));
  recordEducationShare([rawNote], [rawShare], share({ id: 'SHARE-2' }));
  assert.equal(JSON.stringify(rawNote), noteBefore);
  assert.equal(JSON.stringify(rawShare), shareBefore);
});

test('plan169: purity fence — module touches no storage, network, or other store', () => {
  const source = readFileSync(join(dir, '..', 'education-note.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\(|document\.|window\.|XMLHttpRequest/);
  assert.doesNotMatch(source, /shahdara_(?!education)/);
});

test('plan169: panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['enTitle', 'enSteps', 'enAppliesWhen', 'enSaveBtn', 'enStartersBtn',
    'enRemoveId', 'enRemoveBtn', 'enFilter', 'enBody', 'enSummary', 'enExportBtn',
    'enShareNoteId', 'enShareCustomer', 'enShareDate', 'enShareBtn',
    'enShareRemoveId', 'enShareRemoveBtn', 'enShareBody', 'enShareExportBtn', 'enShareFilter']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
