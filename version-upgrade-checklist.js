// Version upgrade checklist (Plan 342): one checklist per version change,
// so an upgrade is installed in a recorded order — backup first, install,
// then verify — instead of from memory. A checklist carries the version
// before, the version after, the steps in order with each step done,
// skipped, or pending, the checker, and the date. An upgrade is complete
// only when every step is ticked; a skipped step stays flagged, never
// hidden. The checklist only records the sequence: it never installs,
// changes, or rolls back any app version by itself. Inputs are never
// mutated, and the module never reads storage, the clock, the network,
// or the page.

const VERSION_UPGRADE_CHECKLIST_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isVersionUpgradeChecklistLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validVersionUpgradeChecklistDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = VERSION_UPGRADE_CHECKLIST_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isVersionUpgradeChecklistLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanVersionUpgradeChecklistText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function foldVersionUpgradeChecklistStepStatus(value) {
  const clean = cleanVersionUpgradeChecklistText(value).toLowerCase();
  if (clean === 'done' || clean === 'complete' || clean === 'ticked') return 'done';
  if (clean === 'skipped' || clean === 'skip') return 'skipped';
  return 'pending';
}

export function normalizeVersionUpgradeChecklistStep(value) {
  if (typeof value === 'string') {
    const text = cleanVersionUpgradeChecklistText(value);
    if (!text) return null;
    return { text, status: 'pending' };
  }
  if (!value || typeof value !== 'object') return null;
  const text = cleanVersionUpgradeChecklistText(value.text);
  if (!text) return null;
  return { text, status: foldVersionUpgradeChecklistStepStatus(value.status) };
}

export function normalizeVersionUpgradeChecklistSteps(value) {
  if (!Array.isArray(value)) {
    if (typeof value === 'string') return normalizeVersionUpgradeChecklistSteps(value.split('\n'));
    return [];
  }
  const out = [];
  for (const raw of value) {
    const step = normalizeVersionUpgradeChecklistStep(raw);
    if (step) out.push(step);
  }
  return out;
}

export function normalizeVersionUpgradeChecklist(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanVersionUpgradeChecklistText(raw.id);
  const fromVersion = cleanVersionUpgradeChecklistText(raw.fromVersion);
  const toVersion = cleanVersionUpgradeChecklistText(raw.toVersion);
  const steps = normalizeVersionUpgradeChecklistSteps(raw.steps);
  const checker = cleanVersionUpgradeChecklistText(raw.checker);
  const date = cleanVersionUpgradeChecklistText(raw.date);
  if (!id || !fromVersion || !toVersion || !steps.length || !checker) return null;
  if (fromVersion.toLowerCase() === toVersion.toLowerCase()) return null;
  if (!validVersionUpgradeChecklistDay(date)) return null;
  return { id, fromVersion, toVersion, steps, checker, date };
}

export function normalizeVersionUpgradeChecklistList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeVersionUpgradeChecklist(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordVersionUpgradeChecklist(list, checklist) {
  const clean = normalizeVersionUpgradeChecklist(checklist);
  if (!clean) return list;
  const known = normalizeVersionUpgradeChecklistList(list);
  if (known.some((entry) => entry.id === clean.id)) return list;
  return [...known, clean];
}

export function versionUpgradeChecklistForVersions(list, fromVersion, toVersion) {
  const clean = normalizeVersionUpgradeChecklistList(list);
  const from = cleanVersionUpgradeChecklistText(fromVersion).toLowerCase();
  const to = cleanVersionUpgradeChecklistText(toVersion).toLowerCase();
  if (!from || !to) return null;
  return clean.find((entry) => entry.fromVersion.toLowerCase() === from && entry.toVersion.toLowerCase() === to) ?? null;
}

function versionUpgradeChecklistSetStep(list, id, stepIndex, status) {
  const known = normalizeVersionUpgradeChecklistList(list);
  const wanted = cleanVersionUpgradeChecklistText(id);
  const target = known.find((entry) => entry.id === wanted);
  if (!target) return list;
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= target.steps.length) return list;
  return known.map((entry) => {
    if (entry.id !== wanted) return entry;
    return {
      ...entry,
      steps: entry.steps.map((step, index) => (index === stepIndex ? { ...step, status } : step)),
    };
  });
}

export function tickVersionUpgradeChecklistStep(list, id, stepIndex) {
  return versionUpgradeChecklistSetStep(list, id, stepIndex, 'done');
}

export function skipVersionUpgradeChecklistStep(list, id, stepIndex) {
  return versionUpgradeChecklistSetStep(list, id, stepIndex, 'skipped');
}

export function versionUpgradeChecklistIsComplete(checklist) {
  const clean = normalizeVersionUpgradeChecklist(checklist);
  if (!clean) return false;
  return clean.steps.every((step) => step.status === 'done');
}

export function versionUpgradeChecklistSkippedSteps(checklist) {
  const clean = normalizeVersionUpgradeChecklist(checklist);
  if (!clean) return [];
  return clean.steps.filter((step) => step.status === 'skipped');
}

function versionUpgradeChecklistCompare(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const aFrom = a.fromVersion.toLowerCase();
  const bFrom = b.fromVersion.toLowerCase();
  if (aFrom !== bFrom) return aFrom < bFrom ? -1 : 1;
  return 0;
}

export function incompleteVersionUpgradeChecklists(list) {
  const clean = normalizeVersionUpgradeChecklistList(list);
  return clean.filter((entry) => !versionUpgradeChecklistIsComplete(entry)).sort(versionUpgradeChecklistCompare);
}

export function versionUpgradeChecklistCounts(list) {
  const clean = normalizeVersionUpgradeChecklistList(list);
  let complete = 0;
  let skipped = 0;
  for (const entry of clean) {
    if (versionUpgradeChecklistIsComplete(entry)) complete += 1;
    skipped += versionUpgradeChecklistSkippedSteps(entry).length;
  }
  return { total: clean.length, complete, incomplete: clean.length - complete, skipped };
}

export function versionUpgradeChecklistSummaryText(list) {
  const counts = versionUpgradeChecklistCounts(list);
  if (!counts.total) return 'No version upgrade checklists.';
  const listText = counts.total === 1 ? '1 upgrade checklist' : `${counts.total} upgrade checklists`;
  let text = `${listText}: ${counts.complete} complete, ${counts.incomplete} incomplete.`;
  if (counts.skipped) {
    const skippedText = counts.skipped === 1 ? '1 skipped step' : `${counts.skipped} skipped steps`;
    text += ` ${skippedText} flagged.`;
  }
  return text;
}

function versionUpgradeChecklistStepDetailText(step, index) {
  return `${index + 1}. ${step.text} (${step.status})`;
}

function versionUpgradeChecklistDetailText(checklist) {
  const stepsText = checklist.steps.map((step, index) => versionUpgradeChecklistStepDetailText(step, index)).join('; ');
  const stateText = versionUpgradeChecklistIsComplete(checklist) ? 'complete' : 'incomplete';
  return `steps: ${stepsText}; checked by ${checklist.checker} on ${checklist.date}; ${stateText}`;
}

export function versionUpgradeChecklistText(checklist) {
  const clean = normalizeVersionUpgradeChecklist(checklist);
  if (!clean) return '';
  return `${clean.fromVersion} to ${clean.toVersion} — ${versionUpgradeChecklistDetailText(clean)}`;
}

export function versionUpgradeChecklistsText(list) {
  const clean = normalizeVersionUpgradeChecklistList(list);
  if (!clean.length) return 'No version upgrade checklists.';
  return [...clean].sort(versionUpgradeChecklistCompare).map((entry) => versionUpgradeChecklistText(entry)).join('\n');
}

function escapeVersionUpgradeChecklistHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function versionUpgradeChecklistHtml(checklist) {
  const clean = normalizeVersionUpgradeChecklist(checklist);
  if (!clean) return '';
  return `<div><strong>${escapeVersionUpgradeChecklistHtml(clean.fromVersion)} to ${escapeVersionUpgradeChecklistHtml(clean.toVersion)}</strong> — ${escapeVersionUpgradeChecklistHtml(versionUpgradeChecklistDetailText(clean))}</div>`;
}

export function versionUpgradeChecklistsHtml(list) {
  const clean = normalizeVersionUpgradeChecklistList(list);
  if (!clean.length) return '<p>No version upgrade checklists yet.</p>';
  const items = [...clean]
    .sort(versionUpgradeChecklistCompare)
    .map((entry) => `<li>${escapeVersionUpgradeChecklistHtml(versionUpgradeChecklistText(entry))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

export function versionUpgradeChecklistIncompleteHtml(list) {
  const open = incompleteVersionUpgradeChecklists(list);
  if (!open.length) return '<p>No incomplete upgrade checklists.</p>';
  const items = open.map((entry) => `<li>${escapeVersionUpgradeChecklistHtml(versionUpgradeChecklistText(entry))}</li>`).join('');
  return `<ul>${items}</ul>`;
}

function versionUpgradeChecklistCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function versionUpgradeChecklistCsv(list) {
  const clean = normalizeVersionUpgradeChecklistList(list);
  const header = ['id', 'fromVersion', 'toVersion', 'steps', 'checker', 'date'];
  const lines = [header.map(versionUpgradeChecklistCsvCell).join(',')];
  for (const entry of clean) {
    const stepsText = entry.steps.map((step, index) => versionUpgradeChecklistStepDetailText(step, index)).join('; ');
    lines.push([
      entry.id,
      entry.fromVersion,
      entry.toVersion,
      stepsText,
      entry.checker,
      entry.date,
    ].map(versionUpgradeChecklistCsvCell).join(','));
  }
  return lines.join('\n');
}

export function versionUpgradeChecklistFilename() {
  return 'version-upgrade-checklists.csv';
}
