/**
 * emergency-runbook-card.test.js — SISP-160 [P2]: Printable Emergency
 * NOC, Splicer & Top-10 Feeder Root Homes Runbook Card.
 *
 * Spec criterion (read-latest.txt, SISP-160): "Store emergency contacts
 * (Upstream Bandwidth NOC, Contract Splicer, LESCO/WAPDA Complaint,
 * Shop Numbers) in sisp_emergency_runbook_v1 and combine with the
 * auto-ranked Top 10 upstream root homes into a 1-page printable
 * runbook sheet." Tests pin Top-10 root house ranking and printable
 * runbook rendering.
 *
 * Pins:
 *  - ranking: a root with 6 downstreams beats a root with 3; a
 *    mid-chain house with 4 ranks by its OWN count; ties break by
 *    customerNumber ascending; archived downstreams are traversed
 *    through but never counted; a 12-house fixture yields exactly 10
 *    rows;
 *  - the store starts COMPLETELY EMPTY, sanitizes malformed entries,
 *    caps the shop list at 6, and round-trips through storage and
 *    through JSON backups under the safe-merge rule (adopt on an
 *    empty device, conflict — never overwrite — when both differ);
 *  - rendering: saved contacts print verbatim, missing contacts print
 *    "Not recorded", top-10 rows print with counts, no raw i18n keys
 *    in either language, recorded data is HTML-escaped;
 *  - i18n: every runbook_* key used exists in BOTH dictionaries;
 *  - wiring: Home card button, dialog markup, app.js controller,
 *    token CSS, runtime graph reachability.
 * Synthetic data only — no real person's name or number anywhere.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import {
  EMERGENCY_RUNBOOK_KEY,
  EMERGENCY_RUNBOOK_SHOP_CAP,
  buildEmergencyRunbook,
  buildTopRootHomes,
  formatRunbookGeneratedAt,
  generateEmergencyRunbookPrintHtml,
  hasEmergencyRunbookContacts,
  loadEmergencyRunbook,
  sanitizeEmergencyRunbook,
  saveEmergencyRunbook
} from '../emergency-runbook-card.js';
import { collectRuntimeFiles } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

const house = (id, customerNumber, overrides = {}) => ({
  id,
  customerNumber,
  name: `House ${id}`,
  mohalla: 'Test Mohalla',
  phone: '',
  splitterBoxId: '',
  archived: false,
  upstreamCustomerId: '',
  ...overrides
});

/**
 * Ranking fixture — 12 houses carry >= 1 active downstream:
 *  chain A(10) -> a1(21) -> a2(32) -> a3(33) -> a4(44) -> a5(55) -> a6(66)
 *    counts: A=6, a1=5, a2=4 (mid-chain), a3=3, a4=2, a5=1, a6=0
 *  star C(2) -> c1,c2,c3            count 3
 *  star B(5) -> b1,b2,b3            count 3
 *  star D(7) -> d1,d2               count 2
 *  pair E(8) -> e1                  count 1
 *  pair F(9) -> f1                  count 1
 *  pair G(11) -> g1                 count 1
 * Ranked (12): A6, a1 5, a2 4, C3(#2), B3(#5), a3 3(#33), D2(#7),
 * a4 2(#44), E1(#8), F1(#9), G1(#11), a5 1(#55) — top 10 cuts G + a5.
 */
function rankingFixture() {
  const customers = [
    house('A', 10, { name: 'Root Alpha', mohalla: 'Alpha Mohalla', phone: '0300-0000010', splitterBoxId: 'SPL-T-01' }),
    house('a1', 21, { upstreamCustomerId: 'A' }),
    house('a2', 32, { upstreamCustomerId: 'a1', name: 'Mid House' }),
    house('a3', 33, { upstreamCustomerId: 'a2' }),
    house('a4', 44, { upstreamCustomerId: 'a3' }),
    house('a5', 55, { upstreamCustomerId: 'a4' }),
    house('a6', 66, { upstreamCustomerId: 'a5' }),
    house('C', 2, { name: 'Root Charlie' }),
    house('c1', 71, { upstreamCustomerId: 'C' }),
    house('c2', 72, { upstreamCustomerId: 'C' }),
    house('c3', 73, { upstreamCustomerId: 'C' }),
    house('B', 5, { name: 'Root Bravo' }),
    house('b1', 81, { upstreamCustomerId: 'B' }),
    house('b2', 82, { upstreamCustomerId: 'B' }),
    house('b3', 83, { upstreamCustomerId: 'B' }),
    house('D', 7),
    house('d1', 91, { upstreamCustomerId: 'D' }),
    house('d2', 92, { upstreamCustomerId: 'D' }),
    house('E', 8),
    house('e1', 93, { upstreamCustomerId: 'E' }),
    house('F', 9),
    house('f1', 94, { upstreamCustomerId: 'F' }),
    house('G', 11),
    house('g1', 95, { upstreamCustomerId: 'G' })
  ];
  return customers;
}

test('ranking: root with 6 downstreams beats a root with 3; mid-chain house ranks by its own count', () => {
  const rows = buildTopRootHomes(rankingFixture());
  assert.equal(rows[0].customerId, 'A');
  assert.equal(rows[0].downstreamCount, 6);
  const bravo = rows.find((r) => r.customerId === 'B');
  assert.equal(bravo.downstreamCount, 3);
  assert.ok(rows.indexOf(bravo) > 0, 'the 3-downstream root ranks below the 6-downstream root');
  // a2 is mid-chain (it has an upstream) and ranks by its own 4.
  const mid = rows.find((r) => r.customerId === 'a2');
  assert.equal(mid.downstreamCount, 4);
  assert.equal(rows.indexOf(mid), 2);
  // Recorded fields ride along exactly as stored.
  assert.equal(rows[0].name, 'Root Alpha');
  assert.equal(rows[0].customerNumber, 10);
  assert.equal(rows[0].mohalla, 'Alpha Mohalla');
  assert.equal(rows[0].phone, '0300-0000010');
  assert.equal(rows[0].splitterBoxId, 'SPL-T-01');
});

test('ranking: ties break by customerNumber ascending', () => {
  const rows = buildTopRootHomes(rankingFixture());
  const threes = rows.filter((r) => r.downstreamCount === 3);
  assert.deepEqual(threes.map((r) => r.customerNumber), [2, 5, 33]);
  const ones = rows.filter((r) => r.downstreamCount === 1);
  assert.deepEqual(ones.map((r) => r.customerNumber), [8, 9]);
});

test('ranking: only 10 rows from a 12-house fixture; leaves never rank', () => {
  const rows = buildTopRootHomes(rankingFixture());
  assert.equal(rows.length, 10);
  assert.ok(!rows.some((r) => r.customerId === 'G'), '11th-ranked house is cut');
  assert.ok(!rows.some((r) => r.customerId === 'a5'), '12th-ranked house is cut');
  assert.ok(!rows.some((r) => r.customerId === 'a6'), 'a leaf (0 downstreams) never ranks');
  assert.equal(rows[9].customerId, 'F');
  // A smaller limit is honoured.
  assert.equal(buildTopRootHomes(rankingFixture(), 3).length, 3);
});

test('ranking: archived downstreams are traversed through but never counted', () => {
  const customers = [
    house('X', 1),
    house('Y', 2, { upstreamCustomerId: 'X', archived: true }),
    house('Z', 3, { upstreamCustomerId: 'Y' }),
    house('P', 4),
    house('Q', 5, { upstreamCustomerId: 'P', archived: true })
  ];
  const rows = buildTopRootHomes(customers);
  const x = rows.find((r) => r.customerId === 'X');
  assert.equal(x.downstreamCount, 1, 'only the active Z counts, not the archived Y it passes through');
  assert.ok(!rows.some((r) => r.customerId === 'P'), 'a house whose only downstream is archived ranks nobody');
  assert.deepEqual(buildTopRootHomes([]), []);
  assert.deepEqual(buildTopRootHomes(null), []);
});

test('ranking is pure: the customer list is never mutated', () => {
  const customers = rankingFixture();
  const before = JSON.stringify(customers);
  buildTopRootHomes(customers);
  buildEmergencyRunbook(customers, null);
  assert.equal(JSON.stringify(customers), before);
});

test('store: starts completely empty — no seeded names or numbers', () => {
  const empty = sanitizeEmergencyRunbook(null);
  assert.deepEqual(empty, {
    upstreamNoc: { label: '', phone: '' },
    splicer: { label: '', phone: '' },
    lesco: { label: '', phone: '' },
    shops: []
  });
  assert.equal(hasEmergencyRunbookContacts(empty), false);
  assert.deepEqual(loadEmergencyRunbook(null), empty);
  const corrupt = loadEmergencyRunbook({ getItem: () => '{not json' });
  assert.deepEqual(corrupt, empty);
});

test('store: sanitizer trims, caps and drops malformed entries', () => {
  const clean = sanitizeEmergencyRunbook({
    upstreamNoc: { label: `  ${'L'.repeat(100)}  `, phone: ` ${'9'.repeat(50)} ` },
    splicer: 'not-an-object',
    lesco: { label: 42, phone: null },
    shops: [
      { label: ' Shop One ', phone: ' 0300-1111111 ' },
      { label: '', phone: '' },
      'junk',
      { label: 'Shop Two', phone: '0300-2222222' },
      { label: 'Shop Three', phone: '0300-3333333' },
      { label: 'Shop Four', phone: '0300-4444444' },
      { label: 'Shop Five', phone: '0300-5555555' },
      { label: 'Shop Six', phone: '0300-6666666' },
      { label: 'Shop Seven', phone: '0300-7777777' }
    ]
  });
  assert.equal(clean.upstreamNoc.label.length, 80);
  assert.equal(clean.upstreamNoc.phone.length, 40);
  assert.deepEqual(clean.splicer, { label: '', phone: '' });
  assert.deepEqual(clean.lesco, { label: '', phone: '' });
  assert.equal(EMERGENCY_RUNBOOK_SHOP_CAP, 6);
  assert.equal(clean.shops.length, 6, 'shop list capped at 6, blanks and junk dropped first');
  assert.equal(clean.shops[0].label, 'Shop One');
  assert.equal(clean.shops[0].phone, '0300-1111111');
  assert.equal(clean.shops[5].label, 'Shop Six');
  assert.equal(hasEmergencyRunbookContacts(clean), true);
});

test('store: save / load round-trip through storage', () => {
  const backing = new Map();
  const fakeStorage = {
    getItem: (key) => (backing.has(key) ? backing.get(key) : null),
    setItem: (key, value) => { backing.set(key, value); }
  };
  const runbook = {
    upstreamNoc: { label: 'Provider NOC Desk', phone: '0300-1234567' },
    splicer: { label: '', phone: '0300-7654321' },
    lesco: { label: '', phone: '118' },
    shops: [{ label: 'Corner Shop', phone: '0321-9999999' }]
  };
  assert.equal(saveEmergencyRunbook(runbook, fakeStorage), true);
  assert.ok(backing.has(EMERGENCY_RUNBOOK_KEY));
  assert.deepEqual(loadEmergencyRunbook(fakeStorage), sanitizeEmergencyRunbook(runbook));
  assert.equal(saveEmergencyRunbook(runbook, { setItem: () => { throw new Error('blocked'); } }), false);
});

test('backup: contacts travel in settings.emergencyRunbook and safe-merge adopts on an empty device', () => {
  const state = createInitialState([]);
  const runbook = {
    upstreamNoc: { label: 'Provider NOC Desk', phone: '0300-1234567' },
    splicer: { label: '', phone: '' },
    lesco: { label: '', phone: '118' },
    shops: [{ label: 'Corner Shop', phone: '0321-9999999' }]
  };
  const backupJson = createJsonBackup(state, new Date('2026-10-30T00:00:00Z'), { emergencyRunbook: runbook });
  const parsed = JSON.parse(backupJson);
  assert.deepEqual(parsed.settings.emergencyRunbook, sanitizeEmergencyRunbook(runbook));

  const adopted = previewJsonBackupMerge(createInitialState([]), backupJson, {});
  assert.equal(adopted.counts.emergencyRunbookRestored, 1);
  assert.deepEqual(adopted.emergencyRunbook, sanitizeEmergencyRunbook(runbook));

  // An empty runbook writes no settings section at all.
  const emptyBackup = JSON.parse(createJsonBackup(state, new Date('2026-10-30T00:00:00Z'), { emergencyRunbook: sanitizeEmergencyRunbook(null) }));
  assert.equal(emptyBackup.settings?.emergencyRunbook, undefined);
});

test('backup: safe-merge conflict never overwrites different local contacts', () => {
  const state = createInitialState([]);
  const incoming = { upstreamNoc: { label: 'Incoming NOC', phone: '0300-1111111' }, splicer: { label: '', phone: '' }, lesco: { label: '', phone: '' }, shops: [] };
  const backupJson = createJsonBackup(state, new Date('2026-10-30T00:00:00Z'), { emergencyRunbook: incoming });

  const conflicting = previewJsonBackupMerge(createInitialState([]), backupJson, {
    currentEmergencyRunbook: { upstreamNoc: { label: 'Local NOC', phone: '0300-2222222' }, splicer: { label: '', phone: '' }, lesco: { label: '', phone: '' }, shops: [] },
    currentEmergencyRunbookStored: true
  });
  assert.equal(conflicting.emergencyRunbook, null);
  assert.equal(conflicting.conflicts.some((c) => c.field === 'Emergency runbook contacts differ from this device'), true);

  const identical = previewJsonBackupMerge(createInitialState([]), backupJson, {
    currentEmergencyRunbook: incoming,
    currentEmergencyRunbookStored: true
  });
  assert.equal(identical.emergencyRunbook, null);
  assert.equal(identical.conflicts.some((c) => c.field === 'Emergency runbook contacts differ from this device'), false);
});

const CONTACTS = {
  upstreamNoc: { label: 'Provider NOC Desk', phone: '0300-1234567' },
  splicer: { label: 'Fiber Splicer Team', phone: '0300-7654321' },
  lesco: { label: '', phone: '118' },
  shops: [{ label: 'Corner Shop Alpha', phone: '0321-5554443' }, { label: '', phone: '0321-5554444' }]
};

test('print: saved contacts print verbatim and top-10 rows print with counts', () => {
  const html = generateEmergencyRunbookPrintHtml({
    customers: rankingFixture(),
    runbook: CONTACTS,
    lang: 'en',
    generatedAt: new Date('2026-10-30T07:30:00Z')
  });
  assert.ok(html.includes('SHAHDARA FIBER NET'));
  assert.ok(html.includes('Provider NOC Desk'));
  assert.ok(html.includes('0300-1234567'));
  assert.ok(html.includes('Fiber Splicer Team'));
  assert.ok(html.includes('0300-7654321'));
  assert.ok(html.includes('LESCO / WAPDA Complaint'), 'a contact with no custom label prints under its default heading');
  assert.ok(html.includes('118'));
  assert.ok(html.includes('Corner Shop Alpha'));
  assert.ok(html.includes('0321-5554443'));
  assert.ok(html.includes('0321-5554444'));
  // Top-10 rows with counts, customer numbers and recorded fields.
  assert.ok(html.includes('Root Alpha'));
  assert.ok(html.includes('#10'));
  assert.ok(html.includes('SPL-T-01'));
  assert.ok(html.includes('0300-0000010'), "the root home's recorded phone prints on the owner's own sheet");
  assert.ok(html.includes('Mid House'));
  assert.ok(html.includes('Root Bravo'), 'the 3-downstream root also prints, below the top root');
  assert.ok(html.includes('PKT'), 'generated stamp is PKT');
  assert.ok(html.includes('Keep this sheet at the OLT'), 'footer note prints');
  assert.ok(!html.includes('runbook_'), 'no raw i18n keys on the English sheet');
});

test('print: missing contacts print "Not recorded" and nothing is invented', () => {
  const html = generateEmergencyRunbookPrintHtml({
    customers: [],
    runbook: null,
    lang: 'en',
    generatedAt: new Date('2026-10-30T07:30:00Z')
  });
  const notRecorded = html.split('Not recorded').length - 1;
  assert.ok(notRecorded >= 4, `expected at least 4 "Not recorded" cells (3 fixed + shops), got ${notRecorded}`);
  assert.ok(html.includes('No feeder root homes recorded yet'), 'empty ranking prints its empty note');
  assert.ok(!/\d{4}-\d{7}/.test(html), 'no phone-shaped number is invented anywhere on an empty sheet');

  const urdu = generateEmergencyRunbookPrintHtml({ customers: [], runbook: null, lang: 'ur', generatedAt: new Date('2026-10-30T07:30:00Z') });
  assert.ok(urdu.includes('ریکارڈ نہیں'), 'Urdu sheet prints the Urdu Not recorded');
  assert.ok(!urdu.includes('runbook_'), 'no raw i18n keys on the Urdu sheet');
});

test('print: recorded data is HTML-escaped', () => {
  const customers = [
    house('X', 1, { name: '<script>alert(1)</script>' }),
    house('Y', 2, { upstreamCustomerId: 'X' })
  ];
  const html = generateEmergencyRunbookPrintHtml({ customers, runbook: null, lang: 'en' });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('generated stamp: PKT formatting', () => {
  // 07:30 UTC is 12:30 PKT on the same day.
  assert.ok(formatRunbookGeneratedAt(new Date('2026-10-30T07:30:00Z')).includes('12:30 PKT'));
  assert.ok(formatRunbookGeneratedAt(new Date('2026-10-30T07:30:00Z')).includes('30 Oct 2026'));
});

test('i18n: every runbook_* key used by the module or markup exists in both dictionaries', () => {
  const moduleSource = readFileSync(new URL('../emergency-runbook-card.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = new Set();
  for (const m of moduleSource.matchAll(/t\('(runbook_[a-z_]+)'/g)) used.add(m[1]);
  for (const m of indexHtml.matchAll(/data-i18n="(runbook_[a-z_]+)"/g)) used.add(m[1]);
  assert.ok(used.size >= 20, `expected at least 20 runbook keys, found ${used.size}`);
  for (const key of used) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en missing ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en ${key} must not echo the raw key`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur ${key} must not echo the raw key`);
  }
});

test('wiring: Home card button, dialog markup, controller, CSS tokens and runtime graph', async () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');

  assert.ok(indexHtml.includes('id="openEmergencyRunbookBtn"'), 'Home entry-point button present');
  assert.ok(indexHtml.includes('id="emergencyRunbookDialog"'), 'dialog present');
  assert.ok(indexHtml.includes('emergency-runbook-modal'), 'dialog uses the billing-modal shell');
  assert.ok(indexHtml.includes('id="runbookSaveBtn"'), 'save action present');
  assert.ok(indexHtml.includes('id="runbookPrintBtn"'), 'print action present');
  for (let i = 1; i <= 6; i++) {
    assert.ok(indexHtml.includes(`id="runbookShopLabel${i}"`), `shop row ${i} label input present`);
    assert.ok(indexHtml.includes(`id="runbookShopPhone${i}"`), `shop row ${i} phone input present`);
  }
  assert.ok(app.includes("from './emergency-runbook-card.js'"), 'app.js imports the module (app.js-only seam)');
  assert.ok(app.includes('setupEmergencyRunbookDialog'), 'app.js wires the controller');
  assert.ok(app.includes('emergencyRunbook: loadEmergencyRunbook()'), 'backup extras carry the contacts');
  assert.ok(app.includes('saveEmergencyRunbook(pendingBackupPreview.emergencyRunbook)'), 'restore applies adopted contacts');
  assert.ok(css.includes('.runbook-preview'), 'dialog CSS present');
  assert.ok(!/\.runbook[^{]*\{[^}]*#fff/i.test(css), 'no hardcoded white in runbook dialog CSS');
  assert.ok(!/\.runbook[^{]*\{[^}]*background:\s*white/i.test(css), 'no hardcoded white background in runbook dialog CSS');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('emergency-runbook-card.js'), 'module is reachable in the build runtime graph');
});
