/**
 * morning-briefing.test.js — SISP-145: Morning Operational Briefing Card.
 *
 * Pins the pure aggregator against synthetic fixtures only:
 *  - waadas expiring today (2 today count; tomorrow's, settled and
 *    archived promises do not),
 *  - open complaints (3 open of 5) + pending installs (2),
 *  - unsettled shop cash derived from recorded payments (5,000 + 2,500 =
 *    7,500; voided + settled shop cash excluded),
 *  - backup health states never / safe / due / critical reusing the
 *    SISP-10 assessBackupHealth thresholds,
 *  - the bilingual WhatsApp text (both blocks, same figures, no raw i18n
 *    keys, no phone numbers anywhere),
 *  - read-only: building + rendering + text mutate nothing,
 *  - mechanical i18n audit of every brief_* t() call and data-i18n key.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildMorningBriefing,
  buildMorningBriefingText,
  renderMorningBriefing,
  morningBriefingBackupLabel
} from '../morning-briefing.js';
import { countAllPayments } from '../backup-health.js';
import { TRANSLATIONS } from '../nav-language.js';

const TODAY = '2026-10-30';
const NOW = new Date('2026-10-30T03:00:00.000Z'); // 08:00 PKT

function fixtureState() {
  return {
    customers: [
      {
        id: 'c1', customerNumber: 101, name: 'Test Waada One', phone: '0300-9999999',
        promiseDate: TODAY, promiseAmount: 1500,
        bills: [{ id: 'b1', month: '2026-10', dueAmount: 3000, payments: [] }]
      },
      {
        id: 'c2', customerNumber: 102, name: 'Test Waada Two', phone: '0300-8888888',
        promiseDate: TODAY, promiseAmount: null,
        bills: [{
          id: 'b2', month: '2026-10', dueAmount: 2000,
          payments: [{ id: 'p2', date: '2026-10-05', amount: 500, method: 'Cash' }]
        }]
      },
      {
        id: 'c3', customerNumber: 103, name: 'Test Waada Tomorrow',
        promiseDate: '2026-10-31', promiseAmount: 2000,
        bills: [{ id: 'b3', month: '2026-10', dueAmount: 2000, payments: [] }]
      },
      {
        id: 'c4', customerNumber: 104, name: 'Test Waada Settled',
        promiseDate: TODAY, promiseAmount: 1000,
        bills: [{
          id: 'b4', month: '2026-10', dueAmount: 1000,
          payments: [{ id: 'p4', date: '2026-10-06', amount: 1000, method: 'Cash' }]
        }]
      },
      {
        id: 'c5', customerNumber: 105, name: 'Test Waada Archived', archived: true,
        promiseDate: TODAY, promiseAmount: 1000,
        bills: [{ id: 'b5', month: '2026-10', dueAmount: 1000, payments: [] }]
      },
      {
        id: 'c6', customerNumber: 106, name: 'Test Shop Alpha',
        bills: [{
          id: 'b6', month: '2026-10', dueAmount: 6000,
          payments: [
            { id: 'p6a', date: '2026-10-10', amount: 5000, method: 'Cash at Alpha shop' },
            { id: 'p6b', date: '2026-10-11', amount: 1000, method: 'Cash at Alpha shop', shopSettledAmount: 1000 },
            { id: 'p6c', date: '2026-10-12', amount: 9999, method: 'Cash at Alpha shop', voided: true }
          ]
        }]
      },
      {
        id: 'c7', customerNumber: 107, name: 'Test Shop Beta',
        bills: [{
          id: 'b7', month: '2026-10', dueAmount: 2500,
          payments: [{ id: 'p7', date: '2026-10-09', amount: 2500, method: 'Cash at Beta shop' }]
        }]
      }
    ]
  };
}

function fixtureExtras(state, backupRecord = null) {
  return {
    complaints: [
      { id: 'CMP-1', status: 'Open' },
      { id: 'CMP-2', status: 'Open' },
      { id: 'CMP-3', status: 'In Progress' },
      { id: 'CMP-4', status: 'Resolved' },
      { id: 'CMP-5', status: 'Resolved' }
    ],
    settlements: [],
    installRequests: [
      { id: 'INS-1', requestDate: '2026-10-20', installDate: '' },
      { id: 'INS-2', requestDate: '2026-10-25' },
      { id: 'INS-3', requestDate: '2026-10-01', installDate: '2026-10-03' }
    ],
    backupRecord,
    now: NOW
  };
}

test('SISP-145 aggregation: waadas expiring today — 2 of 5 promises count', () => {
  const state = fixtureState();
  const briefing = buildMorningBriefing(state, TODAY, fixtureExtras(state));
  assert.equal(briefing.dateStr, TODAY);
  assert.equal(briefing.waadas.count, 2);
  assert.deepEqual(briefing.waadas.entries.map((e) => e.customerNumber), [101, 102]);
  // Only the recorded promiseAmount (1,500) sums; the null amount adds 0.
  assert.equal(briefing.waadas.totalPromised, 1500);
  assert.equal(briefing.waadas.entries[0].promiseAmount, 1500);
  assert.equal(briefing.waadas.entries[1].promiseAmount, null);
});

test('SISP-145 aggregation: open complaints 3 + pending installs 2', () => {
  const state = fixtureState();
  const briefing = buildMorningBriefing(state, TODAY, fixtureExtras(state));
  assert.equal(briefing.work.openComplaints, 2);
  assert.equal(briefing.work.inProgressComplaints, 1);
  assert.equal(briefing.work.openTotal, 3);
  assert.equal(briefing.work.pendingInstalls, 2);
});

test('SISP-145 aggregation: unsettled shop cash 5,000 + 2,500 = 7,500, shops derived', () => {
  const state = fixtureState();
  const briefing = buildMorningBriefing(state, TODAY, fixtureExtras(state));
  assert.equal(briefing.shops.totalUnsettled, 7500);
  assert.deepEqual(briefing.shops.lines, [
    { shop: 'Alpha Shop', unsettled: 5000 },
    { shop: 'Beta Shop', unsettled: 2500 }
  ]);
});

test('SISP-145 backup health: never backed up', () => {
  const state = fixtureState();
  const briefing = buildMorningBriefing(state, TODAY, fixtureExtras(state, null));
  assert.equal(briefing.backup.stateKey, 'never');
  assert.equal(briefing.backup.status, 'critical');
  assert.equal(briefing.backup.lastExportAt, null);
});

test('SISP-145 backup health: safe under 24h with no new payments', () => {
  const state = fixtureState();
  const record = { lastExportAt: '2026-10-30T01:00:00.000Z', paymentCountAtExport: countAllPayments(state) };
  const briefing = buildMorningBriefing(state, TODAY, fixtureExtras(state, record));
  assert.equal(briefing.backup.stateKey, 'safe');
  assert.equal(briefing.backup.paymentsSinceExport, 0);
});

test('SISP-145 backup health: due at 2 days old', () => {
  const state = fixtureState();
  const record = { lastExportAt: '2026-10-28T03:00:00.000Z', paymentCountAtExport: countAllPayments(state) };
  const briefing = buildMorningBriefing(state, TODAY, fixtureExtras(state, record));
  assert.equal(briefing.backup.stateKey, 'due');
});

test('SISP-145 backup health: critical when 10+ payments landed after the export', () => {
  const payments = Array.from({ length: 12 }, (_, i) => ({
    id: `pp${i}`, date: '2026-10-10', amount: 100, method: 'Cash'
  }));
  const state = {
    customers: [{
      id: 'cx', customerNumber: 201, name: 'Test Many Payments',
      bills: [{ id: 'bx', month: '2026-10', dueAmount: 1200, payments }]
    }]
  };
  assert.equal(countAllPayments(state), 12);
  const record = { lastExportAt: '2026-10-30T01:00:00.000Z', paymentCountAtExport: 2 };
  const briefing = buildMorningBriefing(state, TODAY, fixtureExtras(state, record));
  assert.equal(briefing.backup.paymentsSinceExport, 10);
  assert.equal(briefing.backup.stateKey, 'critical');
});

test('SISP-145 bilingual text: both blocks, matching figures, shop lines, no phones, no raw keys', () => {
  const state = fixtureState();
  const briefing = buildMorningBriefing(state, TODAY, fixtureExtras(state));
  const text = buildMorningBriefingText(briefing);
  // Both language blocks present.
  assert.match(text, /Morning Briefing — 2026-10-30/);
  assert.match(text, /صبح کی بریفنگ — 2026-10-30/);
  // Figures identical in both blocks.
  assert.equal(text.split('PKR 7,500').length - 1, 2);
  assert.equal(text.split('Alpha Shop').length - 1, 2);
  assert.equal(text.split('Beta Shop').length - 1, 2);
  assert.equal(text.split('PKR 5,000').length - 1, 2);
  assert.equal(text.split('PKR 2,500').length - 1, 2);
  // Waada line in both blocks: the English block carries the Roman name,
  // the Urdu block the transliterated Urdu name (displayCustomerName /
  // SISP-26 behaviour) — the connection number and amount match in both.
  assert.equal(text.split('#101').length - 1, 2);
  assert.equal(text.split('Test Waada One').length - 1, 1);
  assert.equal(text.split('PKR 1,500').length - 1, 2);
  // Complaints/installs line.
  assert.match(text, /Open complaints:\* 3/);
  assert.match(text, /Pending installs:\* 2/);
  // NEVER a phone number, never a raw i18n key.
  assert.ok(!text.includes('0300-9999999'), 'no customer phone in text');
  assert.ok(!text.includes('0300-8888888'), 'no customer phone in text');
  assert.ok(!/brief_[a-z_]+/.test(text), 'no raw brief_ keys in text');
});

test('SISP-145 read-only: building, rendering and text mutate nothing', () => {
  const state = fixtureState();
  const extras = fixtureExtras(state);
  const before = JSON.stringify({ state, extras });
  const briefing = buildMorningBriefing(state, TODAY, extras);
  buildMorningBriefingText(briefing);
  const elements = new Map();
  const fakeEl = () => ({
    textContent: '',
    classList: { add() {}, remove() {} }
  });
  const doc = {
    getElementById: (id) => {
      if (id === 'morningBriefingSection') return fakeEl();
      if (!elements.has(id)) elements.set(id, fakeEl());
      return elements.get(id);
    }
  };
  assert.equal(renderMorningBriefing(doc, briefing), true);
  assert.equal(elements.get('briefWaadaValue').textContent, '2');
  assert.equal(elements.get('briefShopValue').textContent, 'PKR 7,500');
  assert.equal(elements.get('briefWorkValue').textContent, '5');
  assert.equal(JSON.stringify({ state, extras }), before);
});

test('SISP-145 backup label follows the state key in both languages', () => {
  const state = fixtureState();
  const never = buildMorningBriefing(state, TODAY, fixtureExtras(state, null));
  assert.equal(morningBriefingBackupLabel(never, 'en'), TRANSLATIONS.en.brief_backup_never);
  assert.equal(morningBriefingBackupLabel(never, 'ur'), TRANSLATIONS.ur.brief_backup_never);
});

test('SISP-145 i18n audit: every brief_* key used exists in en + ur with matching placeholders', () => {
  const sources = [
    readFileSync(new URL('../morning-briefing.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../home-today.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  ].join('\n');
  const used = new Set([...sources.matchAll(/brief_[a-z0-9_]+/g)].map((m) => m[0]));
  assert.ok(used.size >= 20, `expected 20+ brief_ keys, saw ${used.size}`);
  const placeholders = (s) => [...s.matchAll(/\{[a-zA-Z]+\}/g)].map((m) => m[0]).sort();
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ en/ur`);
  }
});

test('SISP-145 wiring: strip markup, pill routes and host extras are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['morningBriefingSection', 'copyMorningBriefingBtn', 'briefPillWaada', 'briefPillWork', 'briefPillShop', 'briefPillBackup', 'briefWaadaValue', 'briefWorkValue', 'briefShopValue', 'briefBackupValue']) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  assert.ok(html.indexOf('id="morningBriefingSection"') < html.indexOf('id="homeTodaySection"'), 'strip sits above the Home Today card');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('getBriefingExtras'), 'app.js passes briefing extras');
  assert.ok(app.includes('readBackupHealthRecord()'), 'app.js feeds the SISP-10 health record');
  assert.ok(app.includes('onBriefingNavigate'), 'app.js routes pill taps');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-145 Morning Briefing'), css.indexOf('@media (max-width: 700px)', css.indexOf('SISP-145 Morning Briefing')) + 200);
  assert.ok(block.includes('.morning-pill'), 'pill styles present');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'briefing CSS uses tokens only, no hex');
});
