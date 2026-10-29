// Equipment Inventory redesign (owner request, 2026-10-29): PRESENTATION
// ONLY. The Item Definitions table no longer squeezes its headers into
// mid-word wraps on a phone: at <=700px (the house table-to-cards
// breakpoint) the table hides and one card per item renders instead, the
// filter toolbar stops stacking five full-width bars, and the item form
// keeps two compact columns for its short fields. Every control keeps
// its exact id, handler and behaviour; no inventory logic changed.
// These tests pin the new structure, the token-only CSS, the unchanged
// handler wiring, and — by evaluating the real inventoryItemStatus
// helper extracted from app.js plus the real phase3 save path the item
// form submits through — the live behaviour. (app.js is a DOM monolith
// that cannot be imported under node:test, so the controller-level pins
// are source-level, in the style of tests/table-ui.test.js; the
// browser-level proof lives in tests/e2e/inventory.spec.mjs, CI only.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createInitialState } from '../core.js';
import { addInventoryItem, updateInventoryItem, addStockMovement, inventorySummary } from '../phase3.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function inventorySlice() {
  const start = html.indexOf('id="inventoryView"');
  assert.ok(start > -1, 'inventory view exists');
  const end = html.indexOf('id="expensesView"', start);
  assert.ok(end > start, 'inventory view slice ends at the expenses view');
  return html.slice(start, end);
}

function redesignCssBlock() {
  const start = css.indexOf('Equipment Inventory redesign');
  assert.ok(start > -1, 'redesign block present in styles.css');
  const end = css.indexOf('.table-pagination', start);
  assert.ok(end > start, 'redesign block ends before the pagination rules');
  return css.slice(start, end);
}

// The exact production helper from renderInventory, evaluated directly.
function loadInventoryItemStatus() {
  const start = app.indexOf('const inventoryItemStatus=');
  assert.ok(start > -1, 'inventoryItemStatus helper exists in app.js');
  const end = app.indexOf('\n  };', start);
  assert.ok(end > start, 'helper body slice found');
  const source = app.slice(start, end + '\n  };'.length);
  return new Function(`"use strict"; ${source}; return inventoryItemStatus;`)();
}

test('redesign: item definitions get a cards container beside the desktop table', () => {
  const slice = inventorySlice();
  assert.ok(slice.includes('<section class="table-card inventory-items-card">'), 'items section carries the redesign scope class');
  assert.equal((html.match(/inventory-items-card/g) || []).length, 1, 'only the Item Definitions section is in scope (movements section untouched)');
  const scrollAt = slice.indexOf('<div class="table-scroll">');
  const cardsAt = slice.indexOf('id="inventoryItemCards"');
  assert.ok(cardsAt > scrollAt, 'cards container sits right after the items table');
  assert.ok(slice.includes('class="inventory-item-cards"'), 'cards container carries the grid class');
  assert.ok(cardsAt < slice.indexOf('id="inventoryItemsEmpty"'), 'cards render before the empty-state lines, mirroring the Area summary layout');
  assert.ok(slice.includes('id="inventoryItemsTable"'), 'desktop table kept');
  for (const key of ['name', 'category', 'available', 'unitCost', 'value']) {
    assert.ok(slice.includes(`data-sort-inventory="${key}"`), `sortable header kept: ${key}`);
  }
});

test('redesign: every filter control keeps its id, options and values', () => {
  const slice = inventorySlice();
  assert.ok(slice.includes('class="table-filter-toolbar inventory-filter-toolbar"'), 'toolbar carries the redesign scope class');
  for (const id of ['inventoryCategoryFilter', 'inventoryStockFilter', 'inventorySearchInput', 'clearInventoryFilters', 'exportInventoryCsvBtn', 'inventoryTableCount']) {
    assert.ok(slice.includes(`id="${id}"`), `${id} kept`);
  }
  for (const value of ['all', 'ONU', 'Router', 'Fiber cable', 'Connector', 'Adapter / power supply', 'Other']) {
    assert.ok(slice.includes(`<option value="${value}">`), `category option kept: ${value}`);
  }
  for (const value of ['all', 'low', 'out', 'in', 'unrecorded']) {
    assert.ok(slice.includes(`<option value="${value}">`), `stock-level option kept: ${value}`);
  }
  const actionsAt = slice.indexOf('class="table-filter-actions"');
  assert.ok(actionsAt > -1, 'Clear + Export grouped in the actions pair');
  assert.ok(slice.indexOf('id="clearInventoryFilters"') > actionsAt, 'Clear filters inside the actions pair');
  assert.ok(slice.indexOf('id="exportInventoryCsvBtn"') > actionsAt, 'Export CSV inside the actions pair');
});

test('redesign: item form keeps every field id and the same submit/cancel buttons', () => {
  const slice = inventorySlice();
  for (const id of ['inventoryItemForm', 'inventoryItemId', 'inventoryName', 'inventoryCategory', 'inventoryUnit', 'inventoryMinimum', 'inventoryUnitCost', 'inventoryCreatedDate', 'inventoryNotes', 'inventoryItemSubmit', 'inventoryItemCancel']) {
    assert.ok(slice.includes(`id="${id}"`), `${id} kept`);
  }
});

test('redesign: CSS hides the table and shows cards at <=700px, tokens only', () => {
  const block = redesignCssBlock();
  assert.ok(block.includes('.inventory-item-cards { display: none; }'), 'cards hidden by default (desktop keeps the table)');
  assert.ok(block.includes('@media (max-width: 700px)'), 'house phone breakpoint used');
  assert.ok(block.includes('.inventory-items-card .table-scroll { display: none; }'), 'items table hides on phone');
  assert.ok(block.includes('.inventory-item-cards { display: grid; gap: 12px; }'), 'one card per row grid on phone');
  assert.ok(block.includes('.inventory-item-figure-qty'), 'available quantity is the big figure');
  assert.ok(block.includes('font: 800 26px'), 'big-figure type for the available quantity');
  assert.ok(block.includes('.inventory-item-chip'), 'category chip rule');
  assert.ok(block.includes('border-radius: var(--radius-pill)'), 'chip radius from token');
  assert.ok(block.includes('.inventory-item-card--low { border-left: 4px solid var(--color-pending); }'), 'low-stock accent from the pending token');
  assert.ok(block.includes('.inventory-item-card--out { border-left: 4px solid var(--color-overdue); }'), 'out-of-stock accent from the overdue token');
  const noComments = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const hexes = noComments.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  assert.deepEqual(hexes, [], `no hard-coded hex in the redesign block (found ${hexes})`);
});

test('redesign: CSS compacts the filter toolbar and the item form', () => {
  const block = redesignCssBlock();
  assert.ok(block.includes('.table-filter-toolbar.inventory-filter-toolbar'), 'inventory-scoped toolbar rule beats the generic stacked layout');
  assert.ok(block.includes('flex-direction: row;'), 'toolbar no longer stacks into a column on phones');
  assert.ok(block.includes('.table-filter-toolbar.inventory-filter-toolbar > .table-filter-group.search-group { flex: 1 1 100%; }'), 'search takes its own full row on phones (specificity beats the screen-router stacking rule)');
  assert.ok(block.includes('.inventory-filter-toolbar .table-filter-actions { display: flex;'), 'Clear + Export sit side by side');
  assert.ok(block.includes('min-height: 44px;'), 'action buttons keep the 44px touch target the e2e spec pins');
  assert.ok(block.includes('#inventoryItemForm { grid-template-columns: repeat(2, minmax(0, 1fr)); }'), 'item form keeps two compact columns at phone widths');
  assert.ok(block.includes('#inventoryItemForm > label:first-of-type { grid-column: 1 / -1; }'), 'item name spans the full form width');
  assert.ok(block.includes('#inventoryItemForm > label:nth-of-type(2) { grid-column: 1 / -1; }'), 'category select spans full width so its longest option never clips');
  assert.ok(block.includes('#inventoryItemForm .form-wide { grid-column: 1 / -1 !important; }'), 'notes and form actions stay full width in the two-column layout');
});

test('redesign: app.js renders cards from the same filtered list through one shared status helper', () => {
  assert.ok(app.includes("const itemCards=$('#inventoryItemCards');"), 'renderInventory looks up the cards container');
  assert.ok(app.includes('itemCards.innerHTML=filteredItems.map'), 'cards render from the same filteredItems as the table');
  assert.ok(app.includes('inventory-item-figure-qty'), 'card shows the available quantity as the big figure');
  assert.ok(app.includes('inventory-item-chip'), 'card shows the category chip');
  assert.ok(app.includes('data-edit-inventory'), 'card carries the same Edit hook as the table row');
  assert.equal((app.match(/stock-status-pill pill-warning/g) || []).length, 1, 'pill markup lives in exactly one place — the shared helper');
  assert.ok(app.includes('const statusPill = inventoryItemStatus(item).pill;'), 'table row sources its pill from the helper');
  assert.ok(app.includes('const status=inventoryItemStatus(item);'), 'card sources its status from the helper');
  assert.ok(app.includes('bindInventoryEditButtons(itemsTable);'), 'Edit binding kept on the table');
  assert.ok(app.includes('bindInventoryEditButtons(itemCards);'), 'Edit binding added on the cards');
});

test('redesign: filter, clear, export and sort wiring is unchanged', () => {
  assert.ok(app.includes("$('#inventoryCategoryFilter')?.addEventListener('change'"), 'category filter still change-wired');
  assert.ok(app.includes("$('#inventoryStockFilter')?.addEventListener('change'"), 'stock filter still change-wired');
  assert.ok(app.includes("$('#inventorySearchInput')?.addEventListener('input'"), 'search still input-wired');
  assert.ok(app.includes("$('#clearInventoryFilters')?.addEventListener('click'"), 'clear button still click-wired');
  assert.ok(app.includes("inventoryCategoryFilter='all';"), 'clear resets the category filter');
  assert.ok(app.includes("inventoryStockFilter='all';"), 'clear resets the stock filter');
  assert.ok(app.includes("inventorySearchQuery='';"), 'clear resets the search query');
  assert.ok(app.includes("$('#exportInventoryCsvBtn')?.addEventListener('click'"), 'export still click-wired');
  assert.ok(app.includes("document.querySelectorAll('[data-sort-inventory]')"), 'sortable headers still wired');
  assert.ok(app.includes("$('#inventoryItemForm').addEventListener('submit'"), 'item form still submit-wired');
  assert.ok(app.includes('state=id?updateInventoryItem(state,id,fields):addInventoryItem(state,fields);'), 'submit still saves through add/updateInventoryItem');
});

test('behaviour: inventoryItemStatus matches the stock filter level semantics', () => {
  const inventoryItemStatus = loadInventoryItemStatus();
  // Same predicate the 'low' stock filter uses in renderInventory.
  const lowFilterMatches = (item) => item.hasMovements && item.available <= item.minimumStock;

  const unrecorded = inventoryItemStatus({ hasMovements: false, available: 0, minimumStock: 5 });
  assert.equal(unrecorded.level, 'unrecorded');
  assert.ok(unrecorded.pill.includes('pill-muted') && unrecorded.pill.includes('Unrecorded'), 'unrecorded pill kept verbatim');

  const out = inventoryItemStatus({ hasMovements: true, available: 0, minimumStock: 5 });
  assert.equal(out.level, 'out');
  assert.ok(out.pill.includes('pill-danger') && out.pill.includes('Out of stock'), 'out-of-stock pill kept verbatim');
  assert.ok(lowFilterMatches({ hasMovements: true, available: 0, minimumStock: 5 }), 'out of stock also matches the low filter, exactly as before');

  const low = inventoryItemStatus({ hasMovements: true, available: 3, minimumStock: 5 });
  assert.equal(low.level, 'low');
  assert.ok(low.pill.includes('pill-warning') && low.pill.includes('Low stock'), 'low-stock pill kept verbatim');
  assert.ok(lowFilterMatches({ hasMovements: true, available: 3, minimumStock: 5 }), 'low matches the low filter');

  const boundary = inventoryItemStatus({ hasMovements: true, available: 5, minimumStock: 5 });
  assert.equal(boundary.level, 'low', 'available == minimum is low (at or below minimum), as the metric card words it');

  const inStock = inventoryItemStatus({ hasMovements: true, available: 6, minimumStock: 5 });
  assert.equal(inStock.level, 'in');
  assert.ok(inStock.pill.includes('pill-success') && inStock.pill.includes('In stock'), 'in-stock pill kept verbatim');
  assert.ok(!lowFilterMatches({ hasMovements: true, available: 6, minimumStock: 5 }), 'in stock does not match the low filter');
});

test('behaviour: the item form save path (add -> movements -> edit) still drives the card figures', () => {
  const inventoryItemStatus = loadInventoryItemStatus();
  // The exact field shape the submit handler builds from FormData.
  let state = createInitialState([]);
  state = addInventoryItem(state, { name: 'ZTE Dual-Band XPON ONU', category: 'ONU', unit: 'piece', minimumStock: '5', unitCost: '4500', createdDate: '2026-10-29', notes: 'Gigabit XPON with WiFi-5' });
  let row = inventorySummary(state).items[0];
  assert.equal(row.hasMovements, false, 'a fresh definition has no stock yet');
  assert.equal(inventoryItemStatus(row).level, 'unrecorded', 'card would show Unrecorded');

  state = addStockMovement(state, { itemId: row.id, type: 'receive', quantity: '10', date: '2026-10-29', notes: '' });
  row = inventorySummary(state).items[0];
  assert.equal(row.available, 10, 'receive adds available stock');
  assert.equal(row.value, 45000, 'available value = unit cost x available');
  assert.equal(inventoryItemStatus(row).level, 'in', 'card would show In stock');

  state = addStockMovement(state, { itemId: row.id, type: 'install', quantity: '7', date: '2026-10-29', customerId: '', notes: '' });
  row = inventorySummary(state).items[0];
  assert.equal(row.available, 3, 'install draws available stock down');
  assert.equal(row.installed, 1 * 7, 'installed count tracks the movement');
  assert.equal(inventoryItemStatus(row).level, 'low', 'card would show Low stock with the pending accent');

  // The Edit path the card button feeds: same id, updated minimum.
  state = updateInventoryItem(state, row.id, { name: row.name, category: row.category, unit: row.unit, minimumStock: '2', unitCost: '4500', notes: row.notes });
  row = inventorySummary(state).items[0];
  assert.equal(row.minimumStock, 2, 'edit updates the minimum in place');
  assert.equal(inventoryItemStatus(row).level, 'in', 'with minimum 2 the same stock is back In stock');
});
