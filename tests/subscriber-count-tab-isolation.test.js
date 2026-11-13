import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// Subscriber Count & Tab Isolation: the 24 registry & operations cards
// used to be loose direct children of <main> (the view switcher hides
// only 9 named views, so they rendered on every screen — including the
// Customers tab and individual profiles). This test pins their D2 homes
// with a small void-aware container parser (no jsdom): it tracks only
// structural containers, skips <script>/<style> text and comments, and
// closes the nearest matching open container on a close tag the way a
// browser does (index.html has unclosed <div>s inside #customersView, so
// popping only on an exact stack-top match would leave the view on the
// stack and mis-attribute every later card to it). A stray close with no
// matching open container is ignored, as in a browser.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const CONTAINERS = new Set(['main', 'section', 'div', 'article', 'nav', 'footer', 'aside', 'dialog', 'details', 'header']);
const VIEW_IDS = new Set(['billingReportsView', 'analyticsView', 'inventoryView', 'billingDashboard', 'customersView', 'transactionsView']);

function cardParents(source) {
  const found = new Map();
  const stack = [];
  const token = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*?)?)\/?>/g;
  let m;
  while ((m = token.exec(source))) {
    const raw = m[0];
    if (raw.startsWith('<!--') || m[1]) continue;
    const tag = m[2].toLowerCase();
    if (!CONTAINERS.has(tag)) continue;
    const id = (raw.match(/\bid="([^"]+)"/) || [])[1] || null;
    const cls = (raw.match(/\bclass="([^"]+)"/) || [])[1] || '';
    if (raw.startsWith('</')) {
      // Browser-like close: pop up to and including the nearest matching
      // open container. (Popping only on an exact stack-top match leaves
      // #customersView on the stack past its </section> — index.html has
      // unclosed <div>s inside it — and every later card is then
      // mis-attributed to the Customers tab.)
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
    } else if (raw.endsWith('/>') || VOID.has(tag)) {
      continue;
    } else {
      if (tag === 'article' && cls.split(/\s+/).includes('summary-card')) {
        const card = cls.split(/\s+/).find(name => name.startsWith('summary-') && name !== 'summary-card');
        const view = [...stack].reverse().find(entry => entry.id && VIEW_IDS.has(entry.id));
        found.set(card, view ? view.id : 'loose');
      }
      stack.push({ tag, id });
    }
  }
  return found;
}

// D2 homes: Reports 7, Analytics 10 (the parent "Analytics 9" is an
// arithmetic slip — the D2 table lists ten cards), Inventory 3, Home 2.
// Receipt Verification + Field Tools have no home: their cards are
// deleted and their modals stay reachable from the More menu.
const EXPECTED_HOME = {
  'summary-billing-cycle': 'billingReportsView',
  'summary-complaint-register': 'billingReportsView',
  'summary-field-tickets': 'billingReportsView',
  'summary-monthly-complaint-report': 'billingReportsView',
  'summary-saad-visits': 'billingReportsView',
  'summary-group-billing': 'billingReportsView',
  'summary-lineman-scorecard': 'billingReportsView',
  'summary-downtime-analytics': 'analyticsView',
  'summary-upstream-sla': 'analyticsView',
  'summary-fleet-uptime': 'analyticsView',
  'summary-splitter-map': 'analyticsView',
  'summary-pon-capacity': 'analyticsView',
  'summary-outage-impact': 'analyticsView',
  'summary-daisy-chain': 'analyticsView',
  'summary-pole-landmark': 'analyticsView',
  'summary-pole-registry': 'analyticsView',
  'summary-power-backup': 'analyticsView',
  'summary-inventory-book': 'inventoryView',
  'summary-fiber-drums': 'inventoryView',
  'summary-hardware-recovery': 'inventoryView',
  'summary-pending-works': 'billingDashboard',
  'summary-system-health': 'billingDashboard'
};

test('registry cards live in their D2 home view, never loose and never on the Customers tab', () => {
  const parents = cardParents(html);
  // No total-count assertion here: the document legitimately holds other
  // summary-cards outside the 24 (Home/Transactions/Reports cards that
  // predate this item — e.g. Shop Settlement + Installation Tracker in
  // #transactionsView, Daily Closing + Owner Khata in Reports). Only the
  // 24-card universe is pinned: every expected card present in its D2
  // home, and no card anywhere loose or on the Customers tab.
  for (const [card, home] of Object.entries(EXPECTED_HOME)) {
    assert.equal(parents.get(card), home, `${card} should live in ${home}, found in ${parents.get(card) ?? 'nowhere'}`);
  }
  for (const parent of parents.values()) {
    assert.notEqual(parent, 'customersView');
    assert.notEqual(parent, 'loose');
  }
});

test('receipt verification and field tools cards are deleted; their modals stay reachable from the More menu', () => {
  const parents = cardParents(html);
  assert.equal(parents.has('summary-receipt-verify'), false);
  assert.equal(parents.has('summary-field-tools'), false);
  // The receipt-verify modal keeps its original trigger id, now on the
  // More-menu button — so the app.js binding that opens it is unchanged.
  assert.ok(html.includes('data-mobile-more="receipt-verify"'));
  assert.ok(html.includes('id="openReceiptVerifyModalBtn"'));
  assert.ok(html.includes('id="receiptVerifyModal"'));
  assert.ok(html.includes('data-mobile-more="field-tools"'));
  assert.ok(html.includes('id="fieldToolsModal"'));
});

test('footer is render-gated on the Customers tab, never removed from the DOM', () => {
  assert.ok(css.includes('body.sr-screen-mode[data-screen="customers"] .app-footer { display: none; }'));
  assert.ok(html.includes('id="appVersionLabel"'));
  assert.ok(html.includes('class="app-footer"'));
});
