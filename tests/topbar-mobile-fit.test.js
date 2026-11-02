// Top-bar phone fit (2026-10-29 hotfix): the top bar overflowed phone
// viewports — at 360px .topbar-actions measured 417.8px wide, the language
// toggle was clipped and the theme + field-mode buttons sat off-screen.
// Three root causes are pinned here:
//  1. components.css was brace-unbalanced (604 "{" vs 603 "}"): the
//     @media (max-width: 480px) block opened for the Mohalla cards never
//     closed, so every rule after it (SISP-37 suspense, SISP-48 QR scanner
//     incl. .qr-scan-topbar-btn, SISP-49 daisy chain, ...) silently applied
//     ONLY at <=480px.
//  2. The SISP-10 backup-badge label-hide rule targeted a class
//     (.backup-health-label) that does not exist in the markup — the label
//     span carries id="backupHealthLabel" — so the full "Backup: ..." pill
//     rendered at every width.
//  3. .topbar-actions had flex-shrink:0 and a 10px gap, so the action row
//     could not compact; styles.css now carries a <=620px / <=480px
//     compaction block (gap, shrinkable backup pill with ellipsis, icon-only
//     language + backup at <=480px, brand title hidden at <=480px).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const components = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('topbar fit: components.css braces are balanced', () => {
  const open = components.split('{').length - 1;
  const close = components.split('}').length - 1;
  assert.equal(open, close, `components.css has ${open} "{" but ${close} "}" — an unclosed block traps every following rule inside its media query`);
});

test('topbar fit: the Mohalla-cards 480px media block closes before the SISP-37 section', () => {
  const mediaStart = components.indexOf('@media (max-width: 480px) {\n  .mohalla-cards-grid');
  assert.ok(mediaStart >= 0, 'Mohalla 480px media block exists');
  const sisp37 = components.indexOf('/* SISP-37:', mediaStart);
  assert.ok(sisp37 > mediaStart, 'SISP-37 section follows the Mohalla block');
  const between = components.slice(mediaStart, sisp37);
  assert.match(between, /\n\}\n$/, 'media block must be closed before the SISP-37 rules so they apply at all widths');
});

test('topbar fit: QR top-bar button rule is not trapped inside a media query', () => {
  const qr = components.indexOf('.qr-scan-topbar-btn {');
  assert.ok(qr >= 0, 'QR button rule exists');
  // The rule must sit at brace depth 0 in the file (top level).
  const before = components.slice(0, qr);
  const depth = (before.split('{').length - 1) - (before.split('}').length - 1);
  assert.equal(depth, 0, '.qr-scan-topbar-btn must be a top-level rule so the button is styled at every width');
});

test('topbar fit: backup badge label-hide targets the real span (#backupHealthLabel)', () => {
  assert.ok(index.includes('id="backupHealthLabel"'), 'markup carries the label span');
  const block = components.match(/@media \(max-width: 480px\) \{\s*\/\* Keep the top bar[^}]*#backupHealthLabel \{ display: none; \}/s);
  assert.ok(block, 'the <=480px badge block hides #backupHealthLabel (the old .backup-health-label class selector matched nothing)');
});

test('topbar fit: <=620px actions row can shrink with a 4px gap', () => {
  const block = styles.match(/@media \(max-width: 620px\) \{\s*\.topbar-actions \{ flex-shrink: 1; min-width: 0; gap: 4px; \}/s);
  assert.ok(block, 'styles.css carries the <=620px .topbar-actions compaction rule');
});

test('topbar fit: backup pill is the designated shrinker with an ellipsis label at <=620px', () => {
  assert.match(styles, /\.topbar \.backup-health-badge \{ min-width: 0; flex: 0 1 auto; \}/);
  assert.match(styles, /\.topbar #backupHealthLabel \{ min-width: 0; overflow: hidden; text-overflow: ellipsis; \}/);
});

test('topbar fit: <=480px compacts brand title and language label, keeps both buttons', () => {
  const block = styles.match(/@media \(max-width: 480px\) \{\s*\.topbar \{ padding: 0 6px; gap: 4px; \}\s*\.brand-copy \{ display: none; \}/s);
  assert.ok(block, '<=480px hides the brand title text (the "S" mark stays)');
  assert.match(styles, /\.topbar #languageToggleBtn \{ min-width: 0; padding: 0 6px; gap: 0; \}/);
  assert.match(styles, /\.topbar #languageToggleBtn \.language-toggle-label \{ display: none; \}/);
  // The buttons themselves are never display:none at phone widths.
  assert.ok(index.includes('id="languageToggleBtn"'), 'language button stays in the markup');
  assert.ok(index.includes('id="backupHealthBadge"'), 'backup badge stays in the markup');
});

// ---------------------------------------------------------------------------
// SISP-193: repo-wide CSS brace-balance & @media scope ratchet (PR #491
// extension). The PR #491 guard above covers components.css only, with a
// naive split('{') count. That is not enough: the same unclosed-@media
// accident in ANY other stylesheet would silently trap every following
// rule inside the unclosed block, and the naive count itself breaks on
// braces inside comments/strings (urdu-font.css already carries a matched
// pair inside a comment: `body * { font-family: ...; }`). The ratchet
// below therefore:
//   * discovers every shipped .css file dynamically (tree walk; only
//     node_modules/, dist/ and .git/ are excluded) so a future stylesheet
//     is covered the day it lands — no hardcoded list to exempt it;
//   * parses each file with a comment/string-aware stack scanner: every
//     opened block must close, and the FIRST unclosed opener is reported
//     with its line and prelude, so a count-compensated trap (an unclosed
//     @media plus a stray extra "}" elsewhere) still fails.
// ---------------------------------------------------------------------------
import { readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

function discoverCssFiles(root) {
  const found = [];
  const pending = [root];
  while (pending.length) {
    const dir = pending.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) pending.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.css')) {
        found.push(relative(root, full));
      }
    }
  }
  return found.sort();
}

// Comment/string-aware block scanner. Returns the raw brace counts plus
// the stack of blocks still open at EOF (index 0 = first unclosed opener)
// and the line of the first stray "}" that closed nothing.
function scanCssBlocks(source) {
  const stack = [];
  let line = 1;
  let i = 0;
  let prelude = '';
  let opens = 0;
  let closes = 0;
  let firstExtraCloseLine = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === '\n') { line++; i++; continue; }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let j = i; j < stop; j++) if (source[j] === '\n') line++;
      i = stop; continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch; i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '\n') line++;
        i++;
      }
      i++; continue;
    }
    if (ch === '{') {
      opens++;
      stack.push({ line, prelude: prelude.trim().replace(/\s+/g, ' ').slice(0, 80) });
      prelude = ''; i++; continue;
    }
    if (ch === '}') {
      closes++;
      if (stack.length === 0) { if (!firstExtraCloseLine) firstExtraCloseLine = line; }
      else stack.pop();
      prelude = ''; i++; continue;
    }
    if (ch === ';') { prelude = ''; i++; continue; }
    prelude += ch; i++;
  }
  return { opens, closes, unclosed: stack, firstExtraCloseLine };
}

const cssFiles = discoverCssFiles(repoRoot);

test('css ratchet: discovery finds every shipped stylesheet (independent walk agrees)', () => {
  // Independent second enumeration (recursive, written separately on
  // purpose): if the two walks ever disagree, discovery itself is broken
  // and a stylesheet could be silently exempt from the guard.
  const independent = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.css')) independent.push(relative(repoRoot, full));
    }
  };
  walk(repoRoot);
  assert.deepEqual(cssFiles, independent.sort());
  // The stylesheets shipping today must all be under the guard, including
  // the four the SISP-193 spec names.
  for (const name of ['styles.css', 'components.css', 'nav.css', 'screen-router.css',
    'bulk-collect.css', 'customer-import.css', 'dark-contrast.css', 'dashboard.css',
    'payments-inbox.css', 'payments-list.css', 'profile-ui.css', 'tokens.css',
    'ui-feedback.css', 'urdu-font.css']) {
    assert.ok(cssFiles.includes(name), `${name} must be covered by the CSS brace ratchet`);
  }
});

test('css ratchet: a future stylesheet is picked up automatically (scratch tree)', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'sisp193-css-'));
  try {
    writeFileSync(join(scratch, 'new-feature.css'), '.a { color: red; }\n');
    mkdirSync(join(scratch, 'sub'));
    writeFileSync(join(scratch, 'sub', 'nested.css'), '.b { color: blue; }\n');
    mkdirSync(join(scratch, 'node_modules'));
    writeFileSync(join(scratch, 'node_modules', 'dep.css'), '.c { color: green; }\n');
    mkdirSync(join(scratch, 'dist'));
    writeFileSync(join(scratch, 'dist', 'built.css'), '.d { color: pink; }\n');
    assert.deepEqual(discoverCssFiles(scratch), ['new-feature.css', join('sub', 'nested.css')]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

for (const relFile of cssFiles) {
  test(`css ratchet: ${relFile} braces balanced, zero unclosed blocks`, () => {
    const source = readFileSync(join(repoRoot, relFile), 'utf8');
    const { opens, closes, unclosed, firstExtraCloseLine } = scanCssBlocks(source);
    assert.equal(firstExtraCloseLine, 0, `${relFile} has a stray "}" at line ${firstExtraCloseLine} that closes nothing`);
    assert.equal(unclosed.length, 0,
      unclosed.length
        ? `${relFile}: first unclosed block opens at line ${unclosed[0].line} ("${unclosed[0].prelude}") — every rule after it is trapped inside that block`
        : '');
    assert.equal(opens, closes, `${relFile} has ${opens} "{" but ${closes} "}"`);
  });
}

test('css ratchet canary: an unclosed @media block is caught with its line', () => {
  const bad = '.a { color: red; }\n@media (max-width: 480px) {\n  .b { color: blue; }\n';
  const r = scanCssBlocks(bad);
  assert.equal(r.unclosed.length, 1);
  assert.equal(r.unclosed[0].line, 2);
  assert.match(r.unclosed[0].prelude, /^@media/);
});

test('css ratchet canary: an unclosed plain rule is caught with its line', () => {
  const bad = '.a { color: red; }\n.b { color: blue;\n';
  const r = scanCssBlocks(bad);
  assert.equal(r.unclosed.length, 1);
  assert.equal(r.unclosed[0].line, 2);
  assert.equal(r.unclosed[0].prelude, '.b');
});

test('css ratchet canary: braces inside comments and strings are not blocks', () => {
  const ok = '/* note: body * { font-family: x; } */\n.a::after { content: "}"; }\n.b { content: \'{\'; }\n';
  const r = scanCssBlocks(ok);
  assert.equal(r.opens, 2);
  assert.equal(r.closes, 2);
  assert.equal(r.unclosed.length, 0);
  assert.equal(r.firstExtraCloseLine, 0);
});

test('css ratchet canary: a count-compensated trap still fails (naive counting would pass)', () => {
  // Raw counts balance (3 "{" vs 3 "}"), yet the @media never closes and a
  // stray "}" closes nothing — exactly the silent-trap shape this ratchet
  // exists to catch.
  const bad = '.a { color: red; }}\n@media (max-width: 480px) {\n  .b { color: blue; }\n';
  const r = scanCssBlocks(bad);
  assert.equal(r.opens, r.closes);
  assert.equal(r.firstExtraCloseLine, 1);
  assert.equal(r.unclosed.length, 1);
  assert.match(r.unclosed[0].prelude, /^@media/);
});
