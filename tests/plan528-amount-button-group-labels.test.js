// Plan 528 — Amount-button rows get group labels: the form step
// stacks amount rows — the merged chip row (Full dues, Half dues,
// Package, fixed notes) and the loose-change tender chips below
// them. Each row carries a small group label above it ("Quick
// amounts", "Round-note tender"), reusing the existing small-label
// style. Layout only: no button is added, removed, reworded, or
// re-figured, and no tap changes what it fills. QC Modal Overhaul
// 2: the Plan 489 dues row is deleted (its buttons ARE the chip row
// now), so its 'Pay in full / half' label and its label helper go
// with it — one merged row, one static label.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addPaymentDuesFigures,
} from '../add-payment-dues-buttons.js';
import { looseChangeChipsMarkup } from '../loose-change-credit.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
const testSrc = readFileSync(new URL(import.meta.url), 'utf8');

const CHIPS_LABEL = 'Quick amounts';
const LOOSE_LABEL = 'Round-note tender';

test('acceptance: the loose-change row carries its group label in the page, directly above its host', () => {
  const hostAt = pageSrc.indexOf('id="quickCollectLooseChangeChips"');
  assert.ok(hostAt > -1, 'the loose-change chips host must exist');
  const labelAt = pageSrc.indexOf(LOOSE_LABEL);
  assert.ok(labelAt > -1, 'the round-note tender label must exist in the page');
  assert.ok(labelAt < hostAt, 'the label must sit above the loose-change row');
  const labelOpen = pageSrc.lastIndexOf('<p', labelAt);
  const between = pageSrc.slice(labelOpen, hostAt);
  assert.ok(!between.includes('</div>'), 'nothing may sit between the label and its row');
  assert.ok(between.includes('qc-amount-group-label'), 'the label uses the shared group-label class');
  assert.ok(between.includes('qc-loose-change-label'), 'the label carries its own hook for the hide-with-row toggle');
  // The host still sits before the cash change box (Plan 432 pin).
  const cashAt = pageSrc.indexOf('id="quickCollectCashChangeBox"');
  assert.ok(hostAt < cashAt, 'the loose-change row still sits before the cash change box');
});

test('acceptance: the merged chip row carries one static group label in the page, directly above it', () => {
  // QC Modal Overhaul 2: the Plan 489 dues row is deleted (its
  // buttons ARE the chip row now), so its 'Pay in full / half'
  // label goes with it — one merged row, one static 'Quick amounts'
  // label above it. The label helper (ensureAmountGroupLabel) is
  // deleted with the row it labelled; the static label needs no
  // helper and can never stack twice.
  assert.ok(!wiringSrc.includes('function renderAddPaymentDuesButtons()'), 'the dues row builder must be gone');
  assert.ok(!wiringSrc.includes('function ensureAmountGroupLabel('), 'the label helper must be gone');
  assert.ok(!pageSrc.includes('Pay in full / half'), 'the dues label must be gone with its row');
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  assert.ok(rowAt > 0, 'the merged chip row must exist');
  const labelAt = pageSrc.indexOf(CHIPS_LABEL);
  assert.ok(labelAt > -1, 'the Quick amounts label must exist in the page');
  assert.ok(labelAt < rowAt, 'the label must sit above the merged row');
  const labelOpen = pageSrc.lastIndexOf('<p', labelAt);
  const between = pageSrc.slice(labelOpen, rowAt);
  assert.ok(!between.includes('</div>'), 'nothing may sit between the label and its row');
  assert.ok(between.includes('qc-amount-group-label'), 'the label uses the shared group-label class');
});

test('acceptance: the loose-change label hides with its row and returns with it', () => {
  const start = wiringSrc.indexOf('function renderLooseChangeChips()');
  assert.notEqual(start, -1, 'renderLooseChangeChips must exist');
  const block = wiringSrc.slice(start, start + 1200);
  assert.ok(block.includes("looseChangeBox.hidden = markup === '';"), 'the row still hides when empty');
  assert.ok(block.includes('looseChangeLabel.hidden = markup === '), 'the label hides with the row');
  // The label is found by its class hook, never a new element id.
  assert.ok(wiringSrc.includes("document.querySelector('.qc-loose-change-label')"), 'the label is found by class');
  assert.ok(!wiringSrc.includes('quickCollectLooseChangeLabel'), 'no new element id is introduced');
});

test('wiring: no button is added, removed, or reworded by the labels', () => {
  // The merged chip row in the page — six chips (QC Modal Overhaul
  // 2: Full dues, Half dues, Package + 2,000 / 1,000 / 500; Current
  // Month and 1,500 dropped, Package back per addendum A2).
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  assert.ok(rowAt > 0, 'the quick-amount row must exist');
  const row = pageSrc.slice(rowAt, pageSrc.indexOf('</div>', rowAt));
  for (const type of ['full', 'half', 'package', '2000', '1000', '500']) {
    assert.ok(row.includes(`data-quick-amount="${type}"`), `merged ${type} chip must stay`);
  }
  assert.ok(!row.includes('data-quick-amount="current"'), 'the Current Month chip must be gone');
  assert.ok(!row.includes('data-quick-amount="1500"'), 'the 1,500 chip must be gone');
  // The dues figures module is untouched — same figures, same rule.
  assert.deepEqual(addPaymentDuesFigures({ fullDues: 9000 }), { full: 9000, half: 4500 });
  assert.deepEqual(addPaymentDuesFigures({ fullDues: 4500 }), { full: 4500, half: 2250 });
  // The loose-change chips module is untouched — same tender chip.
  const loose = looseChangeChipsMarkup(4999, (tendered, change) => `Tender ${tendered}, change ${change}`);
  assert.ok(loose.includes('data-loose-tender="5000"'), 'the round-note tender chip keeps its figure');
  assert.ok(loose.includes('class="loose-change-chip"'), 'the tender chip keeps its class');
});

test('styles: the group labels reuse the existing small-label style — no new rule, no new colour', () => {
  const at = stylesSrc.indexOf('.qc-shop-label');
  assert.ok(at > -1, 'the existing small-label rule must exist');
  const rule = stylesSrc.slice(at - 60, stylesSrc.indexOf('}', at) + 1);
  assert.ok(rule.includes('.qc-amount-group-label'), 'the group label joins the existing small-label rule');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(rule), 'the shared label rule carries no hex colour');
  assert.ok(rule.includes('var(--muted)'), 'the label colour comes from a token');
});

test('module: the label texts name rows, never money or a real customer', () => {
  for (const text of [CHIPS_LABEL, LOOSE_LABEL]) {
    assert.ok(!/\d/.test(text), `label "${text}" must carry no figure`);
    assert.ok(!text.includes('PKR') && !text.includes('Rs'), `label "${text}" must carry no currency`);
  }
  // Fragment-built so this test itself never spells the real names.
  const real = ['Ki' + 'ran', 'Bi' + 'lal', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Sa' + 'ad'];
  for (const name of real) {
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});
