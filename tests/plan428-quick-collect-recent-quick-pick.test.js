// Plan 428 — Quick Collect recent customers quick-pick: the last
// ten customers collected from, latest first, with name, mohalla,
// and dues — one tap fills the customer on the payment screen. The
// row picks only and records nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RECENT_QUICK_PICK_MAX,
  RECENT_QUICK_PICK_UNASSIGNED_TEXT,
  isStrictRecentQuickPickDate,
  recentQuickPickMohalla,
  finiteRecentQuickPickCents,
  formatRecentQuickPickAmount,
  recentQuickPickEntries,
  recentQuickPickDuesText,
  recentQuickPickLineText,
  recentQuickPickHtml,
} from '../recent-quick-pick.js';

function customers() {
  const list = [];
  for (let n = 1; n <= 12; n += 1) {
    list.push({
      id: `CUST-${n}`,
      name: `Customer ${n}`,
      customerNumber: n,
      mohalla: n % 2 === 0 ? 'Mohalla Bani' : 'Mohalla Dhok',
    });
  }
  return list;
}

function payment(customerId, date, extra = {}) {
  return {
    customerId,
    date,
    recordedAt: '',
    paymentId: `PAY-${customerId}-${date}`,
    voided: false,
    ...extra,
  };
}

function duesCentsById(pairs) {
  const map = {};
  for (const [id, cents] of pairs) map[id] = cents;
  return map;
}

test('the row lists at most ten customers', () => {
  assert.equal(RECENT_QUICK_PICK_MAX, 10);
  const rows = customers().map((c, i) => payment(c.id, `2026-11-${String(i + 1).padStart(2, '0')}`));
  const entries = recentQuickPickEntries(customers(), rows, duesCentsById([]));
  assert.equal(entries.length, 10);
});

test('the row lists the last ten collected-from, latest first', () => {
  const rows = [
    payment('CUST-1', '2026-11-01'),
    payment('CUST-2', '2026-11-03'),
    payment('CUST-3', '2026-11-02'),
  ];
  const entries = recentQuickPickEntries(customers(), rows, duesCentsById([]));
  assert.deepEqual(entries.map((e) => e.id), ['CUST-2', 'CUST-3', 'CUST-1']);
  assert.deepEqual(entries.map((e) => e.lastCollectedDate), ['2026-11-03', '2026-11-02', '2026-11-01']);
});

test('the same customer appears once, on their latest collection', () => {
  const rows = [
    payment('CUST-1', '2026-11-01'),
    payment('CUST-2', '2026-11-02'),
    payment('CUST-1', '2026-11-05'),
    payment('CUST-1', '2026-11-03'),
  ];
  const entries = recentQuickPickEntries(customers(), rows, duesCentsById([]));
  assert.deepEqual(entries.map((e) => e.id), ['CUST-1', 'CUST-2']);
  assert.equal(entries[0].lastCollectedDate, '2026-11-05');
});

test('a same-day later recording wins the latest spot', () => {
  const rows = [
    payment('CUST-1', '2026-11-05', { recordedAt: '2026-11-05T09:00:00', paymentId: 'PAY-A' }),
    payment('CUST-2', '2026-11-05', { recordedAt: '2026-11-05T08:00:00', paymentId: 'PAY-B' }),
  ];
  const entries = recentQuickPickEntries(customers(), rows, duesCentsById([]));
  assert.deepEqual(entries.map((e) => e.id), ['CUST-1', 'CUST-2']);
  assert.equal(entries[0].lastCollectedRecordedAt, '2026-11-05T09:00:00');
});

test('a voided payment never counts as collected-from', () => {
  const rows = [
    payment('CUST-1', '2026-11-05', { voided: true }),
    payment('CUST-1', '2026-11-01'),
    payment('CUST-2', '2026-11-02'),
  ];
  const entries = recentQuickPickEntries(customers(), rows, duesCentsById([]));
  assert.deepEqual(entries.map((e) => e.id), ['CUST-2', 'CUST-1']);
  assert.equal(entries[1].lastCollectedDate, '2026-11-01');
});

test('a customer whose only payment is voided never appears', () => {
  const rows = [payment('CUST-1', '2026-11-05', { voided: true })];
  assert.deepEqual(recentQuickPickEntries(customers(), rows, duesCentsById([])), []);
});

test('a payment with no usable date never places its customer', () => {
  const rows = [
    payment('CUST-1', ''),
    payment('CUST-1', '2026-13-01'),
    payment('CUST-1', '2026-02-30'),
    payment('CUST-1', null),
    payment('CUST-2', '2026-11-02'),
  ];
  const entries = recentQuickPickEntries(customers(), rows, duesCentsById([]));
  assert.deepEqual(entries.map((e) => e.id), ['CUST-2']);
});

test('a payment with no customer never places anyone', () => {
  const rows = [
    payment('', '2026-11-05'),
    payment(null, '2026-11-05'),
    payment('CUST-2', '2026-11-02'),
  ];
  const entries = recentQuickPickEntries(customers(), rows, duesCentsById([]));
  assert.deepEqual(entries.map((e) => e.id), ['CUST-2']);
});

test('a collected-from customer with no live record never appears', () => {
  const rows = [
    payment('CUST-99', '2026-11-05'),
    payment('CUST-2', '2026-11-02'),
  ];
  const entries = recentQuickPickEntries(customers(), rows, duesCentsById([]));
  assert.deepEqual(entries.map((e) => e.id), ['CUST-2']);
});

test('an archived customer never appears on the row', () => {
  const list = customers();
  list[0].archived = true;
  const rows = [
    payment('CUST-1', '2026-11-05'),
    payment('CUST-2', '2026-11-02'),
  ];
  const entries = recentQuickPickEntries(list, rows, duesCentsById([]));
  assert.deepEqual(entries.map((e) => e.id), ['CUST-2']);
});

test('a customer with no usable name never appears', () => {
  const list = customers();
  list[0].name = '   ';
  const rows = [
    payment('CUST-1', '2026-11-05'),
    payment('CUST-2', '2026-11-02'),
  ];
  const entries = recentQuickPickEntries(list, rows, duesCentsById([]));
  assert.deepEqual(entries.map((e) => e.id), ['CUST-2']);
});

test('the entry carries name, mohalla, and dues', () => {
  const rows = [payment('CUST-2', '2026-11-03')];
  const entries = recentQuickPickEntries(
    customers(),
    rows,
    duesCentsById([['CUST-2', 300000]]),
  );
  assert.deepEqual(entries, [{
    id: 'CUST-2',
    customerNumber: 2,
    name: 'Customer 2',
    mohalla: 'Mohalla Bani',
    duesCents: 300000,
    lastCollectedDate: '2026-11-03',
    lastCollectedRecordedAt: '',
  }]);
});

test('dues come from the caller, never guessed', () => {
  const rows = [payment('CUST-2', '2026-11-03')];
  const entries = recentQuickPickEntries(customers(), rows, duesCentsById([]));
  assert.equal(entries[0].duesCents, null);
  assert.equal(recentQuickPickDuesText(entries[0]), 'Dues not recorded');
});

test('a dues map works as well as a plain object', () => {
  const rows = [payment('CUST-2', '2026-11-03')];
  const entries = recentQuickPickEntries(
    customers(),
    rows,
    new Map([['CUST-2', 150050]]),
  );
  assert.equal(entries[0].duesCents, 150050);
  assert.equal(formatRecentQuickPickAmount(entries[0].duesCents), 'PKR 1,500.5');
});

test('a missing or broken dues figure is not a number, never zero', () => {
  assert.equal(finiteRecentQuickPickCents(null), null);
  assert.equal(finiteRecentQuickPickCents(undefined), null);
  assert.equal(finiteRecentQuickPickCents(''), null);
  assert.equal(finiteRecentQuickPickCents(true), null);
  assert.equal(finiteRecentQuickPickCents(Number.NaN), null);
  assert.equal(formatRecentQuickPickAmount(null), null);
  assert.equal(formatRecentQuickPickAmount(true), null);
  const rows = [payment('CUST-2', '2026-11-03')];
  const entries = recentQuickPickEntries(
    customers(),
    rows,
    duesCentsById([['CUST-2', true]]),
  );
  assert.equal(entries[0].duesCents, null);
});

test('a negative dues figure reads as settled, never negative', () => {
  const rows = [payment('CUST-2', '2026-11-03')];
  const entries = recentQuickPickEntries(
    customers(),
    rows,
    duesCentsById([['CUST-2', -500]]),
  );
  assert.equal(entries[0].duesCents, 0);
  assert.equal(recentQuickPickDuesText(entries[0]), 'PKR 0 · Settled');
});

test('the amount formatter uses min-0 decimals', () => {
  assert.equal(formatRecentQuickPickAmount(300000), 'PKR 3,000');
  assert.equal(formatRecentQuickPickAmount(150050), 'PKR 1,500.5');
  assert.equal(formatRecentQuickPickAmount(50), 'PKR 0.5');
  assert.equal(formatRecentQuickPickAmount(0), 'PKR 0');
});

test('the dues line reads settled at zero and due above zero', () => {
  assert.equal(recentQuickPickDuesText({ duesCents: 300000 }), 'PKR 3,000 · Due');
  assert.equal(recentQuickPickDuesText({ duesCents: 0 }), 'PKR 0 · Settled');
  assert.equal(recentQuickPickDuesText({ duesCents: null }), 'Dues not recorded');
  assert.equal(recentQuickPickDuesText(null), 'Dues not recorded');
});

test('the line text names the customer, mohalla, and dues', () => {
  const entry = {
    name: 'Customer 2', mohalla: 'Mohalla Bani', duesCents: 300000,
  };
  assert.equal(
    recentQuickPickLineText(entry),
    'Customer 2 — Mohalla Bani · PKR 3,000 · Due',
  );
  assert.equal(recentQuickPickLineText(null), '');
});

test('mohalla falls back to area, then to Unassigned', () => {
  assert.equal(RECENT_QUICK_PICK_UNASSIGNED_TEXT, 'Unassigned');
  assert.equal(recentQuickPickMohalla({ mohalla: 'Mohalla Bani' }), 'Mohalla Bani');
  assert.equal(recentQuickPickMohalla({ area: 'Mohalla Old' }), 'Mohalla Old');
  assert.equal(recentQuickPickMohalla({}), 'Unassigned');
  assert.equal(recentQuickPickMohalla({ mohalla: '  ', area: ' ' }), 'Unassigned');
  assert.equal(recentQuickPickMohalla(null), 'Unassigned');
});

test('strict dates are leap-aware', () => {
  assert.equal(isStrictRecentQuickPickDate('2026-11-07'), true);
  assert.equal(isStrictRecentQuickPickDate('2000-02-29'), true);
  assert.equal(isStrictRecentQuickPickDate('2026-02-29'), false);
  assert.equal(isStrictRecentQuickPickDate('2026-04-31'), false);
  assert.equal(isStrictRecentQuickPickDate('2026-13-01'), false);
  assert.equal(isStrictRecentQuickPickDate('2026-11-7'), false);
  assert.equal(isStrictRecentQuickPickDate(''), false);
  assert.equal(isStrictRecentQuickPickDate(null), false);
  assert.equal(isStrictRecentQuickPickDate(20261107), false);
});

test('the order never depends on the order the rows arrive in', () => {
  const rows = [
    payment('CUST-1', '2026-11-01'),
    payment('CUST-2', '2026-11-03'),
    payment('CUST-3', '2026-11-02'),
  ];
  const forward = recentQuickPickEntries(customers(), rows, duesCentsById([]));
  const backward = recentQuickPickEntries(customers(), [...rows].reverse(), duesCentsById([]));
  assert.deepEqual(
    forward.map((e) => e.id),
    backward.map((e) => e.id),
  );
});

test('inputs are never mutated', () => {
  const list = customers();
  const rows = [payment('CUST-1', '2026-11-01'), payment('CUST-2', '2026-11-03')];
  const dues = duesCentsById([['CUST-1', 100000]]);
  for (const item of [...list, ...rows, dues]) Object.freeze(item);
  Object.freeze(list);
  Object.freeze(rows);
  Object.freeze(dues);
  const entries = recentQuickPickEntries(list, rows, dues);
  assert.deepEqual(entries.map((e) => e.id), ['CUST-2', 'CUST-1']);
});

test('no entries renders nothing at all', () => {
  assert.equal(recentQuickPickHtml([]), '');
  assert.equal(recentQuickPickHtml(null), '');
  assert.equal(recentQuickPickHtml(undefined), '');
  assert.equal(recentQuickPickHtml(recentQuickPickEntries(customers(), [], {})), '');
});

test('a row carries the customer id, name, mohalla, and dues', () => {
  const entries = recentQuickPickEntries(
    customers(),
    [payment('CUST-2', '2026-11-03')],
    duesCentsById([['CUST-2', 300000]]),
  );
  const html = recentQuickPickHtml(entries);
  // QC Cash Modal Overhaul: Recent is an accordion now — the header
  // line is a one-line summary toggle ("Recent: N collected (latest:
  // #N Name) ▾") with the rows hidden until tapped, so the nine
  // expanded cards no longer sit above the unpaid queue.
  assert.match(html, /rqp-toggle/);
  assert.match(html, /Recent: 1 collected \(latest: #2 Customer 2\)/);
  assert.match(html, /rqp-rows" hidden/);
  assert.match(html, /rqp-row/);
  assert.match(html, /data-customer-id="CUST-2"/);
  assert.match(html, /Customer 2/);
  assert.match(html, /Mohalla Bani/);
  assert.match(html, /PKR 3,000 · Due/);
  // QC Cash Modal Overhaul: the right-side timestamp is a compact
  // "3 Nov" badge now, not the full "Collected 2026-11-03" line.
  assert.match(html, /rqp-date-badge">3 Nov</);
  assert.doesNotMatch(html, /Collected 2026-11-03/);
  assert.match(html, /qc-customer-card/);
});

test('row text is escaped, never raw markup', () => {
  const list = [{ id: 'CUST-1', name: 'A <script>alert(1)</script>', customerNumber: 1, mohalla: 'Mohalla "Bani"' }];
  const entries = recentQuickPickEntries(
    list,
    [payment('CUST-1', '2026-11-03')],
    duesCentsById([['CUST-1', 100000]]),
  );
  const html = recentQuickPickHtml(entries);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Mohalla &quot;Bani&quot;/);
});

test('a missing customer number renders no number chip', () => {
  const list = [{ id: 'CUST-1', name: 'Customer 1', mohalla: 'Mohalla Bani' }];
  const entries = recentQuickPickEntries(
    list,
    [payment('CUST-1', '2026-11-03')],
    duesCentsById([]),
  );
  assert.equal(entries[0].customerNumber, null);
  assert.doesNotMatch(recentQuickPickHtml(entries), /qc-cust-num/);
});

// The module is pure: no page, no store, no clock, no network.
test('the module is pure and keeps no store', () => {
  const source = readFileSync(new URL('../recent-quick-pick.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /new Date\(/);
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /window\./);
  assert.doesNotMatch(source, /shahdara_/);
  assert.doesNotMatch(source, /^import /m);
});

// The module header never names a fenced module's filename literally
// (each name below is built from fragments so the test itself does
// not carry the literal either).
test('the module header names no fenced filename literally', () => {
  const source = readFileSync(new URL('../recent-quick-pick.js', import.meta.url), 'utf8');
  const fenced = [
    ['nav', '-', 'quick', '-', 'collect', '.', 'js'].join(''),
    ['quick', '-', 'collect', '-', 'one', '-', 'screen', '.', 'js'].join(''),
    ['name', '-', 'prefix', '-', 'lookup', '.', 'js'].join(''),
    ['recently', '-', 'viewed', '-', 'customers', '.', 'js'].join(''),
    ['full', '-', 'history', '-', 'list', '.', 'js'].join(''),
    ['daily', '-', 'entry', '-', 'summary', '.', 'js'].join(''),
    ['recent', '-', 'payments', '.', 'js'].join(''),
  ];
  for (const name of fenced) {
    assert.doesNotMatch(source, new RegExp(name.replace('.', '\\.')));
  }
});

// Wiring: the quick-pick row lives on the Quick Collect pick step,
// driven by the payment records, and tapping a row opens the payment
// form exactly the way a picker card does.
test('wiring: the controller imports the quick-pick module', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(wiring, /recent-quick-pick\.js/);
  assert.match(wiring, /recentQuickPickEntries/);
  assert.match(wiring, /recentQuickPickHtml/);
});

test('wiring: the pick step renders the quick-pick row on every list render', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(wiring, /rqpRecentQuickPick/);
  assert.match(wiring, /renderRecentQuickPick/);
  const start = wiring.indexOf('function renderList()');
  assert.notEqual(start, -1);
  // QC-4 lengthened renderList with the mohalla-counts refresh, so
  // the window is 1200 — the intent is unchanged: the quick-pick
  // row still renders on every list render.
  const block = wiring.slice(start, start + 1200);
  assert.match(block, /renderRecentQuickPick\(\)/);
});

test('wiring: the row is built from the payment records and the picker dues', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const start = wiring.indexOf('function renderRecentQuickPick()');
  assert.notEqual(start, -1);
  const block = wiring.slice(start, start + 1200);
  assert.match(block, /recentQuickPickEntries\(/);
  assert.match(block, /listTransactions\(state\)/);
  assert.match(block, /getPendingCollectionCustomers\(state, '', 'all'\)/);
});

test('wiring: tapping a quick-pick row opens the customer payment form', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const start = wiring.indexOf("recentQuickPickList?.addEventListener('click'");
  assert.notEqual(start, -1);
  const block = wiring.slice(start, start + 800);
  assert.match(block, /rqp-row/);
  assert.match(block, /openCustomerCollectionForm\(/);
});

test('wiring: the quick-pick host sits on the pick step, after the lookup list', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const pickStep = page.indexOf('id="quickCollectStepPick"');
  const lookup = page.indexOf('id="nplNamePrefixList"');
  const host = page.indexOf('id="rqpRecentQuickPick"');
  const list = page.indexOf('id="quickCollectCustomerList"');
  assert.notEqual(pickStep, -1);
  assert.notEqual(lookup, -1);
  assert.notEqual(host, -1);
  assert.notEqual(list, -1);
  assert.ok(pickStep < lookup && lookup < host && host < list);
});

test('the rqp element-id prefix is used by this plan only', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((page.match(/id="rqp/g) || []).length, 1);
});
