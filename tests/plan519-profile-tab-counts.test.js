import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { profileTabCounts } from '../profile-tab-counts.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Plan 519 — Profile tabs carry counts: the tab buttons were
// bare labels ("Billing", "Info", "Complaints", "Baqaya" — the short
// forms, measured to fit four numbered tabs at 360px), so the
// operator could not tell from the tab whether there was anything
// to look at. The fix: Billing shows the months with a recorded
// bill, Complaints shows the unresolved register complaints,
// updated on every profile render. A zero count shows the bare label.
//
// Boundaries, stated plainly:
// - "Open" means what SISP-188's upstream-chain check means by it
//   (openUpstreamIssues in outage-impact.js): status Open or In
//   Progress — a Resolved record never counts.
// - The manual service-log incidents are NOT in the Complaints
//   figure: they carry no status, only a restoredAt timestamp, and
//   their own 30-day count is already shown inside the panel
//   (#incidentCount30Days). The design's citation of that count as
//   an "open complaints" count is imprecise — it counts every manual
//   incident in the last 30 days, resolved or not.
// - The design's Billing example "(24 months)" is the MONTH_LIMIT
//   history window, the same for every customer; the tab shows the
//   per-customer figure instead — months with a bill recorded.
// - The Customer Info tab carries no count: the completion counter
//   (Plan 512/513) already lives inside that panel, and duplicating
//   it on the tab would say nothing new.
// - The static HTML keeps the bare data-i18n labels for the first
//   paint; the counts are set by renderDetail, which is also what
//   the language-change listener re-runs, so a language switch
//   re-renders the counts in the new language.

const customer = (overrides = {}) => ({ id: 'c1', ...overrides });
const complaint = (overrides = {}) => ({ id: 'CMP-1', customerId: 'c1', status: 'Open', ...overrides });

test('Plan 519: billing count is the distinct months with a recorded bill', () => {
  const c = customer({ bills: [{ month: '2026-09' }, { month: '2026-10' }, { month: '2026-11' }] });
  assert.equal(profileTabCounts(c, []).billingMonths, 3);
});

test('Plan 519: duplicate bills for one month count once', () => {
  const c = customer({ bills: [{ month: '2026-11' }, { month: '2026-11' }, { month: '2026-10' }] });
  assert.equal(profileTabCounts(c, []).billingMonths, 2);
});

test('Plan 519: no bills means no billing count', () => {
  assert.equal(profileTabCounts(customer({ bills: [] }), []).billingMonths, 0);
  assert.equal(profileTabCounts(customer({}), []).billingMonths, 0);
  assert.equal(profileTabCounts(customer({ bills: null }), []).billingMonths, 0);
  assert.equal(profileTabCounts(customer({ bills: [{ month: '' }, { month: null }, {}] }), []).billingMonths, 0);
});

test('Plan 519: open complaints are the unresolved register complaints for this customer', () => {
  const complaints = [
    complaint({ id: 'CMP-1', status: 'Open' }),
    complaint({ id: 'CMP-2', status: 'In Progress' }),
    complaint({ id: 'CMP-3', status: 'Resolved' }),
    complaint({ id: 'CMP-4', customerId: 'c2', status: 'Open' }),
  ];
  assert.equal(profileTabCounts(customer(), complaints).openComplaints, 2);
});

test('Plan 519: a customer with no open complaints shows none', () => {
  assert.equal(profileTabCounts(customer(), [complaint({ status: 'Resolved' })]).openComplaints, 0);
  assert.equal(profileTabCounts(customer(), []).openComplaints, 0);
  assert.equal(profileTabCounts(customer(), null).openComplaints, 0);
  assert.equal(profileTabCounts(customer(), undefined).openComplaints, 0);
});

test('Plan 519: a complaint with no status counts as open — only Resolved is closed', () => {
  const c = complaint({ id: 'CMP-9' });
  delete c.status;
  assert.equal(profileTabCounts(customer(), [c]).openComplaints, 1);
});

test('Plan 519: a missing customer has no counts', () => {
  assert.deepEqual(profileTabCounts(null, [complaint()]), { billingMonths: 0, openComplaints: 0 });
  assert.deepEqual(profileTabCounts(undefined, [complaint()]), { billingMonths: 0, openComplaints: 0 });
});

test('Plan 519: app.js imports the tab-count helper at the pinned version', () => {
  const app = read('app.js');
  assert.ok(app.includes("from './profile-tab-counts.js?v=1.11.0'"), 'app.js imports profile-tab-counts at the pinned version');
  assert.ok(app.includes('profileTabCounts'), 'app.js uses the helper');
});

test('Plan 519: updateProfileTabCounts sets the complaints count and keeps the Billing tab bare', () => {
  const app = read('app.js');
  const start = app.indexOf('function updateProfileTabCounts(customer)');
  assert.notEqual(start, -1, 'updateProfileTabCounts must exist');
  const body = app.slice(start, app.indexOf('\nmountCustomerProfileContent();', start));
  assert.ok(body.includes("profileTabCounts(customer, loadComplaints())"), 'counts derive from this customer and the register');
  assert.ok(body.includes("$('#profileTabBilling .profile-tab-label')"), 'billing tab label span is updated');
  assert.ok(body.includes("$('#profileTabComplaints .profile-tab-label')"), 'complaints tab label span is updated');
  // Live visual bugs (Nov 2026): "Billing (3 months)" on the tab
  // clipped the 4th tab ("4 Baqa") at 360px, so the Billing tab is
  // always the bare label now and the same figure lives in the Billing
  // panel header (#profileBillingMonthsCount). The retired
  // prof_tab_billing_count key must not be referenced anywhere.
  assert.ok(!body.includes('prof_tab_billing_count'), 'the billing count key must not be used on the tab anymore');
  assert.ok(body.includes("billingLabel.textContent = t('prof_tab_billing')"), 'billing tab always shows the bare label');
  assert.ok(body.includes("$('#profileBillingMonthsCount')"), 'the months figure is written into the Billing panel header');
  assert.ok(body.includes("t('prof_billing_months_count', null, { count: counts.billingMonths })"), 'panel months figure uses its i18n key with the count param');
  assert.ok(body.includes("t('prof_tab_complaints_count', null, { count: counts.openComplaints })"), 'complaints count uses its i18n key with the count param');
  assert.ok(body.includes("t('prof_tab_complaints')"), 'zero open complaints falls back to the bare complaints label');
  assert.ok(!body.includes('profileTabInfo'), 'the Info tab carries no count — its completion counter already lives in the panel');
});

test('Plan 519: renderDetail refreshes the tab counts on every profile render', () => {
  const app = read('app.js');
  const start = app.indexOf('function renderDetail()');
  assert.notEqual(start, -1, 'renderDetail must exist');
  const end = app.indexOf('\nfunction editCustomerProfile(', start);
  const body = app.slice(start, end === -1 ? undefined : end);
  assert.ok(body.includes('updateProfileTabCounts(customer)'), 'renderDetail must refresh the tab counts');
  assert.ok(body.indexOf('renderHistory(customer)') < body.indexOf('updateProfileTabCounts(customer)'),
    'counts refresh after the billing history renders');
});

test('Plan 519: resolving a complaint refreshes the counts through the register change handler', () => {
  const app = read('app.js');
  const start = app.indexOf('const handleRegisterComplaintsChanged');
  assert.notEqual(start, -1, 'the register change handler must exist');
  const body = app.slice(start, app.indexOf('};', start));
  assert.ok(body.includes('renderDetail()'), 'a register change re-renders the profile, so the tab count follows the new status');
});

test('Plan 519: the static HTML keeps the bare labels for the first paint', () => {
  const html = read('index.html');
  // Live visual bugs (Nov 2026): the number span carries the user's
  // middle dot — "1· Billing", "2· Info", "3· Complaints", "4· Baqaya".
  assert.match(html, /id="profileTabBilling"[^>]*><span class="profile-tab-number" aria-hidden="true">1·<\/span><span class="profile-tab-label" data-i18n="prof_tab_billing">Billing</, 'Billing tab starts as the bare label');
  assert.match(html, /id="profileTabInfo"[^>]*><span class="profile-tab-number" aria-hidden="true">2·<\/span><span class="profile-tab-label" data-i18n="prof_tab_info">Info</, 'Info tab starts as the bare label');
  assert.match(html, /id="profileTabComplaints"[^>]*><span class="profile-tab-number" aria-hidden="true">3·<\/span><span class="profile-tab-label" data-i18n="prof_tab_complaints">Complaints</, 'Complaints tab starts as the bare label');
  assert.match(html, /id="profileTabBaqaya"[^>]*><span class="profile-tab-number" aria-hidden="true">4·<\/span><span class="profile-tab-label" data-i18n="prof_tab_baqaya">Baqaya</, 'Baqaya tab starts as the bare label');
});

test('Plan 519: the count keys exist in both languages with the count param', () => {
  const lang = read('nav-language.js');
  // Live visual bugs (Nov 2026): the billing count moved off the tab
  // into the Billing panel header, so its key is now the panel-only
  // prof_billing_months_count ("3 months"); the old
  // prof_tab_billing_count key is retired. The complaints count stays
  // on its tab.
  assert.ok(!lang.includes('prof_tab_billing_count'), 'the retired billing tab-count key must be gone');
  for (const key of ['prof_billing_months_count', 'prof_tab_complaints_count']) {
    assert.ok(lang.includes(`${key}:`), `${key} must exist`);
    assert.ok(lang.includes(`{count}`), 'count keys must carry the {count} param');
  }
  assert.ok(lang.includes("prof_billing_months_count: '{count} months'"), 'EN billing panel months figure');
  assert.ok(lang.includes("prof_tab_complaints_count: 'Complaints ({count} open)'"), 'EN complaints count label');
  assert.ok(lang.includes("prof_billing_months_count: '{count} ماہ'"), 'UR billing panel months figure carries Urdu script');
  assert.ok(lang.includes("prof_tab_complaints_count: 'شکایات ({count} کھلی)'"), 'UR complaints count label carries Urdu script');
});

test('Plan 519: the tab mechanism is untouched — map, activation, bindings, keys', () => {
  const app = read('app.js');
  assert.match(app, /billing:\['profileTabBilling','profilePanelBilling'\]/);
  assert.match(app, /info:\['profileTabInfo','profilePanelInfo'\]/);
  assert.match(app, /complaints:\['profileTabComplaints','profilePanelComplaints'\]/);
  assert.match(app, /baqaya:\['profileTabBaqaya','profilePanelBaqaya'\]/);
  assert.ok(app.includes("$(`#${tabId}`).addEventListener('click', () => activateProfileTab(name));"), 'click bindings kept');
  assert.match(app, /event\.key === 'ArrowRight'/, 'arrow-key nav kept');
  assert.match(app, /event\.key === 'ArrowLeft'/, 'arrow-key nav kept');
  assert.ok(app.includes("window.addEventListener('shahdara:language-change'"), 'language-change listener kept — it re-runs renderDetail, so counts re-render in the new language');
});
