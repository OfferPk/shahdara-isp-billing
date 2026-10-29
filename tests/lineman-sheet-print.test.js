/**
 * lineman-sheet-print.test.js — SISP-55 [P2]: Printable Monthly Zone
 * Defaulter Sheet for Field Linemen.
 *
 * Spec criterion (read-latest.txt, SISP-55): "Generating the Zone
 * Collection Sheet for 'Barrian' lists only unpaid active Barrian
 * subscribers (excluding active future Waada snoozed customers by
 * default) with accurate totals."
 *
 * Pins:
 *  - the spec scenario exactly: a Barrian sheet contains only unpaid,
 *    active, non-snoozed Barrian subscribers; paid / FREE / archived /
 *    cancelled / other-zone customers never appear;
 *  - arrears (months before the sheet month) vs This Month split and
 *    zone + grand totals that add up from the printed rows;
 *  - a voided receipt never reduces what the sheet says is owed
 *    (SISP-34: the engine excludes voided payments);
 *  - Waada-snoozed customers join only with includeWaadaSnoozed, with
 *    their promise date on the row; a broken promise stays either way;
 *  - canonicalMohalla grouping: 'BARRIAN', 'Barrian' and
 *    'Mohalla Barrian' are one zone; rows walk in pole order;
 *  - bilingual names (stored Urdu override wins, transliteration
 *    otherwise, Roman always kept) and the SISP-32 pole/landmark;
 *  - SISP-38 grace state on the row (Oct 20 → Lock Due), and a
 *    vacation-held customer stays listed for pre-hold arrears, badged;
 *  - A4 + thermal print documents carry checkboxes, blank cash/sign
 *    columns, zone subtotals, grand total and signature lines;
 *  - i18n: every zsheet_* key exists in BOTH dictionaries (params
 *    included); wiring: dialog + button markup, app.js controller,
 *    CSS tokens, and the module is reachable in the runtime graph.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, addCustomer, saveBillMonth, addPayment
} from '../core.js';
import { voidPayment } from '../payment-void-audit.js';
import {
  buildZoneDefaulterSheet,
  listZoneSheetZones,
  generateZoneSheetPrintHtml
} from '../lineman-sheet-print.js';
import { collectRuntimeFiles } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

// Midday UTC == 17:00 PKT the same day. Oct 20 sits in the SISP-38
// Lock Due window (day >= 15) for unpaid customers without a Waada.
const REF = new Date('2026-10-20T12:00:00Z');
const ADD_REF = new Date('2026-10-01T12:00:00Z');

function buildFixtureState() {
  let state = createInitialState([]);
  const add = (name, options = {}) => {
    state = addCustomer(state, name, ADD_REF, options);
    return state.customers[state.customers.length - 1];
  };
  const bill = (cust, month, dueAmount) => {
    state = saveBillMonth(state, cust.id, { month, dueAmount, status: 'pending' }, ADD_REF);
  };
  const pay = (cust, month, amount, date) => {
    // Payments are recorded with the Oct 20 reference so their October
    // dates are never "in the future" for core's payment validation.
    state = addPayment(state, cust.id, month, { amount, date, method: 'Cash' }, REF);
  };
  // Record-level fields are stamped on the STORED record at the very
  // end: saveBillMonth copies the billed customer into the new state,
  // so mutating an add()-time reference afterwards never lands — and
  // saveBillMonth refuses new bills for archived customers, so the
  // archive flag can only be applied after billing.
  const stamp = (id, fields) => {
    Object.assign(state.customers.find(x => x.id === id), fields);
  };

  // A — Barrian defaulter: Sep arrears 2,000 + Oct 1,500. Pole + Urdu name.
  const a = add('Ahmed Raza', { phone: '03001112223', mohalla: 'BARRIAN' });
  bill(a, '2026-09', 2000);
  bill(a, '2026-10', 1500);
  stamp(a.id, {
    packageSpeed: '10 Mbps',
    poleNumber: 'Pole #14',
    boxLocationNote: 'near Masjid Bilal',
    nameUrdu: 'احمد رضا'
  });

  // B — same zone via the 'Barrian' variant spelling; Oct only, no pole.
  const b = add('Bilal Hussain', { phone: '03002223334', mohalla: 'Barrian' });
  bill(b, '2026-10', 1000);
  stamp(b.id, { packageSpeed: '5 Mbps' });

  // C — Barrian, fully paid: never on the sheet.
  const c = add('Paid Customer', { mohalla: 'BARRIAN' });
  bill(c, '2026-10', 1500);
  pay(c, '2026-10', 1500, '2026-10-06');

  // D — Barrian FREE connection with an unpaid bill: owes nothing, ever.
  const d = add('Free Line', { mohalla: 'BARRIAN', isFreeConnection: true });
  bill(d, '2026-10', 1000);

  // E — Barrian defaulter archived afterwards: excluded.
  const e = add('Archived Customer', { mohalla: 'BARRIAN' });
  bill(e, '2026-10', 2200);
  stamp(e.id, { archived: true });

  // F — Barrian with a future Waada (snoozed): excluded by default.
  const f = add('Waada Customer', { mohalla: 'BARRIAN' });
  bill(f, '2026-10', 2000);
  stamp(f.id, { promiseDate: '2026-10-28' });

  // G — Barrian whose only payment was voided: still owes in full.
  const g = add('Voided Payer', { mohalla: 'BARRIAN' });
  bill(g, '2026-10', 3000);
  pay(g, '2026-10', 3000, '2026-10-07');
  const gPayment = state.customers.find(x => x.id === g.id)
    .bills.find(x => x.month === '2026-10').payments[0];
  state = voidPayment(state, g.id, '2026-10', gPayment.id, { voidReason: 'Wrong entry (test)' }).state;

  // H — Barrian cancelled on Oct 10: no longer an active subscriber.
  const h = add('Cancelled Customer', { mohalla: 'BARRIAN' });
  bill(h, '2026-10', 1700);
  stamp(h.id, { cancellationDate: '2026-10-10' });

  // I — Palaliyaa defaulter: own zone, never in the Barrian sheet.
  const i = add('Palaliyaa Customer', { mohalla: 'PALALIYAA' });
  bill(i, '2026-09', 1200);
  bill(i, '2026-10', 1200);

  // J — Barrian on vacation hold since Oct 1, owing pre-hold Sep arrears.
  const j = add('Held Customer', { mohalla: 'Mohalla Barrian' });
  bill(j, '2026-09', 1800);
  stamp(j.id, { paused: true, pauseStartDate: '2026-10-01' });

  // K — Barrian with a BROKEN Waada (promise date already past): stays.
  const k = add('Broken Waada', { mohalla: 'BARRIAN' });
  bill(k, '2026-10', 900);
  stamp(k.id, { promiseDate: '2026-10-12' });

  return state;
}

test('spec criterion: the Barrian sheet lists only unpaid active Barrian subscribers, Waada-snoozed excluded by default', () => {
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'Barrian', referenceDate: REF });

  assert.equal(sheet.month, '2026-10');
  assert.equal(sheet.zones.length, 1);
  const zone = sheet.zones[0];
  assert.equal(zone.label, 'Barrian');
  const names = zone.rows.map(r => r.name);
  assert.deepEqual([...names].sort(), ['Ahmed Raza', 'Bilal Hussain', 'Broken Waada', 'Held Customer', 'Voided Payer']);
  assert.ok(!names.includes('Waada Customer'), 'future Waada excluded by default');
  assert.ok(!names.includes('Paid Customer'));
  assert.ok(!names.includes('Free Line'));
  assert.ok(!names.includes('Archived Customer'));
  assert.ok(!names.includes('Cancelled Customer'));
  assert.ok(!names.includes('Palaliyaa Customer'));
  assert.equal(sheet.excludedWaadaCount, 1);
  assert.equal(sheet.excludedCancelledCount, 1);
});

test('accurate totals: arrears vs this-month split, zone totals and grand totals add up', () => {
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'Barrian', referenceDate: REF });
  const zone = sheet.zones[0];
  const byName = Object.fromEntries(zone.rows.map(r => [r.name, r]));

  assert.equal(byName['Ahmed Raza'].arrears, 2000);
  assert.equal(byName['Ahmed Raza'].currentMonthDue, 1500);
  assert.equal(byName['Ahmed Raza'].totalDue, 3500);
  assert.equal(byName['Bilal Hussain'].arrears, 0);
  assert.equal(byName['Bilal Hussain'].currentMonthDue, 1000);
  assert.equal(byName['Held Customer'].arrears, 1800);
  assert.equal(byName['Held Customer'].currentMonthDue, 0);

  // Zone totals are the plain sum of the printed rows.
  const rowSum = zone.rows.reduce((acc, r) => ({
    arrears: acc.arrears + r.arrears,
    currentMonthDue: acc.currentMonthDue + r.currentMonthDue,
    totalDue: acc.totalDue + r.totalDue
  }), { arrears: 0, currentMonthDue: 0, totalDue: 0 });
  assert.deepEqual(
    { arrears: zone.totals.arrears, currentMonthDue: zone.totals.currentMonthDue, totalDue: zone.totals.totalDue },
    rowSum
  );
  assert.equal(zone.totals.count, 5);
  assert.equal(zone.totals.totalDue, 3500 + 1000 + 3000 + 900 + 1800);
  assert.deepEqual(
    { count: sheet.totals.count, arrears: sheet.totals.arrears, currentMonthDue: sheet.totals.currentMonthDue, totalDue: sheet.totals.totalDue },
    { count: zone.totals.count, arrears: zone.totals.arrears, currentMonthDue: zone.totals.currentMonthDue, totalDue: zone.totals.totalDue }
  );
});

test('a voided receipt never reduces the sheet figure (SISP-34)', () => {
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'Barrian', referenceDate: REF });
  const row = sheet.zones[0].rows.find(r => r.name === 'Voided Payer');
  assert.ok(row, 'voided payer is still a defaulter');
  assert.equal(row.totalDue, 3000);
});

test('includeWaadaSnoozed brings the promised customer in, promise date on the row; broken Waada stays either way', () => {
  const state = buildFixtureState();
  const withWaada = buildZoneDefaulterSheet(state, { zone: 'all', referenceDate: REF, includeWaadaSnoozed: true });
  const barrian = withWaada.zones.find(z => z.label === 'Barrian');
  const waadaRow = barrian.rows.find(r => r.name === 'Waada Customer');
  assert.ok(waadaRow);
  assert.equal(waadaRow.waadaTier, 'promised');
  assert.equal(waadaRow.promiseDate, '2026-10-28');
  assert.equal(waadaRow.totalDue, 2000);
  assert.equal(withWaada.excludedWaadaCount, 0);

  const without = buildZoneDefaulterSheet(state, { zone: 'Barrian', referenceDate: REF });
  assert.ok(without.zones[0].rows.some(r => r.name === 'Broken Waada'), 'broken promise stays by default');
  assert.equal(without.zones[0].rows.find(r => r.name === 'Broken Waada').waadaTier, 'broken');
});

test('zones group by canonicalMohalla and the all-zones sheet keeps zones apart', () => {
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'all', referenceDate: REF });
  const labels = sheet.zones.map(z => z.label);
  assert.deepEqual(labels, ['Barrian', 'Palaliyaa']);
  const palaliyaa = sheet.zones.find(z => z.label === 'Palaliyaa');
  assert.equal(palaliyaa.totals.count, 1);
  assert.equal(palaliyaa.totals.arrears, 1200);
  assert.equal(palaliyaa.totals.currentMonthDue, 1200);
  assert.equal(palaliyaa.totals.totalDue, 2400);
  assert.equal(sheet.totals.totalDue, 10200 + 2400);

  const zones = listZoneSheetZones(buildFixtureState(), { referenceDate: REF });
  assert.deepEqual(zones.map(z => z.label), ['Barrian', 'Palaliyaa']);
  assert.equal(zones[0].count, 5);
});

test('rows carry bilingual name, pole/landmark, package, grace state and hold badge data', () => {
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'Barrian', referenceDate: REF });
  const rows = sheet.zones[0].rows;
  const ahmed = rows.find(r => r.name === 'Ahmed Raza');
  assert.ok(ahmed.bilingualName.includes('احمد رضا'), 'stored Urdu override prints');
  assert.ok(ahmed.bilingualName.includes('Ahmed Raza'), 'Roman name is always kept');
  assert.equal(ahmed.poleLandmark, 'Pole #14');
  assert.equal(ahmed.packageName, '10 Mbps');
  assert.equal(ahmed.escalationStage, 'lock-due');
  assert.equal(ahmed.escalationLabel, '🔴 Lock Due');
  assert.equal(ahmed.oldestOverdueDays, 45);
  assert.deepEqual(ahmed.unpaidMonths, ['2026-09', '2026-10']);

  const bilal = rows.find(r => r.name === 'Bilal Hussain');
  assert.ok(bilal.bilingualName.includes('Bilal Hussain'));
  assert.ok(/[؀-ۿ]/.test(bilal.bilingualName), 'transliterated Urdu name prints when no override is stored');

  const held = rows.find(r => r.name === 'Held Customer');
  assert.equal(held.vacationHold, 'active');
});

test('rows walk in pole order, then name order', () => {
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'Barrian', referenceDate: REF });
  const names = sheet.zones[0].rows.map(r => r.name);
  assert.equal(names[0], 'Ahmed Raza', 'the pole customer walks first');
  assert.deepEqual(names.slice(1), [...names.slice(1)].sort((x, y) => x.localeCompare(y)));
});

test('an explicit earlier sheet month re-splits arrears vs this month', () => {
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'Barrian', month: '2026-09', referenceDate: REF });
  const ahmed = sheet.zones[0].rows.find(r => r.name === 'Ahmed Raza');
  assert.equal(sheet.month, '2026-09');
  assert.equal(ahmed.arrears, 0);
  assert.equal(ahmed.currentMonthDue, 3500, 'Sep + Oct both count toward the Sep sheet going forward');
});

test('empty and malformed states return an empty sheet, never throw', () => {
  for (const bad of [null, undefined, {}, { customers: [] }, { customers: 'nope' }]) {
    const sheet = buildZoneDefaulterSheet(bad, { zone: 'Barrian', referenceDate: REF });
    assert.deepEqual(sheet.zones, []);
    assert.equal(sheet.totals.count, 0);
    assert.equal(sheet.totals.totalDue, 0);
  }
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'KISHTII', referenceDate: REF });
  assert.deepEqual(sheet.zones, [], 'a zone with no defaulters yields no group');
});

test('A4 print document: checkboxes, bilingual names, blank cash/sign columns, subtotals, grand total, signature lines', () => {
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'all', referenceDate: REF });
  const html = generateZoneSheetPrintHtml({ sheet, format: 'a4', lang: 'en' });
  assert.ok(html.includes('@page { size: A4;'));
  assert.ok(html.includes('class="box"'), 'paper checkbox renders');
  assert.ok(html.includes('احمد رضا'), 'Urdu name prints');
  assert.ok(html.includes('Ahmed Raza'), 'Roman name prints');
  assert.ok(html.includes('Pole #14'), 'pole/landmark prints');
  assert.ok(html.includes('Cash Received'), 'blank cash column header prints');
  assert.ok(html.includes('Sign'), 'blank signature column header prints');
  assert.ok(html.includes('Zone total'), 'zone subtotal prints');
  assert.ok(html.includes('Grand total'), 'grand total prints');
  assert.ok(html.includes('PKR 12,600'), 'grand total figure is accurate');
  assert.ok(html.includes('Barrian') && html.includes('Palaliyaa'), 'both zone sections print');
  assert.ok(!html.includes('Waada Customer'), 'snoozed customer stays off the default paper');
});

test('thermal print document: compact blocks with cash/sign lines and totals', () => {
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'Barrian', referenceDate: REF });
  const html = generateZoneSheetPrintHtml({ sheet, format: 'thermal', lang: 'en' });
  assert.ok(html.includes('size: 80mm auto'));
  assert.ok(html.includes('☐ #'), 'checkbox line per customer');
  assert.ok(html.includes('Ahmed Raza'));
  assert.ok(html.includes('Cash Received: ____________'), 'blank cash line prints');
  assert.ok(html.includes('PKR 10,200'), 'zone total figure is accurate');
});

test('print documents render in Urdu when lang is ur', () => {
  const sheet = buildZoneDefaulterSheet(buildFixtureState(), { zone: 'Barrian', referenceDate: REF });
  const html = generateZoneSheetPrintHtml({ sheet, format: 'a4', lang: 'ur' });
  assert.ok(html.includes('کل واجب الادا'), 'Urdu column labels print');
  assert.ok(html.includes('وصول شدہ نقد'), 'Urdu cash column prints');
});

test('i18n: every zsheet_* string exists in both dictionaries with matching params', () => {
  const keys = [
    'zsheet_open_btn', 'zsheet_title', 'zsheet_help', 'zsheet_zone_label',
    'zsheet_all_zones', 'zsheet_month_label', 'zsheet_include_waada',
    'zsheet_preview', 'zsheet_preview_empty', 'zsheet_popup_blocked',
    'zsheet_print_a4', 'zsheet_print_thermal', 'zsheet_close',
    'zsheet_col_customer', 'zsheet_col_phone', 'zsheet_col_pole',
    'zsheet_col_arrears', 'zsheet_col_this_month', 'zsheet_col_total',
    'zsheet_col_status', 'zsheet_col_cash', 'zsheet_col_sign',
    'zsheet_zone_total', 'zsheet_grand_total', 'zsheet_generated_on',
    'zsheet_days_overdue', 'zsheet_waada_on', 'zsheet_on_hold',
    'zsheet_sign_lineman', 'zsheet_sign_cash', 'zsheet_sign_owner',
    'zsheet_empty'
  ];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  for (const key of ['zsheet_preview', 'zsheet_generated_on', 'zsheet_days_overdue', 'zsheet_waada_on']) {
    const enParams = TRANSLATIONS.en[key].match(/\{\w+\}/g) || [];
    const urParams = TRANSLATIONS.ur[key].match(/\{\w+\}/g) || [];
    assert.deepEqual(urParams.sort(), enParams.sort(), `${key} params match across languages`);
  }
});

test('wiring: dialog markup, controller and runtime graph are in place', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="zoneSheetDialog"'), 'dialog present');
  assert.ok(html.includes('class="billing-modal zone-sheet-modal"'), 'dialog uses the billing-modal shell (var(--modal-surface))');
  assert.ok(html.includes('id="topDefaultersZoneSheetBtn"'), 'open button present in the Top Defaulters modal');
  assert.ok(html.includes('id="zoneSheetZoneSelect"'), 'zone picker hook present');
  assert.ok(html.includes('id="zoneSheetWaadaToggle"'), 'waada toggle hook present');
  assert.ok(html.includes('id="zoneSheetPreview"'), 'preview hook present');
  assert.ok(html.includes('id="zoneSheetPrintA4Btn"'), 'A4 print hook present');
  assert.ok(html.includes('id="zoneSheetPrintThermalBtn"'), 'thermal print hook present');
  assert.ok(html.includes('data-i18n="zsheet_title"'), 'dialog title translated');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './lineman-sheet-print.js'"), 'app.js imports the module');
  assert.ok(app.includes('setupZoneSheetDialog('), 'app.js wires the controller');

  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.zone-sheet-preview'), 'dialog styles present');
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  assert.equal(open, close, 'components.css braces stay balanced');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('lineman-sheet-print.js'), 'module is reachable in the build runtime graph');
});
