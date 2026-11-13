// Transactions & Recent Receipts Polish (user spec 2026-11-13 ~16:32 PKT):
// (1) the 24 leaked cards are gone from the Transactions screen (SCTI
// move — verify-only here); (2) one unified search bar, count + ℹ️ on
// one row, filtered total on the count line; (3) pill strip clearance,
// finder follows the pill, Show More (25/page); (4) compact
// color-coded receipt cards — nowrap receipt-ID badge, method pill,
// 3-column actions; (5) ^ FAB opacity 0.85 + idle-hide (Pucho owns
// geometry). Fixtures are generic placeholders only — no real customer
// data from any screenshot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const app = read('app.js');
const styles = read('styles.css');
const navCss = read('nav.css');
const navJs = read('nav.js');
const routerCss = read('screen-router.css');

test('transactions screen: the count line is the first content in the view, before the search bar', () => {
  // §1 acceptance: the count line immediately follows the header card
  // in DOM order — the count lives in the heading, ahead of the
  // unified search and the pills.
  assert.ok(html.indexOf('id="transactionsCount"') < html.indexOf('id="transactionLiveSearch"'), 'count precedes the search bar');
  assert.ok(html.indexOf('id="transactionLiveSearch"') < html.indexOf('class="tx-quick-pills"'), 'search precedes the pills');
  // The in-view articles (QC-5/6, shop settlement, install tracker,
  // wallet ledger, suspense) belong to the Collect tab by design —
  // they stay, inside #transactionsView, after the finder.
  const viewOpen = html.indexOf('id="transactionsView"');
  for (const card of ['qc5-field-recovery-card', 'qc6-collection-insights-card', 'summary-shop-settlement', 'summary-install-tracker', 'summary-wallet-ledger', 'summary-suspense-payments']) {
    assert.ok(html.indexOf(card) > viewOpen, `${card} still lives inside #transactionsView`);
  }
  // The dead recovery hide rule is gone (SCTI move fixed the mount).
  assert.ok(!routerCss.includes('body[data-screen="recovery"] main > article.summary-card{display:none}'), 'dead recovery hide rule is gone');
});

test('transactions header: count and help button share one row', () => {
  assert.ok(html.includes('class="transactions-count-row"'), 'count row wrapper exists');
  const wrapAt = html.indexOf('class="transactions-count-row"');
  assert.ok(wrapAt < html.indexOf('id="transactionsCount"'), 'count sits inside the row');
  assert.ok(html.indexOf('id="transactionsCount"') < html.indexOf('data-help="correct_payment"'), 'help button follows the count in the same row');
  assert.ok(styles.includes('.transactions-count-row { display: flex;'), 'count row is a flex row');
});

test('finder follows the active pill and pages at 25 per page', () => {
  assert.ok(app.includes('function renderReceiptFinder(filteredList)'), 'finder takes the filtered list');
  assert.ok(app.includes('renderReceiptFinder(transactions);'), 'renderTransactions passes its filtered list');
  assert.ok(app.includes('let receiptFinderShown = 25;'), 'finder page state starts at 25');
  assert.ok(app.includes('receiptFinderShown += 25;'), 'Show More adds 25');
  assert.ok(html.includes('id="receiptFinderShowMore"'), 'Show More button exists');
  assert.ok(app.includes("t('receipt_finder_recent', null, { shown, total:"), 'recent count line names shown + total');
  assert.ok(app.includes("t('receipt_finder_more', null, { shown, total:"), 'search count line names shown + total');
  // receipt-finder.js stays pure: its 10/20 caps are findReceipts
  // defaults, and the paging lives in app.js.
  assert.ok(app.includes('recentLimit: receiptFinderShown, searchLimit: receiptFinderShown'), 'paging passes explicit limits to findReceipts');
});

test('finder rows: nowrap receipt-ID badge, method pill, 3-column actions', () => {
  assert.ok(app.includes('class="receipt-finder-receipt-id"'), 'receipt ID is wrapped in its badge span');
  assert.ok(styles.includes('.receipt-finder-receipt-id { white-space: nowrap;'), 'badge never breaks mid-token');
  assert.ok(styles.includes('font-family: ui-monospace,'), 'badge is monospace');
  assert.ok(app.includes('class="method-chip ${receiptFinderMethodChipClass(transaction.method)}"'), 'method pill reuses .method-chip');
  assert.ok(styles.includes('.receipt-finder-actions { flex: 1 1 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));'), 'actions are one 3-column grid row');
  assert.ok(app.includes("t('receipt_finder_open_short')"), 'Open uses its short label');
  assert.ok(app.includes("draftLabel: t('receipt_finder_whatsapp_short')"), 'WhatsApp uses its short label');
  assert.ok(app.includes("t('receipt_finder_png_short')"), 'PNG uses its short label');
  assert.ok(styles.includes('.receipt-finder-actions .receipt-network-note { display: none; }'), 'network note hides in the finder row');
});

test('count line carries the filtered total from the same summary object', () => {
  assert.ok(app.includes("$('#transactionsCount').textContent"), 'count writer exists');
  assert.ok(app.includes('• ${formatAmount(summary.totalAmount)}'), 'count line appends the summary total');
  // The summary is computed before the count writer reads it, and the
  // summary bar below reads the same object — the two totals agree.
  assert.ok(app.indexOf('const summary = calculateTransactionSummary(transactions);') < app.indexOf("$('#transactionsCount').textContent"), 'summary is computed before the count writer');
});

test('scroll-top FAB: idle-hide timer exists and the >400px threshold is unchanged', () => {
  assert.ok(navJs.includes('scheduleIdleHide'), 'idle-hide scheduler exists in setupScrollToTop');
  assert.ok(navJs.includes('}, 2000);'), 'idle interval is 2s');
  assert.ok(navJs.includes('scrollY > 400'), '>400px appearance threshold is unchanged');
  assert.match(navCss, /\.scroll-top-button\.is-visible\s*\{[^}]*opacity:\s*0\.85/, 'visible button is semi-transparent');
});
