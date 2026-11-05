import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validCallbackQueueDate,
  validCallbackQueueTime,
  normalizeCallbackQueueList,
  recordCallback,
  removeCallback,
  findCallback,
  markCallbackDone,
  markCallbackMissed,
  rebookCallback,
  callbackQueueSorted,
  pendingCallbackQueue,
  missedCallbacks,
  overdueCallbacks,
  callbacksForCustomer,
  callbackQueueCustomers,
  callbackQueueSummaryText,
  callbackQueueText,
  callbackQueueHtml,
  callbackQueueAllHtml,
  callbackQueueCsv,
  callbackQueueFilename,
} from '../callback-queue.js';

const first = { id: 'CB-1', customer: 'Ahmed Raza', requestedDate: '2026-11-08', requestedTime: '10:30', reason: 'Wants to know why the speed drops in the evening.', status: 'pending' };
const second = { id: 'CB-2', customer: 'Ahmed Raza', requestedDate: '2026-11-08', requestedTime: '09:00', reason: 'Ask for the 5 Mbps package price.', status: 'pending' };
const third = { id: 'CB-3', customer: 'Bilal Khan', requestedDate: '2026-11-07', requestedTime: '18:00', reason: 'Line is down, call back after the visit.', status: 'missed' };

test('half-formed callbacks are refused', () => {
  assert.deepEqual(recordCallback([], { ...first, id: '' }), []);
  assert.deepEqual(recordCallback([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordCallback([], { ...first, requestedDate: '' }), []);
  assert.deepEqual(recordCallback([], { ...first, requestedTime: '' }), []);
  assert.deepEqual(recordCallback([], { ...first, reason: '' }), []);
  assert.deepEqual(recordCallback([], { ...first, reason: '   ' }), []);
  const recorded = recordCallback([], { ...first, status: '' });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].status, 'pending');
  const recordedNoStatus = recordCallback([], { id: 'CB-9', customer: 'Sara Bibi', requestedDate: '2026-11-11', requestedTime: '11:00', reason: 'Ask about the bill.' });
  assert.equal(recordedNoStatus.length, 1);
  assert.equal(recordedNoStatus[0].status, 'pending');
});

test('strict dates and times: 31-day months pass, bad dates and times fail, leap years work', () => {
  assert.equal(validCallbackQueueDate('2026-08-31'), true);
  assert.equal(validCallbackQueueDate('2026-10-31'), true);
  assert.equal(validCallbackQueueDate('2026-12-31'), true);
  assert.equal(validCallbackQueueDate('2026-02-29'), false);
  assert.equal(validCallbackQueueDate('2028-02-29'), true);
  assert.equal(validCallbackQueueDate('2026-04-31'), false);
  assert.equal(validCallbackQueueDate('2026-13-01'), false);
  assert.equal(validCallbackQueueDate('10-11-2026'), false);
  assert.equal(validCallbackQueueDate(''), false);
  assert.equal(validCallbackQueueDate(null), false);
  assert.equal(validCallbackQueueTime('00:00'), true);
  assert.equal(validCallbackQueueTime('23:59'), true);
  assert.equal(validCallbackQueueTime('24:00'), false);
  assert.equal(validCallbackQueueTime('10:60'), false);
  assert.equal(validCallbackQueueTime('9:00'), false);
  assert.equal(validCallbackQueueTime('10:30am'), false);
  assert.equal(validCallbackQueueTime(''), false);
  assert.equal(validCallbackQueueTime(null), false);
  assert.deepEqual(recordCallback([], { ...first, requestedDate: '2026-02-30' }), []);
  assert.deepEqual(recordCallback([], { ...first, requestedTime: '25:00' }), []);
});

test('status spellings fold to pending, done, or missed', () => {
  assert.equal(recordCallback([], { ...first, id: 'CB-9', status: 'Completed' })[0].status, 'done');
  assert.equal(recordCallback([], { ...first, id: 'CB-9', status: 'finished' })[0].status, 'done');
  assert.equal(recordCallback([], { ...first, id: 'CB-9', status: 'No answer' })[0].status, 'missed');
  assert.equal(recordCallback([], { ...first, id: 'CB-9', status: 'waiting' })[0].status, 'pending');
  assert.equal(recordCallback([], { ...first, id: 'CB-9', status: 'whatever' })[0].status, 'pending');
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, customerStatus: 'active', billAmount: 1500, messageSent: true, surprise: 'x' };
  const recorded = recordCallback([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('customerStatus' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('messageSent' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.customerStatus, 'active');
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'customer', 'customerStatus', 'id', 'messageSent', 'reason', 'requestedDate', 'requestedTime', 'status', 'surprise']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordCallback([], first);
  assert.deepEqual(recordCallback(list, { ...first, reason: 'Changed.' }), list);
  assert.deepEqual(recordCallback(list, { ...second, id: 'CB-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordCallback(acc, item), []);
  assert.equal(findCallback(list, 'CB-2').customer, 'Ahmed Raza');
  assert.equal(findCallback(list, 'CB-9'), null);
  assert.equal(findCallback(list, ''), null);
  assert.deepEqual(removeCallback(list, 'CB-2').map((item) => item.id), ['CB-1', 'CB-3']);
  assert.deepEqual(removeCallback(list, ''), list);
});

test('marking done or missed only moves the status', () => {
  const list = [first, second, third].reduce((acc, item) => recordCallback(acc, item), []);
  const done = markCallbackDone(list, 'CB-1');
  assert.equal(done.find((item) => item.id === 'CB-1').status, 'done');
  assert.equal(done.find((item) => item.id === 'CB-1').customer, 'Ahmed Raza');
  assert.equal(done.find((item) => item.id === 'CB-1').requestedTime, '10:30');
  assert.equal(done.find((item) => item.id === 'CB-1').reason, first.reason);
  const missed = markCallbackMissed(list, 'CB-2');
  assert.equal(missed.find((item) => item.id === 'CB-2').status, 'missed');
  assert.equal(missed.find((item) => item.id === 'CB-2').reason, second.reason);
  assert.deepEqual(markCallbackDone(list, 'CB-9'), list);
  assert.deepEqual(markCallbackMissed(list, ''), list);
  const once = markCallbackDone(list, 'CB-1');
  assert.deepEqual(markCallbackDone(once, 'CB-1'), once);
});

test('rebooking only moves a missed callback to a new time and back to pending', () => {
  const list = [first, second, third].reduce((acc, item) => recordCallback(acc, item), []);
  const rebooked = rebookCallback(list, 'CB-3', '2026-11-12', '11:00');
  const entry = rebooked.find((item) => item.id === 'CB-3');
  assert.equal(entry.status, 'pending');
  assert.equal(entry.requestedDate, '2026-11-12');
  assert.equal(entry.requestedTime, '11:00');
  assert.equal(entry.customer, 'Bilal Khan');
  assert.equal(entry.reason, third.reason);
  assert.deepEqual(rebookCallback(list, 'CB-3', '2026-02-30', '11:00'), list);
  assert.deepEqual(rebookCallback(list, 'CB-3', '2026-11-12', '25:00'), list);
  assert.deepEqual(rebookCallback(list, 'CB-9', '2026-11-12', '11:00'), list);
});

test('the queue sorts pending callbacks by requested time', () => {
  const list = [first, second, third].reduce((acc, item) => recordCallback(acc, item), []);
  assert.deepEqual(pendingCallbackQueue(list).map((item) => item.id), ['CB-2', 'CB-1']);
  assert.deepEqual(callbackQueueSorted(list).map((item) => item.id), ['CB-3', 'CB-2', 'CB-1']);
});

test('missed callbacks stay visible until done or rebooked', () => {
  const list = [first, second, third].reduce((acc, item) => recordCallback(acc, item), []);
  assert.deepEqual(missedCallbacks(list).map((item) => item.id), ['CB-3']);
  const done = markCallbackDone(list, 'CB-3');
  assert.deepEqual(missedCallbacks(done), []);
  const rebooked = rebookCallback(list, 'CB-3', '2026-11-12', '11:00');
  assert.deepEqual(missedCallbacks(rebooked), []);
  assert.deepEqual(pendingCallbackQueue(rebooked).map((item) => item.id), ['CB-2', 'CB-1', 'CB-3']);
});

test('overdue callbacks are pending ones whose requested time is past', () => {
  const list = [first, second, third].reduce((acc, item) => recordCallback(acc, item), []);
  assert.deepEqual(overdueCallbacks(list, '2026-11-08', '09:30').map((item) => item.id), ['CB-2']);
  assert.deepEqual(overdueCallbacks(list, '2026-11-08', '09:00').map((item) => item.id), []);
  assert.deepEqual(overdueCallbacks(list, '2026-11-09', '00:00').map((item) => item.id), ['CB-2', 'CB-1']);
  assert.deepEqual(overdueCallbacks(list, '2026-11-08', '10:30').map((item) => item.id), ['CB-2']);
  assert.deepEqual(overdueCallbacks(list, 'bad', '09:00'), []);
  assert.deepEqual(overdueCallbacks(list, '2026-11-08', 'bad'), []);
});

test('a customer page lists callbacks in requested-time order', () => {
  const list = [first, second, third].reduce((acc, item) => recordCallback(acc, item), []);
  assert.deepEqual(callbacksForCustomer(list, 'ahmed raza').map((item) => item.id), ['CB-2', 'CB-1']);
  assert.deepEqual(callbacksForCustomer(list, 'Bilal Khan').map((item) => item.id), ['CB-3']);
  assert.deepEqual(callbacksForCustomer(list, ''), []);
  assert.deepEqual(callbacksForCustomer(list, 'Nobody'), []);
});

test('customer list keeps the first spelling', () => {
  const list = [
    { id: 'CB-1', customer: 'Ahmed Raza', requestedDate: '2026-11-08', requestedTime: '10:30', reason: 'First call.' },
    { id: 'CB-2', customer: 'AHMED RAZA', requestedDate: '2026-11-09', requestedTime: '09:00', reason: 'Second call.' },
    { id: 'CB-3', customer: 'Bilal Khan', requestedDate: '2026-11-09', requestedTime: '11:00', reason: 'Third call.' },
  ].reduce((acc, item) => recordCallback(acc, item), []);
  assert.deepEqual(callbackQueueCustomers(list), ['Ahmed Raza', 'Bilal Khan']);
});

test('summary and entry text name the customer, time, and reason plainly', () => {
  assert.equal(callbackQueueSummaryText([]), 'No callbacks queued.');
  assert.equal(callbackQueueSummaryText([first, second, third]), '3 callbacks queued, 2 pending, 0 done, 1 missed.');
  assert.equal(callbackQueueSummaryText([first]), '1 callback queued, 1 pending, 0 done, 0 missed.');
  const text = callbackQueueText(first);
  assert.equal(text.includes('2026-11-08'), true);
  assert.equal(text.includes('10:30'), true);
  assert.equal(text.includes('Ahmed Raza'), true);
  assert.equal(text.includes('speed drops'), true);
  assert.equal(text.includes('pending'), true);
  assert.equal(callbackQueueText(null), 'No callback queued.');
});

test('html escapes input', () => {
  const evil = { ...first, reason: '<script>alert(1)</script>' };
  const html = callbackQueueHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(callbackQueueHtml(null), '<p>No callback queued.</p>');
  assert.equal(callbackQueueAllHtml([]), '<p>No callbacks queued.</p>');
  assert.equal(callbackQueueAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = callbackQueueCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","requested date","requested time","reason","status"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('CB-2'), true);
  assert.equal(lines[1].includes('5 Mbps package price'), true);
  assert.equal(callbackQueueFilename(), 'callback-queue.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'CB-9', customer: '', requestedDate: '2026-11-10', requestedTime: '10:00', reason: 'No customer.' };
  const out = normalizeCallbackQueueList([bad, first, { ...first, reason: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['CB-1', 'CB-2']);
  assert.equal(out[0].reason, first.reason);
  assert.deepEqual(normalizeCallbackQueueList('nope'), []);
  assert.deepEqual(normalizeCallbackQueueList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../callback-queue.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the inbound enquiry log is untouched', () => {
  const source = readFileSync(new URL('../callback-queue.js', import.meta.url), 'utf8');
  assert.equal(source.includes('enquiry-log.js'), false, 'module must not reference the inbound enquiry log module');
  assert.equal(source.includes('enquiryLog'), false, 'module must not reference the enquiry log by name');
  assert.equal(existsSync(new URL('../enquiry-log.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'cbHeading', 'cbSummary', 'cbList', 'cbExportBtn',
    'cbCustomer', 'cbDate', 'cbTime', 'cbReason', 'cbRecordBtn',
    'cbDoneId', 'cbDoneBtn', 'cbMissedId', 'cbMissedBtn',
    'cbRebookId', 'cbRebookDate', 'cbRebookTime', 'cbRebookBtn',
    'cbRemoveId', 'cbRemoveBtn',
    'cbFilterCustomer', 'cbFilterBtn', 'cbCustomerBody',
    'cbAsOfDate', 'cbAsOfTime', 'cbOverdueBtn', 'cbOverdueBody',
    'cbPendingBody', 'cbMissedBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the callback queue panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './callback-queue.js'"), true);
  assert.equal(source.includes('renderCallbacks()'), true);
  assert.equal(source.includes('CALLBACK_QUEUE_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
