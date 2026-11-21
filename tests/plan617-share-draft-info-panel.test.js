// Plan 617 — The share draft lives on the Info panel, not hidden in Billing.
//
// The profile opens on Info (selectedProfileTab = 'info', Plan 491),
// but the receipt share-draft host #stxProfileShareDraft (Polish #11,
// filled by renderProfileShareDraft after a profile-form payment) was
// claimed by the billing group in mountCustomerProfileContent, so the
// boot mount appended it into #profilePanelBilling — hidden until the
// operator switched tabs. The payment is recorded on Info (the form
// lives inside .customer-meta), so the draft now joins the info group
// FIRST, visible the moment the profile opens. The host is hidden when
// empty, so an empty host at the top costs nothing visually.
//
// THE SPEC IS WRONG ABOUT THE ANCHOR: app.js:1683 is inside cross-payer
// form markup (Plan 379/383), not the mount. The mount is
// mountCustomerProfileContent at app.js:1788-1806; the host div is
// static HTML in index.html:6499 inside hidden #profileContentMounts.
//
// WHAT CANNOT CHANGE (the move is panel-only): the host element, the
// fill function renderProfileShareDraft, the click delegation
// ([data-rsd-send]/[data-rsd-dismiss] -> executeReceiptWhatsAppShare),
// and the tax line — salesTaxCents flows buildPaymentReceipt ->
// profileShareDraftReceiptInput -> receiptShareDraftFor (match check)
// and the visible tax line is inside the share text built by
// resolveReceiptWhatsAppAction (profile-ui.js:415-417, label in both
// dicts). All of it is panel-independent.
//
// SCOPE (by design, not an oversight): the profile draft is currently
// UNSTYLED — all .rsd-share-draft* rules are scoped #quickCollectModal,
// so the same markup renders styled inside Quick Collect and unstyled
// in the profile. A styling pass is a separate item, not this move.
// The dead '#historyContainer' billing selector stays too (it lives
// outside #profileContentMounts, so the mount's querySelector finds
// nothing — a no-op, separate cleanup).
//
// This file asserts NO key-count total (mount move, the count stays).
// It must contain NEITHER the current nor the previous count's bare
// digits, and no split-literal form of them either — the plan591 G5a
// sweep and the pnl count are the enforcement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const app = readFileSync(join(root, 'app.js'), 'utf8');
const index = readFileSync(join(root, 'index.html'), 'utf8');
const profileUi = readFileSync(join(root, 'profile-ui.js'), 'utf8');
const receiptShareDraft = readFileSync(join(root, 'receipt-share-draft.js'), 'utf8');

// Parse the mount groups map out of mountCustomerProfileContent, the
// same way tests/profile-mount-hotfix.test.js does.
function mountGroups(src) {
  const fnStart = src.indexOf('function mountCustomerProfileContent()');
  assert.ok(fnStart >= 0, 'mountCustomerProfileContent exists');
  const block = src.slice(fnStart, src.indexOf('};', fnStart) + 2);
  const groups = {};
  for (const m of block.matchAll(/(\w+):\[([^\]]*)\]/g)) {
    groups[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  return groups;
}

const groups = mountGroups(app);
const billing = groups.billing || [];
const info = groups.info || [];

test('C1: the share-draft host is NOT mounted into the Billing panel', () => {
  assert.ok(!billing.includes('#stxProfileShareDraft'),
    `billing group is [${billing.join(', ')}], expected no #stxProfileShareDraft after the move`);
});

test('C2: the share-draft host is FIRST in the Info panel mount group', () => {
  assert.ok(info.includes('#stxProfileShareDraft'),
    `info group is [${info.join(', ')}], expected #stxProfileShareDraft after the move`);
  assert.equal(info[0], '#stxProfileShareDraft',
    `info group is [${info.join(', ')}], expected the draft first so it sits above the profile view`);
});

test('C3: the draft is visible on first paint — the profile opens on Info, and the draft lives in Info', () => {
  assert.ok(app.includes("let selectedProfileTab = 'info';"),
    'the profile must open on Info (Plan 491)');
  assert.ok(info.includes('#stxProfileShareDraft'),
    'the draft must be in the Info group to show on first paint');
  assert.ok(!billing.includes('#stxProfileShareDraft'),
    'the draft must not still be in the Billing group');
});

test('S1: the share-draft host still exists in index.html, inside #profileContentMounts', () => {
  assert.ok(index.includes('id="stxProfileShareDraft"'), 'the host div exists');
  const mountsStart = index.indexOf('id="profileContentMounts"');
  const hostAt = index.indexOf('id="stxProfileShareDraft"');
  assert.ok(mountsStart >= 0 && hostAt > mountsStart, 'the host sits inside the mounts container');
  assert.ok(index.includes('Polish #11: profile receipt share-draft host'),
    'the Polish #11 host comment is still there');
});

test('S2: the same handler — the fill function still delegates send/dismiss and shares via WhatsApp', () => {
  const start = app.indexOf('function renderProfileShareDraft()');
  assert.ok(start >= 0, 'renderProfileShareDraft exists');
  const body = app.slice(start, app.indexOf('\nfunction ', start + 10));
  assert.ok(body.includes('[data-rsd-send]'), 'send delegation still wired');
  assert.ok(body.includes('[data-rsd-dismiss]'), 'dismiss delegation still wired');
  assert.ok(body.includes('executeReceiptWhatsAppShare'), 'send still calls the WhatsApp share');
  assert.ok(body.includes("const host = $('#stxProfileShareDraft');"), 'the fill still targets the same host id');
});

test('S3: the same tax line — salesTaxCents still flows into the draft and the share text', () => {
  const inputStart = app.indexOf('function profileShareDraftReceiptInput');
  assert.ok(inputStart >= 0, 'profileShareDraftReceiptInput exists');
  const inputBody = app.slice(inputStart, app.indexOf('\nfunction renderProfileShareDraft', inputStart));
  assert.ok(inputBody.includes('salesTaxCents'), 'the draft input still carries salesTaxCents');
  assert.ok(receiptShareDraft.includes('salesTaxCents: receiptShareDraftSalesTaxCents(receipt)'),
    'receiptShareDraftFor still carries the tax figure for the match check');
  assert.ok(profileUi.includes("salesTax: 'Sales tax (19.5%)'"),
    'the share-text tax label exists in EN');
  assert.ok(profileUi.includes("salesTax: 'سیلز ٹیکس (19.5%)'"),
    'the share-text tax label exists in UR');
});

test('S4: Billing keeps its other children — only the draft leaves', () => {
  for (const sel of ['#customerReceiptSummary', '.ledger-heading', '.history-retention-note', '#customerEmptyNote']) {
    assert.ok(billing.includes(sel), `billing group still claims ${sel}`);
  }
});

test('S5: Info keeps its other children — the profile view and uptime stay', () => {
  assert.ok(info.includes('.customer-meta'), 'info group still claims .customer-meta');
  assert.ok(info.includes('.uptime-section'), 'info group still claims .uptime-section');
});

test('B1: the draft content is identical in EN and UR — rendering is language-independent', () => {
  // receiptShareDraftHtml builds the same markup in either language
  // (no t() call — the only "t(" hits are the local text() helper).
  const htmlStart = receiptShareDraft.indexOf('export function receiptShareDraftHtml');
  assert.ok(htmlStart >= 0, 'receiptShareDraftHtml exists');
  const htmlBody = receiptShareDraft.slice(htmlStart, receiptShareDraft.indexOf('\n}\n', htmlStart));
  assert.ok(!/[^a-zA-Z]t\('[a-z_]+'\)/.test(htmlBody), 'the draft HTML builder calls no i18n key');
  assert.ok(profileUi.includes("salesTax: 'Sales tax (19.5%)'") && profileUi.includes("salesTax: 'سیلز ٹیکس (19.5%)'"),
    'the tax line label exists in both dicts');
});
