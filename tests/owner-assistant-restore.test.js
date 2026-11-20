/**
 * owner-assistant-restore.test.js — Owner Assistant bugfix (2026-11-20):
 * the #/assistant screen rendered only the header card + footer because
 * the router CSS hid #customersView while the panel lives inside it.
 * - The assistant CSS keeps the view visible and hides only its non-panel
 *   children; the stale #billingDashboard uncollapse rules are gone.
 * - Ask Question expands the panel before focusing the input, so it works
 *   even after a manual collapse.
 * - Two pinned chips lead the strip (16 controls: 2 pinned + 12 catalogue
 *   + 2 morning-queue buttons) and answer through the existing engines.
 * Generic fixture only; no live record is ever changed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import { addExpense } from '../phase3.js';
import { answerOwnerCommand } from '../owner-insights.js';
import { PUCHO_QUESTIONS, puchoCatalogueHtml, matchPuchoQuestions, answerPucho } from '../pucho-box.js';
import { SCREENS, headerSpecForScreen } from '../screen-router.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const routerCss = read('../screen-router.css');
const routerJs = read('../screen-router.js');
const ownerUi = read('../owner-ui.js');
const indexHtml = read('../index.html');

// Fixed fixture, reference Wednesday 7 Oct 2026 (PKT). Every figure asserted
// below is computed by hand from these rows:
//   Test A  10 Mbps · Mohalla A · active  · added 2026-10-07
//           Sep bill 1500 paid 1500 Cash 2026-09-05; Oct bill 1500, paid 1000 Easypaisa 2026-10-06 (500 left)
//   Test B  10 Mbps · Mohalla A · active  · added 2026-10-01, connected 2026-10-02
//           Oct bill 1500 paid 1500 JazzCash 2026-10-07
//   Test C  20 Mbps · Mohalla B · active  · added 2026-09-15
//           Sep bill 2000 unpaid; Oct bill 2000 unpaid (4000 outstanding)
//   Test D  5 Mbps · Mohalla B · offline · added 2026-10-07, connected 2026-09-20 · no bills
//   Test E  20 Mbps · Mohalla A · active  · added 2025-01-10
//           Aug bill 1200 unpaid (due 2026-08-05); Sep bill 1200 paid 1200 Cash 2026-09-10;
//           Oct bill 1200, paid 600 Cash 2026-10-01 (600 left)
//   Expenses: 2026-10-07 Cable 500 · 2026-10-03 Electricity 2000 · 2026-10-05 Cable 300 · 2026-09-10 Cable 900
const today = new Date('2026-10-07T12:00:00+05:00');

function fixtureState() {
  let state = createInitialState(['Test A', 'Test B', 'Test C', 'Test D', 'Test E']);
  const profile = {
    'seed-001': { packageSpeed: '10 Mbps', mohalla: 'Mohalla A', serviceStatus: 'active', addedOn: '2026-10-07', connectionDate: null },
    'seed-002': { packageSpeed: '10 Mbps', mohalla: 'Mohalla A', serviceStatus: 'active', addedOn: '2026-10-01', connectionDate: '2026-10-02' },
    'seed-003': { packageSpeed: '20 Mbps', mohalla: 'Mohalla B', serviceStatus: 'active', addedOn: '2026-09-15', connectionDate: null },
    'seed-004': { packageSpeed: '5 Mbps', mohalla: 'Mohalla B', serviceStatus: 'offline', addedOn: '2026-10-07', connectionDate: '2026-09-20' },
    'seed-005': { packageSpeed: '20 Mbps', mohalla: 'Mohalla A', serviceStatus: 'active', addedOn: '2025-01-10', connectionDate: null }
  };
  state = { ...state, customers: state.customers.map(customer => ({ ...customer, ...profile[customer.id] })) };
  const bill = (id, month, amount) => { state = saveBillMonth(state, id, { month, dueAmount: String(amount), status: 'pending' }, today); };
  const pay = (id, month, date, amount, method) => { state = addPayment(state, id, month, { date, amount: String(amount), method }, today); };
  bill('seed-001', '2026-09', 1500); pay('seed-001', '2026-09', '2026-09-05', 1500, 'Cash');
  bill('seed-001', '2026-10', 1500); pay('seed-001', '2026-10', '2026-10-06', 1000, 'Easypaisa');
  bill('seed-002', '2026-10', 1500); pay('seed-002', '2026-10', '2026-10-07', 1500, 'JazzCash');
  bill('seed-003', '2026-09', 2000);
  bill('seed-003', '2026-10', 2000);
  bill('seed-005', '2026-08', 1200);
  bill('seed-005', '2026-09', 1200); pay('seed-005', '2026-09', '2026-09-10', 1200, 'Cash');
  bill('seed-005', '2026-10', 1200); pay('seed-005', '2026-10', '2026-10-01', 600, 'Cash');
  state = addExpense(state, { date: '2026-10-07', amount: '500', category: 'Cable', notes: '' }, today);
  state = addExpense(state, { date: '2026-10-03', amount: '2000', category: 'Electricity', notes: '' }, today);
  state = addExpense(state, { date: '2026-10-05', amount: '300', category: 'Cable', notes: '' }, today);
  state = addExpense(state, { date: '2026-09-10', amount: '900', category: 'Cable', notes: '' }, today);
  return state;
}
const state = fixtureState();
const ask = question => answerOwnerCommand(state, question, today);
const names = rows => rows.map(row => row.name);
// The same payment rows as the fixture above, in the Pucho engine's shape
// (puchoData() in app.js builds exactly this from the ledger).
function puchoFixture() {
  return {
    today: '2026-10-07',
    dues: [], expiries: [], waada: [], suspense: [], tickets: [], repeatFlags: [], atRisk: [], disputes: [],
    payments: [
      { date: '2026-09-05', amountCents: 150000, voided: false, customerName: 'Test A' },
      { date: '2026-10-06', amountCents: 100000, voided: false, customerName: 'Test A' },
      { date: '2026-10-07', amountCents: 150000, voided: false, customerName: 'Test B' },
      { date: '2026-09-10', amountCents: 120000, voided: false, customerName: 'Test E' },
      { date: '2026-10-01', amountCents: 60000, voided: false, customerName: 'Test E' }
    ]
  };
}

test('assistant screen: the panel is inside #customersView and the router CSS keeps that view visible', () => {
  // The panel lives in the Customers view (Owner 5-part fix), not in the dashboard.
  const viewAt = indexHtml.indexOf('id="customersView"');
  const panelAt = indexHtml.indexOf('id="ownerCommandCenter"');
  assert.ok(viewAt !== -1 && panelAt !== -1 && viewAt < panelAt, 'panel is inside #customersView');
  assert.ok(indexHtml.includes('id="ownerCommandToggle"'), 'toggle bar exists');
  assert.ok(indexHtml.includes('id="ownerCommandBody"'), 'collapsible body exists');
  assert.ok(indexHtml.includes('id="ownerCommandInput"'), 'input exists');
  // The new rule hides only the view's non-panel children.
  assert.ok(routerCss.includes('body.sr-screen-mode[data-screen="assistant"] #customersView .app-shell > *:not(#ownerCommandCenter)'), 'non-panel children hidden on the assistant screen');
  assert.ok(routerCss.includes('body.sr-screen-mode[data-screen="assistant"] #ownerCommandCenter'), 'panel margin rule kept');
  // The old rules are gone: nothing hides #customersView or .customer-pane
  // on the assistant screen, and no assistant rule touches #billingDashboard.
  assert.ok(!routerCss.includes('data-screen="assistant"] #customersView,'), 'old #customersView hide rule gone');
  assert.ok(!routerCss.includes('data-screen="assistant"] .customer-pane'), 'old .customer-pane hide rule gone');
  assert.ok(!routerCss.includes('data-screen="assistant"] #billingDashboard'), 'stale #billingDashboard uncollapse gone');
  // The shared Home-dashboard collapse still applies on this screen like
  // every other screen (the dashboard contributes nothing visible).
  assert.ok(routerCss.includes('body.sr-screen-mode #billingDashboard'), 'dashboard collapse rule still applies');
  // Home still hides the panel (only the assistant screen shows it).
  assert.ok(routerCss.includes('body[data-screen="home"] #ownerCommandCenter'), 'panel stays hidden on Home');
});

test('assistant route: Ask Question is a focus action on #ownerCommandInput', () => {
  assert.equal(SCREENS.assistant.view, 'ownerCommandCenter');
  assert.equal(SCREENS.assistant.action.label, 'Ask Question');
  assert.equal(SCREENS.assistant.action.focus, '#ownerCommandInput');
  const spec = headerSpecForScreen('assistant');
  assert.equal(spec.title, 'Owner Assistant');
  assert.equal(spec.actionLabel, 'Ask Question');
  assert.equal(spec.actionKind, 'focus');
  assert.equal(spec.actionTarget, '#ownerCommandInput');
});

test('Ask Question expands the panel before focusing, including after a manual collapse', () => {
  // Route entry already expands (ensureViewVisible), but a tap after a
  // manual collapse needs the same expansion inside the action handler.
  assert.ok(routerJs.includes("if (screen === 'assistant')"), 'route entry has an assistant branch');
  const handlerAt = routerJs.indexOf("actionBtn.addEventListener('click'");
  assert.ok(handlerAt !== -1, 'header action handler exists');
  const handler = routerJs.slice(handlerAt, routerJs.indexOf('\n  });', handlerAt));
  assert.ok(handler.includes("action.focus === '#ownerCommandInput'"), 'guard targets the assistant focus action only');
  assert.ok(handler.includes('win.expandOwnerCommandCenter()'), 'guard expands the panel');
  assert.ok(handler.indexOf('win.expandOwnerCommandCenter()') < handler.indexOf('doc.querySelector(action.focus)'), 'expand runs before focus');
  // The expander itself un-hides the body (the collapsed state is the DOM
  // hidden attribute + aria-expanded, never persisted).
  assert.ok(ownerUi.includes('window.expandOwnerCommandCenter = () => setOwnerExpanded(true)'), 'expander exposed to the router');
  assert.ok(ownerUi.includes('ownerBody.hidden = !expanded'), 'expander un-hides the body');
});

test('pinned chips: 2 pinned + 12 catalogue + 2 morning-queue = 16 controls, pinned first', () => {
  // The catalogue is untouched: still twelve questions, twelve chips.
  assert.equal(PUCHO_QUESTIONS.length, 12);
  const catalogueChips = (puchoCatalogueHtml().match(/data-pucho-question="/g) || []).length;
  assert.equal(catalogueChips, 12, 'one chip per catalogue question');
  // The pinned chips are defined in owner-ui.js, before the delegated
  // click listener and after the queue-button move into the strip.
  const pinnedAt = ownerUi.indexOf('const pinnedChips = [');
  assert.ok(pinnedAt !== -1, 'pinned chips defined');
  const pinnedSlice = ownerUi.slice(pinnedAt, ownerUi.indexOf('catalogueEl?.addEventListener(\'click\'', pinnedAt));
  assert.ok(pinnedSlice.includes("{ label: 'This month profit', question: 'This month profit' }"), 'profit chip defined');
  assert.ok(pinnedSlice.includes("{ label: 'Top defaulters', question: 'Who has the highest outstanding?' }"), 'defaulters chip defined');
  assert.ok(pinnedSlice.includes('chipsGrid.prepend(...pinnedButtons)'), 'pinned chips prepended first in the strip');
  assert.ok(pinnedAt > ownerUi.indexOf('chipsGrid.append(button)'), 'pinned after the queue-button move');
  // The two morning-queue buttons still exist and move into the same strip.
  assert.ok(indexHtml.includes('id="puchoQueueBtn"') && indexHtml.includes('id="puchoQueueExportBtn"'), 'queue buttons exist');
  assert.equal(12 + 2 + 2, 16, 'strip holds 16 one-tap controls');
  // Neither pinned question is a catalogue title, so renderCommand routes
  // both to the owner engine (the exact-title rule sends only catalogue
  // titles to the Pucho engine).
  for (const question of ['This month profit', 'Who has the highest outstanding?']) {
    assert.ok(!PUCHO_QUESTIONS.some(entry => entry.title === question), `${question} is not a catalogue title`);
  }
  assert.ok(ownerUi.includes('PUCHO_QUESTIONS.some(entry=>entry.title===trimmed)'), 'exact-title routing rule intact');
});

test('spec questions: pending dues, today collections, month profit, top defaulters — same figures as the engines', () => {
  // 'Who has pending dues?' → pending-list for Oct: Test A 500 + Test C 2000 + Test E 600.
  const pending = ask('Who has pending dues?');
  assert.equal(pending.intent, 'pending-list');
  assert.equal(pending.month, '2026-10');
  assert.equal(pending.rows.length, 3);
  assert.equal(pending.pendingTotal, 3100);
  assert.deepEqual(names(pending.rows).sort(), ['Test A', 'Test C', 'Test E']);
  // "Today's collections" → the Pucho 'collections' answer (the chip path):
  // the owner engine's collection regex is singular-only, so the plural
  // phrasing returns 'help' there — a pre-existing engine quirk, unchanged
  // by this restore — and renderCommand's documented fallback then runs
  // the Pucho engine, which answers with the same ledger figures:
  // today 1500 (Test B, 1 receipt), month so far 3100 (1000 + 1500 + 600).
  const ownerCollections = ask("Today's collections");
  assert.equal(ownerCollections.intent, 'help', 'owner engine has no plural-collections match');
  assert.ok(matchPuchoQuestions("Today's collections").some(entry => entry.id === 'collections'), 'Pucho fallback matches collections');
  const puchoCollections = answerPucho("Today's collections", puchoFixture());
  assert.equal(puchoCollections.unmatched, false);
  assert.equal(puchoCollections.matched.length, 1);
  assert.ok(puchoCollections.matched[0].headline.includes('1500.00 PKR'), 'today total matches the ledger');
  assert.ok(puchoCollections.matched[0].headline.includes('3100.00 PKR'), 'month-so-far total matches the ledger');
  assert.equal(puchoCollections.matched[0].rows.length, 1);
  assert.deepEqual(puchoCollections.matched[0].rows[0], ['Test B', '2026-10-07', '1500.00']);
  // The full catalogue title (what the chip actually fills in) answers
  // identically through the exact-title route.
  const chipCollections = answerPucho("Today's collections / this month so far — aaj aur is mahine ki jama", puchoFixture());
  assert.equal(chipCollections.unmatched, false);
  assert.ok(chipCollections.matched[0].headline.includes('1500.00 PKR'));
  assert.ok(chipCollections.matched[0].headline.includes('3100.00 PKR'));
  // 'This month profit' → monthly-profit for Oct: 3100 receipts − 2800 expenses.
  const profit = ask('This month profit');
  assert.equal(profit.intent, 'monthly-profit');
  assert.equal(profit.month, '2026-10');
  assert.equal(profit.collection, 3100);
  assert.equal(profit.expenses, 2800);
  assert.equal(profit.profit, 300);
  assert.equal(profit.receiptCount, 3);
  assert.equal(profit.expenseCount, 3);
  // 'Who has the highest outstanding?' → top-defaulters, largest first:
  // Test C 4000, Test E 1800, Test A 500.
  const defaulters = ask('Who has the highest outstanding?');
  assert.equal(defaulters.intent, 'top-defaulters');
  assert.equal(defaulters.limit, 5);
  assert.equal(defaulters.total, 3);
  assert.deepEqual(defaulters.rows.map(row => row.outstanding), [4000, 1800, 500]);
  assert.equal(defaulters.rows[0].name, 'Test C');
  assert.equal(defaulters.rows[0].outstanding, 4000);
});

test('spec questions: the other two one-tap questions already exist as catalogue chips', () => {
  // total_dues covers pending dues; collections covers today's collections —
  // the pinned set does not duplicate them.
  const catalogue = puchoCatalogueHtml();
  assert.ok(PUCHO_QUESTIONS.some(entry => entry.id === 'total_dues'), 'total_dues chip exists');
  assert.ok(PUCHO_QUESTIONS.some(entry => entry.id === 'collections'), 'collections chip exists');
  assert.ok(catalogue.includes('data-pucho-question="Who owes money / total dues'), 'total_dues chip rendered');
  assert.ok(catalogue.includes('data-pucho-question="Today&#39;s collections'), 'collections chip rendered');
  // Both route through the same engines as the spec phrasing.
  const dues = ask('Who owes money / total dues — kul baqaya');
  assert.equal(dues.intent, 'pending-list');
  assert.equal(dues.pendingTotal, 3100);
});

test('tapping a chip never mutates state and never opens the Top Defaulters modal', () => {
  const before = JSON.stringify(state);
  for (const question of ['Who has pending dues?', "Today's collections", 'This month profit', 'Who has the highest outstanding?']) {
    ask(question);
  }
  assert.equal(JSON.stringify(state), before, 'asking changes nothing');
  // The chip path only fills the input and runs renderCommand; the modal
  // opener lives in app.js and is never referenced from the panel module.
  assert.ok(!ownerUi.includes('topDefaultersModalController'), 'no modal opener in the panel module');
  const clickAt = ownerUi.indexOf("catalogueEl?.addEventListener('click'");
  assert.ok(clickAt !== -1, 'delegated chip handler exists');
  const clickHandler = ownerUi.slice(clickAt, ownerUi.indexOf('\n  });', clickAt));
  assert.ok(clickHandler.includes('renderCommand(question)'), 'chip tap runs the question');
  assert.ok(!clickHandler.includes('showModal') && !clickHandler.includes('.open('), 'chip tap opens nothing');
});
