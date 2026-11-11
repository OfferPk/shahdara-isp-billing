// Live visual bugs (Nov 2026, user phone screenshots 2026-11-11): six
// bugs folded into the Billing & Ledger PR. Each bug is pinned here
// with its root cause, so a later change that reintroduces one fails
// loudly instead of shipping silently.
//
// 1. Duplicate pencil on the green Edit button: ui-feedback.css had a
//    .profile-edit-button::before '✎' AND the button carries the
//    ds-icons Pencil SVG — two pencils side by side.
// 2. Technical QA mid-word wrapping: .qa-tool-label used
//    overflow-wrap:anywhere ("Plan Migratio/n"); star at 2px/16px;
//    filter chips showed the UA default dark button border.
// 3. Bottom nav icons missing (REAL code bug, not cache): the i18n
//    applier's step 5 did btn.textContent = ... on every language
//    apply, wiping the DS-0 icon spans (only the badge survived).
// 4. Profile sub-tabs: 1px number gap glued labels ("2Customer
//    Info"), "Billing (3 months)" clipped "4 Baqaya" to "4 Baqa", and
//    a thick grey scrollbar under the tab bar.
// 5. Topbar crush at 360px: backup pill to a 14px strip, "Mode:
//    Owner" clipped to "M/O"; 📷/🌐/🏍️ still 3D emoji.
// 6. Payments accordion: Advance button half-width, back-dated link
//    underlined.
//
// Synthetic data only; no real customer names or phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { t, updateDocumentTranslations } from '../nav-language.js';
import { dsIcon, isDsIconName } from '../ds-icons.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

const ruleBody = (css, pattern) => {
  const m = css.match(pattern);
  assert.ok(m, `rule must exist: ${pattern}`);
  return m[1];
};

// --- Bug 1: one pencil only -------------------------------------------

test('live bugs: the Edit button has no ::before pencil — the ds-icons SVG is the only pencil', () => {
  const css = read('ui-feedback.css');
  // No ::before rule at all on the Edit button (a comment in the file
  // explains the removal in words; the rule itself must be gone).
  assert.doesNotMatch(css, /\.profile-edit-button::before\s*\{/, 'no ::before rule may exist on the Edit button');
});

// --- Bug 2: QA labels, star, icon tile, chips -------------------------

test('live bugs: QA tool labels never break mid-word', () => {
  const css = read('styles.css');
  const label = ruleBody(css, /\.qa-tool-label \{([^}]*)\}/);
  assert.match(label, /word-break:\s*normal/, 'word-break is normal');
  assert.match(label, /overflow-wrap:\s*break-word/, 'overflow-wrap is break-word');
  assert.doesNotMatch(label, /anywhere|break-all/, 'never anywhere or break-all — both break words mid-word');
});

test('live bugs: QA tools grid is one column at <=480px so long words fit whole', () => {
  // Measured in live Chromium at 360px: the 2-column grid left each
  // label ~51px (30px tile + 8px gap + 30px star padding), but
  // 'Reflectance' needs 64px and 'Dispersion' 58px at 11px — so the
  // wrap fix alone could not keep them whole. One column gives the
  // label ~192px, so every tool word fits. There are several ≤480px
  // blocks now, so scan every one for the grid rule.
  const css = read('styles.css');
  const needle = '@media (max-width: 480px)';
  let found = false;
  let at = css.indexOf(needle);
  assert.ok(at >= 0, 'styles.css has a ≤480px block');
  while (at >= 0) {
    const block = css.slice(at, at + 400);
    if (/\.customer-technical-grid \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/.test(block)) found = true;
    at = css.indexOf(needle, at + needle.length);
  }
  assert.ok(found, 'a ≤480px block makes .customer-technical-grid one column');
});

test('live bugs: QA favourite star sits 6px in at 14px, icon tile is 30px', () => {
  const css = read('styles.css');
  const star = ruleBody(css, /\.qa-fav-toggle \{([^}]*)\}/);
  assert.match(star, /top:\s*6px/, 'star top is 6px');
  assert.match(star, /right:\s*6px/, 'star right is 6px');
  assert.match(star, /font-size:\s*14px/, 'star glyph is 14px');
  // Two-class selector on purpose: the QA icon span carries BOTH
  // .ds-icon-tile and .qa-tool-icon, and components.css (36px) loads
  // AFTER styles.css — the bare .qa-tool-icon rule lost the cascade at
  // equal specificity and the tile measured 36px in live Chromium.
  // .ds-icon-tile.qa-tool-icon (0,2,0) beats .ds-icon-tile (0,1,0)
  // regardless of load order.
  const tile = ruleBody(css, /\.ds-icon-tile\.qa-tool-icon \{([^}]*)\}/);
  assert.match(tile, /width:\s*30px/, 'tile is 30px wide');
  assert.match(tile, /height:\s*30px/, 'tile is 30px tall');
  assert.match(tile, /font-size:\s*12\.5px/, 'tile font is 12.5px');
  const tileSvg = ruleBody(css, /\.ds-icon-tile\.qa-tool-icon svg \{([^}]*)\}/);
  assert.match(tileSvg, /width:\s*18px/, 'tile svg is 18px wide');
  assert.match(tileSvg, /height:\s*18px/, 'tile svg is 18px tall');
});

test('live bugs: QA filter chips carry a light border on white, not the UA default', () => {
  const css = read('styles.css');
  const chips = ruleBody(css, /\.qa-chip-row \.qa-chip \{([^}]*)\}/);
  // Hexes lowercase on purpose: the design-tokens ratchet counts hex
  // case-sensitively and both lowercase forms already occur in this
  // file, so the distinct count is unchanged (same colours as #CBD5E1
  // / #FFFFFF, written as the file already writes them).
  assert.match(chips, /border:\s*1px solid var\(--ds-border, #cbd5e1\)/, 'chip border is the token with the #cbd5e1 fallback');
  assert.match(chips, /background:\s*#ffffff/, 'chip background is white');
});

// --- Bug 3: bottom-nav icons survive the i18n applier -----------------
//
// Minimal fake DOM: the applier only reads querySelector /
// textContent and writes textContent / appendChild / insertBefore.
// Setting textContent clears children, like the real DOM — which is
// exactly how the old code wiped the icon spans.
class MiniEl {
  constructor(attrs = {}, text = '') {
    this._attrs = { ...attrs };
    this._text = text;
    this.children = [];
  }

  get textContent() {
    if (this.children.length) return this.children.map((c) => c.textContent).join('');
    return this._text;
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  get firstChild() {
    return this.children[0] || null;
  }

  getAttribute(name) {
    return this._attrs[name] ?? null;
  }

  querySelector(selector) {
    if (selector.startsWith('.')) {
      return this.children.find((c) => (c._attrs.class || '').split(' ').includes(selector.slice(1))) || null;
    }
    return null;
  }

  appendChild(child) {
    const at = this.children.indexOf(child);
    if (at !== -1) this.children.splice(at, 1);
    this.children.push(child);
    return child;
  }

  insertBefore(child, ref) {
    const at = this.children.indexOf(child);
    if (at !== -1) this.children.splice(at, 1);
    const refAt = ref ? this.children.indexOf(ref) : -1;
    if (refAt === -1) this.children.push(child);
    else this.children.splice(refAt, 0, child);
    return child;
  }
}

function bottomNavButton(labelText) {
  const icon = new MiniEl({ class: 'bottom-nav-icon', 'data-ds-icon': 'HandCoins' });
  icon.children = [new MiniEl({}, '')]; // the injected SVG
  const label = new MiniEl({ class: 'bottom-nav-label' }, labelText);
  const badge = new MiniEl({ class: 'bottom-nav-badge' }, '40');
  const btn = new MiniEl({ 'data-mobile-nav': 'collection' });
  btn.children = [icon, label, badge];
  return { btn, icon, label, badge };
}

function navContainer(buttons) {
  return {
    querySelectorAll() { return []; },
    querySelector(selector) {
      const m = /\[data-mobile-nav="([^"]+)"\]/.exec(selector);
      if (!m) return null;
      return buttons.find((b) => b.getAttribute('data-mobile-nav') === m[1]) || null;
    },
  };
}

test('live bugs: the i18n applier keeps the bottom-nav icon spans (REPRO of the missing icons)', () => {
  // Fails on the old step-5 code (btn.textContent wiped the icon span
  // and the label span, re-appending only the badge).
  const { btn, icon, label, badge } = bottomNavButton('Collection');
  updateDocumentTranslations('en', navContainer([btn]));
  assert.equal(label.textContent, t('nav_collection', 'en'), 'label is translated in place');
  assert.equal(label.textContent, 'Collect', 'EN label is Collect');
  assert.ok(btn.children.includes(icon), 'the icon span survives the language apply');
  assert.equal(icon.children.length, 1, 'the injected SVG inside the icon span survives');
  assert.ok(btn.children.includes(badge), 'the badge survives');
  assert.equal(btn.children[0], icon, 'the icon stays first, above the label');
});

test('live bugs: the bottom-nav fix works in Urdu and without a label span (stale HTML)', () => {
  const ur = bottomNavButton('Collection');
  updateDocumentTranslations('ur', navContainer([ur.btn]));
  assert.equal(ur.label.textContent, 'وصولی', 'UR label applies in place');
  assert.ok(ur.btn.children.includes(ur.icon), 'the icon span survives the Urdu apply too');

  // Stale cached index.html without a .bottom-nav-label span: the
  // fallback must still keep the icon and the badge.
  const stale = bottomNavButton('Collection');
  const labelAt = stale.btn.children.indexOf(stale.label);
  stale.btn.children.splice(labelAt, 1);
  updateDocumentTranslations('en', navContainer([stale.btn]));
  assert.ok(stale.btn.children.includes(stale.icon), 'fallback keeps the icon span');
  assert.ok(stale.btn.children.includes(stale.badge), 'fallback keeps the badge');
  assert.equal(stale.btn.children[0], stale.icon, 'fallback puts the icon first');
});

test('live bugs: the applier writes the nav label span, never the button text', () => {
  const src = read('nav-language.js');
  const start = src.indexOf('const bottomNavMap = {');
  assert.notEqual(start, -1, 'the bottom-nav map must exist');
  const block = src.slice(start, src.indexOf('// 6. Update Drawer group titles', start));
  assert.ok(block.includes("btn.querySelector('.bottom-nav-label')"), 'step 5 targets the label span');
  assert.ok(block.includes('label.textContent = t(key, activeLang);'), 'step 5 writes the label span only');
});

// --- Bug 4: tabs ---------------------------------------------------------

test('live bugs: the Billing panel header carries the months figure the tab no longer shows', () => {
  const html = read('index.html');
  const at = html.indexOf('id="profileBillingMonthsCount"');
  assert.notEqual(at, -1, 'the panel months element must exist');
  const heading = html.slice(html.lastIndexOf('<div class="ledger-heading">', at), at);
  assert.ok(heading.includes('Last 24 months'), 'the months line sits in the Billing panel header under "Last 24 months"');
  assert.ok(html.includes('<p class="history-count" id="profileBillingMonthsCount" hidden>'), 'the months line starts hidden (zero months)');
});

// --- Bug 5: topbar -------------------------------------------------------

test('live bugs: the topbar QR / language / field-mode buttons use ds-icons, not emoji', () => {
  const html = read('index.html');
  const qr = html.slice(html.indexOf('id="qrScanTopbarBtn"'), html.indexOf('</button>', html.indexOf('id="qrScanTopbarBtn"')));
  assert.ok(qr.includes('data-ds-icon="QrCode"'), 'QR button carries the QrCode hook');
  assert.ok(!qr.includes('📷'), 'QR button has no camera emoji left');
  const field = html.slice(html.indexOf('id="fieldModeToggleBtn"'), html.indexOf('</button>', html.indexOf('id="fieldModeToggleBtn"')));
  assert.ok(field.includes('data-ds-icon="Bike"'), 'field-mode button carries the Bike hook');
  assert.ok(!field.includes('🏍️'), 'field-mode button has no motorcycle emoji left');
  // Home Dashboard overhaul: the language toggle moved from the
  // topbar into the nav drawer header — only ONE Globe hook
  // remains (the mobile-More language toggle id is wired in
  // nav-language.js but has no element in the markup).
  assert.equal((html.match(/class="lang-icon" data-ds-icon="Globe"/g) || []).length, 1, 'the drawer language toggle carries the Globe hook');
  assert.ok(!html.includes('<span class="lang-icon" aria-hidden="true">🌐</span>'), 'no globe-emoji language icon survives');
  assert.ok(isDsIconName('QrCode') && isDsIconName('Globe') && isDsIconName('Bike'), 'all three names resolve in ds-icons.js');
  assert.ok(dsIcon('Globe', 20).includes('<svg'), 'Globe renders an SVG');
  assert.ok(dsIcon('Bike', 20).includes('<svg'), 'Bike renders an SVG');
});

test('live bugs: the topbar cannot crush at phone widths — operator toggle lives in the drawer, backup pins to 38px', () => {
  const css = read('styles.css');
  // Home Dashboard overhaul: the operator toggle moved from the
  // topbar into the nav drawer footer — the topbar display:none
  // rule is deleted with it; the toggle is not a topbar element
  // any more.
  assert.ok(!css.includes('.topbar #operatorModeToggleBtn'), 'no topbar-scoped operator rule survives');
  assert.ok(read('index.html').includes('id="operatorModeToggleBtn"'), 'operator toggle lives in the drawer footer');
  assert.ok(css.includes('.topbar .backup-health-badge { flex: 0 0 auto; width: 38px; min-width: 38px; padding: 0; justify-content: center; }'),
    'the backup pill pins to a 38px dot instead of crushing to a 14px strip');
  assert.ok(css.includes('.topbar #fieldModeToggleBtn { width: 38px; height: 38px; min-height: 38px;'),
    'the 38px rule is scoped to the icon-only field-mode toggle');
  assert.ok(!css.includes('.topbar .field-mode-toggle-btn { width: 38px;'), 'the old class rule must not crush the text operator button anymore');
});

// --- Bug 6: payments accordion ------------------------------------------

test('live bugs: Advance payment is a full row and the back-dated link is not underlined', () => {
  const ui = read('profile-ui.css');
  assert.ok(ui.includes('.profile-more-actions-category-grid > #advancePaymentButton {\n  grid-column: 1 / -1;\n}'),
    'Advance payment spans the full grid row');
  const feedback = read('ui-feedback.css');
  const backdated = ruleBody(feedback, /\.backdated-payment-link \{([^}]*)\}/);
  assert.match(backdated, /text-decoration:\s*none/, 'the back-dated link has no underline');
  assert.doesNotMatch(backdated, /underline/, 'no underline survives in that rule');
});
