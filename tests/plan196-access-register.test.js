import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDate,
  normalizeAccessEntry,
  normalizeAccessList,
  findAccessEntry,
  isCurrentlyHeld,
  recordAccessEntry,
  markAccessReturned,
  removeAccessEntry,
  accessSorted,
  currentHolders,
  returnedAccess,
  accessForHolder,
  accessForItem,
  accessSummaryText,
  accessText,
  accessHtml,
  accessAllHtml,
  accessCsv,
  accessFilename,
} from '../access-register.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'access-register.js'), 'utf8');

function entry(overrides = {}) {
  return {
    id: 'AK-1',
    item: 'Shop front key',
    holder: 'Saad',
    dateIssued: '2026-11-01',
    dateReturned: '',
    note: 'Main shutter key.',
    ...overrides,
  };
}

test('half-formed refusal: no id, no item, no holder, or no strict issue date refused', () => {
  assert.equal(normalizeAccessEntry(entry({ id: '' })), null);
  assert.equal(normalizeAccessEntry(entry({ item: '   ' })), null);
  assert.equal(normalizeAccessEntry(entry({ holder: '' })), null);
  assert.equal(normalizeAccessEntry(entry({ dateIssued: '2026-13-01' })), null);
  assert.equal(normalizeAccessEntry(entry({ dateIssued: '01-11-2026' })), null);
  assert.equal(normalizeAccessEntry(null), null);
  assert.equal(normalizeAccessEntry('nope'), null);
  assert.deepEqual(recordAccessEntry([], entry({ holder: '' })), []);
});

test('strict dates: 31-day months, Feb 29 leap/non-leap', () => {
  assert.equal(normalizeDate('2026-08-31'), '2026-08-31');
  assert.equal(normalizeDate('2026-04-31'), null);
  assert.equal(normalizeDate('2024-02-29'), '2024-02-29');
  assert.equal(normalizeDate('2026-02-29'), null);
  assert.equal(normalizeDate('2026-02-30'), null);
  assert.equal(normalizeDate('2026-00-10'), null);
});

test('return date before issue date refused', () => {
  assert.equal(normalizeAccessEntry(entry({ dateReturned: '2026-10-31' })), null);
  assert.equal(normalizeAccessEntry(entry({ dateReturned: 'not-a-date' })), null);
  assert.equal(
    normalizeAccessEntry(entry({ dateReturned: '2026-11-01' })).dateReturned,
    '2026-11-01',
  );
});

test('unknown fields dropped: no code, password, pin, or sending field can creep in', () => {
  const clean = normalizeAccessEntry(entry({
    code: '1234',
    password: 'secret',
    pin: '9999',
    bill: 'B-1',
    payment: 500,
    sendTo: 'someone',
  }));
  assert.deepEqual(Object.keys(clean).sort(), [
    'dateIssued',
    'dateReturned',
    'holder',
    'id',
    'item',
    'note',
  ]);
  assert.equal('code' in clean, false);
  assert.equal('password' in clean, false);
});

test('one current holder per item: second issue while held is refused, case-insensitive', () => {
  const held = recordAccessEntry([], entry());
  assert.equal(held.length, 1);
  assert.equal(isCurrentlyHeld(held, 'Shop front key'), true);
  assert.equal(isCurrentlyHeld(held, 'SHOP FRONT KEY'), true);
  assert.equal(recordAccessEntry(held, entry({ id: 'AK-2', holder: 'Umair' })).length, 1);
  assert.equal(recordAccessEntry(held, entry({ id: 'AK-3', item: 'Back room key' })).length, 2);
  const returned = markAccessReturned(held, 'AK-1', '2026-11-05');
  assert.equal(isCurrentlyHeld(returned, 'Shop front key'), false);
  assert.equal(recordAccessEntry(returned, entry({ id: 'AK-4', holder: 'Umair' })).length, 2);
});

test('duplicate ids never rewritten', () => {
  const list = recordAccessEntry([], entry());
  assert.equal(
    recordAccessEntry(list, entry({ holder: 'Umair' }))[0].holder,
    'Saad',
  );
  assert.equal(list.length, 1);
});

test('find and remove', () => {
  const list = recordAccessEntry([], entry());
  assert.equal(findAccessEntry(list, 'AK-1').holder, 'Saad');
  assert.equal(findAccessEntry(list, 'AK-9'), null);
  assert.equal(findAccessEntry(list, ''), null);
  assert.equal(removeAccessEntry(list, 'AK-1').length, 0);
  assert.equal(removeAccessEntry(list, 'AK-9').length, 1);
});

test('mark returned: bad date, before-issue date, and already-returned leave record unchanged', () => {
  const list = recordAccessEntry([], entry());
  assert.equal(markAccessReturned(list, 'AK-1', 'bad')[0].dateReturned, '');
  assert.equal(markAccessReturned(list, 'AK-1', '2026-10-01')[0].dateReturned, '');
  assert.equal(markAccessReturned(list, 'AK-9', '2026-11-05').length, 1);
  const returned = markAccessReturned(list, 'AK-1', '2026-11-05');
  assert.equal(returned[0].dateReturned, '2026-11-05');
  assert.equal(markAccessReturned(returned, 'AK-1', '2026-11-06')[0].dateReturned, '2026-11-05');
});

test('returned items stay in history after return', () => {
  const list = recordAccessEntry([], entry());
  const returned = markAccessReturned(list, 'AK-1', '2026-11-05');
  assert.equal(returned.length, 1);
  assert.equal(returnedAccess(returned).length, 1);
  assert.equal(currentHolders(returned).length, 0);
});

test('sorting: item A-Z, then newest issue first, then id', () => {
  const list = [
    entry({ id: 'AK-2', item: 'Back room key', dateIssued: '2026-11-02' }),
    entry({ id: 'AK-1', item: 'Shop front key', dateIssued: '2026-11-01' }),
    entry({ id: 'AK-3', item: 'Back room key', dateIssued: '2026-11-03', dateReturned: '2026-11-04' }),
  ];
  assert.deepEqual(accessSorted(list).map((item) => item.id), ['AK-3', 'AK-2', 'AK-1']);
});

test('holder and item views are case-insensitive', () => {
  const list = recordAccessEntry(
    recordAccessEntry([], entry()),
    entry({ id: 'AK-2', item: 'Back room key', holder: 'umair' }),
  );
  assert.equal(accessForHolder(list, 'SAAD').length, 1);
  assert.equal(accessForHolder(list, 'Umair').length, 1);
  assert.equal(accessForHolder(list, 'Nobody').length, 0);
  assert.equal(accessForItem(list, 'back ROOM key').length, 1);
  assert.equal(accessForHolder(list, '').length, 0);
});

test('current and returned views', () => {
  const list = recordAccessEntry(
    recordAccessEntry([], entry()),
    entry({ id: 'AK-2', item: 'Back room key', dateReturned: '2026-11-04' }),
  );
  assert.equal(currentHolders(list).length, 1);
  assert.equal(returnedAccess(list).length, 1);
});

test('summary text', () => {
  assert.equal(accessSummaryText([]), 'No access items recorded.');
  const list = recordAccessEntry(
    recordAccessEntry([], entry()),
    entry({ id: 'AK-2', item: 'Back room key', dateReturned: '2026-11-04' }),
  );
  assert.equal(accessSummaryText(list), '2 access records, 1 currently held, 1 returned.');
});

test('text rendering: held vs returned, note included only when present', () => {
  assert.equal(
    accessText(entry()),
    'Shop front key held by Saad since 2026-11-01, currently held — Main shutter key.',
  );
  assert.equal(
    accessText(entry({ dateReturned: '2026-11-05', note: '' })),
    'Shop front key held by Saad since 2026-11-01, returned 2026-11-05',
  );
  assert.equal(accessText(entry({ holder: '' })), '');
});

test('HTML escaping', () => {
  const html = accessHtml(entry({ item: '<b>Key</b>', holder: 'A & B' }));
  assert.equal(html.includes('<b>'), false);
  assert.ok(html.includes('&lt;b&gt;Key&lt;/b&gt;'));
  assert.ok(html.includes('A &amp; B'));
  assert.equal(accessAllHtml([entry()]).includes('Shop front key'), true);
  assert.equal(accessHtml(entry({ holder: '' })), '');
});

test('CSV columns and filename', () => {
  const list = recordAccessEntry([], entry());
  const csv = accessCsv(list);
  assert.ok(csv.startsWith('"id","item","holder","dateIssued","dateReturned","note"'));
  assert.ok(csv.includes('"AK-1","Shop front key","Saad","2026-11-01","","Main shutter key."'));
  assert.equal(accessFilename(), 'access-register.csv');
});

test('non-mutation: inputs are never changed', () => {
  const raw = entry({ note: '  padded  ' });
  const frozen = JSON.parse(JSON.stringify(raw));
  recordAccessEntry([], raw);
  normalizeAccessList([raw]);
  markAccessReturned([raw], 'AK-1', '2026-11-05');
  assert.deepEqual(raw, frozen);
});

test('list normalization: bad entries dropped, duplicate ids keep first', () => {
  const list = normalizeAccessList([
    entry(),
    entry({ holder: 'Umair' }),
    entry({ item: '' }),
    'junk',
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].holder, 'Saad');
  assert.deepEqual(normalizeAccessList('nope'), []);
});

test('purity fence: no imports, no storage, no network, no site-access or tool-custody import', () => {
  assert.equal(/^\s*import\s/m.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
  assert.equal(moduleSrc.includes("from './site-access"), false);
  assert.equal(moduleSrc.includes("from './tool-custody"), false);
});

test('panel ids exist in index.html', () => {
  for (const id of ['akHeading', 'akSummary', 'akExportBtn', 'akItem', 'akHolder', 'akDateIssued', 'akNote', 'akSaveBtn', 'akReturnId', 'akReturnDate', 'akReturnBtn', 'akRemoveId', 'akRemoveBtn', 'akFilter', 'akBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring: import, store, render function, render-loop call', () => {
  assert.ok(appJs.includes("from './access-register.js'"));
  assert.ok(appJs.includes('shahdara_access_register_v1'));
  assert.ok(appJs.includes('function renderAccessRegister()'));
  assert.ok(appJs.includes('renderAccessRegister();'));
});
