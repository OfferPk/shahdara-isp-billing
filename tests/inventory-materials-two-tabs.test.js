// Inventory & Materials 2-tab cleanup (owner request, 2026-11-20):
// the Inventory page splits into two top tabs (Stock Book |
// Equipment Register, Equipment default), the 11 empty KPI cards,
// the filter/Export bar and the empty movements table hide at 0
// items, both forms collapse behind + Add Item / + Record Movement,
// the movement Source/Destination fields show only when they apply
// (Source: damage|correction, Destination: correction only), the
// item form's 2-col rows share a baseline, and the Pending Hardware
// Recovery card loses its redundant bottom button in favour of a
// tappable header with a chevron. Presentation + wiring only; no
// inventory logic changed (phase3 movementStates untouched — damage
// still forces the destination, correction still allows removing a
// quantity from the trail). These tests pin the new structure and
// wiring at source level (the app.js monolith cannot be imported
// under node:test, in the style of tests/inventory-redesign.test.js);
// the browser-level proof lives in tests/e2e/inventory.spec.mjs and
// tests/e2e/hardware-custody.spec.mjs, CI only. Fixtures are generic
// only ("Test Item", quantities like 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TRANSLATIONS } from '../nav-language.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const router = readFileSync(new URL('../screen-router.js', import.meta.url), 'utf8');
const lang = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');

function inventorySlice() {
  const start = html.indexOf('id="inventoryView"');
  assert.ok(start > -1, 'inventory view exists');
  const end = html.indexOf('id="expensesView"', start);
  assert.ok(end > start, 'inventory view slice ends at the expenses view');
  return html.slice(start, end);
}

function renderInventorySlice() {
  const start = app.indexOf('function renderInventory()');
  assert.ok(start > -1, 'renderInventory exists');
  const end = app.indexOf('function syncExpenseTabs()', start);
  assert.ok(end > start, 'renderInventory ends before syncExpenseTabs');
  return app.slice(start, end);
}

function syncInventoryTabsSlice() {
  const start = app.indexOf('function syncInventoryTabs()');
  assert.ok(start > -1, 'syncInventoryTabs exists');
  const end = app.indexOf('function syncExpenseTabs()', start);
  assert.ok(end > start, 'syncInventoryTabs ends before syncExpenseTabs');
  return app.slice(start, end);
}

test('two tabs: Stock Book first, Equipment Register second and default', () => {
  const slice = inventorySlice();
  const navAt = slice.indexOf('<nav class="expense-tabs" id="inventoryTabs"');
  assert.ok(navAt > -1, 'tab bar reuses the expense-tabs pattern');
  assert.ok(slice.includes('role="tablist"'), 'tab bar carries the tablist role');
  const stockAt = slice.indexOf('id="inventoryTabStock"');
  const eqAt = slice.indexOf('id="inventoryTabEquipment"');
  assert.ok(stockAt > -1 && eqAt > -1, 'both tab buttons exist');
  assert.ok(stockAt < eqAt, 'Stock Book is listed first, Equipment Register second');
  assert.ok(/id="inventoryTabStock"[^>]*role="tab"[^>]*aria-controls="inventoryStockPanel"[^>]*aria-selected="false"/.test(slice), 'Stock Book tab points at its panel and starts unselected');
  assert.ok(/id="inventoryTabEquipment"[^>]*role="tab"[^>]*aria-controls="inventoryEquipmentPanel"[^>]*aria-selected="true"/.test(slice), 'Equipment Register tab points at its panel and starts selected');
  assert.ok(slice.includes('data-i18n="dash_card_stock"'), 'Stock Book tab reuses the existing Stock Book key');
  assert.ok(slice.includes('<span data-i18n="dash_card_stock">Stock Book</span>'), 'Stock Book tab label reads Stock Book');
  assert.ok(slice.includes('data-i18n="inv_tab_equipment_register"'), 'Equipment Register tab uses the new key');
  assert.ok(slice.includes('<span data-i18n="inv_tab_equipment_register">Equipment Register</span>'), 'Equipment Register tab label reads Equipment Register');
});

test('exactly one panel visible at a time; Equipment is the default panel', () => {
  const slice = inventorySlice();
  assert.ok(/id="inventoryStockPanel"[^>]*hidden/.test(slice), 'Stock Book panel starts hidden');
  assert.ok(slice.includes('id="inventoryEquipmentPanel"'), 'Equipment Register panel exists');
  assert.ok(!/id="inventoryEquipmentPanel"[^>]*hidden/.test(slice), 'Equipment Register panel starts visible');
  assert.ok(slice.includes('role="tabpanel"'), 'panels carry the tabpanel role');
  const sync = syncInventoryTabsSlice();
  assert.ok(app.includes("let inventoryActiveTab = 'equipment';"), 'Equipment Register is the session default tab');
  assert.ok(sync.includes("key === inventoryActiveTab"), 'aria-selected follows the active tab');
  assert.ok(sync.includes('panel.hidden = key !== inventoryActiveTab'), 'exactly one panel is visible at a time');
  assert.ok(app.includes("inventoryActiveTab=key;syncInventoryTabs();"), 'tab clicks switch the active tab and re-sync');
});

test('at 0 items the KPI grid and filter bar hide; the empty movements table hides at 0 movements', () => {
  const slice = inventorySlice();
  assert.ok(slice.includes('id="inventoryMetricGrid"'), 'KPI grid carries an id for the hide');
  assert.ok(slice.includes('id="inventoryFilterToolbar"'), 'filter bar carries an id for the hide');
  assert.ok(slice.includes('id="inventoryMovementTableScroll"'), 'movements table wrapper carries an id for the hide');
  const ri = renderInventorySlice();
  assert.ok(/allItems\.length\s*===\s*0/.test(ri), 'the hide is gated on the unfiltered item total');
  assert.ok(ri.includes("$('#inventoryMetricGrid')"), 'renderInventory hides the KPI grid');
  assert.ok(ri.includes("$('#inventoryFilterToolbar')"), 'renderInventory hides the filter bar');
  assert.ok(ri.includes("$('#inventoryMovementTableScroll')"), 'renderInventory hides the movements table wrapper');
  assert.ok(/movements\.length\s*===\s*0/.test(ri), 'the movements table hides on its own emptiness, not the item count');
  assert.ok(/#inventoryMetricGrid\[hidden\]\s*\{\s*display:\s*none;\s*\}/.test(css), 'scoped rule makes the KPI grid hide effective (author display:grid beats [hidden])');
  assert.ok(/#inventoryFilterToolbar\[hidden\]\s*\{\s*display:\s*none;\s*\}/.test(css), 'scoped rule makes the filter bar hide effective (author display:flex beats [hidden])');
  assert.ok(slice.includes('id="inventoryItemsEmpty"'), 'the Item Definitions empty state stays visible so the first item is still recordable');
  assert.ok(slice.includes('id="inventoryMovementsEmpty"'), 'the movements empty message stays visible; only the clipped empty table hides');
});

test('both forms collapse behind + Add Item and + Record Movement', () => {
  const slice = inventorySlice();
  assert.ok(slice.includes('<details class="registry-create-details" id="inventoryItemCreateDetails">'), 'item form sits in a registry details');
  assert.ok(slice.includes('<summary class="secondary-button registry-create-summary" id="inventoryItemCreateSummary">+ Add Item</summary>'), 'item form summary reads + Add Item');
  assert.ok(slice.includes('<details class="registry-create-details" id="inventoryMovementCreateDetails">'), 'movement form sits in a registry details');
  assert.ok(slice.includes('<summary class="secondary-button registry-create-summary" id="inventoryMovementCreateSummary">+ Record Movement</summary>'), 'movement form summary reads + Record Movement');
  const itemDetailsAt = slice.indexOf('id="inventoryItemCreateDetails"');
  const itemFormAt = slice.indexOf('id="inventoryItemForm"');
  const itemCloseAt = slice.indexOf('</details>', itemDetailsAt);
  assert.ok(itemDetailsAt > -1 && itemFormAt > itemDetailsAt && itemCloseAt > itemFormAt, 'item form is inside its details');
  const movDetailsAt = slice.indexOf('id="inventoryMovementCreateDetails"');
  const movFormAt = slice.indexOf('id="inventoryMovementForm"');
  const movCloseAt = slice.indexOf('</details>', movDetailsAt);
  assert.ok(movDetailsAt > -1 && movFormAt > movDetailsAt && movCloseAt > movFormAt, 'movement form is inside its details');
  for (const id of ['inventoryItemForm', 'inventoryItemId', 'inventoryName', 'inventoryCategory', 'inventoryUnit', 'inventoryMinimum', 'inventoryUnitCost', 'inventoryCreatedDate', 'inventoryNotes', 'inventoryItemSubmit', 'inventoryItemCancel']) {
    assert.ok(slice.includes(`id="${id}"`), `${id} kept inside the collapsed form`);
  }
});

test('the + Add Item header action clicks the summary, never focuses a closed form', () => {
  assert.ok(/inventory:\s*\{[^}]*click:\s*'#inventoryItemCreateSummary'/.test(router), 'screen action clicks the item summary');
  assert.ok(!/inventory:\s*\{[^}]*focus:\s*'#inventoryItemForm'/.test(router), 'screen action no longer focuses the form (focus cannot reach a closed details)');
  assert.ok(app.includes("$('#inventoryItemCreateSummary')?.addEventListener('click'"), 'summary click listener is bound');
  assert.ok(app.includes("if(details?.open)event.preventDefault();"), '+ Add Item never toggles an open form closed');
  assert.ok(app.includes("$('#inventoryName')?.focus({preventScroll:true})"), 'opening the form focuses the Item name field');
});

test('movement fields are conditional: Source for damage|correction, Destination for correction only', () => {
  assert.ok(app.includes('function syncMovementFields()'), 'syncMovementFields exists');
  assert.ok(/setRegistryFieldVisible\([^,]+,\s*type\s*===\s*'damage'\s*\|\|\s*type\s*===\s*'correction'/.test(app), 'Source shows for damage or correction');
  assert.ok(/setRegistryFieldVisible\([^,]+,\s*type\s*===\s*'correction'/.test(app), 'Destination shows for correction only');
  assert.ok(app.includes("$('#movementType')?.addEventListener('change', syncMovementFields)"), 'changing the movement type re-syncs the fields');
  const loadCall = app.indexOf('syncMovementFields();', app.indexOf("$('#movementType')?.addEventListener('change'"));
  assert.ok(loadCall > -1, 'fields sync once at load (initial type shows neither field)');
});

test('hiding a conditional field clears its value, so no stale state leaks between movement types', () => {
  const helperStart = app.indexOf('function setRegistryFieldVisible(');
  assert.ok(helperStart > -1, 'conditional-field helper exists');
  const helper = app.slice(helperStart, app.indexOf('\n}\n', helperStart));
  assert.ok(helper.includes("if (!visible && inputEl) inputEl.value = '';"), 'hiding clears the input by design');
  const submitStart = app.indexOf("$('#inventoryMovementForm').addEventListener('submit'");
  assert.ok(submitStart > -1, 'movement submit handler exists');
  const submit = app.slice(submitStart, app.indexOf("$('#loanForm')", submitStart));
  assert.ok(submit.includes('syncMovementFields();'), 'submit re-syncs after reset (reset restores the type but not the hidden flags)');
});

test('the item form closes on save/cancel; the movement form closes on save', () => {
  const resetStart = app.indexOf('function resetInventoryForm()');
  assert.ok(resetStart > -1, 'resetInventoryForm exists');
  const reset = app.slice(resetStart, app.indexOf('\n', resetStart));
  assert.ok(reset.includes("if(itemDetails)itemDetails.open=false;"), 'save and Cancel both close the item form through resetInventoryForm');
  assert.ok(app.includes("$('#inventoryItemCancel').addEventListener('click',resetInventoryForm);"), 'Cancel calls resetInventoryForm');
  const submitStart = app.indexOf("$('#inventoryMovementForm').addEventListener('submit'");
  const submit = app.slice(submitStart, app.indexOf("$('#loanForm')", submitStart));
  assert.ok(submit.includes("if(movDetails)movDetails.open=false;"), 'movement save closes the movement form');
});

test('editing an item opens the collapsed form before scrolling to it', () => {
  const editStart = app.indexOf('bindInventoryEditButtons');
  assert.ok(editStart > -1, 'edit binding exists');
  const edit = app.slice(editStart, app.indexOf('bindInventoryEditButtons(itemsTable);', editStart));
  assert.ok(edit.includes("if(itemDetails)itemDetails.open=true;"), 'edit opens the details first');
  assert.ok(edit.indexOf('itemDetails.open=true') < edit.indexOf('scrollIntoView'), 'open happens before the scroll, or the scroll lands on a hidden form');
});

test('the 2-col item form rows share a baseline', () => {
  assert.ok(/#inventoryItemForm\s*\{\s*align-items:\s*end;\s*\}/.test(css), 'align-items:end bottom-aligns each label grid-item in its row');
  assert.ok(css.includes('#inventoryItemForm { grid-template-columns: repeat(2, minmax(0, 1fr)); }'), 'pinned phone 2-col rule untouched');
  assert.ok(css.includes('#inventoryItemForm > label:first-of-type { grid-column: 1 / -1; }'), 'pinned item-name full-width rule untouched');
  assert.ok(css.includes('#inventoryItemForm > label:nth-of-type(2) { grid-column: 1 / -1; }'), 'pinned category full-width rule untouched');
  assert.ok(css.includes('#inventoryItemForm .form-wide { grid-column: 1 / -1 !important; }'), 'pinned form-wide rule untouched');
  assert.ok(!css.includes('#inventoryItemForm { gap: 10px; padding: 12px; align-items: end; }'), 'the alignment is a separate rule, never merged into the pinned rule');
});

test('the unit placeholder is short and the Destination empty option names the removal', () => {
  const slice = inventorySlice();
  assert.ok(/id="inventoryUnit"[^>]*placeholder="e\.g\. pcs, m"/.test(slice), "placeholder reads 'e.g. pcs, m'");
  assert.ok(slice.includes('<option value="">Remove from trail</option>'), "Destination empty option reads 'Remove from trail'");
  assert.ok(!slice.includes('Not applicable / remove from trail'), 'the clipped long Destination label is gone');
  assert.ok(slice.includes('<option value="">Not applicable</option>'), "Source empty option still reads 'Not applicable'");
});

test('Pending Hardware Recovery has no bottom button; its header is tappable with a chevron', () => {
  const slice = inventorySlice();
  assert.ok(!html.includes('id="openHardwareRecoveryModalBtn"'), 'redundant bottom button deleted from the page');
  assert.ok(!app.includes('openHardwareRecoveryModalBtn'), 'no app.js wiring references the deleted button');
  const headAt = slice.indexOf('summary-hardware-recovery');
  assert.ok(headAt > -1, 'Recovery card exists');
  const head = slice.slice(headAt, headAt + 1200);
  assert.ok(head.includes('role="button"'), 'Recovery header carries the button role');
  assert.ok(head.includes('tabindex="0"'), 'Recovery header is keyboard-focusable');
  assert.ok(head.includes('data-ds-icon="ChevronRight"'), 'Recovery header carries the ChevronRight icon at the right');
  assert.ok(app.includes("document.querySelector('.summary-hardware-recovery .ds-card-head')"), 'wiring targets the Recovery header');
  assert.ok(app.includes("recoveryHead?.addEventListener('click', openHardwareRecoveryModal);"), 'header click opens the recovery modal');
  assert.ok(app.includes("event.key === 'Enter' || event.key === ' '"), 'Enter and Space open the recovery modal too');
  assert.ok(slice.includes('id="openInventoryBookModalBtn"'), 'Stock Book keeps its 3 action buttons');
  assert.ok(slice.includes('id="openFiberDrumModalBtn"'), 'Fiber Drums keeps its Drum Tracker button');
});

test('exactly one new i18n key: the Equipment Register tab label', () => {
  assert.equal(TRANSLATIONS.en.inv_tab_equipment_register, 'Equipment Register', 'EN tab label');
  assert.equal(TRANSLATIONS.ur.inv_tab_equipment_register, 'ایکوئپمنٹ رجسٹر', 'UR tab label');
  const found = lang.match(/inv_tab_[a-z_]+/g) || [];
  assert.deepEqual([...new Set(found)], ['inv_tab_equipment_register'], 'no other inv_tab_ key exists');
  assert.equal(found.length, 2, 'the new key appears exactly twice (EN + UR)');
  assert.equal(Object.keys(TRANSLATIONS.en).length, Object.keys(TRANSLATIONS.ur).length, 'EN and UR dicts still agree');
});
