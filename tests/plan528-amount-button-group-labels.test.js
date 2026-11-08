// Plan 528 — Amount-button rows get group labels: the form step
// stacks three unlabelled amount rows — the Plan 489 pair ("Full
// dues", "Half dues") inserted before the chip row, the entry chip
// row ("Full Balance", "Package price", "Current Month", "50%",
// "500", "1,000", "1,500", "2,000"), and the loose-change tender
// chips below them. Each row now carries a small group label above
// it ("Pay in full / half", "Quick amounts", "Round-note tender"),
// reusing the existing small-label style. Layout only: no button is
// added, removed, reworded, or re-figured, and no tap changes what
// it fills.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addPaymentDuesButtonsHtml,
} from '../add-payment-dues-buttons.js';
import { looseChangeChipsMarkup } from '../loose-change-credit.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
const testSrc = readFileSync(new URL(import.meta.url), 'utf8');

const DUES_LABEL = 'Pay in full / half';
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

test('acceptance: the dues row and the entry chip row each get a group label from the wiring', () => {
  const start = wiringSrc.indexOf('function renderAddPaymentDuesButtons()');
  assert.notEqual(start, -1, 'renderAddPaymentDuesButtons must exist');
  const block = wiringSrc.slice(start, start + 2600);
  assert.ok(block.includes(`ensureAmountGroupLabel(duesRow, '${DUES_LABEL}')`), 'the dues row gets its label');
  assert.ok(block.includes(`ensureAmountGroupLabel(chipsRow, '${CHIPS_LABEL}')`), 'the entry chip row gets its label');
  // The dues label is ensured before the chip label, so the page reads
  // dues label, dues row, chip label, chip row — never two labels
  // stacked above the dues row.
  assert.ok(
    block.indexOf(`ensureAmountGroupLabel(duesRow, '${DUES_LABEL}')`) <
    block.indexOf(`ensureAmountGroupLabel(chipsRow, '${CHIPS_LABEL}')`),
    'the dues label is ensured before the chip label',
  );
});

test('acceptance: the label helper only names the row — it never touches a button or a figure', () => {
  const start = wiringSrc.indexOf('function ensureAmountGroupLabel(');
  assert.notEqual(start, -1, 'ensureAmountGroupLabel must exist');
  const end = wiringSrc.indexOf('\n  }\n', start);
  assert.notEqual(end, -1, 'the helper must close');
  const block = wiringSrc.slice(start, end);
  assert.match(block, /document\.createElement\('p'\)/);
  assert.match(block, /className = 'qc-amount-group-label'/);
  assert.match(block, /label\.textContent = text/);
  assert.match(block, /row\.before\(label\)/);
  // A row that already carries its label is left alone — a refresh
  // never stacks a second label above the same row.
  assert.ok(block.includes("previousElementSibling"), 'the helper checks the row above it first');
  assert.ok(block.includes("classList.contains('qc-amount-group-label')"), 'a labelled row is skipped');
  assert.ok(!block.includes('innerHTML'), 'the helper never rewrites a row');
  assert.ok(!block.includes('amountInput'), 'the helper never touches the amount field');
  assert.ok(!block.includes('data-apd-amount'), 'the helper never touches a dues button');
  assert.ok(!block.includes('data-quick-amount'), 'the helper never touches a chip');
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
  // The entry chip row in the page is untouched — same eight buttons,
  // same order (Plan 391 pin).
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  assert.ok(rowAt > 0, 'the quick-amount row must exist');
  const row = pageSrc.slice(rowAt, pageSrc.indexOf('</div>', rowAt));
  for (const type of ['full', 'package', 'current', 'half', '500', '1000', '1500', '2000']) {
    assert.ok(row.includes(`data-quick-amount="${type}"`), `existing ${type} button must stay`);
  }
  // The dues buttons module is untouched — same pair, same figures.
  const html = addPaymentDuesButtonsHtml({ full: 9000, half: 4500 });
  assert.ok(html.includes('data-apd-amount="9000"'), 'full dues button keeps its figure');
  assert.ok(html.includes('data-apd-amount="4500"'), 'half dues button keeps its figure');
  assert.ok(html.includes('Full dues'), 'full dues button keeps its words');
  assert.ok(html.includes('Half dues'), 'half dues button keeps its words');
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
  for (const text of [DUES_LABEL, CHIPS_LABEL, LOOSE_LABEL]) {
    assert.ok(!/\d/.test(text), `label "${text}" must carry no figure`);
    assert.ok(!text.includes('PKR') && !text.includes('Rs'), `label "${text}" must carry no currency`);
  }
  // Fragment-built so this test itself never spells the real names.
  const real = ['Ki' + 'ran', 'Bi' + 'lal', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Sa' + 'ad'];
  for (const name of real) {
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});
