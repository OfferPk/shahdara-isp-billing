// Plan 136 (Plan 101-202) — Spare-parts reorder from stock levels.
//
// A needed spare runs out mid-fault because reorder is only
// remembered, never triggered by a level. This module is that
// trigger: one reorder rule per part with a minimum level, a
// reorder quantity, and a status of ok, low, or ordered. A part
// whose hand-counted level is at or below its minimum appears on
// the low-stock list, and marking it ordered clears the flag.
//
// What this module is NOT, stated plainly:
//   - It is not the stock register (stock-register.js), the shop
//     field-bag stock (field-bag-stock.js), or the inventory book
//     (inventory-book.js). No stock count is read or written
//     here: the level on a rule is the operator's own hand count
//     of the shelf, recorded on the rule itself, and marking a
//     part ordered never changes any count anywhere. Counts move
//     only through the normal stock-issue path.
//   - It is not the Plan 132 fault parts-used log
//     (fault-parts.js), which records what a fixed fault actually
//     consumed. No parts-used entry is read or written here, and
//     a reorder rule never becomes a parts-used entry.
//   - It is not an order, a message, or a charge. Marking a part
//     ordered records only that the operator has placed the order
//     elsewhere: it places no order, sends no message, and creates
//     no bill, payment, or cost figure of any kind.
//   - It is not a second copy of any ticket, vendor, or supplier
//     record. A rule names a part only; no ticket, vendor, or
//     supplier is linked, read, or written here.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every rule,
//     and the module never reads storage, the clock, or the
//     network, never imports another module, and never mutates an
//     input. Every function returns a new list or new rows.
//   - Half-formed rules are refused outright, never stored
//     half-formed: a rule needs an id, a part name, a minimum
//     level of zero or more, a reorder quantity above zero, and
//     a level on hand of zero or more. Unknown fields are
//     dropped, so a rule can never grow an order, message, stock
//     movement, bill, or payment field.
//   - One rule per part: a second rule for the same part name
//     (compared case-insensitively, ignoring surrounding spaces)
//     is refused outright, under any id.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later changes are removal and marking ordered.
//   - Status is derived, never stored as a free choice: a rule
//     marked ordered reads ordered; otherwise it reads low when
//     its level on hand is at or below its minimum, and ok when
//     it is above. Marking ordered clears the low flag without
//     touching the level on hand, and the flag stays cleared
//     until the rule is removed and re-added.

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function wholeNumber(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/** One reorder rule, or null when half-formed. Unknown fields are dropped. */
export function normalizeSpareReorder(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const id = cleanText(record.id);
  const part = cleanText(record.part);
  const minimumLevel = wholeNumber(record.minimumLevel);
  const reorderQuantity = wholeNumber(record.reorderQuantity);
  const onHand = wholeNumber(record.onHand);
  if (!id || !part) return null;
  if (minimumLevel === null || minimumLevel < 0) return null;
  if (reorderQuantity === null || reorderQuantity < 1) return null;
  if (onHand === null || onHand < 0) return null;
  return {
    id,
    part,
    minimumLevel,
    reorderQuantity,
    onHand,
    ordered: record.ordered === true,
  };
}

/** A list of valid rules only, in the order given. */
export function normalizeSpareReorderList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const rule = normalizeSpareReorder(item);
    if (rule) out.push(rule);
  }
  return out;
}

/** Find one rule by id, or null. */
export function findSpareReorder(list, id) {
  const key = cleanText(id);
  if (!key) return null;
  return normalizeSpareReorderList(list).find((rule) => rule.id === key) ?? null;
}

/**
 * Add a rule. An identical re-save leaves the list unchanged; a
 * re-save with different figures, or a second rule for the same
 * part under another id, is refused and the list is returned
 * unchanged.
 */
export function upsertSpareReorder(list, record) {
  const base = normalizeSpareReorderList(list);
  const rule = normalizeSpareReorder(record);
  if (!rule) return base;
  const sameId = base.find((item) => item.id === rule.id);
  if (sameId) {
    // An identical re-save leaves the list unchanged, and a
    // re-save with different figures is refused outright: there
    // is no edit, so either way the stored rule stands.
    return base;
  }
  const samePart = base.find((item) => item.part.toLowerCase() === rule.part.toLowerCase());
  if (samePart) return base;
  return [...base, rule];
}

/** Remove one rule by id; an unknown id leaves the list unchanged. */
export function removeSpareReorder(list, id) {
  const base = normalizeSpareReorderList(list);
  const key = cleanText(id);
  if (!key) return base;
  return base.filter((rule) => rule.id !== key);
}

/** Derived status: 'ordered', 'low', or 'ok'. */
export function spareReorderStatus(rule) {
  const clean = normalizeSpareReorder(rule);
  if (!clean) return null;
  if (clean.ordered) return 'ordered';
  return clean.onHand <= clean.minimumLevel ? 'low' : 'ok';
}

/** Rules at or below their minimum, part A-Z, ordered rules excluded. */
export function lowSpareReorders(list) {
  return normalizeSpareReorderList(list)
    .filter((rule) => spareReorderStatus(rule) === 'low')
    .sort((a, b) => a.part.toLowerCase().localeCompare(b.part.toLowerCase()));
}

/**
 * Mark one rule ordered. The low flag clears and the level on
 * hand is left exactly as it was; no stock count moves. An
 * unknown id leaves the list unchanged. There is no unmark:
 * a rule that needs flagging again is removed and re-added.
 */
export function markSpareOrdered(list, id) {
  const base = normalizeSpareReorderList(list);
  const key = cleanText(id);
  if (!key) return base;
  return base.map((rule) => (rule.id === key ? { ...rule, ordered: true } : rule));
}

/** Counts of rules by status. */
export function spareReorderCounts(list) {
  const base = normalizeSpareReorderList(list);
  const counts = { rules: base.length, ok: 0, low: 0, ordered: 0 };
  for (const rule of base) counts[spareReorderStatus(rule)] += 1;
  return counts;
}

/** One-line summary of the rules. */
export function spareReorderSummaryText(list) {
  const counts = spareReorderCounts(list);
  if (counts.rules === 0) return 'No spare reorder rule recorded yet.';
  return `${counts.rules} reorder rule${counts.rules === 1 ? '' : 's'}: ${counts.low} low, ${counts.ordered} ordered, ${counts.ok} ok.`;
}

/** The low-stock list, then every rule with its status. */
export function spareReorderHtml(list) {
  const base = normalizeSpareReorderList(list);
  if (base.length === 0) return '<p>No spare reorder rule recorded yet.</p>';
  const low = lowSpareReorders(base);
  const lowHeading = low.length === 0
    ? '<p>No part is at or below its minimum level.</p>'
    : `<p>Low stock — reorder these first:</p><table><thead><tr><th>Part</th><th>On hand</th><th>Minimum</th><th>Reorder qty</th></tr></thead><tbody>${low.map((rule) => `<tr><td>${escapeHtml(rule.part)}</td><td>${rule.onHand}</td><td>${rule.minimumLevel}</td><td>${rule.reorderQuantity}</td></tr>`).join('')}</tbody></table>`;
  const allRows = [...base]
    .sort((a, b) => a.part.toLowerCase().localeCompare(b.part.toLowerCase()))
    .map((rule) => `<tr><td>${escapeHtml(rule.id)}</td><td>${escapeHtml(rule.part)}</td><td>${rule.onHand}</td><td>${rule.minimumLevel}</td><td>${rule.reorderQuantity}</td><td>${spareReorderStatus(rule)}</td></tr>`)
    .join('');
  return `${lowHeading}<h4>All reorder rules</h4><table><thead><tr><th>Id</th><th>Part</th><th>On hand</th><th>Minimum</th><th>Reorder qty</th><th>Status</th></tr></thead><tbody>${allRows}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of rules. */
export function spareReorderCsv(list) {
  const base = normalizeSpareReorderList(list);
  const header = 'id,part,on_hand,minimum_level,reorder_quantity,status';
  const rows = base.map((rule) => [rule.id, rule.part, rule.onHand, rule.minimumLevel, rule.reorderQuantity, spareReorderStatus(rule)].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

/** CSV filename for the rules. */
export function spareReorderFilename() {
  return 'spare-reorder.csv';
}
