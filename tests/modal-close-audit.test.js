// SISP-87: Unified Modal Close Glyph Audit.
// PR #453 gave every dialog ONE shared close design (red circle ↩, 48px,
// theme tokens) and tests/modal-close-redesign.test.js ratchets buttons that
// already carry a close class. Its blind spot: a dialog whose header close
// never got a close class (e.g. a plain secondary-button with a ✕ glyph) is
// invisible to that enumeration. This audit closes the gap:
//   1. EVERY <dialog> in index.html and in every dynamic JS modal builder
//      (root .js template literals) is enumerated, and each one must contain
//      a conforming close button: shared close class + ↩ glyph + a Close
//      aria-label. A dialog with no conforming close (missing button) fails.
//   2. The FIRST close-intent button of every dialog (shared class,
//      data-close*, or a Close aria-label / close id) must be the conforming
//      header close — a ✕ header button cannot hide behind a footer button.
//   3. EVERY button carrying a shared close class, anywhere in the tree,
//      must render ↩ with a Close aria-label (no aria-less escape hatch).
//   4. A button whose whole label is a bare ✕ / × glyph is allowed ONLY as
//      an item-level micro-control on the explicit allowlist below (remove a
//      row, clear an input, dismiss a banner/drawer). Any new bare-glyph
//      button fails until a human classifies it here.
//   5. The one DOM-built dialog (ui-feedback.js confirm dialog, created via
//      createElement + innerHTML, so rule 1 cannot see its <dialog> tag) is
//      pinned explicitly, as is its toast dismiss (.tsx-close, a
//      notification control — not a modal close).
// Documented exclusions (NOT dialog close buttons, left by design):
//   - #navDrawerClose (.nav-drawer-close): app navigation drawer chrome with
//     its own nav.css design system (incl. dark + responsive rules).
//   - .wdm-remove-btn: PR #453's documented channel-remove exception.
//   - Footer action-row buttons (secondary/primary "Close" / "Cancel" /
//     "Done") inside dialogs that already have a conforming header close:
//     form actions, not the dialog's close glyph (cf. PR #490's approved
//     slim daily-closing footer).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const CLOSE_CLASSES = [
  'close-button',
  'modal-close-btn',
  'billing-modal-close',
  'modal-close',
  'close-btn',
  'field-tools-close-btn',
  'sheet-close-btn',
];
const BUTTON_RE = /<button\b[^>]*>([\s\S]*?)<\/button>/g;
const DIALOG_RE = /<dialog\b[^>]*>[\s\S]*?<\/dialog>/g;
const BARE_GLYPHS = ['✕', '×', '&times;', '╳'];

function parseButton(full) {
  const openTag = full.slice(0, full.indexOf('>') + 1);
  const attr = (name) => {
    const m = openTag.match(new RegExp(`${name}="([^"]*)"`));
    return m ? m[1] : '';
  };
  const cls = attr('class');
  return {
    id: attr('id'),
    cls,
    aria: attr('aria-label'),
    text: full.slice(full.indexOf('>') + 1, full.lastIndexOf('</button>')).replace(/<[^>]*>/g, '').trim(),
    sharedClass: CLOSE_CLASSES.some((c) => cls.split(/\s+/).includes(c)),
    dataClose: /data-close/.test(openTag),
  };
}
const ariaClose = (b) => /close/i.test(b.aria);
const idClose = (b) => /close/i.test(b.id);
const conforming = (b) => b.sharedClass && b.text === '↩' && ariaClose(b);
const closeIntent = (b) => b.sharedClass || b.dataClose || ariaClose(b) || idClose(b);

const sourceFiles = ['index.html', ...readdirSync(root).filter((f) => f.endsWith('.js'))];
const sources = sourceFiles.map((name) => [name, read(name)]);

test('SISP-87 audit: shared close rule still guarantees the 48px token design', () => {
  const css = read('components.css');
  for (const cls of CLOSE_CLASSES) assert.ok(css.includes(`.${cls},`) || css.includes(`.${cls} {`) || css.includes(`.${cls}:`), `components.css covers .${cls}`);
  assert.ok(css.includes('width: 48px;') && css.includes('height: 48px;'), 'close target stays 48px (never shrunk)');
  assert.ok(css.includes('min-width: 48px;') && css.includes('min-height: 48px;'), 'close target has 48px minimums');
  assert.ok(css.includes('background: var(--color-overdue);'), 'close background is the overdue-red token');
  assert.ok(css.includes('color: var(--color-neutral-0);'), 'close glyph is the neutral-0 token (dark-mode safe)');
  assert.ok(css.includes('border-radius: 50%;'), 'close button is a circle');
});

test('SISP-87 audit: every dialog in the tree renders the unified close button', () => {
  let dialogs = 0;
  let conformingButtons = 0;
  for (const [name, source] of sources) {
    for (const d of source.matchAll(DIALOG_RE)) {
      dialogs += 1;
      const block = d[0];
      const openTag = block.slice(0, block.indexOf('>') + 1);
      const id = (openTag.match(/id="([^"]*)"/) || [])[1] || '(no id)';
      const buttons = [...block.matchAll(BUTTON_RE)].map((m) => parseButton(m[0]));
      const good = buttons.filter(conforming);
      conformingButtons += good.length;
      assert.ok(good.length >= 1, `${name}: dialog #${id} has no conforming ↩ close button (shared class + ↩ + Close aria-label)`);
      const firstIntent = buttons.find(closeIntent);
      assert.ok(firstIntent && conforming(firstIntent),
        `${name}: dialog #${id} first close control is not the unified close button (found #${firstIntent?.id || '?'} class="${firstIntent?.cls || ''}" text=${JSON.stringify(firstIntent?.text || '')})`);
    }
  }
  assert.ok(dialogs >= 200, `audit must enumerate 200+ dialogs, found ${dialogs}`);
  assert.ok(conformingButtons >= dialogs, `expected at least one conforming close per dialog, found ${conformingButtons} across ${dialogs} dialogs`);
});

test('SISP-87 audit: every shared-class close button renders the back arrow with a Close label', () => {
  let checked = 0;
  for (const [name, source] of sources) {
    for (const m of source.matchAll(BUTTON_RE)) {
      const b = parseButton(m[0]);
      if (!b.sharedClass) continue;
      checked += 1;
      assert.equal(b.text, '↩', `${name}: .${b.cls} button #${b.id || '?'} must show ↩, found ${JSON.stringify(b.text)}`);
      assert.ok(ariaClose(b), `${name}: .${b.cls} button #${b.id || '?'} must carry a Close aria-label`);
    }
  }
  assert.ok(checked >= 200, `expected 200+ shared-class close buttons, found ${checked}`);
});

// Item-level micro-controls whose entire label is a bare ✕ / ×. These remove
// a row, clear an input, or dismiss a banner/drawer — they never close a
// dialog. Matched by file + id or class or aria-label; the set must match
// EXACTLY, so a new bare-glyph button anywhere fails this test.
const BARE_GLYPH_ALLOWLIST = [
  { file: 'index.html', id: 'navDrawerClose', why: 'navigation drawer chrome (own nav.css design)' },
  { file: 'index.html', id: 'actionSheetClearContextBtn', why: 'clears the action-sheet customer context' },
  { file: 'index.html', id: 'offlineSyncDismissBtn', why: 'dismisses the offline banner' },
  { file: 'index.html', id: 'fastCustomerSearchClearBtn', why: 'clears the customer search input' },
  { file: 'index.html', id: 'quickCollectSearchClearBtn', why: 'clears the Quick Collect search input' },
  { file: 'customer-import.js', cls: 'ci-remove', why: 'removes one bulk-import line' },
  { file: 'nav-wdm-spectrum.js', cls: 'wdm-remove-btn', why: 'PR #453 documented channel-remove exception' },
  { file: 'qa-otdr-bidirectional-inspection.js', cls: 'event-remove-btn', why: 'removes one inspection event row' },
  { file: 'roznamcha.js', aria: 'Remove expense', why: 'removes one roznamcha expense row' },
];

test('SISP-87 audit: bare ✕ / × buttons exist only as allowlisted micro-controls', () => {
  const found = [];
  for (const [name, source] of sources) {
    for (const m of source.matchAll(BUTTON_RE)) {
      const b = parseButton(m[0]);
      if (BARE_GLYPHS.includes(b.text)) found.push({ file: name, ...b });
    }
  }
  for (const b of found) {
    const allowed = BARE_GLYPH_ALLOWLIST.some((a) => a.file === b.file
      && (a.id ? a.id === b.id : a.cls ? b.cls.split(/\s+/).includes(a.cls) : a.aria === b.aria));
    assert.ok(allowed, `${b.file}: bare-glyph button #${b.id || '?'} class="${b.cls}" is not a dialog close and not on the SISP-87 allowlist — unify it to the ↩ close design or classify it in the allowlist with a reason`);
  }
  assert.equal(found.length, BARE_GLYPH_ALLOWLIST.length,
    `expected exactly the ${BARE_GLYPH_ALLOWLIST.length} allowlisted bare-glyph micro-controls, found ${found.length}: ${found.map((b) => `${b.file}#${b.id || b.cls}`).join(', ')}`);
});

test('SISP-87 audit: the four post-#453 dialogs use the unified close (regression pin)', () => {
  const html = read('index.html');
  for (const id of ['waadaChipCloseBtn', 'voidPaymentCloseBtn', 'advancePaymentCloseBtn', 'paymentProofCloseBtn']) {
    const m = html.match(new RegExp(`<button id="${id}"[^>]*>([^<]*)</button>`));
    assert.ok(m, `${id} exists`);
    assert.ok(m[0].includes('class="close-btn"'), `${id} uses the shared .close-btn class`);
    assert.equal(m[1], '↩', `${id} shows the unified back-arrow glyph`);
    assert.ok(/aria-label="Close/.test(m[0]), `${id} keeps its Close aria-label`);
  }
});

test('SISP-87 audit: the DOM-built confirm dialog and toast dismiss stay classified', () => {
  const source = read('ui-feedback.js');
  // createElement('dialog') + innerHTML: no literal <dialog> block for rule 1
  // to enumerate, so pin its close button here.
  assert.ok(source.includes('id="appConfirmCloseBtn" class="close-button"'), 'confirm dialog close uses .close-button');
  assert.ok(source.includes('aria-label="Close">↩</button>'), 'confirm dialog close shows ↩ with aria-label="Close"');
  // The toast dismiss is a notification micro-control (aria-label "Dismiss
  // notification"), not a modal close — pinned so it is a conscious choice.
  assert.ok(source.includes("close.className = 'tsx-close'"), 'toast dismiss keeps .tsx-close');
  assert.ok(source.includes("'Dismiss notification'"), 'toast dismiss is labelled as a notification dismiss');
});
