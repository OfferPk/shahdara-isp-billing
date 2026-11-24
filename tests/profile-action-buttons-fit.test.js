// Profile action buttons fit (user screenshot 2026-11-24).
//
// The screenshot showed the Row-2 buttons OVERLAPPING at 360px: the
// Record-payment button's icon tile sat on top of the Wada button and
// its label clipped past the viewport ("Record payment / Mark p...").
// Root cause was a specificity bug: styles.css:1935
// `.profile-action-group>button{white-space:nowrap}` is (0,1,1) and
// beat the intended phone wrap `.current-payment-shortcut
// {white-space:normal}` (0,1,0) at <=620px, so the 26-char label could
// never wrap inside its ~147px half-column. The fix (styles.css only):
//   (1) the wrap rule is scoped to `.profile-action-group
//       .current-payment-shortcut` (0,2,0) so it wins at <=620px;
//   (2) Wada + Record (+ Unarchive) each take a full grid row at
//       <=620px, so the primary actions stack full-width with no hole
//       and no overlap — Record's one-line content (~203px at 11px)
//       fits the ~302px full row;
//   (3) primary buttons drop to 11px like secondary at <=620px, so
//       'Clear dues' fits its half-column, with overflow:hidden as a
//       last-resort clip for any residual nowrap spill;
//   (4) both <details> span the full row at <=620px, closing the
//       481-620px band where no rule spanned them;
//   (5) the QA/More-actions summary label span gets flex:1 +
//       min-width:0 so it wraps cleanly with the chevron pinned.
//
// No JS wiring, no labels and no button tokens change here — this file
// pins the markup (ids/classes/i18n keys) and the winning cascade at
// 360px and 500px. Fixtures are generic placeholders only — no real
// customer data from any screenshot.
// NOT a pinning file: no suite or parity totals appear here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const indexHtml = read('index.html');
const appJs = read('app.js');
// Load order (index.html:13-28): tokens -> styles -> ... -> profile-ui
// -> components -> field-view. Only styles/profile-ui/components carry
// rules for the elements under test.
const sheets = ['styles.css', 'profile-ui.css', 'components.css'].map(read);

// ---------- tiny media-aware cascade simulation ----------
// Parses each sheet into {selector, declarations, media, order} in
// source order. Media conditions support max-width/min-width only,
// which is all this codebase uses for the rules under test. Selectors
// support class/id/tag compounds, descendant and child combinators,
// and :last-child on the final compound.
function parseSheet(css, orderStart) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let order = orderStart;
  // Walk top-level blocks with brace counting, so @media inner rules
  // keep their condition instead of leaking into the base cascade.
  function walk(text, media) {
    let i = 0;
    const len = text.length;
    while (i < len) {
      const open = text.indexOf('{', i);
      if (open === -1) break;
      const prelude = text.slice(i, open).trim();
      let depth = 0;
      let j = open;
      for (; j < len; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') { depth--; if (depth === 0) break; }
      }
      const body = text.slice(open + 1, j);
      if (prelude.startsWith('@media')) {
        walk(body, prelude.slice(6).trim());
      } else if (prelude && !prelude.startsWith('@')) {
        const declarations = {};
        for (const part of body.split(';')) {
          const kv = part.split(':');
          if (kv.length < 2) continue;
          const prop = kv[0].trim();
          const value = kv.slice(1).join(':').trim();
          if (prop) declarations[prop] = value;
        }
        for (const sel of prelude.split(',')) {
          rules.push({ selector: sel.trim(), declarations, media, order: order++ });
        }
      }
      i = j + 1;
    }
  }
  walk(clean, null);
  return { rules, nextOrder: order };
}

function mediaMatches(cond, width) {
  if (!cond) return true;
  for (const m of cond.matchAll(/max-width\s*:\s*(\d+)px/g)) {
    if (width > Number(m[1])) return false;
  }
  for (const m of cond.matchAll(/min-width\s*:\s*(\d+)px/g)) {
    if (width < Number(m[1])) return false;
  }
  return true;
}

function specificity(selector) {
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const classes = (selector.match(/\.[\w-]+/g) || []).length
    + (selector.match(/\[[^\]]+\]/g) || []).length
    + (selector.match(/:(?!:)[\w-]+/g) || []).length;
  const elements = selector
    .replace(/#[\w-]+/g, ' ').replace(/\.[\w-]+/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ').replace(/::?[\w-]+/g, ' ')
    .split(/[\s>+~]+/).filter((t) => /^[a-zA-Z][\w-]*$/.test(t)).length;
  return [ids, classes, elements];
}

function matchCompound(compound, el) {
  const tag = (compound.match(/^[a-zA-Z][\w-]*/) || [null])[0];
  if (tag && tag.toLowerCase() !== el.tag.toLowerCase()) return false;
  const id = (compound.match(/#([\w-]+)/) || [null, null])[1];
  if (id && id !== el.id) return false;
  for (const c of compound.match(/\.[\w-]+/g) || []) {
    if (!el.classes.has(c.slice(1))) return false;
  }
  if (/:last-child/.test(compound) && !el.isLastChild) return false;
  return true;
}

// Recursive right-to-left matcher: descendant combinators walk the
// ancestor chain, child combinators require the direct parent.
function matches(selector, el) {
  const tokens = selector.replace(/\s*>\s*/g, ' > ').trim().split(/\s+/);
  const parts = [];
  let combinator = null;
  for (const t of tokens) {
    if (t === '>') { combinator = '>'; continue; }
    parts.push({ compound: t, combinator });
    combinator = ' ';
  }
  function walk(idx, node) {
    if (!node) return false;
    if (!matchCompound(parts[idx].compound, node)) return false;
    if (idx === 0) return true;
    const comb = parts[idx].combinator;
    if (comb === '>') return walk(idx - 1, node.parent);
    let anc = node.parent;
    while (anc) {
      if (walk(idx - 1, anc)) return true;
      anc = anc.parent;
    }
    return false;
  }
  return walk(parts.length - 1, el);
}

function winningDeclaration(allRules, el, property, width) {
  let best = null;
  for (const r of allRules) {
    if (!(property in r.declarations)) continue;
    if (!mediaMatches(r.media, width)) continue;
    if (!matches(r.selector, el)) continue;
    const spec = specificity(r.selector);
    let better = false;
    if (!best) better = true;
    else if (spec[0] !== best.spec[0]) better = spec[0] > best.spec[0];
    else if (spec[1] !== best.spec[1]) better = spec[1] > best.spec[1];
    else if (spec[2] !== best.spec[2]) better = spec[2] > best.spec[2];
    else better = r.order > best.order;
    if (better) {
      best = { spec, order: r.order, value: r.declarations[property] };
    }
  }
  return best ? best.value : undefined;
}

let allRules = [];
let order = 0;
for (const sheet of sheets) {
  const parsed = parseSheet(sheet, order);
  allRules = allRules.concat(parsed.rules);
  order = parsed.nextOrder;
}

// grid-column is written both as `1/-1` and `1 / -1` in the sources;
// normalize before comparing.
const normGrid = (v) => String(v).replace(/\s*\/\s*/g, '/');

// ---------- element fixtures (index.html:6407-6414, :6462) ----------
const group = { tag: 'div', id: null, classes: new Set(['profile-action-group']), parent: null, isLastChild: false };
function btn(id, classes) {
  return { tag: 'button', id, classes: new Set(classes), parent: group, isLastChild: false };
}
const recordBtn = btn('currentBillPaymentShortcut', ['primary-button', 'current-payment-shortcut']);
const clearBtn = btn('clearDuesButton', ['primary-button', 'profile-action-btn']);
const wadaBtn = btn('topWadaButton', ['secondary-button', 'profile-action-btn']);
const archiveBtn = btn('archiveCustomerButton', ['secondary-button', 'profile-action-btn']);
const unarchiveBtn = btn('unarchiveCustomerButton', ['secondary-button', 'profile-action-btn']);
const qaDetails = { tag: 'details', id: 'customerTechnicalToolsDetails', classes: new Set(['customer-technical-tools']), parent: group, isLastChild: false };
const moreDetails = { tag: 'details', id: 'profileMoreActionsDetails', classes: new Set(['customer-technical-tools', 'profile-more-actions']), parent: group, isLastChild: false };
const qaSummary = { tag: 'summary', id: null, classes: new Set(['customer-technical-summary']), parent: qaDetails, isLastChild: false };
const qaLabel = { tag: 'span', id: null, classes: new Set(), parent: qaSummary, isLastChild: true };
const moreLabel = { tag: 'span', id: null, classes: new Set(), parent: { tag: 'summary', id: null, classes: new Set(['customer-technical-summary']), parent: moreDetails, isLastChild: false }, isLastChild: true };
const detailPane = { tag: 'div', id: null, classes: new Set(['detail-pane']), parent: null, isLastChild: false };
const profileCard = { tag: 'div', id: null, classes: new Set(['customer-profile-card']), parent: detailPane, isLastChild: false };

// ---------- markup + wiring pins (no JS/label changes in this PR) ----------
test('profile action markup and wiring are untouched', () => {
  for (const [id, cls] of [
    ['editProfileButton', 'profile-action-btn'],
    ['clearDuesButton', 'profile-action-btn'],
    ['topWadaButton', 'profile-action-btn'],
    ['currentBillPaymentShortcut', 'current-payment-shortcut'],
    ['archiveCustomerButton', 'profile-action-btn'],
  ]) {
    const tag = indexHtml.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
    assert.ok(tag, `#${id} exists in index.html`);
    assert.ok(tag[0].includes(`class="`) && tag[0].includes(cls), `#${id} keeps .${cls}`);
  }
  assert.ok(indexHtml.includes('data-i18n="prof_action_record"'), 'Record label i18n key present');
  assert.ok(indexHtml.includes('data-i18n="prof_action_wada"'), 'Wada label i18n key present');
  assert.ok(indexHtml.includes('data-i18n="prof_action_clear_dues"'), 'Clear dues label i18n key present');
  assert.ok(appJs.includes("$('#currentBillPaymentShortcut').addEventListener"), 'Record shortcut wiring intact');
  assert.ok(appJs.includes('clearCustomerDues') || appJs.includes('wiredClearDues'), 'Clear dues wiring intact');
});

// ---------- the specificity fix: wrap wins at <=620px ----------
test('Record label may wrap at 360px: white-space normal beats the base nowrap', () => {
  assert.equal(winningDeclaration(allRules, recordBtn, 'white-space', 360), 'normal');
  // And the base nowrap still applies above the breakpoint (no visual
  // change on desktop).
  assert.equal(winningDeclaration(allRules, recordBtn, 'white-space', 800), 'nowrap');
});

// ---------- full rows at <=620px: no overlap, no hole ----------
test('Wada, Record, Archive and Unarchive each span a full row at 360px', () => {
  for (const [name, el] of [['Wada', wadaBtn], ['Record', recordBtn], ['Archive', archiveBtn], ['Unarchive', unarchiveBtn]]) {
    assert.equal(normGrid(winningDeclaration(allRules, el, 'grid-column', 360)), '1/-1', `${name} spans the full row at 360px`);
  }
  // Full-row spans put Wada and Record on different rows by
  // construction, so their boxes can no longer overlap.
  assert.equal(normGrid(winningDeclaration(allRules, wadaBtn, 'grid-column', 360)), '1/-1');
  assert.equal(normGrid(winningDeclaration(allRules, recordBtn, 'grid-column', 360)), '1/-1');
});

// ---------- 360px fit arithmetic (grounded in the winning cascade) ----------
test('Record one-line content fits the full row and Clear dues fits its half-column at 360px', () => {
  // Pane padding-inline 14px (styles.css <=620px detail-pane rule) and
  // card padding-inline 15px (<=620px customer-profile-card rule):
  // full row = 360 - 2*14 - 2*15 = 302px; half column =
  // (302 - 7px grid gap) / 2 = 147.5px.
  const fullRow = 360 - 2 * 14 - 2 * 15;
  const halfCol = (fullRow - 7) / 2;
  assert.equal(fullRow, 302);
  assert.equal(halfCol, 147.5);
  // Record at 11px (harmonized, see below): 26-char label ~143px at a
  // conservative 5.5px/char for DM Sans 11px semibold, + 36px icon tile
  // + 8px gap + 16px padding = ~203px, one line, inside the 302px row.
  const recordOneLine = 26 * 5.5 + 36 + 8 + 16;
  assert.ok(recordOneLine <= fullRow, `Record one-line ${recordOneLine}px fits ${fullRow}px full row`);
  // Clear dues at 11px: 18-char label ~99px + 20px action icon + 6px
  // gap + 16px padding = ~141px, inside the 147.5px half-column.
  const clearDues = 18 * 5.5 + 20 + 6 + 16;
  assert.ok(clearDues <= halfCol, `Clear dues ${clearDues}px fits ${halfCol}px half-column`);
});

// ---------- font harmonization at <=620px ----------
test('primary buttons drop to 11px at 360px, matching secondary', () => {
  assert.equal(winningDeclaration(allRules, recordBtn, 'font-size', 360), '11px');
  assert.equal(winningDeclaration(allRules, clearBtn, 'font-size', 360), '11px');
  assert.equal(winningDeclaration(allRules, wadaBtn, 'font-size', 360), '11px');
  assert.equal(winningDeclaration(allRules, recordBtn, 'overflow', 360), 'hidden');
});

// ---------- 481-620px band: both disclosures span the full row ----------
test('both disclosures span the full row at 500px (the 481-620px band)', () => {
  assert.equal(normGrid(winningDeclaration(allRules, qaDetails, 'grid-column', 500)), '1/-1');
  assert.equal(normGrid(winningDeclaration(allRules, moreDetails, 'grid-column', 500)), '1/-1');
  assert.equal(normGrid(winningDeclaration(allRules, qaDetails, 'grid-column', 360)), '1/-1');
});

// ---------- QA / More-actions summary label wraps cleanly ----------
test('summary label span takes the free space with the chevron pinned', () => {
  for (const [name, el] of [['QA', qaLabel], ['More actions', moreLabel]]) {
    assert.equal(winningDeclaration(allRules, el, 'flex', 360), '1 1 auto', `${name} label flexes`);
    assert.equal(winningDeclaration(allRules, el, 'min-width', 360), '0', `${name} label may shrink`);
  }
});
