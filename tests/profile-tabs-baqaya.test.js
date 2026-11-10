// Profile tabs: Manual Baqaya is a 4th tab, and all four tabs are
// numbered 1–4.
//
// The user asked (2026-11-10, phone screenshots) for the Manual
// Baqaya (Loan) function to sit at the top of the profile like
// Billing, Customer Info and Complaints — as its own tab — with every
// tab numbered 1, 2, 3, 4. The Baqaya section moves out of the
// Billing panel into its own panel; nothing about the section itself
// changes (Add/Edit/Remove, totals, settlement order).
//
// The four tabs could not keep their full labels at 360px: the old
// three already overflowed the segmented control (48px bare, 121px
// with the "(3 months)" count). The labels are the shortest sensible
// forms — Billing, Info, Complaints, Baqaya — measured at 360px:
// bare EN fits with 0px overflow, bare UR fits with 0px overflow,
// counted UR fits with 0px overflow; counted EN still scrolls 70px
// (better than the 121px the three old tabs scrolled).
//
// A second thing this file pins: the sticky tab bar was silently
// broken at the base head — `.customer-profile-card` still declared
// `overflow: hidden`, which makes it a (never-scrolling) scroll
// container that disables `position: sticky`. The fix is the same
// `overflow: clip` PR #1336 applied to .detail-pane/.month-card:
// measured at 360px, the tab top after scrolling 600px went from
// -430px (gone) to 56px (stuck).
//
// Nov 2026 (live visual bugs): the "(3 months)" count moved off Tab 1
// into the Billing panel header, so the counted-EN 70px scroll above
// is gone when no complaint is open; the tab numbers carry the user's
// middle dot ("1· Billing") with a 4px gap, and the tab-bar scrollbar
// is hidden. The complaints count still sits on Tab 3 when open
// complaints exist.
//
// Synthetic data only; no real customer names or phone numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

const TABS = [
  // Live visual bugs (Nov 2026): the number span carries the user's
  // middle dot — "1· Billing", "2· Info", "3· Complaints", "4· Baqaya".
  ['profileTabBilling', 'profilePanelBilling', '1·', 'Billing'],
  ['profileTabInfo', 'profilePanelInfo', '2·', 'Info'],
  ['profileTabComplaints', 'profilePanelComplaints', '3·', 'Complaints'],
  ['profileTabBaqaya', 'profilePanelBaqaya', '4·', 'Baqaya'],
];

test('profile tabs: the Baqaya tab and panel exist and start hidden', () => {
  const html = read('index.html');
  assert.match(html, /id="profileTabBaqaya"[^>]*role="tab"[^>]*aria-controls="profilePanelBaqaya"[^>]*aria-selected="false"[^>]*tabindex="-1"/,
    'Baqaya tab starts unselected and untabbable');
  assert.match(html, /id="profilePanelBaqaya"[^>]*role="tabpanel"[^>]*aria-labelledby="profileTabBaqaya"[^>]*tabindex="0" hidden>/,
    'Baqaya panel starts hidden');
});

test('profile tabs: four tabs in order, numbered 1–4 in their own spans', () => {
  const html = read('index.html');
  const navStart = html.indexOf('<nav class="profile-tabs"');
  assert.notEqual(navStart, -1, 'the tab nav must exist');
  const navEnd = html.indexOf('</nav>', navStart);
  const nav = html.slice(navStart, navEnd);
  let previous = -1;
  for (const [tabId, panelId, number, label] of TABS) {
    const at = nav.indexOf(`id="${tabId}"`);
    assert.ok(at > previous, `${tabId} must follow the previous tab in the nav`);
    previous = at;
    assert.match(nav, new RegExp(`id="${tabId}"[^>]*aria-controls="${panelId}"`), `${tabId} must control ${panelId}`);
    assert.match(nav, new RegExp(`<span class="profile-tab-number" aria-hidden="true">${number}</span><span class="profile-tab-label" data-i18n="prof_tab_[a-z_]+">${label}</span>`),
      `${tabId} must carry number ${number} in its own span before the label`);
  }
  // The numbers live in their own spans (i18n-safe): no tab label
  // string carries a digit, so translations never have to.
  for (const [, , , label] of TABS) {
    assert.ok(!/\d/.test(label), `label "${label}" must not carry a number`);
  }
});

test('profile tabs: the map and the mounts agree — Baqaya owns its section', () => {
  const app = read('app.js');
  assert.match(app, /baqaya:\['profileTabBaqaya','profilePanelBaqaya'\]/, 'map gains the baqaya entry');
  assert.match(app, /baqaya:\['#manualBaqayaSection'\]/, 'the baqaya mount group owns the section');
  const groupsStart = app.indexOf('const groups = {');
  const groupsEnd = app.indexOf('};', groupsStart);
  const billingGroup = app.slice(groupsStart, groupsEnd);
  assert.ok(!billingGroup.split("complaints:")[0].includes('#manualBaqayaSection'),
    'the billing mount group no longer claims the Baqaya section');
  // The click bindings and arrow-key nav iterate profileTabMap, so the
  // 4th tab gets them for free — pin that the wiring is still generic.
  assert.ok(app.includes("$(`#${tabId}`).addEventListener('click', () => activateProfileTab(name));"),
    'click bindings still iterate the map');
});

test('profile tabs: counts rewrite the label span, never the button', () => {
  const app = read('app.js');
  const start = app.indexOf('function updateProfileTabCounts(customer)');
  assert.notEqual(start, -1, 'updateProfileTabCounts must exist');
  const body = app.slice(start, app.indexOf('\nmountCustomerProfileContent();', start));
  assert.ok(body.includes("$('#profileTabBilling .profile-tab-label')"), 'billing tab label is still set here');
  assert.ok(body.includes("billingLabel.textContent = t('prof_tab_billing')"), 'billing tab is always the bare label — the count moved into the panel');
  assert.ok(body.includes("$('#profileBillingMonthsCount')"), 'the months figure is written into the Billing panel header');
  assert.ok(body.includes("$('#profileTabComplaints .profile-tab-label')"), 'complaints count targets the label span');
  assert.ok(!body.includes("billingTab.textContent") && !body.includes("complaintsTab.textContent"),
    'no count write may touch the button textContent — that would wipe the number span');
  assert.ok(!body.includes('profileTabInfo'), 'the Info tab still carries no count');
  assert.ok(!body.includes('profileTabBaqaya'), 'the Baqaya tab carries no count — its panel heading already shows the total');
});

test('profile tabs: the Baqaya section still renders and wires its dialog', () => {
  const app = read('app.js');
  const start = app.indexOf('function renderManualBaqayaSection(customer)');
  assert.notEqual(start, -1, 'renderManualBaqayaSection must exist');
  const body = app.slice(start, app.indexOf('\nfunction openManualBaqayaDialog', start));
  assert.ok(body.includes("section.innerHTML = manualBaqayaSectionMarkup(customer, { archived: !!customer.archived });"),
    'the section still renders from the same markup');
  assert.ok(body.includes("section.querySelector('[data-add-baqaya]')?.addEventListener('click', () => openManualBaqayaDialog(customer.id));"),
    'Add Baqaya still opens its dialog');
  assert.ok(body.includes("openManualBaqayaDialog(customer.id, button.getAttribute('data-edit-baqaya'))"),
    'Edit still opens its dialog');
});

test('profile tabs: the Baqaya label exists in both languages, Urdu script on the Urdu side', () => {
  const lang = read('nav-language.js');
  assert.ok(lang.includes("prof_tab_baqaya: 'Baqaya'"), 'EN Baqaya tab label');
  assert.ok(lang.includes("prof_tab_baqaya: 'بقایا'"), 'UR Baqaya tab label carries Urdu script');
  // The short labels (measured to fit at 360px) in both languages.
  assert.ok(lang.includes("prof_tab_billing: 'Billing'"), 'EN Billing tab label is the short form');
  assert.ok(lang.includes("prof_tab_info: 'Info'"), 'EN Info tab label is the short form');
  assert.ok(lang.includes("prof_tab_billing: 'بلنگ'"), 'UR Billing tab label is the short form');
  assert.ok(lang.includes("prof_tab_info: 'معلومات'"), 'UR Info tab label is the short form');
  assert.ok(lang.includes("prof_billing_months_count: '{count} months'"), 'EN billing months figure lives in the panel, not on the tab');
  assert.ok(lang.includes("prof_billing_months_count: '{count} ماہ'"), 'UR billing months figure lives in the panel, not on the tab');
});

test('profile tabs: number styling and the sticky fix exist', () => {
  const styles = read('styles.css');
  assert.ok(styles.includes('.profile-tab-number{font-size:10px;font-weight:800;opacity:.75;margin-right:4px;flex:none}'),
    'the number span is small, bold and muted, with a 4px gap to its label (1px glued them: "2Customer Info")');
  assert.ok(styles.includes('scrollbar-width:none'), 'the tab bar hides its scrollbar (was a thick grey track on the phone)');
  assert.ok(styles.includes('.profile-tabs::-webkit-scrollbar{display:none}'), 'the tab bar hides its WebKit scrollbar too');
  assert.ok(styles.includes('.profile-tabs{display:flex;gap:4px;'), 'the tab gap is tightened so four tabs fit');
  const profileUi = read('profile-ui.css');
  assert.ok(profileUi.includes('.customer-profile-card { overflow: clip; }'),
    'the card uses overflow:clip so the sticky tab bar is not disabled by a hidden-overflow scroll container');
});
