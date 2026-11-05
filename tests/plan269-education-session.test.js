import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validEducationSessionDate,
  normalizeEducationSessionList,
  recordEducationSession,
  removeEducationSession,
  findEducationSession,
  addEducationSessionNote,
  educationSessionSorted,
  sessionsByTopic,
  sessionsByMohalla,
  sessionsForCustomer,
  educationSessionMohallas,
  educationSessionTopics,
  educationSessionSummaryText,
  educationSessionText,
  educationSessionHtml,
  educationSessionAllHtml,
  educationSessionCsv,
  educationSessionFilename,
} from '../education-session.js';

const first = { id: 'ES-1', date: '2026-11-10', mohalla: 'Mohalla A', customer: '', topic: 'How to pay by Easypaisa', operator: 'Saad', note: 'Showed the bill screen step by step.' };
const second = { id: 'ES-2', date: '2026-11-08', mohalla: '', customer: 'MOBEEN SHAH', topic: 'How to restart the ONU', operator: 'Saad', note: 'Customer restarted it alone.', followups: [{ date: '2026-11-09', note: 'Line stayed up overnight.' }] };
const third = { id: 'ES-3', date: '2026-11-12', mohalla: 'Mohalla A', customer: '', topic: 'How to pay by Easypaisa', operator: 'Saad', note: 'Second group session.' };

test('half-formed sessions are refused: no date, no topic, or neither mohalla nor customer', () => {
  assert.deepEqual(recordEducationSession([], { id: '', date: '2026-11-10', mohalla: 'Mohalla A', topic: 'How to pay by Easypaisa' }), []);
  assert.deepEqual(recordEducationSession([], { id: 'ES-1', date: '2026-11-10', mohalla: 'Mohalla A', topic: '' }), []);
  assert.deepEqual(recordEducationSession([], { id: 'ES-1', date: '2026-11-10', mohalla: 'Mohalla A', topic: '   ' }), []);
  assert.deepEqual(recordEducationSession([], { id: 'ES-1', date: '2026-11-10', mohalla: '', customer: '', topic: 'How to pay by Easypaisa' }), []);
  assert.deepEqual(recordEducationSession([], { id: 'ES-1', date: 'not-a-date', mohalla: 'Mohalla A', topic: 'How to pay by Easypaisa' }), []);
  assert.deepEqual(recordEducationSession([], { id: 'ES-1', mohalla: 'Mohalla A', topic: 'How to pay by Easypaisa' }), []);
  assert.deepEqual(recordEducationSession([], { id: 'ES-1', date: '2026-11-10', topic: 'How to pay by Easypaisa' }), []);
  assert.equal(recordEducationSession([], first).length, 1);
  assert.equal(recordEducationSession([], second).length, 1);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validEducationSessionDate('2026-01-31'), true);
  assert.equal(validEducationSessionDate('2026-04-31'), false);
  assert.equal(validEducationSessionDate('2026-02-29'), false);
  assert.equal(validEducationSessionDate('2024-02-29'), true);
  assert.equal(validEducationSessionDate('2026-11-10'), true);
  assert.equal(validEducationSessionDate('2026-13-01'), false);
  assert.equal(validEducationSessionDate('2026-11-00'), false);
  assert.equal(validEducationSessionDate('10-11-2026'), false);
  assert.equal(validEducationSessionDate(''), false);
  assert.equal(validEducationSessionDate(null), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 1500, customerStatus: 'active', extra: 'x' };
  const before = JSON.stringify(raw);
  const recorded = recordEducationSession([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('customerStatus' in recorded[0], false);
  assert.equal('extra' in recorded[0], false);
  assert.equal(JSON.stringify(raw), before);
  const list = [first];
  const listBefore = JSON.stringify(list);
  recordEducationSession(list, second);
  assert.equal(JSON.stringify(list), listBefore);
});

test('duplicate ids are never rewritten', () => {
  const changed = { ...second, id: 'ES-1', topic: 'Different topic.' };
  const out = recordEducationSession([first], changed);
  assert.equal(out.length, 1);
  assert.equal(out[0].topic, first.topic);
});

test('find and remove work by id', () => {
  const list = [first, second];
  assert.equal(findEducationSession(list, 'ES-2').topic, 'How to restart the ONU');
  assert.equal(findEducationSession(list, 'ES-9'), null);
  assert.equal(findEducationSession(list, ''), null);
  assert.deepEqual(removeEducationSession(list, 'ES-1').map((item) => item.id), ['ES-2']);
  assert.equal(removeEducationSession(list, 'ES-9').length, 2);
});

test('sorting is by date, then topic, then id', () => {
  const out = educationSessionSorted([third, first, second]);
  assert.deepEqual(out.map((item) => item.id), ['ES-2', 'ES-1', 'ES-3']);
});

test('session list filters by topic, case-insensitively', () => {
  const out = sessionsByTopic([third, first, second], 'how to pay by easypaisa');
  assert.deepEqual(out.map((item) => item.id), ['ES-1', 'ES-3']);
  assert.deepEqual(sessionsByTopic([first], ''), []);
  assert.deepEqual(sessionsByTopic([first], 'No such topic'), []);
});

test('session list filters by mohalla, case-insensitively', () => {
  const out = sessionsByMohalla([third, first, second], 'mohalla a');
  assert.deepEqual(out.map((item) => item.id), ['ES-1', 'ES-3']);
  assert.deepEqual(sessionsByMohalla([first], ''), []);
  assert.deepEqual(sessionsByMohalla([first], 'Mohalla Z'), []);
});

test('sessions for one customer are in date order', () => {
  const later = { ...second, id: 'ES-4', date: '2026-11-14', topic: 'How to check data balance' };
  const out = sessionsForCustomer([later, first, second], 'mobeen shah');
  assert.deepEqual(out.map((item) => item.id), ['ES-2', 'ES-4']);
  assert.deepEqual(sessionsForCustomer([first], ''), []);
});

test('mohalla and topic lists keep the first spelling', () => {
  const lower = { ...third, id: 'ES-5', mohalla: 'mohalla a', date: '2026-11-13', topic: 'how to pay by easypaisa' };
  assert.deepEqual(educationSessionMohallas([second, first, lower]), ['Mohalla A']);
  assert.deepEqual(educationSessionTopics([second, first, lower]), ['How to restart the ONU', 'How to pay by Easypaisa']);
});

test('dated follow-up notes never rewrite the session', () => {
  const list = [first];
  const noted = addEducationSessionNote(list, 'ES-1', '2026-11-11', 'Two neighbours asked for the same lesson.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].date, '2026-11-10');
  assert.equal(noted[0].mohalla, 'Mohalla A');
  assert.equal(noted[0].topic, first.topic);
  assert.equal(noted[0].operator, 'Saad');
  assert.equal(noted[0].note, first.note);
  const unchanged = [{ ...first, followups: [] }];
  assert.deepEqual(addEducationSessionNote(list, 'ES-1', 'bad-date', 'Nope'), unchanged);
  assert.deepEqual(addEducationSessionNote(list, 'ES-1', '2026-11-11', ''), unchanged);
  assert.deepEqual(addEducationSessionNote(list, 'ES-9', '2026-11-11', 'Nope'), unchanged);
});

test('summary and entry text name the topic, date, and whom plainly', () => {
  assert.equal(educationSessionSummaryText([]), 'No education sessions recorded.');
  assert.equal(educationSessionSummaryText([first, second]), '2 education sessions across 2 topics.');
  assert.equal(educationSessionSummaryText([first, third]), '2 education sessions across 1 topic.');
  const text = educationSessionText(first);
  assert.equal(text.includes('2026-11-10'), true);
  assert.equal(text.includes('How to pay by Easypaisa'), true);
  assert.equal(text.includes('Mohalla A'), true);
  assert.equal(text.includes('Saad'), true);
  assert.equal(educationSessionText(null), 'No education session recorded.');
  assert.equal(educationSessionText({ ...first, operator: '' }).includes(' by Saad'), false);
});

test('html escapes input', () => {
  const evil = { ...first, topic: '<script>alert(1)</script>' };
  const html = educationSessionHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(educationSessionHtml(null), '<p>No education session recorded.</p>');
  assert.equal(educationSessionAllHtml([]), '<p>No education sessions recorded.</p>');
  assert.equal(educationSessionAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = educationSessionCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","date","mohalla","customer","topic","operator","note","follow-ups"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('ES-2'), true);
  assert.equal(lines[1].includes('2026-11-09: Line stayed up overnight.'), true);
  assert.equal(educationSessionFilename(), 'education-sessions.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'ES-9', date: '2026-11-10', mohalla: 'Mohalla A', topic: '' };
  const out = normalizeEducationSessionList([bad, first, { ...first, topic: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['ES-1', 'ES-2']);
  assert.equal(out[0].topic, first.topic);
  assert.deepEqual(normalizeEducationSessionList('nope'), []);
  assert.deepEqual(normalizeEducationSessionList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../education-session.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the education notes draft module is untouched', () => {
  const source = readFileSync(new URL('../education-session.js', import.meta.url), 'utf8');
  assert.equal(source.includes('education-note'), false, 'module must not reference the education notes draft module');
  assert.equal(existsSync(new URL('../education-note.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'esHeading', 'esSummary', 'esList', 'esExportBtn',
    'esDate', 'esMohalla', 'esCustomer', 'esTopic', 'esOperator', 'esNote', 'esRecordBtn',
    'esAnnotateId', 'esAnnotateDate', 'esAnnotateNote', 'esAnnotateBtn',
    'esRemoveId', 'esRemoveBtn',
    'esFilterTopic', 'esFilterMohalla', 'esFilterBtn', 'esFilterBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the education session panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './education-session.js'"), true);
  assert.equal(source.includes('renderEducationSessions()'), true);
  assert.equal(source.includes('EDUCATION_SESSION_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
