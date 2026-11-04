import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDate,
  normalizeVersion,
  normalizeChanges,
  normalizeVersionEntry,
  normalizeVersionList,
  findVersionEntry,
  recordVersionEntry,
  removeVersionEntry,
  versionsSorted,
  versionsForVersion,
  latestVersionEntry,
  versionSummaryText,
  versionText,
  versionHtml,
  versionAllHtml,
  versionCsv,
  versionFilename,
} from '../version-log.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'version-log.js'), 'utf8');

function entry(overrides = {}) {
  return {
    id: 'VL-1',
    version: '1.11.0',
    date: '2026-11-03',
    changes: ['Faster bill list for the shop'],
    shopNote: 'Nothing new to learn.',
    ...overrides,
  };
}

test('half-formed entries are refused', () => {
  assert.equal(normalizeVersionEntry(entry({ id: '' })), null);
  assert.equal(normalizeVersionEntry(entry({ version: '' })), null);
  assert.equal(normalizeVersionEntry(entry({ date: '' })), null);
  assert.equal(normalizeVersionEntry(entry({ changes: [] })), null);
  assert.equal(normalizeVersionEntry(entry({ changes: ['  ', '\n'] })), null);
  assert.equal(normalizeVersionEntry(null), null);
  assert.equal(normalizeVersionEntry('nope'), null);
  assert.equal(recordVersionEntry([], entry({ id: '' })).length, 0);
});

test('version format: x.y and x.y.z accepted, anything else refused', () => {
  assert.equal(normalizeVersion('1.11.0'), '1.11.0');
  assert.equal(normalizeVersion('1.12'), '1.12');
  assert.equal(normalizeVersion('  1.11.0  '), '1.11.0');
  assert.equal(normalizeVersion('1'), null);
  assert.equal(normalizeVersion('v1.11.0'), null);
  assert.equal(normalizeVersion('1.11.0.1'), null);
  assert.equal(normalizeVersion('1.11.x'), null);
  assert.equal(normalizeVersion(''), null);
});

test('strict calendar dates: 31-day months and Feb 29 leap rules', () => {
  assert.equal(normalizeDate('2026-08-31'), '2026-08-31');
  assert.equal(normalizeDate('2026-10-31'), '2026-10-31');
  assert.equal(normalizeDate('2026-12-31'), '2026-12-31');
  assert.equal(normalizeDate('2026-04-31'), null);
  assert.equal(normalizeDate('2024-02-29'), '2024-02-29');
  assert.equal(normalizeDate('2026-02-29'), null);
  assert.equal(normalizeDate('2026-02-30'), null);
  assert.equal(normalizeDate('2026-13-01'), null);
  assert.equal(normalizeDate('2026-00-10'), null);
  assert.equal(normalizeDate('2026-11-00'), null);
  assert.equal(normalizeDate('2026/11/03'), null);
  assert.equal(normalizeDate('03-11-2026'), null);
});

test('changes normalize from arrays and newline strings, deduped case-insensitively', () => {
  assert.deepEqual(normalizeChanges(['  Faster bill list  ', '', 'New receipt print']), ['Faster bill list', 'New receipt print']);
  assert.deepEqual(normalizeChanges('First change\nSecond change\n\n'), ['First change', 'Second change']);
  assert.deepEqual(normalizeChanges(['Same line', 'same LINE', 'Other']), ['Same line', 'Other']);
  assert.deepEqual(normalizeChanges([]), []);
  assert.deepEqual(normalizeChanges(''), []);
});

test('technical filler in a change line refuses the whole entry', () => {
  for (const filler of ['Fixed in commit abc123', 'Merged PR #900', 'Deployed today', 'New API endpoint', 'Refactored the code', 'Hotfix release', 'See the pull request', 'Moved to the new backend']) {
    assert.equal(normalizeChanges([filler]), null, filler);
    assert.equal(normalizeVersionEntry(entry({ changes: [filler] })), null, filler);
  }
  // Whole-word matching only: ordinary words containing the letters are fine.
  assert.deepEqual(normalizeChanges(['Rapid receipt printing', 'Price list updated', 'Capital expenses view']), ['Rapid receipt printing', 'Price list updated', 'Capital expenses view']);
});

test('unknown fields are dropped, never stored', () => {
  const clean = normalizeVersionEntry(entry({ billId: 'B-1', payment: 500, customer: 'C-1', sendNow: true }));
  assert.deepEqual(Object.keys(clean).sort(), ['changes', 'date', 'id', 'shopNote', 'version']);
});

test('duplicate ids are never rewritten', () => {
  const first = recordVersionEntry([], entry());
  const second = recordVersionEntry(first, entry({ changes: ['A different change'] }));
  assert.equal(second.length, 1);
  assert.deepEqual(second[0].changes, ['Faster bill list for the shop']);
});

test('find and remove', () => {
  const list = recordVersionEntry(recordVersionEntry([], entry()), entry({ id: 'VL-2', version: '1.12.0', date: '2026-11-05' }));
  assert.equal(findVersionEntry(list, 'VL-2').version, '1.12.0');
  assert.equal(findVersionEntry(list, 'VL-9'), null);
  assert.equal(findVersionEntry(list, ''), null);
  assert.equal(removeVersionEntry(list, 'VL-1').length, 1);
  assert.equal(removeVersionEntry(list, 'VL-9').length, 2);
});

test('versions list newest first, id A-Z on date ties', () => {
  const list = [
    entry({ id: 'VL-3', date: '2026-11-01' }),
    entry({ id: 'VL-1', date: '2026-11-05' }),
    entry({ id: 'VL-2', date: '2026-11-05' }),
  ];
  assert.deepEqual(versionsSorted(list).map((item) => item.id), ['VL-1', 'VL-2', 'VL-3']);
});

test('versionsForVersion filters exactly, bad version gives nothing', () => {
  const list = [
    entry({ id: 'VL-1', version: '1.11.0' }),
    entry({ id: 'VL-2', version: '1.12.0', date: '2026-11-05' }),
  ];
  assert.deepEqual(versionsForVersion(list, '1.12.0').map((item) => item.id), ['VL-2']);
  assert.deepEqual(versionsForVersion(list, '1.13.0'), []);
  assert.deepEqual(versionsForVersion(list, 'nope'), []);
});

test('latestVersionEntry is the newest, null when empty', () => {
  const list = [
    entry({ id: 'VL-1', date: '2026-11-03' }),
    entry({ id: 'VL-2', date: '2026-11-05' }),
  ];
  assert.equal(latestVersionEntry(list).id, 'VL-2');
  assert.equal(latestVersionEntry([]), null);
});

test('summary text names the latest version and date', () => {
  assert.equal(versionSummaryText([]), 'No version entries recorded.');
  const list = [
    entry({ id: 'VL-1', version: '1.11.0', date: '2026-11-03' }),
    entry({ id: 'VL-2', version: '1.12.0', date: '2026-11-05' }),
  ];
  assert.equal(versionSummaryText(list), '2 version entries recorded, latest: 1.12.0 on 2026-11-05');
});

test('version text lists changes and the shop note, plainly', () => {
  const textOut = versionText(entry({ changes: ['Faster bill list', 'Clearer receipts'], shopNote: 'Nothing new to learn.' }));
  assert.match(textOut, /2026-11-03 — version 1\.11\.0/);
  assert.match(textOut, /- Faster bill list/);
  assert.match(textOut, /- Clearer receipts/);
  assert.match(textOut, /Note for the shop: Nothing new to learn\./);
  assert.equal(versionText(entry({ shopNote: '' })).includes('Note for the shop'), false);
  assert.equal(versionText(entry({ id: '' })), '');
});

test('HTML escapes operator text', () => {
  const html = versionHtml(entry({ changes: ['<script>alert(1)</script>'], shopNote: 'A & B' }));
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A &amp; B/);
  assert.equal(versionAllHtml([entry()]).includes('1.11.0'), true);
});

test('CSV columns and filename', () => {
  const csv = versionCsv([entry({ changes: ['One', 'Two'], shopNote: 'Note, with comma' })]);
  assert.match(csv, /^"id","version","date","changes","shopNote"/);
  assert.match(csv, /"VL-1","1\.11\.0","2026-11-03","One \| Two","Note, with comma"/);
  assert.equal(versionFilename(), 'version-log.csv');
});

test('inputs are never mutated', () => {
  const raw = entry({ changes: ['  Padded change  '] });
  const before = JSON.stringify(raw);
  const out = recordVersionEntry([], raw);
  assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(out[0].changes, ['Padded change']);
  assert.notEqual(out[0].changes, raw.changes);
});

test('list normalization drops bad entries and keeps the first id', () => {
  const list = normalizeVersionList([
    entry(),
    entry({ id: 'VL-1', changes: ['Different'] }),
    entry({ id: 'VL-2', version: 'bad' }),
    null,
    'junk',
  ]);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].changes, ['Faster bill list for the shop']);
  assert.deepEqual(normalizeVersionList('not an array'), []);
});

test('purity fence: no imports, no storage, no network, no release-assurance import', () => {
  assert.equal(/^\s*import\s/m.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
  assert.equal(moduleSrc.includes("from './release-assurance"), false);
  assert.equal(moduleSrc.includes('APP_VERSION ='), false);
});

test('panel ids exist in index.html', () => {
  for (const id of ['vlHeading', 'vlSummary', 'vlExportBtn', 'vlVersion', 'vlDate', 'vlChanges', 'vlShopNote', 'vlSaveBtn', 'vlRemoveId', 'vlRemoveBtn', 'vlFilter', 'vlBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring: import, store, render function, render-loop call', () => {
  assert.ok(appJs.includes("from './version-log.js'"));
  assert.ok(appJs.includes('shahdara_version_log_v1'));
  assert.ok(appJs.includes('function renderVersionLog()'));
  assert.ok(appJs.includes('renderVersionLog();'));
});
