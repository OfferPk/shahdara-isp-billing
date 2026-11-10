// QC success-card month name — the card shows the bill month's full
// name ("Month: November"), derived from receipt.month (the bill month
// being paid), never the device clock. A payment for October recorded
// in November carries month "2026-10" and must read October.
// Pattern-fake data only: Test Customer, RCPT-12-202611-01.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderQuickCollectReceiptCardHtml,
  formatQuickCollectWhatsAppReceipt,
} from '../nav-quick-collect.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const quickCollectSrc = read('nav-quick-collect.js');
const complaintSrc = read('monthly-complaint-report.js');

function receipt(overrides = {}) {
  return {
    id: 'receipt-12',
    receiptNumber: 'RCPT-12-202611-01',
    amount: 1000,
    customerName: 'Test Customer',
    customerNumber: 12,
    date: '2026-11-08',
    month: '2026-11',
    method: 'Cash',
    area: 'Sodaa',
    payableRemaining: 0,
    newTotalDues: 0,
    ...overrides,
  };
}

// The Month row in rendered card HTML, or null when the card has none.
function monthRowOf(html) {
  const at = html.indexOf('>Month<');
  if (at < 0) return null;
  const rowStart = html.lastIndexOf('<div class="qc-receipt-item', at);
  const rowEnd = html.indexOf('</div>', at);
  return html.slice(rowStart, rowEnd);
}

async function monthNameOf(month) {
  const mod = await import('../monthly-complaint-report.js');
  assert.equal(typeof mod.monthName, 'function', 'monthName must be exported from monthly-complaint-report.js');
  return mod.monthName(month);
}

test('monthName: bare full name for every valid month', async () => {
  assert.equal(await monthNameOf('2026-01'), 'January');
  assert.equal(await monthNameOf('2026-02'), 'February');
  assert.equal(await monthNameOf('2026-03'), 'March');
  assert.equal(await monthNameOf('2026-04'), 'April');
  assert.equal(await monthNameOf('2026-05'), 'May');
  assert.equal(await monthNameOf('2026-06'), 'June');
  assert.equal(await monthNameOf('2026-07'), 'July');
  assert.equal(await monthNameOf('2026-08'), 'August');
  assert.equal(await monthNameOf('2026-09'), 'September');
  assert.equal(await monthNameOf('2026-10'), 'October');
  assert.equal(await monthNameOf('2026-11'), 'November');
  assert.equal(await monthNameOf('2026-12'), 'December');
});

test('monthName: missing or invalid month reads empty, never a guess', async () => {
  for (const bad of ['', undefined, null, '2026-13', '2026-00', '2026-1', 'Nov 2026', '2026/11', '2026-11-08']) {
    assert.equal(await monthNameOf(bad), '', `monthName(${JSON.stringify(bad)}) must be ''`);
  }
});

test('monthName: monthLabel is unchanged (still "November 2026")', async () => {
  const mod = await import('../monthly-complaint-report.js');
  assert.equal(mod.monthLabel('2026-11'), 'November 2026', 'monthLabel must keep its "Month Year" shape');
  assert.equal(mod.monthLabel('2026-10'), 'October 2026');
});

test('card: a November bill shows Month / November after Date & Method', () => {
  const html = renderQuickCollectReceiptCardHtml(receipt());
  const row = monthRowOf(html);
  assert.ok(row, 'card must carry a Month row for a 2026-11 bill');
  assert.ok(row.includes('>November<'), 'Month row must read November');
  assert.ok(!row.includes('full-width'), 'Month row must be a half-width grid item, not a full-width row');
  const dateMethod = html.indexOf('Date &amp; Method');
  const month = html.indexOf('>Month<');
  const area = html.indexOf('Area / Location');
  assert.ok(dateMethod >= 0 && month > dateMethod, 'Month row must sit after Date & Method');
  assert.ok(area > month, 'Month row must sit before Area / Location');
  assert.ok(!html.includes('2026-11'), 'card must not print the raw YYYY-MM anywhere once the name renders');
});

test('card: an October bill recorded in November reads October, not the device month', () => {
  const html = renderQuickCollectReceiptCardHtml(receipt({ month: '2026-10' }));
  const row = monthRowOf(html);
  assert.ok(row, 'card must carry a Month row for a 2026-10 bill');
  assert.ok(row.includes('>October<'), 'Month row must read October — the bill month, not the device month');
  assert.ok(!html.includes('>November<'), 'no November anywhere on an October bill card');
  assert.ok(!html.includes('2026-10'), 'card must not print the raw YYYY-MM');
});

test('card: missing or invalid month renders NO Month row, never blank or raw', () => {
  const missing = receipt();
  delete missing.month;
  assert.equal(monthRowOf(renderQuickCollectReceiptCardHtml(missing)), null, 'no Month row without a month');
  assert.ok(!renderQuickCollectReceiptCardHtml(missing).includes('>Month<'), 'no Month label at all without a month');
  for (const bad of ['2026-13', '2026-00', '', 'Nov 2026']) {
    const html = renderQuickCollectReceiptCardHtml(receipt({ month: bad }));
    assert.equal(monthRowOf(html), null, `no Month row for month ${JSON.stringify(bad)}`);
    // ('' is a substring of everything, so the raw-value check only
    // applies to non-empty bad values.)
    if (bad) assert.ok(!html.includes(bad), `card must not print the raw month ${JSON.stringify(bad)}`);
  }
});

test('card: the Month row never leaks the device month when the bill month is valid', () => {
  // The device clock is November 2026 at authoring time; a December
  // bill must still read December, never November.
  const html = renderQuickCollectReceiptCardHtml(receipt({ month: '2026-12' }));
  assert.ok(monthRowOf(html).includes('>December<'), 'December bill reads December');
  assert.ok(!html.includes('>November<'), 'no device-month November on a December bill card');
});

test('wiring: monthName is a MONTH_NAMES sibling export; the card imports and guards on it', () => {
  // MONTH_NAMES stays module-local (never exported); monthName reuses
  // it, next to monthLabel, and never reaches for toLocaleString.
  assert.ok(complaintSrc.includes('export function monthName(month)'), 'monthName must be an export next to monthLabel');
  assert.ok(!complaintSrc.includes('export const MONTH_NAMES') && !complaintSrc.includes('export { MONTH_NAMES'), 'MONTH_NAMES must stay module-local');
  const fnStart = complaintSrc.indexOf('export function monthName(month)');
  const fnEnd = complaintSrc.indexOf('\n}\n', fnStart);
  const fnSrc = complaintSrc.slice(fnStart, fnEnd);
  assert.ok(fnSrc.includes('MONTH_NAMES'), 'monthName must reuse the deterministic MONTH_NAMES list');
  assert.ok(!fnSrc.includes('toLocaleString'), 'monthName must not use toLocaleString (deterministic list matches the codebase pattern)');
  assert.ok(quickCollectSrc.includes("import { monthLabel, monthName } from './monthly-complaint-report.js';"), 'nav-quick-collect.js must import monthName alongside monthLabel');
  const cardStart = quickCollectSrc.indexOf('export function renderQuickCollectReceiptCardHtml');
  const cardEnd = quickCollectSrc.indexOf('export function quickCollectShopChoices');
  const cardSrc = quickCollectSrc.slice(cardStart, cardEnd);
  assert.ok(cardSrc.includes('monthName(receipt.month)'), 'the card builder must read the bill month through monthName');
  assert.ok(!cardSrc.includes("toLocaleString('en', { month"), 'the card builder must not format the month with toLocaleString');
});

test('scope: the draft keeps the raw billing month; the split card is untouched', () => {
  const draft = formatQuickCollectWhatsAppReceipt(receipt()).text;
  assert.ok(draft.includes('2026-11'), 'draft must keep the raw YYYY-MM billing month');
  assert.ok(!draft.includes('>November<') && !draft.includes('Month: November'), 'draft must not gain the card-only Month name');
  const splitSrc = read('split-tender-collect.js');
  assert.ok(!splitSrc.includes('monthName'), 'the split card must not gain a month row in this fix');
});
