/**
 * owner-5-part-fix.test.js — Owner 5-part fix (2026-11-11): the five
 * parts pinned at the pure-module level.
 * - Charyaa and Chamyaa are SEPARATE mohallas (never folded);
 *   JABBIYAAA is the same mohalla as JABBIYAA (folds).
 * - The Pucho catalogue is twelve clickable chips, not bullets.
 * - Wide analytics tables wrap in a .table-scroll container.
 * - Whole rupees print without .00 decimals, with thousands grouping.
 * - The annual summary lists live (unfrozen) months and badges them.
 * Synthetic data only; no live record is ever changed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalMohalla } from '../phase3.js';
import { PUCHO_QUESTIONS, puchoCatalogueHtml, puchoMohallaLabel } from '../pucho-box.js';
import { buildCustomerRollForward, rollForwardSummaryText, rollForwardTableHtml } from '../balance-rollforward.js';
import { flagsHtml, formatCents } from '../unusual-payment-flags.js';
import { buildAnnualSummary, annualSummaryText, annualSummaryHtml } from '../annual-summary.js';
import { loanHtml } from '../loan-tracker.js';
import { rmaHtml } from '../warranty-returns.js';

test('Part 2: Charyaa and Chamyaa are separate mohallas, never folded', () => {
  const charyaa = canonicalMohalla('Charyaa');
  const chamyaa = canonicalMohalla('Chamyaa');
  assert.notEqual(charyaa.key, chamyaa.key);
  assert.equal(charyaa.key, 'charyaa');
  assert.equal(charyaa.label, 'Charyaa');
  assert.equal(charyaa.stored, 'CHARYAA');
  assert.equal(chamyaa.key, 'chamyaaa');
  assert.equal(chamyaa.label, 'Chamyaaa');
  assert.equal(chamyaa.stored, 'CHAMYAAA');
  for (const variant of ['CHARYAA', 'charyaa', 'MOHALLA CHARYAA']) {
    assert.equal(canonicalMohalla(variant).key, 'charyaa', `${variant} stays Charyaa`);
  }
});

test('Part 2: JABBIYAAA folds to JABBIYAA, one mohalla', () => {
  for (const variant of ['Jabbiyaaa', 'JABBIYAAA', 'jabbiyaaa', 'Jabbiyaa', 'JABBIYAA']) {
    const canon = canonicalMohalla(variant);
    assert.equal(canon.key, 'jabbiyaa', `${variant} keys as jabbiyaa`);
    assert.equal(canon.label, 'Jabbiyaa', `${variant} labels as Jabbiyaa`);
    assert.equal(canon.stored, 'JABBIYAA', `${variant} stores as JABBIYAA`);
  }
  assert.equal(puchoMohallaLabel('JABBIYAAA'), 'Jabbiyaa');
});

test('Part 1: the Pucho catalogue is twelve clickable chips', () => {
  assert.equal(PUCHO_QUESTIONS.length, 12);
  const catalogue = puchoCatalogueHtml();
  assert.ok(!catalogue.includes('<ul>'), 'no static bullet list');
  const chips = catalogue.match(/data-pucho-question="/g) || [];
  assert.equal(chips.length, 12, 'one chip per supported question');
  for (const q of PUCHO_QUESTIONS) {
    assert.ok(catalogue.includes(`data-pucho-question="${q.title.replaceAll("'", '&#39;')}"`), q.title);
  }
  // The visible chip label is the short English part before ' — '.
  assert.ok(catalogue.includes('>Dues by mohalla<') || catalogue.includes('Dues by mohalla'));
});

test('Part 3: wide tables wrap in .table-scroll', () => {
  const row = buildCustomerRollForward({
    customerId: 'c1', customerName: 'Test Alpha', month: '2026-11', opening: 0,
    charges: [{ sourceId: 'bill-2026-11', label: 'Bill Nov', amount: 3000 }],
    payments: [], concessions: [], reportedClosing: 3000,
  });
  assert.ok(rollForwardTableHtml([row]).startsWith('<div class="table-scroll">'));
  const flag = {
    date: '2026-10-19', customerId: 'c1', customerName: 'Test Alpha', mohalla: 'CHARYAA',
    paymentId: 'p1', amountCents: 600000, billId: 'bill-2026-10', billAmountCents: 200000,
    billMonth: '2026-10', channel: 'Cash', reasons: ['over-bill'], reasonText: 'Payment exceeds the bill.',
    reference: '', sameDayCount: 1,
  };
  assert.ok(flagsHtml([flag]).includes('<div class="table-scroll">'));
  assert.ok(flagsHtml([flag]).includes('Charyaa'), 'flag mohalla prints Title Case');
  const loan = loanHtml([{
    id: 'LOAN-001', customerId: 'C-001', customerName: 'Test Alpha', ticketId: 'T-101',
    connectionId: 'CON-7', deviceType: 'onu', loanSerial: 'ONU-LOAN-1', originalSerial: 'ONU-OLD-9',
    dateIssued: '2026-01-05', expectedReturnDate: '2026-01-20', status: 'out', mohalla: 'Bani',
  }]);
  assert.ok(loan.includes('<div class="table-scroll">'));
  const rma = rmaHtml([{
    id: 'RMA-001', serial: 'ONU-111', deviceType: 'onu', supplier: 'Supplier A',
    faultNote: 'No power', rmaReference: 'RMA-9001', dateSent: '2026-01-05', status: 'sent',
  }]);
  assert.ok(rma.includes('<div class="table-scroll">'));
});

test('Part 3: whole rupees print without decimals, null stays not-a-number', () => {
  assert.equal(formatCents(300000), 'Rs. 3,000');
  assert.equal(formatCents(0), 'Rs. 0');
  assert.equal(formatCents(null), '—');
  const row = buildCustomerRollForward({
    customerId: 'c1', customerName: 'Test Alpha', month: '2026-11', opening: 0,
    charges: [{ sourceId: 'bill-2026-11', label: 'Bill Nov', amount: 3000 }],
    payments: [], concessions: [], reportedClosing: 3000,
  });
  assert.ok(!rollForwardSummaryText(row).includes('.00'));
});

test('Part 4: the annual summary badges live months and keeps frozen winning', () => {
  const view = buildAnnualSummary({
    year: '2026',
    months: [
      { month: '2026-10', collections: 10000, expenses: 4000, newCustomers: 2, departed: 1, customersStart: 100, customersEnd: 101, churnRate: 0.01, snapshotClosed: true },
      { month: '2026-11', collections: 5000, expenses: 2000, newCustomers: 1, departed: 0, customersStart: 101, customersEnd: 102, churnRate: 0, snapshotClosed: false, live: true },
    ],
  });
  assert.equal(view.collectionsTotal, 15000);
  assert.deepEqual(view.liveMonths, ['2026-11']);
  assert.equal(view.complete, false);
  assert.match(annualSummaryText(view), /Includes live\/unfrozen months: 2026-11/);
  assert.ok(annualSummaryHtml(view).includes('>Live<'));
  assert.ok(annualSummaryHtml(view).includes('>Frozen<'));
});
