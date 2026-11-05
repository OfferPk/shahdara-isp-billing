import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validPhotoRegisterDate,
  normalizePhotoRegisterList,
  recordPhotoRegister,
  removePhotoRegister,
  findPhotoRegister,
  addPhotoRegisterAnnotation,
  photoRegisterSorted,
  photoRegisterForVisit,
  photoRegisterOnDate,
  photoRegisterVisitRefs,
  photoRegisterSummaryText,
  photoRegisterText,
  photoRegisterHtml,
  photoRegisterCsv,
  photoRegisterFilename,
} from '../photo-register.js';
import fs from 'node:fs';

const photoA = { id: 'p1', date: '2026-07-12', visitRef: 'V-101', subject: 'Pole near the corner shop', purpose: 'Show the leaning pole before repair', keptOn: 'Saad phone, July folder' };
const photoB = { id: 'p2', date: '2026-07-12', visitRef: 'V-101', subject: 'Drop cable at the house', purpose: 'Record the frayed drop cable', keptOn: 'Saad phone, July folder' };
const photoC = { id: 'p3', date: '2026-08-01', visitRef: 'v-102', subject: 'Cabinet door', purpose: 'Show the cabinet left open', keptOn: 'Shop folder, August' };

test('half-formed entries are refused', () => {
  assert.equal(recordPhotoRegister([], { date: '2026-07-12', visitRef: 'V-1', subject: 'S', purpose: 'P', keptOn: 'K' }).length, 0);
  assert.equal(recordPhotoRegister([], { id: 'x', visitRef: 'V-1', subject: 'S', purpose: 'P', keptOn: 'K' }).length, 0);
  assert.equal(recordPhotoRegister([], { id: 'x', date: '2026-07-12', subject: 'S', purpose: 'P', keptOn: 'K' }).length, 0);
  assert.equal(recordPhotoRegister([], { id: 'x', date: '2026-07-12', visitRef: 'V-1', purpose: 'P', keptOn: 'K' }).length, 0);
  assert.equal(recordPhotoRegister([], { id: 'x', date: '2026-07-12', visitRef: 'V-1', subject: 'S', keptOn: 'K' }).length, 0);
  assert.equal(recordPhotoRegister([], { id: 'x', date: '2026-07-12', visitRef: 'V-1', subject: 'S', purpose: 'P' }).length, 0);
});

test('strict dates: leap day accepted, impossible dates refused', () => {
  assert.equal(validPhotoRegisterDate('2024-02-29'), true);
  assert.equal(validPhotoRegisterDate('2026-02-29'), false);
  assert.equal(validPhotoRegisterDate('2026-02-30'), false);
  assert.equal(validPhotoRegisterDate('2026-13-01'), false);
  assert.equal(recordPhotoRegister([], { ...photoA, date: '2026-02-30' }).length, 0);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...photoA, photoBytes: 'abc', galleryLink: 'http://x', extra: 1 };
  const list = recordPhotoRegister([], raw);
  assert.equal(list.length, 1);
  assert.equal('photoBytes' in list[0], false);
  assert.equal('galleryLink' in list[0], false);
  assert.deepEqual(raw, { ...photoA, photoBytes: 'abc', galleryLink: 'http://x', extra: 1 });
});

test('duplicate ids are never rewritten', () => {
  const list = recordPhotoRegister([photoA], { ...photoA, subject: 'Changed subject' });
  assert.equal(list.length, 1);
  assert.equal(list[0].subject, 'Pole near the corner shop');
});

test('find and remove', () => {
  const list = [photoA, photoB];
  assert.equal(findPhotoRegister(list, 'p2').subject, 'Drop cable at the house');
  assert.equal(findPhotoRegister(list, 'nope'), null);
  assert.deepEqual(removePhotoRegister(list, 'p1').map((item) => item.id), ['p2']);
  assert.equal(removePhotoRegister(list, 'nope').length, 2);
});

test('sorting is by date, then visit, then id', () => {
  const sorted = photoRegisterSorted([photoC, photoB, photoA]);
  assert.deepEqual(sorted.map((item) => item.id), ['p1', 'p2', 'p3']);
});

test('entries for one visit list together, case-insensitively', () => {
  const list = [photoA, photoB, photoC];
  assert.deepEqual(photoRegisterForVisit(list, 'v-101').map((item) => item.id), ['p1', 'p2']);
  assert.deepEqual(photoRegisterForVisit(list, 'V-102').map((item) => item.id), ['p3']);
  assert.deepEqual(photoRegisterForVisit(list, 'V-999'), []);
  assert.deepEqual(photoRegisterForVisit(list, ''), []);
});

test('entries on one date list together', () => {
  assert.deepEqual(photoRegisterOnDate([photoA, photoB, photoC], '2026-07-12').map((item) => item.id), ['p1', 'p2']);
  assert.deepEqual(photoRegisterOnDate([photoA], '2026-02-30'), []);
});

test('visit references list once each', () => {
  assert.deepEqual(photoRegisterVisitRefs([photoB, photoA, photoC]), ['V-101', 'v-102']);
});

test('entries are never edited, only annotated', () => {
  const before = [photoA];
  const after = addPhotoRegisterAnnotation(before, 'p1', '2026-07-13', 'Fault returned; photo matches the same pole.');
  assert.equal(after[0].subject, 'Pole near the corner shop');
  assert.equal(after[0].purpose, 'Show the leaning pole before repair');
  assert.equal(after[0].keptOn, 'Saad phone, July folder');
  assert.deepEqual(after[0].annotations, [{ date: '2026-07-13', note: 'Fault returned; photo matches the same pole.' }]);
  assert.equal(addPhotoRegisterAnnotation(before, 'p1', '2026-02-30', 'Bad date').length, 1);
  assert.equal(addPhotoRegisterAnnotation(before, 'p1', '2026-02-30', 'Bad date')[0].annotations.length, 0);
  assert.equal(addPhotoRegisterAnnotation(before, 'nope', '2026-07-13', 'Note')[0].annotations.length, 0);
});

test('summary and entry text state the purpose', () => {
  assert.equal(photoRegisterSummaryText([]), 'No visit photos registered.');
  assert.equal(photoRegisterSummaryText([photoA, photoB, photoC]), '3 photos registered across 2 visits.');
  assert.match(photoRegisterText(photoA), /Purpose: Show the leaning pole before repair/);
  assert.match(photoRegisterText(photoA), /Kept on Saad phone, July folder/);
  assert.equal(photoRegisterText({ id: 'bad' }), 'No photo registered.');
});

test('HTML escapes user text', () => {
  const html = photoRegisterHtml({ ...photoA, subject: '<script>alert(1)</script>' });
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(photoRegisterHtml({ id: 'bad' }), '<p>No photo registered.</p>');
});

test('CSV rows and filename', () => {
  const csv = photoRegisterCsv([photoB, photoA]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","date","visit reference","subject","purpose","kept on","annotations"');
  assert.match(lines[1], /"p1","2026-07-12","V-101"/);
  assert.equal(photoRegisterFilename(), 'photo-register.csv');
});

test('list normalisation drops bad rows and duplicate ids', () => {
  const list = normalizePhotoRegisterList([photoA, { id: 'bad' }, photoA, photoB]);
  assert.deepEqual(list.map((item) => item.id), ['p1', 'p2']);
  assert.deepEqual(normalizePhotoRegisterList('not a list'), []);
});

test('module is pure: no clock, storage, or network', () => {
  const source = fs.readFileSync(new URL('../photo-register.js', import.meta.url), 'utf8');
  assert.equal(/new Date\(|Date\.now\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest/.test(source), false);
});

test('neighbour attachment module is neither read nor rewritten', () => {
  const source = fs.readFileSync(new URL('../photo-register.js', import.meta.url), 'utf8');
  assert.equal(/from '\.\/field-attachments\.js'/.test(source), false);
  assert.equal(/import /.test(source), false);
});

test('panel ids are present in index.html', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['prSaveBtn', 'prRemoveBtn', 'prFilter', 'prVisitBtn', 'prAnnotateBtn', 'prExportBtn', 'prBody', 'prSummary']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the photo register panel', () => {
  const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(source.includes("from './photo-register.js'"));
  assert.ok(source.includes('renderPhotoRegister()'));
});

test('deployment guard: no standalone OLT word added to app.js', () => {
  const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/(^|[^A-Za-z])OLT([^A-Za-z]|$)/.test(source), false);
});
