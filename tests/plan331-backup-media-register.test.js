import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validBackupMediaDay,
  foldBackupMediaCondition,
  normalizeBackupMediaBackups,
  normalizeBackupMedium,
  normalizeBackupMediaList,
  findBackupMedium,
  recordBackupMedium,
  removeBackupMedium,
  setBackupMediumCondition,
  addBackupToMedium,
  backupMediaByCondition,
  retiredBackupMedia,
  watchBackupMedia,
  mediaHoldingBackup,
  backupMediaSummaryText,
  backupMediumSummaryText,
  backupMediumHtml,
  backupMediaHtml,
  backupMediaCsv,
  backupMediaFilename,
} from '../backup-media-register.js';

function medium(id, label, overrides = {}) {
  return {
    id,
    label,
    type: 'USB drive',
    capacity: '64 GB',
    firstUseDate: '2026-01-05',
    backupsHeld: ['backup-2026-01-05'],
    condition: 'good',
    ...overrides,
  };
}

function fixture() {
  return [
    medium('BM-1', 'Shop USB 1', { condition: 'good', backupsHeld: ['backup-2026-01-05', 'backup-2026-02-01'] }),
    medium('BM-2', 'Shop disk', { type: 'External disk', capacity: '1 TB', condition: 'watch', backupsHeld: ['backup-2026-03-01'] }),
    medium('BM-3', 'Old USB', { condition: 'retired', backupsHeld: ['backup-2025-11-02'] }),
  ];
}

test('valid days accept real calendar dates only', () => {
  assert.equal(validBackupMediaDay('2026-01-05'), '2026-01-05');
  assert.equal(validBackupMediaDay('2028-02-29'), '2028-02-29');
  assert.equal(validBackupMediaDay('2027-02-29'), '');
  assert.equal(validBackupMediaDay('2026-11-31'), '');
  assert.equal(validBackupMediaDay('2026-04-31'), '');
  assert.equal(validBackupMediaDay('2026-02-30'), '');
  assert.equal(validBackupMediaDay('2026-13-01'), '');
  assert.equal(validBackupMediaDay('5 Jan 2026'), '');
  assert.equal(validBackupMediaDay(''), '');
});

test('conditions fold to good, watch, retired, or not recorded', () => {
  assert.equal(foldBackupMediaCondition('good'), 'good');
  assert.equal(foldBackupMediaCondition('Watch'), 'watch');
  assert.equal(foldBackupMediaCondition('RETIRED'), 'retired');
  assert.equal(foldBackupMediaCondition('not recorded'), 'not recorded');
  assert.equal(foldBackupMediaCondition('not-recorded'), 'not recorded');
  assert.equal(foldBackupMediaCondition('broken'), 'not recorded');
  assert.equal(foldBackupMediaCondition(''), 'not recorded');
  assert.equal(foldBackupMediaCondition(null), 'not recorded');
});

test('backups held normalize from an array or a comma string', () => {
  assert.deepEqual(normalizeBackupMediaBackups(['a', ' b ', '', 'a']), ['a', 'b']);
  assert.deepEqual(normalizeBackupMediaBackups('a, b,, c'), ['a', 'b', 'c']);
  assert.deepEqual(normalizeBackupMediaBackups(''), []);
  assert.deepEqual(normalizeBackupMediaBackups(null), []);
});

test('a medium with no label is refused, and unknown fields are dropped', () => {
  assert.equal(normalizeBackupMedium(medium('BM-1', '')), null);
  assert.equal(normalizeBackupMedium(medium('', 'Shop USB 1')), null);
  assert.equal(normalizeBackupMedium(null), null);
  const clean = normalizeBackupMedium(medium('BM-1', 'Shop USB 1', { amount: 5000, customer: 'CUST-1' }));
  assert.equal(clean.amount, undefined);
  assert.equal(clean.customer, undefined);
  assert.equal(clean.label, 'Shop USB 1');
});

test('a made-up first use date is stored as blank, never guessed', () => {
  const clean = normalizeBackupMedium(medium('BM-1', 'Shop USB 1', { firstUseDate: '2026-02-30' }));
  assert.equal(clean.firstUseDate, '');
  const dated = normalizeBackupMedium(medium('BM-1', 'Shop USB 1', { firstUseDate: '2026-01-05' }));
  assert.equal(dated.firstUseDate, '2026-01-05');
});

test('record adds a medium, refuses a duplicate id, and never rewrites it', () => {
  const before = fixture();
  const added = recordBackupMedium(before, medium('BM-4', 'New USB', { condition: 'good' }));
  assert.equal(added.length, 4);
  assert.equal(added[3].label, 'New USB');
  const dup = recordBackupMedium(before, medium('BM-1', 'Different label'));
  assert.equal(dup.length, 3);
  assert.equal(dup[0].label, 'Shop USB 1');
  const noLabel = recordBackupMedium(before, medium('BM-5', ''));
  assert.equal(noLabel.length, 3);
});

test('find returns a medium by id, or null', () => {
  assert.equal(findBackupMedium(fixture(), 'BM-2').label, 'Shop disk');
  assert.equal(findBackupMedium(fixture(), 'BM-9'), null);
  assert.equal(findBackupMedium(fixture(), ''), null);
});

test('remove takes a medium out, but a retired medium stays listed', () => {
  const removed = removeBackupMedium(fixture(), 'BM-2');
  assert.equal(removed.length, 2);
  assert.equal(removed.some((entry) => entry.id === 'BM-2'), false);
  const retired = removeBackupMedium(fixture(), 'BM-3');
  assert.equal(retired.length, 3);
  assert.equal(retired.some((entry) => entry.id === 'BM-3'), true);
  assert.equal(retired[2].condition, 'retired');
  const unknown = removeBackupMedium(fixture(), 'BM-9');
  assert.equal(unknown.length, 3);
});

test('setting a condition changes only that medium', () => {
  const next = setBackupMediumCondition(fixture(), 'BM-2', 'good');
  assert.equal(next[1].condition, 'good');
  assert.equal(next[0].condition, 'good');
  assert.equal(next[2].condition, 'retired');
  const watched = setBackupMediumCondition(fixture(), 'BM-1', 'watch');
  assert.equal(watched[0].condition, 'watch');
  assert.equal(watched[2].condition, 'retired');
  const bad = setBackupMediumCondition(fixture(), 'BM-1', 'broken');
  assert.equal(bad[0].condition, 'good');
  const missing = setBackupMediumCondition(fixture(), 'BM-9', 'watch');
  assert.equal(missing.length, 3);
  assert.equal(missing[0].condition, 'good');
});

test('adding a backup changes only that medium and never duplicates', () => {
  const next = addBackupToMedium(fixture(), 'BM-2', 'backup-2026-04-01');
  assert.deepEqual(next[1].backupsHeld, ['backup-2026-03-01', 'backup-2026-04-01']);
  assert.deepEqual(next[0].backupsHeld, ['backup-2026-01-05', 'backup-2026-02-01']);
  const dup = addBackupToMedium(fixture(), 'BM-2', 'backup-2026-03-01');
  assert.deepEqual(dup[1].backupsHeld, ['backup-2026-03-01']);
  const empty = addBackupToMedium(fixture(), 'BM-2', '   ');
  assert.deepEqual(empty[1].backupsHeld, ['backup-2026-03-01']);
  const missing = addBackupToMedium(fixture(), 'BM-9', 'backup-2026-04-01');
  assert.equal(missing.length, 3);
});

test('media list by condition, label A-Z', () => {
  assert.deepEqual(backupMediaByCondition(fixture(), 'good').map((entry) => entry.label), ['Shop USB 1']);
  assert.deepEqual(backupMediaByCondition(fixture(), 'watch').map((entry) => entry.label), ['Shop disk']);
  assert.deepEqual(backupMediaByCondition(fixture(), 'retired').map((entry) => entry.label), ['Old USB']);
  assert.deepEqual(backupMediaByCondition(fixture(), 'broken'), []);
});

test('retired and watch lists name the media to keep or check', () => {
  assert.deepEqual(retiredBackupMedia(fixture()).map((entry) => entry.id), ['BM-3']);
  assert.deepEqual(watchBackupMedia(fixture()).map((entry) => entry.id), ['BM-2']);
});

test('media holding a backup matches the exact name, case-insensitively', () => {
  assert.deepEqual(mediaHoldingBackup(fixture(), 'BACKUP-2026-03-01').map((entry) => entry.id), ['BM-2']);
  assert.deepEqual(mediaHoldingBackup(fixture(), 'backup-2026-03').map((entry) => entry.id), []);
  assert.deepEqual(mediaHoldingBackup(fixture(), ''), []);
});

test('summary counts media by condition and backups held', () => {
  assert.equal(backupMediaSummaryText([]), 'No backup media registered.');
  assert.equal(
    backupMediaSummaryText(fixture()),
    '3 backup media registered (1 good, 1 watch, 1 retired, 0 not recorded); 4 backups held in total.',
  );
  assert.equal(
    backupMediaSummaryText([medium('BM-1', 'Only USB', { backupsHeld: [] })]),
    '1 backup medium registered (1 good, 0 watch, 0 retired, 0 not recorded); 0 backups held in total.',
  );
});

test('one medium reads in plain words', () => {
  assert.equal(
    backupMediumSummaryText(medium('BM-1', 'Shop USB 1')),
    'Shop USB 1 (USB drive): condition good, capacity 64 GB, first used 2026-01-05, holds backup-2026-01-05.',
  );
  assert.equal(
    backupMediumSummaryText(medium('BM-1', 'Shop USB 1', { type: '', capacity: '', firstUseDate: '', backupsHeld: [] })),
    'Shop USB 1: condition good, holds no backup yet.',
  );
  assert.equal(backupMediumSummaryText(null), 'No backup medium.');
});

test('HTML escapes user-entered text', () => {
  const html = backupMediumHtml(medium('BM-1', '<b>USB</b> & "drive"', { type: '<script>' }));
  assert.equal(html.includes('<b>USB</b>'), false);
  assert.equal(html.includes('&lt;b&gt;USB&lt;/b&gt;'), true);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(backupMediaHtml([]), '<p>No backup media registered.</p>');
});

test('CSV lists media label A-Z with a header', () => {
  const csv = backupMediaCsv(fixture());
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'Label,Type,Capacity,First used,Backups held,Condition');
  assert.equal(lines.length, 4);
  assert.equal(lines[1].startsWith('Old USB,'), true);
  assert.equal(lines[1].endsWith(',retired'), true);
  assert.equal(lines[2].includes('backup-2026-03-01'), true);
  assert.equal(csv.endsWith('\n'), true);
});

test('CSV quotes a label carrying a comma', () => {
  const csv = backupMediaCsv([medium('BM-1', 'USB, shop', { backupsHeld: [] })]);
  assert.equal(csv.includes('"USB, shop"'), true);
});

test('filename is the register CSV name', () => {
  assert.equal(backupMediaFilename(), 'backup-media-register.csv');
});

test('recording never mutates the input list', () => {
  const before = fixture();
  const snapshot = JSON.stringify(before);
  recordBackupMedium(before, medium('BM-4', 'New USB'));
  removeBackupMedium(before, 'BM-1');
  setBackupMediumCondition(before, 'BM-1', 'watch');
  addBackupToMedium(before, 'BM-1', 'backup-2026-05-01');
  assert.equal(JSON.stringify(before), snapshot);
});
