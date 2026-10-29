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
