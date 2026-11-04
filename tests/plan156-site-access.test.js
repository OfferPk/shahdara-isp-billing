import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeSiteAccess,
  normalizeSiteAccessList,
  findSiteAccess,
  upsertSiteAccess,
  removeSiteAccess,
  permissionStatus,
  sitePermissions,
  siteCurrentPermission,
  siteAccessSites,
  flaggedPermissions,
  siteAccessSummaryText,
  siteAccessAllHtml,
  siteAccessHtml,
  flaggedAccessHtml,
  siteAccessCsv,
  siteAccessFilename,
} from '../site-access.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'A-1',
  site: 'Mohalla A rooftop',
  holder: 'Building caretaker',
  scope: 'rooftop',
  expiryDate: '2026-12-31',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(normalizeSiteAccess(record({ expiryDate: '2026-08-31' })).expiryDate, '2026-08-31');
  assert.equal(normalizeSiteAccess(record({ expiryDate: '2026-10-31' })).expiryDate, '2026-10-31');
  assert.equal(normalizeSiteAccess(record({ expiryDate: '2026-12-31' })).expiryDate, '2026-12-31');
  assert.equal(normalizeSiteAccess(record({ expiryDate: '2024-02-29' })).expiryDate, '2024-02-29');
  assert.equal(normalizeSiteAccess(record({ expiryDate: '2026-02-30' })), null);
  assert.equal(normalizeSiteAccess(record({ expiryDate: '2026-04-31' })), null);
  assert.equal(normalizeSiteAccess(record({ expiryDate: '2026-09-31' })), null);
  assert.equal(normalizeSiteAccess(record({ expiryDate: '2026-11-31' })), null);
  assert.equal(normalizeSiteAccess(record({ expiryDate: '2026-02-29' })), null);
});

test('half-formed refusal: no site, no holder, no scope, or no date refused', () => {
  assert.equal(normalizeSiteAccess(record({ site: '   ' })), null);
  assert.equal(normalizeSiteAccess(record({ site: '' })), null);
  assert.equal(normalizeSiteAccess(record({ holder: '' })), null);
  assert.equal(normalizeSiteAccess(record({ scope: '' })), null);
  assert.equal(normalizeSiteAccess(record({ expiryDate: '' })), null);
  assert.equal(normalizeSiteAccess(record({ id: '' })), null);
  assert.equal(normalizeSiteAccess(null), null);
  assert.equal(normalizeSiteAccess('not an object'), null);
});

test('unknown fields dropped, so no customer, ticket, bill, or payment field can creep in', () => {
  const clean = normalizeSiteAccess(record({ customerId: 'C-1', ticketId: 'T-1', billId: 'B-1', paymentId: 'P-1' }));
  assert.deepEqual(Object.keys(clean).sort(), ['expiryDate', 'holder', 'id', 'scope', 'site']);
});

test('duplicate ids never rewritten: identical re-save unchanged, different figures refused', () => {
  const base = upsertSiteAccess([], record());
  assert.equal(base.length, 1);
  assert.deepEqual(upsertSiteAccess(base, record()), base);
  assert.deepEqual(upsertSiteAccess(base, record({ holder: 'Someone else' })), base);
  assert.equal(upsertSiteAccess(base, record({ holder: 'Someone else' })).length, 1);
});

test('find and remove', () => {
  const list = upsertSiteAccess(upsertSiteAccess([], record()), record({ id: 'A-2', site: 'Pole 7' }));
  assert.equal(findSiteAccess(list, 'A-2').site, 'Pole 7');
  assert.equal(findSiteAccess(list, 'missing'), null);
  assert.equal(removeSiteAccess(list, 'A-1').length, 1);
  assert.equal(removeSiteAccess(list, 'missing').length, 2);
});

test('site view: case-insensitive match, latest expiry first', () => {
  const list = [
    record({ id: 'A-1', expiryDate: '2026-06-30' }),
    record({ id: 'A-2', expiryDate: '2026-12-31' }),
    record({ id: 'A-3', site: 'Pole 7', expiryDate: '2027-01-31' }),
  ];
  const page = sitePermissions(list, 'mohalla a ROOFTOP');
  assert.deepEqual(page.map((item) => item.id), ['A-2', 'A-1']);
  assert.deepEqual(sitePermissions(list, ''), []);
  assert.deepEqual(sitePermissions(list, 'nowhere'), []);
});

test('current permission is the record with the latest expiry date', () => {
  const list = [
    record({ id: 'A-1', expiryDate: '2026-06-30' }),
    record({ id: 'A-2', expiryDate: '2026-12-31' }),
  ];
  assert.equal(siteCurrentPermission(list, 'Mohalla A rooftop').id, 'A-2');
  assert.equal(siteCurrentPermission(list, 'nowhere'), null);
});

test('sites list A-Z, first spelling kept', () => {
  const list = [
    record({ id: 'A-1', site: 'Pole 7' }),
    record({ id: 'A-2', site: 'mohalla a rooftop' }),
    record({ id: 'A-3', site: 'Pole 7' }),
  ];
  assert.deepEqual(siteAccessSites(list), ['mohalla a rooftop', 'Pole 7']);
});

test('permission status: current, due, expired, and invalid reference date', () => {
  assert.equal(permissionStatus(record({ expiryDate: '2026-12-31' }), '2026-11-04'), 'current');
  assert.equal(permissionStatus(record({ expiryDate: '2026-11-04' }), '2026-11-04'), 'due');
  assert.equal(permissionStatus(record({ expiryDate: '2026-11-03' }), '2026-11-04'), 'expired');
  assert.equal(permissionStatus(record(), '2026-02-30'), null);
  assert.equal(permissionStatus(record({ site: '' }), '2026-11-04'), null);
});

test('flagged list: expired or due only, most overdue first, invalid reference date empty', () => {
  const list = [
    record({ id: 'A-1', expiryDate: '2026-12-31' }),
    record({ id: 'A-2', expiryDate: '2026-10-01' }),
    record({ id: 'A-3', expiryDate: '2026-11-04' }),
    record({ id: 'A-4', expiryDate: '2026-09-15' }),
  ];
  assert.deepEqual(flaggedPermissions(list, '2026-11-04').map((item) => item.id), ['A-4', 'A-2', 'A-3']);
  assert.deepEqual(flaggedPermissions(list, 'not a date'), []);
});

test('summary text counts records, sites, expired, and due', () => {
  const list = [
    record({ id: 'A-1', expiryDate: '2026-10-01' }),
    record({ id: 'A-2', site: 'Pole 7', expiryDate: '2026-11-04' }),
    record({ id: 'A-3', site: 'Pole 7', expiryDate: '2026-12-31' }),
  ];
  assert.equal(
    siteAccessSummaryText(list, '2026-11-04'),
    '3 access records across 2 sites, 1 expired, 1 due for review.',
  );
  assert.equal(siteAccessSummaryText([], '2026-11-04'), '0 access records across 0 sites, 0 expired, 0 due for review.');
});

test('site HTML shows current permission prominent with flags; empty site says so plainly', () => {
  const list = [record({ expiryDate: '2026-10-01' }), record({ id: 'A-2', expiryDate: '2026-12-31' })];
  const html = siteAccessHtml(list, 'Mohalla A rooftop', '2026-11-04');
  assert.match(html, /Current permission for Mohalla A rooftop/);
  assert.match(html, /Building caretaker/);
  assert.match(html, /Expired/);
  assert.match(html, /Current/);
  assert.match(siteAccessHtml(list, 'nowhere', '2026-11-04'), /No access permission recorded for nowhere/);
  assert.match(siteAccessHtml(list, '', '2026-11-04'), /Pick a site/);
});

test('all HTML and flagged HTML', () => {
  const list = [record({ id: 'A-1', expiryDate: '2026-10-01' }), record({ id: 'A-2', expiryDate: '2026-12-31' })];
  assert.match(siteAccessAllHtml(list, '2026-11-04'), /Mohalla A rooftop/);
  assert.match(siteAccessAllHtml([], '2026-11-04'), /No site access permissions recorded yet/);
  assert.match(flaggedAccessHtml(list, '2026-11-04'), /most overdue first/);
  assert.match(flaggedAccessHtml(list, 'not a date'), /Pick a real reference date/);
  assert.match(flaggedAccessHtml([record()], '2026-01-01'), /No expired or review-due permissions/);
});

test('HTML escaping: markup in fields never renders as markup', () => {
  const list = [record({ site: '<b>Roof</b>', holder: 'A & B' })];
  const html = siteAccessAllHtml(list, '2026-11-04');
  assert.doesNotMatch(html, /<b>Roof<\/b>/);
  assert.match(html, /&lt;b&gt;Roof&lt;\/b&gt;/);
  assert.match(html, /A &amp; B/);
});

test('CSV and filename', () => {
  const list = [record({ site: 'Roof, "main"', holder: 'Caretaker' })];
  const csv = siteAccessCsv(list);
  assert.match(csv, /^id,site,holder,scope,expiryDate\n/);
  assert.match(csv, /"Roof, ""main"""/);
  assert.equal(siteAccessFilename(), 'site-access.csv');
});

test('inputs never mutated', () => {
  const input = record({ extra: 'x' });
  const snapshot = JSON.stringify(input);
  const list = [input];
  upsertSiteAccess(list, record({ id: 'A-2' }));
  removeSiteAccess(list, 'A-1');
  sitePermissions(list, 'Mohalla A rooftop');
  flaggedPermissions(list, '2026-11-04');
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(JSON.stringify(list), JSON.stringify([input]));
});

test('purity fence: module never reads storage, the clock, or the network, and never imports', () => {
  const source = readFileSync(join(dir, '..', 'site-access.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|Date\.now|new Date\(|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /^import /m);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of [
    'siteAccessBody', 'siteAccessSiteBody', 'siteAccessFlaggedBody', 'siteAccessSummary',
    'siteAccessSite', 'siteAccessHolder', 'siteAccessScope', 'siteAccessExpiry',
    'siteAccessSaveBtn', 'siteAccessRemoveId', 'siteAccessRemoveBtn',
    'siteAccessFilter', 'siteAccessReferenceDate', 'siteAccessExportBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
