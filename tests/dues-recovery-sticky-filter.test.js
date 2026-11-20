// Dues Recovery sticky-filter fix (2026-11-20, CRITICAL — daily collection
// workflow): the filter card no longer sticks mid-viewport on phones, the
// Collect / Waada / History buttons render in full, the Draft template
// select shows its whole label, the three KPI boxes sit in one row, the
// priority pills scroll in one row, and the status badges stay on one line.
//
// The sticky root cause: the filter's sticky top (66px fallback +
// 132/140px) cleared a screen header that is position:static on phones,
// so the ~204px card sat at 206px down the viewport covering ~34% of the
// screen while scrolling. The emoji drop is the button fix: "💰 Collect"
// at 12px/600 is ~56–60px, wider than the ~57px text area of a
// 3-column button at 360px.
//
// CSS-string assertions only — no fixtures, no parity literal in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const styles = read('styles.css');
const ui = read('owner-ui.js');
const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;

test('the recovery filter row is static at every width, so it scrolls away', () => {
  assert.ok(styles.includes('.recovery-filter-row{position:static'), 'the desktop rule is static');
  assert.ok(!styles.includes('.recovery-filter-row{position:sticky'), 'no sticky filter rule remains');
  assert.ok(!styles.includes('.recovery-filter-row{grid-template-columns:1fr;top:'), 'the phone override keeps no top offset');
  assert.ok(styles.includes('.recovery-filter-row{grid-template-columns:1fr}'), 'the phone override keeps its single-column grid');
});

test('the three action labels are emoji-free and the 44px tap target is kept', () => {
  assert.equal(en.recovery_collect, 'Collect');
  assert.equal(en.recovery_waada, 'Waada');
  assert.equal(en.recovery_history, 'History');
  assert.equal(ur.recovery_collect, 'وصول کریں');
  assert.equal(ur.recovery_waada, 'وعدہ');
  assert.equal(ur.recovery_history, 'تاریخ');
  assert.ok(
    styles.includes('.recovery-customer-actions .secondary-button{min-height:44px;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'),
    'the buttons keep 44px, 0 8px padding and the ellipsis safety net',
  );
  // Only the three grid buttons lose their emoji — Send WhatsApp and
  // Add Phone are not in the grid and keep theirs.
  assert.ok(en.recovery_send_whatsapp.startsWith('💬'), 'Send WhatsApp keeps its emoji');
  assert.ok(en.recovery_add_phone.startsWith('📞'), 'Add Phone keeps its emoji');
});

test('the WhatsApp row stacks at phone widths and all four template labels survive', () => {
  assert.ok(styles.includes('.recovery-whatsapp-row{flex-direction:column;align-items:stretch}'), 'the row stacks below 620px');
  assert.ok(
    styles.includes('.recovery-whatsapp-row>label,.recovery-whatsapp-row>.recovery-whatsapp,.recovery-whatsapp-row>.recovery-no-contact,.recovery-whatsapp-row>.recovery-add-phone,.recovery-whatsapp-row>.recovery-phone-editor{flex:1 1 auto;width:100%}'),
    'every row child goes full-width when stacked',
  );
  for (const label of ['Friendly reminder', 'Urgent due', 'Disconnection notice', 'Payment confirmation']) {
    assert.ok(ui.includes(`'${label}'`), `the template label "${label}" is intact`);
  }
});

test('the summary bar stays three columns at phone widths', () => {
  assert.ok(!styles.includes('.recovery-summary-bar{grid-template-columns:1fr}'), 'no single-column override remains');
  assert.ok(styles.includes('.recovery-summary-bar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))'), 'the base three-column rule stands');
  assert.ok(styles.includes('.recovery-summary-bar{gap:6px}'), 'the phone gap tightens to 6px');
  assert.ok(styles.includes('.recovery-summary-stat{padding:8px 9px}'), 'the phone stat padding tightens');
});

test('the priority pills sit in one scrollable row', () => {
  assert.ok(
    styles.includes('.recovery-priority-pills{grid-column:1/-1;display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}'),
    'the pills do not wrap and scroll horizontally',
  );
  assert.ok(styles.includes('.recovery-priority-pills::-webkit-scrollbar{display:none}'), 'the pill scrollbar is hidden');
  assert.ok(styles.includes('.recovery-priority-pills button{min-height:36px;flex-shrink:0;white-space:nowrap;'), 'pill buttons never shrink or wrap');
});

test('the status badge nowrap is scoped to the recovery amount, never global', () => {
  assert.ok(styles.includes('.recovery-amount .ds-chip{white-space:nowrap}'), 'the scoped badge rule exists');
  const chipBody = styles.slice(styles.indexOf('.ds-chip {'), styles.indexOf('}', styles.indexOf('.ds-chip {')));
  assert.ok(!chipBody.includes('white-space'), 'the shared .ds-chip rule gains no nowrap');
  // The scoped selector must actually match the markup: the health-tag
  // chip is a child span inside the .recovery-amount div (owner-ui.js),
  // so a compound .recovery-amount.ds-chip selector would match nothing.
  const cardLine = ui.split('\n').find((line) => line.includes('recovery-customer-card'));
  assert.ok(cardLine.includes('recovery-amount'), 'the card renders the amount div');
  assert.ok(cardLine.includes('ds-chip'), 'the card renders the health-tag chip');
  assert.ok(
    cardLine.indexOf('recovery-amount') < cardLine.indexOf('ds-chip'),
    'the health-tag chip sits inside the amount div, so the descendant selector matches',
  );
});
