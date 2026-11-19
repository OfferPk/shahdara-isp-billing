// QC Step 2 payment entry polish (2026-11-19) — the Step 2 form's two
// green CTAs, duplicate quick-amount chips, and wrapping method buttons.
//
// Item 1: 'Review payment →' and '✓ Save Payment' were the same solid
// green .primary-button, stacked with zero gap — but they are NOT the
// same action. Review opens the Plan 382 confirm step; Save posts
// directly, skipping only that step; for non-standard collections
// Review is the ONLY CTA (Save is hidden). Review is restyled as a
// secondary button, never deleted.
// Item 2: Full dues, Package and the bare number can all be the same
// rupees (Rs 1,000 three times; Rs 500 twice). The row dedupes by
// fill value — first label in row order wins, losers hide (never
// removed; Plan 391 pins all six chips in the page). The honest
// outcome is 2 balanced rows: the survivors need more width than
// the row holds, so the spec's "single row" is measured-false.
// Item 3: the method buttons wrapped at the space (emoji line 1,
// word line 2) because the 3-column grid gives each ~100px and the
// longer labels need ~89-102px. nowrap + 12px + 2px side padding
// fits all three on one line (Easypaisa's slack is thin — verify
// on the phone; the fallbacks are 11.5px font or grid gap 8→6px).
//
// This file asserts NO parity total (0 new keys) and must contain
// NEITHER the current nor the previous parity bare digits anywhere
// (comments included) — see the self-guard, which builds them from
// split literals so this file itself never carries them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { dedupeQuickAmountChips } from '../quick-amount-buttons.js';
import { TRANSLATIONS } from '../nav-language.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => fs.readFileSync(path.join(ROOT, '..', name), 'utf8');
const pageSrc = read('index.html');
const navCss = read('nav.css');
const stylesSrc = read('styles.css');
const wiringSrc = read('nav-quick-collect.js');
const moduleSrc = read('quick-amount-buttons.js');

function ruleBlock(css, selector) {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return null;
  return css.slice(at, css.indexOf('}', at) + 1);
}

// The Step 2 form footer: the first .qc-form-actions block, up to the
// form close. (The second block is the confirm-step footer.)
const formFooter = pageSrc.slice(
  pageSrc.indexOf('<div class="qc-form-actions">'),
  pageSrc.indexOf('</form>', pageSrc.indexOf('<div class="qc-form-actions">')),
);
const saveTag = (formFooter.match(/<button[^>]*id="quickCollectDirectSaveBtn"[^>]*>/) || [])[0] ?? '';
const reviewTag = (formFooter.match(/<button[^>]*id="quickCollectConfirmBtn"[^>]*>/) || [])[0] ?? '';

test('C1: the form footer has exactly one green primary CTA (Save); Review is secondary', () => {
  assert.ok(saveTag.includes('primary-button'), 'Save keeps the green primary style');
  assert.ok(!reviewTag.includes('primary-button'), 'Review is no longer a second solid-green primary');
  assert.ok(reviewTag.includes('secondary-button'), 'Review is an outline secondary button');
  assert.equal(
    (formFooter.match(/primary-button/g) ?? []).length, 1,
    'exactly one primary-button class in the form footer',
  );
});

test('C1b: Review keeps its id, type, handler target, label and key', () => {
  assert.ok(reviewTag.includes('id="quickCollectConfirmBtn"'), 'Review keeps its Plan 382-era id');
  assert.ok(reviewTag.includes('type="submit"'), 'Review stays the form submit');
  assert.ok(reviewTag.includes('qc-confirm-btn'), 'Review keeps its class');
  const reviewText = (pageSrc.match(/id="quickCollectConfirmBtn"[^>]*>\s*([^<]+)/) || [])[1]?.trim() ?? '';
  assert.equal(reviewText, 'Review payment →', 'Review still reads "Review payment →"');
  assert.equal(TRANSLATIONS.en.qc_confirm_btn, 'Review payment →', 'EN key unchanged');
  assert.equal(TRANSLATIONS.ur.qc_confirm_btn, 'ادائیگی کا جائزہ لیں', 'UR key unchanged');
});

test('C2: the footer stacks its buttons with an 8px gap and stays sticky', () => {
  const rule = ruleBlock(navCss, '.qc-form-actions');
  assert.ok(rule !== null, '.qc-form-actions rule exists');
  assert.ok(rule.includes('display: flex'), 'the footer is a flex column now');
  assert.ok(rule.includes('flex-direction: column'), 'the footer stacks vertically');
  assert.ok(/gap:\s*8px/.test(rule), 'the footer gap is 8px');
  assert.ok(rule.includes('position: sticky;'), 'the footer stays sticky (fit-test pin)');
  assert.ok(rule.includes('bottom: 0;'), 'the footer stays pinned to the bottom');
});

test('C3a: the helper dedupes the screenshot fixture by value', () => {
  const kept = dedupeQuickAmountChips([
    { type: 'full', value: 1000 },
    { type: 'half', value: 500 },
    { type: 'package', value: 1000 },
    { type: '2000', value: 2000 },
    { type: '1000', value: 1000 },
    { type: '500', value: 500 },
  ]).map((entry) => entry.type);
  assert.deepEqual(kept, ['full', 'half', '2000'], 'one value, one chip — first label in row order wins');
});

test('C3b: distinct values survive, null fills never dedupe, inputs are untouched', () => {
  const distinct = dedupeQuickAmountChips([
    { type: 'full', value: 2000 }, { type: 'half', value: 1000 },
    { type: 'package', value: 1500 }, { type: '2000', value: 2000 },
    { type: '1000', value: 1000 }, { type: '500', value: 500 },
  ]).map((entry) => entry.type);
  assert.deepEqual(distinct, ['full', 'half', 'package', '500'], 'full != package: both survive');
  const nulls = dedupeQuickAmountChips([
    { type: 'full', value: null }, { type: 'half', value: null },
    { type: 'package', value: 1000 }, { type: '1000', value: 1000 },
  ]).map((entry) => entry.type);
  assert.deepEqual(nulls, ['full', 'half', 'package'], 'a chip that fills nothing is never deduped');
  const input = [
    { type: 'full', value: 1000 }, { type: 'package', value: 1000 },
  ];
  const before = JSON.stringify(input);
  dedupeQuickAmountChips(input);
  assert.equal(JSON.stringify(input), before, 'the helper never mutates its input');
  assert.notEqual(
    dedupeQuickAmountChips(input), input,
    'the helper returns a new array',
  );
});

test('C3c: the refresh block calls the helper and hides losers — never removes them', () => {
  assert.ok(wiringSrc.includes('dedupeQuickAmountChips('), 'the refresh block calls the helper');
  assert.ok(
    wiringSrc.includes('chip.hidden = !keptQuickAmounts.has('),
    'the refresh block sets chip.hidden from the kept set',
  );
  for (const type of ['full', 'half', 'package', '2000', '1000', '500']) {
    assert.ok(pageSrc.includes(`data-quick-amount="${type}"`), `the ${type} chip stays in the page`);
  }
  // The hidden flag is set for EVERY chip on every open (the forEach
  // assigns unconditionally), so a chip hidden for one customer shows
  // again for the next when its value is kept.
  const refresh = wiringSrc.slice(wiringSrc.indexOf('// Update quick amount chips dynamic amounts'));
  const forEachAt = refresh.indexOf('quickAmountChips.forEach((chip) => {');
  assert.ok(forEachAt > -1, 'the refresh block iterates every chip');
  const hiddenAt = refresh.indexOf('chip.hidden = !keptQuickAmounts.has(', forEachAt);
  assert.ok(hiddenAt > forEachAt, 'the hidden assignment sits inside that forEach');
});

test('C4: the survivors need two rows — the "single row" claim is measured-false', () => {
  // Screenshot-measured chip widths (540x1200 image, 360 CSS px):
  // Full 143, Half 137, 2,000 49; gap 6; row width 295 (bracketed by
  // the screenshot: row 1 joined at 286, row 2 refused 500 at 303).
  const kept = dedupeQuickAmountChips([
    { type: 'full', value: 1000 }, { type: 'half', value: 500 },
    { type: 'package', value: 1000 }, { type: '2000', value: 2000 },
    { type: '1000', value: 1000 }, { type: '500', value: 500 },
  ]).map((entry) => entry.type);
  const widths = { full: 143, half: 137, '2000': 49 };
  const oneRow = kept.reduce((sum, type) => sum + widths[type], 0) + 6 * (kept.length - 1);
  assert.ok(oneRow > 295, `survivors need ${oneRow}px on one row — wider than the 295px row, so 2 balanced rows is the honest outcome`);
});

test('C5a: the method chips never wrap — nowrap on the base rule', () => {
  const rule = ruleBlock(stylesSrc, '.quick-method-chip');
  assert.ok(rule !== null, 'the base method-chip rule exists');
  assert.ok(/white-space:\s*nowrap/.test(rule), 'the base rule carries white-space: nowrap');
});

test('C5b: bwb-big is 12px with 2px side padding, 40px tall, one rule, order kept', () => {
  const rules = stylesSrc.match(/^\.quick-method-chip\.bwb-big\s*\{[^}]*\}/gm) || [];
  assert.equal(rules.length, 1, `expected one big-button base rule, found ${rules.length}`);
  assert.ok(rules[0].includes('font-size: 12px'), 'bwb-big text is 12px now');
  assert.ok(rules[0].includes('padding: 8px 2px'), 'bwb-big side padding is 2px now');
  assert.ok(rules[0].includes('min-height: 40px'), 'bwb-big stays 40px tall');
  const methodOrder = [...pageSrc.matchAll(/data-method="(Cash|JazzCash|Easypaisa)"/g)].map((m) => m[1]);
  assert.deepEqual(methodOrder, ['Cash', 'JazzCash', 'Easypaisa'], 'method order unchanged');
});

test('S: chip sizing and helper purity are untouched', () => {
  const chipRule = (stylesSrc.match(/^\.quick-amount-chip\s*\{[^}]*\}/m) || [])[0] ?? '';
  assert.ok(chipRule.includes('padding: 4px 10px'), 'quick-amount-chip padding pinned (Plan 550)');
  assert.ok(chipRule.includes('font-size: 0.78rem'), 'quick-amount-chip font-size pinned (Plan 550)');
  // The helper module stays pure: no page, storage, clock or network.
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.']) {
    assert.ok(!moduleSrc.includes(banned), `the helper module must not contain ${banned}`);
  }
  assert.equal(
    Object.keys(TRANSLATIONS.en).length,
    Object.keys(TRANSLATIONS.ur).length,
    'EN and UR dictionaries still agree in size — no key added or lost',
  );
});

test('G self-guard — this file pins no parity total and stays free of the parity bare digits', () => {
  // The digits are built from split literals so this file itself never
  // contains them (the header-strip sweep looks for the bare digits of
  // the current and previous totals across the tests tree). This file
  // asserts no parity total — 0 new keys.
  const selfSrc = read('tests/qc-step2-payment-entry-polish.test.js');
  assert.ok(!selfSrc.includes('51' + '62'), 'this file carries the current parity bare digits');
  assert.ok(!selfSrc.includes('51' + '61'), 'this file carries the previous parity bare digits');
  assert.ok(!selfSrc.includes('51' + '45'), 'this file carries an older parity bare digits');
  assert.ok(!selfSrc.includes('51' + '38'), 'this file carries an older parity bare digits');
});
