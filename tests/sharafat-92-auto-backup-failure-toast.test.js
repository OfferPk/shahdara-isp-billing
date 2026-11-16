// Sharafat 92 — a failed automatic backup is invisible unless the Backup
// screen is open: the failure was written only to #backupStatus, which lives
// inside the hidden Backup & Restore panel. The fix toasts the failure too —
// persistently (until dismissed), with the same text and the quota toast's
// Download action — in BOTH catch branches of checkAutomaticBackup, deduped
// by a module-scope flag that a later success clears. The toast system
// itself gains a `persistent: true` option (ui-feedback show() + the app.js
// fallback toast()).
//
// Source pins only (the ledger-saved-toast pattern) — no test executes
// app.js: checkAutomaticBackup's module-scope state ($, localBackupStore,
// persistenceBlocked, ...) cannot be harnessed in proportion for this item.
// The checks port the Sharafat 92 repro verbatim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const ui = read('ui-feedback.js');

function bodyOf(src, startRe) {
  const m = src.match(startRe);
  if (!m) return null;
  // Scan from the END of the matched signature: show()'s signature itself
  // contains `opts = {}`, and scanning from the match start would return
  // just that `{}` instead of the function body.
  const open = src.indexOf('{', m.index + m[0].length);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return null;
}

const fn = bodyOf(app, /async function checkAutomaticBackup\(\)/);
assert.ok(fn, 'checkAutomaticBackup exists in app.js');

// Split the function into its two catch blocks: the inner catch ends where
// the outer catch starts.
const innerStart = fn.indexOf('} catch (error) {', fn.indexOf('saveLocalSnapshot'));
const outerStart = fn.lastIndexOf('} catch (error) {');
const innerCatch = fn.slice(innerStart, outerStart);
const outerCatch = fn.slice(outerStart);
const successRegion = fn.slice(fn.indexOf("await saveLocalSnapshot('automatic')"), innerStart);

const DOWNLOAD_ACTION = /actionLabel:\s*'Download JSON backup'/;
const ON_ACTION = /onAction:\s*\(\)\s*=>\s*\{\s*\$\('#downloadJsonBackupButton'\)\?\.\s*click\(\);\s*\}/;

// The toast message must be the EXACT panel text — extract both template
// literals from a catch block and compare them, instead of asserting two
// copies of one hardcoded string.
function panelAndToastTexts(catchBlock) {
  const panel = catchBlock.match(/\$\('#backupStatus'\)\.textContent = `([^`]*)`;/);
  const toastCall = catchBlock.match(/toast\(`([^`]*)`, \{/);
  return { panel: panel && panel[1], toast: toastCall && toastCall[1] };
}

test('Sharafat 92 F1: save failure (inner catch) toasts with the Download JSON backup action', () => {
  assert.ok(/toast\(/.test(innerCatch), 'inner catch calls toast()');
  assert.ok(DOWNLOAD_ACTION.test(innerCatch), 'inner catch toast reuses the quota action label');
  assert.ok(ON_ACTION.test(innerCatch), 'inner catch toast reuses the quota action (click #downloadJsonBackupButton)');
  const { panel, toast: toastText } = panelAndToastTexts(innerCatch);
  assert.ok(panel, 'inner catch still writes the panel text');
  assert.ok(toastText, 'inner catch toast carries a message');
  assert.equal(toastText, panel, 'toast message is the exact #backupStatus text');
});

test('Sharafat 92 F2: check failure (outer catch) toasts with the Download JSON backup action', () => {
  assert.ok(/toast\(/.test(outerCatch), 'outer catch calls toast()');
  assert.ok(DOWNLOAD_ACTION.test(outerCatch), 'outer catch toast reuses the quota action label');
  assert.ok(ON_ACTION.test(outerCatch), 'outer catch toast reuses the quota action (click #downloadJsonBackupButton)');
  const { panel, toast: toastText } = panelAndToastTexts(outerCatch);
  assert.ok(panel, 'outer catch still writes the panel text');
  assert.ok(toastText, 'outer catch toast carries a message');
  assert.equal(toastText, panel, 'toast message is the exact #backupStatus text');
});

test('Sharafat 92 F3: the failure toast is persistent until dismissed (call asks + both toast impls honour it)', () => {
  assert.ok(/toast\([^;]*persistent:\s*true/s.test(fn), 'failure toast calls pass persistent: true');
  const showBody = bodyOf(ui, /function show\(message, opts = \{\}\)/);
  assert.ok(showBody, 'ui-feedback show() exists');
  assert.ok(/if\s*\(\s*!opts\.persistent\s*\)\s*\{?\s*startTimer\(rec, duration\)/.test(showBody),
    'ui-feedback show() skips startTimer for a persistent toast');
  const fallbackStart = app.indexOf('function toast(message, options');
  const fallbackBody = app.slice(fallbackStart, app.indexOf('window.toast = toast;'));
  assert.ok(/if\s*\(\s*!options\.persistent\s*\)\s*\{?\s*toastTimer\s*=/.test(fallbackBody),
    'app.js fallback toast() skips its setTimeout for a persistent toast');
  assert.ok(/type: 'error'/.test(innerCatch) && /type: 'error'/.test(outerCatch),
    'failure toasts are type error, so they are announced (role=alert)');
});

test('Sharafat 92 F3: the countdown progress bar is hidden for a persistent toast', () => {
  const showBody = bodyOf(ui, /function show\(message, opts = \{\}\)/);
  assert.ok(/if\s*\(rec\.persistent\)\s*bar\.style\.display = 'none'/.test(showBody),
    'show() hides the progress bar when the toast is persistent — a countdown bar on a toast that never counts down would be a lie');
});

test('Sharafat 92 F3: a persistent toast cloned into the stack keeps no timer (R3)', () => {
  const showBody = bodyOf(ui, /function show\(message, opts = \{\}\)/);
  assert.ok(/persistent: prev\.persistent/.test(showBody), 'the stacked copy inherits persistence from the toast it clones');
  assert.ok(/if\s*\(!rec\.persistent\)\s*startTimer\(rec, Math\.min\(rec\.remaining, 5000\)\)/.test(showBody),
    'the stacking branch skips the timer for a persistent copy — Math.min(undefined, 5000) is NaN, and setTimeout(NaN) would dismiss it at once');
});

test('Sharafat 92 F3: resume() never arms a timer for a persistent toast', () => {
  const resumeBody = bodyOf(ui, /function resume\(rec\)/);
  assert.ok(resumeBody, 'resume() exists in ui-feedback.js');
  assert.ok(/rec\.persistent/.test(resumeBody),
    'resume() returns early for a persistent toast — otherwise a hover-then-leave would start a timer with an undefined remaining and dismiss it at once');
});

test('Sharafat 92 F4: a module-scope flag dedupes the failure toast and a success clears it', () => {
  assert.ok(/let\s+automaticBackupFailureToast\s*=\s*null/.test(app),
    'the dedupe flag is declared at module scope');
  assert.ok(fn.includes('automaticBackupFailureToast'), 'checkAutomaticBackup references the flag');
  assert.ok(/if\s*\(!automaticBackupFailureToast\)/.test(innerCatch), 'inner catch toasts only when no failure toast is already up');
  assert.ok(/if\s*\(!automaticBackupFailureToast\)/.test(outerCatch), 'outer catch toasts only when no failure toast is already up');
  assert.ok(/automaticBackupFailureToast\?\.dismiss\?\.\(\)/.test(successRegion),
    'success dismisses the failure toast handle when one exists (guarded — the fallback toast returns no handle)');
  assert.ok(/automaticBackupFailureToast\s*=\s*null/.test(successRegion),
    'success resets the flag so a later failure toasts again');
});

test('Sharafat 92 S1: success path unchanged — no toast when the automatic save succeeds', () => {
  assert.ok(!/toast\(/.test(successRegion), 'the success branch stays silent');
});

test('Sharafat 92 S2: #backupStatus failure text still written in both catch branches', () => {
  assert.ok(/Automatic backup failed:/.test(innerCatch), 'inner catch still writes the panel failure text');
  assert.ok(/Automatic backup check failed:/.test(outerCatch), 'outer catch still writes the panel failure text');
});

test('Sharafat 92 S3: manual Backup Now failure still toasts (control — already surfaced)', () => {
  assert.ok(/toast\(`Backup failed: \$\{message\}`\)/.test(app), 'manual failure toast unchanged');
});

test('Sharafat 92 C1: quota-warning toast unchanged (8000 ms, same Download action)', () => {
  assert.ok(/toast\('Ledger is getting large for browser storage — download a JSON backup now so nothing is lost\.', \{ type: 'warning', title: 'Storage getting full', duration: 8000, actionLabel: 'Download JSON backup', onAction: \(\) => \{ \$\('#downloadJsonBackupButton'\)\?\.click\(\); \} \}\)/.test(app),
    'quota toast call changed');
});

test('Sharafat 92 C2: 60 s throttle intact (at most one check per 60 s)', () => {
  assert.ok(/lastAutomaticBackupCheckAt < 60_000/.test(app), 'throttle changed');
});

test('Sharafat 92 C3: triggers intact — focus/pageshow/visibilitychange + boot call', () => {
  assert.ok(/window\.addEventListener\('focus', \(\) => \{ checkMonthlyBilling\(\); void checkAutomaticBackup\(\); \}\)/.test(app), 'focus trigger changed');
  assert.ok(/window\.addEventListener\('pageshow', \(\) => \{ checkMonthlyBilling\(\); void checkAutomaticBackup\(\); \}\)/.test(app), 'pageshow trigger changed');
  assert.ok(/document\.addEventListener\('visibilitychange'/.test(app), 'visibilitychange trigger changed');
  assert.ok(/void checkAutomaticBackup\(\);/.test(app), 'boot call changed');
});

test('Sharafat 92 C4/C5: early returns stay silent — not-due is not a failure, storage-unavailable is already surfaced at boot', () => {
  const earlyRegion = fn.slice(fn.indexOf('if (!info'), fn.indexOf("$('#backupStatus').textContent = 'Automatic backup due"));
  assert.ok(!/toast\(/.test(earlyRegion), 'toast on an early-return path');
});

test('Sharafat 92 G1: EN/UR parity holds (no orphan key — no new key under the literal-text decision)', () => {
  const enKeys = new Set(Object.keys(TRANSLATIONS.en));
  const urKeys = new Set(Object.keys(TRANSLATIONS.ur));
  const keyDiff = [...enKeys].filter((k) => !urKeys.has(k)).concat([...urKeys].filter((k) => !enKeys.has(k)));
  assert.deepEqual(keyDiff, [], `key mismatch: ${keyDiff.slice(0, 5).join(', ')}`);
});

test('Sharafat 92 G2: braces balanced in app.js + ui-feedback.js', () => {
  function balanced(src) {
    let d = 0;
    for (const c of src) {
      if (c === '{') d++;
      else if (c === '}') d--;
      if (d < 0) return false;
    }
    return d === 0;
  }
  assert.ok(balanced(app), 'app.js braces unbalanced');
  assert.ok(balanced(ui), 'ui-feedback.js braces unbalanced');
});
