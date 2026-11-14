import test from 'node:test';
import assert from 'node:assert/strict';

// Sharafat 41 — dues-ageing areas use raw area strings, so one mohalla splits
// into several rows. The fix canonicalises customerSummary.area through
// canonicalMohalla (label-only, area-first) at dashboard-dues-aging.js:281, so
// every consumer (CSV ledger, briefing, drill-down filter, table, area select)
// reads the canonical label. Parent decisions (2026-11-15 ~00:29 PKT):
// (a) label-only, (a) keep area-first, (a) keep totalDue-desc,
// (a) accept + disclose the THALI/THALII + HAWELI/END POINT residual,
// (a) leave the CSV 'Mohalla' column raw.

const refDate = new Date('2026-10-17T12:00:00+05:00');

async function buildState(customers) {
  const { calculateDuesAgingBreakdown, generateDuesAgingCsv, generateDuesAgingBriefing } =
    await import('../dashboard-dues-aging.js');
  const { createInitialState, addCustomer, saveBillMonth } = await import('../core.js');
  let state = createInitialState([]);
  for (const [index, spec] of customers.entries()) {
    state = addCustomer(state, spec.name, new Date('2026-06-01T10:00:00+05:00'), {
      monthlySellingAmount: spec.dueAmount,
      phone: `0300111223${index}`,
      mohalla: 'Main Bazaar'
    });
    const customer = state.customers[state.customers.length - 1];
    // addCustomer stores no `area` field — the ageing suite assigns it directly.
    if (spec.area !== undefined) customer.area = spec.area;
    if (spec.mohalla !== undefined) customer.mohalla = spec.mohalla;
    state = saveBillMonth(state, customer.id, {
      month: '2026-09',
      dueAmount: spec.dueAmount,
      status: 'pending',
      dueDate: '2026-09-05'
    }, refDate);
  }
  const agingData = calculateDuesAgingBreakdown(state, refDate);
  return { agingData, csv: generateDuesAgingCsv(agingData, refDate), briefing: generateDuesAgingBriefing(agingData, refDate) };
}

test('Sharafat 41: spelling variants of one mohalla fold to one area row', async () => {
  const { agingData } = await buildState([
    { name: 'Area Test One', area: 'Charyaa', dueAmount: 2500 },
    { name: 'Area Test Two', area: 'Mohalla Charyaa', dueAmount: 2500 },
    { name: 'Area Test Three', area: 'CHARYAA', dueAmount: 2500 }
  ]);
  assert.equal(agingData.areas.length, 1);
  const charyaa = agingData.areas[0];
  assert.equal(charyaa.areaName, 'Charyaa');
  assert.equal(charyaa.totalDue, 7500);
  assert.equal(charyaa.customerCount, 3);
  // Every customer row carries the canonical label too (CSV / drill-down read it).
  assert.deepEqual(agingData.customers.map(c => c.area), ['Charyaa', 'Charyaa', 'Charyaa']);
});

test('Sharafat 41: alias variants fold to one area row', async () => {
  const { agingData: bani } = await buildState([
    { name: 'Area Test One', area: 'Bani', dueAmount: 1000 },
    { name: 'Area Test Two', area: 'BANII', dueAmount: 2000 }
  ]);
  assert.equal(bani.areas.length, 1);
  assert.equal(bani.areas[0].areaName, 'Banii');
  assert.equal(bani.areas[0].totalDue, 3000);
  assert.equal(bani.areas[0].customerCount, 2);

  const { agingData: kishti } = await buildState([
    { name: 'Area Test One', area: 'Kishti', dueAmount: 1500 },
    { name: 'Area Test Two', area: 'KISHTII', dueAmount: 1500 }
  ]);
  assert.equal(kishti.areas.length, 1);
  assert.equal(kishti.areas[0].areaName, 'Kishtii');
  assert.equal(kishti.areas[0].totalDue, 3000);
  assert.equal(kishti.areas[0].customerCount, 2);
});

test('Sharafat 41: CSV and briefing agree with the screen on one Charyaa row', async () => {
  const { agingData, csv, briefing } = await buildState([
    { name: 'Area Test One', area: 'Charyaa', dueAmount: 2500 },
    { name: 'Area Test Two', area: 'Mohalla Charyaa', dueAmount: 2500 },
    { name: 'Area Test Three', area: 'CHARYAA', dueAmount: 2500 }
  ]);
  assert.equal(agingData.areas.length, 1);
  // The ledger prints the canonical label; no raw spelling survives in the CSV.
  assert.ok(csv.includes('"Charyaa"'));
  assert.ok(!csv.includes('"Mohalla Charyaa"'));
  assert.ok(!csv.includes('"CHARYAA"'));
  // The briefing's area section lists the one summed row.
  assert.ok(briefing.includes('1. Charyaa: PKR 7,500 across 3 accounts'));
  assert.ok(briefing.includes('Area Test One (Charyaa) - PKR 2,500'));
});

test('Sharafat 41: blank or missing area still falls back to Unassigned', async () => {
  const { agingData } = await buildState([
    { name: 'Area Test One', area: '', mohalla: '', dueAmount: 1000 },
    // No area AND no mohalla: only then does the 'Unassigned' fallback fire
    // (area-first input — a set mohalla would win over a blank area).
    { name: 'Area Test Two', mohalla: '', dueAmount: 2000 }
  ]);
  assert.equal(agingData.areas.length, 1);
  assert.equal(agingData.areas[0].areaName, 'Unassigned');
  assert.equal(agingData.areas[0].totalDue, 3000);
  assert.equal(agingData.areas[0].customerCount, 2);
  assert.deepEqual(agingData.customers.map(c => c.area), ['Unassigned', 'Unassigned']);
});

test('Sharafat 41: non-listed area keeps its own readable label', async () => {
  const { agingData } = await buildState([
    { name: 'Area Test One', area: 'Saeed Park', dueAmount: 6500 },
    { name: 'Area Test Two', area: 'Wandala Road', dueAmount: 3500 }
  ]);
  assert.equal(agingData.areas.length, 2);
  const saeed = agingData.areas.find(a => a.areaName === 'Saeed Park');
  const wandala = agingData.areas.find(a => a.areaName === 'Wandala Road');
  assert.equal(saeed.totalDue, 6500);
  assert.equal(wandala.totalDue, 3500);
});

test('Sharafat 41: THALI / THALII still split — known residual, documented not fixed', async () => {
  // Why-comment: the doc-literal fix (label-only via canonicalMohalla) folds
  // spelling variants and aliases, but comparisonKey is plain lowercase with
  // no THALI alias and no HAWELI entry in DEFAULT_MOHALLAS, so THALI
  // (key 'thali') and THALII (key 'thalii') still form two rows. Parent
  // decision 4(a): accept + disclose; rank-grouping (b) and new aliases (c)
  // were rejected as a bigger semantic change / blast radius. Follow-up
  // candidate — flip this test to one row when the residual is fixed.
  // The assertions pin the ROW COUNT (the residual), not the label casing:
  // the fix canonicalises the labels, so 'THALI'/'THALII' become
  // 'Thali'/'Thalii' — the split itself is what this test documents.
  const { agingData } = await buildState([
    { name: 'Area Test One', area: 'THALI', dueAmount: 1000 },
    { name: 'Area Test Two', area: 'THALII', dueAmount: 2000 }
  ]);
  assert.equal(agingData.areas.length, 2);
  assert.deepEqual(
    agingData.areas.map(a => a.areaName.toLowerCase()).sort(),
    ['thali', 'thalii']
  );
  assert.equal(agingData.areas.find(a => a.areaName.toLowerCase() === 'thali').totalDue, 1000);
  assert.equal(agingData.areas.find(a => a.areaName.toLowerCase() === 'thalii').totalDue, 2000);
});
