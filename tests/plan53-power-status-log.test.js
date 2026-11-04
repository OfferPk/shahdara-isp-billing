/**
 * plan53-power-status-log.test.js — Plan 53: site power and
 * backup-power status log.
 * Pins:
 * - the four power states, with typed spellings folded to keys
 *   and anything outside refused;
 * - noted-time validation: real calendar dates only (2026-02-30
 *   refused, 2024-02-29 accepted), times in range, date-only
 *   entries keep no invented time of day;
 * - half-formed entries refused outright, never stored
 *   half-formed; a blank note stays empty and a blank ticket link
 *   stays null, never guessed;
 * - one entry per id (a second note with the same id replaces the
 *   first), history oldest first, latest state per site with a
 *   same-time correction winning;
 * - the ticket link is one-way only: entries may name a ticket,
 *   but logging never writes into a ticket and the module holds
 *   no bill, payment, or customer field.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POWER_STATES,
  POWER_STATE_LABELS,
  POWER_STATE_OPTIONS,
  normalizePowerState,
  normalizeNotedAt,
  normalizePowerEntry,
  normalizePowerLog,
  findPowerEntry,
  upsertPowerEntry,
  removePowerEntry,
  powerHistoryForSite,
  latestPowerStatePerSite,
  entriesForTicket,
  powerSummaryText,
  latestPowerHtml,
  powerLogHtml,
  powerCsv,
  powerFilename,
} from '../power-status-log.js';

const mainSite = { id: 'p1', site: 'Main site', state: 'mains', notedAt: '2026-11-01T09:00', note: 'WAPDA restored' };
const mainBackup = { id: 'p2', site: 'Main site', state: 'backup', notedAt: '2026-11-02T18:30', note: 'Load shedding', ticketId: 't-7' };
const shopOut = { id: 'p3', site: 'Shop', state: 'out', notedAt: '2026-11-02T19:00', note: '' };
const fixture = [mainSite, mainBackup, shopOut];

test('power states fold typed spellings and refuse unknown states', () => {
  assert.equal(normalizePowerState('Mains'), 'mains');
  assert.equal(normalizePowerState('WAPDA'), 'mains');
  assert.equal(normalizePowerState('battery'), 'backup');
  assert.equal(normalizePowerState('UPS'), 'backup');
  assert.equal(normalizePowerState('gen'), 'generator');
  assert.equal(normalizePowerState('no power'), 'out');
  assert.equal(normalizePowerState('solar'), null);
  assert.equal(normalizePowerState(''), null);
  assert.equal(normalizePowerState(42), null);
  assert.deepEqual(Object.keys(POWER_STATE_LABELS).sort(), ['backup', 'generator', 'mains', 'out']);
  assert.equal(POWER_STATE_OPTIONS.length, 4);
  assert.equal(POWER_STATES.BACKUP, 'backup');
});

test('noted times accept real dates and times, refuse impossible ones', () => {
  assert.equal(normalizeNotedAt('2026-11-04T08:15'), '2026-11-04T08:15');
  assert.equal(normalizeNotedAt('2026-11-04'), '2026-11-04');
  assert.equal(normalizeNotedAt('2024-02-29T10:00'), '2024-02-29T10:00');
  assert.equal(normalizeNotedAt('2026-02-30T10:00'), null);
  assert.equal(normalizeNotedAt('2026-02-30'), null);
  assert.equal(normalizeNotedAt('2026-11-04T24:00'), null);
  assert.equal(normalizeNotedAt('2026-11-04T08:60'), null);
  assert.equal(normalizeNotedAt('04-11-2026'), null);
  assert.equal(normalizeNotedAt(''), null);
  assert.equal(normalizeNotedAt(null), null);
});

test('half-formed entries are refused and blanks stay blank, never guessed', () => {
  assert.equal(normalizePowerEntry({ id: 'x', state: 'mains', notedAt: '2026-11-04T08:00' }), null);
  assert.equal(normalizePowerEntry({ id: 'x', site: 'Shop', notedAt: '2026-11-04T08:00' }), null);
  assert.equal(normalizePowerEntry({ id: 'x', site: 'Shop', state: 'solar', notedAt: '2026-11-04T08:00' }), null);
  assert.equal(normalizePowerEntry({ id: 'x', site: 'Shop', state: 'mains', notedAt: '2026-02-30T08:00' }), null);
  assert.equal(normalizePowerEntry({ site: 'Shop', state: 'mains', notedAt: '2026-11-04T08:00' }), null);
  assert.equal(normalizePowerEntry(null), null);
  const entry = normalizePowerEntry({ id: 'x', site: ' Shop ', state: 'mains', notedAt: '2026-11-04T08:00', note: '', ticketId: '' });
  assert.equal(entry.site, 'Shop');
  assert.equal(entry.note, '');
  assert.equal(entry.ticketId, null);
  assert.equal(entry.stateLabel, 'Mains power');
});

test('one entry per id: a second note replaces the first, removal works', () => {
  const replaced = upsertPowerEntry(fixture, { id: 'p1', site: 'Main site', state: 'out', notedAt: '2026-11-03T20:00', note: 'Cut' });
  assert.equal(replaced.length, 3);
  assert.equal(findPowerEntry(replaced, 'p1').state, 'out');
  const refused = upsertPowerEntry(fixture, { id: 'p9', site: 'Shop', state: 'solar', notedAt: '2026-11-04T08:00' });
  assert.equal(refused.length, 3);
  assert.equal(removePowerEntry(fixture, 'p2').length, 2);
  assert.equal(removePowerEntry(fixture, 'missing').length, 3);
  assert.deepEqual(normalizePowerLog([...fixture, { id: 'p1', site: 'Main site', state: 'generator', notedAt: '2026-11-05T07:00' }]).length, 3);
});

test('history reads oldest first, per site or across all sites', () => {
  const history = powerHistoryForSite(fixture, 'main site');
  assert.deepEqual(history.map((entry) => entry.id), ['p1', 'p2']);
  assert.deepEqual(powerHistoryForSite(fixture, '').map((entry) => entry.id), ['p1', 'p2', 'p3']);
  assert.deepEqual(powerHistoryForSite(fixture, 'Nowhere'), []);
});

test('latest state per site: last noted wins, same-time correction wins', () => {
  const latest = latestPowerStatePerSite(fixture);
  assert.deepEqual(latest.map((entry) => entry.site), ['Main site', 'Shop']);
  assert.equal(latest[0].state, 'backup');
  assert.equal(latest[1].state, 'out');
  const corrected = latestPowerStatePerSite([
    ...fixture,
    { id: 'p4', site: 'Main site', state: 'mains', notedAt: '2026-11-02T18:30', note: 'Correction' },
  ]);
  assert.equal(corrected[0].id, 'p4');
  assert.equal(corrected[0].state, 'mains');
});

test('ticket link is one-way: entries name a ticket, tickets are never written', () => {
  assert.deepEqual(entriesForTicket(fixture, 't-7').map((entry) => entry.id), ['p2']);
  assert.deepEqual(entriesForTicket(fixture, 't-9'), []);
  assert.deepEqual(entriesForTicket(fixture, ''), []);
  const keys = Object.keys(normalizePowerEntry(mainBackup));
  assert.ok(!keys.includes('bill'));
  assert.ok(!keys.includes('payment'));
  assert.ok(!keys.includes('customerId'));
  assert.ok(!keys.includes('ticketStatus'));
});

test('inputs are never mutated', () => {
  const snapshot = JSON.parse(JSON.stringify(fixture));
  upsertPowerEntry(fixture, { id: 'p9', site: 'Shop', state: 'mains', notedAt: '2026-11-04T08:00' });
  latestPowerStatePerSite(fixture);
  powerHistoryForSite(fixture, '');
  assert.deepEqual(fixture, snapshot);
});

test('summary text names out and backup sites plainly', () => {
  assert.equal(
    powerSummaryText(fixture),
    '3 power notes across 2 sites. 1 site currently out: Shop. 1 site on backup battery: Main site.',
  );
  assert.equal(powerSummaryText([]), '0 power notes across 0 sites.');
  assert.equal(powerSummaryText([mainSite]), '1 power note across 1 site.');
});

test('HTML escapes markup and CSV quotes commas', () => {
  const nasty = { id: 'p9', site: 'Shop <b>', state: 'out', notedAt: '2026-11-04T08:00', note: 'Cut, "urgent"' };
  const html = powerLogHtml([normalizePowerEntry(nasty)]);
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('Shop &lt;b&gt;'));
  const csv = powerCsv([nasty, mainSite]);
  assert.ok(csv.includes('"Cut, ""urgent"""'));
  assert.ok(csv.startsWith('Site,State,Time noted,Note,Ticket'));
  assert.ok(latestPowerHtml([]).includes('No power notes yet.'));
  assert.ok(powerLogHtml([]).includes('No power notes in this view.'));
});

test('filename uses the date or falls back to undated', () => {
  assert.equal(powerFilename('2026-11-04'), 'power-status-log-2026-11-04.csv');
  assert.equal(powerFilename('not a date'), 'power-status-log-undated.csv');
  assert.equal(powerFilename(null), 'power-status-log-undated.csv');
});
