// QC receipt buttons tint — the bottom buttons of the Quick Collect Cash
// success receipt each carry their own semantic tint instead of sharing
// one pale mint-green (user spec, 2026-11-21 ~23:13 PKT, written spec +
// screenshot).
//
// C tests assert the FIXED state. S tests are stability (the untouched
// buttons keep their treatment). B tests are behaviour (hex ratchets,
// contrast). Source-level, in the neon-glass-buttons.test.js style —
// read index.html + styles.css + dark-contrast.css + tokens.css and
// assert on the markup and the rule blocks. No mock DOM needed: the
// buttons are static markup in index.html and the tints are static CSS.
// 0 parity literals in this file (it is not a pinning file).
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
//
// Spec notes (the user's text was cut off after the '+ Same Customer:
// soft warm amber' line — the rest is the prep's recommendation, NOT
// the spec): 'Next Customer →' keeps the mint glass (the row
// distinguishes itself via the amber sibling); 'Done' takes the neutral
// slate tint (terminal/close action); 'Empty amount' is untouched
// (already visually quiet, white, no glass class).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || '.';
const read = (f) => readFileSync(join(root, f), 'utf8');
const html = read('index.html');
const styles = read('styles.css');
const dark = read('dark-contrast.css');
const tokens = read('tokens.css');

const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const distinctHex = (t) =>
  new Set(stripComments(t).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);

// Rule block for a selector: from the selector's opening brace to the
// matching close brace (these rules have no nested braces except the
// ::before data-URI, which contains no '}').
function ruleBlock(src, selector) {
  const at = src.indexOf(selector);
  if (at === -1) return '';
  const open = src.indexOf('{', at);
  const close = src.indexOf('}', open);
  return close === -1 ? '' : src.slice(open + 1, close);
}

const WA_RULE = '#quickCollectModal.qc-success-open .qc-wa-btn {';
const SCOPE = '#quickCollectModal.qc-success-open ';

// Button tag helper: the <button ...> tag for an id / data-hook.
function buttonTag(re) {
  const m = re.exec(html);
  return m ? m[0] : '';
}

test('C1: primary CTA paints the authentic WhatsApp gradient (lowercase hex, 48px kept)', () => {
  const tag = buttonTag(/<button[^>]*id="quickCollectWhatsAppBtn"[^>]*>/);
  assert.ok(tag.includes('primary-button') && tag.includes('qc-wa-btn') && tag.includes('btn-neon-glass'),
    'WhatsApp button must keep primary-button + qc-wa-btn + btn-neon-glass');
  const block = ruleBlock(styles, WA_RULE);
  assert.ok(block.includes('min-height: 48px'), 'primary must stay 48px');
  // Lowercase hex ONLY: #25D366 (upper) would count as a second distinct
  // hex under the ratchet's case-sensitive Set and break the 608 pin.
  assert.ok(/linear-gradient\(90deg,\s*#25d366,\s*#128c7e\)/.test(block),
    'primary must paint linear-gradient(90deg, #25d366, #128c7e)');
  assert.ok(!/var\(--ds-brand\)/.test(block), 'primary must no longer be the solid brand');
});

test('C2: Share Image carries its indigo tint (tokens only)', () => {
  const tag = buttonTag(/<button[^>]*id="quickCollectShareImageBtn"[^>]*>/);
  assert.ok(tag.includes('btn-glass-secondary') && tag.includes('secondary-button'),
    'Share Image must keep the glassy class (neon-glass pin)');
  assert.ok(tag.includes('qc-btn-share'), 'Share Image must carry the tint class qc-btn-share');
  const block = ruleBlock(styles, `${SCOPE}.qc-output-btn.qc-btn-share {`);
  assert.ok(/background:\s*var\(--qc-indigo-bg\)/.test(block), 'Share bg must be var(--qc-indigo-bg)');
  assert.ok(/color:\s*var\(--qc-indigo-text\)/.test(block), 'Share text must be var(--qc-indigo-text)');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block), 'Share tint rule must use tokens, no hex literal');
});

test('C3: Print Slip carries its neutral slate tint (tokens only)', () => {
  const tag = buttonTag(/<button[^>]*id="quickCollectPrintReceiptBtn"[^>]*>/);
  assert.ok(tag.includes('btn-glass-secondary'), 'Print Slip must keep the glassy class');
  assert.ok(tag.includes('qc-btn-print'), 'Print Slip must carry the tint class qc-btn-print');
  const block = ruleBlock(styles, `${SCOPE}.qc-output-btn.qc-btn-print {`);
  assert.ok(/background:\s*var\(--color-slate-100\)/.test(block), 'Print bg must be var(--color-slate-100)');
  assert.ok(/color:\s*var\(--color-slate-700\)/.test(block), 'Print text must be var(--color-slate-700)');
  assert.ok(/border-color:\s*var\(--ds-line\)/.test(block), 'Print border must be var(--ds-line)');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block), 'Print tint rule must use tokens, no hex literal');
});

test('C4: Thermal Print carries its Bluetooth blue tint (tokens only)', () => {
  const tag = buttonTag(/<button[^>]*id="quickCollectBluetoothPrintBtn"[^>]*>/);
  assert.ok(tag.includes('btn-glass-secondary'), 'Thermal Print must keep the glassy class');
  assert.ok(tag.includes('qc-btn-thermal'), 'Thermal Print must carry the tint class qc-btn-thermal');
  const block = ruleBlock(styles, `${SCOPE}.qc-output-btn.qc-btn-thermal {`);
  assert.ok(/background:\s*var\(--qc-blue-bg\)/.test(block), 'Thermal bg must be var(--qc-blue-bg)');
  assert.ok(/border-color:\s*var\(--qc-blue-border\)/.test(block), 'Thermal border must be var(--qc-blue-border)');
  assert.ok(/color:\s*var\(--qc-blue-text\)/.test(block), 'Thermal text must be var(--qc-blue-text)');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block), 'Thermal tint rule must use tokens, no hex literal');
});

test('C5: + Same Customer carries its warm amber tint (tokens only)', () => {
  const tag = buttonTag(/<button[^>]*data-qc-same-customer[^>]*>/);
  assert.ok(tag.includes('btn-glass-secondary'), 'Same Customer must keep the glassy class');
  assert.ok(tag.includes('qc-btn-same'), 'Same Customer must carry the tint class qc-btn-same');
  const block = ruleBlock(styles, `${SCOPE}.qc-next-btn.qc-btn-same {`);
  assert.ok(/background:\s*var\(--qc-amber-soft-bg\)/.test(block), 'Same bg must be var(--qc-amber-soft-bg) (#fffbeb, amber-50)');
  assert.ok(/border-color:\s*var\(--ds-warning-border\)/.test(block), 'Same border must be var(--ds-warning-border) (#fde68a, amber-200)');
  assert.ok(/color:\s*var\(--color-warning\)/.test(block), 'Same text must be var(--color-warning) (#92400e, amber-800)');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block), 'Same tint rule must use tokens, no hex literal');
});

test('S4: Next Customer keeps the mint glass (no tint class — the row distinguishes via the amber sibling)', () => {
  const tag = buttonTag(/<button[^>]*data-qc-next-customer[^>]*>/);
  assert.ok(/class="secondary-button qc-next-btn btn-glass-secondary"/.test(tag),
    'Next Customer must keep exactly the glassy class string (neon-glass pin)');
  assert.ok(!/qc-btn-/.test(tag), 'Next Customer carries no tint class');
});

test('C7: Done carries the neutral slate tint (tokens only)', () => {
  const tag = buttonTag(/<button[^>]*id="quickCollectDoneCloseBtn"[^>]*>/);
  assert.ok(tag.includes('secondary-button') && tag.includes('qc-done-btn') && tag.includes('btn-glass-secondary'),
    'Done must keep secondary-button + qc-done-btn + btn-glass-secondary');
  assert.ok(!tag.includes('primary-button'), 'Done must not be a primary button');
  assert.ok(tag.includes('qc-btn-done'), 'Done must carry the tint class qc-btn-done');
  const block = ruleBlock(styles, `${SCOPE}.qc-done-btn.qc-btn-done {`);
  assert.ok(/background:\s*var\(--color-slate-100\)/.test(block), 'Done bg must be var(--color-slate-100)');
  assert.ok(/color:\s*var\(--color-slate-700\)/.test(block), 'Done text must be var(--color-slate-700)');
  assert.ok(block.includes('min-height: 44px'), 'Done must stay 44px');
});

test('C8: WhatsApp hover does not revert to the solid brand', () => {
  const block = ruleBlock(styles, '#quickCollectModal.qc-success-open .qc-wa-btn:hover {');
  assert.ok(block.length > 0, 'WA hover rule must exist');
  assert.ok(!/var\(--ds-brand\)/.test(block), 'WA hover must not revert to the solid brand');
});

test('S1: Empty amount is untouched (quiet white secondary, no glass, no tint)', () => {
  const tag = buttonTag(/<button[^>]*data-qc-empty-amount[^>]*>/);
  assert.ok(tag.includes('secondary-button') && tag.includes('qc-empty-amount-btn'), 'Empty amount keeps its treatment');
  assert.ok(!tag.includes('btn-glass-secondary'), 'Empty amount still carries no glass class');
  assert.ok(!/qc-btn-/.test(tag), 'Empty amount carries no tint class');
});

test('S2: all 9 QC action buttons still carry their glassy classes (neon-glass pin preserved)', () => {
  for (const id of ['quickCollectDirectSaveBtn', 'quickCollectConfirmSaveBtn', 'quickCollectWhatsAppBtn']) {
    const tag = buttonTag(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
    assert.ok(tag.includes('btn-neon-glass') && tag.includes('primary-button'), `${id} must keep btn-neon-glass + primary-button`);
  }
  for (const id of ['quickCollectShareImageBtn', 'quickCollectPrintReceiptBtn', 'quickCollectBluetoothPrintBtn']) {
    const tag = buttonTag(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
    assert.ok(tag.includes('btn-glass-secondary') && tag.includes('secondary-button'), `${id} must keep btn-glass-secondary + secondary-button`);
  }
  // Class-list check, not an exact class-string match: the + Same Customer
  // button carries the additive tint class `qc-btn-same` after
  // btn-glass-secondary (QC receipt buttons tint, 2026-11-21), so the old
  // exact-string form `class="secondary-button qc-next-btn
  // btn-glass-secondary"` no longer matches it. Intent preserved: both
  // .qc-next-btn buttons still carry btn-glass-secondary.
  const nextBtnTags = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>/g)]
    .map((m) => m[1])
    .filter((cls) => cls.split(/\s+/).includes('qc-next-btn'));
  assert.equal(nextBtnTags.length, 2, 'both .qc-next-btn buttons must exist');
  for (const cls of nextBtnTags) {
    const parts = cls.split(/\s+/);
    assert.ok(parts.includes('secondary-button') && parts.includes('btn-glass-secondary'),
      'both .qc-next-btn buttons must carry btn-glass-secondary');
  }
  assert.ok(/id="quickCollectDoneCloseBtn"[^>]*class="secondary-button qc-done-btn btn-glass-secondary/.test(html) ||
    /class="secondary-button qc-done-btn btn-glass-secondary[^"]*"[^>]*id="quickCollectDoneCloseBtn"/.test(html),
    'Done must keep btn-glass-secondary');
});

test('S3: undo buttons are untouched (no tint classes)', () => {
  for (const id of ['quickCollectUndoBtn', 'quickCollectReversalUndoBtn']) {
    const tag = buttonTag(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
    assert.ok(!/qc-btn-/.test(tag), `${id} carries no tint class`);
  }
});

test('B1: dark mode gives the WhatsApp button a dark teal (reusing the existing dark WA hexes)', () => {
  const at = dark.indexOf('#quickCollectModal.qc-success-open .qc-wa-btn');
  assert.ok(at !== -1, 'dark-contrast.css must carry a success-open WA override');
  const block = dark.slice(at, dark.indexOf('}', at));
  assert.ok(/#075e54/.test(block), 'dark WA background must reuse #075e54 (already in dark-contrast.css)');
  assert.ok(/#0b7a6c/.test(block), 'dark WA border must reuse #0b7a6c (already in dark-contrast.css)');
});

test('B2: hex ratchets unchanged (test exact method: comment-stripped, case-sensitive)', () => {
  assert.equal(distinctHex(styles).size, 608, `styles.css distinct hex: ${distinctHex(styles).size}, expected 608`);
  assert.equal(distinctHex(tokens).size, 117, `tokens.css distinct hex: ${distinctHex(tokens).size}, expected 117`);
  assert.equal(distinctHex(dark).size, 19, `dark-contrast.css distinct hex: ${distinctHex(dark).size}, expected 19`);
  assert.equal(distinctHex(read('components.css')).size, 0, 'components.css must stay hex-free');
});

test('B3: every tint text/background pair reads >= 4.5:1 (the WA gradient is excluded — white on #25d366 is 1.98:1, disclosed)', () => {
  const lum = (h) => {
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const cr = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const pairs = {
    'indigo #4338ca on #eef2ff': ['4338ca', 'eef2ff'],
    'slate #334155 on #f1f5f9': ['334155', 'f1f5f9'],
    'blue #1d4ed8 on #eff6ff': ['1d4ed8', 'eff6ff'],
    'amber #92400e on #fffbeb': ['92400e', 'fffbeb'],
  };
  for (const [label, [a, b]] of Object.entries(pairs)) {
    assert.ok(cr(a, b) >= 4.5, `${label} reads ${cr(a, b).toFixed(2)}:1, below 4.5:1`);
  }
});
