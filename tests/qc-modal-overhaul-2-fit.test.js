// QC Modal Overhaul 2 — fit test: the picker list and the form step
// are measured by the Chromium harness
// (~/workspace/shahdara-qc-receipt-modal-harness/, gen-overhaul2.mjs
// + run-overhaul2.mjs), NOT by a static model. The harness is the
// authority for the true heights; this file pins the structure, the
// CSS values, and the list math that produce them, and RECORDS the
// measured totals.
//
// Measured (harness, 0 pageerrors, chromium-headless-shell):
//   Picker 360x640 (Quick Collect CSS tightening, qc-tighten
//     shell): cards 151.5px (chips row — badge + High-balance tag
//     on their own 24px row) / 118px (plain — no chips row); list
//     clientH 460px (cap 460); 2 fully visible + a third 85%
//     visible (was ~53%) — the list shows 3.03 all-badged / 3.90
//     all-plain cards per 460px, so the "2 cards on screen" goal
//     is met in the list viewport (2 full + most of a third).
//     cardOverX 0, listOverX 0. The honest saving is 19.1px per
//     badged card (170.6 -> 151.5) and 4px per plain card
//     (122 -> 118) — NOT the ~40–45px the prep estimated and NOT
//     the user's ~85px. The modal card itself still scrolls to
//     bring the list into view (the picker chrome above the list
//     is ~578px: header + sort + search + pills + mohalla +
//     Recent toggle + banner), so "on screen" means in the list
//     viewport, not in the first viewport.
//   Picker 390x844: same card heights; 2 full + a third partial.
//     cardOverX 0. Today + Round share the banner's first row at
//     this width; the button is on row 2.
//   Picker 320x640: cards 250.6px (badged) / 214.6px (plain) —
//     the figures wrap to Row 2 AND the action row wraps to two
//     rows (the wrap valve, not a clip); 1 full + a second
//     partial. cardOverX 0, listOverX 0; 100-card render: no
//     overlap, no horizontal overflow.
//   Banner: 86.4px tall at 360px with a day target set (was
//     96.4px) — three rows: Today alone, Round + Day Summary,
//     the progress track below them. The single-row bar is NOT
//     met at 360px: the three cells need ~442px against 294px of
//     banner content width (314px minus 20px padding), and the
//     figures must never be truncated — recorded, not blessed
//     (PR #1337 precedent). With the user's shorter values
//     (Today: PKR 30,800 · Round: 0) Today + Round do share row
//     1; the button still wraps. The track sits below the row
//     items now (order 4), never above them as it did before.
//   Form 360x640: cardScrollH 1,312px vs cardClientH 589px — 723px
//     OVER the one-screen budget. Recorded, not blessed (PR #1337
//     precedent). The form has seven sections (back row, 140px
//     customer header incl. package/tax line, 62px collapsed
//     accordion, 331px amount group, date + method + shop ~277px,
//     62px collapsed details, sticky Review button) — no
//     rearrangement of the same sections fits 589px; reaching one
//     screen would need hiding whole sections behind accordions, a
//     product decision this PR does not take. The Review button is
//     sticky-bottom (pre-existing #281/#279), so the save CTA is
//     always on screen even while the form scrolls; the flow is
//     ~2.2 screens, down from the ~4 the base spec measured.
//   Form 390x844: cardScrollH 1,292px vs cardClientH 776px — 516px
//     OVER. Recorded, not blessed.
//   The harness shells use representative (not real-rendered) banner
//   text and a static-filled form; the numbers are the shells'
//   measurements, not a live-app trace.
//   The form numbers above are carried over from the Overhaul-2
//   measurement (this PR does not touch the form step — its
//   chrome is the modal header only, unchanged — so they stand).
//
//   QC True 1-Row Tightening (item A, user instruction 2026-11-14,
//     harness gen-1row-a.mjs, 0 pageerrors, chromium-headless-shell):
//     Picker 360x640 short case: topTotal 432px (was 639.4px —
//     saving 207.4px); tiles 44px (was 103px); filter row 46px
//     (Sort + Mohalla bare selects, was 66px); Search-to-Recent
//     gap 8px (was 44px); pills 96px, 2 rows with the 4th Paid pill
//     (was 46px, +50px disclosed); banner 38px, ONE row (was
//     70.4px — the three cells fit at 0.8rem: 78.8 + 71.6 + 129.3
//     = 279.7 vs 292); cards 143.5px badged / 110px plain (was
//     151.5 / 118); list clientH 460px (cap 460); 3 FULLY visible
//     (was 2) — the 3-cards gate is met (3 x 143.5 + 2 x 8 =
//     446.5 <= 460). cardOverX 0, listOverX 0, dialogOverX 0;
//     100-card render: no overlap, no horizontal overflow.
//     Action row: Call 67 / Map 71.4 / Collect 121.6 x 38px, one
//     row. Long case 360x640: topTotal 471.2px (was 655.4px,
//     saving 184.2px); banner 77.2px, 3 rows — the long case is
//     NEVER one row (cells 419.5 vs 292), the wrap valve stays.
//     Picker 320x640 short: topTotal 455.2px (was 706.4px, saving
//     251.2px); banner 61.2px, 2 rows (the button drops, no
//     overflow — the short case does not fit one row at 320px);
//     action row one row via the 6px gap (Call 67 / Map 71.4 /
//     Collect 85.6 x 38px); 3 fully visible (was 1). Long 320:
//     topTotal 494.4px (was 746.8px, saving 252.4px); banner
//     100.4px. Chips: the 3-chip case (High priority + ≥2k +
//     2+ mos arrears) fits one line at 360px (badge 87.6 + 36 +
//     99.2, row 24px, card 143.5px) and wraps to 2 rows at 320px
//     (card 173.5px) — no crush, no overflow at either width;
//     the 4-chip case (+ 90+ days overdue) wraps to 2 rows at
//     both widths (card 173.5px), no crush. The scrolled-bottom
//     clip check: title y stays 30 (header y 17 h 48) with the
//     toggle margin-top at 0, so the 8px clip clearance is gone.
//     The modal card itself still scrolls (cardScrollH 1004px
//     short / 1043px long at 360px vs clientH 589px) — "3 cards
//     on screen" means in the list viewport, not the first
//     viewport; the top chrome is now ~432px, not ~578px.
// Pattern-fake data only: Customer A–F, RCPT-12-202611-01.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getPendingCollectionCustomers,
  renderQuickCollectCustomerListHtml,
} from '../nav-quick-collect.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const navSrc = read('nav.css');
const pageSrc = read('index.html');

// --- Picker geometry ---

test('picker: the list cap is 460px — the 2.5–3 card viewport', () => {
  const at = stylesSrc.indexOf('.qc-customer-list {');
  assert.ok(at > -1, 'the list rule must exist');
  const rule = stylesSrc.slice(at, stylesSrc.indexOf('}', at) + 1);
  assert.ok(rule.includes('max-height: 460px;'), 'the cap must be 460px');
  assert.ok(rule.includes('overflow-y: auto;'), 'the list keeps its own scroll area');
});

test('picker: the figures sit inline on Row 1 — no full-width KPI row in the modal', () => {
  // QC Modal Overhaul 2: the QC Cash Modal Overhaul's full-width
  // figures row is reversed — it cost a whole row per card and the
  // "2.5–3 on screen" target cannot be met with it. The name and
  // subtitle ellipsis, the figure is nowrap, and the button wraps,
  // so the figure is never squeezed (see the why-comment on the
  // rule itself).
  assert.ok(stylesSrc.includes('#quickCollectModal .qc3-figures {'), 'the modal figures rule must exist');
  const at = stylesSrc.indexOf('#quickCollectModal .qc3-figures {');
  const rule = stylesSrc.slice(at, stylesSrc.indexOf('}', at) + 1);
  assert.ok(rule.includes('flex: 0 0 auto;'), 'the figures must be inline, not full-width');
  assert.ok(!rule.includes('flex: 0 0 100%'), 'the full-width KPI row must be gone');
  assert.ok(stylesSrc.includes('#quickCollectModal .qc3-card-main > .qc-card-left {'), 'the identity flex rule must exist');
  const leftAt = stylesSrc.indexOf('#quickCollectModal .qc3-card-main > .qc-card-left {');
  const leftRule = stylesSrc.slice(leftAt, stylesSrc.indexOf('}', leftAt) + 1);
  assert.ok(leftRule.includes('flex: 1 1 0;'), 'the identity column must take the leftover width');
  // QC True 1-Row Tightening (item A, parent decision D-A2): the
  // floor drops 140px -> 100px — the chips row took the badges, so
  // a short name needs less room.
  assert.ok(leftRule.includes('min-width: 100px;'), 'the identity column must keep a short name visible at the 100px floor');
});

test('picker: the dues badge is the only figure — no Monthly column survives', () => {
  assert.ok(!pageSrc.includes('qc3_monthly_package'), 'no Monthly label may remain in the page');
  // The rule selector (with its brace) must be gone; the string
  // still appears in the why-comment that records the deletion.
  assert.ok(!stylesSrc.includes('.qc3-package-val {'), 'no Monthly value rule may remain');
});

// --- Form fit (recorded overage) ---

test('form: the Review button is sticky-bottom — the save CTA never scrolls away', () => {
  // Pre-existing Quick Collect Form Polish (#281/#279), not this
  // overhaul — recorded here because it is what makes the recorded
  // overage usable: the operator never scrolls to find Save.
  const at = navSrc.indexOf('.qc-form-actions {');
  assert.ok(at > -1, 'the sticky actions rule must exist');
  const rule = navSrc.slice(at, navSrc.indexOf('}', at) + 1);
  assert.ok(rule.includes('position: sticky;'), 'the actions must stick');
  assert.ok(rule.includes('bottom: 0;'), 'the actions must stick to the bottom');
});

test('form: the one-screen budget is recorded as OVER — 1,312px vs 589px at 360x640', () => {
  // PR #1337 precedent: a measured overage is RECORDED, not waived
  // and not hidden. The form step measures cardScrollH 1,312px
  // against a 589px card at 360x640 (+723px) and 1,292px against
  // 776px at 390x844 (+516px). The numbers live in this file's
  // header comment (harness authority); this test pins that the
  // overage is disclosed, so a later reader cannot mistake the
  // step for fitting. The step is ~2.2 screens, down from the ~4
  // the base spec measured — progress, not the target.
  const header = readFileSync(new URL(import.meta.url), 'utf8').slice(0, 4000);
  assert.ok(header.includes('1,312px vs cardClientH 589px'), 'the 360x640 overage must be recorded');
  assert.ok(header.includes('1,292px vs cardClientH 776px'), 'the 390x844 overage must be recorded');
  assert.ok(header.includes('Recorded, not blessed'), 'the overage must be marked as recorded, not blessed');
});

// --- Rebase: Sharafat 18 free-bill dues in the compact cards ---

const REF = new Date(2026, 10, 6, 12);
const bill = (month, dueAmount, extra = {}) => ({
  id: `bill-${month}`, month, dueAmount, dueDate: `${month}-05`, status: 'pending',
  payments: [], generated: true, priceSnapshot: dueAmount,
  createdAt: '2026-09-01T00:00:00.000Z', amountHistory: [], ...extra,
});
const cust = (id, number, name, bills) => ({
  id, customerNumber: number, name, phone: '03012345678', area: 'Mohalla A',
  archived: false, billingStartMonth: null, bills,
});

test('rebase: a flagged free bill still renders its dues correctly in the compact cards', () => {
  // Sharafat 18: isZeroPriced bills count as PRICED. The overhaul
  // only removes the Monthly column and the amount from Collect —
  // the dues badge still reads the engine total, so a free bill
  // contributes 0 and never erases other dues.
  const state = {
    customers: [
      cust('c1', 11, 'Free Only', [bill('2026-11', 0, { isZeroPriced: true })]),
      cust('c2', 12, 'Free Plus Due', [bill('2026-10', 2000), bill('2026-11', 0, { isZeroPriced: true })]),
      cust('c3', 13, 'Plain Due', [bill('2026-11', 3000)]),
    ],
    settings: {},
  };
  const pool = getPendingCollectionCustomers(state, '', 'all', REF);
  const byId = new Map(pool.map((p) => [p.id, p]));
  assert.equal(byId.get('c1').totalDues, 0, 'a free-only customer owes nothing');
  assert.equal(byId.get('c2').totalDues, 2000, 'a free bill never erases other dues');
  assert.equal(byId.get('c3').totalDues, 3000, 'a plain due is untouched');
  const html = renderQuickCollectCustomerListHtml(pool);
  assert.ok(html.includes('PKR 2,000'), 'the free-plus-due card shows the real dues badge');
  assert.ok(html.includes('SETTLED'), 'the free-only card shows settled');
  assert.ok(!html.includes('qc3_monthly_package'), 'no Monthly column in the compact card');
  assert.ok(!/Collect PKR/.test(html), 'Collect never repeats the amount');
});
