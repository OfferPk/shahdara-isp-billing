// Plan 249 (Plan 203-350) — Pole ownership and permission note.
//
// Poles used for fibre belong to different owners or need different
// permissions, but that was remembered per pole by whoever strung
// the cable, so a repair crew could be challenged on site. This
// module adds only the missing piece: one note per pole — the pole
// reference, the route segment, the owner or authority as entered,
// the permission status, the date noted, and a note in plain words.
//
// The fences, stated plainly:
//   - This records ownership and permission only. It does not
//     replace the Plan 146 inspection round, which records
//     inspection results: no inspection record is read nor
//     rewritten here, and this module imports nothing.
//   - It is not an asset register and not a landmark directory:
//     the pole asset tracker and the pole landmark book are
//     neither read nor rewritten here. A note names a pole by
//     reference only and changes no asset or landmark.
//   - Poles list by permission status, and poles without a
//     recorded permission are flagged, so a crew can see before
//     a visit which poles still need permission confirmed.
//   - A note is never edited, only followed by a dated update:
//     there is no edit function, only record, update, and
//     remove. An update appends a dated entry and moves the
//     current permission and date forward; the earlier entries
//     stay in the note's history.
//   - Recording a note never changes any bill, payment,
//     customer, route, or inspection record by itself: the
//     module takes no bill, payment, customer, route, or
//     inspection object in, edits none, and returns none. It
//     holds pole permission notes only.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const POLE_PERMISSION_STORE = 'shahdara_pole_permissions_v1';
export const POLE_PERMISSION_FILENAME = 'pole-permissions.csv';

const PERMISSION_STATUSES = ['granted', 'pending', 'refused', 'not recorded'];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validPolePermissionDate(value) {
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

// A permission status is one of the known words; anything else
// means no permission has been recorded for that pole yet.
function cleanPermission(value) {
  const status = text(value).toLowerCase();
  if (PERMISSION_STATUSES.includes(status)) return status;
  return 'not recorded';
}

function cleanUpdates(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const permission = cleanPermission(item.permission);
    if (!validPolePermissionDate(date)) continue;
    out.push({ date, permission, note: text(item.note) });
  }
  return out;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const pole = text(entry.pole);
  const segment = text(entry.segment);
  const owner = text(entry.owner);
  const permission = cleanPermission(entry.permission);
  const date = text(entry.date);
  const note = text(entry.note);
  if (!id || !pole || !segment || !owner || !date || !note) return null;
  if (!validPolePermissionDate(date)) return null;
  return {
    id,
    pole,
    segment,
    owner,
    permission,
    date,
    note,
    updates: cleanUpdates(entry.updates),
  };
}

export function normalizePolePermissionList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenPoles = new Set();
  const out = [];
  for (const entry of list) {
    const clean = normalizeEntry(entry);
    if (!clean) continue;
    if (seenIds.has(clean.id)) continue;
    const poleKey = clean.pole.toLowerCase();
    if (seenPoles.has(poleKey)) continue;
    seenIds.add(clean.id);
    seenPoles.add(poleKey);
    out.push(clean);
  }
  return out;
}

// One note per pole: a second note for the same pole reference is
// refused, so a pole can never carry two different permission
// stories at once.
export function recordPolePermission(list, entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return null;
  const base = normalizePolePermissionList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  if (
    base.some((item) => item.pole.toLowerCase() === clean.pole.toLowerCase())
  ) {
    return base;
  }
  return [...base, clean];
}

export function removePolePermission(list, id) {
  const base = normalizePolePermissionList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findPolePermission(list, id) {
  const base = normalizePolePermissionList(list);
  return base.find((item) => item.id === text(id)) || null;
}

// A permission change is a dated update, never a silent overwrite:
// the update is appended to the note's history and the current
// permission, date, and note move forward with it.
export function updatePolePermission(list, id, update) {
  const base = normalizePolePermissionList(list);
  const target = text(id);
  if (!update || typeof update !== 'object') return list;
  const date = text(update.date);
  const permission = cleanPermission(update.permission);
  const note = text(update.note);
  if (!validPolePermissionDate(date)) return list;
  if (!base.some((item) => item.id === target)) return list;
  return base.map((item) =>
    item.id === target
      ? {
          ...item,
          permission,
          date,
          note: note || item.note,
          updates: [...item.updates, { date, permission, note }],
        }
      : item,
  );
}

export function polePermissionsSorted(list) {
  const base = normalizePolePermissionList(list);
  return [...base].sort((a, b) => {
    const byPole = a.pole.toLowerCase().localeCompare(b.pole.toLowerCase());
    if (byPole !== 0) return byPole;
    return a.id.localeCompare(b.id);
  });
}

export function polesByPermission(list, status) {
  const wanted = cleanPermission(status);
  return polePermissionsSorted(list).filter(
    (item) => item.permission === wanted,
  );
}

export function polePermissionStatuses(list) {
  const base = normalizePolePermissionList(list);
  const found = new Set();
  for (const item of base) found.add(item.permission);
  return PERMISSION_STATUSES.filter((status) => found.has(status));
}

// Poles without a recorded permission are flagged: a crew should
// not be challenged at a pole whose permission was never written
// down.
export function polesWithoutPermission(list) {
  return polesByPermission(list, 'not recorded');
}

export function polePermissionSummaryText(list) {
  const base = normalizePolePermissionList(list);
  const unrecorded = polesWithoutPermission(base).length;
  const granted = base.filter((item) => item.permission === 'granted').length;
  const pending = base.filter((item) => item.permission === 'pending').length;
  const refused = base.filter((item) => item.permission === 'refused').length;
  const poleWord = base.length === 1 ? 'pole' : 'poles';
  const unrecordedText =
    unrecorded === 0
      ? 'Every pole has a recorded permission.'
      : `${unrecorded} pole${unrecorded === 1 ? '' : 's'} without a recorded permission.`;
  return (
    `${base.length} ${poleWord}: ${granted} granted, ${pending} pending, ` +
    `${refused} refused. ${unrecordedText}`
  );
}

export function polePermissionText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '';
  const updates =
    clean.updates.length === 0
      ? 'No dated updates yet.'
      : `${clean.updates.length} dated update${clean.updates.length === 1 ? '' : 's'}, latest ${clean.updates[clean.updates.length - 1].date}.`;
  return (
    `Pole ${clean.pole} (${clean.segment}): owned by ${clean.owner}, ` +
    `permission ${clean.permission}, noted ${clean.date}. ${clean.note} ${updates}`
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

export function polePermissionHtml(list) {
  const rows = polePermissionsSorted(list);
  if (rows.length === 0) return '<p>No pole permission notes recorded.</p>';
  const items = rows
    .map((item) => `<li>${escapeHtml(polePermissionText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function polePermissionCsv(list) {
  const rows = polePermissionsSorted(list);
  const header = [
    'id',
    'pole',
    'segment',
    'owner',
    'permission',
    'date noted',
    'note',
    'dated updates',
  ]
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.pole,
      item.segment,
      item.owner,
      item.permission,
      item.date,
      item.note,
      item.updates
        .map((u) => `${u.date}: ${u.permission}${u.note ? ` (${u.note})` : ''}`)
        .join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function polePermissionFilename() {
  return POLE_PERMISSION_FILENAME;
}
