// Customer information card polish (user spec 2026-11-22): the profile
// 'Customer information' card — 4-column quick-action tiles that wrap,
// the Profile Details title/toggle row with a full-width bar beneath,
// the 32px (i) circle, and the 2x2 strip (Package speed bold + price
// subtitle, Next due in human words, '/mo').
//
// NOT a pinning file: 0 parity literals. Fixture shape copied from
// plan351. Synthetic data only — no real customer names, no realistic
// phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProfileHeaderStrip, profileHeaderStripHtml,
} from '../profile-header-strip.js';
import { missingFieldsChecklistHtml } from '../missing-fields-checklist.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const stylesCss = read('styles.css');
const uiFeedbackCss = read('ui-feedback.css');
const appJs = read('app.js');
const profileUiJs = read('profile-ui.js');
const navLangJs = read('nav-language.js');

const formatAmount = (value) => `PKR ${Number(value).toLocaleString('en-PK')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Stub for app.js humanDate (Intl medium style, en-US): 'Nov 5, 2026'.
const formatDateStub = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

function baseStrip(overrides = {}) {
  return {
    customerId: 'CUST-1',
    customerName: 'Test Customer',
    outstanding: 1500,
    packageLabel: '5Mbps / 150GB',
    packagePrice: 1500,
    lastPayment: { date: '2026-10-19', amount: 2000 },
    nextDueDate: '2026-11-05',
    ...overrides,
  };
}

const stripHtml = (overrides = {}, formatDate = formatDateStub) =>
  profileHeaderStripHtml(buildProfileHeaderStrip(baseStrip(overrides)), formatAmount, {}, formatDate);

// The tile button rule (styles.css): `.profile-view-actions>button{...}`.
const tileRule = (/\.profile-view-actions>button\{([^}]*)\}/.exec(stylesCss) || [])[1] || '';
// The four tile labels live in three places: QR + Print are static in
// app.js:9339, Speak Due in profile-ui.js speakDueButtonMarkup,
// Welcome Slip in profile-ui.js welcomeSlipButtonMarkup.
const tileSources = [appJs, profileUiJs];
function labelWrapped() {
  // Either every label sits in its own span (deterministic wrap), or
  // the button rule itself enables wrapping on the bare text node.
  const spanWrapped = tileSources.every((src) =>
    /<span[^>]*class="[^"]*profile-info-btn-label[^"]*"[^>]*>/.test(src)
    || /<span class="ds-action-icon"[^>]*><\/span><span[^>]*>/.test(src));
  const cssWraps = /overflow-wrap:\s*anywhere/.test(tileRule) && /min-width:\s*0/.test(tileRule);
  return spanWrapped || cssWraps;
}

test('C1: all 4 tiles are 11px, compact padding, and their text can wrap (no nowrap)', () => {
  assert.ok(/font-size:\s*(11px|var\(--text-table-head\))/.test(tileRule),
    `tile buttons are 11px — got: ${tileRule}`);
  assert.ok(/padding:\s*10px 6px/.test(tileRule),
    `tile padding stays 10px 6px (py-2.5 / px-1.5) — got: ${tileRule}`);
  assert.ok(!/\.profile-view-actions\s+\.secondary-button\s*\{\s*white-space:\s*nowrap;\s*\}/.test(uiFeedbackCss),
    'the nowrap rule on the tile buttons is gone');
  assert.ok(labelWrapped(),
    'the tile labels wrap inside their tiles (label span or overflow-wrap on the button)');
});

test('C2: the Welcome Slip label survives and wraps inside its red tile', () => {
  assert.ok(navLangJs.includes("welcome_btn: 'Welcome Slip'"),
    'the Welcome Slip label is kept (not silently dropped)');
  assert.ok(profileUiJs.includes('profile-info-btn-welcome'),
    'the Welcome Slip button keeps its colour class');
  assert.ok(labelWrapped(),
    'the Welcome Slip label wraps inside its tile (see C1 mechanism)');
});

test('C3: the Profile Details row has no trailing bullet', () => {
  const labels = { c1: 'Phone', c2: 'Mohalla' };
  const missing = [{ controlId: 'c1', fieldKey: 'phone' }, { controlId: 'c2', fieldKey: 'mohalla' }];
  const texts = {
    title: 'Profile Details (12/68 filled)', showMissing: 'Show 56 optional fields',
    hideMissing: 'Hide optional fields', allFilled: 'All fields filled',
    total: 68, filled: 12, percent: 18,
  };
  const html = missingFieldsChecklistHtml(missing, labels, texts);
  assert.ok(!html.includes('profile-details-sep'),
    'the separator span is gone');
  assert.ok(!html.includes('•'),
    `no bullet anywhere in the details bar — got: ${html}`);
});

test('C4: title left / toggle right on one row, full-width bar directly beneath', () => {
  const labels = { c1: 'Phone', c2: 'Mohalla' };
  const missing = [{ controlId: 'c1', fieldKey: 'phone' }, { controlId: 'c2', fieldKey: 'mohalla' }];
  const texts = {
    title: 'Profile Details (12/68 filled)', showMissing: 'Show 56 optional fields',
    hideMissing: 'Hide optional fields', allFilled: 'All fields filled',
    total: 68, filled: 12, percent: 18,
  };
  const html = missingFieldsChecklistHtml(missing, labels, texts);
  const titleAt = html.indexOf('profile-details-title');
  const toggleAt = html.indexOf('profile-details-toggle-text');
  const barAt = html.indexOf('profile-details-bar');
  assert.ok(titleAt > -1 && toggleAt > -1 && barAt > -1, 'title, toggle and bar all render');
  assert.ok(titleAt < toggleAt && toggleAt < barAt,
    'the title comes first, then the toggle, then the bar beneath');
  const barRule = (/\.profile-details-bar\{([^}]*)\}/.exec(stylesCss) || [])[1] || '';
  assert.ok(/width:\s*100%/.test(barRule), `the bar is full-width — got: ${barRule}`);
  assert.ok(/height:\s*6px/.test(barRule), `the bar is 6px tall (h-1.5) — got: ${barRule}`);
  const summaryRule = (/\.profile-details-summary\{([^}]*)\}/.exec(stylesCss) || [])[1] || '';
  assert.ok(summaryRule.includes('space-between') || /profile-details-row\{[^}]*space-between/.test(stylesCss),
    'the title/toggle row spreads them left/right');
});

test('C5: the (i) circle next to Customer information is 32px', () => {
  const scoped = (/\.profile-view-heading\s+\.help-icon\s*\{([^}]*)\}/.exec(stylesCss) || [])[1] || '';
  assert.ok(scoped.length > 0, 'a scoped .profile-view-heading .help-icon rule exists');
  assert.ok(/width:\s*32px/.test(scoped) && /height:\s*32px/.test(scoped),
    `the profile (i) is exactly 32px — got: ${scoped}`);
});

test('C6: the Package card shows the speed as the bold main value and the price as a compact subtitle', () => {
  const html = stripHtml();
  assert.ok(html.includes('5Mbps / 150GB'), 'the speed label renders');
  assert.ok(/phs-value-sub/.test(html), 'a subtitle element carries the price');
  const sub = (/<[^>]*phs-value-sub[^>]*>([^<]*)</.exec(html) || [])[1] || '';
  assert.ok(sub.includes('PKR 1,500'), `the subtitle carries the price — got: ${sub}`);
  assert.ok(sub.includes('/mo'), `the subtitle reads /mo — got: ${sub}`);
  // The package strong is the one directly followed by the subtitle
  // span (the dues cell's strong has no subtitle after it).
  const main = (/<strong class="phs-value">([^<]*)<\/strong><span class="phs-value-sub">/.exec(html) || [])[1] || '';
  assert.ok(!main.includes('PKR'), `the main value is the speed only, no price — got: ${main}`);
});

test('C7: Next due reads Nov 5, 2026, never the ISO date', () => {
  const html = stripHtml();
  assert.ok(html.includes('Nov 5, 2026'), `the card shows the human date — got: ${html}`);
  assert.ok(!html.includes('2026-11-05'), 'the ISO date does not survive on the card');
  // The app wires its own humanDate into the strip render.
  const callAt = appJs.indexOf('profileHeaderStripHtml(profileHeaderStrip');
  assert.ok(callAt > -1, 'app.js calls profileHeaderStripHtml');
  assert.ok(/humanDate/.test(appJs.slice(callAt, callAt + 1500)),
    'app.js passes humanDate as the strip date formatter');
});

test('C8: the package price reads /mo in English and /ماہ in Urdu, never /month', () => {
  const en = stripHtml();
  assert.ok(en.includes('/mo'), 'English shows /mo');
  assert.ok(!en.includes('/month'), 'the Latin /month does not survive in English');
  const ur = profileHeaderStripHtml(
    buildProfileHeaderStrip(baseStrip()), formatAmount, { perMonth: '/ماہ' }, formatDateStub);
  assert.ok(ur.includes('/ماہ'), 'Urdu shows /ماہ');
  assert.ok(!ur.includes('/mo') && !ur.includes('/month'),
    'no Latin /mo or /month survives in Urdu mode');
});

test('S1: the 4-column grid and the four tile colours are unchanged', () => {
  assert.ok(/\.profile-view-actions\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/.test(stylesCss),
    'the utility row stays an even 4-column grid');
  for (const [cls, bg] of [
    ['profile-info-btn-qr', '#e7f2ec'], ['profile-info-btn-print', '#e5efff'],
    ['profile-info-btn-speak', '#fef3c7'], ['profile-info-btn-welcome', '#fee2e2'],
  ]) {
    assert.ok(stylesCss.includes(`.profile-view-actions .${cls}{background:${bg}`),
      `${cls} keeps its ${bg} tint`);
  }
});

test('S2: the completion title and the filled-share bar are unchanged', () => {
  const labels = { c1: 'Phone', c2: 'Mohalla' };
  const missing = [{ controlId: 'c1', fieldKey: 'phone' }, { controlId: 'c2', fieldKey: 'mohalla' }];
  const texts = {
    title: 'Profile Details (12/68 filled)', showMissing: 'Show 56 optional fields',
    hideMissing: 'Hide optional fields', allFilled: 'All fields filled',
    total: 68, filled: 12, percent: 18,
  };
  const html = missingFieldsChecklistHtml(missing, labels, texts);
  assert.ok(html.includes('Profile Details (12/68 filled)'), 'the live title survives');
  assert.ok(html.includes('<span class="profile-details-fill" style="width:18%"></span>'),
    'the bar still shows the filled share');
  assert.ok(html.includes('Show 56 optional fields'), 'the toggle label survives');
});

test('S3: the strip dues and last-payment figures are unchanged', () => {
  const html = stripHtml();
  assert.ok(html.includes('PKR 1,500'), 'the dues figure survives');
  assert.ok(html.includes('PKR 2,000'), 'the last-payment amount survives');
  assert.ok(html.includes('2026-10-19'), 'the last-payment date stays ISO (spec names Next due only)');
});

test('S4: the base help-icon stays 40px and the two 28px exceptions stay named', () => {
  const base = (/\.help-icon\{([^}]*)\}/.exec(stylesCss) || [])[1] || '';
  assert.ok(/width:\s*40px/.test(base) && /height:\s*40px/.test(base),
    `base .help-icon stays 40x40 — got: ${base}`);
  for (const scope of ['.analytics-panel', '.saad-payroll-card']) {
    const rule = new RegExp(`${scope.replace('.', '\\.')}\\s+\\.help-icon\\s*\\{([^}]*)\\}`).exec(stylesCss)?.[1] || '';
    assert.ok(/width:\s*28px/.test(rule) && /height:\s*28px/.test(rule),
      `${scope} keeps its 28px exception`);
  }
});

test('B1: a package with no price shows the label only — no subtitle, no /mo', () => {
  const html = stripHtml({ packagePrice: null });
  assert.ok(html.includes('5Mbps / 150GB'), 'the label renders without a price');
  assert.ok(!/phs-value-sub/.test(html), 'no subtitle element without a price');
  assert.ok(!html.includes('/mo'), 'no /mo suffix without a price');
});

test('B2: zero dues still reads as no amount due with the package price intact', () => {
  const html = stripHtml({ outstanding: 0 });
  assert.ok(html.includes('No total dues'), 'zero dues reads as no amount due');
  assert.ok(html.includes('PKR 1,500'), 'the package price survives a zero balance (in the subtitle, once fixed)');
});
