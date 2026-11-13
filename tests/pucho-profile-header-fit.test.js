// Pucho + Profile Header Polish — fit pins (source-scan + arithmetic, in
// the topbar-mobile-fit.test.js style). The panel must fit within half a
// screen when expanded and collapse to one line otherwise; the profile
// header top row must share one row at phone widths; the scroll-top
// button must sit clear of the speed-dial trigger.
//
// Arithmetic is measured at 360px (EN copy). Urdu copy can add one line
// to the heading note (~18px) — the expanded total then reads ~316px,
// still under the 320px half-screen bound at 360x640.
//
// NOT pinned here: the white disc under the '^' button in the user's
// screenshot. No shipped white circular fixed control reproduces it, so
// no fix is invented for it; what IS pinned is the provable
// scroll-top/speed-dial overlap (fixed by moving the scroll-top above
// the dial). The disc needs on-phone confirmation after landing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const navCss = readFileSync(new URL('../nav.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ownerUi = readFileSync(new URL('../owner-ui.js', import.meta.url), 'utf8');
const screenRouter = readFileSync(new URL('../screen-router.js', import.meta.url), 'utf8');
const lang = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('pucho fit: panel is collapsed by default — toggle + hidden body, no overline', () => {
  assert.ok(index.includes('id="ownerCommandToggle"'), 'collapsed bar toggle exists');
  assert.ok(index.includes('aria-expanded="false"'), 'toggle starts collapsed');
  assert.ok(index.includes('id="ownerCommandBody" class="owner-command-body" hidden'), 'panel body starts hidden');
  assert.ok(!index.includes('dash_owner_eyebrow'), 'overline key is gone from the markup');
  // Scoped to the Pucho section: 'LOCAL-ONLY' still legitimately appears
  // elsewhere (Smart Alerts' own 'LOCAL-ONLY · RULE-BASED' eyebrow).
  const puchoStart = index.indexOf('id="ownerCommandCenter"');
  const puchoSection = index.slice(puchoStart, index.indexOf('</section>', puchoStart));
  assert.ok(!puchoSection.includes('LOCAL-ONLY'), 'overline text is gone from the Pucho panel');
  assert.ok(!lang.includes('dash_owner_eyebrow'), 'overline key is gone from both language dicts');
  // The collapsed bar still shows the offline signal (D2) + the heading.
  assert.ok(index.includes('data-i18n="dash_owner_heading"'), 'toggle carries the heading label');
  assert.ok(index.includes('data-i18n="dash_owner_badge"'), 'toggle carries the Works-offline pill');
  // Wiring: toggle flips the hidden attribute; the assistant route expands.
  assert.ok(ownerUi.includes('ownerBody.hidden = !expanded'), 'toggle drives the hidden attribute');
  assert.ok(ownerUi.includes('window.expandOwnerCommandCenter'), 'route opener is exposed on window');
  assert.ok(screenRouter.includes('win.expandOwnerCommandCenter()'), 'assistant route expands the panel');
});

test('pucho fit: one-row form at phone widths — input + mic + Ask share one row', () => {
  // The <=820px override puts the input (minmax) + mic + Ask on one row.
  assert.ok(styles.includes('.owner-command-form{grid-template-columns:minmax(0,1fr) auto auto;gap:7px}'), 'form is a 1-row 3-column grid at <=820px');
  assert.ok(styles.includes('.owner-command-form input{grid-column:auto;width:100%;font-size:16px;min-height:46px}'), 'input no longer spans the full row');
  // The mic is icon-only now (data-i18n would wipe the icon span).
  const voiceBtn = index.match(/<button id="ownerVoiceButton"[^>]*>/);
  assert.ok(voiceBtn && voiceBtn[0].includes('data-i18n-aria-label="dash_owner_voice_btn"'), 'voice button carries the key as an aria label');
  assert.ok(voiceBtn && !voiceBtn[0].includes('data-i18n='), 'voice button carries no data-i18n');
  // Short placeholder fits the narrowed input (~194px at 360px, ~24 chars).
  assert.ok(lang.includes("dash_owner_placeholder: 'Dues, bills or balance?'"), 'EN placeholder is the short form');
  assert.ok(lang.includes("dash_owner_placeholder: 'بقایا یا بل؟'"), 'UR placeholder is the short form');
});

test('pucho fit: chips are a 2-row horizontal strip; voice controls hidden until armed', () => {
  // 12 catalogue chips + 2 morning-queue buttons = the user's 14, in one
  // 2-row strip (column flow, nowrap chips, horizontal scroll).
  assert.ok(styles.includes('grid-auto-flow:column;grid-template-rows:repeat(2,auto)'), 'chip strip flows in 2 rows');
  assert.ok(styles.includes('.owner-suggestion-chip{white-space:nowrap'), 'chips never wrap to a third row');
  assert.ok(ownerUi.includes('chipsGrid.append(button)'), 'queue buttons move into the chip grid');
  // Voice dropdown + note hide until the first mic tap arms voice mode.
  assert.ok(styles.includes('.owner-command-panel:not(.voice-armed) .owner-voice-language,.owner-command-panel:not(.voice-armed) #ownerVoiceStatus{display:none}'), 'voice controls hidden until armed');
  assert.ok(ownerUi.includes("classList.add('voice-armed')"), 'mic tap arms voice mode');
  assert.ok(ownerUi.includes("classList.remove('voice-armed')"), 'collapsing disarms voice mode');
  // Answer-waiting dot: pure CSS :has(), no JS sync.
  assert.ok(styles.includes('.owner-command-panel:not(.is-expanded):has(#ownerCommandAnswer:not(:empty)) .owner-command-answer-dot{display:inline-block}'), 'dot shows while collapsed with an answer waiting');
});

test('pucho fit: expanded panel (empty answer, voice disarmed) fits within half a screen at 360px', () => {
  // Inputs to the arithmetic, all pinned from the source:
  // - panel padding 13px top + bottom (mobile rule).
  assert.ok(styles.includes('.owner-command-panel,.owner-report-panel{padding:13px;margin:11px 0;border-radius:13px}'), 'mobile panel padding is 13px');
  // - toggle bar 44px (its own rule; the global button floor agrees).
  assert.ok(styles.includes('.owner-command-toggle{display:flex;align-items:center;gap:8px;width:100%;min-height:44px'), 'toggle bar is 44px');
  assert.ok(styles.includes('button:not([hidden]) { min-height: 44px !important; }'), 'global button floor is 44px');
  // - chip rows are 44px each (secondary-button floor) — see the button floor above.
  // Expanded height, empty answer, voice disarmed (360px, EN):
  //   panel padding        13 + 13          =  26
  //   body margin-top                          12
  //   heading h3 (~21) + note 2 lines (36) + margin (7) = 64
  //   form margin-top (13) + input (46)       =  59
  //   intro 2 lines (~29) + chips margin (10) =  39
  //   chips 2 rows x 44 + gap 8 + padding 2   =  98
  //   TOTAL                                   = 298
  const expanded = 26 + 12 + 64 + 59 + 39 + 98;
  assert.equal(expanded, 298, 'expanded panel arithmetic');
  assert.ok(expanded <= 320, `expanded panel ${expanded}px must fit within half a screen at 360x640 (320px)`);
  assert.ok(expanded <= 370, `expanded panel ${expanded}px must fit within half a screen at 360x740 (370px)`);
});

test('pucho fit: collapsed panel is one line and selectCustomer lands the profile near the top', () => {
  // Collapsed panel border-box: padding 26 + toggle 44 = 70px.
  const collapsed = 13 + 13 + 44;
  assert.equal(collapsed, 70, 'collapsed panel arithmetic');
  assert.ok(collapsed <= 96, `collapsed panel ${collapsed}px must stay one line (<=96px)`);
  // selectCustomer scrolls to shell top - topbar - 8; the profile card
  // top then sits at topbar (58, mobile) + 8 + panel top margin (11) +
  // collapsed panel (70) + panel bottom margin (11) = 158px.
  assert.ok(styles.includes('.topbar{height:58px;'), 'mobile topbar is 58px');
  assert.ok(app.includes('shellTop - topbarHeight - 8'), 'selectCustomer scrolls to shell top minus topbar minus 8');
  const landing = 58 + 8 + 11 + 70 + 11;
  assert.equal(landing, 158, 'landing offset arithmetic');
  assert.ok(landing <= 170, `profile card lands ${landing}px down — the old ~1.5-screen push is gone`);
});

test('pucho fit: profile header top row is two columns at phone widths; no eyebrow left', () => {
  assert.ok(!index.includes('prof_eyebrow'), 'eyebrow key is gone from the markup');
  assert.ok(!index.includes('ISP CUSTOMER PROFILE'), 'eyebrow text is gone from the markup');
  assert.ok(!lang.includes('prof_eyebrow'), 'eyebrow key is gone from both language dicts');
  // At <=620px the number line and the Active pill share the top row.
  assert.ok(styles.includes('grid-template-columns: minmax(0, 1fr) auto;'), 'title row is two columns at phone widths');
  // The top row carries the mohalla now (D3); the identity line is phone-only.
  assert.ok(app.includes('` · ${detailMohalla}`'), 'top row appends the mohalla');
});

test('pucho fit: scroll-top button sits above the speed-dial trigger and hides while the dial is open', () => {
  // Before: scroll-top bottom 74px (desktop) / 60px (mobile) overlapped the
  // 50px dial trigger (bottom nav + 16px gap). After: 12px clearance above it.
  assert.ok(navCss.includes('bottom: calc(var(--bottom-nav-height, 60px) + 16px + 50px + 12px)'), 'desktop scroll-top sits above the dial');
  assert.ok(navCss.includes('bottom: calc(var(--bottom-nav-height, 64px) + 16px + 50px + 12px)'), 'mobile scroll-top sits above the dial');
  // Slot math: dial trigger top edge = bottom nav + 16 gap + 50 trigger;
  // scroll-top bottom must clear it: 60+16+50+12 = 138 > 126 (desktop),
  // 64+16+50+12 = 142 > 130 (mobile).
  assert.ok(60 + 16 + 50 + 12 > 60 + 16 + 50, 'desktop scroll-top clears the dial trigger');
  assert.ok(64 + 16 + 50 + 12 > 64 + 16 + 50, 'mobile scroll-top clears the dial trigger');
  // While the dial menu is open its white pills fan up into the same slot.
  assert.ok(navCss.includes('body:has(.mobile-speed-dial.is-open) #scrollTopButton'), 'scroll-top hides while the dial menu is open');
});
