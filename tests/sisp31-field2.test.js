// SISP-31: Field Collection Mode 2.0 — bilingual search + zone "Collected
// Today" counter + 58mm slip wiring. Pure-function tests on synthetic data
// only. Pinned spec criteria (verbatim):
//   - typing an Urdu name (راجہ) or Roman name (Raja) in Field Mode returns
//     the exact same customer card;
//   - collecting a payment updates the zone's "Collected Today" counter
//     immediately.
// The DOM half (receipt-card 58mm button, pill rendering) is asserted by
// tests/e2e/sisp31-field2.spec.mjs in CI; the panel only renders the 58mm
// button when the host supplies onPrint58mm, so it can never be a dead
// button, and the wiring inputs are pinned here via the receipt contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPendingCollectionCustomers, getPakistanLocalDate } from '../nav-quick-collect.js';
import {
  FIELD_MODE_ALL_ZONES,
  fieldModeZoneOf,
  filterFieldModeEntries,
  fieldModeCollectedToday,
  collectFieldModePayment,
  normalizeUrduText
} from '../field-mode.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

// Fixed "today": 2026-10-28 PKT (05:00Z = 10:00 PKT).
const REF_DATE = new Date('2026-10-28T05:00:00.000Z');
const TODAY = getPakistanLocalDate(REF_DATE);

const bill = (month, overrides) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`,
  status: 'pending', payments: [], ...overrides
});
const customer = (id, number, name, overrides) => ({
  id, customerNumber: number, name, archived: false, bills: [], ...overrides
});

const searchState = {
  customers: [
    customer('c1', 11, 'RAJA FAISAL', {
      mohalla: 'Barrian', phone: '+923001234567',
      bills: [bill('2026-09'), bill('2026-10')]
    }),
    customer('c2', 12, 'ALI KHAN', {
      mohalla: 'Shahdara Town', phone: '+923009998877',
      bills: [bill('2026-10')]
    }),
    customer('c3', 13, 'BILAL AHMED', {
      nameUrdu: 'بلال احمد', mohalla: 'Barrian', phone: '+923005554444',
      bills: [bill('2026-10')]
    })
  ]
};

function pendingOf(state) {
  return getPendingCollectionCustomers(state, '', 'all-dues', REF_DATE);
}

function idsFor(state, query) {
  return filterFieldModeEntries(pendingOf(state), state.customers, query).map(e => e.id);
}

test('SISP-31 pinned: Urdu راجہ and Roman Raja return the exact same card', () => {
  assert.deepEqual(idsFor(searchState, 'راجہ'), ['c1']);
  assert.deepEqual(idsFor(searchState, 'Raja'), ['c1']);
  assert.deepEqual(idsFor(searchState, 'RAJA'), ['c1']);
  assert.deepEqual(idsFor(searchState, 'راجہ'), idsFor(searchState, 'Raja'));
});

test('SISP-31 bilingual: saved nameUrdu matches Urdu queries', () => {
  assert.deepEqual(idsFor(searchState, 'بلال'), ['c3']);
  assert.deepEqual(idsFor(searchState, 'احمد'), ['c3']);
  assert.deepEqual(idsFor(searchState, 'BILAL'), ['c3']);
});

test('SISP-31 search: connection number, phone and zone keep working, plus Urdu zones', () => {
  assert.deepEqual(idsFor(searchState, '#11'), ['c1']);
  assert.deepEqual(idsFor(searchState, '11'), ['c1']);
  assert.deepEqual(idsFor(searchState, '3001234567'), ['c1']);
  assert.deepEqual(idsFor(searchState, 'Barrian'), ['c1', 'c3']);
  assert.deepEqual(idsFor(searchState, 'بریاں'), ['c1', 'c3']);
  assert.deepEqual(idsFor(searchState, ''), ['c1', 'c2', 'c3']);
  assert.deepEqual(idsFor(searchState, 'ZZZ NO SUCH NAME'), []);
});

test('SISP-31 Urdu normalization folds keyboard variants and strips diacritics', () => {
  // Arabic Yeh (U+064A) folds to Urdu Yeh (U+06CC).
  assert.equal(normalizeUrduText('علي'), 'علی');
  // Fatha diacritic stripped.
  assert.equal(normalizeUrduText('رَاجہ'), 'راجہ');
  assert.deepEqual(idsFor(searchState, 'رَاجہ'), ['c1']);
});

test('SISP-31 zone Collected Today: houses + cash from today\'s recorded payments only', () => {
  const state = {
    customers: [
      customer('c1', 11, 'RAJA FAISAL', {
        mohalla: 'Barrian',
        bills: [bill('2026-10', { payments: [{ id: 'p1', date: TODAY, amount: 3000, method: 'Cash' }] })]
      }),
      customer('c2', 12, 'ALI KHAN', {
        mohalla: 'Barrian',
        bills: [bill('2026-10', {
          payments: [
            { id: 'p2', date: TODAY, amount: 1500, method: 'Cash' },
            { id: 'p3', date: '2026-10-27', amount: 500, method: 'Cash' }
          ]
        })]
      }),
      customer('c3', 13, 'BILAL AHMED', {
        mohalla: 'Shahdara Town',
        bills: [bill('2026-10', { payments: [{ id: 'p4', date: TODAY, amount: 2000, method: 'Cash' }] })]
      })
    ]
  };
  const barrianKey = fieldModeZoneOf(state.customers[0]).key;
  assert.deepEqual(fieldModeCollectedToday(state, barrianKey, TODAY), { houses: 2, cash: 4500 });
  assert.deepEqual(fieldModeCollectedToday(state, FIELD_MODE_ALL_ZONES, TODAY), { houses: 3, cash: 6500 });
  assert.deepEqual(fieldModeCollectedToday(state, barrianKey, '2026-10-27'), { houses: 1, cash: 500 });
});

test('SISP-31 pinned: collecting a payment updates the zone counter immediately', () => {
  const state = {
    customers: [
      customer('c1', 11, 'RAJA FAISAL', {
        mohalla: 'Barrian', phone: '+923001234567',
        bills: [bill('2026-09'), bill('2026-10')]
      })
    ]
  };
  const barrianKey = fieldModeZoneOf(state.customers[0]).key;
  assert.deepEqual(fieldModeCollectedToday(state, barrianKey, TODAY), { houses: 0, cash: 0 });
  const entry = pendingOf(state).find(e => e.id === 'c1');
  assert.equal(entry.totalDues, 6000);
  const { nextState, receipt } = collectFieldModePayment(state, entry, 'Cash', REF_DATE);
  // Receipt contract the 58mm print wiring depends on.
  assert.equal(receipt.customerId, 'c1');
  assert.equal(receipt.month, '2026-09');
  assert.equal(typeof receipt.paymentId, 'string');
  assert.notEqual(receipt.paymentId, '');
  assert.deepEqual(fieldModeCollectedToday(nextState, barrianKey, TODAY), { houses: 1, cash: 6000 });
});

test('SISP-31 wiring: 58mm button + pill exist, use theme tokens, no hardcoded colors', () => {
  const fieldModeSrc = read('field-mode.js');
  assert.match(fieldModeSrc, /data-field-action="print58"/);
  assert.match(fieldModeSrc, /onPrint58mm/);
  const appSrc = read('app.js');
  assert.ok(appSrc.includes(
    "onPrint58mm: (receipt) => printPaymentReceipt(receipt.customerId, receipt.month, receipt.paymentId, { format: 'thermal-58' })"
  ), 'app.js must wire the field-mode 58mm button to the existing thermal-58 path');
  const css = read('components.css');
  const pillStart = css.indexOf('.field-mode-collected-pill');
  assert.ok(pillStart >= 0, 'components.css must define the collected pill');
  const pillBlock = css.slice(pillStart, css.indexOf('}', pillStart));
  assert.match(pillBlock, /var\(--/);
  assert.doesNotMatch(pillBlock, /#[0-9a-fA-F]{3,8}\b/, 'pill must use theme tokens, never hardcoded colors');
  assert.ok(!css.includes('field-mode-collected-pill') || pillBlock.includes('var(--surface)'));
});
