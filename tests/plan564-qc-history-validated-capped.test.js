/**
 * plan564-qc-history-validated-capped.test.js — Plan 564: Quick Collect
 * history rows are validated and capped at three.
 *
 * formatQuickCollectWhatsAppReceipt (nav-quick-collect.js, history block)
 * maps receipt.previousPayments with no validation and no slice, so a
 * malformed row reaches a customer-facing WhatsApp message: a bad date
 * prints verbatim, a non-numeric amount prints "PKR —" (Plan 555's
 * formatReceiptMoneyFigure renders non-finite as "—"), and a 4+ row
 * history prints in full. createReceiptWhatsAppDraft (profile-ui.js)
 * filters rows to valid calendar dates and finite amounts and slices
 * to 3. This plan applies the same validation and cap to the QC block.
 *
 * Pins (synthetic data only; the +92 300 123 4567 number is the
 * pattern-fake every draft test uses, never a real number):
 *  - BEHAVIOUR (fail on the pristine base, pass after the fix): a
 *    malformed history row (bad date / impossible calendar date /
 *    non-numeric amount) is omitted; a history of 4 valid rows prints
 *    only the first 3; malformed rows do not consume the 3-row cap.
 *  - PIN (pass before and after): a valid 3-row history prints
 *    unchanged (same lines, same order, same heading); no history
 *    block when previousPayments is absent or empty; a valid-date
 *    zero-amount row still prints (the profile predicate passes it
 *    too — Number.isFinite(0) — so parity keeps it); a row with only
 *    date + amount prints those two parts. (Date-format fix: the
 *    history dates now print DD/MM/YYYY — "18/09/2026" — while the
 *    rows, order, heading and amounts are unchanged; the pins below
 *    were updated to the new date shape with this note.)
 *  - SCOPE: nav-quick-collect.js history block only. No change to
 *    buildReceiptPaymentHistory (already validates + caps at 3) or to
 *    the profile draft.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatQuickCollectWhatsAppReceipt } from '../nav-quick-collect.js';

// Quick Collect fixture: a plain receipt with no other money lines, so
// the history block is the only variable part of the draft.
const QC_BASE_564 = {
  receiptNumber: 'RCPT-564', date: '2026-11-07', customerName: 'Synthetic Customer', customerNumber: 42,
  phone: '03001234567', area: 'Test Area', month: 'November 2026', amount: 1195, method: 'Cash',
  newTotalDues: 0
};

const qcText = (previousPayments) => formatQuickCollectWhatsAppReceipt(
  { ...QC_BASE_564, previousPayments }
).text;

const row = (date, amount, method = 'Cash', receiptLabel = 'RCPT-001') => ({ date, amount, method, receiptLabel });

const HISTORY_HEADING = '📜 *Last 3 Payments / پچھلی 3 ادائیگیاں:*';

/* ---------------- BEHAVIOUR: malformed rows are omitted ---------------- */

test('plan564: QC draft omits a history row with a bad date', () => {
  const text = qcText([row('not-a-date', 1000, 'Cash', 'RCPT-001')]);
  assert.ok(!text.includes('RCPT-001'), text);
  assert.ok(!text.includes('not-a-date'), text);
  assert.ok(!text.includes('Last 3 Payments'), text);
});

test('plan564: QC draft omits a history row with an impossible calendar date', () => {
  // 2026-02-30 matches the YYYY-MM-DD shape but is not a real date —
  // the profile predicate rejects it via the UTC round-trip check.
  const text = qcText([row('2026-02-30', 1000, 'Cash', 'RCPT-001')]);
  assert.ok(!text.includes('RCPT-001'), text);
  assert.ok(!text.includes('2026-02-30'), text);
  assert.ok(!text.includes('Last 3 Payments'), text);
});

test('plan564: QC draft omits a history row with a non-numeric amount', () => {
  const text = qcText([row('2026-09-18', 'abc', 'Cash', 'RCPT-002')]);
  assert.ok(!text.includes('RCPT-002'), text);
  assert.ok(!text.includes('PKR —'), text);
  assert.ok(!text.includes('Last 3 Payments'), text);
});

test('plan564: QC draft omits a history row with a missing date', () => {
  const text = qcText([{ amount: 1000, method: 'Cash', receiptLabel: 'RCPT-003' }]);
  assert.ok(!text.includes('RCPT-003'), text);
  assert.ok(!text.includes('Last 3 Payments'), text);
});

test('plan564: QC draft omits a history row with an undefined amount', () => {
  const text = qcText([row('2026-09-18', undefined, 'Cash', 'RCPT-004')]);
  assert.ok(!text.includes('RCPT-004'), text);
  assert.ok(!text.includes('Last 3 Payments'), text);
});

test('plan564: QC draft omits a history row with an infinite amount', () => {
  const text = qcText([row('2026-09-18', Infinity, 'Cash', 'RCPT-005')]);
  assert.ok(!text.includes('RCPT-005'), text);
  assert.ok(!text.includes('Last 3 Payments'), text);
});

/* ---------------- BEHAVIOUR: capped at three ---------------- */

test('plan564: QC draft prints only the first 3 of 4 valid history rows', () => {
  const text = qcText([
    row('2026-09-18', 3000, 'Cash', 'RCPT-A'),
    row('2026-09-02', 3000, 'EasyPaisa', 'RCPT-B'),
    row('2026-08-20', 2500, 'Cash', 'RCPT-C'),
    row('2026-08-03', 1000, 'Cash', 'RCPT-D')
  ]);
  assert.ok(text.includes('RCPT-A'), text);
  assert.ok(text.includes('RCPT-B'), text);
  assert.ok(text.includes('RCPT-C'), text);
  assert.ok(!text.includes('RCPT-D'), text);
});

test('plan564: malformed rows do not consume the 3-row cap', () => {
  const text = qcText([
    row('not-a-date', 1000, 'Cash', 'RCPT-BAD'),
    row('2026-09-18', 3000, 'Cash', 'RCPT-A'),
    row('2026-09-02', 3000, 'EasyPaisa', 'RCPT-B'),
    row('2026-08-20', 2500, 'Cash', 'RCPT-C'),
    row('2026-08-03', 1000, 'Cash', 'RCPT-D')
  ]);
  assert.ok(!text.includes('RCPT-BAD'), text);
  assert.ok(text.includes('RCPT-A'), text);
  assert.ok(text.includes('RCPT-B'), text);
  assert.ok(text.includes('RCPT-C'), text);
  assert.ok(!text.includes('RCPT-D'), text);
});

/* ---------------- PIN: valid history prints unchanged ---------------- */

test('plan564: a valid 3-row QC history prints unchanged', () => {
  const text = qcText([
    row('2026-09-18', 3000, 'Cash', 'RCPT-001'),
    row('2026-09-02', 3000, 'EasyPaisa', 'RCPT-002'),
    row('2026-08-20', 2500, 'Cash', 'RCPT-003')
  ]);
  assert.ok(text.includes(HISTORY_HEADING), text);
  // Date-format fix: history dates print DD/MM/YYYY now — the rows,
  // order, heading and amounts are unchanged.
  assert.ok(text.includes('• 18/09/2026 · PKR 3,000 · Cash · RCPT-001'), text);
  assert.ok(text.includes('• 02/09/2026 · PKR 3,000 · EasyPaisa · RCPT-002'), text);
  assert.ok(text.includes('• 20/08/2026 · PKR 2,500 · Cash · RCPT-003'), text);
  assert.ok(
    text.indexOf('RCPT-001') < text.indexOf('RCPT-002')
    && text.indexOf('RCPT-002') < text.indexOf('RCPT-003'),
    text
  );
});

test('plan564: no history block when previousPayments is absent or empty', () => {
  assert.ok(!formatQuickCollectWhatsAppReceipt({ ...QC_BASE_564 }).text.includes('Last 3 Payments'));
  assert.ok(!qcText([]).includes('Last 3 Payments'));
});

test('plan564: a valid-date zero-amount row still prints (profile parity)', () => {
  // Number.isFinite(0) is true, so the profile predicate passes a
  // zero-amount row too — the QC block must match, not invent a > 0
  // rule of its own. (The same coercion passes a null amount as 0;
  // that is the shared predicate's behaviour on both drafts, not a
  // QC-only gap, so no test pins null either way.)
  const text = qcText([row('2026-09-18', 0, 'Cash', 'RCPT-ZERO')]);
  // Date-format fix: the date prints DD/MM/YYYY now.
  assert.ok(text.includes('• 18/09/2026 · PKR 0 · Cash · RCPT-ZERO'), text);
});

test('plan564: a row with only date and amount prints those two parts', () => {
  const text = qcText([{ date: '2026-09-18', amount: 1500 }]);
  // Date-format fix: the date prints DD/MM/YYYY now.
  assert.ok(text.includes('• 18/09/2026 · PKR 1,500'), text);
});
