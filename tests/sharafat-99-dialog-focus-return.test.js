// Sharafat 99 — dialog focus return: closing a native dialog returns focus
// to the element that opened it.
//
// Parent decisions (prep header D1–D7) implemented here, NOT the spec as
// written:
// - The spec's problem is ALREADY fixed for the close / Cancel / Escape
//   paths: the universal dialog controller (nav-accessibility.js) records
//   document.activeElement on EVERY showModal() (patched prototype) and
//   restores focus on EVERY close — patched close(), the close-event
//   listener (covers Escape), and the trap release. Those paths get GUARDS
//   here, not re-implementations.
// - D1: Apply + reverse BOTH in scope. The ONLY gap is the re-render AFTER
//   the close: the confirm handler closes the dialog (the controller
//   restores focus to the opener) and THEN renderDetail() rebuilds the
//   profile view, destroying the opener button, so focus falls to <body>.
//   The fix is an inline re-focus of the FRESH button after renderDetail()
//   in the two handlers (D2).
// - D3: the reversed entry leaves the active offset list, so its trigger
//   button may be gone after the re-render — fall back to
//   #profileDepositOffsetBtn in the same section.
// - D4: inline fix + source-shape pins (Sharafat 92 pattern). No extraction,
//   no new module, no import edge — dist stays 23.
// - D5: the spec's second site is OUT OF SCOPE. D6: no shared dialog
//   helpers are created — the controller IS the shared mechanism. D7:
//   Escape / close-button paths are already done — guarded only.
// - T1 (the core trap): the fix MUST re-query the fresh button after
//   renderDetail() — a focus call on the detached node is a silent no-op.
// - plan540 rule: the focus call lives in the click handler AFTER
//   renderDetail(), never inside renderDetail() itself, and never inside
//   closeDepositOffsetDialog (T2).
//
// Source pins only (the Sharafat 92 pattern) — app.js cannot be imported
// (module-scope DOM work) and the handlers need a real DOM, so the
// controller paths are proven behaviourally through the dialog-controller
// mock harness and the handler lines are pinned by source shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { initUniversalDialogController } from '../nav-accessibility.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const navA11y = read('nav-accessibility.js');
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

const confirmBody = bodyOf(app, /\$\('#depositOffsetConfirmBtn'\)\?\.addEventListener\('click', \(\) => \{/);
assert.ok(confirmBody, 'deposit-offset confirm handler exists');
const reverseBody = bodyOf(app, /depositOffsetSection\.querySelectorAll\('\[data-profile-deposit-offset-reverse\]'\)\.forEach\(btn => \{/);
assert.ok(reverseBody, 'deposit-offset reverse handler exists');
const closeBody = bodyOf(app, /function closeDepositOffsetDialog\(\)/);
assert.ok(closeBody, 'closeDepositOffsetDialog exists');
const openBody = bodyOf(app, /function openDepositOffsetDialog\(customerId\)/);
assert.ok(openBody, 'openDepositOffsetDialog exists');

// Same mock harness shape as tests/dialog-controller.test.js: the REAL
// controller code, a mock DOM. Each test builds its own mock class, so the
// prototype patch never leaks between tests.
function createMockWorld(openerId) {
  const openDialogs = new Set();
  function MockHTMLDialogElement() {}
  MockHTMLDialogElement.prototype = {
    showModal() { this.open = true; openDialogs.add(this); },
    close() {
      this.open = false; openDialogs.delete(this);
      (this.listeners['close'] || []).forEach((cb) => cb());
    },
  };
  function createMockDialog(id) {
    const dialog = Object.create(MockHTMLDialogElement.prototype);
    dialog.id = id; dialog.open = false; dialog.listeners = {};
    dialog.addEventListener = function (evt, fn) { (this.listeners[evt] ||= []).push(fn); };
    dialog.querySelectorAll = function () { return []; };
    dialog.getAttribute = function () { return null; };
    return dialog;
  }
  const d = createMockDialog('depositOffsetModal');
  const mockDoc = {
    activeElement: { id: openerId, focus() { this.focused = true; } },
    querySelectorAll(sel) {
      if (sel === 'dialog') return [d];
      if (sel === 'dialog[open]') return [...openDialogs];
      return [];
    },
  };
  const mockWin = {
    HTMLDialogElement: MockHTMLDialogElement,
    addEventListener() {}, removeEventListener() {},
    history: { state: null, pushState(s) { this.state = s; }, back() { this.state = null; } },
  };
  const controller = initUniversalDialogController({ doc: mockDoc, win: mockWin });
  return { d, mockDoc, controller };
}

// ── R — repro port (11): the prep repro's checks, as tests. The 2
// spec-gap checks flip to PASS on the fix; the 9 guards stay PASS. ───────

test('R G1: patched showModal records the opener (doc.activeElement -> _openerElement)', () => {
  assert.match(navA11y, /const opener = doc\.activeElement \|\| null;\s*\n\s*this\._openerElement = opener;/);
});

test('R G2: patched close() focuses the recorded opener after origClose', () => {
  assert.match(navA11y, /if \(opener && typeof opener\.focus === 'function'\) \{\s*\n\s*try \{ opener\.focus\(\); \} catch \{\}/);
});

test('R G3: close-event listener focuses _openerElement (Escape path)', () => {
  assert.match(navA11y, /dialog\.addEventListener\('close', \(\) => \{\s*\n\s*if \(dialog\._releaseFocusTrap\)[\s\S]*?if \(dialog\._openerElement && typeof dialog\._openerElement\.focus === 'function'\)/);
});

test('R G4: trap release focuses previousActiveElement', () => {
  assert.match(navA11y, /if \(previousActiveElement && typeof previousActiveElement\.focus === 'function'\) \{\s*\n\s*try \{\s*\n\s*previousActiveElement\.focus\(\);/);
});

test('R G5: dialog-controller.test.js pins focus return to the opener', () => {
  assert.ok(read('tests/dialog-controller.test.js').includes("assert.equal(mockDoc.activeElement.focused, true, 'Focus was returned to opener button')"));
});

test('R G6: the deposit dialog is a static <dialog> in index.html, so the controller wires it at boot', () => {
  assert.match(html, /<dialog id="depositOffsetModal"/);
  assert.match(navA11y, /doc\.querySelectorAll\('dialog'\)\.forEach\(setupDialogInstance\)/);
});

test('R B1: behavioural — open records the opener, close returns focus to it', () => {
  const { d, mockDoc, controller } = createMockWorld('profileDepositOffsetBtn');
  d.showModal();
  assert.equal(d._openerElement, mockDoc.activeElement, 'showModal records the opener');
  d.close();
  assert.equal(mockDoc.activeElement.focused, true, 'close returns focus to the opener');
  controller.destroy();
});

test('R A1: confirm handler re-focuses #profileDepositOffsetBtn AFTER renderDetail()', () => {
  const focusLine = "document.querySelector('#profileDepositOffsetBtn')?.focus?.({ preventScroll: true })";
  const renderAt = confirmBody.indexOf('renderDetail();');
  const focusAt = confirmBody.indexOf(focusLine);
  assert.ok(renderAt >= 0, 'confirm handler calls renderDetail()');
  assert.ok(focusAt > renderAt, 'the focus call comes AFTER renderDetail() in the confirm handler');
});

test('R A2: reverse handler re-focuses its trigger AFTER renderDetail()', () => {
  const renderAt = reverseBody.indexOf('renderDetail();');
  const focusAt = reverseBody.indexOf('.focus?.({ preventScroll: true })');
  assert.ok(renderAt >= 0, 'reverse handler calls renderDetail()');
  assert.ok(focusAt > renderAt, 'the focus call comes AFTER renderDetail() in the reverse handler');
});

test('R C1: no new i18n keys needed (the fix adds no user-facing strings)', () => {
  assert.doesNotMatch(app, /depoff_.*focus/i);
});

// Plan 588 D5(b) re-pins nav.css 164 -> 163: .btn-primary:hover #094338
// (its only occurrence) is re-tokened to var(--color-brand-700).
// Title + assert move together (Plan 586 rule).
test('R C2: hex counts unchanged (styles 608 / nav 163 / components 0)', () => {
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

// ── F — focus-return rule (6). ───────────────────────────────────────────

test('F close-button path returns focus (behavioural mock)', () => {
  // The close × button wires to closeDepositOffsetDialog, which calls the
  // controller's patched dialog.close().
  assert.match(app, /\$\('#closeDepositOffsetModalBtn'\)\?\.addEventListener\('click', closeDepositOffsetDialog\)/);
  const { d, mockDoc, controller } = createMockWorld('profileDepositOffsetBtn');
  d.showModal();
  d.close();
  assert.equal(mockDoc.activeElement.focused, true, 'close returns focus to the opener');
  controller.destroy();
});

test('F Cancel-button path returns focus (behavioural mock)', () => {
  // Cancel wires to the same closeDepositOffsetDialog as the close ×.
  assert.match(app, /\$\('#depositOffsetCancelBtn'\)\?\.addEventListener\('click', closeDepositOffsetDialog\)/);
  const { d, mockDoc, controller } = createMockWorld('profileDepositOffsetBtn');
  d.showModal();
  d.close();
  assert.equal(mockDoc.activeElement.focused, true, 'Cancel (patched close) returns focus to the opener');
  controller.destroy();
});

test('F Escape path returns focus via the close-event listener (behavioural mock)', () => {
  // Escape fires the native close event, bypassing the patched close() —
  // the controller's close-event listener alone must restore focus.
  const { d, mockDoc, controller } = createMockWorld('profileDepositOffsetBtn');
  d.showModal();
  assert.equal(d._openerElement, mockDoc.activeElement, 'showModal records the opener');
  (d.listeners['close'] || []).forEach((cb) => cb());
  assert.equal(mockDoc.activeElement.focused, true, 'the close-event listener returns focus to the opener');
  controller.destroy();
});

test('F Apply path re-focuses the FRESH button (source shape: re-queried by id, never a stored node)', () => {
  // T1: the re-render destroys the opener, so the fix must re-query the
  // fresh button — a focus call on a stored/detached node is a silent no-op.
  assert.match(confirmBody, /document\.querySelector\('#profileDepositOffsetBtn'\)\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(confirmBody, /\bopener\s*\.\s*focus\s*\(/, 'the confirm handler never focuses a stored opener node');
  assert.doesNotMatch(confirmBody, /closeDepositOffsetDialog\(\);[\s\S]*\.focus\(\)[\s\S]*renderDetail\(\)/, 'no focus call runs before the re-render');
});

test('F reverse path re-focuses the fresh trigger, falling back to #profileDepositOffsetBtn (D3)', () => {
  // T5: the reversed entry leaves the active offset list, so its trigger
  // button may be gone after renderDetail() — the fallback is the rule.
  assert.match(reverseBody, /const freshReverseBtn = \[\.\.\.document\.querySelectorAll\('\[data-profile-deposit-offset-reverse\]'\)\]\.find\(b => b\.getAttribute\('data-profile-deposit-offset-reverse'\) === offsetId\);/);
  assert.match(reverseBody, /\(freshReverseBtn \?\? document\.querySelector\('#profileDepositOffsetBtn'\)\)\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  const renderAt = reverseBody.indexOf('renderDetail();');
  const focusAt = reverseBody.indexOf('(freshReverseBtn ??');
  assert.ok(focusAt > renderAt, 'the reverse focus call comes AFTER renderDetail()');
});

test('F NO double restore — closeDepositOffsetDialog contains no .focus( (the controller owns restore)', () => {
  // T2: a restore inside closeDepositOffsetDialog would run BEFORE
  // renderDetail() in the confirm flow, so the re-render would still
  // destroy the restored focus — and it would fight the trap release.
  assert.doesNotMatch(closeBody, /\.focus\(/);
});

// ── D — deposit-offset no-regress (4). ───────────────────────────────────

test('D open still fills customer/figures/max lines + sets the input to maxOffset', () => {
  assert.match(openBody, /depositOffsetCustomerLine/);
  assert.match(openBody, /depositOffsetFiguresLine/);
  assert.match(openBody, /depositOffsetMaxLine/);
  assert.match(openBody, /input\.value = quote\.maxOffset; input\.max = quote\.maxOffset;/);
  assert.match(openBody, /refreshDepositOffsetPreview\(\);/);
  assert.match(openBody, /if \(dialog\.showModal\) dialog\.showModal\(\); else dialog\.hidden = false;/);
});

test('D close still clears depositOffsetDialogCustomerId', () => {
  assert.match(closeBody, /depositOffsetDialogCustomerId = null;/);
  assert.match(closeBody, /if \(dialog\.open\) dialog\.close\(\); else dialog\.hidden = true;/);
});

test('D confirm still applies the offset, persists, re-renders and toasts', () => {
  assert.match(confirmBody, /applyActiveDepositOffset\(customer, pendingBalance, \{ date: getTodayDateString\(\), amount, billBalances \}\)/);
  assert.match(confirmBody, /persistState\(state, localStorage\)/);
  assert.match(confirmBody, /closeDepositOffsetDialog\(\);/);
  assert.match(confirmBody, /renderDetail\(\);/);
  assert.match(confirmBody, /renderDashboard\(\);/);
  assert.match(confirmBody, /toast\(t\('depoff_done_toast'/);
});

test('D reverse still reverses the offset, re-renders and toasts', () => {
  assert.match(reverseBody, /reverseActiveDepositOffset\(customer, offsetId, \{ date: getTodayDateString\(\) \}\)/);
  assert.match(reverseBody, /persistState\(state, localStorage\)/);
  assert.match(reverseBody, /renderDetail\(\);/);
  assert.match(reverseBody, /renderDashboard\(\);/);
  assert.match(reverseBody, /toast\(t\('depoff_reversed_toast'\)\)/);
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
  assert.equal(enKeys.length, 5222);
  assert.equal(urKeys.length, 5222);
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

test('G braces balanced in app.js; nav-accessibility.js untouched (no Sharafat 99 marker)', () => {
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
  assert.doesNotMatch(navA11y, /Sharafat 99/, 'the controller must not be touched by this item');
});
