import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const version = JSON.parse(read('package.json')).version;
const index = read('index.html');
const app = read('app.js');
const core = read('core.js');
const phase3 = read('phase3.js');
const styles = read('styles.css');
const worker = read('sw.js');

test('web shell assets share the package version and worker updates before app startup', () => {
  assert.match(index, new RegExp(`href="\\./styles\\.css\\?v=${version.replaceAll('.', '\\.') }"`));
  assert.match(index, new RegExp(`src="\\./app\\.js\\?v=${version.replaceAll('.', '\\.') }"`));
  assert.match(app, new RegExp(`from '\\./core\\.js\\?v=${version.replaceAll('.', '\\.') }'`));
  assert.match(app, new RegExp(`from '\\./phase3\\.js\\?v=${version.replaceAll('.', '\\.') }'`));
  const register = index.indexOf(`navigator.serviceWorker.register('./sw.js?v=${version}'`);
  const appModule = index.indexOf(`type="module" src="./app.js?v=${version}"`);
  assert.ok(register >= 0 && register < index.indexOf('<body>'), 'service worker registration belongs in the HTML head');
  assert.ok(appModule > index.indexOf('<body>'), 'app module loads after worker registration markup');
  assert.match(worker, /CACHE_NAME\s*=\s*'shahdara-isp-billing-v12'/);
  assert.match(index, /Search customers by name, phone, address or ID/);
  assert.match(index, /placeholder="Name, phone, address or ID"/);
  assert.match(styles, /font-variant-numeric:\s*tabular-nums/);
  assert.match(styles, /text-align:\s*right/);
  assert.match(worker, /caches\.match\(event\.request\s*,\s*\{\s*ignoreSearch\s*:\s*true\s*\}\)/);
  for (const asset of ['./','./index.html','./styles.css','./app.js','./core.js','./phase3.js','./manifest.webmanifest','./icon.svg']) assert.ok(worker.includes(`'${asset}'`), `offline cache includes ${asset}`);
});

test('customer-list empty-state renderer tolerates mismatched cached markup without aborting the app', () => {
  assert.match(app, /const emptySearch\s*=\s*\$\('#noSearchResults'\);\s*if \(emptySearch\) \{[\s\S]*?emptySearch\.hidden\s*=/);
});

test('money is formatted and labeled in PKR throughout the live billing UI and exports', () => {
  assert.match(core, /Intl\.NumberFormat\('en-PK'/);
  assert.match(app, /const formatAmount = formatPKR/);
  assert.match(core, /Monthly provider purchase cost: \$\{formatPKR/);
  assert.match(core, /Amount: \$\{formatPKR\(payment\.amount\)\}/);
  assert.match(index, /All money shown in PKR · no conversion/);
  assert.match(index, /Monthly provider purchase cost \(PKR\)/);
  assert.match(index, /Monthly selling amount \(PKR\)/);
  assert.match(app, /Bill amount \(PKR\)/);
  assert.match(app, /Amount received \(PKR\)/);
  assert.match(app, /Monthly sale \(PKR\)/);
  assert.match(index, /Not set — excluded from dues/);
});

test('phone-first dashboard prioritizes current due, total due and today collection with easy search/payment access', () => {
  assert.match(styles, /\.summary-current-due\{order:1\}/);
  assert.match(styles, /\.summary-total-due\{order:2\}/);
  assert.match(styles, /\.summary-today-collection\{order:3\}/);
  assert.match(index, /id="quickAddPaymentButton"/);
  assert.match(app, /\$\('#quickAddPaymentButton'\)\.addEventListener/);
  assert.match(styles, /\.quick-payment-button\{min-height:48px/);
  assert.match(styles, /\.global-search-control input\{height:44px\}/);
  assert.match(styles, /\.global-search-control>button\{min-height:44px\}/);
  assert.match(index, /billing data stays in this browser on this device with no server sync/);
});

test('Phase 2 profile and backup controls are present and wired without fake defaults', () => {
  assert.match(index, /id="serviceStatusInput"/);
  assert.match(index, /value="active">Active/);
  assert.match(index, /value="offline">Offline/);
  assert.match(index, /id="ispProviderOptions"><option value="Nayatel"/);
  for (const speed of ['5 Mbps','10 Mbps','15 Mbps','30 Mbps']) assert.ok(index.includes(`value="${speed}"`));
  assert.match(index, /id="monthlyPurchaseCostInput"/);
  assert.match(index, /id="downloadJsonBackupButton"/);
  assert.match(index, /id="restoreJsonBackupButton"/);
  assert.match(index, /id="jsonBackupPreviewSummary"/);
  assert.match(app, /\$\('#saveMohallaButton'\)\.addEventListener/);
  assert.match(app, /\$\('#archiveCustomerButton'\)\.addEventListener/);
  assert.match(app, /\$\('#unarchiveCustomerButton'\)\.addEventListener/);
  assert.match(app, /\$\('#applyJsonBackupButton'\)\.addEventListener/);
  assert.match(app, /previewJsonBackupMerge\(state/);
  assert.match(app, /pendingBackupPreview\?\.canApply/);
});

test('v1.2.1 status controls use explicit manual service and derived billing states with shared month filters', () => {
  assert.match(index, /id="customerFilterMonth"/);
  for (const status of ['active','offline','not-set']) assert.ok(index.includes(`data-customer-service-filter="${status}"`));
  for (const status of ['paid','pending','partial','not-set']) assert.ok(index.includes(`data-customer-billing-filter="${status}"`));
  for (const status of ['paid','pending','partial','not-set']) assert.ok(index.includes(`data-report-filter="${status}"`));
  assert.match(index, /All \(incl\. Not set\)/);
  assert.match(app, /filterCustomersByStatus\(state/);
  assert.match(app, /data-set-service/);
  assert.match(app, /Nothing is saved by opening this form/);
  assert.match(app, /name="date" type="date" required/);
  assert.doesNotMatch(app, /name="date" type="date" value="\$\{localDate\(\)\}"/);
  assert.match(styles, /\.service-choice\.is-selected::before\{content:'✓'/);
  assert.match(styles, /\.service-choice\{[^}]*min-height:34px/);
  assert.match(styles, /\.service-choice\{min-height:44px/);
  assert.match(core, /export function derivedBillStatus/);
  assert.match(core, /export function filterCustomersByStatus/);
});

test('service-state counts are calculated from saved profiles and stay inside the corresponding buttons on one scrollable toolbar row', () => {
  assert.match(index, /class="customer-filter-group service-filter-toolbar"[\s\S]*?data-customer-service-filter="active"[\s\S]*?id="serviceCountActive"[\s\S]*?data-customer-service-filter="offline"[\s\S]*?id="serviceCountOffline"[\s\S]*?data-customer-service-filter="not-set"[\s\S]*?id="serviceCountNotSet"/);
  assert.match(index, /id="serviceStateCountsAnnouncement" class="sr-only" role="status" aria-live="polite"/);
  assert.doesNotMatch(index, /dashboardServiceStatusSummary/);
  assert.match(app, /\$\('#serviceCountActive'\)\.textContent\s*=\s*totals\.activeServiceCount/);
  assert.match(app, /\$\('#serviceCountOffline'\)\.textContent\s*=\s*totals\.offlineServiceCount/);
  assert.match(app, /\$\('#serviceCountNotSet'\)\.textContent\s*=\s*totals\.unsetServiceCount/);
  assert.match(app, /\$\('#serviceStateCountsAnnouncement'\)\.textContent\s*=/);
  assert.match(styles, /\.service-filter-toolbar\{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/);
  assert.doesNotMatch(index, /Active 73 · Offline 5 · Not set 0/);
});

test('Phase 3 sections are local-only, unseeded, mobile-rendered and use explicit no-entry labels', () => {
  for (const id of ['analyticsView','inventoryView','expensesView','inventoryItemForm','inventoryMovementForm','expenseForm','serviceCountActive','serviceCountOffline','serviceCountNotSet']) assert.ok(index.includes(`id="${id}"`), `${id} exists`);
  assert.match(index, /No bill entries/);
  assert.match(index, /No payment entries/);
  assert.match(index, /Not set/);
  assert.match(index, /No stock movements have been entered/);
  assert.match(index, /No expense entries recorded/);
  assert.match(phase3, /export const EXPENSE_CATEGORIES/);
  assert.match(phase3, /export function validatePhase3State/);
  assert.match(phase3, /export function buildPhase3Analytics/);
  assert.match(app, /function renderPhase3\(\)/);
});

test('location and package summaries expose the nested hierarchy, canonical grouping and snapshot-based ARPU definition', () => {
  assert.match(index, /Area \/ mohalla is the parent location and an optional zone is summarized beneath it/);
  assert.match(index, /Area \/ mohalla rows are parent roll-ups/);
  assert.match(index, /Profiles with no area \/ mohalla are excluded from named-area rows and counted below/);
  assert.match(index, /ARPU = current PKT service-month bill snapshots ÷ active configured subscriptions/);
  for (const id of ['analyticsArpu','analyticsArpuDetail','areaSummaryUnassigned','areaSummaryTable','packageSummaryTable']) assert.ok(index.includes(`id="${id}"`), `${id} exists`);
  assert.match(phase3, /normalize\('NFKC'\)/);
  assert.match(phase3, /export function canonicalPackage/);
  assert.match(app, /data\.currentServiceMonthArpu/);
  assert.match(app, /row\.excludedSubscriptions/);
  assert.match(styles, /\.location-summary-label/);
  assert.match(styles, /\.summary-row-area/);
});
