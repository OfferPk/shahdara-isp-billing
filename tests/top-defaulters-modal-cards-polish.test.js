// Top Defaulters modal cards polish (2026-11-22, user spec): the modal
// title's stray left border, the truncated 'Final ...' action button,
// the stacked badge rows, the double '#' prefix, and the last card
// sliding under the sticky Actions bar — all at 360px. Pins the fixed
// state. Synthetic fixture only — no real customer names, no realistic
// phone numbers, no figures from any screenshot.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
const controller = fs.readFileSync(path.resolve('./dashboard-top-defaulters.js'), 'utf-8');

// CSS rule body for the first rule whose selector matches exactly.
function ruleBody(selector) {
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
  const m = re.exec(stylesCss);
  return m ? m[1] : null;
}

// 360px geometry (measured from the rules): dialog width
// calc(100vw - 16px) = 344, padding 14px each side -> 316; card
// padding 10px 12px -> inner 292. Action row: 3 flex:1 buttons,
// gap 6px -> each column (292 - 12) / 3 = ~93px. Label width estimate:
// emoji ~16px + bold 0.8rem (~12.8px) text ~7.2px/char + button
// padding 6px 8px (16px horizontal).
const ACTION_COL = Math.floor((316 - 24 - 2 * 6) / 3);
const labelWidth = (label) => 16 + (label.replace(/^[^\s]+\s/, '').length * 7.2) + 16;

test('cards polish: modal title h2 carries a border reset, so no left border can hug it', () => {
  const body = ruleBody('.top-defaulters-modal .billing-modal-header h2');
  assert.ok(body, 'no .top-defaulters-modal .billing-modal-header h2 rule');
  assert.ok(/border:\s*0(!important)?/.test(body), `h2 must reset border to 0 — got: ${body}`);
  assert.ok(/border-inline-start:\s*0(!important)?/.test(body), 'h2 must reset border-inline-start to 0');
  assert.ok(/padding-inline-start:\s*0(!important)?/.test(body), 'h2 must reset padding-inline-start to 0');
  assert.ok(!/border-left/.test(body), 'h2 must not carry a border-left of its own');
});

test('cards polish: Final button label is short and fits the 360px action column', () => {
  const m = /defaulter-reminder-final"[^>]*>([^<]*)</.exec(controller);
  assert.ok(m, 'Final button not found in the card template');
  const label = m[1].trim();
  assert.equal(label, '🟠 Final', `Final button label must be '🟠 Final' — got: ${JSON.stringify(label)}`);
  const w = labelWidth(label);
  assert.ok(w <= ACTION_COL, `label est. ${Math.round(w)}px must fit the ${ACTION_COL}px column`);
});

test('cards polish: Final button keeps its title and the disconnection draft', () => {
  assert.ok(controller.includes('title="Open a final-notice WhatsApp draft"'),
    'Final button must keep its final-notice title');
  assert.ok(controller.includes("openReminderDraft(finalBtn.dataset.custId, 'disconnection')"),
    'Final button must still open the disconnection draft');
  // The SISP-38 escalation badge label 'Final Notice' is a different
  // element and is untouched by the button-label shortening.
  assert.ok(controller.includes('escalationBadgeLabel(acc.escalationStage)'),
    'escalation badge label wiring must survive');
});

test('cards polish: all status badges live in one wrapping container', () => {
  assert.ok(controller.includes('class="defaulter-card-badges"'),
    'card must render a single .defaulter-card-badges container');
  assert.ok(!controller.includes('<div class="defaulter-waada-badge">'),
    'separate .defaulter-waada-badge row divs must be gone');
  assert.ok(!controller.includes('<div class="defaulter-contact-badge">'),
    'separate .defaulter-contact-badge row div must be gone');
  const open = controller.indexOf('class="defaulter-card-badges"');
  const actions = controller.indexOf('defaulter-card-actions', open);
  const inside = controller.slice(open, actions);
  for (const badge of ['${riskBadge}', '${waadaBadge}', '${escalationBadge}',
    '${waadaScoreBadge}', '${vacationBadge}', '${shieldBadge}', '${contactBadge}']) {
    assert.ok(inside.includes(badge), `${badge} must sit inside .defaulter-card-badges`);
  }
  // Months tags + last payment stay in the meta row, not the badge row.
  const metaStart = controller.indexOf('class="defaulter-card-meta"');
  const meta = controller.slice(metaStart, open);
  assert.ok(meta.includes('${monthsList}') && meta.includes('${lastPayText}'),
    'months tags + last payment must stay in the meta row');
});

test('cards polish: badges container is a wrapping flex row with a 6px gap', () => {
  const body = ruleBody('.defaulter-card-badges');
  assert.ok(body, 'no .defaulter-card-badges rule');
  assert.ok(/display:\s*flex/.test(body), 'badges container must be flex');
  assert.ok(/flex-wrap:\s*wrap/.test(body), 'badges container must wrap');
  assert.ok(/align-items:\s*center/.test(body), 'badges container must center items');
  assert.ok(/gap:\s*6px/.test(body), 'badges container must use a 6px gap');
});

test('cards polish: badges use the compact metrics (11px / 2px 8px / radius-pill)', () => {
  // The metrics live on the CHILD selector rule, not the container rule
  // (the container rule only owns layout) — assert them there.
  const child = /\.defaulter-card-badges\s+\.badge,\s*\.defaulter-card-badges\s+\.wada-badge,\s*\.defaulter-card-badges\s+\.escalation-badge\s*\{([^}]*)\}/.exec(stylesCss);
  assert.ok(child, 'no .defaulter-card-badges child rule for .badge / .wada-badge / .escalation-badge');
  const body = child[1];
  assert.ok(/font-size:\s*(11px|var\(--text-table-head\))/.test(body), `badges must be 11px — got: ${body}`);
  assert.ok(/padding:\s*2px 8px/.test(body), 'badges must use padding 2px 8px');
  assert.ok(/border-radius:\s*(999px|var\(--radius-pill\))/.test(body), 'badges must use the pill radius');
});

test('cards polish: Critical risk badge has a styled class (prep-found latent fix)', () => {
  assert.ok(!controller.includes('class="badge badge-danger"'),
    'card must not use .badge-danger — no standalone .badge-danger rule exists');
  assert.ok(controller.includes('class="badge badge-critical"'),
    'Critical risk badge must use .badge-critical');
  const critical = ruleBody('.badge-critical');
  assert.ok(critical && /background:\s*#fee2e2/.test(critical) && /color:\s*#991b1b/.test(critical),
    '.badge-critical rule must carry the #fee2e2 / #991b1b tint');
});

test('cards polish: rank is a "1." label and the ID is a separate pill (no double #)', () => {
  assert.ok(!/#\$\{acc\.rank\}<\/span>\s*<strong>#\$\{acc\.customerNumber\}/.test(controller),
    'template must not render "#rank #ID" side by side');
  assert.ok(controller.includes('defaulter-card-rank">${acc.rank}.'),
    'rank must render as a "1." label');
  assert.ok(controller.includes('defaulter-card-id-pill">#${acc.customerNumber}'),
    'customer ID must render as a separate "#33" pill');
});

test('cards polish: rank circle and ID pill rules use tokens', () => {
  const rank = ruleBody('.defaulter-card-rank');
  assert.ok(rank, 'no .defaulter-card-rank rule');
  assert.ok(/display:\s*inline-flex/.test(rank), 'rank must be inline-flex');
  assert.ok(/min-width:\s*18px/.test(rank) && /height:\s*18px/.test(rank),
    'rank must be an 18px circle (pill for 2+ digit ranks)');
  assert.ok(/border-radius:\s*var\(--radius-pill\)/.test(rank), 'rank must use the pill radius');
  assert.ok(/background:\s*var\(--bg-soft,\s*#f1f5f3\)/.test(rank),
    'rank background must be var(--bg-soft, #f1f5f3) — the exact Recovery Pipeline token value');
  assert.ok(/font-size:\s*var\(--text-table-head\)/.test(rank), 'rank must be 11px');
  const pill = ruleBody('.defaulter-card-id-pill');
  assert.ok(pill, 'no .defaulter-card-id-pill rule');
  assert.ok(/padding:\s*2px 8px/.test(pill), 'ID pill must use padding 2px 8px');
  assert.ok(/border-radius:\s*var\(--radius-pill\)/.test(pill), 'ID pill must use the pill radius');
  assert.ok(/background:\s*var\(--badge-bg,\s*#f1f5f9\)/.test(pill),
    'ID pill background must be var(--badge-bg, #f1f5f9), as in .unpaid-month-tag');
});

test('cards polish: list has bottom padding clearing the measured sticky footer', () => {
  // Spec floor pb-4 = 16px; measured sticky footer at 360px is ~56px
  // (44px summary bar + 8px + 4px footer padding). 16px does not clear
  // it, so the padding is the measured ~56px (deviation disclosed in
  // the PR body).
  const body = ruleBody('.defaulter-list-scroll');
  assert.ok(body, 'no .defaulter-list-scroll rule');
  const pb = Number((/padding-bottom:\s*(\d+)px/.exec(body) || [])[1] || 0);
  assert.ok(pb >= 56, `list padding-bottom must be >= 56px to clear the sticky footer — got ${pb}px`);
});

test('cards polish: the list still does not own its own scroll', () => {
  const body = ruleBody('.defaulter-list-scroll');
  assert.ok(body, 'no .defaulter-list-scroll rule');
  assert.ok(!/max-height/.test(body), 'list must not cap its own height (the dialog owns the scroll)');
  assert.ok(!/overflow-y/.test(body), 'list must not own its own scroll');
});

test('cards polish: the new rules add no new hex (fallbacks only)', () => {
  const bodies = [
    ruleBody('.top-defaulters-modal .billing-modal-header h2'),
    ruleBody('.defaulter-card-rank'),
    ruleBody('.defaulter-card-id-pill'),
    ruleBody('.defaulter-card-badges'),
    ruleBody('.defaulter-list-scroll'),
  ].filter(Boolean).join(' ');
  const hexes = [...new Set((bodies.match(/#[0-9a-fA-F]{3,6}\b/g) || []).map((h) => h.toLowerCase()))];
  for (const h of hexes) {
    assert.ok(['#f1f5f3', '#f1f5f9', '#64748b'].includes(h),
      `new rules must not introduce hex ${h} — only pre-existing fallbacks (#f1f5f3 / #f1f5f9 / #64748b)`);
  }
  // All three fallbacks already occur in styles.css outside the new rules.
  assert.ok((stylesCss.match(/#f1f5f3/g) || []).length >= 2, '#f1f5f3 must pre-exist in styles.css');
  assert.ok((stylesCss.match(/#f1f5f9/g) || []).length >= 2, '#f1f5f9 must pre-exist in styles.css');
  assert.ok((stylesCss.match(/#64748b/g) || []).length >= 2, '#64748b must pre-exist in styles.css');
});
