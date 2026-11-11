import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LEDGER_REFINE_MIN_CHARS,
  normalizeLedgerRefine,
  ledgerRefineActive,
  ledgerRefineMatches,
  searchLedgerByRefine,
  ledgerRefineSummary,
  ledgerRefineSummaryText,
  ledgerRefineEmptyText,
} from '../ledger-refine-search.js';

// Plan 465 — Refine within search results.
//
// Fixtures are invented and pattern-fake only: names are "First
// Last" fixtures (never a real customer), phones are the 03012345678
// family the PII ratchet allows, record ids are seed-* fixtures.
const ROWS = [
  { paymentId: 'seed-465-01', customerId: 'seed-465-c1', customerNumber: 101, customerName: 'Ahmed Raza', customerPhone: '03012345678', amount: 1000, date: '2026-03-05', month: '2026-03', method: 'Cash', status: 'paid', collectionMohalla: 'Shahdara' },
  { paymentId: 'seed-465-02', customerId: 'seed-465-c2', customerNumber: 102, customerName: 'Ahmed Khan', customerPhone: '03012345679', amount: 1500, date: '2026-03-20', month: '2026-03', method: 'JazzCash', status: 'paid', collectionMohalla: 'Shahdara' },
  { paymentId: 'seed-465-03', customerId: 'seed-465-c3', customerNumber: 103, customerName: 'Faisal Ahmed', customerPhone: '03012345670', amount: 2000, date: '2026-02-28', month: '2026-02', method: 'Raast', status: 'partial', collectionMohalla: 'Margalla Town' },
  { paymentId: 'seed-465-04', customerId: 'seed-465-c4', customerNumber: 104, customerName: 'Bilal Hussain', customerPhone: '03012345671', amount: 500, date: '2026-03-02', month: '2026-03', method: 'Cash at Ahmed shop', status: 'paid', voided: true, collectionMohalla: 'Shahdara' },
  // The payer name is a second name word of its own: the customer
  // is Usman Ghani, the payment was made by Raza.
  { paymentId: 'seed-465-05', customerId: 'seed-465-c5', customerNumber: 105, customerName: 'Usman Ghani', paidBy: 'Raza Malik', customerPhone: '03012345672', amount: 3000, date: '2026-02-15', month: '2026-02', method: 'Easypaisa', status: 'paid', collectionMohalla: 'Margalla Town' },
  // An entry with no mohalla recorded: it belongs to no mohalla
  // term, but it stays in the list while the refine is inactive.
  { paymentId: 'seed-465-06', customerId: 'seed-465-c6', customerNumber: 106, customerName: 'Saad Malik', customerPhone: '03012345673', amount: 1200, date: '2026-04-02', month: '2026-03', method: 'Bank Transfer', status: 'paid' },
];

const ids = (list) => list.map((row) => row.paymentId);

test('a refine term goes live at three characters, like the live search', () => {
  assert.equal(LEDGER_REFINE_MIN_CHARS, 3);
  assert.deepEqual(normalizeLedgerRefine('Raza'), { query: 'Raza', active: true });
  assert.deepEqual(normalizeLedgerRefine('  Raza  '), { query: 'Raza', active: true });
  assert.deepEqual(normalizeLedgerRefine(''), { query: '', active: false });
  assert.deepEqual(normalizeLedgerRefine('   '), { query: '', active: false });
  assert.deepEqual(normalizeLedgerRefine('Ra'), { query: '', active: false });
  assert.deepEqual(normalizeLedgerRefine('R'), { query: '', active: false });
  assert.deepEqual(normalizeLedgerRefine(null), { query: '', active: false });
  assert.deepEqual(normalizeLedgerRefine(undefined), { query: '', active: false });
  assert.deepEqual(normalizeLedgerRefine(42), { query: '', active: false });
  assert.equal(ledgerRefineActive('Raza'), true);
  assert.equal(ledgerRefineActive('Ra'), false);
  assert.equal(ledgerRefineActive(''), false);
});

test('a second name word narrows the list by name', () => {
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Raza')), ['seed-465-01', 'seed-465-05']);
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'raza')), ['seed-465-01', 'seed-465-05']);
  // The payer name counts as a name word of its own.
  assert.equal(ledgerRefineMatches(ROWS[4], 'Malik'), true);
  assert.equal(ledgerRefineMatches(ROWS[4], 'Usman'), true);
  // A name word that matches nobody keeps nothing.
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Zubair')), []);
  // A substring of a name word still matches, the way the live
  // search matches name fragments.
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Raz')), ['seed-465-01', 'seed-465-05']);
});

test('the phonetic matcher still finds Roman-Urdu spelling variants', () => {
  assert.equal(ledgerRefineMatches(ROWS[2], 'Fesal'), true);
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Fesal')), ['seed-465-03']);
  // A literal spelling always matches its own name.
  assert.equal(ledgerRefineMatches(ROWS[2], 'Faisal'), true);
});

test('a mohalla term narrows the list by the collection mohalla', () => {
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Shahdara')), ['seed-465-01', 'seed-465-02', 'seed-465-04']);
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'shahdara')), ['seed-465-01', 'seed-465-02', 'seed-465-04']);
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Margalla Town')), ['seed-465-03', 'seed-465-05']);
  // A mohalla fragment matches too.
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Margalla')), ['seed-465-03', 'seed-465-05']);
  // An entry with no mohalla recorded belongs to no mohalla term.
  assert.equal(ledgerRefineMatches(ROWS[5], 'Shahdara'), false);
  assert.equal(ledgerRefineMatches(ROWS[5], 'Saad'), true);
});

test('a method term narrows the list by method, recorded label or folded group', () => {
  // The recorded label, case-insensitive.
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'JazzCash')), ['seed-465-02']);
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'jazz')), ['seed-465-02']);
  // A "Cash at … shop" variant reads as Cash.
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Cash')), ['seed-465-01', 'seed-465-04']);
  // "Cash" never pulls in JazzCash: method terms match whole words.
  assert.equal(ledgerRefineMatches(ROWS[1], 'Cash'), false);
  // A multi-word method term needs every word to match a word of
  // the label.
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Bank Transfer')), ['seed-465-03', 'seed-465-06']);
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Cash at')), ['seed-465-04']);
  // The folded group label: "bank" finds both a Bank Transfer and
  // a Raast entry, because Raast folds under Bank Transfer.
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'bank')), ['seed-465-03', 'seed-465-06']);
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'transfer')), ['seed-465-03', 'seed-465-06']);
  // The recorded label still finds the Raast entry itself.
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Raast')), ['seed-465-03']);
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Easypaisa')), ['seed-465-05']);
  // A method that matches nobody keeps nothing.
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'NayaPay')), []);
});

test('refining narrows only the list it is given and never adds entries from outside it', () => {
  // The first search found the two Ahmeds; refining by Raza keeps
  // only the Ahmed who is also a Raza — never an entry from outside
  // the first list, even one whose name matches the refine term.
  const firstSearch = ROWS.filter((row) => row.customerName.includes('Ahmed'));
  assert.deepEqual(ids(firstSearch), ['seed-465-01', 'seed-465-02', 'seed-465-03']);
  assert.deepEqual(ids(searchLedgerByRefine(firstSearch, 'Raza')), ['seed-465-01']);
  // A second refine on the refined list narrows further, still
  // inside the same list.
  const refinedOnce = searchLedgerByRefine(firstSearch, 'Raza');
  assert.deepEqual(ids(searchLedgerByRefine(refinedOnce, 'Shahdara')), ['seed-465-01']);
  assert.deepEqual(ids(searchLedgerByRefine(refinedOnce, 'Margalla')), []);
});

test('clearing the refine box brings back the full first list, in order, unmutated', () => {
  const firstSearch = ROWS.filter((row) => row.customerName.includes('Ahmed'));
  const before = JSON.stringify(firstSearch);
  assert.deepEqual(ids(searchLedgerByRefine(firstSearch, '')), ids(firstSearch));
  assert.deepEqual(ids(searchLedgerByRefine(firstSearch, 'Ra')), ids(firstSearch));
  assert.deepEqual(ids(searchLedgerByRefine(firstSearch, null)), ids(firstSearch));
  // The input list and its entries are never mutated.
  assert.equal(JSON.stringify(firstSearch), before);
  const snapshot = JSON.stringify(ROWS);
  searchLedgerByRefine(ROWS, 'Raza');
  assert.equal(JSON.stringify(ROWS), snapshot);
  // An inactive refine keeps every entry, in the same order.
  assert.deepEqual(searchLedgerByRefine(ROWS, ''), ROWS);
  assert.notEqual(searchLedgerByRefine(ROWS, ''), ROWS);
  // A non-list reads as an empty list, never a crash.
  assert.deepEqual(searchLedgerByRefine(null, 'Raza'), []);
  assert.deepEqual(searchLedgerByRefine(undefined, 'Raza'), []);
  // A damaged entry never matches an active refine and never throws.
  assert.equal(ledgerRefineMatches(null, 'Raza'), false);
  assert.equal(ledgerRefineMatches(undefined, 'Raza'), false);
  assert.equal(ledgerRefineMatches('not-an-entry', 'Raza'), false);
  // An inactive refine matches every entry, damaged or not.
  assert.equal(ledgerRefineMatches(null, ''), true);
});

test('a voided row stays listed but counts towards neither count nor total', () => {
  assert.deepEqual(ids(searchLedgerByRefine(ROWS, 'Cash')), ['seed-465-01', 'seed-465-04']);
  assert.deepEqual(ledgerRefineSummary(searchLedgerByRefine(ROWS, 'Cash')), { count: 1, total: 1000 });
  assert.deepEqual(ledgerRefineSummary([ROWS[0], ROWS[1], ROWS[3]]), { count: 2, total: 2500 });
  assert.deepEqual(ledgerRefineSummary([]), { count: 0, total: 0 });
  assert.deepEqual(ledgerRefineSummary([{ amount: 'not-a-number' }, { amount: 1000 }]), { count: 2, total: 1000 });
  assert.deepEqual(ledgerRefineSummary([{ amount: 1000, voided: true }]), { count: 0, total: 0 });
  assert.equal(ledgerRefineSummaryText([ROWS[0], ROWS[1], ROWS[3]], 'Shahdara'), '"Shahdara": 2 entries · PKR 2,500 total');
  assert.equal(ledgerRefineSummaryText([ROWS[0]], 'Raza'), '"Raza": 1 entry · PKR 1,000 total');
  assert.equal(ledgerRefineSummaryText([], 'Raza'), '"Raza": 0 entries · PKR 0 total');
  assert.equal(ledgerRefineSummaryText(ROWS, ''), '"": 5 entries · PKR 8,700 total');
});

test('the refine total equals the sum of the listed non-voided entries', () => {
  const refined = searchLedgerByRefine(ROWS, 'Shahdara');
  const summary = ledgerRefineSummary(refined);
  const listed = refined.filter((row) => row.voided !== true).reduce((sum, row) => sum + Number(row.amount), 0);
  assert.equal(summary.total, listed);
  assert.equal(summary.total, 1000 + 1500);
  const cash = searchLedgerByRefine(ROWS, 'Cash');
  assert.equal(ledgerRefineSummary(cash).total, 1000);
});

test('the empty text names the refine term', () => {
  assert.equal(ledgerRefineEmptyText('Raza'), 'No entries match "Raza".');
  assert.equal(ledgerRefineEmptyText('Shahdara'), 'No entries match "Shahdara".');
  assert.equal(ledgerRefineEmptyText(''), 'No recorded payments match these filters.');
  assert.equal(ledgerRefineEmptyText('Ra'), 'No recorded payments match these filters.');
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../ledger-refine-search.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('document.'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches pure helpers, which are not clock reads.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});

// --- wiring into the Transactions screen and the page ---

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('wiring: the app imports the module and applies it in the ledger render', () => {
  assert.ok(appSrc.includes("from './ledger-refine-search.js'"), 'app imports the refine ledger module');
  const renderStart = appSrc.indexOf('function renderTransactions()');
  const renderEnd = appSrc.indexOf('function reportStatusLabel(', renderStart);
  const renderBody = appSrc.slice(renderStart, renderEnd);
  assert.ok(renderBody.includes('normalizeLedgerRefine(transactionRefine)'), 'the render normalizes the refine term');
  assert.ok(renderBody.includes('searchLedgerByRefine(transactions, refine.query)'), 'the render narrows the ledger with the refine term');
  assert.ok(renderBody.includes("$('#lrfRefineSummary')"), 'the render updates the refine summary line');
  assert.ok(renderBody.includes('ledgerRefineSummaryText(transactions, refine.query)'), 'the summary line shows the refine term, count, and total');
  assert.ok(renderBody.includes('ledgerRefineEmptyText(refine.query)'), 'an empty refine says so plainly');
});

test('wiring: typing in the refine box re-renders the ledger and clearing the filters clears it', () => {
  assert.ok(appSrc.includes("$('#transactionRefineSearch').addEventListener('input'"), 'the refine box listens for typed text');
  const listenerStart = appSrc.indexOf("$('#transactionRefineSearch').addEventListener('input'");
  const listenerBody = appSrc.slice(listenerStart, listenerStart + 300);
  assert.ok(listenerBody.includes('transactionCurrentPage = 1'), 'the listener restarts at the first page');
  assert.ok(listenerBody.includes('renderTransactions()'), 'the listener re-renders the ledger');
  const clearStart = appSrc.indexOf("$('#clearTransactionFilters').addEventListener('click'");
  const clearBody = appSrc.slice(clearStart, clearStart + 1500);
  assert.ok(clearBody.includes('resetTransactionFilterState()'), 'clearing the filters resets the transaction state');
  // Transactions Screen Overhaul: the per-field clearing moved into
  // resetTransactionFilterState (shared with the All pill).
  const resetStart = appSrc.indexOf('function resetTransactionFilterState()');
  const resetBody = appSrc.slice(resetStart, resetStart + 2900);
  assert.ok(resetBody.includes("$('#transactionRefineSearch')"), 'the reset clears the refine box');
  assert.ok(resetBody.includes('transactionRefine = '), 'the reset resets the refine state');
});

test('wiring: the page carries the refine box and the refine summary line', () => {
  assert.ok(page.includes('id="transactionRefineSearch"'), 'the Transactions screen has a refine box');
  assert.ok(page.includes('id="lrfRefineSummary"'), 'the refine summary line exists in the summary bar');
  const filtersStart = page.indexOf('<div class="transaction-filters" id="txAdvancedFilters" hidden>');
  const filtersEnd = page.indexOf('</div>', page.indexOf('id="rnsReceiptSearchForm"'));
  const filtersBody = page.slice(filtersStart, filtersEnd);
  assert.ok(filtersBody.includes('for="transactionRefineSearch"'), 'the refine box is labelled');
  assert.ok(filtersBody.includes('Refine results'), 'the refine box is labelled as a refine box');
  // The pinned first sentence of the help text stays word for word.
  assert.ok(page.includes('Customer search, recency, exact payment date, and the amount range combine'), 'the pinned help sentence is untouched');
  assert.ok(page.includes('Type a second term in the refine box to narrow only the results already found'), 'the help text names the refine box');
});
