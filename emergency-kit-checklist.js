// Plan 242 (Plan 203-350) — Emergency fault kit checklist per vehicle.
//
// A vehicle sent to an emergency fault may arrive without the right
// kit, because nobody checked what that vehicle actually carries
// before it left. This module adds only the missing piece: one
// readiness checklist per vehicle — the vehicle, the kit items
// expected, the items present, the items missing, the check date,
// and the checker.
//
// One checklist: the id, the vehicle, the expected kit items, the
// items present, the critical items (a subset of the expected items),
// a strict calendar date checked, the checker, and dated annotations.
//
// The fences, stated plainly:
//   - This is a readiness check only. It does not replace the field
//     tool kit issue log (Plan 148), which records tools issued and
//     returned, and it is not the field kit power backup log (Plan
//     234) or the vehicle and fuel log (Plan 235): those modules are
//     neither read nor rewritten here, and this module imports
//     nothing.
//   - A vehicle's latest checklist shows present versus missing
//     items side by side, and a vehicle with missing critical items
//     is flagged.
//   - Past checklists stay read-only: there is no edit function,
//     only record, annotate, and remove. An annotation never rewrites
//     the vehicle, the expected items, the present items, the
//     critical items, the check date, or the checker.
//   - Recording a checklist never changes any bill, payment,
//     customer, visit, or stock record by itself: the module takes
//     no bill, payment, customer, visit, or stock object in, edits
//     none, and returns none. It holds kit checklists only.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const EMERGENCY_KIT_CHECKLIST_STORE = 'shahdara_emergency_kit_checklists_v1';
export const EMERGENCY_KIT_CHECKLIST_FILENAME = 'emergency-kit-checklists.csv';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validEmergencyKitChecklistDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function cleanItems(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const name = text(item);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function cleanAnnotations(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const note = text(item.note);
    if (!validEmergencyKitChecklistDate(date) || !note) continue;
    out.push({ date, note });
  }
  return out;
}

function normalizeChecklist(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const vehicle = text(entry.vehicle);
  const date = text(entry.date);
  const checker = text(entry.checker);
  if (!id || !vehicle || !validEmergencyKitChecklistDate(date) || !checker) return null;
  const expected = cleanItems(entry.expected);
  if (expected.length === 0) return null;
  const expectedKeys = new Set(expected.map((name) => name.toLowerCase()));
  const critical = cleanItems(entry.critical).filter((name) =>
    expectedKeys.has(name.toLowerCase()),
  );
  const present = cleanItems(entry.present).filter((name) =>
    expectedKeys.has(name.toLowerCase()),
  );
  return {
    id,
    vehicle,
    expected,
    present,
    critical,
    date,
    checker,
    annotations: cleanAnnotations(entry.annotations),
  };
}

export function normalizeEmergencyKitChecklistList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const clean = normalizeChecklist(entry);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

export function recordEmergencyKitChecklist(list, entry) {
  const clean = normalizeChecklist(entry);
  if (!clean) return null;
  const base = normalizeEmergencyKitChecklistList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  return [...base, clean];
}

export function removeEmergencyKitChecklist(list, id) {
  const base = normalizeEmergencyKitChecklistList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findEmergencyKitChecklist(list, id) {
  const base = normalizeEmergencyKitChecklistList(list);
  return base.find((item) => item.id === text(id)) || null;
}

export function addEmergencyKitChecklistAnnotation(list, id, annotation) {
  const base = normalizeEmergencyKitChecklistList(list);
  const target = text(id);
  if (!annotation || typeof annotation !== 'object') return list;
  const date = text(annotation.date);
  const note = text(annotation.note);
  if (!validEmergencyKitChecklistDate(date) || !note) return list;
  if (!base.some((item) => item.id === target)) return list;
  return base.map((item) =>
    item.id === target
      ? { ...item, annotations: [...item.annotations, { date, note }] }
      : item,
  );
}

export function emergencyKitChecklistSorted(list) {
  const base = normalizeEmergencyKitChecklistList(list);
  return [...base].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const byVehicle = a.vehicle.toLowerCase().localeCompare(b.vehicle.toLowerCase());
    if (byVehicle !== 0) return byVehicle;
    return a.id.localeCompare(b.id);
  });
}

export function emergencyKitChecklistsForVehicle(list, vehicle) {
  const wanted = text(vehicle).toLowerCase();
  if (!wanted) return [];
  return emergencyKitChecklistSorted(list).filter(
    (item) => item.vehicle.toLowerCase() === wanted,
  );
}

export function latestEmergencyKitChecklistForVehicle(list, vehicle) {
  const rows = emergencyKitChecklistsForVehicle(list, vehicle);
  return rows.length > 0 ? rows[0] : null;
}

export function emergencyKitChecklistVehicles(list) {
  const base = normalizeEmergencyKitChecklistList(list);
  const seen = new Map();
  for (const item of base) {
    const key = item.vehicle.toLowerCase();
    if (!seen.has(key)) seen.set(key, item.vehicle);
  }
  return [...seen.values()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}

export function emergencyKitChecklistMissingItems(checklist) {
  const clean = normalizeChecklist(checklist);
  if (!clean) return [];
  const presentKeys = new Set(clean.present.map((name) => name.toLowerCase()));
  return clean.expected.filter((name) => !presentKeys.has(name.toLowerCase()));
}

export function emergencyKitChecklistMissingCritical(checklist) {
  const clean = normalizeChecklist(checklist);
  if (!clean) return [];
  const presentKeys = new Set(clean.present.map((name) => name.toLowerCase()));
  return clean.critical.filter((name) => !presentKeys.has(name.toLowerCase()));
}

export function emergencyKitChecklistHasMissingCritical(checklist) {
  return emergencyKitChecklistMissingCritical(checklist).length > 0;
}

export function emergencyKitChecklistVehiclesWithMissingCritical(list) {
  const base = normalizeEmergencyKitChecklistList(list);
  const out = [];
  for (const vehicle of emergencyKitChecklistVehicles(base)) {
    const latest = latestEmergencyKitChecklistForVehicle(base, vehicle);
    if (latest && emergencyKitChecklistHasMissingCritical(latest)) out.push(vehicle);
  }
  return out;
}

export function emergencyKitChecklistSummaryText(list) {
  const base = normalizeEmergencyKitChecklistList(list);
  const vehicles = emergencyKitChecklistVehicles(base);
  const flagged = emergencyKitChecklistVehiclesWithMissingCritical(base);
  const checklistWord = base.length === 1 ? 'checklist' : 'checklists';
  const vehicleWord = vehicles.length === 1 ? 'vehicle' : 'vehicles';
  const flaggedWord = flagged.length === 1 ? 'vehicle' : 'vehicles';
  return (
    `${base.length} emergency kit ${checklistWord} for ${vehicles.length} ${vehicleWord}. ` +
    `${flagged.length} ${flaggedWord} missing critical kit.`
  );
}

export function emergencyKitChecklistText(checklist) {
  const clean = normalizeChecklist(checklist);
  if (!clean) return '';
  const missing = emergencyKitChecklistMissingItems(clean);
  const missingCritical = emergencyKitChecklistMissingCritical(clean);
  const presentText =
    clean.present.length > 0 ? clean.present.join(', ') : 'None present';
  const missingText =
    missing.length > 0 ? missing.join(', ') : 'Nothing missing';
  const criticalText =
    missingCritical.length > 0
      ? `Critical missing: ${missingCritical.join(', ')}.`
      : 'No critical items missing.';
  return (
    `Vehicle ${clean.vehicle} — ${clean.date} — checked by ${clean.checker}. ` +
    `Present: ${presentText}. Missing: ${missingText}. ${criticalText}`
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function emergencyKitChecklistHtml(list) {
  const rows = emergencyKitChecklistSorted(list);
  if (rows.length === 0) return '<p>No emergency kit checklists recorded.</p>';
  const items = rows
    .map((item) => `<li>${escapeHtml(emergencyKitChecklistText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function emergencyKitChecklistCsv(list) {
  const rows = emergencyKitChecklistSorted(list);
  const header = ['id', 'vehicle', 'date', 'checker', 'expected', 'present', 'missing', 'missing critical']
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.vehicle,
      item.date,
      item.checker,
      item.expected.join('; '),
      item.present.join('; '),
      emergencyKitChecklistMissingItems(item).join('; '),
      emergencyKitChecklistMissingCritical(item).join('; '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function emergencyKitChecklistFilename() {
  return EMERGENCY_KIT_CHECKLIST_FILENAME;
}
