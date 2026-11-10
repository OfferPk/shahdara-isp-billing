// Polish 17 (Req 1) — Quick Collect success screen: the Urdu package
// message and the receipt-card terms render in Noto Nastaliq Urdu in
// mixed animated colours (Telegram style), on-screen only. The Nastaliq
// face is the already-bundled urdu-font.css subset, loaded for this
// screen by the existing ensureUrduFont(); the gradient uses token
// var(...) stops only, with a solid token-green fallback outside
// @supports, and prefers-reduced-motion renders it static.
// Pure-module + wiring tests on pattern-fake data only: the real support
// number lives solely in receipt-terms.js (a disclosed ratchet
// exemption) and is never re-typed here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import {
  PACKAGE_SUCCESS_MESSAGES,
} from '../package-success-message.js';
import {
  RECEIPT_TERMS_PHRASE,
  RECEIPT_SUPPORT_LINE,
  receiptTermsNoteHtml,
} from '../receipt-terms.js';
import { renderQuickCollectReceiptCardHtml } from '../nav-quick-collect.js';
import { renderSplitReceiptCardHtml } from '../split-tender-collect.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const quickCollectSrc = read('nav-quick-collect.js');
const splitSrc = read('split-tender-collect.js');
const termsSrc = read('receipt-terms.js');
const receiptSrc = read('receipt.js');
const pngReceiptSrc = read('png-receipt.js');
const fontCss = read('urdu-font.css');

// --- Subset coverage: every glyph the six messages + the two terms lines
// need must exist in the bundled Nastaliq subset. The subset is a woff2
// (base64 data URI in urdu-font.css); the test parses its cmap the same
// way a font loader would: woff2 header + table directory (UIntBase128
// lengths) + brotli-compressed tables, then the cmap subtables
// (format 4 and format 12). ---

function woff2CmapCoverage(css) {
  const match = css.match(/url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)/);
  assert.ok(match, 'urdu-font.css must carry a base64 woff2 data URI');
  const woff2 = Buffer.from(match[1], 'base64');
  assert.equal(woff2.subarray(0, 4).toString('latin1'), 'wOF2', 'payload must be a woff2 font');
  const numTables = woff2.readUInt16BE(12);
  const readBase128 = (buf, off) => {
    let result = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[off++];
      result = (result << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
    return [result, off];
  };
  // WOFF2 known-tag order (spec table 5); tag index 63 means a literal tag.
  const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
  let off = 48;
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = woff2[off++];
    const tagIndex = flags & 0x3f;
    let tag;
    if (tagIndex === 63) {
      tag = woff2.subarray(off, off + 4).toString('latin1');
      off += 4;
    } else {
      tag = KNOWN_TAGS[tagIndex];
    }
    let origLength;
    [origLength, off] = readBase128(woff2, off);
    // glyf/loca carry a transformLength field; every other table's
    // stored length is its transform length.
    let transformLength = origLength;
    if (tag === 'glyf' || tag === 'loca') [transformLength, off] = readBase128(woff2, off);
    tables.push({ tag, transformLength });
  }
  const data = brotliDecompressSync(woff2.subarray(off));
  let cursor = 0;
  let cmapSlice = null;
  for (const table of tables) {
    if (table.tag === 'cmap') cmapSlice = data.subarray(cursor, cursor + table.transformLength);
    cursor += table.transformLength;
  }
  assert.ok(cmapSlice, 'woff2 must contain a cmap table');
  const subtableCount = cmapSlice.readUInt16BE(2);
  const covered = new Set();
  for (let i = 0; i < subtableCount; i++) {
    const subOff = cmapSlice.readUInt32BE(8 + i * 8);
    const format = cmapSlice.readUInt16BE(subOff);
    if (format === 12) {
      const groupCount = cmapSlice.readUInt32BE(subOff + 12);
      for (let g = 0; g < groupCount; g++) {
        const start = cmapSlice.readUInt32BE(subOff + 16 + g * 12);
        const end = cmapSlice.readUInt32BE(subOff + 20 + g * 12);
        for (let cp = start; cp <= end; cp++) covered.add(cp);
      }
    } else if (format === 4) {
      const segCount = cmapSlice.readUInt16BE(subOff + 6) / 2;
      const endBase = subOff + 14;
      const startBase = endBase + segCount * 2 + 2;
      const deltaBase = startBase + segCount * 2;
      const rangeBase = deltaBase + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const endCode = cmapSlice.readUInt16BE(endBase + s * 2);
        const startCode = cmapSlice.readUInt16BE(startBase + s * 2);
        const delta = cmapSlice.readInt16BE(deltaBase + s * 2);
        const rangeOffset = cmapSlice.readUInt16BE(rangeBase + s * 2);
        for (let cp = startCode; cp <= endCode; cp++) {
          if (rangeOffset === 0) {
            if (((cp + delta) & 0xffff) !== 0) covered.add(cp);
          } else {
            const glyph = cmapSlice.readUInt16BE(rangeBase + s * 2 + rangeOffset + (cp - startCode) * 2);
            if (glyph !== 0) covered.add(cp);
          }
        }
      }
    }
  }
  return covered;
}

test('subset coverage: every glyph in the six package messages + the two terms lines is in the bundled Nastaliq subset', () => {
  const covered = woff2CmapCoverage(fontCss);
  assert.ok(covered.size > 0, 'subset must cover at least one code point');
  const strings = [
    ...PACKAGE_SUCCESS_MESSAGES.map((entry) => entry.message),
    RECEIPT_TERMS_PHRASE,
    RECEIPT_SUPPORT_LINE,
  ];
  const unique = [...new Set(strings.join(''))];
  const missing = unique.filter((ch) => !covered.has(ch.codePointAt(0)));
  assert.deepEqual(
    missing,
    [],
    `subset is missing glyphs the success screen renders: ${missing.map((ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} ${JSON.stringify(ch)}`).join(', ')}`
  );
});

test('subset face: the @font-face stays the Noto Nastaliq Urdu variable face (weight 400 700, display swap)', () => {
  assert.ok(fontCss.includes("font-family: 'Noto Nastaliq Urdu'"), 'family must stay Noto Nastaliq Urdu');
  assert.ok(fontCss.includes('font-weight: 400 700'), 'variable weight range must stay 400 700');
  assert.ok(fontCss.includes('font-display: swap'), 'display swap must stay (fallback first, then Nastaliq)');
});

// --- Font load: the QC modal loads the bundled Nastaliq face. ---

test('font load: ensureUrduFont is imported and called when the QC modal opens', () => {
  assert.match(quickCollectSrc, /ensureUrduFont/, 'nav-quick-collect.js must reference ensureUrduFont');
  assert.match(
    quickCollectSrc,
    /from '\.\/nav-language\.js'/,
    'the import must come from nav-language.js'
  );
  const openStart = quickCollectSrc.indexOf('function openModal(');
  assert.ok(openStart >= 0, 'openModal missing');
  const openEnd = quickCollectSrc.indexOf('\n  function ', openStart + 1);
  const openBody = quickCollectSrc.slice(openStart, openEnd === -1 ? undefined : openEnd);
  assert.ok(openBody.includes('ensureUrduFont()'), 'openModal must call ensureUrduFont() so the face is ready by the success screen');
});

test('success scope: showStep toggles a qc-success-open class on the modal (the header/compact rules hang off it)', () => {
  assert.ok(quickCollectSrc.includes("modal.classList.toggle('qc-success-open', stepName === 'success')"), 'showStep must toggle qc-success-open on the modal');
});

// --- Nastaliq + gradient classes on the two Urdu elements. ---

test('message: applyPackageSuccessMessage puts Nastaliq on the Urdu message only when the amount matches a package (no gradient)', () => {
  const start = quickCollectSrc.indexOf('function applyPackageSuccessMessage(');
  assert.ok(start >= 0, 'applyPackageSuccessMessage missing');
  const end = quickCollectSrc.indexOf('\n  function ', start + 1);
  const body = quickCollectSrc.slice(start, end === -1 ? undefined : end);
  assert.ok(body.includes("packageSuccessMessage(amount) !== null"), 'the class decision must use the package match (not the default line)');
  assert.ok(body.includes("classList.toggle('qc-urdu-nastaliq'"), 'message must get the Nastaliq class');
  // QC receipt-modal overhaul: the animated gradient is dropped for the
  // message — the callout's calm palette replaces it. The terms box
  // keeps its gradient via the card builder's replace.
  assert.ok(!body.includes("classList.toggle('qc-urdu-gradient'"), 'message must NOT get the gradient class');
  assert.ok(!body.includes('qc-urdu-gradient'), 'message function must not mention the gradient');
  assert.ok(body.includes("setAttribute('dir', 'rtl')"), 'Urdu message must be dir=rtl');
  assert.ok(body.includes("setAttribute('lang', 'ur')"), 'Urdu message must be lang=ur');
  assert.ok(body.includes("removeAttribute('dir')"), 'English default must drop dir');
  assert.ok(body.includes("removeAttribute('lang')"), 'English default must drop lang');
  // The toggle takes the package-match boolean, so the English default
  // (no package match) never carries the class.
  assert.match(body, /classList\.toggle\('qc-urdu-nastaliq', isUrdu\)/);
});

// Pattern-fake receipt for the card builders: Test Customer, pattern-fake
// receipt number, no real names or transaction ids.
const CARD_RECEIPT = {
  id: 'receipt-12',
  receiptNumber: 'RCPT-12-202611-01',
  amount: 1000,
  customerName: 'Test Customer',
  customerNumber: 12,
  date: '2026-11-08',
  method: 'Easypaisa',
  area: 'Sodaa',
  payableRemaining: 0,
  newTotalDues: 0,
};

test('terms: the ordinary QC receipt card carries Nastaliq + gradient on its terms block', () => {
  const html = renderQuickCollectReceiptCardHtml(CARD_RECEIPT);
  assert.ok(html.includes('class="receipt-urdu-notice qc-urdu-nastaliq qc-urdu-gradient"'), 'ordinary card terms must carry both classes');
  assert.ok(html.indexOf('qc-receipt-card') < html.indexOf('receipt-urdu-notice'), 'terms must sit inside the receipt card');
});

const SPLIT_COMBINED = {
  splitGroupId: 'grp-1',
  customerId: '12',
  customerNumber: 12,
  customerName: 'Test Customer',
  customerNameUrdu: '',
  phone: '03012345678',
  area: 'Sodaa',
  month: '2026-11',
  date: '2026-11-08',
  package: '5 Mbps',
  legs: [
    { leg: 1, paymentId: 'pay-a', receiptNumber: 'RCPT-12-202611-01', method: 'Cash', amount: 500, transactionId: '', date: '2026-11-08', voided: false },
    { leg: 2, paymentId: 'pay-b', receiptNumber: 'RCPT-12-202611-02', method: 'Easypaisa', amount: 500, transactionId: 'TID-000001', date: '2026-11-08', voided: false },
  ],
  totalReceivedCents: 100000,
  totalReceived: 1000,
  balanceDueCents: 0,
  status: 'PAID',
};

test('terms: the split-tender receipt card carries Nastaliq + gradient on its terms block too', () => {
  const html = renderSplitReceiptCardHtml(SPLIT_COMBINED);
  assert.ok(html.includes('class="receipt-urdu-notice qc-urdu-nastaliq qc-urdu-gradient"'), 'split card terms must carry both classes');
  assert.ok(html.indexOf('qc-receipt-card') < html.indexOf('receipt-urdu-notice'), 'split terms must sit inside the receipt card');
});

test('shared helper untouched: receiptTermsNoteHtml still returns the bare notice (the QC call sites add the classes)', () => {
  const html = receiptTermsNoteHtml();
  assert.ok(html.startsWith('<div class="receipt-urdu-notice" dir="rtl" lang="ur">'), 'shared helper output must stay bare');
  assert.ok(!html.includes('qc-urdu-nastaliq'), 'shared helper must not add the Nastaliq class');
  assert.ok(!html.includes('qc-urdu-gradient'), 'shared helper must not add the gradient class');
  assert.ok(!termsSrc.includes('qc-urdu'), 'receipt-terms.js must not reference the QC classes');
});

test('global rule untouched: the shared .receipt-urdu-notice rule keeps its 12px/1.6 sizing (other surfaces unaffected)', () => {
  const start = stylesSrc.indexOf('.receipt-urdu-notice {');
  assert.ok(start >= 0, 'global .receipt-urdu-notice rule missing');
  const block = stylesSrc.slice(start, stylesSrc.indexOf('}', start));
  assert.ok(block.includes('margin: 16px 0'), 'global notice margin must stay 16px 0');
  assert.ok(block.includes('padding: 10px 14px'), 'global notice padding must stay 10px 14px');
  assert.ok(block.includes('font-size: 12px'), 'global notice font-size must stay 12px');
  assert.ok(block.includes('line-height: 1.6'), 'global notice line-height must stay 1.6');
  assert.ok(!block.includes('Noto Nastaliq Urdu'), 'global notice must not be re-fonted to Nastaliq');
});

// --- The Nastaliq + gradient rules themselves. ---

function extractRule(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function extractBalanced(css, marker) {
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `missing block ${marker}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  assert.fail(`unbalanced block at ${marker}`);
  return '';
}

test('Nastaliq rule: scoped to the success message + the QC card terms, font-family !important, line-height 2.0, message 14px', () => {
  const ruleStart = stylesSrc.indexOf('#quickCollectSuccessMessage.qc-urdu-nastaliq,');
  assert.ok(ruleStart >= 0, 'Nastaliq rule missing');
  const ruleEnd = stylesSrc.indexOf('}', ruleStart);
  const rule = stylesSrc.slice(ruleStart, ruleEnd);
  assert.ok(rule.includes('.qc-receipt-card .receipt-urdu-notice.qc-urdu-nastaliq'), 'terms selector must be scoped to the QC card');
  assert.ok(rule.includes('font-family: var(--font-urdu) !important'), 'Nastaliq rule must beat the body * !important stack');
  assert.ok(rule.includes('line-height: 2.0'), 'Nastaliq line-height must be 2.0 (tall glyphs clip below it)');
  const messageSize = extractRule(stylesSrc, '#quickCollectSuccessMessage.qc-urdu-nastaliq {');
  assert.ok(messageSize.includes('font-size: 14px'), 'Urdu message must be 14px Nastaliq');
});

test('gradient rule: solid token-green fallback outside @supports; animated token gradient inside; zero new hex', () => {
  const fallback = extractRule(stylesSrc, '.qc-urdu-gradient {');
  assert.ok(fallback.includes('color: var(--color-brand-600)'), 'fallback must be solid token green');
  assert.ok(!fallback.includes('transparent'), 'fallback must never be transparent (never invisible)');
  const supports = extractBalanced(stylesSrc, '@supports ((background-clip: text)');
  assert.ok(supports.includes('background: linear-gradient(100deg,'), 'gradient must be a 100deg linear gradient');
  for (const stop of ['var(--color-brand-600)', 'var(--color-success)', 'var(--color-info)', 'var(--color-pending)']) {
    assert.ok(supports.includes(stop), `gradient must include the token stop ${stop}`);
  }
  assert.ok(supports.includes('background-size: 200% 100%'), 'gradient must span 200% so every frame shows mixed colours');
  assert.ok(supports.includes('-webkit-background-clip: text'), 'gradient needs -webkit-background-clip for the WebView');
  assert.ok(supports.includes('background-clip: text'), 'gradient needs background-clip: text');
  assert.ok(supports.includes('color: transparent'), 'gradient text must be transparent so the background shows through');
  assert.ok(supports.includes('animation: qc-urdu-flow 8s ease-in-out infinite alternate'), 'gradient must drift slowly (8s, ease-in-out, infinite alternate)');
  assert.ok(supports.includes('@keyframes qc-urdu-flow'), 'gradient keyframes must live with the gradient');
  assert.ok(supports.includes('background-position: 0% 0'), 'flow must start at 0%');
  assert.ok(supports.includes('background-position: 100% 0'), 'flow must end at 100%');
  const hexInGradient = (fallback + supports).match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hexInGradient, [], `gradient CSS must add zero hex literals (tokens only), found ${hexInGradient.join(', ')}`);
});

test('reduced motion: the gradient goes static (still multi-coloured)', () => {
  // The reduced-motion block lives inside the Polish 17 block (earlier
  // blocks in styles.css cover other animations).
  const polishStart = stylesSrc.indexOf('/* Polish 17');
  assert.ok(polishStart >= 0, 'Polish 17 CSS block missing');
  const polishCss = stylesSrc.slice(polishStart, stylesSrc.indexOf('/* End Polish 17', polishStart));
  const reduced = extractBalanced(polishCss, '@media (prefers-reduced-motion: reduce)');
  assert.ok(reduced.includes('.qc-urdu-gradient'), 'reduced-motion block must cover the gradient');
  assert.ok(reduced.includes('animation: none'), 'reduced-motion must stop the gradient drift');
});

// --- Scope guard: the gradient never touches amounts, labels, print or PNG. ---

test('scope: the gradient class appears only at the two card terms call sites (message toggle dropped)', () => {
  // QC receipt-modal overhaul: the message toggle is gone — the gradient
  // survives only at the ordinary-card terms call site in this file.
  const qcCount = (quickCollectSrc.match(/qc-urdu-gradient/g) || []).length;
  assert.equal(qcCount, 1, `nav-quick-collect.js must mention qc-urdu-gradient exactly once (ordinary-card terms), found ${qcCount}`);
  const splitCount = (splitSrc.match(/qc-urdu-gradient/g) || []).length;
  assert.equal(splitCount, 1, `split-tender-collect.js must mention qc-urdu-gradient exactly once (split-card terms), found ${splitCount}`);
  assert.equal((receiptSrc.match(/qc-urdu-gradient/g) || []).length, 0, 'receipt.js (thermal/A4/print) must never get the gradient');
  assert.equal((pngReceiptSrc.match(/qc-urdu-gradient/g) || []).length, 0, 'png-receipt.js (canvas) must never get the gradient');
  assert.equal((termsSrc.match(/qc-urdu-gradient/g) || []).length, 0, 'receipt-terms.js must never get the gradient');
});
