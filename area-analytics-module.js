/*
 * Area & Mohalla Analytics compact module — pure view helpers for the
 * unified module (three pill tabs, dues filter chips, Top-5 slice,
 * jump-to-mohalla list). Every function here is pure: same inputs,
 * same outputs, nothing read or written outside the return value.
 * No storage, no clock, no page, no network, no other module is
 * touched. The renderers that consume these helpers live in the
 * dashboard render; the money figures themselves still come from
 * the allocation engine through the existing per-mohalla summaries,
 * never recomputed here. A mohalla with nothing owed is "cleared"
 * when its still-due figure is exactly zero — a mohalla can be
 * fully paid for the current month while still owing older arrears,
 * and that money must keep it out of the cleared list.
 */

export const AREA_MODULE_TOP_N = 5;
export const AREA_MODULE_CHIPS = Object.freeze(['pending', 'cleared', 'all']);
export const AREA_MODULE_TABS = Object.freeze(['progress', 'cards', 'planner']);

/**
 * Whether a mohalla row belongs under a filter chip, from its
 * still-due figure in integer cents. 'pending' shows only mohallas
 * that still owe something; 'cleared' shows only mohallas at
 * exactly zero still due; 'all' shows every row. An unknown chip
 * behaves like 'all' rather than hiding everything.
 *
 * @param {number} stillDueCents - Still-due figure in integer cents
 * @param {string} chip - 'pending' | 'cleared' | 'all'
 * @returns {boolean}
 */
export function areaChipMatches(stillDueCents, chip) {
  const due = Number(stillDueCents) || 0;
  if (chip === 'pending') return due > 0;
  if (chip === 'cleared') return due === 0;
  return true;
}

/**
 * Rows sorted by still-due figure, highest first. The sort is
 * stable, so rows that owe the same amount keep the order they
 * arrived in (the numbered mohalla order for the bars rows, the
 * numbered-then-count order for the card rows). The input array
 * is never mutated — a sorted copy is returned.
 *
 * @param {Array} rows - Row objects
 * @param {Function} dueOf - (row) => still-due figure in cents
 * @returns {Array} Sorted copy, highest still-due first
 */
export function sortAreaRowsByDueDesc(rows, dueOf) {
  const list = Array.isArray(rows) ? [...rows] : [];
  return list.sort((a, b) => (Number(dueOf(b)) || 0) - (Number(dueOf(a)) || 0));
}

/**
 * The Top-N slice of a filtered list. Collapsed, only the first
 * AREA_MODULE_TOP_N rows show; expanded, the whole filtered list
 * shows. The input array is never mutated.
 *
 * @param {Array} rows - Already-filtered rows
 * @param {boolean} expanded - Show-all state
 * @param {number} [topN] - How many rows the collapsed view shows
 * @returns {Array}
 */
export function sliceAreaRows(rows, expanded, topN = AREA_MODULE_TOP_N) {
  const list = Array.isArray(rows) ? rows : [];
  return expanded ? [...list] : list.slice(0, topN);
}

/**
 * The jump-to-mohalla options: every mohalla in the caller's order
 * (the fixed numbered order, all sixteen), with the unassigned row
 * moved last and always present, so the jump control can reach a
 * mohalla the active chip is hiding. The option values are the
 * canonical keys, which is also what the rendered rows and cards
 * carry for the scroll target. A mohalla with no customers has no
 * row or card to scroll to — picking it is a graceful no-op.
 *
 * @param {Array<{key: string, label: string}>} mohallas - Mohallas in display order
 * @returns {Array<{key: string, label: string}>}
 */
export function buildAreaJumpOptions(mohallas) {
  const list = Array.isArray(mohallas) ? mohallas : [];
  const options = list
    .filter((entry) => entry && entry.key !== '__unassigned__')
    .map((entry) => ({ key: entry.key, label: entry.label }));
  options.push({ key: '__unassigned__', label: 'Unassigned' });
  return options;
}
