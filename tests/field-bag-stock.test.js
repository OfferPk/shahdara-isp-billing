/**
 * field-bag-stock.test.js — SISP-127: Lineman Field Bag / Bike Box
 * Mini-Inventory.
 *
 * Pins: (1) Main Store -> Field Bag transfers move exact quantities
 * through the shipped inventory path (and refuse atomically);
 * (2) ticket-close deduction from the bag via the bag bridge —
 * exactly once, never touching the Main Store — plus the Main Store
 * case staying with the SISP-42 bridge; (3) reconciliation totals
 * across both stores after a mixed sequence; (4) reopen reversal;
 * (5) backup round-trip under the SISP-37 safe-merge rule;
 * (6) sanitizer discipline; (7) i18n + wiring audits.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FIELD_BAG_KEY,
  sanitizeFieldBagMovements,
  loadFieldBagMovements,
  saveFieldBagMovements,
  computeBagStock,
  bagAvailableFor,
  transferToFieldBag,
  returnFieldBagToStore,
  fieldBagLinesForTicket,
  outstandingBagUsage,
  consumeTicketFromFieldBag,
  applyFieldBagStockBridge,
  buildFieldBagReconciliation,
  sortedFieldBagLog
} from '../field-bag-stock.js';
import {
  addMovement,
  computeStock,
  availableFor,
  sanitizeInventory
} from '../inventory-book.js';
import {
  createTicket,
  resolveTicket,
  setTicketStatus,
  sanitizeTickets,
  applyTicketStockBridge
} from '../complaint-tickets.js';
import {
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge
} from '../core.js';
import { TRANSLATIONS, t } from '../nav-language.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

function stockIn(itemId, qty, date = '2026-10-01') {
  return (movements) => addMovement(movements, { itemId, kind: 'in', qty, date });
}

function resolvedBagTicket(materialsUsed, id = 'TKT-101') {
  const ticket = createTicket({
    customerId: 'c1',
    customerName: 'Test Customer 01',
    faultPreset: 'CAT6 / RJ45 Fault',
    technician: 'Test Lineman'
  }, []);
  const [resolved] = resolveTicket([ticket], ticket.id, {
    materialsUsed,
    billingType: 'free',
    stockSource: 'bag',
    resolvedAt: '2026-10-05T10:30',
    referenceDate: new Date('2026-10-05T10:30:00+05:00')
  });
  assert.equal(resolved.id, id);
  return resolved;
}

// ------------------------------------------------------------------
// (1) Transfers through the shipped inventory path
// ------------------------------------------------------------------

test('transfer Main Store -> Field Bag moves exact quantities on both sides', () => {
  let inventory = [];
  inventory = stockIn('rj45', 20)(inventory);
  inventory = stockIn('patch-cord', 6)(inventory);
  const result = transferToFieldBag(inventory, [], { itemId: 'rj45', qty: 8, date: '2026-10-02' }, addMovement);

  assert.equal(availableFor(result.inventoryMovements, 'rj45'), 12);
  assert.equal(bagAvailableFor(result.bagMovements, 'rj45'), 8);
  // One movement per side, each in its own system's shape.
  assert.equal(result.inventoryMovements.length, inventory.length + 1);
  const outRow = result.inventoryMovements[result.inventoryMovements.length - 1];
  assert.equal(outRow.kind, 'out');
  assert.match(outRow.id, /^STK-\d+$/);
  assert.equal(result.bagMovements.length, 1);
  assert.equal(result.bagMovements[0].kind, 'in');
  assert.match(result.bagMovements[0].id, /^BAG-\d+$/);
  // Inputs untouched (pure).
  assert.equal(availableFor(inventory, 'rj45'), 20);
});

test('transfer refusal is atomic: over-draw changes neither store', () => {
  const inventory = stockIn('rj45', 5)([]);
  const bag = transferToFieldBag(stockIn('rj45', 10)([]), [], { itemId: 'rj45', qty: 4, date: '2026-10-02' }, addMovement).bagMovements;
  const invBefore = JSON.stringify(inventory);
  const bagBefore = JSON.stringify(bag);
  assert.throws(
    () => transferToFieldBag(inventory, bag, { itemId: 'rj45', qty: 6, date: '2026-10-03' }, addMovement),
    /exceeds available/
  );
  assert.equal(JSON.stringify(inventory), invBefore);
  assert.equal(JSON.stringify(bag), bagBefore);
  assert.throws(
    () => transferToFieldBag(inventory, bag, { itemId: 'nope', qty: 1, date: '2026-10-03' }, addMovement),
    /Unknown stock item/
  );
  assert.throws(
    () => transferToFieldBag(inventory, bag, { itemId: 'rj45', qty: 1.5, date: '2026-10-03' }, addMovement),
    /whole units/
  );
});

test('return Field Bag -> Main Store rides the same path in reverse', () => {
  const seeded = transferToFieldBag(stockIn('media-converter', 4)([]), [], { itemId: 'media-converter', qty: 3, date: '2026-10-02' }, addMovement);
  const back = returnFieldBagToStore(seeded.inventoryMovements, seeded.bagMovements, { itemId: 'media-converter', qty: 2, date: '2026-10-04' }, addMovement);
  assert.equal(availableFor(back.inventoryMovements, 'media-converter'), 3);
  assert.equal(bagAvailableFor(back.bagMovements, 'media-converter'), 1);
  assert.equal(back.bagMovements[back.bagMovements.length - 1].kind, 'return-out');
  // Returning more than the bag holds is refused before any write.
  assert.throws(
    () => returnFieldBagToStore(back.inventoryMovements, back.bagMovements, { itemId: 'media-converter', qty: 2, date: '2026-10-04' }, addMovement),
    /does not hold/
  );
});

test('bag quantities are derived from the log only (no stored counts)', () => {
  const { bagMovements } = transferToFieldBag(stockIn('rj45', 30)([]), [], { itemId: 'rj45', qty: 10, date: '2026-10-02' }, addMovement);
  const row = computeBagStock(bagMovements).find((r) => r.id === 'rj45');
  assert.deepEqual(
    { issuedIn: row.issuedIn, usedOut: row.usedOut, returnedOut: row.returnedOut, inBag: row.inBag },
    { issuedIn: 10, usedOut: 0, returnedOut: 0, inBag: 10 }
  );
  // Sanitizer strips anything that is not a movement (e.g. a forged count field).
  const forged = sanitizeFieldBagMovements([{ ...bagMovements[0], inBag: 999, available: 999 }]);
  assert.equal('inBag' in forged[0], false);
  assert.equal('available' in forged[0], false);
});

// ------------------------------------------------------------------
// (2) Ticket-close deduction: bag source and main source
// ------------------------------------------------------------------

test('bag bridge deducts a resolved bag ticket from the bag exactly once, Main Store untouched', () => {
  const seeded = transferToFieldBag(stockIn('rj45', 20)([]), [], { itemId: 'rj45', qty: 9, date: '2026-10-02' }, addMovement);
  const ticket = resolvedBagTicket([{ key: 'rj45', qty: 4, amount: 0 }]);
  assert.equal(ticket.stockSource, 'bag');
  assert.equal(ticket.stockDeducted, false);

  const invBefore = JSON.stringify(seeded.inventoryMovements);
  const result = applyFieldBagStockBridge([ticket], seeded.bagMovements, { referenceDate: new Date('2026-10-06T09:00:00+05:00') });
  assert.deepEqual(result.deducted, ['TKT-101']);
  assert.deepEqual(result.failures, []);
  assert.equal(result.tickets[0].stockDeducted, true);
  assert.equal(bagAvailableFor(result.bagMovements, 'rj45'), 5);
  const usage = result.bagMovements.filter((m) => m.kind === 'usage');
  assert.equal(usage.length, 1);
  assert.equal(usage[0].ticketId, 'TKT-101');
  assert.equal(usage[0].qty, 4);
  assert.equal(usage[0].date, '2026-10-05');
  // Main Store inventory never moved.
  assert.equal(JSON.stringify(seeded.inventoryMovements), invBefore);
  // The SISP-42 Main Store bridge must now skip this ticket entirely.
  const mainPass = applyTicketStockBridge(result.tickets, seeded.inventoryMovements, addMovement);
  assert.deepEqual(mainPass.deducted, []);
  assert.equal(JSON.stringify(mainPass.movements), invBefore);

  // Second bag pass is a strict no-op (idempotent).
  const again = applyFieldBagStockBridge(result.tickets, result.bagMovements, { referenceDate: new Date('2026-10-06T10:00:00+05:00') });
  assert.deepEqual(again.deducted, []);
  assert.equal(JSON.stringify(again.bagMovements), JSON.stringify(result.bagMovements));
  assert.equal(bagAvailableFor(again.bagMovements, 'rj45'), 5);
});

test('bag shortage deducts nothing and reports a failure (ticket stays pending)', () => {
  const seeded = transferToFieldBag(stockIn('rj45', 20)([]), [], { itemId: 'rj45', qty: 2, date: '2026-10-02' }, addMovement);
  const ticket = resolvedBagTicket([{ key: 'rj45', qty: 4, amount: 0 }]);
  const bagBefore = JSON.stringify(seeded.bagMovements);
  const result = applyFieldBagStockBridge([ticket], seeded.bagMovements);
  assert.deepEqual(result.deducted, []);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].id, 'TKT-101');
  assert.match(result.failures[0].message, /does not hold enough/);
  assert.equal(result.tickets[0].stockDeducted, false);
  assert.equal(JSON.stringify(result.bagMovements), bagBefore);
  // Direct consume throws the same way, appending nothing.
  assert.throws(() => consumeTicketFromFieldBag(ticket, seeded.bagMovements), /does not hold enough/);
});

test('main-source tickets are untouched by the bag bridge and still deduct via SISP-42', () => {
  const ticket = (() => {
    const created = createTicket({
      customerId: 'c2', customerName: 'Test Customer 02',
      faultPreset: 'CAT6 / RJ45 Fault', technician: 'Test Lineman'
    }, []);
    return resolveTicket([created], created.id, {
      materialsUsed: [{ key: 'rj45', qty: 3, amount: 0 }],
      billingType: 'free',
      resolvedAt: '2026-10-05T11:00'
    })[0];
  })();
  assert.equal('stockSource' in ticket, false); // legacy/main stays byte-identical
  const bagPass = applyFieldBagStockBridge([ticket], []);
  assert.deepEqual(bagPass.deducted, []);
  assert.deepEqual(bagPass.tickets, sanitizeTickets([ticket]));
  const inventory = stockIn('rj45', 10)([]);
  const mainPass = applyTicketStockBridge(bagPass.tickets, inventory, addMovement);
  assert.deepEqual(mainPass.deducted, ['TKT-101']);
  assert.equal(availableFor(mainPass.movements, 'rj45'), 7);
});

test('reopen returns bag usage to the bag; re-resolve deducts exactly once more', () => {
  const seeded = transferToFieldBag(stockIn('patch-cord', 10)([]), [], { itemId: 'patch-cord', qty: 6, date: '2026-10-02' }, addMovement);
  const ticket = resolvedBagTicket([{ key: 'patch-cord', qty: 2, amount: 0 }]);
  const first = applyFieldBagStockBridge([ticket], seeded.bagMovements, { referenceDate: new Date('2026-10-06T09:00:00+05:00') });
  assert.equal(bagAvailableFor(first.bagMovements, 'patch-cord'), 4);

  const [reopened] = setTicketStatus(first.tickets, 'TKT-101', 'Open');
  assert.equal(reopened.stockDeducted, true); // bridge has not run yet
  const reversed = applyFieldBagStockBridge([reopened], first.bagMovements, { referenceDate: new Date('2026-10-07T09:00:00+05:00') });
  assert.deepEqual(reversed.reversed, ['TKT-101']);
  assert.equal(reversed.tickets[0].stockDeducted, false);
  assert.equal(bagAvailableFor(reversed.bagMovements, 'patch-cord'), 6);
  assert.equal(outstandingBagUsage(reversed.bagMovements, 'TKT-101').length, 0);
  // The Main Store bridge must not "reverse" the reopened bag ticket into the store.
  const mainPass = applyTicketStockBridge(reversed.tickets, seeded.inventoryMovements, addMovement);
  assert.deepEqual(mainPass.reversed, []);

  const [reresolved] = resolveTicket(reversed.tickets, 'TKT-101', {
    materialsUsed: [{ key: 'patch-cord', qty: 2, amount: 0 }],
    billingType: 'free',
    stockSource: 'bag',
    resolvedAt: '2026-10-08T10:00'
  });
  const second = applyFieldBagStockBridge([reresolved], reversed.bagMovements, { referenceDate: new Date('2026-10-08T11:00:00+05:00') });
  assert.deepEqual(second.deducted, ['TKT-101']);
  assert.equal(bagAvailableFor(second.bagMovements, 'patch-cord'), 4);
  assert.deepEqual(outstandingBagUsage(second.bagMovements, 'TKT-101'), [{ itemId: 'patch-cord', qty: 2 }]);
});

test('fieldBagLinesForTicket maps materials through the SISP-42 catalog mapping', () => {
  const ticket = resolvedBagTicket([
    { key: 'fiber', qty: 12.5, amount: 0 },
    { key: 'router', qty: 1, amount: 0 }
  ]);
  assert.deepEqual(fieldBagLinesForTicket(ticket), [
    { itemId: 'fiber-2core', qty: 12.5 },
    { itemId: 'router', qty: 1 }
  ]);
});

// ------------------------------------------------------------------
// (3) Reconciliation across both stores
// ------------------------------------------------------------------

test('reconciliation totals match both stores after a mixed sequence', () => {
  let inventory = [];
  inventory = stockIn('rj45', 50)(inventory);
  inventory = stockIn('router', 5)(inventory);
  let bag = [];
  let step = transferToFieldBag(inventory, bag, { itemId: 'rj45', qty: 20, date: '2026-10-02' }, addMovement);
  inventory = step.inventoryMovements; bag = step.bagMovements;
  step = transferToFieldBag(inventory, bag, { itemId: 'router', qty: 2, date: '2026-10-02' }, addMovement);
  inventory = step.inventoryMovements; bag = step.bagMovements;
  step = returnFieldBagToStore(inventory, bag, { itemId: 'rj45', qty: 5, date: '2026-10-03' }, addMovement);
  inventory = step.inventoryMovements; bag = step.bagMovements;
  const ticket = resolvedBagTicket([{ key: 'rj45', qty: 6, amount: 0 }]);
  const bridged = applyFieldBagStockBridge([ticket], bag);
  bag = bridged.bagMovements;

  const recon = buildFieldBagReconciliation(computeStock(inventory), bag);
  const rj45 = recon.find((r) => r.id === 'rj45');
  assert.deepEqual(
    { mainStore: rj45.mainStore, inBag: rj45.inBag, total: rj45.total },
    { mainStore: 35, inBag: 9, total: 44 }
  );
  const router = recon.find((r) => r.id === 'router');
  assert.deepEqual(
    { mainStore: router.mainStore, inBag: router.inBag, total: router.total },
    { mainStore: 3, inBag: 2, total: 5 }
  );
  // Reconciliation is read-only.
  const invBefore = JSON.stringify(inventory);
  const bagBefore = JSON.stringify(bag);
  buildFieldBagReconciliation(computeStock(inventory), bag);
  assert.equal(JSON.stringify(inventory), invBefore);
  assert.equal(JSON.stringify(bag), bagBefore);
  // Cross-check the total against the raw logs: everything ever
  // stocked in, minus what tickets consumed, is somewhere.
  assert.equal(rj45.total, 50 - 6);
});

// ------------------------------------------------------------------
// Sanitizer + storage discipline
// ------------------------------------------------------------------

test('sanitizeFieldBagMovements drops junk and unauditable usage rows', () => {
  const rows = sanitizeFieldBagMovements([
    { id: 'BAG-101', itemId: 'rj45', kind: 'in', qty: 5, date: '2026-10-02' },
    { id: 'BAG-102', itemId: 'nope', kind: 'in', qty: 5, date: '2026-10-02' },
    { id: 'BAG-103', itemId: 'rj45', kind: 'sideways', qty: 5, date: '2026-10-02' },
    { id: 'BAG-104', itemId: 'rj45', kind: 'usage', qty: 2, date: '2026-10-03' }, // no ticketId -> dropped
    { id: 'BAG-105', itemId: 'rj45', kind: 'usage', qty: 2, date: '2026-10-03', ticketId: 'TKT-101' },
    { id: 'BAG-106', itemId: 'rj45', kind: 'in', qty: 1, date: '2026-10-03', ticketId: 'TKT-101' }, // ticketId forced off non-usage
    { id: 'BAG-107', itemId: 'rj45', kind: 'in', qty: -3, date: '2026-10-03' },
    'garbage',
    null
  ]);
  assert.deepEqual(rows.map((r) => r.id), ['BAG-101', 'BAG-105', 'BAG-106']);
  assert.equal(rows[2].ticketId, '');
  assert.deepEqual(sanitizeFieldBagMovements('nope'), []);
  assert.deepEqual(sanitizeInventory([]), []); // inventory sanitizer untouched
});

test('load/save round-trip through localStorage key sisp_field_bag_v1', () => {
  const storage = memoryStorage();
  const { bagMovements } = transferToFieldBag(stockIn('rj45', 9)([]), [], { itemId: 'rj45', qty: 4, date: '2026-10-02' }, addMovement);
  assert.equal(saveFieldBagMovements(bagMovements, storage), true);
  assert.ok(storage.getItem(FIELD_BAG_KEY).includes('rj45'));
  assert.deepEqual(loadFieldBagMovements(storage), sanitizeFieldBagMovements(bagMovements));
  assert.deepEqual(loadFieldBagMovements(memoryStorage({ [FIELD_BAG_KEY]: '{broken' })), []);
  const sorted = sortedFieldBagLog(bagMovements);
  assert.equal(sorted.length, 1);
});

// ------------------------------------------------------------------
// (5) Backup travel — SISP-37 safe-merge rule
// ------------------------------------------------------------------

test('backup round-trip: field bag movements adopt onto an empty device only', () => {
  const { bagMovements } = transferToFieldBag(stockIn('rj45', 12)([]), [], { itemId: 'rj45', qty: 7, date: '2026-10-02' }, addMovement);
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { fieldBagMovements: bagMovements });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.fieldBagMovements.length, 1);
  assert.equal(parsed.settings.fieldBagMovements[0].kind, 'in');

  // Empty device: adopted.
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.deepEqual(preview.fieldBagMovements, sanitizeFieldBagMovements(bagMovements));
  assert.equal(preview.counts.fieldBagMovementsRestored, 1);

  // Device with different real movements: conflict, never overwritten.
  const other = [{ id: 'BAG-101', itemId: 'router', kind: 'in', qty: 1, date: '2026-10-01', ticketId: '', note: '', createdAt: '' }];
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentFieldBagMovements: other, currentFieldBagMovementsStored: true });
  assert.equal(clash.fieldBagMovements, null);
  assert.ok(clash.conflicts.some((c) => /Field bag/.test(c.field)));

  // Identical on both sides: no restore, no conflict.
  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentFieldBagMovements: bagMovements, currentFieldBagMovementsStored: true });
  assert.equal(identical.fieldBagMovements, null);
  assert.ok(!identical.conflicts.some((c) => /Field bag/.test(c.field)));

  // A backup with no field bag section restores nothing.
  const plain = previewJsonBackupMerge(createInitialState(), createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), {}));
  assert.equal(plain.fieldBagMovements, null);
});

// ------------------------------------------------------------------
// i18n + wiring audits
// ------------------------------------------------------------------

test('i18n: every fbag_/dash_fbag key used exists in en and ur and never renders raw', () => {
  const moduleSource = readFileSync(new URL('../field-bag-stock.js', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const source of [moduleSource, appSource]) {
    for (const match of source.matchAll(/t\('((?:fbag|dash_fbag)[a-z0-9_]*)/g)) used.add(match[1]);
  }
  // Dynamic kind keys from the controller.
  for (const kind of ['in', 'return_out', 'usage', 'usage_return']) used.add(`fbag_kind_${kind}`);
  assert.ok(used.size >= 20, `expected 20+ audited keys, got ${used.size}`);
  for (const key of used) {
    assert.ok(key in TRANSLATIONS.en, `missing en: ${key}`);
    assert.ok(key in TRANSLATIONS.ur, `missing ur: ${key}`);
    assert.notEqual(t(key, 'ur', { id: 'TKT-101', reason: 'x', kinds: 1, units: 2 }), key, `raw key in ur: ${key}`);
    assert.notEqual(t(key, 'en', { id: 'TKT-101', reason: 'x', kinds: 1, units: 2 }), key, `raw key in en: ${key}`);
  }
  // Urdu values carry Urdu script (not copied English) for prose keys.
  for (const key of ['fbag_intro', 'fbag_issue_title', 'fbag_returned_toast', 'dash_fbag_empty']) {
    assert.match(TRANSLATIONS.ur[key], /[؀-ۿ]/u, `ur value lacks Urdu script: ${key}`);
  }
});

test('wiring: dialog, dashboard button and controller seams exist; CSS is token-only', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['fieldBagModal', 'fieldBagCloseBtn', 'fieldBagReconList', 'fieldBagIssueForm', 'fieldBagReturnForm', 'fieldBagLogList', 'fieldBagSummaryLine', 'openFieldBagModalBtn', 'fieldBagSummary']) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  const dialogStart = html.indexOf('id="fieldBagModal"');
  const closeBtnAt = html.indexOf('id="fieldBagCloseBtn"');
  assert.ok(dialogStart > -1 && closeBtnAt > dialogStart, 'close button inside the dialog');
  const closeTag = html.slice(html.lastIndexOf('<button', closeBtnAt), html.indexOf('>', closeBtnAt) + 1);
  assert.ok(closeTag.includes('modal-close'), 'shared close class');
  assert.ok(html.slice(closeBtnAt, closeBtnAt + 140).includes('↩'), 'shared close glyph');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './field-bag-stock.js'"), 'app.js imports the module');
  assert.ok(app.includes('setupFieldBagModal'), 'controller wired');
  assert.ok(app.includes('recordFieldBagStockBridge'), 'bridge host wired');
  assert.ok(app.includes('fieldBagMovements: loadFieldBagMovements()'), 'backup extras wired');
  assert.ok(app.includes('saveFieldBagMovements(pendingBackupPreview.fieldBagMovements)'), 'restore apply wired');

  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const blockStart = css.indexOf('/* SISP-127');
  const block = css.slice(blockStart, css.indexOf('/* SISP-7', blockStart));
  assert.ok(block.length > 200, 'field bag CSS block present');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hex colours in the SISP-127 CSS block');
  assert.ok(block.includes('var(--modal-surface)') || block.includes('var(--surface)'), 'theme tokens used');
});
