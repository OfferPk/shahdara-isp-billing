import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { profileTabCounts } from '../profile-tab-counts.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Sharafat 79 — the Baqaya tab shows a count while Complaints does.
// This reverses the deliberate Plan 519 decision ("the Baqaya tab
// carries no count — its panel heading already shows the total"):
// the panel heading shows a MONEY total (how much is unpaid), the tab
// shows an ENTRY count (how many unpaid entries there are). Two
// entries of PKR 500 read the same as one of PKR 1,000 in the heading
// and differently on the tab — that is the point, not a duplication.
//
// 360px fit, honestly stated (no pixel number is claimed — the repo
// has no pixel harness; the recorded 0px/70px/121px numbers were
// measured on a phone): the added text is the SHORT "(N)" form —
// "Baqaya (12)" is a few characters, far shorter than the old
// "Billing (3 months)" that caused the 70px scroll; the tab bar
// scrolls (overflow-x:auto, styles.css:1474, scrollbar hidden), so
// overflow degrades to scroll, never clip; and the worst case after
// this change (Complaints counted + Baqaya counted, EN, Billing bare)
// is strictly narrower than the old measured 70px-scroll case
// (Billing counted "(3 months)" + Complaints counted), because
// "Baqaya (N)" is shorter than "Billing (3 months)" by a wide margin.

const customer = (overrides = {}) => ({ id: 'c1', ...overrides });
const entry = (overrides = {}) => ({ id: 'MBQ-101', remainingCents: 50000, ...overrides });

test('Sharafat 79: no baqaya entries means no baqaya count', () => {
  assert.equal(profileTabCounts(customer(), [], []).unpaidBaqaya, 0);
});

test('Sharafat 79: one unpaid entry counts as 1', () => {
  assert.equal(profileTabCounts(customer(), [], [entry()]).unpaidBaqaya, 1);
});

test('Sharafat 79: two unpaid entries count as 2', () => {
  const entries = [entry({ id: 'MBQ-101' }), entry({ id: 'MBQ-102' })];
  assert.equal(profileTabCounts(customer(), [], entries).unpaidBaqaya, 2);
});

test('Sharafat 79: a fully settled entry does not count', () => {
  const entries = [entry({ id: 'MBQ-101' }), entry({ id: 'MBQ-102', remainingCents: 0 })];
  assert.equal(profileTabCounts(customer(), [], entries).unpaidBaqaya, 1);
});

test('Sharafat 79: a partly settled entry (remaining > 0) still counts', () => {
  assert.equal(profileTabCounts(customer(), [], [entry({ remainingCents: 1 })]).unpaidBaqaya, 1);
});

test('Sharafat 79: a fully adjusted entry (remaining 0) does not count', () => {
  assert.equal(profileTabCounts(customer(), [], [entry({ remainingCents: 0 })]).unpaidBaqaya, 0);
});

test('Sharafat 79: a missing customer has no baqaya count', () => {
  assert.equal(profileTabCounts(null, [], [entry()]).unpaidBaqaya, 0);
  assert.equal(profileTabCounts(undefined, [], [entry()]).unpaidBaqaya, 0);
});

test('Sharafat 79: the third argument defaults to zero — two-arg callers keep working', () => {
  assert.equal(profileTabCounts(customer(), []).unpaidBaqaya, 0);
  assert.deepEqual(profileTabCounts(customer(), []), { billingMonths: 0, openComplaints: 0, unpaidBaqaya: 0 });
});

test('Sharafat 79: the third argument does not change billing months or open complaints', () => {
  const c = customer({ bills: [{ month: '2026-09' }, { month: '2026-10' }, { month: '2026-11' }] });
  const complaints = [{ id: 'CMP-1', customerId: 'c1', status: 'Open' }, { id: 'CMP-2', customerId: 'c1', status: 'Resolved' }];
  const counts = profileTabCounts(c, complaints, [entry()]);
  assert.equal(counts.billingMonths, 3);
  assert.equal(counts.openComplaints, 1);
  assert.equal(counts.unpaidBaqaya, 1);
});

test('Sharafat 79: count is entries, not rupees — 2 x PKR 500 counts 2, 1 x PKR 1000 counts 1', () => {
  const twoSmall = [entry({ id: 'MBQ-101', remainingCents: 50000 }), entry({ id: 'MBQ-102', remainingCents: 50000 })];
  const oneLarge = [entry({ id: 'MBQ-101', remainingCents: 100000 })];
  assert.equal(profileTabCounts(customer(), [], twoSmall).unpaidBaqaya, 2);
  assert.equal(profileTabCounts(customer(), [], oneLarge).unpaidBaqaya, 1);
});

test('Sharafat 79: updateProfileTabCounts passes the derived baqaya list as the third argument', () => {
  const app = read('app.js');
  const start = app.indexOf('function updateProfileTabCounts(customer)');
  assert.notEqual(start, -1, 'updateProfileTabCounts must exist');
  const body = app.slice(start, app.indexOf('\nmountCustomerProfileContent();', start));
  assert.ok(body.includes('profileTabCounts(customer, loadComplaints(), manualBaqayaEntriesWithRemaining(customer))'),
    'the third argument must actually be passed — a helper that accepts baqayaEntries but is never given them would show 0 forever');
});

test('Sharafat 79: the Baqaya label span is set with the count key when unpaid, bare at zero', () => {
  const app = read('app.js');
  const start = app.indexOf('function updateProfileTabCounts(customer)');
  assert.notEqual(start, -1, 'updateProfileTabCounts must exist');
  const body = app.slice(start, app.indexOf('\nmountCustomerProfileContent();', start));
  assert.ok(body.includes("$('#profileTabBaqaya .profile-tab-label')"), 'baqaya count targets the label span');
  assert.ok(body.includes("counts.unpaidBaqaya > 0 ? t('prof_tab_baqaya_count', null, { count: counts.unpaidBaqaya }) : t('prof_tab_baqaya')"),
    'baqaya label uses the count key with the count param when unpaid, the bare label at zero');
  assert.ok(!body.includes('baqayaTab.textContent'), 'no count write may touch the button textContent — that would wipe the number span');
});

test('Sharafat 79: the new Baqaya count key exists in EN and UR, right after the Complaints count key', () => {
  const nav = read('nav-language.js');
  const enComplaints = nav.indexOf("prof_tab_complaints_count: 'Complaints ({count} open)'");
  const enBaqaya = nav.indexOf("prof_tab_baqaya_count: 'Baqaya ({count})'");
  assert.ok(enComplaints >= 0 && enBaqaya > enComplaints, 'EN key must exist after the Complaints count key');
  const urComplaints = nav.indexOf("prof_tab_complaints_count: 'شکایات ({count} کھلی)'");
  const urBaqaya = nav.indexOf("prof_tab_baqaya_count: 'بقایا ({count})'");
  assert.ok(urComplaints >= 0 && urBaqaya > urComplaints, 'UR key must exist after the Complaints count key');
  // The short "(N)" form is the fit decision — no word form ("unpaid",
  // "entries") that would widen the tab at 360px.
  assert.match(nav, /prof_tab_baqaya_count: 'Baqaya \(\{count\}\)',/, 'EN key is exactly the short "(N)" form');
});

test('Sharafat 79: the Info tab still carries no count and the Billing tab stays bare', () => {
  const app = read('app.js');
  const start = app.indexOf('function updateProfileTabCounts(customer)');
  assert.notEqual(start, -1, 'updateProfileTabCounts must exist');
  const body = app.slice(start, app.indexOf('\nmountCustomerProfileContent();', start));
  assert.ok(!body.includes('profileTabInfo'), 'the Info tab still carries no count');
  assert.ok(body.includes("billingLabel.textContent = t('prof_tab_billing')"), 'billing tab is always the bare label');
});

test('Sharafat 79: first-paint HTML keeps the bare Baqaya label', () => {
  const html = read('index.html');
  assert.match(html, /id="profileTabBaqaya"[^>]*>[\s\S]*?data-i18n="prof_tab_baqaya"/, 'first paint keeps the bare Baqaya label');
});
