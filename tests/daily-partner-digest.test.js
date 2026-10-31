/**
 * daily-partner-digest.test.js — SISP-75 [P2]: 1-Click Daily Partner
 * WhatsApp Digest.
 *
 * Spec criterion (read-latest.txt, SISP-75): "Clicking 'Copy Daily
 * Partner Digest' outputs a deterministic summary string with accurate
 * counts and PKR totals from all 5 modules."
 *
 * Pins:
 *  - the full digest string for a synthetic day that exercises all
 *    five sources at once (direct cash, two shops' unsettled cash,
 *    roznamcha petty cash + closing drawer, defaulters, complaints);
 *  - direct cash = method exactly 'Cash', dated today, voided (SISP-34)
 *    receipts excluded; yesterday's cash and wallet payments never
 *    count;
 *  - shop unsettled = payment amount minus the settled portion
 *    (shopSettledAmount), per ACTUAL shop record (Waseem from a partial
 *    settlement, Hassan untouched); a voided shop receipt creates no
 *    shop line; a shop known only from a settlement record is listed
 *    with PKR 0 unsettled;
 *  - drawer balance comes from buildRoznamchaDay: a closed yesterday
 *    anchors today's opening; a CLOSED digest day reports its frozen
 *    counted closingBalance, not the live expectedClosing;
 *  - defaulters come from the allocation engine: archived customers
 *    and FREE connections never count, a paid-up customer never counts;
 *  - complaints logged = reportedAt today, resolved = status Resolved
 *    with resolvedAt today; yesterday's pair counts neither way;
 *  - determinism: same inputs → identical string, and a Date argument
 *    at midday UTC (17:00 PKT) lands on the same PKT day;
 *  - empty / malformed inputs produce the all-zero digest, never throw;
 *  - i18n: every digest_* key exists in BOTH dictionaries with the
 *    same placeholder shape; wiring: section markup, app.js render
 *    wiring, token-only CSS, and the module is reachable in the build's
 *    runtime graph (perf budget #219 — imported only by app.js).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDailyPartnerDigest,
  summarizePartnerDigest,
  dailyPartnerDigestWhatsAppUrl,
  formatDigestDate,
  partnerDigestDateKey
} from '../daily-partner-digest.js';
import { collectRuntimeFiles } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

const DAY = '2026-10-29';

let seq = 0;
const nid = (prefix) => `${prefix}${String(++seq).padStart(4, '0')}`;
const pay = (date, amount, extra = {}) => ({ id: nid('p'), date, amount, method: 'Cash', ...extra });
const bill = (month, dueAmount, payments = []) => ({ month, dueAmount, payments });
const cust = (name, bills, extra = {}) => ({ id: nid('c'), customerNumber: seq, name, bills, ...extra });
const complaint = (extra = {}) => ({
  id: nid('CMP-'), customerId: null, customerName: '', zone: '', issueCategory: 'Other',
  reportedAt: '', resolvedAt: '', downtimeHours: null, downtimeManual: false,
  status: 'Open', resolutionNote: '', resolvedViaTicketId: '', syncReopenGuard: '', createdAt: '',
  ...extra
});

function pinState() {
  return {
    customers: [
      // Ahmed: Sep bill paid by yesterday's cash; Oct bill paid by
      // today's cash. A voided Rs 9,999 cash receipt today is history,
      // not cash — excluded from every figure.
      cust('Ahmed Raza', [
        bill('2026-09', 2000, [pay('2026-10-28', 2000)]),
        bill('2026-10', 5000, [pay(DAY, 5000), pay(DAY, 9999, { voided: true })])
      ]),
      // Bilal: Oct bill paid at Waseem's shop, Rs 1,000 of it already
      // handed over (unsettled 2,000); Sep bill fully unpaid — the one
      // remaining defaulter (Rs 6,000).
      cust('Bilal Hussain', [
        bill('2026-09', 6000, []),
        bill('2026-10', 3000, [pay(DAY, 3000, { method: 'Cash at Waseem Abbasi shop', shopSettledAmount: 1000 })])
      ]),
      // Aslam: Oct bill paid at Hassan shop, nothing handed over yet.
      cust('Chaudhry Aslam', [
        bill('2026-10', 1500, [pay('2026-10-27', 1500, { method: 'Cash at Hassan shop' })])
      ]),
      // FREE connections and archived customers never owe anything.
      cust('Free User', [bill('2026-10', 2000, [])], { isFreeConnection: true }),
      cust('Old Archived', [bill('2026-10', 4000, [])], { archived: true })
    ]
  };
}

function pinSources() {
  return {
    settlements: [],
    roznamchaDays: [
      // Yesterday closed with PKR 10,000 counted in the drawer — that
      // anchors today's opening balance.
      {
        date: '2026-10-28', closed: true, openingBalance: 0, cashIn: 10000, shopIn: 0,
        cashPayments: [], handovers: [], expectedClosing: 10000, closingBalance: 10000,
        countedCash: 10000, discrepancy: 0, outflows: []
      },
      // Today still open, one petty-cash outflow of PKR 800.
      {
        date: DAY, closed: false,
        outflows: [{ id: 'out-1', category: 'Petrol / Bike Fuel', amount: 800, lineman: 'Saad', note: '' }]
      }
    ],
    complaints: [
      complaint({ reportedAt: `${DAY}T09:15`, resolvedAt: `${DAY}T12:00`, status: 'Resolved' }),
      complaint({ reportedAt: `${DAY}T18:40`, status: 'Open' }),
      complaint({ reportedAt: '2026-10-28T10:00', resolvedAt: '2026-10-28T13:00', status: 'Resolved' })
    ]
  };
}

const PIN_DIGEST = [
  '📊 Shahdara Fiber Net — Rozana Partner Digest (29 Oct 2026)',
  '💵 Aaj ki direct cash collection: PKR 5,000',
  '🏪 Waseem Abbasi Shop: unsettled cash PKR 2,000',
  // OWNER-CASH-SHOP: the digest names the ONE unified shop.
  '🏪 Hassan Balla Shop: unsettled cash PKR 1,500',
  '🧾 Aaj ka roznamcha kharcha (petty cash): PKR 800',
  '🗄️ Drawer closing balance: PKR 14,200',
  '⚠️ Baqi defaulters: 1 (kul PKR 6,000)',
  '🛠️ Aaj ki complaints: 2 lagi, 1 hal hui'
].join('\n');

test('spec criterion: the digest string is exact for a day using all five sources', () => {
  assert.equal(buildDailyPartnerDigest(pinState(), DAY, pinSources()), PIN_DIGEST);
});

test('summary model: every figure matches its source module', () => {
  const s = summarizePartnerDigest(pinState(), DAY, pinSources());
  assert.equal(s.date, DAY);
  assert.equal(s.directCash, 5000);
  assert.equal(s.directCashCount, 1);
  assert.deepEqual(s.shops, [
    { shop: 'Waseem Abbasi Shop', unsettled: 2000, unsettledReceiptCount: 1 },
    { shop: 'Hassan Balla Shop', unsettled: 1500, unsettledReceiptCount: 1 }
  ]);
  assert.equal(s.pettyCashOut, 800);
  // Opening 10,000 (yesterday's counted closing) + 5,000 cash in − 800 out.
  assert.equal(s.drawerBalance, 14200);
  assert.equal(s.drawerClosed, false);
  assert.equal(s.defaultersCount, 1);
  assert.equal(s.defaultersTotal, 6000);
  assert.equal(s.complaintsLogged, 2);
  assert.equal(s.complaintsResolved, 1);
});

test('determinism: repeated builds and a Date argument give the identical string', () => {
  const first = buildDailyPartnerDigest(pinState(), DAY, pinSources());
  assert.equal(buildDailyPartnerDigest(pinState(), DAY, pinSources()), first);
  // Midday UTC == 17:00 PKT the same day.
  assert.equal(buildDailyPartnerDigest(pinState(), new Date(Date.UTC(2026, 9, 29, 12)), pinSources()), first);
  assert.equal(partnerDigestDateKey(DAY), DAY);
  assert.equal(formatDigestDate(DAY), '29 Oct 2026');
  assert.equal(formatDigestDate('2026-01-05'), '5 Jan 2026');
  assert.equal(formatDigestDate('not-a-date'), '');
});

test('empty and malformed inputs produce the all-zero digest, never throw', () => {
  const expected = [
    '📊 Shahdara Fiber Net — Rozana Partner Digest (29 Oct 2026)',
    '💵 Aaj ki direct cash collection: PKR 0',
    '🏪 Shops par koi unsettled cash nahi',
    '🧾 Aaj ka roznamcha kharcha (petty cash): PKR 0',
    '🗄️ Drawer closing balance: PKR 0',
    '⚠️ Baqi defaulters: 0 (kul PKR 0)',
    '🛠️ Aaj ki complaints: 0 lagi, 0 hal hui'
  ].join('\n');
  assert.equal(buildDailyPartnerDigest(null, DAY), expected);
  assert.equal(buildDailyPartnerDigest({}, DAY, {}), expected);
  assert.equal(buildDailyPartnerDigest({ customers: 'junk' }, DAY, { complaints: 'junk' }), expected);
});

test('a closed digest day reports its frozen counted closing balance', () => {
  const sources = {
    roznamchaDays: [{
      date: DAY, closed: true, openingBalance: 1000, cashIn: 2000, shopIn: 0,
      cashPayments: [], handovers: [], expectedClosing: 2900, closingBalance: 2850,
      countedCash: 2850, discrepancy: -50,
      outflows: [{ id: 'out-9', category: 'Other', amount: 100, lineman: '', note: '' }]
    }]
  };
  const s = summarizePartnerDigest({ customers: [] }, DAY, sources);
  assert.equal(s.drawerClosed, true);
  assert.equal(s.drawerBalance, 2850);
  assert.equal(s.pettyCashOut, 100);
});

test('shop lines come from actual records: voided shop cash vanishes, settlement-only shops list at PKR 0', () => {
  const state = {
    customers: [cust('Voided Shop Payer', [
      bill('2026-10', 2500, [pay(DAY, 2500, { method: 'Cash at Waseem Abbasi shop', voided: true })])
    ])]
  };
  const sources = { settlements: [{ id: 'set-1', shop: 'Balla Shop', amount: 1000, date: '2026-10-20', allocations: [] }] };
  const s = summarizePartnerDigest(state, DAY, sources);
  assert.deepEqual(s.shops, [{ shop: 'Balla Shop', unsettled: 0, unsettledReceiptCount: 0 }]);
  const text = buildDailyPartnerDigest(state, DAY, sources);
  assert.ok(text.includes('🏪 Balla Shop: unsettled cash PKR 0'));
  assert.ok(!text.includes('Waseem'), 'voided shop receipt creates no shop line');
});

test('whatsapp share url encodes the digest text', () => {
  assert.equal(dailyPartnerDigestWhatsAppUrl('a b&c'), 'https://wa.me/?text=a%20b%26c');
  assert.equal(dailyPartnerDigestWhatsAppUrl(''), 'https://wa.me/?text=');
});

test('i18n: every digest_* key exists in both dictionaries with the same shape', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('digest_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('digest_')).sort();
  assert.ok(enKeys.length >= 5, `expected the SISP-75 keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys, enKeys);
  for (const key of enKeys) {
    const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);
  }
});

test('wiring: dashboard section, app.js copy handler, token-only styles, build-graph reachability', async () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(index.includes('id="copyPartnerDigestBtn"'), 'index.html carries the copy button');
  assert.ok(index.includes('data-i18n="digest_title"'), 'section title is translated');
  assert.ok(index.includes('data-i18n="digest_copy"'), 'button label is translated');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './daily-partner-digest.js'"), 'app.js imports the digest module');
  assert.ok(app.includes('buildDailyPartnerDigest(state, pakistanToday()'), 'dashboard render wires the copy handler');

  const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-75'), css.indexOf('Owner feature 2026-10-29: Dashboard Advance Held'));
  assert.ok(block.includes('.partner-digest-card'), 'digest card styles shipped');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-75 styles use theme tokens only, no hex');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('daily-partner-digest.js'), 'digest module is in the runtime graph');
});
