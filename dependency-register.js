// Plan 52 (Plan 1-100) — Single-point-of-failure and blast-radius register.
//
// The owner knows the network in general but has no written answer
// to "if this one thing fails, which mohallas go dark?", so an
// outage is scoped by panic instead of by a list. This module is
// that written answer: one dependency per record — an upstream
// link, an OLT, a power feed, a main splitter, a core router —
// linked to the mohallas and splitter segments it serves, plus the
// exact list of customers inside its blast radius.
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every dependency, every
//     customer, and every connection record, and the module never
//     reads storage, the clock, or the network, and never mutates
//     an input.
//   - It is a register only. There is no live monitoring and no
//     automatic failover here: nothing in this module watches a
//     link, restarts anything, or switches traffic. Editing a link
//     never changes a customer, bill, payment, or ticket record.
//   - It is NOT the outage grouping (Plan 22): Plan 22 handles the
//     tickets once a fault exists. This register only says, in
//     advance, which mohallas and segments a dependency serves, so
//     the first announcement after a failure (Plan 14) can name
//     the right mohallas immediately instead of guessing street
//     by street.
//   - It is NOT the capacity view (Plan 26) and NOT the connection
//     register (Plan 17): those are read as caller-supplied input
//     and never rewritten. A dependency links to mohallas the way
//     Plan T addresses them, to segments the way the connection
//     register names its splitters, and to units the way the
//     register names its OLT ids.
//   - A dependency with no mohallas, segments, or units linked
//     shows as unmapped, never as safe. An unmapped dependency is
//     a gap in the register, not a claim that nothing depends on it.
//   - A dependency record with no id, no name, or an unknown type
//     is refused outright, never stored half-formed. A blank note
//     stays empty, never guessed.

const DEFAULT_MOHALLAS = Object.freeze([
  'CHARYAA', 'GANGALL', 'KISHTII', 'BARRIAN', 'THALII', 'CHAMYAAA',
  'PALALIYAA', 'MALLA', 'NAKAR', 'BANII', 'SODAA', 'PULL SIDE',
  'JABBIYAA', 'MOHALLA CHUDRIYAA', 'MOHALLA end side farm house',
  // Sharafat 76 (owner decision 2026-11-12): END POINT is the 16th
  // mohalla — Haweli and End Point are one mohalla (#12 in the
  // numbered display order). "end side farm house" stays separate.
  'END POINT',
]);

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
});

export const DEPENDENCY_TYPES = Object.freeze({
  UPSTREAM: 'upstream',
  OLT: 'olt',
  POWER: 'power',
  SPLITTER: 'splitter',
  ROUTER: 'router',
});

export const DEPENDENCY_TYPE_LABELS = Object.freeze({
  upstream: 'Upstream link',
  olt: 'OLT',
  power: 'Power feed',
  splitter: 'Main splitter',
  router: 'Core router',
});

export const DEPENDENCY_TYPE_OPTIONS = Object.freeze(
  Object.values(DEPENDENCY_TYPES).map((key) => ({ key, label: DEPENDENCY_TYPE_LABELS[key] })),
);

const KNOWN_TYPES = new Set(Object.values(DEPENDENCY_TYPES));

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function comparisonKey(value) {
  return normalizedText(value).toLowerCase();
}

function stripMohallaPrefix(value) {
  const stripped = normalizedText(value).replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  return stripped || normalizedText(value);
}

function readableLabel(value) {
  const readableWord = (word) => {
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    const chars = Array.from(word);
    if (!chars.length) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  };
  return normalizedText(value).split(' ').map((word) => word.split(/([-–—/])/u).map((part) => /^[-–—/]$/u.test(part) ? part : readableWord(part)).join('')).join(' ');
}

// Mirrors the Plan T canonical rule, as mohalla-broadcast.js and
// maintenance-calendar.js do. Returns { key, label, stored } or
// null when blank. An already-canonical { key, label, stored }
// entry passes through unchanged, so re-normalising a stored
// dependency never turns its mohallas into "[object Object]".
export function canonicalDependencyMohalla(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.key === 'string' && value.key) {
    return { key: comparisonKey(value.key), label: text(value.label) || readableLabel(value.key), stored: text(value.stored) || text(value.label) || value.key };
  }
  const raw = normalizedText(value);
  if (!raw) return null;
  const stripped = stripMohallaPrefix(raw);
  const key = comparisonKey(stripped);
  const canonical = DEFAULT_MOHALLAS.find((name) => comparisonKey(stripMohallaPrefix(name)) === key) ?? MOHALLA_ALIASES[key];
  if (canonical) return { key: comparisonKey(stripMohallaPrefix(canonical)), label: readableLabel(canonical), stored: canonical };
  return { key, label: readableLabel(stripped), stored: raw };
}

function resolveMohallas(values) {
  const seen = new Map();
  for (const raw of Array.isArray(values) ? values : []) {
    const canon = canonicalDependencyMohalla(raw);
    if (canon && !seen.has(canon.key)) seen.set(canon.key, canon);
  }
  return [...seen.values()];
}

function resolveList(values) {
  const seen = new Map();
  for (const raw of Array.isArray(values) ? values : []) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.key === 'string' && raw.key) {
      const key = comparisonKey(raw.key);
      if (!seen.has(key)) seen.set(key, { key, label: text(raw.label) || raw.key });
      continue;
    }
    const label = normalizedText(raw);
    if (!label) continue;
    const key = comparisonKey(label);
    if (!seen.has(key)) seen.set(key, { key, label });
  }
  return [...seen.values()];
}

export function normalizeDependencyType(value) {
  const key = comparisonKey(value);
  return KNOWN_TYPES.has(key) ? key : null;
}

export function normalizeDependency(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const name = text(raw.name);
  const type = normalizeDependencyType(raw.type);
  if (!id || !name || !type) return null;
  return {
    id,
    name,
    type,
    mohallas: resolveMohallas(raw.mohallas ?? raw.mohallaList ?? []),
    segments: resolveList(raw.segments ?? raw.segmentList ?? []),
    units: resolveList(raw.units ?? raw.unitList ?? []),
    note: text(raw.note),
  };
}

export function normalizeDependencyList(dependencies) {
  const byId = new Map();
  for (const raw of Array.isArray(dependencies) ? dependencies : []) {
    const normalised = normalizeDependency(raw);
    if (normalised) byId.set(normalised.id, normalised);
  }
  return [...byId.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function findDependency(dependencies, id) {
  return normalizeDependencyList(dependencies).find((d) => d.id === text(id)) ?? null;
}

// Save (or re-save) one dependency. The last row per id wins, so a
// re-save replaces the earlier links instead of duplicating them.
// A refused record leaves the list unchanged.
export function upsertDependency(dependencies, dependency) {
  const current = normalizeDependencyList(dependencies);
  const normalised = normalizeDependency(dependency);
  if (!normalised) return current;
  return normalizeDependencyList([...current.filter((d) => d.id !== normalised.id), normalised]);
}

export function removeDependency(dependencies, id) {
  return normalizeDependencyList(dependencies).filter((d) => d.id !== text(id));
}

function compareCustomers(a, b) {
  const nameA = (a.name || a.customerId).toLowerCase();
  const nameB = (b.name || b.customerId).toLowerCase();
  if (nameA < nameB) return -1;
  if (nameA > nameB) return 1;
  return a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0;
}

// The last connection record per customer wins, matching the
// connection register's own rule. A record without a customer id
// is ignored, never assigned to anyone.
function lastConnectionRecordByCustomer(records) {
  const byCustomer = new Map();
  for (const raw of Array.isArray(records) ? records : []) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const customerId = text(raw.customerId ?? raw.id);
    if (!customerId) continue;
    byCustomer.set(customerId, {
      splitterKey: comparisonKey(raw.splitter ?? raw.splitterId ?? raw.splitterBoxId ?? raw.box ?? ''),
      splitterLabel: normalizedText(raw.splitter ?? raw.splitterId ?? raw.splitterBoxId ?? raw.box ?? ''),
      unitKey: comparisonKey(raw.oltId ?? raw.olt ?? raw.oltName ?? ''),
      unitLabel: normalizedText(raw.oltId ?? raw.olt ?? raw.oltName ?? ''),
    });
  }
  return byCustomer;
}

function customerRow(customer) {
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) return null;
  const id = text(customer.id ?? customer.customerId);
  if (!id) return null;
  const mohalla = canonicalDependencyMohalla(customer.mohalla || customer.area || '');
  return {
    customerId: id,
    name: text(customer.customerName ?? customer.name) || id,
    mohallaKey: mohalla ? mohalla.key : null,
    mohallaLabel: mohalla ? mohalla.label : 'Unassigned',
    archived: customer.archived === true,
  };
}

// One dependency's blast radius over the caller-supplied customers
// and connection records: exactly the customers in its linked
// mohallas, segments, or units — no one else, and no one dropped.
// Archived customers are listed separately and never counted, and
// a customer with no mohalla and no connection record is never
// assigned to a dependency.
export function buildBlastRadius(dependency, context = {}) {
  const normalised = normalizeDependency(dependency);
  if (!normalised) return null;
  const customers = Array.isArray(context.customers) ? context.customers : [];
  const register = lastConnectionRecordByCustomer(context.connectionRecords ?? context.records ?? []);
  const mohallaKeys = new Set(normalised.mohallas.map((m) => m.key));
  const segmentKeys = new Set(normalised.segments.map((s) => s.key));
  const unitKeys = new Set(normalised.units.map((u) => u.key));
  const affected = [];
  const archived = [];
  for (const raw of customers) {
    const customer = customerRow(raw);
    if (!customer) continue;
    const record = register.get(customer.customerId);
    const matchedBy = [];
    if (customer.mohallaKey && mohallaKeys.has(customer.mohallaKey)) matchedBy.push('mohalla');
    if (record && record.splitterKey && segmentKeys.has(record.splitterKey)) matchedBy.push('segment');
    if (record && record.unitKey && unitKeys.has(record.unitKey)) matchedBy.push('unit');
    if (!matchedBy.length) continue;
    const row = {
      customerId: customer.customerId,
      name: customer.name,
      mohallaLabel: customer.mohallaLabel,
      splitterLabel: record ? record.splitterLabel : '',
      unitLabel: record ? record.unitLabel : '',
      matchedBy,
    };
    if (customer.archived) archived.push(row);
    else affected.push(row);
  }
  affected.sort(compareCustomers);
  archived.sort(compareCustomers);
  return {
    dependency: normalised,
    mapped: normalised.mohallas.length > 0 || normalised.segments.length > 0 || normalised.units.length > 0,
    affected,
    archived,
    customerCount: affected.length,
    archivedCount: archived.length,
  };
}

export function buildDependencyBlastRadii(dependencies, context = {}) {
  return normalizeDependencyList(dependencies)
    .map((dependency) => buildBlastRadius(dependency, context))
    .filter(Boolean);
}

export function dependencySummaryText(dependencies, radii) {
  const list = normalizeDependencyList(dependencies);
  const radiusList = Array.isArray(radii) ? radii : [];
  const mapped = radiusList.filter((r) => r.mapped).length;
  const unmapped = radiusList.filter((r) => !r.mapped).length;
  const totalCustomers = radiusList.reduce((sum, r) => sum + r.customerCount, 0);
  if (!list.length) return 'No dependencies recorded yet.';
  return `${list.length} ${list.length === 1 ? 'dependency' : 'dependencies'} recorded`
    + ` (${mapped} mapped, ${unmapped} unmapped)`
    + `; blast radii cover ${totalCustomers} ${totalCustomers === 1 ? 'customer' : 'customers'} in total.`
    + (unmapped ? ' An unmapped dependency is a gap in the register, never a claim that nothing depends on it.' : '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function dependencyRegisterHtml(dependencies, radii) {
  const list = normalizeDependencyList(dependencies);
  const radiusById = new Map((Array.isArray(radii) ? radii : []).map((r) => [r.dependency.id, r]));
  if (!list.length) return '<p>No dependencies recorded yet.</p>';
  const rows = list.map((d) => {
    const radius = radiusById.get(d.id);
    const status = radius ? (radius.mapped ? 'Mapped' : 'Unmapped') : 'Unmapped';
    return `<tr><td>${escapeHtml(d.name)}</td><td>${escapeHtml(DEPENDENCY_TYPE_LABELS[d.type])}</td>`
      + `<td>${escapeHtml(d.mohallas.map((m) => m.label).join(', ') || '—')}</td>`
      + `<td>${escapeHtml(d.segments.map((s) => s.label).join(', ') || '—')}</td>`
      + `<td>${escapeHtml(d.units.map((u) => u.label).join(', ') || '—')}</td>`
      + `<td>${escapeHtml(status)}</td><td>${radius ? radius.customerCount : 0}</td>`
      + `<td>${escapeHtml(d.note)}</td></tr>`;
  }).join('');
  return '<table><thead><tr><th>Dependency</th><th>Type</th><th>Mohallas</th><th>Segments</th><th>Units</th><th>Status</th><th>Customers in blast radius</th><th>Note</th></tr></thead>'
    + `<tbody>${rows}</tbody></table>`;
}

export function dependencyBlastRadiusHtml(radius) {
  if (!radius) return '<p>Select a dependency to see its blast radius.</p>';
  const d = radius.dependency;
  const heading = radius.mapped
    ? `If ${d.name} fails, ${radius.customerCount} ${radius.customerCount === 1 ? 'customer goes' : 'customers go'} dark.`
    : `${d.name} is unmapped: no mohallas, segments, or units are linked yet, so its blast radius is unknown — not safe.`;
  if (!radius.affected.length && !radius.archived.length) return `<p>${escapeHtml(heading)}</p><p>No customers matched its links.</p>`;
  const row = (c) => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.mohallaLabel)}</td>`
    + `<td>${escapeHtml(c.splitterLabel || '—')}</td><td>${escapeHtml(c.unitLabel || '—')}</td>`
    + `<td>${escapeHtml(c.matchedBy.join(', '))}</td></tr>`;
  return `<p>${escapeHtml(heading)}</p>`
    + '<table><thead><tr><th>Customer</th><th>Mohalla</th><th>Segment</th><th>Unit</th><th>Matched by</th></tr></thead>'
    + `<tbody>${radius.affected.map(row).join('')}</tbody></table>`
    + (radius.archived.length
      ? `<p>Archived customers in the same area (not counted): ${escapeHtml(radius.archived.map((c) => c.name).join(', '))}.</p>` : '');
}

export function dependencyCsv(dependencies, radii) {
  const list = normalizeDependencyList(dependencies);
  const radiusById = new Map((Array.isArray(radii) ? radii : []).map((r) => [r.dependency.id, r]));
  const lines = ['Dependency,Type,Mohallas,Segments,Units,Status,Customers in blast radius,Note'];
  for (const d of list) {
    const radius = radiusById.get(d.id);
    lines.push([
      d.name, DEPENDENCY_TYPE_LABELS[d.type],
      d.mohallas.map((m) => m.label).join('; '),
      d.segments.map((s) => s.label).join('; '),
      d.units.map((u) => u.label).join('; '),
      radius ? (radius.mapped ? 'Mapped' : 'Unmapped') : 'Unmapped',
      radius ? radius.customerCount : 0,
      d.note,
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function dependencyFilename(dateStr) {
  const safe = String(dateStr ?? '').replace(/[^0-9A-Za-z-]/g, '');
  return safe ? `dependency-register-${safe}.csv` : 'dependency-register.csv';
}
