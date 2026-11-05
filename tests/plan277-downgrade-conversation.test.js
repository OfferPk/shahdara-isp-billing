import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validDowngradeConversationDate,
  normalizeDowngradeConversationList,
  recordDowngradeConversation,
  removeDowngradeConversation,
  findDowngradeConversation,
  downgradeConversationSorted,
  downgradeConversationsForCustomer,
  downgradedConversations,
  keptPackageConversations,
  downgradeConversationCustomers,
  downgradeConversationSummaryText,
  downgradeConversationText,
  downgradeConversationHtml,
  downgradeConversationAllHtml,
  downgradeConversationCsv,
  downgradeConversationFilename,
} from '../downgrade-conversation.js';

const first = { id: 'DC-1', customer: 'Ahmed Raza', date: '2026-11-08', reason: 'Bill feels too high for the speed he uses.', outcome: 'downgraded', note: 'Moved from 5 Mbps to 3 Mbps.' };
const second = { id: 'DC-2', customer: 'Ahmed Raza', date: '2026-11-10', reason: 'Wants a cheaper package until work picks up.', outcome: 'kept package', note: '' };
const third = { id: 'DC-3', customer: 'Bilal Khan', date: '2026-11-09', reason: 'Only uses WhatsApp and YouTube now.', outcome: 'downgraded', note: 'Asked about the 100 GB package.' };

test('half-formed notes are refused', () => {
  assert.deepEqual(recordDowngradeConversation([], { ...first, id: '' }), []);
  assert.deepEqual(recordDowngradeConversation([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordDowngradeConversation([], { ...first, reason: '' }), []);
  assert.deepEqual(recordDowngradeConversation([], { ...first, reason: '   ' }), []);
  assert.deepEqual(recordDowngradeConversation([], { ...first, date: '' }), []);
  assert.deepEqual(recordDowngradeConversation([], { ...first, date: '2026-02-30' }), []);
  const recorded = recordDowngradeConversation([], { ...first, note: '' });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].note, '');
  const recordedNoNote = recordDowngradeConversation([], { id: 'DC-9', customer: 'Sara Bibi', date: '2026-11-11', reason: 'Wants to save money.' });
  assert.equal(recordedNoNote.length, 1);
  assert.equal(recordedNoNote[0].note, '');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validDowngradeConversationDate('2026-08-31'), true);
  assert.equal(validDowngradeConversationDate('2026-10-31'), true);
  assert.equal(validDowngradeConversationDate('2026-12-31'), true);
  assert.equal(validDowngradeConversationDate('2026-02-29'), false);
  assert.equal(validDowngradeConversationDate('2028-02-29'), true);
  assert.equal(validDowngradeConversationDate('2026-04-31'), false);
  assert.equal(validDowngradeConversationDate('2026-13-01'), false);
  assert.equal(validDowngradeConversationDate('10-11-2026'), false);
  assert.equal(validDowngradeConversationDate(''), false);
  assert.equal(validDowngradeConversationDate(null), false);
  assert.deepEqual(recordDowngradeConversation([], { ...first, date: '2026-02-30' }), []);
});

test('outcome spellings fold and a missing outcome reads as kept package', () => {
  assert.equal(recordDowngradeConversation([], { ...first, id: 'DC-11', outcome: 'downgrade' })[0].outcome, 'downgraded');
  assert.equal(recordDowngradeConversation([], { ...first, id: 'DC-12', outcome: 'Moved Down' })[0].outcome, 'downgraded');
  assert.equal(recordDowngradeConversation([], { ...first, id: 'DC-13', outcome: 'switched down' })[0].outcome, 'downgraded');
  assert.equal(recordDowngradeConversation([], { ...first, id: 'DC-14', outcome: 'Kept' })[0].outcome, 'kept package');
  assert.equal(recordDowngradeConversation([], { ...first, id: 'DC-15', outcome: 'stayed' })[0].outcome, 'kept package');
  assert.equal(recordDowngradeConversation([], { ...first, id: 'DC-16', outcome: 'no change' })[0].outcome, 'kept package');
  assert.equal(recordDowngradeConversation([], { ...first, id: 'DC-17', outcome: '' })[0].outcome, 'kept package');
  assert.equal(recordDowngradeConversation([], { ...first, id: 'DC-18', outcome: undefined })[0].outcome, 'kept package');
  assert.equal(recordDowngradeConversation([], { ...first, id: 'DC-19', outcome: 'something else' })[0].outcome, 'kept package');
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, package: '3 Mbps', billAmount: 1500, creditCents: 500, surprise: 'x' };
  const recorded = recordDowngradeConversation([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('package' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('creditCents' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.package, '3 Mbps');
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'creditCents', 'customer', 'date', 'id', 'note', 'outcome', 'package', 'reason', 'surprise']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordDowngradeConversation([], first);
  assert.deepEqual(recordDowngradeConversation(list, { ...first, reason: 'Changed.' }), list);
  assert.deepEqual(recordDowngradeConversation(list, { ...second, id: 'DC-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordDowngradeConversation(acc, item), []);
  assert.equal(findDowngradeConversation(list, 'DC-2').customer, 'Ahmed Raza');
  assert.equal(findDowngradeConversation(list, 'DC-9'), null);
  assert.equal(findDowngradeConversation(list, ''), null);
  assert.deepEqual(removeDowngradeConversation(list, 'DC-2').map((item) => item.id), ['DC-1', 'DC-3']);
  assert.deepEqual(removeDowngradeConversation(list, ''), list);
});

test('a customer page lists conversations in date order', () => {
  const list = [second, first, third].reduce((acc, item) => recordDowngradeConversation(acc, item), []);
  assert.deepEqual(downgradeConversationsForCustomer(list, 'ahmed raza').map((item) => item.id), ['DC-1', 'DC-2']);
  assert.deepEqual(downgradeConversationsForCustomer(list, 'Bilal Khan').map((item) => item.id), ['DC-3']);
  assert.deepEqual(downgradeConversationsForCustomer(list, ''), []);
  assert.deepEqual(downgradeConversationsForCustomer(list, 'Nobody'), []);
  assert.deepEqual(downgradeConversationSorted(list).map((item) => item.id), ['DC-1', 'DC-3', 'DC-2']);
});

test('downgraded and kept-package lists split the outcome', () => {
  const list = [first, second, third].reduce((acc, item) => recordDowngradeConversation(acc, item), []);
  assert.deepEqual(downgradedConversations(list).map((item) => item.id), ['DC-1', 'DC-3']);
  assert.deepEqual(keptPackageConversations(list).map((item) => item.id), ['DC-2']);
  assert.deepEqual(downgradedConversations([]), []);
  assert.deepEqual(keptPackageConversations([]), []);
});

test('customer list keeps the first spelling', () => {
  const list = [
    { id: 'DC-1', customer: 'Ahmed Raza', date: '2026-11-08', reason: 'Too expensive.' },
    { id: 'DC-2', customer: 'AHMED RAZA', date: '2026-11-09', reason: 'Still expensive.' },
    { id: 'DC-3', customer: 'Bilal Khan', date: '2026-11-09', reason: 'Light use.' },
  ].reduce((acc, item) => recordDowngradeConversation(acc, item), []);
  assert.deepEqual(downgradeConversationCustomers(list), ['Ahmed Raza', 'Bilal Khan']);
});

test('summary and entry text name the customer, date, and reason plainly', () => {
  assert.equal(downgradeConversationSummaryText([]), 'No downgrade conversations recorded.');
  assert.equal(downgradeConversationSummaryText([first, second]), '2 downgrade conversations recorded, 1 downgraded, 1 kept package.');
  assert.equal(downgradeConversationSummaryText([first]), '1 downgrade conversation recorded, 1 downgraded, 0 kept package.');
  const text = downgradeConversationText(first);
  assert.equal(text.includes('2026-11-08'), true);
  assert.equal(text.includes('Ahmed Raza'), true);
  assert.equal(text.includes('Bill feels too high'), true);
  assert.equal(text.includes('downgraded'), true);
  assert.equal(text.includes('Moved from 5 Mbps to 3 Mbps.'), true);
  assert.equal(downgradeConversationText(second).includes('Note:'), false);
  assert.equal(downgradeConversationText(null), 'No downgrade conversation recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, reason: '<script>alert(1)</script>' };
  const html = downgradeConversationHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(downgradeConversationHtml(null), '<p>No downgrade conversation recorded.</p>');
  assert.equal(downgradeConversationAllHtml([]), '<p>No downgrade conversations recorded.</p>');
  assert.equal(downgradeConversationAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = downgradeConversationCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","date","reason","outcome","note"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('DC-1'), true);
  assert.equal(lines[1].includes('Bill feels too high'), true);
  assert.equal(downgradeConversationFilename(), 'downgrade-conversations.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'DC-9', customer: '', date: '2026-11-10', reason: 'No customer.' };
  const out = normalizeDowngradeConversationList([bad, first, { ...first, reason: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['DC-1', 'DC-2']);
  assert.equal(out[0].reason, first.reason);
  assert.deepEqual(normalizeDowngradeConversationList('nope'), []);
  assert.deepEqual(normalizeDowngradeConversationList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../downgrade-conversation.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the preview, the change queue, and the credit record are untouched', () => {
  const source = readFileSync(new URL('../downgrade-conversation.js', import.meta.url), 'utf8');
  assert.equal(source.includes('package-change-preview.js'), false, 'module must not reference the package-change preview module');
  assert.equal(source.includes('change-requests.js'), false, 'module must not reference the plan-change queue module');
  assert.equal(source.includes('downgrade-credits.js'), false, 'module must not reference the unused-days credit record module');
  assert.equal(existsSync(new URL('../package-change-preview.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../change-requests.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../downgrade-credits.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'dcHeading', 'dcSummary', 'dcList', 'dcExportBtn',
    'dcCustomer', 'dcDate', 'dcReason', 'dcOutcome', 'dcNote', 'dcRecordBtn',
    'dcRemoveId', 'dcRemoveBtn',
    'dcDowngradedBody', 'dcKeptBody',
    'dcFilterCustomer', 'dcFilterBtn', 'dcCustomerBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the downgrade conversation panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './downgrade-conversation.js'"), true);
  assert.equal(source.includes('renderDowngradeConversations()'), true);
  assert.equal(source.includes('DOWNGRADE_CONVERSATION_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
