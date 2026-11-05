import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validCommunityMeetingDate,
  normalizeCommunityMeetingList,
  recordCommunityMeeting,
  removeCommunityMeeting,
  findCommunityMeeting,
  communityMeetingSorted,
  communityMeetingsForMohalla,
  communityMeetingMohallas,
  communityMeetingSummaryText,
  communityMeetingText,
  communityMeetingHtml,
  communityMeetingAllHtml,
  communityMeetingsForMohallaHtml,
  communityMeetingCsv,
  communityMeetingFilename,
} from '../community-meeting.js';

const first = { id: 'CM-1', mohalla: 'Bani', date: '2026-11-02', topics: ['Slow speed on street 3', 'New connection requests'], agreedActions: ['Check the street 3 line by Friday', 'Share the new package list'], note: 'Good turnout, about 20 residents.' };
const second = { id: 'CM-2', mohalla: 'Bani', date: '2026-11-09', topics: 'Bill timing\nOutage on Sunday', agreedActions: 'Collect before the 5th', note: '' };
const third = { id: 'CM-3', mohalla: 'Shahdara Kalan', date: '2026-11-05', topics: ['Pole leaning near the mosque'], agreedActions: [], note: 'Pole to be checked.' };

test('half-formed notes are refused', () => {
  assert.deepEqual(recordCommunityMeeting([], { ...first, id: '' }), []);
  assert.deepEqual(recordCommunityMeeting([], { ...first, mohalla: '  ' }), []);
  assert.deepEqual(recordCommunityMeeting([], { ...first, date: '' }), []);
  assert.deepEqual(recordCommunityMeeting([], { ...first, date: '2026-02-30' }), []);
  const recorded = recordCommunityMeeting([], { ...first, topics: [], agreedActions: [], note: '' });
  assert.equal(recorded.length, 1);
  assert.deepEqual(recorded[0].topics, []);
  assert.deepEqual(recordCommunityMeeting([], first)[0].topics, ['Slow speed on street 3', 'New connection requests']);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validCommunityMeetingDate('2026-08-31'), true);
  assert.equal(validCommunityMeetingDate('2026-10-31'), true);
  assert.equal(validCommunityMeetingDate('2026-12-31'), true);
  assert.equal(validCommunityMeetingDate('2026-02-29'), false);
  assert.equal(validCommunityMeetingDate('2028-02-29'), true);
  assert.equal(validCommunityMeetingDate('2026-04-31'), false);
  assert.equal(validCommunityMeetingDate('2026-13-01'), false);
  assert.equal(validCommunityMeetingDate('02-11-2026'), false);
  assert.equal(validCommunityMeetingDate(''), false);
  assert.equal(validCommunityMeetingDate(null), false);
  assert.deepEqual(recordCommunityMeeting([], { ...first, date: '2026-02-30' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, customer: 'Ahmed Raza', billAmount: 1500, surprise: 'x' };
  const recorded = recordCommunityMeeting([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('customer' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.customer, 'Ahmed Raza');
  assert.deepEqual(Object.keys(raw).sort(), ['agreedActions', 'billAmount', 'customer', 'date', 'id', 'mohalla', 'note', 'surprise', 'topics']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordCommunityMeeting([], first);
  assert.deepEqual(recordCommunityMeeting(list, { ...first, note: 'Changed.' }), list);
  assert.deepEqual(recordCommunityMeeting(list, { ...second, id: 'CM-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordCommunityMeeting(acc, item), []);
  assert.equal(findCommunityMeeting(list, 'CM-2').mohalla, 'Bani');
  assert.equal(findCommunityMeeting(list, 'CM-9'), null);
  assert.equal(findCommunityMeeting(list, ''), null);
  assert.deepEqual(removeCommunityMeeting(list, 'CM-2').map((item) => item.id), ['CM-1', 'CM-3']);
  assert.deepEqual(removeCommunityMeeting(list, ''), list);
});

test('a mohalla page lists its meeting notes newest first with agreed actions named', () => {
  const list = [first, second, third].reduce((acc, item) => recordCommunityMeeting(acc, item), []);
  const rows = communityMeetingsForMohalla(list, 'bani');
  assert.deepEqual(rows.map((item) => item.id), ['CM-2', 'CM-1']);
  assert.equal(communityMeetingText(rows[0]).includes('Collect before the 5th'), true);
  assert.equal(communityMeetingText(rows[1]).includes('Check the street 3 line by Friday'), true);
  assert.deepEqual(communityMeetingsForMohalla(list, 'Shahdara Kalan').map((item) => item.id), ['CM-3']);
  assert.deepEqual(communityMeetingsForMohalla(list, ''), []);
  assert.deepEqual(communityMeetingsForMohalla(list, 'Nobody'), []);
  assert.deepEqual(communityMeetingSorted(list).map((item) => item.id), ['CM-1', 'CM-3', 'CM-2']);
});

test('mohalla list keeps the first spelling', () => {
  const list = [
    { id: 'CM-1', mohalla: 'Bani', date: '2026-11-02', topics: [], agreedActions: [] },
    { id: 'CM-2', mohalla: 'BANI', date: '2026-11-03', topics: [], agreedActions: [] },
    { id: 'CM-3', mohalla: 'Shahdara Kalan', date: '2026-11-04', topics: [], agreedActions: [] },
  ].reduce((acc, item) => recordCommunityMeeting(acc, item), []);
  assert.deepEqual(communityMeetingMohallas(list), ['Bani', 'Shahdara Kalan']);
});

test('summary and entry text name the mohalla, date, topics, and agreed actions plainly', () => {
  assert.equal(communityMeetingSummaryText([]), 'No community meeting notes recorded.');
  assert.equal(communityMeetingSummaryText([first, second]), '2 community meeting notes recorded across 1 mohalla.');
  assert.equal(communityMeetingSummaryText([first, third]), '2 community meeting notes recorded across 2 mohallas.');
  assert.equal(communityMeetingSummaryText([first]), '1 community meeting note recorded across 1 mohalla.');
  const text = communityMeetingText(first);
  assert.equal(text.includes('2026-11-02'), true);
  assert.equal(text.includes('Bani'), true);
  assert.equal(text.includes('Slow speed on street 3'), true);
  assert.equal(text.includes('Check the street 3 line by Friday'), true);
  assert.equal(text.includes('Good turnout'), true);
  assert.equal(communityMeetingText(third).includes('No agreed actions recorded'), true);
  assert.equal(communityMeetingText(null), 'No community meeting note recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, note: '<script>alert(1)</script>' };
  const html = communityMeetingHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(communityMeetingHtml(null), '<p>No community meeting note recorded.</p>');
  assert.equal(communityMeetingAllHtml([]), '<p>No community meeting notes recorded.</p>');
  assert.equal(communityMeetingAllHtml([first]).includes('<ul>'), true);
  assert.equal(communityMeetingsForMohallaHtml([first], 'Bani').includes('<ul>'), true);
  assert.equal(communityMeetingsForMohallaHtml([first], 'Nobody'), '<p>No community meeting notes recorded for this mohalla.</p>');
});

test('csv export and filename', () => {
  const csv = communityMeetingCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","mohalla","date","topics","agreed actions","note"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('CM-1'), true);
  assert.equal(lines[1].includes('Slow speed on street 3'), true);
  assert.equal(communityMeetingFilename(), 'community-meetings.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'CM-9', mohalla: '', date: '2026-11-10', topics: [], agreedActions: [] };
  const out = normalizeCommunityMeetingList([bad, first, { ...first, note: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['CM-1', 'CM-2']);
  assert.equal(out[0].note, first.note);
  assert.deepEqual(normalizeCommunityMeetingList('nope'), []);
  assert.deepEqual(normalizeCommunityMeetingList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../community-meeting.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the broadcast announcement and maintenance notice records are untouched', () => {
  const source = readFileSync(new URL('../community-meeting.js', import.meta.url), 'utf8');
  assert.equal(source.includes('mohalla-broadcast.js'), false, 'module must not reference the broadcast announcement module');
  assert.equal(source.includes('maintenance-notice.js'), false, 'module must not reference the maintenance notice module');
  assert.equal(existsSync(new URL('../mohalla-broadcast.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../maintenance-notice.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'cmHeading', 'cmSummary', 'cmList', 'cmExportBtn',
    'cmMohalla', 'cmDate', 'cmTopics', 'cmActions', 'cmNote', 'cmRecordBtn',
    'cmRemoveId', 'cmRemoveBtn',
    'cmFilterMohalla', 'cmFilterBtn', 'cmMohallaBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the community meeting panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './community-meeting.js'"), true);
  assert.equal(source.includes('renderCommunityMeetings()'), true);
  assert.equal(source.includes('COMMUNITY_MEETING_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
