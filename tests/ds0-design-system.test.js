// DS-0 — design-system global layer (spec §§1–4, §15).
// Tokens + Inter font + Lucide icon helper + bottom nav 64px + segmented
// sticky tabs + 40px scroll-top (>400px) + bottom padding per view.
//
// Pattern-fake data only: no customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dsIcon, DS_ICON_NAMES, isDsIconName } from '../ds-icons.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const tokensSrc = read('tokens.css');
const stylesSrc = read('styles.css');
const navSrc = read('nav.css');
const componentsSrc = read('components.css');
const routerSrc = read('screen-router.css');
const htmlSrc = read('index.html');
const navJsSrc = read('nav.js');
const appJsSrc = read('app.js');
const buildSrc = read('build.mjs');

function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

// --- §1.3: the --ds-* token family -----------------------------------------

const DS_TOKENS_LIGHT = [
  ['--ds-brand', '#0f5338'], ['--ds-brand-hover', '#0a3d28'], ['--ds-brand-soft', '#e8f5ee'],
  ['--ds-success', '#15803d'], ['--ds-success-bg', '#dcfce7'], ['--ds-success-border', '#86efac'],
  ['--ds-warning', '#b45309'], ['--ds-warning-bg', '#fef3c7'], ['--ds-warning-border', '#fde68a'],
  ['--ds-danger', '#b91c1c'], ['--ds-danger-bg', '#fee2e2'], ['--ds-danger-border', '#fca5a5'],
  ['--ds-danger-strong', '#dc2626'], ['--ds-line', '#e2e8f0'], ['--ds-canvas', '#f4f7f5'],
  ['--ds-card', '#ffffff'], ['--ds-nested', '#f8fafc'], ['--ds-tabs-bg', '#eef2f0'],
  ['--ds-input-border', '#cbd5e1'], ['--ds-label', '#475569'], ['--ds-divider', '#f1f5f9'],
  ['--ds-footer-good', '#f0fdf4'], ['--ds-footer-bad', '#fef2f2'], ['--ds-radius', '12px'],
  ['--ds-focus-ring', 'rgba(15, 83, 56, 0.12)'],
];

test('DS-0 tokens: every --ds-* token is defined with its spec value', () => {
  for (const [token, value] of DS_TOKENS_LIGHT) {
    assert.ok(tokensSrc.includes(`${token}: ${value}`), `tokens.css must define ${token}: ${value}`);
  }
});

test('DS-0 tokens: every --ds-* token carries a dark value (both dark blocks)', () => {
  // --ds-radius is a length (12px in both themes), not a colour, so it
  // has no dark value by design and is excluded here.
  for (const [token] of DS_TOKENS_LIGHT.filter(([t]) => t !== '--ds-radius')) {
    const occurrences = tokensSrc.split(`${token}:`).length - 1;
    // Once in :root (light) + once in each dark block = 3 definitions.
    assert.ok(occurrences >= 3, `${token} must be defined in light + both dark blocks (found ${occurrences})`);
  }
  assert.ok(tokensSrc.includes('--ds-radius: 12px'), '--ds-radius must stay 12px in both themes');
});

test('DS-0 tokens: the existing tokens are NOT redefined', () => {
  for (const [token, value] of [
    ['--color-brand-600', '#0e5b4d'], ['--color-success', '#059669'],
    ['--color-danger', '#b42318'], ['--color-warning', '#92400e'],
  ]) {
    assert.ok(tokensSrc.includes(`${token}: ${value}`), `${token} must stay ${value} — redefining it would recolour every surface that uses it`);
  }
  for (const token of ['--color-paid', '--color-pending', '--color-overdue']) {
    assert.ok(new RegExp(`${token.replace(/-/g, '\\-')}\\s*:`).test(tokensSrc), `${token} must still be defined`);
  }
  assert.ok(tokensSrc.includes('--bottom-nav-height: 64px'), '--bottom-nav-height must be 64px');
});

test('DS-0 tokens: no hard-coded hex in any touched rule', () => {
  // Every rule DS-0 touched must reference var(--ds-*) (or an rgba
  // translucent surface) only — a hard-coded hex here is a regression.
  const touched = [
    [stylesSrc, '.mobile-bottom-nav{'],
    [stylesSrc, '.profile-tabs{'],
    [stylesSrc, '.profile-tab-button[aria-selected=true]{'],
    [stylesSrc, '[data-theme="dark"] .mobile-bottom-nav{'],
    [stylesSrc, '[data-theme="dark"] .topbar {'],
    [navSrc, '.bottom-nav-badge {'],
    [navSrc, '.bottom-nav-badge.badge-alert {'],
    [navSrc, '[data-theme="dark"] .bottom-nav-badge {'],
    [navSrc, '[data-theme="dark"] .bottom-nav-badge.badge-alert {'],
    [navSrc, '.scroll-top-button {'],
    [navSrc, '.scroll-top-button:not([hidden]) {'],
    [navSrc, '.scroll-top-button:hover {'],
    [navSrc, '[data-theme="dark"] .scroll-top-button {'],
  ];
  for (const [css, selector] of touched) {
    const rule = ruleBlock(css, selector);
    assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(rule), `${selector} must contain no hard-coded hex (found in: ${rule.trim().slice(0, 120)})`);
  }
});

// --- §2: Inter font ---------------------------------------------------------

test('DS-0 fonts: inter-font.css exists, is bundled, and the stack falls back to system-ui', () => {
  assert.ok(existsSync(new URL('../inter-font.css', import.meta.url)), 'inter-font.css must exist');
  const fontCss = read('inter-font.css');
  assert.ok(fontCss.includes('@font-face'), 'inter-font.css must declare @font-face');
  assert.ok(fontCss.includes("font-family: 'Inter'") || fontCss.includes('font-family: "Inter"'), 'the @font-face must name Inter');
  assert.ok(fontCss.includes('font-display: swap'), 'the font must swap in, never block paint');
  assert.ok(fontCss.includes('data:font/woff2;base64,'), 'Inter must be bundled as base64 woff2 (offline-first — no CDN)');
  assert.ok(htmlSrc.includes('inter-font.css'), 'index.html must link inter-font.css');
  assert.ok(buildSrc.includes("'inter-font.css'"), 'build.mjs ENTRY_FILES must ship inter-font.css');
  assert.ok(tokensSrc.includes('--font-sans: "Inter", system-ui,'), '--font-sans must start with Inter and fall back to system-ui');
  assert.ok(stylesSrc.includes('body{font-family:var(--font-sans)}'), 'the body must render through --font-sans (the :root rule still names the unbundled DM Sans)');
  // No other font is bundled by DS-0.
  assert.ok(!existsSync(new URL('../plus-jakarta-sans-font.css', import.meta.url)), 'Plus Jakarta Sans must NOT be bundled');
  assert.ok(!fontCss.includes('Noto Sans Arabic') && !fontCss.includes('IBM Plex'), 'Noto Sans Arabic / IBM Plex Sans Arabic must NOT be bundled');
});

// --- §3: icon helper ---------------------------------------------------------

const EXPECTED_ICON_NAMES = [
  'House', 'Users', 'HandCoins', 'BarChart3', 'Ellipsis',
  'Search', 'UserPlus', 'Bell', 'Wrench', 'Scissors', 'Spline', 'Sun', 'Zap',
  'Activity', 'Waves', 'ShieldCheck', 'Cable', 'ArrowRightLeft', 'Wallet',
  'History', 'FileText', 'MessageCircle', 'Handshake', 'Receipt', 'SearchCheck',
  'Scale', 'SlidersHorizontal', 'FileSignature', 'IdCard', 'Package', 'RotateCcw',
  'QrCode', 'Printer', 'Volume2', 'Lock', 'Eye', 'Share2',
  // Profile redesign adds 6: Pencil (Edit), Trash2 (Delete), Archive,
  // Star (QA favourite), ChevronDown (back-dated footer), Plus (Add).
  'Pencil', 'Trash2', 'Archive', 'Star', 'ChevronDown', 'Plus',
  // QC receipt-modal overhaul adds 4: Bluetooth (BT Thermal Print),
  // Image (Share Image), Copy (draft accordion), Info (the (i) button).
  'Bluetooth', 'Image', 'Copy', 'Info',
  // Live visual bugs (Nov 2026) add 2: Globe (topbar language toggle)
  // and Bike (topbar field-mode toggle) replace the 3D emoji.
  'Globe', 'Bike',
  // Customers Directory Polish (Nov 2026) adds 5: LayoutGrid / Table /
  // Download (roster view toggle + CSV export), AlertTriangle (2+
  // Months Arrears pill), Pause (Paused pill).
  'LayoutGrid', 'Table', 'Download', 'AlertTriangle', 'Pause',
  // QC Cash Modal Overhaul (Nov 2026) adds 6: Tag (Tag new customers),
  // Moon (end-of-day summary), Phone / MapPin / CreditCard (card Call /
  // Location / Collect) and ClipboardList (Switch to Full Ledger) —
  // the picker's last 3D emoji become DS-0 SVGs.
  'Tag', 'Moon', 'Phone', 'MapPin', 'ClipboardList', 'CreditCard',
  // Home Dashboard polish (Nov 2026) adds 3: Calendar (Today badge),
  // Landmark (Cash in Hand bank glyph) and CheckCircle (Active
  // Subscribers) replace the last 3D emoji in the KPI strip / Today card.
  // (Landmark is shared with Collect Tab polish — listed once below.)
  'Calendar', 'CheckCircle',
  // Collect Tab & Field Operations Dashboard Polish (Nov 2026) adds 10:
  // Target (Today's Field Recovery), TrendingUp (Collection insights),
  // Landmark (Advance Held), Store / Coins / Wifi (Shop Cash +
  // Installation Tracker), Briefcase / Plug (Zone Field Dispatch Board)
  // and ChevronLeft / ChevronRight (Collected Feed pagination) — the
  // Collect dashboard loses its last 3D emoji.
  'Target', 'TrendingUp', 'Landmark', 'Store', 'Coins', 'Wifi',
  'Briefcase', 'Plug', 'ChevronLeft', 'ChevronRight',
  // More Tab & Wallet Inbox Polish (Nov 2026) adds 19: Hammer
  // (Complaint Register), TrendingDown (Downtime Analytics), RadioTower
  // (Upstream SLA), Signal (Fleet Uptime),
  // Ruler (Link Budget), Backpack (Field Bag), Factory (Supplier
  // Khata), Cylinder (Fiber Drums), Siren (Emergency Runbook),
  // CloudSun (Post-Storm Checklist), TreeDeciduous (Daisy-Chain Tree),
  // ClipboardCheck (Saad Visit Log), Pin (Pending Works), TreePine
  // (Pole Registry), Stethoscope (System Health), HardHat (Lineman
  // Scorecard), BatteryCharging (Power Backup), Inbox (Wallet empty
  // state), Satellite (PON Port
  // Capacity) — the 22 registry & operations cards + the Wallet inbox
  // lose their last 3D emoji. Paths verified against lucide-static
  // 1.72.0. NOTE (resolved at rebase onto main d80db831): Plug
  // (Collect Tab) and Calendar (Home Dashboard) had both merged —
  // their entries here are dropped and the count is recounted
  // to 19 new names (91 total: 72 + 19).
  'Hammer', 'TrendingDown', 'RadioTower', 'Signal', 'Ruler',
  'Backpack', 'Factory', 'Cylinder', 'Siren', 'CloudSun',
  'TreeDeciduous', 'ClipboardCheck', 'Pin', 'TreePine', 'Stethoscope',
  'HardHat', 'BatteryCharging', 'Inbox', 'Satellite',
];

test('DS-0 icons: the full §3.2 path set is exported (91 names: 37 DS-0 + 6 profile redesign + 4 QC receipt-modal overhaul + 2 live visual bugs + 5 customers directory polish + 6 QC cash modal overhaul + 3 home dashboard polish + 10 collect tab polish + 19 More Tab & Wallet Inbox polish, Landmark shared — counted once)', () => {
  assert.deepEqual([...DS_ICON_NAMES].sort(), [...EXPECTED_ICON_NAMES].sort(), 'ds-icons.js must export exactly the §3.2 icon set');
  for (const name of EXPECTED_ICON_NAMES) {
    assert.ok(isDsIconName(name), `${name} must be a known icon name`);
  }
});

test('DS-0 icons: dsIcon returns a valid inline SVG per name', () => {
  for (const name of EXPECTED_ICON_NAMES) {
    const svg = dsIcon(name);
    assert.ok(svg.startsWith('<svg '), `${name}: must start with <svg`);
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), `${name}: must carry the SVG namespace`);
    assert.ok(svg.includes('viewBox="0 0 24 24"'), `${name}: must use the 24x24 Lucide viewBox`);
    assert.ok(svg.includes('fill="none"'), `${name}: must be unfilled`);
    assert.ok(svg.includes('stroke="currentColor"'), `${name}: must inherit the text colour`);
    assert.ok(svg.includes('stroke-width="2"'), `${name}: must use stroke-width 2`);
    assert.ok(svg.includes('aria-hidden="true"'), `${name}: must be hidden from assistive tech`);
    assert.ok(svg.includes('width="20"') && svg.includes('height="20"'), `${name}: default size must be 20`);
    assert.ok(/<(path|circle|rect|line|polyline|polygon)[ >]/.test(svg), `${name}: must contain path data`);
    assert.ok(svg.endsWith('</svg>'), `${name}: must close the svg element`);
    const sized = dsIcon(name, 22);
    assert.ok(sized.includes('width="22"') && sized.includes('height="22"'), `${name}: explicit size must be honoured`);
  }
  assert.equal(dsIcon('NotAnIcon'), '', 'an unknown name must return an empty string, never throw');
  assert.equal(dsIcon(''), '', 'an empty name must return an empty string');
});

test('DS-0 icons: ds-icons.js is pure (no Date, /* */ header, no imports)', () => {
  const src = read('ds-icons.js');
  assert.ok(src.startsWith('/*'), 'a pure module header must be a /* */ block (Plan 457 rule)');
  assert.ok(!/new Date\(|Date\.now\(/.test(src), 'a pure module must not read the clock');
  assert.ok(!/^import /m.test(src), 'a pure module must not import anything');
  assert.ok(!src.includes('#'), 'ds-icons.js must contain no hex colour');
});

// --- §4.1: bottom nav ---------------------------------------------------------

test('DS-0 nav: 64px bar, 22px icons above 11px labels, 18px badges docked to the icon', () => {
  const bar = ruleBlock(stylesSrc, '.mobile-bottom-nav{');
  assert.ok(bar.includes('min-height:64px'), 'the bar must be 64px tall');
  assert.ok(bar.includes('border-top:1px solid var(--ds-line)'), 'the bar top border must be the --ds-line token');
  const button = ruleBlock(stylesSrc, '.mobile-bottom-nav button{');
  assert.ok(button.includes('display:flex'), 'the button must stack its icon over its label');
  assert.ok(button.includes("font:700 11px 'DM Sans'"), 'the label must stay 11px');
  const iconRule = ruleBlock(navSrc, '.bottom-nav-icon svg {');
  assert.ok(iconRule.includes('width: 22px') && iconRule.includes('height: 22px'), 'nav icons must be 22px');
  const badge = ruleBlock(navSrc, '.bottom-nav-badge {');
  assert.ok(badge.includes('height: 18px') && badge.includes('min-width: 18px'), 'badges must be 18px pills');
  assert.ok(badge.includes('font: 800 10px/18px'), 'badge text must be 10px on an 18px line');
  assert.ok(badge.includes('top: 2px') && badge.includes('right: calc(50% - 26px)'), 'badges must dock to the icon top-right');
  assert.ok(badge.includes('background: var(--ds-brand)'), 'the Customers badge must keep the brand green');
  const alert = ruleBlock(navSrc, '.bottom-nav-badge.badge-alert {');
  assert.ok(alert.includes('background: var(--ds-danger-strong)'), 'the Collect badge must keep the alert red');
});

test('DS-0 nav: the icon hooks are in the markup and wired at boot', () => {
  for (const icon of ['House', 'Users', 'HandCoins', 'BarChart3', 'Ellipsis']) {
    assert.ok(htmlSrc.includes(`data-ds-icon="${icon}"`), `the bottom nav must carry a ${icon} icon hook`);
  }
  for (const icon of ['Search', 'HandCoins', 'UserPlus', 'Bell', 'Wrench']) {
    assert.ok(htmlSrc.includes(`data-ds-icon="${icon}"`), `the speed-dial menu must carry a ${icon} icon hook`);
  }
  assert.ok(navJsSrc.includes("export function wireDsIcons"), 'nav.js must export wireDsIcons');
  assert.ok(appJsSrc.includes('wireDsIcons'), 'app.js must import wireDsIcons');
  assert.ok(appJsSrc.includes('wireDsIcons();'), 'app.js must call wireDsIcons at boot');
  // The nav buttons and the speed-dial menu carry icon hooks only —
  // slice each region out and check it holds no emoji at all (🏠 still
  // legitimately appears elsewhere, e.g. the More menu section label).
  const navStart = htmlSrc.indexOf('<nav class="mobile-bottom-nav"');
  const navEnd = htmlSrc.indexOf('</nav>', navStart);
  const navSlice = htmlSrc.slice(navStart, navEnd);
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(navSlice), 'the bottom nav must contain no emoji');
  const dialStart = htmlSrc.indexOf('id="speedDialMenu"');
  const dialEnd = htmlSrc.indexOf('id="speedDialTrigger"', dialStart);
  const dialSlice = htmlSrc.slice(dialStart, dialEnd);
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(dialSlice), 'the speed-dial menu must contain no emoji');
  // The speed-dial icons are 20px inside the menu.
  const dialIcon = ruleBlock(navSrc, '.speed-action-icon svg {');
  assert.ok(dialIcon.includes('width: 20px') && dialIcon.includes('height: 20px'), 'speed-dial icons must be 20px');
});

test('DS-0 icons: wireDsIcons fills [data-ds-icon] hooks, idempotent, 0 without a document', async () => {
  const { wireDsIcons } = await import('../nav.js');
  const makeEl = (name) => ({
    dataset: {},
    innerHTML: '',
    getAttribute: (k) => (k === 'data-ds-icon' ? name : null),
  });
  const els = [makeEl('House'), makeEl('Users'), makeEl('NotAnIcon')];
  const fakeDoc = { querySelectorAll: () => els };
  assert.equal(wireDsIcons(fakeDoc), 2, 'only known names are wired');
  assert.ok(els[0].innerHTML.startsWith('<svg '), 'the House hook gets its SVG');
  assert.ok(els[0].innerHTML.includes('stroke="currentColor"'), 'the wired SVG carries the Lucide stroke');
  assert.equal(els[0].dataset.dsIconWired, 'true', 'wired hooks are marked so a second pass skips them');
  assert.equal(els[2].innerHTML, '', 'unknown names are left alone, never filled with a broken icon');
  assert.equal(wireDsIcons(fakeDoc), 0, 'a second call wires nothing (idempotent)');
  assert.equal(wireDsIcons(null), 0, 'no document wires nothing');
  assert.equal(wireDsIcons({}), 0, 'a document without querySelectorAll wires nothing');
});

test('DS-0 nav: --bottom-nav-height followers use the 64px value', () => {
  // The fallbacks stay at 60px by design (pinned by the sticky-save
  // tests); the var itself is 64px, so every consumer follows it.
  assert.ok(tokensSrc.includes('--bottom-nav-height: 64px'), 'the var must be 64px');
  // Home Dashboard overhaul: the speed dial still sits on the nav
  // var (64px, 60px fallback) — plus the device safe-area inset,
  // so it never overlaps content or the nav on notched phones.
  assert.ok(navSrc.includes('bottom: calc(var(--bottom-nav-height, 60px) + 16px + env(safe-area-inset-bottom, 0px))'), 'the speed dial must sit on the nav var');
  assert.ok(stylesSrc.includes('bottom:calc(var(--bottom-nav-height, 64px) + 11px'), 'the More menu must sit on the nav var');
});

// --- §4.3: tabs ---------------------------------------------------------------

test('DS-0 tabs: equal-flex segmented control, sticky under the topbar', () => {
  const tabs = ruleBlock(stylesSrc, '.profile-tabs{');
  assert.ok(tabs.includes('background:var(--ds-tabs-bg)'), 'tabs must use the --ds-tabs-bg token');
  assert.ok(tabs.includes('padding:4px'), 'tabs must keep 4px padding');
  assert.ok(tabs.includes('border-radius:12px'), 'tabs must be a 12px segmented control');
  assert.ok(tabs.includes('position:sticky'), 'tabs must stick while the profile scrolls');
  assert.ok(tabs.includes('top:78px'), 'tabs must stick under the 78px desktop topbar');
  assert.ok(tabs.includes('z-index:2'), 'tabs must sit below modals and dialogs');
  const override = ruleBlock(stylesSrc, '.profile-tabs .profile-tab-button{');
  assert.ok(override.includes('flex:1 1 0'), 'tab buttons must share the row equally');
  assert.ok(override.includes('font-size:var(--text-tab)'), 'tab buttons must be 13px');
  const selected = ruleBlock(stylesSrc, '.profile-tab-button[aria-selected=true]{');
  assert.ok(selected.includes('background:var(--ds-brand)'), 'the selected tab must be solid brand');
  assert.ok(selected.includes('border-color:var(--ds-brand)'), 'the selected tab border must be solid brand');
  // Narrow widths follow the measured topbar: 58px at <=620px, 56px at <=380px.
  assert.ok(stylesSrc.includes('.profile-tabs{margin:14px 0 10px;padding:3px;top:58px}'), 'tabs must stick at 58px on phones');
  assert.ok(stylesSrc.includes('.profile-tabs.profile-tabs { top: 56px; }'), 'tabs must stick at 56px at 360px (the topbar is 56px there)');
  // Tabs keep their ids, counts, keyboard arrow-nav and aria-selected
  // behaviour — DS-0 changes only their presentation.
  for (const tabId of ['profileTabBilling', 'profileTabInfo', 'profileTabComplaints', 'profileTabBaqaya']) {
    assert.ok(htmlSrc.includes(`id="${tabId}"`), `the ${tabId} tab must keep its id`);
  }
  assert.ok(htmlSrc.includes('role="tab"') && htmlSrc.includes('aria-selected='), 'tabs must keep their tab roles and aria-selected state');
  assert.ok(appJsSrc.includes("$('.profile-tabs').addEventListener('keydown'"), 'tabs must keep their keyboard arrow-nav');
  assert.ok(appJsSrc.includes("event.key === 'ArrowRight'") && appJsSrc.includes("event.key === 'ArrowLeft'"), 'arrow keys must move between tabs');
});

// --- §4.2: floating buttons -----------------------------------------------------

test('DS-0 floating buttons: scroll-top is 40x40 on the right, shown only past 400px', () => {
  const button = ruleBlock(navSrc, '.scroll-top-button {');
  assert.ok(button.includes('width: 40px') && button.includes('height: 40px'), 'scroll-top must be 40x40');
  // The 40px height needs its own override rule: the global
  // button:not([hidden]) floor carries !important, so a plain
  // min-height in the base rule loses once the button is shown.
  const shown = ruleBlock(navSrc, '.scroll-top-button:not([hidden]) {');
  assert.ok(shown.includes('min-height: 40px !important'), 'scroll-top must clear the global 44px !important button floor when shown');
  // Pucho + Profile Header Polish: the scroll-top moved ABOVE the
  // speed-dial trigger (their boxes overlapped; the dial paints above at
  // z-index 1040). Bottom is now a calc (60px nav + 16 gap + 50 dial +
  // 12 clearance = 138px), not 74px — right: 18px stays.
  assert.ok(button.includes('bottom: calc(var(--bottom-nav-height, 60px) + 16px + 50px + 12px)') && button.includes('right: 18px'), 'scroll-top must stay on the right, above the dial');
  assert.ok(button.includes('background: var(--ds-brand)'), 'scroll-top must use the brand token');
  assert.ok(navJsSrc.includes('scrollY > 400'), 'scroll-top must appear only when scrolled past 400px (was 300)');
  assert.ok(!navJsSrc.includes('scrollY > 300'), 'the old 300px threshold must be gone');
});

// --- §4.2.1: bottom padding -----------------------------------------------------

test('DS-0 padding: body padding clears the nav + speed dial on every window-scrolled view', () => {
  // The dial top edge sits 130px above the viewport bottom at the 64px
  // nav (64 + 16 + 50); the 96px floor is inside that 130px.
  assert.ok(routerSrc.includes('padding-bottom: calc(130px + env(safe-area-inset-bottom, 0px))'), 'body padding-bottom must be 130px');
  assert.ok(routerSrc.includes('scroll-padding-bottom: calc(130px + env(safe-area-inset-bottom, 0px))'), 'scroll padding must match');
  // The main views are all window-scrolled at phone widths (no internal
  // scroller of their own), so body padding governs them; the profile
  // form already reserves room for its sticky save bar.
  assert.ok(read('profile-ui.css').includes('padding-bottom: 96px'), 'the profile form must keep its 96px sticky-save reserve');
  const saveBar = ruleBlock(read('profile-ui.css'), '.profile-sticky-save {');
  assert.ok(saveBar.includes('bottom: calc(var(--bottom-nav-height, 60px) + 8px)'), 'the sticky save bar must sit on the nav var');
});

// --- §1.5: shared component classes ---------------------------------------------

test('DS-0 components: the new .ds-* pieces exist, token-driven and hex-free', () => {
  for (const cls of ['.ds-icon-tile', '.ds-segmented', '.ds-stat-box', '.ds-table-card']) {
    assert.ok(componentsSrc.includes(cls), `components.css must provide ${cls}`);
  }
  const tile = ruleBlock(componentsSrc, '.ds-icon-tile {');
  assert.ok(tile.includes('width: 36px') && tile.includes('height: 36px'), 'the icon tile must be 36x36');
  assert.ok(tile.includes('border-radius: 8px'), 'the icon tile radius must be 8px');
  assert.ok(tile.includes('background: var(--ds-brand-soft)'), 'the icon tile must be soft-tinted');
  const tileIcon = ruleBlock(componentsSrc, '.ds-icon-tile svg {');
  assert.ok(tileIcon.includes('width: 20px') && tileIcon.includes('height: 20px'), 'the tile icon must be 20px');
  const segmented = ruleBlock(componentsSrc, '.ds-segmented {');
  assert.ok(segmented.includes('background: var(--ds-tabs-bg)'), 'the segmented control must use the tabs background');
  const statBox = ruleBlock(componentsSrc, '.ds-stat-box {');
  assert.ok(statBox.includes('min-height: 56px'), 'the stat box must be 56px tall');
  assert.ok(statBox.includes('background: var(--ds-nested)'), 'the stat box must use the nested surface');
  const tableCard = ruleBlock(componentsSrc, '.ds-table-card {');
  assert.ok(tableCard.includes('background: var(--ds-card)'), 'the table card must use the card surface');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(componentsSrc.replace(/\/\*[\s\S]*?\*\//g, '')), 'components.css must stay hex-free');
});

// --- §1.4: tabular numerals + §1.5: sticky blur ----------------------------------

test('DS-0 tabular numerals: money, dates and counts use var(--numeric)', () => {
  for (const cls of ['.payment-amount', '.statement-table .col-num', '.statement-table .num-col',
    '.current-bill-stat>strong', '.customer-billing-badge', '.profile-tab-button',
    '.incident-card-state', '.receipt-field dd.receipt-amount']) {
    assert.ok(stylesSrc.includes(cls), `styles.css must extend tabular numerals to ${cls}`);
  }
  assert.ok(navSrc.includes('font-variant-numeric: var(--numeric)'), 'the bottom-nav badge counts must use tabular numerals');
});

test('DS-0 sticky blur: topbar, tabs and bottom nav blur what scrolls under them', () => {
  const topbar = ruleBlock(stylesSrc, '.topbar{');
  assert.ok(topbar.includes('background:rgba(255,255,255,0.92)'), 'the topbar must be translucent white');
  assert.ok(topbar.includes('backdrop-filter:blur(12px)'), 'the topbar must blur');
  const darkTopbar = ruleBlock(stylesSrc, '[data-theme="dark"] .topbar {');
  assert.ok(darkTopbar.includes('background: rgba(21, 39, 34, 0.92)'), 'the dark topbar must be the dark translucent surface');
  const nav = ruleBlock(stylesSrc, '.mobile-bottom-nav{');
  assert.ok(nav.includes('background:rgba(255,255,255,0.92)'), 'the bottom nav must be translucent white');
  assert.ok(nav.includes('backdrop-filter:blur(12px)'), 'the bottom nav must blur');
  const darkNav = ruleBlock(stylesSrc, '[data-theme="dark"] .mobile-bottom-nav{');
  assert.ok(darkNav.includes('background:rgba(21,39,34,0.92)!important'), 'the dark bottom nav must be the dark translucent surface');
});
