// Plan 51 (Plan 1-100) — Spare equipment and consumables stock register
// with low-stock signals.
//
// When a unit fails or a drop cable is cut, nobody should have to
// guess whether a spare is actually on the shelf: this register is
// the one visible list of what is on hand, where it sits, what has
// been issued to a job, and what came back faulty.
//
// Scope fence, stated plainly against the neighbouring systems:
//   - This is a STOCK COUNT, not a purchase or billing record. The
//     module holds no price, bill, payment, ticket, or customer-bill
//     field, so no stock action can change one. It never touches
//     the Plan 17 connection register (which records which unit is
//     installed at which customer), ticket money, or any bill.
//   - This is NOT the SISP-18 inventory book and NOT the SISP-127
//     field bag, checked first: SISP-18 derives one available count
//     per fixed catalogue item from a movement log with fixed
//     thresholds, and the field bag tracks bag movements tied to
//     tickets. Neither of them splits stock by location (shop vs
//     field kit), lets the operator set a minimum per item, names
//     the job or customer an item was issued to, or keeps a
//     repair/returned state for faulty units. Those four things are
//     exactly what this register adds, and neither SISP store is
//     read or written here — this register keeps its own store.
//   - A faulty unit that comes back NEVER goes back to good stock:
//     it moves from issued to in-repair, so the on-hand count can
//     never be flattered by a broken unit sitting on the shelf.
//
// How the fence is kept in this module:
//   - It is import-free: the caller supplies every row and every
//     movement, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - Counts are whole units only. A negative, fractional, or
//     non-finite count is refused outright, never stored as zero.
//   - An impossible date (2026-02-30) is refused outright, never
//     stored as a neighbouring date; a blank date becomes null
//     ("date not recorded") and sorts last, never a guessed date.
//   - Issuing needs a named job or customer: an unnamed issue is
//     refused with both lists unchanged, so the movement history
//     always says where the item went.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const STOCK_ITEM_TYPES = [
  'onu',
  'router',
  'splitter',
  'patch_cord',
  'drop_cable',
  'connector',
  'power_adapter',
];

export const STOCK_ITEM_LABELS = {
  onu: 'ONU',
  router: 'Router',
  splitter: 'Splitter',
  patch_cord: 'Patch cord',
  drop_cable: 'Drop cable',
  connector: 'Connector',
  power_adapter: 'Power adapter',
};

export const STOCK_LOCATIONS = ['shop', 'field_kit'];

export const STOCK_LOCATION_LABELS = {
  shop: 'Shop',
  field_kit: 'Field kit',
};

export const STOCK_MOVEMENT_KINDS = ['receive', 'issue', 'return_faulty'];

export const STOCK_MOVEMENT_LABELS = {
  receive: 'Received',
  issue: 'Issued',
  return_faulty: 'Returned faulty',
};

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// A real calendar date, or null. Blank stays null; an impossible
// date (2026-02-30) is refused, never repaired to a neighbour.
export function validStockDate(value) {
  const text = cleanText(value);
  if (!text) return null;
  if (!DATE_RE.test(text)) return null;
  const [y, m, d] = text.split('-').map(Number);
  const built = new Date(Date.UTC(y, m - 1, d));
  if (
    built.getUTCFullYear() !== y ||
    built.getUTCMonth() !== m - 1 ||
    built.getUTCDate() !== d
  ) {
    return null;
  }
  return text;
}

function validStockCount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

function validPositiveCount(value) {
  const count = validStockCount(value);
  return count !== null && count > 0 ? count : null;
}

// Item types from the plan, with the spellings an operator types
// ("patch cord", "drop cable", "power adapter") folded to the key.
// Anything outside the seven is not a stock item: null, never a
// guessed type.
export function normalizeStockItemType(value) {
  const key = cleanText(value).toLowerCase().replace(/[\s-]+/g, '_');
  return STOCK_ITEM_TYPES.includes(key) ? key : null;
}

// Locations from the plan: shop or field kit. "field" alone means
// the field kit; anything else is not a location: null.
export function normalizeStockLocation(value) {
  const key = cleanText(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (key === 'shop') return 'shop';
  if (key === 'field_kit' || key === 'fieldkit' || key === 'field') return 'field_kit';
  return null;
}

export function stockRowKey(item, location) {
  return `${item}|${location}`;
}

// One row per (item, location). Counts default to 0; a missing
// minimum stays null ("not set") so an unset minimum can never
// look like a zero minimum. A row with an unknown item, an unknown
// location, or a negative/fractional count is not a row: null.
export function normalizeStockRow(row) {
  if (!row || typeof row !== 'object') return null;
  const item = normalizeStockItemType(row.item);
  const location = normalizeStockLocation(row.location);
  if (!item || !location) return null;
  const onHand = row.onHand === undefined ? 0 : validStockCount(row.onHand);
  const issued = row.issued === undefined ? 0 : validStockCount(row.issued);
  const inRepair = row.inRepair === undefined ? 0 : validStockCount(row.inRepair);
  if (onHand === null || issued === null || inRepair === null) return null;
  const minimum =
    row.minimum === undefined || row.minimum === null || row.minimum === ''
      ? null
      : validStockCount(row.minimum);
  if (minimum === null && row.minimum !== undefined && row.minimum !== null && row.minimum !== '') return null;
  return {
    item,
    location,
    onHand,
    issued,
    inRepair,
    minimum,
    note: cleanText(row.note) || null,
  };
}

export function normalizeStockRowList(rows) {
  if (!Array.isArray(rows)) return [];
  const byKey = new Map();
  for (const row of rows) {
    const clean = normalizeStockRow(row);
    if (clean) byKey.set(stockRowKey(clean.item, clean.location), clean);
  }
  return [...byKey.values()];
}

export function findStockRow(rows, item, location) {
  const key = stockRowKey(item, location);
  return normalizeStockRowList(rows).find((r) => stockRowKey(r.item, r.location) === key) || null;
}

// Last write wins per (item, location); the list is never mutated.
export function upsertStockRow(rows, row) {
  const clean = normalizeStockRow(row);
  if (!clean) return normalizeStockRowList(rows);
  const list = normalizeStockRowList(rows).filter(
    (r) => stockRowKey(r.item, r.location) !== stockRowKey(clean.item, clean.location),
  );
  list.push(clean);
  return list;
}

export function removeStockRow(rows, item, location) {
  const key = stockRowKey(item, location);
  return normalizeStockRowList(rows).filter((r) => stockRowKey(r.item, r.location) !== key);
}

// The operator-set minimum for one (item, location). A negative or
// fractional minimum is refused with the list unchanged; a missing
// row is created with zero counts so the minimum has somewhere to
// live. Returns { rows, applied }.
export function setStockMinimum(rows, item, location, minimum) {
  const cleanItem = normalizeStockItemType(item);
  const cleanLocation = normalizeStockLocation(location);
  const cleanMinimum = validStockCount(minimum);
  if (!cleanItem || !cleanLocation || cleanMinimum === null) {
    return { rows: normalizeStockRowList(rows), applied: false };
  }
  const existing = findStockRow(rows, cleanItem, cleanLocation) || {
    item: cleanItem,
    location: cleanLocation,
    onHand: 0,
    issued: 0,
    inRepair: 0,
    minimum: null,
    note: null,
  };
  return {
    rows: upsertStockRow(rows, { ...existing, minimum: cleanMinimum }),
    applied: true,
  };
}

// Movement history: one entry per receive / issue / faulty return.
// An impossible date is refused; a blank date stays null.
export function normalizeStockMovement(movement) {
  if (!movement || typeof movement !== 'object') return null;
  const item = normalizeStockItemType(movement.item);
  const location = normalizeStockLocation(movement.location);
  if (!item || !location) return null;
  if (!STOCK_MOVEMENT_KINDS.includes(movement.kind)) return null;
  const qty = validPositiveCount(movement.qty);
  if (qty === null) return null;
  const date = movement.date === undefined || movement.date === null || movement.date === ''
    ? null
    : validStockDate(movement.date);
  if (date === null && movement.date !== undefined && movement.date !== null && movement.date !== '') return null;
  return {
    id: cleanText(movement.id) || null,
    date,
    kind: movement.kind,
    item,
    location,
    qty,
    target: cleanText(movement.target) || null,
    note: cleanText(movement.note) || null,
  };
}

export function normalizeStockMovementList(movements) {
  if (!Array.isArray(movements)) return [];
  const seen = new Set();
  const out = [];
  for (const movement of movements) {
    const clean = normalizeStockMovement(movement);
    if (!clean) continue;
    if (clean.id && seen.has(clean.id)) continue;
    if (clean.id) seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

function sortMovements(movements) {
  return [...movements].sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

// Shared movement applier: validates the shape once, then lets the
// caller move the counts. Any refusal leaves both lists unchanged.
function applyStockMovement(rows, movements, input, move) {
  const cleanItem = normalizeStockItemType(input.item);
  const cleanLocation = normalizeStockLocation(input.location);
  const qty = validPositiveCount(input.qty);
  if (!cleanItem || !cleanLocation || qty === null) {
    return { rows: normalizeStockRowList(rows), movements: normalizeStockMovementList(movements), applied: false };
  }
  const date = input.date === undefined || input.date === null || input.date === ''
    ? null
    : validStockDate(input.date);
  if (date === null && input.date !== undefined && input.date !== null && input.date !== '') {
    return { rows: normalizeStockRowList(rows), movements: normalizeStockMovementList(movements), applied: false };
  }
  const cleanRows = normalizeStockRowList(rows);
  const existing = cleanRows.find(
    (r) => r.item === cleanItem && r.location === cleanLocation,
  ) || {
    item: cleanItem,
    location: cleanLocation,
    onHand: 0,
    issued: 0,
    inRepair: 0,
    minimum: null,
    note: null,
  };
  const moved = move(existing, qty);
  if (!moved) {
    return { rows: cleanRows, movements: normalizeStockMovementList(movements), applied: false };
  }
  const cleanMovements = normalizeStockMovementList(movements);
  cleanMovements.push({
    id: cleanText(input.id) || `stock-${Date.now()}-${cleanMovements.length + 1}`,
    date,
    kind: input.kind,
    item: cleanItem,
    location: cleanLocation,
    qty,
    target: cleanText(input.target) || null,
    note: cleanText(input.note) || null,
  });
  return { rows: upsertStockRow(cleanRows, moved), movements: cleanMovements, applied: true };
}

// Receiving adds to good stock. A row is created when needed.
export function receiveStock(rows, movements, input) {
  return applyStockMovement(rows, movements, { ...input, kind: 'receive' }, (row, qty) => ({
    ...row,
    onHand: row.onHand + qty,
  }));
}

// Issuing to a named job or customer: good stock falls, issued
// rises, and the movement names where it went. An unnamed issue,
// or an issue larger than what is on hand, is refused outright.
export function issueStock(rows, movements, input) {
  if (!cleanText(input.target)) {
    return { rows: normalizeStockRowList(rows), movements: normalizeStockMovementList(movements), applied: false };
  }
  return applyStockMovement(rows, movements, { ...input, kind: 'issue' }, (row, qty) => {
    if (row.onHand < qty) return null;
    return { ...row, onHand: row.onHand - qty, issued: row.issued + qty };
  });
}

// A faulty unit comes back: issued falls, in-repair rises, and good
// stock is untouched — a broken unit never counts as on hand.
// Returning more than is out is refused outright.
export function returnFaultyStock(rows, movements, input) {
  return applyStockMovement(rows, movements, { ...input, kind: 'return_faulty' }, (row, qty) => {
    if (row.issued < qty) return null;
    return { ...row, issued: row.issued - qty, inRepair: row.inRepair + qty };
  });
}

// On hand + issued + in repair: every unit ever received, accounted
// for exactly once. No unit is double-counted or lost.
export function stockRowTotal(row) {
  const clean = normalizeStockRow(row);
  if (!clean) return null;
  return clean.onHand + clean.issued + clean.inRepair;
}

// Low-stock signals: on hand strictly below the operator-set
// minimum (at the minimum is fine, not a signal). Largest shortfall
// first, then item name, then location. A row with no minimum set
// never signals — an unset minimum is not a zero minimum.
export function lowStockSignals(rows) {
  return normalizeStockRowList(rows)
    .filter((r) => r.minimum !== null && r.onHand < r.minimum)
    .map((r) => ({
      item: r.item,
      location: r.location,
      onHand: r.onHand,
      minimum: r.minimum,
      shortfall: r.minimum - r.onHand,
    }))
    .sort((a, b) =>
      b.shortfall - a.shortfall ||
      STOCK_ITEM_LABELS[a.item].localeCompare(STOCK_ITEM_LABELS[b.item]) ||
      STOCK_LOCATION_LABELS[a.location].localeCompare(STOCK_LOCATION_LABELS[b.location]),
    );
}

export function stockItemTotals(rows) {
  const totals = {};
  for (const row of normalizeStockRowList(rows)) {
    totals[row.item] = totals[row.item] || { onHand: 0, issued: 0, inRepair: 0, total: 0 };
    totals[row.item].onHand += row.onHand;
    totals[row.item].issued += row.issued;
    totals[row.item].inRepair += row.inRepair;
    totals[row.item].total += row.onHand + row.issued + row.inRepair;
  }
  return totals;
}

export function stockSummaryText(rows, movements) {
  const cleanRows = normalizeStockRowList(rows);
  const cleanMovements = normalizeStockMovementList(movements);
  const onHand = cleanRows.reduce((sum, r) => sum + r.onHand, 0);
  const issued = cleanRows.reduce((sum, r) => sum + r.issued, 0);
  const inRepair = cleanRows.reduce((sum, r) => sum + r.inRepair, 0);
  const low = lowStockSignals(cleanRows).length;
  return `${cleanRows.length} stock rows, ${onHand} on hand, ${issued} issued, ${inRepair} in repair, ${low} low-stock signal${low === 1 ? '' : 's'}, ${cleanMovements.length} movement${cleanMovements.length === 1 ? '' : 's'} recorded.`;
}

export function stockRowsHtml(rows) {
  const cleanRows = normalizeStockRowList(rows);
  if (!cleanRows.length) return '<p>No stock rows yet.</p>';
  const lowKeys = new Set(lowStockSignals(cleanRows).map((s) => stockRowKey(s.item, s.location)));
  const body = cleanRows
    .slice()
    .sort((a, b) =>
      STOCK_ITEM_LABELS[a.item].localeCompare(STOCK_ITEM_LABELS[b.item]) ||
      STOCK_LOCATION_LABELS[a.location].localeCompare(STOCK_LOCATION_LABELS[b.location]),
    )
    .map((r) => {
      const low = lowKeys.has(stockRowKey(r.item, r.location));
      return `<tr><td>${escapeHtml(STOCK_ITEM_LABELS[r.item])}</td><td>${escapeHtml(STOCK_LOCATION_LABELS[r.location])}</td><td>${r.onHand}</td><td>${r.issued}</td><td>${r.inRepair}</td><td>${r.onHand + r.issued + r.inRepair}</td><td>${r.minimum === null ? 'Not set' : r.minimum}</td><td>${low ? `Low stock — short ${r.minimum - r.onHand}` : 'OK'}</td></tr>`;
    })
    .join('');
  return `<table><thead><tr><th>Item</th><th>Location</th><th>On hand</th><th>Issued</th><th>In repair</th><th>Total</th><th>Minimum</th><th>Signal</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function stockMovementsHtml(movements) {
  const clean = sortMovements(normalizeStockMovementList(movements));
  if (!clean.length) return '<p>No stock movements yet.</p>';
  const body = clean
    .map((m) => `<tr><td>${escapeHtml(m.date || 'Date not recorded')}</td><td>${escapeHtml(STOCK_MOVEMENT_LABELS[m.kind])}</td><td>${escapeHtml(STOCK_ITEM_LABELS[m.item])}</td><td>${escapeHtml(STOCK_LOCATION_LABELS[m.location])}</td><td>${m.qty}</td><td>${escapeHtml(m.target || '—')}</td><td>${escapeHtml(m.note || '')}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Date</th><th>Movement</th><th>Item</th><th>Location</th><th>Qty</th><th>Job / customer</th><th>Note</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function stockCsv(rows) {
  const cleanRows = normalizeStockRowList(rows);
  const lines = ['Item,Location,On hand,Issued,In repair,Total,Minimum,Signal'];
  for (const r of cleanRows) {
    const low = r.minimum !== null && r.onHand < r.minimum;
    lines.push([
      csvCell(STOCK_ITEM_LABELS[r.item]),
      csvCell(STOCK_LOCATION_LABELS[r.location]),
      r.onHand,
      r.issued,
      r.inRepair,
      r.onHand + r.issued + r.inRepair,
      r.minimum === null ? '' : r.minimum,
      csvCell(low ? `Low stock — short ${r.minimum - r.onHand}` : 'OK'),
    ].join(','));
  }
  return lines.join('\n');
}

export function stockFilename(date) {
  const safe = validStockDate(date) || 'stock';
  return `stock-register-${safe}.csv`;
}
