// Sharafat 51: a voided receipt's Bluetooth slip gets a prominent VOID
// stamp at the top of the receipt body; a live slip is byte-identical.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildPaymentReceipt } from '../receipt.js';
import {
  buildEscPosReceipt,
  escPosFieldsFromPaymentReceipt,
  THERMAL_WIDTH_CHARS
} from '../thermal-printer.js';

// Same fixture shape as the Sharafat 51 prep repro: one bill, one
// payment; the voided payment settles nothing (balanceDueCents 200000).
const fixture = ({ dueAmount = 2000, payments = [], month = '2026-08' } = {}) => {
  const bill = { id: `bill-${month}`, month, dueAmount, status: 'pending', payments };
  const customer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '5 Mbps', packageHistory: [], bills: [bill] };
  return { customer, bill };
};
const livePayment = { id: 'p-live', amount: 2000, date: '2026-08-07', method: 'Cash' };
const voidedPayment = { id: 'p-void', amount: 2000, date: '2026-08-07', method: 'Cash', voided: true, voidReason: 'wrong amount' };

const slipFor = (payment) => {
  const { customer, bill } = fixture({ payments: [payment] });
  const receipt = buildPaymentReceipt(customer, bill, payment);
  const fields = escPosFieldsFromPaymentReceipt(receipt, { businessName: 'Shahdara ISP', businessPhone: '0300-1234567' });
  return { receipt, fields, slip: buildEscPosReceipt(fields) };
};

const VOID_BLOCK = ['*** VOID ***', 'THIS PAYMENT WAS VOIDED'];
// The block lines, never a bare includes('VOID'): a voided slip already
// contains VOID inside its derived receipt number (REC-2608-0042-VOID),
// so a substring check would pass on unfixed code.
const hasVoidBlock = (lines) => {
  const trimmed = lines.map((l) => l.trim());
  const first = trimmed.indexOf(VOID_BLOCK[0]);
  return first !== -1 && trimmed[first + 1] === VOID_BLOCK[1];
};

test('Sharafat 51: voided slip carries the VOID block at the top', () => {
  const { receipt, slip } = slipFor(voidedPayment);
  assert.equal(receipt.status, 'VOID');
  assert.ok(hasVoidBlock(slip.lines), 'no VOID block in:\n' + slip.text);
  // Right after the first divider, before the title (D4).
  const firstDivider = slip.lines.indexOf('-'.repeat(THERMAL_WIDTH_CHARS));
  assert.equal(slip.lines[firstDivider + 1].trim(), '*** VOID ***');
  assert.equal(slip.lines[firstDivider + 2].trim(), 'THIS PAYMENT WAS VOIDED');
  assert.equal(slip.lines[firstDivider + 3], '-'.repeat(THERMAL_WIDTH_CHARS));
  assert.equal(slip.lines[firstDivider + 4].trim(), 'PAYMENT RECEIPT');
});

test('Sharafat 51: voided slip keeps the Status row, title and AMOUNT PAID (stamp-only)', () => {
  const { slip } = slipFor(voidedPayment);
  assert.ok(slip.lines.some((l) => l.startsWith('Status') && l.trimEnd().endsWith('VOID')), 'Status VOID row missing');
  assert.ok(slip.lines.some((l) => l.trim() === 'PAYMENT RECEIPT'), 'title missing');
  assert.ok(slip.lines.some((l) => l.startsWith('AMOUNT PAID') && l.endsWith('PKR 2,000')), 'AMOUNT PAID row missing');
  assert.ok(slip.lines.some((l) => l.startsWith('Balance due') && l.endsWith('PKR 2,000')), 'Balance due row missing');
});

test('Sharafat 51: live slip is byte-identical to the recorded baseline', () => {
  const { receipt, slip } = slipFor(livePayment);
  assert.equal(receipt.status, 'PAID');
  assert.ok(!hasVoidBlock(slip.lines), 'live slip must not carry the VOID block');
  // Plan 575 (D2(a)): re-pinned — the ordinary slip gains ONLY the
  // Area + VER rows (Area: Not recorded after Package, Verify last),
  // so the hash + byte count change by decision, not by accident.
  // Previous baseline 6add4e80… / 749 bytes (pre-575).
  assert.equal(
    createHash('sha256').update(slip.text).digest('hex'),
    '6714362273cbc7bfd9804f82cafc2f9d84a679e359bb4fc0f092a4ac54520754'
  );
  assert.equal(slip.bytes.length, 815);
});

test('Sharafat 51: every voided-slip line fits the 32-char roll and the block is ASCII-only', () => {
  const { slip } = slipFor(voidedPayment);
  for (const line of slip.lines) assert.ok(line.length <= THERMAL_WIDTH_CHARS, `line too wide (${line.length}): ${line}`);
  for (const blockLine of VOID_BLOCK) {
    assert.ok([...blockLine].every((c) => c.charCodeAt(0) < 128), `block line not ASCII: ${blockLine}`);
    assert.ok(blockLine.length <= THERMAL_WIDTH_CHARS, `block line too wide: ${blockLine}`);
  }
});

test('Sharafat 51: the VOID block survives into the printed byte stream', () => {
  const { slip } = slipFor(voidedPayment);
  // The byte stream prints the business name separately and takes the
  // body as lines.slice(headerLines) — a block at line 0 would be
  // sliced away; after the first divider it must reach the printer.
  const decoded = new TextDecoder().decode(slip.bytes);
  assert.ok(decoded.includes('*** VOID ***'), 'block missing from bytes');
  assert.ok(decoded.includes('THIS PAYMENT WAS VOIDED'), 'block second line missing from bytes');
  assert.ok(decoded.includes('PAYMENT RECEIPT'));
});

test('Sharafat 51: test slip and non-void statuses get no VOID block', () => {
  const testSlip = buildEscPosReceipt({ businessName: 'Shahdara ISP', businessPhone: '0300-1234567', statusLabel: 'TEST SLIP', amount: 'PKR 5' });
  assert.ok(!hasVoidBlock(testSlip.lines), 'test slip must not stamp');
  const partialSlip = buildEscPosReceipt({ businessName: 'Shahdara ISP', businessPhone: '0300-1234567', statusLabel: 'PARTIAL', amount: 'PKR 5' });
  assert.ok(!hasVoidBlock(partialSlip.lines), 'PARTIAL slip must not stamp');
  const paidSlip = buildEscPosReceipt({ businessName: 'Shahdara ISP', businessPhone: '0300-1234567', statusLabel: 'PAID', amount: 'PKR 5' });
  assert.ok(!hasVoidBlock(paidSlip.lines), 'PAID slip must not stamp');
});
