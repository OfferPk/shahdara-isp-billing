// Area Analytics 4-tab: the 342 sections of #analyticsView group behind
// five tabs — Areas (charts + the 6-tab unit, never collapsed), Billing,
// Audit, Ops and the Telemetry Lab — with one collapsed 1-line card per
// tool, a live badge copied from the section's own *Summary element, and
// the section's own (i) tooltip reused in the card summary. UUIDs leave
// the display (rule line, pickers, exception cards) and stay data. This
// file IS a pinning file: it asserts the current parity total, so it must
// never contain the previous total in any form — bare, split, or
// formatted — anywhere, including comments.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('index.html');
const appJs = read('app.js');
const styles = read('styles.css');
const routerJs = read('screen-router.js');
const billExceptions = read('bill-exceptions.js');
const partPaymentRules = read('part-payment-rules.js');
const selfSrc = read('tests/area-analytics-four-tabs.test.js');

// The analytics view: from its opening tag to the inventory view's
// opening <section (its id sits inside that tag, so the tag start is
// the range end).
const viewStart = html.indexOf('id="analyticsView"');
const viewEnd = html.lastIndexOf('<section', html.indexOf('id="inventoryView"'));
const viewHtml = html.slice(viewStart, viewEnd);
const sectionTags = [...viewHtml.matchAll(/<section\b[^>]*>/g)].map((m) => m[0]);
const tabOf = (tag) => {
  const m = tag.match(/data-analytics-tab="([234])"/);
  return m ? m[1] : null;
};

test('G1: the four new tab-label keys exist in both dicts; parity is the new total', () => {
  const expectedEn = {
    analytics_tab_areas: '1 · Areas',
    analytics_tab_billing: '2 · Billing & Credits',
    analytics_tab_audit: '3 · Audit & Close',
    analytics_tab_ops: '4 · Ops & Equipment',
  };
  const expectedUr = {
    analytics_tab_areas: '1 · علاقے',
    analytics_tab_billing: '2 · بلنگ اور کریڈٹ',
    analytics_tab_audit: '3 · آڈٹ اور ماہانہ کلوزنگ',
    analytics_tab_ops: '4 · آپریشنز اور سامان',
  };
  for (const [key, value] of Object.entries(expectedEn)) {
    assert.equal(TRANSLATIONS.en[key], value, `${key} EN label`);
    assert.equal(TRANSLATIONS.ur[key], expectedUr[key], `${key} UR label`);
  }
  // Re-pin (Reports Closing polish): parity 5,223 → 5,229 — the item adds
  // exactly one i18n key, dash_khata_open ('Open Khata Closing ›'), EN + UR.
  // The Reports Register polish (+5 keys) merged first, so this re-pin lands at 5,229.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5229, 'EN parity');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5229, 'UR parity');
  assert.ok(selfSrc.includes('5229'), 'this file pins the new total');
});

test('4-tab bar: five numbered buttons in order, right after the view opens', () => {
  const bar = viewHtml.match(/<div class="analytics-tab-bar"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(bar, 'the 4-tab bar exists inside #analyticsView');
  assert.ok(viewHtml.indexOf('analytics-tab-bar') > viewHtml.indexOf('diagnosticsLabCollapsible'), 'the bar sits after the Lab details, so the Lab stays the view\'s first child');
  assert.ok(viewHtml.indexOf('analytics-tab-bar') < viewHtml.indexOf('phase3-pane'), 'the bar sits before the pane, so it sticks above the tab panels');
  const btns = [...bar[1].matchAll(/data-analytics-tab-btn="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(btns, ['areas', 'billing', 'audit', 'ops', 'lab'], 'the five buttons run 1 Areas → 5 Lab');
  for (const tab of ['areas', 'billing', 'audit', 'ops']) {
    assert.ok(bar[1].includes(`data-i18n="analytics_tab_${tab}"`), `${tab} button carries its key`);
    assert.ok(bar[1].includes(`aria-controls="analyticsTabPanel${tab[0].toUpperCase()}${tab.slice(1)}"`), `${tab} button controls its panel`);
  }
  assert.ok(bar[1].includes('data-i18n="analytics_tab_lab"'), 'the Lab button reuses the existing Lab key on an inner span, so the 5 · prefix survives language switches');
  assert.ok(bar[1].includes('aria-controls="analyticsTabPanelLab"'), 'the Lab button controls its panel');
  // Rendered text carries a plain &; the static fallback escapes it.
  assert.ok(bar[1].includes('2 · Billing &amp; Credits'), 'static fallback escapes & in the Billing label');
  assert.ok(bar[1].includes('3 · Audit &amp; Close'), 'static fallback escapes & in the Audit label');
  assert.ok(bar[1].includes('5 · <span data-i18n="analytics_tab_lab">Network Diagnostics Lab</span>'), 'the Lab button shows 5 · plus the Lab label');
});

test('tab bar CSS: sticky below the topbar, panels copy the pane grid', () => {
  const barRule = styles.match(/\.analytics-tab-bar\{([^}]*)\}/);
  assert.ok(barRule, 'the tab-bar rule exists');
  assert.ok(barRule[1].includes('position:sticky'), 'the bar is sticky');
  assert.ok(barRule[1].includes('top:78px'), 'the bar sits at 78px, below the 50px topbar');
  assert.ok(barRule[1].includes('z-index:2'), 'the bar stays at z-index 2');
  assert.ok(styles.includes('.analytics-tab-panel{display:grid;gap:16px;min-width:0}'), 'a tab panel lays out like the phase3 pane');
});

test('section counts: 342 in the view, 334 tagged cards, 8 untagged Tab 1 surfaces', () => {
  assert.equal(sectionTags.length, 342, 'the view holds 342 sections');
  const counts = { 2: 0, 3: 0, 4: 0 };
  let untagged = 0;
  for (const tag of sectionTags) {
    const t = tabOf(tag);
    if (t) counts[t] += 1;
    else untagged += 1;
  }
  assert.equal(counts[2], 16, 'Tab 2 Billing holds 16 tools');
  assert.equal(counts[3], 16, 'Tab 3 Audit holds 16 tools');
  assert.equal(counts[4], 302, 'Tab 4 Ops holds 302 tools (20 named + 282 remainder)');
  assert.equal(untagged, 8, '8 sections stay untagged: the 7 Tab 1 surfaces + Network issues');
  const tagged = sectionTags.filter((tag) => tabOf(tag));
  assert.equal(tagged.length, 334, '334 tagged sections');
  for (const tag of tagged) {
    assert.ok(tag.includes('data-analytics-card="collapsed"'), 'every card starts collapsed');
    assert.ok(tag.includes(' hidden'), 'every card carries static hidden for the first paint');
  }
  assert.equal((viewHtml.match(/class="analytics-card-badge"/g) || []).length, 334, 'one badge span per card');
});

test('Tab 1 surfaces are never cards: no tab attribute, no hidden, no badge', () => {
  for (const id of ['businessHealthScore', 'ispInsights', 'areaBreakdowns']) {
    const tag = sectionTags.find((t) => t.includes(`id="${id}"`));
    assert.ok(tag, `${id} exists`);
    assert.equal(tabOf(tag), null, `${id} is not tagged`);
    assert.ok(!tag.includes(' hidden'), `${id} carries no static hidden`);
    assert.ok(!tag.includes('data-analytics-card'), `${id} is not a card`);
  }
  for (const labelledby of ['onlineSnapshotHeading', 'areaIntelligenceHeading', 'areaAnalyticsHeading', 'packageAnalyticsHeading']) {
    const tag = sectionTags.find((t) => t.includes(`aria-labelledby="${labelledby}"`));
    assert.ok(tag, `${labelledby} exists`);
    assert.equal(tabOf(tag), null, `${labelledby} is not tagged`);
    assert.ok(!tag.includes(' hidden'), `${labelledby} carries no static hidden`);
  }
});

test('6-tab unit: the bar + its 14 tagged elements move into Tab 1 as one unit', () => {
  assert.ok(viewHtml.includes('<nav class="profile-tabs area-network-tabs"'), 'the 6-tab bar exists in the view');
  const tagged = [...viewHtml.matchAll(/<(?:section|article)[^>]*data-area-network-tab="([a-z]+)"[^>]*>/g)];
  assert.equal(tagged.length, 14, '14 elements carry data-area-network-tab (4 sections + 10 articles)');
  for (const [tag, tab] of tagged.map((m) => [m[0], m[1]])) {
    assert.equal(tabOf(tag), null, `a data-area-network-tab element is never tagged for the 4-tab (${tab})`);
    assert.ok(!tag.includes(' hidden'), 'the 4-tab never sets hidden on a data-area-network-tab element');
  }
  const networkIssues = sectionTags.find((t) => t.includes('data-area-network-tab="uptime"'));
  assert.ok(networkIssues, 'Network issues carries data-area-network-tab="uptime"');
  assert.equal(tabOf(networkIssues), null, 'Network issues is Tab 1, never Tab 4');
  const breakdowns = sectionTags.find((t) => t.includes('id="areaBreakdowns"'));
  assert.ok(breakdowns && !breakdowns.includes('data-area-network-tab'), 'areaBreakdowns carries no data-area-network-tab (it is an untagged Tab 1 shell, not an uptime card)');
  const syncFn = appJs.match(/function syncAnalyticsTabs\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(syncFn && !syncFn.includes('data-area-network-tab'), 'syncAnalyticsTabs never touches a data-area-network-tab element (the 6-tab owns those)');
});

test('Lab is Tab 5: first child of the view, and the route activates it', () => {
  const viewAt = html.indexOf('<section id="analyticsView"');
  const labAt = html.indexOf('id="diagnosticsLabCollapsible"');
  assert.ok(labAt - viewAt < 200, 'the Lab <details> is the first child of #analyticsView (the telemetry invariant; the tab bar sits after it)');
  assert.ok(routerJs.includes("'diagnostics-lab': { view: 'analyticsView'"), 'the diagnostics-lab route exists');
  assert.ok(routerJs.includes("analyticsTab: 'lab'"), 'the diagnostics-lab route names Tab 5');
  assert.ok(routerJs.includes("analyticsTab: 'areas'"), 'the analytics route names Tab 1');
  assert.ok(routerJs.includes("win.setAnalyticsTab(screenSpec.analyticsTab)"), 'apply() activates the route tab through the app global');
  assert.ok(appJs.includes('window.setAnalyticsTab = (tab) => setAnalyticsTab(tab)'), 'app.js exposes window.setAnalyticsTab for the router');
});

test('app.js tab logic: five panels, regrouping, one-time wiring, badge sync', () => {
  assert.ok(appJs.includes('analyticsTabPanelAreas'), 'the Areas panel id exists');
  assert.ok(appJs.includes('analyticsTabPanelBilling'), 'the Billing panel id exists');
  assert.ok(appJs.includes('analyticsTabPanelAudit'), 'the Audit panel id exists');
  assert.ok(appJs.includes('analyticsTabPanelOps'), 'the Ops panel id exists');
  assert.ok(appJs.includes('analyticsTabPanelLab'), 'the Lab panel id exists');
  assert.ok(appJs.includes("if (node.id === 'diagnosticsLabCollapsible') return 'lab'"), 'the Lab details regroups into the Lab panel');
  assert.ok(appJs.includes("section.removeAttribute('hidden')"), 'regrouping hands visibility to the panels');
  assert.ok(appJs.includes("if (analyticsTabsGrouped) return;"), 'regrouping runs once');
  assert.ok(appJs.includes("panel.hidden = !active"), 'syncAnalyticsTabs hides inactive panels');
  assert.ok(appJs.includes("btn.setAttribute('aria-pressed', String(active))"), 'tab buttons sync aria-pressed');
  assert.ok(appJs.includes("btn.setAttribute('aria-selected', String(active))"), 'tab buttons sync aria-selected');
  assert.ok(appJs.includes("new MutationObserver"), 'one MutationObserver keeps the badges live');
  assert.ok(appJs.includes("section.querySelector('[id$=\"Summary\"]')"), 'a badge copies the section\'s own *Summary element');
  assert.ok(appJs.includes('if (badge.textContent !== text) badge.textContent = text;'), 'the badge write is guarded so the observer cannot loop on its own writes');
  assert.ok(appJs.includes('setupAnalyticsTabs();'), 'renderAnalytics runs the regrouping');
  assert.ok(appJs.includes('syncAnalyticsTabs();'), 'renderAnalytics re-syncs the tabs');
  assert.ok(appJs.includes('syncAnalyticsCardBadges();'), 'renderAnalytics re-syncs the badges');
});

test('card summaries: one open at a time, (i) reused, badge in the row', () => {
  assert.ok(appJs.includes("section.querySelector(':scope > .analytics-card-summary')"), 'a summary row is built once per card');
  assert.ok(appJs.includes("document.querySelectorAll('#analyticsView [data-analytics-card=\"open\"]')"), 'opening a card closes the open one');
  assert.ok(appJs.includes("section.querySelector('.audit-explainer') || section.querySelector('.help-tip')"), 'the (i) reuses the audit explainer first, then the help-tip');
  assert.ok(appJs.includes("tip.className = 'help-tip'"), 'a section with neither gets a new help-tip from its caption');
  assert.ok(appJs.includes("summary.appendChild(badge)"), 'the badge span moves into the summary row');
  assert.ok(appJs.includes("section.insertBefore(summary, section.firstChild)"), 'the summary row is the card\'s first child');
  assert.ok(styles.includes('[data-analytics-card="collapsed"]>:not(.analytics-card-summary){display:none!important}'), 'a collapsed card shows only its summary row');
  assert.ok(styles.includes('.analytics-card-badge:empty{display:none}'), 'an empty badge hides');
  assert.ok(styles.includes('.analytics-card-summary .audit-explainer .chart-caption{position:absolute'), 'the explainer caption drops down below the summary row');
  // The (i) count is corrected: 11 help-tips + 11 audit-explainers in
  // the view (the prep's 22 + 11 double-counted the explainers).
  assert.equal((viewHtml.match(/<details class="help-tip">/g) || []).length, 11, '11 help-tips in the view');
  assert.equal((viewHtml.match(/<details class="audit-explainer">/g) || []).length, 11, '11 audit-explainers in the view');
});

test('category accordions stay, and each holds one tab only', () => {
  for (const [cat, sections, tab] of [
    ['analyticsCategoryAudit', ['unusualFlagHeading', 'patternWatchHeading', 'receiptGapHeading'], '3'],
    ['analyticsCategoryOutages', ['statusBoardHeading', 'outageCreditHeading'], '4'],
    ['analyticsCategoryNotices', ['cashInHandHeading', 'priceNoticeHeading'], '4'],
  ]) {
    const catPos = viewHtml.indexOf(`id="${cat}"`);
    assert.ok(catPos > -1, `${cat} exists`);
    for (const heading of sections) {
      const tag = sectionTags.find((t) => t.includes(`aria-labelledby="${heading}"`));
      assert.ok(tag, `${heading} exists`);
      assert.equal(tabOf(tag), tab, `${heading} is Tab ${tab}`);
      assert.ok(viewHtml.indexOf(`aria-labelledby="${heading}"`) > catPos, `${heading} sits inside ${cat}`);
    }
  }
});

test('UUIDs leave the display and stay data', () => {
  // The part-payment picker shows name · date, never the record id.
  // (The advance-allocation picker and the terms/text pickers keep the
  // same shape — same-family follow-ups, not this item.)
  const ppStart = appJs.indexOf("$('#partPaymentPick')");
  const ppEnd = appJs.indexOf('No part-payments yet', ppStart);
  const ppBlock = appJs.slice(ppStart, ppEnd);
  assert.ok(ppBlock.includes("${escapeHtml(r.customerName || r.customer)} · ${escapeHtml(r.date)}"), 'part-payment picker label is name · date');
  assert.ok(!ppBlock.includes('${escapeHtml(r.id)} —'), 'the part-payment picker label shows no raw record id');
  const advStart = appJs.indexOf("$('#advanceAllocationPick')");
  const advBlock = appJs.slice(advStart, appJs.indexOf('No advances yet', advStart));
  assert.ok(advBlock.includes('${escapeHtml(r.id)} — ${escapeHtml(r.customerName || r.customer)}'), 'the advance-allocation picker is untouched (follow-up, not this item)');
  // The rule line maps ids through the partPaymentHtml vocabulary.
  assert.ok(appJs.includes('const orderLabels = order.map((id) => {'), 'the rule line maps ids to labels first');
  assert.ok(appJs.includes("if (bill) return `Bill ${bill.month ?? ''}`;"), 'a bill shows as Bill <month>');
  assert.ok(appJs.includes("return instalment ? `Arrears instalment ${instalment.dueDate ?? 'undated'}` : id;"), 'an instalment shows as Arrears instalment <dueDate>');
  assert.ok(appJs.includes("${orderLabels.join(' → ')}"), 'the rule line joins the labels');
  assert.ok(!appJs.includes("${order.join(' → ')}"), 'the rule line never joins raw ids');
  assert.ok(partPaymentRules.includes('export function defaultAllocationOrder(bills, instalments, currentBillId'), 'defaultAllocationOrder is unchanged in part-payment-rules.js');
  assert.ok(appJs.includes('const order = defaultAllocationOrder(bills, instalments, currentId);'), 'the rule still calls defaultAllocationOrder with the same arguments');
  // The exception picker and card drop the bill id from the label only.
  assert.ok(!appJs.includes('${escapeHtml(item.billId)}'), 'the exception picker label carries no bill id');
  assert.ok(!billExceptions.includes('bill ${escapeHtml(exception.billId)}'), 'the exception card shows no raw bill id');
  assert.ok(billExceptions.includes("['Customer', 'Bill', 'Month', 'Reason'"), 'the CSV keeps the Bill column');
  assert.ok(appJs.includes("value=\"${escapeHtml(item.id)}\""), 'the exception option value stays the exception id');
});

test('controls: 31 .qc-input controls in the 3 named sections, Run-month 200px', () => {
  for (const [label, count] of [
    ['Customer credit balance', 12],
    ['One-time charge instalment schedules', 9],
    ['Mid-cycle pro-rata bill sheets', 10],
  ]) {
    const anchor = viewHtml.indexOf(`aria-label="${label}"`);
    assert.ok(anchor > -1, `${label} exists`);
    const secStart = viewHtml.lastIndexOf('<section', anchor);
    const secEnd = viewHtml.indexOf('<section', secStart + 10);
    const chunk = viewHtml.slice(secStart, secEnd);
    assert.equal((chunk.match(/class="qc-input"/g) || []).length, count, `${label} has ${count} classed controls`);
    assert.equal((chunk.match(/<(?:input|select)[^>]*style="width:/g) || []).length, 0, `${label} has no bare inline-width control`);
  }
  assert.ok(viewHtml.includes('<input id="billExceptionRunMonth" type="month" style="width: 200px;">'), 'Run-month is 200px');
});

test('Tab 1 link card opens the Area module in Transactions', () => {
  const headingEnd = viewHtml.indexOf('</div>', viewHtml.indexOf('class="phase3-heading"'));
  const linkPos = viewHtml.indexOf('id="analyticsAreaModuleLinkBtn"');
  assert.ok(linkPos > headingEnd, 'the link card sits after the view heading');
  const firstSection = viewHtml.indexOf('<section', viewHtml.indexOf('class="phase3-heading"'));
  assert.ok(linkPos < firstSection, 'the link card sits before the first section, so it regroups into Tab 1');
  assert.ok(viewHtml.includes('class="analytics-link-card"'), 'the link card exists');
  assert.ok(appJs.includes("switchView('transactions')"), 'the link switches to Transactions');
  assert.ok(appJs.includes("document.getElementById('areaAnalyticsModule')?.scrollIntoView"), 'the link scrolls to the Area module');
});
