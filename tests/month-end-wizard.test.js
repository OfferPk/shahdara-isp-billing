/**
 * SISP-130 — 4-Step Month-End Pre-Flight Closing Wizard.
 * Every gate must mirror its owning engine exactly: shop unsettled from
 * buildShopSummaries, overhead postings from overheadPostingFor, partner
 * figures from buildPartnerSettlementReport, backup verdict from the
 * backup-health record's lastExportAt. Synthetic data only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildMonthEndPreflight,
  closingMonthFor,
  monthEndWizardStepsHtml,
  monthLastDayKey,
  pktDateKeyOfInstant,
  previousMonthKey
} from '../month-end-wizard.js';
import { buildPartnerSettlementReport } from '../partner-settlement.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-11-03T10:00:00.000Z'); // 15:00 PKT, 3 Nov 2026
const MONTH = '2026-10';

const shopState = (payments) => ({
  customers: [{
    id: 'cust-1', customerNumber: 1, name: 'Test Customer',
    bills: [{ month: MONTH, dueAmount: 3000, payments }]
  }],
  expenses: []
});
const emptyState = () => ({ customers: [], expenses: [] });

function gate(report, id) {
  return report.steps.find((step) => step.id === id);
}

/** Inputs for a fully-passing wizard over MONTH. */
function allPassInputs() {
  return {
    state: {
      customers: [{
        id: 'cust-1', customerNumber: 1, name: 'Test Customer',
        bills: [{ month: MONTH, dueAmount: 3000, payments: [
          { id: 'pay-1', date: '2026-10-05', amount: 3000, method: 'Cash at Test Mart shop', shopSettled: true }
        ] }]
      }],
      expenses: [{ id: 'exp-oh1', date: '2026-10-05', category: 'Nayatel bill', amount: 35000 }]
    },
    settlements: [],
    overheads: {
      templates: [{ id: 'upstream-bandwidth', defaultAmount: 35000 }],
      postings: [{ id: 'oh1', templateId: 'upstream-bandwidth', month: MONTH, expenseId: 'exp-oh1', amount: 35000, date: '2026-10-05', note: '' }]
    },
    partnerEntries: [],
    partnerSettlements: [],
    backupRecord: { lastExportAt: '2026-11-01T06:00:00.000Z', paymentCountAtExport: 1 },
    month: MONTH,
    referenceDate: REF
  };
}

// ------------------------------------------------------------------ months

test('closing month is the last completed PKT month (cycle month logic)', () => {
  assert.equal(closingMonthFor(new Date('2026-11-03T10:00:00.000Z')), '2026-10');
  assert.equal(closingMonthFor(new Date('2026-11-01T00:30:00.000Z')), '2026-10'); // 05:30 PKT Nov 1
  assert.equal(closingMonthFor(new Date('2027-01-15T10:00:00.000Z')), '2026-12');
  assert.equal(previousMonthKey('2026-01'), '2025-12');
  assert.equal(previousMonthKey('nonsense'), '');
  assert.equal(monthLastDayKey('2026-10'), '2026-10-31');
  assert.equal(monthLastDayKey('2026-02'), '2026-02-28');
});

test('PKT date of an export instant honours the Karachi boundary', () => {
  assert.equal(pktDateKeyOfInstant('2026-10-31T18:30:00.000Z'), '2026-10-31'); // 23:30 PKT
  assert.equal(pktDateKeyOfInstant('2026-10-31T19:30:00.000Z'), '2026-11-01'); // 00:30 PKT next day
  assert.equal(pktDateKeyOfInstant('not-a-date'), null);
  assert.equal(pktDateKeyOfInstant(null), null);
});

// ------------------------------------------------------------- gate 1: shops

test('gate 1 passes when every shop payment is settled (incl. SISP-68 pickup stamp)', () => {
  const report = buildMonthEndPreflight({
    state: shopState([
      { id: 'p1', date: '2026-10-05', amount: 2500, method: 'Cash at Test Mart shop', shopSettledAmount: 2500 }
    ]),
    settlements: [], month: MONTH, referenceDate: REF
  });
  const shops = gate(report, 'shops');
  assert.equal(shops.status, 'pass');
  assert.equal(shops.totalUnsettled, 0);
  assert.equal(shops.shopCount, 1);
});

test('gate 1 passes on an empty ledger', () => {
  const report = buildMonthEndPreflight({ state: emptyState(), settlements: [], month: MONTH, referenceDate: REF });
  assert.equal(gate(report, 'shops').status, 'pass');
});

test('gate 1 warns per shop with amounts, highest unsettled first', () => {
  const report = buildMonthEndPreflight({
    state: {
      customers: [{
        id: 'cust-1', customerNumber: 1, name: 'Test Customer',
        bills: [{ month: MONTH, dueAmount: 20500, payments: [
          { id: 'p1', date: '2026-10-05', amount: 2500, method: 'Cash at Waseem Abbasi Shop' },
          { id: 'p2', date: '2026-10-06', amount: 18000, method: 'Cash at Hassan Shop' },
          { id: 'p3', date: '2026-10-07', amount: 9000, method: 'Cash' }
        ] }]
      }],
      expenses: []
    },
    settlements: [], month: MONTH, referenceDate: REF
  });
  const shops = gate(report, 'shops');
  assert.equal(shops.status, 'warn');
  assert.equal(shops.totalUnsettled, 20500);
  assert.deepEqual(shops.unsettledShops.map((row) => [row.shop, row.unsettled]), [
    ['Hassan Balla Shop', 18000],
    ['Waseem Abbasi Shop', 2500]
  ]);
});

// --------------------------------------------------------- gate 2: overheads

test('gate 2 passes with the explicit none-configured note when no defaults are set', () => {
  const report = buildMonthEndPreflight({
    state: emptyState(), overheads: { templates: [], postings: [] }, month: MONTH, referenceDate: REF
  });
  const overheads = gate(report, 'overheads');
  assert.equal(overheads.status, 'pass');
  assert.equal(overheads.noneConfigured, true);
  assert.equal(overheads.configuredCount, 0);
});

test('gate 2 passes when every configured overhead is posted for the month', () => {
  const report = buildMonthEndPreflight(allPassInputs());
  const overheads = gate(report, 'overheads');
  assert.equal(overheads.status, 'pass');
  assert.equal(overheads.configuredCount, 1);
  assert.equal(overheads.postedCount, 1);
});

test('gate 2 warns naming the missing configured template', () => {
  const inputs = allPassInputs();
  inputs.overheads = {
    templates: [
      { id: 'upstream-bandwidth', defaultAmount: 35000 },
      { id: 'lineman-salary', defaultAmount: 20000 }
    ],
    postings: inputs.overheads.postings
  };
  const report = buildMonthEndPreflight(inputs);
  const overheads = gate(report, 'overheads');
  assert.equal(overheads.status, 'warn');
  assert.equal(overheads.configuredCount, 2);
  assert.equal(overheads.postedCount, 1);
  assert.deepEqual(overheads.missing, [{ id: 'lineman-salary', label: 'Lineman Salary' }]);
});

test('gate 2 treats a posting whose expense was deleted as missing (stale)', () => {
  const inputs = allPassInputs();
  inputs.state = { ...inputs.state, expenses: [] }; // expense gone → posting is stale
  const report = buildMonthEndPreflight(inputs);
  const overheads = gate(report, 'overheads');
  assert.equal(overheads.status, 'warn');
  assert.deepEqual(overheads.missing.map((row) => row.id), ['upstream-bandwidth']);
});

test('gate 2 ignores unconfigured built-in templates (no eternal warning)', () => {
  const inputs = allPassInputs();
  inputs.overheads = { templates: [], postings: inputs.overheads.postings };
  // upstream template not configured with a default here → nothing expected
  inputs.overheads.templates = [{ id: 'olt-wapda', defaultAmount: 5000 }];
  const report = buildMonthEndPreflight(inputs);
  const overheads = gate(report, 'overheads');
  assert.equal(overheads.configuredCount, 1);
  assert.deepEqual(overheads.missing.map((row) => row.id), ['olt-wapda']);
});

// ---------------------------------------------------------- gate 3: partners

const partnerState = () => ({
  customers: [{
    id: 'cust-1', customerNumber: 1, name: 'Test Customer',
    bills: [{ month: MONTH, dueAmount: 3000, payments: [
      { id: 'pay-1', date: '2026-10-05', amount: 3000, method: 'Cash' }
    ] }]
  }],
  expenses: [{ id: 'exp-1', date: '2026-10-10', category: 'Other expenses', amount: 1000 }]
});
const partnerEntries = [
  { id: 'pe-1', partner: 'Nasir', type: 'drawing', amount: 500, date: '2026-10-12', note: '', createdAt: '' }
];

test('gate 3 snapshot figures equal the settlement engine output verbatim', () => {
  const state = partnerState();
  const report = buildMonthEndPreflight({ state, partnerEntries, month: MONTH, referenceDate: REF });
  const partners = gate(report, 'partners');
  const engine = buildPartnerSettlementReport(state, MONTH, partnerEntries, REF);
  assert.equal(partners.status, 'pass');
  assert.equal(partners.revenue, engine.revenue);
  assert.equal(partners.expenses, engine.expenses);
  assert.equal(partners.profit, engine.profit);
  assert.equal(partners.share, engine.share);
  assert.deepEqual(partners.perPartner, engine.perPartner.map((row) => ({
    partner: row.partner, share: row.share, drawings: row.drawings,
    capital: row.capital, netPayout: row.netPayout, isReceivable: row.isReceivable
  })));
  // Concrete fixture: 3,000 revenue − 1,000 expenses = 2,000 profit → 1,000 share each.
  assert.equal(partners.profit, 2000);
  assert.equal(partners.share, 1000);
  const nasir = partners.perPartner.find((row) => row.partner === 'Nasir');
  assert.equal(nasir.drawings, 500);
  assert.equal(nasir.netPayout, 500);
  assert.equal(partners.slipExists, false);
});

test('gate 3 notes an already-saved settlement slip for the month', () => {
  const slip = {
    id: 'partner-settle-2026-10', month: MONTH, status: 'confirmed',
    confirmedAt: '2026-11-01T05:00:00.000Z',
    perPartner: [
      { partner: 'Nasir', share: 1000, drawings: 500, capital: 0, netPayout: 500 },
      { partner: 'Aqib', share: 1000, drawings: 0, capital: 0, netPayout: 1000 }
    ]
  };
  const report = buildMonthEndPreflight({
    state: partnerState(), partnerEntries, partnerSettlements: [slip], month: MONTH, referenceDate: REF
  });
  const partners = gate(report, 'partners');
  assert.equal(partners.slipExists, true);
  assert.equal(partners.slipConfirmedAt, '2026-11-01T05:00:00.000Z');
});

test('gate 3 still passes on a loss month with zero shares', () => {
  const state = partnerState();
  state.expenses = [{ id: 'exp-1', date: '2026-10-10', category: 'Other expenses', amount: 5000 }];
  const report = buildMonthEndPreflight({ state, partnerEntries: [], month: MONTH, referenceDate: REF });
  const partners = gate(report, 'partners');
  assert.equal(partners.status, 'pass');
  assert.equal(partners.isLoss, true);
  assert.equal(partners.share, 0);
});

// ------------------------------------------------------------ gate 4: backup

test('gate 4 warns "never" when no backup record exists', () => {
  for (const backupRecord of [null, {}, { lastExportAt: null }, { lastExportAt: 'garbage' }]) {
    const report = buildMonthEndPreflight({ state: emptyState(), backupRecord, month: MONTH, referenceDate: REF });
    const backup = gate(report, 'backup');
    assert.equal(backup.status, 'warn');
    assert.equal(backup.reason, 'never');
  }
});

test('gate 4 passes only when the export landed after the closing month ended', () => {
  const report = buildMonthEndPreflight({
    state: emptyState(),
    backupRecord: { lastExportAt: '2026-10-31T20:00:00.000Z' }, // 01:00 PKT on Nov 1
    month: MONTH, referenceDate: REF
  });
  const backup = gate(report, 'backup');
  assert.equal(backup.status, 'pass');
  assert.equal(backup.exportDate, '2026-11-01');
});

test('gate 4 warns when the last export was during the closing month', () => {
  const report = buildMonthEndPreflight({
    state: emptyState(),
    backupRecord: { lastExportAt: '2026-10-15T10:00:00.000Z' },
    month: MONTH, referenceDate: REF
  });
  const backup = gate(report, 'backup');
  assert.equal(backup.status, 'warn');
  assert.equal(backup.reason, 'during-month');
  assert.equal(backup.exportDate, '2026-10-15');
});

test('gate 4 warns stale when the last export predates the closing month', () => {
  const report = buildMonthEndPreflight({
    state: emptyState(),
    backupRecord: { lastExportAt: '2026-09-20T10:00:00.000Z' },
    month: MONTH, referenceDate: REF
  });
  const backup = gate(report, 'backup');
  assert.equal(backup.status, 'warn');
  assert.equal(backup.reason, 'stale');
});

// ------------------------------------------------------------ whole report

test('all-pass report: allPass true, warnCount 0, and inputs never mutated', () => {
  const inputs = allPassInputs();
  const snapshot = JSON.stringify(inputs.state) + JSON.stringify(inputs.overheads);
  const report = buildMonthEndPreflight(inputs);
  assert.equal(report.month, MONTH);
  assert.equal(report.allPass, true);
  assert.equal(report.warnCount, 0);
  assert.equal(JSON.stringify(inputs.state) + JSON.stringify(inputs.overheads), snapshot);
});

test('mixed report counts warnings across gates', () => {
  const report = buildMonthEndPreflight({
    state: shopState([{ id: 'p1', date: '2026-10-05', amount: 1000, method: 'Cash at Test Mart shop' }]),
    settlements: [], overheads: { templates: [], postings: [] },
    backupRecord: null, month: MONTH, referenceDate: REF
  });
  // shops warn + backup warn; overheads none-configured pass; partners pass.
  assert.equal(report.allPass, false);
  assert.equal(report.warnCount, 2);
});

// ------------------------------------------------------------------- render

test('steps HTML shows warn details + jump actions, and no raw i18n keys', () => {
  const report = buildMonthEndPreflight({
    state: shopState([{ id: 'p1', date: '2026-10-05', amount: 18000, method: 'Cash at Test Mart shop' }]),
    settlements: [], month: MONTH, referenceDate: REF
  });
  const html = monthEndWizardStepsHtml(report);
  assert.ok(html.includes('Test Mart Shop'));
  assert.ok(html.includes('18,000'));
  assert.ok(html.includes('data-mew-action="shops"'));
  assert.ok(html.includes('data-mew-action="backup"'));
  assert.ok(!/mew_[a-z_]+/.test(html), 'raw i18n key leaked into HTML');
});

test('steps HTML for an all-pass report renders no jump actions', () => {
  const html = monthEndWizardStepsHtml(buildMonthEndPreflight(allPassInputs()));
  assert.ok(!html.includes('data-mew-action'));
  assert.ok(!/mew_[a-z_]+/.test(html));
});

// --------------------------------------------------------------------- i18n

test('every t() key used by the wizard exists in en + ur and never renders raw', async () => {
  const source = readFileSync(new URL('../month-end-wizard.js', import.meta.url), 'utf8');
  const keys = [...new Set([...source.matchAll(/\bt\('([a-z0-9_]+)'/g)].map((m) => m[1]))];
  assert.ok(keys.length >= 25, `expected many keys, got ${keys.length}`);
  const { t } = await import('../nav-language.js');
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.notEqual(t(key, 'en'), key, `en renders raw ${key}`);
    assert.notEqual(t(key, 'ur'), key, `ur renders raw ${key}`);
  }
  assert.equal(typeof TRANSLATIONS.en.dash_btn_month_end, 'string');
  assert.equal(typeof TRANSLATIONS.ur.dash_btn_month_end, 'string');
  // Placeholder parity between languages for the parameterised keys.
  for (const key of keys) {
    const enParams = [...TRANSLATIONS.en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const urParams = [...TRANSLATIONS.ur[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(urParams, enParams, `placeholder mismatch for ${key}`);
  }
});

// ------------------------------------------------------------------- wiring

test('wiring: app.js imports the wizard, index.html carries dialog + button, CSS is hex-free', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSource.includes("from './month-end-wizard.js'"));
  assert.ok(appSource.includes('setupMonthEndWizard'));
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['monthEndWizardModal', 'monthEndWizardBody', 'monthEndWizardMonth', 'monthEndWizardProceedBtn', 'monthEndWizardCloseBtn', 'openMonthEndWizardBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* SISP-130');
  assert.ok(start >= 0, 'SISP-130 CSS block missing');
  const block = css.slice(start, css.indexOf('@media (max-width: 480px)', start));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'hex colour in wizard CSS');
  assert.ok(block.includes('var(--modal-surface)'));
});
