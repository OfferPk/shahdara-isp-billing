// Plan 425 — History data quality flags per customer:
// one quality flag per history entry that is missing its method, its
// reference, or its date, flagged in plain words and listed on a
// per-customer quality view. It flags only and fixes nothing: every
// incomplete entry is flagged, every complete entry is not, and the
// flags never change any bill, payment, error log, or customer
// record by themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_DATA_QUALITY_FIELDS,
  HISTORY_DATA_QUALITY_COMPLETE_TEXT,
  historyDataQualityMissing,
  historyDataQualityMissingText,
  historyDataQualityFlag,
  historyDataQualityFlags,
  historyDataQualitySummaryText,
  historyDataQualityEntryLineText,
  historyDataQualityViewHtml,
} from '../history-data-quality-flags.js';
import {
  fullHistoryEntries,
} from '../full-history-list.js';

function entry(overrides = {}) {
  return {
    type: 'payment',
    date: '2026-11-07',
    month: '2026-11',
    amountCents: 100000,
    runningBalanceCents: 0,
    note: '',
    method: 'Cash',
    ref: 'PAY-1',
    voided: false,
    ...overrides,
  };
}

// --- Which fields count as missing ---

test('a payment with no method is flagged for its method', () => {
  assert.deepEqual(historyDataQualityMissing(entry({ method: '' })), ['method']);
});

test('a payment with a blank-only method is flagged for its method', () => {
  assert.deepEqual(historyDataQualityMissing(entry({ method: '   ' })), ['method']);
});

test('a payment with a method is not flagged for it', () => {
  assert.deepEqual(historyDataQualityMissing(entry({ method: 'Cash' })), []);
});

test('a bill is never flagged for a method — it never carries one', () => {
  assert.deepEqual(historyDataQualityMissing(entry({ type: 'charge', method: '' })), []);
});

test('a credit entry is never flagged for a method — it never carries one', () => {
  assert.deepEqual(historyDataQualityMissing(entry({ type: 'credit', method: '' })), []);
});

test('an advance, a refund and an adjustment with no method are flagged for it', () => {
  assert.deepEqual(historyDataQualityMissing(entry({ type: 'advance', method: '' })), ['method']);
  assert.deepEqual(historyDataQualityMissing(entry({ type: 'refund', method: '' })), ['method']);
  assert.deepEqual(historyDataQualityMissing(entry({ type: 'adjustment', method: '' })), ['method']);
});

test('an entry with no reference is flagged for its reference', () => {
  assert.deepEqual(historyDataQualityMissing(entry({ ref: '' })), ['reference']);
  assert.deepEqual(historyDataQualityMissing(entry({ ref: '   ' })), ['reference']);
});

test('an entry with a reference is not flagged for it', () => {
  assert.deepEqual(historyDataQualityMissing(entry({ ref: 'PAY-1' })), []);
});

test('an entry with no date is flagged for its date', () => {
  assert.deepEqual(historyDataQualityMissing(entry({ date: '' })), ['date']);
});

test('a month-only date counts as a date, not a missing date', () => {
  assert.deepEqual(historyDataQualityMissing(entry({ date: '2026-10' })), []);
});

test('all three missing fields come back in fixed order', () => {
  assert.deepEqual(
    historyDataQualityMissing(entry({ method: '', ref: '', date: '' })),
    ['method', 'reference', 'date'],
  );
});

test('a non-entry is never flagged', () => {
  assert.deepEqual(historyDataQualityMissing(null), []);
  assert.deepEqual(historyDataQualityMissing('PAY-1'), []);
  assert.deepEqual(historyDataQualityMissing(42), []);
});

// --- Plain-words missing text ---

test('missing text names each missing field in plain words', () => {
  assert.equal(historyDataQualityMissingText([]), '');
  assert.equal(historyDataQualityMissingText(['method']), 'Missing method');
  assert.equal(historyDataQualityMissingText(['method', 'date']), 'Missing method and date');
  assert.equal(
    historyDataQualityMissingText(['method', 'reference', 'date']),
    'Missing method, reference and date',
  );
});

test('missing text ignores fields outside the known three', () => {
  assert.equal(historyDataQualityMissingText(['method', 'bogus']), 'Missing method');
  assert.equal(historyDataQualityMissingText('method'), '');
});

// --- One flag per entry ---

test('a complete entry carries no flag', () => {
  assert.equal(historyDataQualityFlag(entry()), null);
});

test('an incomplete entry carries a flag with its own identity', () => {
  const flag = historyDataQualityFlag(entry({ method: '', ref: 'PAY-7', date: '2026-10-06', amountCents: 300000 }));
  assert.deepEqual(flag, {
    type: 'payment',
    date: '2026-10-06',
    amountCents: 300000,
    ref: 'PAY-7',
    missing: ['method'],
    text: 'Missing method',
  });
});

test('a flag trims the reference it carries', () => {
  const flag = historyDataQualityFlag(entry({ method: '', ref: '  PAY-7  ' }));
  assert.equal(flag.ref, 'PAY-7');
});

test('a flag never reads a missing amount as zero', () => {
  assert.equal(historyDataQualityFlag(entry({ method: '', amountCents: null })).amountCents, null);
  assert.equal(historyDataQualityFlag(entry({ method: '', amountCents: undefined })).amountCents, null);
  assert.equal(historyDataQualityFlag(entry({ method: '', amountCents: '' })).amountCents, null);
  assert.equal(historyDataQualityFlag(entry({ method: '', amountCents: true })).amountCents, null);
  assert.equal(historyDataQualityFlag(entry({ method: '', amountCents: '100000' })).amountCents, 100000);
});

test('flags keep entry order and skip complete entries', () => {
  const flags = historyDataQualityFlags([
    entry({ ref: 'PAY-1' }),
    entry({ ref: 'PAY-2', method: '' }),
    entry({ ref: 'PAY-3' }),
    entry({ ref: 'PAY-4', date: '' }),
  ]);
  assert.deepEqual(flags.map((flag) => flag.ref), ['PAY-2', 'PAY-4']);
  assert.deepEqual(historyDataQualityFlags('not a list'), []);
});

// --- Summary text ---

test('summary is empty with no history to check', () => {
  assert.equal(historyDataQualitySummaryText([]), '');
  assert.equal(historyDataQualitySummaryText(null), '');
});

test('summary says plainly when every entry is whole', () => {
  assert.equal(historyDataQualitySummaryText([entry(), entry({ ref: 'PAY-2' })]), HISTORY_DATA_QUALITY_COMPLETE_TEXT);
  assert.equal(historyDataQualitySummaryText([entry(), entry({ ref: 'PAY-2' })]), 'All entries complete');
});

test('summary counts incomplete entries, singular and plural', () => {
  const oneOfFour = [entry(), entry({ ref: 'PAY-2' }), entry({ ref: 'PAY-3' }), entry({ ref: 'PAY-4', method: '' })];
  assert.equal(historyDataQualitySummaryText(oneOfFour), '1 of 4 entries incomplete');
  const threeOfSeven = [
    entry({ ref: 'PAY-1', method: '' }),
    entry({ ref: 'PAY-2' }),
    entry({ ref: 'PAY-3', date: '' }),
    entry({ ref: 'PAY-4' }),
    entry({ ref: 'PAY-5' }),
    entry({ ref: 'PAY-6', ref: '' }),
    entry({ ref: 'PAY-7' }),
  ];
  assert.equal(historyDataQualitySummaryText(threeOfSeven), '3 of 7 entries incomplete');
});

// --- One flagged entry as a line ---

test('a flagged entry line reads date, type, amount and what is missing', () => {
  const flag = historyDataQualityFlag(entry({ method: '', date: '2026-10-06', amountCents: 300000, ref: 'PAY-7' }));
  assert.equal(
    historyDataQualityEntryLineText(flag),
    '2026-10-06 · Payment · PKR 3,000 · Missing method',
  );
});

test('a flagged entry line never guesses a missing date or amount', () => {
  const flag = historyDataQualityFlag(entry({ method: '', date: '', amountCents: null }));
  assert.equal(
    historyDataQualityEntryLineText(flag),
    'date not recorded · Payment · amount not recorded · Missing method and date',
  );
});

test('a flagged entry line prints paisa amounts with one decimal', () => {
  const flag = historyDataQualityFlag(entry({ method: '', amountCents: 150050 }));
  assert.ok(historyDataQualityEntryLineText(flag).includes('PKR 1,500.5'));
});

test('a non-flag renders no line', () => {
  assert.equal(historyDataQualityEntryLineText(null), '');
  assert.equal(historyDataQualityEntryLineText('PAY-1'), '');
});

// --- The per-customer quality view ---

test('the quality view is empty with no history to check', () => {
  assert.equal(historyDataQualityViewHtml([]), '');
  assert.equal(historyDataQualityViewHtml(null), '');
});

test('the quality view says plainly when every entry is whole, with no table', () => {
  const html = historyDataQualityViewHtml([entry(), entry({ ref: 'PAY-2' })]);
  assert.ok(html.includes('All entries complete'));
  assert.ok(!html.includes('<table'), 'no table when nothing is flagged');
});

test('the quality view lists every flagged entry with what is missing', () => {
  const html = historyDataQualityViewHtml([
    entry({ ref: 'PAY-1', method: '' }),
    entry({ ref: 'PAY-2' }),
    entry({ ref: 'PAY-3', date: '', ref: '' }),
  ]);
  assert.ok(html.includes('2 of 3 entries incomplete'));
  assert.ok(html.includes('<th>Date</th>'), 'date column');
  assert.ok(html.includes('<th>Entry</th>'), 'entry column');
  assert.ok(html.includes('<th>Amount</th>'), 'amount column');
  assert.ok(html.includes('<th>Reference</th>'), 'reference column');
  assert.ok(html.includes('<th>Missing</th>'), 'missing column');
  assert.ok(html.includes('Missing method'), 'first flagged entry');
  assert.ok(html.includes('Missing reference and date'), 'second flagged entry');
  assert.ok(!html.includes('PAY-2'), 'a complete entry is never listed');
});

test('the quality view escapes user-entered text', () => {
  const html = historyDataQualityViewHtml([entry({ method: '', ref: '<b>REF</b>' })]);
  assert.ok(html.includes('&lt;b&gt;REF&lt;/b&gt;'), 'reference escaped');
  assert.ok(!html.includes('<b>REF</b>'), 'no raw markup from the reference');
});

test('the quality view draws from the full entries, never a filtered view', () => {
  const full = [
    entry({ ref: 'PAY-1', method: '' }),
    entry({ ref: 'PAY-2' }),
    entry({ ref: 'PAY-3', date: '' }),
  ];
  const shown = [entry({ ref: 'PAY-2' })];
  const html = historyDataQualityViewHtml(full);
  assert.ok(html.includes('PAY-1'), 'flagged entry listed even when a filter hides it');
  assert.ok(html.includes('PAY-3'), 'second flagged entry listed');
  assert.ok(!historyDataQualityViewHtml(shown).includes('PAY-1'), 'the filtered view alone has nothing to flag');
});

// --- Acceptance: the real history composer ---

test('acceptance: every incomplete entry is flagged and every complete entry is not', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: [
      {
        id: '',
        month: '',
        dueAmount: 1000,
        payments: [
          { id: '', date: '', method: '', amount: 1000 },
          { id: 'PAY-9', date: '2026-11-07', method: 'Cash', amount: 500 },
        ],
      },
      { id: 'BILL-2', month: '2026-10', dueAmount: 2000, payments: [] },
    ],
    creditEntries: [
      { customerId: 'CUST-1', id: 'CR-1', date: '', amountCents: 50000, source: 'overpayment', note: '' },
    ],
    refundRecords: [
      { customerId: 'CUST-1', id: 'REF-1', refundDate: '', amountCents: 30000, method: '', reason: 'overcharge' },
    ],
  });
  assert.equal(entries.length, 6, 'six history entries on the fixture');
  const flags = historyDataQualityFlags(entries);
  assert.deepEqual(
    flags.map((flag) => flag.missing),
    [
      ['reference', 'date'],
      ['method', 'reference', 'date'],
      ['date'],
      ['method', 'date'],
    ],
    'bill flagged for reference and date only, payment for all three, credit for date only, refund for method and date',
  );
  assert.equal(historyDataQualitySummaryText(entries), '4 of 6 entries incomplete');
});

test('acceptance: the quality view lists the flagged entries and never the complete ones', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: [
      {
        id: '',
        month: '',
        dueAmount: 1000,
        payments: [
          { id: '', date: '', method: '', amount: 1000 },
          { id: 'PAY-9', date: '2026-11-07', method: 'Cash', amount: 500 },
        ],
      },
      { id: 'BILL-2', month: '2026-10', dueAmount: 2000, payments: [] },
    ],
    creditEntries: [
      { customerId: 'CUST-1', id: 'CR-1', date: '', amountCents: 50000, source: 'overpayment', note: '' },
    ],
    refundRecords: [
      { customerId: 'CUST-1', id: 'REF-1', refundDate: '', amountCents: 30000, method: '', reason: 'overcharge' },
    ],
  });
  const html = historyDataQualityViewHtml(entries);
  assert.ok(html.includes('4 of 6 entries incomplete'));
  assert.ok(html.includes('CR-1'), 'flagged credit listed');
  assert.ok(html.includes('REF-1'), 'flagged refund listed');
  assert.ok(!html.includes('PAY-9'), 'complete payment never listed');
  assert.ok(!html.includes('BILL-2'), 'complete bill never listed');
});

// --- Fences: the module reads the history only and writes nothing ---

test('fence: the module never references the entry error log', () => {
  const source = readFileSync(new URL('../history-data-quality-flags.js', import.meta.url), 'utf8');
  const fenced = ['data-entry-error-', 'log.js'].join('');
  assert.ok(!source.includes(fenced), 'no reference to the error-log module');
  assert.ok(!source.includes(['error', 'Log'].join('')), 'no error-log loader');
});

test('fence: the module never references the review-round module', () => {
  const source = readFileSync(new URL('../history-data-quality-flags.js', import.meta.url), 'utf8');
  const fenced = ['data-quality-', 'review.js'].join('');
  assert.ok(!source.includes(fenced), 'no reference to the review-round module');
});

test('fence: the module header never names the full history list file literally', () => {
  const source = readFileSync(new URL('../history-data-quality-flags.js', import.meta.url), 'utf8');
  const fenced = ['full-history-', 'list.js'].join('');
  assert.ok(!source.includes(fenced), 'no literal fenced filename in the header');
});

test('fence: the module is pure — no storage, clock, network or page access', () => {
  const source = readFileSync(new URL('../history-data-quality-flags.js', import.meta.url), 'utf8');
  for (const forbidden of ['localStorage', 'new Date(', 'Date.now(', 'fetch(', 'document.', 'window.', 'import ', 'shahdara_']) {
    assert.ok(!source.includes(forbidden), `pure module must not contain ${forbidden}`);
  }
});

test('fence: no realistic Pakistani mobile number in the module', () => {
  const source = readFileSync(new URL('../history-data-quality-flags.js', import.meta.url), 'utf8');
  assert.ok(!/\b03[0-9]{9}\b/.test(source), 'no realistic mobile number');
});

test('the known fields are exactly method, reference and date', () => {
  assert.deepEqual([...HISTORY_DATA_QUALITY_FIELDS], ['method', 'reference', 'date']);
});

// --- Wiring in app.js and the host in index.html ---

test('wiring: app.js imports the quality module and wires it from the history render', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './history-data-quality-flags.js'"), 'imports the module');
  assert.ok(app.includes('historyDataQualityViewHtml'), 'renders the quality view');
  assert.ok(app.includes('hdqHistoryQualityHost'), 'quality host id');
});

test('wiring: index.html carries the quality host beside the share summary host', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const shareAt = html.indexOf('hsxHistoryShareSummaryHost');
  const qualityAt = html.indexOf('hdqHistoryQualityHost');
  assert.ok(shareAt !== -1 && qualityAt !== -1, 'both hosts exist');
  assert.ok(qualityAt > shareAt, 'quality host sits beside the share summary host');
});

test('wiring: the quality view flags only — no record is written from it', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf('// Plan 425');
  const end = app.indexOf('// Plan 411', start);
  assert.ok(start !== -1 && end !== -1 && end > start, 'Plan 425 wiring block found');
  const block = app.slice(start, end);
  for (const forbidden of ['addPayment', 'correctPayment', 'updateCustomer', 'saveHistory', 'recordHistory', 'removeHistory', 'localStorage', 'fetch(', 'logError', 'recordError']) {
    assert.ok(!block.includes(forbidden), `quality wiring must not contain ${forbidden}`);
  }
});

test('wiring: the quality view is drawn from the full entries, never the filtered shown rows', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf('// Plan 425');
  const end = app.indexOf('// Plan 411', start);
  assert.ok(start !== -1 && end !== -1 && end > start, 'Plan 425 wiring block found');
  const block = app.slice(start, end);
  assert.ok(block.includes('historyDataQualityViewHtml(entries)'), 'whole-history entries');
  assert.ok(!block.includes('historyDataQualityViewHtml(shown)'), 'never the shown rows');
});
