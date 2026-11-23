// Profile Info tab SERVICE/CONNECTION pills — the right-column tiles
// ('Vacation hold', 'Package speed', 'ISP provider', 'Cancellation
// date') overflow and clip at the right edge on 360px screens, and the
// capsule (rounded-full) shape makes uneven widths look awkward.
//
// Adapted from the prep repro (repro-profile-info-pills.mjs, base 7/13)
// with two adaptations, both documented where they land:
// - C1: the fix is --service-SCOPED (parent decision), so C1 asserts the
//   scoped grid rule (gap 10px), not the generic grid rule — the generic
//   phone gap stays 7px for the other six groups.
// - C1/C6 media lookup: the prep repro's parser only matched the spaced
//   `@media (max-width: 620px)` form, but the actual phone block at
//   styles.css:17616 uses the no-space `@media(max-width:620px)` form,
//   so its phoneGrid/phoneField lookups returned undefined on base. The
//   parser here matches both forms.
// - C5: also asserts the dot MARKUP (a 6-tuple row renders the span).
// C tests assert the FIXED state. S tests are stability (PASS on base AND
// with the fix). B tests are behaviour (PASS on base AND with the fix).
// 0 parity literals in this file (it is not a pinning file).
//
// Harness: the stylesheet-value approach (Polish #17/#21/#25/#27
// pattern) + the polish28-phase-a runInNewContext pattern for the
// profileInfoGroupMarkup renderer — read the CSS/JS/i18n as text and
// assert the values; no browser, no DOM dispatch, no mock window.
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = process.argv[2] || '.';
const read = (name) => readFileSync(join(root, name), 'utf8');
const stylesSrc = read('styles.css');
const appSrc = read('app.js');
const { manualServiceStatusBareLabel } = await import(
  pathToFileURL(join(root, 'profile-labels.js')).href
);

// ---- CSS helpers (stat-cards repro pattern) ----
function ruleBlock(source, selectorWithBrace) {
  const start = source.indexOf(selectorWithBrace);
  if (start < 0) return null;
  const open = source.indexOf('{', start);
  let depth = 0;
  let i = open;
  for (; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (i >= source.length) return null;
  return source.slice(open + 1, i);
}

// Matches BOTH `@media(max-width:620px)` and `@media (max-width: 620px)`:
// the repo uses both forms, and the info-group phone block itself is the
// no-space form — a spaced-only parser misses it entirely.
function media620Blocks(source) {
  const blocks = [];
  let from = 0;
  for (;;) {
    const at = source.indexOf('@media', from);
    if (at < 0) return blocks;
    const open = source.indexOf('{', at);
    if (open < 0) return blocks;
    const prelude = source.slice(at, open);
    if (!/max-width:\s*620px/.test(prelude)) {
      from = open + 1;
      continue;
    }
    let depth = 0;
    let i = open;
    for (; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (i >= source.length) return blocks;
    blocks.push(source.slice(open + 1, i));
    from = i + 1;
  }
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const distinctHex = (s) =>
  new Set(stripComments(s).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).size;

// ---- renderer (polish28-phase-a pattern) ----
const escapeHtml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PROFILE_EMPTY_DASH = '—';
const fieldStart = appSrc.indexOf('function profileReadonlyField(');
const markupStart = appSrc.indexOf('function profileInfoGroupMarkup(');
const markupEnd = appSrc.indexOf('\n}\n', markupStart);
assert.ok(fieldStart >= 0 && markupStart > fieldStart && markupEnd > markupStart,
  'profileReadonlyField + profileInfoGroupMarkup must exist in app.js');
const profileInfoGroupMarkup = runInNewContext(
  `${appSrc.slice(fieldStart, markupEnd + 3)}\nprofileInfoGroupMarkup;`,
  { escapeHtml, PROFILE_EMPTY_DASH },
);

const SERVICE_ROWS = [
  ['ISP provider', 'Nayatel', false, '', 'ispProviderInput'],
  ['Service status', 'Active', false, '', 'serviceStatusInput'],
  ['Vacation hold', 'Not paused', false, '', 'pauseBillingCheckbox'],
  ['Do not suspend', 'No shield', false, '', 'doNotSuspendUntilInput'],
  ['Package speed', '5Mbps / 150GB', false, '', 'packageSpeedInput'],
  ['Usual pay day', 'Not enough payments yet'],
];
const LIFECYCLE_ROWS = [
  ['Expiry / end date', '—', false, '', 'expiryDateInput'],
  ['Cancellation date', '—', false, '', 'cancellationDateInput'],
];
const serviceHtml = profileInfoGroupMarkup('Service', SERVICE_ROWS, '', 'profile-info-group--service');
const lifecycleHtml = profileInfoGroupMarkup('Connection', LIFECYCLE_ROWS, '', 'profile-info-group--service');

const serviceRule = ruleBlock(stylesSrc, '.profile-info-group--service .profile-readonly-field{');
const serviceDt = ruleBlock(stylesSrc, '.profile-info-group--service .profile-readonly-field dt{');
const serviceDd = ruleBlock(stylesSrc, '.profile-info-group--service .profile-readonly-field dd{');
const phoneBlocks = media620Blocks(stylesSrc);
const phoneGrid = phoneBlocks
  .map((b) => ruleBlock(b, '.profile-info-group .profile-readonly-grid{'))
  .find(Boolean);
const phoneField = phoneBlocks
  .map((b) => ruleBlock(b, '.profile-info-group .profile-readonly-field{'))
  .find(Boolean);
const servicePhoneGrid = phoneBlocks
  .map((b) => ruleBlock(b, '.profile-info-group--service .profile-readonly-grid{'))
  .find(Boolean);
const servicePhoneField = phoneBlocks
  .map((b) => ruleBlock(b, '.profile-info-group--service .profile-readonly-field{'))
  .find(Boolean);

// C1: strict equal 50/50 2-column grid at phone widths, gap 2.5 (10px) —
// scoped to the --service groups (parent decision): the generic phone
// grid keeps its 7px gap for the other six groups.
test('C1 grid: SERVICE + CONNECTION stay 2 columns at 360px, gap 10px', () => {
  assert.ok(phoneGrid, 'the 620px phone override for the info-group grid must exist');
  assert.ok(phoneGrid.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),
    'phone grid must stay repeat(2,minmax(0,1fr))');
  assert.ok(servicePhoneGrid, 'a --service-scoped phone grid rule must exist');
  assert.ok(servicePhoneGrid.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),
    'the --service phone grid must stay repeat(2,minmax(0,1fr))');
  assert.ok(/gap:\s*10px/.test(servicePhoneGrid), `the --service phone grid gap must be 10px (got ${servicePhoneGrid.trim()})`);
  assert.ok(/gap:\s*7px/.test(phoneGrid), 'the generic phone grid gap stays 7px for the other groups');
  const baseField = ruleBlock(stylesSrc, '.profile-readonly-field{');
  assert.ok(baseField && baseField.includes('min-width:0'), 'every grid item keeps min-width:0');
});

// C2: tiles are sleek uniform cards, not capsules — on-scale radius,
// px-3 py-2.5 padding, flex column, justify-between.
test('C2 tiles: rounded-2xl cards (on-scale radius), px-3 py-2.5, flex column', () => {
  assert.ok(serviceRule, 'the --service tile rule must exist');
  assert.ok(!serviceRule.includes('999px'), 'the capsule radius must be gone from the --service tiles');
  assert.ok(/border-radius:\s*(var\(--radius-(md|lg)\)|14px|18px)/.test(serviceRule),
    `tile radius must be on-scale (14px/18px or --radius-md/lg), got: ${serviceRule.trim()}`);
  assert.ok(/padding:\s*10px 12px/.test(serviceRule),
    `tile padding must be py-2.5 px-3 (10px 12px), got: ${serviceRule.trim()}`);
  assert.ok(serviceRule.includes('display:flex'), 'tiles stay flex');
  assert.ok(serviceRule.includes('flex-direction:column'), 'tiles stay column');
  assert.ok(serviceRule.includes('justify-content:space-between'),
    'tiles justify content between (label top, value bottom)');
});

// C3: label 11px semibold emerald, value 14px semibold slate — scoped
// to the --service tiles (the base 10px/12px rules and the other groups
// keep their sizes).
test('C3 type: label 11px semibold emerald, value 14px semibold slate', () => {
  assert.ok(serviceDt, 'a --service-scoped label (dt) rule must exist');
  assert.ok(/font-size:\s*11px/.test(serviceDt), `label must be 11px, got: ${serviceDt.trim()}`);
  assert.ok(/font-weight:\s*600/.test(serviceDt), `label must be semibold (600), got: ${serviceDt.trim()}`);
  assert.ok(/#0e5b4d|#065f46|#047857|var\(--qc-mint-strong-text\)|var\(--qc-emerald-text\)/.test(serviceDt),
    `label must stay emerald, got: ${serviceDt.trim()}`);
  assert.ok(serviceDd, 'a --service-scoped value (dd) rule must exist');
  assert.ok(/font-size:\s*14px/.test(serviceDd), `value must be 14px, got: ${serviceDd.trim()}`);
  assert.ok(/font-weight:\s*600/.test(serviceDd), `value must be semibold (600), got: ${serviceDd.trim()}`);
  assert.ok(/#334155|#1e293b|#0f172a|var\(--color-slate-700\)/.test(serviceDd),
    `value must be slate, got: ${serviceDd.trim()}`);
  assert.ok(/overflow-wrap:\s*(anywhere|break-word)|word-break:\s*break-word/.test(serviceDd),
    'long values must wrap inside their own tile');
});

// C4: Service status tile shows the bare word, never the repeated label.
test('C4 value: Service status tile shows bare Active, no repeated label', () => {
  assert.equal(manualServiceStatusBareLabel('active'), 'Active', 'bare label is just the word');
  const fragStart = appSrc.indexOf("service: profileInfoGroupMarkup(t('prof_group_service')");
  const fragEnd = appSrc.indexOf("money: profileInfoGroupMarkup(t('prof_group_service')", fragStart);
  assert.ok(fragStart >= 0 && fragEnd > fragStart, 'service fragment must exist in app.js');
  const frag = appSrc.slice(fragStart, fragEnd);
  assert.ok(frag.includes('manualServiceStatusBareLabel(customer.serviceStatus)'),
    'the Service status row must use the bare label');
  assert.ok(!frag.includes('manualServiceStatusLabel(customer.serviceStatus)'),
    'the Service status row must NOT use the prefixed label');
  assert.ok(!serviceHtml.includes('Service status: Active'),
    'the rendered tile never repeats the label in the value');
  assert.ok(/<dd[^>]*>Active<\/dd>/.test(serviceHtml), 'the rendered value is the bare word Active');
});

// C5: the Active tile carries a small emerald status dot — rule AND markup.
test('C5 dot: the Active tile carries a small emerald status dot', () => {
  const dotRule =
    ruleBlock(stylesSrc, '.profile-info-status-dot{') ||
    [...stylesSrc.matchAll(/([^{}]*serviceStatusInput[^{}]*::before\{[^}]*\})/g)].map((m) => m[1])[0] ||
    [...stylesSrc.matchAll(/([^{}]*profile-info-status-dot[^{}]*\{[^}]*\})/g)].map((m) => m[1])[0];
  assert.ok(dotRule, 'a dot rule for the Service status tile must exist');
  assert.ok(/#26945a|#19704e|var\(--color-paid\)|var\(--color-emerald\)|#047857|#065f46|#10b981/.test(dotRule),
    `the dot must be emerald, got: ${String(dotRule).slice(0, 160)}`);
  assert.ok(/width:\s*[78]px/.test(dotRule), 'the dot is small (7-8px)');
  // Markup: a row carrying the 6th tuple element renders the dot span
  // before the value, and the dd becomes a flex row for that tile only.
  const dottedHtml = profileInfoGroupMarkup('Service',
    [['Service status', 'Active', false, '', 'serviceStatusInput', 'profile-info-status-dot--active']],
    '', 'profile-info-group--service');
  assert.ok(dottedHtml.includes('<span class="profile-info-status-dot profile-info-status-dot--active"></span>'),
    'the dot span renders before the value');
  assert.ok(/<dd class="profile-info-status-dd">/.test(dottedHtml),
    'the dotted tile dd becomes a flex row');
  assert.ok(!serviceHtml.includes('profile-info-status-dot'),
    'rows without a dot element render no dot');
});

// C6: at phone widths the tiles keep the px-3 py-2.5 padding (the old
// 7px 8px phone override must not shrink them back) — via the
// --service-scoped phone rule; the generic phone padding stays 7px 8px
// for the other groups.
test('C6 phone padding: tiles keep 10px 12px at 360px', () => {
  assert.ok(phoneField, 'the 620px phone field rule must exist');
  assert.ok(servicePhoneField, 'a --service-scoped phone field rule must exist');
  assert.ok(/padding:\s*10px 12px/.test(servicePhoneField),
    `phone tile padding must be 10px 12px, got: ${servicePhoneField.trim()}`);
  assert.ok(/padding:\s*7px 8px/.test(phoneField),
    'the generic phone field padding stays 7px 8px for the other groups');
});

// C7: border + background stay the emerald family (already true on base:
// the current teal border/bg already satisfy the spec's emerald slots).
test('C7 colours: tile border + background stay emerald', () => {
  assert.ok(serviceRule, 'the --service tile rule must exist');
  assert.ok(/border:\s*1px solid (#9acbad|#a7f3d0|var\(--qc-mint-border\))/i.test(serviceRule),
    `border must be emerald (#9acbad or #a7f3d0), got: ${serviceRule.trim()}`);
  assert.ok(/background:\s*(#e7f2ec|#ecfdf5|var\(--qc-mint-bg\))/i.test(serviceRule),
    `background must be emerald (#e7f2ec or #ecfdf5), got: ${serviceRule.trim()}`);
});

// S1: service + lifecycle keep the --service class and stay adjacent in
// the Service section body.
test('S1 groups: service + lifecycle keep the class, stay adjacent', () => {
  assert.ok(serviceHtml.startsWith('<section class="profile-info-group profile-info-group--service"><h4>Service</h4>'),
    'service section keeps its class + heading');
  assert.ok(lifecycleHtml.startsWith('<section class="profile-info-group profile-info-group--service"><h4>Connection</h4>'),
    'lifecycle section keeps the same class + heading');
  assert.ok(appSrc.includes('${profileInfoGroupFragments.service}${profileInfoGroupFragments.lifecycle}'),
    'service + lifecycle stay adjacent in the Service section body');
});

// S2: the other groups keep their capsule pills (the fix is scoped to
// --service only).
// Re-pin (P/Q/R rebase 2026-11-23): 'money' drops out of this list —
// PQR's Group 3 deliberately deletes the 999px pill for the --money
// group only (its own new test C12 pins the key-value rows), so the
// money rule no longer carries border-radius:999px. The other five
// groups still keep their capsule pills.
test('S2 scope: contact/location/install/network/hardware keep 999px pills', () => {
  for (const group of ['contact', 'location', 'install', 'network', 'hardware']) {
    const rule = ruleBlock(stylesSrc, `.profile-info-group--${group} .profile-readonly-field{`);
    assert.ok(rule && rule.includes('border-radius:999px'), `${group} keeps its capsule pill`);
  }
});

// S3: the prefixed label function is unchanged (other surfaces still use it).
test('S3 labels: manualServiceStatusLabel keeps its prefixed wording', () => {
  assert.ok(appSrc.includes("prof_service_status: 'Service status: {label}'") ||
    read('nav-language.js').includes("prof_service_status: 'Service status: {label}'"),
    'the i18n template stays');
});

// S4: the 2-column override pin still holds (polish28-phase-a).
test('S4 grid pin: the phone override still forces 2 columns', () => {
  assert.ok(stylesSrc.includes('.profile-info-group .profile-readonly-grid{grid-template-columns:repeat(2,minmax(0,1fr))'),
    'override must still force 2 columns at phone width');
});

// B1: no new hex in styles.css.
// Re-pin (Info pills rebase 2026-11-23): 608 → 610 is the intervening
// Customers List Cards polish (#1613), which added the two spec literals
// navy #1E3A5F + rose-800 #9f1239. This PR adds no new hex itself —
// the merged styles.css hex set is identical to the new base's.
test('B1 hex: styles.css stays at 610 distinct hex', () => {
  assert.equal(distinctHex(stylesSrc), 610, 'no new hex may appear');
});

// B2: the Service tenure section is a separate component and is untouched.
test('B2 tenure: the Service tenure pill is its own component, untouched', () => {
  const tenure = read('service-tenure.js');
  assert.ok(tenure.includes('service-tenure-section stv-section'), 'tenure keeps its own section');
  assert.ok(stylesSrc.includes('.stv-primary{display:inline-flex'),
    'the tenure pill keeps its own rule');
  assert.ok(!serviceHtml.includes('stv-primary'), 'the service tiles never render the tenure pill');
});
