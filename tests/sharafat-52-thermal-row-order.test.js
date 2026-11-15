// Sharafat 52 — Thermal-58 and thermal-80 list the same charges in the
// same order.
//
// On thermal-58 the "Total Gross Payable" / "Total Payable" rows printed
// BEFORE the ticket/addon/baqaya rows, while on thermal-80 they printed
// AFTER them — so the same receipt showed its totals in different places
// on the two roll widths, and on 58mm the gross total sat above charges
// that are not inside it (gross PKR 1,195 = bill 1,000 + tax 195; the
// charges total PKR 1,000 and sit outside it). The fix moves the two
// total lines in the thermal-58 branch below the three charge-helper
// calls, matching thermal-80. It is a pure reorder: no label, figure,
// helper or condition moves, and the gross/net figures are identical on
// all three layouts.
//
// Scope, decided by the parent (prep §1):
//   * The comparison covers ONLY the five-row charges+totals
//     subsequence — the layouts' FULL label sequences differ by design
//     (Date vs Payment Date, Cust ID vs Customer ID, Billed vs Monthly
//     Fee, PAID vs Amount Received, Balance vs Balance Due, Status vs
//     Receipt Status, and the discount row is labelled differently),
//     so a whole-receipt comparison fails on correct code.
//   * A4 keeps the totals-first region order (D1(a)) — disclosed, not
//     fixed here. The A4 test below pins that deliberate residual.
//   * The fixture MUST use the real charge-id shapes (TKT-101 /
//     BST-101 / MBQ-101): the charge sanitizers silently drop malformed
//     ids, so a fixture with bare ids prints no charge rows and the
//     order assertion would pass vacuously on unfixed code. The first
//     test asserts the charge rows EXIST on both layouts before any
//     order is asserted.
// No real customer names are used anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';

const EXPECTED_REGION = [
  'Murammat',
  'Speed Boost',
  'Manual Baqaya',
  'Gross',
  'Net',
];

function fixture() {
  const bill = { id: 'bill-2026-08', month: '2026-08', dueAmount: 1000, status: 'pending', payments: [] };
  bill.salesTaxCents = 19500;
  const customer = {
    id: 'plan52-customer', customerNumber: 101, name: 'Plan52 Customer',
    packageSpeed: '5 Mbps', packageHistory: [], bills: [bill],
  };
  const payment = {
    id: 'plan52-paid', amount: 1195, date: '2026-08-10', method: 'Cash',
    discount: 100, discountReason: 'Goodwill',
    ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }],
    addonCharges: [{ boostId: 'BST-101', amount: 300 }],
    manualBaqayaSettlements: [{ entryId: 'MBQ-101', amount: 200 }],
  };
  return buildPaymentReceipt(customer, bill, payment);
}

const labels = (html) =>
  [...html.matchAll(/<dt>(.*?)<\/dt>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));

// The five-row charges+totals region, in document order. Anything else
// on the receipt is out of scope for this item (see the header comment).
const region = (html) => labels(html).map((label) => {
  if (label.startsWith('Total Gross Payable')) return 'Gross';
  if (label.startsWith('Total Payable')) return 'Net';
  if (label.startsWith('Murammat')) return 'Murammat';
  if (label.startsWith('Speed Boost')) return 'Speed Boost';
  if (label.startsWith('Manual Baqaya')) return 'Manual Baqaya';
  return null;
}).filter(Boolean);

test('the three charge rows exist on both thermal layouts (anti-vacuous guard)', () => {
  const receipt = fixture();
  assert.equal(receipt.totalBilled, 1195, 'gross is bill 1,000 + tax 195');
  for (const format of ['thermal-58', 'thermal-80']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes('Murammat / Material Charge (TKT-101)'), `${format}: ticket row present`);
    assert.ok(html.includes('Speed Boost / سپیڈ بوسٹ (BST-101)'), `${format}: addon row present`);
    assert.ok(html.includes('Manual Baqaya / دستی بقایا (MBQ-101)'), `${format}: baqaya row present`);
  }
});

test('thermal-58 lists charges first, then gross, then net', () => {
  const receipt = fixture();
  const html = generatePaymentReceiptHtml(receipt, { format: 'thermal-58' });
  assert.deepEqual(region(html), EXPECTED_REGION);
});

test('thermal-80 lists charges first, then gross, then net — the same region as thermal-58', () => {
  const receipt = fixture();
  const html58 = generatePaymentReceiptHtml(receipt, { format: 'thermal-58' });
  const html80 = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
  assert.deepEqual(region(html80), EXPECTED_REGION);
  assert.deepEqual(region(html58), region(html80), 'the two thermal layouts agree');
});

test('the gross and net figures are unchanged on both thermal layouts', () => {
  const receipt = fixture();
  for (const format of ['thermal-58', 'thermal-80']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(
      html.includes('<dt>Total Gross Payable / کل واجب الادا (gross):</dt><dd>PKR 1,195</dd>'),
      `${format}: gross is PKR 1,195`,
    );
    assert.ok(
      html.includes('<dt>Total Payable / کل واجب الادا:</dt><dd>PKR 1,095</dd>'),
      `${format}: net is PKR 1,095 (gross minus the PKR 100 discount)`,
    );
  }
});

test('A4 keeps the totals-first region order (D1(a) scope decision, disclosed not fixed)', () => {
  const receipt = fixture();
  const html = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.deepEqual(region(html), ['Gross', 'Net', 'Murammat', 'Speed Boost', 'Manual Baqaya']);
});
