import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { TRANSLATIONS } from '../nav-language.js';
import { computeWaadaChipDate } from '../waada-queue.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Plan 507 — One Waada surface, not two: the profile rendered both a top
// Wada banner (quick-add form + health + history, on the wada-record
// store) and a second Waada section lower down (current promise + chips +
// custom date + Set/Clear, on the legacy customer.promiseDate fields).
// Both were always rendered, with overlapping controls for the same
// promise. The fold keeps the banner only: the chips move into its
// quick-add form (a chip fills the promised-date input; the date input
// is the custom date), and the SISP-98 reliability badge rides along
// beside the health line, so the folded section loses no information.
// One set of controls, one current-promise line; no duplicate Add/Set
// buttons. No change to waada records or amounts (PKR only).
//
// Boundaries, stated plainly: the legacy promise fields stay on the
// record and still feed the follow-up lists, the Waada dashboard and
// reminders — only their duplicate profile display is gone. The
// `.profile-waada-section` / `.profile-waada-current` /
// `.waada-chip-custom` CSS rules are left in place, unreferenced —
// removing them would mean editing shared selector lists for zero
// user-visible benefit (Plan 506 precedent). The banner call in the
// view assembly stays exactly '${wadaProfileBannerHtml(customer)}' —
// eight ordering tests pin that text (plan351/358/359/360/361/363/
// 370/371) — so the score badge is computed inside the banner from
// module-level state, not passed in.

const REMOVED_KEYS = [
  'prof_waada_heading', 'prof_waada_aria', 'prof_waada_promise',
  'prof_waada_none', 'prof_waada_custom', 'prof_waada_custom_aria',
  'prof_waada_set', 'prof_waada_clear', 'prof_waada_badge',
  'prof_waada_badge_expired',
];

function bannerFunction() {
  const app = read('app.js');
  const start = app.indexOf('function wadaProfileBannerHtml(customer) {');
  assert.notEqual(start, -1, 'wadaProfileBannerHtml must exist');
  const end = app.indexOf('\nfunction renderDetail() {', start);
  assert.notEqual(end, -1, 'wadaProfileBannerHtml must end before renderDetail');
  const src = app.slice(start, end);
  const sandbox = {
    state: {},
    getWaadaTodayString: () => '2026-11-08',
    getTodayDateString: () => '2026-11-08',
    loadWadaRecords: () => [],
    activeWadaRecordsForCustomer: () => [],
    wadaRecordsForCustomer: () => [],
    wadaBannerHtml: () => '',
    wadaHealthText: () => 'Wada health: 0 kept on time · 0 kept late · 0 broken · 0 still open.',
    wadaHistoryHtml: () => '',
    waadaScoreBadgeHtml: () => '<p class="profile-waada-score"><span class="wada-badge waada-score-badge">SCORE-BADGE</span></p>',
    helpButtonMarkup: (topic) => `<button class="help-info-btn" type="button" data-help="${topic}">HELP-BTN</button>`,
    escapeHtml: (value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;'),
    t: (key) => TRANSLATIONS.en[key] ?? key,
  };
  return runInNewContext(`${src}\nwadaProfileBannerHtml;`, sandbox);
}

function viewAssembly() {
  const app = read('app.js');
  const start = app.indexOf("$('#customerProfileView').innerHTML = ");
  assert.notEqual(start, -1, 'view assembly must exist');
  const end = app.indexOf('\n', start);
  return app.slice(start, end);
}

function appSrcHasHelpMount() {
  return read('app.js').includes("helpButtonMarkup('waada')");
}

// ------------------------------------------------------------ the rule itself

test('Plan 507: the fold is written down as code comments at the removed section and the banner', () => {
  const app = read('app.js');
  assert.ok(app.includes('Plan 507 — one Waada surface, not two'), 'rule comment must sit where the lower section was');
  assert.ok(app.includes('the banner is now the profile\'s only Waada surface'), 'rule comment must sit at the banner');
  assert.ok(app.includes('no duplicate Add/Set buttons'), 'rule must name the duplicate-button outcome');
});

// ------------------------------------------------------------ the lower section is gone

test('Plan 507: the lower Waada section renders not at all', () => {
  const app = read('app.js');
  for (const gone of [
    'profile-waada-section', 'waadaSectionHtml',
    'profileWaadaCustomDate', 'profileWaadaSetCustomBtn', 'profileWaadaClearBtn',
    'data-profile-waada-chip', 'setCustomerWaada', 'clearCustomerWaada',
    'waadaBadgeLabel',
  ]) {
    assert.ok(!app.includes(gone), `app.js must not contain ${gone}`);
  }
  for (const key of REMOVED_KEYS) {
    assert.ok(!app.includes(`t('${key}'`), `app.js must not wire ${key}`);
  }
  const assembly = viewAssembly();
  assert.ok(assembly.includes('${wadaProfileBannerHtml(customer)}'), 'banner call stays in the view assembly');
  assert.ok(!assembly.includes('${waadaSectionHtml}'), 'lower section is not in the view assembly');
});

test('Plan 507: the removed keys are gone from both dictionaries, the chip keys stay', () => {
  for (const key of REMOVED_KEYS) {
    assert.ok(!(key in TRANSLATIONS.en), `${key} must be gone from EN`);
    assert.ok(!(key in TRANSLATIONS.ur), `${key} must be gone from UR`);
  }
  for (const key of ['prof_waada_chips_aria', 'prof_waada_chip_2', 'prof_waada_chip_5', 'prof_waada_chip_10th']) {
    assert.ok(key in TRANSLATIONS.en, `${key} must stay in EN`);
    assert.ok(key in TRANSLATIONS.ur, `${key} must stay in UR`);
  }
  assert.match(TRANSLATIONS.ur.prof_waada_chips_aria, /[\u0600-\u06FF]/, 'chip group label reads Urdu in UR mode');
  assert.match(TRANSLATIONS.ur.prof_waada_chip_2, /[\u0600-\u06FF]/, 'chip +2 reads Urdu in UR mode');
});

// ------------------------------------------------------------ the one surviving surface

test('Plan 507: the banner is the only Waada section — chips, custom date, health, no duplicate buttons', () => {
  const render = bannerFunction();
  const html = render({ id: 'c1' });
  assert.equal((html.match(/<section class="profile-wada-banner"/g) || []).length, 1, 'exactly one Waada section');
  assert.ok(!html.includes('profile-waada-section'), 'no second Waada section');
  // The heading carries the waada help button: the folded section was
  // the topic's only mount, and the help body describes exactly this
  // surface (chips + custom date), so the button moves with the fold.
  assert.ok(html.includes('data-help="waada"'), 'banner heading carries the waada help button');
  assert.ok(appSrcHasHelpMount(), 'app.js mounts the waada help topic');
  // Chips: all three, in order, before the date input.
  const chipRow = html.indexOf('class="waada-chip-row"');
  const dateInput = html.indexOf('id="wadaQuickDate"');
  assert.ok(chipRow > 0, 'chip row must exist in the banner form');
  assert.ok(dateInput > chipRow, 'chips sit before the date input');
  for (const [chip, label] of [['plus2', '+2 Days'], ['plus5', '+5 Days'], ['tenth', '10th of Month']]) {
    assert.ok(html.includes(`data-wada-quick-chip="${chip}"`), `chip ${chip} must exist`);
    assert.ok(html.includes(`>${label}<`), `chip ${chip} must read ${label}`);
  }
  assert.ok(html.indexOf('data-wada-quick-chip="plus2"') < html.indexOf('data-wada-quick-chip="plus5"'), 'chips keep +2 before +5');
  assert.ok(html.indexOf('data-wada-quick-chip="plus5"') < html.indexOf('data-wada-quick-chip="tenth"'), 'chips keep +5 before 10th');
  // Custom date: the date input itself; one Add button; no Set/Clear.
  assert.ok(html.includes('type="date"'), 'the date input is the custom date');
  assert.equal((html.match(/type="submit"/g) || []).length, 1, 'exactly one submit button');
  assert.ok(html.includes('Add Wada'), 'the one submit button is Add Wada');
  assert.ok(!html.includes('Set Date'), 'no Set button survives');
  assert.ok(!html.includes('Clear Promise'), 'no Clear button survives');
  // Health line + score badge beside it; current promise above the form.
  assert.ok(html.includes('class="wada-health"'), 'health line must exist');
  assert.ok(html.includes('Wada health:'), 'health line must carry the health text');
  const healthAt = html.indexOf('class="wada-health"');
  const badgeAt = html.indexOf('SCORE-BADGE');
  assert.ok(badgeAt > healthAt, 'reliability badge rides beside the health line');
  assert.ok(html.includes('No open wada for this customer.'), 'no open wada reads as before');
});

test('Plan 507: the banner shows the current promise above the quick-add form', () => {
  const app = read('app.js');
  const start = app.indexOf('function wadaProfileBannerHtml(customer) {');
  const end = app.indexOf('\nfunction renderDetail() {', start);
  const src = app.slice(start, end);
  const sandbox = {
    state: {},
    getWaadaTodayString: () => '2026-11-08',
    getTodayDateString: () => '2026-11-08',
    loadWadaRecords: () => [{ id: 'WD-1', customer: 'c1', promisedDate: '2026-11-10', amountPromised: 1000, note: '', status: 'pending', closedDate: '' }],
    activeWadaRecordsForCustomer: (all) => all,
    wadaRecordsForCustomer: (all) => all,
    wadaBannerHtml: () => '<div class="wada-banner-row wada-banner-on-track"><span>Rs 1000 promised by 10 Nov 2026</span></div>',
    wadaHealthText: () => 'Wada health: 0 kept on time · 0 kept late · 0 broken · 1 still open.',
    wadaHistoryHtml: () => '',
    waadaScoreBadgeHtml: () => '',
    helpButtonMarkup: (topic) => `<button class="help-info-btn" type="button" data-help="${topic}">HELP-BTN</button>`,
    escapeHtml: (value) => String(value),
    t: (key) => TRANSLATIONS.en[key] ?? key,
  };
  const render = runInNewContext(`${src}\nwadaProfileBannerHtml;`, sandbox);
  const html = render({ id: 'c1' });
  const promiseAt = html.indexOf('Rs 1000 promised by 10 Nov 2026');
  const formAt = html.indexOf('id="wadaQuickForm"');
  assert.ok(promiseAt > 0, 'current promise must render');
  assert.ok(promiseAt < formAt, 'current promise sits above the quick-add form');
  assert.ok(!html.includes('No open wada for this customer.'), 'open wada replaces the empty line');
});

// ------------------------------------------------------------ the chip wiring

test('Plan 507: a chip fills the promised-date input; the wiring lives in the banner block', () => {
  const app = read('app.js');
  const wiring = app.indexOf("wadaBanner.querySelectorAll('[data-wada-quick-chip]')");
  assert.ok(wiring > 0, 'banner chip wiring must exist');
  const kept = app.indexOf("wadaBanner.querySelectorAll('[data-wada-kept]')");
  assert.ok(wiring < kept, 'chip wiring sits in the banner block before the kept buttons');
  const form = app.indexOf("wadaBanner.querySelector('#wadaQuickForm')");
  assert.ok(form > 0 && form < wiring, 'chip wiring sits after the quick-add submit wiring');
  const snippet = app.slice(wiring, wiring + 600);
  assert.ok(snippet.includes('computeWaadaChipDate'), 'chips compute their date with the shared helper');
  assert.ok(snippet.includes('getWaadaTodayString()'), 'chips use the banner PKT today');
  assert.ok(snippet.includes("querySelector('#wadaQuickDate')"), 'chips target the banner date input');
  assert.ok(snippet.includes('dateInput.value = date'), 'a chip fills the date input');
});

test('Plan 507: the chips the banner wires produce real promise dates', () => {
  assert.equal(computeWaadaChipDate('plus2', '2026-11-08'), '2026-11-10');
  assert.equal(computeWaadaChipDate('plus5', '2026-11-08'), '2026-11-13');
  assert.equal(computeWaadaChipDate('tenth', '2026-11-08'), '2026-11-10');
  assert.equal(computeWaadaChipDate('bogus', '2026-11-08'), null);
});

// ------------------------------------------------------------ money stays PKR only

test('Plan 507: the surviving Waada surface shows PKR only', () => {
  const render = bannerFunction();
  const html = render({ id: 'c1' });
  assert.ok(html.includes('Rs'), 'amount label reads Rs');
  assert.ok(!html.includes('USD'), 'no USD on the Waada surface');
  assert.ok(!html.includes('€'), 'no EUR on the Waada surface');
});
