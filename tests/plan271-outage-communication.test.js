import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validOutageCommunicationDate,
  validOutageCommunicationTime,
  normalizeOutageCommunicationList,
  recordOutageCommunication,
  removeOutageCommunication,
  findOutageCommunication,
  outageCommunicationSorted,
  communicationsForIncident,
  outageCommunicationIncidents,
  outageCommunicationMohallas,
  outageCommunicationChannels,
  outageCommunicationSummaryText,
  outageCommunicationText,
  outageCommunicationHtml,
  outageCommunicationAllHtml,
  outageCommunicationCsv,
  outageCommunicationFilename,
} from '../outage-communication.js';

const first = { id: 'OC-1', incidentId: 'OUT-7', date: '2026-11-10', time: '14:30', mohallas: ['Mohalla A', 'Mohalla B'], message: 'Net is down, restoration expected by evening.', channel: 'WhatsApp' };
const second = { id: 'OC-2', incidentId: 'OUT-7', date: '2026-11-10', time: '16:05', mohallas: ['Mohalla A'], message: 'Work is in progress on the main line.', channel: 'Phone call' };
const third = { id: 'OC-3', incidentId: 'OUT-9', date: '2026-11-09', time: '09:15', mohallas: ['Mohalla C'], message: 'Planned work finished, service restored.', channel: 'WhatsApp' };

test('half-formed entries are refused: no incident link or no mohalla', () => {
  assert.deepEqual(recordOutageCommunication([], { id: '', incidentId: 'OUT-7', date: '2026-11-10', time: '14:30', mohallas: ['Mohalla A'] }), []);
  assert.deepEqual(recordOutageCommunication([], { id: 'OC-1', incidentId: '', date: '2026-11-10', time: '14:30', mohallas: ['Mohalla A'] }), []);
  assert.deepEqual(recordOutageCommunication([], { id: 'OC-1', incidentId: '   ', date: '2026-11-10', time: '14:30', mohallas: ['Mohalla A'] }), []);
  assert.deepEqual(recordOutageCommunication([], { id: 'OC-1', incidentId: 'OUT-7', date: '2026-11-10', time: '14:30', mohallas: [] }), []);
  assert.deepEqual(recordOutageCommunication([], { id: 'OC-1', incidentId: 'OUT-7', date: '2026-11-10', time: '14:30', mohallas: ['  ', ''] }), []);
  assert.deepEqual(recordOutageCommunication([], { id: 'OC-1', incidentId: 'OUT-7', date: '2026-11-10', time: '14:30' }), []);
  assert.deepEqual(recordOutageCommunication([], { id: 'OC-1', date: '2026-11-10', time: '14:30', mohallas: ['Mohalla A'] }), []);
  assert.equal(recordOutageCommunication([], first).length, 1);
  assert.equal(recordOutageCommunication([], second).length, 1);
});

test('strict dates: real calendar days only', () => {
  assert.equal(validOutageCommunicationDate('2026-11-10'), true);
  assert.equal(validOutageCommunicationDate('2024-02-29'), true);
  assert.equal(validOutageCommunicationDate('2026-02-29'), false);
  assert.equal(validOutageCommunicationDate('2026-04-31'), false);
  assert.equal(validOutageCommunicationDate('2026-13-01'), false);
  assert.equal(validOutageCommunicationDate('2026-00-10'), false);
  assert.equal(validOutageCommunicationDate('2026-11-00'), false);
  assert.equal(validOutageCommunicationDate('10-11-2026'), false);
  assert.equal(validOutageCommunicationDate('not-a-date'), false);
  assert.equal(validOutageCommunicationDate(''), false);
  assert.equal(validOutageCommunicationDate(null), false);
  assert.deepEqual(recordOutageCommunication([], { ...first, id: 'OC-9', date: '2026-02-29' }), []);
  assert.equal(recordOutageCommunication([], { ...first, id: 'OC-9', date: '2024-02-29' }).length, 1);
});

test('strict times: 24-hour clock only', () => {
  assert.equal(validOutageCommunicationTime('00:00'), true);
  assert.equal(validOutageCommunicationTime('14:30'), true);
  assert.equal(validOutageCommunicationTime('23:59'), true);
  assert.equal(validOutageCommunicationTime('24:00'), false);
  assert.equal(validOutageCommunicationTime('14:60'), false);
  assert.equal(validOutageCommunicationTime('9:30'), false);
  assert.equal(validOutageCommunicationTime('14:3'), false);
  assert.equal(validOutageCommunicationTime('14-30'), false);
  assert.equal(validOutageCommunicationTime(''), false);
  assert.equal(validOutageCommunicationTime(null), false);
  assert.deepEqual(recordOutageCommunication([], { ...first, id: 'OC-9', time: '25:00' }), []);
  assert.deepEqual(recordOutageCommunication([], { ...first, id: 'OC-9', time: '' }), []);
  assert.equal(recordOutageCommunication([], { ...first, id: 'OC-9', time: '00:00' }).length, 1);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 1500, paymentStatus: 'paid', outageStatus: 'resolved', extra: 'drop me' };
  const recorded = recordOutageCommunication([], raw);
  assert.equal(recorded.length, 1);
  assert.deepEqual(Object.keys(recorded[0]).sort(), ['channel', 'date', 'id', 'incidentId', 'message', 'mohallas', 'time']);
  assert.equal('billAmount' in raw, true);
  assert.equal(raw.mohallas.length, 2);
  const list = [first, second, third];
  const before = JSON.stringify(list);
  normalizeOutageCommunicationList(list);
  outageCommunicationSorted(list);
  communicationsForIncident(list, 'OUT-7');
  assert.equal(JSON.stringify(list), before);
});

test('duplicate ids are never rewritten', () => {
  const list = [first];
  const again = recordOutageCommunication(list, { ...first, message: 'Changed message.' });
  assert.equal(again.length, 1);
  assert.equal(again[0].message, first.message);
  const normalized = normalizeOutageCommunicationList([first, { ...first, message: 'Changed message.' }]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].message, first.message);
});

test('find and remove', () => {
  const list = [first, second, third];
  assert.deepEqual(findOutageCommunication(list, 'OC-2'), second);
  assert.equal(findOutageCommunication(list, 'OC-9'), null);
  assert.equal(findOutageCommunication(list, ''), null);
  assert.equal(removeOutageCommunication(list, 'OC-2').length, 2);
  assert.equal(removeOutageCommunication(list, 'OC-9').length, 3);
  assert.equal(removeOutageCommunication(list, '').length, 3);
});

test('an incident page lists its communications in time order', () => {
  const shuffled = [second, third, first];
  const forOut7 = communicationsForIncident(shuffled, 'OUT-7');
  assert.deepEqual(forOut7.map((item) => item.id), ['OC-1', 'OC-2']);
  assert.deepEqual(communicationsForIncident(shuffled, 'out-7').map((item) => item.id), ['OC-1', 'OC-2']);
  assert.deepEqual(communicationsForIncident(shuffled, 'OUT-9').map((item) => item.id), ['OC-3']);
  assert.deepEqual(communicationsForIncident(shuffled, 'OUT-99'), []);
  assert.deepEqual(communicationsForIncident(shuffled, ''), []);
  const sorted = outageCommunicationSorted(shuffled);
  assert.deepEqual(sorted.map((item) => item.id), ['OC-3', 'OC-1', 'OC-2']);
});

test('mohallas are cleaned: blanks dropped, duplicates folded, order kept', () => {
  const entry = recordOutageCommunication([], { id: 'OC-1', incidentId: 'OUT-7', date: '2026-11-10', time: '14:30', mohallas: ['Mohalla A', '  ', 'mohalla a', 'Mohalla B'], message: '', channel: '' });
  assert.deepEqual(entry[0].mohallas, ['Mohalla A', 'Mohalla B']);
  const fromString = recordOutageCommunication([], { id: 'OC-1', incidentId: 'OUT-7', date: '2026-11-10', time: '14:30', mohallas: 'Mohalla A, Mohalla B', message: '', channel: '' });
  assert.deepEqual(fromString[0].mohallas, ['Mohalla A', 'Mohalla B']);
});

test('incident, mohalla, and channel lists keep the first spelling', () => {
  const list = [first, second, third, { id: 'OC-4', incidentId: 'out-7', date: '2026-11-11', time: '10:00', mohallas: ['mohalla a'], message: 'Restored.', channel: 'whatsapp' }];
  assert.deepEqual(outageCommunicationIncidents(list), ['OUT-9', 'OUT-7']);
  assert.deepEqual(outageCommunicationMohallas(list), ['Mohalla C', 'Mohalla A', 'Mohalla B']);
  assert.deepEqual(outageCommunicationChannels(list), ['WhatsApp', 'Phone call']);
  assert.deepEqual(outageCommunicationIncidents([]), []);
  assert.deepEqual(outageCommunicationMohallas([]), []);
  assert.deepEqual(outageCommunicationChannels([]), []);
});

test('summary and entry text', () => {
  assert.equal(outageCommunicationSummaryText([]), 'No outage communications recorded.');
  assert.equal(outageCommunicationSummaryText([first]), '1 outage communication across 1 incident.');
  assert.equal(outageCommunicationSummaryText([first, second, third]), '3 outage communications across 2 incidents.');
  assert.equal(outageCommunicationText(first), '2026-11-10 14:30: Incident OUT-7 — told Mohalla A, Mohalla B via WhatsApp. Net is down, restoration expected by evening.');
  assert.equal(outageCommunicationText({ ...first, message: '', channel: '' }), '2026-11-10 14:30: Incident OUT-7 — told Mohalla A, Mohalla B.');
  assert.equal(outageCommunicationText(null), 'No outage communication recorded.');
  assert.equal(outageCommunicationText({ id: 'OC-9', incidentId: 'OUT-7', date: '2026-11-10', time: '14:30', mohallas: [] }), 'No outage communication recorded.');
});

test('HTML is escaped', () => {
  const nasty = { ...first, message: '<script>alert("x")</script> & done' };
  const html = outageCommunicationHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('&amp; done'), true);
  assert.equal(outageCommunicationHtml(null), '<p>No outage communication recorded.</p>');
  const all = outageCommunicationAllHtml([first, second]);
  assert.equal(all.startsWith('<ul>'), true);
  assert.equal(all.includes('OC-1'), false);
  assert.equal(all.includes('Incident OUT-7'), true);
  assert.equal(outageCommunicationAllHtml([]), '<p>No outage communications recorded.</p>');
});

test('CSV export and filename', () => {
  const csv = outageCommunicationCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","incident","date","time","mohallas","channel","message"');
  assert.equal(lines[1].startsWith('"OC-1","OUT-7","2026-11-10","14:30","Mohalla A; Mohalla B"'), true);
  assert.equal(lines[2].startsWith('"OC-2","OUT-7","2026-11-10","16:05","Mohalla A"'), true);
  assert.equal(outageCommunicationCsv([]), '"id","incident","date","time","mohallas","channel","message"');
  assert.equal(outageCommunicationFilename(), 'outage-communications.csv');
});

test('list normalisation drops bad rows', () => {
  const mixed = [first, null, 'nope', { id: 'OC-2', incidentId: 'OUT-7', date: '2026-11-10', time: '16:05', mohallas: [] }, second, third];
  assert.deepEqual(normalizeOutageCommunicationList(mixed).map((item) => item.id), ['OC-1', 'OC-2', 'OC-3']);
  assert.deepEqual(normalizeOutageCommunicationList(null), []);
  assert.deepEqual(normalizeOutageCommunicationList('not a list'), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../outage-communication.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: broadcast, status board, and notice modules are untouched', () => {
  const source = readFileSync(new URL('../outage-communication.js', import.meta.url), 'utf8');
  assert.equal(source.includes('mohalla-broadcast'), false, 'module must not reference the broadcast draft module');
  assert.equal(source.includes('status-board'), false, 'module must not reference the service-status board module');
  assert.equal(source.includes('maintenance-notice'), false, 'module must not reference the maintenance notice draft module');
  assert.equal(source.includes('outage-notice'), false, 'module must not reference the outage notice module');
  assert.equal(existsSync(new URL('../mohalla-broadcast.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../status-board.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../maintenance-notice.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../outage-notice.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'ocHeading', 'ocSummary', 'ocList', 'ocExportBtn',
    'ocIncidentId', 'ocDate', 'ocTime', 'ocMohallas', 'ocMessage', 'ocChannel', 'ocRecordBtn',
    'ocRemoveId', 'ocRemoveBtn',
    'ocFilterIncident', 'ocFilterBtn', 'ocFilterBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the outage communication panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './outage-communication.js'"), true);
  assert.equal(source.includes('renderOutageCommunications()'), true);
  assert.equal(source.includes('OUTAGE_COMMUNICATION_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
