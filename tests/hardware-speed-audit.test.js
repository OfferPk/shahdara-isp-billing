/**
 * hardware-speed-audit.test.js — SISP-69: Package Speed vs Optical RX
 * (dBm) Bottleneck Auditor.
 *
 * FLAG RULE (pinned here): an ACTIVE, non-archived customer is flagged
 * "Hardware / Optical Bottleneck Suspected" iff BOTH hold:
 *   (a) catalogue-provable package speed >= 15 Mbps (BILL_PACKAGES
 *       match only — never a speed parsed from a free-text label), AND
 *   (b) a recorded SISP-24 lastRxDbm strictly below -26.0 dBm (the
 *       splitter-map weak-signal line; exactly -26.0 is healthy; no
 *       recorded reading is never flagged).
 * Slow-speed complaints (c) are corroborating evidence only: counted
 * with the SISP-59 matcher, shown on the row, used for sort priority —
 * they never add or remove a flag.
 *
 * Pins (synthetic data only):
 *  - SPEC PIN: a customer on a 15 Mbps package with -27.5 dBm RX is
 *    listed in the audit panel.
 *  - Read-only: building suspects mutates nothing.
 *  - i18n: every hwaudit_* / prof_hwaudit_* key exists in en + ur and
 *    every such key used via t() in app.js / profile-ui.js is defined;
 *    wiring: dashboard section, app.js render, profile hint, styles.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BOTTLENECK_MIN_SPEED_MBPS, BOTTLENECK_RECURRING_COMPLAINTS, BOTTLENECK_WEAK_RX_DBM,
  buildBottleneckSuspects, buildBottleneckSummary, bottleneckForCustomer
} from '../hardware-speed-audit.js';
import { WEAK_RX_DBM_THRESHOLD } from '../splitter-map.js';
import { TRANSLATIONS } from '../nav-language.js';

function customer(overrides = {}) {
  return {
    id: 'c1', customerNumber: 1, name: 'Test Customer', phone: '03001234567',
    mohalla: 'BARRIAN', serviceStatus: 'active', archived: false,
    isFreeConnection: false, packageSpeed: '15Mbps Unlimited',
    monthlySellingAmount: 3000, monthlyPriceSchedule: [],
    splitterBoxId: 'SPL-Barrian-02', splitterPort: 3, oltPonPort: 'PON 1/2/3',
    lastRxDbm: -27.5,
    bills: [], incidents: [], ...overrides
  };
}
function speedTicket(id, customerId, extra = {}) {
  return { id, customerId, faultPreset: 'Slow Speed / High Attenuation', customFault: '', note: '', status: 'Resolved', ...extra };
}
function registerComplaint(id, customerId, extra = {}) {
  return { id, customerId, issueCategory: 'Internet Down', resolutionNote: 'customer says speed is very slow at night', ...extra };
}

test('spec pin: 15 Mbps package with -27.5 dBm RX is listed in the audit panel', () => {
  const state = { customers: [customer()] };
  const suspects = buildBottleneckSuspects(state);
  assert.equal(suspects.length, 1);
  const row = suspects[0];
  assert.equal(row.customerId, 'c1');
  assert.equal(row.speedMbps, 15);
  assert.equal(row.packageLabel, '15Mbps Unlimited');
  assert.equal(row.lastRxDbm, -27.5);
  assert.equal(row.splitterBoxId, 'SPL-Barrian-02');
  assert.equal(row.splitterPort, 3);
  assert.equal(row.slowSpeedComplaints, 0);
  assert.equal(row.recurringComplaints, false);
});

test('constants: thresholds come from the shipped sources of truth', () => {
  assert.equal(BOTTLENECK_MIN_SPEED_MBPS, 15);
  assert.equal(BOTTLENECK_WEAK_RX_DBM, -26.0);
  assert.equal(BOTTLENECK_WEAK_RX_DBM, WEAK_RX_DBM_THRESHOLD);
  assert.equal(BOTTLENECK_RECURRING_COMPLAINTS, 2);
});

test('flag rule (b): RX must be strictly below -26.0 dBm', () => {
  const at = { customers: [customer({ lastRxDbm: -26.0 })] };
  assert.equal(buildBottleneckSuspects(at).length, 0, 'exactly -26.0 is healthy (SISP-24 rule)');
  const above = { customers: [customer({ lastRxDbm: -25.9 })] };
  assert.equal(buildBottleneckSuspects(above).length, 0);
  const below = { customers: [customer({ lastRxDbm: -26.1 })] };
  assert.equal(buildBottleneckSuspects(below).length, 1);
});

test('flag rule (b): no recorded RX reading is never flagged', () => {
  for (const lastRxDbm of [null, '', undefined]) {
    const state = { customers: [customer({ lastRxDbm })] };
    assert.equal(buildBottleneckSuspects(state).length, 0, `lastRxDbm=${String(lastRxDbm)}`);
  }
  const missing = customer();
  delete missing.lastRxDbm;
  assert.equal(buildBottleneckSuspects({ customers: [missing] }).length, 0);
});

test('flag rule (a): slower catalogue packages are never flagged, however weak the RX', () => {
  const state = { customers: [customer({ packageSpeed: '5Mbps / 500GB', monthlySellingAmount: 2500, lastRxDbm: -34 })] };
  assert.equal(buildBottleneckSuspects(state).length, 0);
});

test('flag rule (a): a free-text label is never parsed for a speed', () => {
  const state = { customers: [customer({ packageSpeed: '15 Mbps Home Fiber Special', lastRxDbm: -31 })] };
  assert.equal(buildBottleneckSuspects(state).length, 0, 'no catalogue match -> no provable speed -> no flag');
});

test('flag rule: archived and non-active customers are excluded', () => {
  assert.equal(buildBottleneckSuspects({ customers: [customer({ archived: true })] }).length, 0);
  assert.equal(buildBottleneckSuspects({ customers: [customer({ serviceStatus: 'offline' })] }).length, 0);
  assert.equal(buildBottleneckSuspects({ customers: [customer({ serviceStatus: 'not-set' })] }).length, 0);
});

test('flag rule (c): complaints corroborate but never gate — zero complaints still flags', () => {
  const state = { customers: [customer()] };
  const suspects = buildBottleneckSuspects(state, { complaints: [], tickets: [] });
  assert.equal(suspects.length, 1);
  assert.equal(suspects[0].slowSpeedComplaints, 0);
});

test('complaint evidence: SISP-59 matcher counts register, ticket and incident sources', () => {
  const state = {
    customers: [customer({
      incidents: [{ note: 'اسپیڈ بہت سست ہے' }, { note: 'router replaced' }]
    })]
  };
  const complaints = [registerComplaint('CMP-1', 'c1'), registerComplaint('CMP-2', 'other-customer')];
  const tickets = [speedTicket('TKT-101', 'c1'), speedTicket('TKT-102', 'c1', { faultPreset: 'Fiber Cut', note: 'cable replaced' })];
  const suspects = buildBottleneckSuspects(state, { complaints, tickets });
  assert.equal(suspects.length, 1);
  const row = suspects[0];
  assert.equal(row.complaintBreakdown.register, 1);
  assert.equal(row.complaintBreakdown.tickets, 1);
  assert.equal(row.complaintBreakdown.incidents, 1);
  assert.equal(row.slowSpeedComplaints, 3);
  assert.equal(row.recurringComplaints, true, '>= 2 slow-speed complaints reads as recurring');
});

test('sort: weakest RX first, then most complaints, then lowest customer number', () => {
  const state = {
    customers: [
      customer({ id: 'a', customerNumber: 5, lastRxDbm: -28 }),
      customer({ id: 'b', customerNumber: 9, lastRxDbm: -31 }),
      customer({ id: 'c', customerNumber: 2, lastRxDbm: -31 }),
      customer({ id: 'd', customerNumber: 1, lastRxDbm: -31 })
    ]
  };
  const tickets = [speedTicket('TKT-1', 'c'), speedTicket('TKT-2', 'c')];
  const suspects = buildBottleneckSuspects(state, { tickets });
  assert.deepEqual(suspects.map((row) => row.customerId), ['c', 'd', 'b', 'a']);
});

test('summary: counts, recurring count and weakest RX', () => {
  const state = {
    customers: [
      customer({ id: 'a', customerNumber: 1, lastRxDbm: -28 }),
      customer({ id: 'b', customerNumber: 2, lastRxDbm: -33.5 })
    ]
  };
  const tickets = [speedTicket('TKT-1', 'b'), speedTicket('TKT-2', 'b')];
  const summary = buildBottleneckSummary(buildBottleneckSuspects(state, { tickets }));
  assert.deepEqual(summary, { count: 2, recurringCount: 1, weakestRxDbm: -33.5 });
  assert.deepEqual(buildBottleneckSummary([]), { count: 0, recurringCount: 0, weakestRxDbm: null });
});

test('bottleneckForCustomer mirrors the panel verdict for one customer', () => {
  const flagged = customer();
  assert.equal(bottleneckForCustomer(flagged)?.customerId, 'c1');
  assert.equal(bottleneckForCustomer(customer({ lastRxDbm: -20 })), null);
  assert.equal(bottleneckForCustomer(null), null);
});

test('read-only: building suspects mutates nothing', () => {
  const state = { customers: [customer({ incidents: [{ note: 'slow speed again' }] })] };
  const complaints = [registerComplaint('CMP-1', 'c1')];
  const tickets = [speedTicket('TKT-101', 'c1')];
  const before = JSON.stringify({ state, complaints, tickets });
  buildBottleneckSuspects(state, { complaints, tickets });
  bottleneckForCustomer(state.customers[0], { complaints, tickets });
  assert.equal(JSON.stringify({ state, complaints, tickets }), before);
});

test('robustness: malformed inputs yield no suspects, never a throw', () => {
  assert.deepEqual(buildBottleneckSuspects(null), []);
  assert.deepEqual(buildBottleneckSuspects({}), []);
  assert.deepEqual(buildBottleneckSuspects({ customers: [null, 42, {}] }), []);
  assert.deepEqual(buildBottleneckSuspects({ customers: [customer()] }, { complaints: 'x', tickets: 7 }), [
    buildBottleneckSuspects({ customers: [customer()] })[0]
  ]);
});

const HW_KEYS = [
  'hwaudit_title', 'hwaudit_sub', 'hwaudit_empty', 'hwaudit_count',
  'hwaudit_line', 'hwaudit_box', 'hwaudit_complaints', 'hwaudit_no_complaints',
  'prof_hwaudit_heading', 'prof_hwaudit_text'
];

test('i18n: every hwaudit key exists in both dictionaries', () => {
  for (const lang of ['en', 'ur']) {
    for (const key of HW_KEYS) {
      assert.equal(typeof TRANSLATIONS[lang][key], 'string', `${lang}:${key}`);
      assert.notEqual(TRANSLATIONS[lang][key], key);
      assert.ok(TRANSLATIONS[lang][key].length > 0, `${lang}:${key} empty`);
    }
  }
});

test('i18n audit: every hwaudit key used via t() in app.js / profile-ui.js is defined', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const profileUi = readFileSync(new URL('../profile-ui.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const source of [app, profileUi]) {
    for (const match of source.matchAll(/t\('((?:prof_)?hwaudit_[a-z_]+)'/g)) used.add(match[1]);
  }
  assert.ok(used.size >= 8, `expected the wiring to use the hwaudit keys, got ${used.size}`);
  for (const key of used) {
    assert.ok(HW_KEYS.includes(key), `unexpected key ${key}`);
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en:${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur:${key}`);
  }
});

test('wiring: dashboard panel, app render, profile hint and token-only styles', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="hwauditList"'), 'dashboard panel list');
  assert.ok(html.includes('data-i18n="hwaudit_title"'), 'panel title i18n');
  assert.ok(html.includes('data-i18n="hwaudit_sub"'), 'panel sub i18n');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './hardware-speed-audit.js'"), 'app imports the audit module');
  assert.ok(app.includes('buildBottleneckSuspects(state'), 'dashboard render call');
  assert.ok(app.includes('bottleneckProfileHintHtml'), 'profile hint wired');
  const profileUi = readFileSync(new URL('../profile-ui.js', import.meta.url), 'utf8');
  assert.ok(profileUi.includes('export function bottleneckProfileHintHtml'), 'profile hint helper exported');
  const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('.hwaudit-section'), css.indexOf('/* Owner feature 2026-10-29: Dashboard Advance Held'));
  assert.ok(block.includes('.hwaudit-card'), 'panel styles present');
  assert.ok(block.includes('var(--surface)'), 'token surface');
  assert.ok(block.includes('var(--color-overdue)'), 'token danger colour');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hardcoded hex colours in the hwaudit styles');
});
