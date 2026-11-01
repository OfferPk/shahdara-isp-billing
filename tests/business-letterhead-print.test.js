/**
 * business-letterhead-print.test.js — SISP-125 [P2]: Printable ISP
 * Letterhead Multi-Month Financial & Subscriber Statement.
 *
 * Spec criterion (read-latest.txt, SISP-125): "Generating a 3-month
 * letterhead statement accurately sums collections, expenses, and net
 * profit across the selected months."
 *
 * Pins:
 *  - the spec scenario exactly: a 3-month (2026-08 → 2026-10)
 *    statement whose per-month rows equal the shipped P&L engine's
 *    own figures (dashboard-pnl calculatePnlAnalytics, called fresh
 *    here per month) and whose totals are the plain sums of the rows;
 *  - voided payments: FU4 has merged — the shipped P&L engine now
 *    excludes SISP-34 voided payments itself (dashboard-pnl filters
 *    them out of income), so the statement applies NO adjustment of
 *    its own and its figures equal the engine's exactly; the row's
 *    voidedExcluded is that month's voided total, kept for audit
 *    only and never subtracted (proven in this file — subtracting
 *    it again would exclude the same money twice);
 *  - Active Subscribers are month-end counts from recorded join /
 *    archive dates only (core customerJoinMonth + archivedAt):
 *    joining in a month counts that month, the archive month itself
 *    no longer counts, undated customers are never placed and are
 *    surfaced in limits, an archived customer with no recorded
 *    archive date is counted in no month;
 *  - months with no data print as honest zero rows, never skipped;
 *  - range validation: malformed months, a reversed range and a span
 *    beyond 36 months are refused with clear errors; exactly 36
 *    months is accepted;
 *  - read-only: building + printing mutates nothing;
 *  - the A4 print document carries the SHAHDARA FIBER NET letterhead,
 *    every month row, the range totals, the basis note and signature
 *    blocks for BOTH partners (names via PARTNERS) plus prepared-by,
 *    in English and Urdu with no raw i18n keys;
 *  - i18n: every lh_* key used by the module or the dialog markup
 *    exists in BOTH dictionaries; wiring: Expenses toolbar button,
 *    dialog markup with the shared ↩ close button, app.js controller,
 *    token-only CSS, runtime graph membership.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, formatPKR } from '../core.js';
import { addExpense } from '../phase3.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import { PARTNERS } from '../partner-settlement.js';
import {
  buildLetterheadStatement,
  generateLetterheadPrintHtml,
  letterheadMonthsInRange,
  shiftLetterheadMonth,
  setupLetterheadDialog,
  LETTERHEAD_MAX_RANGE_MONTHS
} from '../business-letterhead-print.js';
import { collectRuntimeFiles } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-11-05T12:00:00Z');

function buildFixture({ withVoid = true } = {}) {
  let state = createInitialState([]);
  const exp = (fields) => { state = addExpense(state, fields, REF); };
  exp({ date: '2026-08-10', amount: 10000, category: 'Nayatel bill', notes: 'Upstream bill' });
  exp({ date: '2026-09-08', amount: 5000, category: 'Electricity', notes: 'OLT room bill' });
  exp({ date: '2026-10-11', amount: 7000, category: 'Repairs', notes: 'Generator repair' });
  // Out-of-range month: must never leak into the Aug–Oct statement.
  exp({ date: '2026-07-05', amount: 9999, category: 'Tools', notes: 'July tools' });

  const octPayments = [
    { id: 'pa3', amount: 3000, date: '2026-10-03', method: 'Cash' }
  ];
  if (withVoid) {
    octPayments.push({ id: 'pa4', amount: 1000, date: '2026-10-20', method: 'Cash', voided: true, voidedAt: '2026-10-21T09:00' });
  }

  state.customers.push(
    {
      id: 'syn-a', name: 'Synthetic Alpha', addedOn: '2026-07-15', connectionDate: null,
      archived: false, archivedAt: null,
      bills: [
        { month: '2026-08', dueAmount: 3000, payments: [{ id: 'pa1', amount: 3000, date: '2026-08-05', method: 'Cash' }] },
        { month: '2026-09', dueAmount: 3000, payments: [{ id: 'pa2', amount: 3000, date: '2026-09-04', method: 'Cash' }] },
        { month: '2026-10', dueAmount: 3000, payments: octPayments }
      ]
    },
    {
      id: 'syn-b', name: 'Synthetic Beta', addedOn: null, connectionDate: '2026-08-20',
      archived: false, archivedAt: null,
      bills: [
        { month: '2026-08', dueAmount: 2000, payments: [{ id: 'pb1', amount: 2000, date: '2026-08-25', method: 'Cash' }] },
        { month: '2026-09', dueAmount: 2000, payments: [{ id: 'pb2', amount: 2000, date: '2026-09-10', method: 'Cash' }] }
      ]
    },
    {
      id: 'syn-c', name: 'Synthetic Gamma', addedOn: '2026-09-02', connectionDate: null,
      archived: true, archivedAt: '2026-10-15T10:00',
      bills: [
        { month: '2026-09', dueAmount: 1500, payments: [{ id: 'pc1', amount: 1500, date: '2026-09-12', method: 'Cash' }] }
      ]
    },
    {
      // No recorded join date of any kind: never placed in a month.
      id: 'syn-d', name: 'Synthetic Undated', addedOn: null, connectionDate: null,
      billingStartMonth: null, archived: false, archivedAt: null, bills: []
    }
  );
  return state;
}

function engineRow(state, month) {
  const pnl = calculatePnlAnalytics(state, { selectedMonth: month, windowMonths: 6, referenceDate: REF });
  return pnl.monthlyData.find((row) => row.month === month);
}

test('spec pin: 3-month statement sums collections, expenses and net profit accurately', () => {
  const state = buildFixture();
  const st = buildLetterheadStatement(state, { fromMonth: '2026-08', toMonth: '2026-10', referenceDate: REF });

  assert.equal(st.fromMonth, '2026-08');
  assert.equal(st.toMonth, '2026-10');
  assert.deepEqual(st.months, ['2026-08', '2026-09', '2026-10']);
  assert.equal(st.rows.length, 3);

  const [aug, sep, oct] = st.rows;
  // August: receipts 3,000 + 2,000; expenses 10,000; subscribers A + B.
  assert.equal(aug.grossCollections, 5000);
  assert.equal(aug.operatingExpenses, 10000);
  assert.equal(aug.netProfit, -5000);
  assert.equal(aug.activeSubscribers, 2);
  // September: receipts 3,000 + 2,000 + 1,500; expenses 5,000; A + B + C.
  assert.equal(sep.grossCollections, 6500);
  assert.equal(sep.operatingExpenses, 5000);
  assert.equal(sep.netProfit, 1500);
  assert.equal(sep.activeSubscribers, 3);
  // October: receipts 3,000 real + 1,000 voided. The FU4 engine
  // already excludes the voided 1,000, so engine income is 3,000
  // and the statement collects exactly that; C archived in October.
  assert.equal(oct.grossCollections, 3000);
  assert.equal(oct.operatingExpenses, 7000);
  assert.equal(oct.netProfit, -4000);
  assert.equal(oct.activeSubscribers, 2);

  // Totals are the plain sums of the printed rows.
  assert.equal(st.totals.grossCollections, 14500);
  assert.equal(st.totals.operatingExpenses, 22000);
  assert.equal(st.totals.netProfit, -7500);
  assert.equal(st.totals.activeSubscribersEnd, 2);
  assert.equal(st.totals.voidedExcluded, 1000);
});

test('engine parity: every row equals a fresh calculatePnlAnalytics run for that month', () => {
  const state = buildFixture();
  const st = buildLetterheadStatement(state, { fromMonth: '2026-08', toMonth: '2026-10', referenceDate: REF });
  for (const row of st.rows) {
    const engine = engineRow(state, row.month);
    assert.equal(row.engineIncome, engine.income, `${row.month} engine income`);
    assert.equal(row.engineExpenses, engine.expenses, `${row.month} engine expenses`);
    assert.equal(row.engineNetProfit, engine.netProfit, `${row.month} engine net`);
    assert.equal(row.operatingExpenses, engine.expenses, `${row.month} expenses verbatim`);
    // Collections ARE the engine income: FU4 already excluded that
    // month's voided total inside the engine, and the statement
    // subtracts nothing — net is the engine's net too.
    assert.equal(row.grossCollections, engine.income);
    assert.equal(row.netProfit, engine.netProfit);
    assert.equal(row.netProfit, row.grossCollections - row.operatingExpenses);
  }
  // Range totals = the engines run over the whole range, unchanged.
  const engineTotals = st.rows.reduce((acc, row) => ({
    income: acc.income + row.engineIncome,
    expenses: acc.expenses + row.engineExpenses
  }), { income: 0, expenses: 0 });
  assert.equal(st.totals.grossCollections, engineTotals.income);
  assert.equal(st.totals.operatingExpenses, engineTotals.expenses);
});

test('voided pin: SISP-34 voided payments never count as collected', () => {
  const state = buildFixture();
  // FU4 merged: the shipped P&L engine excludes the voided row
  // itself — October engine income is 3,000, not 4,000. (Before
  // FU4 the engine summed it and this statement subtracted it;
  // the subtraction is gone so the money is excluded exactly once.)
  assert.equal(engineRow(state, '2026-10').income, 3000);

  const st = buildLetterheadStatement(state, { fromMonth: '2026-10', toMonth: '2026-10', referenceDate: REF });
  // The voided total is still reported for audit — informational
  // only. Collections equal the engine income exactly: had the old
  // subtraction survived, this would read 2,000 (double exclusion).
  assert.equal(st.rows[0].voidedExcluded, 1000);
  assert.equal(st.rows[0].grossCollections, 3000);
  assert.equal(st.rows[0].grossCollections, engineRow(state, '2026-10').income);
  assert.equal(st.rows[0].netProfit, -4000);

  // With no voided payment the statement is EXACTLY the engine.
  const clean = buildFixture({ withVoid: false });
  const cleanSt = buildLetterheadStatement(clean, { fromMonth: '2026-08', toMonth: '2026-10', referenceDate: REF });
  for (const row of cleanSt.rows) {
    const engine = engineRow(clean, row.month);
    assert.equal(row.voidedExcluded, 0);
    assert.equal(row.grossCollections, engine.income);
    assert.equal(row.netProfit, engine.netProfit);
  }
});

test('subscriber rules: join month counts, archive month stops, undated never placed', () => {
  const state = buildFixture();
  const st = buildLetterheadStatement(state, { fromMonth: '2026-07', toMonth: '2026-10', referenceDate: REF });
  const byMonth = Object.fromEntries(st.rows.map((row) => [row.month, row.activeSubscribers]));
  assert.equal(byMonth['2026-07'], 1); // only A (joined 2026-07)
  assert.equal(byMonth['2026-08'], 2); // A + B (B joined in August)
  assert.equal(byMonth['2026-09'], 3); // A + B + C
  assert.equal(byMonth['2026-10'], 2); // C archived during October
  assert.deepEqual(st.limits, { undatedCustomers: 1, archivedUndated: 0 });

  // Archived with NO recorded archive date: counted in no month.
  const state2 = createInitialState([]);
  state2.customers.push({
    id: 'syn-e', name: 'Synthetic NoArchiveDate', addedOn: '2026-08-01', connectionDate: null,
    archived: true, archivedAt: null, bills: []
  });
  const st2 = buildLetterheadStatement(state2, { fromMonth: '2026-08', toMonth: '2026-09', referenceDate: REF });
  assert.equal(st2.rows[0].activeSubscribers, 0);
  assert.equal(st2.rows[1].activeSubscribers, 0);
  assert.deepEqual(st2.limits, { undatedCustomers: 0, archivedUndated: 1 });
});

test('zero months print as honest zero rows, never skipped', () => {
  const state = buildFixture();
  const st = buildLetterheadStatement(state, { fromMonth: '2026-06', toMonth: '2026-08', referenceDate: REF });
  assert.equal(st.rows.length, 3);
  const june = st.rows[0];
  assert.equal(june.month, '2026-06');
  assert.equal(june.grossCollections, 0);
  assert.equal(june.operatingExpenses, 0);
  assert.equal(june.netProfit, 0);
  assert.equal(june.activeSubscribers, 0);

  const empty = buildLetterheadStatement(createInitialState([]), { fromMonth: '2026-08', toMonth: '2026-10', referenceDate: REF });
  assert.equal(empty.rows.length, 3);
  assert.equal(empty.totals.netProfit, 0);
});

test('range validation: malformed, reversed and over-cap ranges are refused clearly', () => {
  const state = buildFixture();
  assert.throws(
    () => buildLetterheadStatement(state, { fromMonth: '2026-13', toMonth: '2026-10', referenceDate: REF }),
    /valid From and To month/
  );
  assert.throws(
    () => buildLetterheadStatement(state, { fromMonth: '2026-10', toMonth: '2026-08', referenceDate: REF }),
    /on or before/
  );
  assert.throws(
    () => buildLetterheadStatement(state, { fromMonth: '2023-12', toMonth: '2027-01', referenceDate: REF }),
    new RegExp(`at most ${LETTERHEAD_MAX_RANGE_MONTHS} months`)
  );
  // Exactly at the cap is accepted.
  const st = buildLetterheadStatement(createInitialState([]), { fromMonth: '2024-01', toMonth: '2026-12', referenceDate: REF });
  assert.equal(st.rows.length, LETTERHEAD_MAX_RANGE_MONTHS);

  assert.deepEqual(letterheadMonthsInRange('2026-08', '2026-10'), ['2026-08', '2026-09', '2026-10']);
  assert.equal(shiftLetterheadMonth('2026-11', 2), '2027-01');
  assert.equal(shiftLetterheadMonth('2026-01', -1), '2025-12');
  assert.equal(shiftLetterheadMonth('bad', 1), '');
});

test('read-only: building and printing mutate nothing', () => {
  const state = buildFixture();
  const before = JSON.stringify(state);
  const st = buildLetterheadStatement(state, { fromMonth: '2026-08', toMonth: '2026-10', referenceDate: REF });
  generateLetterheadPrintHtml({ statement: st, generatedDate: '2026-11-05' });
  generateLetterheadPrintHtml({ statement: st, lang: 'ur', generatedDate: '2026-11-05' });
  assert.equal(JSON.stringify(state), before);
});

test('print HTML: letterhead, all rows, totals and both partner sign-off blocks (en + ur)', () => {
  const state = buildFixture();
  const st = buildLetterheadStatement(state, { fromMonth: '2026-08', toMonth: '2026-10', referenceDate: REF });

  const en = generateLetterheadPrintHtml({ statement: st, generatedDate: '2026-11-05' });
  assert.ok(en.includes('SHAHDARA FIBER NET'));
  assert.ok(en.includes('Financial &amp; Subscriber Statement'));
  assert.ok(en.includes('August 2026'));
  assert.ok(en.includes('September 2026'));
  assert.ok(en.includes('October 2026'));
  assert.ok(en.includes(formatPKR(14500)));
  assert.ok(en.includes(formatPKR(22000)));
  assert.ok(en.includes(formatPKR(-7500)));
  assert.ok(en.includes('Prepared by / Owner'));
  assert.deepEqual(st.partners, [...PARTNERS]);
  for (const name of PARTNERS) assert.ok(en.includes(`${name} (Partner)`), `${name} sign-off block`);
  assert.ok(!/lh_[a-z0-9_]+/.test(en), 'no raw i18n keys in English print');

  const ur = generateLetterheadPrintHtml({ statement: st, lang: 'ur', generatedDate: '2026-11-05' });
  assert.ok(ur.includes('مالیاتی و سبسکرائبر گوشوارہ'));
  // Partner names print as recorded (PARTNERS data, Latin); only the
  // "(Partner)" suffix translates — names are data, never re-typed.
  assert.ok(ur.includes('Nasir (پارٹنر)'));
  assert.ok(ur.includes('Aqib (پارٹنر)'));
  assert.ok(!/lh_[a-z0-9_]+/.test(ur), 'no raw i18n keys in Urdu print');
});

test('i18n audit: every lh_* key used by the module and dialog exists in en AND ur', () => {
  const moduleSrc = readFileSync(new URL('../business-letterhead-print.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dialogStart = indexHtml.indexOf('id="letterheadDialog"');
  assert.ok(dialogStart > -1, 'letterhead dialog markup exists');
  const dialogBlock = indexHtml.slice(indexHtml.indexOf('id="letterheadOpenBtn"') - 200, dialogStart + 4000);

  const used = new Set();
  for (const src of [moduleSrc, dialogBlock]) {
    for (const match of src.matchAll(/lh_[a-z0-9_]+/g)) used.add(match[0]);
  }
  assert.ok(used.size >= 15, `expected at least 15 lh_* keys, saw ${used.size}`);
  for (const key of used) {
    assert.ok(TRANSLATIONS.en && TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur && TRANSLATIONS.ur[key], `missing ur key ${key}`);
  }
});

test('wiring: app.js controller, toolbar button, dialog markup, token CSS, runtime graph', async () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes("from './business-letterhead-print.js'"));
  assert.ok(appSrc.includes('setupLetterheadDialog'));
  assert.ok(appSrc.includes('letterheadDialogController'));

  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['letterheadOpenBtn', 'letterheadDialog', 'letterheadFromMonth', 'letterheadToMonth', 'letterheadPreview', 'letterheadPrintBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html carries #${id}`);
  }
  const dialogStart = indexHtml.indexOf('id="letterheadDialog"');
  const dialogBlock = indexHtml.slice(dialogStart, dialogStart + 4000);
  assert.ok(/id="letterheadCloseBtn" class="close-btn"[^>]*>↩<\/button>/.test(dialogBlock), 'shared ↩ close button');

  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const cssStart = css.indexOf('.letterhead-help');
  assert.ok(cssStart > -1, 'letterhead CSS block exists');
  const cssBlock = css.slice(cssStart, css.indexOf('.letterhead-preview') + 200);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(cssBlock), 'letterhead CSS is token-only (no hex)');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.ok(files.includes('business-letterhead-print.js'), 'module is in the runtime graph');
  assert.ok(!missing.includes('business-letterhead-print.js'));

  // No DOM in the unit-test runtime: the controller refuses cleanly.
  assert.equal(setupLetterheadDialog(() => buildFixture()), null);
});
