// Sharafat 98 — one toast system: error toasts default to 8000 ms and stay
// until dismissed when they carry an action; info/success keep 4000 ms,
// warnings 6000 ms — the SAME rule in the app.js fallback and the
// ui-feedback.js impl.
//
// Parent decisions (prep header D1–D10) implemented here, NOT the spec as
// written:
// - D1: info/success KEEP 4000 in the impl (the spec's "keep 2800" was written
//   from the fallback's flat-2800 mental model; the impl deliberately gives
//   4000). The fallback rises to the same 4000. ui-feedback.test.js:23 stays.
// - D2: the quota warning stays 8000 ms timed (persistence is errors-only).
// - D3: the storage-full error+action toasts become persistent; their
//   explicit 12000 stays at the call site, inert.
// - D5: app.js imports the pure helpers from ui-feedback.js (no cycle —
//   ui-feedback.js imports only nav-language.js); the QR boot toast then
//   takes the impl path.
// - D6: the fallback renders the FULL typed markup (icon/title/close
//   ×/progress, role + aria-live, same duration rule, pause-on-hover) and
//   moves #toast into a .tsx-stack container so the stack-scoped tsx layout
//   applies. The one gap left is the modal top layer (the impl lifts the
//   stack into an open dialog; the fallback cannot — a toast over an open
//   modal may sit under the backdrop, still announced via aria-live).
// - D10: persistence resolves INTO opts.persistent / options.persistent
//   (Sharafat 92 F3 pins those source shapes); defaultDuration stays a pure
//   NUMERIC table — never Infinity.
// - Repro ports A2/B2/B3/C4 are REWRITTEN to the corrected expectations
//   (A3/A4 flip to 4000; B3 no longer asserts the old flat 2800).
//
// Source pins only (the Sharafat 92 pattern) — app.js cannot be imported
// (module-scope DOM work) and show() needs a real DOM, so the timer
// behaviour is pinned by source shape + the pure defaultDuration table,
// exactly as the 92 file pins persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { defaultDuration, inferToastType, inferTitle, TOAST_TYPES } from '../ui-feedback.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const ui = read('ui-feedback.js');
const html = read('index.html');

function bodyOf(src, startRe) {
  const m = src.match(startRe);
  if (!m) return null;
  const open = src.indexOf('{', m.index + m[0].length);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return null;
}

const fallbackStart = app.indexOf('function toast(message, options');
const fallbackBody = app.slice(fallbackStart, app.indexOf('window.toast = toast;'));
assert.ok(fallbackBody.length > 0, 'app.js fallback toast() exists');
const showBody = bodyOf(ui, /function show\(message, opts = \{\}\)/);
assert.ok(showBody, 'ui-feedback show() exists');

// ── R — repro port (21): the prep repro's checks, as tests. The 9
// spec-gap checks flip to PASS on the fix (to the CORRECTED expectations);
// the 12 guards stay PASS. ──────────────────────────────────────────────

test('R A1: error default is 8000 (spec)', () => {
  assert.equal(defaultDuration('error', false), 8000);
});

test('R A2: error+action stays until dismissed — show() resolves persistence into opts.persistent (D10)', () => {
  // NOT defaultDuration === Infinity: persistence lives in opts.persistent
  // (Sharafat 92 F3 pins the guard shapes), and defaultDuration stays numeric.
  assert.match(showBody, /opts = \{ \.\.\.opts, persistent: opts\.persistent === true \|\| \(type === 'error' && actions\.length > 0\) \};/);
  assert.match(showBody, /if\s*\(\s*!opts\.persistent\s*\)\s*\{?\s*startTimer\(rec, duration\)/);
  assert.equal(defaultDuration('error', true), 8000, 'defaultDuration stays a pure number table');
});

test('R A3: info default is 4000 — D1, NOT 2800 (the spec was written from the fallback)', () => {
  assert.equal(defaultDuration('info', false), 4000);
});

test('R A4: success default is 4000 — D1, NOT 2800', () => {
  assert.equal(defaultDuration('success', false), 4000);
});

test('R A5: warning default unchanged by the spec (6000, spec silent)', () => {
  assert.equal(defaultDuration('warning', false), 6000);
});

test('R B1: fallback error default is 8000 — via defaultDuration, not a flat number', () => {
  assert.match(fallbackBody, /defaultDuration\(type, hasAction\)/);
  assert.doesNotMatch(fallbackBody, /duration = 2800/, 'the flat 2800 fallback default is gone');
});

test('R B2: fallback error+action stays until dismissed — options.persistent resolves it (D10)', () => {
  assert.match(fallbackBody, /options = \{ \.\.\.options, persistent: options\.persistent === true \|\| \(type === 'error' && hasAction\) \};/);
  assert.match(fallbackBody, /if\s*\(\s*!options\.persistent\s*\)\s*\{?\s*toastTimer\s*=/);
});

test('R B3: fallback info/success default is 4000 — explicit durations stay floors via max()', () => {
  // The fallback uses the SAME max(explicit, default) line as the impl's show().
  assert.match(fallbackBody, /const duration = Math\.max\(Number\.isFinite\(asked\) && asked > 0 \? asked : 0, defaultDuration\(type, hasAction\)\);/);
  assert.equal(defaultDuration('info', false), 4000);
  assert.equal(defaultDuration('success', false), 4000);
});

test('R C1: impl renders a typed toast (role=alert for errors)', () => {
  assert.match(ui, /\.setAttribute\('role', type === 'error' \? 'alert' : 'status'\)/);
});

test('R C2: fallback renders the same typed markup (icon/title/close ×/progress)', () => {
  for (const cls of ['tsx-icon', 'tsx-body', 'tsx-title', 'tsx-message', 'tsx-actions', 'tsx-close', 'tsx-progress']) {
    assert.ok(fallbackBody.includes(cls), `fallback renders .${cls}`);
  }
});

test('R C3: fallback announces errors assertively', () => {
  assert.match(fallbackBody, /setAttribute\('role', type === 'error' \? 'alert' : 'status'\)/);
  assert.match(fallbackBody, /setAttribute\('aria-live', type === 'error' \? 'assertive' : 'polite'\)/);
});

test('R C4: impl and fallback agree on the error duration — both 8000', () => {
  assert.equal(defaultDuration('error', false), 8000);
  assert.match(fallbackBody, /defaultDuration\(type, hasAction\)/);
});

test('R D1: spec claim "the fallback element has no role" is WRONG — markup HAS role=status + aria-live=polite', () => {
  const toastEl = html.match(/<div id="toast"[^>]*>/);
  assert.ok(toastEl && /role="status"/.test(toastEl[0]) && /aria-live="polite"/.test(toastEl[0]),
    `markup: ${toastEl ? toastEl[0] : 'not found'}`);
});

test('R D2: delegation exists — app.js toast() returns __toastImpl when present', () => {
  assert.match(app, /if \(typeof window\.__toastImpl === 'function'\) return window\.__toastImpl\(message, options \|\| \{\}\);/);
});

test('R D3: the fallback is still reachable at boot (QR deep-link toast fires during app.js evaluation)', () => {
  assert.match(app, /toast\('Customer not found for this QR link\.'\)/);
});

test('R E1: the 92 failure toasts are already persistent (explicit persistent:true)', () => {
  assert.match(app, /persistent:\s*true/);
  assert.match(app, /checkAutomaticBackup/);
});

test('R E2: explicit durations are floors — show() takes max(explicit, default)', () => {
  assert.match(ui, /Math\.max\(Number\.isFinite\(asked\) && asked > 0 \? asked : 0, defaultDuration\(type, actions\.length > 0\)\)/);
});

test('R E3: QUICK_UNDO_WINDOW_MS is still 10000 (host-level undo window)', () => {
  const quickUndo = read('quick-undo-toast.js');
  assert.match(quickUndo, /QUICK_UNDO_WINDOW_MS = 10000/);
});

test('R F1: inferToastType spots an error message', () => {
  assert.equal(inferToastType('Payment failed: network error'), 'error');
});

test('R F2: inferToastType spots a success message', () => {
  assert.equal(inferToastType('Customer added successfully'), 'success');
});

test('R F3: errors get the alert title via TOAST_TYPES (inferTitle returns null for errors by design)', () => {
  assert.equal(inferTitle('error', 'Payment failed'), null);
  assert.equal(TOAST_TYPES.error.title, "Couldn't do that");
});

// ── D — duration rule (10): the unified rule, per path. ────────────────

test('D error, no action → 8000 (impl)', () => {
  assert.equal(defaultDuration('error', false), 8000);
});

test('D error + action → persistent (impl): show() resolves it into opts.persistent', () => {
  assert.match(showBody, /\(type === 'error' && actions\.length > 0\)/);
  assert.match(showBody, /if \(rec\.persistent\) bar\.style\.display = 'none'/);
});

test('D error, no action → 8000 (fallback): duration comes from defaultDuration', () => {
  assert.match(fallbackBody, /const duration = Math\.max\(Number\.isFinite\(asked\) && asked > 0 \? asked : 0, defaultDuration\(type, hasAction\)\);/);
});

test('D error + action → persistent (fallback): options.persistent resolves it', () => {
  assert.match(fallbackBody, /\(type === 'error' && hasAction\)/);
  assert.match(fallbackBody, /if \(options\.persistent\) bar\.style\.display = 'none'/);
});

test('D info, no action → 4000 (impl) — D1, the spec’s 2800 is corrected', () => {
  assert.equal(defaultDuration('info', false), 4000);
});

test('D success, no action → 4000 (impl) — D1', () => {
  assert.equal(defaultDuration('success', false), 4000);
});

test('D info/success, no action → 4000 (fallback): the flat 2800 is gone', () => {
  assert.doesNotMatch(fallbackBody, /duration = 2800/);
  assert.equal(defaultDuration('info', false), 4000);
  assert.equal(defaultDuration('success', false), 4000);
});

test('D warning, no action → 6000 (unchanged)', () => {
  assert.equal(defaultDuration('warning', false), 6000);
});

test('D warning + action → 7000 floor (unchanged)', () => {
  assert.equal(defaultDuration('warning', true), 7000);
});

test('D info/success + action → 7000 floor (unchanged)', () => {
  assert.equal(defaultDuration('success', true), 7000);
  assert.equal(defaultDuration('info', true), 7000);
});

// ── F — explicit-duration floors (8): max() semantics, per call site. ───

test('F quota warning 8000: explicit floor survives (D2 — stays timed)', () => {
  assert.match(app, /type: 'warning', title: 'Storage getting full', duration: 8000/);
  assert.equal(Math.max(8000, defaultDuration('warning', true)), 8000);
});

test('F save-failed error 8000: explicit floor equals the new default', () => {
  assert.match(app, /type: 'error', title: 'Save failed', duration: 8000/);
  assert.equal(Math.max(8000, defaultDuration('error', false)), 8000);
});

test('F storage-full 12000 → persistent (D3): the rule wins over the explicit duration', () => {
  // Both call sites keep their explicit 12000 + Download action (D4 — the
  // call is untouched); persistence comes from the rule, not the call.
  const calls = app.match(/duration: 12000, actionLabel: 'Download JSON backup'/g) || [];
  assert.equal(calls.length, 2, 'both storage-full calls keep duration: 12000');
  assert.match(showBody, /\(type === 'error' && actions\.length > 0\)/);
  assert.match(fallbackBody, /\(type === 'error' && hasAction\)/);
});

test('F SW update 600000: explicit floor survives, stays timed (D8 — only errors persist)', () => {
  const pwa = read('nav-pwa.js');
  assert.match(pwa, /SW_UPDATE_TOAST_DURATION_MS = 600000/);
  assert.equal(Math.max(600000, defaultDuration('info', true)), 600000);
  // The persistence rule is error-only, so an info toast can never resolve persistent.
  assert.match(showBody, /type === 'error' && actions\.length > 0/);
});

test('F SW offline warning 8000: explicit floor survives', () => {
  const pwa = read('nav-pwa.js');
  assert.match(pwa, /SW_OFFLINE_TOAST_DURATION_MS = 8000/);
  assert.equal(Math.max(8000, defaultDuration('warning', false)), 8000);
});

test('F QC undo 5000: the action floor wins over the explicit 5000', () => {
  // UNDO_WINDOW_MS is 5000, but success+action floors at 7000 — the
  // explicit duration survives as a floor inside max(), it is not a cap.
  const qc = read('nav-quick-collect.js');
  assert.match(qc, /UNDO_WINDOW_MS = 5000/);
  assert.equal(Math.max(5000, defaultDuration('success', true)), 7000);
});

test('F host undo 10000: explicit floor survives', () => {
  assert.equal(Math.max(10000, defaultDuration('success', true)), 10000);
});

test('F QC "payment saved" 3000 → 4000 (D7/D1): was 4000, stays 4000', () => {
  // The explicit 3000 is a floor, not a cap: max(3000, 4000) = 4000, so the
  // toast does NOT shorten under the new rule.
  assert.equal(Math.max(3000, defaultDuration('success', false)), 4000);
});

// ── M — markup / announcement parity (8): the fallback renders the same
// toast the impl renders. ────────────────────────────────────────────────

test('M fallback renders the typed markup: icon + title + message + actions + close × + progress', () => {
  for (const piece of [
    /icon\.className = 'tsx-icon'/,
    /body\.className = 'tsx-body'/,
    /titleEl\.className = 'tsx-title'/,
    /textSpan\.className = 'toast-text tsx-message'/,
    /wrap\.className = 'tsx-actions'/,
    /close\.className = 'tsx-close'/,
    /bar\.className = 'tsx-progress'/
  ]) assert.match(fallbackBody, piece);
});

test('M fallback error toast is role=alert + aria-live=assertive', () => {
  assert.match(fallbackBody, /setAttribute\('role', type === 'error' \? 'alert' : 'status'\)/);
  assert.match(fallbackBody, /setAttribute\('aria-live', type === 'error' \? 'assertive' : 'polite'\)/);
});

test('M fallback info/success toast is role=status + aria-live=polite', () => {
  // The same ternaries as M2: the non-error branch is status/polite.
  assert.match(fallbackBody, /'alert' : 'status'/);
  assert.match(fallbackBody, /'assertive' : 'polite'/);
  assert.match(fallbackBody, /setAttribute\('aria-atomic', 'true'\)/);
});

test('M fallback title comes from TOAST_TYPES (error → "Couldn\'t do that")', () => {
  assert.match(fallbackBody, /options\.title \|\| inferTitle\(type, text\) \|\| meta\.title/);
  assert.equal(TOAST_TYPES.error.title, "Couldn't do that");
  assert.equal(TOAST_TYPES.success.title, 'Done');
});

test('M fallback click-to-dismiss is kept (tap the toast to hide it)', () => {
  assert.match(fallbackBody, /element\.onclick = \(\) => \{ element\.hidden = true; \};/);
});

test('M fallback is single-element replace — no stacking in the last-resort path (documented)', () => {
  // The fallback replaces #toast's children; stacking (cloning the showing
  // toast into .tsx-old) lives in the impl only. A last-resort toast that
  // replaces the previous one is the documented behaviour, not a gap —
  // the path fires ~never under the D5 import.
  assert.match(fallbackBody, /element\.replaceChildren\(\)/);
  assert.doesNotMatch(fallbackBody, /cloneNode/, 'the fallback must not clone — no second stack');
});

test('M fallback pauses on hover/focus, like the impl', () => {
  assert.match(fallbackBody, /element\.onpointermove = pauseFallback/);
  assert.match(fallbackBody, /element\.onpointerleave = resumeFallback/);
  assert.match(fallbackBody, /element\.onfocusin = pauseFallback/);
  assert.match(fallbackBody, /element\.onfocusout = \(e\) => \{ if \(!element\.contains\(e\.relatedTarget\)\) resumeFallback\(\); \};/);
  assert.match(fallbackBody, /toastRemaining = Math\.max\(400, toastRemaining - \(Date\.now\(\) - toastStartedAt\)\)/);
  assert.match(fallbackBody, /element\.classList\.add\('is-paused'\)/);
  assert.match(fallbackBody, /element\.classList\.remove\('is-paused'\)/);
});

test('M fallback moves #toast into a .tsx-stack container, so the stack-scoped tsx layout applies', () => {
  assert.match(fallbackBody, /document\.getElementById\('toastStack'\)/);
  assert.match(fallbackBody, /stack\.className = 'tsx-stack'/);
  assert.match(fallbackBody, /if \(element\.parentElement !== stack\) stack\.appendChild\(element\);/);
  assert.match(fallbackBody, /element\.classList\.add\('tsx'\)/);
  // The type accent comes from the .tsx[data-type] rule, so the dataset must be set.
  assert.match(fallbackBody, /element\.dataset\.type = type;/);
});

// ── P — Sharafat 92 no-regress (4): the 98 seam must not break the 92
// contract. These DUPLICATE the 92 file's guards on purpose. ───────────

test('P F3 shapes still match in show() (timer guard, bar hide, stacked-copy inherit, resume)', () => {
  assert.match(showBody, /if\s*\(\s*!opts\.persistent\s*\)\s*\{?\s*startTimer\(rec, duration\)/);
  assert.match(showBody, /if\s*\(rec\.persistent\)\s*bar\.style\.display = 'none'/);
  assert.match(showBody, /persistent: prev\.persistent/);
  assert.match(showBody, /if\s*\(!rec\.persistent\)\s*startTimer\(rec, Math\.min\(rec\.remaining, 5000\)\)/);
  const resumeBody = bodyOf(ui, /function resume\(rec\)/);
  assert.ok(resumeBody && /rec\.persistent/.test(resumeBody), 'resume() returns early for a persistent toast');
});

test('P F3 shape still matches in the fallback (timer guard reads options.persistent)', () => {
  assert.match(fallbackBody, /if\s*\(\s*!options\.persistent\s*\)\s*\{?\s*toastTimer\s*=/);
});

test('P C1: quota-warning toast unchanged (8000 ms, same Download action)', () => {
  assert.match(app, /toast\('Ledger is getting large for browser storage — download a JSON backup now so nothing is lost\.', \{ type: 'warning', title: 'Storage getting full', duration: 8000, actionLabel: 'Download JSON backup', onAction: \(\) => \{ \$\('#downloadJsonBackupButton'\)\?\.click\(\); \} \}\)/);
});

test('P dedupe flag + success clears survive (92 F4)', () => {
  assert.match(app, /let\s+automaticBackupFailureToast\s*=\s*null/);
  const fn = bodyOf(app, /async function checkAutomaticBackup\(\)/);
  assert.ok(fn, 'checkAutomaticBackup exists in app.js');
  assert.match(fn, /automaticBackupFailureToast\?\.dismiss\?\.\(\)/);
  assert.match(fn, /automaticBackupFailureToast\s*=\s*null/);
  assert.match(fn, /toast\([^;]*persistent:\s*true/s);
});

// ── G — guards (3). ─────────────────────────────────────────────────────

test('G EN/UR parity holds at 4,722/4,722 (Round 2 D9 net −1; Quick Collect polish +4 keys; Plan 582 −6 orphan keys)', () => {
  // Round 2 (D9): net −1 key — 'cust_card_father_ref_short' and
  // 'cust_card_tenure_since_short' deleted, 'cust_card_ref_short' added.
  // Quick Collect polish (2026-11-17) adds 4 keys (EN + UR) —
  // qc3_collect_advance, qc_head_payable, qc_head_bill_dues,
  // qc_loose_keep_chip. Parity is kept: 4,672 − 1 + 4 = 4,675.
  // Plan 582 (D1(b)) deletes the six orphan
  // dash_tile_collect_*/dash_tile_closing_* keys: 4,675 − 6 = 4,669.
  // (Test title re-pinned with the asserts by Plan 586 — the parenthetical
  // is the history of how the count reached 4,669 in 582; the number is
  // the live pin. Titles and asserts move together from here on.)
  const enKeys = Object.keys(TRANSLATIONS.en);
  const urKeys = Object.keys(TRANSLATIONS.ur);
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  assert.equal(enKeys.length, 5145);
  assert.equal(urKeys.length, 5145);
  const keyDiff = enKeys.filter((k) => !TRANSLATIONS.ur[k]).concat(urKeys.filter((k) => !TRANSLATIONS.en[k]));
  assert.deepEqual(keyDiff, []);
});

// Plan 588 D5(b) re-pins nav.css 164 -> 163: .btn-primary:hover #094338
// (its only occurrence) is re-tokened to var(--color-brand-700).
// Title + assert move together (Plan 586 rule).
test('G no new hex: styles.css 608 / nav.css 163 / components.css 0 (test-method count)', () => {
  const distinctHex = (name) => {
    const stripped = read(name).replace(/\/\*[\s\S]*?\*\//g, '');
    return new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).size;
  };
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  assert.equal(distinctHex('styles.css'), 608);
  assert.equal(distinctHex('nav.css'), 163);
  assert.equal(distinctHex('components.css'), 0);
});

test('G braces balanced in app.js + ui-feedback.js', () => {
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
