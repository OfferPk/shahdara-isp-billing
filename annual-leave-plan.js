// Plan 313 (Plan 203-350) — Annual leave planner.
//
// Leave planned across the year is agreed one person at a
// time, so two key staff end up away in the same week and
// cover collapses. This module adds only the missing piece:
// one annual leave plan per staff member per year — the
// staff member, the year, the planned leave blocks, and
// the status — so the year's plans can be read side by
// side and clashes are visible before the year starts.
//
// What this module is NOT, stated plainly:
//   - It is not the staff leave record, which records
//     leave actually taken or approved. That record
//     already exists and is neither read nor rewritten
//     here; a plan here is only a plan for the year
//     ahead, and planning leave never counts as leave
//     taken.
//   - It is not the duty roster, which posts who is on
//     duty each day. That roster already exists and is
//     neither read nor rewritten here; a planned block
//     never puts anyone on or off duty by itself.
//   - It is not the absence handover checklist, which
//     covers what is handed over before one absence.
//     That checklist already exists and is neither read
//     nor rewritten here; a plan names blocks only, and
//     no handover is created or changed by planning.
//   - It is not the owner absence cover roster, which
//     covers the owner being away. That roster already
//     exists and is neither read nor rewritten here; a
//     staff plan never changes owner cover.
//   - It is not a bill, payment, customer record, or
//     duty roster change. Planning leave never changes
//     any bill, payment, customer record, or duty roster
//     by itself.
//   - It is not an editable record. A past plan is never
//     silently edited: there is no edit function, only
//     record, find, remove, and changing the status of
//     one plan; a wrong plan is removed and recorded
//     again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every plan, and the module never reads storage,
//     the clock, or the network, and never mutates an
//     input.
//   - A plan with no id, no staff member, no usable
//     year, no planned blocks, or an unknown status is
//     refused outright. Every block needs two strict
//     dates inside the plan year, the end on or after
//     the start, and blocks that overlap each other
//     inside one plan are refused. Unknown fields are
//     dropped, so a plan can never grow a bill, payment,
//     customer, or roster field.
//   - One plan per staff member per year: a second plan
//     for the same staff member in the same year is
//     refused, and the first plan always stays.
//   - A clash is only a clash between two different
//     staff members whose planned blocks overlap in the
//     same year, and cancelled plans never clash.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const ANNUAL_LEAVE_PLAN_STATUSES = [
  'planned',
  'confirmed',
  'cancelled',
];

const STATUS_ALIASES = {
  planned: 'planned',
  draft: 'planned',
  proposed: 'planned',
  confirmed: 'confirmed',
  approved: 'confirmed',
  agreed: 'confirmed',
  cancelled: 'cancelled',
  'called off': 'cancelled',
  withdrawn: 'cancelled',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar day: YYYY-MM-DD that really exists, or false. */
export function validAnnualLeavePlanDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

function splitDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Ordinal day number inside its year, so block lengths use plain integer arithmetic. */
function dayOrdinal(value) {
  const parts = splitDay(value);
  if (!parts) return null;
  let ordinal = parts.day;
  for (let month = 1; month < parts.month; month += 1) {
    ordinal += month === 2 && isLeapYear(parts.year) ? 29 : DAYS_IN_MONTH[month - 1];
  }
  return ordinal;
}

/** Whole days in one block, counting both the first and the last day. */
export function annualLeavePlanDaysInBlock(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return 0;
  const start = text(block.start);
  const end = text(block.end);
  if (!validAnnualLeavePlanDay(start)) return 0;
  if (!validAnnualLeavePlanDay(end)) return 0;
  if (start > end) return 0;
  return dayOrdinal(end) - dayOrdinal(start) + 1;
}

/**
 * One status in canonical form — planned, confirmed, or
 * cancelled — or null when the value names none of them.
 * A missing status reads as planned.
 */
export function foldAnnualLeavePlanStatus(value) {
  const key = text(value).toLowerCase();
  if (!key) return 'planned';
  return STATUS_ALIASES[key] ?? null;
}

/** A plan year as an integer, accepting a digit string too, or null when unusable. */
export function foldAnnualLeavePlanYear(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d{4}$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * One planned leave block, or null when half-formed. A
 * block needs two strict dates, the end on or after the
 * start, and both dates inside the given plan year. The
 * note is optional plain words; unknown fields are
 * dropped and the input is never mutated.
 */
export function normalizeAnnualLeavePlanBlock(raw, year) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const start = text(raw.start);
  const end = text(raw.end);
  if (!validAnnualLeavePlanDay(start)) return null;
  if (!validAnnualLeavePlanDay(end)) return null;
  if (start > end) return null;
  const planYear = foldAnnualLeavePlanYear(year);
  if (planYear === null) return null;
  if (splitDay(start).year !== planYear) return null;
  if (splitDay(end).year !== planYear) return null;
  return { start, end, note: text(raw.note) };
}

/**
 * Planned blocks from plain text, or null when any part
 * is unusable. Parts are separated by commas, each part
 * is "YYYY-MM-DD to YYYY-MM-DD" or a single date, which
 * counts as a one-day block. The year is checked by the
 * caller when the blocks join a plan.
 */
export function parseAnnualLeavePlanBlocks(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const blocks = [];
  for (const part of parts) {
    const match = /^(\d{4}-\d{2}-\d{2})(?:\s+to\s+(\d{4}-\d{2}-\d{2}))?$/.exec(part);
    if (!match) return null;
    const start = match[1];
    const end = match[2] ?? match[1];
    if (!validAnnualLeavePlanDay(start)) return null;
    if (!validAnnualLeavePlanDay(end)) return null;
    if (start > end) return null;
    blocks.push({ start, end, note: '' });
  }
  return blocks;
}

function blocksOverlap(a, b) {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * One annual leave plan, or null when half-formed. A plan
 * needs an id, a staff member, a year from 2000 to 2100,
 * and at least one planned block inside that year, with
 * no two blocks overlapping each other. The status starts
 * planned when missing; unknown fields are dropped and
 * the input is never mutated.
 */
export function normalizeAnnualLeavePlan(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const staffMember = text(raw.staffMember);
  const year = foldAnnualLeavePlanYear(raw.year);
  const status = foldAnnualLeavePlanStatus(raw.status);
  if (!id) return null;
  if (!staffMember) return null;
  if (year === null || year < 2000 || year > 2100) return null;
  if (status === null) return null;
  if (!Array.isArray(raw.blocks) || !raw.blocks.length) return null;
  const blocks = [];
  for (const block of raw.blocks) {
    const clean = normalizeAnnualLeavePlanBlock(block, year);
    if (!clean) return null;
    blocks.push(clean);
  }
  blocks.sort((a, b) => (a.start !== b.start ? (a.start < b.start ? -1 : 1) : (a.end < b.end ? -1 : 1)));
  for (let i = 1; i < blocks.length; i += 1) {
    if (blocksOverlap(blocks[i - 1], blocks[i])) return null;
  }
  return { id, staffMember, year, blocks, status, note: text(raw.note) };
}

/** Normalised leave plans only; a duplicate id is never rewritten, the first stays. */
export function normalizeAnnualLeavePlanList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const plan = normalizeAnnualLeavePlan(raw);
    if (!plan || seen.has(plan.id)) continue;
    seen.add(plan.id);
    out.push(plan);
  }
  return out;
}

export function findAnnualLeavePlan(list, id) {
  const clean = normalizeAnnualLeavePlanList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((plan) => plan.id === wanted) ?? null;
}

/**
 * Record an annual leave plan. Refused when half-formed,
 * when its id is already recorded, or when the staff
 * member already has a plan for the same year — the first
 * plan with an id, and the first plan for a staff member
 * in a year, always stays.
 */
export function recordAnnualLeavePlan(list, raw) {
  const clean = normalizeAnnualLeavePlanList(list);
  const plan = normalizeAnnualLeavePlan(raw);
  if (!plan) return clean;
  if (clean.some((item) => item.id === plan.id)) return clean;
  if (clean.some((item) => item.year === plan.year && item.staffMember.toLowerCase() === plan.staffMember.toLowerCase())) return clean;
  return [...clean, plan];
}

export function removeAnnualLeavePlan(list, id) {
  const clean = normalizeAnnualLeavePlanList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((plan) => plan.id !== wanted);
}

/**
 * Change the status of one leave plan: planned, confirmed,
 * or cancelled. Refused when the plan is missing or the
 * status names nothing known — changing a status changes
 * only that one plan, never any bill, payment, customer
 * record, or duty roster.
 */
export function setAnnualLeavePlanStatus(list, id, status) {
  const clean = normalizeAnnualLeavePlanList(list);
  const wanted = text(id);
  const folded = foldAnnualLeavePlanStatus(status);
  if (!wanted || folded === null) return clean;
  return clean.map((plan) => (
    plan.id === wanted ? { ...plan, status: folded } : plan
  ));
}

function planOrder(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.staffMember.toLowerCase() !== b.staffMember.toLowerCase()) {
    return a.staffMember.toLowerCase() < b.staffMember.toLowerCase() ? -1 : 1;
  }
  return a.id < b.id ? -1 : 1;
}

/** Leave plans in year order, then staff member A-Z, so one year reads together. */
export function annualLeavePlanPlansSorted(list) {
  return normalizeAnnualLeavePlanList(list).sort(planOrder);
}

/** Leave plans for one year, staff member A-Z. */
export function annualLeavePlanPlansForYear(list, year) {
  const wanted = foldAnnualLeavePlanYear(year);
  if (wanted === null) return [];
  return annualLeavePlanPlansSorted(list).filter((plan) => plan.year === wanted);
}

/** Leave plans for one staff member, earliest year first, matching case-insensitively. */
export function annualLeavePlanPlansForStaff(list, staffMember) {
  const wanted = text(staffMember).toLowerCase();
  if (!wanted) return [];
  return annualLeavePlanPlansSorted(list)
    .filter((plan) => plan.staffMember.toLowerCase() === wanted);
}

/** Whole planned days in one plan, counting both ends of every block. */
export function annualLeavePlanTotalDays(plan) {
  const clean = normalizeAnnualLeavePlan(plan);
  if (!clean) return 0;
  return clean.blocks.reduce((total, block) => total + annualLeavePlanDaysInBlock(block), 0);
}

/** Staff members with a plan, in A-Z order, keeping the first spelling seen. */
export function annualLeavePlanStaffMembers(list) {
  const clean = normalizeAnnualLeavePlanList(list);
  const byLower = new Map();
  for (const plan of clean) {
    const key = plan.staffMember.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, plan.staffMember);
  }
  return [...byLower.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

/** Years with a plan, earliest first. */
export function annualLeavePlanYears(list) {
  const years = new Set(normalizeAnnualLeavePlanList(list).map((plan) => plan.year));
  return [...years].sort((a, b) => a - b);
}

/**
 * Clashes in one year: every pair of different staff
 * members whose planned blocks overlap, with the
 * overlapping dates. Cancelled plans never clash, and a
 * staff member never clashes with themselves. Each clash
 * names the two staff members, the overlap start and end,
 * and the overlap in whole days.
 */
export function annualLeavePlanClashes(list, year) {
  const wanted = foldAnnualLeavePlanYear(year);
  if (wanted === null) return [];
  const plans = annualLeavePlanPlansForYear(list, wanted)
    .filter((plan) => plan.status !== 'cancelled');
  const clashes = [];
  for (let i = 0; i < plans.length; i += 1) {
    for (let j = i + 1; j < plans.length; j += 1) {
      const first = plans[i];
      const second = plans[j];
      if (first.staffMember.toLowerCase() === second.staffMember.toLowerCase()) continue;
      for (const a of first.blocks) {
        for (const b of second.blocks) {
          if (!blocksOverlap(a, b)) continue;
          const start = a.start > b.start ? a.start : b.start;
          const end = a.end < b.end ? a.end : b.end;
          const ordered = [first.staffMember, second.staffMember]
            .sort((x, y) => (x.toLowerCase() < y.toLowerCase() ? -1 : 1));
          clashes.push({
            staffA: ordered[0],
            staffB: ordered[1],
            start,
            end,
            days: dayOrdinal(end) - dayOrdinal(start) + 1,
          });
        }
      }
    }
  }
  clashes.sort((a, b) => (
    a.start !== b.start ? (a.start < b.start ? -1 : 1)
      : a.staffA.toLowerCase() !== b.staffA.toLowerCase() ? (a.staffA.toLowerCase() < b.staffA.toLowerCase() ? -1 : 1)
        : (a.staffB.toLowerCase() < b.staffB.toLowerCase() ? -1 : 1)
  ));
  return clashes;
}

/** Plain-words summary: how many plans, staff, and planned days, and how many clashes. */
export function annualLeavePlanSummaryText(list, year) {
  const clean = normalizeAnnualLeavePlanList(list);
  if (!clean.length) return 'No annual leave plans recorded.';
  const scoped = year === undefined ? clean : annualLeavePlanPlansForYear(list, year);
  if (!scoped.length) return `No annual leave plans recorded for ${foldAnnualLeavePlanYear(year)}.`;
  const staff = new Set(scoped.map((plan) => plan.staffMember.toLowerCase())).size;
  const days = scoped.reduce((total, plan) => total + annualLeavePlanTotalDays(plan), 0);
  const planWord = scoped.length === 1 ? '1 plan' : `${scoped.length} plans`;
  const staffWord = staff === 1 ? '1 staff member' : `${staff} staff members`;
  const dayWord = days === 1 ? '1 planned day' : `${days} planned days`;
  const yearWord = year === undefined ? '' : ` for ${foldAnnualLeavePlanYear(year)}`;
  if (year === undefined) return `${planWord}, ${staffWord}, ${dayWord}.`;
  const clashes = annualLeavePlanClashes(list, year);
  const clashWord = clashes.length === 0 ? 'no clashes'
    : clashes.length === 1 ? '1 clash' : `${clashes.length} clashes`;
  return `${planWord}${yearWord}, ${staffWord}, ${dayWord}, ${clashWord}.`;
}

/** One line naming a plan, with its blocks, days, and status visible. */
export function annualLeavePlanPlanText(plan) {
  const clean = normalizeAnnualLeavePlan(plan);
  if (!clean) return '';
  const blocks = clean.blocks
    .map((block) => (block.start === block.end ? block.start : `${block.start} to ${block.end}`))
    .join(', ');
  const note = clean.note ? ` Note: ${clean.note}.` : '';
  return `${clean.staffMember}, ${clean.year}: ${blocks} (${annualLeavePlanTotalDays(clean)} days). Status: ${clean.status}.${note}`;
}

/** One clash in plain words. */
export function annualLeavePlanClashText(clash) {
  if (!clash || typeof clash !== 'object') return '';
  const staffA = text(clash.staffA);
  const staffB = text(clash.staffB);
  const start = text(clash.start);
  const end = text(clash.end);
  if (!staffA || !staffB || !validAnnualLeavePlanDay(start) || !validAnnualLeavePlanDay(end)) return '';
  const when = start === end ? start : `${start} to ${end}`;
  return `${staffA} and ${staffB} are both away ${when}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function annualLeavePlanPlanHtml(plan) {
  const clean = normalizeAnnualLeavePlan(plan);
  if (!clean) return '';
  return `<li>${escapeHtml(annualLeavePlanPlanText(clean))}</li>`;
}

function blockListHtml(blocks) {
  return `<ul>${blocks.map((block) => {
    const when = block.start === block.end ? block.start : `${block.start} to ${block.end}`;
    const days = annualLeavePlanDaysInBlock(block);
    const note = block.note ? ` — ${block.note}` : '';
    return `<li>${escapeHtml(when)} (${days} ${days === 1 ? 'day' : 'days'}${note})</li>`;
  }).join('')}</ul>`;
}

/**
 * One year of plans side by side: one column per staff
 * member, each column listing that member's planned
 * blocks, with the year's clashes underneath so cover
 * gaps are visible at a glance.
 */
export function annualLeavePlanYearHtml(list, year) {
  const wanted = foldAnnualLeavePlanYear(year);
  if (wanted === null) return '<p>No annual leave plans recorded.</p>';
  const plans = annualLeavePlanPlansForYear(list, wanted);
  if (!plans.length) return `<p>No annual leave plans recorded for ${wanted}.</p>`;
  const columns = plans.map((plan) => (
    `<th>${escapeHtml(plan.staffMember)} (${escapeHtml(plan.status)})</th>`
  )).join('');
  const cells = plans.map((plan) => `<td>${blockListHtml(plan.blocks)}</td>`).join('');
  const clashes = annualLeavePlanClashes(list, wanted);
  const clashHtml = clashes.length
    ? `<p>Clashes: ${clashes.map((clash) => escapeHtml(annualLeavePlanClashText(clash))).join(' ')}</p>`
    : '<p>No clashes: nobody is planned away in the same week as another staff member.</p>';
  return `<table><thead><tr>${columns}</tr></thead><tbody><tr>${cells}</tr></tbody></table>${clashHtml}`;
}

export function annualLeavePlanAllHtml(list) {
  const years = annualLeavePlanYears(list);
  if (!years.length) return '<p>No annual leave plans recorded.</p>';
  return years.map((year) => `<h4>${year}</h4>${annualLeavePlanYearHtml(list, year)}`).join('');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function annualLeavePlanCsv(list) {
  const sorted = annualLeavePlanPlansSorted(list);
  const header = ['id', 'staffMember', 'year', 'blocks', 'status', 'note'].join(',');
  const rows = sorted.map((plan) => {
    const blocks = plan.blocks
      .map((block) => (block.start === block.end ? block.start : `${block.start} to ${block.end}`))
      .join('; ');
    return [plan.id, plan.staffMember, plan.year, blocks, plan.status, plan.note].map(csvCell).join(',');
  });
  return [header, ...rows].join('\n');
}

export function annualLeavePlanFilename() {
  return 'annual-leave-plans.csv';
}
