// Plan 79 (Plan 1-100) — Installation job cost sheet.
//
// The installation fee a customer pays is recorded, but what the
// job actually cost — cable length, connectors, ONU, time, and
// transport — is not, so the owner cannot tell whether
// installations make money or quietly lose it. This module is
// that sheet: one record per installation job, with its materials
// drawn (by name, from the stock register's item list, Plan 51),
// labour time and cost noted, transport noted, and the fee
// charged, shown as fee minus recorded costs equals job margin.
//
// The fences, stated plainly:
//   - This is a cost view only. It posts no expense — expenses
//     still live in the expense records (Plan 42) — and it
//     changes no bill. The sheet holds no bill, payment,
//     expense, or stock-total field of its own, so completing a
//     sheet cannot alter any of those records.
//   - Stock totals move only through the normal stock-issue
//     movement (Plan 51). A material line here only names the
//     stock item and the quantity drawn; it never reads or
//     rewrites the stock register.
//   - The onboarding checklist (Plan 16) and the first-bill
//     preview (Plan 18) are linked by id only, never read or
//     rewritten here.
//   - A job with no cost entries shows as uncosted, never as
//     zero-cost: a zero total would pretend the job was free.
//   - Half-formed records are refused outright, never stored
//     half-formed. Dates are strict YYYY-MM-DD calendar dates
//     (2026-02-30 is not a date). Money is integer cents
//     throughout; a field named *Cents is used as-is, so a
//     stored record re-read through the normaliser never
//     inflates a hundredfold. Inputs are never mutated, and the
//     module never reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Material items mirror the stock register's item list (Plan 51),
// plus 'other' for a material the register does not name.
export const JOB_MATERIAL_ITEMS = [
  'onu',
  'router',
  'splitter',
  'patch_cord',
  'drop_cable',
  'connector',
  'power_adapter',
  'other',
];

export const JOB_MATERIAL_LABELS = {
  onu: 'ONU',
  router: 'Router',
  splitter: 'Splitter',
  patch_cord: 'Patch cord',
  drop_cable: 'Drop cable',
  connector: 'Connector',
  power_adapter: 'Power adapter',
  other: 'Other material',
};

export const JOB_STATUSES = ['draft', 'complete'];

export const JOB_STATUS_LABELS = {
  draft: 'Draft',
  complete: 'Complete',
};

const MOHALLA_ALIASES = {
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
};

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const raw = text(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function validJobDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

// Canonical mohalla key for filtering, mirroring the Plan T rule
// as the other pure modules do: a leading "Mohalla" is stripped,
// case and whitespace are folded, and the known aliases apply.
// Anything else keeps its own folded label, never rewritten.
export function jobMohallaKey(value) {
  const raw = text(value);
  if (!raw) return null;
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return null;
  const folded = stripped.toLowerCase().replace(/\s+/g, ' ');
  const aliased = MOHALLA_ALIASES[folded.replace(/\s+/g, '')] ?? MOHALLA_ALIASES[folded];
  if (aliased) return aliased;
  return stripped.toUpperCase();
}

function jobMohallaLabel(value) {
  const raw = text(value);
  if (!raw) return '';
  return raw.replace(/^mohalla\s+/i, '').trim();
}

// A money figure in integer cents, or null when unusable. Blank,
// boolean, negative, and non-finite values are unusable — never
// zero-filled, because a missing figure is not a free figure.
function centsOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

function qtyOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function normalizeMaterial(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const item = text(raw.item);
  if (!JOB_MATERIAL_ITEMS.includes(item)) return null;
  const qty = qtyOrNull(raw.qty);
  if (qty === null) return null;
  const unitCostCents = centsOrNull(raw.unitCostCents);
  if (unitCostCents === null) return null;
  // Line total in integer cents, rounded to the nearest cent so
  // a fractional quantity (metres of drop cable) never drifts.
  return {
    item,
    label: item === 'other' ? text(raw.label) : JOB_MATERIAL_LABELS[item],
    qty,
    unitCostCents,
    lineCents: Math.round(qty * unitCostCents),
  };
}

export function normalizeJob(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const date = validJobDate(raw.date);
  const status = text(raw.status);
  if (!id || !customerId || !date) return null;
  if (!JOB_STATUSES.includes(status)) return null;
  const materials = Array.isArray(raw.materials) ? raw.materials.map(normalizeMaterial) : [];
  if (materials.includes(null)) return null;
  const labourMinutes = raw.labourMinutes === null || raw.labourMinutes === undefined || raw.labourMinutes === ''
    ? null
    : (typeof raw.labourMinutes === 'boolean' || !Number.isFinite(Number(raw.labourMinutes)) || Number(raw.labourMinutes) < 0
      ? null
      : Math.round(Number(raw.labourMinutes)));
  if (raw.labourMinutes !== null && raw.labourMinutes !== undefined && raw.labourMinutes !== '' && labourMinutes === null) return null;
  const labourCostCents = raw.labourCostCents === null || raw.labourCostCents === undefined || raw.labourCostCents === ''
    ? null
    : centsOrNull(raw.labourCostCents);
  if (raw.labourCostCents !== null && raw.labourCostCents !== undefined && raw.labourCostCents !== '' && labourCostCents === null) return null;
  const transportCostCents = raw.transportCostCents === null || raw.transportCostCents === undefined || raw.transportCostCents === ''
    ? null
    : centsOrNull(raw.transportCostCents);
  if (raw.transportCostCents !== null && raw.transportCostCents !== undefined && raw.transportCostCents !== '' && transportCostCents === null) return null;
  const feeCents = raw.feeCents === null || raw.feeCents === undefined || raw.feeCents === ''
    ? null
    : centsOrNull(raw.feeCents);
  if (raw.feeCents !== null && raw.feeCents !== undefined && raw.feeCents !== '' && feeCents === null) return null;
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    onboardingId: text(raw.onboardingId),
    date,
    mohalla: jobMohallaLabel(raw.mohalla),
    mohallaKey: jobMohallaKey(raw.mohalla),
    materials,
    labourMinutes,
    labourNote: text(raw.labourNote),
    labourCostCents,
    transportCostCents,
    transportNote: text(raw.transportNote),
    feeCents,
    status,
    note: text(raw.note),
  };
}

export function normalizeJobList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const row of list) {
    const entry = normalizeJob(row);
    if (entry) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

export function findJob(list, id) {
  const entries = normalizeJobList(list);
  return entries.find((entry) => entry.id === text(id)) ?? null;
}

export function upsertJob(list, record) {
  const entry = normalizeJob(record);
  if (!entry) return Array.isArray(list) ? normalizeJobList(list) : [];
  const entries = normalizeJobList(list);
  const at = entries.findIndex((row) => row.id === entry.id);
  if (at >= 0) entries[at] = entry;
  else entries.push(entry);
  return entries;
}

export function removeJob(list, id) {
  const entries = normalizeJobList(list);
  return entries.filter((entry) => entry.id !== text(id));
}

export function addJobMaterial(list, id, material) {
  const entries = normalizeJobList(list);
  const at = entries.findIndex((row) => row.id === text(id));
  if (at < 0) return entries;
  const line = normalizeMaterial(material);
  if (!line) return entries;
  const current = entries[at];
  const moved = normalizeJob({ ...current, materials: [...current.materials, line] });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

// Completing a sheet changes only this sheet's status. It posts
// no expense, raises no bill, and moves no stock — the fence is
// that this module holds none of those fields at all.
export function completeJob(list, id) {
  const entries = normalizeJobList(list);
  const at = entries.findIndex((row) => row.id === text(id));
  if (at < 0 || entries[at].status !== 'draft') return entries;
  const moved = normalizeJob({ ...entries[at], status: 'complete' });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

export function reopenJob(list, id) {
  const entries = normalizeJobList(list);
  const at = entries.findIndex((row) => row.id === text(id));
  if (at < 0 || entries[at].status !== 'complete') return entries;
  const moved = normalizeJob({ ...entries[at], status: 'draft' });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

function byDateThenId(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function jobsFiltered(list, filters = {}) {
  const entries = normalizeJobList(list);
  const status = text(filters.status);
  const mohalla = text(filters.mohalla);
  const wantedKey = mohalla === '__unassigned__' ? '__unassigned__' : jobMohallaKey(mohalla);
  return entries
    .filter((entry) => (status ? entry.status === status : true))
    .filter((entry) => {
      if (!mohalla) return true;
      if (wantedKey === '__unassigned__') return !entry.mohallaKey;
      return entry.mohallaKey === wantedKey;
    })
    .sort(byDateThenId);
}

// One sheet's computed figures. A sheet with no cost entries at
// all is uncosted: totalCostCents and marginCents stay null
// rather than pretending the job cost nothing. A costed sheet
// with no fee recorded still shows its total cost, but its
// margin stays null — a margin against an unknown fee would be
// invented.
export function buildJobCosts(job) {
  const entry = normalizeJob(job);
  if (!entry) return null;
  const materialsCostCents = entry.materials.reduce((sum, line) => sum + line.lineCents, 0);
  const hasCosts = entry.materials.length > 0 || entry.labourCostCents !== null || entry.transportCostCents !== null;
  if (!hasCosts) {
    return {
      materialsCostCents: 0,
      totalCostCents: null,
      feeCents: entry.feeCents,
      marginCents: null,
      costed: false,
    };
  }
  const totalCostCents = materialsCostCents + (entry.labourCostCents ?? 0) + (entry.transportCostCents ?? 0);
  return {
    materialsCostCents,
    totalCostCents,
    feeCents: entry.feeCents,
    marginCents: entry.feeCents === null ? null : entry.feeCents - totalCostCents,
    costed: true,
  };
}

export function buildJobSummary(list) {
  const entries = normalizeJobList(list);
  const summary = {
    total: entries.length,
    draft: 0,
    complete: 0,
    uncosted: 0,
    totalFeeCents: 0,
    feeRecorded: 0,
    totalCostCents: 0,
    costed: 0,
    totalMarginCents: 0,
    marginKnown: 0,
    byMohalla: {},
  };
  for (const entry of entries) {
    summary[entry.status] += 1;
    const costs = buildJobCosts(entry);
    if (!costs.costed) summary.uncosted += 1;
    else {
      summary.costed += 1;
      summary.totalCostCents += costs.totalCostCents;
    }
    if (entry.feeCents !== null) {
      summary.feeRecorded += 1;
      summary.totalFeeCents += entry.feeCents;
    }
    if (costs.marginCents !== null) {
      summary.marginKnown += 1;
      summary.totalMarginCents += costs.marginCents;
    }
    const key = entry.mohallaKey || '__unassigned__';
    const bucket = summary.byMohalla[key] ?? { label: entry.mohalla || 'Not recorded', sheets: 0, costCents: 0, marginCents: 0 };
    bucket.sheets += 1;
    if (costs.costed) bucket.costCents += costs.totalCostCents;
    if (costs.marginCents !== null) bucket.marginCents += costs.marginCents;
    summary.byMohalla[key] = bucket;
  }
  return summary;
}

export function formatJobCents(cents) {
  if (cents === null || cents === undefined) return 'Not recorded';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

export function jobSummaryText(summary) {
  if (!summary) return 'No job sheets recorded.';
  const costPart = summary.costed === 0
    ? 'no costed sheet yet'
    : `total recorded cost ${formatJobCents(summary.totalCostCents)} across ${summary.costed} costed sheet${summary.costed === 1 ? '' : 's'}`;
  const marginPart = summary.marginKnown === 0
    ? 'margin unknown until fees are recorded'
    : `total margin ${formatJobCents(summary.totalMarginCents)} across ${summary.marginKnown} sheet${summary.marginKnown === 1 ? '' : 's'}`;
  return `${summary.total} job sheet${summary.total === 1 ? '' : 's'} recorded — ${summary.complete} complete, ${summary.draft} draft, ${summary.uncosted} uncosted; ${costPart}; ${marginPart}.`;
}

export function jobHtml(rows) {
  const entries = normalizeJobList(rows);
  if (entries.length === 0) return '<p class="empty-state">No job sheets recorded.</p>';
  const body = entries
    .sort(byDateThenId)
    .map((entry) => {
      const costs = buildJobCosts(entry);
      const materials = entry.materials.length === 0
        ? 'No materials recorded'
        : entry.materials.map((line) => `${escapeHtml(line.label)} × ${line.qty} @ ${formatJobCents(line.unitCostCents)} = ${formatJobCents(line.lineCents)}`).join('; ');
      const labour = entry.labourMinutes !== null ? `${entry.labourMinutes} min` : 'Time not recorded';
      const margin = costs.costed ? formatJobCents(costs.marginCents) : 'Uncosted';
      return `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.customerName || entry.customerId)}</td><td>${escapeHtml(entry.date)}</td><td>${escapeHtml(materials)}</td><td>${escapeHtml(labour)}${entry.labourCostCents !== null ? ` · ${formatJobCents(entry.labourCostCents)}` : ''}</td><td>${entry.transportCostCents !== null ? formatJobCents(entry.transportCostCents) : 'Not recorded'}</td><td>${entry.feeCents !== null ? formatJobCents(entry.feeCents) : 'Not recorded'}</td><td>${margin}</td><td>${escapeHtml(JOB_STATUS_LABELS[entry.status])}</td></tr>`;
    })
    .join('');
  return `<table><thead><tr><th>Job</th><th>Customer</th><th>Date</th><th>Materials</th><th>Labour</th><th>Transport</th><th>Fee</th><th>Margin</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function jobCsv(rows) {
  const entries = normalizeJobList(rows).sort(byDateThenId);
  const lines = ['Job,Customer,Date,Mohalla,Materials,Materials cost,Labour minutes,Labour cost,Transport cost,Total cost,Fee,Margin,Status,Onboarding id'];
  for (const entry of entries) {
    const costs = buildJobCosts(entry);
    const materials = entry.materials.map((line) => `${line.label} x ${line.qty} @ ${(line.unitCostCents / 100).toFixed(2)}`).join('; ');
    lines.push([
      csvCell(entry.id),
      csvCell(entry.customerName || entry.customerId),
      csvCell(entry.date),
      csvCell(entry.mohalla),
      csvCell(materials),
      csvCell(costs.costed ? formatJobCents(costs.materialsCostCents) : 'Uncosted'),
      csvCell(entry.labourMinutes !== null ? entry.labourMinutes : ''),
      csvCell(entry.labourCostCents !== null ? formatJobCents(entry.labourCostCents) : ''),
      csvCell(entry.transportCostCents !== null ? formatJobCents(entry.transportCostCents) : ''),
      csvCell(costs.costed ? formatJobCents(costs.totalCostCents) : 'Uncosted'),
      csvCell(entry.feeCents !== null ? formatJobCents(entry.feeCents) : ''),
      csvCell(costs.marginCents !== null ? formatJobCents(costs.marginCents) : 'Uncosted'),
      csvCell(JOB_STATUS_LABELS[entry.status]),
      csvCell(entry.onboardingId),
    ].join(','));
  }
  return lines.join('\n');
}

export function jobFilename() {
  return 'job-cost-sheets.csv';
}
