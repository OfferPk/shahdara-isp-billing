// Urdu auto-translation phase 3: Profile screen via t() + real renderers.
// (a) Every prof_ dictionary key exists in BOTH en and ur, and every ur
// value contains Urdu script except three documented template fragments
// whose translatable words live in neighbouring keys.
// (b) The REAL profile renderers (profile-labels.js, profile-ui.js,
// relocation-log.js — the pure functions whose output app.js renders
// verbatim into the profile view) produce Urdu strings — and none of the
// English originals — when the language is 'ur', and the exact English
// originals when it is 'en'. app.js itself cannot be imported in Node
// (it executes DOM code at import time; no repo test imports it), so its
// profile templates are pinned by source assertions, the same technique
// tests/customer-profile-ui.test.js already uses for app.js.
// (c) Guard: no prof_ data-i18n key appears inside any <dialog> in
// index.html (modal contents stay a later phase).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { TRANSLATIONS, t, setAppLanguage, URDU_SCRIPT_PATTERN } = await import('../nav-language.js');
const { manualServiceStatusLabel, manualServiceStatusBareLabel, profileArchiveLabel } = await import('../profile-labels.js');
const { pauseBillingSummary, kistSettlementPresentation } = await import('../profile-ui.js');
const { renderRelocationTimeline } = await import('../relocation-log.js');

const URDU = /[\u0600-\u06FF]/;
assert.ok(URDU_SCRIPT_PATTERN, 'nav-language exports URDU_SCRIPT_PATTERN');

// Template fragments with no translatable words of their own: the Urdu
// comes from the keys composed around them (direction labels, prorata
// label, customer names). They must still resolve without leftover {…}.
const FRAGMENT_EXEMPTIONS = {
  prof_feeder_names: 'name-list fragment — customer names are user data, never translated',
  prof_prorata_badge: 'amount/direction template — the Urdu comes from prof_prorata_up/down/lateral',
  prof_pkghist_prorata_adj: 'parenthesised amount fragment — sits beside the translated prorata label',
};

test('phase 3 dictionary: every prof_ key exists in en and ur, ur values carry Urdu script', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('prof_'));
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('prof_'));
  assert.ok(enKeys.length > 600, `expected 600+ prof_ keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys.sort(), enKeys.sort(), 'ur dict must carry exactly the en prof_ keys');
  for (const key of enKeys) {
    const en = TRANSLATIONS.en[key];
    const ur = TRANSLATIONS.ur[key];
    assert.equal(typeof en, 'string', `${key}: en value must be a string`);
    assert.ok(en.length > 0, `${key}: en value must not be empty`);
    assert.equal(typeof ur, 'string', `${key}: ur value must be a string`);
    if (key in FRAGMENT_EXEMPTIONS) {
      assert.ok(!URDU.test(ur), `${key}: exemption must stay a fragment, got ${JSON.stringify(ur)}`);
      continue;
    }
    assert.ok(URDU.test(ur), `${key}: ur value must contain Urdu script, got ${JSON.stringify(ur)}`);
    assert.ok(URDU_SCRIPT_PATTERN.test(ur), `${key}: ur value must match URDU_SCRIPT_PATTERN`);
  }
});

test('phase 3 dictionary: fragment templates resolve without leftover placeholders', () => {
  assert.equal(t('prof_prorata_badge', 'ur', { adj: '+PKR 500', direction: t('prof_prorata_up', 'ur') }), '+PKR 500 (اپ گریڈ)');
  assert.equal(t('prof_pkghist_prorata_adj', 'ur', { adj: '+PKR 500' }), '(+PKR 500)');
  assert.equal(t('prof_feeder_names', 'ur', { names: 'AHMED, FATIMA' }), ' — AHMED, FATIMA');
});

const ACTIVE_PAUSE = { paused: true, pauseStartDate: '2026-10-01', autoResumeDate: '2026-12-01', pauseSkippedMonths: ['2026-10'] };
const ACTIVE_PLAN = { id: 'KIST-1', itemTitle: 'Router', totalAmount: 3000, downPayment: 0, monthlyKist: 1000, monthsBilled: 0, totalMonths: 3 };
const SETTLED_PLAN = { id: 'KIST-2', itemTitle: 'Router', totalAmount: 3000, downPayment: 0, monthlyKist: 1000, monthsBilled: 3, totalMonths: 3, payoffAmount: 500, payoffDate: '2026-10-15' };
const RELOC_CUSTOMER = {
  relocationLog: [{
    id: 'REL-1', fromAddress: 'Old House', toAddress: 'New House',
    fromZone: '', toZone: 'GANGALL', shiftedAt: '2026-09-10',
    extraFiberMeters: 20, shiftingFee: 500,
    feeAppliedToBill: false, feeBillMonth: '', recordedAt: '2026-09-10T10:00',
  }],
};

test('phase 3 renderers in ur: profile labels, pause, kist and relocation are Urdu, never the English originals', () => {
  setAppLanguage('ur');
  assert.equal(manualServiceStatusLabel('active'), 'سروس کی حالت: فعال');
  assert.ok(!manualServiceStatusLabel('active').includes('Service status'));
  assert.equal(manualServiceStatusBareLabel('offline'), 'آف لائن');
  assert.ok(!manualServiceStatusBareLabel('offline').includes('Offline'));
  assert.ok(profileArchiveLabel(true, '2026-10-15').includes('آرکائیو'));
  assert.ok(!profileArchiveLabel(true, '2026-10-15').includes('Archived'));
  const pause = pauseBillingSummary(ACTIVE_PAUSE);
  assert.equal(pause.active, true);
  assert.ok(URDU.test(pause.detail), `pause detail must be Urdu, got ${pause.detail}`);
  assert.ok(!pause.detail.includes('Paused'), 'pause detail must not contain the English original');
  const payoff = kistSettlementPresentation(ACTIVE_PLAN);
  assert.equal(payoff.canPayoff, true);
  assert.equal(payoff.payoffAmount, 3000);
  assert.ok(URDU.test(payoff.payoffLabel), `payoff label must be Urdu, got ${payoff.payoffLabel}`);
  assert.ok(!payoff.payoffLabel.includes('Early payoff'));
  const settled = kistSettlementPresentation(SETTLED_PLAN);
  assert.ok(URDU.test(settled.settledLabel), `settled label must be Urdu, got ${settled.settledLabel}`);
  assert.ok(!settled.settledLabel.includes('Settled early'));
  const timeline = renderRelocationTimeline(RELOC_CUSTOMER);
  assert.ok(URDU.test(timeline), 'relocation timeline must contain Urdu');
  assert.ok(!timeline.includes('Relocation & Package Timeline'), 'relocation timeline must not contain the English heading');
  assert.ok(!timeline.includes('Record House Shift'), 'relocation timeline must not contain the English record button');
  assert.ok(timeline.includes('New House'), 'user data (addresses) must stay untranslated');
});

test('phase 3 renderers in en: exact English originals are preserved', () => {
  setAppLanguage('en');
  assert.equal(manualServiceStatusLabel('active'), 'Service status: Active');
  assert.equal(manualServiceStatusBareLabel('offline'), 'Offline');
  assert.equal(profileArchiveLabel(true, '2026-10-15'), 'Profile: Archived since 2026-10-15');
  assert.equal(profileArchiveLabel(false, ''), 'Profile: Active');
  const pause = pauseBillingSummary(ACTIVE_PAUSE);
  assert.equal(pause.active, true);
  assert.match(pause.detail, /Paused/);
  const payoff = kistSettlementPresentation(ACTIVE_PLAN);
  assert.equal(payoff.payoffLabel, 'Early payoff · PKR 3,000');
  const settled = kistSettlementPresentation(SETTLED_PLAN);
  assert.equal(settled.settledLabel, 'Settled early · PKR 500 on 2026-10-15');
  const timeline = renderRelocationTimeline(RELOC_CUSTOMER);
  assert.ok(timeline.includes('Relocation & Package Timeline'), 'relocation timeline keeps its English heading in en mode');
});

test('phase 3 app.js profile templates are wired to t() and no longer carry the English originals', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  // Wiring pins: the profile renderers must call t() with prof_ keys.
  for (const key of [
    'prof_waada_heading', 'prof_kist_heading', 'prof_hist_pay_title',
    'prof_view_heading', 'prof_complaint_heading', 'prof_ticket_heading',
    'prof_downtime_heading', 'prof_optical_heading', 'prof_pole_heading',
    'prof_feeder_heading', 'prof_custody_heading', 'prof_mikrotik_heading',
    'prof_clv_heading', 'prof_current_heading', 'prof_receipts_heading',
    'prof_incident_resolved', 'prof_hist_receipt_amount', 'prof_hist_alloc_same_month',
    'prof_hist_concession_suggest', 'prof_pkghist_row', 'prof_prorata_days',
  ]) {
    assert.ok(app.includes(`t('${key}'`), `app.js must wire ${key}`);
  }
  // Removed-original pins: these pre-change literals must be gone from the
  // profile templates (they live on only as dictionary values now).
  for (const original of [
    'Waada Tareekh — Promise to Pay',
    'Kist / Installments — Hardware',
    'Record an actual payment</h4>',
    'Complaint history</h4>',
    'Field tickets — Lineman worklist</h4>',
    'Downtime analytics</h4>',
    'Optical splitter</h4>',
    'Pole &amp; landmark</h4>',
    'Feeder &amp; outage impact</h4>',
    'Hardware Custody — Returnable Equipment</h4>',
    'MikroTik script</h4>',
    'Customer lifetime value (CLV)</h3>',
    'Receipts & payment behavior</h3>',
    'No billing details recorded for this month.',
  ]) {
    assert.ok(!app.includes(original), `app.js must no longer contain ${JSON.stringify(original)}`);
  }
  // The language-change path is untouched: one listener re-renders the
  // profile (and customers) on language change; no second mechanism.
  assert.ok(app.includes("shahdara:language-change"), 'app.js must keep the language-change listener');
  assert.ok(app.includes('renderDetail()'), 'language change must re-render the profile');
});

test('phase 3 guard: no prof_ data-i18n key appears inside any <dialog>', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dialogs = html.match(/<dialog[\s\S]*?<\/dialog>/g) || [];
  assert.ok(dialogs.length > 0, 'expected at least one <dialog> in index.html');
  for (const dialog of dialogs) {
    assert.ok(!/data-i18n(?:-placeholder|-title|-aria-label)?="prof_/.test(dialog), `dialog must not carry prof_ i18n keys: ${dialog.slice(0, 120)}`);
  }
  // And the profile statics themselves ARE keyed: tabs, danger zone, ledger.
  for (const key of ['prof_tab_billing', 'prof_tab_info', 'prof_tab_complaints', 'prof_danger_title', 'prof_ledger_heading', 'prof_ledger_export', 'prof_ledger_retention', 'prof_pkghist_heading', 'prof_incident_heading']) {
    assert.ok(html.includes(`data-i18n="${key}"`), `index.html must key ${key}`);
  }
});
