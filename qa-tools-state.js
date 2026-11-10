/* QA tools filter state (profile redesign, Step 5): the device-only
 * UI state for the Technical QA box — recent tools, favourite tools,
 * and the search + chip filter. Pure: no storage, no DOM, no network,
 * no clock. The caller owns the localStorage reads/writes under the
 * two keys below; this module only normalises lists and decides which
 * tools match. Inputs are never mutated.
 *
 * Store keys (parent decision D3, approved 2026-11-10): the recent
 * list is capped at 8 tool ids (most recent first); favourites have
 * no cap. Both are UI state only — they never touch a customer, bill,
 * payment, or QA record. The Recent row shows at most 4 tools. */

export const QA_RECENT_STORE_KEY = 'shahdara_qa_recent_tools_v1';
export const QA_RECENT_MAX = 8;
export const QA_FAVORITE_STORE_KEY = 'shahdara_qa_favorite_tools_v1';
export const QA_RECENT_ROW_MAX = 4;

// The six QA filter chips (parent decision D-T5): All plus one chip
// per tool group. A tool's group is its data-qa-group in the grid.
export const QA_TOOL_GROUPS = Object.freeze(['all', 'optical', 'otdr', 'splicing', 'safety', 'service']);

function cleanQaToolId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Normalise a stored id list: non-empty strings only, first occurrence
// wins, capped at `max` (no cap when max is not a positive number).
export function normalizeQaToolIdList(raw, max) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const id = cleanQaToolId(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (typeof max === 'number' && max > 0 && out.length >= max) break;
  }
  return out;
}

// Record a tool as most recently used: newest first, capped at 8.
export function recordQaRecentTool(list, toolId) {
  const id = cleanQaToolId(toolId);
  if (!id) return normalizeQaToolIdList(list, QA_RECENT_MAX);
  return normalizeQaToolIdList([id, ...normalizeQaToolIdList(list, QA_RECENT_MAX)], QA_RECENT_MAX);
}

// Toggle a tool's favourite state: favouriting pins it first in the
// list; un-favouriting removes it. Order otherwise preserved.
export function toggleQaFavoriteTool(list, toolId) {
  const id = cleanQaToolId(toolId);
  if (!id) return normalizeQaToolIdList(list);
  const current = normalizeQaToolIdList(list);
  if (current.includes(id)) return current.filter((entry) => entry !== id);
  return [id, ...current];
}

function cleanQaToolText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// Does one tool match the current search + chip? The query is a
// substring match on the tool's label + title description; the chip
// is an exact group match ('all' passes every group).
export function qaToolMatches(tool, query, chip) {
  if (!tool || typeof tool !== 'object') return false;
  const group = cleanQaToolText(tool.group);
  if (chip && chip !== 'all' && group !== cleanQaToolText(chip)) return false;
  const needle = cleanQaToolText(query);
  if (!needle) return true;
  const haystack = `${cleanQaToolText(tool.label)} ${cleanQaToolText(tool.title)}`;
  return haystack.includes(needle);
}

// The ids of the tools that stay visible under the current search +
// chip, in grid order.
export function qaVisibleToolIds(tools, query, chip) {
  if (!Array.isArray(tools)) return [];
  const out = [];
  for (const tool of tools) {
    if (qaToolMatches(tool, query, chip)) out.push(tool.id);
  }
  return out;
}

// Resolve a stored id list to the live tools, in list order, skipping
// ids that no longer have a button in the grid; capped at `max`.
export function qaRowTools(ids, tools, max) {
  if (!Array.isArray(tools)) return [];
  const byId = new Map();
  for (const tool of tools) {
    if (tool && typeof tool === 'object' && tool.id && !byId.has(tool.id)) byId.set(tool.id, tool);
  }
  const out = [];
  for (const id of normalizeQaToolIdList(ids)) {
    const tool = byId.get(id);
    if (!tool) continue;
    out.push(tool);
    if (typeof max === 'number' && max > 0 && out.length >= max) break;
  }
  return out;
}
