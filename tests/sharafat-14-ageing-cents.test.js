// Sharafat 14 — Ageing carries integer cents end-to-end.
//
// The ageing caller used to round each bill's balance to whole rupees
// (amount: Math.round(balanceDue)) and the modules rounded again in
// num(), so a PKR 1,500.50 due aged as 1,501 (or 1,500) while the
// ledger keeps paisa. Since Sharafat 14 the caller passes
// balanceDueCents straight through, entries / buckets / mohalla
// totals stay in integer cents, and only the display rounds to whole
// rupees. The CSV writes exact decimal rupees (parent decision
// 2026-11-13): 150050 cents is "1500.50", never "150050".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildReceivablesAgeing,
  ageingHtml,
  ageingCsv,
} from '../receivables-ageing.js';
import {
  buildMohallaAgeing,
  mohallaAgeingCsv,
} from '../mohalla-ageing.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');

const AS_OF = '2026-11';

const entry = (overrides = {}) => ({
  customerId: 'c1',
  customerName: 'Ayesha',
  mohalla: 'Bani',
  billMonth: '2026-11',
  amount: 150050,
  ...overrides,
});

test('a bill of 1500.50 ages as 150050 cents, not 1501 or 1500 rupees', () => {
  const view = buildReceivablesAgeing([entry()], AS_OF);
  assert.equal(view.valid, true);
  assert.equal(view.buckets.current.amount, 150050);
  assert.equal(view.totalOutstanding, 150050);
  assert.equal(view.sumsMatch, true);
});

test('bucket, mohalla and headline totals agree exactly on paisa dues', () => {
  const entries = [
    entry({ billMonth: '2026-11', amount: 150050 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-10', amount: 200025 }),
    entry({ customerId: 'c3', customerName: 'Chand', mohalla: 'Shahdara', billMonth: '2026-09', amount: 99999 }),
    entry({ customerId: 'c4', customerName: 'Dina', mohalla: 'Shahdara', billMonth: '2026-08', amount: 400040 }),
  ];
  const view = buildReceivablesAgeing(entries, AS_OF);
  // Ledger agreement: ageing total === sum of the balanceDueCents the
  // caller passes in (150050 + 200025 + 99999 + 400040 = 850114).
  assert.equal(view.totalOutstanding, 850114);
  assert.equal(view.bucketTotal, 850114);
  assert.equal(view.buckets.current.amount, 150050);
  assert.equal(view.buckets.one.amount, 200025);
  assert.equal(view.buckets.two.amount, 99999);
  assert.equal(view.buckets.threePlus.amount, 400040);
  const mohallaSum = view.mohallaTotals.reduce((sum, row) => sum + row.total, 0);
  assert.equal(mohallaSum, view.totalOutstanding);
  assert.equal(view.sumsMatch, true);
  const summary = buildMohallaAgeing(view, ['Bani', 'Shahdara']);
  assert.equal(summary.businessTotal, 850114);
  assert.equal(summary.rowsTotal, 850114);
  assert.equal(summary.sumsMatch, true);
  assert.equal(summary.bandsMatch, true);
});

test('display rounds only at the surface: 150050 cents prints Rs. 1,501', () => {
  const view = buildReceivablesAgeing([entry()], AS_OF);
  const html = ageingHtml(view);
  assert.match(html, /Rs\. 1,501/);
  // Guard: the cents figure must never leak into the display as rupees.
  assert.doesNotMatch(html, /Rs\. 150,050/);
});

test('CSV writes exact decimal rupees, never integer cents', () => {
  const entries = [
    entry({ billMonth: '2026-11', amount: 150050 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-08', amount: 500000 }),
  ];
  const view = buildReceivablesAgeing(entries, AS_OF);
  const csv = ageingCsv(view, entries);
  assert.match(csv, /Current,Ayesha,Bani,2026-11,1500\.50/);
  assert.match(csv, /3\+ months,Bilal,Bani,2026-08,5000\.00/);
  assert.match(csv, /Bani,6500\.50,2,1500\.50,0\.00,0\.00,5000\.00/);
  assert.doesNotMatch(csv, /150050/);
  assert.doesNotMatch(csv, /500000/);
  const summary = buildMohallaAgeing(view, ['Bani']);
  const mohallaCsv = mohallaAgeingCsv(summary);
  assert.match(mohallaCsv, /Bani,1500\.50,0\.00,0\.00,5000\.00,0\.00,6500\.50,2,/);
  assert.match(mohallaCsv, /Business total,,,,,,6500\.50,,\n?$/);
  assert.doesNotMatch(mohallaCsv, /150050/);
});

test('a sub-rupee due (40 paisa) now appears in ageing instead of rounding to 0', () => {
  // Sharafat 14 behaviour change (disclosed in the PR body): a 40-cent
  // due used to round to 0 rupees and be skipped as non-outstanding;
  // it is a real due, so it now ages. 50 cents (0.50) used to round to
  // 1 rupee and appear; it still appears, now at its exact value.
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-11', amount: 40 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-11', amount: 50 }),
  ], AS_OF);
  assert.equal(view.totalOutstanding, 90);
  assert.equal(view.billCount, 2);
  assert.equal(view.skippedNonOutstanding, 0);
});

test('caller wiring: app.js passes balanceDueCents with no /100 and no Math.round', () => {
  const start = appJs.indexOf('function renderReceivablesAgeing()');
  assert.ok(start > -1);
  const block = appJs.slice(start, appJs.indexOf('// Plan 213', start));
  assert.match(block, /amount: balanceDueCents,/);
  assert.doesNotMatch(block, /Math\.round\(balanceDue\)/);
  assert.doesNotMatch(block, /balanceDueCents \/ 100/);
});
