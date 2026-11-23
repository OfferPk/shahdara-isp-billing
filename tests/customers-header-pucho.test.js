// Customers header + Pucho Center polish (2026-11-22, user spec):
// short 'Pucho Center' title, no duplicate body heading, mic inside the
// input, compact 'Works offline' pill, and a one-row Customers header
// (title + '+ Add' pill, no ← Home) via customers-scoped CSS only.
// The shared header contract (hasBack: true, back markup) is unchanged.
//
// Port of the prep repro (repro-customers-header-pucho.mjs); NOT a pinning
// file — it carries no parity literal (see B2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const routerCss = readFileSync(new URL('../screen-router.css', import.meta.url), 'utf8');
const routerJs = readFileSync(new URL('../screen-router.js', import.meta.url), 'utf8');
const lang = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
const ownerUi = readFileSync(new URL('../owner-ui.js', import.meta.url), 'utf8');
const feedback = readFileSync(new URL('../ui-feedback.js', import.meta.url), 'utf8');

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const distinctHex = (s) =>
  new Set((stripComments(s).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [])).size;

// C1 — Pucho stays collapsed by default (already shipped by the Pucho +
// Profile Header Polish: toggle aria-expanded=false, body hidden).
test('C1: Pucho panel is collapsed by default', () => {
  assert.ok(index.includes('aria-expanded="false" aria-controls="ownerCommandBody"'), 'toggle starts collapsed');
  assert.ok(index.includes('id="ownerCommandBody" class="owner-command-body" hidden'), 'body starts hidden');
  assert.ok(ownerUi.includes('ownerBody.hidden = !expanded'), 'toggle drives the hidden attribute');
});

// C2 — accordion header title is the short 'Pucho Center', not the long
// 'Owner Command & Pucho Center' that ellipsizes to 'Owner Command & Pu...'.
test('C2: toggle title is the short Pucho Center', () => {
  assert.ok(lang.includes("dash_owner_heading: 'Pucho Center'"), 'EN heading is the short form');
  assert.ok(!lang.includes("dash_owner_heading: 'Owner Command & Pucho Center'"), 'long EN heading is gone');
});

// C3 — the duplicate bold 'Owner Command & Pucho Center' h3 inside the
// expanded body is removed (the toggle already carries the heading).
test('C3: no duplicate heading inside the expanded body', () => {
  assert.ok(!index.includes('id="ownerCommandHeading"'), 'body h3 is gone');
  const puchoStart = index.indexOf('id="ownerCommandCenter"');
  const puchoSection = index.slice(puchoStart, index.indexOf('</section>', puchoStart));
  assert.ok(!puchoSection.includes('<h3'), 'no h3 remains in the Pucho panel');
});

// C4 — 'Works offline' stays a compact muted pill: 11px, tight padding.
// The shared .local-only-badge rule (8px 11px) is used by other surfaces,
// so the compact padding must be a SCOPED override on the toggle, never
// an edit of the shared rule.
test('C4: Works-offline pill is compact inside the toggle', () => {
  assert.ok(
    /\.owner-command-toggle\s+\.local-only-badge\s*\{[^}]*padding:\s*2px 8px/.test(styles),
    'scoped toggle badge override carries 2px 8px padding'
  );
  assert.ok(styles.includes('.local-only-badge{margin:3px 0 0;padding:8px 11px'), 'shared badge rule untouched');
});

// C5 — the mic button sits INSIDE the right edge of the text input
// (positioned wrapper, input padded for it), so the row is input + Ask
// only and Ask can never be pushed past the card edge.
test('C5: mic lives inside the input, not as a third grid column', () => {
  assert.ok(index.includes('owner-command-input-wrap'), 'input wrapper exists');
  assert.ok(!/\.owner-command-form\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto auto/.test(styles), '3-column form grid is gone');
});

// C6a — on the Customers screen the redundant back control is gone from
// the rendered header (customers-scoped CSS hide; the shared contract
// and markup stay for every other screen — see S2).
test('C6a: no visible Home back control on the Customers header', () => {
  assert.ok(
    /body\.sr-screen-mode\[data-screen="customers"\][^{]*\.sr-back-button\s*\{[^}]*display:\s*none/.test(routerCss),
    'customers-scoped rule hides the back button'
  );
});

// C6b — the header action is a sleek '+ Add' pill on the SAME row as the
// title (mobile grid no longer puts the action on its own full-width row),
// and its label is the short '+ Add'.
test('C6b: Customers title and + Add share one row', () => {
  assert.ok(routerJs.includes("action: { label: '+ Add', click: '#addCustomerButton' }"), "header action label is '+ Add'");
  assert.ok(
    /body\.sr-screen-mode\[data-screen="customers"\][^{]*\.sr-screen-header\s*\{[^}]*grid-template-areas:\s*"title action"/.test(routerCss) ||
    /\.sr-screen-header\s*\{[^}]*grid-template-areas:\s*"title action"/.test(routerCss),
    'mobile header grid puts title and action on one row'
  );
});

// C7 — the suggested-questions chips strip is horizontally scrollable BY
// DESIGN (2-row column flow, overflow-x:auto); a half-visible chip at
// the right edge is the scroll cue, not a defect — out of scope.
test('C7: chips strip is a scrollable 2-row strip by design', () => {
  assert.ok(styles.includes('grid-auto-flow:column;grid-template-rows:repeat(2,auto)'), 'chip strip flows in 2 rows');
  assert.ok(styles.includes('.owner-suggestion-chips{display:grid;'), 'chip strip rule exists');
  assert.ok(/\.owner-suggestion-chips\{[^}]*overflow-x:\s*auto/.test(styles), 'chip strip scrolls horizontally');
});

// C8 — the 'Customers' line at the foot of the screenshots is the profile
// pane's own back button (#backButton), not part of the header card:
// hidden by default, shown only when a profile is open at phone widths.
test('C8: foot-of-screen Customers line is the profile back button', () => {
  assert.ok(index.includes('id="backButton"'), 'profile back button exists');
  assert.ok(index.includes('data-i18n="prof_back_customers">Customers</span>'), 'it reads Customers');
  assert.ok(styles.includes('.back-button{display:none'), 'back button hidden by default');
  assert.ok(styles.includes('.app-shell.show-detail .back-button{display:inline-flex}'), 'shown only with a profile open');
});

// S1 — the #/assistant route still expands the panel (the collapse is
// default-only; the route opener must keep working).
test('S1: assistant route still expands the panel', () => {
  assert.ok(ownerUi.includes('window.expandOwnerCommandCenter'), 'route opener exposed on window');
  assert.ok(routerJs.includes('win.expandOwnerCommandCenter()'), 'assistant route expands the panel');
});

// S2 — the shared header contract holds: the router still declares a back
// control by default and the markup still carries it (the customers
// change is rendering-only, scoped by CSS).
// Re-pin (header-pucho rebase 2026-11-23): the bare 'hasBack: true' the old
// base pinned is gone — Area Analytics (#1604) + Reports Compare (#1608)
// added the hideBack mechanism (hasBack: !spec.hideBack, with named
// hideBack: true exceptions for analytics + reports only). Customers
// carries no hideBack entry, so its back-button hide stays CSS-only.
test('S2: shared header contract holds for every screen', () => {
  assert.ok(routerJs.includes('hasBack: !spec.hideBack'), 'contract still declares a back control by default');
  const custStart = routerJs.indexOf("customers: { view: 'customersView'");
  const custEntry = routerJs.slice(custStart, routerJs.indexOf('\n', custStart));
  assert.ok(!custEntry.includes('hideBack'), 'customers carries no hideBack — its hide is CSS-only');
  assert.ok(/class="sr-back-button" data-sr-home/.test(routerJs), 'router markup still carries the back button');
});

// S3 — the header action still clicks the existing Add-customer button;
// the pane-heading button itself is untouched.
test('S3: header action still targets #addCustomerButton', () => {
  assert.ok(routerJs.includes("click: '#addCustomerButton'"), 'customers action target unchanged');
  assert.ok(index.includes('id="addCustomerButton"'), 'pane-heading Add button still exists');
});

// S4 — the heading key is REUSED (value change only): it still exists in
// both language dicts and still labels the toggle, so parity is unchanged.
test('S4: dash_owner_heading key reused in both languages', () => {
  assert.ok(index.includes('data-i18n="dash_owner_heading"'), 'toggle still carries the heading key');
  assert.ok(lang.includes('dash_owner_heading:'), 'key present in language dicts');
});

// B1 — hex ratchets unchanged (pin method: exactly 3- or 6-digit hex,
// comment-stripped): styles 610 / screen-router.css 43. Token-only fix —
// no new hex anywhere.
// Re-pin (header-pucho rebase 2026-11-23): styles 608 → 610 — the two added
// literals (#1E3A5F + #9f1239) are #1613 Customers List Cards' billing-driven
// name colours, not this PR; this PR's styles.css adds no hex (worktree
// count == new-base count). screen-router.css stays 43.
test('B1: hex ratchets unchanged', () => {
  assert.equal(distinctHex(styles), 610, 'styles.css hex ratchet');
  assert.equal(distinctHex(routerCss), 43, 'screen-router.css hex ratchet');
});

// B2 — parity-literal discipline: this file carries neither the current
// nor the previous parity total as a bare literal (split forms only).
test('B2: no parity literal in this file', () => {
  const self = readFileSync(new URL(import.meta.url), 'utf8');
  assert.ok(!self.includes('52' + '22'), 'current parity total as a bare literal');
  assert.ok(!self.includes('52' + '21'), 'previous parity total as a bare literal');
});
