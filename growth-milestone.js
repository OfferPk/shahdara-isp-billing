// Plan 191 (Plan 101-202) — Growth Milestone Tracker Toward Second OLT.
//
// Growth toward a second OLT is felt vaguely rather than tracked, so
// the owner cannot see how far along the road the business is or what
// still needs to be ready. This module tracks readiness only: one
// milestone in plain words, a target as entered by the owner, a
// current position entered by the owner or linked read-only to an
// existing count by name, a status, and a note.
//
// What this module is NOT, stated plainly:
//   - It is not a customer, billing, or capacity record. It never
//     reads or writes any customer, bill, payment, or capacity
//     record; a linked count is only a name the operator types, and
//     the module never follows it into another record.
//   - It is not a decision to add a second OLT. Completing a
//     milestone changes nothing else in the app: it only moves that
//     milestone's own status marker.
//   - It is not a calculation. Targets and current positions are kept
//     exactly as entered and are never parsed, compared as numbers,
//     or totalled; there is no progress percentage and no readiness
//     score anywhere in this module.
//   - It is not a second capacity forecast. The capacity forecast
//     module and any other existing module are neither read nor
//     written here.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment, customer,
//     capacity, or sending field can ever creep into a milestone
//     record.
//   - Duplicate ids are never rewritten, and there is no edit
//     function at all: a milestone is recorded, its status is set,
//     or it is removed — never silently rewritten.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const STATUSES = ['not-started', 'in-progress', 'done'];

function normalizeStatus(value) {
  const status = text(value);
  return STATUSES.includes(status) ? status : 'not-started';
}

function normalizeOrder(value) {
  const order = Number(value);
  if (!Number.isFinite(order)) return null;
  if (!Number.isInteger(order) || order < 1) return null;
  return order;
}

function normalizeMilestone(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const milestone = text(raw.milestone);
  const target = text(raw.target);
  if (!id || !milestone || !target) return null;
  return {
    id,
    milestone,
    target,
    current: text(raw.current),
    linkedCount: text(raw.linkedCount),
    order: normalizeOrder(raw.order),
    status: normalizeStatus(raw.status),
    note: text(raw.note),
  };
}

function normalizeMilestoneList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const milestone = normalizeMilestone(entry);
    if (!milestone) continue;
    if (seen.has(milestone.id)) continue;
    seen.add(milestone.id);
    out.push(milestone);
  }
  return out;
}

function findMilestone(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeMilestoneList(list).find((entry) => entry.id === wanted) || null;
}

function recordMilestone(list, raw) {
  const entries = normalizeMilestoneList(list);
  const milestone = normalizeMilestone(raw);
  if (!milestone) return entries;
  if (entries.some((entry) => entry.id === milestone.id)) return entries;
  return [...entries, milestone];
}

function removeMilestone(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeMilestoneList(list);
  return normalizeMilestoneList(list).filter((entry) => entry.id !== wanted);
}

function setMilestoneStatus(list, id, status) {
  const wanted = text(id);
  const next = text(status);
  if (!wanted || !STATUSES.includes(next)) return normalizeMilestoneList(list);
  return normalizeMilestoneList(list).map((entry) =>
    entry.id === wanted ? { ...entry, status: next } : entry
  );
}

function markMilestoneDone(list, id) {
  return setMilestoneStatus(list, id, 'done');
}

function milestonesSorted(list) {
  return normalizeMilestoneList(list).sort((a, b) => {
    const orderA = a.order === null ? Infinity : a.order;
    const orderB = b.order === null ? Infinity : b.order;
    if (orderA !== orderB) return orderA - orderB;
    if (a.milestone !== b.milestone) return a.milestone < b.milestone ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function milestonesByStatus(list, status) {
  const wanted = text(status);
  if (!STATUSES.includes(wanted)) return [];
  return milestonesSorted(list).filter((entry) => entry.status === wanted);
}

function starterMilestones() {
  return normalizeMilestoneList([
    { id: 'GM-1', milestone: 'First unit near 250 customers', target: '250 customers', current: '', linkedCount: '', order: 1, status: 'not-started', note: 'Second unit only when the first nears 250 to 300 customers.' },
    { id: 'GM-2', milestone: 'All 11 mohallas covered with steady service', target: '11 mohallas', current: '', linkedCount: '', order: 2, status: 'not-started', note: '' },
    { id: 'GM-3', milestone: 'Port capacity checked for the next streets', target: 'Capacity check done', current: '', linkedCount: '', order: 3, status: 'not-started', note: '' },
    { id: 'GM-4', milestone: 'Shop stock ready for the next expansion', target: 'Stock check done', current: '', linkedCount: '', order: 4, status: 'not-started', note: '' },
    { id: 'GM-5', milestone: 'Owner decision recorded for the second unit', target: 'Decision recorded', current: '', linkedCount: '', order: 5, status: 'not-started', note: '' },
  ]);
}

function milestonePositionText(entry) {
  if (entry.current && entry.linkedCount) return `${entry.current} (linked count: ${entry.linkedCount})`;
  if (entry.current) return entry.current;
  if (entry.linkedCount) return `Linked count: ${entry.linkedCount}`;
  return 'No current position entered';
}

function milestoneSummaryText(list) {
  const entries = normalizeMilestoneList(list);
  const done = entries.filter((entry) => entry.status === 'done').length;
  return `${done}/${entries.length} milestones done`;
}

function milestoneReadinessText(list) {
  const entries = milestonesSorted(list);
  if (!entries.length) return 'No milestones recorded — second-unit readiness is not yet tracked.';
  const done = entries.filter((entry) => entry.status === 'done').length;
  const next = entries.find((entry) => entry.status !== 'done');
  if (!next) return `All ${entries.length} milestones done — second-unit readiness position is complete; the owner decision still sits with the owner.`;
  return `${done}/${entries.length} milestones done. Next: ${next.milestone} (target: ${next.target}).`;
}

function milestoneText(entry) {
  const clean = normalizeMilestone(entry);
  if (!clean) return '';
  const lines = [
    `${clean.milestone} [${clean.status}]`,
    `Target: ${clean.target}`,
    `Current: ${milestonePositionText(clean)}`,
  ];
  if (clean.note) lines.push(`Note: ${clean.note}`);
  return lines.join('\n');
}

function milestoneHtml(entry) {
  const clean = normalizeMilestone(entry);
  if (!clean) return '';
  const note = clean.note ? `<br>Note: ${escapeHtml(clean.note)}` : '';
  return `<p><strong>${escapeHtml(clean.milestone)}</strong> [${escapeHtml(clean.status)}]<br>Target: ${escapeHtml(clean.target)}<br>Current: ${escapeHtml(milestonePositionText(clean))}${note}</p>`;
}

function milestoneAllHtml(list) {
  return milestonesSorted(list).map(milestoneHtml).join('');
}

function milestoneCsv(list) {
  const rows = [['id', 'milestone', 'target', 'current', 'linkedCount', 'order', 'status', 'note']];
  for (const entry of milestonesSorted(list)) {
    rows.push([
      entry.id,
      entry.milestone,
      entry.target,
      entry.current,
      entry.linkedCount,
      entry.order === null ? '' : String(entry.order),
      entry.status,
      entry.note,
    ]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function milestoneFilename() {
  return 'growth-milestones.csv';
}

export {
  normalizeMilestone,
  normalizeMilestoneList,
  findMilestone,
  recordMilestone,
  removeMilestone,
  setMilestoneStatus,
  markMilestoneDone,
  milestonesSorted,
  milestonesByStatus,
  starterMilestones,
  milestonePositionText,
  milestoneSummaryText,
  milestoneReadinessText,
  milestoneText,
  milestoneHtml,
  milestoneAllHtml,
  milestoneCsv,
  milestoneFilename,
};
